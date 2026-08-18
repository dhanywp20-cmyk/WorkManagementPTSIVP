"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { ListEmptyState, AuditTrailPanel, ModalPortal, AdminEditFields } from '@/components/shared';
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, supabaseServices } from "@/lib/supabase";
import { setSession, clearSession, getSession } from "@/lib/auth";
import { adminCreateUser } from "@/lib/admin-users";
import { notifyTicketAssigned, createNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { bandingkan, ringkasPerubahan, pesanWAPerubahan, type AdminField } from "@/lib/admin-edit";
import { isAssignablePTSTeam } from "@/lib/teams";
import { hasFullAccess } from "@/lib/constants";
import { resolveBrandInternals, BRAND_OPTIONS, type Brand } from "@/lib/brand-routing";
import { compressImage } from "@/lib/image-compress";

import {
  sendWANotif, fetchWACCTargets,
  JABATAN_TIER, JABATAN_CC_RULES,
  SERVICES_STATUSES, ServicesStatus,
  User, TeamMember, ActivityLog, Ticket, OverdueSetting,
  SALES_DIVISIONS, formatDateTime, ringkasPenanganan,
} from "./_components/shared";
import {
  StatusDonutCard, SalesDivisionDonutCard, HandlerDonutCard,
  ProductDonutCard, InfoLine,
} from "./_components/DonutCards";
import { NewTicketModal, type NewTicketForm } from "./_components/NewTicketModal";
import {
  ViewIconBtn, DeleteIconBtn,
  FlowchartIconBtn, PrintIconBtn, ApproveIconBtn, ReopenIconBtn, OverdueIconBtn,
  Toast, PageHeader, ConfirmDialog, type ConfirmState, ErrorState, StatCard,
} from "@/components/shared";

// ─── Ikon garis ───────────────────────────────────────────────────────────────
/**
 * Emoji dipakai sebagai ikon di banyak tempat, dan itu punya tiga masalah nyata:
 * bentuknya berbeda-beda di tiap sistem operasi (Windows, Android, iOS
 * menggambar 📦 dengan gaya yang sama sekali lain), ukuran & posisi vertikalnya
 * tidak bisa dikendalikan CSS sehingga sering tidak sejajar dengan teks di
 * sebelahnya, dan warnanya tetap walau teks di sekitarnya berubah.
 *
 * Ikon garis di bawah memakai `currentColor`, jadi selalu selaras dengan warna
 * label induknya, ukurannya diatur lewat class, dan tampil identik di semua
 * perangkat. `aria-hidden` karena ikon ini hanya penguat visual — labelnya
 * sudah ditulis di sebelahnya, jadi pembaca layar tidak perlu menyebutkannya.
 */
const ICON_SHAPES: Record<string, React.ReactNode> = {
  search:   <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></>,
  user:     <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  users:    <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  package:  <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
  tag:      <><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  alert:    <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  pin:      <><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  chart:    <><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>,
  chevron:  <><path d="m6 9 6 6 6-6" /></>,
  check:    <><path d="M20 6 9 17l-5-5" /></>,
  close:    <><path d="M18 6 6 18M6 6l12 12" /></>,
  refresh:  <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>,
};

function Ico({ name, className = "w-3.5 h-3.5" }: { name: keyof typeof ICON_SHAPES; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_SHAPES[name]}
    </svg>
  );
}

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
   * Pilihan handler PER TICKET di modal approval, dikunci id ticket.
   *
   * Sebelumnya seluruh baris di modal berbagi SATU pasang state
   * (approvalTicket + approvalAssignee). Modal itu menampilkan semua ticket
   * "Waiting Approval" sekaligus, jadi satu nilai bersama untuk banyak baris
   * membuat pilihan bisa bocor antar-ticket begitu state-nya tertinggal —
   * dan itu berujung ticket ke-assign ke orang yang salah. Dengan peta
   * per-id, tiap baris memegang pilihannya sendiri dan tidak mungkin
   * tertukar.
   */
  const [approvalAssignees, setApprovalAssignees] = useState<Record<string, string>>({});
  /** Id ticket yang sedang diproses — mencegah klik ganda pada baris yang sama. */
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // Supervisor assign (tahap supervisor_assign) — Supervisor lanjut assign ke tim / sendiri
  const [supAssignTicket, setSupAssignTicket] = useState<Ticket | null>(null);
  // Panel admin "Edit Detail & Re-route" — menggantikan kebiasaan membetulkan
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

  // ── Auto-apply filter dari Global Search (?q=...) ──
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchProject(q);
  }, [searchParams]);
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

  const statusColors: Record<string, string> = {
    "Waiting Approval": "bg-orange-50 text-orange-600 border-orange-200",
    Rejected: "bg-red-100 text-red-700 border-red-300",
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Call: "bg-sky-50 text-sky-600 border-sky-200",
    Onsite: "bg-purple-50 text-purple-600 border-purple-200",
    "In Progress": "bg-blue-50 text-blue-600 border-blue-200",
    "Pending Action": "bg-orange-50 text-orange-700 border-orange-200",
    Solved: "bg-emerald-50 text-emerald-600 border-emerald-200",
    Overdue: "bg-red-50 text-red-600 border-red-200",
    Warranty: "bg-green-50 text-green-700 border-green-300",
    "Out Of Warranty": "bg-red-50 text-red-700 border-red-300",
    "Waiting PO from Sales": "bg-amber-50 text-amber-700 border-amber-300",
    "Submit RMA": "bg-orange-50 text-orange-700 border-orange-300",
    "Waiting sparepart": "bg-rose-50 text-rose-700 border-rose-300",
    "Process Repair": "bg-blue-50 text-blue-700 border-blue-300",
  };

  const checkSessionTimeout = () => {
    if (!getSession()) {
      clearSession();
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = "/dashboard";
    }
  };

  const DEFAULT_OVERDUE_HOURS = 48;
  const getDeadline = (ticket: Ticket): Date | null => {
    const setting = overdueSettings.find((o) => o.ticket_id === ticket.id);
    if (setting) {
      if (setting.due_date) return new Date(setting.due_date);
      if (setting.due_hours && ticket.created_at)
        return new Date(new Date(ticket.created_at).getTime() + setting.due_hours * 3600000);
    }
    if (ticket.created_at)
      return new Date(new Date(ticket.created_at).getTime() + DEFAULT_OVERDUE_HOURS * 3600000);
    return null;
  };

  const isTicketOverdue = (ticket: Ticket): boolean => {
    const deadline = getDeadline(ticket);
    if (!deadline) return false;
    if (ticket.status === "Solved") {
      const solvedLog = ticket.activity_logs?.filter((l) => l.new_status === "Solved").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (solvedLog) return new Date(solvedLog.created_at) > deadline;
      return false;
    }
    return new Date() > deadline;
  };

  const getOverdueSetting = (ticketId: string) => overdueSettings.find((o) => o.ticket_id === ticketId);

  const loadReminderSchedule = async () => {
    try {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "reminder_schedule").single();
      if (data?.value) setReminderSchedule(data.value);
    } catch (e) {}
  };

  const getCronDisplay = () => {
    const h = reminderSchedule.hour_wib.padStart(2, "0");
    const m = reminderSchedule.minute.padStart(2, "0");
    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    let freq = "Setiap hari";
    if (reminderSchedule.frequency === "weekdays") freq = "Senin–Jumat";
    else if (reminderSchedule.frequency === "custom" && reminderSchedule.custom_days.length > 0) {
      freq = reminderSchedule.custom_days.map((d) => days[d]).join(", ");
    }
    return `${freq}, jam ${h}:${m} WIB`;
  };

  const saveCronSchedule = async () => {
    setReminderSaving(true);
    try {
      const hour = parseInt(reminderSchedule.hour_wib);
      const minute = parseInt(reminderSchedule.minute) || 0;
      let dayOfWeek = "*";
      if (reminderSchedule.frequency === "weekdays") dayOfWeek = "1-5";
      else if (reminderSchedule.frequency === "custom" && reminderSchedule.custom_days.length > 0) dayOfWeek = reminderSchedule.custom_days.join(",");
      const { error } = await supabase.rpc("update_reminder_cron", { p_hour_wib: hour, p_minute: minute, p_day_of_week: dayOfWeek, p_active: reminderSchedule.active });
      await supabase.from("app_settings").upsert({ key: "reminder_schedule", value: reminderSchedule }, { onConflict: "key" });
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
      await supabase.from("tickets").delete().eq("id", deleteTargetTicket.id);
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
      // TIDAK punya assign_name — id ada di assigned_supervisor_id, bukan
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
        // team_members tidak ada — ambil dari users dengan role team
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan").in("role", ["team", "team_pts"]).order("full_name"),
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
        // DB ticket sales_name sering menyimpan nama pertama atau username — cek keduanya
        const selfFullName = (freshUser?.full_name || (resolvedUser as any).full_name) as string | undefined;
        const selfFirstName = selfFullName?.split(' ')[0]; // nama pertama saja
        // Helper: apakah ticket ini "milik" user ini
        const isMyTicket = (t: Ticket) =>
          t.created_by === selfUsername ||
          (selfFullName && t.sales_name === selfFullName) ||
          (selfFirstName && t.sales_name === selfFirstName) ||
          t.sales_name === selfUsername;

        // ── SAFETY NET: selalu ambil semua ticket milik sendiri dulu via semua cara ──
        const ownBase: Ticket[] = [];
        const addOwn = (t: Ticket) => { if (!ownBase.find(x => x.id === t.id)) ownBase.push(t); };

        // by created_by
        const { data: byCreator } = await supabase.from("tickets").select("*, activity_logs(*)").eq("created_by", selfUsername).order("created_at", { ascending: false });
        (byCreator ?? []).forEach(addOwn);

        // by sales_name = full_name
        if (selfFullName) {
          const { data: byFullName } = await supabase.from("tickets").select("*, activity_logs(*)").eq("sales_name", selfFullName).order("created_at", { ascending: false });
          (byFullName ?? []).forEach(addOwn);
        }
        // by sales_name = first name
        if (selfFirstName && selfFirstName !== selfFullName) {
          const { data: byFirstName } = await supabase.from("tickets").select("*, activity_logs(*)").eq("sales_name", selfFirstName).order("created_at", { ascending: false });
          (byFirstName ?? []).forEach(addOwn);
        }
        // by sales_name = username
        const { data: byUsername } = await supabase.from("tickets").select("*, activity_logs(*)").eq("sales_name", selfUsername).order("created_at", { ascending: false });
        (byUsername ?? []).forEach(addOwn);

        // Sales Internal (IVP/MVI): lihat ticket dari semua divisi yang dia handle
        // (division_ivp_mappings) — ini yang mewujudkan "CC ke list ticket" utk
        // Troubleshooting (fast-track, tanpa gerbang approval, tapi tetap visible).
        const isIVP = selfDiv === "IVP" || selfDiv === "MVI";
        if (isIVP) {
          // IVP/MVI guest: lihat ticket divisi yg dia handle, TAPI hanya utk BRAND yg dia
          // pegang (division_ivp_mappings.brand_type). Ticket lama tanpa brand / brand BOTH /
          // guest dgn mapping legacy (brand_type null) → tetap tampil (backward compat).
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
          // Ticket yg secara eksplisit di-CC ke guest ini (internal_sales_id / _2) — brand match.
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

          // Cek user_supervisor_mappings — user yang secara manual di-CC ke user ini
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

            // ── Fallback: ticket tanpa sales_division tapi sales_name = bawahan (divisi valid) ──
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
            // ────────────────────────────────────────────────────────────────

            allDivTickets.forEach((t: Ticket) => {
              // Ticket milik sendiri selalu masuk
              if (isMyTicket(t)) { addUnique(t); return; }

              // Cek via created_by username → apakah bawahan yang valid (divisi + tier)
              if (t.created_by && subordinateUsernames.has(t.created_by)) { addUnique(t); return; }

              // Cek via manual subordinate
              const ownerId = t.sales_name ? nameToId[t.sales_name] : null;
              if (ownerId && manualSubordinateIds.has(ownerId)) { addUnique(t); return; }

              // Cek via sales_name: userId harus ada di subordinateIds
              // (sudah tervalidasi divisi + tier — tidak lolos hanya karena tier saja)
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

          // Sort akhir berdasarkan created_at descending — gabungan ticket sendiri + bawahan
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
          const { data: svcLogs } = await supabaseServices.from("activity_logs").select("id,ticket_id,handler_name,handler_username,action_taken,notes,file_url,file_name,photo_url,photo_name,new_status,team_type,assigned_to_services,created_at").order("created_at", { ascending: false });
          if (svcLogs && svcLogs.length > 0) {
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
      // Ticket dari guest/team biasa → Waiting Approval; dari elevated → langsung Pending.
      const ticketStatus = isElevated ? "Pending" : "Waiting Approval";
      // SBU: Sales Internal (guest) yg pilih Sales External → ticket diatasnamakan
      // External tsb. created_by tetap Sales Internal (jejak pembuat).
      const meInternalSales = !!users.find((u) => u.id === currentUser?.id)?.is_internal_sales;
      const guestSBU = currentUser?.role === "guest" && meInternalSales && !!newTicket.sales_name?.trim();
      // Brand: Sales External pilih brand → resolve Sales Internal utk CC + visibility
      // (ticket = CC saja, tanpa gerbang approval). Kalau brand tak ter-mapping, ticket
      // tetap dibuat (fast-track) — cuma tanpa CC brand.
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
        photo_url: photoUrl || null,
        photo_name: photoName || null,
        reminder_id: (newTicket as any).reminder_id || null,
      };
      // Kolom brand hanya ditulis kalau Sales External pilih brand — supaya create
      // ticket lain tetap jalan walau sql/brand-multi-internal.sql belum di-run.
      if (ticketBrand) {
        ticketData.brand = ticketBrand;
        ticketData.internal_sales_id = brandInternalId;
        ticketData.internal_sales_id_2 = brandInternalId2;
      }
      // Route ke Supervisor → tandai supervisor_assign (SPV yg lanjut assign ke tim).
      if (isRoute && routeSup) {
        ticketData.routing_status = "supervisor_assign";
        ticketData.assigned_supervisor_id = routeSup[1];
      }
      const { data: insertedTicket, error } = await supabase.from("tickets").insert([ticketData]).select("id").single();
      if (error) throw error;

      // Catat pembuatan ke audit trail. Sebelumnya HANYA approve/assign yang
      // dicatat, sehingga riwayat tiap ticket seolah tidak punya pangkal —
      // tidak terlihat siapa yang benar-benar membuatnya. Saat Sales Internal
      // mengajukan atas nama Sales External (SBU), keduanya disebut supaya
      // jelas siapa penginput vs atas nama siapa.
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

      // ── Kirim WA notifikasi ke semua admin & superadmin jika butuh approval ──
      // Hanya role guest dan team yang butuh approval → trigger WA ke admin
      if (!isElevated) {
        // Pesan menyebut STATUS ticket-nya, bukan mekanisme internal (WA ke siapa) —
        // yang ditunggu user adalah kabar tiketnya, bukan detail cara sistem memberi tahu.
        setLoadingMessage("Ticket sedang diproses & menunggu approval...");
        try {
          const { data: adminUsers } = await supabase
            .from("users")
            .select("id, phone_number, full_name")
            .in("role", ["admin", "superadmin"])
            .not("phone_number", "is", null)
            .neq("phone_number", "");
          // Manager — role='team' TIDAK ke-cover query role admin di atas, jadi
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
            const { data: mgrSetting } = await supabase.from("app_settings").select("value").eq("key", "manager_user_id").maybeSingle();
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
              "🔗 https://team-ticketing.vercel.app/dashboard",
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
        // ── CC ke atasan + IVP berdasarkan divisi user yang submit ──
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
                "🔗 https://team-ticketing.vercel.app/dashboard",
              ].join("\n");
              await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", target: t.phone, message: ccMsg })));
            }
          }
        } catch { }
      }

      // ── Route ke Supervisor saat create (Manager/Admin) → WA + badge ke Supervisor ──
      if (isRoute && routeSup && insertedTicket?.id) {
        try {
          const supId = routeSup[1], supName = routeSup[2] ?? "";
          const supMember = teamMembers.find(m => m.id === supId);
          const { data: supUser } = supMember?.username
            ? await supabase.from("users").select("id, phone_number, full_name").eq("username", supMember.username).maybeSingle()
            : { data: null };
          if (supUser?.id) void createNotification({ user_id: supUser.id, type: 'ticket', title: '🎯 Ticket perlu kamu assign', body: `${newTicket.project_name} — ${newTicket.issue_case}`, action_url: '/ticketing', ref_id: insertedTicket.id, created_by: currentUser?.full_name || '' });
          if (supUser?.phone_number) {
            const waMsg = ["🎯 *Ticket Perlu Di-assign ke Tim*", "━━━━━━━━━━━━━━━━━━", `Halo *${supUser.full_name || supName}*, ${currentUser?.full_name} meneruskan ticket — silakan assign ke anggota tim / kerjakan sendiri:`, `📌 *Project :* ${newTicket.project_name}`, `⚠️ *Issue   :* ${newTicket.issue_case}`, "━━━━━━━━━━━━━━━━━━", "🔗 https://team-ticketing.vercel.app/dashboard"].join("\n");
            await sendWANotif({ type: "reminder_wa", target: supUser.phone_number, message: waMsg });
          }
        } catch { }
      }

      // ── Kirim WA ke handler jika ticket langsung di-assign ke anggota tim (bukan self/route) ──
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
              "🔗 https://team-ticketing.vercel.app/dashboard",
            ].join("\n");
            await sendWANotif({ type: "reminder_wa", target: handlerInfo.phone_number, message: waMsg });
          }
        } catch (err: any) {
          console.warn('[ticket] WA to handler (new ticket) failed:', err?.message);
          notify('error', 'WA ke handler gagal dikirim. Ticket berhasil disimpan.');
        }
      }

      setNewTicket({
        project_name: "", address: "", customer_phone: "", sales_name: "", sales_division: "", sn_unit: "", product: "", issue_case: "", description: "", assign_name: "", date: getJakartaDateString(), status: "Pending", current_team: "Team PTS IVP", photo: null, reminder_id: null, brand: undefined
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
  const getWarrantyInfo = (projectName: string) => {
    const key = (projectName || "").trim().toLowerCase();
    const refs = projectReminders[key];
    if (!refs || refs.length === 0) return null;
    // Prioritaskan yang punya warranty_years, lalu ambil yang due_date paling baru
    const withWarranty = refs.filter(r => r.warranty_years);
    const best = withWarranty.length > 0
      ? withWarranty.reduce((a, b) => (a.due_date > b.due_date ? a : b))
      : refs.reduce((a, b) => (a.due_date > b.due_date ? a : b));
    if (!best.warranty_years || !best.due_date) return null;
    const wy = best.warranty_years as number;
    const expiry = new Date(best.due_date + "T00:00:00");
    expiry.setFullYear(expiry.getFullYear() + wy);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isIn = today <= expiry;
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    const bastStr = new Date(best.due_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    const expiryStr = expiry.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    return { isIn, diffDays, wy, bastStr, expiryStr, assignName: best.assign_name, category: best.category };
  };

  /**
   * Beres-beres setelah SATU ticket selesai diproses di modal approval.
   *
   * Modal sengaja TIDAK ditutup selama masih ada ticket lain yang menunggu:
   * sebelumnya modal langsung tertutup tiap kali satu ticket di-approve,
   * sehingga admin harus membukanya lagi berulang kali saat antre banyak.
   * Pilihan handler ticket yang baru selesai ikut dibuang supaya tidak ada
   * sisa yang bisa terbawa ke ticket berikutnya.
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
   * saat proses async berjalan — persis yang membuat ticket ke-assign ke orang
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
      // ── Route ke Supervisor: approve tapi belum assign ke handler. Supervisor
      //    yang lanjut assign ke anggota tim (atau kerjakan sendiri). ────────────
      if (asg.startsWith("SUP::")) {
        const [, supId, supName] = asg.split("::");
        const { error: routeErr } = await supabase.from("tickets").update({
          status: "Pending", assign_name: "",
          routing_status: "supervisor_assign", assigned_supervisor_id: supId,
        }).eq("id", tk.id);
        if (routeErr) throw routeErr;
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
              "🔗 https://team-ticketing.vercel.app/dashboard",
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
      const { error } = await supabase.from("tickets").update({ status: "Pending", assign_name: asg }).eq("id", tk.id);
      if (error) throw error;
      if (tk.created_by) {
        const creatorUser = users.find((u) => u.username === tk.created_by);
        if (creatorUser && creatorUser.role === "guest" && creatorUser.id) {
          // Notify guest/sales bahwa ticket mereka sudah diproses
          void createNotification({ user_id: creatorUser.id, type: 'ticket', title: `🎫 Ticket disetujui`, body: `${tk.project_name} — ditugaskan ke ${asg}`, action_url: '/ticketing', ref_id: tk.id, created_by: currentUser?.full_name || '' });
        }
      }
      // ── WA ke handler yang di-assign ──────────────────────────────────────
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
            "🔗 https://team-ticketing.vercel.app/dashboard",
          ].join("\n");
          await sendWANotif({ type: "reminder_wa", target: handlerUser.phone_number, message: waMsg });
        }
      } catch (err: any) {
        console.warn('[ticket] WA to handler (approval) failed:', err?.message);
        notify('error', 'WA ke handler gagal dikirim. Ticket berhasil di-approve.');
      }
      // ── CC ke atasan + IVP berdasarkan divisi creator ticket ──
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
              "🔗 https://team-ticketing.vercel.app/dashboard",
            ].join("\n");
            await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", target: t.phone, message: ccMsg })));
          }
        }
      } catch { }
      // ─────────────────────────────────────────────────────────────────────
      selesaikanSatuApproval(tk.id);
      await fetchData();
      notify("success", `Ticket approved & assigned to ${asg}`);
    } catch (err: any) { notify("error", "Error: " + err.message); } finally { setUploading(false); setApprovingId(null); }
  };

  // ── Supervisor: assign final ticket yg di-route ke dia → anggota tim / sendiri ──
  const handleSupervisorAssignTicket = async () => {
    if (!supAssignTicket || !supAssignTo) { notify("error", "Pilih anggota tim atau kerjakan sendiri!"); return; }
    setSupAssignSaving(true);
    try {
      // 'SELF' = Supervisor kerjakan sendiri
      const isSelf = supAssignTo === "SELF";
      const assigneeName = isSelf ? (currentUser?.full_name ?? "") : supAssignTo;
      const { error } = await supabase.from("tickets").update({
        status: "Pending", assign_name: assigneeName,
        routing_status: null, assigned_supervisor_id: null,
      }).eq("id", supAssignTicket.id);
      if (error) throw error;
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
              "🔗 https://team-ticketing.vercel.app/dashboard",
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
   * Urutannya disengaja — simpan dulu, baru beri tahu. Kalau WA dikirim
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

      // ── Pengalihan pekerjaan ──
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
          // Status hanya diturunkan ke Pending kalau memang belum jalan —
          // dan bolehReroute sudah menjamin itu, jadi tidak ada progress hilang.
          payload.status = 'Pending';
          penerimaBaru = nama;
        }
        if (!labelTujuanLama && t.assigned_supervisor_id) {
          labelTujuanLama = teamMembers.find(m => m.id === t.assigned_supervisor_id)?.name ?? '';
        }
      }

      const { error } = await supabase.from('tickets').update(payload).eq('id', t.id);
      if (error) throw error;

      // ── Catat ke audit ──
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

      // ── Beri tahu lewat WA ──
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
              tautan: 'https://team-ticketing.vercel.app/ticketing',
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
        }
      }

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
      // ── WA ke handler saat reopen ───────────────────────────────────────────
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
            "🔗 https://team-ticketing.vercel.app/dashboard",
          ].join("\n");
          await sendWANotif({ type: "reminder_wa", target: reopenHandler.phone_number, message: waMsg });
        }
      } catch { }
      // ─────────────────────────────────────────────────────────────────────
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
      // Onsite + punya jadwal → status ticket = "Onsite" (bukan Pending)
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
        await supabase.from("tickets").update({ services_status: effectiveStatus }).eq("id", selectedTicket.id);
      } else {
        updateData.status = effectiveStatus;
        if (newActivity.assign_to_services) {
          // ── ASSIGN TO TEAM SERVICES ──
          // current_team pindah ke Team Services, services_status = Waiting Approval
          // assign_name TETAP handler PTS terakhir (tidak berubah ke nama anggota Services)
          // Team Services admin yang akan assign ke anggota mereka sendiri
          updateData.current_team = "Team Services";
          updateData.services_status = "Waiting Approval";
          // assign_name TIDAK diubah — tetap handler PTS terakhir
          // (hanya current_team & services_status yang berubah di PTS DB)

          // Kirim WA notif ke admin Team Services
          try {
            const { data: svcAdmins } = await supabaseServices.from("users")
              .select("phone_number, full_name")
              .eq("role", "admin")
              .not("phone_number", "is", null)
              .neq("phone_number", "");
            if (svcAdmins && svcAdmins.length > 0) {
              const waMsg = [
                "🔔 *TICKET MASUK — Servisindo*",
                "━━━━━━━━━━━━━━━━━━",
                `📌 *Project:* ${selectedTicket.project_name}`,
                `⚠️ *Issue:* ${selectedTicket.issue_case}`,
                selectedTicket.product ? `📦 *Product:* ${selectedTicket.product}` : null,
                selectedTicket.sn_unit ? `🔢 *SN:* ${selectedTicket.sn_unit}` : null,
                selectedTicket.customer_phone ? `📱 *Telepon:* ${selectedTicket.customer_phone}` : null,
                `👤 *Sales:* ${selectedTicket.sales_name || "-"}`,
                newActivity.notes ? `📝 *Catatan:* ${newActivity.notes}` : null,
                "━━━━━━━━━━━━━━━━━━",
                "Silakan buka platform Servisindo untuk menerima dan assign ticket.",
              ].filter(Boolean).join("\n");
              for (const admin of svcAdmins) {
                // 'reminder_wa' = tipe generik (target+message) yg didukung edge
                // function. Sebelumnya 'ticket_notif' TIDAK dikenali swift-responder
                // -> jatuh ke "Unhandled type", WA ke admin Servisindo tak pernah kirim.
                await sendWANotif({ type: "reminder_wa", target: admin.phone_number, message: waMsg });
              }
            }
          } catch { }

          // Mirror ticket ke Services DB
          try {
            const { data: existSvc } = await supabaseServices.from("tickets").select("id").eq("id", selectedTicket.id).maybeSingle();
            if (!existSvc) {
              await supabaseServices.from("tickets").insert([{
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
            } else {
              // Update existing mirror
              await supabaseServices.from("tickets").update({
                services_status: "Waiting Approval",
                current_team: "Team Services",
              }).eq("id", selectedTicket.id);
            }
          } catch { }
        }
        const { error: updateError } = await supabase.from("tickets").update(updateData).eq("id", selectedTicket.id);
        if (updateError) throw new Error(`Failed to update ticket: ${updateError.message}`);

        // ── PENDING ACTION: perpanjang deadline Overdue sesuai hari yg dipilih ──
        // Kendala bisa dari sisi user → team boleh menggeser deadline supaya
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

        // ── AUTO-CREATE REMINDER saat status Onsite ──────────────────────────
        // Jika team update status ke Onsite, otomatis buat reminder di tabel
        // reminders sebagai kategori Troubleshooting.
        // Jika ada jadwal (onsite_use_schedule + date), gunakan tanggal tersebut.
        // Jika tidak ada jadwal, gunakan tanggal hari ini.
        if (newActivity.new_status === "Onsite") {
          try {
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
              // assigned_to = username (FK ke users.username) — wajib untuk filter notif
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
              // ticket_id sebagai link reference ke Ticketing
              notes: `Ticket ID: ${selectedTicket.id} | Project: ${selectedTicket.project_name} | Dibuat otomatis dari Platform Ticketing saat status Onsite dijadwalkan`,
            };
            const { error: reminderErr } = await supabase.from("reminders").insert([reminderPayload]);
          } catch { }
        }
        // ────────────────────────────────────────────────────────────────────
      }
      // ── Refresh OPTIMIS: update selectedTicket + list saat itu juga supaya
      // status baru langsung terlihat tanpa perlu refresh manual (fix keluhan). ──
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
      // team_members table tidak digunakan — data handler dari tabel users langsung
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

  const exportToPDF = async (ticket: Ticket) => {
    const printDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    const statusLabel = ticket.status;

    // Aturan handler/team/catatan pelimpahan hidup di satu tempat supaya layar
    // View Ticket dan laporan cetak tidak pernah menjawab berbeda.
    const { handlerPTS, teamHandler, catatanServices } = ringkasPenanganan(ticket);

    const statusColor = ticket.status === "Solved" ? "#059669"
      : ticket.status === "In Progress" ? "#2563eb"
      : ticket.status === "Pending" ? "#d97706"
      : ticket.status === "Onsite" ? "#7c3aed"
      : ticket.status === "Call" ? "#0891b2"
      : ticket.status === "Waiting Approval" ? "#ea580c"
      : "#64748b";

    const row = (label: string, value: string | null | undefined) =>
      value ? `<tr>
        <td style="font-weight:600;color:#475569;width:160px;padding:7px 12px;border:1px solid #e2e8f0;font-size:12px;background:#f8fafc">${label}</td>
        <td style="padding:7px 12px;border:1px solid #e2e8f0;font-size:12px;color:#1e293b">${value}</td>
      </tr>` : "";

    const badge = (text: string, bg = "#fef3c7", color = "#92400e") =>
      `<span style="display:inline-block;padding:2px 10px;border-radius:20px;background:${bg};color:${color};font-size:11px;font-weight:700;margin:2px 2px 2px 0">${text}</span>`;

    // Activity log rows
    const activityRows = (ticket.activity_logs || [])
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((log: any, idx: number) => {
        const ts = formatDateTime(log.created_at);
        const teamColor = log.team_type === "Team Services" ? "#92400e" : "#1d4ed8";
        const statusCol = log.new_status === "Solved" ? "#065f46"
          : log.new_status === "In Progress" ? "#1d4ed8"
          : log.new_status === "Pending" ? "#92400e"
          : "#475569";
        return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
          <td style="padding:10px 12px;border:1px solid #e2e8f0;width:120px;white-space:nowrap;vertical-align:top">
            <div style="font-size:11px;color:#64748b">${ts}</div>
            <div style="margin-top:3px;font-size:10px;font-weight:700;color:${teamColor}">${log.team_type || "Team PTS IVP"}</div>
          </td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;width:130px;vertical-align:top">
            <div style="font-weight:700;font-size:12px;color:#1e293b">${log.handler_name || "-"}</div>
            <div style="margin-top:4px;font-size:10px;font-weight:700;color:${statusCol}">${log.new_status}</div>
            ${log.assigned_to_services ? `<div style="margin-top:4px;font-size:10px;font-weight:700;color:#dc2626">🔄 → Team Services</div>` : ""}
          </td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">
            ${log.action_taken ? `<div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:4px">🔧 ${log.action_taken}</div>` : ""}
            ${log.notes ? `<div style="font-size:12px;color:#1e293b;line-height:1.6;white-space:pre-line">${log.notes}</div>` : "<div style=\"color:#94a3b8;font-size:11px;font-style:italic\">—</div>"}
            ${log.file_url ? `<div style="margin-top:6px"><a href="${log.file_url}" style="font-size:11px;color:#2563eb;font-weight:600">📎 ${log.file_name || "Download"}</a></div>` : ""}
            ${log.photo_url ? `<div style="margin-top:6px"><img src="${log.photo_url}" style="max-height:100px;border-radius:6px;border:1px solid #e2e8f0" alt="bukti"/></div>` : ""}
          </td>
        </tr>`;
      }).join("");

    const printContent = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>Ticket Report — ${ticket.project_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 13px; }
  .page { padding: 28px 32px; max-width: 940px; margin: 0 auto; }
  .header { background: linear-gradient(135deg,#dc2626,#991b1b); color: white; border-radius: 12px; padding: 18px 22px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
  .header-left p { font-size: 11px; opacity: 0.85; }
  .header-right { text-align: right; font-size: 11px; opacity: 0.85; line-height: 1.8; }
  /* Dulu di sini ada .status-pill: latar rgba(255,255,255,0.92) dengan tulisan
     putih — praktis putih di atas putih, jadi teksnya tidak pernah terbaca.
     Latar bulat itu dibuang seluruhnya di laporan ini; statusnya cukup teks. */
  .status-line { font-size: 11px; font-weight: 700; margin-top: 6px; opacity: 1; }
  .section { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
  .section-title { background: #f1f5f9; padding: 8px 14px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em; color: #475569; border-bottom: 1px solid #e2e8f0; }
  .log-section .section-title { background: #fff1f2; color: #9f1239; border-color: #fecdd3; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; }
  .grid2 > * { border-right: 1px solid #e2e8f0; }
  .grid2 > *:last-child { border-right: none; }
  .info-box { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
  .info-box:last-child { border-bottom: none; }
  .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 3px; }
  .info-value { font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.5; }
  table.log { width: 100%; border-collapse: collapse; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  .sign-grid { margin-top: 40px; display: grid; grid-template-columns: 250px; page-break-inside: avoid; }
  .sign-box { border-top: 1.5px solid #334155; padding-top: 8px; text-align: center; }
  .sign-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .sign-space { height: 58px; }
  .sign-name { font-size: 12px; font-weight: 700; color: #1e293b; border-top: 1px solid #cbd5e1; padding-top: 6px; }
  @media print {
    .page { padding: 16px 20px; }
    .section, .log-section { page-break-inside: avoid; }
    button { display: none !important; }
  }
</style>
</head>
<body><div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>🎫 Report Troubleshooting — IVP</h1>
      <p>Ticket ID: ${ticket.id?.substring(0,8).toUpperCase()}</p>
      <div class="status-line">PTS: ${statusLabel}${ticket.services_status ? " &nbsp;·&nbsp; Services: " + ticket.services_status : ""}</div>
    </div>
    <div class="header-right">
      <div><b>Dicetak:</b> ${printDate}</div>
      <div><b>Handler:</b> ${handlerPTS || "—"}</div>
      <div><b>Team:</b> ${teamHandler}</div>
      <div><b>Status:</b> ${statusLabel}${catatanServices}</div>
      <div><b>Dibuat:</b> ${formatDateTime(ticket.created_at)}</div>
    </div>
  </div>

  <!-- INFORMASI TICKET -->
  <div class="section">
    <div class="section-title">🎫 Informasi Ticket</div>
    <div class="grid2">
      <div>
        <div class="info-box"><div class="info-label">Nama Project</div><div class="info-value" style="font-size:14px;font-weight:800;color:#dc2626">${ticket.project_name}</div></div>
        <div class="info-box"><div class="info-label">Issue Case</div><div class="info-value">${ticket.issue_case}</div></div>
        <div class="info-box"><div class="info-label">Deskripsi</div><div class="info-value" style="font-weight:400;color:#475569">${ticket.description || "—"}</div></div>
      </div>
      <div>
        <div class="info-box"><div class="info-label">Address / Lokasi</div><div class="info-value">${ticket.address || "—"}</div></div>
        <div class="info-box"><div class="info-label">Product / Unit</div><div class="info-value">${ticket.product || "—"}</div></div>
        <div class="info-box"><div class="info-label">SN Unit</div><div class="info-value">${ticket.sn_unit || "—"}</div></div>
      </div>
    </div>
  </div>

  <!-- INFORMASI SALES & STATUS -->
  <div class="section">
    <div class="section-title">🏢 Sales & Status</div>
    <div class="grid2">
      <div>
        <div class="info-box"><div class="info-label">Sales / Account</div><div class="info-value">${ticket.sales_name || "—"}</div></div>
        <div class="info-box"><div class="info-label">Divisi Sales</div><div class="info-value">${ticket.sales_division || "—"}</div></div>
        <div class="info-box"><div class="info-label">Customer / User</div><div class="info-value">${ticket.customer_phone || "—"}</div></div>
      </div>
      <div>
        <div class="info-box"><div class="info-label">Status Team PTS IVP</div>
          <div class="info-value" style="color:${statusColor}">${ticket.status}${catatanServices}</div>
        </div>
        ${ticket.services_status ? `<div class="info-box"><div class="info-label">Status Team Services</div>
          <div class="info-value" style="color:#b45309">${ticket.services_status}</div>
        </div>` : ""}
        <div class="info-box"><div class="info-label">Tanggal Dibuat</div><div class="info-value">${formatDateTime(ticket.created_at)}</div></div>
        <div class="info-box"><div class="info-label">Created By</div><div class="info-value">${ticket.created_by || "—"}</div></div>
      </div>
    </div>
  </div>

  <!-- ACTIVITY LOG -->
  <div class="section log-section">
    <div class="section-title">📋 Activity Log — Riwayat Penanganan</div>
    ${activityRows ? `
    <table class="log">
      <thead>
        <tr style="background:#fff1f2">
          <th style="padding:8px 12px;font-size:10px;font-weight:700;text-align:left;color:#9f1239;border-bottom:1.5px solid #fecdd3;width:130px">Waktu</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:700;text-align:left;color:#9f1239;border-bottom:1.5px solid #fecdd3;width:140px">Handler & Status</th>
          <th style="padding:8px 12px;font-size:10px;font-weight:700;text-align:left;color:#9f1239;border-bottom:1.5px solid #fecdd3">Action & Notes</th>
        </tr>
      </thead>
      <tbody>${activityRows}</tbody>
    </table>` : `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">Belum ada activity log</div>`}
  </div>

  <!-- FOTO TICKET -->
  ${ticket.photo_url ? `
  <div class="section" style="page-break-inside:avoid">
    <div class="section-title">📸 Foto Ticket</div>
    <div style="padding:12px;text-align:center">
      <img src="${ticket.photo_url}" style="max-height:220px;max-width:100%;border-radius:8px;border:1.5px solid #e2e8f0" alt="foto ticket"/>
    </div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <div>🎫 IndoVisual Professional Tools — Ticket Troubleshooting System</div>
    <div>Dicetak: ${printDate} | Status: ${ticket.status}${catatanServices}</div>
  </div>

  <!-- TANDA TANGAN -->
  <div class="sign-grid">
    <div class="sign-box">
      <div class="sign-label">Handler / ${teamHandler}</div>
      <div class="sign-space"></div>
      <div class="sign-name">${handlerPTS || "( ............................ )"}</div>
    </div>
  </div>

</div></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(printContent); win.document.close(); setTimeout(() => win.print(), 300); }
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
        const { error } = await supabase.from("tickets").delete().in("id", ids);
        if (!error) {
          setTickets(prev => prev.filter(t => !selectedIds.has(t.id)));
          setSelectedIds(new Set());
        } else {
          notify("error", "Gagal menghapus: " + error.message);
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

  const exportToExcel = () => {
    const runExport = (XLSX: any) => {
      const exportTickets = currentUserTeamType === "Team Services" ? filteredTickets : tickets;
      const isServicesExport = currentUserTeamType === "Team Services";
      const border = { top: { style: "thin", color: { rgb: "D1D5DB" } }, bottom: { style: "thin", color: { rgb: "D1D5DB" } }, left: { style: "thin", color: { rgb: "D1D5DB" } }, right: { style: "thin", color: { rgb: "D1D5DB" } } };
      const boldBorder = { top: { style: "thin", color: { rgb: "000000" } }, bottom: { style: "thin", color: { rgb: "000000" } }, left: { style: "thin", color: { rgb: "000000" } }, right: { style: "thin", color: { rgb: "000000" } } };
      const hdrStyle = { font: { name: "Arial", bold: true, sz: 11, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: boldBorder };
      const secHdrStyle = { font: { name: "Arial", bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center" }, border: boldBorder };
      const cellStyle = { font: { name: "Arial", sz: 10 }, alignment: { vertical: "center", wrapText: true }, border };
      const altStyle = { ...cellStyle, fill: { fgColor: { rgb: "EFF6FF" }, patternType: "solid" } };
      const titleStyle = { font: { name: "Arial", bold: true, sz: 15, color: { rgb: "1E3A5F" } }, alignment: { horizontal: "left", vertical: "center" } };
      const statusStyles: Record<string, object> = {
        Solved: { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "166534" } }, fill: { fgColor: { rgb: "DCFCE7" }, patternType: "solid" } },
        "In Progress": { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "1E40AF" } }, fill: { fgColor: { rgb: "DBEAFE" }, patternType: "solid" } },
        Pending: { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "92400E" } }, fill: { fgColor: { rgb: "FEF3C7" }, patternType: "solid" } },
        Overdue: { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "991B1B" } }, fill: { fgColor: { rgb: "FEE2E2" }, patternType: "solid" } },
        "Waiting Approval": { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "9A3412" } }, fill: { fgColor: { rgb: "FFEDD5" }, patternType: "solid" } },
      };
      const c = (v: any, s: object) => ({ v, s, t: typeof v === "number" ? "n" : "s" });
      const empty = () => ({ v: "", s: cellStyle, t: "s" });
      const row = (cells: number) => Array(cells).fill(empty());
      const wb = XLSX.utils.book_new();
      const exportDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
      // Dashboard sheet
      {
        const COLS = 5;
        const dashTitle = isServicesExport ? "📊 TICKET REPORT — TEAM SERVICES" : "📊 TICKET REPORT — DASHBOARD ANALYTICS";
        const data: any[][] = [
          [c(dashTitle, titleStyle), ...row(COLS - 1)],
          [c(`Tanggal Export: ${exportDate}`, { font: { name: "Arial", sz: 10, color: { rgb: "6B7280" } } }), ...row(COLS - 1)],
          row(COLS),
          [c("RINGKASAN STATISTIK", secHdrStyle), ...row(COLS - 1)],
          [c("Kategori", hdrStyle), c("Jumlah", hdrStyle), c("Persentase", hdrStyle), c("", hdrStyle), c("", hdrStyle)],
        ];
        const totalExport = exportTickets.length;
        const statItems = isServicesExport ? [
          { label: "Total Tickets (Services)", value: totalExport, color: "1E3A5F" },
          { label: "Pending Check", value: exportTickets.filter((t: Ticket) => t.services_status === "Pending").length, color: "92400E" },
          { label: "Process Repair", value: exportTickets.filter((t: Ticket) => t.services_status === "Process Repair").length, color: "1E40AF" },
          { label: "Solved", value: exportTickets.filter((t: Ticket) => t.services_status === "Solved").length, color: "166534" },
        ] : [
          { label: "Total Tickets", value: stats.total, color: "1E3A5F" },
          { label: "Pending", value: stats.pending, color: "92400E" },
          { label: "In Progress", value: stats.processing, color: "1E40AF" },
          { label: "Solved", value: stats.solved, color: "166534" },
        ];
        statItems.forEach((item, i) => {
          const total = isServicesExport ? totalExport : stats.total;
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) + "%" : "0%";
          const rs = { ...cellStyle, ...(i % 2 ? { fill: { fgColor: { rgb: "EFF6FF" }, patternType: "solid" } } : {}) };
          data.push([
            c(item.label, { ...rs, font: { name: "Arial", sz: 10, bold: true, color: { rgb: item.color } } }),
            c(item.value, { ...rs, alignment: { horizontal: "center", vertical: "center" } }),
            c(pct, { ...rs, alignment: { horizontal: "center", vertical: "center" } }),
            empty(), empty(),
          ]);
        });
        data.push(row(COLS));
        const handlerMap: Record<string, number> = {};
        exportTickets.forEach((t: Ticket) => { if (t.assign_name) handlerMap[t.assign_name] = (handlerMap[t.assign_name] || 0) + 1; });
        data.push([c("HANDLER", hdrStyle), c("JUMLAH TICKET", hdrStyle), c("PERSENTASE", hdrStyle), c("", hdrStyle), c("", hdrStyle)]);
        Object.entries(handlerMap).forEach(([handler, count], i) => {
          const total = exportTickets.length;
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
          const rs = i % 2 === 0 ? cellStyle : altStyle;
          data.push([c(handler, rs), c(count, { ...rs, alignment: { horizontal: "center", vertical: "center" } }), c(pct, { ...rs, alignment: { horizontal: "center", vertical: "center" } }), empty(), empty()]);
        });
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } }, { s: { r: 3, c: 0 }, e: { r: 3, c: COLS - 1 } }];
        ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
        ws["!rows"] = [{ hpt: 30 }, { hpt: 18 }, { hpt: 8 }];
        XLSX.utils.book_append_sheet(wb, ws, "📊 Dashboard");
      }
      // Tickets sheet
      {
        const headers = ["No.", "Project Name", "Alamat", "Nama & Telepon Customer", "Sales", "Issue / Masalah", "Deskripsi", "SN Unit", "Product", "Handler (Assigned To)", "Status PTS", "Status Services", "Current Team", "Tgl Ticket", "Dibuat Oleh", "Dibuat Pada", "Jumlah Activity Log"];
        const COLS = headers.length;
        const data: any[][] = [[c(isServicesExport ? "📋 DATA TICKET — TEAM SERVICES" : "📋 DATA SEMUA TICKET", { ...titleStyle, font: { name: "Arial", bold: true, sz: 14, color: { rgb: "1E3A5F" } } }), ...row(COLS - 1)], row(COLS), headers.map((h) => c(h, hdrStyle))];
        exportTickets.forEach((t: Ticket, idx: number) => {
          const rs = idx % 2 === 0 ? cellStyle : altStyle;
          const overdue = isTicketOverdue(t);
          const effectiveStatus = overdue && t.status !== "Solved" ? "Overdue" : t.status;
          const statusDisplay = overdue && t.status !== "Solved" ? `${t.status} (OVERDUE)` : t.status;
          const ctr = { ...rs, alignment: { horizontal: "center", vertical: "center" } };
          data.push([
            c(idx + 1, ctr), c(t.project_name || "-", rs), c(t.address || "-", rs), c(t.customer_phone || "-", rs),
            c(t.sales_name || "-", rs), c(t.issue_case || "-", rs), c(t.description || "-", rs), c(t.sn_unit || "-", ctr), c((t as any).product || "-", rs),
            c(t.assign_name || "-", rs), c(statusDisplay, statusStyles[effectiveStatus] || rs), c(t.services_status || "-", t.services_status ? statusStyles[t.services_status] || rs : rs),
            c(t.current_team || "-", rs), c(t.date || "-", ctr), c(t.created_by || "-", rs),
            c(t.created_at ? formatDateTime(t.created_at) : "-", ctr), c(t.activity_logs?.length || 0, ctr),
          ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }];
        ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 30 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 38 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 10 }];
        ws["!rows"] = [{ hpt: 28 }, { hpt: 6 }, { hpt: 32 }];
        XLSX.utils.book_append_sheet(wb, ws, "📋 Semua Ticket");
      }
      // Activity Logs sheet
      {
        const headers = ["No.", "Project Name", "Issue", "Status Ticket", "Handler", "Team", "Action Taken", "Notes", "Status Baru", "Ke Services?", "File Lampiran", "Waktu Activity"];
        const COLS = headers.length;
        const data: any[][] = [[c(isServicesExport ? "📝 ACTIVITY LOG — TEAM SERVICES" : "📝 DETAIL ACTIVITY LOG", { ...titleStyle, font: { name: "Arial", bold: true, sz: 14, color: { rgb: "1E3A5F" } } }), ...row(COLS - 1)], row(COLS), headers.map((h) => c(h, hdrStyle))];
        let rowIdx = 0;
        exportTickets.forEach((ticket: Ticket) => {
          if (!ticket.activity_logs || ticket.activity_logs.length === 0) {
            const rs = rowIdx % 2 === 0 ? cellStyle : altStyle;
            data.push([
              c(rowIdx + 1, { ...rs, alignment: { horizontal: "center", vertical: "center" } }),
              c(ticket.project_name || "-", rs), c(ticket.issue_case || "-", rs), c(ticket.status || "-", statusStyles[ticket.status] || rs),
              c("-", rs), c("-", rs), c("-", rs), c("(Belum ada activity log)", { ...rs, font: { name: "Arial", sz: 10, color: { rgb: "9CA3AF" } } }),
              c("-", rs), c("-", rs), c("-", rs), c("-", rs),
            ]);
            rowIdx++;
            return;
          }
          [...ticket.activity_logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach((log) => {
            const rs = rowIdx % 2 === 0 ? cellStyle : altStyle;
            const ctr = { ...rs, alignment: { horizontal: "center", vertical: "center" } };
            data.push([
              c(rowIdx + 1, ctr), c(ticket.project_name || "-", rs), c(ticket.issue_case || "-", rs), c(ticket.status || "-", statusStyles[ticket.status] || rs),
              c(log.handler_name || "-", rs), c(log.team_type || "-", rs), c(log.action_taken || "-", rs),
              c(log.notes || "-", { ...rs, alignment: { horizontal: "left", vertical: "center", wrapText: true } }),
              c(log.new_status || "-", statusStyles[log.new_status] || rs),
              c(log.assigned_to_services ? "✅ Ya" : "Tidak", { ...ctr, font: { name: "Arial", sz: 10, bold: !!log.assigned_to_services, color: { rgb: log.assigned_to_services ? "166534" : "374151" } } }),
              c(log.file_name || "-", rs), c(log.created_at ? formatDateTime(log.created_at) : "-", ctr),
            ]);
            rowIdx++;
          });
        });
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }];
        ws["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 40 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 22 }];
        ws["!rows"] = [{ hpt: 28 }, { hpt: 6 }, { hpt: 32 }];
        XLSX.utils.book_append_sheet(wb, ws, "📝 Activity Logs");
      }
      const teamLabel = isServicesExport ? "Services" : "PTS";
      const fileName = `Ticket_Report_${teamLabel}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName, { bookType: "xlsx", type: "binary", cellStyles: true });
    };
    if ((window as any).XLSX) runExport((window as any).XLSX);
    else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = () => runExport((window as any).XLSX);
      script.onerror = () => notify("error", "Gagal memuat library Excel.");
      document.head.appendChild(script);
    }
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
    const pending = tickets.filter((t) => t.status === "Pending").length;
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

  // ── Product stats untuk mini donut chart ──────────────────────────
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

  // Team yg boleh di-assign tiket = ASSIGNABLE_PTS_TEAMS (IVP/MVI — UMP dikecualikan,
  // lihat lib/teams.ts). Manager dikecualikan — bukan handler teknis biasa.
  const teamPTSMembers = useMemo(() => teamMembers.filter((m) => isAssignablePTSTeam(m.team_type) && m.jabatan !== "Manager"), [teamMembers]);
  const teamServicesMembers = useMemo(() => teamMembers.filter((m) => m.team_type === "Team Services" && m.jabatan !== "Manager"), [teamMembers]);
  // Supervisor PTS — utk opsi "Route ke Supervisor" saat approve (tahap supervisor_assign).
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

  // ── Realtime subscription: auto-update tanpa refresh ─────────────────────
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
    // Polling fallback setiap 30 detik — juga silent
    const pollInterval = setInterval(() => fetchData(currentUser, true), 30000);
    return () => {
      supabase.removeChannel(ptsCh);
      supabaseServices.removeChannel(svcCh);
      clearInterval(pollInterval);
    };
  }, [currentUser]);

  // ── SLA Auto-Escalation ──────────────────────────────────────────────────────
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
  const canUpdateTicket = currentUser?.role !== "guest";
  // canAccessAccountSettings TETAP admin/superadmin murni — khusus modal
  // "Account Management" (buat akun, ganti password, daftar user), bukan
  // untuk aksi tiket biasa.
  const canAccessAccountSettings = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  // Akun Team PTS dengan toggle "Full Access" aktif (lihat lib/constants.ts
  // hasFullAccess) — mis. Dhany (Manager PTS) — boleh approve & assign ticket
  // (langsung ke team, route ke Supervisor, atau kerjakan sendiri) seperti admin.
  const isManagerPTS = hasFullAccess(currentUser);
  const canApproveAssign = canAccessAccountSettings || isManagerPTS;
  // Aksi kelola tiket sehari-hari (hapus, bulk-select, reminder cron, overdue
  // setting) — BUKAN hak kelola akun. Dipisah dari canAccessAccountSettings
  // supaya Full Access tidak otomatis dapat modal Account Management.
  const canManageTickets = canApproveAssign;

  /**
   * Field ticket yang boleh dibetulkan admin lewat panel Edit Detail.
   *
   * Sengaja TIDAK memuat assign_name / routing_status / assigned_supervisor_id:
   * ketiganya milik bagian Re-route, yang punya syarat sendiri (lihat
   * bolehReroute) dan efek samping sendiri (WA ke penerima baru). Kalau ikut
   * di sini, mengetik nama di kotak teks bisa memindahkan pekerjaan orang
   * tanpa ada yang diberi tahu.
   */
  const TICKET_ADMIN_FIELDS: AdminField[] = [
    { key: 'project_name',   label: 'Nama Project',    span: 2 },
    { key: 'date',           label: 'Tanggal',         type: 'date' },
    { key: 'sales_name',     label: 'Sales',           span: 1 },
    { key: 'sales_division', label: 'Divisi Sales',    span: 1 },
    { key: 'customer_phone', label: 'Telepon Customer', type: 'tel' },
    { key: 'address',        label: 'Alamat',          span: 3 },
    { key: 'issue_case',     label: 'Issue / Kasus',   span: 3 },
    { key: 'description',    label: 'Deskripsi',       type: 'textarea', span: 3 },
    { key: 'sn_unit',        label: 'Serial Number' },
    { key: 'product',        label: 'Produk' },
    { key: 'priority',       label: 'Prioritas', type: 'select',
      options: ['Low', 'Medium', 'High', 'Critical'].map(v => ({ value: v, label: v })) },
    { key: 'status',         label: 'Status', type: 'select',
      options: ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Solved', 'Rejected'].map(v => ({ value: v, label: v })) },
    { key: 'current_team',   label: 'Team Penanganan', type: 'select',
      options: ['Team PTS IVP', 'Team PTS MVI', 'Team PTS UMP', 'Team Services'].map(v => ({ value: v, label: v })) },
    { key: 'brand',          label: 'Brand', type: 'select',
      options: BRAND_OPTIONS.map(b => ({ value: b.value, label: b.label })) },
  ];

  /**
   * Re-route hanya boleh selama pekerjaannya BELUM jalan.
   *
   * Begitu ticket melewati "Pending", sudah ada orang yang menelepon customer,
   * datang ke lokasi, atau mulai memperbaiki. Memindahkannya saat itu bukan
   * membetulkan salah route — itu membuang pekerjaan yang sudah terlanjur
   * dikerjakan, dan riwayatnya jadi menunjuk orang yang tidak mengerjakannya.
   */
  const bolehReroute = (t: Ticket): boolean => {
    if (['Call', 'Onsite', 'In Progress', 'Solved', 'Rejected'].includes(t.status)) return false;
    // Ticket yang sudah masuk alur Team Services punya tahapannya sendiri.
    const ss = t.services_status ?? '';
    if (ss && !['Waiting Approval', 'Pending'].includes(ss)) return false;
    return true;
  };


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
      await supabase.from("tickets").update({ services_status: "Pending" }).eq("id", ticket.id);
      try { await supabaseServices.from("tickets").update({ services_status: "Pending", status: "Pending" }).eq("id", ticket.id); } catch { }
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
          await supabase.from("tickets").update({ current_team: "Team PTS IVP", services_status: null, status: "In Progress" }).eq("id", ticket.id);
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
            await supabaseServices.from("tickets").update({ services_status: "Returned to PTS", current_team: "Team PTS IVP" }).eq("id", ticket.id);
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
          } catch { }
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100]">
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
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Ticket
            </button>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

          {/* ── GUEST SUMMARY SECTION (same style as admin) ── */}
          {currentUser?.role === "guest" && (
            <div className="mb-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-slide-up anim-d80">
                {[
                  { label: "Total Tickets", value: stats.total, sub: "Seluruh tiket saya", accent: "#4f46e5" },
                  { label: "Waiting Approval", value: tickets.filter((t) => t.status === "Waiting Approval").length, sub: "Menunggu persetujuan", accent: "#c2410c" },
                  { label: "Pending", value: stats.pending, sub: "Menunggu tindakan", accent: "#b45309" },
                  { label: "In Progress", value: stats.processing, sub: "Sedang ditangani", accent: "#1d4ed8" },
                  { label: "Solved", value: stats.solved, sub: "Terselesaikan", accent: "#047857" },
                ].map((card, i) => <StatCard key={i} {...card} />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-zoom-in anim-d160">
                <StatusDonutCard
                  data={[
                    { name: "Waiting Approval", value: tickets.filter((t) => t.status === "Waiting Approval").length, color: "#FB923C" },
                    ...stats.statusData,
                  ].filter((d) => d.value > 0)}
                  total={stats.total}
                  onSliceClick={() => {}}
                  title="Status Distribution"
                  icon="🥧"
                />
                <HandlerDonutCard
                  data={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).map((h: any, i: number) => ({ name: h.name, value: h.tickets, color: ["#7c3aed","#0ea5e9","#10b981","#e11d48","#f59e0b","#6366f1"][i%6] }))}
                  total={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).reduce((s:number,h:any) => s+h.tickets, 0)}
                  teamToggle={selectedHandlerTeam}
                  onToggle={(t: "PTS" | "Services") => setSelectedHandlerTeam(t)}
                  onSliceClick={() => {}}
                  activeHandler={null}
                  title="Team Handlers"
                  icon="👥"
                />
                <SalesDivisionDonutCard
                  data={salesDivisionStats.data}
                  total={salesDivisionStats.total}
                  onSliceClick={() => {}}
                  activeDivision={null}
                />
                <ProductDonutCard
                  data={productStats.data}
                  total={productStats.total}
                  onSliceClick={() => {}}
                  activeProduct={null}
                />
              </div>
            </div>
          )}

          {(currentUser?.role === "admin" || currentUser?.role === "superadmin" || (currentUser?.role === "team" && currentUserTeamType === "Team PTS IVP" || currentUserTeamType === "Guest")) && (
            <div className="mb-4 space-y-4">
              {/* ── Stat Cards (Redesigned like ReminderSchedule) ── */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 animate-slide-up anim-d80">
                {[
                  { label: "Total Tickets", value: stats.total, sub: "Seluruh tiket", accent: "#4f46e5", onClick: () => { setFilterStatus("All"); setHandlerFilter(null); }, active: filterStatus === "All" && !handlerFilter },
                  { label: "Pending", value: stats.pending, sub: "Menunggu tindakan", accent: "#b45309", onClick: () => { setFilterStatus(filterStatus === "Pending" ? "All" : "Pending"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Pending" },
                  { label: "In Progress", value: stats.processing, sub: "Sedang ditangani", accent: "#1d4ed8", onClick: () => { setFilterStatus(filterStatus === "In Progress" ? "All" : "In Progress"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "In Progress" },
                  { label: "Solved", value: stats.solved, sub: "Terselesaikan", accent: "#047857", onClick: () => { setFilterStatus(filterStatus === "Solved" ? "All" : "Solved"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Solved" },
                  { label: "Overdue", value: stats.overdue, sub: "Berpotensi denda", accent: "#b91c1c", onClick: () => { setFilterStatus(filterStatus === "Overdue" ? "All" : "Overdue"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Overdue" },
                  { label: "Solved Overdue", value: stats.solvedOverdue, sub: "Butuh verifikasi", accent: "#6d28d9", onClick: () => { setFilterStatus(filterStatus === "Solved Overdue" ? "All" : "Solved Overdue"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Solved Overdue" },
                ].map((card, i) => <StatCard key={i} {...card} />)}
              </div>

              {/* ── Donut Charts ── */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-zoom-in anim-d160">
                <StatusDonutCard data={stats.statusData} total={stats.statusData.reduce((s, d) => s + d.value, 0)} onSliceClick={(name: string) => { const mapped = name === "Solved (Overdue)" ? "Solved Overdue" : name; setFilterStatus((prev) => prev === mapped ? "All" : mapped); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} title="Status Distribution" icon="🥧" />
                <HandlerDonutCard data={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).map((h: any, i: number) => ({ name: h.name, value: h.tickets, color: ["#7c3aed", "#0ea5e9", "#10b981", "#e11d48", "#f59e0b", "#6366f1", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"][i % 12] }))} total={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).reduce((s, h) => s + h.tickets, 0)} teamToggle={selectedHandlerTeam} onToggle={(t: "PTS" | "Services") => setSelectedHandlerTeam(t)} onSliceClick={(name: string) => { setHandlerFilter((prev: string | null) => prev === name ? null : name); setFilterStatus("All"); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} activeHandler={handlerFilter} title="Team Handlers" icon="👥" />
                <SalesDivisionDonutCard data={salesDivisionStats.data} total={salesDivisionStats.total} onSliceClick={(division: string) => { setSalesDivisionFilter((prev: string | null) => prev === division ? null : division); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} activeDivision={salesDivisionFilter} />
                <ProductDonutCard data={productStats.data} total={productStats.total} onSliceClick={(prod: string) => { setProductFilter((prev) => prev === prod ? null : prod); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} activeProduct={productFilter} />
              </div>
            </div>
          )}

          {/* ── TICKET LIST (with integrated search/filter bar like image) ── */}
          <div ref={ticketListRef} className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(200,200,200,0.6)", backdropFilter: "blur(12px)" }}>
            {/* Header with title and actions */}
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ticket List</span>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{ticketsLoading ? "..." : filteredTickets.length}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                {/* Ketiga tombol memakai kerangka yang SAMA (tinggi, padding, radius,
                    ukuran ikon) dan hanya dibedakan oleh peran: Export adalah aksi
                    utama sehingga dibuat solid, dua lainnya sekunder sehingga bergaris.
                    Sebelumnya tiap tombol punya tinggi & gaya sendiri — Export bahkan
                    membesar saat disentuh — sehingga barisnya terlihat tidak rapi. */}
                {canManageTickets && (
                  <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400 ${selectMode ? 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <Ico name={selectMode ? "close" : "check"} className="w-3.5 h-3.5" />
                    {selectMode ? 'Batal' : 'Select'}
                  </button>
                )}
                <button onClick={() => fetchData()} disabled={loading}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400">
                  <Ico name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button onClick={exportToExcel} disabled={uploading}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white border border-transparent transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ background: '#be123c' }}>
                  {uploading
                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Ico name="chart" className="w-3.5 h-3.5" />}
                  Export
                </button>
              </div>
            </div>

            {/* Integrated search filters row - like the image */}
            <div className="px-6 py-3 border-b border-gray-100" style={{ background: "rgba(255,255,255,0.97)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Project / Location</label>
                  <div className="relative">
                    <Ico name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      value={searchProject} 
                      onChange={(e) => setSearchProject(e.target.value)} 
                      placeholder="Search project / lokasi..." 
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Sales Name</label>
                  <div className="relative">
                    <Ico name="user" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      value={searchSalesName} 
                      onChange={(e) => setSearchSalesName(e.target.value)} 
                      placeholder="Search sales name..." 
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Product</label>
                  <div className="relative">
                    <Ico name="package" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchProduct}
                      onChange={(e) => { setSearchProduct(e.target.value); setProductFilter(null); }}
                      placeholder="Cari product..."
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Handler</label>
                  <div className="relative">
                    <Ico name="users" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={handlerFilter || ""} 
                      onChange={(e) => setHandlerFilter(e.target.value || null)} 
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
                    >
                      <option value="">All Handlers</option>
                      {teamMembers.filter(m => m.team_type?.startsWith(`Team ${selectedHandlerTeam}`)).map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <Ico name="chevron" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                  <div className="relative">
                    <Ico name="tag" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={filterStatus} 
                      onChange={(e) => setFilterStatus(e.target.value)} 
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
                    >
                      <option value="All">All Status</option>
                      <option value="Waiting Approval">⏳ Waiting Approval</option>
                      <option value="Pending">🟡 Pending</option>
                      <option value="Call">📞 Call</option>
                      <option value="Onsite">🚗 Onsite</option>
                      <option value="In Progress">🔵 In Progress</option>
                      <option value="Solved">✅ Solved</option>
                      {(currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                        <>
                          <option value="Overdue">🚨 Overdue</option>
                          <option value="Solved Overdue">⚠️ Solved Overdue</option>
                        </>
                      )}
                    </select>
                    <Ico name="chevron" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Year</label>
                  <div className="relative">
                    <Ico name="calendar" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={filterYear} 
                      onChange={(e) => setFilterYear(e.target.value)} 
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (<option key={year} value={year}>{year}</option>))}
                    </select>
                    <Ico name="chevron" className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk delete bar — admin only, selectMode only */}
            {selectMode && canManageTickets && selectedIds.size > 0 && (
              <div className="px-6 py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(220,38,38,0.07)' }}>
                <span className="text-sm font-bold text-red-700">{selectedIds.size} ticket dipilih</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
                  <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
                    className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                    {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size} Ticket`}
                  </button>
                </div>
              </div>
            )}

            {/* ── Filter Aktif chips — posisi di bawah filter bar ── */}
            {(filterStatus !== "All" || handlerFilter || salesDivisionFilter || productFilter || searchProject || searchSalesName || searchProduct) && (
              <div className="px-6 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center" style={{ background: "rgba(255,255,255,0.97)" }}>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
                {filterStatus !== "All" && (
                  <button onClick={() => setFilterStatus("All")} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#d97706" }}>Status: {filterStatus} ✕</button>
                )}
                {handlerFilter && (
                  <button onClick={() => setHandlerFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#7c3aed" }}>Handler: {handlerFilter} ✕</button>
                )}
                {salesDivisionFilter && (
                  <button onClick={() => setSalesDivisionFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#ec4899" }}>Division: {salesDivisionFilter} ✕</button>
                )}
                {productFilter && (
                  <button onClick={() => { setProductFilter(null); setSearchProduct(""); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#6366f1" }}>📦 {productFilter} ✕</button>
                )}
                {searchProject && (
                  <button onClick={() => setSearchProject("")} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#475569" }}>🔍 {searchProject} ✕</button>
                )}
                {searchSalesName && (
                  <button onClick={() => setSearchSalesName("")} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: "#475569" }}>👤 {searchSalesName} ✕</button>
                )}
                <button onClick={() => { setFilterStatus("All"); setHandlerFilter(null); setSalesDivisionFilter(null); setProductFilter(null); setSearchProduct(""); setSearchProject(""); setSearchSalesName(""); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.25)" }}>🗑️ Reset Semua</button>
              </div>
            )}

            {fetchError ? (
              <ErrorState message={fetchError} onRetry={() => { setFetchError(null); fetchData(); }} />
            ) : ticketsLoading ? (
              <div className="space-y-3 py-2 p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-4 border border-gray-200">
                    <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-2/5"></div><div className="h-3 bg-gray-100 rounded w-1/4"></div></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div><div className="h-4 bg-gray-200 rounded w-1/5"></div><div className="h-6 bg-gray-200 rounded-full w-20"></div><div className="h-8 bg-gray-200 rounded-lg w-16"></div>
                  </div>
                ))}
                <div className="flex items-center justify-center gap-3 py-4 text-gray-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div><span className="text-sm font-medium">Memuat daftar ticket...</span></div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <ListEmptyState
                adaFilterAktif={searchProject.trim() !== '' || searchSalesName.trim() !== '' || filterStatus !== 'All' || filterYear !== 'all'}
                onReset={() => { setSearchProject(''); setSearchSalesName(''); setFilterStatus('All'); setFilterYear('all'); }}
                icon="🎫"
                judulKosong="Belum ada tiket"
                deskripsiKosong="Tiket kendala yang dilaporkan akan muncul di sini."
              />
            ) : (
              <>
              {/* ── MOBILE: Card view (hidden on md+) ── */}
              <div className="md:hidden divide-y divide-gray-100">
                {paginatedTickets.map((ticket, index) => {
                  const overdue = isTicketOverdue(ticket);
                  const overdueSetting = getOverdueSetting(ticket.id);
                  const isActiveOverdue = overdue && ticket.status !== "Solved";
                  return (
                    <div key={ticket.id}
                      className={`px-4 py-3.5 ${isActiveOverdue ? 'bg-red-50/60 border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isActiveOverdue && <Ico name="alert" className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            <p className="font-bold text-sm text-gray-800 leading-tight">{ticket.project_name}</p>
                          </div>
                          {ticket.address && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate flex items-center gap-1"><Ico name="pin" className="w-3 h-3 shrink-0" />{ticket.address.split(',')[0]}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">{ticket.created_at ? formatDateTime(ticket.created_at) : '—'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${ticket.status === "Waiting Approval" ? statusColors["Waiting Approval"] : statusColors[ticket.status] || statusColors["Pending"]}`}>
                            {ticket.status === "Waiting Approval" ? "⏳ Waiting" : ticket.status}
                          </span>
                          {overdue && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${ticket.status === "Solved" ? "bg-purple-100 text-purple-800 border-purple-400" : statusColors["Overdue"]}`}>
                              {ticket.status === "Solved" ? "⚠️ Overdue" : "🚨 Overdue"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5 text-xs">
                        <div className="truncate"><span className="text-gray-400">Issue: </span><span className="text-gray-700 font-medium">{ticket.issue_case}</span></div>
                        <div className="truncate"><span className="text-gray-400">Handler: </span><span className="text-gray-700 font-medium">{ticket.assign_name || '—'}</span></div>
                        {ticket.product && <div className="truncate"><span className="text-gray-400">Product: </span><span className="text-indigo-600 font-semibold">{ticket.product}</span></div>}
                        {ticket.sales_name && <div className="truncate"><span className="text-gray-400">Sales: </span><span className="text-gray-700 font-medium">{ticket.sales_name}</span></div>}
                        {ticket.sn_unit && <div className="col-span-2 truncate"><span className="text-gray-400">SN: </span><span className="text-gray-600">{ticket.sn_unit}</span></div>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        <ViewIconBtn onClick={() => { setSelectedTicket(ticket); setShowTicketDetailPopup(true); }} title="Detail" />
                        <FlowchartIconBtn onClick={() => { setSummaryTicket(ticket); setShowActivitySummary(true); }} />
                        <PrintIconBtn onClick={() => exportToPDF(ticket)} />
                        {canApproveAssign && ticket.status === "Waiting Approval" && (
                          <ApproveIconBtn onClick={() => { setApprovalAssignees({}); setApprovalTicket(ticket); setApprovalAssignee(""); fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true); }} pulse />
                        )}
                        {ticket.status === "Solved" && canUpdateTicket && (
                          <ReopenIconBtn onClick={() => { setReopenTargetTicket(ticket); setReopenAssignee(ticket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); }} />
                        )}
                        {canManageTickets && (
                          <DeleteIconBtn onClick={() => { setDeleteTargetTicket(ticket); setDeleteConfirmText(""); setShowDeleteModal(true); }} />
                        )}
                        {canManageTickets && (
                          <OverdueIconBtn onClick={() => { setOverdueTargetTicket(ticket); const existing = getOverdueSetting(ticket.id); setOverdueForm({ due_hours: existing?.due_hours ? String(existing.due_hours) : "48" }); setShowOverdueSetting(true); }} active={!!overdueSetting} />
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Mobile pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white/90">
                  <span className="text-xs text-gray-400">{filteredTickets.length} tiket</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30">‹ Prev</button>
                      <span className="text-xs text-gray-500 font-medium">{currentPage}/{totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30">Next ›</button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── DESKTOP: Table view (hidden on mobile) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed border-collapse table-zebra" style={{ background: "transparent", minWidth: '1100px' }}>
                  <colgroup>
                    <col style={{ width: "3%" }} />   {/* No */}
                    <col style={{ width: "15%" }} />  {/* Project / Lokasi*/}
                    <col style={{ width: "9%" }} />   {/* Warranty */}
                    <col style={{ width: "16%" }} />  {/* Product */}
                    <col style={{ width: "12%" }} />   {/* SN Unit */}
                    <col style={{ width: "13%" }} />  {/* Issue */}
                    <col style={{ width: "9%" }} />   {/* Assigned */}
                    <col style={{ width: "7%" }} />   {/* Status */}
                    <col style={{ width: "7%" }} />   {/* Sales */}
                    <col style={{ width: "10%" }} />  {/* Action */}
                  </colgroup>
                  {/* Header menempel saat digulir: daftar tiket bisa panjang, dan tanpa ini
                      pembaca kehilangan acuan kolom begitu baris pertama lewat layar. */}
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200" style={{ background: "#f8fafc" }}>
                      <th className="px-2 py-3 text-center text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {selectMode && canManageTickets
                          ? <input type="checkbox"
                              checked={selectedIds.size === filteredTickets.length && filteredTickets.length > 0}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded accent-red-600 cursor-pointer" title="Pilih Semua" />
                          : 'No'}
                      </th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Project / Lokasi</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Warranty</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Product</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">SN Unit</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Issue</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Assigned</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">Sales</th>
                      <th className="px-2 py-3 text-center text-[11px] font-bold text-slate-600 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTickets.map((ticket, index) => {
                      const overdue = isTicketOverdue(ticket);
                      const overdueSetting = getOverdueSetting(ticket.id);
                      const creatorUser = users.find((u) => u.username === ticket.created_by);
                      const creatorLabel = creatorUser ? creatorUser.full_name : ticket.created_by || "-";
                      const isSolvedOverdue = overdue && ticket.status === "Solved";
                      const isActiveOverdue = overdue && ticket.status !== "Solved";
                      return (
                        <tr key={ticket.id} className={`stagger-item border-b border-gray-100 hover:bg-gray-50/70 transition-colors ${isActiveOverdue ? "bg-red-50 border-l-4 border-l-red-400" : isSolvedOverdue ? "bg-purple-50/60 border-l-4 border-l-purple-300" : ""}`}>
                          <td className="px-2 py-3 align-middle text-center" onClick={e => e.stopPropagation()}>
                            {selectMode && canManageTickets
                              ? <input type="checkbox" checked={selectedIds.has(ticket.id)}
                                  onChange={() => toggleSelectId(ticket.id)}
                                  className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                              : <span className="text-[11px] font-bold text-gray-400">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <div className="flex items-start gap-1">
                              {isActiveOverdue && <span className="mt-0.5 shrink-0" title="Overdue!"><Ico name="alert" className="w-3.5 h-3.5 text-red-500" /></span>}
                              <div className="font-bold text-gray-800 text-sm break-words leading-tight">{ticket.project_name}</div>
                            </div>
                            {ticket.address && (
                              <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-0.5">
                                <Ico name="pin" className="w-3 h-3 shrink-0" />
                                <span className="truncate">{ticket.address.split(',')[0]}</span>
                              </div>
                            )}
                            
                            <div className="text-[10px] text-gray-400 mt-1">{ticket.created_at ? formatDateTime(ticket.created_at) : "-"}</div>
                            {isActiveOverdue && <div className="text-xs text-red-600 font-bold mt-0.5">⏰ OVERDUE</div>}
                          </td>
                          {/* Warranty cell */}
                          <td className="px-3 py-3 align-middle">
                            {(() => {
                              const w = getWarrantyInfo(ticket.project_name);
                              if (!w) return <span className="text-gray-300 text-xs">—</span>;
                              return (
                                <div>
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                    style={w.isIn
                                      ? { background: "rgba(14,165,233,0.14)", color: "#0369a1" }
                                      : { background: "rgba(239,68,68,0.12)", color: "#dc2626" }}>
                                    {w.isIn ? "🛡️" : "⚠️"} {w.isIn ? "In" : "Out"}
                                  </span>
                                  <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">
                                    {w.wy}Y · s/d {w.expiryStr}
                                  </div>
                                  <div className="text-[9px] font-semibold mt-0.5"
                                    style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                                    {w.isIn ? `sisa ${w.diffDays}h` : `lewat ${Math.abs(w.diffDays)}h`}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            {ticket.product && (
                              <button onClick={() => { setProductFilter(prev => prev === ticket.product ? null : (ticket.product ?? null)); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                                className="mt-1 text-[12px] font-semibold px-1.5 py-0.5 rounded break-words leading-tight transition-all inline-block"
                                style={{ background: productFilter === ticket.product ? '#6366f1' : '#eef2ff', color: productFilter === ticket.product ? 'white' : '#4338ca' }}>
                                📦 {ticket.product}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3 align-middle py-4"><div className="text-[13px] text-gray-600 break-words leading-tight">{ticket.sn_unit || "—"}</div></td>
                          <td className="px-3 py-3 align-middle py-4"><div className="text-[13px] text-gray-700 break-words leading-tight">{ticket.issue_case}</div></td>
                          <td className="px-3 py-3 align-middle py-4">
                            <div className="text-sm text-gray-700 break-words leading-tight">{ticket.assign_name}</div>
                            {/* Tampilkan team handler (dari users), bukan current_team ticket */}
                            {(() => {
                              const handler = teamMembers.find(m => m.name === ticket.assign_name);
                              const handlerTeam = handler?.team_type || "Team PTS IVP";
                              const isServices = ticket.current_team === "Team Services" || !!ticket.services_status;
                              return (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-xs font-semibold" style={{ color: handlerTeam === "Team Services" ? "#7c3aed" : "#2563eb" }}>
                                    {handlerTeam}
                                  </span>
                                  {isServices && handlerTeam !== "Team Services" && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                                      → Svc
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-3 align-middle py-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 text-xs font-bold ${ticket.status === "Waiting Approval" ? statusColors["Waiting Approval"] : statusColors[ticket.status] || statusColors["Pending"]}`}>{ticket.status === "Waiting Approval" ? "⏳ Waiting Approval" : ticket.status}</span>
                              {overdue && <span className={`px-2 py-0.5 text-xs font-bold ${ticket.status === "Solved" ? "bg-purple-100 text-purple-800 border-purple-400" : statusColors["Overdue"]}`}>{ticket.status === "Solved" ? "⚠️ Solved Overdue" : "🚨 Overdue"}</span>}
                              {ticket.services_status && <span className={`px-2 py-0.5 text-xs font-bold ${statusColors[ticket.services_status]}`}>Svc: {ticket.services_status}</span>}
                              {ticket.status === "Onsite" && (
                                <button
                                  onClick={e => { e.stopPropagation(); router.push('/reminder-schedule'); }}
                                  className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors"
                                  style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                                  🗓️ Jadwal
                                </button>
                              )}
                            </div>
                           </td>
                          <td className="px-2 py-3 align-middle"><div className="text-xs text-gray-600 break-words leading-tight">{ticket.sales_name || "—"}</div>{ticket.sales_division && <div className="text-xs text-purple-500 font-semibold mt-0.5">{ticket.sales_division}</div>}</td>
                          <td className="px-1 py-2 align-middle">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {/* Activity log badge + View */}
                              <div className="relative inline-flex">
                                <ViewIconBtn onClick={() => { setSelectedTicket(ticket); setShowTicketDetailPopup(true); }} title="Detail" />
                                {ticket.activity_logs && ticket.activity_logs.length > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">{ticket.activity_logs.length}</span>
                                )}
                              </div>
                              {/* Flowchart */}
                              <FlowchartIconBtn onClick={() => { setSummaryTicket(ticket); setShowActivitySummary(true); }} />
                              {/* Print PDF */}
                              <PrintIconBtn onClick={() => exportToPDF(ticket)} />
                              {/* Waiting Approval — admin only */}
                              {canApproveAssign && ticket.status === "Waiting Approval" && (
                                <ApproveIconBtn onClick={() => { setApprovalAssignees({}); setApprovalTicket(ticket); setApprovalAssignee(""); fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true); }} pulse />
                              )}
                              {/* Re-open */}
                              {ticket.status === "Solved" && canUpdateTicket && (
                                <ReopenIconBtn onClick={() => { setReopenTargetTicket(ticket); setReopenAssignee(ticket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); }} />
                              )}
                              {/* Hapus — admin only */}
                              {canManageTickets && (
                                <DeleteIconBtn onClick={() => { setDeleteTargetTicket(ticket); setDeleteConfirmText(""); setShowDeleteModal(true); }} />
                              )}
                              {/* Overdue Setting — admin only */}
                              {canManageTickets && (
                                <OverdueIconBtn onClick={() => { setOverdueTargetTicket(ticket); const existing = getOverdueSetting(ticket.id); setOverdueForm({ due_hours: existing?.due_hours ? String(existing.due_hours) : "48" }); setShowOverdueSetting(true); }} active={!!overdueSetting} />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 flex-wrap gap-2" style={{ background: "rgba(255,255,255,0.97)" }}>
                  <span className="text-xs text-gray-400">{filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""} ditemukan</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                        className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all" title="First page">«</button>
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">‹ Prev</button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let page: number;
                          if (totalPages <= 5) page = i + 1;
                          else if (currentPage <= 3) page = i + 1;
                          else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                          else page = currentPage - 2 + i;
                          return (
                            <button key={page} onClick={() => setCurrentPage(page)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${currentPage === page ? 'text-white border-0' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                              style={currentPage === page ? { background: 'linear-gradient(135deg,#dc2626,#b91c1c)' } : {}}>
                              {page}
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all">Next ›</button>
                      <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                        className="px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-all" title="Last page">»</button>
                    </div>
                  )}
                  <span className="text-xs text-gray-400">
                    {filteredTickets.length > 0 ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}` : "0"} of {tickets.length}
                  </span>
                </div>
              </div>{/* end hidden md:block */}
              </>
            )}
          </div>
        </div>

        {/* ── All modals remain the same as original (notifications, detail popup, etc.) ── */}
        {/* ... (all other modals - notification popup, ticket detail, update form, approval modals, etc. remain unchanged) ... */}

        {/* Bulk Delete Confirm Modal */}
        {bulkConfirm && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
                <span className="text-2xl">🗑️</span>
                <div>
                  <h3 className="font-bold text-white">Hapus {selectedIds.size} Ticket?</h3>
                  <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-5">
                  Kamu akan menghapus <strong>{selectedIds.size} ticket</strong> yang dipilih secara permanen dari sistem.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setBulkConfirm(false)}
                    className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">
                    Batal
                  </button>
                  <button onClick={async () => {
                    setBulkConfirm(false); setBulkDeleting(true);
                    const ids = Array.from(selectedIds);
                    const { error } = await supabase.from("tickets").delete().in("id", ids);
                    if (!error) { setTickets(prev => prev.filter(t => !selectedIds.has(t.id))); setSelectedIds(new Set()); setSelectMode(false); }
                    else notify("error", "Gagal: " + error.message);
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

        {/* ── NOTIFICATION POPUP (Redesigned) ── */}
        {showNotificationPopup && notifications.length > 0 && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-5 flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3"><span className="text-3xl animate-bounce">🔔</span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3><p className="text-sm text-white/90">{notifications.length} tickets need attention</p></div></div>
                  <button onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-5 flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3"><span className="text-3xl">🔔</span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3>{notifications.length > 0 && <p className="text-sm text-white/90">{notifications.length} tickets need attention</p>}</div></div>
                  <button onClick={() => setShowNotifications(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-3"
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
                  <button onClick={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); }}
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
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">Progress</p>
                    <div className="flex items-center">
                      {(["Pending","Call","Onsite","In Progress","Solved"] as const).map((step, idx, arr) => {
                        const order = ["Pending","Call","Onsite","In Progress","Solved"];
                        const curIdx = order.indexOf(selectedTicket.status);
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
                    <button onClick={() => exportToPDF(selectedTicket)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>📄 PDF</button>
                    {selectedTicket.status === "Solved" && canUpdateTicket && currentUserTeamType !== "Team Services" && (
                      <button onClick={() => { setReopenTargetTicket(selectedTicket); setReopenAssignee(selectedTicket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>🔓 Re-open</button>
                    )}
                    {canUpdateTicket && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
                      <button onClick={() => setShowUpdateForm(!showUpdateForm)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${showUpdateForm ? 'bg-gray-200 text-gray-700' : 'text-white'}`}
                        style={showUpdateForm ? {} : { background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
                        {showUpdateForm ? '✕ Tutup' : '➕ Update Status'}
                      </button>
                    )}
                    {canUpdateTicket && currentUserTeamType === "Team Services" && selectedTicket.services_status === "Waiting Approval" && (
                      <button onClick={() => setShowServicesApprovalModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>🔧 Konfirmasi</button>
                    )}
                    <button onClick={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 bg-white">✕ Close</button>
                  </div>
              </div>

              {/* RIGHT: Update Status Panel */}
              {showUpdateForm && canUpdateTicket && selectedTicket.status !== "Waiting Approval" && (currentUserTeamType === "Team Services" ? selectedTicket.services_status !== "Solved" && selectedTicket.services_status !== "Waiting Approval" : selectedTicket.status !== "Solved") && (
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden flex-shrink-0"
                  style={{ width: 340, animation: "scale-in 0.2s ease-out", border: "2px solid rgba(220,38,38,0.25)", maxHeight: "94vh" }}>
                  <div className="px-4 py-3" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white text-sm">{currentUserTeamType === "Team Services" ? "🔧 Update Services" : "➕ Update Status"}</h3>
                        <p className="text-red-200 text-[10px]">Handler: {newActivity.handler_name}</p>
                      </div>
                      <button onClick={() => setShowUpdateForm(false)} className="text-white hover:bg-white/20 rounded-lg p-1 font-bold text-xs">✕</button>
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
                              {newActivity.new_status === s && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
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
                                    {isSelected && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
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
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-6 flex-shrink-0" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-3xl">⏳</span><div><h3 className="text-xl font-bold text-white">Ticket Approval</h3><p className="text-sm text-white/90">{pendingApprovalTickets.length} ticket menunggu persetujuan</p></div></div><button onClick={() => { setShowApprovalModal(false); setApprovalAssignees({}); setApprovalTicket(null); setApprovalAssignee(""); }} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all">✕</button></div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {pendingApprovalTickets.length === 0 ? (<div className="text-center py-12"><div className="text-5xl mb-3">✅</div><p className="text-gray-500 font-medium">Tidak ada ticket yang menunggu approval</p></div>) : pendingApprovalTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.1)", border: "2px solid rgba(245,158,11,0.3)" }}>
                    <div className="flex justify-between items-start mb-3"><div><p className="font-bold text-lg text-gray-800">🏢 {ticket.project_name}</p><p className="text-sm text-gray-600 mt-0.5">⚠️ {ticket.issue_case}</p>{ticket.description && <p className="text-xs text-gray-500 mt-1">{ticket.description}</p>}<div className="flex gap-2 mt-2 flex-wrap text-xs text-gray-500">{ticket.customer_phone && <span>👤 {ticket.customer_phone}</span>}{ticket.sales_name && <span>💼 {ticket.sales_name}</span>}{ticket.sn_unit && <span>🔢 {ticket.sn_unit}</span>}</div><p className="text-xs text-orange-700 font-semibold mt-2">Dibuat oleh: {ticket.created_by || "-"} • {ticket.date}</p></div><span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-orange-100 text-orange-800 border-orange-400 whitespace-nowrap ml-2">⏳ Waiting Approval</span></div>

                    {/* ── Referensi Project dari Reminder Schedule ── */}
                    {(() => {
                      const key = (ticket.project_name || "").trim().toLowerCase();
                      const refs = projectReminders[key];
                      if (!refs || refs.length === 0) return null;
                      return (
                        <div className="mb-3 rounded-xl p-3" style={{ background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.35)" }}>
                          <p className="text-xs font-bold text-emerald-700 mb-2">📋 Referensi Project di Reminder Schedule</p>
                          {refs.map((ref, idx) => {
                            const bastDate = ref.due_date ? new Date(ref.due_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
                            // Hitung warranty status
                            const wy = (ref as any).warranty_years as 1 | 2 | 3 | null | undefined;
                            let warrantyBadge: React.ReactNode = null;
                            if (wy && ref.due_date) {
                              const expiry = new Date(ref.due_date + "T00:00:00");
                              expiry.setFullYear(expiry.getFullYear() + wy);
                              const today = new Date(); today.setHours(0, 0, 0, 0);
                              const isIn = today <= expiry;
                              const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
                              const expiryStr = expiry.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
                              warrantyBadge = (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                                  style={isIn ? { background: "rgba(14,165,233,0.18)", color: "#0369a1" } : { background: "rgba(239,68,68,0.15)", color: "#dc2626" }}>
                                  {isIn ? "🛡️ In Warranty" : "⚠️ Out of Warranty"}
                                  <span className="opacity-70">· s/d {expiryStr} ({isIn ? `sisa ${diffDays}h` : `lewat ${Math.abs(diffDays)}h`})</span>
                                </span>
                              );
                            }
                            return (
                              <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(16,185,129,0.15)", color: "#065f46" }}>
                                  {ref.category === "Konfigurasi & Training" ? "📌" : "⚙️"} {ref.category}
                                </span>
                                <span className="text-gray-600">🗓️ BAST: <strong className="text-emerald-800">{bastDate}</strong></span>
                                {ref.assign_name && ref.assign_name !== "-" && (
                                  <span className="text-gray-600">👷 Handler: <strong className="text-emerald-800">{ref.assign_name}</strong></span>
                                )}
                                {warrantyBadge && <div className="w-full mt-0.5">{warrantyBadge}</div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(245,158,11,0.3)" }}>
                      <label className="block text-sm font-bold text-gray-700 mb-2">👨‍💼 Assign ke Team PTS IVP:</label>
                      {/* Suggested handler dari referensi project */}
                      {(() => {
                        const key = (ticket.project_name || "").trim().toLowerCase();
                        const refs = projectReminders[key];
                        if (!refs || refs.length === 0) return null;
                        const suggested = refs.filter(r => r.assign_name && r.assign_name !== "-");
                        if (suggested.length === 0) return null;
                        // Deduplicate by assign_name
                        const unique = Array.from(new Map(suggested.map(r => [r.assign_name, r])).values());
                        return (
                          <div className="mb-2">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">💡 Saran Handler (handle project ini sebelumnya)</p>
                            <div className="flex flex-wrap gap-2">
                              {unique.map((ref, idx) => {
                                const isSelected = approvalAssignees[ticket.id] === ref.assign_name;
                                return (
                                  <button key={idx}
                                    onClick={() => setApprovalAssignees(prev => ({ ...prev, [ticket.id]: ref.assign_name }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${isSelected ? "bg-emerald-600 text-white border-emerald-600 scale-105" : "bg-emerald-50 text-emerald-800 border-emerald-400 hover:bg-emerald-100"}`}>
                                    ⭐ {ref.assign_name}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 mb-2">Atau pilih anggota lain:</p>
                          </div>
                        );
                      })()}
                      <div className="flex gap-2">
                        <select
                          className="flex-1 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                          style={{ border: "2px solid rgba(245,158,11,0.3)", background: "white" }}
                          value={approvalAssignees[ticket.id] ?? ""}
                          onChange={(e) => setApprovalAssignees(prev => ({ ...prev, [ticket.id]: e.target.value }))}>
                          <option value="">Pilih handler / Supervisor</option>
                          <optgroup label="👷 Assign langsung ke Team PTS">
                            {teamPTSMembers.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}
                          </optgroup>
                          {supervisorMembers.length > 0 && (
                            <optgroup label="🎯 Route ke Supervisor">
                              {supervisorMembers.map((m) => (<option key={`sup-${m.id}`} value={`SUP::${m.id}::${m.name}`}>{m.name} (Supervisor)</option>))}
                            </optgroup>
                          )}
                        </select>
                        {/* Ticket & handler baris INI dikirim eksplisit — bukan lewat state
                            bersama — supaya yang diproses tidak mungkin tertukar dengan
                            baris lain di modal yang sama. */}
                        <button onClick={async () => {
                          const pilihan = approvalAssignees[ticket.id];
                          if (!pilihan) { notify("error", "Pilih handler atau Supervisor terlebih dahulu!"); return; }
                          await approveTicket(ticket, pilihan);
                        }} disabled={uploading || !approvalAssignees[ticket.id]} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                          {approvingId === ticket.id ? "⏳ Memproses..." : "✅ Approve"}
                        </button>
                        <button onClick={() => rejectTicket(ticket)} disabled={uploading} className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-40 text-sm">❌ Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── SERVICES APPROVAL MODAL (Redesigned) ── */}
        {/* Z.overlayTop — dibuka DARI DALAM popup detail (Z.overlay), jadi
            harus selapis di atasnya. Sebelumnya selevel dan hanya tampil di
            depan karena kebetulan letaknya lebih bawah di berkas ini; sekali
            urutan blok ini bergeser ke atas popup detail, ia langsung hilang
            ke belakang. */}
        {showServicesApprovalModal && currentUserTeamType === "Team Services" && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(219,39,119,0.5)" }}>
              <div className="p-6 flex-shrink-0" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>
                <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-3xl">🔧</span><div><h3 className="text-xl font-bold text-white">Ticket Masuk — Team Services</h3><p className="text-sm text-white/90">{pendingServicesApprovalTickets.length} ticket menunggu konfirmasi</p></div></div><button onClick={() => setShowServicesApprovalModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all">✕</button></div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {pendingServicesApprovalTickets.length === 0 ? (<div className="text-center py-12"><div className="text-5xl mb-3">✅</div><p className="text-gray-500 font-medium">Tidak ada ticket yang menunggu konfirmasi</p></div>) : pendingServicesApprovalTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl p-4" style={{ background: "rgba(219,39,119,0.1)", border: "2px solid rgba(219,39,119,0.3)" }}>
                    <div className="flex justify-between items-start mb-3"><div className="flex-1"><p className="font-bold text-lg text-gray-800">🏢 {ticket.project_name}</p><p className="text-sm text-gray-600 mt-0.5">⚠️ {ticket.issue_case}</p>{ticket.description && <p className="text-xs text-gray-500 mt-1">{ticket.description}</p>}<div className="flex gap-3 mt-2 flex-wrap text-xs text-gray-500">{ticket.customer_phone && <span>👤 {ticket.customer_phone}</span>}{ticket.sales_name && <span>💼 {ticket.sales_name}</span>}{ticket.sn_unit && <span>🔢 SN: {ticket.sn_unit}</span>}{ticket.address && <span>📍 {ticket.address}</span>}</div><p className="text-xs text-rose-700 font-semibold mt-2">Dikirim oleh Team PTS IVP • {ticket.date}</p></div><span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-rose-100 text-rose-800 border-rose-400 whitespace-nowrap ml-3">⏳ Menunggu Konfirmasi</span></div>
                    <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(219,39,119,0.3)" }}><p className="text-xs text-gray-600 mb-3 rounded-lg px-3 py-2" style={{ background: "rgba(219,39,119,0.05)", border: "1px solid rgba(219,39,119,0.2)" }}>💡 Terima ticket untuk mulai proses penanganan, atau tolak untuk mengembalikan ke Team PTS IVP.</p><div className="flex gap-2"><button onClick={() => approveServicesTicket(ticket)} disabled={uploading} className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">✅ Terima & Mulai Proses</button><button onClick={() => rejectServicesTicket(ticket)} disabled={uploading} className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2.5 rounded-lg font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-40 text-sm">❌ Tolak (Kembalikan ke PTS)</button></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── REMINDER SCHEDULE MODAL (Redesigned) ── */}
        {showReminderSchedule && canManageTickets && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(124,58,237,0.5)" }}>
              <div className="flex items-center justify-between mb-5"><div className="flex items-center gap-3"><span className="text-3xl">⏰</span><div><h3 className="text-lg font-bold text-gray-800">Jadwal WA Reminder</h3><p className="text-xs text-gray-500">Kirim reminder otomatis ke semua handler</p></div></div><button onClick={() => setShowReminderSchedule(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button></div>
              <div className="flex items-center justify-between rounded-xl p-3 mb-4" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}><div><p className="text-sm font-bold text-violet-800">Status Reminder</p><p className="text-xs text-violet-600">{reminderSchedule.active ? "Aktif — akan kirim WA otomatis" : "Nonaktif — tidak ada WA dikirim"}</p></div><button onClick={() => setReminderSchedule((prev) => ({ ...prev, active: !prev.active }))} className={`relative w-12 h-6 rounded-full transition-colors ${reminderSchedule.active ? "bg-violet-600" : "bg-gray-300"}`}><span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${reminderSchedule.active ? "translate-x-6" : "translate-x-0.5"}`} /></button></div>
              <div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-2">🕐 Jam Pengiriman (WIB)</label><div className="flex items-center gap-2"><select value={reminderSchedule.hour_wib} onChange={(e) => setReminderSchedule((prev) => ({ ...prev, hour_wib: e.target.value }))} className="flex-1 rounded-lg px-3 py-2.5 font-bold text-center text-lg focus:ring-2 focus:ring-violet-500" style={{ border: "2px solid rgba(124,58,237,0.3)", background: "white" }}>{Array.from({ length: 24 }, (_, i) => (<option key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</option>))}</select><span className="text-gray-500 font-semibold">:</span><select value={reminderSchedule.minute} onChange={(e) => setReminderSchedule((prev) => ({ ...prev, minute: e.target.value }))} className="w-24 rounded-lg px-3 py-2.5 font-bold text-center text-lg focus:ring-2 focus:ring-violet-500" style={{ border: "2px solid rgba(124,58,237,0.3)", background: "white" }}>{["00", "15", "30", "45"].map((m) => (<option key={m} value={m}>{m}</option>))}</select><span className="text-sm font-bold text-gray-600">WIB</span></div><div className="flex gap-2 mt-2 flex-wrap">{[{ label: "07:00", h: "7", m: "0" }, { label: "08:00", h: "8", m: "0" }, { label: "09:00", h: "9", m: "0" }, { label: "13:00", h: "13", m: "0" }].map((t) => (<button key={t.label} onClick={() => setReminderSchedule((prev) => ({ ...prev, hour_wib: t.h, minute: t.m }))} className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.hour_wib === t.h && reminderSchedule.minute === t.m ? "bg-violet-600 text-white border-violet-600" : "bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100"}`}>{t.label}</button>))}</div></div>
              <div className="mb-5"><label className="block text-sm font-bold text-gray-700 mb-2">📅 Frekuensi</label><div className="grid grid-cols-3 gap-2"><button onClick={() => setReminderSchedule((prev) => ({ ...prev, frequency: "daily" }))} className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.frequency === "daily" ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"}`}>📆 Setiap Hari</button><button onClick={() => setReminderSchedule((prev) => ({ ...prev, frequency: "weekdays" }))} className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.frequency === "weekdays" ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"}`}>💼 Senin–Jumat</button><button onClick={() => setReminderSchedule((prev) => ({ ...prev, frequency: "custom" }))} className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.frequency === "custom" ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"}`}>✏️ Pilih Hari</button></div>{reminderSchedule.frequency === "custom" && (<div className="mt-3 flex gap-1.5 flex-wrap">{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day, idx) => (<button key={idx} onClick={() => { const days = reminderSchedule.custom_days.includes(idx) ? reminderSchedule.custom_days.filter((d) => d !== idx) : [...reminderSchedule.custom_days, idx].sort(); setReminderSchedule((prev) => ({ ...prev, custom_days: days })); }} className={`w-10 h-10 rounded-full text-xs font-bold border-2 transition-all ${reminderSchedule.custom_days.includes(idx) ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-300 hover:border-violet-400"}`}>{day}</button>))}</div>)}</div>
              <div className="rounded-xl p-3 mb-5" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}><p className="text-xs text-gray-500 mb-1">Preview jadwal:</p><p className="text-sm font-bold text-gray-800">📬 {getCronDisplay()}</p><p className="text-xs text-gray-400 mt-1">Reminder dikirim ke WA semua handler dengan ticket Pending/In Progress</p></div>
              <div className="grid grid-cols-2 gap-3"><button onClick={saveCronSchedule} disabled={reminderSaving} className="bg-gradient-to-r from-violet-600 to-violet-800 text-white py-3 rounded-xl font-bold hover:from-violet-700 hover:to-violet-900 transition-all disabled:opacity-50">{reminderSaving ? "⏳ Menyimpan..." : "💾 Simpan"}</button><button onClick={() => setShowReminderSchedule(false)} className="bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">✕ Batal</button></div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── ACCOUNT SETTINGS MODAL (Redesigned) ── */}
        {showAccountSettings && canAccessAccountSettings && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-5xl w-full max-h-full overflow-y-auto p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(75,85,99,0.3)" }}>
              <div className="flex justify-between items-center mb-6 sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-gray-100"><h2 className="text-2xl font-bold text-gray-800">⚙️ Account Management</h2><button onClick={() => setShowAccountSettings(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-blue-900">➕ Create New Account</h3><div className="space-y-3"><input type="text" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="text" placeholder="Full Name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="admin">Administrator</option><option value="team">Team</option><option value="guest">Guest</option></select>{newUser.role === "team" && (<select value={newUser.team_type} onChange={(e) => setNewUser({ ...newUser, team_type: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="Team PTS IVP">Team PTS IVP</option><option value="Team Services">Team Services</option></select>)}<button onClick={createUser} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-900 font-bold transition-all">➕ Create Account</button></div></div>
                <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-orange-900">🔒 Change Password</h3><div className="space-y-3"><select value={selectedUserForPassword} onChange={(e) => { setSelectedUserForPassword(e.target.value); setChangePassword({ current: "", new: "", confirm: "" }); }} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="">Select User</option>{users.map((u) => (<option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>))}</select>{selectedUserForPassword && (<><input type="password" placeholder="Old Password" value={changePassword.current} onChange={(e) => setChangePassword({ ...changePassword, current: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="password" placeholder="New Password" value={changePassword.new} onChange={(e) => setChangePassword({ ...changePassword, new: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="password" placeholder="Confirm Password" value={changePassword.confirm} onChange={(e) => setChangePassword({ ...changePassword, confirm: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><button onClick={updatePassword} className="w-full bg-gradient-to-r from-orange-600 to-orange-800 text-white py-3 rounded-xl hover:from-orange-700 hover:to-orange-900 font-bold transition-all">🔒 Change Password</button></>)}</div></div>
              </div>
              <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-gray-800">👥 User List</h3><div className="max-h-[400px] overflow-y-auto"><div className="space-y-2">{users.map((u) => (<div key={u.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex justify-between items-center"><div><p className="font-bold text-sm">{u.full_name}</p><p className="text-xs text-gray-600">{u.username}</p></div><div className="flex gap-2"><span className={`text-xs px-2 py-1 rounded ${u.role === "admin" ? "bg-red-100 text-red-800" : u.role === "team" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}>{u.role === "admin" ? "Admin" : u.role === "team" ? "Team" : "Guest"}</span>{u.team_type && <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">{u.team_type}</span>}</div></div>))}</div></div></div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── GUEST MAPPING MODAL (Redesigned) ── */}

        {/* ── NEW TICKET MODAL  ── */}
        {/* ── ADMIN: EDIT DETAIL & RE-ROUTE ── */}
        {/* Z.overlayTop — dibuka DARI DALAM popup detail (Z.overlay). */}
        {adminEditTicket && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
            onClick={e => { if (e.target === e.currentTarget && !adminEditSaving) setAdminEditTicket(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden"
              style={{ animation: 'scale-in 0.25s ease-out' }}>
              <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white">🛠️ Edit Detail &amp; Re-route</h3>
                  <p className="text-indigo-100/90 text-xs mt-0.5 truncate">{adminEditTicket.project_name}</p>
                </div>
                <button onClick={() => setAdminEditTicket(null)} disabled={adminEditSaving}
                  className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg disabled:opacity-40">✕</button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                {/* ── Re-route ── */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-2">🔀 Alihkan Pekerjaan</p>
                  {bolehReroute(adminEditTicket) ? (
                    <>
                      <select value={adminRerouteTo} onChange={e => setAdminRerouteTo(e.target.value)}
                        className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-200">
                        <option value="">— Biarkan seperti sekarang —</option>
                        <option value="SELF">🙋 Saya kerjakan sendiri</option>
                        {supervisorMembers.length > 0 && (
                          <optgroup label="🎯 Route ke Supervisor">
                            {supervisorMembers.map(m => <option key={`ar-sup-${m.id}`} value={`SUP::${m.id}::${m.name}`}>{m.name} (Supervisor)</option>)}
                          </optgroup>
                        )}
                        {teamPTSMembers.length > 0 && (
                          <optgroup label="👥 Assign langsung ke Tim">
                            {teamPTSMembers.map(m => <option key={`ar-tm-${m.id}`} value={m.name}>{m.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <p className="text-[11px] text-amber-700 mt-1.5">
                        Sekarang ditangani: <strong>{adminEditTicket.assign_name || (adminEditTicket.routing_status === 'supervisor_assign' ? 'menunggu assign Supervisor' : '—')}</strong>.
                        Yang dipilih akan langsung dikabari lewat WA.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-amber-800">
                      Pengalihan tidak tersedia — status ticket sudah <strong>{adminEditTicket.status}</strong>,
                      artinya pengerjaannya sudah berjalan. Detail di bawah tetap bisa dibetulkan.
                    </p>
                  )}
                </div>

                {/* ── Edit detail ── */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">✏️ Detail Ticket</p>
                  <AdminEditFields fields={TICKET_ADMIN_FIELDS} value={adminEditForm} disabled={adminEditSaving}
                    onChange={(k, v) => setAdminEditForm(prev => ({ ...prev, [k]: v }))} />
                </div>

                <p className="text-[11px] text-slate-400">
                  Setiap perubahan tercatat di Audit Trail lengkap dengan nilai sebelum dan sesudahnya,
                  dan diberitahukan ke yang menangani lewat WA.
                </p>
              </div>

              <div className="px-6 py-4 flex gap-3 flex-shrink-0 border-t border-slate-100">
                <button onClick={() => setAdminEditTicket(null)} disabled={adminEditSaving}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                  Batal
                </button>
                <button onClick={simpanAdminEdit} disabled={adminEditSaving}
                  className="flex-[2] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                  {adminEditSaving
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                    : <>💾 Simpan Perubahan</>}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── SUPERVISOR ASSIGN TICKET MODAL ── */}
        {supAssignTicket && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1200] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setSupAssignTicket(null); setSupAssignTo(""); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.4)" }}>
              <div className="px-6 py-5 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div>
                  <h3 className="text-lg font-bold text-white">🎯 Assign ke Tim</h3>
                  <p className="text-amber-100/90 text-xs mt-0.5 truncate max-w-[280px]">{supAssignTicket.project_name}</p>
                </div>
                <button onClick={() => { setSupAssignTicket(null); setSupAssignTo(""); }} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl p-3 text-xs text-slate-600" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
                  ⚠️ {supAssignTicket.issue_case} · {supAssignTicket.sales_name || "-"}{supAssignTicket.sales_division ? ` (${supAssignTicket.sales_division})` : ""}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase text-slate-400">Assign ke *</label>
                  <select value={supAssignTo} onChange={e => setSupAssignTo(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none text-slate-800 focus:ring-2 focus:ring-amber-500/40"
                    style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.12)" }}>
                    <option value="">-- Pilih --</option>
                    <option value="SELF">🙋 Saya kerjakan sendiri</option>
                    <optgroup label="Anggota Tim">
                      {teamPTSMembers.filter(m => m.name !== currentUser?.full_name).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setSupAssignTicket(null); setSupAssignTo(""); }} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "#f8fafc", color: "#64748b", border: "1px solid rgba(0,0,0,0.12)" }}>Batal</button>
                  <button onClick={handleSupervisorAssignTicket} disabled={supAssignSaving || !supAssignTo}
                    className="flex-[2] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                    {supAssignSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</> : <>🎯 Assign</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
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
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="flex items-center gap-3 mb-4"><span className="text-3xl">⏰</span><div><h3 className="text-lg font-bold text-gray-800">Overdue Setting</h3><p className="text-xs text-gray-500 font-medium">{overdueTargetTicket.project_name}</p><p className="text-xs text-gray-400">{overdueTargetTicket.issue_case}</p></div></div>
              <p className="text-xs text-orange-700 rounded-lg p-2 mb-4" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>⚠️ Setting ini hanya terlihat oleh admin Anda. Handler akan mendapat notifikasi merah ketika ticket overdue. Default otomatis: ticket overdue setelah 48 jam jika tidak di-set manual.</p>
              <div className="space-y-4"><div><label className="block text-sm font-bold mb-1 text-gray-700">⏱️ Overdue Setelah Berapa Jam?</label><div className="flex items-center gap-3"><input type="number" min="1" value={overdueForm.due_hours} onChange={(e) => setOverdueForm({ due_hours: e.target.value })} className="flex-1 rounded-lg px-3 py-2.5 text-lg font-bold text-center focus:ring-2 focus:ring-orange-500" style={{ border: "2px solid rgba(245,158,11,0.3)", background: "white" }} /><span className="text-gray-600 font-semibold text-sm">jam</span></div><div className="flex gap-2 mt-2">{[24, 48, 72, 96].map((h) => (<button key={h} type="button" onClick={() => setOverdueForm({ due_hours: String(h) })} className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${overdueForm.due_hours === String(h) ? "bg-orange-500 text-white border-orange-500" : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"}`}>{h}j{h === 48 ? " (default)" : ""}</button>))}</div><p className="text-xs text-gray-400 mt-2">⏰ Dihitung dari waktu ticket pertama kali dibuat</p></div><div className="grid grid-cols-2 gap-3 pt-2"><button onClick={saveOverdueSetting} className="bg-gradient-to-r from-orange-500 to-orange-700 text-white py-2.5 rounded-xl font-bold hover:from-orange-600 hover:to-orange-800 transition-all">💾 Simpan</button><button onClick={() => { setShowOverdueSetting(false); setOverdueTargetTicket(null); setOverdueForm({ due_hours: "48" }); }} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">✕ Batal</button></div>{getOverdueSetting(overdueTargetTicket.id) && (<button onClick={() => { deleteOverdueSetting(overdueTargetTicket.id); setShowOverdueSetting(false); setOverdueTargetTicket(null); }} className="w-full bg-red-100 text-red-700 py-2 rounded-xl font-bold hover:bg-red-200 transition-all text-sm border border-red-300">🗑️ Hapus Setting Overdue</button>)}</div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── RE-OPEN TICKET MODAL (Redesigned) ── */}
        {/* Z.overlayTop — bisa dibuka dari daftar MAUPUN dari dalam popup
            detail (Z.overlay), jadi harus selapis di atasnya. */}
        {showReopenModal && reopenTargetTicket && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="flex items-center gap-3 mb-5"><span className="text-3xl">🔓</span><div><h3 className="text-lg font-bold text-gray-800">Re-open Ticket</h3><p className="text-xs text-gray-500">{reopenTargetTicket.project_name} · {reopenTargetTicket.issue_case}</p></div></div>
              <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#b45309" }}>⚠️ Status akan berubah ke <strong>Pending</strong> dan activity log baru ditambahkan otomatis.</div>
              <div className="space-y-4"><div><label className="block text-sm font-bold mb-1 text-gray-700">Assign ke Handler *</label><select value={reopenAssignee} onChange={(e) => setReopenAssignee(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="">— Pilih Handler —</option>{teamPTSMembers.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}</select></div><div><label className="block text-sm font-bold mb-1 text-gray-700">Alasan (opsional)</label><textarea value={reopenNotes} onChange={(e) => setReopenNotes(e.target.value)} placeholder="Masalah muncul kembali..." rows={3} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40 resize-none" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /></div><div className="grid grid-cols-2 gap-3"><button onClick={reopenTicket} disabled={uploading || !reopenAssignee} className="bg-gradient-to-r from-amber-500 to-amber-700 text-white py-2.5 rounded-xl font-bold hover:from-amber-600 hover:to-amber-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{uploading ? "⏳..." : "🔓 Re-open"}</button><button onClick={() => { setShowReopenModal(false); setReopenTargetTicket(null); setReopenAssignee(""); setReopenNotes(""); }} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">Batal</button></div></div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── ACTIVITY SUMMARY MODAL (Redesigned) ── */}
        {showActivitySummary && summaryTicket && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-2">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full h-[96vh] flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(59,130,246,0.5)" }}>
              <div className="p-5 border-b flex-shrink-0" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderColor: "rgba(0,0,0,0.1)" }}>
                <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-2xl">🔄</span><div><h3 className="text-lg font-bold text-white">Activity Summary</h3><p className="text-sm text-blue-100 font-medium">{summaryTicket.project_name}</p><p className="text-xs text-blue-200">{summaryTicket.issue_case}</p></div></div><button onClick={() => { setShowActivitySummary(false); setSummaryTicket(null); }} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all text-lg">✕</button></div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-4">
                  {/* Baris pembuatan diturunkan dari ticket-nya sendiri: logAudit
                      baru mencatat 'create' sejak perbaikan terakhir, jadi tanpa
                      ini seluruh ticket LAMA tampak tidak punya pangkal — padahal
                      created_by & created_at-nya tersimpan sejak awal. */}
                  {(() => {
                    const pembuat = users.find(u => u.username === summaryTicket.created_by);
                    const namaPembuat = pembuat?.full_name || summaryTicket.created_by || null;
                    const atasNama = summaryTicket.sales_name || "";
                    return (
                      <AuditTrailPanel targetId={summaryTicket.id} modul="ticket"
                        awal={{
                          oleh: namaPembuat,
                          waktu: summaryTicket.created_at ?? null,
                          keterangan: `Ticket dibuat · ${summaryTicket.issue_case}`
                            + (atasNama && namaPembuat && atasNama !== namaPembuat ? ` · atas nama Sales ${atasNama}` : ''),
                        }} />
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-xl text-xs" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <span className="flex items-center gap-1"><span className="text-gray-500">👤 Handler:</span><span className="font-bold">{summaryTicket.assign_name || "-"}</span></span><span className="text-gray-300">|</span>
                  <span className="flex items-center gap-1"><span className="text-gray-500">📅 Dibuat:</span><span className="font-bold">{summaryTicket.created_at ? formatDateTime(summaryTicket.created_at) : "-"}</span></span><span className="text-gray-300">|</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold border ${statusColors[summaryTicket.status]}`}>{summaryTicket.status}</span>
                  {summaryTicket.services_status && (<><span className="text-gray-300">|</span><span className={`px-2 py-0.5 rounded-full font-bold border ${statusColors[summaryTicket.services_status]}`}>Svc: {summaryTicket.services_status}</span></>)}
                  {/* Warranty badge */}
                  {(() => {
                    const w = getWarrantyInfo(summaryTicket.project_name);
                    if (!w) return null;
                    return (<>
                      <span className="text-gray-300">|</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px]"
                        style={w.isIn
                          ? { background: "rgba(14,165,233,0.15)", color: "#0369a1", border: "1px solid rgba(14,165,233,0.3)" }
                          : { background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.3)" }}>
                        {w.isIn ? "🛡️" : "⚠️"} {w.isIn ? "In Warranty" : "Out of Warranty"}
                        <span className="opacity-70 ml-0.5">· {w.wy}Y · {w.isIn ? `sisa ${w.diffDays}h` : `lewat ${Math.abs(w.diffDays)}h`}</span>
                      </span>
                    </>);
                  })()}
                </div>
                {!summaryTicket.activity_logs || summaryTicket.activity_logs.length === 0 ? (<div className="text-center py-10 text-gray-400"><div className="text-5xl mb-3">📭</div><p className="font-semibold">Belum ada activity yang tercatat</p></div>) : (
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-1"><div className="flex flex-col items-center"><div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-base shadow-md">🎫</div></div><div className="flex-1 rounded-xl px-4 py-2" style={{ background: "rgba(59,130,246,0.1)", border: "2px solid rgba(59,130,246,0.3)" }}><p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Ticket Dibuat</p><p className="text-sm font-semibold text-gray-800">{summaryTicket.project_name}</p><p className="text-xs text-gray-500">{summaryTicket.created_at ? formatDateTime(summaryTicket.created_at) : "-"}</p></div></div>
                    {[...summaryTicket.activity_logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((log, idx, arr) => {
                      const isLast = idx === arr.length - 1;
                      const isSolved = log.new_status === "Solved";
                      const isServices = log.assigned_to_services;
                      const nodeColor = isSolved ? "bg-green-500" : isServices ? "bg-red-500" : log.new_status === "In Progress" ? "bg-blue-500" : "bg-yellow-500";
                      const cardBorder = isSolved ? "border-green-300 bg-green-50" : isServices ? "border-red-300 bg-red-50" : log.new_status === "In Progress" ? "border-blue-300 bg-blue-50" : "border-yellow-300 bg-yellow-50";
                      return (
                        <div key={log.id}>
                          <div className="flex items-stretch gap-3"><div className="flex flex-col items-center"><div className="w-0.5 bg-gray-300 flex-1 mx-auto" style={{ minHeight: "16px" }}></div></div><div className="flex-1" /></div>
                          <div className="flex items-start gap-3"><div className="flex flex-col items-center flex-shrink-0"><div className={`w-9 h-9 rounded-full ${nodeColor} flex items-center justify-center text-white text-xs font-bold shadow-md`}>{isSolved ? "✅" : isServices ? "🔄" : idx + 1}</div>{!isLast && <div className="w-0.5 bg-gray-300 flex-1" style={{ minHeight: "12px" }}></div>}</div><div className={`flex-1 border-2 rounded-xl px-4 py-3 mb-1 ${cardBorder}`}><div className="flex justify-between items-start mb-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-bold text-gray-800">{log.handler_name}</span><span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">{log.team_type}</span></div><span className={`text-xs px-2 py-0.5 rounded-full font-bold border flex-shrink-0 ml-2 ${statusColors[log.new_status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>{log.new_status}</span></div><p className="text-xs text-gray-500 mb-2">{formatDateTime(log.created_at)}</p>{log.action_taken && (<div className="rounded-lg px-3 py-1.5 mb-2" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}><p className="text-xs font-bold text-blue-700">🔧 Action:</p><p className="text-xs text-gray-800">{log.action_taken}</p></div>)}<div className="rounded-lg px-3 py-1.5" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}><p className="text-xs font-bold text-gray-600">📝 Notes:</p><p className="text-xs text-gray-800 whitespace-pre-line">{log.notes}</p></div>{isServices && <div className="mt-2 flex items-center gap-1 text-xs font-bold text-red-700 rounded-lg px-2 py-1" style={{ background: "rgba(220,38,38,0.1)" }}><span>🔄</span> Diteruskan ke Team Services</div>}{log.photo_url && <div className="mt-2"><img src={log.photo_url} alt="bukti" loading="lazy" decoding="async" className="max-h-28 rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(log.photo_url!, "_blank")} /></div>}{log.file_url && <a href={log.file_url} download={log.file_name} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 rounded-lg px-2 py-1 hover:bg-blue-200 transition-colors" style={{ background: "rgba(59,130,246,0.1)" }}>📎 {log.file_name || "Download Report"}</a>}</div></div>
                        </div>
                      );
                    })}
                    <div className="flex items-stretch gap-3"><div className="flex flex-col items-center"><div className="w-0.5 bg-gray-300 mx-auto" style={{ minHeight: "16px" }}></div></div><div className="flex-1" /></div>
                    <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-base shadow-md flex-shrink-0 ${summaryTicket.status === "Solved" ? "bg-green-600" : "bg-gray-400"}`}>{summaryTicket.status === "Solved" ? "🏁" : "⏳"}</div><div className={`flex-1 rounded-xl px-4 py-2 border-2 ${summaryTicket.status === "Solved" ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-300"}`}><p className={`text-xs font-bold uppercase tracking-wide ${summaryTicket.status === "Solved" ? "text-green-700" : "text-gray-500"}`}>{summaryTicket.status === "Solved" ? "✅ Ticket Selesai" : `⏳ Status: ${summaryTicket.status}`}</p><p className="text-xs text-gray-500 mt-0.5">{summaryTicket.activity_logs?.length || 0} aktivitas tercatat</p></div></div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t flex-shrink-0" style={{ background: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.08)" }}><button onClick={() => { setShowActivitySummary(false); setSummaryTicket(null); }} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-900 transition-all">✕ Tutup</button></div>
            </div>
          </div>
        </ModalPortal>
        )}
        {/* ── REJECT TICKET MODAL — Soft reject dengan alasan ── */}
        {showRejectModal && rejectTargetTicket && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(220,38,38,0.4)" }}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl">❌</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Tolak Ticket</h3>
                  <p className="text-xs text-gray-500 font-medium">{rejectTargetTicket.project_name}</p>
                  <p className="text-xs text-gray-400">{rejectTargetTicket.issue_case}</p>
                </div>
              </div>
              <div className="rounded-xl p-3 mb-4 mt-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e" }}>
                💡 Ticket <strong>tidak dihapus</strong> — tetap tersimpan dengan status "Rejected". Sales dapat melihat alasan penolakan dan mengajukan ulang jika diperlukan.
              </div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#64748b" }}>Alasan Penolakan *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Contoh: Data tidak lengkap, harap isi nomor SN unit dan deskripsi masalah lebih detail..."
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-red-400"
                style={{ border: "1.5px solid rgba(220,38,38,0.3)", background: "rgba(255,255,255,0.95)" }}
                autoFocus
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setShowRejectModal(false); setRejectTargetTicket(null); setRejectReason(""); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: "rgba(0,0,0,0.06)", color: "#475569" }}>
                  Batal
                </button>
                <button onClick={confirmReject} disabled={uploading || !rejectReason.trim()}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
                  {uploading ? "⏳ Menyimpan..." : "❌ Tolak Ticket"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
        )}

        {/* ── DELETE TICKET MODAL (Admin Only) ── */}
        {showDeleteModal && deleteTargetTicket && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(220,38,38,0.5)" }}>
              <div className="flex items-center gap-3 mb-4"><span className="text-3xl">🗑️</span><div><h3 className="text-lg font-bold text-gray-800">Hapus Ticket</h3><p className="text-xs text-gray-500 font-medium">{deleteTargetTicket.project_name}</p><p className="text-xs text-gray-400">{deleteTargetTicket.issue_case}</p></div></div>
              <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c" }}>
                ⚠️ <strong>Tindakan ini tidak dapat dibatalkan.</strong> Ticket beserta seluruh activity log dan overdue setting akan dihapus permanen dari database.
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1 text-gray-700">Ketik <span className="font-mono bg-red-100 text-red-700 px-1 rounded">HAPUS</span> untuk konfirmasi</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS di sini..."
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500"
                  style={{ border: "2px solid rgba(220,38,38,0.3)", background: "white" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={deleteTicket}
                  disabled={deleteConfirmText !== "HAPUS" || uploading}
                  className="bg-gradient-to-r from-red-600 to-red-800 text-white py-2.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:from-red-700 hover:to-red-900"
                >
                  {uploading ? "⏳..." : "🗑️ Hapus Permanen"}
                </button>
                <button onClick={() => { setShowDeleteModal(false); setDeleteTargetTicket(null); setDeleteConfirmText(""); }} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">✕ Batal</button>
              </div>
            </div>
          </div>
        </ModalPortal>
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
