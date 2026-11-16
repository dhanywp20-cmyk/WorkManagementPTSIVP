'use client';
import { createContext, type Dispatch, type ReactNode, type SetStateAction, useCallback, useContext, useMemo, useState } from 'react';
import { getSession } from '@/lib/auth/sesi';
import { isPimpinan } from '@/lib/pimpinan';
import type { AlatFile } from '@/lib/tools-file';
import { adapterTim } from './tipe';
import { useBerkas } from './useBerkas';
import { BilahFile } from './BilahFile';
import { DialogBerkas } from './DialogBerkas';

type Nilai = Record<string, unknown>;
const HAPUS = Symbol('hapus');
type Ubah = (kunci: string, f: (lama: unknown) => unknown) => void;
const Konteks = createContext<{ nilai: Nilai; ubah: Ubah } | null>(null);

const cocok = (v: unknown, awal: unknown) =>
  awal === null || awal === undefined || (v !== null && typeof v === typeof awal && Array.isArray(v) === Array.isArray(awal));

export function useIsi<T>(kunci: string, awal: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const k = useContext(Konteks);
  const [lokal, setLokal] = useState<T>(awal);
  const [awalTetap] = useState<T>(lokal);
  const ubah = k?.ubah;
  const set = useCallback((x: SetStateAction<T>) => {
    if (!ubah) { setLokal(x); return; }
    ubah(kunci, lama => {
      const kini = (lama !== undefined && cocok(lama, awalTetap) ? lama : awalTetap) as T;
      const baru = typeof x === 'function' ? (x as (p: T) => T)(kini) : x;
      return JSON.stringify(baru) === JSON.stringify(awalTetap) ? HAPUS : baru;
    });
  }, [ubah, kunci, awalTetap]);
  if (!k) return [lokal, setLokal];
  const v = k.nilai[kunci];
  return [(v !== undefined && cocok(v, awalTetap) ? v : awalTetap) as T, set];
}

const tanggal = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export function RuangBerkas({ alat, jenis, children }: { alat: AlatFile; jenis: string; children: ReactNode }) {
  const [nilai, setNilai] = useState<Nilai>({});
  const [hanyaLihat] = useState(() => isPimpinan(getSession()));
  const ubah = useCallback<Ubah>((kunci, f) => setNilai(n => {
    const v = f(n[kunci]);
    if (v === HAPUS) { if (!(kunci in n)) return n; const sisa = { ...n }; delete sisa[kunci]; return sisa; }
    return { ...n, [kunci]: v };
  }), []);
  const data = useMemo(() => Object.fromEntries(Object.entries(nilai).sort(([a], [b]) => a.localeCompare(b))), [nilai]);
  const adapter = useMemo(() => adapterTim(alat, `berkas ${jenis}`), [alat, jenis]);
  const b = useBerkas({
    adapter, data, hanyaLihat, namaAwal: () => `${jenis} ${tanggal()}`, kosongkan: () => setNilai({}),
    terapkan: d => { if (!d || typeof d !== 'object' || Array.isArray(d)) return false; setNilai(d as Nilai); return true; },
  });
  const ctx = useMemo(() => ({ nilai, ubah }), [nilai, ubah]);
  return (
    <Konteks.Provider value={ctx}>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white border border-slate-200 px-3 py-2 print:hidden">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Berkas</span>
        <BilahFile b={b} />
      </div>
      <DialogBerkas b={b} />
      {children}
    </Konteks.Provider>
  );
}
