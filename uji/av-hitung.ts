/**
 * uji/av-hitung.ts - rumus Tools Team PTS (LED, layar, proyektor, sinyal, audio, daya).
 *
 * Jalankan: npx tsx uji/av-hitung.ts
 */
import {
  hitungKoneksi, hitungDayaLED, bomLED, totalPenawaran, cadangan, unitPerRC, RECEIVING_CARD, cariModul, kunciModul, daftarBrand, brandModul, BRAND_LED,
  hitungLED, pxPerPortPada, portDibutuhkan, cabinetUntukUkuran, saranHardware, kapasitasHardware, MODUL_LED, VIDEO_PROCESSOR, SENDING_CARD, layarDariJarak, ukuranDariDiagonal,
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
  const hPf = hitungLED({ pitch: 2.5, cabLebar: 500, cabTinggi: 500, kolom: 8, baris: 6, dayaMaksCab: 150, faktorRata: 0.33, beratCab: 7.5, refresh: 60, bit: 8, tegangan: 220, faktorDaya: 0.95 });
  cek('PF 0,95: arus ~34,4 A, MCB tetap 50 A', dekat(hPf.arusMaksA, 34.45) && hPf.mcbSaranA === 50, `${hPf.arusMaksA} ${hPf.mcbSaranA}`);
  const h10 = hitungLED({ pitch: 2.5, cabLebar: 500, cabTinggi: 500, kolom: 8, baris: 6, dayaMaksCab: 150, faktorRata: 0.33, beratCab: 7.5, refresh: 60, bit: 10, tegangan: 220 });
  cek('10-bit: kapasitas port separuh 8-bit (327.680 px) -> 6 port', h10.pxPerPort === 327_680 && h10.portLAN === 6, `${h10.pxPerPort} ${h10.portLAN}`);
  cek('12-bit sama dengan 10-bit', pxPerPortPada(60, 12) === 327_680);
  //  Cabinet 960x960 P2.5 = 147.456 px -> 4 cabinet/port. 13 cabinet = 4 port,
  //  padahal total piksel / kapasitas (1,92 MP / 655 rb) cuma memberi 3.
  cek('port dihitung per cabinet utuh: 13 cabinet besar -> 4 port', portDibutuhkan(13, 384 * 384, 655_360) === 4, String(portDibutuhkan(13, 384 * 384, 655_360)));
  cek('cabinet melebihi kapasitas 1 port memakai beberapa port', portDibutuhkan(3, 800_000, 655_360) === 6);
  const s = saranHardware(h.totalPx, h.portLAN);
  cek('1.92 MP/3 port -> MCTRL600 & VX400', s.kartu?.hw.nama === 'MCTRL600' && s.kartu.qty === 1 && s.vp?.hw.nama === 'VX400', `${s.kartu?.hw.nama} ${s.vp?.hw.nama}`);
  const besar = saranHardware(20_000_000, 31);
  cek('20 MP melebihi 1 unit -> 2x UHD Jr / 3x MCTRL4K', besar.vp?.hw.nama === 'NovaPro UHD Jr' && besar.vp.qty === 2 && besar.kartu?.qty === 3, `${besar.vp?.qty} ${besar.kartu?.qty}`);
  const v1260 = VIDEO_PROCESSOR.find(v => v.nama === 'V1260')!;
  const k = kapasitasHardware(v1260, 9_000_000, 14);
  cek('V1260 (tanpa port) dihitung dari pixel saja: 9 MP -> 2 unit', k.qty === 2 && k.pembatas === 'pixel' && k.pakaiPort === 0, JSON.stringify(k));
  const m300 = kapasitasHardware(SENDING_CARD[0], 1_000_000, 3);
  cek('MCTRL300 1 MP / 3 port -> 2 kartu karena port', m300.qty === 2 && m300.pembatas === 'port');
}
{
  const c = cabinetUntukUkuran(5.2, 2.9, 500, 500);
  cek('target 5.2 x 2.9 m -> 10 x 6 cabinet', c.kolom === 10 && c.baris === 6, `${c.kolom}x${c.baris}`);
}

{
  //  Excel DWP: 10 x 5 m, P3 (modul 192 mm, 64 px) -> 52 x 26 modul, 3328 x 1664 px.
  const m = MODUL_LED.find(x => x.kode === 'P3')!;
  const c = cabinetUntukUkuran(10, 5, m.w, m.h);
  const h = hitungLED({ pitch: m.pitch, cabLebar: m.w, cabTinggi: m.h, kolom: c.kolom, baris: c.baris, pxX: m.pxW, pxY: m.pxH, dayaMaksCab: 20, faktorRata: 0.33, beratCab: 0.5, refresh: 60, bit: 8, tegangan: 220 });
  cek('P3 10x5 m -> 52x26 modul, 3328x1664 px', c.kolom === 52 && c.baris === 26 && h.resX === 3328 && h.resY === 1664, `${c.kolom}x${c.baris} ${h.resX}x${h.resY}`);
  const p186 = MODUL_LED.find(x => x.kode === 'P1.86')!;
  cek('px/modul eksplisit dipakai (P1.86 = 172 px)', hitungLED({ pitch: p186.pitch, cabLebar: 320, cabTinggi: 160, kolom: 1, baris: 1, pxX: p186.pxW, pxY: p186.pxH, dayaMaksCab: 1, faktorRata: 1, beratCab: 1, refresh: 60, bit: 8, tegangan: 220 }).resX === 172);
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

console.log('\nScreen connection (urutan kabel & port)');
{
  //  8 x 5 cabinet 500x500 P2.5 (200x200 px = 40.000 px), port 655.360 px -> maks 16 RC per port.
  const dasar = { kolom: 8, baris: 5, pxPerRC: 40_000, pxPerPort: 655_360, mulai: 'kiri-atas' as const, arah: 'horizontal' as const, pola: 'S' as const, bagi: 'baris' as const };
  const k = hitungKoneksi(dasar);
  cek('kapasitas 16 RC/port; baris utuh: 2 baris (16 RC) per port -> 3 port', k.rcPerPortMaks === 16 && k.jumlahPort === 3 && k.port.map(p => p.jumlah).join(',') === '16,16,8');
  cek('semua 40 receiving card terhubung tepat sekali', k.sel.length === 40 && new Set(k.sel.map(x => `${x.c},${x.r}`)).size === 40);
  const p1 = k.sel.filter(x => x.port === 1);
  cek('pola S dari kiri-atas: baris 1 ke kanan, baris 2 kembali ke kiri', p1[0].c === 0 && p1[0].r === 0 && p1[7].c === 7 && p1[8].c === 7 && p1[8].r === 1 && p1[15].c === 0);
  cek('urutan berkelanjutan: tiap langkah ke sel tetangga', k.sel.every((x, i) => i === 0 || k.sel[i - 1].port !== x.port || Math.abs(k.sel[i - 1].c - x.c) + Math.abs(k.sel[i - 1].r - x.r) === 1));
  const z = hitungKoneksi({ ...dasar, pola: 'Z' });
  cek('pola Z: tiap baris mulai dari kiri', z.sel.filter(x => x.urut === 9 && x.port === 1)[0].c === 0);
  const v = hitungKoneksi({ ...dasar, arah: 'vertikal', mulai: 'kanan-bawah' });
  cek('vertikal dari kanan-bawah: mulai (7,4) naik ke atas', v.sel[0].c === 7 && v.sel[0].r === 4 && v.sel[1].c === 7 && v.sel[1].r === 3);
  const penuh = hitungKoneksi({ ...dasar, bagi: 'penuh', bebanMaks: 80 });
  cek('isi penuh dengan batas beban 80%: 13 RC per port -> 4 port', penuh.rcPerPortMaks === 13 && penuh.jumlahPort === 4 && penuh.port.every(p => p.beban <= 80.0001));
  const kartu = hitungKoneksi({ ...dasar, kolom: 20, baris: 10, portPerKartu: 4 });
  cek('penomoran controller: port 5 ada di controller 2', kartu.port.find(p => p.port === 5)?.kartu === 2 && kartu.jumlahKartu === Math.ceil(kartu.jumlahPort / 4));
  const besar = hitungKoneksi({ ...dasar, pxPerRC: 800_000 });
  cek('receiving card melebihi kapasitas port -> peringatan', besar.galat !== null && besar.rcPerPortMaks === 1);
  const lebar = hitungKoneksi({ ...dasar, kolom: 20, baris: 2 });
  cek('baris 20 > kapasitas 16 -> 2 zona 10 kolom: 4 port x 10 RC, port 3 masuk di kolom 11', lebar.port.map(p => p.jumlah).join(',') === '10,10,10,10'
    && lebar.port[0].mulai?.c === 0 && lebar.port[2].mulai?.c === 10 && lebar.port[2].mulai?.r === 0);
  cek('zona: port 1 hanya kolom 1-10', lebar.sel.filter(x => x.port === 1).every(x => x.c < 10));
  const satuBaris = hitungKoneksi({ ...dasar, kolom: 12 });
  cek('baris utuh 1 baris/port: semua port masuk dari kiri walau pola S', satuBaris.port.every(p => p.mulai?.c === 0));
  const tigaBaris = hitungKoneksi({ ...dasar, kolom: 5, baris: 6 });
  cek('3 baris/port pola S: port 2 mulai lagi dari kiri, ular di dalam port', tigaBaris.port.length === 2 && tigaBaris.port[1].mulai?.c === 0
    && tigaBaris.sel.filter(x => x.port === 2)[4].c === 4 && tigaBaris.sel.filter(x => x.port === 2)[5].c === 4 && tigaBaris.sel.filter(x => x.port === 2)[5].r === 4);
  const lebarPenuh = hitungKoneksi({ ...dasar, kolom: 20, baris: 2, bagi: 'penuh' });
  cek('isi penuh pada layar lebar: 16, 16, 8 (port paling hemat)', lebarPenuh.port.map(p => p.jumlah).join(',') === '16,16,8');
  //  Custom ala NovaLCT: ukuran receiving card berbeda, sel kosong, kabel manual.
  const beda = hitungKoneksi({ ...dasar, kolom: 3, baris: 1, lebarPx: [640, 512, 256], tinggiPx: [512], pxPerPort: 655_360, bagi: 'penuh' });
  cek('ukuran berbeda: port dihitung per pixel (640+512 lebar muat, +256 tidak) -> port 2 RC + 1 RC', beda.port.map(p => p.jumlah).join(',') === '2,1'
    && beda.port[0].px === 640 * 512 + 512 * 512);
  const lubang = hitungKoneksi({ ...dasar, kosong: [[0, 0], [7, 4]] });
  cek('sel kosong dilewati kabel: 38 receiving card, (0,0) tidak terhubung', lubang.sel.length === 38 && !lubang.sel.some(x => x.c === 0 && x.r === 0) && lubang.tanpaPort.length === 0);
  const man = hitungKoneksi({ ...dasar, kolom: 3, baris: 2, manual: [[[2, 1], [1, 1], [1, 1], [9, 9]], [[0, 0]], []] });
  cek('manual: urutan dari pengguna, dobel & di luar grid diabaikan, port kosong tetap ada', man.port.length === 3 && man.port[0].jumlah === 2
    && man.sel[0].c === 2 && man.sel[0].r === 1 && man.port[2].jumlah === 0 && man.port[2].mulai === null);
  cek('manual: receiving card yang belum dikabel terdaftar', man.tanpaPort.length === 3);
  const berat = hitungKoneksi({ ...dasar, manual: [Array.from({ length: 20 }, (_, i) => [i % 8, Math.floor(i / 8)] as [number, number])] });
  cek('manual: port melebihi kapasitas ditandai', berat.lewat.join(',') === '1' && berat.port[0].beban > 100);
  const lebarKanan = hitungKoneksi({ ...dasar, kolom: 20, baris: 2, mulai: 'kanan-atas' });
  cek('zona dari kanan-atas: port 1 mulai kolom 20, zona kanan dulu', lebarKanan.port[0].mulai?.c === 19 && lebarKanan.sel.filter(x => x.port === 1).every(x => x.c >= 10));
}

console.log('\nBrand modul LED (referensi dipilah per brand)');
{
  const hik = { ...MODUL_LED[4], brand: 'Hikvision', model: 'Seri X' };
  const sendiri = { ...MODUL_LED[4], brand: 'IVP Vision', unit: 'cabinet' as const, w: 500, h: 500, pxW: 192, pxH: 192 };
  const daftar = [...MODUL_LED, hik, sendiri];
  cek('modul tanpa brand = Umum', brandModul(MODUL_LED[0]) === 'Umum');
  cek('hitungan lama (kode "P2.5") tetap menemukan modul Umum, bukan brand lain', cariModul(daftar, 'P2.5') === MODUL_LED[4]);
  cek('kunci brand|kode|model membedakan P2.5 Hikvision dari P2.5 Umum', cariModul(daftar, kunciModul(hik)) === hik && kunciModul(hik) !== kunciModul(MODUL_LED[4]));
  const br = daftarBrand([...BRAND_LED, { nama: 'IVP Vision', sendiri: true }], daftar);
  cek('brand sendiri tampil paling atas, brand dari baris modul ikut terdaftar', br[0].nama === 'IVP Vision' && br.some(b => b.nama === 'Hikvision' && b.jumlah === 1));
  cek('pilihan kalkulator hanya brand yang punya modul', daftarBrand(BRAND_LED, MODUL_LED, true).map(b => b.nama).join(',') === 'Umum');
}

console.log('\nReceiving card, power connection & BOM');
{
  const a5 = RECEIVING_CARD.find(r => r.nama === 'A5s Plus')!;
  const u = unitPerRC(a5, 128, 64, 2, 3);
  cek('A5s Plus (512×384): modul P2.5 128×64, usulan 2×3 tetap (256×192 muat)', u.kol === 2 && u.baris === 3 && u.muat);
  const besar = unitPerRC(a5, 128, 64, 6, 8);
  cek('usulan terlalu besar dikecilkan: 4×6 modul = 512×384', besar.kol === 4 && besar.baris === 6);
  cek('cabinet lebih besar dari kartu ditandai tidak muat', !unitPerRC(a5, 640, 480, 1, 1).muat);

  //  10 kolom × 4 baris cabinet 150 W, MCB 16 A @220 V PF 1, beban 80% = 2.816 W -> 18 cabinet/sirkuit.
  const d1 = hitungDayaLED({ kolom: 10, baris: 4, wattUnit: 150, tegangan: 220, faktorDaya: 1, mcb: 16, beban: 80, fase: 1, mulai: 'kiri-bawah', arah: 'vertikal', pola: 'S' });
  cek('kapasitas sirkuit = 16 A × 220 V × 80%', dekat(d1.kapasitasW, 2816) && d1.unitPerSirkuitMaks === 18);
  cek('sirkuit per kolom utuh, dibagi rata: 10 kolom -> 3 sirkuit 3/4/3 kolom (bukan 4/4/2)', d1.sirkuit.map(c => c.unit).join(',') === '12,16,12');
  cek('total daya = 40 × 150 W', dekat(d1.totalW, 6000));
  cek('tidak ada sirkuit melebihi batas', d1.sirkuit.every(c => c.watt <= d1.kapasitasW + 1e-6));
  const d3 = hitungDayaLED({ kolom: 12, baris: 4, wattUnit: 300, tegangan: 220, faktorDaya: 1, mcb: 16, beban: 80, fase: 3, mulai: 'kiri-bawah', arah: 'vertikal', pola: 'S' });
  const arus = d3.perFase.map(p => p.arus);
  cek('3 fase: sirkuit dibagi ke R, S, T', d3.perFase.map(p => p.fase).join('') === 'RST' && d3.perFase.every(p => p.sirkuit > 0));
  cek('3 fase: beban seimbang (selisih <= 1 sirkuit)', Math.max(...arus) - Math.min(...arus) <= Math.max(...d3.sirkuit.map(c => c.arus)) + 1e-6);
  cek('MCB utama per fase >= 1,25 × arus', d3.perFase.every(p => p.mcb >= p.arus * 1.25));
  cek('unit lebih besar dari sirkuit -> galat', !!hitungDayaLED({ kolom: 2, baris: 1, wattUnit: 4000, tegangan: 220, faktorDaya: 1, mcb: 16, beban: 80, fase: 1, mulai: 'kiri-bawah', arah: 'vertikal', pola: 'S' }).galat);

  cek('cadangan 3% dari 200 = 6; dari 10 = 1 (minimal 1); 0% = 0', cadangan(200, 3) === 6 && cadangan(10, 3) === 1 && cadangan(10, 0) === 0);
  const bom = bomLED({ satuan: 'modul', namaLED: 'P2.5', unit: 200, screen: 1, cadanganUnit: 3, receivingCard: 20, namaRC: 'A5s Plus', cadanganRC: 2,
    controller: [{ nama: 'VX600', qty: 1 }], controllerCadangan: false, dayaMaksW: 6000, psuW: 200, port: 3, portCadangan: 3, panjangLAN: 10,
    sirkuit: 3, mcb: 16, panjangPower: 15, lebarM: 4, tinggiM: 2.24, baris: 14 });
  const q = (k: string) => bom.find(b => b.kunci === k)?.qty;
  cek('BOM: modul 200 + spare 6', q('unit') === 200 && q('unit-cadangan') === 6);
  cek('BOM: PSU = 6000 W / (200 W × 80%) = 38', q('psu') === 38);
  cek('BOM: LAN jumper = RC - port = 17, LAN utama = 3 + 3 cadangan', q('lan-jumper') === 17 && q('lan-utama') === 6);
  cek('BOM: MCB per sirkuit & controller ikut', q('mcb') === 3 && q('ctrl-0') === 1);
  const bomCab = bomLED({ satuan: 'cabinet', namaLED: 'P3.9', unit: 24, screen: 2, cadanganUnit: 0, receivingCard: 24, namaRC: '', cadanganRC: 0,
    controller: [{ nama: 'MCTRL660', qty: 1 }], controllerCadangan: true, dayaMaksW: 9000, psuW: 200, port: 4, portCadangan: 0, panjangLAN: 20,
    sirkuit: 4, mcb: 20, panjangPower: 10, lebarM: 3, tinggiM: 2, baris: 4 });
  cek('BOM cabinet: tanpa PSU terpisah, tanpa baris qty 0, controller cadangan = 2 × 2 screen', !bomCab.some(b => b.kunci === 'psu') && bomCab.every(b => b.qty > 0)
    && bomCab.find(b => b.kunci === 'ctrl-0')?.qty === 4);
  const t = totalPenawaran([{ kunci: 'a', qty: 2 }, { kunci: 'b', qty: 3 }], { a: 1_000_000, b: 500_000 }, 11);
  cek('penawaran: subtotal, PPN 11%, total', t.subtotal === 3_500_000 && t.ppn === 385_000 && t.total === 3_885_000);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
