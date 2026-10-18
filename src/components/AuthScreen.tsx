import React, { useEffect, useState } from 'react';
import { UserAccount, Language } from '../types';
import { getT } from '../translations';
import { realtimeNetwork } from '../services/realtimeNetwork';
import {
  Mail,
  Lock,
  User,
  AtSign,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Moon,
  Sun,
  Globe,
  Sparkles
} from 'lucide-react';

interface AuthScreenProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onLogin: (account: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  language,
  onLanguageChange,
  isDarkMode,
  onToggleTheme,
  onLogin
}) => {
  // Main screen is Registration by default
  const [isRegister, setIsRegister] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = getT(language);

  const [busy, setBusy] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>('idle');

  // Live @username availability check (debounced) while registering.
  useEffect(() => {
    if (!isRegister) return;
    const raw = username.trim().replace(/^@/, '');
    if (!raw) { setUsernameStatus('idle'); return; }
    if (!/^[A-Za-z0-9_]{3,32}$/.test(raw)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const r = await realtimeNetwork.checkUsername('@' + raw);
      if (cancelled) return;
      if (r.error) setUsernameStatus('idle');
      else setUsernameStatus(r.available ? 'free' : r.reason === 'invalid' ? 'invalid' : 'taken');
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [username, isRegister]);

  const serverError = (code?: string): string => {
    const ru = language === 'ru';
    switch (code) {
      case 'network':
        return ru ? 'Нет связи с сервером Tege. Проверьте интернет и адрес сервера.' : 'Cannot reach the Tege server. Check your connection.';
      case 'email_taken':
        return ru ? 'Этот email уже зарегистрирован — войдите.' : 'This email is already registered — please log in.';
      case 'username_taken':
        return ru ? 'Этот @username уже занят.' : 'This @username is already taken.';
      case 'bad_username':
        return ru ? '@username: 3–32 символа, латиница, цифры и _' : '@username: 3–32 chars, letters, digits and _';
      case 'bad_credentials':
        return ru ? 'Неверный email или пароль!' : 'Incorrect email or password!';
      case 'too_many_requests':
        return ru ? 'Слишком много попыток. Подождите несколько минут.' : 'Too many attempts. Please wait a few minutes.';
      case 'bad_email':
        return ru ? 'Введите корректный email адрес!' : 'Please enter a valid email address!';
      case 'short_password':
        return ru ? 'Пароль должен быть не менее 7 символов!' : 'Password must be at least 7 characters!';
      default:
        return ru ? 'Ошибка сервера. Попробуйте ещё раз.' : 'Server error. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError(
        language === 'ru'
          ? 'Введите корректный email адрес!'
          : 'Please enter a valid email address!'
      );
      return;
    }

    if (password.length < 7) {
      setError(
        language === 'ru'
          ? 'Пароль должен быть не менее 7 символов!'
          : 'Password must be at least 7 characters!'
      );
      return;
    }

    if (isRegister) {
      if (password !== confirmPassword) {
        setError(
          language === 'ru'
            ? 'Пароли не совпадают! Подтвердите пароль 2 раза.'
            : 'Passwords do not match! Please confirm password.'
        );
        return;
      }

      if (!name.trim()) {
        setError(
          language === 'ru'
            ? 'Пожалуйста, введите ваше имя!'
            : 'Please enter your name!'
        );
        return;
      }

      if (!username.trim()) {
        setError(language === 'ru' ? 'Придумайте @username!' : 'Please choose a @username!');
        return;
      }
      if (usernameStatus === 'taken') {
        setError(language === 'ru' ? '@username занят! Выберите другой.' : '@username is taken! Choose another.');
        return;
      }
      if (usernameStatus === 'invalid') {
        setError(serverError('bad_username'));
        return;
      }

      setBusy(true);
      const res = await realtimeNetwork.register({
        email: cleanEmail,
        password,
        name: name.trim(),
        username: username.trim() || undefined
      });
      setBusy(false);
      if (!res.ok || !res.user) {
        setError(serverError(res.error));
        return;
      }
      onLogin(res.user);
    } else {
      setBusy(true);
      const res = await realtimeNetwork.login(cleanEmail, password);
      setBusy(false);
      if (!res.ok || !res.user) {
        setError(serverError(res.error));
        return;
      }
      onLogin(res.user);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-zinc-950 p-4 select-none relative overflow-y-auto">
      {/* Top right quick controls: Language & Theme */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {onLanguageChange && (
          <button
            onClick={() => onLanguageChange(language === 'ru' ? 'en' : 'ru')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-full text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 shadow-xs transition active:scale-95"
            title="Переключить язык"
          >
            <Globe className="w-3.5 h-3.5 text-sky-500" />
            <span>{language.toUpperCase()}</span>
          </button>
        )}

        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-full text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 shadow-xs transition active:scale-95"
            title={isDarkMode ? 'Светлая тема' : 'Тёмная тема'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-500" />}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative my-6">
        {/* App Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white flex items-center justify-center font-bold text-3xl shadow-xl shadow-sky-500/30 mb-3 transform hover:scale-105 transition">
            T
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight">
            {isRegister ? t.authTitleRegister : t.authTitleLogin}
          </h2>

          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
            {isRegister
              ? language === 'ru'
                ? 'Главный экран регистрации: заполните данные, чтобы создать аккаунт и перейти к чатам'
                : 'Registration screen: fill in your details to create an account and access your chats'
              : language === 'ru'
                ? 'Вход по почте и паролю в Tege Messenger'
                : 'Login with email and password into Tege Messenger'}
          </p>

          {/* Sequential 1122 ID preview banner */}
          {isRegister && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 rounded-full text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>{language === 'ru' ? 'Ваш ID начнется с 1122...' : 'Your ID will start with 1122...'}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Email */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {t.enterEmail} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
              {t.emailCannotChange}
            </p>
          </div>

          {isRegister && (
            <>
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                  {language === 'ru' ? 'Ваше имя' : 'Your Name'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === 'ru' ? 'Иван Иванов' : 'Alex Rivera'}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                  {language === 'ru' ? 'Юзернейм @username (поиск по юзу)' : 'Choose @username'} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@chat_razraba"
                    className={`w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 border transition font-mono ${usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-rose-500 focus:ring-rose-500' : 'border-transparent focus:ring-sky-500'}`}
                  />
                </div>
                {usernameStatus === 'taken' ? (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1 px-1">
                    {language === 'ru' ? '@' + username.trim().replace(/^@/, '') + ' занят!' : '@' + username.trim().replace(/^@/, '') + ' is taken!'}
                  </p>
                ) : usernameStatus === 'invalid' ? (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1 px-1">
                    {language === 'ru' ? '3–32 символа: латиница, цифры и _' : '3–32 chars: letters, digits and _'}
                  </p>
                ) : usernameStatus === 'free' ? (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 px-1">
                    {language === 'ru' ? 'Свободно ✓' : 'Available ✓'}
                  </p>
                ) : usernameStatus === 'checking' ? (
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
                    {language === 'ru' ? 'Проверяем…' : 'Checking…'}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
                    {language === 'ru' ? 'Люди смогут найти вас в поиске по этому нику' : 'People can find you by this username'}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
              {t.enterPassword} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
              {language === 'ru' ? 'Минимум 7 символов' : 'At least 7 characters'}
            </p>
          </div>

          {/* Confirm Password (if Registering) */}
          {isRegister && (
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 block mb-1">
                {t.repeatPasswordTwice} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500 border border-transparent transition"
                />
              </div>
            </div>
          )}

          <div className="pt-3">
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 disabled:opacity-60 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/30 transition flex items-center justify-center gap-2 text-sm"
            >
              <span>{isRegister ? (language === 'ru' ? 'Зарегистрироваться и войти в чаты' : 'Register & Enter Chats') : t.loginBtn}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-sky-500 hover:text-sky-600 dark:text-sky-400 font-semibold transition"
          >
            {isRegister ? t.haveAccount : t.noAccount}
          </button>
        </div>
      </div>
    </div>
  );
};
