-- ═══════════════════════════════════════════════════════════════════════════
-- Learning Center: urutan soal di dalam grup Bank Soal.
--
-- ── KENAPA BUTUH KOLOM SENDIRI ─────────────────────────────────────────────
--
-- Sebelum ini daftar soal diurutkan created_at DESC. Untuk soal yang
-- ditambahkan satu per satu itu masih terbaca, tapi untuk hasil Generate AI
-- urutannya sebenarnya TIDAK tertentu: sepuluh soal disisipkan dalam satu
-- perintah, jadi created_at-nya sama persis. Nomor 1-10 yang tampil di layar
-- hanya nomor baris hasil render - ia bisa berbeda antara satu pemuatan dengan
-- pemuatan berikutnya, dan tidak ada yang bisa dipakai untuk menyusunnya.
--
-- Kolom `urutan` memberi tempat menyimpan keputusan itu, bukan menebaknya.
--
-- ── PENGISIAN AWAL ─────────────────────────────────────────────────────────
--
-- Nomor diberikan per (materi, grup), diurutkan created_at lalu id. Untuk satu
-- angkatan Generate AI created_at-nya seri, jadi id yang menentukan - hasilnya
-- bukan "urutan asli" (memang tidak ada yang tersimpan), melainkan urutan yang
-- TETAP. Itulah yang selama ini hilang. Sesudahnya urutan bisa diatur sendiri
-- lewat tombol panah di tiap soal.
--
-- Perhatikan: daftarnya jadi terbaca dari lama ke baru (soal 1 = paling awal
-- dibuat), kebalikan dari sebelumnya. Untuk bank soal itu arah yang wajar -
-- nomor 1 adalah soal pertama, bukan soal terakhir yang diketik.
--
-- ── TIDAK MENGUBAH CARA QUIZ DIBAGIKAN ─────────────────────────────────────
--
-- Sesi quiz tetap MENGACAK soal saat dibuat (lihat SessionsPage). Urutan di
-- sini untuk mengelola banknya - menyusun materi dari dasar ke lanjutan,
-- mengelompokkan soal yang serumpun - bukan untuk menentukan urutan yang
-- dilihat peserta.
--
-- ── PENYIMPANANNYA SEKALI TEKAN ────────────────────────────────────────────
--
-- Tombol panah di layar hanya menggeser rancangan; tidak ada yang ditulis ke
-- tabel ini sampai tombol "Simpan Urutan" ditekan. Menyusun urutan adalah
-- pekerjaan yang berlangsung - menaikkan soal ke-7 empat tingkat berarti empat
-- kali tekan - dan menyimpan tiap tekanan berarti empat perjalanan ke database
-- untuk satu keputusan yang belum selesai diambil.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE lc_questions
  ADD COLUMN IF NOT EXISTS urutan INTEGER;

COMMENT ON COLUMN lc_questions.urutan IS
  'Urutan tampil di dalam satu (material_id, batch_name). NULL = belum pernah diatur, jatuh ke created_at.';

-- Pengisian awal: hanya baris yang belum bernomor, jadi menjalankan ulang
-- berkas ini tidak menimpa urutan yang sudah disusun tangan.
WITH bernomor AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY material_id, COALESCE(batch_name, '')
           ORDER BY created_at, id
         ) AS n
  FROM lc_questions
  WHERE urutan IS NULL
)
UPDATE lc_questions q
   SET urutan = b.n
  FROM bernomor b
 WHERE q.id = b.id
   AND q.urutan IS NULL;

-- Daftar selalu dibaca per grup, lalu diurutkan. Indeksnya mengikuti bentuk
-- bacaan itu, bukan kolom urutan sendirian.
CREATE INDEX IF NOT EXISTS lc_questions_urutan_idx
  ON lc_questions (material_id, batch_name, urutan);

-- ─── Periksa hasilnya ──────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'lc_questions' AND column_name = 'urutan')  AS kolom_urutan,
  (SELECT COUNT(*) FROM lc_questions)                               AS total_soal,
  (SELECT COUNT(*) FROM lc_questions WHERE urutan IS NULL)          AS belum_bernomor;
