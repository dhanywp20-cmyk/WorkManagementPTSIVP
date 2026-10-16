'use client';

/** BlokAssignPTS - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { AssignPTSModal } from '../Modals';
import { supabase } from '@/lib/supabase';
import { User, ProjectRequest, RoomDetail } from '../shared';

export interface BlokAssignPTSProps {
  assignModal: { open: boolean; req: ProjectRequest | null; roomIdx: number; };
  currentUser: User;
  fetchMessages: (requestId: string) => Promise<void>;
  fetchRequests: () => Promise<void>;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedRequest: ProjectRequest | null;
  setAssignModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
}

export function BlokAssignPTS({ assignModal, currentUser, fetchMessages, fetchRequests, notify, selectedRequest, setAssignModal, setSelectedRequest }: BlokAssignPTSProps) {
  return (
    <>
      {assignModal.open && assignModal.req && (
        <AssignPTSModal
          req={assignModal.req}
          // Opsi "Route ke Supervisor" hanya saat approve awal (belum di-route)
          // DAN untuk ruangan pertama - tahap routing itu milik seluruh request,
          // bukan satu ruangan, jadi re-assign ruangan 2+ tidak pernah menawarkannya.
          // Kalau Supervisor yg buka utk assign final (routing_status='supervisor_assign'),
          // opsi route disembunyikan - dia langsung pilih Tim PTS.
          allowSupervisorRoute={assignModal.roomIdx === 0 && assignModal.req.routing_status !== 'supervisor_assign'}
          roomIdx={assignModal.roomIdx}
          onClose={() => setAssignModal({ open: false, req: null, roomIdx: 0 })}
          onAssigned={() => {
            setAssignModal({ open: false, req: null, roomIdx: 0 });
            notify('success', `Request diproses!`);
            fetchRequests();
            if (selectedRequest?.id === assignModal.req?.id) {
              if (assignModal.roomIdx === 0) {
                setSelectedRequest(prev => prev ? { ...prev, status: 'approved' } : null);
              } else {
                // Ruangan 1+ ditulis di dalam JSONB `rooms` - ambil ulang kolom itu
                // supaya tab ruangan yang sedang dilihat langsung terlihat approved,
                // tanpa harus menutup & buka lagi detailnya.
                supabase.from('project_requests').select('rooms').eq('id', assignModal.req!.id).maybeSingle()
                  .then(({ data }: { data: { rooms: RoomDetail[] } | null }) => {
                    if (data) setSelectedRequest(prev => prev ? { ...prev, rooms: data.rooms } : null);
                  });
              }
              fetchMessages(assignModal.req!.id);
            }
          }}
          currentUser={currentUser}
        />
      )}
    </>
  );
}
