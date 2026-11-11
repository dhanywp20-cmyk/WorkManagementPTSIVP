import { bacaBom, isiDariBom, modelBom } from '../lib/sld/bom';
import { contohVoiceKamar } from '../lib/sld/contoh';
import { bersihkanDok, dokBaru, hapusPerangkat, kabelBaru, pasangFoto, perangkatBaru, petaFoto, tanpaFoto } from '../lib/sld/dok';
import { GAYA_KABEL } from '../lib/sld/gaya';
import { geometri, kodeKabel, sisiOtomatis } from '../lib/sld/geometri';
import { DAFTAR_IKON } from '../lib/sld/ikon';
import { KATALOG, tebakTemplat } from '../lib/sld/katalog';
import { buatVsdx } from '../lib/sld/vsdx';
import { svgLembar1 } from '../lib/sld/lembar1';
import { isiLembar2, svgLembar2 } from '../lib/sld/lembar2';
import { bungkus } from '../lib/sld/teks';
import { bacaZip, crc32, tulisZip } from '../lib/sld/zip';
import { barisKoneksi, barisPerangkat, jenisTerpakai, kartuGambar, periksaDok } from '../lib/sld/turunan';

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
  cek('pemeriksaan: perangkat tanpa kabel & tanpa No. BOM dilaporkan', periksaDok(satu).length === 2);
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
  console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
