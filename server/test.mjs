// End-to-end test: spawns the server and drives it with two real WebSocket clients.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 3900 + Math.floor(Math.random() * 90);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tege-test-'));
const srv = spawn('node', [new URL('./index.mjs', import.meta.url).pathname], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, TEGE_VOLUNTEER_USER_IDS: '1122103', TEGE_SENIOR_VOLUNTEER_USER_IDS: '1122105', TEGE_HEAD_VOLUNTEER_USER_IDS: '1122102', TEGE_VERIFIED_USER_IDS: '1122101', TEGE_SECURITY_ADMIN_USER_IDS: '1122101' }, stdio: 'inherit'
});
const base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, body, testIp) => (await fetch(base + p, { method: 'POST', headers: testIp ? { 'x-forwarded-for': testIp } : {}, body: JSON.stringify(body) })).json();
const reportPost = (p, body) => post(p, body, '203.0.113.42');

class Client {
  constructor(token) {
    this.inbox = []; this.events = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${token}`);
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      this.events.push(m);
      if (m.type === 'message') this.inbox.push(m.payload);
    };
    this.ready = new Promise((r) => (this.ws.onopen = r));
    this.closed = new Promise((r) => (this.ws.onclose = r));
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async waitFor(pred, ms = 2000) {
    const t = Date.now();
    while (Date.now() - t < ms) { const f = this.events.find(pred); if (f) return f; await sleep(20); }
    throw new Error('timeout waiting for event');
  }
}

let failed = false;
try {
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/health'); break; } catch { await sleep(100); } }

  const a = (await post('/api/register', { email: 'alice@x.io', password: 'password1', name: 'Alice', username: '@alice' })).user;
  const b = (await post('/api/register', { email: 'bob@x.io', password: 'password2', name: 'Bob', username: 'bob' })).user;
  assert.equal(a.id, 1122101); assert.equal(b.id, 1122102); assert.equal(b.username, '@bob');
  assert.equal(a.verified, true, 'verified status must come from the server ID allowlist');
  assert.equal(b.role, 'head_volunteer', 'head volunteer role must come from the server ID allowlist');
  const serverAccount = await post('/api/account/me', { token: a.token, role: 'head_volunteer', verified: true });
  assert.equal(serverAccount.ok, true);
  assert.equal(serverAccount.user.role, 'user');
  assert.equal(serverAccount.user.verified, true);
  assert.equal((await post('/api/account/me', { token: 'forged-token' })).error, 'bad_token');
  const adminOverview = await post('/api/security/admin/overview', { token: a.token }, '203.0.113.100');
  assert.equal(adminOverview.ok, true, 'configured security admin can review account risk');
  const frozen = await post('/api/security/admin/action', { token: a.token, action: 'freeze_account', targetUserId: b.id, reason: 'test security freeze' }, '203.0.113.101');
  assert.equal(frozen.ok, true);
  assert.equal(frozen.suspended, true);
  assert.equal((await post('/api/account/me', { token: b.token }, '203.0.113.102')).error, 'bad_token', 'frozen account sessions must stop working');
  assert.equal((await post('/api/login', { email: 'bob@x.io', password: 'password2' }, '203.0.113.103')).error, 'account_suspended');
  assert.equal((await post('/api/security/admin/action', { token: a.token, action: 'unfreeze_account', targetUserId: b.id }, '203.0.113.104')).suspended, false);
  const bRestored = await post('/api/login', { email: 'bob@x.io', password: 'password2' }, '203.0.113.105');
  assert.equal(bRestored.ok, true, 'unfrozen account can authenticate again');
  b.token = bRestored.user.token; // freezing revoked the original bearer token
  const ipBlock = await post('/api/security/admin/action', { token: a.token, action: 'block_ip', ip: '198.51.100.90' }, '203.0.113.106');
  assert.equal(ipBlock.blocked, true);
  assert.equal((await post('/api/login', { email: 'alice@x.io', password: 'password1' }, '198.51.100.90')).error, 'security_ip_blocked');
  assert.equal((await post('/api/security/admin/action', { token: a.token, action: 'unblock_ip', ip: '198.51.100.90' }, '203.0.113.107')).blocked, false);
  const emailBlock = await post('/api/security/admin/action', { token: a.token, action: 'block_email', email: 'blocked@x.io', reason: 'test email block' }, '203.0.113.108');
  assert.equal(emailBlock.blocked, true);
  assert.equal((await post('/api/register', { email: 'blocked@x.io', password: 'password7', name: 'Blocked' }, '203.0.113.109')).error, 'security_email_blocked');
  const deviceId = 'test-device-id-12345678901234567890';
  assert.equal((await post('/api/security/admin/action', { token: a.token, action: 'block_device', deviceId }, '203.0.113.110')).deviceBlocked, true);
  assert.equal((await post('/api/register', { email: 'device@x.io', password: 'password8', name: 'Device', deviceId }, '203.0.113.111')).error, 'security_device_blocked');

  assert.equal((await post('/api/register', { email: 'ALICE@x.io', password: 'password1', name: 'x' })).error, 'email_taken');
  assert.equal((await post('/api/register', { email: 'c@x.io', password: 'password1', name: 'x', username: '@Alice' })).error, 'username_taken');
  assert.equal((await post('/api/username', { username: 'ALICE' })).available, false);
  assert.equal((await post('/api/username', { username: '@free_name' })).available, true);
  assert.equal((await post('/api/username', { username: 'a' })).reason, 'invalid');
  assert.equal((await post('/api/register', { email: 'd@x.io', password: 'password1', name: 'x', username: '@a b' })).error, 'bad_username');
  assert.equal((await post('/api/login', { email: 'alice@x.io', password: 'nope' })).error, 'bad_credentials');
  const a2 = (await post('/api/login', { email: 'alice@x.io', password: 'password1' })).user;
  assert.equal(a2.id, a.id);
  const sessionsA = await post('/api/sessions', { token: a.token });
  assert.equal(sessionsA.ok, true);
  assert.equal(sessionsA.sessions.length, 2);
  assert.equal(sessionsA.sessions.filter((s) => s.current).length, 1);
  assert.ok(sessionsA.sessions.every((s) => s.device));
  assert.equal((await post('/api/sessions/revoke', { token: a.token, sessionToken: a2.token })).ok, true);
  assert.equal((await post('/api/sessions', { token: a2.token })).error, 'bad_token');
  const a3 = (await post('/api/login', { email: 'alice@x.io', password: 'password1' })).user;
  assert.equal((await post('/api/sessions/revoke-others', { token: a.token })).ok, true);
  assert.equal((await post('/api/sessions', { token: a3.token })).error, 'bad_token');

  // Inactivity auto-delete preferences are server-side and support custom periods.
  const inactivity = await post('/api/account/inactivity/status', { token: a.token });
  assert.equal(inactivity.ok, true);
  assert.equal(inactivity.months, null, 'default must be Never');
  const chosenPeriod = await post('/api/account/inactivity', { token: a.token, months: 8 });
  assert.equal(chosenPeriod.ok, true);
  assert.equal(chosenPeriod.months, 8);
  assert.ok(chosenPeriod.deletionAt > chosenPeriod.lastActiveAt);
  assert.equal((await post('/api/account/inactivity', { token: a.token, months: 7 })).error, 'bad_inactivity_period');
  const neverAgain = await post('/api/account/inactivity', { token: a.token, months: null });
  assert.equal(neverAgain.ok, true);
  assert.equal(neverAgain.deletionAt, null);
  const security = await post('/api/security/events', { token: a.token });
  assert.equal(security.ok, true);
  assert.equal(security.bot.name, 'Security');
  console.log('✓ server inactivity settings and Security history API');

  console.log('✓ register / login / active session revoke');

  // bad token
  const bad = new Client('deadbeef'); await bad.closed; console.log('✓ bad token rejected');

  // Alice online, Bob OFFLINE -> message must be queued
  const ca = new Client(a.token); await ca.ready;
  const snap = await ca.waitFor((m) => m.type === 'snapshot');
  assert.equal(snap.users.length, 2);
  assert.equal(snap.users.find((u) => u.id === b.id).online, false);
  ca.send({ type: 'send', payload: { id: 1, chatId: b.id, chatType: 'direct', toUserId: b.id, fromUser: { id: 999, name: 'FAKE' }, message: { id: 1, text: 'hi bob (offline)', time: '12:00', isMine: true } } });
  const r1 = await ca.waitFor((m) => m.type === 'send_result' && m.id === 1);
  assert.equal(r1.ok, true);

  const cb = new Client(b.token); await cb.ready;
  await cb.waitFor((m) => m.type === 'message');
  const got = cb.inbox[0];
  assert.equal(got.message.text, 'hi bob (offline)');
  assert.equal(got.fromUser.id, a.id, 'sender id must come from token, not payload');
  assert.equal(got.fromUser.name, 'Alice');
  await ca.waitFor((m) => m.type === 'presence' && m.userId === b.id && m.online);
  console.log('✓ offline message delivered on login, sender spoof ignored, presence pushed');

  // not acked -> redelivered on reconnect; acked -> gone
  cb.ws.close(); await cb.closed; await sleep(100);
  const cb2 = new Client(b.token); await cb2.ready;
  await cb2.waitFor((m) => m.type === 'message');
  cb2.send({ type: 'ack', ids: [cb2.inbox[0].deliveryId] }); await sleep(100);
  cb2.ws.close(); await cb2.closed; await sleep(100);
  const cb3 = new Client(b.token); await cb3.ready; await cb3.waitFor((m) => m.type === 'snapshot'); await sleep(200);
  assert.equal(cb3.inbox.length, 0);
  console.log('✓ un-acked redelivered, acked removed');

  // live delivery
  ca.send({ type: 'send', payload: { id: 2, chatId: b.id, chatType: 'direct', toUserId: b.id, message: { id: 2, text: 'live!', time: '12:01' } } });
  await cb3.waitFor((m) => m.type === 'message' && m.payload.message.text === 'live!');
  cb3.send({ type: 'send', payload: { id: 3, chatId: a.id, chatType: 'direct', toUsername: '@alice', message: { id: 3, text: 'reply by username', time: '12:02' } } });
  await ca.waitFor((m) => m.type === 'message' && m.payload.message.text === 'reply by username');
  console.log('✓ live delivery both ways (by id and by @username)');

  // block
  cb3.send({ type: 'block', user: { id: a.id, name: 'Alice', username: '@alice' } });
  await ca.waitFor((m) => m.type === 'blocked_by' && m.ids.includes(b.id));
  ca.send({ type: 'send', payload: { id: 4, chatId: b.id, chatType: 'direct', toUserId: b.id, message: { id: 4, text: 'blocked?', time: '12:03' } } });
  const r4 = await ca.waitFor((m) => m.type === 'send_result' && m.id === 4);
  assert.equal(r4.reason, 'blocked');
  cb3.send({ type: 'unblock', userId: a.id });
  await ca.waitFor((m) => m.type === 'blocked_by' && !m.ids.includes(b.id));
  console.log('✓ block / unblock enforced server-side');

  // group fan-out
  const G = 1122000777;
  ca.send({ type: 'register_group', group: { id: G, type: 'group', name: 'Team', ownerId: a.id, messages: [{ id: 1 }] } });
  ca.send({ type: 'join_chats', chatIds: [G] }); cb3.send({ type: 'join_chats', chatIds: [G] }); await sleep(150);
  ca.send({ type: 'send', payload: { id: 5, chatId: G, chatType: 'group', channelOrGroupName: 'Team', message: { id: 5, text: 'hello team', time: '12:04' } } });
  const gm = await cb3.waitFor((m) => m.type === 'message' && m.payload.message.text === 'hello team');
  assert.equal(gm.payload.chatId, G);
  assert.ok(!ca.inbox.some((p) => p.message.text === 'hello team'), 'sender must not receive own group msg');
  console.log('✓ group fan-out to members only');

  // channel: only owner may post
  const C = 1122000888;
  ca.send({ type: 'register_channel', channel: { id: C, name: 'News', ownerId: a.id, isPublic: true } });
  ca.send({ type: 'join_chats', chatIds: [G, C] }); cb3.send({ type: 'join_chats', chatIds: [G, C] }); await sleep(150);
  cb3.send({ type: 'send', payload: { id: 6, chatId: C, chatType: 'channel', message: { id: 6, text: 'spam', time: '12:05' } } });
  assert.equal((await cb3.waitFor((m) => m.type === 'send_result' && m.id === 6)).reason, 'forbidden');
  ca.send({ type: 'send', payload: { id: 7, chatId: C, chatType: 'channel', fromUser: { name: 'News' }, message: { id: 7, text: 'breaking', time: '12:06' } } });
  await cb3.waitFor((m) => m.type === 'message' && m.payload.message.text === 'breaking');
  console.log('✓ channel posting restricted to owner/admins');

  // Channel comments are persisted server-side and scoped to an individual post.
  const addedComment = await post('/api/channels/comments/add', { token: b.token, channelId: C, postId: 7, text: 'Great update!' });
  assert.equal(addedComment.ok, true);
  assert.equal(addedComment.comment.authorId, b.id);
  assert.equal(addedComment.comment.text, 'Great update!');
  const listedComments = await post('/api/channels/comments/list', { token: a.token, channelId: C, postId: 7 });
  assert.equal(listedComments.ok, true);
  assert.equal(listedComments.comments.length, 1);
  assert.equal(listedComments.comments[0].id, addedComment.comment.id);
  assert.equal((await post('/api/channels/comments/add', { token: b.token, channelId: C, postId: 7, text: '   ' })).error, 'bad_comment');
  console.log('✓ channel comments persist and load per post');


  // delete / edit of an already sent message is relayed (author comes from the token, push stays silent)
  ca.send({ type: 'send', payload: { id: 8, chatId: b.id, chatType: 'direct', toUserId: b.id, message: { id: 8001, text: 'to edit', time: '12:07' } } });
  await cb3.waitFor((m) => m.type === 'message' && m.payload.message.id === 8001);
  ca.send({ type: 'send', payload: { id: 9, chatId: b.id, chatType: 'direct', toUserId: b.id, action: 'edit', targetId: 8001, message: { id: 8001, text: 'edited text', time: '' } } });
  const ed = await cb3.waitFor((m) => m.type === 'message' && m.payload.action === 'edit');
  assert.equal(ed.payload.targetId, 8001); assert.equal(ed.payload.message.text, 'edited text'); assert.equal(ed.payload.fromUser.id, a.id);
  ca.send({ type: 'send', payload: { id: 10, chatId: b.id, chatType: 'direct', toUserId: b.id, action: 'delete', targetId: 8001, fromUser: { id: 999 }, message: { id: 8001, text: '', time: '' } } });
  const del = await cb3.waitFor((m) => m.type === 'message' && m.payload.action === 'delete');
  assert.equal(del.payload.targetId, 8001); assert.equal(del.payload.fromUser.id, a.id, 'author must come from token');
  ca.send({ type: 'send', payload: { id: 11, chatId: b.id, chatType: 'direct', toUserId: b.id, action: 'delete', targetId: 'abc', message: { id: 1 } } });
  assert.equal((await ca.waitFor((m) => m.type === 'send_result' && m.id === 11)).ok, false);
  console.log('✓ delete / edit relayed to the other side, bad action rejected');

  // presence off + profile
  ca.send({ type: 'profile', user: { name: 'Alice A.', bio: 'new bio' } });
  const up = await cb3.waitFor((m) => m.type === 'user_upsert' && m.user.id === a.id && m.user.name === 'Alice A.');
  assert.equal(up.user.bio, 'new bio');
  ca.ws.close();
  await cb3.waitFor((m) => m.type === 'presence' && m.userId === a.id && m.online === false);
  console.log('✓ profile update broadcast, offline presence');

  // Volunteer assignment uses a private numeric-ID server allowlist; public directory profiles never expose email.
  const volunteer = (await post('/api/register', { email: 'volunteer@x.io', password: 'password4', name: 'Volunteer', username: '@volunteer' })).user;
  assert.equal(volunteer.role, 'volunteer');
  const cv = new Client(volunteer.token); await cv.ready;
  const volunteerSnapshot = await cv.waitFor((m) => m.type === 'snapshot');
  const publicVolunteer = volunteerSnapshot.users.find((u) => u.id === volunteer.id);
  assert.equal(publicVolunteer.role, 'volunteer');
  assert.equal(publicVolunteer.verified, false);
  assert.equal(Object.hasOwn(publicVolunteer, 'email'), false, 'public directory must not expose email');
  cv.ws.close();
  console.log('✓ volunteer role is assigned privately and public email is hidden');

  // Server-side anti-spam: 100 message attempts inside the rolling window trigger a 3-day mute and a Security event.
  const spammer = (await post('/api/register', { email: 'spammer@x.io', password: 'password3', name: 'Spammer', username: '@spammer' })).user;
  const cs = new Client(spammer.token); await cs.ready; await cs.waitFor((m) => m.type === 'snapshot');
  for (let i = 1; i <= 100; i++) {
    cs.send({ type: 'send', payload: { id: 1000 + i, chatId: b.id, chatType: 'direct', toUserId: b.id, message: { id: 1000 + i, text: 'burst ' + i, time: '12:10' } } });
  }
  const spamResult = await cs.waitFor((m) => m.type === 'send_result' && m.id === 1100, 5000);
  assert.equal(spamResult.ok, false);
  assert.equal(spamResult.reason, 'spam_muted');
  const spamSecurity = await post('/api/security/events', { token: spammer.token });
  assert.equal(spamSecurity.ok, true);
  assert.ok(spamSecurity.activeMute && !spamSecurity.activeMute.permanent);
  assert.ok(spamSecurity.events.some((event) => event.type === 'spam_mute' && event.reason.includes('100+')));

  const ordinaryVolunteer = volunteer;
  const deniedUnmute = await post('/api/security/moderation/action', { token: ordinaryVolunteer.token, targetUserId: spammer.id, action: 'unmute' });
  assert.equal(deniedUnmute.error, 'senior_volunteer_required');
  const queue = await post('/api/security/moderation/list', { token: ordinaryVolunteer.token });
  assert.equal(queue.ok, true);
  assert.ok(queue.mutedUsers.some((u) => u.id === spammer.id));
  const senior = (await post('/api/register', { email: 'senior@x.io', password: 'password5', name: 'Senior', username: '@senior' })).user;
  assert.equal(senior.role, 'senior_volunteer');
  const spoofed = (await post('/api/register', { email: 'spoof@x.io', password: 'password6', name: 'Spoof', username: '@spoof', role: 'head_volunteer', verified: true }, '198.51.100.25')).user;
  assert.equal(spoofed.role, 'user', 'client-supplied role must be ignored');
  assert.equal(spoofed.verified, false, 'client-supplied verification must be ignored');

  const allowedUnmute = await post('/api/security/moderation/action', { token: senior.token, targetUserId: spammer.id, action: 'unmute' }, '198.51.100.26');
  assert.equal(allowedUnmute.ok, true);
  assert.equal((await post('/api/security/moderation/list', { token: senior.token }, '198.51.100.27')).mutedUsers.some((u) => u.id === spammer.id), false);
  console.log('✓ volunteer moderation queue and senior-only unmute enforcement');

  // Immediate account deletion verifies the password and invalidates the bearer token.
  // Keep these requests off the shared test IP: earlier spam-rate-limit coverage may exhaust its budget.
  assert.equal((await post('/api/account/delete', { token: spammer.token, password: 'wrong-password' }, '198.51.100.21')).error, 'bad_credentials');
  assert.equal((await post('/api/account/delete', { token: spammer.token, password: 'password3' }, '198.51.100.22')).ok, true);
  assert.equal((await post('/api/security/events', { token: spammer.token }, '198.51.100.23')).error, 'bad_token');
  cs.ws.close();
  console.log('✓ immediate account deletion and token revocation');

  // persistence across restart
  console.log('\nALL TESTS PASSED');
} catch (e) {
  failed = true;
  console.error('\nFAILED:', e);
} finally {
  srv.kill('SIGTERM');
  await sleep(300);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
