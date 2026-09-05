# HARDENING AUDIT — BASELINE

Dibuat menjawab `WORKMANAGEMENTHARDENINGPHASE.md` (diunggah 5 Sep 2026), Phase 0.

**Hubungan dengan `docs/HARDENING-AUDIT.md`**: dokumen itu adalah log kerja
untuk brief SERUPA (`PLATFORM_HARDENING___WORK_MANAGEMENT.md`, diunggah 30
Agu 2026) dari sesi-sesi sebelumnya. Baseline ini TIDAK mengulang audit yang
sudah dilakukan di sana - butir yang sudah dikonfirmasi bersih dibawa
sebagai fakta, bukan diaudit ulang dari nol. Perbedaan penting: sesi
sebelumnya secara eksplisit TIDAK punya akses langsung ke database produksi
("konektor Supabase terhubung tapi tidak diaktifkan untuk chat ini") - sesi
ini PUNYA akses itu (Supabase MCP), jadi beberapa open question di log lama
sudah bisa dijawab pasti di sini, bukan lagi "sebaiknya diverifikasi".

**Metodologi**: kombinasi (a) pemeriksaan langsung ke database produksi
(`frxdbqcojaiosjoghdqk`) lewat Supabase MCP - baca `pg_policies`/`pg_class`/
`pg_trigger`/`information_schema` dan simulasi eksploitasi lewat transaksi
`ROLLBACK` (tidak menyentuh data nyata), dan (b) 4 subagent riset paralel
yang membaca kode secara read-only. Setiap temuan subagent yang kontradiktif
dengan temuan lain SUDAH di-cross-check manual sebelum dicatat di sini (lihat
catatan di area Ticketing di bawah). Severity: P0 (kritis
keamanan/integritas data), P1 (penting, produksi), P2 (kualitas/performa/UX),
P3 (polish).

---

## MENJAWAB OPEN QUESTION DARI LOG LAMA

**RLS benar-benar menyala di produksi?** YA, dikonfirmasi langsung: seluruh
tabel di skema `public` (~60 tabel) punya `rls_enabled = true`. Tidak ada
tabel dengan RLS mati. Ini menjawab pasti pertanyaan yang sebelumnya harus
"ditanyakan ke Dhany atau dijalankan manual".

**`/api/project-progress/share/[token]` mengirim nama staf internal
(`audit_trail.user_name`) ke halaman publik tanpa login - disengaja atau
bocor?** Ini BELUM terjawab - masih murni keputusan bisnis, bukan soal
teknis. **Perlu jawaban Anda**: apakah nama staf yang menangani boleh
terlihat klien eksternal di halaman share publik?

---

## RINGKASAN EKSEKUTIF

Selama sesi ini, 7 celah keamanan NYATA ditemukan dan sudah diperbaiki +
diverifikasi langsung di database produksi (lihat detail di bagian
Security). Semua perbaikan hanya menambah syarat "harus login" atau "harus
mengaku sebagai diri sendiri" - tidak ada satu pun alur bisnis yang diubah.
2 temuan besar (storage bucket public, sesi tidak langsung tercabut saat
privilege dicabut) sengaja BELUM disentuh - butuh keputusan/perencanaan,
bukan tambalan tergesa.

4 subagent riset menemukan total 45 temuan tambahan lintas seluruh platform
(bukan keamanan RLS - lebih ke business-logic completeness, race condition,
performa, dan konsistensi UI). Highlight yang paling relevan dengan tujuan
bisnis Anda ("dijual ke perusahaan lain, semua harus bisa di-set"):
**24 file di seluruh platform hardcode nama tim/perusahaan** (mis. "Team PTS
IVP") langsung di business logic - ini bukan sekadar gaya kode, ini
penghalang literal untuk menjual platform ini ke perusahaan lain tanpa fork
kode.

---

## SECURITY (Phase 1) — SUDAH DIPERBAIKI SESI INI

| # | Temuan | Severity awal saya laporkan | Severity SEBENARNYA (setelah verifikasi) | Status |
|---|---|---|---|---|
| 1 | `users` - 4 kolom lingkup data (`sales_division`,`divisi`,`pts_type`,`is_internal_sales`) belum dikunci trigger privilege-guard yang sudah ada | P0 (salah - lihat catatan) | P2 | ✅ Diperbaiki + dites |
| 2 | `audit_trail` - INSERT tanpa syarat, bisa memalsukan pelaku | P1 | P1 | ✅ Diperbaiki + dites |
| 3 | `activity_logs` - 2 policy INSERT tumpang tindih dari 2 era migrasi, satu masih terbuka | P1 | P1 | ✅ Diperbaiki + dites |
| 4 | `incentive_splits` - INSERT tanpa syarat login ke tabel finansial paling sensitif | P1 | P1 | ✅ Diperbaiki + dites (lihat catatan lanjutan di bawah) |
| 5 | `users_daftar` - policy pendaftaran anonim lama, sudah tidak dipakai | P2 | P2 | ✅ Dihapus |
| 6 | `notifications` - UPDATE bisa memindahkan notifikasi ke user lain + ganti isi (phishing internal) | P2 | P2 | ✅ Dipecah per-perintah + dites |
| 7 | 4 storage bucket - upload/hapus tanpa syarat login | P1 | P1 | ✅ Diperbaiki + dites |

**Catatan penting soal #1**: laporan awal saya menyebut ini privilege-escalation
P0 ("user bisa jadikan diri admin sendiri"). Setelah diperiksa lebih dalam,
TERNYATA sudah ada trigger `trg_guard_users_privileged` dari sebelumnya yang
sudah menutup jalur itu (role/access_level/full_name/dst sudah terkunci).
Yang benar-benar jadi celah cuma 4 kolom lingkup data. Saya salah menyimpulkan
severity dari membaca teks RLS saja tanpa cek trigger - dikoreksi ke user
saat itu juga sebelum lanjut.

**Catatan lanjutan #4** (dari Agent riset Incentive PTS, sesudah perbaikan
saya): saat ini siapa pun yang SUDAH LOGIN bisa insert ke `incentive_splits`
(saya tutup dari "siapa saja tanpa login" jadi "siapa saja yang login").
Agent menyarankan penyempitan lebih lanjut: hanya pemegang
`akses_insentif_input()` yang boleh insert (menyamakan dengan
`it_tambah`/`it_ubah` di tabel `incentive_tranches`). Ini refinement yang
masuk akal, **belum dikerjakan** - masuk daftar lanjutan di bawah.

## SECURITY — DITEMUKAN, BELUM DIPERBAIKI (butuh keputusan)

| Area | Temuan | Severity | Root Cause | Rekomendasi | Risiko |
|---|---|---|---|---|---|
| Storage (semua bucket) | Semua bucket storage bertanda `public` - file bisa dibaca siapa saja yang tahu URL, terlepas dari RLS `storage.objects` | P1 | Desain awal memilih public bucket + `<img src>` langsung ke `file_url` di seluruh app | Migrasi ke signed URL bertahap per modul | TINGGI - banyak titik pakai, regresi kalau tergesa |
| Sesi/JWT | Privilege yang dicabut admin baru berlaku max ~5.5 jam kemudian (token direfresh lazy di 30 menit sebelum expiry) | P2 | Trade-off desain sesi 6 jam tanpa mekanisme revocation aktif | Perpendek ambang refresh (mis. 15 menit) sebagai mitigasi cepat; revocation list penuh sebagai perbaikan jangka panjang | RENDAH untuk mitigasi cepat, SEDANG untuk revocation list |
| Tech Note | `tn_ubah` RLS mengizinkan author UPDATE kolom `status`/`reviewed_by`/`review_note` di catatannya sendiri - bisa meloloskan approval sendiri lewat panggilan langsung ke PostgREST (Agent 2, diverifikasi baca kode) | P1 | Migration yang memperbaiki bug "author tidak bisa resubmit" tidak sekalian membatasi kolom mana yang boleh diubah | Trigger serupa `guard_users_privileged_columns` khusus `tech_notes`: reset `status`/`reviewed_*` ke nilai lama kalau bukan admin/supervisor | RENDAH - aditif, tidak mengubah alur resubmit yang sudah benar |
| Learning Center | Kunci jawaban (`correct_answer`) terkirim ke browser sebelum soal dijawab; skor dihitung & ditulis dari client, RLS cuma cek kepemilikan baris bukan kebenaran nilai (Agent 2) | P1 | Logika penilaian ada sepenuhnya di client | Pindahkan penilaian ke route/RPC server yang terima jawaban mentah, hitung skor di server | SEDANG - perlu ubah alur pengambilan quiz, jaga UX feedback instan |
| Incentive PTS | `incentive_splits` INSERT masih terbuka utk SEMUA user login, bukan hanya pemegang akses insentif (lihat catatan #4 di atas) | P2 | Belum disempitkan sejak perbaikan awal sesi ini | Gate dengan `akses_insentif_input()` seperti `it_tambah` | RENDAH kalau `processYearlyBatch` di UI memang sudah selalu dijalankan user yang punya akses itu (perlu 1x verifikasi) |
| Ticketing | Race condition brand-BOTH: dua reviewer approve bersamaan bisa membuat request macet, tidak pernah sampai ke Admin (Agent 1, file+baris di laporan asli) | P1 | Client baca snapshot status sendiri-sendiri, tidak ada trigger DB yang menghitung ulang | Trigger `BEFORE UPDATE` di `project_requests`: set `routing_status='admin_review'` otomatis begitu kedua `internal_approved_at`/`internal_approved_at_2` terisi | RENDAH - aditif |
| Ticketing | Approve tiket ke 2 handler berbeda oleh 2 admin bersamaan - tidak ada compare-and-swap di UPDATE, yang terakhir menang diam-diam (Agent 1) | P2 | Guard hanya di state UI (`uploading`), bukan di query | Tambah `.eq('status','Waiting Approval')` di update + cek row count | RENDAH - aditif |

---

## BUSINESS LOGIC / WORKFLOW (Phase 2) — TEMUAN AGENT RISET

Detail lengkap tiap temuan (file:baris, root cause, fix, risiko) ada di 4
laporan mentah subagent (tersimpan sebagai bagian riwayat sesi ini). Ringkasan
per modul, P1 ke atas saja (P2/P3 lengkap tersedia bila diminta):

**Ticketing/Reminder/Request Design/Project Progress** (Agent 1):
- P1: Race condition brand-BOTH approval macet permanen (lihat tabel Security di atas - ini juga masalah data-integrity, bukan cuma keamanan).
- P1: ~40 pesan WhatsApp di 3 modul hardcode domain `team-ticketing.vercel.app`/`work-management-ptsivp.vercel.app` langsung di teks pesan - masalah nyata untuk model bisnis jual-ke-perusahaan-lain.
- P2: Tabel `JABATAN_TIER`/`JABATAN_CC_RULES` (aturan eskalasi jabatan) diduplikasi persis di 2 file - sudah rawan tidak sinkron.
- P2: Approve tiket race condition (lihat tabel Security).
- P2: Fetch error di Request Design Project ditelan diam-diam, tidak ada pesan error ke user.
- P2: 3 file page.tsx raksasa (3.800-5.000 baris) - Ticketing, Reminder Schedule, Request Design Project.

**Tech Note/Daily Report/Picket/Incentive PTS/Learning Center** (Agent 2):
- P1: Tech Note self-approval RLS gap (lihat tabel Security).
- P1: Learning Center jawaban kuis bisa dimanipulasi (lihat tabel Security).
- P1→P2 (sudah sebagian ditutup): Incentive splits insert terbuka (lihat catatan #4).
- P2: `daily_report_team_entries` delete-then-insert tidak cek row-count hasil delete, padahal komentarnya sendiri menyebut risiko RLS diam-diam menolak.
- P2: Persentase skema insentif (harus total 100%) cuma divalidasi di form React, tidak ada CHECK constraint di database.
- P3: Fungsi `getSupervisorTeamForPic()` mati (tidak dipanggil di mana pun) yang hardcode nama karyawan asli - aman dihapus.

**Dashboard/Analytics/Search/Admin/Notifikasi** (Agent 3):
- **Global Search sudah aman** - filter lingkup dilakukan di level query (bukan di client), sudah diverifikasi, tidak perlu tindakan.
- P1→P2 (dikoreksi manual): status "Overdue" tiket TIDAK PERNAH dihitung ulang oleh server (cron yang ada hanya kirim notifikasi WA eskalasi, tidak update kolom status) - murni bergantung tab browser admin yang kebetulan terbuka. Saya verifikasi langsung ke `app/api/cron/escalate/route.ts` - benar tidak ada `.update(status)`.
- P2: Dashboard menghitung "Reminder Overdue" tapi halaman Reminder Schedule sendiri tidak punya konsep/filter "overdue" - user tidak bisa memverifikasi angka itu dari sumbernya.
- P2: `ref_id` di setiap notifikasi disimpan tapi tidak pernah dipakai untuk deep-link ke record spesifik - klik notifikasi cuma buka daftar modul.
- P2: 2 sistem realtime (NotificationBar + Command Center) sama-sama refetch SEMUA data pada SETIAP perubahan, bisa dobel-fetch bersamaan.
- P2: `DashboardKPI.tsx` ada 2 versi (dashboard vs kpi-team) yang sudah bercabang beda field.

**Shared components/Responsive/Accessibility/Code Quality** (Agent 4):
- P1: `Modal.tsx` (dipakai hampir semua popup) tidak punya focus-trap - Tab bisa lompat ke konten di belakang overlay.
- P1: `ConfirmDialog.tsx` (63+ titik pakai) tidak punya Escape/scroll-lock/focus-management sama sekali, beda standar dari `Modal.tsx`.
- **P1: 24 file hardcode nama tim/perusahaan langsung di business logic** - lihat highlight di ringkasan eksekutif. Ini yang paling relevan untuk rencana jual-ke-perusahaan-lain.
- P1: Modal "KPI Settings" ter-copy-paste di 2 tempat (kpi-team page vs component), sudah bercabang beda styling.
- P2: Status badge (warna/label yang sama) diimplementasikan ulang di tiap modul, bukan 1 komponen shared - warna "done"/"pending" beda-beda hex di tiap layar.
- P2: 2 komponen berbeda total sama-sama bernama `DashboardKPI` di folder berbeda - jebakan untuk IDE/import.
- Tidak ditemukan indikator status warna-saja tanpa teks/ikon pendamping - area ini sudah baik.

---

## PERFORMANCE (Phase 5) — dari Agent 3

- Command Center + Notification Bar sama-sama polling (30 detik & 2 menit) + berlangganan realtime penuh secara terpisah - kandidat pengurangan egress Supabase.
- Admin Panel user list fetch seluruh tabel `users` tanpa pagination (aman di skala sekarang, akan jadi masalah kalau jumlah user bertambah banyak - relevan untuk rencana multi-perusahaan).
- Audit Log tab menarik 600 baris (`audit_trail`+`activity_logs`) penuh lalu filter di client, bukan filter di query.

---

## LANJUTAN YANG DISARANKAN (urutan prioritas)

1. **Jawab open question halaman share publik** (nama staf internal terlihat klien) - murni keputusan bisnis Anda.
2. **Tutup 2 celah security P1 baru**: Tech Note self-approval, Learning Center integritas kuis.
3. **Perbaiki race condition brand-BOTH** (Request Design Project macet permanen) - data-integrity, bukan cuma UX.
4. **Rencanakan penghapusan hardcode nama tim/perusahaan** (24 file) - ini prasyarat teknis nyata untuk menjual platform ke perusahaan lain, bukan sekadar polish.
5. Sisanya (accessibility Modal/ConfirmDialog, performa realtime, konsolidasi komponen duplikat) - P2 ke bawah, bisa dikerjakan bertahap kapan saja.

Dokumen ini TIDAK mencakup Phase 4 (Race Condition mendalam di luar yang
ditemukan), Phase 8 (Accessibility penuh - baru sampel), Phase 13 (Testing),
Phase 17 (Deployment), Phase 19 (Commercial readiness) secara menyeluruh -
scope Phase 0 ini fokus ke Security + gambaran besar Business
Logic/Performance/UI sesuai urutan brief ("Mulai dari PHASE 0").
