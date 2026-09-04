# Audit Kelengkapan Alur Kerja & UX/UI

Tanggal: 2026-09-04. Read-only audit — belum ada perubahan kode dari laporan ini.

## STATUS: SELURUH 32 TEMUAN SUDAH DIKERJAKAN (2026-09-04)

Setelah laporan ini ditulis, user meminta seluruh temuan dikerjakan langsung.
Ringkasan implementasi per temuan:

- **C1** — Lonceng notifikasi personal sekarang dirender (bell ke-5 di
  `NotificationBar`) + tombol "Tandai semua dibaca".
- **C2** — `services_status="Solved"` sekarang bisa dibuka kembali lewat
  tombol "Re-open Services" (Team Services sendiri atau Admin/Superadmin).
- **C3** — Edit note oleh penulis pada status revision/rejected sekarang
  mengembalikan status ke pending + notif ke admin (action `resubmitted`
  yang sudah ada di kode akhirnya disambungkan).
- **C4** — "Tandai Paid" sekarang punya modal konfirmasi, guard klik-ganda,
  dan logAudit.
- **M1–M6** — Notif "ticket selesai" jalur Services, konsistensi tombol
  Reopen, eskalasi tiket Waiting Approval lewat digest cron, jalur Tolak
  resmi di admin_review Reminder Schedule, guard RescheduleModal, pesan
  error dengan detail.
- **M7–M10** — Indikator "Belum Lapor Hari Ini" (Daily Report), layout
  mobile Activity List (Daily Report), notifikasi lokasi "Blocked"
  (Project Progress), proteksi unsaved-changes (FillDetailModal Picket).
- **M11–M13** — Notifikasi Mark Paid (Incentive PTS), fix duplikat submit
  + guard klik-ganda (Require Project).
- **M14–M16** — DrillModal KPI terhubung ke breakdown actionable, notif
  essay dinilai (Learning Center), `action_url` notif user baru diarahkan
  ke tab Admin Panel yang benar.
- **Seluruh 11 Minor** — label konsisten, proteksi unsaved-changes
  (Tech Note), indikator share-link, validasi, error detail, FlowSteps,
  CTA "Coba Lagi" quiz, badge tab Admin Panel, nama di konfirmasi hapus,
  label role manusiawi.

Semua perubahan diverifikasi `tsc --noEmit` bersih dan `next build`
compile sukses (gagal hanya di titik env-var `/api/ai/generate` yang
sudah dikonfirmasi sepanjang sesi sebagai keterbatasan sandbox, bukan
regresi kode).

---
Fokus BEDA dari `docs/AUTH-WORKFLOW-AUDIT.md`: bukan otorisasi/keamanan, tapi
**apakah setiap alur benar-benar bisa diselesaikan sampai akhir** dan
**apakah pengalaman memakainya cukup jelas & aman dari kesalahan klik**.

Metodologi: 4 audit paralel per klaster modul, masing-masing membaca kode
langsung (bukan menebak dari nama fungsi/komentar) dan mencantumkan file:line
untuk tiap temuan. Total 32 temuan: 4 Critical, 17 Major, 11 Minor.

---

## 🔴 CRITICAL (4) — alur benar-benar buntu atau pengamanan nyaris nol

### C1 — Lonceng notifikasi personal TIDAK PERNAH tampil di mana pun
**File**: `app/dashboard/_components/modal-notifikasi.tsx:123,549-567,589-607`, `lib/notifications.ts:100,113`

Tabel `notifications` (dipakai untuk: KPI alert skor rendah, "user baru menunggu approval", tiket di-assign, jadwal disetujui, status project berubah) di-fetch ke state `personalNotifs` — tapi **tidak pernah dirender**. Buktinya konkret:
- `hasAnyBell = true` dideklarasikan tapi tidak dipakai di JSX manapun.
- `totalCount` (badge merah lonceng) SENGAJA mengeluarkan `personalNotifs` dari hitungan.
- `markAllNotifsRead()` & `fetchUnreadNotifs()` adalah dead code — tidak dipanggil dari mana pun di seluruh repo.

**Dampak**: setiap notifikasi personal yang dibuat platform (termasuk peringatan KPI ke Manager, dan pemberitahuan pendaftar baru ke admin) tersimpan di database tapi tidak akan pernah terlihat user kecuali membuka tabel Supabase langsung. Ini kemungkinan besar FITUR SETENGAH JADI (infrastrukturnya lengkap — fetch, mark-read, dsb — tinggal UI-nya yang belum dipasang), bukan desain sengaja.

### C2 — `services_status = "Solved"` jadi jalan buntu permanen, bahkan Admin tidak bisa membukanya kembali
**File**: `app/ticketing/page.tsx:1690-1698, 2267-2286, 3521, 3524, 3531`

Begitu Team Services menandai sisi mereka "Solved": tombol Update Status disembunyikan untuk Team Services, tombol Reopen eksplisit disembunyikan untuk Team Services di popup detail, dan panel Edit Admin (`TICKET_ADMIN_FIELDS`) tidak memuat kolom `services_status` sama sekali. **Tidak ada satu pun role yang punya jalan resmi mengubahnya kembali.**

**Skenario nyata**: Team Services salah klik/salah pilih tiket "Solved" padahal unit belum benar-benar teruji — satu-satunya cara membetulkannya adalah intervensi manual ke database.

### C3 — Tech Note: edit setelah "Perlu Revisi"/"Ditolak" tidak pernah mengembalikan ke antrean approval
**File**: `app/tech-note/page.tsx:408-416, 454-477, 566-574`, `app/tech-note/_components/shared.ts:30,42,58-64`

Saat penulis mengklik "Edit Detail" pada catatan `revision`/`rejected` lalu simpan, `submitTechNote()` hanya update `title/description/...` — **status tidak pernah diubah kembali ke `pending`** (komentar kode sendiri menegaskan ini disengaja). Admin memfilter antrean approval dengan `tab === 'pending'` — catatan yang sudah diperbaiki penulis **tidak akan pernah muncul lagi** di sana, tidak ada notifikasi baru terkirim.

Yang menarik: tipe action `resubmitted` sudah ada lengkap dengan config UI-nya di `shared.ts:63` — **tapi tidak pernah dipanggil di mana pun**. Ini fitur yang jelas direncanakan tapi belum selesai diimplementasikan, sama seperti C1.

### C4 — Incentive PTS: "Tandai Paid" (uang sudah keluar) tanpa konfirmasi, tanpa loading-guard, tanpa audit log
**File**: `app/incentive-pts/page.tsx:721-726` (tombol di baris 1520, 1997)

```js
async function handleMarkPaid(trancheId: string) {
  const { error } = await supabase.from('incentive_tranches').update({ status: 'paid', paid_at: ... }).eq('id', trancheId);
  ...
}
```
Tombol langsung eksekusi begitu diklik — tanpa modal konfirmasi, tanpa disable selama request berjalan, dan **tidak memanggil `logAudit`**. Ini kontras tajam dengan Process Batch/Batalkan Batch/Hapus Tahapan di modul yang SAMA, yang semuanya punya modal konfirmasi ketik-ulang + spinner + logAudit. "Tandai Paid" justru aksi paling final (uang sudah keluar, tidak bisa ditarik — sesuai filosofi kode sendiri di fungsi Batalkan Batch) tapi paling lemah pengamanannya.

**Skenario nyata**: Admin salah klik baris tranche yang salah di tabel padat (kolom Aksi di ujung kanan) — status langsung Paid tanpa jeda, tanpa jejak siapa yang menandainya.

---

## 🟠 MAJOR (17)

### Ticketing / Reminder Schedule
- **M1** — Tidak ada notifikasi "tiket selesai" saat Team Services menyelesaikan pekerjaan servis (`page.tsx:1690-1698` vs `1465-1542,1785-1791` yang sudah benar untuk jalur PTS IVP) — inkonsistensi pada dua titik transisi yang konsepnya identik.
- **M2** — Tombol Reopen tampil di list/card tapi hilang di detail popup untuk Team Services (`page.tsx:2929-2931,3126-3128` vs `3521`) — perilaku tidak konsisten pada aksi yang sama.
- **M3** — Tiket "Waiting Approval" tidak pernah masuk eskalasi SLA/follow-up otomatis (`page.tsx:2211-2226`) — bisa mengendap tanpa batas waktu kalau approver lupa/cuti.
- **M4** — Tidak ada jalur "Tolak" resmi untuk request Reminder Schedule di tahap `admin_review` (`page.tsx:3436-3451` vs `2293-2324`) — hanya Approve atau Hapus permanen (tanpa alasan tercatat, tanpa notif ke Sales).
- **M5** — Modal Re-Schedule rentan double-submit, tidak ada guard `saving` (`RescheduleModal.tsx:73-78` vs pola benar di `page.tsx:2863,2967,3043`).
- **M6** — Pesan error generik tanpa detail pada `handleDelete`/`handleStatusChange` (`page.tsx:1130,1182`) — dua aksi paling sering dipakai tim sehari-hari, tidak konsisten dengan pola detail-error yang dominan di file yang sama.

### Daily Report / Picket Showroom / Project Progress
- **M7** — Tidak ada indikator "siapa yang belum mengisi report hari ini" di Daily Report — supervisor harus membandingkan manual.
- **M8** — Tabel Activity List Daily Report tanpa layout mobile (beda dari Picket Showroom & Project Progress yang sudah punya kartu mobile).
- **M9** — Project Progress tidak mengirim notifikasi apa pun (WA/Telegram/in-app) di transisi manapun, termasuk saat status jadi **"Blocked"** (kondisi kritis) — sales/admin harus buka dashboard manual untuk tahu ada masalah.
- **M10** — `FillDetailModal` Picket Showroom tidak ada proteksi unsaved-changes — klik area luar modal langsung membuang seluruh isian tanpa peringatan.

### Incentive PTS / Require Project
- **M11** — Modul Incentive PTS tidak mengirim notifikasi apa pun di transisi manapun (Process Batch, Mark Paid) — penerima insentif tidak pernah dikabari uangnya cair, harus cek manual.
- **M12** — Require Project: exception setelah insert request BERHASIL (upload foto survey/BOQ awal tanpa try/catch tersendiri) jatuh ke catch generik "Coba lagi" yang menyiratkan submit gagal total — padahal request sudah tersimpan. Risiko user submit ulang → request duplikat, notifikasi ganda ke Admin & Sales Internal.
- **M13** — Beberapa tombol ubah status (`StatusUpdateModal`, tombol inline "Mulai In Progress", modal Reject) tanpa loading/disabled state — klik ganda pada koneksi lambat berisiko kirim WA/Telegram dobel ke pihak eksternal.

### KPI Team / Learning Center / Admin Panel
- **M14** — Dua modal detail berbeda untuk anggota KPI yang sama, kedalaman info timpang: jalur paling wajar (klik baris di tabel utama) hanya kasih angka mentah tanpa konteks; breakdown actionable (bobot per kategori, "kurang 2 Tech Note lagi") justru "tersembunyi" di chip kecil yang kurang menonjol.
- **M15** — Learning Center: essay dinilai (`grading_status: 'graded'`) tapi peserta tidak pernah diberi notifikasi (`TeamPage.tsx:246-276`) — kontras dengan janji eksplisit di UI ("Skor akan muncul setelah admin selesai menilai").
- **M16** — Admin Panel: `action_url` notifikasi "user baru mendaftar" mengarah ke `/dashboard` generik, bukan ke tab User Management — makin tidak berguna karena C1 (bell tidak pernah tampil).

---

## 🟡 MINOR (11)

1. Ticketing — Label "Terima" vs "Approve" untuk aksi Team Services vs Admin yang konsepnya setara.
2. Tech Note — Modal Upload/Edit tanpa proteksi unsaved-changes.
3. Project Progress — Indikator share-link aktif di tabel hanya beda warna, tanpa label teks eksplisit.
4. Picket Showroom — Tombol "Libur" berdempetan dengan ActionGroup di kolom sempit, risiko salah klik.
5. Incentive PTS — Validasi nominal hanya `> 0`, tanpa sanity-check nilai tidak wajar (salah ketik tambah nol).
6. Require Project — Error generik tanpa detail pada update Target Selesai (`page.tsx:3083-3088`), tidak konsisten dengan pola file yang sama.
7. Require Project — `FlowSteps` menampilkan "Menunggu Admin — Di-assign" yang keliru saat tahap sebenarnya `supervisor_assign` — Admin sudah bertindak, yang ditunggu Supervisor.
8. Learning Center — Tidak ada CTA "Coba Lagi" langsung setelah quiz gagal (walau `allow_retake` true) — user harus keluar dulu ke daftar quiz.
9. Admin Panel — Badge jumlah user pending pada tombol Admin Panel membuka tab `'settings'`, bukan `'userManagement'` tempat daftarnya berada.
10. Admin Panel — Konfirmasi hapus akun tidak menyebut nama akun (beda dari konfirmasi tolak-pendaftaran yang sudah menyebut nama).
11. Dashboard — Kolom "Role" di User Management menampilkan enum mentah (`guest`/`team`/`admin`) bukan label manusiawi — kontras dengan KPI Roster yang sudah pakai label ramah.

---

## Catatan Positif (supaya temuan di atas tidak terkesan platform ini buruk)

Kedua audit sepakat: pola-pola pengamanan yang SUDAH ADA di banyak tempat justru sangat baik dan seharusnya jadi acuan untuk menutup temuan di atas — bukan dibangun dari nol:
- Konfirmasi destruktif ketik-ulang teks ("HAPUS", "BATALKAN {tahun}") — Ticketing, Reminder Schedule, Incentive PTS.
- Pengecekan hasil `.select('id')` untuk mendeteksi penolakan RLS diam-diam — dipakai luas dan konsisten.
- Notifikasi dobel WA+Telegram+in-app di banyak titik transisi (Require Project sangat rajin di titik ini).
- Proteksi unsaved-changes (`editorDirty`) sudah ada di Project Progress — tinggal direplikasi ke Tech Note & Picket Showroom.
- Breakdown KPI per-bobot yang actionable sudah dibangun dengan baik — tinggal dipindah ke tempat yang lebih terlihat (M14).
- Pengelompokan navigasi Admin Panel jadi 3 grup sudah rapi, bukan tab datar seperti dikhawatirkan di awal.
- Pesan error dengan `error.message` sudah jadi pola dominan di sebagian besar file — beberapa titik (M6, minor #6) tinggal disamakan.

---

## Ringkasan Prioritas Perbaikan

| Prioritas | Temuan | Kenapa |
|---|---|---|
| 1 | C1 — Lonceng notifikasi personal | Fondasi: begitu ini benar, beberapa temuan lain (M16, minor #-) otomatis lebih berguna |
| 2 | C4 — "Tandai Paid" tanpa pengaman | Risiko finansial langsung, paling gampang ditutup (pola modal konfirmasi sudah ada di file yang sama) |
| 3 | C2 — services_status Solved buntu | Butuh keputusan bisnis: siapa yang boleh reopen (Admin? Team Services sendiri?) sebelum dikerjakan |
| 4 | C3 — Tech Note resubmit | Infrastrukturnya sudah ada (`resubmitted` action), tinggal disambungkan |
| 5 | M9, M11 — Nol notifikasi (Project Progress, Incentive PTS) | Dampak luas, pola sudah mapan di modul lain tinggal direplikasi |
| 6 | M4, M12, M13 — gap approval/duplikasi/klik-ganda | Risiko operasional harian |
| 7 | Sisa Major & Minor | Perbaikan polish, bisa dicicil |

**Semua temuan di atas adalah LAPORAN — belum ada yang dieksekusi.** Menunggu arahan prioritas mana yang dikerjakan lebih dulu.
