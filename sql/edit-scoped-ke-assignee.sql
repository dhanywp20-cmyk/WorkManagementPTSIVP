-- =====================================================================
-- KEBIJAKAN PLATFORM: Team boleh EDIT hanya yang di-assign atas namanya
-- sendiri. Admin & Full Access tanpa batas. Berlaku di SEMUA menu.
-- =====================================================================
--
-- Diperiksa langsung: UPDATE pada tiga tabel inti (reminders, tickets,
-- project_requests) SAMA SEKALI TIDAK DIBATASI di database (qual: true) -
-- siapa pun yang login (bahkan bukan Team) bisa mengubah baris siapa pun.
-- Perlindungan yang ada selama ini MURNI tombol yang disembunyikan di
-- layar (mis. Ticketing: canUpdateTicket = role !== 'guest', tidak
-- memeriksa siapa yang ditugaskan sama sekali) - bisa dilewati siapa pun
-- yang memanggil PostgREST langsung, bukan lewat aplikasi.
--
-- Project Progress punya kasus berbeda: progress_locations/components
-- SUDAH benar bentuknya (sales_name/pic match), tapi progress_projects &
-- progress_issues masih is_progress_admin() = ANY anggota Team, bukan
-- cuma yang ditugaskan.
--
-- Jalankan SESUDAH sql/full-access-jwt-dan-delete-rls.sql (yang membuat
-- admin_atau_full_access() ada dan yang membuat klaim access_level benar-
-- benar terkirim di JWT - tanpa itu, cabang Full Access di semua kebijakan
-- di bawah ini tidak berarti apa-apa).
-- =====================================================================

-- tickets: assign_name = handler yang ditugaskan.
DROP POLICY IF EXISTS tk_update ON public.tickets;
CREATE POLICY tk_update ON public.tickets
  FOR UPDATE TO anon, authenticated
  USING (public.admin_atau_full_access() OR assign_name = jwt_full_name())
  WITH CHECK (public.admin_atau_full_access() OR assign_name = jwt_full_name());

-- project_requests: pembuatnya sendiri (requester_id/sales_name) ATAU
-- petugas PTS yang ditugaskan (assign_name/ivp_assignee).
DROP POLICY IF EXISTS pr_update ON public.project_requests;
CREATE POLICY pr_update ON public.project_requests
  FOR UPDATE TO anon, authenticated
  USING (
    public.admin_atau_full_access()
    OR requester_id::text = jwt_claim('sub')
    OR sales_name = jwt_full_name()
    OR assign_name = jwt_full_name()
    OR ivp_assignee = jwt_full_name()
  )
  WITH CHECK (
    public.admin_atau_full_access()
    OR requester_id::text = jwt_claim('sub')
    OR sales_name = jwt_full_name()
    OR assign_name = jwt_full_name()
    OR ivp_assignee = jwt_full_name()
  );

-- progress_projects & progress_issues: dulu FOR ALL is_progress_admin()
-- (ANY Team, DAN mencakup DELETE juga - pemilik bisa hapus, melanggar
-- aturan "Team edit, tidak hapus"). Dipecah INSERT+UPDATE (pemilik boleh)
-- vs DELETE (Admin/Full Access saja), persis pola progress_locations yang
-- sudah lebih dulu benar.
DROP POLICY IF EXISTS pp_write ON public.progress_projects;
CREATE POLICY pp_insert ON public.progress_projects
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.admin_atau_full_access() OR sales_name = jwt_full_name());
CREATE POLICY pp_update ON public.progress_projects
  FOR UPDATE TO anon, authenticated
  USING (public.admin_atau_full_access() OR sales_name = jwt_full_name())
  WITH CHECK (public.admin_atau_full_access() OR sales_name = jwt_full_name());
CREATE POLICY pp_delete ON public.progress_projects
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

DROP POLICY IF EXISTS pi_write ON public.progress_issues;
CREATE POLICY pi_insert ON public.progress_issues
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.admin_atau_full_access() OR pic = jwt_full_name());
CREATE POLICY pi_update ON public.progress_issues
  FOR UPDATE TO anon, authenticated
  USING (public.admin_atau_full_access() OR pic = jwt_full_name())
  WITH CHECK (public.admin_atau_full_access() OR pic = jwt_full_name());
CREATE POLICY pi_delete ON public.progress_issues
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

-- progress_locations/progress_components: cabang is_progress_admin()
-- (ANY Team) diselaraskan ke admin_atau_full_access(), dan DELETE
-- dipisah dari UPDATE dengan alasan yang sama seperti di atas.
DROP POLICY IF EXISTS pl_update ON public.progress_locations;
CREATE POLICY pl_update ON public.progress_locations
  FOR UPDATE TO anon, authenticated
  USING (public.admin_atau_full_access() OR sales_name = jwt_full_name() OR pic = jwt_full_name())
  WITH CHECK (public.admin_atau_full_access() OR sales_name = jwt_full_name() OR pic = jwt_full_name());
DROP POLICY IF EXISTS pl_delete ON public.progress_locations;
CREATE POLICY pl_delete ON public.progress_locations
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

DROP POLICY IF EXISTS pc_write ON public.progress_components;
CREATE POLICY pc_insert ON public.progress_components
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM progress_locations l WHERE l.id = progress_components.location_id
      AND (public.admin_atau_full_access() OR l.sales_name = jwt_full_name() OR l.pic = jwt_full_name())
  ));
CREATE POLICY pc_update ON public.progress_components
  FOR UPDATE TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM progress_locations l WHERE l.id = progress_components.location_id
      AND (public.admin_atau_full_access() OR l.sales_name = jwt_full_name() OR l.pic = jwt_full_name())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM progress_locations l WHERE l.id = progress_components.location_id
      AND (public.admin_atau_full_access() OR l.sales_name = jwt_full_name() OR l.pic = jwt_full_name())
  ));
CREATE POLICY pc_delete ON public.progress_components
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

-- =====================================================================
-- SISI KODE (bukan cuma database - layar juga harus berhenti menawarkan
-- tombol yang akan ditolak):
--
-- app/ticketing/page.tsx          canUpdateTicket (boolean tetap) -> jadi
--                                 bolehUpdateTicket(t) per-tiket.
-- app/form-require-project/page.tsx  canSetInProgress ditambah hasFullAccess().
-- app/project-progress/page.tsx   RowActions: canEdit (satu syarat utk
--                                 Share+Edit+Hapus) dipecah jadi
--                                 canEditRow (pemilik/full-access) dan
--                                 canDeleteRow (full-access saja).
--
-- REMINDER SCHEDULE SENGAJA BELUM DISENTUH di sini. rm_update juga masih
-- qual:true, tapi tabel reminders punya alur multi-aktor (Supervisor
-- assign, Internal Sales review 2 tahap, requester asli) yang masing-
-- masing punya kolom ID sendiri (assigned_supervisor_id, internal_sales_id,
-- internal_sales_id_2, dst) - berbeda dari tiga tabel di atas yang
-- kepemilikannya satu pemegang jelas. Menyamaratakan qual di sini berisiko
-- mematahkan alur approval/routing yang sudah berjalan tanpa pemetaan
-- yang cermat lebih dulu terhadap SEMUA aktor sahnya. Menyusul terpisah.
--
-- DIVERIFIKASI (simulasi JWT langsung untuk tiap tabel): assignee/pemilik
-- bisa UPDATE, non-assignee ditolak (0 baris), dan pemilik non-Full-Access
-- TIDAK bisa DELETE pada progress_projects (celah yang sempat lolos di
-- percobaan pertama sebelum dipecah dari FOR ALL).
-- =====================================================================
