# Authorization & Workflow Audit

Tanggal: 2026-09-03. Read-only audit — tidak ada perubahan kode dalam audit ini.

Metodologi: dibaca middleware, `lib/auth.ts`, `lib/server-auth.ts`, `lib/db-token.ts`,
`lib/penjaga-admin.ts`, seluruh 22 route di `app/api/*`, arsitektur JWT/RLS
(`lib/supabase.ts`), lalu didelegasikan 3 sub-audit paralel untuk modul besar
(Ticketing+Services+Reminder; Incentive PTS+Admin Panel; Project
Progress+Require Project+Tech Note+Daily Report+Picket Showroom). Setiap
temuan RLS diverifikasi ulang terhadap **kronologi git** (bukan cuma isi file)
karena repo ini punya riwayat patch RLS yang sangat aktif — beberapa temuan
awal dari sub-audit ternyata sudah ditambal migrasi tanggal 2 September 2026
(sehari sebelum audit ini), dan beberapa lainnya, setelah dicek, ternyata
**belum** ditambal. Setiap temuan di bawah mencantumkan tanggal/commit migrasi
RLS yang relevan supaya statusnya bisa diverifikasi ulang tanpa menebak.

**Aturan yang dipegang laporan ini**: hidden button ≠ aman, RLS SQL file di
repo ≠ terjamin live di produksi (dump `sql/full-schema/` dibuat 30 Agustus,
sudah basi untuk beberapa tabel), HTTP 200 ≠ operasi berhasil, role/id dari
client ≠ terpercaya.

---

## Executive Summary

Platform ini pakai auth kustom (bukan Supabase Auth): sesi cookie httpOnly +
JWT PostgREST yang diterbitkan server (`lib/db-token.ts`) berisi klaim
`sub` (id), `username`, `user_role`, `full_name`, `sales_division`,
`access_level`. Klaim ini **tidak bisa dipalsukan langsung** (ditandatangani
HMAC server-side) — tapi RLS di banyak tabel memercayai **nilai klaim itu**
sebagai bukti kepemilikan baris (`assign_name = jwt_full_name()`, dst), dan
nilai kolom `users.full_name`/`username`/`jabatan` yang jadi sumber klaim itu
**bisa diubah sendiri oleh pemiliknya** lewat REST langsung — trigger pembeku
kolom istimewa (`guard_users_privileged_columns`) tidak mencakup keempatnya.
Ini akar dari temuan P0 paling penting di laporan ini (lihat P0-1).

Middleware hanya memvalidasi keberadaan cookie sesi, tidak pernah memeriksa
role. Otorisasi sesungguhnya ada di dua tempat: (a) 22 route API di
`app/api/*` — mayoritas **sudah solid**, memakai `getSessionUser()`/
`isAdminRole()`/`pastikanAdmin()`/`pastikanMasuk()` sebelum menyentuh
service-role, dan (b) RLS Postgres — yang jadi **satu-satunya garis
pertahanan** untuk hampir seluruh operasi tulis, karena hampir semua
`page.tsx` menulis LANGSUNG ke Supabase dari browser (`supabase.from(...)
.update/insert/delete(...)`), tanpa lapisan server route di antaranya. Gate
`isAdmin`/`canManage`/`bolehX` di React state **sama sekali tidak
menghalangi** siapa pun yang memanggil client Supabase langsung dari
DevTools/curl.

Total: **6 P0, 12 P1, 10 P2, 5 P3** (rincian di bawah).

---

## Critical Findings — P0

### P0-1 — [SINTESIS, LINTAS-MODUL] Self-rename mengalahkan seluruh hardening kepemilikan RLS tanggal 2 September
**Severity**: P0 · **Module**: Tickets, Reminders, Project Requests, Project Progress (semua sub-tabel) · **File**: `sql/users-bisa-ditugaskan.sql:57-89` (trigger), `lib/db-token.ts:71-84`, `app/api/auth/session/route.ts:38-57`, `sql/edit-scoped-ke-assignee.sql`, `sql/reminders-edit-scoped-ke-aktor.sql`

**Problem**: Migrasi tanggal 2 September 2026 (`sql/edit-scoped-ke-assignee.sql` 14:21, `sql/reminders-edit-scoped-ke-aktor.sql` 14:32) menutup lubang besar "siapa pun bisa UPDATE baris siapa pun" pada `tickets`/`reminders`/`project_requests`/`progress_*` dengan mempersempit RLS ke syarat kepemilikan (`assign_name = jwt_full_name()`, `sales_name = jwt_full_name()`, `pic = jwt_full_name()`, `created_by = jwt_claim('username')`, dst). Tapi fungsi `guard_users_privileged_columns()` (`sql/users-bisa-ditugaskan.sql:78-89`) — trigger yang membekukan kolom istimewa di `users` dari tulisan langsung `anon`/`authenticated` — **hanya membekukan**: `role, team_type, allow_incentive_input, allowed_menus, access_level, incentive_akses, incentive_brand_scope, piket_akses, telegram_chat_id, bisa_ditugaskan`. **`username`, `full_name`, `jabatan`, `atasan_id`, `kpi_enabled` TIDAK ada di daftar itu** — bebas diubah sendiri oleh pemilik baris (`users_ubah` RLS: `id::text = jwt_claim('sub')`).

Dan `full_name`/`username` dipanggang ulang ke JWT baru **setiap kali sesi dipulihkan** (refresh halaman) tanpa perlu logout — `app/api/auth/session/route.ts:55-57` menerbitkan token baru dari nilai `users` TERKINI.

**Attack scenario**: User mana pun (role apa pun) yang login sah:
1. `PATCH .../users?id=eq.<id_sendiri> {"full_name": "<nama target, mis. Manager PTS>"}` — lolos RLS karena `id = sub` miliknya sendiri.
2. Refresh halaman (atau tunggu pemantau sesi 60 detik) — JWT baru terbit membawa `full_name` baru.
3. Sekarang setiap RLS yang mensyaratkan `jwt_full_name() = '<nama target>'` meloloskannya — termasuk `tk_update` (`assign_name = jwt_full_name()`, **tanpa fallback id sama sekali** — cek `assign_user_id` yang dulu ada di kebijakan lama sudah dihapus saat "diperbaiki"), dan `pp_update`/`pl_update`/`pi_update`/`pc_update` (Project Progress — **100% berbasis nama, tidak ada fallback id sama sekali**).
4. Ubah status/nominal/assignment tiket atau proyek milik siapa pun yang namanya baru saja ia pakai, lalu (opsional) ganti `full_name` balik ke nama asli untuk menghapus jejak.

**Current behavior**: Trigger pembeku dirancang eksplisit untuk mencegah "siapa pun bisa mengeluarkan dirinya sendiri dari antrean kerja" (komentar `sql/users-bisa-ditugaskan.sql:44-46`) — tapi tidak pernah diperluas untuk melindungi kolom yang jadi **input** klaim RLS, hanya kolom yang jadi **objek** hak akses.

**Expected behavior**: `username`, `full_name`, `jabatan`, `atasan_id` dibekukan dari tulisan langsung `anon`/`authenticated` sama seperti kolom hak akses lain — perubahan nama/jabatan/hierarki hanya lewat `/api/admin/users` (service-role, `isAdminRole` check).

**Recommended fix**: Tambahkan kelima kolom (`username`, `full_name`, `jabatan`, `atasan_id`, `kpi_enabled`) ke `guard_users_privileged_columns()` cabang `UPDATE`. Untuk kolom yang memang wajar diubah user biasa (mis. user ingin memperbaiki typo nama sendiri), sediakan jalur lewat route server yang memvalidasi tidak ada tabrakan dengan nama yang sudah dipakai orang lain di baris yang sedang aktif diproses (atau, lebih sederhana, jadikan perubahan nama/jabatan admin-only sepenuhnya — pola yang sudah ada untuk kolom lain).

**Database impact**: Satu migrasi trigger, tidak menyentuh data. **Regression risk**: rendah — user biasa saat ini tidak seharusnya mengubah nama/jabatan sendiri lewat jalur lain; perlu dicek dulu tidak ada fitur UI sah yang bergantung pada self-edit `full_name`/`jabatan` (grep cepat: form profil hanya menawarkan ganti password + hubungkan Telegram, bukan ganti nama).

---

### P0-2 — `tk_insert`/`rm_insert`/`pr_insert` MASIH terbuka penuh — belum tersentuh hardening 2 September
**Severity**: P0 · **Module**: Ticketing, Reminder Schedule, Require Project · **File**: `sql/kunci-tabel-lanjutan.sql:271,281,291` (definisi asli, dikonfirmasi belum ada migrasi susulan — di-grep ulang, tidak ada file lain yang men-`DROP POLICY`/`CREATE POLICY` untuk `tk_insert`/`rm_insert`/`pr_insert`)

**Problem**: Migrasi 2 September (`edit-scoped-ke-assignee.sql`, `reminders-edit-scoped-ke-aktor.sql`, `full-access-jwt-dan-delete-rls.sql`) hanya menyasar `UPDATE` dan `DELETE`. Kebijakan `INSERT` untuk ketiga tabel inti workflow masih `WITH CHECK (true)` — **siapa pun yang login (role apa pun, termasuk `guest`/pendaftaran baru yang menunggu approval) bisa INSERT baris baru dengan kolom apa pun**, termasuk `status`, `assign_name`, `assign_user_id`, `created_by`, `routing_status`.

**Attack scenario**: User `guest` (role terendah, akun baru menunggu approval admin — lihat alur register) memanggil:
```js
supabase.from('tickets').insert([{
  status: 'Pending', assign_name: 'Siapa Saja', created_by: 'nama_orang_lain',
  project_name: '...', issue_case: '...'
}])
```
Tiket langsung aktif di antrean kerja tim tanpa pernah melewati approval, dengan jejak audit (`created_by`) yang dipalsukan. Pola sama persis berlaku untuk `reminders` (bypass alur Request→Review→Approve→Route) dan `project_requests` (bypass alur Design Project sepenuhnya).

**Expected behavior**: `WITH CHECK` untuk INSERT minimal memvalidasi `created_by`/`requester_id` cocok dengan `jwt_claim('username')`/`jwt_user_id()` pemanggil, dan kolom keputusan (`status`, `assign_name`, dst) tidak bisa diisi bebas oleh non-admin saat insert (baris baru harus lahir di status awal yang benar, ditentukan trigger/default, bukan input klien).

**Recommended fix**: `WITH CHECK (created_by = jwt_claim('username') OR sales_user_id = jwt_user_id())` sebagai syarat minimum, plus trigger `BEFORE INSERT` yang memaksa `status` awal ke nilai yang sah untuk non-elevated user (menolak insert langsung dengan status "sudah disetujui"), mengikuti pola `guard_users_privileged_columns` yang sudah ada.

**Database impact**: perlu trigger baru + policy replace. **Regression risk**: sedang — perlu dipetakan dulu SEMUA jalur insert sah (banyak: form ticket baru, reminder dari macam-macam trigger, request project) supaya tidak memblokir alur yang sah.

---

### P0-3 — Kolom insentif (`incentive_value`, `bast_date`, dll) tersimpan di `reminders`, ditulis lewat RLS row-level TANPA melalui `incentive_akses` sama sekali
**Severity**: P0 · **Module**: Incentive PTS · **File**: `sql/reminders-edit-scoped-ke-aktor.sql:34-60`, `sql/incentive-akses-reminders-rls.sql:53-68` (baru menambal SELECT, bukan UPDATE), `app/incentive-pts/_components/calc.ts:900-913`, `app/incentive-pts/page.tsx:399-478`

**Problem**: Seluruh sistem tier akses `lib/incentive-akses.ts` (`lihat`/`input`/`penuh`) menjaga tabel `incentive_tranches`/`incentive_splits`/`incentive_scheme_settings` — tapi nominal, tanggal BAST, dan penanda keikutsertaan insentif **disimpan sebagai kolom di tabel `reminders`**, yang RLS-nya row-level (siapa aktor pada baris), bukan column-level. Tidak ada trigger pembeku kolom istimewa di `reminders` (beda dari `users`).

**Attack scenario**: Team Handler dengan `incentive_akses = 'lihat'` (default semua orang) yang ditugaskan pada proyeknya sendiri (`assign_name` cocok — atau, digabung dengan P0-1, siapa pun yang menyamar jadi assignee lewat self-rename) memanggil:
```js
supabase.from('reminders').update({ incentive_value: 500000000, bast_date: '2026-09-03' }).eq('id', <id proyek sendiri>)
```
Lolos RLS karena ia aktor sah pada baris (assign_name cocok). Nilai ini mengalir apa adanya ke `insertTranches()` saat pemegang akses `input`/`penuh` menekan "Generate Tahapan" — tanpa verifikasi ulang terhadap nilai kontrak asli. Pool insentif proyek dan seluruh pembagian yang dihitung darinya jadi salah besar, sepenuhnya di luar jangkauan sistem tier akses yang dikira jadi satu-satunya penjaga modul ini.

**Recommended fix**: Trigger `guard_reminders_incentive_columns` (pola sama `guard_users_privileged_columns`) yang membekukan `incentive_value`, `bast_date`, `incentive_excluded`, `brand`, `pic_type`, `pic_id` dari tulisan `anon`/`authenticated` KECUALI pemanggil lolos `akses_insentif_input()`/`penuh()`. Alternatif: pindahkan kelima kolom ke route server yang memverifikasi `bisaInputNominal`/`bisaKonfigPenuh` di server, pola yang sudah dipakai `/api/incentive/akses`.

**Database impact**: trigger baru pada tabel tersibuk platform — perlu hati-hati agar tidak memblokir update kolom lain (status, catatan) oleh aktor sah yang BUKAN pemegang incentive_akses. **Regression risk**: sedang-tinggi, perlu pemetaan kolom yang cermat sebelum apply.

---

### P0-4 — Require Project: Requester bisa self-approve tahap "Internal Review" (bypass kontrol dua-pihak)
**Severity**: P0 · **Module**: Require Project / Design Project · **File**: `sql/edit-scoped-ke-assignee.sql:34-50` (`pr_update`, migrasi 2 Sept 14:21 — masih berlaku, dikonfirmasi ini definisi TERBARU), `app/form-require-project/page.tsx:790-797, 1074-1097, 223-228`

**Problem**: Tahap approval `internal_review` seharusnya hanya bisa disetujui reviewer yang di-assign lewat `internal_sales_id`/`internal_sales_id_2` (orang berbeda dari pembuat request — kontrol dua-pihak). Tapi `pr_update` (definisi TERBARU, bukan yang lama) memvalidasi kepemilikan lewat `requester_id`/`sales_name`/`assign_name`/`ivp_assignee` — **tidak mengenal `internal_sales_id` sama sekali**, dan tidak membatasi kolom mana yang boleh diubah pemilik baris.

**Attack scenario**: Sales pembuat request (match `requester_id`) memanggil langsung:
```js
supabase.from('project_requests').update({
  internal_approved_at: now, internal_approved_by: <diri sendiri>, routing_status: 'admin_review'
}).eq('id', req.id)
```
Lolos RLS karena baris tetap miliknya. Request lolos ke tahap Admin seolah sudah direview pihak independen, padahal review sungguhan tidak pernah terjadi.

**Recommended fix**: Trigger `BEFORE UPDATE` yang menolak perubahan kolom `internal_approved_*`/`routing_status` kecuali pemanggil adalah `internal_sales_id`/`internal_sales_id_2` yang sah untuk baris itu, atau admin/full-access — bukan sekadar menambah OR-condition longgar lain ke `pr_update`.

**Database impact**: trigger baru pada `project_requests`. **Regression risk**: sedang, perlu daftar kolom "milik siapa" yang eksplisit per tahap alur.

---

### P0-5 — Tech Note: penulis bisa self-approve catatannya sendiri (mempengaruhi KPI)
**Severity**: P0 · **Module**: Tech Note · **File**: `sql/daily-report-movement-technote-review-scoped.sql:70-82` (`tn_ubah`, migrasi 2 Sept 15:05 — TERBARU), `app/tech-note/page.tsx:501-518, 291-293`

**Problem**: `tn_ubah` (versi terbaru) menambahkan `OR author_id = jwt_claim('sub')` supaya penulis bisa memperbaiki typo pada catatannya sendiri — tapi kondisi ini berlaku untuk UPDATE **seluruh kolom**, termasuk `status`, `reviewed_by`, `reviewed_by_name`, `reviewed_at`, `review_note`.

**Attack scenario**: Penulis (role `team` biasa, bukan admin/supervisor/Full Access) memanggil:
```js
supabase.from('tech_notes').update({ status: 'approved', reviewed_by: <diri sendiri>, reviewed_at: now }).eq('id', myNoteId)
```
Note langsung `approved` tanpa direview siapa pun — bisa dipakai memalsukan pencapaian KPI (target 2 tech note approved/tahun per orang, `KKM_REQUIRED`).

**Recommended fix**: Pisahkan hak "edit konten" (author boleh: title/description/one_drive_link) dari "keputusan review" (hanya canManage) lewat trigger yang menolak perubahan `status`/`reviewed_*` kecuali admin/superadmin/Full Access/supervisor.

**Database impact**: trigger baru. **Regression risk**: rendah, cakupannya sempit dan jelas.

---

### P0-6 — [Historis, perlu verifikasi produksi] `tk_update`/`rm_update` sempat wide-open, diklaim sudah ditambal sehari sebelum audit
**Severity**: P0 (historis) / perlu verifikasi · **Module**: Ticketing, Reminder Schedule · **File**: `sql/full-schema/04_rls.sql:338-340,305-307` (dump 30 Agustus — BASI untuk kedua kebijakan ini) vs `sql/edit-scoped-ke-assignee.sql` & `sql/reminders-edit-scoped-ke-aktor.sql` (2 September, lebih baru)

**Problem**: Dump skema live 30 Agustus menunjukkan `tk_update`/`rm_update` = `USING(true) WITH CHECK(true)` — bug yang sama persis kelasnya dengan P0-4/P0-5 tapi mencakup SELURUH kolom SELURUH baris tanpa syarat apa pun, bukan cuma kolom approval. File migrasi bertanggal 2 September (sehari sebelum audit ini) mengklaim sudah menutup ini dengan syarat kepemilikan, dan masing-masing menyertakan catatan "DIVERIFIKASI (simulasi JWT langsung)" di kaki berkasnya.

**Kenapa masih dilaporkan sebagai P0, bukan dicoret**: Sesuai aturan audit ini — **file SQL di repo bukan bukti kebijakan itu benar-benar live di database produksi**. `sql/full-schema/` sendiri punya disclaimer eksplisit "bukan mekanisme migration harian" dan "tidak otomatis update ketika migration baru ditambahkan". Tidak ada akses langsung ke database produksi dari sesi audit ini untuk mengonfirmasi kedua migrasi 2 September benar-benar ter-apply.

**Recommended fix**: BUKAN kode — jalankan `sql/periksa-menyeluruh.sql` (murni baca) di Supabase SQL Editor produksi dan bandingkan definisi `tk_update`/`rm_update` yang benar-benar aktif dengan isi `sql/edit-scoped-ke-assignee.sql`/`sql/reminders-edit-scoped-ke-aktor.sql`. Bila cocok, turunkan status temuan ini jadi "closed, terverifikasi" pada audit berikutnya — JANGAN diasumsikan tertutup hanya dari isi file.

**Catatan penting**: bahkan bila kedua migrasi ini SUDAH live, **P0-1 (self-rename) tetap membuka celah yang secara efektif setara** — karena kepemilikan yang jadi syarat barunya persis yang bisa dipalsukan lewat P0-1.

---

## High Findings — P1

### P1-1 — `supabaseServices` (basis data lintas-organisasi) dipanggil client tanpa identitas apa pun
**Module**: Ticketing (Team Services) · **File**: `lib/supabase.ts:139-142`, pemanggil di `app/ticketing/page.tsx:1631-1736,1980-1982,2189-2201,2332-2427`
Client dibuat dengan anon key polos (`NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY`, ikut ter-bundle ke JS browser), sengaja tanpa token identitas — otorisasi sepenuhnya bergantung RLS proyek Supabase Services yang **terpisah dan di luar repo ini**, tidak bisa diverifikasi dari sini. Siapa pun yang mengekstrak anon key itu dari bundle JS publik bisa memanggil PostgREST proyek Services langsung. **Rekomendasi**: audit terpisah untuk RLS proyek Supabase Services — prasyarat untuk menyimpulkan keparahan sesungguhnya.

### P1-2 — `reminders.status` tanpa CHECK constraint di DB
**Module**: Reminder Schedule · **File**: tidak ada entri untuk `reminders` di `sql/full-schema/02_constraints.sql`; `app/reminder-schedule/_components/shared.ts:19`
Kode mengasumsikan hanya 3 nilai (`pending|done|cancelled`), tapi DB tidak memvalidasinya — kombinasi dengan celah UPDATE (P0-1/P0-6) berarti nilai status bebas apa pun bisa ditulis, merusak logika hilir yang string-compare (filter kalender, form-review, kalkulasi incentive).

### P1-3 — `users.atasan_id` self-editable — mengarahkan porsi Supervisor/Manager insentif
**Module**: Incentive PTS, Admin Panel · **File**: `app/dashboard/_components/modal-user.tsx:865-873`, tidak ada di daftar beku (`sql/users-bisa-ditugaskan.sql`), `app/incentive-pts/_components/calc.ts:126-135,972-997`
`atasan_id` menentukan rantai Supervisor/Manager yang dibaca LIVE saat Process Batch. Self-write bisa mengarahkan porsi insentif ke chain rekaan sesaat sebelum batch diproses. Sama akar dengan P0-1 — masukkan ke daftar migrasi yang sama.

### P1-4 — Race condition nyata pada `processYearlyBatch` — potensi duplikasi `incentive_splits`
**Module**: Incentive PTS · **File**: `app/incentive-pts/_components/calc.ts:948-1150`; `sql/full-schema/02_constraints.sql:37-40` (tidak ada UNIQUE di `incentive_splits`)
UPDATE penanda `processed` (`:1127-1131`) tidak bersyarat `.eq('status','pending')` — dua eksekusi paralel (dua tab, dua orang menekan tombol nyaris bersamaan) sama-sama lolos baca `pending`, sama-sama insert set splits. Ini akar penyebab bug "Bagian Saya berlipat" yang komentar kode sendiri akui sudah terjadi nyata di produksi (Batch 2027) — yang sudah ditambal baru varian "RLS menolak diam-diam" (T-1), bukan varian "dua eksekusi diterima bersamaan". **Rekomendasi**: `.eq('status','pending')` pada UPDATE penanda + cek jumlah baris (klaim atomik), plus UNIQUE index `incentive_splits(tranche_id, role, user_id)` sebagai jaring pengaman kedua.

### P1-5 — `users.kpi_enabled` self-editable
**Module**: KPI Team, Admin Panel · **File**: `app/dashboard/_components/modal-admin-panel.tsx:239-250`, tidak ada di daftar beku
Siapa pun bisa keluar dari roster penilaian KPI sendiri tanpa approval admin.

### P1-6 — Require Project: approval internal gagal diam-diam (silent RLS rejection, tanpa `.select()`)
**Module**: Require Project · **File**: `app/form-require-project/page.tsx:1085` (bandingkan pola aman di baris 1217-1219, 1201 pada file yang sama)
Reviewer sah tapi bukan `requester_id`/`sales_name`/`assign_name`/`ivp_assignee` (kasus umum — reviewer divisi lain) menekan Approve; RLS `pr_update` menolak diam-diam (0 baris, tanpa error, karena `pr_update` tidak mengenal `internal_sales_id` — akar sama dengan P0-4); kode tetap lanjut kirim notifikasi sukses dan `logAudit` seolah approval terjadi, padahal DB tidak berubah. Request macet permanen di `internal_review`.

### P1-7 — Require Project: transisi status tidak divalidasi (state machine longgar)
**Module**: Require Project · **File**: `app/form-require-project/page.tsx:1214-1222,2206-2221`; `sql/edit-scoped-ke-assignee.sql:34-50`
Tidak ada trigger yang menolak `completed→pending`. Dropdown status di modal selalu menyertakan opsi mundur ke `pending`. Siapa pun yang lolos ownership `pr_update` (bukan cuma admin) bisa memundurkan status "Completed" yang seharusnya final.

### P1-8 — Daily Report: `dr_tambah` (INSERT) masih membolehkan SELURUH role `team` menulis laporan atas nama orang lain
**Module**: Daily Report · **File**: `app/daily-report/page.tsx:556-557,618-625,973-978`; `sql/ganti-lingkup-semua-pada-tulis-hapus.sql:296-298` (TERBARU, migrasi 2 Sept 15:23 — pengecualian ini **didokumentasikan sadar oleh tim**, bukan kelalaian, tapi alasannya belum menutup celahnya)
UI hanya menampilkan dropdown pemilihan user target ke `hasFullAccess()`. RLS `dr_tambah` memakai `lingkup_semua()` (ANY role `team`, tanpa syarat `access_level='full'`) — anggota tim biasa bisa INSERT baris `daily_reports` baru atas nama kolega tanpa sepengetahuannya (UPDATE sudah benar dibatasi, INSERT belum).

### P1-9 — Picket Showroom: roster piket (`piket_schedules`) bisa ditulis siapa pun di tim, bukan hanya Admin
**Module**: Picket Showroom · **File**: `app/picket-showroom/page.tsx:740`; `sql/ganti-lingkup-semua-pada-tulis-hapus.sql:182-191` (TERBARU)
UI hanya merender `ScheduleModal` (atur siapa PIC hari apa selama 2 minggu) untuk `isAdmin`, tapi RLS `ps_tambah`/`ps_ubah` memakai `lingkup_semua()` (ANY `team`) — anggota tim biasa bisa menulis ulang roster langsung lewat REST, mis. menghapus diri dari jadwal atau menugaskan rekan ke hari yang bukan gilirannya.

### P1-10 — Picket Showroom: hapus data tamu tidak benar-benar admin-only di server
**Module**: Picket Showroom · **File**: `app/picket-showroom/page.tsx:231,708`; RLS `ptd_tulis` (FOR ALL): `boleh_lihat_project(...) OR lingkup_semua()` — bukan `admin_atau_full_access()`
Tombol Hapus di UI admin-only, tapi kebijakan write-nya (dipakai juga untuk "Simpan" delete-lalu-insert-ulang) mencakup siapa pun yang lolos syarat visibility, bukan syarat admin.

### P1-11 — `/api/notifikasi/telegram`: aksi kirim default (tanpa `aksi`) tidak punya guard otorisasi
**Module**: Integrasi Notifikasi · **File**: `app/api/notifikasi/telegram/route.ts:198-232`
Berbeda dari aksi `cek`/`chat` (dijaga `pastikanAdmin`) dan `hubungkan`/`putuskan` (sengaja diskopkan ke `jaga.user.id` pemanggil sendiri), jalur kirim generik (`{chatId, pesan}`) di bagian bawah file **tidak memanggil `pastikanMasuk`/`pastikanAdmin` sama sekali** dan menerima `chatId` bebas. Middleware tetap mewajibkan cookie sesi untuk mencapai route ini (bukan endpoint publik), tapi **siapa pun yang sudah login** (role apa pun) bisa memakai bot Telegram resmi platform untuk mengirim pesan ke chat_id mana pun yang ia tahu — vektor social-engineering (pesan tampak resmi dari bot terpercaya) atau spam internal. Berbeda dari `hubungkan`/`putuskan` yang sudah benar menskop ke `jaga.user.id`, jalur ini tidak pernah diberi alasan tertulis kenapa dibiarkan tanpa guard.
**Rekomendasi**: tambahkan `pastikanMasuk()` minimal, dan idealnya batasi `chatId` yang boleh dituju ke: chat_id milik pemanggil sendiri (`telegram_chat_id` di baris `users`-nya) ATAU target admin-configured yang sudah ditentukan `lib/notifikasi/router.ts` — bukan nilai bebas dari body.

### P1-12 — Notifications: `nt_own` `WITH CHECK(true)` tanpa syarat — bisa menanam notifikasi palsu atas nama user lain
**Module**: Notifikasi (lintas platform) · **File**: `sql/full-schema/04_rls.sql:190-192`
Kebijakan `FOR ALL` pada `notifications`: `USING (user_id = jwt_claim('sub') OR lingkup_semua())` tapi `WITH CHECK (true)` tanpa syarat — bagian USING membatasi baca/hapus/update baris sendiri, tapi INSERT (yang hanya tunduk pada WITH CHECK) bebas menulis `user_id` siapa pun. Siapa pun yang login bisa menanam notifikasi palsu di kotak masuk orang lain (mis. notifikasi phishing "klik link ini" yang tampak berasal dari sistem).

---

## Medium Findings — P2

### P2-1 — Tickets: transisi status tidak divalidasi meski kepemilikan sudah benar
Bahkan setelah P0-6 dianggap tertutup (jika terverifikasi live), `tk_update` yang baru hanya memvalidasi SIAPA (assignee/admin), bukan APA (nilai status legal). `tickets_status_check` (`02_constraints.sql:160`) cuma memvalidasi keanggotaan 17 nilai status, bukan urutan transisi. Assignee sah sendiri masih bisa memundurkan `Solved→Pending`. **File**: `app/ticketing/page.tsx:1607-1612,2296-2302`.

### P2-2 — Race condition: ticket "Onsite" → duplikasi reminder otomatis
SELECT lalu INSERT tanpa unique constraint (`ticket_id`+`category`+status terbuka) pada pembuatan reminder otomatis saat status tiket diubah ke "Onsite". Dua submit nyaris bersamaan bisa lolos SELECT bersamaan, hasilkan dua baris reminder terbuka. **File**: `app/ticketing/page.tsx:1832-1834,1879`; tidak ada UNIQUE terkait di `02_constraints.sql`/`03_indexes.sql`.

### P2-3 — `handleMarkPaid` (Incentive PTS) tidak verifikasi baris hasil UPDATE
Beda dari 3 fungsi sejenis di file yang sama (`processYearlyBatch`, `batalkanBatchTahun`, `hapusTahapanProyek`) yang sudah dipatch memakai `.select('id')` + cek jumlah baris, `handleMarkPaid` masih pola lama — bisa melaporkan "Tranche ditandai Paid!" padahal RLS menolak diam-diam. **File**: `app/incentive-pts/page.tsx:721-724`.

### P2-4 — `sql/full-schema/` (dump instalasi baru) berisi kebijakan Incentive yang sudah usang
Dump 30 Agustus masih mencantumkan `it_ubah` versi lama (admin/superadmin saja), padahal migrasi 2 September (`incentive-akses-konfigurasi.sql`) sudah menggantinya jadi berbasis tier akses. Bukan lubang di produksi saat ini, tapi risiko nyata bila dipakai apa adanya untuk deploy ke perusahaan pembeli baru — Manager PTS tier `input`/`penuh` di instalasi baru itu tidak akan bisa memproses apa pun. **File**: `sql/full-schema/04_rls.sql:134-140` vs `sql/incentive-akses-konfigurasi.sql:108-124`.

### P2-5 — Picket Showroom: `piket_tamu_detail` write memakai fungsi yang didesain untuk baca, bukan tulis
`ptd_tulis` memakai `boleh_lihat_project()` — fungsi yang menurut dokumentasi kode sendiri (`lib/piket-akses.ts:34-37`) dimaksud murni untuk *visibility* (Sales dengan nama cocok "tetap tidak bisa menyunting"). RLS-nya menyalahi dokumentasi sendiri: Sales dengan nama cocok sebenarnya BISA insert/update/delete. **File**: `lib/piket-akses.ts:34-37,61-75`; `sql/full-schema/04_rls.sql:220-224`.

### P2-6 — Require Project: kolom sensitif (`assign_name`, `routing_status`) tidak dibatasi per-kolom
`pr_update` memvalidasi baris, bukan kolom — requester/assignee bisa mengganti `assign_name` ke namanya sendiri untuk "mencuri" pekerjaan yang belum resmi di-assign kepadanya. **File**: `sql/edit-scoped-ke-assignee.sql:34-50`.

### P2-7 — `product_team_map` write policy tidak konsisten dengan mapping table lain
Mapping table lain (`division_ivp_mappings`, `division_supervisor_mappings`, `user_supervisor_mappings`) sudah diperluas ke `admin_atau_full_access()`; `product_team_map` masih murni role admin/superadmin. Bukan celah (lebih ketat), tapi tidak konsisten dengan prinsip "Full Access setara admin di semua modul" platform ini. **File**: `sql/kunci-tabel-lanjutan-3.sql:96-100`.

### P2-8 — `tutupJadwalTicket` bisa menutup reminder hasil tanam via P0-2
Saat tiket ditolak/selesai, kode menutup semua `reminders` dengan `ticket_id`+`category='Troubleshooting'` cocok. Karena `rm_insert` masih terbuka (P0-2), pihak lain secara teori bisa menanam reminder dengan `ticket_id` manapun yang lalu ikut ter-cancel/done otomatis. Dampak nyata rendah, disertakan untuk kelengkapan. **File**: `app/ticketing/page.tsx:1565-1593`.

### P2-9 — Project Progress: pencocokan kepemilikan berbasis nama rapuh terhadap duplikat nama
`canEditRow`/`pp_update`/`pl_update` konsisten (UI dan RLS sama-sama pakai `sales_name = jwt_full_name()`), tapi keduanya bisa salah-cocok bila dua user punya `full_name` identik (typo data, bukan celah otorisasi langsung). **File**: `app/project-progress/page.tsx:485,599`; `sql/edit-scoped-ke-assignee.sql:61-64`.

### P2-10 — `escalate` cron memakai anon key, bukan service-role — silent no-op bila RLS ketat
`app/api/cron/escalate/route.ts:27-30` membuat client Supabase dengan anon key (beda dari `digest/route.ts` yang fallback ke service-role). Bila RLS pada `tickets`/`users` semakin diperketat ke depan, cron ini bisa berhenti mengeskalasi tanpa pesan galat apa pun — konsisten dengan pola "kegagalan diam-diam" yang jadi tema besar audit ini. **File**: `app/api/cron/escalate/route.ts:27-30`.

---

## Low Findings — P3

### P3-1 — Riwayat bug `access_level` di JWT — sudah diperbaiki, layak smoke-test operasional
Bug historis (`access_level` tidak pernah ikut payload JWT, melumpuhkan cabang Full Access `boleh_hapus_reminder()`) sudah diperbaiki (`lib/db-token.ts:83`, dikonfirmasi `sql/full-access-jwt-dan-delete-rls.sql`). Tidak ada bug aktif ditemukan; disarankan smoke-test operasional (login akun Full Access, cek `/api/auth/db-token-check`).

### P3-2 — Dead-simple informational: `set-credential` bisa diprediksi/hijack pada akun pending-approval baru dalam window 30 menit
UUID akun praktis tidak bisa ditebak (122-bit random) — bukan celah realistis, dicatat untuk kelengkapan saja.

### P3-3 — `db-token-check` mengembalikan klaim JWT pemanggil sendiri di response
Bukan kebocoran (klaim itu milik pemanggil sendiri, endpoint sudah admin-only) — dicatat sebagai catatan kebersihan desain saja.

### P3-4 — `sales_division` sebagai klaim JWT tidak divalidasi ulang di server pada beberapa titik
Nilai `sales_division` di JWT diisi dari DB saat login/refresh (bukan input client), jadi secara teknis tepercaya — dicatat untuk kelengkapan matrix, bukan temuan aktif.

### P3-5 — `tutupJadwalTicket`/reminder auto-generate tidak dicatat di `audit_trail` dengan aktor eksplisit
Perubahan status otomatis (bukan hasil klik manusia) tercatat, tapi kolom aktor bisa membingungkan investigasi forensik di kemudian hari — perbaikan kebersihan, bukan keamanan.

---

## Authorization Matrix (ringkasan — WHO/WHAT/HOW per modul utama)

| Module | Action | UI protection | API/Server protection | RLS protection (status TERBARU per kronologi git) | Risk |
|---|---|---|---|---|---|
| Ticket | Create | Form + `isElevated` client | Tidak ada | `tk_insert`: `WITH CHECK(true)` — **belum ditambal** | **P0** |
| Ticket | Edit/Status | `bolehUpdateTicket` client | Tidak ada | `tk_update`: `admin_atau_full_access() OR assign_name=jwt_full_name()` (2 Sept, perlu verifikasi live) — rentan P0-1 | **P0 (gabungan P0-1/P0-6)** |
| Ticket | Delete | admin-only UI | Tidak ada | `tk_delete`: `role IN (admin,superadmin)` — **benar, server-enforced** | Rendah |
| Ticket | Approve/Reject | `canApproveAssign` client | Tidak ada | sama seperti Edit/Status di atas | **P0** |
| Reminder | Create | Form | Tidak ada | `rm_insert`: `WITH CHECK(true)` — **belum ditambal** | **P0** |
| Reminder | Edit/Approve/Route | `isAdmin`/`isManager`/`isSecondReviewer` client | Tidak ada | `rm_update`: multi-aktor scoped (2 Sept) — rentan P0-1; kolom insentif rentan P0-3 | **P0** |
| Reminder | Delete | admin/Full Access UI | Tidak ada | `rm_delete`: `boleh_hapus_reminder()` — **benar, server-enforced** | Rendah |
| Incentive | Nominal/BAST | `bisaInputNominal` client | Sebagian (`/api/incentive/*` solid) | Kolom sumber ada di `reminders`, TIDAK dijaga tier akses (P0-3) | **P0** |
| Incentive | Splits delete | UI admin/input | `/api/incentive/splits` — **solid, server-enforced** | N/A (lewat route) | Rendah |
| Incentive | Batch process | `bisaKonfigPenuh`/`bisaInputNominal` client | Tidak ada | Race condition P1-4 | **P1** |
| Require Project | Internal Review Approve | `canInternalApproveProject` client | Tidak ada, tanpa cek hasil | `pr_update` tidak kenal `internal_sales_id` | **P0** |
| Require Project | Status update | Dropdown difilter parsial | Tidak ada | Tidak ada validasi transisi | **P1** |
| Require Project | Delete | `bisaKelolaRequest` | Tidak ada | `pr_delete`: admin/superadmin — **benar** | Rendah |
| Tech Note | Approve/Reject | `canManage` client | Tidak ada | `tn_ubah` termasuk `author_id=self` untuk SEMUA kolom | **P0** |
| Tech Note | Delete | `canManage` | Tidak ada | `tn_hapus`: admin/Full Access/supervisor — **benar** | Rendah |
| Project Progress | Edit lokasi/proyek | `canEditRow` client | Tidak ada | 100% nama-based, rentan P0-1 | **P0 (via P0-1)** |
| Project Progress | Share link publik | — | `/api/project-progress/share/[token]` — **solid, sudah diverifikasi** | N/A | Rendah |
| Daily Report | Insert atas nama lain | `isAdmin` untuk dropdown | Tidak ada | `dr_tambah`: ANY `team`, tanpa syarat Full Access | **P1** |
| Picket Showroom | Atur roster | `isAdmin`-only UI | Tidak ada | `ps_tambah`/`ps_ubah`: ANY `team` | **P1** |
| Picket Showroom | Hapus data tamu | `isAdmin`-only UI | Tidak ada | `ptd_tulis`: visibility-based, bukan admin-only | **P1** |
| Admin | User/Mapping changes | admin-only UI | `/api/admin/users` — **solid**, whitelist kolom + `isAdminRole` | `users_ubah` row-self OR admin; kolom istimewa dibekukan **KECUALI** `full_name`/`username`/`jabatan`/`atasan_id`/`kpi_enabled` | **P0 (P0-1)** |
| Learning Center | Admin actions | — | — | Tidak diaudit ulang (di luar lingkup instruksi task; sesi sebelumnya sudah menutup celah ranking/grading) | Tidak diaudit |

---

## State Machine Matrix (nilai status nyata dari kode, bukan asumsi)

| Module | Status values (dari kode) | Transisi divalidasi di DB? | Siapa bisa ubah (RLS aktual) |
|---|---|---|---|
| Ticket | 17 nilai (`tickets_status_check`, `02_constraints.sql:160`): Waiting Approval, Pending, Call, Onsite, In Progress, Pending Action, Solved, Overdue, Rejected, Returned to PTS, Cancelled, Warranty, dll | **Tidak** — hanya keanggotaan nilai, bukan urutan | Assignee (`assign_name`) atau admin/Full Access — TAPI lihat P0-1 (nama bisa dipalsukan) |
| Reminder | `pending`/`done`/`cancelled` (asumsi kode, `shared.ts:19`) | **Tidak** — bahkan keanggotaan nilai pun tidak divalidasi DB (P1-2) | Multi-aktor (banyak kolom id/nama) — TAPI lihat P0-1 untuk cabang nama |
| Project Request | pending/waiting_approval/internal_review/admin_review/approved/in_progress/completed/rejected/cancelled (dari alur kode) | **Tidak** — dropdown UI selalu sediakan opsi mundur ke `pending` (P1-7) | requester/sales/assignee/admin — TAPI internal_review approve bisa di-bypass requester sendiri (P0-4) |
| Tech Note | draft → submitted → approved/revision/rejected | **Tidak** — author bisa langsung set `approved` (P0-5) | author (untuk konten) — TAPI juga untuk status (bug) |
| Incentive Tranche | pending → processed → paid | **Sebagian** — `it_ubah` (2 Sept) admin/tier-akses, TAPI race condition pada transisi pending→processed (P1-4) | Tier `input`/`penuh` atau admin |

---

## Cross-Module Workflow

```
Ticket (Troubleshooting, status "Onsite")
   │  P2-2: race condition — SELECT-then-INSERT tanpa unique constraint
   ▼
Reminder (auto-generated, category='Troubleshooting')
   │  P0-2: rm_insert masih WITH CHECK(true) — reminder bisa ditanam pihak luar
   │  P0-1: rm_update kepemilikan bisa dipalsukan via self-rename
   ▼
Team Handler menandai "Completed" — INPUT tanggal BAST manual (bukan otomatis "hari ini")
   │  ✅ DIVERIFIKASI BERSIH: syncKeIncentive() (app/reminder-schedule/_components/shared.ts:606-650)
   │     HANYA mengubah incentive_excluded=false, TIDAK PERNAH menulis bast_date.
   │     Tanggal BAST asli ditulis SEKALI di modal "Completed", tetap sebagai
   │     <input type="date"> yang bisa dikoreksi petugas — bukan new Date() otomatis
   │     saat admin menekan tombol Sync. Sesuai syarat eksplisit user, tidak ada bug.
   │  P0-3: TAPI incentive_value/bast_date bisa ditulis LANGSUNG oleh siapa pun
   │     yang lolos sebagai aktor pada baris reminder itu, tanpa incentive_akses.
   ▼
Incentive PTS: Generate Tahapan → incentive_tranches (UNIQUE constraint project_id+tranche_number ✅)
   ▼
Process Batch → incentive_splits (TIDAK ADA unique constraint — P1-4 race condition nyata)
   ▼
Report/Dashboard: baca dari incentive_splits/tranches — akurasinya bergantung penuh
   pada P0-3 dan P1-4 di atas TIDAK dieksploitasi.
```

**Kesimpulan langsung menjawab syarat user ("tanggal BAST harus dari completion asli, bukan tanggal Sync")**: alur ini **SUDAH BENAR** by design dan diverifikasi dari kode — tidak ada titik yang menuliskan tanggal "hari ini" sebagai BAST saat admin menekan Sync. Risiko yang tersisa di jalur ini murni soal SIAPA yang boleh menulis `bast_date`/`incentive_value` sejak awal (P0-3), bukan KAPAN nilai itu ditulis.

---

## Race / Duplicate Risks

| # | Lokasi | Constraint DB ada? | Klaim atomik di kode? | Status |
|---|---|---|---|---|
| 1 | Ticket Onsite → auto reminder | Tidak (P2-2) | Tidak (SELECT lalu INSERT biasa) | Terbuka, dampak sedang |
| 2 | Incentive Tranche (Generate Tahapan) | **Ya** — UNIQUE `(project_id, tranche_number)` | N/A (constraint sudah cukup) | **Tertutup** |
| 3 | Incentive Splits (Process Batch) | Tidak (P1-4) | Tidak — UPDATE penanda tidak bersyarat status | **Terbuka, sudah pernah kejadian nyata di produksi (Batch 2027 menurut komentar kode)** |
| 4 | User registration (username unik) | Ya — UNIQUE di kolom `username` | Ya (23505 ditangani eksplisit) | Tertutup |
| 5 | Incentive Group (`satukanProyek`/`pisahkanProyek`) | N/A — pakai kolom `reminders.incentive_group_id`, bukan tabel terpisah | Tidak butuh (bukan pola SELECT-then-INSERT) | Tidak berlaku |
| 6 | Mapping tables (user/division supervisor) | Tidak dicek unique per (user,supervisor) | Tidak diaudit mendalam | Tidak diprioritaskan — dampak duplikasi rendah (baris ganda hanya redundan, bukan salah) |

---

## RLS Verification

### VERIFIED FROM CODE (definisi terbaru per kronologi git, per 3 Sept 2026)
- `tk_delete`, `rm_delete`, `pr_delete`, `pa2_hapus`, `pm_hapus`, `users_hapus` — admin/Full-Access-only, benar.
- `/api/integrasi/rahasia`, `/api/admin/users`, `/api/incentive/akses`, `/api/incentive/splits`, `/api/auth/*` — server-side, solid.
- `pp_update`/`pl_update`/`pi_update`/`pc_update`, `tk_update`, `rm_update`, `pr_update` — sudah diskop ke kepemilikan (2 Sept), TAPI rentan P0-1 (self-rename).
- `tk_insert`, `rm_insert`, `pr_insert` — **dikonfirmasi masih `WITH CHECK(true)`**, tidak ada migrasi susulan ditemukan.
- `guard_users_privileged_columns()` — dikonfirmasi TIDAK mencakup `username`/`full_name`/`jabatan`/`atasan_id`/`kpi_enabled`.
- `incentive_splits`, `incentive_disbursements`, `incentive_settings`, `user_credentials`, `user_sessions`, `login_attempts`, `password_reset_otps`, `rahasia_integrasi`, `ticket_support_assignment`, `identitas_*` — DENY-ALL untuk client, service-role only — **dikonfirmasi sengaja**, bukan kelalaian.

### MUST VERIFY IN PRODUCTION SUPABASE (tidak bisa dipastikan dari repo)
1. **Apakah `tk_update`/`rm_update` versi 2 September BENAR-BENAR ter-apply di database produksi** (bukan cuma tertulis di repo) — jalankan `sql/periksa-menyeluruh.sql` di SQL Editor produksi dan bandingkan.
2. Apakah SEMUA 42+ tabel yang disebut "RLS aktif" di `sql/full-schema/04_rls.sql` benar-benar match definisi live saat ini — dump itu bertanggal 30 Agustus dan sudah terbukti basi untuk beberapa tabel penting (P2-4 adalah contoh nyata).
3. Status RLS proyek Supabase Services (P1-1) — di luar repo ini sepenuhnya.
4. Apakah ada trigger/function lain di database live yang tidak tercermin di `sql/` (mis. hasil eksperimen SQL Editor yang tidak pernah dikomit ke repo).

---

## Remaining Write-Result Risks (Phase 10)

Total lokasi tulis (`insert`/`update`/`delete`/`upsert`) di `app/`+`lib/`: **304**. Sweep sebelumnya ("22 titik penulisan") sudah menutup situs berisiko tertinggi (workflow state, insentif, KPI, mapping routing). Audit kali ini **tidak** melakukan pemindaian baris-demi-baris pada 304 titik — sesuai instruksi ("jangan memaksa setiap operation menjadi fatal"), fokusnya pada otorisasi bukan pada pola penulisan. Satu temuan baru ditemukan secara insidental:

- **CRITICAL** (baru, lihat P2-3): `handleMarkPaid` (Incentive PTS) — pola lama tanpa `.select()`, padahal 3 fungsi sejenis di file yang sama sudah dipatch.

**BEST EFFORT** (dicek sekilas, tidak perlu tindakan): cleanup notifikasi gagal kirim, cascade delete lampiran sebelum delete utama yang sudah dicek — konsisten dengan filosofi codebase yang sudah mapan dari sweep sebelumnya.

Rekomendasi: sweep baris-demi-baris lengkap terhadap 304 titik adalah pekerjaan terpisah yang layak, tapi levelnya P3/kebersihan kode dibanding 6 P0 di atas — jangan dikerjakan sebelum P0 selesai.

---

## Production Verification Required (ringkasan)

1. `sql/periksa-menyeluruh.sql` di SQL Editor produksi — bandingkan `tk_update`/`rm_update` LIVE vs isi `sql/edit-scoped-ke-assignee.sql`/`sql/reminders-edit-scoped-ke-aktor.sql` (P0-6).
2. Konfirmasi `guard_users_privileged_columns()` yang LIVE persis sama dengan `sql/users-bisa-ditugaskan.sql` (belum ada kolom tambahan yang membekukan `full_name`/`username`/dst secara terpisah di produksi tanpa tercatat di repo).
3. Audit terpisah RLS proyek Supabase **Services** (P1-1) — di luar jangkauan repo ini sepenuhnya.
4. Regenerasi `sql/full-schema/` dari database live saat ini (sudah basi sejak 30 Agustus untuk beberapa tabel) sebelum dipakai untuk deploy ke perusahaan pembeli baru manapun.

---

## Recommended Fix Order

1. **P0-1** (bekukan `username`/`full_name`/`jabatan`/`atasan_id`/`kpi_enabled`) — satu migrasi trigger, menutup akar dari P0-1, P1-3, P1-5 sekaligus, dan melemahkan dampak P0-6/P0-4/P0-5 secara signifikan (mengurangi siapa yang bisa memalsukan kepemilikan).
2. **P0-2** (`tk_insert`/`rm_insert`/`pr_insert` WITH CHECK) — menutup jalur fabrikasi record dari nol, dampak tertinggi kedua.
3. **P0-4, P0-5** (self-approve Require Project & Tech Note) — masing-masing satu trigger kolom-spesifik, scope sempit, risiko regresi rendah.
4. **P0-3** (kolom insentif di `reminders`) — butuh pemetaan kolom lebih cermat (jangan sampai memblokir update status/catatan oleh aktor sah bukan pemegang incentive_akses), tapi dampak finansial tertinggi.
5. **Verifikasi produksi P0-6** — bisa dikerjakan paralel dengan di atas (murni baca, tidak menunggu).
6. **P1-4** (race condition Process Batch) — sudah pernah kejadian nyata, prioritas tinggi meski "hanya" P1.
7 P1-6 s.d. P1-12, lalu P2, P3 — sesuai urutan besar-kecil dampak pada tabel di atas.

**Semua rekomendasi di atas adalah SARAN, belum dieksekusi — sesuai instruksi, audit ini berhenti di laporan.**
