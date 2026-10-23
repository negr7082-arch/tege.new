import React, { useState, useRef } from 'react';
import { VerifiedBadge } from './VerifiedBadge';
import { UserProfile, Language, Channel, Story } from '../types';
import { getT } from '../translations';
import { TelegramAvatar } from './TelegramAvatar';
import {
  Camera,
  ArrowLeft,
  Pencil,
  Check,
  AtSign,
  Info,
  Hash,
  Trash2,
  Settings,
  Lock,
  Mail,
  KeyRound,
  LogOut,
  X,
  Radio,
  Plus,
  PlusCircle,
  Users,
  Globe,
  ArrowRight,
  Sparkles,
  Eye,
  Clock
} from 'lucide-react';

interface ProfileScreenProps {
  profile: UserProfile;
  language: Language;
  channels?: Channel[];
  stories?: Story[];
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onClearAllChats: () => void;
  onOpenSettings: () => void;
  onOpenChangePassword: () => void;
  onSelectChannel?: (channel: Channel) => void;
  onCreateChannel?: () => void;
  onDeleteChannel?: (channelId: number) => void;
  onUpdateChannelAvatar?: (channelId: number, avatarUri: string | null) => void;
  onOpenCreateStory?: () => void;
  onViewStory?: (storyIndex: number) => void;
  onLogout: () => void;
  onBack: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  language,
  channels = [],
  stories = [],
  onUpdateProfile,
  onClearAllChats,
  onOpenSettings,
  onOpenChangePassword,
  onSelectChannel,
  onCreateChannel,
  onDeleteChannel,
  onUpdateChannelAvatar,
  onOpenCreateStory,
  onViewStory,
  onLogout,
  onBack,
  isDarkMode,
  onToggleTheme
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedChannelForPhoto, setSelectedChannelForPhoto] = useState<number | null>(null);
  const t = getT(language);

  // Filter channels created by this user
  const userChannels = channels.filter(
    (ch) => ch.ownerId === profile.id || ch.isOwner
  );

  // Filter user's own active stories
  const userStories = stories.filter(
    (st) => st.authorId === profile.id || st.isMine
  );

  const handleSave = () => {
    onUpdateProfile({
      name: name.trim() || profile.name,
      username: username.trim().startsWith('@') ? username.trim() : `@${username.trim()}`,
      bio: bio.trim()
    });
    setIsEditing(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdateProfile({ avatarUri: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    onUpdateProfile({ avatarUri: null });
  };

  // Channel avatar change from profile
  const handleChannelPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedChannelForPhoto && onUpdateChannelAvatar) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdateChannelAvatar(selectedChannelForPhoto, event.target?.result as string);
        setSelectedChannelForPhoto(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerChannelPhotoUpload = (channelId: number) => {
    setSelectedChannelForPhoto(channelId);
    channelFileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f4f4f5] dark:bg-[#0e1621] overflow-y-auto select-none">
      <div className="h-[60px] px-3 flex items-center gap-2 shrink-0 bg-white dark:bg-[#17212b] border-b border-gray-200 dark:border-white/5 sticky top-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-800 dark:text-white active:bg-black/10 dark:active:bg-white/10 transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{language === 'ru' ? 'Профиль' : 'Profile'}</h1>
      </div>

      {/* Hidden file input for channel photo updates */}
      <input
        type="file"
        ref={channelFileInputRef}
        onChange={handleChannelPhotoChange}
        accept="image/*"
        className="hidden"
      />

      <div className="max-w-lg mx-auto w-full p-4 pb-28 space-y-4">
        {/* Header card with Avatar & ID & Stories ring */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 group">
            {/* If user has active stories, show gradient stories ring */}
            <div
              className={`p-1 rounded-full transition ${
                userStories.length > 0
                  ? 'bg-gradient-to-tr from-rose-500 via-purple-500 to-sky-400 shadow-md cursor-pointer'
                  : ''
              }`}
              onClick={() => {
                if (userStories.length > 0 && onViewStory) {
                  const globalIdx = stories.findIndex((s) => s.id === userStories[0].id);
                  onViewStory(globalIdx !== -1 ? globalIdx : 0);
                }
              }}
              title={userStories.length > 0 ? (language === 'ru' ? 'Смотреть историю' : 'View story') : undefined}
            >
              {profile.avatarUri ? (
                <div className="relative">
                  <img
                    src={profile.avatarUri}
                    alt={profile.name}
                    className="w-28 h-28 sm:w-30 sm:h-30 rounded-full object-cover"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAvatar();
                    }}
                    className="absolute -top-1 -right-1 p-1.5 bg-zinc-800 text-white rounded-full hover:bg-rose-600 transition shadow-xs z-10"
                    title={t.removePhoto}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <TelegramAvatar
                  src={null}
                  name={profile.name}
                  id={profile.id}
                  size="3xl"
                  className=""
                />
              )}
            </div>

            {/* Change photo button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-md transition active:scale-95 z-10"
              title={t.changePhoto}
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-sky-500 hover:text-sky-600 font-semibold"
            >
              {profile.avatarUri ? t.changePhoto : t.uploadPhoto}
            </button>
            {profile.avatarUri && (
              <>
                <span className="text-gray-300 dark:text-zinc-700">•</span>
                <button
                  onClick={handleRemoveAvatar}
                  className="text-xs text-rose-500 hover:text-rose-600 font-semibold"
                >
                  {t.removePhoto}
                </button>
              </>
            )}
          </div>

          {/* User ID Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 rounded-full text-xs font-mono font-semibold mb-2 border border-sky-200 dark:border-sky-800/60">
            <Hash className="w-3.5 h-3.5 text-sky-500" />
            <span>ID: #{profile.id}</span>
          </div>

          {isEditing ? (
            <div className="w-full space-y-3 mt-2">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block text-left mb-1">
                  {t.chatNameLabel}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-xl text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block text-left mb-1">
                  @username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-xl text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block text-left mb-1">
                  {t.bioDesc}
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-xl text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Check className="w-4 h-4" /> {t.save}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 text-sm font-medium rounded-xl transition"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <div className="flex items-center justify-center gap-1.5">
                <h2 className="text-[26px] font-semibold text-gray-900 dark:text-white">
                  {profile.name}
                </h2>
                {Boolean(profile.isVerified) && <VerifiedBadge language={language} />}
              </div>
              <button
                type="button"
                onClick={() => {
                  const newStatus = profile.isOnline === false ? true : false;
                  onUpdateProfile({ isOnline: newStatus });
                }}
                className="mx-auto mt-0.5 flex items-center justify-center gap-1.5 cursor-pointer text-[16px]"
                title={language === 'ru' ? 'Нажмите, чтобы переключить сетевой статус' : 'Click to toggle online status'}
              >
                <span
                  className={`w-2 h-2 rounded-full inline-block ${
                    'hidden'
                  }`}
                />
                <span
                  className={`font-normal text-gray-400 dark:text-zinc-400`}
                >
                  {profile.isOnline !== false ? (language === 'ru' ? 'в сети' : 'online') : (language === 'ru' ? 'не в сети (невидимка)' : 'offline (ghost mode)')}
                </span>
              </button>
              <p className="text-[16px] text-sky-500 dark:text-sky-400 mt-1">
                {profile.username}
              </p>
              {(profile.role || (profile.isVerified && profile.username.trim().toLowerCase().replace(/^@?/, '@') === '@orig_manager_creator_tege.new')) && (
                <span className="mt-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {profile.role || (language === 'ru' ? 'Главный волонтёр' : 'Chief Volunteer')}
                </span>
              )}
              <p className="text-[15px] text-gray-500 dark:text-zinc-400 mt-2 px-4">
                "{profile.bio}"
              </p>

              {/* Quick action tiles (Telegram 12.4 style) */}
              <div className="grid grid-cols-3 gap-2 mt-6 w-full">
                {[
                  { icon: Camera, label: language === 'ru' ? 'Выбрать фото' : 'Set photo', onClick: () => fileInputRef.current?.click() },
                  { icon: Pencil, label: language === 'ru' ? 'Изменить' : 'Edit', onClick: () => setIsEditing(true) },
                  { icon: Settings, label: t.settings, onClick: onOpenSettings }
                ].map((tile) => (
                  <button
                    key={tile.label}
                    type="button"
                    onClick={tile.onClick}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-[20px] bg-white dark:bg-zinc-800 text-gray-800 dark:text-white text-[14px] font-medium active:scale-95 transition"
                  >
                    <tile.icon className="w-6 h-6" />
                    <span className="truncate max-w-full px-1">{tile.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Telegram Stories in Profile section */}
        <div className="bg-white dark:bg-[#17212b] rounded-2xl border border-gray-100 dark:border-white/[0.05] p-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-500" />
              <span>{t.stories}</span>
              {userStories.length > 0 && (
                <span className="px-1.5 py-0.2 bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 rounded text-[10px] font-bold">
                  {userStories.length}
                </span>
              )}
            </h3>

            <button
              onClick={onOpenCreateStory}
              className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addStory}</span>
            </button>
          </div>

          {userStories.length > 0 ? (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1">
              {userStories.map((story) => {
                const globalIndex = stories.findIndex((s) => s.id === story.id);
                return (
                  <div
                    key={story.id}
                    onClick={() => onViewStory && onViewStory(globalIndex !== -1 ? globalIndex : 0)}
                    className="w-24 aspect-[9/14] rounded-2xl overflow-hidden relative shadow-sm cursor-pointer hover:opacity-95 transition transform hover:scale-102 shrink-0 group border border-gray-100 dark:border-zinc-800"
                  >
                    {story.mediaUri ? (
                      <img
                        src={story.mediaUri}
                        alt="Story thumb"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-tr ${
                          story.backgroundColor || 'from-sky-500 to-indigo-600'
                        } flex items-center justify-center p-2 text-center text-white text-[10px] font-bold leading-tight`}
                      >
                        {story.text ? story.text.slice(0, 30) : 'Story'}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition" />
                    
                    {/* View count indicator */}
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs rounded-md text-[10px] text-white flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5 text-sky-300" />
                      <span>{story.viewsCount || 1}</span>
                    </div>
                  </div>
                );
              })}

              {/* Add New Story card button */}
              <div
                onClick={onOpenCreateStory}
                className="w-24 aspect-[9/14] rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-sky-500 dark:hover:border-sky-500 flex flex-col items-center justify-center p-2 text-center cursor-pointer transition shrink-0 group"
              >
                <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-500 group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center transition mb-1">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-zinc-400 group-hover:text-sky-500">
                  {language === 'ru' ? 'Ещё история' : 'Add story'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50/70 dark:bg-zinc-800/40 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">
                  {language === 'ru' ? 'Истории в профиле (на 24 часа)' : 'Stories in profile (24 hours)'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {language === 'ru' ? 'Поделитесь фото или мыслями с собеседниками' : 'Share photos or updates with contacts'}
                </p>
              </div>
              <button
                onClick={onOpenCreateStory}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold transition active:scale-95 shrink-0"
              >
                {t.addStory}
              </button>
            </div>
          )}
        </div>

        {/* User's Created Channels Section (requested by user) */}
        <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-500" />
              <span>{t.myChannels}</span>
              {userChannels.length > 0 && (
                <span className="px-1.5 py-0.2 bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 rounded text-[10px] font-bold">
                  {userChannels.length}/1
                </span>
              )}
            </h3>

            {userChannels.length >= 1 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-900 rounded-full">
                {language === 'ru' ? '1 канал на 1 человека' : '1 channel limit'}
              </span>
            ) : onCreateChannel ? (
              <button
                onClick={onCreateChannel}
                className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.createChannelShort}</span>
              </button>
            ) : null}
          </div>

          {userChannels.length > 0 ? (
            <div className="space-y-2">
              {userChannels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => onSelectChannel && onSelectChannel(channel)}
                  className="p-3 bg-gray-50/70 hover:bg-gray-100/80 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 border border-gray-100 dark:border-zinc-800 rounded-2xl cursor-pointer transition flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Channel Avatar with quick Camera button to change photo */}
                    <div
                      className="relative shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {channel.avatarUri ? (
                        <img
                          src={channel.avatarUri}
                          alt={channel.name}
                          className="w-11 h-11 rounded-2xl object-cover shadow-xs"
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-xs"
                          style={{ backgroundColor: channel.color || '#5BA8FF' }}
                        >
                          {channel.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      {/* Camera icon button to change channel photo */}
                      <button
                        onClick={() => triggerChannelPhotoUpload(channel.id)}
                        className="absolute -bottom-1 -right-1 p-1 bg-sky-500 hover:bg-sky-600 text-white rounded-full shadow-md transition active:scale-90"
                        title={t.changeChannelPhoto}
                      >
                        <Camera className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-sm text-gray-900 dark:text-zinc-100 truncate">
                          {channel.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 font-bold rounded shrink-0">
                          {t.channelOwnerBadge}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500 mt-0.5 truncate">
                        {channel.channelLink && (
                          <span className="text-sky-500 font-mono font-medium">
                            {channel.channelLink}
                          </span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{channel.subscribersCount} {t.subscribers}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerChannelPhotoUpload(channel.id);
                      }}
                      className="px-2.5 py-1 text-[11px] bg-white dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-lg border border-gray-200 dark:border-zinc-600 hover:bg-gray-50 font-medium transition"
                    >
                      {language === 'ru' ? 'Сменить фото' : 'Photo'}
                    </button>
                    {onDeleteChannel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(language === 'ru' ? 'Удалить канал? После этого вы сможете создать новый.' : 'Delete channel? You will be able to create a new one.')) {
                            onDeleteChannel(channel.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title={language === 'ru' ? 'Удалить канал' : 'Delete channel'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-xs text-sky-500 font-semibold group-hover:translate-x-0.5 transition">
                      {t.openChannel} →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-50/70 dark:bg-zinc-800/40 rounded-2xl text-center space-y-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                {t.noMyChannels}
              </p>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                {language === 'ru'
                  ? 'Создайте канал, чтобы публиковать посты, новости, опросы и делиться мыслями со всеми!'
                  : 'Create a channel to broadcast posts, news, polls and updates to subscribers!'}
              </p>
              {onCreateChannel && (
                <button
                  onClick={onCreateChannel}
                  className="mt-2 px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition active:scale-95 inline-flex items-center gap-1.5 shadow-sm"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{t.createChannel}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Account Details */}
        <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-4 space-y-4">
          <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-2">
            {t.accountDetails}
          </h3>

          {/* Email (fixed and immutable as requested) */}
          <div className="flex items-start gap-3 px-2">
            <Mail className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {profile.email}
                </p>
                <span className="p-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-400 rounded" title={t.emailCannotChange}>
                  <Lock className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {t.emailCannotChange}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2">
            <Hash className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-mono font-medium text-gray-900 dark:text-zinc-100">
                #{profile.id}
              </p>
              <p className="text-xs text-gray-400">{t.profileIdDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2">
            <AtSign className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {profile.username}
              </p>
              <p className="text-xs text-gray-400">{t.usernameDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2">
            <Info className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {profile.bio}
              </p>
              <p className="text-xs text-gray-400">{t.bioDesc}</p>
            </div>
          </div>
        </div>

        {/* Security / Password section */}
        <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-4 space-y-2">
          <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-2">
            {t.security}
          </h3>

          <button
            onClick={onOpenChangePassword}
            className="w-full flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition text-left"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-sky-500" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {t.changePassword}
                </p>
                <p className="text-xs text-gray-400">
                  {language === 'ru' ? 'Подтверждение старого пароля и новый пароль' : 'Confirm old password and set new'}
                </p>
              </div>
            </div>
            <span className="text-xs text-sky-500 font-medium">Изменить →</span>
          </button>
        </div>

        {/* Clear All Chats & Logout */}
        <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-4 space-y-2">
          {showClearConfirm ? (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2">
                {t.clearAllConfirm}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onClearAllChats();
                    setShowClearConfirm(false);
                    onBack();
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold"
                >
                  {t.confirmClear}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-xl text-xs"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full flex items-center gap-3 py-2 text-rose-500 hover:text-rose-600 text-sm font-medium transition"
            >
              <Trash2 className="w-5 h-5" />
              <span>{t.clearAllChats}</span>
            </button>
          )}

          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 py-2 text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-sm font-medium transition"
            >
              <LogOut className="w-5 h-5" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
