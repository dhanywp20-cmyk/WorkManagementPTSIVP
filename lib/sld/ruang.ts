import { idBaru } from './dok';
import { type DokSLD, MAKS_RUANG, type RuangSLD } from './tipe';

export const jumlahRuang = (d: Pick<DokSLD, 'ruangLain'>) => 1 + (d.ruangLain?.length ?? 0);

export const namaRuangKe = (d: Pick<DokSLD, 'namaRuang' | 'ruangLain'>, i: number) =>
  (i === 0 ? d.namaRuang : d.ruangLain?.[i - 1]?.nama)?.trim() || `Ruangan ${i + 1}`;

export function dokRuang(d: DokSLD, i: number): DokSLD {
  const n = jumlahRuang(d), j = Math.max(0, Math.min(n - 1, i));
  const nama = n > 1 ? namaRuangKe(d, j) : d.namaRuang;
  const { ruangLain: _abaikan, ...dasar } = d;
  void _abaikan;
  if (j === 0) return { ...dasar, ...(nama ? { namaRuang: nama } : {}) };
  const r = d.ruangLain![j - 1];
  return { ...dasar, perangkat: r.perangkat, kabel: r.kabel, teks: r.teks, catatan: r.catatan, boq: r.boq, zona: r.zona, namaRuang: nama };
}

export function gabungRuang(d: DokSLD, i: number, v: DokSLD): DokSLD {
  const bersama = { blok: v.blok, watermark: v.watermark, kertas: v.kertas, huruf: v.huruf, tanpaKoneksi: v.tanpaKoneksi };
  const isi = { perangkat: v.perangkat, kabel: v.kabel, teks: v.teks, catatan: v.catatan, boq: v.boq, zona: v.zona };
  if (i <= 0 || !d.ruangLain?.[i - 1]) return { ...d, ...bersama, ...isi, ...(i <= 0 && jumlahRuang(d) === 1 ? { namaRuang: v.namaRuang } : {}) };
  return { ...d, ...bersama, ruangLain: d.ruangLain.map((r, k) => (k === i - 1 ? { ...r, ...isi } : r)) };
}

export const semuaRuang = (d: DokSLD): DokSLD[] => Array.from({ length: jumlahRuang(d) }, (_, i) => dokRuang(d, i));

export function tambahRuang(d: DokSLD, nama?: string): DokSLD {
  if (jumlahRuang(d) >= MAKS_RUANG) return d;
  const baru: RuangSLD = { id: idBaru('r'), nama: nama?.trim() || `Ruangan ${jumlahRuang(d) + 1}`, perangkat: [], kabel: [], teks: [], catatan: [] };
  return { ...d, namaRuang: d.namaRuang?.trim() || 'Ruangan 1', ruangLain: [...(d.ruangLain ?? []), baru] };
}

export function duplikatRuang(d: DokSLD, i: number): DokSLD {
  if (jumlahRuang(d) >= MAKS_RUANG) return d;
  const r = dokRuang(d, i), peta = new Map(r.perangkat.map(p => [p.id, idBaru('p')]));
  const ganti = <U extends { p: string }>(u: U): U => ({ ...u, p: peta.get(u.p) ?? u.p });
  const baru: RuangSLD = {
    id: idBaru('r'), nama: `${namaRuangKe(d, i)} (salinan)`.slice(0, 80),
    perangkat: r.perangkat.map(p => ({ ...p, id: peta.get(p.id)! })),
    kabel: r.kabel.map(c => ({ ...c, id: idBaru('k'), dari: ganti(c.dari), ke: ganti(c.ke), cabang: c.cabang.map(ganti) })),
    teks: r.teks.map(t => ({ ...t, id: idBaru('t') })), catatan: r.catatan.map(c => ({ ...c })),
    ...(r.boq ? { boq: { ...r.boq } } : {}), ...(r.zona?.length ? { zona: r.zona.map(z => ({ ...z, id: idBaru('z') })) } : {}),
  };
  return { ...d, namaRuang: d.namaRuang?.trim() || 'Ruangan 1', ruangLain: [...(d.ruangLain ?? []), baru] };
}

export function hapusRuang(d: DokSLD, i: number): DokSLD {
  const lain = d.ruangLain ?? [];
  if (!lain.length) return d;
  if (i <= 0) {
    const [pertama, ...sisa] = lain;
    return { ...d, namaRuang: pertama.nama, perangkat: pertama.perangkat, kabel: pertama.kabel, teks: pertama.teks, catatan: pertama.catatan, boq: pertama.boq, zona: pertama.zona,
      ruangLain: sisa.length ? sisa : undefined };
  }
  const sisa = lain.filter((_, k) => k !== i - 1);
  return { ...d, ruangLain: sisa.length ? sisa : undefined };
}

export function namaiRuang(d: DokSLD, i: number, nama: string): DokSLD {
  const n = nama.slice(0, 80);
  if (i <= 0) return { ...d, namaRuang: n };
  return { ...d, ruangLain: d.ruangLain?.map((r, k) => (k === i - 1 ? { ...r, nama: n } : r)) };
}

export const semuaPerangkat = (d: DokSLD) => [...d.perangkat, ...(d.ruangLain ?? []).flatMap(r => r.perangkat)];
