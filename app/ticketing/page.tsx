"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { ModalPortal } from '@/components/shared';
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, supabaseServices } from "@/lib/supabase";
import { setSession, clearSession, getSession } from "@/lib/auth";
import { adminCreateUser } from "@/lib/admin-users";
import { notifyTicketAssigned, createNotification } from "@/lib/notifications";
import { penerimaAdminBernomor } from "@/lib/penerima-admin";
import { logAudit } from "@/lib/audit";
import { bandingkan, ringkasPerubahan, pesanWAPerubahan } from "@/lib/admin-edit";
import { isAssignablePTSTeam, bolehDitugaskan } from "@/lib/teams";
import { hasFullAccess } from "@/lib/constants";
import { idDariNama, kutipNilai, tanpaIdentitas, cobaIdentitas } from "@/lib/identitas";
import { resolveBrandInternals, type Brand } from "@/lib/brand-routing";
import { compressImage } from "@/lib/image-compress";

import {
  sendWANotif, fetchWACCTargets,
  JABATAN_TIER, JABATAN_CC_RULES,
  SERVICES_STATUSES, ServicesStatus,
  User, TeamMember, ActivityLog, Ticket, OverdueSetting,
  SALES_DIVISIONS, formatDateTime, ringkasPenanganan,
  statusColors, TICKET_ADMIN_FIELDS, adalahPending, bolehReroute,
  getDeadline as getDeadlineShared,
  isTicketOverdue as isTicketOverdueShared,
  getOverdueSetting as getOverdueSettingShared,
  getCronDisplay as getCronDisplayShared,
  getWarrantyInfo as getWarrantyInfoShared,
  bolehUpdateTicket as bolehUpdateTicketShared,
} from "./_components/shared";
import { InfoLine } from "./_components/DonutCards";
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
import { Ico } from "./_components/Ico";
import { appLink } from "@/lib/app-url";
import { cetakTicket } from "./_components/cetak-ticket";
import { eksporExcel } from "./_components/ekspor-excel";
import { Toast, PageHeader, ConfirmDialog, type ConfirmState } from "@/components/shared";

function TicketingSystemInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketListRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginTime, setLoginTime] = useState<number | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
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
  const [reminderSchedule, setReminderSchedule] = useState({
    hour_wib: "8",
    minute: "0",
    frequency: "daily" as "daily" | "weekdays" | "custom",
    custom_days: [] as number[],
    active: true,
  });
  const [reminderSaving, setReminderSaving] = useState(false);
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
  const [filterYear, setFilterYear] = useState<string>("all");
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
  const ITEMS_PER_PAGE = 30;
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

  const loadReminderSchedule = async () => {
    try {
      const { data } = await supabase.from("app_settings").select("value").eq("key", KUNCI_PENGATURAN.JADWAL_REMINDER).single();
      if (data?.value) setReminderSchedule(data.value);
    } catch (e) {}
  };

  const getCronDisplay = () => getCronDisplayShared(reminderSchedule);

  const saveCronSchedule = async () => {
    setReminderSaving(true);
    try {
      const hour = parseInt(reminderSchedule.hour_wib);
      const minute = parseInt(reminderSchedule.minute) || 0;
      let dayOfWeek = "*";
      if (reminderSchedule.frequency === "weekdays") dayOfWeek = "1-5";
      else if (reminderSchedule.frequency === "custom" && reminderSchedule.custom_days.length > 0) dayOfWeek = reminderSchedule.custom_days.join(",");
      const { error } = await supabase.rpc("update_reminder_cron", { p_hour_wib: hour, p_minute: minute, p_day_of_week: dayOfWeek, p_active: reminderSchedule.active });
      await supabase.from("app_settings").upsert({ key: KUNCI_PENGATURAN.JADWAL_REMINDER, value: reminderSchedule }, { onConflict: "key" });
      if (error) {
        const utcHour = (hour - 7 + 24) % 24;
        const cronExpr = `${minute} ${utcHour} * * ${dayOfWeek}`;
        notify("success", "Setting disimpan! Jalankan SQL di SQL Editor Supabase untuk mengaktifkan jadwal baru.");
      } else notify("success", `Jadwal reminder berhasil diubah! ${getCronDisplay()}`);
      setShowReminderSchedule(false);
    } catch (e: any) { notify("error", "Error: " + e.message); } finally { setReminderSaving(false); }
  };

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
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') { notify("error", "Tidak ada akses untuk menghapus ticket."); return; }
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
    setFilterYear("All"); setFilterStatus("All"); setSelectedHandlerTeam("PTS");
    clearSession();
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = "/dashboard";
  };

  const fetchData = async (userOverride?: User | null, silent = false) => {
    try {
      if (!silent) setTicketsLoading(true);
      const [membersData, usersData] = await Promise.all([
        // team_members tidak ada - ambil dari users dengan role team
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, bisa_ditugaskan").in("role", ["team", "team_pts"]).order("full_name"),
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, is_internal_sales"),
      ]);
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
        }));
      }
      const activeUser = userOverride !== undefined ? userOverride : currentUser;

      if (activeUser?.role === "guest") {
        // Fetch fresh user dari DB termasuk jabatan & full_name
        const { data: freshUser } = await supabase
          .from("users")
          .select("id, username, full_name, jabatan, sales_division, role")
          .eq("id", activeUser.id)
          .maybeSingle();
        const resolvedUser = { ...activeUser, ...(freshUser ?? {}) };
        const selfJabatan = (resolvedUser as any).jabatan as string | undefined;
        const selfTier = selfJabatan ? (JABATAN_TIER[selfJabatan] ?? 0) : 0;
        const selfUsername = resolvedUser.username;
        const selfDiv = resolvedUser.sales_division;
        // selfFullName bisa berupa full name ("Handono Sugianto") atau nama singkat ("Handono")
        // DB ticket sales_name sering menyimpan nama pertama atau username - cek keduanya
        const selfFullName = (freshUser?.full_name || (resolvedUser as any).full_name) as string | undefined;
        const selfFirstName = selfFullName?.split(' ')[0]; // nama pertama saja
        // Helper: apakah ticket ini "milik" user ini
        const isMyTicket = (t: Ticket) =>
          t.created_by === selfUsername ||
          (selfFullName && t.sales_name === selfFullName) ||
          (selfFirstName && t.sales_name === selfFirstName) ||
          t.sales_name === selfUsername;

        // Semua ticket milik sendiri, lewat SEMUA jalur kepemilikan sekaligus.
        //
        // Jalur pertama sales_user_id adalah yang benar: ia menunjuk orangnya,
        // bukan tulisan namanya. Empat jalur berikutnya mencocokkan teks, dan
        // sengaja DIPERTAHANKAN karena baris lama banyak yang uuid-nya masih
        // kosong - sql/identitas-uuid.sql menolak menebak nama yang ambigu.
        //
        // Kelimanya digabung jadi satu .or() alih-alih lima query berurutan:
        // hasilnya sama persis, tapi satu perjalanan ke basis data, bukan lima.
        //
        // Jalur nama dan jalur uuid disimpan TERPISAH lalu digabung, bukan
        // digabung lalu dipisah lagi. Memisah ulang dengan split(",") akan
        // mencacah nama yang memuat koma - "Rio, Putra" jadi dua potongan
        // sintaks rusak, dan seluruh filternya ditolak.
        const klausaNama = [
          `created_by.eq.${kutipNilai(selfUsername)}`,
          selfFullName ? `sales_name.eq.${kutipNilai(selfFullName)}` : null,
          (selfFirstName && selfFirstName !== selfFullName)
            ? `sales_name.eq.${kutipNilai(selfFirstName)}` : null,
          `sales_name.eq.${kutipNilai(selfUsername)}`,
        ].filter(Boolean) as string[];

        // Jalur uuid dilepas kalau basis datanya belum punya kolomnya - lihat
        // catatan di lib/identitas.ts. Tanpa itu, satu deploy yang mendahului
        // SQL-nya akan membuat list ticket Sales kosong sama sekali.
        const klausaMilik = [`sales_user_id.eq.${resolvedUser.id}`, ...klausaNama].join(",");
        const klausaMilikTanpaUuid = klausaNama.join(",");

        const ownBase: Ticket[] = [];
        const addOwn = (t: Ticket) => { if (!ownBase.find(x => x.id === t.id)) ownBase.push(t); };
        const { data: milikSaya } = await cobaIdentitas(async pakaiUuid => await supabase.from("tickets")
          .select("*, activity_logs(*)")
          .or(pakaiUuid ? klausaMilik : klausaMilikTanpaUuid)
          .order("created_at", { ascending: false }));
        (milikSaya ?? []).forEach(addOwn);

        // Sales Internal (IVP/MVI): lihat ticket dari semua divisi yang dia handle
        // (division_ivp_mappings) - ini yang mewujudkan "CC ke list ticket" utk
        // Troubleshooting (fast-track, tanpa gerbang approval, tapi tetap visible).
        const isIVP = selfDiv === "IVP" || selfDiv === "MVI";
        if (isIVP) {
          // IVP/MVI guest: lihat ticket divisi yg dia handle, TAPI hanya utk BRAND yg dia
          // pegang (division_ivp_mappings.brand_type). Ticket lama tanpa brand / brand BOTH /
          // guest dgn mapping legacy (brand_type null)  tetap tampil (backward compat).
          const { data: ivpDivMaps } = await supabase.from("division_ivp_mappings").select("sales_division, brand_type").eq("ivp_id", resolvedUser.id);
          const myBrandMaps = (ivpDivMaps ?? []) as { sales_division: string; brand_type: string | null }[];
          const handledDivisions = Array.from(new Set(myBrandMaps.map(m => m.sales_division)));
          let ivpTickets: Ticket[] = [...ownBase];
          const addIVP = (t: Ticket) => { if (!ivpTickets.find(x => x.id === t.id)) ivpTickets.push(t); };
          if (handledDivisions.length > 0) {
            const { data: divTickets } = await supabase.from("tickets").select("*, activity_logs(*)").in("sales_division", handledDivisions).order("created_at", { ascending: false });
            (divTickets ?? []).forEach((t: Ticket) => {
              const tBrand = (t.brand ?? null) as string | null;
              const myBrands = myBrandMaps.filter(m => m.sales_division === t.sales_division).map(m => m.brand_type);
              const match = !tBrand || tBrand === "BOTH" || myBrands.includes(tBrand) || myBrands.includes(null);
              if (match) addIVP(t);
            });
          }
          // Ticket yg secara eksplisit di-CC ke guest ini (internal_sales_id / _2) - brand match.
          const { data: byInternalId } = await supabase.from("tickets").select("*, activity_logs(*)")
            .or(`internal_sales_id.eq.${resolvedUser.id},internal_sales_id_2.eq.${resolvedUser.id}`).order("created_at", { ascending: false });
          (byInternalId ?? []).forEach(addIVP);
          // Sort akhir berdasarkan created_at descending
          ivpTickets.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
          setTickets(ivpTickets);
          if (selectedTicket && !ivpTickets.find((t: Ticket) => t.id === selectedTicket.id)) setSelectedTicket(null);
        } else {
          // Non-IVP guest: mulai dari semua ticket milik sendiri (sudah di ownBase)
          let finalTickets: Ticket[] = [...ownBase];
          const addUnique = (t: Ticket) => { if (!finalTickets.find(x => x.id === t.id)) finalTickets.push(t); };

          // Cek apakah user terdaftar sebagai supervisor di division_supervisor_mappings
          const { data: supMaps } = await supabase.from("division_supervisor_mappings")
            .select("sales_division").eq("supervisor_id", resolvedUser.id);
          const supervisedDivisions = (supMaps ?? []).map((m: any) => m.sales_division as string);

          // Auto: jika punya jabatan tier > 1, otomatis supervisi divisi sendiri
          if (selfDiv && selfTier > 1 && !supervisedDivisions.includes(selfDiv)) {
            supervisedDivisions.push(selfDiv);
          }

          // Cek user_supervisor_mappings - user yang secara manual di-CC ke user ini
          const { data: userSupMapsData } = await supabase.from("user_supervisor_mappings")
            .select("user_id").eq("supervisor_id", resolvedUser.id);
          const manualSubordinateIds = new Set((userSupMapsData ?? []).map((m: any) => m.user_id as string));

          const isSupervisor = (supervisedDivisions.length > 0 && selfTier > 0) || manualSubordinateIds.size > 0;

          if (isSupervisor) {
            // Ambil SEMUA guest users untuk build tier lookup
            const { data: allGuestUsers } = await supabase.from("users")
              .select("id, username, full_name, jabatan, sales_division")
              .eq("role", "guest");

            const idToTier: Record<string, number> = {};
            const nameTierMap: Record<string, number> = {};
            const nameToId: Record<string, string> = {};
            (allGuestUsers ?? []).forEach((u: any) => {
              const tier = u.jabatan ? (JABATAN_TIER[u.jabatan as string] ?? 0) : 0;
              idToTier[u.id] = tier;
              if (u.full_name) { nameTierMap[u.full_name] = tier; nameToId[u.full_name] = u.id; }
              if (u.username) { nameTierMap[u.username] = tier; nameToId[u.username] = u.id; }
              if (u.full_name) {
                const firstName = u.full_name.split(' ')[0];
                if (!nameTierMap[firstName]) { nameTierMap[firstName] = tier; nameToId[firstName] = u.id; }
              }
            });

            // Semua user id dengan tier < selfTier DAN berada di divisi yang di-supervisi
            // (atau di-mapping manual). Tidak boleh lintas divisi sembarangan.
            const subordinateIds = new Set(
              (allGuestUsers ?? []).filter((u: any) => {
                if (idToTier[u.id] >= selfTier) return false; // tier harus lebih rendah
                // Boleh masuk jika:
                // 1. Divisinya ada di supervisedDivisions (termasuk divisi sendiri jika tier > 1), ATAU
                // 2. Di-mapping manual via user_supervisor_mappings
                const inSupervisedDiv = supervisedDivisions.length > 0 && u.sales_division && supervisedDivisions.includes(u.sales_division);
                const inManualMap = manualSubordinateIds.has(u.id);
                return inSupervisedDiv || inManualMap;
              }).map((u: any) => u.id as string)
            );
            const subordinateUsernames = new Set(
              (allGuestUsers ?? []).filter((u: any) => subordinateIds.has(u.id)).map((u: any) => u.username as string)
            );

            // Ambil ticket dari divisi yang di-supervisi
            let allDivTickets: Ticket[] = [];
            if (supervisedDivisions.length > 0) {
              const { data: dt } = await supabase.from("tickets")
                .select("*, activity_logs(*)")
                .in("sales_division", supervisedDivisions)
                .order("created_at", { ascending: false });
              if (dt) allDivTickets = dt;
            }

            // Tambah ticket dari manual subordinates (bisa beda divisi)
            if (manualSubordinateIds.size > 0) {
              const manualUsers = (allGuestUsers ?? []).filter((u: any) => manualSubordinateIds.has(u.id));
              const manualUsernames = manualUsers.map((u: any) => u.username).filter(Boolean);
              if (manualUsernames.length > 0) {
                const { data: manualTickets } = await supabase.from("tickets")
                  .select("*, activity_logs(*)")
                  .in("created_by", manualUsernames)
                  .order("created_at", { ascending: false });
                (manualTickets ?? []).forEach((t: Ticket) => {
                  if (!allDivTickets.find(x => x.id === t.id)) allDivTickets.push(t);
                });
              }
            }

            // Fallback: ticket tanpa sales_division tapi sales_name = bawahan (divisi valid)
            // Menangkap ticket yang dibuat admin/superadmin untuk bawahan di divisi yang disupervisi,
            // dimana sales_division tidak diisi, sehingga query .in("sales_division") melewatinya.
            // subordinateNames sudah terfilter hanya bawahan yang divisinya valid (subordinateIds).
            try {
              const allSubordinateUsers = (allGuestUsers ?? []).filter((u: any) =>
                subordinateIds.has(u.id) || manualSubordinateIds.has(u.id)
              );
              const subordinateNames = Array.from(new Set(
                allSubordinateUsers.flatMap((u: any) => [
                  u.full_name,
                  u.username,
                  u.full_name ? u.full_name.split(' ')[0] : null,
                ].filter(Boolean))
              )) as string[];
              if (subordinateNames.length > 0) {
                const { data: noDivTickets } = await supabase.from("tickets")
                  .select("*, activity_logs(*)")
                  .in("sales_name", subordinateNames)
                  .is("sales_division", null)
                  .order("created_at", { ascending: false });
                (noDivTickets ?? []).forEach((t: Ticket) => {
                  if (!allDivTickets.find(x => x.id === t.id)) allDivTickets.push(t);
                });
                // TIDAK mengambil ticket dari divisi lain berdasarkan nama bawahan saja.
                // Akses lintas divisi HARUS melalui explicit mapping di
                // division_supervisor_mappings atau user_supervisor_mappings.
              }
            } catch { }

            allDivTickets.forEach((t: Ticket) => {
              // Ticket milik sendiri selalu masuk
              if (isMyTicket(t)) { addUnique(t); return; }

              // Cek via created_by username  apakah bawahan yang valid (divisi + tier)
              if (t.created_by && subordinateUsernames.has(t.created_by)) { addUnique(t); return; }

              // Cek via manual subordinate
              const ownerId = t.sales_name ? nameToId[t.sales_name] : null;
              if (ownerId && manualSubordinateIds.has(ownerId)) { addUnique(t); return; }

              // Cek via sales_name: userId harus ada di subordinateIds
              // (sudah tervalidasi divisi + tier - tidak lolos hanya karena tier saja)
              if (t.sales_name) {
                const salesUserId = nameToId[t.sales_name];
                if (salesUserId && subordinateIds.has(salesUserId)) { addUnique(t); return; }
              }
            });

            
          } else {
            // Guest biasa: HANYA ticket milik sendiri berdasarkan sales_name atau created_by
            if (selfDiv) {
              const { data: divTickets } = await supabase.from("tickets")
                .select("*, activity_logs(*)")
                .eq("sales_division", selfDiv)
                .order("created_at", { ascending: false });
              (divTickets ?? []).forEach((t: Ticket) => {
                if (isMyTicket(t)) addUnique(t);
              });
            }
          }

          // Sort akhir berdasarkan created_at descending - gabungan ticket sendiri + bawahan
          finalTickets.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
          setTickets(finalTickets);
          if (selectedTicket && !finalTickets.find((t: Ticket) => t.id === selectedTicket.id)) setSelectedTicket(null);
        }
      } else {
        const { data: ticketsData } = await supabase.from("tickets").select("*, activity_logs(*)").order("created_at", { ascending: false });
        let mergedTickets: Ticket[] = ticketsData || [];
        // Visibility (catatan spec): anggota tim biasa (bukan admin/superadmin,
        // bukan Manager) TIDAK lihat ticket yg masih pending approval / belum
        // di-assign. Yg di-route ke Supervisor hanya tampil ke Supervisor ybs.
        // Admin & Manager tetap lihat semua.
        const roleLc2 = (activeUser?.role ?? "").toLowerCase();
        const isAdminUser2 = roleLc2 === "admin" || roleLc2 === "superadmin";
        const isManagerUser2 = hasFullAccess(activeUser);
        if (!isAdminUser2 && !isManagerUser2) {
          mergedTickets = mergedTickets.filter((t) =>
            t.status !== "Waiting Approval" &&
            !(t.routing_status === "supervisor_assign" && t.assigned_supervisor_id !== activeUser?.id)
          );
        }
        try {
          // Ambil HANYA log milik ticket yang benar-benar tampil. Menarik
          // seluruh activity_logs lalu menyaringnya di browser berarti log
          // ticket organisasi lain ikut terunduh, dan ukurannya tumbuh terus.
          const idTampil = mergedTickets.map((t: Ticket) => t.id).filter(Boolean);
          const svcLogs: ActivityLog[] = [];
          for (let i = 0; i < idTampil.length; i += 100) {
            const { data } = await supabaseServices.from("activity_logs")
              .select("id,ticket_id,handler_name,handler_username,action_taken,notes,file_url,file_name,photo_url,photo_name,new_status,team_type,assigned_to_services,created_at")
              .in("ticket_id", idTampil.slice(i, i + 100))
              .order("created_at", { ascending: false });
            if (data) svcLogs.push(...(data as ActivityLog[]));
          }
          if (svcLogs.length > 0) {
            mergedTickets = mergedTickets.map((ticket: Ticket) => {
              const svcTicketLogs = svcLogs.filter((l: ActivityLog) => l.ticket_id === ticket.id);
              if (svcTicketLogs.length === 0) return ticket;
              const existingLogs = ticket.activity_logs || [];
              const allLogs = [...existingLogs, ...svcTicketLogs].reduce((acc: ActivityLog[], log: ActivityLog) => {
                if (!acc.find((l) => l.id === log.id)) acc.push(log);
                return acc;
              }, []);
              allLogs.sort((a: ActivityLog, b: ActivityLog) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              return { ...ticket, activity_logs: allLogs };
            });
          }
        } catch { }
        setTickets(mergedTickets);
      }
      if (membersData.data) setTeamMembers(membersData.data);
      if (usersData.data) setUsers(usersData.data);
      if (!silent) { setLoading(false); setTicketsLoading(false); }
      else { setLoading(false); }
      // Fetch warranty/project reference data (fire-and-forget, non-blocking)
      fetchProjectReminders();
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
          const { data: adminUsers } = await supabase
            .from("users")
            .select("id, phone_number, full_name")
            .in("role", ["admin", "superadmin"])
            .not("phone_number", "is", null)
            .neq("phone_number", "");
          // Manager - role='team' TIDAK ke-cover query role admin di atas, jadi
          // ditambah terpisah supaya notifikasi ke Manager datang BERSAMAAN
          // dengan admin (bukan menyusul). Dua sumber, dedup by id:
          //   1. akun Team PTS ber-toggle "Full Access" (cara yang disarankan)
          //   2. app_settings.manager_user_id (override lama, tetap didukung)
          const approvers: { id: string; phone_number: string; full_name: string }[] = [...((adminUsers as any[]) ?? [])];
          try {
            const { data: fullAccess } = await supabase.from("users")
              .select("id, phone_number, full_name").eq("role", "team").eq("access_level", "full");
            ((fullAccess as any[]) ?? []).forEach(u => { if (!approvers.find(a => a.id === u.id)) approvers.push(u); });
          } catch { }
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
                sendWANotif({ type: "reminder_wa", target: a.phone_number, message: waMsg })
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
              await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", target: t.phone, message: ccMsg })));
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
            await sendWANotif({ type: "reminder_wa", target: supUser.phone_number, message: waMsg });
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
            await sendWANotif({ type: "reminder_wa", target: handlerInfo.phone_number, message: waMsg });
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
  const approveTicket = async (ticketArg?: Ticket | null, assigneeArg?: string) => {
    const tk = ticketArg ?? approvalTicket;
    const asg = assigneeArg ?? approvalAssignee;
    if (!tk || !asg) { notify("error", "Please select a Team PTS IVP member to assign!"); return; }
    try {
      setApprovingId(tk.id);
      setUploading(true);
      // Route ke Supervisor: approve tapi belum assign ke handler. Supervisor
      //    yang lanjut assign ke anggota tim (atau kerjakan sendiri).
      if (asg.startsWith("SUP::")) {
        const [, supId, supName] = asg.split("::");
        // .eq('status','Waiting Approval') + cek baris: kalau admin lain
        // sudah lebih dulu meng-approve ticket yang sama (2 tab/2 admin
        // bersamaan), update ini sengaja tidak menyentuh baris apa pun -
        // tanpa pengecekan ini WA & notifikasi di bawah tetap terkirim ganda
        // walau approval kedua sebenarnya tidak pernah benar-benar tersimpan.
        const { data: routeRows, error: routeErr } = await supabase.from("tickets").update({
          status: "Pending", assign_name: "",
          routing_status: "supervisor_assign", assigned_supervisor_id: supId,
        }).eq("id", tk.id).eq("status", "Waiting Approval").select("id");
        if (routeErr) throw routeErr;
        if (!routeRows || routeRows.length === 0) {
          notify("error", "Ticket ini sudah diproses lebih dulu (mungkin oleh admin lain). Silakan refresh.");
          return;
        }
        try {
          const supMember = teamMembers.find(m => m.id === supId);
          const { data: supUser } = supMember?.username
            ? await supabase.from("users").select("id, phone_number, full_name").eq("username", supMember.username).maybeSingle()
            : { data: null };
          if (supUser?.id) createNotification({ user_id: supUser.id, type: 'ticket', title: '🎯 Ticket perlu kamu assign', body: `${tk.project_name} — ${tk.issue_case}`, action_url: '/ticketing', ref_id: tk.id, created_by: currentUser?.full_name || '' }).catch(() => {});
          if (supUser?.phone_number) {
            const waMsg = [
              "🎯 *Ticket Perlu Di-assign ke Tim*",
              "━━━━━━━━━━━━━━━━━━",
              `Halo *${supUser.full_name || supName}*, ticket sudah diapprove Admin — silakan assign ke anggota tim / kerjakan sendiri:`,
              `📌 *Project :* ${tk.project_name}`,
              `⚠️ *Issue   :* ${tk.issue_case}`,
              "━━━━━━━━━━━━━━━━━━",
              `🔗 ${appLink()}`,
            ].join("\n");
            await sendWANotif({ type: "reminder_wa", target: supUser.phone_number, message: waMsg });
          }
        } catch { }
        logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'ticket', target_id: tk.id, target_name: tk.project_name, notes: `Routed to supervisor: ${supName}` }).catch(() => {});
        selesaikanSatuApproval(tk.id);
        await fetchData();
        notify("success", `Ticket diteruskan ke Supervisor ${supName} untuk di-assign`);
        return;
      }
      // Assign langsung (bukan route). Kolom routing TIDAK ditulis di sini supaya
      // tetap jalan walau migrasi supervisor belum di-run (ticket "Waiting Approval"
      // yg di-approve langsung tak pernah punya routing_status).
      // .eq('status','Waiting Approval') + cek baris: sama seperti cabang
      // route-ke-supervisor di atas - mencegah 2 admin men-approve ticket
      // yang sama ke 2 handler berbeda tanpa saling tahu (yang terakhir
      // menang diam-diam, WA terkirim ke keduanya).
      const { data: rows, error } = await supabase.from("tickets")
        .update({ status: "Pending", assign_name: asg }).eq("id", tk.id).eq("status", "Waiting Approval").select("id");
      if (error) throw error;
      if (!rows || rows.length === 0) {
        notify("error", "Ticket ini sudah diproses lebih dulu (mungkin oleh admin lain). Silakan refresh.");
        return;
      }
      if (tk.created_by) {
        const creatorUser = users.find((u) => u.username === tk.created_by);
        if (creatorUser && creatorUser.role === "guest" && creatorUser.id) {
          // Notify guest/sales bahwa ticket mereka sudah diproses
          void createNotification({ user_id: creatorUser.id, type: 'ticket', title: `🎫 Ticket disetujui`, body: `${tk.project_name} — ditugaskan ke ${asg}`, action_url: '/ticketing', ref_id: tk.id, created_by: currentUser?.full_name || '' });
        }
      }
      // WA ke handler yang di-assign
      try {
        // Cari handler dari teamMembers state (sudah load dari users)
        const tm = teamMembers.find(m => m.name === asg);
        const { data: handlerUser } = tm?.username ? await supabase
          .from("users").select("phone_number, full_name")
          .eq("username", tm.username).maybeSingle() : { data: null };
        // In-app notification (using notifications table)
        if (handlerUser) {
          const { data: handlerFull } = await supabase.from('users').select('id').eq('username', tm!.username).maybeSingle();
          if (handlerFull?.id) {
            notifyTicketAssigned(
              handlerFull.id, asg, tk.id,
              tk.project_name, currentUser?.full_name ?? 'Admin'
            ).catch(() => {});
          }
        }
        // Audit log
        logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'assign', module: 'ticket', target_id: tk.id, target_name: tk.project_name, new_value: asg }).catch(() => {});
        if (handlerUser?.phone_number) {
          const waMsg = [
            "🎫 *Ticket Assigned ke Kamu*",
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            `Halo *${handlerUser?.full_name || "Handler"}*, ada ticket untukmu:`,
            "",
            `📌 *Project :* ${tk.project_name}`,
            `⚠️ *Issue   :* ${tk.issue_case}`,
            `📅 *Tanggal :* ${tk.date || "-"}`,
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            "Mohon segera ditangani. Semangat! 💪",
            `🔗 ${appLink()}`,
          ].join("\n");
          await sendWANotif({ type: "reminder_wa", target: handlerUser.phone_number, message: waMsg });
        }
      } catch (err: any) {
        console.warn('[ticket] WA to handler (approval) failed:', err?.message);
        notify('error', 'WA ke handler gagal dikirim. Ticket berhasil di-approve.');
      }
      // CC ke atasan + IVP berdasarkan divisi creator ticket
      try {
        const creatorUser = tk.created_by ? users.find((u) => u.username === tk.created_by) : null;
        const ccDiv = (tk as any).sales_division ?? creatorUser?.sales_division ?? "";
        if (ccDiv && ccDiv !== "IVP" && creatorUser?.id) {
          const ccTargets = await fetchWACCTargets(creatorUser.id, ccDiv);
          if (ccTargets.length > 0) {
            const ccMsg = [
              `✅ *[CC] Ticket Diapprove — Divisi ${ccDiv}*`,
              "━━━━━━━━━━━━━━━━━━",
              `📌 *Project  :* ${tk.project_name}`,
              `⚠️ *Issue    :* ${tk.issue_case}`,
              `👷 *Handler  :* ${asg}`,
              "━━━━━━━━━━━━━━━━━━",
              `📋 *CC ke   :* ${ccTargets.map(t => t.name + (t.relation === "ivp_handler" ? " (IVP)" : "")).join(", ")}`,
              `🔗 ${appLink()}`,
            ].join("\n");
            await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", target: t.phone, message: ccMsg })));
          }
        }
      } catch { }
      selesaikanSatuApproval(tk.id);
      await fetchData();
      notify("success", `Ticket approved & assigned to ${asg}`);
    } catch (err: any) { notify("error", "Error: " + err.message); } finally { setUploading(false); setApprovingId(null); }
  };

  // Ticket & handler baris INI dikirim eksplisit — bukan lewat state bersama —
  // supaya yang diproses tidak mungkin tertukar dengan baris lain di modal
  // Approval yang sama.
  const jalankanApproveTicket = async (ticket: Ticket) => {
    const pilihan = approvalAssignees[ticket.id];
    if (!pilihan) { notify("error", "Pilih handler atau Supervisor terlebih dahulu!"); return; }
    await approveTicket(ticket, pilihan);
  };

  // Pembuka aksi baris tiket (mobile card + tabel desktop) - dikumpulkan di
  // satu tempat supaya kedua tampilan memanggil handler yang SAMA, bukan
  // masing-masing menulis ulang urutan setState-nya sendiri.
  const bukaDetailTicket = (ticket: Ticket) => { setSelectedTicket(ticket); setShowTicketDetailPopup(true); };
  const bukaRingkasanAktivitas = (ticket: Ticket) => { setSummaryTicket(ticket); setShowActivitySummary(true); };
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
  const handleSupervisorAssignTicket = async () => {
    if (!supAssignTicket || !supAssignTo) { notify("error", "Pilih anggota tim atau kerjakan sendiri!"); return; }
    setSupAssignSaving(true);
    try {
      // 'SELF' = Supervisor kerjakan sendiri
      const isSelf = supAssignTo === "SELF";
      const assigneeName = isSelf ? (currentUser?.full_name ?? "") : supAssignTo;
      // assigned_supervisor_id SENGAJA TIDAK ikut dikosongkan di update yang
      // sama: RLS tk_update mengizinkan Supervisor menulis baris ini lewat
      // assigned_supervisor_id = dirinya sendiri. WITH CHECK dievaluasi
      // terhadap baris BARU (bukan lama) - kalau kolom itu ikut di-null-kan
      // di sini, tidak ada syarat lain yang cocok dan RLS diam-diam menolak
      // (0 baris, tanpa error) walau WA sudah kadung terkirim.
      const { error, data } = await supabase.from("tickets").update({
        status: "Pending", assign_name: assigneeName,
        routing_status: null,
      }).eq("id", supAssignTicket.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Perubahan ditolak sistem (RLS). Hubungi admin.");
      // WA + badge ke anggota tim yg di-assign (kalau bukan Supervisor sendiri)
      if (!isSelf) {
        try {
          const tm = teamMembers.find(m => m.name === assigneeName);
          const { data: handlerUser } = tm?.username
            ? await supabase.from("users").select("id, phone_number, full_name").eq("username", tm.username).maybeSingle()
            : { data: null };
          if (handlerUser?.id) notifyTicketAssigned(handlerUser.id, assigneeName, supAssignTicket.id, supAssignTicket.project_name, currentUser?.full_name ?? 'Supervisor').catch(() => {});
          if (handlerUser?.phone_number) {
            const waMsg = [
              "🎫 *Ticket Assigned ke Kamu*",
              "━━━━━━━━━━━━━━━━━━",
              `Halo *${handlerUser.full_name || assigneeName}*, kamu di-assign Supervisor *${currentUser?.full_name}*:`,
              `📌 *Project :* ${supAssignTicket.project_name}`,
              `⚠️ *Issue   :* ${supAssignTicket.issue_case}`,
              "━━━━━━━━━━━━━━━━━━",
              "Mohon segera ditangani. Semangat! 💪",
              `🔗 ${appLink()}`,
            ].join("\n");
            await sendWANotif({ type: "reminder_wa", target: handlerUser.phone_number, message: waMsg });
          }
        } catch { }
      }
      logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'assign', module: 'ticket', target_id: supAssignTicket.id, target_name: supAssignTicket.project_name, new_value: assigneeName }).catch(() => {});
      setSupAssignTicket(null); setSupAssignTo("");
      await fetchData();
      notify("success", isSelf ? "Kamu jadi handler ticket ini!" : `Ticket di-assign ke ${assigneeName}`);
    } catch (err: any) { notify("error", "Error: " + err.message); }
    finally { setSupAssignSaving(false); }
  };

  /** Buka panel admin dengan nilai ticket saat ini. */
  const bukaAdminEdit = (t: Ticket) => {
    const isi: Record<string, unknown> = {};
    for (const f of TICKET_ADMIN_FIELDS) isi[f.key] = (t as unknown as Record<string, unknown>)[f.key] ?? '';
    setAdminEditForm(isi);
    setAdminRerouteTo('');
    setAdminEditTicket(t);
  };

  /**
   * Simpan perubahan admin: koreksi field dan/atau pengalihan pekerjaan.
   *
   * Urutannya disengaja - simpan dulu, baru beri tahu. Kalau WA dikirim
   * duluan lalu penyimpanannya gagal, orang sudah terlanjur diberi tahu soal
   * perubahan yang tidak pernah terjadi.
   */
  const simpanAdminEdit = async () => {
    if (!adminEditTicket) return;
    const t = adminEditTicket;
    const lama = t as unknown as Record<string, unknown>;
    const perubahan = bandingkan(TICKET_ADMIN_FIELDS, lama, adminEditForm);
    const adaReroute = adminRerouteTo !== '';

    if (perubahan.length === 0 && !adaReroute) { notify('error', 'Tidak ada yang diubah.'); return; }

    setAdminEditSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const x of perubahan) payload[x.key] = adminEditForm[x.key] === '' ? null : adminEditForm[x.key];

      // Pengalihan pekerjaan
      let penerimaBaru = '';
      let labelTujuanLama = t.assign_name || '';
      if (adaReroute) {
        if (adminRerouteTo.startsWith('SUP::')) {
          const [, supId, supName] = adminRerouteTo.split('::');
          payload.routing_status = 'supervisor_assign';
          payload.assigned_supervisor_id = supId;
          payload.assign_name = '';
          payload.status = 'Waiting Approval';
          penerimaBaru = supName;
        } else {
          const nama = adminRerouteTo === 'SELF' ? (currentUser?.full_name ?? '') : adminRerouteTo;
          payload.routing_status = null;
          payload.assigned_supervisor_id = null;
          payload.assign_name = nama;
          // Status hanya diturunkan ke Pending kalau memang belum jalan -
          // dan bolehReroute sudah menjamin itu, jadi tidak ada progress hilang.
          payload.status = 'Pending';
          penerimaBaru = nama;
        }
        if (!labelTujuanLama && t.assigned_supervisor_id) {
          labelTujuanLama = teamMembers.find(m => m.id === t.assigned_supervisor_id)?.name ?? '';
        }
      }

      const { error, data } = await supabase.from('tickets').update(payload).eq('id', t.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Perubahan ditolak sistem (RLS). Hubungi admin.');

      // Catat ke audit
      const catatan = [
        adaReroute ? `Re-route: ${labelTujuanLama || '(belum ada)'} → ${penerimaBaru}` : '',
        perubahan.length ? ringkasPerubahan(perubahan) : '',
      ].filter(Boolean).join(' | ');
      void logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: adaReroute ? 'assign' : 'update', module: 'ticket',
        target_id: t.id, target_name: String(adminEditForm.project_name ?? t.project_name),
        notes: catatan,
      });

      // Beri tahu lewat WA
      // Dikirim ke penerima BARU kalau dialihkan, dan ke penanganya sekarang
      // kalau cuma koreksi data. Keduanya sama-sama perlu tahu.
      const targetNama = penerimaBaru || t.assign_name || '';
      if (targetNama && targetNama !== currentUser?.full_name) {
        try {
          const tm = teamMembers.find(m => m.name === targetNama);
          const { data: u } = tm?.username
            ? await supabase.from('users').select('id, phone_number, full_name').eq('username', tm.username).maybeSingle()
            : { data: null };
          if (u?.id) {
            void createNotification({
              user_id: u.id, type: 'ticket',
              title: adaReroute ? '🔀 Ticket dialihkan ke kamu' : '✏️ Detail ticket diperbarui',
              body: `${adminEditForm.project_name ?? t.project_name} — oleh ${currentUser?.full_name ?? 'Admin'}`,
              action_url: '/ticketing', ref_id: t.id, created_by: currentUser?.full_name ?? 'Admin',
            });
          }
          if (u?.phone_number) {
            await sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesanWAPerubahan({
              namaPenerima: u.full_name || targetNama,
              namaPengubah: currentUser?.full_name ?? 'Admin',
              judulItem: String(adminEditForm.project_name ?? t.project_name),
              jenisItem: 'Ticket',
              perubahan,
              reroute: adaReroute ? { dari: labelTujuanLama, ke: penerimaBaru } : null,
              tautan: appLink('/ticketing'),
            }) });
          }
        } catch { /* WA gagal tidak boleh membatalkan perubahan yang sudah tersimpan */ }
      }

      setAdminEditTicket(null);
      await fetchData();
      notify('success', adaReroute ? `Dialihkan ke ${penerimaBaru}` : `${perubahan.length} perubahan tersimpan`);
    } catch (err: any) {
      notify('error', 'Gagal menyimpan: ' + err.message);
    } finally { setAdminEditSaving(false); }
  };

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
          await sendWANotif({ type: "reminder_wa", target: reopenHandler.phone_number, message: waMsg });
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
  const kabarkanTicketSelesai = async (t: Ticket, catatan: string) => {
    try {
      const penutup = currentUser?.full_name || t.assign_name || 'Tim';

      //  Semua pihak dikumpulkan dulu, lalu dicari sekali - bukan satu query
      //  per orang. Nama & username dipakai berdampingan karena tabel ticket
      //  menyimpan sebagian pihak sebagai nama dan sebagian sebagai username.
      const nama = [t.sales_name, t.assign_name].filter(Boolean) as string[];
      const username = [t.created_by].filter(Boolean) as string[];
      const idOrang = [t.assigned_supervisor_id, t.internal_sales_id, t.internal_sales_id_2]
        .filter(Boolean) as string[];

      const [resNama, resUser, resId] = await Promise.all([
        nama.length ? supabase.from('users').select('id,full_name,username,phone_number').in('full_name', nama)
                    : Promise.resolve({ data: [] as any[] }),
        username.length ? supabase.from('users').select('id,full_name,username,phone_number').in('username', username)
                        : Promise.resolve({ data: [] as any[] }),
        idOrang.length ? supabase.from('users').select('id,full_name,username,phone_number').in('id', idOrang)
                       : Promise.resolve({ data: [] as any[] }),
      ]);

      const semua = new Map<string, { id: string; full_name: string; username: string; phone_number: string | null }>();
      for (const u of [...(resNama.data ?? []), ...(resUser.data ?? []), ...(resId.data ?? [])]) {
        if (u?.id) semua.set(u.id, u);
      }

      const garis = '━━━━━━━━━━━━━━━━━━';
      const ringkas = [
        `📌 *Project :* ${t.project_name}`,
        `⚠️ *Issue   :* ${t.issue_case}`,
        `🙋 *Ditangani:* ${t.assign_name || penutup}`,
        catatan ? `📝 *Catatan :* ${catatan}` : '',
      ].filter(Boolean).join('\n');

      for (const u of semua.values()) {
        const dia = u.id === currentUser?.id;
        const pesan = dia
          ? ['🎉 *Terima Kasih!*', garis,
             `Halo *${u.full_name}*, ticket ini sudah kamu tutup sebagai *Solved*.`,
             ringkas, garis,
             'Terima kasih atas kerja kerasnya! 🙌',
             `🔗 ${appLink()}`].join('\n')
          : ['✅ *Ticket Selesai*', garis,
             `Halo *${u.full_name}*, ticket berikut sudah diselesaikan oleh *${penutup}*:`,
             ringkas, garis,
             'Silakan dicek bila masih ada yang perlu ditindaklanjuti.',
             `🔗 ${appLink()}`].join('\n');

        //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus (lihat
        //  lib/wa.ts) - jadi tidak perlu dipanggil dua kali di sini.
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan });
        void createNotification({
          user_id: u.id, type: 'ticket',
          title: dia ? '🎉 Terima kasih — ticket selesai' : '✅ Ticket selesai',
          body: `${t.project_name} — ${t.issue_case}`,
          action_url: '/ticketing', ref_id: t.id,
          created_by: penutup,
        });
      }
    } catch {
      //  Kabar yang gagal tidak boleh membatalkan penyelesaian ticketnya -
      //  pekerjaannya sudah benar-benar selesai, apa pun nasib notifikasinya.
    }
  };

  /**
   * Tutup jadwal Reminder Schedule yang lahir dari ticket ini.
   *
   * KENAPA SEARAH SAJA (ticket -> reminder, bukan sebaliknya)
   *
   * Ticket adalah sumber kebenaran pekerjaan troubleshooting; reminder yang
   * dibuat otomatis saat status Onsite hanyalah bayangan jadwalnya. Kalau
   * dibuat dua arah, menutup reminder akan ikut menutup ticket - padahal
   * ticket punya syarat penyelesaiannya sendiri (catatan aktivitas, lampiran,
   * serah terima Team Services) yang akan terlewati begitu saja.
   *
   * KENAPA HANYA KATEGORI TROUBLESHOOTING
   *
   * Menyelesaikan reminder kategori Konfigurasi/Training memicu Form Review
   * dan perhitungan insentif, dan menuntut tanggal BAST diisi lebih dulu.
   * Menutupnya dari sini akan melewati langkah-langkah itu diam-diam - uang
   * dan dokumen serah terima bukan hal yang boleh dilewati program. Reminder
   * yang lahir dari Ticketing selalu berkategori Troubleshooting, yang tidak
   * memicu keduanya, jadi penjaga ini sekaligus memastikan hanya jadwal
   * bawaan Ticketing yang tersentuh.
   */
  const tutupJadwalTicket = async (t: Ticket, jadi: 'done' | 'cancelled') => {
    try {
      //  Satu perintah saja: UPDATE ... RETURNING. Menghitung dulu lalu
      //  mengubah membuat dua kebenaran yang bisa berbeda di antaranya.
      const { data: terubah, error } = await supabase.from('reminders')
        .update({ status: jadi })
        .eq('ticket_id', t.id)
        .eq('category', 'Troubleshooting')
        .neq('status', jadi)
        .select('id');

      //  Tidak ada jadwal terkait yang perlu disentuh - itu keadaan normal
      //  (ticket yang tidak pernah lewat status Onsite), bukan kegagalan.
      if (!error && (!terubah || terubah.length === 0)) return;

      //  RLS yang menolak menjawab 0 baris TANPA galat, jadi hasilnya
      //  diperiksa - bukan dianggap berhasil begitu saja.
      if (error) {
        notify('error', 'Ticket tersimpan, tapi jadwal di Reminder Schedule gagal ditutup. Mohon tutup manual.');
        return;
      }
      notify('success', jadi === 'done'
        ? `Jadwal di Reminder Schedule ikut ditutup (${terubah!.length}).`
        : `Jadwal di Reminder Schedule ikut dibatalkan (${terubah!.length}).`);
    } catch {
      /* Ticketnya sendiri sudah tersimpan - kegagalan menutup jadwal tidak
         boleh membatalkannya. */
    }
  };

  const addActivity = async () => {
    const SERVICES_SIMPLE = ["Warranty", "Out Of Warranty", "Waiting PO from Sales", "Submit RMA", "Waiting sparepart"];
    const isSimpleStatus = newActivity.new_status === "Call" || newActivity.new_status === "Onsite";
    const isSvcSimple = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser?.username || "").toLowerCase())?.team_type === "Team Services" && SERVICES_SIMPLE.includes(newActivity.new_status);
    // "In Progress" boleh tanpa notes/action/foto (ganti status saja). "Pending
    // Action" TETAP wajib notes (alasan kendala).
    const noteOptional = isSimpleStatus || isSvcSimple || newActivity.new_status === "In Progress";
    if (!noteOptional && !newActivity.notes) { notify("error", "Notes must be filled!"); return; }
    if (!selectedTicket) { notify("error", "No ticket selected!"); return; }
    const member = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser?.username || "").toLowerCase());
    const teamType = member?.team_type || "Team PTS IVP";
    const isServicesTeam = teamType === "Team Services";
    const validStatusesPTS = ["Waiting Approval", "Pending", "Call", "Onsite", "In Progress", "Pending Action", "Solved"];
    if (isServicesTeam) {
      if (!(SERVICES_STATUSES as readonly string[]).includes(newActivity.new_status)) { notify("error", "Status tidak valid untuk Team Services!"); return; }
    } else {
      if (!validStatusesPTS.includes(newActivity.new_status)) { notify("error", "Invalid status!"); return; }
    }
    // services_assignee no longer required - admin Services will assign internally
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Updating ticket status...");
      let fileUrl = "", fileName = "", photoUrl = "", photoName = "";
      const ALLOWED_IMG = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const MAX_IMG_MB = 5;
      const MAX_PDF_MB = 10;
      if (newActivity.file) {
        if (newActivity.file.type !== 'application/pdf') { notify("error", "File laporan hanya boleh format PDF."); setUploading(false); setShowLoadingPopup(false); return; }
        if (newActivity.file.size > MAX_PDF_MB * 1024 * 1024) { notify("error", `Ukuran PDF maksimal ${MAX_PDF_MB}MB.`); setUploading(false); setShowLoadingPopup(false); return; }
      }
      if (newActivity.photo) {
        if (!ALLOWED_IMG.includes(newActivity.photo.type)) { notify("error", "Foto bukti hanya boleh format JPG, PNG, atau WebP."); setUploading(false); setShowLoadingPopup(false); return; }
        if (newActivity.photo.size > MAX_IMG_MB * 1024 * 1024) { notify("error", `Ukuran foto maksimal ${MAX_IMG_MB}MB.`); setUploading(false); setShowLoadingPopup(false); return; }
      }
      const uploadFileToBucket = async (file: File, folder: string, useServicesDb: boolean = false) => {
        const client = useServicesDb ? supabaseServices : supabase;
        const toUpload = file.type.startsWith('image/') ? await compressImage(file) : file;
        const ext = toUpload.name.split('.').pop()?.toLowerCase() ?? 'bin';
        const filePath = `${folder}/${Date.now()}.${ext}`;
        const { error } = await client.storage.from("ticket-photos").upload(filePath, toUpload, { cacheControl: '31536000' });
        if (error) throw error;
        const { data } = client.storage.from("ticket-photos").getPublicUrl(filePath);
        return { url: data.publicUrl, name: file.name };
      };
      if (newActivity.file) {
        setLoadingMessage("Uploading PDF file...");
        try { const result = await uploadFileToBucket(newActivity.file, "reports", isServicesTeam); fileUrl = result.url; fileName = result.name; } catch (uploadErr: any) { throw new Error(`Failed to upload PDF: ${uploadErr.message}`); }
      }
      if (newActivity.photo) {
        setLoadingMessage("Uploading photo...");
        try { const result = await uploadFileToBucket(newActivity.photo, "photos", isServicesTeam); photoUrl = result.url; photoName = result.name; } catch (uploadErr: any) { throw new Error(`Failed to upload photo: ${uploadErr.message}`); }
      }
      setLoadingMessage("Saving activity log...");
      const SVCSS = ["Warranty", "Out Of Warranty", "Waiting PO from Sales", "Submit RMA", "Waiting sparepart"];
      const isSimpleStatusCalc = newActivity.new_status === "Call" || newActivity.new_status === "Onsite";
      const isSvcSimpleCalc = isServicesTeam && SVCSS.includes(newActivity.new_status);
      const onsiteHasSchedule = newActivity.new_status === "Onsite" && newActivity.onsite_use_schedule && newActivity.onsite_schedule_date;
      const svcSimpleNotes: Record<string, string> = {
        Warranty: "Unit masih dalam masa garansi.",
        "Out Of Warranty": "Unit sudah di luar masa garansi.",
        "Waiting PO from Sales": "Menunggu Purchase Order dari Sales.",
        "Submit RMA": "RMA telah disubmit ke vendor.",
        "Waiting sparepart": "Menunggu kedatangan sparepart.",
      };
      let autoNotes = "";
      if (newActivity.new_status === "Call") autoNotes = "Sedang melakukan Call ke customer.";
      else if (newActivity.new_status === "Onsite") {
        if (onsiteHasSchedule) autoNotes = `Dijadwalkan Onsite pada ${newActivity.onsite_schedule_date} pukul ${newActivity.onsite_schedule_hour}:${newActivity.onsite_schedule_minute} WIB.`;
        else autoNotes = "Tim sedang Onsite ke lokasi customer.";
      } else if (isSvcSimpleCalc) autoNotes = svcSimpleNotes[newActivity.new_status] || newActivity.new_status;
      // Onsite + punya jadwal  status ticket = "Onsite" (bukan Pending)
      // Activity log juga dicatat sebagai "Onsite"
      const effectiveStatus = newActivity.new_status;
      const useAutoNotes = isSimpleStatusCalc || isSvcSimpleCalc;
      const activityData: any = {
        ticket_id: selectedTicket.id,
        handler_name: newActivity.handler_name,
        handler_username: currentUser?.username || "",
        action_taken: useAutoNotes ? "" : newActivity.action_taken || "",
        notes: useAutoNotes ? autoNotes : newActivity.notes,
        new_status: effectiveStatus,
        team_type: teamType,
        assigned_to_services: newActivity.assign_to_services || false,
        file_url: fileUrl || "",
        file_name: fileName || "",
        photo_url: photoUrl || "",
        photo_name: photoName || "",
      };
      const activeClient = isServicesTeam ? supabaseServices : supabase;
      const { error: activityError } = await activeClient.from("activity_logs").insert([activityData]).select();
      if (activityError) throw new Error(`Database error: ${activityError.message}`);
      setLoadingMessage("Updating ticket status...");
      const updateData: any = {};
      if (newActivity.sn_unit) updateData.sn_unit = newActivity.sn_unit;
      if (isServicesTeam) {
        updateData.services_status = effectiveStatus;
        const { error: svcErr } = await supabaseServices.from("tickets").update(updateData).eq("id", selectedTicket.id);
        if (svcErr) throw new Error(`Gagal memperbarui ticket di basis data Services: ${svcErr.message}`);
        // Salin status ke basis data PTS supaya kedua sisi tidak berbeda. Gagal
        // di sini tidak membatalkan pekerjaan Services yang sudah tercatat,
        // tapi harus terlihat - bukan hilang tanpa jejak.
        const { error: ptsErr } = await supabase.from("tickets").update({ services_status: effectiveStatus }).eq("id", selectedTicket.id);
        if (ptsErr) notify("error", `Status tersimpan di Services, tapi gagal disalin ke PTS: ${ptsErr.message}. Refresh lalu ulangi.`);
        // M1 (docs/UX-WORKFLOW-AUDIT.md): dulu HANYA jalur PTS IVP yang kabari
        // semua pihak saat "Solved" - jalur Services (di sini) tidak mengirim
        // apa pun, padahal konsepnya sama-sama "ticket selesai". Sales, handler
        // PTS yang menyerahkan ke Services, dan Supervisor tidak pernah tahu
        // kapan Team Services benar-benar selesai.
        if (effectiveStatus === "Solved") {
          void kabarkanTicketSelesai(selectedTicket, useAutoNotes ? autoNotes : (newActivity.notes || ""));
        }
      } else {
        updateData.status = effectiveStatus;
        if (newActivity.assign_to_services) {
          // ASSIGN TO TEAM SERVICES
          // Dua basis data terpisah, tanpa transaksi bersama. Penyalinan ke
          // basis data Services WAJIB dikerjakan lebih dulu, dan serah
          // terimanya hanya ditulis kalau salinan itu berhasil. Kalau urutannya
          // dibalik, satu penyalinan yang gagal membuat ticket hilang dari
          // kedua sisi: PTS menganggap bukan urusannya lagi, Services tidak
          // pernah menerimanya.
          let mirrorBerhasil = true;
          let mirrorPesan = "";
          try {
            const { data: existSvc, error: cekErr } = await supabaseServices.from("tickets").select("id").eq("id", selectedTicket.id).maybeSingle();
            if (cekErr) throw cekErr;
            if (!existSvc) {
              const { error: insErr } = await supabaseServices.from("tickets").insert([{
                id: selectedTicket.id,
                pts_ticket_id: selectedTicket.id,
                project_name: selectedTicket.project_name,
                address: selectedTicket.address || null,
                customer_phone: selectedTicket.customer_phone || null,
                sales_name: selectedTicket.sales_name || null,
                sales_division: selectedTicket.sales_division || null,
                sn_unit: selectedTicket.sn_unit || null,
                product: selectedTicket.product || null,
                issue_case: selectedTicket.issue_case,
                description: selectedTicket.description || null,
                assign_name: "Admin Team Services", // akan di-assign ulang oleh admin Services
                date: selectedTicket.date,
                status: "Waiting Approval",
                services_status: "Waiting Approval",
                current_team: "Team Services",
                created_by: selectedTicket.created_by || null,
              }]);
              if (insErr) throw insErr;
            } else {
              const { error: updErr } = await supabaseServices.from("tickets").update({
                services_status: "Waiting Approval",
                current_team: "Team Services",
              }).eq("id", selectedTicket.id);
              if (updErr) throw updErr;
            }
          } catch (e: any) {
            mirrorBerhasil = false;
            mirrorPesan = e?.message ?? "penyebab tidak diketahui";
          }

          if (mirrorBerhasil) {
            // current_team pindah ke Team Services, services_status = Waiting Approval.
            // assign_name TETAP handler PTS terakhir - admin Services yang akan
            // meneruskannya ke anggota mereka sendiri.
            updateData.current_team = "Team Services";
            updateData.services_status = "Waiting Approval";

            // Kabari admin Team Services lewat WA. Pembacaan nomor mereka dan
            // penyusunan pesannya dikerjakan di server (/api/services/notify-admins)
            // supaya kontak organisasi lain tidak ikut terunduh ke browser.
            try {
              await fetch("/api/services/notify-admins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  project_name:   selectedTicket.project_name,
                  issue_case:     selectedTicket.issue_case,
                  product:        selectedTicket.product,
                  sn_unit:        selectedTicket.sn_unit,
                  customer_phone: selectedTicket.customer_phone,
                  sales_name:     selectedTicket.sales_name,
                  catatan:        newActivity.notes,
                }),
              });
            } catch { /* WA gagal tidak boleh membatalkan serah terima */ }
          } else {
            notify("error", `Catatan tersimpan, tapi ticket GAGAL dikirim ke Team Services (${mirrorPesan}). Ticket masih di PTS — coba assign ulang.`);
          }
        }

        const { error: updateError } = await supabase.from("tickets").update(updateData).eq("id", selectedTicket.id);
        if (updateError) throw new Error(`Failed to update ticket: ${updateError.message}`);

        //  Kabar penyelesaian - baru dikirim SESUDAH ticketnya benar-benar
        //  tersimpan sebagai Solved, bukan sebelum. Mengabari lebih dulu lalu
        //  penyimpanannya gagal berarti orang diberi tahu sesuatu yang tidak
        //  terjadi.
        if (effectiveStatus === "Solved") {
          void kabarkanTicketSelesai(selectedTicket, useAutoNotes ? autoNotes : (newActivity.notes || ""));
          //  Jadwal Onsite yang lahir dari ticket ini ikut ditutup, supaya tim
          //  tidak perlu menandai selesai dua kali di dua layar berbeda -
          //  pekerjaannya memang satu, cuma tercatat di dua tempat.
          void tutupJadwalTicket(selectedTicket, 'done');
        }

        // PENDING ACTION: perpanjang deadline Overdue sesuai hari yg dipilih
        // Kendala bisa dari sisi user  team boleh menggeser deadline supaya
        // ticket tidak dihitung overdue. Pakai tabel overdue_settings yg sudah ada
        // (due_date absolut = sekarang + N hari).
        if (newActivity.new_status === "Pending Action") {
          const extDays = parseInt(newActivity.extend_days || "0", 10);
          if (extDays > 0) {
            try {
              const newDeadline = new Date(Date.now() + extDays * 86400000).toISOString();
              const existing = getOverdueSetting(selectedTicket.id);
              if (existing) {
                await supabase.from("overdue_settings").update({ due_date: newDeadline, due_hours: null, set_by: currentUser?.username || "" }).eq("id", existing.id);
              } else {
                await supabase.from("overdue_settings").insert([{ ticket_id: selectedTicket.id, due_date: newDeadline, due_hours: null, set_by: currentUser?.username || "" }]);
              }
              await fetchOverdueSettings();
            } catch { /* jangan gagalkan update status kalau perpanjangan gagal */ }
          }
        }

        // AUTO-CREATE REMINDER saat status Onsite
        // Jika team update status ke Onsite, otomatis buat reminder di tabel
        // reminders sebagai kategori Troubleshooting.
        // Jika ada jadwal (onsite_use_schedule + date), gunakan tanggal tersebut.
        // Jika tidak ada jadwal, gunakan tanggal hari ini.
        if (newActivity.new_status === "Onsite") {
          try {
            /*
              Penjaga duplikat. Sebelum ini tidak ada: setiap kali status
              diubah ke Onsite - termasuk saat tim mengoreksi catatan lalu
              menyimpan ulang - satu reminder BARU dibuat lagi untuk ticket
              yang sama. Akibatnya jadwal yang sudah dikerjakan muncul dua
              kali di Reminder Schedule dan harus ditutup satu per satu.

              Yang diperiksa hanya reminder yang MASIH TERBUKA: kunjungan
              onsite kedua untuk ticket yang sama memang sah punya jadwal
              sendiri, jadi kalau yang lama sudah selesai, yang baru tetap
              boleh dibuat.
            */
            const { data: sudahAda } = await supabase.from('reminders')
              .select('id').eq('ticket_id', selectedTicket.id).neq('status', 'done').limit(1);
            if (sudahAda && sudahAda.length > 0) throw new Error('sudah ada jadwal terbuka');

            const assignedUsername = currentUser?.username || "";
            // Cari full_name user
            const { data: userData } = await supabase
              .from("users")
              .select("full_name, username")
              .eq("username", assignedUsername)
              .single();
            const assignedName = userData?.full_name || assignedUsername;

            const onsiteDueDate = (newActivity.onsite_use_schedule && newActivity.onsite_schedule_date)
              ? newActivity.onsite_schedule_date
              : new Date().toISOString().split("T")[0]; // fallback: hari ini
            const onsiteDueTime = (newActivity.onsite_use_schedule && newActivity.onsite_schedule_date)
              ? `${newActivity.onsite_schedule_hour}:${newActivity.onsite_schedule_minute}`
              : `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

            const reminderPayload = {
              project_name: selectedTicket.project_name,
              description: `[AUTO dari Ticketing] Issue: ${selectedTicket.issue_case}${selectedTicket.product ? ` | Product: ${selectedTicket.product}` : ""}`,
              // assigned_to = username (FK ke users.username) - wajib untuk filter notif
              assigned_to: assignedUsername,
              // assign_name = full name untuk display
              assign_name: assignedName,
              due_date: onsiteDueDate,
              due_time: onsiteDueTime,
              priority: "high",
              status: "pending",
              repeat: "none",
              category: "Troubleshooting",
              sales_name: selectedTicket.sales_name || "",
              sales_division: selectedTicket.sales_division || "",
              address: selectedTicket.address || "",
              pic_name: selectedTicket.customer_phone || "",
              pic_phone: "",
              product: selectedTicket.product || selectedTicket.sn_unit || "",
              created_by: assignedUsername,
              //  Kaitan sungguhan ke ticketnya. Catatan teks di bawah tetap
              //  ditulis supaya terbaca manusia, tapi yang dipakai program
              //  untuk menutup reminder ini nanti adalah kolom ini.
              ticket_id: selectedTicket.id,
              // ticket_id sebagai link reference ke Ticketing
              notes: `Ticket ID: ${selectedTicket.id} | Project: ${selectedTicket.project_name} | Dibuat otomatis dari Platform Ticketing saat status Onsite dijadwalkan`,
            };
            const { error: reminderErr } = await supabase.from("reminders").insert([reminderPayload]);
          } catch { }
        }
      }
      // Refresh OPTIMIS: update selectedTicket + list saat itu juga supaya
      // status baru langsung terlihat tanpa perlu refresh manual (fix keluhan).
      const optimisticLog = { ...activityData, id: `tmp-${Date.now()}`, created_at: new Date().toISOString() } as any;
      setSelectedTicket(prev => prev && prev.id === selectedTicket.id ? {
        ...prev,
        status: isServicesTeam ? prev.status : effectiveStatus,
        services_status: isServicesTeam ? effectiveStatus : prev.services_status,
        sn_unit: newActivity.sn_unit || prev.sn_unit,
        activity_logs: [optimisticLog, ...(prev.activity_logs || [])],
      } : prev);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? {
        ...t,
        status: isServicesTeam ? t.status : effectiveStatus,
        services_status: isServicesTeam ? effectiveStatus : t.services_status,
      } : t));
      setNewActivity({
        handler_name: newActivity.handler_name,
        action_taken: "",
        notes: "",
        new_status: isServicesTeam ? "Pending" : "Pending",
        sn_unit: "",
        file: null,
        photo: null,
        assign_to_services: false,
        services_assignee: "",
        onsite_use_schedule: false,
        onsite_schedule_date: "",
        onsite_schedule_hour: "08",
        onsite_schedule_minute: "00",
        extend_days: "",
      });
      await fetchData();
      setLoadingMessage("✅ Status updated successfully!");
      setTimeout(() => { setShowLoadingPopup(false); setUploading(false); setShowUpdateForm(false); }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Error: " + err.message);
    }
  };

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


  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') { notify("error", "Tidak ada akses untuk menghapus ticket."); return; }
    setConfirmState({
      message: `Hapus ${selectedIds.size} ticket yang dipilih?`,
      description: 'Tindakan ini tidak bisa dibatalkan.',
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        setBulkDeleting(true);
        const ids = Array.from(selectedIds);
        await supabase.from("activity_logs").delete().in("ticket_id", ids);
        try { await supabaseServices.from("activity_logs").delete().in("ticket_id", ids); } catch { }
        await supabase.from("overdue_settings").delete().in("ticket_id", ids);
        //  select('id') supaya baris yang BENAR-BENAR terhapus bisa dihitung -
        //  error kosong tidak berarti semuanya terhapus, RLS yang menolak
        //  sebagian baris tetap menjawab tanpa galat.
        const { data: terhapus, error } = await supabase.from("tickets").delete().in("id", ids).select("id");
        if (error) {
          notify("error", "Gagal menghapus: " + error.message);
        } else {
          const idTerhapus = new Set((terhapus ?? []).map((t: { id: string }) => t.id));
          setTickets(prev => prev.filter(t => !idTerhapus.has(t.id)));
          setSelectedIds(prev => new Set([...prev].filter(id => !idTerhapus.has(id))));
          if (idTerhapus.size < ids.length) {
            notify("error", `${ids.length - idTerhapus.size} dari ${ids.length} ticket gagal dihapus (tidak punya akses). Sisanya berhasil.`);
          }
        }
        setBulkDeleting(false);
      },
    });
  };

  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filteredTickets.length ? new Set() : new Set(filteredTickets.map(t => t.id))
  );

  const jalankanEksporExcel = () => eksporExcel({ tickets, filteredTickets, currentUserTeamType, stats, isTicketOverdue, notify });

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
      const yearMatch = filterYear === "all" || ticketYear === filterYear;
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
    return {
      total, pending, processing, solved, overdue, solvedOverdue,
      statusData: [
        { name: "Pending", value: pending, color: "#FCD34D" },
        { name: "In Progress", value: processing, color: "#60A5FA" },
        { name: "Solved", value: solved, color: "#34D399" },
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

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    tickets.forEach((t) => { if (t.created_at) years.add(new Date(t.created_at).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [tickets]);

  const uniqueProjectNames = useMemo(() => {
    const names = tickets.map((t) => t.project_name);
    return Array.from(new Set(names)).sort();
  }, [tickets]);

  // Team yg boleh di-assign tiket = ASSIGNABLE_PTS_TEAMS (IVP/MVI - UMP dikecualikan,
  // lihat lib/teams.ts). Manager dikecualikan - bukan handler teknis biasa.
  //  Dulu `m.jabatan !== "Manager"` dipaku di sini. Diganti toggle per akun
//  (lihat bolehDitugaskan di lib/teams.ts): perusahaan lain bisa saja
//  Manager-nya memang ikut mengerjakan, dan itu harus bisa diatur dari
//  Admin Panel tanpa menyunting kode.
  const teamPTSMembers = useMemo(() => teamMembers.filter(bolehDitugaskan), [teamMembers]);
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
    if (currentUser?.role === "admin" || currentUser?.role === "superadmin") { loadReminderSchedule(); }
    if (currentUser) fetchOverdueSettings();
  }, [currentUser]);

  useEffect(() => { if (currentUser) fetchData(); }, [currentUser]);

  // Realtime subscription: auto-update tanpa refresh
  useEffect(() => {
    if (!currentUser) return;
    // PTS DB realtime
    const ptsCh = supabase.channel("pts-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        fetchData(currentUser, true); // silent: tidak trigger loading spinner
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => {
        fetchData(currentUser, true);
      })
      .subscribe();
    // Services DB realtime (untuk update services_status dari platform Services)
    const svcCh = supabaseServices.channel("svc-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        fetchData(currentUser, true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => {
        fetchData(currentUser, true);
      })
      .subscribe();
    // Polling fallback setiap 30 detik - juga silent
    const pollInterval = setInterval(() => fetchData(currentUser, true), 30000);
    return () => {
      supabase.removeChannel(ptsCh);
      supabaseServices.removeChannel(svcCh);
      clearInterval(pollInterval);
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

  const canCreateTicket = true;
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

  const approveServicesTicket = async (ticket: Ticket) => {
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Approving ticket untuk Team Services...");
      //  Diperiksa: ini penulisan pertama dan yang menentukan alur ini
      //  benar-benar jalan. Kalau gagal diam-diam, activity log & notifikasi
      //  "diterima Team Services" di bawah tetap terkirim walau tickenya
      //  sendiri tidak pernah pindah status.
      const { data: terubah, error: galatUtama } = await supabase.from("tickets")
        .update({ services_status: "Pending" }).eq("id", ticket.id).select("id");
      if (galatUtama || !terubah || terubah.length === 0) {
        setShowLoadingPopup(false); setUploading(false);
        notify("error", "Gagal approve ticket untuk Team Services. Coba lagi.");
        return;
      }
      try {
        const { error: svcErr } = await supabaseServices.from("tickets").update({ services_status: "Pending", status: "Pending" }).eq("id", ticket.id);
        if (svcErr) throw svcErr;
      } catch (e: any) {
        notify("error", `Status di basis data Services gagal diperbarui (${e?.message ?? "penyebab tidak diketahui"}). Kedua sisi bisa berbeda — periksa ticket ini.`);
      }
      await supabaseServices.from("activity_logs").insert([{
        ticket_id: ticket.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Ticket Diterima oleh Team Services",
        notes: `Ticket diterima dan akan segera diproses oleh Team Services.`,
        new_status: "Pending",
        team_type: "Team Services",
        assigned_to_services: false,
        file_url: "", file_name: "", photo_url: "", photo_name: ""
      }]);
      /*
        Serah terima ke Team Services sebelumnya tidak mengabari siapa pun.
        Sales yang melaporkan dan PTS yang menyerahkan sama-sama tidak tahu
        ticketnya sudah diterima - padahal sejak titik ini penanganannya
        berpindah tangan, dan merekalah yang akan ditanyai kalau ada
        perkembangan. sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
      */
      try {
        const pihak = [ticket.created_by, ticket.assign_name].filter(Boolean) as string[];
        const penerima = users.filter(u =>
          (!!u.username && pihak.includes(u.username)) || (!!u.full_name && pihak.includes(u.full_name)));
        const pesanTerima = [
          '🤝 *TICKET DITERIMA TEAM SERVICES*',
          '━━━━━━━━━━━━━━━━━━',
          `📌 *Project :* ${ticket.project_name}`,
          `⚠️ *Issue   :* ${ticket.issue_case}`,
          `✅ *Diterima:* ${currentUser?.full_name || 'Team Services'}`,
          '━━━━━━━━━━━━━━━━━━',
          'Penanganan berpindah ke Team Services dan akan segera diproses.',
          `🔗 ${appLink()}`,
        ].join('\n');
        for (const u of penerima) {
          if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesanTerima });
          void createNotification({
            user_id: u.id, type: 'ticket',
            title: '🤝 Ticket diterima Team Services',
            body: `${ticket.project_name} — ${ticket.issue_case}`,
            action_url: '/ticketing', ref_id: ticket.id,
            created_by: currentUser?.full_name ?? '',
          });
        }
      } catch { /* kabar gagal tidak boleh membatalkan serah terimanya */ }

      await fetchData();
      setLoadingMessage("✅ Ticket diterima oleh Team Services!");
      setTimeout(() => { setShowLoadingPopup(false); setUploading(false); setShowServicesApprovalModal(false); setServicesApprovalTicket(null); }, 1500);
    } catch (err: any) { setShowLoadingPopup(false); setUploading(false); notify("error", "Error: " + err.message); }
  };

  const rejectServicesTicket = (ticket: Ticket) => {
    setConfirmState({
      message: `Tolak ticket "${ticket.project_name} - ${ticket.issue_case}"?`,
      description: 'Ticket akan dikembalikan ke Team PTS IVP.',
      danger: true,
      confirmLabel: 'Tolak',
      onConfirm: async () => {
        try {
          setUploading(true);
          setShowLoadingPopup(true);
          setLoadingMessage("Mengembalikan ticket ke Team PTS IVP...");
          //  Diperiksa - lihat catatan yang sama di approveServicesTicket.
          const { data: terubah, error: galatUtama } = await supabase.from("tickets")
            .update({ current_team: "Team PTS IVP", services_status: null, status: "In Progress" })
            .eq("id", ticket.id).select("id");
          if (galatUtama || !terubah || terubah.length === 0) {
            setShowLoadingPopup(false); setUploading(false);
            notify("error", "Gagal mengembalikan ticket ke PTS. Coba lagi.");
            return;
          }
          await supabase.from("activity_logs").insert([{
            ticket_id: ticket.id,
            handler_name: currentUser?.full_name || "",
            handler_username: currentUser?.username || "",
            action_taken: "Ticket Dikembalikan ke Team PTS IVP",
            notes: `Ticket dikembalikan ke Team PTS IVP oleh Team Services karena tidak dapat ditangani.`,
            new_status: "In Progress",
            team_type: "Team Services",
            assigned_to_services: false,
            file_url: "", file_name: "", photo_url: "", photo_name: ""
          }]);
          try {
            //  select('id') + panjangnya diperiksa: RLS yang menolak diam-diam
            //  (0 baris, tanpa galat) tidak melempar apa pun ke catch di
            //  bawah - dilempar manual di sini supaya pesan "catatan di
            //  basis data Services gagal diperbarui" benar-benar muncul.
            const { data: terubahSvc, error: galatSvc } = await supabaseServices.from("tickets")
              .update({ services_status: "Returned to PTS", current_team: "Team PTS IVP" }).eq("id", ticket.id).select("id");
            if (galatSvc) throw galatSvc;
            if (!terubahSvc || terubahSvc.length === 0) throw new Error("tidak punya akses / ticket tidak ditemukan di basis data Services");
            await supabaseServices.from("activity_logs").insert([{
              ticket_id: ticket.id,
              handler_name: currentUser?.full_name || "",
              handler_username: currentUser?.username || "",
              action_taken: "Ticket Dikembalikan ke Team PTS IVP",
              notes: `Ticket dikembalikan ke Team PTS IVP. History Services tetap tersimpan.`,
              new_status: "Returned to PTS",
              team_type: "Team Services",
              assigned_to_services: false,
              file_url: "", file_name: "", photo_url: "", photo_name: ""
            }]);
          } catch (e: any) {
            // Sisi PTS sudah mengambil ticket ini kembali, jadi tidak ada yang
            // hilang. Yang tersisa cuma catatan di basis data Services yang
            // belum ikut berubah - itu harus terlihat, bukan didiamkan.
            notify("error", `Ticket sudah kembali ke PTS, tapi catatan di basis data Services gagal diperbarui (${e?.message ?? "penyebab tidak diketahui"}).`);
          }
          /*
            Ticket kembali menjadi tanggung jawab PTS, tapi sebelumnya tidak
            ada yang diberi tahu - jadi pekerjaan yang dikembalikan bisa
            menganggur karena sisi PTS mengira masih ditangani Services.
            Dikabari ke penangan PTS, pelapor, dan admin/Manager Full Access.
          */
          try {
            const pihak = [ticket.created_by, ticket.assign_name].filter(Boolean) as string[];
            const penerima = new Map<string, any>();
            for (const u of users.filter(u =>
              (!!u.username && pihak.includes(u.username)) || (!!u.full_name && pihak.includes(u.full_name)))) {
              penerima.set(u.id, u);
            }
            for (const u of await penerimaAdminBernomor()) penerima.set(u.id, u);
            const pesanKembali = [
              '↩️ *TICKET DIKEMBALIKAN KE TEAM PTS*',
              '━━━━━━━━━━━━━━━━━━',
              `📌 *Project :* ${ticket.project_name}`,
              `⚠️ *Issue   :* ${ticket.issue_case}`,
              `↩️ *Oleh    :* ${currentUser?.full_name || 'Team Services'}`,
              '━━━━━━━━━━━━━━━━━━',
              'Team Services tidak dapat menanganinya — penanganan kembali ke PTS.',
              `🔗 ${appLink()}`,
            ].join('\n');
            for (const u of penerima.values()) {
              //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
              if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesanKembali });
              void createNotification({
                user_id: u.id, type: 'ticket',
                title: '↩️ Ticket dikembalikan ke PTS',
                body: `${ticket.project_name} — ${ticket.issue_case}`,
                action_url: '/ticketing', ref_id: ticket.id,
                created_by: currentUser?.full_name ?? '',
              });
            }
          } catch { /* kabar gagal tidak boleh membatalkan pengembaliannya */ }

          await fetchData();
          setLoadingMessage("✅ Ticket dikembalikan ke Team PTS IVP.");
          setTimeout(() => { setShowLoadingPopup(false); setUploading(false); setShowServicesApprovalModal(false); }, 1500);
        } catch (err: any) { setShowLoadingPopup(false); setUploading(false); notify("error", "Error: " + err.message); }
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-fixed" style={{ backgroundImage: "url(/IVP_Background.png)" }}>
        <div className="bg-white/75 p-8 rounded-2xl shadow-2xl">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
          <p className="mt-4 font-bold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{ backgroundImage: "url(/IVP_Background.png)", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
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
                  <div className="text-6xl mb-4 animate-bounce">✅</div>
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
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "#f59e0b" }}>
                  {notifications.length}
                </span>
              )}
            </button>
          )}

          {/* Approval button */}
          {canApproveAssign && pendingApprovalTickets.length > 0 && (
            <button onClick={() => { setApprovalAssignees({}); fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true); }} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#ea580c,#c2410c)", boxShadow: "0 2px 8px rgba(234,88,12,0.35)" }}>
              ⏳ Approval
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingApprovalTickets.length}</span>
            </button>
          )}

          {/* Services Approval button */}
          {currentUserTeamType === "Team Services" && pendingServicesApprovalTickets.length > 0 && (
            <button onClick={() => setShowServicesApprovalModal(true)} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#db2777,#be185d)", boxShadow: "0 2px 8px rgba(219,39,119,0.35)" }}>
              🔧 Ticket Masuk
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingServicesApprovalTickets.length}</span>
            </button>
          )}

          {/* Reminder button */}
          {canManageTickets && (
            <button onClick={() => { setShowReminderSchedule(true); setShowAccountSettings(false); setShowNewTicket(false); }} className="flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }} title={`Reminder: ${getCronDisplay()}`}>
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
                  <div className="flex items-center gap-3"><span className="text-3xl animate-bounce">🔔</span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3><p className="text-sm text-white/90">{notifications.length} tickets need attention</p></div></div>
                  <button aria-label="Tutup" onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                {notifications.map((ticket) => {
                  const overdueFlag = isTicketOverdue(ticket);
                  return (
                    <div key={ticket.id} onClick={() => { setSelectedTicket(ticket); setShowNotificationPopup(false); setShowTicketDetailPopup(true); }} className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all" style={{ background: "rgba(249,250,251,0.9)", borderColor: overdueFlag ? "#dc2626" : "#e5e7eb" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-1 flex-wrap">{overdueFlag && <span className="text-red-500">🚨</span>}<p className="font-bold text-sm text-gray-800 truncate">{ticket.project_name}</p></div><p className="text-xs text-gray-500">{ticket.issue_case}</p>{overdueFlag && <p className="text-xs text-red-600 font-bold mt-0.5">⏰ OVERDUE - Segera tangani!</p>}</div>
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
                  <div className="flex items-center gap-3"><span className="text-3xl">🔔</span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3>{notifications.length > 0 && <p className="text-sm text-white/90">{notifications.length} tickets need attention</p>}</div></div>
                  <button aria-label="Tutup" onClick={() => setShowNotifications(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="p-12 text-center text-gray-500"><div className="text-6xl mb-4">✅</div><p className="text-lg font-medium">No notifications</p><p className="text-sm mt-2">All tickets have been handled</p></div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-4"><div className="space-y-3">{notifications.map((ticket) => { const overdueFlag = isTicketOverdue(ticket); return (
                  <div key={ticket.id} onClick={() => { setSelectedTicket(ticket); setShowNotifications(false); setShowTicketDetailPopup(true); }} className={`rounded-xl p-4 border-2 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all ${overdueFlag ? "bg-red-50 border-red-400" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300"}`}>
                    <div className="flex justify-between items-start mb-3"><div className="flex-1"><div className="flex items-center gap-2 mb-2">{overdueFlag && <span className="text-red-500">🚨</span>}<p className="font-bold text-lg text-gray-800">{ticket.project_name}</p><span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-bold">{ticket.current_team}</span></div><p className="text-sm text-gray-600 mt-1">{ticket.issue_case}</p>{overdueFlag && <p className="text-xs text-red-600 font-bold mt-1">⏰ OVERDUE - Segera tangani!</p>}</div><div className="ml-3"><span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${overdueFlag ? statusColors["Overdue"] : statusColors[currentUserTeamType === "Team Services" ? ticket.services_status || "Pending" : ticket.status]}`}>{overdueFlag ? "🚨 Overdue" : (currentUserTeamType === "Team Services" ? (ticket.services_status || "Pending") : ticket.status)}</span></div></div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-300"><span className="text-xs text-gray-500">📅 {ticket.created_at ? formatDateTime(ticket.created_at) : "-"}</span><span className="text-sm text-blue-600 font-semibold">Click to view details →</span></div>
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
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-3"
            onClick={e => { if (e.target === e.currentTarget) { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); } }}>
            <div className="flex items-start gap-3 w-full my-2" style={{ maxWidth: showUpdateForm ? '1120px' : '720px', transition: 'max-width 0.2s' }}>

              {/* LEFT: Detail */}
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden w-full flex flex-col flex-1 min-w-0"
                style={{ animation: "scale-in 0.25s ease-out", border: "1px solid rgba(0,0,0,0.1)", maxHeight: "94vh" }}>
                {/* Header */}
                <div className="px-5 py-4 flex-shrink-0 relative" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
                  {/* Latar bulat dibuang: di atas kepala merah ini lencana
                      putih-transparan membuat tulisannya nyaris tak terbaca.
                      Teks putih polos di atas merah jauh lebih terbaca, dan
                      ruangnya cukup untuk menyebut keterangan pelimpahan. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[10px] font-bold text-white/90">
                    <span>🎫 Tim: {ringkasPenanganan(selectedTicket).teamHandler}</span>
                    <span>Status: {ringkasPenanganan(selectedTicket).statusLengkap}</span>
                    {selectedTicket.services_status && <span>Services: {selectedTicket.services_status}</span>}
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-1 mb-0.5">Nama Project</p>
                  <h2 className="text-lg font-bold text-white leading-tight">{selectedTicket.project_name}</h2>
                  {selectedTicket.address && (
                    <>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 mt-1.5 mb-0.5">Lokasi</p>
                      <p className="text-white/75 text-xs flex items-center gap-1">📍 {selectedTicket.address}</p>
                    </>
                  )}
                  {selectedTicket.status === "Onsite" && (
                    <button onClick={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); router.push('/reminder-schedule'); }}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                      style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.92)' }}>
                      🗓️ Lihat Jadwal Reminder
                    </button>
                  )}
                  <button aria-label="Tutup" onClick={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
                </div>

                <div className="overflow-y-auto flex-1 min-h-0">
                  {/* Supervisor: ticket di-route ke kamu → wajib assign lanjut ke tim */}
                  {selectedTicket.routing_status === "supervisor_assign" && selectedTicket.assigned_supervisor_id === currentUser?.id && (
                    <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.4)" }}>
                      <span className="text-2xl">🎯</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-800">Ticket ini menunggu kamu assign ke tim</p>
                        <p className="text-[11px] text-amber-700">Sudah diapprove Admin — pilih anggota tim atau kerjakan sendiri.</p>
                      </div>
                      <button onClick={() => { setSupAssignTicket(selectedTicket); setSupAssignTo(""); }}
                        className="flex-shrink-0 text-white px-3 py-2 rounded-lg text-xs font-bold" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                        🎯 Assign ke Tim
                      </button>
                    </div>
                  )}
                  {/* Admin / Full Access: betulkan data & alihkan pekerjaan.
                      Sebelum ini satu-satunya cara membetulkan ticket yang salah
                      adalah mengeditnya langsung di Supabase — tanpa jejak dan
                      tanpa pemberitahuan ke yang menangani. */}
                  {canManageTickets && (
                    <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.25)' }}>
                      <span className="text-2xl">🛠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-indigo-800">Koreksi data ticket</p>
                        <p className="text-[11px] text-indigo-700">
                          {bolehReroute(selectedTicket)
                            ? 'Betulkan detail atau alihkan ke supervisor/tim lain.'
                            : 'Detail bisa dibetulkan. Pengalihan tidak tersedia — pengerjaannya sudah jalan.'}
                        </p>
                      </div>
                      <button onClick={() => bukaAdminEdit(selectedTicket)}
                        className="flex-shrink-0 text-white px-3 py-2 rounded-lg text-xs font-bold" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                        🛠️ Edit &amp; Re-route
                      </button>
                    </div>
                  )}
                  {/* Progress Flowchart */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Progress</p>
                      {/* Status Pending menahan pekerjaan, bukan membatalkannya —
                          jadi yang perlu diketahui adalah berapa lama lagi
                          tenggatnya, bukan sekadar bahwa ia sedang tertahan. */}
                      {adalahPending(selectedTicket.status) && (() => {
                        const dl = getDeadline(selectedTicket);
                        if (!dl) return null;
                        const sisaHari = Math.ceil((dl.getTime() - Date.now()) / 86400000);
                        const lewat = sisaHari < 0;
                        return (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-full border"
                            style={lewat
                              ? { background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#b91c1c' }
                              : { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.35)', color: '#b45309' }}>
                            {selectedTicket.status} · {lewat
                              ? `lewat ${Math.abs(sisaHari)} hari`
                              : `${sisaHari} hari lagi`}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center">
                      {(["Pending","Call","Onsite","In Progress","Solved"] as const).map((step, idx, arr) => {
                        const order = ["Pending","Call","Onsite","In Progress","Solved"];
                        /* Posisi diambil dari langkah TERJAUH yang pernah dicapai menurut riwayat
                           aktivitas, bukan status sekarang. "Pending Action" dan
                           "Pending Check" tidak ada di daftar ini, jadi memakai status
                           sekarang akan membuat ticket yang sudah jauh terlihat mundur
                           ke titik awal. */
                        const dariRiwayat = (selectedTicket.activity_logs ?? [])
                          .map(l => order.indexOf(l.new_status))
                          .filter(i => i >= 0);
                        const curIdx = Math.max(
                          order.indexOf(selectedTicket.status),
                          ...(dariRiwayat.length ? dariRiwayat : [-1]),
                        );
                        const stepIdx = order.indexOf(step);
                        const done = stepIdx < curIdx;
                        const active = stepIdx === curIdx;
                        const icons: Record<string,string> = { Pending:'🟡', Call:'📞', Onsite:'🚗', 'In Progress':'🔵', Solved:'✅' };
                        return (
                          <div key={step} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${active ? 'border-red-500 bg-red-50 shadow-md scale-110' : done ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                                {done ? '✓' : icons[step]}
                              </div>
                              <span className={`text-[7px] font-bold text-center leading-tight whitespace-nowrap ${active ? 'text-red-600' : done ? 'text-green-600' : 'text-gray-400'}`}>{step}</span>
                            </div>
                            {idx < arr.length - 1 && <div className={`flex-1 h-0.5 mx-0.5 mb-3 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Info grid — print style */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      <div>
                        <InfoLine label="Handler" value={ringkasPenanganan(selectedTicket).handlerPTS || '-'} />
                        <InfoLine label="Team" value={ringkasPenanganan(selectedTicket).teamHandler} />
                        <InfoLine label="Issue" value={selectedTicket.issue_case} />
                        {selectedTicket.product && <InfoLine label="Product" value={selectedTicket.product} />}
                        {selectedTicket.sn_unit && <InfoLine label="SN Unit" value={selectedTicket.sn_unit} />}
                        {selectedTicket.customer_phone && <InfoLine label="Customer" value={selectedTicket.customer_phone} />}
                      </div>
                      <div>
                        {selectedTicket.sales_name && <InfoLine label="Sales" value={`${selectedTicket.sales_name}${selectedTicket.sales_division ? ` (${selectedTicket.sales_division})` : ''}`} />}
                        <InfoLine label="Dibuat" value={selectedTicket.created_at ? formatDateTime(selectedTicket.created_at) : '-'} />
                        {/* "Sales" di atas = ATAS NAMA siapa ticket diajukan; baris ini =
                            siapa yang benar-benar mengetik & submit. Lewat SBU, Sales
                            Internal bisa mengajukan atas nama Sales External, jadi kalau
                            keduanya beda disebut tegas supaya Sales yang namanya tercantum
                            tidak dikira membuat ticket yang tak pernah ia buat. */}
                        {selectedTicket.created_by && (() => {
                          const pembuat = users.find(u => u.username === selectedTicket.created_by);
                          const namaPembuat = pembuat?.full_name || selectedTicket.created_by;
                          const atasNama = selectedTicket.sales_name || "";
                          const beda = atasNama && atasNama !== namaPembuat;
                          return <InfoLine label={beda ? "Diinput oleh" : "Oleh"}
                            value={beda ? `${namaPembuat} (${selectedTicket.created_by}) — atas nama Sales ${atasNama}` : `${namaPembuat} (${selectedTicket.created_by})`} />;
                        })()}
                        {selectedTicket.description && <InfoLine label="Deskripsi" value={selectedTicket.description} />}
                      </div>
                    </div>
                  </div>

                  {/* Warranty Info */}
                  {(() => {
                    const w = getWarrantyInfo(selectedTicket.project_name);
                    if (!w) return null;
                    return (
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">🛡️ Status Garansi Project</p>
                        <div className="rounded-xl p-3 flex flex-wrap items-center gap-3"
                          style={w.isIn
                            ? { background: "rgba(14,165,233,0.08)", border: "1.5px solid rgba(14,165,233,0.3)" }
                            : { background: "rgba(239,68,68,0.07)", border: "1.5px solid rgba(239,68,68,0.3)" }}>
                          <span className="text-2xl">{w.isIn ? "🛡️" : "⚠️"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold"
                                style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                                {w.isIn ? "✅ In Warranty" : "❌ Out of Warranty"}
                              </span>
                              <span className="text-xs font-bold" style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                                {w.isIn ? `Sisa ${w.diffDays} hari` : `Sudah lewat ${Math.abs(w.diffDays)} hari`}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-gray-500">
                              <div><span className="block text-gray-400">BAST</span><strong className="text-gray-700">{w.bastStr}</strong></div>
                              <div><span className="block text-gray-400">Berakhir</span><strong style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>{w.expiryStr}</strong></div>
                              <div><span className="block text-gray-400">Durasi</span><strong className="text-gray-700">{w.wy} Tahun</strong></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Foto awal */}
                  {selectedTicket.photo_url && (
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">📸 Foto Awal</p>
                      <img src={selectedTicket.photo_url} alt="foto" loading="lazy" decoding="async" className="w-full max-h-36 object-cover rounded-xl border cursor-pointer hover:opacity-90" onClick={() => window.open(selectedTicket.photo_url!, "_blank")} />
                    </div>
                  )}

                  {/* Activity log compact */}
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">📝 Activity Log ({selectedTicket.activity_logs?.length || 0})</p>
                    <div className="space-y-2">
                      {selectedTicket.activity_logs && selectedTicket.activity_logs.length > 0
                        ? selectedTicket.activity_logs.map(log => (
                          <div key={log.id} className="rounded-lg p-2.5 border border-gray-100 bg-gray-50/80">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-800">{log.handler_name}</span>
                                <span className="text-[9px] text-purple-700 font-semibold">{log.team_type}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold ${(statusColors[log.new_status] || 'text-gray-600').split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{log.new_status}</span>
                                <span className="text-[9px] text-gray-400">{formatDateTime(log.created_at)}</span>
                              </div>
                            </div>
                            {log.action_taken && <p className="text-[10px] text-blue-700 font-semibold">🔧 {log.action_taken}</p>}
                            <p className="text-xs text-gray-600">{log.notes}</p>
                            {log.photo_url && <img src={log.photo_url} alt="log" loading="lazy" decoding="async" className="mt-1.5 max-h-24 rounded-lg border cursor-pointer" onClick={() => window.open(log.photo_url!, "_blank")} />}
                            {log.file_url && <a href={log.file_url} download className="inline-block mt-1 text-[10px] font-bold text-blue-600 hover:underline">📄 {log.file_name || "Download"}</a>}
                          </div>
                        ))
                        : <p className="text-xs text-gray-400 text-center py-3">Belum ada aktivitas</p>
                      }
                    </div>
                  </div>

                </div>
                {/* Footer actions — outside overflow, always visible */}
                <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2 bg-gray-50/50 flex-shrink-0">
                    <button onClick={() => cetakTicket(selectedTicket)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>📄 PDF</button>
                    {selectedTicket.status === "Solved" && bolehUpdateTicket(selectedTicket) && currentUserTeamType !== "Team Services" && (
                      <button onClick={() => { setReopenTargetTicket(selectedTicket); setReopenAssignee(selectedTicket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>🔓 Re-open</button>
                    )}
                    {/* C2: dulu jalan buntu - services_status "Solved" tidak bisa dibuka siapa
                        pun. Team Services (membetulkan salah klik sendiri) atau Admin/
                        Superadmin (pengawasan) sekarang bisa. */}
                    {selectedTicket.services_status === "Solved" && bolehUpdateTicket(selectedTicket) &&
                      (currentUserTeamType === "Team Services" || currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                      <button onClick={() => setReopenServicesTarget(selectedTicket)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>🔓 Re-open Services</button>
                    )}
                    {bolehUpdateTicket(selectedTicket) && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
                      <button onClick={() => setShowUpdateForm(!showUpdateForm)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showUpdateForm ? 'bg-gray-200 text-gray-700' : 'text-white'}`}
                        style={showUpdateForm ? {} : { background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
                        {showUpdateForm ? '✕ Tutup' : '➕ Update Status'}
                      </button>
                    )}
                    {bolehUpdateTicket(selectedTicket) && currentUserTeamType === "Team Services" && selectedTicket.services_status === "Waiting Approval" && (
                      <button onClick={() => setShowServicesApprovalModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>🔧 Konfirmasi</button>
                    )}
                    <button onClick={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 bg-white">✕ Close</button>
                  </div>
              </div>

              {/* RIGHT: Update Status Panel */}
              {showUpdateForm && bolehUpdateTicket(selectedTicket) && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden flex-shrink-0"
                  style={{ width: 340, animation: "scale-in 0.2s ease-out", border: "2px solid rgba(220,38,38,0.25)", maxHeight: "94vh" }}>
                  <div className="px-4 py-3" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white text-sm">{currentUserTeamType === "Team Services" ? "🔧 Update Services" : "➕ Update Status"}</h3>
                        <p className="text-red-200 text-[10px]">Handler: {newActivity.handler_name}</p>
                      </div>
                      <button aria-label="Tutup" onClick={() => setShowUpdateForm(false)} className="text-white hover:bg-white/20 rounded-lg p-1 font-bold text-xs">✕</button>
                    </div>
                  </div>

                  <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(94vh - 70px)' }}>
                    {/* SN Unit */}
                    <div>
                      <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">🔢 SN Unit</label>
                      <input type="text" value={newActivity.sn_unit} onChange={e => setNewActivity({ ...newActivity, sn_unit: e.target.value })}
                        placeholder="Update SN Unit..." className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/40"
                        style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>

                    {/* Status flowchart buttons */}
                    <div>
                      <label className="block text-[9px] font-bold mb-2 tracking-widest uppercase text-gray-400">Pilih Status *</label>
                      {currentUserTeamType === "Team Services" ? (
                        <div className="flex flex-col gap-1.5">
                          {(["Pending","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart","Process Repair","Solved"] as const).map(s => (
                            <button key={s} onClick={() => setNewActivity({ ...newActivity, new_status: s, action_taken: "", notes: "" })}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 font-semibold text-xs transition-all text-left ${newActivity.new_status === s ? "bg-purple-600 text-white border-purple-600 shadow-md" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
                              <span className="flex-1">{s}</span>
                              {newActivity.new_status === s && <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {(() => {
                            const flow = ["Pending","Call","Onsite","In Progress","Pending Action","Solved"] as const;
                            const curStatus = selectedTicket.status;
                            const curIdx = flow.indexOf(curStatus as any);
                            const styleMap: Record<string,{icon:string;sel:string;unsel:string}> = {
                              Pending:      { icon:'🟡', sel:'bg-amber-500 text-white border-amber-500',    unsel:'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' },
                              Call:         { icon:'📞', sel:'bg-cyan-600 text-white border-cyan-600',      unsel:'bg-white text-cyan-700 border-cyan-200 hover:bg-cyan-50' },
                              Onsite:       { icon:'🚗', sel:'bg-purple-600 text-white border-purple-600',  unsel:'bg-white text-purple-700 border-purple-200 hover:bg-purple-50' },
                              'In Progress':{ icon:'🔵', sel:'bg-blue-600 text-white border-blue-600',      unsel:'bg-white text-blue-700 border-blue-200 hover:bg-blue-50' },
                              'Pending Action':{ icon:'⏸️', sel:'bg-orange-600 text-white border-orange-600', unsel:'bg-white text-orange-700 border-orange-200 hover:bg-orange-50' },
                              Solved:       { icon:'✅', sel:'bg-emerald-500 text-white border-emerald-500',unsel:'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                            };
                            return flow.map((step, idx) => {
                              const stepIdx = flow.indexOf(step);
                              // Boleh mundur ke "In Progress" dari "Pending Action" (kendala selesai, lanjut kerja).
                              const locked = stepIdx < curIdx && !(curStatus === "Pending Action" && step === "In Progress");
                              // Solved hanya dari Onsite+; Pending Action hanya dari In Progress+.
                              const skipLocked = (step === 'Solved' && curIdx < 2) || (step === 'Pending Action' && curIdx < 3);
                              const disabled = locked || skipLocked;
                              const st = styleMap[step];
                              const isSelected = newActivity.new_status === step;
                              return (
                                <div key={step}>
                                  <button disabled={disabled}
                                    onClick={() => setNewActivity({ ...newActivity, new_status: step, action_taken: "", notes: "", onsite_use_schedule: false })}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 font-semibold text-xs transition-all ${isSelected ? st.sel : disabled ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : st.unsel}`}>
                                    <span>{st.icon}</span>
                                    <span className="flex-1 text-left">{step}</span>
                                    {disabled && <span className="text-[9px]">🔒</span>}
                                    {isSelected && <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                  </button>
                                  {/* Onsite schedule */}
                                  {step === 'Onsite' && isSelected && (
                                    <div className="mt-1.5 p-2.5 rounded-lg border" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.25)' }}>
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <input type="checkbox" id="onsite-sched-r" checked={newActivity.onsite_use_schedule}
                                          onChange={e => setNewActivity({ ...newActivity, onsite_use_schedule: e.target.checked })}
                                          className="w-3.5 h-3.5 accent-purple-600" />
                                        <label htmlFor="onsite-sched-r" className="text-[10px] font-bold text-purple-700">Jadwalkan (bukan hari ini)</label>
                                      </div>
                                      {newActivity.onsite_use_schedule && (
                                        <div className="space-y-1.5">
                                          <input type="date" value={newActivity.onsite_schedule_date}
                                            onChange={e => setNewActivity({ ...newActivity, onsite_schedule_date: e.target.value })}
                                            className="w-full rounded-lg px-2.5 py-1.5 text-xs border border-purple-200 outline-none" style={{ background: 'white' }} />
                                          <div className="flex gap-1.5 items-center">
                                            <select value={newActivity.onsite_schedule_hour} onChange={e => setNewActivity({ ...newActivity, onsite_schedule_hour: e.target.value })}
                                              className="flex-1 rounded-lg px-2 py-1.5 text-xs border border-purple-200" style={{ background: 'white' }}>
                                              {Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h}</option>)}
                                            </select>
                                            <span className="text-gray-400 text-xs font-bold">:</span>
                                            <select value={newActivity.onsite_schedule_minute} onChange={e => setNewActivity({ ...newActivity, onsite_schedule_minute: e.target.value })}
                                              className="flex-1 rounded-lg px-2 py-1.5 text-xs border border-purple-200" style={{ background: 'white' }}>
                                              {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <span className="text-[9px] text-gray-500">WIB</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 p-1.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                            <span className="text-xs">🗓️</span>
                                            <p className="text-[9px] text-purple-700 font-semibold flex-1">Otomatis buat jadwal Troubleshooting di Reminder Schedule</p>
                                            <button onClick={() => { setShowTicketDetailPopup(false); setShowUpdateForm(false); router.push('/reminder-schedule'); }}
                                                className="text-[9px] font-bold px-1.5 py-0.5 rounded text-purple-700 hover:text-purple-900"
                                                style={{ background: 'rgba(124,58,237,0.15)' }}>Buka</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Notes/Action for statuses that need detail */}
                    {!["Call","Onsite","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart"].includes(newActivity.new_status) && (
                      <>
                        <div>
                          <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">🔧 Action Taken</label>
                          <textarea value={newActivity.action_taken} onChange={e => setNewActivity({ ...newActivity, action_taken: e.target.value })}
                            placeholder="Cek kabel HDMI, restart sistem..." rows={2}
                            className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
                            style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">
                            📝 Notes {newActivity.new_status === "In Progress" ? <span className="text-gray-300 normal-case">(opsional)</span> : "*"}
                          </label>
                          <textarea value={newActivity.notes} onChange={e => setNewActivity({ ...newActivity, notes: e.target.value })}
                            placeholder={newActivity.new_status === "Pending Action" ? "Kendala apa? (mis. menunggu konfirmasi user, akses lokasi belum tersedia)" : "Detail penanganan..."} rows={3}
                            className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
                            style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                        </div>
                        {/* Pending Action: perpanjang deadline overdue (kendala bisa dari sisi user) */}
                        {newActivity.new_status === "Pending Action" && (
                          <div className="rounded-lg p-2.5" style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.25)' }}>
                            <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-orange-700">⏱️ Perpanjang Overdue</label>
                            <div className="flex items-center gap-2">
                              <input type="number" min={0} value={newActivity.extend_days}
                                onChange={e => setNewActivity({ ...newActivity, extend_days: e.target.value })}
                                placeholder="0" className="w-20 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-orange-500/40"
                                style={{ background: 'white', border: '1px solid rgba(0,0,0,0.12)' }} />
                              <span className="text-[11px] font-semibold text-orange-700">hari dari sekarang</span>
                            </div>
                            <p className="text-[9px] text-orange-500 mt-1">Deadline overdue digeser sesuai hari yang dipilih. Kosong/0 = deadline tidak diubah.</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Assign to Services */}
                    {currentUserTeamType !== "Team Services" && newActivity.new_status === "In Progress" && (
                      <div className="rounded-lg p-2.5" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <input type="checkbox" id="assign-svc-r" checked={newActivity.assign_to_services}
                            onChange={e => setNewActivity({ ...newActivity, assign_to_services: e.target.checked, services_assignee: "" })}
                            className="w-3.5 h-3.5 accent-red-600" />
                          <label htmlFor="assign-svc-r" className="text-[10px] font-bold text-red-700">🔧 Teruskan ke Team Services</label>
                        </div>
                        {newActivity.assign_to_services && (
                          <p className="text-[10px] text-red-500 mt-1 font-medium">
                            Ticket akan dikirim ke Admin Team Services. Mereka yang akan assign ke anggota tim mereka.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Photo */}
                    <div>
                      <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">📷 Foto Bukti</label>
                      <input type="file" accept="image/jpeg,image/jpg,image/png"
                        onChange={e => setNewActivity({ ...newActivity, photo: e.target.files?.[0] || null })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-red-50 file:text-red-700"
                        style={{ borderColor: "rgba(0,0,0,0.12)" }} />
                    </div>

                    <button onClick={addActivity}
                      disabled={uploading || (!newActivity.notes && !["Pending","Call","Onsite","In Progress","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart","Process Repair"].includes(newActivity.new_status))}
                      className="w-full text-white py-2.5 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 4px 14px rgba(220,38,38,0.35)" }}>
                      {uploading ? "⏳ Menyimpan..." : "💾 Simpan Activity"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
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
          <ReminderScheduleModal
            reminderSchedule={reminderSchedule}
            setReminderSchedule={setReminderSchedule}
            reminderSaving={reminderSaving}
            saveCronSchedule={saveCronSchedule}
            getCronDisplay={getCronDisplay}
            onClose={() => setShowReminderSchedule(false)}
          />
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
