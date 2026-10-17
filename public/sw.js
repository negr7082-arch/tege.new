// Self-clearing service worker for development/preview reliability
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Do not intercept or cache during active development
self.addEventListener('fetch', (event) => {
  // Pass through to network directly
  return;
});
