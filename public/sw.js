// Service Worker for SIM-ALKES UPTD RSUD LAMADDUKELLENG
const CACHE_NAME = 'sim-alkes-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click - focus existing tab or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.notification.data?.tab) {
            client.postMessage({
              type: 'NAVIGATE_TAB',
              tab: event.notification.data.tab,
            });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Listen to message from main client to show background notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/logo-app.svg',
      badge: '/logo-app.svg',
      vibrate: [250, 100, 250, 100, 400],
      requireInteraction: true,
      ...options,
    });
  }
});
