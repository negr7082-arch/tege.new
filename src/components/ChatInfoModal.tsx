import React, { useState, useRef, useEffect } from 'react';
import {
  Chat,
  Language,
  AdminMember,
  ContactUser,
  Channel,
  Story,
  BlockedUser,
  ChatPermissions,
  SystemBotConfig
} from '../types';
import { getT } from '../translations';
import { realtimeNetwork } from '../services/realtimeNetwork';
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Radio,
  User,
  Copy,
  Check,
  Globe,
  Lock,
  UserPlus,
  Trash2,
  Image,
  Video,
  Hash,
  AtSign,
  Camera,
  ArrowRight,
  Sparkles,
  Edit3,
  Bell,
  BellOff,
  Share2,
  Search,
  MessageSquare,
  Smile,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowLeft,
  UserX,
  Unlock,
  Clock,
  Sliders,
  Bot,
  CircleDot,
  Music,
  Paperclip,
  CheckCircle2,
  BarChart2,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { TelegramAvatar } from './TelegramAvatar';

interface ChatInfoModalProps {
  isOpen: boolean;
  chat: Chat;
  currentUserId: number;
  language: Language;
  isBlocked?: boolean;
  isBlockedByThem?: boolean;
  onBlockUser?: (user: BlockedUser) => void;
  onUnblockUser?: (userId: number) => void;
  onClose: () => void;
  onUpdateChat: (updated: Partial<Chat>) => void;
  onClearHistory: () => void;
  onDeleteChat?: (chatId: number) => void;
  onOpenChannel?: (channel: Channel) => void;
  stories?: Story[];
  onViewStory?: (storyIndex: number) => void;
}

const defaultPermissions: ChatPermissions = {
  sendMessages: true,
  sendPhotos: true,
  sendVideos: true,
  sendFiles: true,
  sendMusic: true,
  sendVideoNotes: true,
  sendPolls: true,
  pinMessages: true,
  changeChatInfo: false
};

const defaultBotConfig: SystemBotConfig = {
  isEnabled: true,
  botName: 'ShieldBot',
  botUsername: '@shield_guardian_bot',
  delete18Plus: true,
  slowModeSeconds: 300, // 5 minutes default as requested by user
  antiSpamLinks: true
};

export const ChatInfoModal: React.FC<ChatInfoModalProps> = ({
  isOpen,
  chat,
  currentUserId,
  language,
  isBlocked = false,
  isBlockedByThem = false,
  onBlockUser,
  onUnblockUser,
  onClose,
  onUpdateChat,
  onClearHistory,
  onDeleteChat,
  onOpenChannel,
  stories = [],
  onViewStory
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'admins' | 'permissions' | 'bot' | 'media'>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add Admin form modal state
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminHandleInput, setAdminHandleInput] = useState('');
  const [adminRights, setAdminRights] = useState({
    canChangeInfo: true,
    canPostMessages: true,
    canDeleteMessages: true,
    canBanUsers: true,
    canAddAdmins: false
  });

  // Edit form state
  const [editName, setEditName] = useState(chat.name);
  const [editDescription, setEditDescription] = useState(chat.description || '');
  const [editUsername, setEditUsername] = useState(chat.username ? chat.username.replace('@', '') : '');
  const [editIsPrivate, setEditIsPrivate] = useState<boolean>(Boolean(chat.isPrivate));
  const [editSignMessages, setEditSignMessages] = useState<boolean>(Boolean(chat.signMessages));
  const [editReactionsEnabled, setEditReactionsEnabled] = useState<boolean>(chat.reactionsEnabled !== false);
  const [editChatHistoryVisible, setEditChatHistoryVisible] = useState<boolean>(chat.chatHistoryVisible !== false);
  const [editOnlyAdminsCanPost, setEditOnlyAdminsCanPost] = useState<boolean>(Boolean(chat.onlyAdminsCanPost));
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(chat.avatarUri || null);

  // Group permissions state
  const [permissions, setPermissions] = useState<ChatPermissions>(() => ({
    ...defaultPermissions,
    ...(chat.permissions || {})
  }));

  // Bot configuration state
  const [botConfig, setBotConfig] = useState<SystemBotConfig>(() => ({
    ...defaultBotConfig,
    ...(chat.botConfig || {})
  }));

  const t = getT(language);

  // Sync state whenever chat changes
  useEffect(() => {
    setEditName(chat.name);
    setEditDescription(chat.description || '');
    setEditUsername(chat.username ? chat.username.replace('@', '') : '');
    setEditIsPrivate(Boolean(chat.isPrivate));
    setEditSignMessages(Boolean(chat.signMessages));
    setEditReactionsEnabled(chat.reactionsEnabled !== false);
    setEditChatHistoryVisible(chat.chatHistoryVisible !== false);
    setEditOnlyAdminsCanPost(Boolean(chat.onlyAdminsCanPost));
    setEditAvatarUri(chat.avatarUri || null);
    setPermissions({
      ...defaultPermissions,
      ...(chat.permissions || {})
    });
    setBotConfig({
      ...defaultBotConfig,
      ...(chat.botConfig || {})
    });
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setShowAddAdminModal(false);
  }, [chat.id, isOpen]);

  if (!isOpen) return null;

  const isOwner = chat.isOwner || (chat.ownerId ? chat.ownerId === currentUserId : true);
  const isAdmin = isOwner || (chat.admins && chat.admins.some((a) => a.id === currentUserId));

  // If direct chat, look up user info from network directory
  const contactInfo = chat.type === 'direct'
    ? realtimeNetwork.getAllRegisteredUsers().find(
        (u) =>
          (chat.userId && u.id === chat.userId) ||
          (chat.username && u.username.toLowerCase() === chat.username.toLowerCase())
      )
    : null;

  // Channels created by this user
  const authorChannels =
    chat.type === 'direct' && (chat.userId || chat.id)
      ? realtimeNetwork.getChannelsByOwner(chat.userId || chat.id)
      : [];

  // Stories by this user
  const authorStoryIndex = stories.findIndex(
    (s) =>
      (chat.userId && s.authorId === chat.userId) ||
      (chat.username && s.authorUsername?.toLowerCase() === chat.username.toLowerCase())
  );
  const hasActiveStory = authorStoryIndex !== -1;

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newUri = event.target?.result as string;
        setEditAvatarUri(newUri);
        onUpdateChat({ avatarUri: newUri });
        setNotice(language === 'ru' ? 'Фото успешно обновлено!' : 'Photo updated!');
        setTimeout(() => setNotice(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setEditAvatarUri(null);
    onUpdateChat({ avatarUri: null });
    setNotice(language === 'ru' ? 'Фото удалено' : 'Photo removed');
    setTimeout(() => setNotice(null), 3000);
  };

  const handleCopyLink = () => {
    const link = chat.isPrivate
      ? chat.inviteLink || `https://tege.im/+join_${chat.id}`
      : `https://tege.im/${chat.username ? chat.username.replace('@', '') : chat.id}`;
    
    try {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleToggleMute = () => {
    onUpdateChat({ isMuted: !chat.isMuted });
    setNotice(
      chat.isMuted
        ? (language === 'ru' ? 'Уведомления включены' : 'Notifications enabled')
        : (language === 'ru' ? 'Без звука' : 'Muted')
    );
    setTimeout(() => setNotice(null), 2500);
  };

  // Save all changes in Edit screen
  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editName.trim()) return;

    let cleanUsername = editUsername.trim();
    if (cleanUsername) {
      cleanUsername = cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`;
    }

    const cleanLink = !editIsPrivate
      ? cleanUsername
        ? cleanUsername
        : `@channel_${chat.id}`
      : `https://tege.im/+join_${chat.id}`;

    onUpdateChat({
      name: editName.trim(),
      description: editDescription.trim(),
      username: !editIsPrivate ? cleanUsername || undefined : undefined,
      isPrivate: editIsPrivate,
      inviteLink: editIsPrivate ? cleanLink : undefined,
      signMessages: editSignMessages,
      reactionsEnabled: editReactionsEnabled,
      chatHistoryVisible: editChatHistoryVisible,
      onlyAdminsCanPost: chat.type === 'channel' ? true : editOnlyAdminsCanPost,
      avatarUri: editAvatarUri,
      permissions,
      botConfig
    });

    setIsEditing(false);
    setNotice(language === 'ru' ? 'Настройки успешно сохранены!' : 'Settings saved!');
    setTimeout(() => setNotice(null), 3000);
  };

  // Delete channel or group
  const handleDeleteChatConfirmed = () => {
    if (onDeleteChat) {
      onDeleteChat(chat.id);
      onClose();
    }
  };

  // Invite user by @username or ID
  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inviteInput.trim();
    if (!clean) return;

    const cleanLower = clean.toLowerCase();
    const isNum = /^\d+$/.test(clean.replace('#', ''));
    const registeredList = realtimeNetwork.getAllRegisteredUsers();
    const foundRegistered = registeredList.find((u) => {
      if (isNum && u.id.toString() === clean.replace('#', '')) return true;
      if (u.username.toLowerCase() === cleanLower || u.username.toLowerCase() === `@${cleanLower}`) return true;
      return false;
    });

    const parsedId = foundRegistered ? foundRegistered.id : (isNum ? parseInt(clean.replace('#', ''), 10) : 1122000 + Math.floor(Math.random() * 80000));
    const username = foundRegistered ? foundRegistered.username : (clean.startsWith('@') ? clean : isNum ? `@id${parsedId}` : `@${clean}`);
    const name = foundRegistered ? foundRegistered.name : (isNum ? `User #${parsedId}` : clean.replace('@', ''));

    const newMember: ContactUser = {
      id: parsedId,
      name,
      username,
      online: true,
      avatarUri: foundRegistered?.avatarUri || null
    };

    const currentMembers = chat.members || [];
    if (!currentMembers.some((m) => m.id === parsedId || m.username.toLowerCase() === username.toLowerCase())) {
      onUpdateChat({
        members: [...currentMembers, newMember],
        membersCount: (chat.membersCount || 1) + 1
      });
      setNotice(language === 'ru' ? `Пользователь ${username} приглашён!` : `Invited ${username}!`);
    } else {
      setNotice(language === 'ru' ? 'Пользователь уже в списке' : 'User already in list');
    }

    setInviteInput('');
    setTimeout(() => setNotice(null), 3000);
  };

  // Promote user to admin
  const handleAddAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = adminHandleInput.trim();
    if (!clean || !isOwner) return;

    const cleanLower = clean.toLowerCase();
    const isNum = /^\d+$/.test(clean.replace('#', ''));
    const registeredList = realtimeNetwork.getAllRegisteredUsers();
    const foundRegistered = registeredList.find((u) => {
      if (isNum && u.id.toString() === clean.replace('#', '')) return true;
      if (u.username.toLowerCase() === cleanLower || u.username.toLowerCase() === `@${cleanLower}`) return true;
      return false;
    });

    const parsedId = foundRegistered ? foundRegistered.id : (isNum ? parseInt(clean.replace('#', ''), 10) : 1122000 + Math.floor(Math.random() * 80000));
    const username = foundRegistered ? foundRegistered.username : (clean.startsWith('@') ? clean : isNum ? `@id${parsedId}` : `@${clean}`);
    const name = foundRegistered ? foundRegistered.name : (isNum ? `Admin #${parsedId}` : clean.replace('@', ''));

    const newAdmin: AdminMember = {
      id: parsedId,
      name,
      username,
      avatarUri: foundRegistered?.avatarUri || null,
      canChangeInfo: adminRights.canChangeInfo,
      canPostMessages: adminRights.canPostMessages,
      canDeleteMessages: adminRights.canDeleteMessages,
      canBanUsers: adminRights.canBanUsers,
      canAddAdmins: adminRights.canAddAdmins
    };

    const currentAdmins = chat.admins || [];
    if (!currentAdmins.some((a) => a.id === parsedId || a.username.toLowerCase() === username.toLowerCase())) {
      onUpdateChat({
        admins: [...currentAdmins, newAdmin]
      });
      setNotice(language === 'ru' ? `${username} назначен администратором!` : `${username} promoted to admin!`);
    }

    setAdminHandleInput('');
    setShowAddAdminModal(false);
    setTimeout(() => setNotice(null), 3000);
  };

  // Remove admin
  const handleRemoveAdmin = (adminId: number) => {
    if (!isOwner) return;
    const currentAdmins = chat.admins || [];
    const updated = currentAdmins.filter((a) => a.id !== adminId);
    onUpdateChat({ admins: updated });
    setNotice(language === 'ru' ? 'Администратор снят с должности' : 'Admin removed');
    setTimeout(() => setNotice(null), 3000);
  };

  // Remove member from group
  const handleRemoveMember = (memberId: number) => {
    if (!isAdmin) return;
    const currentMembers = chat.members || [];
    const updated = currentMembers.filter((m) => m.id !== memberId);
    onUpdateChat({
      members: updated,
      membersCount: Math.max(1, (chat.membersCount || 1) - 1)
    });
    setNotice(language === 'ru' ? 'Участник удалён из группы' : 'Member removed');
    setTimeout(() => setNotice(null), 3000);
  };

  // Toggle permission
  const handleTogglePermission = (key: keyof ChatPermissions) => {
    if (!isAdmin) return;
    const updated = {
      ...permissions,
      [key]: !permissions[key]
    };
    setPermissions(updated);
    onUpdateChat({ permissions: updated });
  };

  // Update Bot Config
  const handleUpdateBotField = (key: keyof SystemBotConfig, value: any) => {
    if (!isAdmin) return;
    const updated = {
      ...botConfig,
      [key]: value
    };
    setBotConfig(updated);
    onUpdateChat({ botConfig: updated });
  };

  // Media items in chat
  const mediaPhotos = chat.messages.filter((m) => m.attachmentUri);
  const mediaVideos = chat.messages.filter((m) => m.videoUri || m.videoNoteUri);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Hidden file input for avatar upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAvatarFile}
          accept="image/*"
          className="hidden"
        />

        {/* TOP BAR */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900 z-10">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 -ml-1 text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}

            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              {chat.type === 'channel' ? (
                <Radio className="w-5 h-5 text-indigo-500" />
              ) : chat.type === 'group' ? (
                <Users className="w-5 h-5 text-sky-500" />
              ) : (
                <User className="w-5 h-5 text-emerald-500" />
              )}
              <span>
                {isEditing
                  ? (chat.type === 'channel'
                    ? (language === 'ru' ? 'Настройки канала' : 'Channel Settings')
                    : (language === 'ru' ? 'Настройки группы' : 'Group Settings'))
                  : (chat.type === 'channel'
                    ? (language === 'ru' ? 'Канал' : 'Channel')
                    : chat.type === 'group'
                    ? (language === 'ru' ? 'Группа' : 'Group')
                    : (language === 'ru' ? 'Профиль' : 'User Info'))}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {isEditing ? (
              <button
                type="button"
                onClick={() => handleSaveEdit()}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>{language === 'ru' ? 'Готово' : 'Done'}</span>
              </button>
            ) : (
              <>
                {isAdmin && chat.type !== 'direct' && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/60 rounded-full transition"
                    title={language === 'ru' ? 'Изменить' : 'Edit'}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* NOTIFICATION NOTICE BANNER */}
        {notice && (
          <div className="px-4 py-2 bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>{notice}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="overflow-y-auto flex-1">
          {isEditing ? (
            /* ===================== EDIT / SETTINGS SCREEN ===================== */
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {/* Photo Upload Row */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <TelegramAvatar
                    src={editAvatarUri}
                    name={editName || 'C'}
                    id={chat.id}
                    size="xl"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-80 group-hover:opacity-100 transition text-white">
                    <Camera className="w-5 h-5" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-sky-500 hover:text-sky-600 block"
                  >
                    {language === 'ru' ? 'Установить новую фотографию' : 'Set new photo'}
                  </button>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {language === 'ru' ? 'Нажмите на фото, чтобы выбрать из галереи' : 'Tap to upload from device'}
                  </p>
                  {editAvatarUri && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-[11px] text-rose-500 hover:text-rose-600 mt-1 font-medium block"
                    >
                      {language === 'ru' ? 'Удалить фотографию' : 'Remove photo'}
                    </button>
                  )}
                </div>
              </div>

              {/* Name Input */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
                  {chat.type === 'channel'
                    ? (language === 'ru' ? 'Название канала' : 'Channel Name')
                    : (language === 'ru' ? 'Название группы' : 'Group Name')}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={chat.type === 'channel' ? 'Новости IT' : 'Название группы'}
                  className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm font-medium text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1.5">
                  {language === 'ru' ? 'Описание (необязательно)' : 'Description (optional)'}
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={language === 'ru' ? 'О чём этот канал или группа?...' : 'About this chat...'}
                  className="w-full px-3.5 py-2 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                />
              </div>

              {/* Type Switch: Public vs Private with 5 Months Expiration */}
              <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                  {chat.type === 'channel' ? t.channelType : (language === 'ru' ? 'Тип группы' : 'Group Type')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditIsPrivate(false)}
                    className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                      !editIsPrivate
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                        : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">{t.publicChannel}</p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                        {language === 'ru' ? 'Публичный @username' : 'Searchable'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditIsPrivate(true)}
                    className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                      editIsPrivate
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20'
                        : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold">{t.privateChannel}</p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                        {language === 'ru' ? 'Ссылка (5 месяцев)' : '5 months link'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Username or 5-Month Link info */}
              {!editIsPrivate ? (
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1">
                    {language === 'ru' ? 'Публичная ссылка (@username)' : 'Public Link (@username)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm text-gray-400 font-mono">@</span>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="my_channel_handle"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm font-mono text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800 dark:text-zinc-200">
                      {language === 'ru' ? 'Пригласительная ссылка' : 'Invite Link'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="text-sky-500 font-bold"
                    >
                      {copiedLink ? 'Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                  <p className="font-mono text-sky-500 truncate text-[11px]">
                    {chat.inviteLink || `https://tege.im/+join_${chat.id}`}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Срок действия ссылки: 5 месяцев</span>
                  </div>
                </div>
              )}

              {/* Channel specific: Sign messages toggle */}
              {chat.type === 'channel' && (
                <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                      {t.signMessages}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {t.signMessagesDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditSignMessages(!editSignMessages)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      editSignMessages ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>
              )}

              {/* Channel specific: Discussion group link */}
              {chat.type === 'channel' && (
                <div className="p-3 bg-sky-50/70 dark:bg-sky-950/40 rounded-2xl border border-sky-100 dark:border-sky-900/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-sky-900 dark:text-sky-200">
                      {t.discussion} (Беседа канала)
                    </p>
                    <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-0.5">
                      {chat.discussionChatId
                        ? 'Беседа привязана. Подписчики могут комментировать публикации.'
                        : 'Привязать группу для обсуждений и комментариев'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newDiscussionId = chat.discussionChatId ? undefined : 1122800 + Math.floor(Math.random() * 5000);
                      onUpdateChat({ discussionChatId: newDiscussionId });
                      setNotice(newDiscussionId ? 'Беседа канала создана и привязана!' : 'Беседа отвязана');
                      setTimeout(() => setNotice(null), 3000);
                    }}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
                  >
                    {chat.discussionChatId ? 'Отвязать' : 'Привязать'}
                  </button>
                </div>
              )}

              {/* Danger Zone: Delete channel / group */}
              {isOwner && (
                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800">
                  {showDeleteConfirm ? (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-900 space-y-2 text-center">
                      <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        {chat.type === 'channel'
                          ? t.deleteChannelConfirm
                          : t.deleteGroupConfirm}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteChatConfirmed}
                          className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
                        >
                          {language === 'ru' ? 'Да, удалить' : 'Yes, delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>
                        {chat.type === 'channel'
                          ? (language === 'ru' ? 'Удалить канал' : 'Delete Channel')
                          : (language === 'ru' ? 'Удалить группу' : 'Delete Group')}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </form>
          ) : (
            /* ===================== VIEW MODE (TELEGRAM TABS) ===================== */
            <div>
              {/* Profile Card Header */}
              <div className="p-6 flex flex-col items-center text-center bg-gray-50/50 dark:bg-zinc-900/40 border-b border-gray-100 dark:border-zinc-800">
                <div className="relative mb-3 group">
                  <div
                    onClick={() => {
                      if (hasActiveStory && onViewStory) {
                        onViewStory(authorStoryIndex);
                        onClose();
                      }
                    }}
                    className={`p-1 rounded-3xl transition ${
                      hasActiveStory
                        ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-sky-400 cursor-pointer shadow-md transform hover:scale-105'
                        : ''
                    }`}
                  >
                    <TelegramAvatar
                      src={chat.avatarUri}
                      name={chat.name}
                      id={chat.userId || chat.id}
                      size="2xl"
                      className="border-2 border-white dark:border-zinc-900 shadow-md"
                    />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2 justify-center">
                  <span>{chat.name}</span>
                </h2>

                <div className="text-xs text-gray-400 dark:text-zinc-400 mt-0.5 font-medium flex items-center justify-center gap-1.5">
                  {chat.type === 'channel' ? (
                    <span>{chat.subscribersCount || 1} {t.subscribers}</span>
                  ) : chat.type === 'group' ? (
                    <span>{chat.membersCount || (chat.members?.length ? chat.members.length + 1 : 1)} {language === 'ru' ? 'участников' : 'members'}</span>
                  ) : isBlocked ? (
                    <span className="text-rose-500 font-semibold">{t.userBlocked}</span>
                  ) : chat.online ? (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{t.online}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      <span>{t.offline}</span>
                    </span>
                  )}
                </div>

                {/* Circular Action Buttons Row */}
                <div className="flex items-center justify-center gap-4 mt-5">
                  {/* Mute button */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition shadow-xs active:scale-95 ${
                        chat.isMuted
                          ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-400'
                          : 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300'
                      }`}
                    >
                      {chat.isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                    </button>
                    <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
                      {chat.isMuted ? (language === 'ru' ? 'Вкл. звук' : 'Unmute') : (language === 'ru' ? 'Без звука' : 'Mute')}
                    </span>
                  </div>

                  {/* Share button */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 flex items-center justify-center transition shadow-xs active:scale-95"
                    >
                      {copiedLink ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                    </button>
                    <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
                      {copiedLink ? (language === 'ru' ? 'Скопировано!' : 'Copied!') : (language === 'ru' ? 'Ссылка' : 'Share')}
                    </span>
                  </div>

                  {/* Edit / Settings button */}
                  {isAdmin && chat.type !== 'direct' && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center transition shadow-md shadow-sky-500/25 active:scale-95"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <span className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">
                        {language === 'ru' ? 'Настройки' : 'Settings'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Telegram Full Navigation Tabs */}
                <div className="flex items-center gap-1 mt-6 p-1 bg-gray-200/60 dark:bg-zinc-800/80 rounded-xl text-xs w-full overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
                      activeTab === 'info'
                        ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                        : 'text-gray-500 dark:text-zinc-400'
                    }`}
                  >
                    Инфо
                  </button>

                  {chat.type !== 'direct' && (
                    <>
                      <button
                        onClick={() => setActiveTab('members')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
                          activeTab === 'members'
                            ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                            : 'text-gray-500 dark:text-zinc-400'
                        }`}
                      >
                        {chat.type === 'channel' ? 'Подписчики' : 'Участники'}
                      </button>

                      <button
                        onClick={() => setActiveTab('admins')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 flex items-center gap-1 ${
                          activeTab === 'admins'
                            ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                            : 'text-gray-500 dark:text-zinc-400'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Админы</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('permissions')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 flex items-center gap-1 ${
                          activeTab === 'permissions'
                            ? 'bg-white dark:bg-zinc-700 text-sky-600 dark:text-sky-300 shadow-xs font-bold'
                            : 'text-gray-500 dark:text-zinc-400'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5 text-sky-500" />
                        <span>Разрешения</span>
                      </button>

                      {isOwner && (
                        <button
                          onClick={() => setActiveTab('bot')}
                          className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 flex items-center gap-1 ${
                            activeTab === 'bot'
                              ? 'bg-white dark:bg-zinc-700 text-sky-600 dark:text-sky-300 shadow-xs font-bold'
                              : 'text-gray-500 dark:text-zinc-400'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5 text-sky-500" />
                          <span>Анти-спам</span>
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => setActiveTab('media')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
                      activeTab === 'media'
                        ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-xs'
                        : 'text-gray-500 dark:text-zinc-400'
                    }`}
                  >
                    Медиа
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              <div className="p-5 space-y-4">
                {/* ================= TAB 1: INFO ================= */}
                {activeTab === 'info' && (
                  <>
                    {/* Description card */}
                    <div className="p-3.5 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                        {language === 'ru' ? 'Описание' : 'Description'}
                      </span>
                      <p className="text-xs text-gray-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {chat.description || (contactInfo?.bio) || (language === 'ru' ? 'Описание отсутствует' : 'No description provided')}
                      </p>
                    </div>

                    {/* Link & 5-Month Expiration card */}
                    <div className="p-3.5 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider text-[11px]">
                          {chat.isPrivate ? 'Пригласительная ссылка' : 'Публичная ссылка'}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="flex items-center gap-1 text-sky-500 hover:text-sky-600 font-semibold"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? 'Скопировано!' : 'Копировать'}</span>
                        </button>
                      </div>
                      <p className="font-mono text-xs text-sky-600 dark:text-sky-400 font-bold break-all">
                        {chat.isPrivate
                          ? chat.inviteLink || `https://tege.im/+join_${chat.id}`
                          : chat.username || `https://tege.im/${chat.id}`}
                      </p>

                      {/* 5-Month Expiration status badge */}
                      {chat.type !== 'direct' && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>
                              Ссылка истекает через 5 месяцев ({new Date((chat.inviteLinkExpiresAt || ((chat.inviteLinkCreatedAt || Date.now()) + 5 * 30 * 24 * 60 * 60 * 1000))).toLocaleDateString('ru-RU')})
                            </span>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                const newLink = `https://tege.im/+join_${chat.type}_${chat.id}_${Math.random().toString(36).substring(2, 7)}`;
                                onUpdateChat({
                                  inviteLink: newLink,
                                  inviteLinkCreatedAt: Date.now(),
                                  inviteLinkExpiresAt: Date.now() + 5 * 30 * 24 * 60 * 60 * 1000
                                });
                                setNotice('Создана новая ссылка на 5 месяцев!');
                                setTimeout(() => setNotice(null), 3000);
                              }}
                              className="text-sky-500 hover:text-sky-600 font-semibold shrink-0 ml-2"
                            >
                              Сбросить
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Channel Discussion Group Section */}
                    {chat.type === 'channel' && (
                      <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/40 rounded-2xl border border-sky-100 dark:border-sky-900/60 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-sky-900 dark:text-sky-200">
                            💬 Обсуждение (Беседа канала)
                          </p>
                          <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-0.5">
                            {chat.discussionChatId
                              ? 'Беседа привязана. Участники могут обсуждать посты.'
                              : 'Привязать группу для комментариев'}
                          </p>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              const newDiscussionId = chat.discussionChatId ? undefined : 1122800 + Math.floor(Math.random() * 5000);
                              onUpdateChat({ discussionChatId: newDiscussionId });
                              setNotice(newDiscussionId ? 'Беседа создана и привязана!' : 'Беседа отвязана');
                              setTimeout(() => setNotice(null), 3000);
                            }}
                            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition shrink-0"
                          >
                            {chat.discussionChatId ? 'Отвязать' : 'Привязать'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Direct user profile details */}
                    {chat.type === 'direct' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">
                            ID
                          </span>
                          <p className="font-mono text-xs font-bold text-gray-800 dark:text-zinc-200">
                            #{chat.userId || chat.id}
                          </p>
                        </div>

                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-0.5">
                              Статус
                            </span>
                            <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                              {chat.online ? t.online : t.offline}
                            </p>
                          </div>
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${chat.online ? 'bg-emerald-500 ring-2 ring-emerald-300' : 'bg-gray-300'}`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions: Block / Delete */}
                    {chat.type === 'direct' && onBlockUser && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isBlocked) {
                            if (onUnblockUser) onUnblockUser(chat.userId || chat.id);
                          } else {
                            onBlockUser({
                              id: chat.userId || chat.id,
                              name: chat.name,
                              username: chat.username || `@user_${chat.userId || chat.id}`,
                              avatarUri: chat.avatarUri,
                              blockedAt: Date.now()
                            });
                          }
                          onClose();
                        }}
                        className={`w-full py-2.5 px-3 rounded-2xl transition text-xs font-bold flex items-center justify-center gap-1.5 ${
                          isBlocked
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                        }`}
                      >
                        {isBlocked ? (
                          <>
                            <Unlock className="w-4 h-4" />
                            <span>{t.unblockUser}</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-4 h-4" />
                            <span>{t.blockUser}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Clear chat history */}
                    <button
                      type="button"
                      onClick={() => {
                        onClearHistory();
                        onClose();
                      }}
                      className="w-full py-2.5 px-3 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t.clearChatHistory}</span>
                    </button>

                    {/* Delete chat */}
                    {onDeleteChat && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteChat(chat.id);
                          onClose();
                        }}
                        className="w-full py-2.5 px-3 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-98 text-white transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t.deleteChat}</span>
                      </button>
                    )}
                  </>
                )}

                {/* ================= TAB 2: MEMBERS ================= */}
                {activeTab === 'members' && (
                  <div className="space-y-4">
                    {/* Invite form */}
                    {isAdmin && (
                      <form onSubmit={handleInviteUser} className="space-y-2">
                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">
                          {language === 'ru' ? 'Пригласить по ID или ЮЗ (@username)' : 'Invite by ID or handle'}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={inviteInput}
                            onChange={(e) => setInviteInput(e.target.value)}
                            placeholder="@user_name или 1122102"
                            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-zinc-800 text-xs rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                          />
                          <button
                            type="submit"
                            disabled={!inviteInput.trim()}
                            className="px-3 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Добавить</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Members List */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                        {chat.type === 'channel' ? 'Подписчики' : 'Участники'} ({chat.members?.length || 1})
                      </h4>
                      <div className="space-y-2">
                        {/* Owner / Creator */}
                        <div className="p-2.5 bg-gray-50 dark:bg-zinc-800/40 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <TelegramAvatar
                              src={isOwner ? chat.avatarUri : null}
                              name={chat.name}
                              id={chat.ownerId || 1}
                              size="sm"
                            />
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-zinc-100">
                                {isOwner ? 'Вы (Создатель)' : 'Создатель канала'}
                              </p>
                              <p className="text-[10px] text-gray-400">Владелец</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded font-semibold text-[10px]">
                            Владелец
                          </span>
                        </div>

                        {/* List members */}
                        {chat.members?.map((member) => (
                          <div
                            key={member.id}
                            className="p-2.5 bg-gray-50 dark:bg-zinc-800/40 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <TelegramAvatar
                                src={member.avatarUri}
                                name={member.name}
                                id={member.id}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">{member.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono truncate">{member.username}</p>
                              </div>
                            </div>

                            {isAdmin && (
                              <div className="flex items-center gap-1 shrink-0">
                                {isOwner && !chat.admins?.some((a) => a.id === member.id) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdminHandleInput(member.username);
                                      setShowAddAdminModal(true);
                                    }}
                                    className="p-1 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg text-[10px] font-bold"
                                    title="Назначить администратором"
                                  >
                                    Админ
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="p-1 text-gray-400 hover:text-rose-500 rounded-lg"
                                  title="Удалить из группы"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= TAB 3: ADMINISTRATORS ================= */}
                {activeTab === 'admins' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                        {t.administrators} ({(chat.admins?.length || 0) + 1})
                      </h4>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => setShowAddAdminModal(true)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Назначить админа</span>
                        </button>
                      )}
                    </div>

                    {/* Owner row */}
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                          👑
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-zinc-100">
                            {isOwner ? 'Вы (Создатель)' : 'Создатель'}
                          </p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">
                            Все права владельца
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-full font-bold text-[10px]">
                        Владелец
                      </span>
                    </div>

                    {/* Admin members list */}
                    <div className="space-y-2">
                      {chat.admins?.map((admin) => (
                        <div
                          key={admin.id}
                          className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <TelegramAvatar
                              src={admin.avatarUri}
                              name={admin.name}
                              id={admin.id}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-zinc-100 truncate">{admin.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono truncate">{admin.username}</p>
                              <p className="text-[10px] text-indigo-500 mt-0.5">
                                {admin.canDeleteMessages ? 'Удаление' : ''} • {admin.canPostMessages ? 'Публикация' : ''} • {admin.canBanUsers ? 'Блокировка' : ''}
                              </p>
                            </div>
                          </div>

                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Снять администратора ${admin.name}?`)) {
                                  handleRemoveAdmin(admin.id);
                                }
                              }}
                              className="px-2 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg text-xs font-semibold shrink-0"
                            >
                              Снять
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Admin Modal Dialog */}
                    {showAddAdminModal && (
                      <div className="p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-2xl space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-sky-900 dark:text-sky-200">
                            Назначить нового администратора
                          </h5>
                          <button
                            type="button"
                            onClick={() => setShowAddAdminModal(false)}
                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <input
                          type="text"
                          required
                          value={adminHandleInput}
                          onChange={(e) => setAdminHandleInput(e.target.value)}
                          placeholder="@username или ID пользователя"
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-xs font-mono rounded-xl border border-sky-200 dark:border-sky-800 outline-none focus:ring-2 focus:ring-sky-500"
                        />

                        {/* Admin permissions toggles */}
                        <div className="space-y-1.5 text-xs text-gray-700 dark:text-zinc-300">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={adminRights.canChangeInfo}
                              onChange={(e) => setAdminRights({ ...adminRights, canChangeInfo: e.target.checked })}
                              className="rounded text-sky-500"
                            />
                            <span>Изменение профиля канала/группы</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={adminRights.canPostMessages}
                              onChange={(e) => setAdminRights({ ...adminRights, canPostMessages: e.target.checked })}
                              className="rounded text-sky-500"
                            />
                            <span>Публикация сообщений</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={adminRights.canDeleteMessages}
                              onChange={(e) => setAdminRights({ ...adminRights, canDeleteMessages: e.target.checked })}
                              className="rounded text-sky-500"
                            />
                            <span>Удаление чужих сообщений</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={adminRights.canBanUsers}
                              onChange={(e) => setAdminRights({ ...adminRights, canBanUsers: e.target.checked })}
                              className="rounded text-sky-500"
                            />
                            <span>Блокировка пользователей</span>
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddAdminSubmit}
                          disabled={!adminHandleInput.trim()}
                          className="w-full py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-xs"
                        >
                          Назначить администратором
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ================= TAB 4: PERMISSIONS (РАЗРЕШЕНИЯ) ================= */}
                {activeTab === 'permissions' && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                        {t.groupPermissions}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                        {language === 'ru'
                          ? 'Укажите, что разрешено отправлять обычным участникам в этой беседе:'
                          : 'Configure what normal members can send in this discussion:'}
                      </p>
                    </div>

                    <div className="space-y-2 bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800">
                      {/* Отправка фото */}
                      <div className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                          <Image className="w-4 h-4 text-sky-500" />
                          <span>{t.allowPhotos}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleTogglePermission('sendPhotos')}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            permissions.sendPhotos ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      {/* Отправка видео */}
                      <div className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                          <Video className="w-4 h-4 text-indigo-500" />
                          <span>{t.allowVideos}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleTogglePermission('sendVideos')}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            permissions.sendVideos ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      {/* Кружочки (видеосообщения) */}
                      <div className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                          <CircleDot className="w-4 h-4 text-purple-500" />
                          <span>{t.allowVideoNotes}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleTogglePermission('sendVideoNotes')}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            permissions.sendVideoNotes ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      {/* Музыка и аудио */}
                      <div className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                          <Music className="w-4 h-4 text-rose-500" />
                          <span>{t.allowMusic}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleTogglePermission('sendMusic')}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            permissions.sendMusic ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      {/* Файлы */}
                      <div className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                          <Paperclip className="w-4 h-4 text-emerald-500" />
                          <span>{t.allowFiles}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleTogglePermission('sendFiles')}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            permissions.sendFiles ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      {/* Видеочат */}
                      {chat.type === 'group' && (
                        <div className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                            <Video className="w-4 h-4 text-sky-500" />
                            <span>Запускать видеочат</span>
                          </div>
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => handleTogglePermission('startVideoChat')}
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                              permissions.startVideoChat ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>
                      )}

                      {/* Опросы */}
                      <div className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-zinc-200">
                          <BarChart2 className="w-4 h-4 text-amber-500" />
                          <span>{t.allowPolls}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleTogglePermission('sendPolls')}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            permissions.sendPolls ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                          }`}
                        >
                          <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= TAB 5: SYSTEM BOT (SHIELDBOT) ================= */}
                {activeTab === 'bot' && (
                  <div className="space-y-4">
                    {/* Bot header banner */}
                    <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                          <Bot className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <span>ShieldBot</span>
                            <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[9px] font-bold rounded-full">
                              МОДЕРАТОР
                            </span>
                          </h4>
                          <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-mono">
                            @shield_guardian_bot
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => handleUpdateBotField('isEnabled', !botConfig.isEnabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                          botConfig.isEnabled ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                      </button>
                    </div>

                    {botConfig.isEnabled ? (
                      <div className="space-y-3">
                        {/* 18+ filter */}
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                          <div className="pr-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                              🔞 {t.delete18Plus}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {t.delete18PlusDesc}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => handleUpdateBotField('delete18Plus', !botConfig.delete18Plus)}
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                              botConfig.delete18Plus ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>

                        {/* Slow Mode / Cooldown 5 minutes */}
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-900 dark:text-zinc-100">
                              ⏳ {t.slowMode}
                            </span>
                            <span className="font-mono text-amber-500 font-bold">
                              {botConfig.slowModeSeconds === 0
                                ? 'Выключен'
                                : botConfig.slowModeSeconds === 300
                                ? '5 минут'
                                : `${botConfig.slowModeSeconds} сек.`}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            {t.slowModeDesc}
                          </p>

                          {/* Quick selection chips for Slow Mode */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {[
                              { label: 'Выкл', val: 0 },
                              { label: '10 сек', val: 10 },
                              { label: '30 сек', val: 30 },
                              { label: '1 мин', val: 60 },
                              { label: '5 минут', val: 300 }
                            ].map((chip) => (
                              <button
                                key={chip.val}
                                type="button"
                                disabled={!isAdmin}
                                onClick={() => handleUpdateBotField('slowModeSeconds', chip.val)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition active:scale-95 ${
                                  botConfig.slowModeSeconds === chip.val
                                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                                    : 'bg-white dark:bg-zinc-700 text-gray-600 dark:text-zinc-300 border border-gray-200 dark:border-zinc-600'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Anti-spam */}
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                          <div className="pr-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-zinc-100">
                              🛡️ {t.antiSpam}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {t.antiSpamDesc}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => handleUpdateBotField('antiSpamLinks', !botConfig.antiSpamLinks)}
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                              botConfig.antiSpamLinks ? 'bg-amber-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-gray-400">
                        Бот-модератор выключен. Включите переключатель сверху, чтобы активировать фильтрацию 18+ и медленный режим 5 минут.
                      </div>
                    )}
                  </div>
                )}

                {/* ================= TAB 6: MEDIA ================= */}
                {activeTab === 'media' && (
                  <div>
                    {mediaPhotos.length === 0 && mediaVideos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-400">
                        {language === 'ru' ? 'В этом диалоге пока нет медиафайлов' : 'No media shared yet'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {mediaPhotos.map((msg) => (
                          <img
                            key={msg.id}
                            src={msg.attachmentUri!}
                            alt="media"
                            className="w-full h-24 object-cover rounded-xl border border-gray-100 dark:border-zinc-800"
                          />
                        ))}
                        {mediaVideos.map((msg) => (
                          <div key={msg.id} className="relative w-full h-24 rounded-xl overflow-hidden bg-black">
                            <video src={msg.videoUri || msg.videoNoteUri!} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Video className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
