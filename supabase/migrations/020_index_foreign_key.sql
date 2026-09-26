-- MIGRATION 020: index untuk 25 foreign key yang belum ber-index (advisor
-- Supabase "unindexed_foreign_keys"). Mempercepat join & hapus berantai.
create index if not exists idx_fk_division_supervisor_mappings_supervisor_id on public.division_supervisor_mappings (supervisor_id);
create index if not exists idx_fk_project_messages_request_id on public.project_messages (request_id);
create index if not exists idx_fk_project_attachments_request_id on public.project_attachments (request_id);
create index if not exists idx_fk_project_attachments_message_id on public.project_attachments (message_id);
create index if not exists idx_fk_reminders_installer_user_id on public.reminders (installer_user_id);
create index if not exists idx_fk_division_ivp_mappings_ivp_id on public.division_ivp_mappings (ivp_id);
create index if not exists idx_fk_tech_note_folders_parent_id on public.tech_note_folders (parent_id);
create index if not exists idx_fk_user_supervisor_mappings_user_id on public.user_supervisor_mappings (user_id);
create index if not exists idx_fk_user_supervisor_mappings_supervisor_id on public.user_supervisor_mappings (supervisor_id);
create index if not exists idx_fk_lc_quiz_sessions_material_id on public.lc_quiz_sessions (material_id);
create index if not exists idx_fk_brand_pic_mappings_pic_user_id on public.brand_pic_mappings (pic_user_id);
create index if not exists idx_fk_piket_tamu_detail_piket_id on public.piket_tamu_detail (piket_id);
create index if not exists idx_fk_lc_answers_quiz_session_id on public.lc_answers (quiz_session_id);
create index if not exists idx_fk_lc_answers_question_id on public.lc_answers (question_id);
create index if not exists idx_fk_incentive_splits_user_id on public.incentive_splits (user_id);
create index if not exists idx_fk_lc_materials_created_by on public.lc_materials (created_by);
create index if not exists idx_fk_lc_questions_created_by on public.lc_questions (created_by);
create index if not exists idx_fk_lc_quiz_attempts_graded_by on public.lc_quiz_attempts (graded_by);
create index if not exists idx_fk_lc_quiz_sessions_created_by on public.lc_quiz_sessions (created_by);
create index if not exists idx_fk_project_requests_internal_approved_by on public.project_requests (internal_approved_by);
create index if not exists idx_fk_reminders_internal_approved_by on public.reminders (internal_approved_by);
create index if not exists idx_fk_reminders_pic_id on public.reminders (pic_id);
create index if not exists idx_fk_ticket_support_assignment_assigned_by on public.ticket_support_assignment (assigned_by);
create index if not exists idx_fk_ticket_support_assignment_user_id on public.ticket_support_assignment (user_id);
create index if not exists idx_fk_progress_projects_source_reminder_id on public.progress_projects (source_reminder_id);
