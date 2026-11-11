import { existsSync, readFileSync, statSync } from 'node:fs';
import { bacaBom, isiDariBom, modelBom } from '../lib/sld/bom';
import { FOTO_PRODUK } from '../lib/sld/foto-produk';
import { isiPreset, presetKabel } from '../lib/sld/preset-kabel';
import { contohVoiceKamar } from '../lib/sld/contoh';
import { bersihkanDok, dokBaru, hapusPerangkat, kabelBaru, pasangFoto, perangkatBaru, petaFoto, tanpaFoto } from '../lib/sld/dok';
import { GAYA_KABEL } from '../lib/sld/gaya';
import { geometri, kodeKabel, kotakTampak, sisiOtomatis } from '../lib/sld/geometri';
import { dinding, gridVideowall, rasioDinding, ukuranLed } from '../lib/sld/dinding';
import { DAFTAR_IKON } from '../lib/sld/ikon';
import { KATALOG, tebakTemplat } from '../lib/sld/katalog';
import { buatVsdx } from '../lib/sld/vsdx';
import { svgLembar1 } from '../lib/sld/lembar1';
import { isiLembar2, svgLembar2 } from '../lib/sld/lembar2';
import { bungkus } from '../lib/sld/teks';
import { bacaZip, crc32, tulisZip } from '../lib/sld/zip';
import { barisKoneksi, barisPerangkat, fungsiOtomatis, jenisTerpakai, kartuGambar, noOtomatis, periksaDok } from '../lib/sld/turunan';

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
  cek('cabang bus ikut di kolom Ke', k[4].ke.includes('Modul relay 8 #1') && k[4].ke.includes('Modul relay 8 #2'), k[4].ke);
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
  cek('sheet 2: blok judul baku', ['>SINGLE LINE DIAGRAM<', '>PROYEK<', '>LINGKUP<', '>ACUAN<', '>NO. GAMBAR<', '>REV<', '>TANGGAL<', '>SKALA<', '>KERTAS<', '>HAL<', '>Tanpa skala<', '>A3<',
    '>2 / 2 · Koneksi &amp; catatan<'].every(t => s2.includes(t)));
  cek('sheet 2: warna tabel baku', s2.includes('fill="#eaeef2" stroke="#8c959f"') && s2.includes('fill="#f6f8fa" stroke="#afb8c1"'));
  cek('teks pengguna di-escape', svgLembar1({ ...d, blok: { ...d.blok, proyek: '<script>' } }).includes('PROJECT : &lt;script&gt;'));
  const banyak = { ...d, kabel: Array.from({ length: 90 }, (_, i) => kabelBaru(d.perangkat[0].id, d.perangkat[1].id, { fungsi: `fungsi ${i}` })) };
  cek('tabel kepanjangan dipotong di batas lembar dan dilaporkan', isiLembar2(banyak).info.terpotongKoneksi > 0);
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
  cek('hapus perangkat: kabel tetap di tabel dengan nama teks', tanpa.kabel.length === d.kabel.length && barisKoneksi(tanpa)[0].ke.startsWith('Mini PC Windows 11'));
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
  console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
