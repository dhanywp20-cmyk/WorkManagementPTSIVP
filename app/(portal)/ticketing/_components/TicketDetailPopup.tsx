'use client';
import type { Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { ModalPortal } from '@/components/shared';
import { cetakTicket } from './cetak-ticket';
import type { Ticket, User } from './shared';
import { ringkasPenanganan } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { wajibCatatan } from '@/lib/alur-status-ticket';
import { FormUpdateTicket } from './FormUpdateTicket';
import { IsiDetailTicket } from './IsiDetailTicket';

export type NewActivityForm = {
  handler_name: string; action_taken: string; notes: string; new_status: string;
  sn_unit: string; file: File | null; photo: File | null;
  assign_to_services: boolean; services_assignee: string;
  onsite_use_schedule: boolean; onsite_schedule_date: string;
  onsite_schedule_hour: string; onsite_schedule_minute: string;
  extend_days: string;
};

export function TicketDetailPopup({
  selectedTicket, currentUser, currentUserTeamType, canManageTickets, users,
  showUpdateForm, setShowUpdateForm, onClose,
  bukaAdminEdit, getDeadline, getWarrantyInfo, bolehUpdateTicket,
  setSupAssignTicket, setSupAssignTo,
  setReopenTargetTicket, setReopenAssignee, setReopenNotes, setShowReopenModal,
  setReopenServicesTarget, setShowServicesApprovalModal,
  newActivity, setNewActivity, addActivity, uploading,
}: {
  selectedTicket: Ticket;
  currentUser: User | null;
  currentUserTeamType: string;
  canManageTickets: boolean;
  users: User[];
  showUpdateForm: boolean;
  setShowUpdateForm: Dispatch<SetStateAction<boolean>>;
  onClose: () => void;
  bukaAdminEdit: (t: Ticket) => void;
  getDeadline: (t: Ticket) => Date | null;
  getWarrantyInfo: (projectName: string) => { isIn: boolean; diffDays: number; wy: number; bastStr: string; expiryStr: string } | null;
  bolehUpdateTicket: (t: Ticket) => boolean;
  setSupAssignTicket: Dispatch<SetStateAction<Ticket | null>>;
  setSupAssignTo: Dispatch<SetStateAction<string>>;
  setReopenTargetTicket: Dispatch<SetStateAction<Ticket | null>>;
  setReopenAssignee: Dispatch<SetStateAction<string>>;
  setReopenNotes: Dispatch<SetStateAction<string>>;
  setShowReopenModal: Dispatch<SetStateAction<boolean>>;
  setReopenServicesTarget: Dispatch<SetStateAction<Ticket | null>>;
  setShowServicesApprovalModal: Dispatch<SetStateAction<boolean>>;
  newActivity: NewActivityForm;
  setNewActivity: Dispatch<SetStateAction<NewActivityForm>>;
  addActivity: () => void;
  uploading: boolean;
}) {
  const router = useRouter();
  const catatanSaja = currentUserTeamType !== "Team Services" && newActivity.new_status !== "" && newActivity.new_status === selectedTicket.status;
  const notesWajib = currentUserTeamType === "Team Services"
    ? !["Pending","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart","Process Repair"].includes(newActivity.new_status)
    : wajibCatatan(selectedTicket.status, newActivity.new_status);
  const bukaTutupUpdate = () => {
    if (!showUpdateForm) setNewActivity(a => ({ ...a, new_status: "", action_taken: "", notes: "" }));
    setShowUpdateForm(!showUpdateForm);
  };

  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-1000 p-3" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) { onClose(); setShowUpdateForm(false); } }}>
        <div className="flex items-start gap-3 w-full my-2" style={{ maxWidth: showUpdateForm ? '1120px' : '720px', transition: 'max-width 0.2s' }}>

          <div className={`bg-white rounded-kartu shadow-modal overflow-hidden w-full flex-col flex-1 min-w-0 ${showUpdateForm ? 'hidden md:flex' : 'flex'}`}
            style={{ maxHeight: "94vh" }}>
            <div className="px-5 py-4 pr-12 shrink-0 relative border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[11px] font-bold text-slate-600">
                <span><IkonTeks nama="🎫" />Tim: {ringkasPenanganan(selectedTicket).teamHandler}</span>
                <span>Status: {ringkasPenanganan(selectedTicket).statusLengkap}</span>
                {selectedTicket.services_status && <span>Services: {selectedTicket.services_status}</span>}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1 mb-0.5">Nama Project</p>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">{selectedTicket.project_name}</h2>
              {selectedTicket.address && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1.5 mb-0.5">Lokasi</p>
                  <p className="text-slate-600 text-xs flex items-center gap-1"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {selectedTicket.address}</p>
                </>
              )}
              {selectedTicket.status === "Onsite" && (
                <button onClick={() => { onClose(); setShowUpdateForm(false); router.push('/reminder-schedule'); }}
                  className="tombol-kedua mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-kontrol text-[11px] font-bold">
                  <IkonTeks nama="🗓" />Lihat Jadwal Reminder
                </button>
              )}
              <button aria-label="Tutup" onClick={() => { onClose(); setShowUpdateForm(false); }}
                className="absolute top-3 right-3 w-8 h-8 rounded-kecil flex items-center justify-center text-slate-500 hover:text-rose-600 bg-black/5 font-bold text-sm">✕</button>
            </div>

            <IsiDetailTicket
              selectedTicket={selectedTicket} currentUser={currentUser} setSupAssignTicket={setSupAssignTicket} setSupAssignTo={setSupAssignTo} canManageTickets={canManageTickets} bukaAdminEdit={bukaAdminEdit}
              getDeadline={getDeadline} users={users} getWarrantyInfo={getWarrantyInfo}
            />
            <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2 bg-gray-50/50 shrink-0">
                <button onClick={() => cetakTicket(selectedTicket)} className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold"><IkonTeks nama="📄" />PDF</button>
                {selectedTicket.status === "Solved" && bolehUpdateTicket(selectedTicket) && currentUserTeamType !== "Team Services" && (
                  <button onClick={() => { setReopenTargetTicket(selectedTicket); setReopenAssignee(selectedTicket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); }} className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold"><IkonTeks nama="🔓" />Re-open</button>
                )}
                {selectedTicket.services_status === "Solved" && bolehUpdateTicket(selectedTicket) &&
                  (currentUserTeamType === "Team Services" || currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                  <button onClick={() => setReopenServicesTarget(selectedTicket)} className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold"><IkonTeks nama="🔓" />Re-open Services</button>
                )}
                {bolehUpdateTicket(selectedTicket) && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
                  <button onClick={bukaTutupUpdate}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold transition-all ${showUpdateForm ? 'tombol-kedua' : 'tombol-utama'}`}>
                    {showUpdateForm ? '✕ Tutup' : '➕ Update Status'}
                  </button>
                )}
                {bolehUpdateTicket(selectedTicket) && currentUserTeamType === "Team Services" && selectedTicket.services_status === "Waiting Approval" && (
                  <button onClick={() => setShowServicesApprovalModal(true)} className="tombol-utama flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold"><IkonTeks nama="🔧" />Konfirmasi</button>
                )}
                <button onClick={() => { onClose(); setShowUpdateForm(false); }} className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold">Tutup</button>
              </div>
          </div>

          <FormUpdateTicket
            showUpdateForm={showUpdateForm} bolehUpdateTicket={bolehUpdateTicket} selectedTicket={selectedTicket} currentUserTeamType={currentUserTeamType} setShowUpdateForm={setShowUpdateForm} newActivity={newActivity}
            onClose={onClose} setNewActivity={setNewActivity} router={router} catatanSaja={catatanSaja} notesWajib={notesWajib} addActivity={addActivity}
            uploading={uploading}
          />
        </div>
      </div>
    </ModalPortal>
  );
}
