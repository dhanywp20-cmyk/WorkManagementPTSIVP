import { hapusPerangkat, idBaru } from './dok';
import { kotakTampak, type Kotak } from './geometri';
import { kotakTeks } from './teks-bebas';
import type { DokSLD, Kabel, Perangkat, TeksBebas, Titik, ZonaSLD } from './tipe';

export interface Klip { perangkat: Perangkat[]; kabel: Kabel[]; teks: TeksBebas[]; zona: ZonaSLD[] }
export type Rata = 'kiri' | 'tengahH' | 'kanan' | 'atas' | 'tengahV' | 'bawah' | 'sebarH' | 'sebarV';

export const kotakDari = (a: Titik, b: Titik): Kotak => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
const potong = (a: Kotak, b: Kotak) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const di = (a: Kotak, b: Kotak) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

export function idDalamKotak(d: DokSLD, m: Kotak): string[] {
  return [
    ...d.perangkat.filter(p => potong(kotakTampak(p), m)).map(p => p.id),
    ...d.teks.filter(t => potong(kotakTeks(t), m)).map(t => t.id),
    ...(d.zona ?? []).filter(z => di(z, m)).map(z => z.id),
  ];
}

const kunciJalur = (id: string, i: number) => `jalur:${id}:${i}`;

export const posisiAwal = (d: DokSLD, ids: string[]) => {
  const s = new Set(ids), hasil = new Map<string, Titik>();
  for (const o of [...d.perangkat, ...d.teks, ...(d.zona ?? [])]) if (s.has(o.id)) hasil.set(o.id, { x: o.x, y: o.y });
  for (const c of d.kabel) if (c.jalur && s.has(c.dari.p) && s.has(c.ke.p)) c.jalur.forEach((t, i) => hasil.set(kunciJalur(c.id, i), t));
  return hasil;
};

export function geserObjek(d: DokSLD, awal: Map<string, Titik>, dx: number, dy: number): DokSLD {
  const geser = <T extends { id: string; x: number; y: number }>(o: T): T => {
    const a = awal.get(o.id);
    return a ? { ...o, x: Math.round((a.x + dx) * 2) / 2, y: Math.round((a.y + dy) * 2) / 2 } : o;
  };
  const kabel = d.kabel.some(c => c.jalur && awal.has(kunciJalur(c.id, 0)))
    ? d.kabel.map(c => (c.jalur && awal.has(kunciJalur(c.id, 0))
      ? { ...c, jalur: c.jalur.map((t, i) => { const a = awal.get(kunciJalur(c.id, i)); return a ? { x: Math.round((a.x + dx) * 100) / 100, y: Math.round((a.y + dy) * 100) / 100 } : t; }) }
      : c))
    : d.kabel;
  return { ...d, perangkat: d.perangkat.map(geser), kabel, teks: d.teks.map(geser), ...(d.zona ? { zona: d.zona.map(geser) } : {}) };
}

export function salinObjek(d: DokSLD, ids: string[]): Klip {
  const s = new Set(ids), perangkat = d.perangkat.filter(p => s.has(p.id)), ada = new Set(perangkat.map(p => p.id));
  const kabel = d.kabel.filter(c => ada.has(c.dari.p) && ada.has(c.ke.p)).map(c => ({ ...c, cabang: c.cabang.filter(u => ada.has(u.p)) }));
  return { perangkat, kabel, teks: d.teks.filter(t => s.has(t.id)), zona: (d.zona ?? []).filter(z => s.has(z.id)) };
}

export function tempelKlip(d: DokSLD, k: Klip, geser = 8): { dok: DokSLD; ids: string[] } {
  const peta = new Map(k.perangkat.map(p => [p.id, idBaru('p')]));
  const pindah = <T extends { id: string; x: number; y: number }>(o: T, id: string): T => ({ ...o, id, x: o.x + geser, y: o.y + geser });
  const perangkat = k.perangkat.map(p => pindah(p, peta.get(p.id)!));
  const ganti = <U extends { p: string }>(u: U): U => ({ ...u, p: peta.get(u.p) ?? u.p });
  const kabel = k.kabel.map(c => ({ ...c, id: idBaru('k'), dari: ganti(c.dari), ke: ganti(c.ke), cabang: c.cabang.map(ganti), tengah: undefined,
    ...(c.jalur ? { jalur: c.jalur.map(t => ({ x: t.x + geser, y: t.y + geser })) } : {}) }));
  const teks = k.teks.map(t => pindah(t, idBaru('t'))), zona = k.zona.map(z => pindah(z, idBaru('z')));
  return {
    dok: { ...d, perangkat: [...d.perangkat, ...perangkat], kabel: [...d.kabel, ...kabel], teks: [...d.teks, ...teks], zona: [...(d.zona ?? []), ...zona] },
    ids: [...perangkat, ...teks, ...zona].map(o => o.id),
  };
}

export type Format =
  | { jenis: 'p'; gaya: Pick<Perangkat, 'w' | 'h' | 'huruf' | 'labelDi' | 'lebarLabel'> }
  | { jenis: 't'; gaya: Pick<TeksBebas, 'ukuran' | 'warna' | 'tebal' | 'lebar'> }
  | { jenis: 'z'; gaya: Pick<ZonaSLD, 'warna' | 'huruf' | 'tebal'> }
  | { jenis: 'k'; gaya: Pick<Kabel, 'jenis' | 'duaArah' | 'labelBalik' | 'huruf'> };

export function formatDari(d: DokSLD, id: string): Format | null {
  const p = d.perangkat.find(x => x.id === id);
  if (p) return { jenis: 'p', gaya: { w: p.w, h: p.h, huruf: p.huruf, labelDi: p.labelDi, lebarLabel: p.lebarLabel } };
  const t = d.teks.find(x => x.id === id);
  if (t) return { jenis: 't', gaya: { ukuran: t.ukuran, warna: t.warna, tebal: t.tebal, lebar: t.lebar } };
  const z = (d.zona ?? []).find(x => x.id === id);
  if (z) return { jenis: 'z', gaya: { warna: z.warna, huruf: z.huruf, tebal: z.tebal } };
  const c = d.kabel.find(x => x.id === id);
  if (c) return { jenis: 'k', gaya: { jenis: c.jenis, duaArah: c.duaArah, labelBalik: c.labelBalik, huruf: c.huruf } };
  return null;
}

export function terapkanFormat(d: DokSLD, f: Format, id: string): DokSLD {
  if (f.jenis === 'p') return { ...d, perangkat: d.perangkat.map(p => (p.id === id ? { ...p, ...f.gaya } : p)) };
  if (f.jenis === 't') return { ...d, teks: d.teks.map(t => (t.id === id ? { ...t, ...f.gaya } : t)) };
  if (f.jenis === 'z') return { ...d, zona: (d.zona ?? []).map(z => (z.id === id ? { ...z, ...f.gaya } : z)) };
  return { ...d, kabel: d.kabel.map(c => (c.id === id ? { ...c, ...f.gaya } : c)) };
}

export function urutkan(d: DokSLD, ids: string[], arah: 'depan' | 'belakang'): DokSLD {
  const s = new Set(ids);
  const atur = <T extends { id: string }>(xs: T[]) => {
    const pilih = xs.filter(x => s.has(x.id)), sisa = xs.filter(x => !s.has(x.id));
    return arah === 'depan' ? [...sisa, ...pilih] : [...pilih, ...sisa];
  };
  return { ...d, perangkat: atur(d.perangkat), teks: atur(d.teks), ...(d.zona ? { zona: atur(d.zona) } : {}) };
}

export function samakanUkuran(d: DokSLD, ids: string[], acuan: string | undefined, cara: 'w' | 'h' | 'wh'): DokSLD {
  const ada = new Set(ids);
  const rp = d.perangkat.find(p => p.id === acuan) ?? d.perangkat.find(p => ada.has(p.id));
  const zs = d.zona ?? [], rz = zs.find(z => z.id === acuan) ?? zs.find(z => ada.has(z.id));
  const ukur = <T extends { id: string; w: number; h: number }>(x: T, r?: T) => (!r || x.id === r.id || !ada.has(x.id) ? x
    : { ...x, ...(cara !== 'h' ? { w: r.w } : {}), ...(cara !== 'w' ? { h: r.h } : {}) });
  return { ...d, perangkat: d.perangkat.map(p => ukur(p, rp)), ...(d.zona ? { zona: zs.map(z => ukur(z, rz)) } : {}) };
}

export function hapusObjek(d: DokSLD, ids: string[]): DokSLD {
  const s = new Set(ids);
  let hasil: DokSLD = { ...d, teks: d.teks.filter(t => !s.has(t.id)), zona: (d.zona ?? []).filter(z => !s.has(z.id)), kabel: d.kabel.filter(c => !s.has(c.id)) };
  for (const p of d.perangkat) if (s.has(p.id)) hasil = hapusPerangkat(hasil, p.id);
  return hasil;
}

export function ratakan(d: DokSLD, ids: string[], cara: Rata): DokSLD {
  const daftar = d.perangkat.filter(p => ids.includes(p.id));
  if (daftar.length < 2) return d;
  const k = new Map(daftar.map(p => [p.id, kotakTampak(p)]));
  const ks = [...k.values()], minX = Math.min(...ks.map(b => b.x)), maxX = Math.max(...ks.map(b => b.x + b.w));
  const minY = Math.min(...ks.map(b => b.y)), maxY = Math.max(...ks.map(b => b.y + b.h));
  if (cara === 'sebarH' || cara === 'sebarV') {
    if (daftar.length < 3) return d;
    const h = cara === 'sebarH', urut = [...daftar].sort((p, q) => (h ? k.get(p.id)!.x - k.get(q.id)!.x : k.get(p.id)!.y - k.get(q.id)!.y));
    const total = urut.reduce((n, p) => n + (h ? k.get(p.id)!.w : k.get(p.id)!.h), 0);
    const sela = ((h ? maxX - minX : maxY - minY) - total) / (urut.length - 1);
    const geser = new Map<string, number>();
    let pos = h ? minX : minY;
    for (const p of urut) { const b = k.get(p.id)!; geser.set(p.id, pos - (h ? b.x : b.y)); pos += (h ? b.w : b.h) + sela; }
    return { ...d, perangkat: d.perangkat.map(p => {
      const g = geser.get(p.id);
      if (g === undefined) return p;
      return h ? { ...p, x: Math.round((p.x + g) * 2) / 2 } : { ...p, y: Math.round((p.y + g) * 2) / 2 };
    }) };
  }
  return { ...d, perangkat: d.perangkat.map(p => {
    const b = k.get(p.id);
    if (!b) return p;
    const dx = cara === 'kiri' ? minX - b.x : cara === 'kanan' ? maxX - (b.x + b.w) : cara === 'tengahH' ? (minX + maxX) / 2 - (b.x + b.w / 2) : 0;
    const dy = cara === 'atas' ? minY - b.y : cara === 'bawah' ? maxY - (b.y + b.h) : cara === 'tengahV' ? (minY + maxY) / 2 - (b.y + b.h / 2) : 0;
    return { ...p, x: Math.round((p.x + dx) * 2) / 2, y: Math.round((p.y + dy) * 2) / 2 };
  }) };
}

export interface Panduan { x1: number; y1: number; x2: number; y2: number }

export function jepret(k: Kotak, lain: Kotak[], ambang = 1.6): { dx: number; dy: number; garis: Panduan[] } {
  const xs = [k.x, k.x + k.w / 2, k.x + k.w], ys = [k.y, k.y + k.h / 2, k.y + k.h];
  let bx: { d: number; v: number; o: Kotak } | null = null, by: { d: number; v: number; o: Kotak } | null = null;
  for (const o of lain) {
    for (const t of [o.x, o.x + o.w / 2, o.x + o.w]) for (const s of xs) { const d = t - s; if (Math.abs(d) <= ambang && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, v: t, o }; }
    for (const t of [o.y, o.y + o.h / 2, o.y + o.h]) for (const s of ys) { const d = t - s; if (Math.abs(d) <= ambang && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, v: t, o }; }
  }
  const garis: Panduan[] = [];
  const dx = bx?.d ?? 0, dy = by?.d ?? 0;
  if (bx) garis.push({ x1: bx.v, y1: Math.min(k.y + dy, bx.o.y) - 3, x2: bx.v, y2: Math.max(k.y + dy + k.h, bx.o.y + bx.o.h) + 3 });
  if (by) garis.push({ x1: Math.min(k.x + dx, by.o.x) - 3, y1: by.v, x2: Math.max(k.x + dx + k.w, by.o.x + by.o.w) + 3, y2: by.v });
  return { dx, dy, garis };
}
