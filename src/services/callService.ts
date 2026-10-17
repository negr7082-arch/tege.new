import Peer, { DataConnection, MediaConnection } from 'peerjs';

/**
 * Реальные видеозвонки / видеочаты / трансляции (WebRTC через PeerJS).
 * Любой человек с кодом комнаты может зайти с любого устройства.
 * Топология: один "хост" комнаты (PeerJS id = tege-room-<КОД>) выдаёт список участников,
 * дальше все соединяются друг с другом напрямую (mesh).
 */

export interface CallProfile {
  id: number;
  name: string;
  avatarUri?: string | null;
}

export interface CallState {
  micOn: boolean;
  videoOn: boolean;
  screen: boolean;
  hand: boolean;
}

export interface RemoteParticipant extends CallState {
  peerId: string;
  admin: boolean;
  profile: CallProfile;
  isHost: boolean;
  stream: MediaStream | null;
  speaking: boolean;
}

export type CallStatus = 'connecting' | 'live' | 'not-started' | 'error';

export interface CallSessionOptions {
  roomCode: string;
  profile: CallProfile;
  /** Может ли этот пользователь создать комнату, если её ещё нет */
  canHost: boolean;
  /** Админ/владелец: может глушить участников и давать слово */
  isAdmin: boolean;
  /** Просить микрофон сразу при входе */
  initialMic: boolean;
  onStatus: (status: CallStatus, error?: string) => void;
  onParticipants: (list: RemoteParticipant[]) => void;
  onLocalState: (state: CallState, hasMic: boolean) => void;
  onLocalVideo: (stream: MediaStream | null) => void;
  onLocalSpeaking: (speaking: boolean) => void;
  /** Эфир завершён организатором */
  onEnded: () => void;
  /** Админ отключил мой микрофон */
  onForceMute: () => void;
  /** Админ разрешил / запретил мне говорить (для слушателей трансляции) */
  onSpeakPermission: (allowed: boolean) => void;
}

type WireMessage =
  | { t: 'hello'; profile: CallProfile; state: CallState; isHost: boolean; admin: boolean }
  | { t: 'mute' }
  | { t: 'speaker'; allowed: boolean }
  | { t: 'state'; state: CallState }
  | { t: 'roster'; peers: string[] }
  | { t: 'end' };

const PEER_OPTIONS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
  }
};

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function normalizeRoomCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** Код комнаты для личного звонка: одинаковый у обоих собеседников */
export function directRoomCode(userA: number, userB: number): string {
  const lo = Math.min(userA, userB);
  const hi = Math.max(userA, userB);
  return `DM${lo}X${hi}`;
}

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

/** Определение "говорит / молчит" по громкости потока */
export function watchSpeaking(stream: MediaStream, cb: (speaking: boolean) => void): () => void {
  try {
    const AC = getAudioContextCtor();
    if (!AC || stream.getAudioTracks().length === 0) return () => {};
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let last = false;
    const id = window.setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const speaking = Math.sqrt(sum / buf.length) > 0.04;
      if (speaking !== last) {
        last = speaking;
        cb(speaking);
      }
    }, 250);
    return () => {
      window.clearInterval(id);
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

export class CallSession {
  private opts: CallSessionOptions;
  private peer: Peer | null = null;
  private hostId: string;
  private amHost = false;
  private closed = false;

  private conns = new Map<string, DataConnection>();
  private calls = new Map<string, MediaConnection>();
  private remotes = new Map<string, RemoteParticipant>();
  private stoppers = new Map<string, () => void>();

  private audioTrack!: MediaStreamTrack;
  private placeholderVideo!: MediaStreamTrack;
  private curVideo!: MediaStreamTrack;
  private camTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private hasMic = false;
  private silentCtx: AudioContext | null = null;
  private canvasTimer: number | null = null;
  private stopLocalWatch: (() => void) | null = null;

  private state: CallState = { micOn: false, videoOn: false, screen: false, hand: false };

  constructor(opts: CallSessionOptions) {
    this.opts = opts;
    this.hostId = `tege-room-${normalizeRoomCode(opts.roomCode)}`;
  }

  isHost(): boolean {
    return this.amHost;
  }

  // ---------------------------------------------------------------- start
  async start(): Promise<void> {
    this.setupPlaceholders();
    if (this.opts.initialMic) {
      await this.acquireMic();
    }
    this.state.micOn = this.hasMic && this.opts.initialMic;
    this.audioTrack.enabled = this.state.micOn;
    this.restartLocalWatch();
    this.emitLocalState();
    if (this.closed) return;

    this.opts.onStatus('connecting');

    for (let attempt = 0; attempt < 2 && !this.closed; attempt++) {
      const res = await this.probe();
      if (this.closed) return;
      if (res === 'joined') {
        this.opts.onStatus('live');
        return;
      }
      if (res === 'error') {
        this.opts.onStatus('error', 'Не удалось подключиться к серверу соединений. Проверьте интернет.');
        return;
      }
      // no-host
      if (!this.opts.canHost) {
        this.opts.onStatus('not-started');
        return;
      }
      const hosted = await this.becomeHost();
      if (this.closed) return;
      if (hosted === 'ok') {
        this.opts.onStatus('live');
        return;
      }
      if (hosted === 'error') {
        this.opts.onStatus('error', 'Не удалось создать комнату. Проверьте интернет.');
        return;
      }
      // 'taken' -> кто-то успел раньше, пробуем присоединиться ещё раз
    }
    if (!this.closed) this.opts.onStatus('error', 'Не удалось подключиться.');
  }

  // ---------------------------------------------------------------- peers
  private randomPeerId(): string {
    return `tege-p-${normalizeRoomCode(this.opts.roomCode)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private probe(): Promise<'joined' | 'no-host' | 'error'> {
    return new Promise((resolve) => {
      let done = false;
      let timer: number | null = null;
      const finish = (r: 'joined' | 'no-host' | 'error') => {
        if (done) return;
        done = true;
        if (timer !== null) window.clearTimeout(timer);
        if (r !== 'joined' && this.peer) {
          try {
            this.peer.destroy();
          } catch {
            /* ignore */
          }
          this.peer = null;
        }
        resolve(r);
      };
      timer = window.setTimeout(() => finish('error'), 12000);

      let peer: Peer;
      try {
        peer = new Peer(this.randomPeerId(), PEER_OPTIONS);
      } catch {
        finish('error');
        return;
      }
      this.peer = peer;

      peer.on('open', () => {
        if (done) return;
        const conn = peer.connect(this.hostId, { reliable: true });
        conn.on('open', () => {
          if (done) return;
          this.setupPeerHandlers(peer);
          this.attachConn(conn, true);
          finish('joined');
        });
      });
      peer.on('error', (err: unknown) => {
        const type = (err as { type?: string })?.type;
        if (!done) {
          finish(type === 'peer-unavailable' ? 'no-host' : 'error');
        } else {
          this.handlePeerError(type);
        }
      });
    });
  }

  private becomeHost(): Promise<'ok' | 'taken' | 'error'> {
    return new Promise((resolve) => {
      let done = false;
      let timer: number | null = null;
      const finish = (r: 'ok' | 'taken' | 'error') => {
        if (done) return;
        done = true;
        if (timer !== null) window.clearTimeout(timer);
        if (r !== 'ok' && this.peer) {
          try {
            this.peer.destroy();
          } catch {
            /* ignore */
          }
          this.peer = null;
        }
        resolve(r);
      };
      timer = window.setTimeout(() => finish('error'), 12000);

      let peer: Peer;
      try {
        peer = new Peer(this.hostId, PEER_OPTIONS);
      } catch {
        finish('error');
        return;
      }
      this.peer = peer;
      peer.on('open', () => {
        if (done) return;
        this.amHost = true;
        this.setupPeerHandlers(peer);
        finish('ok');
      });
      peer.on('error', (err: unknown) => {
        const type = (err as { type?: string })?.type;
        if (!done) {
          finish(type === 'unavailable-id' ? 'taken' : 'error');
        } else {
          this.handlePeerError(type);
        }
      });
    });
  }

  private handlePeerError(type?: string) {
    // peer-unavailable после входа — кто-то из списка уже вышел, это нормально
    if (type === 'network' || type === 'server-error') {
      try {
        this.peer?.reconnect();
      } catch {
        /* ignore */
      }
    }
  }

  private setupPeerHandlers(peer: Peer) {
    peer.on('disconnected', () => {
      if (this.closed) return;
      try {
        peer.reconnect();
      } catch {
        /* ignore */
      }
    });
    peer.on('connection', (conn) => {
      conn.on('open', () => this.attachConn(conn, false));
    });
    peer.on('call', (call) => {
      call.answer(this.makeCallStream());
      this.registerCall(call);
    });
  }

  private attachConn(conn: DataConnection, initiator: boolean) {
    if (this.closed) {
      conn.close();
      return;
    }
    const peerId = conn.peer;
    if (this.conns.has(peerId)) {
      conn.close();
      return;
    }
    this.conns.set(peerId, conn);
    this.touch(peerId, {});
    conn.on('data', (data) => this.handleData(conn, data as WireMessage));
    conn.on('close', () => this.removePeer(peerId));
    conn.on('error', () => this.removePeer(peerId));
    this.sendTo(conn, { t: 'hello', profile: this.opts.profile, state: this.state, isHost: this.amHost, admin: this.opts.isAdmin });
    if (initiator) this.callPeer(peerId);
  }

  private handleData(conn: DataConnection, msg: WireMessage) {
    if (!msg || typeof msg !== 'object') return;
    const peerId = conn.peer;
    switch (msg.t) {
      case 'hello': {
        this.touch(peerId, { profile: msg.profile, isHost: msg.isHost, admin: Boolean(msg.admin), ...msg.state });
        if (this.amHost && !msg.isHost) {
          const peers = [...this.remotes.keys()].filter((p) => p !== peerId && this.conns.has(p));
          this.sendTo(conn, { t: 'roster', peers });
        }
        break;
      }
      case 'roster': {
        for (const p of msg.peers) {
          if (!this.peer || this.conns.has(p) || p === this.peer.id) continue;
          const c = this.peer.connect(p, { reliable: true });
          c.on('open', () => this.attachConn(c, true));
        }
        break;
      }
      case 'state':
        this.touch(peerId, msg.state);
        break;
      case 'mute':
        if (this.remotes.get(peerId)?.admin) {
          this.setMic(false).catch(() => {});
          this.opts.onForceMute();
        }
        break;
      case 'speaker':
        if (this.remotes.get(peerId)?.admin) this.opts.onSpeakPermission(Boolean(msg.allowed));
        break;
      case 'end':
        this.leave();
        this.opts.onEnded();
        break;
    }
  }

  private callPeer(peerId: string) {
    if (!this.peer || this.calls.has(peerId)) return;
    const call = this.peer.call(peerId, this.makeCallStream());
    if (call) this.registerCall(call);
  }

  private registerCall(call: MediaConnection) {
    const peerId = call.peer;
    this.calls.set(peerId, call);
    call.on('stream', (stream) => {
      this.touch(peerId, { stream });
      if (!this.stoppers.has(peerId)) {
        this.stoppers.set(
          peerId,
          watchSpeaking(stream, (speaking) => this.touch(peerId, { speaking }))
        );
      }
    });
    call.on('close', () => this.removePeer(peerId));
    call.on('error', () => this.removePeer(peerId));
  }

  private removePeer(peerId: string) {
    const conn = this.conns.get(peerId);
    const call = this.calls.get(peerId);
    this.conns.delete(peerId);
    this.calls.delete(peerId);
    try {
      conn?.close();
    } catch {
      /* ignore */
    }
    try {
      call?.close();
    } catch {
      /* ignore */
    }
    const stop = this.stoppers.get(peerId);
    if (stop) {
      stop();
      this.stoppers.delete(peerId);
    }
    if (this.remotes.delete(peerId)) this.emitParticipants();
  }

  private touch(peerId: string, patch: Partial<RemoteParticipant>) {
    if (this.closed) return;
    const prev: RemoteParticipant = this.remotes.get(peerId) || {
      peerId,
      admin: false,
      profile: { id: 0, name: 'Участник' },
      isHost: false,
      stream: null,
      speaking: false,
      micOn: false,
      videoOn: false,
      screen: false,
      hand: false
    };
    this.remotes.set(peerId, { ...prev, ...patch, peerId });
    this.emitParticipants();
  }

  private emitParticipants() {
    this.opts.onParticipants([...this.remotes.values()].map((p) => ({ ...p })));
  }

  private sendTo(conn: DataConnection, msg: WireMessage) {
    try {
      if (conn.open) conn.send(msg);
    } catch {
      /* ignore */
    }
  }

  private broadcast(msg: WireMessage) {
    this.conns.forEach((c) => this.sendTo(c, msg));
  }

  // ---------------------------------------------------------------- local media
  private setupPlaceholders() {
    // Тихий аудиотрек (если микрофона нет — всё равно можем слушать и участвовать)
    const AC = getAudioContextCtor();
    if (AC) {
      this.silentCtx = new AC();
      const dest = this.silentCtx.createMediaStreamDestination();
      this.audioTrack = dest.stream.getAudioTracks()[0];
    } else {
      this.audioTrack = new MediaStream().getAudioTracks()[0];
    }
    // Чёрный видеотрек-заглушка
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const g = canvas.getContext('2d');
    const paint = () => {
      if (g) {
        g.fillStyle = '#000';
        g.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    paint();
    this.canvasTimer = window.setInterval(paint, 1000);
    const cs = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream?.(1);
    this.placeholderVideo = cs ? cs.getVideoTracks()[0] : new MediaStream().getVideoTracks()[0];
    this.curVideo = this.placeholderVideo;
  }

  private makeCallStream(): MediaStream {
    const tracks: MediaStreamTrack[] = [];
    if (this.audioTrack) tracks.push(this.audioTrack);
    if (this.curVideo) tracks.push(this.curVideo);
    return new MediaStream(tracks);
  }

  private replaceSenderTrack(kind: 'audio' | 'video', track: MediaStreamTrack) {
    this.calls.forEach((call) => {
      const pc = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
      pc?.getSenders().forEach((s) => {
        if (s.track && s.track.kind === kind) s.replaceTrack(track).catch(() => {});
      });
    });
  }

  private async acquireMic(): Promise<void> {
    if (this.hasMic) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const track = s.getAudioTracks()[0];
      if (!track || this.closed) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      const old = this.audioTrack;
      this.audioTrack = track;
      this.hasMic = true;
      this.replaceSenderTrack('audio', track);
      old?.stop();
      this.restartLocalWatch();
    } catch (e) {
      console.warn('Microphone unavailable:', e);
    }
  }

  private restartLocalWatch() {
    this.stopLocalWatch?.();
    this.stopLocalWatch = watchSpeaking(new MediaStream([this.audioTrack]), (sp) => this.opts.onLocalSpeaking(sp));
  }

  private emitLocalState() {
    this.opts.onLocalState({ ...this.state }, this.hasMic);
  }

  private refreshVideo() {
    const track = this.screenTrack || this.camTrack || this.placeholderVideo;
    this.curVideo = track;
    this.replaceSenderTrack('video', track);
    this.state.videoOn = Boolean(this.screenTrack || this.camTrack);
    this.state.screen = Boolean(this.screenTrack);
    this.opts.onLocalVideo(this.screenTrack || this.camTrack ? new MediaStream([track]) : null);
    this.emitLocalState();
    this.broadcast({ t: 'state', state: this.state });
  }

  async setMic(on: boolean): Promise<boolean> {
    if (on && !this.hasMic) await this.acquireMic();
    const effective = on && this.hasMic;
    this.audioTrack.enabled = effective;
    this.state.micOn = effective;
    this.emitLocalState();
    this.broadcast({ t: 'state', state: this.state });
    return effective;
  }

  async setCamera(on: boolean): Promise<boolean> {
    if (on) {
      if (!this.camTrack) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          if (this.closed) {
            s.getTracks().forEach((t) => t.stop());
            return false;
          }
          this.camTrack = s.getVideoTracks()[0];
        } catch (e) {
          console.warn('Camera unavailable:', e);
          return false;
        }
      }
      // камера включается поверх демонстрации экрана
      if (this.screenTrack) {
        this.screenTrack.stop();
        this.screenTrack = null;
      }
    } else if (this.camTrack) {
      const old = this.camTrack;
      this.camTrack = null;
      this.refreshVideo();
      old.stop();
      return false;
    }
    this.refreshVideo();
    return Boolean(this.camTrack);
  }

  async setScreen(on: boolean): Promise<boolean> {
    if (on) {
      try {
        const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c?: unknown) => Promise<MediaStream> };
        if (!md?.getDisplayMedia) return false;
        const s = await md.getDisplayMedia({ video: true });
        if (this.closed) {
          s.getTracks().forEach((t) => t.stop());
          return false;
        }
        const track = s.getVideoTracks()[0];
        track.onended = () => {
          if (this.screenTrack === track) {
            this.screenTrack = null;
            this.refreshVideo();
          }
        };
        this.screenTrack = track;
      } catch (e) {
        console.warn('Screen share unavailable:', e);
        return false;
      }
    } else if (this.screenTrack) {
      const old = this.screenTrack;
      this.screenTrack = null;
      this.refreshVideo();
      old.stop();
      return false;
    }
    this.refreshVideo();
    return Boolean(this.screenTrack);
  }

  /** Админ: отключить микрофон участнику */
  muteParticipant(peerId: string) {
    if (!this.opts.isAdmin) return;
    const c = this.conns.get(peerId);
    if (c) this.sendTo(c, { t: 'mute' });
  }

  /** Админ: разрешить / запретить участнику говорить */
  setSpeaker(peerId: string, allowed: boolean) {
    if (!this.opts.isAdmin) return;
    const c = this.conns.get(peerId);
    if (c) this.sendTo(c, { t: 'speaker', allowed });
  }

  setHand(on: boolean) {
    this.state.hand = on;
    this.emitLocalState();
    this.broadcast({ t: 'state', state: this.state });
  }

  // ---------------------------------------------------------------- leave
  /** Завершить эфир для всех */
  endForAll() {
    this.broadcast({ t: 'end' });
    window.setTimeout(() => this.leave(), 150);
  }

  leave() {
    if (this.closed) return;
    this.closed = true;
    this.conns.forEach((c) => {
      try {
        c.close();
      } catch {
        /* ignore */
      }
    });
    this.calls.forEach((c) => {
      try {
        c.close();
      } catch {
        /* ignore */
      }
    });
    this.conns.clear();
    this.calls.clear();
    this.remotes.clear();
    this.stoppers.forEach((s) => s());
    this.stoppers.clear();
    this.stopLocalWatch?.();
    this.stopLocalWatch = null;
    if (this.canvasTimer !== null) window.clearInterval(this.canvasTimer);
    [this.audioTrack, this.placeholderVideo, this.camTrack, this.screenTrack].forEach((t) => {
      try {
        t?.stop();
      } catch {
        /* ignore */
      }
    });
    this.silentCtx?.close().catch(() => {});
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.peer = null;
  }
}
