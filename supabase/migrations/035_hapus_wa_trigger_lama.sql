-- 035 - Hapus WA "ticket assigned" lama dari basis data + fungsi berisi token tertulis.
--
-- MASALAHNYA (ditemukan audit 6 Okt 2026):
--   1. Trigger `on_ticket_assigned` (AFTER INSERT OR UPDATE ON tickets) menjalankan
--      fungsi `handle_ticket_assignment()` yang mengirim WA LANGSUNG ke api.fonnte.com
--      dengan token Fonnte TERTULIS di badan fungsi. Akibatnya:
--        - setiap ticket di-assign, handler menerima DUA WA: satu dari aplikasi
--          (lewat swift-responder, event ticket.assigned - sudah ada di 3 titik
--          app/ticketing/page.tsx) dan satu dari trigger ini;
--        - pesan dari trigger membawa link domain lama (team-ticketing.vercel.app);
--        - melanggar aturan "semua WA lewat satu pintu swift-responder";
--        - token Fonnte tersimpan di definisi fungsi basis data.
--   2. Fungsi `check_pending_tickets()` menyimpan JWT (service role) tertulis di
--      badan fungsi. Tidak dipakai trigger maupun pg_cron (cron.job kosong) -
--      eskalasi ticket sudah dikerjakan /api/cron/escalate (Vercel cron).
--
-- YANG DILAKUKAN: hapus trigger + kedua fungsi. WA ticket assigned TETAP terkirim
-- dari aplikasi (lewat swift-responder, dengan link yang benar). Tidak ada data
-- yang diubah.
--
-- SETELAH MENJALANKAN: rotate token Fonnte (Fonnte -> Device -> Token baru) lalu
-- perbarui token di swift-responder / Admin Panel -> Integrations, karena token
-- lama sempat tersimpan di definisi fungsi. Bila JWT di check_pending_tickets
-- adalah service_role key, rotate juga di Supabase -> Project Settings -> API
-- (lalu perbarui SUPABASE_SERVICE_ROLE_KEY di Vercel + rahasia_integrasi).
--
-- Kembali ke semula: tidak disarankan (fungsi lama mengirim WA dobel). Bentuk
-- lamanya (tanpa rahasia) ada di sql/full-schema/05_functions_triggers.sql.

-- ── 1. Trigger & fungsi WA lama ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_ticket_assigned ON public.tickets;
DROP FUNCTION IF EXISTS public.handle_ticket_assignment();

-- ── 2. Fungsi eskalasi lama berisi JWT tertulis (tidak dipakai) ─────────────
DROP FUNCTION IF EXISTS public.check_pending_tickets();

-- ── 3. Index foreign key yang belum ber-index (advisor performa Supabase) ────
CREATE INDEX IF NOT EXISTS checklist_riwayat_item_id_idx ON public.checklist_riwayat (item_id);
CREATE INDEX IF NOT EXISTS request_desain_ruang_dilampirkan_oleh_idx ON public.request_desain_ruang (dilampirkan_oleh);
CREATE INDEX IF NOT EXISTS request_desain_ruang_versi_id_idx ON public.request_desain_ruang (versi_id);
CREATE INDEX IF NOT EXISTS tools_led_simpan_dibuat_oleh_idx ON public.tools_led_simpan (dibuat_oleh);

-- ── Pemeriksaan (harus: 0 baris trigger, 0 fungsi berisi token / fonnte) ────
SELECT 'trigger on_ticket_assigned' AS cek, count(*) AS sisa
  FROM pg_trigger WHERE tgname = 'on_ticket_assigned'
UNION ALL
SELECT 'fungsi berisi JWT / fonnte langsung', count(*)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.prosrc ~ 'eyJ[A-Za-z0-9_-]{20,}' OR p.prosrc ILIKE '%api.fonnte.com%');

-- Tandai sudah dijalankan (bila tabel sql_diterapkan dipakai):
-- SELECT tandai('035_hapus_wa_trigger_lama.sql');
