/**
 * Tempat teks baru yang tidak tertutup benda lain. Teks dinding digeser sepanjang dinding depan (lalu
 * dinaikkan di atas benda dinding bila dinding penuh); teks lantai dicari di lantai kosong terdekat dari
 * tengah ruang. Teks melayang tidak dipindah (di atas kepala, selalu menghadap kamera).
 * Murni (diuji di uji/desain3d-teks.ts).
 */
import { tapak } from './tata';
import type { Benda } from './tipe';

/** Kotak satu ruang (sama dengan inti/ruang daftarRuang). */
export interface KotakTeks { x0: number; p: number; l: number; t: number }

/** Jarak bebas di depan teks dinding (m): benda di dalamnya setinggi teks dianggap menutupi. */
const DEPAN_DINDING = 0.6;
const CELAH = 0.05, TEPI_RUANG = 0.1;
/** Benda setinggi ini ke atas (speaker plafon, proyektor) tidak menutupi teks lantai. */
const ATAS_KEPALA = 2;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const tumpang = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 + CELAH && a1 > b0 - CELAH;

/** Pusat lalu bergantian kiri-kanan menjauh, hanya yang masih di dalam [min, max]. */
function urutDariPusat(pusat: number, langkah: number, min: number, maks: number): number[] {
  const hasil: number[] = [];
  const n = Math.ceil((maks - min) / langkah) + 1;
  for (let i = 0; i <= n; i++) for (const v of i ? [pusat - i * langkah, pusat + i * langkah] : [pusat]) if (v >= min && v <= maks) hasil.push(v);
  return hasil;
}

export function tempatTeksBebas(b: Benda, lain: Benda[], k: KotakTeks): Pick<Benda, 'x' | 'z' | 'elev'> {
  const awal = { x: b.x, z: b.z, elev: b.elev };
  if (b.jenis !== 'teks' || (b.hadapTeks ?? 'berdiri') === 'kamera') return awal;
  const diRuang = lain.filter(o => o.id !== b.id && o.x >= k.x0 && o.x <= k.x0 + k.p).map(o => ({ o, t: tapak(o) }));
  const xMin = k.x0 + b.w / 2 + TEPI_RUANG, xMaks = k.x0 + k.p - b.w / 2 - TEPI_RUANG;
  if (xMin > xMaks) return awal;

  if (b.hadapTeks === 'lantai') {
    const zMin = b.d / 2 + TEPI_RUANG, zMaks = k.l - b.d / 2 - TEPI_RUANG;
    if (zMin > zMaks) return awal;
    const langkah = Math.max(0.25, Math.max(k.p, k.l) / 60);
    const tertutup = (x: number, z: number) => diRuang.some(({ o, t }) => o.elev < ATAS_KEPALA
      && tumpang(x - b.w / 2, x + b.w / 2, t.x0, t.x1) && tumpang(z - b.d / 2, z + b.d / 2, t.z0, t.z1));
    const pusatX = k.x0 + k.p / 2, pusatZ = k.l / 2;
    const calon = urutDariPusat(pusatX, langkah, xMin, xMaks)
      .flatMap(x => urutDariPusat(pusatZ, langkah, zMin, zMaks).map(z => ({ x, z, jauh: Math.hypot(x - pusatX, z - pusatZ) })))
      .sort((a, c) => a.jauh - c.jauh);
    const bebas = calon.find(c => !tertutup(c.x, c.z));
    return bebas ? { x: r3(bebas.x), z: r3(bebas.z), elev: b.elev } : awal;
  }

  //  Teks dinding (dinding depan, z ~ 0).
  const tertutup = (x: number, elev: number) => diRuang.some(({ o, t }) => t.z0 < DEPAN_DINDING
    && tumpang(x - b.w / 2, x + b.w / 2, t.x0, t.x1) && tumpang(elev, elev + b.h, o.elev, o.elev + o.h));
  const x = urutDariPusat(b.x, 0.25, xMin, xMaks).find(v => !tertutup(v, b.elev));
  if (x !== undefined) return { x: r3(x), z: b.z, elev: b.elev };
  //  Dinding penuh setinggi mata: di atas benda dinding tertinggi di tengah, bila masih di bawah plafon.
  const puncak = Math.max(0, ...diRuang.filter(({ t }) => t.z0 < DEPAN_DINDING && tumpang(b.x - b.w / 2, b.x + b.w / 2, t.x0, t.x1)).map(({ o }) => o.elev + o.h));
  const naik = puncak + 0.1;
  return naik + b.h <= k.t - CELAH ? { x: b.x, z: b.z, elev: r3(naik) } : awal;
}
