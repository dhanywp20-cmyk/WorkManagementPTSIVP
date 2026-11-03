
const KARTU = '.rounded-2xl.bg-white, .rounded-xl.bg-white.border, [data-kartu3d]';
const MAKS_DERAJAT = 6;

export function pasangMiring3D(akar: HTMLElement): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!window.matchMedia('(hover: hover)').matches) return () => {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  let aktif: HTMLElement | null = null;
  let raf = 0;

  const lepas = () => {
    if (!aktif) return;
    aktif.classList.remove('kartu-miring');
    aktif.style.removeProperty('--miring-x');
    aktif.style.removeProperty('--miring-y');
    for (const v of ['--bayang-x', '--bayang-y', '--sorot-x', '--sorot-y']) aktif.style.removeProperty(v);
    aktif = null;
  };

  const gerak = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target as Element | null;
    if (!t || t.closest('[role="dialog"], .fixed')) { lepas(); return; }
    const kartu = t.closest(KARTU) as HTMLElement | null;
    if (!kartu || !akar.contains(kartu) || !kartu.closest('.isi-portal, .dasbor-3d')) { lepas(); return; }
    const r = kartu.getBoundingClientRect();
    if (r.width > 640 || r.height > 520 || kartu.querySelector('[role="dialog"], .fixed')) { lepas(); return; }
    if (aktif !== kartu) { lepas(); aktif = kartu; kartu.classList.add('kartu-miring'); }
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      kartu.style.setProperty('--miring-x', `${(-y * MAKS_DERAJAT * 2).toFixed(2)}deg`);
      kartu.style.setProperty('--miring-y', `${(x * MAKS_DERAJAT * 2).toFixed(2)}deg`);
      kartu.style.setProperty('--bayang-x', `${(-x * 18).toFixed(1)}px`);
      kartu.style.setProperty('--bayang-y', `${(14 - y * 12).toFixed(1)}px`);
      kartu.style.setProperty('--sorot-x', `${((x + 0.5) * 100).toFixed(1)}%`);
      kartu.style.setProperty('--sorot-y', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
  };

  akar.addEventListener('pointermove', gerak, { passive: true });
  akar.addEventListener('pointerleave', lepas);
  return () => {
    cancelAnimationFrame(raf);
    lepas();
    akar.removeEventListener('pointermove', gerak);
    akar.removeEventListener('pointerleave', lepas);
  };
}
