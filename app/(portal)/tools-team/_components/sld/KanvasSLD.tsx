'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hurufPerangkat, sudutSah } from '@/lib/sld/geometri';
import { jalurBulat, barisLabel, isiLembar1 } from '@/lib/sld/lembar1';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { lebarTeks } from '@/lib/sld/teks';
import { kotakTeks } from '@/lib/sld/teks-bebas';
import { halamanDok, type Perangkat, type TeksBebas, type Titik, UKURAN_MIN } from '@/lib/sld/tipe';
import { EditorKabelBaru } from './EditorKabelBaru';
import { kompresGambar } from './gambar';
import type { KeadaanSLD } from './useKeadaanSLD';

type Seret =
  | { mode: 'pindah'; id: string; dx: number; dy: number }
  | { mode: 'ukur'; id: string; x0: number; y0: number }
  | { mode: 'sambung'; dari: string; titik: Titik }
  | { mode: 'tengah'; id: string; vertikal: boolean }
  | { mode: 'putar'; id: string; cx: number; cy: number }
  | { mode: 'teks'; id: string; dx: number; dy: number };

const BIRU = '#2563eb';
const snap = (v: number) => Math.round(v * 2) / 2;

export function areaLabel(p: Perangkat, f = 1) {
  const b = barisLabel(p, f);
  const h = b.reduce((s, x) => s + x.ukuran * 1.32, 0);
  const w = Math.max(p.w, ...b.map(x => lebarTeks(x.isi, x.ukuran, x.tebal) + 1));
  return { x: p.x, y: p.y, w, h: p.h + 3 + h };
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

  const mulaiPindah = (e: React.PointerEvent, p: Perangkat) => {
    e.stopPropagation(); tangkap(e);
    const t = titik(e);
    a.setPilih({ jenis: 'p', id: p.id });
    setSeret({ mode: 'pindah', id: p.id, dx: t.x - p.x, dy: t.y - p.y });
  };
  const mulaiTeks = (e: React.PointerEvent, t: TeksBebas) => {
    e.stopPropagation(); tangkap(e);
    const p = titik(e);
    a.setPilih({ jenis: 't', id: t.id });
    setSeret({ mode: 'teks', id: t.id, dx: p.x - t.x, dy: p.y - t.y });
  };
  const gerak = (e: React.PointerEvent) => {
    if (!seret) return;
    const t = titik(e);
    if (seret.mode === 'pindah') a.ubahPerangkat(seret.id, { x: snap(t.x - seret.dx), y: snap(t.y - seret.dy) });
    else if (seret.mode === 'ukur') a.ubahPerangkat(seret.id, { w: Math.max(UKURAN_MIN.w, snap(t.x - seret.x0)), h: Math.max(UKURAN_MIN.h, snap(t.y - seret.y0)) });
    else if (seret.mode === 'sambung') setSeret({ ...seret, titik: t });
    else if (seret.mode === 'teks') a.ubahTeks(seret.id, { x: snap(t.x - seret.dx), y: snap(t.y - seret.dy) });
    else if (seret.mode === 'putar') {
      const sudut = (Math.atan2(t.y - seret.cy, t.x - seret.cx) * 180) / Math.PI + 90;
      a.ubahPerangkat(seret.id, { putar: sudutSah(e.shiftKey ? sudut : Math.round(sudut / 15) * 15) || undefined });
    }
    else a.ubahKabel(seret.id, { tengah: snap(seret.vertikal ? t.x : t.y) });
  };
  const lepas = (e: React.PointerEvent) => {
    if (seret?.mode === 'sambung') {
      const tujuan = perangkatDi(titik(e));
      if (tujuan && tujuan.id !== seret.dari) a.hubungkan(seret.dari, tujuan.id);
    }
    setSeret(null);
  };

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
  const putarTeks = (t: TeksBebas) => { const k = kotakTeks(t); return t.putar ? `rotate(${t.putar} ${k.x + k.w / 2} ${k.y + k.h / 2})` : undefined; };
  const asal = seret?.mode === 'sambung' ? dok.perangkat.find(p => p.id === seret.dari) : undefined;
  const tengah = kDipilih && kDipilih.garis[0].titik.length === 4 ? kDipilih.garis[0].titik : null;

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
        onPointerMove={gerak} onPointerUp={lepas} onPointerCancel={() => setSeret(null)} role="img" aria-label="Kanvas Single Line Diagram">
        <rect width={H.w} height={H.h} fill="#fff" onPointerDown={() => a.setPilih(null)} onDoubleClick={e => a.tambahTeks(titik(e))} />
        <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: isi }} />
        {geo.map(g => (
          <g key={g.id} style={{ cursor: 'pointer' }} onPointerDown={e => { e.stopPropagation(); a.setPilih({ jenis: 'k', id: g.id }); }}>
            {g.garis.map((gr, i) => <path key={i} d={jalurBulat(gr.titik)} fill="none" stroke="transparent" strokeWidth={3} />)}
            <rect x={g.label.x - g.lebarLabel / 2} y={g.label.y - 1.6} width={g.lebarLabel} height={3.2} fill="transparent" />
          </g>
        ))}
        {dok.perangkat.map(p => {
          const b = area(p);
          return <rect key={p.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" style={{ cursor: 'move', touchAction: 'none' }} onPointerDown={e => mulaiPindah(e, p)} />;
        })}
        {dok.teks.map(t => {
          const k = kotakTeks(t);
          return <rect key={t.id} x={k.x} y={k.y} width={k.w} height={k.h} fill="transparent" transform={putarTeks(t)} style={{ cursor: 'move', touchAction: 'none' }}
            onPointerDown={e => mulaiTeks(e, t)} />;
        })}
        {tDipilih && (() => {
          const k = kotakTeks(tDipilih);
          return <rect x={k.x - 0.8} y={k.y - 0.8} width={k.w + 1.6} height={k.h + 1.6} fill="none" stroke={BIRU} strokeWidth={0.35} strokeDasharray="1.2 0.8"
            transform={putarTeks(tDipilih)} pointerEvents="none" />;
        })()}
        {kDipilih && kDipilih.garis.map((gr, i) => (
          <path key={i} d={jalurBulat(gr.titik)} fill="none" stroke={BIRU} strokeOpacity={0.35} strokeWidth={1.8} pointerEvents="none" />
        ))}
        {tengah && (() => {
          const vertikal = Math.abs(tengah[1].x - tengah[2].x) < 0.01;
          const m = { x: (tengah[1].x + tengah[2].x) / 2, y: (tengah[1].y + tengah[2].y) / 2 };
          return <rect x={m.x - 1.4} y={m.y - 1.4} width={2.8} height={2.8} rx={0.4} fill="#fff" stroke={BIRU} strokeWidth={0.4}
            style={{ cursor: vertikal ? 'ew-resize' : 'ns-resize', touchAction: 'none' }} aria-label="Geser jalur kabel"
            onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'tengah', id: kDipilih!.id, vertikal }); }} />;
        })()}
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
        {asal && seret?.mode === 'sambung' && (
          <line x1={asal.x + asal.w / 2} y1={asal.y + asal.h / 2} x2={seret.titik.x} y2={seret.titik.y} stroke={BIRU} strokeWidth={0.5} strokeDasharray="1.5 1" pointerEvents="none" />
        )}
      </svg>
      </div>
      </div>
    </div>
  );
}
