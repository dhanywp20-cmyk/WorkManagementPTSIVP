-- ============================================================================
--  VIEW SECURITY DEFINER & RPC TERBUKA - dua pintu yang MELEWATI seluruh RLS
-- ============================================================================
--
--  SUDAH DITERAPKAN DI PRODUKSI. Berkas ini catatannya.
--
--  Ditemukan oleh Supabase database linter SESUDAH seluruh pengetatan tabel
--  selesai - dan itu pelajarannya sendiri: penyisiran saya menelusuri TABEL,
--  sementara dua lubang terbesar yang tersisa bukan tabel. Menutup semua
--  tabel tidak ada artinya kalau ada jalan lain memutarinya.
--
--
--  ── 1. TIGA VIEW SECURITY DEFINER ──────────────────────────────────────────
--
--  View dengan sifat SECURITY DEFINER berjalan sebagai PEMBUATNYA, bukan
--  sebagai yang memanggil. Akibatnya policy RLS pada tabel yang dibacanya
--  TIDAK berlaku sama sekali.
--
--  Diuji sebagai anon tanpa klaim apa pun - keadaan pengunjung yang belum
--  login: ketiganya TERBACA. Isinya bukan angka rekap, melainkan data tiket
--  sungguhan:
--
--      notification_tickets  project_name, issue_case, assigned_to, status
--      stuck_tickets         project_name, issue_case, assign_name, status,
--                            priority, hours_idle
--      vw_tech_note_kpi      author_id, author_name, approved_count
--
--  Jadi seluruh pengetatan tickets yang baru dipasang bisa diputari lewat
--  pintu ini, dan tidak ada satu pun policy yang bisa mencegahnya - sifat
--  SECURITY DEFINER-lah yang membuat policy diabaikan.
--
--  Ketiganya NOL referensi di kode aplikasi; keduanya lahir di
--  supabase/migrations/004_workflow_tickets.sql sebagai alat diagnosa.
--  Karena itu hak bacanya dicabut, bukan diubah jadi SECURITY INVOKER -
--  mencabut lebih tegas dan tidak menyisakan pertanyaan "siapa yang boleh".
--  service_role tetap bisa memakainya, jadi alat diagnosa tetap berfungsi.
REVOKE ALL ON public.vw_tech_note_kpi     FROM anon, authenticated;
REVOKE ALL ON public.notification_tickets FROM anon, authenticated;
REVOKE ALL ON public.stuck_tickets        FROM anon, authenticated;


--  ── 2. update_reminder_cron ────────────────────────────────────────────────
--
--  Fungsi SECURITY DEFINER yang bisa dipanggil SIAPA PUN lewat
--  /rest/v1/rpc/update_reminder_cron. Tombolnya di aplikasi memang hanya
--  tampil untuk admin - tapi tombol yang disembunyikan bukan penjagaan.
--  Siapa saja yang memegang anon key bisa memanggilnya langsung dan
--  MENGUBAH atau MEMATIKAN seluruh penjadwalan reminder harian.
--
--  Penjagaannya dipindah ke DALAM fungsi. Diuji sesudahnya:
--      belum login  -> ditolak
--      guest        -> ditolak
--      admin        -> berhasil
--
--  SEKALIAN: service_role key yang sebelumnya DITANAM sebagai teks biasa di
--  badan fungsi ini dipindah ke tabel rahasia_integrasi.
--
--  Sejauh mana ia terpapar - dijawab jujur, bukan ditebak:
--    TIDAK terjangkau dari peramban. PostgREST hanya mengekspos skema
--    `public`; pg_catalog (tempat badan fungsi tersimpan) tidak diekspos,
--    jadi tidak ada cara memanennya lewat anon key.
--    TAPI ia terbaca oleh siapa pun yang punya akses SQL Editor atau
--    dashboard Supabase, dan sebuah service_role key MELEWATI SELURUH RLS -
--    seluruh pekerjaan penguncian ini tidak berlaku bagi pemegangnya.
--    Karena itu ia tetap harus DIPUTAR (rotate) di dashboard Supabase, lalu
--    nilainya diperbarui di rahasia_integrasi. Memindahkannya saja tidak
--    membatalkan paparan yang sudah terjadi.
--
--  Isi ulang kuncinya di lingkungan lain sebelum menjalankan blok ini:
--      INSERT INTO rahasia_integrasi (kunci, nilai, diperbarui_oleh)
--      VALUES ('supabase.service_role_key', '<kunci>', '<nama>')
--      ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai;

CREATE OR REPLACE FUNCTION public.update_reminder_cron(
  p_hour_wib integer, p_minute integer, p_day_of_week text, p_active boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
--  search_path dipaku: fungsi SECURITY DEFINER dengan search_path yang bisa
--  diubah pemanggil adalah jalur peningkatan hak - pemanggil bisa menaruh
--  skema sendiri di depan dan membajak nama tabel/fungsi yang dirujuk badan
--  fungsi ini. Ini juga temuan linter (function_search_path_mutable).
SET search_path = public, cron, net, pg_temp
AS $function$
DECLARE
  v_utc_hour  integer;
  v_cron_expr text;
  v_url       text := 'https://frxdbqcojaiosjoghdqk.supabase.co/functions/v1/daily-reminder';
  v_key       text;
  v_headers   text;
BEGIN
  IF jwt_claim('user_role') NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Hanya admin yang boleh mengubah jadwal reminder.';
  END IF;

  SELECT nilai INTO v_key FROM rahasia_integrasi WHERE kunci = 'supabase.service_role_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'supabase.service_role_key belum ada di rahasia_integrasi.';
  END IF;
  v_headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || v_key || '"}';

  -- WIB = UTC+7, jadi UTC = WIB - 7
  v_utc_hour := MOD(p_hour_wib - 7 + 24, 24);
  v_cron_expr := p_minute::text || ' ' || v_utc_hour::text || ' * * ' || p_day_of_week;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-reminder';

  IF p_active THEN
    PERFORM cron.schedule(
      'daily-reminder',
      v_cron_expr,
      'SELECT net.http_post(url:=''' || v_url || ''', headers:=''' || v_headers || '''::jsonb, body:=''{}''::jsonb);'
    );
  END IF;

  RETURN 'OK: WIB ' || p_hour_wib || ':' || LPAD(p_minute::text,2,'0') ||
         ' = UTC ' || v_utc_hour || ':' || LPAD(p_minute::text,2,'0') ||
         ' | cron: ' || v_cron_expr;
END;
$function$;


-- ─── CATATAN: jadwal daily-reminder sedang TIDAK terpasang ──────────────────
--  Saat berkas ini dibuat, `SELECT * FROM cron.job` mengembalikan NOL baris -
--  tidak ada job daily-reminder sama sekali, jadi reminder harian otomatis
--  memang sedang tidak berjalan. Ini keadaan yang SUDAH ADA sebelum berkas
--  ini (penjaga di atas menolak SEBELUM baris cron.unschedule, jadi
--  pengujiannya tidak mungkin menghapus apa pun).
--
--  Untuk menyalakannya kembali: buka Ticketing -> pengaturan jadwal reminder
--  sebagai admin, atau jalankan sebagai admin:
--      SELECT update_reminder_cron(8, 0, '1-5', true);


-- ─── Pemeriksaan ────────────────────────────────────────────────────────────
SELECT 'vw_tech_note_kpi'     AS objek, has_table_privilege('anon','public.vw_tech_note_kpi','SELECT')     AS anon_boleh_baca
UNION ALL SELECT 'notification_tickets', has_table_privilege('anon','public.notification_tickets','SELECT')
UNION ALL SELECT 'stuck_tickets',        has_table_privilege('anon','public.stuck_tickets','SELECT');
