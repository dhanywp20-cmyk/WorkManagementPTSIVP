const { version } = require('./package.json');

/*
  Identitas build, disuntik SAAT BUILD - bukan dibaca saat berjalan.

  Keduanya tidak mungkin diketahui peramban: nomor versi ada di package.json
  (tidak ikut terkirim ke klien) dan SHA commit cuma ada sebagai env Vercel di
  mesin build. Tanggal build sengaja tidak disuntik / ditampilkan (permintaan
  owner: jadwal rilis tidak diperlihatkan ke pengguna).
*/
const KOMIT = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Jangan umumkan teknologi server (X-Powered-By: Next.js).
  poweredByHeader: false,
  // Source map produksi TIDAK dikirim ke peramban (bawaan Next, ditegaskan):
  // tanpa itu kode asli tidak bisa direkonstruksi dari bundel yang diminifikasi.
  productionBrowserSourceMaps: false,
  env: {
    NEXT_PUBLIC_VERSI_APP: version,
    NEXT_PUBLIC_KOMIT_APP: KOMIT,
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
          // Platform internal: jangan diindeks mesin pencari.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
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