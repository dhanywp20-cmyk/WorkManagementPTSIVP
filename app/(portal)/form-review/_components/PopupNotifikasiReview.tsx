'use client';

/**
 * PopupNotifikasiReview - review yang belum diisi. Semua keadaan tetap milik induk. Kerangka: Modal bersama
 * (dulu kepala ungu/kuning sendiri). DaftarReviewTertunda dipakai juga oleh PopupLonceng.
 */
import { Modal, TombolModal } from '@/components/shared';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { ReviewForm } from './shared';

export interface PopupNotifikasiReviewProps {
  isTeam: boolean;
  myPendingReviews: ReviewForm[];
  setDetailReview: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
  setShowNotificationPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showNotificationPopup: boolean;
}

/** Popup daftar review yang belum diisi - satu wujud untuk popup otomatis & lonceng. */
export function DaftarReviewTertunda({ judul, keterangan, kosong, reviews, isTeam, onBuka, onTutup }: {
  judul: string; keterangan: string; kosong: string; reviews: ReviewForm[]; isTeam: boolean;
  onBuka: (r: ReviewForm) => void; onTutup: () => void;
}) {
  return (
    <Modal buka onTutup={onTutup} judul={judul} keterangan={keterangan} footer={<TombolModal onClick={onTutup}>Tutup</TombolModal>}>
      {reviews.length === 0 ? (
        <p className="text-center py-10 text-slate-500 font-semibold">{kosong}</p>
      ) : (
        <div className="space-y-2">
          {reviews.map(r => (
            <div key={r.id} {...bisaDiklik(() => onBuka(r))}
              className="rounded-kontrol p-3 border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 mb-1">{r.review_category}</span>
                  <p className="font-bold text-sm text-slate-800 truncate">{r.project_name || '—'}</p>
                  {r.address && <p className="text-xs text-slate-500 mt-0.5">{r.address}</p>}
                  {isTeam && r.sales_name && <p className="text-xs text-slate-600 font-semibold mt-0.5">Guest: {r.sales_name}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Belum diisi</span>
                  <p className="text-[11px] text-slate-500 mt-1">{isTeam ? r.sales_name : r.assign_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function PopupNotifikasiReview({ isTeam, myPendingReviews, setDetailReview, setShowNotificationPopup, showNotificationPopup }: PopupNotifikasiReviewProps) {
  if (!showNotificationPopup) return null;
  return (
    <DaftarReviewTertunda reviews={myPendingReviews} isTeam={isTeam}
      judul={isTeam ? 'Review Belum Diisi Guest' : 'Review Menunggu Kamu'}
      keterangan={isTeam ? `${myPendingReviews.length} jadwal kamu belum di-review oleh Guest` : `${myPendingReviews.length} form review yang perlu kamu isi`}
      kosong={isTeam ? 'Semua Guest sudah mengisi review' : 'Semua review sudah diisi'}
      onBuka={r => { setDetailReview(r); setShowNotificationPopup(false); }} onTutup={() => setShowNotificationPopup(false)} />
  );
}
