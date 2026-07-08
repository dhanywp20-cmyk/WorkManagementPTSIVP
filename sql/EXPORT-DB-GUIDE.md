# Export Database — panduan pindah server / duplikasi platform / serah-terima ke pembeli

Tujuan: mengeluarkan **skema lengkap** (semua tabel, kolom, constraint, index, RLS
policy, function, trigger) — dan opsional **data** — dari Supabase yang sekarang,
supaya bisa dibuat ulang di server/Supabase lain.

> **Penting:** file-file `.sql` di folder `sql/` ini adalah *migrasi bertahap*
> (ALTER/CREATE sepotong-sepotong), **BUKAN skema lengkap**. Sebagian objek dibuat
> langsung lewat Supabase Dashboard sehingga tidak semuanya tercatat di sini.
> **Sumber kebenaran satu-satunya = database live.** Jadi export HARUS dari DB live
> dengan cara di bawah, bukan dari menyatukan file `sql/`.

---

## Cara 1 — Supabase CLI (paling gampang & lengkap) ✅ REKOMENDASI

Butuh: [Supabase CLI](https://supabase.com/docs/guides/cli) + connection string DB.

```bash
# 1. Login CLI (sekali saja)
supabase login

# 2. Ambil connection string:
#    Supabase Dashboard → Project Settings → Database → "Connection string" → URI
#    Bentuknya: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# 3a. Export SKEMA saja (struktur tabel, tanpa isi data):
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" -f schema.sql

# 3b. Export DATA saja (isi baris):
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" --data-only -f data.sql

# 3c. Export ROLES/RLS policies (kalau perlu):
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" --role-only -f roles.sql
```

Restore ke Supabase/Postgres baru: jalankan `schema.sql` dulu, baru `data.sql`
(lewat SQL Editor server baru, atau `psql "postgresql://...baru..." -f schema.sql`).

---

## Cara 2 — pg_dump langsung (kalau punya psql/pg_dump)

```bash
# SKEMA + DATA sekaligus (public schema saja):
pg_dump "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges -f backup_full.sql

# SKEMA saja:
pg_dump "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  --schema=public --schema-only --no-owner --no-privileges -f schema_only.sql
```

> Pakai **connection string "Direct connection"** (port 5432), bukan pooler (6543),
> supaya pg_dump jalan mulus. Ada di Dashboard → Project Settings → Database.

---

## Cara 3 — tanpa CLI, lewat SQL Editor (cepat untuk cek isi, bukan migrasi penuh)

Tempel di **Supabase → SQL Editor** untuk melihat daftar tabel + kolom
(untuk verifikasi / dokumentasi; untuk migrasi tetap pakai Cara 1/2):

```sql
-- Daftar semua tabel + jumlah kolom
select table_name, count(*) as kolom
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;

-- Definisi kolom lengkap 1 tabel (ganti 'reminders')
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'reminders'
order by ordinal_position;
```

---

## Yang JUGA perlu ikut kalau pindah server / dijual (bukan cuma tabel SQL)

Database cuma satu bagian. Supaya platform benar-benar jalan di tempat baru:

1. **Supabase Storage buckets** — foto ticket, file design project, dll.
   Bucket yang dipakai: `ticket-photos`, `project-files` (cek Dashboard → Storage).
   Perlu di-copy manual / via Storage API ke project baru.
2. **Edge Functions** — mis. `swift-responder` (pengirim WhatsApp terpusat).
   Ada di `supabase/functions/` atau Dashboard → Edge Functions. Deploy ulang.
3. **Environment variables** (di Vercel + Supabase):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, token Fonnte (WA), dll. Set ulang di server baru.
4. **Cron jobs / pg_cron** — mis. `daily-reminder`, `escalate` (kalau dipakai).
5. **RLS policies** — ikut ter-export di Cara 1 (`--role-only`) / pg_dump. Wajib
   supaya keamanan sama.
6. **Kode aplikasi** = repo Git ini (Next.js). Deploy ke Vercel baru + arahkan ke
   Supabase baru lewat env di atas.

---

## Inventaris tabel (49 tabel yang dipakai aplikasi)

Untuk verifikasi hasil export lengkap. Dikelompokkan per modul:

**Auth & user:** `users`, `user_credentials`, `user_sessions`, `login_attempts`,
`password_reset_otps`, `app_settings`, `audit_trail`, `notifications`, `team_members`

**Reminder / Request Schedule:** `reminders`, `overdue_settings`

**Ticket Troubleshooting:** `tickets`, `activity_logs`, `late_ticket_links`,
`guest_mappings`

**Request Design Project:** `project_requests`, `project_messages`,
`project_attachments`, `brand_pic_mappings`

**Routing / mapping:** `division_ivp_mappings`, `division_supervisor_mappings`,
`user_supervisor_mappings`, `pts_team_mappings`, `product_team_map`

**Incentive PTS:** `incentive_projects`, `incentive_splits`, `incentive_tranches`

**KPI:** `kpi_global_settings`, `kpi_manual_values`, `kpi_period_snapshots`,
`kpi_snapshot_members`

**Daily Report:** `daily_reports`, `daily_report_team_entries`

**Piket Showroom:** `piket_schedules`, `piket_tamu_detail`, `piket_produk_lain`,
`picket_holidays`

**Learning Center:** `lc_materials`, `lc_questions`, `lc_answers`, `lc_answer_records`,
`lc_quiz_sessions`, `lc_quiz_attempts`

**Tech Note:** `tech_notes`, `tech_note_folders`, `tech_note_history`

**Unit Movement:** `movement_logs`

> Kalau jumlah tabel hasil export = 49 (± tabel sistem), berarti lengkap.
