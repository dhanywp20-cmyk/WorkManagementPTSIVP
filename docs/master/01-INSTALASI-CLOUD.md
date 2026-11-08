# 01 — Instalasi Cloud: Supabase + Vercel

Pilihan paling mudah: basis data di **Supabase Cloud**, aplikasi di **Vercel**. Tidak perlu mengurus server.

Yang dibutuhkan: akun Supabase, akun Vercel, akun GitHub (disarankan), dan komputer dengan **Node.js 22** serta **PostgreSQL client 17** (`psql`) untuk memasang skema.

---

## 1. Basis data Supabase (baru & kosong)

1. Buat project di <https://supabase.com/dashboard> → **New project**. Pilih region terdekat (mis. Singapore), simpan **Database password** di password manager.
2. **Database → Extensions**: aktifkan `pg_cron` dan `pg_net` (dipakai jadwal otomatis & notifikasi).
3. Ambil connection string: tombol **Connect** → **Session pooler** → salin, ganti `[YOUR-PASSWORD]`.
4. Pasang skema, berurutan (dari folder paket):

   ```bash
   export DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   psql "$DB_URL" -v ON_ERROR_STOP=1 -f skema/00-ekstensi.sql
   psql "$DB_URL" -v ON_ERROR_STOP=1 -f skema/01-skema-public.sql
   psql "$DB_URL" -v ON_ERROR_STOP=1 -f skema/02-storage.sql
   psql "$DB_URL" -v ON_ERROR_STOP=1 -f skema/03-realtime.sql
   ```

   Windows (PowerShell): ganti `export DB_URL=...` dengan `$env:DB_URL="..."` dan `"$DB_URL"` dengan `$env:DB_URL`.
   Tanpa `psql`: buka **SQL Editor**, tempel isi tiap berkas, **Run** — urutan sama.

5. **Jadwal pg_cron** (`skema/04-cron.sql`): buka berkasnya, ganti setiap `<GANTI_SERVICE_ROLE_KEY>` dan `<GANTI_PROJECT_REF>` dengan nilai project baru, lalu jalankan seperti di atas. Lewati bila berkasnya kosong.
6. **Data demo (opsional)** — untuk presentasi atau uji coba: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f skema/05-data-demo.sql`. Isinya fiktif (PT Demo, 5 jadwal, 5 tiket, 2 request desain, progress project, piket, tech note) dengan 6 akun: `admin.demo`, `manager.demo`, `supervisor.demo`, `teknisi1.demo`, `teknisi2.demo`, `sales.demo` — password semua `Demo#2026`. Sebelum dipakai sungguhan, hapus dengan `skema/06-hapus-data-demo.sql` lalu buat admin asli (`npm run buat-admin`).
7. Catat dari **Settings → API**: Project URL, `anon` key, `service_role` key, dan **JWT Secret**.

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
