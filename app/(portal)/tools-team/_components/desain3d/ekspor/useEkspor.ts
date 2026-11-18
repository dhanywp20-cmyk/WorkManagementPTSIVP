'use client';
import { useState } from 'react';
import { bukaCetak, esc, type Lembar, namaBerkas, unduhKanvasPNG, unduhLembarPNG, unduhUrl } from '../../bersama/cetak';
import { jalurKabel, berkasLineArray, cekRuangGerak, denahDari, dxfDenah, skalaDenah, svgDenah, formatPanjang, penggarisSah, rincianGaris, type Benda, bomDesain, cakupanSpeakerPlafon, checklistDariBom, daftarBenda, jangkauanDari, blendingPerProyektor, kontrasProyektor, namaPendek, potretDari, rollDari, SISI_GAMBAR, ukuranTampak, lumenDari, lumenLampu, luxBidangKerja, gambarDiSasaran, modulLA, objekDisinari, rekapKabel, ruangDari, sambunganKe, sebaranSpeaker, sebaranVSpeaker, sinarProyektor, SPEK_LAMPU, sudutLampuDari, svgElevasiRak, telingaPenonton, throwRatioDari, tipeSpeakerDari, ukuranBidang } from '../inti';
import { denganLegendaSamping, gambarLegendaBaris, htmlLegendaKabel } from '../panel/LegendaKabel';
import { f } from '../../bersama/ui';
import { getSession } from '@/lib/auth/sesi';
import { loadXLSX } from '@/lib/xlsx-loader';
import type { KeadaanDesain } from '../useKeadaanDesain';
import type { useKamera } from '../mesin/useKamera';
import { ARAH_SUDUT, type Sudut, TAMPAK } from '../mesin/tipe';
import { gambarLabel } from '../mesin/label';
import { posisiPas } from '../mesin/kamera';

function useSakelarTersimpan(kunci: string, awal: boolean): [boolean, (v: boolean) => void] {
  const [nilai, setNilai] = useState(() => { try { const v = localStorage.getItem(kunci); return v === null ? awal : v === '1'; } catch { return awal; } });
  return [nilai, (v: boolean) => { setNilai(v); try { localStorage.setItem(kunci, v ? '1' : '0'); } catch {  } }];
}

export function useEkspor(K: KeadaanDesain, dep: Pick<ReturnType<typeof useKamera>, 'fokusKotak'>) {
  const { analisis, benda, duaRuang, faktorCustom, infoBlending, jenisPandang, kotakRuang, legendaKabel, mesin, namaDesain, pilih, ruang, setGalat, tampilBlending, targetKontras } = K;
  const { fokusKotak } = dep;
  const kabelLengkap = () => jalurKabel(benda, ruang, { power: true });
  const fotoKanvas = (arah: 'sekarang' | Sudut, skala = 2): HTMLCanvasElement | null => {
    const m = mesin.current; if (!m) return null;
    const posLama = m.kamera.position.clone(), targetLama = m.orbit.target.clone(), rasioLama = m.renderer.getPixelRatio();
    const sorot = m.grupBenda.children.filter(o => o.userData.sorot);
    m.gizmo.detach(); sorot.forEach(o => { o.visible = false; });
    try {
      if (arah !== 'sekarang') {
        const { target, kotak } = fokusKotak('semua');
        m.orbit.target.copy(target);
        m.kamera.position.copy(posisiPas(m, target, new m.THREE.Vector3(...ARAH_SUDUT[arah]).normalize(), kotak));
        m.kamera.lookAt(target);
      }
      m.kamera.updateMatrixWorld();
      m.renderer.setPixelRatio(Math.min(3, rasioLama * skala));
      m.renderer.shadowMap.needsUpdate = true;
      m.renderer.render(m.scene, m.kamera);
      m.labelRenderer.render(m.scene, m.kamera);
      const src = m.renderer.domElement;
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); if (!g) return null;
      g.drawImage(src, 0, 0);
      gambarLabel(m, g, c.width, c.height);
      return c;
    } catch { return null; } finally {
      m.renderer.setPixelRatio(rasioLama);
      m.kamera.position.copy(posLama); m.orbit.target.copy(targetLama); m.orbit.update();
      sorot.forEach(o => { o.visible = true; });
      if (pilih) { const o = m.cache.get(pilih)?.obj; if (o) m.gizmo.attach(o); }
      m.renderer.render(m.scene, m.kamera); m.labelRenderer.render(m.scene, m.kamera);
    }
  };
  const namaGambar = (bagian: string) => namaBerkas(namaDesain || 'Desain AV', bagian);
  const [menuPng, setMenuPng] = useState(false);
  const [denahCetak, setDenahCetak] = useSakelarTersimpan('wm_desain3d_denah_cetak', false);
  const [kabelCetak, setKabelCetak] = useSakelarTersimpan('wm_desain3d_kabel_cetak', true);
  const [rakCetak, setRakCetak] = useSakelarTersimpan('wm_desain3d_rak_cetak', true);
  const [sibukPng, setSibukPng] = useState(false);
  const jalankanPng = async (kerja: () => Promise<void>) => {
    setMenuPng(false); setSibukPng(true);
    try { await kerja(); } catch { setGalat('Gambar PNG gagal dibuat.'); } finally { setSibukPng(false); }
  };
  const unduhFoto = (arah: 'sekarang' | Sudut, bagian: string) => jalankanPng(async () => {
    const foto = fotoKanvas(arah, 2); if (!foto) throw new Error('foto');
    const c = legendaKabel ? denganLegendaSamping(foto, legendaKabel, foto.width / Math.max(1, mesin.current?.renderer.domElement.clientWidth || foto.width)) : foto;
    await unduhKanvasPNG(c, namaGambar(bagian));
  });
  const unduhEmpatTampak = () => jalankanPng(async () => {
    const foto = TAMPAK.map(t => ({ ...t, c: fotoKanvas(t.arah, 1.5) }));
    if (foto.some(x => !x.c)) throw new Error('foto');
    const w = foto[0].c!.width, h = foto[0].c!.height, k = w / 900;
    const jarak = Math.round(16 * k), kepala = Math.round(70 * k), keterangan = Math.round(34 * k);
    const c = document.createElement('canvas');
    c.width = w * 2 + jarak * 3;
    const tinggiLegenda = legendaKabel ? Math.ceil(gambarLegendaBaris(null, 0, 0, c.width - jarak * 2, legendaKabel, k * 1.3)) + jarak : 0;
    c.height = kepala + (h + keterangan) * 2 + jarak * 3 + tinggiLegenda;
    const g = c.getContext('2d'); if (!g) throw new Error('kanvas');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, c.width, kepala);
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(26 * k)}px Segoe UI, Arial, sans-serif`; g.fillText(namaDesain || 'Desain AV', jarak, kepala * 0.38);
    g.font = `${Math.round(15 * k)}px Segoe UI, Arial, sans-serif`;
    g.fillText(`Desain 3D Ruang AV · ${kotakRuang.map(r => `${f(r.p)} × ${f(r.l)} × ${f(r.t)} m`).join(' + ')} · ${benda.length} item · ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, jarak, kepala * 0.74);
    foto.forEach((x, i) => {
      const px = jarak + (i % 2) * (w + jarak), py = kepala + jarak + Math.floor(i / 2) * (h + keterangan + jarak);
      g.drawImage(x.c!, px, py);
      g.strokeStyle = '#e2e8f0'; g.lineWidth = Math.max(1, k); g.strokeRect(px, py, w, h + keterangan);
      g.fillStyle = '#f8fafc'; g.fillRect(px, py + h, w, keterangan);
      g.fillStyle = '#334155'; g.font = `700 ${Math.round(15 * k)}px Segoe UI, Arial, sans-serif`; g.fillText(x.judul, px + 10 * k, py + h + keterangan / 2);
    });
    if (legendaKabel) gambarLegendaBaris(g, jarak, c.height - tinggiLegenda, c.width - jarak * 2, legendaKabel, k * 1.3);
    await unduhKanvasPNG(c, namaGambar('4 tampak'));
  });
  const lembar3D = (): Lembar => {
    const foto = TAMPAK.map(t => ({ ...t, url: fotoKanvas(t.arah, 1.5)?.toDataURL('image/jpeg', 0.86) ?? '' }));
    const fm = (n: number, d = 2) => f(n, d);
    const jangkauLA = (b: Benda) => {
      const k = kotakRuang[ruangDari(ruang, b.x)] ?? kotakRuang[0];
      const bs = berkasLineArray(b, { x0: k.x0, x1: k.x0 + k.p, z0: 0, z1: k.l, t: k.t, telinga: telingaPenonton(benda, b) });
      const d = bs.filter(x => x.jarak !== null && !x.dinding).map(x => x.jarak!), n = bs.filter(x => x.dinding).length;
      return (d.length ? `menjangkau ${fm(Math.min(...d), 1)}–${fm(Math.max(...d), 1)} m` : 'sumbu belum turun ke penonton') + (n ? ` · ${n} modul ke dinding/plafon` : '');
    };
    const baris = daftarBenda(benda);
    const kabel = kabelCetak ? kabelLengkap() : [];
    const label = jenisPandang === 'custom' ? `Custom (${faktorCustom}×)` : { detail: 'Detail (4×)', analitis: 'Analitis (6×)', umum: 'Umum (8×)' }[jenisPandang];
    const proyektor = benda.filter(b => b.jenis === 'proyektor').map(p => ({ p, sn: sinarProyektor(p, benda, ruang) }));
    const gambar = (src: string, ket: string) => (src ? `<figure><img src="${src}" alt="${esc(ket)}"/><figcaption>${esc(ket)}</figcaption></figure>` : '');
    const speaker = benda.filter(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon');
    const disinari = objekDisinari(benda, ruang);
    const bentukBidang = (b: Benda) => (b.jenis === 'bidang' && (b.bentukBidang ?? 'datar') !== 'datar' ? ` · jari-jari ${fm(ukuranBidang(b).R)} m, busur ${fm(ukuranBidang(b).busur, 0)}°` : '');
    const cakupanObjek = (o: (typeof disinari)[number]) => (o.tertutup === null ? `Sisi ${o.sisi.join(', ')}`
      : `${fm(o.tertutup * 100, 0)}% tertutup${(o.tumpang ?? 0) > 0.005 ? ` · tumpang (blending) ${fm((o.tumpang ?? 0) * 100, 0)}%` : ''}${o.celah.length ? ` · celah di ${o.celah.join(', ')}` : ''}`);
    const denah = denahCetak ? denahDari(ruang, benda) : null, ruangGerak = cekRuangGerak(benda, ruang);
    const NAMA_TIPE: Record<string, string> = { kotak: 'Speaker box', dinding6: 'Speaker dinding 6"', kolom: 'Portable aktif (kolom)', linearray: 'Line array' };
    return {
      judul: 'Desain 3D Ruang AV',
      subjudul: namaDesain || 'Tanpa nama',
      kepala: [['Dibuat oleh', getSession<{ full_name?: string }>()?.full_name ?? '']],
      seksi: [
        { judul: 'Ruangan', jenis: 'tabel', kepala: ['Ruang', 'Panjang', 'Lebar', 'Plafon', 'Luas', ...(duaRuang ? ['Sekat dengan ruang sebelumnya'] : [])], rataKanan: [1, 2, 3, 4],
          isi: kotakRuang.map((k, i) => {
            const s0 = sambunganKe(ruang, i);
            const sekat = !s0 ? '—' : `${({ tembok: 'tembok', jendela: 'tembok + jendela kaca', kaca: 'kaca penuh', terbuka: 'terbuka (menyatu)' } as const)[s0.sekat ?? 'tembok']}${s0.pintu && s0.sekat !== 'terbuka' ? ', pintu penghubung' : ''}`;
            return [`Ruang ${i + 1}`, `${fm(k.p)} m`, `${fm(k.l)} m`, `${fm(k.t)} m`, `${fm(k.p * k.l)} m²`, ...(duaRuang ? [sekat] : [])];
          }) },
        ...(penggarisSah(ruang.penggaris).length ? [{ judul: 'Garis ukur', jenis: 'tabel' as const, kepala: ['Garis', 'Panjang', 'Jarak datar', 'Beda tinggi'], rataKanan: [1, 2, 3],
          isi: penggarisSah(ruang.penggaris).map((g, i) => { const r = rincianGaris(g); return [`Garis ${i + 1}`, formatPanjang(Math.hypot(r.datar, r.tinggi)), formatPanjang(r.datar), formatPanjang(r.tinggi)]; }) }] : []),
        ...(denah ? [{ judul: `Denah · skala 1:${skalaDenah(denah)}`, jenis: 'html' as const, html: `<div style="text-align:center">${svgDenah(denah)}</div>` }] : []),
        ...(ruangGerak.length ? [{ judul: 'Cek ruang gerak', jenis: 'tabel' as const, kepala: ['Catatan'], isi: ruangGerak.map(c => [c.pesan]) }] : []),
        { judul: 'Tampilan desain', jenis: 'html',
          html: `<div class="gambar dua">${foto.map(x => gambar(x.url, x.judul)).join('')}</div>` },
        ...(legendaKabel ? [{ judul: 'Legend kabel', jenis: 'html' as const, html: htmlLegendaKabel(legendaKabel) }] : []),
        ...(kabel.length ? [{ judul: 'Jadwal kabel', jenis: 'tabel' as const, kepala: ['Dari', 'Ke', 'Kabel', 'Panjang', 'Lewat'], rataKanan: [3],
          isi: [...kabel.map(k => [k.dari, k.ke, k.kabel.nama, `±${fm(k.panjang)} m`, k.lewat]),
            ...rekapKabel(kabel).map(r => ['TOTAL', '', r.kabel.nama, `±${fm(r.meter)} m`, r.gulungan])] }] : []),
        ...(rakCetak && benda.some(b => b.jenis === 'rak') ? [{ judul: 'Rack elevation', jenis: 'html' as const,
          html: `<div class="gambar dua">${benda.filter(b => b.jenis === 'rak').map(b => `<div>${svgElevasiRak(b)}</div>`).join('')}</div>` }] : []),
        { judul: `Daftar perangkat & furnitur (${baris.length} jenis)`, jenis: 'tabel', kepala: ['Kategori', 'Item', 'Ukuran (L × T × P)', 'Jumlah', 'Catatan'], rataKanan: [3],
          isi: baris.map(r => [r.kategori, r.item, r.ukuran, `${r.jumlah} ${r.satuan}`, r.catatan]) },
        ...(analisis.length ? [{
          judul: `Analisis jarak pandang · konten ${label}`, jenis: 'tabel' as const,
          kepala: ['Display', ...(duaRuang ? ['Ruang'] : []), 'Ukuran gambar', 'Penonton terjauh', 'Tinggi minimal', 'Sudut maks', 'Status'],
          rataKanan: duaRuang ? [3, 4, 5] : [2, 3, 4],
          isi: analisis.map(a => [a.d.nama, ...(duaRuang ? [`Ruang ${a.ri + 1}`] : []), `${fm(a.gambar.w)} × ${fm(a.gambar.h)} m`,
            a.jumlah ? `${fm(a.terjauh, 1)} m` : '—', `${fm(a.tinggiPerlu)} m`, `${fm(a.sudutMaks, 0)}°`, a.jumlah ? (a.cukup ? 'Cukup' : 'Kurang') : 'Tanpa penonton']),
        }] : []),
        ...(proyektor.length ? [{
          judul: 'Proyektor & jarak lempar', jenis: 'tabel' as const,
          kepala: ['Proyektor', 'Pemasangan', 'Sasaran', 'Jarak lempar', 'Ukuran gambar', 'Throw ratio', 'TR agar pas'],
          rataKanan: [3, 5, 6],
          isi: proyektor.map(({ p, sn }) => {
            const g = gambarDiSasaran(p, benda, ruang), u = ukuranTampak(p, g.lebar, g.tinggi), roll = rollDari(p);
            return [p.modelProduk ? `${p.nama} (${p.modelProduk})` : p.nama,
              `${p.pasangProyektor === 'meja' ? 'Portabel di meja' : `${p.tanpaTiang ? 'Melayang / rangka' : 'Plafon'} (${fm(p.elev)} m dari lantai)`}${roll ? ` · putar ${fm(roll, 0)}°${potretDari(p) ? ' (potret)' : ''}` : ''}`,
              g.sasaran?.nama ?? 'Dinding / permukaan', `${fm(g.jarak)} m`, `${fm(u.lebar)} × ${fm(u.tinggi)} m`, `${fm(throwRatioDari(p))} : 1`, sn.trPas ? `${fm(sn.trPas)} : 1` : '—'];
          }),
        }, {
          judul: `Kecerahan & kontras proyektor · target ${targetKontras}:1`, jenis: 'tabel' as const,
          kepala: ['Proyektor', 'Lumen', 'Cahaya di gambar', 'Luminance', 'Cahaya ruang di gambar', 'Kontras'],
          rataKanan: [1, 2, 3, 4, 5],
          isi: proyektor.map(({ p }) => {
            const kp = kontrasProyektor(p, benda, ruang, targetKontras);
            const silau = { nyaman: 'nyaman', terang: 'terang', silau: 'SILAU' }[kp.silau.tingkat];
            const perlu = Number.isFinite(kp.lumenPerlu) ? `perlu ±${kp.lumenPerlu.toLocaleString('id-ID')} lm` : kp.batasPantul <= targetKontras ? `pantulan ruang membatasi ±${fm(kp.batasPantul, 0)} : 1` : 'melebihi kontras asli proyektor';
            return [p.nama, lumenDari(p).toLocaleString('id-ID'), `${fm(kp.luxGambar, 0)} lux`, `${fm(kp.luminance, 0)} cd/m² (gain ${fm(kp.gain, 2)}) · ${silau}`,
              `${fm(kp.cahaya.total, 0)} lux${kp.cahaya.dariLampu ? '' : ' (perkiraan)'}${kp.cahaya.layar > 0.5 ? `, ${fm(kp.cahaya.layar, 0)} dari pantulan gambar` : ''}`,
              `${fm(kp.kontras, 1)} : 1 ${kp.cukup ? '✓' : `✗ (${perlu})`}`];
          }),
        }] : []),
        ...(disinari.length ? [{
          judul: `Objek yang disinari proyektor (${disinari.length})`, jenis: 'tabel' as const,
          kepala: ['Objek', 'Jenis / bentuk', 'Ukuran (L × T × P)', 'Posisi', 'Disinari oleh', 'Cakupan sinar'],
          isi: disinari.map(o => [o.b.nama, `${o.jenis}${bentukBidang(o.b)}`, `${fm(o.ukuran.w)} × ${fm(o.ukuran.h)} × ${fm(o.ukuran.d)} m`,
            `X ${fm(o.b.x)} · Z ${fm(o.b.z)} m · ${fm(o.b.elev)} m dari lantai${o.b.rot ? ` · putar ${fm(o.b.rot, 0)}°` : ''}`, o.proyektor.map(p => p.nama).join(', '), cakupanObjek(o)]),
        }] : []),
        ...(tampilBlending && infoBlending.length ? [{
          judul: 'Area blending proyektor · per tepi gambar', jenis: 'tabel' as const,
          kepala: ['Proyektor', 'Tepi kiri', 'Tepi kanan', 'Tepi atas', 'Tepi bawah'],
          isi: blendingPerProyektor(benda, infoBlending).map(({ p, sisi }) => [`${p.nama}${rollDari(p) ? ` · putar ${fm(rollDari(p), 0)}°` : ''}`,
            ...SISI_GAMBAR.map(s => sisi[s].map(t => `${fm(t.persen, 1)}% ≈ ${t.px} px · ${Math.round(t.lebarM * 100)} cm (dengan ${namaPendek(t.dengan)})`).join('; ') || '—')]),
        }] : []),
        ...(benda.some(b => b.jenis === 'lampu') ? [{
          judul: `Pencahayaan · dimmer semua lampu ${ruang.dimmer ?? 100}%`, jenis: 'tabel' as const,
          kepala: ['Lampu', 'Jumlah', 'Lumen / unit', 'Sudut sinar', 'Dimmer', 'Suhu warna'], rataKanan: [1, 2, 3, 4],
          isi: [...benda.filter(b => b.jenis === 'lampu').reduce((m, b) => {
            const kunci = `${b.tipeLampu}|${lumenLampu(b)}|${sudutLampuDari(b)}|${b.dimmer ?? 100}|${b.kelvin ?? 4000}`;
            const ada = m.get(kunci); if (ada) ada.n++; else m.set(kunci, { b, n: 1 });
            return m;
          }, new Map<string, { b: Benda; n: number }>()).values()].map(({ b, n }) => [SPEK_LAMPU[b.tipeLampu ?? 'downlight'].label, String(n), `${lumenLampu(b).toLocaleString('id-ID')} lm`,
            `${fm(sudutLampuDari(b), 0)}°`, `${b.dimmer ?? 100}%`, `${b.kelvin ?? 4000} K`]).concat(kotakRuang.map((_, i) => {
            const lx = luxBidangKerja(benda, ruang, i);
            return [`Rata-rata di meja${kotakRuang.length > 1 ? ` (Ruang ${i + 1})` : ''}`, '', `±${fm(lx.rata, 0)} lux`, `min ${fm(lx.min, 0)}`, `maks ${fm(lx.maks, 0)}`, ''];
          })),
        }] : []),
        ...(speaker.length ? [{
          judul: `Audio · speaker (${speaker.length})`, jenis: 'tabel' as const,
          kepala: ['Speaker', 'Tipe', 'Pemasangan', 'Sebaran H × V', 'Jangkauan / cakupan'],
          isi: speaker.map(b => [b.nama, b.jenis === 'speaker-plafon' ? 'Speaker plafon' : `${NAMA_TIPE[tipeSpeakerDari(b)] ?? 'Speaker'}${tipeSpeakerDari(b) === 'linearray' ? ` · ${modulLA(b)} modul` : ''}`,
            b.jenis === 'speaker-plafon' ? `Plafon ${fm(b.elev)} m` : `${b.gantung ? 'Gantung' : 'Dinding / stand'} · ${fm(b.elev)} m`,
            `${fm(sebaranSpeaker(b), 0)}° × ${fm(sebaranVSpeaker(b), 0)}°${tipeSpeakerDari(b) === 'linearray' && b.jenis === 'speaker' ? ' / modul' : ''}`,
            b.jenis === 'speaker-plafon' ? `radius ±${fm(cakupanSpeakerPlafon(b), 1)} m di tinggi dengar`
              : tipeSpeakerDari(b) === 'linearray' ? jangkauLA(b) : `±${fm(jangkauanDari(b), 0)} m`]),
        }] : []),
      ],
      catatan: 'Aturan 4-6-8: jarak penonton terjauh maksimal 4, 6, atau 8 kali tinggi gambar untuk konten detail, analitis, atau umum. Ukuran produk mengikuti katalog bawaan; sesuaikan dengan datasheet sebelum penawaran.',
      tandaTangan: [{ label: 'Dibuat oleh', nama: getSession<{ full_name?: string }>()?.full_name ?? '' }, { label: 'Disetujui' }],
    };
  };
  const cetak = () => bukaCetak(lembar3D());
  const unduhDxf = () => {
    setMenuPng(false);
    const url = URL.createObjectURL(new Blob([dxfDenah(denahDari(ruang, benda))], { type: 'application/dxf' }));
    unduhUrl(url, `${namaGambar('denah')}.dxf`);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const pngLembar = () => unduhLembarPNG(lembar3D(), namaGambar('lembar'));
  const unduhBomExcel = () => {
    setMenuPng(false);
    const bom = bomDesain(benda, kabelLengkap());
    loadXLSX(XLSX => {
      const rows: (string | number)[][] = [
        [`BOM - ${namaDesain || 'Desain AV'}`], [`Desain 3D Ruang AV · ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`], [],
        ['No', 'Kategori', 'Item', 'Ukuran / panjang', 'Jumlah', 'Satuan', 'Catatan'],
        ...bom.map((b, i) => [i + 1, b.kategori, b.item, b.ukuran, b.jumlah, b.satuan, b.catatan]),
        [], ['Ukuran produk mengikuti katalog bawaan; sesuaikan dengan datasheet sebelum penawaran. Panjang kabel sudah termasuk lekukan & service loop.'],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 40 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 46 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BOM');
      XLSX.writeFile(wb, `${namaGambar('BOM')}.xlsx`);
    }, () => setGalat('Excel gagal dibuat - periksa koneksi.'));
  };
  const draftChecklist = (judul: string) => checklistDariBom(judul, bomDesain(benda, kabelLengkap()));
  const ringkasan = () => [
    `*Desain ruang: ${namaDesain}*`,
    ...kotakRuang.map((k, i) => `Ruang ${i + 1}: ${f(k.p)} × ${f(k.l)} m, plafon ${f(k.t)} m`),
    ...Object.entries(benda.reduce<Record<string, number>>((m, b) => { m[b.nama] = (m[b.nama] ?? 0) + 1; return m; }, {})).map(([n, j]) => `- ${n}: ${j}`),
    ...analisis.map(a => `${a.d.nama}${kotakRuang.length > 1 ? ` (ruang ${a.ri + 1})` : ''}: gambar ${f(a.gambar.w)} × ${f(a.gambar.h)} m, penonton terjauh ${f(a.terjauh, 1)} m → tinggi perlu ${f(a.tinggiPerlu)} m (${a.cukup ? 'CUKUP' : 'KURANG'}), sudut maks ${f(a.sudutMaks, 0)}°`),
    ...benda.filter(b => b.jenis === 'proyektor').map(p => {
      const sn = sinarProyektor(p, benda, ruang), g = gambarDiSasaran(p, benda, ruang), u = ukuranTampak(p, g.lebar, g.tinggi);
      return `${p.nama}: jarak lempar ${f(g.jarak)} m → gambar ${f(u.lebar)} × ${f(u.tinggi)} m${potretDari(p) ? ' (potret)' : ''} (throw ratio ${f(throwRatioDari(p))}${sn.layar && sn.trPas ? `; pas ${sn.layar.nama} perlu ${f(sn.trPas)}` : ''})`;
    }),
  ].join('\n');

  return { denahCetak, setDenahCetak, kabelCetak, setKabelCetak, rakCetak, setRakCetak, cetak, draftChecklist, unduhBomExcel, unduhDxf, fotoKanvas, jalankanPng, lembar3D, menuPng, namaGambar, pngLembar, ringkasan, setMenuPng, setSibukPng, sibukPng, unduhEmpatTampak, unduhFoto };
}
