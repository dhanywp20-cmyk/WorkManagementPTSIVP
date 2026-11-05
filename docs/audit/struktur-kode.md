# Audit struktur kode — berkas dewa, God line & ketergantungan antar modul

Tanggal: 3 November 2026 · Cakupan: `app/`, `lib/`, `components/` — **888 berkas TS/TSX, 133.670 baris**.
Alat ukur: `node scripts/ukur-struktur.mjs` · Penjaga: `uji/struktur-kode.mjs` (ikut `npm test` & CI).

## 1. Ringkasan angka

| Ukuran | Nilai |
|---|---|
| Berkas ≥ 1.000 baris | **0** |
| Berkas 600–999 baris | 25 |
| Berkas 300–599 baris | 72 |
| Baris > 300 karakter (God line) | 396 di 146 berkas |
| Baris > 1.000 karakter | 19 (sebelum Fase 1) |
| Props terbanyak di **satu** baris | **72** (`form-require-project/page.tsx`) |
| `useState` terbanyak di satu berkas | 77 (`form-require-project/page.tsx`) |
| Tipe `User` yang didefinisikan ulang | 11 |
| `lib/` → mengimpor kode modul `app/` | 4 impor (arah terbalik) |

Kesimpulan: masalahnya **bukan lagi berkas raksasa** — pemecahan sebelumnya (PR #76 "Pecah menu", #83 "Pecah 5
berkas besar yang tersisa") sudah menurunkan semua berkas di bawah 1.000 baris. Tetapi pemecahan itu **mekanis**:
kode dipindah ke berkas lain tanpa memindah *kepemilikan state*-nya, sehingga page meneruskan puluhan nilai satu per
satu. Jumlah baris turun, keterikatannya tetap — dan muncul sebagai "God line".

## 2. Temuan

### S1 — Props drilling (God line paling banyak & paling berbahaya)
Page memegang semua state, lalu meneruskannya ke komponen `Isi*` / popup lewat satu baris raksasa.

| Berkas : baris | Props di satu baris | Penerima |
|---|---|---|
| `form-require-project/page.tsx:569` | 72 | `ModalDetailRequest` |
| `reminder-schedule/page.tsx:859` | 71 | `IsiJadwal` |
| `reminder-schedule/page.tsx:840` | 64 | `PopupDetailJadwal` |
| `incentive-pts/page.tsx:430` | 63 | `IsiInsentif` |
| `ticketing/page.tsx:683` | 62 | `IsiTicketing` |
| `form-require-project/page.tsx:520` | 50 | konten halaman |
| `daily-report/page.tsx:267` | 39 | `IsiLaporan` |

Akibat: menambah satu fitur kecil = menyentuh page + 2–3 berkas perantara; salah urut / lupa satu props tidak
ketahuan sampai di layar (contoh nyata: flag `bolehLewatiReview` minggu lalu harus diturunkan sendiri di dua komponen).

### S2 — "Kantong state": page & hook yang memegang terlalu banyak
- Page dengan 60–77 `useState`: `form-require-project` (77), `ticketing` (75), `reminder-schedule` (61), `incentive-pts` (46).
- Hook yang mengembalikan objek datar raksasa: `tools-team/desain3d/useKeadaanDesain.ts` (≈180 nilai dalam satu
  `return {…}`), `tools-team/led/useKeadaanLED.ts` (≈120), `reminder-schedule/useAlurPersetujuan.ts` (47).
- Hook "kirim semua setter": mis. `useBukaTicket({ 20 setter })` di `ticketing/page.tsx` — hook tidak punya state
  sendiri, ia meminjam setter page.

### S3 — JSX dipadatkan ke satu baris
`ticketing/_components/ActivitySummaryModal.tsx` (baris 2.568 karakter) & `AccountSettingsModal.tsx` (2×~2.300) —
seluruh kartu/form dalam satu baris, tidak bisa dibaca maupun di-review. **Diperbaiki di Fase 1** (diformat ulang,
perilaku sama persis).

### S4 — Berkas besar yang tersisa (600–964 baris)
Terbesar: `_kerangka/KerangkaPortal.tsx` (964), `ticketing/page.tsx` (928), `reminder-schedule/page.tsx` (895),
`incentive-pts/_components/SchemeTab.tsx` (845), `reminder-schedule/_components/ReminderDetailPopup.tsx` (836),
`learning-center/_components/MyQuizPage.tsx` (818), `picket-showroom/page.tsx` (817), `lib/integrasi-tulis.ts` (806).
Ini *gejala* S1/S2: page besar karena memegang state semua anak-anaknya.

### S5 — Arah ketergantungan antar modul
- **Modul memakai berkas privat modul lain**: 12 berkas `daily-report` mengimpor `reminder-schedule/_components/shared`
  (`TeamUser`, `CATEGORY_CONFIG`, `formatDate`…); 10+ berkas (`_kerangka`, `kpi-team`, `tech-note`, `project-progress`,
  `summary-project`) mengimpor tipe `User` dari `dashboard/_components/shared`. Mengubah "shared" satu modul diam-diam
  memecah modul lain.
- **`lib/` mengimpor `app/`** (terbalik — lib seharusnya lapisan paling bawah):
  `lib/integrasi-aksi.ts` → `ticketing/_components/alur-status`, `lib/integrasi-tulis.ts` → `tech-note/_components/aturan-tech-note`,
  `lib/objek-saya.ts` & `lib/tools-team.ts` → `tools-team/_components/desain3d/inti/rak`.
- **Tipe pengguna ganda**: 11 definisi `User`/`TeamUser`/`KPIUser` — penyebab langsung bug sesi Full Access
  (PR #153): tiap modul punya bentuk `User` sendiri, jadi kolom `access_level` bisa hilang di satu jalur tanpa ketahuan.

### S6 — `lib/` datar
145 entri, hanya 2 subfolder. Pengelompokan sudah tersirat lewat awalan nama (`incentive-*` 11, `av-*` 10,
`integrasi-*` 5, `checklist-*` 5, `wa*` 4 …) tapi belum menjadi folder.

## 3. Aturan struktur (target)

1. **Page tipis.** `page.tsx` hanya merakit: muat konteks modul + tata letak. Sasaran ≤ 250 baris.
2. **Satu konteks per modul** (`_components/konteks-<modul>.tsx`): state & aksi modul dikelompokkan per irisan —
   `data`, `filter`, `izin`, `aksi`, `modal`. Komponen mengambil irisan yang ia perlukan (`useKonteksJadwal().izin`),
   bukan menerima puluhan props. Komponen menerima **≤ 12 props**; selebihnya dari konteks.
3. **Hook mengembalikan objek terkelompok** (`{ data, filter, aksi }`), bukan puluhan nilai datar; hook memegang
   state-nya sendiri, tidak meminjam setter page.
4. **Arah ketergantungan satu jalan**: `app/<modul>` → `components/shared` → `lib/`. `lib/` tidak mengimpor `app/`.
   Modul tidak mengimpor `_components` modul lain — yang dipakai bersama naik ke `lib/<domain>/` atau `components/shared/`.
5. **Satu tipe pengguna** bersama (`lib/tipe-pengguna.ts`), modul memperluasnya bila perlu (`Pengguna & {…}`).
6. **Tanpa komentar penjelasan di kode** (`app/`, `lib/`, `components/`): kode harus terbaca dari nama & strukturnya.
   Hanya direktif alat yang boleh (`eslint-disable…`, `@ts-expect-error`, `/// <reference>`). Dijaga `uji/struktur-kode.mjs`.
7. **Ambang yang dijaga otomatis** (`uji/struktur-kode.mjs`, sistem *ratchet*):
   berkas ≤ 600 baris · baris ≤ 300 karakter · < 25 props di satu baris. Pelanggar lama tercatat di
   `uji/data/struktur-baseline.json` dan **tidak boleh memburuk**; berkas baru tidak boleh melewati ambang.
   Setelah sebuah berkas dirapikan, kunci perbaikannya: `node scripts/ukur-struktur.mjs --baseline`.

## 4. Rencana bertahap (satu PR per langkah, Preview dulu)

| Fase | Isi | Risiko | Status |
|---|---|---|---|
| 1 | Penjaga ratchet + alat ukur; format ulang JSX dipadatkan (S3) | rendah (tanpa perubahan perilaku) | **selesai** |
| 1b | Hapus komentar penjelasan: ±24.500 baris di 1.005 berkas (kode, konfigurasi, CSS, skrip, uji); direktif alat dipertahankan | rendah (tanpa perubahan perilaku) | **selesai** |
| 2 | Konteks per modul untuk props drilling terburuk (S1/S2), satu modul per PR: Request Schedule → Request Design Project → Ticketing → Incentive → Daily Report | sedang — diuji per modul di Preview | **Request Schedule**, **Request Design Project**, **Ticketing**, **Incentive** & **Daily Report selesai** (§5) |
| 3 | Arah ketergantungan (S5): tipe pengguna bersama; `CATEGORY_CONFIG`/`formatDate` & tipe `TeamUser` naik ke `lib/`; 4 impor `lib → app` dipindah ke `lib/` | rendah–sedang | — |
| 4 | Kantong state Tools Team (`useKeadaanDesain`, `useKeadaanLED`) dipecah per domain (kanvas, proyektor, ekspor, …) | sedang (Desain 3D sensitif) | — |
| 5 | Berkas 600–964 baris yang tersisa dipecah per tanggung jawab saat modulnya disentuh | rendah | berjalan |
| 6 | `lib/` dikelompokkan ke subfolder per domain (`lib/incentive/`, `lib/av/`, `lib/wa/`, …) dengan ekspor ulang supaya impor lama tetap jalan | rendah | — |

Urutan Fase 2 dipilih dari ukuran props drilling (§S1) dan seberapa sering modulnya diubah.

## 5. Catatan Fase 2 — Request Schedule (pola acuan untuk modul lain)

- `reminder-schedule/_components/konteks-jadwal.tsx`: `NilaiKonteksJadwal` dengan irisan `sesi`, `izin`, `data`,
  `ringkasan`, `filter`, `tampilan`, `pilih`, `aksi`, `detail`. Tipenya diambil dari interface hasil pemecahan lama
  (tipe persis dari page), bukan diketik ulang.
- Page mengisi konteks **sekali** (`konteksJadwal`, ±20 baris berkelompok) dan membungkus isinya dengan
  `<KonteksJadwal.Provider>`. Keadaan tetap milik page — konteks hanya jalur, bukan penyimpanan baru.
- Komponen mengambil irisan yang ia perlukan: `const k = useKonteksJadwal(); const { … } = k.filter;`.
- `PopupDetailJadwal` (perantara murni 64 props) dihapus; `<IsiJadwal />` dan
  `<ReminderDetailPopup detailReminder={…} />` tanpa drilling. `StatsSection`/`FilterBar` tetap berprops karena juga
  dipakai Ticketing.
- 61 impor tak terpakai di page (sisa pemecahan mekanis) dibuang — semuanya tanpa efek samping saat dimuat.

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Props terbanyak di satu baris (page) | 71 | 8 |
| God line di page | 10 | 8 |
| `page.tsx` | 895 baris | 889 |
| `ReminderDetailPopup.tsx` / `ReminderListBody.tsx` | 836 / 560 | 749 / 501 |
| `IsiJadwal.tsx` | 214 | 128 (keluar dari baseline) |

Verifikasi: skrip peramban yang sama dijalankan terhadap build `main` dan build refaktor (Admin, Full Access, Manager
PTS UMP: daftar, pencarian, popup detail, tombol Setujui/Tolak/Riwayat) — hasilnya identik.

### Request Design Project

- `form-require-project/_components/konteks-request.tsx`: irisan `sesi`, `izin`, `bantu`, `daftar`, `ringkasan`,
  `filter`, `pilih`, `detail`, `lampiran`, `pesan`, `aksi`.
- `KontenHalamanRequest`, `DaftarRequest`, `ModalDetailRequest`, `HeaderDetail`, `PanelLampiranDetail` mengambil dari
  konteks. `selectedRequest`/`detailSc` tetap dioper ke `HeaderDetail` & `PanelLampiranDetail` karena di sana sudah
  dipersempit (tidak null).

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Props terbanyak di satu baris (page) | 72 | 26 (`BlokFormBaru`, berikutnya) |
| `ModalDetailRequest` | 326 baris · 32 props | 254 · 15 |
| `KontenHalamanRequest` | 193 · 31 | 148 · 14 |

Verifikasi: skrip peramban identik pada build `main` & refaktor (Admin, Full Access, Sales): daftar, pencarian, popup
detail dengan Setujui/Tolak/Edit/Hapus/Download/Chat — hasil sama persis, 0 galat halaman.

### Ticketing

- `ticketing/_components/konteks-ticket.tsx`: irisan `sesi`, `izin`, `data`, `ringkasan`, `filter`, `halaman`, `pilih`,
  `aksi`.
- `IsiTicketing`, `StatsSection`, `FilterBar`, `TicketListBody` mengambil dari konteks; tipe props sebaris dihapus.
- Impor yang tidak terpakai di `page.tsx` (sisa ekstraksi sebelumnya) ikut dibersihkan.

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Props terbanyak di satu baris (page) | 62 | 19 |
| `page.tsx` | 760 baris | 750 |
| `IsiTicketing` | 183 | 25 |
| `TicketListBody` | 372 | 334 |
| `FilterBar` | 229 | 193 |
| `StatsSection` | 114 | 90 |

Verifikasi: skrip peramban identik pada build `main` & refaktor (Admin, Full Access, Sales): daftar, kartu & donat
statistik, saring lewat kartu In Progress, pencarian, tombol daftar, popup detail — hasil sama persis, 0 galat halaman.

### Incentive PTS

- `incentive-pts/_components/konteks-insentif.tsx`: irisan `sesi`, `izin`, `saya`, `proyek`, `tahapan`, `akses`, `ekspor`,
  `aksi`.
- `IsiInsentif`, `FilterProyekInsentif`, `DaftarProyekInsentifHP`, `TabelProyekInsentif`, `TabJadwalTranche`,
  `TabPengaturanAkses` mengambil dari konteks; lima interface props anak dihapus.

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Props terbanyak di satu baris (page) | 63 | 11 |
| `page.tsx` | 296 baris | 283 |
| `IsiInsentif` | 195 | 123 |

Verifikasi: skrip peramban identik pada build `main` & refaktor (Admin, Full Access, akses lihat): daftar proyek,
Insentif Saya, pencarian, tab Tranche / Late Ticket / Skema / Pengaturan Akses — hasil sama persis, 0 galat halaman.

### Daily Report

- `daily-report/_components/konteks-laporan.tsx`: irisan `sesi`, `izin`, `data`, `ringkasan`, `filter`, `aksi`.
- `IsiLaporan`, `FilterLaporanHarian`, `DaftarLaporanHarian` mengambil dari konteks; dua interface props anak dihapus.
- Sisa terbesar di page kini `FormLaporan` (29 props) — kandidat berikutnya.

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Props `IsiLaporan` (page) | 39 | 0 |
| `page.tsx` | 225 baris | 215 |
| `IsiLaporan` | 193 | 154 |

Verifikasi: skrip peramban identik pada build `main` & refaktor (Admin, Full Access, Team): daftar laporan, panel
ringkasan & grafik, pencarian — hasil sama persis, 0 galat halaman.

### Sisa props drilling (satu anak)

Empat komponen yang menerima puluhan props dari satu induk kini membaca konteks kecil masing-masing (irisan `nilai`,
`ubah`, `aksi`):

| Komponen | Props sebelum | Konteks |
|---|---|---|
| `IsiBankSoal` (Learning Center) | 30 | `konteks-bank-soal.tsx` |
| `FormLaporan` (Daily Report) | 29 | `konteks-form-laporan.tsx` |
| `DaftarReview` (Form Review) | 28 | `konteks-daftar-review.tsx` |
| `BlokFormBaru` (Request Design Project) | 26 | `halaman/konteks-form-baru.tsx` |

`FormReviewPageInner` juga dibersihkan dari kode mati (`handleBulkDelete`, `handleLogout`, variabel tak terpakai);
hapus massal lewat modal kini ikut tercatat di audit trail.

Verifikasi: skrip peramban identik pada build `main` & refaktor (Admin, Full Access) untuk Daily Report (termasuk form
Tambah Report), Form Review, Learning Center (Bank Soal) dan Request Design Project (form Buat Request), 0 galat.

## 6. Fase 3 — batas `lib` / `app`

- `lib/` dan `components/` tidak lagi mengimpor dari `app/` (sebelumnya 4 impor). Modul aturan murni dipindah:
  `ticketing/_components/alur-status.ts` → `lib/alur-status-ticket.ts`, `tech-note/_components/aturan-tech-note.ts` →
  `lib/aturan-tech-note.ts`, katalog perangkat rak → `lib/perangkat-rak.ts` (`inti/rak.ts` mengekspor ulang).
- `lib/tipe-pengguna.ts` (`PenggunaDasar`): kolom bersama tipe `User` di Dashboard, Ticketing, Request Design Project dan
  Analytics; tiap modul hanya menambah kolom khususnya.
- Dijaga `uji/batas-lib-app.mjs`: gagal bila ada berkas `lib/` atau `components/` yang mengimpor dari `app/`.

## 7. Fase 5 — berkas 600+ baris

- `lib/integrasi-tulis.ts` (738 baris) dipecah per domain: `integrasi-tulis-bersama.ts` (pembantu: orang, WA, audit,
  CC), `-tiket.ts`, `-desain.ts`, `-catatan.ts`, `-unit.ts` (unit & piket). `integrasi-tulis.ts` kini hanya peta
  `AKSI_MENU_TULIS` (21 baris). Tiap modul hanya mengekspor aksinya; pembantu internal tetap privat.
- Komponen yang menumpang di satu berkas dipindah ke berkasnya sendiri (isi tidak diubah):
  `UserManagementInline` → `dashboard/_components/pengguna/KelolaPenggunaInline.tsx` (`modal-user.tsx` 737 → 366 baris),
  `UserAnswerReview` → `learning-center/_components/UlasanJawaban.tsx` (`TeamPage.tsx` 641 → 119),
  `MaterialCard` + `FolderTreeView` → `learning-center/_components/KartuMateri.tsx` (`MateriPage.tsx` 748 → 609).
- `SchemeTab.tsx` (716 → 345 baris): seksi 3 (PTS Daerah & Remote) dan 4 (Aturan Khusus & Pencairan) jadi komponen
  `SeksiDaerahRemote` / `SeksiAturanPencairan` di `seksi-skema.tsx`, bersama pembantu `Seksi`, `TotalPersen`, `rp`.
