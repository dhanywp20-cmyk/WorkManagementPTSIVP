import { rasioDinding } from './dinding';
import { LABEL_GARIS } from './gaya';
import { lebarTeks } from './teks';
import type { DokSLD, GeoGaris, GeoKabel, Kabel, Perangkat, Sisi, Titik, Ujung } from './tipe';

export interface Kotak { x: number; y: number; w: number; h: number }

export function kodeKabel(kabel: Kabel[]): Map<string, string> {
  const m = new Map<string, string>();
  let k = 0, p = 0;
  for (const c of kabel) m.set(c.id, c.daya ? `P${++p}` : `K${++k}`);
  return m;
}

export const tergambar = (c: Kabel, peta: Map<string, Perangkat>) =>
  peta.has(c.dari.p) && (peta.has(c.ke.p) || c.cabang.some(u => peta.has(u.p)));

const pusat = (b: Kotak): Titik => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export const rasioPerangkat = (p: Perangkat) => (p.gambar || p.foto ? (p.rasio ?? p.w / p.h) : (rasioDinding(p.ikon, p) ?? 1.6));

function muat(k: Kotak, r: number): Kotak {
  if (k.w / k.h > r) { const w = k.h * r; return { x: k.x + (k.w - w) / 2, y: k.y, w, h: k.h }; }
  const h = k.w / r;
  return { x: k.x, y: k.y + (k.h - h) / 2, w: k.w, h };
}

export const sudutSah = (v: unknown) => { const a = Number(v); return Number.isFinite(a) ? ((Math.round(a) % 360) + 360) % 360 : 0; };

export function kotakPutar(k: Kotak, r: number, sudut = 0): { kotak: Kotak; cx: number; cy: number; w: number; h: number } {
  const a = (sudutSah(sudut) * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const kotak = muat(k, (r * c + s) / (r * s + c));
  const w = kotak.w / (c + s / r);
  return { kotak, cx: kotak.x + kotak.w / 2, cy: kotak.y + kotak.h / 2, w, h: w / r };
}

export const kotakTampak = (p: Perangkat): Kotak => kotakPutar(p, rasioPerangkat(p), p.putar).kotak;

export const hurufPerangkat = (p: Pick<Perangkat, 'huruf'>, d: Pick<DokSLD, 'huruf'>) => p.huruf ?? d.huruf?.perangkat ?? 1;
export const hurufKabel = (c: Pick<Kabel, 'huruf'>, d: Pick<DokSLD, 'huruf'>) => c.huruf ?? d.huruf?.kabel ?? 1;
const datar = (s: Sisi) => s === 'kiri' || s === 'kanan';

export function sisiOtomatis(a: Kotak, b: Kotak): Sisi {
  const pa = pusat(a), pb = pusat(b);
  const dx = pb.x - pa.x, dy = pb.y - pa.y;
  const celahX = Math.abs(dx) - (a.w + b.w) / 2, celahY = Math.abs(dy) - (a.h + b.h) / 2;
  if (celahX >= celahY) return dx >= 0 ? 'kanan' : 'kiri';
  return dy >= 0 ? 'bawah' : 'atas';
}

interface Sambung { kabel: string; peran: string; p: string; sisi: Sisi; urut: number }

function titikSisi(b: Kotak, sisi: Sisi, ke: number, dari: number): Titik {
  const geser = dari > 1 ? (ke - (dari - 1) / 2) * Math.min(5, (datar(sisi) ? b.h : b.w) * 0.7 / (dari - 1)) : 0;
  if (sisi === 'kiri') return { x: b.x, y: b.y + b.h / 2 + geser };
  if (sisi === 'kanan') return { x: b.x + b.w, y: b.y + b.h / 2 + geser };
  if (sisi === 'atas') return { x: b.x + b.w / 2 + geser, y: b.y };
  return { x: b.x + b.w / 2 + geser, y: b.y + b.h };
}

function rute(a: Titik, sa: Sisi, b: Titik, sb: Sisi, tengah?: number): Titik[] {
  if (datar(sa) && datar(sb)) {
    if (Math.abs(a.y - b.y) < 0.3 && sa !== sb) return [a, b];
    const mx = tengah ?? (sa === sb ? (sa === 'kanan' ? Math.max(a.x, b.x) + 8 : Math.min(a.x, b.x) - 8) : (a.x + b.x) / 2);
    return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
  }
  if (!datar(sa) && !datar(sb)) {
    if (Math.abs(a.x - b.x) < 0.3 && sa !== sb) return [a, b];
    const my = tengah ?? (sa === sb ? (sa === 'bawah' ? Math.max(a.y, b.y) + 8 : Math.min(a.y, b.y) - 8) : (a.y + b.y) / 2);
    return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
  }
  return datar(sa) ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b];
}

export function teksLabel(c: Kabel, kode: string) {
  const isi = (c.teksGaris || c.media).trim();
  return isi ? `${kode} · ${isi}` : kode;
}

function letakLabel(titik: Titik[], lebar: number, balik: boolean, f = 1): Titik {
  let terbaik = 0, panjang = -1;
  for (let i = 0; i < titik.length - 1; i++) {
    const l = Math.hypot(titik[i + 1].x - titik[i].x, titik[i + 1].y - titik[i].y);
    if (l > panjang + 0.01) { panjang = l; terbaik = i; }
  }
  const a = titik[terbaik], b = titik[terbaik + 1] ?? a;
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (Math.abs(a.y - b.y) < 0.01) return { x: m.x, y: m.y + (balik ? LABEL_GARIS.jarakH * f : -LABEL_GARIS.jarakH * f) };
  const d = LABEL_GARIS.jarakV * f + lebar / 2;
  return { x: m.x + (balik ? -d : d), y: m.y };
}

export function geometri(d: DokSLD): GeoKabel[] {
  const peta = new Map(d.perangkat.map(p => [p.id, p]));
  const kotak = new Map(d.perangkat.map(p => [p.id, kotakTampak(p)]));
  const kode = kodeKabel(d.kabel);
  const sambung: Sambung[] = [];
  const tujuan = (c: Kabel) => [c.ke, ...c.cabang].filter(u => peta.has(u.p));
  const sisiDari = (c: Kabel, u: Ujung, lain: Ujung) =>
    (u.sisi !== 'auto' ? u.sisi : sisiOtomatis(kotak.get(u.p)!, kotak.get(lain.p)!));

  for (const c of d.kabel) {
    if (!tergambar(c, peta)) continue;
    const t = tujuan(c);
    sambung.push({ kabel: c.id, peran: 'dari', p: c.dari.p, sisi: sisiDari(c, c.dari, t[0]), urut: 0 });
    t.forEach((u, i) => sambung.push({ kabel: c.id, peran: `ke${i}`, p: u.p, sisi: sisiDari(c, u, c.dari), urut: 0 }));
  }
  const sisiKey = (s: Sambung) => `${s.p}|${s.sisi}`;
  const kelompok = new Map<string, Sambung[]>();
  for (const s of sambung) kelompok.set(sisiKey(s), [...(kelompok.get(sisiKey(s)) ?? []), s]);
  const posisi = new Map<string, Titik>();
  const pusatLain = (s: Sambung) => {
    const c = d.kabel.find(k => k.id === s.kabel)!;
    const lain = s.peran === 'dari' ? tujuan(c)[0] : c.dari;
    return pusat(kotak.get(lain.p)!);
  };
  for (const daftar of kelompok.values()) {
    const sisi = daftar[0].sisi, b = kotak.get(daftar[0].p)!;
    const urut = [...new Map(daftar.map(s => [`${s.kabel}|${s.peran === 'dari' ? 'dari' : 'ke'}`, s])).values()]
      .sort((x, y) => (datar(sisi) ? pusatLain(x).y - pusatLain(y).y : pusatLain(x).x - pusatLain(y).x));
    const idx = new Map(urut.map((s, i) => [`${s.kabel}|${s.peran === 'dari' ? 'dari' : 'ke'}`, i]));
    for (const s of daftar) posisi.set(`${s.kabel}|${s.peran}`, titikSisi(b, sisi, idx.get(`${s.kabel}|${s.peran === 'dari' ? 'dari' : 'ke'}`)!, urut.length));
  }
  const sisiDariPeta = new Map(sambung.map(s => [`${s.kabel}|${s.peran}`, s.sisi]));

  const hasil: GeoKabel[] = [];
  for (const c of d.kabel) {
    if (!tergambar(c, peta)) continue;
    const a = posisi.get(`${c.id}|dari`)!, sa = sisiDariPeta.get(`${c.id}|dari`)!;
    const tengahBersama = c.tengah ?? tengahUtama(a, sa, posisi.get(`${c.id}|ke0`)!, sisiDariPeta.get(`${c.id}|ke0`)!);
    const garisList: GeoGaris[] = tujuan(c).map((_, i) => {
      const b = posisi.get(`${c.id}|ke${i}`)!, sb = sisiDariPeta.get(`${c.id}|ke${i}`)!;
      return { titik: rute(a, sa, b, sb, i === 0 ? c.tengah : tengahBersama), awal: i === 0 };
    });
    const k = kode.get(c.id)!;
    const f = hurufKabel(c, d), lebar = lebarTeks(teksLabel(c, k), LABEL_GARIS.ukuran * f, true) + 1.2 * f;
    hasil.push({ id: c.id, kode: k, garis: garisList, label: letakLabel(garisList[0].titik, lebar, c.labelBalik, f), lebarLabel: lebar, huruf: f });
  }
  return hasil;
}

function tengahUtama(a: Titik, sa: Sisi, b: Titik, sb: Sisi): number | undefined {
  const r = rute(a, sa, b, sb);
  if (r.length !== 4) return undefined;
  return datar(sa) ? r[1].x : r[1].y;
}

export { pusat, datar };
