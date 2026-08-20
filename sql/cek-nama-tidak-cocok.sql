-- ============================================================================
--  CEK NAMA TIDAK COCOK - kenapa sebuah akun akan melihat nol baris
-- ============================================================================
--
--  HANYA MEMBACA. Aman dijalankan kapan saja.
--
--  Lanjutan dari sql/rls-lingkup-project.sql bagian 2. Berkas itu menandai
--  akun yang akan melihat nol baris; berkas INI menunjukkan nama aslinya di
--  data, supaya Anda bisa menilai sendiri apakah itu ketidakcocokan sungguhan
--  atau cuma kebetulan kata yang sama.
--
--  Bedanya dengan kolom `nama_mirip` di berkas itu: di sana pencocokannya
--  memakai kata PERTAMA nama, dan itu terbukti terlalu longgar. Nama sependek
--  "Ar" membuat "Rinaldi Ardilas" dan "Arman" ikut terhitung mirip, padahal
--  orang yang sama sekali lain. Di sini yang dicocokkan hanya kata sepanjang
--  minimal empat huruf, dan nama yang tidak punya kata sepanjang itu dijawab
--  terus terang: tidak bisa dinilai.
--
--  Cara baca `catatan`:
--    HANYA BEDA HURUF BESAR-KECIL  Hampir pasti akun ganda untuk orang yang
--                                  sama. Bereskan datanya, jangan policy-nya.
--    ejaan berbeda                 Periksa sendiri - bisa nama yang sama
--                                  ditulis lain, bisa juga orang lain yang
--                                  kebetulan sekata.
--    nama terlalu pendek           Alat ini menyerah; periksa manual.
--
--  Yang didaftar hanya akun non-PTS yang namanya TIDAK PERNAH muncul persis di
--  kolom sales_name. Sebagian mungkin memang belum punya pekerjaan di tabel
--  itu - itu wajar dan bukan masalah.
-- ============================================================================

CREATE OR REPLACE FUNCTION nama_tidak_cocok(nama_tabel text)
RETURNS TABLE (tabel text, akun text, nama_di_data text, jumlah bigint, catatan text)
LANGUAGE plpgsql STABLE AS $fn$
BEGIN
  RETURN QUERY EXECUTE format($f$
    WITH nol AS (
      SELECT u.id, u.full_name::text AS akun
      FROM users u
      WHERE COALESCE(u.role,'') NOT IN ('admin','superadmin','team')
        AND u.full_name IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM %I t WHERE t.sales_name = u.full_name)
    ),
    kata AS (
      SELECT n.id, n.akun, w AS potongan
      FROM nol n, unnest(string_to_array(n.akun, ' ')) w
      WHERE length(w) >= 4
    )
    SELECT %L::text, k.akun, t.sales_name::text, count(*),
           CASE WHEN lower(t.sales_name) = lower(k.akun)
                THEN 'HANYA BEDA HURUF BESAR-KECIL'
                ELSE 'ejaan berbeda' END
    FROM kata k
    JOIN %I t ON t.sales_name ILIKE '%%' || k.potongan || '%%'
    GROUP BY k.akun, t.sales_name
    UNION ALL
    SELECT %L::text, n.akun, '(tidak bisa dinilai)', 0::bigint,
           'nama terlalu pendek - tidak ada kata >= 4 huruf untuk dicocokkan'
    FROM nol n
    WHERE NOT EXISTS (SELECT 1 FROM kata k WHERE k.id = n.id)
    ORDER BY 2, 4 DESC
  $f$, nama_tabel, nama_tabel, nama_tabel, nama_tabel);
END;
$fn$;

--  Query terakhir, supaya sekali Run langsung keluar hasilnya.
SELECT * FROM (
  SELECT * FROM nama_tidak_cocok('tickets')
  UNION ALL
  SELECT * FROM nama_tidak_cocok('reminders')
  UNION ALL
  SELECT * FROM nama_tidak_cocok('project_requests')
) r
ORDER BY (catatan = 'HANYA BEDA HURUF BESAR-KECIL') DESC, akun, tabel, jumlah DESC;
