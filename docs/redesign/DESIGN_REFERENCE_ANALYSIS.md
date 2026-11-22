# DESIGN_REFERENCE_ANALYSIS — Video Referensi "Smart home control Dashboard"

Tanggal analisis: 22 November 2026 · Fase 0 (tanpa perubahan kode aplikasi)

## 0. Sumber & cara inspeksi

- Berkas: `Code___Chill_-_Smart_home_control_dashboard_..._720P_HD.mp4` (unggahan pengguna).
- Spesifikasi: 720 × 1280 (vertikal), durasi 5,45 detik. Layar dashboard di dalam video hanya
  ±646 × 367 px, jadi detail kecil (ukuran font persis, ketebalan garis 1px) **tidak bisa
  dipastikan** dan tidak diklaim di bawah.
- Metode: video diputar di browser lokal, 28 frame diambil tiap ±0,2 dtk, area dashboard
  diperbesar, dan warna diambil langsung dari piksel (rata-rata 3×3). Warna di bawah adalah hasil
  sampel video terkompresi — akurat untuk arah/hue, bukan nilai hex final.
- Isi video: judul "Smart home control Dashboard", rekaman layar dashboard yang berpindah
  Overview → Rooms → Living room → Climate, dan potongan kode `src/App.tsx` (animasi GSAP sidebar).

> **Catatan penting — referensi berbeda dari asumsi di prompt.**
> Prompt menyebut aksen **lime-green**, grafik batang biru, gaya CRM, dan "hindari glassmorphism".
> Video yang diunggah ternyata menunjukkan **aksen mint/teal**, **panel kaca buram (frosted glass)
> di atas foto interior**, dan konten smart-home. Karena prompt menetapkan video sebagai sumber
> kebenaran, rencana mengikuti apa yang terlihat di video, dan perbedaan ini perlu
> dikonfirmasi pemilik (lihat bagian "Keputusan" di `DESIGN_IMPLEMENTATION_PLAN.md`).

---

## 1. Yang TERAMATI langsung di video

### 1.1 Mood keseluruhan
- Gelap, hangat, tenang, "premium hospitality" — bukan neon. Kontras utama dari teks putih
  hangat di atas panel abu-arang semi-transparan.
- Latar halaman = **foto interior** (atap kayu, jendela besar, tanaman) yang terlihat samar di
  belakang semua panel. Pada halaman Rooms foto tampil penuh dan lebih terang.

### 1.2 Hierarki latar & permukaan (sampel piksel)
| Lapisan | Sampel | Pengamatan |
|---|---|---|
| Rel sidebar | `#181A1A` | Paling gelap, hampir opak, sudut membulat besar, terpisah dari tepi layar |
| Kartu KPI | `#262626` | Abu-arang netral, sedikit tembus |
| Panel sapaan (hero) | `#353530` | Lebih terang & sedikit hangat; foto tembus samar |
| Ubin "Scenes" | `#424B4B` | Permukaan ketiga, sedikit kehijauan |
| Celah antar panel | `#2B2B2A` | Foto latar yang diburamkan + digelapkan |

Hierarki terbentuk dari **kecerahan & tingkat tembus**, bukan dari bayangan tebal. Tepi panel
tampak punya garis tipis terang (highlight 1px) — terlihat samar, tebal persisnya tidak pasti.

### 1.3 Sidebar
- Mode ciut: rel ikon sempit (±4–5 % lebar layar ≈ 64 px di layar 1440), logo kotak mint di atas,
  ikon garis (outline) abu, tanpa label; avatar/indikator status di bawah.
- Mode buka (±18 % lebar ≈ 260 px): nama produk + sub-judul, **grup berlabel huruf kecil kapital**
  ("HOME", "CONTROL", "HOUSEHOLD"), item dengan ikon + label + chevron, **sub-menu bertingkat**
  dengan garis vertikal tipis dan item aktif berwarna mint, **lencana angka** di kanan item,
  dan kartu status kecil di dasar sidebar.
- Item aktif: latar pil abu lebih terang (bukan blok warna penuh); sub-item aktif berteks mint.
- Tombol ciut/buka berupa bulatan kecil dengan panah di tepi kanan sidebar (di samping header).

### 1.4 Animasi buka/tutup sidebar (dari potongan kode di video)
Kode `src/App.tsx` yang terlihat (GSAP) menjelaskan gerakannya:
1. Panel sidebar langsung diberi lebar penuh, lalu **clip-path** dianimasikan sehingga tepinya
   "berjalan" membuka/menutup.
2. Konten utama dan tombol pegangan (handle) **meluncur mengikuti tepi** (`x` dari selisih posisi ke 0).
3. Panah handle **berputar 180°**.
4. Elemen yang bergeser vertikal ikut dianimasikan `y` (FLIP).
5. Label menu **muncul bertahap**: `opacity 0→1`, `x -10→0`, durasi 0,45 dtk, stagger 0,012 dtk.

### 1.5 Header halaman
- Kiri: judul halaman ("Overview") + subjudul tanggal/jam kecil abu.
- Kanan: kolom cari berbentuk pil dengan petunjuk pintasan keyboard, ikon pengaturan, lonceng
  dengan lencana mint, **tombol utama "+ New" berbentuk pil mint**, avatar bulat.
- Header melayang di atas foto (tanpa garis bawah tebal).

### 1.6 Tipografi
- Sans geometris-humanis, sudut huruf membulat (jenis font persis tidak bisa dipastikan dari video).
- Sapaan hero besar (±2× judul panel) dengan **bobot sedang, bukan tebal**.
- Label panel kecil abu; angka KPI besar bobot sedang dengan **satuan lebih kecil** ("1.420 W",
  "15.1 kWh", "44 %").
- Judul halaman (Rooms/Climate) besar, regular.

### 1.7 Komposisi Overview
- Baris 1: panel hero lebar (sapaan + chip status berikon + kalimat ringkasan + grid "Scenes" 2×3)
  dan panel kanan setinggi hero (Climate: dial melingkar, tombol ±, kontrol segmen Heat/Eco/Cool/Auto).
- Baris 2: **4 kartu KPI** sejajar — ikon + label, angka besar, chip delta (titik "live" hijau,
  "−25 %" merah lembut), dan **sparkline area kecil** di pojok kanan bawah.
- Baris 3: "Rooms" — deret kartu foto dengan tautan "All rooms" bertekstur mint di kanan.

### 1.8 Warna aksen & status (sampel)
| Peran | Sampel | Catatan |
|---|---|---|
| Aksen utama (tab aktif, tombol) | `#48B7A1` | Mint/teal; tombol "+ New" & logo memakai varian ini |
| Isi slider | `#61A896` | Mint lebih lembut |
| Toggle aktif (thumb) | `#D1F7F2` | Mint sangat terang |
| Tombol "All on" | `#3D675D` | Mint gelap/tembus |
| Dial suhu | gradasi biru muda → putih | Satu-satunya biru yang menonjol |
| Sparkline KPI | pasir/amber `#62513D` & teal | Gradasi area lembut |
| Chip negatif | merah lembut di atas gelap | Tidak menyala |

Aksen dipakai **hemat**: hanya tombol utama, tab/sub-menu aktif, toggle, slider, logo.

### 1.9 Sudut, garis, bayangan, jarak
- Sudut panel besar (±16–20 px), chip & tombol berbentuk pil penuh, ubin kecil ±12 px.
- Hampir tanpa bayangan; pemisahan lewat celah ±8–12 px yang memperlihatkan foto latar.
- Kepadatan sedang: banyak informasi, tapi tiap panel punya ruang dalam yang lega.

### 1.10 Transisi halaman
- Saat pindah menu, panel lama memudar dan foto latar sempat tampil penuh (Rooms), lalu panel
  baru muncul memudar. Tab halaman berupa pil; tab aktif berisi mint dengan lencana hitungan.

### 1.11 Responsif
- **Tidak terlihat di video** (hanya desktop). Tidak ada perilaku mobile yang bisa diklaim.

---

## 2. ADAPTASI yang diusulkan untuk Work Management PTS IVP

Bagian ini usulan, bukan pengamatan.

| Unsur video | Adaptasi PTS IVP |
|---|---|
| Foto interior di belakang panel | Pakai fitur yang **sudah ada**: `merek.latarDasbor = 'gambar'` (gambar latar dashboard dari Admin → Merek). Default: foto ruang rapat/kontrol AV milik PTS, atau gradasi arang hangat jika belum ada gambar. |
| Panel kaca buram | Panel arang semi-tembus + `backdrop-filter` blur, **hanya** di shell & dashboard. Tabel/form padat di modul tetap opak agar mudah dibaca. |
| Aksen mint | Token aksen tema baru; tetap bisa ditimpa oleh warna merek dari Admin. |
| Scenes (smart home) | "Aksi cepat" PTS: Buat Ticket, Request Schedule, Daily Report, AV Tools — sesuai izin pengguna. |
| Panel Climate (dial) | Panel ring "Kesehatan operasional" / progres project dari data nyata (mis. % checklist Project Progress), bukan angka hiasan. |
| 4 KPI + sparkline | KPI nyata yang sudah ada (`lib/kpi-dasbor.ts`, widget dashboard): ticket terbuka, jadwal hari ini, project berjalan, dll. dengan sparkline dari data periode. |
| Rooms (kartu foto) | Deret modul/project terbaru; foto hanya bila datanya ada. |
| Sidebar grup HOME/CONTROL/HOUSEHOLD | Grup yang sudah ada di kode: Dashboard · Learning · Project · Internal Daily. |
| Lencana angka | Lencana yang sudah ada (pending request, pending user). |

Identitas sendiri: label, istilah, data, dan logo tetap PTS IVP / IndoVisual; tidak menyalin nama
"Halvo", teks, atau tata letak piksel-per-piksel.
