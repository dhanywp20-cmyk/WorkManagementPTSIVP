'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Expand, FileBox, FileDown, FilePlus2, Minimize, PanelLeft, PanelRight, Image as IkonGambar, Maximize2, Redo2, Sparkles, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { isiLembar2 } from '@/lib/sld/lembar2';
import { HALAMAN } from '@/lib/sld/tipe';
import { cetakPdf, unduhPng, unduhVsdx } from './sld/ekspor';
import { PengaturanWatermark } from './sld/PengaturanWatermark';
import { BilahSimpan } from './sld/BilahSimpan';
import { useSimpanSLD } from './sld/useSimpanSLD';
import { gambarDariClipboard, kompresGambar } from './sld/gambar';
import { kelasTombol } from './sld/isian';
import { KanvasSLD } from './sld/KanvasSLD';
import { PanelKatalog } from './sld/PanelKatalog';
import { PanelSamping } from './sld/PanelSamping';
import { useKeadaanSLD } from './sld/useKeadaanSLD';

const KUNCI_RINCI = 'tools-team-sld-rinci';

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
  const simpan = useSimpanSLD(a);
  const aRef = useRef(a); aRef.current = a;
  const [simpleMode, setSimpleState] = useState(() => { try { return typeof window !== 'undefined' && localStorage.getItem(KUNCI_RINCI) === 'simple'; } catch { return false; } });
  const setSimple = (v: boolean) => { setSimpleState(v); try { localStorage.setItem(KUNCI_RINCI, v ? 'simple' : 'lengkap'); } catch {  } };
  const opsi = { logo: a.logo, simple: simpleMode };

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

  const dibukaRef = useRef(false);
  useEffect(() => {
    if (!a.siap || dibukaRef.current) return;
    dibukaRef.current = true;
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get('sld');
    if (id && /^[0-9a-f-]{36}$/i.test(id)) void simpan.buka(id, Number(sp.get('versi')) || undefined);
  }, [a.siap, simpan]);
  const [penuh, setPenuh] = useState(false);
  const [kiri, setKiri] = useState(true);
  const [kanan, setKanan] = useState(true);
  const layarRef = useRef(false);
  useEffect(() => {
    const ubah = () => { if (!document.fullscreenElement && layarRef.current) { layarRef.current = false; setPenuh(false); } };
    document.addEventListener('fullscreenchange', ubah);
    return () => document.removeEventListener('fullscreenchange', ubah);
  }, []);
  const aturPenuh = (v: boolean) => {
    setPenuh(v);
    if (v) document.documentElement.requestFullscreen?.().then(() => { layarRef.current = true; }).catch(() => {});
    else if (document.fullscreenElement) { layarRef.current = false; void document.exitFullscreen().catch(() => {}); }
  };

  if (!a.siap) return <div className="h-[420px] grid place-items-center text-sm text-slate-500">Memuat SLD...</div>;

  const kolom = `${kiri ? '230px ' : ''}minmax(0,1fr)${kanan ? ' 340px' : ''}`;
  const panel = penuh ? 'hidden lg:block h-full min-h-0 overflow-auto' : '';
  const tombolAktif = '!bg-blue-700 !text-white !border-blue-700';
  return (
    <div className={penuh ? 'fixed inset-0 z-[900] bg-slate-100 p-2 flex flex-col gap-2' : 'space-y-3'}>
      <section className="rounded-2xl bg-white border border-slate-200 p-2.5 flex flex-wrap items-center gap-1.5">
        <button type="button" className={kelasTombol} onClick={() => ganti('Mulai SLD baru?', () => { a.baru(); simpan.lepas(); })}><FilePlus2 size={15} /> Baru</button>
        <BilahSimpan a={a} s={simpan} />
        <button type="button" className={kelasTombol} onClick={() => ganti('Buka contoh SLD Voice Kamar Pasien?', () => { a.contoh(); simpan.lepas(); })}><Sparkles size={15} /> Contoh</button>
        <span className="w-px h-6 bg-slate-200 mx-0.5" aria-hidden="true" />
        <button type="button" className={kelasTombol} onClick={a.riwayat.undo} disabled={!a.riwayat.bisaUndo} aria-label="Batal (Ctrl+Z)"><Undo2 size={15} /></button>
        <button type="button" className={kelasTombol} onClick={a.riwayat.redo} disabled={!a.riwayat.bisaRedo} aria-label="Ulang (Ctrl+Y)"><Redo2 size={15} /></button>
        <span className="w-px h-6 bg-slate-200 mx-0.5" aria-hidden="true" />
        <div className="flex rounded-xl border border-slate-200 p-0.5" role="tablist" aria-label="Lembar">
          {([1, 2] as Sheet[]).map(s => (
            <button key={s} type="button" role="tab" aria-selected={sheet === s} onClick={() => setSheet(s)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition-colors duration-150 ${sheet === s ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
              {s === 1 ? 'Sheet 1 · Diagram' : `Sheet 2 · Koneksi & catatan${simpleMode ? ' (tidak diekspor)' : ''}`}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button type="button" className={kelasTombol} onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 4) / 4))} aria-label="Perkecil" disabled={sheet !== 1}>
            <ZoomOut size={15} />
          </button>
          <button type="button" className={kelasTombol} onClick={() => setZoom(1)} aria-label="Pas layar" disabled={sheet !== 1}><Maximize2 size={15} /></button>
          <button type="button" className={kelasTombol} onClick={() => setZoom(z => Math.min(4, z + 0.25))} aria-label="Perbesar" disabled={sheet !== 1}><ZoomIn size={15} /></button>
        </div>
        <div className="flex gap-1">
          <button type="button" className={`${kelasTombol} ${kiri ? '' : '!bg-slate-100'}`} onClick={() => setKiri(v => !v)} aria-pressed={kiri} title="Panel perangkat">
            <PanelLeft size={15} />
          </button>
          <button type="button" className={`${kelasTombol} ${kanan ? '' : '!bg-slate-100'}`} onClick={() => setKanan(v => !v)} aria-pressed={kanan} title="Panel properti">
            <PanelRight size={15} />
          </button>
          <button type="button" className={`${kelasTombol} ${penuh ? tombolAktif : ''}`} onClick={() => aturPenuh(!penuh)} aria-pressed={penuh}>
            {penuh ? <Minimize size={15} /> : <Expand size={15} />} {penuh ? 'Keluar' : 'Layar penuh'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 ml-auto">
          <div className="flex rounded-xl border border-slate-200 p-0.5" role="radiogroup" aria-label="Isi ekspor">
            {([[false, 'Full Detail', 'PDF, Visio & PNG berisi Sheet 1 + Sheet 2 (koneksi, daftar perangkat, catatan) - untuk internal'],
              [true, 'Simple', 'Hanya Sheet 1 (diagram) - aman dibagikan ke klien']] as const).map(([v, l, t]) => (
              <button key={l} type="button" role="radio" aria-checked={simpleMode === v} title={t} onClick={() => setSimple(v)}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition-colors duration-150 ${simpleMode === v ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>{l}</button>
            ))}
          </div>
          <button type="button" className={`${kelasTombol} ${tombolAktif} hover:!bg-blue-800`} disabled={!!sibuk}
            onClick={() => void jalankan('pdf', () => cetakPdf(a.dok, opsi))}><FileDown size={15} /> {sibuk === 'pdf' ? 'Menyiapkan...' : 'PDF A3'}</button>
          <button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => void jalankan('vsdx', () => unduhVsdx(a.dok, opsi))}>
            <FileBox size={15} /> {sibuk === 'vsdx' ? 'Membuat...' : 'Visio'}
          </button>
          {(simpleMode ? [1] : [1, 2] as Sheet[]).map(s => (
            <button key={s} type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => void jalankan(`png${s}`, () => unduhPng(a.dok, s as Sheet, opsi))}>
              <IkonGambar size={15} /> {sibuk === `png${s}` ? 'Membuat...' : simpleMode ? 'PNG' : `PNG ${s}`}
            </button>
          ))}
        </div>
        {!penuh && (
          <div className="w-full flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <PengaturanWatermark a={a} />
            <span className="text-[11.5px] text-slate-500">Foto, logo &amp; draf hanya tersimpan di browser ini - tidak diunggah ke server.</span>
          </div>
        )}
      </section>
      {[pesan, simpan.pesan].map((x, i) => x && (
        <p key={i} className={`rounded-lg px-3 py-2 text-[13px] ${x.galat ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800'}`}>{x.t}</p>
      ))}
      {a.galatSimpan && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
          Draf tidak muat di penyimpanan peramban (foto terlalu banyak). Ekspor hasilnya agar tidak hilang.
        </p>
      )}
      <div className={`grid gap-3 items-start lg:[grid-template-columns:var(--kolom)] ${penuh ? 'flex-1 min-h-0 grid-rows-[minmax(0,1fr)] items-stretch' : ''}`}
        style={{ '--kolom': kolom } as React.CSSProperties}>
        {kiri && (
          <section className={`rounded-2xl bg-white border border-slate-200 p-3 order-2 lg:order-1 ${panel}`}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600 mb-2">Perangkat</h2>
            <PanelKatalog a={a} />
          </section>
        )}
        <div className={`order-1 lg:order-2 min-w-0 ${penuh ? 'h-full min-h-0' : ''}`}>
          {sheet === 1 ? <KanvasSLD a={a} zoom={zoom} penuh={penuh} simple={simpleMode} /> : <Sheet2 a={a} />}
        </div>
        {kanan && <div className={`order-3 ${panel}`}><PanelSamping a={a} /></div>}
      </div>
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

export default SLD;
