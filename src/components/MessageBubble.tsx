import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatType } from '../types';
import {
  CheckCheck,
  Eye,
  MessageSquare,
  Pin,
  Smile,
  CornerUpLeft,
  FileText,
  Download,
  Play,
  Pause,
  MapPin,
  BarChart2,
  CheckCircle2,
  Circle
} from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  chatType?: ChatType;
  currentUserId: number;
  onReact?: (messageId: number, emoji: string) => void;
  onVotePoll?: (messageId: number, optionId: number) => void;
  onOpenComments?: (message: Message) => void;
  onPinMessage?: (messageId: number) => void;
  onReplyMessage?: (message: Message) => void;
}

const COMMON_REACTIONS = ['👍', '❤️', '🔥', '😂', '👏', '🎉', '⚡'];

// Preset waveform heights for authentic Telegram voice messages
const WAVEFORM_BARS = [
  6, 12, 22, 16, 8, 14, 28, 20, 10, 18, 30, 24, 12, 16, 26, 32, 18, 10, 22, 28, 14, 8, 16, 24, 12, 6, 18, 10
];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  chatType = 'direct',
  currentUserId,
  onReact,
  onVotePoll,
  onOpenComments,
  onPinMessage,
  onReplyMessage
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); // 0 to 1
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>(
    message.voiceDuration || '0:05'
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isChannel = chatType === 'channel';
  const isGroup = chatType === 'group';
  const isMine = message.isMine;

  const reactions = message.reactions || {};
  const myReaction = message.userReactions?.[currentUserId];
  const poll = message.poll;
  const commentsCount = message.comments?.length || 0;

  // Handle voice/audio playback
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch((e) => {
        console.warn('Audio playback error:', e);
        // Fallback simulated playback for preview environments
        simulatePlayback();
      });
    }
  };

  const simulatePlayback = () => {
    setIsPlayingAudio(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 0.05;
      if (p >= 1) {
        clearInterval(interval);
        setIsPlayingAudio(false);
        setAudioProgress(0);
        setCurrentTimeDisplay(message.voiceDuration || '0:00');
      } else {
        setAudioProgress(p);
        const secs = Math.floor(p * 15);
        setCurrentTimeDisplay(`0:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 250);
  };

  const cycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        const prog = audio.currentTime / audio.duration;
        setAudioProgress(prog);
        const mins = Math.floor(audio.currentTime / 60);
        const secs = Math.floor(audio.currentTime % 60);
        setCurrentTimeDisplay(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    };

    const handleEnded = () => {
      setIsPlayingAudio(false);
      setAudioProgress(0);
      setCurrentTimeDisplay(message.voiceDuration || '0:00');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // 1. TELEGRAM CIRCULAR VIDEO NOTE (Кружочек)
  if (message.videoNoteUri) {
    return (
      <div className={`group relative flex w-full ${isMine ? 'justify-end' : 'justify-start'} my-2 px-2 select-none`}>
        <div className="relative">
          <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-full overflow-hidden border-2 border-sky-400 shadow-xl bg-black relative flex items-center justify-center">
            <video
              src={message.videoNoteUri}
              controls
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* Floating Telegram time badge */}
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <span>{message.time}</span>
            {isMine && <CheckCheck className="w-3 h-3 text-sky-400" />}
          </div>

          {/* Floating Actions on Hover */}
          <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-zinc-900/90 text-white rounded-full px-2 py-0.5 shadow-md">
            {onReplyMessage && (
              <button
                type="button"
                onClick={() => onReplyMessage(message)}
                className="p-1 hover:text-sky-400 transition cursor-pointer"
                title="Ответить"
              >
                <CornerUpLeft className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="p-1 hover:text-amber-400 transition cursor-pointer"
              title="Реакция"
            >
              <Smile className="w-3 h-3" />
            </button>
          </div>

          {/* Reactions Picker */}
          {showReactionPicker && (
            <div className="absolute -top-10 right-0 z-30 bg-zinc-900 text-white rounded-full shadow-xl border border-zinc-700 px-2 py-1 flex items-center gap-1.5 animate-in fade-in">
              {COMMON_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    if (onReact) onReact(message.id, emoji);
                    setShowReactionPicker(false);
                  }}
                  className="text-sm hover:scale-125 transition cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. AUTHENTIC TELEGRAM MESSAGE BUBBLE
  // Colors & corner radiuses from genuine Telegram Android:
  // - Outgoing: Soft green in light mode (#EFFEDD), Slate Navy in dark mode (#2B5278)
  // - Incoming: Crisp White in light mode (#FFFFFF), Dark Slate in dark mode (#182533)
  // - Channel: Full elegant card in #182533 (dark) or #FFFFFF (light)
  const isVoiceMessage = Boolean(message.isVoice || (message.audioUri && !message.fileName?.endsWith('.mp3')));

  const bubbleBgClass = isChannel
    ? 'bg-white dark:bg-[#182533] text-gray-900 dark:text-[#E4ECF2] border border-gray-200/80 dark:border-zinc-800/80 shadow-xs'
    : isMine
    ? 'bg-[#EFFEDD] dark:bg-[#3b9bf0] text-gray-950 dark:text-white shadow-sm shadow-black/5'
    : 'bg-white dark:bg-[#243142] text-gray-900 dark:text-[#E4ECF2] shadow-sm shadow-black/5';

  return (
    <div
      className={`group relative flex w-full ${
        isChannel ? 'justify-start' : isMine ? 'justify-end' : 'justify-start'
      } my-1 px-1 sm:px-2 select-none`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[76%] rounded-[18px] px-3 py-1.5 transition-all relative ${bubbleBgClass} ${
          isMine && !isChannel ? 'rounded-br-xs' : 'rounded-bl-xs'
        }`}
      >
        {/* Pinned banner indicator */}
        {message.isPinned && (
          <div className="flex items-center gap-1 text-[10px] text-amber-500 dark:text-amber-400 font-bold mb-1 pb-1 border-b border-gray-100 dark:border-zinc-700/50">
            <Pin className="w-3 h-3 rotate-45" />
            <span>Закреплено</span>
          </div>
        )}

        {/* Quoted reply message header */}
        {message.replyTo && (
          <div
            className={`mb-1.5 px-2.5 py-1 rounded-lg border-l-2 text-xs select-none ${
              isMine && !isChannel
                ? 'bg-black/5 dark:bg-white/10 border-sky-500'
                : 'bg-black/5 dark:bg-white/5 border-sky-500'
            }`}
          >
            <p className="font-bold text-[11px] text-sky-500 dark:text-sky-400 truncate">
              {message.replyTo.senderName}
            </p>
            <p className="text-[10px] truncate opacity-80">{message.replyTo.text}</p>
          </div>
        )}

        {/* Sender name in Channels & Groups (Crisp Telegram blue/cyan text, NO heavy shields!) */}
        {((isChannel && message.senderName) || (isGroup && !isMine && message.senderName)) && (
          <p className="text-[13px] font-bold text-[#2AABEE] dark:text-[#40B4F7] mb-1 leading-snug">
            {message.senderName}
          </p>
        )}

        {/* Image Attachment */}
        {message.attachmentUri && (
          <div className="mb-2 overflow-hidden rounded-xl">
            <img
              src={message.attachmentUri}
              alt="attachment"
              className="w-full max-h-80 object-cover rounded-xl hover:opacity-95 transition cursor-pointer"
              loading="lazy"
            />
          </div>
        )}

        {/* Video Attachment */}
        {message.videoUri && (
          <div className="mb-2 overflow-hidden rounded-xl bg-black">
            <video
              src={message.videoUri}
              controls
              className="w-full max-h-80 rounded-xl object-contain"
            />
          </div>
        )}

        {/* ================= TELEGRAM VOICE MESSAGE PLAYER ================= */}
        {message.audioUri && (
          <div className="my-1.5 py-1 flex items-center gap-3">
            <audio ref={audioRef} src={message.audioUri} preload="metadata" />

            {/* Play/Pause Circle Button */}
            <button
              type="button"
              onClick={togglePlayAudio}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition active:scale-90 shadow-md cursor-pointer ${
                isMine && !isChannel
                  ? 'bg-sky-500 hover:bg-sky-600 text-white'
                  : 'bg-[#2AABEE] hover:bg-[#229ED9] text-white'
              }`}
              title={isPlayingAudio ? 'Пауза' : 'Слушать голосовое сообщение'}
            >
              {isPlayingAudio ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 ml-0.5 fill-white" />
              )}
            </button>

            {/* Waveform & Duration */}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              {/* Telegram Waveform Bars */}
              <div
                className="flex items-center gap-[2px] h-6 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const newProg = Math.max(0, Math.min(1, clickX / rect.width));
                  setAudioProgress(newProg);
                  if (audioRef.current && audioRef.current.duration) {
                    audioRef.current.currentTime = newProg * audioRef.current.duration;
                  }
                }}
              >
                {WAVEFORM_BARS.map((height, i) => {
                  const barThreshold = (i + 1) / WAVEFORM_BARS.length;
                  const isFilled = audioProgress >= barThreshold;
                  return (
                    <div
                      key={i}
                      className={`w-[2.5px] rounded-full transition-colors ${
                        isFilled
                          ? isMine && !isChannel
                            ? 'bg-sky-500 dark:bg-sky-300'
                            : 'bg-sky-500 dark:bg-sky-400'
                          : isMine && !isChannel
                          ? 'bg-sky-900/20 dark:bg-white/30'
                          : 'bg-gray-300 dark:bg-white/25'
                      }`}
                      style={{ height: `${height}px` }}
                    />
                  );
                })}
              </div>

              {/* Sub-row: Duration and Speed Switcher */}
              <div className="flex items-center justify-between text-[11px] font-medium opacity-80 mt-1 select-none">
                <span className="font-mono">{currentTimeDisplay}</span>
                <button
                  type="button"
                  onClick={cycleSpeed}
                  className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px] font-bold hover:bg-black/15 transition cursor-pointer"
                  title="Скорость воспроизведения"
                >
                  {playbackSpeed}X
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File document attachment (Authentic Telegram Round Icon Style) */}
        {message.fileUri && !message.audioUri && (
          <div className="my-1.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">
                  {message.fileName || 'Документ'}
                </p>
                <p className="text-[10px] opacity-75">
                  {message.fileSize || 'Файл'}
                </p>
              </div>
            </div>
            <a
              href={message.fileUri}
              download={message.fileName || 'file'}
              className="w-8 h-8 rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 flex items-center justify-center shrink-0 transition"
              title="Скачать файл"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Poll Renderer */}
        {poll && (
          <div className="my-1.5 p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-sky-500" />
              <h4 className="text-xs font-bold leading-tight select-text">
                {poll.question}
              </h4>
            </div>

            <div className="space-y-1.5">
              {poll.options.map((option) => {
                const isSelected = option.votedUserIds.includes(currentUserId);
                const percentage =
                  poll.totalVotes > 0
                    ? Math.round((option.votes / poll.totalVotes) * 100)
                    : 0;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onVotePoll && onVotePoll(message.id, option.id)}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition relative overflow-hidden flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/10 font-bold text-sky-600 dark:text-sky-300'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {poll.totalVotes > 0 && (
                      <div
                        className="absolute inset-y-0 left-0 bg-sky-500/15 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    )}
                    <div className="flex items-center gap-2 relative z-10 min-w-0">
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 opacity-40 shrink-0" />
                      )}
                      <span className="truncate">{option.text}</span>
                    </div>
                    <span className="relative z-10 text-[11px] font-mono opacity-80 shrink-0">
                      {percentage}%
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] opacity-70 pt-0.5">
              <span>{poll.totalVotes} голосов</span>
              <span>{poll.allowsMultiple ? 'Выбор нескольких' : 'Один ответ'}</span>
            </div>
          </div>
        )}

        {/* Text */}
        {message.text && (
          <p className="leading-relaxed break-words whitespace-pre-wrap select-text text-[14px]">
            {message.text}
          </p>
        )}

        {/* Reactions Counter Row */}
        {Object.keys(reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 pt-1">
            {Object.entries(reactions).map(([emoji, count]) => {
              if (count <= 0) return null;
              const isSelected = myReaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact && onReact(message.id, emoji)}
                  className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500 text-white border-sky-500 shadow-xs font-bold'
                      : 'bg-black/5 dark:bg-white/10 border-transparent text-gray-700 dark:text-zinc-200'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer: Views, Comments, Time and Delivery Checks */}
        <div className="flex items-center justify-between gap-3 mt-1 pt-0.5 text-[11px] select-none opacity-70">
          <div className="flex items-center gap-2.5">
            {/* Channel Views */}
            {isChannel && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>{message.views || 1}</span>
              </span>
            )}

            {/* Telegram Channel "Обсудить" / Comments button */}
            {isChannel && onOpenComments && (
              <button
                type="button"
                onClick={() => onOpenComments(message)}
                className="flex items-center gap-1 text-[#2AABEE] dark:text-[#40B4F7] font-semibold hover:underline active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>
                  {commentsCount > 0 ? `Комментарии (${commentsCount})` : 'Обсудить'}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px]">{message.time}</span>
            {isMine && !isChannel && (
              <CheckCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-300" />
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Menu on Hover */}
      <div
        className={`absolute -top-3 ${
          isMine ? 'right-2' : 'left-2'
        } opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full px-1 py-0.5 shadow-md z-20`}
      >
        <button
          type="button"
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 rounded-full transition cursor-pointer"
          title="Реакция"
        >
          <Smile className="w-3.5 h-3.5 text-amber-500" />
        </button>

        {onReplyMessage && (
          <button
            type="button"
            onClick={() => onReplyMessage(message)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 rounded-full transition cursor-pointer"
            title="Ответить"
          >
            <CornerUpLeft className="w-3.5 h-3.5 text-sky-500" />
          </button>
        )}

        {onPinMessage && (
          <button
            type="button"
            onClick={() => onPinMessage(message.id)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 rounded-full transition cursor-pointer"
            title={message.isPinned ? 'Открепить' : 'Закрепить'}
          >
            <Pin className={`w-3.5 h-3.5 ${message.isPinned ? 'text-amber-500' : 'text-gray-400'}`} />
          </button>
        )}
      </div>

      {/* Reactions Picker Popup */}
      {showReactionPicker && (
        <div
          className={`absolute -top-10 ${
            isMine ? 'right-4' : 'left-4'
          } z-30 bg-white dark:bg-zinc-800 rounded-full shadow-xl border border-gray-200 dark:border-zinc-700 px-2 py-1 flex items-center gap-1.5 animate-in fade-in zoom-in-90`}
        >
          {COMMON_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                if (onReact) onReact(message.id, emoji);
                setShowReactionPicker(false);
              }}
              className="text-base hover:scale-130 transition active:scale-95 p-0.5 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
