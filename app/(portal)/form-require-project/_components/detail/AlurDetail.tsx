'use client';

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
          const st = detailRoomStatus;
          const batal = st === 'rejected';
          const aktif = st === 'completed' ? 5
            : (st === 'in_progress' || detailRoomAssignName) ? 3
            : selectedRequest.routing_status === 'internal_review' ? 1
            : 2;
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
