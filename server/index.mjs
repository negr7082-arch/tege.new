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
  sessions: {}, // token -> { userId, createdAt, device }
  channels: {}, // id -> Channel
  groups: {}, // id -> Chat (without messages)
  members: {}, // chatId -> [userId]
  blocks: {}, // userId -> BlockedUser[]
  inbox: {}, // userId -> payload[]
  pushSubs: {}, // userId -> PushSubscription[]
  vapid: null // {publicKey, privateKey}
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

// ───────────────────────── Web Push (phone notifications when the app is closed) ─────────────────────────
let webpush = null;
try {
  webpush = (await import('web-push')).default;
  if (!db.vapid) { db.vapid = webpush.generateVAPIDKeys(); save(); }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://tege-new.onrender.com', db.vapid.publicKey, db.vapid.privateKey);
  console.log('Push notifications: enabled');
} catch (e) {
  webpush = null;
  console.log('Push notifications: disabled (' + (e && e.message) + ')');
}

function pushText(m = {}) {
  if (m.text) return String(m.text).slice(0, 140);
  if (m.isVoice || m.audioUri) return '🎤 Голосовое сообщение';
  if (m.videoNoteUri) return '⭕ Видеосообщение';
  if (m.videoUri) return '🎬 Видео';
  if (m.attachmentUri) return '📷 Фото';
  if (m.fileUri) return '📎 Файл';
  return 'Новое сообщение';
}
async function sendPush(userId, p) {
  if (p.action) return; // delete/edit events are silent
  const subs = db.pushSubs[userId];
  if (!webpush || !subs || !subs.length) return;
  const isDirect = p.chatType === 'direct';
  const fromName = (p.fromUser && p.fromUser.name) || 'Tege';
  const text = pushText(p.message);
  const body = JSON.stringify({
    title: isDirect ? fromName : p.channelOrGroupName || 'Tege',
    body: p.chatType === 'group' ? fromName + ': ' + text : text,
    tag: 'chat-' + p.chatType + '-' + p.chatId,
    chatId: p.chatId,
    chatType: p.chatType
  });
  for (const sub of [...subs]) {
    try {
      await webpush.sendNotification(sub, body, { TTL: 86400, urgency: 'high' });
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        db.pushSubs[userId] = (db.pushSubs[userId] || []).filter((x) => x.endpoint !== sub.endpoint);
        save();
      }
    }
  }
}

// ───────────────────────── helpers ─────────────────────────
const online = new Map(); // userId -> Set<Conn>
const sessionConnections = new Map(); // token -> Set<Conn>
const twoFactorChallenges = new Map(); // challenge token -> { userId, expiresAt }
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
  online: online.has(u.id),
  lastSeenAt: u.lastSeenAt || null
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
  // Also push to the phone; the service worker hides it if the app is currently on screen.
  sendPush(userId, item).catch(() => {});
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

// Limit repeated password guesses per IP + normalized email without permanently locking an account.
const loginFailures = new Map(); // key -> { count, windowStartedAt, lockedUntil }
const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;
const LOGIN_FAILURE_LIMIT = 5;
function loginFailureKey(ip, email) {
  return String(ip || 'unknown') + ':' + String(email || '').trim().toLowerCase();
}
function loginBlocked(ip, email) {
  const key = loginFailureKey(ip, email);
  const entry = loginFailures.get(key);
  if (!entry) return false;
  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) return true;
  if (now - entry.windowStartedAt >= LOGIN_FAILURE_WINDOW_MS || (entry.lockedUntil && entry.lockedUntil <= now)) {
    loginFailures.delete(key);
  }
  return false;
}
function recordLoginFailure(ip, email) {
  const key = loginFailureKey(ip, email);
  const now = Date.now();
  const previous = loginFailures.get(key);
  const entry = !previous || now - previous.windowStartedAt >= LOGIN_FAILURE_WINDOW_MS
    ? { count: 0, windowStartedAt: now, lockedUntil: 0 }
    : previous;
  entry.count += 1;
  if (entry.count >= LOGIN_FAILURE_LIMIT) entry.lockedUntil = now + LOGIN_FAILURE_WINDOW_MS;
  loginFailures.set(key, entry);
  // Bound memory if many distinct addresses are submitted.
  if (loginFailures.size > 50_000) {
    for (const [storedKey, storedEntry] of loginFailures) {
      if (now - storedEntry.windowStartedAt >= LOGIN_FAILURE_WINDOW_MS || storedEntry.lockedUntil <= now) {
        loginFailures.delete(storedKey);
      }
      if (loginFailures.size <= 40_000) break;
    }
  }
}
function clearLoginFailures(ip, email) {
  loginFailures.delete(loginFailureKey(ip, email));
}

// Behind Render's proxy the socket address is the proxy itself, so use the forwarded client address.
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket.remoteAddress || '';
}
const USERNAME_RE = /^@[a-z0-9_]{3,32}$/;
const checks = new Map(); // ip -> [timestamps]
function checkLimited(ip) {
  const now = Date.now();
  const list = (checks.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  checks.set(ip, list);
  return list.length > 120;
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

    const ip = clientIp(req);

    // Live "is this @username free?" check while typing (own, more generous limiter).
    if (url.pathname === '/api/username') {
      if (checkLimited(ip)) return fail(429, 'too_many_requests');
      const b = await readJson(req, 2000);
      const uname = normUsername(b.username);
      if (!USERNAME_RE.test(uname)) return reply(200, { ok: true, available: false, reason: 'invalid' });
      const owner = findByUsername(uname);
      return reply(200, { ok: true, available: !owner, reason: owner ? 'taken' : undefined });
    }

    if (rateLimited(ip)) return fail(429, 'too_many_requests');
    const body = await readJson(req);

    if (url.pathname === '/api/push-key') {
      return reply(200, { ok: Boolean(webpush && db.vapid), key: db.vapid ? db.vapid.publicKey : null });
    }

    if (url.pathname === '/api/push-subscribe') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const sub = body.subscription;
      if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) ||
          !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') {
        return fail(400, 'bad_subscription');
      }
      // one device endpoint belongs to the account that is active on it right now
      for (const id of Object.keys(db.pushSubs)) {
        db.pushSubs[id] = db.pushSubs[id].filter((x) => x.endpoint !== sub.endpoint);
      }
      const list = (db.pushSubs[user.id] ||= []);
      list.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
      if (list.length > 5) list.splice(0, list.length - 5);
      save();
      return reply(200, { ok: true });
    }

    if (url.pathname === '/api/push-unsubscribe') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      db.pushSubs[user.id] = (db.pushSubs[user.id] || []).filter((x) => x.endpoint !== body.endpoint);
      save();
      return reply(200, { ok: true });
    }

    if (url.pathname === '/api/register') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim().slice(0, 64);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'bad_email');
      if (password.length < 7) return fail(400, 'short_password');
      if (!name) return fail(400, 'no_name');
      if (findByEmail(email)) return fail(409, 'email_taken');
      if (body.username && !USERNAME_RE.test(normUsername(body.username))) return fail(400, 'bad_username');
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
      db.sessions[token] = { userId: id, createdAt: Date.now(), device: String(body.device || 'Web browser').slice(0, 120) };
      save();
      broadcast({ type: 'user_upsert', user: publicUser(user) });
      return reply(200, { ok: true, user: selfUser(user, token) });
    }

    if (url.pathname === '/api/login') {
      const email = String(body.email || '').trim().toLowerCase();
      if (loginBlocked(ip, email)) return fail(429, 'too_many_requests');
      const user = findByEmail(email);
      if (!user || !checkPassword(user, String(body.password || ''))) {
        recordLoginFailure(ip, email);
        return fail(401, 'bad_credentials');
      }
      clearLoginFailures(ip, email);
      if (user.cloudPasswordHash && user.cloudPasswordSalt) {
        const challenge = crypto.randomBytes(32).toString('hex');
        twoFactorChallenges.set(challenge, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });
        return reply(200, { ok: true, requiresTwoFactor: true, challenge });
      }
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = user.id;
      db.sessions[token] = { userId: user.id, createdAt: Date.now(), device: String(body.device || 'Web browser').slice(0, 120) };
      save();
      return reply(200, { ok: true, user: selfUser(user, token) });
    }

    if (url.pathname === '/api/login/cloud-password') {
      const challenge = String(body.challenge || '');
      const pending = twoFactorChallenges.get(challenge);
      if (!pending || pending.expiresAt < Date.now()) {
        twoFactorChallenges.delete(challenge);
        return fail(401, 'challenge_expired');
      }
      const user = db.users[pending.userId];
      if (!user || !user.cloudPasswordHash || !user.cloudPasswordSalt) return fail(401, 'bad_credentials');
      const attempt = hashPassword(String(body.cloudPassword || ''), user.cloudPasswordSalt).hash;
      const a = Buffer.from(attempt, 'hex');
      const b = Buffer.from(user.cloudPasswordHash, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        pending.attempts = (pending.attempts || 0) + 1;
        if (pending.attempts >= 5) twoFactorChallenges.delete(challenge);
        return fail(401, pending.attempts >= 5 ? 'challenge_locked' : 'bad_cloud_password');
      }
      twoFactorChallenges.delete(challenge);
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = user.id;
      db.sessions[token] = { userId: user.id, createdAt: Date.now(), device: String(body.device || 'Web browser').slice(0, 120) };
      save();
      return reply(200, { ok: true, user: selfUser(user, token) });
    }

    if (url.pathname === '/api/cloud-password/status') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      return reply(200, { ok: true, enabled: Boolean(user.cloudPasswordHash && user.cloudPasswordSalt) });
    }

    if (url.pathname === '/api/cloud-password/set') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const password = String(body.cloudPassword || '');
      if (password.length < 7 || password.length > 128) return fail(400, 'short_password');
      if (user.cloudPasswordHash && user.cloudPasswordSalt) {
        const current = String(body.currentPassword || '');
        const currentHash = hashPassword(current, user.cloudPasswordSalt).hash;
        if (currentHash !== user.cloudPasswordHash) return fail(401, 'bad_cloud_password');
      }
      const hashed = hashPassword(password);
      user.cloudPasswordSalt = hashed.salt;
      user.cloudPasswordHash = hashed.hash;
      save();
      return reply(200, { ok: true, enabled: true });
    }

    if (url.pathname === '/api/cloud-password/disable') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      if (!user.cloudPasswordHash || !user.cloudPasswordSalt) return reply(200, { ok: true, enabled: false });
      const current = String(body.currentPassword || '');
      const currentHash = hashPassword(current, user.cloudPasswordSalt).hash;
      if (currentHash !== user.cloudPasswordHash) return fail(401, 'bad_cloud_password');
      delete user.cloudPasswordHash;
      delete user.cloudPasswordSalt;
      save();
      return reply(200, { ok: true, enabled: false });
    }

    if (url.pathname === '/api/sessions') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const sessions = Object.entries(db.tokens).filter(([, uid]) => uid === user.id).map(([token]) => {
        const meta = db.sessions[token] || { userId: user.id, createdAt: 0, device: 'Existing session' };
        return { id: token.slice(0, 12), token, device: meta.device || 'Web browser', createdAt: meta.createdAt || 0, current: token === body.token };
      }).sort((a, b) => b.createdAt - a.createdAt);
      return reply(200, { ok: true, sessions });
    }

    if (url.pathname === '/api/sessions/revoke') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const targetToken = String(body.sessionToken || '');
      if (!targetToken || db.tokens[targetToken] !== user.id) return fail(404, 'session_not_found');
      if (targetToken === body.token && !body.allowCurrent) return fail(400, 'cannot_revoke_current');
      delete db.tokens[targetToken];
      delete db.sessions[targetToken];
      const sockets = sessionConnections.get(targetToken);
      if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
      sessionConnections.delete(targetToken);
      save();
      return reply(200, { ok: true });
    }

    if (url.pathname === '/api/sessions/revoke-others') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      for (const [token, uid] of Object.entries(db.tokens)) {
        if (uid !== user.id || token === body.token) continue;
        delete db.tokens[token];
        delete db.sessions[token];
        const sockets = sessionConnections.get(token);
        if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
        sessionConnections.delete(token);
      }
      save();
      return reply(200, { ok: true });
    }

    if (url.pathname === '/api/password') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const pw = String(body.newPassword || '');
      if (pw.length < 7 || pw.length > 256) return fail(400, 'short_password');
      Object.assign(user, hashPassword(pw));
      // sign out all other sessions of this user
      for (const [t, id] of Object.entries(db.tokens)) if (id === user.id && t !== body.token) { delete db.tokens[t]; delete db.sessions[t]; const sockets = sessionConnections.get(t); if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} } sessionConnections.delete(t); }
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
  const action = payload.action === 'delete' || payload.action === 'edit' ? payload.action : undefined;
  if (action && !Number.isFinite(Number(payload.targetId))) return no('bad_action');
  const out = {
    ...(action ? { action, targetId: Number(payload.targetId) } : {}),
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

  const sessionToken = url.searchParams.get('token');
  const sessionSet = sessionConnections.get(sessionToken) || new Set();
  sessionSet.add(conn);
  sessionConnections.set(sessionToken, sessionSet);
  let set = online.get(user.id);
  const wasOffline = !set;
  if (!set) online.set(user.id, (set = new Set()));
  set.add(conn);
  if (wasOffline) broadcast({ type: 'presence', userId: user.id, online: true, lastSeenAt: user.lastSeenAt || null }, conn);

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
    const tokenSockets = sessionConnections.get(sessionToken);
    if (tokenSockets) { tokenSockets.delete(conn); if (!tokenSockets.size) sessionConnections.delete(sessionToken); }
    set.delete(conn);
    if (set.size === 0) {
      online.delete(user.id);
      user.lastSeenAt = Date.now();
      save();
      broadcast({ type: 'presence', userId: user.id, online: false, lastSeenAt: user.lastSeenAt });
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
