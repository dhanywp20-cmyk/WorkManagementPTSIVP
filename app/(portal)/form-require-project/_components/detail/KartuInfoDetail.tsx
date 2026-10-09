'use client';

/** KartuInfoDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { ProjectRequest } from '../shared';

export interface KartuInfoDetailProps {
  detailDueStatus: { type: string; label: string; days: number; } | null;
  detailRoomAssignName: string | undefined;
  detailSc: { label: string; color: string; bg: string; border: string; };
  dr: { room_name: string; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; brand_display: string | undefined; brand_display_pic_name: string | undefined; brand_display_2: string | undefined; brand_display_2_pic_name: string | undefined; brand_middleware: string | undefined; brand_middleware_pic_name: string | undefined; };
  formatDueDate: (dt: string) => string;
  getCCLabel: (req: ProjectRequest) => string;
  selectedRequest: ProjectRequest;
}

export function KartuInfoDetail({ detailDueStatus, detailRoomAssignName, detailSc, dr, formatDueDate, getCCLabel, selectedRequest }: KartuInfoDetailProps) {
  return (
    <>
      <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm satulayar:col-span-2">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 shrink-0 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="📁" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          Informasi Project
        </h3>
        <div className="space-y-4">
          {/* Nama Project — full width */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Project</label>
            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{selectedRequest.project_name}</p>
          </div>
          {/* Lokasi Project — full width, tepat di bawah Nama Project */}
          {selectedRequest.project_location && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Lokasi Project</label>
              <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-words whitespace-pre-wrap">{selectedRequest.project_location}</p>
            </div>
          )}
          {/* Row: Nama Ruangan, Sales/Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {dr.room_name && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Ruangan</label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.room_name}</p>
              </div>
            )}
            {selectedRequest.sales_name && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sales / Account</label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{selectedRequest.sales_name}</p>
              </div>
            )}
            {selectedRequest.sales_division && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Divisi Sales</label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{selectedRequest.sales_division}</p>
              </div>
            )}
            {/* "Sales / Account" di atas = ATAS NAMA siapa request diajukan;
                baris ini = siapa yang benar-benar mengisi & submit. Lewat SBU,
                Sales Internal bisa mengajukan atas nama Sales External, jadi
                kalau keduanya beda ditandai tegas supaya Sales yang namanya
                tercantum tidak dikira membuat request yang tak pernah ia buat. */}
            {selectedRequest.requester_name && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                  {selectedRequest.sales_name && selectedRequest.sales_name !== selectedRequest.requester_name ? 'Diinput oleh' : 'Requester'}
                </label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {selectedRequest.requester_name}
                  {selectedRequest.sales_name && selectedRequest.sales_name !== selectedRequest.requester_name && (
                    <span className="text-xs font-normal text-gray-500"> — atas nama Sales {selectedRequest.sales_name}</span>
                  )}
                </p>
              </div>
            )}
            {detailRoomAssignName && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">PTS Handler</label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"><Ikon nama="🔧" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailRoomAssignName}</p>
              </div>
            )}
            {getCCLabel(selectedRequest) && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sales Internal (CC)</label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">📣 {getCCLabel(selectedRequest)}</p>
              </div>
            )}
            {selectedRequest.due_date && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Target Selesai</label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {formatDueDate(selectedRequest.due_date)}{detailDueStatus ? ` (${detailDueStatus.label})` : ''}</p>
              </div>
            )}
            {detailSc?.label && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Status</label>
                <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{detailSc.label}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
