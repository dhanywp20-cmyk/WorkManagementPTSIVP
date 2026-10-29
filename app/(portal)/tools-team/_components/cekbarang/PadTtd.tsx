'use client';
/**
 * Pad tanda tangan (mouse / jari / stylus). Hasil = PNG data URL; kosong = tanda tangan basah setelah dicetak.
 * Kanvas mengikuti lebar kotak x devicePixelRatio, isi digambar ulang saat ukuran / nilai dari luar berubah.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';

const TINTA = '#1e3a8a';

export function PadTtd({ nilai, onUbah, label }: { nilai: string; onUbah: (v: string) => void; label: string }) {
  const kanvas = useRef<HTMLCanvasElement>(null);
  const gores = useRef<{ x: number; y: number } | null>(null);
  //  Nilai terakhir yang berasal dari kanvas ini sendiri - tidak perlu digambar ulang.
  const milikSendiri = useRef(nilai);

  const gambarNilai = useCallback((src: string) => {
    const c = kanvas.current, g = c?.getContext('2d');
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const s = Math.min(c.width / img.width, c.height / img.height);
      g.drawImage(img, (c.width - img.width * s) / 2, (c.height - img.height * s) / 2, img.width * s, img.height * s);
    };
    img.src = src;
  }, []);

  useEffect(() => {
    const c = kanvas.current;
    if (!c) return;
    const atur = () => {
      const r = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (!w || !h || (c.width === w && c.height === h)) return;
      c.width = w; c.height = h;
      gambarNilai(milikSendiri.current);
    };
    atur();
    const ro = new ResizeObserver(atur);
    ro.observe(c);
    return () => ro.disconnect();
  }, [gambarNilai]);

  useEffect(() => {
    if (nilai === milikSendiri.current) return;
    milikSendiri.current = nilai;
    gambarNilai(nilai);
  }, [nilai, gambarNilai]);

  const titik = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const garis = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const c = kanvas.current, g = c?.getContext('2d');
    if (!c || !g) return;
    g.strokeStyle = TINTA; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 2.4 * (c.width / Math.max(1, c.getBoundingClientRect().width));
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x + 0.01, b.y + 0.01); g.stroke();
  };
  const selesai = () => {
    if (!gores.current || !kanvas.current) return;
    gores.current = null;
    const v = kanvas.current.toDataURL('image/png');
    milikSendiri.current = v;
    onUbah(v);
  };

  return (
    <div className="relative">
      <canvas ref={kanvas} aria-label={`Kotak tanda tangan ${label}`} role="img"
        className="block w-full h-28 rounded-xl border border-dashed border-slate-300 bg-white touch-none cursor-crosshair"
        onPointerDown={e => { if (e.button > 0) return; e.currentTarget.setPointerCapture(e.pointerId); const p = titik(e); gores.current = p; garis(p, p); }}
        onPointerMove={e => { if (!gores.current) return; const p = titik(e); garis(gores.current, p); gores.current = p; }}
        onPointerUp={selesai} onPointerCancel={selesai} />
      {!nilai && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[12px] text-slate-400">Tanda tangan di sini (opsional)</span>}
      {nilai && (
        <button type="button" onClick={() => { milikSendiri.current = ''; gambarNilai(''); onUbah(''); }}
          className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white/90 border border-slate-200 text-slate-600 hover:text-rose-700">
          <Eraser size={12} /> Hapus
        </button>
      )}
    </div>
  );
}
