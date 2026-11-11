import { URUTAN_JENIS } from './gaya';
import { IKON_DINDING } from './dinding';
import { FOTO_PRODUK } from './foto-produk';
import { kodeKabel, tergambar } from './geometri';
import { KATALOG } from './katalog';
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

const FUNGSI_JENIS: Record<JenisKabel, string> = {
  catx: 'Jaringan data / kontrol (LAN)', usb: 'Data USB', ac: 'Catu daya 230 VAC', hdmi: 'Sinyal video + audio', audio: 'Sinyal audio',
  speaker: 'Audio ke speaker', fiber: 'Sinyal via fiber optik', dc: 'Catu daya DC', ir: 'Kontrol IR', lain: '',
};

export function fungsiOtomatis(c: Kabel): string {
  const t = `${c.teksGaris} ${c.media}`;
  if (/poe/i.test(t)) return 'Data + daya PoE';
  if (/hdbase/i.test(t)) return 'Video + kontrol via HDBaseT';
  if (/rs-?485/i.test(t)) return 'Kontrol RS-485';
  if (/rs-?232/i.test(t)) return 'Kontrol RS-232';
  return FUNGSI_JENIS[c.jenis] ?? '';
}

export function barisKoneksi(d: DokSLD): BarisKoneksi[] {
  const peta = new Map(d.perangkat.map(p => [p.id, p]));
  const kode = kodeKabel(d.kabel);
  return urutKabel(d.kabel).flatMap(c => {
    const tujuan = [c.ke, ...c.cabang], k = kode.get(c.id)!;
    return tujuan.map((u, i) => ({
      id: c.id, kode: tujuan.length > 1 ? `${k}.${i + 1}` : k, dari: namaUjung(c.dari, peta), ke: namaUjung(u, peta),
      media: c.media, fungsi: c.fungsi.trim() || fungsiOtomatis(c), catatan: c.catatan,
    }));
  });
}

const angkaNo = (no: string) => { const x = parseFloat(no); return Number.isFinite(x) ? x : Infinity; };

export const BUKAN_PASOKAN = new Set(['tirai', 'gorden', 'lampu', 'ac', 'fcu', 'mcb']);
export const ikutDaftar = (p: Perangkat) => !!p.no.trim() || !BUKAN_PASOKAN.has(p.ikon);
export const kunciNama = (p: Perangkat) => `${p.kategori.trim().toLowerCase()}|${(p.model.trim() || judulKartu(p.nama)).toLowerCase()}`;
const jenisFoto = (p: Perangkat) => (p.foto && !p.foto.startsWith('data:') ? p.foto : `ikon:${p.ikon}`);
export const kunciModel = (p: Perangkat) => (p.model.trim() || IKON_DINDING.has(p.ikon) ? kunciNama(p) : `${p.kategori.trim().toLowerCase()}|jenis:${jenisFoto(p).toLowerCase()}`);
const namaTemplat = (p: Perangkat) =>
  (KATALOG.find(t => t.foto && FOTO_PRODUK[t.foto]?.src === p.foto) ?? KATALOG.find(t => t.ikon === p.ikon && t.kategori === p.kategori))?.nama;
export function namaKelompok(daftar: Perangkat[]): string {
  const nama = daftar.map(p => judulKartu(p.nama)), p = daftar[0];
  if (p.model.trim() || nama.every(n => n === nama[0])) return nama[0];
  const dasar = nama.map(n => n.replace(/[\s#-]*\d+$/, '').trim());
  if (dasar[0] && dasar.every(n => n.toLowerCase() === dasar[0].toLowerCase())) return dasar[0];
  return namaTemplat(p) ?? nama[0];
}

export function kelompokNo(d: DokSLD): Map<string, Perangkat[]> {
  const m = new Map<string, Perangkat[]>();
  const tanpa = new Map<string, Perangkat[]>();
  for (const p of d.perangkat) {
    const no = p.no.trim();
    if (no) m.set(no, [...(m.get(no) ?? []), p]);
    else if (ikutDaftar(p)) tanpa.set(kunciModel(p), [...(tanpa.get(kunciModel(p)) ?? []), p]);
  }
  const urut = [...m.entries()].sort((a, b) => angkaNo(a[0]) - angkaNo(b[0]) || a[0].localeCompare(b[0]));
  let n = Math.max(0, ...[...m.keys()].map(angkaNo).filter(Number.isFinite).map(Math.floor));
  for (const daftar of tanpa.values()) urut.push([String(++n), daftar]);
  return new Map(urut);
}

export function noOtomatis(d: DokSLD): Map<string, string> {
  const hasil = new Map<string, string>();
  for (const [no, daftar] of kelompokNo(d)) for (const p of daftar) if (!p.no.trim()) hasil.set(p.id, no);
  return hasil;
}

export function barisPerangkat(d: DokSLD): BarisPerangkat[] {
  return [...kelompokNo(d).entries()].map(([no, daftar]) => {
    const p = daftar[0];
    const qty = daftar.reduce((s, x) => s + (Number.isFinite(x.qty) ? x.qty : 0), 0);
    return { no, kategori: p.kategori, model: p.model || namaKelompok(daftar), qty: `${qty.toLocaleString('id-ID')} ${p.satuan || 'unit'}` };
  });
}

export const judulKartu = (nama: string) => nama.replace(/\s+#\d+$/, '').trim();

export function kartuGambar(d: DokSLD): KartuGambar[] {
  return [...kelompokNo(d).entries()].map(([no, daftar]) => {
    const p = daftar.find(x => x.gambar) ?? daftar[0];
    const qty = daftar.reduce((s, x) => s + x.qty, 0);
    const sub = p.subGambar || [p.model, qty > 1 ? `(${qty} ${p.satuan})` : ''].filter(Boolean).join(' ');
    return { no, judul: namaKelompok(daftar), sub, contoh: p };
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
  }
  return hasil;
}
