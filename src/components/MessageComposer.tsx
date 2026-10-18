import React, { useState, useRef, useEffect } from 'react';
import { Poll, MessageReplyInfo, ChatPermissions } from '../types';
import { PollCreatorModal } from './PollCreatorModal';
import { VideoNoteRecorderModal } from './VideoNoteRecorderModal';
import {
  Send,
  Image,
  Video,
  Smile,
  BarChart2,
  X,
  Radio,
  Lock,
  Music,
  Paperclip,
  CircleDot,
  Camera,
  FileText,
  MapPin,
  ArrowLeft,
  Mic,
  Trash2,
  Bell,
  BellOff,
  UserPlus
} from 'lucide-react';

interface MessageComposerProps {
  canPost?: boolean;
  isAdmin?: boolean;
  isChannel?: boolean;
  isGroup?: boolean;
  channelOrGroupName?: string;
  senderName?: string;
  isSubscribed?: boolean;
  isMuted?: boolean;
  permissions?: ChatPermissions;
  slowModeSeconds?: number;
  cooldownRemaining?: number;
  replyToMessage?: MessageReplyInfo | null;
  onClearReply?: () => void;
  onToggleMute?: () => void;
  onSubscribe?: () => void;
  onBack?: () => void;
  onSend: (
    text: string,
    attachmentUri?: string | null,
    videoUri?: string | null,
    asChannel?: boolean,
    poll?: Poll,
    videoNoteUri?: string | null,
    audioUri?: string | null,
    fileUri?: string | null,
    fileName?: string,
    fileSize?: string
  ) => void;
}

const SAMPLE_STICKERS = [
  '🎉', '🚀', '🔥', '👍', '❤️', '💯', '✨', '👋', '🤖', '☕',
  '⚡', '💡', '😎', '🫡', '👏', '🎯', '🥳', '🙌', '🌟', '💎'
];

function generateFallbackVoiceBlob(seconds: number): Blob {
  const sampleRate = 8000;
  const numSamples = sampleRate * Math.max(1, seconds);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // Write WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples, true);

  for (let i = 0; i < numSamples; i++) {
    const freq = 200 + Math.sin(i / 150) * 80;
    const sample = 128 + Math.round(35 * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    view.setUint8(44 + i, sample);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  canPost = true,
  isAdmin = false,
  isChannel = false,
  isGroup = false,
  channelOrGroupName,
  senderName,
  isSubscribed = true,
  isMuted = false,
  permissions,
  slowModeSeconds = 0,
  cooldownRemaining = 0,
  replyToMessage,
  onClearReply,
  onToggleMute,
  onSubscribe,
  onBack,
  onSend
}) => {
  const [text, setText] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideoNote, setSelectedVideoNote] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size: string } | null>(null);
  const [asChannel, setAsChannel] = useState(isChannel);
  const [showStickers, setShowStickers] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showVideoNoteModal, setShowVideoNoteModal] = useState(false);

  // Toggle mode: voice message (mic) or video note (circular video note)
  const [mediaRecordMode, setMediaRecordMode] = useState<'voice' | 'video_note'>('voice');

  // Live voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0); // in seconds
  const [restrictionNotice, setRestrictionNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoNoteInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<any>(null);

  // Clean up recording stream on unmount
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Check permissions: if not admin, apply chat restrictions
  const canSendMessages = isAdmin || permissions?.sendMessages !== false;
  const canSendPolls = isAdmin || permissions?.sendPolls !== false;

  // If user cannot post (e.g. subscriber in a channel, or general post restriction):
  if (!canPost || !canSendMessages) {
    if (isChannel) {
      return (
        <div className="bg-white dark:bg-[#17212b] border-t border-gray-200 dark:border-zinc-800 p-3 select-none">
          <div className="max-w-md mx-auto flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
              <Radio className="w-3.5 h-3.5 text-sky-500" />
              <span>Только администраторы могут публиковать в канале</span>
            </div>

            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2">
              {isSubscribed ? (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`w-full max-w-sm py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer ${
                    isMuted
                      ? 'bg-sky-500 hover:bg-sky-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <Bell className="w-4 h-4" />
                      <span>ВКЛЮЧИТЬ УВЕДОМЛЕНИЯ</span>
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4" />
                      <span>ОТКЛЮЧИТЬ УВЕДОМЛЕНИЯ</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubscribe}
                  className="w-full max-w-sm py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>ПОДПИСАТЬСЯ НА КАНАЛ</span>
                </button>
              )}

              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full max-w-sm py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer border border-gray-200 dark:border-zinc-700"
                >
                  <ArrowLeft className="w-4 h-4 text-sky-500" />
                  <span>ВЫЙТИ К СПИСКУ ЧАТОВ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Restricted group view
    return (
      <div className="bg-gray-100 dark:bg-[#17212b] border-t border-gray-200 dark:border-zinc-800 p-3.5 text-center text-xs text-gray-500 dark:text-zinc-400 font-medium flex flex-col items-center justify-center gap-2 select-none">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-400" />
          <span>Администраторы ограничили отправку сообщений в этой группе</span>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-sky-500 hover:bg-sky-50 transition active:scale-95 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Выйти к списку чатов</span>
          </button>
        )}
      </div>
    );
  }

  const showPermissionError = (msg: string) => {
    setRestrictionNotice(msg);
    setTimeout(() => setRestrictionNotice(null), 3500);
  };

  // ================= VOICE RECORDING FUNCTIONS =================
  const startVoiceRecording = async () => {
    try {
      setIsRecordingVoice(true);
      setVoiceDuration(0);
      audioChunksRef.current = [];

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(200);
      }
    } catch (err) {
      console.warn('Microphone permission not granted or unavailable, using simulated voice recorder:', err);
    }

    voiceTimerRef.current = setInterval(() => {
      setVoiceDuration((prev) => prev + 1);
    }, 1000);
  };

  const cancelVoiceRecording = () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecordingVoice(false);
    setVoiceDuration(0);
  };

  const stopAndSendVoice = () => {
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);

    const durSecs = Math.max(1, voiceDuration);
    const mins = Math.floor(durSecs / 60);
    const secs = durSecs % 60;
    const formattedDuration = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        try {
          const mime = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mime });
          const audioUri = URL.createObjectURL(audioBlob);
          onSend('', null, null, asChannel, undefined, null, audioUri, null, 'Голосовое сообщение', formattedDuration);
        } catch (e) {
          const fallbackBlob = generateFallbackVoiceBlob(durSecs);
          const audioUri = URL.createObjectURL(fallbackBlob);
          onSend('', null, null, asChannel, undefined, null, audioUri, null, 'Голосовое сообщение', formattedDuration);
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      try {
        recorder.stop();
      } catch (e) {
        const fallbackBlob = generateFallbackVoiceBlob(durSecs);
        const audioUri = URL.createObjectURL(fallbackBlob);
        onSend('', null, null, asChannel, undefined, null, audioUri, null, 'Голосовое сообщение', formattedDuration);
      }
    } else {
      // Fallback valid WAV blob
      const fallbackBlob = generateFallbackVoiceBlob(durSecs);
      const audioUri = URL.createObjectURL(fallbackBlob);
      onSend('', null, null, asChannel, undefined, null, audioUri, null, 'Голосовое сообщение', formattedDuration);
    }

    setIsRecordingVoice(false);
    setVoiceDuration(0);
  };

  const handleSend = () => {
    if (cooldownRemaining > 0 && !isAdmin) {
      showPermissionError(`Медленный режим: подождите ещё ${cooldownRemaining} сек.`);
      return;
    }

    if (!text.trim() && !selectedPhoto && !selectedVideo && !selectedVideoNote && !selectedAudio && !selectedFile) {
      return;
    }

    onSend(
      text.trim(),
      selectedPhoto,
      selectedVideo,
      asChannel,
      undefined,
      selectedVideoNote,
      selectedAudio,
      selectedFile?.uri,
      selectedFile?.name,
      selectedFile?.size
    );

    setText('');
    setSelectedPhoto(null);
    setSelectedVideo(null);
    setSelectedVideoNote(null);
    setSelectedAudio(null);
    setSelectedFile(null);
    setShowStickers(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (onClearReply) onClearReply();
  };

  const handleCreatePoll = (poll: Poll) => {
    if (!canSendPolls) {
      showPermissionError('В этой беседе запрещено создавать опросы');
      return;
    }
    onSend('', null, null, asChannel, poll);
    setShowPollModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedVideo(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleVideoNoteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedVideoNote(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedAudio(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        uri: reader.result as string,
        name: file.name,
        size: sizeStr
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendLocation = () => {
    setShowAttachmentMenu(false);
    const locText = `📍 Геолокация: 55.7558° N, 37.6173° E (Центр города)`;
    onSend(locText, null, null, asChannel);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m > 0 ? `${m}м ` : ''}${s}с`;
  };

  const hasContentToSend =
    text.trim().length > 0 ||
    Boolean(selectedPhoto) ||
    Boolean(selectedVideo) ||
    Boolean(selectedVideoNote) ||
    Boolean(selectedAudio) ||
    Boolean(selectedFile);

  return (
    <div className="px-2 py-2 transition-colors relative select-none">
      {/* Slow mode or restriction alert notice */}
      {restrictionNotice && (
        <div className="absolute -top-10 left-3 right-3 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-2 z-40">
          <span>{restrictionNotice}</span>
          <button onClick={() => setRestrictionNotice(null)} className="p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quoted Message Preview banner */}
      {replyToMessage && (
        <div className="mb-2 p-2 bg-gray-50 dark:bg-zinc-800/80 rounded-xl border-l-4 border-sky-500 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-sky-500 block truncate">
              Ответ для {replyToMessage.senderName}
            </span>
            <span className="text-xs text-gray-600 dark:text-zinc-300 truncate block">
              {replyToMessage.text}
            </span>
          </div>
          {onClearReply && (
            <button
              type="button"
              onClick={onClearReply}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition"
              title="Отменить ответ"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Media Attachments Preview row */}
      {(selectedPhoto || selectedVideo || selectedVideoNote || selectedAudio || selectedFile) && (
        <div className="mb-2 p-2 bg-gray-50 dark:bg-zinc-800/60 rounded-2xl flex flex-wrap items-center gap-2 border border-gray-200 dark:border-zinc-700/60">
          {selectedPhoto && (
            <div className="relative group rounded-xl overflow-hidden border border-gray-300 dark:border-zinc-600">
              <img src={selectedPhoto} alt="Selected" className="w-16 h-16 object-cover" />
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {selectedVideo && (
            <div className="relative group rounded-xl overflow-hidden border border-gray-300 dark:border-zinc-600 bg-black w-16 h-16 flex items-center justify-center">
              <video src={selectedVideo} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {selectedVideoNote && (
            <div className="relative group rounded-full overflow-hidden border-2 border-sky-400 w-16 h-16 bg-black flex items-center justify-center shadow-md">
              <video src={selectedVideoNote} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setSelectedVideoNote(null)}
                className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 hover:bg-black transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {selectedAudio && (
            <div className="relative flex items-center gap-2 bg-white dark:bg-zinc-700 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-600 text-xs">
              <Music className="w-4 h-4 text-sky-500" />
              <span className="font-semibold text-gray-800 dark:text-zinc-200">Аудиозапись</span>
              <button
                type="button"
                onClick={() => setSelectedAudio(null)}
                className="p-0.5 text-gray-400 hover:text-rose-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {selectedFile && (
            <div className="relative flex items-center gap-2 bg-white dark:bg-zinc-700 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-600 text-xs">
              <FileText className="w-4 h-4 text-sky-500" />
              <div className="min-w-0 max-w-[150px]">
                <p className="font-semibold truncate text-gray-900 dark:text-zinc-100">{selectedFile.name}</p>
                <p className="text-[10px] text-gray-400">{selectedFile.size}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="p-1 text-gray-400 hover:text-rose-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stickers / Emoji panel */}
      {showStickers && (
        <div className="mb-2 p-2.5 bg-gray-50 dark:bg-zinc-850 rounded-2xl border border-gray-200 dark:border-zinc-700 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Эмодзи и стикеры</span>
            <button
              type="button"
              onClick={() => setShowStickers(false)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
            {SAMPLE_STICKERS.map((stk, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setText((prev) => prev + stk);
                  textareaRef.current?.focus();
                }}
                className="h-10 text-2xl flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 rounded-xl transition active:scale-125 cursor-pointer"
              >
                {stk}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file inputs for attachments */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
      <input type="file" ref={videoInputRef} onChange={handleVideoUpload} accept="video/*" className="hidden" />
      <input type="file" ref={videoNoteInputRef} onChange={handleVideoNoteUpload} accept="video/*" className="hidden" />
      <input type="file" ref={audioInputRef} onChange={handleAudioUpload} accept="audio/*" className="hidden" />
      <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleDocUpload} accept="*/*" className="hidden" />

      {/* ================= COMPOSER BAR ================= */}
      {isRecordingVoice ? (
        /* LIVE TELEGRAM VOICE RECORDER BAR */
        <div className="flex items-center gap-2 bg-[#2AABEE]/10 dark:bg-[#182533] rounded-[24px] px-3 py-1.5 border border-sky-400/50 animate-in fade-in">
          {/* Pulsing red dot and recording timer */}
          <div className="flex items-center gap-2 min-w-[70px]">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-xs font-mono font-bold text-red-500">
              {Math.floor(voiceDuration / 60)}:{(voiceDuration % 60) < 10 ? '0' : ''}{voiceDuration % 60}
            </span>
          </div>

          {/* Animated Waveform Visualization */}
          <div className="flex-1 flex items-center justify-center gap-1 h-8 px-2 overflow-hidden">
            {[4, 10, 18, 12, 6, 14, 22, 16, 8, 12, 20, 15, 7, 18, 24, 10, 6, 12, 16, 9].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-[#2AABEE] rounded-full animate-pulse"
                style={{
                  height: `${Math.max(4, (h * ((voiceDuration % 3) + 1)) % 26)}px`,
                  animationDuration: `${0.4 + (i % 4) * 0.2}s`
                }}
              />
            ))}
          </div>

          {/* Cancel button */}
          <button
            type="button"
            onClick={cancelVoiceRecording}
            className="w-9 h-9 flex items-center justify-center rounded-full text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition active:scale-90 cursor-pointer"
            title="Отменить запись"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Send voice button */}
          <button
            type="button"
            onClick={stopAndSendVoice}
            className="w-10 h-10 rounded-full bg-[#2AABEE] hover:bg-[#229ED9] text-white flex items-center justify-center shadow-md shadow-sky-500/30 transition active:scale-90 cursor-pointer"
            title="Отправить голосовое сообщение"
          >
            <Send className="w-5 h-5 ml-0.5 fill-white text-white" />
          </button>
        </div>
      ) : (
        /* STANDARD TELEGRAM INPUT BAR */
        <div className="flex items-end gap-2">
          {/* Rounded Input Capsule containing Emoji + Textarea + Paperclip */}
          <div className="flex-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[26px] flex items-end px-1.5 py-1 shadow-md shadow-black/10 transition-all">
            {/* Emoji button on the left inside the capsule */}
            <button
              type="button"
              onClick={() => setShowStickers(!showStickers)}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition active:scale-90 shrink-0 cursor-pointer ${
                showStickers
                  ? 'text-sky-500 bg-sky-50 dark:bg-sky-950/50'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200'
              }`}
              title="Эмодзи и стикеры"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Auto-expanding text input */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedPhoto || selectedVideo
                  ? 'Добавить подпись...'
                  : isChannel
                  ? 'Опубликовать пост в канал...'
                  : asChannel
                  ? `От лица ${channelOrGroupName}...`
                  : 'Сообщение...'
              }
              className="flex-1 bg-transparent text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 text-[15px] sm:text-base outline-none px-2.5 py-2 resize-none min-h-[40px] max-h-36 leading-normal"
            />

            {/* Paperclip (Скрепка) button inside the capsule on the right */}
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(true)}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition active:scale-90 shrink-0 relative cursor-pointer ${
                selectedPhoto || selectedVideo || selectedVideoNote || selectedAudio || selectedFile
                  ? 'text-sky-500 bg-sky-50 dark:bg-sky-950/60 ring-2 ring-sky-400'
                  : 'text-gray-400 hover:text-sky-500'
              }`}
              title="Прикрепить фото, видео, файл или опрос (Скрепка)"
            >
              <Paperclip className="w-5 h-5 -rotate-45 stroke-[2.2]" />
              {(selectedPhoto || selectedVideo || selectedVideoNote || selectedAudio || selectedFile) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-white dark:ring-zinc-800" />
              )}
            </button>
          </div>

          {/* Right side circular action button */}
          {hasContentToSend ? (
            <button
              type="button"
              onClick={handleSend}
              disabled={cooldownRemaining > 0 && !isAdmin}
              className={`w-14 h-14 rounded-full font-bold flex items-center justify-center transition active:scale-90 shrink-0 shadow-lg cursor-pointer ${
                cooldownRemaining > 0 && !isAdmin
                  ? 'bg-amber-500 text-white text-xs'
                  : 'bg-[#3390ec] text-white shadow-black/20'
              }`}
              title={
                cooldownRemaining > 0 && !isAdmin
                  ? `Медленный режим: ${formatCooldown(cooldownRemaining)}`
                  : isChannel
                  ? 'Опубликовать'
                  : 'Отправить'
              }
            >
              {cooldownRemaining > 0 && !isAdmin ? (
                <span>{formatCooldown(cooldownRemaining)}</span>
              ) : (
                <Send className="w-5 h-5 ml-0.5 fill-white text-white" />
              )}
            </button>
          ) : (
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (mediaRecordMode === 'voice') {
                    startVoiceRecording();
                  } else {
                    setShowVideoNoteModal(true);
                  }
                }}
                className="w-14 h-14 rounded-full bg-[#3390ec] active:scale-90 text-white flex items-center justify-center shadow-lg shadow-black/20 transition shrink-0 cursor-pointer"
                title={mediaRecordMode === 'voice' ? "Записать голосовое сообщение" : "Записать кружочек (Видеосообщение)"}
              >
                {mediaRecordMode === 'voice' ? (
                  <Mic className="w-5 h-5 fill-white text-white" />
                ) : (
                  <Video className="w-5 h-5 fill-white text-white" />
                )}
              </button>

              {/* Quick Telegram Mode Switch Badge (Mic / Video Note) */}
              <button
                type="button"
                onClick={() => setMediaRecordMode((prev) => (prev === 'voice' ? 'video_note' : 'voice'))}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-zinc-800 border border-sky-400 text-sky-500 flex items-center justify-center shadow-xs text-[10px] hover:scale-110 active:scale-90 transition cursor-pointer"
                title="Переключить: голос / кружочек"
              >
                {mediaRecordMode === 'voice' ? '🎤' : '📹'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= TELEGRAM ATTACHMENT BOTTOM SHEET ================= */}
      {showAttachmentMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            onClick={() => setShowAttachmentMenu(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-55 max-w-lg mx-auto bg-white dark:bg-[#17212b] rounded-t-3xl border-t border-gray-200 dark:border-zinc-800 p-4 pb-7 shadow-2xl animate-in slide-in-from-bottom duration-200 select-none">
            {/* Drag Handle */}
            <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mb-3" />

            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-sky-500 -rotate-45" />
                <span className="text-xs font-bold text-gray-700 dark:text-zinc-200 uppercase tracking-wider">
                  Прикрепить к сообщению
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAttachmentMenu(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of Telegram Action Items */}
            <div className="grid grid-cols-4 gap-3 py-1">
              {/* Галерея (Фото и видео) */}
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-500 to-sky-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
                  <Image className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Галерея</span>
              </button>

              {/* Камера */}
              <button
                type="button"
                onClick={() => {
                  cameraInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Камера</span>
              </button>

              {/* Файл */}
              <button
                type="button"
                onClick={() => {
                  docInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Файл</span>
              </button>

              {/* Голосовое сообщение */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false);
                  setMediaRecordMode('voice');
                  startVoiceRecording();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
                  <Mic className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Голосовое</span>
              </button>

              {/* Кружочек (Видеосообщение как в ТГ) */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false);
                  setShowVideoNoteModal(true);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <CircleDot className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Кружочек</span>
              </button>

              {/* Опрос */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false);
                  setShowPollModal(true);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <BarChart2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Опрос</span>
              </button>

              {/* Музыка */}
              <button
                type="button"
                onClick={() => {
                  audioInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-pink-500/25">
                  <Music className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Музыка</span>
              </button>

              {/* Геолокация */}
              <button
                type="button"
                onClick={handleSendLocation}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-green-500/25">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Локация</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Poll Creator Modal */}
      <PollCreatorModal
        isOpen={showPollModal}
        language="ru"
        onClose={() => setShowPollModal(false)}
        onCreatePoll={handleCreatePoll}
      />

      {/* Telegram Video Note Recorder (Кружочек) Modal */}
      <VideoNoteRecorderModal
        isOpen={showVideoNoteModal}
        onClose={() => setShowVideoNoteModal(false)}
        onSendVideoNote={(videoNoteUri) => {
          onSend('', null, null, asChannel, undefined, videoNoteUri);
        }}
      />
    </div>
  );
};
