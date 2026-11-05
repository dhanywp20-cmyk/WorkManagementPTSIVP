'use client';

import { NewFormModal } from '../Modals';
import { useKonteksFormBaru } from './konteks-form-baru';

export function BlokFormBaru() {
  const k = useKonteksFormBaru();
  const {
    boqFormFile, boqRoomMap, brandPicMappings, currentUser, dueDateForm, form, initialForm, myIsInternalSales, role, roomPhotoMap, rooms, salesGuestUsers,
    showNewFormModal, submitting, surveyPhotos, surveyPhotosPreviews
  } = k.nilai;
  const { setBoqFormFile, setBoqRoomMap, setDueDateForm, setForm, setRoomPhotoMap, setRooms, setShowNewFormModal, setSurveyPhotos, setSurveyPhotosPreviews } = k.ubah;
  const { handleSubmitForm } = k.aksi;
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
