-- HARDENING (WORKMANAGEMENTHARDENINGPHASE) P1: tn_ubah RLS mengizinkan author
-- (author_id = jwt_claim('sub')) meng-UPDATE baris tech note miliknya sendiri,
-- tapi tidak membedakan kolom - author bisa PATCH langsung ke PostgREST dan
-- meloloskan approval-nya sendiri (status:'approved', reviewed_by: dirinya
-- sendiri) tanpa pernah melalui supervisor/admin.
--
-- Satu-satunya transisi status yang memang boleh dilakukan penulis sendiri
-- lewat RLS adalah RESUBMIT: revision/rejected -> pending, dipicu dari
-- submitTechNote() di app/tech-note/page.tsx (baris ~495-501) setelah penulis
-- memperbaiki catatannya. Di luar itu, status dan seluruh kolom hasil review
-- (reviewed_by, reviewed_by_name, review_note, reviewed_at) hanya boleh
-- ditulis oleh admin/full-access/supervisor - persis pengecualian yang sudah
-- ada di tn_ubah sendiri (admin_atau_full_access() OR user_role='supervisor'),
-- jadi trigger ini tidak mengubah siapa yang berwenang approve, hanya menutup
-- jalur pintas lewat panggilan langsung.
--
-- Diverifikasi lewat simulasi (SET LOCAL ROLE anon + request.jwt.claims palsu,
-- dibungkus transaksi ROLLBACK): (1) penulis mencoba self-approve -> status
-- & kolom review tetap tidak berubah, (2) penulis resubmit catatan
-- rejected/revision -> tetap berhasil jadi pending, (3) supervisor approve
-- catatan orang lain -> tetap berhasil seperti semula.

CREATE OR REPLACE FUNCTION public.guard_tech_notes_review_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF admin_atau_full_access() OR jwt_claim('user_role'::text) = 'supervisor' THEN
    RETURN NEW;
  END IF;

  NEW.reviewed_by      := OLD.reviewed_by;
  NEW.reviewed_by_name := OLD.reviewed_by_name;
  NEW.review_note      := OLD.review_note;
  NEW.reviewed_at      := OLD.reviewed_at;

  IF NOT (OLD.status IN ('revision', 'rejected') AND NEW.status = 'pending') THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tech_notes_review ON public.tech_notes;
CREATE TRIGGER trg_guard_tech_notes_review
BEFORE UPDATE ON public.tech_notes
FOR EACH ROW
EXECUTE FUNCTION public.guard_tech_notes_review_columns();
