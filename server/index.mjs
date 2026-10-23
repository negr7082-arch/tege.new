// Tege Messenger server — accounts, directory, real-time message routing.
// Zero dependencies. Run:  node server/index.mjs   (PORT=3001 DATA_DIR=./data)
import http from 'node:http';
import { isIP } from 'node:net';
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
  vapid: null, // {publicKey, privateKey}
  securityEvents: {}, // userId -> [{id,type,createdAt,until,reason}]
  messageAuthors: {}, // chat/type/message key -> authenticated sender user ID
  securityBlockedIps: [],
  securityBlockedEmails: [],
  securityBlockedDevices: [],
  channelComments: {} // `${channelId}:${postId}` -> Comment[]
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
const activeVideo = new Map();
const spamWindows = new Map(); // userId -> message timestamps in rolling 19-minute window
const SPAM_WINDOW_MS = 19 * 60_000;
const SPAM_MUTE_MS = 3 * 24 * 60 * 60_000;
const SECURITY_BOT_ID = -700000001;
const securityEventsFor = (userId) => (db.securityEvents[userId] ||= []);
function recordSecurityEvent(userId, event) {
  const list = securityEventsFor(userId);
  list.unshift({ id: crypto.randomUUID(), createdAt: Date.now(), ...event });
  if (list.length > 100) list.length = 100;
  save();
  sendToUser(userId, { type: 'security_event', event: list[0] });
}

// Persist and deliver suspicious-account reports to configured volunteer staff.
function notifySecurityReviewStaff(targetUser, review) {
  const staffIds = new Set([
    ...volunteerIds,
    ...seniorVolunteerIds,
    ...headVolunteerIds
  ]);
  const notice = {
    type: 'security_review_alert',
    targetUserId: Number(targetUser.id),
    targetUsername: String(targetUser.username || ''),
    targetName: String(targetUser.name || ''),
    reason: String(review.reason || 'Подозрительная активность'),
    signals: Array.isArray(review.signals) ? review.signals : [],
    reviewStartedAt: Number(review.startedAt || Date.now()),
    reviewUntil: Number(review.until || Date.now() + 24 * 60 * 60_000)
  };
  for (const staffId of staffIds) {
    if (!db.users[staffId]) continue;
    recordSecurityEvent(staffId, {
      type: 'security_review_alert',
      reason: `Требуется проверка аккаунта #${notice.targetUserId} (${notice.targetUsername || notice.targetName || 'без имени'}): ${notice.reason}`,
      targetUserId: notice.targetUserId,
      riskSignals: notice.signals,
      reviewUntil: notice.reviewUntil
    });
    sendToUser(staffId, notice);
  }
}
function applySpamMute(user, durationMs, reason) {
  const until = durationMs === Infinity ? null : Date.now() + durationMs;
  user.spamMuteUntil = until;
  user.spamMutedPermanently = durationMs === Infinity;
  user.spamMuteReason = reason;
  recordSecurityEvent(user.id, { type: 'spam_mute', reason, until, permanent: durationMs === Infinity, botId: SECURITY_BOT_ID });
  sendToUser(user.id, { type: 'security_bot_notice', botId: SECURITY_BOT_ID, text: durationMs === Infinity ? 'Системный Security: за массовый спам установлен постоянный мут.' : 'Системный Security: обнаружен массовый спам. Мут на 3 дня.' });
}
function deleteAccountData(userId) {
  const user = db.users[userId];
  if (!user) return false;
  for (const [token, id] of Object.entries(db.tokens)) if (id === userId) {
    delete db.tokens[token]; delete db.sessions[token];
    const sockets = sessionConnections.get(token);
    if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
    sessionConnections.delete(token);
  }
  delete db.pushSubs[userId]; delete db.inbox[userId]; delete db.blocks[userId]; delete db.securityEvents[userId];
  for (const list of Object.values(db.blocks)) for (let i=list.length-1;i>=0;i--) if (list[i].id === userId) list.splice(i,1);
  for (const [chatId, members] of Object.entries(db.members)) db.members[chatId] = members.filter(id => id !== userId);
  for (const [id, group] of Object.entries(db.groups)) if (group.ownerId === userId) { delete db.groups[id]; delete db.members[id]; }
  for (const [id, channel] of Object.entries(db.channels)) if (channel.ownerId === userId) { delete db.channels[id]; delete db.members[id]; }
  delete db.users[userId];
  const sockets = online.get(userId);
  if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
  online.delete(userId); spamWindows.delete(userId);
  broadcast({ type: 'user_remove', userId });
  save();
  return true;
}
function enforceInactivityDeletion() {
  const now = Date.now();
  for (const user of Object.values(db.users)) {
    const months = user.deleteAfterMonths;
    if (![1,3,6,8,12,16,24].includes(months)) continue;
    const last = Number(user.lastActiveAt || user.createdAt || now);
    if (now - last >= months * 30 * 24 * 60 * 60_000) deleteAccountData(user.id);
  }
}
setInterval(enforceInactivityDeletion, 60 * 60_000).unref();
enforceInactivityDeletion(); // chatId -> info

// Privileged roles and verification are controlled ONLY by server-side numeric account IDs.
// Never grant staff or verification based on a client-supplied email: registration currently does
// not prove mailbox ownership, so email allowlists would let an attacker claim a privileged address.
const configuredIds = (value) => new Set(String(value || '').split(',').map((s) => Number(s.trim())).filter((id) => Number.isSafeInteger(id) && id > 0));
const volunteerIds = configuredIds(process.env.TEGE_VOLUNTEER_USER_IDS);
const seniorVolunteerIds = configuredIds(process.env.TEGE_SENIOR_VOLUNTEER_USER_IDS);
const headVolunteerIds = configuredIds(process.env.TEGE_HEAD_VOLUNTEER_USER_IDS);
const verifiedUserIds = configuredIds(process.env.TEGE_VERIFIED_USER_IDS);
const securityAdminIds = configuredIds(process.env.TEGE_SECURITY_ADMIN_USER_IDS);
const isVerifiedUser = (u) => verifiedUserIds.has(Number(u.id));
const staffRole = (u) => {
  if (headVolunteerIds.has(Number(u.id))) return 'head_volunteer';
  if (seniorVolunteerIds.has(Number(u.id))) return 'senior_volunteer';
  if (volunteerIds.has(Number(u.id))) return 'volunteer';
  return 'user';
};
const publicUser = (u) => ({
  id: u.id,
  role: staffRole(u),
  verified: isVerifiedUser(u),
  name: u.name,
  username: u.username,
  bio: u.bio || '',
  // Phone numbers are private account data unless a future explicit visibility setting is added.
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
  token,
  role: staffRole(u),
  verified: isVerifiedUser(u)
});

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  if (String(password).length > 256) throw new Error('password_too_long');
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
const userFromToken = (token) => { const user = token && db.tokens[token] ? db.users[db.tokens[token]] : null; return user && !user.securitySuspended ? user : null; };

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
  if (list.length > 31) list.splice(0, list.length - 31);
  attempts.set(ip, list);
  return list.length > 30;
}

// Behind Render's proxy the socket address is the proxy itself, so use the forwarded client address.
function clientIp(req) {
  // Reverse proxies append the observed client address; use the rightmost forwarded address
  // rather than trusting a client-supplied leftmost X-Forwarded-For value.
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((v) => v.trim()).filter(Boolean);
  return forwarded.length ? forwarded[forwarded.length - 1] : req.socket.remoteAddress || '';
}
const normaliseIp = (value) => String(value || '').trim().replace(/^::ffff:/, '');
const securityDeviceHash = (value) => crypto.createHash('sha256').update(String(value || '').trim().slice(0, 200)).digest('hex');
const verifyDeviceProof = (body, email) => {
  const proof = body && body.deviceProof;
  if (!proof) return { deviceId: String(body.deviceId || ''), invalid: false };
  try {
    const publicKeyBytes = Buffer.from(String(proof.publicKey || ''), 'base64');
    const signatureBytes = Buffer.from(String(proof.signature || ''), 'base64');
    const nonce = String(proof.nonce || '');
    const timestamp = Number(proof.timestamp);
    const now = Date.now();
    if (!publicKeyBytes.length || !signatureBytes.length || nonce.length < 16 || nonce.length > 128 || !Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5 * 60_000) return { deviceId: '', invalid: true };
    const publicKey = crypto.createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
    const canonicalPublicKey = publicKey.export({ type: 'spki', format: 'der' });
    const deviceId = crypto.createHash('sha256').update(canonicalPublicKey).digest('hex');
    if (String(body.deviceId || '') !== deviceId) return { deviceId: '', invalid: true };
    const payload = Buffer.from(`${String(email || '').trim().toLowerCase()}:${nonce}:${timestamp}`);
    if (!crypto.verify('sha256', payload, publicKey, signatureBytes)) return { deviceId: '', invalid: true };
    db.securityUsedDeviceNonces ||= [];
    db.securityUsedDeviceNonces = db.securityUsedDeviceNonces.filter((entry) => now - Number(entry.at || 0) < 24 * 60 * 60_000);
    const nonceHash = crypto.createHash('sha256').update(`${deviceId}:${nonce}`).digest('hex');
    if (db.securityUsedDeviceNonces.some((entry) => entry.hash === nonceHash)) return { deviceId: '', invalid: true };
    db.securityUsedDeviceNonces.push({ hash: nonceHash, at: now });
    if (db.securityUsedDeviceNonces.length > 10000) db.securityUsedDeviceNonces = db.securityUsedDeviceNonces.slice(-10000);
    save();
    return { deviceId, invalid: false };
  } catch {
    return { deviceId: '', invalid: true };
  }
};
const sanitizeDeviceInfo = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const clean = (key, max = 100) => typeof value[key] === 'string' ? value[key].trim().slice(0, max) : '';
  return {
    platform: clean('platform', 24),
    manufacturer: clean('manufacturer', 80),
    model: clean('model', 100),
    androidSdk: Number.isInteger(value.androidSdk) ? Math.max(0, Math.min(1000, value.androidSdk)) : null,
    appVersion: clean('appVersion', 32),
    networkType: clean('networkType', 24)
  };
};
const securityLoginFailures = new Map();
const securityIpLockouts = new Map();
const SECURITY_FAILURE_WINDOW_MS = 15 * 60_000;
const SECURITY_FAILURE_LIMIT = 10;
function isSecurityIpBlocked(ip) {
  const normal = normaliseIp(ip);
  const until = Number(securityIpLockouts.get(normal) || 0);
  if (until <= Date.now()) { securityIpLockouts.delete(normal); return (db.securityBlockedIps || []).includes(normal); }
  return true;
}
function recordLoginFailure(email, ip) {
  const now = Date.now();
  const normalIp = normaliseIp(ip);
  const key = normalIp + '|' + String(email || '').trim().toLowerCase();
  const entries = (securityLoginFailures.get(key) || []).filter((t) => now - t < SECURITY_FAILURE_WINDOW_MS);
  entries.push(now);
  securityLoginFailures.set(key, entries);
  if (entries.length >= SECURITY_FAILURE_LIMIT) {
    securityIpLockouts.set(normalIp, now + SECURITY_FAILURE_WINDOW_MS);
    return true;
  }
  return false;
}
function clearLoginFailures(email, ip) {
  securityLoginFailures.delete(normaliseIp(ip) + '|' + String(email || '').trim().toLowerCase());
}
function revokeUserSessions(userId) {
  for (const [token, id] of Object.entries(db.tokens)) {
    if (id !== userId) continue;
    delete db.tokens[token]; delete db.sessions[token];
    const sockets = sessionConnections.get(token);
    if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
    sessionConnections.delete(token);
  }
}

const USERNAME_RE = /^@[a-z0-9_]{3,32}$/;
const checks = new Map(); // ip -> [timestamps]
function checkLimited(ip) {
  const now = Date.now();
  const list = (checks.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  if (list.length > 121) list.splice(0, list.length - 121);
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

    const ip = normaliseIp(clientIp(req));

    // Live "is this @username free?" check while typing (own, more generous limiter).
    if (url.pathname === '/api/username') {
      if (checkLimited(ip)) return fail(429, 'too_many_requests');
      const b = await readJson(req, 2000);
      const uname = normUsername(b.username);
      if (!USERNAME_RE.test(uname)) return reply(200, { ok: true, available: false, reason: 'invalid' });
      const owner = findByUsername(uname);
      return reply(200, { ok: true, available: !owner, reason: owner ? 'taken' : undefined });
    }

    if (url.pathname !== '/api/login' && url.pathname !== '/api/register' && isSecurityIpBlocked(ip)) return fail(403, 'security_ip_blocked');
    if (rateLimited(ip)) return fail(429, 'too_many_requests');
    const body = await readJson(req);

    // Channel post discussions: comments are stored by channel + post, never only in UI memory.
    if (url.pathname === '/api/channels/comments/list') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const channelId = Number(body.channelId);
      const postId = Number(body.postId);
      if (!Number.isSafeInteger(channelId) || !Number.isSafeInteger(postId)) return fail(400, 'bad_post');
      const channel = db.channels[channelId];
      if (!channel) return fail(404, 'channel_not_found');
      const canView = channel.isPublic !== false || channel.ownerId === user.id ||
        (channel.admins || []).some((a) => a.id === user.id) ||
        (db.members[channelId] || []).includes(user.id);
      if (!canView) return fail(403, 'forbidden');
      return reply(200, { ok: true, comments: db.channelComments[`${channelId}:${postId}`] || [] });
    }

    if (url.pathname === '/api/channels/comments/add') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const channelId = Number(body.channelId);
      const postId = Number(body.postId);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!Number.isSafeInteger(channelId) || !Number.isSafeInteger(postId) || !text || text.length > 2000) return fail(400, 'bad_comment');
      const channel = db.channels[channelId];
      if (!channel) return fail(404, 'channel_not_found');
      const canView = channel.isPublic !== false || channel.ownerId === user.id ||
        (channel.admins || []).some((a) => a.id === user.id) ||
        (db.members[channelId] || []).includes(user.id);
      if (!canView) return fail(403, 'forbidden');
      const key = `${channelId}:${postId}`;
      const comments = (db.channelComments[key] ||= []);
      if (comments.length >= 500) return fail(429, 'too_many_comments');
      const now = Date.now();
      const recent = comments.filter((comment) => comment.authorId === user.id && now - Number(comment.createdAt || 0) < 10_000);
      if (recent.length >= 5) return fail(429, 'comment_rate_limited');
      const comment = {
        id: crypto.randomUUID(),
        authorId: user.id,
        authorName: user.name,
        authorUsername: user.username,
        authorAvatarUri: user.avatarUri || null,
        text,
        time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: now
      };
      comments.push(comment);
      save();
      // Never broadcast private-channel comments to every connected account.
      const commentEvent = { type: 'channel_comment', channelId, postId, comment };
      for (const [recipientId, connections] of online) {
        if (!canAccessChat(recipientId, channelId)) continue;
        for (const recipientConn of connections) recipientConn.send(commentEvent);
      }
      return reply(201, { ok: true, comment, comments });
    }

    if (url.pathname === '/api/account/me') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      return reply(200, { ok: true, user: selfUser(user, body.token) });
    }

    if (url.pathname === '/api/account/inactivity/status') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const months = [1,3,6,8,12,16,24].includes(user.deleteAfterMonths) ? user.deleteAfterMonths : null;
      const lastActiveAt = Number(user.lastActiveAt || user.createdAt || Date.now());
      return reply(200, { ok: true, months, lastActiveAt, deletionAt: months ? lastActiveAt + months * 30 * 24 * 60 * 60_000 : null });
    }

    if (url.pathname === '/api/account/inactivity') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const months = body.months === null ? null : Number(body.months);
      if (months !== null && ![1,3,6,8,12,16,24].includes(months)) return fail(400, 'bad_inactivity_period');
      user.deleteAfterMonths = months;
      user.lastActiveAt = Date.now();
      save();
      return reply(200, { ok: true, months, lastActiveAt: user.lastActiveAt, deletionAt: months ? user.lastActiveAt + months * 30 * 24 * 60 * 60_000 : null });
    }

    if (url.pathname === '/api/account/delete') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      if (!checkPassword(user, String(body.password || ''))) return fail(401, 'bad_credentials');
      deleteAccountData(user.id);
      return reply(200, { ok: true });
    }

    if (url.pathname === '/api/security/events') {
      const user = userFromToken(body.token);
      if (!user) return fail(401, 'bad_token');
      const now = Date.now();
      const muteUntil = user.spamMutedPermanently ? null : Number(user.spamMuteUntil || 0);
      const activeMute = Boolean(user.spamMutedPermanently || muteUntil > now);
      return reply(200, { ok: true, bot: { id: SECURITY_BOT_ID, name: 'Security' }, activeMute: activeMute ? { permanent: Boolean(user.spamMutedPermanently), until: muteUntil || null } : null, events: securityEventsFor(user.id) });
    }

    // Staff moderation is enforced on the server. Volunteer role comes from private env allowlists.
    if (url.pathname === '/api/security/reports/create') {
      const reporter = userFromToken(body.token);
      if (!reporter) return fail(401, 'bad_token');
      const target = db.users[Number(body.targetUserId)];
      if (!target) return fail(404, 'user_not_found');
      if (target.id === reporter.id) return fail(400, 'cannot_report_self');
      const categories = ['spam', 'adult', 'harassment', 'violence', 'scam', 'other'];
      const category = String(body.category || '');
      if (!categories.includes(category)) return fail(400, 'bad_report_category');
      const reports = db.securityReports ||= [];
      const messageId = String(body.messageId || '').slice(0, 100);
      const duplicate = reports.find((r) => r.reporterId === reporter.id && r.targetUserId === target.id && r.messageId === messageId && r.status === 'open');
      if (duplicate) return reply(200, { ok: true, report: duplicate, duplicate: true });
      const report = { id: crypto.randomUUID(), reporterId: reporter.id, targetUserId: target.id, messageId, messageText: String(body.messageText || '').slice(0, 2000), category, details: String(body.details || '').trim().slice(0, 500), status: 'open', assignedTo: null, createdAt: Date.now(), history: [] };
      reports.unshift(report);
      if (reports.length > 5000) reports.length = 5000;
      save();
      for (const u of Object.values(db.users)) if (['volunteer', 'senior_volunteer', 'head_volunteer'].includes(staffRole(u))) sendToUser(u.id, { type: 'security_report_new', reportId: report.id, category });
      return reply(201, { ok: true, report });
    }
    if (url.pathname === '/api/security/reports/list') {
      const actor = userFromToken(body.token);
      if (!actor) return fail(401, 'bad_token');
      const role = staffRole(actor);
      if (!['volunteer', 'senior_volunteer', 'head_volunteer'].includes(role)) return fail(403, 'staff_only');
      const reports = (db.securityReports || []).filter((r) => role === 'volunteer' ? ['open', 'reviewing'].includes(r.status) : true);
      return reply(200, { ok: true, role, reports: reports.slice(0, 500) });
    }
    if (url.pathname === '/api/security/reports/action') {
      const actor = userFromToken(body.token);
      if (!actor) return fail(401, 'bad_token');
      const role = staffRole(actor);
      if (!['volunteer', 'senior_volunteer', 'head_volunteer'].includes(role)) return fail(403, 'staff_only');
      const reports = db.securityReports ||= [];
      const report = reports.find((r) => r.id === String(body.reportId || ''));
      if (!report) return fail(404, 'report_not_found');
      const action = String(body.action || '');
      if (action === 'review') {
        if (role !== 'volunteer' || report.status !== 'open') return fail(403, 'junior_review_only');
        report.status = 'reviewing'; report.assignedTo = actor.id;
      } else if (action === 'forward') {
        if (role !== 'volunteer') return fail(403, 'junior_volunteer_only');
        report.status = 'forwarded'; report.assignedTo = 'senior_volunteers';
      } else if (action === 'resolve') {
        if (!['senior_volunteer', 'head_volunteer'].includes(role)) return fail(403, 'senior_volunteer_required');
        report.status = 'resolved';
      } else return fail(400, 'bad_action');
      report.history ||= [];
      report.history.unshift({ actorId: actor.id, actorRole: role, action, createdAt: Date.now(), note: String(body.note || '').slice(0, 300) });
      save();
      if (action === 'forward') for (const u of Object.values(db.users)) if (['senior_volunteer', 'head_volunteer'].includes(staffRole(u))) sendToUser(u.id, { type: 'security_report_forwarded', reportId: report.id });
      return reply(200, { ok: true, report });
    }

    if (url.pathname === '/api/security/moderation/list') {
      const actor = userFromToken(body.token);
      if (!actor) return fail(401, 'bad_token');
      if (!['volunteer', 'senior_volunteer', 'head_volunteer'].includes(staffRole(actor))) return fail(403, 'staff_only');
      const now = Date.now();
      const mutedUsers = Object.values(db.users)
        .filter((u) => Boolean(u.spamMutedPermanently || Number(u.spamMuteUntil || 0) > now))
        .map((u) => ({
          id: u.id, name: u.name, username: u.username,
          permanent: Boolean(u.spamMutedPermanently),
          until: u.spamMutedPermanently ? null : Number(u.spamMuteUntil || 0),
          reason: String(u.spamMuteReason || securityEventsFor(u.id).find((e) => e.type === 'spam_mute')?.reason || 'Spam detection'),
          events: securityEventsFor(u.id).slice(0, 20)
        }));
      return reply(200, { ok: true, role: staffRole(actor), mutedUsers });
    }

    if (url.pathname === '/api/security/moderation/action') {
      const actor = userFromToken(body.token);
      if (!actor) return fail(401, 'bad_token');
      const role = staffRole(actor);
      if (!['volunteer', 'senior_volunteer', 'head_volunteer'].includes(role)) return fail(403, 'staff_only');
      const targetId = Number(body.targetUserId);
      const target = Number.isSafeInteger(targetId) ? db.users[targetId] : null;
      if (!target) return fail(404, 'user_not_found');
      const action = String(body.action || '');
      const now = Date.now();
      const isMuted = Boolean(target.spamMutedPermanently || Number(target.spamMuteUntil || 0) > now);
      if (!isMuted) return fail(409, 'not_muted');
      if (action === 'unmute') {
        if (!['senior_volunteer', 'head_volunteer'].includes(role)) return fail(403, 'senior_volunteer_required');
        delete target.spamMuteUntil;
        delete target.spamMutedPermanently;
        delete target.spamMuteReason;
        recordSecurityEvent(target.id, { type: 'moderation_unmute', reason: 'Мут снят старшим волонтёром', actorId: actor.id, actorRole: role });
      } else if (action === 'extend') {
        const hours = Number(body.hours);
        if (!Number.isInteger(hours) || hours < 1 || hours > 720) return fail(400, 'bad_duration');
        if (target.spamMutedPermanently) return fail(409, 'permanent_mute');
        target.spamMuteUntil = Math.max(Number(target.spamMuteUntil || 0), now) + hours * 60 * 60_000;
        target.spamMuteReason = String(target.spamMuteReason || 'Spam detection');
        recordSecurityEvent(target.id, { type: 'moderation_extend', reason: `Мут продлён на ${hours} ч.`, until: target.spamMuteUntil, actorId: actor.id, actorRole: role });
      } else if (action === 'reason') {
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (reason.length < 5 || reason.length > 300) return fail(400, 'bad_reason');
        target.spamMuteReason = reason;
        recordSecurityEvent(target.id, { type: 'moderation_reason', reason, until: target.spamMutedPermanently ? null : target.spamMuteUntil, permanent: Boolean(target.spamMutedPermanently), actorId: actor.id, actorRole: role });
      } else {
        return fail(400, 'bad_action');
      }
      save();
      return reply(200, { ok: true, role, targetUserId: target.id, permanent: Boolean(target.spamMutedPermanently), until: target.spamMutedPermanently ? null : Number(target.spamMuteUntil || 0), reason: target.spamMuteReason || null });
    }

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

    if (url.pathname === '/api/security/admin/action') {
      const actor = userFromToken(body.token);
      if (!actor || !securityAdminIds.has(Number(actor.id))) return fail(403, 'security_admin_required');
      const action = String(body.action || '');
      const now = Date.now();
      if (action === 'freeze_account' || action === 'unfreeze_account') {
        const target = db.users[Number(body.targetUserId)];
        if (!target) return fail(404, 'user_not_found');
        if (target.id === actor.id && action === 'freeze_account') return fail(400, 'cannot_freeze_self');
        if (action === 'freeze_account') {
          target.securitySuspended = true;
          target.securitySuspensionReason = String(body.reason || 'Заморожен администратором Security').trim().slice(0, 300);
          target.securitySuspendedAt = now;
          revokeUserSessions(target.id);
          recordSecurityEvent(target.id, { type: 'account_frozen', reason: target.securitySuspensionReason, actorId: actor.id, permanent: true });
        } else {
          delete target.securitySuspended; delete target.securitySuspensionReason; delete target.securitySuspendedAt;
          delete target.securityReviewStartedAt; delete target.securityReviewUntil; delete target.securityReviewSignals; delete target.securityReviewReason;
          recordSecurityEvent(target.id, { type: 'account_unfrozen', reason: String(body.reason || 'Разморожен администратором Security').slice(0, 300), actorId: actor.id });
        }
        save();
        return reply(200, { ok: true, targetUserId: target.id, suspended: Boolean(target.securitySuspended) });
      }
      if (action === 'block_ip' || action === 'unblock_ip') {
        const targetIp = normaliseIp(body.ip);
        if (!targetIp || !isIP(targetIp)) return fail(400, 'bad_ip');
        db.securityBlockedIps ||= [];
        db.securityBlockedIps = action === 'block_ip' ? [...new Set([...db.securityBlockedIps, targetIp])] : db.securityBlockedIps.filter((v) => v !== targetIp);
        if (action === 'block_ip') {
          for (const [token, meta] of Object.entries(db.sessions)) {
            if (normaliseIp(meta.ip) !== targetIp) continue;
            delete db.tokens[token]; delete db.sessions[token];
            const sockets = sessionConnections.get(token);
            if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
            sessionConnections.delete(token);
          }
        }
        save();
        return reply(200, { ok: true, ip: targetIp, blocked: action === 'block_ip' });
      }
      if (action === 'block_email' || action === 'unblock_email') {
        const email = String(body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'bad_email');
        db.securityBlockedEmails ||= [];
        db.securityBlockedEmails = action === 'block_email' ? [...new Set([...db.securityBlockedEmails, email])] : db.securityBlockedEmails.filter((v) => v !== email);
        if (action === 'block_email') {
          const target = findByEmail(email);
          if (target) { target.securitySuspended = true; target.securitySuspensionReason = String(body.reason || 'Email заблокирован Security').slice(0, 300); target.securitySuspendedAt = now; revokeUserSessions(target.id); recordSecurityEvent(target.id, { type: 'email_blocked', reason: target.securitySuspensionReason, actorId: actor.id, permanent: true }); }
        }
        save();
        return reply(200, { ok: true, email, blocked: action === 'block_email' });
      }
      if (action === 'block_device' || action === 'unblock_device') {
        const deviceId = String(body.deviceId || '').trim();
        if (deviceId.length < 16 || deviceId.length > 200) return fail(400, 'bad_device_id');
        const deviceHash = securityDeviceHash(deviceId);
        db.securityBlockedDevices ||= [];
        db.securityBlockedDevices = action === 'block_device' ? [...new Set([...db.securityBlockedDevices, deviceHash])] : db.securityBlockedDevices.filter((v) => v !== deviceHash);
        if (action === 'block_device') {
          for (const [token, meta] of Object.entries(db.sessions)) {
            if (meta.deviceIdHash !== deviceHash) continue;
            delete db.tokens[token]; delete db.sessions[token];
            const sockets = sessionConnections.get(token);
            if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
            sessionConnections.delete(token);
          }
        }
        save();
        return reply(200, { ok: true, deviceBlocked: action === 'block_device' });
      }
      return fail(400, 'bad_action');
    }

    if (url.pathname === '/api/security/admin/overview') {
      const actor = userFromToken(body.token);
      if (!actor || !securityAdminIds.has(Number(actor.id))) return fail(403, 'security_admin_required');
      const accounts = Object.values(db.users).map((u) => ({
        id: u.id, email: u.email, name: u.name, username: u.username,
        suspended: Boolean(u.securitySuspended), suspensionReason: u.securitySuspensionReason || null,
        securityReviewStartedAt: u.securityReviewStartedAt || null,
        securityReviewUntil: u.securityReviewUntil || null,
        securityReviewSignals: u.securityReviewSignals || [],
        securityReviewReason: u.securityReviewReason || null,
        recentSecurityEvents: securityEventsFor(u.id).slice(0, 20),
        recentSessions: Object.entries(db.sessions).filter(([, meta]) => meta.userId === u.id).map(([token, meta]) => ({
          id: token.slice(0, 12), device: meta.device || 'Unknown device', createdAt: meta.createdAt || 0,
          ip: meta.ip || null, deviceId: meta.deviceId || null, deviceInfo: meta.deviceInfo || null, userAgent: meta.userAgent || null
        })).slice(0, 20)
      }));
      return reply(200, { ok: true, accounts, blockedIps: db.securityBlockedIps || [], blockedEmails: db.securityBlockedEmails || [], blockedDeviceCount: (db.securityBlockedDevices || []).length });
    }

    if (url.pathname === '/api/register') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim().slice(0, 64);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'bad_email');
      if ((db.securityBlockedEmails || []).includes(email)) return fail(403, 'security_email_blocked');
      if (isSecurityIpBlocked(ip)) return fail(403, 'security_ip_blocked');
      const deviceProofResult = verifyDeviceProof(body, email);
      if (deviceProofResult.invalid) return fail(403, 'device_proof_invalid');
      const deviceId = deviceProofResult.deviceId;
      if (deviceId && (db.securityBlockedDevices || []).includes(securityDeviceHash(deviceId))) return fail(403, 'security_device_blocked');
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
        createdAt: Date.now(), lastActiveAt: Date.now(), deleteAfterMonths: null,
        securityLoginIpHistory: [{ ip, at: Date.now() }],
        securityKnownDeviceHashes: deviceId ? [securityDeviceHash(deviceId)] : []
      };
      db.users[id] = user;
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = id;
      db.sessions[token] = { userId: id, createdAt: Date.now(), device: String(body.device || 'Web browser').slice(0, 120), ip, deviceId: deviceId || null, deviceIdHash: deviceId ? securityDeviceHash(deviceId) : null, deviceInfo: sanitizeDeviceInfo(body.deviceInfo), userAgent: String(req.headers['user-agent'] || '').slice(0, 200) };
      save();
      broadcast({ type: 'user_upsert', user: publicUser(user) });
      return reply(200, { ok: true, user: selfUser(user, token) });
    }

    if (url.pathname === '/api/login') {
      const email = String(body.email || '').trim().toLowerCase();
      if (isSecurityIpBlocked(ip)) return fail(403, 'security_ip_blocked');
      if ((db.securityBlockedEmails || []).includes(email)) return fail(403, 'security_email_blocked');
      const deviceProofResult = verifyDeviceProof(body, email);
      if (deviceProofResult.invalid) return fail(403, 'device_proof_invalid');
      const deviceId = deviceProofResult.deviceId;
      if (deviceId && (db.securityBlockedDevices || []).includes(securityDeviceHash(deviceId))) return fail(403, 'security_device_blocked');
      const user = findByEmail(email);
      if (!user || !checkPassword(user, String(body.password || ''))) {
        const locked = recordLoginFailure(email, ip);
        return locked ? fail(429, 'security_temporarily_locked') : fail(401, 'bad_credentials');
      }
      if (user.securitySuspended && Number(user.securitySuspendedUntil || 0) > 0 && Date.now() >= Number(user.securitySuspendedUntil)) {
        delete user.securitySuspended;
        delete user.securitySuspensionReason;
        delete user.securitySuspendedAt;
        delete user.securitySuspendedUntil;
        delete user.securityReviewStartedAt;
        delete user.securityReviewUntil;
        delete user.securityReviewSignals;
        delete user.securityReviewReason;
        user.securityReviewReleasedAt = Date.now();
        recordSecurityEvent(user.id, { type: 'account_freeze_expired', reason: 'Временная заморозка на 24 часа завершена' });
        save();
      }
      if (user.securitySuspended) return fail(403, 'account_suspended');
      clearLoginFailures(email, ip);
      const ua = String(req.headers['user-agent'] || '').slice(0, 200);
      const priorSessions = Object.values(db.sessions).filter((meta) => meta.userId === user.id);
      const deviceHash = deviceId ? securityDeviceHash(deviceId) : null;
      const knownIps = (user.securityLoginIpHistory || []).filter((entry) => Date.now() - Number(entry.at || 0) < 7 * 24 * 60 * 60_000);
      const newIp = knownIps.length > 0 && !knownIps.some((entry) => entry.ip === ip);
      const newDevice = Boolean(deviceHash && (priorSessions.length || knownIps.length) &&
        !priorSessions.some((meta) => meta.deviceIdHash === deviceHash) &&
        !(user.securityKnownDeviceHashes || []).includes(deviceHash));
      if (newIp) recordSecurityEvent(user.id, { type: 'login_new_ip', reason: 'Вход с нового IP-адреса; требуется оценка риска', ip, risk: 'review' });
      if (newDevice) recordSecurityEvent(user.id, { type: 'login_new_device', reason: 'Вход с нового идентификатора устройства', ip, deviceId: deviceHash, risk: 'review' });
      user.securityLoginIpHistory = knownIps;
      if (!knownIps.some((entry) => entry.ip === ip)) user.securityLoginIpHistory.push({ ip, at: Date.now() });
      user.securityLoginIpHistory = user.securityLoginIpHistory.slice(-30);
      if (deviceHash && !(user.securityKnownDeviceHashes || []).includes(deviceHash)) {
        user.securityKnownDeviceHashes = [...(user.securityKnownDeviceHashes || []), deviceHash].slice(-20);
      }
      const ips24h = new Set(user.securityLoginIpHistory.filter((entry) => Date.now() - Number(entry.at || 0) < 24 * 60 * 60_000).map((entry) => entry.ip)).size;
      // IP alone can change on mobile/VPN. Start a 24-hour review only when several signals combine.
      const riskSignals = [newIp ? 'new_ip' : null, newDevice ? 'new_device' : null, ips24h >= 3 ? 'multiple_ips_24h' : null].filter(Boolean);
      const recentlyReleased = Date.now() - Number(user.securityReviewReleasedAt || 0) < 24 * 60 * 60_000;
      const highRiskLogin = !recentlyReleased && ((newIp && newDevice) || ips24h >= 3);
      if (highRiskLogin) {
        const now = Date.now();
        if (!user.securityReviewUntil) {
          user.securityReviewStartedAt = now;
          user.securityReviewUntil = now + 24 * 60 * 60_000;
          user.securityReviewSignals = riskSignals;
          user.securityReviewReason = 'Подозрение на взлом или продажу аккаунта — временная заморозка на 24 часа для проверки';
          user.securitySuspended = true;
          user.securitySuspensionReason = user.securityReviewReason;
          user.securitySuspendedAt = now;
          user.securitySuspendedUntil = user.securityReviewUntil;
          revokeUserSessions(user.id);
          recordSecurityEvent(user.id, { type: 'account_frozen_for_review', reason: user.securityReviewReason, ip, riskSignals, reviewUntil: user.securityReviewUntil });
          notifySecurityReviewStaff(user, {
            reason: user.securityReviewReason,
            signals: riskSignals,
            startedAt: user.securityReviewStartedAt,
            until: user.securityReviewUntil
          });
          save();
          return fail(403, 'security_review_pending');
        }
        if (now >= Number(user.securityReviewUntil)) {
          user.securitySuspended = true;
          user.securitySuspensionReason = 'Аккаунт заморожен после 24 часов: подозрение на взлом или продажу не подтверждено как безопасное';
          user.securitySuspendedAt = now;
          revokeUserSessions(user.id);
          recordSecurityEvent(user.id, { type: 'account_auto_frozen', reason: user.securitySuspensionReason, ip, permanent: true, riskSignals: [...new Set([...(user.securityReviewSignals || []), ...riskSignals])] });
          save();
          return fail(403, 'account_suspended_security_review');
        }
        recordSecurityEvent(user.id, { type: 'account_security_review_repeat_signal', reason: 'Повторный подозрительный вход во время проверки', ip, riskSignals, reviewUntil: user.securityReviewUntil });
        save();
        return fail(403, 'security_review_pending');
      }
      if (user.cloudPasswordHash && user.cloudPasswordSalt) {
        const challenge = crypto.randomBytes(32).toString('hex');
        twoFactorChallenges.set(challenge, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });
        return reply(200, { ok: true, requiresTwoFactor: true, challenge });
      }
      user.lastActiveAt = Date.now();
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = user.id;
      db.sessions[token] = { userId: user.id, createdAt: Date.now(), device: String(body.device || 'Web browser').slice(0, 120), ip, deviceId: deviceId || null, deviceIdHash: deviceId ? securityDeviceHash(deviceId) : null, deviceInfo: sanitizeDeviceInfo(body.deviceInfo), userAgent: ua };
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
      if (user.securitySuspended) return fail(403, 'account_suspended');
      const deviceId = String(body.deviceId || '');
      if (deviceId && (db.securityBlockedDevices || []).includes(securityDeviceHash(deviceId))) return fail(403, 'security_device_blocked');
      user.lastActiveAt = Date.now();
      const token = crypto.randomBytes(32).toString('hex');
      db.tokens[token] = user.id;
      db.sessions[token] = { userId: user.id, createdAt: Date.now(), device: String(body.device || 'Web browser').slice(0, 120), ip, deviceId: deviceId || null, deviceIdHash: deviceId ? securityDeviceHash(deviceId) : null, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) };
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
      const currentPassword = String(body.currentPassword || '');
      const pw = String(body.newPassword || '');
      if (!checkPassword(user, currentPassword)) return fail(401, 'bad_current_password');
      if (pw.length < 7 || pw.length > 256) return fail(400, pw.length < 7 ? 'short_password' : 'password_too_long');
      Object.assign(user, hashPassword(pw));
      // Revoke every other session; keep the password-confirmed current session active.
      for (const [t, id] of Object.entries(db.tokens)) {
        if (id !== user.id || t === body.token) continue;
        delete db.tokens[t]; delete db.sessions[t];
        const sockets = sessionConnections.get(t);
        if (sockets) for (const conn of [...sockets]) { try { conn.send({ type: 'auth_error' }); conn.close(4001); } catch {} }
        sessionConnections.delete(t);
      }
      save();
      return reply(200, { ok: true });
    }

    return fail(404, 'not_found');
  } catch (e) {
    return fail(400, e.message || 'bad_request');
  }
});

// ───────────────────────── WebSocket ─────────────────────────
function canAccessChat(userId, chatId) {
  const channel = db.channels[chatId];
  if (channel) {
    return channel.isPublic !== false || channel.ownerId === userId ||
      (channel.admins || []).some((a) => Number(a.id) === Number(userId)) ||
      (db.members[chatId] || []).includes(userId);
  }
  const group = db.groups[chatId];
  if (group) {
    return group.isPublic !== false || group.ownerId === userId ||
      (db.members[chatId] || []).includes(userId);
  }
  return false;
}

function joinChats(userId, chatIds) {
  let changed = false;
  for (const rawId of chatIds) {
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || !canAccessChat(userId, id)) continue;
    const list = (db.members[id] ||= []);
    if (!list.includes(userId)) { list.push(userId); changed = true; }
  }
  if (changed) save();
}

function handleSend(user, conn, payload) {
  const now = Date.now();
  user.lastActiveAt = now;
  const isNewMessage = Boolean(payload?.message && !payload.action);
  let window = spamWindows.get(user.id) || [];
  if (isNewMessage) {
    window = window.filter((t) => now - t < SPAM_WINDOW_MS);
    window.push(now);
    spamWindows.set(user.id, window);
    // 200+ send attempts inside the rolling window escalates to a permanent system mute,
    // including attempts made while a temporary mute is active.
    if (window.length >= 200 && !user.spamMutedPermanently) {
      applySpamMute(user, Infinity, '200+ сообщений за 19 минут');
    }
  }
  if (user.spamMutedPermanently || Number(user.spamMuteUntil || 0) > now) {
    conn.send({ type: 'send_result', id: payload?.id, ok: false, reason: 'spam_muted', until: user.spamMutedPermanently ? null : user.spamMuteUntil, permanent: Boolean(user.spamMutedPermanently) });
    return;
  }
  if (user.spamMuteUntil && Number(user.spamMuteUntil) <= now) { delete user.spamMuteUntil; delete user.spamMutedPermanently; }
  if (isNewMessage && window.length >= 100) {
    const previousStrike = securityEventsFor(user.id).some((event) => event.type === 'spam_mute');
    if (previousStrike) {
      applySpamMute(user, Infinity, 'Повторный массовый спам после предыдущего наказания');
      conn.send({ type: 'send_result', id: payload?.id, ok: false, reason: 'spam_muted', permanent: true });
    } else {
      applySpamMute(user, SPAM_MUTE_MS, '100+ сообщений за 19 минут');
      conn.send({ type: 'send_result', id: payload?.id, ok: false, reason: 'spam_muted', until: user.spamMuteUntil, permanent: false });
    }
    return;
  }
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
  const messageKey = (messageId, directPeerId) => chatType === 'direct'
    ? `direct:${[Number(user.id), Number(directPeerId)].sort((a, b) => a - b).join(':')}:${String(messageId)}`
    : `${chatType}:${String(payload.chatId)}:${String(messageId)}`;

  if (chatType === 'direct') {
    const target =
      (payload.toUserId && db.users[payload.toUserId]) ||
      (payload.toUsername && findByUsername(payload.toUsername));
    if (!target) return no('no_user');
    if (target.id === user.id) return no('self');
    if ((db.blocks[target.id] || []).some((b) => b.id === user.id)) return no('blocked');
    if (action && db.messageAuthors[messageKey(payload.targetId, target.id)] !== user.id) return no('not_message_author');
    if (!action && payload.message.id !== undefined && payload.message.id !== null) {
      const key = messageKey(payload.message.id, target.id);
      if (Object.hasOwn(db.messageAuthors, key) && db.messageAuthors[key] !== user.id) return no('duplicate_message_id');
      db.messageAuthors[key] = user.id;
    }
    enqueue(target.id, { ...out, toUserId: target.id, toUsername: target.username });
    return ok();
  }

  // Group/channel sends must target a real chat and pass server-side membership/role checks.
  const registry = chatType === 'channel' ? db.channels[out.chatId] : db.groups[out.chatId];
  if (!registry) return no('chat_not_found');
  if (chatType === 'channel') {
    const isStaff = registry.ownerId === user.id || (registry.admins || []).some((a) => Number(a.id) === Number(user.id));
    if (!isStaff) return no('forbidden');
  } else if (registry.ownerId !== user.id && !(db.members[out.chatId] || []).includes(user.id)) {
    return no('not_a_member');
  }
  if (action && db.messageAuthors[messageKey(payload.targetId)] !== user.id) return no('not_message_author');
  if (!action && payload.message.id !== undefined && payload.message.id !== null) {
    const key = messageKey(payload.message.id);
    if (Object.hasOwn(db.messageAuthors, key) && db.messageAuthors[key] !== user.id) return no('duplicate_message_id');
    db.messageAuthors[key] = user.id;
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
  user.lastActiveAt = Date.now();
  if (wasOffline) broadcast({ type: 'presence', userId: user.id, online: true, lastSeenAt: user.lastSeenAt || null }, conn);

  conn.send({
    type: 'snapshot',
    me: selfUser(user, url.searchParams.get('token')),
    users: Object.values(db.users).map(publicUser),
    channels: Object.values(db.channels).filter((chat) => canAccessChat(user.id, chat.id)),
    groups: Object.values(db.groups).filter((chat) => canAccessChat(user.id, chat.id)),
    blocks: db.blocks[user.id] || [],
    blockedBy: blockedByList(user.id),
    videoChats: Object.fromEntries([...activeVideo].filter(([chatId]) => {
      const group = db.groups[chatId];
      return Boolean(group && (group.ownerId === user.id || (db.members[chatId] || []).includes(user.id)));
    }))
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
      user.lastActiveAt = Date.now();
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
          const nextUsername = normUsername(p.username);
          if (!USERNAME_RE.test(nextUsername)) {
            conn.send({ type: 'profile_result', ok: false, error: 'bad_username' });
            break;
          }
          const other = findByUsername(nextUsername);
          if (other && other.id !== user.id) conn.send({ type: 'profile_result', ok: false, error: 'username_taken' });
          else user.username = nextUsername;
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
        const channelEvent = { type: 'channel_upsert', channel: db.channels[ch.id] };
        for (const [recipientId, connections] of online) {
          if (!canAccessChat(recipientId, ch.id)) continue;
          for (const recipientConn of connections) recipientConn.send(channelEvent);
        }
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
        const groupEvent = { type: 'group_upsert', group: db.groups[g.id] };
        for (const [recipientId, connections] of online) {
          if (!canAccessChat(recipientId, g.id)) continue;
          for (const recipientConn of connections) recipientConn.send(groupEvent);
        }
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
        const chatId = Number(msg.chatId);
        const info = msg.info;
        if (!Number.isSafeInteger(chatId)) break;
        const group = db.groups[chatId];
        // Video-call state is only valid for a real group and an actual member.
        if (!group || (group.ownerId !== user.id && !(db.members[chatId] || []).includes(user.id))) break;
        const current = activeVideo.get(chatId);
        if (info && info.isActive === true) {
          // Only the call starter or group owner can replace an existing call's state.
          if (current && current.startedBy !== user.id && group.ownerId !== user.id) break;
          const safeInfo = {
            isActive: true,
            startedBy: current?.startedBy ?? user.id,
            startedAt: Number(current?.startedAt || Date.now()),
            ...(typeof info.roomId === 'string' ? { roomId: info.roomId.slice(0, 120) } : {}),
            ...(typeof info.mode === 'string' ? { mode: info.mode.slice(0, 32) } : {})
          };
          activeVideo.set(chatId, safeInfo);
        } else {
          if (current && current.startedBy !== user.id && group.ownerId !== user.id) break;
          activeVideo.delete(chatId);
        }
        const safeInfo = activeVideo.get(chatId) || null;
        const targets = new Set([...(db.members[chatId] || []), group.ownerId, user.id]);
        for (const id of targets) sendToUser(id, { type: 'video_chat', chatId, info: safeInfo }, conn);
        break;
      }

      case 'ping':
        // A live client heartbeat counts as activity; otherwise an open, idle session
        // could be deleted by the inactivity policy while the user is still online.
        user.lastActiveAt = Date.now();
        conn.send({ type: 'pong' });
        save();
        break;
    }
  };
});

// Freeze unresolved high-risk accounts after the 24-hour review window.
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const user of Object.values(db.users)) {
    if (!user.securitySuspended && user.securityReviewUntil && now >= Number(user.securityReviewUntil)) {
      user.securitySuspended = true;
      user.securitySuspensionReason = 'ПП/подозрение на взлом или продажу аккаунта — проверка не завершена за 24 часа';
      user.securitySuspendedAt = now;
      revokeUserSessions(user.id);
      recordSecurityEvent(user.id, { type: 'account_auto_frozen', reason: user.securitySuspensionReason, permanent: true, riskSignals: user.securityReviewSignals || [] });
      changed = true;
    }
  }
  if (changed) save();
}, 60_000).unref();

server.listen(PORT, () => console.log(`Tege server on :${PORT}  (data: ${DATA_DIR})`));
