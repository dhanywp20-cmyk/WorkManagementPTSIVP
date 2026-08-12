-- ============================================================================
-- Project Progress — bobot komponen, kategori sistem, dan Issue Management
-- ============================================================================
--
--  1. progress_components.weight — bobot kepentingan komponen dalam progres
--     lokasi (mis. "Server Utama" lebih berat dari "Kabel Patch"). Progres
--     lokasi sebelumnya membagi rata SEMUA komponen; sekarang komponen
--     berbobot lebih besar menyumbang lebih banyak ke persentase.
--     DEFAULT 1 untuk semua baris lama → hasil computeProgress IDENTIK
--     dengan sebelum migrasi ini (rata-rata biasa = rata-rata berbobot sama).
--
--  2. progress_components.category — System Category bebas teks (Video/Audio/
--     Kamera/Jaringan/dst). Nullable, belum ditautkan ke UI filter — kolom
--     disiapkan lebih dulu supaya fitur filter berikutnya tidak perlu migrasi
--     tambahan.
--
--  3. progress_issues — upgrade ADITIF ke Issue Management penuh: PIC, status
--     lifecycle, due date, root cause, action plan, resolution, penaut ke
--     lokasi/komponen. Kolom & tabel LAMA tidak dihapus — issue yang sudah ada
--     tetap tampil apa adanya, hanya field barunya kosong sampai diisi.
--     severity diperluas 3→4 level (tambah 'kritis' di atas 'tinggi').
--
--  4. progress_actions (BARU) — action item per issue, banyak-ke-satu. Delete
--     issue ikut menghapus action-nya (CASCADE) karena action tidak berarti
--     lepas dari issue induknya.
--
--  Jalankan SETELAH sql/project-progress.sql,
--  sql/project-progress-component-states.sql, dan
--  sql/project-progress-timeline.sql. Aman dijalankan berulang.
-- ============================================================================

-- ─── 1 & 2. Komponen: bobot & kategori ──────────────────────────────────────
ALTER TABLE progress_components
  ADD COLUMN IF NOT EXISTS weight   NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS category TEXT NULL;

DO $$ BEGIN
  ALTER TABLE progress_components
    ADD CONSTRAINT progress_components_weight_positive_check CHECK (weight > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Isu: upgrade ke Issue Management ────────────────────────────────────
ALTER TABLE progress_issues
  ADD COLUMN IF NOT EXISTS pic          TEXT NULL,
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS due_date     DATE NULL,
  ADD COLUMN IF NOT EXISTS root_cause   TEXT NULL,
  ADD COLUMN IF NOT EXISTS action_plan  TEXT NULL,
  ADD COLUMN IF NOT EXISTS resolution   TEXT NULL,
  ADD COLUMN IF NOT EXISTS resolved_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS location_id  UUID NULL REFERENCES progress_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS component_id UUID NULL REFERENCES progress_components(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE progress_issues
    ADD CONSTRAINT progress_issues_status_check
    CHECK (status IN ('open', 'in_progress', 'waiting_vendor', 'waiting_client', 'resolved', 'closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- severity: tinggi | sedang | rendah → tambah 'kritis' di atas 'tinggi'.
-- Data lama otomatis valid, tidak perlu backfill.
ALTER TABLE progress_issues DROP CONSTRAINT IF EXISTS progress_issues_severity_check;
ALTER TABLE progress_issues
  ADD CONSTRAINT progress_issues_severity_check
  CHECK (severity IN ('kritis', 'tinggi', 'sedang', 'rendah'));

CREATE INDEX IF NOT EXISTS idx_progress_issues_status   ON progress_issues(status);
CREATE INDEX IF NOT EXISTS idx_progress_issues_due       ON progress_issues(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_progress_issues_location  ON progress_issues(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_progress_issues_component ON progress_issues(component_id) WHERE component_id IS NOT NULL;

-- ─── 4. Action Tracker (baru) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id     UUID NOT NULL REFERENCES progress_issues(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  pic          TEXT NULL,
  target_date  DATE NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  notes        TEXT NULL,
  created_by   TEXT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);

DO $$ BEGIN
  ALTER TABLE progress_actions
    ADD CONSTRAINT progress_actions_status_check
    CHECK (status IN ('open', 'in_progress', 'done'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_progress_actions_issue ON progress_actions(issue_id);
CREATE INDEX IF NOT EXISTS idx_progress_actions_target ON progress_actions(target_date) WHERE target_date IS NOT NULL;

-- ============================================================================
--  Catatan
-- ============================================================================
--  Kolom & tabel di file ini ADITIF dan belum ditautkan penuh ke UI —
--  disiapkan sebagai fondasi data untuk Issue Management, Action Tracker, dan
--  Weighted Progress. Menjalankan file ini TIDAK mengubah tampilan/perilaku
--  apa pun sampai kode aplikasi menyertakan field-field ini (lihat
--  _components/shared.ts computeProgress dan halaman Project Progress).
-- ============================================================================
