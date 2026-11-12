import { existsSync, readFileSync, statSync } from 'node:fs';
import { bacaBom, isiDariBom, modelBom } from '../lib/sld/bom';
import { FOTO_PRODUK, fotoSah } from '../lib/sld/foto-produk';
import { bersihkanItemTim, fotoLokal, idFotoTim, perangkatDariTim, POLA_DATA_FOTO_TIM, segarkanFotoTim, urlFotoTim, type ItemTim } from '../lib/sld/katalog-tim';
import { isiPreset, presetKabel } from '../lib/sld/preset-kabel';
import { contohVoiceKamar } from '../lib/sld/contoh';
import { bersihkanDok, dokBaru, hapusPerangkat, hurufSah, kabelYatim, kabelBaru, pasangFoto, perangkatBaru, petaFoto, tanpaFoto, teksBaru, ubahKertas } from '../lib/sld/dok';
import { GAYA_KABEL } from '../lib/sld/gaya';
import { geometri, kodeKabel, kotakTampak, sisiOtomatis } from '../lib/sld/geometri';
import { dinding, gridVideowall, rasioDinding, ukuranLed } from '../lib/sld/dinding';
import { DAFTAR_IKON } from '../lib/sld/ikon';
import { KATALOG, tebakTemplat } from '../lib/sld/katalog';
import { buatVsdx } from '../lib/sld/vsdx';
import ExcelJS from 'exceljs';
import { bagianBoq, barisBoq, CSS_BOQ, htmlBoq, infoBoq, judulBoq, KOLOM_BOQ, pisahMerek } from '../lib/sld/boq';
import { geserObjek, hapusObjek, idDalamKotak, jepret, posisiAwal, ratakan, salinObjek, tempelKlip } from '../lib/sld/pilih';
import { letakLabel } from '../lib/sld/lembar1';
import { labelZona, svgZona } from '../lib/sld/zona';
import { areaDok } from '../lib/sld/tipe';
import { tabrak } from '../lib/sld/rute';
import { dokRuang, gabungRuang, hapusRuang, jumlahRuang, namaiRuang, semuaPerangkat, tambahRuang } from '../lib/sld/ruang';
import { bukuExcel } from '../lib/sld/excel';
import { svgLembar1 } from '../lib/sld/lembar1';
import { isiLembar2, svgLembar2 } from '../lib/sld/lembar2';
import { bungkus } from '../lib/sld/teks';
import { bacaZip, crc32, tulisZip } from '../lib/sld/zip';
import { barisKoneksi, barisPerangkat, fungsiOtomatis, grupModel, jenisTerpakai, kartuGambar, noOtomatis, periksaDok } from '../lib/sld/turunan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}

const d = contohVoiceKamar('Penguji');

console.log('\n1. Penomoran & tabel');
{
  const kode = kodeKabel(d.kabel);
  const urut = d.kabel.map(c => kode.get(c.id));
  cek('kabel sinyal K1..K10, catu daya P1', urut.join(',') === 'K1,K2,K3,K4,K5,K6,K7,K8,K9,K10,P1', urut.join(','));
  const k = barisKoneksi(d);
  cek('tabel koneksi: K dulu lalu P', k[0].kode === 'K1' && k[k.length - 1].kode === 'P1');
  cek('kolom Dari = nama · port', k[0].dari === 'Speakerphone HALO 80 · USB-C', k[0].dari);
  cek('kabel bus / rantai: satu baris per perangkat tujuan (K5.1, K5.2)', k[4].kode === 'K5.1' && k[4].ke.startsWith('Modul relay 8 #1') && k[5].kode === 'K5.2' && k[5].ke.startsWith('Modul relay 8 #2'), k.map(x => x.kode).join(','));
  cek('ujung teks bebas (P1) tetap tertulis', k[k.length - 1].dari === 'MCB panel listrik');
  const p = barisPerangkat(d);
  cek('Daftar Perangkat urut No. BOM, item tanpa No. tidak masuk', p.map(r => r.no).join(',') === '1,2,3,4,5,6,7', p.map(r => r.no).join(','));
  cek('dua modul relay No. sama digabung jadi 2 unit', p.find(r => r.no === '4')?.qty === '2 unit');
  const kartu = kartuGambar(d);
  cek('kartu gambar satu per No. BOM, judul tanpa "#1"', kartu.length === 7 && kartu[3].judul === 'Modul relay 8', kartu[3]?.judul);
  cek('legend hanya jenis kabel yang tergambar', jenisTerpakai(d).join(',') === 'usb,catx,ac', jenisTerpakai(d).join(','));
}

console.log('\n2. Garis kabel');
{
  const kiri = { x: 0, y: 0, w: 20, h: 10 }, kanan = { x: 60, y: 2, w: 20, h: 10 }, bawah = { x: 2, y: 80, w: 20, h: 10 };
  cek('perangkat berjajar mendatar -> sisi kanan', sisiOtomatis(kiri, kanan) === 'kanan');
  cek('perangkat di bawah -> sisi bawah', sisiOtomatis(kiri, bawah) === 'bawah');
  const g = geometri(d);
  cek('P1 (tanpa gambar) tidak digambar', g.length === 10, String(g.length));
  const k5 = g.find(x => x.kode === 'K5')!;
  cek('K5 punya dua garis (bus bercabang), titik awal sekali', k5.garis.length === 2 && k5.garis.filter(x => x.awal).length === 1);
  cek('semua segmen garis lurus mendatar / tegak', g.every(x => x.garis.every(gr => gr.titik.every((t, i) => i === 0 || t.x === gr.titik[i - 1].x || t.y === gr.titik[i - 1].y))));
  const k1 = g.find(x => x.kode === 'K1')!;
  cek('label garis mendatar di atas garis', k1.label.y < k1.garis[0].titik[0].y);
  const geser = { ...d, kabel: d.kabel.map(c => (c.id === d.kabel[1].id ? { ...c, tengah: 120 } : c)) };
  const k2 = geometri(geser).find(x => x.kode === 'K2')!;
  cek('jalur bisa digeser lewat "tengah"', k2.garis[0].titik.some(t => t.y === 120), JSON.stringify(k2.garis[0].titik));
}

console.log('\n3. Template ekspor tetap (acuan SLD final)');
{
  const s1 = svgLembar1(d), s2 = svgLembar2(d);
  cek('A3 landscape 420 x 297 mm', s1.includes('viewBox="0 0 420 297"') && s1.includes('width="420mm" height="297mm"'));
  cek('strip kiri: Legend, PROJECT, Drawn by/Date/Checked by/Approved by, Drawing No., Scale, SHEET, Rev.',
    ['>Legend<', '>PROJECT : Voice Control Kamar Pasien<', '>Drawn by<', '>Date<', '>Checked by<', '>Approved by<', '>Drawing No.<', '>Scale :<', '>SHEET<', '>1 of 2<', '>Rev.<'].every(t => s1.includes(t)));
  cek('warna kabel baku: CATX #13a3e0, USB #111111, 230 VAC #8d5524', GAYA_KABEL.catx.warna === '#13a3e0' && GAYA_KABEL.usb.warna === '#111111' && GAYA_KABEL.ac.warna === '#8d5524');
  cek('legend memakai nama baku', ['>USB Cable<', '>CATX Cable<', '>Power 230 VAC<'].every(t => s1.includes(t)));
  cek('label perangkat: #nama tebal, *peran merah', s1.includes('>#Mini PC Windows 11<') && s1.includes('fill="#e00000" font-weight="700" text-anchor="start">*Server Voice Command<'));
  cek('label garis "K1 · USB-A ↔ USB-C"', s1.includes('>K1 · USB-A ↔ USB-C<'));
  const logo = (s: string) => [(s.match(/<image id="sld-wm" href="\/sld\/watermark.png"/g) ?? []).length, (s.match(/<use href="#sld-wm"/g) ?? []).length].join('/');
  cek('watermark: logo disimpan sekali, diulang 27 kali per lembar', logo(s1) === '1/27' && logo(s2) === '1/27', `${logo(s1)} ${logo(s2)}`);
  const kolom = ['>No<', '>Dari (perangkat · port)<', '>Ke (perangkat · port)<', '>Kabel / media<', '>Fungsi<', '>Catatan<'];
  cek('sheet 2: kolom Daftar Koneksi persis', kolom.every(t => s2.includes(t)));
  cek('sheet 2: kolom Daftar Perangkat persis', ['>Kategori<', '>Merek / model<', '>Qty<'].every(t => s2.includes(t)));
  cek('sheet 2: judul seksi baku', ['DAFTAR KONEKSI (K = sinyal / kontrol, P = catu daya) - nomor K = label kabel di sheet 1', 'GAMBAR PERANGKAT (No. = item BOM Rev1)',
    'DAFTAR PERANGKAT (= BOM Rev1)', '>CATATAN PEMASANGAN<'].every(t => s2.includes(t)));
  cek('sheet 2: blok judul baku', ['>SINGLE LINE DIAGRAM<', '>PROYEK<', '>ROOM<', '>ACUAN<', '>NO. GAMBAR<', '>REV<', '>TANGGAL<', '>SKALA<', '>KERTAS<', '>HAL<', '>Tanpa skala<', '>A3<',
    '>2 / 2 · Koneksi &amp; catatan<'].every(t => s2.includes(t)));
  cek('sheet 2: warna tabel baku', s2.includes('fill="#eaeef2" stroke="#8c959f"') && s2.includes('fill="#f6f8fa" stroke="#afb8c1"'));
  cek('teks pengguna di-escape', svgLembar1({ ...d, blok: { ...d.blok, proyek: '<script>' } }).includes('PROJECT : &lt;script&gt;'));
  const banyak = { ...d, kabel: Array.from({ length: 90 }, (_, i) => kabelBaru(d.perangkat[0].id, d.perangkat[1].id, { fungsi: `fungsi ${i}` })) };
  const lanjut = isiLembar2(banyak), semuaHal = lanjut.svgs.join('');
  cek('tabel kepanjangan berlanjut ke lembar berikutnya, tidak ada baris hilang', lanjut.info.halaman >= 2 && lanjut.info.terpotongKoneksi === 0 && lanjut.info.terpotongPerangkat === 0
    && semuaHal.includes('DAFTAR KONEKSI - lanjutan') && semuaHal.includes('2 / 2 · hal 2 dari') && semuaHal.includes('>fungsi 89<') && semuaHal.includes('>fungsi 0<')
    && lanjut.svgs[0] !== lanjut.svgs[1] && isiLembar2(d).info.halaman === 1, `${lanjut.info.halaman} hal`);
  cek('bungkus teks memecah baris panjang', bungkus('Pilih HALO 80 di 4-ATUR-MIKROFON.bat & jadikan Output default Windows', 52, 2.3).length === 2);
}

console.log('\n4. Simpan & muat');
{
  const b = bersihkanDok(JSON.parse(JSON.stringify(d)));
  cek('dokumen contoh lolos pembersihan tanpa kehilangan isi', !!b && b.perangkat.length === d.perangkat.length && b.kabel.length === d.kabel.length && b.catatan.length === 3);
  cek('isian rusak ditolak', bersihkanDok(null) === null && bersihkanDok('x') === null);
  const jahat = bersihkanDok({ perangkat: [{ id: 'a', gambar: 'javascript:alert(1)', x: 99999, w: -5 }], kabel: [{ id: 'k', jenis: 'zzz' }] })!;
  cek('gambar non data-URL dibuang, posisi & ukuran dibatasi, jenis kabel tak dikenal -> lain',
    !jahat.perangkat[0].gambar && jahat.perangkat[0].x < 420 && jahat.perangkat[0].w >= 12 && jahat.kabel[0].jenis === 'lain');
  const tanpa = hapusPerangkat(d, d.perangkat[1].id);
  cek('hapus perangkat: kabelnya ikut hilang dari Sheet 2', tanpa.kabel.length === d.kabel.length - 2 && !barisKoneksi(tanpa).some(r => r.dari.includes('Mini PC') || r.ke.includes('Mini PC')));
  const bus = d.kabel.find(c => c.cabang.length)!, tanpaR1 = hapusPerangkat(d, bus.ke.p);
  cek('hapus perangkat di tengah bus: cabang lain tetap tersambung', tanpaR1.kabel.find(c => c.id === bus.id)?.ke.p === bus.cabang[0].p);
  cek('kabel yatim (perangkat sudah dihapus) terdeteksi', kabelYatim({ ...d, perangkat: d.perangkat.slice(1) }).length > 0 && kabelYatim(d).length === 0);
  const kosong = dokBaru();
  const satu = { ...kosong, perangkat: [perangkatBaru('switch', 50, 50)] };
  cek('pemeriksaan: perangkat tanpa kabel dilaporkan', periksaDok(satu).length === 1 && /belum punya kabel/.test(periksaDok(satu)[0].pesan));
  const sw = perangkatBaru('switch', 50, 50), sw2 = { ...perangkatBaru('switch', 120, 50), id: 'sw2' }, tv = { ...perangkatBaru('tv-tcl', 200, 50), no: '3' };
  const auto = { ...kosong, perangkat: [sw, sw2, tv, perangkatBaru('tirai', 50, 150), perangkatBaru('lampu', 120, 150)] };
  const ba = barisPerangkat(auto);
  cek('Sheet 2 otomatis: perangkat tanpa No. dinomori setelah No. BOM, model sama digabung', ba.map(r => `${r.no}:${r.qty}`).join(',') === '3:1 unit,4:2 unit', ba.map(r => `${r.no}:${r.qty}`).join(','));
  cek('Sheet 2 otomatis: tirai & lampu (bukan pasokan) tidak masuk, kartu gambar ikut', kartuGambar(auto).length === 2 && noOtomatis(auto).get(sw.id) === '4' && !noOtomatis(auto).has(auto.perangkat[3].id));
  const kb = kabelBaru(sw.id, tv.id, { jenis: 'hdmi', fungsi: '' });
  cek('kolom Fungsi kosong diisi otomatis dari jenis kabel', barisKoneksi({ ...auto, kabel: [kb] })[0].fungsi === 'Sinyal video + audio'
    && fungsiOtomatis({ ...kb, jenis: 'catx', teksGaris: 'Cat6 PoE+' }) === 'Data + daya PoE' && barisKoneksi(d).every(r => { const c = d.kabel.find(x => x.id === r.id)!; return !c.fungsi.trim() || r.fungsi === c.fungsi; }));
}

console.log('\n5. Foto hanya di browser & impor BOM');
void (async () => {
  const foto = 'data:image/png;base64,iVBORw0KGgo=';
  const berfoto = { ...d, perangkat: d.perangkat.map((p, i) => (i === 0 ? { ...p, gambar: foto, rasio: 1.5 } : p)) };
  const draf = JSON.stringify(tanpaFoto(berfoto));
  cek('draf / data untuk server tidak membawa foto', !draf.includes('data:image') && tanpaFoto(berfoto).perangkat.every(p => !p.gambar));
  const peta = petaFoto(berfoto);
  cek('foto dipisah per perangkat lalu dipasang kembali', Object.keys(peta).length === 1 && pasangFoto(tanpaFoto(berfoto), peta).perangkat[0].gambar === foto);
  cek('foto rusak di penyimpanan lokal diabaikan', !pasangFoto(tanpaFoto(berfoto), { [d.perangkat[0].id]: { gambar: 'javascript:x' } }).perangkat[0].gambar);

  const te = new TextEncoder();
  cek('crc32 baku', crc32(te.encode('123456789')) === 0xcbf43926);
  const z = tulisZip([{ nama: 'a.txt', isi: te.encode('halo') }, { nama: 'd/b.bin', isi: new Uint8Array([1, 2, 3]) }]);
  const zb = await bacaZip(z);
  cek('tulis lalu baca ZIP utuh', new TextDecoder().decode(zb.get('a.txt')) === 'halo' && zb.get('d/b.bin')?.join(',') === '1,2,3');

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row>'
    + '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c><c r="D3" t="s"><v>4</v></c><c r="E3" t="s"><v>5</v></c>'
    + '<c r="H3" t="s"><v>6</v></c></row><row r="4"><c r="A4"><v>1</v></c><c r="C4" t="s"><v>7</v></c><c r="D4" t="s"><v>8</v></c><c r="E4" t="s"><v>9</v></c>'
    + '<c r="H4"><v>2</v></c></row><row r="5"><c r="A5"><v>2</v></c><c r="D5" t="s"><v>10</v></c><c r="E5" t="inlineStr"><is><t>Mini PC</t></is></c>'
    + '<c r="H5"><v>1</v></c></row></sheetData></worksheet>';
  const kata = ['BILL OF MATERIALS', 'No', 'Gambar', 'Kategori', 'Merek', 'Model / Part No.', 'Qty', 'Kontrol &amp; Relay', 'CUE', 'relayCUE-8', 'Sesuai pengadaan'];
  const drawing = '<xdr:wsDr><xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:row>3</xdr:row></xdr:from><xdr:pic><xdr:blipFill>'
    + '<a:blip r:embed="rId1"/><a:srcRect l="10000" t="20000"/></xdr:blipFill></xdr:pic></xdr:oneCellAnchor></xdr:wsDr>';
  const xlsx = tulisZip([
    { nama: 'xl/workbook.xml', isi: te.encode('<workbook><sheets><sheet name="BOM" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { nama: 'xl/_rels/workbook.xml.rels', isi: te.encode('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
    { nama: 'xl/sharedStrings.xml', isi: te.encode(`<sst>${kata.map(k => `<si><t>${k}</t></si>`).join('')}</sst>`) },
    { nama: 'xl/worksheets/sheet1.xml', isi: te.encode(sheet) },
    { nama: 'xl/worksheets/_rels/sheet1.xml.rels', isi: te.encode('<Relationships><Relationship Id="rId2" Target="../drawings/drawing1.xml"/></Relationships>') },
    { nama: 'xl/drawings/drawing1.xml', isi: te.encode(drawing) },
    { nama: 'xl/drawings/_rels/drawing1.xml.rels', isi: te.encode('<Relationships><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>') },
    { nama: 'xl/media/image1.png', isi: png },
  ]);
  const bom = await bacaBom(xlsx);
  cek('BOM: baris bernomor terbaca dengan kolom dari judul tabel',
    bom.length === 2 && bom[0].no === '1' && bom[0].model === 'relayCUE-8' && bom[0].qty === 2 && bom[0].kategori === 'Kontrol & Relay',
    JSON.stringify(bom.map(b => [b.no, b.model, b.qty, b.kategori])));
  cek('BOM: foto tertambat ke barisnya, potongan Excel ikut',
    bom[0].foto?.mime === 'image/png' && bom[0].foto.isi.length === png.length && bom[0].foto.potong?.l === 0.1 && bom[0].foto.potong?.t === 0.2 && !bom[1].foto);
  cek('BOM: teks inline terbaca', bom[1].model === 'Mini PC');
  cek('merek / model mengikuti gaya Daftar Perangkat',
    modelBom(bom[0]) === 'CUE relayCUE-8' && modelBom(bom[1]) === 'Mini PC (sesuai pengadaan)' && isiDariBom(bom[1]).subGambar === 'sesuai pengadaan');

  console.log('\n6. Visio, watermark & katalog');
  const wm = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9]);
  const gambarV = new Map(d.perangkat.map(p => [p.id, { isi: wm, jpeg: false }]));
  const paket = await bacaZip(buatVsdx({ dok: d, gambar: gambarV, watermark: { isi: wm, jpeg: false } }));
  const teks = (nm: string) => new TextDecoder().decode(paket.get(nm));
  cek('VSDX: semua bagian wajib ada (termasuk windows.xml yang diminta Visio)',
    ['[Content_Types].xml', '_rels/.rels', 'visio/document.xml', 'visio/windows.xml', 'visio/pages/pages.xml', 'visio/pages/page1.xml', 'visio/pages/page2.xml'].every(x => paket.has(x)));
  cek('VSDX: bagian paket memakai kutip ganda (dibaca OPC Visio)', teks('[Content_Types].xml').startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'));
  const garisV = geometri(d).reduce((s, g) => s + g.garis.length, 0);
  cek('VSDX: tiap garis kabel jadi connector yang menempel di kedua ujung', (teks('visio/pages/page1.xml').match(/<Connect /g) ?? []).length === garisV * 2, String(garisV));
  cek('VSDX: ujung connector memakai rumus glue ke titik sambung', /BeginX' V='[^']*' F='PAR\(PNT\(Sheet\.\d+!Connections\.X\d+/.test(teks('visio/pages/page1.xml')));
  cek('VSDX: tiap baris karakter menulis FontScale (huruf tidak menyempit)', !/<Section N='Character'><Row IX='1'>(?:(?!FontScale).)*?<\/Row>/.test(teks('visio/pages/page1.xml')));
  cek('VSDX: sheet 2 memuat tabel & blok judul', teks('visio/pages/page2.xml').includes('DAFTAR KONEKSI') && teks('visio/pages/page2.xml').includes('SINGLE LINE DIAGRAM'));
  const tanpaWm = { ...d, watermark: false };
  const paket2 = await bacaZip(buatVsdx({ dok: tanpaWm, gambar: gambarV, watermark: { isi: wm, jpeg: false } }));
  cek('watermark dimatikan: tidak ada di SVG maupun Visio',
    !svgLembar1(tanpaWm).includes('sld-wm') && !svgLembar2(tanpaWm).includes('sld-wm') && !new TextDecoder().decode(paket2.get('visio/pages/page1.xml')).includes("NameU='Watermark'"));
  cek('watermark diganti logo sendiri', svgLembar1(d, { watermark: 'data:image/png;base64,AAAA' }).includes('href="data:image/png;base64,AAAA"'));
  const ikonAda = new Set(DAFTAR_IKON.map(i => i.v));
  cek('setiap templat katalog punya ilustrasi', KATALOG.every(t => ikonAda.has(t.ikon)), KATALOG.filter(t => !ikonAda.has(t.ikon)).map(t => t.k).join(','));
  cek('katalog memuat Display TCL & Philips BDL, middleware WyreStorm, sumber input', ['tv-tcl', 'signage-philips', 'matrix', 'presentasi', 'extender', 'avoip', 'laptop', 'pc', 'nvr', 'kamera', 'mediaplayer']
    .every(k => KATALOG.some(t => t.k === k)));
  cek('tebak jenis dari kode model', tebakTemplat('WyreStorm MX-0404-SCL') === 'matrix' && tebakTemplat('Philips 55BDL4650D') === 'signage-philips'
    && tebakTemplat('NHD-120-TX') === 'avoip' && tebakTemplat('EX-70-H2') === 'extender' && tebakTemplat('NVR 16 channel') === 'nvr', tebakTemplat('NHD-120-TX'));
  console.log('\n7. Foto produk asli');
  const ilustrasiSaja = ['tirai', 'gorden', 'lampu', 'ac', 'fcu', 'mcb', 'ups', 'rak', 'umum', 'laptop', 'pc', 'speaker', 'videowall', 'led'];
  const tanpaFotoAV = KATALOG.filter(t => !t.foto && !ilustrasiSaja.includes(t.k)).map(t => t.k);
  cek('semua produk AV di katalog punya foto asli bawaan', !tanpaFotoAV.length, tanpaFotoAV.join(','));
  cek('tirai, gorden, lampu, AC/FCU tetap ilustrasi', ['tirai', 'gorden', 'lampu', 'ac', 'fcu'].every(k => !KATALOG.find(t => t.k === k)?.foto));
  cek('setiap foto bawaan ada berkasnya & di bawah 100 KB', Object.values(FOTO_PRODUK).every(f => existsSync(`public${f.src}`) && statSync(`public${f.src}`).size < 100_000));
  const m = perangkatBaru('matrix', 50, 50);
  cek('perangkat baru dari katalog langsung memakai foto & rasio aslinya', m.foto === '/sld/produk/mx-0404-scl.jpg' && Math.abs((m.rasio ?? 0) - 428 / 194) < 0.01);
  const dm = { ...dokBaru(), perangkat: [m] };
  cek('sheet 1 & 2 menampilkan foto asli', svgLembar1(dm).includes('href="/sld/produk/mx-0404-scl.jpg"') && svgLembar2({ ...dm, perangkat: [{ ...m, no: '1' }] }).includes('/sld/produk/mx-0404-scl.jpg'));
  const bersih = bersihkanDok({ perangkat: [{ ...m }, { ...m, id: 'x2', foto: 'https://contoh.com/a.jpg' }] })!;
  cek('jalur foto bawaan dipertahankan, URL luar dibuang', bersih.perangkat[0].foto === m.foto && !bersih.perangkat[1].foto);
  cek('contoh SLD memakai foto asli (HALO 80, NUC, Philips, Netgear, CUE)', ['halo-80', 'asus-nuc', 'philips-10bdl3351t', 'netgear-m4250', 'controlcue', 'relaycue', 'tcl-tv']
    .every(k => d.perangkat.some(p => p.foto === `/sld/produk/${k}.jpg`)));
  console.log('\n8. Kabel, judul & simpan server');
  const pr = presetKabel('hdmi');
  cek('preset kabel bisa dipilih (bukan selalu Cat6)', isiPreset(pr).jenis === 'hdmi' && isiPreset(pr).teksGaris === 'HDMI' && presetKabel('tidak-ada').k === 'cat6');
  cek('Approved by bawaan DWP, juga untuk draf lama yang kosong', dokBaru().blok.disetujui === 'DWP'
    && bersihkanDok({ ...dokBaru(), blok: { ...dokBaru().blok, disetujui: '' } })!.blok.disetujui === 'DWP');
  const mig = readFileSync('supabase/migrations/069_tools_sld.sql', 'utf8');
  cek('migrasi: tabel SLD, versi & tautan request dengan RLS aktif', ['tools_sld', 'tools_sld_versi', 'request_sld'].every(t => mig.includes(`alter table public.${t} enable row level security`)));
  cek('migrasi: fungsi simpan hanya untuk service role (optimistic locking)', mig.includes("raise exception 'konflik'")
    && /revoke all on function public\.tools_simpan_sld[^;]*from public, anon, authenticated/.test(mig) && /grant execute on function public\.tools_simpan_sld[^;]*to service_role/.test(mig));
  const rute = readFileSync('app/api/tools-team/sld/route.ts', 'utf8');
  cek('route simpan membuang foto pengguna sebelum ke server', rute.includes('tanpaFoto(dok)') && rute.includes('pastikanMasuk'));
  console.log('\n9. Mode Simple & tautan Request Design');
  const s1 = svgLembar1(d, { simple: true }), f1 = svgLembar1(d);
  cek('Simple: strip Sheet 1 menulis 1 of 1 tanpa sub judul sheet', s1.includes('1 of 1') && !s1.includes('Sheet 1 : diagram') && f1.includes('1 of 2') && f1.includes('Sheet 1 : diagram'));
  const gb = new Map(d.perangkat.map(p => [p.id, { isi: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), jpeg: false }]));
  const vs = await bacaZip(buatVsdx({ dok: d, gambar: gb, simple: true })), vl = await bacaZip(buatVsdx({ dok: d, gambar: gb }));
  const halVs = new TextDecoder().decode(vs.get('visio/pages/pages.xml'));
  cek('Simple: Visio hanya 1 halaman, Full Detail 2 halaman', vs.has('visio/pages/page1.xml') && !vs.has('visio/pages/page2.xml') && vl.has('visio/pages/page2.xml')
    && (halVs.match(/<Page /g) ?? []).length === 1 && !new TextDecoder().decode(vs.get('[Content_Types].xml')).includes('page2.xml'));
  const ruteReq = readFileSync('app/api/form-require-project/[id]/sld/route.ts', 'utf8');
  cek('isi SLD tertaut hanya lewat request yang boleh diakses pengguna', ruteReq.includes("searchParams.get('tautan')") && ruteReq.includes(".eq('request_id', request.id)") && ruteReq.includes('klienSebagaiUser(user)'));
  const panelReq = readFileSync('app/(portal)/form-require-project/_components/detail/PanelLampiranDetail.tsx', 'utf8');
  const paketReq = readFileSync('app/(portal)/form-require-project/_components/paket-unduhan.ts', 'utf8');
  const cetakReq = readFileSync('app/(portal)/form-require-project/_components/cetak-request.ts', 'utf8');
  cek('Request Design: SLD opsional seperti Design 3D (menu unggah, panel, cetak, paket .zip)', panelReq.includes('SLD dari AV Solution Tools') && panelReq.includes('mintaPilih={mintaPilihSld}')
    && paketReq.includes('berkasPaketSld') && cetakReq.includes('htmlSeksiSld'));
  console.log('\n10. Videowall, LED, layar proyektor & putar');
  const g43 = gridVideowall('Videowall 4 x 3 panel 55"'), g0 = gridVideowall('Videowall'), gm = gridVideowall('4 x 2,25 m');
  cek('videowall: susunan kolom x baris dibaca dari nama / keterangan (bawaan 3 x 2)', g43.kol === 4 && g43.bar === 3 && g0.kol === 3 && g0.bar === 2 && gm.kol === 3,
    JSON.stringify([g43, g0, gm]));
  const u1 = ukuranLed('LED P2.5 5 x 2,5 m'), u2 = ukuranLed('3840 x 2160 mm'), u3 = ukuranLed('8 x 4 kabinet');
  cek('LED: ukuran meter / mm / jumlah kabinet dibaca, kabinet 0,5 m', u1.w === 5 && u1.kol === 10 && u1.bar === 5 && Math.abs(u2.w - 3.84) < 1e-9
    && u3.w === 4 && u3.h === 2 && u3.kol === 8 && u3.bar === 4, JSON.stringify([u1, u2, u3]));
  const vw = dinding('videowall', { ket: 'Susunan 3 x 3' })!, ld = dinding('led', { nama: 'LED 6 x 2 m' })!;
  const href = [...vw.isi.matchAll(/href="(\/sld\/[^"]+)"/g), ...ld.isi.matchAll(/href="(\/sld\/[^"]+)"/g)].map(m => m[1]);
  cek('videowall otomatis: 9 panel berisi konten dari foto videowall asli', (vw.isi.match(/<use href="#sldd-vw-/g) ?? []).length === 9 && href.includes('/sld/produk/vw-isi-1.jpg'));
  cek('LED: satu konten layar penuh tanpa garis kabinet (beda dengan videowall) + profil kabinet asli', !ld.isi.includes('<use ') && !ld.isi.includes('stroke="#000"')
    && ld.isi.includes('clip-path="url(#sldd-led-300)"') && href.includes('/sld/produk/led-profil.jpg') && (ld.isi.match(/href="\/sld\/produk\/led-isi\.jpg"/g) ?? []).length === 1);
  cek('gambar videowall & LED memakai berkas foto yang ada (ikut tersemat saat ekspor)', href.every(h => /^\/sld\/produk\/[a-z0-9-]+\.jpg$/.test(h) && existsSync(`public${h}`)));
  cek('rasio kotak videowall / LED mengikuti ukuran', Math.abs(rasioDinding('led', { nama: 'LED 6 x 2 m' })! - ld.rasio) < 1e-9
    && rasioDinding('led', { ket: '8 x 2 m' })! > rasioDinding('led', { ket: '4 x 2 m' })! && rasioDinding('tv') === null);
  const ledBaru = perangkatBaru('led', 50, 50);
  cek('LED baru dari katalog: tinggi kotak mengikuti ukuran di keterangan', Math.abs(ledBaru.w / ledBaru.h - rasioDinding('led', ledBaru)!) < 0.1, `${ledBaru.w}x${ledBaru.h}`);
  cek('katalog: NovaStar sending box, video processor, layar motorized & fixed frame', tebakTemplat('NovaStar MCTRL660 PRO') === 'sending-box'
    && tebakTemplat('Pontus video wall controller') === 'videoprocessor' && tebakTemplat('Layar proyektor motorized 100"') === 'layar-motor'
    && tebakTemplat('Fixed frame screen 120"') === 'layar-frame' && tebakTemplat('LED P2.5 indoor') === 'led' && tebakTemplat('LED TV 55') === 'tv-tcl'
    && ['sending-box', 'videoprocessor', 'layar-motor', 'layar-frame'].every(k => !!KATALOG.find(t => t.k === k)?.foto));
  const tegak = { ...perangkatBaru('tv-tcl', 100, 100), w: 40, h: 25, rasio: 1.6 }, miring = { ...tegak, putar: 90 };
  const kt = kotakTampak(tegak), km = kotakTampak(miring);
  cek('putar 90°: kotak sambung kabel ikut berputar (lebar <-> tinggi)', Math.abs(kt.w - 40) < 1e-9 && Math.abs(km.h - 25) < 1e-9 && Math.abs(km.w - 25 / 1.6) < 1e-9);
  const dm2 = { ...dokBaru(), perangkat: [miring] };
  cek('putar: gambar di sheet 1 diputar, kartu sheet 2 tetap tegak', svgLembar1(dm2).includes('rotate(90 ') && !svgLembar2({ ...dm2, perangkat: [{ ...miring, no: '1' }] }).includes('rotate(90 '));
  const balik = { ...tegak, balikH: true }, dbl = { ...dokBaru(), perangkat: [balik] };
  cek('balik horizontal / vertikal: gambar sheet 1 dicerminkan, kotak sambung tidak berubah', svgLembar1(dbl).includes('scale(-1 1)')
    && svgLembar1({ ...dbl, perangkat: [{ ...tegak, balikV: true }] }).includes('scale(1 -1)') && JSON.stringify(kotakTampak(balik)) === JSON.stringify(kt));
  const sb = bersihkanDok({ perangkat: [{ ...balik, id: 'a', balikV: 'ya' }] })!.perangkat[0];
  cek('balik: hanya nilai true yang disimpan', sb.balikH === true && sb.balikV === undefined);
  const petaAudio = { 'Fonestar ceiling speaker 6"': 'speaker-plafon', 'Speaker dinding 5"': 'speaker', 'NEO-8 full range': 'speaker-pa', 'Mic array ceiling tile': 'mic-array',
    'Sennheiser MD 42': 'mic-handheld', 'Receiver mic wireless 4 ch': 'receiver-wireless', 'Fonestar SCI-750': 'sentral-konferensi', 'Delegate unit': 'mic-konferensi',
    'Paperless terminal 15"': 'paperless', 'Tricolor terminal': 'paperless-tricolor', 'Monitor lift 17"': 'monitor-lift', 'AVer FONE540': 'speakerphone-aver',
    'Wallplate HDMI + USB-C': 'wallplate', 'WyreStorm HALO 80': 'speakerphone' } as Record<string, string>;
  const salah = Object.entries(petaAudio).filter(([t, k]) => tebakTemplat(t) !== k).map(([t]) => `${t} -> ${tebakTemplat(t)}`);
  cek('katalog speaker, mic, konferensi & wallplate dikenali dari BOM, semuanya berfoto', !salah.length && Object.values(petaAudio).every(k => !!KATALOG.find(t => t.k === k)?.foto), salah.join('; '));
  const sp = bersihkanDok({ perangkat: [{ ...miring, id: 'a', putar: -90 }, { ...miring, id: 'b', putar: 'x' }, { ...miring, id: 'c', putar: 450 }] })!;
  cek('putar: sudut dinormalkan 0-359 saat disimpan', sp.perangkat[0].putar === 270 && sp.perangkat[1].putar === undefined && sp.perangkat[2].putar === 90);
  const gbr = new Map([[miring.id, { isi: new Uint8Array([1]), jpeg: false }]]), kartu = new Map([[miring.id, { isi: new Uint8Array([2]), jpeg: false }]]);
  const zr = await bacaZip(buatVsdx({ dok: { ...dm2, perangkat: [{ ...miring, no: '1' }] }, gambar: gbr, kartu }));
  cek('Visio: perangkat diputar memakai gambar diputar di sheet 1 dan gambar tegak di kartu sheet 2', [...zr.keys()].filter(k => k.startsWith('visio/media/')).length === 2);
  console.log('\n11. Kanvas 16:9, teks bebas & ukuran huruf label');
  const d169 = ubahKertas(d, '169'), s169 = svgLembar1(d169);
  const yMaks = Math.max(...d169.perangkat.map(p => p.y + p.h));
  cek('16:9: sheet 1 berukuran 420 x 236,25 mm, perangkat diskalakan masuk bidang gambar', s169.includes('height="236.25mm"') && s169.includes('viewBox="0 0 420 236.25"')
    && yMaks <= 236.25 - 9 + 0.5 && svgLembar1(d).includes('height="297mm"'), `${yMaks}`);
  cek('16:9: kembali ke A3 mengembalikan tata letak (kurang dari 1 mm)', ubahKertas(d169, 'a3').perangkat.every((p, i) => Math.abs(p.y - d.perangkat[i].y) < 1.2 && Math.abs(p.w - d.perangkat[i].w) < 1.2));
  cek('16:9: kertas tersimpan & posisi dibatasi ke bidang 16:9', bersihkanDok({ ...d169, perangkat: [{ ...d169.perangkat[0], y: 280 }] })!.perangkat[0].y <= 236.25 - 9
    && bersihkanDok(d169)!.kertas === '169' && bersihkanDok({ ...d, kertas: 'x' })!.kertas === 'a3');
  const v169 = await bacaZip(buatVsdx({ dok: d169, gambar: new Map() })), halV = new TextDecoder().decode(v169.get('visio/pages/pages.xml'));
  const tinggiV = [...halV.matchAll(/N=['"]PageHeight['"] V=['"]([\d.]+)['"]/g)].map(m => Number(m[1]));
  cek('16:9: Visio sheet 1 setinggi 236,25 mm, sheet 2 tetap A3', Math.abs(tinggiV[0] - 236.25 / 25.4) < 1e-6 && Math.abs(tinggiV[1] - 297 / 25.4) < 1e-6, tinggiV.join(','));
  const tb = { ...teksBaru(120, 60, 'Ruang server\nLantai 2'), ukuran: 4, warna: 'merah' as const, tebal: true, putar: 90 };
  const dt = { ...dokBaru(), teks: [tb] }, st = svgLembar1(dt);
  cek('teks bebas: dua baris, ukuran, warna, tebal & putar tergambar di sheet 1', st.includes('>Ruang server<') && st.includes('>Lantai 2<') && st.includes('font-size="4"')
    && st.includes('fill="#e00000" font-weight="700"') && /rotate\(90 [\d.]+ [\d.]+\)">/.test(st));
  const tbs = bersihkanDok({ ...dt, teks: [{ ...tb, warna: 'ungu', ukuran: 99, isi: '' }, { isi: 'tanpa id' }] })!.teks;
  cek('teks bebas: dibersihkan (warna dikenal, ukuran dibatasi, tanpa id dibuang)', tbs.length === 1 && tbs[0].warna === 'hitam' && tbs[0].ukuran === 20 && tbs[0].isi === 'Teks');
  const vt = new TextDecoder().decode((await bacaZip(buatVsdx({ dok: dt, gambar: new Map() }))).get('visio/pages/page1.xml'));
  cek('teks bebas: ikut ke Visio sebagai shape teks', vt.includes("NameU='Teks'") && vt.includes('Ruang server'));
  const pBesar = { ...perangkatBaru('tv-tcl', 60, 60), nama: 'TV Besar', huruf: 2 }, kBesar = { ...kabelBaru(pBesar.id, pBesar.id), huruf: 1.5 };
  const sh = svgLembar1({ ...dokBaru(), perangkat: [pBesar, { ...perangkatBaru('tv-tcl', 160, 60), nama: 'TV Kecil' }] });
  cek('ukuran huruf label perangkat bisa diubah per perangkat', sh.includes('font-size="5.5" fill="#1f2328" font-weight="700" text-anchor="start">#TV Besar')
    && sh.includes('font-size="2.75" fill="#1f2328" font-weight="700" text-anchor="start">#TV Kecil'));
  const p2 = { ...perangkatBaru('tv-tcl', 160, 60), id: 'p2' }, kb2 = { ...kabelBaru(pBesar.id, 'p2'), huruf: 1.5 };
  const gk = geometri({ ...dokBaru(), perangkat: [pBesar, p2], kabel: [kb2] });
  cek('ukuran huruf label kabel bisa diubah per kabel', gk[0].huruf === 1.5 && svgLembar1({ ...dokBaru(), perangkat: [pBesar, p2], kabel: [kb2] }).includes('font-size="3"'));
  const gDok = geometri({ ...dokBaru(), huruf: { kabel: 2 }, perangkat: [pBesar, p2], kabel: [{ ...kb2, huruf: undefined }] });
  cek('ukuran huruf semua label dari pengaturan dokumen; dibatasi 0,5x - 3x', gDok[0].huruf === 2 && hurufSah(5) === 3 && hurufSah(0.1) === 0.5 && hurufSah(1) === undefined && !!kBesar);
  console.log('\n12. Sheet 3 BOQ (view, PDF & Excel)');
  const bq = barisBoq(d);
  cek('BOQ: satu baris per No. BOM, merek & model dipisah, spesifikasi & fungsi kosong', bq.length === 7 && bq[0].no === '1' && bq.every(r => r.spek === '' && r.fungsi === '')
    && pisahMerek('WyreStorm HALO 80', '').merek === 'WyreStorm' && pisahMerek('Mini PC Windows 11 (sesuai pengadaan)', '').model === 'Mini PC Windows 11'
    && pisahMerek('', 'Switch #1').merek === 'Sesuai pengadaan', JSON.stringify(bq.map(r => [r.no, r.merek, r.model])));
  const dBoq = { ...d, boq: { [bq[0].kunci]: { spek: 'Speakerphone USB, 4 mic', fungsi: 'Mic perintah suara' } } };
  cek('BOQ: isian tim (spesifikasi & fungsi) tersimpan per item dan lolos pembersihan', barisBoq(bersihkanDok(dBoq)!)[0].spek === 'Speakerphone USB, 4 mic'
    && !bersihkanDok({ ...d, boq: { x: { spek: '', fungsi: '' } } })!.boq);
  const hb = htmlBoq(dBoq);
  cek('BOQ HTML: judul, kolom & seksi sesuai contoh; harga kosong, total "-"', hb.includes(judulBoq(d)) && KOLOM_BOQ.every(k => hb.includes(`<th>${k.judul.replace('&', '&amp;')}</th>`))
    && hb.includes('A. PERANGKAT UTAMA (sesuai daftar)') && (hb.match(/<td class="harga"><\/td>/g) ?? []).length === 7 && (hb.match(/<td class="total">-<\/td>/g) ?? []).length === 7
    && hb.includes('Speakerphone USB, 4 mic'));
  cek('BOQ tema: warna & garis sama dengan contoh Excel', ['1F3864', 'D9E2F3', 'FFF2CC', 'BFBFBF', '0000FF'].every(w => CSS_BOQ.includes(w)) && CSS_BOQ.includes('Arial'));
  const png1 = { data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', ext: 'png' as const, w: 4, h: 3 };
  const xb = new ExcelJS.Workbook();
  await xb.xlsx.load((await bukuExcel({ dok: dBoq, lembar1: [png1], gambar: new Map(bq.map(r => [r.contoh.id, png1])) })) as unknown as ArrayBuffer);
  const wsq = xb.getWorksheet('Sheet 3 - BOQ')!;
  cek('Excel: 3 sheet (diagram, koneksi, BOQ)', xb.worksheets.map(w => w.name).join('|') === 'Sheet 1 - Diagram|Sheet 2 - Koneksi|Sheet 3 - BOQ' && xb.getWorksheet('Sheet 1 - Diagram')!.getImages().length === 1);
  const fill = (a: string) => ((wsq.getCell(a).fill as ExcelJS.FillPattern)?.fgColor?.argb ?? '');
  cek('Excel BOQ: judul, kepala navy huruf putih, seksi biru muda, harga kuning, garis abu', String(wsq.getCell('A1').value).startsWith('BILL OF MATERIALS')
    && wsq.getCell('F6').value === 'Spesifikasi Singkat' && fill('A6') === 'FF1F3864' && wsq.getCell('A6').font.color?.argb === 'FFFFFFFF' && fill('A7') === 'FFD9E2F3'
    && fill('J8') === 'FFFFF2CC' && wsq.getCell('A8').border.top?.color?.argb === 'FFBFBFBF' && wsq.getCell('E8').font.bold === true && wsq.getCell('H8').font.color?.argb === 'FF0000FF');
  cek('Excel BOQ: harga kosong, total = Qty x Harga dengan format Rp, isian tim ikut', wsq.getCell('J8').value === null && (wsq.getCell('K8').value as ExcelJS.CellFormulaValue).formula === 'H8*J8'
    && String(wsq.getCell('K8').numFmt).includes('Rp') && wsq.getCell('F8').value === 'Speakerphone USB, 4 mic' && wsq.getCell('F9').value === '');
  cek('Excel BOQ: lebar kolom, tinggi baris, foto per baris, kepala tercetak ulang', wsq.getColumn(6).width === 44 && wsq.getColumn(2).width === 25 && wsq.getRow(8).height === 84
    && wsq.getImages().length === 7 && wsq.pageSetup.printTitlesRow === '6:6' && wsq.views[0].showGridLines === false && wsq.getCell('A7').isMerged);
  const xs = new ExcelJS.Workbook();
  await xs.xlsx.load((await bukuExcel({ dok: d, simple: true, lembar1: [png1] })) as unknown as ArrayBuffer);
  cek('Excel mode Simple: hanya Sheet 1', xs.worksheets.length === 1);
  const sp4 = { ...perangkatBaru('speaker', 60, 60), id: 'sp4', nama: 'Speaker Ceiling', qty: 4 }, kb100 = { ...perangkatBaru('tv-tcl', 160, 60), id: 'kb', nama: 'Kabel LAN', qty: 100, satuan: 'm' };
  const dQty = { ...dokBaru(), perangkat: [sp4, kb100] }, sQty = svgLembar1(dQty);
  cek('qty: 1 gambar mewakili banyak unit tampil (4X) di sheet 1, sheet 2 & BOQ ikut menghitung', sQty.includes('>#Speaker Ceiling (4X)<') && sQty.includes('>#Kabel LAN (100 m)<')
    && !svgLembar1({ ...dQty, perangkat: [{ ...sp4, qty: 1 }] }).includes('(1X)') && barisBoq(dQty).find(b => b.contoh.id === 'sp4')!.qty === 4
    && barisPerangkat(dQty).some(b => b.qty === '4 unit') && kartuGambar(dQty).some(k => k.sub.includes('(4 unit)')));
  const dTk = bersihkanDok({ ...dQty, tanpaKoneksi: true })!;
  const xt = new ExcelJS.Workbook();
  await xt.xlsx.load((await bukuExcel({ dok: dTk, lembar1: [png1] })) as unknown as ArrayBuffer);
  const vTk = await bacaZip(buatVsdx({ dok: dTk, gambar: new Map() }));
  cek('Sheet 2 bisa dimatikan: tersimpan, sheet 1 "1 of 1", tidak ada di Visio & Excel (BOQ tetap)', dTk.tanpaKoneksi === true && svgLembar1(dTk).includes('>1 of 1<')
    && !vTk.get('visio/pages/page2.xml') && xt.worksheets.map(w => w.name).join('|') === 'Sheet 1 - Diagram|Sheet 3 - BOQ'
    && gabungRuang(tambahRuang(dTk), 1, dokRuang(tambahRuang(dTk), 1)).tanpaKoneksi === true && bersihkanDok(dQty)!.tanpaKoneksi === undefined);
  console.log('\n13. Proyek multi ruangan & BOQ bisa disesuaikan');
  const pr1 = tambahRuang({ ...d, blok: { ...d.blok, proyek: 'Gedung A', lokasi: 'RS Contoh' } }, 'Ruang Rapat');
  const r2 = dokRuang(pr1, 1), pr2 = gabungRuang(pr1, 1, { ...r2, perangkat: [perangkatBaru('tv-tcl', 60, 40), perangkatBaru('presentasi', 140, 40)] });
  cek('ruangan: tambah, buka & isi ruangan ke-2 tanpa mengubah ruangan 1', jumlahRuang(pr2) === 2 && pr2.namaRuang === 'Ruangan 1' && pr2.perangkat.length === d.perangkat.length
    && dokRuang(pr2, 1).perangkat.length === 2 && dokRuang(pr2, 1).namaRuang === 'Ruang Rapat' && dokRuang(pr2, 1).blok.proyek === 'Gedung A');
  const pr3 = gabungRuang(pr2, 1, { ...dokRuang(pr2, 1), blok: { ...pr2.blok, proyek: 'Gedung B' } });
  cek('ruangan: nama proyek & blok judul berlaku untuk semua ruangan', dokRuang(pr3, 0).blok.proyek === 'Gedung B' && semuaPerangkat(pr3).length === d.perangkat.length + 2);
  const s2 = svgLembar1(dokRuang(pr3, 1)), s2b = svgLembar2(dokRuang(pr3, 1));
  cek('ruangan: nama ruangan tampil di Sheet 1 & 2 (ROOM)', s2.includes('Ruang Rapat') && s2b.includes('Ruang Rapat') && s2b.includes('>ROOM<'));
  const disimpan = bersihkanDok(JSON.parse(JSON.stringify(tanpaFoto({ ...pr3, ruangLain: pr3.ruangLain!.map(r => ({ ...r, perangkat: r.perangkat.map(p => ({ ...p, gambar: 'data:image/png;base64,AAAA' })) })) }))))!;
  cek('ruangan: tersimpan & dibersihkan, foto unggahan ruangan lain tidak ikut ke server', jumlahRuang(disimpan) === 2 && disimpan.ruangLain![0].nama === 'Ruang Rapat'
    && disimpan.ruangLain![0].perangkat.length === 2 && disimpan.ruangLain![0].perangkat.every(p => !p.gambar));
  cek('ruangan: ganti nama, hapus ruangan ke-1 menaikkan ruangan ke-2', namaiRuang(pr3, 1, 'Lobby').ruangLain![0].nama === 'Lobby'
    && hapusRuang(pr3, 0).namaRuang === 'Ruang Rapat' && hapusRuang(pr3, 0).perangkat.length === 2 && jumlahRuang(hapusRuang(pr3, 1)) === 1);
  const k169 = ubahKertas(pr3, '169');
  cek('ruangan: ganti kertas 16:9 menskala semua ruangan', k169.ruangLain![0].perangkat[0].w < pr3.ruangLain![0].perangkat[0].w && k169.perangkat[0].w < pr3.perangkat[0].w);
  const bg = bagianBoq(pr3);
  cek('BOQ multi ruangan: satu section per ruangan, label Room berisi nama ruangan', bg.length === 2 && bg[0].judul === 'A. RUANGAN 1 (sesuai daftar)'
    && bg[1].judul === 'B. RUANG RAPAT (sesuai daftar)' && bg[1].baris.length === 2 && infoBoq(pr3)[1][0] === 'Room' && infoBoq(pr3)[1][1] === 'Ruangan 1, Ruang Rapat'
    && bagianBoq(d)[0].judul === 'A. PERANGKAT UTAMA (sesuai daftar)' && htmlBoq(pr3).includes('B. RUANG RAPAT'));
  const kn = bg[1].baris[0].kunci, pr4 = gabungRuang(pr3, 1, { ...dokRuang(pr3, 1), boq: { [kn]: { kategori: 'Display ruang rapat', merek: 'TCL', model: '65C755' } } });
  const b4 = bagianBoq(pr4)[1].baris[0];
  cek('BOQ: kategori, merek & model otomatis bisa disesuaikan tim (hanya di BOQ)', b4.kategori === 'Display ruang rapat' && b4.merek === 'TCL' && b4.model === '65C755'
    && dokRuang(pr4, 1).perangkat[0].kategori !== 'Display ruang rapat' && bersihkanDok(pr4)!.ruangLain![0].boq![kn].model === '65C755');
  const xm = new ExcelJS.Workbook();
  await xm.xlsx.load((await bukuExcel({ dok: pr4, lembar1: [png1, png1] })) as unknown as ArrayBuffer);
  const namaSheet = xm.worksheets.map(w => w.name), bqx = xm.getWorksheet('Sheet 3 - BOQ')!;
  cek('Excel multi ruangan: Sheet 1 & 2 per ruangan, BOQ satu sheet dengan section per ruangan', namaSheet.length === 5 && namaSheet[0].startsWith('R1 Sheet 1') && namaSheet[3].includes('Ruang Rapat')
    && String(bqx.getCell('A7').value).startsWith('A. ') && bqx.getColumn(1).values.some(v => String(v).startsWith('B. RUANG RAPAT')) && String(bqx.getCell('B3').value ?? bqx.getCell('A3').value) !== '', namaSheet.join(' | '));
  const vm = await bacaZip(buatVsdx({ dok: pr4, gambar: new Map(), ruang: [0, 1].map(i => ({ dok: dokRuang(pr4, i), nama: i ? 'Ruang Rapat' : 'Ruangan 1' })) }));
  cek('Visio multi ruangan: 2 halaman per ruangan', vm.has('visio/pages/page4.xml') && !vm.has('visio/pages/page5.xml'));
  console.log('\n14. Pilih banyak, salin-tempel, panduan, posisi label & area');
  const pa = { ...perangkatBaru('tv-tcl', 50, 50), id: 'pa' }, pb = { ...perangkatBaru('presentasi', 120, 50), id: 'pb' }, pc = { ...perangkatBaru('kamera', 250, 150), id: 'pc' };
  const kab = { ...kabelBaru('pa', 'pb'), id: 'kab' }, zn = { id: 'zn', x: 40, y: 40, w: 150, h: 60, label: 'Rack', warna: 'biru' as const };
  const dp = { ...dokBaru(), perangkat: [pa, pb, pc], kabel: [kab], teks: [{ ...teksBaru(60, 100, 'catatan'), id: 'tt' }], zona: [zn] };
  const dk = idDalamKotak(dp, { x: 30, y: 30, w: 170, h: 90 });
  cek('kotak pilih: perangkat, teks & area di dalam kotak terpilih', ['pa', 'pb', 'tt', 'zn'].every(i => dk.includes(i)) && !dk.includes('pc'), dk.join(','));
  const gs = geserObjek(dp, posisiAwal(dp, ['pa', 'tt', 'zn']), 10, 5);
  cek('geser banyak sekaligus', gs.perangkat[0].x === pa.x + 10 && gs.teks[0].y === 105 && gs.zona![0].x === 50 && gs.perangkat[1].x === pb.x);
  const tp = tempelKlip(dp, salinObjek(dp, ['pa', 'pb', 'zn']));
  const kabBaru = tp.dok.kabel[1], baruA = tp.dok.perangkat[3], baruB = tp.dok.perangkat[4];
  cek('salin-tempel: id baru, kabel di antara item ikut & tersambung ke salinan', tp.ids.length === 3 && tp.dok.perangkat.length === 5 && tp.dok.zona!.length === 2
    && kabBaru.dari.p === baruA.id && kabBaru.ke.p === baruB.id && baruA.id !== 'pa' && baruA.x === pa.x + 8);
  const hp = hapusObjek(dp, ['pa', 'zn', 'tt']);
  cek('hapus banyak: perangkat, kabelnya, teks & area hilang', hp.perangkat.length === 2 && hp.kabel.length === 0 && hp.teks.length === 0 && hp.zona!.length === 0);
  const rt = ratakan({ ...dp, perangkat: [pa, { ...pb, y: 70 }] }, ['pa', 'pb'], 'atas');
  cek('ratakan atas', Math.abs(kotakTampak(rt.perangkat[0]).y - kotakTampak(rt.perangkat[1]).y) < 0.5);
  const j = jepret({ x: 10, y: 51, w: 20, h: 10 }, [{ x: 100, y: 50, w: 30, h: 10 }]);
  cek('garis panduan: jepret sejajar dengan perangkat di samping', j.dy === -1 && j.garis.length === 1 && j.garis[0].y1 === 50);
  const lb = letakLabel({ ...pa, labelDi: 'kanan' }), lk = letakLabel({ ...pa, labelDi: 'kiri-atas' });
  cek('posisi label: kanan / kiri-atas', lb.x > pa.x + pa.w - 1 && !lb.kanan && lk.kanan && lk.atas + lk.h <= kotakTampak(pa).y + 0.01
    && svgLembar1({ ...dokBaru(), perangkat: [{ ...pa, nama: 'TV', labelDi: 'kiri' }] }).includes('text-anchor="end">#TV')
    && bersihkanDok({ ...dp, perangkat: [{ ...pa, labelDi: 'kanan-bawah' }, { ...pb, labelDi: 'ngawur' }] })!.perangkat.map(p => p.labelDi).join(',') === 'kanan-bawah,');
  const sz = svgZona(zn), dz = bersihkanDok(dp)!;
  cek('area: kotak putus-putus berlabel, tersimpan, ikut ke sheet 1 & Visio', sz.includes('stroke-dasharray') && sz.includes('>Rack<') && dz.zona?.[0].label === 'Rack'
    && svgLembar1(dp).includes('>Rack<') && new TextDecoder().decode((await bacaZip(buatVsdx({ dok: dp, gambar: new Map() }))).get('visio/pages/page1.xml')).includes("NameU='Area'"));
  cek('katalog: interactive display & dongle wireless berfoto', tebakTemplat('Interactive Flat Panel 75"') === 'ifp' && tebakTemplat('Wireless presentation dongle') === 'dongle'
    && !!KATALOG.find(t => t.k === 'ifp')?.foto && !!KATALOG.find(t => t.k === 'dongle')?.foto);
  console.log('\n15. Kabel menghindari perangkat & BOQ per model');
  const ifpU = (id: string, x: number, y: number, nama: string) => ({ ...perangkatBaru('ifp', x, y), id, nama });
  const mxU = { ...perangkatBaru('matrix', 40, 60), id: 'mx', nama: 'Matrix switcher' };
  const kenaLain = (d: ReturnType<typeof dokBaru>) => geometri(d).some(g => {
    const c = d.kabel.find(k => k.id === g.id)!, ujung = [c.ke, ...c.cabang];
    return g.garis.some((gr, i) => tabrak(gr.titik, d.perangkat.filter(p => p.id !== c.dari.p && p.id !== ujung[i].p).map(kotakTampak), 0.5));
  });
  const busKe = (a: string, ...cab: string[]) => ({ ...kabelBaru('mx', a), id: 'kb', cabang: cab.map(p => ({ p, nama: '', port: '', sisi: 'auto' as const })) });
  const h1 = { ...dokBaru(), perangkat: [mxU, ifpU('i1', 230, 15, 'IFP 1'), ifpU('i3', 160, 110, 'IFP 3'), ifpU('i2', 160, 170, 'IFP 2')], kabel: [busKe('i1', 'i3', 'i2')] };
  const h2 = { ...dokBaru(), perangkat: [mxU, ifpU('i1', 230, 15, 'IFP 1'), ifpU('i3', 160, 110, 'IFP 3'), ifpU('i2', 225, 110, 'IFP 2')], kabel: [busKe('i1', 'i3', 'i2')] };
  const h3 = { ...dokBaru(), perangkat: [mxU, ifpU('i3', 120, 50, 'IFP 3'), ifpU('i2', 200, 55, 'IFP 2')], kabel: [{ ...kabelBaru('mx', 'i2'), id: 'k1' }] };
  cek('kabel bus tidak menembus perangkat lain (IFP di bawah IFP lain)', !kenaLain(h1));
  cek('kabel bus tidak menembus perangkat lain (IFP berjajar)', !kenaLain(h2));
  cek('kabel lurus memutar bila ada perangkat di tengah', !kenaLain(h3));
  const bq9 = barisBoq(h1), bp9 = barisPerangkat(h1), kg9 = kartuGambar(h1);
  cek('BOQ & sheet 2: nama beda tapi jenis sama = satu baris, qty dijumlah', bq9.length === 2 && bq9[1].qty === 3 && bq9[1].model === 'IFP' && bp9.length === 2 && bp9[1].qty.startsWith('3') && kg9[1].judul === 'IFP', JSON.stringify(bq9.map(b => [b.model, b.qty])));
  const h4 = { ...h1, perangkat: h1.perangkat.map(p => p.id === 'i2' ? { ...p, model: 'Philips 86BDL' } : p) };
  cek('model / part no beda = baris terpisah', barisBoq(h4).length === 3);
  const gm9 = grupModel([{ ...h1.perangkat[1], model: 'Philips 86BDL' }, { ...h1.perangkat[2], model: 'philips 86bdl ', qty: 2 }, h1.perangkat[3], { ...mxU, model: 'WyreStorm MX-0404' }]);
  cek('grup model buatan sendiri: daftar unik per kategori + model, qty dijumlah', gm9.length === 2 && gm9.find(g => g.model === 'Philips 86BDL')?.jumlah === 3);
  const h5 = { ...h1, perangkat: h1.perangkat.map(p => (p.id === 'i1' || p.id === 'i3' ? { ...p, model: 'Grup A' } : p)) };
  cek('model baru = grup BOQ sendiri', barisBoq(h5).map(b => `${b.model}:${b.qty}`).join(',') === 'Matrix switcher:1,Grup A:2,IFP 2:1', barisBoq(h5).map(b => `${b.model}:${b.qty}`).join(','));
  const zBesar = { id: 'zb', x: 40, y: 40, w: 150, h: 60, label: 'Rack', warna: 'biru' as const, huruf: 2, tebal: 1.2 };
  const zDok = bersihkanDok({ ...dokBaru(), zona: [zBesar, { ...zBesar, id: 'zc', tebal: 10, huruf: -1 }] })!.zona!;
  cek('area: ukuran huruf & tebal garis bisa diatur, tersimpan & dibatasi', svgZona(zBesar).includes('stroke-width="1.2"') && labelZona(zBesar).h > labelZona({ ...zBesar, huruf: undefined }).h
    && zDok[0].huruf === 2 && zDok[0].tebal === 1.2 && zDok[1].tebal === 3 && zDok[1].huruf === undefined
    && new TextDecoder().decode((await bacaZip(buatVsdx({ dok: { ...dokBaru(), zona: [zBesar] }, gambar: new Map() }))).get('visio/pages/page1.xml')).includes("NameU='Area'"));
  console.log('\n16. Katalog object tim');
  const idT = '0b8a4c1e-5d2f-4a7b-9c3d-1e2f3a4b5c6d';
  const itemT: ItemTim = { id: idT, versi: 3, adaFoto: true, rasio: 2, oleh: 'Tim', bolehUbah: true, ...bersihkanItemTim({ nama: '  Kamera  PTZ X ', kategori: 'Kamera', kelompok: 'sumber', ikon: 'kamera', port: 'HDMI out, LAN, ', lebar: 500 })! };
  cek('object tim: isian dibersihkan & dibatasi', itemT.nama === 'Kamera PTZ X' && itemT.port.length === 2 && itemT.lebar === 200 && bersihkanItemTim({ nama: ' ' }) === null
    && bersihkanItemTim({ nama: 'x', ikon: 'ngawur', kelompok: 'ngawur' })!.ikon === 'umum' && bersihkanItemTim({ nama: 'x', kelompok: 'ngawur' })!.kelompok === 'sumber');
  const pT = perangkatDariTim(itemT, 50, 50), pT2 = { ...perangkatDariTim({ ...itemT, versi: 4 }, 120, 50), nama: 'Kamera 2' };
  cek('object tim: perangkat memakai foto tim (URL ber-versi) & model = nama', pT.foto === urlFotoTim(idT, 3) && pT.rasio === 2 && pT.model === 'Kamera PTZ X' && idFotoTim(pT.foto) === idT);
  cek('foto tim tersimpan di SLD, URL lain ditolak', fotoSah(pT.foto) && !fotoSah('/api/tools-team/sld/katalog/../x/1') && !fotoSah('https://contoh.com/a.jpg')
    && bersihkanDok({ ...dokBaru(), perangkat: [pT] })!.perangkat[0].foto === pT.foto && tanpaFoto({ ...dokBaru(), perangkat: [pT] }).perangkat[0].foto === pT.foto);
  cek('object tim beda versi foto tetap satu baris BOQ', barisBoq({ ...dokBaru(), perangkat: [pT, pT2] }).length === 1 && barisBoq({ ...dokBaru(), perangkat: [pT, pT2] })[0].qty === 2);
  cek('foto tim hanya JPEG data URL', POLA_DATA_FOTO_TIM.test('data:image/jpeg;base64,/9j/4AAQ') && !POLA_DATA_FOTO_TIM.test('data:image/png;base64,iVBOR') && !POLA_DATA_FOTO_TIM.test('data:image/jpeg;base64,<x>'));
  const tanpaFotoTim = perangkatDariTim({ ...itemT, adaFoto: false, rasio: null }, 0, 0);
  cek('object tim tanpa foto memakai ilustrasi', !tanpaFotoTim.foto && tanpaFotoTim.ikon === 'kamera');
  const dTim = { ...dokBaru(), perangkat: [pT, { ...perangkatBaru('tv-tcl', 200, 50), id: 'lok', gambar: 'data:image/jpeg;base64,/9j/', model: 'TV X' }],
    ruangLain: [{ id: 'r2', nama: 'R2', perangkat: [pT2], kabel: [], teks: [], catatan: [] }] };
  const segar = segarkanFotoTim(dTim, [{ ...itemT, versi: 7, rasio: 1.5 }]);
  cek('foto tim lama otomatis ikut versi terbaru (semua ruangan)', !!segar && segar.perangkat[0].foto === urlFotoTim(idT, 7) && segar.perangkat[0].rasio === 1.5
    && segar.ruangLain![0].perangkat[0].foto === urlFotoTim(idT, 7) && segarkanFotoTim(segar, [{ ...itemT, versi: 7, rasio: 1.5 }]) === null
    && !segarkanFotoTim(dTim, [{ ...itemT, adaFoto: false, rasio: null }])!.perangkat[0].foto);
  cek('foto lokal (hanya di browser ini) terdeteksi', fotoLokal(dTim).map(p => p.id).join(',') === 'lok');
  const banyakV = { ...dokBaru(), perangkat: [pT, pT2].map((p, i) => ({ ...p, id: `v${i}` })),
    kabel: Array.from({ length: 90 }, (_, i) => ({ ...kabelBaru('v0', 'v1', { fungsi: `fungsi ${i}` }), id: `kv${i}` })) };
  const vLanjut = await bacaZip(buatVsdx({ dok: banyakV, gambar: new Map() }));
  cek('Visio: lembar lanjutan sheet 2 ikut jadi halaman', !!vLanjut.get('visio/pages/page3.xml') && new TextDecoder().decode(vLanjut.get('visio/pages/pages.xml')).includes('Sheet 2 - Koneksi &amp; catatan (2)'));
  const pos: [string, string, number, number, number, number][] = [['scr', 'layar-frame', 298.5, 39.5, 39, 37.5], ['pry', 'proyektor', 304, 108.5, 30.5, 25.5], ['tx', 'encoder', 309, 159.5, 26, 13],
    ['sw', 'switch', 129, 106, 46.5, 30.5], ['txa', 'encoder', 100.5, 48.5, 26, 13], ['wp', 'encoder', 75, 85.5, 23, 19], ['ctl', 'encoder', 75.5, 127, 26, 17], ['pro', 'controller', 105, 164.5, 17, 13],
    ['aud', 'minipc', 156.5, 22, 29.5, 25], ['spk', 'speaker', 365.5, 43, 13, 22], ['rt', 'matrix', 171.5, 154, 26, 31.5], ['pnl', 'panel', 177, 74, 24, 12.5]];
  const ujung = (p: string) => ({ p, nama: '', port: '', sisi: 'auto' as const });
  const dNyata = { ...dokBaru(), kertas: '169' as const, perangkat: pos.map(([id, ikon, x, y, w, h]) => ({ ...perangkatBaru('umum', x, y), id, ikon, w, h, nama: id })),
    kabel: [{ ...kabelBaru('sw', 'pry'), id: 'b1', cabang: ['tx', 'rt', 'pnl'].map(ujung) }, { ...kabelBaru('sw', 'wp'), id: 'b2', cabang: ['txa', 'ctl', 'pro'].map(ujung) },
      { ...kabelBaru('txa', 'aud'), id: 'au' }, { ...kabelBaru('aud', 'spk', { jenis: 'speaker' }), id: 'spk', tengah: 355.5 }, { ...kabelBaru('tx', 'pry'), id: 'hd', tengah: 141.5 }] };
  const ar = areaDok(dNyata), luar = geometri(dNyata).flatMap(g => g.garis.flatMap(gr => gr.titik)).filter(t => t.x < ar.x - 1 || t.x > ar.x + ar.w + 1 || t.y < ar.y - 1 || t.y > ar.y + ar.h + 1);
  const gSpk = geometri(dNyata).find(g => g.id === 'spk')!.garis[0].titik;
  cek('kabel yang jalurnya digeser manual tidak pindah sisi & tidak keluar halaman (kasus nyata)', !luar.length && Math.abs(gSpk[1].x - 355.5) < 0.01 && Math.abs(gSpk[0].y - gSpk[1].y) < 0.01,
    JSON.stringify(luar.slice(0, 3)));
  cek('jalur manual di luar halaman dijepit ke dalam halaman', geometri({ ...dNyata, kabel: [{ ...kabelBaru('aud', 'spk'), id: 'x', tengah: 900 }] })[0].garis[0].titik.every(t => t.x <= ar.x + ar.w + 0.01));
  cek('isian BOQ lama (kunci per nama) tetap terbaca', barisBoq({ ...h1, boq: { 'display|ifp 1': { spek: '86 inci' } } })[1].spek === '86 inci');
  console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
