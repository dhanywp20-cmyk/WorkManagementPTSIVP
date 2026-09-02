-- =====================================================================
-- Reminder Schedule: Edit dibuka ke SETIAP AKTOR yang sungguh
-- bersinggungan - bukan cuma assignee, dan bukan cuma Admin/Full Access.
-- =====================================================================
--
-- Susulan dari sql/edit-scoped-ke-assignee.sql. Klarifikasi eksplisit:
-- "Ticket Troubleshooting dan Reminder Schedule harus nya sama... yang
-- saya maksud bisa edit itu setiap aktor pasti insert/update status dari
-- create, assign, dan update status kegiatan. Yang belum ada: Sales salah
-- masukin data yang di-request harus nya bisa edit, dan Team yang update
-- mengisi status/note harus nya bisa edit. Sekarang kalau ada salah kata
-- atau perubahan assign, terkadang harus lewat Supabase atau lewat admin."
--
-- Beda dari Ticketing/Design Project (kepemilikan tunggal jelas):
-- reminders punya alur multi-tahap dengan BEBERAPA aktor sah sekaligus -
-- Sales yang MEMBUAT request, dan Tim yang DITUGASKAN mengerjakannya.
-- Keduanya berhak membetulkan bagiannya sendiri tanpa admin turun tangan:
--
--   Sales/pembuat  - salah ketik nama project, catatan, alamat, dst.
--   Tim ditugaskan - update status pekerjaan, catatan progres.
--
-- rm_update dulu qual=true (siapa pun yang login bisa ubah jadwal siapa
-- pun - lubang yang sama seperti tickets/project_requests). Dipersempit
-- ke kolom-kolom aktor yang sah di sepanjang alurnya:
--
--   sales_user_id / sales_name / created_by    - pembuat request aslinya
--   assign_user_id / assigned_to / assign_name - tim yang ditugaskan
--   assigned_supervisor_id                     - supervisor tahap assign
--   internal_sales_id / internal_sales_id_2    - reviewer internal_review
--
-- Jalankan SESUDAH sql/full-access-jwt-dan-delete-rls.sql.
-- =====================================================================

DROP POLICY IF EXISTS rm_update ON public.reminders;
CREATE POLICY rm_update ON public.reminders
  FOR UPDATE TO anon, authenticated
  USING (
    public.admin_atau_full_access()
    OR sales_user_id = jwt_user_id()
    OR sales_name = jwt_full_name()
    OR created_by = jwt_claim('username')
    OR assign_user_id = jwt_user_id()
    OR assigned_to = jwt_claim('username')
    OR assign_name = jwt_full_name()
    OR assigned_supervisor_id = jwt_user_id()
    OR internal_sales_id = jwt_user_id()
    OR internal_sales_id_2 = jwt_user_id()
  )
  WITH CHECK (
    public.admin_atau_full_access()
    OR sales_user_id = jwt_user_id()
    OR sales_name = jwt_full_name()
    OR created_by = jwt_claim('username')
    OR assign_user_id = jwt_user_id()
    OR assigned_to = jwt_claim('username')
    OR assign_name = jwt_full_name()
    OR assigned_supervisor_id = jwt_user_id()
    OR internal_sales_id = jwt_user_id()
    OR internal_sales_id_2 = jwt_user_id()
  );

-- =====================================================================
-- SISI KODE (app/reminder-schedule/page.tsx):
--
-- bolehEditReminder(r) - fungsi baru, dipakai menggantikan syarat lama
-- `role === 'team'` (siapa pun Team, tak peduli terlibat atau tidak) di:
--   - Re-Schedule (3 titik: detail modal, kartu mobile, tabel desktop)
--   - Resend Review
--   - Panel "Update Status"
--   - Tombol "Edit" (openEdit - form lengkap: nama project, catatan,
--     assignment, dsb) - dulu (isAdmin || isManager) SAJA, sekarang
--     Sales pembuat & Tim ditugaskan ikut bisa membukanya. Inilah yang
--     langsung menjawab "salah kata/salah assign harus lewat admin".
--
-- DIVERIFIKASI (simulasi JWT langsung terhadap satu baris nyata):
--   - Sales pembuat (sales_name cocok)      -> BISA update
--   - Tim yang ditugaskan (assign_name cocok) -> BISA update
--   - Tim lain yang tidak terkait sama sekali -> DITOLAK (0 baris)
-- =====================================================================
