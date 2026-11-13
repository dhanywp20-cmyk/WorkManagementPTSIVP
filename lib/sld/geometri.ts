import { rasioDinding } from './dinding';
import { FOTO_PRODUK } from './foto-produk';
import { LABEL_GARIS } from './gaya';
import { lebarTeks } from './teks';
import { areaDok, type DokSLD, type GeoGaris, type GeoKabel, type Kabel, type Perangkat, type Sisi, type Titik, type Ujung } from './tipe';

import { koridor, potongKotak, potongRuas, rapikan, ruteHindar, tabrak, type Kotak } from './rute';

export type { Kotak } from './rute';

export function kodeKabel(kabel: Kabel[]): Map<string, string> {
  const m = new Map<string, string>();
  let k = 0, p = 0;
  for (const c of kabel) m.set(c.id, c.daya ? `P${++p}` : `K${++k}`);
  return m;
}

export const tergambar = (c: Kabel, peta: Map<string, Perangkat>) =>
  peta.has(c.dari.p) && (peta.has(c.ke.p) || c.cabang.some(u => peta.has(u.p)));

const pusat = (b: Kotak): Titik => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

const RASIO_BAWAAN = new Map(Object.values(FOTO_PRODUK).map(f => [f.src, f.rasio]));
export const rasioPerangkat = (p: Perangkat) => (p.gambar ? (p.rasio ?? p.w / p.h)
  : p.foto ? (RASIO_BAWAAN.get(p.foto) ?? p.rasio ?? p.w / p.h) : (rasioDinding(p.ikon, p) ?? 1.6));

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

const diRuas = (q: Titik, t: Titik[]) => t.some((p, i) => i > 0 && Math.abs((t[i - 1].x - q.x) * (p.y - q.y) - (t[i - 1].y - q.y) * (p.x - q.x)) < 1e-6
  && q.x >= Math.min(p.x, t[i - 1].x) - 1e-6 && q.x <= Math.max(p.x, t[i - 1].x) + 1e-6 && q.y >= Math.min(p.y, t[i - 1].y) - 1e-6 && q.y <= Math.max(p.y, t[i - 1].y) + 1e-6);

export function sisiKeTitik(k: Kotak, q: Titik, r?: Titik): Sisi {
  const dalamX = q.x >= k.x && q.x <= k.x + k.w, dalamY = q.y >= k.y && q.y <= k.y + k.h;
  if (dalamX && !dalamY) return q.y < k.y ? 'atas' : 'bawah';
  if (dalamY && !dalamX) return q.x < k.x ? 'kiri' : 'kanan';
  const asal = sisiOtomatis(k, { x: q.x, y: q.y, w: 0, h: 0 });
  if (!r || dalamX || dalamY) return asal;
  const skor = (s: Sisi) => { const t = ortogonal([titikSisi(k, s, 0, 1), q, r], s); return (diRuas(q, t) ? 0 : 100) + t.length; };
  const lain: Sisi = datar(asal) ? (q.y < k.y ? 'atas' : 'bawah') : (q.x < k.x ? 'kiri' : 'kanan');
  return skor(lain) < skor(asal) ? lain : asal;
}

function sisiPintar(a: Kotak, b: Kotak, lain: Kotak[]): Sisi {
  const s = sisiOtomatis(a, b), pb = pusat(b);
  const bebas = (x: Sisi) => !lain.some(k => potongKotak(k, koridor(a, x, pb)));
  if (bebas(s)) return s;
  const alt: Sisi = datar(s) ? (pb.y >= a.y + a.h / 2 ? 'bawah' : 'atas') : (pb.x >= a.x + a.w / 2 ? 'kanan' : 'kiri');
  return bebas(alt) ? alt : s;
}

interface Sambung { kabel: string; peran: string; p: string; sisi: Sisi; urut: number }

function titikSisi(b: Kotak, sisi: Sisi, ke: number, dari: number): Titik {
  const geser = dari > 1 ? (ke - (dari - 1) / 2) * Math.min(5, (datar(sisi) ? b.h : b.w) * 0.7 / (dari - 1)) : 0;
  if (sisi === 'kiri') return { x: b.x, y: b.y + b.h / 2 + geser };
  if (sisi === 'kanan') return { x: b.x + b.w, y: b.y + b.h / 2 + geser };
  if (sisi === 'atas') return { x: b.x + b.w / 2 + geser, y: b.y };
  return { x: b.x + b.w / 2 + geser, y: b.y + b.h };
}

const jepit = (v: number, min: number, maks: number) => Math.min(maks, Math.max(min, v));

function rute(a: Titik, sa: Sisi, b: Titik, sb: Sisi, tengahMentah?: number, batas?: Kotak): Titik[] {
  if (datar(sa) && datar(sb)) {
    if (Math.abs(a.y - b.y) < 0.3 && sa !== sb) return [a, b];
    const tengah = tengahMentah === undefined || !batas ? tengahMentah : jepit(tengahMentah, batas.x, batas.x + batas.w);
    const mx = tengah ?? (sa === sb ? (sa === 'kanan' ? Math.max(a.x, b.x) + 8 : Math.min(a.x, b.x) - 8) : (a.x + b.x) / 2);
    return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
  }
  if (!datar(sa) && !datar(sb)) {
    if (Math.abs(a.x - b.x) < 0.3 && sa !== sb) return [a, b];
    const tengah = tengahMentah === undefined || !batas ? tengahMentah : jepit(tengahMentah, batas.y, batas.y + batas.h);
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
  const semua = [...kotak.values()];
  const selain = (...id: string[]) => d.perangkat.filter(p => !id.includes(p.id)).map(p => kotak.get(p.id)!);
  const batas = areaDok(d);
  const sisiDari = (c: Kabel, u: Ujung, lain: Ujung, arah?: Titik, sebelum?: Titik) => (u.sisi !== 'auto' ? u.sisi
    : arah ? sisiKeTitik(kotak.get(u.p)!, arah, sebelum)
      : c.tengah !== undefined ? sisiOtomatis(kotak.get(u.p)!, kotak.get(lain.p)!) : sisiPintar(kotak.get(u.p)!, kotak.get(lain.p)!, selain(u.p, lain.p)));

  for (const c of d.kabel) {
    if (!tergambar(c, peta)) continue;
    const t = tujuan(c), j = c.jalur?.length ? c.jalur : undefined;
    sambung.push({ kabel: c.id, peran: 'dari', p: c.dari.p, sisi: sisiDari(c, c.dari, t[0], j?.[0], j?.[1]), urut: 0 });
    t.forEach((u, i) => sambung.push({ kabel: c.id, peran: `ke${i}`, p: u.p, sisi: sisiDari(c, u, c.dari, i === 0 ? j?.[j.length - 1] : undefined, i === 0 ? j?.[j.length - 2] : undefined), urut: 0 }));
  }
  const sisiKey = (s: Sambung) => `${s.p}|${s.sisi}`;
  const kelompok = new Map<string, Sambung[]>();
  for (const s of sambung) kelompok.set(sisiKey(s), [...(kelompok.get(sisiKey(s)) ?? []), s]);
  const posisi = new Map<string, Titik>();
  const pusatLain = (s: Sambung) => {
    const c = d.kabel.find(k => k.id === s.kabel)!;
    if (c.jalur?.length && s.peran === 'dari') return c.jalur[0];
    if (c.jalur?.length && s.peran === 'ke0') return c.jalur[c.jalur.length - 1];
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
    const ka = kotak.get(c.dari.p)!;
    const garisList: GeoGaris[] = tujuan(c).map((u, i) => {
      const b = posisi.get(`${c.id}|ke${i}`)!, sb = sisiDariPeta.get(`${c.id}|ke${i}`)!, kb = kotak.get(u.p)!, tengah = i === 0 ? c.tengah : tengahBersama;
      if (i === 0 && c.jalur?.length) return { titik: ruteManual(a, sa, c.jalur, b, sb), awal: true };
      const r = rute(a, sa, b, sb, tengah, batas);
      if (i === 0 && c.tengah !== undefined) return { titik: r, awal: true };
      const lain = selain(c.dari.p, u.p), sah = (t: Titik[], s2: Sisi) => !tabrak(t, lain, 1) && !tembusUjung(t, ka, sa, kb, s2);
      if (sah(r, sb)) return { titik: r, awal: i === 0 };
      for (const s2 of urutSisi(kb, r[r.length - 2] ?? a).filter(s => s !== sb)) {
        const b2 = titikSisi(kb, s2, 0, 1), r2 = rute(a, sa, b2, s2, tengah, batas);
        if (sah(r2, s2)) return { titik: r2, awal: i === 0 };
      }
      return { titik: ruteHindar(a, sa, b, sb, semua, batas) ?? r, awal: i === 0 };
    });
    const k = kode.get(c.id)!;
    const f = hurufKabel(c, d), lebar = lebarTeks(teksLabel(c, k), LABEL_GARIS.ukuran * f, true) + 1.2 * f;
    hasil.push({ id: c.id, kode: k, garis: garisList, label: letakLabel(garisList[0].titik, lebar, c.labelBalik, f), lebarLabel: lebar, huruf: f });
  }
  return hasil;
}

const dalamKotak = (k: Kotak): Kotak => ({ x: k.x + 0.4, y: k.y + 0.4, w: Math.max(0, k.w - 0.8), h: Math.max(0, k.h - 0.8) });

function keluarSisi(dari: Titik, ujung: Titik, s: Sisi): boolean {
  const e = 0.05;
  return s === 'kiri' ? dari.x <= ujung.x + e : s === 'kanan' ? dari.x >= ujung.x - e : s === 'atas' ? dari.y <= ujung.y + e : dari.y >= ujung.y - e;
}

function tembusUjung(t: Titik[], ka: Kotak, sa: Sisi, kb: Kotak, sb: Sisi): boolean {
  if (t.length < 2) return false;
  if (!keluarSisi(t[1], t[0], sa) || !keluarSisi(t[t.length - 2], t[t.length - 1], sb)) return true;
  const da = dalamKotak(ka), db = dalamKotak(kb);
  return t.some((q, i) => i > 0 && ((i > 1 && potongRuas(t[i - 1], q, da)) || (i < t.length - 1 && potongRuas(t[i - 1], q, db))));
}

function urutSisi(k: Kotak, dari: Titik): Sisi[] {
  const c = pusat(k), dx = dari.x - c.x, dy = dari.y - c.y;
  const h: Sisi = dx >= 0 ? 'kanan' : 'kiri', v: Sisi = dy >= 0 ? 'bawah' : 'atas';
  const utama: Sisi[] = Math.abs(dx) / (k.w || 1) >= Math.abs(dy) / (k.h || 1) ? [h, v] : [v, h];
  return [...utama, ...(['kiri', 'kanan', 'atas', 'bawah'] as Sisi[]).filter(s => !utama.includes(s))];
}

function tengahUtama(a: Titik, sa: Sisi, b: Titik, sb: Sisi): number | undefined {
  const r = rute(a, sa, b, sb);
  if (r.length !== 4) return undefined;
  return datar(sa) ? r[1].x : r[1].y;
}

const TEMPEL = 2.5;
const STUB = 4;
const sama = (p: number, q: number) => Math.abs(p - q) < 1e-6;

function luruskanUjung(j: Titik[], ujung: Titik, s: Sisi): void {
  const k: 'x' | 'y' = datar(s) ? 'y' : 'x', lama = j[0][k];
  if (sama(lama, ujung[k]) || Math.abs(lama - ujung[k]) > TEMPEL) return;
  for (let i = 0; i < j.length && sama(j[i][k], lama); i++) j[i] = { ...j[i], [k]: ujung[k] };
}

export function ortogonal(t: Titik[], sa?: Sisi, sb?: Sisi): Titik[] {
  const h: Titik[] = t.length ? [t[0]] : [];
  for (let i = 1; i < t.length; i++) {
    const p = h[h.length - 1], q = t[i];
    if (!sama(p.x, q.x) && !sama(p.y, q.y)) {
      const sebelum = h[h.length - 2];
      const datarDulu = i === 1 && sa ? datar(sa) : i === t.length - 1 && sb ? !datar(sb) : sebelum ? sama(sebelum.x, p.x) : true;
      h.push(datarDulu ? { x: q.x, y: p.y } : { x: p.x, y: q.y });
    }
    h.push(q);
  }
  return rapikan(h);
}

export function ruteManual(a: Titik, sa: Sisi, jalur: Titik[], b: Titik, sb: Sisi): Titik[] {
  const j = jalur.map(t => ({ ...t }));
  luruskanUjung(j, a, sa);
  j.reverse(); luruskanUjung(j, b, sb); j.reverse();
  return ortogonal([a, ...j, b], sa, sb);
}

export const jalurDari = (titik: Titik[]): Titik[] | undefined => {
  const r = rapikan(titik);
  if (r.length > 2) return r.slice(1, -1);
  return r.length === 2 ? [{ x: (r[0].x + r[1].x) / 2, y: (r[0].y + r[1].y) / 2 }] : undefined;
};

const jarakSisi = (dari: Titik, ke: Titik): Titik => {
  const l = Math.hypot(ke.x - dari.x, ke.y - dari.y), f = l ? Math.min(STUB, l / 3) / l : 0;
  return { x: dari.x + (ke.x - dari.x) * f, y: dari.y + (ke.y - dari.y) * f };
};

export const ruasTegak = (a: Titik, b: Titik) => sama(a.x, b.x) && !sama(a.y, b.y);

export function geserRuas(titik: Titik[], k: number, nilai: number): Titik[] {
  const t = titik.map(p => ({ ...p })), tegak = ruasTegak(t[k], t[k + 1]);
  let i = k;
  if (i + 1 === t.length - 1) { const s = jarakSisi(t[i + 1], t[i]); t.splice(i + 1, 0, { ...s }, { ...s }); }
  if (i === 0) { const s = jarakSisi(t[0], t[1]); t.splice(1, 0, { ...s }, { ...s }); i += 2; }
  if (tegak) { t[i].x = nilai; t[i + 1].x = nilai; } else { t[i].y = nilai; t[i + 1].y = nilai; }
  return t;
}

export function geserSudut(titik: Titik[], k: number, ke: Titik): Titik[] {
  const t = titik.map(p => ({ ...p })), o = titik[k];
  const ikut = (n: number) => {
    if (n <= 0 || n >= t.length - 1) return;
    if (sama(titik[n].y, o.y) && !sama(titik[n].x, o.x)) t[n].y = ke.y;
    else if (sama(titik[n].x, o.x) && !sama(titik[n].y, o.y)) t[n].x = ke.x;
  };
  t[k] = { ...ke };
  ikut(k - 1); ikut(k + 1);
  return t;
}

export function pecahRuas(titik: Titik[], k: number, di: Titik, langkah = STUB): Titik[] | null {
  const p = titik[k], q = titik[k + 1];
  if (!p || !q) return null;
  const tegak = ruasTegak(p, q);
  if (!tegak && !sama(p.y, q.y)) return null;
  const m = tegak ? { x: p.x, y: Math.min(Math.max(di.y, Math.min(p.y, q.y)), Math.max(p.y, q.y)) } : { x: Math.min(Math.max(di.x, Math.min(p.x, q.x)), Math.max(p.x, q.x)), y: p.y };
  if (Math.hypot(m.x - p.x, m.y - p.y) < 1 || Math.hypot(m.x - q.x, m.y - q.y) < 1) return null;
  const t = [...titik.slice(0, k + 1), { ...m }, { ...m }, ...titik.slice(k + 1)];
  return geserRuas(t, k + 2, (tegak ? m.x : m.y) + langkah);
}

export function hapusSudut(titik: Titik[], k: number): Titik[] | null {
  const n = titik.length, panjang = (i: number) => Math.hypot(titik[i + 1].x - titik[i].x, titik[i + 1].y - titik[i].y);
  const calon = [k - 1, k].filter(i => i - 1 >= 0 && i + 2 <= n - 1).sort((x, y) => panjang(x) - panjang(y));
  const i = calon[0];
  if (i === undefined) return null;
  const tegak = ruasTegak(titik[i - 1], titik[i]);
  return rapikan(geserRuas(titik, i + 1, tegak ? titik[i].x : titik[i].y));
}

export { pusat, datar };
