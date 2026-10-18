// Tege service worker: phone notifications (Web Push). No caching, so updates are never stale.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // The app is on screen: the in-app UI already shows the message, so stay quiet.
      if (wins.some((w) => w.visibilityState === 'visible')) return;
      await self.registration.showNotification(data.title || 'Tege', {
        body: data.body || '',
        tag: data.tag || 'tege',
        renotify: true,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { chatId: data.chatId, chatType: data.chatType }
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if ('focus' in w) return w.focus();
      }
      return self.clients.openWindow('/');
    })()
  );
});
