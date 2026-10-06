# Backup basis data mingguan

Workflow `.github/workflows/backup-db.yml` membuat dump skema `public` tiap Senin 02:00 WIB,
mengenkripsinya (AES-256, `gpg`), lalu menyimpannya sebagai artifact GitHub selama 90 hari.
File di Supabase Storage (foto, PDF) **tidak** ikut - hanya data tabel.

## Sekali saja: isi 2 secret

GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret:

| Secret | Isi |
|---|---|
| `SUPABASE_DB_URL` | Supabase -> tombol **Connect** -> **Session pooler** -> salin connection string (ganti `[YOUR-PASSWORD]` dengan password database). Pakai *Session pooler*, bukan *Direct*, karena runner GitHub hanya IPv4. |
| `BACKUP_PASSPHRASE` | Kata sandi enkripsi yang panjang. **Simpan juga di password manager** - tanpa ini backup tidak bisa dibuka. |

Uji: tab **Actions** -> "Backup basis data mingguan" -> **Run workflow**. Setelah hijau, artifact
`wm-db-YYYYMMDD` muncul di halaman run tersebut.

## Restore (bila suatu saat dibutuhkan)

1. Unduh artifact `wm-db-YYYYMMDD` dari halaman run di tab Actions, ekstrak zip-nya.
2. Buka enkripsinya:
   ```
   gpg --decrypt -o wm-db.dump wm-db-YYYYMMDD.dump.gpg
   ```
3. Pulihkan ke basis data tujuan (pg_restore versi 17):
   ```
   pg_restore --no-owner --no-privileges --clean --if-exists -d "<connection string tujuan>" wm-db.dump
   ```
   Untuk satu tabel saja: tambahkan `-t nama_tabel`.

Uji restore sesekali ke project Supabase cadangan - backup yang tidak pernah dicoba dipulihkan
belum tentu bisa dipulihkan.
