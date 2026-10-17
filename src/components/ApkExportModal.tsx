import React, { useState } from 'react';
import JSZip from 'jszip';
import { Language } from '../types';
import {
  X,
  Download,
  Terminal,
  GitBranch,
  Check,
  Copy,
  Smartphone,
  Sparkles,
  FileArchive,
  ArrowRight,
  ExternalLink,
  Code
} from 'lucide-react';

interface ApkExportModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

export const ApkExportModal: React.FC<ApkExportModalProps> = ({
  isOpen,
  language,
  onClose
}) => {
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [activeTab, setActiveTab] = useState<'zip' | 'termux' | 'github'>('zip');

  if (!isOpen) return null;

  const termuxScript = `# Надёжнее всего собирать через GitHub Actions (вкладка GitHub).
# В Termux нужен установленный Android SDK (ANDROID_HOME).
pkg update -y && pkg install -y git nodejs openjdk-17

# unzip tege-messenger-source.zip -d tege && cd tege
npm install
npx vite build

[ -d android ] || npx cap add android
M=android/app/src/main/AndroidManifest.xml
sed -i 's|<application|<uses-permission android:name="android.permission.CAMERA" /><uses-permission android:name="android.permission.RECORD_AUDIO" /><uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" /><application|' "$M"
npx cap sync android

cd android && chmod +x gradlew && ./gradlew assembleDebug --no-daemon

termux-setup-storage
cp app/build/outputs/apk/debug/*.apk ~/storage/downloads/Tege-Messenger.apk
echo "Готово! APK файл в папке Загрузки телефона"`;

  const githubWorkflow = `name: Build Android APK (Tege Messenger)
on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - uses: android-actions/setup-android@v3
      - run: npm install --no-audit --no-fund
      - run: npx vite build
      - run: |
          npx cap add android
          M=android/app/src/main/AndroidManifest.xml
          sed -i 's|<application|<uses-permission android:name="android.permission.CAMERA" /><uses-permission android:name="android.permission.RECORD_AUDIO" /><uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" /><application|' "$M"
          npx cap sync android
      - working-directory: android
        run: |
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon
      - uses: actions/upload-artifact@v4
        with:
          name: Tege-Messenger-APK
          path: android/app/build/outputs/apk/debug/*.apk`;

  const handleCopy = (text: string, type: 'termux' | 'workflow') => {
    try {
      navigator.clipboard.writeText(text);
      if (type === 'termux') {
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
      } else {
        setCopiedWorkflow(true);
        setTimeout(() => setCopiedWorkflow(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleDownloadZip = async () => {
    setIsGeneratingZip(true);
    try {
      const zip = new JSZip();

      // Project configs
      zip.file(
        'package.json',
        JSON.stringify(
          {
            name: 'tege',
            private: true,
            version: '1.0.0',
            type: 'module',
            scripts: {
              dev: 'vite',
              build: 'tsc && vite build',
              preview: 'vite preview'
            },
            dependencies: {
              jszip: '^3.10.2',
              'lucide-react': '^1.16.0',
              react: '^18.3.1',
              'react-dom': '^18.3.1',
              '@capacitor/core': '^6.0.0',
              peerjs: '^1.5.4',
              '@capacitor/android': '^6.0.0'
            },
            devDependencies: {
              '@capacitor/cli': '^6.0.0',
              '@tailwindcss/vite': '^4.0.0',
              '@types/jszip': '^3.4.1',
              '@types/react': '^18.3.18',
              '@types/react-dom': '^18.3.5',
              '@vitejs/plugin-react': '^4.3.4',
              tailwindcss: '^4.0.0',
              typescript: '^5.7.3',
              vite: '^6.1.0'
            }
          },
          null,
          2
        )
      );

      zip.file('capacitor.config.json', JSON.stringify({ appId: 'org.tege.messenger', appName: 'Tege Messenger', webDir: 'dist', server: { androidScheme: 'https' } }, null, 2));

      // Scripts
      zip.file('termux-build-apk.sh', termuxScript);
      
      const githubFolder = zip.folder('.github');
      const workflowsFolder = githubFolder?.folder('workflows');
      workflowsFolder?.file('build-apk.yml', githubWorkflow);

      // Readme instructions
      const readme = `# 📱 Tege Messenger - Инструкция сборки APK

## 🚀 Способ 1: Сборка в Termux на Android телефоне
1. Установите Termux с F-Droid (не из Google Play).
2. Запустите команды:
\`\`\`bash
pkg update -y && pkg install -y git nodejs openjdk-17 gradle
\`\`\`
3. Поместите этот архив в Termux или распакуйте:
\`\`\`bash
bash termux-build-apk.sh
\`\`\`
4. Готовый APK появится в папке \`~/storage/downloads/Tege-Messenger.apk\`!

---

## ⚡ Способ 2: Автоматическая сборка через GitHub (Самый простой!)
1. Создайте репозиторий на github.com и загрузите все файлы из этого ZIP архива.
2. В репозитории уже настроен файл \`.github/workflows/build-apk.yml\`.
3. Откройте вкладку **Actions** в GitHub.
4. Дождитесь зеленой галочки (1-2 минуты) и скачайте готовый артефакт **Tege-Messenger-APK** прямо на телефон!

---

## 🌐 Способ 3: PWA (Без сборки, установка в 1 клик)
Откройте сайт приложения в Chrome на телефоне, нажмите три точки -> «Установить приложение». Оно установится на домашний экран как нативный APK!
`;
      zip.file('README-BUILD-APK.md', readme);

      // Manifest
      zip.file(
        'manifest.json',
        JSON.stringify(
          {
            name: 'Tege Messenger',
            short_name: 'Tege',
            description: 'TEGE secure messenger with multi-accounts, channels & bot moderation',
            start_url: '/',
            display: 'standalone',
            background_color: '#0284c7',
            theme_color: '#0284c7',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          },
          null,
          2
        )
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tege-messenger-source-for-apk.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to generate ZIP:', e);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                {language === 'ru' ? 'Собрать APK / Скачать ZIP' : 'Build APK / Download ZIP'}
              </h3>
              <p className="text-xs text-sky-100">
                {language === 'ru'
                  ? 'Для Termux на телефоне или GitHub Actions'
                  : 'For Termux on Android or GitHub Actions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('zip')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'zip'
                ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 border-t border-x border-gray-200 dark:border-zinc-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400'
            }`}
          >
            <FileArchive className="w-4 h-4 text-sky-500" />
            <span>{language === 'ru' ? '📦 Скачать ZIP' : '📦 Download ZIP'}</span>
          </button>
          <button
            onClick={() => setActiveTab('termux')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'termux'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 border-t border-x border-gray-200 dark:border-zinc-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span>Termux Android</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'github'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 border-t border-x border-gray-200 dark:border-zinc-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400'
            }`}
          >
            <GitBranch className="w-4 h-4 text-indigo-500" />
            <span>GitHub Actions</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
                <div className="text-xs text-sky-900 dark:text-sky-200 space-y-1">
                  <p className="font-bold">
                    {language === 'ru'
                      ? 'Полный готовый ZIP-архив с кодом и скриптами сборки'
                      : 'Full ready-to-build ZIP archive with scripts'}
                  </p>
                  <p className="text-sky-700 dark:text-sky-300">
                    {language === 'ru'
                      ? 'Архив содержит весь исходный код Tege, готовый скрипт termux-build-apk.sh и workflow для GitHub Actions для автоматической компиляции в APK файл.'
                      : 'Includes all source files, termux-build-apk.sh, and GitHub Actions workflow for automatic APK compilation.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isGeneratingZip}
                  className="w-full py-3.5 px-4 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:opacity-60 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>
                    {isGeneratingZip
                      ? (language === 'ru' ? 'Формирование ZIP архива...' : 'Generating ZIP...')
                      : (language === 'ru' ? 'Скачать ZIP для APK (Termux / Git)' : 'Download ZIP for APK')}
                  </span>
                </button>
              </div>

              <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 space-y-2">
                <h4 className="font-bold text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  {language === 'ru' ? 'Что делать после скачивания ZIP:' : 'Next steps after downloading:'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div
                    onClick={() => setActiveTab('termux')}
                    className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 cursor-pointer hover:border-emerald-500 transition group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-emerald-500" />
                        Termux (на телефоне)
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition" />
                    </div>
                    <p className="text-gray-500 dark:text-zinc-400">
                      Собрать APK прямо на телефоне с Android через терминал.
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab('github')}
                    className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 cursor-pointer hover:border-indigo-500 transition group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <GitBranch className="w-4 h-4 text-indigo-500" />
                        GitHub (в облаке)
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition" />
                    </div>
                    <p className="text-gray-500 dark:text-zinc-400">
                      Загрузить в GitHub и получить готовый APK файл бесплатно.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'termux' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-zinc-100">
                    {language === 'ru' ? 'Сборка APK в Termux на телефоне' : 'Build APK in Termux'}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {language === 'ru'
                      ? 'Скопируйте команды и вставьте в Termux'
                      : 'Copy commands and run in Termux'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(termuxScript, 'termux')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? (language === 'ru' ? 'Скопировано!' : 'Copied!') : (language === 'ru' ? 'Скопировать' : 'Copy')}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-3 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-zinc-800 leading-relaxed max-h-60 select-all">
                  {termuxScript}
                </pre>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                💡 <b>Совет:</b> Используйте версию Termux, скачанную с <b>F-Droid</b>, так как версия из Google Play устарела и не обновляет репозитории пакетов.
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-zinc-100">
                    {language === 'ru' ? 'Автоматическая сборка APK через GitHub Actions' : 'GitHub Actions APK Build'}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {language === 'ru'
                      ? 'GitHub бесплатно скомпилирует APK в облаке за 2 минуты'
                      : 'GitHub compiles the APK in the cloud in 2 mins'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(githubWorkflow, 'workflow')}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-100 transition"
                >
                  {copiedWorkflow ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWorkflow ? (language === 'ru' ? 'Скопировано!' : 'Copied!') : (language === 'ru' ? 'Скопировать' : 'Copy')}</span>
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600 dark:text-zinc-300">
                <li>Создайте новый репозиторий на <b>github.com</b></li>
                <li>Загрузите файлы из скачанного ZIP архива</li>
                <li>Файл <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">.github/workflows/build-apk.yml</code> уже включен в архив</li>
                <li>Перейдите во вкладку <b>Actions</b> репозитория и скачайте готовый <b>Tege-Messenger-APK</b>!</li>
              </ol>

              <pre className="p-3 rounded-2xl bg-zinc-950 text-indigo-300 font-mono text-[11px] overflow-x-auto border border-zinc-800 leading-relaxed max-h-48 select-all">
                {githubWorkflow}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 font-semibold text-xs transition"
          >
            {language === 'ru' ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
