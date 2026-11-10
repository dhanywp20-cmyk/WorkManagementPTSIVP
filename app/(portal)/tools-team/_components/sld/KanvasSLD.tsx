'use client';
import { useMemo, useRef, useState } from 'react';
import { jalurBulat, barisLabel, isiLembar1 } from '@/lib/sld/lembar1';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { lebarTeks } from '@/lib/sld/teks';
import { HALAMAN, type Perangkat, type Titik, UKURAN_MIN } from '@/lib/sld/tipe';
import type { KeadaanSLD } from './useKeadaanSLD';

type Seret =
  | { mode: 'pindah'; id: string; dx: number; dy: number }
  | { mode: 'ukur'; id: string; x0: number; y0: number }
  | { mode: 'sambung'; dari: string; titik: Titik }
  | { mode: 'tengah'; id: string; vertikal: boolean };

const BIRU = '#2563eb';
const snap = (v: number) => Math.round(v * 2) / 2;

export function areaLabel(p: Perangkat) {
  const b = barisLabel(p);
  const h = b.reduce((s, x) => s + x.ukuran * 1.32, 0);
  const w = Math.max(p.w, ...b.map(x => lebarTeks(x.isi, x.ukuran, x.tebal) + 1));
  return { x: p.x, y: p.y, w, h: p.h + 3 + h };
}

export function KanvasSLD({ a, zoom }: { a: KeadaanSLD; zoom: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [seret, setSeret] = useState<Seret | null>(null);
  const { dok, geo, pilih } = a;
  const isi = useMemo(() => isiLembar1(dok, { watermark: WATERMARK_BAWAAN }, geo), [dok, geo]);

  const titik = (e: React.PointerEvent): Titik => {
    const s = svgRef.current, m = s?.getScreenCTM();
    if (!s || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const tangkap = (e: React.PointerEvent) => { try { svgRef.current?.setPointerCapture(e.pointerId); } catch {  } };
  const perangkatDi = (t: Titik) => [...dok.perangkat].reverse().find(p => {
    const b = areaLabel(p);
    return t.x >= b.x && t.x <= b.x + b.w && t.y >= b.y && t.y <= b.y + b.h;
  });

  const mulaiPindah = (e: React.PointerEvent, p: Perangkat) => {
    e.stopPropagation(); tangkap(e);
    const t = titik(e);
    a.setPilih({ jenis: 'p', id: p.id });
    setSeret({ mode: 'pindah', id: p.id, dx: t.x - p.x, dy: t.y - p.y });
  };
  const gerak = (e: React.PointerEvent) => {
    if (!seret) return;
    const t = titik(e);
    if (seret.mode === 'pindah') a.ubahPerangkat(seret.id, { x: snap(t.x - seret.dx), y: snap(t.y - seret.dy) });
    else if (seret.mode === 'ukur') a.ubahPerangkat(seret.id, { w: Math.max(UKURAN_MIN.w, snap(t.x - seret.x0)), h: Math.max(UKURAN_MIN.h, snap(t.y - seret.y0)) });
    else if (seret.mode === 'sambung') setSeret({ ...seret, titik: t });
    else a.ubahKabel(seret.id, { tengah: snap(seret.vertikal ? t.x : t.y) });
  };
  const lepas = (e: React.PointerEvent) => {
    if (seret?.mode === 'sambung') {
      const tujuan = perangkatDi(titik(e));
      if (tujuan && tujuan.id !== seret.dari) a.hubungkan(seret.dari, tujuan.id);
    }
    setSeret(null);
  };

  const pDipilih = pilih?.jenis === 'p' ? dok.perangkat.find(p => p.id === pilih.id) : undefined;
  const kDipilih = pilih?.jenis === 'k' ? geo.find(g => g.id === pilih.id) : undefined;
  const asal = seret?.mode === 'sambung' ? dok.perangkat.find(p => p.id === seret.dari) : undefined;
  const tengah = kDipilih && kDipilih.garis[0].titik.length === 4 ? kDipilih.garis[0].titik : null;

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 max-h-[78vh]" style={{ colorScheme: 'light' }}>
      <svg ref={svgRef} viewBox={`0 0 ${HALAMAN.w} ${HALAMAN.h}`} style={{ width: `${zoom * 100}%`, minWidth: zoom * 640, display: 'block', background: '#fff', userSelect: 'none', WebkitUserSelect: 'none' }}
        onPointerMove={gerak} onPointerUp={lepas} onPointerCancel={() => setSeret(null)} role="img" aria-label="Kanvas Single Line Diagram">
        <rect width={HALAMAN.w} height={HALAMAN.h} fill="#fff" onPointerDown={() => a.setPilih(null)} />
        <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: isi }} />
        {geo.map(g => (
          <g key={g.id} style={{ cursor: 'pointer' }} onPointerDown={e => { e.stopPropagation(); a.setPilih({ jenis: 'k', id: g.id }); }}>
            {g.garis.map((gr, i) => <path key={i} d={jalurBulat(gr.titik)} fill="none" stroke="transparent" strokeWidth={3} />)}
            <rect x={g.label.x - g.lebarLabel / 2} y={g.label.y - 1.6} width={g.lebarLabel} height={3.2} fill="transparent" />
          </g>
        ))}
        {dok.perangkat.map(p => {
          const b = areaLabel(p);
          return <rect key={p.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" style={{ cursor: 'move', touchAction: 'none' }} onPointerDown={e => mulaiPindah(e, p)} />;
        })}
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
          const b = areaLabel(pDipilih);
          return (
            <g>
              <rect x={b.x - 0.8} y={b.y - 0.8} width={b.w + 1.6} height={b.h + 1.6} fill="none" stroke={BIRU} strokeWidth={0.35} strokeDasharray="1.2 0.8" pointerEvents="none" />
              <rect x={pDipilih.x} y={pDipilih.y} width={pDipilih.w} height={pDipilih.h} fill="none" stroke={BIRU} strokeWidth={0.25} strokeOpacity={0.6} pointerEvents="none" />
              <rect x={pDipilih.x + pDipilih.w - 1.4} y={pDipilih.y + pDipilih.h - 1.4} width={2.8} height={2.8} fill="#fff" stroke={BIRU} strokeWidth={0.4}
                style={{ cursor: 'nwse-resize', touchAction: 'none' }} aria-label="Ubah ukuran gambar"
                onPointerDown={e => { e.stopPropagation(); tangkap(e); setSeret({ mode: 'ukur', id: pDipilih.id, x0: pDipilih.x, y0: pDipilih.y }); }} />
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
  );
}
