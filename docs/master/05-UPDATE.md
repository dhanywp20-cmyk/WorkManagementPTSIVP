# 05 — Memperbarui ke Versi Baru

Versi baru dikirim sebagai file master baru (`work-management-master-<versi>.zip`). Bila basis data perlu berubah, paket menyertakan **SQL pembaruan** yang disebut di catatan rilis.

1. **Backup dulu** basis data dan `.env.local` — [04-BACKUP.md](04-BACKUP.md).
2. Jalankan SQL pembaruan dari catatan rilis (bila ada), berurutan:
   `psql "$DB_URL" -v ON_ERROR_STOP=1 -f <berkas-pembaruan>.sql`
   Jangan menjalankan ulang `skema/01-skema-public.sql` di basis data yang sudah berisi data.
3. Ganti kode:
   - **Vercel + GitHub**: ekstrak ZIP baru menimpa folder repo (kecuali `.git`), `git add -A && git commit -m "Versi <versi>" && git push`. Vercel deploy otomatis.
   - **Server lokal**: ekstrak ke folder baru, salin `.env.local` lama ke sana, `npm ci && npm run build`, lalu arahkan PM2 ke folder baru (`pm2 delete work-management` lalu `pm2 start npm --name work-management -- start` dari folder baru, `pm2 save`). Folder lama disimpan sampai versi baru terbukti normal.
4. Periksa `/api/health`, login, dan Admin Panel → Lisensi.

Bila ada masalah: kembalikan folder kode lama (server lokal) atau *Promote* deployment sebelumnya di Vercel → Deployments. Bila SQL pembaruan sudah dijalankan, pulihkan juga basis data dari backup langkah 1.
