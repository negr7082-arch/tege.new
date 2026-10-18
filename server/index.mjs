// Tege Messenger server — accounts, directory, real-time message routing.
// Zero dependencies. Run:  node server/index.mjs   (PORT=3001 DATA_DIR=./data)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { attachWebSocket } from './ws.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DIST_DIR = path.resolve(process.env.DIST_DIR || path.join(__dirname, '..', 'dist'));
const FIRST_USER_ID = 1122101;
const INBOX_LIMIT = 300;

// ───────────────────────── storage (single JSON file, atomic + debounced) ─────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');

const db = {
  nextUserId: FIRST_USER_ID,
  users: {}, // id -> {id,email,salt,hash,name,username,bio,avatarUri,phone,country,registrationDate}
  tokens: {}, // token -> userId
  channels: {}, // id -> Channel
  groups: {}, // id -> Chat (without messages)
  members: {}, // chatId -> [userId]
  blocks: {}, // userId -> BlockedUser[]
  inbox: {} // userId -> payload[]
};
try {
  Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
} catch {
  /* first run */
}

// Persistent storage: if DATABASE_URL (Postgres, e.g. Neon/Supabase) is set, the whole db object is
// kept in one table row, so accounts survive redeploys on hosts with an ephemeral disk (Render free).
let pool = null;
if (process.env.DATABASE_URL) {
  const { default: pg } = await import('pg');
  // Accept the string even if it has Neon's channel_binding parameter (node-postgres can't use it).
  const url = process.env.DATABASE_URL.trim().replace(/([?&])channel_binding=[^&]*&?/, '$1').replace(/[?&]$/, '');
  const local = /@(localhost|127\.0\.0\.1)/.test(url);
  console.log('Connecting to PostgreSQL...');
  pool = new pg.Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 15000,
    ssl: local ? false : { rejectUnauthorized: false }
  });
  pool.on('error', (e) => console.error('pg pool error:', e.message));
  try {
    await pool.query('create table if not exists kv (k text primary key, v text not null)');
    const r = await pool.query("select v from kv where k = 'db'");
    if (r.rows[0]) Object.assign(db, JSON.parse(r.rows[0].v));
  } catch (e) {
    console.error('FATAL: cannot use PostgreSQL (check DATABASE_URL):', e.message);
    process.exit(1);
  }
  console.log('Storage: PostgreSQL (users: ' + Object.keys(db.users).length + ')');
} else {
  console.log('Storage: file ' + DB_FILE + ' (set DATABASE_URL to keep data on Render)');
}

let saveTimer = null;
let writing = Promise.resolve();
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flush();
  }, 300);
}
function flush() {
  const data = JSON.stringify(db);
  if (!pool) {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, DB_FILE);
    return Promise.resolve();
  }
  writing = writing
    .then(() => pool.query(
      "insert into kv (k, v) values ('db', $1) on conflict (k) do update set v = excluded.v", [data]))
    .catch((e) => console.error('db save failed:', e.message));
  return writing;
}
const shutdown = () => { flush().then(() => process.exit(0)); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ───────────────────────── helpers ─────────────────────────
const online = new Map(); // userId -> Set<Conn>
const activeVideo = new Map(); // chatId -> info

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  bio: u.bio || '',
  phone: u.phone,
  country: u.country,
  registrationDate: u.registrationDate,
  avatarUri: u.avatarUri || null,
  online: online.has(u.id)
});
const selfUser = (u, token) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  username: u.username,
  bio: u.bio || '',
  phone: u.phone,
  country: u.country,
  registrationDate: u.registrationDate,
  avatarUri: u.avatarUri || null,
  token
});

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const normUsername = (s) => {
  const t = String(s || '').trim().toLowerCase();
  return t ? (t.startsWith('@') ? t : '@' + t) : '';
};
const findByEmail = (email) =>
  Object.values(db.users).find((u) => u.email === String(email).trim().toLowerCase());
const findByUsername = (username) => {
  const n = normUsername(username);
  return n ? Object.values(db.users).find((u) => normUsername(u.username) === n) : undefined;
};
const userFromToken = (token) => (token && db.tokens[token] ? db.users[db.tokens[token]] : null);

function sendToUser(userId, obj, exceptConn) {
  const set = online.get(userId);
  if (!set) return;
  for (const c of set) if (c !== exceptConn) c.send(obj);
}
function broadcast(obj, exceptConn) {
  for (const set of online.values()) for (const c of set) if (c !== exceptConn) c.send(obj);
}
const blockedByList = (userId) =>
  Object.entries(db.blocks)
    .filter(([, list]) => list.some((b) => b.id === userId))
    .map(([blocker]) => Number(blocker));

function enqueue(userId, payload) {
  const item = { ...payload, deliveryId: crypto.randomUUID() };
  const box = (db.inbox[userId] ||= []);
  box.push(item);
  if (box.length > INBOX_LIMIT) box.splice(0, box.length - INBOX_LIMIT);
  save();
  sendToUser(userId, { type: 'message', payload: item });
}
function stripMessages(chat) {
  const { messages, ...rest } = chat || {};
  return rest;
}

// ───────────────────────── HTTP ─────────────────────────
const attempts = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 30;
}

function readJson(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.map': 'application/json'
};
function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DIST_DIR, rel);
  if (!file.startsWith(DIST_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Tege server is running. Build the web app (npm run build) to serve it from here.');
  }
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const noCache = file.endsWith('sw.js') || file.endsWith('index.html');
  res.writeHead(200, { 'content-type': type, 'cache-control': noCache ? 'no-cache' : 'public, max-age=31536000, immutable' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);

  const reply = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  const fail = (code, error) => reply(code, { ok: false, error });

  try {
    if (url.pathname === '/api/health') return reply(200, { ok: true, users: Object.keys(db.users).length, online: online.size });
    if (req.method !== 'POST') return fail(405, 'method');

    const ip = req.socket.remoteAddress || '';
    if (rateLimited(ip)) return fail(429, 'too_many_requests');
    const body = await readJson(req);

    if (url.pathname === '/api/register') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim().slice(0, 64);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'bad_email');
      if (password.length < 7) return fail(400, 'short_password');
      if (!name) return fail(400, 'no_name');
      if (findByEmail(email)) return fail(409, 'email_taken');
      const username = normUsername(body.username) || '@' + email.split('@')[0];
      if (findByUsername(username)) return fail(409, 'username_taken');

      const id = db.nextUserId++;
      const { salt, hash } = hashPassword(password);
      const user = {
        id, email, salt, hash, name, username,
        bio: String(body.bio || 'Online on Tege Messenger').slice(0, 300),
        phone: body.phone ? String(body.phone).slice(0, 32) : undefined,
        avatarUri: null,
        registrationDate: new Date().toLocaleDateString('ru-RU')
      };
      db.users[id] = user;
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = id;
      save();
      broadcast({ type: 'user_upsert', user: publicUser(user) });
      return reply(200, { ok: true, user: selfUser(user, token) });
    }

    if (url.pathname === '/api/login') {
      const user = findByEmail(body.email);
      if (!user || !checkPassword(user, String(body.password || ''))) return fail(401, 'bad_credentials');
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = user.id;
      save();
      return reply(200, { ok: true, user: selfUser(user, token) });
    }

    if (url.pathname === '/api/password') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const pw = String(body.newPassword || '');
      if (pw.length < 7) return fail(400, 'short_password');
      Object.assign(user, hashPassword(pw));
      // sign out all other sessions of this user
      for (const [t, id] of Object.entries(db.tokens)) if (id === user.id && t !== body.token) delete db.tokens[t];
      save();
      return reply(200, { ok: true });
    }

    return fail(404, 'not_found');
  } catch (e) {
    return fail(400, e.message || 'bad_request');
  }
});

// ───────────────────────── WebSocket ─────────────────────────
function joinChats(userId, chatIds) {
  for (const id of chatIds.map(Number)) {
    const list = (db.members[id] ||= []);
    if (!list.includes(userId)) list.push(userId);
  }
  save();
}

function handleSend(user, conn, payload) {
  const ok = (extra) => conn.send({ type: 'send_result', id: payload?.id, ok: true, ...extra });
  const no = (reason) => conn.send({ type: 'send_result', id: payload?.id, ok: false, reason });
  if (!payload || !payload.message) return no('bad_payload');

  const chatType = ['direct', 'group', 'channel'].includes(payload.chatType) ? payload.chatType : 'direct';
  const fromUser =
    chatType === 'direct'
      ? { id: user.id, name: user.name, username: user.username, avatarUri: user.avatarUri || null }
      : {
          id: user.id,
          name: String(payload.fromUser?.name || user.name),
          username: user.username,
          avatarUri: payload.fromUser?.avatarUri ?? user.avatarUri ?? null
        };
  const out = {
    id: payload.id,
    fromUser,
    chatId: payload.chatId,
    chatType,
    channelOrGroupName: payload.channelOrGroupName,
    message: { ...payload.message, senderId: user.id }
  };

  if (chatType === 'direct') {
    const target =
      (payload.toUserId && db.users[payload.toUserId]) ||
      (payload.toUsername && findByUsername(payload.toUsername));
    if (!target) return no('no_user');
    if (target.id === user.id) return no('self');
    if ((db.blocks[target.id] || []).some((b) => b.id === user.id)) return no('blocked');
    enqueue(target.id, { ...out, toUserId: target.id, toUsername: target.username });
    return ok();
  }

  // group / channel
  const registry = chatType === 'channel' ? db.channels[out.chatId] : db.groups[out.chatId];
  if (chatType === 'channel' && registry) {
    const isStaff = registry.ownerId === user.id || (registry.admins || []).some((a) => a.id === user.id);
    if (!isStaff) return no('forbidden');
  }
  const recipients = (db.members[out.chatId] || []).filter((id) => id !== user.id && db.users[id]);
  for (const id of recipients) enqueue(id, out);
  return ok({ delivered: recipients.length });
}

attachWebSocket(server, (conn, url) => {
  const user = userFromToken(url.searchParams.get('token'));
  if (!user) {
    conn.send({ type: 'auth_error' });
    conn.close(4001);
    return;
  }

  let set = online.get(user.id);
  const wasOffline = !set;
  if (!set) online.set(user.id, (set = new Set()));
  set.add(conn);
  if (wasOffline) broadcast({ type: 'presence', userId: user.id, online: true }, conn);

  conn.send({
    type: 'snapshot',
    me: selfUser(user, url.searchParams.get('token')),
    users: Object.values(db.users).map(publicUser),
    channels: Object.values(db.channels),
    groups: Object.values(db.groups),
    blocks: db.blocks[user.id] || [],
    blockedBy: blockedByList(user.id),
    videoChats: Object.fromEntries(activeVideo)
  });
  // pending offline messages
  for (const item of db.inbox[user.id] || []) conn.send({ type: 'message', payload: item });

  const heartbeat = setInterval(() => {
    if (!conn.alive) return conn.socket.destroy();
    conn.alive = false;
    conn.ping();
  }, 30_000);

  conn.onclose = () => {
    clearInterval(heartbeat);
    set.delete(conn);
    if (set.size === 0) {
      online.delete(user.id);
      broadcast({ type: 'presence', userId: user.id, online: false });
    }
  };

  conn.onmessage = (raw) => {
    conn.alive = true;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'send':
        handleSend(user, conn, msg.payload);
        break;

      case 'ack': {
        const ids = new Set(msg.ids || []);
        const box = db.inbox[user.id];
        if (box && ids.size) {
          db.inbox[user.id] = box.filter((m) => !ids.has(m.deliveryId));
          save();
        }
        break;
      }

      case 'profile': {
        const p = msg.user || {};
        if (typeof p.name === 'string' && p.name.trim()) user.name = p.name.trim().slice(0, 64);
        if (typeof p.bio === 'string') user.bio = p.bio.slice(0, 300);
        if (typeof p.phone === 'string') user.phone = p.phone.slice(0, 32);
        if (typeof p.country === 'string') user.country = p.country.slice(0, 64);
        if ('avatarUri' in p) user.avatarUri = p.avatarUri || null;
        if (typeof p.username === 'string' && normUsername(p.username) !== normUsername(user.username)) {
          const other = findByUsername(p.username);
          if (other && other.id !== user.id) conn.send({ type: 'profile_result', ok: false, error: 'username_taken' });
          else user.username = normUsername(p.username);
        }
        save();
        broadcast({ type: 'user_upsert', user: publicUser(user) });
        break;
      }

      case 'join_chats':
        joinChats(user.id, Array.isArray(msg.chatIds) ? msg.chatIds.filter(Number.isFinite) : []);
        break;

      case 'leave_chat':
        if (db.members[msg.chatId]) {
          db.members[msg.chatId] = db.members[msg.chatId].filter((x) => x !== user.id);
          save();
        }
        break;

      case 'register_channel': {
        const ch = msg.channel;
        if (!ch || !Number.isFinite(ch.id)) break;
        const existing = db.channels[ch.id];
        if (existing && existing.ownerId !== user.id && !(existing.admins || []).some((a) => a.id === user.id)) break;
        db.channels[ch.id] = { ...ch, ownerId: existing?.ownerId ?? user.id };
        save();
        broadcast({ type: 'channel_upsert', channel: db.channels[ch.id] });
        break;
      }
      case 'remove_channel': {
        const ch = db.channels[msg.channelId];
        if (ch && ch.ownerId === user.id) {
          delete db.channels[msg.channelId];
          delete db.members[msg.channelId];
          save();
          broadcast({ type: 'channel_remove', channelId: msg.channelId });
        }
        break;
      }
      case 'register_group': {
        const g = stripMessages(msg.group);
        if (!g || !Number.isFinite(g.id) || g.type !== 'group') break;
        const existing = db.groups[g.id];
        if (existing && existing.ownerId !== user.id) break;
        db.groups[g.id] = { ...g, ownerId: existing?.ownerId ?? user.id };
        save();
        broadcast({ type: 'group_upsert', group: db.groups[g.id] });
        break;
      }

      case 'block': {
        const b = msg.user;
        if (!b || !Number.isFinite(b.id) || b.id === user.id) break;
        const list = (db.blocks[user.id] ||= []);
        if (!list.some((x) => x.id === b.id)) list.push({ ...b, blockedAt: Date.now() });
        save();
        sendToUser(b.id, { type: 'blocked_by', ids: blockedByList(b.id) });
        break;
      }
      case 'unblock': {
        db.blocks[user.id] = (db.blocks[user.id] || []).filter((x) => x.id !== msg.userId);
        save();
        sendToUser(msg.userId, { type: 'blocked_by', ids: blockedByList(msg.userId) });
        break;
      }

      case 'video_chat': {
        const { chatId, info } = msg;
        if (!Number.isFinite(chatId)) break;
        if (info && info.isActive) activeVideo.set(chatId, info);
        else activeVideo.delete(chatId);
        const targets = new Set([...(db.members[chatId] || []), user.id]);
        for (const id of targets) sendToUser(id, { type: 'video_chat', chatId, info: info || null }, conn);
        break;
      }

      case 'ping':
        conn.send({ type: 'pong' });
        break;
    }
  };
});

server.listen(PORT, () => console.log(`Tege server on :${PORT}  (data: ${DATA_DIR})`));
