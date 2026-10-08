'use client';

/** AlurDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { FlowSteps } from '@/components/shared';
import { ProjectRequest } from '../shared';

export interface AlurDetailProps {
  detailRoomAssignName: string | undefined;
  detailRoomStatus: "pending" | "approved" | "in_progress" | "completed" | "rejected" | undefined;
  getCCLabel: (req: ProjectRequest) => string;
  selectedRequest: ProjectRequest;
}

export function AlurDetail({ detailRoomAssignName, detailRoomStatus, getCCLabel, selectedRequest }: AlurDetailProps) {
  return (
    <>
      <div className="mt-4">
        {(() => {
          // Alur ini per-ruangan (detailRoomStatus/detailRoomAssignName), bukan
          // status request langsung - lihat getRoomStatus() di shared.ts. Tiga
          // tahap pertama (Diajukan/Diteruskan/Di-assign) masih dibaca dari
          // request karena tahap itu memang terjadi sebelum ruangan mana pun
          // punya progres sendiri-sendiri.
          const st = detailRoomStatus;
          const batal = st === 'rejected';
          // 0 Diajukan · 1 Diteruskan(Sales Internal) · 2 Di-assign(Admin)
          // 3 Dikerjakan(Team PTS) · 4 Selesai · 5 = seluruh tahap tuntas
          const aktif = st === 'completed' ? 5
            : (st === 'in_progress' || detailRoomAssignName) ? 3
            : selectedRequest.routing_status === 'internal_review' ? 1
            : 2;
          // Nama Sales Internal-nya, bukan label generik. Dua sumber,
          // sesuai bagaimana request masuk: reviewer hasil mapping brand
          // IVP/MVI (dua nama saat brand BOTH - keduanya wajib approve),
          // atau pembuatnya sendiri bila request memang dibuat oleh Sales
          // Internal (tahap ini langsung terlewati ke admin_review).
          const ccLabel = getCCLabel(selectedRequest);
          const pelakuInternal = ccLabel
            || (selectedRequest.requester_name && selectedRequest.sales_name !== selectedRequest.requester_name
              ? selectedRequest.requester_name : '')
            || 'Sales Internal';
          return (
            <FlowSteps
              judul="Alur Request"
              aktif={aktif}
              dibatalkan={batal}
              steps={[
                { label: 'Diajukan',   pelaku: selectedRequest.sales_name || selectedRequest.requester_name || 'Sales' },
                { label: 'Diteruskan', pelaku: pelakuInternal },
                { label: 'Di-assign',  pelaku: 'Admin' },
                { label: 'Dikerjakan', pelaku: detailRoomAssignName || 'Team PTS' },
                { label: 'Selesai',    pelaku: 'Completed' },
              ]}
            />
          );
        })()}
      </div>
    </>
  );
}
