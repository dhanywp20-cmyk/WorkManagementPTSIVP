'use client';
import { Ikon } from '@/components/shared/Ikon';

export function KepalaReview({ loadingBar, setShowBellPopup, jumlahAktif }: {
  loadingBar: number; setShowBellPopup: (v: boolean) => void; jumlahAktif: number;
}) {
  return (
    <div className="sticky top-0 z-50 animate-slide-down anim-d0"
      style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 0 #b45309' }}>
      {loadingBar > 0 && (
        <div className="absolute top-0 left-0 w-full h-0.5 z-[60] overflow-hidden" style={{ background: 'rgba(217,119,6,0.15)' }}>
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${loadingBar}%`,
              background: 'linear-gradient(90deg,#d97706,#fbbf24,#d97706)',
              backgroundSize: '200% 100%',
              animation: loadingBar < 100 ? 'shimmer 1.2s infinite' : 'none',
              opacity: loadingBar === 100 ? 0 : 1,
              transition: 'width 0.3s ease-out, opacity 0.3s ease-out',
            }}
          />
        </div>
      )}
      <div className="px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: '#b4530914', color: '#b45309', border: '1px solid #b4530926' }}>
          <Ikon nama="⭐" ukuran={18} />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight tracking-tight text-slate-900">Form Review Demo &amp; BAST</h1>
          <p className="text-[11px] font-medium text-slate-600">Penilaian pelanggan untuk demo & serah terima</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setShowBellPopup(true)} aria-label="Notifikasi form review"
          className="relative p-2 rounded-xl transition-all hover:bg-amber-50 border-2 border-transparent hover:border-amber-200">
          <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {jumlahAktif > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: '#f59e0b' }}>
              {jumlahAktif}
            </span>
          )}
        </button>
      </div>
    </div>
    </div>
  );
}
