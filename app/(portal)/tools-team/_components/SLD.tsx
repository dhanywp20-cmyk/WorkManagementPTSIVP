'use client';
import { useEffect, useRef, useState } from 'react';
import {
  CopyPlus, Download, Expand, FileBox, FileDown, FileSpreadsheet, Eraser, Hand, PackagePlus, Paintbrush,
  Image as IkonGambar, Minimize, MousePointer2, PanelRight, Redo2, RotateCw, Settings2, Spline, SquareDashed, Trash2, Type, Undo2,
  X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { sudutSah } from '@/lib/sld/geometri';
import { KERTAS, type Kertas } from '@/lib/sld/tipe';
import { cetakPdf, unduhExcel, unduhPng, unduhVsdx } from './sld/ekspor';
import { LembarBoq } from './sld/LembarBoq';
import { BilahRuang } from './sld/BilahRuang';
import { semuaPerangkat } from '@/lib/sld/ruang';
import { posisiAwal } from '@/lib/sld/pilih';
import { PengaturanWatermark } from './sld/PengaturanWatermark';
import { BilahSimpan } from './sld/BilahSimpan';
import { useSimpanSLD } from './sld/useSimpanSLD';
import { gambarDariClipboard, kompresGambar } from './sld/gambar';
import { GarisMenu, ItemMenu, JudulMenu, kelasIkon, Menu, Pemisah, Sakelar, Segmen, TombolIkon } from './bersama/MenuBilah';
import { MenuSusun } from './sld/MenuSusun';
import { Sheet2 } from './sld/Sheet2';
import { CariGanti } from './sld/CariGanti';
import { KanvasSLD } from './sld/KanvasSLD';
import { PanelKatalog } from './sld/PanelKatalog';
import { PanelSamping } from './sld/PanelSamping';
import { PopupGeser } from './sld/PopupGeser';
import { type Alat, useKeadaanSLD } from './sld/useKeadaanSLD';
import { useKatalogTim } from './sld/useKatalogTim';
import { DialogObjekTim } from './sld/KatalogTim';

const KUNCI_RINCI = 'tools-team-sld-rinci';
const KUNCI_TAMPILAN = 'tools-team-sld-tampilan';
const PENANDA_KLIP = '[SLD-AV]';
const GERAK = 'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none';
const LACI_KIRI = `absolute left-2 top-2 bottom-2 z-20 w-[260px] max-w-[85%] overflow-auto rounded-2xl bg-white border border-slate-200 shadow-xl p-3 ${GERAK}`;
const POPUP_KANAN = `absolute right-2 top-2 z-20 w-[350px] max-w-[90%] max-h-[calc(100%-16px)] overflow-auto rounded-2xl shadow-xl origin-top-right ${GERAK}`;
const TAB_KIRI = 'absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-r-xl bg-blue-700 hover:bg-blue-800 text-white px-1.5 py-3 text-[12px] font-bold shadow-md [writing-mode:vertical-rl]';

type Sheet = 1 | 2 | 3;

const ALAT: [Alat, typeof Hand, string, string][] = [
  ['pilih', MousePointer2, 'Pilih', 'Pilih: pilih, pindah & atur objek (Esc)'],
  ['geser', Hand, 'Geser', 'Geser tampilan kanvas (tahan Spasi kapan saja)'],
  ['garis', Spline, 'Garis', 'Garis kabel: klik perangkat asal, titik belok, lalu perangkat tujuan (G)'],
  ['teks', Type, 'Teks', 'Teks: klik di diagram untuk menaruh teks (T)'],
  ['area', SquareDashed, 'Area', 'Area: seret untuk menggambar kotak Rack, Wall, Ceiling, ruangan (A)'],
  ['format', Paintbrush, 'Format', 'Kuas format: salin ukuran, huruf, warna & posisi label ke objek sejenis (P)'],
  ['hapus', Eraser, 'Hapus', 'Penghapus: klik objek untuk menghapus (E)'],
];
const PINTAS_ALAT: Record<string, Alat> = { g: 'garis', t: 'teks', a: 'area', p: 'format', e: 'hapus' };

const LEMBAR = [[1, 'Diagram'], [2, 'Koneksi'], [3, 'BOQ']] as const;

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
  const [tampilan, setTampilanState] = useState<{ grid: boolean; jepret: boolean }>(() => {
    try { const v = JSON.parse(localStorage.getItem(KUNCI_TAMPILAN) ?? '{}'); return { grid: v.grid === true, jepret: v.jepret !== false }; } catch { return { grid: false, jepret: true }; }
  });
  const setTampilan = (x: Partial<typeof tampilan>) => {
    const n = { ...tampilan, ...x };
    setTampilanState(n);
    try { localStorage.setItem(KUNCI_TAMPILAN, JSON.stringify(n)); } catch { return; }
  };
  const [cariBuka, setCariBuka] = useState(false);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      const x = aRef.current, p = x.pilih, ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (!ctrl && !e.altKey && !e.shiftKey && PINTAS_ALAT[k]) { e.preventDefault(); setSheet(1); x.setAlat(x.alat === PINTAS_ALAT[k] ? 'pilih' : PINTAS_ALAT[k]); return; }
      if (x.alat !== 'pilih') return;
      if (ctrl && e.shiftKey && (k === 'f' || k === 'b')) { e.preventDefault(); x.urutkanTerpilih(k === 'f' ? 'depan' : 'belakang'); return; }
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
    const cari = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); setSheet(1); setCariBuka(true); }
    };
    window.addEventListener('keydown', cari);
    window.addEventListener('keydown', tekan);
    window.addEventListener('copy', salin);
    window.addEventListener('paste', tempel);
    return () => { window.removeEventListener('keydown', cari); window.removeEventListener('keydown', tekan); window.removeEventListener('copy', salin); window.removeEventListener('paste', tempel); };
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
  const tunggal = a.terpilih.length <= 1 ? a.pilih : null;
  const kanvas = sheet === 1;
  const bisaPutar = kanvas && (tunggal?.jenis === 'p' || tunggal?.jenis === 't');
  const bisaSalin = kanvas && a.terpilih.length > 0 && !(tunggal?.jenis === 'k');
  const putar = (sudut: number) => {
    if (!tunggal) return;
    const t = tunggal.jenis === 't' ? a.dok.teks.find(q => q.id === tunggal.id) : undefined;
    if (t) a.ubahTeks(t.id, { putar: sudutSah((t.putar ?? 0) + sudut) || undefined });
    else if (tunggal.jenis === 'p') a.putarPerangkat(tunggal.id, sudut);
  };
  const hapusPilihan = () => { if (a.terpilih.length > 1) a.hapusTerpilih(); else if (a.pilih) a.hapus(a.pilih); };
  const ekspor = (k: string, f: () => Promise<void>) => () => void jalankan(k, f);
  return (
    <div className={penuh ? 'fixed inset-0 z-[900] bg-slate-100 p-2 flex flex-col gap-2' : 'space-y-3'}>
      <section aria-label="Toolbar SLD" className="relative z-30 rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
          <BilahSimpan a={a} s={simpan} onBaru={() => ganti('Mulai SLD baru?', () => { a.baru(); simpan.lepas(); })}
            onContoh={() => ganti('Buka contoh SLD Voice Kamar Pasien?', () => { a.contoh(); simpan.lepas(); })} />
          <input value={a.dok.blok.proyek} onChange={e => a.ubahBlok({ proyek: e.target.value })} placeholder="Nama proyek" aria-label="Nama proyek"
            title="Nama proyek - tampil di Sheet 1, 2 & 3"
            className="h-8 w-32 sm:w-48 rounded-lg border border-transparent bg-slate-50 px-2.5 text-[13px] font-semibold text-slate-800 placeholder:font-normal hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-hidden" />
          <Pemisah />
          <TombolIkon ikon={Undo2} label="Batal (Ctrl+Z)" onClick={a.riwayat.undo} disabled={!a.riwayat.bisaUndo} />
          <TombolIkon ikon={Redo2} label="Ulang (Ctrl+Y)" onClick={a.riwayat.redo} disabled={!a.riwayat.bisaRedo} />
          <Pemisah />
          <button type="button" onClick={() => { setSheet(1); setKiri(v => !v); }} aria-pressed={kiri && kanvas} title="Tambah perangkat dari katalog"
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 mr-1 rounded-lg text-[12.5px] font-bold border transition-colors duration-150 ${
              kiri && kanvas ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
            <PackagePlus size={16} /> Perangkat
          </button>
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Alat gambar">
            {ALAT.map(([k, Ikon, l, t]) => {
              const aktif = kanvas && a.alat === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={aktif} title={t} aria-label={l}
                  onClick={() => { setSheet(1); a.setAlat(k !== 'pilih' && a.alat === k ? 'pilih' : k); }}
                  className={`inline-flex items-center gap-1.5 h-7 min-w-7 justify-center px-1.5 rounded-md text-[12.5px] font-bold transition-colors duration-150 ${
                    aktif ? `bg-white shadow-sm ${k === 'hapus' ? 'text-rose-700' : 'text-blue-700'}` : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}>
                  <Ikon size={15} />{aktif && <span className="pr-0.5">{l}</span>}
                </button>
              );
            })}
          </div>
          <Pemisah />
          <TombolIkon ikon={CopyPlus} label="Duplikat (Ctrl+D)" onClick={() => { if (a.salin()) a.tempel(); }} disabled={!bisaSalin} />
          <TombolIkon ikon={RotateCw} label="Putar 90° (R)" onClick={() => putar(90)} disabled={!bisaPutar} />
          <TombolIkon ikon={Trash2} label="Hapus (Delete)" onClick={hapusPilihan} disabled={!kanvas || !a.terpilih.length} className="hover:!bg-rose-50 hover:!text-rose-700" />
          <MenuSusun a={a} kanvas={kanvas} onPesan={t => setPesan({ t })} />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-0.5">
            <CariGanti a={a} buka={cariBuka} onBuka={setCariBuka} onPilih={() => { setSheet(1); setPanelBuka(true); }} />
            <Pemisah />
            <TombolIkon ikon={ZoomOut} label="Perkecil" onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 4) / 4))} disabled={!kanvas || zoom <= 1} />
            <button type="button" className={`${kelasIkon} w-12 tabular-nums`} onClick={() => setZoom(1)} disabled={!kanvas} title="Pas layar" aria-label="Pas layar">
              {Math.round(zoom * 100)}%
            </button>
            <TombolIkon ikon={ZoomIn} label="Perbesar" onClick={() => setZoom(z => Math.min(4, z + 0.25))} disabled={!kanvas || zoom >= 4} />
            <Pemisah />
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
              <JudulMenu>Tampilan kanvas</JudulMenu>
              <div className="space-y-2 px-2.5 py-1.5">
                <Sakelar label="Grid (5 mm)" nilai={tampilan.grid} onUbah={v => setTampilan({ grid: v })} judul="Hanya di layar, tidak ikut ekspor" />
                <Sakelar label="Jepret ke objek (garis bantu)" nilai={tampilan.jepret} onUbah={v => setTampilan({ jepret: v })} judul="Tahan Shift saat menyeret untuk mematikan sementara" />
                <Sakelar label="Lompatan di persilangan kabel" nilai={!a.dok.tanpaLompat} onUbah={a.aturLompat} judul="Seperti line jumps Visio: kabel mendatar melompati kabel tegak. Ikut PDF & PNG." />
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
                  <span className="text-slate-600 font-semibold">Sheet {n}</span> {l}
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
        {sheet === 1 ? <KanvasSLD a={a} zoom={zoom} penuh={penuh} simple={simpleMode} onZoom={setZoom} grid={tampilan.grid} jepret={tampilan.jepret} /> : sheet === 3 ? <LembarBoq a={a} /> : !tanpaKoneksi ? <Sheet2 a={a} /> : (
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
