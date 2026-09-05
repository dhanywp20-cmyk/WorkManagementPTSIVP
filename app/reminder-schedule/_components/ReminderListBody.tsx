'use client';
import { useRouter } from 'next/navigation';
import {
  ViewIconBtn, RescheduleIconBtn, ApproveIconBtn, DeleteIconBtn, ActionGroup,
  ErrorState, ListEmptyState, MobileListCard, MobileCardBadge,
} from '@/components/shared';
import { StatusBadge } from './Badges';
import {
  Reminder, TeamUser, GuestUser, Status,
  REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, CATEGORY_CONFIG,
  formatDatetime, isDueToday, layakIncentive, diluarIncentive,
} from './shared';

/**
 * Error/loading/empty state + daftar reminder (kartu mobile & tabel
 * desktop) - dipindah dari app/reminder-schedule/page.tsx apa adanya
 * (JSX identik). State & handler tetap di page.tsx, komponen ini murni
 * presentasional.
 */
export function ReminderListBody({
  fetchError, setFetchError, fetchReminders, listLoading,
  filteredReminders, reminders, groupedReminders,
  filterStatus, filterYear, filterCategory, productFilter, setProductFilter,
  searchProject, searchSales, searchDivisionSales, searchTeamHandler, searchProduct,
  setFilterStatus, setFilterYear, setFilterCategory,
  setSearchProject, setSearchSales, setSearchDivisionSales, setSearchTeamHandler, setSearchProduct,
  setDetailReminder,
  bolehEditReminder, setRescheduleTarget,
  canInternalApprove, setInternalApproveTarget, handleInternalReject,
  canApproveAssign, setApproveTarget, setApproveBatchSiblings, setApproveAssignTo, setApproveDate, setApproveTime,
  handleAdminReject,
  currentUser, openSupervisorAssign,
  isAdmin, isManager,
  syncKeIncentive, syncing,
  openDeleteModal,
  selectMode, selectedIds, setSelectedIds, toggleSelectAll,
  guestUsers,
}: {
  fetchError: string | null;
  setFetchError: (v: string | null) => void;
  fetchReminders: () => void;
  listLoading: boolean;
  filteredReminders: Reminder[];
  reminders: Reminder[];
  groupedReminders: Reminder[][];
  filterStatus: Status | 'all';
  filterYear: string;
  filterCategory: string;
  productFilter: string | null;
  setProductFilter: (v: string | null) => void;
  searchProject: string;
  searchSales: string;
  searchDivisionSales: string;
  searchTeamHandler: string;
  searchProduct: string;
  setFilterStatus: (v: Status | 'all') => void;
  setFilterYear: (v: string) => void;
  setFilterCategory: (v: string) => void;
  setSearchProject: (v: string) => void;
  setSearchSales: (v: string) => void;
  setSearchDivisionSales: (v: string) => void;
  setSearchTeamHandler: (v: string) => void;
  setSearchProduct: (v: string) => void;
  setDetailReminder: (r: Reminder) => void;
  bolehEditReminder: (r: Reminder) => boolean;
  setRescheduleTarget: (r: Reminder) => void;
  canInternalApprove: (r: Reminder) => boolean;
  setInternalApproveTarget: (r: Reminder) => void;
  handleInternalReject: (r: Reminder) => void;
  canApproveAssign: boolean;
  setApproveTarget: (r: Reminder) => void;
  setApproveBatchSiblings: (r: Reminder[]) => void;
  setApproveAssignTo: (v: string) => void;
  setApproveDate: (v: string) => void;
  setApproveTime: (v: string) => void;
  handleAdminReject: (r: Reminder) => void;
  currentUser: TeamUser | null;
  openSupervisorAssign: (r: Reminder, group: Reminder[]) => void;
  isAdmin: boolean;
  isManager: boolean;
  syncKeIncentive: (r: Reminder) => void;
  syncing: string | null;
  openDeleteModal: (r: Reminder) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (updater: (prev: Set<string>) => Set<string>) => void;
  toggleSelectAll: () => void;
  guestUsers: GuestUser[];
}) {
  const router = useRouter();

  return (
    <>
      {fetchError ? (
        <ErrorState message={fetchError} onRetry={() => { setFetchError(null); fetchReminders(); }} />
      ) : listLoading ? (
        <div className="space-y-2 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-3 border border-gray-200">
              <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-2/5"></div><div className="h-2 bg-gray-100 rounded w-1/4"></div></div>
              <div className="h-3 bg-gray-200 rounded w-1/6"></div><div className="h-3 bg-gray-200 rounded w-1/5"></div>
              <div className="h-5 bg-gray-200 rounded-full w-16"></div><div className="h-6 bg-gray-200 rounded-lg w-14"></div>
            </div>
          ))}
        </div>
      ) : filteredReminders.length === 0 ? (
        <ListEmptyState
          adaFilterAktif={
            filterStatus !== 'all' || filterYear !== 'all' || filterCategory !== 'all'
            || productFilter !== null
            || [searchProject, searchSales, searchDivisionSales, searchTeamHandler, searchProduct]
                 .some(v => v.trim() !== '')
          }
          onReset={() => {
            setFilterStatus('all'); setFilterYear('all'); setFilterCategory('all');
            setProductFilter(null);
            setSearchProject(''); setSearchSales(''); setSearchDivisionSales('');
            setSearchTeamHandler(''); setSearchProduct('');
          }}
          icon="🗓️"
          judulKosong="Belum ada reminder"
          deskripsiKosong="Jadwal yang dibuat atau di-request akan muncul di sini."
        />
      ) : (
        <>
        {/* ── MOBILE: Card view ── */}
        {/* MobileListCard - komponen kartu bersama yang sama dipakai
            Ticketing & Request Design Project. Kartu tulisan-tangan
            sebelumnya di sini berulang kali kebobolan elemen tanpa
            truncate/min-w-0 (grid Handler, dst) yang mendorong
            seluruh halaman bisa digeser ke samping - field pada
            komponen bersama ini truncate SEMUANYA secara bawaan,
            jadi bukan lagi sesuatu yang bisa lupa ditulis. */}
        <div className="md:hidden divide-y divide-gray-100">
          {groupedReminders.map((group) => {
            const r = group[0];
            const today = isDueToday(r.due_date);
            const dueDate = new Date(r.due_date + 'T00:00:00');
            const uniqueDates = Array.from(new Set(group.map(gr => gr.due_date))).sort();
            const uniqueAssignNames = Array.from(new Set(group.map(gr => gr.assign_name).filter(Boolean)));
            const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const statusCounts: Record<string, number> = {};
            for (const gr of group) statusCounts[gr.status] = (statusCounts[gr.status] || 0) + 1;
            const statusEntries = Object.entries(statusCounts);
            return (
              <MobileListCard
                key={r.id}
                highlight={today}
                accent={today ? '#f87171' : undefined}
                title={(r.project_name || r.title || '').trim() || '—'}
                onClick={() => setDetailReminder(r)}
                meta={<>
                  {r.address && <p className="truncate">📍 {r.address.split(',')[0]}</p>}
                  <p className="truncate">
                    {uniqueDates.length > 1
                      ? `🗓️ ${uniqueDates.length} hari: ${fmtShort(uniqueDates[0])}–${fmtShort(uniqueDates[uniqueDates.length - 1])}`
                      : `🗓️ ${dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </p>
                </>}
                badges={<>
                  {statusEntries.length === 1
                    ? <StatusBadge status={group[0].status} />
                    : <div className="flex flex-wrap justify-end gap-0.5">{statusEntries.map(([s, n]) => <span key={s} className="flex items-center gap-0.5"><StatusBadge status={s as any} /><span className="text-[8px] text-gray-500">{n}×</span></span>)}</div>}
                  {r.incentive_excluded === true && (
                    <MobileCardBadge className="bg-amber-50 text-amber-700 border border-amber-200"
                      title="Sengaja dikeluarkan dari perhitungan Incentive PTS. Jadwalnya tetap tercatat.">
                      ⛔ di luar Incentive
                    </MobileCardBadge>
                  )}
                </>}
                fields={[
                  { label: 'Kegiatan', value: `${(CATEGORY_CONFIG[r.category] ?? { icon: '📁' }).icon} ${r.category}` },
                  { label: 'Product', value: r.product, valueClass: 'text-indigo-600 font-semibold', hide: !r.product },
                  { label: 'Sales', value: r.sales_name, hide: !r.sales_name },
                  {
                    label: 'Handler',
                    value: uniqueAssignNames.length === 0 ? '—'
                      : uniqueAssignNames.length === 1 ? uniqueAssignNames[0]
                      : `${uniqueAssignNames.join(', ')} (${uniqueAssignNames.length} orang)`,
                  },
                  {
                    label: 'Catatan', span2: true, valueClass: 'text-gray-400',
                    value: r.notes && r.notes.length > 60 ? r.notes.substring(0, 60) + '…' : r.notes,
                    hide: !r.notes || r.notes.includes('[REQUEST SALES]'),
                  },
                ]}
                actions={<>
                  <ViewIconBtn onClick={() => setDetailReminder(r)} title="Detail" />
                  {bolehEditReminder(r) && r.status !== 'done' && (
                    <RescheduleIconBtn onClick={() => setRescheduleTarget(r)} title="Re-Schedule" />
                  )}
                  {canInternalApprove(r) && (
                    <>
                      <ApproveIconBtn onClick={() => setInternalApproveTarget(r)} title="Approve & Teruskan ke Admin" pulse />
                      <button aria-label="Tolak" onClick={() => handleInternalReject(r)} title="Tolak"
                        className="w-7 h-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  )}
                  {canApproveAssign && !r.assigned_to && r.notes?.includes('[REQUEST SALES]') && r.routing_status !== 'internal_review' && (
                    <>
                      <ApproveIconBtn onClick={() => { setApproveTarget(r); setApproveBatchSiblings(group.filter(gr => gr.id !== r.id && gr.batch_id === r.batch_id && !gr.assigned_to)); setApproveAssignTo(''); setApproveDate(r.due_date); setApproveTime(r.due_time); }} title="Approve & Assign" pulse />
                      <button aria-label="Tolak" onClick={() => handleAdminReject(r)} title="Tolak"
                        className="w-7 h-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  )}
                  {currentUser?.id === r.assigned_supervisor_id && r.routing_status === 'supervisor_assign' && (
                    <ApproveIconBtn onClick={() => openSupervisorAssign(r, group)} title="Assign Tim" pulse />
                  )}
                  {(isAdmin || isManager) && layakIncentive(r) && (
                    <button aria-label={`Sync ${r.project_name} ke Incentive PTS`}
                      onClick={() => syncKeIncentive(r)} disabled={syncing === r.id}
                      title={diluarIncentive(r)
                        ? 'Sedang DI LUAR Incentive PTS — klik untuk memasukkannya kembali'
                        : 'Sudah masuk Incentive PTS — klik untuk memastikan ulang'}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 border ${
                        diluarIncentive(r)
                          ? 'bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white border-amber-300'
                          : 'bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border-emerald-200'}`}>
                      {syncing === r.id
                        ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                        : <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                    </button>
                  )}
                  {(isAdmin || isManager) && (
                    <DeleteIconBtn onClick={() => openDeleteModal(r)} title="Hapus" />
                  )}
                </>}
              />
            );
          })}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white/90">
            <span className="text-xs text-gray-400">{groupedReminders.length} event · {filteredReminders.length} jadwal</span>
          </div>
        </div>

        {/* ── DESKTOP: Table view ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', background: 'transparent' }}>
            {/* Sembilan kolom, dijumlahkan TEPAT 100%.
                Sebelumnya ada 10 <col> untuk 9 kolom (sisa kolom
                Garansi yang dibuang) dan totalnya hanya 75% —
                browser membagikan sisa 25% sesuka hati, sehingga
                Action melebar berisi ruang kosong sementara Handler
                terpotong. */}
            <colgroup>
              <col style={{ width: '4%'  }} />{/* No / pilih   */}
              <col style={{ width: '18%' }} />{/* Project      */}
              <col style={{ width: '14%' }} />{/* Product      */}
              <col style={{ width: '12%' }} />{/* Kegiatan     */}
              <col style={{ width: '13%' }} />{/* Sales        */}
              <col style={{ width: '15%' }} />{/* Handler — nama lengkap sering panjang */}
              <col style={{ width: '9%'  }} />{/* Status       */}
              <col style={{ width: '8%'  }} />{/* Tanggal      */}
              <col style={{ width: '7%'  }} />{/* Action       */}
            </colgroup>
            <thead>
              <tr className="border-b-2 border-gray-100" style={{ background: "rgba(255,255,255,0.97)" }}>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">
          {selectMode && (isAdmin || isManager)
            ? <input type="checkbox"
                checked={selectedIds.size === filteredReminders.length && filteredReminders.length > 0}
                onChange={toggleSelectAll} className="w-4 h-4 rounded accent-red-600 cursor-pointer" title="Pilih Semua" />
            : 'No'}
        </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Project</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Product</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Kegiatan</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Sales</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Handler</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Tanggal</th>
                <th className="px-1 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {groupedReminders.map((group, idx) => {
                const r = group[0];
                const today = isDueToday(r.due_date);
                const uniqueDates = Array.from(new Set(group.map(gr => gr.due_date))).sort();
                const uniqueAssignNames = Array.from(new Set(group.map(gr => gr.assign_name).filter(Boolean)));
                const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                return (
                  <tr key={r.id}
                    className={`border-b border-gray-200 hover:bg-red-50/30 transition-colors cursor-pointer ${today ? 'bg-red-50/15 border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'}`}
                    >
                    {/* No */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle text-center" onClick={e => e.stopPropagation()}>
                {selectMode && (isAdmin || isManager)
                  ? <input type="checkbox"
                      checked={group.every(gr => selectedIds.has(gr.id))}
                      onChange={() => {
                        const allSelected = group.every(gr => selectedIds.has(gr.id));
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          for (const gr of group) allSelected ? next.delete(gr.id) : next.add(gr.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                  : <span className="text-[11px] font-bold text-gray-500">{idx + 1}</span>}
              </td>
                    {/* Project */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="font-bold text-gray-800 text-xs leading-tight break-words">{(r.project_name || '').trim() || (r.title || '').trim() || '—'}</div>
                      {r.address && <div className="text-[10px] text-gray-400 truncate mt-0.5">📍 {r.address.split(',')[0]}</div>}
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatDatetime(r.created_at).split(',')[0]}</div>
                    </td>
                    {/* Product */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      {r.product ? (
                        <button
                          onClick={e => { e.stopPropagation(); setProductFilter(productFilter === r.product ? null : (r.product ?? null)); }}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-left break-words leading-tight transition-all"
                          style={{ background: productFilter === r.product ? '#6366f1' : '#eef2ff', color: productFilter === r.product ? 'white' : '#4338ca' }}>
                          {r.product}
                        </button>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                      {/* Tipe Produk (LED / LCD·Middleware / LED & LCD) — dipilih Sales saat
                          request, dipakai utk routing tim tapi sebelumnya tidak pernah
                          ditampilkan di mana pun (list maupun detail). */}
                      {r.product_type && (
                        <div className="mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded inline-block"
                          style={{ background: '#fef3c7', color: '#92400e' }}>
                          🏷️ {r.product_type}
                        </div>
                      )}
                    </td>
                    {/* Kegiatan */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{(CATEGORY_CONFIG[r.category] ?? { icon: '📁' }).icon}</span>
                        <span className="text-[10px] font-semibold text-gray-700 leading-tight break-words">{r.category}</span>
                        {r.sales_name && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(r.category) && (
                        <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-1"
                          >
                          ⭐ {/*r.sales_name*/}
                        </div>
                      )}
                      </div>
                      {/* Mode pelaksanaan (Onsite/Remote) — cuma diisi utk kategori
                          Konfigurasi/Konfigurasi & Training/Training saat status
                          di-update ke Completed. Di list HANYA nilai Onsite/Remote-nya
                          saja yg tampil; detail lengkapnya (BAST, tipe display,
                          controller automation, middleware) ada di halaman Detail. */}
                      {(INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(r.category) && r.mode_penyelesaian && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={r.mode_penyelesaian === 'onsite'
                            ? { background: '#d1fae5', color: '#047857' }
                            : { background: '#dbeafe', color: '#1d4ed8' }}>
                          {r.mode_penyelesaian === 'onsite' ? '🏠 ONSITE' : '📡 REMOTE'}
                        </div>
                      )}
                      {r.category === 'Troubleshooting' && (
                        <button
                          onClick={e => { e.stopPropagation(); router.push('/ticketing'); }}
                          className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-blue-600 hover:text-blue-800 transition-colors"
                          style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                          🎫 Ticketing
                        </button>
                      )}
                    </td>
                    {/* Sales */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="text-xs font-semibold text-gray-700 leading-tight truncate">{r.sales_name || '—'}</div>
                      {r.sales_division && <div className="text-[10px] text-purple-600 font-semibold truncate mt-0.5">{r.sales_division}</div>}
                    </td>
                    {/* Handler */}
                    {/* Lebar sengaja TIDAK dipatok di sini — biar
                        mengikuti <colgroup>. Patokan 110px yang lama
                        menimpa lebar kolom, sehingga nama handler
                        selalu terpotong berapa pun lebar tabelnya. */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle overflow-hidden">
                      <div className="flex flex-nowrap gap-0.5">
                        {uniqueAssignNames.slice(0, 3).map(name => (
                          <div key={name} title={name}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                            {name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        ))}
                        {uniqueAssignNames.length > 3 && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold bg-gray-100 text-gray-600 flex-shrink-0">+{uniqueAssignNames.length - 3}</div>
                        )}
                      </div>
                      {uniqueAssignNames.length === 1
                        ? <span className="text-[10px] font-bold text-gray-800 block mt-0.5 truncate">{uniqueAssignNames[0]}</span>
                        : <span className="text-[9px] text-gray-400 mt-0.5 block">{uniqueAssignNames.length} orang</span>
                      }
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      {(() => {
                        const counts: Record<string,number> = {};
                        for (const gr of group) counts[gr.status] = (counts[gr.status]||0)+1;
                        const entries = Object.entries(counts);
                        if (entries.length === 1) {
                          return <>
                            <StatusBadge status={group[0].status} />
                            {group[0].wa_sent_h1 && <p className="text-[9px] font-bold text-green-600 mt-0.5">✅ WA H-1</p>}
                          </>;
                        }
                        return (
                          <div className="space-y-0.5">
                            {entries.map(([s,n]) => (
                              <div key={s} className="flex items-center gap-1">
                                <StatusBadge status={s as any} />
                                <span className="text-[9px] text-gray-500 font-bold">{n}×</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {!group[0].assigned_to && group[0].notes?.includes('[REQUEST SALES]') && (
                        group[0].routing_status === 'internal_review'
                          ? <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: '#f59e0b' }} title="Menunggu review Sales Internal sebelum Admin bisa proses">
                              🔍 Review: {guestUsers.find(g => g.id === group[0].internal_sales_id)?.full_name ?? '—'}
                            </span>
                          : <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: '#2563eb' }}
                              title={group[0].created_by ? `Diinput oleh: ${group[0].created_by}${group[0].sales_name ? ` — atas nama Sales: ${group[0].sales_name}` : ''}` : undefined}>
                              📩 Req. Sales
                            </span>
                      )}
                    </td>
                    {/* Tanggal */}
                    <td className="px-2 py-1 border-r border-gray-200 align-middle">
                      {uniqueDates.length > 1 ? (
                        <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center" title={uniqueDates.map(fmtShort).join(', ')}
                          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <span className="text-sm font-black leading-none" style={{ color: '#4f46e5' }}>🗓️ {uniqueDates.length}h</span>
                          <span className="text-[8px] font-bold uppercase leading-tight" style={{ color: '#6366f1' }}>
                            {fmtShort(uniqueDates[0])}–{fmtShort(uniqueDates[uniqueDates.length - 1])}
                          </span>
                          {r.due_time && <span className="text-[8px] text-gray-400 leading-tight">{r.due_time}</span>}
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center"
                          style={{
                            background: today ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.08)',
                            border: today ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(99,102,241,0.2)',
                          }}>
                          <span className="text-base font-black leading-none" style={{ color: today ? '#dc2626' : '#4f46e5' }}>
                            {new Date(r.due_date + 'T00:00:00').getDate()}
                          </span>
                          <span className="text-[8px] font-bold uppercase leading-tight" style={{ color: today ? '#dc2626' : '#6366f1' }}>
                            {new Date(r.due_date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
                          </span>
                          {r.due_time && <span className="text-[8px] text-gray-400 leading-tight">{r.due_time}</span>}
                        </div>
                      )}
                    </td>
                    {/* ACT */}
                    <td className="px-3 py-1 align-middle text-center" onClick={e => e.stopPropagation()}>
                      <ActionGroup>
                        {/* Detail */}
                        <ViewIconBtn onClick={() => setDetailReminder(group[0])} title="Detail" />
                        {/* Re-Schedule — semua team PTS & admin bisa lihat */}
                        {bolehEditReminder(group[0]) && group[0].status !== 'done' && (
                          <RescheduleIconBtn onClick={() => setRescheduleTarget(group[0])} title="Re-Schedule" />
                        )}
                        {/* Approve & Teruskan — Sales Internal yg di-mapping, wajib duluan sebelum Admin */}
                        {canInternalApprove(group[0]) && (
                          <>
                            <ApproveIconBtn onClick={() => setInternalApproveTarget(group[0])} title="Approve & Teruskan ke Admin" pulse />
                            <button aria-label="Tolak" onClick={() => handleInternalReject(group[0])} title="Tolak"
                              className="w-7 h-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </>
                        )}
                        {/* Approve & Assign — admin only, hanya utk request sales yg belum di-assign & sudah lolos review internal */}
                        {canApproveAssign && !group[0].assigned_to && group[0].notes?.includes('[REQUEST SALES]') && group[0].routing_status !== 'internal_review' && (
                          <>
                            <ApproveIconBtn onClick={() => { setApproveTarget(group[0]); setApproveBatchSiblings(group.filter(gr => gr.id !== group[0].id && gr.batch_id === group[0].batch_id && !gr.assigned_to)); setApproveAssignTo(''); setApproveDate(group[0].due_date); setApproveTime(group[0].due_time); }} title="Approve & Assign" pulse />
                            <button aria-label="Tolak" onClick={() => handleAdminReject(group[0])} title="Tolak"
                              className="w-7 h-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </>
                        )}
                        {/* Assign Tim — Supervisor yg di-route, wajib assign anggota/diri sendiri */}
                        {currentUser?.id === group[0].assigned_supervisor_id && group[0].routing_status === 'supervisor_assign' && (
                          <ApproveIconBtn onClick={() => openSupervisorAssign(group[0], group)} title="Assign Tim" pulse />
                        )}
                        {(isAdmin || isManager) && layakIncentive(group[0]) && (
                          <button aria-label={`Sync ${group[0].project_name} ke Incentive PTS`}
                            onClick={() => syncKeIncentive(group[0])} disabled={syncing === group[0].id}
                            title={diluarIncentive(group[0])
                              ? 'Sedang DI LUAR Incentive PTS — klik untuk memasukkannya kembali'
                              : 'Sudah masuk Incentive PTS — klik untuk memastikan ulang'}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 border ${
                              diluarIncentive(group[0])
                                ? 'bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white border-amber-300'
                                : 'bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border-emerald-200'}`}>
                            {syncing === group[0].id
                              ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                              : <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                          </button>
                        )}
                        {/* Hapus — admin only */}
                        {(isAdmin || isManager) && (
                          <DeleteIconBtn onClick={() => openDeleteModal(group[0])} title="Hapus" />
                        )}
                      </ActionGroup>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200" style={{ background: 'rgba(255,255,255,0.97)' }}>
            <span className="text-[10px] text-gray-400">{groupedReminders.length} event ({filteredReminders.length} jadwal)</span>
            <span className="text-[10px] text-gray-400">{filteredReminders.length > 0 ? `1–${filteredReminders.length}` : '0'} of {reminders.length}</span>
          </div>
        </div>{/* end hidden md:block */}
        </>
      )}
    </>
  );
}
