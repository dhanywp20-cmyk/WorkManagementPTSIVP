/** Teks ringkasan & bagian lembar cetak Screen Connection. */
import { esc, type Seksi } from '../../bersama/cetak';
import { f } from '../../bersama/ui';
import { type DataKoneksi, namaCadangan, namaPort, type PengaturanKoneksi, SUDUT, type Susunan, susunKoneksi } from './data';
import { svgKoneksi } from './svg';
import type { SudutMulai } from '@/lib/av-hitung';

export const teksCadangan = (t: Susunan) => (t.cadangan === 'loop' ? ` · loop cadangan +${t.portCadangan} kabel`
  : t.cadangan === 'controller' ? ` · +${t.controllerCadangan} controller cadangan` : '');

const teksSudut = (s: SudutMulai) => SUDUT.find(x => x.v === s)!.l.toLowerCase();

export const teksCara = (s: PengaturanKoneksi) => (s.mode === 'manual' ? 'kabel manual'
  : `mulai ${teksSudut(s.mulai)}, ${s.arah === 'horizontal' ? 'mendatar' : 'tegak'} pola ${s.pola}, ${s.bagi === 'baris' ? 'baris utuh' : 'isi penuh'}`);

/** Ringkasan untuk Salin/WA. */
export function ringkasanKoneksi(d: DataKoneksi, s: PengaturanKoneksi): string {
  const t = susunKoneksi(d, s), k = t.hasil;
  return [
    `Screen connection: ${k.sel.length} receiving card${t.rc ? ` ${t.rc.nama}` : ''} (${t.K}×${t.B}${t.kosong.size ? `, ${t.kosong.size} sel kosong` : ''}), resolusi ${t.resX}×${t.resY} px`,
    `${t.portTerpakai} port LAN${t.ppkPenuh > 0 ? ` · ${t.controller} controller × ${t.ppkPenuh} port` : ''}${teksCadangan(t)} · kapasitas ${f(t.pxPort / 1000, 0)} rb px/port, batas ${s.beban}%`,
    `Kabel: ${teksCara(s)}`,
    ...k.port.map(p => `- ${namaPort(t, p.port)}: ${p.jumlah} RC, ${p.px.toLocaleString('id-ID')} px (${f(p.beban, 0)}%)${p.mulai ? `, masuk kolom ${p.mulai.c + 1} baris ${p.mulai.r + 1}` : ''}${t.cadangan !== 'tidak' && p.jumlah ? `, cadangan ke ${namaCadangan(t, p.port)}` : ''}`),
    k.tanpaPort.length ? `Belum tersambung: ${k.tanpaPort.length} receiving card` : '',
  ].filter(Boolean).join('\n');
}

/** Seksi lembar cetak: diagram + tabel port. */
export function seksiCetakKoneksi(d: DataKoneksi, s: PengaturanKoneksi): Seksi[] {
  const t = susunKoneksi(d, s), k = t.hasil;
  const ket = `${t.K} × ${t.B} receiving card${t.rc ? ` ${t.rc.nama}` : ''} · ${t.resX} × ${t.resY} px · ${teksCara(s)}${teksCadangan(t)} · label sel = port-urutan, angka kecil = ukuran receiving card (px)${t.cadangan !== 'tidak' ? ', B = kabel cadangan dari ujung rantai' : ''}`;
  const peringatan = [k.galat, k.tanpaPort.length ? `${k.tanpaPort.length} receiving card belum tersambung.` : '', k.lewat.length ? `Port melebihi batas beban: ${k.lewat.join(', ')}.` : '']
    .filter(Boolean).map(x => `<p style="margin:4px 0 0;font-size:11px;color:#b91c1c">${esc(x)}</p>`).join('');
  return [
    { judul: 'Screen connection (urutan kabel data)', jenis: 'html',
      html: `<div class="diagram">${svgKoneksi(d, t)}<p style="margin:6px 0 0;font-size:11px;color:#475569">${esc(ket)}</p>${peringatan}</div>` },
    { judul: 'Pembagian port LAN', jenis: 'tabel', kepala: ['Port', 'Receiving card', 'Pixel', 'Beban', 'Masuk di', ...(t.cadangan !== 'tidak' ? ['Kabel cadangan (B)'] : [])], rataKanan: [1, 2, 3],
      isi: k.port.map(p => [namaPort(t, p.port), String(p.jumlah), p.px.toLocaleString('id-ID'), `${f(p.beban, 0)}%`, p.mulai ? `kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}` : '—',
        ...(t.cadangan !== 'tidak' ? [p.jumlah ? namaCadangan(t, p.port) : '—'] : [])]) },
  ];
}
