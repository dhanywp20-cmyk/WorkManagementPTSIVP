'use client';
import type React from 'react';
import { createContext, useContext, useState } from 'react';
import { Aperture, Cable, Move3d, Package, Palette } from 'lucide-react';

export type TabAtur = 'produk' | 'posisi' | 'lensa' | 'tampilan' | 'kabel';

const DAFTAR: [TabAtur, string, typeof Package, string][] = [
  ['produk', 'Produk', Package, 'Nama, isi dari Pustaka, model & spesifikasi, simpan ke Produk saya'],
  ['posisi', 'Posisi', Move3d, 'Ukuran produk, posisi, tinggi & putar'],
  ['lensa', 'Lensa', Aperture, 'Zoom lensa, lens shift, resolusi & rasio, hasil proyeksi'],
  ['tampilan', 'Tampilan', Palette, 'Warna, label, konten layar'],
  ['kabel', 'Kabel', Cable, 'Kabel ke rack'],
];
const KUNCI = 'wm_desain3d_tab_atur';

const Aktif = createContext<TabAtur | null>(null);

export function Bagian({ tab, children }: { tab: TabAtur; children: React.ReactNode }) {
  const aktif = useContext(Aktif);
  return aktif === null || aktif === tab ? <>{children}</> : null;
}

export function useTabAtur(tersedia: TabAtur[]) {
  const [pilih, setPilihState] = useState<TabAtur>(() => {
    try { const t = localStorage.getItem(KUNCI); return DAFTAR.some(x => x[0] === t) ? (t as TabAtur) : 'produk'; } catch { return 'produk'; }
  });
  const tab = tersedia.includes(pilih) ? pilih : 'produk';
  const setTab = (t: TabAtur) => { setPilihState(t); try { localStorage.setItem(KUNCI, t); } catch { return; } };
  return { tab, setTab, tersedia };
}

export function BilahTabAtur({ tab, setTab, tersedia }: { tab: TabAtur; setTab: (t: TabAtur) => void; tersedia: TabAtur[] }) {
  const isi = DAFTAR.filter(x => tersedia.includes(x[0]));
  return (
    <div className="grid gap-0.5 rounded-xl bg-slate-100 p-0.5" style={{ gridTemplateColumns: `repeat(${isi.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Kelompok pengaturan benda">
      {isi.map(([t, l, Ikon, ket]) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} title={ket} onClick={() => setTab(t)}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10.5px] font-bold leading-tight transition-colors duration-150 ${
            tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          <Ikon size={15} aria-hidden="true" /> {l}
        </button>
      ))}
    </div>
  );
}

export function PenyediaTab({ tab, children }: { tab: TabAtur; children: React.ReactNode }) {
  return <Aktif.Provider value={tab}>{children}</Aktif.Provider>;
}
