-- ═══════════════════════════════════════════════════════════════════════════
-- Incentive: menyatukan beberapa jadwal menjadi SATU proyek.
--
-- ── MASALAHNYA ─────────────────────────────────────────────────────────────
--
-- Satu proyek sering dikerjakan lewat beberapa jadwal terpisah: Konfigurasi
-- hari Senin, lalu Training tiga hari kemudian. Keduanya jadwal berbeda dengan
-- kategori berbeda, jadi Incentive Project membacanya sebagai DUA proyek -
-- masing-masing dengan pool nominalnya sendiri. Insentifnya terhitung dua kali.
--
-- Penggabungan per batch_id tidak menolong di sini: batch_id hanya mengikat
-- baris dari SATU pengiriman form (jadwal 5 hari sekaligus). Dua jadwal yang
-- dibuat di hari berbeda punya batch_id berbeda, dan memang seharusnya begitu.
--
-- ── KENAPA BUKAN COCOKKAN NAMA SAJA ────────────────────────────────────────
--
-- Karena jenis kesalahannya berbeda jauh:
--
--   Duplikat dibiarkan          → terlihat di layar, cepat ketahuan.
--   Penggabungan otomatis salah → TIDAK terlihat sama sekali. Insentif
--                                 seseorang berkurang dan tidak ada yang tahu.
--
-- "BPKP Aceh" dan "BPKP Aceh Tahap 2" bisa jadi dua kontrak. Pencocokan nama
-- akan menggabungkannya diam-diam. Untuk data uang, kesalahan yang terlihat
-- jauh lebih baik daripada yang tersembunyi - jadi kolom ini hanya diisi oleh
-- keputusan manusia, tidak pernah oleh tebakan.
--
-- ── PENANDA YANG DIPAKAI UNTUK MENDETEKSI ──────────────────────────────────
--
-- Tanggal BAST, bukan nama. Ia sudah WAJIB diisi handler saat menekan
-- Completed, dan satu proyek = satu dokumen BAST = satu tanggal. Dua kontrak
-- berbeda untuk klien yang sama akan punya BAST berbeda, dan tetap terpisah
-- sebagaimana mestinya. Deteksi hanya MENANDAI; yang menggabungkan tetap orang.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS incentive_group_id UUID NULL;

COMMENT ON COLUMN reminders.incentive_group_id IS
  'Beberapa jadwal yang merupakan SATU proyek insentif berbagi nilai ini. NULL = berdiri sendiri. Hanya diisi lewat keputusan manusia (tombol Gabungkan / pertanyaan saat membuat jadwal), tidak pernah otomatis.';

-- Daftar insentif membaca reminder yang sudah selesai lalu mengelompokkannya.
-- Indeksnya mengikuti bentuk bacaan itu.
CREATE INDEX IF NOT EXISTS reminders_incentive_group_idx
  ON reminders (incentive_group_id)
  WHERE incentive_group_id IS NOT NULL;

-- ─── Periksa hasilnya ──────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'reminders' AND column_name = 'incentive_group_id') AS kolom_ada,
  (SELECT COUNT(*) FROM reminders WHERE incentive_group_id IS NOT NULL)     AS sudah_dikelompokkan;

-- ─── Melihat kandidat duplikat yang ADA SEKARANG ───────────────────────────
--
-- Bukan untuk dijalankan otomatis - ini alat lihat. Nama ternormalisasi sama,
-- tanggal BAST sama, tapi belum satu kelompok. Persis yang akan ditandai di
-- layar Incentive PTS.
SELECT
  lower(regexp_replace(trim(project_name), '\s+', ' ', 'g')) AS nama_ternormalisasi,
  bast_date,
  count(*)                                  AS jumlah_jadwal,
  string_agg(DISTINCT category, ', ')        AS kategori,
  string_agg(DISTINCT assign_name, ', ')     AS penangan
FROM reminders
WHERE status = 'done'
  AND incentive_group_id IS NULL
  AND bast_date IS NOT NULL
  AND category IN ('Konfigurasi', 'Training', 'Konfigurasi & Training')
GROUP BY 1, 2
HAVING count(DISTINCT COALESCE(batch_id::text, id::text)) > 1
ORDER BY count(*) DESC;
