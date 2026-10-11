'use client';
/**
 * Bilah alat kiri di dalam kanvas: Tambah, Teks cepat, Pilih banyak, Penggaris, Snap grid, dan Geser / Putar
 * untuk benda terpilih. Pintasan: A = Tambah, M = penggaris, G = snap, R = geser/putar, Esc = batal.
 */
import { useEffect, useRef, useState } from 'react';
import { BoxSelect, Grid3x3, Move3d, Plus, Rotate3d, Ruler, Type } from 'lucide-react';
import { KATALOG, labelLangkah, LANGKAH_SNAP, MAKS_PENGGARIS, SUDUT_SNAP, titikSnap, type Titik } from '../inti';
import { grupNav } from './gaya';
import { TombolNav } from './TombolNav';
import type { AlatDesain } from './alat';

const ITEM_TEKS = KATALOG.flatMap(g => g.item).find(i => i.kunci === 'teks-dinding');

export function BilahKiri({ a }: { a: AlatDesain }) {
  const { alatKanvas, bukaSisi, hanyaLihat, klikUkurRef, modeBanyak, modeGizmo, ruang, setAlatKanvas, setModeBanyak, setModeGizmo,
    setPilih, setRuang, setSnap, setTitikUkur, sisi, snap, terpilih, titikUkur } = a.K;
  const [menuSnap, setMenuSnap] = useState(false);
  const titikRef = useRef<Titik | null>(titikUkur); titikRef.current = titikUkur;
  const snapRef = useRef(snap); snapRef.current = snap;
  const ukur = alatKanvas === 'ukur';
  const jumlahGaris = ruang.penggaris?.length ?? 0;

  //  Mode penggaris: klik pertama = titik awal, klik kedua = garis jadi (mode tetap aktif untuk garis berikutnya).
  useEffect(() => {
    if (!ukur) { klikUkurRef.current = null; return; }
    klikUkurRef.current = p => {
      const t = titikSnap(p, snapRef.current);
      const awal = titikRef.current;
      if (!awal) { setTitikUkur(t); return; }
      setTitikUkur(null);
      if (Math.hypot(t[0] - awal[0], t[1] - awal[1], t[2] - awal[2]) < 0.005) return;
      setRuang(r => ({ ...r, penggaris: [...(r.penggaris ?? []), { id: `u${Date.now().toString(36)}`, a: awal, b: t }].slice(-MAKS_PENGGARIS) }));
    };
    return () => { klikUkurRef.current = null; };
  }, [ukur, klikUkurRef, setRuang, setTitikUkur]);

  const keluarUkur = () => { setAlatKanvas('pilih'); setTitikUkur(null); };
  const mulaiUkur = () => { setPilih(null); setModeBanyak(false); setAlatKanvas('ukur'); };

  //  Pintasan papan ketik (diabaikan saat mengetik di isian).
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"], [role=dialog]')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' && ukur) { if (titikRef.current) setTitikUkur(null); else keluarUkur(); }
      else if (k === 'm') { if (ukur) keluarUkur(); else mulaiUkur(); }
      else if (k === 'g') setSnap({ ...snapRef.current, aktif: !snapRef.current.aktif });
      else if (k === 'a' && !hanyaLihat) bukaSisi('tambah');
      else if (k === 'r' && terpilih) setModeGizmo(modeGizmo === 'translate' ? 'rotate' : 'translate');
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  });

  const pilihan = (aktif: boolean) => `px-2 py-1 rounded-md text-[12px] font-semibold border ${aktif ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`;
  return (
    <div className="relative flex flex-col gap-1.5" role="toolbar" aria-label="Alat desain">
      {!hanyaLihat && (
        <button type="button" onClick={() => bukaSisi('tambah')} aria-pressed={sisi === 'tambah'} title="Tambah benda (A)"
          className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-[12.5px] font-bold text-white shadow-sm bg-blue-700 hover:bg-blue-800 ${sisi === 'tambah' ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}>
          <Plus size={16} /> <span className="hidden sm:inline">Tambah</span>
        </button>
      )}
      <div className={`${grupNav} self-start`}>
        {!hanyaLihat && ITEM_TEKS && <TombolNav judul="Tambah teks / keterangan" onClick={() => a.aksi.tambah(ITEM_TEKS)}><Type size={17} /></TombolNav>}
        <TombolNav judul={modeBanyak ? 'Pilih banyak: aktif' : 'Pilih banyak (atau Shift / Ctrl + klik)'} aktif={modeBanyak} onClick={() => { keluarUkur(); setModeBanyak(!modeBanyak); }}><BoxSelect size={17} /></TombolNav>
        <TombolNav judul={ukur ? 'Penggaris: aktif - klik dua titik (M / Esc untuk selesai)' : 'Penggaris - ukur jarak dua titik (M)'} aktif={ukur} onClick={() => (ukur ? keluarUkur() : mulaiUkur())}><Ruler size={17} /></TombolNav>
        <TombolNav judul={snap.aktif ? `Snap grid ${labelLangkah(snap.langkah)} · ${snap.sudut}° (G)` : 'Snap grid - geser & putar presisi (G)'} aktif={snap.aktif || menuSnap} onClick={() => setMenuSnap(v => !v)}><Grid3x3 size={17} /></TombolNav>
      </div>
      {terpilih && !ukur && (
        <div className={`${grupNav} self-start`} role="group" aria-label="Geser atau putar benda">
          <TombolNav judul="Geser (R)" aktif={modeGizmo === 'translate'} onClick={() => setModeGizmo('translate')}><Move3d size={17} /></TombolNav>
          <TombolNav judul="Putar (R)" aktif={modeGizmo === 'rotate'} onClick={() => setModeGizmo('rotate')}><Rotate3d size={17} /></TombolNav>
        </div>
      )}
      {ukur && (
        <div className="self-start flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-2 py-1 text-[11.5px] font-bold shadow-sm">
          <Ruler size={13} /> {titikUkur ? 'Titik kedua' : 'Titik pertama'}
          {jumlahGaris > 0 && (
            <button type="button" onClick={() => setRuang(r => ({ ...r, penggaris: [] }))} title="Hapus semua garis ukur"
              className="ml-1 rounded bg-white/20 px-1.5 hover:bg-white/30">Hapus {jumlahGaris}</button>
          )}
        </div>
      )}
      {menuSnap && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuSnap(false)} />
          <div className="absolute left-11 top-10 z-30 w-56 rounded-xl bg-white border border-slate-200 shadow-xl p-2.5 space-y-2">
            <label className="flex items-center justify-between text-[12.5px] font-bold text-slate-800">
              Snap grid
              <input type="checkbox" className="w-4 h-4" checked={snap.aktif} onChange={e => setSnap({ ...snap, aktif: e.target.checked })} />
            </label>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Geser</p>
              <div className="flex flex-wrap gap-1">
                {LANGKAH_SNAP.map(l => <button key={l} type="button" onClick={() => setSnap({ ...snap, aktif: true, langkah: l })} className={pilihan(snap.aktif && snap.langkah === l)}>{labelLangkah(l)}</button>)}
              </div>
            </div>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Putar</p>
              <div className="flex flex-wrap gap-1">
                {SUDUT_SNAP.map(s => <button key={s} type="button" onClick={() => setSnap({ ...snap, aktif: true, sudut: s })} className={pilihan(snap.aktif && snap.sudut === s)}>{s}°</button>)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
