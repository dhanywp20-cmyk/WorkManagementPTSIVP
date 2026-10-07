'use client';
/** Ekspor Kalkulator LED: ringkasan teks, lembar cetak & PNG (LED, BOM / penawaran, Screen & Power Connection). */
import { bukaCetak, diagramSusunan, type Info, type Lembar, namaBerkas, unduhLembarPNG } from '../bersama/cetak';
import { f } from '../bersama/ui';
import { ringkasanDaya, seksiCetakDaya } from './daya/teks';
import { ringkasanKoneksi, seksiCetakKoneksi } from './koneksi/teks';
import { KECERAHAN } from '@/lib/av-hitung';
import { rupiah } from './data';
import type { KeadaanLED } from './useKeadaanLED';

export function useEksporLED(K: KeadaanLED) {
  const { adaHarga, baris, barisBom, beratUnitEf, bit, bom, customer, dataDaya, dataKoneksi, dayaLED, dayaUnitEf, faktorDaya, faktorRata, h, hDaya, harga, hw, kolom, koneksi, labelLED, lewat4K, lingkungan, mode, modeHw, n, namaUnit, nilaiPenawaran, pembuat, project, px, refresh, satuan, selisihH, selisihW, tKon, tanggal, tegangan, teksHw, u } = K;
  const ringkasan = () => [
    project && `*${project}*${customer ? ` - ${customer}` : ''}`,
    `*LED Videotron ${labelLED} ${lingkungan}*${n > 1 ? ` · ${n} screen identik` : ''}`,
    `${namaUnit[0].toUpperCase()}${namaUnit.slice(1)} ${u.w}×${u.h} mm (${px.x}×${px.y} px): ${kolom} × ${baris} = ${h.jumlahCab} ${namaUnit}/screen${n > 1 ? `, total ${h.jumlahCab * n}` : ''}`,
    `Ukuran: ${f(h.lebarM)} × ${f(h.tinggiM)} m (${f(h.luasM2)} m², diagonal ${f(h.diagonalInci, 0)}")${n > 1 ? `, total ${f(h.luasM2 * n)} m²` : ''}`,
    `Resolusi: ${h.resX} × ${h.resY} px (${f(h.totalPx / 1e6, 2)} MP), rasio ${h.rasioTerdekat}`,
    `Jarak pandang: min ${f(h.jarakMinM, 1)} m, ideal ±${f(h.jarakIdealM, 1)} m`,
    `Daya/screen: maks ${f(h.dayaMaksW / 1000)} kW, rata-rata ${f(h.dayaRataW / 1000)} kW; arus maks ${f(h.arusMaksA, 1)} A @${tegangan}V PF ${f(faktorDaya)}, MCB ${h.mcbSaranA} A`,
    `Panas ±${f(h.panasBTU, 0)} BTU/jam; berat ±${f(h.beratKg, 0)} kg/screen`,
    `Data: ${h.portLAN} port LAN (${refresh} Hz, ${bit}-bit)`,
    modeHw === 'manual' ? `Hardware: ${teksHw || '-'} /screen` : hw.vp && `All-in-one: ${hw.vp.qty}× ${hw.vp.hw.nama}/screen`,
    modeHw === 'otomatis' && hw.kartu && `Atau sending card: ${hw.kartu.qty}× ${hw.kartu.hw.nama}/screen + video processor`,
    (pembuat || tanggal) && `Dibuat: ${[pembuat, tanggal].filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n');

  /** Lembar cetak A4 (pola Request Design Project), bukan tangkapan tampilan web; juga diekspor sebagai PNG. */
  const lembarLED = (): Lembar => {
    const satu = (judul: string, nilai: string, sorot = false): Info => ({ label: judul, nilai, sorot });
    const kali = (v: string) => (n > 1 ? `${v} / screen` : v);
    const hwBaris: Info[] = modeHw === 'manual'
      ? [satu('Hardware (pilihan manual)', teksHw ? `${teksHw} / screen` : '—', true)]
      : [
        ...(hw.vp ? [satu('Opsi A · All-in-one', `${hw.vp.qty}× ${hw.vp.hw.nama} / screen — ${hw.vp.hw.ket}`, true)] : []),
        ...(hw.kartu ? [satu('Opsi B · Sending card', `${hw.kartu.qty}× ${hw.kartu.hw.nama} / screen + video processor — ${hw.kartu.hw.ket}`)] : []),
      ];
    return {
      judul: 'Kalkulator LED Videotron',
      subjudul: [project || 'Tanpa nama project', customer].filter(Boolean).join(' — '),
      kepala: [['Tanggal', tanggal], ['Dibuat oleh', pembuat]],
      seksi: [
        { judul: 'Informasi project', jenis: 'info',
          kiri: [satu('Nama project', project), satu('Customer', customer)],
          kanan: [satu('Tanggal', tanggal), satu('Dibuat oleh', pembuat)] },
        { judul: 'Konfigurasi layar', jenis: 'info',
          kiri: [
            ...(satuan === 'modul' ? [satu('Brand / model', [u.merek, u.model].filter(Boolean).join(' · '))] : []),
            satu('Pitch / tipe', `${u.kode} · ${lingkungan}`),
            satu(`Ukuran ${namaUnit}`, `${u.w} × ${u.h} mm · ${px.x} × ${px.y} px`),
            satu('Kecerahan disarankan', KECERAHAN[lingkungan]),
          ],
          kanan: [
            satu('Susunan', `${kolom} kolom × ${baris} baris`, true),
            satu(`Jumlah ${namaUnit}`, `${h.jumlahCab} / screen${n > 1 ? ` · ${n} screen identik = ${h.jumlahCab * n}` : ''}`),
            satu('Selisih dari target', mode === 'ukuran' ? `${selisihW >= 0 ? '+' : ''}${f(selisihW * 100, 0)} cm lebar, ${selisihH >= 0 ? '+' : ''}${f(selisihH * 100, 0)} cm tinggi` : 'Dihitung dari jumlah'),
          ] },
        { judul: 'Susunan layar', jenis: 'html', html: diagramSusunan(kolom, baris, h.lebarM, h.tinggiM, namaUnit) },
        { judul: n > 1 ? 'Hasil per screen' : 'Hasil', jenis: 'info',
          kiri: [
            satu('Ukuran', `${f(h.lebarM)} × ${f(h.tinggiM)} m`, true),
            satu('Luas / diagonal', `${f(h.luasM2)} m² · ${f(h.diagonalInci, 0)}"${n > 1 ? ` (total ${f(h.luasM2 * n)} m²)` : ''}`),
            satu('Jarak pandang', `minimum ${f(h.jarakMinM, 1)} m · ideal ±${f(h.jarakIdealM, 1)} m`),
          ],
          kanan: [
            satu('Resolusi', `${h.resX} × ${h.resY} px`, true),
            satu('Total piksel', `${f(h.totalPx / 1e6, 2)} MP${lewat4K ? ' · melebihi 4K, butuh input/processor 4K+' : ''}`),
            satu('Rasio', `${h.rasioTerdekat} (tepat ${h.rasio})`),
          ] },
        { judul: 'Daya & instalasi', jenis: 'info',
          kiri: [
            satu('Daya maksimum', kali(`${f(h.dayaMaksW / 1000)} kW`), true),
            satu('Daya rata-rata', kali(`${f(h.dayaRataW / 1000)} kW (${faktorRata}% dari maks)`)),
            satu(`Arus maks @${tegangan} V · PF ${f(faktorDaya)}`, kali(`${f(h.arusMaksA, 1)} A · MCB ${h.mcbSaranA} A`)),
          ],
          kanan: [
            satu('Panas', kali(`±${f(h.panasBTU, 0)} BTU/jam`)),
            satu('Berat', kali(`±${f(h.beratKg, 0)} kg (belum termasuk rangka)`)),
            satu(`Daya / berat per ${namaUnit}`, `${f(dayaUnitEf, 1)} W · ${f(beratUnitEf, 2)} kg`),
          ] },
        { judul: 'Data & hardware', jenis: 'info',
          kiri: [
            satu('Port LAN', kali(`${h.portLAN} port`), true),
            satu('Kapasitas per port', `±${f(h.pxPerPort / 1000, 0)} rb px · ${refresh} Hz, ${bit}-bit`),
          ],
          kanan: hwBaris.length ? hwBaris : [satu('Hardware', '—')] },
      ],
      catatan: 'Angka daya, berat, dan kapasitas port adalah nilai umum industri. Verifikasi dengan datasheet produk dan NovaLCT sebelum penawaran resmi.',
      tandaTangan: [{ label: 'Dibuat oleh', nama: pembuat }, { label: 'Diperiksa' }],
    };
  };
  const cetak = () => bukaCetak(lembarLED());
  const pngLED = () => unduhLembarPNG(lembarLED(), namaBerkas('LED', labelLED, project, customer));

  /** Lembar daftar material; dengan harga = penawaran (quotation). */
  const lembarBom = (): Lembar => ({
    judul: adaHarga ? 'Penawaran LED Videotron' : 'Daftar Material LED Videotron',
    subjudul: [project || 'Tanpa nama project', customer].filter(Boolean).join(' — '),
    kepala: [['Tanggal', tanggal], ['Dibuat oleh', pembuat]],
    seksi: [
      { judul: 'Layar', jenis: 'info',
        kiri: [{ label: 'LED', nilai: `${labelLED} · ${kolom} × ${baris} ${namaUnit}${n > 1 ? ` · ${n} screen` : ''}` }, { label: 'Ukuran', nilai: `${f(h.lebarM)} × ${f(h.tinggiM)} m · ${h.resX} × ${h.resY} px`, sorot: true }],
        kanan: [{ label: 'Customer', nilai: customer || '—' }, { label: 'Project', nilai: project || '—' }] },
      { judul: adaHarga ? 'Rincian penawaran' : 'Daftar material', jenis: 'tabel',
        kepala: adaHarga ? ['No', 'Item', 'Qty', 'Satuan', 'Harga satuan', 'Jumlah', 'Keterangan'] : ['No', 'Item', 'Qty', 'Satuan', 'Keterangan'],
        rataKanan: adaHarga ? [0, 2, 4, 5] : [0, 2],
        isi: [
          ...barisBom.map((b, i) => adaHarga
            ? [String(i + 1), b.item, b.qty.toLocaleString('id-ID'), b.satuan, harga[b.kunci] ? rupiah(harga[b.kunci]) : '—', harga[b.kunci] ? rupiah(harga[b.kunci] * b.qty) : '—', b.ket]
            : [String(i + 1), b.item, b.qty.toLocaleString('id-ID'), b.satuan, b.ket]),
          ...(adaHarga ? [
            ['', 'Subtotal', '', '', '', rupiah(nilaiPenawaran.subtotal), ''],
            ['', `PPN ${bom.ppn}%`, '', '', '', rupiah(nilaiPenawaran.ppn), ''],
            ['', 'TOTAL', '', '', '', rupiah(nilaiPenawaran.total), ''],
          ] : []),
        ] },
    ],
    catatan: 'Jumlah power supply, kabel, dan rangka adalah perkiraan lapangan dari Tools Team. Cadangan (spare) disarankan 2-3% untuk modul & receiving card. Harga dapat berubah; verifikasi stok & datasheet sebelum penawaran resmi.',
    tandaTangan: [{ label: 'Dibuat oleh', nama: pembuat }, { label: 'Disetujui' }],
  });
  const teksBom = () => [
    project && `*${project}*${customer ? ` - ${customer}` : ''}`,
    `*${adaHarga ? 'Penawaran' : 'Daftar material'} LED ${labelLED}* · ${f(h.lebarM)}×${f(h.tinggiM)} m${n > 1 ? ` · ${n} screen` : ''}`,
    ...barisBom.map((b, i) => `${i + 1}. ${b.item}: ${b.qty} ${b.satuan}${harga[b.kunci] ? ` × ${rupiah(harga[b.kunci])} = ${rupiah(harga[b.kunci] * b.qty)}` : ''}${b.ket ? ` (${b.ket})` : ''}`),
    adaHarga && `Subtotal ${rupiah(nilaiPenawaran.subtotal)} · PPN ${bom.ppn}% ${rupiah(nilaiPenawaran.ppn)} · *Total ${rupiah(nilaiPenawaran.total)}*`,
  ].filter(Boolean).join('\n');
  const namaFile = [project, customer].filter(Boolean).join(' - ') || `LED ${u.kode} ${f(h.lebarM)}x${f(h.tinggiM)} m`;
  const lembarDaya = (): Lembar => ({
    judul: 'Power Connection LED',
    subjudul: [project || 'Tanpa nama project', customer].filter(Boolean).join(' — '),
    kepala: [['Tanggal', tanggal], ['Dibuat oleh', pembuat]],
    seksi: [
      { judul: 'Layar & listrik', jenis: 'info',
        kiri: [
          { label: 'LED', nilai: `${labelLED} · ${kolom} × ${baris} ${namaUnit} · ${f(h.lebarM)} × ${f(h.tinggiM)} m` },
          { label: `Daya maks per ${namaUnit}`, nilai: `${f(dayaUnitEf, 1)} W · total ${f(h.dayaMaksW / 1000)} kW`, sorot: true },
        ],
        kanan: [
          { label: 'Sumber', nilai: `${dayaLED.fase === 3 ? '3 fase' : '1 fase'} · ${tegangan} V · PF ${f(faktorDaya)}` },
          { label: 'Sirkuit', nilai: `${hDaya.sirkuit.length} × MCB ${dayaLED.mcb} A (beban maks ${dayaLED.beban}%)`, sorot: true },
        ] },
      ...seksiCetakDaya(dataDaya, dayaLED),
    ],
    catatan: 'Rencana sirkuit dari Tools Team (daya maksimum putih penuh). Ukuran kabel, grounding, dan panel diverifikasi instalatir listrik sebelum instalasi.',
    tandaTangan: [{ label: 'Dibuat oleh', nama: pembuat }, { label: 'Diperiksa' }],
  });
  const teksDaya = () => [
    project && `*${project}*${customer ? ` - ${customer}` : ''}`,
    `*Power Connection LED ${labelLED}* · ${kolom}×${baris} ${namaUnit} (${f(h.lebarM)}×${f(h.tinggiM)} m)`,
    ringkasanDaya(dataDaya, dayaLED),
  ].filter(Boolean).join('\n');
  const t = tKon;
  const lembarKoneksi = (): Lembar => ({
    judul: 'Screen Connection LED',
    subjudul: [project || 'Tanpa nama project', customer].filter(Boolean).join(' — '),
    kepala: [['Tanggal', tanggal], ['Dibuat oleh', pembuat]],
    seksi: [
      { judul: 'Layar', jenis: 'info',
        kiri: [
          { label: 'Project', nilai: [project, customer].filter(Boolean).join(' — ') || '—' },
          { label: 'LED', nilai: `${labelLED} · ${kolom} × ${baris} ${namaUnit} · ${f(h.lebarM)} × ${f(h.tinggiM)} m` },
          { label: 'Resolusi', nilai: `${t.resX} × ${t.resY} px`, sorot: true },
        ],
        kanan: [
          { label: 'Receiving card', nilai: `${t.hasil.sel.length} (${t.K} × ${t.B})`, sorot: true },
          { label: 'Port LAN', nilai: `${t.portTerpakai} port${t.ppk > 0 ? ` · ${t.controller} controller × ${t.ppk} port` : ''}` },
          { label: 'Kapasitas per port', nilai: `${t.pxPort.toLocaleString('id-ID')} px · batas ${koneksi.beban}% · ${refresh} Hz ${bit}-bit` },
        ] },
      ...seksiCetakKoneksi(dataKoneksi, koneksi),
    ],
    catatan: 'Diagram dari Tools Team. Samakan dengan konfigurasi NovaLCT (Screen Configuration → Screen Connection) dan datasheet receiving card sebelum instalasi.',
    tandaTangan: [{ label: 'Dibuat oleh', nama: pembuat }, { label: 'Diperiksa' }],
  });
  const cetakKoneksi = () => bukaCetak(lembarKoneksi());
  const pngKoneksi = () => unduhLembarPNG(lembarKoneksi(), namaBerkas('Screen Connection', labelLED, project, customer));
  const teksKoneksi = () => [
    project && `*${project}*${customer ? ` - ${customer}` : ''}`,
    `*Screen Connection LED ${labelLED}* · ${kolom}×${baris} ${namaUnit} (${f(h.lebarM)}×${f(h.tinggiM)} m)`,
    ringkasanKoneksi(dataKoneksi, koneksi),
    (pembuat || tanggal) && `Dibuat: ${[pembuat, tanggal].filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n');

  return { cetak, cetakKoneksi, lembarBom, lembarDaya, lembarKoneksi, lembarLED, namaFile, pngKoneksi, pngLED, ringkasan, teksBom, teksDaya, teksKoneksi };
}
