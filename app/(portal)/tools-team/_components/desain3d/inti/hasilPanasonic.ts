import { jarakProyeksi } from './jarakProyeksi';
import {
  bagianPanel, batasShift, jarakUntukLebar, koreksiJarakDari, lebarGambarDi, lumenDari, lumenGambarDari, rasioGambarProyektor,
  rasioPanelDari, throwRatioDari,
} from './proyektor';
import type { Benda, RasioProyektor, Ruang } from './tipe';

export interface HasilPanasonic {
   L: number | null;
   sasaran: Benda | null;
   cara: 'tegak' | 'sumbu';
   rasio: RasioProyektor; panel: RasioProyektor;
  lebar: number; tinggi: number; diagonalM: number; diagonalInci: number;
   tr: number; b: number;
   rentangL: [number, number];
  vsAtas: number | null; vsBawah: number | null; hs: number | null;
   lumen: number; lumenGambar: number;
   lux: number | null;
}

export function hasilPanasonic(p: Benda, semua: Benda[], ruang: Ruang | null): HasilPanasonic {
  const jp = jarakProyeksi(p, semua, ruang);
  return { ...hasilPadaJarak(p, jp.jarak), sasaran: jp.sasaran, cara: jp.cara };
}

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

export function keteranganPanel(p: Benda): string | null {
  const bp = bagianPanel(p), panel = rasioPanelDari(p);
  if (bp.lebar > 0.9999 && bp.tinggi > 0.9999) return null;
  return bp.lebar > 0.9999
    ? `letterbox: tinggi ${Math.round(bp.tinggi * 1000) / 10}% panel ${panel}`
    : `pillarbox: lebar ${Math.round(bp.lebar * 1000) / 10}% panel ${panel}`;
}
