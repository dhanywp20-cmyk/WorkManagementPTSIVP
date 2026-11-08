-- Data demo fiktif untuk pelanggan baru. Opsional: jalankan sesudah 00-04.
-- Semua akun demo memakai password: Demo#2026  (ganti segera setelah login pertama)
-- Hapus data demo kapan saja: jalankan 06-hapus-data-demo.sql

BEGIN;

INSERT INTO public.users (id, username, full_name, role, access_level, team_type, jabatan, sales_division, phone_number, allowed_menus, kpi_enabled, bisa_ditugaskan, piket_akses, incentive_akses, allow_incentive_input)
VALUES
  ('d0000000-0000-4000-8000-000000000001', 'admin.demo', 'Admin Demo', 'admin', 'full', 'Team PTS IVP', 'Manager', NULL, '081200000001',
   ARRAY['ticket-troubleshooting','reminder-schedule','request-design-project','form-bast','picket-showroom','daily-report','unit-movement','project-progress','summary-project','tech-note','kpi-team','tools-team','learning-center','incentive-pts'], false, false, 'semua', 'penuh', true),
  ('d0000000-0000-4000-8000-000000000002', 'manager.demo', 'Rina Manager', 'team', 'full', 'Team PTS IVP', 'Manager', NULL, '081200000002',
   ARRAY['ticket-troubleshooting','reminder-schedule','request-design-project','form-bast','picket-showroom','daily-report','unit-movement','project-progress','summary-project','tech-note','kpi-team','tools-team','learning-center','incentive-pts'], true, true, 'semua', 'lihat', false),
  ('d0000000-0000-4000-8000-000000000003', 'supervisor.demo', 'Andi Supervisor', 'team', 'guest', 'Team PTS IVP', 'Supervisor', NULL, '081200000003',
   ARRAY['ticket-troubleshooting','reminder-schedule','request-design-project','form-bast','picket-showroom','daily-report','unit-movement','project-progress','summary-project','tech-note','kpi-team','tools-team','learning-center'], true, true, 'lingkup', NULL, false),
  ('d0000000-0000-4000-8000-000000000004', 'teknisi1.demo', 'Bayu Teknisi', 'team', 'guest', 'Team PTS IVP', 'Staff', NULL, '081200000004',
   ARRAY['ticket-troubleshooting','reminder-schedule','form-bast','picket-showroom','daily-report','unit-movement','project-progress','tech-note','tools-team','learning-center'], true, true, NULL, NULL, false),
  ('d0000000-0000-4000-8000-000000000005', 'teknisi2.demo', 'Citra Teknisi', 'team', 'guest', 'Team PTS MVI', 'Staff', NULL, '081200000005',
   ARRAY['ticket-troubleshooting','reminder-schedule','form-bast','picket-showroom','daily-report','unit-movement','project-progress','tech-note','tools-team','learning-center'], true, true, NULL, NULL, false),
  ('d0000000-0000-4000-8000-000000000006', 'sales.demo', 'Dimas Sales', 'guest', 'guest', 'Guest', 'Staff', 'Enterprise', '081200000006',
   ARRAY['ticket-troubleshooting','reminder-schedule','request-design-project','form-bast','project-progress','summary-project'], false, false, NULL, NULL, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_credentials (user_id, password_hash, algorithm)
SELECT u.id, extensions.crypt('Demo#2026', extensions.gen_salt('bf', 12)), 'bcrypt'
FROM public.users u
WHERE u.id::text LIKE 'd0000000-0000-4000-8000-00000000000_'
  AND NOT EXISTS (SELECT 1 FROM public.user_credentials c WHERE c.user_id = u.id);

INSERT INTO public.reminders (id, project_name, description, assigned_to, assign_name, assign_user_id, due_date, due_time, priority, status, category, created_by, sales_name, sales_user_id, sales_division, address, pic_name, pic_phone, product, product_type)
VALUES
  ('d0000000-0000-4000-8000-000000000101', 'Ruang Rapat Direksi - PT Demo Sejahtera', 'Instalasi & konfigurasi display 86 inci + wireless presentation', 'teknisi1.demo', 'Bayu Teknisi', 'd0000000-0000-4000-8000-000000000004', CURRENT_DATE + 2, '09:00', 'high', 'pending', 'Konfigurasi', 'admin.demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'Enterprise', 'Jl. Contoh Raya No. 1, Jakarta', 'Bapak Contoh', '081300000001', 'Interactive Display 86"', 'LCD/Middleware'),
  ('d0000000-0000-4000-8000-000000000102', 'Videowall Lobby - Hotel Demo', 'Training operator videowall 3x3', 'teknisi2.demo', 'Citra Teknisi', 'd0000000-0000-4000-8000-000000000005', CURRENT_DATE + 5, '13:00', 'medium', 'pending', 'Training', 'admin.demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'Enterprise', 'Jl. Pantai Demo No. 8, Bali', 'Ibu Contoh', '081300000002', 'Videowall 55" 3x3', 'LCD/Middleware'),
  ('d0000000-0000-4000-8000-000000000103', 'LED Outdoor - Mall Demo', 'Survey lokasi & pengukuran struktur LED', 'teknisi1.demo', 'Bayu Teknisi', 'd0000000-0000-4000-8000-000000000004', CURRENT_DATE - 3, '10:00', 'medium', 'done', 'Meeting & Survey', 'admin.demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'Enterprise', 'Jl. Niaga Demo No. 5, Bandung', 'Bapak Contoh', '081300000003', 'LED P3.9 Outdoor', 'LED'),
  ('d0000000-0000-4000-8000-000000000104', 'Kelas Pintar - Sekolah Demo', 'Demo produk interactive flat panel untuk kepala sekolah', 'teknisi2.demo', 'Citra Teknisi', 'd0000000-0000-4000-8000-000000000005', CURRENT_DATE - 7, '09:30', 'medium', 'done', 'Demo Product', 'admin.demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'Enterprise', 'Jl. Pendidikan Demo No. 3, Surabaya', 'Ibu Contoh', '081300000004', 'Interactive Flat Panel 75"', 'LCD/Middleware'),
  ('d0000000-0000-4000-8000-000000000105', 'Command Center - Dinas Demo', 'Maintenance berkala controller videowall', 'teknisi1.demo', 'Bayu Teknisi', 'd0000000-0000-4000-8000-000000000004', CURRENT_DATE + 9, '08:00', 'low', 'pending', 'Maintenance', 'admin.demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'Enterprise', 'Jl. Pemerintahan Demo No. 2, Semarang', 'Bapak Contoh', '081300000005', 'Videowall Controller', 'LED & LCD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tickets (id, project_name, sales_name, sales_user_id, customer_phone, issue_case, description, assign_name, assign_user_id, status, date, created_by, sn_unit, current_team, address, sales_division, product, priority)
VALUES
  ('d0000000-0000-4000-8000-000000000201', 'Ruang Rapat Direksi - PT Demo Sejahtera', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', '081300000001', 'Display tidak menampilkan gambar dari HDMI', 'Layar menyala tetapi input HDMI 2 tidak terdeteksi.', 'Bayu Teknisi', 'd0000000-0000-4000-8000-000000000004', 'Pending', CURRENT_DATE, 'sales.demo', 'SN-DEMO-0001', 'Team PTS IVP', 'Jl. Contoh Raya No. 1, Jakarta', 'Enterprise', 'Interactive Display 86"', 'High'),
  ('d0000000-0000-4000-8000-000000000202', 'Videowall Lobby - Hotel Demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', '081300000002', 'Satu panel videowall warna tidak seragam', 'Panel baris 2 kolom 3 tampak lebih kuning.', 'Citra Teknisi', 'd0000000-0000-4000-8000-000000000005', 'In Progress', CURRENT_DATE - 1, 'sales.demo', 'SN-DEMO-0002', 'Team PTS MVI', 'Jl. Pantai Demo No. 8, Bali', 'Enterprise', 'Videowall 55"', 'Medium'),
  ('d0000000-0000-4000-8000-000000000203', 'Kelas Pintar - Sekolah Demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', '081300000004', 'Touchscreen tidak responsif', 'Sentuhan bergeser ke kiri setelah update firmware.', 'Bayu Teknisi', 'd0000000-0000-4000-8000-000000000004', 'Solved', CURRENT_DATE - 6, 'sales.demo', 'SN-DEMO-0003', 'Team PTS IVP', 'Jl. Pendidikan Demo No. 3, Surabaya', 'Enterprise', 'Interactive Flat Panel 75"', 'Medium'),
  ('d0000000-0000-4000-8000-000000000204', 'LED Outdoor - Mall Demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', '081300000003', 'Modul LED mati sebagian', 'Dua modul di sisi kanan bawah tidak menyala.', 'Citra Teknisi', 'd0000000-0000-4000-8000-000000000005', 'Onsite', CURRENT_DATE - 2, 'sales.demo', 'SN-DEMO-0004', 'Team PTS MVI', 'Jl. Niaga Demo No. 5, Bandung', 'Enterprise', 'LED P3.9 Outdoor', 'Critical'),
  ('d0000000-0000-4000-8000-000000000205', 'Command Center - Dinas Demo', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', '081300000005', 'Permintaan konfigurasi preset layout baru', 'Tambah 3 preset tampilan untuk rapat darurat.', 'Bayu Teknisi', 'd0000000-0000-4000-8000-000000000004', 'Call', CURRENT_DATE, 'sales.demo', 'SN-DEMO-0005', 'Team PTS IVP', 'Jl. Pemerintahan Demo No. 2, Semarang', 'Enterprise', 'Videowall Controller', 'Low')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.project_requests (id, project_name, room_name, sales_name, sales_user_id, requester_id, requester_name, status, kebutuhan, solution_product, ukuran_ruangan, keterangan_lain, sales_division, project_location, due_date)
VALUES
  ('d0000000-0000-4000-8000-000000000301', 'Auditorium - Kampus Demo', 'Auditorium Utama', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', 'Dimas Sales', 'pending',
   '["Presentasi","Video Conference"]'::jsonb, '["LED Indoor","Audio System"]'::jsonb, '20 x 15 m', 'Butuh desain 3D sebelum penawaran.', 'Enterprise', 'Yogyakarta', now() + interval '7 days'),
  ('d0000000-0000-4000-8000-000000000302', 'Meeting Room - PT Demo Sejahtera', 'Meeting Room Lt. 5', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', 'Dimas Sales', 'approved',
   '["Presentasi"]'::jsonb, '["Interactive Display"]'::jsonb, '8 x 6 m', 'Layout 12 kursi.', 'Enterprise', 'Jakarta', now() + interval '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.form_reviews (id, reminder_id, project_name, address, sales_name, sales_user_id, sales_division, assign_name, assigned_to, reminder_category, review_category, product_demo, grade_product_knowledge, catatan_grade_product_knowledge, grade_training_customer, catatan_grade_training_customer, guest_fullname, guest_username, guest_user_id)
VALUES
  ('d0000000-0000-4000-8000-000000000401', 'd0000000-0000-4000-8000-000000000104', 'Kelas Pintar - Sekolah Demo', 'Jl. Pendidikan Demo No. 3, Surabaya', 'Dimas Sales', 'd0000000-0000-4000-8000-000000000006', 'Enterprise', 'Citra Teknisi', 'teknisi2.demo', 'Demo Product', 'Demo Product', 'Interactive Flat Panel 75"', 5, 'Penjelasan fitur sangat jelas.', 4, 'Peserta antusias.', 'Dimas Sales', 'sales.demo', 'd0000000-0000-4000-8000-000000000006')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.daily_reports (id, report_date, user_id, user_name, manual_activities, reminder_notes, created_by)
VALUES
  ('d0000000-0000-4000-8000-000000000501', CURRENT_DATE - 1, 'd0000000-0000-4000-8000-000000000004', 'Bayu Teknisi', '[{"aktivitas":"Cek stok unit demo di gudang","durasi":"1 jam"}]'::jsonb, 'Siapkan kabel HDMI 10 m untuk besok.', 'teknisi1.demo'),
  ('d0000000-0000-4000-8000-000000000502', CURRENT_DATE - 1, 'd0000000-0000-4000-8000-000000000005', 'Citra Teknisi', '[{"aktivitas":"Kalibrasi warna videowall showroom","durasi":"2 jam"}]'::jsonb, '', 'teknisi2.demo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.movement_logs (id, tanggal, nama_pts, nama_luar, status_barang, event, project_name, type_barang, serial_number, catatan, created_by, kondisi_barang, expected_return_date)
VALUES
  ('d0000000-0000-4000-8000-000000000601', CURRENT_DATE - 4, 'Bayu Teknisi', NULL, 'Keluar', 'Demo Produk', 'Kelas Pintar - Sekolah Demo', 'Interactive Flat Panel 75"', 'SN-DEMO-UNIT-01', 'Dipinjam untuk demo 1 minggu.', 'teknisi1.demo', 'Baik', CURRENT_DATE + 3),
  ('d0000000-0000-4000-8000-000000000602', CURRENT_DATE - 1, 'Citra Teknisi', NULL, 'Masuk', 'Retur Servis', 'Videowall Lobby - Hotel Demo', 'Videowall 55"', 'SN-DEMO-UNIT-02', 'Panel kembali dari servis.', 'teknisi2.demo', 'Baik', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.piket_schedules (id, week_start, day_of_week, day_date, pic_ivp_id, pic_ivp_name, pic_mvi_id, pic_mvi_name, tamu_instansi, kebutuhan)
SELECT ('d0000000-0000-4000-8000-00000000070' || d.n)::uuid, date_trunc('week', CURRENT_DATE)::date, d.hari, date_trunc('week', CURRENT_DATE)::date + (d.n - 1),
       'd0000000-0000-4000-8000-000000000004', 'Bayu Teknisi', 'd0000000-0000-4000-8000-000000000005', 'Citra Teknisi',
       CASE WHEN d.n = 3 THEN 'Kampus Demo' END, CASE WHEN d.n = 3 THEN ARRAY['Demo LED','Demo Interactive Display'] ELSE '{}'::text[] END
FROM (VALUES (1, 'Senin'), (2, 'Selasa'), (3, 'Rabu'), (4, 'Kamis'), (5, 'Jumat')) AS d(n, hari)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.progress_projects (id, name, client, description, status, created_by, start_date, target_date, sales_name, sales_division, sales_user_id)
VALUES ('d0000000-0000-4000-8000-000000000801', 'Smart Building - PT Demo Sejahtera', 'PT Demo Sejahtera', 'Instalasi AV 2 lantai: meeting room & lobby.', 'in_progress', 'admin.demo', CURRENT_DATE - 14, CURRENT_DATE + 21, 'Dimas Sales', 'Enterprise', 'd0000000-0000-4000-8000-000000000006')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.progress_locations (id, project_id, name, pic, status, progress, sort_order, start_date, target_date, sales_name, sales_division, sales_user_id, pic_user_id)
VALUES
  ('d0000000-0000-4000-8000-000000000811', 'd0000000-0000-4000-8000-000000000801', 'Lantai 1 - Lobby', 'Bayu Teknisi', 'in_progress', 60, 1, CURRENT_DATE - 14, CURRENT_DATE + 7, 'Dimas Sales', 'Enterprise', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000004'),
  ('d0000000-0000-4000-8000-000000000812', 'd0000000-0000-4000-8000-000000000801', 'Lantai 5 - Meeting Room', 'Citra Teknisi', 'in_progress', 25, 2, CURRENT_DATE - 7, CURRENT_DATE + 21, 'Dimas Sales', 'Enterprise', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.progress_components (id, location_id, label, state, sort_order, category)
VALUES
  ('d0000000-0000-4000-8000-000000000821', 'd0000000-0000-4000-8000-000000000811', 'Bracket & struktur videowall', 'done', 1, 'Instalasi'),
  ('d0000000-0000-4000-8000-000000000822', 'd0000000-0000-4000-8000-000000000811', 'Pemasangan panel', 'done', 2, 'Instalasi'),
  ('d0000000-0000-4000-8000-000000000823', 'd0000000-0000-4000-8000-000000000811', 'Kalibrasi warna', 'progress', 3, 'Konfigurasi'),
  ('d0000000-0000-4000-8000-000000000824', 'd0000000-0000-4000-8000-000000000812', 'Penarikan kabel', 'done', 1, 'Instalasi'),
  ('d0000000-0000-4000-8000-000000000825', 'd0000000-0000-4000-8000-000000000812', 'Pemasangan display & kamera', 'pending', 2, 'Instalasi'),
  ('d0000000-0000-4000-8000-000000000826', 'd0000000-0000-4000-8000-000000000812', 'Training pengguna', 'pending', 3, 'Training')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tech_note_folders (id, name, icon, color, description, created_by, category)
VALUES
  ('d0000000-0000-4000-8000-000000000901', 'Display & Panel', '🖥️', '#6366f1', 'Catatan teknis display', 'Admin Demo', 'display'),
  ('d0000000-0000-4000-8000-000000000902', 'Middleware & Controller', '🎛️', '#0ea5e9', 'Catatan teknis controller', 'Admin Demo', 'middleware'),
  ('d0000000-0000-4000-8000-000000000903', 'Software', '💾', '#ec4899', 'Aplikasi & firmware', 'Admin Demo', 'software')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tech_notes (id, title, description, folder_id, author_id, author_name, one_drive_link, product, tags, team_type, status)
VALUES
  ('d0000000-0000-4000-8000-000000000911', 'Reset pabrik interactive display', 'Langkah reset ke pengaturan pabrik tanpa kehilangan lisensi aplikasi.', 'd0000000-0000-4000-8000-000000000901', 'd0000000-0000-4000-8000-000000000004', 'Bayu Teknisi', 'https://example.com/catatan-demo-1', 'Interactive Display', ARRAY['reset','firmware'], 'Team PTS IVP', 'approved'),
  ('d0000000-0000-4000-8000-000000000912', 'Preset layout videowall controller', 'Cara menyimpan dan memanggil preset layout.', 'd0000000-0000-4000-8000-000000000902', 'd0000000-0000-4000-8000-000000000005', 'Citra Teknisi', 'https://example.com/catatan-demo-2', 'Videowall Controller', ARRAY['preset','layout'], 'Team PTS MVI', 'pending')
ON CONFLICT (id) DO NOTHING;

COMMIT;
