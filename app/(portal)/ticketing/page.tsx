"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { ModalPortal, BARIS_PER_HALAMAN } from '@/components/shared';
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, supabaseServices } from "@/lib/supabase";
import { isPimpinan } from "@/lib/pimpinan";
import { setSession, clearSession, getSession } from "@/lib/auth";
import { adminCreateUser } from "@/lib/admin-users";
import { notifyTicketAssigned, createNotification } from "@/lib/notifications";
import { penerimaAdmin, penerimaAdminBernomor } from "@/lib/penerima-admin";
import { logAudit } from "@/lib/audit";
import { bandingkan, ringkasPerubahan, pesanWAPerubahan } from "@/lib/admin-edit";
import { isAssignablePTSTeam, bolehDitugaskanOleh, adalahAdminMurni } from "@/lib/teams";
import { hasFullAccess } from "@/lib/constants";
import { idDariNama, kutipNilai, tanpaIdentitas, cobaIdentitas } from "@/lib/identitas";
import { resolveBrandInternals, type Brand } from "@/lib/brand-routing";
import { compressImage } from "@/lib/image-compress";

import {
  sendWANotif, fetchWACCTargets,
  JABATAN_TIER, JABATAN_CC_RULES,
  SERVICES_STATUSES, ServicesStatus,
  User, TeamMember, ActivityLog, Ticket, OverdueSetting,
  SALES_DIVISIONS, formatDateTime,
  statusColors, TICKET_ADMIN_FIELDS, adalahPending,
  getDeadline as getDeadlineShared,
  isTicketOverdue as isTicketOverdueShared,
  getOverdueSetting as getOverdueSettingShared,
  getWarrantyInfo as getWarrantyInfoShared,
  bolehUpdateTicket as bolehUpdateTicketShared,
  JEDA_POLLING_MS, JEDA_GABUNG_REALTIME_MS, JEDA_DATA_PENDUKUNG_MS, MAKS_SEGAR_SEBAGIAN, KOLOM_LOG_RINGKAS, TAHUN_TERBARU, rentangTiket, RENTANG_BULAN_TIKET,
} from "./_components/shared";
import { NewTicketModal, type NewTicketForm } from "./_components/NewTicketModal";
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
import { StatsSection } from "./_components/StatsSection";
import { FilterBar } from "./_components/FilterBar";
import { TicketListBody } from "./_components/TicketListBody";
import { TicketDetailPopup } from "./_components/TicketDetailPopup";
import { appLink } from "@/lib/app-url";
import { eksporExcel } from "./_components/ekspor-excel";
import { ambilTiketTertentu, ambilTiketUntuk } from "./_components/data-ticket";
import { cetakTicket } from "./_components/cetak-ticket";
import { Toast, PageHeader, ConfirmDialog, type ConfirmState } from "@/components/shared";
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { useApproveTicket } from './_components/useApproveTicket';
import { useTugaskanSupervisor } from './_components/useTugaskanSupervisor';
import { useEditAdminTicket } from './_components/useEditAdminTicket';
import { useSelesaiTicket } from './_components/useSelesaiTicket';
import { useTambahAktivitas } from './_components/useTambahAktivitas';
import { useServicesTicket } from './_components/useServicesTicket';

function TicketingSystemInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketListRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginTime, setLoginTime] = useState<number | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  //  Salinan terbaru untuk handler realtime yang dipasang sekali (lihat efek realtime).
  const ticketsRef = useRef(tickets); ticketsRef.current = tickets;
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [overdueSettings, setOverdueSettings] = useState<OverdueSetting[]>([]);
  const [showOverdueSetting, setShowOverdueSetting] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenTargetTicket, setReopenTargetTicket] = useState<Ticket | null>(null);
  const [reopenAssignee, setReopenAssignee] = useState("");
  const [reopenNotes, setReopenNotes] = useState("");
  // C2 (docs/UX-WORKFLOW-AUDIT.md): services_status="Solved" dulu jalan buntu
  // permanen - tidak ada siapa pun (bahkan Admin) yang bisa membukanya
  // kembali. Modal reopen di atas (reopenTicket) khusus untuk sisi PTS
  // (butuh pilih assignee baru) - reopen sisi Services lebih sederhana,
  // cukup kembalikan services_status ke "Pending", jadi dibuat state &
  // handler terpisah alih-alih memaksakan satu modal untuk dua kebutuhan
  // yang berbeda bentuk.
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
  /**
   * Pilihan handler PER TICKET di modal approval, dikunci id ticket. Modal
   * menampilkan semua ticket "Waiting Approval" sekaligus, jadi satu state
   * bersama untuk banyak baris akan membuat pilihan bocor antar-ticket dan
   * ticket ke-assign ke orang yang salah.
   */
  const [approvalAssignees, setApprovalAssignees] = useState<Record<string, string>>({});
  /** Id ticket yang sedang diproses - mencegah klik ganda pada baris yang sama. */
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // Supervisor assign (tahap supervisor_assign) - Supervisor lanjut assign ke tim / sendiri
  const [supAssignTicket, setSupAssignTicket] = useState<Ticket | null>(null);
  // Panel admin "Edit Detail & Re-route" - menggantikan kebiasaan membetulkan
  // data langsung di Supabase, yang tidak meninggalkan jejak siapa mengubah apa.
  const [adminEditTicket, setAdminEditTicket] = useState<Ticket | null>(null);
  const [adminEditForm,   setAdminEditForm]   = useState<Record<string, unknown>>({});
  const [adminRerouteTo,  setAdminRerouteTo]  = useState('');
  const [adminEditSaving, setAdminEditSaving] = useState(false);
  const [supAssignTo, setSupAssignTo] = useState("");
  const [supAssignSaving, setSupAssignSaving] = useState(false);
  // State untuk referensi project dari reminder-schedule (Konfigurasi / Konfigurasi & Training)
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

  // Auto-apply filter dari Global Search (?q=...)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchProject(q);
  }, [searchParams]);

  // Pintasan "buat" dari dashboard (?buat=1)
  // Dashboard hanya menautkan; keputusan boleh-tidaknya tetap milik halaman
  // ini, supaya tidak ada dua tempat yang memutuskan hal yang sama.
  useEffect(() => {
    if (searchParams.get('buat') === '1') setShowNewTicket(true);
  }, [searchParams]);

  // Deep-link dari notifikasi (?open=<id>): buka detail ticket-nya langsung,
  // bukan cuma daftar. Ref sekali-jalan - tanpa itu, tickets yang di-refetch
  // berkala (realtime) akan membuka lagi detailnya tiap kali walau user
  // sudah menutupnya.
  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current) return;
    const openId = searchParams.get('open');
    if (!openId || tickets.length === 0) return;
    const target = tickets.find(t => t.id === openId);
    if (target) {
      sudahBukaDariNotif.current = true;
      setSelectedTicket(target);
      setShowTicketDetailPopup(true);
    }
  }, [searchParams, tickets]);
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
  //  Angka baris/halaman diambil dari konstanta bersama, tidak ditulis di
  //  sini lagi. Sebelumnya Ticketing memakai 30 sendirian sementara modul
  //  lain tidak berpaginasi sama sekali - dua perilaku berbeda untuk daftar
  //  yang sama bentuknya. Lihat components/shared/Paginasi.tsx.
  const ITEMS_PER_PAGE = BARIS_PER_HALAMAN;
  const [currentPage, setCurrentPage] = useState(1);

  const getJakartaDateString = () => {
    const now = new Date();
    const jakartaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const y = jakartaDate.getFullYear();
    const m = String(jakartaDate.getMonth() + 1).padStart(2, "0");
    const d = String(jakartaDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [newTicket, setNewTicket] = useState<NewTicketForm>({
    project_name: "",
    address: "",
    customer_phone: "",
    sales_name: "",
    sales_division: "",
    sn_unit: "",
    product: "",
    issue_case: "",
    description: "",
    assign_name: "",
    date: getJakartaDateString(),
    status: "Pending",
    current_team: "Team PTS IVP",
    photo: null as File | null,
    reminder_id: null as string | null,
    brand: undefined as Brand | undefined,
  });

  const [newActivity, setNewActivity] = useState({
    handler_name: "",
    action_taken: "",
    notes: "",
    new_status: "Pending",
    sn_unit: "",
    file: null as File | null,
    photo: null as File | null,
    assign_to_services: false,
    services_assignee: "",
    onsite_use_schedule: false,
    onsite_schedule_date: "",
    onsite_schedule_hour: "08",
    onsite_schedule_minute: "00",
    extend_days: "",   // Pending Action: perpanjang deadline overdue (jumlah hari)
  });

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    full_name: "",
    team_member: "",
    role: "team",
    team_type: "Team PTS IVP",
  });

  const [changePassword, setChangePassword] = useState({
    current: "",
    new: "",
    confirm: "",
  });

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


  const fetchOverdueSettings = async () => {
    try { const { data } = await supabase.from("overdue_settings").select("id,ticket_id,due_date,due_hours,set_by,created_at"); if (data) setOverdueSettings(data); } catch { }
  };

  const saveOverdueSetting = async () => {
    if (!overdueTargetTicket) return;
    if (!overdueForm.due_hours || parseInt(overdueForm.due_hours) < 1) { notify("error", "Isi jumlah jam overdue (minimal 1 jam)!"); return; }
    try {
      const existing = getOverdueSetting(overdueTargetTicket.id);
      const payload: any = { ticket_id: overdueTargetTicket.id, set_by: currentUser?.username || "", due_date: null, due_hours: parseInt(overdueForm.due_hours) };
      let mutErr;
      if (existing) { const r = await supabase.from("overdue_settings").update(payload).eq("id", existing.id); mutErr = r.error; }
      else { const r = await supabase.from("overdue_settings").insert([payload]); mutErr = r.error; }
      if (mutErr) { notify("error", "Gagal simpan overdue setting: " + mutErr.message); return; }
      await fetchOverdueSettings();
      setShowOverdueSetting(false);
      setOverdueForm({ due_hours: "48" });
      setOverdueTargetTicket(null);
    } catch (e: any) { notify("error", "Error: " + e.message); }
  };

  const deleteOverdueSetting = async (ticketId: string) => {
    const existing = getOverdueSetting(ticketId);
    if (!existing) return;
    const { error } = await supabase.from("overdue_settings").delete().eq("id", existing.id);
    if (error) { notify("error", "Gagal hapus overdue setting: " + error.message); return; }
    await fetchOverdueSettings();
  };

  const deleteTicket = async () => {
    if (!deleteTargetTicket) return;
    /*
      H9 (audit): dulu cuma admin/superadmin - RLS (tk_delete, lihat
      admin_atau_full_access() di database) sudah lebih dulu diperluas ke
      akun Team PTS dengan toggle "Full Access" aktif (mis. Manager PTS),
      tapi gerbang di client ini ketinggalan. Akibatnya Manager PTS menekan
      Hapus, RLS mengizinkan, TAPI baris ini menolaknya duluan dengan pesan
      "Tidak ada akses" yang salah - padahal dia memang berhak.
    */
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin' && !hasFullAccess(currentUser)) { notify("error", "Tidak ada akses untuk menghapus ticket."); return; }
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Menghapus activity logs...");
      // Delete activity logs dari kedua DB
      await supabase.from("activity_logs").delete().eq("ticket_id", deleteTargetTicket.id);
      try { await supabaseServices.from("activity_logs").delete().eq("ticket_id", deleteTargetTicket.id); } catch { }
      // Delete overdue setting jika ada
      const existingOverdue = getOverdueSetting(deleteTargetTicket.id);
      if (existingOverdue) await supabase.from("overdue_settings").delete().eq("id", existingOverdue.id);
      setLoadingMessage("Menghapus ticket...");
      //  Diperiksa - baris inilah yang menentukan berhasil-tidaknya
      //  penghapusan. RLS yang menolak menjawab 0 baris TANPA galat, dan
      //  activity_logs-nya sudah kadung terhapus di atas - kalau tickets-nya
      //  sendiri gagal terhapus, "berhasil dihapus" yang ditampilkan akan
      //  menyembunyikan ticket yatim tanpa riwayat sama sekali.
      const { data: terhapus, error: galatHapus } = await supabase.from("tickets")
        .delete().eq("id", deleteTargetTicket.id).select("id");
      if (galatHapus || !terhapus || terhapus.length === 0) {
        setShowLoadingPopup(false);
        setUploading(false);
        notify("error", "Ticket gagal dihapus. Riwayat aktivitasnya sudah terhapus - hubungi admin untuk memeriksa data ini.");
        await fetchData();
        return;
      }
      await fetchData();
      await fetchOverdueSettings();
      setLoadingMessage("✅ Ticket berhasil dihapus!");
      setTimeout(() => {
        setShowLoadingPopup(false);
        setUploading(false);
        setShowDeleteModal(false);
        setDeleteTargetTicket(null);
        setDeleteConfirmText("");
      }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Gagal hapus ticket: " + err.message);
    }
  };

  const getNotifications = () => {
    if (!currentUser) return [];
    const member = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser.username || "").toLowerCase());
    const assignedName = member ? member.name : currentUser.full_name;
    const namesToCheck = [...new Set([assignedName, currentUser.full_name].filter(Boolean))]
      .map(n => n.toLowerCase().trim());
    return tickets.filter((t) => {
      // Ticket yg di-route ke Supervisor ini (belum di-assign lanjut ke tim)
      // TIDAK punya assign_name - id ada di assigned_supervisor_id, bukan
      // nama, jadi harus dicek terpisah dari kecocokan nama di bawah. Tanpa
      // ini, ticket yg baru di-route ke Supervisor cuma nongol di badge lonceng
      // atas (dari tabel notifications terpisah) tapi tidak pernah masuk
      // daftar popup "Ticket Notifications" ini.
      const routedToMe = t.routing_status === "supervisor_assign" && t.assigned_supervisor_id === currentUser.id;
      if (routedToMe) return true;
      if (!namesToCheck.includes((t.assign_name ?? "").toLowerCase().trim())) return false;
      const overdue = isTicketOverdue(t) && t.status !== "Solved";
      const isActive = t.status !== "Solved";
      const isServicesActive = t.services_status && t.services_status !== "Solved";
      if (member?.team_type === "Team Services") return isServicesActive || overdue;
      else return isActive || overdue;
    });
  };

  const handleLogout = () => {
    setCurrentUser(null); setLoginTime(null); setSelectedTicket(null);
    setSelectMode(false); setSelectedIds(new Set()); setHandlerFilter(null); setSalesDivisionFilter(null); setProductFilter(null);
    setSearchProduct(""); setSearchProject(""); setSearchSalesName("");
    //  "All" (huruf besar) tidak pernah cocok dengan nilai penyaring mana pun -
    //  bawaannya dulu "all". Jadi reset saat logout sebenarnya tidak pernah
    //  mengembalikan penyaring tahun ke posisi semula. Sekarang memakai
    //  konstanta yang sama dengan nilai awalnya.
    setFilterYear(TAHUN_TERBARU); setFilterStatus("All"); setSelectedHandlerTeam("PTS");
    clearSession();
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = "/dashboard";
  };

  /** Kapan daftar akun & referensi garansi terakhir dimuat (lihat perluPendukung di fetchData). */
  const pendukungDimuat = useRef(0);
  const fetchData = async (userOverride?: User | null, silent = false) => {
    try {
      if (!silent) setTicketsLoading(true);
      /*
        Jendela tanggal untuk SELURUH kueri daftar di bawah - dibaca dari ref,
        bukan dari state langsung. fetchData dipanggil juga oleh polling dan
        oleh langganan realtime, yang keduanya menangkap nilai state pada saat
        efeknya dipasang; tanpa ref mereka akan selamanya memakai tahun yang
        terpilih saat login, dan mengganti penyaring tahun tidak akan pernah
        mengubah apa yang ditarik.
      */
      const rentang = rentangTiket(filterYearRef.current);
      /*
        Daftar akun & referensi garansi jarang berubah, tapi dulu ikut ditarik ulang pada SETIAP
        polling dan event realtime (tabel users terbaca ±670 ribu kali). Muat sekali, lalu hanya saat
        pengguna sendiri memuat ulang (silent = false) atau sudah lebih dari JEDA_DATA_PENDUKUNG_MS.
      */
      const perluPendukung = !silent || Date.now() - pendukungDimuat.current > JEDA_DATA_PENDUKUNG_MS;
      const [membersData, usersData] = perluPendukung ? await Promise.all([
        // team_members tidak ada - ambil dari users dengan role team
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, bisa_ditugaskan").in("role", ["team", "team_pts"]).order("full_name"),
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, is_internal_sales"),
      ]) : [{ data: null }, { data: null }];
      // Map users ke format TeamMember agar kompatibel dengan kode existing
      if (membersData.data) {
        membersData.data = (membersData.data as any[]).map((u: any) => ({
          id: u.id,
          name: u.full_name,      // name = full_name
          username: u.username,
          photo_url: "",
          role: u.role,
          team_type: u.team_type || "Team PTS IVP",
          phone_number: u.phone_number,
          jabatan: u.jabatan,
          // Wajib ikut dipetakan - tanpa ini bolehDitugaskan selalu melihat
          // undefined (= boleh) dan toggle Admin Panel tidak berlaku di sini.
          bisa_ditugaskan: u.bisa_ditugaskan,
        }));
      }
      const activeUser = userOverride !== undefined ? userOverride : currentUser;

      const { tickets: daftarTiket, periksaPilihan } = await ambilTiketUntuk(activeUser, rentang);
      setTickets(daftarTiket);
      if (periksaPilihan && selectedTicket && !daftarTiket.find((t: Ticket) => t.id === selectedTicket.id)) setSelectedTicket(null);
      if (membersData.data) setTeamMembers(membersData.data);
      if (usersData.data) setUsers(usersData.data);
      if (!silent) { setLoading(false); setTicketsLoading(false); }
      else { setLoading(false); }
      if (perluPendukung) {
        if (membersData.data && usersData.data) pendukungDimuat.current = Date.now();
        // Fetch warranty/project reference data (fire-and-forget, non-blocking)
        fetchProjectReminders();
      }
    } catch (err: any) {
      setLoading(false);
      if (!silent) { setTicketsLoading(false); setFetchError(err?.message ?? 'Gagal memuat data. Coba refresh halaman.'); }
    }
  };

  const createTicket = async () => {
    if (!newTicket.project_name || !newTicket.issue_case) { notify("error", "Project name and Issue case must be filled!"); return; }
    // admin/superadmin & MANAGER PTS: ticket langsung masuk (tanpa approval), wajib
    // tentukan penanganan (assign ke team, route ke Supervisor, atau kerjakan sendiri).
    const isElevated = currentUser?.role === "admin" || currentUser?.role === "superadmin" || isManagerPTS;
    if (isElevated && !newTicket.assign_name) { notify("error", "Tentukan penanganan: pilih Team PTS, Supervisor, atau kerjakan sendiri!"); return; }
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Saving new ticket...");
      let photoUrl = "", photoName = "";
      if (newTicket.photo) {
        const ALLOWED_IMG = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const MAX_IMG_MB = 5;
        if (!ALLOWED_IMG.includes(newTicket.photo.type)) { notify("error", "Foto hanya boleh format JPG, PNG, atau WebP."); setUploading(false); setShowLoadingPopup(false); return; }
        if (newTicket.photo.size > MAX_IMG_MB * 1024 * 1024) { notify("error", `Ukuran foto maksimal ${MAX_IMG_MB}MB.`); setUploading(false); setShowLoadingPopup(false); return; }
        setLoadingMessage("Uploading photo...");
        try {
          const compressed = await compressImage(newTicket.photo);
          const ext = compressed.name.split('.').pop()?.toLowerCase() ?? 'jpg';
          const fileName = `${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from("ticket-photos").upload(`photos/${fileName}`, compressed, { cacheControl: '31536000' });
          if (error) throw error;
          const { data } = supabase.storage.from("ticket-photos").getPublicUrl(`photos/${fileName}`);
          photoUrl = data.publicUrl;
          photoName = newTicket.photo.name;
        } catch (uploadErr: any) { throw new Error(`Failed to upload photo: ${uploadErr.message}`); }
      }
      setLoadingMessage("Saving new ticket...");
      // Resolusi penanganan saat elevated (admin/Manager). Nilai assign_name di form:
      //   "SUP::<id>::<nama>" = route ke Supervisor (SPV yg assign lanjut ke tim),
      //   "SELF"              = kerjakan sendiri (assign ke diri sendiri),
      //   nama lain           = assign langsung ke anggota Team PTS.
      const rawAssign = isElevated ? (newTicket.assign_name || "") : "";
      const isRoute = rawAssign.startsWith("SUP::");
      const routeSup = isRoute ? rawAssign.split("::") : null; // [_, id, nama]
      const resolvedAssignName = !isElevated ? "" : (isRoute ? "" : (rawAssign === "SELF" ? (currentUser?.full_name ?? "") : rawAssign));
      // Ticket dari guest/team biasa  Waiting Approval; dari elevated  langsung Pending.
      const ticketStatus = isElevated ? "Pending" : "Waiting Approval";
      // SBU: Sales Internal (guest) yg pilih Sales External  ticket diatasnamakan
      // External tsb. created_by tetap Sales Internal (jejak pembuat).
      const meInternalSales = !!users.find((u) => u.id === currentUser?.id)?.is_internal_sales;
      const guestSBU = currentUser?.role === "guest" && meInternalSales && !!newTicket.sales_name?.trim();
      // Brand: Sales External pilih brand  resolve Sales Internal utk CC + visibility
      // (ticket = CC saja, tanpa gerbang approval). Kalau brand tak ter-mapping, ticket
      // tetap dibuat (fast-track) - cuma tanpa CC brand.
      const ticketBrand: Brand | null = (currentUser?.role === "guest" && !meInternalSales) ? ((newTicket.brand as Brand | undefined) ?? null) : null;
      let brandInternalId: string | null = null;
      let brandInternalId2: string | null = null;
      const effDivForBrand = (currentUser?.sales_division || newTicket.sales_division || "").trim();
      if (ticketBrand && effDivForBrand) {
        try {
          const rb = await resolveBrandInternals(effDivForBrand, ticketBrand);
          brandInternalId = (rb.mvi ?? rb.ivp)?.id ?? null;
          if (ticketBrand === "BOTH" && rb.mvi && rb.ivp && rb.mvi.id !== rb.ivp.id) brandInternalId2 = rb.ivp.id;
        } catch { /* brand mapping opsional utk ticket */ }
      }
      const ticketData: Record<string, unknown> = {
        project_name: newTicket.project_name,
        address: newTicket.address || null,
        customer_phone: newTicket.customer_phone || null,
        sales_name: guestSBU ? newTicket.sales_name.trim() : (currentUser?.role === "guest" ? (currentUser.full_name || newTicket.sales_name || null) : (newTicket.sales_name || null)),
        sales_division: guestSBU ? (newTicket.sales_division?.trim() || null) : (currentUser?.role === "guest" ? (currentUser.sales_division || newTicket.sales_division || null) : (newTicket.sales_division || null)),
        sn_unit: newTicket.sn_unit || null,
        product: newTicket.product || null,
        issue_case: newTicket.issue_case,
        description: newTicket.description || null,
        assign_name: resolvedAssignName,
        date: newTicket.date,
        status: ticketStatus,
        current_team: "Team PTS IVP",
        services_status: null,
        created_by: currentUser?.username || null,
        // Identitas: uuid menjawab SIAPA, nama menjawab tercatat sebagai siapa.
        // Keduanya ditulis bersamaan - baris baru yang lahir hanya berbekal nama
        // akan mengulang cacat data lama yang sedang dibereskan.
        // Guest membuat ticket untuk dirinya sendiri, jadi id-nya sudah pasti.
        // Selain itu id datang dari SalesPicker; kalau namanya diketik manual
        // dan tidak bisa dipastikan milik siapa, dibiarkan kosong - bukan ditebak.
        sales_user_id: guestSBU
          ? (newTicket.sales_user_id ?? idDariNama(users, newTicket.sales_name))
          : (currentUser?.role === "guest"
              ? (currentUser.id ?? null)
              : (newTicket.sales_user_id ?? idDariNama(users, newTicket.sales_name))),
        assign_user_id: idDariNama(users, resolvedAssignName),
        photo_url: photoUrl || null,
        photo_name: photoName || null,
        reminder_id: (newTicket as any).reminder_id || null,
      };
      // Kolom brand hanya ditulis kalau Sales External pilih brand - supaya create
      // ticket lain tetap jalan walau sql/brand-multi-internal.sql belum di-run.
      if (ticketBrand) {
        ticketData.brand = ticketBrand;
        ticketData.internal_sales_id = brandInternalId;
        ticketData.internal_sales_id_2 = brandInternalId2;
      }
      // Route ke Supervisor  tandai supervisor_assign (SPV yg lanjut assign ke tim).
      if (isRoute && routeSup) {
        ticketData.routing_status = "supervisor_assign";
        ticketData.assigned_supervisor_id = routeSup[1];
      }
      const { data: insertedTicket, error } = await cobaIdentitas(async pakaiUuid => await supabase.from("tickets").insert([pakaiUuid ? ticketData : tanpaIdentitas(ticketData)]).select("id").single());
      if (error) throw error;

      // Catat pembuatan ke audit trail supaya riwayat ticket punya pangkal.
      // Saat Sales Internal mengajukan atas nama Sales External (SBU), keduanya
      // disebut supaya jelas siapa penginput dan atas nama siapa.
      if (insertedTicket?.id) {
        const atasNama = (ticketData.sales_name as string | null) ?? "";
        const bedaPenginput = atasNama && atasNama !== currentUser?.full_name;
        logAudit({
          user_id: currentUser?.id ?? "", user_name: currentUser?.full_name ?? "",
          action: "create", module: "ticket",
          target_id: insertedTicket.id, target_name: newTicket.project_name,
          notes: bedaPenginput
            ? `Diinput ${currentUser?.full_name} atas nama Sales ${atasNama}`
            : `Issue: ${newTicket.issue_case}`,
        }).catch(() => {});
      }

      // Kirim WA notifikasi ke semua admin & superadmin jika butuh approval
      // Hanya role guest dan team yang butuh approval  trigger WA ke admin
      if (!isElevated) {
        // Pesan menyebut STATUS ticket-nya, bukan mekanisme internal (WA ke siapa) -
        // yang ditunggu user adalah kabar tiketnya, bukan detail cara sistem memberi tahu.
        setLoadingMessage("Ticket sedang diproses & menunggu approval...");
        try {
          // Admin + pemegang Full Access dari satu sumber (lib/penerima-admin.ts),
          // ditambah app_settings.manager_user_id (override lama, tetap didukung).
          const approvers: { id: string; phone_number: string; full_name: string }[] =
            // SEMUA penerima (bukan hanya yang bernomor): daftar ini juga dipakai
            // untuk notifikasi in-app di bawah. WA sendiri sudah menyaring nomor kosong.
            (await penerimaAdmin()).map(u => ({ id: u.id, phone_number: u.phone_number ?? "", full_name: u.full_name }));
          try {
            const { data: mgrSetting } = await supabase.from("app_settings").select("value").eq("key", KUNCI_PENGATURAN.MANAGER).maybeSingle();
            const managerId = mgrSetting?.value ? String(mgrSetting.value).replace(/^"|"$/g, "") : "";
            if (managerId && !approvers.find(a => a.id === managerId)) {
              const { data: mgr } = await supabase.from("users").select("id, phone_number, full_name").eq("id", managerId).maybeSingle();
              if (mgr) approvers.push(mgr as any);
            }
          } catch { }
          if (approvers.length > 0) {
            const waMsg = [
              "🔔 *Request Ticket Baru \u2014 Menunggu Approval*",
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              `📌 *Project  :* ${newTicket.project_name}`,
              `⚠️ *Issue    :* ${newTicket.issue_case}`,
              `👤 *Requester:* ${currentUser?.full_name || "-"} (${currentUser?.username || "-"})`,
              `📅 *Tanggal  :* ${newTicket.date || "-"}`,
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              "Silakan buka dashboard untuk *Approve / Reject*.",
              `🔗 ${appLink()}`,
            ].join("\n");
            await Promise.allSettled(
              approvers.filter(a => a.phone_number).map((a) =>
                sendWANotif({ type: "reminder_wa", event: "ticket.approval_needed", target: a.phone_number, message: waMsg })
              )
            );
            // Badge in-app ke Admin & Manager
            if (insertedTicket?.id) {
              approvers.forEach(a => { if (a.id) void createNotification({ user_id: a.id, type: 'ticket', title: '🔔 Ticket baru menunggu approval', body: `${newTicket.project_name} — ${newTicket.issue_case}`, action_url: '/ticketing', ref_id: insertedTicket.id, created_by: currentUser?.full_name || '' }); });
            }
          }
        } catch { }
        // CC ke atasan + IVP berdasarkan divisi user yang submit
        try {
          const ccDiv = (ticketData.sales_division as string | null) ?? currentUser?.sales_division ?? "";
          if (ccDiv && ccDiv !== "IVP" && currentUser?.id) {
            const ccTargets = await fetchWACCTargets(currentUser.id, ccDiv);
            if (ccTargets.length > 0) {
              const ccMsg = [
                `🔔 *[CC] Ticket Baru — Divisi ${ccDiv}*`,
                "━━━━━━━━━━━━━━━━━━",
                `📌 *Project  :* ${newTicket.project_name}`,
                `⚠️ *Issue    :* ${newTicket.issue_case}`,
                `👤 *Sales    :* ${currentUser?.full_name || "-"} (${ccDiv})`,
                `📅 *Tanggal  :* ${newTicket.date || "-"}`,
                "━━━━━━━━━━━━━━━━━━",
                `📋 *CC ke   :* ${ccTargets.map(t => t.name + (t.relation === "ivp_handler" ? " (IVP)" : "")).join(", ")}`,
                `🔗 ${appLink()}`,
              ].join("\n");
              await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", event: "ticket.approval_needed", target: t.phone, message: ccMsg })));
            }
          }
        } catch { }
      }

      // Route ke Supervisor saat create (Manager/Admin)  WA + badge ke Supervisor
      if (isRoute && routeSup && insertedTicket?.id) {
        try {
          const supId = routeSup[1], supName = routeSup[2] ?? "";
          const supMember = teamMembers.find(m => m.id === supId);
          const { data: supUser } = supMember?.username
            ? await supabase.from("users").select("id, phone_number, full_name").eq("username", supMember.username).maybeSingle()
            : { data: null };
          if (supUser?.id) void createNotification({ user_id: supUser.id, type: 'ticket', title: '🎯 Ticket perlu kamu assign', body: `${newTicket.project_name} — ${newTicket.issue_case}`, action_url: '/ticketing', ref_id: insertedTicket.id, created_by: currentUser?.full_name || '' });
          if (supUser?.phone_number) {
            const waMsg = ["🎯 *Ticket Perlu Di-assign ke Tim*", "━━━━━━━━━━━━━━━━━━", `Halo *${supUser.full_name || supName}*, ${currentUser?.full_name} meneruskan ticket — silakan assign ke anggota tim / kerjakan sendiri:`, `📌 *Project :* ${newTicket.project_name}`, `⚠️ *Issue   :* ${newTicket.issue_case}`, "━━━━━━━━━━━━━━━━━━", `🔗 ${appLink()}`].join("\n");
            await sendWANotif({ type: "reminder_wa", event: "ticket.routed_supervisor", target: supUser.phone_number, message: waMsg });
          }
        } catch { }
      }

      // Kirim WA ke handler jika ticket langsung di-assign ke anggota tim (bukan self/route)
      if (resolvedAssignName && rawAssign !== "SELF") {
        setLoadingMessage("Ticket sedang diproses...");
        try {
          const eTM = teamMembers.find(m => m.name === resolvedAssignName);
          const { data: handlerInfo } = eTM?.username ? await supabase
            .from("users").select("phone_number, full_name")
            .eq("username", eTM.username).maybeSingle() : { data: null };
          if (handlerInfo?.phone_number) {
            const waMsg = [
              "🎫 *Ticket Baru Assigned ke Kamu*",
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              `Halo *${handlerInfo.full_name}*, ada ticket baru untukmu:`,
              "",
              `📌 *Project :* ${newTicket.project_name}`,
              `⚠️ *Issue   :* ${newTicket.issue_case}`,
              `📝 *Deskripsi:* ${newTicket.description || "-"}`,
              `🔢 *SN Unit :* ${newTicket.sn_unit || "-"}`,
              `📱 *Customer:* ${newTicket.customer_phone || "-"}`,
              `👤 *Sales   :* ${newTicket.sales_name || "-"}`,
              `📅 *Tanggal :* ${newTicket.date || "-"}`,
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              "Mohon segera ditangani. Semangat! 💪",
              `🔗 ${appLink()}`,
            ].join("\n");
            await sendWANotif({ type: "reminder_wa", event: "ticket.assigned", target: handlerInfo.phone_number, message: waMsg });
          }
        } catch (err: any) {
          console.warn('[ticket] WA to handler (new ticket) failed:', err?.message);
          notify('error', 'WA ke handler gagal dikirim. Ticket berhasil disimpan.');
        }
      }

      setNewTicket({
        project_name: "", address: "", customer_phone: "", sales_name: "", sales_division: "", sales_user_id: null, sn_unit: "", product: "", issue_case: "", description: "", assign_name: "", date: getJakartaDateString(), status: "Pending", current_team: "Team PTS IVP", photo: null, reminder_id: null, brand: undefined
      });
      setShowNewTicket(false);
      await fetchData();
      const successMsg = isElevated ? "✅ Ticket saved successfully!" : "✅ Ticket submitted! Waiting for Admin approval.";
      setLoadingMessage(successMsg);
      setTimeout(() => { setShowLoadingPopup(false); setUploading(false); }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Error: " + err.message);
    }
  };

  // Fetch reminders referensi project (Konfigurasi / Konfigurasi & Training) untuk semua pending approval tickets
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

  // Helper: ambil warranty info terbaik (paling recent) untuk sebuah project
  const getWarrantyInfo = (projectName: string) => getWarrantyInfoShared(projectName, projectReminders);

  /**
   * Beres-beres setelah SATU ticket selesai diproses di modal approval. Modal
   * sengaja tidak ditutup selama masih ada ticket lain yang menunggu, dan
   * pilihan handler ticket yang baru selesai dibuang supaya tidak terbawa ke
   * ticket berikutnya.
   */
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

  /**
   * Ticket & handler diterima sebagai ARGUMEN, bukan dibaca dari state bersama.
   * Modal approval menampilkan banyak ticket sekaligus; membaca state bersama
   * membuat hasilnya bergantung pada state yang mungkin sudah berubah/tertinggal
   * saat proses async berjalan - persis yang membuat ticket ke-assign ke orang
   * yang salah. Dengan argumen eksplisit, yang diproses selalu baris yang
   * benar-benar diklik.
   */
  const { approveTicket, jalankanApproveTicket } = useApproveTicket({ approvalAssignee, approvalAssignees, approvalTicket, currentUser, fetchData, notify, selesaikanSatuApproval, setApprovingId, setUploading, teamMembers, users });

  // Pembuka aksi baris tiket (mobile card + tabel desktop) - dikumpulkan di
  // satu tempat supaya kedua tampilan memanggil handler yang SAMA, bukan
  // masing-masing menulis ulang urutan setState-nya sendiri.
  /*
    Muat ISI LENGKAP activity log untuk beberapa tiket sekaligus.

    Daftar tiket sengaja cuma membawa kolom ringkas (lihat KOLOM_LOG_RINGKAS):
    notes, action_taken, dan tautan berkas/foto adalah 61% ukuran log, dan
    tidak satu pun dipakai daftar. Tapi begitu satu tiket DIBUKA - atau dicetak,
    atau diekspor - isi itulah yang jadi intinya.

    Jadi ia dimuat di sini, saat dibutuhkan, untuk tiket yang bersangkutan
    saja. Gagal memuat TIDAK menggagalkan apa pun: yang tampil tinggal log
    ringkas seperti sebelum dibuka, dan itu masih menyebut siapa dan kapan.
    Log dari kedua basis data (PTS dan Services) digabung, sama seperti yang
    dilakukan fetchData.
  */
  const muatLogPenuh = async (idTiket: string[]): Promise<Record<string, ActivityLog[]>> => {
    const peta: Record<string, ActivityLog[]> = {};
    if (idTiket.length === 0) return peta;
    const ambil = async (klien: typeof supabase, ids: string[]) => {
      const keluar: ActivityLog[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await klien.from("activity_logs")
          .select("*")
          .in("ticket_id", ids.slice(i, i + 100))
          .order("created_at", { ascending: true });
        if (data) keluar.push(...(data as ActivityLog[]));
      }
      return keluar;
    };
    const [logPTS, logSvc] = await Promise.all([
      ambil(supabase, idTiket).catch(() => [] as ActivityLog[]),
      ambil(supabaseServices as typeof supabase, idTiket).catch(() => [] as ActivityLog[]),
    ]);
    for (const log of [...logPTS, ...logSvc]) {
      const kunci = log.ticket_id ?? "";
      if (!kunci) continue;
      const sudah = (peta[kunci] ??= []);
      if (!sudah.find(l => l.id === log.id)) sudah.push(log);
    }
    for (const kunci of Object.keys(peta)) {
      peta[kunci].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return peta;
  };

  /** Kembalikan satu tiket dengan log penuh; kalau gagal, tiket apa adanya. */
  const denganLogPenuh = async (ticket: Ticket): Promise<Ticket> => {
    try {
      const peta = await muatLogPenuh([ticket.id]);
      const penuh = peta[ticket.id];
      return penuh && penuh.length > 0 ? { ...ticket, activity_logs: penuh } : ticket;
    } catch { return ticket; }
  };

  const bukaDetailTicket = (ticket: Ticket) => {
    //  Popup dibuka LANGSUNG dengan data ringkas yang sudah ada, lalu
    //  diperkaya begitu log penuhnya tiba. Menunggu dulu berarti satu klik
    //  yang tidak terasa apa-apa selama beberapa ratus milidetik, dan itu
    //  jauh lebih terasa daripada catatan log yang menyusul sesaat kemudian.
    setSelectedTicket(ticket); setShowTicketDetailPopup(true);
    void denganLogPenuh(ticket).then(lengkap => {
      setSelectedTicket(prev => (prev && prev.id === lengkap.id ? lengkap : prev));
    });
  };
  const bukaRingkasanAktivitas = (ticket: Ticket) => {
    setSummaryTicket(ticket); setShowActivitySummary(true);
    void denganLogPenuh(ticket).then(lengkap => {
      setSummaryTicket(prev => (prev && prev.id === lengkap.id ? lengkap : prev));
    });
  };
  const bukaApprovalUntukTicket = (ticket: Ticket) => {
    setApprovalAssignees({}); setApprovalTicket(ticket); setApprovalAssignee("");
    fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true);
  };
  const bukaReopenTicket = (ticket: Ticket) => { setReopenTargetTicket(ticket); setReopenAssignee(ticket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); };
  const bukaDeleteTicket = (ticket: Ticket) => { setDeleteTargetTicket(ticket); setDeleteConfirmText(""); setShowDeleteModal(true); };
  const bukaOverdueSetting = (ticket: Ticket) => {
    setOverdueTargetTicket(ticket);
    const existing = getOverdueSetting(ticket.id);
    setOverdueForm({ due_hours: existing?.due_hours ? String(existing.due_hours) : "48" });
    setShowOverdueSetting(true);
  };

  // Supervisor: assign final ticket yg di-route ke dia  anggota tim / sendiri
  const { handleSupervisorAssignTicket } = useTugaskanSupervisor({ currentUser, fetchData, notify, setSupAssignSaving, setSupAssignTicket, setSupAssignTo, supAssignTicket, supAssignTo, teamMembers });

  /** Buka panel admin dengan nilai ticket saat ini. */
  const { bukaAdminEdit, simpanAdminEdit } = useEditAdminTicket({ adminEditForm, adminEditTicket, adminRerouteTo, currentUser, fetchData, notify, setAdminEditForm, setAdminEditSaving, setAdminEditTicket, setAdminRerouteTo, teamMembers });

  const rejectTicket = (ticket: Ticket) => {
    setRejectTargetTicket(ticket);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectTargetTicket) return;
    if (!rejectReason.trim()) { notify("error", "Mohon isi alasan penolakan!"); return; }
    try {
      setUploading(true);
      const { error } = await supabase
        .from("tickets")
        .update({ status: "Rejected", rejection_reason: rejectReason.trim() })
        .eq("id", rejectTargetTicket.id);
      if (error) throw error;

      // Notifikasi ke pembuat tiket
      if (rejectTargetTicket.created_by) {
        const creatorUser = users.find((u) => u.username === rejectTargetTicket.created_by);
        if (creatorUser?.id) {
          try {
            const { createNotification } = await import('@/lib/notifications');
            void createNotification({
              user_id: creatorUser.id,
              type: 'ticket',
              title: `❌ Ticket ditolak`,
              body: `${rejectTargetTicket.project_name} — ${rejectReason.trim().slice(0, 80)}`,
              action_url: '/ticketing',
              ref_id: rejectTargetTicket.id,
              created_by: currentUser?.full_name || 'Admin',
            });
          } catch { }
          /*
            Penolakan dulu HANYA badge in-app. Artinya Sales yang melaporkan
            masalah baru tahu tiketnya ditolak kalau kebetulan membuka
            platform - padahal penolakan justru kabar yang paling perlu
            segera sampai, karena dialah yang harus menindaklanjuti.
            sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
          */
          if (creatorUser.phone_number) {
            void sendWANotif({
              type: 'reminder_wa',
              target: creatorUser.phone_number,
              message: [
                '❌ *TICKET DITOLAK*',
                '━━━━━━━━━━━━━━━━━━',
                `Halo *${creatorUser.full_name}*, ticket kamu ditolak oleh *${currentUser?.full_name || 'Admin'}*:`,
                `📌 *Project :* ${rejectTargetTicket.project_name}`,
                `⚠️ *Issue   :* ${rejectTargetTicket.issue_case}`,
                `📝 *Alasan  :* ${rejectReason.trim()}`,
                '━━━━━━━━━━━━━━━━━━',
                'Silakan perbaiki datanya lalu ajukan ulang bila masih diperlukan.',
                `🔗 ${appLink()}`,
              ].join('\n'),
            });
          }
        }
      }

      //  Ticket ditolak berarti pekerjaannya tidak jadi - jadwal onsite yang
      //  terlanjur dibuat harus ikut dibatalkan, bukan dibiarkan menggantung
      //  di Reminder Schedule seolah masih akan dikerjakan.
      void tutupJadwalTicket(rejectTargetTicket, 'cancelled');

      await fetchData();
      setShowRejectModal(false);
      setRejectTargetTicket(null);
      setRejectReason("");
      notify("success", "Ticket ditolak. Sales dapat melihat alasan penolakan.");
    } catch (err: any) { notify("error", "Error: " + err.message); } finally { setUploading(false); }
  };

  const reopenTicket = async () => {
    if (!reopenTargetTicket || !reopenAssignee) return;
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Re-opening ticket...");
      const { error: ue } = await supabase.from("tickets").update({ status: "Pending", assign_name: reopenAssignee, current_team: "Team PTS IVP", services_status: null }).eq("id", reopenTargetTicket.id);
      if (ue) throw ue;
      await supabase.from("activity_logs").insert([{
        ticket_id: reopenTargetTicket.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Re-open Ticket",
        notes: reopenNotes ? `Dibuka kembali: ${reopenNotes}` : `Ticket dibuka kembali oleh ${currentUser?.full_name}`,
        new_status: "Pending",
        team_type: "Team PTS IVP",
        assigned_to_services: false,
        file_url: "", file_name: "", photo_url: "", photo_name: ""
      }]);
      // WA ke handler saat reopen
      try {
        // Cari handler dari teamMembers state (sudah load dari users)
        const rhTM = teamMembers.find(m => m.name === reopenAssignee);
        const { data: reopenHandler } = rhTM?.username ? await supabase
          .from("users").select("phone_number, full_name")
          .eq("username", rhTM.username).maybeSingle() : { data: null };
        if (reopenHandler?.phone_number) {
          const waMsg = [
            "🔓 *Ticket Re-opened ke Kamu*",
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            `Halo *${reopenHandler?.full_name || "Handler"}*, ticket dibuka kembali:`,
            "",
            `📌 *Project :* ${reopenTargetTicket.project_name}`,
            `⚠️ *Issue   :* ${reopenTargetTicket.issue_case}`,
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            "Mohon segera ditangani. Semangat! 💪",
            `🔗 ${appLink()}`,
          ].join("\n");
          await sendWANotif({ type: "reminder_wa", event: "ticket.reopened", target: reopenHandler.phone_number, message: waMsg });
        }
      } catch { }
      await fetchData();
      setLoadingMessage("✅ Ticket berhasil dibuka kembali!");
      setTimeout(() => {
        setShowLoadingPopup(false);
        setUploading(false);
        setShowReopenModal(false);
        setReopenTargetTicket(null);
        setReopenAssignee("");
        setReopenNotes("");
        setShowTicketDetailPopup(false);
        setSelectedTicket(null);
      }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Error: " + err.message);
    }
  };

  /**
   * C2 - buka kembali sisi SERVICES saja (services_status kembali "Pending"),
   * tanpa menyentuh status/assign_name utama PTS. Boleh dipakai Team Services
   * sendiri (membetulkan salah klik "Solved" mereka) atau Admin/Superadmin
   * sebagai pengawasan - bukan siapa pun yang login, dan bukan cuma Admin
   * (kalau cuma Admin, Team Services tetap harus minta tolong orang lain
   * untuk membetulkan kesalahannya sendiri).
   */
  const reopenServicesTicket = async () => {
    if (!reopenServicesTarget) return;
    setReopeningServices(true);
    try {
      const { error: svcErr } = await supabaseServices.from("tickets")
        .update({ services_status: "Pending" }).eq("id", reopenServicesTarget.id);
      if (svcErr) throw new Error(`Gagal membuka kembali di basis data Services: ${svcErr.message}`);
      const { error: ptsErr } = await supabase.from("tickets")
        .update({ services_status: "Pending" }).eq("id", reopenServicesTarget.id);
      if (ptsErr) notify("error", `Terbuka di Services, tapi gagal disalin ke PTS: ${ptsErr.message}. Refresh lalu ulangi.`);
      const activeClient = currentUserTeamType === "Team Services" ? supabaseServices : supabase;
      await activeClient.from("activity_logs").insert([{
        ticket_id: reopenServicesTarget.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Re-open Services",
        notes: `Sisi Services dibuka kembali oleh ${currentUser?.full_name || "-"}.`,
        new_status: "Pending",
        team_type: "Team Services",
        assigned_to_services: false,
        file_url: "", file_name: "", photo_url: "", photo_name: "",
      }]);
      notify("success", "Sisi Services dibuka kembali - status kembali Pending.");
      await fetchData();
      setReopenServicesTarget(null);
    } catch (err: any) {
      notify("error", "Error: " + err.message);
    } finally {
      setReopeningServices(false);
    }
  };

  /**
   * Kabar "ticket selesai" ke SELURUH pihak yang terlibat.
   *
   * Sebelum ini alur penyelesaian tidak mengirim apa pun - bukan cuma
   * Telegram, WhatsApp pun tidak. Ticket berubah jadi Solved dan tidak ada
   * satu orang pun diberi tahu: Sales yang melaporkan tidak tahu masalahnya
   * sudah beres, Supervisor tidak tahu timnya sudah menutup pekerjaan, dan
   * yang mengerjakan tidak pernah menerima apa pun atas pekerjaannya.
   *
   * Dua pesan berbeda, bukan satu yang disebar: yang mengerjakan menerima
   * ucapan terima kasih, sisanya menerima pemberitahuan bahwa ticketnya
   * ditutup. Menyamakan keduanya membuat ucapan terima kasih terkirim ke
   * orang yang tidak mengerjakan apa-apa, dan itu terbaca aneh.
   */
  const { kabarkanTicketSelesai, tutupJadwalTicket } = useSelesaiTicket({ currentUser, notify });

  const { addActivity } = useTambahAktivitas({ currentUser, fetchData, fetchOverdueSettings, getOverdueSetting, kabarkanTicketSelesai, newActivity, notify, selectedTicket, setLoadingMessage, setNewActivity, setSelectedTicket, setShowLoadingPopup, setShowUpdateForm, setTickets, setUploading, teamMembers, tutupJadwalTicket });

  const createUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) { notify("error", "All fields must be filled!"); return; }
    const lowerUsername = newUser.username.toLowerCase();
    let finalTeamType = newUser.team_type;
    if (newUser.role === "guest") finalTeamType = "Guest";
    else if (newUser.role === "admin") finalTeamType = "Team PTS IVP";
    try {
      const { id: newId, error: userError } = await adminCreateUser({ username: lowerUsername, full_name: newUser.full_name, role: newUser.role, team_type: finalTeamType });
      if (userError) throw userError;
      // Password ke user_credentials via server route (dibaca login), bukan kolom legacy.
      if (newId && newUser.password) {
        const credRes = await fetch('/api/auth/set-credential', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: newId, password: newUser.password }),
        });
        if (!credRes.ok) { const j = await credRes.json().catch(() => ({})); throw new Error(j.error || 'Gagal set password'); }
      }
      // team_members table tidak digunakan - data handler dari tabel users langsung
      setNewUser({ username: "", password: "", full_name: "", team_member: "", role: "team", team_type: "Team PTS IVP" });
      await fetchData();
      notify("success", "User created successfully!");
    } catch (err: any) { notify("error", "Error: " + err.message); }
  };

  const updatePassword = async () => {
    if (!selectedUserForPassword) { notify("error", "Select user first!"); return; }
    if (!changePassword.current || !changePassword.new || !changePassword.confirm) { notify("error", "All fields must be filled!"); return; }
    if (changePassword.new !== changePassword.confirm) { notify("error", "New password does not match!"); return; }
    try {
      const selectedUser = users.find((u) => u.id === selectedUserForPassword);
      if (!selectedUser) { notify("error", "User not found!"); return; }
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserForPassword, currentPassword: changePassword.current, newPassword: changePassword.new }),
      });
      const result = await res.json();
      if (!res.ok) { notify("error", result.error || "Gagal mengubah password."); return; }
      notify("success", "Password changed successfully!");
      setChangePassword({ current: "", new: "", confirm: "" });
      setSelectedUserForPassword("");
    } catch (err: any) { notify("error", "Error: " + err.message); }
  };


  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filteredTickets.length ? new Set() : new Set(filteredTickets.map(t => t.id))
  );

  /*
    Ekspor Excel memuat log PENUH dulu - sheet "Activity Log"-nya menuliskan
    notes dan action_taken tiap langkah, dan itu justru kolom yang sengaja
    tidak dibawa daftar. Tanpa langkah ini file ekspornya tetap jadi, tapi
    kolom catatannya kosong semua: rusak yang tidak terlihat rusak.

    Dimuat hanya untuk tiket yang benar-benar diekspor (filteredTickets), dan
    hanya saat tombolnya ditekan.
  */
  const jalankanEksporExcel = async () => {
    notify('success', 'Menyiapkan data ekspor...');
    let ticketsPenuh = tickets;
    let terfilterPenuh = filteredTickets;
    try {
      const peta = await muatLogPenuh(filteredTickets.map(t => t.id));
      const lengkapi = (t: Ticket) => (peta[t.id] ? { ...t, activity_logs: peta[t.id] } : t);
      terfilterPenuh = filteredTickets.map(lengkapi);
      ticketsPenuh = tickets.map(lengkapi);
    } catch {
      //  Gagal memuat log bukan alasan membatalkan ekspor - datanya masih
      //  berguna, cuma catatan per langkahnya yang tidak selengkap biasanya.
    }
    eksporExcel({ tickets: ticketsPenuh, filteredTickets: terfilterPenuh, currentUserTeamType, stats, isTicketOverdue, notify });
  };

  /** Cetak satu tiket - log penuhnya dimuat dulu, alasannya sama dgn ekspor. */
  const jalankanCetakTicket = async (ticket: Ticket) => {
    cetakTicket(await denganLogPenuh(ticket));
  };

  const jalankanBulkDelete = async () => {
    setBulkConfirm(false); setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("tickets").delete().in("id", ids);
    if (!error) { setTickets(prev => prev.filter(t => !selectedIds.has(t.id))); setSelectedIds(new Set()); setSelectMode(false); }
    else notify("error", "Gagal: " + error.message);
    setBulkDeleting(false);
  };


  const currentUserTeamType = useMemo(() => {
    if (!currentUser) return "Team PTS IVP";
    const member = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser.username || "").toLowerCase());
    return member?.team_type || "Team PTS IVP";
  }, [currentUser, teamMembers]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const projectName = t.project_name || "";
      const issueCase = t.issue_case || "";
      const salesName = t.sales_name || "";
      const match = projectName.toLowerCase().includes(searchProject.toLowerCase()) || issueCase.toLowerCase().includes(searchProject.toLowerCase());
      const salesNameMatch = salesName.toLowerCase().includes(searchSalesName.toLowerCase());
      const ticketYear = t.created_at ? new Date(t.created_at).getFullYear().toString() : "";
      //  Server sudah membatasi rentangnya (lihat rentangTiket), jadi di sini
      //  'terbaru' tidak menyaring apa pun lagi - menyaring dua kali dengan
      //  aturan berbeda cuma menghasilkan baris yang hilang tanpa sebab.
      const yearMatch = filterYear === TAHUN_TERBARU || ticketYear === filterYear;
      let statusMatch = false;
      if (filterStatus === "All") statusMatch = true;
      else if (filterStatus === "Overdue") statusMatch = isTicketOverdue(t) && t.status !== "Solved";
      else if (filterStatus === "Solved Overdue") statusMatch = isTicketOverdue(t) && t.status === "Solved";
      else if (currentUserTeamType === "Team Services") statusMatch = t.services_status === filterStatus || t.status === filterStatus;
      // Klik kartu "Pending" menampilkan seluruh varian Pending, supaya angka
      // di kartu dan jumlah baris yang muncul tidak berbeda.
      else if (filterStatus === "Pending") statusMatch = (t.status ?? '').startsWith("Pending");
      else statusMatch = t.status === filterStatus;
      const handlerMatch = handlerFilter === null || t.assign_name === handlerFilter;
      const divisionMatch = salesDivisionFilter === null || t.sales_division === salesDivisionFilter;
      const productMatch = productFilter === null || (t.product || "") === productFilter;
      const productSearchMatch = !searchProduct || (t.product || "").toLowerCase().includes(searchProduct.toLowerCase());
      let teamVisibility = true;
      if (currentUserTeamType === "Team Services") teamVisibility = t.current_team === "Team Services" || !!t.services_status;
      if (t.status === "Waiting Approval" && currentUser?.role !== "admin" && currentUser?.role !== "superadmin" && currentUserTeamType !== "Team Services") {
        teamVisibility = teamVisibility && t.created_by === currentUser?.username;
      }
      return match && salesNameMatch && yearMatch && statusMatch && teamVisibility && handlerMatch && divisionMatch && productMatch && productSearchMatch;
    });
  }, [tickets, searchProject, searchSalesName, filterYear, filterStatus, currentUserTeamType, overdueSettings, handlerFilter, salesDivisionFilter, productFilter, searchProduct]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchProject, searchSalesName, filterYear, filterStatus, handlerFilter, salesDivisionFilter, productFilter, searchProduct]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage, ITEMS_PER_PAGE]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const processing = tickets.filter((t) => t.status === "In Progress").length;
    const pending = tickets.filter((t) => adalahPending(t.status)).length;
    const solved = tickets.filter((t) => t.status === "Solved").length;
    const overdue = tickets.filter((t) => isTicketOverdue(t) && t.status !== "Solved").length;
    const solvedOverdue = tickets.filter((t) => isTicketOverdue(t) && t.status === "Solved").length;
    /*
      Irisan donut harus saling lepas. Kartu statistik boleh tumpang-tindih
      (Solved sudah termasuk Solved Overdue; Pending/In Progress sudah termasuk
      yang Overdue), tapi di donut itu membuat tiket terhitung dua kali -
      totalnya pernah tampil 104 padahal tiketnya 94.
    */
    const pendingTepat = tickets.filter((t) => adalahPending(t.status) && !isTicketOverdue(t)).length;
    const processingTepat = tickets.filter((t) => t.status === "In Progress" && !isTicketOverdue(t)).length;
    return {
      total, pending, processing, solved, overdue, solvedOverdue,
      statusData: [
        { name: "Pending", value: pendingTepat, color: "#FCD34D" },
        { name: "In Progress", value: processingTepat, color: "#60A5FA" },
        { name: "Solved", value: solved - solvedOverdue, color: "#34D399" },
        ...(overdue > 0 ? [{ name: "Overdue", value: overdue, color: "#EF4444" }] : []),
        ...(solvedOverdue > 0 ? [{ name: "Solved (Overdue)", value: solvedOverdue, color: "#9333ea" }] : []),
      ].filter((d) => d.value > 0),
      handlerData: Object.entries(tickets.reduce((acc, t) => { acc[t.assign_name] = (acc[t.assign_name] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([name, tickets]) => {
        const member = teamMembers.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
        return { name, tickets, team: member?.team_type || "Team PTS IVP" };
      }),
    };
  }, [tickets, overdueSettings]);

  const salesDivisionStats = useMemo(() => {
    const divisionCounts: Record<string, number> = {};
    tickets.forEach((t) => { if (t.sales_division) divisionCounts[t.sales_division] = (divisionCounts[t.sales_division] || 0) + 1; });
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1", "#14B8A6", "#F43F5E", "#A855F7", "#22D3EE", "#EAB308"];
    const divisionData = Object.entries(divisionCounts).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })).sort((a, b) => b.value - a.value).slice(0, 10);
    return { data: divisionData, total: divisionData.reduce((sum, d) => sum + d.value, 0) };
  }, [tickets]);

  // Product stats untuk mini donut chart
  const productStats = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t) => { if (t.product) counts[t.product] = (counts[t.product] || 0) + 1; });
    const colors = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16","#F97316","#6366F1","#14B8A6","#F43F5E","#A855F7","#22D3EE","#EAB308"];
    const data = Object.entries(counts)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    return { data, total: data.reduce((s, d) => s + d.value, 0) };
  }, [tickets]);

  /*
    Daftar tahun untuk penyaring - DARI SERVER, bukan disimpulkan dari tiket
    yang sedang tampil.

    Dulu ia dikumpulkan dari array `tickets`. Itu benar selama seluruh tiket
    memang ditarik. Sekarang tarikan bawaannya dibatasi 12 bulan terakhir
    (lihat rentangTiket), jadi menyimpulkannya dari sana akan membuat pilihan
    tahun lama HILANG dari dropdown - dan begitu pilihannya hilang, tiket lama
    tidak bisa dijangkau sama sekali. Yang tadinya cuma "tidak ditampilkan"
    berubah jadi "tidak ada".

    Kuerinya sendiri murah: satu kolom, tanpa join, dan hanya dijalankan sekali
    saat halaman dibuka.
  */
  const [tahunTersedia, setTahunTersedia] = useState<string[]>([]);
  useEffect(() => {
    if (!currentUser) return;
    let hidup = true;
    (async () => {
      const { data } = await supabase.from("tickets").select("created_at");
      if (!hidup || !data) return;
      const tahun = new Set<string>();
      for (const b of data as { created_at: string | null }[]) {
        if (b.created_at) tahun.add(new Date(b.created_at).getFullYear().toString());
      }
      setTahunTersedia(Array.from(tahun).sort((a, b) => parseInt(b) - parseInt(a)));
    })();
    return () => { hidup = false; };
  }, [currentUser]);

  const availableYears = useMemo(() => {
    //  Gabungkan dengan tahun yang muncul di tiket yang sedang tampil, supaya
    //  penyaringnya tetap berguna kalau kueri daftar tahun di atas gagal.
    const years = new Set<string>(tahunTersedia);
    tickets.forEach((t) => { if (t.created_at) years.add(new Date(t.created_at).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [tickets, tahunTersedia]);

  const uniqueProjectNames = useMemo(() => {
    const names = tickets.map((t) => t.project_name);
    return Array.from(new Set(names)).sort();
  }, [tickets]);

  // Team yg boleh di-assign tiket = ASSIGNABLE_PTS_TEAMS (IVP/MVI - UMP dikecualikan,
  // lihat lib/teams.ts). Manager dikecualikan - bukan handler teknis biasa.
  //  Dulu `m.jabatan !== "Manager"` dipaku di sini. Diganti toggle per akun
//  (lihat bolehDitugaskan di lib/teams.ts): perusahaan lain bisa saja
//  Manager-nya memang ikut mengerjakan, dan itu harus bisa diatur dari
//  Admin Panel tanpa menyunting kode. Manager hanya ditawarkan ke Admin
//  murni - lihat bolehDitugaskanOleh.
  const penugasAdmin = adalahAdminMurni(currentUser);
  const teamPTSMembers = useMemo(() => teamMembers.filter((m) => bolehDitugaskanOleh(m, penugasAdmin)), [teamMembers, penugasAdmin]);
  const teamServicesMembers = useMemo(() => teamMembers.filter((m) => m.team_type === "Team Services" && m.jabatan !== "Manager"), [teamMembers]);
  // Supervisor PTS - utk opsi "Route ke Supervisor" saat approve (tahap supervisor_assign).
  const supervisorMembers = useMemo(() => teamMembers.filter((m) => isAssignablePTSTeam(m.team_type) && m.jabatan === "Supervisor"), [teamMembers]);

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

  //  Lihat catatan di fetchData: polling & realtime menangkap nilai lama.
  const filterYearRef = useRef(filterYear);
  useEffect(() => { filterYearRef.current = filterYear; }, [filterYear]);

  useEffect(() => { if (currentUser) fetchData(); }, [currentUser]);
  //  Mengganti tahun mengubah APA yang ditarik server, bukan cuma menyaring
  //  yang sudah ada - jadi ia harus memicu pengambilan ulang.
  useEffect(() => {
    if (currentUser) fetchData(currentUser, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear]);

  // Realtime subscription: auto-update tanpa refresh
  useEffect(() => {
    if (!currentUser) return;
    /*
      Event realtime TIDAK lagi memuat ulang seluruh daftar satu per satu.

      Satu perubahan ticket biasanya = 2-4 event (baris tickets + baris activity_logs, di dua basis),
      dan dulu tiap event menarik SEMUA ticket beserta lognya di setiap tab yang terbuka - query itu
      jalan >127 ribu kali. Sekarang event dikumpulkan JEDA_GABUNG_REALTIME_MS, lalu:
        - perubahan / hapus pada ticket yang sudah ada di daftar -> muat ulang ticket itu saja;
        - ticket baru, event tanpa id, terlalu banyak sekaligus, atau galat -> satu muat ulang penuh.
    */
    const antre = { ids: new Set<string>(), penuh: false, timer: null as ReturnType<typeof setTimeout> | null };
    const proses = async () => {
      const ids = Array.from(antre.ids);
      const penuh = antre.penuh || ids.length > MAKS_SEGAR_SEBAGIAN || ids.some(id => !ticketsRef.current.some(t => t.id === id));
      antre.ids.clear(); antre.penuh = false; antre.timer = null;
      if (penuh) { fetchData(currentUser, true); return; } // silent: tidak trigger loading spinner
      try {
        const segar = new Map((await ambilTiketTertentu(currentUser, ids)).map(t => [t.id, t] as const));
        setTickets(prev => prev.flatMap(t => (!ids.includes(t.id) ? [t] : segar.has(t.id) ? [segar.get(t.id)!] : [])));
        //  Ticket yang sedang dibuka ikut disegarkan, tapi log lengkapnya (muatLogPenuh) dipertahankan.
        setSelectedTicket(prev => {
          if (!prev || !ids.includes(prev.id)) return prev;
          const baru = segar.get(prev.id);
          return baru ? { ...baru, activity_logs: (prev.activity_logs?.length ?? 0) > (baru.activity_logs?.length ?? 0) ? prev.activity_logs : baru.activity_logs } : prev;
        });
      } catch { fetchData(currentUser, true); }
    };
    const jadwalkan = (id: unknown) => {
      if (typeof id === "string" && id) antre.ids.add(id); else antre.penuh = true;
      if (!antre.timer) antre.timer = setTimeout(() => void proses(), JEDA_GABUNG_REALTIME_MS);
    };
    type Muatan = { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> };
    const dariTicket = (p: Muatan) => jadwalkan(p.eventType === "INSERT" ? null : (p.new?.id ?? p.old?.id));
    const dariLog = (p: Muatan) => jadwalkan(p.new?.ticket_id ?? p.old?.ticket_id);
    // PTS DB realtime
    const ptsCh = supabase.channel("pts-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, dariTicket)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, dariLog)
      .subscribe();
    // Services DB realtime (untuk update services_status dari platform Services). Baris tickets
    // Services bukan baris daftar ini - perubahannya selalu lewat muat ulang penuh (tetap digabung).
    const svcCh = supabaseServices.channel("svc-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => jadwalkan(null))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, dariLog)
      .subscribe();
    /*
      Polling cadangan - JARING PENGAMAN kalau realtime di atas meleset, bukan
      sumber data utama.

      Dulu 30 detik dan berjalan terus tanpa syarat. Biayanya nyata: sekali
      tarik ~150 KB (seluruh tiket beserta ringkasan lognya), dua kali semenit,
      per tab yang terbuka - sekitar 4,8 GB sebulan untuk SATU orang yang
      meninggalkan halaman ini terbuka sepanjang jam kerja. Kuota egress
      Supabase Free-nya 5 GB. Satu tab yang menganggur nyaris menghabiskan
      jatah sebulan tanpa ada yang mengerjakan apa pun.

      Dua perubahan:

      1. BERHENTI saat tab tidak terlihat. Halaman yang ditinggal di belakang
         tidak punya siapa pun yang membaca hasilnya. Saat tab kembali dilihat
         kita menarik SEKALI supaya layarnya langsung segar - tanpa itu
         penghematannya dibayar dengan data basi, dan orang akan menekan
         refresh sendiri (yang jauh lebih mahal).
      2. 30 detik -> 2 menit. Realtime yang menangani perubahan langsung;
         jaring pengaman tidak perlu ditebar dua kali semenit.
    */
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const mulaiPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => fetchData(currentUser, true), JEDA_POLLING_MS);
    };
    const hentikanPolling = () => {
      if (!pollInterval) return;
      clearInterval(pollInterval);
      pollInterval = null;
    };
    const saatVisibilitasBerubah = () => {
      if (document.visibilityState === 'hidden') { hentikanPolling(); return; }
      fetchData(currentUser, true);   // segarkan sekali begitu kembali dilihat
      mulaiPolling();
    };
    if (document.visibilityState !== 'hidden') mulaiPolling();
    document.addEventListener('visibilitychange', saatVisibilitasBerubah);

    return () => {
      if (antre.timer) clearTimeout(antre.timer);
      supabase.removeChannel(ptsCh);
      supabaseServices.removeChannel(svcCh);
      document.removeEventListener('visibilitychange', saatVisibilitasBerubah);
      hentikanPolling();
    };
  }, [currentUser]);

  // SLA Auto-Escalation
  // Runs whenever tickets or overdueSettings change.
  // Finds tickets that exceed their SLA deadline and automatically marks them
  // as 'Overdue' in the DB so the Command Center and all clients see it in real-time.
  // Admin-only: only admins/superadmins trigger the escalation to avoid race conditions.
  useEffect(() => {
    const isAdminUser = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
    if (!isAdminUser || !tickets.length) return;
    const toEscalate = tickets.filter(t =>
      isTicketOverdue(t)
      && t.status !== 'Solved'
      && t.status !== 'Overdue'
      && t.status !== 'Waiting Approval'
    );
    if (!toEscalate.length) return;
    const ids = toEscalate.map(t => t.id);
    supabase.from('tickets').update({ status: 'Overdue' }).in('id', ids)
      .then(() => { if (currentUser) fetchData(currentUser, true); })
      .catch((e: unknown) => console.warn('[SLA] auto-escalation error:', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, overdueSettings]);

  const canCreateTicket = !isPimpinan(currentUser);
  const bolehUpdateTicket = (t: Ticket): boolean => bolehUpdateTicketShared(t, currentUser);
  // canAccessAccountSettings TETAP admin/superadmin murni - khusus modal
  // "Account Management" (buat akun, ganti password, daftar user), bukan
  // untuk aksi tiket biasa.
  const canAccessAccountSettings = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  // Akun Team PTS dengan toggle "Full Access" aktif (lihat lib/constants.ts
  // hasFullAccess) - mis. Dhany (Manager PTS) - boleh approve & assign ticket
  // (langsung ke team, route ke Supervisor, atau kerjakan sendiri) seperti admin.
  const isManagerPTS = hasFullAccess(currentUser);
  const canApproveAssign = canAccessAccountSettings || isManagerPTS;
  // Aksi kelola tiket sehari-hari (hapus, bulk-select, reminder cron, overdue
  // setting) - BUKAN hak kelola akun. Dipisah dari canAccessAccountSettings
  // supaya Full Access tidak otomatis dapat modal Account Management.
  const canManageTickets = canApproveAssign;

  const pendingApprovalTickets = useMemo(() => {
    if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin" && !isManagerPTS) return [];
    return tickets.filter((t) => t.status === "Waiting Approval");
  }, [tickets, currentUser, isManagerPTS]);

  const pendingServicesApprovalTickets = useMemo(() => {
    if (currentUserTeamType !== "Team Services") return [];
    return tickets.filter((t) => t.services_status === "Waiting Approval" && t.current_team === "Team Services");
  }, [tickets, currentUserTeamType]);

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

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{ background: 'var(--latar-halaman)', backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(255,255,255,0.08)" }} />
      {/* Toast notifications */}
      {toast && <Toast notif={toast} />}
      {/* TANPA z-index — disengaja. `relative z-10` di sini dulu membentuk
          stacking context, sehingga z-index SEMUA modal di dalamnya cuma
          dibandingkan sesama isi pembungkus ini, bukan dengan overlay yang
          di-portal ke <body>. Akibatnya modal z-[1100] bisa tampil DI BELAKANG
          modal z-[1000] yang di-portal. Urutan cat terhadap tint di atas tetap
          aman karena elemen ini datang belakangan di DOM. */}
      <div className="relative flex flex-col flex-1 overflow-hidden">

        {/* ── LOADING POPUP (Redesigned) ── */}
        {showLoadingPopup && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100]">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(220,38,38,0.3)" }}>
              <div className="flex flex-col items-center">
                {loadingMessage.includes("✅") ? (
                  <div className="text-6xl mb-4 animate-bounce"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                ) : (
                  <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-red-600 border-t-transparent animate-spin"></div>
                  </div>
                )}
                <p className="text-xl font-bold text-gray-800 text-center">{loadingMessage}</p>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── UPLOAD PROGRESS BAR ── */}
        {uploading && !showLoadingPopup && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
            <div className="h-full bg-gradient-to-r from-red-500 to-red-700 animate-pulse" style={{ width: "100%", transition: "width 0.3s" }}></div>
          </div>
        )}

        {/* ── HEADER ── (Redesigned like ReminderSchedule) */}
        <PageHeader icon="🎫" title="Ticket Troubleshooting" color="#dc2626" colorLight="#991b1b">
          {/* Bell notif */}
          {currentUser?.role !== "guest" && (
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-xl transition-all hover:bg-red-50 border-2 border-transparent hover:border-red-200" title="Notifications">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "#f59e0b" }}>
                  {notifications.length}
                </span>
              )}
            </button>
          )}

          {/* Approval button */}
          {canApproveAssign && pendingApprovalTickets.length > 0 && (
            <button onClick={() => { setApprovalAssignees({}); fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true); }} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#ea580c,#c2410c)", boxShadow: "0 2px 8px rgba(234,88,12,0.35)" }}>
              <IkonTeks nama="⏳" />Approval
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingApprovalTickets.length}</span>
            </button>
          )}

          {/* Services Approval button */}
          {currentUserTeamType === "Team Services" && pendingServicesApprovalTickets.length > 0 && (
            <button onClick={() => setShowServicesApprovalModal(true)} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#db2777,#be185d)", boxShadow: "0 2px 8px rgba(219,39,119,0.35)" }}>
              <IkonTeks nama="🔧" />Ticket Masuk
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingServicesApprovalTickets.length}</span>
            </button>
          )}

          {/* Reminder button */}
          {canManageTickets && (
            <button onClick={() => { setShowReminderSchedule(true); setShowAccountSettings(false); setShowNewTicket(false); }} className="flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }} title="Reminder harian: Briefing pagi 06.00 WIB">
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Reminder</span>
            </button>
          )}

          {/* New Ticket button */}
          {canCreateTicket && (
            <button onClick={() => { (() => {
              const nextShow = !showNewTicket;
              setShowNewTicket(nextShow);
              setShowAccountSettings(false);
              if (nextShow && currentUser?.role === "guest") {
                setNewTicket(prev => ({
                  ...prev,
                  sales_name: prev.sales_name || currentUser.full_name || "",
                  sales_division: prev.sales_division || currentUser.sales_division || "",
                }));
              }
            })() }} className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 4px 14px rgba(220,38,38,0.4)" }}>
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Ticket
            </button>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

          <StatsSection
            currentUser={currentUser}
            currentUserTeamType={currentUserTeamType}
            stats={stats}
            tickets={tickets}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            handlerFilter={handlerFilter}
            setHandlerFilter={setHandlerFilter}
            ticketListRef={ticketListRef}
            selectedHandlerTeam={selectedHandlerTeam}
            setSelectedHandlerTeam={setSelectedHandlerTeam}
            salesDivisionStats={salesDivisionStats}
            salesDivisionFilter={salesDivisionFilter}
            setSalesDivisionFilter={setSalesDivisionFilter}
            productStats={productStats}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
          />

          {/* ── TICKET LIST (with integrated search/filter bar like image) ── */}
          <div ref={ticketListRef} className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(200,200,200,0.6)", backdropFilter: "blur(12px)" }}>
            <FilterBar
              canManageTickets={canManageTickets}
              selectMode={selectMode}
              setSelectMode={setSelectMode}
              setSelectedIds={setSelectedIds}
              fetchData={fetchData}
              loading={loading}
              onExport={jalankanEksporExcel}
              uploading={uploading}
              ticketsLoading={ticketsLoading}
              filteredTickets={filteredTickets}
              searchProject={searchProject}
              setSearchProject={setSearchProject}
              searchSalesName={searchSalesName}
              setSearchSalesName={setSearchSalesName}
              searchProduct={searchProduct}
              setSearchProduct={setSearchProduct}
              setProductFilter={setProductFilter}
              handlerFilter={handlerFilter}
              setHandlerFilter={setHandlerFilter}
              teamMembers={teamMembers}
              selectedHandlerTeam={selectedHandlerTeam}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              currentUser={currentUser}
              filterYear={filterYear}
              setFilterYear={setFilterYear}
              availableYears={availableYears}
              selectedIds={selectedIds}
              bulkDeleting={bulkDeleting}
              setBulkConfirm={setBulkConfirm}
              salesDivisionFilter={salesDivisionFilter}
              setSalesDivisionFilter={setSalesDivisionFilter}
              productFilter={productFilter}
            />

            <TicketListBody
              fetchError={fetchError}
              setFetchError={setFetchError}
              fetchData={fetchData}
              ticketsLoading={ticketsLoading}
              searchProject={searchProject}
              setSearchProject={setSearchProject}
              searchSalesName={searchSalesName}
              setSearchSalesName={setSearchSalesName}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterYear={filterYear}
              setFilterYear={setFilterYear}
              filteredTickets={filteredTickets}
              paginatedTickets={paginatedTickets}
              tickets={tickets}
              users={users}
              teamMembers={teamMembers}
              isTicketOverdue={isTicketOverdue}
              getOverdueSetting={getOverdueSetting}
              getWarrantyInfo={getWarrantyInfo}
              bolehUpdateTicket={bolehUpdateTicket}
              canApproveAssign={canApproveAssign}
              canManageTickets={canManageTickets}
              currentUserTeamType={currentUserTeamType}
              bukaDetailTicket={bukaDetailTicket}
              bukaRingkasanAktivitas={bukaRingkasanAktivitas}
            cetakTicket={jalankanCetakTicket}
              bukaApprovalUntukTicket={bukaApprovalUntukTicket}
              bukaReopenTicket={bukaReopenTicket}
              bukaDeleteTicket={bukaDeleteTicket}
              bukaOverdueSetting={bukaOverdueSetting}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              ITEMS_PER_PAGE={ITEMS_PER_PAGE}
              selectMode={selectMode}
              selectedIds={selectedIds}
              toggleSelectId={toggleSelectId}
              toggleSelectAll={toggleSelectAll}
              productFilter={productFilter}
              setProductFilter={setProductFilter}
              ticketListRef={ticketListRef}
            />
          </div>
        </div>

        {/* ── All modals remain the same as original (notifications, detail popup, etc.) ── */}
        {/* ... (all other modals - notification popup, ticket detail, update form, approval modals, etc. remain unchanged) ... */}

        {/* Bulk Delete Confirm Modal */}
        {bulkConfirm && (
          <BulkDeleteConfirmModal
            jumlah={selectedIds.size}
            onCancel={() => setBulkConfirm(false)}
            onConfirm={jalankanBulkDelete}
          />
        )}

        {/* ── NOTIFICATION POPUP (Redesigned) ── */}
        {showNotificationPopup && notifications.length > 0 && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-5 flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3"><span className="text-3xl animate-bounce"><Ikon nama="🔔" ukuran="1em" className="inline-block align-[-0.12em]" /></span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3><p className="text-sm text-white/90">{notifications.length} tickets need attention</p></div></div>
                  <button aria-label="Tutup" onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                {notifications.map((ticket) => {
                  const overdueFlag = isTicketOverdue(ticket);
                  return (
                    <div key={ticket.id} {...bisaDiklik(() => { setSelectedTicket(ticket); setShowNotificationPopup(false); setShowTicketDetailPopup(true); })} className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all" style={{ background: "rgba(249,250,251,0.9)", borderColor: overdueFlag ? "#dc2626" : "#e5e7eb" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-1 flex-wrap">{overdueFlag && <span className="text-red-500"><Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /></span>}<p className="font-bold text-sm text-gray-800 truncate">{ticket.project_name}</p></div><p className="text-xs text-gray-500">{ticket.issue_case}</p>{overdueFlag && <p className="text-xs text-red-600 font-bold mt-0.5"><IkonTeks nama="⏰" />OVERDUE - Segera tangani!</p>}</div>
                        <div className="flex-shrink-0 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${overdueFlag ? statusColors["Overdue"] : statusColors[currentUserTeamType === "Team Services" ? ticket.services_status || "Pending" : ticket.status]}`}>{overdueFlag ? "🚨 Overdue" : (currentUserTeamType === "Team Services" ? (ticket.services_status || "Pending") : ticket.status)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t flex-shrink-0" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(249,250,251,0.8)" }}><button onClick={() => setShowNotificationPopup(false)} className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white py-3 rounded-xl font-bold transition-all">✕ Tutup</button></div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── NOTIFICATIONS MODAL (Redesigned) ── */}
        {showNotifications && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-5 flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3"><span className="text-3xl"><Ikon nama="🔔" ukuran="1em" className="inline-block align-[-0.12em]" /></span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3>{notifications.length > 0 && <p className="text-sm text-white/90">{notifications.length} tickets need attention</p>}</div></div>
                  <button aria-label="Tutup" onClick={() => setShowNotifications(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="p-12 text-center text-gray-500"><div className="text-6xl mb-4"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></div><p className="text-lg font-medium">No notifications</p><p className="text-sm mt-2">All tickets have been handled</p></div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-4"><div className="space-y-3">{notifications.map((ticket) => { const overdueFlag = isTicketOverdue(ticket); return (
                  <div key={ticket.id} {...bisaDiklik(() => { setSelectedTicket(ticket); setShowNotifications(false); setShowTicketDetailPopup(true); })} className={`rounded-xl p-4 border-2 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all ${overdueFlag ? "bg-red-50 border-red-400" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300"}`}>
                    <div className="flex justify-between items-start mb-3"><div className="flex-1"><div className="flex items-center gap-2 mb-2">{overdueFlag && <span className="text-red-500"><Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /></span>}<p className="font-bold text-lg text-gray-800">{ticket.project_name}</p><span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-bold">{ticket.current_team}</span></div><p className="text-sm text-gray-600 mt-1">{ticket.issue_case}</p>{overdueFlag && <p className="text-xs text-red-600 font-bold mt-1"><IkonTeks nama="⏰" />OVERDUE - Segera tangani!</p>}</div><div className="ml-3"><span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${overdueFlag ? statusColors["Overdue"] : statusColors[currentUserTeamType === "Team Services" ? ticket.services_status || "Pending" : ticket.status]}`}>{overdueFlag ? "🚨 Overdue" : (currentUserTeamType === "Team Services" ? (ticket.services_status || "Pending") : ticket.status)}</span></div></div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-300"><span className="text-xs text-gray-500"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {ticket.created_at ? formatDateTime(ticket.created_at) : "-"}</span><span className="text-sm text-blue-600 font-semibold">Click to view details →</span></div>
                  </div>
                )})}</div></div>
              )}
              <div className="p-4 border-t flex-shrink-0" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(249,250,251,0.8)" }}><button onClick={() => setShowNotifications(false)} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl font-bold transition-all">Close</button></div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── TICKET DETAIL POPUP — detail kiri + update panel kanan ── */}
        {showTicketDetailPopup && selectedTicket && (
          <TicketDetailPopup
            selectedTicket={selectedTicket}
            currentUser={currentUser}
            currentUserTeamType={currentUserTeamType}
            canManageTickets={canManageTickets}
            users={users}
            showUpdateForm={showUpdateForm}
            setShowUpdateForm={setShowUpdateForm}
            onClose={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); }}
            bukaAdminEdit={bukaAdminEdit}
            getDeadline={getDeadline}
            getWarrantyInfo={getWarrantyInfo}
            bolehUpdateTicket={bolehUpdateTicket}
            setSupAssignTicket={setSupAssignTicket}
            setSupAssignTo={setSupAssignTo}
            setReopenTargetTicket={setReopenTargetTicket}
            setReopenAssignee={setReopenAssignee}
            setReopenNotes={setReopenNotes}
            setShowReopenModal={setShowReopenModal}
            setReopenServicesTarget={setReopenServicesTarget}
            setShowServicesApprovalModal={setShowServicesApprovalModal}
            newActivity={newActivity}
            setNewActivity={setNewActivity}
            addActivity={addActivity}
            uploading={uploading}
          />
        )}

                {/* ── APPROVAL MODAL (Redesigned) ── */}
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

        {/* ── SERVICES APPROVAL MODAL (Redesigned) ── */}
        {/* Z.overlayTop — dibuka DARI DALAM popup detail (Z.overlay), jadi
            harus selapis di atasnya. Sebelumnya selevel dan hanya tampil di
            depan karena kebetulan letaknya lebih bawah di berkas ini; sekali
            urutan blok ini bergeser ke atas popup detail, ia langsung hilang
            ke belakang. */}
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

        {/* ── ACCOUNT SETTINGS MODAL (Redesigned) ── */}
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

        {/* ── OVERDUE SETTING MODAL (Redesigned) ── */}
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

        {/* Z.overlayTop — bisa dibuka dari daftar MAUPUN dari dalam popup
            detail (Z.overlay), jadi harus selapis di atasnya. */}
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

        {/* C2: konfirmasi Reopen Services - lebih sederhana dari modal PTS di atas
            (tidak perlu pilih assignee, sisi Services memang tidak punya konsep itu). */}
        {reopenServicesTarget && (
          <ReopenServicesModal
            reopenServicesTarget={reopenServicesTarget}
            reopeningServices={reopeningServices}
            reopenServicesTicket={reopenServicesTicket}
            onClose={() => setReopenServicesTarget(null)}
          />
        )}

        {/* ── ACTIVITY SUMMARY MODAL (Redesigned) ── */}
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
      <style>{`
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: none; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.25s ease-out; }
        .animate-bounce { animation: bounce 0.6s ease-out; }
        input:focus, select:focus, textarea:focus { outline: none; }
      `}</style>
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
