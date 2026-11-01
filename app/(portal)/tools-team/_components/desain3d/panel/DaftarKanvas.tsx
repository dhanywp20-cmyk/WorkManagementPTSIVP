'use client';
/**
 * Daftar benda - SATU-SATUNYA daftar (tombol Benda di bilah atas, atau L), mengambang di kanan-atas kanvas: klik = pilih
 * (Shift / Ctrl = pilih banyak), klik dua kali = pilih & buka Atur. Mata per kelompok & per benda = tampil / sembunyikan,
 * "Hanya" = isolasi satu kelompok, Pusatkan isi di kaki daftar. Dulu tersebar: panel daftar samping, ikon daftar,
 * Kelompok & Pusatkan di rel kiri.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignCenterVertical, ChevronDown, Eye, EyeOff, Lock, Search, X } from 'lucide-react';
import { type Golongan, golonganDari, kunciSembunyi, LABEL_GOLONGAN, togglePilih } from '../inti';
import { itemMenu, menuMelayang } from './gaya';
import type { AlatDesain } from './alat';

export function DaftarKanvas({ a }: { a: AlatDesain }) {
  const { benda, daftarKanvas, hanyaLihat, menuPusat, pilih, pilihLain, sembunyiGolongan, setDaftarKanvas, setMenuPusat, setPanel, setPilih, setPilihan, setSembunyiGolongan, setSisi } = a.K;
  const { pusatkan } = a.aksi;
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
  //  Kelompok yang ada di desain (tanpa saringan cari) - untuk isolasi.
  const semuaGolongan = (Object.keys(LABEL_GOLONGAN) as Golongan[]).filter(g => benda.some(b => golonganDari(b.jenis) === g));

  const pilihBaris = (id: string, g: Golongan, banyak: boolean) => {
    if (sembunyiGolongan.includes(g) || sembunyiGolongan.includes(kunciSembunyi(id))) setSembunyiGolongan(sembunyiGolongan.filter(x => x !== g && x !== kunciSembunyi(id)));
    if (!banyak) { setPilih(id); return; }
    const r = togglePilih(pilih, pilihLain, id);
    setPilihan(r.pilih, r.lain);
  };
  return (
    //  Benda terpilih: turun di bawah bilah benda terpilih (tengah-atas) - saat panel Atur terbuka kanvas menyempit dan
    //  ujung bilah itu dulu tertutup daftar ini.
    <div ref={wadah} className={`kontrol-kanvas absolute right-2 ${pilih ? 'top-14 max-h-[calc(100%-7.5rem)]' : 'top-2 max-h-[60%]'} z-10 w-56 sm:w-60 flex flex-col rounded-xl bg-white/95 border border-slate-200 shadow-lg`}
      role="region" aria-label="Daftar benda">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100">
        <Search size={13} className="text-slate-400 shrink-0" />
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder={`Cari (${benda.length})`} aria-label="Cari benda"
          className="flex-1 min-w-0 bg-transparent text-base sm:text-[12.5px] outline-none" />
        <button type="button" onClick={() => setDaftarKanvas(false)} aria-label="Tutup daftar (L)" title="Tutup (L)" className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={14} /></button>
      </div>
      {sembunyiGolongan.length > 0 && (
        <button type="button" onClick={() => setSembunyiGolongan([])}
          className="flex items-center justify-between gap-2 px-2.5 py-1 border-b border-slate-100 bg-amber-50 text-[11.5px] font-semibold text-amber-900 hover:bg-amber-100">
          <span className="inline-flex items-center gap-1"><EyeOff size={12} /> {sembunyiGolongan.length} disembunyikan</span>
          <span className="text-blue-700">Tampilkan semua</span>
        </button>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {kelompok.map(({ g, isi }) => {
          const sembunyi = sembunyiGolongan.includes(g);
          return (
            <div key={g}>
              <div className="flex items-center justify-between px-2.5 pt-1.5 pb-0.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{LABEL_GOLONGAN[g]} · {isi.length}</span>
                <span className="flex-1" />
                {semuaGolongan.length > 1 && (
                  <button type="button" onClick={() => setSembunyiGolongan(semuaGolongan.filter(x => x !== g))} title={`Isolasi: tampilkan hanya ${LABEL_GOLONGAN[g]}`}
                    className="px-1.5 h-6 rounded-md text-[10.5px] font-semibold text-blue-700 hover:bg-blue-50">Hanya</button>
                )}
                <button type="button" title={sembunyi ? 'Tampilkan kelompok' : 'Sembunyikan kelompok'} aria-pressed={sembunyi}
                  onClick={() => setSembunyiGolongan(sembunyi ? sembunyiGolongan.filter(x => x !== g) : [...sembunyiGolongan, g])}
                  className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-slate-100">{sembunyi ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              </div>
              {isi.map(b => {
                const aktif = b.id === pilih, ikut = pilihLain.includes(b.id);
                const kunci = kunciSembunyi(b.id), sendiri = sembunyiGolongan.includes(kunci);
                const redup = sembunyi || sendiri;
                const ubahMata = () => {
                  //  Benda yang disembunyikan dilepas dari pilihan (gizmo tidak menempel di benda tak terlihat).
                  if (!sendiri && (aktif || ikut)) setPilihan(aktif ? null : pilih, aktif ? [] : pilihLain.filter(x => x !== b.id));
                  setSembunyiGolongan(sendiri ? sembunyiGolongan.filter(x => x !== kunci) : [...sembunyiGolongan, kunci]);
                };
                return (
                  <div key={b.id} data-id={b.id} className={`group flex items-center ${aktif ? 'bg-blue-600 text-white font-semibold' : ikut ? 'bg-blue-50 text-blue-800' : redup ? 'text-slate-400 hover:bg-slate-50' : 'text-slate-800 hover:bg-slate-50'}`}>
                    <button type="button" title="Klik dua kali = Atur"
                      onClick={e => pilihBaris(b.id, g, e.shiftKey || e.ctrlKey || e.metaKey)}
                      onDoubleClick={() => { pilihBaris(b.id, g, false); setSisi(null); setPanel(true); }}
                      className="flex-1 min-w-0 flex items-center gap-1.5 pl-2.5 py-1 text-left text-[12.5px]">
                      <span className="truncate flex-1">{b.nama}</span>
                      {b.terkunci && <Lock size={11} className="shrink-0 opacity-70" />}
                    </button>
                    <button type="button" onClick={ubahMata} title={sendiri ? 'Tampilkan' : 'Sembunyikan'} aria-label={sendiri ? `Tampilkan ${b.nama}` : `Sembunyikan ${b.nama}`} aria-pressed={sendiri}
                      className={`w-7 h-6 shrink-0 grid place-items-center rounded-md ${sendiri ? 'opacity-100' : 'opacity-40 sm:opacity-0 sm:group-hover:opacity-70 focus:opacity-100'}`}>
                      {sendiri ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
        {!kelompok.length && <p className="px-3 py-2 text-[12px] text-slate-500">{cari ? 'Tidak ada yang cocok' : 'Belum ada benda'}</p>}
      </div>
      {!hanyaLihat && benda.length > 0 && (
        <div className="relative border-t border-slate-100 p-1">
          <button type="button" onClick={() => setMenuPusat(v => !v)} aria-expanded={menuPusat} title="Geser semua benda ke tengah ruang"
            className="w-full inline-flex items-center justify-center gap-1.5 h-7 rounded-lg text-[12px] font-semibold text-slate-700 hover:bg-slate-100">
            <AlignCenterVertical size={14} /> Pusatkan isi <ChevronDown size={12} className={menuPusat ? 'rotate-180' : ''} />
          </button>
          {menuPusat && (
            <div className={`absolute right-0 bottom-full mb-1 w-64 ${menuMelayang}`}>
              {([['xz', 'Tengah ruang', 'Kiri-kanan & depan-belakang'], ['x', 'Kiri-kanan saja', 'Jarak ke layar tidak berubah'], ['z', 'Depan-belakang saja', 'Posisi kiri-kanan tetap']] as const).map(([v, l, k]) => (
                <button key={v} type="button" onClick={() => { pusatkan(v); setMenuPusat(false); }} className={itemMenu}>
                  <span className="block text-[13px] font-semibold text-slate-900">{l}</span>
                  <span className="block text-[11.5px] text-slate-500">{k}</span>
                </button>
              ))}
              <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500 border-t border-slate-100 mt-1">
                Meja-kursi jadi patokan tengah. Benda yang menempel dinding tetap di dindingnya; proyektor ikut layarnya.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
