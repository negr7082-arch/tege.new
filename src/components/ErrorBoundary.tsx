import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Tege App:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      if (window.caches) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    } catch (e) {
      console.warn('Reset error:', e);
    }
    window.location.reload();
  };

  private handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (window.caches) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        });
      }
    } catch (e) {
      console.warn('Hard reset error:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 dark:bg-zinc-950 p-4 font-sans text-gray-900 dark:text-zinc-100">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-2xl">
              T
            </div>
            <h2 className="text-xl font-bold mb-2">Произошла ошибка при загрузке</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
              {this.state.error?.message || 'Не удалось отобразить интерфейс.'}
            </p>
            <div className="space-y-2">
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl text-sm transition"
              >
                Перезагрузить приложение
              </button>
              <button
                onClick={this.handleHardReset}
                className="w-full py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-medium rounded-xl text-xs transition"
              >
                Сбросить кэш и войти заново
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
