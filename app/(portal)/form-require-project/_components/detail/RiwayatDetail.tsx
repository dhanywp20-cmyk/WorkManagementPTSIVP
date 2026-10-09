'use client';

/** RiwayatDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { AuditTrailPanel } from '@/components/shared';
import { ProjectRequest } from '../shared';

export interface RiwayatDetailProps {
  selectedRequest: ProjectRequest;
}

export function RiwayatDetail({ selectedRequest }: RiwayatDetailProps) {
  return (
    <>
      <div className="mt-4">
        <AuditTrailPanel targetId={selectedRequest.id} modul="project"
          selaluTerbuka sembunyikanBilaKosong={false}
          awal={{
            oleh: selectedRequest.requester_name || null,
            waktu: selectedRequest.created_at ?? null,
            keterangan: `Request diajukan${selectedRequest.sales_division ? ` — ${selectedRequest.sales_division}` : ''}`
              + (selectedRequest.sales_name && selectedRequest.sales_name !== selectedRequest.requester_name
                ? ` · atas nama Sales ${selectedRequest.sales_name}` : ''),
          }} />
      </div>
    </>
  );
}
