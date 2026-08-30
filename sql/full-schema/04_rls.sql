-- ═══════════════════════════════════════════════════════════════════════════
-- 04. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════
-- WAJIB dijalankan SESUDAH 05_functions_triggers.sql - hampir semua policy di
-- sini memanggil fungsi (jwt_claim, lingkup_semua, is_progress_admin, dst)
-- yang didefinisikan di sana. Kalau dijalankan sebelum fungsinya ada,
-- CREATE POLICY akan gagal "function ... does not exist".

-- ── Aktifkan RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_pic_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_team_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.division_ivp_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.division_supervisor_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identitas_calon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identitas_sisa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identitas_usulan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_scheme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_tranches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_manual_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_period_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_snapshot_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_ticket_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overdue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picket_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piket_produk_lain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piket_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piket_tamu_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_team_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pts_team_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rahasia_integrasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sql_diterapkan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_note_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_note_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_support_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_supervisor_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Catatan: incentive_splits TIDAK punya policy SELECT/UPDATE/DELETE eksplisit
-- di bawah (hanya INSERT untuk anon) - ini SENGAJA (lihat sql/lock-incentive-
-- splits-rls.sql), bukan kelalaian.

-- ── Policies ─────────────────────────────────────────────────────────────
CREATE POLICY al_baca ON public.activity_logs AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY al_tambah ON public.activity_logs AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY as_baca ON public.app_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((NOT kunci_rahasia(key)));
CREATE POLICY as_delete ON public.app_settings AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (boleh_tulis_pengaturan());
CREATE POLICY as_insert ON public.app_settings AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (boleh_tulis_pengaturan());
CREATE POLICY as_update ON public.app_settings AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (boleh_tulis_pengaturan())
  WITH CHECK (boleh_tulis_pengaturan());
CREATE POLICY audit_trail_baca ON public.audit_trail AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY audit_trail_tambah ON public.audit_trail AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY bpm_baca ON public.brand_pic_mappings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY bpm_tulis ON public.brand_pic_mappings AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])))
  WITH CHECK ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY drte_baca ON public.daily_report_team_entries AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY drte_tulis ON public.daily_report_team_entries AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (((entered_by = jwt_claim('username'::text)) OR lingkup_semua()))
  WITH CHECK (((entered_by = jwt_claim('username'::text)) OR lingkup_semua()));
CREATE POLICY dr_baca ON public.daily_reports AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY dr_tambah ON public.daily_reports AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((((user_id)::text = jwt_claim('sub'::text)) OR lingkup_semua()));
CREATE POLICY dr_ubah ON public.daily_reports AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING ((((user_id)::text = jwt_claim('sub'::text)) OR lingkup_semua()))
  WITH CHECK ((((user_id)::text = jwt_claim('sub'::text)) OR lingkup_semua()));
CREATE POLICY division_ivp_mappings_baca ON public.division_ivp_mappings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY division_ivp_mappings_tulis ON public.division_ivp_mappings AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY division_supervisor_mappings_baca ON public.division_supervisor_mappings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY division_supervisor_mappings_tulis ON public.division_supervisor_mappings AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY fr_baca ON public.form_reviews AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((is_progress_admin() OR (guest_username = jwt_claim('username'::text)) OR (sales_name = jwt_full_name())));
CREATE POLICY fr_tulis ON public.form_reviews AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((is_progress_admin() OR (guest_username = jwt_claim('username'::text))))
  WITH CHECK ((is_progress_admin() OR (guest_username = jwt_claim('username'::text))));
CREATE POLICY ip_tambah ON public.incentive_projects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (lingkup_semua());
CREATE POLICY iss_baca ON public.incentive_scheme_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY iss_tulis ON public.incentive_scheme_settings AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY anon_insert_only ON public.incentive_splits AS PERMISSIVE FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY it_baca ON public.incentive_tranches AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY it_tambah ON public.incentive_tranches AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY it_ubah ON public.incentive_tranches AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])))
  WITH CHECK ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY kgs_baca ON public.kpi_global_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY kgs_tulis ON public.kpi_global_settings AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY kmv_baca ON public.kpi_manual_values AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY kmv_tulis ON public.kpi_manual_values AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY kps_baca ON public.kpi_period_snapshots AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY kps_tulis ON public.kpi_period_snapshots AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY ksm_insert ON public.kpi_snapshot_members AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY ltl_baca ON public.late_ticket_links AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY lcj_milik ON public.lc_answers AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((((user_id)::text = jwt_claim('sub'::text)) OR lingkup_semua()))
  WITH CHECK ((((user_id)::text = jwt_claim('sub'::text)) OR lingkup_semua()));
CREATE POLICY lcm_baca ON public.lc_materials AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY lcm_tulis ON public.lc_materials AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY lcq_baca ON public.lc_questions AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY lcq_tulis ON public.lc_questions AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY lca_milik ON public.lc_quiz_attempts AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((((user_id)::text = jwt_claim('sub'::text)) OR lingkup_semua()))
  WITH CHECK ((((user_id)::text = jwt_claim('sub'::text)) OR lingkup_semua()));
CREATE POLICY lcs_baca ON public.lc_quiz_sessions AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY lcs_tulis ON public.lc_quiz_sessions AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY ml_baca ON public.movement_logs AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY ml_hapus ON public.movement_logs AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (lingkup_semua());
CREATE POLICY ml_tambah ON public.movement_logs AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY ml_ubah ON public.movement_logs AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY nt_own ON public.notifications AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (((user_id = jwt_claim('sub'::text)) OR lingkup_semua()))
  WITH CHECK (true);
CREATE POLICY os_baca ON public.overdue_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY os_tulis ON public.overdue_settings AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY ph_baca ON public.picket_holidays AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY ph_tulis ON public.picket_holidays AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY ppl_baca ON public.piket_produk_lain AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM piket_tamu_detail d
  WHERE (d.id = piket_produk_lain.kegiatan_id))));
CREATE POLICY ppl_hapus ON public.piket_produk_lain AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM piket_tamu_detail d
  WHERE (d.id = piket_produk_lain.kegiatan_id))));
CREATE POLICY ppl_tambah ON public.piket_produk_lain AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM piket_tamu_detail d
  WHERE (d.id = piket_produk_lain.kegiatan_id))));
CREATE POLICY ps_baca ON public.piket_schedules AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY ps_tulis ON public.piket_schedules AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY ptd_baca ON public.piket_tamu_detail AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((jwt_claim('sub'::text) <> ''::text) AND (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua())));
CREATE POLICY ptd_tulis ON public.piket_tamu_detail AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (((jwt_claim('sub'::text) <> ''::text) AND (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua())))
  WITH CHECK (((jwt_claim('sub'::text) <> ''::text) AND (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua())));
CREATE POLICY ptm_baca ON public.product_team_map AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY ptm_tulis ON public.product_team_map AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])))
  WITH CHECK ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY pa_select ON public.progress_actions AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM (progress_issues i
     JOIN progress_projects p ON ((p.id = i.project_id)))
  WHERE ((i.id = progress_actions.issue_id) AND (is_progress_admin() OR (p.sales_name = jwt_full_name()) OR (EXISTS ( SELECT 1
           FROM progress_locations l
          WHERE ((l.project_id = p.id) AND (l.sales_name = jwt_full_name())))))))));
CREATE POLICY pa_write ON public.progress_actions AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (is_progress_admin())
  WITH CHECK (is_progress_admin());
CREATE POLICY pc_select ON public.progress_components AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM progress_locations l
  WHERE ((l.id = progress_components.location_id) AND (is_progress_admin() OR (l.sales_name = jwt_full_name()) OR (l.pic = jwt_full_name()))))));
CREATE POLICY pc_write ON public.progress_components AS PERMISSIVE FOR ALL TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM progress_locations l
  WHERE ((l.id = progress_components.location_id) AND (is_progress_admin() OR (l.sales_name = jwt_full_name()) OR (l.pic = jwt_full_name()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM progress_locations l
  WHERE ((l.id = progress_components.location_id) AND (is_progress_admin() OR (l.sales_name = jwt_full_name()) OR (l.pic = jwt_full_name()))))));
CREATE POLICY pi_select ON public.progress_issues AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((EXISTS ( SELECT 1
   FROM progress_projects p
  WHERE ((p.id = progress_issues.project_id) AND (is_progress_admin() OR (p.sales_name = jwt_full_name()) OR (EXISTS ( SELECT 1
           FROM progress_locations l
          WHERE ((l.project_id = p.id) AND (l.sales_name = jwt_full_name())))))))));
CREATE POLICY pi_write ON public.progress_issues AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (is_progress_admin())
  WITH CHECK (is_progress_admin());
CREATE POLICY pl_delete ON public.progress_locations AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (is_progress_admin());
CREATE POLICY pl_insert ON public.progress_locations AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (is_progress_admin());
CREATE POLICY pl_select ON public.progress_locations AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((is_progress_admin() OR (sales_name = jwt_full_name()) OR (pic = jwt_full_name())));
CREATE POLICY pl_update ON public.progress_locations AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING ((is_progress_admin() OR (sales_name = jwt_full_name()) OR (pic = jwt_full_name())))
  WITH CHECK ((is_progress_admin() OR (sales_name = jwt_full_name()) OR (pic = jwt_full_name())));
CREATE POLICY pp_select ON public.progress_projects AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((is_progress_admin() OR (sales_name = jwt_full_name()) OR (EXISTS ( SELECT 1
   FROM progress_locations l
  WHERE ((l.project_id = progress_projects.id) AND (l.sales_name = jwt_full_name()))))));
CREATE POLICY pp_write ON public.progress_projects AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (is_progress_admin())
  WITH CHECK (is_progress_admin());
CREATE POLICY pa2_baca ON public.project_attachments AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (boleh_lihat_request(request_id));
CREATE POLICY pa2_hapus ON public.project_attachments AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY pa2_tulis ON public.project_attachments AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (boleh_lihat_request(request_id));
CREATE POLICY pm_baca ON public.project_messages AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (boleh_lihat_request(request_id));
CREATE POLICY pm_hapus ON public.project_messages AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY pm_tulis ON public.project_messages AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((boleh_lihat_request(request_id) AND (sender_id = jwt_claim('sub'::text))));
CREATE POLICY pr_delete ON public.project_requests AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY pr_insert ON public.project_requests AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY pr_select ON public.project_requests AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((boleh_lihat_baris(sales_user_id, sales_name, sales_division, NULL::text) OR (requester_id = jwt_claim('sub'::text)) OR (assign_user_id = jwt_user_id()) OR (assign_name = jwt_full_name()) OR (internal_sales_id = jwt_user_id())));
CREATE POLICY pr_update ON public.project_requests AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY ptsm_baca ON public.pts_team_mappings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY rm_delete ON public.reminders AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (boleh_hapus_reminder());
CREATE POLICY rm_insert ON public.reminders AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY rm_select ON public.reminders AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by) OR (assign_user_id = jwt_user_id()) OR (assigned_to = jwt_claim('username'::text)) OR (internal_sales_id = jwt_user_id()) OR (internal_sales_id_2 = jwt_user_id())));
CREATE POLICY rm_update ON public.reminders AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY tm_baca ON public.team_members AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY tm_tulis ON public.team_members AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY tnf_baca ON public.tech_note_folders AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY tnf_tambah ON public.tech_note_folders AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (lingkup_semua());
CREATE POLICY tnh_baca ON public.tech_note_history AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY tnh_hapus ON public.tech_note_history AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((lingkup_semua() OR (jwt_claim('user_role'::text) = 'supervisor'::text)));
CREATE POLICY tnh_tambah ON public.tech_note_history AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY tn_baca ON public.tech_notes AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((jwt_claim('sub'::text) <> ''::text) AND (lingkup_semua() OR (jwt_claim('user_role'::text) = 'supervisor'::text) OR (status = 'approved'::text) OR (author_id = jwt_claim('sub'::text)))));
CREATE POLICY tn_buat ON public.tech_notes AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY tn_hapus ON public.tech_notes AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((lingkup_semua() OR (jwt_claim('user_role'::text) = 'supervisor'::text)));
CREATE POLICY tn_ubah ON public.tech_notes AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING ((lingkup_semua() OR (jwt_claim('user_role'::text) = 'supervisor'::text)))
  WITH CHECK ((lingkup_semua() OR (jwt_claim('user_role'::text) = 'supervisor'::text)));
CREATE POLICY tk_delete ON public.tickets AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY tk_insert ON public.tickets AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY tk_select ON public.tickets AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by) OR (assign_user_id = jwt_user_id()) OR (assign_name = jwt_full_name())));
CREATE POLICY tk_update ON public.tickets AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY user_supervisor_mappings_baca ON public.user_supervisor_mappings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY user_supervisor_mappings_tulis ON public.user_supervisor_mappings AS PERMISSIVE FOR ALL TO anon, authenticated
  USING (lingkup_semua())
  WITH CHECK (lingkup_semua());
CREATE POLICY users_baca ON public.users AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((jwt_claim('sub'::text) <> ''::text));
CREATE POLICY users_daftar ON public.users AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY users_hapus ON public.users AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING ((jwt_claim('user_role'::text) = ANY (ARRAY['admin'::text, 'superadmin'::text])));
CREATE POLICY users_ubah ON public.users AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING ((((id)::text = jwt_claim('sub'::text)) OR lingkup_semua()))
  WITH CHECK ((((id)::text = jwt_claim('sub'::text)) OR lingkup_semua()));

-- Tabel TANPA policy eksplisit tapi RLS aktif (di atas): identitas_calon,
-- identitas_sisa, identitas_usulan, incentive_disbursements, incentive_projects
-- (kecuali INSERT), incentive_settings, login_attempts, password_reset_otps,
-- rahasia_integrasi, sql_diterapkan, ticket_support_assignment, user_credentials,
-- user_sessions - defaultnya DENY ALL untuk anon/authenticated; tabel-tabel ini
-- memang hanya diakses lewat service_role (server-side/API route), bukan
-- langsung dari klien. Ini SENGAJA, bukan kelalaian - lihat sql/lock-*.sql.
