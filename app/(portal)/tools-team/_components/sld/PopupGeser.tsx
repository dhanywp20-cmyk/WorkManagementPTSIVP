'use client';
import { useEffect, useRef, useState, type PointerEvent as PE, type ReactNode } from 'react';
import { GripHorizontal, Maximize2, Minus, RotateCcw } from 'lucide-react';

type Posisi = { x: number; y: number } | null;
const KUNCI = 'tools-team-sld-popup';
const tombol = 'w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800';

function muat(): { pos: Posisi; kecil: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI) ?? 'null') as { pos?: Posisi; kecil?: boolean } | null;
    const p = v?.pos;
    return { pos: p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null, kecil: !!v?.kecil };
  } catch { return { pos: null, kecil: false }; }
}

function simpan(pos: Posisi, kecil: boolean) {
  try { localStorage.setItem(KUNCI, JSON.stringify({ pos, kecil })); } catch { return; }
}

export function PopupGeser({ buka, judul, className, children }: { buka: boolean; judul: string; className: string; children: ReactNode }) {
  const kotak = useRef<HTMLDivElement>(null);
  const seret = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<Posisi>(null);
  const [kecil, setKecil] = useState(false);
  const posRef = useRef<Posisi>(null);

  const batasi = (x: number, y: number) => {
    const el = kotak.current, induk = el?.offsetParent as HTMLElement | null;
    if (!el || !induk) return { x, y };
    return { x: Math.min(Math.max(0, x), Math.max(0, induk.clientWidth - el.offsetWidth)), y: Math.min(Math.max(0, y), Math.max(0, induk.clientHeight - 40)) };
  };
  const pasang = (p: Posisi) => { posRef.current = p; setPos(p); };

  useEffect(() => {
    const v = muat();
    posRef.current = v.pos;
    setPos(v.pos);
    setKecil(v.kecil);
    const ulang = () => { const p = posRef.current; if (p) pasang(batasi(p.x, p.y)); };
    window.addEventListener('resize', ulang);
    return () => window.removeEventListener('resize', ulang);
  }, []);

  const mulai = (e: PE<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || !kotak.current) return;
    seret.current = { dx: e.clientX - kotak.current.offsetLeft, dy: e.clientY - kotak.current.offsetTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const gerak = (e: PE<HTMLDivElement>) => { if (seret.current) pasang(batasi(e.clientX - seret.current.dx, e.clientY - seret.current.dy)); };
  const lepas = () => { if (!seret.current) return; seret.current = null; simpan(posRef.current, kecil); };
  const ubahKecil = () => { const k = !kecil; setKecil(k); simpan(posRef.current, k); };
  const reset = () => { pasang(null); simpan(null, kecil); };

  return (
    <div ref={kotak} inert={!buka} style={pos ? { left: pos.x, top: pos.y, right: 'auto', maxHeight: `calc(100% - ${Math.round(pos.y) + 8}px)` } : undefined}
      className={`${className} bg-white border border-slate-200 [&>div>section]:border-0 [&>div>section]:rounded-none ${buka ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}>
      <div onPointerDown={mulai} onPointerMove={gerak} onPointerUp={lepas} onPointerCancel={lepas} title="Seret untuk memindahkan panel"
        className="sticky top-0 z-10 flex items-center gap-1.5 pl-2.5 pr-1 h-9 bg-slate-50 border-b border-slate-200 cursor-grab active:cursor-grabbing touch-none select-none">
        <GripHorizontal size={16} className="text-slate-400" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{judul}</span>
        <span className="ml-auto flex items-center">
          {pos && <button type="button" onClick={reset} className={tombol} aria-label="Kembalikan panel ke pojok kanan atas" title="Kembalikan ke pojok kanan atas"><RotateCcw size={14} /></button>}
          <button type="button" onClick={ubahKecil} className={tombol} aria-label={kecil ? 'Tampilkan isi panel' : 'Kecilkan panel'} aria-expanded={!kecil} title={kecil ? 'Tampilkan isi' : 'Kecilkan'}>
            {kecil ? <Maximize2 size={14} /> : <Minus size={16} />}
          </button>
        </span>
      </div>
      <div hidden={kecil}>{children}</div>
    </div>
  );
}
