'use client';
/** Kontrol kamera di kiri-bawah kanvas: mode seret, zoom, putar 45°, pas ruangan, fokus benda, menu arah pandang. */
import { Crosshair, Maximize2, Move, Rotate3d, RotateCcw, RotateCw, Video, ZoomIn, ZoomOut } from 'lucide-react';
import { grupNav, tombolSudut } from './gaya';
import { TombolNav } from './TombolNav';
import type { AlatDesain } from './alat';

export function NavKamera({ a }: { a: AlatDesain }) {
  const { duaRuang, fokusRuang, kotakRuang, menuSudut, modeSeret, setFokusRuang, setMenuSudut, setModeSeret, siap, sudutRef, tampilan, terpilih } = a.K;
  const { fokusBenda, pasKeLayar, pilihSudut, putarKamera, zoom } = a.kamera;
  return (
    <>
      {siap && (
        <div className="absolute left-2 bottom-2 z-10 flex flex-col gap-1.5" role="toolbar" aria-label="Kontrol kamera">
          <div className={grupNav}>
            <TombolNav judul={modeSeret === 'geser' ? 'Seret = geser bidang (ketuk: ganti ke putar)' : 'Seret = putar kamera (ketuk: ganti ke geser)'}
              aktif={modeSeret === 'geser'} onClick={() => setModeSeret(v => (v === 'geser' ? 'putar' : 'geser'))}>
              {modeSeret === 'geser' ? <Move size={17} /> : <Rotate3d size={17} />}
            </TombolNav>
          </div>
          <div className={grupNav}>
            <TombolNav judul="Perbesar" onClick={() => zoom(0.7)}><ZoomIn size={17} /></TombolNav>
            <TombolNav judul="Perkecil" onClick={() => zoom(1.4)}><ZoomOut size={17} /></TombolNav>
          </div>
          <div className={grupNav}>
            <TombolNav judul="Putar kamera 45° ke kiri" onClick={() => putarKamera(-45)}><RotateCcw size={17} /></TombolNav>
            <TombolNav judul="Putar kamera 45° ke kanan" onClick={() => putarKamera(45)}><RotateCw size={17} /></TombolNav>
          </div>
          <div className={grupNav}>
            <TombolNav judul="Tampilkan seluruh ruangan" onClick={() => pasKeLayar()}><Maximize2 size={17} /></TombolNav>
            {terpilih && <TombolNav judul={`Fokus ke ${terpilih.nama}`} onClick={fokusBenda}><Crosshair size={17} /></TombolNav>}
            <TombolNav judul="Arah pandang" aktif={menuSudut} onClick={() => setMenuSudut(v => !v)}><Video size={17} /></TombolNav>
          </div>
        </div>
      )}
      {siap && menuSudut && (
        <div className="absolute left-14 bottom-2 z-20 w-[236px] max-w-[calc(100%-64px)] rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Arah pandang</p>
          <div className="grid grid-cols-3 gap-1">
            {([['iso', '3D'], ['atas', 'Atas'], ['kursi', 'Dari kursi']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => { pilihSudut(v); setMenuSudut(false); }}
                className={tombolSudut(v === 'iso' ? tampilan === '3d' && sudutRef.current === 'iso' : tampilan === v)}>{l}</button>
            ))}
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
      )}
    </>
  );
}
