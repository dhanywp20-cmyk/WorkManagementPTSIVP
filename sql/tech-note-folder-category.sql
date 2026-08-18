-- ═══════════════════════════════════════════════════════════════════════════
-- Tech Note — kategori folder
--
-- Folder Tech Note selama ini hanya punya nama + emoji bebas. Akibatnya emoji
-- dipilih satu per satu dan pelan-pelan menyimpang: folder yang isinya
-- sama-sama layar bisa berikon 📄, 🖥️, atau apa pun yang kebetulan dipilih
-- saat itu.
--
-- Kolom di bawah membuat kategorinya eksplisit, dan emoji-nya mengikuti
-- kategori (bukan sebaliknya) — lihat KATEGORI_FOLDER di app/tech-note/page.tsx.
--
-- AMAN dijalankan berulang kali.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE tech_note_folders
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Hanya tiga nilai yang berlaku. NULL tetap diizinkan untuk folder lama yang
-- dibuat sebelum kolom ini ada — memaksanya terisi akan menolak baris yang
-- sudah terlanjur tersimpan.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tech_note_folders_category_check'
  ) THEN
    ALTER TABLE tech_note_folders
      ADD CONSTRAINT tech_note_folders_category_check
      CHECK (category IS NULL OR category IN ('display', 'middleware', 'software'));
  END IF;
END $$;

-- Tebakan awal untuk folder yang sudah ada, dari emoji yang terlanjur dipakai.
-- Sisanya dibiarkan NULL dan tampil sebagai "Tanpa kategori" — lebih jujur
-- daripada menebak lalu salah menggolongkan.
UPDATE tech_note_folders SET category = 'display'
  WHERE category IS NULL AND icon IN ('🖥️', '📺', '🖼️');
UPDATE tech_note_folders SET category = 'middleware'
  WHERE category IS NULL AND icon IN ('🎛️', '🎚️', '🔌');
UPDATE tech_note_folders SET category = 'software'
  WHERE category IS NULL AND icon IN ('💿', '🧩', '⚙️');

COMMENT ON COLUMN tech_note_folders.category IS
  'display | middleware | software — menentukan emoji folder (lihat KATEGORI_FOLDER di app/tech-note/page.tsx)';
