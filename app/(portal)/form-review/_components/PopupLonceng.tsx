'use client';

/** PopupLonceng - review aktif dari ikon lonceng. Semua keadaan tetap milik induk. Wujud sama dengan PopupNotifikasiReview. */
import { ReviewForm } from './shared';
import { DaftarReviewTertunda } from './PopupNotifikasiReview';

export interface PopupLoncengProps {
  isTeam: boolean;
  myActivePendingReviews: ReviewForm[];
  setDetailReview: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
  setShowBellPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showBellPopup: boolean;
}

export function PopupLonceng({ isTeam, myActivePendingReviews, setDetailReview, setShowBellPopup, showBellPopup }: PopupLoncengProps) {
  if (!showBellPopup) return null;
  return (
    <DaftarReviewTertunda reviews={myActivePendingReviews} isTeam={isTeam}
      judul={isTeam ? 'Review Belum Diisi Guest' : 'Review Aktif Kamu'}
      keterangan={`${myActivePendingReviews.length} belum diisi`}
      kosong={isTeam ? 'Semua Guest sudah mengisi review' : 'Semua review sudah diisi'}
      onBuka={r => { setDetailReview(r); setShowBellPopup(false); }} onTutup={() => setShowBellPopup(false)} />
  );
}
