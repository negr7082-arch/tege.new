// End-to-end test: spawns the server and drives it with two real WebSocket clients.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 3900 + Math.floor(Math.random() * 90);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tege-test-'));
const srv = spawn('node', [new URL('./index.mjs', import.meta.url).pathname], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'inherit'
});
const base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, body) => (await fetch(base + p, { method: 'POST', body: JSON.stringify(body) })).json();

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

  const a = (await post('/api/register', { email: 'alice@x.io', password: 'password1', name: 'Alice', username: '@alice', phone: '+491234567', country: 'DE' })).user;
  const b = (await post('/api/register', { email: 'bob@x.io', password: 'password2', name: 'Bob', username: 'bob' })).user;
  assert.equal(a.id, 1122101); assert.equal(b.id, 1122102); assert.equal(b.username, '@bob');
  assert.equal((await post('/api/register', { email: 'ALICE@x.io', password: 'password1', name: 'x' })).error, 'email_taken');
  assert.equal((await post('/api/register', { email: 'c@x.io', password: 'password1', name: 'x', username: '@Alice' })).error, 'username_taken');
  assert.equal((await post('/api/username', { username: 'ALICE' })).available, false);
  assert.equal((await post('/api/username', { username: 'orig_manager_creator_tege.new' })).available, true);
  const owner = (await post('/api/register', { email: 'negr7082@gmail.com', password: 'password1', name: 'Tege Owner', username: '@orig_manager_creator_tege.new' })).user;
  assert.equal(owner.isVerified, true, 'owner account receives verified flag');
  assert.equal(owner.role, 'Главный волонтёр', 'owner account receives volunteer role');
  assert.equal((await post('/api/register', { email: 'c2@x.io', password: 'password1', name: 'x', username: '@orig_manager_creator_tege.new' })).error, 'username_taken');
  const impostor = (await post('/api/register', { email: 'impostor@x.io', password: 'password1', name: 'Impostor', username: '@another_owner' })).user;
  assert.equal(impostor.isVerified, false, 'ordinary account is not verified');
  assert.equal(impostor.role, undefined, 'ordinary account gets no staff role');
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
  console.log('✓ register / login / active session revoke');

  // bad token
  const bad = new Client('deadbeef'); await bad.closed; console.log('✓ bad token rejected');

  // Alice online, Bob OFFLINE -> message must be queued
  const ca = new Client(a.token); await ca.ready;
  const snap = await ca.waitFor((m) => m.type === 'snapshot');
  assert.equal(snap.users.length, 2);
  assert.equal(snap.users.find((u) => u.id === b.id).online, false);
  const publicAlice = snap.users.find((u) => u.id === a.id);
  assert.equal(publicAlice.email, undefined, 'email must not be public');
  assert.equal(publicAlice.phone, undefined, 'phone must not be public');
  assert.equal(publicAlice.country, undefined, 'country must not be public');
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
  ca.send({ type: 'send', payload: { id: 5, chatId: G, chatType: 'group', channelOrGroupName: 'Fake Team', fromUser: { name: 'FAKE ADMIN' }, message: { id: 5, text: 'hello team', time: '12:04', senderName: 'FAKE SENDER' } } });
  const gm = await cb3.waitFor((m) => m.type === 'message' && m.payload.message.text === 'hello team');
  assert.equal(gm.payload.chatId, G);
  assert.equal(gm.payload.fromUser.name, 'Alice', 'group sender identity must come from session');
  assert.equal(gm.payload.message.senderName, 'Alice', 'message senderName must not be spoofable');
  assert.equal(gm.payload.channelOrGroupName, 'Team', 'chat name must come from server registry');
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
  // A recipient must not be able to edit/delete the sender's message.
  cb3.send({ type: 'send', payload: { id: 12, chatId: a.id, chatType: 'direct', toUserId: a.id, action: 'edit', targetId: 8001, message: { id: 8001, text: 'hijacked', time: '' } } });
  assert.equal((await cb3.waitFor((m) => m.type === 'send_result' && m.id === 12)).reason, 'not_message_author');
  console.log('✓ delete / edit relayed to the other side, bad action rejected, foreign edits blocked');

  // presence off + profile
  ca.send({ type: 'profile', user: { name: 'Alice A.', bio: 'new bio' } });
  const up = await cb3.waitFor((m) => m.type === 'user_upsert' && m.user.id === a.id && m.user.name === 'Alice A.');
  assert.equal(up.user.bio, 'new bio');
  ca.ws.close();
  await cb3.waitFor((m) => m.type === 'presence' && m.userId === a.id && m.online === false);
  console.log('✓ profile update broadcast, offline presence');

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
