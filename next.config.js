const { version } = require('./package.json');

/*
  Identitas build, disuntik SAAT BUILD - bukan dibaca saat berjalan.

  Ketiganya tidak mungkin diketahui peramban: nomor versi ada di package.json
  (tidak ikut terkirim ke klien), SHA commit cuma ada sebagai env Vercel di
  mesin build, dan "kapan dibangun" harus dibekukan pada saat build - kalau
  dihitung di klien ia jadi jam sekarang, bukan jam rilisnya.

  Waktunya sengaja SUDAH DIFORMAT di sini, bukan dikirim sebagai ISO lalu
  diformat di komponen. Next merender komponen klien di server lebih dulu;
  memformat tanggal di dua tempat dengan zona waktu berbeda membuat React
  melaporkan ketidakcocokan hidrasi. String yang sudah jadi identik di mana pun.
*/
const KOMIT = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
const DIBANGUN = new Date().toLocaleString('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_VERSI_APP: version,
    NEXT_PUBLIC_KOMIT_APP: KOMIT,
    NEXT_PUBLIC_DIBANGUN_APP: DIBANGUN,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Paksa HTTPS (Vercel selalu HTTPS). Reversible — tanpa preload.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // CSP minimal yang AMAN (tidak membatasi script/style inline supaya app
          // & Tailwind tidak rusak). Menutup vektor: plugin/objek, base-uri hijack,
          // dan clickjacking lintas-situs. CSP script-src penuh butuh test terpisah.
          { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

module.exports = nextConfig