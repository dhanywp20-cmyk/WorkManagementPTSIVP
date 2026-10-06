# Rotasi kunci Supabase & token Fonnte (WAJIB - audit 6 Okt 2026)

## Kenapa

Repo GitHub ini **publik**. Kunci `service_role` project utama (`frxdbqcojaiosjoghdqk`, berlaku
sampai 2035) pernah ter-commit di riwayat Git (commit awal Mei, dihapus Juni - tapi riwayat
tetap bisa dibuka siapa saja). Kunci itu **masih kunci aktif** (sidiknya sama dengan yang
tersimpan di `rahasia_integrasi` dan di fungsi `check_pending_tickets`). Pemegangnya bisa
membaca & mengubah SELURUH basis data tanpa RLS - termasuk hash password.

Menghapus file / membuat repo private TIDAK cukup: salinan riwayat mungkin sudah tersebar.
Satu-satunya perbaikan adalah **mengganti kuncinya**.

Token Fonnte juga sempat tersimpan tertulis di fungsi DB `handle_ticket_assignment`
(tidak di Git) - ganti juga.

## Urutan (±15 menit, lakukan di luar jam kerja - login mati sebentar di langkah 1-3)

Siapkan nilai baru di catatan pribadi (password manager), **jangan** kirim lewat chat.

1. **Supabase** -> Project Settings -> **JWT Keys** -> bagian *Legacy JWT secret* ->
   **Generate new secret / Rotate**. Catat 3 nilai baru: *JWT secret*, *anon key*, *service_role key*.
   Mulai detik ini kunci lama berhenti berlaku (aplikasi akan gagal sampai langkah 3 selesai).
2. **Vercel** -> project `work-management-ptsivp` -> Settings -> Environment Variables
   (Production & Preview), ganti nilainya:
   - `SUPABASE_JWT_SECRET` -> JWT secret baru (aplikasi menandatangani token login dengan ini)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> anon key baru
   - `SUPABASE_SERVICE_ROLE_KEY` -> service_role key baru
3. **Vercel** -> Deployments -> deployment Production teratas -> **Redeploy**
   (wajib: `NEXT_PUBLIC_*` ditanam saat build).
4. **Supabase** -> SQL Editor, perbarui salinan kunci yang dipakai fungsi DB:
   ```sql
   UPDATE rahasia_integrasi SET nilai = '<service_role key baru>' WHERE kunci = 'supabase.service_role_key';
   ```
5. **GitHub** -> Settings -> Secrets -> Actions: bila `SUPABASE_SERVICE_ROLE_KEY` sudah diisi
   (untuk terbit APK otomatis), ganti dengan yang baru.
6. Jalankan migrasi `supabase/migrations/035_hapus_wa_trigger_lama.sql` dan
   `036_kesehatan_sistem.sql` di SQL Editor.
7. **Fonnte** -> Device -> buat token baru -> masukkan di Admin Panel -> Integrations -> WhatsApp.
8. Periksa: login, buat/lihat 1 ticket, lalu Admin Panel -> Sistem -> **Kesehatan Sistem**
   harus tanpa peringatan merah soal fungsi berahasia / trigger HTTP.

Semua pengguna perlu login ulang setelah rotasi (token lama ditandatangani secret lama) - normal.

## Disarankan sesudahnya

- Jadikan repo **private** (GitHub -> Settings -> Danger Zone -> Change visibility). Vercel Hobby
  tetap bisa deploy dari repo private milik akun pribadi; GitHub Actions private gratis 2.000
  menit/bulan (CI di sini ±5 menit per jalan).
- Jangan pernah menaruh kunci di file yang di-commit; pakai env Vercel / `rahasia_integrasi`.
