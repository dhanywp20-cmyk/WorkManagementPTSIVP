'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hitungReviewMenggantung } from '@/lib/form-review-gate';
import { setSession, clearSession, getSession, startSessionWatcher } from '@/lib/auth';
import { isAdmin as checkIsAdmin, hasFullAccess } from '@/lib/constants';
import { isAssignablePTSTeam } from '@/lib/teams';
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { normalkanNama } from '@/lib/kelompok-insentif';
import { notifyReminderApproved, createNotification, createNotificationForAdmins } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { adalahKategoriInsentif, muatKategoriInsentif } from '@/lib/incentive-scheme';
import { bandingkan, ringkasPerubahan, pesanWAPerubahan, type AdminField } from '@/lib/admin-edit';
import { syncRemindersToProjectProgress, triggersProjectProgress, type ReminderSnapshot } from '@/lib/project-progress-sync';
import { compressImage } from '@/lib/image-compress';
import { idDariNama, kutipNilai, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';

import {
  Priority, Status, RepeatType, Reminder, TeamUser, GuestUser,
  REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES,
  PRIORITY_CONFIG, STATUS_CONFIG, CATEGORIES, CATEGORY_CONFIG,
  REPEAT_OPTIONS, SALES_DIVISIONS, PIE_COLORS,
  formatDate, formatDatetime, isDueToday, newBatchId,
  sendFonnteWA, resolveSupervisorsForProductType, type SupervisorCandidate,
  DEFAULT_REQUEST_NOTE, cleanRequestNotes, fetchManagerTargets,
} from './_components/shared';
import { PriorityBadge, StatusBadge, CategoryBadge } from './_components/Badges';
import {
  FormField, SectionHeader, SectionHeaderSmall, InfoRow,
  LoadingScreen, MiniPieChart, PageHeader,
  ViewIconBtn, RescheduleIconBtn, ApproveIconBtn, DeleteIconBtn, ActionGroup,
  ConfirmDialog, type ConfirmState, ErrorState, ListEmptyState, AuditTrailPanel, FlowSteps, Username, StatCard,
  ModalPortal
} from '@/components/shared';
import { MiniCalendar } from './_components/MiniCalendar';
import { RescheduleModal } from './_components/RescheduleModal';
import { RequestJadwalModal, type JadwalRequest } from './_components/RequestJadwalModal';
import { ReminderFormModal, type ReminderForm } from './_components/ReminderFormModal';
import { KonfirmasiApproveInternal, ModalHapus, PopupNotifikasi, PopupLonceng } from './_components/PopupRingkas';


function ReminderSchedulePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appReady, setAppReady]             = useState(false);
  const [dashLoading, setDashLoading]       = useState(false);
  const [loginTime, setLoginTime]           = useState<number | null>(null);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showBellPopup, setShowBellPopup]   = useState(false);
  const [myReminders, setMyReminders]       = useState<Reminder[]>([]);
  const [currentUser, setCurrentUser]       = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]           = useState<TeamUser[]>([]);
  const [managerUserId, setManagerUserId]   = useState('');  // app_settings.manager_user_id (Manager PTS yg boleh approve & assign)
  const [myJabatan, setMyJabatan]           = useState('');  // jabatan akun login (utk deteksi Manager tanpa perlu set manager_user_id)
  const [myIsInternalSales, setMyIsInternalSales] = useState(false); // creator = Sales Internal  boleh isi SBU (buat atas nama Sales External)
  const [guestUsers, setGuestUsers]         = useState<GuestUser[]>([]);
  const [reminders, setReminders]           = useState<Reminder[]>([]);
  const [listLoading, setListLoading]       = useState(false);
  const [fetchError, setFetchError]         = useState<string|null>(null);
  const [saving, setSaving]                 = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Reminder | null>(null);

  const [view, setView]                     = useState<'list' | 'form'>('list');
  const [showFormModal, setShowFormModal]   = useState(false);
  const [detailReminder, setDetailReminder] = useState<Reminder | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  /*
    Pertanyaan "kelanjutan proyek yang sama, atau pekerjaan terpisah?"

    Satu proyek sering dikerjakan lewat beberapa jadwal - Konfigurasi Senin,
    Training tiga hari kemudian. Tanpa ada yang menyatakan hubungannya,
    Incentive Project membacanya sebagai DUA proyek dengan dua pool nominal.

    Ditanyakan SAAT MEMBUAT, karena di situlah orangnya paling tahu jawabannya.
    Menebaknya belakangan dari kemiripan nama adalah cara yang paling mudah
    keliru, dan kekeliruannya tidak terlihat siapa pun.
  */
  const [tanyaLanjutan, setTanyaLanjutan] = useState<{
    nama: string;
    sebelumnya: Reminder[];
    lanjut: (grup: string | null) => void;
  } | null>(null);

  /*
    Lapis 4 - mencari project SEBELUM form dibuka, bukan mengetiknya lalu
    berharap platform mendeteksi kecocokan belakangan.

    Pola yang sama seperti Create Ticket: pilih "Project yang sudah ada" /
    "Project baru" lebih dulu. Kalau sudah ada, cari dan pilih - form yang
    muncul SESUDAHNYA sudah terisi (alamat, PIC, produk, sales, brand),
    tinggal menentukan kategori dan tanggal pekerjaan baru ini.

    Karena project-nya sudah dipastikan sama lewat pencarian ini - bukan
    ditebak dari kecocokan nama belakangan - pertanyaan "kelanjutan atau
    terpisah?" (Lapis 1) tidak ditanyakan lagi untuk jalur ini. Menanyakannya
    dua kali untuk jawaban yang sama hanya mengulang yang sudah dikatakan.
  */
  const [langkahBuat, setLangkahBuat] = useState<'pilih' | 'cari' | null>(null);
  /**
   * Tujuan langkah 'pilih'/'cari' saat ini - form admin (ReminderFormModal)
   * atau request Sales/Guest (RequestJadwalModal). Dua tombol pemicu ("Tambah
   * Reminder" untuk admin/team, "Request Jadwal" untuk Sales/Guest) berbagi
   * DUA LANGKAH YANG SAMA - hanya langkah konfirmasinya yang bercabang,
   * supaya perbaikan pada satu jalur (mis. teks, urutan tombol) otomatis
   * berlaku untuk keduanya.
   */
  const [buatUntukGuest, setBuatUntukGuest] = useState(false);
  const [carianProyek, setCarianProyek] = useState('');
  const [praPilihProyek, setPraPilihProyek] = useState<Reminder | null>(null);
  /**
   * Seluruh jadwal lama untuk project yang dipilih lewat Lapis 4 - dipakai
   * resolveGrupInsentif saat menyimpan, dan ditampilkan sebagai ringkasan.
   * null berarti jadwal ini TIDAK melalui Lapis 4 (project baru, atau sunting).
   */
  const [proyekLamaTerpilih, setProyekLamaTerpilih] = useState<Reminder[] | null>(null);
  /** Isian awal RequestJadwalModal, hasil pilihan Lapis 4 di jalur Sales/Guest. */
  const [praFillGuest, setPraFillGuest] = useState<Partial<JadwalRequest> | null>(null);

  /** Daftar project yang pernah tercatat, satu baris wakil (terbaru) per nama. */
  const daftarProyekLama = useMemo(() => {
    const peta = new Map<string, Reminder>();
    for (const r of reminders) {
      const n = normalkanNama(r.project_name);
      if (!n) continue;
      const ada = peta.get(n);
      if (!ada || (r.created_at ?? '') > (ada.created_at ?? '')) peta.set(n, r);
    }
    return [...peta.values()].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [reminders]);

  const hasilCarianProyek = useMemo(() => {
    const q = carianProyek.trim().toLowerCase();
    if (!q) return daftarProyekLama.slice(0, 20);
    return daftarProyekLama
      .filter(r => (r.project_name ?? '').toLowerCase().includes(q))
      .slice(0, 20);
  }, [daftarProyekLama, carianProyek]);

  const mulaiBuatReminder = () => {
    setBuatUntukGuest(false);
    setEditingReminder(null); setFormData(emptyForm); setExtraDates([]);
    setProyekLamaTerpilih(null); setPraFillGuest(null); setPraPilihProyek(null); setCarianProyek('');
    setLangkahBuat('pilih');
  };

  /**
   * Pemicu untuk role Sales/Guest - sebelumnya "Request Jadwal" langsung
   * membuka RequestJadwalModal kosong, tanpa lewat pemilihan tipe project
   * sama sekali. Sekarang memakai DUA LANGKAH YANG SAMA dengan jalur admin;
   * yang membedakan hanya `buatUntukGuest`, dipakai di 'pilih' untuk teks dan
   * di konfirmasiProyekLama untuk menentukan form mana yang dibuka.
   */
  const mulaiRequestJadwal = () => {
    setBuatUntukGuest(true);
    setProyekLamaTerpilih(null); setPraFillGuest(null); setPraPilihProyek(null); setCarianProyek('');
    setLangkahBuat('pilih');
  };

  const konfirmasiProyekLama = () => {
    if (!praPilihProyek) return;
    const n = normalkanNama(praPilihProyek.project_name);
    // Sengaja dari `reminders` yang SUDAH termuat di halaman ini, bukan kueri
    // baru. Untuk akun Sales/Guest, fetchRemindersForUser hanya memuat baris
    // miliknya sendiri (lihat catatan di sana) - jadi daftar ini otomatis
    // tidak pernah memuat project sales lain, tanpa saringan tambahan di sini.
    const sebatch = reminders.filter(r => normalkanNama(r.project_name) === n);
    setProyekLamaTerpilih(sebatch);
    setLangkahBuat(null);

    if (buatUntukGuest) {
      // JadwalRequest tidak punya sales_name/assign_name - pelakunya sudah
      // pasti currentUser, jadi tidak perlu (dan tidak boleh) disalin dari
      // baris lama, yang bisa saja milik Sales External lain yang sedang
      // di-CC-kan (SBU) ke akun ini.
      setPraFillGuest({
        project_name: praPilihProyek.project_name || '',
        address: praPilihProyek.address ?? '',
        product: praPilihProyek.product ?? '',
        pic_name: praPilihProyek.pic_name ?? '',
        pic_phone: praPilihProyek.pic_phone ?? '',
        sales_division: praPilihProyek.sales_division || undefined,
        brand: (praPilihProyek.brand as JadwalRequest['brand']) ?? undefined,
      });
      setShowRequestModal(true);
      return;
    }

    setFormData(prev => ({
      ...prev,
      project_name: praPilihProyek.project_name || '',
      address: praPilihProyek.address ?? '',
      sales_name: praPilihProyek.sales_name ?? '',
      sales_division: praPilihProyek.sales_division ?? '',
      product: praPilihProyek.product ?? '',
      pic_name: praPilihProyek.pic_name ?? '',
      pic_phone: praPilihProyek.pic_phone ?? '',
      brand: praPilihProyek.brand ?? prev.brand,
    }));
    setShowFormModal(true);
  };

  // Filters - extended with team handler & category
  const [filterStatus, setFilterStatus]     = useState<Status | 'all'>('all');
  const [filterYear, setFilterYear]         = useState<string>('all');
  const [searchProject, setSearchProject]   = useState('');
  const [searchSales, setSearchSales]       = useState('');

  // Auto-apply filter dari Global Search (?q=...)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchProject(q);
  }, [searchParams]);

  /*
    Kategori mana yang dihitung sebagai proyek insentif kini DATA (diatur di
    layar Skema Pembagian), bukan daftar yang dipaku di kode. Dimuat sekali
    saat halaman dibuka; state penanda di bawah hanya untuk memicu render
    ulang, karena adalahKategoriInsentif() membaca cache modul dan React tidak
    tahu isinya berubah. Sebelum ini selesai, yang dipakai adalah daftar
    bawaan - jadi tidak ada jendela waktu tanpa jawaban.
  */
  const [, setKategoriDimuat] = useState(false);
  useEffect(() => {
    let hidup = true;
    muatKategoriInsentif().then(() => { if (hidup) setKategoriDimuat(true); }).catch(() => {});
    return () => { hidup = false; };
  }, []);
  const [searchDivisionSales, setSearchDivisionSales]       = useState('');
  const [searchTeamHandler, setSearchTeamHandler] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchProduct, setSearchProduct] = useState('');
  const [productFilter, setProductFilter] = useState<string | null>(null);

  const [calendarMonth, setCalendarMonth]   = useState(new Date());
  const [toast, setToast]                   = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<'none' | 'ivp' | 'mvi' | 'ump'>('none');
  const [extraDates, setExtraDates] = useState<string[]>([]); // hari tambahan (multi-tanggal sekali submit)
  // Kalender-only selection - tidak mempengaruhi filter list/chart/summary
  const [calOnlyDay, setCalOnlyDay]         = useState<string | null>(null);
  const [sendingWA, setSendingWA]           = useState<string | null>(null);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState<Reminder | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Update Status with photo
  const [pendingStatus, setPendingStatus]   = useState<Status | null>(null);
  const [statusPhoto, setStatusPhoto]       = useState<File | null>(null);
  const [statusPhotoPreview, setStatusPhotoPreview] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const statusPhotoRef = useRef<HTMLInputElement>(null);

  // Onsite / Remote Mode Modal
  const [showModeModal, setShowModeModal]             = useState(false);
  const [modePenyelesaian, setModePenyelesaian]       = useState<'onsite' | 'remote' | null>(null);
  const [installerName, setInstallerName]             = useState('');
  const [installerDaerah, setInstallerDaerah]         = useState('');
  const [bastDate, setBastDate]                       = useState<string>('');
  const [displayType, setDisplayType]                 = useState<'led' | 'lcd' | 'mix' | null>(null);
  const [requiresMiddleware, setRequiresMiddleware]   = useState(false);
  const [requiresControllerAuto, setRequiresControllerAuto] = useState(false);
  const [controllerBrand, setControllerBrand]         = useState<'cue' | 'extron' | 'wyrestorm' | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl]         = useState<string | undefined>(undefined);
  const [savingMode, setSavingMode]                   = useState(false);

  // Resend Form Review
  const [resendingFormReview, setResendingFormReview] = useState(false);

  // Guest Request Jadwal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  /** Jawaban query review sudah tiba? Dipakai pintasan ?buat=1 di bawah. */
  const [jumlahReviewSiap, setJumlahReviewSiap] = useState(false);
  /** Pintasan hanya boleh membuka modal sekali, bukan tiap kali render ulang. */
  const pintasanTerpakai = useRef(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  // Approve & Assign State (admin only)
  const [approveTarget, setApproveTarget] = useState<Reminder | null>(null);
  const [approveBatchSiblings, setApproveBatchSiblings] = useState<Reminder[]>([]); // tanggal lain di batch yang sama, ikut di-approve bareng
  const [approveAssignTo, setApproveAssignTo] = useState('');
  const [approveDate, setApproveDate] = useState('');
  const [approveTime, setApproveTime] = useState('');
  /** Panel riwayat di samping modal detail. Default terbuka supaya langsung terlihat. */
  const [showRiwayat, setShowRiwayat] = useState(true);
  // Timeline pengerjaan saat approve - terisi dari usulan Sales, boleh diubah.
  const [approveStart,  setApproveStart]  = useState('');
  const [approveTarget2, setApproveTarget2] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);
  const [internalRejectTarget, setInternalRejectTarget] = useState<Reminder | null>(null); // request yg mau di-Tolak Sales Internal
  const [internalApproveTarget, setInternalApproveTarget] = useState<Reminder | null>(null); // konfirmasi Approve Sales Internal (detail dulu, jangan instan)
  const [internalApproveSaving, setInternalApproveSaving] = useState(false);
  const [internalRejectReason, setInternalRejectReason] = useState('');
  const [internalRejectSaving, setInternalRejectSaving] = useState(false);
  // Admin/Manager approve  route ke Supervisor tim (by tipe produk, product_team_map)
  const [approveSupervisors, setApproveSupervisors] = useState<SupervisorCandidate[]>([]);
  const [approveRouteSaving, setApproveRouteSaving] = useState(false);
  // Supervisor assign ke anggota tim ATAU diri sendiri (tim penuh - keputusan manual)
  const [supervisorAssignTarget, setSupervisorAssignTarget] = useState<Reminder | null>(null);
  const [supervisorAssignBatchSiblings, setSupervisorAssignBatchSiblings] = useState<Reminder[]>([]);
  const [supervisorAssignTo, setSupervisorAssignTo] = useState(''); // username anggota, atau 'SELF'
  const [supervisorAssignSaving, setSupervisorAssignSaving] = useState(false);

  /**
   * Buat draft Project Progress dari reminder yang BARU dibuat. Tidak ada
   * backfill untuk reminder lama - progres lampau tidak terekam, dan draft
   * kosong justru menyesatkan. Sengaja tidak ditunggu dan tidak pernah
   * melempar: kegagalannya hanya info, bukan pembatal penyimpanan reminder.
   */
  const syncNewRemindersToProgress = async (rows: ReminderSnapshot[]) => {
    if (rows.length === 0) return;
    const hasil = await syncRemindersToProjectProgress(rows, {
      id: currentUser?.id,
      full_name: currentUser?.full_name,
    });
    if (hasil.created > 0) {
      notify('success', `${hasil.created} draft dibuat di Project Progress. Item komponen diisi menyusul di sana.`);
    }
    if (hasil.errors.length > 0) {
      console.warn('[project-progress-sync]', hasil.errors);
    }
  };


  /**
   * Timeline khusus Project Progress. Dikirim hanya bila kategorinya memang
   * pemicu; kalau user sempat memilih Konfigurasi lalu berganti kategori,
   * tanggal yang terlanjur terisi tidak ikut tersimpan.
   */
  const progressTimelinePayload = () =>
    triggersProjectProgress(formData.category)
      ? {
          progress_start_date:  formData.progress_start_date  || null,
          progress_target_date: formData.progress_target_date || null,
        }
      : { progress_start_date: null, progress_target_date: null };

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const emptyForm: Omit<Reminder, 'id' | 'created_at' | 'created_by' | 'wa_sent_h1'> = {
    project_name: '', description: '', assigned_to: '', assign_name: '',
    sales_user_id: null, assign_user_id: null,
    due_date: new Date().toISOString().split('T')[0],
    due_time: '09:00', priority: 'medium', status: 'pending',
    repeat: 'none', category: 'Demo Product',
    sales_name: '', sales_division: '', address: '', pic_name: '', pic_phone: '',
    progress_start_date: '', progress_target_date: '',
    notes: '', product: '', warranty_years: null,
    requires_controller_automation: false, controller_automation_brand: null,
    pic_type: 'standard', pic_id: null, incentive_value: 0, bast_date: null,
    product_type: '',
  };
  const [formData, setFormData] = useState(emptyForm);
  const fd = (patch: Partial<typeof emptyForm>) => setFormData(prev => ({ ...prev, ...patch }));

  // Init

  useEffect(() => {
    const user = getSession<TeamUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    setLoginTime(Date.now());

    // Fetch parallel - tidak tunggu satu selesai dulu
    Promise.all([
      fetchTeamUsers(),
      fetchGuestUsers(),
      fetchRemindersQuiet(user),
    ]).then(() => {
      setAppReady(true); //  tampilkan konten setelah data siap
      // Popup notif setelah data loaded
      if (user && (user.role === 'team' || user.role === 'admin')) {
        cobaIdentitas(async pakaiUuid => await supabase
          .from('reminders')
          .select('*')
          .or(pakaiUuid
            ? `assign_user_id.eq.${user.id},assigned_to.eq.${kutipNilai(user.username)}`
            : `assigned_to.eq.${kutipNilai(user.username)}`)
          .neq('status', 'done')
          .neq('status', 'cancelled')
          .order('due_date', { ascending: true }))
          .then(({ data: activeData }: { data: any[] | null }) => {
            const active = (activeData ?? []) as Reminder[];
            if (active.length > 0) {
              setMyReminders(active);
              setTimeout(() => setShowNotificationPopup(true), 800);
            }
          });
      }
    });

    // Realtime - subscribe setelah user di-set
    const ch = supabase.channel('reminders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
        const u = getSession<TeamUser>() ?? user;
        fetchRemindersQuiet(u);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // Session timeout check
  useEffect(() => {
    const checkSession = () => {
      const valid = getSession();
      if (!valid) {
        clearSession();
        const target = window.top !== window ? window.top : window;
        if (target) target.location.href = '/dashboard';
      }
    };
    checkSession();
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load Manager PTS (app_settings.manager_user_id) - dia berhak approve & assign
  // di tahap admin_review walau role-nya 'team' (Manager, bukan admin).
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN.MANAGER).maybeSingle()
      .then((res: { data: { value: unknown } | null }) => { const v = res.data?.value; if (v) setManagerUserId(String(v).replace(/^"|"$/g, '')); });
  }, []);

  // Ambil jabatan akun login - Manager (jabatan='Manager') otomatis boleh approve
  // & assign, tanpa admin harus set manager_user_id manual dulu.
  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.from('users').select('jabatan, is_internal_sales').eq('id', currentUser.id).maybeSingle()
      .then((res: { data: { jabatan: string | null; is_internal_sales: boolean | null } | null }) => {
        setMyJabatan(res.data?.jabatan ?? '');
        setMyIsInternalSales(!!res.data?.is_internal_sales);
      });
  }, [currentUser?.id]);

  // H-1 WA auto-send
  // Ditangani oleh Supabase Edge Function: daily-reminder (pg_cron)
  // Berjalan otomatis setiap hari tanpa perlu buka halaman

  const fetchTeamUsers = async () => {
    const { data } = await supabase.from('users').select('id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan').order('full_name');
    // Hanya team assignable (IVP/MVI - UMP dikecualikan, lihat lib/teams.ts). Ubah di satu tempat itu utk tambah/kurangi team.
    if (data) setTeamUsers(data.filter((u: TeamUser) => isAssignablePTSTeam(u.team_type) && u.role !== 'admin' && u.role !== 'superadmin'));
  };

  const fetchGuestUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, username, full_name, role, phone_number, sales_division, is_internal_sales')
      .eq('role', 'guest')
      .order('full_name');
    if (data) setGuestUsers(data as GuestUser[]);
  };

  //  PERUBAHAN UTAMA: Urutkan berdasarkan created_at terbaru di paling atas
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmState({ message: `Hapus ${selectedIds.size} jadwal yang dipilih?`, danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      setBulkDeleting(true);
      const { error } = await supabase.from('reminders').delete().in('id', Array.from(selectedIds));
      if (!error) { setReminders(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); }
      else notify('error', 'Gagal: ' + error.message);
      setBulkDeleting(false);
    }});
  };

  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filteredReminders.length ? new Set() : new Set(filteredReminders.map(r => r.id))
  );

  // Helper: fetch reminders dengan filter guest - ambil yg sales_name = full_name ATAU created_by = username
  const fetchRemindersForUser = async (activeUser: TeamUser | null): Promise<Reminder[]> => {
    /*
      role === 'sales' dulu TIDAK diperlakukan sama dengan 'guest' di sini,
      walau di seluruh halaman ini keduanya sudah disatukan sebagai "akun
      eksternal" (lihat isGuest = role==='guest' || role==='sales'). Akibatnya
      akun ber-role 'sales' akan jatuh ke cabang tim biasa - yang mengambil
      SELURUH baris reminders dari server sebelum menyaring, bukan hanya
      miliknya sendiri. Belum ada akun nyata memakai role ini (diperiksa: tidak
      ada satu pun tempat yang membuat akun dengan role itu), tapi cabangnya
      tetap dibetulkan sekarang, sebelum ada yang memakainya.
    */
    const perlakukanSebagaiGuest = activeUser?.role === 'guest' || activeUser?.role === 'sales';
    if (!activeUser || !perlakukanSebagaiGuest) {
      const { data, error } = await supabase.from('reminders').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      const all = (data as Reminder[]) ?? [];
      if (!activeUser) return all;
      // Admin & Manager: lihat SEMUA (termasuk yg masih proses approval / belum di-assign).
      const roleLc = (activeUser.role ?? '').toLowerCase();
      const isAdminUser = roleLc === 'admin' || roleLc === 'superadmin';
      const isManagerUser = hasFullAccess(activeUser) || (roleLc === 'team' && !!managerUserId && activeUser.id === managerUserId);
      if (isAdminUser || isManagerUser) return all;
      // Anggota tim biasa: HANYA item yg sudah di-assign (ke siapa pun) ATAU yg
      // di-route ke dirinya sbg Supervisor utk di-assign. Item yg masih pending
      // approval / belum di-assign TIDAK boleh muncul di list mereka (catatan spec).
      return all.filter(r =>
        !!r.assigned_to ||
        (!!r.assigned_supervisor_id && r.assigned_supervisor_id === activeUser.id)
      );
    }
    // Guest: ambil schedule yg atas nama dia (dibuat admin) + yg dia request sendiri (created_by)
    // + request Sales External yang menunggu REVIEW dia (Sales Internal, Fase 2 routing).
    const [bySales, byCreator, awaitingMyReview, awaitingMyReview2, approvedByMe] = await Promise.all([
      // Dicocokkan lewat uuid ATAU nama. Klausa namanya belum boleh dicabut:
      // baris lama yang namanya ambigu sengaja tidak dipetakan saat backfill,
      // dan mencabutnya sekarang akan menghilangkan jadwal orang dari layarnya.
      cobaIdentitas(async pakaiUuid => await supabase.from('reminders').select('*')
        .or(pakaiUuid
          ? `sales_user_id.eq.${activeUser.id},sales_name.eq.${kutipNilai(activeUser.full_name)}`
          : `sales_name.eq.${kutipNilai(activeUser.full_name)}`)
        .order('created_at', { ascending: false })),
      supabase.from('reminders').select('*').eq('created_by', activeUser.username).order('created_at', { ascending: false }),
      supabase.from('reminders').select('*').eq('internal_sales_id', activeUser.id).eq('routing_status', 'internal_review').order('created_at', { ascending: false }),
      // Reviewer KEDUA (brand IVP saat "Kedua Brand") - juga perlu lihat & approve.
      supabase.from('reminders').select('*').eq('internal_sales_id_2', activeUser.id).eq('routing_status', 'internal_review').order('created_at', { ascending: false }),
      // Item yang SUDAH dia approve sebagai Sales Internal - tetap tampil
      // supaya bisa dilacak walau routing_status sudah pindah ke admin_review.
      supabase.from('reminders').select('*').eq('internal_approved_by', activeUser.id).order('created_at', { ascending: false }),
    ]);
    const combined = [...(bySales.data ?? []), ...(byCreator.data ?? []), ...(awaitingMyReview.data ?? []), ...(awaitingMyReview2.data ?? []), ...(approvedByMe.data ?? [])];
    // Deduplicate by id, sort by created_at desc
    const seen = new Set<string>();
    return (combined as Reminder[])
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  };

  const fetchRemindersQuiet = async (user?: TeamUser | null) => {
    let activeUser: TeamUser | null = user ?? currentUser;
    if (!activeUser) activeUser = getSession<TeamUser>();
    const data = await fetchRemindersForUser(activeUser);
    setReminders(data);
  };

  const fetchReminders = async () => {
    setListLoading(true);
    setFetchError(null);
    let activeUser: TeamUser | null = currentUser;
    if (!activeUser) activeUser = getSession<TeamUser>();
    try {
      const data = await fetchRemindersForUser(activeUser);
      setReminders(data);
    } catch (err: any) {
      setFetchError(err?.message ?? 'Gagal memuat data');
    }
    setTimeout(() => setListLoading(false), 400);
  };

  // CRUD

  /*
    Kembalikan project ke daftar Incentive PTS.

    Pasangan dari tombol "Keluarkan dari Incentive" di sana. Daftar Incentive
    diturunkan dari halaman ini - kategori Konfigurasi / Konfigurasi & Training
    / Training yang berstatus selesai - jadi satu-satunya yang bisa menahannya
    adalah penanda `incentive_excluded`. Tombol ini melepas penanda itu.

    Sengaja HANYA muncul pada jadwal yang memang sedang dikeluarkan. Tombol
    yang selalu terlihat tetapi tidak mengubah apa pun mengajari orang untuk
    mengabaikannya, dan lama-lama tombol yang benar-benar penting ikut
    diabaikan.
  */
  /**
   * Jadwal ini termasuk yang dihitung Incentive PTS?
   *
   * Tombol Sync tampil pada SETIAP jadwal yang memenuhi syarat, bukan hanya
   * yang sedang dikeluarkan. Semula saya batasi ke yang dikeluarkan saja
   * dengan alasan "tombol yang tidak mengubah apa-apa akan diabaikan" -
   * tetapi akibatnya tombolnya tidak pernah terlihat sama sekali sampai ada
   * yang dikeluarkan lebih dulu, sehingga tidak ada cara menemukannya. Tombol
   * yang tidak bisa ditemukan lebih buruk daripada tombol yang kadang
   * bekerjanya cuma memastikan.
   */
  const layakIncentive = (r: Reminder): boolean =>
    adalahKategoriInsentif(r.category)
    && r.status === 'done';

  const diluarIncentive = (r: Reminder): boolean => r.incentive_excluded === true;

  const [syncing, setSyncing] = useState<string | null>(null);

  async function syncKeIncentive(r: Reminder) {
    const memangDiluar = diluarIncentive(r);
    setSyncing(r.id);
    const { error } = await supabase.from('reminders')
      .update({ incentive_excluded: false }).eq('id', r.id);
    setSyncing(null);
    if (error) {
      // Kolomnya belum dipasang - sebut berkas SQL-nya, jangan biarkan orang
      // menebak dari pesan basis data yang mentah.
      notify('error', /does not exist/i.test(error.message)
        ? 'Fitur ini belum aktif — Admin perlu menjalankan sql/incentive-keluarkan-proyek.sql lebih dulu.'
        : 'Gagal sync: ' + error.message);
      return;
    }
    if (!memangDiluar) {
      // Tidak ada yang berubah; katakan apa adanya, jangan mengaku memperbaiki
      // sesuatu yang memang sudah benar.
      notify('success', `"${r.project_name}" memang sudah masuk daftar Incentive PTS.`);
      await fetchRemindersQuiet();
      return;
    }
    void logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      module: 'reminder-schedule', action: 'update',
      target_id: r.id, target_name: r.project_name,
      old_value: 'dikeluarkan dari Incentive',
      new_value: 'ikut dihitung di Incentive',
      notes: 'Dikembalikan lewat tombol Sync ke Incentive PTS',
    });
    /*
      Sync TIDAK PERNAH menulis bast_date - lihat komentar di atas fungsi ini.
      Kalau baris yang barusan disinkronkan kebetulan tidak punya BAST sama
      sekali (proyek lama dari sebelum modal Completed mewajibkan BAST, atau
      backup-nya kosong di semua baris batch), tombolnya akan langsung hilang
      lagi setelah loadAll() karena layakIncentive() tidak melihat bast_date -
      tapi Generate Tahapan di Incentive PTS tetap tidak akan pernah muncul.
      Tanpa peringatan ini, itu terlihat seperti "sudah beres" padahal masih
      tertahan - persis yang terjadi pada Steak 21 Gading Serpong.
    */
    notify(r.bast_date ? 'success' : 'error',
      r.bast_date
        ? `"${r.project_name}" kembali masuk daftar Incentive PTS.`
        : `"${r.project_name}" kembali masuk daftar Incentive PTS, tapi BAST-nya masih kosong — `
          + 'tahapan pencairan tidak akan bisa dibuat sampai Tanggal BAST diisi lewat '
          + '💲 Input Nominal di layar Incentive PTS.');
    await fetchRemindersQuiet();
  }

  /**
   * Jadwal kategori insentif yang sudah ada untuk nama proyek ini.
   *
   * Dibaca dari daftar yang SUDAH termuat, bukan kueri baru - halaman ini
   * memang sudah memegang seluruh reminder yang boleh dilihat pengguna, dan
   * satu permintaan tambahan tiap kali orang menekan Simpan adalah pemborosan
   * yang tidak perlu.
   */
  /**
   * Pakai kelompok yang sudah ada di antara `sumber`, atau buat baru dan tandai
   * seluruh baris `sumber` dengannya.
   *
   * Dipakai dua tempat: tombol "Satu proyek yang sama" di langkah 4-pertanyaan
   * (Lapis 1), dan pemilihan project lewat pencarian saat membuat jadwal baru
   * (Lapis 4). Satu fungsi, supaya dua jalan menuju kesimpulan yang sama tidak
   * bisa diam-diam menghasilkan aturan yang berbeda.
   */
  const resolveGrupInsentif = async (sumber: Reminder[]): Promise<string> => {
    const adaGrup = sumber.find(r => r.incentive_group_id)?.incentive_group_id;
    const grup = adaGrup ?? crypto.randomUUID();
    if (!adaGrup) {
      const idLama = sumber.map(r => r.id);
      await supabase.from('reminders').update({ incentive_group_id: grup }).in('id', idLama);
    }
    return grup;
  };

  const cariProyekSerupa = (nama: string, kategori: string): Reminder[] => {
    if (!adalahKategoriInsentif(kategori)) return [];
    const n = normalkanNama(nama);
    if (!n) return [];
    return reminders.filter(r =>
      normalkanNama(r.project_name) === n
      && adalahKategoriInsentif(r.category)
      && r.status !== 'cancelled');
  };

  const handleSave = async (argGrup?: string | null) => {
    /*
      Hanya string atau null yang diterima sebagai penanda kelompok.

      Fungsi ini dipasang sebagai onSubmit, dan onSubmit dipanggil tanpa
      argumen - tapi cukup seseorang kelak menyambungkannya ke onClick, dan
      objek MouseEvent akan masuk ke sini lalu tertulis ke kolom yang
      menentukan pembagian uang. Penyaring ini murah; kekeliruannya tidak.
    */
    const grupInsentif = (typeof argGrup === 'string' || argGrup === null) ? argGrup : undefined;

    if (!formData.project_name.trim())            { notify('error', 'Nama project wajib diisi!');  return; }
    if (bulkTarget === 'none' && !formData.assigned_to) { notify('error', 'Pilih anggota team!'); return; }
    if (!formData.due_date)                { notify('error', 'Tanggal wajib diisi!');          return; }
    if (!formData.address.trim()) { notify('error', 'Lokasi Project wajib diisi!');  return; }

    const isTriggerCat = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(formData.category);
    if (!formData.sales_name?.trim()) {
      notify('error', 'Pilih Sales wajib diisi!');
      return;
    }
    if (isTriggerCat && !formData.sales_name?.trim()) {
      notify('error', `Kategori "${formData.category}" memerlukan pilihan Guest / Sales untuk form review!`);
      return;
    }

    // Identitas uuid dicatat berdampingan dengan namanya - uuid menjawab SIAPA,
    // nama tetap menjawab TERCATAT SEBAGAI SIAPA. Sales dicari di antara akun
    // guest maupun akun tim, karena jadwal bisa diatasnamakan keduanya. Kalau
    // namanya dimiliki lebih dari satu akun, idDariNama sengaja menjawab null:
    // baris itu tetap bekerja lewat nama, persis seperti sebelum perubahan ini.
    const semuaOrang = [...guestUsers, ...teamUsers];
    const salesUserId = idDariNama(semuaOrang, formData.sales_name);

    /*
      Sebelum membuat jadwal baru: kalau proyek dengan nama sama sudah punya
      jadwal kategori insentif, tanyakan hubungannya. Pertanyaannya muncul
      SEKALI - grupInsentif yang sudah terisi (atau dijawab "terpisah") membuat
      alur ini lanjut tanpa bertanya lagi.

      TIDAK ditanyakan bila project-nya sudah dipilih lewat pencarian Lapis 4
      (proyekLamaTerpilih terisi) - saat itu hubungannya sudah dipastikan lewat
      pencarian, bukan ditebak dari kecocokan nama. Menanyakannya lagi hanya
      mengulang jawaban yang sudah diberikan. Kelompoknya tetap diresolve di
      sini, bukan saat menekan "OK, Isi Form" - supaya kategori pekerjaan yang
      BARU (yang baru diketahui sekarang, setelah form diisi) yang menentukan
      apakah penggabungan ini relevan sama sekali.
    */
    if (!editingReminder && grupInsentif === undefined) {
      if (proyekLamaTerpilih) {
        const relevan = adalahKategoriInsentif(formData.category)
          ? proyekLamaTerpilih.filter(r => adalahKategoriInsentif(r.category))
          : [];
        const grup = relevan.length > 0 ? await resolveGrupInsentif([...relevan]) : null;
        void handleSave(grup);
        return;
      }
      const serupa = cariProyekSerupa(formData.project_name, formData.category);
      if (serupa.length > 0) {
        setTanyaLanjutan({
          nama: formData.project_name.trim(),
          sebelumnya: serupa,
          lanjut: (grup) => { setTanyaLanjutan(null); void handleSave(grup); },
        });
        return;
      }
    }

    // Multi-tanggal: satu pengiriman untuk beberapa hari sekaligus. Berlaku
    // saat MEMBUAT maupun MENYUNTING - lihat rekonsiliasi tanggal di bawah.
    const allDates: string[] = Array.from(
      new Set([formData.due_date, ...extraDates].filter(Boolean))).sort();
    // Grup semua baris dari 1 submission multi-tanggal - supaya Schedule List
    // menampilkannya sbg 1 baris (bukan N baris identik per tanggal).
    const batchId = (!editingReminder && allDates.length > 1) ? newBatchId() : null;
    const jadwalLine = allDates.length > 1
      ? `🕐 *Jadwal (${allDates.length} hari):* ${allDates.map(d => formatDate(d)).join(', ')}${formData.due_time ? ' · ' + formData.due_time : ''}`
      : `🕐 Jadwal: *${formatDate(formData.due_date)}${formData.due_time ? ' · ' + formData.due_time : ''}*`;

    // BULK ASSIGN
    if (bulkTarget !== 'none') {
      const teamTypeMap: Record<string, string> = { ivp: 'Team PTS IVP', mvi: 'Team PTS MVI', ump: 'Team PTS UMP' };
      const bulkLabelMap: Record<string, string> = { ivp: 'PTS IVP', mvi: 'PTS MVI', ump: 'PTS UMP' };
      const targets = teamUsers.filter(u => u.team_type === teamTypeMap[bulkTarget]);
      if (targets.length === 0) { notify('error', 'Tidak ada anggota team yang ditemukan!'); return; }
      setSaving(true);
      const payloads = targets.flatMap(u => allDates.map(d => ({
        ...formData,
        due_date: d,
        ...progressTimelinePayload(),
        batch_id: batchId,
        assigned_to: u.username,
        assign_name: u.full_name,
        sales_user_id: salesUserId,
        assign_user_id: u.id,
        created_by: currentUser?.username ?? 'system',
        ...progressTimelinePayload(),
      })));
      // .select() supaya id reminder yang baru dibuat bisa ditautkan ke draft
      // Project Progress. Tanpa id, penautan & pencegahan duplikat mustahil.
      const { data: bulkRows, error: bulkErr } = await cobaIdentitas(async pakaiUuid =>
        await supabase.from('reminders').insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas))
          .select('id, project_name, address, sales_name, sales_division, assign_name, due_date, category, progress_start_date, progress_target_date'));
      if (bulkErr) { notify('error', 'Gagal menyimpan: ' + bulkErr.message); setSaving(false); return; }
      void syncNewRemindersToProgress((bulkRows ?? []) as ReminderSnapshot[]);
      notify('success', `${payloads.length} reminder dibuat untuk Tim ${bulkLabelMap[bulkTarget]}${allDates.length > 1 ? ` (${allDates.length} hari)` : ''}!`);
      for (const u of targets) {
        if (u.phone_number) {
          const msg =
            `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
            `Halo *${u.full_name}*, kamu mendapat jadwal baru:\n\n` +
            `*Nama Project: ${formData.project_name}*\n` +
            `*Deskripsi: ${formData.description}*\n` +
            `📦 *Product: ${formData.product}*\n` +
            `🏷️ Kategori: ${formData.category}\n` +
            `📍 Lokasi: ${formData.address || '-'}\n` +
            `👤 Sales: ${formData.sales_name}${formData.sales_division ? ' - ' + formData.sales_division : ''}\n` +
            `${jadwalLine}\n` +
            (formData.pic_name  ? `🙋 PIC: ${formData.pic_name}${formData.pic_phone ? ' - ' + formData.pic_phone : ''}\n\n` : '') +
            (formData.notes     ? `📝 Catatan: ${formData.notes}\n\n` : '') +
            `-\n` +
            `Link Dashboard: https://work-management-ptsivp.vercel.app/dashboard\n` +
            `jangan lupa peralatan & Semangat💪🏼`;
          await sendFonnteWA(u.phone_number, msg, { reminderType: 'new_schedule' });
        }
      }
      setSaving(false);
      setShowFormModal(false);
      setView('list');
      setEditingReminder(null);
      setFormData(emptyForm);
      setBulkTarget('none');
      setExtraDates([]);
      fetchRemindersQuiet();
      return;
    }
    // SINGLE ASSIGN

    const assignee = teamUsers.find(u => u.username === formData.assigned_to);

    setSaving(true);
    let error: { message: string } | null = null;
    /** Baris yang benar-benar tersimpan - dipakai mencatat riwayat pembuatan. */
    let barisBaru: { id: string; project_name: string | null }[] = [];
    // Tujuan "SUP::id::nama" berarti dialihkan ke Supervisor, bukan ke anggota
    // tim. Bedanya: assigned_to dikosongkan dan reminder masuk kembali ke tahap
    // supervisor_assign, sehingga Supervisor itulah yang menentukan siapa yang
    // mengerjakan - persis seperti alur normalnya, bukan jalur pintas.
    const alihKeSupervisor = formData.assigned_to.startsWith('SUP::')
      ? formData.assigned_to.split('::')
      : null;

    if (editingReminder) {
      // Saat menyunting, uuid lama TIDAK boleh ditimpa null hanya karena nama
      // yang sama itu ambigu. Kalau namanya tidak berubah, uuid yang sudah
      // tercatat dipertahankan - ia hasil penetapan sebelumnya, dan menebak
      // ulang dari nama justru membuang keterangan yang lebih pasti.
      const namaSalesTetap = (formData.sales_name ?? '').trim() === (editingReminder.sales_name ?? '').trim();
      // progressTimelinePayload() WAJIB ikut di jalur sunting, bukan cuma di
      // jalur buat-baru. Saat form dibuka, progress_start_date/target diisi
      // `r.xxx ?? ''` - jadi reminder yang tanggal progress-nya NULL memberi
      // string kosong, dan string kosong dikirim apa adanya ke kolom bertipe
      // date: "invalid input syntax for type date". Seluruh penyuntingan gagal,
      // termasuk yang tidak menyentuh tanggal sama sekali.
      // Fungsi ini juga yang mengosongkan tanggal ketika kategorinya berganti
      // ke kategori yang bukan pemicu Project Progress.
      const payload = { ...formData, ...progressTimelinePayload(),
        assign_name: assignee?.full_name ?? formData.assigned_to,
        sales_user_id: namaSalesTetap ? (editingReminder.sales_user_id ?? salesUserId) : salesUserId,
        assign_user_id: assignee?.id ?? null,
        // created_by TIDAK ditimpa. Ia menjawab siapa yang MEMBUAT jadwal ini,
        // dan menyuntingnya tidak mengubah jawaban itu. Sebelumnya kolom ini
        // diisi ulang dengan penyunting, sehingga satu suntingan admin
        // menghapus jejak pembuat aslinya - sekaligus, bila kelak RLS
        // dinyalakan untuk reminders, memindahkan kepemilikan barisnya.
        created_by: editingReminder.created_by ?? currentUser?.username ?? 'system',
        updated_at: new Date().toISOString() };
      if (alihKeSupervisor) {
        const [, supId] = alihKeSupervisor;
        Object.assign(payload, {
          assigned_to: '', assign_name: '', assign_user_id: null,
          routing_status: 'supervisor_assign', assigned_supervisor_id: supId,
        });
      }
      /*
        Menyunting jadwal multi-tanggal harus mengenai SELURUH tanggalnya.

        Dulu pembaruan dipatok .eq('id', editingReminder.id), jadi menyunting
        jadwal lima hari hanya mengubah satu baris - empat hari lainnya tetap
        membawa produk, kategori, dan penangan yang lama. Daftar menampilkannya
        sebagai satu baris, jadi ketidakcocokan itu tidak terlihat sampai
        seseorang membuka detailnya.

        due_date SENGAJA dikeluarkan dari pembaruan bersama: tiap baris punya
        tanggalnya sendiri, dan menimpanya dengan satu nilai akan meruntuhkan
        seluruh jadwal ke satu hari.
      */
      const sebatchLama = editingReminder.batch_id
        ? reminders.filter(x => x.batch_id === editingReminder.batch_id)
        : [editingReminder];
      const barisLama = [...sebatchLama].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
      const { due_date: _tanggalBersama, ...payloadBersama } = payload as Record<string, unknown>;

      // Jadwal sehari yang kini jadi berhari-hari perlu batch_id; yang sudah
      // punya tetap memakai miliknya supaya tautan lama tidak putus.
      const batchSunting = allDates.length > 1
        ? (editingReminder.batch_id ?? newBatchId())
        : editingReminder.batch_id ?? null;

      /*
        Baris lama DIPAKAI ULANG untuk tanggal baru, tidak dihapus lalu dibuat
        lagi. Id baris inilah yang ditunjuk tickets.reminder_id, form_reviews,
        dan tahapan insentif - membuat baris baru berarti memutus semuanya
        hanya karena tanggalnya digeser.
      */
      const jumlahDipakai = Math.min(barisLama.length, allDates.length);
      const galatSunting: string[] = [];
      for (let i = 0; i < jumlahDipakai; i++) {
        const r = await cobaIdentitas(async pakaiUuid => {
          const isi = { ...payloadBersama, due_date: allDates[i], batch_id: batchSunting };
          return await supabase.from('reminders')
            .update(pakaiUuid ? isi : tanpaIdentitas(isi as typeof payload))
            .eq('id', barisLama[i].id);
        });
        if (r.error) galatSunting.push(r.error.message);
      }
      // Tanggal berkurang: baris sisanya dibuang.
      const dibuang = barisLama.slice(jumlahDipakai).map(r => r.id);
      if (dibuang.length > 0) {
        const r = await supabase.from('reminders').delete().in('id', dibuang);
        if (r.error) galatSunting.push(r.error.message);
      }
      // Tanggal bertambah: baris baru menyusul, tetap satu batch.
      if (allDates.length > barisLama.length) {
        const tambahan = allDates.slice(barisLama.length).map(d => ({
          ...payloadBersama, due_date: d, batch_id: batchSunting,
        }));
        const r = await cobaIdentitas(async pakaiUuid =>
          await supabase.from('reminders')
            .insert(pakaiUuid ? tambahan : tambahan.map(x => tanpaIdentitas(x as typeof payload))));
        if (r.error) galatSunting.push(r.error.message);
      }
      error = galatSunting.length > 0 ? { message: galatSunting[0] } : null;
    } else {
      const payloads = allDates.map(d => ({
        ...formData,
        due_date: d,
        ...progressTimelinePayload(),
        batch_id: batchId,
        // Hanya ditulis bila memang dijawab "kelanjutan" - kolomnya boleh NULL,
        // dan NULL di sini berarti "berdiri sendiri", bukan "belum tahu".
        ...(grupInsentif ? { incentive_group_id: grupInsentif } : {}),
        assign_name: assignee?.full_name ?? formData.assigned_to,
        sales_user_id: salesUserId,
        assign_user_id: assignee?.id ?? null,
        created_by: currentUser?.username ?? 'system',
        // Dibuat langsung ke Supervisor: jadwal masuk ke tahap supervisor_assign
        // dengan pelaksana masih kosong, jadi Supervisor itu yang menentukan
        // siapa yang mengerjakan - alurnya sama dengan ticket Troubleshooting.
        ...(alihKeSupervisor ? {
          assigned_to: '', assign_name: '', assign_user_id: null,
          routing_status: 'supervisor_assign',
          assigned_supervisor_id: alihKeSupervisor[1],
        } : {}),
      }));
      const insRes = await cobaIdentitas(async pakaiUuid =>
        await supabase.from('reminders').insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas))
          .select('id, project_name, address, sales_name, sales_division, assign_name, due_date, category, progress_start_date, progress_target_date'));
      error = insRes.error;
      barisBaru = (insRes.data ?? []) as { id: string; project_name: string | null }[];
      if (!insRes.error) void syncNewRemindersToProgress((insRes.data ?? []) as ReminderSnapshot[]);
    }

    if (error) {
      notify('error', 'Gagal menyimpan: ' + error.message);
      setSaving(false);
      return;
    }

    if (editingReminder) {
      // Catat APA yang berubah, bukan sekadar bahwa ada perubahan.
      // Saat dialihkan ke Supervisor, `assigned_to` dikeluarkan dari perbandingan:
      // yang tersimpan di database adalah string kosong (Supervisor-lah yang
      // menentukan pelaksana), bukan nilai dropdown-nya, dan tujuannya sudah
      // disebut di awal catatan. Membandingkannya hanya menghasilkan baris yang
      // mengulang - atau, kalau tidak diterjemahkan, membocorkan penanda internal.
      const bandingkanDengan = { ...(formData as unknown as Record<string, unknown>) };
      if (alihKeSupervisor) delete bandingkanDengan.assigned_to;
      const perubahanEdit = bandingkan(
        REMINDER_FIELDS,
        editingReminder as unknown as Record<string, unknown>,
        bandingkanDengan,
      );
      logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'update', module: 'reminder',
        target_id: editingReminder.id, target_name: formData.project_name,
        notes: alihKeSupervisor
          ? `Re-route ke Supervisor ${alihKeSupervisor[2]}${perubahanEdit.length ? ' | ' + ringkasPerubahan(perubahanEdit) : ''}`
          : (perubahanEdit.length ? ringkasPerubahan(perubahanEdit) : 'Disimpan tanpa perubahan'),
      }).catch(() => {});

      // Dialihkan ke Supervisor: yang perlu dikabari adalah Supervisor itu,
      // bukan assignee lama - assigned_to sudah dikosongkan di atas, jadi blok
      // WA di bawah tidak akan menemukan siapa pun untuk dikirimi.
      if (alihKeSupervisor) {
        const supUser = teamUsers.find(u => u.id === alihKeSupervisor[1]);
        if (supUser?.phone_number) {
          void sendFonnteWA(supUser.phone_number, pesanWAPerubahan({
            namaPenerima: supUser.full_name,
            namaPengubah: currentUser?.full_name ?? 'Admin',
            judulItem: formData.project_name,
            jenisItem: 'Jadwal',
            perubahan: perubahanEdit,
            reroute: { dari: editingReminder.assign_name ?? '', ke: supUser.full_name },
            tautan: 'https://team-ticketing.vercel.app/reminder-schedule',
          }));
        }
        if (supUser?.id) {
          void createNotification({
            user_id: supUser.id, type: 'reminder',
            title: '🔀 Jadwal dialihkan ke kamu',
            body: `${formData.project_name} — pilih anggota tim yang mengerjakan`,
            action_url: '/reminder-schedule', ref_id: editingReminder.id,
            created_by: currentUser?.full_name ?? 'Admin',
          });
        }
      }

      // Beri tahu yang menangani. Tanpa ini, koreksi tanggal atau alamat tidak
      // pernah sampai ke orang yang akan berangkat ke lokasi.
      if (perubahanEdit.length > 0 && assignee?.phone_number && assignee.full_name !== currentUser?.full_name) {
        void sendFonnteWA(
          assignee.phone_number,
          pesanWAPerubahan({
            namaPenerima: assignee.full_name ?? formData.assigned_to,
            namaPengubah: currentUser?.full_name ?? 'Admin',
            judulItem: formData.project_name,
            jenisItem: 'Jadwal',
            perubahan: perubahanEdit,
            reroute: null,
            tautan: 'https://team-ticketing.vercel.app/reminder-schedule',
          }),
        );
      }
    } else {
      for (const row of barisBaru) {
        logAudit({
          user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
          action: 'create', module: 'reminder',
          target_id: row.id, target_name: row.project_name ?? formData.project_name,
          notes: `Dibuat langsung oleh admin — kategori ${formData.category}`,
        }).catch(() => {});
      }
    }
    notify('success', editingReminder ? 'Reminder diperbarui!' : (allDates.length > 1 ? `${allDates.length} reminder dibuat!` : 'Reminder ditambahkan!'));

    // Kirim WA notifikasi ke assignee saat reminder BARU dibuat
    // Dibuat langsung ke Supervisor: yang dikabari Supervisor-nya, bukan
    // pelaksana - pelaksananya memang belum ada, dia yang akan menentukan.
    if (!editingReminder && alihKeSupervisor) {
      const supUser = teamUsers.find(u => u.id === alihKeSupervisor[1]);
      if (supUser?.phone_number) {
        void sendFonnteWA(supUser.phone_number, [
          '🎯 *Jadwal Perlu Di-assign ke Tim*',
          '━━━━━━━━━━━━━━━━━━',
          `Halo *${supUser.full_name}*, kamu dapat jadwal dari *${currentUser?.full_name ?? 'Admin'}*:`,
          `📌 *Project :* ${formData.project_name}`,
          `🏷️ *Kategori:* ${formData.category}`,
          `📍 *Lokasi  :* ${formData.address || '-'}`,
          `🗓️ *Tanggal :* ${formatDate(formData.due_date)} ${formData.due_time || ''}`,
          '━━━━━━━━━━━━━━━━━━',
          'Mohon tentukan anggota tim yang mengerjakan.',
          '🔗 https://team-ticketing.vercel.app/reminder-schedule',
        ].join('\n'));
      }
      if (supUser?.id) {
        void createNotification({
          user_id: supUser.id, type: 'reminder',
          title: '🎯 Jadwal perlu kamu assign',
          body: `${formData.project_name} — dari ${currentUser?.full_name ?? 'Admin'}`,
          action_url: '/reminder-schedule',
          created_by: currentUser?.full_name ?? 'Admin',
        });
      }
    }

    if (!editingReminder && assignee?.phone_number) {
      const assigneeName = assignee.full_name ?? formData.assigned_to;
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
        `Halo *${assigneeName}*, kamu mendapat jadwal baru:\n\n` +
        `*Nama Project: ${formData.project_name}*\n` +
        `*Deskripsi: ${formData.description}*\n` +
        `📦 *Product: ${formData.product}*\n` +
        `🏷️ Kategori: ${formData.category}\n` +
        `📍 Lokasi: ${formData.address || '-'}\n` +
        `👤 Sales: ${formData.sales_name}${formData.sales_division ? ' - ' + formData.sales_division : ''}\n` +
        `${jadwalLine}\n` +
        (formData.pic_name  ? `🙋 PIC: ${formData.pic_name}${formData.pic_phone ? ' - ' + formData.pic_phone : ''}\n\n`    : '') +
        (formData.notes     ? `📝 Catatan: ${formData.notes}\n\n`    : '') +
        `-\n` +
       `Link Dashboard: https://work-management-ptsivp.vercel.app/dashboard\n` +
        `jangan lupa peralatan & Semangat💪🏼`;

      const waResult = await sendFonnteWA(assignee.phone_number, msg, { reminderType: 'new_schedule' });
      if (waResult.ok) notify('success', `WA notifikasi terkirim ke ${assigneeName}!`);
    }

    setSaving(false);
    setShowFormModal(false);
    setView('list');
    setEditingReminder(null);
    setFormData(emptyForm);
    setExtraDates([]);
    setProyekLamaTerpilih(null);
    fetchRemindersQuiet();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('reminders').delete().eq('id', deleteTarget.id);
    if (error) { notify('error', 'Gagal menghapus.'); return; }
    logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'delete', module: 'reminder',
      target_id: deleteTarget.id, target_name: deleteTarget.project_name,
      notes: `Dihapus — jadwal ${formatDate(deleteTarget.due_date)}, status ${deleteTarget.status}`,
    }).catch(() => {});
    notify('success', 'Reminder dihapus.');
    setDetailReminder(null);
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteConfirmText('');
    fetchRemindersQuiet();
  };

  const openDeleteModal = (r: Reminder) => {
    setDeleteTarget(r);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const handleStatusChange = async (id: string, status: Status, photoUrl?: string) => {
    const sebelum = reminders.find(r => r.id === id);

    /*
      Satu jadwal multi-tanggal = SATU pekerjaan, bukan lima.

      Jadwal 5 hari berturut-turut tersimpan sebagai lima baris (satu per
      tanggal) yang diikat batch_id. Daftar sudah menggabungkannya jadi satu
      baris - lihat groupedReminders - tapi penandaan statusnya dulu hanya
      mengenai satu baris. Akibatnya penangan harus menekan "Completed" lima
      kali untuk satu pekerjaan yang sudah selesai, dan sebelum tekanan kelima
      jadwalnya masih tampak menggantung.

      Yang lebih merugikan ada di hilirnya: Incentive Project membaca baris
      reminder, jadi satu pekerjaan Konfigurasi 2 hari terhitung DUA proyek.

      Sekarang seluruh baris sebatch diperbarui sekaligus. Tidak ada layar yang
      bisa menunjuk satu tanggal saja - daftarnya memang sudah satu baris -
      jadi tidak ada perilaku yang hilang karenanya.
    */
    const updatePayload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (photoUrl) updatePayload['completion_photo_url'] = photoUrl;
    const sebatch = sebelum?.batch_id
      ? reminders.filter(r => r.batch_id === sebelum.batch_id)
      : [];
    const { error } = sebelum?.batch_id
      ? await supabase.from('reminders').update(updatePayload).eq('batch_id', sebelum.batch_id)
      : await supabase.from('reminders').update(updatePayload).eq('id', id);
    if (error) { notify('error', 'Gagal update status.'); return; }
    logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'status_change', module: 'reminder',
      target_id: id, target_name: sebelum?.project_name ?? '',
      old_value: sebelum?.status, new_value: status,
      // Jumlah tanggal ikut dicatat: tanpa itu, catatan audit untuk jadwal
      // lima hari tidak bisa dibedakan dari jadwal sehari.
      notes: [
        photoUrl ? 'Disertai foto penyelesaian' : '',
        sebatch.length > 1 ? `Berlaku untuk ${sebatch.length} tanggal dalam jadwal ini` : '',
      ].filter(Boolean).join(' · ') || undefined,
    }).catch(() => {});
    notify('success', sebatch.length > 1
      ? `Status diperbarui untuk ${sebatch.length} tanggal sekaligus.`
      : 'Status diperbarui!');
    // WA ke handler saat status Done
    if (status === 'done') {
      try {
        const reminder = reminders.find(r => r.id === id);
        if (reminder) {
          // JANGAN filter team_type: assigned_to (username) sudah unik per user,
          // dan handler bisa dari Team PTS IVP/UMP/MVI mana pun. Menyaring ke
          // satu tim membuat handlerUser null dan WA "selesai" tidak terkirim.
          const { data: handlerUser } = await supabase
            .from('users').select('phone_number, full_name')
            .eq('username', reminder.assigned_to)
            .maybeSingle();
          if (handlerUser?.phone_number) {
            const msg =
              `✅ *JADWAL SELESAI*\n\n` +
              `Terima kasih *${handlerUser.full_name}*!\n` +
              `Jadwal *${reminder.project_name}* sudah *Selesai*.\n` +
              `📦 *Product: ${reminder.product ?? '-'}*\n` +
              `🏷️ ${reminder.category} · ${formatDate(reminder.due_date)}\n` +
              `\nTetap semangat! 💪`;
            await sendFonnteWA(handlerUser.phone_number, msg);
          }

          // Auto-insert ke form_reviews jika kategori trigger & ada sales_name
          const isTriggerCategory = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(reminder.category);
          const salesName = reminder.sales_name?.trim();
          if (isTriggerCategory && salesName) {
            try {
              // Selalu fetch guest dari DB (tidak andalkan state guestUsers yang bisa saja belum terisi)
              const { data: guestFromDb } = await supabase
                .from('users')
                .select('id, username, full_name, role, phone_number, sales_division')
                .eq('role', 'guest')
                .eq('full_name', salesName)
                .maybeSingle();

              // Fallback ke guestUsers state jika DB tidak return
              const resolvedGuest = guestFromDb ?? guestUsers.find(g => g.full_name === salesName) ?? null;

              // Cek apakah sudah ada form_review untuk reminder ini - kalau reminder ini
              // bagian dari batch multi-tanggal, cek per BATCH (bukan per tanggal) supaya
              // menyelesaikan tanggal ke-2/3 dst di batch yang sama tidak bikin review dobel.
              let existingQuery = supabase.from('form_reviews').select('id').eq('sales_name', salesName);
              existingQuery = reminder.batch_id
                ? existingQuery.eq('batch_id', reminder.batch_id)
                : existingQuery.eq('reminder_id', reminder.id);
              const { data: existingReview } = await existingQuery.maybeSingle();

              if (!existingReview) {
                const reviewCategory = reminder.category === 'Demo Product' ? 'Demo Product' : 'BAST';
                const productValue = reminder.product?.trim() || '';
                const barisReview = {
                  reminder_id: reminder.id,
                  batch_id: reminder.batch_id ?? null,
                  project_name: reminder.project_name,
                  address: reminder.address || '',
                  sales_name: salesName,
                  // uuid berdampingan dengan namanya. sales_user_id diambil dari
                  // reminder-nya kalau ada - itu identitas yang sudah dipastikan
                  // saat jadwal dibuat, bukan hasil pencocokan nama ulang.
                  sales_user_id: reminder.sales_user_id ?? resolvedGuest?.id ?? null,
                  guest_user_id: resolvedGuest?.id ?? null,
                  sales_division: reminder.sales_division || '',
                  assign_name: reminder.assign_name,
                  assigned_to: reminder.assigned_to,
                  reminder_category: reminder.category,
                  review_category: reviewCategory,
                  // Auto-insert product ke kolom yang sesuai berdasarkan review_category
                  ...(reviewCategory === 'Demo Product'
                    ? { product_demo: productValue }
                    : { product_bast: productValue }),
                  // guest_fullname = full_name Guest (= sales_name), wajib NOT NULL
                  guest_fullname: resolvedGuest?.full_name ?? salesName,
                  // guest_username untuk filter di Form Review page
                  guest_username: resolvedGuest?.username ?? '',
                };
                const { error: reviewErr } = await cobaIdentitas(async pakaiUuid =>
                  await supabase.from('form_reviews').insert([pakaiUuid ? barisReview : tanpaIdentitas(barisReview)]));

                if (!reviewErr) {
                  notify('success', `Form review otomatis dibuat untuk ${salesName}!`);

                  // Kirim WA notifikasi ke guest
                  if (resolvedGuest?.phone_number) {
                    const guestMsg =
                      `⭐ *REVIEW DIMINTA — PTS IVP*\n\n` +
                      `Halo *${resolvedGuest.full_name}*!\n\n` +
                      `Jadwal *${reminder.category}* untuk project:\n` +
                      `*Kategori: ${reminder.category}*\n` +
                      `*Team kami: ${reminder.assign_name}*\n` +
                      `📦 *Product: ${reminder.product ?? '-'}*\n` +
                      `📋 *${reminder.project_name}*\n` +
                      `📍 ${reminder.address || '-'}\n\n` +
                      `telah selesai dilaksanakan oleh tim kami.\n\n` +
                      `Mohon berikan penilaian / review Anda melalui dashboard:\n` +
                      `🔗 https://work-management-ptsivp.vercel.app/dashboard\n\n` +
                      `Terima kasih! 🙏`;
                    await sendFonnteWA(resolvedGuest.phone_number, guestMsg);
                  }
                }
              }
            } catch (err: any) {
              console.warn('[reminder] form-review creation/WA to guest failed:', err?.message);
            }
          }
        }
      } catch (err: any) {
        console.warn('[reminder] WA to handler failed:', err?.message);
        notify('error', 'WA ke handler gagal dikirim. Status berhasil disimpan.');
      }
    }
    fetchRemindersQuiet();
    if (detailReminder?.id === id) setDetailReminder(prev => prev ? { ...prev, status } : null);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!detailReminder || !pendingStatus) return;
    setUpdatingStatus(true);
    let photoUrl: string | undefined;
    if (statusPhoto) {
      const compressed = await compressImage(statusPhoto);
      const ext = compressed.name.split('.').pop();
      const fileName = `completion_${detailReminder.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('reminder-photos')
        .upload(fileName, compressed, { upsert: true, cacheControl: '31536000' });
      if (upErr) {
        notify('error', 'Gagal upload foto: ' + upErr.message);
        setUpdatingStatus(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('reminder-photos').getPublicUrl(fileName);
      photoUrl = urlData?.publicUrl;
    }

    // Jika kategori incentive-trigger dan status Completed  tampilkan mode modal
    const isIncentiveCat = (INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category);
    if (pendingStatus === 'done' && isIncentiveCat) {
      setPendingPhotoUrl(photoUrl);
      setModePenyelesaian(null);
      setInstallerName('');
      setInstallerDaerah('');
      setBastDate(new Date().toISOString().split('T')[0]);
      setDisplayType(null);
      setRequiresMiddleware(false);
      setRequiresControllerAuto(false);
      setControllerBrand(null);
      setUpdatingStatus(false);
      setShowModeModal(true);
      return;
    }

    await handleStatusChange(detailReminder.id, pendingStatus, photoUrl);
    setPendingStatus(null);
    setStatusPhoto(null);
    setStatusPhotoPreview(null);
    setUpdatingStatus(false);
  };

  const handleModeConfirm = async () => {
    if (!detailReminder || !modePenyelesaian) {
      notify('error', 'Pilih mode penyelesaian terlebih dahulu!');
      return;
    }
    if (!bastDate) { notify('error', 'Tanggal BAST wajib diisi!'); return; }
    if (!displayType) { notify('error', 'Tipe Display wajib dipilih (LED / LCD / Mix)!'); return; }
    if (requiresControllerAuto && !controllerBrand) { notify('error', 'Pilih brand Controller Automation (Cue / Extron / Wyrestorm)!'); return; }
    if (modePenyelesaian === 'remote') {
      if (!installerName.trim()) { notify('error', 'Nama Installer wajib diisi untuk mode Remote!'); return; }
      if (!installerDaerah.trim()) { notify('error', 'Daerah Installer wajib diisi untuk mode Remote!'); return; }
    }
    const snap = detailReminder;
    const reminderId = snap.id;
    const modeVal = modePenyelesaian;
    const installerNameVal = installerName.trim();
    const installerDaerahVal = installerDaerah.trim();
    const bastDateVal = bastDate || null;

    setSavingMode(true);
    // Auto: kalau handler ber-jabatan Manager (dari Struktur Organisasi), skema
    // Manager-as-PIC berlaku otomatis - tidak perlu dipilih manual.
    const { data: handlerUser } = await supabase.from('users').select('jabatan').eq('username', snap.assigned_to).maybeSingle();
    const autoPicType: 'standard' | 'manager_pic' = handlerUser?.jabatan === 'Manager' ? 'manager_pic' : 'standard';
    const isiPenyelesaian = {
      mode_penyelesaian: modeVal,
      installer_name: modeVal === 'remote' ? installerNameVal : null,
      installer_daerah: modeVal === 'remote' ? installerDaerahVal : null,
      bast_date: bastDateVal,
      display_type: displayType,
      requires_middleware: requiresMiddleware,
      requires_controller_automation: requiresControllerAuto,
      controller_automation_brand: requiresControllerAuto ? controllerBrand : null,
      pic_type: autoPicType,
    };
    /*
      Ditulis ke SELURUH baris sebatch, bukan hanya baris yang sedang dibuka.

      Jadwal berhari-hari tersimpan sebagai beberapa baris yang diikat batch_id,
      dan penandaan statusnya memang sudah mengenai semuanya (lihat
      handleStatusChange). Tapi BAST/mode/installer dulu hanya menempel di SATU
      baris - baris yang kebetulan dibuka dari daftar, yaitu tanggal paling
      AWAL. Sementara itu layar Incentive memilih wakil proyeknya lewat
      gabungkanProyek(), yang sengaja mengambil tanggal paling AKHIR (lihat
      lib/kelompok-insentif.ts) - baris yang justru tidak pernah diisi.

      Akibatnya proyek dari jadwal multi-tanggal muncul di Incentive dengan
      BAST "Belum diisi" walau formulirnya sudah diisi lengkap, dan tombol
      Generate Tahapan tidak pernah muncul karena syaratnya adalah adanya BAST.
      Satu pekerjaan = satu tanggal BAST, jadi seluruh barisnya harus membawa
      keterangan yang sama - bukan hanya salah satunya.
    */
    await (snap.batch_id
      ? supabase.from('reminders').update(isiPenyelesaian).eq('batch_id', snap.batch_id)
      : supabase.from('reminders').update(isiPenyelesaian).eq('id', reminderId));
    setShowModeModal(false);
    setSavingMode(false);
    await handleStatusChange(reminderId, 'done', pendingPhotoUrl);

    /*
      Tulisan ke tabel `incentive_projects` DIHAPUS dari sini - kode zombie
      sisa arsitektur lama sebelum Incentive PTS pindah membaca langsung dari
      `reminders` (lihat fetchIncentiveProjects di
      app/incentive-pts/_components/calc.ts: category+status+incentive_excluded
      langsung dari tabel ini, TANPA pernah menyentuh `incentive_projects`).

      Tabel itu ditulis di sini setiap proyek ditandai Done, tapi TIDAK ADA
      satu query SELECT pun ke sana di seluruh kode - baris yang ditulis
      tidak pernah dibaca siapa pun. Kalau insert-nya gagal (skema kolom
      beda, RLS berubah, dll), muncul toast "Gagal sync ke Incentive PTS" -
      padahal sinkronisasi Incentive PTS yang SUNGGUHAN (baca `reminders`
      langsung) sama sekali tidak terganggu. Itu kepanikan palsu, bukan
      peringatan yang berarti.
    */

    setPendingStatus(null);
    setStatusPhoto(null);
    setStatusPhotoPreview(null);
    setModePenyelesaian(null);
    setInstallerName('');
    setInstallerDaerah('');
    setDisplayType(null);
    setRequiresMiddleware(false);
    setRequiresControllerAuto(false);
    setControllerBrand(null);
    setPendingPhotoUrl(undefined);
  };

  // Resend / Manual Send Form Review ke Guest
  const handleResendFormReview = async (r: Reminder) => {
    if (!r.sales_name?.trim()) {
      notify('error', 'Reminder ini tidak memiliki Sales yang terpilih!');
      return;
    }
    const isTrigger = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(r.category);
    if (!isTrigger) {
      notify('error', `Kategori "${r.category}" tidak memerlukan form review.`);
      return;
    }
    if (r.status !== 'done') {
      notify('error', 'Status reminder harus Completed untuk mengirim form review!');
      return;
    }

    setResendingFormReview(true);
    try {
      const salesName = r.sales_name.trim();

      // Selalu fetch guest terbaru dari DB berdasarkan full_name === sales_name
      const { data: guestFromDb } = await supabase
        .from('users')
        .select('id, username, full_name, role, phone_number, sales_division')
        .eq('role', 'guest')
        .eq('full_name', salesName)
        .maybeSingle();

      const resolvedGuest = guestFromDb ?? guestUsers.find(g => g.full_name === salesName) ?? null;

      if (!resolvedGuest) {
        notify('error', `Guest dengan nama "${salesName}" tidak ditemukan di database!`);
        setResendingFormReview(false);
        return;
      }

      // Cek apakah form_review sudah ada - batch-aware (lihat catatan di handleStatusChange)
      let existingQueryResend = supabase.from('form_reviews').select('id, guest_username').eq('sales_name', salesName);
      existingQueryResend = r.batch_id
        ? existingQueryResend.eq('batch_id', r.batch_id)
        : existingQueryResend.eq('reminder_id', r.id);
      const { data: existingReview } = await existingQueryResend.maybeSingle();

      if (existingReview) {
        // Patch guest_username jika masih kosong (data lama)
        if (!existingReview.guest_username && resolvedGuest.username) {
          await supabase.from('form_reviews')
            .update({ guest_username: resolvedGuest.username })
            .eq('id', existingReview.id);
        }
        // Form sudah ada - hanya kirim ulang WA
      } else {
        // Buat form_review baru
        const reviewCategory = r.category === 'Demo Product' ? 'Demo Product' : 'BAST';
        const productValue = r.product?.trim() || '';
        const barisReview = {
          reminder_id: r.id,
          batch_id: r.batch_id ?? null,
          project_name: r.project_name,
          address: r.address || '',
          sales_name: salesName,
          sales_user_id: r.sales_user_id ?? resolvedGuest.id ?? null,
          guest_user_id: resolvedGuest.id ?? null,
          sales_division: r.sales_division || '',
          assign_name: r.assign_name,
          assigned_to: r.assigned_to,
          reminder_category: r.category,
          review_category: reviewCategory,
          // Auto-insert product ke kolom yang sesuai berdasarkan review_category
          ...(reviewCategory === 'Demo Product'
            ? { product_demo: productValue }
            : { product_bast: productValue }),
          // guest_fullname = full_name Guest (= sales_name), wajib NOT NULL
          guest_fullname: resolvedGuest.full_name ?? salesName,
          // guest_username untuk filter di Form Review page
          guest_username: resolvedGuest.username,
        };
        const { error: reviewErr } = await cobaIdentitas(async pakaiUuid =>
          await supabase.from('form_reviews').insert([pakaiUuid ? barisReview : tanpaIdentitas(barisReview)]));
        if (reviewErr) {
          notify('error', 'Gagal membuat form review: ' + reviewErr.message);
          setResendingFormReview(false);
          return;
        }
      }

      // Kirim / kirim ulang WA notif ke Guest
      if (resolvedGuest.phone_number) {
        const guestMsg =
          `⭐ *FORM REVIEW — PTS IVP*\n\n` +
          `Halo *${resolvedGuest.full_name}*!\n\n` +
          `Jadwal *${r.category}* untuk project:\n` +
          `*Kategori: ${r.category}*\n` +
          `*Team kami: ${r.assign_name}*\n` +
          `📋 *${r.project_name}*\n` +
          `📦 *Product: ${r.product ?? '-'}*\n` +
          `📍 ${r.address || '-'}\n\n` +
          (r.notes ? `📝 Catatan: ${r.notes}\n` : '') +
          `telah selesai dilaksanakan oleh tim kami.\n\n` +
          `Mohon berikan penilaian / review Anda melalui dashboard:\n` +
          `🔗 https://work-management-ptsivp.vercel.app/dashboard\n\n` +
          `Terima kasih! 🙏`;
        const waResult = await sendFonnteWA(resolvedGuest.phone_number, guestMsg);
        if (waResult.ok) notify('success', `Form review & WA berhasil dikirim ke ${resolvedGuest.full_name}!`);
        else notify('success', `Form review OK. WA gagal: ${waResult.reason ?? 'unknown'}`);
      } else {
        notify('success', `Form review dibuat untuk ${resolvedGuest.full_name}. (Nomor WA tidak ada)`);
      }
    } catch (ex: any) {
      notify('error', 'Terjadi kesalahan: ' + ex.message);
    }
    setResendingFormReview(false);
  };

  /**
   * Label field reminder untuk catatan audit & pesan WA, supaya catatannya
   * menyebut APA yang berubah - bukan sekadar "Detail reminder disunting".
   */
  const REMINDER_FIELDS: AdminField[] = [
    { key: 'project_name', label: 'Nama Project' },
    { key: 'description',  label: 'Deskripsi' },
    { key: 'assigned_to',  label: 'Ditugaskan ke' },
    { key: 'due_date',     label: 'Tanggal' },
    { key: 'due_time',     label: 'Jam' },
    { key: 'priority',     label: 'Prioritas' },
    { key: 'status',       label: 'Status' },
    { key: 'category',     label: 'Kategori' },
    { key: 'sales_name',   label: 'Sales' },
    { key: 'sales_division', label: 'Divisi Sales' },
    { key: 'address',      label: 'Alamat' },
    { key: 'pic_name',     label: 'PIC' },
    { key: 'pic_phone',    label: 'Telepon PIC' },
    { key: 'product',      label: 'Produk' },
    { key: 'product_type', label: 'Tipe Produk' },
    { key: 'notes',        label: 'Catatan' },
    { key: 'warranty_years', label: 'Garansi (tahun)' },
    { key: 'progress_start_date',  label: 'Mulai Pengerjaan' },
    { key: 'progress_target_date', label: 'Target Selesai' },
  ];

  const openEdit = (r: Reminder) => {
    setEditingReminder(r);
    /*
      Tanggal sebatch ikut dimuat ke pemilih multi-tanggal.

      Jadwal 5 hari tersimpan sebagai lima baris ber-batch_id sama. Dulu form
      sunting hanya membawa tanggal baris yang diklik, jadi jadwal lima hari
      tampil seolah sehari - dan menyimpannya diam-diam meninggalkan empat
      baris lain dengan data lama. Yang tampil sekarang seluruh rentangnya,
      dan tanggalnya memang bisa ditambah atau dikurangi dari sini.
    */
    const sebatch = r.batch_id ? reminders.filter(x => x.batch_id === r.batch_id) : [r];
    const tanggal = Array.from(new Set(sebatch.map(x => x.due_date).filter(Boolean))).sort();
    setExtraDates(tanggal.slice(1));
    setFormData({ project_name: r.project_name || (r as any).title || '', description: r.description, assigned_to: r.assigned_to, assign_name: r.assign_name ?? '',
      // Tanggal utama = yang PALING AWAL di batch, bukan baris yang kebetulan
      // diklik - supaya rentangnya terbaca urut di pemilih tanggal.
      due_date: (r.batch_id
        ? [...new Set(reminders.filter(x => x.batch_id === r.batch_id).map(x => x.due_date).filter(Boolean))].sort()[0]
        : r.due_date) || r.due_date,
      due_time: r.due_time, priority: r.priority, status: r.status, repeat: r.repeat, category: r.category,
      sales_name: r.sales_name ?? '', sales_division: r.sales_division ?? '', address: r.address ?? '',
      /*
        brand DULU tidak ikut dimuat, jadi tiap kali jadwal disunting pilihan
        Brand kembali kosong - dan karena ia wajib, penyunting terpaksa
        memilihnya lagi dari ingatan. Salah pilih di situ memindahkan proyeknya
        ke petugas Finance yang lain.
      */
      brand: r.brand ?? undefined,
      pic_name: r.pic_name ?? '', pic_phone: r.pic_phone ?? '', notes: r.notes ?? '', product: r.product ?? '',
      warranty_years: r.warranty_years ?? null, mode_penyelesaian: r.mode_penyelesaian ?? null,
      installer_name: r.installer_name ?? null, installer_daerah: r.installer_daerah ?? null,
      requires_controller_automation: r.requires_controller_automation ?? false,
      controller_automation_brand: r.controller_automation_brand ?? null,
      pic_type: r.pic_type ?? 'standard', pic_id: r.pic_id ?? null,
      incentive_value: r.incentive_value ?? 0, bast_date: r.bast_date ?? null,
      // Tiga field ini PUNYA input di form, tapi dulu tidak pernah dimuat saat
      // menyunting: rentang pengerjaan tampil kosong padahal terisi, dan tipe
      // produk harus dipilih ulang hanya untuk lolos validasi simpan. Catatan
      // auditnya pun ikut salah - lihat komentar di lib/admin-edit.ts.
      progress_start_date: r.progress_start_date ?? '',
      progress_target_date: r.progress_target_date ?? '',
      product_type: r.product_type ?? '',
    });
    setDetailReminder(null);
    setShowFormModal(true);
  };

  // Re-Schedule

  const handleReschedule = async (newDate: string, newTime: string, reason: string) => {
    if (!rescheduleTarget) return;
    const noteAdd = reason ? `\n[Re-Schedule ${formatDate(newDate)}: ${reason}]` : '';
    const { error } = await supabase.from('reminders').update({
      due_date: newDate,
      due_time: newTime,
      updated_at: new Date().toISOString(),
      notes: (rescheduleTarget.notes ?? '') + noteAdd,
    }).eq('id', rescheduleTarget.id);
    if (error) {
      notify('error', `Gagal re-schedule: ${error.message}`);
      return;
    }
    logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'update', module: 'reminder',
      target_id: rescheduleTarget!.id, target_name: rescheduleTarget!.project_name,
      old_value: `${formatDate(rescheduleTarget!.due_date)} ${rescheduleTarget!.due_time ?? ''}`.trim(),
      new_value: `${formatDate(newDate)} ${newTime}`.trim(),
      notes: reason ? `Re-schedule: ${reason}` : 'Re-schedule',
    }).catch(() => {});
    notify('success', `Jadwal berhasil dipindah ke ${formatDate(newDate)}!`);
    // WA ke handler tentang reschedule
    try {
      const { data: handlerUser } = await supabase
        .from('users').select('phone_number, full_name')
        .eq('username', rescheduleTarget.assigned_to)
        .maybeSingle();
      if (handlerUser?.phone_number) {
        const msg =
          `📅 *JADWAL DIUBAH*\n\n` +
          `Halo *${handlerUser.full_name}*, jadwal kamu telah di-reschedule:\n\n` +
          `*Project: ${rescheduleTarget.project_name}*\n` +
          `*Kategori: ${rescheduleTarget.category}*\n` +
          `📦 *Product: ${rescheduleTarget.product ?? '-'}*\n` +
          `📌 Jadwal Lama: ${formatDate(rescheduleTarget.due_date)} ${rescheduleTarget.due_time}\n` +
          `📅 Jadwal Baru: *${formatDate(newDate)} ${newTime}*\n` +
          (rescheduleTarget.pic_name ? `🙋 PIC: ${rescheduleTarget.pic_name}\n` : '') +
          (rescheduleTarget.pic_phone ? `📱 No. PIC: ${rescheduleTarget.pic_phone}\n` : '') +
          (rescheduleTarget.notes ? `📝 Catatan: ${rescheduleTarget.notes}\n` : '') +
          (reason ? `📝 Alasan: ${reason}\n` : '') +
          `\n🔗 https://work-management-ptsivp.vercel.app/dashboard`;
        await sendFonnteWA(handlerUser.phone_number, msg);
      }
    } catch { }
    setRescheduleTarget(null);
    setDetailReminder(null);
    fetchRemindersQuiet();
  };

  // Manual WA send

  const handleSendWA = async (r: Reminder) => {
    if (!r.assigned_to) { notify('error', 'Reminder belum di-assign ke handler.'); return; }
    setSendingWA(r.id);

    // Ambil phone_number handler dari tabel users. JANGAN filter team_type:
    // handler bisa dari Team PTS IVP/UMP/MVI mana pun, dan menyaring ke satu
    // tim membuat tombol ini selalu gagal untuk handler tim lain.
    const { data: handlerData, error: handlerErr } = await supabase
      .from('users')
      .select('phone_number, full_name')
      .eq('username', r.assigned_to)
      .maybeSingle();

    if (handlerErr || !handlerData?.phone_number) {
      setSendingWA(null);
      notify('error', `Nomor WA handler (${r.assign_name || r.assigned_to}) tidak tersedia di database.`);
      return;
    }

    const msg =
      `📋 *REMINDER JADWAL*\n\n` +
      `Halo *${handlerData.full_name}*, ada jadwal yang perlu kamu kerjakan:\n\n` +
      `*Nama Project: ${r.project_name}*\n` +
      `*Deskripsi: ${r.description}*\n` +
      `*Kategori: ${r.category}*\n` +
      `📦 *Product: ${r.product ?? '-'}*\n` +
      `📍 Lokasi: ${r.address || '-'}\n` +
      `👤 Sales: ${r.sales_name || '-'}\n` +
      `    Divisi Sales: ${r.sales_division || '-'}\n` +
      `🕐 Jadwal: *${formatDate(r.due_date)} · ${r.due_time}*\n` +
      (r.pic_name ? `🙋 PIC: ${r.pic_name}\n` : '') +
      (r.pic_phone ? `📱 No. PIC: ${r.pic_phone}\n` : '') +
      (r.notes ? `📝 Catatan: ${r.notes}\n` : '') +
      `\n_Pesan dari Request Schedule PTS IVP_`;

    const result = await sendFonnteWA(handlerData.phone_number, msg, { reminderType: 'manual', reminderId: r.id });
    setSendingWA(null);
    if (result.ok) notify('success', `WA berhasil dikirim ke ${handlerData.full_name}!`);
    else notify('error', `Gagal kirim WA: ${result.reason ?? 'Unknown error'}`);
  };

  // Export Excel

  const handleExportExcel = () => {
    const runExport = (XLSX: any) => {
      const exportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      const border = { top:{style:'thin',color:{rgb:'E2E8F0'}},bottom:{style:'thin',color:{rgb:'E2E8F0'}},left:{style:'thin',color:{rgb:'E2E8F0'}},right:{style:'thin',color:{rgb:'E2E8F0'}} };
      const boldBorder = { top:{style:'thin',color:{rgb:'000000'}},bottom:{style:'thin',color:{rgb:'000000'}},left:{style:'thin',color:{rgb:'000000'}},right:{style:'thin',color:{rgb:'000000'}} };
      const hdr = { font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'0E7490'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border: boldBorder };
      const cell = (v: any) => ({ v: v ?? '', t: 's', s: { font:{name:'Arial',sz:10}, alignment:{vertical:'center',wrapText:true}, border } });
      const titleStyle = { font:{name:'Arial',bold:true,sz:14,color:{rgb:'0E7490'}}, alignment:{horizontal:'left',vertical:'center'} };
      const COLS = 14;
      const data: any[][] = [
        [{ v:'\uD83D\uDDD3\uFE0F Request Schedule \u2014 PTS IVP', t:'s', s:titleStyle }, ...Array(COLS-1).fill({v:'',t:'s',s:{}})],
        [{ v:`Tanggal Export: ${exportDate} | Total: ${filteredReminders.length} data`, t:'s', s:{font:{name:'Arial',sz:10,color:{rgb:'6B7280'}}} }, ...Array(COLS-1).fill({v:'',t:'s',s:{}})],
        Array(COLS).fill({v:'',t:'s',s:{}}),
        ['No','Project','Product','Kategori','Sales','Divisi','Assign To','Status','Prioritas','Tanggal','Waktu','PIC','Telepon PIC','Catatan'].map(h=>({v:h,t:'s',s:hdr})),
        ...filteredReminders.map((r,i) => {
          const status = STATUS_CONFIG[r.status];
          const statusCell = { v: status.label, t:'s', s:{ font:{name:'Arial',sz:10,bold:true}, fill:{fgColor:{rgb: r.status==='done'?'DCFCE7':r.status==='cancelled'?'F3F4F6':'FEF3C7'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center'}, border } };
          return [
            {v:i+1, t:'n', s:{font:{name:'Arial',sz:10},alignment:{horizontal:'center',vertical:'center'},border}},
            cell(r.project_name), cell(r.product), cell(r.category),
            cell(r.sales_name), cell(r.sales_division), cell(r.assign_name),
            statusCell,
            cell(PRIORITY_CONFIG[r.priority].label),
            cell(r.due_date), cell(r.due_time ?? '-'), cell(r.pic_name ?? '-'),
            cell(r.pic_phone ?? '-'), cell(r.notes ?? '-'),
          ];
        }),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:COLS-1} }, { s:{r:1,c:0}, e:{r:1,c:COLS-1} }];
      ws['!cols'] = [5,28,18,16,20,12,20,14,12,12,10,20,16,30].map(w=>({wch:w}));
      ws['!rows'] = [{hpt:28},{hpt:16},{hpt:6},{hpt:26}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '\uD83D\uDDD3\uFE0F Request Schedule');
      XLSX.writeFile(wb, `ReminderSchedule_PTS_${new Date().toISOString().split('T')[0]}.xlsx`, { bookType:'xlsx', type:'binary', cellStyles:true });
      notify('success', 'Export Excel berhasil!');
    };
    if ((window as any).XLSX) runExport((window as any).XLSX);
    else {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => runExport((window as any).XLSX);
      s.onerror = () => notify('error', 'Gagal memuat library Excel.');
      document.head.appendChild(s);
    }
  };

  // Filters

  const availableYears = Array.from(new Set(reminders.map(r => r.due_date.substring(0, 4)))).sort((a, b) => b.localeCompare(a));

  const filteredReminders = reminders.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterYear !== 'all' && !r.due_date.startsWith(filterYear)) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    const rName = ((r.project_name || '').trim() || ((r as any).title || '').trim()).toLowerCase();
    if (searchProject && !rName.includes(searchProject.toLowerCase()) &&
        !r.address?.toLowerCase().includes(searchProject.toLowerCase())) return false;
    if (searchSales && !r.sales_name?.toLowerCase().includes(searchSales.toLowerCase())) return false;
    if (searchDivisionSales && !r.sales_division?.toLowerCase().includes(searchDivisionSales.toLowerCase())) return false;
    if (searchTeamHandler && !r.assign_name?.toLowerCase().includes(searchTeamHandler.toLowerCase()) &&
        !r.assigned_to?.toLowerCase().includes(searchTeamHandler.toLowerCase())) return false;
    if (productFilter && r.product !== productFilter) return false;
    if (searchProduct && !r.product?.toLowerCase().includes(searchProduct.toLowerCase())) return false;
    if (selectedCalDay && r.due_date !== selectedCalDay) return false;
    return true;
  }).sort((a, b) => {
    // Sort by created_at desc (yang paling baru dibuat di atas)
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  // Group same-event reminders into one display row:
  // - reminder dengan batch_id sama (1 submission multi-tanggal) selalu digabung,
  //   berapa pun tanggalnya - supaya list tidak penuh oleh baris identik per hari.
  // - selain itu, tetap group by project/category/date/time (bulk-assign 1 hari).
  const groupedReminders = (() => {
    const map = new Map<string, typeof filteredReminders>();
    for (const r of filteredReminders) {
      const key = r.batch_id ? `batch:${r.batch_id}` : `${(r.project_name || r.title || '').trim()}|${r.category}|${r.due_date}|${r.due_time || ''}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.values());
  })();

  const todayCount      = reminders.filter(r => isDueToday(r.due_date) && r.status !== 'done' && r.status !== 'cancelled').length;
  const pendingCount    = reminders.filter(r => r.status === 'pending').length;
  const doneCount       = reminders.filter(r => r.status === 'done').length;
  const totalCount      = reminders.length;

  // Pie chart data

  const sourceReminders = filterYear === 'all' ? reminders : reminders.filter(r => r.due_date.startsWith(filterYear));

  const projectPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { const k = r.category; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const salesPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { if (r.sales_division) { map[r.sales_division] = (map[r.sales_division] || 0) + 1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const teamPtsPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { if (r.assign_name) { map[r.assign_name] = (map[r.assign_name] || 0) + 1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const productPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { if (r.product) { map[r.product] = (map[r.product] || 0) + 1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  // Manager PTS (mis. Dhany, role 'team') berhak approve & assign di tahap
  // admin_review - sama seperti admin. Terdeteksi dari salah satu:
  //   1. Toggle "Full Access" aktif (lib/constants.ts hasFullAccess) - cara
  //      yang disarankan sekarang, admin atur langsung per akun di Admin Panel.
  //   2. app_settings.manager_user_id (override lama, dipertahankan agar tidak
  //      merusak konfigurasi yang sudah ada).
  const isManager = !!currentUser?.id && (
    hasFullAccess(currentUser) ||
    (!!managerUserId && currentUser.id === managerUserId)
  );
  const canApproveAssign = isAdmin || isManager;
  // Sales Internal reviewer (utama atau kedua utk brand BOTH) di tahap internal_review.
  const isMyReviewStage = (r: Reminder) => r.routing_status === 'internal_review' &&
    (currentUser?.id === r.internal_sales_id || currentUser?.id === r.internal_sales_id_2);
  // Boleh approve kalau bagian-nya belum di-approve (reviewer utama vs kedua terpisah).
  const canInternalApprove = (r: Reminder) => {
    if (r.routing_status !== 'internal_review') return false;
    if (currentUser?.id === r.internal_sales_id && !r.internal_approved_at) return true;
    if (currentUser?.id === r.internal_sales_id_2 && !r.internal_approved_at_2) return true;
    return false;
  };
  const canAddReminder = currentUser?.role === 'admin' || currentUser?.role === 'team';
  const isGuest = currentUser?.role === 'guest' || currentUser?.role === 'sales';

  // Cek Form Review menggantung (guest/sales)
  // Kriterianya ada di lib/form-review-gate.ts, bukan di sini, karena pintasan
  // "buat" di dashboard menegakkan aturan yang sama.
  useEffect(() => {
    if (!isGuest || !currentUser?.full_name) return;
    hitungReviewMenggantung(currentUser.full_name)
      .then(n => { setPendingReviewCount(n); setJumlahReviewSiap(true); });
  }, [isGuest, currentUser?.full_name]);

  // Pintasan "buat" dari dashboard (?buat=1)
  // Dashboard hanya menautkan ke sini; yang memutuskan boleh atau tidaknya
  // tetap halaman ini. Untuk Sales, keputusan itu bergantung pada jumlah form
  // review yang menggantung - dan jumlah itu baru diketahui setelah query di
  // atas selesai. Karena itu pintasan menunggu jawabannya dulu: membuka modal
  // sebelum jawabannya tiba sama saja melewati penjagaan.
  useEffect(() => {
    if (!currentUser || searchParams.get('buat') !== '1' || pintasanTerpakai.current) return;
    if (isGuest) {
      if (!jumlahReviewSiap) return;
      pintasanTerpakai.current = true;
      if (pendingReviewCount === 0) { mulaiRequestJadwal(); return; }
      // Kalau ditahan, katakan sebabnya. Tanpa ini pintasan terasa rusak:
      // halamannya terbuka, tapi form yang dituju tidak pernah muncul.
      setToast({ type: 'error', msg: `Selesaikan dulu ${pendingReviewCount} form review Demo/BAST yang belum dinilai.` });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    if (canAddReminder) {
      pintasanTerpakai.current = true;
      mulaiBuatReminder();
    }
  }, [searchParams, currentUser, isGuest, jumlahReviewSiap, pendingReviewCount, canAddReminder]);

  // Cari Supervisor tim sesuai tipe produk saat modal Approve dibuka
  useEffect(() => {
    if (!approveTarget) { setApproveSupervisors([]); return; }
    // Isi dari usulan Sales supaya admin tinggal menyetujui atau membetulkan.
    const t = approveTarget as { progress_start_date?: string | null; progress_target_date?: string | null };
    setApproveStart(t.progress_start_date ?? '');
    setApproveTarget2(t.progress_target_date ?? '');
    resolveSupervisorsForProductType(approveTarget.product_type).then(setApproveSupervisors);
  }, [approveTarget]);

  // Handler: Guest Request Jadwal
  const handleRequestJadwal = async (data: JadwalRequest) => {
    if (!currentUser) return;

    // Selalu fetch sales_division terbaru dari DB untuk menghindari data stale di localStorage
    // Ambil dari data modal dulu (paling fresh), lalu currentUser, lalu fetch DB
    let salesDivision = (data as any).sales_division || currentUser.sales_division || '';
    if (!salesDivision) {
      try {
        const { data: freshUser } = await supabase
          .from('users')
          .select('sales_division')
          .eq('id', currentUser.id)
          .single();
        if (freshUser?.sales_division) {
          salesDivision = freshUser.sales_division;
          // Update currentUser di state & localStorage agar sinkron
          const updatedUser = { ...currentUser, sales_division: salesDivision };
          setCurrentUser(updatedUser);
          setSession(updatedUser);
        }
      } catch { /* gunakan nilai kosong jika gagal */ }
    }

    // Multi-tanggal: request 1 kali untuk beberapa hari sekaligus (mis. tanggal 1, 2, 3)
    //  1 baris reminder per tanggal, semua status pending menunggu assign Admin.
    const allDates = Array.from(new Set([data.due_date, ...data.extra_dates].filter(Boolean))).sort();
    const usulanLine = allDates.length > 1
      ? `🕐 *Usulan (${allDates.length} hari):* ${allDates.map(d => formatDate(d)).join(', ')}${data.due_time ? ' · ' + data.due_time : ''}`
      : `🕐 Usulan: *${formatDate(data.due_date)}${data.due_time ? ' · ' + data.due_time : ''}*`;

    // Fase 2 routing: cek apakah requester Sales Internal atau External
    // External  wajib direview Sales Internal (division_ivp_mappings) dulu,
    // BARU Admin/Manager dapat notifikasi actionable. Internal (atau Marketing,
    // atau divisi tanpa mapping)  langsung ke Admin seperti alur lama - Sales
    // Internal & Marketing sering request utk kebutuhan mereka sendiri (project
    // direct ke user / kebutuhan internal), bukan lewat Sales External, jadi
    // TIDAK boleh kena gerbang review. team_type==='Marketing' dicek terpisah
    // dari is_internal_sales sebagai jaring pengaman kedua (independen dari
    // flag, kalau-kalau ada akun Marketing yang belum sempat di-backfill).
    let routingStatus: 'internal_review' | 'admin_review' = 'admin_review';
    let internalSalesId: string | null = null;
    let internalSalesId2: string | null = null;   // reviewer kedua (IVP) saat brand BOTH
    let internalHandlers: { id: string; phone_number: string | null; full_name: string }[] = [];
    const chosenBrand: Brand | null = (data.brand as Brand | undefined) ?? null;
    // Sales External (bukan internal/marketing): WAJIB pilih brand + ada PIC Sales
    // Internal utk brand itu. BOTH  2 reviewer (wajib keduanya approve). Kalau brand
    // belum di-mapping  BLOK submit. freshSelf dicek dulu supaya bisa blokir sebelum insert.
    const { data: freshSelf } = await supabase.from('users').select('is_internal_sales, team_type').eq('id', currentUser.id).maybeSingle();
    const isInternalOrMarketing = !!freshSelf?.is_internal_sales || freshSelf?.team_type === 'Marketing';
    if (!isInternalOrMarketing && salesDivision) {
      const brand: Brand = chosenBrand ?? 'MVI';
      const res = await resolveBrandInternals(salesDivision, brand);
      if (res.missing.length > 0) {
        notify('error', `Divisi ${salesDivision} belum punya PIC Sales Internal untuk brand: ${res.missing.join(' & ')}. Hubungi Admin untuk mapping dulu.`);
        return;
      }
      routingStatus = 'internal_review';
      const primary = res.mvi ?? res.ivp;          // reviewer utama (MVI kalau ada, else IVP)
      internalSalesId = primary?.id ?? null;
      if (brand === 'BOTH' && res.mvi && res.ivp && res.mvi.id !== res.ivp.id) internalSalesId2 = res.ivp.id;
      const uniq = new Map<string, { id: string; phone_number: string | null; full_name: string }>();
      [res.mvi, res.ivp].forEach(h => { if (h && !uniq.has(h.id)) uniq.set(h.id, { id: h.id, phone_number: h.phone_number, full_name: h.full_name }); });
      internalHandlers = Array.from(uniq.values());
      if (!internalSalesId) {
        notify('error', `Divisi ${salesDivision} belum memiliki PIC Sales Internal. Hubungi Admin untuk mapping divisi ini sebelum request.`);
        return;
      }
    }

    // SBU: kalau creator Sales Internal memilih Sales External di dropdown SBU,
    // schedule diatasnamakan Sales External tsb (nama + divisi). created_by tetap
    // username Sales Internal (jejak siapa yang membuat). Routing TIDAK berubah -
    // tetap admin_review karena pembuat = Sales Internal (spec kondisi 2).
    const sbuName = data.sbu_name?.trim();
    const effectiveSalesName = sbuName || currentUser.full_name;
    if (sbuName && data.sbu_division?.trim()) salesDivision = data.sbu_division.trim();
    // uuid pemilik jadwal, sejalan dengan effectiveSalesName di atas. Saat atas
    // nama Sales External, uuid-nya diambil langsung dari pilihan dropdown -
    // jadi tidak ada tebakan nama sama sekali. Fallback pencarian nama hanya
    // dipakai kalau dropdown-nya belum sempat mengirim id (data lama).
    const effectiveSalesUserId = sbuName
      ? (data.sbu_user_id ?? idDariNama(guestUsers, sbuName))
      : (currentUser.id ?? null);

    // Insert ke tabel reminders dengan status pending & assigned_to kosong
    // Admin nantinya assign ke team dari list yang ada
    const notesVal = data.notes
      ? `[REQUEST SALES] ${data.notes}`
      : `[REQUEST SALES] ${DEFAULT_REQUEST_NOTE}`;
    // Grup semua tanggal dari 1 submission - supaya Schedule List menampilkannya
    // sbg 1 baris (bukan N baris identik per tanggal).
    const batchId = allDates.length > 1 ? newBatchId() : null;

    /*
      Kalau request ini datang dari pencarian "Project Lama Anda"
      (proyekLamaTerpilih terisi), dan kategorinya sama-sama relevan untuk
      insentif, tandai langsung dari sini - bukan menunggu Lapis 2 mendeteksinya
      belakangan di Incentive PTS. Request Sales tidak lewat handleSave (admin),
      jadi resolusinya perlu diulang di sini; aturannya tetap sama:
      resolveGrupInsentif satu fungsi bersama, dipakai empat jalur sekarang
      (Lapis 1, Lapis 4-admin, Lapis 4-guest).
    */
    const relevanGuest = proyekLamaTerpilih && adalahKategoriInsentif(data.category)
      ? proyekLamaTerpilih.filter(r => adalahKategoriInsentif(r.category))
      : [];
    const grupInsentifGuest = relevanGuest.length > 0 ? await resolveGrupInsentif([...relevanGuest]) : null;

    const payloads = allDates.map(d => ({
      project_name: data.project_name,
      description: data.description,
      address: data.address,
      category: data.category,
      ...(grupInsentifGuest ? { incentive_group_id: grupInsentifGuest } : {}),
      product_type: data.product_type,
      due_date: d,
      // Usulan rentang pengerjaan dari Sales. Hanya bermakna untuk kategori
      // pemicu; disimpan sekarang, dipakai nanti saat request di-assign.
      ...(triggersProjectProgress(data.category) ? {
        progress_start_date:  data.progress_start_date  || null,
        progress_target_date: data.progress_target_date || null,
      } : {}),
      batch_id: batchId,
      due_time: data.due_time,
      sales_name: effectiveSalesName,
      sales_user_id: effectiveSalesUserId,
      sales_division: salesDivision,
      pic_name: data.pic_name,
      pic_phone: data.pic_phone,
      product: data.product,
      notes: notesVal,
      priority: 'medium' as const,
      status: 'pending' as const,
      repeat: 'none' as const,
      // assigned_to & assign_name dikosongkan - Admin yang assign
      assigned_to: '',
      assign_name: '',
      created_by: currentUser.username,
      routing_status: routingStatus,
      internal_sales_id: internalSalesId,
      // Kolom brand hanya ditulis kalau ada brand (Sales External) - supaya create
      // request internal/admin tetap jalan walau sql/brand-multi-internal.sql belum di-run.
      ...(chosenBrand ? { internal_sales_id_2: internalSalesId2, brand: chosenBrand } : {}),
    }));

    const { data: dibuat, error } = await cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
      .insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas)).select('id, project_name'));
    if (error) {
      notify('error', 'Gagal mengirim request: ' + error.message);
      return;
    }
    const d0 = payloads[0]?.due_date as string;

    // Pangkal riwayat: tanpa ini jejak sebuah request baru dimulai dari
    // "disetujui", dan pembacanya tidak pernah tahu siapa yang mengajukan.
    // user_name WAJIB pelaku sebenarnya - yang menekan tombol - bukan
    // effectiveSalesName. Saat Sales Internal mengajukan atas nama Sales
    // External (SBU), "atas nama" ditulis di notes, bukan menggantikan pelaku.
    const atasNamaLain = effectiveSalesName && effectiveSalesName !== currentUser.full_name;
    for (const row of (dibuat ?? []) as { id: string; project_name: string | null }[]) {
      logAudit({
        user_id: currentUser.id, user_name: currentUser.full_name,
        action: 'create', module: 'reminder',
        target_id: row.id, target_name: row.project_name ?? data.project_name,
        notes: (atasNamaLain ? `Diinput atas nama Sales ${effectiveSalesName}` : 'Request diajukan Sales')
          + `${salesDivision ? ` (${salesDivision})` : ''} — kategori ${data.category}, usulan ${formatDate(d0)}`,
      }).catch(() => {});
    }

    notify('success', routingStatus === 'internal_review'
      ? `Request dikirim! Menunggu review ${internalHandlers[0]?.full_name ?? 'Sales Internal'} terlebih dahulu.`
      : (allDates.length > 1 ? `${allDates.length} request jadwal berhasil dikirim! Menunggu approval Admin.` : 'Request jadwal berhasil dikirim! Menunggu approval Admin.'));
    setShowRequestModal(false);
    setProyekLamaTerpilih(null);
    fetchRemindersQuiet();

    // Kirim WA sesuai tahap routing
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('phone_number, full_name')
        .eq('role', 'admin');

      if (routingStatus === 'internal_review') {
        // 1) WA WAJIB ke Sales Internal - dia yang harus review dulu.
        const internalMsg =
          `📩 *REQUEST JADWAL BARU — PERLU REVIEW KAMU*\n\n` +
          `Sales External *${currentUser.full_name}* (${salesDivision}) mengajukan request jadwal:\n\n` +
          `📋 *Project: ${data.project_name}*\n` +
          `🏷️ Kategori: ${data.category}\n` +
          `📦 Product: ${data.product || '-'}\n` +
          `📍 Lokasi: ${data.address}\n` +
          `${usulanLine}\n` +
          (data.description ? `📝 Deskripsi: ${data.description}\n` : '') +
          `\nSilakan review & teruskan ke Admin:\n` +
          `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
        for (const h of internalHandlers) {
          if (h.phone_number) await sendFonnteWA(h.phone_number, internalMsg);
          createNotification({
            user_id: h.id,
            type: 'reminder',
            title: `📩 Request jadwal perlu review kamu`,
            body: `${currentUser.full_name} (${salesDivision}) — ${data.project_name}`,
            action_url: '/reminder-schedule',
            created_by: currentUser.full_name,
          }).catch(() => {});
        }
        // 2) WA ke Admin - PENGINGAT saja (belum bisa diproses, menunggu Sales Internal).
        if (admins && admins.length > 0) {
          const adminHeadsUp =
            `ℹ️ *ADA REQUEST JADWAL BARU (pengingat)*\n\n` +
            `Sales External *${currentUser.full_name}* mengajukan request untuk *${data.project_name}*.\n` +
            `Sedang menunggu review dari Sales Internal *${internalHandlers[0]?.full_name ?? '-'}* sebelum bisa diproses Admin.`;
          for (const admin of admins) {
            if (admin.phone_number) await sendFonnteWA(admin.phone_number, adminHeadsUp);
          }
        }
      } else {
        // Alur lama: langsung actionable ke Admin/Manager (requester internal / tanpa mapping).
        const managerTargets = await fetchManagerTargets();
        if ((admins && admins.length > 0) || managerTargets.length > 0) {
          const msg =
            `📩 *REQUEST JADWAL BARU — PTS IVP*\n\n` +
            `Sales *${currentUser.full_name}* mengajukan request jadwal:\n\n` +
            `📋 *Project: ${data.project_name}*\n` +
            `🏷️ Kategori: ${data.category}\n` +
            `📦 Product: ${data.product || '-'}\n` +
            `📍 Lokasi: ${data.address}\n` +
            `${usulanLine}\n` +
            (data.description ? `📝 Deskripsi: ${data.description}\n` : '') +
            (data.pic_name ? `🙋 PIC: ${data.pic_name}${data.pic_phone ? ' - ' + data.pic_phone : ''}\n` : '') +
            `\nSilakan review & assign ke Team PTS IVP:\n` +
            `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
          for (const admin of (admins ?? [])) {
            if (admin.phone_number) await sendFonnteWA(admin.phone_number, msg);
          }
          // Manager (role='team') tidak ke-cover query role='admin' di atas - WA & badge terpisah,
          // dikirim BERSAMAAN dengan admin (bukan menyusul), sesuai jadi PENTING sama.
          for (const mgr of managerTargets) {
            if (mgr.phone_number) await sendFonnteWA(mgr.phone_number, msg);
          }
        }
        // Badge notifikasi in-app - supaya tidak perlu buka tabel utk tahu ada yg perlu approval.
        // createNotificationForAdmins sudah ikut meng-cover akun Full Access (lib/notifications.ts),
        // jadi di sini cukup tambahkan target dari app_settings.manager_user_id (kalau ada &
        // belum ke-cover) supaya tidak dobel - lihat fetchManagerTargets.
        createNotificationForAdmins({
          type: 'reminder',
          title: `📩 Request jadwal baru menunggu approval`,
          body: `${currentUser.full_name} — ${data.project_name}`,
          action_url: '/reminder-schedule',
          created_by: currentUser.full_name,
        }).catch(() => {});
        for (const mgr of managerTargets) {
          createNotification({
            user_id: mgr.id,
            type: 'reminder',
            title: `📩 Request jadwal baru menunggu approval kamu`,
            body: `${currentUser.full_name} — ${data.project_name}`,
            action_url: '/reminder-schedule',
            created_by: currentUser.full_name,
          }).catch(() => {});
        }
      }
    } catch { }
  };

  // Handler: Sales Internal approve & teruskan ke Admin/Manager
  const handleInternalApprove = async (r: Reminder) => {
    setSaving(true);
    setInternalApproveSaving(true);
    const now = new Date().toISOString();
    // Brand BOTH = 2 reviewer (MVI + IVP), WAJIB keduanya approve baru lanjut ke Admin.
    const isSecondReviewer = !!r.internal_sales_id_2 && r.internal_sales_id_2 === currentUser?.id;
    const patch: Record<string, unknown> = {};
    if (isSecondReviewer) patch.internal_approved_at_2 = now;
    else { patch.internal_approved_by = currentUser?.id ?? null; patch.internal_approved_at = now; }
    // Sudah lengkap kalau: bukan BOTH (1 reviewer), ATAU kedua approve sudah terisi.
    const needBoth = !!r.internal_sales_id_2;
    const otherDone = isSecondReviewer ? !!r.internal_approved_at : !!r.internal_approved_at_2;
    const allApproved = !needBoth || otherDone;
    if (allApproved) patch.routing_status = 'admin_review';
    const { error } = await supabase.from('reminders').update(patch).eq('id', r.id);
    if (error) { notify('error', 'Gagal approve: ' + error.message); setSaving(false); setInternalApproveSaving(false); return; }
    setInternalApproveSaving(false);
    setInternalApproveTarget(null);
    if (!allApproved) {
      notify('success', 'Approve kamu tersimpan. Menunggu approve Sales Internal brand satunya (Kedua Brand).');
      logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'reminder', target_id: r.id, target_name: r.project_name, notes: 'Internal review approved (menunggu reviewer kedua)' }).catch(() => {});
      fetchRemindersQuiet();
      setSaving(false);
      return;
    }
    notify('success', 'Request diteruskan ke Admin/Manager!');
    logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'reminder', target_id: r.id, target_name: r.project_name, notes: 'Internal review approved' }).catch(() => {});
    fetchRemindersQuiet();

    // Badge in-app ke Manager (app_settings.manager_user_id) - actionable. Fallback ke semua admin.
    // CATATAN: WA "REQUEST LOLOS REVIEW" DIHAPUS atas permintaan user - cukup badge di
    // tahap ini; WA hanya dikirim di hasil akhir (saat sudah di-assign ke pengerjaan).
    try {
      const managerTargets = await fetchManagerTargets();
      const targets: { id: string; phone_number: string | null; full_name: string }[] = [...managerTargets];
      if (targets.length === 0) {
        const { data: admins } = await supabase.from('users').select('id, phone_number, full_name').eq('role', 'admin');
        targets.push(...(admins ?? []));
      }
      for (const t of targets) {
        createNotification({
          user_id: t.id,
          type: 'reminder',
          title: `✅ Request lolos review — perlu approval kamu`,
          body: `${r.sales_name} — ${r.project_name}`,
          action_url: '/reminder-schedule',
          ref_id: r.id,
          created_by: currentUser?.full_name ?? '',
        }).catch(() => {});
      }
    } catch { }
    setSaving(false);
  };

  // Handler: Sales Internal Tolak request (wajib isi alasan)
  const handleInternalReject = (r: Reminder) => { setInternalRejectReason(''); setInternalRejectTarget(r); };

  const handleInternalRejectConfirm = async () => {
    const r = internalRejectTarget;
    if (!r) return;
    if (!internalRejectReason.trim()) { notify('error', 'Alasan penolakan wajib diisi!'); return; }
    setInternalRejectSaving(true);
    const { error } = await supabase.from('reminders').update({
      status: 'cancelled',
      rejection_reason: internalRejectReason.trim(),
    }).eq('id', r.id);
    if (error) { notify('error', 'Gagal menolak: ' + error.message); setInternalRejectSaving(false); return; }
    notify('success', 'Request ditolak.');
    logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'reject', module: 'reminder', target_id: r.id, target_name: r.project_name, notes: internalRejectReason.trim() }).catch(() => {});
    setInternalRejectTarget(null);
    fetchRemindersQuiet();

    // WA ke Sales requester - kasih tau ditolak + alasannya.
    try {
      const { data: salesUser } = await supabase.from('users').select('phone_number, full_name').eq('full_name', r.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const msg =
          `❌ *REQUEST JADWAL DITOLAK*\n\n` +
          `Halo *${salesUser.full_name}*, request kamu untuk *${r.project_name}* ditolak oleh *${currentUser?.full_name}* (Sales Internal).\n\n` +
          `📝 *Alasan:* ${internalRejectReason.trim()}\n\n` +
          `Silakan hubungi ${currentUser?.full_name} atau ajukan ulang jika diperlukan.`;
        await sendFonnteWA(salesUser.phone_number, msg);
      }
    } catch { }
    setInternalRejectSaving(false);
  };

  // Handler: Admin/Manager approve  route ke Supervisor tim (by tipe produk)
  // Jalur UTAMA (bukan assign manual langsung). Supervisor tim yang cocok dgn
  // product_type (product_team_map, Fase 1) yang WA dan harus assign lanjut ke
  // anggota timnya / diri sendiri. "LED & LCD" bisa kena >1 tim -> semua di-WA,
  // yang assign duluan yang eksekusi (1 tim, sesuai keputusan desain).
  const handleApproveRoute = async () => {
    if (!approveTarget || approveSupervisors.length === 0) return;
    setApproveRouteSaving(true);

    const cleanNotes = cleanRequestNotes(approveTarget.notes);
    const primarySupervisor = approveSupervisors[0];
    const { error } = await supabase.from('reminders').update({
      routing_status: 'supervisor_assign',
      assigned_supervisor_id: primarySupervisor.id,
      due_date: approveDate || approveTarget.due_date,
      due_time: approveTime || approveTarget.due_time,
      notes: cleanNotes,
    }).eq('id', approveTarget.id);

    if (error) { notify('error', 'Gagal route ke supervisor: ' + error.message); setApproveRouteSaving(false); return; }

    if (approveBatchSiblings.length > 0) {
      const siblingResults: { error: { message: string } | null }[] = await Promise.all(approveBatchSiblings.map(sib => {
        const sibNotes = cleanRequestNotes(sib.notes);
        const patch: Record<string, unknown> = { routing_status: 'supervisor_assign', assigned_supervisor_id: primarySupervisor.id, notes: sibNotes };
        if (approveTime) patch.due_time = approveTime;
        return supabase.from('reminders').update(patch).eq('id', sib.id);
      }));
      const siblingErr = siblingResults.find(res => res.error)?.error ?? null;
      if (siblingErr) notify('error', 'Sebagian tanggal di batch gagal ter-route: ' + siblingErr.message);
    }

    const allApprovedDates = Array.from(new Set([approveDate || approveTarget.due_date, ...approveBatchSiblings.map(s => s.due_date)])).sort();
    const jadwalLineRoute = allApprovedDates.length > 1
      ? `🕐 *Jadwal (${allApprovedDates.length} hari):* ${allApprovedDates.map(d => formatDate(d)).join(', ')}${approveTime ? ' · ' + approveTime : ''}`
      : `🕐 Jadwal: *${formatDate(approveDate || approveTarget.due_date)}${(approveTime || approveTarget.due_time) ? ' · ' + (approveTime || approveTarget.due_time) : ''}*`;

    const teamLabel = Array.from(new Set(approveSupervisors.map(s => s.team_type))).join(' & ');
    notify('success', `Request diarahkan ke ${teamLabel} (Supervisor: ${approveSupervisors.map(s => s.full_name).join(', ')})!`);
    logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'reminder', target_id: approveTarget.id, target_name: approveTarget.project_name, notes: `Routed to supervisor: ${approveSupervisors.map(s => s.full_name).join(', ')}` }).catch(() => {});

    // WA ke SEMUA supervisor yang cocok - actionable, wajib assign lanjut.
    const supMsg =
      `🎯 *REQUEST PERLU DI-ASSIGN — ${teamLabel}*\n\n` +
      `Request dari Sales *${approveTarget.sales_name}* sudah disetujui Admin/Manager, silakan assign ke anggota tim kamu atau kerjakan sendiri:\n\n` +
      `📋 *Project: ${approveTarget.project_name}*\n` +
      `🏷️ Kategori: ${approveTarget.category}\n` +
      `📦 Product: ${approveTarget.product || '-'}\n` +
      `📍 Lokasi: ${approveTarget.address || '-'}\n` +
      `${jadwalLineRoute}\n\n` +
      `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
    for (const sup of approveSupervisors) {
      if (sup.phone_number) await sendFonnteWA(sup.phone_number, supMsg);
      createNotification({
        user_id: sup.id,
        type: 'reminder',
        title: `🎯 Request perlu kamu assign`,
        body: `${approveTarget.sales_name} — ${approveTarget.project_name}`,
        action_url: '/reminder-schedule',
        ref_id: approveTarget.id,
        created_by: currentUser?.full_name ?? '',
      }).catch(() => {});
    }

    // WA ke sales requester - kasih tau statusnya diteruskan ke tim.
    try {
      const { data: salesUser } = await supabase.from('users').select('phone_number, full_name').eq('full_name', approveTarget.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const msg = `✅ *REQUEST DISETUJUI — SEDANG DIARAHKAN KE TIM*\n\nHalo *${salesUser.full_name}*! Request kamu untuk *${approveTarget.project_name}* sudah disetujui dan sedang diarahkan ke tim *${teamLabel}*. Kamu akan diberi tahu begitu ada yang di-assign menangani.`;
        await sendFonnteWA(salesUser.phone_number, msg);
      }
    } catch { }

    setApproveTarget(null); setApproveBatchSiblings([]); setApproveSupervisors([]); setApproveDate(''); setApproveTime('');
    setApproveRouteSaving(false);
    fetchRemindersQuiet();
  };

  // Handler: Admin Approve & Assign request dari Sales
  const handleApproveAssign = async () => {
    if (!approveTarget || !approveAssignTo) return;
    // 'SELF_MANAGER' = Admin/Manager kerjakan sendiri (mis. Supervisor & tim
    // sama-sama penuh). Akun admin sengaja dikecualikan dari teamUsers, jadi
    // resolve langsung dari currentUser supaya tetap bisa dipilih.
    const assignee = approveAssignTo === 'SELF_MANAGER' ? currentUser : teamUsers.find(u => u.username === approveAssignTo);
    if (!assignee) return;
    setApproveSaving(true);

    // Update reminder: assign ke team, clear REQUEST SALES note prefix.
    // Kalau ini bagian dari batch multi-tanggal (request Sales beberapa hari
    // sekaligus), semua tanggal lain di batch ikut di-approve & di-assign ke
    // handler yang sama - tiap tanggal tetap pakai due_date-nya sendiri
    // (hanya due_date milik approveTarget yang bisa di-override via field Tanggal).
    const cleanNotes = cleanRequestNotes(approveTarget.notes);
    const patchApprove = {
      assigned_to: assignee.username,
      assign_name: assignee.full_name,
      assign_user_id: assignee.id,
      due_date: approveDate || approveTarget.due_date,
      due_time: approveTime || approveTarget.due_time,
      notes: cleanNotes,
      routing_status: null,
      ...(triggersProjectProgress(approveTarget.category) ? {
        progress_start_date:  approveStart   || null,
        progress_target_date: approveTarget2 || null,
      } : {}),
    };
    const { error } = await cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
      .update(pakaiUuid ? patchApprove : tanpaIdentitas(patchApprove)).eq('id', approveTarget.id));

    if (error) {
      notify('error', 'Gagal approve: ' + error.message);
      setApproveSaving(false);
      return;
    }

    // Draft Project Progress dibuat DI SINI, bukan saat request diajukan
    // Request Sales berstatus pending sampai di-assign; kalau draft dibuat sejak
    // pengajuan, request yang ditolak akan meninggalkan lokasi kosong yang harus
    // dibersihkan manual. Saat assign, pekerjaannya sudah pasti berjalan.
    //
    // Sengaja HANYA approveTarget, bukan sibling-nya: satu batch multi-tanggal
    // adalah lokasi yang SAMA dikunjungi beberapa hari, bukan beberapa lokasi.
    // Menyertakan sibling akan melahirkan lokasi kembar sebanyak jumlah hari.
    void syncNewRemindersToProgress([{
      id:                   approveTarget.id,
      project_name:         approveTarget.project_name,
      address:              approveTarget.address,
      sales_name:           approveTarget.sales_name,
      sales_division:       approveTarget.sales_division,
      assign_name:          assignee.full_name,
      due_date:             approveDate || approveTarget.due_date,
      category:             approveTarget.category,
      progress_start_date:  approveStart   || null,
      progress_target_date: approveTarget2 || null,
    }]);

    if (approveBatchSiblings.length > 0) {
      const siblingResults: { error: { message: string } | null }[] = await Promise.all(approveBatchSiblings.map(sib => {
        const sibNotes = cleanRequestNotes(sib.notes);
        const patch: Record<string, unknown> = {
          assigned_to: assignee.username,
          assign_name: assignee.full_name,
          assign_user_id: assignee.id,
          notes: sibNotes,
          routing_status: null,
        };
        if (approveTime) patch.due_time = approveTime;
        return cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
          .update(pakaiUuid ? patch : tanpaIdentitas(patch)).eq('id', sib.id));
      }));
      const siblingErr = siblingResults.find(res => res.error)?.error ?? null;
      if (siblingErr) notify('error', 'Sebagian tanggal di batch gagal ter-assign: ' + siblingErr.message);
    }

    const allApprovedDates = Array.from(new Set([approveDate || approveTarget.due_date, ...approveBatchSiblings.map(s => s.due_date)])).sort();
    const jadwalLineApprove = allApprovedDates.length > 1
      ? `🕐 *Jadwal (${allApprovedDates.length} hari):* ${allApprovedDates.map(d => formatDate(d)).join(', ')}${approveTime ? ' · ' + approveTime : ''}`
      : `🕐 Jadwal: *${formatDate(approveDate || approveTarget.due_date)}${(approveTime || approveTarget.due_time) ? ' · ' + (approveTime || approveTarget.due_time) : ''}*`;

    notify('success', `Request disetujui & di-assign ke ${assignee.full_name}${allApprovedDates.length > 1 ? ` (${allApprovedDates.length} hari)` : ''}!`);

    // WA ke team yang di-assign
    if (assignee.phone_number) {
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*

` +
        `Halo *${assignee.full_name}*, kamu mendapat jadwal baru dari request Sales:

` +
        `*Nama Project: ${approveTarget.project_name}*
` +
        `🏷️ Kategori: ${approveTarget.category}
` +
        `📦 Product: ${approveTarget.product || '-'}
` +
        `📍 Lokasi: ${approveTarget.address || '-'}
` +
        `👤 Sales: ${approveTarget.sales_name}${approveTarget.sales_division ? ' - ' + approveTarget.sales_division : ''}
` +
        `${jadwalLineApprove}
` +
        (approveTarget.pic_name ? `🙋 PIC: ${approveTarget.pic_name}${approveTarget.pic_phone ? ' - ' + approveTarget.pic_phone : ''}
` : '') +
        `
jangan lupa peralatan & Semangat💪🏼
` +
        `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
      await sendFonnteWA(assignee.phone_number, msg);
    }

    // WA ke sales yang request - konfirmasi approved
    try {
      const { data: salesUser } = await supabase
        .from('users').select('phone_number, full_name')
        .eq('full_name', approveTarget.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const salesMsg =
          `✅ *REQUEST JADWAL DISETUJUI — PTS IVP*

` +
          `Halo *${salesUser.full_name}*!

` +
          `Request jadwal kamu untuk project:
` +
          `📋 *${approveTarget.project_name}*
` +
          `🏷️ Kategori: ${approveTarget.category}
` +
          `📍 ${approveTarget.address || '-'}

` +
          `telah *disetujui* dan akan dikerjakan oleh:
` +
          `👷 *${assignee.full_name}*
` +
          `${jadwalLineApprove}

` +
          `Terima kasih! 🙏
` +
          `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
        await sendFonnteWA(salesUser.phone_number, salesMsg);
      }
    } catch { /* ignore WA error */ }

    // In-app notification to the sales requester
    try {
      if (approveTarget.notes?.includes('[REQUEST SALES]')) {
        // Find the sales user by name to get their id
        const { data: salesUserFull } = await supabase
          .from('users').select('id, full_name')
          .eq('full_name', approveTarget.sales_name)
          .in('role', ['guest', 'sales']).maybeSingle();
        if (salesUserFull?.id) {
          notifyReminderApproved(
            salesUserFull.id, salesUserFull.full_name,
            approveTarget.id, approveTarget.project_name,
            approveDate || approveTarget.due_date,
            currentUser?.full_name ?? 'Admin'
          ).catch(() => {});
        }
      }
    } catch { /* ignore */ }

    // Audit log
    logAudit({
      user_id: currentUser?.id ?? '',
      user_name: currentUser?.full_name ?? '',
      action: 'approve',
      module: 'reminder',
      target_id: approveTarget.id,
      target_name: approveTarget.project_name,
      new_value: assignee.full_name,
    }).catch(() => {});

    setApproveTarget(null);
    setApproveBatchSiblings([]);
    setApproveAssignTo('');
    setApproveDate('');
    setApproveTime('');
    setApproveSaving(false);
    setDetailReminder(null);
    fetchRemindersQuiet();
  };

  // Handler: Supervisor assign ke anggota tim ATAU diri sendiri
  // Tim penuh/sibuk = keputusan manual Supervisor (tidak ada hitungan kapasitas
  // otomatis) - dia yang menilai, tinggal pilih "Saya kerjakan sendiri".
  const openSupervisorAssign = (r: Reminder, group: Reminder[]) => {
    setSupervisorAssignTarget(r);
    setSupervisorAssignBatchSiblings(group.filter(gr => gr.id !== r.id && gr.batch_id === r.batch_id && !gr.assigned_to));
    setSupervisorAssignTo('');
  };

  const handleSupervisorAssignConfirm = async () => {
    const r = supervisorAssignTarget;
    if (!r || !supervisorAssignTo || !currentUser) return;
    const isSelf = supervisorAssignTo === 'SELF';
    const assignee = isSelf ? currentUser : teamUsers.find(u => u.username === supervisorAssignTo);
    if (!assignee) return;
    setSupervisorAssignSaving(true);

    const patchSup = {
      assigned_to: assignee.username,
      assign_name: assignee.full_name,
      assign_user_id: assignee.id,
      routing_status: null,
    };
    const { error } = await cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
      .update(pakaiUuid ? patchSup : tanpaIdentitas(patchSup)).eq('id', r.id));
    if (error) { notify('error', 'Gagal assign: ' + error.message); setSupervisorAssignSaving(false); return; }

    if (supervisorAssignBatchSiblings.length > 0) {
      const siblingResults: { error: { message: string } | null }[] = await Promise.all(supervisorAssignBatchSiblings.map(sib =>
        cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
          .update(pakaiUuid ? patchSup : tanpaIdentitas(patchSup)).eq('id', sib.id))
      ));
      const siblingErr = siblingResults.find(res => res.error)?.error ?? null;
      if (siblingErr) notify('error', 'Sebagian tanggal di batch gagal ter-assign: ' + siblingErr.message);
    }

    const allDates = Array.from(new Set([r.due_date, ...supervisorAssignBatchSiblings.map(s => s.due_date)])).sort();
    const jadwalLine = allDates.length > 1
      ? `🕐 *Jadwal (${allDates.length} hari):* ${allDates.map(d => formatDate(d)).join(', ')}${r.due_time ? ' · ' + r.due_time : ''}`
      : `🕐 Jadwal: *${formatDate(r.due_date)}${r.due_time ? ' · ' + r.due_time : ''}*`;

    notify('success', isSelf ? 'Kamu jadi PIC proyek ini!' : `Berhasil di-assign ke ${assignee.full_name}!`);
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'assign', module: 'reminder', target_id: r.id, target_name: r.project_name, new_value: assignee.full_name }).catch(() => {});
    setSupervisorAssignTarget(null); setSupervisorAssignBatchSiblings([]); setSupervisorAssignTo('');
    fetchRemindersQuiet();

    // WA ke assignee (kalau bukan Supervisor sendiri yg baru saja klik tombolnya)
    if (!isSelf && assignee.phone_number) {
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
        `Halo *${assignee.full_name}*, kamu di-assign Supervisor *${currentUser.full_name}* untuk jadwal:\n\n` +
        `*Nama Project: ${r.project_name}*\n` +
        `🏷️ Kategori: ${r.category}\n` +
        `📦 Product: ${r.product || '-'}\n` +
        `📍 Lokasi: ${r.address || '-'}\n` +
        `${jadwalLine}\n\n` +
        `jangan lupa peralatan & Semangat💪🏼\n` +
        `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
      await sendFonnteWA(assignee.phone_number, msg);
    }

    // WA ke sales requester - kasih tau siapa yg akan menangani.
    try {
      const { data: salesUser } = await supabase.from('users').select('phone_number, full_name').eq('full_name', r.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const msg = `✅ *JADWAL DI-ASSIGN — PTS IVP*\n\nHalo *${salesUser.full_name}*! Request kamu untuk *${r.project_name}* akan ditangani oleh *${assignee.full_name}*.\n${jadwalLine}`;
        await sendFonnteWA(salesUser.phone_number, msg);
      }
    } catch { }
    setSupervisorAssignSaving(false);
  };

  /**
   * Semua yang MENUNGGU TINDAKAN saya, bukan cuma yang saya kerjakan sendiri.
   * Item yang menunggu saya menugaskan atau menyetujui punya assigned_to
   * kosong, jadi menghitung `assigned_to === username` saja akan melewatkannya
   * sama sekali. Tiap baris membawa alasannya, supaya dari lonceng sudah jelas
   * apa yang diminta.
   */
  const perluAksiSaya: { r: Reminder; alasan: string; warna: string }[] = (() => {
    if (!currentUser) return [];
    const hasil: { r: Reminder; alasan: string; warna: string }[] = [];
    const sudah = new Set<string>();
    const tambah = (r: Reminder, alasan: string, warna: string) => {
      if (sudah.has(r.id)) return;
      sudah.add(r.id);
      hasil.push({ r, alasan, warna });
    };
    for (const r of reminders) {
      if (r.status === 'done' || r.status === 'cancelled') continue;
      // Urutan pengecekan = urutan mendesaknya. Yang menunggu SAYA bertindak
      // didahulukan daripada yang tinggal saya kerjakan sendiri.
      if (r.routing_status === 'supervisor_assign' && r.assigned_supervisor_id === currentUser.id) {
        tambah(r, 'Perlu kamu assign ke tim', '#f59e0b');
      } else if (r.routing_status === 'admin_review' && (isAdmin || isManager)) {
        tambah(r, 'Menunggu approval kamu', '#dc2626');
      } else if (isMyReviewStage(r)) {
        tambah(r, 'Perlu review kamu', '#8b5cf6');
      } else if (r.assigned_to === currentUser.username) {
        tambah(r, 'Dikerjakan kamu', '#0891b2');
      }
    }
    return hasil;
  })();

  const myActiveReminders = perluAksiSaya.map(x => x.r);

  // Login handler
  const handleLogout = () => {
    setSelectMode(false); setSelectedIds(new Set()); setFilterStatus('all'); setFilterYear('all'); setFilterCategory('all');
    setSearchProject(''); setSearchSales(''); setSearchDivisionSales('');
    setSearchTeamHandler(''); setSearchProduct(''); setProductFilter(null);
    setSelectedCalDay(null);
    clearSession();
    setCurrentUser(null); setLoginTime(null);
    // Redirect ke halaman login dashboard (parent window jika di dalam iframe)
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = '/dashboard';
  };

  // Not ready - tampilkan loading screen saat pertama kali fetch data
  if (!appReady) return <LoadingScreen />;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      {/* TANPA z-index — disengaja. `relative z-10` di sini dulu membentuk
          stacking context, sehingga z-index SEMUA modal di dalamnya cuma
          dibandingkan sesama isi pembungkus ini, bukan dengan overlay yang
          di-portal ke <body>. Akibatnya modal z-[1100] bisa tampil DI BELAKANG
          modal z-[1000] yang di-portal. Urutan cat terhadap tint di atas tetap
          aman karena elemen ini datang belakangan di DOM. */}
      <div className="relative flex flex-col flex-1 overflow-hidden">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-[3000] px-5 py-3.5 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}
            style={{ boxShadow: toast.type === 'success' ? '0 4px 20px rgba(16,185,129,0.4)' : '0 4px 20px rgba(220,38,38,0.4)' }}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        )}

        {/* ── RESCHEDULE MODAL ── */}
        {rescheduleTarget && (
          <RescheduleModal
            reminder={rescheduleTarget}
            onClose={() => setRescheduleTarget(null)}
            onSave={handleReschedule}
          />
        )}

        {/* ── REQUEST JADWAL MODAL (Guest/Sales) ── */}
        {showRequestModal && currentUser && (
          <RequestJadwalModal
            salesName={currentUser.full_name}
            salesUsername={currentUser.username}
            salesDivision={currentUser.sales_division ?? ''}
            // Tampilkan pilih Sales External (SBU) utk Sales Internal ATAU Marketing -
            // sama dgn siapa yg boleh lewati gerbang review (isInternalOrMarketing).
            // Kalau tidak dipilih = request atas nama diri sendiri (tanpa CC External).
            isInternalSales={myIsInternalSales || currentUser.team_type === 'Marketing'}
            externalSalesUsers={guestUsers
              .filter(g => !g.is_internal_sales && g.id !== currentUser.id)
              .map(g => ({ id: g.id, full_name: g.full_name, sales_division: g.sales_division ?? null }))}
            initial={praFillGuest ?? undefined}
            onClose={() => { setShowRequestModal(false); setProyekLamaTerpilih(null); setPraFillGuest(null); }}
            onSubmit={handleRequestJadwal}
          />
        )}

        {/* ── TOLAK MODAL (Sales Internal, tahap internal_review) ── */}
        {internalRejectTarget && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
            onClick={e => { if (e.target === e.currentTarget) setInternalRejectTarget(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(220,38,38,0.35)' }}>
              <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                <h3 className="text-lg font-bold text-white">❌ Tolak Request</h3>
                <p className="text-red-100/90 text-xs mt-0.5 truncate">{internalRejectTarget.project_name}</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Alasan Penolakan *</label>
                  <textarea value={internalRejectReason} onChange={e => setInternalRejectReason(e.target.value)}
                    rows={3} placeholder="Tuliskan alasan penolakan..."
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none focus:ring-2 focus:ring-red-500/40"
                    style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setInternalRejectTarget(null)}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>Batal</button>
                  <button onClick={handleInternalRejectConfirm} disabled={internalRejectSaving}
                    className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                    {internalRejectSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    ❌ Ya, Tolak
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

                <KonfirmasiApproveInternal
          internalApproveTarget={internalApproveTarget}
          internalApproveSaving={internalApproveSaving}
          setInternalApproveTarget={setInternalApproveTarget}
          handleInternalApprove={handleInternalApprove}
        />

        {/* ── APPROVE & ASSIGN MODAL (Admin only) ── */}
        {approveTarget && canApproveAssign && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setApproveTarget(null); setApproveBatchSiblings([]); setApproveAssignTo(''); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(34,197,94,0.4)' }}>
              {/* Header */}
              <div className="px-6 py-5 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                <div>
                  <h3 className="text-lg font-bold text-white">✅ Approve & Assign Request</h3>
                  <p className="text-green-200/80 text-xs mt-0.5 truncate max-w-[300px]">{approveTarget.project_name}</p>
                </div>
                <button aria-label="Tutup" onClick={() => { setApproveTarget(null); setApproveBatchSiblings([]); setApproveAssignTo(''); }}
                  className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Info request */}
                <div className="rounded-xl p-3 space-y-1"
                  style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Request dari Sales</p>
                  <p className="text-sm font-bold text-slate-800">{approveTarget.sales_name}{approveTarget.sales_division ? ` · ${approveTarget.sales_division}` : ''}</p>
                  <p className="text-xs text-slate-500">📍 {approveTarget.address || '-'} · 🏷️ {approveTarget.category}</p>
                  <p className="text-xs text-slate-500">📅 Usulan: {formatDate(approveTarget.due_date)} {approveTarget.due_time}</p>
                </div>

                {approveBatchSiblings.length > 0 && (
                  <div className="rounded-xl p-3 flex items-start gap-2"
                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <span className="text-base flex-shrink-0">🗓️</span>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      Request ini bagian dari <strong>{approveBatchSiblings.length + 1} hari</strong> yang diminta sekaligus
                      ({[approveTarget.due_date, ...approveBatchSiblings.map(s => s.due_date)].sort().map(formatDate).join(', ')}).
                      Semua tanggal akan ikut disetujui &amp; di-assign ke handler yang sama.
                    </p>
                  </div>
                )}

                {/* Route ke Supervisor — jalur UTAMA, sesuai tipe produk */}
                {approveSupervisors.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
                    <p className="text-xs font-bold text-amber-700 mb-1">🎯 Route ke Supervisor (Rekomendasi)</p>
                    <p className="text-[11px] text-amber-600 mb-3">
                      Tipe produk <strong>{approveTarget.product_type || '-'}</strong> → Tim{' '}
                      <strong>{Array.from(new Set(approveSupervisors.map(s => s.team_type))).join(' & ')}</strong>.
                      Supervisor <strong>{approveSupervisors.map(s => s.full_name).join(', ')}</strong> akan di-WA untuk assign ke anggota tim atau kerjakan sendiri.
                    </p>
                    <button onClick={handleApproveRoute} disabled={approveRouteSaving}
                      className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                      {approveRouteSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      🎯 Approve & Route ke Supervisor
                    </button>
                  </div>
                )}

                {/* Assign to Team — manual/fallback (dipakai jika tipe produk belum ter-mapping,
                    atau admin ingin assign langsung tanpa lewat Supervisor) */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                    {approveSupervisors.length > 0 ? 'Atau Assign Langsung Manual' : 'Assign ke Team PTS *'}
                  </label>
                  <select aria-label="-- Pilih Anggota Team PTS --"
                    value={approveAssignTo}
                    onChange={e => setApproveAssignTo(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-green-500/40"
                    style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }}>
                    <option value="">-- Pilih Anggota Team PTS --</option>
                    <option value="SELF_MANAGER">🙋 Saya (Manager) kerjakan sendiri — Supervisor &amp; tim penuh</option>
                    {teamUsers.filter(u => u.jabatan !== 'Manager').map(u => <option key={u.id} value={u.username}>{u.full_name}</option>)}
                  </select>
                </div>

                {/* Konfirmasi / ubah tanggal */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                      Tanggal (opsional ubah)
                    </label>
                    <input type="date"
                      value={approveDate || approveTarget.due_date}
                      onChange={e => setApproveDate(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/40 text-slate-800"
                      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                      Waktu (opsional ubah)
                    </label>
                    <input type="time"
                      value={approveTime || approveTarget.due_time}
                      onChange={e => setApproveTime(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/40 text-slate-800"
                      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                  </div>
                </div>

                {/* Timeline Project Progress — hanya kategori pemicu.
                    Terisi dari usulan Sales; admin boleh membetulkan sebelum
                    draft lokasi dibuat. */}
                {triggersProjectProgress(approveTarget.category) && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.25)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: '#0e7490' }}>
                      📊 Timeline Project Progress
                    </p>
                    <p className="text-[11px] mb-2.5" style={{ color: '#0891b2' }}>
                      {approveStart || approveTarget2
                        ? 'Diusulkan Sales — ubah bila perlu.'
                        : 'Sales tidak mengusulkan timeline. Isi di sini, atau lengkapi menyusul di Project Progress.'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                          Mulai Pengerjaan
                        </label>
                        <input type="date" value={approveStart}
                          onChange={e => setApproveStart(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40 text-slate-800"
                          style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                          Target Selesai
                        </label>
                        <input type="date" value={approveTarget2} min={approveStart || undefined}
                          onChange={e => setApproveTarget2(e.target.value)}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40 text-slate-800"
                          style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Info WA */}
                <div className="rounded-xl p-3 flex items-start gap-2"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="text-base flex-shrink-0">💬</span>
                  <p className="text-[11px] text-green-700 leading-relaxed">
                    WA notifikasi akan otomatis dikirim ke <strong>Team PTS IVP</strong> yang di-assign dan ke <strong>Sales</strong> yang request bahwa jadwalnya sudah disetujui.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setApproveTarget(null); setApproveBatchSiblings([]); setApproveAssignTo(''); setApproveDate(''); setApproveTime(''); }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
                    Batal
                  </button>
                  <button
                    onClick={handleApproveAssign}
                    disabled={approveSaving || !approveAssignTo}
                    className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
                    {approveSaving
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                      : approveSupervisors.length > 0 ? <>✅ Assign Langsung (lewati Supervisor)</> : <>✅ Approve &amp; Assign</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── SUPERVISOR ASSIGN MODAL ── */}
        {supervisorAssignTarget && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setSupervisorAssignTarget(null); setSupervisorAssignBatchSiblings([]); setSupervisorAssignTo(''); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(245,158,11,0.4)' }}>
              <div className="px-6 py-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <div>
                  <h3 className="text-lg font-bold text-white">🎯 Assign Tim</h3>
                  <p className="text-amber-100/90 text-xs mt-0.5 truncate max-w-[300px]">{supervisorAssignTarget.project_name}</p>
                </div>
                <button aria-label="Tutup" onClick={() => { setSupervisorAssignTarget(null); setSupervisorAssignBatchSiblings([]); setSupervisorAssignTo(''); }}
                  className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Request dari Sales</p>
                  <p className="text-sm font-bold text-slate-800">{supervisorAssignTarget.sales_name}{supervisorAssignTarget.sales_division ? ` · ${supervisorAssignTarget.sales_division}` : ''}</p>
                  <p className="text-xs text-slate-500">📍 {supervisorAssignTarget.address || '-'} · 🏷️ {supervisorAssignTarget.category}</p>
                  <p className="text-xs text-slate-500">📅 Jadwal: {formatDate(supervisorAssignTarget.due_date)} {supervisorAssignTarget.due_time}</p>
                </div>

                {supervisorAssignBatchSiblings.length > 0 && (
                  <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <span className="text-base flex-shrink-0">🗓️</span>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      Bagian dari <strong>{supervisorAssignBatchSiblings.length + 1} hari</strong> yang diminta sekaligus — semua tanggal akan ikut di-assign ke orang yang sama.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Assign ke *</label>
                  <select aria-label="-- Pilih --" value={supervisorAssignTo} onChange={e => setSupervisorAssignTo(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-amber-500/40"
                    style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }}>
                    <option value="">-- Pilih --</option>
                    <option value="SELF">🙋 Saya kerjakan sendiri (tim penuh/sibuk)</option>
                    <optgroup label="Anggota Tim">
                      {/* Manager dikecualikan — bukan anggota tim biasa yang di-assign tugas oleh Supervisor */}
                      {teamUsers.filter(u => u.team_type === currentUser?.team_type && u.username !== currentUser?.username && u.jabatan !== 'Manager').map(u => (
                        <option key={u.id} value={u.username}>{u.full_name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="text-base flex-shrink-0">💬</span>
                  <p className="text-[11px] text-green-700 leading-relaxed">
                    WA notifikasi otomatis dikirim ke yang di-assign (kecuali kamu sendiri) dan ke Sales yang request.
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setSupervisorAssignTarget(null); setSupervisorAssignBatchSiblings([]); setSupervisorAssignTo(''); }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>Batal</button>
                  <button onClick={handleSupervisorAssignConfirm} disabled={supervisorAssignSaving || !supervisorAssignTo}
                    className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}>
                    {supervisorAssignSaving
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                      : <>🎯 Assign</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

                <ModalHapus
          showDeleteModal={showDeleteModal}
          deleteTarget={deleteTarget}
          deleteConfirmText={deleteConfirmText}
          setDeleteConfirmText={setDeleteConfirmText}
          setShowDeleteModal={setShowDeleteModal}
          setDeleteTarget={setDeleteTarget}
          handleDelete={handleDelete}
        />

        {/* ── FORM MODAL (Tambah / Edit Reminder) ── */}
        {/* Bulk Delete Confirm Modal */}
      {bulkConfirm && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">🗑️</span>
              <div><h3 className="font-bold text-white">Hapus {selectedIds.size} Jadwal?</h3>
              <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-5">Kamu akan menghapus <strong>{selectedIds.size} jadwal</strong> yang dipilih secara permanen dari sistem.</p>
              <div className="flex gap-3">
                <button onClick={() => setBulkConfirm(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
                <button onClick={async () => {
                  setBulkConfirm(false); setBulkDeleting(true);
                  const { error } = await supabase.from('reminders').delete().in('id', Array.from(selectedIds));
                  if (!error) { setReminders(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
                  else notify('error', 'Gagal: ' + error.message);
                  setBulkDeleting(false);
                }} className="flex-[2] bg-gradient-to-r from-red-600 to-red-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm hover:from-red-700 hover:to-red-800">
                  🗑️ Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/*
        Pertanyaan kelanjutan proyek. Bukan peringatan yang bisa diabaikan:
        keduanya pilihan yang sah, dan platform tidak punya dasar untuk memilih
        sendiri. Yang salah bukan "membuat dua jadwal" - itu wajar - melainkan
        membiarkan hubungannya tidak dinyatakan.
      */}
      {tanyaLanjutan && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)' }}>
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="px-5 py-3.5" style={{ background: '#0891b2', color: '#fff' }}>
                <h3 className="font-bold text-base">Proyek ini sudah punya jadwal</h3>
              </div>
              <div className="p-5 space-y-3 text-[13px] leading-relaxed">
                <p className="font-bold text-slate-800">{tanyaLanjutan.nama}</p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 max-h-40 overflow-y-auto">
                  {tanyaLanjutan.sebelumnya.slice(0, 6).map(r => (
                    <div key={r.id} className="px-3 py-2 flex justify-between gap-3">
                      <span className="text-slate-700">{r.category}</span>
                      <span className="text-slate-500 text-right">{r.assign_name || '-'} · {formatDate(r.due_date)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-slate-700">Jadwal yang sedang dibuat ini bagian dari proyek yang sama, atau pekerjaan terpisah?</p>
                <p className="text-[11.5px] text-slate-500">
                  Kalau satu proyek, keduanya dihitung <b>satu pool insentif</b>. Kalau terpisah,
                  masing-masing punya poolnya sendiri — pilih ini untuk kontrak yang berbeda.
                </p>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2">
                <button onClick={() => setTanyaLanjutan(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-500 bg-white border border-slate-300 hover:bg-slate-100">
                  Batal
                </button>
                <button onClick={() => tanyaLanjutan.lanjut(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50">
                  Pekerjaan terpisah
                </button>
                <button onClick={async () => tanyaLanjutan.lanjut(await resolveGrupInsentif(tanyaLanjutan.sebelumnya))}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                  style={{ background: '#0891b2' }}>
                  Satu proyek yang sama
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/*
        Lapis 4, langkah 'pilih': ditanyakan sebelum form terlihat sama sekali,
        seperti Create Ticket. Menunda pertanyaan ini sampai form terbuka
        berarti orang sudah mulai mengetik sebelum tahu ada jalan yang lebih
        cepat.
      */}
      {langkahBuat === 'pilih' && (
        <ModalPortal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}>
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
              role="dialog" aria-modal="true" aria-labelledby="judul-tipe-reminder">
              <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
                <h3 id="judul-tipe-reminder" className="font-bold text-base">
                  {buatUntukGuest ? '📅 Request Jadwal Baru' : '📅 Reminder Baru'}
                </h3>
                <p className="text-[12px] text-white/80 mt-0.5">
                  {buatUntukGuest ? 'Project-nya sudah pernah Anda ajukan, atau baru?' : 'Project-nya sudah pernah dijadwalkan, atau baru?'}
                </p>
              </div>
              <div className="p-4 space-y-2.5">
                {/*
                  Judulnya sengaja menyebut BAST, bukan sekadar "Project yang
                  sudah ada" - itu terlalu umum untuk menjelaskan APA yang
                  sebenarnya digabungkan kalau pilihan ini diambil. Yang
                  ditanyakan bukan "apakah project ini sudah tercatat" (hampir
                  selalu ya untuk klien lama), tapi "apakah serah-terima
                  pekerjaan ini nanti SATU BAST dengan yang sudah ada" - itulah
                  yang menentukan boleh tidaknya digabung jadi satu pool
                  insentif.
                */}
                <button type="button" onClick={() => setLangkahBuat('cari')}
                  className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50 transition-all">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">🔍</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">
                        {buatUntukGuest ? 'Project Lama Anda — Satu BAST' : 'Project Lama — Satu BAST'}
                      </p>
                      <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                        {buatUntukGuest
                          ? 'Pernah Anda ajukan sebelumnya (mis. sudah Konfigurasi, sekarang tambah Training). Cari namanya — alamat, PIC, dan produk otomatis terisi.'
                          : 'Pernah dijadwalkan sebelumnya (mis. sudah Konfigurasi, sekarang tambah Training). Cari namanya — alamat, PIC, produk, sales, dan brand otomatis terisi.'}
                      </p>
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1.5">
                        {buatUntukGuest
                          ? '✓ Disarankan — kalau serah-terimanya nanti satu BAST dengan yang lama. Hanya project Anda sendiri yang tampil di pencarian.'
                          : '✓ Disarankan — kalau serah-terimanya nanti satu BAST dengan jadwal lama'}
                      </p>
                    </div>
                  </div>
                </button>
                <button type="button"
                  onClick={() => {
                    setLangkahBuat(null); setProyekLamaTerpilih(null);
                    if (buatUntukGuest) { setPraFillGuest(null); setShowRequestModal(true); }
                    else setShowFormModal(true);
                  }}
                  className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">✏️</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">Project Baru</p>
                      <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                        {buatUntukGuest ? 'Belum pernah Anda ajukan. Seluruh detailnya diisi manual.' : 'Belum pernah tercatat. Seluruh detailnya diisi manual.'}
                      </p>
                    </div>
                  </div>
                </button>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button type="button" onClick={() => setLangkahBuat(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100">
                  Batal
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/*
        Lapis 4, langkah 'cari': tahap sendiri yang ringan, hanya kotak cari dan
        hasilnya - bukan bagian dari form besar. Form penuh baru terbuka
        SETELAH satu project dikonfirmasi lewat "OK, Isi Form", jadi begitu
        form itu terlihat, ia sudah terisi. Diambil dari `reminders` yang sudah
        termuat di halaman ini (sudah dibatasi lingkup pengguna), bukan kueri
        baru - tidak ada permintaan tambahan ke server untuk menampilkan
        pencarian ini.
      */}
      {langkahBuat === 'cari' && (
        <ModalPortal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: '85vh' }} role="dialog" aria-modal="true" aria-labelledby="judul-cari-reminder">
              <div className="px-5 py-4 text-white flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
                <button type="button" aria-label="Kembali"
                  onClick={() => { setLangkahBuat('pilih'); setPraPilihProyek(null); setCarianProyek(''); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-white/10">
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <h3 id="judul-cari-reminder" className="font-bold text-base">
                    {buatUntukGuest ? '🔍 Cari Project Lama Anda' : '🔍 Cari Project yang Sudah Ada'}
                  </h3>
                  <p className="text-[12px] text-white/80 mt-0.5">
                    {buatUntukGuest
                      ? 'Hanya project yang pernah Anda ajukan yang muncul di sini.'
                      : 'Ketik nama project, pilih dari hasilnya, lalu konfirmasi.'}
                  </p>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-y-auto min-h-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input type="text" autoFocus value={carianProyek}
                    onChange={e => { setCarianProyek(e.target.value); setPraPilihProyek(null); }}
                    placeholder="Ketik nama project untuk mencari..."
                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-cyan-500/40 border border-slate-200" />
                </div>

                {hasilCarianProyek.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                    {carianProyek.trim()
                      ? (buatUntukGuest
                          ? <>Tidak ada project Anda bernama &quot;{carianProyek.trim()}&quot;. Pencarian ini hanya mencakup project yang pernah Anda ajukan sendiri - coba potongan nama yang lebih pendek, atau tekan Kembali dan pilih Project Baru.</>
                          : <>Tidak ada project bernama &quot;{carianProyek.trim()}&quot; dalam jangkauan akun kamu. Coba potongan nama yang lebih pendek, atau tekan Kembali dan pilih Project Baru.</>)
                      : (buatUntukGuest ? 'Belum ada project yang pernah Anda ajukan.' : 'Belum ada project tercatat.')}
                  </p>
                )}

                {hasilCarianProyek.length > 0 && (
                  <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(8,145,178,0.25)' }}>
                    {hasilCarianProyek.map(r => {
                      const disorot = praPilihProyek?.id === r.id;
                      const jumlahJadwal = reminders.filter(x => normalkanNama(x.project_name) === normalkanNama(r.project_name)).length;
                      return (
                        <button key={r.id} type="button" onClick={() => setPraPilihProyek(r)}
                          className="w-full text-left px-4 py-3 transition-colors border-b last:border-b-0 flex flex-col gap-0.5"
                          style={{ borderColor: 'rgba(0,0,0,0.06)', background: disorot ? 'rgba(8,145,178,0.08)' : 'white' }}>
                          <span className="flex items-center gap-2">
                            {disorot && <span className="text-cyan-700 flex-shrink-0">✓</span>}
                            <span className="text-sm font-bold text-slate-800">{r.project_name}</span>
                          </span>
                          <span className="text-xs text-slate-500 flex gap-3 flex-wrap">
                            <span className="font-semibold text-cyan-700">{jumlahJadwal} jadwal tercatat</span>
                            {r.address && <span>📍 {r.address.slice(0, 50)}{r.address.length > 50 ? '…' : ''}</span>}
                            {r.sales_name && <span>👤 {r.sales_name}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
                <span className="text-[11px] text-slate-500">
                  {praPilihProyek ? `Dipilih: ${praPilihProyek.project_name}` : 'Belum ada yang dipilih'}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setLangkahBuat(null)}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100">
                    Batal
                  </button>
                  <button type="button" onClick={konfirmasiProyekLama} disabled={!praPilihProyek}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
                    OK, Isi Form →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {showFormModal && (
        <ReminderFormModal
          editingReminder={editingReminder}
          jumlahJadwalLama={proyekLamaTerpilih?.length ?? 0}
          formData={formData as ReminderForm}
          setFormData={setFormData as (data: ReminderForm) => void}
          saving={saving}
          teamUsers={teamUsers}
          guestUsers={guestUsers}
          bulkTarget={bulkTarget}
          onBulkTargetChange={setBulkTarget}
          extraDates={extraDates}
          onExtraDatesChange={setExtraDates}
          onClose={() => { setShowFormModal(false); setEditingReminder(null); setFormData(emptyForm); setBulkTarget('none'); setExtraDates([]); setProyekLamaTerpilih(null); }}
          onSubmit={() => handleSave()}
          supervisorUsers={(isAdmin || isManager) ? teamUsers.filter(u => u.jabatan === 'Supervisor') : []}
          canAssignSelf={isAdmin || isManager}
          selfUser={currentUser ? { username: currentUser.username, full_name: currentUser.full_name } : null}
        />
      )}

                <PopupNotifikasi
          showNotificationPopup={showNotificationPopup}
          myReminders={myReminders}
          setShowNotificationPopup={setShowNotificationPopup}
          setDetailReminder={setDetailReminder}
        />

                <PopupLonceng
          showBellPopup={showBellPopup}
          myActiveReminders={myActiveReminders}
          perluAksiSaya={perluAksiSaya}
          setShowBellPopup={setShowBellPopup}
          setDetailReminder={setDetailReminder}
        />

        {/* ── DETAIL POPUP ── */}
        {/* Dicabut ke <body> lewat ModalPortal — alasan lengkapnya ada di
            components/shared/ModalPortal.tsx. Singkatnya: `position: fixed`
            bisa terperangkap leluhur ber-backdrop-filter, dan z-index bisa
            terperangkap leluhur yang membentuk stacking context.

            Modal ini Z.overlay (1000) — ia KANVAS DASAR. Popup yang dibuka DARI
            dalamnya (Assign, Approve, Reject, Hapus) memakai Z.overlayTop
            (1100) supaya selalu di atas kanvas ini. Dulu keduanya di angka yang
            sama-sama benar (110 > 100) tapi tidak pernah dibandingkan karena
            yang satu di-portal dan yang lain terkurung pembungkus `relative
            z-10` — itulah sebabnya popup Assign muncul di belakang. */}
        {detailReminder && (
          <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex justify-center z-[1000] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setDetailReminder(null); setShowModeModal(false); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); } }}>
            <div className="flex gap-3 w-full justify-center min-h-0"
              style={{ maxWidth: showModeModal ? '1140px' : showRiwayat ? '1060px' : '672px', transition: 'max-width 0.25s ease' }}>
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full flex-1 min-w-0 overflow-hidden flex flex-col"
              style={{ animation: 'scale-in 0.25s ease-out', border: '1px solid rgba(0,0,0,0.1)', height: '100%' }}>
              <div className="px-6 py-5 flex-shrink-0 sticky top-0 z-30 relative" style={{
                background: (() => { const c = CATEGORY_CONFIG[detailReminder.category]; const base = c ? `linear-gradient(135deg,${c.accent}dd,${c.accent}88)` : 'linear-gradient(135deg,#1d4ed8,#1e40af)'; return `linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.15)),${base}`; })()
              }}>
                <button onClick={() => setShowRiwayat(v => !v)}
                  title={showRiwayat ? 'Sembunyikan riwayat perubahan' : 'Tampilkan riwayat perubahan'}
                  className="absolute top-4 right-14 h-7 px-2.5 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center gap-1 text-[11px] font-bold">
                  🕘 <span className="hidden sm:inline">Riwayat</span>
                </button>
                <div className="flex flex-wrap gap-2 mb-3">
                  <PriorityBadge priority={detailReminder.priority} onHeader />
                  <StatusBadge status={detailReminder.status} onHeader />
                  <CategoryBadge category={detailReminder.category} onHeader />
                  {detailReminder.repeat !== 'none' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                      🔁 {REPEAT_OPTIONS.find(r => r.value === detailReminder.repeat)?.label}
                    </span>
                  )}
                  {detailReminder.wa_sent_h1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/80 text-white">✅ WA H-1 Terkirim</span>
                  )}
                </div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-1 mb-0.5">Nama Project</p>
                <h2 className="text-2xl font-bold text-white leading-tight">{(detailReminder.project_name || '').trim() || ((detailReminder as any).title || '').trim() || '—'}</h2>
                {detailReminder.address && (
                  <>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-2 mb-0.5">Lokasi</p>
                    <p className="text-white text-sm flex items-center gap-1.5"><span>📍</span>{detailReminder.address}</p>
                  </>
                )}
                {detailReminder.description && (
                  <>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-2 mb-0.5">Deskripsi</p>
                    <p className="text-white/90 text-xs">{detailReminder.description}</p>
                  </>
                )}
                {/* Troubleshooting link ke Ticketing — navigasi internal */}
                {detailReminder.category === 'Troubleshooting' && (
                  <button
                    onClick={e => { e.stopPropagation(); setDetailReminder(null); router.push('/ticketing'); }}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.92)' }}>
                    🎫 Buka Platform Ticketing
                  </button>
                )}
                <button aria-label="Tutup" onClick={() => { setDetailReminder(null); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                {/* Action bar — sticky di atas, menempel header detail */}
                {(isAdmin || currentUser?.role === 'team' || isMyReviewStage(detailReminder)) && (
                  <div className="flex gap-2 flex-wrap sticky top-0 z-20 bg-white/95 backdrop-blur-sm -mx-5 px-5 py-2.5 border-b border-gray-100">
                    {canInternalApprove(detailReminder) && (
                      <>
                        <button onClick={() => setInternalApproveTarget(detailReminder)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }}>✅ Approve &amp; Teruskan ke Admin</button>
                        <button onClick={() => handleInternalReject(detailReminder)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                          style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white' }}>❌ Tolak</button>
                      </>
                    )}
                    {canApproveAssign && !detailReminder.assigned_to && detailReminder.notes?.includes('[REQUEST SALES]') && detailReminder.routing_status !== 'internal_review' && (
                      <button onClick={() => { setApproveTarget(detailReminder); setApproveBatchSiblings(detailReminder.batch_id ? reminders.filter(gr => gr.id !== detailReminder.id && gr.batch_id === detailReminder.batch_id && !gr.assigned_to) : []); setApproveAssignTo(''); setApproveDate(detailReminder.due_date); setApproveTime(detailReminder.due_time); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white' }}>✅ Approve &amp; Assign</button>
                    )}
                    {currentUser?.id === detailReminder.assigned_supervisor_id && detailReminder.routing_status === 'supervisor_assign' && (
                      <button onClick={() => openSupervisorAssign(detailReminder, [detailReminder, ...reminders.filter(gr => gr.id !== detailReminder.id && gr.batch_id === detailReminder.batch_id)])}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }}>🎯 Assign Tim</button>
                    )}
                    {(isAdmin || currentUser?.role === 'team') && detailReminder.status !== 'done' && (
                      <button onClick={() => { setRescheduleTarget(detailReminder); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#d97706,#b45309)', color: 'white' }}>📅 Re-Schedule</button>
                    )}
                    {(isAdmin || currentUser?.role === 'team') && detailReminder.status === 'done' && detailReminder.sales_name?.trim() && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && (
                      <button onClick={() => handleResendFormReview(detailReminder)} disabled={resendingFormReview}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: 'white' }}>
                        {resendingFormReview ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '⭐'} Resend Review</button>
                    )}
                    {(isAdmin || isManager) && (
                      <button onClick={() => handleSendWA(detailReminder)} disabled={sendingWA === detailReminder.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white' }}>
                        {sendingWA === detailReminder.id ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '💬'} Kirim WA</button>
                    )}
                    {(isAdmin || isManager) && (
                      <button onClick={() => openEdit(detailReminder)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white' }}>✏️ Edit</button>
                    )}
                  </div>
                )}

                {detailReminder.status === 'cancelled' && detailReminder.rejection_reason && (
                  <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)' }}>
                    <span className="text-base flex-shrink-0">❌</span>
                    <div>
                      <p className="text-xs font-bold text-red-700">Request Ditolak</p>
                      <p className="text-xs text-red-600 mt-0.5">{detailReminder.rejection_reason}</p>
                    </div>
                  </div>
                )}

                <div>
                  <SectionHeaderSmall icon="📋" title="Detail Jadwal" />
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>Assign To</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: 'rgba(220,38,38,0.2)', color: '#dc2626' }}>
                          {detailReminder.assign_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{detailReminder.assign_name}</p>
                          <p className="text-xs" style={{ color: '#64748b' }}><Username value={detailReminder.assigned_to} /></p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>📅 Jadwal</p>
                      <p className="text-sm font-bold text-slate-800">{formatDate(detailReminder.due_date)}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>⏰ {detailReminder.due_time}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionHeaderSmall icon="🏢" title="Informasi Project" />
                  <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                    {detailReminder.product && <InfoRow icon="📦" label="Product / Unit" value={detailReminder.product} />}
                    {detailReminder.product_type && <InfoRow icon="🏷️" label="Tipe Produk" value={detailReminder.product_type} />}
                    <InfoRow icon="👤" label="Nama Sales & Divisi" value={[detailReminder.sales_name, detailReminder.sales_division].filter(Boolean).join(' / ')} />
                    {detailReminder.sales_name && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && (
                      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(124,58,237,0.04)' }}>
                        <span className="text-base flex-shrink-0">⭐</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#7c3aed' }}>Guest Review (Sales)</p>
                          <p className="text-sm font-semibold text-violet-700">{detailReminder.sales_name}</p>
                          {detailReminder.sales_division && <p className="text-[10px] text-violet-500">{detailReminder.sales_division}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {detailReminder.status === 'done' ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: '#7c3aed' }}>
                              Form Review ✓
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.4)' }}>
                              ⏳ Setelah Completed
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {detailReminder.pic_name && <InfoRow icon="🙋" label="Nama PIC Project" value={detailReminder.pic_name} />}
                    {detailReminder.pic_phone && (
                      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <span className="text-base flex-shrink-0">📱</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>No. Telepon PIC</p>
                          <a href={`tel:${detailReminder.pic_phone}`} className="text-sm font-semibold hover:underline" style={{ color: '#60a5fa' }}
                            onClick={e => e.stopPropagation()}>{detailReminder.pic_phone}</a>
                        </div>
                      </div>
                    )}
                    {detailReminder.description && <InfoRow icon="📝" label="Deskripsi" value={detailReminder.description} />}
                  </div>
                </div>

                {/* Placeholder default "Menunggu assignment dari Admin" disaring — bukan catatan
                    asli, jangan ditampilkan lagi (termasuk data lama yg belum sempat dibersihkan). */}
                {cleanRequestNotes(detailReminder.notes) && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#f59e0b' }}>📝 Catatan</p>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{cleanRequestNotes(detailReminder.notes)}</p>
                  </div>
                )}



                {/* ── Timeline Project Progress — kategori pemicu saja ──
                    Sejajar dengan blok Masa Garansi di bawahnya: keduanya
                    informasi jadwal yang melekat pada kategori Konfigurasi. */}
                {triggersProjectProgress(detailReminder.category) && (() => {
                  const t = detailReminder as { progress_start_date?: string | null; progress_target_date?: string | null };
                  const ada = t.progress_start_date || t.progress_target_date;
                  return (
                    <div className="rounded-xl p-4 flex items-center gap-3"
                      style={ada
                        ? { background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.25)' }
                        : { background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)' }}>
                      <span className="text-xl">📊</span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ada ? '#0e7490' : '#64748b' }}>
                          Timeline Project Progress
                        </p>
                        {ada ? (
                          <p className="text-sm font-semibold text-slate-700">
                            {t.progress_start_date ? formatDate(t.progress_start_date) : '—'}
                            <span className="mx-1.5 text-slate-300">→</span>
                            {t.progress_target_date ? formatDate(t.progress_target_date) : '—'}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Belum ditetapkan</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Warranty Status — hanya untuk Konfigurasi & Konfigurasi & Training ── */}
                {(detailReminder.category === 'Konfigurasi' || detailReminder.category === 'Konfigurasi & Training') && (() => {
                  const wy = (detailReminder as any).warranty_years as 1 | 2 | 3 | null | undefined;
                  const bastDate = detailReminder.due_date;
                  if (!wy || !bastDate) return (
                    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)' }}>
                      <span className="text-xl">🛡️</span>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Masa Garansi</p>
                        <p className="text-sm text-slate-400 italic">Tidak dikonfigurasi</p>
                      </div>
                    </div>
                  );
                  const bast = new Date(bastDate + 'T00:00:00');
                  const expiry = new Date(bastDate + 'T00:00:00');
                  expiry.setFullYear(expiry.getFullYear() + wy);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isInWarranty = today <= expiry;
                  const diffMs = expiry.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  const expiryStr = expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  const bastStr = bast.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  return (
                    <div className="rounded-xl p-4" style={isInWarranty
                      ? { background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.35)' }
                      : { background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.35)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{isInWarranty ? '🛡️' : '⚠️'}</span>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                          Status Garansi
                        </p>
                        <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold" style={isInWarranty
                          ? { background: 'rgba(14,165,233,0.18)', color: '#0369a1' }
                          : { background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                          {isInWarranty ? '✅ In Warranty' : '❌ Out of Warranty'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                        <div>
                          <p className="text-slate-400 mb-0.5">BAST / Mulai</p>
                          <p className="font-semibold text-slate-700">{bastStr}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">Garansi Berakhir</p>
                          <p className="font-semibold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>{expiryStr}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">Durasi</p>
                          <p className="font-semibold text-slate-700">{wy} Tahun</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">{isInWarranty ? 'Sisa Hari' : 'Sudah Lewat'}</p>
                          <p className="font-bold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                            {isInWarranty ? `${diffDays} hari` : `${Math.abs(diffDays)} hari`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Detail Pelaksanaan — diisi lewat modal "Mode Penyelesaian" saat
                    kategori Konfigurasi/Konfigurasi & Training/Training di-update ke
                    Completed. Sebelumnya data ini (mode_penyelesaian, BAST, tipe
                    display, controller automation, middleware) tersimpan tapi tidak
                    pernah ditampilkan di mana pun — di list HANYA nilai Onsite/Remote
                    yang tampil (di bawah Kegiatan), detail lengkapnya di sini. ── */}
                {(INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && detailReminder.mode_penyelesaian && (() => {
                  const brandLabel: Record<string, string> = { cue: 'Cue System', extron: 'Extron', wyrestorm: 'Wyrestorm' };
                  const displayLabel: Record<string, string> = { led: 'LED', lcd: 'LCD', mix: 'Mix (LED + LCD)' };
                  const isOnsite = detailReminder.mode_penyelesaian === 'onsite';
                  return (
                    <div className="rounded-xl p-4" style={isOnsite
                      ? { background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)' }
                      : { background: 'rgba(59,130,246,0.07)', border: '1.5px solid rgba(59,130,246,0.3)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{isOnsite ? '🏠' : '📡'}</span>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isOnsite ? '#047857' : '#1d4ed8' }}>
                          Detail Pelaksanaan · {isOnsite ? 'ONSITE' : 'REMOTE'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {detailReminder.bast_date && (
                          <div>
                            <p className="text-slate-400 mb-0.5">📅 Tanggal BAST</p>
                            <p className="font-semibold text-slate-700">{formatDate(detailReminder.bast_date)}</p>
                          </div>
                        )}
                        {detailReminder.display_type && (
                          <div>
                            <p className="text-slate-400 mb-0.5">🖥️ Tipe Display</p>
                            <p className="font-semibold text-slate-700">{displayLabel[detailReminder.display_type] ?? detailReminder.display_type}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-slate-400 mb-0.5">🎛️ Controller Automation</p>
                          <p className="font-semibold text-slate-700">
                            {detailReminder.requires_controller_automation
                              ? (brandLabel[detailReminder.controller_automation_brand ?? ''] ?? 'Ya')
                              : 'Tidak'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">🔌 Middleware / System / Matrix</p>
                          <p className="font-semibold text-slate-700">{detailReminder.requires_middleware ? 'Ya' : 'Tidak'}</p>
                        </div>
                        {!isOnsite && detailReminder.installer_name && (
                          <div>
                            <p className="text-slate-400 mb-0.5">🔧 Installer</p>
                            <p className="font-semibold text-slate-700">{detailReminder.installer_name}</p>
                          </div>
                        )}
                        {!isOnsite && detailReminder.installer_daerah && (
                          <div>
                            <p className="text-slate-400 mb-0.5">📍 Daerah Installer</p>
                            <p className="font-semibold text-slate-700">{detailReminder.installer_daerah}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Update Status BARU BISA setelah request selesai di-approve & di-assign
                   ke pengerjaan (assigned_to terisi). Selama masih di alur approval
                   (internal_review / admin_review / supervisor_assign, assigned_to kosong)
                   → belum bisa update status. */}
                {(isAdmin || currentUser?.role === 'team') && !detailReminder.assigned_to && detailReminder.notes?.includes('[REQUEST SALES]') && detailReminder.status !== 'done' && (
                  <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-1" style={{ background: 'rgba(148,163,184,0.1)', border: '1.5px solid rgba(148,163,184,0.3)' }}>
                    <span className="text-lg">🔒</span>
                    <div>
                      <p className="text-xs font-bold text-slate-600">Belum bisa update status</p>
                      <p className="text-[11px] text-slate-500">Menunggu approval & assignment selesai (Sales Internal → Manager → Supervisor → Team).</p>
                    </div>
                  </div>
                )}
                {(isAdmin || currentUser?.role === 'team') && detailReminder.assigned_to && (
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#64748b' }}>Update Status</p>
                  {detailReminder.status === 'done' ? (
                    <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.35)' }}>
                      <span className="text-lg">✅</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-700">Jadwal Selesai</p>
                        <p className="text-[10px] text-emerald-600">Status completed tidak dapat diubah kembali.</p>
                      </div>
                    </div>
                  ) : (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(Object.keys(STATUS_CONFIG) as Status[]).filter(s => s !== 'done' || detailReminder.status !== 'done').map(s => {
                      const c = STATUS_CONFIG[s];
                      const isActive = (pendingStatus ?? detailReminder.status) === s;
                      return (
                        <button key={s}
                          onClick={() => {
                            setPendingStatus(s);
                            if (s !== 'done') { setStatusPhoto(null); setStatusPhotoPreview(null); setShowModeModal(false); }
                            else if ((INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category)) {
                              // Kategori incentive  panel Mode langsung muncul di kanan (tanpa scroll)
                              setPendingPhotoUrl(undefined);
                              setModePenyelesaian(null); setInstallerName(''); setInstallerDaerah('');
                              setBastDate(new Date().toISOString().split('T')[0]);
                              setDisplayType(null); setRequiresMiddleware(false);
                              setRequiresControllerAuto(false); setControllerBrand(null);
                              setShowModeModal(true);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'ring-2 ring-offset-1 scale-105' : 'opacity-70 hover:opacity-100'}`}
                          style={{ background: c.bg, color: c.color, border: `2px solid ${c.border}`, '--tw-ring-color': c.border } as React.CSSProperties}>
                          {c.icon} {c.label}
                        </button>
                      );
                    })}
                  </div>
                  )}

                  {/* Photo upload - opsional untuk status Completed */}
                  {detailReminder.status !== 'done' && (pendingStatus ?? detailReminder.status) === 'done' && !showModeModal && (
                    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#059669' }}>
                        📸 Foto Bukti Selesai <span className="text-gray-400 font-normal normal-case">(opsional)</span>
                      </p>
                      <input
                        ref={statusPhotoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setStatusPhoto(file);
                            const reader = new FileReader();
                            reader.onload = ev => setStatusPhotoPreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {statusPhotoPreview ? (
                        <div className="relative">
                          <img src={statusPhotoPreview} alt="preview" className="w-full max-h-40 object-cover rounded-lg" />
                          <button aria-label="Tutup"
                            onClick={() => { setStatusPhoto(null); setStatusPhotoPreview(null); if (statusPhotoRef.current) statusPhotoRef.current.value = ''; }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600">
                            ✕
                          </button>
                          <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">✅ {statusPhoto?.name}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => statusPhotoRef.current?.click()}
                          className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-all hover:bg-emerald-50"
                          style={{ borderColor: 'rgba(16,185,129,0.5)' }}>
                          <span className="text-2xl">📷</span>
                          <span className="text-xs font-bold text-emerald-700">Klik untuk upload foto</span>
                          <span className="text-[10px] text-gray-400">JPG, PNG, WEBP — maks. 10MB</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Tombol Update Status */}
                  {pendingStatus && pendingStatus !== detailReminder.status && !showModeModal && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(0,0,0,0.06)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
                        Batal
                      </button>
                      <button
                        onClick={handleConfirmStatusUpdate}
                        disabled={updatingStatus}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 3px 12px rgba(5,150,105,0.35)' }}>
                        {updatingStatus
                          ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        }
                        {updatingStatus ? 'Menyimpan...' : 'Konfirmasi Update'}
                      </button>
                    </div>
                  )}
                </div>
                )}

                {/* Foto Bukti Selesai - tampil jika status done dan ada foto */}
                {detailReminder.status === 'done' && detailReminder.completion_photo_url && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.05)' }}>
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                      <span className="text-base">📸</span>
                      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#059669' }}>Foto Bukti Selesai</p>
                    </div>
                    <div className="p-3">
                      <img
                        src={detailReminder.completion_photo_url}
                        alt="Foto bukti selesai"
                        loading="lazy"
                        decoding="async"
                        className="w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ maxHeight: 220 }}
                        onClick={() => window.open(detailReminder.completion_photo_url, '_blank')}
                      />
                      <a
                        href={detailReminder.completion_photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors">
                        🔗 Buka foto di tab baru
                      </a>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* RIGHT: panel Mode Penyelesaian (muncul saat klik Completed) — seperti detail Ticketing */}
            {/* Riwayat sebagai panel samping — terbaca berdampingan dengan
                detailnya, bukan tersembunyi di balik tombol di dalam. Mode
                Penyelesaian punya prioritas: ia bagian dari alur menyelesaikan
                pekerjaan, sedangkan riwayat hanya rujukan. */}
            {showRiwayat && !showModeModal && (
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex-shrink-0 self-start overflow-hidden flex flex-col"
                style={{ animation: 'scale-in 0.2s ease-out', border: '1px solid rgba(0,0,0,0.1)', maxHeight: '100%' }}>
                <div className="px-5 py-4 flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg,#475569,#334155)' }}>
                  <h3 className="text-white font-bold text-base">🕘 Riwayat Perubahan</h3>
                  <p className="text-slate-300 text-[11px] mt-0.5 truncate">{detailReminder.project_name}</p>
                  <button aria-label="Tutup" onClick={() => setShowRiwayat(false)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {/* Alur ditaruh di panel ini, di bawah riwayat: keduanya
                      menjawab pertanyaan yang sama — sudah sampai mana perkara
                      ini. Riwayat menceritakan yang SUDAH terjadi, alur
                      menunjukkan yang MASIH tersisa. Dipisah ke dua tempat
                      justru memaksa mata bolak-balik. */}
                  {/* Baris pembuatan diturunkan dari reminder-nya sendiri.
                      logAudit baru mencatat 'create' sejak perbaikan terakhir,
                      jadi tanpa ini seluruh reminder LAMA tampak tidak punya
                      pangkal — padahal created_at & sales_name-nya tersimpan
                      sejak awal. Untuk request Sales dipakai nama sales-nya
                      (dialah yang mengajukan), bukan created_by yang bisa saja
                      Sales Internal yang menginput. */}
                  <AuditTrailPanel targetId={detailReminder.id} modul="reminder"
                    selaluTerbuka sembunyikanBilaKosong={false}
                    awal={{
                      // "oleh" = PELAKU (yang menginput), sama seperti baris audit
                      // sungguhan - jadi created_by lebih diutamakan daripada
                      // sales_name. Sales Internal kadang menginput request ATAS
                      // NAMA Sales External (fitur SBU); memakai sales_name di sini
                      // akan menghapus jejak siapa yang benar-benar mengirim.
                      oleh: (detailReminder.created_by
                        ? (guestUsers.find(g => g.username === detailReminder.created_by)?.full_name ?? detailReminder.created_by)
                        : detailReminder.sales_name) || null,
                      waktu: detailReminder.created_at ?? null,
                      keterangan: `Diajukan${detailReminder.sales_division ? ` — ${detailReminder.sales_division}` : ''} · kategori ${detailReminder.category}`
                        + (() => {
                          const namaPembuat = detailReminder.created_by
                            ? (guestUsers.find(g => g.username === detailReminder.created_by)?.full_name ?? detailReminder.created_by)
                            : null;
                          return namaPembuat && detailReminder.sales_name && namaPembuat !== detailReminder.sales_name
                            ? ` · atas nama Sales ${detailReminder.sales_name}` : '';
                        })(),
                    }}
                    /*
                      Peristiwa lain yang terjadi SEBELUM logAudit mencatatnya.

                      Waktunya TIDAK BOLEH memakai updated_at - kolom itu ikut
                      berubah oleh SUNTINGAN APA PUN pada baris ini, termasuk
                      yang tidak berhubungan sama sekali (mis. admin mengisi
                      Tipe Produk atau BAST bertahun-tahun sesudah proyek
                      selesai). Baris ini dulu memakainya, dan akibatnya sebuah
                      proyek yang sungguh selesai bulan Juni bisa tiba-tiba
                      tampil "Ditandai selesai — 2 menit lalu" hanya karena ada
                      kolom lain yang baru saja disunting - riwayat yang sudah
                      lama terlihat seolah baru saja terjadi.

                      due_date/bast_date dipakai sebagai gantinya - keduanya
                      TIDAK berubah akibat suntingan field lain, jadi lebih
                      dekat ke kapan pekerjaan ini sungguh terjadi. bast_date
                      diutamakan untuk "selesai" karena itu memang tanggal
                      serah-terima; due_date dipakai untuk "dikerjakan" karena
                      penugasan biasanya melekat pada jadwalnya.
                    */
                    turunan={[
                      ...(detailReminder.assign_name?.trim()
                        ? [{ aksi: 'assign', oleh: detailReminder.assign_name,
                             waktu: detailReminder.due_date ?? detailReminder.created_at ?? null,
                             keterangan: `Dikerjakan ${detailReminder.assign_name} — dari data jadwal` }]
                        : []),
                      ...(detailReminder.status === 'done'
                        ? [{ aksi: 'status_change', oleh: detailReminder.assign_name || null,
                             waktu: detailReminder.bast_date ?? detailReminder.due_date ?? null,
                             keterangan: 'Ditandai selesai — dari data jadwal' }]
                        : []),
                    ]} />

                {/* Alur request Sales — hanya untuk yang memang lewat routing.
                      Reminder yang dibuat langsung admin tidak punya tahapan ini,
                      jadi diagramnya tidak ditampilkan supaya tidak mengarang
                      tahap yang tak pernah terjadi. */}
                  {(() => {
                    const r = detailReminder as { routing_status?: string | null; assigned_to?: string | null; assign_name?: string | null; status?: string };
                    const sudahAssign = !!((r.assigned_to && r.assigned_to.trim() !== '') || (r.assign_name && r.assign_name.trim() !== ''));
                    const selesai     = r.status === 'done';
                    const batal       = r.status === 'cancelled';
                    //  0 diajukan · 1 Sales Internal · 2 Admin assign · 3 dikerjakan · 4 selesai
                    //  5 = seluruh tahap tuntas (indeks di luar daftar)
                    const aktif = selesai      ? 5
                      : sudahAssign            ? 3
                      : r.routing_status === 'internal_review' ? 1
                      : 2;
                    return (
                      <FlowSteps
                        judul="Alur Request"
                        aktif={aktif}
                        dibatalkan={batal}
                        steps={[
                          { label: 'Diajukan',  pelaku: detailReminder.sales_name || 'Sales' },
                          // Sebut NAMA Sales Internal-nya, bukan label generik: siapa yang
                          // meneruskan adalah bagian dari jejak yang dicari pembaca alur.
                          // Dua sumber, sesuai bagaimana request itu masuk:
                          //   1. reviewer hasil mapping brand IVP/MVI (internal_sales_id,
                          //      + _id_2 saat brand BOTH  dua reviewer wajib approve)
                          //   2. kalau request DIBUAT oleh Sales Internal sendiri, dialah
                          //      yang meneruskan - tahap ini memang langsung terlewati
                          //      (routing_status ke admin_review), jadi namanya diambil
                          //      dari created_by.
                          { label: 'Diteruskan', pelaku: (() => {
                            const namaDari = (id?: string | null) => id ? guestUsers.find(g => g.id === id)?.full_name : undefined;
                            const r1 = namaDari(detailReminder.internal_sales_id);
                            const r2 = namaDari(detailReminder.internal_sales_id_2);
                            if (r1 && r2) return `${r1} & ${r2}`;
                            if (r1) return r1;
                            const pembuat = guestUsers.find(g => g.username === detailReminder.created_by);
                            if (pembuat?.is_internal_sales) return pembuat.full_name;
                            return 'Sales Internal';
                          })() },
                          { label: 'Di-assign', pelaku: 'Admin' },
                          { label: 'Dikerjakan', pelaku: detailReminder.assign_name || 'Team PTS' },
                          { label: 'Selesai',   pelaku: 'BAST' },
                        ]}
                      />
                    );
                  })()}
                </div>
              </div>
            )}

            {showModeModal && (
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex-shrink-0 overflow-hidden flex flex-col"
                style={{ animation: 'scale-in 0.2s ease-out', border: '1px solid rgba(0,0,0,0.1)', height: '100%' }}>
                <div className="px-5 py-4 flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                  <h3 className="text-white font-bold text-base">📍 Mode Penyelesaian</h3>
                  <p className="text-emerald-100 text-[11px] mt-0.5">Lengkapi data sebelum status jadi Completed</p>
                  <button aria-label="Tutup" onClick={() => { setShowModeModal(false); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); setPendingPhotoUrl(undefined); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-3">Pilih mode pelaksanaan: <span className="text-red-500">*</span></p>
                    <div className="grid grid-cols-2 gap-3">
                      {(['onsite', 'remote'] as const).map(m => (
                        <button key={m} onClick={() => setModePenyelesaian(m)}
                          className={`py-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${modePenyelesaian === m ? (m === 'onsite' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                          <span className="text-2xl">{m === 'onsite' ? '🏠' : '📡'}</span>
                          {m === 'onsite' ? 'ONSITE' : 'REMOTE'}
                          <span className="text-[10px] font-normal opacity-70">{m === 'onsite' ? 'Tim hadir langsung' : 'Tim dari jarak jauh'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-2">📅 Tanggal BAST <span className="text-red-500">*</span></label>
                    <input type="date" value={bastDate} onChange={e => setBastDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                    {bastDate && (
                      <p className="text-[10px] text-gray-400 mt-1">Tranche T1 bayar {new Date(bastDate).getFullYear()+1} · T2 bayar {new Date(bastDate).getFullYear()+2} · T3 bayar {new Date(bastDate).getFullYear()+3}</p>
                    )}
                  </div>

                  {/* 1. Display Type — wajib pilih LED / LCD / Mix */}
                  <div>
                    <p className="text-xs font-bold text-gray-600 mb-2">🖥️ Tipe Display <span className="text-red-500">*</span> <span className="font-normal text-gray-400">(Mix = LED + LCD)</span></p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'led', label: 'LED' },
                        { value: 'lcd', label: 'LCD' },
                        { value: 'mix', label: 'Mix' },
                      ] as { value: 'led' | 'lcd' | 'mix'; label: string }[]).map(opt => (
                        <button key={opt.value} type="button" onClick={() => setDisplayType(opt.value)}
                          className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${displayType === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Controller Automation — Yes/No + brand */}
                  <div>
                    <p className="text-xs font-bold text-gray-600 mb-2">🎛️ Controller Automation <span className="text-red-500">*</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {([{ v: false, l: 'Tidak' }, { v: true, l: 'Ya' }] as { v: boolean; l: string }[]).map(opt => (
                        <button key={opt.l} type="button"
                          onClick={() => { setRequiresControllerAuto(opt.v); if (!opt.v) setControllerBrand(null); }}
                          className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${requiresControllerAuto === opt.v ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    {requiresControllerAuto && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {([
                          { value: 'cue', label: 'Cue' },
                          { value: 'extron', label: 'Extron' },
                          { value: 'wyrestorm', label: 'Wyrestorm' },
                        ] as { value: 'cue' | 'extron' | 'wyrestorm'; label: string }[]).map(b => (
                          <button key={b.value} type="button" onClick={() => setControllerBrand(b.value)}
                            className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${controllerBrand === b.value ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                            {b.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Middleware — Yes/No */}
                  <div>
                    <p className="text-xs font-bold text-gray-600 mb-2">🔌 Middleware / System / Matrix <span className="text-red-500">*</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {([{ v: false, l: 'Tidak' }, { v: true, l: 'Ya' }] as { v: boolean; l: string }[]).map(opt => (
                        <button key={opt.l} type="button" onClick={() => setRequiresMiddleware(opt.v)}
                          className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${requiresMiddleware === opt.v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {modePenyelesaian === 'remote' && (
                    <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1.5px solid rgba(59,130,246,0.25)' }}>
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">🔧 Data Installer Daerah</p>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Installer <span className="text-red-500">*</span></label>
                        <input value={installerName} onChange={e => setInstallerName(e.target.value)}
                          placeholder="Nama installer / mitra daerah"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Daerah / Kota <span className="text-red-500">*</span></label>
                        <input value={installerDaerah} onChange={e => setInstallerDaerah(e.target.value)}
                          placeholder="Contoh: Surabaya, Bandung, Medan..."
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setShowModeModal(false); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); setPendingPhotoUrl(undefined); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
                      Batal
                    </button>
                    <button onClick={handleModeConfirm} disabled={savingMode || !modePenyelesaian}
                      className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                      style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                      {savingMode ? 'Menyimpan...' : '✅ Konfirmasi & Selesaikan'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
          </ModalPortal>
        )}

        {/* ── HEADER ── */}
        <PageHeader icon="🗓️" title="Request Schedule" color="#0891b2" colorLight="#0e7490">
          <button onClick={() => setShowBellPopup(true)}
            className="relative p-2 rounded-xl transition-all hover:bg-cyan-50 border-2 border-transparent hover:border-cyan-200">
            <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {myActiveReminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: '#f59e0b' }}>
                {myActiveReminders.length}
              </span>
            )}
          </button>

          {canAddReminder && view === 'list' && (
            <button onClick={mulaiBuatReminder}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', boxShadow: '0 4px 14px rgba(8,145,178,0.4)' }}>
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Tambah Reminder
            </button>
          )}

          {/* ── Tombol Request Jadwal — hanya untuk role Guest/Sales ── */}
          {isGuest && view === 'list' && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => { if (pendingReviewCount === 0) mulaiRequestJadwal(); }}
                disabled={pendingReviewCount > 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={pendingReviewCount > 0
                  ? { background: 'linear-gradient(135deg,#9ca3af,#6b7280)', boxShadow: 'none', cursor: 'not-allowed', opacity: 0.7 }
                  : { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 14px rgba(37,99,235,0.4)', cursor: 'pointer' }
                }
                title={pendingReviewCount > 0 ? `Ada ${pendingReviewCount} form review belum dinilai` : ''}
              >
                {pendingReviewCount > 0
                  ? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  : <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                }
                📩 Request Jadwal
              </button>
              {pendingReviewCount > 0 && (
                <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                  ⚠️ Selesaikan {pendingReviewCount} form review dulu
                </span>
              )}
            </div>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-2.5 py-3 space-y-3 sm:px-5 sm:py-5 sm:space-y-4">
          {view === 'list' && (
            <>
              {/* ── Stat cards (clickable filter) ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Jadwal', value: totalCount, sub: 'Semua reminder', accent: '#4f46e5',
                    onClick: () => { setFilterStatus('all'); setSelectedCalDay(null); },
                    active: filterStatus === 'all' && !selectedCalDay },
                  { label: 'Pending', value: pendingCount, sub: 'Menunggu tindakan', accent: '#b45309',
                    onClick: () => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending'),
                    active: filterStatus === 'pending' },
                  { label: 'Selesai', value: doneCount, sub: 'Terselesaikan', accent: '#047857',
                    onClick: () => setFilterStatus(filterStatus === 'done' ? 'all' : 'done'),
                    active: filterStatus === 'done' },
                  { label: 'Hari Ini', value: todayCount, sub: 'Jadwal hari ini', accent: '#0e7490',
                    onClick: () => setSelectedCalDay(selectedCalDay === new Date().toISOString().split('T')[0] ? null : new Date().toISOString().split('T')[0]),
                    active: selectedCalDay === new Date().toISOString().split('T')[0] },
                ].map((card, i) => <StatCard key={i} {...card} />)}
              </div>

              {/* ── Pie Charts — klick untuk filter ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <MiniPieChart
                  data={projectPieData} title="Kegiatan / Kategori" icon="🖥️"
                  activeFilter={filterCategory !== 'all' ? filterCategory : null}
                  onSliceClick={label => setFilterCategory(filterCategory === label ? 'all' : label)}
                />
                <MiniPieChart
                  data={salesPieData} title="Divisi Sales" icon="👤"
                  activeFilter={searchDivisionSales || null}
                  onSliceClick={label => setSearchDivisionSales(searchDivisionSales === label ? '' : label)}
                />
                <MiniPieChart
                  data={teamPtsPieData} title="Team PTS IVP" icon="👥"
                  activeFilter={searchTeamHandler || null}
                  onSliceClick={label => setSearchTeamHandler(searchTeamHandler === label ? '' : label)}
                />
                <MiniPieChart
                  data={productPieData} title="Product / Unit" icon="📦"
                  activeFilter={productFilter}
                  onSliceClick={label => setProductFilter(productFilter === label ? null : label)}
                />
              </div>

              {/* Active filter chips */}
              {/* Main area: list + calendar (di HP stack; kalender hanya di desktop) */}
              <div className="flex flex-col lg:flex-row gap-4 items-start">

                {/* ── TICKET LIST ── */}
                <div className="flex-1 min-w-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>

                  {/* ── TICKET LIST header + refresh/export ── */}
                  <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Schedule List</span>
                      <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{filteredReminders.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isAdmin || isManager) && (
                        <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {selectMode ? '✕ Batal' : '☑ Select'}
                        </button>
                      )}
                      <button onClick={fetchReminders} disabled={listLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60 bg-white">
                        <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                      </button>
                      <button onClick={handleExportExcel} disabled={filteredReminders.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105 disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', boxShadow: '0 2px 8px rgba(8,145,178,0.3)' }}>
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Export Excel
                      </button>
                    </div>
                  </div>

                  {/* ── Search / Filter bar — tepat di bawah TICKET LIST ── */}
                  <div className="px-5 py-3 border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Project / Location</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🔍</span>
                          <input aria-label="Search project / lokasi..." value={searchProject} onChange={e => setSearchProject(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                            placeholder="Search project / lokasi..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Sales Name</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👤</span>
                          <input aria-label="Search sales..." value={searchSales} onChange={e => setSearchSales(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                            placeholder="Search sales..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">📦 Product</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">📦</span>
                          <input aria-label="Cari product..." value={searchProduct} onChange={e => { setSearchProduct(e.target.value); setProductFilter(null); }}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                            placeholder="Cari product..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Handler</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👷</span>
                          <input aria-label="Search handler..." value={searchTeamHandler} onChange={e => setSearchTeamHandler(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-purple-300 transition-all"
                            placeholder="Search handler..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🏷️</span>
                          <select aria-label="All Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer transition-all">
                            <option value="all">All Status</option>
                            {(Object.keys(STATUS_CONFIG) as Status[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                          </select>
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Year</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">📅</span>
                          <select aria-label="All Years" value={filterYear} onChange={e => setFilterYear(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer transition-all">
                            <option value="all">All Years</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bulk delete bar — admin only, selectMode only */}
                  {selectMode && (isAdmin || isManager) && selectedIds.size > 0 && (
                    <div className="px-5 py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(220,38,38,0.07)' }}>
                      <span className="text-sm font-bold text-red-700">{selectedIds.size} jadwal dipilih</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
                        <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
                          className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
                          style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                          {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Filter Aktif chips — di bawah filter bar ── */}
                  {(filterCategory !== 'all' || filterStatus !== 'all' || searchSales || searchDivisionSales || searchTeamHandler || searchProject || selectedCalDay || productFilter || searchProduct) && (
                    <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
                      {filterCategory !== 'all' && <button onClick={() => setFilterCategory('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>🏷️ {filterCategory} ✕</button>}
                      {filterStatus !== 'all' && <button onClick={() => setFilterStatus('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#d97706' }}>Status: {STATUS_CONFIG[filterStatus as Status]?.label} ✕</button>}
                      {searchSales && <button onClick={() => setSearchSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>👤 {searchSales} ✕</button>}
                      {searchDivisionSales && <button onClick={() => setSearchDivisionSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#ec4899' }}>Division: {searchDivisionSales} ✕</button>}
                      {searchTeamHandler && <button onClick={() => setSearchTeamHandler('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>👷 {searchTeamHandler} ✕</button>}
                      {searchProject && <button onClick={() => setSearchProject('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>🔍 {searchProject} ✕</button>}
                      {productFilter && <button onClick={() => { setProductFilter(null); setSearchProduct(''); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#6366f1' }}>📦 {productFilter} ✕</button>}
                      {selectedCalDay && <button onClick={() => setSelectedCalDay(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0891b2' }}>📅 {formatDate(selectedCalDay)} ✕</button>}
                      <button onClick={() => { setFilterCategory('all'); setFilterStatus('all'); setSearchSales(''); setSearchDivisionSales(''); setSearchTeamHandler(''); setSearchProject(''); setSelectedCalDay(null); setProductFilter(null); setSearchProduct(''); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>🗑️ Reset Semua</button>
                    </div>
                  )}

                  {/* ── TABLE ── */}
                  {fetchError ? (
                    <ErrorState message={fetchError} onRetry={() => { setFetchError(null); fetchReminders(); }} />
                  ) : listLoading ? (
                    <div className="space-y-2 p-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-3 border border-gray-200">
                          <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-2/5"></div><div className="h-2 bg-gray-100 rounded w-1/4"></div></div>
                          <div className="h-3 bg-gray-200 rounded w-1/6"></div><div className="h-3 bg-gray-200 rounded w-1/5"></div>
                          <div className="h-5 bg-gray-200 rounded-full w-16"></div><div className="h-6 bg-gray-200 rounded-lg w-14"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredReminders.length === 0 ? (
                    <ListEmptyState
                      adaFilterAktif={
                        filterStatus !== 'all' || filterYear !== 'all' || filterCategory !== 'all'
                        || productFilter !== null
                        || [searchProject, searchSales, searchDivisionSales, searchTeamHandler, searchProduct]
                             .some(v => v.trim() !== '')
                      }
                      onReset={() => {
                        setFilterStatus('all'); setFilterYear('all'); setFilterCategory('all');
                        setProductFilter(null);
                        setSearchProject(''); setSearchSales(''); setSearchDivisionSales('');
                        setSearchTeamHandler(''); setSearchProduct('');
                      }}
                      icon="🗓️"
                      judulKosong="Belum ada reminder"
                      deskripsiKosong="Jadwal yang dibuat atau di-request akan muncul di sini."
                    />
                  ) : (
                    <>
                    {/* ── MOBILE: Card view ── */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {groupedReminders.map((group, idx) => {
                        const r = group[0];
                        const today = isDueToday(r.due_date);
                        const dueDate = new Date(r.due_date + 'T00:00:00');
                        const uniqueDates = Array.from(new Set(group.map(gr => gr.due_date))).sort();
                        const uniqueAssignNames = Array.from(new Set(group.map(gr => gr.assign_name).filter(Boolean)));
                        const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                        return (
                          <div key={r.id}
                            className={`px-4 py-3.5 ${today ? 'bg-red-50/50 border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-gray-800 leading-tight truncate">{(r.project_name || r.title || '').trim() || '—'}</p>
                                {r.address && <p className="text-[10px] text-gray-400 mt-0.5 truncate">📍 {r.address.split(',')[0]}</p>}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] font-semibold text-indigo-600">{(CATEGORY_CONFIG[r.category] ?? { icon: '📁' }).icon} {r.category}</span>
                                  {/* Tanpa lencana ini, tombol sync hijau muncul tanpa
                                      keterangan apa pun dan orang harus menebak apa
                                      bedanya baris ini dari yang lain. */}
                                  {r.incentive_excluded === true && (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                                      title="Sengaja dikeluarkan dari perhitungan Incentive PTS. Jadwalnya tetap tercatat di sini.">
                                      ⛔ di luar Incentive
                                    </span>
                                  )}
                                  {r.product && <span className="text-[10px] text-indigo-500 font-medium">{r.product}</span>}
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                {uniqueDates.length > 1 ? (
                                  <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center" title={uniqueDates.map(fmtShort).join(', ')}
                                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <span className="text-sm font-black leading-none" style={{ color: '#4f46e5' }}>🗓️ {uniqueDates.length}h</span>
                                    <span className="text-[8px] font-bold uppercase" style={{ color: '#6366f1' }}>{fmtShort(uniqueDates[0])}–{fmtShort(uniqueDates[uniqueDates.length - 1])}</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center"
                                    style={{ background: today ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.08)', border: today ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(99,102,241,0.2)' }}>
                                    <span className="text-base font-black leading-none" style={{ color: today ? '#dc2626' : '#4f46e5' }}>{dueDate.getDate()}</span>
                                    <span className="text-[8px] font-bold uppercase" style={{ color: today ? '#dc2626' : '#6366f1' }}>{dueDate.toLocaleDateString('id-ID',{month:'short',year:'2-digit'})}</span>
                                  </div>
                                )}
                                {(() => {
                                  const counts: Record<string,number> = {};
                                  for (const gr of group) counts[gr.status] = (counts[gr.status]||0)+1;
                                  const entries = Object.entries(counts);
                                  if (entries.length === 1) return <StatusBadge status={group[0].status} />;
                                  return <div className="flex flex-wrap gap-0.5">{entries.map(([s,n]) => <span key={s} className="flex items-center gap-0.5"><StatusBadge status={s as any} /><span className="text-[8px] text-gray-500">{n}×</span></span>)}</div>;
                                })()}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                              {r.sales_name && <div className="truncate"><span className="text-gray-400">Sales: </span><span className="text-gray-700 font-medium">{r.sales_name}</span></div>}
                              <div className="flex flex-wrap gap-0.5">
                                {uniqueAssignNames.slice(0, 4).map(name => (
                                  <span key={name} title={name}
                                    className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                                    {name?.charAt(0)?.toUpperCase() || '?'}
                                  </span>
                                ))}
                                {uniqueAssignNames.length > 4 && (
                                  <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[7px] font-bold bg-gray-100 text-gray-600 flex-shrink-0">+{uniqueAssignNames.length - 4}</span>
                                )}
                                {uniqueAssignNames.length === 1 && <span className="text-[10px] text-gray-700 font-medium ml-0.5">{uniqueAssignNames[0]}</span>}
                                {uniqueAssignNames.length > 1 && <span className="text-[9px] text-gray-400 ml-0.5">({uniqueAssignNames.length} orang)</span>}
                              </div>
                              {r.notes && !r.notes.includes('[REQUEST SALES]') && <div className="col-span-2 truncate text-gray-400">{r.notes.substring(0,60)}{r.notes.length>60?'…':''}</div>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-3">
                              <ViewIconBtn onClick={() => setDetailReminder(r)} title="Detail" />
                              {(isAdmin || currentUser?.role === 'team') && r.status !== 'done' && (
                                <RescheduleIconBtn onClick={() => setRescheduleTarget(r)} title="Re-Schedule" />
                              )}
                              {canInternalApprove(r) && (
                                <>
                                  <ApproveIconBtn onClick={() => setInternalApproveTarget(r)} title="Approve & Teruskan ke Admin" pulse />
                                  <button aria-label="Tolak" onClick={() => handleInternalReject(r)} title="Tolak"
                                    className="w-7 h-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                                    <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </>
                              )}
                              {canApproveAssign && !r.assigned_to && r.notes?.includes('[REQUEST SALES]') && r.routing_status !== 'internal_review' && (
                                <ApproveIconBtn onClick={() => { setApproveTarget(r); setApproveBatchSiblings(group.filter(gr => gr.id !== r.id && gr.batch_id === r.batch_id && !gr.assigned_to)); setApproveAssignTo(''); setApproveDate(r.due_date); setApproveTime(r.due_time); }} title="Approve & Assign" pulse />
                              )}
                              {currentUser?.id === r.assigned_supervisor_id && r.routing_status === 'supervisor_assign' && (
                                <ApproveIconBtn onClick={() => openSupervisorAssign(r, group)} title="Assign Tim" pulse />
                              )}
                              {(isAdmin || isManager) && layakIncentive(r) && (
                                <button aria-label={`Sync ${r.project_name} ke Incentive PTS`}
                                  onClick={() => syncKeIncentive(r)} disabled={syncing === r.id}
                                  title={diluarIncentive(r)
                                    ? 'Sedang DI LUAR Incentive PTS — klik untuk memasukkannya kembali'
                                    : 'Sudah masuk Incentive PTS — klik untuk memastikan ulang'}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 border ${
                                    diluarIncentive(r)
                                      ? 'bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white border-amber-300'
                                      : 'bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border-emerald-200'}`}>
                                  {syncing === r.id
                                    ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                                    : <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                </button>
                              )}
                              {(isAdmin || isManager) && (
                                <DeleteIconBtn onClick={() => openDeleteModal(r)} title="Hapus" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white/90">
                        <span className="text-xs text-gray-400">{groupedReminders.length} event · {filteredReminders.length} jadwal</span>
                      </div>
                    </div>

                    {/* ── DESKTOP: Table view ── */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse" style={{ tableLayout: 'fixed', background: 'transparent' }}>
                        {/* Sembilan kolom, dijumlahkan TEPAT 100%.
                            Sebelumnya ada 10 <col> untuk 9 kolom (sisa kolom
                            Garansi yang dibuang) dan totalnya hanya 75% —
                            browser membagikan sisa 25% sesuka hati, sehingga
                            Action melebar berisi ruang kosong sementara Handler
                            terpotong. */}
                        <colgroup>
                          <col style={{ width: '4%'  }} />{/* No / pilih   */}
                          <col style={{ width: '18%' }} />{/* Project      */}
                          <col style={{ width: '14%' }} />{/* Product      */}
                          <col style={{ width: '12%' }} />{/* Kegiatan     */}
                          <col style={{ width: '13%' }} />{/* Sales        */}
                          <col style={{ width: '15%' }} />{/* Handler — nama lengkap sering panjang */}
                          <col style={{ width: '9%'  }} />{/* Status       */}
                          <col style={{ width: '8%'  }} />{/* Tanggal      */}
                          <col style={{ width: '7%'  }} />{/* Action       */}
                        </colgroup>
                        <thead>
                          <tr className="border-b-2 border-gray-100" style={{ background: "rgba(255,255,255,0.97)" }}>
                            <th className="px-3 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                      {selectMode && (isAdmin || isManager)
                        ? <input type="checkbox"
                            checked={selectedIds.size === filteredReminders.length && filteredReminders.length > 0}
                            onChange={toggleSelectAll} className="w-4 h-4 rounded accent-red-600 cursor-pointer" title="Pilih Semua" />
                        : 'No'}
                    </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Project</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Product</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Kegiatan</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Sales</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Handler</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Status</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Tanggal</th>
                            <th className="px-1 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedReminders.map((group, idx) => {
                            const r = group[0];
                            const today = isDueToday(r.due_date);
                            const uniqueDates = Array.from(new Set(group.map(gr => gr.due_date))).sort();
                            const uniqueAssignNames = Array.from(new Set(group.map(gr => gr.assign_name).filter(Boolean)));
                            const fmtShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                            return (
                              <tr key={r.id}
                                className={`border-b border-gray-200 hover:bg-red-50/30 transition-colors cursor-pointer ${today ? 'bg-red-50/15 border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'}`}
                                >
                                {/* No */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle text-center" onClick={e => e.stopPropagation()}>
                            {selectMode && (isAdmin || isManager)
                              ? <input type="checkbox"
                                  checked={group.every(gr => selectedIds.has(gr.id))}
                                  onChange={() => {
                                    const allSelected = group.every(gr => selectedIds.has(gr.id));
                                    setSelectedIds(prev => {
                                      const next = new Set(prev);
                                      for (const gr of group) allSelected ? next.delete(gr.id) : next.add(gr.id);
                                      return next;
                                    });
                                  }}
                                  className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                              : <span className="text-[11px] font-bold text-gray-500">{idx + 1}</span>}
                          </td>
                                {/* Project */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <div className="font-bold text-gray-800 text-xs leading-tight break-words">{(r.project_name || '').trim() || (r.title || '').trim() || '—'}</div>
                                  {r.address && <div className="text-[10px] text-gray-400 truncate mt-0.5">📍 {r.address.split(',')[0]}</div>}
                                  <div className="text-[10px] text-gray-400 mt-0.5">{formatDatetime(r.created_at).split(',')[0]}</div>
                                </td>
                                {/* Product */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  {r.product ? (
                                    <button
                                      onClick={e => { e.stopPropagation(); setProductFilter(productFilter === r.product ? null : (r.product ?? null)); }}
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-left break-words leading-tight transition-all"
                                      style={{ background: productFilter === r.product ? '#6366f1' : '#eef2ff', color: productFilter === r.product ? 'white' : '#4338ca' }}>
                                      {r.product}
                                    </button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                  {/* Tipe Produk (LED / LCD·Middleware / LED & LCD) — dipilih Sales saat
                                      request, dipakai utk routing tim tapi sebelumnya tidak pernah
                                      ditampilkan di mana pun (list maupun detail). */}
                                  {r.product_type && (
                                    <div className="mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded inline-block"
                                      style={{ background: '#fef3c7', color: '#92400e' }}>
                                      🏷️ {r.product_type}
                                    </div>
                                  )}
                                </td>
                                {/* Kegiatan */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm">{(CATEGORY_CONFIG[r.category] ?? { icon: '📁' }).icon}</span>
                                    <span className="text-[10px] font-semibold text-gray-700 leading-tight break-words">{r.category}</span>
                                    {r.sales_name && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(r.category) && (
                                    <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-1"
                                      >
                                      ⭐ {/*r.sales_name*/}
                                    </div>
                                  )}
                                  </div>
                                  {/* Mode pelaksanaan (Onsite/Remote) — cuma diisi utk kategori
                                      Konfigurasi/Konfigurasi & Training/Training saat status
                                      di-update ke Completed. Di list HANYA nilai Onsite/Remote-nya
                                      saja yg tampil; detail lengkapnya (BAST, tipe display,
                                      controller automation, middleware) ada di halaman Detail. */}
                                  {(INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(r.category) && r.mode_penyelesaian && (
                                    <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded"
                                      style={r.mode_penyelesaian === 'onsite'
                                        ? { background: '#d1fae5', color: '#047857' }
                                        : { background: '#dbeafe', color: '#1d4ed8' }}>
                                      {r.mode_penyelesaian === 'onsite' ? '🏠 ONSITE' : '📡 REMOTE'}
                                    </div>
                                  )}
                                  {r.category === 'Troubleshooting' && (
                                    <button
                                      onClick={e => { e.stopPropagation(); router.push('/ticketing'); }}
                                      className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-blue-600 hover:text-blue-800 transition-colors"
                                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                      🎫 Ticketing
                                    </button>
                                  )}
                                </td>
                                {/* Sales */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <div className="text-xs font-semibold text-gray-700 leading-tight truncate">{r.sales_name || '—'}</div>
                                  {r.sales_division && <div className="text-[10px] text-purple-600 font-semibold truncate mt-0.5">{r.sales_division}</div>}
                                </td>
                                {/* Handler */}
                                {/* Lebar sengaja TIDAK dipatok di sini — biar
                                    mengikuti <colgroup>. Patokan 110px yang lama
                                    menimpa lebar kolom, sehingga nama handler
                                    selalu terpotong berapa pun lebar tabelnya. */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle overflow-hidden">
                                  <div className="flex flex-nowrap gap-0.5">
                                    {uniqueAssignNames.slice(0, 3).map(name => (
                                      <div key={name} title={name}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                        style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                                        {name?.charAt(0)?.toUpperCase() || '?'}
                                      </div>
                                    ))}
                                    {uniqueAssignNames.length > 3 && (
                                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold bg-gray-100 text-gray-600 flex-shrink-0">+{uniqueAssignNames.length - 3}</div>
                                    )}
                                  </div>
                                  {uniqueAssignNames.length === 1
                                    ? <span className="text-[10px] font-bold text-gray-800 block mt-0.5 truncate">{uniqueAssignNames[0]}</span>
                                    : <span className="text-[9px] text-gray-400 mt-0.5 block">{uniqueAssignNames.length} orang</span>
                                  }
                                </td>
                                {/* Status */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  {(() => {
                                    const counts: Record<string,number> = {};
                                    for (const gr of group) counts[gr.status] = (counts[gr.status]||0)+1;
                                    const entries = Object.entries(counts);
                                    if (entries.length === 1) {
                                      return <>
                                        <StatusBadge status={group[0].status} />
                                        {group[0].wa_sent_h1 && <p className="text-[9px] font-bold text-green-600 mt-0.5">✅ WA H-1</p>}
                                      </>;
                                    }
                                    return (
                                      <div className="space-y-0.5">
                                        {entries.map(([s,n]) => (
                                          <div key={s} className="flex items-center gap-1">
                                            <StatusBadge status={s as any} />
                                            <span className="text-[9px] text-gray-500 font-bold">{n}×</span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                  {!group[0].assigned_to && group[0].notes?.includes('[REQUEST SALES]') && (
                                    group[0].routing_status === 'internal_review'
                                      ? <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: '#f59e0b' }} title="Menunggu review Sales Internal sebelum Admin bisa proses">
                                          🔍 Review: {guestUsers.find(g => g.id === group[0].internal_sales_id)?.full_name ?? '—'}
                                        </span>
                                      : <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: '#2563eb' }}
                                          title={group[0].created_by ? `Diinput oleh: ${group[0].created_by}${group[0].sales_name ? ` — atas nama Sales: ${group[0].sales_name}` : ''}` : undefined}>
                                          📩 Req. Sales
                                        </span>
                                  )}
                                </td>
                                {/* Tanggal */}
                                <td className="px-2 py-1 border-r border-gray-200 align-middle">
                                  {uniqueDates.length > 1 ? (
                                    <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center" title={uniqueDates.map(fmtShort).join(', ')}
                                      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                      <span className="text-sm font-black leading-none" style={{ color: '#4f46e5' }}>🗓️ {uniqueDates.length}h</span>
                                      <span className="text-[8px] font-bold uppercase leading-tight" style={{ color: '#6366f1' }}>
                                        {fmtShort(uniqueDates[0])}–{fmtShort(uniqueDates[uniqueDates.length - 1])}
                                      </span>
                                      {r.due_time && <span className="text-[8px] text-gray-400 leading-tight">{r.due_time}</span>}
                                    </div>
                                  ) : (
                                    <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center"
                                      style={{
                                        background: today ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.08)',
                                        border: today ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(99,102,241,0.2)',
                                      }}>
                                      <span className="text-base font-black leading-none" style={{ color: today ? '#dc2626' : '#4f46e5' }}>
                                        {new Date(r.due_date + 'T00:00:00').getDate()}
                                      </span>
                                      <span className="text-[8px] font-bold uppercase leading-tight" style={{ color: today ? '#dc2626' : '#6366f1' }}>
                                        {new Date(r.due_date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
                                      </span>
                                      {r.due_time && <span className="text-[8px] text-gray-400 leading-tight">{r.due_time}</span>}
                                    </div>
                                  )}
                                </td>
                                {/* ACT */}
                                <td className="px-3 py-1 align-middle text-center" onClick={e => e.stopPropagation()}>
                                  <ActionGroup>
                                    {/* Detail */}
                                    <ViewIconBtn onClick={() => setDetailReminder(group[0])} title="Detail" />
                                    {/* Re-Schedule — semua team PTS & admin bisa lihat */}
                                    {(isAdmin || currentUser?.role === 'team') && group[0].status !== 'done' && (
                                      <RescheduleIconBtn onClick={() => setRescheduleTarget(group[0])} title="Re-Schedule" />
                                    )}
                                    {/* Approve & Teruskan — Sales Internal yg di-mapping, wajib duluan sebelum Admin */}
                                    {canInternalApprove(group[0]) && (
                                      <>
                                        <ApproveIconBtn onClick={() => setInternalApproveTarget(group[0])} title="Approve & Teruskan ke Admin" pulse />
                                        <button aria-label="Tolak" onClick={() => handleInternalReject(group[0])} title="Tolak"
                                          className="w-7 h-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 rounded-lg flex items-center justify-center transition-all">
                                          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </>
                                    )}
                                    {/* Approve & Assign — admin only, hanya utk request sales yg belum di-assign & sudah lolos review internal */}
                                    {canApproveAssign && !group[0].assigned_to && group[0].notes?.includes('[REQUEST SALES]') && group[0].routing_status !== 'internal_review' && (
                                      <ApproveIconBtn onClick={() => { setApproveTarget(group[0]); setApproveBatchSiblings(group.filter(gr => gr.id !== group[0].id && gr.batch_id === group[0].batch_id && !gr.assigned_to)); setApproveAssignTo(''); setApproveDate(group[0].due_date); setApproveTime(group[0].due_time); }} title="Approve & Assign" pulse />
                                    )}
                                    {/* Assign Tim — Supervisor yg di-route, wajib assign anggota/diri sendiri */}
                                    {currentUser?.id === group[0].assigned_supervisor_id && group[0].routing_status === 'supervisor_assign' && (
                                      <ApproveIconBtn onClick={() => openSupervisorAssign(group[0], group)} title="Assign Tim" pulse />
                                    )}
                                    {(isAdmin || isManager) && layakIncentive(group[0]) && (
                                      <button aria-label={`Sync ${group[0].project_name} ke Incentive PTS`}
                                        onClick={() => syncKeIncentive(group[0])} disabled={syncing === group[0].id}
                                        title={diluarIncentive(group[0])
                                          ? 'Sedang DI LUAR Incentive PTS — klik untuk memasukkannya kembali'
                                          : 'Sudah masuk Incentive PTS — klik untuk memastikan ulang'}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 border ${
                                          diluarIncentive(group[0])
                                            ? 'bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white border-amber-300'
                                            : 'bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border-emerald-200'}`}>
                                        {syncing === group[0].id
                                          ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                                          : <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                      </button>
                                    )}
                                    {/* Hapus — admin only */}
                                    {(isAdmin || isManager) && (
                                      <DeleteIconBtn onClick={() => openDeleteModal(group[0])} title="Hapus" />
                                    )}
                                  </ActionGroup>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200" style={{ background: 'rgba(255,255,255,0.97)' }}>
                        <span className="text-[10px] text-gray-400">{groupedReminders.length} event ({filteredReminders.length} jadwal)</span>
                        <span className="text-[10px] text-gray-400">{filteredReminders.length > 0 ? `1–${filteredReminders.length}` : '0'} of {reminders.length}</span>
                      </div>
                    </div>{/* end hidden md:block */}
                    </>
                  )}
                </div>

                {/* ── MINI CALENDAR SIDEBAR — admin & team saja, disembunyikan utk guest/sales.
                     Di HP juga DISEMBUNYIKAN (hidden lg:block) — sebelumnya kalender
                     mendominasi layar & daftar terhimpit hilang. Hanya muncul di desktop. ── */}
                {!isGuest && (
                  <div className="hidden lg:block flex-shrink-0">
                    <MiniCalendar
                      reminders={reminders}
                      calendarMonth={calendarMonth}
                      setCalendarMonth={setCalendarMonth}
                      selectedCalDay={calOnlyDay}
                      setSelectedCalDay={setCalOnlyDay}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ─── FORM VIEW ── (digantikan oleh showFormModal popup) */}

        </div>

      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform: none; }
        }
        @keyframes scale-in {
          from { opacity:0; transform:scale(0.92); }
          to   { opacity:1; transform: none; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        select option { background: #ffffff; color: #1e293b; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.3); cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(220,38,38,0.25); border-radius: 4px; }
      `}</style>

    </div>
  );
}

export default function ReminderSchedulePage() {
  return (
    <Suspense>
      <ReminderSchedulePageInner />
    </Suspense>
  );
}
