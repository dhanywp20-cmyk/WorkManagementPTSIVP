'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isPimpinan, muatIdPimpinan } from '@/lib/pimpinan';
import { ViewIconBtn, DeleteIconBtn, type ConfirmState } from '@/components/shared';
import { hasFullAccess } from '@/lib/constants';
import { User, ProjectRequest, RoomDetail, BrandPicMapping, ProjectMessage, ProjectAttachment, getRoomAssignName, type KategoriLampiran } from './shared';
import { InitialFormType } from './Modals';
import { muatTautanDesain3D, type TautanDesain3D, type IzinRuang } from './desain-3d-request';
import { muatTautanSld, type DataSld } from './sld-request';
import { muatTautanScreen, type DataScreen } from './screen-connection-request';
import { Toast as ToastBersama } from '@/components/shared/Toast';
import { useKirimRequest } from './useKirimRequest';
import { useAksiPersetujuan } from './useAksiPersetujuan';
import { useUbahStatusRequest } from './useUbahStatusRequest';
import { useEditRequest } from './useEditRequest';
import { usePesanLampiran } from './usePesanLampiran';
import { useMuatRequest } from './useMuatRequest';
import { useStatistikRequest } from './halaman/useStatistikRequest';
import { useEfekHalamanRequest } from './halaman/useEfekHalamanRequest';
import { useFilterRequest } from './useFilterRequest';
import { buatFormAwal } from './buatFormAwal';

export interface HalamanRequestKonteks {
  currentUser: User;
}

export function useHalamanRequest(k: HalamanRequestKonteks) {
  const { currentUser } = k;
  const searchParams = useSearchParams();
  const [appReady, setAppReady] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const statusUpdatingRef = useRef<Set<string>>(new Set());
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ProjectRequest | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [, setUnreadCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterStatus') || 'all'; } catch { return 'all'; }
  });
  const [filterYear, setFilterYear] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterYear') || 'all'; } catch { return 'all'; }
  });
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterMonth') || 'all'; } catch { return 'all'; }
  });
  const [filterHandler, setFilterHandler] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterHandler') || 'all'; } catch { return 'all'; }
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return sessionStorage.getItem('frp_searchQuery') || ''; } catch { return ''; }
  });

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('buat') === '1') setShowNewFormModal(true);
  }, [searchParams]);

  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current) return;
    const openId = searchParams.get('open');
    if (!openId || requests.length === 0) return;
    const target = requests.find(r => r.id === openId);
    if (target) {
      sudahBukaDariNotif.current = true;
      handleOpenDetail(target);
    }
  }, [searchParams, requests]);
  const {
    setLastSeenMap, setPtsMembersList, setUnreadMsgMap, filterDivision, filterKebutuhan, searchSales, rerouteTarget, rerouteTo,
    rosterPTS, setRerouteSaving, setRerouteTarget, setRerouteTo, ptsMembersList, unreadMsgMap, setFilterDivision, setFilterKebutuhan,
    setSearchSales, rerouteSaving,
  } = useFilterRequest({ filterStatus, filterYear, filterMonth, filterHandler, searchQuery });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const sldFileRef = useRef<HTMLInputElement>(null);
  const boqFileRef = useRef<HTMLInputElement>(null);
  const design3dFileRef = useRef<HTMLInputElement>(null);
  const screenFileRef = useRef<HTMLInputElement>(null);
  const [showUploadChoice, setShowUploadChoice] = useState(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<KategoriLampiran | null>(null);
  const [activeAttachTab, setActiveAttachTab] = useState<'all' | KategoriLampiran>('all');
  const [desain3d, setDesain3d] = useState<{ tautan: TautanDesain3D[]; izin: IzinRuang[]; galat?: string } | null>(null);
  const desain3dTools = desain3d?.tautan ?? [];
  const [mintaPilih3D, setMintaPilih3D] = useState(0);
  const idRequestTerpilih = selectedRequest?.id;
  const muatDesain3D = useCallback(async (id: string) => {
    const h = await muatTautanDesain3D(id);
    setDesain3d(prev => ('galat' in h ? { tautan: prev?.tautan ?? [], izin: prev?.izin ?? [], galat: h.galat } : h));
  }, []);
  const [sld, setSld] = useState<DataSld | null>(null);
  const sldTools = sld?.tautan ?? [];
  const [mintaPilihSld, setMintaPilihSld] = useState(0);
  const muatSld = useCallback(async (id: string) => {
    const h = await muatTautanSld(id);
    setSld(prev => ('tautan' in h ? h : { tautan: prev?.tautan ?? [], izin: prev?.izin ?? [], galat: h.galat }));
  }, []);
  const [screen, setScreen] = useState<DataScreen | null>(null);
  const screenTools = screen?.tautan ?? [];
  const [mintaPilihScreen, setMintaPilihScreen] = useState(0);
  const muatScreen = useCallback(async (id: string) => {
    const h = await muatTautanScreen(id);
    setScreen(prev => ('tautan' in h ? h : { tautan: prev?.tautan ?? [], izin: prev?.izin ?? [], galat: h.galat }));
  }, []);
  useEffect(() => {
    setDesain3d(null); setSld(null); setScreen(null);
    if (idRequestTerpilih) { void muatDesain3D(idRequestTerpilih); void muatSld(idRequestTerpilih); void muatScreen(idRequestTerpilih); }
  }, [idRequestTerpilih, muatDesain3D, muatSld, muatScreen]);
  const [detailRoomIdx, setDetailRoomIdx] = useState(0);
  const [detailMobileTab, setDetailMobileTab] = useState<'info' | 'chat'>('info');
  const [chatRoomFilter, setChatRoomFilter] = useState<string>('all');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; req: ProjectRequest | null }>({ open: false, req: null });
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; req: ProjectRequest | null }>({ open: false, req: null });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editFormModal, setEditFormModal] = useState(false);
  const [statusUpdateModal, setStatusUpdateModal] = useState<{ open: boolean; req: ProjectRequest | null; roomIdx: number }>({ open: false, req: null, roomIdx: 0 });
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [downloadingPackage, setDownloadingPackage] = useState(false);
  const [assignModal, setAssignModal] = useState<{ open: boolean; req: ProjectRequest | null; roomIdx: number }>({ open: false, req: null, roomIdx: 0 });
  const [internalApproveTarget, setInternalApproveTarget] = useState<ProjectRequest | null>(null);
  const [internalApproveSaving, setInternalApproveSaving] = useState(false);
  const [ticketPopupShown, setTicketPopupShown] = useState(false);
  const [showTicketPopup, setShowTicketPopup] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editFormData, setEditFormData] = useState({
    project_name: '', room_name: '', project_location: '', sales_name: '', sales_division: '',
    sales_user_id: null as string | null,
    kebutuhan: [] as string[], kebutuhan_other: '',
    solution_product: [] as string[], solution_other: '',
    layout_signage: [] as string[], jaringan_cms: [] as string[],
    jumlah_input: '', jumlah_output: '',
    source: [] as string[], source_other: '',
    camera_conference: 'No', camera_jumlah: '', camera_tracking: [] as string[],
    audio_system: 'No', audio_mixer: '', audio_detail: [] as string[],
    wallplate_input: 'No', wallplate_jumlah: '',
    tabletop_input: 'No', tabletop_jumlah: '',
    wireless_presentation: 'No', wireless_mode: [] as string[], wireless_dongle: 'No',
    controller_automation: 'No', controller_type: [] as string[],
    ukuran_ruangan: '', suggest_tampilan: '', keterangan_lain: '',
  });
  const [editRooms, setEditRooms] = useState<RoomDetail[]>([]);
  const [editRoomIdx, setEditRoomIdx] = useState(0);
  const [editNewRoomIds, setEditNewRoomIds] = useState<string[]>([]);

  const role = currentUser.role?.toLowerCase().trim() ?? '';
  const isPTS = ['admin', 'superadmin', 'team_pts', 'team'].includes(role);
  const pimpinan = isPimpinan(currentUser);
  const isTeamPTS = role === 'team_pts' || role === 'team';
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin';
  const bisaKelolaRequest = isAdmin || isSuperAdmin || hasFullAccess(currentUser as never);

  const bolehEditRequest = (req: ProjectRequest): boolean =>
    !pimpinan && (bisaKelolaRequest
    || req.requester_id === currentUser.id
    || (!!currentUser.full_name && req.sales_name === currentUser.full_name)
    || (!!currentUser.full_name && req.assign_name === currentUser.full_name)
    || (!!currentUser.full_name && req.ivp_assignee === currentUser.full_name));

  const bolehRerouteRequest = (r: ProjectRequest) =>
    !['in_progress', 'completed', 'rejected'].includes(r.status ?? '');
  const isIVPGuest = role === 'guest' && !pimpinan && (currentUser.sales_division === 'IVP' || currentUser.sales_division === 'MVI');
  const isNonIVPGuest = role === 'guest' && !pimpinan && currentUser.sales_division !== 'IVP';
  const canSetInProgress = (req: ProjectRequest, roomIdx: number) =>
    isPTS && (bisaKelolaRequest || getRoomAssignName(req, roomIdx) === currentUser.full_name);
  const canInternalApproveProject = (req: ProjectRequest) => {
    if (req.routing_status !== 'internal_review') return false;
    if (currentUser.id === req.internal_sales_id && !req.internal_approved_at) return true;
    if (currentUser.id === req.internal_sales_id_2 && !req.internal_approved_at_2) return true;
    return false;
  };

  const { initialForm } = buatFormAwal({ isPTS, currentUser });

  const [salesGuestUsers, setSalesGuestUsers] = useState<{id:string;full_name:string;username:string;sales_division?:string;is_internal_sales?:boolean}[]>([]);
  const [myIsInternalSales, setMyIsInternalSales] = useState(false);
  const [internalSalesNames, setInternalSalesNames] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from('users').select('id, full_name, username, sales_division, is_internal_sales').eq('role', 'guest').then(({ data }) => {
      if (data) muatIdPimpinan(supabase).then(idPim => setSalesGuestUsers(data.filter(u => !idPim.has(u.id)).map(u => ({ ...u, sales_division: u.sales_division ?? undefined }))));
    });
    supabase.from('users').select('is_internal_sales').eq('id', currentUser.id).maybeSingle().then(({ data }: { data: { is_internal_sales: boolean | null } | null }) => {
      const internal = !!data?.is_internal_sales;
      setMyIsInternalSales(internal);
      if (internal && (currentUser.role?.toLowerCase().trim() === 'guest')) {
        setForm(prev => ({ ...prev, sales_name: '', sales_division: '' }));
      }
    });
    supabase.from('brand_pic_mappings').select('id,brand_type,brand_name,pic_user_id,pic_user_name').order('brand_name').then(({ data }) => {
      if (data) setBrandPicMappings(data as BrandPicMapping[]);
    });
  }, []);

  const [form, setForm] = useState<InitialFormType>(initialForm);
  const [dueDateForm, setDueDateForm] = useState('');
  const [surveyPhotos, setSurveyPhotos] = useState<File[]>([]);
  const [surveyPhotosPreviews, setSurveyPhotosPreviews] = useState<string[]>([]);
  const [boqFormFile, setBoqFormFile] = useState<File | null>(null);
  const [rooms, setRooms] = useState<RoomDetail[]>([]);
  const [roomPhotoMap, setRoomPhotoMap] = useState<Record<string, File[]>>({});
  const [boqRoomMap, setBoqRoomMap] = useState<Record<string, File | null>>({});
  const [brandPicMappings, setBrandPicMappings] = useState<BrandPicMapping[]>([]);

  const notify = useCallback((type: 'success' | 'error' | 'info', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const { fetchRequests, fetchMessages, fetchAttachments } = useMuatRequest({ currentUser, isIVPGuest, isPTS, isTeamPTS, notify, pimpinan, setAppReady, setAttachments, setLastSeenMap, setLoading, setMessages, setPtsMembersList, setRequests, setUnreadMsgMap });

  useEfekHalamanRequest({ activeRequestIdRef, appReady, currentUser, fetchAttachments, fetchRequests, isIVPGuest, isPTS, messages, messagesEndRef, requests, selectedRequest, setMessages, setShowTicketPopup, setTicketPopupShown, setUnreadCount, setUnreadMsgMap, ticketPopupShown });

  const formatFileSize = (bytes: number) =>
    bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
  const formatDate = (dt: string) => new Date(dt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatDueDate = (dt: string) => new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  const getFileRoomIdx = (fileName: string): number => {
    const m = fileName.match(/^\[room(\d+)\]\s*/i);
    return m ? Math.max(0, parseInt(m[1], 10) - 1) : 0;
  };
  const displayFileName = (fileName: string) => fileName.replace(/^\[room\d+\]\s*/i, '');

  const toStorageSafeName = (name: string): string =>
    name
      .replace(/^\[room(\d+)\]\s*/i, 'room$1_')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

  const renderRequestActions = (req: ProjectRequest) => (
    <>
      {canInternalApproveProject(req) && (
        <>
          <button aria-label="Setujui & Teruskan ke Admin" onClick={() => setInternalApproveTarget(req)} title="Setujui & Teruskan ke Admin"
            className="w-8 h-8 shrink-0 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-200 rounded-lg flex items-center justify-center transition-all">
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </button>
          <button aria-label="Tolak" onClick={() => handleReject(req)} title="Tolak"
            className="w-8 h-8 shrink-0 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </>
      )}
      {bisaKelolaRequest && req.status === 'pending' && (
        <>
          <button aria-label="Setujui" onClick={() => handleApprove(req)} title="Setujui"
            className="w-8 h-8 shrink-0 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white border border-emerald-200 rounded-lg flex items-center justify-center transition-all">
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </button>
          <button aria-label="Tolak" onClick={() => handleReject(req)} title="Tolak"
            className="w-8 h-8 shrink-0 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </>
      )}
      {isTeamPTS && req.status === 'approved' && req.assign_name === currentUser.full_name && (
        <button aria-label="Mulai In Progress" onClick={() => handleStatusUpdate(req, 'in_progress')} title="Mulai In Progress"
          className="w-8 h-8 shrink-0 bg-blue-50 hover:bg-blue-500 text-blue-600 hover:text-white border border-blue-200 rounded-lg flex items-center justify-center transition-all">
          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </button>
      )}
      <ViewIconBtn onClick={() => handleOpenDetail(req)} label="Detail" />
      {bisaKelolaRequest && (
        <DeleteIconBtn onClick={() => { setDeleteModal({ open: true, req }); setDeleteConfirmText(''); }} label="Hapus" />
      )}
    </>
  );
  const getDueStatus = (due: string | undefined, status: string) => {
    if (!due || status === 'completed' || status === 'rejected') return null;
    const now = new Date();
    const dueDate = new Date(due);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffMs < 0) return { type: 'overdue', label: `Telat ${Math.abs(diffDays)} hari`, days: diffDays };
    if (diffDays <= 2) return { type: 'urgent', label: `${diffDays} hari lagi`, days: diffDays };
    return { type: 'ok', label: `${diffDays} hari lagi`, days: diffDays };
  };

  const {
    availableYears, filteredRequests, hal, stats, statusPieData, divisionPieData, assignedPieData,
    productPieData, kebutuhanPieData,
  } = useStatistikRequest({
    filterDivision, filterHandler, filterKebutuhan, filterMonth, filterStatus, filterYear, requests, searchQuery, searchSales,
  });

  const NotifToast = () => <ToastBersama notif={notification} />;

  const {
    handleSubmitForm,
  } = useKirimRequest({
    boqFormFile, boqRoomMap, currentUser, dueDateForm, fetchRequests, form, initialForm, isPTS, myIsInternalSales, notify,
    roomPhotoMap, rooms, salesGuestUsers, setBoqFormFile, setBoqRoomMap, setDueDateForm, setForm, setRoomPhotoMap, setRooms,
    setShowNewFormModal, setSubmitting, setSurveyPhotos, setSurveyPhotosPreviews, surveyPhotos, toStorageSafeName,
  });

  const {
    toggleSelectId, toggleSelectAll, handleApprove, handleInternalApproveProject, handleReject, handleResubmit, handleRejectConfirm, handleDeleteConfirm, handleDeleteAttachment,
  } = useAksiPersetujuan({
    currentUser, deleteModal, displayFileName, fetchMessages, fetchRequests, filteredRequests, notify, rejectModal, rejectNote,
    rejectSaving, selectedIds, selectedRequest, setAssignModal, setAttachments, setBulkDeleting, setConfirmState,
    setDeleteConfirmText, setDeleteModal, setDeleting, setInternalApproveSaving, setInternalApproveTarget, setRejectModal,
    setRejectNote, setRejectSaving, setRequests, setSelectedIds, setSelectedRequest, setShowDetailModal,
  });

  const { handleStatusUpdate } = useUbahStatusRequest({ currentUser, fetchMessages, fetchRequests, notify, selectedRequest, setSelectedRequest, statusUpdatingRef });

  const {
    handleOpenEditForm, editCur, editUpd, editRoomAktifBaru, handleEditAddRoom, handleEditRemoveNewRoom, simpanReroute, handleEditFormSubmit,
  } = useEditRequest({
    currentUser, detailRoomIdx, editDueDate, editFormData, editNewRoomIds, editRoomIdx, editRooms, fetchMessages, fetchRequests,
    notify, rerouteTarget, rerouteTo, rosterPTS, selectedRequest, setDetailRoomIdx, setEditDueDate, setEditFormData,
    setEditFormModal, setEditNewRoomIds, setEditRoomIdx, setEditRooms, setRerouteSaving, setRerouteTarget, setRerouteTo,
    setSelectedRequest,
  });

  const {
    handleSendMessage, handleFileUpload, handleCategoryUpload, handleOpenDetail, getCCLabel, handleCloseDetail,
  } = usePesanLampiran({
    activeRequestIdRef, attachments, chatRoomFilter, currentUser, detailRoomIdx, fetchAttachments, fetchMessages, getFileRoomIdx,
    internalSalesNames, isIVPGuest, isPTS, msgText, notify, selectedRequest, setAttachments, setChatRoomFilter, setDetailMobileTab,
    setDetailRoomIdx, setInternalSalesNames, setMessages, setMsgText, setSelectedRequest, setSendingMsg, setShowDetailModal,
    setUnreadMsgMap, setUploadingCategory, setUploadingFile, toStorageSafeName,
  });
  return {
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
  };
}
