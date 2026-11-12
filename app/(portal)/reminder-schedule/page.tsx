'use client';

import { Suspense } from 'react';
import { LoadingScreen } from '@/components/shared';
import { RescheduleModal } from './_components/RescheduleModal';
import { RequestJadwalModal } from './_components/RequestJadwalModal';
import { ReminderFormModal, type ReminderForm } from './_components/ReminderFormModal';
import { KonfirmasiApproveInternal, ModalHapus, PopupNotifikasi, PopupLonceng } from './_components/PopupRingkas';
import { RejectReasonModal } from './_components/RejectReasonModal';
import { BulkDeleteConfirmModal } from './_components/BulkDeleteConfirmModal';
import { TanyaLanjutanModal, PilihTipeReminderModal, CariProyekLamaModal } from './_components/LapisEmpatModals';
import { ApproveAssignModal, SupervisorAssignModal } from './_components/ApproveAssignModals';
import { ReminderDetailPopup } from './_components/ReminderDetailPopup';
import { Toast } from '@/components/shared/Toast';
import { IsiJadwal } from './_components/IsiJadwal';
import { KepalaJadwal } from './_components/KepalaJadwal';
import { KonteksJadwal } from './_components/konteks-jadwal';
import { GayaJadwal } from './_components/GayaJadwal';
import { useHalamanJadwal } from './_components/useHalamanJadwal';

function ReminderSchedulePageInner() {
  const {
    appReady, konteksJadwal, toast, rescheduleTarget, setRescheduleTarget, handleReschedule, showRequestModal, currentUser,
    myIsInternalSales, guestUsers, praFillGuest, setShowRequestModal, setProyekLamaTerpilih, setPraFillGuest, handleRequestJadwal, internalRejectTarget,
    internalRejectReason, setInternalRejectReason, internalRejectSaving, handleInternalRejectConfirm, setInternalRejectTarget, adminRejectTarget, adminRejectReason, setAdminRejectReason,
    adminRejectSaving, handleAdminRejectConfirm, setAdminRejectTarget, internalApproveTarget, internalApproveSaving, setInternalApproveTarget, handleInternalApprove, approveTarget,
    canApproveAssign, approveBatchSiblings, approveAssignTo, setApproveAssignTo, approveDate, setApproveDate, approveTime, setApproveTime,
    approveSupervisors, approveRouteSaving, handleApproveRoute, approveStart, setApproveStart, approveTarget2, setApproveTarget2, approveSaving,
    handleApproveAssign, teamUsersDitawarkan, setApproveTarget, setApproveBatchSiblings, supervisorAssignTarget, supervisorAssignBatchSiblings, supervisorAssignTo, setSupervisorAssignTo,
    supervisorAssignSaving, handleSupervisorAssignConfirm, setSupervisorAssignTarget, setSupervisorAssignBatchSiblings, showDeleteModal, deleteTarget, deleteConfirmText, setDeleteConfirmText,
    setShowDeleteModal, setDeleteTarget, handleDelete, bulkConfirm, selectedIds, setBulkConfirm, jalankanBulkDelete, tanyaLanjutan,
    setTanyaLanjutan, resolveGrupInsentif, langkahBuat, buatUntukGuest, setLangkahBuat, setShowFormModal, carianProyek, setCarianProyek,
    praPilihProyek, setPraPilihProyek, hasilCarianProyek, reminders, konfirmasiProyekLama, showFormModal, editingReminder, proyekLamaTerpilih,
    formData, setFormData, saving, bulkTarget, setBulkTarget, extraDates, setExtraDates, setEditingReminder,
    emptyForm, handleSave, isAdmin, isManager, teamUsers, showNotificationPopup, myReminders, setShowNotificationPopup,
    setDetailReminder, showBellPopup, myActiveReminders, perluAksiSaya, setShowBellPopup, detailReminder, canAddReminder, isGuest,
    mulaiBuatReminder, mulaiRequestJadwal, pendingReviewCount, view,
  } = useHalamanJadwal();

  if (!appReady) return <LoadingScreen />;

  return (
    <KonteksJadwal.Provider value={konteksJadwal}>
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      background: 'var(--latar-halaman)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="relative flex flex-col flex-1 overflow-hidden">

        <Toast notif={toast} />

        {rescheduleTarget && (
          <RescheduleModal
            reminder={rescheduleTarget}
            onClose={() => setRescheduleTarget(null)}
            onSave={handleReschedule}
          />
        )}

        {showRequestModal && currentUser && (
          <RequestJadwalModal
            salesName={currentUser.full_name}
            salesUsername={currentUser.username}
            salesDivision={currentUser.sales_division ?? ''}
            isInternalSales={myIsInternalSales || currentUser.team_type === 'Marketing'}
            externalSalesUsers={guestUsers
              .filter(g => !g.is_internal_sales && g.id !== currentUser.id)
              .map(g => ({ id: g.id, full_name: g.full_name, sales_division: g.sales_division ?? null }))}
            initial={praFillGuest ?? undefined}
            onClose={() => { setShowRequestModal(false); setProyekLamaTerpilih(null); setPraFillGuest(null); }}
            onSubmit={handleRequestJadwal}
          />
        )}

        {internalRejectTarget && (
          <RejectReasonModal
            target={internalRejectTarget}
            reason={internalRejectReason}
            setReason={setInternalRejectReason}
            saving={internalRejectSaving}
            onConfirm={handleInternalRejectConfirm}
            onCancel={() => setInternalRejectTarget(null)}
          />
        )}

        {adminRejectTarget && (
          <RejectReasonModal
            target={adminRejectTarget}
            reason={adminRejectReason}
            setReason={setAdminRejectReason}
            saving={adminRejectSaving}
            onConfirm={handleAdminRejectConfirm}
            onCancel={() => setAdminRejectTarget(null)}
          />
        )}

                <KonfirmasiApproveInternal
          internalApproveTarget={internalApproveTarget}
          internalApproveSaving={internalApproveSaving}
          setInternalApproveTarget={setInternalApproveTarget}
          handleInternalApprove={handleInternalApprove}
        />

        {approveTarget && canApproveAssign && (
          <ApproveAssignModal
            approveTarget={approveTarget}
            approveBatchSiblings={approveBatchSiblings}
            approveAssignTo={approveAssignTo}
            setApproveAssignTo={setApproveAssignTo}
            approveDate={approveDate}
            setApproveDate={setApproveDate}
            approveTime={approveTime}
            setApproveTime={setApproveTime}
            approveSupervisors={approveSupervisors}
            approveRouteSaving={approveRouteSaving}
            handleApproveRoute={handleApproveRoute}
            approveStart={approveStart}
            setApproveStart={setApproveStart}
            approveTarget2={approveTarget2}
            setApproveTarget2={setApproveTarget2}
            approveSaving={approveSaving}
            handleApproveAssign={handleApproveAssign}
            teamUsers={teamUsersDitawarkan}
            onClose={() => { setApproveTarget(null); setApproveBatchSiblings([]); setApproveAssignTo(''); }}
            onBatal={() => { setApproveTarget(null); setApproveBatchSiblings([]); setApproveAssignTo(''); setApproveDate(''); setApproveTime(''); }}
          />
        )}

        {supervisorAssignTarget && (
          <SupervisorAssignModal
            supervisorAssignTarget={supervisorAssignTarget}
            supervisorAssignBatchSiblings={supervisorAssignBatchSiblings}
            supervisorAssignTo={supervisorAssignTo}
            setSupervisorAssignTo={setSupervisorAssignTo}
            teamUsers={teamUsersDitawarkan}
            currentUser={currentUser}
            supervisorAssignSaving={supervisorAssignSaving}
            handleSupervisorAssignConfirm={handleSupervisorAssignConfirm}
            onClose={() => { setSupervisorAssignTarget(null); setSupervisorAssignBatchSiblings([]); setSupervisorAssignTo(''); }}
          />
        )}

                <ModalHapus
          showDeleteModal={showDeleteModal}
          deleteTarget={deleteTarget}
          deleteConfirmText={deleteConfirmText}
          setDeleteConfirmText={setDeleteConfirmText}
          setShowDeleteModal={setShowDeleteModal}
          setDeleteTarget={setDeleteTarget}
          handleDelete={handleDelete}
        />

      {bulkConfirm && (
        <BulkDeleteConfirmModal
          jumlah={selectedIds.size}
          onCancel={() => setBulkConfirm(false)}
          onConfirm={jalankanBulkDelete}
        />
      )}

      {tanyaLanjutan && (
        <TanyaLanjutanModal
          tanyaLanjutan={tanyaLanjutan}
          onCancel={() => setTanyaLanjutan(null)}
          resolveGrupInsentif={resolveGrupInsentif}
        />
      )}

      {langkahBuat === 'pilih' && (
        <PilihTipeReminderModal
          buatUntukGuest={buatUntukGuest}
          onPilihLama={() => setLangkahBuat('cari')}
          onPilihBaru={() => {
            setLangkahBuat(null); setProyekLamaTerpilih(null);
            if (buatUntukGuest) { setPraFillGuest(null); setShowRequestModal(true); }
            else setShowFormModal(true);
          }}
          onCancel={() => setLangkahBuat(null)}
        />
      )}

      {langkahBuat === 'cari' && (
        <CariProyekLamaModal
          buatUntukGuest={buatUntukGuest}
          carianProyek={carianProyek}
          setCarianProyek={setCarianProyek}
          praPilihProyek={praPilihProyek}
          setPraPilihProyek={setPraPilihProyek}
          hasilCarianProyek={hasilCarianProyek}
          reminders={reminders}
          onKembali={() => { setLangkahBuat('pilih'); setPraPilihProyek(null); setCarianProyek(''); }}
          onBatal={() => setLangkahBuat(null)}
          konfirmasiProyekLama={konfirmasiProyekLama}
        />
      )}

      {showFormModal && (
        <ReminderFormModal
          editingReminder={editingReminder}
          jumlahJadwalLama={proyekLamaTerpilih?.length ?? 0}
          formData={formData as ReminderForm}
          setFormData={setFormData as (data: ReminderForm) => void}
          saving={saving}
          teamUsers={teamUsersDitawarkan}
          guestUsers={guestUsers}
          bulkTarget={bulkTarget}
          onBulkTargetChange={setBulkTarget}
          extraDates={extraDates}
          onExtraDatesChange={setExtraDates}
          onClose={() => { setShowFormModal(false); setEditingReminder(null); setFormData(emptyForm); setBulkTarget('none'); setExtraDates([]); setProyekLamaTerpilih(null); }}
          onSubmit={() => handleSave()}
          supervisorUsers={(isAdmin || isManager) ? teamUsers.filter(u => u.jabatan === 'Supervisor') : []}
          canAssignSelf={isAdmin || isManager}
          selfUser={currentUser ? { username: currentUser.username, full_name: currentUser.full_name } : null}
        />
      )}

                <PopupNotifikasi
          showNotificationPopup={showNotificationPopup}
          myReminders={myReminders}
          setShowNotificationPopup={setShowNotificationPopup}
          setDetailReminder={setDetailReminder}
        />

                <PopupLonceng
          showBellPopup={showBellPopup}
          myActiveReminders={myActiveReminders}
          perluAksiSaya={perluAksiSaya}
          setShowBellPopup={setShowBellPopup}
          setDetailReminder={setDetailReminder}
        />

        {detailReminder && <ReminderDetailPopup detailReminder={detailReminder} />}

        <KepalaJadwal
          canAddReminder={canAddReminder} isGuest={isGuest} mulaiBuatReminder={mulaiBuatReminder} mulaiRequestJadwal={mulaiRequestJadwal} myActiveReminders={myActiveReminders} pendingReviewCount={pendingReviewCount} setShowBellPopup={setShowBellPopup} view={view}
        />

        <IsiJadwal />

      </div>

      <GayaJadwal />

    </div>
    </KonteksJadwal.Provider>
  );
}

export default function ReminderSchedulePage() {
  return (
    <Suspense>
      <ReminderSchedulePageInner />
    </Suspense>
  );
}
