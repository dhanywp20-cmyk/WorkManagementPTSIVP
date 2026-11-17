import { bersihkanKoneksi, KONEKSI_AWAL, type DataKoneksi, kodePort, rapikanManual } from '../app/(portal)/tools-team/_components/led/koneksi/data';
import { susunMulti, teksRentangPort } from '../app/(portal)/tools-team/_components/led/koneksi/multi';
import { svgKoneksiMulti, svgPosterKoneksiMulti } from '../app/(portal)/tools-team/_components/led/koneksi/svg';
import { ringkasanKoneksiMulti } from '../app/(portal)/tools-team/_components/led/koneksi/teks';
import { bersihkanLayar, bersihkanSpek, dayaUmum, layarBaru, susunanLayar, unitLED } from '../app/(portal)/tools-team/_components/led/layar';
import { bomLED, MODUL_LED } from '../lib/av/hitung';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}

// Cabinet 500×500 P2.5 (200×200 px), 1 cabinet per receiving card.
const dasar = (kolom: number, baris: number, ppkHw: number, namaHw: string | null): DataKoneksi => ({
  kolom, baris, wUnit: 500, hUnit: 500, pxX: 200, pxY: 200, satuan: 'cabinet', pxPerPort: 650_000, portIdeal: 1, ppkHw, namaHw, refresh: 60, bit: 8,
});

console.log('\n1. Satu screen = perilaku lama');
{
  const m = susunMulti([{ nama: 'Screen 1', d: dasar(8, 5, 4, null), s: KONEKSI_AWAL }], true);
  cek('tidak multi, offset 0', !m.multi && m.per[0].off === 0);
  cek('gabung = susunan screen 1', m.gabung === m.per[0].t);
}

console.log('\n2. Dua screen pada VX1000 Pro (10 port, tanpa kartu output)');
{
  const m = susunMulti([
    { nama: 'Utama', d: dasar(8, 5, 10, 'VX1000 Pro'), s: KONEKSI_AWAL },
    { nama: 'Samping', d: dasar(4, 6, 10, 'VX1000 Pro'), s: KONEKSI_AWAL },
  ], true);
  const [a, b] = m.per;
  const nA = a.t.hasil.port.length;
  cek('multi', m.multi);
  cek('screen 2 mulai setelah port terakhir screen 1', b.off === nA, `${b.off} vs ${nA}`);
  cek('port screen 2 bernomor global', b.t.hasil.port[0].port === nA + 1);
  cek('total port = jumlah port kedua screen', m.gabung.portTerpakai === a.t.portTerpakai + b.t.portTerpakai);
  cek('1 controller untuk semua screen', m.gabung.controller === 1 && a.t.controller === 1 && b.t.controller === 1);
  cek('pemilik port', m.pemilik(1) === 0 && m.pemilik(nA + 1) === 1);
  cek('receiving card dijumlah', m.gabung.hasil.sel.length === 40 + 24);
  cek('rentang port', teksRentangPort(b) === `P${nA + 1}–P${nA + b.t.portTerpakai}`, teksRentangPort(b));
  const svg = svgKoneksiMulti(m, { interaktif: true, aktif: 1 });
  cek('kanvas memuat kedua screen', svg.includes('data-layar="0"') && svg.includes('data-layar="1"') && svg.includes('Utama') && svg.includes('Samping'));
  const poster = svgPosterKoneksiMulti([{ nama: 'Utama', d: dasar(8, 5, 10, 'VX1000 Pro'), s: KONEKSI_AWAL }, { nama: 'Samping', d: dasar(4, 6, 10, 'VX1000 Pro'), s: KONEKSI_AWAL }], true, 'Uji', 'x');
  cek('poster menyebut 2 screen & 1 video processor', poster.includes('2 screen · 1 video processor'));
}

console.log('\n3. Tiga screen pada seri H (kartu 20 LAN) - mulai di kartu baru');
{
  const H = 'H5 (H_20xRJ45)';
  const layar = [dasar(8, 5, 60, H), dasar(6, 4, 60, H), dasar(10, 3, 60, H)].map((d, i) => ({ nama: `Screen ${i + 1}`, d, s: KONEKSI_AWAL }));
  const pisah = susunMulti(layar, true);
  cek('kartu output 20 LAN', pisah.per[0].t.lanKartu === 20, String(pisah.per[0].t.lanKartu));
  cek('screen 2 mulai di kartu 2 (port 21)', pisah.per[1].off === 20 && kodePort(pisah.per[1].t, 21) === 'P2:1', kodePort(pisah.per[1].t, 21));
  cek('screen 3 mulai di kartu 3 (port 41)', pisah.per[2].off === 40);
  const rapat = susunMulti(layar, false);
  cek('tanpa pisah kartu: port rapat', rapat.per[1].off === rapat.per[0].t.hasil.port.length);
  cek('VP-level dari screen 1 (cadangan loop) berlaku ke semua',
    susunMulti([{ ...layar[0], s: { ...KONEKSI_AWAL, cadangan: 'loop' } }, layar[1]], true).per[1].t.cadangan === 'loop');
  cek('ringkasan teks per screen', ringkasanKoneksiMulti(layar, true).includes('*Screen 3*'));
}

console.log('\n4. Data screen tambahan & BOM');
{
  const l = layarBaru(2, { targetW: 3, targetH: 2 });
  cek('screen baru bernama Screen 2 dengan koneksi bawaan', l.nama === 'Screen 2' && l.koneksi.mode === 'template');
  cek('susunan dari ukuran', JSON.stringify(susunanLayar(l, 500, 500)) === JSON.stringify({ kolom: 6, baris: 4 }));
  const bersih = bersihkanLayar([{ nama: 'Lobby', mode: 'jumlah', kolomIn: 3.4, barisIn: 2, koneksi: { mode: 'aneh' } }, 'x', null]);
  cek('bersihkan data berkas', bersih.length === 1 && bersih[0].nama === 'Lobby' && bersih[0].kolomIn === 3 && bersih[0].koneksi.mode === 'template');
  cek('berkas lama tanpa layar', bersihkanLayar(undefined).length === 0);
  const umum = { satuan: 'cabinet' as const, namaLED: 'P2.5', unit: 100, screen: 1, cadanganUnit: 0, receivingCard: 100, namaRC: '', cadanganRC: 0, controller: [{ nama: 'H5', qty: 1 }],
    controllerCadangan: false, dayaMaksW: 1000, psuW: 200, port: 6, portCadangan: 0, panjangLAN: 10, sirkuit: 2, mcb: 16, panjangPower: 15, lebarM: 4, tinggiM: 2.5, baris: 5 };
  const satu = bomLED(umum).find(b => b.kunci === 'rangka')!.qty;
  const dua = bomLED({ ...umum, layar: [{ lebarM: 4, tinggiM: 2.5, baris: 5 }, { lebarM: 4, tinggiM: 2.5, baris: 5 }] });
  cek('rangka dijumlah per screen', dua.find(b => b.kunci === 'rangka')!.qty >= satu * 2 - 1);
  cek('controller tidak dikali jumlah screen', dua.find(b => b.kunci === 'ctrl-0')!.qty === 1);
  cek('ket unit menyebut 2 screen', dua.find(b => b.kunci === 'unit')!.ket === '2 screen');
}

console.log('\n5. Modul berbeda per screen');
{
  const cab = unitLED({ satuan: 'cabinet', modulKode: '', pitch: 3.91, cabW: 500, cabH: 1000 }, MODUL_LED);
  cek('cabinet P3.91 500×1000', cab.u.pitch === 3.91 && cab.u.w === 500 && cab.u.h === 1000 && cab.namaUnit === 'cabinet' && cab.labelLED === 'P3.91');
  cek('piksel per cabinet dari pitch', cab.u.pxX === 128 && cab.u.pxY === 256, `${cab.u.pxX}x${cab.u.pxY}`);
  const m = MODUL_LED[0];
  const ref = unitLED({ satuan: 'modul', modulKode: 'tidak-ada', pitch: 1, cabW: 1, cabH: 1 }, MODUL_LED.slice(1), m);
  cek('modul hilang dari referensi memakai snapshot berkas', ref.u.kode === m.kode && ref.u.w === m.w);
  cek('daya umum per unit', dayaUmum('indoor', 0.25) > 0);
  const sp = bersihkanSpek({ satuan: 'cabinet', pitch: 3.91, cabKey: 'aneh', cabW: 500, cabH: 1000, lingkungan: 'outdoor', ref: { kode: 'x' } });
  cek('bersihkan spek', !!sp && sp.cabKey === '500x500' && sp.lingkungan === 'outdoor' && sp.ref === null);
  cek('screen tanpa spek = sama dengan Screen 1', layarBaru(3).modul === null && bersihkanLayar([{ nama: 'A' }])[0].modul === null);
  const d2: DataKoneksi = { ...dasar(4, 2, 10, 'VX1000 Pro'), wUnit: 500, hUnit: 1000, pxX: 128, pxY: 256 };
  const mm = susunMulti([{ nama: 'P2.5', d: dasar(8, 5, 10, 'VX1000 Pro'), s: KONEKSI_AWAL }, { nama: 'P3.91', d: d2, s: KONEKSI_AWAL }], true);
  cek('resolusi screen 2 dari pitch-nya sendiri', mm.per[1].t.resX === 512 && mm.per[1].t.resY === 512, `${mm.per[1].t.resX}x${mm.per[1].t.resY}`);
  const umum = { satuan: 'cabinet' as const, namaLED: 'P2.5', unit: 48, screen: 1, cadanganUnit: 3, receivingCard: 48, namaRC: '', cadanganRC: 0, controller: [],
    controllerCadangan: false, dayaMaksW: 9000, psuW: 200, port: 4, portCadangan: 0, panjangLAN: 10, sirkuit: 2, mcb: 16, panjangPower: 15, lebarM: 4, tinggiM: 3, baris: 6 };
  const b = bomLED({ ...umum, jenisUnit: [
    { namaLED: 'P2.5', satuan: 'cabinet', unit: 40, dayaMaksW: 6000, ket: 'Screen 1' },
    { namaLED: 'P3.91', satuan: 'cabinet', unit: 8, dayaMaksW: 3000, ket: 'Screen 2' },
  ] });
  cek('baris BOM per jenis modul', b.find(x => x.kunci === 'unit')?.qty === 40 && b.find(x => x.kunci === 'unit-2')?.item === 'Cabinet LED P3.91' && b.find(x => x.kunci === 'unit-2')?.qty === 8);
  cek('cadangan per jenis modul', !!b.find(x => x.kunci === 'unit-cadangan-2'));
  cek('tanpa PSU bila semua cabinet', !b.some(x => x.kunci === 'psu'));
}

console.log('\n6. Port manual kosong tidak menumpuk');
{
  const kosong20 = Array.from({ length: 20 }, () => []);
  cek('port kosong di belakang dibuang, sisa 1', rapikanManual(kosong20).length === 1);
  cek('port terisi & celah di tengah tetap', JSON.stringify(rapikanManual([[[0, 0]], [], [[1, 0]], [], []])) === JSON.stringify([[[0, 0]], [], [[1, 0]]]));
  cek('daftar kosong tetap kosong', rapikanManual([]).length === 0);
  cek('berkas lama dengan 20 port kosong dibersihkan', bersihkanKoneksi({ mode: 'manual', manual: kosong20 }).manual?.length === 1);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
