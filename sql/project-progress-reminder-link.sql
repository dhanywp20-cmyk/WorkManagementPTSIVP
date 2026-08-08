-- ============================================================================
-- Project Progress ← Reminder Schedule — draft otomatis + info Sales
-- ============================================================================
--
--  Reminder berkategori "Konfigurasi" / "Konfigurasi & Training" otomatis
--  membuat DRAFT lokasi di Project Progress. Sinkron SATU ARAH: nilai yang
--  disalin adalah SNAPSHOT saat reminder dibuat. Perubahan berikutnya di kedua
--  sisi tidak saling menulis balik.
--
--  Semua kolom nullable / berdefault → data lama tidak terganggu.
--  Aman dijalankan berulang.
-- ============================================================================

-- ─── 1. Info Sales ──────────────────────────────────────────────────────────
--  Disimpan di DUA level:
--    progress_locations → snapshot dari reminder yang membuat lokasi itu.
--                         Ini sumber yang akurat, karena satu proyek bisa punya
--                         beberapa lokasi dari sales yang berbeda.
--    progress_projects  → dipakai kolom di halaman listing (yang menampilkan
--                         proyek, bukan lokasi). Diisi dari reminder pertama
--                         saat proyek dibuat otomatis, dan bisa disunting admin.
ALTER TABLE progress_projects
  ADD COLUMN IF NOT EXISTS sales_name     TEXT NULL,
  ADD COLUMN IF NOT EXISTS sales_division TEXT NULL;

ALTER TABLE progress_locations
  ADD COLUMN IF NOT EXISTS sales_name     TEXT NULL,
  ADD COLUMN IF NOT EXISTS sales_division TEXT NULL;


-- ─── 2. Asal-usul & penautan ke reminder ────────────────────────────────────
--  origin: 'manual'        → dibuat orang lewat UI Project Progress
--          'auto_reminder' → dibuat otomatis dari Reminder Schedule
ALTER TABLE progress_projects
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE progress_locations
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

DO $$ BEGIN
  ALTER TABLE progress_projects
    ADD CONSTRAINT progress_projects_origin_check
    CHECK (origin IN ('manual', 'auto_reminder'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE progress_locations
    ADD CONSTRAINT progress_locations_origin_check
    CHECK (origin IN ('manual', 'auto_reminder'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--  ON DELETE SET NULL — BUKAN CASCADE. Menghapus reminder TIDAK boleh ikut
--  menghapus draft yang sudah dikerjakan admin di Project Progress; tautannya
--  saja yang dilepas. Ini syarat eksplisit dari desain.
ALTER TABLE progress_locations
  ADD COLUMN IF NOT EXISTS source_reminder_id UUID NULL REFERENCES reminders(id) ON DELETE SET NULL;

ALTER TABLE progress_projects
  ADD COLUMN IF NOT EXISTS source_reminder_id UUID NULL REFERENCES reminders(id) ON DELETE SET NULL;


-- ─── 3. Cegah draft ganda ───────────────────────────────────────────────────
--  Satu reminder hanya boleh melahirkan SATU lokasi draft. Index unik parsial:
--  baris manual (source_reminder_id NULL) tidak ikut dibatasi, dan NULL memang
--  tidak saling bentrok di index unik.
--
--  Ini pengaman di level DB. Pengecekan di aplikasi tetap ada supaya user dapat
--  pesan yang wajar, bukan error constraint mentah.
CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_locations_source_reminder
  ON progress_locations(source_reminder_id)
  WHERE source_reminder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_progress_locations_origin
  ON progress_locations(origin)
  WHERE origin = 'auto_reminder';


-- ============================================================================
--  Catatan pencocokan proyek
-- ============================================================================
--  Reminder punya dua field yang relevan:
--    project_name  (label form: "Nama Project*")
--    address       (label form: "Lokasi Project *")
--
--  Pemetaan yang dipakai:
--    reminders.project_name  →  progress_projects.name    (dicocokkan)
--    reminders.address       →  progress_locations.name   (lokasi draft baru)
--
--  Pencocokan nama proyek dilakukan case-insensitive dan diabaikan spasi
--  depan/belakang. Bila tidak ada yang cocok, proyek BARU dibuat dengan
--  origin='auto_reminder' supaya admin bisa mengenali mana yang belum dikurasi
--  dan menggabungkannya bila ternyata duplikat penamaan.
--
--  Field "Item Komponen" sengaja DIKOSONGKAN saat auto-insert — tidak ada
--  komponen yang dibuat. Pengisiannya menyusul secara manual di Project
--  Progress.
-- ============================================================================
