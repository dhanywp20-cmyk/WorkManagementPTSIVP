/**
 * desain3d/inti/bom.ts - Bill of Material dari desain:
 *  - perangkat & furnitur, dikelompokkan per kategori, benda bernama & berukuran sama dijumlah;
 *  - aksesori pemasangan display (wall bracket pop-up / bracket + struktur hollow / standfloor);
 *  - isi rack (tanpa blank panel), dijumlah per nama;
 *  - kabel: total meter per jenis + kebutuhan gulungan (dari rekapKabel).
 * Dipakai: tabel "Daftar perangkat" lembar cetak, Ekspor Excel BOM, dan "Jadikan checklist"
 * (satu bagian checklist per perangkat yang dipasang tim). Murni - diuji di uji/desain3d-bom.ts.
 */
import { BISA_PASANG, DISPLAY, LABEL_PASANG, pasangDari, type Benda } from './tipe';
import { isiRakDari } from './rak';
import { rekapKabel, type JalurKabel } from './kabel';
import type { DraftBagian, DraftChecklist } from '@/lib/checklist';

export type KategoriBom = 'Display' | 'Kamera & konferensi' | 'Audio & kontrol' | 'Rack & jaringan' | 'Aksesori pemasangan'
  | 'Kabel' | 'Furnitur' | 'Interior & pencahayaan' | 'Lainnya';
export const URUTAN_KATEGORI: KategoriBom[] = ['Display', 'Kamera & konferensi', 'Audio & kontrol', 'Rack & jaringan', 'Aksesori pemasangan',
  'Kabel', 'Furnitur', 'Interior & pencahayaan', 'Lainnya'];

export interface BarisBom {
  kategori: KategoriBom; item: string; ukuran: string; jumlah: number; satuan: string; catatan: string;
  /** Dipasang & disetel tim di lokasi -> jadi satu bagian checklist (furnitur, kabel, aksesori tidak). */
  pasang: boolean;
}

const fm = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: d }) : '-');

/** Kategori benda di BOM & lembar cetak. */
export function kategoriBenda(j: Benda['jenis']): KategoriBom {
  if (j === 'lampu') return 'Interior & pencahayaan';
  if (DISPLAY.includes(j) || j === 'proyektor' || j === 'bidang') return 'Display';
  if (j === 'kamera' || j === 'lift') return 'Kamera & konferensi';
  if (['speaker', 'speaker-plafon', 'mic', 'touchpanel', 'rak'].includes(j)) return 'Audio & kontrol';
  if (j === 'meja' || j === 'kursi' || j === 'tribun' || j === 'panggung') return 'Furnitur';
  return 'Lainnya';
}

/** Bukan barang yang dibeli / dipasang: teks keterangan di kanvas. */
const BUKAN_BARANG: Benda['jenis'][] = ['teks'];
/** Dipasang & disetel tim (jadi bagian checklist). Perangkat presentasi (laptop/HP/tablet) umumnya milik customer. */
const DIPASANG: Benda['jenis'][] = ['videowall', 'led', 'layar', 'ifp', 'tv', 'proyektor', 'speaker', 'speaker-plafon', 'mic', 'touchpanel',
  'kamera', 'lift', 'rak', 'lampu'];

const urutkan = (a: BarisBom, b: BarisBom) =>
  URUTAN_KATEGORI.indexOf(a.kategori) - URUTAN_KATEGORI.indexOf(b.kategori) || a.item.localeCompare(b.item, 'id');

/** Perangkat & furnitur saja (tanpa aksesori, rack, kabel) - isi tabel "Daftar perangkat" lembar cetak. */
export function daftarBenda(benda: Benda[]): BarisBom[] {
  const grup = new Map<string, BarisBom>();
  for (const b of benda) {
    if (BUKAN_BARANG.includes(b.jenis)) continue;
    const item = b.nama.replace(/\s+\d+\.\d+$/, '');   // "Meja kelas 2.3" -> "Meja kelas"
    const kategori = kategoriBenda(b.jenis);
    const kunci = `${kategori}|${item}|${fm(b.w)}x${fm(b.d)}`;
    const ada = grup.get(kunci);
    if (ada) ada.jumlah++;
    else grup.set(kunci, { kategori, item, ukuran: `${fm(b.w)} × ${fm(b.h)} × ${fm(b.d)} m`, jumlah: 1, satuan: 'unit', catatan: '', pasang: DIPASANG.includes(b.jenis) });
  }
  return [...grup.values()].sort(urutkan);
}

/** BOM lengkap: perangkat & furnitur + aksesori pemasangan + isi rack + kabel. */
export function bomDesain(benda: Benda[], kabel: JalurKabel[]): BarisBom[] {
  const baris = daftarBenda(benda);

  const aksesori = new Map<string, BarisBom>();
  const tambah = (peta: Map<string, BarisBom>, kunci: string, buat: () => BarisBom) => {
    const ada = peta.get(kunci);
    if (ada) ada.jumlah++; else peta.set(kunci, buat());
  };
  for (const b of benda) {
    if (BISA_PASANG.includes(b.jenis)) {
      const p = pasangDari(b);
      tambah(aksesori, `pasang|${p}`, () => ({ kategori: 'Aksesori pemasangan', item: LABEL_PASANG[p], ukuran: '', jumlah: 1, satuan: 'set', catatan: 'Untuk display', pasang: false }));
    }
    if (b.jenis === 'proyektor' && b.pasangProyektor !== 'meja') {
      tambah(aksesori, 'bracket-proyektor', () => ({ kategori: 'Aksesori pemasangan', item: 'Bracket plafon proyektor', ukuran: '', jumlah: 1, satuan: 'set', catatan: 'Sesuaikan panjang drop dengan tinggi plafon', pasang: false }));
    }
  }

  const rak = new Map<string, BarisBom>();
  for (const b of benda.filter(x => x.jenis === 'rak')) {
    for (const p of isiRakDari(b)) {
      if (p.jenis === 'kosong') continue;
      tambah(rak, p.nama, () => ({ kategori: 'Rack & jaringan', item: p.nama, ukuran: `${p.u}U`, jumlah: 1, satuan: 'unit', catatan: `Di ${b.nama}`, pasang: true }));
    }
  }

  const kabelBaris: BarisBom[] = rekapKabel(kabel).map(r => ({
    kategori: 'Kabel', item: r.kabel.nama, ukuran: `±${fm(r.meter)} m`, jumlah: Math.ceil(r.meter), satuan: 'm',
    catatan: `${r.tarikan} tarikan · ${r.gulungan}`, pasang: false,
  }));

  return [...baris, ...aksesori.values(), ...rak.values(), ...kabelBaris].sort(urutkan);
}

/**
 * Checklist instalasi dari BOM (pola checklist Project Progress: satu bagian = satu produk - pasang,
 * kabel, setting, tes). Bagian 1 Persiapan (cek material sesuai BOM), terakhir Serah Terima.
 */
export function checklistDariBom(judul: string, bom: BarisBom[]): DraftChecklist {
  const dipasang = bom.filter(b => b.pasang);
  const material = bom.filter(b => !b.pasang && b.kategori !== 'Furnitur' && b.kategori !== 'Interior & pencahayaan');
  const item = (teks: string, kelompok = '') => ({ kelompok, teks, catatan: '', selesai: false });
  const bagian: DraftBagian[] = [{
    judul: '1. Persiapan',
    catatan: material.length ? material.map(m => `- ${m.item}: ${m.ukuran || `${m.jumlah} ${m.satuan}`}${m.catatan ? ` (${m.catatan})` : ''}`).join('\n') : '',
    items: [item('Cek material datang sesuai BOM (jumlah & tipe)'), item('Survey ulang titik pasang & jalur kabel'), item('Koordinasi jadwal & akses lokasi dengan customer')],
  }];
  dipasang.forEach((b, i) => {
    const n = b.jumlah > 1 ? ` (×${b.jumlah})` : '';
    const langkah = b.kategori === 'Rack & jaringan'
      ? ['Pasang di rack', 'Sambung kabel & labeling', 'Setting / konfigurasi', 'Tes fungsi']
      : b.kategori === 'Interior & pencahayaan'
        ? ['Pasang', 'Sambung ke kontrol / dimmer', 'Tes nyala & dimming']
        : ['Pasang', 'Tarik & sambung kabel', 'Setting', 'Tes fungsi'];
    bagian.push({ judul: `${i + 2}. ${b.item}${n}`, catatan: b.ukuran ? `Ukuran: ${b.ukuran}` : '', items: langkah.map(t => item(t)) });
  });
  bagian.push({
    judul: `${dipasang.length + 2}. Serah Terima`, catatan: '',
    items: [item('Tes sistem keseluruhan bersama customer'), item('Training singkat pengguna'), item('Berita acara serah terima ditandatangani')],
  });
  return { judul, keterangan: 'Dibuat dari BOM Desain 3D Ruang AV. Satu bagian = satu produk: pasang, kabel, setting, tes.', bagian };
}
