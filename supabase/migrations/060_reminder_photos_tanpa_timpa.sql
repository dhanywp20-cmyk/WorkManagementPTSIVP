-- 060: reminder-photos tidak bisa lagi ditimpa akun lain.
--
-- Kebijakan UPDATE "Allow anon update" membolehkan SEMUA akun login (termasuk tamu/Sales) menimpa foto
-- penyelesaian jadwal milik siapa pun. Satu-satunya pemakainya adalah unggahan upsert:true di
-- reminder-schedule/useUbahStatus.ts - nama berkasnya selalu baru (completion_<id>_<waktu>), jadi tidak pernah
-- benar-benar menimpa. Kode itu sudah memakai upsert:false (PR audit keamanan); migrasi ini dijalankan SESUDAH
-- kode tersebut live supaya unggahan dari versi lama tidak gagal di sela deploy.

drop policy if exists "Allow anon update" on storage.objects;
