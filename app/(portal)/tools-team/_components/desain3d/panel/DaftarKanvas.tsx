'use client';
/**
 * Daftar benda mengambang di kanvas (buka / tutup dari bilah kiri, tombol L): klik = pilih (Shift / Ctrl = pilih
 * banyak), klik dua kali = pilih & buka Atur. Mata per kelompok = tampil / sembunyikan. Panel Atur tetap terbuka.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Search, X } from 'lucide-react';
import { type Golongan, golonganDari, LABEL_GOLONGAN, togglePilih } from '../inti';
import type { AlatDesain } from './alat';

export function DaftarKanvas({ a }: { a: AlatDesain }) {
  const { benda, daftarKanvas, pilih, pilihLain, sembunyiGolongan, setDaftarKanvas, setPanel, setPilih, setPilihan, setSembunyiGolongan, setSisi } = a.K;
  const [cari, setCari] = useState('');
  const wadah = useRef<HTMLDivElement>(null);
  const kelompok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const isi = q ? benda.filter(b => b.nama.toLowerCase().includes(q)) : benda;
    return (Object.keys(LABEL_GOLONGAN) as Golongan[]).map(g => ({ g, isi: isi.filter(b => golonganDari(b.jenis) === g) })).filter(x => x.isi.length);
  }, [benda, cari]);
  //  Benda dipilih di kanvas -> barisnya digulir ke tampilan.
  useEffect(() => {
    if (pilih) wadah.current?.querySelector(`[data-id="${CSS.escape(pilih)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [pilih]);
  if (!daftarKanvas) return null;

  const pilihBaris = (id: string, g: Golongan, banyak: boolean) => {
    if (sembunyiGolongan.includes(g)) setSembunyiGolongan(sembunyiGolongan.filter(x => x !== g));
    if (!banyak) { setPilih(id); return; }
    const r = togglePilih(pilih, pilihLain, id);
    setPilihan(r.pilih, r.lain);
  };
  return (
    <div ref={wadah} className="kontrol-kanvas absolute right-2 top-12 z-10 w-56 sm:w-60 max-h-[60%] flex flex-col rounded-xl bg-white/95 border border-slate-200 shadow-lg"
      role="region" aria-label="Daftar benda">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100">
        <Search size={13} className="text-slate-400 shrink-0" />
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder={`Cari (${benda.length})`} aria-label="Cari benda"
          className="flex-1 min-w-0 bg-transparent text-base sm:text-[12.5px] outline-none" />
        <button type="button" onClick={() => setDaftarKanvas(false)} aria-label="Tutup daftar (L)" title="Tutup (L)" className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={14} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {kelompok.map(({ g, isi }) => {
          const sembunyi = sembunyiGolongan.includes(g);
          return (
            <div key={g}>
              <div className="flex items-center justify-between px-2.5 pt-1.5 pb-0.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{LABEL_GOLONGAN[g]} · {isi.length}</span>
                <button type="button" title={sembunyi ? 'Tampilkan kelompok' : 'Sembunyikan kelompok'} aria-pressed={sembunyi}
                  onClick={() => setSembunyiGolongan(sembunyi ? sembunyiGolongan.filter(x => x !== g) : [...sembunyiGolongan, g])}
                  className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100">{sembunyi ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              </div>
              {isi.map(b => {
                const aktif = b.id === pilih, ikut = pilihLain.includes(b.id);
                return (
                  <button key={b.id} type="button" data-id={b.id} title="Klik dua kali = Atur"
                    onClick={e => pilihBaris(b.id, g, e.shiftKey || e.ctrlKey || e.metaKey)}
                    onDoubleClick={() => { pilihBaris(b.id, g, false); setSisi(null); setPanel(true); }}
                    className={`w-full flex items-center gap-1.5 px-2.5 py-1 text-left text-[12.5px] ${aktif ? 'bg-blue-600 text-white font-semibold' : ikut ? 'bg-blue-50 text-blue-800' : sembunyi ? 'text-slate-400 hover:bg-slate-50' : 'text-slate-800 hover:bg-slate-50'}`}>
                    <span className="truncate flex-1">{b.nama}</span>
                    {b.terkunci && <Lock size={11} className="shrink-0 opacity-70" />}
                  </button>
                );
              })}
            </div>
          );
        })}
        {!kelompok.length && <p className="px-3 py-2 text-[12px] text-slate-500">{cari ? 'Tidak ada yang cocok' : 'Belum ada benda'}</p>}
      </div>
    </div>
  );
}
