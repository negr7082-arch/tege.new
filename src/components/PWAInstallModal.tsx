import React from 'react';
import { Smartphone, Download, X, Share, MoreVertical, PlusSquare, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 mb-4">
            <Smartphone className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            Установить Tege на телефон
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 mb-5">
            Быстрый мессенджер без зависаний и белого экрана. Работает как полноценное мобильное приложение!
          </p>

          {isInstalled ? (
            <div className="w-full p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center justify-center gap-2">
              <Check className="w-5 h-5" />
              Приложение уже установлено!
            </div>
          ) : isInstallable ? (
            <div className="w-full space-y-3">
              <button
                onClick={async () => {
                  const res = await install();
                  if (res) onClose();
                }}
                className="w-full py-3.5 px-4 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition"
              >
                <Download className="w-5 h-5" />
                <span>Установить сейчас</span>
              </button>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                Нажмите кнопку выше и подтвердите установку на экран телефона.
              </p>
            </div>
          ) : isIOS ? (
            <div className="w-full text-left bg-gray-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-gray-100 dark:border-zinc-700/60 space-y-3 text-xs text-gray-600 dark:text-zinc-300">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">
                Инструкция для iPhone (Safari):
              </p>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                <span>
                  Нажмите кнопку <Share className="w-4 h-4 inline-block text-sky-500 mx-0.5" /> «Поделиться» внизу экрана Safari.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                <span>
                  Прокрутите вниз и выберите <PlusSquare className="w-4 h-4 inline-block text-gray-500 mx-0.5" /> <strong>«На экран Домой»</strong>.
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full text-left bg-gray-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-gray-100 dark:border-zinc-700/60 space-y-3 text-xs text-gray-600 dark:text-zinc-300">
              <p className="font-semibold text-gray-900 dark:text-zinc-100">
                Инструкция для Android (Chrome / Яндекс):
              </p>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                <span>
                  Нажмите на меню браузера <MoreVertical className="w-4 h-4 inline-block text-sky-500 mx-0.5" /> (три точки справа вверху).
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                <span>
                  Выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.
                </span>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-5 text-xs text-gray-500 dark:text-zinc-400 hover:underline"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
