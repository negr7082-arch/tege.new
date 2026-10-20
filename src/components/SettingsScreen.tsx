import React, { useEffect, useState } from 'react';
import { PushState, getPushState, enablePush, disablePush } from '../services/pushService';
import { AppSettings, WallpaperId, TextSize, Language, BlockedUser, UserAccount } from '../types';
import { TegeTopBar } from './TegeTopBar';
import { getT } from '../translations';
import { BlacklistModal } from './BlacklistModal';
import { realtimeNetwork } from '../services/realtimeNetwork';
import { TelegramAvatar } from './TelegramAvatar';
import {
  ArrowLeft,
  Shield,
  Lock,
  Bell,
  Volume2,
  Palette,
  HardDrive,
  Globe,
  Bookmark,
  LogOut,
  Check,
  CheckCheck,
  User,
  Moon,
  Sun,
  Trash2,
  Smartphone,
  UserX,
  ChevronRight,
  Eye,
  Camera,
  Share2,
  Phone,
  Users,
  MoreVertical,
  Clock,
  Key,
  Pencil,
  Sparkles,
  ShieldCheck,
  FolderLock
} from 'lucide-react';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearAllChats: () => void;
  onLogout?: () => void;
  onBack: () => void;
  blockedUsers?: BlockedUser[];
  onUnblockUser?: (userId: number) => void;
  onBlockUser?: (user: BlockedUser) => void;
  currentUserId?: number;
  currentUser?: UserAccount;
  onOpenSavedMessages?: () => void;
  onOpenProfile?: () => void;
  onOpenChangePassword?: () => void;
}

type SettingsSection = 'main' | 'privacy' | 'chat_settings' | 'notifications' | 'data_storage';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onClearAllChats,
  onLogout,
  onBack,
  blockedUsers = [],
  onUnblockUser,
  onBlockUser,
  currentUserId = 0,
  currentUser,
  onOpenSavedMessages,
  onOpenProfile,
  onOpenChangePassword
}) => {
  const [pushState, setPushState] = useState<PushState>('off');
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    getPushState().then(setPushState).catch(() => {});
  }, []);
  const togglePush = async () => {
    const token = currentUser?.token;
    if (!token || pushBusy) return;
    setPushBusy(true);
    const next = pushState === 'on' ? await disablePush(token) : await enablePush(token);
    setPushState(next);
    setPushBusy(false);
  };

  const [activeSection, setActiveSection] = useState<SettingsSection>('main');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [cacheSizeMb, setCacheSizeMb] = useState<number>(18.4);
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);
  const [sessionsTerminatedNotice, setSessionsTerminatedNotice] = useState(false);
  const [activeSessions, setActiveSessions] = useState<Array<{ id: string; token: string; device: string; createdAt: number; current: boolean }>>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  const refreshSessions = async () => {
    if (!currentUser?.token) return;
    setSessionsLoading(true);
    setSessionsError(null);
    const result = await realtimeNetwork.listSessions(currentUser.token);
    setActiveSessions(result.sessions);
    if (!result.ok) setSessionsError(settings.language === 'ru' ? 'Не удалось загрузить устройства' : 'Could not load devices');
    setSessionsLoading(false);
  };

  useEffect(() => {
    if (activeSection === 'privacy' && currentUser?.token) void refreshSessions();
  }, [activeSection, currentUser?.token]);
  const [show2FaModal, setShow2FaModal] = useState(false);
  const [twoFaPasswordInput, setTwoFaPasswordInput] = useState(settings.twoFactorPassword || '');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const t = getT(settings.language);

  const wallpapers: { id: WallpaperId; label: string; class: string }[] = [
    { id: 'pattern', label: t.wallpaperPattern, class: 'wallpaper-pattern' },
    { id: 'dark', label: t.wallpaperDark, class: 'wallpaper-dark' },
    { id: 'emerald', label: t.wallpaperEmerald, class: 'wallpaper-emerald' },
    { id: 'sunset', label: t.wallpaperSunset, class: 'wallpaper-sunset' },
    { id: 'ocean', label: t.wallpaperOcean, class: 'wallpaper-ocean' },
    { id: 'minimal', label: t.wallpaperMinimal, class: 'wallpaper-minimal' }
  ];

  const textSizes: { id: TextSize; label: string; px: string }[] = [
    { id: 'small', label: '13 pt', px: '13px' },
    { id: 'medium', label: '15 pt', px: '15px' },
    { id: 'large', label: '17 pt', px: '17px' },
    { id: 'xlarge', label: '19 pt', px: '19px' }
  ];

  // Helper for 2FA password saving (must be at least 7 chars!)
  const handleSave2Fa = () => {
    setTwoFaError(null);
    if (!twoFaPasswordInput.trim()) {
      onUpdateSettings({
        twoFactorEnabled: false,
        twoFactorPassword: undefined
      });
      setShow2FaModal(false);
      return;
    }

    if (twoFaPasswordInput.trim().length < 7) {
      setTwoFaError(
        settings.language === 'ru'
          ? 'Пароль должен содержать не менее 7 символов!'
          : 'Password must be at least 7 characters!'
      );
      return;
    }

    onUpdateSettings({
      twoFactorEnabled: true,
      twoFactorPassword: twoFaPasswordInput.trim()
    });
    setShow2FaModal(false);
  };

  /* ------------------------------------------------------------- */
  /* SUB-VIEW 1: TELEGRAM PRIVACY & SECURITY (КОНФИДЕНЦИАЛЬНОСТЬ)   */
  /* ------------------------------------------------------------- */
  if (activeSection === 'privacy') {
    return (
      <div className="flex flex-col h-full bg-[#f4f4f5] dark:bg-zinc-950 overflow-y-auto select-none transition-colors">
        {/* Telegram Header */}
        <div className="h-14 px-4 flex items-center gap-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-20">
          <button
            onClick={() => setActiveSection('main')}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 text-gray-700 dark:text-zinc-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 tracking-tight">
            {t.privacyAndSecurity}
          </h2>
        </div>

        <div className="max-w-xl mx-auto w-full p-4 space-y-4">
          {/* Section: КОНФИДЕНЦИАЛЬНОСТЬ (PRIVACY) */}
          <div>
            <span className="px-3 mb-2 block text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              {settings.language === 'ru' ? 'Конфиденциальность' : 'Privacy'}
            </span>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-gray-100 dark:border-zinc-800/80 divide-y divide-gray-100 dark:divide-zinc-800/80 overflow-hidden">
              {/* Чёрный список */}
              <div
                onClick={() => setShowBlacklistModal(true)}
                className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-850 cursor-pointer transition"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t.blackList}
                  </p>
                  <p className="text-xs text-gray-400">
                    {blockedUsers.length > 0
                      ? `${blockedUsers.length} ${settings.language === 'ru' ? 'пользователей' : 'users'}`
                      : (settings.language === 'ru' ? 'Нет пользователей' : 'None')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{blockedUsers.length}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Последняя активность (Last seen) */}
              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {t.lastSeenSetting}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t.lastSeenDesc}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => {
                    const currentOpt = settings.lastSeenPrivacy || 'everyone';
                    const isSelected = currentOpt === opt;
                    const label = opt === 'everyone' ? t.everyone : opt === 'contacts' ? t.myContacts : t.nobody;
                    return (
                      <button
                        key={opt}
                        onClick={() => onUpdateSettings({ lastSeenPrivacy: opt })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Фотография профиля */}
              <div className="p-3.5 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t.photoPrivacySetting}
                  </p>
                  <p className="text-xs text-gray-400">
                    {settings.language === 'ru' ? 'Кто видит фотографию вашего профиля' : 'Who can see your profile photo'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => {
                    const currentOpt = settings.photoPrivacy || 'everyone';
                    const isSelected = currentOpt === opt;
                    const label = opt === 'everyone' ? t.everyone : opt === 'contacts' ? t.myContacts : t.nobody;
                    return (
                      <button
                        key={opt}
                        onClick={() => onUpdateSettings({ photoPrivacy: opt })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Пересылка сообщений */}
              <div className="p-3.5 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t.forwardPrivacySetting}
                  </p>
                  <p className="text-xs text-gray-400">
                    {settings.language === 'ru'
                      ? 'Кто может добавлять ссылку на ваш аккаунт при пересылке ваших сообщений'
                      : 'Who can link to your account when forwarding your messages'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => {
                    const currentOpt = settings.forwardPrivacy || 'everyone';
                    const isSelected = currentOpt === opt;
                    const label = opt === 'everyone' ? t.everyone : opt === 'contacts' ? t.myContacts : t.nobody;
                    return (
                      <button
                        key={opt}
                        onClick={() => onUpdateSettings({ forwardPrivacy: opt })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Голосовые звонки */}
              <div className="p-3.5 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t.callsPrivacySetting}
                  </p>
                  <p className="text-xs text-gray-400">
                    {settings.language === 'ru' ? 'Кто может звонить вам' : 'Who can call you'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => {
                    const currentOpt = settings.callsPrivacy || 'everyone';
                    const isSelected = currentOpt === opt;
                    const label = opt === 'everyone' ? t.everyone : opt === 'contacts' ? t.myContacts : t.nobody;
                    return (
                      <button
                        key={opt}
                        onClick={() => onUpdateSettings({ callsPrivacy: opt })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Группы и каналы */}
              <div className="p-3.5 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t.groupsPrivacySetting}
                  </p>
                  <p className="text-xs text-gray-400">
                    {settings.language === 'ru' ? 'Кто может приглашать вас в группы и каналы' : 'Who can add you to groups and channels'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {(['everyone', 'contacts'] as const).map((opt) => {
                    const currentOpt = settings.groupsPrivacy || 'everyone';
                    const isSelected = currentOpt === opt;
                    const label = opt === 'everyone' ? t.everyone : t.myContacts;
                    return (
                      <button
                        key={opt}
                        onClick={() => onUpdateSettings({ groupsPrivacy: opt })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Section: БЕЗОПАСНОСТЬ (SECURITY) */}
          <div>
            <span className="px-3 mb-2 block text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              {t.security}
            </span>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-gray-100 dark:border-zinc-800/80 divide-y divide-gray-100 dark:divide-zinc-800/80 overflow-hidden">
              {/* Облачный пароль / Двухэтапная аутентификация */}
              <div
                onClick={() => setShow2FaModal(true)}
                className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-850 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {t.cloudPassword}
                    </p>
                    <p className="text-xs text-gray-400">
                      {settings.twoFactorEnabled
                        ? (settings.language === 'ru' ? 'Включён' : 'Enabled')
                        : (settings.language === 'ru' ? 'Выключен' : 'Disabled')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${settings.twoFactorEnabled ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {settings.twoFactorEnabled ? (settings.language === 'ru' ? 'Вкл' : 'On') : (settings.language === 'ru' ? 'Выкл' : 'Off')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Сменить основной пароль аккаунта (не менее 7 символов) */}
              {onOpenChangePassword && (
                <div
                  onClick={onOpenChangePassword}
                  className="p-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-850 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-500 flex items-center justify-center">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                        {t.changePassword}
                      </p>
                      <p className="text-xs text-gray-400">
                        {settings.language === 'ru' ? 'Пароль от 7 символов' : 'Password 7+ characters'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              )}

              {/* Автоудаление сообщений */}
              <div className="p-3.5 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t.autoDeleteSetting}
                  </p>
                  <p className="text-xs text-gray-400">
                    {settings.language === 'ru' ? 'Автоматическое удаление сообщений во всех новых чатах' : 'Auto-delete messages in new chats'}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { id: 'off', label: settings.language === 'ru' ? 'Откл' : 'Off' },
                    { id: '1d', label: settings.language === 'ru' ? '1 день' : '1 day' },
                    { id: '1w', label: settings.language === 'ru' ? '1 нед' : '1 week' },
                    { id: '1m', label: settings.language === 'ru' ? '1 мес' : '1 mo' }
                  ].map((item) => {
                    const isSelected = (settings.autoDeletePeriod || 'off') === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onUpdateSettings({ autoDeletePeriod: item.id as any })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active sessions / devices */}
              <div className="p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{t.sessionsAndDevices}</p>
                    <p className="text-xs text-gray-400">{settings.language === 'ru' ? 'Управляйте входами в аккаунт' : 'Manage devices signed into your account'}</p>
                  </div>
                </div>

                {sessionsLoading && <p className="text-xs text-gray-400">{settings.language === 'ru' ? 'Загрузка устройств…' : 'Loading devices…'}</p>}
                {sessionsError && <p role="alert" className="text-xs text-rose-500">{sessionsError}</p>}
                {!sessionsLoading && activeSessions.length === 0 && !sessionsError && (
                  <p className="text-xs text-gray-400">{settings.language === 'ru' ? 'Активные сеансы не найдены' : 'No active sessions found'}</p>
                )}
                <div className="space-y-2">
                  {activeSessions.map((session) => (
                    <div key={session.token} className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-zinc-800/70 p-3">
                      <Smartphone className="w-4 h-4 shrink-0 text-gray-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-zinc-100 truncate">{session.device}</p>
                        <p className="text-xs text-gray-400">
                          {session.current ? (settings.language === 'ru' ? 'Это устройство · текущий сеанс' : 'This device · current session') : (settings.language === 'ru' ? 'Другой сеанс' : 'Other session')}
                          {session.createdAt ? ' · ' + new Date(session.createdAt).toLocaleString(settings.language === 'ru' ? 'ru-RU' : 'en-US') : ''}
                        </p>
                      </div>
                      {!session.current && (
                        <button
                          disabled={revokingSession === session.token}
                          onClick={async () => {
                            if (!currentUser?.token) return;
                            setRevokingSession(session.token);
                            const ok = await realtimeNetwork.revokeSession(currentUser.token, session.token);
                            setRevokingSession(null);
                            if (ok) await refreshSessions();
                            else setSessionsError(settings.language === 'ru' ? 'Не удалось завершить сеанс' : 'Could not terminate session');
                          }}
                          className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 disabled:opacity-50"
                        >
                          {revokingSession === session.token ? '…' : (settings.language === 'ru' ? 'Выйти' : 'Sign out')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {sessionsTerminatedNotice && (
                  <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl">
                    <Check className="w-3.5 h-3.5" />
                    <span>{settings.language === 'ru' ? 'Другие сеансы завершены' : 'Other sessions terminated'}</span>
                  </p>
                )}
                <button
                  disabled={sessionsLoading || !currentUser?.token || activeSessions.filter((s) => !s.current).length === 0}
                  onClick={async () => {
                    if (!currentUser?.token) return;
                    setSessionsError(null);
                    const ok = await realtimeNetwork.revokeOtherSessions(currentUser.token);
                    if (ok) {
                      setSessionsTerminatedNotice(true);
                      await refreshSessions();
                    } else {
                      setSessionsError(settings.language === 'ru' ? 'Не удалось завершить другие сеансы' : 'Could not terminate other sessions');
                    }
                    setTimeout(() => setSessionsTerminatedNotice(false), 3000);
                  }}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {settings.language === 'ru' ? 'Выйти со всех других устройств' : 'Sign out all other devices'}
                </button>
              </div>div>
            </div>
          </div>

          {/* Section: УДАЛИТЬ АККАУНТ */}
          <div>
            <span className="px-3 mb-2 block text-xs font-bold text-gray-400 uppercase tracking-wider">
              {t.deleteAccountIfAway}
            </span>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-gray-100 dark:border-zinc-800/80 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {t.ifAwayFor}
                </p>
                <p className="text-xs text-gray-400">
                  {settings.language === 'ru' ? 'Удалить аккаунт, если не проявляется активность' : 'Delete account if inactive'}
                </p>
              </div>
              <span className="text-xs font-semibold text-sky-500">
                {settings.language === 'ru' ? '6 месяцев' : '6 months'}
              </span>
            </div>
          </div>
        </div>

        {/* 2FA Password Modal */}
        {show2FaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 text-center">
                {t.cloudPassword}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 text-center mt-1 mb-4">
                {t.cloudPasswordDesc}
              </p>

              {twoFaError && (
                <div className="p-2.5 mb-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
                  {twoFaError}
                </div>
              )}

              <input
                type="password"
                value={twoFaPasswordInput}
                onChange={(e) => setTwoFaPasswordInput(e.target.value)}
                placeholder={settings.language === 'ru' ? 'Минимум 7 символов...' : 'At least 7 characters...'}
                className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent mb-4 transition"
              />

              <div className="flex gap-2">
                <button
                  onClick={handleSave2Fa}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
                >
                  {t.save}
                </button>
                {settings.twoFactorEnabled && (
                  <button
                    onClick={() => {
                      onUpdateSettings({
                        twoFactorEnabled: false,
                        twoFactorPassword: undefined
                      });
                      setTwoFaPasswordInput('');
                      setShow2FaModal(false);
                    }}
                    className="px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold rounded-xl transition"
                  >
                    {settings.language === 'ru' ? 'Откл' : 'Off'}
                  </button>
                )}
                <button
                  onClick={() => setShow2FaModal(false)}
                  className="px-4 py-2.5 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Blacklist Modal */}
        {showBlacklistModal && (
          <BlacklistModal
            language={settings.language}
            currentUserId={currentUserId}
            blockedUsers={blockedUsers}
            onUnblock={(uid) => onUnblockUser && onUnblockUser(uid)}
            onBlockUser={(u) => onBlockUser && onBlockUser(u)}
            onClose={() => setShowBlacklistModal(false)}
          />
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------- */
  /* SUB-VIEW 2: CHAT SETTINGS / APPEARANCE (НАСТРОЙКИ ЧАТОВ)       */
  /* ------------------------------------------------------------- */
  if (activeSection === 'chat_settings') {
    return (
      <div className="flex flex-col h-full bg-[#f4f4f5] dark:bg-zinc-950 overflow-y-auto select-none transition-colors">
        <div className="h-14 px-4 flex items-center gap-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-20">
          <button
            onClick={() => setActiveSection('main')}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 text-gray-700 dark:text-zinc-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 tracking-tight">
            {t.chatSettings}
          </h2>
        </div>

        <div className="max-w-xl mx-auto w-full p-4 space-y-4">
          {/* Live Message Bubble Preview */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-xs border border-gray-100 dark:border-zinc-800">
            <span className="text-[11px] font-semibold text-gray-400 block mb-3 uppercase tracking-wider">
              {settings.language === 'ru' ? 'Предпросмотр' : 'Preview'}
            </span>

            <div className="p-4 rounded-xl bg-gray-100 dark:bg-zinc-800/60 flex flex-col gap-2">
              <div className="flex justify-start">
                <div className="bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-2xl rounded-tl-xs px-3.5 py-2 max-w-[85%] shadow-xs">
                  <p className="tege-msg-text font-normal leading-relaxed">
                    {settings.language === 'ru' ? 'Привет! Как тебе новый дизайн в стиле TEGE?' : 'Hello! How do you like this TEGE style UI?'}
                  </p>
                  <span className="text-[10px] text-gray-400 block text-right mt-0.5">12:00</span>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="bg-sky-500 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[85%] shadow-xs">
                  <p className="tege-msg-text font-normal leading-relaxed">
                    {settings.language === 'ru' ? 'Выглядит отлично, точно как в оригинальном приложении! 🚀' : 'Looks awesome, exactly like the native Android app! 🚀'}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-sky-100">
                    <span>12:01</span>
                    <CheckCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Size Selector */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-xs border border-gray-100 dark:border-zinc-800 space-y-3">
            <label className="text-sm font-semibold text-gray-900 dark:text-zinc-100 block">
              {t.textSize}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {textSizes.map((ts) => {
                const isSelected = settings.textSize === ts.id;
                return (
                  <button
                    key={ts.id}
                    onClick={() => onUpdateSettings({ textSize: ts.id })}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                        : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100'
                    }`}
                  >
                    {ts.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Wallpapers */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-xs border border-gray-100 dark:border-zinc-800 space-y-3">
            <label className="text-sm font-semibold text-gray-900 dark:text-zinc-100 block">
              {t.wallpaper}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {wallpapers.map((wp) => {
                const isSelected = settings.wallpaper === wp.id;
                return (
                  <button
                    key={wp.id}
                    onClick={() => onUpdateSettings({ wallpaper: wp.id })}
                    className={`h-20 rounded-2xl p-2 relative flex flex-col justify-end text-left border-2 transition overflow-hidden group shadow-xs ${
                      isSelected
                        ? 'border-sky-500 ring-2 ring-sky-500/30'
                        : 'border-transparent hover:border-gray-300 dark:hover:border-zinc-700'
                    } ${wp.class}`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md truncate max-w-full">
                      {wp.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dark Mode Switch */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-xs border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.isDarkMode ? <Moon className="w-5 h-5 text-sky-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {t.darkMode}
                </p>
                <p className="text-xs text-gray-400">
                  {settings.isDarkMode ? (settings.language === 'ru' ? 'Включена' : 'Enabled') : (settings.language === 'ru' ? 'Выключена' : 'Disabled')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ isDarkMode: !settings.isDarkMode })}
              className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors ${
                settings.isDarkMode ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- */
  /* SUB-VIEW 3: DATA & STORAGE (ДАННЫЕ И ПАМЯТЬ)                  */
  /* ------------------------------------------------------------- */
  if (activeSection === 'data_storage') {
    return (
      <div className="flex flex-col h-full bg-[#f4f4f5] dark:bg-zinc-950 overflow-y-auto select-none transition-colors">
        <div className="h-14 px-4 flex items-center gap-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-20">
          <button
            onClick={() => setActiveSection('main')}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 text-gray-700 dark:text-zinc-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 tracking-tight">
            {t.dataAndStorage}
          </h2>
        </div>

        <div className="max-w-xl mx-auto w-full p-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-xs border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {t.clearCache}
              </p>
              <p className="text-xs text-gray-400">
                {settings.language === 'ru'
                  ? `Кэш медиа и сообщений: ${cacheSizeMb.toFixed(1)} МБ`
                  : `Media and chat cache: ${cacheSizeMb.toFixed(1)} MB`}
              </p>
            </div>

            {cacheClearedNotice ? (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl">
                <Check className="w-3.5 h-3.5" />
                <span>0.0 МБ</span>
              </span>
            ) : (
              <button
                onClick={() => {
                  setCacheSizeMb(0);
                  setCacheClearedNotice(true);
                  setTimeout(() => setCacheClearedNotice(false), 4000);
                }}
                className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-sky-600 dark:text-sky-300 rounded-xl text-xs font-semibold transition active:scale-95"
              >
                {settings.language === 'ru' ? 'Очистить' : 'Clear'}
              </button>
            )}
          </div>

          {/* Danger Zone: Clear all chats */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-xs border border-gray-100 dark:border-zinc-800">
            {showClearConfirm ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2.5">
                  {t.clearAllConfirm}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onClearAllChats();
                      setShowClearConfirm(false);
                      onBack();
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition"
                  >
                    {t.confirmClear}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-lg text-xs transition"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-between text-rose-500 font-medium text-sm transition"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-rose-500" />
                  <span>{t.clearAllChats}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- */
  /* SUB-VIEW 4: NOTIFICATIONS & SOUNDS                            */
  /* ------------------------------------------------------------- */
  if (activeSection === 'notifications') {
    return (
      <div className="flex flex-col h-full bg-[#f4f4f5] dark:bg-zinc-950 overflow-y-auto select-none transition-colors">
        <div className="h-14 px-4 flex items-center gap-4 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-20">
          <button
            onClick={() => setActiveSection('main')}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 text-gray-700 dark:text-zinc-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 tracking-tight">
            {t.notifications}
          </h2>
        </div>

        <div className="max-w-xl mx-auto w-full p-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800/80 overflow-hidden">
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {settings.language === 'ru' ? 'Push-уведомления на телефон' : 'Phone push notifications'}
                </p>
                <p className="text-xs text-gray-400">
                  {pushState === 'unsupported'
                    ? settings.language === 'ru'
                      ? 'Не поддерживается здесь. Установите сайт на главный экран Chrome и откройте его оттуда.'
                      : 'Not supported here. Install the site to your home screen in Chrome and open it from there.'
                    : pushState === 'denied'
                      ? settings.language === 'ru'
                        ? 'Заблокированы в настройках браузера для этого сайта'
                        : 'Blocked in the browser settings for this site'
                      : pushState === 'on'
                        ? settings.language === 'ru'
                          ? 'Включены: сообщения придут, даже если приложение закрыто'
                          : 'On: messages arrive even when the app is closed'
                        : settings.language === 'ru'
                          ? 'Нажмите, чтобы получать сообщения, когда приложение закрыто'
                          : 'Tap to get messages when the app is closed'}
                </p>
              </div>
              <button
                onClick={togglePush}
                disabled={pushBusy || pushState === 'unsupported' || pushState === 'denied'}
                className={`w-11 h-6 shrink-0 flex items-center rounded-full p-1 transition-colors disabled:opacity-50 ${
                  pushState === 'on' ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {settings.language === 'ru' ? 'Личные чаты' : 'Private Chats'}
                </p>
                <p className="text-xs text-gray-400">
                  {settings.notificationsEnabled ? (settings.language === 'ru' ? 'Включены' : 'Enabled') : (settings.language === 'ru' ? 'Выключены' : 'Disabled')}
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.notificationsEnabled ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {t.sound}
                </p>
                <p className="text-xs text-gray-400">
                  {settings.soundEnabled ? (settings.language === 'ru' ? 'Включён' : 'Enabled') : (settings.language === 'ru' ? 'Выключен' : 'Disabled')}
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.soundEnabled ? 'bg-sky-500 justify-end' : 'bg-gray-300 dark:bg-zinc-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- */
  /* MAIN TELEGRAM ANDROID SETTINGS SCREEN (ROOT)                  */
  /* ------------------------------------------------------------- */
  return (
    <div className="flex flex-col h-full bg-[#f4f4f5] dark:bg-zinc-950 overflow-y-auto select-none transition-colors">
      {/* Top Bar */}
      <div className="h-16 px-4 flex items-center justify-between bg-white dark:bg-zinc-800 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 text-gray-700 dark:text-zinc-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white">
            {t.settings}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {onLogout && (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              title={t.logout}
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full p-4 pb-28 space-y-4">
        {/* TELEGRAM PROFILE HEADER CARD (NO PHONE NUMBER!) */}
        {currentUser && (
          <div className="bg-white dark:bg-zinc-900 rounded-[22px] p-5">
            <div className="flex items-center gap-4">
              <div
                onClick={onOpenProfile}
                className="relative cursor-pointer group"
              >
                <TelegramAvatar
                  src={currentUser.avatarUri}
                  name={currentUser.name}
                  id={currentUser.id}
                  size="xl"
                  isOnline={true}
                  className="ring-2 ring-sky-500/30"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-zinc-900">
                  <Camera className="w-3 h-3" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50 truncate">
                    {currentUser.name}
                  </h2>
                  {onOpenProfile && (
                    <button
                      onClick={onOpenProfile}
                      className="p-1 text-gray-400 hover:text-sky-500 transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs font-semibold text-sky-500 mt-0.5">
                  {t.online}
                </p>
              </div>
            </div>

            {/* Telegram User Details Section (Username, Bio - NO PHONE NUMBER!) */}
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 space-y-2.5">
              <div
                onClick={onOpenProfile}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-850 p-2 rounded-xl transition"
              >
                <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                  {settings.language === 'ru' ? 'Имя пользователя' : 'Username'}
                </p>
                <p className="text-[17px] font-medium text-gray-900 dark:text-white font-mono">
                  {currentUser.username.startsWith('@') ? currentUser.username : `@${currentUser.username}`}
                </p>
              </div>

              {currentUser.bio && (
                <div
                  onClick={onOpenProfile}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-850 p-2 rounded-xl transition"
                >
                  <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                    {settings.language === 'ru' ? 'О себе' : 'Bio'}
                  </p>
                  <p className="text-sm text-gray-800 dark:text-zinc-200">
                    {currentUser.bio}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TELEGRAM SETTINGS CATEGORY GROUP */}
        <div className="bg-white dark:bg-zinc-900 rounded-[22px] overflow-hidden py-1">
          {/* 🔔 Уведомления и звуки */}
          <div
            onClick={() => setActiveSection('notifications')}
            className="px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-zinc-800 cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[11px] bg-gradient-to-b from-rose-400 to-rose-600 text-white flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[17px] font-medium text-gray-900 dark:text-white">
                  {t.notifications}
                </p>
                <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                  {settings.notificationsEnabled ? (settings.language === 'ru' ? 'Включены' : 'Enabled') : (settings.language === 'ru' ? 'Выключены' : 'Disabled')}
                </p>
              </div>
            </div>
            
          </div>

          {/* 🔒 Конфиденциальность (Privacy & Security) */}
          <div
            onClick={() => setActiveSection('privacy')}
            className="px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-zinc-800 cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[11px] bg-gradient-to-b from-emerald-400 to-emerald-600 text-white flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[17px] font-medium text-gray-900 dark:text-white">
                  {t.privacyAndSecurity}
                </p>
                <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                  {settings.language === 'ru' ? 'Код-пароль, сеансы, блокировка' : 'Password, sessions, blacklist'}
                </p>
              </div>
            </div>
            
          </div>

          {/* 💬 Настройки чатов / Оформление */}
          <div
            onClick={() => setActiveSection('chat_settings')}
            className="px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-zinc-800 cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[11px] bg-gradient-to-b from-amber-400 to-amber-600 text-white flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[17px] font-medium text-gray-900 dark:text-white">
                  {t.chatSettings}
                </p>
                <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                  {settings.language === 'ru' ? 'Тема, размер текста, обои' : 'Theme, text size, wallpapers'}
                </p>
              </div>
            </div>
            
          </div>

          {/* 💾 Данные и память */}
          <div
            onClick={() => setActiveSection('data_storage')}
            className="px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-zinc-800 cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[11px] bg-gradient-to-b from-indigo-400 to-indigo-600 text-white flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[17px] font-medium text-gray-900 dark:text-white">
                  {t.dataAndStorage}
                </p>
                <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                  {settings.language === 'ru' ? 'Кэш, память сообщений' : 'Cache, storage usage'}
                </p>
              </div>
            </div>
            
          </div>

          {/* ⭐️ Избранное (Saved Messages) */}
          {onOpenSavedMessages && (
            <div
              onClick={onOpenSavedMessages}
              className="px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-zinc-800 cursor-pointer transition"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-[11px] bg-gradient-to-b from-sky-500 to-sky-700 text-white flex items-center justify-center">
                  <Bookmark className="w-5 h-5 fill-white text-white" />
                </div>
                <div>
                  <p className="text-[17px] font-medium text-gray-900 dark:text-white">
                    {t.savedMessages}
                  </p>
                  <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                    {t.savedMessagesSub}
                  </p>
                </div>
              </div>
              
            </div>
          )}

          {/* 🌐 Язык (Language) */}
          <div
            onClick={() => onUpdateSettings({ language: settings.language === 'ru' ? 'en' : 'ru' })}
            className="px-4 py-3 flex items-center justify-between active:bg-gray-100 dark:active:bg-zinc-800 cursor-pointer transition"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[11px] bg-gradient-to-b from-purple-400 to-purple-600 text-white flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[17px] font-medium text-gray-900 dark:text-white">
                  {t.language}
                </p>
                <p className="text-[15px] text-gray-400 dark:text-zinc-400">
                  {settings.language === 'ru' ? 'Русский (Russian)' : 'English'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] text-sky-400">
                {settings.language === 'ru' ? 'Русский' : 'English'}
              </span>
              
            </div>
          </div>
        </div>

        {/* LOGOUT BUTTON */}
        {onLogout && (
          <div className="bg-white dark:bg-zinc-900 rounded-[22px] px-5 py-4">
            {showLogoutConfirm ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-2.5">
                  {settings.language === 'ru' ? 'Вы уверены, что хотите выйти из аккаунта?' : 'Are you sure you want to log out?'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onLogout}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    {t.logout}
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="px-3.5 py-1.5 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 rounded-xl text-xs transition"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-between text-rose-500 font-semibold text-sm transition"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-rose-500" />
                  <span>{t.logout}</span>
                </div>
                
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
