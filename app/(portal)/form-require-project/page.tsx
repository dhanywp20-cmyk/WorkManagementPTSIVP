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
  SALES_DIVISIONS, DISPLAY_BRANDS, MIDDLEWARE_BRANDS,
  PIE_COLORS, getRoomStatus, getRoomAssignName, getRoomAssignUserId, hasDivergentRoomStatus,
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

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('project_requests').select('*').order('created_at', { ascending: false });
    // Request yang DIBUATKAN admin/PTS (atau Sales Internal) atas nama Sales lain
    // menyimpan requester_id = si pembuat, sedangkan Sales yang dituju hanya
    // tercatat di sales_name. Tanpa klausa ini Sales itu tidak pernah melihat
    // request atas namanya sendiri, walau RLS di database sudah mengizinkan
    // (boleh_lihat_baris mencocokkan sales_name) - yang menahannya di sini.
    // Dicocokkan lewat nama, sama seperti canEdit & RLS; dikutip supaya nama
    // yang memuat koma/titik tidak merusak sintaks or() PostgREST.
    const kutip = (n: string) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const atasNama = (nama?: string | null) => (nama ? `sales_name.eq.${kutip(nama)}` : '');
    if (isPTS || pimpinan) {
      // admin/superadmin: semua request; team PTS: semua request (filter assign di UI); pimpinan: semua, hanya baca
    } else if (isIVPGuest) {
      const { data: ivpDivMaps } = await supabase.from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
      const handledDivisions = (ivpDivMaps ?? []).map((m: any) => m.sales_division as string);
      // Reviewer (internal_sales_id / _2) sudah ter-cover divFilter di bawah karena
      // reviewer selalu di-mapping ke divisi ybs. (Tidak menaruh internal_sales_id_2 di
      // .or() supaya query tak error kalau kolomnya belum ada / migrasi belum di-run.)
      const divFilter = handledDivisions.map((d: string) => `sales_division.eq.${d}`).join(',');
      query = query.or([
        `requester_id.eq.${currentUser.id}`, `ivp_assignee.eq.${currentUser.full_name}`,
        atasNama(currentUser.full_name), divFilter,
      ].filter(Boolean).join(','));
    } else {
      // non-IVP guest: cek jabatan tier untuk supervisor visibility + brand PIC
      const selfJabatan = (currentUser as any).jabatan as string | undefined;
      const selfTier = selfJabatan ? (JABATAN_TIER[selfJabatan] ?? 0) : 0;
      const selfDiv = currentUser.sales_division;
      const isBrandPICUser = currentUser.team_type === 'Marketing';

      // Supervisor tier > 1: lihat request bawahan di divisi sendiri + divisi yang di-supervisi
      if (selfTier > 1 && selfDiv) {
        const { data: supMaps } = await supabase.from('division_supervisor_mappings').select('sales_division').eq('supervisor_id', currentUser.id);
        const supDivisions = (supMaps ?? []).map((m: any) => m.sales_division as string);
        if (!supDivisions.includes(selfDiv)) supDivisions.push(selfDiv);

        // Ambil subordinate ids (tier lebih rendah)
        const { data: allGuests } = await supabase.from('users').select('id, full_name, jabatan, sales_division').eq('role', 'guest');
        const subIds = (allGuests ?? [])
          .filter((u: any) => (JABATAN_TIER[(u.jabatan as string) || ''] ?? 0) < selfTier && supDivisions.includes(u.sales_division))
          .map((u: any) => u.id as string);

        // Also include manual user_supervisor_mappings
        const { data: manualSubs } = await supabase.from('user_supervisor_mappings').select('user_id').eq('supervisor_id', currentUser.id);
        (manualSubs ?? []).forEach((m: any) => { if (!subIds.includes(m.user_id)) subIds.push(m.user_id); });

        if (subIds.length > 0) {
          const namaBawahan: string[] = subIds
            .map((id: string) => (allGuests ?? []).find((u: any) => u.id === id)?.full_name as string | undefined)
            .filter((n?: string): n is string => !!n);
          const orFilter = [
            `requester_id.eq.${currentUser.id}`,
            atasNama(currentUser.full_name),
            ...subIds.map((id: string) => `requester_id.eq.${id}`),
            ...namaBawahan.map(n => atasNama(n)),
          ].filter(Boolean).join(',');
          query = query.or(orFilter);
        } else {
          query = query.or([`requester_id.eq.${currentUser.id}`, atasNama(currentUser.full_name)].filter(Boolean).join(','));
        }
      } else {
        // Staff biasa: request miliknya + request yang diatasnamakan dirinya
        query = query.or([`requester_id.eq.${currentUser.id}`, atasNama(currentUser.full_name)].filter(Boolean).join(','));
      }
    }
    const { data, error } = await query;
    if (!error && data) {
      let filtered = data as ProjectRequest[];
      // Brand PIC: tambahkan request yang brand pic-nya = user ini (dari rooms JSONB)
      const selfDiv = currentUser.sales_division;
      if (!isPTS && !isIVPGuest && !pimpinan && currentUser.team_type === 'Marketing') {
        // Kolom brand Ruangan 1 ikut diambil, dengan jalur mundur: kolomnya
        // baru ada setelah sql/design-project-brand-display-2.sql dijalankan,
        // dan PostgREST menolak SELURUH query kalau satu kolom tak dikenal.
        const KOLOM_DASAR = 'id, project_name, status, sales_name, created_at, rooms, requester_id';
        const KOLOM_BRAND = 'brand_display_pic_id, brand_display_2_pic_id, brand_middleware_pic_id';
        let allReqsRes = await supabase.from('project_requests')
          .select(`${KOLOM_DASAR}, ${KOLOM_BRAND}`).order('created_at', { ascending: false });
        if (allReqsRes.error) {
          allReqsRes = await supabase.from('project_requests')
            .select(KOLOM_DASAR).order('created_at', { ascending: false });
        }
        const allReqs = allReqsRes.data;
        (allReqs ?? []).forEach((r: any) => {
          if (filtered.find(x => x.id === r.id)) return;
          if (!r.rooms || !Array.isArray(r.rooms)) return;
          // brand_display_2_pic_id WAJIB ikut dicek: tanpa itu, PIC display
          // kedua tidak akan pernah melihat request-nya sama sekali - slot
          // display keduanya jadi sekadar catatan, bukan penugasan.
          // Ruangan 1 disimpan di kolom tabel (r.brand_*), ruangan ke-2 dst di
          // r.rooms - keduanya harus dicek, kalau tidak PIC Ruangan 1 tidak
          // pernah melihat request-nya.
          const cocok = (o: any) =>
            o?.brand_display_pic_id === currentUser.id
            || o?.brand_display_2_pic_id === currentUser.id
            || o?.brand_middleware_pic_id === currentUser.id;
          const isBrandPic = cocok(r) || r.rooms.some(cocok);
          if (isBrandPic) filtered.push(r as ProjectRequest);
        });
      }
      // Visibility (catatan spec): anggota tim PTS biasa (bukan admin, bukan
      // Manager) HANYA boleh lihat request yg SUDAH di-assign ke handler
      // (assign_name terisi). Request yg masih pending approval / belum di-assign
      // disembunyikan. Admin/superadmin & Manager tetap lihat semua.
      const selfJabatanPTS = (currentUser as any).jabatan as string | undefined;
      const isManagerPTS = isTeamPTS && selfJabatanPTS === 'Manager';
      if (isTeamPTS && !isManagerPTS) {
        // Tampil kalau sudah di-assign ke handler (assign_name) ATAU kalau
        // request di-route ke user ini sbg Supervisor utk di-assign lanjut.
        filtered = filtered.filter(r => !!r.assign_name || r.assigned_supervisor_id === currentUser.id);
      }
      setRequests(filtered);
      const assigned = [...new Set(filtered.map(r => r.assign_name).filter(Boolean) as string[])].sort();
      setPtsMembersList(assigned);
      const ids = filtered.map(r => r.id);
      if (ids.length > 0) {
        const { data: msgData } = await supabase.from('project_messages').select('request_id, created_at')
          .in('request_id', ids).neq('sender_role', 'system').order('created_at', { ascending: false });
        if (msgData) {
          const counts: Record<string, number> = {};
          const stored = JSON.parse(localStorage.getItem('pts_last_seen') || '{}');
          setLastSeenMap(stored);
          for (const row of msgData as { request_id: string; created_at: string }[]) {
            const lastSeen = stored[row.request_id] || 0;
            const msgTime = new Date(row.created_at).getTime();
            if (msgTime > lastSeen) counts[row.request_id] = (counts[row.request_id] || 0) + 1;
          }
          setUnreadMsgMap(counts);
        }
      }
    } else if (error) {
      // Tanpa ini, gagal fetch (RLS, jaringan putus, dst) tampil identik
      // dengan "memang belum ada request" - daftar tetap pada nilai
      // sebelumnya tanpa penjelasan apa pun ke user.
      notify('error', 'Gagal memuat data request: ' + error.message);
    }
    setLoading(false);
    setAppReady(true);
  }, [currentUser.id, currentUser.sales_division, (currentUser as any).jabatan, isPTS, isIVPGuest]);

  const fetchMessages = useCallback(async (requestId: string) => {
    const { data, error } = await supabase.from('project_messages').select('id,request_id,sender_id,sender_name,sender_role,message,created_at').eq('request_id', requestId).order('created_at', { ascending: true });
    if (!error && data) setMessages(data as ProjectMessage[]);
  }, []);

  const fetchAttachments = useCallback(async (requestId: string) => {
    const { data, error } = await supabase.from('project_attachments').select('id,message_id,request_id,file_name,file_url,file_type,file_size,uploaded_by,uploaded_at,attachment_category,revision_version').eq('request_id', requestId).order('uploaded_at', { ascending: false });
    if (!error && data) {
      const normalized = (data as ProjectAttachment[]).map(a => ({
        ...a,
        attachment_category: (a.attachment_category as string) === 'design3d' ? 'design3d' : a.attachment_category || 'general',
      }));
      setAttachments(normalized);
    }
  }, []);

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

  const handleSubmitForm = async () => {
    if (!form.project_name.trim()) { notify('error', 'Nama Project wajib diisi!'); return; }
    if (rooms.length === 0) {
      if (form.kebutuhan.length === 0 && !form.kebutuhan_other.trim()) { notify('error', 'Pilih minimal satu Kategori Kebutuhan!'); return; }
      if (form.solution_product.length === 0 && !form.solution_other.trim()) { notify('error', 'Pilih minimal satu Solution Product!'); return; }
    } else {
      const emptyRoomIdx = rooms.findIndex(r => r.kebutuhan.length === 0 && !r.kebutuhan_other.trim());
      if (emptyRoomIdx >= 0) { notify('error', `Pilih Kebutuhan untuk Ruangan ${emptyRoomIdx + 2}!`); return; }
    }
    if (!dueDateForm) { notify('error', 'Target Selesai wajib diisi!'); return; }
    setSubmitting(true);
    try {
      // Routing: Sales External wajib direview Sales Internal (division_ivp_mappings)
      // dulu, BARU Admin dapat notifikasi actionable. Sales Internal/Marketing yang
      // request utk kebutuhan sendiri (project direct ke user) TIDAK kena gerbang ini
      // - sama seperti Request Schedule. Admin/PTS yang submit langsung (isPTS) juga
      // skip gerbang (dia sudah tahu/putuskan sendiri).
      let routingStatus: 'internal_review' | 'admin_review' = 'admin_review';
      let internalSalesId: string | null = null;
      let internalSalesId2: string | null = null;   // reviewer kedua (IVP) saat brand BOTH
      const chosenBrand: Brand | null = (form.brand as Brand | undefined) ?? null;
      if (!isPTS) {
        const { data: freshSelf } = await supabase.from('users').select('is_internal_sales, team_type').eq('id', currentUser.id).maybeSingle();
        const isInternalOrMarketing = !!freshSelf?.is_internal_sales || freshSelf?.team_type === 'Marketing';
        const salesDivision = (currentUser.sales_division || form.sales_division || '').trim();
        if (!isInternalOrMarketing && salesDivision) {
          // Sales External: WAJIB pilih Marketing Brand + ada PIC Sales Internal utk brand itu.
          if (!chosenBrand) { notify('error', 'Pilih Marketing Brand dulu (MVI / IVP / Kedua Brand)!'); setSubmitting(false); return; }
          const rb = await resolveBrandInternals(salesDivision, chosenBrand);
          if (rb.missing.length > 0) { notify('error', `Divisi ${salesDivision} belum punya PIC Sales Internal untuk brand: ${rb.missing.join(' & ')}. Hubungi Admin untuk mapping dulu.`); setSubmitting(false); return; }
          routingStatus = 'internal_review';
          const primary = rb.mvi ?? rb.ivp;
          internalSalesId = primary?.id ?? null;
          if (chosenBrand === 'BOTH' && rb.mvi && rb.ivp && rb.mvi.id !== rb.ivp.id) internalSalesId2 = rb.ivp.id;
        }
      }
      const internalHandlers: { phone_number: string | null; full_name: string }[] = [];
      if (routingStatus === 'internal_review') {
        const ids = [internalSalesId, internalSalesId2].filter(Boolean) as string[];
        if (ids.length) {
          const { data: hs } = await supabase.from('users').select('full_name, phone_number').in('id', ids);
          (hs ?? []).forEach((h: any) => internalHandlers.push({ phone_number: h.phone_number, full_name: h.full_name }));
        }
      }
      const payload = {
        project_name: form.project_name.trim(), room_name: form.room_name.trim(),
        project_location: form.project_location.trim(),
        // Guest biasa: pakai nama & divisi akun sendiri. TAPI Sales Internal yang
        // pilih SBU (Sales External)  atasnamakan External tsb (form.sales_name).
        // requester_id/name tetap akun Sales Internal (jejak pembuat).
        sales_name: (!isPTS
          ? ((myIsInternalSales && form.sales_name.trim()) ? form.sales_name.trim() : (currentUser.full_name || form.sales_name).trim())
          : form.sales_name.trim()),
        sales_division: (!isPTS
          ? ((myIsInternalSales && form.sales_name.trim()) ? (form.sales_division?.trim() || '') : (currentUser.sales_division || form.sales_division || '').trim())
          : (form.sales_division?.trim() || '')),
        // uuid berdampingan dengan sales_name, mengikuti aturan yang sama persis
        // seperti barisnya di atas. Saat Sales Internal mengatasnamakan Sales
        // External (SBU), yang dicatat adalah uuid External itu; kalau namanya
        // diketik dan tidak bisa dipastikan milik siapa, dibiarkan kosong.
        // requester_id di bawah tetap jejak siapa yang menekan tombolnya.
        sales_user_id: (!isPTS
          ? ((myIsInternalSales && form.sales_name.trim()) ? idDariNama(salesGuestUsers, form.sales_name) : (currentUser.id ?? null))
          : idDariNama(salesGuestUsers, form.sales_name)),
        kebutuhan: form.kebutuhan, kebutuhan_other: form.kebutuhan_other.trim(),
        solution_product: form.solution_product, solution_other: form.solution_other.trim(),
        layout_signage: form.layout_signage, jaringan_cms: form.jaringan_cms,
        jumlah_input: form.jumlah_input.trim(), jumlah_output: form.jumlah_output.trim(),
        source: form.source, source_other: form.source_other.trim(),
        camera_conference: form.camera_conference, camera_jumlah: form.camera_jumlah.trim(), camera_tracking: form.camera_tracking,
        audio_system: form.audio_system, audio_mixer: form.audio_mixer, audio_detail: form.audio_detail,
        wallplate_input: form.wallplate_input, wallplate_jumlah: form.wallplate_jumlah.trim(),
        tabletop_input: form.tabletop_input, tabletop_jumlah: form.tabletop_jumlah.trim(),
        wireless_presentation: form.wireless_presentation, wireless_mode: form.wireless_mode, wireless_dongle: form.wireless_dongle,
        controller_automation: form.controller_automation, controller_type: form.controller_type,
        ukuran_ruangan: form.ukuran_ruangan.trim(), suggest_tampilan: form.suggest_tampilan.trim(), keterangan_lain: form.keterangan_lain.trim(),
        requester_id: currentUser.id, requester_name: currentUser.full_name, status: 'pending' as const,
        due_date: dueDateForm || null,
        rooms: rooms.length > 0 ? rooms : [],
        routing_status: routingStatus,
        internal_sales_id: internalSalesId,
        // Kolom brand hanya ditulis kalau ada brand (Sales External) - supaya submit
        // internal/admin tetap jalan walau sql/brand-multi-internal.sql belum di-run.
        ...(chosenBrand ? { internal_sales_id_2: internalSalesId2, brand: chosenBrand } : {}),
      };

      // Brand Ruangan 1 dipisah dari payload utama supaya bisa dilepas kalau
      // kolomnya belum ada. Ruangan ke-2 dst tersimpan di `rooms` (JSONB),
      // sementara Ruangan 1 memakai kolom tabel tersendiri. Lihat
      // sql/design-project-brand-display-2.sql.
      const brandRuangan1 = {
        brand_display: form.brand_display || null,
        brand_display_pic_id: form.brand_display_pic_id || null,
        brand_display_pic_name: form.brand_display_pic_name || null,
        brand_display_2: form.brand_display_2 || null,
        brand_display_2_pic_id: form.brand_display_2_pic_id || null,
        brand_display_2_pic_name: form.brand_display_2_pic_name || null,
        brand_middleware: form.brand_middleware || null,
        brand_middleware_pic_id: form.brand_middleware_pic_id || null,
        brand_middleware_pic_name: form.brand_middleware_pic_name || null,
      };
      let { data, error } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
        .insert([{ ...(pakaiUuid ? payload : tanpaIdentitas(payload)), ...brandRuangan1 }]).select().single());
      if (error) {
        // PostgREST menolak SELURUH insert kalau satu kolom tak dikenal, bukan
        // cuma kolom itu. Tanpa jalur mundur ini, submit gagal total di basis
        // data yang migrasinya belum dijalankan.
        ({ data, error } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
          .insert([pakaiUuid ? payload : tanpaIdentitas(payload)]).select().single()));
      }
      if (error) { notify('error', 'Gagal submit form: ' + error.message); setSubmitting(false); return; }
      if (data?.id) {
        // Catat pembuatan ke audit trail supaya riwayat request punya pangkal.
        // Saat Sales Internal mengajukan atas nama Sales External (SBU),
        // keduanya disebut supaya jelas siapa penginput sebenarnya.
        {
          const atasNama = (payload.sales_name ?? '').trim();
          const bedaPenginput = atasNama && atasNama !== currentUser.full_name;
          logAudit({
            user_id: currentUser.id, user_name: currentUser.full_name,
            action: 'create', module: 'project',
            target_id: data.id, target_name: payload.project_name,
            notes: bedaPenginput
              ? `Diinput ${currentUser.full_name} atas nama Sales ${atasNama}`
              : `Kebutuhan: ${payload.kebutuhan || '-'}`,
          }).catch(() => {});
        }
        await supabase.from('project_messages').insert([{
          request_id: data.id, sender_id: currentUser.id, sender_name: 'System', sender_role: 'system',
          message: `📋 Request baru dari ${currentUser.full_name} telah masuk dan menunggu approval dari Superadmin.`,
        }]);
        /*
          M12 (docs/UX-WORKFLOW-AUDIT.md): request-nya SUDAH tersimpan (data.id
          valid, pesan sistem "menunggu approval" sudah terkirim) di titik ini.
          Dulu upload foto survey/BOQ awal di bawah ini TIDAK dibungkus
          try/catch sendiri - kalau compressImage() atau storage.upload()
          melontar exception (file korup, kuota browser penuh, dsb), yang
          tertangkap adalah catch generik di akhir fungsi ini yang bilang
          "Terjadi kesalahan tidak terduga. Coba lagi." - menyiratkan submit
          gagal TOTAL padahal sudah tersimpan. User yang percaya pesan itu
          submit ulang seluruh form -> request duplikat, notifikasi ganda ke
          Admin & Sales Internal. Sekarang dibungkus try/catch sendiri: upload
          lampiran awal boleh gagal, tapi TIDAK BOLEH terlihat seperti request-
          nya sendiri gagal.
        */
        if (surveyPhotos.length > 0) {
          try {
            for (const photo of surveyPhotos) {
              const compressedPhoto = await compressImage(photo);
              const filePath = `project-files/${data.id}/survey-${Date.now()}-${toStorageSafeName(compressedPhoto.name)}`;
              const { error: storageErr } = await supabase.storage.from('project-files').upload(filePath, compressedPhoto, { cacheControl: '31536000', upsert: false });
              if (!storageErr) {
                const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                await supabase.from('project_attachments').insert([{
                  request_id: data.id, message_id: null, file_name: photo.name,
                  file_url: urlData.publicUrl, file_type: compressedPhoto.type, file_size: compressedPhoto.size,
                  uploaded_by: currentUser.full_name,
                }]);
              }
            }
          } catch {
            notify('error', 'Request berhasil dikirim, tapi sebagian foto survey gagal diupload. Upload manual lewat detail request setelah ini.');
          }
        }
        if (boqFormFile && data?.id) {
          try {
            const filePath = `project-files/${data.id}/boq-initial-${Date.now()}-${toStorageSafeName(boqFormFile.name)}`;
            const { error: boqErr } = await supabase.storage.from('project-files').upload(filePath, boqFormFile, { cacheControl: '31536000', upsert: false });
            if (!boqErr) {
              const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
              await supabase.from('project_attachments').insert([{
                request_id: data.id, message_id: null, file_name: boqFormFile.name,
                file_url: urlData.publicUrl, file_type: boqFormFile.type, file_size: boqFormFile.size,
                uploaded_by: currentUser.full_name, attachment_category: 'boq', revision_version: 1,
              }]);
            }
          } catch {
            notify('error', 'Request berhasil dikirim, tapi file BOQ awal gagal diupload. Upload manual lewat detail request setelah ini.');
          }
        }
        // Termasuk pemegang Full Access (Manager PTS IVP), bukan hanya
        // role admin - lihat lib/penerima-admin.ts.
        const adminUsersWA = await penerimaAdminBernomor();
        const adminPhonesWA = (adminUsersWA || []).map((u: any) => u.phone_number).filter(Boolean);
        if (adminUsersWA && adminUsersWA.length > 0 && routingStatus === 'internal_review') {
          // Sales External: WA WAJIB ke Sales Internal dulu (actionable), Admin cuma pengingat.
          const internalMsg =
            `📩 *REQUEST DESIGN BARU - PERLU REVIEW KAMU*\n\n` +
            `Sales External *${currentUser.full_name}* (${currentUser.sales_division || '-'}) mengajukan request design:\n\n` +
            `📋 Project: ${form.project_name.trim()}\n` +
            `🛋️ Ruangan: ${form.room_name.trim() || '-'}\n\n` +
            `Silakan review & teruskan ke Admin:\n` +
            `🔗 ${appLink()}`;
          await Promise.allSettled(
            internalHandlers.filter(h => h.phone_number).map(h => sendWANotif({ type: 'reminder_wa', target: h.phone_number as string, message: internalMsg, event: 'project.internal_review' }))
          );
          const adminHeadsUp =
            `ℹ️ *ADA REQUEST DESIGN BARU (pengingat)*\n\n` +
            `Sales External *${currentUser.full_name}* mengajukan request untuk *${form.project_name.trim()}*.\n` +
            `Sedang menunggu review dari Sales Internal *${internalHandlers[0]?.full_name ?? '-'}* sebelum bisa diproses Admin.`;
          await Promise.allSettled(
            (adminUsersWA as any[]).map((a: any) => sendWANotif({ type: 'reminder_wa', target: a.phone_number, message: adminHeadsUp, event: 'project.approval_needed' }))
          );
        }
        if (adminUsersWA && adminUsersWA.length > 0 && routingStatus !== 'internal_review') {
          const approvalWaMsg = [
            '🏗️ *Request Design Project \u2014 Request Baru*',
            '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
            `📋 *Project  :* ${form.project_name.trim()}`,
            `🛋️ *Ruangan  :* ${form.room_name.trim() || '-'}`,
            `👤 *Requester:* ${currentUser.full_name}`,
            `🏢 *Sales    :* ${form.sales_name.trim() || '-'}`,
            '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
            'Silakan buka dashboard untuk *Approve / Reject*.',
            `🔗 ${appLink()}`,
          ].join('\n');
          await Promise.allSettled(
            (adminUsersWA as any[]).map((a: any) =>
              sendWANotif({ type: 'reminder_wa', target: a.phone_number, message: approvalWaMsg, event: 'project.approval_needed' })
            )
          );
        }
        // CC/upload/brand-PIC di bawah ini berlaku utk KEDUA jalur routing (internal_review & admin_review).
        if (adminUsersWA && adminUsersWA.length > 0) {
          // CC ke atasan + IVP berdasarkan divisi requester
          try {
            const ccDiv = currentUser?.sales_division ?? '';
            if (ccDiv && ccDiv !== 'IVP' && currentUser?.id) {
              const ccTargets = await fetchWACCTargets(currentUser.id, ccDiv);
              if (ccTargets.length > 0) {
                const ccMsg = [
                  `🏗️ *[CC] Request Design Baru — Divisi ${ccDiv}*`,
                  '━━━━━━━━━━━━━━━━━━',
                  `📋 *Project  :* ${form.project_name.trim()}`,
                  `👤 *Sales    :* ${currentUser.full_name} (${ccDiv})`,
                  '━━━━━━━━━━━━━━━━━━',
                  `📋 *CC ke   :* ${ccTargets.map(t => t.name + (t.relation === 'ivp_handler' ? ' (IVP)' : '')).join(', ')}`,
                  `🔗 ${appLink()}`,
                ].join('\n');
                await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: 'reminder_wa', target: t.phone, message: ccMsg, event: 'project.brand_cc' })));
              }
            }
          } catch { }

          // Upload foto per ruangan tambahan
          try {
            for (const [roomId, photos] of Object.entries(roomPhotoMap)) {
              const rIdx = rooms.findIndex(r => r.id === roomId);
              const label = rIdx >= 0 ? `room${rIdx+2}` : roomId.slice(0,6);
              for (const photo of photos) {
                const compressedPhoto = await compressImage(photo);
                const filePath = `project-files/${data.id}/survey-${label}-${Date.now()}-${toStorageSafeName(compressedPhoto.name)}`;
                const { error: sErr } = await supabase.storage.from('project-files').upload(filePath, compressedPhoto, { cacheControl:'31536000', upsert:false });
                if (!sErr) {
                  const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                  await supabase.from('project_attachments').insert([{
                    request_id: data.id, message_id: null, file_name: `[${label}] ${photo.name}`,
                    file_url: urlData.publicUrl, file_type: compressedPhoto.type, file_size: compressedPhoto.size, uploaded_by: currentUser.full_name,
                  }]);
                }
              }
            }
          } catch { }

          // Upload BOQ per ruangan tambahan
          try {
            for (const [roomId, boqFile] of Object.entries(boqRoomMap)) {
              if (!boqFile) continue;
              const rIdx = rooms.findIndex(r => r.id === roomId);
              const label = rIdx >= 0 ? `room${rIdx+2}` : roomId.slice(0,6);
              const filePath = `project-files/${data.id}/boq-${label}-${Date.now()}-${toStorageSafeName(boqFile.name)}`;
              const { error: bErr } = await supabase.storage.from('project-files').upload(filePath, boqFile, { cacheControl:'31536000', upsert:false });
              if (!bErr) {
                const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                const existingBOQ = await supabase.from('project_attachments').select('revision_version').eq('request_id', data.id).eq('attachment_category','boq').order('revision_version',{ascending:false}).limit(1);
                const revNum = ((existingBOQ.data?.[0]?.revision_version) || 0) + 1;
                await supabase.from('project_attachments').insert([{
                  request_id: data.id, message_id: null, file_name: `[${label}] ${boqFile.name}`,
                  file_url: urlData.publicUrl, file_type: boqFile.type, file_size: boqFile.size,
                  uploaded_by: currentUser.full_name, attachment_category: 'boq', revision_version: revNum,
                }]);
              }
            }
          } catch { }

          // WA notif ke Brand PIC dari rooms
          try {
            // Ruangan 1 ikut: datanya ada di `form`, bukan di `rooms` - tanpa
            // ini PIC Ruangan 1 tidak pernah dikabari sama sekali, padahal
            // ruangan itulah yang paling sering diisi.
            const ruangan1 = {
              room_name: form.room_name || 'Ruangan 1',
              brand_display: form.brand_display, brand_display_pic_id: form.brand_display_pic_id,
              brand_display_2: form.brand_display_2, brand_display_2_pic_id: form.brand_display_2_pic_id,
              brand_middleware: form.brand_middleware, brand_middleware_pic_id: form.brand_middleware_pic_id,
            } as unknown as (typeof rooms)[number];
            const allRooms = [ruangan1, ...rooms];
            const brandPicIds = new Set<string>();
            allRooms.forEach(r => {
              // Ketiganya ikut: PIC display KEDUA harus dikabari juga, kalau
              // tidak slot display keduanya cuma jadi catatan dan orang yang
              // seharusnya menangani tidak pernah tahu.
              if (r.brand_display_pic_id) brandPicIds.add(r.brand_display_pic_id);
              if (r.brand_display_2_pic_id) brandPicIds.add(r.brand_display_2_pic_id);
              if (r.brand_middleware_pic_id) brandPicIds.add(r.brand_middleware_pic_id);
            });
            if (brandPicIds.size > 0) {
              const { data: picUsers } = await supabase.from('users').select('id, full_name, phone_number').in('id', Array.from(brandPicIds));
              for (const pic of (picUsers || []) as any[]) {
                if (!pic.phone_number) continue;
                const picRooms = allRooms.filter(r => r.brand_display_pic_id===pic.id || r.brand_display_2_pic_id===pic.id || r.brand_middleware_pic_id===pic.id);
                const brandMsg = [
                  '🏷️ *[Brand PIC] Request Design Project Baru*',
                  '━━━━━━━━━━━━━━━━━━',
                  `📋 *Project :* ${form.project_name.trim()}`,
                  `👤 *Sales   :* ${currentUser.full_name} (${currentUser.sales_division||'—'})`,
                  '─────────────────',
                  ...picRooms.map((r,i) => {
                    const lines = [`🚪 *Ruangan:* ${r.room_name||'—'}`];
                    if (r.brand_display_pic_id===pic.id) lines.push(`  🖥️ Brand Display: ${r.brand_display} *(Anda PIC-nya)*`);
                    if (r.brand_display_2_pic_id===pic.id) lines.push(`  🖥️ Brand Display 2: ${r.brand_display_2} *(Anda PIC-nya)*`);
                    if (r.brand_middleware_pic_id===pic.id) lines.push(`  🔌 Brand Middleware: ${r.brand_middleware} *(Anda PIC-nya)*`);
                    return lines.join('\n');
                  }),
                  '━━━━━━━━━━━━━━━━━━',
                  `🔗 ${appLink('/request-design-project')}`,
                ].join('\n');
                await sendWANotif({ type: 'reminder_wa', target: pic.phone_number, message: brandMsg, event: 'project.brand_cc' });
              }
            }
          } catch { }
        }
      }
      notify('success', routingStatus === 'internal_review'
        ? `✅ Form berhasil dikirim! ⏳ Menunggu review ${internalHandlers[0]?.full_name ?? 'Sales Internal'} terlebih dahulu.`
        : '✅ Form berhasil dikirim! ⏳ Menunggu approval dari Superadmin.');
      setForm(initialForm); setDueDateForm(''); setSurveyPhotos([]); setSurveyPhotosPreviews([]); setBoqFormFile(null);
      setRooms([]); setRoomPhotoMap({}); setBoqRoomMap({});
      setShowNewFormModal(false);
      fetchRequests();
    } catch { notify('error', 'Terjadi kesalahan tidak terduga. Coba lagi.'); }
    finally { setSubmitting(false); }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmState({
      message: `Hapus ${selectedIds.size} request terpilih?`,
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        setBulkDeleting(true);
        const { error } = await supabase.from('project_requests').delete().in('id', Array.from(selectedIds));
        if (!error) { setRequests(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); }
        else notify('error', 'Gagal hapus: ' + error.message);
        setBulkDeleting(false);
      },
    });
  };
  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => setSelectedIds(
    prev => prev.size === filteredRequests.length ? new Set() : new Set(filteredRequests.map(r => r.id))
  );

  const handleApprove = async (req: ProjectRequest) => {
    // Hanya admin/superadmin yang bisa approve, selalu via AssignPTSModal untuk pilih PTS handler
    setAssignModal({ open: true, req, roomIdx: 0 });
  };

  // Handler: Sales Internal approve & teruskan ke Admin
  const handleInternalApproveProject = async (req: ProjectRequest) => {
    setInternalApproveSaving(true);
    try {
      await jalankanInternalApprove(req);
    } finally {
      setInternalApproveSaving(false);
      setInternalApproveTarget(null);
    }
  };

  const jalankanInternalApprove = async (req: ProjectRequest) => {
    const now = new Date().toISOString();
    // Brand BOTH = 2 reviewer (MVI + IVP), WAJIB keduanya approve baru lanjut ke Admin.
    const isSecondReviewer = !!req.internal_sales_id_2 && req.internal_sales_id_2 === currentUser.id;
    const patch: Record<string, unknown> = {};
    if (isSecondReviewer) patch.internal_approved_at_2 = now;
    else { patch.internal_approved_by = currentUser.id; patch.internal_approved_at = now; }
    const needBoth = !!req.internal_sales_id_2;
    const otherDone = isSecondReviewer ? !!req.internal_approved_at : !!req.internal_approved_at_2;
    const allApproved = !needBoth || otherDone;
    if (allApproved) patch.routing_status = 'admin_review';
    const { error } = await supabase.from('project_requests').update(patch).eq('id', req.id);
    if (error) { notify('error', 'Gagal approve: ' + error.message); return; }
    if (!allApproved) {
      notify('success', 'Approve kamu tersimpan. Menunggu approve Sales Internal brand satunya (Kedua Brand).');
      logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'approve', module: 'project', target_id: req.id, target_name: req.project_name, notes: 'Internal review approved (menunggu reviewer kedua)' }).catch(() => {});
      fetchRequests();
      if (selectedRequest?.id === req.id) setSelectedRequest({ ...req, ...patch });
      return;
    }
    notify('success', 'Request diteruskan ke Admin!');
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'approve', module: 'project', target_id: req.id, target_name: req.project_name, notes: 'Internal review approved' }).catch(() => {});
    fetchRequests();
    if (selectedRequest?.id === req.id) setSelectedRequest({ ...req, routing_status: 'admin_review' });
    // WA + badge in-app ke Admin - actionable, sudah lolos review Sales Internal.
    try {
      const admins = await penerimaAdminBernomor();
      const msg =
        `✅ *REQUEST DESIGN LOLOS REVIEW SALES INTERNAL*\n\n` +
        `Request dari *${req.sales_name}* untuk *${req.project_name}* sudah di-review oleh *${currentUser.full_name}* — silakan diproses/di-assign.\n` +
        `🔗 ${appLink()}`;
      await Promise.allSettled((admins ?? []).filter((a: any) => a.phone_number).map((a: any) => sendWANotif({ type: 'reminder_wa', target: a.phone_number, message: msg, event: 'project.approval_needed' })));
      (admins ?? []).forEach((a: any) => { if (a.id) void createNotification({ user_id: a.id, type: 'project', title: '✅ Request lolos review Sales Internal', body: `${req.sales_name} — ${req.project_name}`, action_url: '/form-require-project', ref_id: req.id, created_by: currentUser.full_name }); });
    } catch { }
  };

  const handleReject = (req: ProjectRequest) => { setRejectNote(''); setRejectModal({ open: true, req }); };

  const handleResubmit = async (req: ProjectRequest) => {
    const { error } = await supabase.from('project_requests').update({ status: 'pending', rejection_reason: null }).eq('id', req.id);
    if (error) { notify('error', 'Gagal re-submit: ' + error.message); return; }
    notify('success', 'Request berhasil di-submit ulang!');
    await supabase.from('project_messages').insert([{ request_id: req.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `🔄 Request di-submit ulang oleh ${currentUser.full_name}.` }]);
    fetchRequests();
    if (selectedRequest?.id === req.id) fetchMessages(req.id);
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'resubmit', module: 'project', target_id: req.id, target_name: req.project_name }).catch(() => {});

    /*
      Pengajuan ulang MASUK LAGI ke antrean approval, tapi sebelumnya tidak
      mengabari siapa pun - jadi request yang sudah diperbaiki Sales bisa
      mengendap tanpa ada yang tahu gilirannya kembali. Penerimanya lewat
      penerimaAdminBernomor() supaya pemegang Full Access ikut, bukan hanya
      role admin.
    */
    try {
      const penerima = await penerimaAdminBernomor();
      const pesan = [
        '🔁 *REQUEST DESIGN DIAJUKAN ULANG*',
        '━━━━━━━━━━━━━━━━━━',
        `👤 *Sales   :* ${req.sales_name || currentUser.full_name}`,
        `📌 *Project :* ${req.project_name}`,
        '━━━━━━━━━━━━━━━━━━',
        'Sudah diperbaiki dan menunggu approval kembali.',
        `🔗 ${appLink()}`,
      ].join('\n');
      for (const u of penerima) {
        //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan , event: 'project.updated' });
      }
    } catch { /* kabar gagal tidak boleh membatalkan pengajuan ulangnya */ }
  };

  const handleRejectConfirm = async () => {
    const req = rejectModal.req;
    if (!req || rejectSaving) return;
    if (!rejectNote.trim()) { notify('error', 'Alasan penolakan wajib diisi!'); return; }
    setRejectSaving(true);
    const { error } = await supabase.from('project_requests').update({ status: 'rejected', rejection_reason: rejectNote.trim() }).eq('id', req.id);
    setRejectSaving(false);
    if (error) { notify('error', 'Gagal reject: ' + error.message); return; }
    notify('info', 'Request ditolak.');
    setRejectModal({ open: false, req: null });
    setRejectNote('');
    fetchRequests();
    const noteMsg = rejectNote.trim() ? ` Alasan: ${rejectNote.trim()}` : '';
    await supabase.from('project_messages').insert([{ request_id: req.id, sender_id: currentUser.id, sender_name: 'System', sender_role: 'system', message: `❌ Request telah ditolak oleh ${currentUser.full_name}.${noteMsg}` }]);
    if (selectedRequest?.id === req.id) fetchMessages(req.id);
    // WA ke requester saat ditolak
    try {
      const { data: requesterUser } = await supabase.from('users').select('phone_number').eq('id', req.requester_id).single();
      if (requesterUser?.phone_number) {
        await sendWANotif({
          type: 'reminder_wa',
          target: requesterUser.phone_number,
          message: `❌ *Request Design — Request Ditolak*

Halo *${req.requester_name}*, request kamu ditolak:

📋 *Project:* ${req.project_name}
${noteMsg ? `📝 *Alasan:* ${rejectNote.trim()}
` : ''}
Hubungi Admin untuk info lebih lanjut.
🔗 ${appLink()}`,
        });
      }
    } catch { /* ignore WA error */ }
    // In-app notification for rejection
    if (req.requester_id) {
      notifyProjectStatusChange(req.requester_id, req.id, req.project_name, 'rejected', currentUser.full_name).catch(() => {});
    }
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'reject', module: 'project', target_id: req.id, target_name: req.project_name }).catch(() => {});
  };

  const handleDeleteConfirm = async () => {
    const req = deleteModal.req; if (!req) return;
    setDeleting(true);
    const { data: attachData } = await supabase.from('project_attachments').select('file_url').eq('request_id', req.id);
    if (attachData && attachData.length > 0) {
      const filePaths = (attachData as { file_url: string }[]).map(a => {
        const match = a.file_url.match(/project-files\/.+/);
        return match ? match[0] : null;
      }).filter(Boolean) as string[];
      if (filePaths.length > 0) await supabase.storage.from('project-files').remove(filePaths);
    }
    await supabase.from('project_attachments').delete().eq('request_id', req.id);
    await supabase.from('project_messages').delete().eq('request_id', req.id);
    //  select('id') supaya RLS yang diam-diam menolak (0 baris, tanpa galat)
    //  ikut terlihat - lampiran & pesannya sudah kadung terhapus di atas,
    //  jadi kalau request-nya sendiri gagal terhapus, "berhasil dihapus"
    //  akan menyembunyikan request yatim tanpa riwayat sama sekali.
    const { data: terhapus, error } = await supabase.from('project_requests').delete().eq('id', req.id).select('id');
    setDeleting(false);
    if (error || !terhapus || terhapus.length === 0) {
      notify('error', error ? 'Gagal menghapus: ' + error.message : 'Request gagal dihapus (tidak punya akses). Lampiran & pesannya sudah terhapus - hubungi admin.');
      return;
    }
    notify('success', `Request "${req.project_name}" berhasil dihapus.`);
    setDeleteModal({ open: false, req: null });
    setDeleteConfirmText('');
    if (selectedRequest?.id === req.id) { setShowDetailModal(false); setSelectedRequest(null); }
    fetchRequests();
  };

  /**
   * Hapus satu file attachment - dulu tidak ada tombolnya sama sekali, jadi
   * Admin/Full Access terpaksa hapus lewat Supabase langsung tiap ada file
   * salah upload/salah kategori. Admin/Full Access = bisaKelolaRequest (sama
   * dengan syarat "Re-assign Tim PTS" di panel ini), BUKAN role admin
   * hardcode, supaya konsisten dengan Full Access yang di-toggle lewat Admin
   * Panel per akun Team.
   */
  const handleDeleteAttachment = (att: ProjectAttachment) => {
    setConfirmState({
      message: `Hapus file "${displayFileName(att.file_name)}"? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        const match = att.file_url.match(/project-files\/.+/);
        if (match) await supabase.storage.from('project-files').remove([match[0]]);
        const { data, error } = await supabase.from('project_attachments').delete().eq('id', att.id).select('id');
        if (error || !data || data.length === 0) {
          notify('error', error ? 'Gagal menghapus: ' + error.message : 'File gagal dihapus (tidak punya akses).');
          return;
        }
        setAttachments(prev => prev.filter(a => a.id !== att.id));
        notify('success', 'File berhasil dihapus.');
      },
    });
  };

  const handleStatusUpdate = async (req: ProjectRequest, newStatus: string, roomIdx: number = 0) => {
    if (statusUpdatingRef.current.has(req.id)) return;
    statusUpdatingRef.current.add(req.id);
    try {
    //  select('id') supaya RLS yang menolak diam-diam (0 baris, tanpa galat)
    //  ikut terlihat - lihat catatan yang sama di handleDeleteConfirm.
    //  Ruangan pertama (roomIdx 0) pakai kolom request langsung seperti semula;
    //  ruangan lain (1+) statusnya hidup di dalam array JSONB `rooms`, jadi
    //  yang ditulis adalah salinan array itu dengan elemen ybs diubah - lihat
    //  getRoomStatus() di shared.ts untuk kenapa modelnya begini.
    let updatedRooms: RoomDetail[] | undefined;
    const updatePayload: Record<string, unknown> = roomIdx === 0
      ? { status: newStatus }
      : (() => {
          const rooms = [...(req.rooms || [])];
          const i = roomIdx - 1;
          if (rooms[i]) rooms[i] = { ...rooms[i], status: newStatus as RoomDetail['status'] };
          updatedRooms = rooms;
          return { rooms };
        })();
    const { data: terubah, error } = await supabase.from('project_requests')
      .update(updatePayload).eq('id', req.id).select('id');
    if (error || !terubah || terubah.length === 0) { notify('error', 'Gagal update status: ' + (error?.message ?? 'akses ditolak database.')); return; }
    notify('success', `Status → ${newStatus}`);
    fetchRequests();
    if (selectedRequest?.id === req.id) {
      setSelectedRequest(roomIdx === 0
        ? { ...selectedRequest, status: newStatus as ProjectRequest['status'] }
        : { ...selectedRequest, rooms: updatedRooms });
    }
    await supabase.from('project_messages').insert([{ request_id: req.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `🔄 Status diupdate menjadi: ${newStatus.replace('_', ' ').toUpperCase()}` }]);
    if (selectedRequest?.id === req.id) fetchMessages(req.id);
    // In-app notification to the requester
    try {
      if (req.requester_id) {
        notifyProjectStatusChange(req.requester_id, req.id, req.project_name, newStatus, currentUser.full_name).catch(() => {});
      }
    } catch { /* ignore */ }

    /*
      Kabar perubahan status ke pihak yang menunggunya.

      Sebelum ini tahap ini HANYA badge in-app ke requester - artinya Sales
      yang mengajukan baru tahu design-nya sudah dikerjakan atau selesai kalau
      kebetulan membuka platform. Untuk status 'completed' pihak yang perlu
      tahu lebih dari satu: Sales pengaju, dan yang mengerjakan berhak
      menerima ucapan terima kasih atas pekerjaannya - pola yang sama dengan
      penyelesaian ticket.
    */
    try {
      const selesai = newStatus === 'completed';
      const nama = [req.sales_name, req.assign_name, req.ivp_assignee].filter(Boolean) as string[];
      const idOrang = [req.requester_id].filter(Boolean) as string[];
      const [resNama, resId] = await Promise.all([
        nama.length ? supabase.from('users').select('id,full_name,username,phone_number').in('full_name', nama)
                    : Promise.resolve({ data: [] as any[] }),
        idOrang.length ? supabase.from('users').select('id,full_name,username,phone_number').in('id', idOrang)
                       : Promise.resolve({ data: [] as any[] }),
      ]);
      const penerima = new Map<string, any>();
      for (const u of [...(resNama.data ?? []), ...(resId.data ?? [])]) if (u?.id) penerima.set(u.id, u);

      const garis = '━━━━━━━━━━━━━━━━━━';
      const ringkas = [
        `📌 *Project :* ${req.project_name}`,
        `👤 *Sales   :* ${req.sales_name || '-'}`,
        `🙋 *Dikerjakan:* ${req.assign_name || req.ivp_assignee || '-'}`,
      ].join('\n');

      for (const u of penerima.values()) {
        const dia = u.id === currentUser.id;
        const pesan = (selesai && dia)
          ? ['🎉 *Terima Kasih!*', garis,
             `Halo *${u.full_name}*, request design ini sudah kamu tandai *Selesai*.`,
             ringkas, garis, 'Terima kasih atas kerja kerasnya! 🙌',
             `🔗 ${appLink()}`].join('\n')
          : [selesai ? '✅ *REQUEST DESIGN SELESAI*' : '🔄 *STATUS REQUEST DESIGN DIPERBARUI*', garis,
             `Halo *${u.full_name}*, status request berubah menjadi *${newStatus}* oleh *${currentUser.full_name}*:`,
             ringkas, garis,
             `🔗 ${appLink()}`].join('\n');
        //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan , event: 'project.updated' });
      }
    } catch { /* kabar gagal tidak boleh membatalkan perubahan statusnya */ }
    // Audit
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'status_change', module: 'project', target_id: req.id, target_name: req.project_name, old_value: req.status, new_value: newStatus }).catch(() => {});
    } finally {
      statusUpdatingRef.current.delete(req.id);
    }
  };

  const handleOpenEditForm = () => {
    if (!selectedRequest) return;
    setEditDueDate(selectedRequest.due_date || '');
    setEditFormData({
      project_name: selectedRequest.project_name || '', room_name: selectedRequest.room_name || '',
      project_location: selectedRequest.project_location || '',
      sales_name: selectedRequest.sales_name || '', sales_division: selectedRequest.sales_division || '',
      // uuid ikut dibawa masuk supaya menyimpan tanpa mengganti Sales tidak
      // menghapus identitas yang sudah tercatat.
      sales_user_id: selectedRequest.sales_user_id ?? null, kebutuhan: selectedRequest.kebutuhan || [],
      kebutuhan_other: selectedRequest.kebutuhan_other || '', solution_product: selectedRequest.solution_product || [],
      solution_other: selectedRequest.solution_other || '', layout_signage: selectedRequest.layout_signage || [],
      jaringan_cms: selectedRequest.jaringan_cms || [], jumlah_input: selectedRequest.jumlah_input || '',
      jumlah_output: selectedRequest.jumlah_output || '', source: selectedRequest.source || [],
      source_other: selectedRequest.source_other || '', camera_conference: selectedRequest.camera_conference || 'No',
      camera_jumlah: selectedRequest.camera_jumlah || '', camera_tracking: selectedRequest.camera_tracking || [],
      audio_system: selectedRequest.audio_system || 'No', audio_mixer: selectedRequest.audio_mixer || '', audio_detail: selectedRequest.audio_detail || [],
      wallplate_input: selectedRequest.wallplate_input || 'No', wallplate_jumlah: selectedRequest.wallplate_jumlah || '',
      tabletop_input: selectedRequest.tabletop_input || 'No', tabletop_jumlah: selectedRequest.tabletop_jumlah || '',
      wireless_presentation: selectedRequest.wireless_presentation || 'No', wireless_mode: selectedRequest.wireless_mode || [], wireless_dongle: selectedRequest.wireless_dongle || 'No',
      controller_automation: selectedRequest.controller_automation || 'No', controller_type: selectedRequest.controller_type || [],
      ukuran_ruangan: selectedRequest.ukuran_ruangan || '',
      suggest_tampilan: selectedRequest.suggest_tampilan || '', keterangan_lain: selectedRequest.keterangan_lain || '',
    });
    const ruanganTersimpan = selectedRequest.rooms || [];
    setEditRooms(ruanganTersimpan.map(r => ({ ...emptyRoom(), ...r })));
    setEditNewRoomIds([]);
    // Buka di tab ruangan yang sedang dilihat di modal Detail, bukan selalu Ruangan 1.
    setEditRoomIdx(Math.min(detailRoomIdx, ruanganTersimpan.length));
    setEditFormModal(true);
  };

  // Data & pengubah untuk tab ruangan yang sedang aktif di form Edit.
  const editCur: EditRoomFields = editRoomIdx === 0 ? editFormData : (editRooms[editRoomIdx - 1] ?? emptyRoom());
  const editUpd = (patch: Partial<EditRoomFields>) => {
    if (editRoomIdx === 0) setEditFormData(p => ({ ...p, ...patch }));
    else setEditRooms(rs => rs.map((r, i) => (i === editRoomIdx - 1 ? { ...r, ...patch } : r)));
  };
  const editRoomAktifBaru = editRoomIdx > 0 && !!editRooms[editRoomIdx - 1] && editNewRoomIds.includes(editRooms[editRoomIdx - 1].id);

  const handleEditAddRoom = () => {
    const baru = emptyRoom();
    setEditRooms(p => [...p, baru]);
    setEditNewRoomIds(p => [...p, baru.id]);
    setEditRoomIdx(1 + editRooms.length);
  };
  // Hanya ruangan yang BELUM tersimpan yang bisa dibuang. Ruangan yang sudah
  // tersimpan tidak boleh dihapus/digeser dari sini: file lampiran terikat ke
  // NOMOR ruangan ("[room3] ...") dan chat ke namanya, jadi menghapus satu
  // ruangan membuat lampiran & chat pindah ke ruangan yang salah.
  const handleEditRemoveNewRoom = () => {
    const r = editRooms[editRoomIdx - 1];
    if (!r || !editNewRoomIds.includes(r.id)) return;
    setEditRooms(p => p.filter(x => x.id !== r.id));
    setEditNewRoomIds(p => p.filter(id => id !== r.id));
    setEditRoomIdx(i => Math.max(0, i - 1));
  };

  /**
   * Field yang dilacak untuk audit & pesan WA.
   *
   * Hanya field yang berarti bagi orang yang mengerjakan. Isian teknis
   * (checkbox perangkat, ukuran, dsb) tetap tersimpan seperti biasa - cuma
   * tidak diuraikan satu per satu di WA, karena daftarnya bisa puluhan baris
   * dan justru menenggelamkan yang penting.
   */
  const REQUEST_FIELDS: AdminField[] = [
    { key: 'project_name',     label: 'Nama Project' },
    { key: 'room_name',        label: 'Nama Ruangan' },
    { key: 'project_location', label: 'Lokasi' },
    { key: 'sales_name',       label: 'Sales' },
    { key: 'sales_division',   label: 'Divisi Sales' },
    { key: 'due_date',         label: 'Target Selesai' },
    { key: 'ukuran_ruangan',   label: 'Ukuran Ruangan' },
    { key: 'suggest_tampilan', label: 'Saran Tampilan' },
    { key: 'keterangan_lain',  label: 'Keterangan' },
  ];

  /** Alihkan request ke anggota tim / supervisor lain. */
  const simpanReroute = async () => {
    if (!rerouteTarget || !rerouteTo) return;
    setRerouteSaving(true);
    try {
      const orang = rosterPTS.find(u => u.id === rerouteTo);
      if (!orang) throw new Error('Tujuan tidak ditemukan');
      const dari = rerouteTarget.assign_name || '(belum ada)';

      const payload: Record<string, unknown> = orang.jabatan === 'Supervisor'
        // Ke Supervisor: dikembalikan ke tahap supervisor_assign supaya
        // Supervisor itu yang menentukan pelaksananya - sama seperti alur
        // normal, bukan jalur pintas yang melompati tahapannya.
        ? { assign_name: null, assign_user_id: null, assigned_supervisor_id: orang.id, routing_status: 'supervisor_assign', status: 'approved' }
        : { assign_name: orang.full_name, assign_user_id: orang.id, assigned_supervisor_id: null, routing_status: null, status: 'approved' };

      const { error, data } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
        .update(pakaiUuid ? payload : tanpaIdentitas(payload)).eq('id', rerouteTarget.id).select('id'));
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Perubahan ditolak sistem (RLS). Hubungi admin.');

      void logAudit({
        user_id: currentUser.id, user_name: currentUser.full_name,
        action: 'assign', module: 'require',
        target_id: rerouteTarget.id, target_name: rerouteTarget.project_name,
        notes: `Re-route: ${dari} → ${orang.full_name}`,
      });

      if (orang.phone_number && orang.full_name !== currentUser.full_name) {
        void sendWANotif({ type: 'reminder_wa', event: 'project.assigned', target: orang.phone_number, message: pesanWAPerubahan({
          namaPenerima: orang.full_name,
          namaPengubah: currentUser.full_name,
          judulItem: rerouteTarget.project_name,
          jenisItem: 'Request Design Project',
          perubahan: [],
          reroute: { dari, ke: orang.full_name },
          tautan: appLink('/form-require-project'),
        }) });
      }
      void createNotification({
        user_id: orang.id, type: 'project',
        title: '🔀 Request dialihkan ke kamu',
        body: `${rerouteTarget.project_name} — oleh ${currentUser.full_name}`,
        action_url: '/form-require-project', ref_id: rerouteTarget.id,
        created_by: currentUser.full_name,
      });

      notify('success', `Dialihkan ke ${orang.full_name}`);
      setRerouteTarget(null); setRerouteTo('');
      fetchRequests();
    } catch (e: any) {
      notify('error', 'Gagal mengalihkan: ' + e.message);
    } finally { setRerouteSaving(false); }
  };

  const handleEditFormSubmit = async () => {
    if (!selectedRequest) return;

    // Ruangan baru wajib punya Kebutuhan - aturan yang sama dengan form pembuatan.
    const idxKosong = editRooms.findIndex(r => editNewRoomIds.includes(r.id) && r.kebutuhan.length === 0 && !r.kebutuhan_other.trim());
    if (idxKosong >= 0) { setEditRoomIdx(idxKosong + 1); notify('error', `Pilih Kebutuhan untuk Ruangan ${idxKosong + 2}!`); return; }

    // Ruangan 2+ : gabungkan ke rooms[] TERBARU di database, bukan ke salinan
    // yang dibuka saat form dibuka. Selama form terbuka, admin bisa saja
    // meng-approve/assign ruangan lain - menulis balik seluruh array dari
    // salinan lama akan menimpa status & assign itu.
    const editanLama = editRooms.filter(r => !editNewRoomIds.includes(r.id));
    const ruanganBaru = editRooms.filter(r => editNewRoomIds.includes(r.id));
    let roomsPayload: RoomDetail[] | null = null;
    const perubahanRuangan: Perubahan[] = [];
    const namaRuanganBaru: string[] = [];
    let butuhApprovalRuanganBaru = false;
    if (editanLama.length > 0 || ruanganBaru.length > 0) {
      const { data: segar } = await supabase.from('project_requests').select('rooms, status').eq('id', selectedRequest.id).maybeSingle();
      const dbRooms: RoomDetail[] = Array.isArray(segar?.rooms) ? segar.rooms : (selectedRequest.rooms || []);
      const statusRequest = (segar?.status ?? selectedRequest.status) as string;
      let adaPerubahan = false;
      const merged = dbRooms.map((dbR, i) => {
        const e = editanLama[i];
        if (!e) return dbR;
        const lama = ambilFieldRuangan(dbR);
        const baru = ambilFieldRuangan(e);
        baru.room_name = baru.room_name.trim();
        if (JSON.stringify(lama) === JSON.stringify(baru)) return dbR;
        adaPerubahan = true;
        const nama = namaRuangan(dbR, i + 2);
        perubahanRuangan.push(...bandingkan(
          EDIT_ROOM_LABELS.map(f => ({ ...f, label: `[${nama}] ${f.label}` })),
          lama as unknown as Record<string, unknown>,
          baru as unknown as Record<string, unknown>,
        ));
        return { ...dbR, ...baru };
      });
      // Ruangan yang ditambah setelah request lewat tahap pending harus
      // menunggu approve sendiri; kalau tidak diberi status, getRoomStatus()
      // jatuh ke status request (mis. "completed") dan ruangan baru tampak selesai.
      butuhApprovalRuanganBaru = statusRequest !== 'pending';
      const tambahan: RoomDetail[] = ruanganBaru.map(r => ({
        ...r, room_name: r.room_name.trim(),
        ...(butuhApprovalRuanganBaru ? { status: 'pending' as const } : {}),
      }));
      tambahan.forEach((r, i) => {
        const nama = namaRuangan(r, dbRooms.length + i + 2);
        namaRuanganBaru.push(nama);
        perubahanRuangan.push({ key: 'rooms', label: 'Ruangan baru', dari: '(kosong)', ke: nama });
      });
      if (adaPerubahan || tambahan.length > 0) roomsPayload = [...merged, ...tambahan];
    }

    const updateData = {
      ...editFormData,
      sales_division: editFormData.sales_division || '',
      due_date: editDueDate || null,
      ...(roomsPayload ? { rooms: roomsPayload } : {}),
    };
    const perubahanReq = bandingkan(
      REQUEST_FIELDS,
      selectedRequest as unknown as Record<string, unknown>,
      updateData as unknown as Record<string, unknown>,
    );
    const semuaPerubahan = [...perubahanReq, ...perubahanRuangan];
    const { error } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
      .update(pakaiUuid ? updateData : tanpaIdentitas(updateData)).eq('id', selectedRequest.id));
    if (error) { notify('error', 'Gagal menyimpan perubahan.'); return; }

    // Jejak siapa mengubah apa. Tanpa ini, satu-satunya bukti perubahan adalah
    // pesan otomatis di kolom diskusi - yang tidak menyebut nilai lamanya.
    void logAudit({
      user_id: currentUser.id, user_name: currentUser.full_name,
      action: 'update', module: 'require',
      target_id: selectedRequest.id, target_name: String(updateData.project_name ?? selectedRequest.project_name),
      notes: semuaPerubahan.length ? ringkasPerubahan(semuaPerubahan) : 'Disimpan tanpa perubahan',
    });

    // Kabari yang mengerjakan: tanpa ini orang bisa berangkat memakai data lama.
    const penangani = String(selectedRequest.assign_name ?? '');
    if (semuaPerubahan.length > 0 && penangani && penangani !== currentUser.full_name) {
      try {
        const { data: u } = await supabase.from('users')
          .select('id, phone_number, full_name').eq('full_name', penangani).maybeSingle();
        if (u?.phone_number) {
          void sendWANotif({ type: 'reminder_wa', event: 'project.updated', target: u.phone_number, message: pesanWAPerubahan({
            namaPenerima: u.full_name || penangani,
            namaPengubah: currentUser.full_name,
            judulItem: String(updateData.project_name ?? selectedRequest.project_name),
            jenisItem: 'Request Design Project',
            perubahan: semuaPerubahan,
            reroute: null,
            tautan: appLink('/form-require-project'),
          }) });
        }
      } catch { /* WA gagal tidak membatalkan perubahan yang sudah tersimpan */ }
    }

    // Ruangan baru yang berstatus pending butuh keputusan admin - kabari mereka,
    // sama seperti request baru. Tanpa ini ruangannya diam menunggu tanpa ada yang tahu.
    if (namaRuanganBaru.length > 0 && butuhApprovalRuanganBaru) {
      try {
        const admins = (await penerimaAdminBernomor()) as { id?: string; phone_number?: string | null }[] | null;
        const pesanAdmin = [
          '🏗️ *Request Design Project — Ruangan Baru*',
          `📋 *Project  :* ${String(updateData.project_name ?? selectedRequest.project_name)}`,
          `🛋️ *Ruangan  :* ${namaRuanganBaru.join(', ')}`,
          `👤 *Oleh     :* ${currentUser.full_name}`,
          'Ruangan ini berstatus *Pending* - buka dashboard untuk *Approve / Reject*.',
          appLink('/form-require-project'),
        ].join('\n');
        await Promise.allSettled((admins ?? [])
          .filter(a => a.phone_number && a.id !== currentUser.id)
          .map(a => sendWANotif({ type: 'reminder_wa', event: 'project.approval_needed', target: a.phone_number as string, message: pesanAdmin })));
      } catch { /* notifikasi gagal tidak membatalkan perubahan yang sudah tersimpan */ }
    }

    notify('success', 'Perubahan disimpan!');
    setEditFormModal(false);
    fetchRequests();
    setSelectedRequest(prev => prev ? { ...prev, ...editFormData, due_date: editDueDate || undefined, ...(roomsPayload ? { rooms: roomsPayload } : {}) } : null);
    setDetailRoomIdx(editRoomIdx);
    await supabase.from('project_messages').insert([
      { request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `✏️ Kebutuhan project diperbarui oleh ${currentUser.full_name}.` },
      // Diberi awalan [Nama Ruangan] supaya muncul di tab chat ruangan barunya.
      ...namaRuanganBaru.map(nama => ({ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `[${nama}] ➕ Ruangan ditambahkan oleh ${currentUser.full_name}.` })),
    ]);
    fetchMessages(selectedRequest.id);
  };

  const handleSendMessage = async () => {
    if (!msgText.trim() || !selectedRequest) return;
    if (selectedRequest.status === 'rejected') { notify('error', 'Request ini sudah ditolak. Tidak bisa mengirim pesan.'); return; }
    if (selectedRequest.status === 'pending' && !isPTS) { notify('error', 'Request masih pending approval. Chat akan aktif setelah diapprove.'); return; }
    // Semua pihak yang bisa lihat request bisa chat: PTS, IVP (own or linked), pemilik request
    const isOwner = selectedRequest.requester_id === currentUser.id;
    const isLinkedIVP = isIVPGuest && selectedRequest.ivp_assignee === currentUser.full_name;
    const canChat = isPTS || isOwner || isLinkedIVP;
    if (!canChat) { notify('error', 'Anda tidak memiliki akses untuk mengirim pesan.'); return; }
    setSendingMsg(true);
    // Prefix message with room label if chatting in room context
    const roomRooms = selectedRequest.rooms || [];
    const totalDetailRooms = 1 + roomRooms.length;
    let finalMessage = msgText.trim();
    if (chatRoomFilter !== 'all') {
      finalMessage = `[${chatRoomFilter}] ${finalMessage}`;
    }
    const { error } = await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: finalMessage }]);
    setSendingMsg(false);
    if (error) { notify('error', 'Gagal kirim pesan.'); return; }
    setMsgText('');
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedRequest) return;
    setUploadingFile(true);
    const toUpload = await compressImage(file);
    // EGRESS/UX FIX: tag file dengan prefix [roomN] kalau lagi di tab ruangan tambahan
    // (detailRoomIdx > 0), supaya konsisten dengan konvensi upload saat create dan
    // muncul di section attachment ruangan yang benar (bukan ketuker semua jadi 1).
    const taggedName = detailRoomIdx > 0 ? `[room${detailRoomIdx + 1}] ${file.name}` : file.name;
    const filePath = `project-files/${selectedRequest.id}/${Date.now()}-${toStorageSafeName(taggedName)}`;
    const { error: storageError } = await supabase.storage.from('project-files').upload(filePath, toUpload, { cacheControl: '31536000', upsert: false });
    if (storageError) { notify('error', 'Upload gagal: ' + storageError.message); setUploadingFile(false); return; }
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
    await supabase.from('project_attachments').insert([{ request_id: selectedRequest.id, message_id: null, file_name: taggedName, file_url: urlData.publicUrl, file_type: toUpload.type, file_size: toUpload.size, uploaded_by: currentUser.full_name, attachment_category: 'general' }]);
    setUploadingFile(false);
    notify('success', `File "${file.name}" berhasil diupload!`);
    fetchAttachments(selectedRequest.id);
    // Pesan chat ini WAJIB ditandai [Nama Ruangan] kalau lagi di tab ruangan
    // tambahan (detailRoomIdx > 0) - sama seperti taggedName pada file di
    // atas. Tanpa tanda ini, pesan jatuh ke kategori "tanpa tanda" yang oleh
    // filter chat SELALU dianggap milik ruangan PERTAMA - jadi upload dari
    // Meeting Room/Command Center menumpuk di tab ruangan pertama.
    const roomLabelChat = detailRoomIdx > 0 ? (selectedRequest.rooms?.[detailRoomIdx - 1]?.room_name?.trim() || `Ruangan ${detailRoomIdx + 1}`) : null;
    await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `${roomLabelChat ? `[${roomLabelChat}] ` : ''}📎 Melampirkan file: ${file.name}` }]);
  };

  const handleCategoryUpload = async (file: File, category: 'sld' | 'boq' | 'design3d') => {
    if (!selectedRequest) return;
    setUploadingCategory(category);
    const existing = attachments.filter(a => a.attachment_category === category && getFileRoomIdx(a.file_name) === detailRoomIdx);
    const revisionNum = existing.length + 1;
    const label = category === 'sld' ? 'SLD' : category === 'boq' ? 'BOQ' : 'Design 3D';
    const toUpload = await compressImage(file);
    const taggedName = detailRoomIdx > 0 ? `[room${detailRoomIdx + 1}] ${file.name}` : file.name;
    const filePath = `project-files/${selectedRequest.id}/${category}-rev${revisionNum}-${Date.now()}-${toStorageSafeName(taggedName)}`;
    const { error: storageError } = await supabase.storage.from('project-files').upload(filePath, toUpload, { cacheControl: '31536000', upsert: false });
    if (storageError) { notify('error', `Upload ${label} gagal: ` + storageError.message); setUploadingCategory(null); return; }
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
    await supabase.from('project_attachments').insert([{ request_id: selectedRequest.id, message_id: null, file_name: taggedName, file_url: urlData.publicUrl, file_type: toUpload.type, file_size: toUpload.size, uploaded_by: currentUser.full_name, attachment_category: category, revision_version: revisionNum }]);
    setUploadingCategory(null);
    notify('success', `${label} Rev-${revisionNum} berhasil diupload!`);
    fetchAttachments(selectedRequest.id);
    // Sama seperti handleFileUpload - tandai [Nama Ruangan] kalau upload
    // terjadi di tab ruangan tambahan, supaya pesannya muncul di tab chat
    // ruangan yang benar, bukan menumpuk di ruangan pertama.
    const roomLabelChat = detailRoomIdx > 0 ? (selectedRequest.rooms?.[detailRoomIdx - 1]?.room_name?.trim() || `Ruangan ${detailRoomIdx + 1}`) : null;
    await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `${roomLabelChat ? `[${roomLabelChat}] ` : ''}📁 ${label} Revision ${revisionNum} diupload: ${file.name}` }]);
  };

  const handleOpenDetail = async (req: ProjectRequest) => {
    activeRequestIdRef.current = req.id;
    setSelectedRequest(req);
    setMessages([]);
    setAttachments([]);
    setShowDetailModal(true);
    setDetailRoomIdx(0);
    setDetailMobileTab('info');
    setChatRoomFilter('all');
    await fetchMessages(req.id);
    await fetchAttachments(req.id);
    // Resolve nama CC (internal_sales_id / internal_sales_id_2) kalau belum ada di cache.
    const ccIds = [req.internal_sales_id, req.internal_sales_id_2].filter(
      (id): id is string => !!id && !internalSalesNames[id]
    );
    if (ccIds.length > 0) {
      const { data: ccUsers } = await supabase.from('users').select('id, full_name').in('id', ccIds);
      if (ccUsers?.length) {
        setInternalSalesNames(prev => {
          const next = { ...prev };
          ccUsers.forEach((u: any) => { next[u.id] = u.full_name; });
          return next;
        });
      }
    }
    const stored = JSON.parse(localStorage.getItem('pts_last_seen') || '{}');
    stored[req.id] = Date.now();
    localStorage.setItem('pts_last_seen', JSON.stringify(stored));
    setUnreadMsgMap(prev => { const n = { ...prev }; delete n[req.id]; return n; });
  };

  // Label CC Sales Internal siap-tampil, misal "Budi (MVI) & Sari (IVP)". Fallback ke
  // kolom lama `ivp_assignee` (nama string langsung) untuk request lama sebelum migrasi brand.
  const getCCLabel = (req: ProjectRequest): string => {
    const parts: string[] = [];
    if (req.internal_sales_id) {
      const name = internalSalesNames[req.internal_sales_id];
      if (name) parts.push(req.brand === 'BOTH' ? `${name} (MVI)` : name);
    }
    if (req.internal_sales_id_2) {
      const name = internalSalesNames[req.internal_sales_id_2];
      if (name) parts.push(`${name} (IVP)`);
    }
    if (parts.length > 0) return parts.join(' & ');
    return req.ivp_assignee || '';
  };

  const handleCloseDetail = () => {
    activeRequestIdRef.current = null;
    setShowDetailModal(false);
    setSelectedRequest(null);
    setMessages([]);
    setAttachments([]);
  };




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
      <NotifToast />


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
