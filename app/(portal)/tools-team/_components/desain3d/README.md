# Desain 3D Ruang AV — arsitektur kode

Lihat juga `../README.md` (struktur seluruh Tools Team).

`../Desain3D.tsx` hanya **kerangka** (±140 baris): memanggil hook per kelompok engine lalu
menyusun panel. Logika ada di folder-folder di bawah, dipisah menurut tanggung jawab —
dari yang paling murni (tanpa three.js / React) ke yang paling dekat ke layar.

```
desain3d/
  inti/      data & aturan murni — TANPA three.js / React / DOM (diuji di uji/*.ts)
  bangun/    geometri three.js prosedural (model tiap benda, ruangan, tekstur)
  mesin/     engine kanvas: renderer, kamera, adegan, alat bantu, label
  impor/     objek dari luar: berkas 3D (glTF/OBJ/FBX/DAE/STL/...), siluet dari gambar
  aksi/      aksi edit desain (template, tambah, salin, tempel, ruang & bukaan)
  simpan/    simpan & buka: server tim, laptop (.glb), produk tim
  ekspor/    foto kanvas, PNG, lembar cetak A4
  panel/     komponen React (bilah, panel samping, kartu hasil, modal)
  useKeadaanDesain.ts   seluruh state + nilai turunan (satu sumber kebenaran)
```

Arah ketergantungan **satu arah**: `panel → (aksi, simpan, ekspor, mesin) → bangun → inti`.
`inti/` tidak pernah mengimpor dari folder lain (kecuali tipe `impor/kontur`, `impor/berkas3d`).

## inti/ — data & aturan (murni)

| Berkas | Isi |
|---|---|
| `tipe.ts` | `Benda`, `Ruang`, `Jenis`, label, konstanta pemasangan, `warnaSah` |
| `ruang.ts` | ruang bersambung, sekat, pintu & jendela, salin / petakan / pusatkan isi |
| `produk.ts` | spesifikasi & ukuran produk dari datasheet (videowall, IFP, layar, TV, rack, tribun, bidang) |
| `katalog.ts` | katalog "Tambah", `bendaBaru`, set ruang kelas, `tandaBentuk`, `tinggiAlasDi` |
| `cahaya.ts` | lampu, lux langsung + pantul, cahaya siang, kontras proyektor |
| `audio.ts` | speaker, line array, cakupan speaker plafon |
| `proyektor.ts` | lensa (throw ratio, zoom, lens shift), arah, sinar ke layar |
| `blending.ts` | area blending antar proyektor: lebar (cm) menyusuri permukaan & persen gambar |
| `kabel.ts` | jalur & panjang kabel ke rack, **legend warna standar** |
| `rak.ts` | isi rack (elevation) |
| `template.ts` | template kategori ruangan (terkunci — selalu dibuat ulang dari kode) |
| `index.ts` | barrel: `import { ... } from '../inti'` |

## bangun/ — geometri three.js

`index.ts` berisi `buatModel` sebagai **tabel pembangun per jenis** (`PEMBANGUN: Record<Jenis, …>`),
bukan `switch` raksasa. Menambah jenis benda baru = satu fungsi `bangunXxx` di kelompoknya +
satu baris di tabel (TypeScript menolak bila ada jenis yang terlewat).

| Berkas | Isi |
|---|---|
| `dasar.ts` | primitif bersama (kotak, papan, pipa, batang, ekstrusi) & `Konteks` pembangun |
| `display.ts` | videowall, TV / signage, IFP, LED, layar, proyektor + bracket / hollow / standfloor |
| `audio.ts` | speaker (dinding, kolom, line array, plafon), mic, touch panel, rack |
| `konferensi.ts` | kamera, paperless lift |
| `furnitur.ts` | meja (7 bentuk), kursi |
| `lampu.ts` | lampu plafon |
| `venue.ts` | tribun, panggung |
| `mapping.ts` | bidang mapping, objek mapping (bentuk dasar & siluet), model 3D impor |
| `ruangan.ts` | lantai & dinding tiap ruang, sekat, pintu & jendela |
| `permukaan.ts` | tekstur bahan: kayu, kain, gril speaker, logam berlubang, dinding aksen |
| `tekstur.ts` / `konten.ts` / `rak.ts` | tekstur kanvas: lantai & lampu · konten layar (pola, CCTV, dashboard, home screen) · muka perangkat rack |

## mesin/ — engine kanvas

| Berkas | Isi |
|---|---|
| `useMesin.ts` | renderer, adegan, lampu, OrbitControls, gizmo, klik-pilih, putaran render |
| `useKamera.ts` + `kamera.ts` | arah pandang, pas ruangan, zoom, putar, fokus benda / kursi |
| `useAdegan.ts` | efek: ruangan, benda (bangun ulang hanya yang berubah), gizmo, cahaya |
| `alatBantu.ts` | label ukuran & produk, kerucut pandang, jangkauan speaker, kabel |
| `sinar.ts` | sinar proyektor: grid raycast ke bidang, tepi bayangan benda dipecah halus, nama di proyektor |
| `cahayaBenda.ts` | cahaya proyektor di benda per titik permukaan (masuk bingkai, menghadap lensa, tidak terhalang) |
| `teksCahaya.ts` | tulisan hitam kecil tercetak di cahaya: nama, jarak lensa → bidang, ukuran gambar, lux pusat & pojok |
| `bayangan.ts` | bayangan lembut & pendar cahaya layar |
| `blending.ts` | zona ungu area blending (raycast keterhalangan) |
| `ukurBlending.ts` | garis ukur berpanah + kaki ukur, angka cm, garis penunjuk & kartu keterangan blending |
| `garisUkurDisplay.ts` | garis ukuran display merah (lebar & tinggi, mm) |
| `gambarKabel.ts` | jalur kabel sebagai tabung berwarna (InstancedMesh per warna) |
| `label.ts` | label CSS2D: anti-tumpuk & gambar ke foto |
| `tipe.ts` | tipe `Mesin`, arah kamera standar |

## Alur data

```
useKeadaanDesain()  ── K ──►  useMesin(K) · useKamera(K) · useAdegan(K)
                              useAksiDesain(K) · useProdukTim(K) · useEkspor(K, kamera) · useSimpanDesain(K)
                                          │
                     a = { K, kamera, aksi, produk, ekspor, simpan }  (panel/alat.ts)
                                          ▼
                     <BilahAlat a /> <KontrolKanvas a /> <PanelTambah a /> <KartuKabel a /> ...
```

## Aturan menjaga kerapian

- **Batas ukuran**: satu berkas sebaiknya ≤ ±300 baris. Lebih dari itu → pecah per kelompok.
- **Aturan / hitungan** (ukuran, jarak, lux, kabel) ditulis di `inti/` sebagai fungsi murni dan diuji
  di `uji/desain3d.ts` / `uji/objek-mapping.ts` — bukan di komponen.
- **Geometri** hanya di `bangun/`; **efek three.js** hanya di `mesin/`; **JSX** hanya di `panel/`.
- State baru ditambahkan di `useKeadaanDesain.ts`, lalu dibongkar di hook / panel yang memakainya.
