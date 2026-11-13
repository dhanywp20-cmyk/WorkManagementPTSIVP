import { kodeKabel } from './geometri';
import { satuBaris } from './teks';
import type { DokSLD } from './tipe';

export interface Temuan { jenis: 'p' | 't' | 'z' | 'k'; id: string; judul: string; ket: string }

const MAKS_TEMUAN = 40;
const pola = (q: string) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

export function cariObjek(d: DokSLD, q: string): Temuan[] {
  const k = q.trim().toLowerCase();
  if (!k) return [];
  const cocok = (...xs: (string | undefined)[]) => xs.some(x => (x ?? '').toLowerCase().includes(k));
  const kode = kodeKabel(d.kabel);
  return [
    ...d.perangkat.filter(p => cocok(p.nama, p.peran, p.ket, p.model, p.kategori)).map(p => ({ jenis: 'p' as const, id: p.id, judul: satuBaris(p.nama) || 'Tanpa nama', ket: satuBaris(p.model || p.peran) })),
    ...d.kabel.filter(c => cocok(kode.get(c.id), c.media, c.teksGaris, c.fungsi, c.catatan)).map(c => ({ jenis: 'k' as const, id: c.id, judul: kode.get(c.id) ?? 'Kabel', ket: c.media || c.fungsi })),
    ...d.teks.filter(t => cocok(t.isi)).map(t => ({ jenis: 't' as const, id: t.id, judul: satuBaris(t.isi).slice(0, 60), ket: 'Teks' })),
    ...(d.zona ?? []).filter(z => cocok(z.label)).map(z => ({ jenis: 'z' as const, id: z.id, judul: z.label, ket: 'Area' })),
  ].slice(0, MAKS_TEMUAN);
}

export function gantiTeks(d: DokSLD, cari: string, ganti: string): { dok: DokSLD; jumlah: number } {
  if (!cari) return { dok: d, jumlah: 0 };
  let jumlah = 0;
  const g = (s: string) => s.replace(pola(cari), () => { jumlah++; return ganti; });
  const dok: DokSLD = {
    ...d,
    perangkat: d.perangkat.map(p => ({ ...p, nama: g(p.nama), peran: g(p.peran), ket: g(p.ket), model: g(p.model) })),
    kabel: d.kabel.map(c => ({ ...c, media: g(c.media), teksGaris: g(c.teksGaris), fungsi: g(c.fungsi), catatan: g(c.catatan) })),
    teks: d.teks.map(t => ({ ...t, isi: g(t.isi) })),
    ...(d.zona ? { zona: d.zona.map(z => ({ ...z, label: g(z.label) })) } : {}),
  };
  return { dok: jumlah ? dok : d, jumlah };
}
