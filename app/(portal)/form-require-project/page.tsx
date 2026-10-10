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

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Popup tiket pending/in_progress - muncul sekali saat masuk platform
  useEffect(() => {
    if (!appReady || ticketPopupShown) return;
    const activeTickets = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
    if (activeTickets.length > 0) {
      setShowTicketPopup(true);
      setTicketPopupShown(true);
    }
  }, [appReady, requests, ticketPopupShown]);

  useEffect(() => {
    const channel = supabase.channel('global_messages_notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages' },
        (payload) => {
          const msg = payload.new as ProjectMessage;
          if (msg.sender_role === 'system') return;
          setUnreadMsgMap(prev => {
            if (!selectedRequest || selectedRequest.id !== msg.request_id) {
              return { ...prev, [msg.request_id]: (prev[msg.request_id] || 0) + 1 };
            }
            return prev;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRequest]);

  useEffect(() => {
    if (!isPTS) return;
    // For IVP guest: count approved requests linked to them (new assignments)
    // For PTS/admin: count pending requests needing action
    // For non-IVP guest: count own pending requests
    const pendingCount = isIVPGuest
      ? requests.filter(r => r.ivp_assignee === currentUser.full_name && (r.status === 'approved' || r.status === 'in_progress')).length
      : requests.filter(r => r.status === 'pending').length;
    setUnreadCount(pendingCount);
  }, [requests, isPTS]);

  useEffect(() => {
    if (!selectedRequest) { activeRequestIdRef.current = null; return; }
    const reqId = selectedRequest.id;
    activeRequestIdRef.current = reqId;
    const channelName = `detail_chat:${reqId}_${Date.now()}`;
    // fetchAttachments di-debounce: tanpa itu, mengunggah enam berkas sekaligus
    // memicu enam kali penarikan ulang daftar lampiran.
    let attachDebounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages', filter: `request_id=eq.${reqId}` },
        (payload) => {
          if (activeRequestIdRef.current !== reqId) return;
          setMessages(prev => {
            const exists = prev.some(m => m.id === (payload.new as ProjectMessage).id);
            if (exists) return prev;
            return [...prev, payload.new as ProjectMessage];
          });
          const stored = JSON.parse(localStorage.getItem('pts_last_seen') || '{}');
          stored[reqId] = Date.now();
          localStorage.setItem('pts_last_seen', JSON.stringify(stored));
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_attachments', filter: `request_id=eq.${reqId}` },
        () => {
          if (activeRequestIdRef.current !== reqId) return;
          if (attachDebounce) clearTimeout(attachDebounce);
          attachDebounce = setTimeout(() => fetchAttachments(reqId), 800);
        })
      .subscribe();

    // EGRESS FIX: polling fallback dinaikkan dari 3 DETIK  60 detik. Realtime
    // di atas sudah append pesan baru langsung ke state (tanpa refetch), jadi
    // polling 3 detik ini sepenuhnya redundant - full refetch pesan tiap 3
    // detik selama modal detail terbuka adalah kontributor egress yang berat.
    // Sekarang murni jaring pengaman kalau koneksi Realtime putus.
    const pollInterval = setInterval(async () => {
      if (activeRequestIdRef.current !== reqId) return;
      const { data } = await supabase.from('project_messages').select('id,request_id,sender_id,sender_name,sender_role,message,created_at').eq('request_id', reqId).order('created_at', { ascending: true });
      if (data && activeRequestIdRef.current === reqId) {
        setMessages(prev => { if (data.length === prev.length) return prev; return data as ProjectMessage[]; });
      }
    }, 60000);

    return () => {
      activeRequestIdRef.current = null;
      if (attachDebounce) clearTimeout(attachDebounce);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedRequest?.id, fetchAttachments]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);


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

  const availableYears = [...new Set(requests.map(r => new Date(r.created_at).getFullYear().toString()))].sort((a, b) => b.localeCompare(a));

  // Paginasi daftar - lihat components/shared/Paginasi.tsx.
  const filteredRequests = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchYear = filterYear === 'all' || new Date(r.created_at).getFullYear().toString() === filterYear;
    const matchMonth = filterMonth === 'all' || (new Date(r.created_at).getMonth() + 1).toString().padStart(2, '0') === filterMonth;
    const matchHandler = filterHandler === 'all' || (r.assign_name || '') === filterHandler;
    const matchDivision = filterDivision === 'all' || (r.sales_division || 'Lainnya') === filterDivision;
    const matchKebutuhan = filterKebutuhan === 'all' || daftarKebutuhan(r).includes(filterKebutuhan);
    const matchProject = !searchQuery || r.project_name.toLowerCase().includes(searchQuery.toLowerCase())
      || (r.project_location || '').toLowerCase().includes(searchQuery.toLowerCase())
      || (r.room_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchSales = !searchSales || (r.sales_name || '').toLowerCase().includes(searchSales.toLowerCase())
      || (r.requester_name || '').toLowerCase().includes(searchSales.toLowerCase())
      || (r.sales_division || '').toLowerCase().includes(searchSales.toLowerCase());
    return matchStatus && matchYear && matchMonth && matchHandler && matchDivision && matchKebutuhan && matchProject && matchSales;
  });

  const hal = usePaginasi(filteredRequests);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const statusPieData = [
    { label: 'Pending', value: stats.pending, color: '#f59e0b' },
    { label: 'Approved', value: stats.approved, color: '#10b981' },
    { label: 'In Progress', value: stats.in_progress, color: '#3b82f6' },
    { label: 'Completed', value: stats.completed, color: '#8b5cf6' },
    { label: 'Rejected', value: stats.rejected, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const divisionCounts: Record<string, number> = {};
  for (const r of requests) { const d = r.sales_division || 'Lainnya'; divisionCounts[d] = (divisionCounts[d] || 0) + 1; }
  const divisionPieData = Object.entries(divisionCounts).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const assignedCounts: Record<string, number> = {};
  for (const r of requests) { const a = r.assign_name || 'Unassigned'; assignedCounts[a] = (assignedCounts[a] || 0) + 1; }
  const assignedPieData = Object.entries(assignedCounts).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const productCounts: Record<string, number> = {};
  for (const r of requests) {
    const prods = r.solution_product?.length ? r.solution_product : (r.solution_other ? [r.solution_other] : ['Lainnya']);
    for (const p of prods) { productCounts[p] = (productCounts[p] || 0) + 1; }
  }
  const productPieData = Object.entries(productCounts).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const kebutuhanCounts: Record<string, number> = {};
  for (const r of requests) for (const k of daftarKebutuhan(r)) kebutuhanCounts[k] = (kebutuhanCounts[k] || 0) + 1;
  const kebutuhanPieData = Object.entries(kebutuhanCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

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

      {assignModal.open && assignModal.req && (
        <AssignPTSModal
          req={assignModal.req}
          // Opsi "Route ke Supervisor" hanya saat approve awal (belum di-route)
          // DAN untuk ruangan pertama - tahap routing itu milik seluruh request,
          // bukan satu ruangan, jadi re-assign ruangan 2+ tidak pernah menawarkannya.
          // Kalau Supervisor yg buka utk assign final (routing_status='supervisor_assign'),
          // opsi route disembunyikan - dia langsung pilih Tim PTS.
          allowSupervisorRoute={assignModal.roomIdx === 0 && assignModal.req.routing_status !== 'supervisor_assign'}
          roomIdx={assignModal.roomIdx}
          onClose={() => setAssignModal({ open: false, req: null, roomIdx: 0 })}
          onAssigned={() => {
            setAssignModal({ open: false, req: null, roomIdx: 0 });
            notify('success', `Request diproses!`);
            fetchRequests();
            if (selectedRequest?.id === assignModal.req?.id) {
              if (assignModal.roomIdx === 0) {
                setSelectedRequest(prev => prev ? { ...prev, status: 'approved' } : null);
              } else {
                // Ruangan 1+ ditulis di dalam JSONB `rooms` - ambil ulang kolom itu
                // supaya tab ruangan yang sedang dilihat langsung terlihat approved,
                // tanpa harus menutup & buka lagi detailnya.
                supabase.from('project_requests').select('rooms').eq('id', assignModal.req!.id).maybeSingle()
                  .then(({ data }: { data: { rooms: RoomDetail[] } | null }) => {
                    if (data) setSelectedRequest(prev => prev ? { ...prev, rooms: data.rooms } : null);
                  });
              }
              fetchMessages(assignModal.req!.id);
            }
          }}
          currentUser={currentUser}
        />
      )}

      {/* STICKY HEADER */}
      <HeaderFormRequire
        bellDropdownOpen={bellDropdownOpen} handleOpenDetail={handleOpenDetail} pimpinan={pimpinan} requests={requests} setBellDropdownOpen={setBellDropdownOpen} setShowNewFormModal={setShowNewFormModal}
      />

      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 animate-slide-up anim-d80">
          {[
            { label: 'Total', value: stats.total, sub: 'Semua request', accent: '#4f46e5', onClick: () => setFilterStatus('all'), active: filterStatus === 'all' },
            { label: 'Pending', value: stats.pending, sub: 'Menunggu approval', accent: '#b45309', onClick: () => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending'), active: filterStatus === 'pending' },
            { label: 'In Progress', value: stats.in_progress, sub: 'Sedang dikerjakan', accent: '#1d4ed8', onClick: () => setFilterStatus(filterStatus === 'in_progress' ? 'all' : 'in_progress'), active: filterStatus === 'in_progress' },
            { label: 'Completed', value: stats.completed, sub: 'Selesai ditangani', accent: '#047857', onClick: () => setFilterStatus(filterStatus === 'completed' ? 'all' : 'completed'), active: filterStatus === 'completed' },
            { label: 'Rejected', value: stats.rejected, sub: 'Ditolak', accent: '#b91c1c', onClick: () => setFilterStatus(filterStatus === 'rejected' ? 'all' : 'rejected'), active: filterStatus === 'rejected' },
          ].map((card, i) => <StatCard key={i} {...card} />)}
        </div>

        {/* Charts - guest sees handler + product, PTS sees all 3 */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5 sm:gap-4 animate-zoom-in anim-d160">
          {isPTS ? (
            <>
              <MiniPieChart data={statusPieData} title="Status Distribution" icon="🥧"
                activeFilter={filterStatus !== 'all' ? (() => { const rev: Record<string,string> = { pending:'Pending', approved:'Approved', in_progress:'In Progress', completed:'Completed', rejected:'Rejected' }; return rev[filterStatus]; })() : undefined}
                onSliceClick={label => {
                  const map: Record<string, string> = { Pending: 'pending', Approved: 'approved', 'In Progress': 'in_progress', Completed: 'completed', Rejected: 'rejected' };
                  setFilterStatus(prev => prev === (map[label] || label) ? 'all' : (map[label] || label));
                }} />
              <MiniPieChart data={divisionPieData} title="Divisi Sales" icon="🥧"
                activeFilter={filterDivision !== 'all' ? filterDivision : undefined}
                onSliceClick={label => { setFilterDivision(prev => prev === label ? 'all' : label); }} />
              <MiniPieChart data={assignedPieData} title="Team PTS Handler" icon="👥"
                activeFilter={filterHandler !== 'all' ? filterHandler : undefined}
                onSliceClick={label => setFilterHandler(prev => prev === label ? 'all' : label)} />
              <MiniPieChart data={kebutuhanPieData} title="Kebutuhan" icon="🎯"
                centerValue={requests.length} centerLabel="REQUEST"
                activeFilter={filterKebutuhan !== 'all' ? filterKebutuhan : undefined}
                onSliceClick={label => setFilterKebutuhan(prev => prev === label ? 'all' : label)} />
            </>
          ) : (
            <>
              <MiniPieChart data={statusPieData} title="Status Request Saya" icon="🥧" />
              <MiniPieChart data={assignedPieData} title="Team PTS Handler" icon="👥"
                activeFilter={filterHandler !== 'all' ? filterHandler : undefined}
                onSliceClick={label => setFilterHandler(prev => prev === label ? 'all' : label)} />
              <MiniPieChart data={productPieData} title="Product" icon="📦" />
              <MiniPieChart data={kebutuhanPieData} title="Kebutuhan" icon="🎯"
                centerValue={requests.length} centerLabel="REQUEST"
                activeFilter={filterKebutuhan !== 'all' ? filterKebutuhan : undefined}
                onSliceClick={label => setFilterKebutuhan(prev => prev === label ? 'all' : label)} />
            </>
          )}
        </div>

        

        {/* TICKET LIST — matching reference style */}
        <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>

          {/* Header with title + actions — same as reference */}
          <div className="flex flex-wrap items-center justify-between px-3 py-2 sm:px-6 sm:py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ticket List</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{loading ? '…' : filteredRequests.length}</span>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {bisaKelolaRequest && (
                <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {selectMode ? '✕ Batal' : '☑ Select'}
                </button>
              )}
              <button onClick={fetchRequests} disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60" style={{ background: 'white' }}>
                <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Search + filter grid — labeled like reference */}
          <FilterRequest
            availableYears={availableYears} filterHandler={filterHandler} filterMonth={filterMonth} filterStatus={filterStatus} filterYear={filterYear} ptsMembersList={ptsMembersList} searchQuery={searchQuery} searchSales={searchSales} setFilterHandler={setFilterHandler} setFilterMonth={setFilterMonth} setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setSearchQuery={setSearchQuery} setSearchSales={setSearchSales}
          />

          {/* Active filter chips — inside table */}
          {/* Bulk delete bar — admin only, selectMode only */}
          {selectMode && bisaKelolaRequest && selectedIds.size > 0 && (
            <div className="px-3 py-1.5 sm:px-6 sm:py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(13,148,136,0.07)' }}>
              <span className="text-sm font-bold text-teal-700">{selectedIds.size} request dipilih</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
                <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
                  className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
                  style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)' }}>
                  {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size}`}
                </button>
              </div>
            </div>
          )}

          {(filterStatus !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || filterHandler !== 'all' || filterDivision !== 'all' || filterKebutuhan !== 'all' || searchQuery || searchSales) && (
            <div className="px-3 py-1.5 sm:px-6 sm:py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5 sm:gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
              {filterStatus !== 'all' && (
                <button onClick={() => setFilterStatus('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#d97706' }}>Status: {filterStatus} ✕</button>
              )}
              {filterYear !== 'all' && (
                <button onClick={() => setFilterYear('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0891b2' }}>Year: {filterYear} ✕</button>
              )}
              {filterMonth !== 'all' && (
                <button onClick={() => setFilterMonth('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0e7490' }}>Bulan: {filterMonth} ✕</button>
              )}
              {filterHandler !== 'all' && (
                <button onClick={() => setFilterHandler('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>Handler: {filterHandler} ✕</button>
              )}
              {filterDivision !== 'all' && (
                <button onClick={() => setFilterDivision('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#ec4899' }}>Division: {filterDivision} ✕</button>
              )}
              {filterKebutuhan !== 'all' && (
                <button onClick={() => setFilterKebutuhan('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0d9488' }}>Kebutuhan: {filterKebutuhan} ✕</button>
              )}
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>Search: {searchQuery} ✕</button>
              )}
              {searchSales && (
                <button onClick={() => setSearchSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>Sales: {searchSales} ✕</button>
              )}
              <button onClick={() => { 
                setFilterStatus('all'); setFilterYear('all'); setFilterMonth('all'); 
                setFilterHandler('all'); setFilterDivision('all'); setFilterKebutuhan('all'); setSearchQuery(''); setSearchSales('');
                try { ['frp_filterStatus','frp_filterYear','frp_filterMonth','frp_filterHandler','frp_filterDivision','frp_filterKebutuhan','frp_searchQuery','frp_searchSales'].forEach(k => sessionStorage.removeItem(k)); } catch {}
              }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}><IkonTeks nama="🗑" />Reset Semua</button>
            </div>
          )}
          <DaftarRequest
            bisaKelolaRequest={bisaKelolaRequest} currentUser={currentUser} filterMonth={filterMonth} filterStatus={filterStatus} filterYear={filterYear} filteredRequests={filteredRequests} formatDate={formatDate} formatDueDate={formatDueDate} getDueStatus={getDueStatus} hal={hal} handleOpenDetail={handleOpenDetail} isIVPGuest={isIVPGuest} isPTS={isPTS} isTeamPTS={isTeamPTS} loading={loading} pimpinan={pimpinan} renderRequestActions={renderRequestActions} requests={requests} searchQuery={searchQuery} searchSales={searchSales} selectMode={selectMode} selectedIds={selectedIds} setFilterMonth={setFilterMonth} setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setSearchQuery={setSearchQuery} setSearchSales={setSearchSales} setShowNewFormModal={setShowNewFormModal} toggleSelectAll={toggleSelectAll} toggleSelectId={toggleSelectId} unreadMsgMap={unreadMsgMap}
          />
        </div>
      </div>

      {/* Bulk Delete Confirm Modal */}
      {bulkConfirm && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: Z.overlay }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl"><Ikon nama="🗑" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <div><h3 className="font-bold text-white">Hapus {selectedIds.size} Request?</h3>
              <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-5">Kamu akan menghapus <strong>{selectedIds.size} request project</strong> yang dipilih secara permanen.</p>
              <div className="flex gap-3">
                <button onClick={() => setBulkConfirm(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
                <button onClick={async () => {
                  setBulkConfirm(false); setBulkDeleting(true);
                  const { error } = await supabase.from('project_requests').delete().in('id', Array.from(selectedIds));
                  if (!error) { setRequests(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
                  else notify('error', 'Gagal: ' + error.message);
                  setBulkDeleting(false);
                }} className="flex-[2] bg-gradient-to-r from-red-600 to-red-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm hover:from-red-700 hover:to-red-800">
                  <IkonTeks nama="🗑" />Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* Reject Modal — muncul di atas detail modal (lihat lib/z-index.ts) */}
      {/* ── KONFIRMASI APPROVE Sales Internal (detail dulu, jangan instan) ──
          Bentuk & warnanya sengaja sama persis dengan popup senama di Request
          Schedule: satu alur kerja, satu bahasa visual. */}
      <ModalApproveInternal
        formatDate={formatDate} handleInternalApproveProject={handleInternalApproveProject} internalApproveSaving={internalApproveSaving} internalApproveTarget={internalApproveTarget} setInternalApproveTarget={setInternalApproveTarget}
      />

      {rejectModal.open && rejectModal.req && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: Z.overlayTop }}>
          <div className="bg-white/90 rounded-2xl shadow-2xl max-w-md w-full border-2 border-red-400 animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-700 px-6 py-4">
              <h3 className="font-bold text-white text-lg"><IkonTeks nama="❌" />Tolak Request</h3>
              <p className="text-red-100 text-xs mt-0.5">{rejectModal.req.project_name}</p>
            </div>
            <div className="p-6">
              <label htmlFor="f-form-require-project-page-1" className="block text-sm font-bold text-gray-700 mb-2">Alasan penolakan <span className="text-red-500">*</span></label>
              <textarea id="f-form-require-project-page-1" value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Tuliskan alasan penolakan..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 transition-all outline-none resize-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setRejectModal({ open: false, req: null })} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">Batal</button>
                <button onClick={handleRejectConfirm} disabled={rejectSaving} className="flex-[2] bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50">{rejectSaving ? '⏳...' : '❌ Ya, Tolak'}</button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

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
        <a href="/dashboard" className="bg-gradient-to-r from-teal-600 to-teal-800 text-white px-6 py-3 rounded-xl font-bold hover:from-teal-700 hover:to-teal-900 transition-all shadow-md inline-block">
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
