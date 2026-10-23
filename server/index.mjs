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
  volunteerApplications: {}, // userId -> {status, checks, createdAt, updatedAt, reviewerId}
  moderationHistory: {}, // userId -> moderation events; never client-controlled
  securityLoginLogs: [], // restricted audit trail; never expose through public profile APIs
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

// Public staff badges are derived from a server-side allowlist, never client profile input.
// Privileged identities are configured by immutable internal user IDs, never by email.
// Email-only ownership is unsafe here because registration does not prove mailbox control.
const TEGE_OWNER_USER_ID = Number.parseInt(process.env.TEGE_OWNER_USER_ID || '', 10);
const CHIEF_VOLUNTEER_USER_ID = Number.parseInt(process.env.TEGE_CHIEF_VOLUNTEER_USER_ID || '', 10);
const VOLUNTEER_ROLES = new Set(['junior_volunteer', 'volunteer', 'chief_volunteer']);
const isOwner = (u) => Number.isSafeInteger(TEGE_OWNER_USER_ID) && TEGE_OWNER_USER_ID > 0 && u?.id === TEGE_OWNER_USER_ID;
const volunteerRoleFor = (u) => {
  if (!u) return null;
  if (isOwner(u) || (Number.isSafeInteger(CHIEF_VOLUNTEER_USER_ID) && CHIEF_VOLUNTEER_USER_ID > 0 && u.id === CHIEF_VOLUNTEER_USER_ID)) return 'chief_volunteer';
  return VOLUNTEER_ROLES.has(u.volunteerRole) ? u.volunteerRole : null;
};
const publicUser = (u) => ({
  volunteerRole: volunteerRoleFor(u),
  isVerified: volunteerRoleFor(u) !== null,
  id: u.id,
  name: u.name,
  username: u.username,
  bio: u.bio || '',
  phone: u.phone,
  country: u.country,
  avatarUri: u.avatarUri || null,
  online: online.has(u.id),
  lastSeenAt: u.lastSeenAt || null
});
const selfUser = (u, token) => ({
  volunteerRole: volunteerRoleFor(u),
  isVerified: volunteerRoleFor(u) !== null,
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

// Render appends the observed client address to X-Forwarded-For; do not trust the client-supplied first entry.
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return forwarded.at(-1) || req.socket.remoteAddress || '';
}
function recordSecurityLogin({ user, ip, req, body, outcome, method }) {
  db.securityLoginLogs ||= [];
  db.securityAlerts ||= [];
  const now = Date.now();
  const safeIp = String(ip || 'unknown').slice(0, 64);
  const agent = String(req.headers['user-agent'] || 'unknown').replace(/[\\r\\n\\t]/g, ' ').slice(0, 300);
  const device = String(body?.device || 'unknown').replace(/[\\r\\n\\t]/g, ' ').slice(0, 120);
  const previousSuccess = user ? [...db.securityLoginLogs].reverse().find((event) => event.userId === user.id && event.outcome === 'success') : null;
  const event = {
    id: crypto.randomBytes(12).toString('hex'), timestamp: now,
    userId: user?.id ?? null, username: user?.username ?? null,
    email: user?.email ?? String(body?.email || '').trim().toLowerCase().slice(0, 254),
    ip: safeIp, userAgent: agent, device, method, outcome
  };
  db.securityLoginLogs.push(event);
  const recentFailures = db.securityLoginLogs.filter((item) =>
    item.userId === event.userId && item.outcome === 'failure' && now - item.timestamp <= 10 * 60_000
  ).length;
  let reason = null;
  if (outcome === 'success' && previousSuccess && previousSuccess.ip !== safeIp) reason = 'new_ip';
  if (outcome === 'success' && previousSuccess && previousSuccess.userAgent !== agent) reason = reason ? 'new_ip_and_device' : 'new_device';
  if (outcome === 'failure' && recentFailures >= 5) reason = 'repeated_failed_logins';
  if (reason) {
    db.securityAlerts.push({
      id: crypto.randomBytes(12).toString('hex'), timestamp: now, severity: reason === 'repeated_failed_logins' ? 'high' : 'medium',
      reason, userId: event.userId, username: event.username, email: event.email,
      ip: safeIp, userAgent: agent, device, outcome, status: 'open'
    });
  }
  // Keep a bounded history (90 days, max 20,000 events / 5,000 alerts).
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  db.securityLoginLogs = db.securityLoginLogs.filter((item) => item.timestamp >= cutoff).slice(-20000);
  db.securityAlerts = db.securityAlerts.filter((item) => item.timestamp >= cutoff).slice(-5000);
  save();
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
    if (url.pathname === '/api/admin/security-alerts') {
      if (req.method !== 'POST') return fail(405, 'method');
      const body = await readJson(req, 10000);
      const requester = userFromToken(body.token);
      const ownerId = Number.parseInt(process.env.TEGE_OWNER_USER_ID || '', 10);
      if (!requester || (requester.id !== ownerId && requester.securityLogsAccess !== true)) return fail(403, 'forbidden');
      const alerts = (db.securityAlerts || []).slice(-100).reverse();
      return reply(200, { ok: true, alerts, pollAfterSeconds: 67 });
    }
    if (url.pathname === '/api/admin/security-login-logs') {
      if (req.method !== 'POST') return fail(405, 'method');
      const body = await readJson(req, 10000);
      const requester = userFromToken(body.token);
      const ownerId = Number.parseInt(process.env.TEGE_OWNER_USER_ID || '', 10);
      if (!requester || (!Number.isSafeInteger(ownerId) || ownerId <= 0 || requester.id !== ownerId) && requester.securityLogsAccess !== true) {
        return fail(403, 'forbidden');
      }
      const targetId = body.userId == null ? null : Number(body.userId);
      const limit = Math.max(1, Math.min(200, Number(body.limit) || 100));
      const logs = (db.securityLoginLogs || [])
        .filter((event) => targetId == null || event.userId === targetId)
        .slice(-limit)
        .reverse();
      db.securityLoginLogs ||= [];
      db.securityLoginLogs.push({ id: crypto.randomBytes(12).toString('hex'), timestamp: Date.now(), userId: requester.id, username: requester.username, ip: clientIp(req), method: 'security_logs_view', outcome: 'success', targetUserId: targetId });
      save();
      return reply(200, { ok: true, logs });
    }
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
        registrationDate: new Date().toLocaleDateString('ru-RU'),
        registeredAt: Date.now()
      };
      db.users[id] = user;
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = id;
      db.sessions[token] = { userId: id, createdAt: Date.now(), device: String(body.device || 'Web browser').slice(0, 120) };
      save();
      recordSecurityLogin({ user, ip, req, body, outcome: 'success', method: 'register' });
      broadcast({ type: 'user_upsert', user: publicUser(user) });
      return reply(200, { ok: true, user: selfUser(user, token) });
    }

    if (url.pathname === '/api/login') {
      const email = String(body.email || '').trim().toLowerCase();
      if (loginBlocked(ip, email)) return fail(429, 'too_many_requests');
      const user = findByEmail(email);
      if (!user || !checkPassword(user, String(body.password || ''))) {
        recordLoginFailure(ip, email);
        recordSecurityLogin({ user, ip, req, body, outcome: 'failure', method: 'password' });
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
      recordSecurityLogin({ user, ip, req, body, outcome: 'success', method: 'password' });
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
      recordSecurityLogin({ user, ip: clientIp(req), req, body, outcome: 'success', method: 'cloud_password' });
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
  let changed = false;
  for (const id of chatIds.map(Number)) {
    const group = db.groups[id];
    const channel = db.channels[id];
    const registry = group || channel;
    if (!registry) continue;
    const list = (db.members[id] ||= []);
    if (list.includes(userId)) continue;
    if (registry.ownerId === userId) {
      list.push(userId);
      changed = true;
      continue;
    }
    if (!registry.isPublic && !(registry.invitedUserIds || []).includes(userId)) continue;
    list.push(userId);
    changed = true;
  }
  if (changed) save();
}

function communityStaff(registry, userId) {
  return !!registry && (registry.ownerId === userId || (registry.admins || []).some((a) => Number(a.id) === userId));
}

function cleanAdmins(admins, ownerId) {
  if (!Array.isArray(admins)) return [];
  return admins.filter((a) => a && Number.isFinite(Number(a.id)) && Number(a.id) !== ownerId)
    .slice(0, 100).map((a) => ({
      id: Number(a.id),
      name: String(a.name || '').slice(0, 64),
      username: String(a.username || '').slice(0, 64),
      permissions: {
        manageMessages: a.permissions?.manageMessages === true,
        manageMembers: a.permissions?.manageMembers === true,
        manageInfo: a.permissions?.manageInfo === true,
        manageAdmins: a.permissions?.manageAdmins === true
      }
    }));
}

function updateCommunity(user, conn, msg) {
  const id = Number(msg.chatId);
  const registry = msg.chatType === 'channel' ? db.channels[id] : db.groups[id];
  const result = (ok, reason) => conn.send({ type: 'community_update_result', chatId: id, chatType: msg.chatType, ok, ...(reason ? { reason } : {}) });
  if (!Number.isFinite(id) || !registry) return result(false, 'chat_not_found');
  if (!communityStaff(registry, user.id)) return result(false, 'forbidden');
  if (msg.action === 'permissions') {
    if (msg.chatType !== 'group' && msg.chatType !== 'channel') return result(false, 'bad_chat_type');
    const p = msg.permissions || {};
    registry.permissions = {
      sendMessages: p.sendMessages !== false,
      sendMedia: p.sendMedia !== false,
      addMembers: p.addMembers === true,
      createTopics: p.createTopics === true,
      pinMessages: p.pinMessages === true
    };
  } else if (msg.action === 'admins') {
    if (registry.ownerId !== user.id) return result(false, 'owner_only');
    registry.admins = cleanAdmins(msg.admins, registry.ownerId);
  } else if (msg.action === 'member_remove') {
    if (registry.ownerId !== user.id && !(registry.admins || []).some((a) => Number(a.id) === user.id && a.permissions?.manageMembers)) return result(false, 'forbidden');
    const memberId = Number(msg.userId);
    if (!Number.isFinite(memberId) || memberId === registry.ownerId) return result(false, 'bad_user');
    db.members[id] = (db.members[id] || []).filter((member) => member !== memberId);
    sendToUser(memberId, { type: 'community_removed', chatId: id, chatType: msg.chatType });
  } else {
    return result(false, 'bad_action');
  }
  const memberCount = (db.members[id] || []).length;
  if (msg.chatType === 'channel') registry.subscribersCount = memberCount;
  else registry.membersCount = memberCount;
  save();
  const event = msg.chatType === 'channel' ? 'channel_upsert' : 'group_upsert';
  broadcast({ type: event, [msg.chatType === 'channel' ? 'channel' : 'group']: registry });
  result(true);
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
  if (!registry) return no('chat_not_found');
  const members = db.members[out.chatId] || [];
  if (!members.includes(user.id)) return no('not_member');
  const isOwner = registry.ownerId === user.id;
  const isAdmin = (registry.admins || []).some((a) => Number(a.id) === user.id);
  if (chatType === 'channel' && !isOwner && !isAdmin) return no('forbidden');
  if (chatType === 'group' && !isOwner && !isAdmin && registry.permissions?.sendMessages === false) return no('forbidden');
  if (!isOwner && !isAdmin && registry.permissions?.sendMedia === false &&
      (out.message.attachmentUri || out.message.videoUri || out.message.audioUri || out.message.fileUri || out.message.videoNoteUri)) {
    return no('media_forbidden');
  }
  const recipients = members.filter((id) => id !== user.id && db.users[id]);
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
    myChatIds: Object.keys(db.members).filter((id) => (db.members[id] || []).includes(user.id)).map(Number),
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

      case 'volunteer_apply': {
        const existing = db.volunteerApplications?.[String(user.id)];
        if (existing?.status === 'pending') {
          conn.send({ type: 'volunteer_apply_result', ok: false, error: 'already_pending' });
          break;
        }
        const registeredAt = Number(user.registeredAt || 0);
        const registrationAgeDays = Number.isFinite(registeredAt) ? Math.floor((Date.now() - registeredAt) / 86400000) : null;
        if (registrationAgeDays === null || registrationAgeDays < 365) {
          conn.send({ type: 'volunteer_apply_result', ok: false, error: 'account_too_new', registrationAgeDays });
          break;
        }
        const checks = {
          age16PlusSelfAttested: msg.checks?.age16PlusSelfAttested === true,
          identityReadyForManualReview: msg.checks?.identityReadyForManualReview === true,
          conductSelfAttested: msg.checks?.conductSelfAttested === true,
          accountAgeAcknowledged: msg.checks?.accountAgeAcknowledged === true
        };
        if (!Object.values(checks).every(Boolean)) {
          conn.send({ type: 'volunteer_apply_result', ok: false, error: 'requirements_incomplete' });
          break;
        }
        // Account age and conduct are reviewed server-side; never trust client-supplied age/IP/history.
        const application = {
          userId: user.id,
          status: 'pending',
          track: 'junior_volunteer',
          checks,
          registrationAgeDays,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          reviewerId: null,
          reviewNote: null
        };
        db.volunteerApplications ||= {};
        db.volunteerApplications[String(user.id)] = application;
        save();
        conn.send({ type: 'volunteer_apply_result', ok: true, status: 'pending', track: application.track });
        break;
      }
      case 'volunteer_user_info': {
        // Detailed account metadata is private to the owner and chief volunteers only.
        if (!isOwner(user) && user.volunteerRole !== 'chief_volunteer') {
          conn.send({ type: 'volunteer_user_info_result', ok: false, error: 'forbidden' });
          break;
        }
        const targetId = Number(msg.userId);
        const target = db.users[String(targetId)];
        if (!Number.isSafeInteger(targetId) || !target) {
          conn.send({ type: 'volunteer_user_info_result', ok: false, error: 'user_not_found' });
          break;
        }
        const registeredAt = Number(target.registeredAt || 0);
        const events = (db.moderationHistory?.[String(targetId)] || []).map((event) => ({
          type: String(event.type || 'unknown'),
          createdAt: Number(event.createdAt || 0),
          expiresAt: event.expiresAt ? Number(event.expiresAt) : null,
          status: String(event.status || 'active')
        }));
        conn.send({
          type: 'volunteer_user_info_result',
          ok: true,
          user: {
            id: target.id,
            username: target.username,
            displayName: target.name,
            registrationDate: registeredAt ? new Date(registeredAt).toISOString() : null,
            accountAgeDays: registeredAt ? Math.max(0, Math.floor((Date.now() - registeredAt) / 86400000)) : null,
            moderationHistory: events,
            moderationHistoryAvailable: Array.isArray(db.moderationHistory?.[String(targetId])),
            lastSeenAt: target.lastSeenAt || null
          }
        });
        break;
      }

      case 'volunteer_application_list': {
        if (!isOwner(user) && user.volunteerRole !== 'chief_volunteer') {
          conn.send({ type: 'volunteer_application_list_result', ok: false, error: 'forbidden' });
          break;
        }
        const applications = Object.values(db.volunteerApplications || {}).map((a) => ({
          userId: a.userId, status: a.status, track: a.track, checks: a.checks,
          registrationAgeDays: a.registrationAgeDays, createdAt: a.createdAt,
          updatedAt: a.updatedAt, reviewerId: a.reviewerId, reviewNote: a.reviewNote
        }));
        conn.send({ type: 'volunteer_application_list_result', ok: true, applications });
        break;
      }
      case 'volunteer_application_review': {
        if (!isOwner(user) && user.volunteerRole !== 'chief_volunteer') {
          conn.send({ type: 'volunteer_application_review_result', ok: false, error: 'forbidden' });
          break;
        }
        const targetId = Number(msg.userId);
        const application = db.volunteerApplications?.[String(targetId)];
        const decision = String(msg.decision || '');
        const note = String(msg.note || '').trim().slice(0, 500);
        if (!Number.isSafeInteger(targetId) || !application || application.status !== 'pending' || !['approve_practice', 'escalate', 'reject'].includes(decision)) {
          conn.send({ type: 'volunteer_application_review_result', ok: false, error: 'invalid_review' });
          break;
        }
        application.status = decision === 'approve_practice' ? 'practice' : decision === 'escalate' ? 'escalated' : 'rejected';
        application.updatedAt = Date.now();
        application.reviewerId = user.id;
        application.reviewNote = note || null;
        if (decision === 'approve_practice') {
          const target = db.users[String(targetId)];
          if (target) target.volunteerRole = 'junior_volunteer';
        }
        save();
        const target = db.users[String(targetId)];
        if (target) broadcast({ type: 'user_upsert', user: publicUser(target) });
        conn.send({ type: 'volunteer_application_review_result', ok: true, userId: targetId, status: application.status });
        break;
      }

      case 'security_logs_access_update': {
        if (!isOwner(user)) {
          conn.send({ type: 'security_logs_access_update_result', ok: false, error: 'forbidden' });
          break;
        }
        const targetId = Number(msg.userId);
        const target = db.users[String(targetId)];
        if (!Number.isSafeInteger(targetId) || !target || typeof msg.enabled !== 'boolean') {
          conn.send({ type: 'security_logs_access_update_result', ok: false, error: 'invalid_input' });
          break;
        }
        target.securityLogsAccess = msg.enabled;
        save();
        conn.send({ type: 'security_logs_access_update_result', ok: true, userId: targetId, enabled: target.securityLogsAccess });
        break;
      }

      case 'volunteer_role_update': {
        // Only the explicitly configured owner account can issue or revoke volunteer roles.
        if (!isOwner(user)) {
          conn.send({ type: 'volunteer_role_update_result', ok: false, error: 'forbidden' });
          break;
        }
        const targetEmail = String(msg.email || '').trim().toLowerCase();
        const role = msg.role === null || msg.role === '' ? null : String(msg.role);
        if (!targetEmail || (role !== null && !VOLUNTEER_ROLES.has(role))) {
          conn.send({ type: 'volunteer_role_update_result', ok: false, error: 'invalid_input' });
          break;
        }
        const target = Object.values(db.users).find((candidate) => candidate.email?.toLowerCase() === targetEmail);
        if (!target) {
          conn.send({ type: 'volunteer_role_update_result', ok: false, error: 'user_not_found' });
          break;
        }
        if (isOwner(target) && role !== 'chief_volunteer') {
          conn.send({ type: 'volunteer_role_update_result', ok: false, error: 'owner_role_protected' });
          break;
        }
        target.volunteerRole = role;
        save();
        broadcast({ type: 'user_upsert', user: publicUser(target) });
        conn.send({ type: 'volunteer_role_update_result', ok: true, user: publicUser(target) });
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

      case 'community_update':
        updateCommunity(user, conn, msg);
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
        db.channels[ch.id] = {
          ...ch,
          ownerId: existing?.ownerId ?? user.id,
          isPublic: existing ? existing.isPublic !== false : ch.isPublic !== false,
          admins: existing?.admins || cleanAdmins(ch.admins, existing?.ownerId ?? user.id),
          permissions: { sendMessages: false, sendMedia: true, addMembers: false, createTopics: false, pinMessages: false, ...(existing?.permissions || ch.permissions || {}) }
        };
        const memberList = (db.members[ch.id] ||= []);
        if (!memberList.includes(user.id)) memberList.push(user.id);
        db.channels[ch.id].subscribersCount = memberList.length;
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
        db.groups[g.id] = {
          ...g,
          ownerId: existing?.ownerId ?? user.id,
          isPublic: existing ? existing.isPublic !== false : g.isPublic !== false,
          admins: existing?.admins || cleanAdmins(g.admins, existing?.ownerId ?? user.id),
          permissions: { sendMessages: true, sendMedia: true, addMembers: true, createTopics: true, pinMessages: false, ...(existing?.permissions || g.permissions || {}) }
        };
        const memberList = (db.members[g.id] ||= []);
        if (!memberList.includes(user.id)) memberList.push(user.id);
        db.groups[g.id].membersCount = memberList.length;
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
