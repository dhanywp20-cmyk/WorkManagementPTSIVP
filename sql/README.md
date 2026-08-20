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
| `cek-nama-tidak-cocok.sql` | Kenapa sebuah akun akan melihat nol baris - menunjukkan nama aslinya di data |
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
| `rls-form-reviews.sql` | Memindahkan penyaringan Form Review dari aplikasi ke basis data. Ketiga policy lamanya tidak menyaring apa pun - yang terlihat bersyarat pun berujung `OR true` |
| `rls-lingkup-project.sql` | Menyiapkan RLS untuk tickets, reminders, project_requests, notifications. Simulasi dulu, policy masih komentar |
| `rls-project-progress.sql` | Menyalakan RLS berbasis klaim JWT. Jalankan HANYA setelah `/api/auth/db-token-check` menjawab siap |

### Identitas UUID

`identitas-uuid.sql` menambahkan kolom UUID di samping kolom nama pada
tickets, reminders, project_requests, form_reviews, dan progress_*. UUID
menjawab *siapa* (pencocokan, assign, notifikasi, RLS); nama tetap ada dan
menjawab *tercatat sebagai siapa* (tampilan, riwayat, cetak).

Backfill-nya sengaja menolak menebak: baris hanya dipetakan bila namanya
cocok persis dengan TEPAT SATU akun. Nama yang dimiliki dua orang dibiarkan
kosong dan tetap bekerja lewat pencocokan nama.

`identitas-uuid-lanjutan.sql` adalah putaran keduanya, dijalankan setelah yang
di atas. Ia mengejar sisa yang tahap 1-2 tinggalkan lewat tiga jalur: menyalin
identitas lewat tautan baris (`reminder_id`, `source_reminder_id` - bukan
tebakan, itu baris yang sama), menyamakan huruf besar-kecil & spasi, dan
mengenali nilai yang ternyata username. Ejaan yang berbeda dan nama yang
dimiliki dua akun tetap tidak ditebak; laporan di akhir berkas mendaftarkannya
lengkap dengan alasannya. Aman diulang - setiap UPDATE hanya menyentuh baris
yang uuid-nya masih kosong.

Sisanya ditangani sepasang berkas yang memisahkan tebakan dari keputusan.
`identitas-uuid-usulan.sql` mencari calon akun untuk tiap nilai yang belum
terpetakan - pencocokan di batas kata, minimal 4 huruf, dan hanya ditawarkan
bila calonnya tepat satu - lalu menyebut seberapa kuat kecocokannya
(`kata utuh`, `awalan kata`, `nama akun ada di dalam nilai`).

Kotak usulannya lahir **kosong**, dan itu disengaja. Nilai satu kata seperti
"Adel" bisa berarti potongan nama Adela Diovany, bisa juga nama lengkap orang
yang tidak punya akun - banyak orang memang bernama satu kata. Dari sisi basis
data keduanya terlihat sama persis, jadi tidak ada aturan yang boleh
memutuskannya. Anda yang menyetujui, satu per satu:

```sql
SELECT setujui('Rozaq');                                        -- calon tunggal
SELECT setujui_ke('tickets','sales_name','Rafi''i','ashila');   -- tunjuk sendiri
```

`setujui()` menolak nilai yang calonnya nol atau lebih dari satu, dan
mengatakan alasannya. `setujui_ke()` untuk yang Anda tahu sendiri jawabannya.
Setelah kotaknya terisi, `identitas-uuid-terapkan.sql` menulis apa yang ada di
sana dan tidak menebak apa pun; kalau satu nilai menunjuk dua orang, ia
berhenti tanpa mengubah satu baris pun. Yang tidak Anda setujui tetap kosong
uuid-nya dan tetap bekerja lewat nama.

**Urutan menjalankannya tidak mengikat.** Aplikasi mencoba menulis kolom uuid,
dan kalau basis datanya belum punya kolom itu, ia mengulang tanpa kolom uuid
(`cobaIdentitas` di `lib/identitas.ts`). Jadi men-deploy kode lebih dulu tidak
membuat pembuatan ticket/jadwal/request gagal - fiturnya hanya belum aktif
sampai SQL-nya dijalankan. Jalur mundur itu boleh dihapus setelah SQL-nya
dipastikan sudah jalan.

Yang sudah menulis uuid: Ticketing, Request Schedule (termasuk form_reviews),
dan Request Design Project. Yang sengaja BELUM: `progress_projects` /
`progress_locations`. Penautan Reminder Konfigurasi & Training ke Project
Progress adalah jalur yang dipakai untuk mencatat nama installer remote, dan
tidak disentuh; kolom uuid-nya sudah ada dan sudah di-backfill, tinggal
menunggu keputusan untuk ikut ditulis.

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
