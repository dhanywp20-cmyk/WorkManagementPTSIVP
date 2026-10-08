'use client';

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { supabase } from '@/lib/supabase';
import { clearSession, getSession } from '@/lib/auth';

import {
  DAILY_REPORT_CATEGORIES, CATEGORY_CONFIG,
  formatDate,
  type TeamUser, type GuestUser,
} from '@/app/(portal)/reminder-schedule/_components/shared';

import {
  todayISO, formatLogTime,
  fetchAllReminders, fetchAllTickets,
  fetchReminderActivities, fetchTicketActivities,
  fetchExistingReport, fetchReports,
  saveReport, saveTeamEntries,
  type ReminderActivity, type TicketActivity,
  type ManualActivity, type TeamEntry,
  type DailyReport,
  hapusAktivitasManual, RENTANG_HARI } from './_components/shared';

import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import { namaKelompokPTSDitugaskan, useKelompokPTSDitugaskan } from '@/lib/kelompok';

import {
  FormField, SectionHeaderSmall, LoadingScreen, ListEmptyState, Username, ModalPortal, ConfirmDialog, type ConfirmState } from '@/components/shared';
import { MiniPieChart, PageHeader, StatCardGrid, Paginasi, usePaginasi } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Toast as ToastBersama } from '@/components/shared/Toast';
import { inp, inpCls, card, cardHdr, TH, TD, SB, sb, AVC, avc, ini, newManualKey, newTeamKey, emptyManual, emptyTeamEntry, PW, CatPicker, SalesDrop, Toast, type FlatRow } from './_components/bantu-halaman';
import { DaftarLaporanHarian } from './_components/DaftarLaporanHarian';
import { FilterLaporanHarian } from './_components/FilterLaporanHarian';

// MAIN
export default function DailyReportPage() {
  const [appReady, setAppReady]       = useState(false);
  const [currentUser, setCurrentUser] = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]     = useState<TeamUser[]>([]);
  /**
   * Judul grafik mengikuti kelompok yang benar-benar dirangkum. Menuliskan
   * "Team PTS IVP" di sana - seperti sebelumnya - membuat grafik yang berisi
   * dua kelompok mengaku berisi satu, dan itu jenis kekeliruan yang tidak akan
   * pernah dilaporkan siapa pun karena tampak wajar.
   */
  const kelompokPTS = useKelompokPTSDitugaskan();
  const judulKelompokPTS = kelompokPTS.length === 1
    ? kelompokPTS[0].nama
    : `Team PTS (${kelompokPTS.map(k => k.label).join(' & ')})`;
  const [guestUsers, setGuestUsers]   = useState<GuestUser[]>([]);

  // Live data (dari reminder + ticket platform, tanpa perlu submit dulu)
  const [liveReminders, setLiveReminders] = useState<(ReminderActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveTickets, setLiveTickets]     = useState<(TicketActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveLoading, setLiveLoading]     = useState(false);

  // Submitted reports
  const [reports, setReports]         = useState<DailyReport[]>([]);

  // Filter
  const [filterDate, setFilterDate]   = useState('');
  const [filterUser, setFilterUser]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterHandler, setFilterHandler]   = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string | null>(null);
  const [filterProduct, setFilterProduct]   = useState<string | null>(null);

  // Form state
  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [formDate, setFormDate]       = useState(todayISO());
  const [formUserId, setFormUserId]   = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  /** Draf ringkasan AI: sedang menyusun / pesan gagal. */
  const [menyusun, setMenyusun] = useState(false);
  const [galatSusun, setGalatSusun] = useState('');
  const [formReminders, setFormReminders] = useState<ReminderActivity[]>([]);
  const [formTickets, setFormTickets]     = useState<TicketActivity[]>([]);
  const [manualActs, setManualActs]       = useState<ManualActivity[]>([]);
  const [teamEntries, setTeamEntries]     = useState<TeamEntry[]>([]);
  const [formLoading, setFormLoading]     = useState(false);
  const [saving, setSaving]               = useState(false);

  // Modal detail
  const [modalRow, setModalRow]       = useState<any | null>(null);

  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  /**
   * Boleh hapus = PEMILIK laporan atau Admin/Full Access - aturan yang sama
   * dengan policy dr_ubah di basis data, jadi tombolnya tidak pernah
   * menjanjikan sesuatu yang nanti ditolak server.
   */
  const bolehHapus = (row: any): boolean => {
    if (!row.report_id || row.manual_index === undefined || !currentUser) return false;
    const r = reports.find(x => x.id === row.report_id);
    if (!r) return false;
    return isAdmin || r.user_id === currentUser.id;
  };

  const mintaHapus = (row: any) => {
    const r = reports.find(x => x.id === row.report_id);
    if (!r || row.manual_index === undefined) return;
    setConfirmState({
      message: 'Hapus aktivitas ini dari Daily Report?',
      description: `"${row.project_name}" (${row.report_date}) akan dihapus dari laporan. Aktivitas lain di laporan yang sama tidak terpengaruh.`,
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        const sisa = r.manual_activities.filter((_, i) => i !== row.manual_index);
        const hasil = await hapusAktivitasManual(r.id, sisa);
        if (!hasil.ok) { notify('error', hasil.error); return; }
        notify('success', 'Aktivitas dihapus.');
        await loadReports();
      },
    });
  };

  // Admin/superadmin, ATAU akun Team PTS dengan toggle "Full Access" aktif
  // (lihat lib/constants.ts hasFullAccess).
  const isAdmin = hasFullAccess(currentUser);
  //  Akun pimpinan (lib/pimpinan.ts) MELIHAT laporan seluruh tim seperti admin, tetapi tidak
  //  menulis: tombol tambah disembunyikan dan basis data menolak tulis (migrasi 034).
  const pimpinan = isPimpinan(currentUser);
  const lihatSemua = isAdmin || pimpinan;

  // Init
  useEffect(() => {
    const user = getSession<TeamUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    Promise.all([loadTeamUsers(), loadGuestUsers()]).then(() => setAppReady(true));
    // session check
    const iv = setInterval(() => {
      if (!getSession()) {
        clearSession();
        const w = window.top !== window ? window.top : window;
        if (w) w.location.href = '/dashboard';
      }
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  /**
   * Anggota tim yang pekerjaannya dirangkum di layar ini.
   *
   * Kelompoknya diambil dari lib/kelompok.ts, BUKAN ditulis di sini.
   * Sebelumnya baris ini berbunyi `team_type === 'Team PTS IVP'` - satu nama
   * kelompok yang terpaku di kode - sehingga seluruh anggota Team PTS MVI
   * tidak pernah masuk daftar. Akibatnya ticket dan reminder mereka tidak
   * pernah terangkum di Daily Report, dan namanya juga tidak bisa dipilih.
   * Judul halaman ini sendiri sudah lama berbunyi "PTS IVP & MVI".
   *
   * Kegagalannya tidak bersuara: layarnya tampil normal, hanya isinya separuh.
   *
   * Dengan namaKelompokPTS(), menambah kelompok PTS baru lewat Admin Panel
   * langsung ikut terangkum tanpa menyunting berkas ini lagi.
   */
  const loadTeamUsers = async () => {
    const { data } = await supabase.from('users').select('id,username,full_name,role,team_type,phone_number,sales_division,allowed_menus').order('full_name');
    if (!data) return;
    const kelompokPTS = namaKelompokPTSDitugaskan();
    setTeamUsers(data.filter((u: TeamUser) =>
      kelompokPTS.includes(u.team_type ?? '') && u.role !== 'admin' && u.role !== 'superadmin'));
  };
  const loadGuestUsers = async () => {
    const { data } = await supabase.from('users').select('id,username,full_name,role,phone_number,sales_division').eq('role', 'guest').order('full_name');
    if (data) setGuestUsers(data as GuestUser[]);
  };

  // Load live data dari kedua platform
  const loadLiveData = useCallback(async () => {
    if (!currentUser) return;
    setLiveLoading(true);
    try {
      const usernames = lihatSemua
        ? teamUsers.map(u => u.username).filter(Boolean)
        : [currentUser.username];

      const opts = {
        date: filterDate || undefined,
        // Jika admin tapi belum ada teamUsers, kirim undefined agar fetch semua
        usernames: filterUser
          ? [teamUsers.find(u => u.id === filterUser)?.username ?? ''].filter(Boolean)
          : usernames.length > 0 ? usernames : undefined,
      };

      const [rem, tick] = await Promise.all([
        fetchAllReminders(opts),
        fetchAllTickets(opts),
      ]);
      setLiveReminders(rem as any);
      setLiveTickets(tick as any);
    } catch { }
    setLiveLoading(false);
  }, [currentUser, lihatSemua, teamUsers, filterDate, filterUser]);

  // Load submitted reports
  const loadReports = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await fetchReports({ date: filterDate || undefined, userId: filterUser || undefined, isAdmin: lihatSemua, currentUserId: currentUser.id });
      setReports(data);
    } catch { }
  }, [currentUser, filterDate, filterUser, lihatSemua]);

  useEffect(() => {
    if (!currentUser) return;
    // Untuk admin: tunggu teamUsers selesai load dulu (hindari fetch dengan usernames=[])
    if (lihatSemua && teamUsers.length === 0) return;
    loadLiveData();
    loadReports();
  }, [currentUser, lihatSemua, teamUsers, filterDate, filterUser]);

  // Build flat rows: gabung live data + manual dari submitted reports

  const allRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];

    // Build ticket key set untuk deduplication
    // Key format: `${project_name_lower}|${handler_username_lower}|${date}`
    // Reminder Troubleshooting yang sudah ada tiketnya di platform ticketing tidak
    // ditampilkan duplikat - ticket lebih prioritas karena lebih lengkap (action_taken, status aktual)
    const ticketKeySet = new Set<string>(
      liveTickets.map(t => {
        const hu = ((t as any).handler_username ?? '').toLowerCase();
        const rd = ((t as any).report_date ?? '').split('T')[0];
        return `${(t.project_name ?? '').trim().toLowerCase()}|${hu}|${rd}`;
      })
    );

    // Reminder - langsung dari platform, tanpa perlu submit
    liveReminders.forEach(r => {
      const hr = (r as any).handler_username ?? '';
      const tu = teamUsers.find(u => u.username === hr);
      const rd = ((r as any).report_date ?? '').split('T')[0];

      // Jika reminder kategori Troubleshooting DAN sudah ada ticket yang matching
      // (project_name + handler + tanggal sama)  skip untuk hindari duplicate
      if ((r.category ?? '').toLowerCase() === 'troubleshooting') {
        const key = `${(r.project_name ?? '').trim().toLowerCase()}|${hr.toLowerCase()}|${rd}`;
        if (ticketKeySet.has(key)) return;
      }

      rows.push({
        id: 'rem_' + r.reminder_id,
        source: 'reminder',
        report_date: rd,
        project_name: r.project_name || r.title || '-',
        address: r.address || '',
        product: r.product || '',
        category: r.category || 'Internal',
        kegiatan_icon: '🔔',
        kegiatan_label: r.category || 'Reminder',
        sales_name: r.sales_name || '',
        sales_division: r.sales_division || '',
        handler_name: tu?.full_name ?? hr,
        handler_username: hr,
        status: r.status || 'pending',
        jam: r.due_time || '-',
        raw: r,
      });
    });

    // Ticket - langsung dari platform
    liveTickets.forEach(t => {
      const hu = (t as any).handler_username ?? '';
      const tu = teamUsers.find(u => u.username === hu);
      const rd = (t as any).report_date ?? '';
      rows.push({
        id: 'tck_' + t.ticket_id,
        source: 'ticket',
        report_date: rd,
        project_name: t.project_name || '-',
        address: t.address || '',
        product: '',
        category: 'Troubleshooting',
        kegiatan_icon: '🔧',
        kegiatan_label: t.issue_case || 'Troubleshooting',
        sales_name: t.sales_name || '',
        sales_division: t.sales_division || '',
        handler_name: tu?.full_name ?? hu,
        handler_username: hu,
        status: t.new_status || '-',
        jam: t.log_time || '-',
        raw: t,
      });
    });

    // Manual - dari submitted daily_reports saja
    reports.forEach(r => {
      r.manual_activities.forEach((m, idx) => {
        const tu = teamUsers.find(u => u.id === r.user_id);
        rows.push({
          id: `man_${r.id}_${idx}`,
          source: 'manual',
          manual_index: idx,
          report_date: r.report_date,
          project_name: m.project_name || '-',
          address: m.address || '',
          product: '',
          category: m.category || 'Internal',
          kegiatan_icon: '✍️',
          kegiatan_label: m.description || m.category || 'Manual',
          sales_name: m.sales_name || '',
          sales_division: m.sales_division || '',
          handler_name: r.user_name,
          handler_username: tu?.username ?? '',
          status: 'manual',
          jam: '-',
          report_id: r.id,
          raw: m,
        });
      });
    });

    // Sort: terbaru dulu
    rows.sort((a, b) => b.report_date.localeCompare(a.report_date) || a.jam.localeCompare(b.jam));
    return rows;
  }, [liveReminders, liveTickets, reports, teamUsers]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      if (searchProject) {
        const q = searchProject.toLowerCase();
        if (!row.project_name.toLowerCase().includes(q) && !row.address.toLowerCase().includes(q) && !row.sales_name.toLowerCase().includes(q) && !row.handler_name.toLowerCase().includes(q)) return false;
      }
      if (filterStatus && row.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
      if (filterSource && row.source !== filterSource) return false;
      if (filterCategory && row.category !== filterCategory) return false;
      if (filterHandler && (row.handler_name || row.handler_username) !== filterHandler) return false;
      if (filterDivision && row.sales_division !== filterDivision) return false;
      if (filterProduct && row.product !== filterProduct) return false;
      return true;
    });
  }, [allRows, searchProject, filterStatus, filterCategory, filterHandler, filterDivision, filterProduct]);

  // Paginasi daftar - lihat components/shared/Paginasi.tsx.
  const hal = usePaginasi(filteredRows);

  const stats = useMemo(() => {
    const total = allRows.length;
    const pending = allRows.filter(r => ['pending', 'in progress', 'proses'].includes(r.status.toLowerCase())).length;
    const selesai = allRows.filter(r => ['done', 'completed', 'selesai', 'solved'].includes(r.status.toLowerCase())).length;
    const today = todayISO();
    const hariIni = allRows.filter(r => r.report_date === today).length;
    const fromTicket   = allRows.filter(r => r.source === 'ticket').length;
    const fromReminder = allRows.filter(r => r.source === 'reminder').length;
    const fromManual   = allRows.filter(r => r.source === 'manual').length;
    return { total, pending, selesai, hariIni, fromTicket, fromReminder, fromManual };
  }, [allRows]);

  /*
    M7 (docs/UX-WORKFLOW-AUDIT.md): dulu tidak ada cara melihat siapa yang
    BELUM mengisi report hari ini - allRows hanya merangkum aktivitas yang
    SUDAH ADA. Supervisor harus membandingkan manual dengan daftar tim di
    kepala. Dibandingkan di sini terhadap teamUsers (daftar anggota tim
    sesungguhnya), bukan disimpulkan dari data yang sudah ada.
  */
  const belumLaporHariIni = useMemo(() => {
    if (!lihatSemua || teamUsers.length === 0) return [];
    const today = todayISO();
    const sudahLapor = new Set(
      allRows.filter(r => r.report_date === today).map(r => (r.handler_username || '').toLowerCase())
    );
    return teamUsers.filter(u => u.username && !sudahLapor.has(u.username.toLowerCase()));
  }, [teamUsers, allRows, lihatSemua]);

  // Donut data
  const PIE_C = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

  const catPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => m.set(r.category, (m.get(r.category) ?? 0) + 1));
    return Array.from(m.entries()).map(([label, value]) => ({ label, value, color: CATEGORY_CONFIG[label]?.accent ?? '#94a3b8' }));
  }, [allRows]);

  const handlerPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => { const k = r.handler_name || r.handler_username; if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_C[i % PIE_C.length] }));
  }, [allRows]);

  const divisionPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => { if (r.sales_division) m.set(r.sales_division, (m.get(r.sales_division) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label, value], i) => ({ label, value, color: PIE_C[(i+3) % PIE_C.length] }));
  }, [allRows]);

  const productPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => { if (r.product) m.set(r.product, (m.get(r.product) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_C[(i+2) % PIE_C.length] }));
  }, [allRows]);

  /*
    Draf isian di perangkat: pernah terjadi simpan Daily Report hilang diam-diam (permintaan
    tidak sampai server, halaman di dalam iframe termuat ulang di tengah simpan). Isian manual
    & catatan disimpan sementara di localStorage selama form terbuka, lalu dipulihkan saat form
    dibuka lagi (tanggal/akun/report yang sama). Dihapus setelah berhasil simpan atau Batal.
  */
  const kunciDraf = currentUser?.id ? `wm_dr_draf_${currentUser.id}` : '';
  type DrafDR = { formDate: string; formUserId: string; editingId: string | null; reminderNotes: string; manualActs: ManualActivity[]; waktu: number };
  const bacaDraf = (): DrafDR | null => {
    if (!kunciDraf) return null;
    try {
      const d = JSON.parse(localStorage.getItem(kunciDraf) ?? 'null') as DrafDR | null;
      return d && Date.now() - d.waktu < 3 * 86_400_000 ? d : null;
    } catch { return null; }
  };
  const hapusDraf = () => { try { if (kunciDraf) localStorage.removeItem(kunciDraf); } catch { /* abaikan */ } };
  const adaIsian = (acts: ManualActivity[], catatan: string) => !!catatan.trim() || acts.some(m => m.project_name.trim() || m.description.trim());
  useEffect(() => {
    if (!formOpen || !kunciDraf || !adaIsian(manualActs, reminderNotes)) return;
    try {
      localStorage.setItem(kunciDraf, JSON.stringify({ formDate, formUserId, editingId, reminderNotes, manualActs, waktu: Date.now() } satisfies DrafDR));
    } catch { /* penyimpanan perangkat penuh / diblokir: abaikan */ }
  }, [formOpen, kunciDraf, formDate, formUserId, editingId, reminderNotes, manualActs]);
  //  Jangan biarkan halaman tertutup / dimuat ulang saat penyimpanan masih berjalan.
  useEffect(() => {
    if (!saving) return;
    const tahan = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [saving]);
  const pulihkanDraf = (cocok: (d: DrafDR) => boolean) => {
    const d = bacaDraf();
    if (!d || !cocok(d) || !adaIsian(d.manualActs, d.reminderNotes)) return false;
    setReminderNotes(d.reminderNotes);
    setManualActs(d.manualActs.length ? d.manualActs : [emptyManual(currentUser?.username ?? '')]);
    notify('success', 'Isian yang belum tersimpan dipulihkan dari perangkat ini.');
    return true;
  };

  // Form helpers
  const openNewForm = async () => {
    const date = todayISO();
    setFormDate(date); setFormUserId(isAdmin ? '' : currentUser?.id ?? '');
    setReminderNotes(''); setManualActs([emptyManual(currentUser?.username ?? '')]);
    setEditingId(null); setFormReminders([]); setFormTickets([]);
    if (isAdmin) setTeamEntries(teamUsers.map(u => emptyTeamEntry(u)));
    else setTeamEntries([]);
    //  Draf laporan baru yang belum tersimpan (tanggal & akun ikut dipulihkan).
    const draf = bacaDraf();
    if (draf && !draf.editingId && pulihkanDraf(() => true)) {
      setFormDate(draf.formDate); setFormUserId(draf.formUserId);
    }
    if (!isAdmin && currentUser?.username) {
      setFormLoading(true);
      const [rem, tick] = await Promise.all([
        fetchReminderActivities(currentUser.username, date),
        fetchTicketActivities(currentUser.username, date),
      ]);
      setFormReminders(rem); setFormTickets(tick); setFormLoading(false);
    }
    setFormOpen(true);
  };

  const openEditForm = async (report: DailyReport) => {
    setFormDate(report.report_date); setFormUserId(report.user_id);
    setReminderNotes(report.reminder_notes ?? '');
    setManualActs((report.manual_activities ?? []).length
      ? report.manual_activities.map(m => ({ ...m, _key: newManualKey() }))
      : [emptyManual(currentUser?.username ?? '')]);
    setEditingId(report.id);
    pulihkanDraf(d => d.editingId === report.id);
    const username = isAdmin ? (teamUsers.find(u => u.id === report.user_id)?.username ?? '') : (currentUser?.username ?? '');
    setFormLoading(true);
    const [rem, tick] = await Promise.all([
      fetchReminderActivities(username, report.report_date),
      fetchTicketActivities(username, report.report_date),
    ]);
    setFormReminders(rem); setFormTickets(tick); setFormLoading(false);
    setFormOpen(true);
  };

  // Auto-reload form activities when date/user changes
  useEffect(() => {
    if (!formOpen) return;
    const username = isAdmin ? (teamUsers.find(u => u.id === formUserId)?.username ?? '') : (currentUser?.username ?? '');
    if (!username || !formDate) return;
    let cancelled = false;
    setFormLoading(true);
    Promise.all([fetchReminderActivities(username, formDate), fetchTicketActivities(username, formDate)]).then(([rem, tick]) => {
      if (!cancelled) { setFormReminders(rem); setFormTickets(tick); setFormLoading(false); }
    });
    return () => { cancelled = true; };
  }, [formDate, formUserId, formOpen]);

  const handleSave = async () => {
    const targetUserId = isAdmin ? formUserId : currentUser?.id ?? '';
    const targetUser = teamUsers.find(u => u.id === targetUserId) ?? currentUser;
    if (!formDate) { notify('error', 'Tanggal wajib dipilih!'); return; }
    if (!targetUserId) { notify('error', 'Pilih anggota team!'); return; }
    if (!editingId) {
      const existing = await fetchExistingReport(targetUserId, formDate);
      if (existing) { notify('error', `Report ${targetUser?.full_name} tgl ${formatDate(formDate)} sudah ada!`); return; }
    }
    setSaving(true);
    const cleanManual = manualActs.filter(m => m.project_name.trim() || m.description.trim())
      .map(({ _key, ...rest }) => ({ ...rest, submitted_by: rest.submitted_by || currentUser?.username || 'system' }));
    //  Koneksi putus / permintaan gagal di jalan: tampilkan galat, form tetap terbuka
    //  (dulu tombol bisa macet "menyimpan" tanpa pesan apa pun).
    let result: { ok: boolean; error?: string };
    try {
      result = await saveReport({
      ...(editingId ? { id: editingId } : {}),
      report_date: formDate, user_id: targetUserId, user_name: targetUser?.full_name ?? '',
      sales_division: targetUser?.sales_division ?? '',
      reminder_activities: formReminders, ticket_activities: formTickets,
      manual_activities: cleanManual, reminder_notes: reminderNotes,
      created_by: currentUser?.username ?? 'system',
      } as any);
    } catch {
      result = { ok: false, error: 'koneksi terputus. Isian masih ada - coba simpan lagi.' };
    }
    if (!result.ok) { notify('error', 'Gagal menyimpan: ' + result.error); setSaving(false); return; }
    hapusDraf();
    if (isAdmin && teamEntries.length) {
      const clean = teamEntries.filter(e => e.project_name.trim()).map(({ _key, ...rest }) => ({ ...rest, report_date: formDate, source: 'manual' as const }));
      if (clean.length) await saveTeamEntries(clean as any, formDate, currentUser?.username ?? '');
    }
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: editingId ? 'update' : 'create', module: 'daily-report', target_id: editingId ?? formDate, target_name: `Report ${targetUser?.full_name} - ${formDate}` });
    notify('success', editingId ? 'Report diperbarui!' : 'Report berhasil disimpan!');
    setSaving(false); setFormOpen(false); setEditingId(null);
    loadReports(); loadLiveData();
  };

  const updM = (key: string, p: Partial<ManualActivity>) => setManualActs(prev => prev.map(m => m._key === key ? { ...m, ...p } : m));
  const updT = (key: string, p: Partial<TeamEntry>) => setTeamEntries(prev => prev.map(e => e._key === key ? { ...e, ...p } : e));

  if (!appReady) return <LoadingScreen />;

  const susunDenganAI = async () => {
    setMenyusun(true); setGalatSusun('');
    try {
      const r = await fetch('/api/asisten/draf-daily-report', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: formDate, jadwal: formReminders, tiket: formTickets, manual: manualActs }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.alasan ?? 'Gagal menyusun draf.');
      setReminderNotes(prev => (prev.trim() ? `${prev.trim()}\n\n${j.draf}` : j.draf));
    } catch (e) {
      setGalatSusun((e as Error).message);
    } finally {
      setMenyusun(false);
    }
  };

  const FormModal = () => {
    if (!formOpen) return null;
    const targetUser = isAdmin ? teamUsers.find(u => u.id === formUserId) : currentUser;
    const autoCount = formReminders.length + formTickets.length;
    return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', paddingTop: '20px', paddingBottom: '40px' }}>
        <div className="w-full max-w-2xl mx-4" style={{ ...card, overflow: 'visible' }}>
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">{editingId ? '✏️ Edit Report' : '📋 Buat Daily Report'}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {formLoading ? 'Memuat aktivitas...' : autoCount > 0 ? `${formReminders.length} reminder + ${formTickets.length} ticket ter-insert otomatis` : 'Isi form di bawah'}
              </p>
            </div>
            <button aria-label="Tutup" onClick={() => { hapusDraf(); setFormOpen(false); setEditingId(null); }} className="p-2 rounded-xl hover:bg-gray-100 transition-all text-slate-500">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>

            {/* Identitas */}
            <div className="grid gap-3" style={{ gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr' }}>
              <FormField label="Tanggal *">
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={inpCls} style={inp} />
              </FormField>
              {isAdmin && (
                <FormField label="Anggota Team *">
                  <select aria-label="-- Pilih anggota --" value={formUserId} onChange={e => setFormUserId(e.target.value)} className={inpCls} style={inp}>
                    <option value="">-- Pilih anggota --</option>
                    {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </FormField>
              )}
            </div>
            {targetUser && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: avc(targetUser.full_name) }}>{ini(targetUser.full_name)}</div>
                <div><p className="text-sm font-bold text-slate-800">{targetUser.full_name}</p><p className="text-xs text-slate-500">{targetUser.team_type} · {targetUser.sales_division || '-'}</p></div>
              </div>
            )}

            {/* Auto: Reminder + Ticket — info ringkas saja */}
            {(formReminders.length > 0 || formTickets.length > 0 || formLoading) && (
              <div className="px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)' }}>
                {formLoading
                  ? <><div className="w-4 h-4 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin flex-shrink-0" /><span className="text-xs text-sky-700 font-semibold">Memuat aktivitas otomatis...</span></>
                  : <><span className="text-base"><Ikon nama="🔔" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-xs text-sky-700 font-semibold">{formReminders.length} reminder &amp; {formTickets.length} ticket ter-insert otomatis dari platform</span><span className="ml-auto text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(14,165,233,0.12)', color: '#0ea5e9' }}>Auto-insert</span></>
                }
              </div>
            )}

            {/* Manual activities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest"><IkonTeks nama="✍" />Aktivitas Manual ({manualActs.length})</span>
              </div>
              <div className="space-y-4">
                {manualActs.map((m, idx) => (
                  <div key={m._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <SectionHeaderSmall icon="📌" title={`Aktivitas #${idx + 1}`} />
                      {manualActs.length > 1 && <button onClick={() => setManualActs(p => p.filter(x => x._key !== m._key))} className="text-xs text-red-600 hover:text-red-700">Hapus</button>}
                    </div>
                    <div><label className="block text-xs font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Kategori</label><CatPicker value={m.category} onChange={v => updM(m._key, { category: v })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Nama Project *"><input value={m.project_name} onChange={e => updM(m._key, { project_name: e.target.value })} className={inpCls} style={inp} placeholder="Project / kegiatan" /></FormField>
                      <FormField label="Lokasi"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /></span><input value={m.address} onChange={e => updM(m._key, { address: e.target.value })} className={`${inpCls} pl-9`} style={inp} placeholder="Alamat / Online" /></div></FormField>
                    </div>
                    <FormField label="Sales"><SalesDrop value={m.sales_name} division={m.sales_division} guests={guestUsers} onChange={(n, d) => updM(m._key, { sales_name: n, sales_division: d })} /></FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="PIC"><input value={m.pic_name} onChange={e => updM(m._key, { pic_name: e.target.value })} className={inpCls} style={inp} placeholder="Nama PIC" /></FormField>
                      <FormField label="No. PIC"><input type="tel" value={m.pic_phone} onChange={e => updM(m._key, { pic_phone: e.target.value })} className={inpCls} style={inp} placeholder="08xxx" /></FormField>
                    </div>
                    <FormField label="Deskripsi"><textarea value={m.description} onChange={e => updM(m._key, { description: e.target.value })} rows={2} className={`${inpCls} resize-none`} style={inp} placeholder="Detail kegiatan..." /></FormField>
                  </div>
                ))}
                <button onClick={() => setManualActs(p => [...p, emptyManual(currentUser?.username ?? '')])}
                  className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: 'rgba(220,38,38,0.05)', color: '#dc2626', border: '1.5px dashed rgba(220,38,38,0.3)' }}>
                  + Tambah Aktivitas Manual
                </button>
              </div>
            </div>

            {/* Ringkasan hari ini - boleh disusun AI dari aktivitas di atas */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest"><IkonTeks nama="📝" />Ringkasan hari ini</span>
                <button type="button" onClick={susunDenganAI} disabled={menyusun || formLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60"
                  style={{ background: '#1d4ed8' }}>
                  {menyusun ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Ikon nama="✨" ukuran={14} />}
                  {menyusun ? 'Menyusun...' : 'Susun dengan AI'}
                </button>
              </div>
              <textarea value={reminderNotes} onChange={e => setReminderNotes(e.target.value)} rows={4}
                className={`${inpCls} resize-y`} style={inp}
                placeholder="Ringkasan pekerjaan, hasil, dan kendala hari ini. Klik 'Susun dengan AI' untuk membuat draf dari aktivitas di atas." />
              {galatSusun
                ? <p className="text-xs font-semibold text-rose-700 mt-1">{galatSusun}</p>
                : <p className="text-[11px] text-slate-500 mt-1">Draf AI hanya merangkum aktivitas di atas. Periksa dan ubah bila perlu sebelum menyimpan.</p>}
            </div>

            {/* Team Entries (admin) */}
            {isAdmin && teamEntries.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-widest"><IkonTeks nama="👥" />Input Tim (Supervisor)</span>
                </div>
                <div className="space-y-4">
                  {teamEntries.map(e => (
                    <div key={e._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: avc(e.member_name) }}>{ini(e.member_name)}</div>
                        <p className="text-sm font-bold text-slate-700">{e.member_name}</p>
                      </div>
                      <CatPicker value={e.category} onChange={v => updT(e._key, { category: v })} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Project"><input value={e.project_name} onChange={ev => updT(e._key, { project_name: ev.target.value })} className={inpCls} style={inp} placeholder="Nama project" /></FormField>
                        <FormField label="Lokasi"><input value={e.address} onChange={ev => updT(e._key, { address: ev.target.value })} className={inpCls} style={inp} placeholder="Alamat" /></FormField>
                      </div>
                      <FormField label="Sales"><SalesDrop value={e.sales_name} division={e.sales_division} guests={guestUsers} onChange={(n, d) => updT(e._key, { sales_name: n, sales_division: d })} /></FormField>
                      <FormField label="Catatan"><textarea value={e.supervisor_notes} onChange={ev => updT(e._key, { supervisor_notes: ev.target.value })} rows={2} className={`${inpCls} resize-none`} style={inp} placeholder="Catatan supervisor..." /></FormField>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save */}
            <div className="flex gap-3 pt-2 pb-2">
              <button onClick={() => { hapusDraf(); setFormOpen(false); setEditingId(null); }} className="flex-1 py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editingId ? 'Simpan Perubahan' : '📋 Simpan Report'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
    );
  };

  // DETAIL MODAL (popup persis reminder-schedule)
  const DetailModal = () => {
    if (!modalRow) return null;
    const row: FlatRow = modalRow;
    const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
    const badge = sb(row.status);
    const linkedReport = row.report_id ? reports.find(r => r.id === row.report_id) : undefined;
    return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={() => setModalRow(null)}>
        <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: 'white', maxHeight: '96vh' }} onClick={e => e.stopPropagation()}>
          {/* Colored header */}
          <div className="px-6 py-5 text-white flex-shrink-0 relative" style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{row.kegiatan_icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mb-0.5">Sumber</p>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                  {row.source === 'reminder' ? 'Reminder Schedule' : row.source === 'ticket' ? 'Ticket Troubleshooting' : 'Aktivitas Manual'}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mt-2 mb-0.5">Nama Project</p>
                <h3 className="text-base font-black leading-tight">{row.project_name}</h3>
                {row.address && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mt-1.5 mb-0.5">Lokasi</p>
                    <p className="text-xs opacity-80 flex items-center gap-1"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.address}</p>
                  </>
                )}
              </div>
            </div>
            {/* Status + jam */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20">{badge.label}</span>
              {row.jam !== '-' && <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20"><Ikon nama="🕐" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.jam}</span>}
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.report_date}</span>
            </div>
            <button aria-label="Tutup" onClick={() => setModalRow(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
          </div>
          {/* Body */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Kategori */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Kategori</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                  <Ikon nama={c.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {row.category}
                </span>
              </div>
              {/* Product */}
              {row.product && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Product</p>
                  <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1.5 rounded-lg inline-block">{row.product}</span>
                </div>
              )}
              {/* Handler */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Handler</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: avc(row.handler_name) }}>{ini(row.handler_name)}</div>
                  <div><p className="text-xs font-bold text-slate-800">{row.handler_name}</p>{row.handler_username && <p className="text-[11px] text-slate-500"><Username value={row.handler_username} /></p>}</div>
                </div>
              </div>
              {/* Sales */}
              {row.sales_name && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sales</p>
                  <p className="text-xs font-bold text-slate-800">{row.sales_name}</p>
                  {row.sales_division && <p className="text-[11px] text-slate-500">{row.sales_division}</p>}
                </div>
              )}
            </div>
            {/* Ringkasan hari dari laporan induknya (bila diisi) */}
            {(() => {
              const ringkas = reports.find(r => r.id === row.report_id)?.reminder_notes?.trim();
              return ringkas ? (
                <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">Ringkasan hari ini</p>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{ringkas}</p>
                </div>
              ) : null;
            })()}
            {/* Ticket detail */}
            {row.source === 'ticket' && row.raw?.action_taken && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(251,113,133,0.05)', border: '1px solid rgba(251,113,133,0.2)' }}>
                <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-1">Tindakan</p>
                <p className="text-xs text-slate-700">{row.raw.action_taken}</p>
              </div>
            )}
            {/* Reminder detail */}
            {row.source === 'reminder' && row.raw?.description && (
              <div className="px-4 py-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: c.color }}>Deskripsi</p>
                <p className="text-xs" style={{ color: c.color }}>{row.raw.description}</p>
              </div>
            )}
            {/* Manual detail */}
            {row.source === 'manual' && row.raw?.description && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Deskripsi</p>
                <p className="text-xs text-slate-700">{row.raw.description}</p>
              </div>
            )}
            {/* PIC */}
            {row.raw?.pic_name && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <span className="text-base"><Ikon nama="🙋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div><p className="text-xs font-bold text-slate-800">{row.raw.pic_name}</p>{row.raw.pic_phone && <p className="text-[11px] text-slate-500"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.raw.pic_phone}</p>}</div>
              </div>
            )}
            {/* Link to submitted report */}
            {linkedReport && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <span className="text-sm"><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <p className="text-xs text-red-600 font-semibold">Sudah di-submit dalam Daily Report {formatDate(linkedReport.report_date)}</p>
                {!pimpinan && <button onClick={() => { setModalRow(null); openEditForm(linkedReport); }} className="ml-auto text-[11px] font-bold px-2 py-1 rounded-lg text-white" style={{ background: '#dc2626' }}>Edit</button>}
              </div>
            )}
            {/* Source badge */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-full"
                style={row.source === 'reminder' ? { background: 'rgba(16,185,129,0.1)', color: '#047857' } : row.source === 'ticket' ? { background: 'rgba(251,113,133,0.1)', color: '#be185d' } : { background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>
                {row.source === 'reminder' ? '🔔 Reminder Schedule' : row.source === 'ticket' ? '🎫 Ticket Troubleshooting' : '✍️ Aktivitas Manual'}
              </span>
              {!linkedReport && row.source !== 'manual' && (
                <button onClick={() => { setModalRow(null); openNewForm(); }} className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>+ Buat Report</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
    );
  };

  // MAIN LIST VIEW
  return (
    <PW>
      <PageHeader icon="📋" title="Daily Report" subtitle="PTS IVP & MVI" color="#059669" colorLight="#047857">
        {!pimpinan && (
          <button onClick={openNewForm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm text-white hover:scale-[1.02] transition-all"
            style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 4px 14px rgba(5,150,105,0.4)' }}>
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            + Tambah Report
          </button>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto px-5 py-5 space-y-5 pb-12 w-full">

        {/* ── Stat cards besar (identik reminder-schedule) ── */}
        <StatCardGrid cols={4} items={[
          { label: 'Total Aktivitas', sub: 'Semua platform', value: stats.total, accent: '#4f46e5' },
          { label: 'Pending', sub: 'Menunggu tindakan', value: stats.pending, accent: '#b45309' },
          { label: 'Selesai', sub: 'Terselesaikan', value: stats.selesai, accent: '#047857' },
          { label: 'Hari Ini', sub: todayISO(), value: stats.hariIni, accent: '#0e7490' },
        ]} />

        {/* M7: siapa yang belum lapor hari ini - hanya untuk admin/supervisor */}
        {belumLaporHariIni.length > 0 && (
          // Latar SEBELUMNYA rgba(220,38,38,0.06) - opasitas 6% - hampir
          // tembus pandang. Halaman ini punya foto latar tetap
          // (backgroundAttachment: fixed di PW di atas), jadi panel ini
          // dulu nyaris hanya berupa teks merah tua mengambang langsung di
          // atas foto gedung, tanpa kartu solid di belakangnya - persis
          // yang bikin tulisan "sangat transparan"/susah dibaca. Kartu lain
          // di halaman ini (mis. strip "Sumber Data" di bawah) sudah pakai
          // latar putih ~92% + backdrop-blur; panel ini disamakan, dengan
          // aksen merah tetap dipertahankan di border supaya nuansa
          // "peringatan"-nya tidak hilang.
          <div className="rounded-2xl px-5 py-3.5 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(220,38,38,0.25)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#b91c1c' }}>
              🔴 Belum Lapor Hari Ini ({belumLaporHariIni.length})
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {belumLaporHariIni.map(u => (
                <span key={u.id} className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: 'rgba(220,38,38,0.1)', color: '#991b1b' }}>
                  {u.full_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Source breakdown strip ── */}
        <div className="rounded-2xl px-5 py-3.5 flex items-center gap-6 flex-wrap" style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Sumber Data</span>
          {([
            { label: 'Ticketing', value: stats.fromTicket,   icon: '🎫', bg: 'rgba(251,113,133,0.12)', color: '#be185d',  source: 'ticket' },
            { label: 'Schedule',  value: stats.fromReminder, icon: '🔔', bg: 'rgba(16,185,129,0.1)',   color: '#047857',  source: 'reminder' },
            { label: 'Manual',    value: stats.fromManual,   icon: '✍️', bg: 'rgba(245,158,11,0.1)',   color: '#b45309',  source: 'manual' },
          ] as const).map(s => (
            <button key={s.source}
              onClick={() => setFilterSource(filterSource === s.source ? '' : s.source)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.03]"
              style={{ background: filterSource === s.source ? s.bg : 'rgba(0,0,0,0.03)', color: filterSource === s.source ? s.color : '#64748b', border: filterSource === s.source ? `1.5px solid ${s.color}40` : '1.5px solid transparent' }}>
              <span><Ikon nama={s.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
              <span>{s.label}</span>
              <span className="ml-1 font-black text-sm" style={{ color: s.color }}>{s.value}</span>
              {filterSource === s.source && <span className="text-[10px] ml-0.5">✕</span>}
            </button>
          ))}
          {filterSource && (
            <span className="text-[11px] text-slate-500 italic ml-auto">Klik badge untuk reset filter</span>
          )}
        </div>

        {/* ── Charts row ── */}
        {/* Satu-satunya grafik di platform ini yang dulu memakai grid-cols-4
            tanpa titik henti - semua halaman lain sudah grid-cols-1 md:...
            Di ponsel itu berarti empat kolom selebar ~80px, dan di situlah
            legendanya terhimpit habis. */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <MiniPieChart
            data={catPieData} title="Kegiatan / Kategori" icon="🖥️"
            activeFilter={filterCategory}
            onSliceClick={label => setFilterCategory(filterCategory === label ? null : label)}
          />
          <MiniPieChart
            data={handlerPieData} title={judulKelompokPTS} icon="👥"
            activeFilter={filterHandler}
            onSliceClick={label => setFilterHandler(filterHandler === label ? null : label)}
          />
          <MiniPieChart
            data={divisionPieData} title="Divisi Sales" icon="👔"
            activeFilter={filterDivision}
            onSliceClick={label => setFilterDivision(filterDivision === label ? null : label)}
          />
          <MiniPieChart
            data={productPieData} title="Distribusi Produk" icon="🏷️"
            activeFilter={filterProduct}
            onSliceClick={label => setFilterProduct(filterProduct === label ? null : label)}
          />
        </div>

        {/* ── Schedule/Activity List ── */}
        <div style={card}>
          <div style={cardHdr}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Activity List</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{filteredRows.length}</span>
              {liveLoading && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
            </div>
            <button onClick={() => { loadLiveData(); loadReports(); }} disabled={liveLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-slate-100 disabled:opacity-50"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', color: '#475569' }}>
              <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          {/* Active filter chips from pie charts */}
          {(filterCategory || filterHandler || filterDivision || filterProduct) && (
            <div className="px-5 pt-3 flex flex-wrap gap-2">
              {filterCategory && (
                <button onClick={() => setFilterCategory(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#7c3aed' }}>
                  <Ikon nama="🏷" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterCategory} ✕
                </button>
              )}
              {filterHandler && (
                <button onClick={() => setFilterHandler(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#0ea5e9' }}>
                  <Ikon nama="👥" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterHandler} ✕
                </button>
              )}
              {filterDivision && (
                <button onClick={() => setFilterDivision(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#10b981' }}>
                  <Ikon nama="👔" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterDivision} ✕
                </button>
              )}
              {filterProduct && (
                <button onClick={() => setFilterProduct(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#f59e0b' }}>
                  <Ikon nama="🏷" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterProduct} ✕
                </button>
              )}
            </div>
          )}

          {/* Search + filter bar identik reminder-schedule */}
          <FilterLaporanHarian
            filterDate={filterDate} filterSource={filterSource} filterStatus={filterStatus} filterUser={filterUser} lihatSemua={lihatSemua} searchProject={searchProject} setFilterDate={setFilterDate} setFilterSource={setFilterSource} setFilterStatus={setFilterStatus} setFilterUser={setFilterUser} setSearchProject={setSearchProject} teamUsers={teamUsers}
          />
          {!filterDate && (
            <p className="text-[11.5px] text-slate-500 -mt-1 mb-2">
              Menampilkan {RENTANG_HARI} hari terakhir. Pilih tanggal untuk melihat hari yang lebih lama.
            </p>
          )}

          {/* Table */}
          <DaftarLaporanHarian
            bolehHapus={bolehHapus} filterCategory={filterCategory} filterDate={filterDate} filterSource={filterSource} filterStatus={filterStatus} filterUser={filterUser} filteredRows={filteredRows} hal={hal} liveLoading={liveLoading} mintaHapus={mintaHapus} openEditForm={openEditForm} pimpinan={pimpinan} reports={reports} searchProject={searchProject} setFilterCategory={setFilterCategory} setFilterDate={setFilterDate} setFilterSource={setFilterSource} setFilterStatus={setFilterStatus} setFilterUser={setFilterUser} setModalRow={setModalRow} setSearchProject={setSearchProject}
          />
        </div>
      </div>

      {/*  Dipanggil sebagai FUNGSI biasa ({FormModal()}), BUKAN elemen JSX
          (<FormModal />) - FormModal/DetailModal didefinisikan ulang di
          setiap render DailyReportPage (identitas fungsinya berubah tiap
          kali), jadi <FormModal /> membuat React melihat "tipe komponen
          baru" pada SETIAP keystroke di input mana pun di dalam modal
          (typing memanggil setState di parent -> re-render -> FormModal
          didefinisikan ulang). React lalu meng-unmount seluruh pohon modal
          lama dan mount ulang yang baru - input kehilangan fokus persis
          sebelum karakternya sempat kelihatan, terasa seperti modal
          tertutup/mundur sendiri padahal cuma mengetik satu huruf.
          Memanggilnya sebagai fungsi membuat JSX yang dikembalikan menyatu
          langsung ke pohon render DailyReportPage - React membandingkan
          elemen DOM sebenarnya (ModalPortal, div, input, ...) yang
          tipenya stabil antar render, bukan identitas FormModal. */}
      {FormModal()}
      {DetailModal()}
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <Toast t={toast} />
    </PW>
  );
}
