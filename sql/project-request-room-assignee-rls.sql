-- Ruangan 2+ (Command Center, dst) sekarang bisa punya handler sendiri di
-- dalam project_requests.rooms (JSONB), berbeda dari assign_name/assign_user_id
-- level request (lihat app/form-require-project/_components/shared.ts,
-- getRoomStatus/getRoomAssignName). pr_update lama HANYA mengizinkan penulis
-- yang assign_name-nya (kolom request langsung) cocok dengan JWT - PTS yang
-- di-assign ke ruangan lain (bukan ruangan pertama) akan ditolak diam-diam
-- (0 baris, tanpa error) saat mengklik "Mulai In Progress" / update status di
-- ruangannya sendiri. Ditambahkan jalur baru: cocok kalau id/nama JWT ada di
-- salah satu elemen array rooms sebagai assign_user_id/assign_name.
--
-- Sudah diterapkan langsung ke database produksi via Supabase MCP
-- (frxdbqcojaiosjoghdqk) - berkas ini catatan riwayat, sama seperti
-- sql/*.sql lain di direktori ini.

CREATE OR REPLACE FUNCTION public.pts_ditugaskan_di_rooms(rooms_json jsonb)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(rooms_json, '[]'::jsonb)) elem
    WHERE NULLIF(elem->>'assign_user_id', '')::uuid = jwt_user_id()
       OR elem->>'assign_name' = jwt_full_name()
  );
$$;

ALTER POLICY pr_update ON public.project_requests
  USING (
    admin_atau_full_access() OR (requester_id = jwt_claim('sub'::text)) OR (sales_name = jwt_full_name())
    OR (assign_name = jwt_full_name()) OR (ivp_assignee = jwt_full_name())
    OR (internal_sales_id = jwt_user_id()) OR (internal_sales_id_2 = jwt_user_id())
    OR (assigned_supervisor_id = jwt_user_id())
    OR pts_ditugaskan_di_rooms(rooms)
  )
  WITH CHECK (
    admin_atau_full_access() OR (requester_id = jwt_claim('sub'::text)) OR (sales_name = jwt_full_name())
    OR (assign_name = jwt_full_name()) OR (ivp_assignee = jwt_full_name())
    OR (internal_sales_id = jwt_user_id()) OR (internal_sales_id_2 = jwt_user_id())
    OR (assigned_supervisor_id = jwt_user_id())
    OR pts_ditugaskan_di_rooms(rooms)
  );
