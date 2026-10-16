'use client';

/** BlokFormBaru - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { NewFormModal, InitialFormType } from '../Modals';
import { User, RoomDetail, BrandPicMapping } from '../shared';

export interface BlokFormBaruProps {
  boqFormFile: File | null;
  boqRoomMap: Record<string, File | null>;
  brandPicMappings: BrandPicMapping[];
  currentUser: User;
  dueDateForm: string;
  form: InitialFormType;
  handleSubmitForm: () => Promise<void>;
  initialForm: InitialFormType;
  myIsInternalSales: boolean;
  role: string;
  roomPhotoMap: Record<string, File[]>;
  rooms: RoomDetail[];
  salesGuestUsers: { id: string; full_name: string; username: string; sales_division?: string; is_internal_sales?: boolean; }[];
  setBoqFormFile: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setBoqRoomMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File | null>>>;
  setDueDateForm: import("react").Dispatch<import("react").SetStateAction<string>>;
  setForm: import("react").Dispatch<import("react").SetStateAction<InitialFormType>>;
  setRoomPhotoMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File[]>>>;
  setRooms: import("react").Dispatch<import("react").SetStateAction<RoomDetail[]>>;
  setShowNewFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSurveyPhotos: import("react").Dispatch<import("react").SetStateAction<File[]>>;
  setSurveyPhotosPreviews: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  showNewFormModal: boolean;
  submitting: boolean;
  surveyPhotos: File[];
  surveyPhotosPreviews: string[];
}

export function BlokFormBaru({ boqFormFile, boqRoomMap, brandPicMappings, currentUser, dueDateForm, form, handleSubmitForm, initialForm, myIsInternalSales, role, roomPhotoMap, rooms, salesGuestUsers, setBoqFormFile, setBoqRoomMap, setDueDateForm, setForm, setRoomPhotoMap, setRooms, setShowNewFormModal, setSurveyPhotos, setSurveyPhotosPreviews, showNewFormModal, submitting, surveyPhotos, surveyPhotosPreviews }: BlokFormBaruProps) {
  return (
    <>
      {showNewFormModal && (
        <NewFormModal
          currentUser={currentUser}
          form={form}
          setForm={setForm}
          initialForm={initialForm}
          salesGuestUsers={salesGuestUsers}
          isInternalSalesGuest={role === 'guest' && myIsInternalSales}
          rooms={rooms} setRooms={setRooms}
          brandPicMappings={brandPicMappings}
          roomPhotoMap={roomPhotoMap} setRoomPhotoMap={setRoomPhotoMap}
          boqRoomMap={boqRoomMap} setBoqRoomMap={setBoqRoomMap}
          dueDateForm={dueDateForm}
          setDueDateForm={setDueDateForm}
          surveyPhotos={surveyPhotos}
          setSurveyPhotos={setSurveyPhotos}
          surveyPhotosPreviews={surveyPhotosPreviews}
          setSurveyPhotosPreviews={setSurveyPhotosPreviews}
          boqFormFile={boqFormFile}
          setBoqFormFile={setBoqFormFile}
          submitting={submitting}
          onClose={() => { setShowNewFormModal(false); setForm(initialForm); setDueDateForm(''); setSurveyPhotos([]); setSurveyPhotosPreviews([]); setBoqFormFile(null); setRooms([]); setRoomPhotoMap({}); setBoqRoomMap({}); }}
          onSubmit={handleSubmitForm}
        />
      )}
    </>
  );
}
