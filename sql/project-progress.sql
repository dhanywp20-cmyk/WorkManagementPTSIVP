-- ============================================================================
-- Project Progress — progres instalasi per proyek & per lokasi
-- ============================================================================
--
--  Satu PROYEK bisa punya BANYAK LOKASI (mis. "Instalasi AV BPKP" terdiri dari
--  Palembang, Lampung, Padang, Batam, Pangkal Pinang). Tiap lokasi punya daftar
--  komponen dan progres sendiri; isu dicatat terpisah agar bisa direkap lintas
--  lokasi.
--
--  Share View-Only:
--    progress_projects.share_token — token acak untuk link publik read-only.
--    Halaman /project-progress/share/<token> dibaca lewat route server
--    (service_role) sehingga tabel TIDAK perlu dibuka ke anon.
--    share_enabled = false → link langsung mati tanpa perlu ganti token.
--
--  Jalankan sekali di Supabase SQL Editor.
-- ============================================================================

-- ─── Proyek ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  client        TEXT,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | done | blocked
  share_token   TEXT UNIQUE,
  share_enabled BOOLEAN NOT NULL DEFAULT false,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Lokasi (site) ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES progress_projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  pic         TEXT,
  status      TEXT NOT NULL DEFAULT 'in_progress',    -- in_progress | done | blocked
  progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  note        TEXT,
  note_flag   BOOLEAN NOT NULL DEFAULT false,         -- "tandai sebagai catatan penting"
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Komponen per lokasi ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_components (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES progress_locations(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'done',           -- done | warning | blocked
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Rekap isu terbuka ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_issues (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES progress_projects(id) ON DELETE CASCADE,
  location_label TEXT,                                 -- teks bebas: bisa lintas lokasi
  issue          TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'sedang',       -- tinggi | sedang | rendah
  note           TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Index ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_progress_locations_project  ON progress_locations(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_components_loc     ON progress_components(location_id);
CREATE INDEX IF NOT EXISTS idx_progress_issues_project     ON progress_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_progress_projects_token     ON progress_projects(share_token) WHERE share_token IS NOT NULL;

-- ─── updated_at otomatis ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_progress_projects() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_progress_projects ON progress_projects;
CREATE TRIGGER trg_touch_progress_projects
  BEFORE UPDATE ON progress_projects
  FOR EACH ROW EXECUTE FUNCTION touch_progress_projects();

-- ============================================================================
--  Catatan RLS
-- ============================================================================
--  Tabel ini mengikuti pola modul lain: klien memakai anon key dan penulisan
--  dibatasi di level UI (hanya admin/superadmin yang melihat tombol edit).
--  Halaman share publik TIDAK memakai anon key — ia lewat route server
--  /api/project-progress/share/<token> yang memakai service_role, sehingga
--  token yang salah tidak bisa dipakai membaca proyek lain.
--
--  Bila nanti ingin dikunci penuh (seperti sql/lock-incentive-splits-rls.sql),
--  aktifkan RLS di keempat tabel dan pindahkan SEMUA operasi tulis ke route
--  server ber-service_role terlebih dahulu — jangan dijalankan sebelum itu,
--  atau halaman Project Progress akan gagal menyimpan.
-- ============================================================================
