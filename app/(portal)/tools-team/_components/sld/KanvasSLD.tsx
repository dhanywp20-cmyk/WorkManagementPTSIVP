'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spline, X } from 'lucide-react';
import {
  geserRuas, geserSudut, hapusSudut, hurufPerangkat, jalurDari, type Kotak, kotakTampak, ortogonal, pecahRuas, ruasTegak, ruteManual, sisiKeTitik, sudutSah,
} from '@/lib/sld/geometri';
import { jalurBulat, isiLembar1, letakLabel } from '@/lib/sld/lembar1';
import { idDalamKotak, jepret, kotakDari, type Panduan, posisiAwal } from '@/lib/sld/pilih';
import { labelZona, tebalZona } from '@/lib/sld/zona';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { kotakTeks } from '@/lib/sld/teks-bebas';
import { halamanDok, MAKS_TITIK_JALUR, type Perangkat, type TeksBebas, type Titik, UKURAN_MIN } from '@/lib/sld/tipe';
import { EditorKabelBaru } from './EditorKabelBaru';
import { kompresGambar } from './gambar';
import type { KeadaanSLD } from './useKeadaanSLD';

type Seret =
  | { mode: 'grup'; mulai: Titik; awal: Map<string, Titik>; kotak?: Kotak; lain: Kotak[] }
  | { mode: 'kotak'; dari: Titik; ke: Titik }
  | { mode: 'ukurZona'; id: string; x0: number; y0: number }
  | { mode: 'ukur'; id: string; x0: number; y0: number }
  | { mode: 'sambung'; dari: string; titik: Titik }
  | { mode: 'ruas'; id: string; awal: Titik[]; k: number; tegak: boolean }
  | { mode: 'sudut'; id: string; awal: Titik[]; k: number }
  | { mode: 'putar'; id: string; cx: number; cy: number }
  ;

const BIRU = '#2563eb';
const HIJAU = '#059669';
const snap = (v: number) => Math.round(v * 2) / 2;

function tepiMenghadap(k: Kotak, ke: Titik, sebelum?: Titik) {
  const s = sisiKeTitik(k, ke, sebelum);
  return { s, t: s === 'kiri' ? { x: k.x, y: k.y + k.h / 2 } : s === 'kanan' ? { x: k.x + k.w, y: k.y + k.h / 2 } : s === 'atas' ? { x: k.x + k.w / 2, y: k.y } : { x: k.x + k.w / 2, y: k.y + k.h } };
}

export function areaLabel(p: Perangkat, f = 1) {
  const l = letakLabel(p, f), lx = l.kanan ? l.x - l.w - 0.5 : l.x - 0.5;
  const x = Math.min(p.x, lx), y = Math.min(p.y, l.atas), x2 = Math.max(p.x + p.w, lx + l.w + 1), y2 = Math.max(p.y + p.h, l.atas + l.h + 0.5);
  return { x, y, w: x2 - x, h: y2 - y };
}

export function KanvasSLD({ a, zoom, penuh = false, simple = false }: { a: KeadaanSLD; zoom: number; penuh?: boolean; simple?: boolean }) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const [ukuran, setUkuran] = useState({ w: 960, h: 540 });
  useEffect(() => {
    const el = wadahRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setUkuran({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const svgRef = useRef<SVGSVGElement>(null);
  const [seret, setSeret] = useState<Seret | null>(null);
  const [panduan, setPanduan] = useState<Panduan[]>([]);
  const { dok, geo, pilih } = a;
  const H = halamanDok(dok);
  const lebarPas = Math.max(320, Math.min(ukuran.w - 16, ((ukuran.h - 16) * H.w) / H.h));
  const area = (p: Perangkat) => areaLabel(p, hurufPerangkat(p, dok));
  const logo = a.logo ?? WATERMARK_BAWAAN;
  const isi = useMemo(() => isiLembar1(dok, { watermark: logo, simple }, geo), [dok, geo, logo, simple]);

  const titik = (e: { clientX: number; clientY: number }): Titik => {
    const s = svgRef.current, m = s?.getScreenCTM();
    if (!s || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const tangkap = (e: React.PointerEvent) => { try { svgRef.current?.setPointerCapture(e.pointerId); } catch {  } };
  const perangkatDi = (t: Titik) => [...dok.perangkat].reverse().find(p => {
    const b = area(p);
    return t.x >= b.x && t.x <= b.x + b.w && t.y >= b.y && t.y <= b.y + b.h;
  });

  const mulaiObjek = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (e.shiftKey || e.ctrlKey || e.metaKey) { a.togglePilih(id); return; }
    tangkap(e);
    const ikut = a.terpilih.includes(id), ids = ikut ? a.terpilih : [id];
    if (!ikut) a.pilihBanyak([id]);
    const p = dok.perangkat.find(x => x.id === id), s = new Set(ids);
    setSeret({ mode: 'grup', mulai: titik(e), awal: posisiAwal(dok, ids), kotak: p ? kotakTampak(p) : undefined, lain: p ? dok.perangkat.filter(q => !s.has(q.id)).map(kotakTampak) : [] });
  };
  const gerak = (e: React.PointerEvent) => {
    if (!seret) return;
    const t = titik(e);
    if (seret.mode === 'grup') {
      let dx = t.x - seret.mulai.x, dy = t.y - seret.mulai.y, garis: Panduan[] = [];
      if (seret.kotak && !e.shiftKey) {
        const j = jepret({ ...seret.kotak, x: seret.kotak.x + dx, y: seret.kotak.y + dy }, seret.lain);
        dx += j.dx; dy += j.dy; garis = j.garis;
      }
      a.geserGrup(seret.awal, dx, dy); setPanduan(garis);
    }
    else if (seret.mode === 'kotak') setSeret({ ...seret, ke: t });
    else if (seret.mode === 'ukurZona') a.ubahZona(seret.id, { w: Math.max(10, snap(t.x - seret.x0)), h: Math.max(8, snap(t.y - seret.y0)) });
    else if (seret.mode === 'ukur') a.ubahPerangkat(seret.id, { w: Math.max(UKURAN_MIN.w, snap(t.x - seret.x0)), h: Math.max(UKURAN_MIN.h, snap(t.y - seret.y0)) });
    else if (seret.mode === 'sambung') setSeret({ ...seret, titik: t });
    else if (seret.mode === 'putar') {
      const sudut = (Math.atan2(t.y - seret.cy, t.x - seret.cx) * 180) / Math.PI + 90;
      a.ubahPerangkat(seret.id, { putar: sudutSah(e.shiftKey ? sudut : Math.round(sudut / 15) * 15) || undefined });
    }
    else if (seret.mode === 'ruas') {
      const baru = geserRuas(seret.awal, seret.k, snap(seret.tegak ? t.x : t.y));
      a.ubahKabel(seret.id, { tengah: undefined, jalur: baru.slice(1, -1) });
    }
    else if (seret.mode === 'sudut') {
      const baru = geserSudut(seret.awal, seret.k, { x: snap(t.x), y: snap(t.y) });
      a.ubahKabel(seret.id, { tengah: undefined, jalur: baru.slice(1, -1) });
    }
  };
  const lepas = (e: React.PointerEvent) => {
    if (seret?.mode === 'sambung') {
      const tujuan = perangkatDi(titik(e));
      if (tujuan && tujuan.id !== seret.dari) a.hubungkan(seret.dari, tujuan.id);
    }
    if (seret?.mode === 'kotak') {
      const m = kotakDari(seret.dari, titik(e));
      if (m.w < 1 && m.h < 1) a.pilihBanyak([]);
      else a.pilihBanyak([...(e.shiftKey ? a.terpilih : []), ...idDalamKotak(dok, m)]);
    }
    if (seret?.mode === 'ruas' || seret?.mode === 'sudut') {
      const c = dok.kabel.find(k => k.id === seret.id);
      if (c?.jalur) a.ubahKabel(seret.id, { jalur: jalurDari([seret.awal[0], ...c.jalur, seret.awal[seret.awal.length - 1]]) });
    }
    setSeret(null); setPanduan([]);
  };

  const [gambar, setGambar] = useState<{ dari: string | null; titik: Titik[] }>({ dari: null, titik: [] });
  const [kursor, setKursor] = useState<Titik | null>(null);
  const modeGambar = a.gambarKabel;
  const setModeKabel = a.setGambarKabel;
  const setGambarKabel = useCallback((aktif: boolean) => { setModeKabel(aktif); setGambar({ dari: null, titik: [] }); setKursor(null); }, [setModeKabel]);
  useEffect(() => {
    if (!modeGambar) return;
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (e.key === 'Escape') { e.preventDefault(); setGambarKabel(false); }
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setGambar(g => (g.titik.length ? { ...g, titik: g.titik.slice(0, -1) } : { dari: null, titik: [] }));
      }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [modeGambar, setGambarKabel]);
  const asalGambar = gambar.dari ? dok.perangkat.find(p => p.id === gambar.dari) : undefined;
  const titikGambar = (t: Titik, bebas: boolean): Titik => {
    const s = { x: snap(t.x), y: snap(t.y) };
    if (bebas) return s;
    const lalu = gambar.titik[gambar.titik.length - 1];
    if (lalu) return Math.abs(s.x - lalu.x) >= Math.abs(s.y - lalu.y) ? { x: s.x, y: lalu.y } : { x: lalu.x, y: s.y };
    if (asalGambar) {
      const k = kotakTampak(asalGambar);
      if (s.y >= k.y && s.y <= k.y + k.h) return { x: s.x, y: snap(k.y + k.h / 2) };
      if (s.x >= k.x && s.x <= k.x + k.w) return { x: snap(k.x + k.w / 2), y: s.y };
    }
    return s;
  };
  const klikGambar = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (e.button === 2) { setGambar(g => (g.titik.length ? { ...g, titik: g.titik.slice(0, -1) } : { dari: null, titik: [] })); return; }
    const t = titik(e), p = perangkatDi(t);
    if (!gambar.dari) { if (p) setGambar({ dari: p.id, titik: [] }); return; }
    if (p && p.id !== gambar.dari) { a.hubungkan(gambar.dari, p.id, gambar.titik.length ? gambar.titik : undefined); setGambarKabel(false); return; }
    if (p && !gambar.titik.length) return;
    if (gambar.titik.length >= MAKS_TITIK_JALUR) return;
    setGambar(g => ({ ...g, titik: [...g.titik, titikGambar(t, e.shiftKey)] }));
  };
  const tujuanGambar = modeGambar && gambar.dari && kursor ? perangkatDi(kursor) : undefined;
  const keTujuan = tujuanGambar && tujuanGambar.id !== gambar.dari ? tujuanGambar : undefined;
  const pratinjau = (() => {
    if (!modeGambar || !asalGambar || !kursor) return null;
    const tengahJalur = keTujuan ? gambar.titik : [...gambar.titik, titikGambar(kursor, false)];
    const kA = kotakTampak(asalGambar), kB = keTujuan ? kotakTampak(keTujuan) : null;
    const n = tengahJalur.length;
    const awal = tepiMenghadap(kA, tengahJalur[0] ?? (kB ? { x: kB.x + kB.w / 2, y: kB.y + kB.h / 2 } : kursor), tengahJalur[1]);
    if (!kB) return ortogonal([awal.t, ...tengahJalur], awal.s);
    const ujung = tepiMenghadap(kB, tengahJalur[n - 1] ?? awal.t, tengahJalur[n - 2]);
    return n ? ruteManual(awal.t, awal.s, tengahJalur, ujung.t, ujung.s) : ortogonal([awal.t, ujung.t], awal.s, ujung.s);
  })();

  const [seretFoto, setSeretFoto] = useState(false);
  const [galatFoto, setGalatFoto] = useState('');
  const jatuhkan = async (e: React.DragEvent) => {
    e.preventDefault(); setSeretFoto(false); setGalatFoto('');
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if (!f) return;
    const p = perangkatDi(titik(e)) ?? (pilih?.jenis === 'p' ? dok.perangkat.find(x => x.id === pilih.id) : undefined);
    if (!p) { setGalatFoto('Jatuhkan foto tepat di atas perangkat di diagram.'); return; }
    try { a.pasangFotoKe(p.id, await kompresGambar(f), f.name.replace(/\.[^.]+$/, '')); a.setPilih({ jenis: 'p', id: p.id }); } catch (x) {
      setGalatFoto(x instanceof Error ? x.message : 'Foto gagal dipakai.');
    }
  };

  const pDipilih = pilih?.jenis === 'p' ? dok.perangkat.find(p => p.id === pilih.id) : undefined;
  const kDipilih = pilih?.jenis === 'k' ? geo.find(g => g.id === pilih.id) : undefined;
  const tDipilih = pilih?.jenis === 't' ? dok.teks.find(t => t.id === pilih.id) : undefined;
  const zDipilih = pilih?.jenis === 'z' ? dok.zona?.find(z => z.id === pilih.id) : undefined;
  const putarTeks = (t: TeksBebas) => { const k = kotakTeks(t); return t.putar ? `rotate(${t.putar} ${k.x + k.w / 2} ${k.y + k.h / 2})` : undefined; };
  const asal = seret?.mode === 'sambung' ? dok.perangkat.find(p => p.id === seret.dari) : undefined;
  const jalurDipilih = kDipilih && !modeGambar ? kDipilih.garis[0].titik : null;
  const simpanJalur = (id: string, baru: Titik[] | null) => { if (baru) a.ubahKabel(id, { tengah: undefined, jalur: jalurDari(baru) }); };

  return (
    <div className={`relative rounded-xl border bg-slate-200/70 ${penuh ? 'h-full' : 'aspect-video'} ${seretFoto ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
      style={{ colorScheme: 'light' }} onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setSeretFoto(true); } }}
      onDragLeave={() => setSeretFoto(false)} onDrop={e => void jatuhkan(e)}>
      {galatFoto && <p role="alert" className="absolute top-2 left-2 z-10 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-[12px] text-rose-800">{galatFoto}</p>}
      <EditorKabelBaru a={a} />
      <div ref={wadahRef} className="absolute inset-0 overflow-auto">
      <div className="min-h-full min-w-full grid place-items-center p-2">
      <svg ref={svgRef} viewBox={`0 0 ${H.w} ${H.h}`}
        style={{ width: lebarPas * zoom, height: (lebarPas * zoom * H.h) / H.w, display: 'block', background: '#fff', userSelect: 'none', WebkitUserSelect: 'none', boxShadow: '0 1px 6px rgba(15,23,42,.18)' }}
        onPointerMove={gerak} onPointerUp={lepas} onPointerCancel={() => { setSeret(null); setPanduan([]); }} role="img" aria-label="Kanvas Single Line Diagram">
        <rect width={H.w} height={H.h} fill="#fff" onDoubleClick={e => a.tambahTeks(titik(e))}
          onPointerDown={e => { tangkap(e); const t = titik(e); setSeret({ mode: 'kotak', dari: t, ke: t }); }} />
        <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: isi }} />
        {geo.map(g => (
          <g key={g.id} style={{ cursor: 'pointer' }} onPointerDown={e => { e.stopPropagation(); a.setPilih({ jenis: 'k', id: g.id }); }}>
            {g.garis.map((gr, i) => <path key={i} d={jalurBulat(gr.titik)} fill="none" stroke="transparent" strokeWidth={3} />)}
            <rect x={g.label.x - g.lebarLabel / 2} y={g.label.y - 1.6} width={g.lebarLabel} height={3.2} fill="transparent" />
          </g>
        ))}
        {(dok.zona ?? []).map(z => {
          const l = labelZona(z);
          return (
            <g key={z.id} style={{ cursor: 'move', touchAction: 'none' }} onPointerDown={e => mulaiObjek(e, z.id)}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="none" stroke="transparent" strokeWidth={Math.max(2.4, tebalZona(z) + 1.6)} pointerEvents="stroke" />
              {l.w > 0 && <rect x={l.x} y={l.y} width={l.w} height={l.h} fill="transparent" />}
            </g>
          );
        })}
        {dok.perangkat.map(p => {
          const b = area(p);
          return <rect key={p.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" style={{ cursor: 'move', touchAction: 'none' }} onPointerDown={e => mulaiObjek(e, p.id)} />;
        })}
        {dok.teks.map(t => {
          const k = kotakTeks(t);
          return <rect key={t.id} x={k.x} y={k.y} width={k.w} height={k.h} fill="transparent" transform={putarTeks(t)} style={{ cursor: 'move', touchAction: 'none' }}
            onPointerDown={e => mulaiObjek(e, t.id)} />;
        })}
        {tDipilih && (() => {
          const k = kotakTeks(tDipilih);
          return <rect x={k.x - 0.8} y={k.y - 0.8} width={k.w + 1.6} height={k.h + 1.6} fill="none" stroke={BIRU} strokeWidth={0.35} strokeDasharray="1.2 0.8"
            transform={putarTeks(tDipilih)} pointerEvents="none" />;
        })()}
        {kDipilih && kDipilih.garis.map((gr, i) => (
          <path key={i} d={jalurBulat(gr.titik)} fill="none" stroke={BIRU} strokeOpacity={0.35} strokeWidth={1.8} pointerEvents="none" />
        ))}
        {jalurDipilih && kDipilih && (
          <g>
            {jalurDipilih.slice(0, -1).map((p, k) => {
              const q = jalurDipilih[k + 1], tegak = ruasTegak(p, q), panjang = Math.hypot(q.x - p.x, q.y - p.y);
              if (panjang < 0.6 || (!tegak && Math.abs(p.y - q.y) > 0.01)) return null;
              const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
              return (
                <g key={`r${k}`} style={{ cursor: tegak ? 'ew-resize' : 'ns-resize', touchAction: 'none' }} aria-label="Seret untuk menggeser ruas kabel"
                  onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'ruas', id: kDipilih.id, awal: jalurDipilih, k, tegak }); }}
                  onDoubleClick={e => { e.stopPropagation(); simpanJalur(kDipilih.id, pecahRuas(jalurDipilih, k, titik(e))); }}>
                  <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth={2.6} />
                  {panjang >= 5 && <rect x={m.x - (tegak ? 0.9 : 1.6)} y={m.y - (tegak ? 1.6 : 0.9)} width={tegak ? 1.8 : 3.2} height={tegak ? 3.2 : 1.8} rx={0.5}
                    fill="#fff" stroke={BIRU} strokeWidth={0.4} />}
                </g>
              );
            })}
            {jalurDipilih.slice(1, -1).map((p, i) => (
              <g key={`s${i}`} style={{ cursor: 'move', touchAction: 'none' }} aria-label="Seret untuk memindah belokan kabel, klik 2x untuk menghapus"
                onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'sudut', id: kDipilih.id, awal: jalurDipilih, k: i + 1 }); }}
                onDoubleClick={e => { e.stopPropagation(); simpanJalur(kDipilih.id, hapusSudut(jalurDipilih, i + 1)); }}>
                <circle cx={p.x} cy={p.y} r={2.2} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={1.05} fill={BIRU} stroke="#fff" strokeWidth={0.35} />
              </g>
            ))}
          </g>
        )}
        {pDipilih && (() => {
          const b = area(pDipilih);
          return (
            <g>
              <rect x={b.x - 0.8} y={b.y - 0.8} width={b.w + 1.6} height={b.h + 1.6} fill="none" stroke={BIRU} strokeWidth={0.35} strokeDasharray="1.2 0.8" pointerEvents="none" />
              <rect x={pDipilih.x} y={pDipilih.y} width={pDipilih.w} height={pDipilih.h} fill="none" stroke={BIRU} strokeWidth={0.25} strokeOpacity={0.6} pointerEvents="none" />
              <rect x={pDipilih.x + pDipilih.w - 1.4} y={pDipilih.y + pDipilih.h - 1.4} width={2.8} height={2.8} fill="#fff" stroke={BIRU} strokeWidth={0.4}
                style={{ cursor: 'nwse-resize', touchAction: 'none' }} aria-label="Ubah ukuran gambar"
                onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'ukur', id: pDipilih.id, x0: pDipilih.x, y0: pDipilih.y }); }} />
              <g style={{ cursor: 'grab', touchAction: 'none' }} aria-label="Seret untuk memutar perangkat"
                onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'putar', id: pDipilih.id, cx: pDipilih.x + pDipilih.w / 2, cy: pDipilih.y + pDipilih.h / 2 }); }}>
                <line x1={pDipilih.x + pDipilih.w / 2} y1={pDipilih.y - 0.8} x2={pDipilih.x + pDipilih.w / 2} y2={pDipilih.y - 3.6} stroke={BIRU} strokeWidth={0.3} />
                <circle cx={pDipilih.x + pDipilih.w / 2} cy={pDipilih.y - 5} r={5} fill="transparent" />
                <circle cx={pDipilih.x + pDipilih.w / 2} cy={pDipilih.y - 5} r={1.5} fill="#fff" stroke={BIRU} strokeWidth={0.45} />
                {seret?.mode === 'putar' && (
                  <text x={pDipilih.x + pDipilih.w / 2 + 2.6} y={pDipilih.y - 4} fontSize={2.6} fill={BIRU} fontWeight={700}>{pDipilih.putar ?? 0}°</text>
                )}
              </g>
              <g style={{ cursor: 'crosshair', touchAction: 'none' }} aria-label="Tarik untuk menyambung kabel"
                onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'sambung', dari: pDipilih.id, titik: titik(e) }); }}>
                <circle cx={pDipilih.x + pDipilih.w + 4} cy={pDipilih.y + pDipilih.h / 2} r={6} fill="transparent" />
                <circle cx={pDipilih.x + pDipilih.w + 4} cy={pDipilih.y + pDipilih.h / 2} r={2.6} fill={BIRU} />
                <path d={`M${pDipilih.x + pDipilih.w + 2.6} ${pDipilih.y + pDipilih.h / 2} h2.8 M${pDipilih.x + pDipilih.w + 4} ${pDipilih.y + pDipilih.h / 2 - 1.4} v2.8`} stroke="#fff" strokeWidth={0.5} />
              </g>
            </g>
          );
        })()}
        {a.terpilih.length > 1 && a.terpilih.map(id => {
          const p = dok.perangkat.find(x => x.id === id), t = dok.teks.find(x => x.id === id), z = dok.zona?.find(x => x.id === id);
          const b = p ? area(p) : t ? kotakTeks(t) : z;
          return b ? <rect key={id} x={b.x - 0.8} y={b.y - 0.8} width={b.w + 1.6} height={b.h + 1.6} fill="none" stroke={BIRU} strokeWidth={0.35} strokeDasharray="1.2 0.8" pointerEvents="none" /> : null;
        })}
        {zDipilih && (
          <g>
            <rect x={zDipilih.x - 0.6} y={zDipilih.y - 0.6} width={zDipilih.w + 1.2} height={zDipilih.h + 1.2} fill="none" stroke={BIRU} strokeWidth={0.35} strokeDasharray="1.2 0.8" pointerEvents="none" />
            <rect x={zDipilih.x + zDipilih.w - 1.4} y={zDipilih.y + zDipilih.h - 1.4} width={2.8} height={2.8} fill="#fff" stroke={BIRU} strokeWidth={0.4}
              style={{ cursor: 'nwse-resize', touchAction: 'none' }} aria-label="Ubah ukuran area"
              onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'ukurZona', id: zDipilih.id, x0: zDipilih.x, y0: zDipilih.y }); }} />
          </g>
        )}
        {panduan.map((g, i) => <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#db2777" strokeWidth={0.3} strokeDasharray="1 0.7" pointerEvents="none" />)}
        {seret?.mode === 'kotak' && (() => {
          const m = kotakDari(seret.dari, seret.ke);
          return <rect x={m.x} y={m.y} width={m.w} height={m.h} fill={BIRU} fillOpacity={0.06} stroke={BIRU} strokeWidth={0.3} strokeDasharray="1 0.6" pointerEvents="none" />;
        })()}
        {asal && seret?.mode === 'sambung' && (
          <line x1={asal.x + asal.w / 2} y1={asal.y + asal.h / 2} x2={seret.titik.x} y2={seret.titik.y} stroke={BIRU} strokeWidth={0.5} strokeDasharray="1.5 1" pointerEvents="none" />
        )}
        {modeGambar && (
          <g>
            {asalGambar && (() => { const k = kotakTampak(asalGambar); return <rect x={k.x - 1} y={k.y - 1} width={k.w + 2} height={k.h + 2} fill="none" stroke={HIJAU} strokeWidth={0.5} pointerEvents="none" />; })()}
            {keTujuan && (() => { const k = kotakTampak(keTujuan); return <rect x={k.x - 1} y={k.y - 1} width={k.w + 2} height={k.h + 2} fill={BIRU} fillOpacity={0.06} stroke={BIRU} strokeWidth={0.5} pointerEvents="none" />; })()}
            {!gambar.dari && kursor && (() => {
              const p = perangkatDi(kursor);
              if (!p) return null;
              const k = kotakTampak(p);
              return <rect x={k.x - 1} y={k.y - 1} width={k.w + 2} height={k.h + 2} fill={HIJAU} fillOpacity={0.06} stroke={HIJAU} strokeWidth={0.4}
                strokeDasharray="1.2 0.8" pointerEvents="none" />;
            })()}
            {pratinjau && <path d={jalurBulat(pratinjau)} fill="none" stroke={BIRU} strokeWidth={0.55} strokeDasharray="1.5 1" pointerEvents="none" />}
            {gambar.titik.map((t, i) => <circle key={i} cx={t.x} cy={t.y} r={0.9} fill={BIRU} stroke="#fff" strokeWidth={0.3} pointerEvents="none" />)}
            <rect width={H.w} height={H.h} fill="transparent" style={{ cursor: 'crosshair', touchAction: 'none' }}
              onPointerDown={klikGambar} onPointerMove={e => setKursor(titik(e))} onPointerLeave={() => setKursor(null)} onContextMenu={e => e.preventDefault()} />
          </g>
        )}
      </svg>
      </div>
      </div>
      {!simple && (
        <div className="absolute left-2 bottom-2 z-10 flex flex-col items-start gap-1.5 pointer-events-none">
          {modeGambar && (
            <p role="status" className="max-w-[min(440px,calc(100vw-48px))] rounded-lg border border-blue-200 bg-white/95 px-3 py-1.5 text-[12px] leading-snug text-slate-700 shadow-sm">
              {!gambar.dari ? <><b>1.</b> Klik perangkat <b>asal</b> kabel.</>
                : <><b>2.</b> Klik di kanvas untuk menaruh titik belok ({gambar.titik.length}), lalu klik perangkat <b>tujuan</b>. Shift = titik bebas. Backspace / klik kanan = batalkan titik. Esc = keluar.</>}
            </p>
          )}
          <button type="button" onClick={() => setGambarKabel(!modeGambar)} aria-pressed={modeGambar}
            className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold shadow-sm transition-colors duration-150 ${
              modeGambar ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {modeGambar ? <><X size={14} /> Selesai gambar kabel</> : <><Spline size={14} /> Gambar kabel manual</>}
          </button>
        </div>
      )}
    </div>
  );
}
