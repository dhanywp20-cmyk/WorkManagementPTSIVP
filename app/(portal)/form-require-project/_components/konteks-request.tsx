'use client';

import { createContext, useContext } from 'react';
import type { User, ProjectRequest, ProjectMessage, ProjectAttachment } from './shared';
import type { TautanDesain3D, IzinRuang } from './desain-3d-request';
import type { DataSld, TautanSld } from './sld-request';

export interface NilaiKonteksRequest {
  sesi: {
    currentUser: User;
    isIVPGuest: boolean;
    isNonIVPGuest: boolean;
    isPTS: boolean;
    isTeamPTS: boolean;
    pimpinan: boolean;
  };
  izin: {
    bisaKelolaRequest: boolean;
    bolehEditRequest: (req: ProjectRequest) => boolean;
    bolehRerouteRequest: (r: ProjectRequest) => boolean;
    canInternalApproveProject: (req: ProjectRequest) => boolean;
  };
  bantu: {
    displayFileName: (fileName: string) => string;
    formatDate: (dt: string) => string;
    formatDueDate: (dt: string) => string;
    formatFileSize: (bytes: number) => string;
    getCCLabel: (req: ProjectRequest) => string;
    getFileRoomIdx: (fileName: string) => number;
    notify: (type: "success" | "error" | "info", msg: string) => void;
    getDueStatus: (due: string | undefined, status: string) => { type: string; label: string; days: number; } | null;
  };
  daftar: {
    fetchRequests: () => Promise<void>;
    filteredRequests: ProjectRequest[];
    hal: import("@/components/shared/Paginasi").HasilPaginasi<ProjectRequest>;
    handleOpenDetail: (req: ProjectRequest) => Promise<void>;
    loading: boolean;
    ptsMembersList: string[];
    renderRequestActions: (req: ProjectRequest) => import("react").JSX.Element;
    requests: ProjectRequest[];
    setShowNewFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    stats: { total: number; pending: number; approved: number; in_progress: number; completed: number; rejected: number; };
    unreadMsgMap: Record<string, number>;
  };
  ringkasan: {
    assignedPieData: { label: string; value: number; color: string; }[];
    divisionPieData: { label: string; value: number; color: string; }[];
    kebutuhanPieData: { label: string; value: number; color: string; }[];
    productPieData: { label: string; value: number; color: string; }[];
    statusPieData: { label: string; value: number; color: string; }[];
  };
  filter: {
    availableYears: string[];
    filterDivision: string;
    filterHandler: string;
    filterKebutuhan: string;
    filterMonth: string;
    filterStatus: string;
    filterYear: string;
    searchQuery: string;
    searchSales: string;
    setFilterDivision: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterHandler: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterKebutuhan: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterMonth: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchSales: import("react").Dispatch<import("react").SetStateAction<string>>;
  };
  pilih: {
    bulkDeleting: boolean;
    selectMode: boolean;
    selectedIds: Set<string>;
    setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
    toggleSelectAll: () => void;
    toggleSelectId: (id: string) => void;
  };
  detail: {
    detailDueStatus: { type: string; label: string; days: number; } | null;
    detailIsPending: boolean;
    detailMobileTab: "info" | "chat";
    detailRoomAssignName: string | undefined;
    detailRoomIdx: number;
    detailRoomStatus: "pending" | "approved" | "in_progress" | "completed" | "rejected" | undefined;
    detailSc: { label: string; color: string; bg: string; border: string; } | null;
    handleCloseDetail: () => void;
    selectedRequest: ProjectRequest | null;
    setDetailMobileTab: import("react").Dispatch<import("react").SetStateAction<"info" | "chat">>;
    setDetailRoomIdx: import("react").Dispatch<import("react").SetStateAction<number>>;
    setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
    showDetailModal: boolean;
  };
  lampiran: {
    activeAttachTab: "all" | "sld" | "boq" | "design3d";
    attachments: ProjectAttachment[];
    boqFileRef: import("react").RefObject<HTMLInputElement | null>;
    desain3d: { tautan: TautanDesain3D[]; izin: IzinRuang[]; galat?: string; } | null;
    desain3dTools: TautanDesain3D[];
    design3dFileRef: import("react").RefObject<HTMLInputElement | null>;
    downloadingPackage: boolean;
    fileInputRef: import("react").RefObject<HTMLInputElement | null>;
    handleCategoryUpload: (file: File, category: "sld" | "boq" | "design3d") => Promise<void>;
    handleDeleteAttachment: (att: ProjectAttachment) => void;
    handleFileUpload: (file: File) => Promise<void>;
    mintaPilih3D: number;
    muatDesain3D: (id: string) => Promise<void>;
    setActiveAttachTab: import("react").Dispatch<import("react").SetStateAction<"all" | "sld" | "boq" | "design3d">>;
    setDownloadingPackage: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setMintaPilih3D: import("react").Dispatch<import("react").SetStateAction<number>>;
    setShowUploadChoice: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    showUploadChoice: boolean;
    sldFileRef: import("react").RefObject<HTMLInputElement | null>;
    sld: DataSld | null;
    sldTools: TautanSld[];
    mintaPilihSld: number;
    setMintaPilihSld: import("react").Dispatch<import("react").SetStateAction<number>>;
    muatSld: (id: string) => Promise<void>;
    uploadingCategory: "sld" | "boq" | "design3d" | null;
    uploadingFile: boolean;
  };
  pesan: {
    chatFileRef: import("react").RefObject<HTMLInputElement | null>;
    chatRoomFilter: string;
    handleSendMessage: () => Promise<void>;
    messages: ProjectMessage[];
    messagesEndRef: import("react").RefObject<HTMLDivElement | null>;
    msgText: string;
    sendingMsg: boolean;
    setChatRoomFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
    setMsgText: import("react").Dispatch<import("react").SetStateAction<string>>;
  };
  aksi: {
    handleOpenEditForm: () => void;
    handleReject: (req: ProjectRequest) => void;
    handleResubmit: (req: ProjectRequest) => Promise<void>;
    handleStatusUpdate: (req: ProjectRequest, newStatus: string, roomIdx?: number) => Promise<void>;
    setAssignModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
    setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
    setDeleteModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
    setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
    setRerouteTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
    setRerouteTo: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSelectedNewStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
    setStatusUpdateModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  };
}

export const KonteksRequest = createContext<NilaiKonteksRequest | null>(null);

export function useKonteksRequest(): NilaiKonteksRequest {
  const k = useContext(KonteksRequest);
  if (!k) throw new Error('useKonteksRequest harus di dalam <KonteksRequest.Provider>');
  return k;
}
