'use client';

import { useState, useEffect, useRef } from "react";
import { BARIS_PER_HALAMAN } from '@/components/shared';
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isPimpinan } from "@/lib/pimpinan";
import { clearSession, getSession } from "@/lib/auth/sesi";
import { hasFullAccess } from "@/lib/constants";
import {
  User, TeamMember, Ticket, OverdueSetting, getDeadline as getDeadlineShared, isTicketOverdue as isTicketOverdueShared,
  getOverdueSetting as getOverdueSettingShared, getWarrantyInfo as getWarrantyInfoShared,
  bolehUpdateTicket as bolehUpdateTicketShared, JEDA_DATA_PENDUKUNG_MS, TAHUN_TERBARU, rentangTiket,
} from './shared';
import { type NewTicketForm } from './NewTicketModal';
import { getJakartaDateString, formTiketAwal, formAktivitasAwal, formPenggunaAwal, formSandiAwal } from './form-awal-tiket';
import { usePengaturanOverdue } from './usePengaturanOverdue';
import { tiketNotifikasiSaya, useTiketMenunggu } from './tiket-saya';
import { ambilTiketTertentu, ambilTiketUntuk } from './data-ticket';
import { type ConfirmState } from "@/components/shared";
import { useApproveTicket } from './useApproveTicket';
import { useTugaskanSupervisor } from './useTugaskanSupervisor';
import { useEditAdminTicket } from './useEditAdminTicket';
import { useSelesaiTicket } from './useSelesaiTicket';
import { useTambahAktivitas } from './useTambahAktivitas';
import { useServicesTicket } from './useServicesTicket';
import { useBuatTicket } from './useBuatTicket';
import { useAkunTicketing } from './useAkunTicketing';
import { useHapusTicket } from './useHapusTicket';
import { useTolakBukaUlang } from './useTolakBukaUlang';
import { useDaftarTicket } from './useDaftarTicket';
import { useAksiMassalTicket } from './useAksiMassalTicket';
import { useBukaTicket } from './useBukaTicket';
import { useEfekLiveTicketing } from './useEfekLiveTicketing';

export function useTicketing() {
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
  const ITEMS_PER_PAGE: typeof BARIS_PER_HALAMAN = BARIS_PER_HALAMAN;
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

  const {
    muatLogPenuh, denganLogPenuh, bukaDetailTicket, bukaRingkasanAktivitas, bukaApprovalUntukTicket, bukaReopenTicket,
    bukaDeleteTicket, bukaOverdueSetting,
  } = useBukaTicket({
    fetchProjectReminders, getOverdueSetting, pendingApprovalTickets, setApprovalAssignee, setApprovalAssignees, setApprovalTicket,
    setDeleteConfirmText, setDeleteTargetTicket, setOverdueForm, setOverdueTargetTicket, setReopenAssignee, setReopenNotes,
    setReopenTargetTicket, setSelectedTicket, setShowActivitySummary, setShowApprovalModal, setShowDeleteModal,
    setShowOverdueSetting, setShowReopenModal, setShowTicketDetailPopup, setSummaryTicket,
  });

  const { handleSupervisorAssignTicket } = useTugaskanSupervisor({ currentUser, fetchData, notify, setSupAssignSaving, setSupAssignTicket, setSupAssignTo, supAssignTicket, supAssignTo, teamMembers });

  const { bukaAdminEdit, simpanAdminEdit } = useEditAdminTicket({ adminEditForm, adminEditTicket, adminRerouteTo, currentUser, fetchData, notify, setAdminEditForm, setAdminEditSaving, setAdminEditTicket, setAdminRerouteTo, teamMembers });

  const { deleteTicket } = useHapusTicket({ currentUser, deleteTargetTicket, fetchData, fetchOverdueSettings, getOverdueSetting, notify, setDeleteConfirmText, setDeleteTargetTicket, setLoadingMessage, setShowDeleteModal, setShowLoadingPopup, setUploading });

  const { kabarkanTicketSelesai, tutupJadwalTicket } = useSelesaiTicket({ currentUser, notify });

  const {
    rejectTicket, confirmReject, reopenTicket, reopenServicesTicket,
  } = useTolakBukaUlang({
    currentUser, currentUserTeamType, fetchData, notify, rejectReason, rejectTargetTicket, reopenAssignee, reopenNotes,
    reopenServicesTarget, reopenTargetTicket, setLoadingMessage, setRejectReason, setRejectTargetTicket, setReopenAssignee,
    setReopenNotes, setReopenServicesTarget, setReopenTargetTicket, setReopeningServices, setSelectedTicket, setShowLoadingPopup,
    setShowRejectModal, setShowReopenModal, setShowTicketDetailPopup, setUploading, teamMembers, tutupJadwalTicket, users,
  });

  const {
    addActivity,
  } = useTambahAktivitas({
    currentUser, fetchData, fetchOverdueSettings, getOverdueSetting, kabarkanTicketSelesai, newActivity, notify, selectedTicket,
    setLoadingMessage, setNewActivity, setSelectedTicket, setShowLoadingPopup, setShowUpdateForm, setTickets, setUploading,
    teamMembers, tutupJadwalTicket,
  });

  const { createUser, updatePassword } = useAkunTicketing({ changePassword, fetchData, newUser, notify, selectedUserForPassword, setChangePassword, setNewUser, setSelectedUserForPassword, users });

  const {
    filteredTickets, totalPages, paginatedTickets, stats, salesDivisionStats, productStats, tahunTersedia, setTahunTersedia,
    availableYears, uniqueProjectNames, penugasAdmin, teamPTSMembers, teamServicesMembers, supervisorMembers,
  } = useDaftarTicket({
    ITEMS_PER_PAGE, currentPage, currentUser, currentUserTeamType, filterStatus, filterYear, handlerFilter, isTicketOverdue,
    overdueSettings, productFilter, salesDivisionFilter, searchProduct, searchProject, searchSalesName, setCurrentPage,
    teamMembers, tickets,
  });

  const {
    toggleSelectId, toggleSelectAll, jalankanEksporExcel, jalankanCetakTicket, jalankanBulkDelete,
  } = useAksiMassalTicket({
    currentUserTeamType, denganLogPenuh, filteredTickets, isTicketOverdue, muatLogPenuh, notify, selectedIds, setBulkConfirm,
    setBulkDeleting, setSelectMode, setSelectedIds, setTickets, stats, tickets,
  });

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
  return {
    loading, currentUser, currentUserTeamType, teamMembers, users, bolehUpdateTicket, canApproveAssign, canManageTickets,
    fetchData, fetchError, filteredTickets, getOverdueSetting, getWarrantyInfo, isTicketOverdue, paginatedTickets, setFetchError,
    ticketListRef, tickets, ticketsLoading, uploading, productStats, salesDivisionStats, stats, availableYears,
    filterStatus, filterYear, handlerFilter, productFilter, salesDivisionFilter, searchProduct, searchProject, searchSalesName,
    selectedHandlerTeam, setFilterStatus, setFilterYear, setHandlerFilter, setProductFilter, setSalesDivisionFilter, setSearchProduct, setSearchProject,
    setSearchSalesName, setSelectedHandlerTeam, ITEMS_PER_PAGE, currentPage, setCurrentPage, totalPages, bulkDeleting, selectMode,
    selectedIds, setBulkConfirm, setSelectMode, setSelectedIds, toggleSelectAll, toggleSelectId, bukaApprovalUntukTicket, bukaDeleteTicket,
    bukaDetailTicket, bukaOverdueSetting, bukaReopenTicket, bukaRingkasanAktivitas, jalankanCetakTicket, jalankanEksporExcel, confirmState, setConfirmState,
    toast, showLoadingPopup, loadingMessage, canCreateTicket, fetchProjectReminders, notifications, pendingApprovalTickets, pendingServicesApprovalTickets,
    setApprovalAssignees, setNewTicket, setShowAccountSettings, setShowApprovalModal, setShowNewTicket, setShowNotifications, setShowReminderSchedule, setShowServicesApprovalModal,
    showNewTicket, showNotifications, bulkConfirm, jalankanBulkDelete, setSelectedTicket, setShowNotificationPopup, setShowTicketDetailPopup, showNotificationPopup,
    showTicketDetailPopup, selectedTicket, showUpdateForm, setShowUpdateForm, bukaAdminEdit, getDeadline, setSupAssignTicket, setSupAssignTo,
    setReopenTargetTicket, setReopenAssignee, setReopenNotes, setShowReopenModal, setReopenServicesTarget, newActivity, setNewActivity, addActivity,
    showApprovalModal, projectReminders, approvalAssignees, teamPTSMembers, supervisorMembers, approvingId, jalankanApproveTicket, rejectTicket,
    setApprovalTicket, setApprovalAssignee, showServicesApprovalModal, approveServicesTicket, rejectServicesTicket, showReminderSchedule, showAccountSettings, canAccessAccountSettings,
    newUser, setNewUser, createUser, selectedUserForPassword, setSelectedUserForPassword, changePassword, setChangePassword, updatePassword,
    adminEditTicket, adminRerouteTo, setAdminRerouteTo, adminEditSaving, adminEditForm, setAdminEditForm, simpanAdminEdit, setAdminEditTicket,
    supAssignTicket, supAssignTo, supAssignSaving, handleSupervisorAssignTicket, newTicket, createTicket, showOverdueSetting, overdueTargetTicket,
    overdueForm, setOverdueForm, saveOverdueSetting, setShowOverdueSetting, setOverdueTargetTicket, deleteOverdueSetting, showReopenModal, reopenTargetTicket,
    reopenAssignee, reopenNotes, reopenTicket, reopenServicesTarget, reopeningServices, reopenServicesTicket, showActivitySummary, summaryTicket,
    setShowActivitySummary, setSummaryTicket, showRejectModal, rejectTargetTicket, rejectReason, setRejectReason, confirmReject, setShowRejectModal,
    setRejectTargetTicket, showDeleteModal, deleteTargetTicket, deleteConfirmText, setDeleteConfirmText, deleteTicket, setShowDeleteModal, setDeleteTargetTicket,
  };
}
