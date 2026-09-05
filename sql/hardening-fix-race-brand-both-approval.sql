-- HARDENING P1 (data-integrity): request brand BOTH butuh 2 reviewer Sales
-- Internal (MVI+IVP) approve sebelum lanjut ke Admin. jalankanInternalApprove()
-- di app/form-require-project/page.tsx menghitung "apakah reviewer satunya
-- sudah approve" dari SNAPSHOT client (`req`) yang dibaca SEBELUM approve-nya
-- sendiri dikirim. Kalau kedua reviewer approve nyaris bersamaan, keduanya
-- sama-sama melihat field milik reviewer lain masih kosong, keduanya menulis
-- HANYA kolom approval miliknya sendiri (tanpa routing_status), dan request
-- macet permanen di 'internal_review' - tidak ada yang menghitung ulang
-- kondisi "keduanya sudah approve" setelahnya.
--
-- Perbaikan: trigger BEFORE UPDATE yang menghitung ulang kondisi itu dari
-- BARIS SEBENARNYA di database (bukan snapshot client) setiap kali salah satu
-- kolom approval berubah. Postgres mengunci baris per UPDATE, jadi begitu
-- approval kedua benar-benar di-commit, NEW di trigger itu sudah melihat
-- approval pertama yang sudah tersimpan - race condition-nya hilang di sini,
-- terlepas dari urutan/waktu klik kedua reviewer.
--
-- Tidak mengubah kode aplikasi sama sekali. Diverifikasi lewat simulasi
-- (transaksi ROLLBACK): approval PERTAMA -> routing_status tetap
-- 'internal_review' (benar, belum lengkap); approval KEDUA (dikirim seolah
-- tidak tahu approval pertama, persis skenario race) -> routing_status
-- otomatis maju ke 'admin_review'.

CREATE OR REPLACE FUNCTION public.fix_race_internal_review_both_approved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.routing_status = 'internal_review'
     AND NEW.routing_status = 'internal_review'
     AND NEW.internal_sales_id_2 IS NOT NULL
     AND NEW.internal_approved_at IS NOT NULL
     AND NEW.internal_approved_at_2 IS NOT NULL THEN
    NEW.routing_status := 'admin_review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fix_race_internal_review ON public.project_requests;
CREATE TRIGGER trg_fix_race_internal_review
BEFORE UPDATE ON public.project_requests
FOR EACH ROW
EXECUTE FUNCTION public.fix_race_internal_review_both_approved();
