'use client';
import { useRouter } from 'next/navigation';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import { triggersProjectProgress } from '@/lib/project-progress-sync';
import {
  SectionHeaderSmall, InfoRow, Username, ModalPortal, AuditTrailPanel, FlowSteps,
} from '@/components/shared';
import { PriorityBadge, StatusBadge, CategoryBadge } from './Badges';
import { ModePenyelesaianPanel } from './ModePenyelesaianPanel';
import {
  Reminder, TeamUser, GuestUser, Status,
  REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, CATEGORY_CONFIG, STATUS_CONFIG,
  REPEAT_OPTIONS, formatDate, cleanRequestNotes,
} from './shared';

/**
 * Popup detail reminder (header + info project + timeline + garansi +
 * detail pelaksanaan + update status + panel riwayat/mode penyelesaian
 * di samping) - dipindah dari app/reminder-schedule/page.tsx apa adanya
 * (JSX identik). State & handler tetap di page.tsx, komponen ini murni
 * presentasional.
 */
export function ReminderDetailPopup({
  detailReminder, setDetailReminder,
  showModeModal, setShowModeModal,
  pendingStatus, setPendingStatus,
  statusPhoto, setStatusPhoto,
  statusPhotoPreview, setStatusPhotoPreview,
  showRiwayat, setShowRiwayat,
  isAdmin, isManager, currentUser,
  isMyReviewStage,
  canInternalApprove, setInternalApproveTarget, handleInternalReject,
  canApproveAssign, setApproveTarget, setApproveBatchSiblings, reminders,
  setApproveAssignTo, setApproveDate, setApproveTime,
  handleAdminReject,
  openSupervisorAssign,
  bolehEditReminder, setRescheduleTarget,
  resendingFormReview, handleResendFormReview,
  sendingWA, handleSendWA,
  openEdit,
  statusPhotoRef,
  handleConfirmStatusUpdate, updatingStatus,
  guestUsers,
  modePenyelesaian, setModePenyelesaian,
  installerName, setInstallerName,
  installerUserId, setInstallerUserId,
  daftarCabang,
  installerDaerah, setInstallerDaerah,
  bastDate, setBastDate,
  displayType, setDisplayType,
  requiresMiddleware, setRequiresMiddleware,
  requiresControllerAuto, setRequiresControllerAuto,
  controllerBrand, setControllerBrand,
  setPendingPhotoUrl,
  savingMode, handleModeConfirm,
}: {
  detailReminder: Reminder;
  setDetailReminder: (r: Reminder | null) => void;
  showModeModal: boolean;
  setShowModeModal: (v: boolean) => void;
  pendingStatus: Status | null;
  setPendingStatus: (v: Status | null) => void;
  statusPhoto: File | null;
  setStatusPhoto: (v: File | null) => void;
  statusPhotoPreview: string | null;
  setStatusPhotoPreview: (v: string | null) => void;
  showRiwayat: boolean;
  setShowRiwayat: Dispatch<SetStateAction<boolean>>;
  isAdmin: boolean;
  isManager: boolean;
  currentUser: TeamUser | null;
  isMyReviewStage: (r: Reminder) => boolean;
  canInternalApprove: (r: Reminder) => boolean;
  setInternalApproveTarget: (r: Reminder) => void;
  handleInternalReject: (r: Reminder) => void;
  canApproveAssign: boolean;
  setApproveTarget: (r: Reminder) => void;
  setApproveBatchSiblings: (r: Reminder[]) => void;
  reminders: Reminder[];
  setApproveAssignTo: (v: string) => void;
  setApproveDate: (v: string) => void;
  setApproveTime: (v: string) => void;
  handleAdminReject: (r: Reminder) => void;
  openSupervisorAssign: (r: Reminder, group: Reminder[]) => void;
  bolehEditReminder: (r: Reminder) => boolean;
  setRescheduleTarget: (r: Reminder) => void;
  resendingFormReview: boolean;
  handleResendFormReview: (r: Reminder) => void;
  sendingWA: string | null;
  handleSendWA: (r: Reminder) => void;
  openEdit: (r: Reminder) => void;
  statusPhotoRef: RefObject<HTMLInputElement>;
  handleConfirmStatusUpdate: () => void;
  updatingStatus: boolean;
  guestUsers: GuestUser[];
  modePenyelesaian: 'onsite' | 'remote' | null;
  setModePenyelesaian: (v: 'onsite' | 'remote' | null) => void;
  installerName: string;
  setInstallerName: (v: string) => void;
  installerUserId: string | null;
  setInstallerUserId: (v: string | null) => void;
  daftarCabang: { id: string; full_name: string; pts_daerah: string | null }[];
  installerDaerah: string;
  setInstallerDaerah: (v: string) => void;
  bastDate: string;
  setBastDate: (v: string) => void;
  displayType: 'led' | 'lcd' | 'mix' | null;
  setDisplayType: (v: 'led' | 'lcd' | 'mix' | null) => void;
  requiresMiddleware: boolean;
  setRequiresMiddleware: (v: boolean) => void;
  requiresControllerAuto: boolean;
  setRequiresControllerAuto: (v: boolean) => void;
  controllerBrand: 'cue' | 'extron' | 'wyrestorm' | null;
  setControllerBrand: (v: 'cue' | 'extron' | 'wyrestorm' | null) => void;
  setPendingPhotoUrl: (v: undefined) => void;
  savingMode: boolean;
  handleModeConfirm: () => void;
}) {
  const router = useRouter();

  return (
    <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex justify-center z-[1000] p-4"
      onClick={e => { if (e.target === e.currentTarget) { setDetailReminder(null); setShowModeModal(false); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); } }}>
      <div className="flex gap-3 w-full justify-center min-h-0"
        style={{ maxWidth: showModeModal ? '1140px' : showRiwayat ? '1060px' : '672px', transition: 'max-width 0.25s ease' }}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full flex-1 min-w-0 overflow-hidden flex flex-col"
        style={{ animation: 'scale-in 0.25s ease-out', border: '1px solid rgba(0,0,0,0.1)', height: '100%' }}>
        <div className="px-6 py-5 flex-shrink-0 sticky top-0 z-30 relative" style={{
          background: (() => { const c = CATEGORY_CONFIG[detailReminder.category]; const base = c ? `linear-gradient(135deg,${c.accent}dd,${c.accent}88)` : 'linear-gradient(135deg,#1d4ed8,#1e40af)'; return `linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.15)),${base}`; })()
        }}>
          <button onClick={() => setShowRiwayat(v => !v)}
            title={showRiwayat ? 'Sembunyikan riwayat perubahan' : 'Tampilkan riwayat perubahan'}
            className="absolute top-4 right-14 h-7 px-2.5 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center gap-1 text-[11px] font-bold">
            🕘 <span className="hidden sm:inline">Riwayat</span>
          </button>
          <div className="flex flex-wrap gap-2 mb-3">
            <PriorityBadge priority={detailReminder.priority} onHeader />
            <StatusBadge status={detailReminder.status} onHeader />
            <CategoryBadge category={detailReminder.category} onHeader />
            {detailReminder.repeat !== 'none' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                🔁 {REPEAT_OPTIONS.find(r => r.value === detailReminder.repeat)?.label}
              </span>
            )}
            {detailReminder.wa_sent_h1 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/80 text-white">✅ WA H-1 Terkirim</span>
            )}
          </div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-1 mb-0.5">Nama Project</p>
          <h2 className="text-2xl font-bold text-white leading-tight">{(detailReminder.project_name || '').trim() || ((detailReminder as any).title || '').trim() || '—'}</h2>
          {detailReminder.address && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-2 mb-0.5">Lokasi</p>
              <p className="text-white text-sm flex items-center gap-1.5"><span>📍</span>{detailReminder.address}</p>
            </>
          )}
          {detailReminder.description && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-2 mb-0.5">Deskripsi</p>
              <p className="text-white/90 text-xs">{detailReminder.description}</p>
            </>
          )}
          {/* Troubleshooting link ke Ticketing — navigasi internal */}
          {detailReminder.category === 'Troubleshooting' && (
            <button
              onClick={e => { e.stopPropagation(); setDetailReminder(null); router.push('/ticketing'); }}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.92)' }}>
              🎫 Buka Platform Ticketing
            </button>
          )}
          <button aria-label="Tutup" onClick={() => { setDetailReminder(null); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Action bar — sticky di atas, menempel header detail */}
          {(isAdmin || currentUser?.role === 'team' || isMyReviewStage(detailReminder)) && (
            <div className="flex gap-2 flex-wrap sticky top-0 z-20 bg-white/95 backdrop-blur-sm -mx-5 px-5 py-2.5 border-b border-gray-100">
              {canInternalApprove(detailReminder) && (
                <>
                  <button onClick={() => setInternalApproveTarget(detailReminder)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }}>✅ Approve &amp; Teruskan ke Admin</button>
                  <button onClick={() => handleInternalReject(detailReminder)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white' }}>❌ Tolak</button>
                </>
              )}
              {canApproveAssign && !detailReminder.assigned_to && detailReminder.notes?.includes('[REQUEST SALES]') && detailReminder.routing_status !== 'internal_review' && (
                <>
                  <button onClick={() => { setApproveTarget(detailReminder); setApproveBatchSiblings(detailReminder.batch_id ? reminders.filter(gr => gr.id !== detailReminder.id && gr.batch_id === detailReminder.batch_id && !gr.assigned_to) : []); setApproveAssignTo(''); setApproveDate(detailReminder.due_date); setApproveTime(detailReminder.due_time); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white' }}>✅ Approve &amp; Assign</button>
                  <button onClick={() => handleAdminReject(detailReminder)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white' }}>❌ Tolak</button>
                </>
              )}
              {currentUser?.id === detailReminder.assigned_supervisor_id && detailReminder.routing_status === 'supervisor_assign' && (
                <button onClick={() => openSupervisorAssign(detailReminder, [detailReminder, ...reminders.filter(gr => gr.id !== detailReminder.id && gr.batch_id === detailReminder.batch_id)])}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }}>🎯 Assign Tim</button>
              )}
              {bolehEditReminder(detailReminder) && detailReminder.status !== 'done' && (
                <button onClick={() => { setRescheduleTarget(detailReminder); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg,#d97706,#b45309)', color: 'white' }}>📅 Re-Schedule</button>
              )}
              {bolehEditReminder(detailReminder) && detailReminder.status === 'done' && detailReminder.sales_name?.trim() && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && (
                <button onClick={() => handleResendFormReview(detailReminder)} disabled={resendingFormReview}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: 'white' }}>
                  {resendingFormReview ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '⭐'} Resend Review</button>
              )}
              {(isAdmin || isManager) && (
                <button onClick={() => handleSendWA(detailReminder)} disabled={sendingWA === detailReminder.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white' }}>
                  {sendingWA === detailReminder.id ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '💬'} Kirim WA</button>
              )}
              {/*
                Dulu (isAdmin || isManager) saja - Sales pembuat request
                maupun Tim yang ditugaskan tidak bisa membetulkan salah
                ketiknya sendiri, harus minta admin. Disamakan dengan
                bolehEditReminder (lihat catatannya di atas).
              */}
              {bolehEditReminder(detailReminder) && (
                <button onClick={() => openEdit(detailReminder)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white' }}>✏️ Edit</button>
              )}
            </div>
          )}

          {detailReminder.status === 'cancelled' && detailReminder.rejection_reason && (
            <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <span className="text-base flex-shrink-0">❌</span>
              <div>
                <p className="text-xs font-bold text-red-700">Request Ditolak</p>
                <p className="text-xs text-red-600 mt-0.5">{detailReminder.rejection_reason}</p>
              </div>
            </div>
          )}

          <div>
            <SectionHeaderSmall icon="📋" title="Detail Jadwal" />
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>Assign To</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(220,38,38,0.2)', color: '#dc2626' }}>
                    {detailReminder.assign_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{detailReminder.assign_name}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}><Username value={detailReminder.assigned_to} /></p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>📅 Jadwal</p>
                <p className="text-sm font-bold text-slate-800">{formatDate(detailReminder.due_date)}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>⏰ {detailReminder.due_time}</p>
              </div>
            </div>
          </div>

          <div>
            <SectionHeaderSmall icon="🏢" title="Informasi Project" />
            <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
              {detailReminder.product && <InfoRow icon="📦" label="Product / Unit" value={detailReminder.product} />}
              {detailReminder.product_type && <InfoRow icon="🏷️" label="Tipe Produk" value={detailReminder.product_type} />}
              <InfoRow icon="👤" label="Nama Sales & Divisi" value={[detailReminder.sales_name, detailReminder.sales_division].filter(Boolean).join(' / ')} />
              {detailReminder.sales_name && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && (
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(124,58,237,0.04)' }}>
                  <span className="text-base flex-shrink-0">⭐</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#7c3aed' }}>Guest Review (Sales)</p>
                    <p className="text-sm font-semibold text-violet-700">{detailReminder.sales_name}</p>
                    {detailReminder.sales_division && <p className="text-[10px] text-violet-500">{detailReminder.sales_division}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {detailReminder.status === 'done' ? (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: '#7c3aed' }}>
                        Form Review ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.4)' }}>
                        ⏳ Setelah Completed
                      </span>
                    )}
                  </div>
                </div>
              )}
              {detailReminder.pic_name && <InfoRow icon="🙋" label="Nama PIC Project" value={detailReminder.pic_name} />}
              {detailReminder.pic_phone && (
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <span className="text-base flex-shrink-0">📱</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>No. Telepon PIC</p>
                    <a href={`tel:${detailReminder.pic_phone}`} className="text-sm font-semibold hover:underline" style={{ color: '#60a5fa' }}
                      onClick={e => e.stopPropagation()}>{detailReminder.pic_phone}</a>
                  </div>
                </div>
              )}
              {detailReminder.description && <InfoRow icon="📝" label="Deskripsi" value={detailReminder.description} />}
            </div>
          </div>

          {/* Placeholder default "Menunggu assignment dari Admin" disaring — bukan catatan
              asli, jangan ditampilkan lagi (termasuk data lama yg belum sempat dibersihkan). */}
          {cleanRequestNotes(detailReminder.notes) && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#f59e0b' }}>📝 Catatan</p>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{cleanRequestNotes(detailReminder.notes)}</p>
            </div>
          )}



          {/* ── Timeline Project Progress — kategori pemicu saja ──
              Sejajar dengan blok Masa Garansi di bawahnya: keduanya
              informasi jadwal yang melekat pada kategori Konfigurasi. */}
          {triggersProjectProgress(detailReminder.category) && (() => {
            const t = detailReminder as { progress_start_date?: string | null; progress_target_date?: string | null };
            const ada = t.progress_start_date || t.progress_target_date;
            return (
              <div className="rounded-xl p-4 flex items-center gap-3"
                style={ada
                  ? { background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.25)' }
                  : { background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)' }}>
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ada ? '#0e7490' : '#64748b' }}>
                    Timeline Project Progress
                  </p>
                  {ada ? (
                    <p className="text-sm font-semibold text-slate-700">
                      {t.progress_start_date ? formatDate(t.progress_start_date) : '—'}
                      <span className="mx-1.5 text-slate-300">→</span>
                      {t.progress_target_date ? formatDate(t.progress_target_date) : '—'}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Belum ditetapkan</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Warranty Status — hanya untuk Konfigurasi & Konfigurasi & Training ── */}
          {(detailReminder.category === 'Konfigurasi' || detailReminder.category === 'Konfigurasi & Training') && (() => {
            const wy = (detailReminder as any).warranty_years as 1 | 2 | 3 | null | undefined;
            const bastDate = detailReminder.due_date;
            if (!wy || !bastDate) return (
              <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)' }}>
                <span className="text-xl">🛡️</span>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Masa Garansi</p>
                  <p className="text-sm text-slate-400 italic">Tidak dikonfigurasi</p>
                </div>
              </div>
            );
            const bast = new Date(bastDate + 'T00:00:00');
            const expiry = new Date(bastDate + 'T00:00:00');
            expiry.setFullYear(expiry.getFullYear() + wy);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isInWarranty = today <= expiry;
            const diffMs = expiry.getTime() - today.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const expiryStr = expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            const bastStr = bast.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div className="rounded-xl p-4" style={isInWarranty
                ? { background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.35)' }
                : { background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.35)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{isInWarranty ? '🛡️' : '⚠️'}</span>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                    Status Garansi
                  </p>
                  <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold" style={isInWarranty
                    ? { background: 'rgba(14,165,233,0.18)', color: '#0369a1' }
                    : { background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                    {isInWarranty ? '✅ In Warranty' : '❌ Out of Warranty'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                  <div>
                    <p className="text-slate-400 mb-0.5">BAST / Mulai</p>
                    <p className="font-semibold text-slate-700">{bastStr}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">Garansi Berakhir</p>
                    <p className="font-semibold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>{expiryStr}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">Durasi</p>
                    <p className="font-semibold text-slate-700">{wy} Tahun</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">{isInWarranty ? 'Sisa Hari' : 'Sudah Lewat'}</p>
                    <p className="font-bold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                      {isInWarranty ? `${diffDays} hari` : `${Math.abs(diffDays)} hari`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Detail Pelaksanaan — diisi lewat modal "Mode Penyelesaian" saat
              kategori Konfigurasi/Konfigurasi & Training/Training di-update ke
              Completed. Sebelumnya data ini (mode_penyelesaian, BAST, tipe
              display, controller automation, middleware) tersimpan tapi tidak
              pernah ditampilkan di mana pun — di list HANYA nilai Onsite/Remote
              yang tampil (di bawah Kegiatan), detail lengkapnya di sini. ── */}
          {(INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && detailReminder.mode_penyelesaian && (() => {
            const brandLabel: Record<string, string> = { cue: 'Cue System', extron: 'Extron', wyrestorm: 'Wyrestorm' };
            const displayLabel: Record<string, string> = { led: 'LED', lcd: 'LCD', mix: 'Mix (LED + LCD)' };
            const isOnsite = detailReminder.mode_penyelesaian === 'onsite';
            return (
              <div className="rounded-xl p-4" style={isOnsite
                ? { background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)' }
                : { background: 'rgba(59,130,246,0.07)', border: '1.5px solid rgba(59,130,246,0.3)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{isOnsite ? '🏠' : '📡'}</span>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isOnsite ? '#047857' : '#1d4ed8' }}>
                    Detail Pelaksanaan · {isOnsite ? 'ONSITE' : 'REMOTE'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {detailReminder.bast_date && (
                    <div>
                      <p className="text-slate-400 mb-0.5">📅 Tanggal BAST</p>
                      <p className="font-semibold text-slate-700">{formatDate(detailReminder.bast_date)}</p>
                    </div>
                  )}
                  {detailReminder.display_type && (
                    <div>
                      <p className="text-slate-400 mb-0.5">🖥️ Tipe Display</p>
                      <p className="font-semibold text-slate-700">{displayLabel[detailReminder.display_type] ?? detailReminder.display_type}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-400 mb-0.5">🎛️ Controller Automation</p>
                    <p className="font-semibold text-slate-700">
                      {detailReminder.requires_controller_automation
                        ? (brandLabel[detailReminder.controller_automation_brand ?? ''] ?? 'Ya')
                        : 'Tidak'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">🔌 Middleware / System / Matrix</p>
                    <p className="font-semibold text-slate-700">{detailReminder.requires_middleware ? 'Ya' : 'Tidak'}</p>
                  </div>
                  {!isOnsite && detailReminder.installer_name && (
                    <div>
                      <p className="text-slate-400 mb-0.5">🔧 PTS Daerah</p>
                      <p className="font-semibold text-slate-700">{detailReminder.installer_name}</p>
                    </div>
                  )}
                  {!isOnsite && detailReminder.installer_daerah && (
                    <div>
                      <p className="text-slate-400 mb-0.5">📍 Daerah</p>
                      <p className="font-semibold text-slate-700">{detailReminder.installer_daerah}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Update Status BARU BISA setelah request selesai di-approve & di-assign
             ke pengerjaan (assigned_to terisi). Selama masih di alur approval
             (internal_review / admin_review / supervisor_assign, assigned_to kosong)
             → belum bisa update status. */}
          {(isAdmin || currentUser?.role === 'team') && !detailReminder.assigned_to && detailReminder.notes?.includes('[REQUEST SALES]') && detailReminder.status !== 'done' && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-1" style={{ background: 'rgba(148,163,184,0.1)', border: '1.5px solid rgba(148,163,184,0.3)' }}>
              <span className="text-lg">🔒</span>
              <div>
                <p className="text-xs font-bold text-slate-600">Belum bisa update status</p>
                <p className="text-[11px] text-slate-500">Menunggu approval & assignment selesai (Sales Internal → Manager → Supervisor → Team).</p>
              </div>
            </div>
          )}
          {bolehEditReminder(detailReminder) && detailReminder.assigned_to && (
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#64748b' }}>Update Status</p>
            {detailReminder.status === 'done' ? (
              <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.35)' }}>
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-xs font-bold text-emerald-700">Jadwal Selesai</p>
                  <p className="text-[10px] text-emerald-600">Status completed tidak dapat diubah kembali.</p>
                </div>
              </div>
            ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(STATUS_CONFIG) as Status[]).filter(s => s !== 'done' || detailReminder.status !== 'done').map(s => {
                const c = STATUS_CONFIG[s];
                const isActive = (pendingStatus ?? detailReminder.status) === s;
                return (
                  <button key={s}
                    onClick={() => {
                      setPendingStatus(s);
                      if (s !== 'done') { setStatusPhoto(null); setStatusPhotoPreview(null); setShowModeModal(false); }
                      else if ((INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category)) {
                        // Kategori incentive  panel Mode langsung muncul di kanan (tanpa scroll)
                        setPendingPhotoUrl(undefined);
                        setModePenyelesaian(null); setInstallerName(''); setInstallerUserId(null); setInstallerDaerah('');
                        setBastDate(new Date().toISOString().split('T')[0]);
                        setDisplayType(null); setRequiresMiddleware(false);
                        setRequiresControllerAuto(false); setControllerBrand(null);
                        setShowModeModal(true);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'ring-2 ring-offset-1 scale-105' : 'opacity-70 hover:opacity-100'}`}
                    style={{ background: c.bg, color: c.color, border: `2px solid ${c.border}`, '--tw-ring-color': c.border } as React.CSSProperties}>
                    {c.icon} {c.label}
                  </button>
                );
              })}
            </div>
            )}

            {/* Photo upload - opsional untuk status Completed */}
            {detailReminder.status !== 'done' && (pendingStatus ?? detailReminder.status) === 'done' && !showModeModal && (
              <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#059669' }}>
                  📸 Foto Bukti Selesai <span className="text-gray-400 font-normal normal-case">(opsional)</span>
                </p>
                <input
                  ref={statusPhotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setStatusPhoto(file);
                      const reader = new FileReader();
                      reader.onload = ev => setStatusPhotoPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {statusPhotoPreview ? (
                  <div className="relative">
                    <img src={statusPhotoPreview} alt="preview" className="w-full max-h-40 object-cover rounded-lg" />
                    <button aria-label="Tutup"
                      onClick={() => { setStatusPhoto(null); setStatusPhotoPreview(null); if (statusPhotoRef.current) statusPhotoRef.current.value = ''; }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600">
                      ✕
                    </button>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">✅ {statusPhoto?.name}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => statusPhotoRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-all hover:bg-emerald-50"
                    style={{ borderColor: 'rgba(16,185,129,0.5)' }}>
                    <span className="text-2xl">📷</span>
                    <span className="text-xs font-bold text-emerald-700">Klik untuk upload foto</span>
                    <span className="text-[10px] text-gray-400">JPG, PNG, WEBP — maks. 10MB</span>
                  </button>
                )}
              </div>
            )}

            {/* Tombol Update Status */}
            {pendingStatus && pendingStatus !== detailReminder.status && !showModeModal && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(0,0,0,0.06)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
                  Batal
                </button>
                <button
                  onClick={handleConfirmStatusUpdate}
                  disabled={updatingStatus}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 3px 12px rgba(5,150,105,0.35)' }}>
                  {updatingStatus
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  }
                  {updatingStatus ? 'Menyimpan...' : 'Konfirmasi Update'}
                </button>
              </div>
            )}
          </div>
          )}

          {/* Foto Bukti Selesai - tampil jika status done dan ada foto */}
          {detailReminder.status === 'done' && detailReminder.completion_photo_url && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.05)' }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="text-base">📸</span>
                <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#059669' }}>Foto Bukti Selesai</p>
              </div>
              <div className="p-3">
                <img
                  src={detailReminder.completion_photo_url}
                  alt="Foto bukti selesai"
                  loading="lazy"
                  decoding="async"
                  className="w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: 220 }}
                  onClick={() => window.open(detailReminder.completion_photo_url, '_blank')}
                />
                <a
                  href={detailReminder.completion_photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors">
                  🔗 Buka foto di tab baru
                </a>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT: panel Mode Penyelesaian (muncul saat klik Completed) — seperti detail Ticketing */}
      {/* Riwayat sebagai panel samping — terbaca berdampingan dengan
          detailnya, bukan tersembunyi di balik tombol di dalam. Mode
          Penyelesaian punya prioritas: ia bagian dari alur menyelesaikan
          pekerjaan, sedangkan riwayat hanya rujukan. */}
      {showRiwayat && !showModeModal && (
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex-shrink-0 self-start overflow-hidden flex flex-col"
          style={{ animation: 'scale-in 0.2s ease-out', border: '1px solid rgba(0,0,0,0.1)', maxHeight: '100%' }}>
          <div className="px-5 py-4 flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg,#475569,#334155)' }}>
            <h3 className="text-white font-bold text-base">🕘 Riwayat Perubahan</h3>
            <p className="text-slate-300 text-[11px] mt-0.5 truncate">{detailReminder.project_name}</p>
            <button aria-label="Tutup" onClick={() => setShowRiwayat(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Alur ditaruh di panel ini, di bawah riwayat: keduanya
                menjawab pertanyaan yang sama — sudah sampai mana perkara
                ini. Riwayat menceritakan yang SUDAH terjadi, alur
                menunjukkan yang MASIH tersisa. Dipisah ke dua tempat
                justru memaksa mata bolak-balik. */}
            {/* Baris pembuatan diturunkan dari reminder-nya sendiri.
                logAudit baru mencatat 'create' sejak perbaikan terakhir,
                jadi tanpa ini seluruh reminder LAMA tampak tidak punya
                pangkal — padahal created_at & sales_name-nya tersimpan
                sejak awal. Untuk request Sales dipakai nama sales-nya
                (dialah yang mengajukan), bukan created_by yang bisa saja
                Sales Internal yang menginput. */}
            <AuditTrailPanel targetId={detailReminder.id} modul="reminder"
              selaluTerbuka sembunyikanBilaKosong={false}
              awal={{
                // "oleh" = PELAKU (yang menginput), sama seperti baris audit
                // sungguhan - jadi created_by lebih diutamakan daripada
                // sales_name. Sales Internal kadang menginput request ATAS
                // NAMA Sales External (fitur SBU); memakai sales_name di sini
                // akan menghapus jejak siapa yang benar-benar mengirim.
                oleh: (detailReminder.created_by
                  ? (guestUsers.find(g => g.username === detailReminder.created_by)?.full_name ?? detailReminder.created_by)
                  : detailReminder.sales_name) || null,
                waktu: detailReminder.created_at ?? null,
                keterangan: `Diajukan${detailReminder.sales_division ? ` — ${detailReminder.sales_division}` : ''} · kategori ${detailReminder.category}`
                  + (() => {
                    const namaPembuat = detailReminder.created_by
                      ? (guestUsers.find(g => g.username === detailReminder.created_by)?.full_name ?? detailReminder.created_by)
                      : null;
                    return namaPembuat && detailReminder.sales_name && namaPembuat !== detailReminder.sales_name
                      ? ` · atas nama Sales ${detailReminder.sales_name}` : '';
                  })(),
              }}
              /*
                Peristiwa lain yang terjadi SEBELUM logAudit mencatatnya.

                Waktunya TIDAK BOLEH memakai updated_at - kolom itu ikut
                berubah oleh SUNTINGAN APA PUN pada baris ini, termasuk
                yang tidak berhubungan sama sekali (mis. admin mengisi
                Tipe Produk atau BAST bertahun-tahun sesudah proyek
                selesai). Baris ini dulu memakainya, dan akibatnya sebuah
                proyek yang sungguh selesai bulan Juni bisa tiba-tiba
                tampil "Ditandai selesai — 2 menit lalu" hanya karena ada
                kolom lain yang baru saja disunting - riwayat yang sudah
                lama terlihat seolah baru saja terjadi.

                due_date/bast_date dipakai sebagai gantinya - keduanya
                TIDAK berubah akibat suntingan field lain, jadi lebih
                dekat ke kapan pekerjaan ini sungguh terjadi. bast_date
                diutamakan untuk "selesai" karena itu memang tanggal
                serah-terima; due_date dipakai untuk "dikerjakan" karena
                penugasan biasanya melekat pada jadwalnya.
              */
              turunan={[
                ...(detailReminder.assign_name?.trim()
                  ? [{ aksi: 'assign', oleh: detailReminder.assign_name,
                       waktu: detailReminder.due_date ?? detailReminder.created_at ?? null,
                       keterangan: `Dikerjakan ${detailReminder.assign_name} — dari data jadwal` }]
                  : []),
                ...(detailReminder.status === 'done'
                  ? [{ aksi: 'status_change', oleh: detailReminder.assign_name || null,
                       waktu: detailReminder.bast_date ?? detailReminder.due_date ?? null,
                       keterangan: 'Ditandai selesai — dari data jadwal' }]
                  : []),
              ]} />

          {/* Alur request Sales — hanya untuk yang memang lewat routing.
                Reminder yang dibuat langsung admin tidak punya tahapan ini,
                jadi diagramnya tidak ditampilkan supaya tidak mengarang
                tahap yang tak pernah terjadi. */}
            {(() => {
              const r = detailReminder as { routing_status?: string | null; assigned_to?: string | null; assign_name?: string | null; status?: string };
              const sudahAssign = !!((r.assigned_to && r.assigned_to.trim() !== '') || (r.assign_name && r.assign_name.trim() !== ''));
              const selesai     = r.status === 'done';
              const batal       = r.status === 'cancelled';
              //  0 diajukan · 1 Sales Internal · 2 Admin assign · 3 dikerjakan · 4 selesai
              //  5 = seluruh tahap tuntas (indeks di luar daftar)
              const aktif = selesai      ? 5
                : sudahAssign            ? 3
                : r.routing_status === 'internal_review' ? 1
                : 2;
              return (
                <FlowSteps
                  judul="Alur Request"
                  aktif={aktif}
                  dibatalkan={batal}
                  steps={[
                    { label: 'Diajukan',  pelaku: detailReminder.sales_name || 'Sales' },
                    // Sebut NAMA Sales Internal-nya, bukan label generik: siapa yang
                    // meneruskan adalah bagian dari jejak yang dicari pembaca alur.
                    // Dua sumber, sesuai bagaimana request itu masuk:
                    //   1. reviewer hasil mapping brand IVP/MVI (internal_sales_id,
                    //      + _id_2 saat brand BOTH  dua reviewer wajib approve)
                    //   2. kalau request DIBUAT oleh Sales Internal sendiri, dialah
                    //      yang meneruskan - tahap ini memang langsung terlewati
                    //      (routing_status ke admin_review), jadi namanya diambil
                    //      dari created_by.
                    { label: 'Diteruskan', pelaku: (() => {
                      const namaDari = (id?: string | null) => id ? guestUsers.find(g => g.id === id)?.full_name : undefined;
                      const r1 = namaDari(detailReminder.internal_sales_id);
                      const r2 = namaDari(detailReminder.internal_sales_id_2);
                      if (r1 && r2) return `${r1} & ${r2}`;
                      if (r1) return r1;
                      const pembuat = guestUsers.find(g => g.username === detailReminder.created_by);
                      if (pembuat?.is_internal_sales) return pembuat.full_name;
                      return 'Sales Internal';
                    })() },
                    { label: 'Di-assign', pelaku: 'Admin' },
                    { label: 'Dikerjakan', pelaku: detailReminder.assign_name || 'Team PTS' },
                    { label: 'Selesai',   pelaku: 'BAST' },
                  ]}
                />
              );
            })()}
          </div>
        </div>
      )}

      {showModeModal && (
        <ModePenyelesaianPanel
          modePenyelesaian={modePenyelesaian} setModePenyelesaian={setModePenyelesaian}
          bastDate={bastDate} setBastDate={setBastDate}
          displayType={displayType} setDisplayType={setDisplayType}
          requiresControllerAuto={requiresControllerAuto} setRequiresControllerAuto={setRequiresControllerAuto}
          controllerBrand={controllerBrand} setControllerBrand={setControllerBrand}
          requiresMiddleware={requiresMiddleware} setRequiresMiddleware={setRequiresMiddleware}
          installerName={installerName} setInstallerName={setInstallerName}
          installerUserId={installerUserId} setInstallerUserId={setInstallerUserId}
          daftarCabang={daftarCabang}
          installerDaerah={installerDaerah} setInstallerDaerah={setInstallerDaerah}
          savingMode={savingMode}
          handleModeConfirm={handleModeConfirm}
          setShowModeModal={setShowModeModal} setPendingStatus={setPendingStatus}
          setStatusPhoto={setStatusPhoto} setStatusPhotoPreview={setStatusPhotoPreview}
          setPendingPhotoUrl={setPendingPhotoUrl}
        />
      )}
      </div>
    </div>
    </ModalPortal>
  );
}
