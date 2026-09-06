# Audit Platform — UI/UX, Mapping & Assign, Notifikasi, Antar-Menu

Tanggal: 6 September 2026 · Cakupan: 214 berkas / 74.678 baris / 14 modul

Setiap temuan di bawah **sudah diverifikasi** — lewat pemindai yang membaca
seluruh berkas `.tsx/.ts`, dibaca ulang di kodenya, dan untuk yang menyangkut
data, dicek langsung ke database produksi. Yang tidak bisa dipastikan tidak
ditulis di sini.

Urutannya mengikuti dampak, bukan area. Bagian akhir memuat yang **diperiksa
dan ternyata sehat**, supaya penyisiran berikutnya tidak mengulang jalan yang
sama.

---

## 🔴 A1 — 21 dari 22 saklar notifikasi di Admin Panel tidak berpengaruh

**Berkas:** `lib/notifikasi/router.ts` · `lib/wa.ts:37` · `app/dashboard/_components/modal-integrasi.tsx:699`

Admin Panel → Integrations → **Kanal & Event** menampilkan 22 kejadian dengan
centang per kanal ("centang lewat kanal mana masing-masing dikabarkan").
Centang itu dibaca oleh `kirimNotifikasi()` di `router.ts`.

Tapi dari **62 titik pengiriman** WA/Telegram di platform ini, yang benar-benar
lewat `kirimNotifikasi()` hanya **satu**: WA selamat datang di
`modal-bersama.tsx:74`. Sisanya memanggil `sendWANotif`/`sendWA`/`sendFonnteWA`
langsung, yang hanya tunduk pada **saklar induk** WhatsApp/Telegram — bukan
pada centang per-event.

Akibatnya: admin yang mematikan "Detail tiket diperbarui" melihat centangnya
tersimpan, lalu pesannya tetap terkirim. Ini bukan pengaturan yang salah
hitung — ini pengaturan yang tidak tersambung ke apa pun.

Ini **disengaja dan terdokumentasi** (lihat catatan panjang di `router.ts`:
memindahkan 62 titik sekaligus tanpa cara menguji pengiriman sungguhan
dianggap terlalu berisiko). Yang belum ada: tanda di layarnya. Admin tidak
punya cara tahu mana centang yang hidup.

**SUDAH DIKERJAKAN — keduanya.**

1. `EVENT_TERSAMBUNG` di `katalog.ts` jadi satu sumber kebenaran, dan UI-nya
   menandai sendiri kejadian yang saklarnya belum berlaku ("belum aktif" +
   pemberitahuan "baru N dari 22").
2. Titik pengirimannya disambungkan — tapi **bukan** dengan memindahkan 62
   titik ke `kirimNotifikasi()`. Cara itu memang berisiko. Yang dipakai:
   parameter `event` OPSIONAL pada `sendWA`/`sendWANotif`/`sendFonnteWA`.
   Titik yang menyebutkan kuncinya tunduk pada saklar per-event; titik yang
   belum menyebutkannya berperilaku **persis** seperti sebelumnya. Tidak ada
   momen "semua pindah sekaligus", jadi tidak ada momen semua bisa rusak
   sekaligus.

   21 dari 22 kejadian kini tersambung. Yang tersisa,
   `system.user_registered`, memang bukan titik WA/Telegram — ia menulis
   notifikasi in-app langsung di `/api/auth/register`.

**Diverifikasi terhadap setelan produksi yang sebenarnya** (dibaca dari
`app_settings.notifikasi.kanal`), bukan terhadap bawaan: WhatsApp memang
sudah dimatikan admin, Telegram hidup, dan 22 kejadian sudah diatur satu per
satu. Hasil simulasi seluruh 21 kejadian: **tepat 5 yang berhenti terkirim,
dan kelimanya adalah kejadian yang admin sendiri kosongkan** (`perEvent: []`)
— `project.internal_review`, `project.updated`, `project.brand_cc`,
`reminder.form_review_sent`, `system.account_created`. Enam belas sisanya
tidak berubah sama sekali. Jadi yang terjadi bukan "notifikasi mati", tapi
"pengaturan yang selama ini diabaikan akhirnya dipatuhi".

Empat titik di Ticketing (ticket ditolak, ticket selesai, diterima Team
Services, dikembalikan ke PTS) sengaja **tidak** dianotasi: belum ada kunci
yang cocok di katalog, dan memaksakan kunci yang salah lebih buruk daripada
membiarkannya memakai jalur lama.

---

## 🔴 A2 — Kelompok "PTS Daerah" tersimpan dengan nama dobel & ikut dropdown assign

**Berkas:** `app/dashboard/_components/modal-kelompok.tsx:78,85`
**Data produksi:** `app_settings.kelompok`

Isi tersimpan hari ini:

```json
{ "nama": "Team PTS PTS Daerah", "label": "PTS PTS Daerah",
  "ditugaskan": true, "cabang": true, "lonceng": ["tiket","require","jadwal","review"] }
```

Tiga hal terpisah, semuanya terlihat pengguna:

**a. Nama dobel.** `tambah()` selalu menambahkan awalan `Team PTS ` kecuali
ketikannya diawali "Team". Admin mengetik "PTS Daerah" → jadi
"Team PTS **PTS** Daerah", label "PTS PTS Daerah". Label inilah yang muncul di
dropdown **Tipe PTS** pada form Tambah Akun. Perbaikannya: buang juga awalan
"PTS " yang sudah diketik admin, atau tampilkan pratinjau nama jadinya sebelum
ditambahkan.

**b. Ikut dropdown assign.** `ditugaskan: true` membuat anggotanya (Ridwan)
ditawarkan di dropdown assign Ticketing, Request Schedule, dan Request Design
Project — padahal `cabang: true` dibuat justru supaya kelompok ini hanya
dipilih di **satu** titik: dropdown PTS Daerah saat jadwal Remote diselesaikan.
Penyebabnya kelompok baru lahir dengan `ditugaskan: true`. Untuk kelompok yang
dicentang PTS Cabang, bawaannya sebaiknya `false`.

**c. Dapat semua lonceng.** Kelompok baru lahir dengan
`lonceng: [...SEMUA_LONCENG]`, jadi mitra daerah menerima lonceng tiket,
require, jadwal, dan review internal.

**Bisa dibereskan admin sekarang tanpa deploy** (Admin Panel → Kelompok:
matikan "Bisa Ditugaskan", kurangi lonceng). Yang perlu kode hanya bawaannya,
supaya perusahaan berikutnya tidak jatuh ke lubang yang sama.

---

## 🟡 A3 — Notifikasi hanya membuka daftar, bukan record-nya (5 tujuan)

**Berkas:** `app/dashboard/page.tsx:509`

Setiap notifikasi yang diklik dikirim dengan deep-link `?open=<id record>`.
Tapi hanya **4 halaman** yang membacanya:

| Tujuan | Baca `?open=` | Jumlah titik notifikasi |
|---|---|---|
| `/ticketing` | ✅ | 11 |
| `/reminder-schedule` | ✅ | 10 |
| `/form-require-project` | ✅ | 5 |
| `/form-review` | ✅ | 1 |
| `/tech-note` | ❌ | **3** (semuanya ber-`ref_id`) |
| `/project-progress` | ❌ | 1 (ber-`ref_id`) |
| `/incentive-pts` | ❌ | 1 — **tanpa `ref_id`** |
| `/learning-center` | ❌ | 1 — **tanpa `ref_id`** |
| `/kpi-team` | ❌ | 1 — **tanpa `ref_id`** |

**Koreksi saat pengerjaan.** Tiga tujuan terakhir ternyata tidak mengirim
`ref_id` sama sekali — notifikasinya memang bersifat kabar ("insentif tahap 2
cair", "essay kamu sudah dinilai"), tidak menunjuk satu record yang bisa
dibuka. Jadi tidak ada yang bisa di-deep-link di sana, dan menambahkannya
hanya akan jadi kode yang tidak pernah jalan. Yang dikerjakan: **Tech Note**
dan **Project Progress**.

Sebaliknya, penyisiran ulang menemukan yang terlewat dari audit awal: **4
notifikasi Request Schedule tidak menyertakan `ref_id`** padahal halamannya
sudah mendukung deep-link — jadwal baru yang di-route ke Supervisor, request
yang perlu review Sales Internal, dan dua notifikasi approval Admin/Manager.
Keempatnya sudah diperbaiki.

Perbaikannya seragam: tiap halaman membaca `?open=` lalu membuka detailnya,
meniru yang sudah ada di `/ticketing` (termasuk penjaga sekali-jalan supaya
detail tidak terbuka lagi tiap daftarnya di-fetch ulang, dan pembungkus
`<Suspense>` yang diwajibkan Next.js untuk `useSearchParams`).

---

## 🟡 A4 — 78 nama tim dipaku di kode, tersebar di 19 berkas

Platform ini dijual ke perusahaan lain, dan perusahaan lain tidak punya tim
bernama "Team PTS IVP". Daftar kelompok sudah bisa diatur admin
(`lib/kelompok.ts`), tapi 19 berkas masih menyebut namanya langsung:

| Berkas | Jumlah |
|---|---|
| `app/picket-showroom/` (page + 2 modal) | **27** |
| `app/kpi-team/` (page + 2 komponen) | 10 |
| `app/dashboard/_components/GlobalSearch.tsx` | 6 |
| `app/dashboard/_components/modal-admin-panel.tsx` | 5 |
| `app/reminder-schedule/_components/ReminderFormModal.tsx` | 7 |
| 14 berkas lain | @1–3 |

`lib/kelompok.ts` (8) sah — itu daftar bawaannya sendiri.

### Koreksi & pembagian saat pengerjaan

Setelah dibaca satu per satu, 78 titik itu terbagi tiga, dan hanya kelompok
pertama yang bisa diperbaiki tanpa menyentuh basis data:

**a. Murni kode — sudah diperbaiki.**
- `ReminderFormModal.tsx` — dua optgroup "PTS IVP"/"PTS MVI" pada dropdown
  assign diganti satu optgroup per kelompok yang "Bisa Ditugaskan". Ini yang
  paling berdampak: sebelumnya anggota kelompok baru **tidak pernah bisa
  dipilih sama sekali** saat menugaskan jadwal.
- `kpi-team/_components/shared.ts` — `TEAM_COLORS` hanya mengenal tiga
  kelompok; sisanya jatuh ke abu-abu yang sama, jadi dua kelompok baru tidak
  bisa dibedakan di grafik. Ditambah `warnaTim()` dengan warna cadangan yang
  dipilih dari nama kelompoknya — satu kelompok selalu mendapat warna yang
  sama di seluruh layar, bukan warna acak per render. Tujuh titik pemanggil
  ikut dipindahkan.
- `GlobalSearch.tsx` — gerbang `isPTSsup` memakai tiga nama tetap, sehingga
  Supervisor di kelompok baru tidak dikenali dan lingkup pencariannya
  diam-diam menyempit.

**b. False positive — tidak ada yang perlu diperbaiki.**
`modal-admin-panel.tsx` sudah punya `FALLBACK_PALETTE` untuk kelompok yang
tidak dikenal; tiga entri yang terdeteksi pemindai adalah warna pilihan untuk
kelompok bawaan, bukan asumsi bahwa hanya ada tiga. `lib/kelompok.ts` sendiri
sama — itu memang daftar bawaannya.

**c. Terhalang SKEMA — SUDAH DIKERJAKAN.**
Piket Showroom (27 titik) dan turunannya tidak bisa digenerikkan dengan
mengganti daftar nama, karena **tabel `piket_schedules` sendiri punya sepasang
kolom per tim**: `pic_ivp_id`/`pic_ivp_name`, `pic_ump_*`, `pic_mvi_*`. Tim
keempat tidak punya tempat untuk disimpan.

Dikerjakan sesuai rencana empat langkah, dan langkah 1–3 sudah selesai:

1. ✅ Kolom `pic jsonb` (`{user_id, name, team_type}`) — migrasi
   `piket_pic_jsonb`, sudah dijalankan ke produksi.
2. ✅ Backfill dari enam kolom lama: **90 dari 90 baris, nol yang meleset**
   (diperiksa: tidak ada baris ber-PIC ganda, dan tidak ada selisih antara
   `pic->>'user_id'` dengan kolom lamanya). Kolom lama **tidak dihapus**.
3. ✅ Seluruh pembacaan & penulisan lewat satu pintu di
   `picket-showroom/_components/shared.ts` — `bacaPicPiket()` (baca `pic`,
   cadangan ke kolom lama) dan `tulisPicPiket()` (tulis keduanya sekaligus).
   Dropdown PIC dan dropdown Team R&D kini satu optgroup per kelompok PTS.
4. ⬜ **Belum**: hentikan penulisan ke kolom lama, lalu hapus kolomnya di
   migrasi tersendiri. Sengaja ditunda sampai terbukti satu siklus pemakaian —
   selama kolom lamanya masih terisi, perubahan ini bisa dibatalkan tanpa
   kehilangan data.

Piket Showroom: 27 hardcode → 6, dan keenamnya berada di dalam dua fungsi
transisi itu — tempatnya memang di situ, dan hilang sendiri di langkah 4.

**Dua bug ikut ketemu saat memindahkan turunannya:**

- `GlobalSearch.tsx` — penyaringan piket untuk Supervisor menyebut tiga nama
  tim lalu `return true` sebagai penutup. Supervisor kelompok PTS **baru**
  jatuh ke penutup itu dan melihat piket **seluruh** tim — kebalikan dari yang
  dimaksud penyaringnya.
- `kpi-team/page.tsx` — jumlah piket dihitung dengan menebak nama kolom dari
  tim orangnya, dengan tebakan terakhir `pic_mvi_name`. Anggota kelompok baru
  selalu jatuh ke sana, jadi piketnya **tidak pernah terhitung**.

`DashboardKPI.tsx` — `isPTSIVP`/`isPTSUMP`/`isPTSMVI` dihapus: dideklarasikan
tapi tidak pernah dipakai di mana pun.

Sisa hardcode se-repo: **78 → 47**, dan yang tersisa adalah palet warna yang
sudah bercadangan, daftar bawaan `lib/kelompok.ts` sendiri, serta dua fungsi
transisi di atas.

---

## 🟡 A5 — Dialog bawaan browser di 2 modul

**Berkas:** `app/tech-note/page.tsx` (4 `alert` + 1 `confirm`) ·
`app/picket-showroom/page.tsx` (3 `alert`)

Platform ini punya `ConfirmDialog` dan sistem toast sendiri yang dipakai
modul lain. Delapan titik ini memakai dialog bawaan browser: tampilannya beda
total, menyebut nama domain, tidak bisa diberi gaya, dan `confirm()` memblokir
seluruh halaman. Menggantinya dengan komponen yang sudah ada bukan pekerjaan
besar.

---

## 🟡 A6 — Label form tidak terhubung ke input-nya

Pola di seluruh platform: `<label>Nama</label><input />` tanpa `htmlFor`/`id`.
Terbaca mata, tapi pembaca layar tidak menyebutkan labelnya — dan mengklik
label tidak memfokuskan input-nya. Sekitar 254 input, paling padat di
`form-require-project/_components/Modals.tsx` (31) dan
`dashboard/_components/modal-akun.tsx` (22).

Ini pola, bukan 254 bug terpisah — sekali diperbaiki di komponen input bersama,
sebagian besar ikut beres.

Sejalan dengan ini: 10 berkas punya overlay modal tanpa `role="dialog"`/
`aria-modal` (paling banyak `kpi-team/page.tsx`, 4 overlay tanpa satu pun).

---

## 🟢 A7 — Logika "siapa penerima admin" disalin di 4 tempat

`lib/penerima-admin.ts` · `lib/notifications.ts:62` ·
`app/api/auth/register/route.ts:127` · `app/ticketing/page.tsx:844`

Keempatnya **sudah benar hari ini** — semuanya menyertakan pemegang Full
Access, bukan hanya role admin/superadmin. (Pemindai saya sempat menandai dua
di antaranya sebagai bug; setelah dibaca, ternyata memakai query kedua yang
terpisah.)

Yang tersisa cuma risiko ke depan: aturan "siapa yang dianggap admin" harus
diubah di empat tempat, dan yang terlewat tidak akan memunculkan galat —
hanya berhenti mengabari seseorang. `penerima-admin.ts` sudah ada untuk ini
dan tinggal dipakai tiga tempat sisanya.

---

## ✅ Yang diperiksa dan ternyata sehat

Ditulis supaya penyisiran berikutnya tidak mengulang jalan yang sama:

- **Saringan assign konsisten.** Keempat modul yang meng-assign memakai
  `bolehDitugaskan()`/`isAssignablePTSTeam()` dari `lib/teams.ts`. Tidak ada
  yang menawarkan orang di luar tim yang ditugaskan, dan toggle
  `bisa_ditugaskan` dihormati di semuanya.
- **Kunci menu bersih.** 13 menu, tidak ada kunci di `ALL_MENU_KEYS` yang
  tidak punya menu. (Kunci hantu `form-require-project` — tersimpan di
  `allowed_menus` sebagian akun Sales lama padahal tidak membuka apa-apa —
  sudah tidak diwariskan ke paket menu baru.)
- **Tabel aman di HP.** Semua `<table>` sudah berada di dalam pembungkus
  `overflow-x-auto`. Lebar px besar yang terdeteksi pemindai semuanya
  `maxWidth` wadah, bukan `minWidth` yang memaksa layar melebar.
- **Deep-link `admin:<tab>`** untuk notifikasi yang menunjuk ke tab Admin
  Panel (bukan halaman) ditangani benar di `dashboard/page.tsx:500`.
- **Grid col-span implisit** — 24 titik yang membuat form berantakan di HP,
  sudah diperbaiki dan diverifikasi render di 4 ukuran layar hari ini.

---

## Urutan pengerjaan yang disarankan

| # | Temuan | Ukuran | Kenapa didahulukan |
|---|---|---|---|
| 1 | A2b/A2c — bawaan kelompok PTS Cabang | kecil | Sedang berlaku di produksi, mitra luar ikut dropdown assign & lonceng internal |
| 2 | A2a — nama kelompok dobel | kecil | Terlihat pengguna di dropdown form akun |
| 3 | A1 (opsi 1) — label jujur saklar event | kecil | Menghentikan pengaturan yang menyesatkan admin |
| 4 | A3 — deep-link 5 halaman | sedang | Seragam, meniru pola yang sudah ada |
| 5 | A5 — ganti dialog bawaan | sedang | Komponennya sudah ada |
| 6 | A4 — nama tim dipaku (mulai Piket Showroom) | besar | Penghalang saat dijual ke perusahaan lain |
| 7 | A6 — label & aria modal | besar | Perbaiki di komponen bersama lebih dulu |
| 8 | A1 (opsi 2) — pindahkan 62 titik ke router | besar | Perlu cara menguji pengiriman sungguhan lebih dulu |
