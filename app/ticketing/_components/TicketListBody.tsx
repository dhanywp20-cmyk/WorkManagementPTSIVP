'use client';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  ListEmptyState, ErrorState, MobileListCard, MobileCardBadge,
  ViewIconBtn, DeleteIconBtn, FlowchartIconBtn, PrintIconBtn, ApproveIconBtn, ReopenIconBtn, OverdueIconBtn,
} from '@/components/shared';
import { Ico } from './Ico';
import { cetakTicket } from './cetak-ticket';
import type { Ticket, TeamMember, User, OverdueSetting } from './shared';
import { formatDateTime, statusColors } from './shared';

/**
 * Isi "Ticket List": error/loading/kosong, kartu mobile, tabel desktop, dan
 * paginasi keduanya - dipindah dari app/ticketing/page.tsx apa adanya (JSX
 * identik). State & handler tetap di page.tsx, komponen ini murni
 * presentasional. Digabung satu berkas (bukan dipecah mobile/desktop
 * terpisah) karena keduanya berbagi cabang error/loading/kosong yang sama.
 */
export function TicketListBody({
  fetchError, setFetchError, fetchData, ticketsLoading,
  searchProject, setSearchProject, searchSalesName, setSearchSalesName,
  filterStatus, setFilterStatus, filterYear, setFilterYear,
  filteredTickets, paginatedTickets, tickets, users, teamMembers,
  isTicketOverdue, getOverdueSetting, getWarrantyInfo, bolehUpdateTicket,
  canApproveAssign, canManageTickets, currentUserTeamType,
  bukaDetailTicket, bukaRingkasanAktivitas, bukaApprovalUntukTicket,
  bukaReopenTicket, bukaDeleteTicket, bukaOverdueSetting,
  currentPage, setCurrentPage, totalPages, ITEMS_PER_PAGE,
  selectMode, selectedIds, toggleSelectId, toggleSelectAll,
  productFilter, setProductFilter, ticketListRef,
}: {
  fetchError: string | null;
  setFetchError: Dispatch<SetStateAction<string | null>>;
  fetchData: () => void;
  ticketsLoading: boolean;
  searchProject: string;
  setSearchProject: Dispatch<SetStateAction<string>>;
  searchSalesName: string;
  setSearchSalesName: Dispatch<SetStateAction<string>>;
  filterStatus: string;
  setFilterStatus: Dispatch<SetStateAction<string>>;
  filterYear: string;
  setFilterYear: Dispatch<SetStateAction<string>>;
  filteredTickets: Ticket[];
  paginatedTickets: Ticket[];
  tickets: Ticket[];
  users: User[];
  teamMembers: TeamMember[];
  isTicketOverdue: (t: Ticket) => boolean;
  getOverdueSetting: (id: string) => OverdueSetting | undefined;
  getWarrantyInfo: (projectName: string) => { isIn: boolean; diffDays: number; wy: number; expiryStr: string } | null;
  bolehUpdateTicket: (t: Ticket) => boolean;
  canApproveAssign: boolean;
  canManageTickets: boolean;
  currentUserTeamType: string;
  bukaDetailTicket: (t: Ticket) => void;
  bukaRingkasanAktivitas: (t: Ticket) => void;
  bukaApprovalUntukTicket: (t: Ticket) => void;
  bukaReopenTicket: (t: Ticket) => void;
  bukaDeleteTicket: (t: Ticket) => void;
  bukaOverdueSetting: (t: Ticket) => void;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  ITEMS_PER_PAGE: number;
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelectId: (id: string) => void;
  toggleSelectAll: () => void;
  productFilter: string | null;
  setProductFilter: Dispatch<SetStateAction<string | null>>;
  ticketListRef: RefObject<HTMLDivElement | null>;
}) {
  const router = useRouter();

  if (fetchError) return <ErrorState message={fetchError} onRetry={() => { setFetchError(null); fetchData(); }} />;

  if (ticketsLoading) return (
    <div className="space-y-3 py-2 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-4 border border-gray-200">
          <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-2/5"></div><div className="h-3 bg-gray-100 rounded w-1/4"></div></div>
          <div className="h-4 bg-gray-200 rounded w-1/6"></div><div className="h-4 bg-gray-200 rounded w-1/5"></div><div className="h-6 bg-gray-200 rounded-full w-20"></div><div className="h-8 bg-gray-200 rounded-lg w-16"></div>
        </div>
      ))}
      <div className="flex items-center justify-center gap-3 py-4 text-gray-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div><span className="text-sm font-medium">Memuat daftar ticket...</span></div>
    </div>
  );

  if (filteredTickets.length === 0) return (
    <ListEmptyState
      adaFilterAktif={searchProject.trim() !== '' || searchSalesName.trim() !== '' || filterStatus !== 'All' || filterYear !== 'all'}
      onReset={() => { setSearchProject(''); setSearchSalesName(''); setFilterStatus('All'); setFilterYear('all'); }}
      icon="🎫"
      judulKosong="Belum ada tiket"
      deskripsiKosong="Tiket kendala yang dilaporkan akan muncul di sini."
    />
  );

  return (
    <>
      {/* ── MOBILE: Card view (hidden on md+) ── */}
      <div className="md:hidden divide-y divide-gray-100">
        {paginatedTickets.map((ticket) => {
          const overdue = isTicketOverdue(ticket);
          const overdueSetting = getOverdueSetting(ticket.id);
          const isActiveOverdue = overdue && ticket.status !== "Solved";
          return (
            <MobileListCard
              key={ticket.id}
              highlight={isActiveOverdue}
              accent={isActiveOverdue ? "#f87171" : undefined}
              titlePrefix={isActiveOverdue ? <Ico name="alert" className="w-3.5 h-3.5 text-red-500 shrink-0" /> : undefined}
              title={ticket.project_name}
              meta={<>
                {ticket.address && (
                  <p className="truncate flex items-center gap-1"><Ico name="pin" className="w-3 h-3 shrink-0" />{ticket.address.split(',')[0]}</p>
                )}
                <p>{ticket.created_at ? formatDateTime(ticket.created_at) : '—'}</p>
              </>}
              badges={<>
                <MobileCardBadge className={ticket.status === "Waiting Approval" ? statusColors["Waiting Approval"] : statusColors[ticket.status] || statusColors["Pending"]}>
                  {ticket.status === "Waiting Approval" ? "⏳ Waiting" : ticket.status}
                </MobileCardBadge>
                {overdue && (
                  <MobileCardBadge className={ticket.status === "Solved" ? "bg-purple-100 text-purple-800 border-purple-400" : statusColors["Overdue"]}>
                    {ticket.status === "Solved" ? "⚠️ Overdue" : "🚨 Overdue"}
                  </MobileCardBadge>
                )}
              </>}
              fields={[
                { label: "Issue",   value: ticket.issue_case },
                { label: "Handler", value: ticket.assign_name || '—' },
                { label: "Product", value: ticket.product, valueClass: "text-indigo-600 font-semibold", hide: !ticket.product },
                { label: "Sales",   value: ticket.sales_name, hide: !ticket.sales_name },
                { label: "SN",      value: ticket.sn_unit, span2: true, valueClass: "text-gray-600", hide: !ticket.sn_unit },
              ]}
              actions={<>
                <ViewIconBtn onClick={() => bukaDetailTicket(ticket)} title="Detail" />
                <FlowchartIconBtn onClick={() => bukaRingkasanAktivitas(ticket)} />
                <PrintIconBtn onClick={() => cetakTicket(ticket)} />
                {canApproveAssign && ticket.status === "Waiting Approval" && (
                  <ApproveIconBtn onClick={() => bukaApprovalUntukTicket(ticket)} pulse />
                )}
                {/* M2: disamakan dengan detail popup - Reopen PTS ini bukan
                    urusan Team Services (mereka punya Reopen Services sendiri,
                    lihat C2), tanpa syarat ini tombol tampil di list tapi
                    hilang begitu ticket yang sama dibuka di detail. */}
                {ticket.status === "Solved" && bolehUpdateTicket(ticket) && currentUserTeamType !== "Team Services" && (
                  <ReopenIconBtn onClick={() => bukaReopenTicket(ticket)} />
                )}
                {canManageTickets && (
                  <DeleteIconBtn onClick={() => bukaDeleteTicket(ticket)} />
                )}
                {canManageTickets && (
                  <OverdueIconBtn onClick={() => bukaOverdueSetting(ticket)} active={!!overdueSetting} />
                )}
              </>}
            />
          );
        })}
        {/* Mobile pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white/90">
          <span className="text-xs text-gray-400">{filteredTickets.length} tiket</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30">‹ Prev</button>
              <span className="text-xs text-gray-500 font-medium">{currentPage}/{totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30">Next ›</button>
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP: Table view (hidden on mobile) ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full table-fixed border-collapse table-zebra" style={{ background: "transparent", minWidth: '1100px' }}>
          <colgroup>
            <col style={{ width: "3%" }} />   {/* No */}
            <col style={{ width: "15%" }} />  {/* Project / Lokasi*/}
            <col style={{ width: "9%" }} />   {/* Warranty */}
            <col style={{ width: "16%" }} />  {/* Product */}
            <col style={{ width: "12%" }} />   {/* SN Unit */}
            <col style={{ width: "13%" }} />  {/* Issue */}
            <col style={{ width: "9%" }} />   {/* Assigned */}
            <col style={{ width: "7%" }} />   {/* Status */}
            <col style={{ width: "7%" }} />   {/* Sales */}
            <col style={{ width: "10%" }} />  {/* Action */}
          </colgroup>
          {/* Header menempel saat digulir: daftar tiket bisa panjang, dan tanpa ini
              pembaca kehilangan acuan kolom begitu baris pertama lewat layar. */}
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200" style={{ background: "#f8fafc" }}>
              <th className="px-2 py-3 text-center text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                {selectMode && canManageTickets
                  ? <input type="checkbox"
                      checked={selectedIds.size === filteredTickets.length && filteredTickets.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded accent-red-600 cursor-pointer" title="Pilih Semua" />
                  : 'No'}
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Project / Lokasi</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Warranty</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Product</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">SN Unit</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Issue</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Assigned</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Sales</th>
              <th className="px-2 py-3 text-center text-[11px] font-bold text-slate-600 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTickets.map((ticket, index) => {
              const overdue = isTicketOverdue(ticket);
              const overdueSetting = getOverdueSetting(ticket.id);
              const isSolvedOverdue = overdue && ticket.status === "Solved";
              const isActiveOverdue = overdue && ticket.status !== "Solved";
              return (
                <tr key={ticket.id} className={`stagger-item border-b border-gray-100 hover:bg-gray-50/70 transition-colors ${isActiveOverdue ? "bg-red-50 border-l-4 border-l-red-400" : isSolvedOverdue ? "bg-purple-50/60 border-l-4 border-l-purple-300" : ""}`}>
                  <td className="px-2 py-3 align-middle text-center" onClick={e => e.stopPropagation()}>
                    {selectMode && canManageTickets
                      ? <input type="checkbox" checked={selectedIds.has(ticket.id)}
                          onChange={() => toggleSelectId(ticket.id)}
                          className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                      : <span className="text-[11px] font-bold text-gray-400">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-start gap-1">
                      {isActiveOverdue && <span className="mt-0.5 shrink-0" title="Overdue!"><Ico name="alert" className="w-3.5 h-3.5 text-red-500" /></span>}
                      <div className="font-bold text-gray-800 text-sm break-words leading-tight">{ticket.project_name}</div>
                    </div>
                    {ticket.address && (
                      <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-0.5">
                        <Ico name="pin" className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ticket.address.split(',')[0]}</span>
                      </div>
                    )}

                    <div className="text-[10px] text-gray-400 mt-1">{ticket.created_at ? formatDateTime(ticket.created_at) : "-"}</div>
                    {isActiveOverdue && <div className="text-xs text-red-600 font-bold mt-0.5">⏰ OVERDUE</div>}
                  </td>
                  {/* Warranty cell */}
                  <td className="px-3 py-3 align-middle">
                    {(() => {
                      const w = getWarrantyInfo(ticket.project_name);
                      if (!w) return <span className="text-gray-300 text-xs">—</span>;
                      return (
                        <div>
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={w.isIn
                              ? { background: "rgba(14,165,233,0.14)", color: "#0369a1" }
                              : { background: "rgba(239,68,68,0.12)", color: "#dc2626" }}>
                            {w.isIn ? "🛡️" : "⚠️"} {w.isIn ? "In" : "Out"}
                          </span>
                          <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">
                            {w.wy}Y · s/d {w.expiryStr}
                          </div>
                          <div className="text-[9px] font-semibold mt-0.5"
                            style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                            {w.isIn ? `sisa ${w.diffDays}h` : `lewat ${Math.abs(w.diffDays)}h`}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {ticket.product && (
                      /*
                        text-left BUKAN gaya bawaan di sini: peramban memberi
                        <button> text-align:center, jadi begitu nama produk
                        cukup panjang untuk turun ke baris kedua, teksnya
                        menengah sendiri sementara seluruh kolom lain rata
                        kiri. Baris pendek tidak terlihat salah karena
                        tombolnya sepas isinya - yang panjang yang membuka
                        perbedaannya.
                      */
                      <button onClick={() => { setProductFilter(prev => prev === ticket.product ? null : (ticket.product ?? null)); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                        className="text-left text-[12px] font-semibold px-1.5 py-0.5 rounded break-words leading-tight transition-all inline-block"
                        style={{ background: productFilter === ticket.product ? '#6366f1' : '#eef2ff', color: productFilter === ticket.product ? 'white' : '#4338ca' }}>
                        📦 {ticket.product}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle py-4"><div className="text-[13px] text-gray-600 break-words leading-tight">{ticket.sn_unit || "—"}</div></td>
                  <td className="px-3 py-3 align-middle py-4"><div className="text-[13px] text-gray-700 break-words leading-tight">{ticket.issue_case}</div></td>
                  <td className="px-3 py-3 align-middle py-4">
                    <div className="text-sm text-gray-700 break-words leading-tight">{ticket.assign_name}</div>
                    {/* Tampilkan team handler (dari users), bukan current_team ticket */}
                    {(() => {
                      const handler = teamMembers.find(m => m.name === ticket.assign_name);
                      const handlerTeam = handler?.team_type || "Team PTS IVP";
                      const isServices = ticket.current_team === "Team Services" || !!ticket.services_status;
                      return (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs font-semibold" style={{ color: handlerTeam === "Team Services" ? "#7c3aed" : "#2563eb" }}>
                            {handlerTeam}
                          </span>
                          {isServices && handlerTeam !== "Team Services" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                              → Svc
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 align-middle py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-2 py-0.5 text-xs font-bold ${ticket.status === "Waiting Approval" ? statusColors["Waiting Approval"] : statusColors[ticket.status] || statusColors["Pending"]}`}>{ticket.status === "Waiting Approval" ? "⏳ Waiting Approval" : ticket.status}</span>
                      {overdue && <span className={`px-2 py-0.5 text-xs font-bold ${ticket.status === "Solved" ? "bg-purple-100 text-purple-800 border-purple-400" : statusColors["Overdue"]}`}>{ticket.status === "Solved" ? "⚠️ Solved Overdue" : "🚨 Overdue"}</span>}
                      {ticket.services_status && <span className={`px-2 py-0.5 text-xs font-bold ${statusColors[ticket.services_status]}`}>Svc: {ticket.services_status}</span>}
                      {ticket.status === "Onsite" && (
                        <button
                          onClick={e => { e.stopPropagation(); router.push('/reminder-schedule'); }}
                          className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors"
                          style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                          🗓️ Jadwal
                        </button>
                      )}
                    </div>
                   </td>
                  <td className="px-2 py-3 align-middle"><div className="text-xs text-gray-600 break-words leading-tight">{ticket.sales_name || "—"}</div>{ticket.sales_division && <div className="text-xs text-purple-500 font-semibold mt-0.5">{ticket.sales_division}</div>}</td>
                  <td className="px-1 py-2 align-middle">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {/* Activity log badge + View */}
                      <div className="relative inline-flex">
                        <ViewIconBtn onClick={() => bukaDetailTicket(ticket)} title="Detail" />
                        {ticket.activity_logs && ticket.activity_logs.length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">{ticket.activity_logs.length}</span>
                        )}
                      </div>
                      {/* Flowchart */}
                      <FlowchartIconBtn onClick={() => bukaRingkasanAktivitas(ticket)} />
                      {/* Print PDF */}
                      <PrintIconBtn onClick={() => cetakTicket(ticket)} />
                      {/* Waiting Approval — admin only */}
                      {canApproveAssign && ticket.status === "Waiting Approval" && (
                        <ApproveIconBtn onClick={() => bukaApprovalUntukTicket(ticket)} pulse />
                      )}
                      {/* Re-open */}
                      {ticket.status === "Solved" && bolehUpdateTicket(ticket) && (
                        <ReopenIconBtn onClick={() => bukaReopenTicket(ticket)} />
                      )}
                      {/* Hapus — admin only */}
                      {canManageTickets && (
                        <DeleteIconBtn onClick={() => bukaDeleteTicket(ticket)} />
                      )}
                      {/* Overdue Setting — admin only */}
                      {canManageTickets && (
                        <OverdueIconBtn onClick={() => bukaOverdueSetting(ticket)} active={!!overdueSetting} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 flex-wrap gap-2" style={{ background: "rgba(255,255,255,0.97)" }}>
          <span className="text-xs text-gray-400">{filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""} ditemukan</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button aria-label="Awal" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all" title="First page">«</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">‹ Prev</button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${currentPage === page ? 'text-white border-0' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      style={currentPage === page ? { background: 'linear-gradient(135deg,#dc2626,#b91c1c)' } : {}}>
                      {page}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">Next ›</button>
              <button aria-label="Akhir" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all" title="Last page">»</button>
            </div>
          )}
          <span className="text-xs text-gray-400">
            {filteredTickets.length > 0 ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}` : "0"} of {tickets.length}
          </span>
        </div>
      </div>{/* end hidden md:block */}
    </>
  );
}
