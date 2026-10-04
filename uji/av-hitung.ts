/**
 * uji/av-hitung.ts - rumus Tools Team PTS (LED, layar, proyektor, sinyal, audio, daya).
 *
 * Jalankan: npx tsx uji/av-hitung.ts
 */
import {
  hitungLED, cabinetUntukUkuran, saranController, layarDariJarak, ukuranDariDiagonal,
  jarakLempar, lumenDibutuhkan, bandwidthGbps, splPadaJarak, splMaks, speakerPlafon, hitungDaya,
} from '../lib/av-hitung';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const dekat = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

console.log('\n1. LED Videotron');
{
  // 8x6 cabinet 500x500 P2.5 = 4m x 3m, 1600x1200
  const h = hitungLED({ pitch: 2.5, cabLebar: 500, cabTinggi: 500, kolom: 8, baris: 6, dayaMaksCab: 150, faktorRata: 0.33, beratCab: 7.5, refresh: 60, bit: 8, tegangan: 220 });
  cek('ukuran 4 x 3 m', h.lebarM === 4 && h.tinggiM === 3, `${h.lebarM}x${h.tinggiM}`);
  cek('resolusi 1600 x 1200', h.resX === 1600 && h.resY === 1200, `${h.resX}x${h.resY}`);
  cek('rasio 4:3', h.rasio === '4:3' && h.rasioTerdekat === '4:3', h.rasio);
  cek('48 cabinet, 7.2 kW maks', h.jumlahCab === 48 && h.dayaMaksW === 7200);
  cek('arus maks ~32.7 A, MCB 50 A', dekat(h.arusMaksA, 32.727) && h.mcbSaranA === 50, `${h.arusMaksA} ${h.mcbSaranA}`);
  cek('berat 360 kg', h.beratKg === 360);
  cek('1.92 MP butuh 3 port pada 60Hz 8-bit', h.portLAN === 3, String(h.portLAN));
  cek('jarak minimum 2.5 m, ideal 7.5 m', h.jarakMinM === 2.5 && h.jarakIdealM === 7.5);
  const h120 = hitungLED({ pitch: 2.5, cabLebar: 500, cabTinggi: 500, kolom: 8, baris: 6, dayaMaksCab: 150, faktorRata: 0.33, beratCab: 7.5, refresh: 120, bit: 8, tegangan: 220 });
  cek('120 Hz menggandakan kebutuhan port', h120.portLAN === 6, String(h120.portLAN));
  const s = saranController(h.resX, h.resY, h.portLAN);
  cek('controller tersaran memenuhi kapasitas', s.length > 0 && s.every(c => c.maksPx >= h.totalPx && c.port >= h.portLAN));
}
{
  const c = cabinetUntukUkuran(5.2, 2.9, 500, 500);
  cek('target 5.2 x 2.9 m -> 10 x 6 cabinet', c.kolom === 10 && c.baris === 6, `${c.kolom}x${c.baris}`);
}

console.log('\n2. Layar & jarak pandang');
{
  const l = layarDariJarak(8, 'umum');
  cek('penonton terjauh 8 m (umum) -> tinggi 1 m', dekat(l.tinggiM, 1));
  cek('lebar 16:9 = 1.78 m', dekat(l.lebarM, 1.7778));
  const u = ukuranDariDiagonal(65);
  cek('65" 16:9 ~ 1.44 x 0.81 m', dekat(u.lebarM, 1.439) && dekat(u.tinggiM, 0.809), `${u.lebarM} ${u.tinggiM}`);
}

console.log('\n3. Proyektor');
{
  cek('throw 1.5 x lebar 3 m = 4.5 m', jarakLempar(1.5, 3) === 4.5);
  cek('lumen naik saat ruangan lebih terang', lumenDibutuhkan(4, 300) > lumenDibutuhkan(4, 100));
}

console.log('\n4. Bandwidth sinyal');
{
  const fhd = bandwidthGbps(1920, 1080, 60, 8, '4:4:4');
  cek('1080p60 8-bit 4:4:4 ~ 3.56 Gbps, 148.5 MHz', dekat(fhd.dataGbps, 3.564) && dekat(fhd.pixelClockMHz, 148.5), `${fhd.dataGbps}`);
  const uhd = bandwidthGbps(3840, 2160, 60, 8, '4:4:4');
  cek('4K60 4:4:4 8-bit ~ 14.26 Gbps (pas untuk HDMI 2.0)', dekat(uhd.dataGbps, 14.256) && uhd.dataGbps <= 14.4, `${uhd.dataGbps}`);
  const uhd420 = bandwidthGbps(3840, 2160, 60, 8, '4:2:0');
  cek('4K60 4:2:0 muat HDBaseT 10.2', uhd420.dataGbps <= 10.2, `${uhd420.dataGbps}`);
}

console.log('\n5. Audio');
{
  cek('SPL turun 6 dB tiap jarak 2x', dekat(splPadaJarak(100, 2), 93.98, 0.001));
  cek('90 dB @1W + 100 W = 110 dB', dekat(splMaks(90, 100), 110));
  const sp = speakerPlafon(10, 8, 3, 1.2, 90);
  cek('plafon 3 m, telinga 1.2 m, 90° -> diameter 3.6 m', dekat(sp.diameterM, 3.6), `${sp.diameterM}`);
  cek('ruang 10x8 butuh >= 4 speaker', sp.jumlah >= 4, String(sp.jumlah));
}

console.log('\n6. Daya');
{
  const d = hitungDaya([{ nama: 'Display', watt: 300, jumlah: 2 }, { nama: 'DSP', watt: 60, jumlah: 1 }]);
  cek('total 660 W', d.totalW === 660);
  cek('BTU ~ 2252', dekat(d.btu, 2251.9));
  cek('UPS dibulatkan ke 500 VA', d.upsVA % 500 === 0 && d.upsVA >= d.va);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
