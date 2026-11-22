# Analisis Referensi Desain — "Aurora Glass"

Sumber: video referensi `Sales_CRM_dashboard (Link) MP4.mp4` (12 detik, 1280×720, 30 fps).
Frame diekstrak tiap 2 detik dengan ffmpeg dan diperiksa satu per satu.
Layar yang terlihat: **Overview** (sidebar ciut → terbuka) dan **Pipeline → Forecast**.

Dokumen ini memisahkan **(A) apa yang benar-benar terlihat** di video dan
**(B) adaptasi yang diusulkan** untuk Work Management PTS IVP.

---

## A. Karakteristik yang teramati langsung

### Suasana keseluruhan
- Workspace gelap premium. Latar bukan hitam pekat: foto lanskap gelap (langit
  biru-kelabu di atas, hutan/tanah hijau-kecokelatan di bawah) yang **di-blur kuat**,
  sehingga terbaca sebagai cahaya ambient lembut.
- Semua panel adalah **kaca gelap** (frosted): isi semi-transparan + blur latar,
  garis tepi tipis terang ~8–10% putih, tanpa bayangan tebal.

### Hierarki permukaan
| Lapisan | Pengamatan |
|---|---|
| Latar | Foto ter-blur, nada biru-kelabu → hijau zaitun/cokelat gelap |
| Sidebar | Pil vertikal mengambang, lepas dari tepi (margin ±16 px), sudut ±28 px, kaca gelap |
| Panel utama | Kaca gelap ~55–65% opasitas, sudut ±20 px |
| Kartu KPI | Kaca **bertint**: biru-slate, hijau zaitun, merah bata/karat, arang netral |
| Kontrol | Pil (tombol "New", pencarian, segmented "Board / All deals / Forecast") |

### Sidebar
- Mode ciut: ±56 px, hanya ikon, titik status kecil (lime/oranye) di samping ikon.
- Mode terbuka: ±230 px; logo + nama produk, tombol ciut di kanan atas, grup "SPACES"
  dan "MENU" (label huruf kapital kecil, abu-abu), item = ikon + label + lencana angka
  di kanan (pil gelap).
- Item aktif: latar kaca sedikit lebih terang + **titik lime** setelah label.
- Bagian bawah: Settings, Help, toggle **Dark mode** (switch lime), kartu profil
  (avatar, nama, jabatan, chevron).

### Header & judul halaman
- Breadcrumb kecil di kiri atas ("Workspace / Overview").
- Kanan atas: pencarian pil (placeholder + `⌘K`), tombol primer **lime** "+ New",
  lonceng dengan lencana oranye-merah, avatar bulat.
- Judul besar sapaan ("Good morning, …") ±34 px, bobot medium/semibold,
  **garis bawah lime** di bawah judul; baris konteks kecil abu-abu di bawahnya
  (tanggal · jumlah overdue · aktivitas hari ini).
- Aksi halaman di kanan judul: tombol sekunder kaca ("Reports") + tombol primer lime.

### Tipografi
- Sans geometris bersih (mirip Urbanist/Outfit), angka KPI besar ±26 px semibold,
  label kecil ±12 px abu-abu terang. Kontras teks tinggi (putih kehijauan).

### KPI
- 4 kartu sejajar. Isi: label kecil → angka besar → keterangan kecil.
  Kartu pertama punya bilah progres putih + delta hijau ("+55% vs last month").

### Grafik
- Batang vertikal **biru muda (#8DB8E8-an)** di atas "lintasan" batang kelabu transparan,
  garis target putus-putus, batang periode berjalan **lime**. Legenda kecil kanan atas.
- "Pipeline by stage": baris label + sub-label, bilah horizontal (kelabu, krem,
  biru, lime untuk tahap "Won"), nilai rata kanan.
- Forecast: kolom bertumpuk lime (commit) / biru (likely) / kelabu (best case).

### Aksen & warna status
- Lime (#C5F05A-an): tombol primer, item aktif, batang periode kini, toggle, delta positif.
- Biru: data/grafik. Krem/kuning: tahap menengah. Oranye-merah: lencana notifikasi.

### Radius, garis, bayangan, kepadatan
- Radius besar & konsisten (panel ±20 px, pil 999 px). Garis 1 px putih ±8%.
- Bayangan hampir tidak ada; kedalaman dari perbedaan opasitas kaca.
- Kepadatan sedang: gap antar panel ±16 px, padding panel ±18–20 px.

### Perilaku responsif
- Tidak terlihat di video (hanya desktop 16:9). **Tidak diasumsikan.**

---

## B. Adaptasi untuk Work Management PTS IVP

Identitas: **PTS AV OPERATIONS — Dark Intelligence Workspace**. Bukan klon CRM:
tidak memakai logo, nama, teks, data, atau label menu referensi.

| Aspek | Referensi | Adaptasi PTS IVP |
|---|---|---|
| Latar | Foto lanskap ter-blur | Latar ambient **tanpa foto** (gradasi biru-petrol + zaitun + karat + noise halus) — terinspirasi cahaya ruang kontrol AV. **Gambar latar IVP tidak dipakai setelah login.** |
| Halaman login | – | **Tetap memakai latar IVP** seperti sekarang (tidak disentuh). |
| Sidebar | Pil kaca mengambang | `sidebar-3d` yang ada dibuat kaca gelap mengambang; struktur, grup Learning/Project/Internal Daily, izin & badge tetap. Item aktif = kaca terang + titik lime. |
| Header | Breadcrumb + search + New | Header portal yang ada (logo, GlobalSearch, lonceng) menjadi strip kaca transparan. |
| Judul | Sapaan + garis lime | "Halo, {nama}" + garis bawah lime + tanggal. |
| KPI | 4 kartu bertint | Kartu angka beranda (Tiket selesai, Jadwal tim, Terlambat) memakai tint biru-slate / zaitun / karat; data tetap dari sumber yang sama. |
| Grafik | Batang biru + lime | Grafik "Alur kerja": batang selesai biru sinyal, sisa = lintasan kelabu transparan. |
| Aksen | Lime | Lime `#C7F36B` hanya untuk tombol primer, status terpilih, dan sorotan positif. |
| Font | Geometris | **Plus Jakarta Sans** (dirancang di Indonesia) untuk shell & modul, bukan Learning Center. |

Token warna yang dipakai ada di `app/tema-aurora.css` (satu tempat).
