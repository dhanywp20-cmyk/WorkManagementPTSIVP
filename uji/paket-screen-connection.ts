import { readFileSync } from 'fs';
import { berkasPaketScreen, htmlSeksiScreen } from '@/app/(portal)/form-require-project/_components/screen-connection-paket';
import type { TautanScreen } from '@/app/(portal)/form-require-project/_components/screen-connection-request';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const t = (id: string, nama: string, room_idx = 0): TautanScreen => ({
  id, room_idx, led_id: 'led-1', nama, sumber_diubah_at: null, dilampirkan_oleh_nama: 'Yoga',
  created_at: '2026-11-01', updated_at: '2026-11-01', sumber: null,
});
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
const isi = [{ tautan: t('a', 'Lobby LED <utama>'), svg }, { tautan: t('b', 'Ruang Rapat', 1), svg: null }];

console.log('\nScreen Connection di paket .zip & cetak');
const berkas = berkasPaketScreen(isi);
cek('diagram yang termuat masuk zip sebagai .svg', berkas.length === 1 && berkas[0].name === '04_Screen_Connection_Tools_1_Lobby_LED_utama_.svg' && new TextDecoder().decode(berkas[0].data) === svg);
const html = htmlSeksiScreen(isi, i => ['Lobby', 'Rapat'][i]);
cek('ringkasan HTML memuat seksi Screen Connection + gambar', html.includes('Screen Connection (AV Solution Tools)') && html.includes('data:image/svg+xml'));
cek('nama di-escape', html.includes('Lobby LED &lt;utama&gt;') && !html.includes('<utama>'));
cek('diagram gagal dimuat diberi keterangan, bukan hilang diam-diam', html.includes('Diagram tidak bisa dimuat'));
cek('tanpa tautan → tidak ada seksi', htmlSeksiScreen([], () => '') === '');

const header = readFileSync('app/(portal)/form-require-project/_components/detail/HeaderDetail.tsx', 'utf8');
cek('tombol Download .zip mengirim screenTools', /screen: screenTools/.test(header));
cek('tombol Cetak mengirim screenTools', /cetakRequest\(.*sldTools, screenTools\)/.test(header));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
