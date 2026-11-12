'use client';

import { useState, useEffect, useRef } from 'react';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hitungReviewMenggantung } from '@/lib/form-review-gate';
import { clearSession, getSession } from '@/lib/auth/sesi';
import { logAudit } from '@/lib/audit';
import { muatKategoriInsentif } from '@/lib/incentive/scheme';
import { syncRemindersToProjectProgress, triggersProjectProgress, type ReminderSnapshot } from '@/lib/checklist/sinkron-progress';
import { kutipNilai, cobaIdentitas } from '@/lib/identitas';
import { Status, Reminder, TeamUser, GuestUser, resolveSupervisorsForProductType, diluarIncentive } from './shared';
import { type JadwalRequest } from './RequestJadwalModal';
import { useAlurPersetujuan } from './useAlurPersetujuan';
import { useAksiStatus } from './useAksiStatus';
import { useSimpanJadwal } from './useSimpanJadwal';
import { useTurunanJadwal } from './useTurunanJadwal';
import { useMuatPengguna } from './useMuatPengguna';
import { useMuatJadwal } from './useMuatJadwal';
import { useAksiJadwal } from './useAksiJadwal';
import { useAksiMassalJadwal } from './useAksiMassalJadwal';
import { useProyekLama } from './useProyekLama';
import { type NilaiKonteksJadwal } from './konteks-jadwal';
import { useStateApproval } from './useStateApproval';
import { useStateModePenyelesaian } from './useStateModePenyelesaian';
import { hitungPerluAksi } from './perlu-aksi';
import { buatFormKosong } from './form-kosong';
import { siapkanSinkronInsentif } from './siapkanSinkronInsentif';

export function useHalamanJadwal() {
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
  const [managerUserId, setManagerUserId]   = useState('');
  const [myJabatan, setMyJabatan]           = useState('');
  const [myIsInternalSales, setMyIsInternalSales] = useState(false);
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

  const [tanyaLanjutan, setTanyaLanjutan] = useState<{
    nama: string;
    sebelumnya: Reminder[];
    lanjut: (grup: string | null) => void;
  } | null>(null);

  const [langkahBuat, setLangkahBuat] = useState<'pilih' | 'cari' | null>(null);
  const [buatUntukGuest, setBuatUntukGuest] = useState(false);
  const [carianProyek, setCarianProyek] = useState('');
  const [praPilihProyek, setPraPilihProyek] = useState<Reminder | null>(null);
  const [proyekLamaTerpilih, setProyekLamaTerpilih] = useState<Reminder[] | null>(null);
  const [praFillGuest, setPraFillGuest] = useState<Partial<JadwalRequest> | null>(null);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchProject(q);
  }, [searchParams]);

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
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [calOnlyDay, setCalOnlyDay]         = useState<string | null>(null);
  const [sendingWA, setSendingWA]           = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState<Reminder | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [pendingStatus, setPendingStatus]   = useState<Status | null>(null);
  const [statusPhoto, setStatusPhoto]       = useState<File | null>(null);
  const [statusPhotoPreview, setStatusPhotoPreview] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const statusPhotoRef = useRef<HTMLInputElement>(null);

  const {
    showModeModal, setShowModeModal, modePenyelesaian, setModePenyelesaian, installerName, setInstallerName, installerUserId,
    setInstallerUserId, ptsCabangUsers, setPtsCabangUsers, installerDaerah, setInstallerDaerah, bastDate, setBastDate, displayType,
    setDisplayType, requiresMiddleware, setRequiresMiddleware, requiresControllerAuto, setRequiresControllerAuto, controllerBrand,
    setControllerBrand, pendingPhotoUrl, setPendingPhotoUrl, savingMode, setSavingMode, modeEditSaja, setModeEditSaja,
    resendingFormReview, setResendingFormReview,
  } = useStateModePenyelesaian();

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [jumlahReviewSiap, setJumlahReviewSiap] = useState(false);
  const pintasanTerpakai = useRef(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const {
    approveTarget, setApproveTarget, approveBatchSiblings, setApproveBatchSiblings, approveAssignTo, setApproveAssignTo,
    approveDate, setApproveDate, approveTime, setApproveTime, showRiwayat, setShowRiwayat, approveStart, setApproveStart,
    approveTarget2, setApproveTarget2, approveSaving, setApproveSaving, internalRejectTarget, setInternalRejectTarget,
    internalApproveTarget, setInternalApproveTarget, internalApproveSaving, setInternalApproveSaving, internalRejectReason,
    setInternalRejectReason, internalRejectSaving, setInternalRejectSaving, adminRejectTarget, setAdminRejectTarget,
    adminRejectReason, setAdminRejectReason, adminRejectSaving, setAdminRejectSaving, approveSupervisors, setApproveSupervisors,
    approveRouteSaving, setApproveRouteSaving, supervisorAssignTarget, setSupervisorAssignTarget, supervisorAssignBatchSiblings,
    setSupervisorAssignBatchSiblings, supervisorAssignTo, setSupervisorAssignTo, supervisorAssignSaving, setSupervisorAssignSaving,
  } = useStateApproval();

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

  const emptyForm = buatFormKosong();
  const [formData, setFormData] = useState(emptyForm);
  const fd = (patch: Partial<typeof emptyForm>) => setFormData(prev => ({ ...prev, ...patch }));

  const {
    daftarProyekLama, hasilCarianProyek, mulaiBuatReminder, mulaiRequestJadwal, konfirmasiProyekLama,
  } = useProyekLama({
    buatUntukGuest, carianProyek, emptyForm, praPilihProyek, reminders, setBuatUntukGuest, setCarianProyek, setEditingReminder,
    setExtraDates, setFormData, setLangkahBuat, setPraFillGuest, setPraPilihProyek, setProyekLamaTerpilih, setShowFormModal,
    setShowRequestModal,
  });

  const [filterStatus, setFilterStatus]     = useState<Status | 'all'>('all');
  const [filterYear, setFilterYear]         = useState<string>('all');
  const [searchProject, setSearchProject]   = useState('');
  const [searchSales, setSearchSales]       = useState('');

  useEffect(() => {
    const user = getSession<TeamUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    setLoginTime(Date.now());

    Promise.all([
      fetchTeamUsers(),
      fetchGuestUsers(),
      fetchPTSCabangUsers(),
      fetchRemindersQuiet(user),
    ]).then(() => {
      setAppReady(true);
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

    const ch = supabase.channel('reminders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
        const u = getSession<TeamUser>() ?? user;
        fetchRemindersQuiet(u);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

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

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN.MANAGER).maybeSingle()
      .then((res: { data: { value: unknown } | null }) => { const v = res.data?.value; if (v) setManagerUserId(String(v).replace(/^"|"$/g, '')); });
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.from('users').select('jabatan, is_internal_sales').eq('id', currentUser.id).maybeSingle()
      .then((res: { data: { jabatan: string | null; is_internal_sales: boolean | null } | null }) => {
        setMyJabatan(res.data?.jabatan ?? '');
        setMyIsInternalSales(!!res.data?.is_internal_sales);
      });
  }, [currentUser?.id]);

  const { fetchTeamUsers, fetchGuestUsers, fetchPTSCabangUsers } = useMuatPengguna({ setGuestUsers, setPtsCabangUsers, setTeamUsers });

  const { fetchRemindersForUser, fetchRemindersQuiet, fetchReminders } = useMuatJadwal({ currentUser, managerUserId, setFetchError, setListLoading, setReminders });

  const [syncing, setSyncing] = useState<string | null>(null);

  const { syncKeIncentive } = siapkanSinkronInsentif({ setSyncing, notify, fetchRemindersQuiet, currentUser });

  const {
    resolveGrupInsentif, cariProyekSerupa, handleSave,
  } = useSimpanJadwal({
    bulkTarget, currentUser, editingReminder, emptyForm, extraDates, fetchRemindersQuiet, formData, guestUsers, notify,
    progressTimelinePayload, proyekLamaTerpilih, reminders, setBulkTarget, setEditingReminder, setExtraDates, setFormData,
    setProyekLamaTerpilih, setSaving, setShowFormModal, setTanyaLanjutan, setView, syncNewRemindersToProgress, teamUsers,
  });

  const {
    handleDelete, openDeleteModal, handleStatusChange, handleConfirmStatusUpdate, bukaEditDetailPelaksanaan, handleModeConfirm,
    handleResendFormReview,
  } = useAksiStatus({
    bastDate, controllerBrand, currentUser, deleteTarget, detailReminder, displayType, fetchRemindersQuiet, guestUsers,
    installerDaerah, installerName, installerUserId, modeEditSaja, modePenyelesaian, notify, pendingPhotoUrl, pendingStatus,
    reminders, requiresControllerAuto, requiresMiddleware, setBastDate, setControllerBrand, setDeleteConfirmText, setDeleteTarget,
    setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja,
    setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware,
    setResendingFormReview, setSavingMode, setShowDeleteModal, setShowModeModal, setStatusPhoto, setStatusPhotoPreview,
    setUpdatingStatus, statusPhoto,
  });

  const {
    availableYears, filteredReminders, groupedReminders, todayCount, pendingCount, doneCount, totalCount, sourceReminders,
    projectPieData, salesPieData, teamPtsPieData, productPieData, isAdmin, teamUsersDitawarkan, isManager, canApproveAssign,
    isMyReviewStage, bolehEditReminder, canInternalApprove, canAddReminder, isGuest,
  } = useTurunanJadwal({
    currentUser, filterCategory, filterStatus, filterYear, managerUserId, productFilter, reminders, searchDivisionSales,
    searchProduct, searchProject, searchSales, searchTeamHandler, selectedCalDay, teamUsers,
  });

  const { jalankanBulkDelete, toggleSelectId, toggleSelectAll } = useAksiMassalJadwal({ filteredReminders, notify, selectedIds, setBulkConfirm, setBulkDeleting, setReminders, setSelectMode, setSelectedIds });

  const {
    openEdit, handleReschedule, handleSendWA, handleExportExcel,
  } = useAksiJadwal({
    currentUser, fetchRemindersQuiet, filteredReminders, notify, reminders, rescheduleTarget, setDetailReminder,
    setEditingReminder, setExtraDates, setFormData, setRescheduleTarget, setSendingWA, setShowFormModal,
  });

  useEffect(() => {
    if (!isGuest || !currentUser?.full_name) return;
    hitungReviewMenggantung(currentUser.full_name)
      .then(n => { setPendingReviewCount(n); setJumlahReviewSiap(true); });
  }, [isGuest, currentUser?.full_name]);

  useEffect(() => {
    if (!currentUser || searchParams.get('buat') !== '1' || pintasanTerpakai.current) return;
    if (isGuest) {
      if (!jumlahReviewSiap) return;
      pintasanTerpakai.current = true;
      if (pendingReviewCount === 0) { mulaiRequestJadwal(); return; }
      setToast({ type: 'error', msg: `Selesaikan dulu ${pendingReviewCount} form review Demo/BAST yang belum dinilai.` });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    if (canAddReminder) {
      pintasanTerpakai.current = true;
      mulaiBuatReminder();
    }
  }, [searchParams, currentUser, isGuest, jumlahReviewSiap, pendingReviewCount, canAddReminder]);

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

  useEffect(() => {
    if (!approveTarget) { setApproveSupervisors([]); return; }
    const t = approveTarget as { progress_start_date?: string | null; progress_target_date?: string | null };
    setApproveStart(t.progress_start_date ?? '');
    setApproveTarget2(t.progress_target_date ?? '');
    resolveSupervisorsForProductType(approveTarget.product_type).then(setApproveSupervisors);
  }, [approveTarget]);

  const {
    handleRequestJadwal, handleInternalApprove, handleInternalReject, handleInternalRejectConfirm, handleAdminReject,
    handleAdminRejectConfirm, handleApproveRoute, handleApproveAssign, openSupervisorAssign, handleSupervisorAssignConfirm,
  } = useAlurPersetujuan({
    adminRejectReason, adminRejectTarget, approveAssignTo, approveBatchSiblings, approveDate, approveStart, approveSupervisors,
    approveTarget, approveTarget2, approveTime, currentUser, fetchRemindersQuiet, guestUsers, internalRejectReason,
    internalRejectTarget, notify, proyekLamaTerpilih, resolveGrupInsentif, setAdminRejectReason, setAdminRejectSaving,
    setAdminRejectTarget, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveRouteSaving, setApproveSaving,
    setApproveSupervisors, setApproveTarget, setApproveTime, setCurrentUser, setDetailReminder, setInternalApproveSaving,
    setInternalApproveTarget, setInternalRejectReason, setInternalRejectSaving, setInternalRejectTarget, setProyekLamaTerpilih,
    setSaving, setShowRequestModal, setSupervisorAssignBatchSiblings, setSupervisorAssignSaving, setSupervisorAssignTarget,
    setSupervisorAssignTo, supervisorAssignBatchSiblings, supervisorAssignTarget, supervisorAssignTo, syncNewRemindersToProgress,
    teamUsers,
  });

  const perluAksiSaya = hitungPerluAksi(reminders, currentUser, isAdmin, isManager, isMyReviewStage);

  const myActiveReminders = perluAksiSaya.map(x => x.r);

  const handleLogout = () => {
    setSelectMode(false); setSelectedIds(new Set()); setFilterStatus('all'); setFilterYear('all'); setFilterCategory('all');
    setSearchProject(''); setSearchSales(''); setSearchDivisionSales('');
    setSearchTeamHandler(''); setSearchProduct(''); setProductFilter(null);
    setSelectedCalDay(null);
    clearSession();
    setCurrentUser(null); setLoginTime(null);
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = '/dashboard';
  };

  const konteksJadwal: NilaiKonteksJadwal = {
    sesi: { currentUser, isAdmin, isGuest, isManager },
    izin: { bolehEditReminder, canApproveAssign, canInternalApprove, isMyReviewStage },
    data: { fetchError, fetchReminders, filteredReminders, groupedReminders, guestUsers, listLoading, reminders, setFetchError },
    ringkasan: { doneCount, pendingCount, productPieData, projectPieData, salesPieData, teamPtsPieData, todayCount, totalCount },
    filter: { availableYears, filterCategory, filterStatus, filterYear, productFilter, searchDivisionSales, searchProduct, searchProject, searchSales, searchTeamHandler, selectedCalDay,
      setFilterCategory, setFilterStatus, setFilterYear, setProductFilter, setSearchDivisionSales, setSearchProduct, setSearchProject, setSearchSales, setSearchTeamHandler,
      setSelectedCalDay },
    tampilan: { calOnlyDay, calendarMonth, setCalOnlyDay, setCalendarMonth, view },
    pilih: { bulkDeleting, selectMode, selectedIds, setBulkConfirm, setSelectMode, setSelectedIds, toggleSelectAll },
    aksi: { handleAdminReject, handleExportExcel, handleInternalReject, handleResendFormReview, handleSendWA, openDeleteModal, openEdit, openSupervisorAssign, resendingFormReview,
      sendingWA, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveTarget, setApproveTime, setDetailReminder, setInternalApproveTarget, setRescheduleTarget,
      syncKeIncentive, syncing },
    detail: { bastDate, bukaEditDetailPelaksanaan, controllerBrand, displayType, handleConfirmStatusUpdate, handleModeConfirm, installerDaerah, installerName, installerUserId, modeEditSaja,
      modePenyelesaian, pendingStatus, daftarCabang: ptsCabangUsers, requiresControllerAuto, requiresMiddleware, savingMode, setBastDate, setControllerBrand, setDisplayType,
      setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl,
      setPendingStatus: (v: Status | null) => { setPendingStatus(v); if (v) setModeEditSaja(false); }, setRequiresControllerAuto, setRequiresMiddleware,
      setShowModeModal: (v: boolean) => { setShowModeModal(v); if (!v) setModeEditSaja(false); }, setShowRiwayat, setStatusPhoto, setStatusPhotoPreview, showModeModal, showRiwayat,
      statusPhoto, statusPhotoPreview, statusPhotoRef, updatingStatus },
  };
  return {
    appReady, konteksJadwal, toast, rescheduleTarget, setRescheduleTarget, handleReschedule, showRequestModal, currentUser,
    myIsInternalSales, guestUsers, praFillGuest, setShowRequestModal, setProyekLamaTerpilih, setPraFillGuest, handleRequestJadwal, internalRejectTarget,
    internalRejectReason, setInternalRejectReason, internalRejectSaving, handleInternalRejectConfirm, setInternalRejectTarget, adminRejectTarget, adminRejectReason, setAdminRejectReason,
    adminRejectSaving, handleAdminRejectConfirm, setAdminRejectTarget, internalApproveTarget, internalApproveSaving, setInternalApproveTarget, handleInternalApprove, approveTarget,
    canApproveAssign, approveBatchSiblings, approveAssignTo, setApproveAssignTo, approveDate, setApproveDate, approveTime, setApproveTime,
    approveSupervisors, approveRouteSaving, handleApproveRoute, approveStart, setApproveStart, approveTarget2, setApproveTarget2, approveSaving,
    handleApproveAssign, teamUsersDitawarkan, setApproveTarget, setApproveBatchSiblings, supervisorAssignTarget, supervisorAssignBatchSiblings, supervisorAssignTo, setSupervisorAssignTo,
    supervisorAssignSaving, handleSupervisorAssignConfirm, setSupervisorAssignTarget, setSupervisorAssignBatchSiblings, showDeleteModal, deleteTarget, deleteConfirmText, setDeleteConfirmText,
    setShowDeleteModal, setDeleteTarget, handleDelete, bulkConfirm, selectedIds, setBulkConfirm, jalankanBulkDelete, tanyaLanjutan,
    setTanyaLanjutan, resolveGrupInsentif, langkahBuat, buatUntukGuest, setLangkahBuat, setShowFormModal, carianProyek, setCarianProyek,
    praPilihProyek, setPraPilihProyek, hasilCarianProyek, reminders, konfirmasiProyekLama, showFormModal, editingReminder, proyekLamaTerpilih,
    formData, setFormData, saving, bulkTarget, setBulkTarget, extraDates, setExtraDates, setEditingReminder,
    emptyForm, handleSave, isAdmin, isManager, teamUsers, showNotificationPopup, myReminders, setShowNotificationPopup,
    setDetailReminder, showBellPopup, myActiveReminders, perluAksiSaya, setShowBellPopup, detailReminder, canAddReminder, isGuest,
    mulaiBuatReminder, mulaiRequestJadwal, pendingReviewCount, view,
  };
}
