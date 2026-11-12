"use client";

import { Suspense } from "react";
import { NewTicketModal } from "./_components/NewTicketModal";
import { LapisanMemuatTicket } from "./_components/LapisanMemuatTicket";
import { GayaTicketing } from "./_components/GayaTicketing";
import {
  OverdueSettingModal, ReopenPTSModal, ReopenServicesModal, RejectModal, DeleteModal,
} from "./_components/SimpleActionModals";
import {
  BulkDeleteConfirmModal, ServicesApprovalModal, ReminderScheduleModal, SupervisorAssignModal,
} from "./_components/AssignApprovalModals";
import { AccountSettingsModal } from "./_components/AccountSettingsModal";
import { ActivitySummaryModal } from "./_components/ActivitySummaryModal";
import { AdminEditModal } from "./_components/AdminEditModal";
import { ApprovalModal } from "./_components/ApprovalModal";
import { TicketDetailPopup } from "./_components/TicketDetailPopup";
import { Toast, ConfirmDialog } from "@/components/shared";
import { PopupDaftarNotifikasi } from './_components/PopupDaftarNotifikasi';
import { PopupNotifikasiBaru } from './_components/PopupNotifikasiBaru';
import { IsiTicketing } from './_components/IsiTicketing';
import { KepalaTicketing } from './_components/KepalaTicketing';
import { KonteksTicket, type NilaiKonteksTicket } from './_components/konteks-ticket';
import { useTicketing } from './_components/useTicketing';

function TicketingSystemInner() {
  const {
    loading, currentUser, currentUserTeamType, teamMembers, users, bolehUpdateTicket, canApproveAssign, canManageTickets,
    fetchData, fetchError, filteredTickets, getOverdueSetting, getWarrantyInfo, isTicketOverdue, paginatedTickets, setFetchError,
    ticketListRef, tickets, ticketsLoading, uploading, productStats, salesDivisionStats, stats, availableYears,
    filterStatus, filterYear, handlerFilter, productFilter, salesDivisionFilter, searchProduct, searchProject, searchSalesName,
    selectedHandlerTeam, setFilterStatus, setFilterYear, setHandlerFilter, setProductFilter, setSalesDivisionFilter, setSearchProduct, setSearchProject,
    setSearchSalesName, setSelectedHandlerTeam, ITEMS_PER_PAGE, currentPage, setCurrentPage, totalPages, bulkDeleting, selectMode,
    selectedIds, setBulkConfirm, setSelectMode, setSelectedIds, toggleSelectAll, toggleSelectId, bukaApprovalUntukTicket, bukaDeleteTicket,
    bukaDetailTicket, bukaOverdueSetting, bukaReopenTicket, bukaRingkasanAktivitas, jalankanCetakTicket, jalankanEksporExcel, confirmState, setConfirmState,
    toast, showLoadingPopup, loadingMessage, canCreateTicket, fetchProjectReminders, notifications, pendingApprovalTickets, pendingServicesApprovalTickets,
    setApprovalAssignees, setNewTicket, setShowAccountSettings, setShowApprovalModal, setShowNewTicket, setShowNotifications, setShowReminderSchedule, setShowServicesApprovalModal,
    showNewTicket, showNotifications, bulkConfirm, jalankanBulkDelete, setSelectedTicket, setShowNotificationPopup, setShowTicketDetailPopup, showNotificationPopup,
    showTicketDetailPopup, selectedTicket, showUpdateForm, setShowUpdateForm, bukaAdminEdit, getDeadline, setSupAssignTicket, setSupAssignTo,
    setReopenTargetTicket, setReopenAssignee, setReopenNotes, setShowReopenModal, setReopenServicesTarget, newActivity, setNewActivity, addActivity,
    showApprovalModal, projectReminders, approvalAssignees, teamPTSMembers, supervisorMembers, approvingId, jalankanApproveTicket, rejectTicket,
    setApprovalTicket, setApprovalAssignee, showServicesApprovalModal, approveServicesTicket, rejectServicesTicket, showReminderSchedule, showAccountSettings, canAccessAccountSettings,
    newUser, setNewUser, createUser, selectedUserForPassword, setSelectedUserForPassword, changePassword, setChangePassword, updatePassword,
    adminEditTicket, adminRerouteTo, setAdminRerouteTo, adminEditSaving, adminEditForm, setAdminEditForm, simpanAdminEdit, setAdminEditTicket,
    supAssignTicket, supAssignTo, supAssignSaving, handleSupervisorAssignTicket, newTicket, createTicket, showOverdueSetting, overdueTargetTicket,
    overdueForm, setOverdueForm, saveOverdueSetting, setShowOverdueSetting, setOverdueTargetTicket, deleteOverdueSetting, showReopenModal, reopenTargetTicket,
    reopenAssignee, reopenNotes, reopenTicket, reopenServicesTarget, reopeningServices, reopenServicesTicket, showActivitySummary, summaryTicket,
    setShowActivitySummary, setSummaryTicket, showRejectModal, rejectTargetTicket, rejectReason, setRejectReason, confirmReject, setShowRejectModal,
    setRejectTargetTicket, showDeleteModal, deleteTargetTicket, deleteConfirmText, setDeleteConfirmText, deleteTicket, setShowDeleteModal, setDeleteTargetTicket,
  } = useTicketing();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-fixed" style={{ background: 'var(--latar-halaman)' }}>
        <div className="bg-white/75 p-8 rounded-2xl shadow-2xl">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
          <p className="mt-4 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  const konteksTicket: NilaiKonteksTicket = {
    sesi: { currentUser, currentUserTeamType, teamMembers, users },
    izin: { bolehUpdateTicket, canApproveAssign, canManageTickets },
    data: { fetchData, fetchError, filteredTickets, getOverdueSetting, getWarrantyInfo, isTicketOverdue, loading, paginatedTickets, setFetchError, ticketListRef, tickets,
      ticketsLoading, uploading },
    ringkasan: { productStats, salesDivisionStats, stats },
    filter: { availableYears, filterStatus, filterYear, handlerFilter, productFilter, salesDivisionFilter, searchProduct, searchProject, searchSalesName, selectedHandlerTeam,
      setFilterStatus, setFilterYear, setHandlerFilter, setProductFilter, setSalesDivisionFilter, setSearchProduct, setSearchProject, setSearchSalesName, setSelectedHandlerTeam },
    halaman: { ITEMS_PER_PAGE, currentPage, setCurrentPage, totalPages },
    pilih: { bulkDeleting, selectMode, selectedIds, setBulkConfirm, setSelectMode, setSelectedIds, toggleSelectAll, toggleSelectId },
    aksi: { bukaApprovalUntukTicket, bukaDeleteTicket, bukaDetailTicket, bukaOverdueSetting, bukaReopenTicket, bukaRingkasanAktivitas, jalankanCetakTicket, jalankanEksporExcel },
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{ background: 'var(--latar-halaman)', backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(255,255,255,0.08)" }} />
      {toast && <Toast notif={toast} />}
      <div className="relative flex flex-col flex-1 overflow-hidden">

        <LapisanMemuatTicket showLoadingPopup={showLoadingPopup} loadingMessage={loadingMessage} uploading={uploading} />

        <KepalaTicketing
          canApproveAssign={canApproveAssign} canCreateTicket={canCreateTicket} canManageTickets={canManageTickets} currentUser={currentUser} currentUserTeamType={currentUserTeamType} fetchProjectReminders={fetchProjectReminders} notifications={notifications} pendingApprovalTickets={pendingApprovalTickets} pendingServicesApprovalTickets={pendingServicesApprovalTickets} setApprovalAssignees={setApprovalAssignees} setNewTicket={setNewTicket} setShowAccountSettings={setShowAccountSettings} setShowApprovalModal={setShowApprovalModal} setShowNewTicket={setShowNewTicket} setShowNotifications={setShowNotifications} setShowReminderSchedule={setShowReminderSchedule} setShowServicesApprovalModal={setShowServicesApprovalModal} showNewTicket={showNewTicket} showNotifications={showNotifications}
        />

        <KonteksTicket.Provider value={konteksTicket}>
          <IsiTicketing />
        </KonteksTicket.Provider>

        {bulkConfirm && (
          <BulkDeleteConfirmModal
            jumlah={selectedIds.size}
            onCancel={() => setBulkConfirm(false)}
            onConfirm={jalankanBulkDelete}
          />
        )}

        <PopupNotifikasiBaru
          currentUserTeamType={currentUserTeamType} isTicketOverdue={isTicketOverdue} notifications={notifications} setSelectedTicket={setSelectedTicket} setShowNotificationPopup={setShowNotificationPopup} setShowTicketDetailPopup={setShowTicketDetailPopup} showNotificationPopup={showNotificationPopup}
        />

        <PopupDaftarNotifikasi
          currentUserTeamType={currentUserTeamType} isTicketOverdue={isTicketOverdue} notifications={notifications} setSelectedTicket={setSelectedTicket} setShowNotifications={setShowNotifications} setShowTicketDetailPopup={setShowTicketDetailPopup} showNotifications={showNotifications}
        />

        {showTicketDetailPopup && selectedTicket && (
          <TicketDetailPopup
            selectedTicket={selectedTicket} currentUser={currentUser} currentUserTeamType={currentUserTeamType} canManageTickets={canManageTickets} users={users}
            showUpdateForm={showUpdateForm} setShowUpdateForm={setShowUpdateForm} onClose={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); }}
            bukaAdminEdit={bukaAdminEdit} getDeadline={getDeadline} getWarrantyInfo={getWarrantyInfo} bolehUpdateTicket={bolehUpdateTicket}
            setSupAssignTicket={setSupAssignTicket} setSupAssignTo={setSupAssignTo} setReopenTargetTicket={setReopenTargetTicket}
            setReopenAssignee={setReopenAssignee} setReopenNotes={setReopenNotes} setShowReopenModal={setShowReopenModal}
            setReopenServicesTarget={setReopenServicesTarget} setShowServicesApprovalModal={setShowServicesApprovalModal} newActivity={newActivity}
            setNewActivity={setNewActivity} addActivity={addActivity} uploading={uploading}
          />
        )}

        {showApprovalModal && canApproveAssign && (
          <ApprovalModal
            pendingApprovalTickets={pendingApprovalTickets}
            projectReminders={projectReminders}
            approvalAssignees={approvalAssignees}
            setApprovalAssignees={setApprovalAssignees}
            teamPTSMembers={teamPTSMembers}
            supervisorMembers={supervisorMembers}
            approvingId={approvingId}
            uploading={uploading}
            jalankanApproveTicket={jalankanApproveTicket}
            rejectTicket={rejectTicket}
            onClose={() => { setShowApprovalModal(false); setApprovalAssignees({}); setApprovalTicket(null); setApprovalAssignee(""); }}
          />
        )}

        {showServicesApprovalModal && currentUserTeamType === "Team Services" && (
          <ServicesApprovalModal
            pendingServicesApprovalTickets={pendingServicesApprovalTickets}
            uploading={uploading}
            approveServicesTicket={approveServicesTicket}
            rejectServicesTicket={rejectServicesTicket}
            onClose={() => setShowServicesApprovalModal(false)}
          />
        )}

        {showReminderSchedule && canManageTickets && (
          <ReminderScheduleModal onClose={() => setShowReminderSchedule(false)} />
        )}

        {showAccountSettings && canAccessAccountSettings && (
          <AccountSettingsModal
            newUser={newUser}
            setNewUser={setNewUser}
            createUser={createUser}
            selectedUserForPassword={selectedUserForPassword}
            setSelectedUserForPassword={setSelectedUserForPassword}
            changePassword={changePassword}
            setChangePassword={setChangePassword}
            updatePassword={updatePassword}
            users={users}
            onClose={() => setShowAccountSettings(false)}
          />
        )}

        {adminEditTicket && (
          <AdminEditModal
            adminEditTicket={adminEditTicket}
            adminRerouteTo={adminRerouteTo}
            setAdminRerouteTo={setAdminRerouteTo}
            adminEditSaving={adminEditSaving}
            supervisorMembers={supervisorMembers}
            teamPTSMembers={teamPTSMembers}
            adminEditForm={adminEditForm}
            setAdminEditForm={setAdminEditForm}
            simpanAdminEdit={simpanAdminEdit}
            onClose={() => setAdminEditTicket(null)}
          />
        )}

        {supAssignTicket && (
          <SupervisorAssignModal
            supAssignTicket={supAssignTicket}
            supAssignTo={supAssignTo}
            setSupAssignTo={setSupAssignTo}
            teamPTSMembers={teamPTSMembers}
            currentUser={currentUser}
            supAssignSaving={supAssignSaving}
            handleSupervisorAssignTicket={handleSupervisorAssignTicket}
            onClose={() => { setSupAssignTicket(null); setSupAssignTo(""); }}
          />
        )}

        {showNewTicket && canCreateTicket && (
          <NewTicketModal
            onClose={() => setShowNewTicket(false)}
            form={newTicket}
            setForm={setNewTicket}
            uploading={uploading}
            currentUser={currentUser}
            users={users}
            teamPTSMembers={teamPTSMembers}
            supervisorMembers={supervisorMembers}
            onSubmit={createTicket}
          />
        )}

        {showOverdueSetting && overdueTargetTicket && canManageTickets && (
          <OverdueSettingModal
            overdueTargetTicket={overdueTargetTicket}
            overdueForm={overdueForm}
            setOverdueForm={setOverdueForm}
            saveOverdueSetting={saveOverdueSetting}
            onClose={() => { setShowOverdueSetting(false); setOverdueTargetTicket(null); setOverdueForm({ due_hours: "48" }); }}
            punyaSettingTersimpan={!!getOverdueSetting(overdueTargetTicket.id)}
            onHapusSetting={() => { deleteOverdueSetting(overdueTargetTicket.id); setShowOverdueSetting(false); setOverdueTargetTicket(null); }}
          />
        )}

        {showReopenModal && reopenTargetTicket && (
          <ReopenPTSModal
            reopenTargetTicket={reopenTargetTicket}
            reopenAssignee={reopenAssignee}
            setReopenAssignee={setReopenAssignee}
            reopenNotes={reopenNotes}
            setReopenNotes={setReopenNotes}
            teamPTSMembers={teamPTSMembers}
            reopenTicket={reopenTicket}
            uploading={uploading}
            onClose={() => { setShowReopenModal(false); setReopenTargetTicket(null); setReopenAssignee(""); setReopenNotes(""); }}
          />
        )}

        {reopenServicesTarget && (
          <ReopenServicesModal
            reopenServicesTarget={reopenServicesTarget}
            reopeningServices={reopeningServices}
            reopenServicesTicket={reopenServicesTicket}
            onClose={() => setReopenServicesTarget(null)}
          />
        )}

        {showActivitySummary && summaryTicket && (
          <ActivitySummaryModal
            summaryTicket={summaryTicket}
            users={users}
            getWarrantyInfo={getWarrantyInfo}
            onClose={() => { setShowActivitySummary(false); setSummaryTicket(null); }}
          />
        )}
        {showRejectModal && rejectTargetTicket && (
          <RejectModal
            rejectTargetTicket={rejectTargetTicket}
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            uploading={uploading}
            confirmReject={confirmReject}
            onClose={() => { setShowRejectModal(false); setRejectTargetTicket(null); setRejectReason(""); }}
          />
        )}

        {showDeleteModal && deleteTargetTicket && (
          <DeleteModal
            deleteTargetTicket={deleteTargetTicket}
            deleteConfirmText={deleteConfirmText}
            setDeleteConfirmText={setDeleteConfirmText}
            uploading={uploading}
            deleteTicket={deleteTicket}
            onClose={() => { setShowDeleteModal(false); setDeleteTargetTicket(null); setDeleteConfirmText(""); }}
          />
        )}

      </div>
      <GayaTicketing />
    </div>
  );
}

export default function TicketingSystem() {
  return (
    <Suspense>
      <TicketingSystemInner />
    </Suspense>
  );
}
