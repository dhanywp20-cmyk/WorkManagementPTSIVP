"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { BARIS_PER_HALAMAN } from '@/components/shared';
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isPimpinan } from "@/lib/pimpinan";
import { clearSession, getSession } from "@/lib/auth";
import { hasFullAccess } from "@/lib/constants";

import {
  User, TeamMember, Ticket, OverdueSetting, getDeadline as getDeadlineShared,
  isTicketOverdue as isTicketOverdueShared, getOverdueSetting as getOverdueSettingShared,
  getWarrantyInfo as getWarrantyInfoShared, bolehUpdateTicket as bolehUpdateTicketShared, JEDA_DATA_PENDUKUNG_MS,
  TAHUN_TERBARU, rentangTiket,
} from "./_components/shared";
import { NewTicketModal, type NewTicketForm } from "./_components/NewTicketModal";
import { getJakartaDateString, formTiketAwal, formAktivitasAwal, formPenggunaAwal, formSandiAwal } from "./_components/form-awal-tiket";
import { LapisanMemuatTicket } from "./_components/LapisanMemuatTicket";
import { GayaTicketing } from "./_components/GayaTicketing";
import { usePengaturanOverdue } from "./_components/usePengaturanOverdue";
import { tiketNotifikasiSaya, useTiketMenunggu } from "./_components/tiket-saya";
import {
  OverdueSettingModal, ReopenPTSModal, ReopenServicesModal, RejectModal, DeleteModal,
} from "./_components/SimpleActionModals";
import {
  BulkDeleteConfirmModal, ServicesApprovalModal, ReminderScheduleModal, SupervisorAssignModal,
} from "./_components/AssignApprovalModals";
import { AccountSettingsModal } from "./_components/AccountSettingsModal";
import { ActivitySummaryModal } from "./_components/ActivitySummaryModal";
import { AdminEditModal } from "./_components/AdminEditModal";
import { ApprovalModal } from "./_components/ApprovalModal";
import { TicketDetailPopup } from "./_components/TicketDetailPopup";
import { ambilTiketTertentu, ambilTiketUntuk } from "./_components/data-ticket";
import { Toast, ConfirmDialog, type ConfirmState } from "@/components/shared";
import { useApproveTicket } from './_components/useApproveTicket';
import { useTugaskanSupervisor } from './_components/useTugaskanSupervisor';
import { useEditAdminTicket } from './_components/useEditAdminTicket';
import { useSelesaiTicket } from './_components/useSelesaiTicket';
import { useTambahAktivitas } from './_components/useTambahAktivitas';
import { useServicesTicket } from './_components/useServicesTicket';
import { useBuatTicket } from './_components/useBuatTicket';
import { useAkunTicketing } from './_components/useAkunTicketing';
import { useHapusTicket } from './_components/useHapusTicket';
import { useTolakBukaUlang } from './_components/useTolakBukaUlang';
import { useDaftarTicket } from './_components/useDaftarTicket';
import { useAksiMassalTicket } from './_components/useAksiMassalTicket';
import { useBukaTicket } from './_components/useBukaTicket';
import { PopupDaftarNotifikasi } from './_components/PopupDaftarNotifikasi';
import { PopupNotifikasiBaru } from './_components/PopupNotifikasiBaru';
import { IsiTicketing } from './_components/IsiTicketing';
import { KepalaTicketing } from './_components/KepalaTicketing';
import { useEfekLiveTicketing } from './_components/useEfekLiveTicketing';
import { KonteksTicket, type NilaiKonteksTicket } from './_components/konteks-ticket';

function TicketingSystemInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketListRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginTime, setLoginTime] = useState<number | null>(null);
  const isManagerPTS = hasFullAccess(currentUser);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const ticketsRef = useRef(tickets); ticketsRef.current = tickets;
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [overdueSettings, setOverdueSettings] = useState<OverdueSetting[]>([]);
  const [showOverdueSetting, setShowOverdueSetting] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenTargetTicket, setReopenTargetTicket] = useState<Ticket | null>(null);
  const [reopenAssignee, setReopenAssignee] = useState("");
  const [reopenNotes, setReopenNotes] = useState("");
  const [reopenServicesTarget, setReopenServicesTarget] = useState<Ticket | null>(null);
  const [reopeningServices, setReopeningServices] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetTicket, setRejectTargetTicket] = useState<Ticket | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetTicket, setDeleteTargetTicket] = useState<Ticket | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [overdueTargetTicket, setOverdueTargetTicket] = useState<Ticket | null>(null);
  const [overdueForm, setOverdueForm] = useState({ due_hours: "48" });
  const [handlerFilter, setHandlerFilter] = useState<string | null>(null);
  const [salesDivisionFilter, setSalesDivisionFilter] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [searchProduct, setSearchProduct] = useState("");
  const [showReminderSchedule, setShowReminderSchedule] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalTicket, setApprovalTicket] = useState<Ticket | null>(null);
  const [approvalAssignee, setApprovalAssignee] = useState("");
  const [approvalAssignees, setApprovalAssignees] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [supAssignTicket, setSupAssignTicket] = useState<Ticket | null>(null);
  const [adminEditTicket, setAdminEditTicket] = useState<Ticket | null>(null);
  const [adminEditForm,   setAdminEditForm]   = useState<Record<string, unknown>>({});
  const [adminRerouteTo,  setAdminRerouteTo]  = useState('');
  const [adminEditSaving, setAdminEditSaving] = useState(false);
  const [supAssignTo, setSupAssignTo] = useState("");
  const [supAssignSaving, setSupAssignSaving] = useState(false);
  const [projectReminders, setProjectReminders] = useState<Record<string, { due_date: string; assign_name: string; assigned_to: string; category: string; warranty_years?: number | null }[]>>({});
  const [showServicesApprovalModal, setShowServicesApprovalModal] = useState(false);
  const [servicesApprovalTicket, setServicesApprovalTicket] = useState<Ticket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showTicketDetailPopup, setShowTicketDetailPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string|null>(null);
  const [uploading, setUploading] = useState(false);
  const [showLoadingPopup, setShowLoadingPopup] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [searchProject, setSearchProject] = useState("");
  const [searchSalesName, setSearchSalesName] = useState("");
  const [filterYear, setFilterYear] = useState<string>(TAHUN_TERBARU);
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedHandlerTeam, setSelectedHandlerTeam] = useState<"PTS" | "Services">("PTS");

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchProject(q);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('buat') === '1') setShowNewTicket(true);
  }, [searchParams]);

  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current || ticketsLoading || !currentUser) return;
    const openId = searchParams.get('open');
    if (!openId) return;
    sudahBukaDariNotif.current = true;
    const buka = (t: Ticket) => { setSelectedTicket(t); setShowTicketDetailPopup(true); };
    const target = tickets.find(t => t.id === openId);
    if (target) { buka(target); return; }
    const pesanTidakAda = 'Ticket tidak ditemukan atau di luar akses Anda.';
    if (!/^[0-9a-f-]{36}$/i.test(openId) || (currentUser.role === 'guest' && !isPimpinan(currentUser))) {
      notify('error', pesanTidakAda);
      return;
    }
    ambilTiketTertentu(currentUser, [openId])
      .then(([t]) => (t ? buka(t) : notify('error', pesanTidakAda)))
      .catch(() => notify('error', 'Gagal membuka ticket. Coba lagi.'));
  }, [searchParams, tickets, ticketsLoading, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Ticket[]>([]);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showActivitySummary, setShowActivitySummary] = useState(false);
  const [summaryTicket, setSummaryTicket] = useState<Ticket | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [newMapping, setNewMapping] = useState({ guestUsername: "", projectName: "" });
  const ITEMS_PER_PAGE = BARIS_PER_HALAMAN;
  const [currentPage, setCurrentPage] = useState(1);

  const [newTicket, setNewTicket] = useState<NewTicketForm>(formTiketAwal());

  const [newActivity, setNewActivity] = useState(formAktivitasAwal());

  const [newUser, setNewUser] = useState(formPenggunaAwal());

  const [changePassword, setChangePassword] = useState(formSandiAwal());

  const checkSessionTimeout = () => {
    if (!getSession()) {
      clearSession();
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = "/dashboard";
    }
  };

  const getDeadline = (ticket: Ticket) => getDeadlineShared(ticket, overdueSettings);
  const isTicketOverdue = (ticket: Ticket) => isTicketOverdueShared(ticket, overdueSettings);
  const getOverdueSetting = (ticketId: string) => getOverdueSettingShared(ticketId, overdueSettings);

  const { fetchOverdueSettings, saveOverdueSetting, deleteOverdueSetting } = usePengaturanOverdue({ currentUser, getOverdueSetting, notify, overdueForm,
    overdueTargetTicket, setOverdueForm, setOverdueSettings, setOverdueTargetTicket, setShowOverdueSetting });

  const getNotifications = () => tiketNotifikasiSaya(currentUser, teamMembers, tickets, isTicketOverdue);

  const handleLogout = () => {
    setCurrentUser(null); setLoginTime(null); setSelectedTicket(null);
    setSelectMode(false); setSelectedIds(new Set()); setHandlerFilter(null); setSalesDivisionFilter(null); setProductFilter(null);
    setSearchProduct(""); setSearchProject(""); setSearchSalesName("");
    setFilterYear(TAHUN_TERBARU); setFilterStatus("All"); setSelectedHandlerTeam("PTS");
    clearSession();
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = "/dashboard";
  };

  const pendukungDimuat = useRef(0);
  const fetchData = async (userOverride?: User | null, silent = false) => {
    try {
      if (!silent) setTicketsLoading(true);
      const rentang = rentangTiket(filterYearRef.current);
      const perluPendukung = !silent || Date.now() - pendukungDimuat.current > JEDA_DATA_PENDUKUNG_MS;
      const activeUser = userOverride !== undefined ? userOverride : currentUser;
      const tiketDimuat = ambilTiketUntuk(activeUser, rentang);
      tiketDimuat.catch(() => {  });
      const [membersData, usersData] = perluPendukung ? await Promise.all([
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, bisa_ditugaskan").in("role", ["team", "team_pts"]).order("full_name"),
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, is_internal_sales"),
      ]) : [{ data: null }, { data: null }];
      let anggotaTim: TeamMember[] | null = null;
      if (membersData.data) {
        anggotaTim = (membersData.data as any[]).map((u: any) => ({
          id: u.id,
          name: u.full_name,
          username: u.username,
          photo_url: "",
          role: u.role,
          team_type: u.team_type || "Team PTS IVP",
          phone_number: u.phone_number,
          jabatan: u.jabatan,
          bisa_ditugaskan: u.bisa_ditugaskan,
        }));
      }
      const { tickets: daftarTiket, periksaPilihan } = await tiketDimuat;
      setTickets(daftarTiket);
      if (periksaPilihan && selectedTicket && !daftarTiket.find((t: Ticket) => t.id === selectedTicket.id)) setSelectedTicket(null);
      if (anggotaTim) setTeamMembers(anggotaTim);
      if (usersData.data) setUsers(usersData.data);
      if (!silent) { setLoading(false); setTicketsLoading(false); }
      else { setLoading(false); }
      if (perluPendukung) {
        if (membersData.data && usersData.data) pendukungDimuat.current = Date.now();
        fetchProjectReminders();
      }
    } catch (err: any) {
      setLoading(false);
      if (!silent) { setTicketsLoading(false); setFetchError(err?.message ?? 'Gagal memuat data. Coba refresh halaman.'); }
    }
  };

  const { createTicket } = useBuatTicket({ currentUser, fetchData, getJakartaDateString, isManagerPTS, newTicket, notify, setLoadingMessage, setNewTicket, setShowLoadingPopup, setShowNewTicket, setUploading, teamMembers, users });

  const fetchProjectReminders = async (_ticketList?: Ticket[]) => {
    try {
      const { data } = await supabase
        .from("reminders")
        .select("project_name, due_date, assign_name, assigned_to, category, warranty_years")
        .in("category", ["Konfigurasi", "Konfigurasi & Training"])
        .eq("status", "done");
      if (!data) return;
      const map: Record<string, { due_date: string; assign_name: string; assigned_to: string; category: string; warranty_years?: number | null }[]> = {};
      data.forEach((r: any) => {
        const key = (r.project_name || "").trim().toLowerCase();
        if (!map[key]) map[key] = [];
        map[key].push({ due_date: r.due_date, assign_name: r.assign_name || "-", assigned_to: r.assigned_to || "-", category: r.category, warranty_years: r.warranty_years ?? null });
      });
      setProjectReminders(map);
    } catch { }
  };

  const getWarrantyInfo = (projectName: string) => getWarrantyInfoShared(projectName, projectReminders);

  const selesaikanSatuApproval = (ticketId: string) => {
    setApprovalAssignees(prev => {
      const sisa = { ...prev };
      delete sisa[ticketId];
      return sisa;
    });
    setApprovalTicket(null);
    setApprovalAssignee("");
    const masihAdaLain = pendingApprovalTickets.some(t => t.id !== ticketId);
    if (!masihAdaLain) setShowApprovalModal(false);
  };

  const { approveTicket, jalankanApproveTicket } = useApproveTicket({ approvalAssignee, approvalAssignees, approvalTicket, currentUser, fetchData, notify, selesaikanSatuApproval, setApprovingId, setUploading, teamMembers, users });

  const { currentUserTeamType, pendingApprovalTickets, pendingServicesApprovalTickets } = useTiketMenunggu({ currentUser, isManagerPTS, teamMembers, tickets });

  const { muatLogPenuh, denganLogPenuh, bukaDetailTicket, bukaRingkasanAktivitas, bukaApprovalUntukTicket, bukaReopenTicket, bukaDeleteTicket, bukaOverdueSetting } = useBukaTicket({ fetchProjectReminders, getOverdueSetting, pendingApprovalTickets, setApprovalAssignee, setApprovalAssignees, setApprovalTicket, setDeleteConfirmText, setDeleteTargetTicket, setOverdueForm, setOverdueTargetTicket, setReopenAssignee, setReopenNotes, setReopenTargetTicket, setSelectedTicket, setShowActivitySummary, setShowApprovalModal, setShowDeleteModal, setShowOverdueSetting, setShowReopenModal, setShowTicketDetailPopup, setSummaryTicket });

  const { handleSupervisorAssignTicket } = useTugaskanSupervisor({ currentUser, fetchData, notify, setSupAssignSaving, setSupAssignTicket, setSupAssignTo, supAssignTicket, supAssignTo, teamMembers });

  const { bukaAdminEdit, simpanAdminEdit } = useEditAdminTicket({ adminEditForm, adminEditTicket, adminRerouteTo, currentUser, fetchData, notify, setAdminEditForm, setAdminEditSaving, setAdminEditTicket, setAdminRerouteTo, teamMembers });

  const { deleteTicket } = useHapusTicket({ currentUser, deleteTargetTicket, fetchData, fetchOverdueSettings, getOverdueSetting, notify, setDeleteConfirmText, setDeleteTargetTicket, setLoadingMessage, setShowDeleteModal, setShowLoadingPopup, setUploading });

  const { kabarkanTicketSelesai, tutupJadwalTicket } = useSelesaiTicket({ currentUser, notify });

  const { rejectTicket, confirmReject, reopenTicket, reopenServicesTicket } = useTolakBukaUlang({ currentUser, currentUserTeamType, fetchData, notify, rejectReason, rejectTargetTicket, reopenAssignee, reopenNotes, reopenServicesTarget, reopenTargetTicket, setLoadingMessage, setRejectReason, setRejectTargetTicket, setReopenAssignee, setReopenNotes, setReopenServicesTarget, setReopenTargetTicket, setReopeningServices, setSelectedTicket, setShowLoadingPopup, setShowRejectModal, setShowReopenModal, setShowTicketDetailPopup, setUploading, teamMembers, tutupJadwalTicket, users });

  const { addActivity } = useTambahAktivitas({ currentUser, fetchData, fetchOverdueSettings, getOverdueSetting, kabarkanTicketSelesai, newActivity, notify, selectedTicket, setLoadingMessage, setNewActivity, setSelectedTicket, setShowLoadingPopup, setShowUpdateForm, setTickets, setUploading, teamMembers, tutupJadwalTicket });

  const { createUser, updatePassword } = useAkunTicketing({ changePassword, fetchData, newUser, notify, selectedUserForPassword, setChangePassword, setNewUser, setSelectedUserForPassword, users });

  const { filteredTickets, totalPages, paginatedTickets, stats, salesDivisionStats, productStats, tahunTersedia, setTahunTersedia, availableYears, uniqueProjectNames, penugasAdmin, teamPTSMembers, teamServicesMembers, supervisorMembers } = useDaftarTicket({ ITEMS_PER_PAGE, currentPage, currentUser, currentUserTeamType, filterStatus, filterYear, handlerFilter, isTicketOverdue, overdueSettings, productFilter, salesDivisionFilter, searchProduct, searchProject, searchSalesName, setCurrentPage, teamMembers, tickets });

  const { toggleSelectId, toggleSelectAll, jalankanEksporExcel, jalankanCetakTicket, jalankanBulkDelete } = useAksiMassalTicket({ currentUserTeamType, denganLogPenuh, filteredTickets, isTicketOverdue, muatLogPenuh, notify, selectedIds, setBulkConfirm, setBulkDeleting, setSelectMode, setSelectedIds, setTickets, stats, tickets });

  useEffect(() => {
    const user = getSession();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user as any);
    setLoginTime(Date.now());
    fetchData(user as any);
  }, []);

  useEffect(() => {
    if (currentUser && teamMembers.length > 0) {
      const member = teamMembers.find((m) => m.username === currentUser.username);
      const isServices = member?.team_type === "Team Services";
      if (member) setNewActivity((prev) => ({ ...prev, handler_name: member.name, new_status: isServices ? "Pending" : prev.new_status }));
      else setNewActivity((prev) => ({ ...prev, handler_name: currentUser.full_name }));
    }
  }, [currentUser, teamMembers]);

  useEffect(() => {
    if (currentUser && tickets.length > 0 && currentUser?.role !== "guest") {
      const notifs = getNotifications();
      setNotifications(notifs);
      if (notifs.length > 0 && !showNotificationPopup) setShowNotificationPopup(true);
    }
  }, [tickets, currentUser]);

  useEffect(() => {
    const interval = setInterval(() => checkSessionTimeout(), 60000);
    return () => clearInterval(interval);
  }, [loginTime]);

  useEffect(() => {
    if (currentUser) fetchOverdueSettings();
  }, [currentUser]);

  const filterYearRef = useRef(filterYear);
  useEffect(() => { filterYearRef.current = filterYear; }, [filterYear]);

  useEffect(() => { if (currentUser) fetchData(); }, [currentUser]);
  useEffect(() => {
    if (currentUser) fetchData(currentUser, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear]);

  useEfekLiveTicketing({ currentUser, fetchData, overdueSettings, setSelectedTicket, setTickets, tickets, ticketsRef });

  const canCreateTicket = !isPimpinan(currentUser);
  const bolehUpdateTicket = (t: Ticket): boolean => bolehUpdateTicketShared(t, currentUser);
  const canAccessAccountSettings = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const canApproveAssign = canAccessAccountSettings || isManagerPTS;
  const canManageTickets = canApproveAssign;

  const { approveServicesTicket, rejectServicesTicket } = useServicesTicket({ currentUser, fetchData, notify, setConfirmState, setLoadingMessage, setServicesApprovalTicket, setShowLoadingPopup, setShowServicesApprovalModal, setUploading, users });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-fixed" style={{ background: 'var(--latar-halaman)' }}>
        <div className="bg-white/75 p-8 rounded-2xl shadow-2xl">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
          <p className="mt-4 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  const konteksTicket: NilaiKonteksTicket = {
    sesi: { currentUser, currentUserTeamType, teamMembers, users },
    izin: { bolehUpdateTicket, canApproveAssign, canManageTickets },
    data: { fetchData, fetchError, filteredTickets, getOverdueSetting, getWarrantyInfo, isTicketOverdue, loading, paginatedTickets, setFetchError, ticketListRef, tickets,
      ticketsLoading, uploading },
    ringkasan: { productStats, salesDivisionStats, stats },
    filter: { availableYears, filterStatus, filterYear, handlerFilter, productFilter, salesDivisionFilter, searchProduct, searchProject, searchSalesName, selectedHandlerTeam,
      setFilterStatus, setFilterYear, setHandlerFilter, setProductFilter, setSalesDivisionFilter, setSearchProduct, setSearchProject, setSearchSalesName, setSelectedHandlerTeam },
    halaman: { ITEMS_PER_PAGE, currentPage, setCurrentPage, totalPages },
    pilih: { bulkDeleting, selectMode, selectedIds, setBulkConfirm, setSelectMode, setSelectedIds, toggleSelectAll, toggleSelectId },
    aksi: { bukaApprovalUntukTicket, bukaDeleteTicket, bukaDetailTicket, bukaOverdueSetting, bukaReopenTicket, bukaRingkasanAktivitas, jalankanCetakTicket, jalankanEksporExcel },
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{ background: 'var(--latar-halaman)', backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(255,255,255,0.08)" }} />
      {toast && <Toast notif={toast} />}
      <div className="relative flex flex-col flex-1 overflow-hidden">

        <LapisanMemuatTicket showLoadingPopup={showLoadingPopup} loadingMessage={loadingMessage} uploading={uploading} />

        <KepalaTicketing
          canApproveAssign={canApproveAssign} canCreateTicket={canCreateTicket} canManageTickets={canManageTickets} currentUser={currentUser} currentUserTeamType={currentUserTeamType} fetchProjectReminders={fetchProjectReminders} notifications={notifications} pendingApprovalTickets={pendingApprovalTickets} pendingServicesApprovalTickets={pendingServicesApprovalTickets} setApprovalAssignees={setApprovalAssignees} setNewTicket={setNewTicket} setShowAccountSettings={setShowAccountSettings} setShowApprovalModal={setShowApprovalModal} setShowNewTicket={setShowNewTicket} setShowNotifications={setShowNotifications} setShowReminderSchedule={setShowReminderSchedule} setShowServicesApprovalModal={setShowServicesApprovalModal} showNewTicket={showNewTicket} showNotifications={showNotifications}
        />

        <KonteksTicket.Provider value={konteksTicket}>
          <IsiTicketing />
        </KonteksTicket.Provider>

        {bulkConfirm && (
          <BulkDeleteConfirmModal
            jumlah={selectedIds.size}
            onCancel={() => setBulkConfirm(false)}
            onConfirm={jalankanBulkDelete}
          />
        )}

        <PopupNotifikasiBaru
          currentUserTeamType={currentUserTeamType} isTicketOverdue={isTicketOverdue} notifications={notifications} setSelectedTicket={setSelectedTicket} setShowNotificationPopup={setShowNotificationPopup} setShowTicketDetailPopup={setShowTicketDetailPopup} showNotificationPopup={showNotificationPopup}
        />

        <PopupDaftarNotifikasi
          currentUserTeamType={currentUserTeamType} isTicketOverdue={isTicketOverdue} notifications={notifications} setSelectedTicket={setSelectedTicket} setShowNotifications={setShowNotifications} setShowTicketDetailPopup={setShowTicketDetailPopup} showNotifications={showNotifications}
        />

        {showTicketDetailPopup && selectedTicket && (
          <TicketDetailPopup
            selectedTicket={selectedTicket} currentUser={currentUser} currentUserTeamType={currentUserTeamType} canManageTickets={canManageTickets} users={users}
            showUpdateForm={showUpdateForm} setShowUpdateForm={setShowUpdateForm} onClose={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); }}
            bukaAdminEdit={bukaAdminEdit} getDeadline={getDeadline} getWarrantyInfo={getWarrantyInfo} bolehUpdateTicket={bolehUpdateTicket}
            setSupAssignTicket={setSupAssignTicket} setSupAssignTo={setSupAssignTo} setReopenTargetTicket={setReopenTargetTicket}
            setReopenAssignee={setReopenAssignee} setReopenNotes={setReopenNotes} setShowReopenModal={setShowReopenModal}
            setReopenServicesTarget={setReopenServicesTarget} setShowServicesApprovalModal={setShowServicesApprovalModal} newActivity={newActivity}
            setNewActivity={setNewActivity} addActivity={addActivity} uploading={uploading}
          />
        )}

        {showApprovalModal && canApproveAssign && (
          <ApprovalModal
            pendingApprovalTickets={pendingApprovalTickets}
            projectReminders={projectReminders}
            approvalAssignees={approvalAssignees}
            setApprovalAssignees={setApprovalAssignees}
            teamPTSMembers={teamPTSMembers}
            supervisorMembers={supervisorMembers}
            approvingId={approvingId}
            uploading={uploading}
            jalankanApproveTicket={jalankanApproveTicket}
            rejectTicket={rejectTicket}
            onClose={() => { setShowApprovalModal(false); setApprovalAssignees({}); setApprovalTicket(null); setApprovalAssignee(""); }}
          />
        )}

        {showServicesApprovalModal && currentUserTeamType === "Team Services" && (
          <ServicesApprovalModal
            pendingServicesApprovalTickets={pendingServicesApprovalTickets}
            uploading={uploading}
            approveServicesTicket={approveServicesTicket}
            rejectServicesTicket={rejectServicesTicket}
            onClose={() => setShowServicesApprovalModal(false)}
          />
        )}

        {showReminderSchedule && canManageTickets && (
          <ReminderScheduleModal onClose={() => setShowReminderSchedule(false)} />
        )}

        {showAccountSettings && canAccessAccountSettings && (
          <AccountSettingsModal
            newUser={newUser}
            setNewUser={setNewUser}
            createUser={createUser}
            selectedUserForPassword={selectedUserForPassword}
            setSelectedUserForPassword={setSelectedUserForPassword}
            changePassword={changePassword}
            setChangePassword={setChangePassword}
            updatePassword={updatePassword}
            users={users}
            onClose={() => setShowAccountSettings(false)}
          />
        )}

        {adminEditTicket && (
          <AdminEditModal
            adminEditTicket={adminEditTicket}
            adminRerouteTo={adminRerouteTo}
            setAdminRerouteTo={setAdminRerouteTo}
            adminEditSaving={adminEditSaving}
            supervisorMembers={supervisorMembers}
            teamPTSMembers={teamPTSMembers}
            adminEditForm={adminEditForm}
            setAdminEditForm={setAdminEditForm}
            simpanAdminEdit={simpanAdminEdit}
            onClose={() => setAdminEditTicket(null)}
          />
        )}

        {supAssignTicket && (
          <SupervisorAssignModal
            supAssignTicket={supAssignTicket}
            supAssignTo={supAssignTo}
            setSupAssignTo={setSupAssignTo}
            teamPTSMembers={teamPTSMembers}
            currentUser={currentUser}
            supAssignSaving={supAssignSaving}
            handleSupervisorAssignTicket={handleSupervisorAssignTicket}
            onClose={() => { setSupAssignTicket(null); setSupAssignTo(""); }}
          />
        )}

        {showNewTicket && canCreateTicket && (
          <NewTicketModal
            onClose={() => setShowNewTicket(false)}
            form={newTicket}
            setForm={setNewTicket}
            uploading={uploading}
            currentUser={currentUser}
            users={users}
            teamPTSMembers={teamPTSMembers}
            supervisorMembers={supervisorMembers}
            onSubmit={createTicket}
          />
        )}

        {showOverdueSetting && overdueTargetTicket && canManageTickets && (
          <OverdueSettingModal
            overdueTargetTicket={overdueTargetTicket}
            overdueForm={overdueForm}
            setOverdueForm={setOverdueForm}
            saveOverdueSetting={saveOverdueSetting}
            onClose={() => { setShowOverdueSetting(false); setOverdueTargetTicket(null); setOverdueForm({ due_hours: "48" }); }}
            punyaSettingTersimpan={!!getOverdueSetting(overdueTargetTicket.id)}
            onHapusSetting={() => { deleteOverdueSetting(overdueTargetTicket.id); setShowOverdueSetting(false); setOverdueTargetTicket(null); }}
          />
        )}

        {showReopenModal && reopenTargetTicket && (
          <ReopenPTSModal
            reopenTargetTicket={reopenTargetTicket}
            reopenAssignee={reopenAssignee}
            setReopenAssignee={setReopenAssignee}
            reopenNotes={reopenNotes}
            setReopenNotes={setReopenNotes}
            teamPTSMembers={teamPTSMembers}
            reopenTicket={reopenTicket}
            uploading={uploading}
            onClose={() => { setShowReopenModal(false); setReopenTargetTicket(null); setReopenAssignee(""); setReopenNotes(""); }}
          />
        )}

        {reopenServicesTarget && (
          <ReopenServicesModal
            reopenServicesTarget={reopenServicesTarget}
            reopeningServices={reopeningServices}
            reopenServicesTicket={reopenServicesTicket}
            onClose={() => setReopenServicesTarget(null)}
          />
        )}

        {showActivitySummary && summaryTicket && (
          <ActivitySummaryModal
            summaryTicket={summaryTicket}
            users={users}
            getWarrantyInfo={getWarrantyInfo}
            onClose={() => { setShowActivitySummary(false); setSummaryTicket(null); }}
          />
        )}
        {showRejectModal && rejectTargetTicket && (
          <RejectModal
            rejectTargetTicket={rejectTargetTicket}
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            uploading={uploading}
            confirmReject={confirmReject}
            onClose={() => { setShowRejectModal(false); setRejectTargetTicket(null); setRejectReason(""); }}
          />
        )}

        {showDeleteModal && deleteTargetTicket && (
          <DeleteModal
            deleteTargetTicket={deleteTargetTicket}
            deleteConfirmText={deleteConfirmText}
            setDeleteConfirmText={setDeleteConfirmText}
            uploading={uploading}
            deleteTicket={deleteTicket}
            onClose={() => { setShowDeleteModal(false); setDeleteTargetTicket(null); setDeleteConfirmText(""); }}
          />
        )}

      </div>
      <GayaTicketing />
    </div>
  );
}

export default function TicketingSystem() {
  return (
    <Suspense>
      <TicketingSystemInner />
    </Suspense>
  );
}
