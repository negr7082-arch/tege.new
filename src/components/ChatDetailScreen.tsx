import React, { useEffect, useRef, useState } from 'react';
import { Chat, Message, WallpaperId, Language, UserAccount, Poll, Comment, MessageReplyInfo, Channel, Story, BlockedUser, GroupVideoChatInfo } from '../types';
import { TelegramAvatar } from './TelegramAvatar';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ChatInfoModal } from './ChatInfoModal';
import { CommentsModal } from './CommentsModal';
import { GroupVideoChatModal } from './GroupVideoChatModal';
import { getT } from '../translations';
import { realtimeNetwork } from '../services/realtimeNetwork';
import { directRoomCode, normalizeRoomCode } from '../services/callService';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Bookmark,
  Search,
  Info,
  Lock,
  Shield,
  Radio,
  Users,
  Pin,
  X,
  VolumeX,
  Volume2,
  Share2,
  Trash2,
  UserX,
  Unlock,
  ShieldAlert
} from 'lucide-react';

interface ChatDetailScreenProps {
  chat: Chat;
  currentAccount: UserAccount;
  wallpaper: WallpaperId;
  language: Language;
  onBack: () => void;
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenChannel?: (channel: Channel) => void;
  stories?: Story[];
  onViewStory?: (storyIndex: number) => void;
  onSendMessage: (
    chatId: number,
    text: string,
    attachmentUri?: string | null,
    videoUri?: string | null,
    asChannel?: boolean,
    poll?: Poll,
    replyTo?: MessageReplyInfo,
    videoNoteUri?: string | null,
    audioUri?: string | null,
    fileUri?: string | null,
    fileName?: string,
    fileSize?: string
  ) => void;
  onDeleteMessage?: (chatId: number, messageId: number, forEveryone: boolean) => void;
  onEditMessage?: (chatId: number, messageId: number, text: string) => void;
  onForwardMessage?: (toChatId: number, message: Message, fromName: string) => void;
  forwardTargets?: Chat[];
  onUpdateChat?: (chatId: number, updated: Partial<Chat>) => void;
  onClearHistory?: (chatId: number) => void;
  onDeleteChat?: (chatId: number) => void;
  isBlocked?: boolean;
  isBlockedByThem?: boolean;
  onBlockUser?: (user: BlockedUser) => void;
  onUnblockUser?: (userId: number) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const ChatDetailScreen: React.FC<ChatDetailScreenProps> = ({
  chat,
  currentAccount,
  wallpaper,
  language,
  onBack,
  onOpenProfile,
  onOpenSettings,
  onOpenChannel,
  stories = [],
  onViewStory,
  onSendMessage,
  onDeleteMessage: onDeleteMessageSync,
  onEditMessage: onEditMessageSync,
  onForwardMessage: onForwardMessageSync,
  forwardTargets = [],
  onUpdateChat,
  onClearHistory,
  onDeleteChat,
  isBlocked = false,
  isBlockedByThem = false,
  onBlockUser,
  onUnblockUser,
  isDarkMode,
  onToggleTheme
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeCallStatus, setActiveCallStatus] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [activeCommentsPost, setActiveCommentsPost] = useState<Message | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<MessageReplyInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleteForEveryone, setDeleteForEveryone] = useState(true);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showGroupVideoChat, setShowGroupVideoChat] = useState(false);
  const [directCallVideo, setDirectCallVideo] = useState(false);
  const [showBroadcastNoticeModal, setShowBroadcastNoticeModal] = useState(false);
  const [networkVideoChat, setNetworkVideoChat] = useState<GroupVideoChatInfo | null>(() => {
    return realtimeNetwork.getActiveVideoChat(chat.id) || chat.activeVideoChat || null;
  });
  const t = getT(language);

  useEffect(() => {
    const unsubscribe = realtimeNetwork.subscribeToVideoChat((chatId, info) => {
      if (chatId === chat.id) {
        setNetworkVideoChat(info);
      }
    });
    return () => unsubscribe();
  }, [chat.id]);

  // Keep online/last-seen text in sync with live presence updates.
  const [, setDirectoryVersion] = useState(0);
  const [presenceClock, setPresenceClock] = useState(() => Date.now());

  // Refresh relative last-seen labels without requiring a new network event.
  useEffect(() => {
    const timer = window.setInterval(() => setPresenceClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => realtimeNetwork.subscribeToDirectory(() => {
    setDirectoryVersion((version) => version + 1);
  }), []);

  const activeVideoChat = networkVideoChat?.isActive ? networkVideoChat : chat.activeVideoChat?.isActive ? chat.activeVideoChat : null;

  // Swipe-to-back gesture support for mobile
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && touchStartYRef.current !== null && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartXRef.current;
      const dy = e.changedTouches[0].clientY - touchStartYRef.current;
      // If swipe started near the left edge (< 60px) and dragged right (> 50px)
      if (touchStartXRef.current < 60 && dx > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        onBack();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages.length]);

  const handleCall = () => {
    setDirectCallVideo(false);
    setShowGroupVideoChat(true);
  };

  const handleVideoCall = () => {
    setDirectCallVideo(true);
    setShowGroupVideoChat(true);
  };

  // Determine owner & admin status:
  const isOwner = chat.ownerId ? chat.ownerId === currentAccount.id : chat.isOwner ?? true;
  const isAdmin = isOwner || Boolean(chat.admins && chat.admins.some((a) => a.id === currentAccount.id));
  // Запускать видеочат: владелец/админы; в группах — ещё и все, если админ это разрешил
  const canStartVideo = isAdmin || isOwner || (chat.type === 'group' && Boolean(chat.permissions?.startVideoChat));

  // Posting permissions logic:
  // 1. Channel: ONLY creator/owner or admins can post! Regular subscribers CANNOT post.
  // 2. Group: by default everyone can post, unless onlyAdminsCanPost is enabled.
  // 3. Direct: always can post.
  let canPost = true;
  if (chat.type === 'channel') {
    canPost = Boolean(isOwner || isAdmin);
  } else if (chat.type === 'group' && chat.onlyAdminsCanPost) {
    canPost = Boolean(isOwner || isAdmin);
  }

  // Код комнаты: у всех участников группы/канала одинаковый, поэтому любой может войти без ввода кода
  const isDirectChat = chat.type === 'direct';
  const videoRoomCode = isDirectChat
    ? directRoomCode(currentAccount.id, chat.userId || chat.id)
    : 'G' + normalizeRoomCode(chat.username || chat.inviteLink || String(chat.id)).slice(-24);

  const handleStartOrJoinVideoChat = () => {
    if (activeVideoChat?.isActive) {
      // ANY user, member, or subscriber can enter when active!
      setShowGroupVideoChat(true);
    } else if (canStartVideo) {
      // Админы/владелец (и все в группе, если разрешено) могут запустить
      const newVideoChat: GroupVideoChatInfo = {
        isActive: true,
        title: chat.name,
        startedAt: Date.now(),
        startedById: currentAccount.id,
        startedByName: currentAccount.name,
        participants: [
          {
            id: currentAccount.id,
            name: currentAccount.name,
            avatarUri: currentAccount.avatarUri,
            isHost: true,
            isSpeaking: false,
            isMuted: false,
            isVideoOn: false
          }
        ]
      };
      realtimeNetwork.setActiveVideoChat(chat.id, newVideoChat);
      setNetworkVideoChat(newVideoChat);
      if (onUpdateChat) {
        onUpdateChat(chat.id, { activeVideoChat: newVideoChat });
      }
      setShowGroupVideoChat(true);
    } else {
      // Любой участник/подписчик может зайти: если эфир уже идёт (в т.ч. на другом устройстве) — подключится,
      // если нет — увидит сообщение, что эфир ещё не начат.
      setShowGroupVideoChat(true);
    }
  };

  const handleEndVideoChat = () => {
    realtimeNetwork.setActiveVideoChat(chat.id, null);
    setNetworkVideoChat(null);
    if (onUpdateChat) {
      onUpdateChat(chat.id, { activeVideoChat: undefined });
    }
    setShowGroupVideoChat(false);
  };

  // Handle Poll Vote
  const handleVotePoll = (messageId: number, optionId: number) => {
    const updatedMessages = chat.messages.map((m) => {
      if (m.id !== messageId || !m.poll) return m;

      const poll = m.poll;
      const alreadyVotedOption = poll.options.find((o) => o.votedUserIds.includes(currentAccount.id));

      if (alreadyVotedOption && !poll.allowsMultiple) {
        if (alreadyVotedOption.id === optionId) {
          // Unvote
          return {
            ...m,
            poll: {
              ...poll,
              totalVotes: Math.max(0, poll.totalVotes - 1),
              options: poll.options.map((opt) =>
                opt.id === optionId
                  ? {
                      ...opt,
                      votes: Math.max(0, opt.votes - 1),
                      votedUserIds: opt.votedUserIds.filter((id) => id !== currentAccount.id)
                    }
                  : opt
              )
            }
          };
        }

        // Switch vote
        return {
          ...m,
          poll: {
            ...poll,
            options: poll.options.map((opt) => {
              if (opt.id === alreadyVotedOption.id) {
                return {
                  ...opt,
                  votes: Math.max(0, opt.votes - 1),
                  votedUserIds: opt.votedUserIds.filter((id) => id !== currentAccount.id)
                };
              }
              if (opt.id === optionId) {
                return {
                  ...opt,
                  votes: opt.votes + 1,
                  votedUserIds: [...opt.votedUserIds, currentAccount.id]
                };
              }
              return opt;
            })
          }
        };
      }

      // Fresh vote or multiple
      const isSelected = poll.options.some((o) => o.id === optionId && o.votedUserIds.includes(currentAccount.id));
      return {
        ...m,
        poll: {
          ...poll,
          totalVotes: isSelected ? Math.max(0, poll.totalVotes - 1) : poll.totalVotes + 1,
          options: poll.options.map((opt) => {
            if (opt.id === optionId) {
              return {
                ...opt,
                votes: isSelected ? Math.max(0, opt.votes - 1) : opt.votes + 1,
                votedUserIds: isSelected
                  ? opt.votedUserIds.filter((id) => id !== currentAccount.id)
                  : [...opt.votedUserIds, currentAccount.id]
              };
            }
            return opt;
          })
        }
      };
    });

    if (onUpdateChat) {
      onUpdateChat(chat.id, { messages: updatedMessages });
    }
  };

  // Handle Reaction
  const handleReact = (messageId: number, emoji: string) => {
    const updatedMessages = chat.messages.map((m) => {
      if (m.id !== messageId) return m;

      const currentReactions = { ...(m.reactions || {}) };
      const currentUserReactions = { ...(m.userReactions || {}) };
      const prevEmoji = currentUserReactions[currentAccount.id];

      if (prevEmoji === emoji) {
        // Remove reaction
        currentReactions[emoji] = Math.max(0, (currentReactions[emoji] || 1) - 1);
        if (currentReactions[emoji] === 0) delete currentReactions[emoji];
        delete currentUserReactions[currentAccount.id];
      } else {
        // Decrement previous if existed
        if (prevEmoji && currentReactions[prevEmoji]) {
          currentReactions[prevEmoji] = Math.max(0, currentReactions[prevEmoji] - 1);
          if (currentReactions[prevEmoji] === 0) delete currentReactions[prevEmoji];
        }
        // Increment new
        currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;
        currentUserReactions[currentAccount.id] = emoji;
      }

      return {
        ...m,
        reactions: currentReactions,
        userReactions: currentUserReactions
      };
    });

    if (onUpdateChat) {
      onUpdateChat(chat.id, { messages: updatedMessages });
    }
  };

  // Handle Pin / Unpin message
  const handlePinMessage = (messageId: number) => {
    const targetMsg = chat.messages.find((m) => m.id === messageId);
    const newIsPinned = !targetMsg?.isPinned;

    const updatedMessages = chat.messages.map((m) => ({
      ...m,
      isPinned: m.id === messageId ? newIsPinned : m.isPinned
    }));

    if (onUpdateChat) {
      onUpdateChat(chat.id, {
        messages: updatedMessages,
        pinnedMessageId: newIsPinned ? messageId : undefined
      });
    }
  };

  // Delete: ask first (Telegram-style: only for me / also for everyone)
  const handleDeleteMessage = (messageId: number) => {
    const msg = chat.messages.find((m) => m.id === messageId);
    if (!msg) return;
    setDeleteForEveryone(true);
    setDeleteTarget(msg);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const everyone = deleteForEveryone && deleteTarget.isMine && !chat.isSavedMessages;
    if (onDeleteMessageSync) {
      onDeleteMessageSync(chat.id, deleteTarget.id, everyone);
    } else if (onUpdateChat) {
      onUpdateChat(chat.id, {
        messages: chat.messages.filter((m) => m.id !== deleteTarget.id),
        ...(chat.pinnedMessageId === deleteTarget.id ? { pinnedMessageId: undefined } : {})
      });
    }
    if (editingMessage && editingMessage.id === deleteTarget.id) setEditingMessage(null);
    setDeleteTarget(null);
  };

  const handleStartEdit = (message: Message) => {
    setReplyToMessage(null);
    setEditingMessage(message);
  };

  const handleSaveEdit = (newText: string) => {
    if (!editingMessage) return;
    if (newText !== editingMessage.text && onEditMessageSync) {
      onEditMessageSync(chat.id, editingMessage.id, newText);
    }
    setEditingMessage(null);
  };

  const handleForwardTo = (target: Chat) => {
    if (!forwardingMessage || !onForwardMessageSync) return;
    const fromName =
      forwardingMessage.forwardedFrom ||
      (forwardingMessage.isMine ? currentAccount.name : forwardingMessage.senderName || chat.name);
    onForwardMessageSync(target.id, forwardingMessage, fromName);
    setForwardingMessage(null);
  };

  const handleReplyMessage = (message: Message) => {
    setReplyToMessage({
      id: message.id,
      senderName: message.senderName || 'Пользователь',
      text: message.text || (message.attachmentUri ? '📷 Фото' : '📹 Видео')
    });
  };

  // Handle Add Comment to post
  const handleAddComment = (postId: number, comment: Comment) => {
    const updatedMessages = chat.messages.map((m) => {
      if (m.id !== postId) return m;
      const currentComments = m.comments || [];
      return {
        ...m,
        comments: [...currentComments, comment]
      };
    });

    if (onUpdateChat) {
      onUpdateChat(chat.id, { messages: updatedMessages });
    }

    if (activeCommentsPost && activeCommentsPost.id === postId) {
      setActiveCommentsPost({
        ...activeCommentsPost,
        comments: [...(activeCommentsPost.comments || []), comment]
      });
    }
  };

  // Find pinned message for banner
  const pinnedMessage = chat.pinnedMessageId
    ? chat.messages.find((m) => m.id === chat.pinnedMessageId)
    : chat.messages.find((m) => m.isPinned);

  const isDirectOnline = chat.type === 'direct'
    ? (chat.userId ? realtimeNetwork.isUserOnline(chat.userId) : chat.online)
    : false;

  const isSavedMessages = chat.id === 999999 || chat.isSavedMessages;

  const statusText = isSavedMessages
    ? (language === 'ru' ? 'сохранённые сообщения' : 'saved messages')
    : chat.type === 'channel'
    ? `${chat.subscribersCount || 1} ${t.subscribers}`
    : chat.type === 'group'
    ? `${chat.membersCount || 1} ${language === 'ru' ? 'участников' : 'members'}`
    : isBlocked
    ? (language === 'ru' ? 'заблокирован' : 'blocked')
    : isDirectOnline
    ? (language === 'ru' ? 'в сети' : 'online')
    : (() => {
        const lastSeenAt = chat.userId ? realtimeNetwork.getUser(chat.userId)?.lastSeenAt : undefined;
        if (!lastSeenAt) return language === 'ru' ? 'не в сети' : 'offline';
        const date = new Date(lastSeenAt);
        if (Number.isNaN(date.getTime())) return language === 'ru' ? 'не в сети' : 'offline';

        // Date/Intl use the viewer's local timezone. The server timestamp stays absolute,
        // so users in different timezones see the same moment converted to their own clock.
        const minutesAgo = Math.max(0, Math.floor((presenceClock - date.getTime()) / 60_000));
        const time = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
        const sameDay = date.toDateString() === new Date(presenceClock).toDateString();
        const yesterday = new Date(presenceClock);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (language === 'ru') {
          let relative: string;
          if (minutesAgo < 1) relative = 'только что';
          else if (minutesAgo < 60) relative = `${minutesAgo} ${minutesAgo === 1 ? 'минуту' : minutesAgo < 5 ? 'минуты' : 'минут'} назад`;
          else if (minutesAgo < 1440) {
            const hours = Math.floor(minutesAgo / 60);
            relative = `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`;
          } else if (sameDay) relative = 'сегодня';
          else if (isYesterday) relative = 'вчера';
          else relative = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
          if (minutesAgo < 1440 && sameDay) return `был(а) в сети ${relative} · сегодня в ${time}`;
          if (isYesterday) return `был(а) в сети вчера в ${time}`;
          if (sameDay) return `был(а) в сети сегодня в ${time}`;
          return `был(а) в сети ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)} в ${time}`;
        }

        if (minutesAgo < 1) return `last seen just now · ${time}`;
        if (minutesAgo < 60) return `last seen ${minutesAgo} min ago · ${time}`;
        if (minutesAgo < 1440) return `last seen ${Math.floor(minutesAgo / 60)} hr ago · ${time}`;
        if (sameDay) return `last seen today at ${time}`;
        if (isYesterday) return `last seen yesterday at ${time}`;
        return `last seen ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)} at ${time}`;
      })();

  const subtitleDetails = isSavedMessages
    ? (language === 'ru' ? 'личные заметки и файлы' : 'personal notes & cloud storage')
    : [
        chat.isPrivate ? (language === 'ru' ? '🔒 Закрытый' : '🔒 Private') : chat.username,
        chat.userId ? `ID: #${chat.userId}` : chat.id ? `ID: #${chat.id}` : null,
        statusText
      ].filter(Boolean).join(' • ');

  const wallpaperClasses: Record<WallpaperId, string> = {
    pattern: 'wallpaper-pattern',
    dark: 'wallpaper-dark',
    emerald: 'wallpaper-emerald',
    sunset: 'wallpaper-sunset',
    ocean: 'wallpaper-ocean',
    minimal: 'wallpaper-minimal'
  };

  const currentWallpaperClass = wallpaperClasses[wallpaper] || 'wallpaper-pattern';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`flex flex-col h-full min-h-0 relative overflow-hidden transition-colors ${currentWallpaperClass}`}
    >
      {/* Telegram Authentic Chat Top Bar */}
      <header className="h-[60px] px-2.5 flex items-center justify-between gap-2 sticky top-0 z-40 shrink-0 select-none bg-white/95 dark:bg-[#17212b]/95 border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Prominent Back Button (Large 44x44px touch target) */}
          <button
            type="button"
            onClick={onBack}
            className="min-w-[48px] min-h-[48px] w-12 h-12 flex items-center justify-center rounded-full text-sky-500 dark:text-sky-400 bg-transparent active:bg-sky-50 dark:active:bg-zinc-800 transition shrink-0 cursor-pointer touch-manipulation"
            aria-label="Назад к чатам"
            title="Назад к списку чатов"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Chat Avatar + Title & Subtitle (Clickable to open info) */}
          <div
            onClick={isSavedMessages ? undefined : () => setShowInfoModal(true)}
            className={`flex items-center gap-2.5 min-w-0 flex-1 h-12 pl-1 pr-2 rounded-xl bg-transparent shadow-none ${isSavedMessages ? '' : 'cursor-pointer active:opacity-75 transition'}`}
          >
            {isSavedMessages ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-sky-400 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bookmark className="w-5 h-5 fill-white text-white" />
              </div>
            ) : (
              <TelegramAvatar
                src={chat.avatarUri}
                name={chat.name}
                id={chat.id}
                size="md"
                className="w-10 h-10 shrink-0 text-sm"
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[16px] font-medium text-gray-900 dark:text-white truncate leading-snug">
                  {isSavedMessages ? (language === 'ru' ? 'Избранное' : 'Saved Messages') : chat.streak?.status === 'active' ? `${chat.name} 🔥 ${chat.streak.streakCount}` : chat.name}
                </h2>
                {chat.isMuted && <VolumeX className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
              </div>
              <p className={`text-xs truncate font-medium ${isDirectOnline ? 'text-sky-500 dark:text-sky-400' : 'text-gray-400 dark:text-zinc-500'}`}>
                {subtitleDetails}
              </p>
            </div>
          </div>
        </div>

        {/* Clean right side actions */}
        <div className="flex items-center gap-0.5 h-12 px-1 rounded-xl bg-transparent shadow-none text-gray-700 dark:text-white shrink-0">
          {chat.type === 'direct' && !isSavedMessages && (
            <>
              <button
                type="button"
                onClick={handleCall}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition"
                title="Аудиозвонок"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleVideoCall}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition"
                title="Видеозвонок"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Group & Channel Video Chat / Live Stream (Always visible in groups & channels) */}
          {(chat.type === 'group' || chat.type === 'channel') && (
            <button
              type="button"
              onClick={handleStartOrJoinVideoChat}
              className={`w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition cursor-pointer ${
                activeVideoChat?.isActive
                  ? 'bg-emerald-500 text-white animate-pulse shadow-md shadow-emerald-500/30'
                  : 'text-sky-500 hover:bg-sky-50 dark:hover:bg-zinc-800'
              }`}
              title={
                activeVideoChat?.isActive
                  ? (chat.type === 'channel' ? 'Войти в прямую трансляцию' : 'Войти в видеочат')
                  : (isAdmin || isOwner)
                  ? (chat.type === 'channel' ? 'Запустить трансляцию (для админов/владельца)' : 'Начать видеочат (для админов/владельца)')
                  : (chat.type === 'channel' ? 'Прямая трансляция' : 'Видеочат')
              }
            >
              {activeVideoChat?.isActive ? (
                <Radio className="w-5 h-5" />
              ) : (
                <Video className="w-5 h-5" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((open) => !open);
              setMessageSearchQuery('');
              setShowOptionsMenu(false);
            }}
            className={`w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition cursor-pointer ${isSearchOpen ? 'bg-sky-50 text-sky-600 dark:bg-zinc-800 dark:text-sky-400' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
            title={language === 'ru' ? 'Поиск по сообщениям' : 'Search messages'}
            aria-label={language === 'ru' ? 'Поиск по сообщениям' : 'Search messages'}
          >
            <Search className="w-5 h-5" />
          </button>

          {!isSavedMessages && (
            <button
              type="button"
              onClick={() => setShowOptionsMenu((prev) => !prev)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition"
              title="Ещё"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Telegram Active Group & Channel Video Chat Banner (Anyone can click to enter!) */}
      {activeVideoChat?.isActive && (
        <div
          onClick={() => setShowGroupVideoChat(true)}
          className="bg-gradient-to-r from-emerald-600 via-sky-600 to-blue-600 text-white px-4 py-2.5 flex items-center justify-between shadow-md cursor-pointer hover:brightness-105 active:scale-99 transition select-none z-30 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Radio className="w-3.5 h-3.5 shrink-0" />
                {chat.type === 'channel' ? 'Прямая трансляция активна' : 'Видеочат активен'}
              </span>
              <span className="text-[11px] text-sky-100 truncate">
                Эфир ведёт: {activeVideoChat.startedByName} • {activeVideoChat.participants?.length || 3} участников • Нажмите, чтобы слушать
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowGroupVideoChat(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-white text-emerald-700 font-bold text-xs shadow-md hover:bg-emerald-50 transition shrink-0 ml-2"
          >
            Войти в эфир
          </button>
        </div>
      )}

      {/* Telegram Pinned Message Banner */}
      {pinnedMessage && (
        <div className="bg-white dark:bg-[#17212b] border-b border-gray-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-between text-xs z-30 shadow-xs">
          <div
            className="flex items-center gap-2 min-w-0 cursor-pointer"
            onClick={() => {
              const el = document.getElementById(`msg-${pinnedMessage.id}`);
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Pin className="w-4 h-4 text-sky-500 rotate-45 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-sky-600 dark:text-sky-400 block text-[11px] truncate">
                Закреплённое сообщение • {pinnedMessage.senderName}
              </span>
              <p className="text-gray-600 dark:text-zinc-300 truncate text-[11px]">
                {pinnedMessage.text || (pinnedMessage.attachmentUri ? '📷 Фотография' : '📹 Видеозапись')}
              </p>
            </div>
          </div>

          <button
            onClick={() => handlePinMessage(pinnedMessage.id)}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            title="Открепить"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Call toast alert */}
      {activeCallStatus && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{activeCallStatus}</span>
        </div>
      )}

      {/* Dropdown Options Menu */}
      {showOptionsMenu && (
        <>
          <div className="fixed inset-0 z-35" onClick={() => setShowOptionsMenu(false)} />
          <div className="absolute top-15 sm:top-16 right-2 sm:right-4 z-40 w-52 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-700 py-1.5 text-sm text-gray-700 dark:text-zinc-200 animate-in fade-in zoom-in-95">
          <button
            onClick={() => {
              setShowInfoModal(true);
              setShowOptionsMenu(false);
            }}
            className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center gap-2"
          >
            <Info className="w-4 h-4 text-sky-500" />
            <span>
              {chat.type === 'channel'
                ? (language === 'ru' ? 'О канале' : 'Channel Info')
                : chat.type === 'group'
                ? (language === 'ru' ? 'О группе' : 'Group Info')
                : t.viewProfile}
            </span>
          </button>

          {/* Mute notifications toggle */}
          <button
            onClick={() => {
              if (onUpdateChat) {
                onUpdateChat(chat.id, { isMuted: !chat.isMuted });
              }
              setShowOptionsMenu(false);
            }}
            className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-700 transition flex items-center gap-2"
          >
            {chat.isMuted ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-500" />
                <span>Включить звук</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-gray-400" />
                <span>Отключить звук</span>
              </>
            )}
          </button>

          {onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings();
                setShowOptionsMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
            >
              {t.settings}
            </button>
          )}

          <button
            onClick={() => {
              if (onClearHistory) onClearHistory(chat.id);
              setShowOptionsMenu(false);
            }}
            className="w-full text-left px-4 py-2.5 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition border-t border-gray-100 dark:border-zinc-700/60"
          >
            {t.clearChatHistory}
          </button>

          {/* Block / Unblock User (for direct chats) */}
          {chat.type === 'direct' && (
            <button
              onClick={() => {
                if (isBlocked) {
                  if (onUnblockUser) onUnblockUser(chat.userId || chat.id);
                } else {
                  if (onBlockUser) {
                    onBlockUser({
                      id: chat.userId || chat.id,
                      name: chat.name,
                      username: chat.username || `@id${chat.userId || chat.id}`,
                      avatarUri: chat.avatarUri,
                      blockedAt: Date.now()
                    });
                  }
                }
                setShowOptionsMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-2 text-rose-500 font-medium"
            >
              {isBlocked ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">{t.unblockUser}</span>
                </>
              ) : (
                <>
                  <UserX className="w-4 h-4 text-rose-500" />
                  <span>{t.blockUser}</span>
                </>
              )}
            </button>
          )}

          {/* Delete chat completely */}
          <button
            onClick={() => {
              setShowDeleteConfirmModal(true);
              setShowOptionsMenu(false);
            }}
            className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-2 border-t border-gray-100 dark:border-zinc-700/60 font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.deleteChat}</span>
          </button>
        </div>
        </>
      )}

      {isSearchOpen && (
        <div className="shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#17212b] px-3 py-2">
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              autoFocus
              type="search"
              value={messageSearchQuery}
              onChange={(event) => setMessageSearchQuery(event.target.value)}
              placeholder={language === 'ru' ? 'Поиск в переписке' : 'Search this chat'}
              aria-label={language === 'ru' ? 'Поиск в переписке' : 'Search this chat'}
              className="min-w-0 flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400"
            />
            {messageSearchQuery && (
              <button type="button" onClick={() => setMessageSearchQuery('')} className="text-xs text-sky-600 dark:text-sky-400">
                {language === 'ru' ? 'Очистить' : 'Clear'}
              </button>
            )}
            <button type="button" onClick={() => { setIsSearchOpen(false); setMessageSearchQuery(''); }} aria-label={language === 'ru' ? 'Закрыть поиск' : 'Close search'} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          {messageSearchQuery.trim() && (
            <p className="px-1 pt-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
              {(() => {
                const query = messageSearchQuery.trim().toLocaleLowerCase();
                const count = chat.messages.filter((message) => [message.text, message.senderName, message.fileName, message.forwardedFrom].some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(query))).length;
                return language === 'ru' ? `Найдено сообщений: ${count}` : `Messages found: ${count}`;
              })()}
            </p>
          )}
        </div>
      )}

      {/* Messages Feed View */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5 select-text"
        onClick={() => setShowOptionsMenu(false)}
      >
        <div className="text-center my-2">
          <span className="text-[11px] font-medium bg-black/10 dark:bg-white/10 text-gray-700 dark:text-zinc-200 px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5 mx-auto w-fit">
            {chat.type === 'channel' ? (
              <>
                <Radio className="w-3 h-3 text-indigo-500" />
                <span>{language === 'ru' ? `Канал: ${chat.name}` : `Channel: ${chat.name}`}</span>
              </>
            ) : chat.type === 'group' ? (
              <>
                <Users className="w-3 h-3 text-sky-500" />
                <span>{language === 'ru' ? `Группа: ${chat.name}` : `Group: ${chat.name}`}</span>
              </>
            ) : (
              <span>{chat.messages.length > 0 ? `${t.conversationWith} ${chat.name}` : t.startNewConversation}</span>
            )}
          </span>
        </div>

        {chat.messages.filter((message) => {
          const query = messageSearchQuery.trim().toLocaleLowerCase();
          return !query || [message.text, message.senderName, message.fileName, message.forwardedFrom].some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(query));
        }).map((message) => (
          <div key={message.id} id={`msg-${message.id}`}>
            <MessageBubble
              message={message}
              chatType={chat.type}
              currentUserId={currentAccount.id}
              onReact={handleReact}
              onVotePoll={handleVotePoll}
              onOpenComments={(msg) => setActiveCommentsPost(msg)}
              onPinMessage={handlePinMessage}
              onReplyMessage={handleReplyMessage}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={onEditMessageSync ? handleStartEdit : undefined}
              onForwardMessage={onForwardMessageSync ? (m) => setForwardingMessage(m) : undefined}
            />
          </div>
        ))}
        {messageSearchQuery.trim() && !chat.messages.some((message) => {
          const query = messageSearchQuery.trim().toLocaleLowerCase();
          return [message.text, message.senderName, message.fileName, message.forwardedFrom].some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(query));
        }) && (
          <div className="mx-auto my-8 max-w-xs text-center" role="status">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-zinc-800">
              <Search className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">
              {language === 'ru' ? 'Ничего не найдено' : 'No messages found'}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
              {language === 'ru' ? 'Попробуйте изменить поисковый запрос.' : 'Try changing your search query.'}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer, Blocked by them Barrier, or Blocked by you Notice */}
      {isBlockedByThem ? (
        <div className="p-4 bg-white/95 dark:bg-zinc-900/95 border-t border-gray-200 dark:border-zinc-800 text-center animate-in fade-in">
          <div className="flex items-center justify-center gap-2 text-rose-500 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{t.userBlockedNotice}</span>
          </div>
        </div>
      ) : isBlocked ? (
        <div className="p-3 bg-white/95 dark:bg-zinc-900/95 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-rose-500 font-medium">
            <UserX className="w-4 h-4 shrink-0" />
            <span>{t.userBlockedByYou}</span>
          </div>
          <button
            onClick={() => onUnblockUser && onUnblockUser(chat.userId || chat.id)}
            className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-xl transition shrink-0 shadow-xs"
          >
            {t.unblockUser}
          </button>
        </div>
      ) : (
        <MessageComposer
          canPost={canPost}
          isAdmin={chat.isOwner || (chat.admins && chat.admins.some((a) => a.id === currentAccount.id))}
          isChannel={chat.type === 'channel'}
          isGroup={chat.type === 'group'}
          channelOrGroupName={chat.type !== 'direct' ? chat.name : undefined}
          senderName={currentAccount.name}
          isSubscribed={chat.subscribersCount ? chat.subscribersCount > 0 : true}
          isMuted={chat.isMuted}
          permissions={chat.permissions}
          slowModeSeconds={chat.botConfig?.isEnabled ? (chat.botConfig.slowModeSeconds || 0) : 0}
          cooldownRemaining={
            chat.botConfig?.isEnabled && (chat.botConfig.slowModeSeconds || 0) > 0
              ? Math.max(0, (chat.botConfig.slowModeSeconds || 0) - Math.floor((Date.now() - (chat.lastMessageTimestamps?.[currentAccount.id] || 0)) / 1000))
              : 0
          }
          replyToMessage={replyToMessage}
          onClearReply={() => setReplyToMessage(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onSaveEdit={handleSaveEdit}
          onToggleMute={() => {
            if (onUpdateChat) {
              onUpdateChat(chat.id, { isMuted: !chat.isMuted });
            }
          }}
          onSubscribe={() => {
            if (onUpdateChat) {
              onUpdateChat(chat.id, {
                subscribersCount: (chat.subscribersCount || 0) + 1
              });
            }
          }}
          onBack={onBack}
          onSend={(text, attachmentUri, videoUri, asChannel, poll, videoNoteUri, audioUri, fileUri, fileName, fileSize) => {
            onSendMessage(
              chat.id,
              text,
              attachmentUri,
              videoUri,
              asChannel,
              poll,
              replyToMessage || undefined,
              videoNoteUri,
              audioUri,
              fileUri,
              fileName,
              fileSize
            );
            setReplyToMessage(null);
          }}
        />
      )}

      {/* Delete message dialog (Telegram-style) */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">Удалить сообщение?</h4>
            {deleteTarget.isMine && !chat.isSavedMessages ? (
              <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteForEveryone}
                  onChange={(e) => setDeleteForEveryone(e.target.checked)}
                  className="w-5 h-5 accent-sky-500"
                />
                <span>
                  {chat.type === 'direct' ? `Также удалить для ${chat.name}` : 'Удалить для всех участников'}
                </span>
              </label>
            ) : (
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Сообщение будет удалено только у вас.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-sm font-semibold text-gray-700 dark:text-zinc-200 active:scale-95 transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold active:scale-95 transition"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward message: pick a chat */}
      {forwardingMessage && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs select-none"
          onClick={() => setForwardingMessage(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
              <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">Переслать в…</h4>
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto">
              {forwardTargets.filter((c) => c.type !== 'channel').length === 0 && (
                <p className="p-5 text-sm text-gray-500 dark:text-zinc-400 text-center">Нет чатов, куда можно переслать.</p>
              )}
              {forwardTargets
                .filter((c) => c.type !== 'channel')
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleForwardTo(c)}
                    className="w-full px-5 py-3 flex items-center gap-3 text-left active:bg-gray-100 dark:active:bg-zinc-800 transition"
                  >
                    <TelegramAvatar src={c.avatarUri} name={c.name} id={c.id} size="md" />
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                      {c.isSavedMessages ? 'Избранное' : c.name}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Dialog */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                {t.deleteChat}
              </h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                {t.deleteChatConfirm}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onDeleteChat) onDeleteChat(chat.id);
                  setShowDeleteConfirmModal(false);
                  onBack();
                }}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition active:scale-95"
              >
                {language === 'ru' ? 'Да, удалить' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2.5 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments / Discussion Modal */}
      <CommentsModal
        isOpen={Boolean(activeCommentsPost)}
        post={activeCommentsPost}
        channelName={chat.name}
        currentAccount={currentAccount}
        language={language}
        onClose={() => setActiveCommentsPost(null)}
        onAddComment={handleAddComment}
      />

      {/* Info Modal */}
      <ChatInfoModal
        isOpen={showInfoModal}
        chat={chat}
        currentUserId={currentAccount.id}
        language={language}
        isBlocked={isBlocked}
        isBlockedByThem={isBlockedByThem}
        onBlockUser={onBlockUser}
        onUnblockUser={onUnblockUser}
        onClose={() => setShowInfoModal(false)}
        onUpdateChat={(updated) => onUpdateChat && onUpdateChat(chat.id, updated)}
        onClearHistory={() => onClearHistory && onClearHistory(chat.id)}
        onDeleteChat={(id) => {
          if (onDeleteChat) onDeleteChat(id);
          onBack();
        }}
        onOpenChannel={onOpenChannel}
        stories={stories}
        onViewStory={onViewStory}
      />

      {/* Broadcast Notice Modal for Subscribers/Members */}
      {showBroadcastNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
          <div className="bg-white dark:bg-[#17212b] border border-gray-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-sky-50 dark:bg-sky-950/50 text-[#2AABEE] flex items-center justify-center mx-auto shadow-inner">
              <Radio className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                {chat.type === 'channel' ? 'Прямая трансляция' : 'Групповой видеочат'}
              </h4>
              <p className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed px-1">
                {chat.type === 'channel'
                  ? 'Эфир в канале ещё не начат. Запустить трансляцию может только создатель или администратор канала. Как только начнётся трансляция, вверху появится кнопка «Войти в эфир».'
                  : 'Видеочат в группе ещё не начат. Запустить его могут администраторы беседы.'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowBroadcastNoticeModal(false);
                  setShowGroupVideoChat(true);
                }}
                className="w-full py-2.5 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-md shadow-sky-500/20 cursor-pointer"
              >
                Запустить демо-эфир (просмотр)
              </button>
              <button
                type="button"
                onClick={() => setShowBroadcastNoticeModal(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telegram Group & Channel Video Chat Modal */}
      {showGroupVideoChat && (
        <GroupVideoChatModal
          isOpen={showGroupVideoChat}
          chatName={chat.name}
          isChannel={chat.type === 'channel'}
          isDirect={isDirectChat}
          isAdmin={isAdmin}
          isOwner={isOwner}
          roomCode={videoRoomCode}
          canHost={canStartVideo || isDirectChat}
          startWithVideo={isDirectChat && directCallVideo}
          currentAccount={currentAccount}
          videoChatInfo={
            activeVideoChat || chat.activeVideoChat || {
              isActive: true,
              title: chat.name,
              startedAt: Date.now(),
              startedById: currentAccount.id,
              startedByName: currentAccount.name,
              participants: [
                {
                  id: currentAccount.id,
                  name: currentAccount.name,
                  avatarUri: currentAccount.avatarUri,
                  isHost: true,
                  isSpeaking: false,
                  isMuted: false,
                  isVideoOn: false
                }
              ]
            }
          }
          onClose={() => setShowGroupVideoChat(false)}
          onEndVideoChat={() => {
            handleEndVideoChat();
          }}
          onLeaveVideoChat={() => {
            setShowGroupVideoChat(false);
          }}
        />
      )}
    </div>
  );
};
