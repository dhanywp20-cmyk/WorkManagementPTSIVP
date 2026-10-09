'use client';

/** PopupNotifikasiReview - dipecah dari app/(portal)/form-review/_components/FormReviewPageInner.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ReviewForm } from './shared';

export interface PopupNotifikasiReviewProps {
  isTeam: boolean;
  myPendingReviews: ReviewForm[];
  setDetailReview: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
  setShowNotificationPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showNotificationPopup: boolean;
}

export function PopupNotifikasiReview({ isTeam, myPendingReviews, setDetailReview, setShowNotificationPopup, showNotificationPopup }: PopupNotifikasiReviewProps) {
  return (
    <>
      {showNotificationPopup && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-full overflow-hidden flex flex-col border-4 border-yellow-400"
            style={{ animation: 'scale-in 0.3s ease-out' }}>
            <div className="p-5 border-b-2 border-yellow-300 flex-shrink-0" style={{ background: isTeam ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl animate-bounce">{isTeam ? '⭐' : '🔔'}</span>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {isTeam ? 'Review Belum Diisi Guest' : 'Review Menunggu Kamu'}
                    </h3>
                    <p className="text-sm text-white/90">
                      {isTeam
                        ? `${myPendingReviews.length} jadwal kamu belum di-review oleh Guest`
                        : `${myPendingReviews.length} form review yang perlu kamu isi`}
                    </p>
                  </div>
                </div>
                <button aria-label="Tutup" onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {myPendingReviews.map(r => (
                <div key={r.id} {...bisaDiklik(() => { setDetailReview(r); setShowNotificationPopup(false); })}
                  className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                  style={{ background: 'rgba(249,250,251,0.9)', borderColor: '#e5e7eb' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-violet-700"
                          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                          {r.review_category === 'Demo Product' ? '🖥️' : '📌'} {r.review_category}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-gray-800 truncate">{r.project_name || '—'}</p>
                      {r.address && <p className="text-xs text-gray-500 mt-0.5"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.address}</p>}
                      {isTeam && r.sales_name && (
                        <p className="text-xs text-violet-600 font-semibold mt-0.5"><IkonTeks nama="👤" />Guest: {r.sales_name}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-amber-700"
                        style={{ background: '#fef3c7', border: '1px solid #f59e0b' }}><IkonTeks nama="⏳" />Belum Diisi</span>
                      <p className="text-[11px] text-gray-500 mt-1">{isTeam ? r.sales_name : r.assign_name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t-2 border-gray-200 bg-gray-50 flex-shrink-0">
              <button onClick={() => setShowNotificationPopup(false)}
                className="w-full text-white py-3 rounded-xl font-bold transition-all"
                style={{ background: isTeam ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                ✕ Tutup
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
