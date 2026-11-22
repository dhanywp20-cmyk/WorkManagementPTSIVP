# DESIGN_IMPLEMENTATION_PLAN — Transformasi Desain "PTS AV Operations · Dark Glass Workspace"

Tanggal: 22 November 2026 · Status: **Fase 0 selesai, menunggu persetujuan** · Tidak ada kode aplikasi yang diubah.

Acuan visual: `docs/redesign/DESIGN_REFERENCE_ANALYSIS.md`.

---

## 1. Baseline repositori (hasil inspeksi)

| Hal | Temuan |
|---|---|
| Remote | `origin` → `github.com/dhanywp20-cmyk/WorkManagementPTSIVP` |
| Branch produksi | `main` (default branch GitHub; CI `push: [main]`; DEPLOYMENT.md: Vercel men-track `main`) |
| Vercel | Integrasi Git aktif, project `work-management-ptsivp`. PR terakhir (#262, branch `claude/putar-proyektor-potret`) mendapat check **Vercel = SUCCESS** + komentar *Vercel Preview* → branch non-main otomatis menjadi **Preview**. Vercel CLI terpasang tapi tidak dipakai (tidak perlu). |
| CI | `ci.yml` jalan di setiap PR: typecheck → lint → `npm test` → `next build`. |
| Status git | Worktree `claude/hello-21aafc`, bersih. Tidak ada pekerjaan pengguna yang belum di-commit. |
| Stack | Next.js 16, React 19, Tailwind 4, Supabase, three.js, lucide-react. Tanpa GSAP/Framer. |

## 2. Peta sistem desain saat ini

| Lapisan | Berkas | Catatan |
|---|---|---|
| Token global & animasi | `app/globals.css` (809 baris) | `.menu-3d`, `.sidebar-3d`, `.kepala-3d`, `.tombol-utama`, `.bb-*` (beranda), keyframe menu |
| Tema gelap | `app/tema-gelap.css`, `tema-gelap-kaca.css`, `tema-gelap-kontras.css` | Aktif lewat `html.gelap`; token `--wm-*` (aksen rose `#f43f5e`), menimpa palet `slate/gray` Tailwind secara global |
| Saklar tema | `components/shared/Tema.tsx` | `localStorage['wm-tema']`, default **terang** |
| Warna merek | `lib/merek/inti.ts` | `--merek-utama/-2/-aksen` dari Admin → Merek; `latarDasbor` bisa berupa **gambar** |
| Shell | `app/(portal)/_kerangka/KerangkaPortal.tsx`, `SidebarPortal.tsx`, `SidebarLengkap.tsx`, `SidebarRingkas.tsx`, `daftar-menu.tsx` | Sidebar 64/272 px, grup Learning · Project · Internal Daily, lencana pending |
| Header | `renderHeader()` di KerangkaPortal | Logo, nama platform, GlobalSearch, NotificationBar, profil, keluar |
| Nav mobile | `dashboard/_components/NavBawahMobile.tsx` | Animasi `ikonLompat` + `garisMelebar` |
| Dashboard | `dashboard/_components/widgets/PermissionAwareDashboard.tsx`, `beranda/IsiBeranda.tsx`, `RincianBento.tsx`, `grafik.tsx`, `workcenter/PanelAgenda.tsx` | Widget sudah difilter izin (`permissions.ts`) |
| Komponen bersama | `components/shared/*` (StatCard, Charts, Modal, ConfirmDialog, Toast, EmptyState, LoadingScreen, PageHeader, Paginasi, FilterLipat, FormParts, …) | Dipakai ulang, bukan dibuat ganda |

### Modul (semua di `app/(portal)/`)
dashboard · ticketing · reminder-schedule · daily-report · picket-showroom · unit-movement ·
incentive-pts · project-progress · summary-project · form-require-project · form-review ·
kpi-team · tech-note · tools-team (AV Solution Tools) · **learning-center (DIKECUALIKAN)**.
Di luar portal: `analytics-dashboard`, `project-progress/share`, `checklist/share`, `kelas/[token]`.

## 3. Animasi ikon menu — DIPERTAHANKAN (permintaan pemilik)

Tidak diubah, tidak dihapus, hanya warnanya ikut token baru:
- `.menu-3d` hover: item geser `translateX(4px)`, ikon miring `rotate(-8deg) scale(1.14)`, kurva pegas `cubic-bezier(.34,1.56,.64,1)`.
- `.menu-3d.h-9` (sidebar ciut) hover: `translateY(-2px) scale(1.08)`.
- Aktif: ikon `ikonPantul` (0,7 dtk) + bilah aksen kiri `aksenTumbuh`.
- Masuk: `menuMasuk` bertahap (stagger 0,06 dtk).
- Nav bawah mobile: `ikonLompat` + `garisMelebar`.
- Klik: `scale(.98)` tekan.
- Tetap menghormati `prefers-reduced-motion`.

Yang **ditambah** dari video (CSS murni, tanpa GSAP): transisi buka/ciut sidebar dengan
clip-path yang tepinya berjalan, panah handle berputar 180°, dan label menu muncul
`opacity 0→1, x −10→0`. Ini dipasang di **wadah** sidebar/label, bukan di ikon, sehingga tidak
bertabrakan dengan animasi ikon di atas.

## 4. Token desain yang diusulkan

Dipusatkan di satu berkas baru `app/tema-pts-kaca.css` (tidak menyebar hex ke komponen).
Nilai berangkat dari sampel video lalu disesuaikan agar kontras teks ≥ WCAG AA.

| Token | Nilai awal | Peran |
|---|---|---|
| `--pk-latar` | `#141615` + gambar latar merek (diburamkan & digelapkan) | Kanvas |
| `--pk-rel` | `rgba(22,24,24,.92)` | Sidebar |
| `--pk-panel` | `rgba(38,38,38,.72)` + blur 18px | Panel/kartu utama |
| `--pk-panel-2` | `rgba(54,54,50,.70)` | Panel hero / ditinggikan |
| `--pk-ubin` | `rgba(66,75,75,.55)` | Ubin di dalam panel |
| `--pk-garis` | `rgba(255,255,255,.07)` + highlight atas `rgba(255,255,255,.06)` | Pemisah |
| `--pk-tinta` | `#F2F1EC` | Teks utama (hangat) |
| `--pk-tinta-2` | `#A9AAA3` | Teks pendukung |
| `--pk-aksen` | `#5CC8B0` (mint; sampel `#48B7A1`) | Tombol utama, item aktif, toggle |
| `--pk-aksen-lembut` | `rgba(92,200,176,.16)` | Latar chip aktif |
| `--pk-info` | `#8EC5F0` | Grafik / dial |
| `--pk-hangat` | `#C9A36B` | Sparkline sekunder |
| `--pk-sukses` / `--pk-peringatan` / `--pk-kritis` | `#8FD49A` / `#E6C878` / `#E57A72` | Status |
| Radius | panel 18px · ubin 12px · chip/tombol pil | |
| Bayangan | hampir nol; pemisahan lewat celah 10–12px | |

Tabel dan formulir padat di modul **tidak** dibuat tembus pandang (tetap `--pk-panel` opak ≥ .94)
agar keterbacaan data tidak turun.

## 5. Isolasi Learning Center

Fakta: tema gelap sekarang bersifat global (`html.gelap` menimpa palet slate/gray), sehingga
Learning Center juga ikut gelap ketika pengguna memilih mode gelap.

Strategi agar Learning Center **tidak berubah sama sekali**:
1. Tema baru memakai kelas sendiri (`html.pts-kaca`), bukan mengubah isi `tema-gelap*.css`.
2. Selektor tema baru dibatasi ke shell + `.isi-portal:not([data-modul="learning-center"])`.
3. Wadah isi Learning Center diberi atribut `data-modul="learning-center"` (satu atribut di shell,
   bukan di berkas Learning Center) dan memakai ulang token lama apa adanya.
4. Uji regresi: tangkapan layar Learning Center (terang & gelap) sebelum vs sesudah harus identik.
   Berkas di `app/(portal)/learning-center/**`, `app/kelas/**`, `components/kuis-live/**`
   dan kelas `.lc-*` tidak disentuh.

## 6. Rencana per fase (setelah disetujui)

Semua di branch baru **`design/pts-dark-glass`** dari `origin/main` terbaru.

| Fase | Isi | Berkas utama | Cek regresi |
|---|---|---|---|
| 1 Fondasi | `tema-pts-kaca.css`, token, tipografi, kelas panel/chip/pil, saklar tema 3 opsi (Terang · Gelap lama · PTS Kaca) | `app/tema-pts-kaca.css`, `components/shared/Tema.tsx`, `app/layout.tsx` | Halaman lain tak berubah saat tema bukan PTS Kaca |
| 2 Shell | Sidebar rel mengambang, grup berlabel, sub-teks, lencana, kartu status di dasar; header melayang (judul + tanggal, cari pil, lonceng, tombol pil "+ Baru" sesuai izin, avatar); transisi buka/ciut | `_kerangka/*`, `NavBawahMobile.tsx` | Semua item menu & izin sama; tour onboarding; mobile nav |
| 3 Dashboard | Hero sapaan + chip status + kalimat ringkasan + aksi cepat; panel ring kesehatan operasional; 4 KPI + sparkline dari data nyata; deret project/modul terbaru | `beranda/*`, `widgets/*` | Angka sama dengan dashboard lama untuk user yang sama |
| 4 Modul operasional | Ticketing, Request Schedule, Daily Report, Piket, Unit Movement, Incentive — permukaan, tab pil, filter, tabel opak; logika tidak disentuh | per modul | Alur buat/ubah/ekspor tiap modul |
| 5 Project & AV | Project Progress/Summary: timeline & status; AV Solution Tools: ruang kerja teknis (panel input–hasil), kanvas 3D tetap | per modul | Hasil kalkulator identik, viewer 3D jalan |
| 6 Sisa & QA | KPI Team, Tech Note, Form Review, Form Require, Analytics; uji 375/768/1440 px | — | `tsc`, lint, `npm test`, `build`, e2e bila bisa |
| 7 Preview | Push branch saja → PR draft → Vercel Preview → verifikasi halaman kunci di URL Preview | — | Laporan URL + status |

Tiap fase = commit terpisah, jadi mudah dibatalkan per bagian.

## 7. Yang dijamin tidak berubah
Skema & data database, migrasi (tidak ada), Supabase, API route, autentikasi & izin peran,
rumus incentive/KPI/kalkulator AV, alur persetujuan, cron & notifikasi, ekspor/unduhan,
env var produksi, setelan Vercel, dan seluruh Learning Center.

## 8. Alur Git & Vercel (Preview saja)
1. `git fetch origin` → branch `design/pts-dark-glass` dari `origin/main`.
2. Commit hanya di branch itu; `git push -u origin design/pts-dark-glass` — **tidak pernah** push ke `main`.
3. Buka **PR draft** ke `main` (hanya untuk memicu & menampilkan Preview; tidak di-merge).
4. Tunggu check Vercel; ambil URL Preview dan pastikan environment = Preview.
5. Laporkan: nama branch, hash commit, environment, URL Preview, status build, `main` tidak tersentuh, merge = tidak.
6. Merge hanya setelah pemilik menyetujui Preview secara eksplisit.

## 9. Keputusan yang perlu pemilik

1. **Warna aksen**: video memakai **mint/teal**, prompt menyebut **lime**. Rekomendasi: ikuti video (mint).
2. **Glassmorphism**: video jelas memakai panel kaca di atas foto, prompt meminta menghindarinya.
   Rekomendasi: kaca hanya di shell & dashboard; tabel/form modul tetap opak.
3. **Default tema**: (a) PTS Kaca jadi default untuk semua orang, mode terang tetap bisa dipilih —
   atau (b) PTS Kaca hanya sebagai pilihan tambahan. Rekomendasi: (a) di Preview, supaya langsung terlihat.
4. **Gambar latar**: pakai gambar latar merek yang sudah bisa diatur Admin; jika kosong, gradasi
   arang hangat. Foto interior dari video **tidak** dipakai (hak cipta).
5. **Cakupan Preview pertama**: rekomendasi Fase 1–3 dulu (fondasi + shell + dashboard) agar bisa
   dinilai cepat, lalu modul lain menyusul di branch yang sama.
