# Audit Total Incentive PTS

Ditulis saat audit menyeluruh modul Incentive PTS, dari alur sumbernya
(Reminder Schedule) sampai baris pembagian yang masuk ke rekap Finance.
Berkas ini merekam **apa yang salah, kenapa, dan apa yang sudah diubah** —
supaya keputusannya bisa dibaca ulang setahun lagi tanpa menebak-nebak.

Keadaan data saat audit: 44 proyek `done` masuk kriteria, 24 tahapan
pencairan, 22 baris pembagian. Belum ada satu pun yang `paid`; seluruh
nominal masih uji coba.

---

## 1. Alur data: Reminder Schedule → Incentive PTS

Daftar Incentive **bukan tabel sendiri**. Ia diturunkan langsung dari
`reminders` (Request Schedule) dengan tiga syarat:

| Syarat | Sumber |
|---|---|
| `category` termasuk kategori insentif | dulu dipaku di kode, **kini dari Skema Pembagian** |
| `status = 'done'` | ditandai Handler saat menekan Completed |
| `incentive_excluded` bukan `true` | tombol "Keluarkan dari Incentive" |

Lalu `gabungkanProyek()` merapatkan jadwal berhari-hari menjadi satu baris
proyek, dan `deteksiKandidatGabung()` menandai jadwal yang **kemungkinan**
satu proyek yang sama.

Konsekuensi yang penting dipahami: **apa pun yang salah di Request Schedule
akan salah juga di Incentive.** BAST kosong, mode penyelesaian kosong, brand
kosong, nama proyek beda ketik — semuanya mengalir ke sini.

---

## 2. Temuan dan perbaikannya

### T-1 (KRITIS) — Penghapusan baris pembagian selalu gagal, tanpa galat

`incentive_splits` memakai *force RLS* dan **satu-satunya** kebijakannya
adalah `INSERT` untuk anon. Tidak ada kebijakan `DELETE`. Tiga jalur di
`calc.ts` menghapus splits langsung dari peramban:

- rollback di dalam `processYearlyBatch()`
- `batalkanBatchTahun()` (tombol "Batalkan Batch")
- `hapusTahapanProyek()` (tombol "Hapus Tahapan")

Ketiganya mengenai **nol baris**, dan PostgREST tidak menganggapnya galat —
baris yang ditolak RLS bukan error. Layar tetap melapor *"Baris pembagiannya
dihapus"*, status tahapan kembali `pending`, lalu Process Batch berikutnya
menulis **set kedua** di atas set lama.

**Ini sebab nyata baris "Bagian Saya" yang tampil berlipat 2–5×** — bukan
sekadar kegagalan penandaan `processed` seperti dugaan awal.

**Perbaikan:** penghapusan dipindah ke `DELETE /api/incentive/splits`
(service-role, memverifikasi pemanggil, dan menolak menyentuh tahapan
`paid`). Ketiga jalur di `calc.ts` sekarang lewat sana dan **memeriksa
jumlah baris yang benar-benar terhapus.**

### T-2 (KRITIS) — `batalkanBatchTahun` tidak membersihkan tahapan `pending`

Versi lama hanya menyasar tahapan berstatus `processed`. Justru tahapan
`pending`-lah yang paling mungkin punya split nyasar: ia jadi `pending`
persis karena pemrosesan gagal di tengah (splits sudah tertulis, penandaan
`processed`-nya yang gagal), atau karena pembatalan sebelumnya yang tidak
pernah benar-benar menghapus apa pun (T-1).

**Perbaikan:** pembersihan mencakup semua tahapan tahun itu yang **bukan**
`paid`. Status `processed → pending` juga kini diperiksa dengan
`.select('id')`, karena UPDATE yang ditolak RLS mengembalikan nol baris
tanpa galat.

**Data:** 2 baris pembagian yatim ditemukan & dihapus — Korlantas TMC
Soreang tahap 3 (tahun bayar 2029, masih `pending`), berisi set yang tidak
lengkap (hanya PIC + Manager). Sisa tabel bersih: tidak ada lagi tahapan
dengan baris pembagian kembar.

### T-3 (KRITIS) — Skema pembagian bisa ditulis ulang oleh SEMUA anggota team

Kebijakan `iss_tulis` pada `incentive_scheme_settings` berbunyi
`lingkup_semua()`, yang berarti `admin` **atau** `superadmin` **atau**
`team`. Artinya setiap anggota Team PTS bisa menulis ulang aturan pembagian
uang lewat REST dengan anon key — padahal layarnya sendiri sejak dulu hanya
dibuka untuk admin. Ini lubang, bukan kelonggaran yang disengaja.

**Perbaikan:** kebijakannya kini `akses_insentif_penuh()`.

### T-4 (BESAR) — Deteksi proyek kembar mensyaratkan BAST sama persis

`deteksiKandidatGabung()` memakai kunci `${nama}::${bast_date}`. Satu serah
terima yang jadwalnya dua hari (Konfigurasi hari ini, Training besok)
ditutup dengan dua tanggal BAST berurutan, dan pasangan seperti itu **tidak
pernah** ditandai.

Contoh nyata di data: **Celebrity Fitness MOI** — dua baris, BAST 2026-08-10
dan 2026-08-11, keduanya belum digabung, salah satunya sudah punya nominal
Rp 1.000.000. Selama terpisah, satu pekerjaan punya dua pool insentif.

**Perbaikan:** perbandingan tanggal memakai **toleransi 7 hari** dan
dirangkai berantai, sehingga dua BAST berurutan ditandai sebagai kandidat
sementara dua kontrak berbeda (mis. Maret vs September) tetap terpisah.
Toleransinya sengaja pendek. Ini tetap hanya **menandai** — penggabungan
selalu keputusan manusia. Diuji di `uji/kelompok-insentif.ts`.

### T-5 (BESAR) — Akses modul dipaku di kode; Manager PTS terkunci

Ada **tiga** aturan berbeda untuk satu pertanyaan di modul yang sama:

| Fungsi | Isinya | Dipakai untuk |
|---|---|---|
| `isAdmin()` | `role === 'admin' \|\| 'superadmin'` | tab Skema, tab Pengaturan, Process Batch, set brand |
| `canInputNominal()` | `isAdmin() \|\| allow_incentive_input` | tab Tranche, tab Late Ticket, kolom nominal |
| `bolehKelolaIncentive()` | jabatan `Manager` + `team_type` PTS, **dipaku di kode** | gabung/keluarkan proyek |

Tiga aturan berarti tiga jawaban yang bisa berbeda — dan itulah persisnya
yang terjadi: **Manager PTS bisa menggabungkan dan mengeluarkan proyek,
tapi tidak bisa membuka Skema Pembagian maupun Pengaturan Akses.** Membuka
aksesnya berarti mengubah kode lalu deploy ulang. Untuk platform yang dijual
ke perusahaan lain, itu tidak bisa dipakai: tiap perusahaan menamai jabatan
pimpinannya sendiri.

**Perbaikan:** satu aturan saja, dan ia **data**. Kolom
`users.incentive_akses` dengan tiga tingkat:

| Tingkat | Boleh |
|---|---|
| `lihat` | melihat proyek yang ia terlibat & bagiannya sendiri (bawaan) |
| `input` | isi nominal, buat & proses tahapan pencairan |
| `penuh` | seluruh konfigurasi: skema, akses, process batch, set brand, hapus tahapan |

Diatur dari tab **Pengaturan Akses** (tiga tombol per orang). `admin` selalu
`penuh`. Aturan yang sama dipakai tiga sisi supaya tidak bisa berbeda
pendapat:

- layar → `lib/incentive-akses.ts`
- route server → berkas yang sama
- basis data → fungsi `akses_insentif()` di `sql/incentive-akses-konfigurasi.sql`

Ini penting: sebelumnya layar bisa menampilkan tombol yang penyimpanannya
ditolak RLS **diam-diam** — persis kegagalan Process Batch yang membuat
duplikat.

Manager PTS IVP diberi `penuh`.

### T-6 (BESAR) — Kategori proyek dipaku di kode

`INCENTIVE_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training']`
adalah kebijakan bisnis yang ditulis sebagai kode. Perusahaan lain menamai
layanannya sendiri.

**Perbaikan:** kategori pindah ke skema (`kategoriProyek`) dan disunting di
**Skema Pembagian → Seksi 1 "Cakupan Proyek"**. Daftar lama tetap jadi
bawaan, jadi skema yang sudah tersimpan tidak berubah perilakunya.

### T-7 (SEDANG) — `incentive_brand_scope` tidak pernah dibekukan untuk anon

Trigger `guard_users_privileged_columns` membekukan `role`, `team_type`,
`allow_incentive_input`, `allowed_menus`, `access_level` — tapi **tidak**
`incentive_brand_scope`. Siapa pun bisa memperluas lingkup brand-nya sendiri
lewat REST.

**Perbaikan:** `incentive_brand_scope` dan `incentive_akses` ikut dibekukan.

### T-8 (SEDANG) — Tahapan pencairan: izin tidak konsisten

- `INSERT` boleh oleh **siapa pun yang login**
- `UPDATE` (processed/paid) hanya oleh `admin`
- `DELETE` **tidak punya kebijakan sama sekali** → "Hapus Tahapan" selalu 0 baris

Akibatnya pemegang izin input nominal bisa membuat tahapan tapi tidak pernah
bisa memprosesnya, dan Process Batch-nya gagal diam-diam — kembali ke T-1.

**Perbaikan:** `INSERT`/`UPDATE` = `akses_insentif_input()`,
`DELETE` = `akses_insentif_penuh()`.

---

### T-10 (KRITIS, ditemukan sesudah dirilis) — sisa 7 percobaan Process Batch gagal, dari sebelum T-1 diperbaiki

Laporan nyata: PLN Salatiga dikeluarkan lewat "Keluarkan dari Incentive",
tapi tahapannya masih tampil di Tranche Schedule; dan PIC yang tertulis di
baris pembagiannya adalah nama LAMA, bukan yang berlaku sekarang di Request
Schedule.

**Pemeriksaan platform-wide** (bukan cuma PLN Salatiga) menemukan **7
tahapan T1/Tahun Bayar 2027** yang statusnya masih `pending` tapi SUDAH
punya baris pembagian tertulis — persis gejala T-1 (Process Batch menulis
splits, lalu gagal menandai `processed`). Semuanya bertanggal **29–30
Agustus** — sebelum perbaikan T-1 di sesi ini (jadi bukan kejadian baru,
sisa dari sebelum rollback-nya benar):

| Proyek | Peran yang sudah tertulis | Nama yang tertulis vs PIC sekarang |
|---|---|---|
| PLN Salatiga | pic/manager/supervisor/installer | **Pandu Kusuma Adji** (split) vs **Taufik wahyudi** (sekarang) |
| Korlantas TMC Soreang | pic/manager/installer | cocok |
| OCS Indonesia | pic/manager/supervisor | cocok |
| UIN Pekalongan | pic/manager/supervisor/installer | cocok |
| Solitaire Billiard & Bar | pic/manager/supervisor | cocok |
| Steak 21 Gading Serpong | pic/manager/supervisor | cocok |
| Celebrity Fitness MOI | pic/manager | cocok |

Total **22 baris pembagian yatim**. Kalau ini dibiarkan lalu admin menekan
**Process Batch 2027**, ketujuh tahapan itu masih dibaca `pending` →
`processYearlyBatch` menulis **set kedua** di atasnya, lalu (dengan
perbaikan T-1 yang sekarang bekerja benar) berhasil ditandai `processed` —
hasilnya tahapan `processed` dengan splits DOBEL. Persis "Bagian Saya"
berlipat yang sudah pernah dibereskan, muncul lagi lewat jalur berbeda.

**Data dibersihkan**: 22 baris pembagian yatim dihapus (tahapannya tetap
`pending`, bersih, siap diproses ulang dengan benar). PLN Salatiga sendiri
sudah dikeluarkan dari Incentive — ketiga tahapannya (T1/T2/T3, semua
`pending`, tanpa yang `processed`/`paid`) ikut dihapus sepenuhnya.

**Perbaikan kode**: `setProyekDikeluarkan()` sekarang membersihkan tahapan
`pending` (dan baris pembagian yatimnya, kalau ada) milik proyek yang baru
dikeluarkan — supaya "Keluarkan dari Incentive" berarti proyek itu benar-
benar tidak ikut Incentive sama sekali, bukan cuma berhenti dihitung dari
titik ini. Yang `processed`/`paid` tidak pernah disentuh (diperiksa ulang di
sini, tidak dipercaya begitu saja dari pemanggil).

**Soal PIC "nyantol"**: di luar kasus data-yatim ini, aturannya memang
disengaja begitu — baris pembagian yang SUDAH benar-benar diproses membekukan
nama PIC saat itu sebagai jejak (proyek dihitung tiga kali dalam tiga tahun,
dan rekap tahun 1 harus tetap bisa dijelaskan meski PIC-nya berganti di
tahun 2). Yang salah bukan pembekuannya — yang salah adalah tahapan yang
MASIH `pending` ikut punya baris pembagian sama sekali, padahal seharusnya
kosong sampai benar-benar diproses.

## 3. Yang diperiksa dan ternyata BUKAN bug

- **3 baris pembagian tanpa `user_id`** — installer eksternal, memang tidak
  punya akun. Nama & daerahnya tetap tercatat.
- **Jumlah Tahap 1 melebihi kolam tahapan tim** — disengaja. Installer
  dibayar penuh di muka (`installerBayarDiMuka`), dititipkan sebagai baris
  tambahan di tahap pertama; seluruh tahapan tetap milik Tim PTS.
- **Satu kelompok proyek tanpa tahapan** — nominalnya memang belum diisi.
- **`payment_year` bergeser** — tidak ada satu baris kode pun yang mengubah
  `payment_year` sesudah tahapan dibuat. Kecurigaan awal tidak terbukti;
  yang nyata adalah T-1/T-2.

---

### T-9 (KRITIS, ditemukan sesudah dirilis) — `incentive_brand_scope` tidak pernah bisa MELEBARKAN, hanya menyempitkan

Laporan nyata: admin memberi Anes (Marketing, IVP) akses **Input** + lingkup
brand **IVP** dari Pengaturan Akses. Yang tampil di daftar Incentive PTS-nya
cuma **5 dari 43** proyek, dan tidak satu pun tambahan IVP/Kedua Brand ikut
muncul.

**Sebab**: `fetchIncentiveProjects()` membaca tabel `reminders` pakai anon
key milik Anes sendiri. Kebijakan RLS `rm_select` pada tabel itu adalah
**aturan Sales** (`boleh_lihat_baris`) — hanya meloloskan baris milik
sendiri / divisi yang dipetakan kepadanya, sama sekali tidak tahu-menahu
soal `incentive_akses` atau `incentive_brand_scope`. Diverifikasi langsung
dengan mensimulasikan JWT Anes: baris kategori-insentif yang lolos RLS
persis 5 — SEBELUM kode Incentive PTS sempat menyaring apa pun berdasarkan
brand. `incentive_brand_scope` karena itu hanya bisa **menyempitkan** dari
apa yang sudah dipangkas RLS ke "milik sendiri saja" — tidak pernah bisa
melebarkannya ke seluruh brand seperti yang dimaksud pengaturannya.

**Perbaikan**: kebijakan `rm_select` ditambah satu jalur lolos baru —
pemegang akses insentif `input`/`penuh` boleh membaca baris berkategori
insentif (dibaca dari skema tersimpan via `kategori_insentif_db()`,
konsisten dengan T-6), terlepas dari kepemilikan/divisinya. Penyaringan
brand di layar (`bolehLihatBrand`) tetap berjalan **sesudahnya** seperti
biasa — perbaikan ini hanya membuka pintu yang sebelumnya tertutup rapat
sebelum penyaringan brand sempat bekerja.

Ditemukan bug KEDUA saat memverifikasi perbaikan pertama: fungsi bantu
`kategori_insentif_db()` yang baru ditulis mengembalikan **array kosong**
alih-alih daftar bawaan, karena tidak ada satu pun baris
`incentive_scheme_settings` yang punya kolom `kategoriProyek` (kolom itu
baru ditambahkan di T-6 dan belum pernah tersimpan — admin belum menyimpan
ulang skema sejak itu). `COALESCE` tidak menangkap "array kosong tapi bukan
NULL". Diperbaiki dengan memeriksa `jsonb_array_length(...) > 0` secara
eksplisit sebelum memakainya, baru jatuh ke bawaan.

**Diverifikasi** (simulasi JWT langsung ke database):
- Anes (akses `input`, lingkup IVP): 5 → **49 baris lolos RLS** (lalu
  disaring brand di layar: IVP + tanpa-brand tampil, MVI tersembunyi seperti
  seharusnya — tidak ada proyek "Kedua Brand" di data saat ini, jadi
  kekosongannya bukan bug, memang belum ada datanya).
- Admin: tetap 49 (tidak berubah — kontrol regresi).
- Guest tanpa akses insentif: tetap 7, dibatasi lingkup Sales seperti
  sebelumnya (kontrol regresi — akses yang diperluas benar-benar hanya
  untuk pemegang `incentive_akses` `input`/`penuh`).

Berkas: `sql/incentive-akses-reminders-rls.sql`.

## 4. Yang masih perlu tindakan manusia

| Hal | Jumlah | Akibat bila dibiarkan |
|---|---|---|
| Proyek `done` tanpa `mode_penyelesaian` | 4 | **Gagal** saat Process Batch — porsinya tidak bisa dihitung |
| Proyek `done` tanpa brand | 26 | Terlihat oleh semua petugas apa pun lingkup brand-nya |
| Celebrity Fitness MOI belum digabung | 1 pasang | Dua pool insentif untuk satu pekerjaan |
| Akun `guest` generik punya izin input nominal | 1 | Akun bersama memegang akses data paling sensitif |

Tiga yang pertama kini **muncul sendiri di layar** (spanduk kelengkapan data
dan spanduk kandidat gabung di tab Projects), bukan baru ketahuan setelah
Process Batch gagal.

Di luar modul ini, masih berdiri temuan lama yang belum ditindak: **dua
kredensial tertulis langsung di dalam fungsi basis data** — service-role JWT
Supabase di `check_pending_tickets()` dan token Fonnte di
`handle_ticket_assignment()`. Keduanya perlu dirotasi.

---

## 5. Berkas yang berubah

| Berkas | Perubahan |
|---|---|
| `sql/incentive-akses-konfigurasi.sql` | kolom `incentive_akses`, fungsi `akses_insentif*()`, kebijakan RLS, trigger pembekuan |
| `lib/incentive-akses.ts` | aturan akses (murni — dipakai layar & server) |
| `lib/incentive-akses-api.ts` | pemanggil klien |
| `app/api/incentive/akses/route.ts` | setel akses & lingkup brand (penjaga: akses penuh, bukan role admin) |
| `app/api/incentive/splits/route.ts` | `DELETE` baru; `GET` mengikuti tingkat akses |
| `app/incentive-pts/_components/calc.ts` | penghapusan lewat server, `batalkanBatchTahun` diperbaiki, kategori dari skema |
| `app/incentive-pts/page.tsx` | satu aturan akses, tab Pengaturan Akses 3 tingkat, spanduk kelengkapan data |
| `app/incentive-pts/_components/SchemeTab.tsx` | Seksi 1 "Cakupan Proyek" |
| `lib/incentive-scheme.ts` | `kategoriProyek` + pemeriksaannya |
| `lib/kelompok-insentif.ts` | toleransi tanggal BAST |
| `app/reminder-schedule/page.tsx` | memakai kategori dari skema |
| `lib/admin-users.ts`, `app/api/admin/users/route.ts` | jalur akses insentif yang kembar dihapus |
| `uji/kelompok-insentif.ts` | 5 pengujian toleransi BAST |
