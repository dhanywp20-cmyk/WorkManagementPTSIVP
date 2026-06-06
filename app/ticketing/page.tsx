"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, supabaseServices } from "@/lib/supabase";
import { setSession, clearSession, getSession } from "@/lib/auth";

import {
  sendWANotif, fetchWACCTargets,
  JABATAN_TIER, JABATAN_CC_RULES,
  SERVICES_STATUSES, ServicesStatus,
  User, TeamMember, ActivityLog, Ticket, OverdueSetting,
  SALES_DIVISIONS, formatDateTime,
} from "./_components/shared";
import {
  StatusDonutCard, SalesDivisionDonutCard, HandlerDonutCard,
  ProductDonutCard, InfoLine,
} from "./_components/DonutCards";
import {
  ViewIconBtn, DeleteIconBtn,
  FlowchartIconBtn, PrintIconBtn, ApproveIconBtn, ReopenIconBtn, OverdueIconBtn,
  Toast,
} from "@/components/shared";

function TicketingSystemInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketListRef = useRef<HTMLDivElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginErr, setLoginErr] = useState("");
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [silentUpdating, setSilentUpdating] = useState(false);
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
  const [newMapping, setNewMapping] = useState({ guestUsername: "", projectName: "" });

  const getJakartaDateString = () => {
    const now = new Date();
    const jakartaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const y = jakartaDate.getFullYear();
    const m = String(jakartaDate.getMonth() + 1).padStart(2, "0");
    const d = String(jakartaDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [newTicket, setNewTicket] = useState({
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
    current_team: "Team PTS",
    photo: null as File | null,
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
  });

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    full_name: "",
    team_member: "",
    role: "team",
    team_type: "Team PTS",
  });

  const [changePassword, setChangePassword] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const statusColors: Record<string, string> = {
    "Waiting Approval": "bg-orange-50 text-orange-600 border-orange-200",
    Pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Call: "bg-sky-50 text-sky-600 border-sky-200",
    Onsite: "bg-purple-50 text-purple-600 border-purple-200",
    "In Progress": "bg-blue-50 text-blue-600 border-blue-200",
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
    try { const { data } = await supabase.from("overdue_settings").select("*"); if (data) setOverdueSettings(data); } catch (e) { console.error(e); }
  };

  const saveOverdueSetting = async () => {
    if (!overdueTargetTicket) return;
    if (!overdueForm.due_hours || parseInt(overdueForm.due_hours) < 1) { notify("error", "Isi jumlah jam overdue (minimal 1 jam)!"); return; }
    try {
      const existing = getOverdueSetting(overdueTargetTicket.id);
      const payload: any = { ticket_id: overdueTargetTicket.id, set_by: currentUser?.username || "", due_date: null, due_hours: parseInt(overdueForm.due_hours) };
      if (existing) await supabase.from("overdue_settings").update(payload).eq("id", existing.id);
      else await supabase.from("overdue_settings").insert([payload]);
      await fetchOverdueSettings();
      setShowOverdueSetting(false);
      setOverdueForm({ due_hours: "48" });
      setOverdueTargetTicket(null);
    } catch (e: any) { notify("error", "Error: " + e.message); }
  };

  const deleteOverdueSetting = async (ticketId: string) => {
    const existing = getOverdueSetting(ticketId);
    if (!existing) return;
    await supabase.from("overdue_settings").delete().eq("id", existing.id);
    await fetchOverdueSettings();
  };

  const deleteTicket = async () => {
    if (!deleteTargetTicket) return;
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Menghapus activity logs...");
      // Delete activity logs dari kedua DB
      await supabase.from("activity_logs").delete().eq("ticket_id", deleteTargetTicket.id);
      try { await supabaseServices.from("activity_logs").delete().eq("ticket_id", deleteTargetTicket.id); } catch (e) { console.warn("Services DB activity logs delete failed:", e); }
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
      if (!namesToCheck.includes((t.assign_name ?? "").toLowerCase().trim())) return false;
      const overdue = isTicketOverdue(t) && t.status !== "Solved";
      const isActive = t.status !== "Solved";
      const isServicesActive = t.services_status && t.services_status !== "Solved";
      if (member?.team_type === "Team Services") return isServicesActive || overdue;
      else return isActive || overdue;
    });
  };

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.from("users").select("*").eq("username", loginForm.username).eq("password", loginForm.password).single();
      if (error || !data) { setLoginErr("Incorrect username or password!"); return; }
      setCurrentUser(data);
      setIsLoggedIn(true);
      setLoginTime(Date.now());
      setSession(data);
    } catch (err) { setLoginErr("Login failed!"); }
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setCurrentUser(null); setLoginTime(null); setSelectedTicket(null);
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
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus").in("role", ["team", "team_pts"]).order("full_name"),
        supabase.from("users").select("id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan"),
      ]);
      // Map users ke format TeamMember agar kompatibel dengan kode existing
      if (membersData.data) {
        membersData.data = (membersData.data as any[]).map((u: any) => ({
          id: u.id,
          name: u.full_name,      // name = full_name
          username: u.username,
          photo_url: "",
          role: u.role,
          team_type: u.team_type || "Team PTS",
          phone_number: u.phone_number,
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

        const isIVP = selfDiv === "IVP";
        if (isIVP) {
          // IVP guest: lihat ticket dari semua divisi yang dia handle
          const { data: ivpDivMaps } = await supabase.from("division_ivp_mappings").select("sales_division").eq("ivp_id", resolvedUser.id);
          const handledDivisions = (ivpDivMaps ?? []).map((m: any) => m.sales_division as string);
          let ivpTickets: Ticket[] = [...ownBase];
          const addIVP = (t: Ticket) => { if (!ivpTickets.find(x => x.id === t.id)) ivpTickets.push(t); };
          if (handledDivisions.length > 0) {
            const { data: divTickets } = await supabase.from("tickets").select("*, activity_logs(*)").in("sales_division", handledDivisions).order("created_at", { ascending: false });
            (divTickets ?? []).forEach(addIVP);
          }
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
            } catch (fallbackErr) {
              console.warn("[Supervisor fallback fetch]", fallbackErr);
            }
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
        try {
          const { data: svcLogs } = await supabaseServices.from("activity_logs").select("*").order("created_at", { ascending: false });
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
        } catch (svcErr) { console.warn("Could not fetch Services DB activity logs:", svcErr); }
        setTickets(mergedTickets);
      }
      if (membersData.data) setTeamMembers(membersData.data);
      if (usersData.data) setUsers(usersData.data);
      if (!silent) { setLoading(false); setTicketsLoading(false); }
      else {
        setLoading(false);
        setLastUpdated(new Date());
        // Flash subtle indicator
        setSilentUpdating(true);
        setTimeout(() => setSilentUpdating(false), 1200);
      }
      // Fetch warranty/project reference data (fire-and-forget, non-blocking)
      fetchProjectReminders();
    } catch (err: any) {
      console.error("Error:", err);
      setLoading(false);
      if (!silent) setTicketsLoading(false);
    }
  };

  const createTicket = async () => {
    if (!newTicket.project_name || !newTicket.issue_case) { notify("error", "Project name and Issue case must be filled!"); return; }
    // admin & superadmin: ticket langsung masuk (tidak perlu approval), wajib assign handler
    const isElevated = currentUser?.role === "admin" || currentUser?.role === "superadmin";
    if (isElevated && !newTicket.assign_name) { notify("error", "Please assign to a Team PTS member!"); return; }
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Saving new ticket...");
      let photoUrl = "", photoName = "";
      if (newTicket.photo) {
        setLoadingMessage("Uploading photo...");
        try {
          const fileName = `${Date.now()}_${newTicket.photo.name}`;
          const { error } = await supabase.storage.from("ticket-photos").upload(`photos/${fileName}`, newTicket.photo);
          if (error) throw error;
          const { data } = supabase.storage.from("ticket-photos").getPublicUrl(`photos/${fileName}`);
          photoUrl = data.publicUrl;
          photoName = newTicket.photo.name;
        } catch (uploadErr: any) { throw new Error(`Failed to upload photo: ${uploadErr.message}`); }
      }
      setLoadingMessage("Saving new ticket...");
      // Ticket dari guest/team → Waiting Approval; dari admin/superadmin → langsung sesuai status pilihan
      const ticketStatus = isElevated ? newTicket.status : "Waiting Approval";
      const ticketAssignedTo = isElevated ? newTicket.assign_name : "";
      const ticketData = {
        project_name: newTicket.project_name,
        address: newTicket.address || null,
        customer_phone: newTicket.customer_phone || null,
        sales_name: currentUser?.role === "guest" ? (currentUser.full_name || newTicket.sales_name || null) : (newTicket.sales_name || null),
        sales_division: currentUser?.role === "guest" ? (currentUser.sales_division || newTicket.sales_division || null) : (newTicket.sales_division || null),
        sn_unit: newTicket.sn_unit || null,
        product: newTicket.product || null,
        issue_case: newTicket.issue_case,
        description: newTicket.description || null,
        assign_name: ticketAssignedTo,
        date: newTicket.date,
        status: ticketStatus,
        current_team: "Team PTS",
        services_status: null,
        created_by: currentUser?.username || null,
        photo_url: photoUrl || null,
        photo_name: photoName || null,
      };
      const { data: insertedTicket, error } = await supabase.from("tickets").insert([ticketData]).select("id").single();
      if (error) throw error;

      // ── Kirim WA notifikasi ke semua admin & superadmin jika butuh approval ──
      // Hanya role guest dan team yang butuh approval → trigger WA ke admin
      if (!isElevated) {
        setLoadingMessage("Mengirim notifikasi WA ke admin...");
        try {
          const { data: adminUsers } = await supabase
            .from("users")
            .select("phone_number, full_name")
            .in("role", ["admin", "superadmin"])
            .not("phone_number", "is", null)
            .neq("phone_number", "");
          if (adminUsers && adminUsers.length > 0) {
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
              (adminUsers as any[]).map((a: any) =>
                sendWANotif({ type: "reminder_wa", target: a.phone_number, message: waMsg })
              )
            );
          }
        } catch (waEx: any) {
          console.error("[WA approval] exception:", waEx?.message);
        }
        // ── CC ke atasan + IVP berdasarkan divisi user yang submit ──
        try {
          const ccDiv = ticketData.sales_division ?? currentUser?.sales_division ?? "";
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
        } catch (ccEx: any) { console.warn("[WA CC submit]", ccEx?.message); }
      }

      // ── Kirim WA ke handler jika ticket langsung di-assign (admin/superadmin create ticket) ──
      // Dipindah ke LUAR blok !isElevated agar selalu jalan saat ada ticketAssignedTo
      if (ticketAssignedTo) {
        setLoadingMessage("Mengirim notifikasi WA ke handler...");
        try {
          const eTM = teamMembers.find(m => m.name === ticketAssignedTo);
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
        } catch (waEx: any) {
          console.error("[WA assign] exception:", waEx?.message);
        }
      }

      setNewTicket({
        project_name: "", address: "", customer_phone: "", sales_name: "", sales_division: "", sn_unit: "", product: "", issue_case: "", description: "", assign_name: "", date: getJakartaDateString(), status: "Pending", current_team: "Team PTS", photo: null
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
    } catch (e) { console.warn("[fetchProjectReminders]", e); }
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

  const approveTicket = async () => {
    if (!approvalTicket || !approvalAssignee) { notify("error", "Please select a Team PTS member to assign!"); return; }
    try {
      setUploading(true);
      const { error } = await supabase.from("tickets").update({ status: "Pending", assign_name: approvalAssignee }).eq("id", approvalTicket.id);
      if (error) throw error;
      if (approvalTicket.created_by) {
        const creatorUser = users.find((u) => u.username === approvalTicket.created_by);
        if (creatorUser && creatorUser.role === "guest") {
        }
      }
      // ── WA ke handler yang di-assign ──────────────────────────────────────
      try {
        // Cari handler dari teamMembers state (sudah load dari users)
        const tm = teamMembers.find(m => m.name === approvalAssignee);
        const { data: handlerUser } = tm?.username ? await supabase
          .from("users").select("phone_number, full_name")
          .eq("username", tm.username).maybeSingle() : { data: null };
        if (handlerUser?.phone_number) {
          const waMsg = [
            "🎫 *Ticket Assigned ke Kamu*",
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            `Halo *${handlerUser?.full_name || "Handler"}*, ada ticket untukmu:`,
            "",
            `📌 *Project :* ${approvalTicket.project_name}`,
            `⚠️ *Issue   :* ${approvalTicket.issue_case}`,
            `📅 *Tanggal :* ${approvalTicket.date || "-"}`,
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            "Mohon segera ditangani. Semangat! 💪",
            "🔗 https://team-ticketing.vercel.app/dashboard",
          ].join("\n");
          await sendWANotif({ type: "reminder_wa", target: handlerUser.phone_number, message: waMsg });
        }
      } catch (waEx: any) { console.warn("[approveTicket] WA failed:", waEx?.message); }
      // ── CC ke atasan + IVP berdasarkan divisi creator ticket ──
      try {
        const creatorUser = approvalTicket.created_by ? users.find((u) => u.username === approvalTicket.created_by) : null;
        const ccDiv = (approvalTicket as any).sales_division ?? creatorUser?.sales_division ?? "";
        if (ccDiv && ccDiv !== "IVP" && creatorUser?.id) {
          const ccTargets = await fetchWACCTargets(creatorUser.id, ccDiv);
          if (ccTargets.length > 0) {
            const ccMsg = [
              `✅ *[CC] Ticket Diapprove — Divisi ${ccDiv}*`,
              "━━━━━━━━━━━━━━━━━━",
              `📌 *Project  :* ${approvalTicket.project_name}`,
              `⚠️ *Issue    :* ${approvalTicket.issue_case}`,
              `👷 *Handler  :* ${approvalAssignee}`,
              "━━━━━━━━━━━━━━━━━━",
              `📋 *CC ke   :* ${ccTargets.map(t => t.name + (t.relation === "ivp_handler" ? " (IVP)" : "")).join(", ")}`,
              "🔗 https://team-ticketing.vercel.app/dashboard",
            ].join("\n");
            await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", target: t.phone, message: ccMsg })));
          }
        }
      } catch (ccEx: any) { console.warn("[WA CC approve]", ccEx?.message); }
      // ─────────────────────────────────────────────────────────────────────
      setShowApprovalModal(false);
      setApprovalTicket(null);
      setApprovalAssignee("");
      await fetchData();
      notify("success", `Ticket approved & assigned to ${approvalAssignee}`);
    } catch (err: any) { notify("error", "Error: " + err.message); } finally { setUploading(false); }
  };

  const rejectTicket = async (ticket: Ticket) => {
    if (!confirm(`Reject ticket "${ticket.project_name} - ${ticket.issue_case}"? Ticket will be deleted.`)) return;
    try {
      setUploading(true);
      await supabase.from("activity_logs").delete().eq("ticket_id", ticket.id);
      const { error } = await supabase.from("tickets").delete().eq("id", ticket.id);
      if (error) throw error;
      await fetchData();
      notify("success", "Ticket rejected and removed.");
    } catch (err: any) { notify("error", "Error: " + err.message); } finally { setUploading(false); }
  };

  const reopenTicket = async () => {
    if (!reopenTargetTicket || !reopenAssignee) return;
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Re-opening ticket...");
      const { error: ue } = await supabase.from("tickets").update({ status: "Pending", assign_name: reopenAssignee, current_team: "Team PTS", services_status: null }).eq("id", reopenTargetTicket.id);
      if (ue) throw ue;
      await supabase.from("activity_logs").insert([{
        ticket_id: reopenTargetTicket.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Re-open Ticket",
        notes: reopenNotes ? `Dibuka kembali: ${reopenNotes}` : `Ticket dibuka kembali oleh ${currentUser?.full_name}`,
        new_status: "Pending",
        team_type: "Team PTS",
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
      } catch (waEx: any) { console.warn("[reopenTicket] WA failed:", waEx?.message); }
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
    if (!isSimpleStatus && !isSvcSimple && !newActivity.notes) { notify("error", "Notes must be filled!"); return; }
    if (!selectedTicket) { notify("error", "No ticket selected!"); return; }
    const member = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser?.username || "").toLowerCase());
    const teamType = member?.team_type || "Team PTS";
    const isServicesTeam = teamType === "Team Services";
    const validStatusesPTS = ["Waiting Approval", "Pending", "Call", "Onsite", "In Progress", "Solved"];
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
      const uploadFileToBucket = async (file: File, folder: string, useServicesDb: boolean = false) => {
        const client = useServicesDb ? supabaseServices : supabase;
        const filePath = `${folder}/${Date.now()}_${file.name}`;
        const { error } = await client.storage.from("ticket-photos").upload(filePath, file);
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
        if (svcErr) console.warn("Services DB ticket update failed:", svcErr.message);
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
                await sendWANotif({ type: "ticket_notif", target: admin.phone_number, message: waMsg });
              }
            }
          } catch (waErr) { console.warn("WA to Services admin failed:", waErr); }

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
          } catch (svcInsertErr) { console.warn("Could not mirror ticket to Services DB:", svcInsertErr); }
        }
        const { error: updateError } = await supabase.from("tickets").update(updateData).eq("id", selectedTicket.id);
        if (updateError) throw new Error(`Failed to update ticket: ${updateError.message}`);

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
            if (reminderErr) {
              console.warn("[Auto Reminder] Gagal buat reminder otomatis:", reminderErr.message);
            } else {
              console.log("[Auto Reminder] ✅ Reminder Troubleshooting otomatis dibuat untuk:", selectedTicket.project_name);
            }
          } catch (reminderEx) {
            console.warn("[Auto Reminder] Exception:", reminderEx);
          }
        }
        // ────────────────────────────────────────────────────────────────────
      }
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
    else if (newUser.role === "admin") finalTeamType = "Team PTS";
    try {
      const { error: userError } = await supabase.from("users").insert([{ username: lowerUsername, password: newUser.password, full_name: newUser.full_name, role: newUser.role, team_type: finalTeamType }]);
      if (userError) throw userError;
      // team_members table tidak digunakan — data handler dari tabel users langsung
      setNewUser({ username: "", password: "", full_name: "", team_member: "", role: "team", team_type: "Team PTS" });
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
      const { data: userData } = await supabase.from("users").select("password").eq("id", selectedUserForPassword).single();
      if (!userData || userData.password !== changePassword.current) { notify("error", "Password lama salah!"); return; }
      await supabase.from("users").update({ password: changePassword.new }).eq("id", selectedUserForPassword);
      if (currentUser?.id === selectedUserForPassword) {
        const updatedUser = { ...currentUser, password: changePassword.new };
        setCurrentUser(updatedUser);
        setSession(updatedUser);
      }
      notify("success", "Password changed successfully!");
      setChangePassword({ current: "", new: "", confirm: "" });
      setSelectedUserForPassword("");
    } catch (err: any) { notify("error", "Error: " + err.message); }
  };

  const exportToPDF = async (ticket: Ticket) => {
    const printDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    const statusLabel = ticket.status;
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
        const teamBg = log.team_type === "Team Services" ? "#fef3c7" : "#eff6ff";
        const teamColor = log.team_type === "Team Services" ? "#92400e" : "#1d4ed8";
        const statusBg = log.new_status === "Solved" ? "#d1fae5"
          : log.new_status === "In Progress" ? "#dbeafe"
          : log.new_status === "Pending" ? "#fef3c7"
          : "#f1f5f9";
        const statusCol = log.new_status === "Solved" ? "#065f46"
          : log.new_status === "In Progress" ? "#1d4ed8"
          : log.new_status === "Pending" ? "#92400e"
          : "#475569";
        return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
          <td style="padding:10px 12px;border:1px solid #e2e8f0;width:120px;white-space:nowrap;vertical-align:top">
            <div style="font-size:11px;color:#64748b">${ts}</div>
            <div style="margin-top:3px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;display:inline-block;background:${teamBg};color:${teamColor}">${log.team_type || "PTS"}</div>
          </td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;width:130px;vertical-align:top">
            <div style="font-weight:700;font-size:12px;color:#1e293b">${log.handler_name || "-"}</div>
            <div style="margin-top:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;display:inline-block;background:${statusBg};color:${statusCol}">${log.new_status}</div>
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
  .status-pill { display: inline-block; padding: 3px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
    background: rgba(255,255,255,0.92); border: 1px solid rgba(255,255,255,0.5); color: white; margin-top: 6px; }
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
  .sign-grid { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; page-break-inside: avoid; }
  .sign-box { border-top: 1.5px solid #334155; padding-top: 8px; text-align: center; }
  .sign-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .sign-space { margin-top: 32px; font-size: 11px; color: #94a3b8; }
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
      <div class="status-pill">PTS: ${statusLabel}${ticket.services_status ? " &nbsp;|&nbsp; Svc: " + ticket.services_status : ""}</div>
    </div>
    <div class="header-right">
      <div><b>Dicetak:</b> ${printDate}</div>
      <div><b>Handler:</b> ${ticket.assign_name || "—"}</div>
      <div><b>Team:</b> ${ticket.current_team || "Team PTS"}</div>
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
        <div class="info-box"><div class="info-label">Status Team PTS</div>
          <div><span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${statusColor}22;color:${statusColor};border:1.5px solid ${statusColor}66">${ticket.status}</span></div>
        </div>
        ${ticket.services_status ? `<div class="info-box"><div class="info-label">Status Team Services</div>
          <div><span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#fef3c722;color:#92400e;border:1.5px solid #f59e0b66">${ticket.services_status}</span></div>
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
    <div>Dicetak: ${printDate} | Status: ${ticket.status}</div>
  </div>

  <!-- TANDA TANGAN -->
  <div class="sign-grid">
    ${["Handler / PTS"].map(r =>
      `<div class="sign-box"><div class="sign-label">${r}</div><div class="sign-space">Tanda Tangan</div></div>`
    ).join("")}
  </div>

</div></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(printContent); win.document.close(); setTimeout(() => win.print(), 300); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.size} ticket yang dipilih? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("tickets").delete().in("id", ids);
    if (!error) {
      setTickets(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    } else {
      notify("error", "Gagal menghapus: " + error.message);
    }
    setBulkDeleting(false);
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
    if (!currentUser) return "Team PTS";
    const member = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser.username || "").toLowerCase());
    return member?.team_type || "Team PTS";
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
        return { name, tickets, team: member?.team_type || "Team PTS" };
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

  const teamPTSMembers = useMemo(() => teamMembers.filter((m) => m.team_type === "Team PTS"), [teamMembers]);
  const teamServicesMembers = useMemo(() => teamMembers.filter((m) => m.team_type === "Team Services"), [teamMembers]);

  useEffect(() => {
    const user = getSession();
    if (user) {
      setCurrentUser(user as any);
      setIsLoggedIn(true);
      setLoginTime(Date.now());
      fetchData(user as any);
      return;
    }
    fetchData(null);
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
    if (isLoggedIn && tickets.length > 0 && currentUser?.role !== "guest") {
      const notifs = getNotifications();
      setNotifications(notifs);
      if (notifs.length > 0 && !showNotificationPopup) setShowNotificationPopup(true);
    }
  }, [tickets, isLoggedIn, currentUser]);

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
    if (!isLoggedIn) return;
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
  }, [isLoggedIn, currentUser]);

  const canCreateTicket = true;
  const canUpdateTicket = currentUser?.role !== "guest";
  const canAccessAccountSettings = currentUser?.role === "admin" || currentUser?.role === "superadmin";

  const pendingApprovalTickets = useMemo(() => {
    if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") return [];
    return tickets.filter((t) => t.status === "Waiting Approval");
  }, [tickets, currentUser]);

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
      try { await supabaseServices.from("tickets").update({ services_status: "Pending", status: "Pending" }).eq("id", ticket.id); } catch (e) { console.warn("Services DB update failed:", e); }
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

  const rejectServicesTicket = async (ticket: Ticket) => {
    if (!confirm(`Tolak ticket "${ticket.project_name} - ${ticket.issue_case}"?\nTicket akan dikembalikan ke Team PTS.`)) return;
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Mengembalikan ticket ke Team PTS...");
      await supabase.from("tickets").update({ current_team: "Team PTS", services_status: null, status: "In Progress" }).eq("id", ticket.id);
      await supabase.from("activity_logs").insert([{
        ticket_id: ticket.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Ticket Dikembalikan ke Team PTS",
        notes: `Ticket dikembalikan ke Team PTS oleh Team Services karena tidak dapat ditangani.`,
        new_status: "In Progress",
        team_type: "Team Services",
        assigned_to_services: false,
        file_url: "", file_name: "", photo_url: "", photo_name: ""
      }]);
      try {
        await supabaseServices.from("tickets").update({ services_status: "Returned to PTS", current_team: "Team PTS" }).eq("id", ticket.id);
        await supabaseServices.from("activity_logs").insert([{
          ticket_id: ticket.id,
          handler_name: currentUser?.full_name || "",
          handler_username: currentUser?.username || "",
          action_taken: "Ticket Dikembalikan ke Team PTS",
          notes: `Ticket dikembalikan ke Team PTS. History Services tetap tersimpan.`,
          new_status: "Returned to PTS",
          team_type: "Team Services",
          assigned_to_services: false,
          file_url: "", file_name: "", photo_url: "", photo_name: ""
        }]);
      } catch (e) { console.warn("Services DB update failed:", e); }
      await fetchData();
      setLoadingMessage("✅ Ticket dikembalikan ke Team PTS.");
      setTimeout(() => { setShowLoadingPopup(false); setUploading(false); setShowServicesApprovalModal(false); }, 1500);
    } catch (err: any) { setShowLoadingPopup(false); setUploading(false); notify("error", "Error: " + err.message); }
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center relative" style={{ backgroundImage: "url(/IVP_Background.png)", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} />
        <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 w-full max-w-md" style={{ border: "2px solid rgba(220,38,38,0.3)" }}>
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)", boxShadow: "0 6px 24px rgba(220,38,38,0.4)" }}>
              <span className="text-3xl">🗓️</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-800">Login</h1>
          <p className="text-center text-gray-600 font-semibold mb-6 text-sm">Ticket Troubleshooting<br/><span className="text-red-600 font-bold">IVP Product — Team Support</span></p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">Username</label>
              <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-red-600 focus:ring-4 focus:ring-red-200 transition-all font-medium bg-white" placeholder="Masukkan username" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">Password</label>
              <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-red-600 focus:ring-4 focus:ring-red-200 transition-all font-medium bg-white" placeholder="Masukkan password" onKeyDown={(e) => { if (e.key === "Enter") { setLoginErr(""); handleLogin(); } }} />
            </div>
            {loginErr && (
              <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{loginErr}</div>
            )}
            <button onClick={() => { setLoginErr(""); handleLogin(); }} className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white py-3 rounded-xl hover:from-red-700 hover:to-red-900 font-bold shadow-xl transition-all">🔐 Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{ backgroundImage: "url(/IVP_Background.png)", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(255,255,255,0.08)" }} />
      {/* Toast notifications */}
      {toast && <Toast notif={toast} />}
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">

        {/* ── LOADING POPUP (Redesigned) ── */}
        {showLoadingPopup && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110]">
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
        )}

        {/* ── UPLOAD PROGRESS BAR ── */}
        {uploading && !showLoadingPopup && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
            <div className="h-full bg-gradient-to-r from-red-500 to-red-700 animate-pulse" style={{ width: "100%", transition: "width 0.3s" }}></div>
          </div>
        )}

        {/* ── HEADER ── (Redesigned like ReminderSchedule) */}
        <header className="sticky top-0 z-50 animate-slide-down anim-d0" style={{ background: "rgba(255,255,255,0.9)", borderBottom: "3px solid #dc2626", backdropFilter: "blur(16px)" }}>
          <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)", boxShadow: "0 3px 12px rgba(220,38,38,0.4)" }}>
                <span className="text-lg">🎫</span>
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-800">Ticket Troubleshooting</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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

              {/* Approval button - Redesigned */}
              {canAccessAccountSettings && pendingApprovalTickets.length > 0 && (
                <button onClick={() => { fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true); }} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#ea580c,#c2410c)", boxShadow: "0 2px 8px rgba(234,88,12,0.35)" }}>
                  ⏳ Approval
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingApprovalTickets.length}</span>
                </button>
              )}

              {/* Services Approval button - Redesigned */}
              {currentUserTeamType === "Team Services" && pendingServicesApprovalTickets.length > 0 && (
                <button onClick={() => setShowServicesApprovalModal(true)} className="relative flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#db2777,#be185d)", boxShadow: "0 2px 8px rgba(219,39,119,0.35)" }}>
                  🔧 Ticket Masuk
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pendingServicesApprovalTickets.length}</span>
                </button>
              )}



              {/* Reminder button - Redesigned */}
              {canAccessAccountSettings && (
                <button onClick={() => { setShowReminderSchedule(true); setShowAccountSettings(false); setShowNewTicket(false); }} className="flex items-center gap-1.5 text-white text-sm font-bold px-3.5 py-2 rounded-xl transition-all hover:scale-105 hover:opacity-90" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }} title={`Reminder: ${getCronDisplay()}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Reminder</span>
                </button>
              )}

              {/* New Ticket button - Redesigned */}
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
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

          {/* ── GUEST SUMMARY SECTION (same style as admin) ── */}
          {currentUser?.role === "guest" && (
            <div className="mb-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-slide-up anim-d80">
                {[
                  { label: "Total Tickets", value: stats.total, sub: "Seluruh tiket saya", gradient: "linear-gradient(135deg,#4f46e5,#6d28d9)", shadow: "rgba(79,70,229,0.35)" },
                  { label: "Waiting Approval", value: tickets.filter((t) => t.status === "Waiting Approval").length, sub: "Menunggu persetujuan", gradient: "linear-gradient(135deg,#ea580c,#c2410c)", shadow: "rgba(234,88,12,0.35)" },
                  { label: "Pending", value: stats.pending, sub: "Menunggu tindakan", gradient: "linear-gradient(135deg,#d97706,#b45309)", shadow: "rgba(217,119,6,0.35)" },
                  { label: "In Progress", value: stats.processing, sub: "Sedang ditangani", gradient: "linear-gradient(135deg,#2563eb,#1d4ed8)", shadow: "rgba(37,99,235,0.35)" },
                  { label: "Solved", value: stats.solved, sub: "Terselesaikan", gradient: "linear-gradient(135deg,#059669,#047857)", shadow: "rgba(5,150,105,0.35)" },
                ].map((card, i) => (
                  <div key={i} className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2" style={{ background: card.gradient, boxShadow: `0 4px 16px ${card.shadow}` }}>
                    <span className="text-3xl font-black text-white leading-none mt-3">{card.value}</span>
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{card.label}</p>
                      <p className="text-[10px] font-medium leading-tight" style={{ color: "rgba(255,255,255,0.75)" }}>{card.sub}</p>
                    </div>
                  </div>
                ))}
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
                  data={stats.handlerData.filter((h: any) => h.team === `Team ${selectedHandlerTeam}`).map((h: any, i: number) => ({ name: h.name, value: h.tickets, color: ["#7c3aed","#0ea5e9","#10b981","#e11d48","#f59e0b","#6366f1"][i%6] }))}
                  total={stats.handlerData.filter((h: any) => h.team === `Team ${selectedHandlerTeam}`).reduce((s:number,h:any) => s+h.tickets, 0)}
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

          {(currentUser?.role === "admin" || currentUser?.role === "superadmin" || (currentUser?.role === "team" && currentUserTeamType === "Team PTS" || currentUserTeamType === "Guest")) && (
            <div className="mb-4 space-y-4">
              {/* ── Stat Cards (Redesigned like ReminderSchedule) ── */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 animate-slide-up anim-d80">
                {[
                  { label: "Total Tickets", value: stats.total, sub: "Seluruh tiket", gradient: "linear-gradient(135deg,#4f46e5,#6d28d9)", shadow: "rgba(79,70,229,0.35)", onClick: () => { setFilterStatus("All"); setHandlerFilter(null); }, active: filterStatus === "All" && !handlerFilter },
                  { label: "Pending", value: stats.pending, sub: "Menunggu tindakan", gradient: "linear-gradient(135deg,#d97706,#b45309)", shadow: "rgba(217,119,6,0.35)", onClick: () => { setFilterStatus(filterStatus === "Pending" ? "All" : "Pending"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Pending" },
                  { label: "In Progress", value: stats.processing, sub: "Sedang ditangani", gradient: "linear-gradient(135deg,#2563eb,#1d4ed8)", shadow: "rgba(37,99,235,0.35)", onClick: () => { setFilterStatus(filterStatus === "In Progress" ? "All" : "In Progress"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "In Progress" },
                  { label: "Solved", value: stats.solved, sub: "Terselesaikan", gradient: "linear-gradient(135deg,#059669,#047857)", shadow: "rgba(5,150,105,0.35)", onClick: () => { setFilterStatus(filterStatus === "Solved" ? "All" : "Solved"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Solved" },
                  { label: "Overdue", value: stats.overdue, sub: "Berpotensi denda", gradient: "linear-gradient(135deg,#dc2626,#b91c1c)", shadow: "rgba(220,38,38,0.35)", onClick: () => { setFilterStatus(filterStatus === "Overdue" ? "All" : "Overdue"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Overdue" },
                  { label: "Solved Overdue", value: stats.solvedOverdue, sub: "Butuh verifikasi", gradient: "linear-gradient(135deg,#7c3aed,#6d28d9)", shadow: "rgba(124,58,237,0.35)", onClick: () => { setFilterStatus(filterStatus === "Solved Overdue" ? "All" : "Solved Overdue"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Solved Overdue" },
                ].map((card, i) => (
                  <div key={i} onClick={card.onClick} className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2 cursor-pointer transition-all hover:scale-[1.03] select-none" style={{ background: card.gradient, boxShadow: card.active ? `0 6px 24px ${card.shadow}` : `0 4px 16px ${card.shadow}`, outline: card.active ? "3px solid white" : "none", transform: card.active ? "scale(1.04)" : undefined }}>
                    {card.active && <div className="absolute inset-0 rounded-2xl border-4 border-white/50 pointer-events-none" />}
                    {card.active && <span className="absolute top-1 left-2 text-white/80 text-[9px] font-bold uppercase tracking-widest">Filter Aktif ✓</span>}
                    <span className="text-3xl font-black text-white leading-none mt-3">{card.value}</span>
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{card.label}</p>
                      <p className="text-[10px] font-medium leading-tight" style={{ color: "rgba(255,255,255,0.75)" }}>{card.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Donut Charts ── */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-zoom-in anim-d160">
                <StatusDonutCard data={stats.statusData} total={stats.statusData.reduce((s, d) => s + d.value, 0)} onSliceClick={(name: string) => { const mapped = name === "Solved (Overdue)" ? "Solved Overdue" : name; setFilterStatus((prev) => prev === mapped ? "All" : mapped); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} title="Status Distribution" icon="🥧" />
                <HandlerDonutCard data={stats.handlerData.filter((h: any) => h.team === `Team ${selectedHandlerTeam}`).map((h: any, i: number) => ({ name: h.name, value: h.tickets, color: ["#7c3aed", "#0ea5e9", "#10b981", "#e11d48", "#f59e0b", "#6366f1", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"][i % 12] }))} total={stats.handlerData.filter((h: any) => h.team === `Team ${selectedHandlerTeam}`).reduce((s, h) => s + h.tickets, 0)} teamToggle={selectedHandlerTeam} onToggle={(t: "PTS" | "Services") => setSelectedHandlerTeam(t)} onSliceClick={(name: string) => { setHandlerFilter((prev: string | null) => prev === name ? null : name); setFilterStatus("All"); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} activeHandler={handlerFilter} title="Team Handlers" icon="👥" />
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
                {/* Live indicator — muncul saat ada silent update dari server */}
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 transition-opacity duration-500" style={{ opacity: silentUpdating ? 1 : 0 }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Updated
                </span>
                {lastUpdated && !silentUpdating && (
                  <span className="text-[10px] text-gray-400 hidden sm:inline">
                    {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                {canAccessAccountSettings && (
                  <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {selectMode ? '✕ Batal' : '☑ Select'}
                  </button>
                )}
                <button onClick={() => fetchData()}  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60 bg-white">
                  <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh
                </button>
                <button onClick={exportToExcel} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}>
                  {uploading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '📊'}
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">👤</span>
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
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">📦 Product</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">📦</span>
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">👥</span>
                    <select 
                      value={handlerFilter || ""} 
                      onChange={(e) => setHandlerFilter(e.target.value || null)} 
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
                    >
                      <option value="">All Handlers</option>
                      {teamMembers.filter(m => m.team_type === `Team ${selectedHandlerTeam}`).map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🏷️</span>
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Year</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">📅</span>
                    <select 
                      value={filterYear} 
                      onChange={(e) => setFilterYear(e.target.value)} 
                      className="w-full rounded-xl pl-8 pr-4 py-2 text-sm outline-none transition-all bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((year) => (<option key={year} value={year}>{year}</option>))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">▼</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk delete bar — admin only, selectMode only */}
            {selectMode && canAccessAccountSettings && selectedIds.size > 0 && (
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

            {ticketsLoading ? (
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
              <div className="text-center py-12"><div className="text-6xl mb-4">📭</div><p className="text-gray-600 font-medium">{searchProject || filterStatus !== "All" ? "No tickets match the search." : "No tickets yet. Create your first ticket!"}</p></div>
            ) : (
              <div className="overflow-x-auto">
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
                  <thead>
                    <tr className="border-b-2 border-gray-100" style={{ background: "rgba(248,248,248,0.97)" }}>
                      <th className="px-2 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">
                        {selectMode && canAccessAccountSettings
                          ? <input type="checkbox"
                              checked={selectedIds.size === filteredTickets.length && filteredTickets.length > 0}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded accent-red-600 cursor-pointer" title="Pilih Semua" />
                          : 'No'}
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">Project / Lokasi</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">Warranty</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">Product</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">SN Unit</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">Issue</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">Assigned</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">Status</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100">Sales</th>
                      <th className="px-2 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket, index) => {
                      const overdue = isTicketOverdue(ticket);
                      const overdueSetting = getOverdueSetting(ticket.id);
                      const creatorUser = users.find((u) => u.username === ticket.created_by);
                      const creatorLabel = creatorUser ? creatorUser.full_name : ticket.created_by || "-";
                      const isSolvedOverdue = overdue && ticket.status === "Solved";
                      const isActiveOverdue = overdue && ticket.status !== "Solved";
                      return (
                        <tr key={ticket.id} className={`stagger-item border-b border-gray-100 hover:bg-gray-50/70 transition-colors ${isActiveOverdue ? "bg-red-50 border-l-4 border-l-red-400" : isSolvedOverdue ? "bg-purple-50/60 border-l-4 border-l-purple-300" : ""}`}>
                          <td className="px-2 py-3 border-r border-gray-100 align-middle text-center" onClick={e => e.stopPropagation()}>
                            {selectMode && canAccessAccountSettings
                              ? <input type="checkbox" checked={selectedIds.has(ticket.id)}
                                  onChange={() => toggleSelectId(ticket.id)}
                                  className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                              : <span className="text-[11px] font-bold text-gray-400">{index + 1}</span>}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 align-middle">
                            <div className="flex items-start gap-1">
                              {isActiveOverdue && <span className="text-red-500 text-xs mt-0.5 shrink-0" title="Overdue!">🚨</span>}
                              <div className="font-bold text-gray-800 text-sm break-words leading-tight">{ticket.project_name}</div>
                            </div>
                            {ticket.address && (
                              <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-0.5">
                                <span>📍</span>
                                <span className="truncate">{ticket.address.split(',')[0]}</span>
                              </div>
                            )}
                            
                            <div className="text-[10px] text-gray-400 mt-1">{ticket.created_at ? formatDateTime(ticket.created_at) : "-"}</div>
                            {isActiveOverdue && <div className="text-xs text-red-600 font-bold mt-0.5">⏰ OVERDUE</div>}
                          </td>
                          {/* Warranty cell */}
                          <td className="px-3 py-3 border-r border-gray-100 align-middle">
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
                          <td className="px-3 py-3 border-r border-gray-100 align-middle">
                            {ticket.product && (
                              <button onClick={() => { setProductFilter(prev => prev === ticket.product ? null : (ticket.product ?? null)); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }}
                                className="mt-1 text-[12px] font-semibold px-1.5 py-0.5 rounded break-words leading-tight transition-all inline-block"
                                style={{ background: productFilter === ticket.product ? '#6366f1' : '#eef2ff', color: productFilter === ticket.product ? 'white' : '#4338ca' }}>
                                📦 {ticket.product}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-100 align-middle py-4"><div className="text-[13px] text-gray-600 break-words leading-tight">{ticket.sn_unit || "—"}</div></td>
                          <td className="px-3 py-3 border-r border-gray-100 align-middle py-4"><div className="text-[13px] text-gray-700 break-words leading-tight">{ticket.issue_case}</div></td>
                          <td className="px-3 py-3 border-r border-gray-100 align-middle py-4">
                            <div className="text-sm text-gray-700 break-words leading-tight">{ticket.assign_name}</div>
                            {/* Tampilkan team handler (dari users), bukan current_team ticket */}
                            {(() => {
                              const handler = teamMembers.find(m => m.name === ticket.assign_name);
                              const handlerTeam = handler?.team_type || "Team PTS";
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
                          <td className="px-3 py-3 border-r border-gray-100 align-middle py-4">
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
                          <td className="px-2 py-3 border-r border-gray-100 align-middle"><div className="text-xs text-gray-600 break-words leading-tight">{ticket.sales_name || "—"}</div>{ticket.sales_division && <div className="text-xs text-purple-500 font-semibold mt-0.5">{ticket.sales_division}</div>}</td>
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
                              {canAccessAccountSettings && ticket.status === "Waiting Approval" && (
                                <ApproveIconBtn onClick={() => { setApprovalTicket(ticket); setApprovalAssignee(""); fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true); }} pulse />
                              )}
                              {/* Re-open */}
                              {ticket.status === "Solved" && canUpdateTicket && (
                                <ReopenIconBtn onClick={() => { setReopenTargetTicket(ticket); setReopenAssignee(ticket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); }} />
                              )}
                              {/* Hapus — admin only */}
                              {canAccessAccountSettings && (
                                <DeleteIconBtn onClick={() => { setDeleteTargetTicket(ticket); setDeleteConfirmText(""); setShowDeleteModal(true); }} />
                              )}
                              {/* Overdue Setting — admin only */}
                              {canAccessAccountSettings && (
                                <OverdueIconBtn onClick={() => { setOverdueTargetTicket(ticket); const existing = getOverdueSetting(ticket.id); setOverdueForm({ due_hours: existing?.due_hours ? String(existing.due_hours) : "48" }); setShowOverdueSetting(true); }} active={!!overdueSetting} />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200" style={{ background: "rgba(255,255,255,0.97)" }}><span className="text-xs text-gray-400">{filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""} ditemukan</span><span className="text-xs text-gray-400">{filteredTickets.length > 0 ? `1–${filteredTickets.length}` : "0"} of {tickets.length}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* ── All modals remain the same as original (notifications, detail popup, etc.) ── */}
        {/* ... (all other modals - notification popup, ticket detail, update form, approval modals, etc. remain unchanged) ... */}

        {/* Bulk Delete Confirm Modal */}
        {bulkConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
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
        )}

        {/* ── NOTIFICATION POPUP (Redesigned) ── */}
        {showNotificationPopup && notifications.length > 0 && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-5" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3"><span className="text-3xl animate-bounce">🔔</span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3><p className="text-sm text-white/90">{notifications.length} tickets need attention</p></div></div>
                  <button onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              <div className="max-h-[calc(80vh-140px)] overflow-y-auto p-4 space-y-2">
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
              <div className="p-4 border-t" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(249,250,251,0.8)" }}><button onClick={() => setShowNotificationPopup(false)} className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white py-3 rounded-xl font-bold transition-all">✕ Tutup</button></div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS MODAL (Redesigned) ── */}
        {showNotifications && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-5" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3"><span className="text-3xl">🔔</span><div><h3 className="text-lg font-bold text-white">Ticket Notifications</h3>{notifications.length > 0 && <p className="text-sm text-white/90">{notifications.length} tickets need attention</p>}</div></div>
                  <button onClick={() => setShowNotifications(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="p-12 text-center text-gray-500"><div className="text-6xl mb-4">✅</div><p className="text-lg font-medium">No notifications</p><p className="text-sm mt-2">All tickets have been handled</p></div>
              ) : (
                <div className="max-h-[calc(80vh-120px)] overflow-y-auto p-4"><div className="space-y-3">{notifications.map((ticket) => { const overdueFlag = isTicketOverdue(ticket); return (
                  <div key={ticket.id} onClick={() => { setSelectedTicket(ticket); setShowNotifications(false); setShowTicketDetailPopup(true); }} className={`rounded-xl p-4 border-2 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all ${overdueFlag ? "bg-red-50 border-red-400" : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300"}`}>
                    <div className="flex justify-between items-start mb-3"><div className="flex-1"><div className="flex items-center gap-2 mb-2">{overdueFlag && <span className="text-red-500">🚨</span>}<p className="font-bold text-lg text-gray-800">{ticket.project_name}</p><span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-bold">{ticket.current_team}</span></div><p className="text-sm text-gray-600 mt-1">{ticket.issue_case}</p>{overdueFlag && <p className="text-xs text-red-600 font-bold mt-1">⏰ OVERDUE - Segera tangani!</p>}</div><div className="ml-3"><span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${overdueFlag ? statusColors["Overdue"] : statusColors[currentUserTeamType === "Team Services" ? ticket.services_status || "Pending" : ticket.status]}`}>{overdueFlag ? "🚨 Overdue" : (currentUserTeamType === "Team Services" ? (ticket.services_status || "Pending") : ticket.status)}</span></div></div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-300"><span className="text-xs text-gray-500">📅 {ticket.created_at ? formatDateTime(ticket.created_at) : "-"}</span><span className="text-sm text-blue-600 font-semibold">Click to view details →</span></div>
                  </div>
                )})}</div></div>
              )}
              <div className="p-4 border-t" style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(249,250,251,0.8)" }}><button onClick={() => setShowNotifications(false)} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl font-bold transition-all">Close</button></div>
            </div>
          </div>
        )}

        {/* ── TICKET DETAIL POPUP — detail kiri + update panel kanan ── */}
        {showTicketDetailPopup && selectedTicket && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-3 overflow-y-auto"
            onClick={e => { if (e.target === e.currentTarget) { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); } }}>
            <div className="flex items-start gap-3 w-full my-2" style={{ maxWidth: showUpdateForm ? '1120px' : '720px', transition: 'max-width 0.2s' }}>

              {/* LEFT: Detail */}
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden flex-1 min-w-0"
                style={{ animation: "scale-in 0.25s ease-out", border: "1px solid rgba(0,0,0,0.1)", maxHeight: "94vh" }}>
                {/* Header */}
                <div className="px-5 py-4 relative" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
                  <button onClick={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.4)', color: 'white' }}>🎫 Tim: {selectedTicket.current_team}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: selectedTicket.status === "Solved" ? "#059669" : selectedTicket.status === "In Progress" ? "#2563eb" : selectedTicket.status === "Onsite" ? "#7c3aed" : selectedTicket.status === "Call" ? "#0891b2" : "#d97706" }}>Status: {selectedTicket.status}</span>
                    {selectedTicket.services_status && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#7c3aed' }}>Svc Status: {selectedTicket.services_status}</span>}
                  </div>
                  <h2 className="text-lg font-bold text-white leading-tight">{selectedTicket.project_name}</h2>
                  {selectedTicket.address && <p className="text-white/75 text-xs mt-0.5">📍 {selectedTicket.address}</p>}
                  {selectedTicket.status === "Onsite" && (
                    <button onClick={() => { setShowTicketDetailPopup(false); setSelectedTicket(null); setShowUpdateForm(false); router.push('/reminder-schedule'); }}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                      style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.92)' }}>
                      🗓️ Lihat Jadwal Reminder
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto" style={{ maxHeight: 'calc(94vh - 130px)' }}>
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
                        <InfoLine label="Handler" value={selectedTicket.assign_name} />
                        <InfoLine label="Issue" value={selectedTicket.issue_case} />
                        {selectedTicket.product && <InfoLine label="Product" value={selectedTicket.product} />}
                        {selectedTicket.sn_unit && <InfoLine label="SN Unit" value={selectedTicket.sn_unit} />}
                        {selectedTicket.customer_phone && <InfoLine label="Customer" value={selectedTicket.customer_phone} />}
                      </div>
                      <div>
                        {selectedTicket.sales_name && <InfoLine label="Sales" value={`${selectedTicket.sales_name}${selectedTicket.sales_division ? ` (${selectedTicket.sales_division})` : ''}`} />}
                        <InfoLine label="Dibuat" value={selectedTicket.created_at ? formatDateTime(selectedTicket.created_at) : '-'} />
                        {selectedTicket.created_by && <InfoLine label="Oleh" value={`${selectedTicket.created_by}`} />}
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
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                style={w.isIn
                                  ? { background: "rgba(14,165,233,0.18)", color: "#0369a1" }
                                  : { background: "rgba(239,68,68,0.15)", color: "#dc2626" }}>
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
                      <img src={selectedTicket.photo_url} alt="foto" className="w-full max-h-36 object-cover rounded-xl border cursor-pointer hover:opacity-90" onClick={() => window.open(selectedTicket.photo_url!, "_blank")} />
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
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">{log.team_type}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${statusColors[log.new_status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>{log.new_status}</span>
                                <span className="text-[9px] text-gray-400">{formatDateTime(log.created_at)}</span>
                              </div>
                            </div>
                            {log.action_taken && <p className="text-[10px] text-blue-700 font-semibold">🔧 {log.action_taken}</p>}
                            <p className="text-xs text-gray-600">{log.notes}</p>
                            {log.photo_url && <img src={log.photo_url} alt="log" className="mt-1.5 max-h-24 rounded-lg border cursor-pointer" onClick={() => window.open(log.photo_url!, "_blank")} />}
                            {log.file_url && <a href={log.file_url} download className="inline-block mt-1 text-[10px] font-bold text-blue-600 hover:underline">📄 {log.file_name || "Download"}</a>}
                          </div>
                        ))
                        : <p className="text-xs text-gray-400 text-center py-3">Belum ada aktivitas</p>
                      }
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2 bg-gray-50/50">
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
                            const flow = ["Pending","Call","Onsite","In Progress","Solved"] as const;
                            const curStatus = selectedTicket.status;
                            const curIdx = flow.indexOf(curStatus as any);
                            const styleMap: Record<string,{icon:string;sel:string;unsel:string}> = {
                              Pending:      { icon:'🟡', sel:'bg-amber-500 text-white border-amber-500',    unsel:'bg-white text-amber-700 border-amber-200 hover:bg-amber-50' },
                              Call:         { icon:'📞', sel:'bg-cyan-600 text-white border-cyan-600',      unsel:'bg-white text-cyan-700 border-cyan-200 hover:bg-cyan-50' },
                              Onsite:       { icon:'🚗', sel:'bg-purple-600 text-white border-purple-600',  unsel:'bg-white text-purple-700 border-purple-200 hover:bg-purple-50' },
                              'In Progress':{ icon:'🔵', sel:'bg-blue-600 text-white border-blue-600',      unsel:'bg-white text-blue-700 border-blue-200 hover:bg-blue-50' },
                              Solved:       { icon:'✅', sel:'bg-emerald-500 text-white border-emerald-500',unsel:'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                            };
                            return flow.map((step, idx) => {
                              const stepIdx = flow.indexOf(step);
                              const locked = stepIdx < curIdx;
                              const skipLocked = step === 'Solved' && curIdx < 2;
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
                          <label className="block text-[9px] font-bold mb-1 tracking-widest uppercase text-gray-400">📝 Notes *</label>
                          <textarea value={newActivity.notes} onChange={e => setNewActivity({ ...newActivity, notes: e.target.value })}
                            placeholder="Detail penanganan..." rows={3}
                            className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
                            style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                        </div>
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
                      disabled={uploading || (!newActivity.notes && !["Pending","Call","Onsite","Warranty","Out Of Warranty","Waiting PO from Sales","Submit RMA","Waiting sparepart","Process Repair"].includes(newActivity.new_status))}
                      className="w-full text-white py-2.5 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 4px 14px rgba(220,38,38,0.35)" }}>
                      {uploading ? "⏳ Menyimpan..." : "💾 Simpan Activity"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

                {/* ── APPROVAL MODAL (Redesigned) ── */}
        {showApprovalModal && canAccessAccountSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="p-6" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-3xl">⏳</span><div><h3 className="text-xl font-bold text-white">Ticket Approval</h3><p className="text-sm text-white/90">{pendingApprovalTickets.length} ticket menunggu persetujuan</p></div></div><button onClick={() => setShowApprovalModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all">✕</button></div>
              </div>
              <div className="max-h-[calc(85vh-80px)] overflow-y-auto p-4 space-y-4">
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
                      <label className="block text-sm font-bold text-gray-700 mb-2">👨‍💼 Assign ke Team PTS:</label>
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
                                const isSelected = approvalTicket?.id === ticket.id && approvalAssignee === ref.assign_name;
                                return (
                                  <button key={idx}
                                    onClick={() => { setApprovalTicket(ticket); setApprovalAssignee(ref.assign_name); }}
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
                          value={approvalTicket?.id === ticket.id ? approvalAssignee : ""}
                          onChange={(e) => { setApprovalTicket(ticket); setApprovalAssignee(e.target.value); }}>
                          <option value="">Pilih anggota Team PTS</option>
                          {teamPTSMembers.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}
                        </select>
                        <button onClick={async () => { if (!approvalAssignee || approvalTicket?.id !== ticket.id) { notify("error", "Pilih anggota Team PTS terlebih dahulu!"); return; } await approveTicket(); }} disabled={uploading || !(approvalTicket?.id === ticket.id && approvalAssignee)} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">✅ Approve</button>
                        <button onClick={() => rejectTicket(ticket)} disabled={uploading} className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-40 text-sm">❌ Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SERVICES APPROVAL MODAL (Redesigned) ── */}
        {showServicesApprovalModal && currentUserTeamType === "Team Services" && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(219,39,119,0.5)" }}>
              <div className="p-6" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>
                <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-3xl">🔧</span><div><h3 className="text-xl font-bold text-white">Ticket Masuk — Team Services</h3><p className="text-sm text-white/90">{pendingServicesApprovalTickets.length} ticket menunggu konfirmasi</p></div></div><button onClick={() => setShowServicesApprovalModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all">✕</button></div>
              </div>
              <div className="max-h-[calc(85vh-80px)] overflow-y-auto p-4 space-y-4">
                {pendingServicesApprovalTickets.length === 0 ? (<div className="text-center py-12"><div className="text-5xl mb-3">✅</div><p className="text-gray-500 font-medium">Tidak ada ticket yang menunggu konfirmasi</p></div>) : pendingServicesApprovalTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl p-4" style={{ background: "rgba(219,39,119,0.1)", border: "2px solid rgba(219,39,119,0.3)" }}>
                    <div className="flex justify-between items-start mb-3"><div className="flex-1"><p className="font-bold text-lg text-gray-800">🏢 {ticket.project_name}</p><p className="text-sm text-gray-600 mt-0.5">⚠️ {ticket.issue_case}</p>{ticket.description && <p className="text-xs text-gray-500 mt-1">{ticket.description}</p>}<div className="flex gap-3 mt-2 flex-wrap text-xs text-gray-500">{ticket.customer_phone && <span>👤 {ticket.customer_phone}</span>}{ticket.sales_name && <span>💼 {ticket.sales_name}</span>}{ticket.sn_unit && <span>🔢 SN: {ticket.sn_unit}</span>}{ticket.address && <span>📍 {ticket.address}</span>}</div><p className="text-xs text-rose-700 font-semibold mt-2">Dikirim oleh Team PTS • {ticket.date}</p></div><span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-rose-100 text-rose-800 border-rose-400 whitespace-nowrap ml-3">⏳ Menunggu Konfirmasi</span></div>
                    <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(219,39,119,0.3)" }}><p className="text-xs text-gray-600 mb-3 rounded-lg px-3 py-2" style={{ background: "rgba(219,39,119,0.05)", border: "1px solid rgba(219,39,119,0.2)" }}>💡 Terima ticket untuk mulai proses penanganan, atau tolak untuk mengembalikan ke Team PTS.</p><div className="flex gap-2"><button onClick={() => approveServicesTicket(ticket)} disabled={uploading} className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">✅ Terima & Mulai Proses</button><button onClick={() => rejectServicesTicket(ticket)} disabled={uploading} className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2.5 rounded-lg font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-40 text-sm">❌ Tolak (Kembalikan ke PTS)</button></div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── REMINDER SCHEDULE MODAL (Redesigned) ── */}
        {showReminderSchedule && canAccessAccountSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(124,58,237,0.5)" }}>
              <div className="flex items-center justify-between mb-5"><div className="flex items-center gap-3"><span className="text-3xl">⏰</span><div><h3 className="text-lg font-bold text-gray-800">Jadwal WA Reminder</h3><p className="text-xs text-gray-500">Kirim reminder otomatis ke semua handler</p></div></div><button onClick={() => setShowReminderSchedule(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button></div>
              <div className="flex items-center justify-between rounded-xl p-3 mb-4" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}><div><p className="text-sm font-bold text-violet-800">Status Reminder</p><p className="text-xs text-violet-600">{reminderSchedule.active ? "Aktif — akan kirim WA otomatis" : "Nonaktif — tidak ada WA dikirim"}</p></div><button onClick={() => setReminderSchedule((prev) => ({ ...prev, active: !prev.active }))} className={`relative w-12 h-6 rounded-full transition-colors ${reminderSchedule.active ? "bg-violet-600" : "bg-gray-300"}`}><span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${reminderSchedule.active ? "translate-x-6" : "translate-x-0.5"}`} /></button></div>
              <div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-2">🕐 Jam Pengiriman (WIB)</label><div className="flex items-center gap-2"><select value={reminderSchedule.hour_wib} onChange={(e) => setReminderSchedule((prev) => ({ ...prev, hour_wib: e.target.value }))} className="flex-1 rounded-lg px-3 py-2.5 font-bold text-center text-lg focus:ring-2 focus:ring-violet-500" style={{ border: "2px solid rgba(124,58,237,0.3)", background: "white" }}>{Array.from({ length: 24 }, (_, i) => (<option key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</option>))}</select><span className="text-gray-500 font-semibold">:</span><select value={reminderSchedule.minute} onChange={(e) => setReminderSchedule((prev) => ({ ...prev, minute: e.target.value }))} className="w-24 rounded-lg px-3 py-2.5 font-bold text-center text-lg focus:ring-2 focus:ring-violet-500" style={{ border: "2px solid rgba(124,58,237,0.3)", background: "white" }}>{["00", "15", "30", "45"].map((m) => (<option key={m} value={m}>{m}</option>))}</select><span className="text-sm font-bold text-gray-600">WIB</span></div><div className="flex gap-2 mt-2 flex-wrap">{[{ label: "07:00", h: "7", m: "0" }, { label: "08:00", h: "8", m: "0" }, { label: "09:00", h: "9", m: "0" }, { label: "13:00", h: "13", m: "0" }].map((t) => (<button key={t.label} onClick={() => setReminderSchedule((prev) => ({ ...prev, hour_wib: t.h, minute: t.m }))} className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.hour_wib === t.h && reminderSchedule.minute === t.m ? "bg-violet-600 text-white border-violet-600" : "bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100"}`}>{t.label}</button>))}</div></div>
              <div className="mb-5"><label className="block text-sm font-bold text-gray-700 mb-2">📅 Frekuensi</label><div className="grid grid-cols-3 gap-2"><button onClick={() => setReminderSchedule((prev) => ({ ...prev, frequency: "daily" }))} className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.frequency === "daily" ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"}`}>📆 Setiap Hari</button><button onClick={() => setReminderSchedule((prev) => ({ ...prev, frequency: "weekdays" }))} className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.frequency === "weekdays" ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"}`}>💼 Senin–Jumat</button><button onClick={() => setReminderSchedule((prev) => ({ ...prev, frequency: "custom" }))} className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${reminderSchedule.frequency === "custom" ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"}`}>✏️ Pilih Hari</button></div>{reminderSchedule.frequency === "custom" && (<div className="mt-3 flex gap-1.5 flex-wrap">{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day, idx) => (<button key={idx} onClick={() => { const days = reminderSchedule.custom_days.includes(idx) ? reminderSchedule.custom_days.filter((d) => d !== idx) : [...reminderSchedule.custom_days, idx].sort(); setReminderSchedule((prev) => ({ ...prev, custom_days: days })); }} className={`w-10 h-10 rounded-full text-xs font-bold border-2 transition-all ${reminderSchedule.custom_days.includes(idx) ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-300 hover:border-violet-400"}`}>{day}</button>))}</div>)}</div>
              <div className="rounded-xl p-3 mb-5" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}><p className="text-xs text-gray-500 mb-1">Preview jadwal:</p><p className="text-sm font-bold text-gray-800">📬 {getCronDisplay()}</p><p className="text-xs text-gray-400 mt-1">Reminder dikirim ke WA semua handler dengan ticket Pending/In Progress</p></div>
              <div className="grid grid-cols-2 gap-3"><button onClick={saveCronSchedule} disabled={reminderSaving} className="bg-gradient-to-r from-violet-600 to-violet-800 text-white py-3 rounded-xl font-bold hover:from-violet-700 hover:to-violet-900 transition-all disabled:opacity-50">{reminderSaving ? "⏳ Menyimpan..." : "💾 Simpan"}</button><button onClick={() => setShowReminderSchedule(false)} className="bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">✕ Batal</button></div>
            </div>
          </div>
        )}

        {/* ── ACCOUNT SETTINGS MODAL (Redesigned) ── */}
        {showAccountSettings && canAccessAccountSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(75,85,99,0.3)" }}>
              <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800">⚙️ Account Management</h2><button onClick={() => setShowAccountSettings(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-blue-900">➕ Create New Account</h3><div className="space-y-3"><input type="text" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="text" placeholder="Full Name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="admin">Administrator</option><option value="team">Team</option><option value="guest">Guest</option></select>{newUser.role === "team" && (<select value={newUser.team_type} onChange={(e) => setNewUser({ ...newUser, team_type: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="Team PTS">Team PTS</option><option value="Team Services">Team Services</option></select>)}<button onClick={createUser} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-900 font-bold transition-all">➕ Create Account</button></div></div>
                <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-orange-900">🔒 Change Password</h3><div className="space-y-3"><select value={selectedUserForPassword} onChange={(e) => { setSelectedUserForPassword(e.target.value); setChangePassword({ current: "", new: "", confirm: "" }); }} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="">Select User</option>{users.map((u) => (<option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>))}</select>{selectedUserForPassword && (<><input type="password" placeholder="Old Password" value={changePassword.current} onChange={(e) => setChangePassword({ ...changePassword, current: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="password" placeholder="New Password" value={changePassword.new} onChange={(e) => setChangePassword({ ...changePassword, new: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input type="password" placeholder="Confirm Password" value={changePassword.confirm} onChange={(e) => setChangePassword({ ...changePassword, confirm: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><button onClick={updatePassword} className="w-full bg-gradient-to-r from-orange-600 to-orange-800 text-white py-3 rounded-xl hover:from-orange-700 hover:to-orange-900 font-bold transition-all">🔒 Change Password</button></>)}</div></div>
              </div>
              <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-gray-800">👥 User List</h3><div className="max-h-[400px] overflow-y-auto"><div className="space-y-2">{users.map((u) => (<div key={u.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex justify-between items-center"><div><p className="font-bold text-sm">{u.full_name}</p><p className="text-xs text-gray-600">{u.username}</p></div><div className="flex gap-2"><span className={`text-xs px-2 py-1 rounded ${u.role === "admin" ? "bg-red-100 text-red-800" : u.role === "team" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}>{u.role === "admin" ? "Admin" : u.role === "team" ? "Team" : "Guest"}</span>{u.team_type && <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">{u.team_type}</span>}</div></div>))}</div></div></div>
            </div>
          </div>
        )}

        {/* ── GUEST MAPPING MODAL (Redesigned) ── */}

        {/* ── NEW TICKET MODAL  ── */}
        {showNewTicket && canCreateTicket && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setShowNewTicket(false); }}>
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden" style={{ animation: "scale-in 0.25s ease-out", border: "1.5px solid rgba(220,38,38,0.25)" }}>
              {/* Header - Red gradient like ReminderSchedule */}
              <div className="px-8 py-6 rounded-t-2xl" style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">🎫 Create New Ticket</h2>
                    <p className="text-red-200/80 text-xs mt-1">Isi detail ticket & informasi troubleshooting</p>
                  </div>
                  <button onClick={() => setShowNewTicket(false)} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Informasi Ticket Section */}
                <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                  <span className="text-lg">🎫</span>
                  <span className="text-sm font-bold tracking-wide text-slate-700">Informasi Ticket</span>
                </div>

                {/* Row 1: Project Name | Address Detail */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Project Name *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">📌</span>
                      <input type="text" value={newTicket.project_name} onChange={(e) => setNewTicket({ ...newTicket, project_name: e.target.value })} placeholder="Example: BCA Cibitung Project" className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>📍 Address Detail</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3">📍</span>
                      <textarea value={newTicket.address} onChange={(e) => setNewTicket({ ...newTicket, address: e.target.value })} rows={2} placeholder="Example: Jl. Jend. Sudirman No. 1..." className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 resize-none" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>
                  </div>
                </div>

                {/* Row 2: Product | SN Unit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>📦 Product / Brand</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">📦</span>
                      <input type="text" value={newTicket.product} onChange={(e) => setNewTicket({ ...newTicket, product: e.target.value })} placeholder="Panasonic PT-MZ682, LG 75UL3Q, dll" className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>SN Unit <span className="text-gray-400 normal-case font-normal text-[10px]">(opsional)</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">🔢</span>
                      <input type="text" value={newTicket.sn_unit} onChange={(e) => setNewTicket({ ...newTicket, sn_unit: e.target.value })} placeholder="SN12345678 (opsional)" className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>
                  </div>
                </div>

                {/* Row 3: Customer Phone | Date (auto) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Customer Phone</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">📱</span>
                      <input type="text" value={newTicket.customer_phone} onChange={(e) => setNewTicket({ ...newTicket, customer_phone: e.target.value })} placeholder="Adi - 08xx-xxxx-xxxx" className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>📅 Date <span className="text-gray-400 normal-case font-normal text-[10px]">(hari ini)</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
                      <input type="text" value={new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} disabled className="w-full rounded-xl pl-9 pr-4 py-3 text-sm text-slate-400 cursor-not-allowed" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }} />
                    </div>
                  </div>
                </div>

                {/* Issue Case - full width */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Issue Case *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3">⚠️</span>
                    <input type="text" value={newTicket.issue_case} onChange={(e) => { const val = e.target.value; const words = val.trim().split(/\s+/).filter(Boolean); if (words.length < 4 || (words.length === 4 && !val.endsWith(" "))) setNewTicket({ ...newTicket, issue_case: val }); }} placeholder="Maks. 4 kata, contoh: Videowall Not Working" className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                  </div>
                  <div className="flex justify-between items-center mt-1.5 px-1">
                    <span className="text-xs text-gray-500">Maksimal 4 kata</span>
                    <span className={`text-xs font-bold ${newTicket.issue_case.trim().split(/\s+/).filter(Boolean).length >= 4 ? "text-red-500" : "text-gray-400"}`}>
                      {newTicket.issue_case.trim().split(/\s+/).filter(Boolean).length}/4 kata
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>📝 Detailed Description</label>
                  <textarea value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} rows={3} placeholder="Explain the problem details..." className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 resize-none" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
                </div>

                {/* Sales: hidden for guest — auto-insert. Shown only for admin/team */}
                {currentUser?.role !== "guest" && (
                  <div>
                    <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                      <span className="text-lg">🏢</span>
                      <span className="text-sm font-bold tracking-wide text-slate-700">Informasi Sales</span>
                    </div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Sales Name</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">👤</span>
                      <select value={newTicket.sales_name} onChange={(e) => {
                        const sel = users.find(u => u.full_name === e.target.value && u.role === "guest");
                        setNewTicket({ ...newTicket, sales_name: e.target.value, sales_division: sel?.sales_division || "" });
                      }} className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-red-500/40 appearance-none cursor-pointer" style={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}>
                        <option value="">— Pilih Sales —</option>
                        {users.filter(u => u.role === "guest").map(u => (
                          <option key={u.id} value={u.full_name}>{u.full_name}{u.sales_division ? ` (${u.sales_division})` : ""}</option>
                        ))}
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▾</span>
                    </div>
                  </div>
                )}

                {/* Admin/Superadmin: Assign To handler */}
                {(currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                  <div>
                    <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                      <span className="text-lg">👷</span>
                      <span className="text-sm font-bold tracking-wide text-slate-700">Assign Handler</span>
                    </div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Assign To *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">👨‍💼</span>
                      <select value={newTicket.assign_name} onChange={(e) => setNewTicket({ ...newTicket, assign_name: e.target.value })}
                        className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-red-500/40 appearance-none cursor-pointer"
                        style={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}>
                        <option value="">— Pilih Handler —</option>
                        <optgroup label="Team PTS">
                          {teamPTSMembers.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}
                        </optgroup>
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▾</span>
                    </div>
                  </div>
                )}

                {/* Non-admin: info bahwa perlu approval */}
                {currentUser?.role !== "admin" && currentUser?.role !== "superadmin" && (
                  <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.3)" }}>
                    <span className="text-2xl">⏳</span>
                    <div>
                      <p className="text-sm font-bold text-orange-800">Perlu Persetujuan Superadmin</p>
                      <p className="text-xs text-orange-700 mt-0.5">Ticket yang Anda buat akan masuk ke antrian approval Superadmin terlebih dahulu. Setelah disetujui, Superadmin akan assign ticket ke Tim PTS yang tersedia.</p>
                    </div>
                  </div>
                )}

                {/* Upload Foto Section */}
                <div className="flex items-center gap-2 pb-2 border-b pt-2" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                  <span className="text-lg">📸</span>
                  <span className="text-sm font-bold tracking-wide text-slate-700">Foto Pendukung</span>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Upload Foto <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <p className="text-xs text-gray-500 mb-3">Foto pendukung kondisi awal / bukti masalah</p>
                  <input type="file" accept="image/*" onChange={(e) => setNewTicket({ ...newTicket, photo: e.target.files?.[0] || null })} className="w-full border rounded-xl px-4 py-2.5 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition-all text-sm" style={{ borderColor: "rgba(0,0,0,0.12)" }} />
                  {newTicket.photo && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border" style={{ borderColor: "rgba(220,38,38,0.2)" }}>
                        <span className="text-red-600">✓</span>
                        <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{newTicket.photo.name}</span>
                        <span className="text-xs text-gray-400">({(newTicket.photo.size / 1024).toFixed(1)} KB)</span>
                        <button type="button" onClick={() => setNewTicket({ ...newTicket, photo: null })} className="text-red-400 hover:text-red-600 font-bold text-xs ml-1">✕</button>
                      </div>
                      <img src={URL.createObjectURL(newTicket.photo)} alt="Preview" className="w-full max-h-48 object-cover rounded-lg border-2 shadow-sm" style={{ borderColor: "rgba(220,38,38,0.3)" }} />
                    </div>
                  )}
                </div>

                {/* Action Buttons - Red gradient like ReminderSchedule */}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowNewTicket(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all" style={{ background: "rgba(255,255,255,0.95)", color: "#64748b", border: "1px solid rgba(0,0,0,0.12)" }}>
                    Batal
                  </button>
                  <button onClick={createTicket} disabled={uploading} className="flex-1 text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50" style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 4px 14px rgba(220,38,38,0.35)" }}>
                    {uploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {uploading ? "⏳ Menyimpan..." : "💾 Save Ticket"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OVERDUE SETTING MODAL (Redesigned) ── */}
        {showOverdueSetting && overdueTargetTicket && canAccessAccountSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="flex items-center gap-3 mb-4"><span className="text-3xl">⏰</span><div><h3 className="text-lg font-bold text-gray-800">Overdue Setting</h3><p className="text-xs text-gray-500 font-medium">{overdueTargetTicket.project_name}</p><p className="text-xs text-gray-400">{overdueTargetTicket.issue_case}</p></div></div>
              <p className="text-xs text-orange-700 rounded-lg p-2 mb-4" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>⚠️ Setting ini hanya terlihat oleh admin Anda. Handler akan mendapat notifikasi merah ketika ticket overdue. Default otomatis: ticket overdue setelah 48 jam jika tidak di-set manual.</p>
              <div className="space-y-4"><div><label className="block text-sm font-bold mb-1 text-gray-700">⏱️ Overdue Setelah Berapa Jam?</label><div className="flex items-center gap-3"><input type="number" min="1" value={overdueForm.due_hours} onChange={(e) => setOverdueForm({ due_hours: e.target.value })} className="flex-1 rounded-lg px-3 py-2.5 text-lg font-bold text-center focus:ring-2 focus:ring-orange-500" style={{ border: "2px solid rgba(245,158,11,0.3)", background: "white" }} /><span className="text-gray-600 font-semibold text-sm">jam</span></div><div className="flex gap-2 mt-2">{[24, 48, 72, 96].map((h) => (<button key={h} type="button" onClick={() => setOverdueForm({ due_hours: String(h) })} className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${overdueForm.due_hours === String(h) ? "bg-orange-500 text-white border-orange-500" : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"}`}>{h}j{h === 48 ? " (default)" : ""}</button>))}</div><p className="text-xs text-gray-400 mt-2">⏰ Dihitung dari waktu ticket pertama kali dibuat</p></div><div className="grid grid-cols-2 gap-3 pt-2"><button onClick={saveOverdueSetting} className="bg-gradient-to-r from-orange-500 to-orange-700 text-white py-2.5 rounded-xl font-bold hover:from-orange-600 hover:to-orange-800 transition-all">💾 Simpan</button><button onClick={() => { setShowOverdueSetting(false); setOverdueTargetTicket(null); setOverdueForm({ due_hours: "48" }); }} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">✕ Batal</button></div>{getOverdueSetting(overdueTargetTicket.id) && (<button onClick={() => { deleteOverdueSetting(overdueTargetTicket.id); setShowOverdueSetting(false); setOverdueTargetTicket(null); }} className="w-full bg-red-100 text-red-700 py-2 rounded-xl font-bold hover:bg-red-200 transition-all text-sm border border-red-300">🗑️ Hapus Setting Overdue</button>)}</div>
            </div>
          </div>
        )}

        {/* ── RE-OPEN TICKET MODAL (Redesigned) ── */}
        {showReopenModal && reopenTargetTicket && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
              <div className="flex items-center gap-3 mb-5"><span className="text-3xl">🔓</span><div><h3 className="text-lg font-bold text-gray-800">Re-open Ticket</h3><p className="text-xs text-gray-500">{reopenTargetTicket.project_name} · {reopenTargetTicket.issue_case}</p></div></div>
              <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#b45309" }}>⚠️ Status akan berubah ke <strong>Pending</strong> dan activity log baru ditambahkan otomatis.</div>
              <div className="space-y-4"><div><label className="block text-sm font-bold mb-1 text-gray-700">Assign ke Handler *</label><select value={reopenAssignee} onChange={(e) => setReopenAssignee(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="">— Pilih Handler —</option>{teamPTSMembers.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}</select></div><div><label className="block text-sm font-bold mb-1 text-gray-700">Alasan (opsional)</label><textarea value={reopenNotes} onChange={(e) => setReopenNotes(e.target.value)} placeholder="Masalah muncul kembali..." rows={3} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40 resize-none" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /></div><div className="grid grid-cols-2 gap-3"><button onClick={reopenTicket} disabled={uploading || !reopenAssignee} className="bg-gradient-to-r from-amber-500 to-amber-700 text-white py-2.5 rounded-xl font-bold hover:from-amber-600 hover:to-amber-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{uploading ? "⏳..." : "🔓 Re-open"}</button><button onClick={() => { setShowReopenModal(false); setReopenTargetTicket(null); setReopenAssignee(""); setReopenNotes(""); }} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">Batal</button></div></div>
            </div>
          </div>
        )}

        {/* ── ACTIVITY SUMMARY MODAL (Redesigned) ── */}
        {showActivitySummary && summaryTicket && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-2">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full h-[96vh] flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(59,130,246,0.5)" }}>
              <div className="p-5 border-b flex-shrink-0" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderColor: "rgba(0,0,0,0.1)" }}>
                <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-2xl">🔄</span><div><h3 className="text-lg font-bold text-white">Activity Summary</h3><p className="text-sm text-blue-100 font-medium">{summaryTicket.project_name}</p><p className="text-xs text-blue-200">{summaryTicket.issue_case}</p></div></div><button onClick={() => { setShowActivitySummary(false); setSummaryTicket(null); }} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all text-lg">✕</button></div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
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
                          <div className="flex items-start gap-3"><div className="flex flex-col items-center flex-shrink-0"><div className={`w-9 h-9 rounded-full ${nodeColor} flex items-center justify-center text-white text-xs font-bold shadow-md`}>{isSolved ? "✅" : isServices ? "🔄" : idx + 1}</div>{!isLast && <div className="w-0.5 bg-gray-300 flex-1" style={{ minHeight: "12px" }}></div>}</div><div className={`flex-1 border-2 rounded-xl px-4 py-3 mb-1 ${cardBorder}`}><div className="flex justify-between items-start mb-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-bold text-gray-800">{log.handler_name}</span><span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">{log.team_type}</span></div><span className={`text-xs px-2 py-0.5 rounded-full font-bold border flex-shrink-0 ml-2 ${statusColors[log.new_status] || "bg-gray-100 text-gray-700 border-gray-300"}`}>{log.new_status}</span></div><p className="text-xs text-gray-500 mb-2">{formatDateTime(log.created_at)}</p>{log.action_taken && (<div className="rounded-lg px-3 py-1.5 mb-2" style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}><p className="text-xs font-bold text-blue-700">🔧 Action:</p><p className="text-xs text-gray-800">{log.action_taken}</p></div>)}<div className="rounded-lg px-3 py-1.5" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}><p className="text-xs font-bold text-gray-600">📝 Notes:</p><p className="text-xs text-gray-800 whitespace-pre-line">{log.notes}</p></div>{isServices && <div className="mt-2 flex items-center gap-1 text-xs font-bold text-red-700 rounded-lg px-2 py-1" style={{ background: "rgba(220,38,38,0.1)" }}><span>🔄</span> Diteruskan ke Team Services</div>}{log.photo_url && <div className="mt-2"><img src={log.photo_url} alt="bukti" className="max-h-28 rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(log.photo_url!, "_blank")} /></div>}{log.file_url && <a href={log.file_url} download={log.file_name} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 rounded-lg px-2 py-1 hover:bg-blue-200 transition-colors" style={{ background: "rgba(59,130,246,0.1)" }}>📎 {log.file_name || "Download Report"}</a>}</div></div>
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
        )}
        {/* ── DELETE TICKET MODAL (Admin Only) ── */}
        {showDeleteModal && deleteTargetTicket && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
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
        )}

      </div>
      <style>{`
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
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
