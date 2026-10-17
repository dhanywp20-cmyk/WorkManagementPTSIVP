-- 053 - Project Progress: nama "Support di lokasi" per checklist, diketik manual oleh admin.
--
-- Handler (checklist_anggota) adalah akun aplikasi. Bila handler bekerja remote, orang yang benar-benar
-- ada di lokasi sering tidak punya akun - cukup namanya (boleh lebih dari satu, dipisah koma).
-- Tampil di detail checklist, kartu lokasi, dan link View-Only proyek.
--
-- Dibaca & ditulis hanya lewat server (service role), jadi TIDAK ada grant kolom untuk anon/authenticated.
-- Kode tetap jalan sebelum migrasi ini dijalankan: kolomnya dibaca dengan kueri terpisah yang toleran
-- (lib/checklist-server.ts -> supportPerDaftar).

ALTER TABLE public.checklist_daftar
  ADD COLUMN IF NOT EXISTS support_lokasi text NOT NULL DEFAULT '';
