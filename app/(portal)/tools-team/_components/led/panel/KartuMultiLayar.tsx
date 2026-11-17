'use client';
import { Angka, f, kelasInput, Pilih, Segmen } from '../../bersama/ui';
import { Copy, Monitor, Plus, Trash2 } from 'lucide-react';
import { BULAT } from '../data';
import { MAKS_LAYAR } from '../layar';
import type { AlatLED } from './alat';
import { ModulLayar } from './ModulLayar';

const kelasTombol = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40';

export function TabLayar({ a, aktif, onPilih }: { a: AlatLED; aktif: number; onPilih: (i: number) => void }) {
  const { layarLain, namaLayar, tambahLayar } = a.K;
  const nama = [namaLayar || 'Screen 1', ...layarLain.map(l => l.nama || 'Screen')];
  const penuh = nama.length >= MAKS_LAYAR;
  return (
    <div role="tablist" aria-label="Screen" className="flex flex-wrap items-center gap-1">
      {nama.length > 1 && nama.map((n, i) => (
        <button key={i} type="button" role="tab" aria-selected={i === aktif} onClick={() => onPilih(i)}
          className={`max-w-[9rem] truncate px-2 py-0.5 rounded-md text-[11.5px] font-bold border ${i === aktif ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{n}</button>
      ))}
      <button type="button" disabled={penuh} title={penuh ? `Maksimal ${MAKS_LAYAR} screen` : 'Tambah screen (1 video processor)'} onClick={() => { tambahLayar(); onPilih(nama.length); }}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11.5px] font-bold border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40">
        <Plus size={12} />{nama.length > 1 ? '' : ' Screen'}
      </button>
    </div>
  );
}

export function KepalaLayar({ a, i, onPilih }: { a: AlatLED; i: number; onPilih: (i: number) => void }) {
  const { hapusLayar, layarLain, namaLayar, setNamaLayar, tambahLayar, ubahLayar } = a.K;
  const penuh = layarLain.length + 1 >= MAKS_LAYAR;
  const nama = i === 0 ? namaLayar : layarLain[i - 1]?.nama ?? '';
  return (
    <div className="flex items-center gap-2">
      <Monitor size={15} className="text-blue-700 shrink-0" />
      <input aria-label={`Nama screen ${i + 1}`} value={nama} maxLength={40} onChange={e => (i === 0 ? setNamaLayar(e.target.value) : ubahLayar(i, { nama: e.target.value }))} className={`${kelasInput} !py-1 font-bold`} />
      <button type="button" className={kelasTombol} title="Duplikat screen ini" disabled={penuh} onClick={() => { tambahLayar(i); onPilih(layarLain.length + 1); }}><Copy size={13} /></button>
      {i > 0 && (
        <button type="button" className={`${kelasTombol} hover:!bg-rose-50 hover:text-rose-700`} title="Hapus screen ini" onClick={() => { hapusLayar(i); onPilih(i - 1); }}><Trash2 size={13} /></button>
      )}
    </div>
  );
}

export function EditorLayar({ a, i }: { a: AlatLED; i: number }) {
  const { layarTurunan, ubahLayar } = a.K;
  const x = layarTurunan[i - 1];
  if (!x) return null;
  const { l, kolom: k, baris: b, h: hl, selisih, labelLED: lbl, namaUnit: nu } = x;
  return (
    <div className="space-y-3">
      <ModulLayar a={a} label="Modul LED" spek={l.modul} onUbah={modul => ubahLayar(i, { modul })} />
      <Segmen label="Hitung dari" nilai={l.mode} onUbah={v => ubahLayar(i, { mode: v })} opsi={[{ v: 'ukuran', l: 'Ukuran target' }, { v: 'jumlah', l: `Jumlah ${nu}` }]} />
      {l.mode === 'ukuran' ? (
        <div className="grid grid-cols-3 gap-2">
          <Angka label="Lebar" nilai={l.targetW} onUbah={v => v > 0 && ubahLayar(i, { targetW: v })} satuan="m" />
          <Angka label="Tinggi" nilai={l.targetH} onUbah={v => v > 0 && ubahLayar(i, { targetH: v })} satuan="m" />
          <Pilih label="Bulat" nilai={l.bulat} onUbah={v => ubahLayar(i, { bulat: v })} opsi={BULAT.map(o => ({ v: o.v, l: o.l }))} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Angka label="Kolom" nilai={l.kolomIn} step={1} onUbah={v => v >= 1 && ubahLayar(i, { kolomIn: Math.round(v) })} />
          <Angka label="Baris" nilai={l.barisIn} step={1} onUbah={v => v >= 1 && ubahLayar(i, { barisIn: Math.round(v) })} />
        </div>
      )}
      <p className="text-[11.5px] text-slate-600 tabular-nums">
        <b className="text-slate-800">{lbl}</b> · {k}×{b} {nu} · {f(hl.lebarM)}×{f(hl.tinggiM)} m · {hl.resX}×{hl.resY} px · {hl.portLAN} port
        {(Math.abs(selisih.w) > 0.001 || Math.abs(selisih.h) > 0.001) && <span className="text-amber-700"> · selisih {selisih.w >= 0 ? '+' : ''}{f(selisih.w * 100, 0)} / {selisih.h >= 0 ? '+' : ''}{f(selisih.h * 100, 0)} cm</span>}
      </p>
      <p className="text-[11.5px] text-slate-500">Refresh, bit depth, tegangan & PF mengikuti {a.K.namaLayar || 'Screen 1'} (1 video processor).</p>
    </div>
  );
}

function Pratinjau({ layar, aktif, onPilih }: { layar: { nama: string; lebarM: number; tinggiM: number }[]; aktif: number; onPilih: (i: number) => void }) {
  const jarak = 16;
  const totalW = Math.max(0.1, layar.reduce((s, l) => s + l.lebarM, 0));
  const maksH = Math.max(0.1, ...layar.map(l => l.tinggiM));
  const skala = Math.min((340 - jarak * (layar.length - 1)) / totalW, 90 / maksH);
  let x = 4;
  const kotak = layar.map(l => { const r = { ...l, x, w: l.lebarM * skala, h: l.tinggiM * skala }; x += r.w + jarak; return r; });
  const W = x - jarak + 4, H = maksH * skala + 36;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[360px] mx-auto block" role="img" aria-label={`${layar.length} screen berdampingan`}>
      {kotak.map((k, i) => (
        <g key={i} onClick={() => onPilih(i)} className="cursor-pointer">
          <rect x={k.x} y={6 + maksH * skala - k.h} width={k.w} height={k.h} rx={2} fill="#0f172a" stroke={i === aktif ? '#2563eb' : 'none'} strokeWidth={3} />
          <text x={k.x + k.w / 2} y={maksH * skala + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill={i === aktif ? '#1d4ed8' : '#334155'}>{k.nama}</text>
          <text x={k.x + k.w / 2} y={maksH * skala + 30} textAnchor="middle" fontSize="9" fill="#64748b">{f(k.lebarM)}×{f(k.tinggiM)} m</text>
        </g>
      ))}
    </svg>
  );
}

export function RingkasanMulti({ a, aktif, onPilih }: { a: AlatLED; aktif: number; onPilih: (i: number) => void }) {
  const { h, hTotal, labelLED, layarLain, layarTurunan, modulCampur, namaLayar, namaUnit } = a.K;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 space-y-2">
      <Pratinjau aktif={aktif} onPilih={onPilih}
        layar={[{ nama: namaLayar || 'Screen 1', lebarM: h.lebarM, tinggiM: h.tinggiM }, ...layarTurunan.map(x => ({ nama: x.l.nama, lebarM: x.h.lebarM, tinggiM: x.h.tinggiM }))]} />
      <p className="text-[12px] text-slate-700">
        Total <b>{layarLain.length + 1} screen · 1 video processor</b> · {hTotal.jumlahCab} {modulCampur ? 'unit' : namaUnit} · {f(hTotal.totalPx / 1e6, 2)} MP · {hTotal.portLAN} port LAN{modulCampur ? ' · modul berbeda per screen' : ` · semua ${labelLED}`}.
      </p>
    </div>
  );
}
