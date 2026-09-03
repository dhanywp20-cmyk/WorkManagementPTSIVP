-- =====================================================================
-- Kaitan Ticket -> Reminder jadi kolom sungguhan, bukan teks di catatan
-- =====================================================================
--
-- GEJALA
--
-- "team saya agak kesulitan harus update di kedua platform. harusnya ketika
--  update solved di ticket troubleshooting reminder schedule auto Solved/Done
--  juga."
--
-- Ticket yang statusnya diubah ke Onsite otomatis membuat jadwal di Reminder
-- Schedule (kategori Troubleshooting). Tapi penyelesaiannya tidak ikut: tim
-- harus menandai selesai DUA KALI, di dua layar berbeda, untuk satu pekerjaan
-- yang sama. Dan karena itu mudah terlupa, jadwalnya mengendap terbuka.
--
-- Terbukti di data: jadwal "Surveyor Indonesia" (Farhan Fadhilah) masih
-- 'pending' padahal ticketnya sudah 'Solved'. Enam jadwal lain ditutup manual
-- oleh tim.
--
-- SEBAB TEKNIS
--
-- Kaitan ticket <-> reminder selama ini HANYA teks di dalam kolom notes:
--
--     'Ticket ID: 6f3a… | Project: … | Dibuat otomatis dari Platform Ticketing'
--
-- Kebetulan ketujuh baris yang ada masih utuh, tapi satu kali seseorang
-- menyunting catatan itu, kaitannya putus tanpa ada yang tahu - dan tidak ada
-- cara mencarinya kembali. Untuk kaitan yang dipakai program menutup jadwal
-- secara otomatis, teks bebas bukan dasar yang bisa dipercaya.
--
-- PERBAIKAN
--
-- Kolom reminders.ticket_id, diisi mundur dari notes yang sudah ada supaya
-- jadwal lama ikut tersambung - bukan hanya yang dibuat sesudah ini.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS ticket_id uuid;

COMMENT ON COLUMN public.reminders.ticket_id IS
  'Ticket asal bila reminder ini dibuat otomatis dari Ticketing (status Onsite). Dipakai menutup reminder saat ticketnya Solved.';

UPDATE public.reminders r
   SET ticket_id = (substring(r.notes from 'Ticket ID: ([0-9a-fA-F-]{36})'))::uuid
 WHERE r.ticket_id IS NULL
   AND r.notes ~ 'Ticket ID: [0-9a-fA-F-]{36}';

CREATE INDEX IF NOT EXISTS reminders_ticket_id_idx
  ON public.reminders (ticket_id) WHERE ticket_id IS NOT NULL;

-- Rapikan jadwal yang terlanjur tertinggal terbuka padahal ticketnya selesai.
UPDATE public.reminders r
   SET status = 'done'
  FROM public.tickets t
 WHERE t.id = r.ticket_id
   AND r.category = 'Troubleshooting'
   AND r.status <> 'done'
   AND t.status = 'Solved';

-- =====================================================================
-- KEPUTUSAN RANCANGAN YANG MENYERTAINYA (app/ticketing/page.tsx)
-- =====================================================================
--
-- 1. SEARAH SAJA: ticket -> reminder, tidak sebaliknya.
--    Ticket adalah sumber kebenaran pekerjaan troubleshooting; reminder
--    hanyalah bayangan jadwalnya. Dua arah berarti menutup reminder ikut
--    menutup ticket - padahal ticket punya syarat penyelesaiannya sendiri
--    (catatan aktivitas, lampiran, serah terima Team Services) yang akan
--    terlewati begitu saja.
--
-- 2. HANYA KATEGORI 'Troubleshooting' YANG BOLEH DITUTUP OTOMATIS.
--    Menyelesaikan reminder kategori Konfigurasi/Training memicu Form Review
--    dan perhitungan insentif, dan menuntut tanggal BAST diisi lebih dulu
--    (lihat REVIEW_TRIGGER_CATEGORIES & INCENTIVE_TRIGGER_CATEGORIES di
--    app/reminder-schedule/_components/shared.ts). Menutupnya dari Ticketing
--    akan melewati langkah-langkah itu diam-diam - uang dan dokumen serah
--    terima bukan hal yang boleh dilewati program. Reminder bawaan Ticketing
--    selalu Troubleshooting, yang tidak memicu keduanya.
--
-- 3. TICKET DITOLAK -> jadwalnya 'cancelled', bukan 'done'.
--    Pekerjaannya tidak jadi; menandainya selesai akan berbohong pada
--    laporan.
--
-- 4. PENJAGA DUPLIKAT saat membuat jadwal.
--    Sebelumnya tidak ada: setiap kali status diubah ke Onsite - termasuk
--    saat tim mengoreksi catatan lalu menyimpan ulang - satu jadwal BARU
--    dibuat lagi untuk ticket yang sama. Yang diperiksa hanya jadwal yang
--    MASIH TERBUKA, sebab kunjungan onsite kedua untuk ticket yang sama
--    memang sah punya jadwal sendiri.
--
-- 5. HASIL UPDATE DIPERIKSA, tidak dianggap berhasil begitu saja - RLS yang
--    menolak menjawab 0 baris TANPA galat, dan kegagalan diam-diam seperti
--    itu sudah berulang kali jadi sumber masalah di platform ini.
--
-- VERIFIKASI (JWT tersimulasi, begin/rollback):
--   Anggota Team yang jadi assignee berhasil menutup jadwal kaitan ticket
--   (1 baris). Jadi penutupan otomatis tidak akan gagal diam-diam karena RLS.
-- =====================================================================
