# Berkas SQL platform

Ada dua tempat SQL di repo ini, dan keduanya bekerja dengan cara yang berbeda.
Kalau tidak dibedakan, mudah sekali menjalankan yang salah di basis data yang
sudah berjalan.

| Tempat | Siapa yang menjalankan | Boleh disusun ulang? |
|---|---|---|
| `supabase/migrations/` | Supabase CLI, otomatis dan berurutan | **Tidak.** Nama berkasnya adalah kunci yang dicatat basis data |
| `sql/` | Manusia, lewat Supabase SQL Editor | Ya, tapi lihat urutan di bawah |

Jangan memindahkan berkas dari `sql/` ke `supabase/migrations/`. CLI akan
menganggapnya migrasi baru dan menjalankannya ulang di basis data yang isinya
sudah ada.

## Peringatan: awalan nomor ganda di `supabase/migrations/`

Lima nomor dipakai dua kali:

```
001_platform_improvements.sql      001_security_user_credentials.sql
002_security_sessions.sql          002_users_extended_columns.sql
003_picket_holidays.sql            003_security_login_attempts.sql
004_kpi_snapshot_members.sql       004_workflow_tickets.sql
005_escalation_cron.sql            005_immutable_activity_logs.sql
```

Urutan penerapannya jadi ditentukan urutan abjad nama di belakang nomor, bukan
oleh nomornya. Selama ini tidak menimbulkan masalah karena tidak ada pasangan
yang saling bergantung, dan semuanya sudah terlanjur tercatat di basis data.

**Jangan mengganti nama berkas-berkas itu untuk merapikan nomornya.** Supabase
mencatat migrasi yang sudah jalan berdasarkan nama; mengubah nama berarti
migrasi lama dianggap belum pernah dijalankan, dan CLI akan menjalankannya lagi
di atas skema yang sudah ada. Untuk migrasi BARU, pakai stempel waktu
(`20260819_nama.sql`) supaya tabrakan nomor tidak terulang.

## Jebakan Supabase SQL Editor

Kalau satu berkas berisi beberapa query, **editor hanya menampilkan hasil query
terakhir**. Query sebelumnya tetap dijalankan, tapi hasilnya tidak pernah
terlihat - jadi laporan yang dipecah jadi beberapa bagian akan tampak "cuma
mengembalikan satu tabel", padahal bagian lainnya sudah jalan diam-diam.

Karena itu berkas pemeriksaan di sini disusun sebagai **satu query**. Kalau Anda
menulis pemeriksaan baru, gabungkan dengan `UNION ALL` alih-alih menumpuk
beberapa `SELECT`.

## Isi `sql/`

### Pemeriksaan - hanya membaca, aman dijalankan kapan saja

| Berkas | Menjawab |
|---|---|
| `cek-jangkauan-anon.sql` | Tabel mana saja yang bisa dibaca/ditulis dengan anon key dari browser |
| `cek-rls.sql`, `cek-policy.sql` | Keadaan RLS & daftar policy |
| `cek-kesiapan-rls.sql` | Apakah aman menyalakan RLS Project Progress |
| `diagnose-top-performers.sql` | Kenapa Top Performers kosong |
| `storage-audit.sql` | Berkas boros yang menghabiskan kuota & egress |

Pendamping di sisi jaringan: `node scripts/cek-anon.mjs` memanggil PostgREST
langsung dengan anon key, jadi hasilnya membuktikan apa yang benar-benar bisa
diambil orang luar - bukan apa yang seharusnya.

### Pengamanan - berdampak besar, baca kepala berkasnya dulu

| Berkas | Akibat bila salah urutan |
|---|---|
| `lock-credentials-rls.sql` | Menutup `user_credentials`, `user_sessions`, `login_attempts`, `password_reset_otps` dari anon. **Wajib** `SUPABASE_SERVICE_ROLE_KEY` sudah terpasang di Vercel dan aplikasi sudah di-deploy ulang. Kalau belum, SEMUA login gagal |
| `unlock-credentials-rls.sql` | Pembatalan darurat untuk yang di atas. Tidak perlu deploy ulang |
| `lock-users-privileged-columns.sql` | Trigger yang membekukan kolom `role`, `team_type`, `allowed_menus`, `allow_incentive_input`, `access_level` dari anon. Tanpa ini, siapa pun yang punya anon key bisa menaikkan dirinya jadi admin |
| `lock-incentive-splits-rls.sql` | Menyembunyikan "siapa dapat berapa" dari anon |
| `rapikan-policy.sql` | Membuang 28 policy kembar (nol izin berubah) dan menjadikan `audit_trail` hanya-tambah |
| `tutup-tabel-terlewat.sql` | Tiga tabel yang RLS-nya belum pernah menyala: `progress_actions`, `kpi_snapshot_members`, `picket_holidays` |
| `rls-lingkup-project.sql` | Menyiapkan RLS untuk tickets, reminders, project_requests, notifications. Simulasi dulu, policy masih komentar |
| `rls-project-progress.sql` | Menyalakan RLS berbasis klaim JWT. Jalankan HANYA setelah `/api/auth/db-token-check` menjawab siap |

### Skema & fitur - satu kali jalan, sudah diterapkan

Kelompok Project Progress: `project-progress.sql` (dasar), lalu
`-component-states`, `-photo-pic`, `-timeline`, `-weighted-issues`,
`-reminder-link`.

Kelompok routing pipeline: `routing-pipeline-phase1` (fondasi mapping),
`routing-internal-review` (Fase 2 Request Schedule),
`routing-project-request-internal-review` (Fase 2 Request Design Project),
`routing-supervisor-assign` (Fase 3), `routing-supervisor-stage`,
`sales-routing-refine`, `brand-multi-internal`.

Kelompok Learning Center: `learning-center-essay`,
`learning-center-essay-answer-fix`, `learning-center-ai-grading`.

Berdiri sendiri: `incentive-pts-migration`, `incentive-scheme-settings`,
`user-hierarchy-atasan`, `user-full-access-toggle`, `propagate-user-rename`,
`reminder-batch-dates`, `tech-note-folder-category`, `piket-produk-lain`,
`design-project-brand-display-2`, `ticket-status-pending-action`,
`rename-mlds-to-mvi`.

## Menambah SQL baru

1. Perubahan skema yang perlu ikut ke setiap lingkungan masuk
   `supabase/migrations/`, dengan nama berstempel waktu.
2. Perbaikan satu kali atau pemeriksaan masuk `sql/`, dan namanya menyebutkan
   apa yang dikerjakan.
3. Tulis di kepala berkas: apa yang diubah, apa syaratnya, dan cara
   membatalkannya kalau ada. Berkas SQL di sini dijalankan manusia di basis
   data yang sedang dipakai orang - jadi yang paling menentukan bukan isinya,
   melainkan apakah pembacanya tahu kapan berkas itu tidak boleh dijalankan.
