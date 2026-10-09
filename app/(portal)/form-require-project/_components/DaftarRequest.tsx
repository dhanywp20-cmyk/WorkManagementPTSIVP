'use client';

/** DaftarRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ActionGroup, MobileListCard, MobileCardBadge, ListEmptyState, Paginasi } from '@/components/shared';
import { User, ProjectRequest, statusConfig, hasDivergentRoomStatus } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { type CSSProperties } from 'react';

export interface DaftarRequestProps {
  bisaKelolaRequest: boolean;
  currentUser: User;
  filterMonth: string;
  filterStatus: string;
  filterYear: string;
  filteredRequests: ProjectRequest[];
  formatDate: (dt: string) => string;
  formatDueDate: (dt: string) => string;
  getDueStatus: (due: string | undefined, status: string) => { type: string; label: string; days: number; } | null;
  hal: import("@/components/shared/Paginasi").HasilPaginasi<ProjectRequest>;
  handleOpenDetail: (req: ProjectRequest) => Promise<void>;
  isIVPGuest: boolean;
  isPTS: boolean;
  isTeamPTS: boolean;
  loading: boolean;
  pimpinan: boolean;
  renderRequestActions: (req: ProjectRequest) => import("react").JSX.Element;
  requests: ProjectRequest[];
  searchQuery: string;
  searchSales: string;
  selectMode: boolean;
  selectedIds: Set<string>;
  setFilterMonth: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchSales: import("react").Dispatch<import("react").SetStateAction<string>>;
  setShowNewFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  toggleSelectAll: () => void;
  toggleSelectId: (id: string) => void;
  unreadMsgMap: Record<string, number>;
}

export function DaftarRequest({ bisaKelolaRequest, currentUser, filterMonth, filterStatus, filterYear, filteredRequests, formatDate, formatDueDate, getDueStatus, hal, handleOpenDetail, isIVPGuest, isPTS, isTeamPTS, loading, pimpinan, renderRequestActions, requests, searchQuery, searchSales, selectMode, selectedIds, setFilterMonth, setFilterStatus, setFilterYear, setSearchQuery, setSearchSales, setShowNewFormModal, toggleSelectAll, toggleSelectId, unreadMsgMap }: DaftarRequestProps) {
  return (
    <>
      {loading ? (
        <div className="space-y-3 py-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-4 border border-gray-200">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/5" />
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-1/6" />
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-6 bg-gray-200 rounded-full w-20" />
              <div className="h-8 bg-gray-200 rounded-lg w-16" />
            </div>
          ))}
          <div className="flex items-center justify-center gap-3 py-4 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
            <span className="text-sm font-medium">Memuat data...</span>
          </div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <ListEmptyState
          adaFilterAktif={
            searchQuery.trim() !== '' || searchSales.trim() !== '' ||
            filterStatus !== 'all' || filterYear !== 'all' || filterMonth !== 'all'
          }
          onReset={() => {
            setSearchQuery(''); setSearchSales('');
            setFilterStatus('all'); setFilterYear('all'); setFilterMonth('all');
          }}
          icon="🏗️"
          judulKosong={isIVPGuest ? 'Belum ada request untuk akun kamu' : 'Belum ada request'}
          deskripsiKosong={isIVPGuest
            ? 'Admin akan menghubungkan request dari sales external ke akun IVP kamu saat ada project baru.'
            : 'Request project yang diajukan akan muncul di sini.'}
          aksiKosong={!isPTS && !pimpinan ? { label: '+ Buat Request Pertama', onClick: () => setShowNewFormModal(true) } : undefined}
        />
      ) : (
        <>
        {/* ── MOBILE: kartu (pola Ticket Troubleshooting) ── */}
        <div className="md:hidden bg-gray-50/70 p-1.5 space-y-1.5">
          {filteredRequests.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-500">Belum ada request.</div>
          )}
          {hal.potongan.map((req) => {
            const sc = statusConfig[req.status] || statusConfig.pending;
            const solution = Array.isArray(req.solution_product) ? req.solution_product.join(', ') : (req.solution_product || '');
            return (
              <MobileListCard
                key={req.id}
                title={req.project_name}
                onClick={() => handleOpenDetail(req)}
                meta={<>
                  {req.project_location && <div className="truncate"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {req.project_location}</div>}
                  <div className="truncate">{req.requester_name} · {formatDate(req.created_at)}</div>
                </>}
                badges={<>
                  <MobileCardBadge className={`border ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</MobileCardBadge>
                  {req.routing_status === 'internal_review' && <span className="text-[10px] font-bold text-amber-700 whitespace-nowrap"><IkonTeks nama="🔍" />Review Internal</span>}
                  {/* Ruangan lain progresnya beda dari yang ditampilkan di sini (badge di
                      atas cuma ruangan pertama) - buka detail utk lihat per-ruangan. */}
                  {hasDivergentRoomStatus(req) && <span className="text-[10px] font-bold text-orange-600 whitespace-nowrap" title="Progres tiap ruangan berbeda - buka detail untuk melihatnya"><IkonTeks nama="🏘" />Beda per ruangan</span>}
                </>}
                fields={[
                  { label: 'Solution', value: solution || '—', span2: true },
                  { label: 'Ruangan', value: req.room_name, hide: !req.room_name },
                  { label: 'Sales', value: <>{req.sales_name || '—'}{req.sales_division ? <span className="text-purple-600 font-semibold"> · {req.sales_division}</span> : null}</> },
                  { label: 'Handler', value: req.assign_name || '—' },
                  { label: 'Target', value: req.due_date ? formatDueDate(req.due_date) : '—' },
                ]}
                actions={renderRequestActions(req)}
              />
            );
          })}
          <Paginasi {...hal} satuan="request" />
        </div>

        {/* ── DESKTOP: tabel ── */}
        <div className="hidden md:block overflow-x-auto animate-zoom-in bg-slate-100/60 px-3 pb-2">
          <table className="w-full table-fixed tabel-kartu" style={{ background: 'transparent', minWidth: '900px' }}>
            <colgroup>
              <col style={{ width: '56px' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '155px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '80px' }} />  {/* DueDate lebih sempit */}
              <col style={{ width: '80px' }} />  {/* CreatedBy lebih sempit */}
              {/*  120px, bukan 90px. Komentar lama mengklaim 90px "cukup
                  untuk 2-3 icon button" - tidak: satu tombol 32px dengan
                  gap 4px membuat 3 tombol butuh 104px, dan sel ini masih
                  dipotong padding px-2 (16px). Baris pending menampilkan
                  Approve + Tolak + Detail + Hapus sekaligus. */}
              <col style={{ width: '120px' }} />  {/* Action */}
            </colgroup>
            <thead>
              {/* Latar & garis bawah header diatur .tabel-kartu di globals.css. */}
              <tr>
                <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                  {selectMode && bisaKelolaRequest
                    ? <input type="checkbox"
                        checked={selectedIds.size === filteredRequests.length && filteredRequests.length > 0}
                        onChange={toggleSelectAll} className="w-4 h-4 rounded accent-teal-600 cursor-pointer" title="Pilih Semua" />
                    : 'ID'}
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Nama Project</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Ruangan / Solution</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Sales</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Handler</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Due Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Created By</th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {hal.potongan.map((req, index) => {
                const sc = statusConfig[req.status] || statusConfig.pending;
                const unread = unreadMsgMap[req.id] || 0;
                const dueStatus = getDueStatus(req.due_date, req.status);
                const isToday = req.due_date === new Date().toISOString().split('T')[0];
                return (
                  <tr key={req.id}
                    className="stagger-item"
                    style={{
                      '--aksen-baris': isToday ? '#0d9488' : '#cbd5e1',
                      '--bg-baris-sorot': isToday ? '#f0fdfa' : '#f8fafc',
                    } as CSSProperties}>
                    <td className="px-2 py-3 border-r border-gray-200 align-middle text-center" onClick={e => e.stopPropagation()}>
                      {selectMode && bisaKelolaRequest
                        ? <input type="checkbox" checked={selectedIds.has(req.id)}
                            onChange={() => toggleSelectId(req.id)} className="w-4 h-4 rounded accent-teal-600 cursor-pointer" />
                        : (
                          <span className="text-xs font-bold text-gray-500">
                            {hal.mulai + index + 1}
                          </span>
                        )}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-200 align-middle max-w-0">
                      <div className="flex items-start gap-1.5">
                        {unread > 0 && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse mt-1" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-gray-800 text-sm leading-tight truncate" title={req.project_name}>{req.project_name}</div>
                          {req.project_location && (
                            <div className="text-xs text-gray-500 leading-tight mt-0.5 line-clamp-2 break-words" title={req.project_location}>{req.project_location}</div>
                          )}
                          {unread > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">+{unread} pesan</span>}
                          <div className="text-xs text-gray-500 mt-0.5">{new Date(req.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>                             
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 border-r border-gray-200 align-middle max-w-0">
                      <div className="text-sm text-gray-700 leading-tight truncate" title={Array.isArray(req.solution_product) ? req.solution_product.join(', ') : req.solution_product}>{Array.isArray(req.solution_product) ? req.solution_product.join(', ') : (req.solution_product || <span className="text-gray-400">—</span>)}</div>
                      {req.room_name && <div className="text-xs text-teal-700 font-medium mt-0.5 truncate">🛋️ {req.room_name}</div>}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-100 align-middle">
                      <div className="text-sm font-semibold text-gray-700 leading-tight">{req.sales_name || <span className="text-gray-400">—</span>}</div>
                      {req.sales_division && <div className="text-xs text-purple-600 font-semibold mt-0.5">{req.sales_division}</div>}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-100 align-middle">
                      {req.assign_name ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                            {req.assign_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-xs font-semibold text-gray-700 leading-tight">{req.assign_name}</div>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-100 align-middle">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-0.5 text-xs font-bold border whitespace-nowrap ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
                        {req.routing_status === 'internal_review' ? (
                          <p className="text-[10px] font-bold text-amber-700"><IkonTeks nama="🔍" />Menunggu Review Internal</p>
                        ) : (
                          req.status === 'pending' && isPTS && !isTeamPTS && <p className="text-[10px] font-bold text-red-500 animate-pulse"><IkonTeks nama="🔔" />Perlu Approval</p>
                        )}
                        {hasDivergentRoomStatus(req) && <p className="text-[10px] font-bold text-orange-600 whitespace-nowrap" title="Progres tiap ruangan berbeda - buka detail untuk melihatnya"><IkonTeks nama="🏘" />Beda per ruangan</p>}
                      </div>
                    </td>
                    <td className="px-3 py-3 border-r border-gray-100 align-middle">
                      {req.due_date ? (
                        <>
                          <div className="text-xs font-semibold text-gray-700">{formatDueDate(req.due_date)}</div>
                          {dueStatus && (
                            <div className={`text-[11px] font-bold mt-0.5 ${dueStatus.type === 'overdue' ? 'text-red-500' : dueStatus.type === 'urgent' ? 'text-amber-700' : 'text-teal-500'}`}>
                              <Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /> {dueStatus.label}
                            </div>
                          )}
                        </>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 border-r border-gray-100 align-middle">
                      <div className="text-[11px] font-semibold text-gray-800 leading-tight">{req.requester_name}</div>
                      {/* IVP guest: badge for external requests linked by admin */}
                      {isIVPGuest && req.ivp_assignee === currentUser.full_name && req.requester_id !== currentUser.id && (
                        <div className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                          <IkonTeks nama="🔗" />Ext: {req.sales_division}
                        </div>
                      )}
                      {/* IVP guest: badge for own requests */}
                      {isIVPGuest && req.requester_id === currentUser.id && (
                        <div className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                          <IkonTeks nama="📋" />Request Saya
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3 align-middle text-center" onClick={e => e.stopPropagation()}>
                      {/*  ActionGroup, bukan div flex tulisan tangan. Yang
                          tulisan tangan di sini tidak punya flex-wrap, jadi
                          baris "pending" (Approve + Tolak + Detail + Hapus =
                          ~132px) meluber keluar kolom 90px alih-alih turun
                          ke baris kedua. Sekalian ikut role="group" +
                          aria-label yang sudah dipakai tabel lain. */}
                      <ActionGroup>
                        {renderRequestActions(req)}
                      </ActionGroup>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200" style={{ background: 'rgba(255,255,255,0.97)' }}>
            <span className="text-xs text-gray-500">{filteredRequests.length} request ditemukan</span>
            <span className="text-xs text-gray-500">dari {requests.length} request keseluruhan</span>
          </div>
          <Paginasi {...hal} satuan="request" />
        </div>
        </>
      )}
    </>
  );
}
