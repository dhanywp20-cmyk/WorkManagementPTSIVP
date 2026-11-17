'use client';
import { kodePort, warnaPort } from './data';
import { kelasTombol } from './komponen';
import { Download, Image as IkonGambar } from 'lucide-react';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

export function KanvasKoneksi({ a }: { a: AlatRuangKoneksi }) {
  const { aktif, alatEf, g, klikSel, m, off, pilihLayar, pngStatus, portAktif, selDari, seret, seretKe, svg, t, unduhPNG, unduhSVG } = a;
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
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => void unduhPNG()} disabled={pngStatus === 'proses'} title="Unduh diagram + legenda port sebagai gambar PNG (resolusi 2x)" className={kelasTombol}>
              <IkonGambar size={14} /> {pngStatus === 'proses' ? 'Membuat...' : pngStatus === 'gagal' ? 'PNG gagal' : 'PNG'}
            </button>
            <button type="button" onClick={unduhSVG} title="Unduh diagram sebagai SVG (vektor, bisa diedit di Illustrator / Inkscape)" className={kelasTombol}><Download size={14} /> SVG</button>
          </div>
        </div>
        <div className="overflow-auto max-h-[80vh]">
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
          dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </div>
    </>
  );
}
