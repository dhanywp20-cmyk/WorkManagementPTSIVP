-- Data uji. Id ditulis tetap supaya bisa dirujuk di berkas uji.
INSERT INTO users (id, username, full_name, role, sales_division, is_internal_sales, access_level) VALUES
 ('11111111-1111-1111-1111-111111111111','adminuser','Admin Satu','admin','', false,'full'),
 ('22222222-2222-2222-2222-222222222222','timbiasa','Tim Biasa','team','', false,'guest'),
 ('33333333-3333-3333-3333-333333333333','dhany','Dhany Manager','team','', false,'full'),
 ('44444444-4444-4444-4444-444444444444','salesA','Sales A','sales','DIV-A', false,'guest'),
 ('55555555-5555-5555-5555-555555555555','salesB','Sales B','sales','DIV-B', false,'guest'),
 ('66666666-6666-6666-6666-666666666666','ivp1','Internal Satu','sales','DIV-A', true, 'guest');

-- Dhany sebagai manager_user_id (override lama)
INSERT INTO app_settings (key, value) VALUES
 ('manager_user_id', to_jsonb('33333333-3333-3333-3333-333333333333'::text));

INSERT INTO division_ivp_mappings (sales_division, ivp_id) VALUES
 ('DIV-A','66666666-6666-6666-6666-666666666666');

INSERT INTO tickets (id, sales_user_id, sales_name, sales_division, created_by, title) VALUES
 ('aaaaaaa1-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','Sales A','DIV-A','salesA','Tiket milik Sales A'),
 ('aaaaaaa1-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','Sales B','DIV-B','salesB','Tiket milik Sales B');

INSERT INTO reminders (id, sales_user_id, sales_name, sales_division, created_by, title) VALUES
 ('bbbbbbb1-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','Sales A','DIV-A','salesA','Jadwal Sales A'),
 ('bbbbbbb1-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','Sales B','DIV-B','salesB','Jadwal Sales B');

INSERT INTO project_requests (id, sales_user_id, sales_name, sales_division, requester_id, project_name) VALUES
 ('ccccccc1-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','Sales A','DIV-A','44444444-4444-4444-4444-444444444444','Project Sales A'),
 ('ccccccc1-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','Sales B','DIV-B','55555555-5555-5555-5555-555555555555','Project Sales B');

-- Chat & lampiran menempel ke request masing-masing
INSERT INTO project_messages (id, request_id, sender_id, sender_name, message) VALUES
 ('ddddddd1-0000-0000-0000-000000000001','ccccccc1-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','Sales A','chat di project A'),
 ('ddddddd1-0000-0000-0000-000000000002','ccccccc1-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','Sales B','chat di project B');

INSERT INTO project_attachments (id, request_id, file_name, uploaded_by) VALUES
 ('eeeeeee1-0000-0000-0000-000000000001','ccccccc1-0000-0000-0000-000000000001','lampiranA.pdf','Sales A'),
 ('eeeeeee1-0000-0000-0000-000000000002','ccccccc1-0000-0000-0000-000000000002','lampiranB.pdf','Sales B');

-- Kuis: attempt milik Sales A dan Sales B
INSERT INTO lc_quiz_attempts (id, user_id, total_questions, score) VALUES
 ('fff00001-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',10, 0),
 ('fff00001-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555',10, 0);
INSERT INTO lc_answers (id, attempt_id, user_id, answer) VALUES
 ('fff00002-0000-0000-0000-000000000001','fff00001-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','A'),
 ('fff00002-0000-0000-0000-000000000002','fff00001-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','B');

-- Tech note: satu approved, satu pending milik Sales A
INSERT INTO tech_notes (id, title, author_id, status) VALUES
 ('99900001-0000-0000-0000-000000000001','Note approved','44444444-4444-4444-4444-444444444444','approved'),
 ('99900001-0000-0000-0000-000000000002','Note pending milik A','44444444-4444-4444-4444-444444444444','pending'),
 ('99900001-0000-0000-0000-000000000003','Note pending milik B','55555555-5555-5555-5555-555555555555','pending');

-- Piket: detail tamu milik masing-masing sales
INSERT INTO piket_tamu_detail (id, nama_sales, sales_division, tamu_instansi) VALUES
 ('88800001-0000-0000-0000-000000000001','Sales A','DIV-A','Instansi A'),
 ('88800001-0000-0000-0000-000000000002','Sales B','DIV-B','Instansi B');

INSERT INTO overdue_settings (ticket_id, due_hours, set_by) VALUES
 ('aaaaaaa1-0000-0000-0000-000000000001', 48, 'adminuser');

INSERT INTO daily_report_team_entries (report_date, entered_by, member_name) VALUES
 ('2026-01-01','adminuser','Tim Biasa'),
 ('2026-01-01','timbiasa','Tim Biasa');

INSERT INTO activity_logs (ticket_id, action) VALUES
 ('aaaaaaa1-0000-0000-0000-000000000001','dibuat');

INSERT INTO incentive_scheme_settings (scheme, updated_by) VALUES ('{"versi":2}','adminuser');
INSERT INTO kpi_global_settings (id, settings) VALUES (1, '{"bobot":1}');
INSERT INTO team_members (name, team_type, username) VALUES ('Tim Biasa','PTS IVP','timbiasa');

-- Data untuk sql/kunci-tabel-lanjutan-3.sql
INSERT INTO daily_reports (id, report_date, user_id, user_name) VALUES
 ('a1a00001-0000-0000-0000-000000000001','2026-01-01','44444444-4444-4444-4444-444444444444','Sales A'),
 ('a1a00001-0000-0000-0000-000000000002','2026-01-01','55555555-5555-5555-5555-555555555555','Sales B');
INSERT INTO brand_pic_mappings (brand_name, pic_user_id) VALUES ('Merek X','44444444-4444-4444-4444-444444444444');
INSERT INTO product_team_map (product_type, team_types) VALUES ('Display', ARRAY['PTS IVP']);
INSERT INTO pts_team_mappings (staff_user_id, supervisor_user_id) VALUES
 ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333');
INSERT INTO incentive_tranches (id, project_id, tranche_number, status) VALUES
 ('a2a00001-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000001',1,'pending');
INSERT INTO late_ticket_links (parent_project_id, ticket_value) VALUES
 ('bbbbbbb1-0000-0000-0000-000000000001', 1000);
-- anak dari piket_tamu_detail milik Sales A
INSERT INTO piket_produk_lain (kegiatan_id, nama, watt) VALUES
 ('88800001-0000-0000-0000-000000000001','Produk A', 50),
 ('88800001-0000-0000-0000-000000000002','Produk B', 60);
