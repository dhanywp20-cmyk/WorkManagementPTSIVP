# Arsip data kalkulator jarak lempar proyektor

Data mentah dari kalkulator / simulator resmi pabrikan, disimpan supaya katalog proyektor (`lib/data/*-tdc.json`) bisa dibuat ulang **tanpa internet**, juga kalau situs pabrikan ditutup.

| Folder | Sumber | Buat ulang katalog |
|---|---|---|
| `panasonic-2.79/` | Panasonic Throw Distance Calculator 2.79 | `node scripts/impor-panasonic-tdc.mjs arsip/tdc/panasonic-2.79 2.79` |
| `epson-2.7.2/` | Epson Projector Throw Distance Simulator 2.7.2 | `node scripts/impor-epson-tdc.mjs arsip/tdc/epson-2.7.2` |
| `vivitek-2026-11-02/` | Vivitek Projection Simulator (diambil 2026-11-02) | `node scripts/impor-vivitek-tdc.mjs arsip/tdc/vivitek-2026-11-02` |

Saat diarsipkan (2026-11-02), ketiga perintah di atas menghasilkan katalog yang **sama persis byte demi byte** dengan `lib/data/*-tdc.json` yang dipakai aplikasi.

- Aplikasi tidak pernah membaca folder ini, dan folder ini tidak ikut ter-deploy (`.vercelignore`). Jadi tidak ada beban di Vercel maupun Supabase.
- Versi baru Epson / Vivitek: jalankan skripnya dengan URL situs (atau tanpa argumen). Data mentahnya otomatis diarsipkan ke folder baru di sini.
- Versi baru Panasonic: unduh `ModelData.js` & `ModelDataDef.js` dari `docs.connect.panasonic.com/projector/calculator/tdc/js/include/` ke `panasonic-<versi>/`, lalu jalankan skrip impornya.
- Setiap folder punya `SUMBER.md`: asal berkas, tanggal unduh, dan perintah impornya.
