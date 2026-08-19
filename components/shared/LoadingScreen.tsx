'use client';

/**
 * Shared full-screen loading overlay.
 * accentColor default merah - bisa di-override per platform.
 */
export function LoadingScreen({
  message = 'Loading...',
  accentColor = '#dc2626',
}: {
  message?: string;
  accentColor?: string;
}) {
  return (
    // role="status": keadaan "sedang memuat" harus terdengar, bukan hanya
    // terlihat berputar. aria-busy memberi tahu bahwa isinya belum final.
    <div role="status" aria-live="polite" aria-busy="true"
      className="fixed inset-0 flex items-center justify-center z-[1000]"
      style={{ backgroundImage: `url('/IVP_Background.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.25)' }} />
      <div className="relative z-10 flex flex-col items-center gap-3 px-10 py-8 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <svg className="w-12 h-12 animate-spin" viewBox="0 0 50 50" fill="none" aria-hidden="true" focusable="false">
          <circle cx="25" cy="25" r="20" stroke="#f1f1f1" strokeWidth="5" />
          <path d="M25 5 A20 20 0 0 1 45 25" stroke={accentColor} strokeWidth="5" strokeLinecap="round" />
        </svg>
        <p className="text-gray-700 font-semibold text-sm tracking-wide">{message}</p>
      </div>
    </div>
  );
}

/**
 * Inline spinner (small, untuk di-embed dalam table/loading state)
 */
export function InlineSpinner({ accentColor = '#dc2626', label = 'Memuat data...' }: { accentColor?: string; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full animate-spin" aria-hidden="true" style={{ border: '3px solid #fde68a', borderTopColor: accentColor }} />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
    </div>
  );
}
