# Project Summary (Project 360) — audit kondisi sekarang, baseline, backlog & Phase 1

Tanggal: 31 Okt 2026 · Cabang kerja: `claude/sinkron-main` (= `main` 8d531688) · Belum di-commit (menunggu persetujuan pemilik).

## A. Baseline (sebelum perubahan)
| Pemeriksaan | Hasil |
|---|---|
| `npm test` (111 berkas uji) | 111/111 lulus |
| `tsc --noEmit` | 0 galat di kode sumber; 2 galat hanya di cache lokal `.next/dev/types` (merujuk halaman pratinjau sementara yang sudah dihapus) — bukan isi repo |
| `npm run lint` | 0 error, 1.398 warning (7 di berkas Summary Project) |
| Stack | Next 16.4 (App Router, Turbopack), React 19.3, TypeScript 5.7, Tailwind 3.4.17, Supabase JS 2.117 |

## B. Implementasi aktual (Verified dari kode / DB)
- Halaman `app/(portal)/summary-project/page.tsx`; detail `ModalDetailProject.tsx`; admin `ModalMappingCenter.tsx`, `PanelDuplikat.tsx`; data `lib/summary-project.ts`.
- Sumber: master `projects` (292 baris), pemetaan `project_source_links` (464: reminders 304, tickets 105, project_requests 55), view `v_project_summary` (security_invoker). Form Review ikut reminder-nya.
- Lingkup akses `lib/project-scope.ts` + RLS.

### Temuan UX / fungsi (sebelum Phase 1)
| # | Temuan | Status |
|---|---|---|
| U1 | Galat daftar menampilkan pesan teknis mentah, tanpa Coba Lagi | Verified → diperbaiki |
| U2 | Galat kueri detail tampil sebagai "Belum ada aktivitas" (galat ditelan) | Verified → diperbaiki |
| U3 | Kosong karena filter vs memang kosong tidak dibedakan, tanpa reset filter | Verified → diperbaiki |
| U4 | Kartu statistik mengabaikan pencarian (beda dengan tabel) | Verified → diperbaiki |
| U5 | Status linimasa kode mentah (`done`, `in_progress`), beda dengan label menu asal | Verified → diperbaiki |
| U6 | Form Review tanpa tanggal ("-"); Design diposisikan memakai deadline, daftar memakai tanggal dibuat | Verified → diperbaiki |
| U7 | "Terakhir" bisa tanggal jadwal di masa depan tanpa penanda (4 project) | Verified → ditandai "akan datang" (definisi view tidak diubah) |
| U8 | Tidak ada cara melihat yang belum selesai / terlambat | Verified → penyaring Belum selesai / Terlambat |
| U9 | Kembali dari menu asal kehilangan project yang sedang dibuka | Verified → konteks `?project=` |
| U10 | Halaman terbuka lewat alamat langsung walau menu tidak diberikan | Verified → layar izin |
| U11 | Jumlah di daftar ≠ isi detail tanpa penjelasan (record di luar lingkup / terhapus) | Verified → keterangan |
| D1 | Semua 292 project berstatus "Aktif"; tab Selesai/Diarsipkan selalu kosong | Verified → backlog P3/P4 (closure) |
| D2 | Deep link Ticketing hanya menemukan ticket ≤ 12 bulan (jendela muat) — saat ini 0 ticket terpeta terdampak | Verified → backlog P2 |

## C. Peta lintas modul (ringkas)
| Menu | Tabel sumber | Relasi ke project | Catatan |
|---|---|---|---|
| Request Schedule | `reminders` (299) | `project_source_links` | otomatis (nama persis) + manual |
| Ticket | `tickets` (103), `activity_logs` | `project_source_links`; `tickets.reminder_id` | |
| Design Project | `project_requests` (53), `project_messages` (391), `project_attachments` (162) | `project_source_links`; pesan/lampiran via `request_id` | lampiran & pesan belum tampil di Summary |
| Form Review | `form_reviews` (128) | via `reminder_id` | |
| Project Progress | `progress_projects`, `progress_locations`, `progress_issues` | **tidak** terhubung ke `projects` (`source_reminder_id` saja) | gap identitas |
| Checklist / AV hasil | `checklist_proyek` (3), `checklist_daftar`, `tools_av_hasil` | tidak terhubung ke `projects` | gap identitas |
| Insentif | `incentive_projects`, `incentive_tranches` | via `reminder_id` | di luar Summary |
| Unit Movement | `movement_logs` (308) | hanya `project_name` (teks) | tidak boleh auto-link by nama |
| Daily Report | `daily_reports`, `daily_report_team_entries` | `project_name` (teks) | |

## D. Backlog prioritas
| ID | Item | Komp. | Risiko | Dependensi / uji |
|---|---|---|---|---|
| P1 | U1–U11 di atas | S–M | rendah | **selesai** (lihat bagian F) |
| P2-1 | Deep link ticket > 12 bulan: muat ticket tunggal bila `?open` tak ada di daftar | S | sedang (Ticketing) | uji deep link |
| P2-2 | Hubungkan Project Progress & Checklist ke `projects` (kolom relasi additive, review manual) | M | sedang | migrasi + rollback |
| P2-3 | Dokumentasi alur & lineage per menu | M | rendah | — |
| P3-1 | Jumlah terbuka/terlambat per project di daftar (view baru / kolom view) | M | sedang | rencana index |
| P3-2 | Tab Dokumen (lampiran Design) & Pesan | M | sedang (akses berkas) | izin storage |
| P3-3 | Definisi "aktivitas terakhir" yang memisahkan jadwal mendatang | S | rendah | perubahan view |
| P4-1 | Ringkasan AI on-demand (pakai Gemini yang sudah ada) | L | sedang | izin & biaya |
| P4-2 | Closure / handover + status Selesai (D1) | L | sedang | audit trail |
| P5 | Security hardening lanjutan (lihat docs/HARDENING-AUDIT*.md; sebagian sudah dikerjakan 30 Okt: #145, #146) | — | — | — |

## E. Migrasi & rollback
Phase 1: **tidak ada perubahan skema / data**. Rollback = revert berkas yang berubah.

## F. Phase 1 — yang diubah
- `lib/summary-project.ts`: kueri detail melempar galat (bukan diam kosong); `created_at` Design & Form Review ikut dimuat; `tidakTampil`.
- `_components/linimasa.ts` (baru, murni): label status menu asal, terbuka/terlambat, label tanggal, penyaring.
- `ModalDetailProject.tsx`: ErrorState + Coba Lagi, penyaring Semua/Belum selesai/Terlambat, label status & tanggal, penanda "akan datang"/"Terlambat", keterangan record tak tampil, waktu dimuat, tautan "Buka di …".
- `page.tsx`: layar izin (aturan = sidebar), ErrorState + Coba Lagi, ListEmptyState + Reset filter, chip filter aktif, kartu mengikuti pencarian, penjelasan angka & waktu dimuat, penanda tanggal mendatang, konteks `?project=`.
- Uji baru `uji/summary-project-linimasa.ts` (24 cek). Learning Center tidak disentuh.
- Diuji di peramban dengan mock Supabase (data contoh): filter/cari/reset, detail & penyaring, `?project=` (buka, tutup, tautan tidak sah), galat + Coba Lagi, izin (tamu tanpa/dengan menu), lebar HP 375 px tanpa gulir samping.
