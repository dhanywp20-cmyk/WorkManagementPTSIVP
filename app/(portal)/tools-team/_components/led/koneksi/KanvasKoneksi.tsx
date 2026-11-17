'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { kodePort, warnaPort } from './data';
import { kelasTombol } from './komponen';
import { Download, Image as IkonGambar, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

const ZOOM_MIN = 0.1, ZOOM_MAKS = 4;
const batasZoom = (z: number) => Math.min(ZOOM_MAKS, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

function useZoomKanvas(svg: string) {
  const [zoom, setZoom] = useState(1);
  const wadah = useRef<HTMLDivElement>(null);
  const jangkar = useRef<{ x: number; y: number; z: number } | null>(null);
  const ukuran = useMemo(() => {
    const m = /\swidth="([\d.]+)"\s+height="([\d.]+)"/.exec(svg);
    return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
  }, [svg]);
  const svgZoom = useMemo(() => (!ukuran || zoom === 1 ? svg
    : svg.replace(/\swidth="[\d.]+"\s+height="[\d.]+"/, ` width="${Math.round(ukuran.w * zoom)}" height="${Math.round(ukuran.h * zoom)}"`)), [svg, ukuran, zoom]);
  const aturZoom = (z: number, titik?: { x: number; y: number }) => {
    const el = wadah.current, baru = batasZoom(z);
    if (el) {
      const r = el.getBoundingClientRect();
      jangkar.current = { x: titik ? titik.x - r.left : el.clientWidth / 2, y: titik ? titik.y - r.top : el.clientHeight / 2, z: zoom };
    }
    setZoom(baru);
  };
  useLayoutEffect(() => {
    const el = wadah.current, j = jangkar.current;
    if (!el || !j) return;
    jangkar.current = null;
    const k = zoom / j.z;
    el.scrollLeft = (el.scrollLeft + j.x) * k - j.x;
    el.scrollTop = (el.scrollTop + j.y) * k - j.y;
  }, [zoom]);
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const aturRef = useRef(aturZoom); aturRef.current = aturZoom;
  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      aturRef.current(zoomRef.current * Math.exp(-e.deltaY * 0.0015), { x: e.clientX, y: e.clientY });
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);
  const pas = () => {
    const el = wadah.current;
    if (!el || !ukuran) return;
    setZoom(batasZoom(Math.min((el.clientWidth - 20) / ukuran.w, (window.innerHeight * 0.8 - 20) / ukuran.h, 1.5)));
    el.scrollLeft = 0; el.scrollTop = 0;
  };
  return { zoom, svgZoom, wadah, aturZoom, pas };
}

export function KanvasKoneksi({ a }: { a: AlatRuangKoneksi }) {
  const { aktif, alatEf, g, klikSel, m, off, pilihLayar, pngStatus, portAktif, selDari, seret, seretKe, svg, t, unduhPNG, unduhSVG } = a;
  const { zoom, svgZoom, wadah, aturZoom, pas } = useZoomKanvas(svg);
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
          <span className="text-[12px] text-slate-600">
            {m.multi && <><b className="text-slate-800">{m.per[aktif].nama}</b> · </>}
            {alatEf === 'kabel' ? <>Mode kabel · port aktif <b style={{ color: warnaPort(off + portAktif) }}>{kodePort(t, off + portAktif)}</b></>
              : alatEf === 'kosong' ? 'Mode kosongkan sel - klik sel untuk mengosongkan / mengisi'
                : `Template cepat - pilih "Manual" untuk menyambung sendiri${m.multi ? '. Klik screen lain untuk mengaturnya' : ''}`}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center rounded-lg border border-slate-200" role="group" aria-label="Zoom kanvas">
              <button type="button" onClick={() => aturZoom(zoom / 1.25)} disabled={zoom <= ZOOM_MIN} title="Perkecil (Ctrl + roda mouse)" aria-label="Perkecil"
                className="px-2 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-l-lg"><ZoomOut size={14} /></button>
              <button type="button" onClick={() => aturZoom(1)} title="Kembali ke 100%" aria-label={`Zoom ${Math.round(zoom * 100)}%, klik untuk 100%`}
                className="min-w-[48px] px-1.5 py-1.5 text-[12px] font-bold tabular-nums text-slate-700 hover:bg-slate-50 border-x border-slate-200">{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => aturZoom(zoom * 1.25)} disabled={zoom >= ZOOM_MAKS} title="Perbesar (Ctrl + roda mouse)" aria-label="Perbesar"
                className="px-2 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ZoomIn size={14} /></button>
              <button type="button" onClick={pas} title="Pas layar: tampilkan seluruh diagram" aria-label="Pas layar"
                className="px-2 py-1.5 text-slate-700 hover:bg-slate-50 border-l border-slate-200 rounded-r-lg"><Maximize size={14} /></button>
            </div>
            <button type="button" onClick={() => void unduhPNG()} disabled={pngStatus === 'proses'} title="Unduh diagram + legenda port sebagai gambar PNG (resolusi 2x)" className={kelasTombol}>
              <IkonGambar size={14} /> {pngStatus === 'proses' ? 'Membuat...' : pngStatus === 'gagal' ? 'PNG gagal' : 'PNG'}
            </button>
            <button type="button" onClick={unduhSVG} title="Unduh diagram sebagai SVG (vektor, bisa diedit di Illustrator / Inkscape)" className={kelasTombol}><Download size={14} /> SVG</button>
          </div>
        </div>
        <div ref={wadah} className="overflow-auto max-h-[80vh]">
        <div className="p-2 w-max min-w-full [&>svg]:mx-auto [&>svg]:block select-none" role="img"
          aria-label={`Diagram koneksi ${g.portTerpakai} port untuk ${g.hasil.sel.length} receiving card${m.multi ? ` di ${m.per.length} screen` : ''}`}
          onPointerDown={e => {
            const sel = selDari(e.target as Element); if (!sel) return;
            if (sel[0] !== aktif) { pilihLayar(sel[0]); return; }
            if (!alatEf) return;
            e.preventDefault();
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {  }
            klikSel(sel[1], sel[2]);
          }}
          onPointerMove={e => {
            if (!seret.current) return;
            const sel = selDari(document.elementFromPoint(e.clientX, e.clientY));
            if (sel && sel[0] === aktif) seretKe(sel[1], sel[2]);
          }}
          onPointerUp={() => { seret.current = false; }} onPointerCancel={() => { seret.current = false; }}
          dangerouslySetInnerHTML={{ __html: svgZoom }} />
        </div>
      </div>
    </>
  );
}
