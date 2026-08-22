-- Uji perilaku policy dengan identitas yang disimulasikan.
-- Meniru cara PostgREST: role anon + klaim di request.jwt.claims.

CREATE OR REPLACE FUNCTION uji_baca(klaim text, q text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', klaim, true);
  EXECUTE 'SET LOCAL ROLE anon';
  EXECUTE q INTO n;
  RESET ROLE;
  RETURN n;
END $$;

-- Mencoba perintah tulis SUNGGUHAN lalu selalu membatalkannya.
-- 'BOLEH' = baris benar-benar terpengaruh; 'ditolak' = 0 baris atau error RLS.
CREATE OR REPLACE FUNCTION uji_tulis(klaim text, q text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims', klaim, true);
  EXECUTE 'SET LOCAL ROLE anon';
  EXECUTE q;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  RAISE EXCEPTION 'ROLLBACK_SENGAJA:%', CASE WHEN n > 0 THEN 'BOLEH ('||n||' baris)' ELSE 'ditolak (0 baris)' END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  IF SQLERRM LIKE 'ROLLBACK_SENGAJA:%' THEN
    RETURN substring(SQLERRM from 18);
  END IF;
  RETURN 'ditolak (' || left(SQLERRM, 40) || ')';
END $$;

\set anon    '''{}'''
\set admin   '''{"sub":"11111111-1111-1111-1111-111111111111","username":"adminuser","user_role":"admin","full_name":"Admin Satu"}'''
\set tim     '''{"sub":"22222222-2222-2222-2222-222222222222","username":"timbiasa","user_role":"team","full_name":"Tim Biasa"}'''
\set dhany   '''{"sub":"33333333-3333-3333-3333-333333333333","username":"dhany","user_role":"team","full_name":"Dhany Manager"}'''
\set salesA  '''{"sub":"44444444-4444-4444-4444-444444444444","username":"salesA","user_role":"sales","full_name":"Sales A","sales_division":"DIV-A"}'''
\set salesB  '''{"sub":"55555555-5555-5555-5555-555555555555","username":"salesB","user_role":"sales","full_name":"Sales B","sales_division":"DIV-B"}'''

\echo ''
\echo '════════ A. BACA — siapa melihat berapa baris ════════'
SELECT 'tickets'      AS tabel,
  uji_baca(:anon,  'SELECT count(*) FROM tickets') AS "anon(blm login)",
  uji_baca(:admin, 'SELECT count(*) FROM tickets') AS admin,
  uji_baca(:salesA,'SELECT count(*) FROM tickets') AS "Sales A",
  uji_baca(:salesB,'SELECT count(*) FROM tickets') AS "Sales B"
UNION ALL SELECT 'project_requests',
  uji_baca(:anon,'SELECT count(*) FROM project_requests'), uji_baca(:admin,'SELECT count(*) FROM project_requests'),
  uji_baca(:salesA,'SELECT count(*) FROM project_requests'), uji_baca(:salesB,'SELECT count(*) FROM project_requests')
UNION ALL SELECT 'project_messages',
  uji_baca(:anon,'SELECT count(*) FROM project_messages'), uji_baca(:admin,'SELECT count(*) FROM project_messages'),
  uji_baca(:salesA,'SELECT count(*) FROM project_messages'), uji_baca(:salesB,'SELECT count(*) FROM project_messages')
UNION ALL SELECT 'project_attachments',
  uji_baca(:anon,'SELECT count(*) FROM project_attachments'), uji_baca(:admin,'SELECT count(*) FROM project_attachments'),
  uji_baca(:salesA,'SELECT count(*) FROM project_attachments'), uji_baca(:salesB,'SELECT count(*) FROM project_attachments')
UNION ALL SELECT 'lc_quiz_attempts',
  uji_baca(:anon,'SELECT count(*) FROM lc_quiz_attempts'), uji_baca(:admin,'SELECT count(*) FROM lc_quiz_attempts'),
  uji_baca(:salesA,'SELECT count(*) FROM lc_quiz_attempts'), uji_baca(:salesB,'SELECT count(*) FROM lc_quiz_attempts')
UNION ALL SELECT 'lc_answers',
  uji_baca(:anon,'SELECT count(*) FROM lc_answers'), uji_baca(:admin,'SELECT count(*) FROM lc_answers'),
  uji_baca(:salesA,'SELECT count(*) FROM lc_answers'), uji_baca(:salesB,'SELECT count(*) FROM lc_answers')
UNION ALL SELECT 'tech_notes(3 baris)',
  uji_baca(:anon,'SELECT count(*) FROM tech_notes'), uji_baca(:admin,'SELECT count(*) FROM tech_notes'),
  uji_baca(:salesA,'SELECT count(*) FROM tech_notes'), uji_baca(:salesB,'SELECT count(*) FROM tech_notes')
UNION ALL SELECT 'piket_tamu_detail',
  uji_baca(:anon,'SELECT count(*) FROM piket_tamu_detail'), uji_baca(:admin,'SELECT count(*) FROM piket_tamu_detail'),
  uji_baca(:salesA,'SELECT count(*) FROM piket_tamu_detail'), uji_baca(:salesB,'SELECT count(*) FROM piket_tamu_detail')
UNION ALL SELECT 'overdue_settings',
  uji_baca(:anon,'SELECT count(*) FROM overdue_settings'), uji_baca(:admin,'SELECT count(*) FROM overdue_settings'),
  uji_baca(:salesA,'SELECT count(*) FROM overdue_settings'), uji_baca(:salesB,'SELECT count(*) FROM overdue_settings')
UNION ALL SELECT 'team_members',
  uji_baca(:anon,'SELECT count(*) FROM team_members'), uji_baca(:admin,'SELECT count(*) FROM team_members'),
  uji_baca(:salesA,'SELECT count(*) FROM team_members'), uji_baca(:salesB,'SELECT count(*) FROM team_members')
UNION ALL SELECT 'kpi_global_settings',
  uji_baca(:anon,'SELECT count(*) FROM kpi_global_settings'), uji_baca(:admin,'SELECT count(*) FROM kpi_global_settings'),
  uji_baca(:salesA,'SELECT count(*) FROM kpi_global_settings'), uji_baca(:salesB,'SELECT count(*) FROM kpi_global_settings')
UNION ALL SELECT 'incentive_projects',
  uji_baca(:anon,'SELECT count(*) FROM incentive_projects'), uji_baca(:admin,'SELECT count(*) FROM incentive_projects'),
  uji_baca(:salesA,'SELECT count(*) FROM incentive_projects'), uji_baca(:salesB,'SELECT count(*) FROM incentive_projects')
UNION ALL SELECT 'incentive_settings(mati)',
  uji_baca(:anon,'SELECT count(*) FROM incentive_settings'), uji_baca(:admin,'SELECT count(*) FROM incentive_settings'),
  uji_baca(:salesA,'SELECT count(*) FROM incentive_settings'), uji_baca(:salesB,'SELECT count(*) FROM incentive_settings');

\echo ''
\echo '════════ B. HAPUS — penjaga peran per tabel ════════'
SELECT 'tickets' AS tabel,
  uji_tulis(:anon,  'DELETE FROM tickets WHERE id=''aaaaaaa1-0000-0000-0000-000000000001''') AS "anon",
  uji_tulis(:admin, 'DELETE FROM tickets WHERE id=''aaaaaaa1-0000-0000-0000-000000000001''') AS admin,
  uji_tulis(:dhany, 'DELETE FROM tickets WHERE id=''aaaaaaa1-0000-0000-0000-000000000001''') AS "Dhany(manager)",
  uji_tulis(:salesA,'DELETE FROM tickets WHERE id=''aaaaaaa1-0000-0000-0000-000000000001''') AS "Sales A"
UNION ALL SELECT 'reminders',
  uji_tulis(:anon,  'DELETE FROM reminders WHERE id=''bbbbbbb1-0000-0000-0000-000000000001'''),
  uji_tulis(:admin, 'DELETE FROM reminders WHERE id=''bbbbbbb1-0000-0000-0000-000000000001'''),
  uji_tulis(:dhany, 'DELETE FROM reminders WHERE id=''bbbbbbb1-0000-0000-0000-000000000001'''),
  uji_tulis(:salesA,'DELETE FROM reminders WHERE id=''bbbbbbb1-0000-0000-0000-000000000001''')
UNION ALL SELECT 'project_requests',
  uji_tulis(:anon,  'DELETE FROM project_requests WHERE id=''ccccccc1-0000-0000-0000-000000000001'''),
  uji_tulis(:admin, 'DELETE FROM project_requests WHERE id=''ccccccc1-0000-0000-0000-000000000001'''),
  uji_tulis(:dhany, 'DELETE FROM project_requests WHERE id=''ccccccc1-0000-0000-0000-000000000001'''),
  uji_tulis(:salesA,'DELETE FROM project_requests WHERE id=''ccccccc1-0000-0000-0000-000000000001''');

\echo ''
\echo '════════ C. KUIS — bisakah orang mengubah jawaban orang lain? ════════'
SELECT 'UPDATE attempt milik Sales A' AS percobaan,
  uji_tulis(:anon,  'UPDATE lc_quiz_attempts SET score=99 WHERE id=''fff00001-0000-0000-0000-000000000001''') AS "anon",
  uji_tulis(:salesA,'UPDATE lc_quiz_attempts SET score=99 WHERE id=''fff00001-0000-0000-0000-000000000001''') AS "Sales A(pemilik)",
  uji_tulis(:salesB,'UPDATE lc_quiz_attempts SET score=99 WHERE id=''fff00001-0000-0000-0000-000000000001''') AS "Sales B(BUKAN)",
  uji_tulis(:admin, 'UPDATE lc_quiz_attempts SET score=99 WHERE id=''fff00001-0000-0000-0000-000000000001''') AS "admin(penilai)"
UNION ALL SELECT 'UPDATE jawaban milik Sales A',
  uji_tulis(:anon,  'UPDATE lc_answers SET answer=''X'' WHERE id=''fff00002-0000-0000-0000-000000000001'''),
  uji_tulis(:salesA,'UPDATE lc_answers SET answer=''X'' WHERE id=''fff00002-0000-0000-0000-000000000001'''),
  uji_tulis(:salesB,'UPDATE lc_answers SET answer=''X'' WHERE id=''fff00002-0000-0000-0000-000000000001'''),
  uji_tulis(:admin, 'UPDATE lc_answers SET answer=''X'' WHERE id=''fff00002-0000-0000-0000-000000000001''');

\echo ''
\echo '════════ D. LOG — audit tidak boleh bisa ditulis ulang ════════'
SELECT 'activity_logs' AS tabel,
  uji_tulis(:anon,  'UPDATE activity_logs SET action=''dipalsukan''') AS "UPDATE anon",
  uji_tulis(:admin, 'UPDATE activity_logs SET action=''dipalsukan''') AS "UPDATE admin",
  uji_tulis(:admin, 'DELETE FROM activity_logs')                      AS "DELETE admin",
  uji_tulis(:salesA,'INSERT INTO activity_logs (action) VALUES (''baru'')') AS "INSERT sales";

\echo ''
\echo '════════ E. PENGATURAN — tulis harus orang dalam ════════'
SELECT 'incentive_scheme_settings' AS tabel,
  uji_tulis(:anon,  'UPDATE incentive_scheme_settings SET updated_by=''x''') AS "anon",
  uji_tulis(:salesA,'UPDATE incentive_scheme_settings SET updated_by=''x''') AS "Sales A",
  uji_tulis(:tim,   'UPDATE incentive_scheme_settings SET updated_by=''x''') AS "team",
  uji_tulis(:admin, 'UPDATE incentive_scheme_settings SET updated_by=''x''') AS admin
UNION ALL SELECT 'overdue_settings',
  uji_tulis(:anon,  'UPDATE overdue_settings SET due_hours=1'),
  uji_tulis(:salesA,'UPDATE overdue_settings SET due_hours=1'),
  uji_tulis(:tim,   'UPDATE overdue_settings SET due_hours=1'),
  uji_tulis(:admin, 'UPDATE overdue_settings SET due_hours=1')
UNION ALL SELECT 'kpi_global_settings',
  uji_tulis(:anon,  'UPDATE kpi_global_settings SET settings=''{}'''),
  uji_tulis(:salesA,'UPDATE kpi_global_settings SET settings=''{}'''),
  uji_tulis(:tim,   'UPDATE kpi_global_settings SET settings=''{}'''),
  uji_tulis(:admin, 'UPDATE kpi_global_settings SET settings=''{}''')
UNION ALL SELECT 'division_ivp_mappings',
  uji_tulis(:anon,  'DELETE FROM division_ivp_mappings'),
  uji_tulis(:salesA,'DELETE FROM division_ivp_mappings'),
  uji_tulis(:tim,   'DELETE FROM division_ivp_mappings'),
  uji_tulis(:admin, 'DELETE FROM division_ivp_mappings');

\echo ''
\echo '════════ F. CHAT — menulis atas nama orang lain ════════'
SELECT 'INSERT project_messages' AS percobaan,
  uji_tulis(:salesA, 'INSERT INTO project_messages (request_id, sender_id, message) VALUES (''ccccccc1-0000-0000-0000-000000000001'',''44444444-4444-4444-4444-444444444444'',''sah'')') AS "A ke project A (sah)",
  uji_tulis(:salesA, 'INSERT INTO project_messages (request_id, sender_id, message) VALUES (''ccccccc1-0000-0000-0000-000000000002'',''44444444-4444-4444-4444-444444444444'',''nyelonong'')') AS "A ke project B",
  uji_tulis(:salesA, 'INSERT INTO project_messages (request_id, sender_id, message) VALUES (''ccccccc1-0000-0000-0000-000000000001'',''55555555-5555-5555-5555-555555555555'',''memalsukan'')') AS "A mengaku B";
