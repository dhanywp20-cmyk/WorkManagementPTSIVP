'use client';
import type { ReactNode } from 'react';
import { ModalPortal } from '@/components/shared';
import type { Ticket, TeamMember, ProjectReminderRef } from './shared';

/**
 * Modal "Ticket Approval" (Admin/Manager menyetujui tiket Waiting
 * Approval) - dipindah dari app/ticketing/page.tsx apa adanya (JSX
 * identik). State & handler tetap di page.tsx, komponen ini murni
 * presentasional.
 */
export function ApprovalModal({
  pendingApprovalTickets, projectReminders, approvalAssignees, setApprovalAssignees,
  teamPTSMembers, supervisorMembers, approvingId, uploading,
  jalankanApproveTicket, rejectTicket, onClose,
}: {
  pendingApprovalTickets: Ticket[];
  projectReminders: Record<string, ProjectReminderRef[]>;
  approvalAssignees: Record<string, string>;
  setApprovalAssignees: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  teamPTSMembers: TeamMember[];
  supervisorMembers: TeamMember[];
  approvingId: string | null;
  uploading: boolean;
  jalankanApproveTicket: (ticket: Ticket) => void;
  rejectTicket: (ticket: Ticket) => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
          <div className="p-6 flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-3xl">⏳</span><div><h3 className="text-xl font-bold text-white">Ticket Approval</h3><p className="text-sm text-white/90">{pendingApprovalTickets.length} ticket menunggu persetujuan</p></div></div><button aria-label="Tutup" onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all">✕</button></div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {pendingApprovalTickets.length === 0 ? (<div className="text-center py-12"><div className="text-5xl mb-3">✅</div><p className="text-gray-500 font-medium">Tidak ada ticket yang menunggu approval</p></div>) : pendingApprovalTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.1)", border: "2px solid rgba(245,158,11,0.3)" }}>
                <div className="flex justify-between items-start mb-3"><div><p className="font-bold text-lg text-gray-800">🏢 {ticket.project_name}</p><p className="text-sm text-gray-600 mt-0.5">⚠️ {ticket.issue_case}</p>{ticket.description && <p className="text-xs text-gray-500 mt-1">{ticket.description}</p>}<div className="flex gap-2 mt-2 flex-wrap text-xs text-gray-500">{ticket.customer_phone && <span>👤 {ticket.customer_phone}</span>}{ticket.sales_name && <span>💼 {ticket.sales_name}</span>}{ticket.sn_unit && <span>🔢 {ticket.sn_unit}</span>}</div><p className="text-xs text-orange-700 font-semibold mt-2">Dibuat oleh: {ticket.created_by || "-"} • {ticket.date}</p></div><span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-orange-100 text-orange-800 border-orange-400 whitespace-nowrap ml-2">⏳ Waiting Approval</span></div>

                {/* ── Referensi Project dari Reminder Schedule ── */}
                {(() => {
                  const key = (ticket.project_name || "").trim().toLowerCase();
                  const refs = projectReminders[key];
                  if (!refs || refs.length === 0) return null;
                  return (
                    <div className="mb-3 rounded-xl p-3" style={{ background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.35)" }}>
                      <p className="text-xs font-bold text-emerald-700 mb-2">📋 Referensi Project di Reminder Schedule</p>
                      {refs.map((ref, idx) => {
                        const bastDate = ref.due_date ? new Date(ref.due_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
                        // Hitung warranty status
                        const wy = ref.warranty_years as 1 | 2 | 3 | null | undefined;
                        let warrantyBadge: ReactNode = null;
                        if (wy && ref.due_date) {
                          const expiry = new Date(ref.due_date + "T00:00:00");
                          expiry.setFullYear(expiry.getFullYear() + wy);
                          const today = new Date(); today.setHours(0, 0, 0, 0);
                          const isIn = today <= expiry;
                          const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
                          const expiryStr = expiry.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
                          warrantyBadge = (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                              style={isIn ? { background: "rgba(14,165,233,0.18)", color: "#0369a1" } : { background: "rgba(239,68,68,0.15)", color: "#dc2626" }}>
                              {isIn ? "🛡️ In Warranty" : "⚠️ Out of Warranty"}
                              <span className="opacity-70">· s/d {expiryStr} ({isIn ? `sisa ${diffDays}h` : `lewat ${Math.abs(diffDays)}h`})</span>
                            </span>
                          );
                        }
                        return (
                          <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(16,185,129,0.15)", color: "#065f46" }}>
                              {ref.category === "Konfigurasi & Training" ? "📌" : "⚙️"} {ref.category}
                            </span>
                            <span className="text-gray-600">🗓️ BAST: <strong className="text-emerald-800">{bastDate}</strong></span>
                            {ref.assign_name && ref.assign_name !== "-" && (
                              <span className="text-gray-600">👷 Handler: <strong className="text-emerald-800">{ref.assign_name}</strong></span>
                            )}
                            {warrantyBadge && <div className="w-full mt-0.5">{warrantyBadge}</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(245,158,11,0.3)" }}>
                  <label className="block text-sm font-bold text-gray-700 mb-2">👨‍💼 Assign ke Team PTS IVP:</label>
                  {/* Suggested handler dari referensi project */}
                  {(() => {
                    const key = (ticket.project_name || "").trim().toLowerCase();
                    const refs = projectReminders[key];
                    if (!refs || refs.length === 0) return null;
                    const suggested = refs.filter(r => r.assign_name && r.assign_name !== "-");
                    if (suggested.length === 0) return null;
                    // Deduplicate by assign_name
                    const unique = Array.from(new Map(suggested.map(r => [r.assign_name, r])).values());
                    return (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">💡 Saran Handler (handle project ini sebelumnya)</p>
                        <div className="flex flex-wrap gap-2">
                          {unique.map((ref, idx) => {
                            const isSelected = approvalAssignees[ticket.id] === ref.assign_name;
                            return (
                              <button key={idx}
                                onClick={() => setApprovalAssignees(prev => ({ ...prev, [ticket.id]: ref.assign_name }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${isSelected ? "bg-emerald-600 text-white border-emerald-600 scale-105" : "bg-emerald-50 text-emerald-800 border-emerald-400 hover:bg-emerald-100"}`}>
                                ⭐ {ref.assign_name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 mb-2">Atau pilih anggota lain:</p>
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <select aria-label="Pilih handler / Supervisor"
                      className="flex-1 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                      style={{ border: "2px solid rgba(245,158,11,0.3)", background: "white" }}
                      value={approvalAssignees[ticket.id] ?? ""}
                      onChange={(e) => setApprovalAssignees(prev => ({ ...prev, [ticket.id]: e.target.value }))}>
                      <option value="">Pilih handler / Supervisor</option>
                      <optgroup label="👷 Assign langsung ke Team PTS">
                        {teamPTSMembers.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}
                      </optgroup>
                      {supervisorMembers.length > 0 && (
                        <optgroup label="🎯 Route ke Supervisor">
                          {supervisorMembers.map((m) => (<option key={`sup-${m.id}`} value={`SUP::${m.id}::${m.name}`}>{m.name} (Supervisor)</option>))}
                        </optgroup>
                      )}
                    </select>
                    <button onClick={() => jalankanApproveTicket(ticket)}
                      disabled={uploading || !approvalAssignees[ticket.id]} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                      {approvingId === ticket.id ? "⏳ Memproses..." : "✅ Approve"}
                    </button>
                    <button onClick={() => rejectTicket(ticket)} disabled={uploading} className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-40 text-sm">❌ Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
