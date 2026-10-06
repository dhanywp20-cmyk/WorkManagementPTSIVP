'use client';
/** Komponen kecil Kalkulator LED: isian teks, tombol referensi, bar pemakaian, kartu hardware. */
import { f, kelasInput } from '../../bersama/ui';
import { Ikon } from '@/components/shared/Ikon';
import { type Hardware, kapasitasHardware } from '@/lib/av-hitung';

export function Teks({ label, nilai, onUbah, tipe = 'text' }: { label: string; nilai: string; onUbah: (v: string) => void; tipe?: string }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <input type={tipe} value={nilai} onChange={e => onUbah(e.target.value)} className={kelasInput} />
    </label>
  );
}

export function TombolRef({ onKlik, diubah }: { onKlik: () => void; diubah: boolean }) {
  return (
    <button type="button" onClick={onKlik} title="Referensi modul & hardware"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 print:hidden">
      <Ikon nama="⚙" ukuran={14} /> Referensi{diubah && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="diubah" />}
    </button>
  );
}

/** Bilah pemakaian kapasitas (pixel / port). */
export function Pakai({ label, persen }: { label: string; persen: number }) {
  const p = Math.min(100, Math.max(0, persen));
  const warna = persen > 100 ? 'bg-rose-600' : persen > 85 ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div>
      <div className="flex justify-between text-[11.5px] text-slate-600"><span>{label}</span><span className="tabular-nums font-semibold text-slate-800">{f(persen, 0)}%</span></div>
      <div className="h-1.5 rounded-full bg-slate-200 mt-0.5 overflow-hidden"><div className={`h-full rounded-full ${warna}`} style={{ width: `${p}%` }} /></div>
    </div>
  );
}

export function KartuHw({ peran, hw, totalPx, portLAN, nada, catatan }: { peran: string; hw: Hardware; totalPx: number; portLAN: number; nada: 'hijau' | 'abu'; catatan?: string }) {
  const k = kapasitasHardware(hw, totalPx, portLAN);
  return (
    <div className={`rounded-xl border p-3 ${nada === 'hijau' ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${nada === 'hijau' ? 'text-emerald-800' : 'text-slate-600'}`}>{peran}</p>
      <p className="text-lg font-extrabold text-slate-900 mt-0.5">{k.qty > 1 ? `${k.qty}× ` : ''}{hw.nama}</p>
      <p className="text-[12px] text-slate-600">{f(hw.maksPx / 1e6, 2)} MP · {hw.port > 0 ? `${hw.port} port` : 'tanpa port LAN'}{hw.ket ? ` · ${hw.ket}` : ''}</p>
      <div className="mt-2 space-y-1.5">
        <Pakai label="Pemakaian pixel" persen={k.pakaiPx} />
        {hw.port > 0 && <Pakai label="Pemakaian port" persen={k.pakaiPort} />}
      </div>
      {k.pembatas && <p className="text-[12px] text-amber-800 mt-1.5">Butuh {k.qty} unit karena {k.pembatas === 'port' ? 'jumlah port LAN' : 'kapasitas pixel'}.</p>}
      {catatan && <p className={`text-[12px] mt-1.5 ${nada === 'hijau' ? 'text-emerald-800' : 'text-slate-600'}`}>{catatan}</p>}
    </div>
  );
}
