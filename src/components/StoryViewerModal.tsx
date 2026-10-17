import React, { useState, useEffect, useRef } from 'react';
import { Story, Language } from '../types';
import { getT } from '../translations';
import {
  X,
  Trash2,
  Eye,
  Send,
  Heart,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare
} from 'lucide-react';

interface StoryViewerModalProps {
  isOpen: boolean;
  stories: Story[];
  initialIndex?: number;
  currentUserId?: number;
  language: Language;
  onClose: () => void;
  onDeleteStory: (storyId: number) => void;
  onReactStory?: (storyId: number, emoji: string) => void;
  onReplyToStory?: (story: Story, replyText: string) => void;
}

const STORY_DURATION_MS = 6000;
const REACTION_EMOJIS = ['❤️', '🔥', '👍', '😮', '😂', '🎉'];

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  stories,
  initialIndex = 0,
  currentUserId,
  language,
  onClose,
  onDeleteStory,
  onReactStory,
  onReplyToStory
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [floatingReaction, setFloatingReaction] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedProgressRef = useRef<number>(0);
  const t = getT(language);

  // Sync index when initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(initialIndex, 0), stories.length - 1));
      setProgress(0);
      pausedProgressRef.current = 0;
      startTimeRef.current = Date.now();
    }
  }, [isOpen, initialIndex, stories.length]);

  const activeStory = stories[currentIndex];
  const isMine = activeStory ? (activeStory.isMine || activeStory.authorId === currentUserId) : false;

  // Auto-advance timer
  useEffect(() => {
    if (!isOpen || !activeStory || isPaused) {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now() - (pausedProgressRef.current * STORY_DURATION_MS);

    const step = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentProgress = Math.min(elapsed / STORY_DURATION_MS, 1);
      setProgress(currentProgress);

      if (currentProgress >= 1) {
        if (currentIndex < stories.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setProgress(0);
          pausedProgressRef.current = 0;
          startTimeRef.current = Date.now();
        } else {
          onClose();
        }
      } else {
        timerRef.current = requestAnimationFrame(step);
      }
    };

    timerRef.current = requestAnimationFrame(step);

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isOpen, currentIndex, isPaused, stories.length, onClose, activeStory]);

  if (!isOpen || !activeStory) return null;

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
      pausedProgressRef.current = 0;
      startTimeRef.current = Date.now();
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
      pausedProgressRef.current = 0;
      startTimeRef.current = Date.now();
    } else {
      setProgress(0);
      pausedProgressRef.current = 0;
      startTimeRef.current = Date.now();
    }
  };

  const handlePointerDown = () => {
    setIsPaused(true);
    pausedProgressRef.current = progress;
  };

  const handlePointerUp = () => {
    setIsPaused(false);
  };

  const handleReactionClick = (emoji: string) => {
    if (onReactStory) {
      onReactStory(activeStory.id, emoji);
    }
    setFloatingReaction(emoji);
    setTimeout(() => setFloatingReaction(null), 1200);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim()) return;

    if (onReplyToStory) {
      onReplyToStory(activeStory, replyInput.trim());
    }

    setReplyInput('');
    setReplySent(true);
    setTimeout(() => setReplySent(false), 2500);
  };

  // Format relative time (e.g. 2 hours ago)
  const formatStoryTime = (createdAt: number) => {
    const diff = Math.floor((Date.now() - createdAt) / 1000);
    if (diff < 60) return language === 'ru' ? 'только что' : 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} ${language === 'ru' ? 'мин назад' : 'm ago'}`;
    return `${Math.floor(diff / 3600)} ${language === 'ru' ? 'ч назад' : 'h ago'}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200">
      {/* Click outside to close on desktop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Story Container */}
      <div
        className="relative z-10 w-full max-w-sm h-full max-h-[92vh] sm:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl bg-zinc-950"
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
      >
        {/* Story Background Content */}
        {activeStory.mediaUri ? (
          <img
            src={activeStory.mediaUri}
            alt="Story media"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-tr ${
              activeStory.backgroundColor || 'from-sky-500 to-indigo-600'
            }`}
          />
        )}

        {/* Ambient Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

        {/* Floating animated reaction */}
        {floatingReaction && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-bounce">
            <span className="text-7xl drop-shadow-2xl">{floatingReaction}</span>
          </div>
        )}

        {/* Touch zones for left / right skipping */}
        <div className="absolute inset-0 flex z-10">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          />
        </div>

        {/* TOP SECTION: Progress bars & Author info */}
        <div className="relative z-20 p-4 space-y-3 pointer-events-auto">
          {/* Progress Bars */}
          <div className="flex items-center gap-1.5 w-full">
            {stories.map((st, idx) => {
              let fill = 0;
              if (idx < currentIndex) fill = 100;
              else if (idx === currentIndex) fill = progress * 100;
              else fill = 0;

              return (
                <div
                  key={st.id}
                  className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-xs"
                >
                  <div
                    className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
                    style={{ width: `${fill}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Author Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {activeStory.authorAvatarUri ? (
                <img
                  src={activeStory.authorAvatarUri}
                  alt={activeStory.authorName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-sky-400/80 shadow-md"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center ring-2 ring-sky-400/80 shadow-md">
                  {activeStory.authorName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white drop-shadow-md">
                  {activeStory.authorName}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                  <span>{formatStoryTime(activeStory.createdAt)}</span>
                  {activeStory.authorUsername && (
                    <>
                      <span>•</span>
                      <span className="text-sky-300 font-mono">{activeStory.authorUsername}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: View count & Delete (if mine), or close */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {isMine && (
                <>
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-black/40 backdrop-blur-md text-white/90 rounded-full text-xs font-medium">
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>{activeStory.viewsCount || 1}</span>
                  </div>

                  <button
                    onClick={() => {
                      onDeleteStory(activeStory.id);
                      if (stories.length <= 1) {
                        onClose();
                      } else {
                        handleNext();
                      }
                    }}
                    className="p-2 bg-black/40 hover:bg-rose-600/80 text-white/90 hover:text-white rounded-full backdrop-blur-md transition"
                    title={t.deleteStory}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition"
                title={t.cancel}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* CENTER / BOTTOM: Caption Text Overlay */}
        <div className="relative z-20 p-5 mt-auto pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {activeStory.text && (
            <div className="bg-black/55 backdrop-blur-md p-3.5 rounded-2xl text-white text-sm font-medium leading-relaxed shadow-lg border border-white/10 mb-3 break-words">
              {activeStory.text}
            </div>
          )}

          {/* If viewing someone else's story: Reactions & Reply Input */}
          {!isMine ? (
            <div className="space-y-2.5">
              {/* Quick Emojis Bar */}
              <div className="flex items-center justify-around py-1.5 px-3 bg-black/45 backdrop-blur-md rounded-2xl border border-white/10">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className="text-2xl transform active:scale-125 hover:scale-110 transition py-0.5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply message form */}
              <form onSubmit={handleSendReply} className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  placeholder={language === 'ru' ? 'Ответить на историю...' : 'Reply to story...'}
                  className="flex-1 px-4 py-2.5 bg-black/40 backdrop-blur-md text-white text-xs placeholder-white/60 rounded-full border border-white/20 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  type="submit"
                  disabled={!replyInput.trim()}
                  className="p-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-full shadow-md transition shrink-0 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {replySent && (
                <p className="text-center text-xs text-sky-300 font-semibold animate-pulse">
                  {language === 'ru' ? 'Ответ отправлен автору!' : 'Reply sent!'}
                </p>
              )}
            </div>
          ) : (
            /* If own story: Footer info */
            <div className="flex items-center justify-between text-xs text-white/70 bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-xl">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {activeStory.viewsCount || 1} {t.views}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{language === 'ru' ? 'Активна 24 ч' : 'Active 24h'}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
