-- Admin sudah lama punya tombol "Hapus" untuk akun user (modal-akun.tsx,
-- juga baru saja ditambahkan di panel Kode Acara untuk akun yang mendaftar
-- lewat kode acara). Keduanya gagal untuk akun yang sudah punya AKTIVITAS -
-- pernah mengerjakan quiz, dibuatkan reminder/tiket, jadi PIC, dst - karena
-- 15 foreign key ke users(id) di bawah ini masih ON DELETE NO ACTION: begitu
-- akunnya dihapus, Postgres menolak transaksinya (foreign key violation),
-- dan pesan yang sampai ke admin cuma "Gagal menghapus akun" tanpa penjelasan.
--
-- 13 kolom di antaranya sekadar jejak "siapa yang mengerjakan/disetujui
-- oleh/dinilai oleh" pada baris yang MEMANG harus tetap ada walau orangnya
-- sudah dihapus (quiz, reminder, tiket, project request, incentive split) -
-- diubah ke SET NULL, pola yang sama seperti yang sudah dipakai di kolom
-- sejenis (reminders.installer_user_id, brand_pic_mappings.pic_user_id,
-- users.atasan_id).
--
-- 2 kolom NOT NULL (pts_team_mappings.supervisor_user_id,
-- ticket_support_assignment.user_id) tidak bisa di-NULL-kan - baris tanpa
-- keduanya sudah tidak berarti sama sekali (baris mapping/assignment SEMATA
-- MILIK relasi itu), jadi CASCADE: baris pemetaannya ikut terhapus, bukan
-- baris utama (reminder/tiket/quiz) yang ditinggalinya.

ALTER TABLE incentive_splits
  DROP CONSTRAINT incentive_splits_user_id_fkey,
  ADD CONSTRAINT incentive_splits_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lc_answers
  DROP CONSTRAINT lc_answers_user_id_fkey,
  ADD CONSTRAINT lc_answers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lc_materials
  DROP CONSTRAINT lc_materials_created_by_fkey,
  ADD CONSTRAINT lc_materials_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lc_questions
  DROP CONSTRAINT lc_questions_created_by_fkey,
  ADD CONSTRAINT lc_questions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lc_quiz_attempts
  DROP CONSTRAINT lc_quiz_attempts_graded_by_fkey,
  ADD CONSTRAINT lc_quiz_attempts_graded_by_fkey
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lc_quiz_sessions
  DROP CONSTRAINT lc_quiz_sessions_created_by_fkey,
  ADD CONSTRAINT lc_quiz_sessions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE project_requests
  DROP CONSTRAINT project_requests_internal_approved_by_fkey,
  ADD CONSTRAINT project_requests_internal_approved_by_fkey
    FOREIGN KEY (internal_approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE project_requests
  DROP CONSTRAINT project_requests_internal_sales_id_fkey,
  ADD CONSTRAINT project_requests_internal_sales_id_fkey
    FOREIGN KEY (internal_sales_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reminders
  DROP CONSTRAINT reminders_internal_approved_by_fkey,
  ADD CONSTRAINT reminders_internal_approved_by_fkey
    FOREIGN KEY (internal_approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reminders
  DROP CONSTRAINT reminders_pic_id_fkey,
  ADD CONSTRAINT reminders_pic_id_fkey
    FOREIGN KEY (pic_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reminders
  DROP CONSTRAINT reminders_internal_sales_id_fkey,
  ADD CONSTRAINT reminders_internal_sales_id_fkey
    FOREIGN KEY (internal_sales_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE reminders
  DROP CONSTRAINT reminders_assigned_supervisor_id_fkey,
  ADD CONSTRAINT reminders_assigned_supervisor_id_fkey
    FOREIGN KEY (assigned_supervisor_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ticket_support_assignment
  DROP CONSTRAINT ticket_support_assignment_assigned_by_fkey,
  ADD CONSTRAINT ticket_support_assignment_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE pts_team_mappings
  DROP CONSTRAINT pts_team_mappings_supervisor_user_id_fkey,
  ADD CONSTRAINT pts_team_mappings_supervisor_user_id_fkey
    FOREIGN KEY (supervisor_user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ticket_support_assignment
  DROP CONSTRAINT ticket_support_assignment_user_id_fkey,
  ADD CONSTRAINT ticket_support_assignment_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
