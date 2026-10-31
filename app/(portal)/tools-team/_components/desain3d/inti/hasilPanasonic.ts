/**
 * desain3d/inti/hasilPanasonic.ts - Angka proyektor PERSIS cara hasil Panasonic Throw Distance Calculator (TDC):
 *   Projection size     : rasio sinyal, diagonal, tinggi, lebar      (L = TR x lebar - b, TR & b posisi zoom sekarang)
 *   Projection distance : L ujung lensa -> layar / bidang & rentang L zoom terlebar..terpanjang untuk gambar sebesar ini
 *   Lens shift          : VS atas / bawah & HS (m) = batas daerah lensa x tinggi / lebar gambar
 *   Brightness          : Projector output = lumen x bagian panel (16:9 di panel 16:10 = 90%),
 *                         Screen illuminance = output / (lebar x tinggi)
 * SATU sumber untuk panel Atur, keterangan sinar di kanvas & ekspor. Dulu kanvas memakai jarak MIRING lensa ke pusat
 * gambar (3,12 m pada lens shift 50%) sementara panel memakai jarak sumbu (3 m), lux dihitung dari lumen panel penuh -
 * tiga tempat, tiga angka. Murni (diuji di uji/proyektor-tdc-panasonic.ts).
 */
import { jarakProyeksi } from './jarakProyeksi';
import {
  bagianPanel, batasShift, jarakUntukLebar, koreksiJarakDari, lebarGambarDi, lumenDari, lumenGambarDari, rasioGambarProyektor,
  rasioPanelDari, throwRatioDari,
} from './proyektor';
import type { Benda, RasioProyektor, Ruang } from './tipe';

export interface HasilPanasonic {
  /** Projection distance L (m) dari ujung lensa; null = sumbu lensa tidak mengenai permukaan apa pun. */ L: number | null;
  /** Layar / bidang yang dituju (null = dinding / lantai ruang). */ sasaran: Benda | null;
  /** 'tegak' = tegak lurus bidang datar (L Panasonic); 'sumbu' = sepanjang sumbu lensa (bidang lengkung / dinding). */ cara: 'tegak' | 'sumbu';
  /** Rasio sinyal & rasio panel native. */ rasio: RasioProyektor; panel: RasioProyektor;
  lebar: number; tinggi: number; diagonalM: number; diagonalInci: number;
  /** Throw ratio & koreksi b posisi zoom sekarang. */ tr: number; b: number;
  /** "L: 3.000–4.850 m" - jarak zoom terlebar & terpanjang untuk ukuran gambar ini. */ rentangL: [number, number];
  /** Lens shift maksimal (m) - VS atas, VS bawah, HS kiri-kanan. null = tidak dibatasi / tidak diisi. */
  vsAtas: number | null; vsBawah: number | null; hs: number | null;
  /** Lumen panel penuh (datasheet) & "Projector output" (lumen yang jatuh di gambar). */ lumen: number; lumenGambar: number;
  /** "Screen illuminance" (lux) di gambar; null tanpa L. */ lux: number | null;
}

/** Hasil kalkulator Panasonic untuk proyektor `p` di posisinya sekarang. */
export function hasilPanasonic(p: Benda, semua: Benda[], ruang: Ruang | null): HasilPanasonic {
  const jp = jarakProyeksi(p, semua, ruang);
  return { ...hasilPadaJarak(p, jp.jarak), sasaran: jp.sasaran, cara: jp.cara };
}

/** Hasil kalkulator Panasonic bila lensa berjarak `L` (m) dari layar - tanpa posisi di ruang. */
export function hasilPadaJarak(p: Benda, L: number | null): Omit<HasilPanasonic, 'sasaran' | 'cara'> {
  const tr = throwRatioDari(p), b = koreksiJarakDari(p, tr);
  const lebar = L !== null ? lebarGambarDi(p, L, tr) : 0, tinggi = lebar * rasioGambarProyektor(p);
  const diagonalM = Math.hypot(lebar, tinggi);
  const bs = batasShift(p);
  const lumenGambar = lumenGambarDari(p);
  return {
    L, rasio: p.rasioProyektor ?? '16:9', panel: rasioPanelDari(p), lebar, tinggi, diagonalM, diagonalInci: diagonalM / 0.0254, tr, b,
    rentangL: lebar > 0 ? jarakUntukLebar(p, lebar) : [0, 0],
    vsAtas: bs.atas === null ? null : bs.atas * tinggi, vsBawah: bs.bawah === null ? null : bs.bawah * tinggi, hs: bs.h === null ? null : bs.h * lebar,
    lumen: lumenDari(p), lumenGambar, lux: L !== null && lebar > 0 ? lumenGambar / (lebar * tinggi) : null,
  };
}

/** Teks bagian panel yang dipakai, mis. "letterbox 90% panel 16:10" - null bila rasio sinyal = rasio panel. */
export function keteranganPanel(p: Benda): string | null {
  const bp = bagianPanel(p), panel = rasioPanelDari(p);
  if (bp.lebar > 0.9999 && bp.tinggi > 0.9999) return null;
  return bp.lebar > 0.9999
    ? `letterbox: tinggi ${Math.round(bp.tinggi * 1000) / 10}% panel ${panel}`
    : `pillarbox: lebar ${Math.round(bp.lebar * 1000) / 10}% panel ${panel}`;
}
