# 04 — Backup & Pemulihan

Platform yang sudah berjalan punya **4 hal** yang harus dibackup:

| Bagian | Isi | Seberapa sering |
|---|---|---|
| 1. Basis data | Semua tabel, data, akun, fungsi, RLS | Harian |
| 2. File Storage | Foto, PDF, lampiran (bucket Supabase Storage) | Harian / mingguan |
| 3. Konfigurasi | `.env.local` / environment variable Vercel, kunci lisensi | Setiap berubah |
| 4. Kode | ZIP file master versi yang terpasang | Setiap pembaruan |

Simpan backup di **tempat terpisah** dari server (NAS, Google Drive/OneDrive perusahaan, atau S3), dan **enkripsi** — basis data berisi data pribadi dan password terenkripsi.

---

## 1. Basis data

### Paket Supabase Pro
Supabase Pro membuat backup harian otomatis (7 hari) dan bisa diaktifkan *Point-in-Time Recovery*. Tetap buat salinan mandiri bulanan dengan cara di bawah.

### Backup mandiri dengan `pg_dump` (semua paket)

Butuh PostgreSQL client 17 dan connection string **Session pooler** (Supabase → Connect).

```bash
export DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
NAMA="wm-db-$(date +%Y%m%d)"
pg_dump "$DB_URL" --schema=public --no-owner --no-privileges -Fc -f "$NAMA.dump"
gpg --symmetric --cipher-algo AES256 -o "$NAMA.dump.gpg" "$NAMA.dump" && rm "$NAMA.dump"
```

**Otomatis tiap malam (Linux)** — simpan sebagai `/opt/backup/backup-db.sh`, beri `chmod 700`:

```bash
#!/usr/bin/env bash
set -euo pipefail
source /opt/backup/rahasia.env          # berisi DB_URL=... dan SANDI=... (chmod 600)
cd /opt/backup
NAMA="wm-db-$(date +%Y%m%d)"
pg_dump "$DB_URL" --schema=public --no-owner --no-privileges -Fc -f "$NAMA.dump"
gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase "$SANDI" -o "$NAMA.dump.gpg" "$NAMA.dump"
rm -f "$NAMA.dump"
find /opt/backup -name 'wm-db-*.dump.gpg' -mtime +30 -delete   # simpan 30 hari
```

`crontab -e`: `0 18 * * * /opt/backup/backup-db.sh >> /opt/backup/log.txt 2>&1` (01.00 WIB). Lalu salin folder `/opt/backup` ke penyimpanan lain (mis. `rclone sync`).

**Windows**: simpan perintah yang sama sebagai `.ps1` dan jadwalkan dengan Task Scheduler.

**Supabase self-hosted**: jalankan `pg_dump` ke `postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres`, ditambah backup volume Docker (`volumes/db`, `volumes/storage`) saat container berhenti.

### Memulihkan

```bash
gpg --decrypt -o wm.dump wm-db-YYYYMMDD.dump.gpg
pg_restore --list wm.dump | head            # cek isi tanpa mengubah apa pun
```

| Kebutuhan | Perintah |
|---|---|
| Server baru yang kosong | Aktifkan ekstensi (`skema/00-ekstensi.sql`), lalu `pg_restore --no-owner --no-privileges -d "$DB_URL" wm.dump`, kemudian `skema/02-storage.sql`, `03-realtime.sql`, `04-cron.sql` |
| Satu tabel yang rusak | Pulihkan dulu ke project/basis data uji: `pg_restore --no-owner --no-privileges -t <tabel> -d "<URL_UJI>" wm.dump`, ambil baris yang diperlukan |
| Seluruh data di server yang sama | `pg_restore --no-owner --no-privileges --clean --if-exists -d "$DB_URL" wm.dump` — **menghapus data setelah tanggal backup**, hentikan aplikasi dulu |

Hapus file `wm.dump` hasil dekripsi setelah selesai.

---

## 2. File Storage

Supabase Storage bisa diakses lewat protokol S3: **Storage → Settings → S3 Connection** → buat *access key*. Lalu dengan [rclone](https://rclone.org):

```bash
rclone config      # remote "supabase": tipe s3, provider Other, endpoint & kunci dari halaman di atas
rclone sync supabase:/ /opt/backup/storage --progress
```

Jadwalkan seperti backup basis data. Untuk memulihkan, balik arah: `rclone copy /opt/backup/storage supabase:/`.

## 3. Konfigurasi

- Simpan isi `.env.local` (atau daftar env Vercel) dan `LISENSI_KUNCI` di **password manager** perusahaan.
- Server lokal: backup juga konfigurasi Nginx (`/etc/nginx/sites-available/`), `crontab -l`, dan `pm2 save` (`~/.pm2/dump.pm2`).
- VPS: aktifkan *snapshot* mingguan dari penyedia (DigitalOcean, AWS, dll.).

## 4. Uji pemulihan

Minimal **sebulan sekali**, pulihkan backup terbaru ke project Supabase uji dan pastikan bisa login. Backup yang tidak pernah diuji belum tentu bisa dipakai.
