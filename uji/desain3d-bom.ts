/**
 * uji/desain3d-bom.ts - BOM Desain 3D (inti/bom.ts): pengelompokan perangkat, aksesori pemasangan,
 * isi rack, kabel, dan checklist instalasi dari BOM (pola Project Progress).
 *
 * Jalankan: npm test -- desain3d-bom
 */
import { readFileSync } from 'fs';
import {
  bomDesain, checklistDariBom, daftarBenda, jalurKabel, URUTAN_KATEGORI, type Benda, type Ruang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import { validasiDraft } from '../lib/checklist';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
const b = (x: Partial<Benda> & Pick<Benda, 'id' | 'jenis'>): Benda => ({ nama: x.id, x: 3, z: 3, w: 1, h: 1, d: 1, elev: 0, rot: 0, ...x });

const benda: Benda[] = [
  b({ id: 'tv1', jenis: 'tv', nama: 'TV 75"', w: 1.68, h: 0.96, d: 0.06, z: 0.1, elev: 1 }),
  b({ id: 'tv2', jenis: 'tv', nama: 'TV 75"', w: 1.68, h: 0.96, d: 0.06, z: 0.1, x: 6, elev: 1, pasang: 'standfloor' }),
  b({ id: 'pr1', jenis: 'proyektor', nama: 'Proyektor', z: 4, elev: 2.6 }),
  b({ id: 'sp1', jenis: 'speaker-plafon', nama: 'Speaker plafon 1.1', elev: 2.9 }),
  b({ id: 'sp2', jenis: 'speaker-plafon', nama: 'Speaker plafon 1.2', elev: 2.9 }),
  b({ id: 'm1', jenis: 'meja', nama: 'Meja rapat', w: 3, h: 0.75, d: 1.2 }),
  b({ id: 'k1', jenis: 'kursi', nama: 'Kursi 2.1', w: 0.6, h: 1, d: 0.6 }),
  b({ id: 'k2', jenis: 'kursi', nama: 'Kursi 2.2', w: 0.6, h: 1, d: 0.6 }),
  b({ id: 'rk', jenis: 'rak', nama: 'Rack 12U', rakU: 12, x: 7.5, z: 5.5, w: 0.6, h: 0.7, d: 0.6,
    isiRak: [{ jenis: 'switch', u: 1, nama: 'Switch PoE' }, { jenis: 'kosong', u: 1, nama: 'Blank panel' }, { jenis: 'dsp', u: 1, nama: 'DSP' }, { jenis: 'switch', u: 1, nama: 'Switch PoE' }] }),
  b({ id: 't1', jenis: 'teks', nama: 'Label pintu' }),
];

console.log('\n1. Daftar perangkat (tabel lembar cetak)');
const d = daftarBenda(benda);
const cari = (item: string) => d.find(r => r.item === item);
cek('nama bernomor dijumlah ("Kursi 2.1" + "Kursi 2.2" = Kursi ×2)', cari('Kursi')?.jumlah === 2);
cek('benda kembar dijumlah (TV 75" ×2)', cari('TV 75"')?.jumlah === 2);
cek('teks keterangan bukan barang', !d.some(r => r.item === 'Label pintu'));
cek('urut per kategori (Display dulu, Furnitur sesudah Audio)', URUTAN_KATEGORI.indexOf(d[0].kategori) <= URUTAN_KATEGORI.indexOf(d[d.length - 1].kategori) && d[0].kategori === 'Display');
cek('furnitur tidak dipasang tim, display dipasang', cari('Meja rapat')?.pasang === false && cari('TV 75"')?.pasang === true);

console.log('\n2. BOM lengkap');
const kabel = jalurKabel(benda, ruang);
const bom = bomDesain(benda, kabel);
const ada = (item: string) => bom.find(r => r.item === item);
cek('bracket TV dinding & standfloor dihitung terpisah', ada('Wall bracket pop-up')?.jumlah === 1 && ada('Standfloor portable beroda')?.jumlah === 1);
cek('bracket plafon proyektor', ada('Bracket plafon proyektor')?.jumlah === 1);
cek('isi rack dijumlah per nama, blank panel tidak', ada('Switch PoE')?.jumlah === 2 && ada('DSP')?.ukuran === '1U' && !ada('Blank panel'));
cek('kabel: ada baris kategori Kabel dalam meter', kabel.length > 0 && bom.some(r => r.kategori === 'Kabel' && r.satuan === 'm' && r.jumlah > 0));
cek('kabel: catatan tarikan & gulungan', bom.filter(r => r.kategori === 'Kabel').every(r => /tarikan · /.test(r.catatan)));

console.log('\n3. Checklist dari BOM');
const draft = checklistDariBom('Ruang Rapat Lt. 3', bom);
cek('bagian pertama Persiapan, terakhir Serah Terima', draft.bagian[0].judul === '1. Persiapan' && /Serah Terima$/.test(draft.bagian[draft.bagian.length - 1].judul));
cek('satu bagian per perangkat dipasang (jumlah ditulis)', draft.bagian.some(x => x.judul.endsWith('TV 75" (×2)')) && draft.bagian.some(x => /Speaker plafon \(×2\)$/.test(x.judul)));
cek('furnitur & kabel tidak jadi bagian', !draft.bagian.some(x => /Meja rapat|Kursi|Cat \d|UTP/.test(x.judul)));
cek('perangkat di rack: pasang di rack, labeling, setting, tes', draft.bagian.find(x => /Switch PoE/.test(x.judul))?.items.map(i => i.teks).join('|') === 'Pasang di rack|Sambung kabel & labeling|Setting / konfigurasi|Tes fungsi');
cek('material (aksesori & kabel) dicatat di Persiapan', /Wall bracket pop-up/.test(draft.bagian[0].catatan) && /m/.test(draft.bagian[0].catatan));
cek('nomor bagian berurutan', draft.bagian.every((x, i) => x.judul.startsWith(`${i + 1}. `)));
const v = validasiDraft({ ...draft });
cek('lolos validasi impor checklist server (validasiDraft)', !('galat' in v));

console.log('\n4. Pemasangan');
const ekspor = readFileSync('app/(portal)/tools-team/_components/desain3d/ekspor/useEkspor.ts', 'utf8');
cek('lembar cetak memakai daftarBenda (satu logika dengan BOM)', /const baris = daftarBenda\(benda\)/.test(ekspor) && !/const urutKat = /.test(ekspor));
cek('BOM Excel & draf checklist dari bomDesain', /const bom = bomDesain\(benda, kabel\)/.test(ekspor) && /checklistDariBom\(judul, bomDesain\(benda, kabel\)\)/.test(ekspor));
const modal = readFileSync('app/(portal)/tools-team/_components/desain3d/panel/ModalChecklistBom.tsx', 'utf8');
cek('checklist dibuat lewat API impor yang sudah ada (admin)', /\/api\/project-progress\/\$\{pilih\}\/checklist/.test(modal) && /isi: 'impor'/.test(modal) && /disabled=\{sibuk \|\| !admin/.test(modal));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
