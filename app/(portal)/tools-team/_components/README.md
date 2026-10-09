# Tools Team — struktur kode

Menu **Tools Team** (`app/tools-team/page.tsx`) berisi tiga alat. Tiap alat punya satu berkas
**kerangka** kecil di folder ini dan satu **folder kelompok** berisi logikanya.

```
_components/
  Desain3D.tsx       kerangka Desain 3D Ruang AV        → desain3d/  (lihat desain3d/README.md)
  KalkulatorLED.tsx  kerangka LED Videotron             → led/
  KalkulatorAV.tsx   kerangka Kalkulator AV (5 sub)     → av/
  bersama/           dipakai semua alat: ui.tsx (isian, kartu, nilai), cetak.ts (lembar A4 & PNG),
                     riwayat.ts (undo / redo)
```

Rumus murni yang dipakai lintas modul (ukuran layar, lumen, bandwidth, SPL, hitung LED,
koneksi & daya LED) ada di `lib/av-hitung.ts` dan diuji di `uji/av-hitung.ts`.

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

## av/ — Kalkulator AV

`KalkulatorLayar`, `KalkulatorProyektor`, `KalkulatorSinyal`, `KalkulatorAudio`, `KalkulatorDaya`
(satu berkas per kalkulator) + `lembar.ts` (lembar cetak bersama).

## Pola yang dipakai semua alat

1. **Kerangka** (`Desain3D.tsx`, `KalkulatorLED.tsx`) hanya memanggil hook lalu menyusun panel.
2. **Keadaan** di satu hook (`useKeadaanDesain`, `useKeadaanLED`) — satu sumber kebenaran.
3. **Aturan & hitungan murni** (tanpa React) di `inti/`, `data.ts`, atau `lib/av-hitung.ts` — diuji.
4. **Panel** menerima satu objek `a` (keadaan + hook) dan hanya membongkar yang dipakainya.
5. Batas ukuran berkas ±300 baris; lebih dari itu dipecah per kelompok.
