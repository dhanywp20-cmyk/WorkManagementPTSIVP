'use client';

/** PopupDetailJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ReminderDetailPopup } from './ReminderDetailPopup';
import { Status, Reminder, TeamUser, GuestUser } from './shared';

export interface PopupDetailJadwalProps {
  bastDate: string;
  bolehEditReminder: (r: Reminder) => boolean;
  bukaEditDetailPelaksanaan: (r: Reminder) => void;
  canApproveAssign: boolean;
  canInternalApprove: (r: Reminder) => boolean;
  controllerBrand: "cue" | "extron" | "wyrestorm" | null;
  currentUser: TeamUser | null;
  detailReminder: Reminder | null;
  displayType: "led" | "lcd" | "mix" | null;
  guestUsers: GuestUser[];
  handleAdminReject: (r: Reminder) => void;
  handleConfirmStatusUpdate: () => Promise<void>;
  handleInternalReject: (r: Reminder) => void;
  handleModeConfirm: () => Promise<void>;
  handleResendFormReview: (r: Reminder) => Promise<void>;
  handleSendWA: (r: Reminder) => Promise<void>;
  installerDaerah: string;
  installerName: string;
  installerUserId: string | null;
  isAdmin: boolean;
  isManager: boolean;
  isMyReviewStage: (r: Reminder) => boolean;
  modeEditSaja: boolean;
  modePenyelesaian: "onsite" | "remote" | null;
  openEdit: (r: Reminder) => void;
  openSupervisorAssign: (r: Reminder, group: Reminder[]) => void;
  pendingStatus: Status | null;
  ptsCabangUsers: { id: string; full_name: string; pts_daerah: string | null; }[];
  reminders: Reminder[];
  requiresControllerAuto: boolean;
  requiresMiddleware: boolean;
  resendingFormReview: boolean;
  savingMode: boolean;
  sendingWA: string | null;
  setApproveAssignTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveBatchSiblings: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
  setApproveDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setApproveTime: import("react").Dispatch<import("react").SetStateAction<string>>;
  setBastDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setControllerBrand: import("react").Dispatch<import("react").SetStateAction<"cue" | "extron" | "wyrestorm" | null>>;
  setDetailReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setDisplayType: import("react").Dispatch<import("react").SetStateAction<"led" | "lcd" | "mix" | null>>;
  setInstallerDaerah: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInstallerName: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInstallerUserId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setModeEditSaja: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setModePenyelesaian: import("react").Dispatch<import("react").SetStateAction<"onsite" | "remote" | null>>;
  setPendingPhotoUrl: import("react").Dispatch<import("react").SetStateAction<string | undefined>>;
  setPendingStatus: import("react").Dispatch<import("react").SetStateAction<Status | null>>;
  setRequiresControllerAuto: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setRequiresMiddleware: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setRescheduleTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setShowModeModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowRiwayat: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setStatusPhoto: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setStatusPhotoPreview: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  showModeModal: boolean;
  showRiwayat: boolean;
  statusPhoto: File | null;
  statusPhotoPreview: string | null;
  statusPhotoRef: import("react").RefObject<HTMLInputElement | null>;
  updatingStatus: boolean;
}

export function PopupDetailJadwal({ bastDate, bolehEditReminder, bukaEditDetailPelaksanaan, canApproveAssign, canInternalApprove, controllerBrand, currentUser, detailReminder, displayType, guestUsers, handleAdminReject, handleConfirmStatusUpdate, handleInternalReject, handleModeConfirm, handleResendFormReview, handleSendWA, installerDaerah, installerName, installerUserId, isAdmin, isManager, isMyReviewStage, modeEditSaja, modePenyelesaian, openEdit, openSupervisorAssign, pendingStatus, ptsCabangUsers, reminders, requiresControllerAuto, requiresMiddleware, resendingFormReview, savingMode, sendingWA, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveTarget, setApproveTime, setBastDate, setControllerBrand, setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setInternalApproveTarget, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware, setRescheduleTarget, setShowModeModal, setShowRiwayat, setStatusPhoto, setStatusPhotoPreview, showModeModal, showRiwayat, statusPhoto, statusPhotoPreview, statusPhotoRef, updatingStatus }: PopupDetailJadwalProps) {
  return (
    <>
      {detailReminder && (
        <ReminderDetailPopup
          detailReminder={detailReminder} setDetailReminder={setDetailReminder}
          showModeModal={showModeModal}
          setShowModeModal={(v: boolean) => { setShowModeModal(v); if (!v) setModeEditSaja(false); }}
          modeEditSaja={modeEditSaja} bukaEditDetailPelaksanaan={bukaEditDetailPelaksanaan}
          pendingStatus={pendingStatus}
          setPendingStatus={(v: Status | null) => { setPendingStatus(v); if (v) setModeEditSaja(false); }}
          statusPhoto={statusPhoto} setStatusPhoto={setStatusPhoto}
          statusPhotoPreview={statusPhotoPreview} setStatusPhotoPreview={setStatusPhotoPreview}
          showRiwayat={showRiwayat} setShowRiwayat={setShowRiwayat}
          isAdmin={isAdmin} isManager={isManager} currentUser={currentUser}
          isMyReviewStage={isMyReviewStage}
          canInternalApprove={canInternalApprove} setInternalApproveTarget={setInternalApproveTarget} handleInternalReject={handleInternalReject}
          canApproveAssign={canApproveAssign} setApproveTarget={setApproveTarget} setApproveBatchSiblings={setApproveBatchSiblings} reminders={reminders}
          setApproveAssignTo={setApproveAssignTo} setApproveDate={setApproveDate} setApproveTime={setApproveTime}
          handleAdminReject={handleAdminReject}
          openSupervisorAssign={openSupervisorAssign}
          bolehEditReminder={bolehEditReminder} setRescheduleTarget={setRescheduleTarget}
          resendingFormReview={resendingFormReview} handleResendFormReview={handleResendFormReview}
          sendingWA={sendingWA} handleSendWA={handleSendWA}
          openEdit={openEdit}
          statusPhotoRef={statusPhotoRef}
          handleConfirmStatusUpdate={handleConfirmStatusUpdate} updatingStatus={updatingStatus}
          guestUsers={guestUsers}
          modePenyelesaian={modePenyelesaian} setModePenyelesaian={setModePenyelesaian}
          installerName={installerName} setInstallerName={setInstallerName}
          installerUserId={installerUserId} setInstallerUserId={setInstallerUserId}
          daftarCabang={ptsCabangUsers}
          installerDaerah={installerDaerah} setInstallerDaerah={setInstallerDaerah}
          bastDate={bastDate} setBastDate={setBastDate}
          displayType={displayType} setDisplayType={setDisplayType}
          requiresMiddleware={requiresMiddleware} setRequiresMiddleware={setRequiresMiddleware}
          requiresControllerAuto={requiresControllerAuto} setRequiresControllerAuto={setRequiresControllerAuto}
          controllerBrand={controllerBrand} setControllerBrand={setControllerBrand}
          setPendingPhotoUrl={setPendingPhotoUrl}
          savingMode={savingMode} handleModeConfirm={handleModeConfirm}
        />
      )}
    </>
  );
}
