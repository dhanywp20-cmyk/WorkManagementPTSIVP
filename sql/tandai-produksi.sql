-- ============================================================================
--  TANDAI PRODUKSI - mencatat apa yang SUDAH dijalankan di basis data ini
-- ============================================================================
--
--  Jalankan SETELAH sql/urutan-penerapan.sql, SEKALI saja, di basis data
--  produksi PTS IVP. Aman diulang.
--
--  Hanya menyentuh tabel catatan `sql_diterapkan`. Tidak menjalankan satu pun
--  berkas SQL, tidak mengubah satu pun tabel pekerjaan.
--
--  DASAR PENANDAANNYA - bukan tebakan, tapi bukti yang terlihat:
--
--    27 berkas skema    Platformnya berjalan. Ticketing, Reminder Schedule,
--                       Project Progress, Learning Center, Incentive - semua
--                       modul itu hidup, jadi tabel & kolomnya pasti sudah ada.
--
--    lock-credentials   Pemeriksaan jangkauan anon menjawab TERTUTUP untuk
--                       user_credentials, user_sessions, login_attempts,
--                       password_reset_otps.
--
--    lock-users-priv    Trigger trg_guard_users_privileged terpasang dan aktif.
--
--    rapikan-policy     Jumlah policy turun dari 112 ke 84, dan audit_trail
--                       jadi hanya INSERT + SELECT.
--
--    tutup-tabel-...    progress_actions, kpi_snapshot_members, picket_holidays
--                       RLS-nya menyala.
--
--    rls-form-reviews   Policy fr_baca & fr_tulis terpasang.
--
--    rls-lingkup-...    Fungsi lingkup terbentuk dan laporan periksa_lingkup
--                       keluar hasilnya.
--
--    identitas-uuid*    Laporan pemetaan keluar: 462/507 lalu 484/508 baris
--                       terpetakan. Angka itu mustahil ada tanpa berkasnya
--                       dijalankan.
--
--  YANG SENGAJA TIDAK DITANDAI, dan alasannya:
--
--    lock-incentive-splits-rls.sql   Belum pernah terlihat hasilnya. Kalau
--                                    Anda ingat sudah menjalankannya:
--                                      SELECT tandai('lock-incentive-splits-rls.sql');
--                                    Kalau ragu, biarkan - statusnya BELUM
--                                    lebih jujur daripada tertandai keliru.
--
--    rls-project-progress.sql        Sama. Ia syarat bagi rls-lingkup-project,
--                                    jadi kemungkinan besar sudah - tapi
--                                    "kemungkinan besar" bukan bukti.
--
--    identitas-uuid-putuskan.sql     Hasilnya belum pernah terlihat.
--
--    rls-nyalakan.sql                Memang belum. Itu langkah berikutnya.
--
--    unlock-credentials-rls.sql      Pembatalan darurat. Tidak pernah ditandai,
--                                    dan tandai() akan menolaknya.
-- ============================================================================

SELECT tandai_semua_skema() AS hasil_skema;

SELECT tandai(b, 'terbukti dari hasil pemeriksaan di sesi audit') AS hasil
FROM unnest(ARRAY[
  'lock-credentials-rls.sql',
  'lock-users-privileged-columns.sql',
  'rapikan-policy.sql',
  'tutup-tabel-terlewat.sql',
  'rls-form-reviews.sql',
  'rls-lingkup-project.sql',
  'identitas-uuid.sql',
  'identitas-uuid-lanjutan.sql',
  'identitas-uuid-usulan.sql',
  'identitas-uuid-terapkan.sql',
  'urutan-penerapan.sql'
]) AS b;


-- ─── LAPORAN ────────────────────────────────────────────────────────────────
--  Query terakhir. Yang tersisa berstatus BELUM adalah pekerjaan sungguhan
--  yang menunggu - daftarnya pendek dan setiap barisnya punya alasan.
SELECT urutan, golongan, berkas,
       CASE WHEN golongan = 'pembatalan'     THEN 'JANGAN JALANKAN - darurat saja'
            WHEN golongan = 'periksa'        THEN 'alat baca'
            WHEN diterapkan_pada IS NOT NULL THEN 'sudah'
            ELSE                                  'BELUM' END AS status,
       diterapkan_pada
FROM sql_diterapkan
ORDER BY (CASE WHEN golongan='pembatalan' THEN 3
               WHEN golongan='periksa' THEN 2
               WHEN diterapkan_pada IS NULL THEN 0 ELSE 1 END), urutan;
