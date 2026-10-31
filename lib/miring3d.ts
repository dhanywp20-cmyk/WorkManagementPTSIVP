/**
 * lib/miring3d.ts - kartu condong 3D mengikuti kursor, untuk SELURUH menu (permintaan pemilik: tema 3D,
 * tampilan lain tetap). Satu pendengar di akar (delegasi), bukan kode di tiap kartu.
 *
 * - Hanya kartu di area modul (.isi-portal) dan beranda (.dasbor-3d) - bukan layar masuk / popup.
 * - Kartu = pola kartu platform (rounded-2xl putih, panel rounded-xl putih bergaris) atau elemen bertanda
 *   [data-kartu3d] (StatCard, MiniPieChart). Hanya kartu SEDANG (<= 640 x 520 px): panel besar seperti
 *   tabel tidak dimiringkan supaya isinya tetap tenang dibaca.
 * - `transform` menjadikan kartu "containing block" bagi elemen `fixed` di dalamnya. Karena itu kartu yang
 *   sedang memuat popup / elemen fixed, atau kursor yang berada DI DALAM popup, tidak pernah dimiringkan.
 * - Bayangan bergeser berlawanan arah condong (--bayang-x/y) & sorot cahaya mengikuti kursor (--sorot-x/y).
 * - Hanya perangkat berkursor (hover: hover) dan bila gerak tidak diminta dikurangi.
 */

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
    //  Kursor di dalam popup / elemen fixed: jangan sentuh kartu induknya sama sekali.
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
      //  Bayangan jatuh ke arah BERLAWANAN dari sisi yang terangkat; sorot cahaya mengikuti kursor.
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
