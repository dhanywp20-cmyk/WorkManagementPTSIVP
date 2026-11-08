# 01 — Instalasi Cloud: Supabase + Vercel

Pilihan paling mudah: basis data di **Supabase Cloud**, aplikasi di **Vercel**. Tidak perlu mengurus server.

Yang dibutuhkan: akun Supabase, akun Vercel, akun GitHub (disarankan), dan komputer dengan **Node.js 22** serta **PostgreSQL client 17** (`psql`) untuk memasang skema.

---

## 1. Basis data Supabase (baru & kosong)

1. Buat project di <https://supabase.com/dashboard> → **New project**. Pilih region terdekat (mis. Singapore), simpan **Database password** di password manager.
2. Ambil connection string: tombol **Connect** → **Session pooler** → salin, ganti `[YOUR-PASSWORD]`.
3. **Pasang database — SATU file, sekali jalan** (dari folder paket):

   ```bash
   psql "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" -v ON_ERROR_STOP=1 -f database/INSTAL-DATABASE-LENGKAP.sql
   ```

   Isinya lengkap: ekstensi, seluruh tabel, fungsi, trigger, index, RLS, bucket Storage, dan Realtime. Bila ada galat, semuanya dibatalkan otomatis — perbaiki penyebabnya, lalu jalankan ulang file yang sama.
   Tanpa `psql`: **SQL Editor** → **New query** → buka `INSTAL-DATABASE-LENGKAP.sql` dengan Notepad, salin semua, tempel → **Run**. Bila editor menolak karena file terlalu besar, pakai `psql`.

4. **Jadwal pg_cron**: hanya bila paket berisi `database/JADWAL-CRON.sql` — ganti setiap `<GANTI_SERVICE_ROLE_KEY>` dan `<GANTI_PROJECT_REF>` dengan nilai project baru, lalu jalankan dengan cara yang sama.
5. **Data demo (opsional)** — untuk presentasi atau uji coba, jalankan `database/DATA-DEMO.sql` dengan cara yang sama. Isinya fiktif (PT Demo, 5 jadwal, 5 tiket, 2 request desain, progress project, piket, tech note) dengan 6 akun: `admin.demo`, `manager.demo`, `supervisor.demo`, `teknisi1.demo`, `teknisi2.demo`, `sales.demo` — password semua `Demo#2026`. Sebelum dipakai sungguhan, jalankan `database/HAPUS-DATA-DEMO.sql` lalu buat admin asli (`npm run buat-admin`).
6. Catat dari **Settings → API**: Project URL, `anon` key, `service_role` key, dan **JWT Secret**.

> Platform memakai login sendiri (tabel `users`), bukan Supabase Auth. Tidak perlu mengatur Auth provider.

## 2. Kode di GitHub (disarankan)

Vercel paling mudah membaca kode dari GitHub:

1. Buat repository **Private** baru (jangan Public — kode berlisensi).
2. Dari folder paket:

   ```bash
   git init && git add . && git commit -m "Work Management Platform"
   git branch -M main
   git remote add origin https://github.com/<akun>/<repo>.git
   git push -u origin main
   ```

Tanpa GitHub: pasang Vercel CLI (`npm i -g vercel`), lalu jalankan `vercel` dari folder paket.

## 3. Aplikasi di Vercel

1. <https://vercel.com/new> → **Import** repository tadi. Framework terdeteksi otomatis (Next.js).
2. **Environment Variables** — isi dari `.env.example`:

   | Variabel | Isi |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (rahasia) |
   | `SUPABASE_JWT_SECRET` | JWT Secret (rahasia) |
   | `LISENSI_KUNCI` | kunci dari penyedia platform — lihat [03-LISENSI.md](03-LISENSI.md) |
   | `CRON_SECRET` | acak 32+ karakter (`openssl rand -hex 32`) |
   | `NEXT_PUBLIC_APP_URL` | alamat platform, mis. `https://wm.perusahaan.com` |

   Integrasi (`FONNTE_TOKEN`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`) diisi bila dipakai.
3. **Deploy**. Selesai build, buka alamatnya.
4. **Domain sendiri**: Project → Settings → Domains → tambah `wm.perusahaan.com`, ikuti petunjuk DNS. Domain inilah yang dicantumkan di kunci lisensi.
5. **Cron**: `vercel.json` sudah berisi 2 jadwal harian (`/api/cron/escalate`, `/api/cron/digest`). Vercel mengirim `CRON_SECRET` otomatis.

> Setiap kali environment variable diubah, lakukan **Redeploy** agar nilainya terbaca.

## 4. Akun admin pertama

Di komputer Anda, dari folder paket:

```bash
npm ci
cp .env.example .env.local      # isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
npm run buat-admin
```

Masuk ke `/dashboard` dengan akun itu, lalu atur **Admin Panel**: Merek (logo & nama perusahaan), pengguna, kelompok, dan integrasi.

## 5. Pemeriksaan akhir

- [ ] `https://<alamat>/api/health` menjawab `{"ok":true}`
- [ ] Login admin berhasil, Admin Panel → **Lisensi** menunjukkan edisi yang benar
- [ ] Unggah satu foto (mis. di Ticket) berhasil — bucket Storage terpasang
- [ ] Backup pertama sudah dibuat — [04-BACKUP.md](04-BACKUP.md)
