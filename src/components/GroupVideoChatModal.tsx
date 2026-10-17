import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Hand,
  PhoneOff,
  Users,
  ShieldCheck,
  Radio,
  Copy,
  Check,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { GroupVideoChatInfo, UserAccount } from '../types';
import { TelegramAvatar } from './TelegramAvatar';
import { CallSession, CallState, CallStatus, RemoteParticipant } from '../services/callService';

interface GroupVideoChatModalProps {
  isOpen: boolean;
  chatName: string;
  isChannel?: boolean;
  isDirect?: boolean;
  isAdmin?: boolean;
  isOwner?: boolean;
  /** Любой человек с этим кодом может зайти в эфир с любого устройства */
  roomCode: string;
  /** Может ли этот пользователь создать комнату, если её ещё нет */
  canHost?: boolean;
  startWithVideo?: boolean;
  currentAccount: UserAccount;
  videoChatInfo: GroupVideoChatInfo;
  onClose: () => void;
  onEndVideoChat?: () => void;
  onLeaveVideoChat?: () => void;
}

interface Card {
  key: string;
  isMe: boolean;
  name: string;
  id: number;
  avatarUri?: string | null;
  isHost: boolean;
  admin: boolean;
  peerId?: string;
  micOn: boolean;
  videoOn: boolean;
  screen: boolean;
  hand: boolean;
  speaking: boolean;
  stream: MediaStream | null;
}

const MediaEl: React.FC<{
  stream: MediaStream | null;
  show: boolean;
  muted?: boolean;
  mirror?: boolean;
  contain?: boolean;
}> = ({ stream, show, muted = false, mirror = false, contain = false }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={show ? `w-full h-full ${contain ? 'object-contain' : 'object-cover'} ${mirror ? '-scale-x-100' : ''}` : 'hidden'}
    />
  );
};

export const GroupVideoChatModal: React.FC<GroupVideoChatModalProps> = ({
  isOpen,
  chatName,
  isChannel = false,
  isDirect = false,
  isAdmin = false,
  isOwner = false,
  roomCode,
  canHost = false,
  startWithVideo = false,
  currentAccount,
  videoChatInfo,
  onClose,
  onEndVideoChat,
  onLeaveVideoChat
}) => {
  const [status, setStatus] = useState<CallStatus>('connecting');
  const [statusError, setStatusError] = useState<string>('');
  const [localState, setLocalState] = useState<CallState>({ micOn: false, videoOn: false, screen: false, hand: false });
  const [hasMic, setHasMic] = useState(false);
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remotes, setRemotes] = useState<RemoteParticipant[]>([]);
  const [activeTab, setActiveTab] = useState<'grid' | 'participants'>('grid');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [canSpeak, setCanSpeak] = useState(true);
  const [allowedPeers, setAllowedPeers] = useState<Set<string>>(new Set());

  const sessionRef = useRef<CallSession | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const endedRef = useRef(onEndVideoChat);
  endedRef.current = onEndVideoChat;

  const isListenerOnly = isChannel && !isAdmin && !isOwner;
  const iAmAdmin = Boolean(isAdmin || isOwner);

  useEffect(() => {
    setCanSpeak(!isListenerOnly);
  }, [isListenerOnly]);

  useEffect(() => {
    if (!isOpen) return;
    const session = new CallSession({
      roomCode,
      profile: { id: currentAccount.id, name: currentAccount.name, avatarUri: currentAccount.avatarUri },
      canHost: canHost || isDirect || isAdmin || isOwner,
      isAdmin: Boolean(isAdmin || isOwner),
      initialMic: !isListenerOnly,
      onStatus: (st, err) => {
        setStatus(st);
        setStatusError(err || '');
        if (st === 'live' && startWithVideo) {
          session.setCamera(true).catch(() => {});
        }
      },
      onParticipants: setRemotes,
      onLocalState: (st, mic) => {
        setLocalState(st);
        setHasMic(mic);
      },
      onLocalVideo: setLocalVideo,
      onLocalSpeaking: setLocalSpeaking,
      onForceMute: () => flash('Администратор отключил ваш микрофон'),
      onSpeakPermission: (allowed) => {
        setCanSpeak(allowed);
        if (allowed) {
          session.setHand(false);
          flash('Вам разрешили говорить — включите микрофон');
        } else {
          session.setMic(false).catch(() => {});
          flash('Администратор ограничил ваш микрофон');
        }
      },
      onEnded: () => {
        endedRef.current?.();
        closeRef.current();
      }
    });
    sessionRef.current = session;
    session.start().catch((e) => {
      console.warn('Call start failed:', e);
      setStatus('error');
      setStatusError('Не удалось начать звонок.');
    });
    return () => {
      session.leave();
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, roomCode]);

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 3000);
  }

  const toggleMic = async () => {
    const s = sessionRef.current;
    if (!s) return;
    if (!canSpeak && !iAmAdmin) {
      s.setHand(true);
      flash('Вы слушатель. Рука поднята — дождитесь, пока админ даст слово.');
      return;
    }
    const want = !localState.micOn;
    const res = await s.setMic(want);
    if (want && !res) flash('Нет доступа к микрофону. Разрешите его в настройках.');
  };

  const toggleCamera = async () => {
    const s = sessionRef.current;
    if (!s) return;
    const camLikelyOn = localState.videoOn && !localState.screen;
    const res = await s.setCamera(!camLikelyOn);
    if (!camLikelyOn && !res) flash('Нет доступа к камере. Разрешите её в настройках.');
  };

  const toggleScreen = async () => {
    const s = sessionRef.current;
    if (!s) return;
    const res = await s.setScreen(!localState.screen);
    if (!localState.screen && !res) flash('Демонстрация экрана недоступна на этом устройстве.');
  };

  const copyCode = () => {
    try {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      flash(`Код: ${roomCode}`);
    }
  };

  const handleEndOrLeave = () => {
    const s = sessionRef.current;
    if (!isDirect && (isOwner || isAdmin) && status === 'live') {
      s?.endForAll();
      window.setTimeout(() => {
        onEndVideoChat?.();
        onClose();
      }, 250);
      return;
    }
    s?.leave();
    onLeaveVideoChat?.();
    onClose();
  };

  const participants: Card[] = [
    {
      key: 'me',
      isMe: true,
      name: currentAccount.name,
      id: currentAccount.id,
      avatarUri: currentAccount.avatarUri,
      isHost: sessionRef.current?.isHost() ?? false,
      admin: iAmAdmin,
      micOn: localState.micOn,
      videoOn: localState.videoOn,
      screen: localState.screen,
      hand: localState.hand,
      speaking: localSpeaking && localState.micOn,
      stream: localVideo
    },
    ...remotes.map((r) => ({
      key: r.peerId,
      isMe: false,
      name: r.profile.name,
      id: r.profile.id,
      avatarUri: r.profile.avatarUri,
      isHost: r.isHost,
      admin: r.admin,
      peerId: r.peerId,
      micOn: r.micOn,
      videoOn: r.videoOn,
      screen: r.screen,
      hand: r.hand,
      speaking: r.speaking && r.micOn,
      stream: r.stream
    }))
  ];

  const renderTile = (p: Card, size: 'grid' | 'big' | 'small') => {
    const speaking = p.speaking;
    const small = size === 'small';
    return (
      <div
        key={p.key}
        className={`relative overflow-hidden bg-zinc-900 border-2 transition-all flex flex-col items-center justify-center shadow-xl ${
          small ? 'rounded-2xl w-28 h-28 sm:w-36 sm:h-36 shrink-0' : size === 'big' ? 'rounded-3xl w-full aspect-video max-h-[60vh]' : 'rounded-3xl aspect-video'
        } ${speaking ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-zinc-800'}`}
      >
        <MediaEl stream={p.stream} show={p.videoOn} muted={p.isMe} mirror={p.isMe && !p.screen} contain={p.screen} />
        {!p.videoOn && (
          <div className="flex flex-col items-center gap-2">
            <div
              className={`rounded-full overflow-hidden flex items-center justify-center transition-all ${
                small ? 'w-14 h-14' : 'w-20 h-20 sm:w-24 sm:h-24'
              } ${speaking ? 'ring-4 ring-emerald-400 scale-105 shadow-lg shadow-emerald-500/30' : 'ring-2 ring-zinc-700'}`}
            >
              <TelegramAvatar src={p.avatarUri} name={p.name} id={p.id} size="lg" className="w-full h-full text-2xl" />
            </div>
            {!small && <span className="text-sm font-bold text-zinc-100">{p.name}</span>}
          </div>
        )}
        {p.hand && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
            <Hand className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold min-w-0">
            <span className="truncate">{small ? p.name.split(' ')[0] : p.name}</span>
            {p.isMe && !small && <span className="text-sky-400 font-normal">(Вы)</span>}
            {(p.isHost || p.admin) && <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
          </div>
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              p.micOn ? (speaking ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-white') : 'bg-red-500/80 text-white'
            }`}
          >
            {p.micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>
    );
  };

  // Как в Telegram: в трансляции (и когда кто-то показывает экран) — большая «сцена» ведущего + лента остальных
  const screenSharer = participants.find((p) => p.screen);
  const featured =
    isChannel || screenSharer
      ? screenSharer ||
        participants.find((p) => p.videoOn && (p.isHost || p.admin)) ||
        participants.find((p) => p.isHost || p.admin) ||
        participants[0]
      : null;
  const listenersCount = participants.filter((p) => !p.admin && !p.isHost).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-zinc-950 text-white flex flex-col justify-between overflow-hidden animate-in fade-in duration-200 select-none">
      {/* Top Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base sm:text-lg truncate">
                {isDirect ? 'Звонок' : isChannel ? 'Трансляция' : 'Видеочат'} • {chatName}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500 text-white flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">
              {participants.length} участников • Организатор: {videoChatInfo.startedByName || currentAccount.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab((prev) => (prev === 'grid' ? 'participants' : 'grid'))}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'participants' ? 'bg-sky-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Участники</span> ({participants.length})
          </button>

          <button
            type="button"
            onClick={() => {
              sessionRef.current?.leave();
              onLeaveVideoChat?.();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition"
            title="Выйти из эфира"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center relative">
        {notice && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-semibold shadow-lg">
            {notice}
          </div>
        )}

        {status !== 'live' ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
            {status === 'connecting' ? (
              <>
                <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
                <p className="text-sm text-zinc-300">Подключение к эфиру...</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-10 h-10 text-amber-400" />
                <p className="text-sm text-zinc-300">
                  {status === 'not-started'
                    ? 'Эфир ещё не начат. Подождите, пока организатор его запустит, и попробуйте снова.'
                    : statusError || 'Ошибка подключения.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    sessionRef.current?.leave();
                    onClose();
                  }}
                  className="px-5 py-2 rounded-full bg-sky-500 hover:bg-sky-400 text-sm font-semibold"
                >
                  Закрыть
                </button>
              </>
            )}
          </div>
        ) : activeTab === 'grid' ? (
          featured ? (
            <div className="w-full max-w-4xl flex flex-col gap-4 self-start">
              {renderTile(featured, 'big')}
              {isChannel && (
                <p className="text-center text-xs text-zinc-400">
                  {listenersCount} {listenersCount === 1 ? 'слушатель' : 'слушателей'} • Слушатели заходят без микрофона — поднимите руку, чтобы попросить слово
                </p>
              )}
              {participants.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {participants.filter((p) => p.key !== featured.key).map((p) => renderTile(p, 'small'))}
                </div>
              )}
            </div>
          ) : (
            <div className={`w-full max-w-4xl grid grid-cols-1 gap-4 ${participants.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {participants.map((p) => renderTile(p, 'grid'))}
            </div>
          )
        ) : (
          /* Participants List Tab */
          <div className="w-full max-w-lg bg-zinc-900 rounded-3xl p-4 border border-zinc-800 space-y-3">
            <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider px-2">
              Список участников ({participants.length})
            </h3>
            <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
              {participants.map((p) => (
                <div key={p.key} className="py-3 px-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TelegramAvatar src={p.avatarUri} name={p.name} id={p.id} size="md" className="w-10 h-10" />
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-sm">
                        <span>{p.name}</span>
                        {p.isMe && <span className="text-sky-400 text-xs">(Вы)</span>}
                      </div>
                      <span className="text-xs text-zinc-400">{p.isHost || p.admin ? 'Организатор' : isChannel ? 'Слушатель' : 'Участник'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.speaking && <span className="text-xs text-emerald-400 font-medium animate-pulse">Говорит...</span>}
                    {p.hand && <Hand className="w-4 h-4 text-amber-400" />}
                    {iAmAdmin && !p.isMe && p.peerId && isChannel && !p.admin && (p.hand || allowedPeers.has(p.peerId)) && (
                      <button
                        type="button"
                        onClick={() => {
                          const pid = p.peerId as string;
                          const allow = !allowedPeers.has(pid);
                          sessionRef.current?.setSpeaker(pid, allow);
                          setAllowedPeers((prev) => {
                            const n = new Set(prev);
                            if (allow) n.add(pid);
                            else n.delete(pid);
                            return n;
                          });
                        }}
                        className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-semibold hover:bg-sky-500/30"
                      >
                        {allowedPeers.has(p.peerId) ? 'Запретить' : 'Дать слово'}
                      </button>
                    )}
                    {iAmAdmin && !p.isMe && p.peerId && p.micOn && (
                      <button
                        type="button"
                        onClick={() => sessionRef.current?.muteParticipant(p.peerId as string)}
                        className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-[11px] font-semibold hover:bg-red-500/30"
                      >
                        Заглушить
                      </button>
                    )}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        p.micOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {p.micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telegram Controls Bar */}
      <div className="p-4 sm:p-6 bg-zinc-900/90 border-t border-zinc-800/80 backdrop-blur-md flex items-center justify-center gap-4 sm:gap-6 shrink-0">
        {/* Toggle Video */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 shadow-md ${
            (localState.videoOn && !localState.screen)
              ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
          }`}
          title={localState.videoOn && !localState.screen ? 'Выключить камеру' : 'Включить видеокамеру'}
        >
          {localState.videoOn && !localState.screen ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>

        {/* Big Central Microphone Button */}
        <button
          type="button"
          onClick={toggleMic}
          className={`w-18 h-18 rounded-full flex items-center justify-center transition active:scale-90 shadow-xl ${
            localState.micOn
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/40 ring-4 ring-emerald-500/20'
              : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/40'
          }`}
          title={localState.micOn ? 'Выключить микрофон' : hasMic || !isListenerOnly ? 'Включить микрофон' : 'Включить микрофон (слушатель)'}
        >
          {localState.micOn ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
        </button>

        {/* Raise hand */}
        <button
          type="button"
          onClick={() => sessionRef.current?.setHand(!localState.hand)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 shadow-md ${
            localState.hand
              ? 'bg-amber-500 text-white shadow-amber-500/30 animate-bounce'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
          }`}
          title={localState.hand ? 'Опустить руку' : 'Поднять руку'}
        >
          <Hand className="w-6 h-6" />
        </button>

        {/* Screen share */}
        <button
          type="button"
          onClick={toggleScreen}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 shadow-md ${
            localState.screen
              ? 'bg-sky-500 text-white shadow-sky-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hidden sm:flex'
          }`}
          title="Транслировать экран"
        >
          <Monitor className="w-6 h-6" />
        </button>

        {/* Leave or End Call */}
        <button
          type="button"
          onClick={handleEndOrLeave}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition"
          title={!isDirect && (isAdmin || isOwner) ? 'Завершить для всех' : 'Покинуть'}
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
