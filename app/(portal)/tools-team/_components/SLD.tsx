'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, BoxSelect, CopyPlus, Download, Expand, FileBox, FileDown, FileSpreadsheet, FlipHorizontal2, FlipVertical2,
  Image as IkonGambar, LayoutGrid, Minimize, MousePointer2, PanelLeft, PanelRight, Redo2, RotateCw, Route, Settings2, Spline, SquareDashed, Trash2, Type, Undo2,
  WandSparkles, X, ZoomIn, ZoomOut,
} from 'lucide-react';
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
import { PengaturanWatermark, Sakelar } from './sld/PengaturanWatermark';
import { BilahSimpan } from './sld/BilahSimpan';
import { useSimpanSLD } from './sld/useSimpanSLD';
import { gambarDariClipboard, kompresGambar } from './sld/gambar';
import { GarisMenu, ItemMenu, JudulMenu, kelasIkon, Menu, Pemisah, Segmen, TombolIkon } from './sld/MenuBilah';
import { RATA } from './sld/PanelPilihan';
import { KanvasSLD } from './sld/KanvasSLD';
import { PanelKatalog } from './sld/PanelKatalog';
import { PanelSamping } from './sld/PanelSamping';
import { PopupGeser } from './sld/PopupGeser';
import { useKeadaanSLD } from './sld/useKeadaanSLD';
import { useKatalogTim } from './sld/useKatalogTim';
import { DialogObjekTim } from './sld/KatalogTim';

const KUNCI_RINCI = 'tools-team-sld-rinci';
const PENANDA_KLIP = '[SLD-AV]';
const GERAK = 'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none';
const LACI_KIRI = `absolute left-2 top-2 bottom-2 z-20 w-[260px] max-w-[85%] overflow-auto rounded-2xl bg-white border border-slate-200 shadow-xl p-3 ${GERAK}`;
const POPUP_KANAN = `absolute right-2 top-2 z-20 w-[350px] max-w-[90%] max-h-[calc(100%-16px)] overflow-auto rounded-2xl shadow-xl origin-top-right ${GERAK}`;
const TAB_KIRI = 'absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-r-xl bg-blue-700 hover:bg-blue-800 text-white px-1.5 py-3 text-[12px] font-bold shadow-md [writing-mode:vertical-rl]';

type Sheet = 1 | 2 | 3;

const ALAT = [
  ['pilih', MousePointer2, 'Pilih', 'Pilih, geser & atur objek (Esc)'],
  ['garis', Spline, 'Garis', 'Gambar kabel manual: klik perangkat asal, titik belok, lalu perangkat tujuan'],
  ['teks', Type, 'Teks', 'Tambah teks bebas (atau klik dua kali di diagram)'],
  ['area', SquareDashed, 'Area', 'Kotak putus-putus berlabel untuk mengelompokkan: ruangan, Rack, Wall, Ceiling'],
] as const;

const LEMBAR = [[1, 'Diagram'], [2, 'Koneksi'], [3, 'BOQ']] as const;

function Sheet2({ a }: { a: ReturnType<typeof useKeadaanSLD> }) {
  const logo = a.logo ?? WATERMARK_BAWAAN;
  const h = useMemo(() => isiLembar2(a.dok, { watermark: logo }), [a.dok, logo]);
  return (
    <div className="space-y-2">
      {h.info.halaman > 1 && (
        <p className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-[12.5px] text-sky-900">
          Isi Sheet 2 tidak muat satu lembar A3, jadi otomatis berlanjut ke {h.info.halaman} lembar (ikut di PDF, PNG &amp; Visio).
        </p>
      )}
      {(h.info.terpotongKoneksi > 0 || h.info.terpotongPerangkat > 0) && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
          Masih ada {h.info.terpotongKoneksi} baris koneksi dan {h.info.terpotongPerangkat} baris perangkat yang tidak tercetak (batas lembar lanjutan). Persingkat isi kolom.
        </p>
      )}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 max-h-[78vh] space-y-3" style={{ colorScheme: 'light' }}>
        {h.svgs.map((s, i) => (
          <svg key={i} viewBox={`0 0 ${HALAMAN.w} ${HALAMAN.h}`} style={{ width: '100%', minWidth: 640, display: 'block', background: '#fff', userSelect: 'none' }} role="img"
            aria-label={`Pratinjau sheet 2${h.svgs.length > 1 ? ` lembar ${i + 1}` : ''}`} dangerouslySetInnerHTML={{ __html: s }} />
        ))}
      </div>
    </div>
  );
}

export function SLD() {
  const a = useKeadaanSLD();
  const tim = useKatalogTim();
  const tanpaKoneksi = !!a.proyek.tanpaKoneksi;
  const { segarkanFotoTim, proyek } = a;
  useEffect(() => { if (tim.status === 'siap') segarkanFotoTim(tim.daftar); }, [tim.status, tim.daftar, proyek, segarkanFotoTim]);
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
      if (x.gambarKabel) return;
      if (ctrl && k === 'c') return;
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
    const diIsian = (e: Event) => { const el = e.target as HTMLElement | null; return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA'].includes(el.tagName)); };
    const salin = (e: ClipboardEvent) => {
      if (diIsian(e) || window.getSelection()?.toString() || !aRef.current.salin()) return;
      e.clipboardData?.setData('text/plain', `${PENANDA_KLIP} ${aRef.current.terpilih.length || 1} item`);
      e.preventDefault();
    };
    const tempel = (e: ClipboardEvent) => {
      if (diIsian(e)) return;
      const x = aRef.current, p = x.pilih;
      if ((e.clipboardData?.getData('text/plain') ?? '').startsWith(PENANDA_KLIP)) { if (x.tempel()) e.preventDefault(); return; }
      const f = gambarDariClipboard(e);
      if (!f || p?.jenis !== 'p') return;
      e.preventDefault();
      const per = x.dok.perangkat.find(q => q.id === p.id);
      setKonfirmasi({
        message: `Pakai gambar dari clipboard sebagai foto "${per?.nama || 'perangkat'}"?`,
        description: 'Gambar yang ditempel (Ctrl+V) menjadi foto perangkat ini dan hanya tersimpan di browser Anda. Bila maksudnya menempel item, pilih Batal lalu salin item dengan Ctrl+C dulu.',
        confirmLabel: 'Pakai sebagai foto',
        onConfirm: () => kompresGambar(f).then(g => aRef.current.pasangFotoKe(p.id, g, 'Tempelan')).catch(err => setPesan({ t: err instanceof Error ? err.message : 'Foto gagal ditempel.', galat: true })),
      });
    };
    window.addEventListener('keydown', tekan);
    window.addEventListener('copy', salin);
    window.addEventListener('paste', tempel);
    return () => { window.removeEventListener('keydown', tekan); window.removeEventListener('copy', salin); window.removeEventListener('paste', tempel); };
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
  const idPer = new Set(a.dok.perangkat.map(p => p.id));
  const nPer = a.terpilih.filter(id => idPer.has(id)).length;
  const tunggal = a.terpilih.length <= 1 ? a.pilih : null;
  const kanvas = sheet === 1;
  const bisaPutar = kanvas && (tunggal?.jenis === 'p' || tunggal?.jenis === 't');
  const bisaSalin = kanvas && a.terpilih.length > 0 && !(tunggal?.jenis === 'k');
  const kabelPilih = tunggal?.jenis === 'k' ? a.dok.kabel.find(c => c.id === tunggal.id) : undefined;
  const putar = (sudut: number) => {
    if (!tunggal) return;
    const t = tunggal.jenis === 't' ? a.dok.teks.find(q => q.id === tunggal.id) : undefined;
    if (t) a.ubahTeks(t.id, { putar: sudutSah((t.putar ?? 0) + sudut) || undefined });
    else if (tunggal.jenis === 'p') a.putarPerangkat(tunggal.id, sudut);
  };
  const hapusPilihan = () => { if (a.terpilih.length > 1) a.hapusTerpilih(); else if (a.pilih) a.hapus(a.pilih); };
  const rapikanLabel = () => {
    const n = a.rapikanSemuaLabel();
    setPesan({ t: n ? `${n} label dipindah ke posisi kosong (bisa Ctrl+Z).` : 'Tidak ada posisi label yang lebih baik - geser perangkat sedikit.' });
  };
  const ekspor = (k: string, f: () => Promise<void>) => () => void jalankan(k, f);
  return (
    <div className={penuh ? 'fixed inset-0 z-[900] bg-slate-100 p-2 flex flex-col gap-2' : 'space-y-3'}>
      <section aria-label="Toolbar SLD" className="relative z-30 rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
          <BilahSimpan a={a} s={simpan} onBaru={() => ganti('Mulai SLD baru?', () => { a.baru(); simpan.lepas(); })}
            onContoh={() => ganti('Buka contoh SLD Voice Kamar Pasien?', () => { a.contoh(); simpan.lepas(); })} />
          <input value={a.dok.blok.proyek} onChange={e => a.ubahBlok({ proyek: e.target.value })} placeholder="Nama proyek" aria-label="Nama proyek"
            title="Nama proyek - tampil di Sheet 1, 2 & 3"
            className="h-8 w-48 rounded-lg border border-transparent bg-slate-50 px-2.5 text-[13px] font-semibold text-slate-800 placeholder:font-normal hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-hidden" />
          <Pemisah />
          <TombolIkon ikon={Undo2} label="Batal (Ctrl+Z)" onClick={a.riwayat.undo} disabled={!a.riwayat.bisaUndo} />
          <TombolIkon ikon={Redo2} label="Ulang (Ctrl+Y)" onClick={a.riwayat.redo} disabled={!a.riwayat.bisaRedo} />
          <Pemisah />
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Alat gambar">
            {ALAT.map(([k, Ikon, l, t]) => {
              const aktif = kanvas && (k === 'pilih' ? !a.gambarKabel : k === 'garis' && a.gambarKabel);
              return (
                <button key={k} type="button" role="radio" aria-checked={aktif} title={t}
                  onClick={() => {
                    setSheet(1);
                    if (k === 'pilih') a.setGambarKabel(false);
                    else if (k === 'garis') a.setGambarKabel(!a.gambarKabel);
                    else { a.setGambarKabel(false); if (k === 'teks') a.tambahTeks(); else a.tambahZona(); }
                  }}
                  className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12.5px] font-bold transition-colors duration-150 ${
                    aktif ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  <Ikon size={15} /> {l}
                </button>
              );
            })}
          </div>
          <Pemisah />
          <TombolIkon ikon={CopyPlus} label="Duplikat (Ctrl+D)" onClick={() => { if (a.salin()) a.tempel(); }} disabled={!bisaSalin} />
          <TombolIkon ikon={RotateCw} label="Putar 90° (R)" onClick={() => putar(90)} disabled={!bisaPutar} />
          <TombolIkon ikon={Trash2} label="Hapus (Delete)" onClick={hapusPilihan} disabled={!kanvas || !a.terpilih.length} className="hover:!bg-rose-50 hover:!text-rose-700" />
          <Menu label="Susun & rapikan" ikon={LayoutGrid} teks="Susun" lebar="w-64" disabled={!kanvas}>
            <JudulMenu>Ratakan · pilih ≥ 2 perangkat</JudulMenu>
            <div className="grid grid-cols-6 gap-0.5 px-1.5 pb-1">
              {RATA.map(([k, Ikon, l]) => (
                <button key={k} type="button" className={kelasIkon} onClick={() => a.ratakanTerpilih(k)} disabled={nPer < 2} aria-label={l} title={l}><Ikon size={16} /></button>
              ))}
            </div>
            <JudulMenu>Sebar merata · pilih ≥ 3 perangkat</JudulMenu>
            <ItemMenu ikon={AlignHorizontalDistributeCenter} label="Jarak horizontal sama" onClick={() => a.ratakanTerpilih('sebarH')} disabled={nPer < 3} tetapBuka />
            <ItemMenu ikon={AlignVerticalDistributeCenter} label="Jarak vertikal sama" onClick={() => a.ratakanTerpilih('sebarV')} disabled={nPer < 3} tetapBuka />
            <GarisMenu />
            <ItemMenu ikon={FlipHorizontal2} label="Balik horizontal" pintas="H" onClick={() => tunggal && a.balikPerangkat(tunggal.id, 'h')} disabled={tunggal?.jenis !== 'p'} tetapBuka />
            <ItemMenu ikon={FlipVertical2} label="Balik vertikal" pintas="V" onClick={() => tunggal && a.balikPerangkat(tunggal.id, 'v')} disabled={tunggal?.jenis !== 'p'} tetapBuka />
            <ItemMenu ikon={Route} label="Jalur kabel otomatis" onClick={() => kabelPilih && a.ubahKabel(kabelPilih.id, { tengah: undefined, jalur: undefined })}
              disabled={!kabelPilih || (kabelPilih.tengah === undefined && !kabelPilih.jalur?.length)} />
            <GarisMenu />
            <ItemMenu ikon={BoxSelect} label="Pilih semua" pintas="Ctrl+A" onClick={() => a.pilihBanyak([...a.dok.perangkat, ...a.dok.teks, ...(a.dok.zona ?? [])].map(o => o.id))} />
            <ItemMenu ikon={WandSparkles} label="Rapikan semua label" onClick={rapikanLabel} disabled={!a.dok.perangkat.length} />
          </Menu>
          <div className="ml-auto flex items-center gap-0.5">
            <TombolIkon ikon={ZoomOut} label="Perkecil" onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 4) / 4))} disabled={!kanvas || zoom <= 1} />
            <button type="button" className={`${kelasIkon} w-12 tabular-nums`} onClick={() => setZoom(1)} disabled={!kanvas} title="Pas layar" aria-label="Pas layar">
              {Math.round(zoom * 100)}%
            </button>
            <TombolIkon ikon={ZoomIn} label="Perbesar" onClick={() => setZoom(z => Math.min(4, z + 0.25))} disabled={!kanvas || zoom >= 4} />
            <Pemisah />
            <TombolIkon ikon={PanelLeft} label="Katalog perangkat" aktif={kiri && kanvas} onClick={() => { setSheet(1); setKiri(v => !v); }} />
            <TombolIkon ikon={PanelRight} label="Panel properti" aktif={kanan} onClick={() => { setSheet(1); if (kanan) tutupKanan(); else setPanelBuka(true); }} />
            <TombolIkon ikon={penuh ? Minimize : Expand} label={penuh ? 'Keluar layar penuh' : 'Layar penuh'} aktif={penuh} onClick={() => aturPenuh(!penuh)} />
            <Menu label="Pengaturan lembar & logo" ikon={Settings2} kanan lebar="w-72">
              <JudulMenu>Kertas Sheet 1</JudulMenu>
              <div className="px-2.5 pb-1.5">
                <Segmen label="Ukuran kertas sheet 1" nilai={a.dok.kertas ?? 'a3'} onPilih={a.aturKertas}
                  opsi={(['a3', '169'] as Kertas[]).map(k => [k, KERTAS[k].label, k === 'a3' ? 'A3 landscape (template baku)' : '420 x 236 mm - isi diskalakan otomatis'] as const)} />
              </div>
              <div className="px-2.5 py-1.5">
                <Sakelar label="Pakai Sheet 2 (koneksi & catatan)" nilai={!tanpaKoneksi} judul="Matikan bila proyek tidak butuh daftar koneksi; tidak tampil & tidak ikut ekspor."
                  onUbah={v => { a.aturSheet2(v); if (!v && sheet === 2) setSheet(1); }} />
              </div>
              <GarisMenu />
              <JudulMenu>Logo &amp; watermark</JudulMenu>
              <PengaturanWatermark a={a} />
              <p className="px-2.5 pt-1 pb-1.5 text-[11px] text-slate-500">Foto, logo &amp; draf hanya tersimpan di browser ini.</p>
            </Menu>
            <Pemisah />
            <Menu label="Ekspor" ikon={Download} teks={sibuk ? 'Membuat...' : 'Ekspor'} utama kanan lebar="w-64" disabled={!!sibuk}>
              <JudulMenu>Isi ekspor</JudulMenu>
              <div className="px-2.5 pb-1">
                <Segmen label="Isi ekspor" nilai={simpleMode} onPilih={setSimple}
                  opsi={[[false, 'Full Detail', 'Sheet 1 + Sheet 2 - untuk internal'], [true, 'Simple', 'Hanya Sheet 1 - aman untuk klien']] as const} />
                <p className="pt-1 text-[11px] text-slate-500">{simpleMode ? 'Hanya diagram - aman dibagikan ke klien.' : 'Diagram + koneksi, perangkat & catatan - internal.'}</p>
              </div>
              <GarisMenu />
              <ItemMenu ikon={FileDown} label="PDF A3" onClick={ekspor('pdf', () => cetakPdf(a.proyek, opsi))} />
              <ItemMenu ikon={FileBox} label="Visio (.vsdx)" onClick={ekspor('vsdx', () => unduhVsdx(a.proyek, opsi))} />
              <ItemMenu ikon={FileSpreadsheet} label={simpleMode ? 'Excel (diagram)' : 'Excel (diagram, koneksi, BOQ)'} onClick={ekspor('xlsx', () => unduhExcel(a.proyek, opsi))} />
              {(simpleMode || tanpaKoneksi ? [1] as const : [1, 2] as const).map(n => (
                <ItemMenu key={n} ikon={IkonGambar} label={`PNG Sheet ${n}`} onClick={ekspor(`png${n}`, () => unduhPng(a.dok, n, opsi))} />
              ))}
            </Menu>
          </div>
        </div>
        <BilahRuang a={a} konfirmasi={setKonfirmasi} kanan={(
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Lembar">
            {LEMBAR.map(([n, l]) => {
              const mati = n === 2 && tanpaKoneksi;
              return (
                <button key={n} type="button" role="tab" aria-selected={sheet === n} onClick={() => setSheet(n)} disabled={mati}
                  title={mati ? 'Sheet 2 dimatikan (Pengaturan)' : n > 1 && simpleMode ? 'Tidak ikut ekspor mode Simple' : undefined}
                  className={`h-7 px-2.5 rounded-md text-[12px] font-bold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                    sheet === n ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                  <span className="text-slate-400 font-semibold">Sheet {n}</span> {l}
                </button>
              );
            })}
          </div>
        )} />
      </section>
      {[pesan, simpan.pesan].map((x, i) => x && (
        <p key={i} className={`rounded-lg px-3 py-2 text-[13px] ${x.galat ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800'}`}>{x.t}</p>
      ))}
      {a.galatSimpan && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
          Draf tidak muat di penyimpanan peramban (foto terlalu banyak). Ekspor hasilnya agar tidak hilang.
        </p>
      )}
      <div className={`relative overflow-hidden rounded-xl ${penuh ? 'flex-1 min-h-0' : ''}`}>
        {sheet === 1 ? <KanvasSLD a={a} zoom={zoom} penuh={penuh} simple={simpleMode} /> : sheet === 3 ? <LembarBoq a={a} /> : !tanpaKoneksi ? <Sheet2 a={a} /> : (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-[13px] text-slate-600">
            Sheet 2 tidak dipakai untuk proyek ini. Centang <b>Pakai Sheet 2</b> bila perlu daftar koneksi.
          </p>
        )}
        {sheet === 1 && (<>
          <section aria-label="Katalog perangkat" inert={!kiri} className={`${LACI_KIRI} ${kiri ? 'translate-x-0 opacity-100' : '-translate-x-[110%] opacity-0 pointer-events-none'}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">Perangkat</h2>
              <button type="button" onClick={() => setKiri(false)} aria-label="Tutup katalog perangkat" className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <PanelKatalog a={a} tim={tim} konfirmasi={setKonfirmasi} />
          </section>
          {!kiri && <button type="button" onClick={() => setKiri(true)} className={TAB_KIRI}>Perangkat</button>}
          <PopupGeser buka={kanan} judul="Properti · seret untuk pindah" className={POPUP_KANAN}>
            <PanelSamping a={a} onTutup={tutupKanan} tim={tim} />
          </PopupGeser>
        </>)}
      </div>
      {tim.form && <DialogObjekTim key={`${tim.form.item?.id ?? 'baru'}|${tim.form.sumberFoto ?? ''}`} tim={tim} form={tim.form} />}
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

export default SLD;
