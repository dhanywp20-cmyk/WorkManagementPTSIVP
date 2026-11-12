'use client';
import { appBaseUrl } from '@/lib/app-url';
import { useRouter } from 'next/navigation';
import { SectionHeaderSmall, InfoRow, Username, ModalPortal, TombolSetujui, TombolTolak, TombolTugaskan } from '@/components/shared';
import { PriorityBadge, StatusBadge, CategoryBadge } from './Badges';
import { ModePenyelesaianPanel } from './ModePenyelesaianPanel';
import { Reminder, REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, REPEAT_OPTIONS, formatDate, cleanRequestNotes } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { buatIcs } from '@/lib/ics';
import { unduhUrl } from '@/lib/lembar-cetak';
import { hasFullAccess } from '@/lib/constants';
import { useKonteksJadwal } from './konteks-jadwal';
import { SeksiPelaksanaan } from './SeksiPelaksanaan';
import { RiwayatJadwal } from './RiwayatJadwal';
import { EditJadwalCepat } from './EditJadwalCepat';

export function ReminderDetailPopup({ detailReminder }: { detailReminder: Reminder }) {
  const k = useKonteksJadwal();
  const { isAdmin, isManager, currentUser } = k.sesi;
  const { isMyReviewStage, canInternalApprove, canApproveAssign, bolehEditReminder } = k.izin;
  const { reminders, guestUsers } = k.data;
  const {
    setDetailReminder, setInternalApproveTarget, handleInternalReject, setApproveTarget, setApproveBatchSiblings, setApproveAssignTo, setApproveDate, setApproveTime,
    handleAdminReject, openSupervisorAssign, setRescheduleTarget, resendingFormReview, handleResendFormReview, sendingWA, handleSendWA, openEdit
  } = k.aksi;
  const {
    showModeModal, setShowModeModal, pendingStatus, setPendingStatus, statusPhoto, setStatusPhoto, statusPhotoPreview, setStatusPhotoPreview, showRiwayat,
    setShowRiwayat, statusPhotoRef, handleConfirmStatusUpdate, updatingStatus, modePenyelesaian, setModePenyelesaian, installerName, setInstallerName, installerUserId,
    setInstallerUserId, daftarCabang, installerDaerah, setInstallerDaerah, bastDate, setBastDate, displayType, setDisplayType, requiresMiddleware, setRequiresMiddleware,
    requiresControllerAuto, setRequiresControllerAuto, controllerBrand, setControllerBrand, setPendingPhotoUrl, savingMode, handleModeConfirm, modeEditSaja,
    bukaEditDetailPelaksanaan
  } = k.detail;
  const bolehLewatiReview = isAdmin || hasFullAccess(currentUser as never);
  const router = useRouter();

  return (
    <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex justify-center z-1000 p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) { setDetailReminder(null); setShowModeModal(false); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); } }}>
      <div className="flex gap-3 w-full justify-center min-h-0"
        style={{ maxWidth: showModeModal ? '1140px' : showRiwayat ? '1060px' : '672px', transition: 'max-width 0.25s ease' }}>
      <div className="bg-white rounded-kartu shadow-modal w-full flex-1 min-w-0 overflow-hidden flex flex-col"
        style={{ height: '100%' }}>
        <div className="px-6 py-5 shrink-0 sticky top-0 z-30 relative bg-white border-b border-slate-100">
          <button onClick={() => setShowRiwayat(v => !v)}
            title={showRiwayat ? 'Sembunyikan riwayat perubahan' : 'Tampilkan riwayat perubahan'}
            className="tombol-kedua absolute top-3 right-14 h-8 px-2.5 rounded-kecil flex items-center gap-1 text-[11px] font-bold">
            <Ikon nama="🕘" ukuran="1em" className="inline-block align-[-0.12em]" /> <span className="hidden sm:inline">Riwayat</span>
          </button>
          <div className="flex flex-wrap gap-2 mb-3 pr-24 sm:pr-40">
            <PriorityBadge priority={detailReminder.priority} />
            <StatusBadge status={detailReminder.status} />
            <CategoryBadge category={detailReminder.category} />
            {detailReminder.repeat !== 'none' && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                🔁 {REPEAT_OPTIONS.find(r => r.value === detailReminder.repeat)?.label}
              </span>
            )}
            {detailReminder.wa_sent_h1 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800"><IkonTeks nama="✅" />WA H-1 Terkirim</span>
            )}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1 mb-0.5">Nama Project</p>
          <h2 className="text-lg sm:text-xl sm:leading-7 font-bold text-slate-800 leading-tight">{(detailReminder.project_name || '').trim() || ((detailReminder).title || '').trim() || '—'}</h2>
          {detailReminder.address && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2 mb-0.5">Lokasi</p>
              <p className="text-slate-700 text-sm flex items-center gap-1.5"><span><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>{detailReminder.address}</p>
            </>
          )}
          {detailReminder.description && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2 mb-0.5">Deskripsi</p>
              <p className="text-slate-600 text-xs">{detailReminder.description}</p>
            </>
          )}
          {detailReminder.category === 'Troubleshooting' && (
            <button
              onClick={e => { e.stopPropagation(); setDetailReminder(null); router.push('/ticketing'); }}
              className="tombol-kedua mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-kontrol text-xs font-bold">
              <IkonTeks nama="🎫" />Buka Platform Ticketing
            </button>
          )}
          <button aria-label="Tutup" onClick={() => { setDetailReminder(null); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-kecil flex items-center justify-center text-slate-500 hover:text-rose-600 bg-black/5 font-bold text-sm">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {(isAdmin || currentUser?.role === 'team' || isMyReviewStage(detailReminder)) && (
            <div className="flex gap-2 flex-wrap sticky top-0 z-20 bg-white/95 backdrop-blur-xs -mx-5 px-5 py-2.5 border-b border-gray-100">
              {canInternalApprove(detailReminder) && (
                <>
                  <TombolSetujui ukuran="kecil" onClick={() => setInternalApproveTarget(detailReminder)}>Setujui &amp; Teruskan ke Admin</TombolSetujui>
                  <TombolTolak ukuran="kecil" onClick={() => handleInternalReject(detailReminder)} />
                </>
              )}
              {canApproveAssign && !detailReminder.assigned_to && detailReminder.notes?.includes('[REQUEST SALES]') && (detailReminder.routing_status !== 'internal_review' || bolehLewatiReview) && (
                <>
                  <TombolSetujui ukuran="kecil" onClick={() => { setApproveTarget(detailReminder); setApproveBatchSiblings(detailReminder.batch_id ? reminders.filter(gr => gr.id !== detailReminder.id && gr.batch_id === detailReminder.batch_id && !gr.assigned_to) : []); setApproveAssignTo(''); setApproveDate(detailReminder.due_date); setApproveTime(detailReminder.due_time); }}>Setujui &amp; Tugaskan</TombolSetujui>
                  <TombolTolak ukuran="kecil" onClick={() => handleAdminReject(detailReminder)} />
                </>
              )}
              {currentUser?.id === detailReminder.assigned_supervisor_id && detailReminder.routing_status === 'supervisor_assign' && (
                <TombolTugaskan ukuran="kecil" onClick={() => openSupervisorAssign(detailReminder, [detailReminder, ...reminders.filter(gr => gr.id !== detailReminder.id && gr.batch_id === detailReminder.batch_id)])}>Tugaskan Tim</TombolTugaskan>
              )}
              {bolehEditReminder(detailReminder) && detailReminder.status !== 'done' && (
                <button onClick={() => { setRescheduleTarget(detailReminder); }}
                  className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold"><IkonTeks nama="📅" />Re-Schedule</button>
              )}
              {bolehEditReminder(detailReminder) && detailReminder.status === 'done' && detailReminder.sales_name?.trim() && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && (
                <button onClick={() => handleResendFormReview(detailReminder)} disabled={resendingFormReview}
                  className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold">
                  {resendingFormReview ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /> : '⭐'} Kirim Ulang Review</button>
              )}
              {(isAdmin || isManager) && (
                <button onClick={() => handleSendWA(detailReminder)} disabled={sendingWA === detailReminder.id}
                  className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold">
                  {sendingWA === detailReminder.id ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /> : '💬'} Kirim WA</button>
              )}
              {detailReminder.status !== 'cancelled' && detailReminder.due_date && (
                <button title="Tambah ke kalender (.ics)" aria-label="Tambah ke kalender"
                  onClick={() => {
                    const r = detailReminder;
                    const ics = buatIcs({
                      uid: r.id, judul: `${r.category} - ${r.project_name}`, tanggal: r.due_date, jam: r.due_time,
                      lokasi: r.address, url: `${appBaseUrl()}/reminder-schedule?open=${encodeURIComponent(r.id)}`,
                      keterangan: [r.assign_name && `PTS: ${r.assign_name}`, r.sales_name && `Sales: ${r.sales_name}`, r.pic_name && `PIC: ${r.pic_name}${r.pic_phone ? ` (${r.pic_phone})` : ''}`, r.description].filter(Boolean).join('\n'),
                    });
                    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
                    unduhUrl(url, `${(r.project_name || 'jadwal').replace(/[\\/:*?"<>|]+/g, '').slice(0, 60)}.ics`);
                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-sm border border-slate-200 bg-white text-slate-700 transition-all hover:bg-slate-50">
                  <Ikon nama="🗓" ukuran={16} />
                </button>
              )}
              {bolehEditReminder(detailReminder) && (
                <button onClick={() => openEdit(detailReminder)}
                  className="tombol-utama flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold"><IkonTeks nama="✏" />Edit</button>
              )}
            </div>
          )}

          {detailReminder.status === 'cancelled' && detailReminder.rejection_reason && (
            <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <span className="text-base shrink-0"><Ikon nama="❌" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
                <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>Ditugaskan ke</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(220,38,38,0.2)', color: '#dc2626' }}>
                    {detailReminder.assign_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 wrap-break-word">{detailReminder.assign_name}</p>
                    <p className="text-xs truncate" title={detailReminder.assigned_to ?? ''} style={{ color: '#64748b' }}><Username value={detailReminder.assigned_to} /></p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
                <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}><IkonTeks nama="📅" />Jadwal</p>
                <p className="text-sm font-bold text-slate-800">{formatDate(detailReminder.due_date)}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}><Ikon nama="⏰" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailReminder.due_time}</p>
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
                  <span className="text-base shrink-0"><Ikon nama="⭐" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#7c3aed' }}>Guest Review (Sales)</p>
                    <p className="text-sm font-semibold text-violet-700">{detailReminder.sales_name}</p>
                    {detailReminder.sales_division && <p className="text-[11px] text-violet-500">{detailReminder.sales_division}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {detailReminder.status === 'done' ? (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full text-white" style={{ background: '#7c3aed' }}>
                        Form Review ✓
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', border: '1px solid rgba(245,158,11,0.4)' }}>
                        <IkonTeks nama="⏳" />Setelah Completed
                      </span>
                    )}
                  </div>
                </div>
              )}
              {detailReminder.pic_name && <InfoRow icon="🙋" label="Nama PIC Project" value={detailReminder.pic_name} />}
              {detailReminder.pic_phone && (
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <span className="text-base shrink-0"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>No. Telepon PIC</p>
                    <a href={`tel:${detailReminder.pic_phone}`} className="text-sm font-semibold hover:underline" style={{ color: '#60a5fa' }}
                      onClick={e => e.stopPropagation()}>{detailReminder.pic_phone}</a>
                  </div>
                </div>
              )}
              {detailReminder.description && <InfoRow icon="📝" label="Deskripsi" value={detailReminder.description} />}
            </div>
          </div>

          {cleanRequestNotes(detailReminder.notes) && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: '#f59e0b' }}><IkonTeks nama="📝" />Catatan</p>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{cleanRequestNotes(detailReminder.notes)}</p>
            </div>
          )}

          <SeksiPelaksanaan detailReminder={detailReminder} />

          {(INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category)
            && detailReminder.status === 'done'
            && !detailReminder.mode_penyelesaian
            && (isAdmin || currentUser?.role === 'team') && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.35)' }}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-lg"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Detail Pelaksanaan Belum Diisi</p>
                  <p className="text-[11px] text-amber-700/80 mt-1 leading-relaxed">
                    Jadwal ini sudah Completed tapi mode Onsite/Remote, tanggal BAST, dan tipe display-nya belum tercatat —
                    di Incentive PTS akan terbaca sebagai &quot;Mode belum diset&quot;. Lengkapi di sini; statusnya tidak berubah.
                  </p>
                </div>
              </div>
              <button onClick={() => bukaEditDetailPelaksanaan(detailReminder)}
                className="tombol-utama w-full py-2.5 rounded-kontrol text-xs font-bold">
                <IkonTeks nama="➕" />Isi Detail Pelaksanaan
              </button>
            </div>
          )}

          {(isAdmin || currentUser?.role === 'team') && !detailReminder.assigned_to && detailReminder.notes?.includes('[REQUEST SALES]') && detailReminder.status !== 'done' && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-1" style={{ background: 'rgba(148,163,184,0.1)', border: '1.5px solid rgba(148,163,184,0.3)' }}>
              <span className="text-lg"><Ikon nama="🔒" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <div>
                <p className="text-xs font-bold text-slate-600">Belum bisa update status</p>
                <p className="text-[11px] text-slate-500">Menunggu approval & assignment selesai (Sales Internal → Manager → Supervisor → Team).</p>
              </div>
            </div>
          )}
          <EditJadwalCepat
            bolehEditReminder={bolehEditReminder} detailReminder={detailReminder} pendingStatus={pendingStatus} setPendingStatus={setPendingStatus} setStatusPhoto={setStatusPhoto} setStatusPhotoPreview={setStatusPhotoPreview}
            setShowModeModal={setShowModeModal} setPendingPhotoUrl={setPendingPhotoUrl} setModePenyelesaian={setModePenyelesaian} setInstallerName={setInstallerName} setInstallerUserId={setInstallerUserId} setInstallerDaerah={setInstallerDaerah}
            setBastDate={setBastDate} setDisplayType={setDisplayType} setRequiresMiddleware={setRequiresMiddleware} setRequiresControllerAuto={setRequiresControllerAuto} setControllerBrand={setControllerBrand} showModeModal={showModeModal}
            statusPhotoRef={statusPhotoRef} statusPhotoPreview={statusPhotoPreview} statusPhoto={statusPhoto} handleConfirmStatusUpdate={handleConfirmStatusUpdate} updatingStatus={updatingStatus}
          />

          {detailReminder.status === 'done' && detailReminder.completion_photo_url && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.05)' }}>
              <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="text-base"><Ikon nama="📸" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#047857' }}>Foto Bukti Selesai</p>
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
                  <IkonTeks nama="🔗" />Buka foto di tab baru
                </a>
              </div>
            </div>
          )}

        </div>
      </div>

      <RiwayatJadwal showRiwayat={showRiwayat} showModeModal={showModeModal} detailReminder={detailReminder} setShowRiwayat={setShowRiwayat} guestUsers={guestUsers} />

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
          modeEditSaja={modeEditSaja}
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
