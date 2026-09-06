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

**Pilihan perbaikan, dari yang paling murah:**
1. Beri label jujur di UI — tandai event yang belum tersambung sebagai
   "belum aktif", dan sebut saklar induk sebagai satu-satunya yang berlaku.
   *(kecil, tanpa risiko)*
2. Pindahkan titik-titiknya ke `kirimNotifikasi()` bertahap per modul,
   dimulai dari Ticketing. *(besar, perlu pengujian pengiriman sungguhan)*

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
| `/tech-note` | ❌ | **3** |
| `/project-progress` | ❌ | 1 |
| `/incentive-pts` | ❌ | 1 |
| `/learning-center` | ❌ | 1 |
| `/kpi-team` | ❌ | 1 |

Untuk 5 tujuan terakhir, notifikasi "X menunggu review kamu" mendarat di daftar
— penerimanya harus mencari sendiri record yang dimaksud. Tech Note paling
terasa karena punya 3 titik notifikasi, semuanya soal review.

Perbaikannya kecil dan seragam: tiap halaman membaca `?open=` lalu membuka
detailnya, meniru yang sudah ada di `/ticketing`.

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

Piket Showroom yang paling padat: tiga berkas menyalin daftar tim yang sama.
Kalau perusahaan lain memasang platform ini, modul itu akan tampil kosong
tanpa pesan apa pun.

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
