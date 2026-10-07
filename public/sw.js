/**
 * Service worker platform - dua pekerjaan:
 *   1. Syarat teknis supaya browser mengizinkan "Tambahkan ke Layar Utama"
 *      (PWA installable butuh SW terdaftar dengan handler fetch).
 *   2. Menerima & menampilkan push notification asli - berjalan walau app/tab
 *      sedang tertutup, karena ini proses browser terpisah, bukan bagian dari
 *      tab manapun.
 *
 * SENGAJA TIDAK melakukan caching agresif (App Shell / offline-first) -
 * seluruh data di platform ini live dari Supabase; menyimpan halaman lama di
 * cache lebih berisiko menampilkan data basi ke pengguna dibanding manfaat
 * offline yang nyaris tidak berguna untuk platform kerja tim yang butuh data
 * terkini. fetch handler kosong ini murni supaya browser menganggap SW-nya
 * "aktif mengontrol" - salah satu syarat installability PWA.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Sengaja tidak memanggil event.respondWith() - biarkan browser menangani
  // request seperti biasa (network langsung). Lihat catatan di atas.
});

/** Waktu bunyi push terakhir (selama service worker hidup - rentetan push datang dalam hitungan detik). */
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
    // Bunyi SEKALI per rentetan: push yang datang berdekatan (beberapa notifikasi
    // sekaligus) cukup satu bunyi/getar, sisanya tetap tampil tapi senyap. Senyap
    // juga bila halaman Work Management sedang terlihat - alarm di halaman itu
    // sudah berbunyi (lib/notif-sound.ts), jangan dobel.
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
      // tag: notifikasi baru dari url yang sama MENIMPA yang lama di panel
      // notifikasi HP, bukan menumpuk jadi puluhan baris kalau orang tidak
      // sempat membuka HP-nya seharian. renotify = bunyi lagi saat menimpa.
      tag: data.url,
      renotify: !senyap,
      silent: senyap,
      // vibrate bersama silent:true ditolak browser (TypeError).
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
      // Tab yang sudah terbuka ke halaman yang sama - fokuskan saja,
      // jangan buka tab baru yang menduplikasi.
      for (const client of clientsArr) {
        try {
          if (new URL(client.url).pathname === targetPath && 'focus' in client) {
            return client.focus();
          }
        } catch { /* url tidak sah - lewati */ }
      }
      // Tab lain yang terbuka ke halaman platform ini - alihkan lalu fokuskan.
      for (const client of clientsArr) {
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }
      // Belum ada tab terbuka sama sekali - buka baru.
      return self.clients.openWindow(targetUrl);
    })
  );
});
