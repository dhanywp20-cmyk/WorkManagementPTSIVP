-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSA (READ-ONLY): proyek Incentive yang BAST-nya kosong di SELURUH
-- baris jadwalnya - itulah sebabnya tombol Generate Tahapan tidak pernah
-- muncul untuk proyek itu, dan kenapa ia tidak ikut ke export "Pengajuan
-- Incentive per Tahun" (tabelnya hanya memuat proyek yang PUNYA tahapan,
-- dan tahapan hanya bisa dibuat kalau BAST sudah terisi).
--
-- Tidak MENGUBAH apa pun - query ini murni untuk melihat daftarnya.
--
-- LATAR BELAKANG
--
-- bast_date normalnya terisi otomatis saat Handler menekan Completed pada
-- jadwal berkategori insentif (lihat handleModeConfirm di
-- app/reminder-schedule/page.tsx). Tapi kalau sebuah proyek pernah ditandai
-- selesai SEBELUM fitur itu ada, atau baris "wakil"-nya (yang dipilih
-- app/incentive-pts/_components/calc.ts::gabungkanProyek berdasarkan
-- due_date paling akhir) kebetulan baris yang tidak pernah diisi, BAST-nya
-- akan tampak kosong walau pekerjaannya sudah sungguh selesai.
--
-- Perbaikan kodenya (commit "BAST tetap kosong di Incentive...") sudah
-- membuat gabungkanProyek meminjam BAST dari baris LAIN dalam batch/grup
-- yang sama kalau ada. Query di bawah karena itu HANYA akan menunjukkan
-- proyek yang bast_date-nya kosong di SEMUA barisnya - itulah yang perbaikan
-- kode itu TIDAK BISA selesaikan sendiri, sebab tidak ada satu baris pun
-- yang punya nilai untuk dipinjam.
--
-- CARA MEMPERBAIKI SETELAH TAHU DAFTARNYA
--
-- JANGAN UPDATE bast_date langsung lewat SQL - risikonya salah menimpa
-- baris yang bukan wakil, atau melewatkan baris lain dalam batch yang sama.
-- Pakai jalur yang sudah ada dan sudah teruji di aplikasi: buka layar
-- Incentive PTS -> tombol "💲 Input Nominal" pada proyek itu -> isi
-- Tanggal BAST -> Simpan. Tombol itu menulis ke SELURUH baris batch
-- sekaligus (lihat handleSaveNominal di app/incentive-pts/page.tsx) dan
-- tercatat di audit trail - satu-satunya jalur yang aman untuk data ini.
--
--   Jalankan di Supabase SQL Editor (read-only, aman kapan saja):
--   lihat hasilnya, lalu perbaiki tiap baris lewat UI seperti di atas.
-- ═══════════════════════════════════════════════════════════════════════════

select
  project_name,
  category,
  assign_name          as handler,
  status,
  min(due_date)         as due_date_paling_awal,
  max(due_date)         as due_date_paling_akhir,
  count(*)              as jumlah_baris_jadwal,
  count(bast_date)       as jumlah_baris_dengan_bast,
  bool_or(incentive_excluded is true) as ada_yang_dikeluarkan
from reminders
where category in ('Konfigurasi', 'Konfigurasi & Training', 'Training')
  and status = 'done'
group by project_name, category, assign_name, status
having count(bast_date) = 0   -- BAST kosong di SEMUA baris proyek ini, bukan cuma baris wakilnya
order by max(due_date) desc;

-- ── Pemeriksaan tambahan: proyek yang PUNYA nominal (incentive_value, kolom
--    ini ada langsung di tabel reminders - lihat sql/incentive-pts-migration.sql)
--    tapi BAST-nya kosong - inilah yang paling mendesak, karena Finance sudah
--    menunggu tahapannya bisa dibuat.
select
  project_name, category, assign_name as handler,
  max(incentive_value)  as nominal,
  min(due_date)          as due_date_paling_awal,
  max(due_date)          as due_date_paling_akhir,
  count(*)               as jumlah_baris_jadwal
from reminders
where category in ('Konfigurasi', 'Konfigurasi & Training', 'Training')
  and status = 'done'
group by project_name, category, assign_name
having count(bast_date) = 0 and coalesce(max(incentive_value), 0) > 0
order by max(due_date) desc;
