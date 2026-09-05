'use client';
import type { Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { ModalPortal } from '@/components/shared';
import { InfoLine } from './DonutCards';
import { cetakTicket } from './cetak-ticket';
import type { Ticket, User } from './shared';
import { formatDateTime, statusColors, ringkasPenanganan, bolehReroute, adalahPending } from './shared';

/** Bentuk state form "Update Status" di page.tsx - dioper ke sini apa adanya. */
export type NewActivityForm = {
  handler_name: string; action_taken: string; notes: string; new_status: string;
  sn_unit: string; file: File | null; photo: File | null;
  assign_to_services: boolean; services_assignee: string;
  onsite_use_schedule: boolean; onsite_schedule_date: string;
  onsite_schedule_hour: string; onsite_schedule_minute: string;
  extend_days: string;
};

/**
 * Popup detail ticket (panel kiri) + panel "Update Status" (panel kanan,
 * kondisional) - dipindah dari app/ticketing/page.tsx apa adanya (JSX
 * identik). Blok JSX terbesar & paling entangled di berkas ini. State &
 * handler tetap di page.tsx, komponen ini murni presentasional.
 */
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

  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-3"
        onClick={e => { if (e.target === e.currentTarget) { onClose(); setShowUpdateForm(false); } }}>
        <div className="flex items-start gap-3 w-full my-2" style={{ maxWidth: showUpdateForm ? '1120px' : '720px', transition: 'max-width 0.2s' }}>

          {/* LEFT: Detail */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col flex-1 min-w-0"
            style={{ animation: "scale-in 0.25s ease-out", border: "1px solid rgba(0,0,0,0.1)", maxHeight: "94vh" }}>
            {/* Header */}
            <div className="px-5 py-4 flex-shrink-0 relative" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
              {/* Latar bulat dibuang: di atas kepala merah ini lencana
                  putih-transparan membuat tulisannya nyaris tak terbaca.
                  Teks putih polos di atas merah jauh lebih terbaca, dan
                  ruangnya cukup untuk menyebut keterangan pelimpahan. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[10px] font-bold text-white/90">
                <span>🎫 Tim: {ringkasPenanganan(selectedTicket).teamHandler}</span>
                <span>Status: {ringkasPenanganan(selectedTicket).statusLengkap}</span>
                {selectedTicket.services_status && <span>Services: {selectedTicket.services_status}</span>}
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-1 mb-0.5">Nama Project</p>
              <h2 className="text-lg font-bold text-white leading-tight">{selectedTicket.project_name}</h2>
              {selectedTicket.address && (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-1.5 mb-0.5">Lokasi</p>
                  <p className="text-white/75 text-xs flex items-center gap-1">📍 {selectedTicket.address}</p>
                </>
              )}
              {selectedTicket.status === "Onsite" && (
                <button onClick={() => { onClose(); setShowUpdateForm(false); router.push('/reminder-schedule'); }}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.92)' }}>
                  🗓️ Lihat Jadwal Reminder
                </button>
              )}
              <button aria-label="Tutup" onClick={() => { onClose(); setShowUpdateForm(false); }}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              {/* Supervisor: ticket di-route ke kamu → wajib assign lanjut ke tim */}
              {selectedTicket.routing_status === "supervisor_assign" && selectedTicket.assigned_supervisor_id === currentUser?.id && (
                <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.4)" }}>
                  <span className="text-2xl">🎯</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-800">Ticket ini menunggu kamu assign ke tim</p>
                    <p className="text-[11px] text-amber-700">Sudah diapprove Admin — pilih anggota tim atau kerjakan sendiri.</p>
                  </div>
                  <button onClick={() => { setSupAssignTicket(selectedTicket); setSupAssignTo(""); }}
                    className="flex-shrink-0 text-white px-3 py-2 rounded-lg text-xs font-bold" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                    🎯 Assign ke Tim
                  </button>
                </div>
              )}
              {/* Admin / Full Access: betulkan data & alihkan pekerjaan.
                  Sebelum ini satu-satunya cara membetulkan ticket yang salah
                  adalah mengeditnya langsung di Supabase — tanpa jejak dan
                  tanpa pemberitahuan ke yang menangani. */}
              {canManageTickets && (
                <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.25)' }}>
                  <span className="text-2xl">🛠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-indigo-800">Koreksi data ticket</p>
                    <p className="text-[11px] text-indigo-700">
                      {bolehReroute(selectedTicket)
                        ? 'Betulkan detail atau alihkan ke supervisor/tim lain.'
                        : 'Detail bisa dibetulkan. Pengalihan tidak tersedia — pengerjaannya sudah jalan.'}
                    </p>
                  </div>
                  <button onClick={() => bukaAdminEdit(selectedTicket)}
                    className="flex-shrink-0 text-white px-3 py-2 rounded-lg text-xs font-bold" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                    🛠️ Edit &amp; Re-route
                  </button>
                </div>
              )}
              {/* Progress Flowchart */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Progress</p>
                  {/* Status Pending menahan pekerjaan, bukan membatalkannya —
                      jadi yang perlu diketahui adalah berapa lama lagi
                      tenggatnya, bukan sekadar bahwa ia sedang tertahan. */}
                  {adalahPending(selectedTicket.status) && (() => {
                    const dl = getDeadline(selectedTicket);
                    if (!dl) return null;
                    const sisaHari = Math.ceil((dl.getTime() - Date.now()) / 86400000);
                    const lewat = sisaHari < 0;
                    return (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full border"
                        style={lewat
                          ? { background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#b91c1c' }
                          : { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.35)', color: '#b45309' }}>
                        {selectedTicket.status} · {lewat
                          ? `lewat ${Math.abs(sisaHari)} hari`
                          : `${sisaHari} hari lagi`}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center">
                  {(["Pending","Call","Onsite","In Progress","Solved"] as const).map((step, idx, arr) => {
                    const order = ["Pending","Call","Onsite","In Progress","Solved"];
                    /* Posisi diambil dari langkah TERJAUH yang pernah dicapai menurut riwayat
                       aktivitas, bukan status sekarang. "Pending Action" dan
                       "Pending Check" tidak ada di daftar ini, jadi memakai status
                       sekarang akan membuat ticket yang sudah jauh terlihat mundur
                       ke titik awal. */
                    const dariRiwayat = (selectedTicket.activity_logs ?? [])
                      .map(l => order.indexOf(l.new_status))
                      .filter(i => i >= 0);
                    const curIdx = Math.max(
                      order.indexOf(selectedTicket.status),
                      ...(dariRiwayat.length ? dariRiwayat : [-1]),
                    );
                    const stepIdx = order.indexOf(step);
                    const done = stepIdx < curIdx;
                    const active = stepIdx === curIdx;
                    const icons: Record<string,string> = { Pending:'🟡', Call:'📞', Onsite:'🚗', 'In Progress':'🔵', Solved:'✅' };
                    return (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${active ? 'border-red-500 bg-red-50 shadow-md scale-110' : done ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                            {done ? '✓' : icons[step]}
                          </div>
                          <span className={`text-[7px] font-bold text-center leading-tight whitespace-nowrap ${active ? 'text-red-600' : done ? 'text-green-600' : 'text-gray-400'}`}>{step}</span>
                        </div>
                        {idx < arr.length - 1 && <div className={`flex-1 h-0.5 mx-0.5 mb-3 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Info grid — print style */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <div>
                    <InfoLine label="Handler" value={ringkasPenanganan(selectedTicket).handlerPTS || '-'} />
                    <InfoLine label="Team" value={ringkasPenanganan(selectedTicket).teamHandler} />
                    <InfoLine label="Issue" value={selectedTicket.issue_case} />
                    {selectedTicket.product && <InfoLine label="Product" value={selectedTicket.product} />}
                    {selectedTicket.sn_unit && <InfoLine label="SN Unit" value={selectedTicket.sn_unit} />}
                    {selectedTicket.customer_phone && <InfoLine label="Customer" value={selectedTicket.customer_phone} />}
                  </div>
                  <div>
                    {selectedTicket.sales_name && <InfoLine label="Sales" value={`${selectedTicket.sales_name}${selectedTicket.sales_division ? ` (${selectedTicket.sales_division})` : ''}`} />}
                    <InfoLine label="Dibuat" value={selectedTicket.created_at ? formatDateTime(selectedTicket.created_at) : '-'} />
                    {/* "Sales" di atas = ATAS NAMA siapa ticket diajukan; baris ini =
                        siapa yang benar-benar mengetik & submit. Lewat SBU, Sales
                        Internal bisa mengajukan atas nama Sales External, jadi kalau
                        keduanya beda disebut tegas supaya Sales yang namanya tercantum
                        tidak dikira membuat ticket yang tak pernah ia buat. */}
                    {selectedTicket.created_by && (() => {
                      const pembuat = users.find(u => u.username === selectedTicket.created_by);
                      const namaPembuat = pembuat?.full_name || selectedTicket.created_by;
                      const atasNama = selectedTicket.sales_name || "";
                      const beda = atasNama && atasNama !== namaPembuat;
                      return <InfoLine label={beda ? "Diinput oleh" : "Oleh"}
                        value={beda ? `${namaPembuat} (${selectedTicket.created_by}) — atas nama Sales ${atasNama}` : `${namaPembuat} (${selectedTicket.created_by})`} />;
                    })()}
                    {selectedTicket.description && <InfoLine label="Deskripsi" value={selectedTicket.description} />}
                  </div>
                </div>
              </div>

              {/* Warranty Info */}
              {(() => {
                const w = getWarrantyInfo(selectedTicket.project_name);
                if (!w) return null;
                return (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">🛡️ Status Garansi Project</p>
                    <div className="rounded-xl p-3 flex flex-wrap items-center gap-3"
                      style={w.isIn
                        ? { background: "rgba(14,165,233,0.08)", border: "1.5px solid rgba(14,165,233,0.3)" }
                        : { background: "rgba(239,68,68,0.07)", border: "1.5px solid rgba(239,68,68,0.3)" }}>
                      <span className="text-2xl">{w.isIn ? "🛡️" : "⚠️"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold"
                            style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                            {w.isIn ? "✅ In Warranty" : "❌ Out of Warranty"}
                          </span>
                          <span className="text-xs font-bold" style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                            {w.isIn ? `Sisa ${w.diffDays} hari` : `Sudah lewat ${Math.abs(w.diffDays)} hari`}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-gray-500">
                          <div><span className="block text-gray-400">BAST</span><strong className="text-gray-700">{w.bastStr}</strong></div>
                          <div><span className="block text-gray-400">Berakhir</span><strong style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>{w.expiryStr}</strong></div>
                          <div><span className="block text-gray-400">Durasi</span><strong className="text-gray-700">{w.wy} Tahun</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Foto awal */}
              {selectedTicket.photo_url && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">📸 Foto Awal</p>
                  <img src={selectedTicket.photo_url} alt="foto" loading="lazy" decoding="async" className="w-full max-h-36 object-cover rounded-xl border cursor-pointer hover:opacity-90" onClick={() => window.open(selectedTicket.photo_url!, "_blank")} />
                </div>
              )}

              {/* Activity log compact */}
              <div className="px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">📝 Activity Log ({selectedTicket.activity_logs?.length || 0})</p>
                <div className="space-y-2">
                  {selectedTicket.activity_logs && selectedTicket.activity_logs.length > 0
                    ? selectedTicket.activity_logs.map(log => (
                      <div key={log.id} className="rounded-lg p-2.5 border border-gray-100 bg-gray-50/80">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-800">{log.handler_name}</span>
                            <span className="text-[9px] text-purple-700 font-semibold">{log.team_type}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold ${(statusColors[log.new_status] || 'text-gray-600').split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{log.new_status}</span>
                            <span className="text-[9px] text-gray-400">{formatDateTime(log.created_at)}</span>
                          </div>
                        </div>
                        {log.action_taken && <p className="text-[10px] text-blue-700 font-semibold">🔧 {log.action_taken}</p>}
                        <p className="text-xs text-gray-600">{log.notes}</p>
                        {log.photo_url && <img src={log.photo_url} alt="log" loading="lazy" decoding="async" className="mt-1.5 max-h-24 rounded-lg border cursor-pointer" onClick={() => window.open(log.photo_url!, "_blank")} />}
                        {log.file_url && <a href={log.file_url} download className="inline-block mt-1 text-[10px] font-bold text-blue-600 hover:underline">📄 {log.file_name || "Download"}</a>}
                      </div>
                    ))
                    : <p className="text-xs text-gray-400 text-center py-3">Belum ada aktivitas</p>
                  }
                </div>
              </div>

            </div>
            {/* Footer actions — outside overflow, always visible */}
            <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2 bg-gray-50/50 flex-shrink-0">
                <button onClick={() => cetakTicket(selectedTicket)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>📄 PDF</button>
                {selectedTicket.status === "Solved" && bolehUpdateTicket(selectedTicket) && currentUserTeamType !== "Team Services" && (
                  <button onClick={() => { setReopenTargetTicket(selectedTicket); setReopenAssignee(selectedTicket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>🔓 Re-open</button>
                )}
                {/* C2: dulu jalan buntu - services_status "Solved" tidak bisa dibuka siapa
                    pun. Team Services (membetulkan salah klik sendiri) atau Admin/
                    Superadmin (pengawasan) sekarang bisa. */}
                {selectedTicket.services_status === "Solved" && bolehUpdateTicket(selectedTicket) &&
                  (currentUserTeamType === "Team Services" || currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                  <button onClick={() => setReopenServicesTarget(selectedTicket)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>🔓 Re-open Services</button>
                )}
                {bolehUpdateTicket(selectedTicket) && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
                  <button onClick={() => setShowUpdateForm(!showUpdateForm)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showUpdateForm ? 'bg-gray-200 text-gray-700' : 'text-white'}`}
                    style={showUpdateForm ? {} : { background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
                    {showUpdateForm ? '✕ Tutup' : '➕ Update Status'}
                  </button>
                )}
                {bolehUpdateTicket(selectedTicket) && currentUserTeamType === "Team Services" && selectedTicket.services_status === "Waiting Approval" && (
                  <button onClick={() => setShowServicesApprovalModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>🔧 Konfirmasi</button>
                )}
                <button onClick={() => { onClose(); setShowUpdateForm(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 bg-white">✕ Close</button>
              </div>
          </div>

          {/* RIGHT: Update Status Panel */}
          {showUpdateForm && bolehUpdateTicket(selectedTicket) && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden flex-shrink-0"
              style={{ width: 340, animation: "scale-in 0.2s ease-out", border: "2px solid rgba(220,38,38,0.25)", maxHeight: "94vh" }}>
              <div className="px-4 py-3" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{currentUserTeamType === "Team Services" ? "🔧 Update Services" : "➕ Update Status"}</h3>
                    <p className="text-red-200 text-[10px]">Handler: {newActivity.handler_name}</p>
                  </div>
                  <button aria-label="Tutup" onClick={() => setShowUpdateForm(false)} className="text-white hover:bg-white/20 rounded-lg p-1 font-bold text-xs">✕</button>
                </div>
              </div>

              <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(94vh - 70px)' }}>
                {/* SN Unit */}
                <div>
                  <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">🔢 SN Unit</label>
                  <input type="text" value={newActivity.sn_unit} onChange={e => setNewActivity({ ...newActivity, sn_unit: e.target.value })}
                    placeholder="Update SN Unit..." className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/40"
                    style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                </div>

                {/* Status flowchart buttons */}
                <div>
                  <label className="block text-[9px] font-bold mb-2 tracking-widest uppercase text-gray-400">Pilih Status *</label>
                  {currentUserTeamType === "Team Services" ? (
                    <div className="flex flex-col gap-1.5">
                      {(["Pending","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart","Process Repair","Solved"] as const).map(s => (
                        <button key={s} onClick={() => setNewActivity({ ...newActivity, new_status: s, action_taken: "", notes: "" })}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 font-semibold text-xs transition-all text-left ${newActivity.new_status === s ? "bg-purple-600 text-white border-purple-600 shadow-md" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
                          <span className="flex-1">{s}</span>
                          {newActivity.new_status === s && <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {(() => {
                        const flow = ["Pending","Call","Onsite","In Progress","Pending Action","Solved"] as const;
                        const curStatus = selectedTicket.status;
                        const curIdx = flow.indexOf(curStatus as any);
                        const styleMap: Record<string,{icon:string;sel:string;unsel:string}> = {
                          Pending:      { icon:'🟡', sel:'bg-amber-500 text-white border-amber-500',    unsel:'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' },
                          Call:         { icon:'📞', sel:'bg-cyan-600 text-white border-cyan-600',      unsel:'bg-white text-cyan-700 border-cyan-200 hover:bg-cyan-50' },
                          Onsite:       { icon:'🚗', sel:'bg-purple-600 text-white border-purple-600',  unsel:'bg-white text-purple-700 border-purple-200 hover:bg-purple-50' },
                          'In Progress':{ icon:'🔵', sel:'bg-blue-600 text-white border-blue-600',      unsel:'bg-white text-blue-700 border-blue-200 hover:bg-blue-50' },
                          'Pending Action':{ icon:'⏸️', sel:'bg-orange-600 text-white border-orange-600', unsel:'bg-white text-orange-700 border-orange-200 hover:bg-orange-50' },
                          Solved:       { icon:'✅', sel:'bg-emerald-500 text-white border-emerald-500',unsel:'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                        };
                        return flow.map((step, idx) => {
                          const stepIdx = flow.indexOf(step);
                          // Boleh mundur ke "In Progress" dari "Pending Action" (kendala selesai, lanjut kerja).
                          const locked = stepIdx < curIdx && !(curStatus === "Pending Action" && step === "In Progress");
                          // Solved hanya dari Onsite+; Pending Action hanya dari In Progress+.
                          const skipLocked = (step === 'Solved' && curIdx < 2) || (step === 'Pending Action' && curIdx < 3);
                          const disabled = locked || skipLocked;
                          const st = styleMap[step];
                          const isSelected = newActivity.new_status === step;
                          return (
                            <div key={step}>
                              <button disabled={disabled}
                                onClick={() => setNewActivity({ ...newActivity, new_status: step, action_taken: "", notes: "", onsite_use_schedule: false })}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 font-semibold text-xs transition-all ${isSelected ? st.sel : disabled ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : st.unsel}`}>
                                <span>{st.icon}</span>
                                <span className="flex-1 text-left">{step}</span>
                                {disabled && <span className="text-[9px]">🔒</span>}
                                {isSelected && <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                              </button>
                              {/* Onsite schedule */}
                              {step === 'Onsite' && isSelected && (
                                <div className="mt-1.5 p-2.5 rounded-lg border" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.25)' }}>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <input type="checkbox" id="onsite-sched-r" checked={newActivity.onsite_use_schedule}
                                      onChange={e => setNewActivity({ ...newActivity, onsite_use_schedule: e.target.checked })}
                                      className="w-3.5 h-3.5 accent-purple-600" />
                                    <label htmlFor="onsite-sched-r" className="text-[10px] font-bold text-purple-700">Jadwalkan (bukan hari ini)</label>
                                  </div>
                                  {newActivity.onsite_use_schedule && (
                                    <div className="space-y-1.5">
                                      <input type="date" value={newActivity.onsite_schedule_date}
                                        onChange={e => setNewActivity({ ...newActivity, onsite_schedule_date: e.target.value })}
                                        className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-purple-200 outline-none" style={{ background: 'white' }} />
                                      <div className="flex gap-1.5 items-center">
                                        <select value={newActivity.onsite_schedule_hour} onChange={e => setNewActivity({ ...newActivity, onsite_schedule_hour: e.target.value })}
                                          className="flex-1 rounded-lg px-2 py-1.5 text-xs border border-purple-200" style={{ background: 'white' }}>
                                          {Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h}</option>)}
                                        </select>
                                        <span className="text-gray-400 text-xs font-bold">:</span>
                                        <select value={newActivity.onsite_schedule_minute} onChange={e => setNewActivity({ ...newActivity, onsite_schedule_minute: e.target.value })}
                                          className="flex-1 rounded-lg px-2 py-1.5 text-xs border border-purple-200" style={{ background: 'white' }}>
                                          {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <span className="text-[9px] text-gray-500">WIB</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 p-1.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                        <span className="text-xs">🗓️</span>
                                        <p className="text-[9px] text-purple-700 font-semibold flex-1">Otomatis buat jadwal Troubleshooting di Reminder Schedule</p>
                                        <button onClick={() => { onClose(); setShowUpdateForm(false); router.push('/reminder-schedule'); }}
                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded text-purple-700 hover:text-purple-900"
                                            style={{ background: 'rgba(124,58,237,0.15)' }}>Buka</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                {/* Notes/Action for statuses that need detail */}
                {!["Call","Onsite","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart"].includes(newActivity.new_status) && (
                  <>
                    <div>
                      <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">🔧 Action Taken</label>
                      <textarea value={newActivity.action_taken} onChange={e => setNewActivity({ ...newActivity, action_taken: e.target.value })}
                        placeholder="Cek kabel HDMI, restart sistem..." rows={2}
                        className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
                        style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">
                        📝 Notes {newActivity.new_status === "In Progress" ? <span className="text-gray-300 normal-case">(opsional)</span> : "*"}
                      </label>
                      <textarea value={newActivity.notes} onChange={e => setNewActivity({ ...newActivity, notes: e.target.value })}
                        placeholder={newActivity.new_status === "Pending Action" ? "Kendala apa? (mis. menunggu konfirmasi user, akses lokasi belum tersedia)" : "Detail penanganan..."} rows={3}
                        className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
                        style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>
                    {/* Pending Action: perpanjang deadline overdue (kendala bisa dari sisi user) */}
                    {newActivity.new_status === "Pending Action" && (
                      <div className="rounded-lg p-2.5" style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.25)' }}>
                        <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-orange-700">⏱️ Perpanjang Overdue</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} value={newActivity.extend_days}
                            onChange={e => setNewActivity({ ...newActivity, extend_days: e.target.value })}
                            placeholder="0" className="w-20 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-orange-500/40"
                            style={{ background: 'white', border: '1px solid rgba(0,0,0,0.12)' }} />
                          <span className="text-[11px] font-semibold text-orange-700">hari dari sekarang</span>
                        </div>
                        <p className="text-[9px] text-orange-500 mt-1">Deadline overdue digeser sesuai hari yang dipilih. Kosong/0 = deadline tidak diubah.</p>
                      </div>
                    )}
                  </>
                )}

                {/* Assign to Services */}
                {currentUserTeamType !== "Team Services" && newActivity.new_status === "In Progress" && (
                  <div className="rounded-lg p-2.5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <input type="checkbox" id="assign-svc-r" checked={newActivity.assign_to_services}
                        onChange={e => setNewActivity({ ...newActivity, assign_to_services: e.target.checked, services_assignee: "" })}
                        className="w-3.5 h-3.5 accent-red-600" />
                      <label htmlFor="assign-svc-r" className="text-[10px] font-bold text-red-700">🔧 Teruskan ke Team Services</label>
                    </div>
                    {newActivity.assign_to_services && (
                      <p className="text-[10px] text-red-500 mt-1 font-medium">
                        Ticket akan dikirim ke Admin Team Services. Mereka yang akan assign ke anggota tim mereka.
                      </p>
                    )}
                  </div>
                )}

                {/* Photo */}
                <div>
                  <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">📷 Foto Bukti</label>
                  <input type="file" accept="image/jpeg,image/jpg,image/png"
                    onChange={e => setNewActivity({ ...newActivity, photo: e.target.files?.[0] || null })}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-red-50 file:text-red-700"
                    style={{ borderColor: "rgba(0,0,0,0.12)" }} />
                </div>

                <button onClick={addActivity}
                  disabled={uploading || (!newActivity.notes && !["Pending","Call","Onsite","In Progress","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart","Process Repair"].includes(newActivity.new_status))}
                  className="w-full text-white py-2.5 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 4px 14px rgba(220,38,38,0.35)" }}>
                  {uploading ? "⏳ Menyimpan..." : "💾 Simpan Activity"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
