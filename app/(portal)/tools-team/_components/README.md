# Tools Team — struktur kode

Menu **Tools Team** (`app/tools-team/page.tsx`) berisi tiga alat. Tiap alat punya satu berkas
**kerangka** kecil di folder ini dan satu **folder kelompok** berisi logikanya.

```
_components/
  Desain3D.tsx       kerangka Desain 3D Ruang AV        → desain3d/  (lihat desain3d/README.md)
  KalkulatorLED.tsx  kerangka LED Videotron             → led/
  KalkulatorAV.tsx   kerangka Kalkulator AV (5 sub)     → av/
  SLD.tsx            kerangka Single Line Diagram       → sld/ (logika murni lib/sld/, diuji uji/sld.ts)
  ChecklistBarang.tsx kerangka Checklist Barang         → cekbarang/ (impor Excel / PDF, PDF hasil + tanda tangan;
                     logika murni lib/checklist/barang.ts, diuji uji/checklist-barang.ts)
  bersama/           dipakai semua alat: ui.tsx (isian, kartu, nilai), cetak.ts (lembar A4 & PNG),
                     riwayat.ts (undo / redo)
```

Rumus murni yang dipakai lintas modul (ukuran layar, lumen, bandwidth, SPL, hitung LED,
koneksi & daya LED) ada di `lib/av/hitung.ts` dan diuji di `uji/av-hitung.ts`.

## led/ — LED Videotron

```
led/
  useKeadaanLED.ts    isian, referensi produk, hasil hitung, hardware Novastar, data koneksi & daya, BOM
  useEksporLED.ts     ringkasan teks, lembar cetak / PNG (LED, BOM & penawaran, Screen & Power Connection)
  data.ts             pengaturan BOM, pitch & cabinet umum, daya / berat per m²
  panel/              KartuProject, KartuSpesifikasi, KartuHasil, KartuHardware, KartuBom, CatatanLED,
                      BarSub, AksiFile, ModalBersama, KartuLayar, TampilanDaya, TampilanKoneksi
  koneksi/            Screen Connection: data.ts (murni), svg.ts, teks.ts, useRuangKoneksi.ts,
                      RuangKoneksi.tsx + PanelCara, PanelUkuranRC, PanelPort, KanvasKoneksi, TabelPort
  daya/               Power Connection: data.ts (murni), svg.ts, teks.ts, RuangDaya.tsx
  referensi/          referensi produk LED: useReferensiLED, EditorReferensiLED, TabelHardware
  FileLED.tsx         buka / simpan hitungan ke server tim
```

## sld/ — Single Line Diagram

Template ekspor BAKU, meniru SLD contoh final yang disetujui pemilik (A3 landscape, 2 sheet):
sheet 1 = strip judul kiri + diagram foto perangkat & kabel berwarna; sheet 2 = Daftar Koneksi,
Gambar Perangkat, Daftar Perangkat, Catatan Pemasangan, blok judul. Warna, huruf & kolom dikunci
di `lib/sld/gaya.ts`, `lembar1.ts`, `lembar2.ts` dan dijaga `uji/sld.ts` - jangan dibuat bertema.

Dua isi ekspor dari SLD yang sama: **Full Detail** (2 sheet, internal - "NO SHARE") dan **Simple** (hanya sheet 1,
"no dtl", aman dibagikan ke klien). Sheet 2 terisi otomatis: perangkat tanpa No. BOM dinomori setelah No. BOM
yang ada (model sama digabung, beban non-pasokan seperti tirai/lampu/AC/FCU/MCB tidak masuk), kolom Fungsi kosong
diisi dari jenis kabel.

```
lib/sld/
  tipe.ts       DokSLD, Perangkat, Kabel, ukuran halaman
  gaya.ts       warna kabel, huruf, watermark (tetap)
  geometri.ts   nomor K / P, sisi sambung, rute garis siku, letak label
  primitif.ts   tata letak bersama (kotak, garis, teks, sel tabel) -> SVG & Visio dari sumber yang sama
  lembar1.ts    SVG sheet 1     lembar2.ts  SVG sheet 2     turunan.ts  isi tabel & pemeriksaan
  vsdx.ts       ekspor Visio: shape bergambar + titik sambung, kabel = connector yang menempel (glue);
                vsdx-bentuk.ts / vsdx-gaya.ts (style dasar). Visio WAJIB punya visio/windows.xml
  katalog.ts    templat per kelompok (Display TCL & Philips BDL, middleware WyreStorm, sumber input, ...) + saran model
  foto-produk.ts  FOTO PRODUK ASLI bawaan (public/sld/produk/*.jpg, dari situs resmi pabrikan) per item katalog AV
  ikon.ts / ikon-layar.ts  ilustrasi 2D - hanya untuk barang non-AV (tirai, gorden, lampu, AC/FCU, MCB) atau bila foto dihapus
  dok.ts        buat / bersihkan dokumen, tanpaFoto / pasangFoto      contoh.ts  contoh Voice Kamar Pasien
  bom.ts        baca BOM .xlsx (baris + foto kolom Gambar + crop Excel)  zip.ts  baca / tulis ZIP tanpa dependensi
  ekspor.ts     (browser) SVG per sheet + foto tersemat, .vsdx, PNG, berkas paket - dipakai juga Request Design
  sematkan.ts / ilustrasi.ts  (browser) foto bawaan jadi data URL, ilustrasi jadi PNG
_components/sld/
  useKeadaanSLD.ts  dokumen + undo/redo + draf localStorage
  KanvasSLD.tsx     seret perangkat, ubah ukuran, tarik "+" untuk kabel, geser jalur
  PanelKatalog, PanelSamping (Properti, Koneksi, Judul & catatan, Periksa), ekspor.ts (unduh PDF A3 / PNG / Visio)
  ImporBom.tsx      foto & perangkat dari BOM;  AmbilBrosur.tsx  potong foto produk dari brosur PDF
  foto-lokal.ts     foto, galeri & logo watermark di IndexedDB browser;  PengaturanWatermark.tsx  aktif / ganti logo
```

FOTO PERANGKAT HANYA DI BROWSER: tidak pernah diunggah ke Supabase / Vercel (hemat egress). Draf di
localStorage disimpan lewat `tanpaFoto()`, foto terpisah di IndexedDB. Fitur simpan ke server nanti
WAJIB memakai `tanpaFoto()` - dijaga uji/sld.ts.

## av/ — Kalkulator AV

`KalkulatorLayar`, `KalkulatorProyektor`, `KalkulatorSinyal`, `KalkulatorAudio`, `KalkulatorDaya`
(satu berkas per kalkulator) + `lembar.ts` (lembar cetak bersama).

## Pola yang dipakai semua alat

1. **Kerangka** (`Desain3D.tsx`, `KalkulatorLED.tsx`) hanya memanggil hook lalu menyusun panel.
2. **Keadaan** di satu hook (`useKeadaanDesain`, `useKeadaanLED`) — satu sumber kebenaran.
3. **Aturan & hitungan murni** (tanpa React) di `inti/`, `data.ts`, atau `lib/av/hitung.ts` — diuji.
4. **Panel** menerima satu objek `a` (keadaan + hook) dan hanya membongkar yang dipakainya.
5. Batas ukuran berkas ±300 baris; lebih dari itu dipecah per kelompok.
