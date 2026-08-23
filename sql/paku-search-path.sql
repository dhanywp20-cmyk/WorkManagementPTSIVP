-- ============================================================================
--  MEMAKU search_path SELURUH FUNGSI - menutup jalur pembajakan nama
-- ============================================================================
--
--  SUDAH DITERAPKAN DI PRODUKSI (43 fungsi). Berkas ini catatannya.
--
--  MASALAHNYA
--
--  Fungsi yang search_path-nya tidak dipaku memakai search_path MILIK
--  PEMANGGIL. Pemanggil bisa menaruh skema miliknya sendiri di urutan depan,
--  lalu setiap nama tabel/fungsi yang dirujuk badan fungsi menunjuk ke
--  miliknya - bukan ke yang dimaksud penulisnya.
--
--  Pada fungsi SECURITY DEFINER itu jalur peningkatan hak langsung: badan
--  fungsi berjalan dengan hak pembuatnya, tapi membaca tabel milik penyerang.
--  Pada SECURITY INVOKER risikonya jauh lebih kecil, tapi tidak ada gunanya
--  dibiarkan - dan membiarkan sebagian saja membuat daftar peringatan penuh
--  hal yang "sudah tahu, sengaja", yang justru menyembunyikan yang serius.
--
--  CARANYA
--
--  Lewat loop atas katalog, bukan didaftar satu per satu: daftar manual pasti
--  ketinggalan saat ada fungsi baru, dan ketinggalannya tidak akan terlihat.
--  Fungsi yang search_path-nya SUDAH dipaku dilewati, jadi berkas ini aman
--  diulang dan tidak menimpa pengaturan yang lebih spesifik - mis.
--  update_reminder_cron yang perlu `public, cron, net, pg_temp`.
--
--  pg_temp disebut PALING BELAKANG. Itu anjuran Postgres sendiri: kalau
--  pg_temp berada di depan, penyerang bisa membuat tabel sementara bernama
--  sama dan membajaknya - persis lubang yang sedang ditutup.
--
--  RISIKO YANG DIPERIKSA, bukan diasumsikan
--
--  Memaku search_path bisa MERUSAK fungsi yang memanggil sesuatu tanpa awalan
--  skema, mis. gen_random_uuid() - di Supabase ia tinggal di skema
--  `extensions`, bukan `public`. Karena itu sesudah diterapkan, jalur tulis
--  yang benar-benar memakai default uuid dan trigger diuji sungguhan lalu
--  dibatalkan lewat savepoint:
--
--      INSERT audit_trail (default uuid + trigger)   BISA
--      INSERT activity_logs                          BISA
--      UPDATE users (trigger guard kolom hak)        BISA
--      UPSERT app_settings (trigger tolak rahasia)   BISA
--      INSERT tickets (alur utama)                   BISA
--
--      jwt_claim / lingkup_semua / jwt_user_id / jwt_full_name /
--      is_progress_admin / boleh_hapus_reminder      semua menjawab benar
--      SELECT tickets sebagai admin                  81 baris, tidak berubah
-- ============================================================================

DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      --  Fungsi milik ekstensi tidak bisa diubah pemilik proyek. Dilewati,
      --  bukan digagalkan - satu fungsi ekstensi tidak boleh membatalkan
      --  pengetatan 43 fungsi lainnya.
      RAISE NOTICE 'lewati %: %', r.sig, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '% fungsi dipaku search_path-nya', n;
END $$;


-- ─── Pemeriksaan ────────────────────────────────────────────────────────────
--  masih_bisa_diubah yang tersisa adalah fungsi milik ekstensi (tidak bisa
--  diubah dari sini, dan bukan milik aplikasi ini).
SELECT count(*) FILTER (WHERE NOT ada) AS masih_bisa_diubah,
       count(*) FILTER (WHERE ada)     AS sudah_dipaku
FROM (
  SELECT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
                  WHERE c LIKE 'search_path=%') AS ada
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND p.prokind = 'f'
) x;
