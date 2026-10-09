'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isPimpinan, muatIdPimpinan } from '@/lib/pimpinan';
import { hitungReviewMenggantung } from '@/lib/form-review-gate';
import { setSession, clearSession, getSession, startSessionWatcher } from '@/lib/auth';
import { isAdmin as checkIsAdmin, hasFullAccess } from '@/lib/constants';
import { isAssignablePTSTeam, bolehDitugaskanOleh } from '@/lib/teams';
import { namaKelompokCabang } from '@/lib/kelompok';
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { normalkanNama } from '@/lib/kelompok-insentif';
import { notifyReminderApproved, createNotification, createNotificationForAdmins } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { adalahKategoriInsentif, muatKategoriInsentif } from '@/lib/incentive-scheme';
import { bandingkan, ringkasPerubahan, pesanWAPerubahan, type AdminField } from '@/lib/admin-edit';
import { syncRemindersToProjectProgress, triggersProjectProgress, type ReminderSnapshot } from '@/lib/project-progress-sync';
import { compressImage } from '@/lib/image-compress';
import { idDariNama, kutipNilai, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';

import {
  Priority, Status, RepeatType, Reminder, TeamUser, GuestUser,
  REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES,
  PRIORITY_CONFIG, STATUS_CONFIG, CATEGORIES, CATEGORY_CONFIG,
  SALES_DIVISIONS, PIE_COLORS,
  formatDate, formatDatetime, isDueToday, newBatchId,
  sendFonnteWA, resolveSupervisorsForProductType, type SupervisorCandidate,
  DEFAULT_REQUEST_NOTE, cleanRequestNotes, fetchManagerTargets,
  layakIncentive, diluarIncentive, REMINDER_FIELDS } from './_components/shared';
import {
  LoadingScreen, PageHeader,
} from '@/components/shared';
import { MiniCalendar } from './_components/MiniCalendar';
import { RescheduleModal } from './_components/RescheduleModal';
import { appLink } from '@/lib/app-url';
import { ambilReminderUntuk } from './_components/data-reminder';
import { kelompokkanReminder, pieKategori, pieDivisiSales, pieTeamPts, pieProduk } from './_components/olah-data';
import { RequestJadwalModal, type JadwalRequest } from './_components/RequestJadwalModal';
import { ReminderFormModal, type ReminderForm } from './_components/ReminderFormModal';
import { KonfirmasiApproveInternal, ModalHapus, PopupNotifikasi, PopupLonceng } from './_components/PopupRingkas';
import { RejectReasonModal } from './_components/RejectReasonModal';
import { BulkDeleteConfirmModal } from './_components/BulkDeleteConfirmModal';
import { TanyaLanjutanModal, PilihTipeReminderModal, CariProyekLamaModal } from './_components/LapisEmpatModals';
import { ApproveAssignModal, SupervisorAssignModal } from './_components/ApproveAssignModals';
import { StatsSection } from './_components/StatsSection';
import { FilterBar } from './_components/FilterBar';
import { ModePenyelesaianPanel } from './_components/ModePenyelesaianPanel';
import { ReminderListBody } from './_components/ReminderListBody';
import { ReminderDetailPopup } from './_components/ReminderDetailPopup';
import { IkonTeks } from '@/components/shared/Ikon';
import { Toast } from '@/components/shared/Toast';
import { URL_XLSX } from '@/lib/xlsx-loader';
import { useAlurPersetujuan } from './_components/useAlurPersetujuan';
import { useAksiStatus } from './_components/useAksiStatus';
import { useSimpanJadwal } from './_components/useSimpanJadwal';
import { useTurunanJadwal } from './_components/useTurunanJadwal';


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
  const [installerUserId, setInstallerUserId]         = useState<string | null>(null);
  const [ptsCabangUsers, setPtsCabangUsers]           = useState<{ id: string; full_name: string; pts_daerah: string | null }[]>([]);
  const [installerDaerah, setInstallerDaerah]         = useState('');
  const [bastDate, setBastDate]                       = useState<string>('');
  const [displayType, setDisplayType]                 = useState<'led' | 'lcd' | 'mix' | null>(null);
  const [requiresMiddleware, setRequiresMiddleware]   = useState(false);
  const [requiresControllerAuto, setRequiresControllerAuto] = useState(false);
  const [controllerBrand, setControllerBrand]         = useState<'cue' | 'extron' | 'wyrestorm' | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl]         = useState<string | undefined>(undefined);
  const [savingMode, setSavingMode]                   = useState(false);
  /**
   * true = panel Mode dibuka untuk MENGISI/MENGUBAH detail jadwal yang sudah
   * Completed, bukan sebagai syarat sebelum menyelesaikannya.
   *
   * Kenapa perlu: dulu detail pelaksanaan HANYA bisa diisi tepat pada saat
   * menekan Completed. Begitu statusnya jadi Completed tombol statusnya
   * hilang ("tidak dapat diubah kembali"), jadi jadwal yang terlanjur selesai
   * tanpa detail - mis. diselesaikan sebelum fitur ini ada - tidak punya
   * jalan sama sekali untuk dilengkapi. Padahal jadwal itu tetap ikut ke
   * Incentive PTS, dan di sana tampil sebagai "Mode belum diset".
   */
  const [modeEditSaja, setModeEditSaja]               = useState(false);

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
  // M4 (docs/UX-WORKFLOW-AUDIT.md): dulu tahap admin_review cuma punya Approve
  // atau Hapus permanen (tanpa alasan tercatat, tanpa notif ke Sales) - tidak
  // ada jalur Tolak resmi seperti yang sudah ada di tahap internal_review.
  const [adminRejectTarget, setAdminRejectTarget] = useState<Reminder | null>(null);
  const [adminRejectReason, setAdminRejectReason] = useState('');
  const [adminRejectSaving, setAdminRejectSaving] = useState(false);
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
      notify('success', `${hasil.created} checklist lokasi dibuat di Project Progress. Isi checklist diimpor atau disalin menyusul di sana.`);
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
      fetchPTSCabangUsers(),
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
    const { data } = await supabase.from('users').select('id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, telegram_chat_id, bisa_ditugaskan').order('full_name');
    // Hanya team assignable (IVP/MVI - UMP dikecualikan, lihat lib/teams.ts). Ubah di satu tempat itu utk tambah/kurangi team.
    // Manager IKUT dimuat (bolehDitugaskanOleh(u, true)) - dibutuhkan untuk
    // lookup WA saat Admin meng-assign Manager. Siapa yang DITAWARKAN di
    // dropdown disaring terpisah lewat teamUsersDitawarkan di bawah.
    if (data) setTeamUsers(data.filter((u: TeamUser) => bolehDitugaskanOleh(u, true) && u.role !== 'admin' && u.role !== 'superadmin'));
  };

  const fetchGuestUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, username, full_name, role, phone_number, sales_division, is_internal_sales')
      .eq('role', 'guest')
      .order('full_name');
    if (data) {
      const idPim = await muatIdPimpinan(supabase);
      setGuestUsers((data as GuestUser[]).filter(u => !idPim.has(u.id)));
    }
  };

  /**
   * Akun kelompok "PTS Cabang" - dipakai dropdown Installer di panel Mode
   * Penyelesaian (menggantikan isian nama installer manual). Lihat catatan
   * field `cabang` di lib/kelompok.ts.
   */
  const fetchPTSCabangUsers = async () => {
    const cabang = namaKelompokCabang();
    if (cabang.length === 0) { setPtsCabangUsers([]); return; }
    const { data } = await supabase.from('users').select('id, full_name, pts_daerah')
      .in('team_type', cabang).order('full_name');
    if (data) setPtsCabangUsers(data as { id: string; full_name: string; pts_daerah: string | null }[]);
  };

  const jalankanBulkDelete = async () => {
    setBulkConfirm(false); setBulkDeleting(true);
    const { error } = await supabase.from('reminders').delete().in('id', Array.from(selectedIds));
    if (!error) { setReminders(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
    else notify('error', 'Gagal: ' + error.message);
    setBulkDeleting(false);
  };

  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filteredReminders.length ? new Set() : new Set(filteredReminders.map(r => r.id))
  );

  //  Aturan siapa melihat jadwal apa: _components/data-reminder.ts
  const fetchRemindersForUser = (activeUser: TeamUser | null): Promise<Reminder[]> => ambilReminderUntuk(activeUser, managerUserId);

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
  // layakIncentive/diluarIncentive: lihat _components/shared.ts - tombol Sync
  // tampil pada SETIAP jadwal yang memenuhi syarat, bukan hanya yang sedang
  // dikeluarkan (tombol yang tidak bisa ditemukan lebih buruk daripada
  // tombol yang kadang kelihatan sebelum saatnya).

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
  const { resolveGrupInsentif, cariProyekSerupa, handleSave } = useSimpanJadwal({ bulkTarget, currentUser, editingReminder, emptyForm, extraDates, fetchRemindersQuiet, formData, guestUsers, notify, progressTimelinePayload, proyekLamaTerpilih, reminders, setBulkTarget, setEditingReminder, setExtraDates, setFormData, setProyekLamaTerpilih, setSaving, setShowFormModal, setTanyaLanjutan, setView, syncNewRemindersToProgress, teamUsers });

  const { handleDelete, openDeleteModal, handleStatusChange, handleConfirmStatusUpdate, bukaEditDetailPelaksanaan, handleModeConfirm, handleResendFormReview } = useAksiStatus({ bastDate, controllerBrand, currentUser, deleteTarget, detailReminder, displayType, fetchRemindersQuiet, guestUsers, installerDaerah, installerName, installerUserId, modeEditSaja, modePenyelesaian, notify, pendingPhotoUrl, pendingStatus, reminders, requiresControllerAuto, requiresMiddleware, setBastDate, setControllerBrand, setDeleteConfirmText, setDeleteTarget, setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware, setResendingFormReview, setSavingMode, setShowDeleteModal, setShowModeModal, setStatusPhoto, setStatusPhotoPreview, setUpdatingStatus, statusPhoto });

  /**
   * Label field reminder untuk catatan audit & pesan WA, supaya catatannya
   * menyebut APA yang berubah - bukan sekadar "Detail reminder disunting".
   */

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
          `\n🔗 ${appLink()}`;
        await sendFonnteWA(handlerUser.phone_number, msg, undefined, 'reminder.rescheduled');
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

    const result = await sendFonnteWA(handlerData.phone_number, msg, { reminderType: 'manual', reminderId: r.id }, 'reminder.new_schedule');
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
      s.src = URL_XLSX;
      s.onload = () => runExport((window as any).XLSX);
      s.onerror = () => notify('error', 'Gagal memuat library Excel.');
      document.head.appendChild(s);
    }
  };

  // Filters

  const { availableYears, filteredReminders, groupedReminders, todayCount, pendingCount, doneCount, totalCount, sourceReminders, projectPieData, salesPieData, teamPtsPieData, productPieData, isAdmin, teamUsersDitawarkan, isManager, canApproveAssign, isMyReviewStage, bolehEditReminder, canInternalApprove, canAddReminder, isGuest } = useTurunanJadwal({ currentUser, filterCategory, filterStatus, filterYear, managerUserId, productFilter, reminders, searchDivisionSales, searchProduct, searchProject, searchSales, searchTeamHandler, selectedCalDay, teamUsers });

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

  // Deep-link dari notifikasi (?open=<id>): buka detail reminder-nya langsung,
  // bukan cuma daftar. Ref sekali-jalan - tanpa itu, reminders yang di-refetch
  // berkala (realtime) akan membuka lagi detailnya tiap kali walau user
  // sudah menutupnya.
  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current) return;
    const openId = searchParams.get('open');
    if (!openId || reminders.length === 0) return;
    const target = reminders.find(r => r.id === openId);
    if (target) {
      sudahBukaDariNotif.current = true;
      setDetailReminder(target);
    }
  }, [searchParams, reminders]);

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
  const { handleRequestJadwal, handleInternalApprove, handleInternalReject, handleInternalRejectConfirm, handleAdminReject, handleAdminRejectConfirm, handleApproveRoute, handleApproveAssign, openSupervisorAssign, handleSupervisorAssignConfirm } = useAlurPersetujuan({ adminRejectReason, adminRejectTarget, approveAssignTo, approveBatchSiblings, approveDate, approveStart, approveSupervisors, approveTarget, approveTarget2, approveTime, currentUser, fetchRemindersQuiet, guestUsers, internalRejectReason, internalRejectTarget, notify, proyekLamaTerpilih, resolveGrupInsentif, setAdminRejectReason, setAdminRejectSaving, setAdminRejectTarget, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveRouteSaving, setApproveSaving, setApproveSupervisors, setApproveTarget, setApproveTime, setCurrentUser, setDetailReminder, setInternalApproveSaving, setInternalApproveTarget, setInternalRejectReason, setInternalRejectSaving, setInternalRejectTarget, setProyekLamaTerpilih, setSaving, setShowRequestModal, setSupervisorAssignBatchSiblings, setSupervisorAssignSaving, setSupervisorAssignTarget, setSupervisorAssignTo, supervisorAssignBatchSiblings, supervisorAssignTarget, supervisorAssignTo, syncNewRemindersToProgress, teamUsers });

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
      background: 'var(--latar-halaman)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      {/* TANPA z-index — disengaja. `relative z-10` di sini dulu membentuk
          stacking context, sehingga z-index SEMUA modal di dalamnya cuma
          dibandingkan sesama isi pembungkus ini, bukan dengan overlay yang
          di-portal ke <body>. Akibatnya modal z-[1100] bisa tampil DI BELAKANG
          modal z-[1000] yang di-portal. Urutan cat terhadap tint di atas tetap
          aman karena elemen ini datang belakangan di DOM. */}
      <div className="relative flex flex-col flex-1 overflow-hidden">

        {/* Toast */}
        <Toast notif={toast} />

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
          <RejectReasonModal
            target={internalRejectTarget}
            reason={internalRejectReason}
            setReason={setInternalRejectReason}
            saving={internalRejectSaving}
            onConfirm={handleInternalRejectConfirm}
            onCancel={() => setInternalRejectTarget(null)}
          />
        )}

        {/* M4 — TOLAK MODAL (Admin/Manager, tahap admin_review) - dulu tidak ada
            jalur ini, hanya Approve atau Hapus permanen tanpa alasan tercatat. */}
        {adminRejectTarget && (
          <RejectReasonModal
            target={adminRejectTarget}
            reason={adminRejectReason}
            setReason={setAdminRejectReason}
            saving={adminRejectSaving}
            onConfirm={handleAdminRejectConfirm}
            onCancel={() => setAdminRejectTarget(null)}
          />
        )}

                <KonfirmasiApproveInternal
          internalApproveTarget={internalApproveTarget}
          internalApproveSaving={internalApproveSaving}
          setInternalApproveTarget={setInternalApproveTarget}
          handleInternalApprove={handleInternalApprove}
        />

        {/* ── APPROVE & ASSIGN MODAL (Admin only) ── */}
        {approveTarget && canApproveAssign && (
          <ApproveAssignModal
            approveTarget={approveTarget}
            approveBatchSiblings={approveBatchSiblings}
            approveAssignTo={approveAssignTo}
            setApproveAssignTo={setApproveAssignTo}
            approveDate={approveDate}
            setApproveDate={setApproveDate}
            approveTime={approveTime}
            setApproveTime={setApproveTime}
            approveSupervisors={approveSupervisors}
            approveRouteSaving={approveRouteSaving}
            handleApproveRoute={handleApproveRoute}
            approveStart={approveStart}
            setApproveStart={setApproveStart}
            approveTarget2={approveTarget2}
            setApproveTarget2={setApproveTarget2}
            approveSaving={approveSaving}
            handleApproveAssign={handleApproveAssign}
            teamUsers={teamUsersDitawarkan}
            onClose={() => { setApproveTarget(null); setApproveBatchSiblings([]); setApproveAssignTo(''); }}
            onBatal={() => { setApproveTarget(null); setApproveBatchSiblings([]); setApproveAssignTo(''); setApproveDate(''); setApproveTime(''); }}
          />
        )}

        {/* ── SUPERVISOR ASSIGN MODAL ── */}
        {supervisorAssignTarget && (
          <SupervisorAssignModal
            supervisorAssignTarget={supervisorAssignTarget}
            supervisorAssignBatchSiblings={supervisorAssignBatchSiblings}
            supervisorAssignTo={supervisorAssignTo}
            setSupervisorAssignTo={setSupervisorAssignTo}
            teamUsers={teamUsersDitawarkan}
            currentUser={currentUser}
            supervisorAssignSaving={supervisorAssignSaving}
            handleSupervisorAssignConfirm={handleSupervisorAssignConfirm}
            onClose={() => { setSupervisorAssignTarget(null); setSupervisorAssignBatchSiblings([]); setSupervisorAssignTo(''); }}
          />
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
        <BulkDeleteConfirmModal
          jumlah={selectedIds.size}
          onCancel={() => setBulkConfirm(false)}
          onConfirm={jalankanBulkDelete}
        />
      )}

      {/*
        Pertanyaan kelanjutan proyek. Bukan peringatan yang bisa diabaikan:
        keduanya pilihan yang sah, dan platform tidak punya dasar untuk memilih
        sendiri. Yang salah bukan "membuat dua jadwal" - itu wajar - melainkan
        membiarkan hubungannya tidak dinyatakan.
      */}
      {tanyaLanjutan && (
        <TanyaLanjutanModal
          tanyaLanjutan={tanyaLanjutan}
          onCancel={() => setTanyaLanjutan(null)}
          resolveGrupInsentif={resolveGrupInsentif}
        />
      )}

      {/*
        Lapis 4, langkah 'pilih': ditanyakan sebelum form terlihat sama sekali,
        seperti Create Ticket. Menunda pertanyaan ini sampai form terbuka
        berarti orang sudah mulai mengetik sebelum tahu ada jalan yang lebih
        cepat.
      */}
      {langkahBuat === 'pilih' && (
        <PilihTipeReminderModal
          buatUntukGuest={buatUntukGuest}
          onPilihLama={() => setLangkahBuat('cari')}
          onPilihBaru={() => {
            setLangkahBuat(null); setProyekLamaTerpilih(null);
            if (buatUntukGuest) { setPraFillGuest(null); setShowRequestModal(true); }
            else setShowFormModal(true);
          }}
          onCancel={() => setLangkahBuat(null)}
        />
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
        <CariProyekLamaModal
          buatUntukGuest={buatUntukGuest}
          carianProyek={carianProyek}
          setCarianProyek={setCarianProyek}
          praPilihProyek={praPilihProyek}
          setPraPilihProyek={setPraPilihProyek}
          hasilCarianProyek={hasilCarianProyek}
          reminders={reminders}
          onKembali={() => { setLangkahBuat('pilih'); setPraPilihProyek(null); setCarianProyek(''); }}
          onBatal={() => setLangkahBuat(null)}
          konfirmasiProyekLama={konfirmasiProyekLama}
        />
      )}

      {showFormModal && (
        <ReminderFormModal
          editingReminder={editingReminder}
          jumlahJadwalLama={proyekLamaTerpilih?.length ?? 0}
          formData={formData as ReminderForm}
          setFormData={setFormData as (data: ReminderForm) => void}
          saving={saving}
          teamUsers={teamUsersDitawarkan}
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
        {/* setShowModeModal & setPendingStatus sengaja dibungkus: keduanya
            menjaga modeEditSaja tidak tertinggal menyala. Kalau panel edit
            ditutup/dibatalkan lalu jadwal LAIN ditandai Completed, flag yang
            tertinggal akan membuat statusnya tidak pernah ikut tersimpan. */}
        {detailReminder && (
          <ReminderDetailPopup
            detailReminder={detailReminder} setDetailReminder={setDetailReminder}
            showModeModal={showModeModal}
            setShowModeModal={(v: boolean) => { setShowModeModal(v); if (!v) setModeEditSaja(false); }}
            modeEditSaja={modeEditSaja} bukaEditDetailPelaksanaan={bukaEditDetailPelaksanaan}
            pendingStatus={pendingStatus}
            setPendingStatus={(v: Status | null) => { setPendingStatus(v); if (v) setModeEditSaja(false); }}
            statusPhoto={statusPhoto} setStatusPhoto={setStatusPhoto}
            statusPhotoPreview={statusPhotoPreview} setStatusPhotoPreview={setStatusPhotoPreview}
            showRiwayat={showRiwayat} setShowRiwayat={setShowRiwayat}
            isAdmin={isAdmin} isManager={isManager} currentUser={currentUser}
            isMyReviewStage={isMyReviewStage}
            canInternalApprove={canInternalApprove} setInternalApproveTarget={setInternalApproveTarget} handleInternalReject={handleInternalReject}
            canApproveAssign={canApproveAssign} setApproveTarget={setApproveTarget} setApproveBatchSiblings={setApproveBatchSiblings} reminders={reminders}
            setApproveAssignTo={setApproveAssignTo} setApproveDate={setApproveDate} setApproveTime={setApproveTime}
            handleAdminReject={handleAdminReject}
            openSupervisorAssign={openSupervisorAssign}
            bolehEditReminder={bolehEditReminder} setRescheduleTarget={setRescheduleTarget}
            resendingFormReview={resendingFormReview} handleResendFormReview={handleResendFormReview}
            sendingWA={sendingWA} handleSendWA={handleSendWA}
            openEdit={openEdit}
            statusPhotoRef={statusPhotoRef}
            handleConfirmStatusUpdate={handleConfirmStatusUpdate} updatingStatus={updatingStatus}
            guestUsers={guestUsers}
            modePenyelesaian={modePenyelesaian} setModePenyelesaian={setModePenyelesaian}
            installerName={installerName} setInstallerName={setInstallerName}
            installerUserId={installerUserId} setInstallerUserId={setInstallerUserId}
            daftarCabang={ptsCabangUsers}
            installerDaerah={installerDaerah} setInstallerDaerah={setInstallerDaerah}
            bastDate={bastDate} setBastDate={setBastDate}
            displayType={displayType} setDisplayType={setDisplayType}
            requiresMiddleware={requiresMiddleware} setRequiresMiddleware={setRequiresMiddleware}
            requiresControllerAuto={requiresControllerAuto} setRequiresControllerAuto={setRequiresControllerAuto}
            controllerBrand={controllerBrand} setControllerBrand={setControllerBrand}
            setPendingPhotoUrl={setPendingPhotoUrl}
            savingMode={savingMode} handleModeConfirm={handleModeConfirm}
          />
        )}

        {/* ── HEADER ── */}
        <PageHeader icon="🗓️" title="Request Schedule" color="#0891b2" colorLight="#0e7490">
          <button aria-label={`Notifikasi jadwal${myActiveReminders.length ? ` (${myActiveReminders.length} aktif)` : ''}`} onClick={() => setShowBellPopup(true)}
            className="relative p-2 rounded-xl transition-all hover:bg-cyan-50 border-2 border-transparent hover:border-cyan-200">
            <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {myActiveReminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
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
                <IkonTeks nama="📩" />Request Jadwal
              </button>
              {pendingReviewCount > 0 && (
                <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <IkonTeks nama="⚠" />Selesaikan {pendingReviewCount} form review dulu
                </span>
              )}
            </div>
          )}
        </PageHeader>

        {/*
          overflow-x-hidden SEMPAT dicoba di sini sebagai jaring pengaman,
          lalu dicabut lagi: kalau masih ada elemen lain yang kebetulan lebih
          lebar dari layar (dan ternyata masih ada - lihat perbaikan min-w-0
          pada kolom Handler di kartu mobile di bawah), overflow-x-hidden
          membuat kontennya terkunci TERPOTONG TANPA BISA DIGESER SAMA SEKALI
          - lebih buruk dari sekadar halaman yang perlu digeser. Perbaikan
          yang benar adalah membetulkan elemen yang melebar itu sendiri
          (truncate/min-w-0 di sumbernya), bukan menyembunyikan gejalanya.
        */}
        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-2.5 py-3 space-y-3 sm:px-5 sm:py-5 sm:space-y-4">
          {view === 'list' && (
            <>
              <StatsSection
                totalCount={totalCount}
                pendingCount={pendingCount}
                doneCount={doneCount}
                todayCount={todayCount}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                selectedCalDay={selectedCalDay}
                setSelectedCalDay={setSelectedCalDay}
                projectPieData={projectPieData}
                salesPieData={salesPieData}
                teamPtsPieData={teamPtsPieData}
                productPieData={productPieData}
                filterCategory={filterCategory}
                setFilterCategory={setFilterCategory}
                searchDivisionSales={searchDivisionSales}
                setSearchDivisionSales={setSearchDivisionSales}
                searchTeamHandler={searchTeamHandler}
                setSearchTeamHandler={setSearchTeamHandler}
                productFilter={productFilter}
                setProductFilter={setProductFilter}
              />

              {/* Active filter chips */}
              {/* Main area: list + calendar (di HP stack; kalender hanya di desktop).
                  items-start SEBELUMNYA berlaku di kedua mode (HP maupun desktop).
                  Di flex-col (HP), align-items mengatur SUMBU SILANG yaitu
                  LEBAR - items-start berarti kartu daftar TIDAK dipaksa selebar
                  layar, melainkan menyusut/melebar mengikuti kontennya sendiri.
                  Itu sebabnya berbagai perbaikan truncate/grid sebelumnya di
                  dalam kartu ini terlihat "hampir benar" tapi halamannya tetap
                  bisa digeser - akar soalnya di sini, bukan di kontennya.
                  items-start cuma dibutuhkan di lg: (top-align list & kalender
                  berdampingan tanpa saling menyamakan tinggi); di HP dibalik ke
                  items-stretch (bawaan) supaya kartu daftar dipatok 100% lebar. */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start">

                {/* ── TICKET LIST ── */}
                <div className="flex-1 min-w-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>

                  <FilterBar
                    filteredReminders={filteredReminders}
                    isAdmin={isAdmin}
                    isManager={isManager}
                    selectMode={selectMode}
                    setSelectMode={setSelectMode}
                    setSelectedIds={setSelectedIds}
                    fetchReminders={fetchReminders}
                    listLoading={listLoading}
                    handleExportExcel={handleExportExcel}
                    searchProject={searchProject}
                    setSearchProject={setSearchProject}
                    searchSales={searchSales}
                    setSearchSales={setSearchSales}
                    searchProduct={searchProduct}
                    setSearchProduct={setSearchProduct}
                    setProductFilter={setProductFilter}
                    searchTeamHandler={searchTeamHandler}
                    setSearchTeamHandler={setSearchTeamHandler}
                    filterStatus={filterStatus}
                    setFilterStatus={setFilterStatus}
                    filterYear={filterYear}
                    setFilterYear={setFilterYear}
                    availableYears={availableYears}
                    selectedIds={selectedIds}
                    bulkDeleting={bulkDeleting}
                    setBulkConfirm={setBulkConfirm}
                    filterCategory={filterCategory}
                    setFilterCategory={setFilterCategory}
                    searchDivisionSales={searchDivisionSales}
                    setSearchDivisionSales={setSearchDivisionSales}
                    selectedCalDay={selectedCalDay}
                    setSelectedCalDay={setSelectedCalDay}
                    productFilter={productFilter}
                  />

                  <ReminderListBody
                    fetchError={fetchError} setFetchError={setFetchError} fetchReminders={fetchReminders} listLoading={listLoading}
                    filteredReminders={filteredReminders} reminders={reminders} groupedReminders={groupedReminders}
                    filterStatus={filterStatus} filterYear={filterYear} filterCategory={filterCategory}
                    productFilter={productFilter} setProductFilter={setProductFilter}
                    searchProject={searchProject} searchSales={searchSales} searchDivisionSales={searchDivisionSales}
                    searchTeamHandler={searchTeamHandler} searchProduct={searchProduct}
                    setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setFilterCategory={setFilterCategory}
                    setSearchProject={setSearchProject} setSearchSales={setSearchSales} setSearchDivisionSales={setSearchDivisionSales}
                    setSearchTeamHandler={setSearchTeamHandler} setSearchProduct={setSearchProduct}
                    setDetailReminder={setDetailReminder}
                    bolehEditReminder={bolehEditReminder} setRescheduleTarget={setRescheduleTarget}
                    canInternalApprove={canInternalApprove} setInternalApproveTarget={setInternalApproveTarget} handleInternalReject={handleInternalReject}
                    canApproveAssign={canApproveAssign} setApproveTarget={setApproveTarget} setApproveBatchSiblings={setApproveBatchSiblings}
                    setApproveAssignTo={setApproveAssignTo} setApproveDate={setApproveDate} setApproveTime={setApproveTime}
                    handleAdminReject={handleAdminReject}
                    currentUser={currentUser} openSupervisorAssign={openSupervisorAssign}
                    isAdmin={isAdmin} isManager={isManager}
                    syncKeIncentive={syncKeIncentive} syncing={syncing}
                    openDeleteModal={openDeleteModal}
                    selectMode={selectMode} selectedIds={selectedIds} setSelectedIds={setSelectedIds} toggleSelectAll={toggleSelectAll}
                    guestUsers={guestUsers}
                  />
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
