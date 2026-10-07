'use client';
/**
 * Ekspor: foto kanvas, PNG (tampak, 4 tampak, lembar), lembar cetak A4, ringkasan teks.
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { useState } from 'react';
import { bukaCetak, esc, type Lembar, namaBerkas, unduhKanvasPNG, unduhLembarPNG } from '../../bersama/cetak';
import { type Benda, cakupanSpeakerPlafon, DISPLAY, jangkauanDari, kontrasProyektor, lumenDari, lumenLampu, luxBidangKerja, modulLA, pikselBlending, rekapKabel, sambunganKe, sebaranSpeaker, sebaranVSpeaker, sinarProyektor, SPEK_LAMPU, sudutLampuDari, svgElevasiRak, throwRatioDari, tipeSpeakerDari } from '../inti';
import { denganLegendaSamping, gambarLegendaBaris, htmlLegendaKabel } from '../panel/LegendaKabel';
import { f } from '../../bersama/ui';
import { getSession } from '@/lib/auth';
import type { KeadaanDesain } from '../useKeadaanDesain';
import type { useKamera } from '../mesin/useKamera';
import { ARAH_SUDUT, type Sudut, TAMPAK } from '../mesin/tipe';
import { gambarLabel } from '../mesin/label';
import { posisiPas } from '../mesin/kamera';


export function useEkspor(K: KeadaanDesain, dep: Pick<ReturnType<typeof useKamera>, 'fokusKotak'>) {
  const { analisis, benda, duaRuang, faktorCustom, infoBlending, jenisPandang, kabel, kotakRuang, legendaKabel, mesin, namaDesain, pilih, ruang, setGalat, tampilBlending, targetKontras } = K;
  const { fokusKotak } = dep;
  /**
   * Foto kanvas 3D (resolusi `skala` x layar) tanpa gizmo & kotak sorotan, label ukuran/jarak
   * ikut tergambar. `arah` = sudut kamera sementara; kamera dikembalikan seperti semula.
   */
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
  const [sibukPng, setSibukPng] = useState(false);
  const jalankanPng = async (kerja: () => Promise<void>) => {
    setMenuPng(false); setSibukPng(true);
    try { await kerja(); } catch { setGalat('Gambar PNG gagal dibuat.'); } finally { setSibukPng(false); }
  };
  const unduhFoto = (arah: 'sekarang' | Sudut, bagian: string) => jalankanPng(async () => {
    const foto = fotoKanvas(arah, 2); if (!foto) throw new Error('foto');
    //  Jalur kabel dicentang -> legend di panel samping (tidak menutupi ruangan); tidak dicentang -> tanpa legend.
    const c = legendaKabel ? denganLegendaSamping(foto, legendaKabel, foto.width / Math.max(1, mesin.current?.renderer.domElement.clientWidth || foto.width)) : foto;
    await unduhKanvasPNG(c, namaGambar(bagian));
  });
  /** Empat tampak dalam satu gambar (2 x 2) dengan judul - siap dikirim ke customer. */
  const unduhEmpatTampak = () => jalankanPng(async () => {
    const foto = TAMPAK.map(t => ({ ...t, c: fotoKanvas(t.arah, 1.5) }));
    if (foto.some(x => !x.c)) throw new Error('foto');
    const w = foto[0].c!.width, h = foto[0].c!.height, k = w / 900;
    const jarak = Math.round(16 * k), kepala = Math.round(70 * k), keterangan = Math.round(34 * k);
    const c = document.createElement('canvas');
    c.width = w * 2 + jarak * 3;
    //  Legend kabel sekali saja, sebaris di bawah keempat tampak (hanya bila jalur kabel dicentang).
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
  /** Lembar cetak A4 (pola Request Design Project), bukan tangkapan tampilan web; juga diekspor sebagai PNG. */
  const lembar3D = (): Lembar => {
    const foto = TAMPAK.map(t => ({ ...t, url: fotoKanvas(t.arah, 1.5)?.toDataURL('image/jpeg', 0.86) ?? '' }));
    const fm = (n: number, d = 2) => f(n, d);
    //  Daftar perangkat: dikelompokkan per kategori, benda bernama sama dijumlah.
    const kategori = (j: Benda['jenis']) =>
      j === 'lampu' ? 'Interior & pencahayaan'
        : DISPLAY.includes(j) || j === 'proyektor' || j === 'bidang' ? 'Display' : j === 'kamera' || j === 'lift' ? 'Kamera & konferensi'
        : ['speaker', 'speaker-plafon', 'mic', 'touchpanel', 'rak'].includes(j) ? 'Audio & kontrol'
          : j === 'meja' || j === 'kursi' || j === 'tribun' || j === 'panggung' ? 'Furnitur' : 'Lainnya';
    const urutKat = ['Display', 'Kamera & konferensi', 'Audio & kontrol', 'Furnitur', 'Interior & pencahayaan', 'Lainnya'];
    const grup = new Map<string, { kat: string; nama: string; ukuran: string; jumlah: number }>();
    for (const b of benda) {
      const nama = b.nama.replace(/\s+\d+\.\d+$/, '');   // "Meja kelas 2.3" -> "Meja kelas"
      const kunci = `${kategori(b.jenis)}|${nama}|${fm(b.w)}x${fm(b.d)}`;
      const ada = grup.get(kunci);
      if (ada) ada.jumlah++;
      else grup.set(kunci, { kat: kategori(b.jenis), nama, ukuran: `${fm(b.w)} × ${fm(b.h)} × ${fm(b.d)} m`, jumlah: 1 });
    }
    const baris = [...grup.values()].sort((a, b) => urutKat.indexOf(a.kat) - urutKat.indexOf(b.kat) || a.nama.localeCompare(b.nama));
    const label = jenisPandang === 'custom' ? `Custom (${faktorCustom}×)` : { detail: 'Detail (4×)', analitis: 'Analitis (6×)', umum: 'Umum (8×)' }[jenisPandang];
    const proyektor = benda.filter(b => b.jenis === 'proyektor').map(p => ({ p, sn: sinarProyektor(p, benda, ruang) }));
    const gambar = (src: string, ket: string) => (src ? `<figure><img src="${src}" alt="${esc(ket)}"/><figcaption>${esc(ket)}</figcaption></figure>` : '');
    const speaker = benda.filter(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon');
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
        { judul: 'Tampilan desain', jenis: 'html',
          html: `<div class="gambar dua">${foto.map(x => gambar(x.url, x.judul)).join('')}</div>` },
        ...(legendaKabel ? [{ judul: 'Legend kabel', jenis: 'html' as const, html: htmlLegendaKabel(legendaKabel) }] : []),
        ...(kabel.length ? [{ judul: 'Jadwal kabel', jenis: 'tabel' as const, kepala: ['Dari', 'Ke', 'Kabel', 'Panjang', 'Lewat'], rataKanan: [3],
          isi: [...kabel.map(k => [k.dari, k.ke, k.kabel.nama, `±${fm(k.panjang)} m`, k.lewat]),
            ...rekapKabel(kabel).map(r => ['TOTAL', '', r.kabel.nama, `±${fm(r.meter)} m`, r.gulungan])] }] : []),
        ...(benda.some(b => b.jenis === 'rak') ? [{ judul: 'Rack elevation', jenis: 'html' as const,
          html: `<div class="gambar dua">${benda.filter(b => b.jenis === 'rak').map(b => `<div>${svgElevasiRak(b)}</div>`).join('')}</div>` }] : []),
        { judul: `Daftar perangkat & furnitur (${benda.length} item)`, jenis: 'tabel', kepala: ['Kategori', 'Item', 'Ukuran (L × T × P)', 'Jumlah'], rataKanan: [3],
          isi: baris.map(r => [r.kat, r.nama, r.ukuran, String(r.jumlah)]) },
        ...(analisis.length ? [{
          judul: `Analisis jarak pandang · konten ${label}`, jenis: 'tabel' as const,
          kepala: ['Display', ...(duaRuang ? ['Ruang'] : []), 'Ukuran gambar', 'Penonton terjauh', 'Tinggi minimal', 'Sudut maks', 'Status'],
          rataKanan: duaRuang ? [3, 4, 5] : [2, 3, 4],
          isi: analisis.map(a => [a.d.nama, ...(duaRuang ? [`Ruang ${a.ri + 1}`] : []), `${fm(a.d.w)} × ${fm(a.d.h)} m`,
            a.jumlah ? `${fm(a.terjauh, 1)} m` : '—', `${fm(a.tinggiPerlu)} m`, `${fm(a.sudutMaks, 0)}°`, a.jumlah ? (a.cukup ? 'Cukup' : 'Kurang') : 'Tanpa penonton']),
        }] : []),
        //  Proyektor dipecah 2 tabel: 11 kolom dalam satu tabel tidak muat di lebar A4 (kolom kanan terpotong).
        ...(proyektor.length ? [{
          judul: 'Proyektor & jarak lempar', jenis: 'tabel' as const,
          kepala: ['Proyektor', 'Pemasangan', 'Sasaran', 'Jarak lempar', 'Ukuran gambar', 'Throw ratio', 'TR agar pas'],
          rataKanan: [3, 5, 6],
          isi: proyektor.map(({ p, sn }) => [p.nama, p.pasangProyektor === 'meja' ? 'Portabel di meja' : `Plafon (${fm(p.elev)} m dari lantai)`,
            sn.layar?.nama ?? 'Dinding / permukaan', `${fm(sn.jarak)} m`, `${fm(sn.lebar)} × ${fm(sn.tinggi)} m`, `${fm(throwRatioDari(p))} : 1`, sn.trPas ? `${fm(sn.trPas)} : 1` : '—']),
        }, {
          judul: `Kecerahan & kontras proyektor · target ${targetKontras}:1`, jenis: 'tabel' as const,
          kepala: ['Proyektor', 'Lumen', 'Cahaya di gambar', 'Cahaya lampu di gambar', 'Kontras'],
          rataKanan: [1, 2, 3, 4],
          isi: proyektor.map(({ p }) => {
            const kp = kontrasProyektor(p, benda, ruang, targetKontras);
            return [p.nama, lumenDari(p).toLocaleString('id-ID'), `${fm(kp.luxGambar, 0)} lux`, `${fm(kp.cahaya.total, 0)} lux${kp.cahaya.dariLampu ? '' : ' (perkiraan)'}`,
              `${fm(kp.kontras, 1)} : 1 ${kp.cukup ? '✓' : `✗ (perlu ±${kp.lumenPerlu.toLocaleString('id-ID')} lm)`}`];
          }),
        }] : []),
        ...(tampilBlending && infoBlending.length ? [{
          judul: 'Area blending proyektor', jenis: 'tabel' as const,
          kepala: ['Proyektor', 'Bertumpuk dengan', 'Arah', 'Lebar / tinggi area', '% gambar pertama', '% gambar kedua'], rataKanan: [3, 4, 5],
          isi: infoBlending.map(b => [b.namaA, b.namaB, b.arah, `${Math.round(b.lebarM * 100)} cm`,
            `${fm(b.persenA, 1)}% ≈ ${pikselBlending(b.persenA, b.arah)} px`, `${fm(b.persenB, 1)}% ≈ ${pikselBlending(b.persenB, b.arah)} px`]),
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
            b.jenis === 'speaker-plafon' ? `radius ±${fm(cakupanSpeakerPlafon(b), 1)} m di tinggi dengar` : `±${fm(jangkauanDari(b), 0)} m`]),
        }] : []),
      ],
      catatan: 'Aturan 4-6-8: jarak penonton terjauh maksimal 4, 6, atau 8 kali tinggi gambar untuk konten detail, analitis, atau umum. Ukuran produk mengikuti katalog bawaan; sesuaikan dengan datasheet sebelum penawaran.',
      tandaTangan: [{ label: 'Dibuat oleh', nama: getSession<{ full_name?: string }>()?.full_name ?? '' }, { label: 'Disetujui' }],
    };
  };
  const cetak = () => bukaCetak(lembar3D());
  const pngLembar = () => unduhLembarPNG(lembar3D(), namaGambar('lembar'));
  const ringkasan = () => [
    `*Desain ruang: ${namaDesain}*`,
    ...kotakRuang.map((k, i) => `Ruang ${i + 1}: ${f(k.p)} × ${f(k.l)} m, plafon ${f(k.t)} m`),
    ...Object.entries(benda.reduce<Record<string, number>>((m, b) => { m[b.nama] = (m[b.nama] ?? 0) + 1; return m; }, {})).map(([n, j]) => `- ${n}: ${j}`),
    ...analisis.map(a => `${a.d.nama}${kotakRuang.length > 1 ? ` (ruang ${a.ri + 1})` : ''}: ${f(a.d.w)} × ${f(a.d.h)} m, penonton terjauh ${f(a.terjauh, 1)} m → tinggi perlu ${f(a.tinggiPerlu)} m (${a.cukup ? 'CUKUP' : 'KURANG'}), sudut maks ${f(a.sudutMaks, 0)}°`),
    ...benda.filter(b => b.jenis === 'proyektor').map(p => {
      const sn = sinarProyektor(p, benda, ruang);
      return `${p.nama}: jarak lempar ${f(sn.jarak)} m → gambar ${f(sn.lebar)} × ${f(sn.tinggi)} m (throw ratio ${f(throwRatioDari(p))}${sn.layar && sn.trPas ? `; pas ${sn.layar.nama} perlu ${f(sn.trPas)}` : ''})`;
    }),
  ].join('\n');

  return { cetak, fotoKanvas, jalankanPng, lembar3D, menuPng, namaGambar, pngLembar, ringkasan, setMenuPng, setSibukPng, sibukPng, unduhEmpatTampak, unduhFoto };
}
