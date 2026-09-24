-- Menu "Summary Project": override manual untuk mengaitkan satu record
-- (reminders/tickets/project_requests/form_reviews) ke nama project kanonik
-- tertentu, untuk kasus label project_name-nya beda ketik/belum nyambung
-- dengan pengelompokan otomatis (by project_name yang dinormalisasi).
-- Lihat lib/summary-project.ts.

create table if not exists public.project_summary_links (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('reminders','tickets','project_requests','form_reviews')),
  source_id uuid not null,
  canonical_project_name text not null,
  linked_by text,
  linked_at timestamptz not null default now(),
  unique (source_table, source_id)
);

alter table public.project_summary_links enable row level security;

-- TO anon, authenticated - platform ini pakai skema JWT kustom sendiri
-- (request.jwt.claims lewat GUC, dibaca jwt_claim()/jwt_user_id()), BUKAN
-- Supabase Auth. Koneksi PostgREST-nya tetap berjalan sebagai role `anon`;
-- membatasi policy ke `TO authenticated` saja akan menolak SEMUA lalu
-- lintas app sungguhan. Pola ini sama persis dengan seluruh tabel lain di
-- platform (lihat rm_select/tk_select dkk di 04_rls.sql).
--
-- Baca bebas untuk siapa pun yang login - menu Summary Project sendiri
-- sudah digembok allowed_menus, dan isi datanya tetap disaring lingkup
-- project di level query tabel sumber masing-masing, bukan di sini.
create policy psl_select on public.project_summary_links
  for select to anon, authenticated using (true);

-- Tulis (kaitkan/lepas link manual) hanya Admin/Superadmin, sesuai keputusan
-- fitur: mengubah pengelompokan mempengaruhi tampilan yang dibaca banyak
-- orang, jadi lewat satu pintu yang tanggung jawabnya jelas.
create policy psl_write on public.project_summary_links
  for all to anon, authenticated
  using (jwt_claim('user_role') in ('admin','superadmin'))
  with check (jwt_claim('user_role') in ('admin','superadmin'));
