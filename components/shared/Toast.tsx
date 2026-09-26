'use client';

import { CircleCheck, CircleX, TriangleAlert, Info } from 'lucide-react';

/**
 * Shared Toast notification - pattern standar untuk semua platform.
 * Caller manages state: const [notif, setNotif] = useState<Notif|null>(null);
 *   setNotif({type, msg}); setTimeout(()=>setNotif(null), 3500);
 */

export interface Notif {
  type: 'success' | 'error' | 'info' | 'warning';
  msg: string;
}

const GAYA_TOAST: Record<Notif['type'], { latar: string; teks: string; garis: string; Ikon: typeof CircleCheck }> = {
  success: { latar: '#ecfdf5', teks: '#065f46', garis: '#a7f3d0', Ikon: CircleCheck },
  error:   { latar: '#fef2f2', teks: '#991b1b', garis: '#fecaca', Ikon: CircleX },
  warning: { latar: '#fffbeb', teks: '#92400e', garis: '#fde68a', Ikon: TriangleAlert },
  info:    { latar: '#eff6ff', teks: '#1e40af', garis: '#bfdbfe', Ikon: Info },
};

/**
 * Toast SATU-SATUNYA di platform. Dulu enam halaman merakit toast sendiri
 * (hijau pekat, merah pekat, pastel - posisi & ukuran berbeda). Di ponsel
 * tampil selebar layar di atas, bukan kotak kecil yang tertimpa di pojok.
 */
export function Toast({ notif }: { notif: Notif | null }) {
  if (!notif) return null;
  const g = GAYA_TOAST[notif.type] ?? GAYA_TOAST.info;
  return (
    // role="status" + aria-live: pesan ini muncul tanpa dipicu fokus, jadi
    // tanpa penanda ini pembaca layar tidak pernah menyebutkannya sama sekali.
    <div role="status" aria-live="polite" aria-atomic="true"
      className="fixed top-3 left-3 right-3 sm:left-auto sm:top-4 sm:right-4 sm:max-w-sm z-[3000] px-4 py-3 rounded-xl text-sm font-semibold flex items-start gap-2.5 animate-slide-down"
      style={{ background: g.latar, color: g.teks, border: `1px solid ${g.garis}`, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
      <g.Ikon size={18} aria-hidden="true" className="flex-shrink-0 mt-px" />
      <span className="leading-snug">{notif.msg}</span>
    </div>
  );
}

export function InlineToast({ notif }: { notif: Notif | null }) {
  if (!notif) return null;
  return (
    <div role="status" aria-live="polite" aria-atomic="true"
      className={`mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-semibold flex gap-2 ${notif.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
      {notif.type === 'success' ? <CircleCheck size={16} aria-hidden="true" className="flex-shrink-0 mt-0.5" /> : <CircleX size={16} aria-hidden="true" className="flex-shrink-0 mt-0.5" />}
      <span>{notif.msg}</span>
    </div>
  );
}
