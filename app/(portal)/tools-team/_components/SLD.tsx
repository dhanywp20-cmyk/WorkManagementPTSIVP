'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SquareDashed, X, Type, Expand, FileBox, FileSpreadsheet, FileDown, FilePlus2, Minimize, PanelLeft, PanelRight, Image as IkonGambar, Maximize2, Redo2, Sparkles, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { isiLembar2 } from '@/lib/sld/lembar2';
import { sudutSah } from '@/lib/sld/geometri';
import { HALAMAN, KERTAS, type Kertas } from '@/lib/sld/tipe';
import { cetakPdf, unduhExcel, unduhPng, unduhVsdx } from './sld/ekspor';
import { LembarBoq } from './sld/LembarBoq';
import { BilahRuang } from './sld/BilahRuang';
import { semuaPerangkat } from '@/lib/sld/ruang';
import { posisiAwal } from '@/lib/sld/pilih';
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
const GERAK = 'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none';
const LACI_KIRI = `absolute left-2 top-2 bottom-2 z-20 w-[260px] max-w-[85%] overflow-auto rounded-2xl bg-white border border-slate-200 shadow-xl p-3 ${GERAK}`;
const POPUP_KANAN = `absolute right-2 top-2 z-20 w-[350px] max-w-[90%] max-h-[calc(100%-16px)] overflow-auto rounded-2xl shadow-xl origin-top-right ${GERAK}`;
const TAB_KIRI = 'absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-r-xl bg-blue-700 hover:bg-blue-800 text-white px-1.5 py-3 text-[12px] font-bold shadow-md [writing-mode:vertical-rl]';

type Sheet = 1 | 2 | 3;

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
      const x = aRef.current, p = x.pilih, ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === 'c') { if (x.salin()) e.preventDefault(); return; }
      if (ctrl && k === 'a') { e.preventDefault(); x.pilihBanyak([...x.dok.perangkat, ...x.dok.teks, ...(x.dok.zona ?? [])].map(o => o.id)); return; }
      if (ctrl && k === 'd') { e.preventDefault(); if (x.salin()) x.tempel(); return; }
      if (x.terpilih.length > 1) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); x.hapusTerpilih(); return; }
        if (e.key === 'Escape') { x.pilihBanyak([]); return; }
        const g: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (g[e.key]) { e.preventDefault(); const s = e.shiftKey ? 5 : 0.5; x.geserGrup(posisiAwal(x.dok, x.terpilih), g[e.key][0] * s, g[e.key][1] * s); }
        return;
      }
      if (!p) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); x.hapus(p); return; }
      if (e.key === 'Escape') { x.setPilih(null); return; }
      if ((e.key === 'r' || e.key === 'R') && p.jenis !== 'k' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const t = p.jenis === 't' ? x.dok.teks.find(q => q.id === p.id) : undefined;
        if (t) x.ubahTeks(t.id, { putar: sudutSah((t.putar ?? 0) + (e.shiftKey ? -90 : 90)) || undefined });
        else x.putarPerangkat(p.id, e.shiftKey ? -90 : 90);
        return;
      }
      if ((e.key === 'h' || e.key === 'H' || e.key === 'v' || e.key === 'V') && p.jenis === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        x.balikPerangkat(p.id, e.key.toLowerCase() === 'h' ? 'h' : 'v');
        return;
      }
      const arah: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const d = arah[e.key];
      if (!d || p.jenis === 'k') return;
      e.preventDefault();
      const s = e.shiftKey ? 5 : 0.5;
      const per = x.dok.perangkat.find(q => q.id === p.id), t = x.dok.teks.find(q => q.id === p.id);
      if (per) x.ubahPerangkat(per.id, { x: per.x + d[0] * s, y: per.y + d[1] * s });
      else if (t) x.ubahTeks(t.id, { x: t.x + d[0] * s, y: t.y + d[1] * s });
    };
    const tempel = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA'].includes(el.tagName))) return;
      const x = aRef.current, p = x.pilih, f = gambarDariClipboard(e);
      if (!f || p?.jenis !== 'p') { if (!f && x.tempel()) e.preventDefault(); return; }
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
    if (!semuaPerangkat(a.proyek).length && !a.dok.kabel.length) { f(); return; }
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
  const [kiri, setKiri] = useState(false);
  const [panelBuka, setPanelBuka] = useState(false);
  const [ditutupUntuk, setDitutupUntuk] = useState<string | null>(null);
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

  const kanan = sheet === 1 && (panelBuka || (!!a.pilih && ditutupUntuk !== a.pilih.id));
  const tutupKanan = () => { setPanelBuka(false); setDitutupUntuk(a.pilih?.id ?? null); };
  const tombolAktif = '!bg-blue-700 !text-white !border-blue-700';
  return (
    <div className={penuh ? 'fixed inset-0 z-[900] bg-slate-100 p-2 flex flex-col gap-2' : 'space-y-3'}>
      <section className="rounded-2xl bg-white border border-slate-200 p-2.5 flex flex-wrap items-center gap-1.5">
        <button type="button" className={kelasTombol} onClick={() => ganti('Mulai SLD baru?', () => { a.baru(); simpan.lepas(); })}><FilePlus2 size={15} /> Baru</button>
        <BilahSimpan a={a} s={simpan} />
        <input value={a.dok.blok.proyek} onChange={e => a.ubahBlok({ proyek: e.target.value })} placeholder="Nama proyek" aria-label="Nama proyek"
          title="Nama proyek - tampil di Sheet 1, 2 & 3" className="h-9 w-56 rounded-xl border border-slate-300 px-3 text-[13px] font-semibold text-slate-800 placeholder:font-normal" />
        <button type="button" className={kelasTombol} onClick={() => ganti('Buka contoh SLD Voice Kamar Pasien?', () => { a.contoh(); simpan.lepas(); })}><Sparkles size={15} /> Contoh</button>
        <span className="w-px h-6 bg-slate-200 mx-0.5" aria-hidden="true" />
        <button type="button" className={kelasTombol} onClick={a.riwayat.undo} disabled={!a.riwayat.bisaUndo} aria-label="Batal (Ctrl+Z)"><Undo2 size={15} /></button>
        <button type="button" className={kelasTombol} onClick={a.riwayat.redo} disabled={!a.riwayat.bisaRedo} aria-label="Ulang (Ctrl+Y)"><Redo2 size={15} /></button>
        <span className="w-px h-6 bg-slate-200 mx-0.5" aria-hidden="true" />
        <div className="flex rounded-xl border border-slate-200 p-0.5" role="tablist" aria-label="Lembar">
          {([1, 2, 3] as Sheet[]).map(s => (
            <button key={s} type="button" role="tab" aria-selected={sheet === s} onClick={() => setSheet(s)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition-colors duration-150 ${sheet === s ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
              {s === 1 ? 'Sheet 1 · Diagram' : `${s === 2 ? 'Sheet 2 · Koneksi & catatan' : 'Sheet 3 · BOQ'}${simpleMode ? ' (tidak diekspor)' : ''}`}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl border border-slate-200 p-0.5" role="radiogroup" aria-label="Ukuran kertas sheet 1">
          {(['169', 'a3'] as Kertas[]).map(k => (
            <button key={k} type="button" role="radio" aria-checked={(a.dok.kertas ?? 'a3') === k} onClick={() => a.aturKertas(k)}
              title={k === 'a3' ? 'Sheet 1 kertas A3 landscape (template baku)' : 'Sheet 1 kanvas 16:9 (420 x 236 mm) - perangkat & teks diskalakan otomatis'}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition-colors duration-150 ${(a.dok.kertas ?? 'a3') === k ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
              {KERTAS[k].label}
            </button>
          ))}
        </div>
        <button type="button" className={kelasTombol} onClick={() => { setSheet(1); a.tambahTeks(); }} title="Tambah teks bebas (atau klik dua kali di diagram)"><Type size={15} /> Teks</button>
        <button type="button" className={kelasTombol} onClick={() => { setSheet(1); a.tambahZona(); }} title="Kotak putus-putus berlabel: ruangan, Rack, Wall, Ceiling"><SquareDashed size={15} /> Area</button>
        <div className="flex gap-1">
          <button type="button" className={kelasTombol} onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 4) / 4))} aria-label="Perkecil" disabled={sheet !== 1}>
            <ZoomOut size={15} />
          </button>
          <button type="button" className={kelasTombol} onClick={() => setZoom(1)} aria-label="Pas layar" disabled={sheet !== 1}><Maximize2 size={15} /></button>
          <button type="button" className={kelasTombol} onClick={() => setZoom(z => Math.min(4, z + 0.25))} aria-label="Perbesar" disabled={sheet !== 1}><ZoomIn size={15} /></button>
        </div>
        <div className="flex gap-1">
          <button type="button" className={`${kelasTombol} ${kiri && sheet === 1 ? tombolAktif : ''}`} onClick={() => { setSheet(1); setKiri(v => !v); }} aria-pressed={kiri}
            title="Tampilkan / sembunyikan katalog perangkat"><PanelLeft size={15} /> Perangkat</button>
          <button type="button" className={`${kelasTombol} ${kanan ? tombolAktif : ''}`} onClick={() => { setSheet(1); if (kanan) tutupKanan(); else setPanelBuka(true); }}
            aria-pressed={kanan} title="Tampilkan / sembunyikan panel properti"><PanelRight size={15} /> Properti</button>
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
            onClick={() => void jalankan('pdf', () => cetakPdf(a.proyek, opsi))}><FileDown size={15} /> {sibuk === 'pdf' ? 'Menyiapkan...' : 'PDF A3'}</button>
          <button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => void jalankan('vsdx', () => unduhVsdx(a.proyek, opsi))}>
            <FileBox size={15} /> {sibuk === 'vsdx' ? 'Membuat...' : 'Visio'}
          </button>
          <button type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => void jalankan('xlsx', () => unduhExcel(a.proyek, opsi))}
            title={simpleMode ? 'Excel: Sheet 1 (diagram)' : 'Excel: Sheet 1 diagram, Sheet 2 koneksi, Sheet 3 BOQ'}>
            <FileSpreadsheet size={15} /> {sibuk === 'xlsx' ? 'Membuat...' : 'Excel'}
          </button>
          {(simpleMode ? [1] as const : [1, 2] as const).map(s => (
            <button key={s} type="button" className={kelasTombol} disabled={!!sibuk} onClick={() => void jalankan(`png${s}`, () => unduhPng(a.dok, s, opsi))}>
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
      <BilahRuang a={a} konfirmasi={setKonfirmasi} />
      <div className={`relative overflow-hidden rounded-xl ${penuh ? 'flex-1 min-h-0' : ''}`}>
        {sheet === 1 ? <KanvasSLD a={a} zoom={zoom} penuh={penuh} simple={simpleMode} /> : sheet === 2 ? <Sheet2 a={a} /> : <LembarBoq a={a} />}
        {sheet === 1 && (<>
          <section aria-label="Katalog perangkat" inert={!kiri} className={`${LACI_KIRI} ${kiri ? 'translate-x-0 opacity-100' : '-translate-x-[110%] opacity-0 pointer-events-none'}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">Perangkat</h2>
              <button type="button" onClick={() => setKiri(false)} aria-label="Tutup katalog perangkat" className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <PanelKatalog a={a} />
          </section>
          {!kiri && <button type="button" onClick={() => setKiri(true)} className={TAB_KIRI}>Perangkat</button>}
          <div inert={!kanan} className={`${POPUP_KANAN} ${kanan ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}>
            <PanelSamping a={a} onTutup={tutupKanan} />
          </div>
        </>)}
      </div>
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

export default SLD;
