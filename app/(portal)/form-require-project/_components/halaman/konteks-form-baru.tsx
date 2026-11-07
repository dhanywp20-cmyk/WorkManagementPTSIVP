'use client';

import { createContext, useContext } from 'react';
import { InitialFormType } from '../Modals';
import { User, RoomDetail, BrandPicMapping } from '../shared';

export interface NilaiKonteksFormBaru {
  nilai: {
    boqFormFile: File | null;
    boqRoomMap: Record<string, File | null>;
    brandPicMappings: BrandPicMapping[];
    currentUser: User;
    dueDateForm: string;
    form: InitialFormType;
    initialForm: InitialFormType;
    myIsInternalSales: boolean;
    role: string;
    roomPhotoMap: Record<string, File[]>;
    rooms: RoomDetail[];
    salesGuestUsers: { id: string; full_name: string; username: string; sales_division?: string; is_internal_sales?: boolean; }[];
    showNewFormModal: boolean;
    submitting: boolean;
    surveyPhotos: File[];
    surveyPhotosPreviews: string[];
  };
  ubah: {
    setBoqFormFile: import("react").Dispatch<import("react").SetStateAction<File | null>>;
    setBoqRoomMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File | null>>>;
    setDueDateForm: import("react").Dispatch<import("react").SetStateAction<string>>;
    setForm: import("react").Dispatch<import("react").SetStateAction<InitialFormType>>;
    setRoomPhotoMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File[]>>>;
    setRooms: import("react").Dispatch<import("react").SetStateAction<RoomDetail[]>>;
    setShowNewFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setSurveyPhotos: import("react").Dispatch<import("react").SetStateAction<File[]>>;
    setSurveyPhotosPreviews: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  };
  aksi: {
    handleSubmitForm: () => Promise<void>;
  };
}

export const KonteksFormBaru = createContext<NilaiKonteksFormBaru | null>(null);

export function useKonteksFormBaru(): NilaiKonteksFormBaru {
  const k = useContext(KonteksFormBaru);
  if (!k) throw new Error('useKonteksFormBaru harus di dalam <KonteksFormBaru.Provider>');
  return k;
}
