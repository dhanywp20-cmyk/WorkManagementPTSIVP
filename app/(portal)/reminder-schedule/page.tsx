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
import { useMuatPengguna } from './_components/useMuatPengguna';
import { useMuatJadwal } from './_components/useMuatJadwal';
import { useAksiJadwal } from './_components/useAksiJadwal';
import { useAksiMassalJadwal } from './_components/useAksiMassalJadwal';
import { useProyekLama } from './_components/useProyekLama';
import { IsiJadwal } from './_components/IsiJadwal';
import { KepalaJadwal } from './_components/KepalaJadwal';
import { PopupDetailJadwal } from './_components/PopupDetailJadwal';
import { useStateApproval } from './_components/useStateApproval';
import { useStateModePenyelesaian } from './_components/useStateModePenyelesaian';


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
  const { showModeModal, setShowModeModal, modePenyelesaian, setModePenyelesaian, installerName, setInstallerName, installerUserId, setInstallerUserId, ptsCabangUsers, setPtsCabangUsers, installerDaerah, setInstallerDaerah, bastDate, setBastDate, displayType, setDisplayType, requiresMiddleware, setRequiresMiddleware, requiresControllerAuto, setRequiresControllerAuto, controllerBrand, setControllerBrand, pendingPhotoUrl, setPendingPhotoUrl, savingMode, setSavingMode, modeEditSaja, setModeEditSaja, resendingFormReview, setResendingFormReview } = useStateModePenyelesaian();

  // Guest Request Jadwal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  /** Jawaban query review sudah tiba? Dipakai pintasan ?buat=1 di bawah. */
  const [jumlahReviewSiap, setJumlahReviewSiap] = useState(false);
  /** Pintasan hanya boleh membuka modal sekali, bukan tiap kali render ulang. */
  const pintasanTerpakai = useRef(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  // Approve & Assign State (admin only)
  const { approveTarget, setApproveTarget, approveBatchSiblings, setApproveBatchSiblings, approveAssignTo, setApproveAssignTo, approveDate, setApproveDate, approveTime, setApproveTime, showRiwayat, setShowRiwayat, approveStart, setApproveStart, approveTarget2, setApproveTarget2, approveSaving, setApproveSaving, internalRejectTarget, setInternalRejectTarget, internalApproveTarget, setInternalApproveTarget, internalApproveSaving, setInternalApproveSaving, internalRejectReason, setInternalRejectReason, internalRejectSaving, setInternalRejectSaving, adminRejectTarget, setAdminRejectTarget, adminRejectReason, setAdminRejectReason, adminRejectSaving, setAdminRejectSaving, approveSupervisors, setApproveSupervisors, approveRouteSaving, setApproveRouteSaving, supervisorAssignTarget, setSupervisorAssignTarget, supervisorAssignBatchSiblings, setSupervisorAssignBatchSiblings, supervisorAssignTo, setSupervisorAssignTo, supervisorAssignSaving, setSupervisorAssignSaving } = useStateApproval();

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

  const { daftarProyekLama, hasilCarianProyek, mulaiBuatReminder, mulaiRequestJadwal, konfirmasiProyekLama } = useProyekLama({ buatUntukGuest, carianProyek, emptyForm, praPilihProyek, reminders, setBuatUntukGuest, setCarianProyek, setEditingReminder, setExtraDates, setFormData, setLangkahBuat, setPraFillGuest, setPraPilihProyek, setProyekLamaTerpilih, setShowFormModal, setShowRequestModal });

  // Filters - extended with team handler & category
  const [filterStatus, setFilterStatus]     = useState<Status | 'all'>('all');
  const [filterYear, setFilterYear]         = useState<string>('all');
  const [searchProject, setSearchProject]   = useState('');
  const [searchSales, setSearchSales]       = useState('');

  // Auto-apply filter dari Global Search (?q=...)

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

  const { fetchTeamUsers, fetchGuestUsers, fetchPTSCabangUsers } = useMuatPengguna({ setGuestUsers, setPtsCabangUsers, setTeamUsers });

  const { fetchRemindersForUser, fetchRemindersQuiet, fetchReminders } = useMuatJadwal({ currentUser, managerUserId, setFetchError, setListLoading, setReminders });

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

  const { availableYears, filteredReminders, groupedReminders, todayCount, pendingCount, doneCount, totalCount, sourceReminders, projectPieData, salesPieData, teamPtsPieData, productPieData, isAdmin, teamUsersDitawarkan, isManager, canApproveAssign, isMyReviewStage, bolehEditReminder, canInternalApprove, canAddReminder, isGuest } = useTurunanJadwal({ currentUser, filterCategory, filterStatus, filterYear, managerUserId, productFilter, reminders, searchDivisionSales, searchProduct, searchProject, searchSales, searchTeamHandler, selectedCalDay, teamUsers });

  const { jalankanBulkDelete, toggleSelectId, toggleSelectAll } = useAksiMassalJadwal({ filteredReminders, notify, selectedIds, setBulkConfirm, setBulkDeleting, setReminders, setSelectMode, setSelectedIds });

  //  Aturan siapa melihat jadwal apa: _components/data-reminder.ts
  const { openEdit, handleReschedule, handleSendWA, handleExportExcel } = useAksiJadwal({ currentUser, fetchRemindersQuiet, filteredReminders, notify, reminders, rescheduleTarget, setDetailReminder, setEditingReminder, setExtraDates, setFormData, setRescheduleTarget, setSendingWA, setShowFormModal });

  // Filters


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
        <PopupDetailJadwal
          bastDate={bastDate} bolehEditReminder={bolehEditReminder} bukaEditDetailPelaksanaan={bukaEditDetailPelaksanaan} canApproveAssign={canApproveAssign} canInternalApprove={canInternalApprove} controllerBrand={controllerBrand} currentUser={currentUser} detailReminder={detailReminder} displayType={displayType} guestUsers={guestUsers} handleAdminReject={handleAdminReject} handleConfirmStatusUpdate={handleConfirmStatusUpdate} handleInternalReject={handleInternalReject} handleModeConfirm={handleModeConfirm} handleResendFormReview={handleResendFormReview} handleSendWA={handleSendWA} installerDaerah={installerDaerah} installerName={installerName} installerUserId={installerUserId} isAdmin={isAdmin} isManager={isManager} isMyReviewStage={isMyReviewStage} modeEditSaja={modeEditSaja} modePenyelesaian={modePenyelesaian} openEdit={openEdit} openSupervisorAssign={openSupervisorAssign} pendingStatus={pendingStatus} ptsCabangUsers={ptsCabangUsers} reminders={reminders} requiresControllerAuto={requiresControllerAuto} requiresMiddleware={requiresMiddleware} resendingFormReview={resendingFormReview} savingMode={savingMode} sendingWA={sendingWA} setApproveAssignTo={setApproveAssignTo} setApproveBatchSiblings={setApproveBatchSiblings} setApproveDate={setApproveDate} setApproveTarget={setApproveTarget} setApproveTime={setApproveTime} setBastDate={setBastDate} setControllerBrand={setControllerBrand} setDetailReminder={setDetailReminder} setDisplayType={setDisplayType} setInstallerDaerah={setInstallerDaerah} setInstallerName={setInstallerName} setInstallerUserId={setInstallerUserId} setInternalApproveTarget={setInternalApproveTarget} setModeEditSaja={setModeEditSaja} setModePenyelesaian={setModePenyelesaian} setPendingPhotoUrl={setPendingPhotoUrl} setPendingStatus={setPendingStatus} setRequiresControllerAuto={setRequiresControllerAuto} setRequiresMiddleware={setRequiresMiddleware} setRescheduleTarget={setRescheduleTarget} setShowModeModal={setShowModeModal} setShowRiwayat={setShowRiwayat} setStatusPhoto={setStatusPhoto} setStatusPhotoPreview={setStatusPhotoPreview} showModeModal={showModeModal} showRiwayat={showRiwayat} statusPhoto={statusPhoto} statusPhotoPreview={statusPhotoPreview} statusPhotoRef={statusPhotoRef} updatingStatus={updatingStatus}
        />

        {/* ── HEADER ── */}
        <KepalaJadwal
          canAddReminder={canAddReminder} isGuest={isGuest} mulaiBuatReminder={mulaiBuatReminder} mulaiRequestJadwal={mulaiRequestJadwal} myActiveReminders={myActiveReminders} pendingReviewCount={pendingReviewCount} setShowBellPopup={setShowBellPopup} view={view}
        />

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
        <IsiJadwal
          availableYears={availableYears} bolehEditReminder={bolehEditReminder} bulkDeleting={bulkDeleting} calOnlyDay={calOnlyDay} calendarMonth={calendarMonth} canApproveAssign={canApproveAssign} canInternalApprove={canInternalApprove} currentUser={currentUser} doneCount={doneCount} fetchError={fetchError} fetchReminders={fetchReminders} filterCategory={filterCategory} filterStatus={filterStatus} filterYear={filterYear} filteredReminders={filteredReminders} groupedReminders={groupedReminders} guestUsers={guestUsers} handleAdminReject={handleAdminReject} handleExportExcel={handleExportExcel} handleInternalReject={handleInternalReject} isAdmin={isAdmin} isGuest={isGuest} isManager={isManager} listLoading={listLoading} openDeleteModal={openDeleteModal} openSupervisorAssign={openSupervisorAssign} pendingCount={pendingCount} productFilter={productFilter} productPieData={productPieData} projectPieData={projectPieData} reminders={reminders} salesPieData={salesPieData} searchDivisionSales={searchDivisionSales} searchProduct={searchProduct} searchProject={searchProject} searchSales={searchSales} searchTeamHandler={searchTeamHandler} selectMode={selectMode} selectedCalDay={selectedCalDay} selectedIds={selectedIds} setApproveAssignTo={setApproveAssignTo} setApproveBatchSiblings={setApproveBatchSiblings} setApproveDate={setApproveDate} setApproveTarget={setApproveTarget} setApproveTime={setApproveTime} setBulkConfirm={setBulkConfirm} setCalOnlyDay={setCalOnlyDay} setCalendarMonth={setCalendarMonth} setDetailReminder={setDetailReminder} setFetchError={setFetchError} setFilterCategory={setFilterCategory} setFilterStatus={setFilterStatus} setFilterYear={setFilterYear} setInternalApproveTarget={setInternalApproveTarget} setProductFilter={setProductFilter} setRescheduleTarget={setRescheduleTarget} setSearchDivisionSales={setSearchDivisionSales} setSearchProduct={setSearchProduct} setSearchProject={setSearchProject} setSearchSales={setSearchSales} setSearchTeamHandler={setSearchTeamHandler} setSelectMode={setSelectMode} setSelectedCalDay={setSelectedCalDay} setSelectedIds={setSelectedIds} syncKeIncentive={syncKeIncentive} syncing={syncing} teamPtsPieData={teamPtsPieData} todayCount={todayCount} toggleSelectAll={toggleSelectAll} totalCount={totalCount} view={view}
        />

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
