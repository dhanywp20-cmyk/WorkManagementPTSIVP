---
name: design-md
description: >-
  Acuan sistem desain (DESIGN.md) untuk platform Work Management PTS: token warna, tipografi, jarak, sudut,
  bayangan & pola komponen dari produk B2B kelas dunia (Linear, Notion, Stripe, Supabase, Vercel, Intercom,
  Sentry, PostHog, Airtable, Cal.com, Mercury, Slack). Pakai saat membuat atau merapikan halaman / komponen
  platform supaya konsisten & terlihat profesional, saat pemilik bilang tampilan "berantakan", "kurang
  profesional", "kotak-kotak", atau minta gaya seperti produk tertentu, dan saat menyusun DESIGN.md platform.
---

# DESIGN.md - acuan sistem desain

Sumber: VoltAgent/awesome-design-md (MIT, lihat `LICENSE`) - analisis sistem desain situs nyata dalam format
DESIGN.md (Google Stitch). Yang disalin ke `referensi/` hanya 12 produk B2B / alat kerja yang paling dekat
dengan platform ini; koleksi lengkap (84 merek) ada di repo sumbernya.

| Folder | Cocok untuk |
|---|---|
| `linear.app` | daftar kerja padat, status, tiket - rapi & tenang |
| `notion` | dokumen, catatan, Learning Center |
| `stripe` | angka, tabel, keuangan (Incentive), formulir |
| `supabase`, `vercel` | dasbor teknis, kartu metrik, mode gelap |
| `intercom` | percakapan, notifikasi, bantuan |
| `sentry`, `posthog` | analitik, grafik, galat |
| `airtable` | tabel & tampilan data (Request Schedule, BOM) |
| `cal` | jadwal & kalender (Reminder Schedule, Piket) |
| `mercury` | dasbor keuangan bersih |
| `slack` | navigasi kiri, daftar, lencana |

## Cara pakai

1. **Aturan proyek dulu.** Platform punya merek & komponen sendiri (`lib/merek.ts`, `components/shared`,
   `tailwind.config.ts`, `app/globals.css`) dan aturan tampilan pemilik (mis. keterangan sebagai ikon ⓘ
   bukan paragraf, bahasa Indonesia). DESIGN.md referensi adalah ACUAN keputusan - jarak, hierarki, skala
   huruf, kepadatan, perilaku komponen - bukan warna / logo merek lain yang ditempel. Jangan menyalin
   identitas merek lain (logo, nama, warna khasnya) ke platform.
2. **Pilih satu acuan per pekerjaan** dari tabel di atas, baca DESIGN.md-nya (token di bagian atas, aturan
   komponen di bawahnya), lalu terjemahkan ke token & komponen platform yang sudah ada.
3. **Satu sistem.** Bila platform belum punya token untuk sesuatu (mis. skala bayangan), tambahkan SEKALI di
   tempat bersama (komponen / config), bukan nilai mentah di tiap halaman.
4. Bila ada `DESIGN.md` di akar repo, itu sistem desain platform sendiri - selalu menang atas referensi.

Pasangan skill lain: `design-taste-frontend` (arah & pemeriksaan visual), `web-design-guidelines` (audit
aksesibilitas & UX), `ui-ux-pro-max` (palet, huruf, pola), `playwright-cli` (buka & potret halaman untuk cek).
