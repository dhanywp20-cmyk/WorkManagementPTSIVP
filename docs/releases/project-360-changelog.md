# Project 360 (Summary Project) — changelog

## Phase 2 — Deep link & lineage (1 Nov 2026)
**Tanpa perubahan skema / data.** Rollback = revert commit ini.
- Tautan ticket dari Summary Project / notifikasi (`/ticketing?open=<id>`) kini membuka ticket walau lebih lama dari
  jendela muat daftar (mis. > 12 bulan), dengan aturan akses yang sama; tautan yang tidak sah memberi pemberitahuan.
- Dokumentasi alur & lineage data per menu: [docs/alur/project-360-lineage.md](../alur/project-360-lineage.md).
- Belum: P2-2 (Project Progress & Checklist terhubung ke project) — butuh migrasi basis data, menunggu persetujuan.
- Uji baru `uji/summary-project-fase2.ts`.

## Phase 1 — Quick wins (31 Okt 2026)
Audit, baseline & backlog: [docs/audit/project-summary-current-state.md](../audit/project-summary-current-state.md).

**Tanpa perubahan skema / data.** Rollback = revert commit ini.

### Daftar project
- Galat muat: pesan yang bisa ditindaklanjuti + tombol Coba Lagi (detail teknis hanya di konsol).
- Kosong: dibedakan "memang belum ada" vs "tersaring habis" (Reset filter); chip filter aktif & tombol Reset filter.
- Kartu statistik mengikuti pencarian (sebelumnya hanya status) — sama dengan isi tabel.
- Penjelasan arti angka & waktu data dimuat; tanggal "Terakhir" di masa depan ditandai "akan datang".
- Konteks project di alamat (`?project=<id>`): Kembali dari menu asal membuka project yang sama; tautan tidak sah dibersihkan dengan pemberitahuan.
- Keadaan izin: akun tanpa menu Summary Project melihat layar "belum diaktifkan" (aturan sama dengan sidebar).

### Detail project
- Label status sama dengan menu asal (Request Schedule / Design); ticket apa adanya.
- Label arti tanggal (Jadwal / Dilaporkan / Diajukan / Diisi); Form Review & Design memakai tanggal yang benar.
- Penyaring Semua / Belum selesai / Terlambat, penanda "Terlambat".
- Kueri gagal tidak lagi tampil sebagai "belum ada aktivitas" (ErrorState + Coba Lagi).
- Keterangan bila sebagian record terhubung tidak tampil (di luar akses / terhapus).

### Uji
- Baru: `uji/summary-project-linimasa.ts` (24 cek). Seluruh suite 112/112 lulus; typecheck bersih; lint 0 error.
- Learning Center tidak berubah.
