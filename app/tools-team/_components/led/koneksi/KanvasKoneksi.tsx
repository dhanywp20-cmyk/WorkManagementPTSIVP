'use client';
/** Kanvas diagram Screen Connection (klik / seret di mode manual) + unduh PNG / SVG. */
import { warnaPort } from './data';
import { kelasTombol } from './komponen';
import { Download, Image as IkonGambar } from 'lucide-react';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

export function KanvasKoneksi({ a }: { a: AlatRuangKoneksi }) {
  const { alatEf, k, klikSel, pngStatus, portAktif, selDari, seret, seretKe, svg, t, unduhPNG, unduhSVG } = a;
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
          <span className="text-[12px] text-slate-600">
            {alatEf === 'kabel' ? <>Mode kabel · port aktif <b style={{ color: warnaPort(portAktif) }}>P{portAktif}</b></>
              : alatEf === 'kosong' ? 'Mode kosongkan sel - klik sel untuk mengosongkan / mengisi'
                : 'Template cepat - pilih "Manual" untuk menyambung sendiri'}
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => void unduhPNG()} disabled={pngStatus === 'proses'} title="Unduh diagram + legenda port sebagai gambar PNG (resolusi 2x)" className={kelasTombol}>
              <IkonGambar size={14} /> {pngStatus === 'proses' ? 'Membuat...' : pngStatus === 'gagal' ? 'PNG gagal' : 'PNG'}
            </button>
            <button type="button" onClick={unduhSVG} title="Unduh diagram sebagai SVG (vektor, bisa diedit di Illustrator / Inkscape)" className={kelasTombol}><Download size={14} /> SVG</button>
          </div>
        </div>
        {/* HP: diagram diberi lebar minimum (±48 px per receiving card) lalu digeser mendatar,
            supaya sel tetap cukup besar untuk diketuk / diseret saat menyambung kabel. */}
        <div className="overflow-x-auto">
        <div className="p-2 [&>svg]:mx-auto [&>svg]:block select-none" role="img" style={{ minWidth: Math.min(1100, t.K * 48 + 110) }}
          aria-label={`Diagram koneksi ${t.portTerpakai} port untuk ${k.sel.length} receiving card`}
          onPointerDown={e => {
            if (!alatEf) return;
            const sel = selDari(e.target as Element); if (!sel) return;
            e.preventDefault();
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* abaikan */ }
            klikSel(sel[0], sel[1]);
          }}
          onPointerMove={e => {
            if (!seret.current) return;
            const sel = selDari(document.elementFromPoint(e.clientX, e.clientY));
            if (sel) seretKe(sel[0], sel[1]);
          }}
          onPointerUp={() => { seret.current = false; }} onPointerCancel={() => { seret.current = false; }}
          dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </div>
    </>
  );
}
