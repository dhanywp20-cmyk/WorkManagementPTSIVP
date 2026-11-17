'use client';
import { Angka, f, Kartu, kelasInput, Pilih, Segmen } from '../../bersama/ui';
import { Copy, Monitor, Plus, Trash2 } from 'lucide-react';
import { BULAT } from '../data';
import { MAKS_LAYAR } from '../layar';
import type { AlatLED } from './alat';
import { ModulLayar } from './ModulLayar';

const kelasTombol = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40';

function Pratinjau({ layar }: { layar: { nama: string; lebarM: number; tinggiM: number }[] }) {
  const jarak = 16;
  const totalW = Math.max(0.1, layar.reduce((a, l) => a + l.lebarM, 0));
  const maksH = Math.max(0.1, ...layar.map(l => l.tinggiM));
  const skala = Math.min((340 - jarak * (layar.length - 1)) / totalW, 110 / maksH);
  let x = 4;
  const kotak = layar.map(l => { const r = { ...l, x, w: l.lebarM * skala, h: l.tinggiM * skala }; x += r.w + jarak; return r; });
  const W = x - jarak + 4, H = maksH * skala + 36;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[360px] mx-auto block" role="img" aria-label={`${layar.length} screen berdampingan`}>
      {kotak.map((k, i) => (
        <g key={i}>
          <rect x={k.x} y={6 + maksH * skala - k.h} width={k.w} height={k.h} rx={2} fill="#0f172a" />
          <text x={k.x + k.w / 2} y={maksH * skala + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">{k.nama}</text>
          <text x={k.x + k.w / 2} y={maksH * skala + 30} textAnchor="middle" fontSize="9" fill="#64748b">{f(k.lebarM)}×{f(k.tinggiM)} m</text>
        </g>
      ))}
    </svg>
  );
}

export function KartuMultiLayar({ a }: { a: AlatLED }) {
  const { baris, h, hTotal, hapusLayar, kolom, labelLED, layarLain, layarTurunan, modulCampur, multi, namaLayar, namaUnit, setNamaLayar, tambahLayar, ubahLayar } = a.K;
  const jumlah = layarLain.length + 1;
  const penuh = jumlah >= MAKS_LAYAR;
  return (
    <Kartu judul="Multi screen · 1 video processor"
      aksi={<button type="button" className={kelasTombol} disabled={penuh} onClick={() => tambahLayar()}><Plus size={13} /> Tambah screen</button>}>
      {!multi ? (
        <p className="text-[12.5px] text-slate-600">
          Satu processor (mis. NovaStar seri H / VX) bisa menggerakkan beberapa screen berbeda ukuran. Tambah screen untuk menghitung semuanya
          sekaligus: hardware dipilih dari total piksel & port, dan Screen Connection menampilkan semua screen dalam satu kanvas.
        </p>
      ) : (
        <div className="space-y-3">
          <Pratinjau layar={[{ nama: namaLayar || 'Screen 1', lebarM: h.lebarM, tinggiM: h.tinggiM }, ...layarTurunan.map(x => ({ nama: x.l.nama, lebarM: x.h.lebarM, tinggiM: x.h.tinggiM }))]} />
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <Monitor size={15} className="text-blue-700 shrink-0" />
              <input aria-label="Nama screen 1" value={namaLayar} maxLength={40} onChange={e => setNamaLayar(e.target.value)} className={`${kelasInput} !py-1 font-bold`} />
              <button type="button" className={kelasTombol} title="Duplikat screen ini" disabled={penuh} onClick={() => tambahLayar(0)}><Copy size={13} /></button>
            </div>
            <p className="text-[11.5px] text-slate-600 tabular-nums"><b className="text-slate-800">{labelLED}</b> · {kolom}×{baris} {namaUnit} · {f(h.lebarM)}×{f(h.tinggiM)} m · {h.resX}×{h.resY} px · {h.portLAN} port · modul & ukuran diatur di Spesifikasi</p>
          </div>
          {layarTurunan.map(({ l, kolom: k, baris: b, h: hl, selisih, labelLED: lbl, namaUnit: nu }, j) => {
            const i = j + 1;
            return (
              <div key={l.id} className="rounded-xl border border-slate-200 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Monitor size={15} className="text-slate-500 shrink-0" />
                  <input aria-label={`Nama screen ${i + 1}`} value={l.nama} maxLength={40} onChange={e => ubahLayar(i, { nama: e.target.value })} className={`${kelasInput} !py-1 font-bold`} />
                  <button type="button" className={kelasTombol} title="Duplikat screen ini" disabled={penuh} onClick={() => tambahLayar(i)}><Copy size={13} /></button>
                  <button type="button" className={`${kelasTombol} hover:!bg-rose-50 hover:text-rose-700`} title="Hapus screen ini" onClick={() => hapusLayar(i)}><Trash2 size={13} /></button>
                </div>
                <ModulLayar a={a} label="Modul LED" spek={l.modul} onUbah={modul => ubahLayar(i, { modul })} />
                <Segmen label="Hitung dari" nilai={l.mode} onUbah={v => ubahLayar(i, { mode: v })} opsi={[{ v: 'ukuran', l: 'Ukuran target' }, { v: 'jumlah', l: `Jumlah ${nu}` }]} />
                {l.mode === 'ukuran' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Angka label="Lebar" nilai={l.targetW} onUbah={v => v > 0 && ubahLayar(i, { targetW: v })} satuan="m" />
                    <Angka label="Tinggi" nilai={l.targetH} onUbah={v => v > 0 && ubahLayar(i, { targetH: v })} satuan="m" />
                    <Pilih label="Bulat" nilai={l.bulat} onUbah={v => ubahLayar(i, { bulat: v })} opsi={BULAT.map(x => ({ v: x.v, l: x.l }))} />
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
              </div>
            );
          })}
          <p className="text-[12px] text-slate-700">
            Total <b>{jumlah} screen</b> · {hTotal.jumlahCab} {modulCampur ? 'unit' : namaUnit} · {f(hTotal.totalPx / 1e6, 2)} MP · {hTotal.portLAN} port LAN{modulCampur ? ' · modul berbeda per screen' : ` · semua ${labelLED}`}.
          </p>
        </div>
      )}
    </Kartu>
  );
}
