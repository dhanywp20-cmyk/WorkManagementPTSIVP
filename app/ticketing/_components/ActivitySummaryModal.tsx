'use client';
import { ModalPortal, AuditTrailPanel, FlowSteps } from '@/components/shared';
import type { Ticket, User } from './shared';
import { formatDateTime, ringkasPenanganan, statusColors } from './shared';

/**
 * Modal "Activity Summary" (riwayat lengkap satu ticket) - dipindah dari
 * app/ticketing/page.tsx apa adanya (JSX identik). State & handler tetap
 * di page.tsx, komponen ini murni presentasional.
 */
export function ActivitySummaryModal({
  summaryTicket, users, getWarrantyInfo, onClose,
}: {
  summaryTicket: Ticket;
  users: User[];
  /** Wrapper page.tsx yang sudah terikat ke state projectReminders. */
  getWarrantyInfo: (projectName: string) => { isIn: boolean; diffDays: number; wy: number } | null;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-2">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full h-[96vh] flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(59,130,246,0.5)" }}>
          <div className="p-5 border-b flex-shrink-0" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderColor: "rgba(0,0,0,0.1)" }}>
            <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-2xl">🔄</span><div><h3 className="text-lg font-bold text-white">Activity Summary</h3><p className="text-sm text-blue-100 font-medium">{summaryTicket.project_name}</p><p className="text-xs text-blue-200">{summaryTicket.issue_case}</p></div></div><button aria-label="Tutup" onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all text-lg">✕</button></div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-4">
              {/* Baris pembuatan diturunkan dari ticket-nya sendiri: logAudit
                  baru mencatat 'create' sejak perbaikan terakhir, jadi tanpa
                  ini seluruh ticket LAMA tampak tidak punya pangkal — padahal
                  created_by & created_at-nya tersimpan sejak awal. */}
              {(() => {
                const pembuat = users.find(u => u.username === summaryTicket.created_by);
                const namaPembuat = pembuat?.full_name || summaryTicket.created_by || null;
                const atasNama = summaryTicket.sales_name || "";
                return (
                  <AuditTrailPanel targetId={summaryTicket.id} modul="ticket"
                    awal={{
                      oleh: namaPembuat,
                      waktu: summaryTicket.created_at ?? null,
                      keterangan: `Ticket dibuat · ${summaryTicket.issue_case}`
                        + (atasNama && namaPembuat && atasNama !== namaPembuat ? ` · atas nama Sales ${atasNama}` : ''),
                    }} />
                );
              })()}
            </div>

            {/* Alur tiket - diagram yang sama dengan Request Schedule dan
                Request Design Project. Ticketing satu-satunya yang belum
                memakainya, jadi pembacanya harus menyimpulkan sendiri sudah
                sampai mana sebuah tiket, dari daftar riwayat.

                Tahap "Ke Services" hanya disisipkan bila tiketnya memang
                pernah dilimpahkan. Dasarnya ringkasPenanganan(), helper yang
                sama yang dipakai layar View Ticket dan lembar cetak - supaya
                ketiganya tidak pernah menjawab berbeda untuk tiket yang sama. */}
            <div className="mb-5">
              {(() => {
                const t = summaryTicket;
                const ringkas = ringkasPenanganan(t);
                const pembuat = users.find(u => u.username === t.created_by);
                const sudahAssign = !!(t.assign_name && t.assign_name.trim() !== "");
                const menungguSupervisor = t.routing_status === "supervisor_assign";
                const selesai = t.status === "Solved" || t.status === "Completed";
                const batal   = t.status === "Rejected" || t.status === "Cancelled";

                const tahap = [
                  { label: "Diajukan",   pelaku: t.sales_name || pembuat?.full_name || t.created_by || "Sales" },
                  { label: "Di-assign",  pelaku: menungguSupervisor ? "Supervisor" : "Admin" },
                  { label: "Dikerjakan", pelaku: ringkas.handlerPTS || t.assign_name || "Team PTS" },
                  ...(ringkas.keServices
                    ? [{ label: "Ke Services", pelaku: t.services_status || "Team Services" }]
                    : []),
                  { label: "Selesai",    pelaku: ringkas.keServices ? "Services" : "Team PTS" },
                ];

                //  0 diajukan · 1 menunggu assign · 2 dikerjakan · ... · terakhir selesai
                //  tahap.length berarti seluruh alur tuntas (indeks di luar daftar)
                const aktif = selesai ? tahap.length : sudahAssign ? 2 : 1;

                return <FlowSteps judul="Alur Tiket" aktif={aktif} dibatalkan={batal} steps={tahap} />;
              })()}
            </div>

            <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-xl text-xs" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
              <span className="flex items-center gap-1"><span className="text-gray-500">👤 Handler:</span><span className="font-bold">{summaryTicket.assign_name || "-"}</span></span><span className="text-gray-300">|</span>
              <span className="flex items-center gap-1"><span className="text-gray-500">📅 Dibuat:</span><span className="font-bold">{summaryTicket.created_at ? formatDateTime(summaryTicket.created_at) : "-"}</span></span><span className="text-gray-300">|</span>
              <span className={`px-2 py-0.5 rounded-full font-bold border ${statusColors[summaryTicket.status]}`}>{summaryTicket.status}</span>
              {summaryTicket.services_status && (<><span className="text-gray-300">|</span><span className={`px-2 py-0.5 rounded-full font-bold border ${statusColors[summaryTicket.services_status]}`}>Svc: {summaryTicket.services_status}</span></>)}
              {/* Warranty badge */}
              {(() => {
                const w = getWarrantyInfo(summaryTicket.project_name);
                if (!w) return null;
                return (<>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px]"
                    style={w.isIn
                      ? { background: "rgba(14,165,233,0.15)", color: "#0369a1", border: "1px solid rgba(14,165,233,0.3)" }
                      : { background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.3)" }}>
                    {w.isIn ? "🛡️" : "⚠️"} {w.isIn ? "In Warranty" : "Out of Warranty"}
                    <span className="opacity-70 ml-0.5">· {w.wy}Y · {w.isIn ? `sisa ${w.diffDays}h` : `lewat ${Math.abs(w.diffDays)}h`}</span>
                  </span>
                </>);
              })()}
            </div>
            {!summaryTicket.activity_logs || summaryTicket.activity_logs.length === 0 ? (<div className="text-center py-10 text-gray-400"><div className="text-5xl mb-3">📭</div><p className="font-semibold">Belum ada activity yang tercatat</p></div>) : (
              <div className="relative">
                <div className="flex items-center gap-3 mb-1"><div className="flex flex-col items-center"><div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-base shadow-md">🎫</div></div><div className="flex-1 rounded-xl px-4 py-2" style={{ background: "rgba(59,130,246,0.1)", border: "2px solid rgba(59,130,246,0.3)" }}><p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Ticket Dibuat</p><p className="text-sm font-semibold text-gray-800">{summaryTicket.project_name}</p><p className="text-xs text-gray-500">{summaryTicket.created_at ? formatDateTime(summaryTicket.created_at) : "-"}</p></div></div>
                {[...summaryTicket.activity_logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((log, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  const isSolved = log.new_status === "Solved";
                  const isServices = log.assigned_to_services;
                  const nodeColor = isSolved ? "bg-green-500" : isServices ? "bg-red-500" : log.new_status === "In Progress" ? "bg-blue-500" : "bg-yellow-500";
                  const cardBorder = isSolved ? "border-green-300 bg-green-50" : isServices ? "border-red-300 bg-red-50" : log.new_status === "In Progress" ? "border-blue-300 bg-blue-50" : "border-yellow-300 bg-yellow-50";
                  return (
                    <div key={log.id}>
                      <div className="flex items-stretch gap-3"><div className="flex flex-col items-center"><div className="w-0.5 bg-gray-300 flex-1 mx-auto" style={{ minHeight: "16px" }}></div></div><div className="flex-1" /></div>
                      <div className="flex items-start gap-3"><div className="flex flex-col items-center flex-shrink-0"><div className={`w-9 h-9 rounded-full ${nodeColor} flex items-center justify-center text-white text-xs font-bold shadow-md`}>{isSolved ? "✅" : isServices ? "🔄" : idx + 1}</div>{!isLast && <div className="w-0.5 bg-gray-300 flex-1" style={{ minHeight: "12px" }}></div>}</div><div className={`flex-1 border-2 rounded-xl px-4 py-3 mb-1 ${cardBorder}`}><div className="flex justify-between items-start mb-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-bold text-gray-800">{log.handler_name}</span><span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">{log.team_type}</span></div><span className={`text-xs px-2 py-0.5 rounded-full font-bold border flex-shrink-0 ml-2 ${statusColors[log.new_status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>{log.new_status}</span></div><p className="text-xs text-gray-500 mb-2">{formatDateTime(log.created_at)}</p>{log.action_taken && (<div className="rounded-lg px-3 py-1.5 mb-2" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}><p className="text-xs font-bold text-blue-700">🔧 Action:</p><p className="text-xs text-gray-800">{log.action_taken}</p></div>)}<div className="rounded-lg px-3 py-1.5" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}><p className="text-xs font-bold text-gray-600">📝 Notes:</p><p className="text-xs text-gray-800 whitespace-pre-line">{log.notes}</p></div>{isServices && <div className="mt-2 flex items-center gap-1 text-xs font-bold text-red-700 rounded-lg px-2 py-1" style={{ background: "rgba(220,38,38,0.1)" }}><span>🔄</span> Diteruskan ke Team Services</div>}{log.photo_url && <div className="mt-2"><img src={log.photo_url} alt="bukti" loading="lazy" decoding="async" className="max-h-28 rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(log.photo_url!, "_blank")} /></div>}{log.file_url && <a href={log.file_url} download={log.file_name} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 rounded-lg px-2 py-1 hover:bg-blue-200 transition-colors" style={{ background: "rgba(59,130,246,0.1)" }}>📎 {log.file_name || "Download Report"}</a>}</div></div>
                    </div>
                  );
                })}
                <div className="flex items-stretch gap-3"><div className="flex flex-col items-center"><div className="w-0.5 bg-gray-300 mx-auto" style={{ minHeight: "16px" }}></div></div><div className="flex-1" /></div>
                <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-base shadow-md flex-shrink-0 ${summaryTicket.status === "Solved" ? "bg-green-600" : "bg-gray-400"}`}>{summaryTicket.status === "Solved" ? "🏁" : "⏳"}</div><div className={`flex-1 rounded-xl px-4 py-2 border-2 ${summaryTicket.status === "Solved" ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-300"}`}><p className={`text-xs font-bold uppercase tracking-wide ${summaryTicket.status === "Solved" ? "text-green-700" : "text-gray-500"}`}>{summaryTicket.status === "Solved" ? "✅ Ticket Selesai" : `⏳ Status: ${summaryTicket.status}`}</p><p className="text-xs text-gray-500 mt-0.5">{summaryTicket.activity_logs?.length || 0} aktivitas tercatat</p></div></div>
              </div>
            )}
          </div>
          <div className="p-4 border-t flex-shrink-0" style={{ background: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.08)" }}><button onClick={onClose} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-900 transition-all">✕ Tutup</button></div>
        </div>
      </div>
    </ModalPortal>
  );
}
