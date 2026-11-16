import { esc, type Seksi } from '../../bersama/cetak';
import { f } from '../../bersama/ui';
import { type DataKoneksi, type PengaturanKoneksi, SUDUT, type Susunan, susunKoneksi } from './data';
import { gambarPanelKoneksi } from './panel';
import { svgKoneksi } from './svg';
import { ringkasPort, teksRentang } from './ringkasPort';
import type { SudutMulai } from '@/lib/av/hitung';

export const teksCadangan = (t: Susunan) => (t.cadangan === 'loop' ? ` · loop cadangan +${t.portCadangan} kabel`
  : t.cadangan === 'controller' ? ` · +${t.controllerCadangan} controller cadangan` : '');

const teksSudut = (s: SudutMulai) => SUDUT.find(x => x.v === s)!.l.toLowerCase();

export const teksCara = (s: PengaturanKoneksi) => (s.mode === 'manual' ? 'kabel manual'
  : `mulai ${teksSudut(s.mulai)}, ${s.arah === 'horizontal' ? 'mendatar' : 'tegak'} pola ${s.pola}, ${s.bagi === 'baris' ? 'baris utuh' : 'isi penuh'}`);

export function ringkasanKoneksi(d: DataKoneksi, s: PengaturanKoneksi): string {
  const t = susunKoneksi(d, s), k = t.hasil;
  return [
    `Screen connection: ${k.sel.length} receiving card${t.rc ? ` ${t.rc.nama}` : ''} (${t.K}×${t.B}${t.kosong.size ? `, ${t.kosong.size} sel kosong` : ''}), resolusi ${t.resX}×${t.resY} px`,
    `${t.portTerpakai} port LAN${t.ppkPenuh > 0 ? ` · ${t.controller} controller × ${t.ppkPenuh} port` : ''}${teksCadangan(t)} · kapasitas ${f(t.pxPort / 1000, 0)} rb px/port, batas ${s.beban}%`,
    `Kabel: ${teksCara(s)}`,
    ...ringkasPort(t).map(b => `- ${b.unit} · ${teksRentang(b)}: ${b.jumlah} RC/port, ${b.px.toLocaleString('id-ID')} px/port (${f(b.beban, 0)}%)`),
    k.tanpaPort.length ? `Belum tersambung: ${k.tanpaPort.length} receiving card` : '',
  ].filter(Boolean).join('\n');
}

export function seksiCetakKoneksi(d: DataKoneksi, s: PengaturanKoneksi): Seksi[] {
  const t = susunKoneksi(d, s), k = t.hasil;
  const ket = `${t.K} × ${t.B} receiving card${t.rc ? ` ${t.rc.nama}` : ''} · ${t.resX} × ${t.resY} px · ${teksCara(s)}${teksCadangan(t)} · label sel = port-urutan, angka kecil = ukuran receiving card (px)${t.cadangan !== 'tidak' ? ', B = kabel cadangan dari ujung rantai' : ''}`;
  const peringatan = [k.galat, k.tanpaPort.length ? `${k.tanpaPort.length} receiving card belum tersambung.` : '', k.lewat.length ? `Port melebihi batas beban: ${k.lewat.join(', ')}.` : '']
    .filter(Boolean).map(x => `<p style="margin:4px 0 0;font-size:11px;color:#b91c1c">${esc(x)}</p>`).join('');
  const { gambar, sisa } = gambarPanelKoneksi(d, t);
  const panel = gambar.map(g => g.svg.replace('<svg ', '<svg style="max-width:100%;height:auto;display:block;margin:0 auto 10px" ')).join('')
    + (sisa > 0 ? `<p style="margin:0;font-size:11px;color:#475569">+${sisa} controller lagi dengan susunan port serupa.</p>` : '');
  return [
    { judul: 'Screen connection (urutan kabel data)', jenis: 'html',
      html: `<div class="diagram">${svgKoneksi(d, t)}<p style="margin:6px 0 0;font-size:11px;color:#475569">${esc(ket)}</p>${peringatan}</div>` },
    ...(gambar.length ? [{ judul: 'Sending box / video controller · port yang dipakai', jenis: 'html' as const,
      html: `<div class="diagram" style="page-break-inside:avoid">${panel}<p style="margin:6px 0 0;font-size:11px;color:#475569">Port LAN berwarna = terpakai, label P1, P2, … sama dengan diagram. Abu-abu = kosong.</p></div>` }] : []),
    { judul: 'Pembagian port LAN (ringkas)', jenis: 'tabel', kepala: ['Kartu / controller', 'Port', 'RC per port', 'Pixel per port', 'Beban'], rataKanan: [2, 3, 4],
      isi: [
        ...ringkasPort(t).map(b => [b.unit, teksRentang(b), String(b.jumlah), b.px.toLocaleString('id-ID'), `${f(b.beban, 0)}%`]),
        ['Total', `${t.portTerpakai} port`, `${k.sel.length} RC`, k.port.reduce((a, p) => a + p.px, 0).toLocaleString('id-ID'), `maks ${f(Math.max(0, ...k.port.map(p => p.beban)), 0)}%`],
      ] },
  ];
}
