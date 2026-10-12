/** av-hitung-daya.ts - dipecah dari av-hitung.ts (scripts/pecah-modul.mjs); av-hitung.ts tetap mengekspor ulang semuanya. */
import { HasilKoneksi, SelRC, SudutMulai, hitungKoneksi } from './av-hitung-koneksi';
import { MCB_STANDAR } from './av-hitung-led';

// ── Power connection LED (sirkuit listrik per MCB & fase) ──────────────────

export const FASE = ['R', 'S', 'T'] as const;

export interface OpsiDayaLED {
  /** Susunan unit (modul/cabinet). */ kolom: number; baris: number;
  /** W maks per unit. */ wattUnit: number;
  tegangan: number; faktorDaya: number;
  /** Rating MCB tiap sirkuit (A). */ mcb: number;
  /** Beban maksimal tiap sirkuit terhadap MCB (%), bawaan 80 (beban kontinu). */ beban: number;
  fase: 1 | 3;
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z';
  kosong?: SelRC[];
}

export interface SirkuitLED { no: number; unit: number; watt: number; arus: number; fase: string; mulai: { c: number; r: number } | null }

export interface HasilDayaLED {
  /** Urutan kabel power (format sama dengan screen connection: "port" = sirkuit). */ hasil: HasilKoneksi;
  sirkuit: SirkuitLED[];
  perFase: { fase: string; watt: number; arus: number; sirkuit: number; mcb: number }[];
  /** W yang boleh per sirkuit. */ kapasitasW: number; unitPerSirkuitMaks: number;
  totalW: number; galat: string | null;
}

/**
 * Pembagian kabel power LED ke sirkuit MCB. Satu sirkuit = satu rantai kabel power
 * (unit disambung berurutan seperti kabel data). Batas tiap sirkuit = MCB × V × PF × beban%.
 * Pada 3 fase, sirkuit dibagi ke R/S/T supaya beban tiap fase seimbang.
 */
/** Satu garis (kolom/baris) lebih besar dari kapasitas sirkuit -> garis dipecah (pakai hasil zona biasa). */
const galatGaris = (garis: unknown[][], w: number, kap: number) => garis.some(g => g.length * w > kap + 1e-6);

export function hitungDayaLED(o: OpsiDayaLED): HasilDayaLED {
  const pf = Math.min(1, Math.max(0.5, o.faktorDaya || 1));
  const V = Math.max(1, o.tegangan);
  const penuhW = Math.max(1, o.mcb) * V * pf;
  const batasPersen = Math.max(10, Math.min(100, o.beban || 80));
  const kapasitasW = penuhW * (batasPersen / 100);
  const w = Math.max(0.1, o.wattUnit);
  const dasar = { kolom: o.kolom, baris: o.baris, pxPerRC: w, kosong: o.kosong, mulai: o.mulai, arah: o.arah, pola: o.pola, bagi: 'baris' as const };
  let hasil = hitungKoneksi({ ...dasar, pxPerPort: penuhW, bebanMaks: batasPersen });
  //  Sirkuit dibuat rata: garis (kolom/baris) dibagi seimbang ke jumlah sirkuit minimum - bukan
  //  sirkuit penuh + sisa kecil. 3 fase: dibulatkan ke kelipatan 3 supaya R/S/T seimbang.
  const nMin = hasil.port.length;
  const urut = hitungKoneksi({ ...dasar, pola: 'Z', pxPerPort: 1e15 }).sel;
  const garis: { c: number; r: number }[][] = [];
  let kunciAkhir = -1;
  for (const x of urut) {
    const k = o.arah === 'horizontal' ? x.r : x.c;
    if (k !== kunciAkhir) { garis.push([]); kunciAkhir = k; }
    garis[garis.length - 1].push({ c: x.c, r: x.r });
  }
  const target = Math.min(garis.length, o.fase === 3 && nMin % 3 ? Math.ceil(nMin / 3) * 3 : nMin);
  if (nMin > 0 && target > 0 && w <= kapasitasW && !galatGaris(garis, w, kapasitasW)) {
    const total = urut.length * w, per = total / target;
    const grup: { c: number; r: number }[][][] = Array.from({ length: target }, () => []);
    let kum = 0;
    for (const g of garis) {
      const gw = g.length * w;
      grup[Math.min(target - 1, Math.floor((kum + gw / 2) / per))].push(g);
      kum += gw;
    }
    const isi = grup.filter(x => x.length);
    if (isi.every(x => x.reduce((a, g) => a + g.length, 0) * w <= kapasitasW + 1e-6)) {
      const manual = isi.map(x => x.flatMap((g, k) => (o.pola === 'Z' || k % 2 === 0 ? g : [...g].reverse()).map(s => [s.c, s.r] as SelRC)));
      hasil = hitungKoneksi({ ...dasar, pxPerPort: penuhW, bebanMaks: batasPersen, manual });
    }
  }
  const galat = w > kapasitasW ? `Satu unit (${Math.round(w)} W) melebihi kapasitas satu sirkuit (${Math.round(kapasitasW)} W) - naikkan rating MCB.` : null;
  const nFase = o.fase === 3 ? 3 : 1;
  const beban = Array.from({ length: nFase }, () => ({ watt: 0, sirkuit: 0 }));
  const sirkuit: SirkuitLED[] = hasil.port.map(p => {
    //  Fase dengan beban paling kecil (seri: urutan R, S, T) supaya seimbang dan tetap berurutan.
    let fi = 0;
    for (let i = 1; i < nFase; i++) if (beban[i].watt < beban[fi].watt - 1e-6) fi = i;
    beban[fi].watt += p.px; beban[fi].sirkuit++;
    return { no: p.port, unit: p.jumlah, watt: p.px, arus: p.px / (V * pf), fase: nFase === 1 ? 'L' : FASE[fi], mulai: p.mulai };
  });
  const perFase = beban.map((b, i) => {
    const arus = b.watt / (V * pf);
    return { fase: nFase === 1 ? 'L' : FASE[i], watt: b.watt, arus, sirkuit: b.sirkuit,
      mcb: MCB_STANDAR.find(r => r >= arus * 1.25) ?? Math.ceil((arus * 1.25) / 10) * 10 };
  });
  return {
    hasil, sirkuit, perFase, kapasitasW, unitPerSirkuitMaks: Math.max(1, Math.floor(kapasitasW / w)),
    totalW: sirkuit.reduce((a, s) => a + s.watt, 0), galat,
  };
}
