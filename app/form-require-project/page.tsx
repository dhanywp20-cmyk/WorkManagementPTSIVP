'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { setSession, clearSession, getSession } from '@/lib/auth';
import { MiniPieChart, LoadingScreen, ViewIconBtn, DeleteIconBtn, ActionGroup } from '@/components/shared';
import {
  User, ProjectRequest, RoomDetail, BrandPicMapping,
  ProjectMessage, ProjectAttachment,
  statusConfig, JABATAN_TIER, JABATAN_CC_RULES,
  fetchWACCTargets, sendWANotif, emptyRoom,
  SALES_DIVISIONS, DISPLAY_BRANDS, MIDDLEWARE_BRANDS,
  PIE_COLORS,
} from './_components/shared';
import {
  AssignPTSModal, RoomSection, NewFormModal,
  InitialFormType, NewFormModalProps,
} from './_components/Modals';

function FormRequireProject({ currentUser }: { currentUser: User }) {
  const searchParams = useSearchParams();
  const [appReady, setAppReady] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNewFormModal, setShowNewFormModal] = useState(false);
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

  // ── Auto-apply filter dari Global Search (?q=...) ──
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);
  const [searchSales, setSearchSales] = useState(() => {
    try { return sessionStorage.getItem('frp_searchSales') || ''; } catch { return ''; }
  });
  const [filterDivision, setFilterDivision] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterDivision') || 'all'; } catch { return 'all'; }
  });
  const [ptsMembersList, setPtsMembersList] = useState<string[]>([]);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const sldFileRef = useRef<HTMLInputElement>(null);
  const boqFileRef = useRef<HTMLInputElement>(null);
  const design3dFileRef = useRef<HTMLInputElement>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<'sld' | 'boq' | 'design3d' | null>(null);
  const [activeAttachTab, setActiveAttachTab] = useState<'all' | 'sld' | 'boq' | 'design3d'>('all');
  // Detail modal: active room tab (0 = Ruangan 1/main, 1+ = rooms[idx-1])
  const [detailRoomIdx, setDetailRoomIdx] = useState(0);
  // Mobile: which panel is active on small screens
  const [detailMobileTab, setDetailMobileTab] = useState<'info' | 'chat'>('info');
  // Chat: active room filter ('all' = umum, or room_name label)
  const [chatRoomFilter, setChatRoomFilter] = useState<string>('all');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; req: ProjectRequest | null }>({ open: false, req: null });
  const [rejectNote, setRejectNote] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; req: ProjectRequest | null }>({ open: false, req: null });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editFormModal, setEditFormModal] = useState(false);
  const [statusUpdateModal, setStatusUpdateModal] = useState<{ open: boolean; req: ProjectRequest | null }>({ open: false, req: null });
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [downloadingPackage, setDownloadingPackage] = useState(false);
  const [assignModal, setAssignModal] = useState<{ open: boolean; req: ProjectRequest | null }>({ open: false, req: null });
  // Pop-up notif tiket aktif (pending/in_progress) saat masuk platform
  const [ticketPopupShown, setTicketPopupShown] = useState(false);
  const [showTicketPopup, setShowTicketPopup] = useState(false);
  const [bellDropdownOpen, setBellDropdownOpen] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [editFormData, setEditFormData] = useState({
    project_name: '', room_name: '', project_location: '', sales_name: '', sales_division: '',
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

  const role = currentUser.role?.toLowerCase().trim() ?? '';
  const isPTS = ['admin', 'superadmin', 'team_pts', 'team'].includes(role);
  const isTeamPTS = role === 'team_pts' || role === 'team';
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin';
  // Guest IVP = role guest dengan sales_division IVP (bisa lihat semua request)
  const isIVPGuest = role === 'guest' && currentUser.sales_division === 'IVP';
  // Guest non-IVP = role guest bukan IVP (hanya lihat request miliknya)
  const isNonIVPGuest = role === 'guest' && currentUser.sales_division !== 'IVP';
  // Bisa ubah status in_progress: hanya PTS yang di-assign ke request tsb
  const canSetInProgress = (req: ProjectRequest) =>
    isPTS && (isAdmin || isSuperAdmin || req.assign_name === currentUser.full_name);

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
    brand_middleware: '', brand_middleware_pic_id: '', brand_middleware_pic_name: '',
    source_laptop_qty: '', source_pc_qty: '',
  };

  // Guest/Sales users list for dropdown
  const [salesGuestUsers, setSalesGuestUsers] = useState<{id:string;full_name:string;username:string;sales_division?:string}[]>([]);
  useEffect(() => {
    supabase.from('users').select('id, full_name, username, sales_division').eq('role', 'guest').then(({ data }: { data: {id:string;full_name:string;username:string;sales_division?:string}[] | null }) => {
      if (data) setSalesGuestUsers(data);
    });
    supabase.from('brand_pic_mappings').select('*').order('brand_name').then(({ data }: { data: BrandPicMapping[] | null }) => {
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
    if (isPTS) {
      // admin/superadmin: semua request; team PTS: semua request (filter assign di UI)
    } else if (isIVPGuest) {
      const { data: ivpDivMaps } = await supabase.from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
      const handledDivisions = (ivpDivMaps ?? []).map((m: any) => m.sales_division as string);
      if (handledDivisions.length > 0) {
        const divFilter = handledDivisions.map((d: string) => `sales_division.eq.${d}`).join(',');
        query = query.or(`requester_id.eq.${currentUser.id},ivp_assignee.eq.${currentUser.full_name},${divFilter}`);
      } else {
        query = query.or(`requester_id.eq.${currentUser.id},ivp_assignee.eq.${currentUser.full_name}`);
      }
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
        const { data: allGuests } = await supabase.from('users').select('id, jabatan, sales_division').eq('role', 'guest');
        const subIds = (allGuests ?? [])
          .filter((u: any) => (JABATAN_TIER[(u.jabatan as string) || ''] ?? 0) < selfTier && supDivisions.includes(u.sales_division))
          .map((u: any) => u.id as string);

        // Also include manual user_supervisor_mappings
        const { data: manualSubs } = await supabase.from('user_supervisor_mappings').select('user_id').eq('supervisor_id', currentUser.id);
        (manualSubs ?? []).forEach((m: any) => { if (!subIds.includes(m.user_id)) subIds.push(m.user_id); });

        if (subIds.length > 0) {
          const orFilter = [
            `requester_id.eq.${currentUser.id}`,
            ...subIds.map((id: string) => `requester_id.eq.${id}`),
          ].join(',');
          query = query.or(orFilter);
        } else {
          query = query.eq('requester_id', currentUser.id);
        }
      } else {
        // Staff biasa: hanya request miliknya
        query = query.eq('requester_id', currentUser.id);
      }
    }
    const { data, error } = await query;
    if (!error && data) {
      let filtered = data as ProjectRequest[];
      // Brand PIC: tambahkan request yang brand pic-nya = user ini (dari rooms JSONB)
      const selfDiv = currentUser.sales_division;
      if (!isPTS && !isIVPGuest && currentUser.team_type === 'Marketing') {
        const { data: allReqs } = await supabase.from('project_requests').select('id, project_name, status, sales_name, created_at, rooms, requester_id').order('created_at', { ascending: false });
        (allReqs ?? []).forEach((r: any) => {
          if (filtered.find(x => x.id === r.id)) return;
          if (!r.rooms || !Array.isArray(r.rooms)) return;
          const isBrandPic = r.rooms.some((room: any) =>
            room.brand_display_pic_id === currentUser.id || room.brand_middleware_pic_id === currentUser.id
          );
          if (isBrandPic) filtered.push(r as ProjectRequest);
        });
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
    }
    setLoading(false);
    setAppReady(true);
  }, [currentUser.id, currentUser.sales_division, (currentUser as any).jabatan, isPTS, isIVPGuest]);

  const fetchMessages = useCallback(async (requestId: string) => {
    const { data, error } = await supabase.from('project_messages').select('*').eq('request_id', requestId).order('created_at', { ascending: true });
    if (!error && data) setMessages(data as ProjectMessage[]);
  }, []);

  const fetchAttachments = useCallback(async (requestId: string) => {
    const { data, error } = await supabase.from('project_attachments').select('*').eq('request_id', requestId).order('uploaded_at', { ascending: false });
    if (!error && data) {
      const normalized = (data as ProjectAttachment[]).map(a => ({
        ...a,
        attachment_category: (a.attachment_category as string) === 'design3d' ? 'design3d' : a.attachment_category || 'general',
      }));
      setAttachments(normalized);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Popup tiket pending/in_progress — muncul sekali saat masuk platform
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
        () => { if (activeRequestIdRef.current !== reqId) return; fetchAttachments(reqId); })
      .subscribe();

    const pollInterval = setInterval(async () => {
      if (activeRequestIdRef.current !== reqId) return;
      const { data } = await supabase.from('project_messages').select('*').eq('request_id', reqId).order('created_at', { ascending: true });
      if (data && activeRequestIdRef.current === reqId) {
        setMessages(prev => { if (data.length === prev.length) return prev; return data as ProjectMessage[]; });
      }
    }, 3000);

    return () => {
      activeRequestIdRef.current = null;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedRequest?.id, fetchAttachments]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const toggleArr = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const formatFileSize = (bytes: number) =>
    bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
  const formatDate = (dt: string) => new Date(dt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatDueDate = (dt: string) => new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
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

  const filteredRequests = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchYear = filterYear === 'all' || new Date(r.created_at).getFullYear().toString() === filterYear;
    const matchMonth = filterMonth === 'all' || (new Date(r.created_at).getMonth() + 1).toString().padStart(2, '0') === filterMonth;
    const matchHandler = filterHandler === 'all' || (r.assign_name || '') === filterHandler;
    const matchDivision = filterDivision === 'all' || (r.sales_division || 'Lainnya') === filterDivision;
    const matchProject = !searchQuery || r.project_name.toLowerCase().includes(searchQuery.toLowerCase())
      || (r.project_location || '').toLowerCase().includes(searchQuery.toLowerCase())
      || (r.room_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchSales = !searchSales || (r.sales_name || '').toLowerCase().includes(searchSales.toLowerCase())
      || (r.requester_name || '').toLowerCase().includes(searchSales.toLowerCase())
      || (r.sales_division || '').toLowerCase().includes(searchSales.toLowerCase());
    return matchStatus && matchYear && matchMonth && matchHandler && matchDivision && matchProject && matchSales;
  });

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

  // CheckGroup & RadioGroup for edit modal
  const CheckGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const checked = value.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => onChange(toggleArr(value, opt))}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${checked ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
                {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  const RadioGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${value === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-teal-500' : 'border-gray-400'}`}>
              {value === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}
            </div>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  const NotifToast = () => notification ? (
    <div className={`fixed top-4 right-4 z-[100] px-5 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 border-2 max-w-sm animate-scale-in ${
      notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-400' :
      notification.type === 'error' ? 'bg-red-50 text-red-800 border-red-400' :
        'bg-blue-50 text-blue-800 border-blue-400'}`}>
      <span className="text-xl">{notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'}</span>
      <div>
        <p className="font-bold">{notification.type === 'success' ? 'Berhasil!' : notification.type === 'error' ? 'Gagal!' : 'Info'}</p>
        <p className="text-xs font-medium mt-0.5 opacity-80">{notification.msg}</p>
      </div>
    </div>
  ) : null;

  // ── HANDLERS ──────────────────────────────────────────────────────────────

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
      const payload = {
        project_name: form.project_name.trim(), room_name: form.room_name.trim(),
        project_location: form.project_location.trim(),
        // Guest: always use account's sales_name & sales_division (not form which may be empty)
        sales_name: (!isPTS ? (currentUser.full_name || form.sales_name).trim() : form.sales_name.trim()),
        sales_division: (!isPTS ? (currentUser.sales_division || form.sales_division || '').trim() : (form.sales_division?.trim() || '')),
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
      };
      const { data, error } = await supabase.from('project_requests').insert([payload]).select().single();
      if (error) { notify('error', 'Gagal submit form: ' + error.message); setSubmitting(false); return; }
      if (data?.id) {
        await supabase.from('project_messages').insert([{
          request_id: data.id, sender_id: currentUser.id, sender_name: 'System', sender_role: 'system',
          message: `📋 Request baru dari ${currentUser.full_name} telah masuk dan menunggu approval dari Superadmin.`,
        }]);
        if (surveyPhotos.length > 0) {
          for (const photo of surveyPhotos) {
            const filePath = `project-files/${data.id}/survey-${Date.now()}-${photo.name}`;
            const { error: storageErr } = await supabase.storage.from('project-files').upload(filePath, photo, { cacheControl: '3600', upsert: false });
            if (!storageErr) {
              const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
              await supabase.from('project_attachments').insert([{
                request_id: data.id, message_id: null, file_name: photo.name,
                file_url: urlData.publicUrl, file_type: photo.type, file_size: photo.size,
                uploaded_by: currentUser.full_name,
              }]);
            }
          }
        }
        if (boqFormFile && data?.id) {
          const filePath = `project-files/${data.id}/boq-initial-${Date.now()}-${boqFormFile.name}`;
          const { error: boqErr } = await supabase.storage.from('project-files').upload(filePath, boqFormFile, { cacheControl: '3600', upsert: false });
          if (!boqErr) {
            const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
            await supabase.from('project_attachments').insert([{
              request_id: data.id, message_id: null, file_name: boqFormFile.name,
              file_url: urlData.publicUrl, file_type: boqFormFile.type, file_size: boqFormFile.size,
              uploaded_by: currentUser.full_name, attachment_category: 'boq', revision_version: 1,
            }]);
          }
        }
        const { data: adminUsersWA } = await supabase
          .from('users')
          .select('phone_number, full_name')
          .in('role', ['admin', 'superadmin'])
          .not('phone_number', 'is', null)
          .neq('phone_number', '');
        const adminPhonesWA = (adminUsersWA || []).map((u: any) => u.phone_number).filter(Boolean);
        if (adminUsersWA && adminUsersWA.length > 0) {
          const approvalWaMsg = [
            '🏗️ *Request Design Project \u2014 Request Baru*',
            '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
            `📋 *Project  :* ${form.project_name.trim()}`,
            `🛋️ *Ruangan  :* ${form.room_name.trim() || '-'}`,
            `👤 *Requester:* ${currentUser.full_name}`,
            `🏢 *Sales    :* ${form.sales_name.trim() || '-'}`,
            '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
            'Silakan buka dashboard untuk *Approve / Reject*.',
            '🔗 https://work-management-ptsivp.vercel.app/dashboard',
          ].join('\n');
          await Promise.allSettled(
            (adminUsersWA as any[]).map((a: any) =>
              sendWANotif({ type: 'reminder_wa', target: a.phone_number, message: approvalWaMsg })
            )
          );
          // ── CC ke atasan + IVP berdasarkan divisi requester ──
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
                  '🔗 https://team-ticketing.vercel.app/dashboard',
                ].join('\n');
                await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: 'reminder_wa', target: t.phone, message: ccMsg })));
              }
            }
          } catch (ccEx: any) { console.warn('[WA CC request-design]', ccEx?.message); }

          // ── Upload foto per ruangan tambahan ──
          try {
            for (const [roomId, photos] of Object.entries(roomPhotoMap)) {
              const rIdx = rooms.findIndex(r => r.id === roomId);
              const label = rIdx >= 0 ? `room${rIdx+2}` : roomId.slice(0,6);
              for (const photo of photos) {
                const filePath = `project-files/${data.id}/survey-${label}-${Date.now()}-${photo.name}`;
                const { error: sErr } = await supabase.storage.from('project-files').upload(filePath, photo, { cacheControl:'3600', upsert:false });
                if (!sErr) {
                  const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                  await supabase.from('project_attachments').insert([{
                    request_id: data.id, message_id: null, file_name: `[${label}] ${photo.name}`,
                    file_url: urlData.publicUrl, file_type: photo.type, file_size: photo.size, uploaded_by: currentUser.full_name,
                  }]);
                }
              }
            }
          } catch (rPhotoEx: any) { console.warn('[room photo upload]', rPhotoEx?.message); }

          // ── Upload BOQ per ruangan tambahan ──
          try {
            for (const [roomId, boqFile] of Object.entries(boqRoomMap)) {
              if (!boqFile) continue;
              const rIdx = rooms.findIndex(r => r.id === roomId);
              const label = rIdx >= 0 ? `room${rIdx+2}` : roomId.slice(0,6);
              const filePath = `project-files/${data.id}/boq-${label}-${Date.now()}-${boqFile.name}`;
              const { error: bErr } = await supabase.storage.from('project-files').upload(filePath, boqFile, { cacheControl:'3600', upsert:false });
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
          } catch (rBoqEx: any) { console.warn('[room boq upload]', rBoqEx?.message); }

          // ── WA notif ke Brand PIC dari rooms ──
          try {
            const allRooms = rooms.length > 0 ? rooms : [];
            const brandPicIds = new Set<string>();
            allRooms.forEach(r => {
              if (r.brand_display_pic_id) brandPicIds.add(r.brand_display_pic_id);
              if (r.brand_middleware_pic_id) brandPicIds.add(r.brand_middleware_pic_id);
            });
            if (brandPicIds.size > 0) {
              const { data: picUsers } = await supabase.from('users').select('id, full_name, phone_number').in('id', Array.from(brandPicIds));
              for (const pic of (picUsers || []) as any[]) {
                if (!pic.phone_number) continue;
                const picRooms = allRooms.filter(r => r.brand_display_pic_id===pic.id || r.brand_middleware_pic_id===pic.id);
                const brandMsg = [
                  '🏷️ *[Brand PIC] Request Design Project Baru*',
                  '━━━━━━━━━━━━━━━━━━',
                  `📋 *Project :* ${form.project_name.trim()}`,
                  `👤 *Sales   :* ${currentUser.full_name} (${currentUser.sales_division||'—'})`,
                  '─────────────────',
                  ...picRooms.map((r,i) => {
                    const lines = [`🚪 *Ruangan:* ${r.room_name||'—'}`];
                    if (r.brand_display_pic_id===pic.id) lines.push(`  🖥️ Brand Display: ${r.brand_display} *(Anda PIC-nya)*`);
                    if (r.brand_middleware_pic_id===pic.id) lines.push(`  🔌 Brand Middleware: ${r.brand_middleware} *(Anda PIC-nya)*`);
                    return lines.join('\n');
                  }),
                  '━━━━━━━━━━━━━━━━━━',
                  '🔗 https://team-ticketing.vercel.app/request-design-project',
                ].join('\n');
                await sendWANotif({ type: 'reminder_wa', target: pic.phone_number, message: brandMsg });
              }
            }
          } catch (brandEx: any) { console.warn('[WA Brand PIC]', brandEx?.message); }
        }
      }
      notify('success', '✅ Form berhasil dikirim! ⏳ Menunggu approval dari Superadmin.');
      setForm(initialForm); setDueDateForm(''); setSurveyPhotos([]); setSurveyPhotosPreviews([]); setBoqFormFile(null);
      setRooms([]); setRoomPhotoMap({}); setBoqRoomMap({});
      setShowNewFormModal(false);
      fetchRequests();
    } catch { notify('error', 'Terjadi kesalahan tidak terduga. Coba lagi.'); }
    finally { setSubmitting(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.size} request terpilih?`)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from('project_requests').delete().in('id', Array.from(selectedIds));
    if (!error) { setRequests(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); }
    else notify('error', 'Gagal hapus: ' + error.message);
    setBulkDeleting(false);
  };
  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => setSelectedIds(
    prev => prev.size === filteredRequests.length ? new Set() : new Set(filteredRequests.map(r => r.id))
  );

  const handleApprove = async (req: ProjectRequest) => {
    // Hanya admin/superadmin yang bisa approve, selalu via AssignPTSModal untuk pilih PTS handler
    setAssignModal({ open: true, req });
  };

  const handleReject = (req: ProjectRequest) => { setRejectNote(''); setRejectModal({ open: true, req }); };

  const handleRejectConfirm = async () => {
    const req = rejectModal.req;
    if (!req) return;
    const { error } = await supabase.from('project_requests').update({ status: 'rejected' }).eq('id', req.id);
    if (error) { notify('error', 'Gagal reject.'); return; }
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
🔗 https://team-ticketing.vercel.app/dashboard`,
        });
      }
    } catch { /* ignore WA error */ }
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
    const { error } = await supabase.from('project_requests').delete().eq('id', req.id);
    setDeleting(false);
    if (error) { notify('error', 'Gagal menghapus: ' + error.message); return; }
    notify('success', `Request "${req.project_name}" berhasil dihapus.`);
    setDeleteModal({ open: false, req: null });
    setDeleteConfirmText('');
    if (selectedRequest?.id === req.id) { setShowDetailModal(false); setSelectedRequest(null); }
    fetchRequests();
  };

  const handleStatusUpdate = async (req: ProjectRequest, newStatus: string) => {
    const { error } = await supabase.from('project_requests').update({ status: newStatus }).eq('id', req.id);
    if (error) { notify('error', 'Gagal update status.'); return; }
    notify('success', `Status → ${newStatus}`);
    fetchRequests();
    if (selectedRequest) setSelectedRequest({ ...selectedRequest, status: newStatus as ProjectRequest['status'] });
    await supabase.from('project_messages').insert([{ request_id: req.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `🔄 Status diupdate menjadi: ${newStatus.replace('_', ' ').toUpperCase()}` }]);
    if (selectedRequest?.id === req.id) fetchMessages(req.id);
  };

  const handleOpenEditForm = () => {
    if (!selectedRequest) return;
    setEditDueDate(selectedRequest.due_date || '');
    setEditFormData({
      project_name: selectedRequest.project_name || '', room_name: selectedRequest.room_name || '',
      project_location: selectedRequest.project_location || '',
      sales_name: selectedRequest.sales_name || '', sales_division: selectedRequest.sales_division || '', kebutuhan: selectedRequest.kebutuhan || [],
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
    setEditFormModal(true);
  };

  const handleEditFormSubmit = async () => {
    if (!selectedRequest) return;
    const updateData = { 
      ...editFormData, 
      sales_division: editFormData.sales_division || '',
      due_date: editDueDate || null,
    };
    const { error } = await supabase.from('project_requests').update(updateData).eq('id', selectedRequest.id);
    if (error) { notify('error', 'Gagal menyimpan perubahan.'); return; }
    notify('success', 'Perubahan disimpan!');
    setEditFormModal(false);
    fetchRequests();
    setSelectedRequest(prev => prev ? { ...prev, ...editFormData, due_date: editDueDate || undefined } : null);
    await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `✏️ Kebutuhan project diperbarui oleh ${currentUser.full_name}.` }]);
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
    const filePath = `project-files/${selectedRequest.id}/${Date.now()}-${file.name}`;
    const { error: storageError } = await supabase.storage.from('project-files').upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (storageError) { notify('error', 'Upload gagal: ' + storageError.message); setUploadingFile(false); return; }
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
    await supabase.from('project_attachments').insert([{ request_id: selectedRequest.id, message_id: null, file_name: file.name, file_url: urlData.publicUrl, file_type: file.type, file_size: file.size, uploaded_by: currentUser.full_name, attachment_category: 'general' }]);
    setUploadingFile(false);
    notify('success', `File "${file.name}" berhasil diupload!`);
    fetchAttachments(selectedRequest.id);
    await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `📎 Melampirkan file: ${file.name}` }]);
  };

  const handleCategoryUpload = async (file: File, category: 'sld' | 'boq' | 'design3d') => {
    if (!selectedRequest) return;
    setUploadingCategory(category);
    const existing = attachments.filter(a => a.attachment_category === category);
    const revisionNum = existing.length + 1;
    const label = category === 'sld' ? 'SLD' : category === 'boq' ? 'BOQ' : 'Design 3D';
    const filePath = `project-files/${selectedRequest.id}/${category}-rev${revisionNum}-${Date.now()}-${file.name}`;
    const { error: storageError } = await supabase.storage.from('project-files').upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (storageError) { notify('error', `Upload ${label} gagal: ` + storageError.message); setUploadingCategory(null); return; }
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
    await supabase.from('project_attachments').insert([{ request_id: selectedRequest.id, message_id: null, file_name: file.name, file_url: urlData.publicUrl, file_type: file.type, file_size: file.size, uploaded_by: currentUser.full_name, attachment_category: category, revision_version: revisionNum }]);
    setUploadingCategory(null);
    notify('success', `${label} Rev-${revisionNum} berhasil diupload!`);
    fetchAttachments(selectedRequest.id);
    await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `📁 ${label} Revision ${revisionNum} diupload: ${file.name}` }]);
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
    const stored = JSON.parse(localStorage.getItem('pts_last_seen') || '{}');
    stored[req.id] = Date.now();
    localStorage.setItem('pts_last_seen', JSON.stringify(stored));
    setUnreadMsgMap(prev => { const n = { ...prev }; delete n[req.id]; return n; });
  };

  const handleCloseDetail = () => {
    activeRequestIdRef.current = null;
    setShowDetailModal(false);
    setSelectedRequest(null);
    setMessages([]);
    setAttachments([]);
  };

  const handlePrint = () => {
    if (!selectedRequest) return;
    const sc = statusConfig[selectedRequest.status] || statusConfig.pending;
    const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions);
    const statusColorMap: Record<string, string> = {
      pending: '#d97706', approved: '#0d9488', in_progress: '#2563eb', completed: '#7c3aed', rejected: '#dc2626',
    };
    const statusColor = statusColorMap[selectedRequest.status] || '#0d9488';
    const statusLabel = sc.label;

    const infoBox = (label: string, value: string, highlight = false) =>
      value ? `<div class="info-box"><div class="info-label">${label}</div><div class="info-value"${highlight ? ' style="font-size:14px;font-weight:800;color:#065f46"' : ''}>${value}</div></div>` : '';

    const printContent = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>Request Design Project — ${selectedRequest.project_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 13px; }
  .page { padding: 28px 32px; max-width: 940px; margin: 0 auto; }
  .header { background: linear-gradient(135deg,#059669,#065f46); color: white; border-radius: 12px; padding: 18px 22px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
  .header-left p { font-size: 11px; opacity: 0.85; }
  .header-right { text-align: right; font-size: 11px; opacity: 0.85; line-height: 1.8; }
  .status-pill { display: inline-block; padding: 3px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
    background: rgba(255,255,255,0.92); border: 1px solid rgba(255,255,255,0.5); color: white; margin-top: 6px; }
  .section { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
  .section-title { background: #f1f5f9; padding: 8px 14px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em; color: #475569; border-bottom: 1px solid #e2e8f0; }
  .section-title.green { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; }
  .grid2 > * { border-right: 1px solid #e2e8f0; }
  .grid2 > *:last-child { border-right: none; }
  .info-box { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
  .info-box:last-child { border-bottom: none; }
  .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 3px; }
  .info-value { font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.5; }
  .full-col { grid-column: span 2; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  .assign-box { margin-top: 40px; page-break-inside: avoid; border-top: 1.5px solid #334155; padding-top: 12px; text-align: left; max-width: 240px; margin-left: 0; margin-right: auto; }
  .assign-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .assign-name { margin-top: 8px; font-size: 13px; font-weight: 800; color: #065f46; }
  @media print {
    .page { padding: 16px 20px; }
    .section { page-break-inside: avoid; }
    button { display: none !important; }
  }
</style>
</head>
<body><div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>🏗️ Request Design Project — IVP</h1>
      <p>Request ID: ${selectedRequest.id?.substring(0,8).toUpperCase()}</p>
      <div class="status-pill">Status: ${statusLabel}</div>
    </div>
    <div class="header-right">
      <div><b>Dicetak:</b> ${printDate}</div>
      <div><b>Handler:</b> ${selectedRequest.assign_name || '—'}</div>
      <div><b>Requester:</b> ${selectedRequest.requester_name}</div>
      <div><b>Dibuat:</b> ${formatDate(selectedRequest.created_at)}</div>
    </div>
  </div>

  <!-- INFORMASI REQUEST -->
  <div class="section">
    <div class="section-title green">🏗️ Informasi Request</div>
    <div class="grid2">
      <div>
        ${infoBox('Nama Project', selectedRequest.project_name, true)}
        ${infoBox('Nama Ruangan', selectedRequest.room_name || '—')}
        ${infoBox('Lokasi Project', selectedRequest.project_location || '—')}
      </div>
      <div>
        ${infoBox('Sales / Account', selectedRequest.sales_name || '—')}
        ${infoBox('Divisi Sales', selectedRequest.sales_division || '—')}
        ${infoBox('Requester', selectedRequest.requester_name || '—')}
      </div>
    </div>
  </div>

  <!-- STATUS & PENUGASAN -->
  <div class="section">
    <div class="section-title green">📋 Status & Penugasan</div>
    <div class="grid2">
      <div>
        <div class="info-box"><div class="info-label">Status Request</div>
          <div><span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${statusColor}22;color:${statusColor};border:1.5px solid ${statusColor}66">${selectedRequest.status.replace('_',' ').toUpperCase()}</span></div>
        </div>
        ${infoBox('PTS Handler (Assign)', selectedRequest.assign_name || '—')}
        ${selectedRequest.ivp_assignee ? infoBox('IVP Sales (CC)', selectedRequest.ivp_assignee) : ''}
        ${infoBox('Approved By', selectedRequest.approved_by || '—')}
      </div>
      <div>
        ${infoBox('Tanggal Dibuat', formatDate(selectedRequest.created_at))}
        ${selectedRequest.approved_at ? infoBox('Tanggal Approved', formatDate(selectedRequest.approved_at)) : ''}
        ${selectedRequest.due_date ? infoBox('Target Selesai', formatDueDate(selectedRequest.due_date)) : ''}
      </div>
    </div>
  </div>

  <!-- KEBUTUHAN & SOLUTION -->
  <div class="section">
    <div class="section-title green">🎯 Kebutuhan & Solution</div>
    <div class="grid2">
      <div>
        ${infoBox('Kebutuhan', [...(selectedRequest.kebutuhan||[]), selectedRequest.kebutuhan_other].filter(Boolean).join(', ') || '—')}
        ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Layout Signage', selectedRequest.layout_signage?.join(', ') || '—') : ''}
      </div>
      <div>
        ${infoBox('Solution / Product', [...(selectedRequest.solution_product||[]), selectedRequest.solution_other].filter(Boolean).join(', ') || '—')}
        ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jaringan CMS', selectedRequest.jaringan_cms?.join(', ') || '—') : ''}
        ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Input', selectedRequest.jumlah_input || '—') : ''}
        ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Output', selectedRequest.jumlah_output || '—') : ''}
      </div>
    </div>
    ${!(selectedRequest.kebutuhan||[]).includes('Signage') ? '' : ''}
  </div>

  <!-- PERANGKAT & KONEKSI -->
  <div class="section">
    <div class="section-title green">🔌 Perangkat & Koneksi</div>
    <div class="grid2">
      <div>
        ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Input', selectedRequest.jumlah_input || '—') : ''}
        ${infoBox('Source', [...(selectedRequest.source||[]), selectedRequest.source_other].filter(Boolean).join(', ') || '—')}
        ${infoBox('Wallplate Input', selectedRequest.wallplate_input === 'Yes' ? `Ya — ${selectedRequest.wallplate_jumlah} unit` : 'Tidak')}
        ${infoBox('Tabletop Input', selectedRequest.tabletop_input === 'Yes' ? `Ya — ${selectedRequest.tabletop_jumlah} unit` : 'Tidak')}
      </div>
      <div>
        ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Output', selectedRequest.jumlah_output || '—') : ''}
        ${infoBox('Camera Conference', selectedRequest.camera_conference === 'Yes' ? `Ya — ${selectedRequest.camera_jumlah} unit, ${selectedRequest.camera_tracking?.join(', ')||''}` : 'Tidak')}
        ${infoBox('Audio System', selectedRequest.audio_system === 'Yes' ? `Ya — ${selectedRequest.audio_mixer}, ${selectedRequest.audio_detail?.join(', ')||''}` : 'Tidak')}
        ${infoBox('Wireless Presentation', selectedRequest.wireless_presentation === 'Yes' ? `Ya — ${selectedRequest.wireless_mode?.join(', ')}, Dongle: ${selectedRequest.wireless_dongle}` : 'Tidak')}
      </div>
    </div>
  </div>

  <!-- CONTROLLER & RUANGAN -->
  <div class="section">
    <div class="section-title green">📐 Controller & Ruangan</div>
    <div class="grid2">
      <div>
        ${infoBox('Controller / Automation', selectedRequest.controller_automation === 'Yes' ? `Ya — ${selectedRequest.controller_type?.join(', ')||''}` : 'Tidak')}
        ${infoBox('Ukuran Ruangan (P×L×T)', selectedRequest.ukuran_ruangan || '—')}
      </div>
      <div>
        ${infoBox('Suggest Tampilan (W×H)', selectedRequest.suggest_tampilan || '—')}
        ${selectedRequest.keterangan_lain ? infoBox('Keterangan Lain', selectedRequest.keterangan_lain) : ''}
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>🏗️ IndoVisual Professional Tools — Request Design Project</div>
    <div>Dicetak: ${printDate} | Status: ${selectedRequest.status.replace('_',' ').toUpperCase()}</div>
  </div>

  <!-- ASSIGN NAME (HANDLER) -->
  ${selectedRequest.assign_name ? `
  <div class="assign-box">
    <div class="assign-label">Handler / PTS Assign</div>
    <div class="assign-name">${selectedRequest.assign_name}</div>
  </div>` : ''}

</div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  // ── Pure-JS ZIP helpers (no external library needed) ──────────────────────
  const crc32Table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();

  const crc32 = (buf: Uint8Array): number => {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = crc32Table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  const dosDateTime = (): [number, number] => {
    const d = new Date();
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    return [date, time];
  };

  const buildZip = (files: { name: string; data: Uint8Array }[]): Blob => {
    const enc = new TextEncoder();
    const parts: Uint8Array[] = [];
    const centralDir: Uint8Array[] = [];
    let offset = 0;
    const [dosDate, dosTime] = dosDateTime();

    for (const file of files) {
      const nameBytes = enc.encode(file.name);
      const crc = crc32(file.data);
      const size = file.data.length;
      // Local file header
      const lh = new DataView(new ArrayBuffer(30 + nameBytes.length));
      lh.setUint32(0, 0x04034B50, true);  // signature
      lh.setUint16(4, 20, true);           // version needed
      lh.setUint16(6, 0, true);            // flags
      lh.setUint16(8, 0, true);            // compression (stored)
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true);
      lh.setUint32(22, size, true);
      lh.setUint16(26, nameBytes.length, true);
      lh.setUint16(28, 0, true);           // extra length
      const lhArr = new Uint8Array(lh.buffer);
      nameBytes.forEach((b, i) => lhArr[30 + i] = b);
      parts.push(lhArr);
      parts.push(file.data);

      // Central directory entry
      const cd = new DataView(new ArrayBuffer(46 + nameBytes.length));
      cd.setUint32(0, 0x02014B50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, dosTime, true);
      cd.setUint16(14, dosDate, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, size, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint16(30, 0, true);
      cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true);
      cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true);
      cd.setUint32(42, offset, true);
      const cdArr = new Uint8Array(cd.buffer);
      nameBytes.forEach((b, i) => cdArr[46 + i] = b);
      centralDir.push(cdArr);
      offset += lhArr.length + size;
    }

    const cdBytes = centralDir.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; }, new Uint8Array(0));
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054B50, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, files.length, true);
    eocd.setUint16(10, files.length, true);
    eocd.setUint32(12, cdBytes.length, true);
    eocd.setUint32(16, offset, true);
    eocd.setUint16(20, 0, true);

    const allParts = [...parts, cdBytes, new Uint8Array(eocd.buffer)];
    const total = allParts.reduce((s, p) => s + p.length, 0);
    const result = new Uint8Array(total);
    let pos = 0;
    for (const p of allParts) { result.set(p, pos); pos += p.length; }
    return new Blob([result], { type: 'application/zip' });
  };
  // ── End ZIP helpers ────────────────────────────────────────────────────────

  const handleDownloadPackage = async () => {
    if (!selectedRequest) return;
    setDownloadingPackage(true);
    notify('info', 'Menyiapkan paket download...');
    try {
      const enc = new TextEncoder();
      const sc = statusConfig[selectedRequest.status] || statusConfig.pending;
      const dateStr = new Date().toISOString().split('T')[0];
      const projectSlug = selectedRequest.project_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const folderName = `FormRequire_${projectSlug}_${dateStr}`;
      const zipFiles: { name: string; data: Uint8Array }[] = [];

      // ── 1. Form Detail as PDF (HTML → printed to PDF via hidden iframe) ────
      // We generate it as a styled HTML file the user can open & print-to-PDF
      const sc2 = statusConfig[selectedRequest.status] || statusConfig.pending;
      const formHtml = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>Request Design Project — ${selectedRequest.project_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; color: #1e293b; background: #fff; padding: 32px; font-size: 13px; }
  .header { background: linear-gradient(135deg,#0d9488,#0f766e); color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
  .header h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
  .header p { font-size: 11px; opacity: 0.85; }
  .section { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
  .section-title { background: #f1f5f9; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; border-bottom: 1px solid #e2e8f0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 14px 16px; }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-1 { grid-template-columns: 1fr; }
  .field label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
  .field p { font-size: 13px; font-weight: 600; color: #1e293b; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 16px; }
  .chip { background: #f0fdf4; color: #065f46; border: 1px solid #6ee7b7; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 600; }
  .chip.no { background: #f8fafc; color: #64748b; border-color: #cbd5e1; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #065f46; border: 1px solid #6ee7b7; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <h1>🏗️ Form Equipment Request — IVP</h1>
  <p>Dicetak: ${new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })} &nbsp;|&nbsp; <span class="status-badge" style="background:rgba(255,255,255,0.2);color:white;border-color:rgba(255,255,255,0.92)">${sc2.label}</span></p>
</div>

<div class="section">
  <div class="section-title">📁 Informasi Project</div>
  <div class="grid">
    <div class="field"><label>Nama Project</label><p>${selectedRequest.project_name}</p></div>
    <div class="field"><label>Nama Ruangan</label><p>${selectedRequest.room_name || '—'}</p></div>
    <div class="field"><label>Lokasi Project</label><p>${selectedRequest.project_location || '—'}</p></div>
    <div class="field"><label>Sales / Account</label><p>${selectedRequest.sales_name || '—'}</p></div>
    <div class="field"><label>Divisi Sales</label><p>${selectedRequest.sales_division || '—'}</p></div>
    <div class="field"><label>Requester</label><p>${selectedRequest.requester_name}</p></div>
    ${selectedRequest.assign_name ? `<div class="field"><label>PTS Handler</label><p>${selectedRequest.assign_name}</p></div>` : ''}
    ${selectedRequest.due_date ? `<div class="field"><label>Target Selesai</label><p>${formatDueDate(selectedRequest.due_date)}</p></div>` : ''}
    ${selectedRequest.approved_by ? `<div class="field"><label>Approved By</label><p>${selectedRequest.approved_by}</p></div>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">🎯 Kategori Kebutuhan & Solution</div>
  <div class="chips">
    ${[...(selectedRequest.kebutuhan||[]),selectedRequest.kebutuhan_other].filter(Boolean).map(i=>`<span class="chip">${i}</span>`).join('')||'<span class="chip no">—</span>'}
    ${[...(selectedRequest.solution_product||[]),selectedRequest.solution_other].filter(Boolean).map(i=>`<span class="chip">${i}</span>`).join('')||''}
  </div>
  ${(selectedRequest.kebutuhan||[]).includes('Signage') ? `
  <div class="chips" style="padding-top:0">
    ${(selectedRequest.layout_signage||[]).map(i=>`<span class="chip" style="background:#eff6ff;color:#1e40af;border-color:#93c5fd">${i}</span>`).join('')}
    ${(selectedRequest.jaringan_cms||[]).map(i=>`<span class="chip" style="background:#f0fdfa;color:#0f766e;border-color:#5eead4">${i}</span>`).join('')}
  </div>
  <div class="grid grid-2" style="padding-top:0">
    <div class="field"><label>Jumlah Input</label><p>${selectedRequest.jumlah_input||'—'}</p></div>
    <div class="field"><label>Jumlah Output</label><p>${selectedRequest.jumlah_output||'—'}</p></div>
  </div>` : ''}
</div>

<div class="section">
  <div class="section-title">🔌 Source & Peripheral</div>
  <div class="chips">${[...(selectedRequest.source||[]),selectedRequest.source_other].filter(Boolean).map(i=>`<span class="chip">${i}</span>`).join('')||'<span class="chip no">—</span>'}</div>
  <div class="grid">
    <div class="field"><label>Camera Conference</label><p>${selectedRequest.camera_conference === 'Yes' ? `Ya — ${selectedRequest.camera_jumlah||''} unit (${selectedRequest.camera_tracking?.join(', ')||''})` : 'Tidak'}</p></div>
    <div class="field"><label>Audio System</label><p>${selectedRequest.audio_system === 'Yes' ? `Ya — ${selectedRequest.audio_mixer||''} | ${selectedRequest.audio_detail?.join(', ')||''}` : 'Tidak'}</p></div>
    <div class="field"><label>Wallplate Input</label><p>${selectedRequest.wallplate_input === 'Yes' ? `Ya — ${selectedRequest.wallplate_jumlah||''} unit` : 'Tidak'}</p></div>
    <div class="field"><label>Tabletop Input</label><p>${selectedRequest.tabletop_input === 'Yes' ? `Ya — ${selectedRequest.tabletop_jumlah||''} unit` : 'Tidak'}</p></div>
    <div class="field"><label>Wireless Presentation</label><p>${selectedRequest.wireless_presentation === 'Yes' ? `Ya — ${selectedRequest.wireless_mode?.join(', ')||''}, Dongle: ${selectedRequest.wireless_dongle}` : 'Tidak'}</p></div>
    <div class="field"><label>Controller / Automation</label><p>${selectedRequest.controller_automation === 'Yes' ? `Ya — ${selectedRequest.controller_type?.join(', ')||''}` : 'Tidak'}</p></div>
  </div>
</div>

<div class="section">
  <div class="section-title">📐 Ruangan & Keterangan</div>
  <div class="grid grid-2">
    <div class="field"><label>Ukuran Ruangan</label><p>${selectedRequest.ukuran_ruangan||'—'}</p></div>
    <div class="field"><label>Suggest Tampilan</label><p>${selectedRequest.suggest_tampilan||'—'}</p></div>
    ${selectedRequest.keterangan_lain ? `<div class="field" style="grid-column:span 2"><label>Keterangan Lain</label><p style="white-space:pre-wrap">${selectedRequest.keterangan_lain}</p></div>` : ''}
  </div>
</div>
<p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:16px">Request Design Project — IndoVisual Pratama · ${new Date().toLocaleDateString('id-ID')}</p>
</body></html>`;
      zipFiles.push({ name: `${folderName}/01_Form_Detail_${projectSlug}.html`, data: enc.encode(formHtml) });

      // ── 2-4. Download LATEST revision per structured category (SLD/BOQ/3D) + all general ────
      const structuredCats: { cat: 'sld' | 'boq' | 'design3d'; prefix: string }[] = [
        { cat: 'sld', prefix: '02_SLD' },
        { cat: 'boq', prefix: '03_BOQ' },
        { cat: 'design3d', prefix: '04_Design3D' },
      ];

      for (const { cat, prefix } of structuredCats) {
        // Sort by revision_version desc, take only the latest
        const catFiles = attachments
          .filter(a => a.attachment_category === cat)
          .sort((a, b) => (b.revision_version || 0) - (a.revision_version || 0));
        const latest = catFiles[0];
        if (!latest) continue;
        try {
          const resp = await fetch(latest.file_url);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            const revStr = latest.revision_version ? `_Rev${latest.revision_version}` : '';
            zipFiles.push({
              name: `${folderName}/${prefix}${revStr}_${latest.file_name}`,
              data: new Uint8Array(arrayBuf),
            });
          }
        } catch { /* skip inaccessible files */ }
      }

      // General files — download all
      const generalFiles = attachments.filter(a => a.attachment_category === 'general' || !a.attachment_category);
      for (let i = 0; i < generalFiles.length; i++) {
        const att = generalFiles[i];
        try {
          const resp = await fetch(att.file_url);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            zipFiles.push({
              name: `${folderName}/05_Files_${i + 1}_${att.file_name}`,
              data: new Uint8Array(arrayBuf),
            });
          }
        } catch { /* skip inaccessible files */ }
      }

      if (zipFiles.length === 0) {
        notify('info', 'Tidak ada file untuk di-download pada ticket ini.');
        setDownloadingPackage(false);
        return;
      }

      const zipBlob = buildZip(zipFiles);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('success', `✅ "${folderName}.zip" berhasil didownload! (${zipFiles.length} file)`);
    } catch (err) {
      console.error('Download package error:', err);
      notify('error', 'Gagal membuat paket download.');
    } finally {
      setDownloadingPackage(false);
    }
  };

  if (!appReady) return <LoadingScreen />;

  const detailSc = selectedRequest ? (statusConfig[selectedRequest.status] || statusConfig.pending) : null;
  const detailIsPending = selectedRequest?.status === 'pending';
  const detailDueStatus = selectedRequest ? getDueStatus(selectedRequest.due_date, selectedRequest.status) : null;
  const isFileType = (type: string) => type.startsWith('image/');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-cover bg-center bg-fixed bg-no-repeat" style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
      <NotifToast />


      {showNewFormModal && (
        <NewFormModal
          currentUser={currentUser}
          form={form}
          setForm={setForm}
          initialForm={initialForm}
          salesGuestUsers={salesGuestUsers}
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
          onClose={() => setAssignModal({ open: false, req: null })}
          onAssigned={() => {
            setAssignModal({ open: false, req: null });
            notify('success', `Request diapprove & di-assign ke Tim PTS!`);
            fetchRequests();
            if (selectedRequest?.id === assignModal.req?.id) {
              setSelectedRequest(prev => prev ? { ...prev, status: 'approved' } : null);
              fetchMessages(assignModal.req!.id);
            }
          }}
          currentUser={currentUser}
        />
      )}

      {/* STICKY HEADER */}
      <header className="sticky top-0 z-50 animate-slide-down anim-d0" style={{ background: 'rgba(255,255,255,0.95)', borderBottom: '3px solid #0d9488', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)', boxShadow: '0 3px 12px rgba(13,148,136,0.4)' }}>
              <span className="text-lg">🏗️</span>
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-800">Request Design Project</h1>
              <p className="text-[11px] text-gray-500 font-medium">IVP Product — AV Solution Request</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Bell notif — tiket pending/in_progress */}
            {(() => {
              const activeTickets = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
              if (activeTickets.length === 0) return null;
              return (
                <div className="relative">
                  <button
                    onClick={() => setBellDropdownOpen(o => !o)}
                    className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:bg-red-50"
                    style={{ border: '1.5px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.07)' }}>
                    <svg className="w-5 h-5 text-red-500 animate-[wiggle_1.5s_ease-in-out_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {activeTickets.length}
                    </span>
                  </button>
                  {bellDropdownOpen && (
                    <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-scale-in">
                      <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 flex items-center justify-between">
                        <p className="text-white text-xs font-bold">🔔 Tiket Aktif ({activeTickets.length})</p>
                        <button onClick={() => setBellDropdownOpen(false)} className="text-white/70 hover:text-white text-xs font-bold">✕</button>
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                        {activeTickets.map(req => {
                          const sc = statusConfig[req.status];
                          return (
                            <button key={req.id} onClick={() => { setBellDropdownOpen(false); handleOpenDetail(req); }}
                              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left">
                              <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-800 truncate">{req.project_name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{req.sales_name} · {req.assign_name || 'Unassigned'}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <button onClick={() => setShowNewFormModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)', boxShadow: '0 4px 14px rgba(13,148,136,0.4)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Buat Request
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-slide-up anim-d80">
          {[
            { label: 'Total', value: stats.total, sub: 'Semua request', gradient: 'linear-gradient(135deg,#4f46e5,#6d28d9)', shadow: 'rgba(79,70,229,0.35)', onClick: () => setFilterStatus('all'), active: filterStatus === 'all' },
            { label: 'Pending', value: stats.pending, sub: 'Menunggu approval', gradient: 'linear-gradient(135deg,#d97706,#b45309)', shadow: 'rgba(217,119,6,0.35)', onClick: () => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending'), active: filterStatus === 'pending' },
            { label: 'In Progress', value: stats.in_progress, sub: 'Sedang dikerjakan', gradient: 'linear-gradient(135deg,#2563eb,#1d4ed8)', shadow: 'rgba(37,99,235,0.35)', onClick: () => setFilterStatus(filterStatus === 'in_progress' ? 'all' : 'in_progress'), active: filterStatus === 'in_progress' },
            { label: 'Completed', value: stats.completed, sub: 'Selesai ditangani', gradient: 'linear-gradient(135deg,#059669,#047857)', shadow: 'rgba(5,150,105,0.35)', onClick: () => setFilterStatus(filterStatus === 'completed' ? 'all' : 'completed'), active: filterStatus === 'completed' },
            { label: 'Rejected', value: stats.rejected, sub: 'Ditolak', gradient: 'linear-gradient(135deg,#dc2626,#b91c1c)', shadow: 'rgba(220,38,38,0.35)', onClick: () => setFilterStatus(filterStatus === 'rejected' ? 'all' : 'rejected'), active: filterStatus === 'rejected' },
          ].map(card => (
            <div key={card.label} onClick={card.onClick}
              className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2 cursor-pointer transition-all hover:scale-[1.03] select-none"
              style={{ background: card.gradient, boxShadow: card.active ? `0 6px 24px ${card.shadow}` : `0 4px 16px ${card.shadow}`, outline: card.active ? '3px solid white' : 'none', transform: card.active ? 'scale(1.04)' : undefined }}>
              {card.active && <div className="absolute inset-0 rounded-2xl border-4 border-white/50 pointer-events-none" />}
              {card.active && <span className="absolute top-1 left-2 text-white/80 text-[9px] font-bold uppercase tracking-widest">Filter Aktif ✓</span>}
              <span className="text-3xl font-black text-white leading-none mt-3">{card.value}</span>
              <div>
                <p className="text-sm font-bold text-white leading-tight">{card.label}</p>
                <p className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.75)' }}>{card.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts - guest sees handler + product, PTS sees all 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-zoom-in anim-d160">
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
            </>
          ) : (
            <>
              <MiniPieChart data={statusPieData} title="Status Request Saya" icon="🥧" />
              <MiniPieChart data={assignedPieData} title="Team PTS Handler" icon="👥"
                activeFilter={filterHandler !== 'all' ? filterHandler : undefined}
                onSliceClick={label => setFilterHandler(prev => prev === label ? 'all' : label)} />
              <MiniPieChart data={productPieData} title="Product" icon="📦" />
            </>
          )}
        </div>

        

        {/* TICKET LIST — matching reference style */}
        <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>

          {/* Header with title + actions — same as reference */}
          <div className="flex flex-wrap items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ticket List</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{loading ? '…' : filteredRequests.length}</span>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {(isAdmin || isSuperAdmin) && (
                <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {selectMode ? '✕ Batal' : '☑ Select'}
                </button>
              )}
              <button onClick={fetchRequests} disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60" style={{ background: 'white' }}>
                <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Search + filter grid — labeled like reference */}
          <div className="px-6 py-3 border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Project / Lokasi</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search project / lokasi..."
                    className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Sales / Requester</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">👤</span>
                  <input value={searchSales} onChange={e => setSearchSales(e.target.value)}
                    placeholder="Search sales / requester..."
                    className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Handler</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">👥</span>
                  <select value={filterHandler} onChange={e => setFilterHandler(e.target.value)}
                    className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                    <option value="all">All Handlers</option>
                    {ptsMembersList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🏷️</span>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                    <option value="all">All Status</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="approved">✅ Approved</option>
                    <option value="in_progress">🔄 In Progress</option>
                    <option value="completed">🏆 Completed</option>
                    <option value="rejected">❌ Rejected</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Year</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">📅</span>
                  <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                    className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                    <option value="all">All Years</option>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Bulan</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🗓️</span>
                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-teal-300 appearance-none cursor-pointer">
                    <option value="all">All Months</option>
                    <option value="01">Januari</option>
                    <option value="02">Februari</option>
                    <option value="03">Maret</option>
                    <option value="04">April</option>
                    <option value="05">Mei</option>
                    <option value="06">Juni</option>
                    <option value="07">Juli</option>
                    <option value="08">Agustus</option>
                    <option value="09">September</option>
                    <option value="10">Oktober</option>
                    <option value="11">November</option>
                    <option value="12">Desember</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active filter chips — inside table */}
          {/* Bulk delete bar — admin only, selectMode only */}
          {selectMode && (isAdmin || isSuperAdmin) && selectedIds.size > 0 && (
            <div className="px-6 py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(13,148,136,0.07)' }}>
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

          {(filterStatus !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || filterHandler !== 'all' || filterDivision !== 'all' || searchQuery || searchSales) && (
            <div className="px-6 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
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
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>Search: {searchQuery} ✕</button>
              )}
              {searchSales && (
                <button onClick={() => setSearchSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>Sales: {searchSales} ✕</button>
              )}
              <button onClick={() => { 
                setFilterStatus('all'); setFilterYear('all'); setFilterMonth('all'); 
                setFilterHandler('all'); setFilterDivision('all'); setSearchQuery(''); setSearchSales('');
                try { ['frp_filterStatus','frp_filterYear','frp_filterMonth','frp_filterHandler','frp_filterDivision','frp_searchQuery','frp_searchSales'].forEach(k => sessionStorage.removeItem(k)); } catch {}
              }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>🗑️ Reset Semua</button>
            </div>
          )}
          {loading ? (
            <div className="space-y-3 py-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-4 border border-gray-200">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/5" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 rounded w-1/5" />
                  <div className="h-6 bg-gray-200 rounded-full w-20" />
                  <div className="h-8 bg-gray-200 rounded-lg w-16" />
                </div>
              ))}
              <div className="flex items-center justify-center gap-3 py-4 text-gray-500">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
                <span className="text-sm font-medium">Memuat data...</span>
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-600 font-medium">{searchQuery || searchSales || filterStatus !== 'all' ? 'Tidak ada request yang sesuai filter.'
                    : isIVPGuest
                      ? 'Belum ada request yang di-assign ke akun kamu. Admin akan menghubungkan request dari sales external ke akun IVP kamu saat ada project baru.'
                      : 'Belum ada request.'}</p>
              {!isPTS && <button onClick={() => setShowNewFormModal(true)} className="mt-4 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition-all shadow-md">+ Buat Request Pertama</button>}
            </div>
          ) : (
            <div className="overflow-x-auto animate-zoom-in">
              <table className="w-full border-collapse table-fixed table-zebra" style={{ background: 'transparent', minWidth: '900px' }}>
                <colgroup>
                  <col style={{ width: '56px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '155px' }} />
                  <col style={{ width: '105px' }} />
                  <col style={{ width: '105px' }} />
                  <col style={{ width: '105px' }} />
                  <col style={{ width: '80px' }} />  {/* DueDate lebih sempit */}
                  <col style={{ width: '80px' }} />  {/* CreatedBy lebih sempit */}
                  <col style={{ width: '140px' }} /> {/* Action lebih lebar */}
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-gray-300" style={{ background: 'rgba(255,255,255,0.97)' }}>
                    <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                      {selectMode && (isAdmin || isSuperAdmin)
                        ? <input type="checkbox"
                            checked={selectedIds.size === filteredRequests.length && filteredRequests.length > 0}
                            onChange={toggleSelectAll} className="w-4 h-4 rounded accent-teal-600 cursor-pointer" title="Pilih Semua" />
                        : 'ID'}
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Nama Project</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Ruangan / Solution</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Sales</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Handler</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Due Date</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">Created By</th>
                    <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => {
                    const sc = statusConfig[req.status] || statusConfig.pending;
                    const unread = unreadMsgMap[req.id] || 0;
                    const dueStatus = getDueStatus(req.due_date, req.status);
                    const isToday = req.due_date === new Date().toISOString().split('T')[0];
                    return (
                      <tr key={req.id}
                        className="stagger-item border-b border-gray-200 hover:bg-gray-50 transition-colors"
                        style={{ borderLeft: isToday ? '3px solid #0d9488' : '3px solid transparent' }}>
                        <td className="px-2 py-3 border-r border-gray-200 align-middle text-center" onClick={e => e.stopPropagation()}>
                          {selectMode && (isAdmin || isSuperAdmin)
                            ? <input type="checkbox" checked={selectedIds.has(req.id)}
                                onChange={() => toggleSelectId(req.id)} className="w-4 h-4 rounded accent-teal-600 cursor-pointer" />
                            : (
                              <span className="text-xs font-bold text-gray-500">
                                {index + 1}
                              </span>
                            )}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-200 align-middle max-w-0">
                          <div className="flex items-start gap-1.5">
                            {unread > 0 && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse mt-1" />}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-gray-800 text-sm leading-tight truncate" title={req.project_name}>{req.project_name}</div>
                              {req.project_location && (
                                <div className="text-xs text-gray-500 leading-tight mt-0.5 line-clamp-2 break-words" title={req.project_location}>{req.project_location}</div>
                              )}
                              {unread > 0 && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">+{unread} pesan</span>}
                              <div className="text-xs text-gray-400 mt-0.5">{new Date(req.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>                             
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 border-r border-gray-200 align-middle max-w-0">
                          <div className="text-sm text-gray-700 leading-tight truncate" title={Array.isArray(req.solution_product) ? req.solution_product.join(', ') : req.solution_product}>{Array.isArray(req.solution_product) ? req.solution_product.join(', ') : (req.solution_product || <span className="text-gray-300">—</span>)}</div>
                          {req.room_name && <div className="text-xs text-teal-600 font-medium mt-0.5 truncate">🛋️ {req.room_name}</div>}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 align-middle">
                          <div className="text-sm font-semibold text-gray-700 leading-tight">{req.sales_name || <span className="text-gray-300">—</span>}</div>
                          {req.sales_division && <div className="text-xs text-purple-600 font-semibold mt-0.5">{req.sales_division}</div>}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 align-middle">
                          {req.assign_name ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {req.assign_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-xs font-semibold text-gray-700 leading-tight">{req.assign_name}</div>
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 align-middle">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 text-xs font-bold border whitespace-nowrap ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
                            {req.status === 'pending' && isPTS && !isTeamPTS && <p className="text-[9px] font-bold text-red-500 animate-pulse">🔔 Perlu Approval</p>}
                          </div>
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 align-middle">
                          {req.due_date ? (
                            <>
                              <div className="text-xs font-semibold text-gray-700">{formatDueDate(req.due_date)}</div>
                              {dueStatus && (
                                <div className={`text-[10px] font-bold mt-0.5 ${dueStatus.type === 'overdue' ? 'text-red-500' : dueStatus.type === 'urgent' ? 'text-amber-500' : 'text-teal-500'}`}>
                                  🎯 {dueStatus.label}
                                </div>
                              )}
                            </>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 align-middle">
                          <div className="text-[11px] font-semibold text-gray-800 leading-tight">{req.requester_name}</div>
                          {/* IVP guest: badge for external requests linked by admin */}
                          {isIVPGuest && req.ivp_assignee === currentUser.full_name && req.requester_id !== currentUser.id && (
                            <div className="text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                              🔗 Ext: {req.sales_division}
                            </div>
                          )}
                          {/* IVP guest: badge for own requests */}
                          {isIVPGuest && req.requester_id === currentUser.id && (
                            <div className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                              📋 Request Saya
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 align-middle text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Approve/Reject: admin/superadmin saja */}
                            {(isAdmin || isSuperAdmin) && req.status === 'pending' && (
                              <>
                                <button onClick={() => handleApprove(req)} title="Approve"
                                  className="w-7 h-7 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-200 rounded-lg flex items-center justify-center transition-all">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button onClick={() => handleReject(req)} title="Tolak"
                                  className="w-7 h-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </>
                            )}
                            {/* Start In Progress: hanya PTS yang di-assign */}
                            {isTeamPTS && req.status === 'approved' && req.assign_name === currentUser.full_name && (
                              <button onClick={() => handleStatusUpdate(req, 'in_progress')} title="Mulai In Progress"
                                className="w-7 h-7 bg-blue-50 hover:bg-blue-500 text-blue-600 hover:text-white border border-blue-200 rounded-lg flex items-center justify-center transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              </button>
                            )}
                            <ViewIconBtn onClick={() => handleOpenDetail(req)} label="Detail" />
                            {(isSuperAdmin || isAdmin) && (
                              <DeleteIconBtn onClick={() => { setDeleteModal({ open: true, req }); setDeleteConfirmText(''); }} label="Hapus" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200" style={{ background: 'rgba(255,255,255,0.97)' }}>
                <span className="text-xs text-gray-400">{filteredRequests.length} request ditemukan</span>
                <span className="text-xs text-gray-400">{filteredRequests.length > 0 ? `1–${filteredRequests.length}` : '0'} of {requests.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Delete Confirm Modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">🗑️</span>
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
                  🗑️ Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && rejectModal.req && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white/90 rounded-2xl shadow-2xl max-w-md w-full border-2 border-red-400 animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-700 px-6 py-4">
              <h3 className="font-bold text-white text-lg">❌ Tolak Request</h3>
              <p className="text-red-100 text-xs mt-0.5">{rejectModal.req.project_name}</p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Alasan penolakan (opsional):</label>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Tuliskan alasan penolakan..."
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-red-400 transition-all outline-none resize-none mb-4" />
              <div className="flex gap-3">
                <button onClick={() => setRejectModal({ open: false, req: null })} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">Batal</button>
                <button onClick={handleRejectConfirm} className="flex-[2] bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white py-3 rounded-xl font-bold shadow-lg transition-all">❌ Ya, Tolak</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusUpdateModal.open && statusUpdateModal.req && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white/90 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-200 animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Update Status
                </h3>
                <p className="text-blue-100 text-xs mt-0.5 truncate">{statusUpdateModal.req.project_name}</p>
              </div>
              <button onClick={() => setStatusUpdateModal({ open: false, req: null })} className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all">✕</button>
            </div>
            <div className="p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Pilih Status Baru</p>
              <div className="space-y-2 mb-5">
                {[
                  { value: 'pending', label: '⏳ Pending', color: 'border-amber-300 bg-amber-50 text-amber-700', active: 'border-amber-500 bg-amber-100' },
                  { value: 'in_progress', label: '🔄 In Progress', color: 'border-blue-300 bg-blue-50 text-blue-700', active: 'border-blue-500 bg-blue-100' },
                  { value: 'completed', label: '🏆 Completed', color: 'border-purple-300 bg-purple-50 text-purple-700', active: 'border-purple-500 bg-purple-100' },
                  // rejected hanya untuk admin/superadmin
                  ...(isAdmin || isSuperAdmin ? [
                    { value: 'approved', label: '✅ Approved', color: 'border-teal-300 bg-teal-50 text-teal-700', active: 'border-teal-500 bg-teal-100' },
                    { value: 'rejected', label: '❌ Rejected', color: 'border-red-300 bg-red-50 text-red-700', active: 'border-red-500 bg-red-100' },
                  ] : []),
                ].filter(s => {
                  if (s.value === statusUpdateModal.req!.status) return false;
                  // in_progress hanya bisa diset oleh PTS yang di-assign (atau admin)
                  if (s.value === 'in_progress' && !canSetInProgress(statusUpdateModal.req!)) return false;
                  // completed hanya admin/superadmin atau assigned PTS
                  if (s.value === 'completed' && isTeamPTS && statusUpdateModal.req!.assign_name !== currentUser.full_name) return false;
                  return true;
                }).map(s => (
                  <button key={s.value} type="button" onClick={() => setSelectedNewStatus(s.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all font-semibold text-sm ${selectedNewStatus === s.value ? s.active + ' shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedNewStatus === s.value ? 'border-current' : 'border-gray-300'}`}>
                      {selectedNewStatus === s.value && <div className="w-2 h-2 rounded-full bg-current" />}
                    </div>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStatusUpdateModal({ open: false, req: null })} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
                <button
                  disabled={!selectedNewStatus}
                  onClick={async () => {
                    if (!selectedNewStatus || !statusUpdateModal.req) return;
                    await handleStatusUpdate(statusUpdateModal.req, selectedNewStatus);
                    setStatusUpdateModal({ open: false, req: null });
                    setSelectedNewStatus('');
                  }}
                  className="flex-[2] bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white py-2.5 rounded-xl font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.req && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white/90 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base">Hapus Ticket</h3>
                  <p className="text-sm text-gray-500 mt-0.5 font-medium truncate">{deleteModal.req.project_name}</p>
                  <p className="text-xs text-gray-400 truncate">{deleteModal.req.requester_name}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5 mb-5">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <p className="text-xs font-semibold text-amber-700">Tindakan ini tidak dapat dibatalkan. Ticket beserta seluruh activity log dan overdue setting akan dihapus permanen dari database.</p>
              </div>
              <div className="mb-4">
                <p className="text-sm font-bold text-gray-700 mb-2">Ketik <span className="text-red-500 font-black tracking-widest">HAPUS</span> untuk konfirmasi</p>
                <input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS di sini..."
                  autoFocus
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder-gray-300"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteConfirm()}
                  disabled={deleteConfirmText !== 'HAPUS' || deleting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: deleteConfirmText === 'HAPUS' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : '#e5e7eb', color: deleteConfirmText === 'HAPUS' ? 'white' : '#9ca3af' }}>
                  {deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menghapus...</> : <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Hapus Permanen
                  </>}
                </button>
                <button onClick={() => { setDeleteModal({ open: false, req: null }); setDeleteConfirmText(''); }} disabled={deleting}
                  className="px-5 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50 border border-gray-200">
                  × Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-in { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        @keyframes slide-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes wiggle { 0%,100%{transform:rotate(0deg)} 15%{transform:rotate(-15deg)} 30%{transform:rotate(15deg)} 45%{transform:rotate(-10deg)} 60%{transform:rotate(10deg)} 75%{transform:rotate(-5deg)} 90%{transform:rotate(5deg)} }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        select option { background: #ffffff; color: #1e293b; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(13,148,136,0.25); border-radius: 4px; }
      `}</style>

      {/* POPUP TIKET AKTIF — muncul sekali saat masuk platform, hilang kalau semua completed */}
      {showTicketPopup && (() => {
        const activeTickets = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
        if (activeTickets.length === 0) return null;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9996] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border-2 border-amber-400">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Tiket Memerlukan Perhatian</h3>
                    <p className="text-amber-100 text-xs">{activeTickets.length} tiket masih aktif</p>
                  </div>
                </div>
                <button onClick={() => setShowTicketPopup(false)} className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold">✕</button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {activeTickets.map(req => {
                  const sc = statusConfig[req.status];
                  return (
                    <button key={req.id}
                      onClick={() => { setShowTicketPopup(false); handleOpenDetail(req); }}
                      className="w-full flex items-start gap-3 px-5 py-4 hover:bg-amber-50 transition-all text-left">
                      <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{req.project_name}</p>
                        <p className="text-xs text-gray-400 truncate">{req.sales_name}{req.assign_name ? ` · ${req.assign_name}` : ''}</p>
                        {req.due_date && <p className="text-[10px] text-amber-600 font-semibold mt-0.5">📅 {formatDueDate(req.due_date)}</p>}
                      </div>
                      <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  );
                })}
              </div>
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                <button onClick={() => setShowTicketPopup(false)}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all">
                  Tutup & Lihat Nanti
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedRequest && detailSc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9990] p-0"
          onClick={e => { if (e.target === e.currentTarget) handleCloseDetail(); }}>
          <div className="bg-white/90 w-full h-full animate-slide-up flex flex-col overflow-hidden"
            style={{ border: 'none' }}>

            {/* Detail Modal Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-900 px-5 py-4 flex items-center gap-4 flex-shrink-0">
              <button onClick={handleCloseDetail}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-all flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-bold text-white truncate">{selectedRequest.project_name}</h2>
                  {selectedRequest.assign_name && <span className="bg-white/20 text-white px-2.5 py-1 rounded-full text-xs font-bold border border-white/30">{selectedRequest.assign_name}</span>}
				  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${detailSc.color} text-white`}>Status : {detailSc.label}</span>
                </div>
                <p className="text-teal-100 text-xs mt-0.5 truncate">
                  {selectedRequest.room_name && `${selectedRequest.room_name} · `}
                  {selectedRequest.project_location && `📍 ${selectedRequest.project_location} · `}
                  {selectedRequest.requester_name} · {selectedRequest.sales_division || ''} · {formatDate(selectedRequest.created_at)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0 flex-wrap">
                {/* Approve/Tolak: hanya admin/superadmin */}
                {(isAdmin || isSuperAdmin) && detailIsPending && (
                  <>
                    <button onClick={() => { setAssignModal({ open: true, req: selectedRequest }); }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Approve & Assign PTS
                    </button>
                    <button onClick={() => handleReject(selectedRequest)}
                      className="bg-white/20 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      Tolak
                    </button>
                  </>
                )}
                {/* Info untuk PTS yang di-assign: tombol mulai in_progress */}
                {isTeamPTS && selectedRequest?.status === 'approved' && selectedRequest?.assign_name === currentUser.full_name && (
                  <button onClick={() => handleStatusUpdate(selectedRequest, 'in_progress')}
                    className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Mulai In Progress
                  </button>
                )}
                {/* Status update: admin/superadmin atau PTS yang di-assign */}
                {isPTS && !detailIsPending && (isAdmin || isSuperAdmin || selectedRequest?.assign_name === currentUser.full_name) && (
                  <button onClick={() => { setSelectedNewStatus(''); setStatusUpdateModal({ open: true, req: selectedRequest }); }}
                    className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Update Status
                  </button>
                )}
                {!isPTS && selectedRequest.status !== 'rejected' && (
                  <button onClick={handleOpenEditForm}
                    className="bg-amber-400 hover:bg-amber-300 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </button>
                )}
                {(isSuperAdmin || isAdmin) && (
                  <button onClick={() => { setDeleteModal({ open: true, req: selectedRequest }); setDeleteConfirmText(''); }}
                    className="bg-white/10 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Hapus
                  </button>
                )}
                <button onClick={handleDownloadPackage} disabled={downloadingPackage}
                  className="bg-white/20 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5 disabled:opacity-60">
                  {downloadingPackage ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  {downloadingPackage ? 'Menyiapkan...' : 'Download .zip'}
                </button>
                <button onClick={handlePrint}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print
                </button>
              </div>
            </div>

            {/* Warning: non-IVP guest has no sales_division */}
            {isNonIVPGuest && !currentUser.sales_division && (
              <div className="mx-4 my-2 px-4 py-3 rounded-xl flex items-center gap-3 border-2 border-amber-300" style={{ background: 'rgba(254,243,199,0.9)' }}>
                <span className="text-2xl flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-amber-800">Sales Division belum diset di akun kamu!</p>
                  <p className="text-xs text-amber-700 mt-0.5">Hubungi admin untuk set <strong>Sales Division</strong> di profil akunmu. Tanpa ini, request tidak bisa di-link ke IVP Sales internal.</p>
                </div>
              </div>
            )}

            {/* IVP Guest info banner */}
            {isIVPGuest && selectedRequest.ivp_assignee === currentUser.full_name && selectedRequest.requester_id !== currentUser.id && (
              <div className="px-5 py-2 flex items-center gap-2 text-xs flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.10)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
                <span>🔗</span>
                <span className="text-indigo-700 font-semibold">
                  Anda di-assign sebagai <strong>IVP Sales Internal</strong> untuk request dari divisi eksternal
                  <strong> {selectedRequest.sales_division}</strong>. Anda dapat ikut chat dan memantau progress.
                </span>
              </div>
            )}

            {/* Detail Modal Body — 2 columns: LEFT (info + attachments) | RIGHT (chat) */}
            {/* Mobile: tab switcher to toggle between Info and Chat panels */}
            <div className="flex sm:hidden border-b border-gray-200 bg-white flex-shrink-0">
              <button onClick={() => setDetailMobileTab('info')}
                className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${detailMobileTab === 'info' ? 'text-teal-700 border-teal-600' : 'text-gray-400 border-transparent'}`}>
                📋 Info Project
              </button>
              <button onClick={() => setDetailMobileTab('chat')}
                className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${detailMobileTab === 'chat' ? 'text-teal-700 border-teal-600' : 'text-gray-400 border-transparent'}`}>
                💬 Chat
              </button>
            </div>
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">

              {/* LEFT: Detail Info + Attachments */}
              <div className={`${detailMobileTab === 'info' ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-col flex-[3] min-w-0 border-r border-gray-200 overflow-y-auto bg-gray-50`}>
                <div className="p-5 space-y-5">

                  {/* Assigned PTS — "in_progress" nudge */}
                  {isTeamPTS && selectedRequest.status === 'approved' && selectedRequest.assign_name === currentUser.full_name && (
                    <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)' }}>
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-blue-700">Request ini di-assign ke kamu</p>
                        <p className="text-xs text-blue-600 mt-0.5">Klik <strong>Mulai In Progress</strong> di atas untuk memulai pengerjaan. Setelah in progress, kamu dapat update status dan berkomunikasi via chat.</p>
                      </div>
                    </div>
                  )}

                  {/* Room Tab Navigator — tampil jika ada lebih dari 1 ruangan */}
                  {(() => {
                    const detailRooms = selectedRequest.rooms || [];
                    const totalDetailRooms = 1 + detailRooms.length;
                    if (totalDetailRooms <= 1) return null;
                    return (
                      <div className="flex items-center bg-teal-50 border border-teal-200 rounded-2xl px-2 py-1.5 gap-1 overflow-x-auto">
                        <button type="button" onClick={() => setDetailRoomIdx(i => Math.max(0, i-1))} disabled={detailRoomIdx === 0}
                          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-100 disabled:opacity-30 transition-all flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        {Array.from({length: totalDetailRooms}).map((_, i) => {
                          const label = i === 0 ? (selectedRequest.room_name?.trim() || 'Ruangan 1') : (detailRooms[i-1]?.room_name?.trim() || `Ruangan ${i+1}`);
                          return (
                            <button key={i} type="button" onClick={() => setDetailRoomIdx(i)}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${detailRoomIdx === i ? 'bg-teal-600 text-white shadow' : 'text-teal-700 hover:bg-teal-100'}`}>
                              {label}
                            </button>
                          );
                        })}
                        <button type="button" onClick={() => setDetailRoomIdx(i => Math.min(totalDetailRooms-1, i+1))} disabled={detailRoomIdx === totalDetailRooms-1}
                          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-100 disabled:opacity-30 transition-all flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
                        </button>
                        <span className="text-[10px] text-teal-600 font-bold ml-auto mr-1">{detailRoomIdx+1}/{totalDetailRooms}</span>
                      </div>
                    );
                  })()}

                  {/* Compute active room data for display */}
                  {(() => {
                    const detailRooms = selectedRequest.rooms || [];
                    // For detailRoomIdx > 0, use rooms[detailRoomIdx-1]; for 0 use selectedRequest fields
                    const activeRoom = detailRoomIdx > 0 ? detailRooms[detailRoomIdx - 1] : null;
                    const dr = activeRoom ? {
                      room_name: activeRoom.room_name,
                      kebutuhan: activeRoom.kebutuhan, kebutuhan_other: activeRoom.kebutuhan_other,
                      solution_product: activeRoom.solution_product, solution_other: activeRoom.solution_other,
                      layout_signage: activeRoom.layout_signage, jaringan_cms: activeRoom.jaringan_cms,
                      jumlah_input: activeRoom.jumlah_input, jumlah_output: activeRoom.jumlah_output,
                      source: activeRoom.source, source_other: activeRoom.source_other,
                      camera_conference: activeRoom.camera_conference, camera_jumlah: activeRoom.camera_jumlah, camera_tracking: activeRoom.camera_tracking,
                      audio_system: activeRoom.audio_system, audio_mixer: activeRoom.audio_mixer, audio_detail: activeRoom.audio_detail,
                      wallplate_input: activeRoom.wallplate_input, wallplate_jumlah: activeRoom.wallplate_jumlah,
                      tabletop_input: activeRoom.tabletop_input, tabletop_jumlah: activeRoom.tabletop_jumlah,
                      wireless_presentation: activeRoom.wireless_presentation, wireless_mode: activeRoom.wireless_mode, wireless_dongle: activeRoom.wireless_dongle,
                      controller_automation: activeRoom.controller_automation, controller_type: activeRoom.controller_type,
                      ukuran_ruangan: activeRoom.ukuran_ruangan, suggest_tampilan: activeRoom.suggest_tampilan, keterangan_lain: activeRoom.keterangan_lain,
                      brand_display: activeRoom.brand_display, brand_display_pic_name: activeRoom.brand_display_pic_name,
                      brand_middleware: activeRoom.brand_middleware, brand_middleware_pic_name: activeRoom.brand_middleware_pic_name,
                    } : {
                      room_name: selectedRequest.room_name,
                      kebutuhan: selectedRequest.kebutuhan, kebutuhan_other: selectedRequest.kebutuhan_other,
                      solution_product: selectedRequest.solution_product, solution_other: selectedRequest.solution_other,
                      layout_signage: selectedRequest.layout_signage, jaringan_cms: selectedRequest.jaringan_cms,
                      jumlah_input: selectedRequest.jumlah_input, jumlah_output: selectedRequest.jumlah_output,
                      source: selectedRequest.source, source_other: selectedRequest.source_other,
                      camera_conference: selectedRequest.camera_conference, camera_jumlah: selectedRequest.camera_jumlah, camera_tracking: selectedRequest.camera_tracking,
                      audio_system: selectedRequest.audio_system, audio_mixer: selectedRequest.audio_mixer, audio_detail: selectedRequest.audio_detail,
                      wallplate_input: selectedRequest.wallplate_input, wallplate_jumlah: selectedRequest.wallplate_jumlah,
                      tabletop_input: selectedRequest.tabletop_input, tabletop_jumlah: selectedRequest.tabletop_jumlah,
                      wireless_presentation: selectedRequest.wireless_presentation, wireless_mode: selectedRequest.wireless_mode, wireless_dongle: selectedRequest.wireless_dongle,
                      controller_automation: selectedRequest.controller_automation, controller_type: selectedRequest.controller_type,
                      ukuran_ruangan: selectedRequest.ukuran_ruangan, suggest_tampilan: selectedRequest.suggest_tampilan, keterangan_lain: selectedRequest.keterangan_lain,
                      brand_display: selectedRequest.brand_display, brand_display_pic_name: selectedRequest.brand_display_pic_name,
                      brand_middleware: selectedRequest.brand_middleware, brand_middleware_pic_name: selectedRequest.brand_middleware_pic_name,
                    };

                    // Helper renderers for detail display
                    const ChipDisplay = ({ items }: { items: (string | undefined)[] }) => {
                      const filtered = items.filter(Boolean) as string[];
                      if (!filtered.length) return <span className="text-sm text-gray-400 italic">—</span>;
                      return <div className="flex flex-wrap gap-2">{filtered.map(item => (
                        <span key={item} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-teal-500 bg-teal-50 text-teal-700 text-sm font-medium">
                          <div className="w-4 h-4 rounded border-2 border-teal-500 bg-teal-500 flex items-center justify-center flex-shrink-0"><svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>
                          {item}
                        </span>
                      ))}</div>;
                    };
                    const YNDisplay = ({ value, label }: { value: string; label: string }) => (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{label}</label>
                        <div className="flex flex-wrap gap-2 mb-2">{['Yes','No'].map(opt => (<span key={opt} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-medium ${value === opt ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-500'}`}><div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-teal-500' : 'border-gray-400'}`}>{value === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>{opt}</span>))}</div>
                      </div>
                    );

                    return (<>
                  {/* Project Info — form style */}
                  <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">📁</span>
                      Informasi Project
                    </h3>
                    <div className="space-y-4">
                      {/* Nama Project — full width */}
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Project</label>
                        <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{selectedRequest.project_name}</p>
                      </div>
                      {/* Lokasi Project — full width, tepat di bawah Nama Project */}
                      {selectedRequest.project_location && (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Lokasi Project</label>
                          <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-words whitespace-pre-wrap">{selectedRequest.project_location}</p>
                        </div>
                      )}
                      {/* Row: Nama Ruangan, Sales/Account */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        {dr.room_name && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Ruangan</label>
                            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.room_name}</p>
                          </div>
                        )}
                        {selectedRequest.sales_name && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sales / Account</label>
                            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{selectedRequest.sales_name}</p>
                          </div>
                        )}
                        {selectedRequest.sales_division && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Divisi Sales</label>
                            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{selectedRequest.sales_division}</p>
                          </div>
                        )}
                        {selectedRequest.requester_name && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Requester</label>
                            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{selectedRequest.requester_name}</p>
                          </div>
                        )}
                        {selectedRequest.assign_name && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">PTS Handler</label>
                            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">🔧 {selectedRequest.assign_name}</p>
                          </div>
                        )}
                        {selectedRequest.due_date && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Target Selesai</label>
                            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">📅 {formatDueDate(selectedRequest.due_date)}{detailDueStatus ? ` (${detailDueStatus.label})` : ''}</p>
                          </div>
                        )}
                        {detailSc?.label && (
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Status</label>
                            <p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{detailSc.label}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Kategori & Solution — form style */}
                  <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">🎯</span>
                      Kategori Kebutuhan & Solution
                    </h3>
                    <div className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kebutuhan</label><ChipDisplay items={[...(dr.kebutuhan||[]), dr.kebutuhan_other]} /></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Solution Product</label><ChipDisplay items={[...(dr.solution_product||[]), dr.solution_other]} /></div>
                      {dr.brand_display && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">🖥️ Brand Display</label><p className="text-sm font-semibold text-gray-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{dr.brand_display}{dr.brand_display_pic_name && <span className="text-[11px] text-amber-600 ml-2">· PIC: {dr.brand_display_pic_name}</span>}</p></div>
                        {dr.brand_middleware && <div><label className="block text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1">🔌 Brand Middleware</label><p className="text-sm font-semibold text-gray-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">{dr.brand_middleware}{dr.brand_middleware_pic_name && <span className="text-[11px] text-violet-600 ml-2">· PIC: {dr.brand_middleware_pic_name}</span>}</p></div>}
                      </div>}
                    </div>
                  </div>

                  {/* Layout Konten & Jaringan — form style */}
                  <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">📺</span>
                      Layout Konten & Jaringan
                    </h3>
                    <div className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Layout Signage</label><ChipDisplay items={dr.layout_signage||[]} /></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Jaringan / CMS</label><ChipDisplay items={dr.jaringan_cms||[]} /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.jumlah_input||'—'}</p></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.jumlah_output||'—'}</p></div>
                      </div>
                    </div>
                  </div>

                  {/* Source & Peripheral — form style */}
                  <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">🔌</span>
                      Source & Peripheral
                    </h3>
                    <div className="space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Source</label><ChipDisplay items={[...(dr.source||[]), dr.source_other]} /></div>

                      {/* Camera */}
                      <div>
                        <YNDisplay value={dr.camera_conference||'No'} label="Camera Conference" />
                        {dr.camera_conference === 'Yes' && (
                          <div className="ml-4 pl-4 border-l-2 border-teal-200 space-y-2 mt-2">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.camera_jumlah||'—'}</p></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Camera Tracking</label><ChipDisplay items={dr.camera_tracking||[]} /></div>
                          </div>
                        )}
                      </div>

                      {/* Audio */}
                      <div>
                        <YNDisplay value={dr.audio_system||'No'} label="Audio System" />
                        {dr.audio_system === 'Yes' && (
                          <div className="ml-4 pl-4 border-l-2 border-teal-200 space-y-2 mt-2">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.audio_mixer||'—'}</p></div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Audio Detail</label><ChipDisplay items={dr.audio_detail||[]} /></div>
                          </div>
                        )}
                      </div>

                      {/* Wallplate + Tabletop — 2 col */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <YNDisplay value={dr.wallplate_input||'No'} label="Wallplate Input" />
                          {dr.wallplate_input === 'Yes' && <div className="ml-4 pl-4 border-l-2 border-teal-200 mt-1"><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.wallplate_jumlah||'—'}</p></div>}
                        </div>
                        <div>
                          <YNDisplay value={dr.tabletop_input||'No'} label="Tabletop Input" />
                          {dr.tabletop_input === 'Yes' && <div className="ml-4 pl-4 border-l-2 border-teal-200 mt-1"><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.tabletop_jumlah||'—'}</p></div>}
                        </div>
                      </div>

                      {/* Wireless */}
                      <div>
                        <YNDisplay value={dr.wireless_presentation||'No'} label="Wireless Presentation" />
                        {dr.wireless_presentation === 'Yes' && (
                          <div className="ml-4 pl-4 border-l-2 border-teal-200 space-y-2 mt-2">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Wireless Mode</label><ChipDisplay items={dr.wireless_mode||[]} /></div>
                            <div><YNDisplay value={dr.wireless_dongle||'No'} label="Dongle" /></div>
                          </div>
                        )}
                      </div>

                      {/* Controller */}
                      <div>
                        <YNDisplay value={dr.controller_automation||'No'} label="Controller / Automation" />
                        {dr.controller_automation === 'Yes' && (
                          <div className="ml-4 pl-4 border-l-2 border-teal-200 mt-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Controller Type</label><ChipDisplay items={dr.controller_type||[]} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ruangan & Keterangan — form style */}
                  <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">📐</span>
                      Ruangan & Informasi Lainnya
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P × L × T)</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.ukuran_ruangan||'—'}</p></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W × H)</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.suggest_tampilan||'—'}</p></div>
                      </div>
                      {dr.keterangan_lain && <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap">{dr.keterangan_lain}</p></div>}
                    </div>
                  </div>
                  </>);
                  })()}

                  {/* Attachments Panel — prominent */}
                  <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">📎</span>
                        Dokumen & File Attachment
                      </h3>
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                        className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 disabled:opacity-60">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        {uploadingFile ? 'Uploading...' : 'Upload File'}
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
                    <input ref={sldFileRef} type="file" className="hidden" accept=".pdf"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCategoryUpload(f, 'sld'); e.target.value = ''; }} />
                    <input ref={boqFileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCategoryUpload(f, 'boq'); e.target.value = ''; }} />
                    <input ref={design3dFileRef} type="file" className="hidden" accept=".pdf,.dwg,.skp"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCategoryUpload(f, 'design3d'); e.target.value = ''; }} />

                    {isPTS && selectedRequest.status !== 'pending' && selectedRequest.status !== 'rejected' && (
                      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest self-center">Upload Dokumen:</p>
                        {[
                          { cat: 'sld' as const, ref: sldFileRef, label: '📐 SLD (PDF)', cls: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
                          { cat: 'boq' as const, ref: boqFileRef, label: '📊 BOQ (Excel)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
                          { cat: 'design3d' as const, ref: design3dFileRef, label: '🎨 Design 3D', cls: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
                        ].map(({ cat, ref, label, cls }) => (
                          <button key={cat} onClick={() => ref.current?.click()} disabled={uploadingCategory === cat}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${cls}`}>
                            {uploadingCategory === cat ? '⏳ Uploading...' : label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-4">
                      {(['all', 'sld', 'boq', 'design3d'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveAttachTab(tab)}
                          className={`flex-1 py-2 text-xs font-bold uppercase transition-all ${activeAttachTab === tab ? 'text-white bg-teal-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                          {tab === 'all' ? `Semua (${attachments.length})` : tab === 'design3d' ? `3D (${attachments.filter(a => a.attachment_category === 'design3d').length})` : `${tab.toUpperCase()} (${attachments.filter(a => a.attachment_category === tab).length})`}
                        </button>
                      ))}
                    </div>

                    {/* File grid */}
                    {(activeAttachTab === 'all' ? attachments : attachments.filter(a => a.attachment_category === activeAttachTab)).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-3xl mb-2">📂</div>
                        <p className="text-xs font-medium">Belum ada file diupload</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* For structured categories: show LATEST prominently, history collapsed */}
                        {(['sld','boq','design3d'] as const).filter(cat =>
                          (activeAttachTab === 'all' || activeAttachTab === cat) &&
                          attachments.some(a => a.attachment_category === cat)
                        ).map(cat => {
                          const catFiles = [...attachments.filter(a => a.attachment_category === cat)]
                            .sort((a, b) => (b.revision_version || 0) - (a.revision_version || 0));
                          const latest = catFiles[0];
                          const history = catFiles.slice(1);
                          const catLabel = cat === 'sld' ? 'SLD' : cat === 'boq' ? 'BOQ' : 'Design 3D';
                          const catColor = cat === 'sld' ? 'blue' : cat === 'boq' ? 'emerald' : 'purple';
                          return (
                            <div key={cat} className={`rounded-xl border-2 overflow-hidden border-${catColor}-200`}>
                              <div className={`px-3 py-1.5 flex items-center justify-between bg-${catColor}-50`}>
                                <span className={`text-[10px] font-bold text-${catColor}-700 uppercase tracking-widest`}>{catLabel} — Versi Terbaru</span>
                                {history.length > 0 && <span className={`text-[9px] font-bold text-${catColor}-500`}>{history.length} versi lama</span>}
                              </div>
                              {/* Latest */}
                              <a href={latest.file_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 hover:bg-teal-50 transition-all cursor-pointer border-b border-gray-100">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl bg-${catColor}-100`}>
                                  {latest.file_type?.includes('pdf') ? '📄' : latest.file_type?.startsWith('image') ? '🖼️' : '📊'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-gray-800 truncate">{latest.file_name}</p>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-${catColor}-500 text-white whitespace-nowrap`}>
                                      {latest.revision_version ? `Rev ${latest.revision_version}` : 'Latest'} ★
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(latest.file_size)} · {new Date(latest.uploaded_at).toLocaleDateString('id-ID')}</p>
                                </div>
                                <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              </a>
                              {/* Version history */}
                              {history.map(att => (
                                <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-all cursor-pointer border-b border-gray-50 opacity-60">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm bg-gray-100">
                                    {att.file_type?.includes('pdf') ? '📄' : att.file_type?.startsWith('image') ? '🖼️' : '📊'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-gray-500 truncate">{att.file_name}</p>
                                    <p className="text-[9px] text-gray-400">{att.revision_version ? `Rev ${att.revision_version}` : ''} · {new Date(att.uploaded_at).toLocaleDateString('id-ID')}</p>
                                  </div>
                                  <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              ))}
                            </div>
                          );
                        })}
                        {/* General files */}
                        {attachments.filter(a => a.attachment_category === 'general' || !a.attachment_category).length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {attachments.filter(a => a.attachment_category === 'general' || !a.attachment_category).map(att => (
                              <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                                className="group flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all cursor-pointer">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-lg bg-gray-50">
                                  {att.file_type?.startsWith('image') ? '🖼️' : att.file_type?.includes('pdf') ? '📄' : '📎'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-gray-700 truncate group-hover:text-teal-700">{att.file_name}</p>
                                  <p className="text-[9px] text-gray-400">{formatFileSize(att.file_size)}</p>
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Admin controls */}
                  {isPTS && !isTeamPTS && (
                    <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                      <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 bg-rose-500 text-white rounded-lg flex items-center justify-center text-xs shadow">⚙️</span>
                        Admin Controls
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Target Selesai</label>
                          {detailDueStatus && (
                            <div className={`mb-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${detailDueStatus.type === 'overdue' ? 'bg-red-100 text-red-600' : detailDueStatus.type === 'urgent' ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'}`}>
                              🎯 {detailDueStatus.label}
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <input type="date" defaultValue={selectedRequest.due_date || ''} id="detail_due_date"
                              className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-teal-400 outline-none bg-white" />
                            <button onClick={async () => {
                              const val = (document.getElementById('detail_due_date') as HTMLInputElement)?.value;
                              const { error } = await supabase.from('project_requests').update({ due_date: val || null }).eq('id', selectedRequest.id);
                              if (!error) { notify('success', val ? `Target: ${formatDueDate(val)}` : 'Dihapus.'); setSelectedRequest(prev => prev ? { ...prev, due_date: val || undefined } : null); fetchRequests(); }
                              else notify('error', 'Gagal.');
                            }} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all">OK</button>
                          </div>
                        </div>
                        {selectedRequest.status !== 'pending' && selectedRequest.status !== 'rejected' && (
                          <button onClick={() => setAssignModal({ open: true, req: selectedRequest })}
                            className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 py-2 rounded-xl text-sm font-bold transition-all">
                            👥 Re-assign Tim PTS
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Chat */}
              <div className={`${detailMobileTab === 'chat' ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-col flex-[1.5] overflow-hidden bg-white/95 min-w-0`}>
                <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">💬 Discussion Chat</p>
                  {/* Room filter tabs for chat */}
                  {(() => {
                    const chatRooms = selectedRequest.rooms || [];
                    if (chatRooms.length === 0) return <p className="text-[10px] text-gray-400">{messages.filter(m => m.sender_role !== 'system').length} pesan</p>;
                    const roomLabels = [
                      { key: 'all', label: '📋 Semua' },
                      { key: selectedRequest.room_name?.trim() || 'Ruangan 1', label: selectedRequest.room_name?.trim() || 'Ruangan 1' },
                      ...chatRooms.map((r, i) => ({ key: r.room_name?.trim() || `Ruangan ${i+2}`, label: r.room_name?.trim() || `Ruangan ${i+2}` })),
                    ];
                    return (
                      <div className="flex flex-wrap gap-1">
                        {roomLabels.map(({ key, label }) => (
                          <button key={key} type="button" onClick={() => setChatRoomFilter(key)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${chatRoomFilter === key ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(() => {
                    // Filter messages by chatRoomFilter
                    const filteredMsgs = chatRoomFilter === 'all'
                      ? messages
                      : messages.filter(m => {
                          if (m.sender_role === 'system') return true;
                          // Show messages prefixed with this room label, or unprefixed (general/Ruangan 1)
                          const hasPrefix = m.message.startsWith('[') && m.message.includes(']');
                          if (hasPrefix) {
                            const prefix = m.message.match(/^\[([^\]]+)\]/)?.[1] || '';
                            return prefix === chatRoomFilter;
                          }
                          // Unprefixed messages: show only in 'all' or Ruangan 1 (first room)
                          const firstRoomLabel = selectedRequest.room_name?.trim() || 'Ruangan 1';
                          return chatRoomFilter === firstRoomLabel;
                        });
                    if (filteredMsgs.length === 0) return (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                        <div className="text-4xl">💬</div>
                        <p className="font-medium text-sm">{chatRoomFilter === 'all' ? 'Belum ada pesan' : `Belum ada pesan untuk ${chatRoomFilter}`}</p>
                      </div>
                    );
                    return filteredMsgs.map(msg => {
                      const isSystem = msg.sender_role === 'system';
                      const isMe = msg.sender_id === currentUser.id;
                      if (isSystem) return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="bg-gray-100 text-gray-500 text-xs px-4 py-2 rounded-full font-medium max-w-sm text-center">{msg.message}</div>
                        </div>
                      );
                      // Strip room prefix from display
                      const displayMsg = msg.message.replace(/^\[[^\]]+\]\s*/, '');
                      const msgRoomLabel = msg.message.match(/^\[([^\]]+)\]/)?.[1];
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                            <p className="text-[10px] text-gray-400 font-medium px-1 flex items-center gap-1 flex-wrap">
                              {isMe ? 'Saya' : (
                                <>
                                  {msg.sender_role === 'guest' ? '👤' : msg.sender_role === 'team_pts' || msg.sender_role === 'team' ? '👷' : msg.sender_role === 'admin' || msg.sender_role === 'superadmin' ? '⚙️' : '💬'}
                                  {' '}{msg.sender_name}
                                </>
                              )}
                              {' · '}{new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              {chatRoomFilter === 'all' && msgRoomLabel && <span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[9px] font-bold">{msgRoomLabel}</span>}
                            </p>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${
                              isMe
                                ? 'bg-gradient-to-br from-teal-600 to-teal-800 text-white rounded-tr-sm'
                                : msg.sender_role === 'guest'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200 rounded-tl-sm'
                                  : msg.sender_role === 'admin' || msg.sender_role === 'superadmin'
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-sm'
                                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                            }`}>
                              {displayMsg}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50">
                  {/* Show which room this message will go to */}
                  {chatRoomFilter !== 'all' && selectedRequest.status !== 'rejected' && selectedRequest.status !== 'pending' && (
                    <div className="mb-2 px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-[10px] text-teal-700 font-semibold flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                      Mengirim ke: <strong>{chatRoomFilter}</strong>
                    </div>
                  )}
                  {selectedRequest.status === 'rejected' ? (
                    <div className="text-center text-xs font-bold text-red-500 bg-red-50 border border-red-200 rounded-xl py-3">Request ini ditolak. Chat tidak tersedia.</div>
                  ) : selectedRequest.status === 'pending' ? (
                    <div className="text-center text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl py-3">🔒 Chat tersedia setelah di-approve.</div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-end gap-2 bg-white/90 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-teal-500 transition-all">
                        <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                          placeholder="Ketik pesan... (Enter kirim)" rows={1}
                          className="flex-1 bg-transparent text-sm text-gray-800 outline-none resize-none max-h-24 placeholder-gray-400" />
                        <button onClick={() => chatFileRef.current?.click()} className="text-gray-400 hover:text-teal-600 transition-colors flex-shrink-0">
                          {uploadingFile ? <div className="w-4 h-4 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>}
                        </button>
                        <input ref={chatFileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
                      </div>
                      <button onClick={handleSendMessage} disabled={sendingMsg || !msgText.trim()}
                        className="bg-gradient-to-r from-teal-600 to-teal-800 text-white px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md flex-shrink-0">
                        {sendingMsg ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {editFormModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9995] p-4">
          <div className="bg-white/90 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border-2 border-amber-400 animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">✏️ Edit Kebutuhan Project</h2>
                <p className="text-amber-100 text-xs mt-0.5">{selectedRequest.project_name}</p>
              </div>
              <button onClick={() => setEditFormModal(false)} className="bg-white/20 hover:bg-white/30 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50">

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow">📁</span>
                  Informasi Project
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Project *</label>
                    <input value={editFormData.project_name} onChange={e => setEditFormData(p => ({ ...p, project_name: e.target.value }))}
                      placeholder="Nama project..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Ruangan</label>
                    <input value={editFormData.room_name} onChange={e => setEditFormData(p => ({ ...p, room_name: e.target.value }))}
                      placeholder="Nama ruangan / area" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Lokasi Project</label>
                    <textarea value={editFormData.project_location} onChange={e => setEditFormData(p => ({ ...p, project_location: e.target.value }))}
                      placeholder="Contoh: Gedung Wisma 46 Lt.12, Jl. MH Thamrin No.1, Jakarta Pusat" rows={4}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 outline-none bg-white resize-none" />
                  </div>
                  {/* Sales: hidden for guest (auto from account), admin/team can edit */}
                  {isPTS && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sales / Account</label>
                      <div className="flex gap-2 items-center">
                        <select value={editFormData.sales_name} onChange={e => {
                            const sel = salesGuestUsers.find(u => u.full_name === e.target.value);
                            setEditFormData(p => ({ ...p, sales_name: e.target.value, sales_division: sel?.sales_division || p.sales_division }));
                          }}
                          className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 outline-none bg-white appearance-none cursor-pointer">
                          <option value="">— Pilih Sales —</option>
                          {salesGuestUsers.map(u => (
                            <option key={u.id} value={u.full_name}>{u.full_name}{u.sales_division ? ` (${u.sales_division})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Target Selesai — semua role termasuk Guest bisa ubah */}
              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-teal-500 text-white rounded-lg flex items-center justify-center text-xs shadow">📅</span>
                  Target Selesai
                </h3>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Target Selesai</label>
                  <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-amber-400 transition-all text-sm bg-white outline-none cursor-pointer"
                    style={{ color: editDueDate ? '#374151' : '#9ca3af' }} />
                  {editDueDate && (
                    <p className="text-xs text-teal-600 font-semibold mt-1.5">
                      📅 Target: {new Date(editDueDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow">🎯</span>
                  Kategori Kebutuhan & Solution
                </h3>
                <CheckGroup label="Kebutuhan" options={['Signage', 'Immersive', 'Meeting Room', 'Mapping', 'Command Center', 'Hybrid Classroom']}
                  value={editFormData.kebutuhan} onChange={v => setEditFormData(p => ({ ...p, kebutuhan: v }))} />
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Other Kebutuhan</label>
                  <input value={editFormData.kebutuhan_other} onChange={e => setEditFormData(p => ({ ...p, kebutuhan_other: e.target.value }))}
                    placeholder="Tuliskan jika ada..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                </div>
                <CheckGroup label="Solution Product" options={['Videowall', 'Signage Display', 'Videotron', 'Projector', 'Kiosk', 'IFP']}
                  value={editFormData.solution_product} onChange={v => setEditFormData(p => ({ ...p, solution_product: v }))} />
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Other Solution</label>
                  <input value={editFormData.solution_other} onChange={e => setEditFormData(p => ({ ...p, solution_other: e.target.value }))}
                    placeholder="Tuliskan jika ada..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                </div>
              </div>

              {editFormData.kebutuhan.includes('Signage') && (
              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow">📺</span>
                  Layout Konten & Jaringan
                </h3>
                <RadioGroup label="Layout Signage" options={['Single Zone', 'Multi Zone', 'Full Screen', 'Custom Layout']}
                  value={editFormData.layout_signage?.[0] || ''} onChange={v => setEditFormData(p => ({ ...p, layout_signage: v ? [v] : [] }))} />
                <CheckGroup label="Jaringan / CMS" options={['Offline', 'Online LAN', 'Online WiFi', 'Cloud CMS', 'Local CMS']}
                  value={editFormData.jaringan_cms} onChange={v => setEditFormData(p => ({ ...p, jaringan_cms: v }))} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label>
                    <input value={editFormData.jumlah_input} onChange={e => setEditFormData(p => ({ ...p, jumlah_input: e.target.value }))}
                      placeholder="e.g. 4 input" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label>
                    <input value={editFormData.jumlah_output} onChange={e => setEditFormData(p => ({ ...p, jumlah_output: e.target.value }))}
                      placeholder="e.g. 2 output" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                </div>
              </div>
              )}

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow">🔌</span>
                  Source & Peripheral
                </h3>
                <CheckGroup label="Source" options={['PC / Mini PC', 'Laptop', 'URL Dashboard', 'NVR CCTV', 'Media Player', 'IPTV', 'Set Top Box']}
                  value={editFormData.source} onChange={v => setEditFormData(p => ({ ...p, source: v }))} />
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Other Source</label>
                  <input value={editFormData.source_other} onChange={e => setEditFormData(p => ({ ...p, source_other: e.target.value }))}
                    placeholder="Tuliskan jika ada..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                </div>

                <RadioGroup label="Camera Conference" options={['Yes', 'No']} value={editFormData.camera_conference}
                  onChange={v => setEditFormData(p => ({ ...p, camera_conference: v }))} />
                {editFormData.camera_conference === 'Yes' && (
                  <div className="ml-4 mb-4 space-y-3 border-l-2 border-amber-200 pl-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label>
                      <input value={editFormData.camera_jumlah} onChange={e => setEditFormData(p => ({ ...p, camera_jumlah: e.target.value }))}
                        placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                    </div>
                    <CheckGroup label="Camera Tracking" options={['Auto Tracking', 'Manual PTZ', 'Fixed']}
                      value={editFormData.camera_tracking} onChange={v => setEditFormData(p => ({ ...p, camera_tracking: v }))} />
                  </div>
                )}

                <RadioGroup label="Audio System" options={['Yes', 'No']} value={editFormData.audio_system}
                  onChange={v => setEditFormData(p => ({ ...p, audio_system: v }))} />
                {editFormData.audio_system === 'Yes' && (
                  <div className="ml-4 mb-4 space-y-3 border-l-2 border-amber-200 pl-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label>
                      <input value={editFormData.audio_mixer} onChange={e => setEditFormData(p => ({ ...p, audio_mixer: e.target.value }))}
                        placeholder="e.g. Yamaha QL1, QSC, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                    </div>
                    <CheckGroup label="Audio Detail" options={['Speaker Ceiling', 'Speaker Line Array', 'Subwoofer', 'Microphone', 'Amplifier']}
                      value={editFormData.audio_detail} onChange={v => setEditFormData(p => ({ ...p, audio_detail: v }))} />
                  </div>
                )}

                <RadioGroup label="Wallplate Input" options={['Yes', 'No']} value={editFormData.wallplate_input}
                  onChange={v => setEditFormData(p => ({ ...p, wallplate_input: v }))} />
                {editFormData.wallplate_input === 'Yes' && (
                  <div className="ml-4 mb-4 border-l-2 border-amber-200 pl-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Wallplate</label>
                    <input value={editFormData.wallplate_jumlah} onChange={e => setEditFormData(p => ({ ...p, wallplate_jumlah: e.target.value }))}
                      placeholder="e.g. 3 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                )}

                <RadioGroup label="Tabletop Input" options={['Yes', 'No']} value={editFormData.tabletop_input}
                  onChange={v => setEditFormData(p => ({ ...p, tabletop_input: v }))} />
                {editFormData.tabletop_input === 'Yes' && (
                  <div className="ml-4 mb-4 border-l-2 border-amber-200 pl-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Tabletop</label>
                    <input value={editFormData.tabletop_jumlah} onChange={e => setEditFormData(p => ({ ...p, tabletop_jumlah: e.target.value }))}
                      placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                )}

                <RadioGroup label="Wireless Presentation" options={['Yes', 'No']} value={editFormData.wireless_presentation}
                  onChange={v => setEditFormData(p => ({ ...p, wireless_presentation: v }))} />
                {editFormData.wireless_presentation === 'Yes' && (
                  <div className="ml-4 mb-4 space-y-3 border-l-2 border-amber-200 pl-4">
                    <CheckGroup label="Wireless Mode" options={['Aplikasi', 'AirPlay', 'Miracast', 'Chromecast', 'BYOM']}
                      value={editFormData.wireless_mode} onChange={v => setEditFormData(p => ({ ...p, wireless_mode: v }))} />
                    <RadioGroup label="Dongle" options={['Yes', 'No']} value={editFormData.wireless_dongle}
                      onChange={v => setEditFormData(p => ({ ...p, wireless_dongle: v }))} />
                  </div>
                )}

                <RadioGroup label="Controller / Automation" options={['Yes', 'No']} value={editFormData.controller_automation}
                  onChange={v => setEditFormData(p => ({ ...p, controller_automation: v }))} />
                {editFormData.controller_automation === 'Yes' && (
                  <div className="ml-4 mb-4 border-l-2 border-amber-200 pl-4">
                    <RadioGroup label="Controller Type" options={['Cue', 'Wyrestorm', 'Extron', 'Custom']}
                      value={editFormData.controller_type?.[0] || ''} onChange={v => setEditFormData(p => ({ ...p, controller_type: v ? [v] : [] }))} />
                  </div>
                )}
              </div>

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow">📐</span>
                  Ruangan & Informasi Lainnya
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P × L × T)</label>
                    <input value={editFormData.ukuran_ruangan} onChange={e => setEditFormData(p => ({ ...p, ukuran_ruangan: e.target.value }))}
                      placeholder="e.g. 8m × 6m × 3m" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W × H)</label>
                    <input value={editFormData.suggest_tampilan} onChange={e => setEditFormData(p => ({ ...p, suggest_tampilan: e.target.value }))}
                      placeholder="e.g. 1920 × 1080 px atau 4K" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label>
                    <textarea value={editFormData.keterangan_lain} onChange={e => setEditFormData(p => ({ ...p, keterangan_lain: e.target.value }))}
                      rows={3} placeholder="Tuliskan informasi tambahan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none resize-none bg-white" />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-gray-200 p-4 flex gap-3 bg-white/90 flex-shrink-0">
              <button onClick={() => setEditFormModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50">Batal</button>
              <button onClick={handleEditFormSubmit} className="flex-[2] bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Entry ───────────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundImage: `url('/IVP_Background.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
      <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
        style={{ border: '2px solid rgba(13,148,136,0.3)' }}>
        <div className="text-5xl mb-4">🔐</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Sesi Habis</h2>
        <p className="text-gray-500 text-sm mb-6">Silakan login kembali melalui dashboard.</p>
        <a href="/dashboard" className="bg-gradient-to-r from-teal-600 to-teal-800 text-white px-6 py-3 rounded-xl font-bold hover:from-teal-700 hover:to-teal-900 transition-all shadow-md inline-block">
          Kembali ke Dashboard
        </a>
      </div>
    </div>
  );

  return (
    <Suspense>
      <FormRequireProject currentUser={currentUser} />
    </Suspense>
  );
}
