'use client';

import { useState, useEffect, useRef, useCallback, Suspense, type CSSProperties } from 'react';
import { Z } from '@/lib/z-index';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isPimpinan, muatIdPimpinan } from '@/lib/pimpinan';
import { setSession, clearSession, getSession } from '@/lib/auth';
import { notifyProjectStatusChange, createNotification } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { compressImage } from '@/lib/image-compress';
import { MiniPieChart, LoadingScreen, ViewIconBtn, DeleteIconBtn, ActionGroup, PageHeader, ConfirmDialog, SalesPicker, MobileListCard, MobileCardBadge, type ConfirmState, ListEmptyState, AuditTrailPanel, FlowSteps, StatCard, ModalPortal, Paginasi, usePaginasi } from '@/components/shared';
import { hasFullAccess } from '@/lib/constants';
import { bolehDitugaskanOleh } from '@/lib/teams';
import { bandingkan, ringkasPerubahan, pesanWAPerubahan, type AdminField, type Perubahan } from '@/lib/admin-edit';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import {
  User, ProjectRequest, RoomDetail, BrandPicMapping,
  ProjectMessage, ProjectAttachment,
  statusConfig, JABATAN_TIER, JABATAN_CC_RULES,
  fetchWACCTargets, sendWANotif, emptyRoom,
  SALES_DIVISIONS, PIE_COLORS, getRoomStatus, getRoomAssignName, getRoomAssignUserId, hasDivergentRoomStatus,
} from './_components/shared';
import {
  AssignPTSModal, RoomSection, NewFormModal,
  InitialFormType, NewFormModalProps,
} from './_components/Modals';
import { appLink } from '@/lib/app-url';
import { cetakRequest } from './_components/cetak-request';
import { unduhPaketRequest } from './_components/paket-unduhan';
import { Desain3DTools } from './_components/Desain3DTools';
import { muatTautanDesain3D, type TautanDesain3D, type IzinRuang } from './_components/desain-3d-request';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { FilterLipat } from '@/components/shared/FilterLipat';
import { Toast as ToastBersama } from '@/components/shared/Toast';
import { EDIT_ROOM_LABELS, ambilFieldRuangan, namaRuangan, daftarKebutuhan, type EditRoomFields } from './_components/ruangan';
import { CheckGroup, RadioGroup } from './_components/InputPilihan';
import { ModalEditForm } from './_components/ModalEditForm';
import { ModalReroute } from './_components/ModalReroute';
import { ModalDetailRequest } from './_components/ModalDetailRequest';
import { PopupTicketAktif } from './_components/PopupTicketAktif';
import { ModalHapusRequest } from './_components/ModalHapusRequest';
import { ModalUpdateStatus } from './_components/ModalUpdateStatus';
import { ModalApproveInternal } from './_components/ModalApproveInternal';
import { DaftarRequest } from './_components/DaftarRequest';
import { HeaderFormRequire } from './_components/HeaderFormRequire';
import { FilterRequest } from './_components/FilterRequest';
import { useKirimRequest } from './_components/useKirimRequest';
import { useAksiPersetujuan } from './_components/useAksiPersetujuan';
import { useUbahStatusRequest } from './_components/useUbahStatusRequest';
import { useEditRequest } from './_components/useEditRequest';
import { usePesanLampiran } from './_components/usePesanLampiran';
import { useMuatRequest } from './_components/useMuatRequest';
import { ModalTolakRequest } from './_components/halaman/ModalTolakRequest';
import { ModalHapusMassal } from './_components/halaman/ModalHapusMassal';
import { KontenHalamanRequest } from './_components/halaman/KontenHalamanRequest';
import { BlokAssignPTS } from './_components/halaman/BlokAssignPTS';
import { BlokFormBaru } from './_components/halaman/BlokFormBaru';
import { useStatistikRequest } from './_components/halaman/useStatistikRequest';
import { useEfekHalamanRequest } from './_components/halaman/useEfekHalamanRequest';

function FormRequireProject({ currentUser }: { currentUser: User }) {
  const searchParams = useSearchParams();
  const [appReady, setAppReady] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNewFormModal, setShowNewFormModal] = useState(false);
  // M13 (docs/UX-WORKFLOW-AUDIT.md): handleStatusUpdate dipanggil dari banyak
  // tombol berbeda tanpa guard loading sama sekali - klik ganda pada koneksi
  // lambat bisa mengirim WA/Telegram dobel ke pihak eksternal. Ref (bukan
  // state) supaya tidak memicu re-render tiap perubahan, cukup mencegah
  // pemanggilan ganda untuk request yang sama sementara satu masih berjalan.
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
  const [unreadCount, setUnreadCount] = useState(0);
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

  // Auto-apply filter dari Global Search (?q=...)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  // Pintasan "buat" dari dashboard (?buat=1)
  useEffect(() => {
    if (searchParams.get('buat') === '1') setShowNewFormModal(true);
  }, [searchParams]);

  // Deep-link dari notifikasi (?open=<id>): buka detail request-nya langsung,
  // bukan cuma daftar. Ref sekali-jalan - tanpa itu, requests yang di-refetch
  // berkala akan membuka lagi detailnya tiap kali walau user sudah menutupnya.
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
  const [searchSales, setSearchSales] = useState(() => {
    try { return sessionStorage.getItem('frp_searchSales') || ''; } catch { return ''; }
  });
  const [filterDivision, setFilterDivision] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterDivision') || 'all'; } catch { return 'all'; }
  });
  const [filterKebutuhan, setFilterKebutuhan] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterKebutuhan') || 'all'; } catch { return 'all'; }
  });
  const [ptsMembersList, setPtsMembersList] = useState<string[]>([]);
  /**
   * Roster Team PTS sebenarnya, untuk tujuan re-route.
   *
   * TIDAK memakai ptsMembersList di atas: isinya cuma nama-nama yang KEBETULAN
   * sudah pernah di-assign sesuatu - cukup untuk mengisi dropdown filter, tapi
   * kalau dipakai untuk mengalihkan pekerjaan, anggota tim yang belum pernah
   * dapat request sama sekali tidak akan pernah bisa dipilih.
   */
  const [rosterPTS, setRosterPTS] = useState<{ id: string; full_name: string; jabatan: string | null; phone_number: string | null; team_type?: string | null; bisa_ditugaskan?: boolean | null }[]>([]);
  const [rerouteTarget, setRerouteTarget] = useState<ProjectRequest | null>(null);
  const [rerouteTo, setRerouteTo] = useState('');
  const [rerouteSaving, setRerouteSaving] = useState(false);

  useEffect(() => {
    supabase.from('users').select('id, full_name, jabatan, phone_number, team_type, bisa_ditugaskan')
      .in('role', ['team', 'team_pts']).order('full_name')
      .then((res: { data: unknown }) => setRosterPTS((res.data ?? []) as never));
  }, []);
  const [unreadMsgMap, setUnreadMsgMap] = useState<Record<string, number>>({});
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});
  // Persist filters to sessionStorage
  useEffect(() => { try { sessionStorage.setItem('frp_filterStatus', filterStatus); } catch {} }, [filterStatus]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterYear', filterYear); } catch {} }, [filterYear]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterMonth', filterMonth); } catch {} }, [filterMonth]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterHandler', filterHandler); } catch {} }, [filterHandler]);
  useEffect(() => { try { sessionStorage.setItem('frp_searchQuery', searchQuery); } catch {} }, [searchQuery]);
  useEffect(() => { try { sessionStorage.setItem('frp_searchSales', searchSales); } catch {} }, [searchSales]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterDivision', filterDivision); } catch {} }, [filterDivision]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterKebutuhan', filterKebutuhan); } catch {} }, [filterKebutuhan]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const sldFileRef = useRef<HTMLInputElement>(null);
  const boqFileRef = useRef<HTMLInputElement>(null);
  const design3dFileRef = useRef<HTMLInputElement>(null);
  const [showUploadChoice, setShowUploadChoice] = useState(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<'sld' | 'boq' | 'design3d' | null>(null);
  const [activeAttachTab, setActiveAttachTab] = useState<'all' | 'sld' | 'boq' | 'design3d'>('all');
  /**
   * Design 3D dari Tools Team (tambahan di samping file PDF). Dimuat SEKALI per
   * request yang dibuka (ringkasan saja, tanpa gambar) dan dipakai bersama oleh
   * panel, hitungan tab, cetak, dan ZIP - hemat egress.
   */
  const [desain3d, setDesain3d] = useState<{ tautan: TautanDesain3D[]; izin: IzinRuang[]; galat?: string } | null>(null);
  const desain3dTools = desain3d?.tautan ?? [];
  const [mintaPilih3D, setMintaPilih3D] = useState(0);
  const idRequestTerpilih = selectedRequest?.id;
  const muatDesain3D = useCallback(async (id: string) => {
    const h = await muatTautanDesain3D(id);
    setDesain3d(prev => ('galat' in h ? { tautan: prev?.tautan ?? [], izin: prev?.izin ?? [], galat: h.galat } : h));
  }, []);
  useEffect(() => {
    setDesain3d(null);
    if (idRequestTerpilih) void muatDesain3D(idRequestTerpilih);
  }, [idRequestTerpilih, muatDesain3D]);
  // Detail modal: active room tab (0 = Ruangan 1/main, 1+ = rooms[idx-1])
  const [detailRoomIdx, setDetailRoomIdx] = useState(0);
  // Mobile: which panel is active on small screens
  const [detailMobileTab, setDetailMobileTab] = useState<'info' | 'chat'>('info');
  // Chat: active room filter ('all' = umum, or room_name label)
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
  // Approve Sales Internal ditampilkan dulu isinya, tidak langsung jalan begitu
  // tombolnya ditekan - mengikuti Request Schedule. Approve adalah keputusan,
  // dan keputusan yang tidak bisa dibaca dulu gampang salah tekan.
  const [internalApproveTarget, setInternalApproveTarget] = useState<ProjectRequest | null>(null);
  const [internalApproveSaving, setInternalApproveSaving] = useState(false);
  // Pop-up notif tiket aktif (pending/in_progress) saat masuk platform
  const [ticketPopupShown, setTicketPopupShown] = useState(false);
  const [showTicketPopup, setShowTicketPopup] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editFormData, setEditFormData] = useState({
    project_name: '', room_name: '', project_location: '', sales_name: '', sales_division: '',
    // uuid Sales, berdampingan dengan namanya - lihat lib/identitas.ts.
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
  // Edit per ruangan: editFormData = Ruangan 1, editRooms = Ruangan 2+ (salinan
  // kerja dari rooms[]). editNewRoomIds = ruangan yang baru ditambah di sesi
  // edit ini dan belum tersimpan - hanya yang ini yang boleh dihapus lagi.
  const [editRooms, setEditRooms] = useState<RoomDetail[]>([]);
  const [editRoomIdx, setEditRoomIdx] = useState(0);
  const [editNewRoomIds, setEditNewRoomIds] = useState<string[]>([]);

  const role = currentUser.role?.toLowerCase().trim() ?? '';
  const isPTS = ['admin', 'superadmin', 'team_pts', 'team'].includes(role);
  //  Akun pimpinan (lib/pimpinan.ts): melihat SEMUA request, hanya baca - bukan Sales yang dibatasi.
  const pimpinan = isPimpinan(currentUser);
  const isTeamPTS = role === 'team_pts' || role === 'team';
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin';
  /**
   * Boleh membetulkan data & mengalihkan pekerjaan: admin/superadmin, atau akun
   * Team PTS yang diberi Full Access lewat Admin Panel.
   */
  const bisaKelolaRequest = isAdmin || isSuperAdmin || hasFullAccess(currentUser as never);

  /*
    Boleh membuka form EDIT (isi lengkap - nama project, kebutuhan teknis,
    catatan, dst) - kebijakan platform: setiap AKTOR yang bersinggungan
    dengan request ini boleh membetulkan bagiannya sendiri, sama seperti
    Reminder Schedule/Ticketing. Dua aktor:

      1. Sales/pembuat request (requester_id / sales_name) - salah ketik
         kebutuhan yang ia minta harus bisa dibetulkan sendiri.
      2. Petugas PTS yang ditugaskan (assign_name / ivp_assignee) - dulu
         TIDAK BISA sama sekali kecuali Full Access; sekarang bisa
         membetulkan datanya sendiri saat mengerjakan.

    Dulu tombolnya memakai (!isPTS || bisaKelolaRequest) - dua-duanya
    salah arah: (!isPTS) bikin SEMUA Sales/Guest melihat tombol Edit di
    request SIAPA PUN, bukan cuma miliknya; sementara petugas PTS yang
    ditugaskan malah TIDAK dapat tombolnya sama sekali kalau bukan Full
    Access. Disamakan dengan aturan pr_update di database (lihat
    sql/edit-scoped-ke-assignee.sql) supaya layar & RLS tidak berbeda
    pendapat.
  */
  const bolehEditRequest = (req: ProjectRequest): boolean =>
    !pimpinan && (bisaKelolaRequest
    || req.requester_id === currentUser.id
    || (!!currentUser.full_name && req.sales_name === currentUser.full_name)
    || (!!currentUser.full_name && req.assign_name === currentUser.full_name)
    || (!!currentUser.full_name && req.ivp_assignee === currentUser.full_name));

  /**
   * Re-route hanya selama pekerjaannya BELUM jalan. Begitu masuk in_progress,
   * sudah ada yang menggarap desainnya - memindahkannya berarti membuang
   * pekerjaan itu, bukan membetulkan salah route.
   */
  const bolehRerouteRequest = (r: ProjectRequest) =>
    !['in_progress', 'completed', 'rejected'].includes(r.status ?? '');
  // Guest IVP = role guest dengan sales_division IVP/MVI (Sales Internal, bisa lihat
  // semua request divisi yang dia handle via division_ivp_mappings)
  const isIVPGuest = role === 'guest' && !pimpinan && (currentUser.sales_division === 'IVP' || currentUser.sales_division === 'MVI');
  // Guest non-IVP = role guest bukan IVP (hanya lihat request miliknya)
  const isNonIVPGuest = role === 'guest' && !pimpinan && currentUser.sales_division !== 'IVP';
  // Bisa ubah status in_progress: hanya PTS yang di-assign ke RUANGAN itu
  // (roomIdx, bukan selalu ruangan pertama - lihat getRoomAssignName).
  const canSetInProgress = (req: ProjectRequest, roomIdx: number) =>
    isPTS && (bisaKelolaRequest || getRoomAssignName(req, roomIdx) === currentUser.full_name);
  // Sales Internal reviewer (utama atau kedua utk brand BOTH) - boleh approve kalau
  // bagian-nya belum di-approve.
  const canInternalApproveProject = (req: ProjectRequest) => {
    if (req.routing_status !== 'internal_review') return false;
    if (currentUser.id === req.internal_sales_id && !req.internal_approved_at) return true;
    if (currentUser.id === req.internal_sales_id_2 && !req.internal_approved_at_2) return true;
    return false;
  };

  const initialForm: InitialFormType = {
    project_name: '', room_name: '', project_location: '',
    sales_name: !isPTS ? (currentUser.full_name || '') : '',
    sales_division: !isPTS ? (currentUser.sales_division?.trim() || '') : '',
    kebutuhan: [], kebutuhan_other: '',
    solution_product: [], solution_other: '',
    layout_signage: [], jaringan_cms: [],
    jumlah_input: '', jumlah_output: '',
    source: [], source_other: '',
    camera_conference: 'No', camera_jumlah: '', camera_tracking: [],
    audio_system: 'No', audio_mixer: '', audio_detail: [],
    wallplate_input: 'No', wallplate_jumlah: '',
    tabletop_input: 'No', tabletop_jumlah: '',
    wireless_presentation: 'No', wireless_mode: [], wireless_dongle: 'No',
    controller_automation: 'No', controller_type: [],
    ukuran_ruangan: '', suggest_tampilan: '', keterangan_lain: '',
    brand_display: '', brand_display_pic_id: '', brand_display_pic_name: '',
  brand_display_2: '', brand_display_2_pic_id: '', brand_display_2_pic_name: '',
    brand_middleware: '', brand_middleware_pic_id: '', brand_middleware_pic_name: '',
    source_laptop_qty: '', source_pc_qty: '',
  };

  // Guest/Sales users list for dropdown
  const [salesGuestUsers, setSalesGuestUsers] = useState<{id:string;full_name:string;username:string;sales_division?:string;is_internal_sales?:boolean}[]>([]);
  const [myIsInternalSales, setMyIsInternalSales] = useState(false); // creator = Sales Internal  boleh isi SBU (atas nama Sales External)
  // Cache nama Sales Internal (CC) hasil resolve dari internal_sales_id / internal_sales_id_2 -
  // kolom lama `ivp_assignee` (nama string langsung) sudah tidak diisi lagi sejak brand-multi-internal
  // (sql/brand-multi-internal.sql), request baru pakai internal_sales_id(_2) yang berupa UUID.
  const [internalSalesNames, setInternalSalesNames] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from('users').select('id, full_name, username, sales_division, is_internal_sales').eq('role', 'guest').then(({ data }: { data: {id:string;full_name:string;username:string;sales_division?:string;is_internal_sales?:boolean}[] | null }) => {
      if (data) muatIdPimpinan(supabase).then(idPim => setSalesGuestUsers(data.filter(u => !idPim.has(u.id))));
    });
    supabase.from('users').select('is_internal_sales').eq('id', currentUser.id).maybeSingle().then(({ data }: { data: { is_internal_sales: boolean | null } | null }) => {
      const internal = !!data?.is_internal_sales;
      setMyIsInternalSales(internal);
      // Sales Internal: kosongkan prefill sales_name supaya field SBU mulai kosong
      // (kalau tidak dipilih, submit fallback ke akun sendiri).
      if (internal && (currentUser.role?.toLowerCase().trim() === 'guest')) {
        setForm(prev => ({ ...prev, sales_name: '', sales_division: '' }));
      }
    });
    supabase.from('brand_pic_mappings').select('id,brand_type,brand_name,pic_user_id,pic_user_name').order('brand_name').then(({ data }: { data: BrandPicMapping[] | null }) => {
      if (data) setBrandPicMappings(data);
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

  // Room-scoped attachments
  // project_attachments belum punya kolom room_index tersendiri di DB. Tapi upload
  // foto/BOQ utk ruangan tambahan (saat create) SUDAH ditandai dengan prefix nama file
  // "[roomN] ..." (lihat submit handler: label = `room${rIdx+2}`). detailRoomIdx di modal
  // detail: 0 = Ruangan 1 (utama, TANPA prefix), 1+ = rooms[idx-1] (dengan prefix [room{idx+1}]).
  // Kita pakai konvensi yang SUDAH ADA ini, bukan bikin skema baru, supaya file lama tetap
  // konsisten dan tidak perlu migrasi DB.
  const getFileRoomIdx = (fileName: string): number => {
    const m = fileName.match(/^\[room(\d+)\]\s*/i);
    return m ? Math.max(0, parseInt(m[1], 10) - 1) : 0;
  };
  const displayFileName = (fileName: string) => fileName.replace(/^\[room\d+\]\s*/i, '');

  // BUG FIX: Supabase Storage menolak key yang mengandung karakter seperti "[", "]",
  // dan spasi ganda tertentu ("Invalid key"). Prefix "[roomN] " di atas dipakai untuk
  // penanda TAMPILAN/DB (file_name, getFileRoomIdx) dan sengaja TIDAK diubah - supaya
  // parsing existing di atas tetap jalan persis sama. Untuk PATH PENYIMPANAN saja,
  // kita pakai versi yang sudah disanitasi (aman dari karakter yang ditolak Supabase).
  // Ini kenapa upload di Ruangan 1 selalu berhasil (tidak ada prefix "[room1] " karena
  // detailRoomIdx===0) sementara Ruangan 2+ gagal - sekarang keduanya konsisten aman.
  const toStorageSafeName = (name: string): string =>
    name
      .replace(/^\[room(\d+)\]\s*/i, 'room$1_')   // "[room2] " -> "room2_" (aman utk storage key)
      .replace(/[^a-zA-Z0-9._-]/g, '_');           // spasi & karakter aneh lain -> underscore

  // Tombol aksi per-baris - dipakai di tabel desktop DAN kartu mobile (anti-duplikat).
  const renderRequestActions = (req: ProjectRequest) => (
    <>
      {canInternalApproveProject(req) && (
        <>
          <button aria-label="Approve & Teruskan ke Admin" onClick={() => setInternalApproveTarget(req)} title="Approve & Teruskan ke Admin"
            className="w-8 h-8 shrink-0 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-200 rounded-lg flex items-center justify-center transition-all">
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </button>
          <button aria-label="Tolak" onClick={() => handleReject(req)} title="Tolak"
            className="w-8 h-8 shrink-0 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </>
      )}
      {bisaKelolaRequest && req.status === 'pending' && req.routing_status !== 'internal_review' && (
        <>
          <button aria-label="Approve" onClick={() => handleApprove(req)} title="Approve"
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
          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </button>
      )}
      <ViewIconBtn onClick={() => handleOpenDetail(req)} label="Detail" />
      {/* Dulu (isSuperAdmin || isAdmin) saja - Full Access (mis. Manager PTS)
          tidak pernah dapat tombol ini walau RLS-nya (setelah diperbaiki)
          sudah mengizinkan. Disamakan dengan bisaKelolaRequest supaya
          "boleh kelola" dan "boleh hapus" tidak jadi dua jawaban berbeda
          untuk pertanyaan yang sama. */}
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

  const { availableYears, filteredRequests, hal, stats, statusPieData, divisionCounts, divisionPieData, assignedCounts, assignedPieData, productCounts, productPieData, kebutuhanCounts, kebutuhanPieData } = useStatistikRequest({ filterDivision, filterHandler, filterKebutuhan, filterMonth, filterStatus, filterYear, requests, searchQuery, searchSales });

  // Toast bersama (components/shared/Toast) - satu gaya untuk seluruh platform.
  const NotifToast = () => <ToastBersama notif={notification} />;

  // HANDLERS

  const { handleSubmitForm } = useKirimRequest({ boqFormFile, boqRoomMap, currentUser, dueDateForm, fetchRequests, form, initialForm, isPTS, myIsInternalSales, notify, roomPhotoMap, rooms, salesGuestUsers, setBoqFormFile, setBoqRoomMap, setDueDateForm, setForm, setRoomPhotoMap, setRooms, setShowNewFormModal, setSubmitting, setSurveyPhotos, setSurveyPhotosPreviews, surveyPhotos, toStorageSafeName });

  const { handleBulkDelete, toggleSelectId, toggleSelectAll, handleApprove, handleInternalApproveProject, jalankanInternalApprove, handleReject, handleResubmit, handleRejectConfirm, handleDeleteConfirm, handleDeleteAttachment } = useAksiPersetujuan({ currentUser, deleteModal, displayFileName, fetchMessages, fetchRequests, filteredRequests, notify, rejectModal, rejectNote, rejectSaving, selectedIds, selectedRequest, setAssignModal, setAttachments, setBulkDeleting, setConfirmState, setDeleteConfirmText, setDeleteModal, setDeleting, setInternalApproveSaving, setInternalApproveTarget, setRejectModal, setRejectNote, setRejectSaving, setRequests, setSelectedIds, setSelectedRequest, setShowDetailModal });

  const { handleStatusUpdate } = useUbahStatusRequest({ currentUser, fetchMessages, fetchRequests, notify, selectedRequest, setSelectedRequest, statusUpdatingRef });

  const { handleOpenEditForm, editCur, editUpd, editRoomAktifBaru, handleEditAddRoom, handleEditRemoveNewRoom, REQUEST_FIELDS, simpanReroute, handleEditFormSubmit } = useEditRequest({ currentUser, detailRoomIdx, editDueDate, editFormData, editNewRoomIds, editRoomIdx, editRooms, fetchMessages, fetchRequests, notify, rerouteTarget, rerouteTo, rosterPTS, selectedRequest, setDetailRoomIdx, setEditDueDate, setEditFormData, setEditFormModal, setEditNewRoomIds, setEditRoomIdx, setEditRooms, setRerouteSaving, setRerouteTarget, setRerouteTo, setSelectedRequest });

  const { handleSendMessage, handleFileUpload, handleCategoryUpload, handleOpenDetail, getCCLabel, handleCloseDetail } = usePesanLampiran({ activeRequestIdRef, attachments, chatRoomFilter, currentUser, detailRoomIdx, fetchAttachments, fetchMessages, getFileRoomIdx, internalSalesNames, isIVPGuest, isPTS, msgText, notify, selectedRequest, setAttachments, setChatRoomFilter, setDetailMobileTab, setDetailRoomIdx, setInternalSalesNames, setMessages, setMsgText, setSelectedRequest, setSendingMsg, setShowDetailModal, setUnreadMsgMap, setUploadingCategory, setUploadingFile, toStorageSafeName });




  if (!appReady) return <LoadingScreen />;

  // Room-aware: ruangan pertama ikut status request; ruangan lain (tab 2+)
  // punya status sendiri (lihat getRoomStatus di _components/shared.ts) -
  // supaya Command Center bisa "Dikerjakan" sementara Smart ClassRoom sudah
  // "Selesai", alih-alih selalu ikut satu status yang sama untuk semuanya.
  const detailRoomStatus = selectedRequest ? getRoomStatus(selectedRequest, detailRoomIdx) : undefined;
  const detailSc = detailRoomStatus ? (statusConfig[detailRoomStatus] || statusConfig.pending) : null;
  const detailIsPending = detailRoomStatus === 'pending';
  const detailRoomAssignName = selectedRequest ? getRoomAssignName(selectedRequest, detailRoomIdx) : undefined;
  const detailDueStatus = selectedRequest ? getDueStatus(selectedRequest.due_date, detailRoomStatus ?? selectedRequest.status) : null;
  const isFileType = (type: string) => type.startsWith('image/');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-cover bg-center bg-fixed bg-no-repeat" style={{ background: 'var(--latar-halaman)' }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      {NotifToast()}


      <BlokFormBaru
        boqFormFile={boqFormFile} boqRoomMap={boqRoomMap} brandPicMappings={brandPicMappings} currentUser={currentUser} dueDateForm={dueDateForm} form={form} handleSubmitForm={handleSubmitForm} initialForm={initialForm} myIsInternalSales={myIsInternalSales} role={role} roomPhotoMap={roomPhotoMap} rooms={rooms} salesGuestUsers={salesGuestUsers} setBoqFormFile={setBoqFormFile} setBoqRoomMap={setBoqRoomMap} setDueDateForm={setDueDateForm} setForm={setForm} setRoomPhotoMap={setRoomPhotoMap} setRooms={setRooms} setShowNewFormModal={setShowNewFormModal} setSurveyPhotos={setSurveyPhotos} setSurveyPhotosPreviews={setSurveyPhotosPreviews} showNewFormModal={showNewFormModal} submitting={submitting} surveyPhotos={surveyPhotos} surveyPhotosPreviews={surveyPhotosPreviews}
      />

      <BlokAssignPTS
        assignModal={assignModal} currentUser={currentUser} fetchMessages={fetchMessages} fetchRequests={fetchRequests} notify={notify} selectedRequest={selectedRequest} setAssignModal={setAssignModal} setSelectedRequest={setSelectedRequest}
      />

      {/* STICKY HEADER */}
      <HeaderFormRequire
        bellDropdownOpen={bellDropdownOpen} handleOpenDetail={handleOpenDetail} pimpinan={pimpinan} requests={requests} setBellDropdownOpen={setBellDropdownOpen} setShowNewFormModal={setShowNewFormModal}
      />

      <KontenHalamanRequest
        assignedPieData={assignedPieData} availableYears={availableYears} bisaKelolaRequest={bisaKelolaRequest} bulkDeleting={bulkDeleting} currentUser={currentUser} divisionPieData={divisionPieData} fetchRequests={fetchRequests} filterDivision={filterDivision} filterHandler={filterHandler} filterKebutuhan={filterKebutuhan} filterMonth={filterMonth} filterStatus={filterStatus} filterYear={filterYear} filteredRequests={filteredRequests} formatDate={formatDate} formatDueDate={formatDueDate} getDueStatus={getDueStatus} hal={hal} handleOpenDetail={handleOpenDetail} isIVPGuest={isIVPGuest} isPTS={isPTS} isTeamPTS={isTeamPTS} kebutuhanPieData={kebutuhanPieData} loading={loading} pimpinan={pimpinan} productPieData={productPieData} ptsMembersList={ptsMembersList} renderRequestActions={renderRequestActions} requests={requests} searchQuery={searchQuery} searchSales={searchSales} selectMode={selectMode} selectedIds={selectedIds} setBulkConfirm={setBulkConfirm} setFilterDivision={setFilterDivision} setFilterHandler={setFilterHandler} setFilterKebutuhan={setFilterKebutuhan} setFilterMonth={setFilterMonth} setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setSearchQuery={setSearchQuery} setSearchSales={setSearchSales} setSelectMode={setSelectMode} setSelectedIds={setSelectedIds} setShowNewFormModal={setShowNewFormModal} stats={stats} statusPieData={statusPieData} toggleSelectAll={toggleSelectAll} toggleSelectId={toggleSelectId} unreadMsgMap={unreadMsgMap}
      />

      {/* Bulk Delete Confirm Modal */}
      <ModalHapusMassal
        bulkConfirm={bulkConfirm} notify={notify} selectedIds={selectedIds} setBulkConfirm={setBulkConfirm} setBulkDeleting={setBulkDeleting} setRequests={setRequests} setSelectMode={setSelectMode} setSelectedIds={setSelectedIds}
      />

      {/* Reject Modal — muncul di atas detail modal (lihat lib/z-index.ts) */}
      {/* ── KONFIRMASI APPROVE Sales Internal (detail dulu, jangan instan) ──
          Bentuk & warnanya sengaja sama persis dengan popup senama di Request
          Schedule: satu alur kerja, satu bahasa visual. */}
      <ModalApproveInternal
        formatDate={formatDate} handleInternalApproveProject={handleInternalApproveProject} internalApproveSaving={internalApproveSaving} internalApproveTarget={internalApproveTarget} setInternalApproveTarget={setInternalApproveTarget}
      />

      <ModalTolakRequest
        handleRejectConfirm={handleRejectConfirm} rejectModal={rejectModal} rejectNote={rejectNote} rejectSaving={rejectSaving} setRejectModal={setRejectModal} setRejectNote={setRejectNote}
      />

      {/* Status Update Modal — muncul di atas detail modal (lihat lib/z-index.ts) */}
      <ModalUpdateStatus
        bisaKelolaRequest={bisaKelolaRequest} canSetInProgress={canSetInProgress} currentUser={currentUser} handleStatusUpdate={handleStatusUpdate} isTeamPTS={isTeamPTS} selectedNewStatus={selectedNewStatus} setSelectedNewStatus={setSelectedNewStatus} setStatusUpdateModal={setStatusUpdateModal} statusUpdateModal={statusUpdateModal}
      />

      {/* Delete Confirmation Modal — muncul di atas detail modal (lihat lib/z-index.ts) */}
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

      {/* POPUP TIKET AKTIF — muncul sekali saat masuk platform, hilang kalau semua completed */}
      <PopupTicketAktif
        formatDueDate={formatDueDate} handleOpenDetail={handleOpenDetail} requests={requests} setShowTicketPopup={setShowTicketPopup} showTicketPopup={showTicketPopup}
      />

      {/* DETAIL MODAL */}
      <ModalDetailRequest
        activeAttachTab={activeAttachTab} attachments={attachments} bisaKelolaRequest={bisaKelolaRequest} bolehEditRequest={bolehEditRequest} bolehRerouteRequest={bolehRerouteRequest} boqFileRef={boqFileRef} canInternalApproveProject={canInternalApproveProject} chatFileRef={chatFileRef} chatRoomFilter={chatRoomFilter} currentUser={currentUser} desain3d={desain3d} desain3dTools={desain3dTools} design3dFileRef={design3dFileRef} detailDueStatus={detailDueStatus} detailIsPending={detailIsPending} detailMobileTab={detailMobileTab} detailRoomAssignName={detailRoomAssignName} detailRoomIdx={detailRoomIdx} detailRoomStatus={detailRoomStatus} detailSc={detailSc} displayFileName={displayFileName} downloadingPackage={downloadingPackage} fetchRequests={fetchRequests} fileInputRef={fileInputRef} formatDate={formatDate} formatDueDate={formatDueDate} formatFileSize={formatFileSize} getCCLabel={getCCLabel} getFileRoomIdx={getFileRoomIdx} handleCategoryUpload={handleCategoryUpload} handleCloseDetail={handleCloseDetail} handleDeleteAttachment={handleDeleteAttachment} handleFileUpload={handleFileUpload} handleOpenEditForm={handleOpenEditForm} handleReject={handleReject} handleResubmit={handleResubmit} handleSendMessage={handleSendMessage} handleStatusUpdate={handleStatusUpdate} isIVPGuest={isIVPGuest} isNonIVPGuest={isNonIVPGuest} isPTS={isPTS} isTeamPTS={isTeamPTS} messages={messages} messagesEndRef={messagesEndRef} mintaPilih3D={mintaPilih3D} msgText={msgText} muatDesain3D={muatDesain3D} notify={notify} selectedRequest={selectedRequest} sendingMsg={sendingMsg} setActiveAttachTab={setActiveAttachTab} setAssignModal={setAssignModal} setChatRoomFilter={setChatRoomFilter} setDeleteConfirmText={setDeleteConfirmText} setDeleteModal={setDeleteModal} setDetailMobileTab={setDetailMobileTab} setDetailRoomIdx={setDetailRoomIdx} setDownloadingPackage={setDownloadingPackage} setInternalApproveTarget={setInternalApproveTarget} setMintaPilih3D={setMintaPilih3D} setMsgText={setMsgText} setRerouteTarget={setRerouteTarget} setRerouteTo={setRerouteTo} setSelectedNewStatus={setSelectedNewStatus} setSelectedRequest={setSelectedRequest} setShowUploadChoice={setShowUploadChoice} setStatusUpdateModal={setStatusUpdateModal} showDetailModal={showDetailModal} showUploadChoice={showUploadChoice} sldFileRef={sldFileRef} uploadingCategory={uploadingCategory} uploadingFile={uploadingFile}
      />

      {/* ── RE-ROUTE MODAL (admin / Full Access) ── */}
      {/* Z.overlayTop — dibuka dari dalam modal detail (Z.overlay). */}
      <ModalReroute
        isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} rerouteSaving={rerouteSaving} rerouteTarget={rerouteTarget} rerouteTo={rerouteTo} rosterPTS={rosterPTS} setRerouteTarget={setRerouteTarget} setRerouteTo={setRerouteTo} simpanReroute={simpanReroute}
      />

      {/* Edit Form Modal */}
      <ModalEditForm
        editCur={editCur} editDueDate={editDueDate} editFormData={editFormData} editFormModal={editFormModal} editNewRoomIds={editNewRoomIds} editRoomAktifBaru={editRoomAktifBaru} editRoomIdx={editRoomIdx} editRooms={editRooms} editUpd={editUpd} handleEditAddRoom={handleEditAddRoom} handleEditFormSubmit={handleEditFormSubmit} handleEditRemoveNewRoom={handleEditRemoveNewRoom} isPTS={isPTS} salesGuestUsers={salesGuestUsers} selectedRequest={selectedRequest} setEditDueDate={setEditDueDate} setEditFormData={setEditFormData} setEditFormModal={setEditFormModal} setEditRoomIdx={setEditRoomIdx}
      />
    </div>
  );
}

// Page Entry

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
      <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
        style={{ border: '2px solid rgba(13,148,136,0.3)' }}>
        <div className="text-5xl mb-4"><Ikon nama="🔐" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Sesi Habis</h2>
        <p className="text-gray-500 text-sm mb-6">Silakan login kembali melalui dashboard.</p>
        <a href="/dashboard" className="bg-linear-to-r from-teal-600 to-teal-800 text-white px-6 py-3 rounded-xl font-bold hover:from-teal-700 hover:to-teal-900 transition-all shadow-md inline-block">
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
