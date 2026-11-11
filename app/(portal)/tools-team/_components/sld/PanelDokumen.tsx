'use client';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { MAKS_CATATAN, type BlokJudul, type CatatanPasang } from '@/lib/sld/tipe';
import { LABEL_GARIS, LABEL_PERANGKAT } from '@/lib/sld/gaya';
import { IsianHurufLabel } from './IsianHuruf';
import { Area, kelasTombol, Teks } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

const BIDANG: { k: keyof BlokJudul; l: string; ph?: string; lebar?: boolean }[] = [
  { k: 'proyek', l: 'Judul proyek', ph: 'Voice Control Kamar Pasien', lebar: true },
  { k: 'lokasi', l: 'Lokasi / klien', ph: 'Nama gedung / klien' },
  { k: 'sistem', l: 'Sistem', ph: 'CUE Voice (jalur OFFLINE)' },
  { k: 'ringkas', l: 'Proyek (blok judul sheet 2)', ph: 'Kontrol suara kamar pasien: lampu, TV, AC', lebar: true },
  { k: 'lingkup', l: 'Lingkup', ph: '1 kamar · ...', lebar: true },
  { k: 'acuan', l: 'Acuan (nama berkas BOM)', ph: 'BOM ... Rev3.xlsx', lebar: true },
  { k: 'acuanSingkat', l: 'Acuan singkat (judul tabel)', ph: 'BOM Rev3' },
  { k: 'nomor', l: 'Drawing No.', ph: 'CV-SLD-01' },
  { k: 'rev', l: 'Rev.', ph: 'A' },
  { k: 'tanggal', l: 'Date', ph: '11 Nov 2026' },
  { k: 'skala', l: 'Scale', ph: 'NTS' },
  { k: 'dibuat', l: 'Drawn by' },
  { k: 'diperiksa', l: 'Checked by' },
  { k: 'disetujui', l: 'Approved by' },
];

export function PanelDokumen({ a }: { a: KeadaanSLD }) {
  const b = a.dok.blok;
  const ubahCatatan = (catatan: CatatanPasang[]) => a.setDok(d => ({ ...d, catatan }));
  const c = a.dok.catatan;
  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= c.length) return;
    const baru = [...c];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    ubahCatatan(baru);
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {BIDANG.map(f => (
          <Teks key={f.k} label={f.l} nilai={b[f.k]} placeholder={f.ph} onUbah={v => a.ubahBlok({ [f.k]: v })} className={f.lebar ? 'col-span-2' : ''} />
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 p-2.5 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Ukuran huruf semua label</p>
        <IsianHurufLabel label="Label perangkat (baris #nama)" dasarMm={LABEL_PERANGKAT.nama.ukuran} faktor={a.dok.huruf?.perangkat}
          onUbah={f => a.aturHurufDok('perangkat', f)} bantuan="Berlaku untuk perangkat yang ukuran hurufnya belum diatur sendiri." />
        <IsianHurufLabel label="Label kabel (K1, K2, ...)" dasarMm={LABEL_GARIS.ukuran} faktor={a.dok.huruf?.kabel} onUbah={f => a.aturHurufDok('kabel', f)} />
      </div>
      <Area label="Catatan revisi (kiri bawah sheet 2)" nilai={b.catatanRev} onUbah={v => a.ubahBlok({ catatanRev: v })} baris={3}
        placeholder="Rev B: disesuaikan dengan BOM Rev3..." />
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Catatan pemasangan</p>
        {c.map((x, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-slate-700 w-5">{i + 1}.</span>
              <input value={x.judul} onChange={e => ubahCatatan(c.map((y, j) => (j === i ? { ...y, judul: e.target.value } : y)))} placeholder="Judul (tebal)"
                aria-label={`Judul catatan ${i + 1}`} className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-[13px] font-semibold" />
              <button type="button" className={kelasTombol} onClick={() => geser(i, -1)} disabled={i === 0} aria-label="Naikkan"><ArrowUp size={14} /></button>
              <button type="button" className={kelasTombol} onClick={() => geser(i, 1)} disabled={i === c.length - 1} aria-label="Turunkan"><ArrowDown size={14} /></button>
              <button type="button" className={`${kelasTombol} text-rose-700`} onClick={() => ubahCatatan(c.filter((_, j) => j !== i))} aria-label="Hapus catatan"><Trash2 size={14} /></button>
            </div>
            <textarea value={x.isi} onChange={e => ubahCatatan(c.map((y, j) => (j === i ? { ...y, isi: e.target.value } : y)))} rows={2}
              aria-label={`Isi catatan ${i + 1}`} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[13px] resize-y" />
          </div>
        ))}
        {c.length < MAKS_CATATAN && (
          <button type="button" className={`${kelasTombol} w-full`} onClick={() => ubahCatatan([...c, { judul: '', isi: '' }])}><Plus size={15} /> Tambah catatan</button>
        )}
      </div>
    </div>
  );
}
