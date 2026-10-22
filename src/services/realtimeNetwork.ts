import { Message, UserAccount, ContactUser, Channel, Chat, BlockedUser, GroupVideoChatInfo, Comment } from '../types';

export interface NetworkMessagePayload {
  id: number;
  fromUser: {
    id: number;
    name: string;
    username: string;
    avatarUri?: string | null;
  };
  toUserId?: number;
  toUsername?: string;
  chatId: number;
  chatType: 'direct' | 'group' | 'channel';
  message: Message;
  channelOrGroupName?: string;
  /** delete/edit of an already sent message (message.id === targetId, only the author can do it) */
  action?: 'delete' | 'edit';
  targetId?: number;
  /** set by the server; used for ack + de-duplication */
  deliveryId?: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: UserAccount;
  requiresTwoFactor?: boolean;
  challenge?: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

export const FIVE_MONTHS_MS = 5 * 30 * 24 * 60 * 60 * 1000; // 5 months in milliseconds (~150 days)

const OUTBOX_PREFIX = 'tege_outbox_';
const MAX_OUTBOX = 200;

/** Server address. Same origin by default; set VITE_SERVER_URL for the Android/Capacitor build or a separate host. */
export function getServerUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const fromEnv = env?.VITE_SERVER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

type ServerEvent = { type: string; [k: string]: any };

/**
 * Client for the Tege server.
 * Keeps a live in-memory copy of the directory (users, public channels/groups, blocks) so the
 * synchronous getters the UI already uses keep working, while messages travel over a WebSocket.
 */
class RealtimeNetworkService {
  private ws: WebSocket | null = null;
  private account: UserAccount | null = null;
  private status: ConnectionStatus = 'idle';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivity = 0;
  private attempt = 0;
  private gotSnapshot = false;

  private users = new Map<number, ContactUser>();
  private channels = new Map<number, Channel>();
  private groups = new Map<number, Chat>();
  private myBlocks: BlockedUser[] = [];
  private blockedBy = new Set<number>();
  private videoChats = new Map<number, GroupVideoChatInfo>();

  private outbox: ServerEvent[] = [];
  private undelivered: NetworkMessagePayload[] = [];
  private seenDeliveries = new Set<string>();

  private messageListeners: Array<(payload: NetworkMessagePayload) => void> = [];
  private videoChatListeners: Array<(chatId: number, info: GroupVideoChatInfo | null) => void> = [];
  private directoryListeners: Array<() => void> = [];
  private statusListeners: Array<(s: ConnectionStatus) => void> = [];
  private sendFailListeners: Array<(reason: string, messageId?: number) => void> = [];
  private authErrorListeners: Array<() => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const wake = () => {
        if (this.account && this.status !== 'online' && this.status !== 'connecting') this.openSocket(true);
      };
      window.addEventListener('online', wake);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') wake();
      });
    }
  }

  // ================= AUTH (HTTP) =================
  private async api(path: string, body: unknown): Promise<any> {
    try {
      const res = await fetch(getServerUrl() + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'network' };
    }
  }

  public async register(data: {
    email: string;
    password: string;
    name: string;
    username?: string;
    phone?: string;
    bio?: string;
  }): Promise<AuthResult> {
    const r = await this.api('/api/register', { ...data, device: this.getDeviceLabel() });
    return r.ok ? { ok: true, user: { ...r.user, password: data.password } } : { ok: false, error: r.error };
  }

  public async checkUsername(username: string): Promise<{ available: boolean; reason?: string; error?: string }> {
    const r = await this.api('/api/username', { username });
    return r.ok ? { available: Boolean(r.available), reason: r.reason } : { available: false, error: r.error };
  }

  public async login(email: string, password: string): Promise<AuthResult> {
    const r = await this.api('/api/login', { email, password, device: this.getDeviceLabel() });
    return r.ok ? { ok: true, user: r.user ? { ...r.user, password } : undefined, requiresTwoFactor: Boolean(r.requiresTwoFactor), challenge: r.challenge } : { ok: false, error: r.error };
  }

  public async loginWithCloudPassword(challenge: string, cloudPassword: string): Promise<AuthResult> {
    const r = await this.api('/api/login/cloud-password', { challenge, cloudPassword, device: this.getDeviceLabel() });
    return r.ok ? { ok: true, user: r.user ? { ...r.user, password: '' } : undefined } : { ok: false, error: r.error };
  }

  public async getCloudPasswordStatus(token: string): Promise<{ ok: boolean; enabled: boolean }> {
    const r = await this.api('/api/cloud-password/status', { token });
    return { ok: Boolean(r.ok), enabled: Boolean(r.enabled) };
  }

  public async setCloudPassword(token: string, cloudPassword: string, currentPassword?: string): Promise<{ ok: boolean; error?: string }> {
    const r = await this.api('/api/cloud-password/set', { token, cloudPassword, currentPassword });
    return { ok: Boolean(r.ok), error: r.error };
  }

  public async disableCloudPassword(token: string, currentPassword: string): Promise<{ ok: boolean; error?: string }> {
    const r = await this.api('/api/cloud-password/disable', { token, currentPassword });
    return { ok: Boolean(r.ok), error: r.error };
  }

  public async changePassword(token: string, newPassword: string): Promise<boolean> {
    const r = await this.api('/api/password', { token, newPassword });
    return Boolean(r.ok);
  }

  public async getInactivitySettings(token: string): Promise<{ ok: boolean; months: number | null; lastActiveAt: number | null; deletionAt: number | null }> {
    const r = await this.api('/api/account/inactivity/status', { token });
    return { ok: Boolean(r.ok), months: r.months ?? null, lastActiveAt: r.lastActiveAt ?? null, deletionAt: r.deletionAt ?? null };
  }

  public async setInactivitySettings(token: string, months: number | null): Promise<{ ok: boolean; error?: string; deletionAt?: number | null }> {
    const r = await this.api('/api/account/inactivity', { token, months });
    return { ok: Boolean(r.ok), error: r.error, deletionAt: r.deletionAt ?? null };
  }

  public async deleteAccount(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const r = await this.api('/api/account/delete', { token, password });
    return { ok: Boolean(r.ok), error: r.error };
  }

  public async getSecurityEvents(token: string): Promise<{ ok: boolean; activeMute: { permanent: boolean; until: number | null } | null; events: Array<{ id: string; type: string; reason?: string; createdAt: number; until?: number | null; permanent?: boolean }> }> {
    const r = await this.api('/api/security/events', { token });
    return { ok: Boolean(r.ok), activeMute: r.activeMute || null, events: Array.isArray(r.events) ? r.events : [] };
  }

  public async listSessions(token: string): Promise<{ ok: boolean; sessions: Array<{ id: string; token: string; device: string; createdAt: number; current: boolean }> }> {
    const r = await this.api('/api/sessions', { token });
    return { ok: Boolean(r.ok), sessions: Array.isArray(r.sessions) ? r.sessions : [] };
  }

  public async revokeSession(token: string, sessionToken: string): Promise<boolean> {
    const r = await this.api('/api/sessions/revoke', { token, sessionToken });
    return Boolean(r.ok);
  }

  public async revokeOtherSessions(token: string): Promise<boolean> {
    const r = await this.api('/api/sessions/revoke-others', { token });
    return Boolean(r.ok);
  }

  private getDeviceLabel(): string {
    if (typeof navigator === 'undefined') return 'Tege browser';
    const ua = navigator.userAgent || '';
    const platform = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Web';
    const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox\//i.test(ua) ? 'Firefox' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Browser';
    return `${platform} · ${browser}`;
  }

  // ================= CONNECTION =================
  public connect(account: UserAccount) {
    if (!account.token) return;
    if (this.account && this.account.id === account.id && this.account.token === account.token) {
      this.account = account;
      if (this.ws && (this.status === 'online' || this.status === 'connecting')) return;
    } else {
      this.teardown();
      this.account = account;
      this.myBlocks = [];
      this.blockedBy = new Set();
      this.gotSnapshot = false;
      this.loadOutbox();
    }
    this.openSocket(true);
  }

  public disconnect() {
    this.teardown();
    this.account = null;
    this.myBlocks = [];
    this.blockedBy = new Set();
    this.outbox = [];
    this.undelivered = [];
    this.setStatus('idle');
    this.emitDirectory();
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public subscribeToStatus(cb: (s: ConnectionStatus) => void) {
    this.statusListeners.push(cb);
    return () => {
      this.statusListeners = this.statusListeners.filter((x) => x !== cb);
    };
  }

  public subscribeToDirectory(cb: () => void) {
    this.directoryListeners.push(cb);
    return () => {
      this.directoryListeners = this.directoryListeners.filter((x) => x !== cb);
    };
  }

  public subscribeToSendFailures(cb: (reason: string, messageId?: number) => void) {
    this.sendFailListeners.push(cb);
    return () => {
      this.sendFailListeners = this.sendFailListeners.filter((x) => x !== cb);
    };
  }

  public subscribeToAuthErrors(cb: () => void) {
    this.authErrorListeners.push(cb);
    return () => {
      this.authErrorListeners = this.authErrorListeners.filter((x) => x !== cb);
    };
  }

  private setStatus(s: ConnectionStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }

  private teardown() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.attempt = 0;
  }

  private openSocket(immediate: boolean) {
    if (!this.account?.token) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    const start = () => {
      if (!this.account?.token) return;
      const old = this.ws;
      if (old) {
        old.onopen = old.onmessage = old.onclose = old.onerror = null;
        try {
          old.close();
        } catch {
          /* ignore */
        }
      }
      this.setStatus('connecting');
      const url = getServerUrl().replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(this.account.token!);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        this.scheduleReconnect();
        return;
      }
      this.ws = ws;
      ws.onopen = () => {
        this.attempt = 0;
        this.lastActivity = Date.now();
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (Date.now() - this.lastActivity > 70_000) {
            ws.close();
            return;
          }
          this.rawSend({ type: 'ping' });
        }, 25_000);
      };
      ws.onmessage = (e) => {
        this.lastActivity = Date.now();
        try {
          this.handleServerEvent(JSON.parse(e.data));
        } catch (err) {
          console.warn('Bad server event', err);
        }
      };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        this.ws = null;
        this.setStatus('offline');
        this.scheduleReconnect();
      };
      ws.onerror = () => {
        /* onclose follows */
      };
    };

    if (immediate) start();
    else this.reconnectTimer = setTimeout(start, Math.min(15_000, 1000 * 2 ** this.attempt++));
  }

  private scheduleReconnect() {
    if (!this.account) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket(true);
    }, Math.min(15_000, 1000 * 2 ** this.attempt++));
  }

  private rawSend(obj: ServerEvent): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  /** Send now if connected, otherwise keep it and flush after reconnect. */
  private queueSend(obj: ServerEvent) {
    if (this.gotSnapshot && this.rawSend(obj)) return;
    this.outbox.push(obj);
    if (this.outbox.length > MAX_OUTBOX) this.outbox.shift();
    this.saveOutbox();
  }

  private flushOutbox() {
    const items = this.outbox;
    this.outbox = [];
    for (const it of items) this.rawSend(it);
    this.saveOutbox();
  }

  private loadOutbox() {
    try {
      const raw = this.account && localStorage.getItem(OUTBOX_PREFIX + this.account.id);
      this.outbox = raw ? JSON.parse(raw) : [];
    } catch {
      this.outbox = [];
    }
  }

  private saveOutbox() {
    if (!this.account) return;
    try {
      if (this.outbox.length) localStorage.setItem(OUTBOX_PREFIX + this.account.id, JSON.stringify(this.outbox));
      else localStorage.removeItem(OUTBOX_PREFIX + this.account.id);
    } catch {
      /* quota */
    }
  }

  // ================= SERVER EVENTS =================
  private handleServerEvent(ev: ServerEvent) {
    switch (ev.type) {
      case 'snapshot': {
        this.users = new Map((ev.users as ContactUser[]).map((u) => [u.id, u]));
        this.channels = new Map((ev.channels as Channel[]).map((c) => [c.id, c]));
        this.groups = new Map((ev.groups as Chat[]).map((g) => [g.id, g]));
        this.myBlocks = ev.blocks || [];
        this.blockedBy = new Set(ev.blockedBy || []);
        this.videoChats = new Map(Object.entries(ev.videoChats || {}).map(([k, v]) => [Number(k), v as GroupVideoChatInfo]));
        this.gotSnapshot = true;
        this.setStatus('online');
        this.flushOutbox();
        this.emitDirectory();
        break;
      }
      case 'message':
        this.receive(ev.payload as NetworkMessagePayload);
        break;
      case 'user_upsert':
        this.users.set(ev.user.id, ev.user);
        this.emitDirectory();
        break;
      case 'presence': {
        const u = this.users.get(ev.userId);
        if (u) this.users.set(ev.userId, { ...u, online: ev.online, ...(typeof ev.lastSeenAt === 'number' ? { lastSeenAt: ev.lastSeenAt } : {}) });
        this.emitDirectory();
        break;
      }
      case 'channel_upsert':
        this.channels.set(ev.channel.id, ev.channel);
        this.emitDirectory();
        break;
      case 'channel_remove':
        this.channels.delete(ev.channelId);
        this.emitDirectory();
        break;
      case 'group_upsert':
        this.groups.set(ev.group.id, ev.group);
        this.emitDirectory();
        break;
      case 'blocked_by':
        this.blockedBy = new Set(ev.ids || []);
        this.emitDirectory();
        break;
      case 'video_chat':
        if (ev.info && ev.info.isActive) this.videoChats.set(ev.chatId, ev.info);
        else this.videoChats.delete(ev.chatId);
        this.videoChatListeners.forEach((cb) => cb(ev.chatId, ev.info || null));
        break;
      case 'send_result':
        if (!ev.ok) this.sendFailListeners.forEach((cb) => cb(ev.reason, ev.id));
        break;
      case 'auth_error':
        this.authErrorListeners.forEach((cb) => cb());
        break;
    }
  }

  private emitDirectory() {
    this.directoryListeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    });
  }

  private receive(payload: NetworkMessagePayload) {
    if (this.messageListeners.length === 0) {
      // UI not ready yet — hold it (and do NOT ack) until someone listens
      if (!this.undelivered.some((p) => p.deliveryId === payload.deliveryId)) this.undelivered.push(payload);
      return;
    }
    this.deliver(payload);
  }

  private deliver(payload: NetworkMessagePayload) {
    const did = payload.deliveryId;
    if (did && this.seenDeliveries.has(did)) {
      this.rawSend({ type: 'ack', ids: [did] });
      return;
    }
    for (const listener of this.messageListeners) {
      try {
        listener(payload);
      } catch (e) {
        console.error('Error in message listener:', e);
      }
    }
    if (did) {
      this.seenDeliveries.add(did);
      if (this.seenDeliveries.size > 2000) this.seenDeliveries.delete(this.seenDeliveries.values().next().value as string);
      this.rawSend({ type: 'ack', ids: [did] });
    }
  }

  // ================= USERS =================
  /**
   * Called whenever the local profile changes. Pushes it to the server (only when it really differs
   * from what the server already has).
   */
  public registerUser(user: UserAccount | ContactUser, _isOnlineOverride?: boolean, _activeUserId?: number) {
    if (!this.account || user.id !== this.account.id || !this.gotSnapshot) return;
    const known = this.users.get(user.id);
    const next = {
      name: user.name,
      username: user.username,
      bio: (user as UserAccount).bio ?? known?.bio ?? '',
      avatarUri: user.avatarUri || null,
      phone: user.phone,
      country: user.country
    };
    if (
      known &&
      known.name === next.name &&
      known.username === next.username &&
      (known.bio || '') === next.bio &&
      (known.avatarUri || null) === next.avatarUri &&
      known.phone === next.phone &&
      known.country === next.country
    ) {
      return;
    }
    this.users.set(user.id, { ...(known || { id: user.id, online: true }), ...next, online: true } as ContactUser);
    this.queueSend({ type: 'profile', user: next });
  }

  /** Presence is tracked by the server from live connections; kept for API compatibility. */
  public setUserOnline(_userId: number, _online: boolean) {}
  public syncMultiAccountsOnline(_activeUserId: number, _allAccountIds: number[]) {}

  public isUserOnline(userId: number): boolean {
    return Boolean(this.users.get(userId)?.online);
  }

  public getUser(userId: number): ContactUser | undefined {
    return this.users.get(userId);
  }

  public getAllRegisteredUsers(): ContactUser[] {
    return Array.from(this.users.values());
  }

  public searchRegisteredUsers(query: string, currentUserId?: number): ContactUser[] {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    return this.getAllRegisteredUsers().filter((u) => {
      if (currentUserId && u.id === currentUserId) return false;
      const matchId = u.id.toString() === clean.replace('#', '');
      return matchId || u.username.toLowerCase().includes(clean) || u.name.toLowerCase().includes(clean);
    });
  }

  // ================= CHANNELS =================
  public registerChannel(channel: Channel) {
    this.channels.set(channel.id, { ...channel });
    this.queueSend({ type: 'register_channel', channel });
  }

  public getAllPublicChannels(): Channel[] {
    return Array.from(this.channels.values());
  }

  public getChannelsByOwner(ownerId: number): Channel[] {
    return this.getAllPublicChannels().filter((c) => c.ownerId === ownerId);
  }

  public removeChannel(channelId: number) {
    if (this.channels.delete(channelId)) this.queueSend({ type: 'remove_channel', channelId });
  }

  // Search channels ONLY by @user handle
  public searchPublicChannels(query: string): Channel[] {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    const stripped = clean.replace('@', '');
    return this.getAllPublicChannels().filter((c) => {
      const link = (c.channelLink || '').toLowerCase();
      const strippedLink = link.replace('@', '');
      return link.includes(clean) || (stripped.length > 0 && strippedLink.includes(stripped));
    });
  }

  // ================= GROUPS =================
  public registerGroup(group: Chat) {
    if (group.type !== 'group') return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { messages, ...meta } = group;
    const slim = { ...meta, messages: [] } as Chat;
    this.groups.set(group.id, slim);
    this.queueSend({ type: 'register_group', group: slim });
  }

  public getAllPublicGroups(): Chat[] {
    return Array.from(this.groups.values());
  }

  public searchPublicGroups(query: string): Chat[] {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    const stripped = clean.replace('@', '');
    return this.getAllPublicGroups().filter((g) => {
      const username = (g.username || '').toLowerCase();
      const strippedUsername = username.replace('@', '');
      return (
        username.includes(clean) ||
        (stripped.length > 0 && strippedUsername.includes(stripped)) ||
        g.name.toLowerCase().includes(clean)
      );
    });
  }

  /** Tell the server this user is a member of these groups/channels (they become delivery targets). */
  public joinChats(chatIds: number[]) {
    if (chatIds.length) this.queueSend({ type: 'join_chats', chatIds });
  }

  public leaveChat(chatId: number) {
    this.queueSend({ type: 'leave_chat', chatId });
  }

  // ================= BLACKLIST / BLOCKED USERS =================
  public getBlockedUsers(userId: number): BlockedUser[] {
    return this.account && userId === this.account.id ? this.myBlocks : [];
  }

  /** true if `blockerUserId` has blocked `targetUserId` (only known for pairs that involve the current user) */
  public isBlocked(blockerUserId: number, targetUserId: number): boolean {
    if (!this.account) return false;
    if (blockerUserId === this.account.id) return this.myBlocks.some((u) => u.id === targetUserId);
    if (targetUserId === this.account.id) return this.blockedBy.has(blockerUserId);
    return false;
  }

  public blockUser(blockerUserId: number, userToBlock: BlockedUser) {
    if (!this.account || blockerUserId !== this.account.id) return;
    if (!this.myBlocks.some((u) => u.id === userToBlock.id)) {
      this.myBlocks = [...this.myBlocks, { ...userToBlock, blockedAt: Date.now() }];
      this.queueSend({ type: 'block', user: userToBlock });
    }
  }

  public unblockUser(blockerUserId: number, targetUserId: number) {
    if (!this.account || blockerUserId !== this.account.id) return;
    this.myBlocks = this.myBlocks.filter((u) => u.id !== targetUserId);
    this.queueSend({ type: 'unblock', userId: targetUserId });
  }

  // ================= 5-MONTH LINK EXPIRATION =================
  public static isLinkExpired(expiresAt?: number): boolean {
    if (!expiresAt) return false;
    return Date.now() > expiresAt;
  }

  public static generateFiveMonthLink(id: number, type: 'channel' | 'group'): { link: string; createdAt: number; expiresAt: number } {
    const createdAt = Date.now();
    const expiresAt = createdAt + FIVE_MONTHS_MS;
    const token = Math.random().toString(36).substring(2, 8);
    const link = `https://tege.im/+join_${type}_${id}_${token}`;
    return { link, createdAt, expiresAt };
  }

  // ================= CHANNEL DISCUSSIONS =================
  public async getChannelComments(token: string, channelId: number, postId: number): Promise<{ ok: boolean; comments: Comment[]; error?: string }> {
    const r = await this.api('/api/channels/comments/list', { token, channelId, postId });
    return { ok: Boolean(r.ok), comments: Array.isArray(r.comments) ? r.comments : [], error: r.error };
  }

  public async addChannelComment(token: string, channelId: number, postId: number, text: string): Promise<{ ok: boolean; comment?: Comment; comments: Comment[]; error?: string }> {
    const r = await this.api('/api/channels/comments/add', { token, channelId, postId, text });
    return { ok: Boolean(r.ok), comment: r.comment, comments: Array.isArray(r.comments) ? r.comments : [], error: r.error };
  }

  // ================= MESSAGES =================
  /** Deliver a message through the server to the recipient(s). Queued automatically while offline. */
  public sendMessage(payload: NetworkMessagePayload) {
    // Blocking is enforced by the server (our local copy of "who blocked me" can be stale while offline).
    this.queueSend({ type: 'send', payload });
  }

  public subscribeToMessages(callback: (payload: NetworkMessagePayload) => void) {
    this.messageListeners.push(callback);
    if (this.undelivered.length) {
      const held = this.undelivered;
      this.undelivered = [];
      for (const p of held) this.deliver(p);
    }
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  // ================= GROUP VIDEO CHAT STATE =================
  public setActiveVideoChat(chatId: number, info: GroupVideoChatInfo | null) {
    if (info && info.isActive) this.videoChats.set(chatId, info);
    else this.videoChats.delete(chatId);
    this.queueSend({ type: 'video_chat', chatId, info });
    this.videoChatListeners.forEach((cb) => cb(chatId, info));
  }

  public getActiveVideoChat(chatId: number): GroupVideoChatInfo | null {
    return this.videoChats.get(chatId) || null;
  }

  public subscribeToVideoChat(callback: (chatId: number, info: GroupVideoChatInfo | null) => void) {
    this.videoChatListeners.push(callback);
    return () => {
      this.videoChatListeners = this.videoChatListeners.filter((cb) => cb !== callback);
    };
  }
}

export const realtimeNetwork = new RealtimeNetworkService();
