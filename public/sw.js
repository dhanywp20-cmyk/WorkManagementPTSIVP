
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
});

let terakhirBunyi = 0;
const JEDA_BUNYI_MS = 10000;

self.addEventListener('push', (event) => {
  let data = { title: 'Notifikasi', body: '', url: '/dashboard' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil((async () => {
    const jendela = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const adaTerlihat = jendela.some((c) => c.visibilityState === 'visible');
    const sekarang = Date.now();
    const senyap = adaTerlihat || sekarang - terakhirBunyi < JEDA_BUNYI_MS;
    if (!senyap) terakhirBunyi = sekarang;
    const options = {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url },
      tag: data.url,
      renotify: !senyap,
      silent: senyap,
      ...(senyap ? {} : { vibrate: [120, 60, 120] }),
    };
    await self.registration.showNotification(data.title, options);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';
  const targetPath = targetUrl.split('?')[0];

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        try {
          if (new URL(client.url).pathname === targetPath && 'focus' in client) {
            return client.focus();
          }
        } catch {  }
      }
      for (const client of clientsArr) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
