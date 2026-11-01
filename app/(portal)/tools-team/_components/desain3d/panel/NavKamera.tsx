'use client';
/**
 * Navigasi kamera - satu kelompok di kanan-bawah kanvas: mode seret, zoom, pas ruangan, menu Kamera (putar 45°, menghadap
 * dinding, fokus ruang). Sudut 3D / Atas / Dari kursi ada di bilah atas, fokus ke benda di menu Lainnya benda terpilih -
 * dulu dua-duanya kembar di sini (8 tombol).
 */
import { Maximize2, Move, Rotate3d, RotateCcw, RotateCw, Video, ZoomIn, ZoomOut } from 'lucide-react';
import { grupNavMendatar, tombolSudut } from './gaya';
import { TombolNav } from './TombolNav';
import type { AlatDesain } from './alat';

export function NavKamera({ a }: { a: AlatDesain }) {
  const { duaRuang, fokusRuang, kotakRuang, menuSudut, modeSeret, setFokusRuang, setMenuSudut, setModeSeret, siap, sudutRef } = a.K;
  const { pasKeLayar, pilihSudut, putarKamera, zoom } = a.kamera;
  if (!siap) return null;
  return (
    <>
      <div className="kontrol-kanvas absolute right-2 bottom-2 z-10" role="toolbar" aria-label="Kontrol kamera">
        <div className={grupNavMendatar}>
          <TombolNav judul={modeSeret === 'geser' ? 'Tangan aktif: seret = geser kanvas (klik: kembali ke putar)' : 'Tangan: seret kiri = geser kanvas (atau klik kanan / Spasi + seret)'}
            aktif={modeSeret === 'geser'} onClick={() => setModeSeret(v => (v === 'geser' ? 'putar' : 'geser'))}>
            {modeSeret === 'geser' ? <Move size={16} /> : <Rotate3d size={16} />}
          </TombolNav>
          {/*  Ponsel: zoom lewat pinch - tombolnya disembunyikan supaya tidak menabrak menu Tampilan. */}
          <span className="hidden sm:contents">
            <TombolNav judul="Perbesar" onClick={() => zoom(0.7)}><ZoomIn size={16} /></TombolNav>
            <TombolNav judul="Perkecil" onClick={() => zoom(1.4)}><ZoomOut size={16} /></TombolNav>
          </span>
          <TombolNav judul="Tampilkan seluruh ruangan" onClick={() => pasKeLayar()}><Maximize2 size={16} /></TombolNav>
          <TombolNav judul="Kamera: putar 45°, menghadap dinding, fokus ruang" aktif={menuSudut} onClick={() => setMenuSudut(v => !v)}><Video size={16} /></TombolNav>
        </div>
      </div>
      {menuSudut && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-10" onClick={() => setMenuSudut(false)} />
          <div className="kontrol-kanvas absolute right-2 bottom-14 z-20 w-[236px] max-w-[calc(100%-16px)] rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Putar kamera</p>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => putarKamera(-45)} className={`${tombolSudut(false)} inline-flex items-center justify-center gap-1`}><RotateCcw size={14} /> 45° kiri</button>
              <button type="button" onClick={() => putarKamera(45)} className={`${tombolSudut(false)} inline-flex items-center justify-center gap-1`}><RotateCw size={14} /> 45° kanan</button>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mt-2 mb-1.5">Menghadap dinding</p>
            <div className="grid grid-cols-2 gap-1">
              {(['depan', 'belakang', 'kiri', 'kanan'] as const).map(v => (
                <button key={v} type="button" onClick={() => { pilihSudut(v); setMenuSudut(false); }}
                  className={`${tombolSudut(sudutRef.current === v)} capitalize`}>{v}</button>
              ))}
            </div>
            {duaRuang && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mt-2 mb-1.5">Fokus</p>
                <div className={`grid gap-1 ${kotakRuang.length > 2 ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3'}`}>
                  {([['semua', 'Semua'], ...kotakRuang.map((_, i) => [i, `Ruang ${i + 1}`])] as ['semua' | number, string][]).map(([v, l]) => (
                    <button key={String(v)} type="button" onClick={() => { setFokusRuang(v); pasKeLayar(v); }}
                      className={tombolSudut(fokusRuang === v)}>{l}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
