'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileBox, FileDown, FilePlus2, Image as IkonGambar, Maximize2, Redo2, Sparkles, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { isiLembar2 } from '@/lib/sld/lembar2';
import { HALAMAN } from '@/lib/sld/tipe';
import { cetakPdf, unduhPng, unduhVsdx } from './sld/ekspor';
import { PengaturanWatermark } from './sld/PengaturanWatermark';
import { gambarDariClipboard, kompresGambar } from './sld/gambar';
import { kelasTombol } from './sld/isian';
import { KanvasSLD } from './sld/KanvasSLD';
import { PanelKatalog } from './sld/PanelKatalog';
import { PanelSamping } from './sld/PanelSamping';
import { useKeadaanSLD } from './sld/useKeadaanSLD';

type Sheet = 1 | 2;

function Sheet2({ a }: { a: ReturnType<typeof useKeadaanSLD> }) {
  const logo = a.logo ?? WATERMARK_BAWAAN;
  const h = useMemo(() => isiLembar2(a.dok, { watermark: logo }), [a.dok, logo]);
  return (
    <div className="space-y-2">
      {(h.info.terpotongKoneksi > 0 || h.info.terpotongPerangkat > 0) && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
          Tabel terlalu panjang untuk satu lembar A3: {h.info.terpotongKoneksi} baris koneksi dan {h.info.terpotongPerangkat} baris perangkat tidak tercetak. Persingkat isi kolom.
        </p>
      )}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 max-h-[78vh]" style={{ colorScheme: 'light' }}>
        <svg viewBox={`0 0 ${HALAMAN.w} ${HALAMAN.h}`} style={{ width: '100%', minWidth: 640, display: 'block', background: '#fff', userSelect: 'none' }} role="img" aria-label="Pratinjau sheet 2"
          dangerouslySetInnerHTML={{ __html: h.svg }} />
      </div>
    </div>
  );
}

export function SLD() {
  const a = useKeadaanSLD();
  const [sheet, setSheet] = useState<Sheet>(1);
  const [zoom, setZoom] = useState(1);
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState<{ t: string; galat?: boolean } | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const aRef = useRef(a); aRef.current = a;

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      const x = aRef.current, p = x.pilih;
      if (!p) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); x.hapus(p); return; }
      if (e.key === 'Escape') { x.setPilih(null); return; }
      const arah: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const d = arah[e.key];
      if (!d || p.jenis !== 'p') return;
      e.preventDefault();
      const per = x.dok.perangkat.find(q => q.id === p.id);
      const s = e.shiftKey ? 5 : 0.5;
      if (per) x.ubahPerangkat(per.id, { x: per.x + d[0] * s, y: per.y + d[1] * s });
    };
    const tempel = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA'].includes(el.tagName))) return;
      const x = aRef.current, p = x.pilih, f = gambarDariClipboard(e);
      if (!f || p?.jenis !== 'p') return;
      e.preventDefault();
      kompresGambar(f).then(g => x.pasangFotoKe(p.id, g, 'Tempelan')).catch(err => setPesan({ t: err instanceof Error ? err.message : 'Foto gagal ditempel.', galat: true }));
    };
    window.addEventListener('keydown', tekan);
    window.addEventListener('paste', tempel);
    return () => { window.removeEventListener('keydown', tekan); window.removeEventListener('paste', tempel); };
  }, []);

  const jalankan = async (label: string, f: () => Promise<void>) => {
    setSibuk(label); setPesan(null);
    try { await f(); } catch (e) { setPesan({ t: e instanceof Error ? e.message : 'Ekspor gagal.', galat: true }); } finally { setSibuk(''); }
  };
  const ganti = (judul: string, f: () => void) => {
    if (!a.dok.perangkat.length && !a.dok.kabel.length) { f(); return; }
    setKonfirmasi({ message: judul, description: 'Diagram yang sedang dibuka akan diganti. Ekspor dulu bila masih diperlukan.', confirmLabel: 'Ganti', danger: true, onConfirm: f });
  };

  if (!a.siap) return <div className="h-[420px] grid place-items-center text-sm text-slate-500">Memuat SLD...</div>;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white border border-slate-200 p-3 flex flex-wrap items-center gap-1.5">
        <button type="button" className={kelasTombol} onClick={() => ganti('Mulai SLD baru?', a.baru)}><FilePlus2 size={15} /> Baru</button>
        <button type="button" className={kelasTombol} onClick={() => ganti('Buka contoh SLD Voice Kamar Pasien?', a.contoh)}><Sparkles size={15} /> Contoh</button>
        <span className="w-px h-6 bg-slate-200 mx-1" aria-hidden="true" />
        <button type="button" className={kelasTombol} onClick={a.riwayat.undo} disabled={!a.riwayat.bisaUndo} aria-label="Batal (Ctrl+Z)"><Undo2 size={15} /></button>
        <button type="button" className={kelasTombol} onClick={a.riwayat.redo} disabled={!a.riwayat.bisaRedo} aria-label="Ulang (Ctrl+Y)"><Redo2 size={15} /></button>
        <span className="w-px h-6 bg-slate-200 mx-1" aria-hidden="true" />
        <div className="flex rounded-xl border border-slate-200 p-0.5" role="tablist" aria-label="Lembar">
          {([1, 2] as Sheet[]).map(s => (
            <button key={s} type="button" role="tab" aria-selected={sheet === s} onClick={() => setSheet(s)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold ${sheet === s ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
              {s === 1 ? 'Sheet 1 · Diagram' : 'Sheet 2 · Koneksi & catatan'}
            </button>
          ))}
        </div>
        {sheet === 1 && (
          <div className="flex gap-1">
            <button type="button" className={kelasTombol} onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 4) / 4))} aria-label="Perkecil"><ZoomOut size={15} /></button>
            <button type="button" className={kelasTombol} onClick={() => setZoom(1)} aria-label="Pas layar"><Maximize2 size={15} /></button>
            <button type="button" className={kelasTombol} onClick={() => setZoom(z => Math.min(4, z + 0.25))} aria-label="Perbesar"><ZoomIn size={15} /></button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          <button type="button" className={`${kelasTombol} !bg-blue-700 !text-white !border-blue-700 hover:!bg-blue-800`} disabled={!!sibuk}
            onClick={() => void jalankan('pdf', () => cetakPdf(a.dok, a.logo))}><FileDown size={15} /> {sibuk === 'pdf' ? 'Menyiapkan...' : 'PDF A3'}</button>
          <button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => void jalankan('vsdx', () => unduhVsdx(a.dok, a.logo))}>
            <FileBox size={15} /> {sibuk === 'vsdx' ? 'Membuat...' : 'Visio (.vsdx)'}
          </button>
          {([1, 2] as Sheet[]).map(s => (
            <button key={s} type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => void jalankan(`png${s}`, () => unduhPng(a.dok, s, a.logo))}>
              <IkonGambar size={15} /> {sibuk === `png${s}` ? 'Membuat...' : `PNG sheet ${s}`}
            </button>
          ))}
        </div>
        <div className="w-full flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <PengaturanWatermark a={a} />
          <span className="text-[11.5px] text-slate-500">Foto, logo &amp; draf hanya tersimpan di browser ini - tidak diunggah ke server.</span>
        </div>
      </section>
      {pesan && <p className={`rounded-lg px-3 py-2 text-[13px] ${pesan.galat ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800'}`}>{pesan.t}</p>}
      {a.galatSimpan && <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">Draf tidak muat di penyimpanan peramban (foto terlalu banyak). Ekspor hasilnya agar tidak hilang.</p>}
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_330px] items-start">
        <section className="rounded-2xl bg-white border border-slate-200 p-3 order-2 lg:order-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 mb-2">Perangkat</h2>
          <PanelKatalog a={a} />
        </section>
        <div className="order-1 lg:order-2 min-w-0">{sheet === 1 ? <KanvasSLD a={a} zoom={zoom} /> : <Sheet2 a={a} />}</div>
        <div className="order-3"><PanelSamping a={a} /></div>
      </div>
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

export default SLD;
