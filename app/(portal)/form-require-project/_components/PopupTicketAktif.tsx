'use client';

/** PopupTicketAktif - request yang masih aktif saat halaman dibuka. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { Modal, TombolModal } from '@/components/shared';
import { ProjectRequest, statusConfig } from './shared';

export interface PopupTicketAktifProps {
  formatDueDate: (dt: string) => string;
  handleOpenDetail: (req: ProjectRequest) => Promise<void>;
  requests: ProjectRequest[];
  setShowTicketPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showTicketPopup: boolean;
}

export function PopupTicketAktif({ formatDueDate, handleOpenDetail, requests, setShowTicketPopup, showTicketPopup }: PopupTicketAktifProps) {
  if (!showTicketPopup) return null;
  const activeTickets = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
  if (activeTickets.length === 0) return null;
  const tutup = () => setShowTicketPopup(false);
  return (
    <Modal buka onTutup={tutup} judul="Request Memerlukan Perhatian" keterangan={`${activeTickets.length} request masih aktif`} lapisan="maks"
      footer={<TombolModal onClick={tutup}>Tutup &amp; Lihat Nanti</TombolModal>}>
      <div className="space-y-2">
        {activeTickets.map(req => {
          const sc = statusConfig[req.status];
          return (
            <button key={req.id} type="button" onClick={() => { tutup(); void handleOpenDetail(req); }}
              className="w-full flex items-start gap-3 rounded-kontrol border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50 transition-all text-left">
              <span className={`mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{req.project_name}</p>
                <p className="text-xs text-slate-500 truncate">{req.sales_name}{req.assign_name ? ` · ${req.assign_name}` : ''}</p>
                {req.due_date && <p className="text-[11px] text-slate-600 font-semibold mt-0.5">Tenggat {formatDueDate(req.due_date)}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
