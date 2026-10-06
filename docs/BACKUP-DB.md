# Panduan Backup & Restore Basis Data — Work Management PTS IVP

Dokumen ini menjawab dua pertanyaan: **bagaimana backup mingguan berjalan** dan **bagaimana
mengembalikan datanya** (ke project yang sama, atau ke project Supabase baru).

> Paket Supabase Free tidak menyediakan backup yang bisa Anda restore sendiri. Workflow GitHub
> Actions di repo ini menutup celah itu — gratis, otomatis tiap minggu.

---

## 1. Cara kerja singkat

| Hal | Isi |
|---|---|
| Workflow | `.github/workflows/backup-db.yml` ("Backup basis data mingguan") |
| Jadwal | Tiap **Senin 02:00 WIB** (Minggu 19:00 UTC) + bisa dijalankan manual kapan saja |
| Yang dibackup | Seluruh skema `public`: **semua tabel + datanya, fungsi, trigger, kebijakan RLS, index** |
| Format | `pg_dump` v17 format custom (`-Fc`), lalu **dienkripsi AES-256** dengan `gpg` |
| Penyimpanan | *Artifact* GitHub Actions, disimpan **90 hari** (±13 backup terakhir) |
| Kenapa dienkripsi | Repo ini **publik**; artifact bisa diunduh siapa pun yang punya akses. Tabel `app_settings` memuat token integrasi, jadi dump wajib terenkripsi |

### Yang TIDAK ikut dibackup

- **File di Supabase Storage** (foto, PDF, lampiran) — hanya data tabel. Lihat bagian 7.
- Skema `auth` / `storage` bawaan Supabase. Aplikasi ini memakai login sendiri (tabel `users` di `public`), jadi akun & password **ikut** terbackup.
- Hak akses (`GRANT/REVOKE`) — sengaja tidak ikut (`--no-privileges`). Lihat "Setelah restore" di bagian 5.
- Variabel environment Vercel dan secret GitHub (simpan di password manager, bukan di database).

---

## 2. Persiapan sekali saja: isi 2 secret

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Nama secret | Isi |
|---|---|
| `SUPABASE_DB_URL` | Lihat langkah di bawah |
| `BACKUP_PASSPHRASE` | Kata sandi enkripsi yang **panjang & acak** (≥ 24 karakter). **Wajib** disimpan juga di password manager — tanpa ini backup tidak bisa dibuka dan tidak ada cara memulihkannya |

**Mendapatkan `SUPABASE_DB_URL`:**

1. Supabase Dashboard → project → tombol **Connect** (bagian atas).
2. Pilih **Session pooler** (bukan *Direct connection* — runner GitHub hanya IPv4, Direct memakai IPv6 dan akan gagal).
3. Salin connection string-nya. Bentuknya:
   `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`
4. Ganti `[YOUR-PASSWORD]` dengan password database. Lupa? Settings → Database → **Reset database password**.
5. Bila password mengandung karakter khusus (`@ : / ? # %`), ubah ke bentuk URL-encoded (`@` → `%40`, dst.) atau buat password baru yang hanya huruf & angka.

> Tanpa kedua secret, workflow **tidak gagal** — ia hanya berhenti dengan peringatan kuning
> "backup dilewati". Jadi tidak merusak apa pun bila belum diisi.

---

## 3. Menjalankan backup manual & mengunduhnya

1. GitHub repo → tab **Actions** → pilih **"Backup basis data mingguan"** di sisi kiri.
2. Klik **Run workflow** → branch `main` → **Run workflow**. (Tombol ini baru muncul setelah workflow ada di `main`.)
3. Tunggu ±1–3 menit sampai centang hijau. Bila merah, buka log langkahnya (penyebab tersering: lihat bagian 8).
4. Buka halaman run tersebut → bagian **Artifacts** di bawah → klik `wm-db-YYYYMMDD` (terunduh sebagai `.zip`).
5. Ekstrak zip → ada satu file: `wm-db-YYYYMMDD.dump.gpg`.

Ukuran: basis data saat ini ±28 MB; file `.gpg` kira-kira beberapa MB (terkompresi).

---

## 4. Alat yang dibutuhkan di komputer Anda (Windows)

| Alat | Fungsi | Cara pasang |
|---|---|---|
| **Gpg4win** | Membuka enkripsi `.gpg` | <https://www.gpg4win.org> |
| **PostgreSQL 17 client** (`pg_restore`, `psql`) | Memulihkan dump | Pasang **PostgreSQL 17** dari <https://www.postgresql.org/download/windows/>; di pemilih komponen cukup centang **Command Line Tools**. Versinya harus **17** (sama dengan server Supabase) |

Buka **PowerShell**. Bila perintah tidak dikenali, tambahkan ke PATH:
`C:\Program Files\PostgreSQL\17\bin` dan `C:\Program Files (x86)\GnuPG\bin`.

---

## 5. Restore

### Langkah umum: membuka enkripsi

Di folder tempat file hasil ekstrak berada:

```powershell
gpg --decrypt -o wm-db.dump wm-db-YYYYMMDD.dump.gpg
```

Akan diminta passphrase = isi `BACKUP_PASSPHRASE`. Hasilnya `wm-db.dump` (jangan dibagikan, jangan di-commit; hapus setelah selesai).

Cek isinya tanpa memulihkan apa pun (aman dijalankan kapan saja):

```powershell
pg_restore --list wm-db.dump | more
```

Daftar tabel/fungsi muncul = file sehat dan passphrase benar.

### Skenario A — Kembalikan data satu tabel di project yang sama

Dipakai bila ada baris terhapus/rusak di satu tabel (misal `tickets`).

**Cara aman (disarankan): pulihkan ke wadah sementara, lalu salin hanya yang dibutuhkan.**

1. Buat project Supabase uji (atau database Postgres lokal), aktifkan extension (Skenario C langkah 2).
2. Pulihkan ke sana:
   ```powershell
   pg_restore --no-owner --no-privileges -t tickets -d "<URL_PROJECT_UJI>" wm-db.dump
   ```
3. Di project uji, `SELECT` baris yang hilang, ekspor sebagai `INSERT` / CSV, lalu masukkan ke produksi lewat SQL Editor atau Table Editor.

**Cara cepat (menimpa seluruh tabel dengan isi backup):**

```powershell
pg_restore --no-owner --no-privileges --clean --if-exists -t tickets -d "<SESSION_POOLER_URL>" wm-db.dump
```

> ⚠️ `--clean` **menghapus dulu** tabel itu. Semua data yang masuk setelah tanggal backup pada
> tabel tersebut ikut hilang. Putuskan dulu apakah itu yang Anda mau.

### Skenario B — Pulihkan SEMUA ke project yang sama

Dipakai bila seluruh data rusak (misal salah menjalankan SQL besar). **Semua perubahan sesudah tanggal backup hilang.**

1. Umumkan ke tim: jangan input data selama proses (±5–10 menit).
2. (Disarankan) jalankan backup manual dulu (bagian 3) agar kondisi *sekarang* juga tersimpan.
3. Jalankan:
   ```powershell
   pg_restore --no-owner --no-privileges --clean --if-exists -d "<SESSION_POOLER_URL>" wm-db.dump
   ```
   Peringatan seperti `role "..." does not exist` atau `extension ... already exists` biasanya aman. Yang perlu dicermati: baris berawalan `pg_restore: error:` dan ringkasan di akhir.
4. Lanjut ke **"Setelah restore"** di bawah.

### Skenario C — Pulihkan ke project Supabase BARU (pindah / disaster recovery)

Dipakai bila project lama hilang/korup, atau untuk membuat salinan uji.

1. **Buat project baru** di Supabase (region sama bila bisa). Catat password database-nya.
2. **Aktifkan extension**: Dashboard → Database → Extensions → aktifkan `pg_trgm`, `moddatetime`, `pg_net` (dan `pgcrypto` / `uuid-ossp` bila diminta).
3. Dengan **Session pooler URL** project baru:
   ```powershell
   pg_restore --no-owner --no-privileges --clean --if-exists -d "<URL_PROJECT_BARU>" wm-db.dump
   ```
4. **Buat ulang bucket Storage** dengan nama sama seperti project lama (Storage → New bucket; atur Public/Private sama). Isi file lama **tidak** ikut — lihat bagian 7.
5. **Arahkan aplikasi ke project baru** — Vercel → Settings → Environment Variables, ganti:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan **`SUPABASE_JWT_SECRET`** (JWT secret *project baru*). Lalu **Redeploy**.
6. Pasang ulang secret GitHub `SUPABASE_DB_URL` ke project baru agar backup mingguan terus berjalan.
7. Lanjut ke **"Setelah restore"**.

### Setelah restore (semua skenario)

Karena dump dibuat dengan `--no-privileges`, pastikan hal berikut:

1. **Kunci fungsi rahasia.** Hak akses khusus (`REVOKE ... FROM anon`) tidak ikut terbawa, sehingga fungsi yang tadinya tertutup bisa kembali terbuka. Jalankan ulang bagian `REVOKE/GRANT` dari `supabase/migrations/036_kesehatan_sistem.sql` dan SQL penguncian kredensial yang dulu Anda terapkan. Lalu cek di Admin Panel → Sistem → **Kesehatan Sistem**.
2. **Cek RLS aktif** — SQL Editor:
   ```sql
   select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
   ```
   Hasilnya hanya boleh tabel yang memang sengaja tanpa RLS.
3. **Login dan uji klik**: Dashboard, Ticketing, Reminder Schedule, Daily Report, Incentive (hanya lihat). Tidak boleh ada error 401 / permission denied.
4. **Cek integrasi**: Admin Panel → Integrations. Token WA/Telegram ada di `app_settings` dan ikut terpulihkan — periksa masih valid.
5. Khusus project baru: tes kirim WA/Telegram sekali, dan pastikan cron Vercel (`/api/cron/escalate`, `/api/cron/digest`) tetap jalan dengan `CRON_SECRET` yang sama.

---

## 5b. Uji restore (sekali per 3 bulan)

Backup yang tidak pernah dicoba dipulihkan belum tentu bisa dipulihkan.

1. Buat project Supabase gratis baru, misalnya `wm-uji-restore`.
2. Ikuti **Skenario C** sampai langkah 3.
3. Di SQL Editor project uji: `select count(*) from tickets;` — bandingkan dengan produksi.
4. *Pause*/hapus project uji setelah selesai.

---

## 6. Rutinitas yang disarankan

| Kapan | Apa |
|---|---|
| Tiap Senin pagi | Cek tab Actions — workflow hijau? |
| Sebelum menjalankan SQL besar / migrasi | Jalankan backup manual dulu (bagian 3) |
| Tiap 3 bulan | Uji restore (bagian 5b) |
| Setelah ganti password database | Perbarui secret `SUPABASE_DB_URL` — bila lupa, backup berikutnya merah |
| Setelah ganti `BACKUP_PASSPHRASE` | Backup lama tetap memakai passphrase *lama* — simpan keduanya sampai backup lama kedaluwarsa |

---

## 7. Backup file Storage (belum otomatis)

Foto/PDF di Storage tidak masuk workflow ini. Opsi:

- **Manual berkala**: Dashboard Supabase → Storage → bucket → pilih semua → Download.
- **Otomatis**: tambahkan langkah ke workflow untuk menyalin bucket ke penyimpanan lain (rencana: Cloudflare R2, free tier). Belum dikerjakan — minta bila dibutuhkan.

---

## 8. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Workflow kuning "backup dilewati" | Secret belum diisi / salah nama. Harus persis `SUPABASE_DB_URL` dan `BACKUP_PASSPHRASE` |
| Merah: `password authentication failed` | Password di `SUPABASE_DB_URL` salah / belum di-URL-encode |
| Merah: `could not translate host name` / `Network is unreachable` | Memakai *Direct connection* (IPv6). Ganti ke **Session pooler** |
| Merah: `server version mismatch` | Server naik versi Postgres. Ubah `postgresql-client-17` dan `/usr/lib/postgresql/17/` di workflow ke versi baru |
| `gpg: decryption failed: Bad session key` | Passphrase salah (dump lama memakai passphrase yang berlaku saat itu) |
| `pg_restore: error: unsupported version ... in file header` | `pg_restore` Anda lebih lama dari 17. Pasang PostgreSQL 17 client |
| Banyak `already exists` saat restore | Tambahkan `--clean --if-exists` |
| `permission denied for schema public` setelah restore ke project baru | `grant usage on schema public to anon, authenticated, service_role;` lalu cek lagi lewat "Setelah restore" |
| Tombol *Run workflow* tidak muncul | Workflow belum ada di branch `main` — gabungkan PR maintenance dulu |

---

## 9. Contekan perintah

```powershell
# 1. buka enkripsi
gpg --decrypt -o wm-db.dump wm-db-YYYYMMDD.dump.gpg

# 2. lihat isi (aman)
pg_restore --list wm-db.dump | more

# 3a. semua ke project yang sama / baru
pg_restore --no-owner --no-privileges --clean --if-exists -d "<SESSION_POOLER_URL>" wm-db.dump

# 3b. satu tabel saja
pg_restore --no-owner --no-privileges --clean --if-exists -t nama_tabel -d "<SESSION_POOLER_URL>" wm-db.dump

# 4. hapus file dump setelah selesai
Remove-Item wm-db.dump
```
