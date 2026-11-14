'use client';
import { useEffect, useState } from 'react';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical,
  Copy, CopyPlus, Crosshair, EyeOff, Grid2x2Plus, LayoutGrid, Lock, LockOpen, Move, Move3d, PanelTop, Rotate3d, Ruler, SlidersHorizontal,
  StretchHorizontal, StretchVertical, Trash2,
} from 'lucide-react';
import { BISA_TEMPEL, duplikatBanyak, kunciSembunyi, larik, MAKS_LARIK, ratakan, ruangDari, sebar } from '../inti';
import type { Sisi } from '../mesin/tipe';
import { GarisMenu, ItemMenu, JudulMenu, kelasIkon, kelasIkonAktif, Menu, TombolIkon, useTutupMenu } from '../../bersama/MenuBilah';
import { GeserCepat } from './GeserCepat';
import { GeserTepat } from './GeserTepat';
import type { AlatDesain } from './alat';

const ikonKecil = 'grid place-items-center h-7 w-7 rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:hover:bg-transparent';
const isian = 'w-full h-7 rounded-md border border-slate-200 px-2 text-base sm:text-[12.5px] tabular-nums focus:border-blue-400 focus:outline-hidden';

function TempelDinding({ onTempel }: { onTempel: (s: Sisi) => void }) {
  const tutup = useTutupMenu();
  return (
    <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-slate-100 p-0.5 mx-2.5 mb-1.5">
      {(['depan', 'belakang', 'kiri', 'kanan'] as Sisi[]).map(s => (
        <button key={s} type="button" onClick={() => { onTempel(s); tutup(); }}
          className="rounded-md py-1 text-[12px] font-bold capitalize text-slate-600 hover:bg-white hover:text-blue-700 hover:shadow-sm">{s}</button>
      ))}
    </div>
  );
}

export function AksiTerpilih({ a }: { a: AlatDesain }) {
  const { alatKanvas, batas, benda, duaRuang, hanyaLihat, kotakRuang, modeGizmo, panel, pilihLain, ruang, sembunyiGolongan, setSembunyiGolongan,
    setBenda, setModeGizmo, setPanel, setPesan, setPilih, setPilihan, setSisi, terpilih } = a.K;
  const { duplikat, salinKeRuangLain, tempel } = a.aksi;
  const [geser, setGeser] = useState<{ id: string; teks: string } | null>(null);
  const [larikBuka, setLarikBuka] = useState(false);
  const [isiLarik, setIsiLarik] = useState({ kolom: '4', baris: '2', jx: '900', jz: '1200' });
  const geserAktif = geser && geser.id === terpilih?.id ? geser : null;
  const kunci = !!terpilih?.terkunci;
  const bisaGeser = alatKanvas === 'pilih' && !kunci;

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!terpilih || kunci || geserAktif || hanyaLihat || alatKanvas !== 'pilih' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role=dialog]')) return;
      if (/^[0-9-]$/.test(e.key)) { e.preventDefault(); setGeser({ id: terpilih.id, teks: e.key }); }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [terpilih, kunci, geserAktif, hanyaLihat, alatKanvas]);

  if (!terpilih) return <span className="hidden md:inline px-2 text-[12px] text-slate-500">Klik benda untuk mengatur</span>;
  const ids = [terpilih.id, ...pilihLain];
  const banyak = pilihLain.length > 0;
  const ruangLain = (ruangDari(ruang, terpilih.x) + 1) % kotakRuang.length + 1;
  const rata = (f: (bs: typeof benda) => typeof benda) => setBenda(f);
  const buatLarik = () => {
    const n = (v: string) => Number(v.replace(',', '.'));
    const salinan = larik(terpilih, n(isiLarik.kolom), n(isiLarik.baris), n(isiLarik.jx) / 1000, n(isiLarik.jz) / 1000, batas);
    if (!salinan.length) { setPesan('Tidak ada salinan yang muat di dalam ruangan - periksa jarak & arah.'); return; }
    setBenda(bs => [...bs, ...salinan]);
    setPilihan(terpilih.id, salinan.map(b => b.id));
    setLarikBuka(false);
    setPesan(`${salinan.length} salinan "${terpilih.nama}" dibuat - semuanya terpilih, bisa digeser bersama.`);
  };
  const jumlahLarik = Math.max(0, Math.min(MAKS_LARIK, (Number(isiLarik.kolom) || 1) * (Number(isiLarik.baris) || 1) - 1));
  const namaPilihan = banyak ? `${ids.length} benda` : terpilih.nama;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={`Aksi ${namaPilihan}`}>
      <button type="button" onClick={() => { setSisi(null); setPanel(p => !p); }} aria-pressed={panel} title={`Atur ${namaPilihan}: ukuran, posisi & pilihan`}
        className={`${kelasIkon} max-w-[180px] ${panel ? kelasIkonAktif : ''}`}>
        <SlidersHorizontal size={16} className="shrink-0" /><span className="truncate">{namaPilihan}</span>
        {kunci && <Lock size={12} className="shrink-0 text-amber-600" aria-label="terkunci" />}
      </button>
      <div className="flex rounded-lg bg-slate-100 p-0.5 mx-0.5" role="radiogroup" aria-label="Gizmo geser atau putar (R)">
        {([['translate', 'Geser dengan gizmo (R)', Move3d], ['rotate', 'Putar dengan gizmo (R)', Rotate3d]] as const).map(([m, l, I]) => (
          <button key={m} type="button" role="radio" aria-checked={bisaGeser && modeGizmo === m} title={l} aria-label={l} disabled={!bisaGeser} onClick={() => setModeGizmo(m)}
            className={`grid place-items-center h-7 w-7 rounded-md transition-colors duration-150 disabled:opacity-35 ${
              bisaGeser && modeGizmo === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><I size={15} /></button>
        ))}
      </div>
      {!hanyaLihat && (
        <Menu label="Geser cepat (tombol panah) & geser tepat (mm, atau ketik angka)" ikon={Move} peran="dialog" tetapPasang lebar="w-64" disabled={!bisaGeser}>
          <div className="p-1.5"><GeserCepat a={a} /></div>
          <GarisMenu />
          <ItemMenu ikon={Ruler} label="Geser tepat (mm)" pintas="ketik angka" onClick={() => setGeser({ id: terpilih.id, teks: '' })} />
        </Menu>
      )}
      <TombolIkon ikon={Copy} label={banyak ? 'Duplikat semua yang terpilih' : 'Duplikat'} onClick={() => {
        if (!banyak) { duplikat(terpilih); return; }
        const h = duplikatBanyak(benda, ids, batas.x);
        setBenda(h.benda); setPilihan(h.baru[0]?.id ?? null, h.baru.slice(1).map(b => b.id));
      }} />
      <Menu label="Susun: ratakan, sebar, larik, tempel ke dinding, salin ke ruang lain" ikon={LayoutGrid} lebar="w-72" onBuka={v => { if (!v) setLarikBuka(false); }}>
        {banyak ? (<>
          <JudulMenu>Ratakan & sebar · {ids.length} benda</JudulMenu>
          {([['Kiri-kanan', 'x', [AlignStartVertical, AlignCenterVertical, AlignEndVertical], StretchHorizontal], ['Depan-belakang', 'z', [AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal], StretchVertical]] as const).map(([l, s, ik, Sebar]) => (
            <div key={s} className="flex items-center gap-0.5 px-2.5 pb-1">
              <span className="flex-1 text-[12.5px] text-slate-600">{l}</span>
              {(['awal', 'tengah', 'akhir'] as const).map((c, i) => {
                const I = ik[i];
                const arah = c === 'awal' ? (s === 'x' ? 'kiri' : 'depan') : c === 'akhir' ? (s === 'x' ? 'kanan' : 'belakang') : 'tengah';
                return <button key={c} type="button" className={ikonKecil} onClick={() => rata(bs => ratakan(bs, ids, s, c))} title={`Ratakan ${arah}`} aria-label={`Ratakan ${arah}`}><I size={15} /></button>;
              })}
              <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-slate-200" />
              <button type="button" className={ikonKecil} disabled={ids.length < 3} onClick={() => rata(bs => sebar(bs, ids, s))} title={`Sebar merata ${l.toLowerCase()} (min. 3 benda)`}
                aria-label={`Sebar merata ${l.toLowerCase()}`}><Sebar size={15} /></button>
            </div>
          ))}
        </>) : (<>
          <ItemMenu ikon={Grid2x2Plus} label="Larik" pintas={larikBuka ? '' : 'baris × kolom'} onClick={() => setLarikBuka(v => !v)} tetapBuka judul="Ulangi benda dalam baris × kolom berjarak tetap" />
          {larikBuka && (
            <div className="mx-2.5 mb-1.5 space-y-2 rounded-lg bg-slate-50 p-2">
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-600">
                <label>Kolom (kiri-kanan)<input inputMode="numeric" value={isiLarik.kolom} onChange={e => setIsiLarik({ ...isiLarik, kolom: e.target.value })} className={isian} /></label>
                <label>Baris (ke belakang)<input inputMode="numeric" value={isiLarik.baris} onChange={e => setIsiLarik({ ...isiLarik, baris: e.target.value })} className={isian} /></label>
                <label>Jarak kolom (mm)<input inputMode="numeric" value={isiLarik.jx} onChange={e => setIsiLarik({ ...isiLarik, jx: e.target.value })} className={isian} /></label>
                <label>Jarak baris (mm)<input inputMode="numeric" value={isiLarik.jz} onChange={e => setIsiLarik({ ...isiLarik, jz: e.target.value })} className={isian} /></label>
              </div>
              <button type="button" onClick={buatLarik} className="w-full h-8 rounded-lg text-[12.5px] font-bold text-white bg-blue-700 hover:bg-blue-800">Buat {jumlahLarik} salinan</button>
            </div>
          )}
        </>)}
        {BISA_TEMPEL.includes(terpilih.jenis) && !kunci && (<>
          <GarisMenu />
          <JudulMenu><PanelTop size={12} /> Tempel ke dinding</JudulMenu>
          <TempelDinding onTempel={tempel} />
        </>)}
        <GarisMenu />
        {duaRuang && <ItemMenu ikon={CopyPlus} label={`Salin ke Ruang ${ruangLain}`} onClick={() => salinKeRuangLain(terpilih)} />}
        <ItemMenu ikon={Crosshair} label="Fokus kamera" onClick={a.kamera.fokusBenda} judul="Dekatkan kamera ke benda ini" />
        <ItemMenu ikon={EyeOff} label="Sembunyikan" onClick={() => { setSembunyiGolongan([...new Set([...sembunyiGolongan, ...ids.map(kunciSembunyi)])]); setPilihan(null, []); }}
          judul="Tampilkan lagi lewat daftar Benda (L)" />
      </Menu>
      <TombolIkon ikon={kunci ? Lock : LockOpen} label={kunci ? 'Terkunci - klik untuk membuka' : 'Kunci posisi agar tidak tergeser'} aktif={kunci}
        className={kunci ? '!bg-amber-50 !text-amber-700' : ''}
        onClick={() => setBenda(bs => bs.map(b => (ids.includes(b.id) ? { ...b, terkunci: kunci ? undefined : true } : b)))} />
      <TombolIkon ikon={Trash2} label={banyak ? 'Hapus semua yang terpilih' : 'Hapus benda ini'} className="!text-rose-700 hover:!bg-rose-50"
        onClick={() => { const s = new Set(ids); setBenda(b => b.filter(x => !s.has(x.id))); setPilih(null); }} />
      {geserAktif && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-40">
          <GeserTepat a={a} awal={geserAktif.teks} onTutup={() => setGeser(null)} />
        </div>
      )}
    </div>
  );
}
