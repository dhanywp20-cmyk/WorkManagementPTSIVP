import { URUTAN_JENIS } from './gaya';
import { kodeKabel, tergambar } from './geometri';
import type { DokSLD, JenisKabel, Kabel, Perangkat, Ujung } from './tipe';

export interface BarisKoneksi { id: string; kode: string; dari: string; ke: string; media: string; fungsi: string; catatan: string }
export interface BarisPerangkat { no: string; kategori: string; model: string; qty: string }
export interface KartuGambar { no: string; judul: string; sub: string; contoh: Perangkat }

const namaUjung = (u: Ujung, peta: Map<string, Perangkat>) => {
  const dasar = (u.nama || peta.get(u.p)?.nama || '').trim();
  return [dasar, u.port.trim()].filter(Boolean).join(' · ');
};

export function urutKabel(kabel: Kabel[]): Kabel[] {
  return [...kabel.filter(c => !c.daya), ...kabel.filter(c => c.daya)];
}

export function barisKoneksi(d: DokSLD): BarisKoneksi[] {
  const peta = new Map(d.perangkat.map(p => [p.id, p]));
  const kode = kodeKabel(d.kabel);
  return urutKabel(d.kabel).map(c => ({
    id: c.id, kode: kode.get(c.id)!, dari: namaUjung(c.dari, peta),
    ke: [c.ke, ...c.cabang].map(u => namaUjung(u, peta)).filter(Boolean).join(', '),
    media: c.media, fungsi: c.fungsi, catatan: c.catatan,
  }));
}

const angkaNo = (no: string) => { const x = parseFloat(no); return Number.isFinite(x) ? x : Infinity; };

function kelompokNo(d: DokSLD): Map<string, Perangkat[]> {
  const m = new Map<string, Perangkat[]>();
  for (const p of d.perangkat) {
    const no = p.no.trim();
    if (no) m.set(no, [...(m.get(no) ?? []), p]);
  }
  return new Map([...m.entries()].sort((a, b) => angkaNo(a[0]) - angkaNo(b[0]) || a[0].localeCompare(b[0])));
}

export function barisPerangkat(d: DokSLD): BarisPerangkat[] {
  return [...kelompokNo(d).entries()].map(([no, daftar]) => {
    const p = daftar[0];
    const qty = daftar.reduce((s, x) => s + (Number.isFinite(x.qty) ? x.qty : 0), 0);
    return { no, kategori: p.kategori, model: p.model || p.nama, qty: `${qty.toLocaleString('id-ID')} ${p.satuan || 'unit'}` };
  });
}

export const judulKartu = (nama: string) => nama.replace(/\s+#\d+$/, '').trim();

export function kartuGambar(d: DokSLD): KartuGambar[] {
  return [...kelompokNo(d).entries()].map(([no, daftar]) => {
    const p = daftar.find(x => x.gambar) ?? daftar[0];
    const qty = daftar.reduce((s, x) => s + x.qty, 0);
    const sub = p.subGambar || [p.model, qty > 1 ? `(${qty} ${p.satuan})` : ''].filter(Boolean).join(' ');
    return { no, judul: judulKartu(p.nama), sub, contoh: p };
  });
}

export function jenisTerpakai(d: DokSLD): JenisKabel[] {
  const peta = new Map(d.perangkat.map(p => [p.id, p]));
  const ada = new Set(d.kabel.filter(c => tergambar(c, peta)).map(c => c.jenis));
  return URUTAN_JENIS.filter(j => ada.has(j));
}

export interface Temuan { tingkat: 'awas' | 'info'; pesan: string }

export function periksaDok(d: DokSLD): Temuan[] {
  const hasil: Temuan[] = [];
  const peta = new Map(d.perangkat.map(p => [p.id, p]));
  const kode = kodeKabel(d.kabel);
  const pakai = new Map<string, string>();
  for (const c of d.kabel) {
    const k = kode.get(c.id)!;
    for (const u of [c.dari, c.ke, ...c.cabang]) {
      if (!u.p || !u.port.trim()) continue;
      const kunci = `${u.p}|${u.port.trim().toLowerCase()}`;
      const lain = pakai.get(kunci);
      if (lain && lain !== k && !/relay|group|cascade|bus/i.test(u.port)) {
        hasil.push({ tingkat: 'awas', pesan: `Port "${u.port}" di ${peta.get(u.p)?.nama} dipakai ${lain} dan ${k}.` });
      }
      pakai.set(kunci, k);
    }
    if (!namaUjung(c.dari, peta) || ![c.ke, ...c.cabang].some(u => namaUjung(u, peta))) hasil.push({ tingkat: 'awas', pesan: `${k}: ujung kabel belum diisi.` });
    if (!c.media.trim()) hasil.push({ tingkat: 'info', pesan: `${k}: kolom Kabel / media masih kosong.` });
  }
  const tersambung = new Set(d.kabel.flatMap(c => [c.dari.p, c.ke.p, ...c.cabang.map(u => u.p)]));
  for (const p of d.perangkat) {
    if (!tersambung.has(p.id)) hasil.push({ tingkat: 'info', pesan: `${p.nama || 'Perangkat'} belum punya kabel.` });
    if (!p.no.trim()) hasil.push({ tingkat: 'info', pesan: `${p.nama || 'Perangkat'} belum punya No. item BOM - tidak masuk Daftar Perangkat.` });
  }
  return hasil;
}
