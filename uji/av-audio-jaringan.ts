/**
 * uji/av-audio-jaringan.ts - rumus lanjutan Kalkulator AV: line 70/100 V, impedansi, kabel speaker,
 * RT60, daya untuk SPL, Dante/AVoIP, PoE, rak, UPS. Angka pembanding dihitung manual.
 *
 * Jalankan: npx tsx uji/av-audio-jaringan.ts
 */
import { amplifierLine, danteMbps, dayaUntukSPL, hitungPoE, hitungRak, impedansiSpeaker, rt60Sabine, rugiKabel, runtimeUPSMenit, saranKabel, saranLink, serapanTambahanM2 } from '../lib/av-audio-jaringan';

let lulus = 0, gagal = 0;
const dekat = (a: number, b: number, t = 0.01) => Math.abs(a - b) <= t;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nAudio');
const amp = amplifierLine([{ watt: 6, jumlah: 10 }, { watt: 15, jumlah: 4 }], 100);
cek('tap 120 W + 25% -> amplifier 240 W, beban 83,3 Ω', amp.totalW === 120 && amp.ampW === 240 && dekat(amp.bebanOhm, 83.33) && amp.jumlahSpeaker === 14);
cek('4 × 8 Ω paralel = 2 Ω, seri = 32 Ω, seri-paralel (2/cabang) = 8 Ω',
  impedansiSpeaker(4, 8, 'paralel') === 2 && impedansiSpeaker(4, 8, 'seri') === 32 && impedansiSpeaker(4, 8, 'seri-paralel', 2) === 8);
const k = rugiKabel(30, 1.5, 8);
cek('kabel 30 m 1,5 mm² ke 8 Ω: R 0,7 Ω, rugi 0,73 dB, hilang 15,4%', dekat(k.rKabelOhm, 0.7) && dekat(k.rugiDb, 0.729) && dekat(k.hilangPersen, 15.44, 0.05));
cek('saran kabel 30 m ke 8 Ω (≤0,5 dB) = 2,5 mm²', saranKabel(30, 8) === 2.5);
cek('jarak sangat jauh -> tidak ada ukuran yang cukup', saranKabel(500, 4) === null);
const rt = rt60Sabine(144, [{ luasM2: 200, a: 0.05 }]);
cek('RT60 144 m³, serapan 10 m² = 2,32 s', dekat(rt.serapanM2, 10) && dekat(rt.rt60, 2.318));
cek('10 orang menambah 4,5 m² -> 1,60 s', dekat(rt60Sabine(144, [{ luasM2: 200, a: 0.05 }], 10).rt60, 1.599));
cek('serapan tambahan ke 0,6 s = 28,6 m²', dekat(serapanTambahanM2(144, 10, 0.6), 28.64));
cek('SPL 75 dB di 8 m, sens 90 dB, headroom 10 dB -> ±20,2 W', dekat(dayaUntukSPL(75, 90, 8, 10), 20.24, 0.05));

console.log('\nJaringan');
cek('Dante 64 kanal 48 kHz ±108 Mbps', dekat(danteMbps(64), 108.13, 0.05));
cek('650 Mbps -> 1 GbE, 701 Mbps -> 10 GbE', saranLink(650) === '1 GbE' && saranLink(701) === '10 GbE');
const poe = hitungPoE([{ watt: 13, jumlah: 4, kelas: 'af' }, { watt: 25, jumlah: 2, kelas: 'at' }]);
cek('PoE 102 W + 20% -> anggaran 130 W, 6 port -> switch 8, kelas tertinggi PoE+', poe.totalW === 102 && poe.anggaranW === 130 && poe.portSwitch === 8 && poe.kelasTertinggi === 'at' && poe.melebihi.length === 0);
cek('perangkat 20 W di port 802.3af terdeteksi melebihi', hitungPoE([{ watt: 20, jumlah: 1, kelas: 'af' }]).melebihi.length === 1);

console.log('\nRak & UPS');
const rak = hitungRak([{ nama: 'Amplifier', u: 2, kg: 10, watt: 400, jumlah: 1 }, { nama: 'Switch', u: 1, kg: 3, watt: 50, jumlah: 2 }]);
cek('4U + 1U ventilasi + 25% -> 7U, rak 9U, 16 kg, 500 W', rak.uPerangkat === 4 && rak.uVentilasi === 1 && rak.uButuh === 7 && rak.rakU === 9 && rak.beratKg === 16 && rak.watt === 500);
cek('UPS 2 × 12 V 9 Ah, beban 500 W -> ±17,6 menit', dekat(runtimeUPSMenit(500, 12, 9, 2), 17.63, 0.05));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
