'use client';

import { useState, useEffect, Suspense } from 'react';
import { getSession } from '@/lib/auth/sesi';
import { LoadingScreen, ConfirmDialog, ModalPortal } from '@/components/shared';
import { User, statusConfig, getRoomStatus, getRoomAssignName } from './_components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { ModalEditForm } from './_components/ModalEditForm';
import { ModalReroute } from './_components/ModalReroute';
import { ModalDetailRequest } from './_components/ModalDetailRequest';
import { PopupTicketAktif } from './_components/PopupTicketAktif';
import { ModalHapusRequest } from './_components/ModalHapusRequest';
import { ModalUpdateStatus } from './_components/ModalUpdateStatus';
import { ModalApproveInternal } from './_components/ModalApproveInternal';
import { HeaderFormRequire } from './_components/HeaderFormRequire';
import { ModalTolakRequest } from './_components/halaman/ModalTolakRequest';
import { ModalHapusMassal } from './_components/halaman/ModalHapusMassal';
import { KontenHalamanRequest } from './_components/halaman/KontenHalamanRequest';
import { BlokAssignPTS } from './_components/halaman/BlokAssignPTS';
import { BlokFormBaru } from './_components/halaman/BlokFormBaru';
import { KonteksRequest, type NilaiKonteksRequest } from './_components/konteks-request';
import { KonteksFormBaru } from './_components/halaman/konteks-form-baru';
import { useHalamanRequest } from './_components/useHalamanRequest';

function FormRequireProject({ currentUser }: { currentUser: User }) {
  const {
    appReady, selectedRequest, detailRoomIdx, getDueStatus, isIVPGuest, isNonIVPGuest, isPTS, isTeamPTS,
    pimpinan, bisaKelolaRequest, bolehEditRequest, bolehRerouteRequest, canInternalApproveProject, displayFileName, formatDate, formatDueDate,
    formatFileSize, getCCLabel, getFileRoomIdx, notify, fetchRequests, filteredRequests, hal, handleOpenDetail,
    loading, ptsMembersList, renderRequestActions, requests, setShowNewFormModal, stats, unreadMsgMap, assignedPieData,
    divisionPieData, kebutuhanPieData, productPieData, statusPieData, availableYears, filterDivision, filterHandler, filterKebutuhan,
    filterMonth, filterStatus, filterYear, searchQuery, searchSales, setFilterDivision, setFilterHandler, setFilterKebutuhan,
    setFilterMonth, setFilterStatus, setFilterYear, setSearchQuery, setSearchSales, bulkDeleting, selectMode, selectedIds,
    setBulkConfirm, setSelectMode, setSelectedIds, toggleSelectAll, toggleSelectId, detailMobileTab, handleCloseDetail, setDetailMobileTab,
    setDetailRoomIdx, setSelectedRequest, showDetailModal, activeAttachTab, attachments, boqFileRef, desain3d, desain3dTools,
    design3dFileRef, downloadingPackage, fileInputRef, handleCategoryUpload, handleDeleteAttachment, handleFileUpload, mintaPilih3D, muatDesain3D,
    setActiveAttachTab, setDownloadingPackage, setMintaPilih3D, setShowUploadChoice, showUploadChoice, sldFileRef, uploadingCategory, uploadingFile,
    sld, sldTools, mintaPilihSld, setMintaPilihSld, muatSld, screenFileRef, screen, screenTools,
    mintaPilihScreen, setMintaPilihScreen, muatScreen, chatFileRef, chatRoomFilter, handleSendMessage, messages, messagesEndRef,
    msgText, sendingMsg, setChatRoomFilter, setMsgText, handleOpenEditForm, handleReject, handleResubmit, handleStatusUpdate,
    setAssignModal, setDeleteConfirmText, setDeleteModal, setInternalApproveTarget, setRerouteTarget, setRerouteTo, setSelectedNewStatus, setStatusUpdateModal,
    confirmState, setConfirmState, NotifToast, boqFormFile, boqRoomMap, brandPicMappings, dueDateForm, form,
    initialForm, myIsInternalSales, role, roomPhotoMap, rooms, salesGuestUsers, showNewFormModal, submitting,
    surveyPhotos, surveyPhotosPreviews, setBoqFormFile, setBoqRoomMap, setDueDateForm, setForm, setRoomPhotoMap, setRooms,
    setSurveyPhotos, setSurveyPhotosPreviews, handleSubmitForm, assignModal, fetchMessages, bellDropdownOpen, setBellDropdownOpen, bulkConfirm,
    setBulkDeleting, setRequests, handleInternalApproveProject, internalApproveSaving, internalApproveTarget, handleRejectConfirm, rejectModal, rejectNote,
    rejectSaving, setRejectModal, setRejectNote, canSetInProgress, selectedNewStatus, statusUpdateModal, deleteConfirmText, deleteModal,
    deleting, handleDeleteConfirm, setShowTicketPopup, showTicketPopup, isAdmin, isSuperAdmin, rerouteSaving, rerouteTarget,
    rerouteTo, rosterPTS, simpanReroute, editCur, editDueDate, editFormData, editFormModal, editNewRoomIds,
    editRoomAktifBaru, editRoomIdx, editRooms, editUpd, handleEditAddRoom, handleEditFormSubmit, handleEditRemoveNewRoom, setEditDueDate,
    setEditFormData, setEditFormModal, setEditRoomIdx,
  } = useHalamanRequest({ currentUser });

  if (!appReady) return <LoadingScreen />;

  const detailRoomStatus = selectedRequest ? getRoomStatus(selectedRequest, detailRoomIdx) : undefined;
  const detailSc = detailRoomStatus ? (statusConfig[detailRoomStatus] || statusConfig.pending) : null;
  const detailIsPending = detailRoomStatus === 'pending';
  const detailRoomAssignName = selectedRequest ? getRoomAssignName(selectedRequest, detailRoomIdx) : undefined;
  const detailDueStatus = selectedRequest ? getDueStatus(selectedRequest.due_date, detailRoomStatus ?? selectedRequest.status) : null;

  const konteksRequest: NilaiKonteksRequest = {
    sesi: { currentUser, isIVPGuest, isNonIVPGuest, isPTS, isTeamPTS, pimpinan },
    izin: { bisaKelolaRequest, bolehEditRequest, bolehRerouteRequest, canInternalApproveProject },
    bantu: { displayFileName, formatDate, formatDueDate, formatFileSize, getCCLabel, getDueStatus, getFileRoomIdx, notify },
    daftar: { fetchRequests, filteredRequests, hal, handleOpenDetail, loading, ptsMembersList, renderRequestActions, requests, setShowNewFormModal, stats, unreadMsgMap },
    ringkasan: { assignedPieData, divisionPieData, kebutuhanPieData, productPieData, statusPieData },
    filter: { availableYears, filterDivision, filterHandler, filterKebutuhan, filterMonth, filterStatus, filterYear, searchQuery, searchSales, setFilterDivision, setFilterHandler,
      setFilterKebutuhan, setFilterMonth, setFilterStatus, setFilterYear, setSearchQuery, setSearchSales },
    pilih: { bulkDeleting, selectMode, selectedIds, setBulkConfirm, setSelectMode, setSelectedIds, toggleSelectAll, toggleSelectId },
    detail: { detailDueStatus, detailIsPending, detailMobileTab, detailRoomAssignName, detailRoomIdx, detailRoomStatus, detailSc, handleCloseDetail, selectedRequest,
      setDetailMobileTab, setDetailRoomIdx, setSelectedRequest, showDetailModal },
    lampiran: { activeAttachTab, attachments, boqFileRef, desain3d, desain3dTools, design3dFileRef, downloadingPackage, fileInputRef, handleCategoryUpload, handleDeleteAttachment,
      handleFileUpload, mintaPilih3D, muatDesain3D, setActiveAttachTab, setDownloadingPackage, setMintaPilih3D, setShowUploadChoice, showUploadChoice, sldFileRef,
      uploadingCategory, uploadingFile,
      sld, sldTools, mintaPilihSld, setMintaPilihSld, muatSld, screenFileRef, screen, screenTools, mintaPilihScreen, setMintaPilihScreen, muatScreen },
    pesan: { chatFileRef, chatRoomFilter, handleSendMessage, messages, messagesEndRef, msgText, sendingMsg, setChatRoomFilter, setMsgText },
    aksi: { handleOpenEditForm, handleReject, handleResubmit, handleStatusUpdate, setAssignModal, setDeleteConfirmText, setDeleteModal, setInternalApproveTarget, setRerouteTarget,
      setRerouteTo, setSelectedNewStatus, setStatusUpdateModal },
  };

  return (
    <KonteksRequest.Provider value={konteksRequest}>
    <div className="flex flex-col h-screen overflow-hidden bg-cover bg-center bg-fixed bg-no-repeat" style={{ background: 'var(--latar-halaman)' }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      {NotifToast()}

      <KonteksFormBaru.Provider value={{
        nilai: { boqFormFile, boqRoomMap, brandPicMappings, currentUser, dueDateForm, form, initialForm, myIsInternalSales, role, roomPhotoMap,
          rooms, salesGuestUsers, showNewFormModal, submitting, surveyPhotos, surveyPhotosPreviews },
        ubah: { setBoqFormFile, setBoqRoomMap, setDueDateForm, setForm, setRoomPhotoMap, setRooms, setShowNewFormModal, setSurveyPhotos,
          setSurveyPhotosPreviews },
        aksi: { handleSubmitForm },
      }}>
        <BlokFormBaru />
      </KonteksFormBaru.Provider>

      <BlokAssignPTS
        assignModal={assignModal} currentUser={currentUser} fetchMessages={fetchMessages} fetchRequests={fetchRequests} notify={notify} selectedRequest={selectedRequest} setAssignModal={setAssignModal} setSelectedRequest={setSelectedRequest}
      />

      <HeaderFormRequire
        bellDropdownOpen={bellDropdownOpen} handleOpenDetail={handleOpenDetail} pimpinan={pimpinan} requests={requests} setBellDropdownOpen={setBellDropdownOpen} setShowNewFormModal={setShowNewFormModal}
      />

      <KontenHalamanRequest />

      <ModalHapusMassal
        bulkConfirm={bulkConfirm} notify={notify} selectedIds={selectedIds} setBulkConfirm={setBulkConfirm} setBulkDeleting={setBulkDeleting} setRequests={setRequests} setSelectMode={setSelectMode} setSelectedIds={setSelectedIds}
      />

      <ModalApproveInternal
        formatDate={formatDate} handleInternalApproveProject={handleInternalApproveProject} internalApproveSaving={internalApproveSaving} internalApproveTarget={internalApproveTarget} setInternalApproveTarget={setInternalApproveTarget}
      />

      <ModalTolakRequest
        handleRejectConfirm={handleRejectConfirm} rejectModal={rejectModal} rejectNote={rejectNote} rejectSaving={rejectSaving} setRejectModal={setRejectModal} setRejectNote={setRejectNote}
      />

      <ModalUpdateStatus
        bisaKelolaRequest={bisaKelolaRequest} canSetInProgress={canSetInProgress} currentUser={currentUser} handleStatusUpdate={handleStatusUpdate} isTeamPTS={isTeamPTS} selectedNewStatus={selectedNewStatus} setSelectedNewStatus={setSelectedNewStatus} setStatusUpdateModal={setStatusUpdateModal} statusUpdateModal={statusUpdateModal}
      />

      <ModalHapusRequest
        deleteConfirmText={deleteConfirmText} deleteModal={deleteModal} deleting={deleting} handleDeleteConfirm={handleDeleteConfirm} setDeleteConfirmText={setDeleteConfirmText} setDeleteModal={setDeleteModal}
      />

      <style>{`
        @keyframes scale-in { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform: none; } }
        @keyframes slide-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform: none; } }
        @keyframes wiggle { 0%,100%{transform:rotate(0deg)} 15%{transform:rotate(-15deg)} 30%{transform:rotate(15deg)} 45%{transform:rotate(-10deg)} 60%{transform:rotate(10deg)} 75%{transform:rotate(-5deg)} 90%{transform:rotate(5deg)} }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        select option { background: #ffffff; color: #1e293b; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(13,148,136,0.25); border-radius: 4px; }
      `}</style>

      <PopupTicketAktif
        formatDueDate={formatDueDate} handleOpenDetail={handleOpenDetail} requests={requests} setShowTicketPopup={setShowTicketPopup} showTicketPopup={showTicketPopup}
      />

      <ModalDetailRequest />

      <ModalReroute
        isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} rerouteSaving={rerouteSaving} rerouteTarget={rerouteTarget} rerouteTo={rerouteTo} rosterPTS={rosterPTS} setRerouteTarget={setRerouteTarget} setRerouteTo={setRerouteTo} simpanReroute={simpanReroute}
      />

      <ModalEditForm
        editCur={editCur} editDueDate={editDueDate} editFormData={editFormData} editFormModal={editFormModal} editNewRoomIds={editNewRoomIds} editRoomAktifBaru={editRoomAktifBaru} editRoomIdx={editRoomIdx} editRooms={editRooms} editUpd={editUpd} handleEditAddRoom={handleEditAddRoom} handleEditFormSubmit={handleEditFormSubmit} handleEditRemoveNewRoom={handleEditRemoveNewRoom} isPTS={isPTS} salesGuestUsers={salesGuestUsers} selectedRequest={selectedRequest} setEditDueDate={setEditDueDate} setEditFormData={setEditFormData} setEditFormModal={setEditFormModal} setEditRoomIdx={setEditRoomIdx}
      />
    </div>
    </KonteksRequest.Provider>
  );
}

export default function Page() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getSession<User>();
    if (user) setCurrentUser(user);
    setLoading(false);
  }, []);

  if (loading) return <LoadingScreen />;

  if (!currentUser) return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
      <div className="relative z-10 bg-white rounded-kartu shadow-modal p-8 max-w-sm w-full text-center"
        >
        <div className="text-5xl mb-4"><Ikon nama="🔐" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Sesi Habis</h2>
        <p className="text-gray-500 text-sm mb-6">Silakan login kembali melalui dashboard.</p>
        <a href="/dashboard" className="tombol-utama px-6 py-3 rounded-kontrol font-bold transition-all inline-block">
          Kembali ke Dashboard
        </a>
      </div>
    </div>
  </ModalPortal>
  );

  return (
    <Suspense>
      <FormRequireProject currentUser={currentUser} />
    </Suspense>
  );
}
