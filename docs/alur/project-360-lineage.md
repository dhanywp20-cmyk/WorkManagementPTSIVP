# Project 360 (Summary Project): alur & lineage data per menu

Backlog **P2-3** dari [audit Summary Project](../audit/project-summary-current-state.md). Dokumen ini menjelaskan
**dari mana** setiap baris di Summary Project berasal dan **bagaimana** ia terhubung ke satu project.

## 1. Identitas project
- Master: tabel `projects` (satu baris = satu project).
- Penghubung: `project_source_links` (satu baris = satu record sumber → satu project).
  - Kolom kunci: `source_module`, `source_record_id` (unik berdua), `project_id`, `mapping_type`
    (`auto` | `manual` | `ignored`), `confidence`, `match_reason`, `mapped_by`.
  - `source_module` saat ini dibatasi CHECK ke: `reminders`, `tickets`, `project_requests`, `form_reviews`.
- Ringkasan daftar: view `v_project_summary` (security_invoker, jadi RLS pemanggil tetap berlaku).
- Lingkup akses per akun: `lib/project-scope.ts` + RLS tabel sumber.

## 2. Cara record terhubung ke project
| Cara | Kapan | Siapa | Ditimpa otomatis? |
|---|---|---|---|
| **auto** | trigger AFTER INSERT / UPDATE OF `project_name` di `reminders`, `tickets`, `project_requests` (migrasi 015), plus backfill sekali | basis data (pemilik fungsi) | ya, ikut nama record |
| **manual** | admin memetakan / memindahkan di Mapping Center | admin | **tidak pernah** |
| **ignored** | admin menandai record bukan bagian project mana pun | admin | **tidak pernah** |

Aturan `auto` (migrasi 015):
1. Nama dinormalisasi (`norm_nama_project`, di klien `normalisasiNamaProject`).
2. Cocok persis ke **satu** project → dipetakan.
3. Belum ada project dengan nama itu → project baru dibuat.
4. Cocok ke **lebih dari satu** project → dibiarkan di antrean Mapping Center (ambigu, keputusan admin).

Urutan backfill: Request Schedule → Design → Ticket, masing-masing dari yang tertua (project baru mewarisi isian
sales & alamat dari Request Schedule yang paling lengkap).

## 3. Lineage per menu
| Menu | Tabel sumber | Jalur ke project | Tampil di Summary | Tautan "Buka di …" |
|---|---|---|---|---|
| Request Schedule | `reminders` | `project_source_links` (`reminders`) | ya | Request Schedule |
| Ticket Troubleshooting | `tickets`, `activity_logs` | `project_source_links` (`tickets`); `tickets.reminder_id` | ya | `/ticketing?open=<id>` (lihat §4) |
| Request Design Project | `project_requests` (+ `project_messages`, `project_attachments` via `request_id`) | `project_source_links` (`project_requests`) | ya (pesan & lampiran belum — P3-2) | Design Project |
| Form Review Demo & BAST | `form_reviews` | **ikut reminder-nya** (`reminder_id`), tidak dipetakan sendiri | ya | Form Review |
| Project Progress | `progress_projects`, `progress_locations`, `progress_issues` | **belum** — hanya `source_reminder_id` | tidak | — (P2-2) |
| Checklist / hasil AV Tools | `checklist_proyek`, `checklist_daftar`, `tools_av_hasil` | **belum** | tidak | — (P2-2) |
| Insentif | `incentive_projects`, `incentive_tranches` | via `reminder_id` | tidak (di luar Summary) | — |
| Unit Movement | `movement_logs` | hanya teks `project_name` | tidak | — (jangan dipetakan otomatis dari nama) |
| Daily Report | `daily_reports`, `daily_report_team_entries` | hanya teks `project_name` | tidak | — |

## 4. Konteks & tautan
- Summary Project menyimpan project yang dibuka di alamat (`?project=<id>`): kembali dari menu asal membuka project
  yang sama.
- Ticket: `/ticketing?open=<id>` membuka detail ticket. Bila ticket **di luar jendela muat daftar** (mis. lebih dari
  12 bulan), Ticketing mengambil ticket itu saja lewat `ambilTiketTertentu` dengan aturan tampil yang sama dengan
  daftar (P2-1). Akun guest tidak dibukakan ticket di luar daftarnya sendiri; id yang tidak sah / tidak ditemukan
  memberi pemberitahuan, bukan layar kosong.

## 5. Mengapa jumlah di daftar bisa ≠ isi detail
- Record terhubung ada, tetapi di luar akses akun ini (RLS / lingkup) atau sudah dihapus → detail menampilkan
  keterangan "sebagian record tidak tampil" (Phase 1, U11).
