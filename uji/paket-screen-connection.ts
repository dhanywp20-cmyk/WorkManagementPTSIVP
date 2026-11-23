import { readFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { pdfDariGambar, ukuranSvgPiksel } from '@/lib/pdf-gambar';
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

void (async () => {
console.log('\nScreen Connection di paket .zip & cetak');
const diubah: string[] = [];
const berkas = await berkasPaketScreen(isi, async (s, j) => { diubah.push(`${j}|${s}`); return new TextEncoder().encode('%PDF-palsu'); });
cek('diagram yang termuat masuk zip sebagai .pdf', berkas.length === 1 && berkas[0].name === '04_Screen_Connection_Tools_1_Lobby_LED_utama_.pdf' && new TextDecoder().decode(berkas[0].data) === '%PDF-palsu');
cek('svg diubah ke PDF dengan judul screen', diubah.length === 1 && diubah[0] === `Screen Connection - Lobby LED <utama>|${svg}`);
const gagalUbah = await berkasPaketScreen(isi, async () => { throw new Error('x'); });
cek('konversi gagal tidak menggagalkan seluruh paket', gagalUbah.length === 0);

const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const potongPng = (jenis: string, isiP: Buffer) => {
  const j = Buffer.concat([Buffer.from(jenis), isiP]);
  const p = Buffer.alloc(4); p.writeUInt32BE(isiP.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(j));
  return Buffer.concat([p, j, c]);
};
const png = (w: number, h: number) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  const baris = Buffer.alloc((w * 3 + 1) * h, 200);
  for (let y = 0; y < h; y++) baris[y * (w * 3 + 1)] = 0;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), potongPng('IHDR', ihdr), potongPng('IDAT', deflateSync(baris)), potongPng('IEND', Buffer.alloc(0))]));
};
const pdf = await pdfDariGambar([png(40, 20), png(10, 30)], 'Uji');
const teksPdf = Buffer.from(pdf).toString('latin1');
cek('PDF asli: berkepala %PDF dan 2 halaman', teksPdf.startsWith('%PDF-') && (teksPdf.match(/\/Type \/Page[^s]/g) ?? []).length === 2);
cek('halaman mengikuti rasio gambar (lanskap & potret)', /\/MediaBox \[0 0 1190\.55 595\.27/.test(teksPdf) && /\/MediaBox \[0 0 396\.85 1190\.55/.test(teksPdf));
cek('ukuran svg dibaca dari width/height lalu viewBox', ukuranSvgPiksel('<svg width="1100" height="640" viewBox="0 0 1100 640">').w === 1100 && ukuranSvgPiksel('<svg viewBox="0 0 300 200">').h === 200);
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
})();
