# Work Management Platform — File Master

Paket ini berisi seluruh yang dibutuhkan untuk memasang Work Management Platform di server baru yang masih kosong.

## Isi paket

| Folder / file | Isi |
|---|---|
| `app/`, `components/`, `lib/`, `public/` … | Kode aplikasi (Next.js 16, React 19) |
| `database/INSTAL-DATABASE-LENGKAP.sql` | **Satu file** untuk membangun seluruh basis data dari nol (tabel, fungsi, RLS, Storage, Realtime) |
| `database/DATA-DEMO.sql` | Opsional: akun & data contoh untuk presentasi (hapus dengan `HAPUS-DATA-DEMO.sql`) |
| `database/untuk-pemulihan-backup/` | Hanya dipakai saat memulihkan backup ke server baru — tidak perlu saat instalasi |
| `scripts/master/buat-admin.mjs` | Membuat akun admin pertama |
| `.env.example` | Daftar environment variable |
| `PANDUAN/` | Panduan instalasi, lisensi, backup, dan pembaruan |
| `VERSI.txt` | Versi paket dan tanggal pembuatan |

## Urutan pemasangan

1. Siapkan basis data Supabase dan jalankan `database/INSTAL-DATABASE-LENGKAP.sql` (sekali jalan) → [PANDUAN/01-INSTALASI-CLOUD.md](PANDUAN/01-INSTALASI-CLOUD.md) bagian 1.
2. Pilih tempat menjalankan aplikasi:
   - **Vercel (cloud)** → [PANDUAN/01-INSTALASI-CLOUD.md](PANDUAN/01-INSTALASI-CLOUD.md)
   - **Server sendiri (lokal / VPS)** → [PANDUAN/02-INSTALASI-LOKAL.md](PANDUAN/02-INSTALASI-LOKAL.md)
3. Pasang kunci lisensi → [PANDUAN/03-LISENSI.md](PANDUAN/03-LISENSI.md)
4. Buat akun admin pertama: `npm run buat-admin`
5. Atur backup sejak hari pertama → [PANDUAN/04-BACKUP.md](PANDUAN/04-BACKUP.md)
6. Pembaruan versi → [PANDUAN/05-UPDATE.md](PANDUAN/05-UPDATE.md)

## Edisi

| Menu | Lite | Pro |
|---|:---:|:---:|
| Ticket Troubleshooting, Request Schedule, Request Design Project, Form Review Demo & BAST | ✓ | ✓ |
| Piket Showroom, Daily Report, Unit Movement Log, Project Progress, Summary Project | ✓ | ✓ |
| Tech Note R&D, KPI Team | ✓ | ✓ |
| AV Solution Tools | – | ✓ |
| Learning Center (termasuk kelas eksternal) | – | ✓ |
| Incentive PTS | – | ✓ |

Edisi ditentukan oleh kunci lisensi. Naik dari Lite ke Pro cukup mengganti kunci; data tidak berubah.
