'use client';

import type { useRouter } from 'next/navigation';
import { salinBerkas } from '@/lib/unggah-tahan';
import type { Dispatch, SetStateAction } from 'react';
import type { Ticket } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { PilihStatusPTS } from './PilihStatusPTS';
import type { NewActivityForm } from './TicketDetailPopup';

export interface FormUpdateTicketProps {
  showUpdateForm: boolean;
  bolehUpdateTicket: (t: Ticket) => boolean;
  selectedTicket: Ticket;
  currentUserTeamType: string;
  setShowUpdateForm: Dispatch<SetStateAction<boolean>>;
  newActivity: NewActivityForm;
  onClose: () => void;
  setNewActivity: Dispatch<SetStateAction<NewActivityForm>>;
  router: ReturnType<typeof useRouter>;
  catatanSaja: boolean;
  notesWajib: boolean;
  addActivity: () => void;
  uploading: boolean;
}

export function FormUpdateTicket({
  showUpdateForm, bolehUpdateTicket, selectedTicket, currentUserTeamType, setShowUpdateForm, newActivity, onClose, setNewActivity,
  router, catatanSaja, notesWajib, addActivity, uploading,
}: FormUpdateTicketProps) {
  return (
    <>{showUpdateForm && bolehUpdateTicket(selectedTicket) && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
      <div className="bg-white rounded-kartu shadow-modal overflow-hidden shrink-0 w-full md:w-[340px]"
        style={{ maxHeight: "94vh" }}>
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setShowUpdateForm(false)} aria-label="Kembali ke detail ticket"
              className="tombol-kedua md:hidden shrink-0 inline-flex items-center gap-0.5 -ml-1 pl-1 pr-2.5 py-1.5 rounded-kontrol text-xs font-bold">
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              Detail
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-800 text-sm">{currentUserTeamType === "Team Services" ? "🔧 Update Services" : "➕ Update Status"}</h3>
              <p className="md:hidden text-slate-600 text-[11px] font-semibold truncate">{selectedTicket.project_name}</p>
              <p className="text-slate-500 text-[11px]">Handler: {newActivity.handler_name}</p>
            </div>
            <button aria-label="Tutup panel update" onClick={() => setShowUpdateForm(false)} className="hidden md:flex w-8 h-8 rounded-kecil items-center justify-center text-slate-500 hover:text-rose-600 bg-black/5 font-bold text-xs">✕</button>
            <button aria-label="Tutup" onClick={() => { onClose(); setShowUpdateForm(false); }}
              className="md:hidden shrink-0 self-start w-8 h-8 rounded-kecil bg-black/5 text-slate-500 flex items-center justify-center font-bold text-sm">✕</button>
          </div>
        </div>
    
        <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(94vh - 70px)' }}>
          <div>
            <label htmlFor="f-ticketing-components-ticketdetailpopup-1" className="block text-[10px] font-bold mb-1 tracking-widest uppercase text-gray-500"><IkonTeks nama="🔢" />SN Unit</label>
            <input id="f-ticketing-components-ticketdetailpopup-1" type="text" value={newActivity.sn_unit} onChange={e => setNewActivity({ ...newActivity, sn_unit: e.target.value })}
              placeholder="Update SN Unit..." className="w-full rounded-lg px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-red-500/40"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
          </div>
    
          <div>
            {currentUserTeamType === "Team Services" && <label className="block text-[10px] font-bold mb-2 tracking-widest uppercase text-gray-500">Pilih Status *</label>}
            {currentUserTeamType === "Team Services" ? (
              <div className="flex flex-col gap-1.5">
                {(["Pending","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart","Process Repair","Solved"] as const).map(s => (
                  <button key={s} onClick={() => setNewActivity({ ...newActivity, new_status: s, action_taken: "", notes: "" })}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 font-semibold text-xs transition-all text-left ${newActivity.new_status === s ? "bg-purple-600 text-white border-purple-600 shadow-md" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
                    <span className="flex-1">{s}</span>
                    {newActivity.new_status === s && 
                      <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>}
                  </button>
                ))}
              </div>
            ) : (
              <PilihStatusPTS sekarang={selectedTicket.status} dipilih={newActivity.new_status}
                onPilih={st => setNewActivity({ ...newActivity, new_status: st, action_taken: "", notes: "", onsite_use_schedule: false })}
                jadwalOnsite={
                          <div className="mt-1.5 p-2.5 rounded-lg border" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.25)' }}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <input type="checkbox" id="onsite-sched-r" checked={newActivity.onsite_use_schedule}
                                onChange={e => setNewActivity({ ...newActivity, onsite_use_schedule: e.target.checked })}
                                className="w-3.5 h-3.5 accent-purple-600" />
                              <label htmlFor="onsite-sched-r" className="text-[11px] font-bold text-purple-700">Jadwalkan (bukan hari ini)</label>
                            </div>
                            {newActivity.onsite_use_schedule && (
                              <div className="space-y-1.5">
                                <input aria-label="Tanggal jadwal onsite" type="date" value={newActivity.onsite_schedule_date}
                                  onChange={e => setNewActivity({ ...newActivity, onsite_schedule_date: e.target.value })}
                                  className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-purple-200 outline-hidden" style={{ background: 'white' }} />
                                <div className="flex gap-1.5 items-center">
                                  <select aria-label="Jam jadwal onsite" value={newActivity.onsite_schedule_hour} onChange={e => setNewActivity({ ...newActivity, onsite_schedule_hour: e.target.value })}
                                    className="flex-1 rounded-lg px-2 py-1.5 text-xs border border-purple-200" style={{ background: 'white' }}>
                                    {Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h}</option>)}
                                  </select>
                                  <span className="text-gray-500 text-xs font-bold">:</span>
                                  <select aria-label="Menit jadwal onsite" value={newActivity.onsite_schedule_minute} onChange={e => setNewActivity({ ...newActivity, onsite_schedule_minute: e.target.value })}
                                    className="flex-1 rounded-lg px-2 py-1.5 text-xs border border-purple-200" style={{ background: 'white' }}>
                                    {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                                  </select>
                                  <span className="text-[10px] text-gray-500">WIB</span>
                                </div>
                                <div className="flex items-center gap-1.5 p-1.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                  <span className="text-xs"><Ikon nama="🗓" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                                  <p className="text-[10px] text-purple-700 font-semibold flex-1">Otomatis buat jadwal Troubleshooting di Reminder Schedule</p>
                                  <button onClick={() => { onClose(); setShowUpdateForm(false); router.push('/reminder-schedule'); }}
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-purple-700 hover:text-purple-900"
                                      style={{ background: 'rgba(124,58,237,0.15)' }}>Buka</button>
                                </div>
                              </div>
                            )}
                          </div>
                } />
            )}
          </div>
    
          {newActivity.new_status !== "" && (catatanSaja || !["Call","Onsite","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart"].includes(newActivity.new_status)) && (
            <>
              <div>
                <label htmlFor="f-ticketing-components-ticketdetailpopup-2" className="block text-[10px] font-bold mb-1 tracking-widest uppercase text-gray-500"><IkonTeks nama="🔧" />Action Taken</label>
                <textarea id="f-ticketing-components-ticketdetailpopup-2" value={newActivity.action_taken} onChange={e => setNewActivity({ ...newActivity, action_taken: e.target.value })}
                  placeholder="Cek kabel HDMI, restart sistem..." rows={2}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-red-500/40 resize-none"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
              </div>
              <div>
                <label htmlFor="f-ticketing-components-ticketdetailpopup-3" className="block text-[10px] font-bold mb-1 tracking-widest uppercase text-gray-500">
                  <IkonTeks nama="📝" />Notes {notesWajib ? "*" : <span className="text-gray-500 normal-case">(opsional)</span>}
                </label>
                <textarea id="f-ticketing-components-ticketdetailpopup-3" value={newActivity.notes} onChange={e => setNewActivity({ ...newActivity, notes: e.target.value })}
                  placeholder={newActivity.new_status === "Pending Action" ? "Kendala apa? (mis. menunggu konfirmasi user, akses lokasi belum tersedia)" : catatanSaja ? "Perkembangan terbaru..." : "Detail penanganan..."} rows={3}
                  className="w-full rounded-lg px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-red-500/40 resize-none"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
              </div>
              {newActivity.new_status === "Pending Action" && (
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.25)' }}>
                  <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase text-orange-700"><IkonTeks nama="⏱" />Perpanjang Overdue</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={newActivity.extend_days}
                      onChange={e => setNewActivity({ ...newActivity, extend_days: e.target.value })}
                      placeholder="0" className="w-20 rounded-lg px-2.5 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-orange-500/40"
                      style={{ background: 'white', border: '1px solid rgba(0,0,0,0.12)' }} />
                    <span className="text-[11px] font-semibold text-orange-700">hari dari sekarang</span>
                  </div>
                  <p className="text-[10px] text-orange-700 mt-1">Deadline overdue digeser sesuai hari yang dipilih. Kosong/0 = deadline tidak diubah.</p>
                </div>
              )}
            </>
          )}
    
          {currentUserTeamType !== "Team Services" && newActivity.new_status === "In Progress" && (
            <div className="rounded-lg p-2.5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <input type="checkbox" id="assign-svc-r" checked={newActivity.assign_to_services}
                  onChange={e => setNewActivity({ ...newActivity, assign_to_services: e.target.checked, services_assignee: "" })}
                  className="w-3.5 h-3.5 accent-red-600" />
                <label htmlFor="assign-svc-r" className="text-[11px] font-bold text-red-700"><IkonTeks nama="🔧" />Teruskan ke Team Services</label>
              </div>
              {newActivity.assign_to_services && (
                <p className="text-[11px] text-red-500 mt-1 font-medium">
                  Ticket akan dikirim ke Admin Team Services. Mereka yang akan assign ke anggota tim mereka.
                </p>
              )}
            </div>
          )}
    
          <div>
            <label htmlFor="f-ticketing-components-ticketdetailpopup-4" className="block text-[10px] font-bold mb-1 tracking-widest uppercase text-gray-500"><IkonTeks nama="📷" />Foto Bukti</label>
            <input id="f-ticketing-components-ticketdetailpopup-4" type="file" accept="image/jpeg,image/jpg,image/png"
              onChange={async e => { const photo = await salinBerkas(e.target.files?.[0]); setNewActivity(a => ({ ...a, photo })); }}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-red-50 file:text-red-700"
              style={{ borderColor: "rgba(0,0,0,0.12)" }} />
          </div>
    
          <button onClick={addActivity}
            disabled={uploading || newActivity.new_status === "" || (notesWajib && !newActivity.notes.trim())}
            className="tombol-utama w-full py-2.5 rounded-kontrol font-bold transition-all text-sm">
            {uploading ? "⏳ Menyimpan..." : newActivity.new_status === "" ? "Pilih status dulu" : "💾 Simpan Activity"}
          </button>
        </div>
      </div>
    )}</>
  );
}
