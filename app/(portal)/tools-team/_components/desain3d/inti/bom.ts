import { BISA_PASANG, DISPLAY, LABEL_PASANG, pasangDari, type Benda } from './tipe';
import { isiRakDari } from './rak';
import { spekVideowall, susunanLED } from './produk';
import { perluKabelSinyal, rekapKabel, type JalurKabel } from './kabel';
import { modulLA, tipeSpeakerDari } from './audio';
import { lumenDari, zoomLensa } from './proyektor';
import type { DraftBagian, DraftChecklist } from '@/lib/checklist/inti';

export type KategoriBom = 'Display' | 'Kamera & konferensi' | 'Audio & kontrol' | 'Rack & jaringan' | 'Aksesori pemasangan'
  | 'Kabel' | 'Furnitur' | 'Interior & pencahayaan' | 'Lainnya';
export const URUTAN_KATEGORI: KategoriBom[] = ['Display', 'Kamera & konferensi', 'Audio & kontrol', 'Rack & jaringan', 'Aksesori pemasangan',
  'Kabel', 'Furnitur', 'Interior & pencahayaan', 'Lainnya'];

export interface BarisBom {
  kategori: KategoriBom; item: string; ukuran: string; jumlah: number; satuan: string; catatan: string;
  pasang: boolean;
}

const fm = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: d }) : '-');

export function kategoriBenda(j: Benda['jenis']): KategoriBom {
  if (j === 'lampu') return 'Interior & pencahayaan';
  if (DISPLAY.includes(j) || j === 'proyektor' || j === 'bidang') return 'Display';
  if (j === 'kamera' || j === 'lift') return 'Kamera & konferensi';
  if (j === 'rak') return 'Rack & jaringan';
  if (['speaker', 'speaker-plafon', 'mic', 'touchpanel'].includes(j)) return 'Audio & kontrol';
  if (j === 'meja' || j === 'kursi' || j === 'tribun' || j === 'panggung') return 'Furnitur';
  return 'Lainnya';
}

const BUKAN_BARANG: Benda['jenis'][] = ['teks'];
const DIPASANG: Benda['jenis'][] = ['videowall', 'led', 'layar', 'ifp', 'tv', 'proyektor', 'speaker', 'speaker-plafon', 'mic', 'touchpanel',
  'kamera', 'lift', 'rak', 'lampu'];

const namaItem = (b: Benda) => (b.jenis === 'proyektor' && b.modelProduk ? b.modelProduk : b.nama.replace(b.jenis === 'lampu' ? /\s+\d+(\.\d+)?$/ : /\s+\d+\.\d+$/, ''));

const urutkan = (a: BarisBom, b: BarisBom) =>
  URUTAN_KATEGORI.indexOf(a.kategori) - URUTAN_KATEGORI.indexOf(b.kategori) || a.item.localeCompare(b.item, 'id');

export function daftarBenda(benda: Benda[]): BarisBom[] {
  const grup = new Map<string, BarisBom>();
  for (const b of benda) {
    if (BUKAN_BARANG.includes(b.jenis)) continue;
    const item = namaItem(b);
    const kategori = kategoriBenda(b.jenis);
    let jumlah = 1, satuan = 'unit', ukuran = `${fm(b.w)} × ${fm(b.h)} × ${fm(b.d)} m`, catatan = '';
    if (b.jenis === 'videowall') {
      const sp = spekVideowall(b), kol = Math.max(1, b.kol ?? 2), bar = Math.max(1, b.bar ?? 2);
      jumlah = kol * bar; satuan = 'panel'; ukuran = `${fm(sp.w)} × ${fm(sp.h)} m / panel`; catatan = `Susunan ${kol} × ${bar} = ${fm(b.w)} × ${fm(b.h)} m`;
    } else if (b.jenis === 'led') {
      const s = susunanLED(b);
      jumlah = s.kolom * s.baris; satuan = s.unit; ukuran = `${s.cabW} × ${s.cabH} mm / ${s.unit}`;
      catatan = `P${s.pitch} · susunan ${s.kolom} × ${s.baris} = ${fm(s.lebarM)} × ${fm(s.tinggiM)} m · ${s.resX} × ${s.resY} px`;
    } else if (b.jenis === 'speaker' && tipeSpeakerDari(b) === 'linearray') {
      jumlah = modulLA(b); satuan = 'modul'; ukuran = `${fm(b.w)} × ${fm(b.h / jumlah)} × ${fm(b.d)} m / modul`;
    } else if (b.jenis === 'proyektor') {
      const [lo, hi] = zoomLensa(b);
      catatan = `${lumenDari(b).toLocaleString('id-ID')} lm · TR ${fm(lo)}${hi - lo > 0.005 ? `-${fm(hi)}` : ''}`;
    }
    const kunci = `${kategori}|${item}|${ukuran}|${catatan}|${satuan}`;
    const ada = grup.get(kunci);
    if (ada) ada.jumlah += jumlah;
    else grup.set(kunci, { kategori, item, ukuran, jumlah, satuan, catatan, pasang: DIPASANG.includes(b.jenis) });
  }
  return [...grup.values()].sort(urutkan);
}

export function bomDesain(benda: Benda[], kabel: JalurKabel[]): BarisBom[] {
  const baris = daftarBenda(benda);

  const aksesori = new Map<string, BarisBom>();
  const tambah = (peta: Map<string, BarisBom>, kunci: string, buat: () => BarisBom, n = 1) => {
    const ada = peta.get(kunci);
    if (ada) ada.jumlah += n; else peta.set(kunci, { ...buat(), jumlah: n });
  };
  for (const b of benda) {
    if (BISA_PASANG.includes(b.jenis)) {
      const p = pasangDari(b);
      tambah(aksesori, `pasang|${p}`, () => ({ kategori: 'Aksesori pemasangan', item: LABEL_PASANG[p], ukuran: '', jumlah: 1, satuan: 'set', catatan: 'Untuk display', pasang: false }), b.jenis === 'videowall' ? Math.max(1, b.kol ?? 2) * Math.max(1, b.bar ?? 2) : 1);
    }
    if (b.jenis === 'proyektor' && b.pasangProyektor !== 'meja') {
      tambah(aksesori, 'bracket-proyektor', () => ({ kategori: 'Aksesori pemasangan', item: 'Bracket plafon proyektor', ukuran: '', jumlah: 1, satuan: 'set', catatan: 'Sesuaikan panjang drop dengan tinggi plafon', pasang: false }));
    }
  }

  const rak = new Map<string, BarisBom>();
  for (const b of benda.filter(x => x.jenis === 'rak')) {
    for (const p of isiRakDari(b)) {
      if (p.jenis === 'kosong') continue;
      const catatan = `Di ${b.nama}${b.isiRak?.length ? '' : ' · contoh isi bawaan, sesuaikan'}`;
      tambah(rak, `${p.nama}|${p.u}|${catatan}`, () => ({ kategori: 'Rack & jaringan', item: p.nama, ukuran: `${p.u}U`, jumlah: 1, satuan: 'unit', catatan, pasang: true }));
    }
  }

  const kabelBaris: BarisBom[] = rekapKabel(kabel).map(r => ({
    kategori: 'Kabel', item: r.kabel.nama, ukuran: `±${fm(r.meter)} m`, jumlah: Math.ceil(r.meter), satuan: 'm',
    catatan: `${r.tarikan} tarikan · ${r.gulungan}`, pasang: false,
  }));

  if (!benda.some(b => b.jenis === 'rak') && perluKabelSinyal(benda)) {
    kabelBaris.push({ kategori: 'Kabel', item: 'Kabel sinyal', ukuran: 'belum dihitung', jumlah: 0, satuan: 'm', catatan: 'Belum ada rack di desain, jalur kabel sinyal tidak bisa dihitung', pasang: false });
  }

  return [...baris, ...aksesori.values(), ...rak.values(), ...kabelBaris].sort(urutkan);
}

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
