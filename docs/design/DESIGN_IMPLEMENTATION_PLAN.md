# Rencana Implementasi — Aurora Glass (Preview Only)

## Baseline
- Repo: `dhanywp20-cmyk/WorkManagementPTSIVP`. Branch produksi Vercel = `main`
  (deployment "Production" di GitHub selalu dari commit `main`; branch lain → "Preview").
- Branch kerja: **`design/aurora-glass-av`**, dibuat dari `main` @ `681863e5`
  (commit yang sedang live). Upstream sengaja **tidak** di-set ke `main`.
- Tidak ada perubahan database, env var, `vercel.json`, atau setting Vercel.

## Arsitektur tema yang sudah ada (dipetakan)
- `components/shared/Tema.tsx`: kelas `html.gelap`, disimpan di `localStorage['wm-tema']`,
  skrip awal `SKRIP_TEMA_AWAL` mencegah kedip. Logout memanggil `kembaliTerang()` sehingga
  **halaman login selalu terang + latar IVP**.
- `app/tema-gelap.css` (+ `-kaca`, `-kontras`): lapisan remap yang membalik palet Tailwind
  (slate/gray/…) dan warna inline umum di **semua modul**. Ini dipakai ulang supaya seluruh
  platform ikut tanpa mengedit tiap modul.
- Latar dasbor: `latarDasbor(merek)` (gambar IVP) di `KerangkaPortal.tsx`.

## Pendekatan
Dua kelas pada `<html>`:

| Kelas | Arti | Kapan aktif |
|---|---|---|
| `aurora` | Shell baru (latar ambient, sidebar & header kaca, font, token lime) | Sudah login, rute portal, preferensi tema = gelap (**bawaan**) |
| `gelap` | Remap warna isi modul (lapisan lama) | Sama seperti `aurora`, **kecuali di Learning Center** — di sana hanya bila pengguna dulu memilih gelap secara eksplisit (perilaku lama) |

- Halaman login: tidak ada kelas → tampilan & latar IVP **persis seperti sekarang**.
- Rute publik (`/kelas`, `/checklist/share`, `/project-progress/share`): perilaku lama.
- Pengguna tetap bisa memilih **mode terang** lewat tombol tema; pilihannya disimpan.
- Semua token di `app/tema-aurora.css`, selektor diawali `html.aurora` sehingga tidak bocor.

## Fase yang dikerjakan di preview ini
1. **Fondasi**: token warna, font Plus Jakarta Sans, kaca, aksen lime, tombol, tab, input.
2. **Shell**: latar ambient menggantikan gambar IVP, sidebar kaca mengambang, header kaca,
   nav bawah mobile.
3. **Dashboard**: sapaan + garis lime, KPI bertint, grafik biru, tab pil, bento kaca.
4. **Modul operasional & lainnya**: ikut otomatis lewat remap `gelap` + permukaan kaca.
5. **Isolasi Learning Center** & verifikasi build.
6. **Preview**: push branch → Vercel Preview → cek URL.

## Belum dikerjakan (fase lanjutan setelah review)
- Komposisi khusus per modul (Ticketing SLA, Project 360 timeline, AV Tools
  workspace teknis, Incentive). Saat ini modul tersebut mendapat bahasa visual baru
  secara global, belum ditata ulang tata letaknya.
- Varian terang dari Aurora.

## Batasan yang dijaga
- Tidak ada perubahan logika, kalkulasi, izin, API, query, cron, ekspor.
- Learning Center tidak diubah file-nya; isinya tidak terkena remap/font baru.
- Tidak push ke `main`, tidak merge, tidak deploy Production.
