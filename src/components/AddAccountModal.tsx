import React, { useState } from 'react';
import { UserAccount, Language } from '../types';
import { getT } from '../translations';
import { realtimeNetwork } from '../services/realtimeNetwork';
import { TelegramAvatar } from './TelegramAvatar';
import { X, UserPlus, AlertCircle, Phone, Lock } from 'lucide-react';

interface AddAccountModalProps {
  isOpen: boolean;
  language: Language;
  existingAccounts: UserAccount[];
  maxAccounts?: number;
  onClose: () => void;
  onAddAccount: (newAccount: UserAccount) => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  language,
  existingAccounts,
  maxAccounts = 5,
  onClose,
  onAddAccount
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = getT(language);
  const isLimitReached = existingAccounts.length >= maxAccounts;

  if (!isOpen) return null;

  const handleApplyPreset = (presetName: string, presetHandle: string) => {
    setName(presetName);
    setUsername(presetHandle);
    if (!phoneOrEmail) {
      setPhoneOrEmail(`+7 (999) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`);
    }
    setError(null);
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarUri(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (isLimitReached) {
      setError(t.accountsLimitReached);
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      setError(language === 'ru' ? 'Введите имя аккаунта' : 'Please enter an account name');
      return;
    }

    let cleanUsername = username.trim().toLowerCase();
    if (cleanUsername) {
      cleanUsername = cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`;
    } else {
      cleanUsername = `@user_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Check username collision with existing accounts
    if (existingAccounts.some((acc) => acc.username.toLowerCase() === cleanUsername)) {
      setError(language === 'ru' ? 'Аккаунт с таким юзернеймом уже добавлен' : 'Account with this username already exists');
      return;
    }

    if (password && password.length < 7) {
      setError(language === 'ru' ? 'Пароль должен содержать не менее 7 символов!' : 'Password must be at least 7 characters!');
      return;
    }

    const email = phoneOrEmail.includes('@') ? phoneOrEmail.trim().toLowerCase() : `${cleanUsername.replace('@', '')}@tege.local`;
    // Accounts without a password still need one on the server — generate a private one.
    const effectivePassword = password || Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');

    setBusy(true);
    let res = await realtimeNetwork.register({
      email,
      password: effectivePassword,
      name: cleanName,
      username: cleanUsername,
      phone: !phoneOrEmail.includes('@') ? phoneOrEmail : undefined,
      bio: language === 'ru' ? 'Дополнительный аккаунт в Tege' : 'Secondary account in Tege'
    });
    if (!res.ok && res.error === 'email_taken' && password) {
      // the account already exists on the server — treat it as a login
      res = await realtimeNetwork.login(email, password);
    }
    setBusy(false);

    if (!res.ok || !res.user) {
      const ru = language === 'ru';
      setError(
        res.error === 'network' ? (ru ? 'Нет связи с сервером Tege' : 'Cannot reach the Tege server')
        : res.error === 'username_taken' ? (ru ? 'Этот @username уже занят' : 'This @username is already taken')
        : res.error === 'email_taken' || res.error === 'bad_credentials' ? (ru ? 'Этот email уже занят (или неверный пароль)' : 'This email is already taken (or wrong password)')
        : (ru ? 'Не удалось добавить аккаунт' : 'Could not add the account')
      );
      return;
    }
    const newAccount: UserAccount = {
      ...res.user,
      avatarUri: avatarUri || res.user.avatarUri || null,
      isOnline: true
    };

    onAddAccount(newAccount);
    setName('');
    setUsername('');
    setPhoneOrEmail('');
    setPassword('');
    setAvatarUri(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                {t.addAccount}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                {language === 'ru' ? `Доступно: ${existingAccounts.length} из ${maxAccounts} аккаунтов` : `Available: ${existingAccounts.length} of ${maxAccounts} accounts`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          {isLimitReached ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {t.accountsLimitReached}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300/80">
                {language === 'ru'
                  ? 'Вы уже добавили 5 аккаунтов. Чтобы подключить новый аккаунт, сначала удалите один из имеющихся.'
                  : 'You have reached the maximum of 5 accounts. Please remove an account first to add a new one.'}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition"
                >
                  {language === 'ru' ? 'Понятно' : 'Understood'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Quick Presets */}
              <div>
                <label className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1.5">
                  {language === 'ru' ? 'Быстрый шаблон (в 1 клик):' : 'Quick preset (1 click):'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(
                      language === 'ru' ? `Второй аккаунт #${existingAccounts.length + 1}` : `Secondary #${existingAccounts.length + 1}`,
                      `second_user_${Math.floor(100 + Math.random() * 900)}`
                    )}
                    className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-left text-xs transition"
                  >
                    <span className="font-bold text-gray-800 dark:text-zinc-200 block truncate">
                      💼 {language === 'ru' ? 'Второй профиль' : 'Second profile'}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                      {language === 'ru' ? 'Для личных чатов' : 'For personal chats'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset(
                      language === 'ru' ? 'Рабочий аккаунт' : 'Work Account',
                      `work_office_${Math.floor(100 + Math.random() * 900)}`
                    )}
                    className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-left text-xs transition"
                  >
                    <span className="font-bold text-gray-800 dark:text-zinc-200 block truncate">
                      🏢 {language === 'ru' ? 'Рабочий аккаунт' : 'Work Profile'}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                      {language === 'ru' ? 'Для работы и каналов' : 'For work & channels'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Avatar Preview */}
              <div className="flex items-center gap-3.5 p-3 bg-gray-50 dark:bg-zinc-800/40 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <TelegramAvatar
                  src={avatarUri}
                  name={name || 'U'}
                  id={existingAccounts.length + 1}
                  size="lg"
                />
                <div className="flex-1">
                  <label className="text-xs font-bold text-sky-500 hover:text-sky-600 cursor-pointer block">
                    <span>{language === 'ru' ? 'Загрузить фото профиля' : 'Upload profile photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {language === 'ru' ? 'Или будет отображаться буква имени как в TEGE' : 'Or TEGE letter initial will be used'}
                  </p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1">
                  {language === 'ru' ? 'Имя или Никнейм' : 'Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={language === 'ru' ? 'Например: Иван Иванов или Work' : 'e.g. John Doe'}
                  className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm font-medium text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1">
                  {language === 'ru' ? 'Юзернейм (@username)' : 'Handle (@username)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-mono text-sm">@</span>
                  <input
                    type="text"
                    value={username.replace('@', '')}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="my_second_username"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm font-mono text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                  />
                </div>
              </div>

              {/* Phone or Email */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1">
                  {language === 'ru' ? 'Номер телефона или Email' : 'Phone or Email'}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={phoneOrEmail}
                    onChange={(e) => setPhoneOrEmail(e.target.value)}
                    placeholder="+7 (999) 000-00-00"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm font-medium text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                  />
                </div>
              </div>

              {/* Optional Password */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block mb-1">
                  {language === 'ru' ? 'Пароль (облачный пароль)' : 'Password (optional)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-100 dark:bg-zinc-800 text-sm font-medium text-gray-900 dark:text-zinc-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 disabled:opacity-60 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-sky-500/25 flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{t.addAccount}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
