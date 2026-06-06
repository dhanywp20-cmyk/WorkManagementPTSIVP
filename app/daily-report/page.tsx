'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { setSession, clearSession, getSession } from '@/lib/auth';

import {
  CATEGORIES, CATEGORY_CONFIG,
  formatDate,
  type TeamUser, type GuestUser,
} from '@/app/reminder-schedule/_components/shared';

import {
  todayISO, formatLogTime,
  fetchAllReminders, fetchAllTickets,
  fetchReminderActivities, fetchTicketActivities,
  fetchExistingReport, fetchReports,
  saveReport, saveTeamEntries,
  type ReminderActivity, type TicketActivity,
  type ManualActivity, type TeamEntry,
  type DailyReport,
} from './_components/shared';

import {
  FormField, SectionHeaderSmall, LoadingScreen,
} from '@/components/shared';
import { MiniPieChart } from '@/components/shared';

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(0,0,0,0.12)',
  borderRadius: '12px', color: '#1e293b', fontSize: '14px',
  padding: '10px 14px', width: '100%', outline: 'none',
};
const inpCls = 'transition-all focus:ring-2 focus:ring-red-300';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.97)', borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.8)',
  overflow: 'hidden',
};
const cardHdr: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left' as const, fontSize: '11px',
  fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const,
  letterSpacing: '0.06em', whiteSpace: 'nowrap' as const,
  background: 'rgba(248,250,252,0.97)', borderBottom: '2px solid rgba(0,0,0,0.07)',
  borderRight: '1px solid rgba(0,0,0,0.06)',
};
const TD: React.CSSProperties = {
  padding: '11px 14px', fontSize: '13px', color: '#1e293b',
  verticalAlign: 'middle' as const, borderBottom: '1px solid rgba(0,0,0,0.04)',
  borderRight: '1px solid rgba(0,0,0,0.04)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SB: Record<string, { label: string; bg: string; color: string; border: string }> = {
  done:          { label: 'Selesai',  bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  completed:     { label: 'Selesai',  bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  pending:       { label: 'Pending',  bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  cancelled:     { label: 'Batal',    bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
  'in progress': { label: 'Proses',   bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' },
  manual:        { label: 'Manual',   bg: '#fef3c7', color: '#b45309', border: '#f59e0b' },
};
const sb = (s: string) => SB[s?.toLowerCase()] ?? { label: s || '-', bg: '#f3f4f6', color: '#374151', border: '#6b7280' };

const AVC = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#e11d48','#6366f1','#0d9488','#db2777'];
const avc = (n: string) => AVC[(n?.charCodeAt(0) ?? 0) % AVC.length];
const ini = (n: string) => (n || 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

function newManualKey() { return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function newTeamKey()   { return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function emptyManual(u = ''): ManualActivity {
  return { _key: newManualKey(), category: 'Internal', project_name: '', address: '', description: '', sales_name: '', sales_division: '', pic_name: '', pic_phone: '', submitted_by: u };
}
function emptyTeamEntry(m: TeamUser): TeamEntry {
  return { _key: newTeamKey(), member_user_id: m.id, member_name: m.full_name, category: 'Internal', project_name: '', address: '', sales_name: '', sales_division: m.sales_division ?? '', supervisor_notes: '' };
}

// ─── PageWrapper ──────────────────────────────────────────────────────────────
function PW({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>

      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ─── Category picker ──────────────────────────────────────────────────────────
function CatPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map(cat => {
        const c = CATEGORY_CONFIG[cat]; const sel = value === cat;
        return (
          <button key={cat} type="button" onClick={() => onChange(cat)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all"
            style={sel ? { borderColor: c.accent, background: c.bg, color: c.color } : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
            <span className="text-lg">{c.icon}</span>
            <span className="text-xs font-bold leading-tight flex-1">{cat}</span>
            {sel && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sales Dropdown ───────────────────────────────────────────────────────────
function SalesDrop({ value, division, guests, onChange }: { value: string; division: string; guests: GuestUser[]; onChange: (n: string, d: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const fil = guests.filter(u => !q.trim() || u.full_name.toLowerCase().includes(q.toLowerCase()) || (u.sales_division ?? '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative">
      <div className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between cursor-pointer"
        style={{ ...inp, borderColor: open ? 'rgba(220,38,38,0.5)' : 'rgba(0,0,0,0.12)' }}
        onClick={() => { setOpen(o => !o); if (!open) setQ(''); }}>
        {value ? <span className="font-semibold text-slate-800">{value}{division && <span className="font-normal text-red-400"> · {division}</span>}</span> : <span className="text-slate-400">-- Pilih Sales --</span>}
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      {open && (
        <>
          <div className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden" style={{ background: 'white', border: '1.5px solid rgba(220,38,38,0.25)', maxHeight: '240px' }}>
            <div className="p-2 border-b" style={{ borderColor: 'rgba(220,38,38,0.1)' }}>
              <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari sales..." onClick={e => e.stopPropagation()}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', color: '#1e293b' }} />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
              <div className="px-4 py-2.5 text-sm cursor-pointer hover:bg-red-50 text-slate-400 italic" onClick={() => { onChange('', ''); setOpen(false); }}>-- Kosongkan --</div>
              {fil.map(u => (
                <div key={u.id} className="px-4 py-2.5 cursor-pointer flex items-center justify-between"
                  style={{ background: value === u.full_name ? 'rgba(220,38,38,0.07)' : undefined, borderLeft: value === u.full_name ? '3px solid #dc2626' : '3px solid transparent' }}
                  onClick={() => { onChange(u.full_name, u.sales_division ?? ''); setOpen(false); setQ(''); }}>
                  <div><p className="text-sm font-semibold text-slate-800">{u.full_name}</p><p className="text-xs text-red-400">{u.sales_division}</p></div>
                  {value === u.full_name && <span className="text-red-500 text-xs">✓</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQ(''); }} />
        </>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ t }: { t: { type: 'success' | 'error'; msg: string } | null }) {
  if (!t) return null;
  return (
    <div className="fixed top-5 right-5 z-[300] px-5 py-3.5 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 text-white"
      style={{ background: t.type === 'success' ? '#059669' : '#dc2626' }}>
      {t.type === 'success' ? '✅' : '❌'} {t.msg}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DailyReportPage() {
  const [appReady, setAppReady]       = useState(false);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [loginForm, setLoginForm]     = useState({ username: '', password: '' });
  const [loginErr, setLoginErr]       = useState('');
  const [currentUser, setCurrentUser] = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]     = useState<TeamUser[]>([]);
  const [guestUsers, setGuestUsers]   = useState<GuestUser[]>([]);

  // ── Live data (dari reminder + ticket platform, tanpa perlu submit dulu) ──────
  const [liveReminders, setLiveReminders] = useState<(ReminderActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveTickets, setLiveTickets]     = useState<(TicketActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveLoading, setLiveLoading]     = useState(false);

  // ── Submitted reports ─────────────────────────────────────────────────────────
  const [reports, setReports]         = useState<DailyReport[]>([]);

  // ── Filter ────────────────────────────────────────────────────────────────────
  const [filterDate, setFilterDate]   = useState('');
  const [filterUser, setFilterUser]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterHandler, setFilterHandler]   = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string | null>(null);
  const [filterProduct, setFilterProduct]   = useState<string | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [formDate, setFormDate]       = useState(todayISO());
  const [formUserId, setFormUserId]   = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [formReminders, setFormReminders] = useState<ReminderActivity[]>([]);
  const [formTickets, setFormTickets]     = useState<TicketActivity[]>([]);
  const [manualActs, setManualActs]       = useState<ManualActivity[]>([]);
  const [teamEntries, setTeamEntries]     = useState<TeamEntry[]>([]);
  const [formLoading, setFormLoading]     = useState(false);
  const [saving, setSaving]               = useState(false);

  // ── Modal detail ──────────────────────────────────────────────────────────────
  const [modalRow, setModalRow]       = useState<any | null>(null);

  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // ── Init ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const user = getSession<TeamUser>();
    if (user) { setCurrentUser(user); setIsLoggedIn(true); }
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

  const loadTeamUsers = async () => {
    const { data } = await supabase.from('users').select('id,username,full_name,role,team_type,phone_number,sales_division,allowed_menus').order('full_name');
    if (data) setTeamUsers(data.filter((u: TeamUser) => u.team_type === 'Team PTS'));
  };
  const loadGuestUsers = async () => {
    const { data } = await supabase.from('users').select('id,username,full_name,role,phone_number,sales_division').eq('role', 'guest').order('full_name');
    if (data) setGuestUsers(data as GuestUser[]);
  };

  // ── Load live data dari kedua platform ───────────────────────────────────────
  const loadLiveData = useCallback(async () => {
    if (!currentUser) return;
    setLiveLoading(true);
    try {
      const usernames = isAdmin
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
    } catch (e) { console.error('loadLiveData error:', e); }
    setLiveLoading(false);
  }, [currentUser, isAdmin, teamUsers, filterDate, filterUser]);

  // ── Load submitted reports ────────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await fetchReports({ date: filterDate || undefined, userId: filterUser || undefined, isAdmin, currentUserId: currentUser.id });
      setReports(data);
    } catch (e) { console.error('loadReports error:', e); }
  }, [currentUser, filterDate, filterUser, isAdmin]);

  useEffect(() => {
    if (!currentUser) return;
    // Untuk admin: tunggu teamUsers selesai load dulu (hindari fetch dengan usernames=[])
    if (isAdmin && teamUsers.length === 0) return;
    loadLiveData();
    loadReports();
  }, [currentUser, isAdmin, teamUsers, filterDate, filterUser]);

  // ── Build flat rows: gabung live data + manual dari submitted reports ──────────
  interface FlatRow {
    id: string;
    source: 'reminder' | 'ticket' | 'manual';
    report_date: string;
    project_name: string;
    address: string;
    product: string;
    category: string;
    kegiatan_icon: string;
    kegiatan_label: string;
    sales_name: string;
    sales_division: string;
    handler_name: string;
    handler_username: string;
    status: string;
    jam: string;
    report_id?: string;
    raw?: any;
  }

  const allRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];

    // ── Build ticket key set untuk deduplication ──────────────────────────────
    // Key format: `${project_name_lower}|${handler_username_lower}|${date}`
    // Reminder Troubleshooting yang sudah ada tiketnya di platform ticketing tidak
    // ditampilkan duplikat — ticket lebih prioritas karena lebih lengkap (action_taken, status aktual)
    const ticketKeySet = new Set<string>(
      liveTickets.map(t => {
        const hu = ((t as any).handler_username ?? '').toLowerCase();
        const rd = ((t as any).report_date ?? '').split('T')[0];
        return `${(t.project_name ?? '').trim().toLowerCase()}|${hu}|${rd}`;
      })
    );

    // Reminder — langsung dari platform, tanpa perlu submit
    liveReminders.forEach(r => {
      const hr = (r as any).handler_username ?? '';
      const tu = teamUsers.find(u => u.username === hr);
      const rd = ((r as any).report_date ?? '').split('T')[0];

      // Jika reminder kategori Troubleshooting DAN sudah ada ticket yang matching
      // (project_name + handler + tanggal sama) → skip untuk hindari duplicate
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

    // Ticket — langsung dari platform
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

    // Manual — dari submitted daily_reports saja
    reports.forEach(r => {
      r.manual_activities.forEach((m, idx) => {
        const tu = teamUsers.find(u => u.id === r.user_id);
        rows.push({
          id: `man_${r.id}_${idx}`,
          source: 'manual',
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

  // ── Stats ─────────────────────────────────────────────────────────────────────
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

  // ── Form helpers ──────────────────────────────────────────────────────────────
  const openNewForm = async () => {
    const date = todayISO();
    setFormDate(date); setFormUserId(isAdmin ? '' : currentUser?.id ?? '');
    setReminderNotes(''); setManualActs([emptyManual(currentUser?.username ?? '')]);
    setEditingId(null); setFormReminders([]); setFormTickets([]);
    if (isAdmin) setTeamEntries(teamUsers.map(u => emptyTeamEntry(u)));
    else setTeamEntries([]);
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
    const result = await saveReport({
      ...(editingId ? { id: editingId } : {}),
      report_date: formDate, user_id: targetUserId, user_name: targetUser?.full_name ?? '',
      sales_division: targetUser?.sales_division ?? '',
      reminder_activities: formReminders, ticket_activities: formTickets,
      manual_activities: cleanManual, reminder_notes: reminderNotes,
      created_by: currentUser?.username ?? 'system',
    } as any);
    if (!result.ok) { notify('error', 'Gagal menyimpan: ' + result.error); setSaving(false); return; }
    if (isAdmin && teamEntries.length) {
      const clean = teamEntries.filter(e => e.project_name.trim()).map(({ _key, ...rest }) => ({ ...rest, report_date: formDate, source: 'manual' as const }));
      if (clean.length) await saveTeamEntries(clean as any, formDate, currentUser?.username ?? '');
    }
    notify('success', editingId ? 'Report diperbarui!' : 'Report berhasil disimpan!');
    setSaving(false); setFormOpen(false); setEditingId(null);
    loadReports(); loadLiveData();
  };

  const updM = (key: string, p: Partial<ManualActivity>) => setManualActs(prev => prev.map(m => m._key === key ? { ...m, ...p } : m));
  const updT = (key: string, p: Partial<TeamEntry>) => setTeamEntries(prev => prev.map(e => e._key === key ? { ...e, ...p } : e));

  if (!appReady) return <LoadingScreen />;

  // ── LOGIN ─────────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <PW>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm border border-white/20 shadow-2xl">
            <div className="text-center mb-6"><span className="text-4xl">📋</span><h1 className="text-xl font-bold text-white mt-2">Daily Report</h1><p className="text-white/60 text-sm">PTS IVP &amp; MLDS</p></div>
            <div className="space-y-3">
              <input value={loginForm.username} onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))} placeholder="Username" className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
              <input type="password" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} onKeyDown={async e => { if (e.key === 'Enter') { setLoginErr(''); const { data } = await supabase.from('users').select('*').eq('username', loginForm.username.trim()).eq('password', loginForm.password).maybeSingle(); if (!data) { setLoginErr('Username atau password salah.'); return; } setSession(data); setCurrentUser(data); setIsLoggedIn(true); } }} placeholder="Password" className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
              {loginErr && <p className="text-red-300 text-xs">{loginErr}</p>}
              <button onClick={async () => { setLoginErr(''); const { data } = await supabase.from('users').select('*').eq('username', loginForm.username.trim()).eq('password', loginForm.password).maybeSingle(); if (!data) { setLoginErr('Username atau password salah.'); return; } setSession(data); setCurrentUser(data); setIsLoggedIn(true); }} className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>Masuk</button>
            </div>
          </div>
        </div>
        <Toast t={toast} />
      </PW>
    );
  }

  // ── FORM MODAL ────────────────────────────────────────────────────────────────
  const FormModal = () => {
    if (!formOpen) return null;
    const targetUser = isAdmin ? teamUsers.find(u => u.id === formUserId) : currentUser;
    const autoCount = formReminders.length + formTickets.length;
    return (
      <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', paddingTop: '20px', paddingBottom: '40px' }}>
        <div className="w-full max-w-2xl mx-4" style={{ ...card, overflow: 'visible' }}>
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">{editingId ? '✏️ Edit Report' : '📋 Buat Daily Report'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {formLoading ? 'Memuat aktivitas...' : autoCount > 0 ? `${formReminders.length} reminder + ${formTickets.length} ticket ter-insert otomatis` : 'Isi form di bawah'}
              </p>
            </div>
            <button onClick={() => { setFormOpen(false); setEditingId(null); }} className="p-2 rounded-xl hover:bg-gray-100 transition-all text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                  <select value={formUserId} onChange={e => setFormUserId(e.target.value)} className={inpCls} style={inp}>
                    <option value="">-- Pilih anggota --</option>
                    {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </FormField>
              )}
            </div>
            {targetUser && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: avc(targetUser.full_name) }}>{ini(targetUser.full_name)}</div>
                <div><p className="text-sm font-bold text-slate-800">{targetUser.full_name}</p><p className="text-xs text-slate-400">{targetUser.team_type} · {targetUser.sales_division || '-'}</p></div>
              </div>
            )}

            {/* Auto: Reminder + Ticket — info ringkas saja */}
            {(formReminders.length > 0 || formTickets.length > 0 || formLoading) && (
              <div className="px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)' }}>
                {formLoading
                  ? <><div className="w-4 h-4 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin flex-shrink-0" /><span className="text-xs text-sky-600 font-semibold">Memuat aktivitas otomatis...</span></>
                  : <><span className="text-base">🔔</span><span className="text-xs text-sky-700 font-semibold">{formReminders.length} reminder &amp; {formTickets.length} ticket ter-insert otomatis dari platform</span><span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(14,165,233,0.12)', color: '#0ea5e9' }}>Auto-insert</span></>
                }
              </div>
            )}

            {/* Manual activities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">✍️ Aktivitas Manual ({manualActs.length})</span>
              </div>
              <div className="space-y-4">
                {manualActs.map((m, idx) => (
                  <div key={m._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <SectionHeaderSmall icon="📌" title={`Aktivitas #${idx + 1}`} />
                      {manualActs.length > 1 && <button onClick={() => setManualActs(p => p.filter(x => x._key !== m._key))} className="text-xs text-red-400 hover:text-red-600">Hapus</button>}
                    </div>
                    <div><label className="block text-xs font-bold mb-1.5 text-slate-400 uppercase tracking-wider">Kategori</label><CatPicker value={m.category} onChange={v => updM(m._key, { category: v })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Nama Project *"><input value={m.project_name} onChange={e => updM(m._key, { project_name: e.target.value })} className={inpCls} style={inp} placeholder="Project / kegiatan" /></FormField>
                      <FormField label="Lokasi"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">📍</span><input value={m.address} onChange={e => updM(m._key, { address: e.target.value })} className={`${inpCls} pl-9`} style={inp} placeholder="Alamat / Online" /></div></FormField>
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

            {/* Team Entries (admin) */}
            {isAdmin && teamEntries.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">👥 Input Tim (Supervisor)</span>
                </div>
                <div className="space-y-4">
                  {teamEntries.map(e => (
                    <div key={e._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: avc(e.member_name) }}>{ini(e.member_name)}</div>
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
              <button onClick={() => { setFormOpen(false); setEditingId(null); }} className="flex-1 py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editingId ? 'Simpan Perubahan' : '📋 Simpan Report'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── DETAIL MODAL (popup persis reminder-schedule) ─────────────────────────────
  const DetailModal = () => {
    if (!modalRow) return null;
    const row: FlatRow = modalRow;
    const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
    const badge = sb(row.status);
    const linkedReport = row.report_id ? reports.find(r => r.id === row.report_id) : undefined;
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={() => setModalRow(null)}>
        <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'white' }} onClick={e => e.stopPropagation()}>
          {/* Colored header */}
          <div className="px-6 py-5 text-white relative" style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}>
            <button onClick={() => setModalRow(null)} className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-all">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{row.kegiatan_icon}</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                  {row.source === 'reminder' ? 'Reminder Schedule' : row.source === 'ticket' ? 'Ticket Troubleshooting' : 'Aktivitas Manual'}
                </p>
                <h3 className="text-base font-black mt-0.5 leading-tight">{row.project_name}</h3>
                {row.address && <p className="text-xs opacity-80 mt-1">📍 {row.address}</p>}
              </div>
            </div>
            {/* Status + jam */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20">{badge.label}</span>
              {row.jam !== '-' && <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20">🕐 {row.jam}</span>}
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20">📅 {row.report_date}</span>
            </div>
          </div>
          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Kategori */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kategori</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                  {c.icon} {row.category}
                </span>
              </div>
              {/* Product */}
              {row.product && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product</p>
                  <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1.5 rounded-lg inline-block">{row.product}</span>
                </div>
              )}
              {/* Handler */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Handler</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: avc(row.handler_name) }}>{ini(row.handler_name)}</div>
                  <div><p className="text-xs font-bold text-slate-800">{row.handler_name}</p>{row.handler_username && <p className="text-[10px] text-slate-400">@{row.handler_username}</p>}</div>
                </div>
              </div>
              {/* Sales */}
              {row.sales_name && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sales</p>
                  <p className="text-xs font-bold text-slate-800">{row.sales_name}</p>
                  {row.sales_division && <p className="text-[10px] text-slate-400">{row.sales_division}</p>}
                </div>
              )}
            </div>
            {/* Ticket detail */}
            {row.source === 'ticket' && row.raw?.action_taken && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(251,113,133,0.05)', border: '1px solid rgba(251,113,133,0.2)' }}>
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Tindakan</p>
                <p className="text-xs text-slate-700">{row.raw.action_taken}</p>
              </div>
            )}
            {/* Reminder detail */}
            {row.source === 'reminder' && row.raw?.description && (
              <div className="px-4 py-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: c.color }}>Deskripsi</p>
                <p className="text-xs" style={{ color: c.color }}>{row.raw.description}</p>
              </div>
            )}
            {/* Manual detail */}
            {row.source === 'manual' && row.raw?.description && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Deskripsi</p>
                <p className="text-xs text-slate-700">{row.raw.description}</p>
              </div>
            )}
            {/* PIC */}
            {row.raw?.pic_name && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <span className="text-base">🙋</span>
                <div><p className="text-xs font-bold text-slate-800">{row.raw.pic_name}</p>{row.raw.pic_phone && <p className="text-[10px] text-slate-400">📱 {row.raw.pic_phone}</p>}</div>
              </div>
            )}
            {/* Link to submitted report */}
            {linkedReport && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <span className="text-sm">📋</span>
                <p className="text-xs text-red-600 font-semibold">Sudah di-submit dalam Daily Report {formatDate(linkedReport.report_date)}</p>
                <button onClick={() => { setModalRow(null); openEditForm(linkedReport); }} className="ml-auto text-[10px] font-bold px-2 py-1 rounded-lg text-white" style={{ background: '#dc2626' }}>Edit</button>
              </div>
            )}
            {/* Source badge */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style={row.source === 'reminder' ? { background: 'rgba(16,185,129,0.1)', color: '#059669' } : row.source === 'ticket' ? { background: 'rgba(251,113,133,0.1)', color: '#be185d' } : { background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>
                {row.source === 'reminder' ? '🔔 Reminder Schedule' : row.source === 'ticket' ? '🎫 Ticket Troubleshooting' : '✍️ Aktivitas Manual'}
              </span>
              {!linkedReport && row.source !== 'manual' && (
                <button onClick={() => { setModalRow(null); openNewForm(); }} className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>+ Buat Report</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── MAIN LIST VIEW ────────────────────────────────────────────────────────────
  return (
    <PW>
      {/* ── Header identik reminder-schedule ── */}
      <div className="sticky top-0 z-30" style={{ background: 'rgba(255,255,255,0.97)', borderBottom: '1px solid rgba(220,38,38,0.12)', backdropFilter: 'blur(12px)', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl shadow-lg" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 12px rgba(220,38,38,0.35)' }}>📋</div>
            <div>
              <h1 className="text-base font-black tracking-wide" style={{ color: '#dc2626' }}>Daily Report</h1>
              <p className="text-[10px] font-semibold text-slate-400">PTS IVP &amp; MLDS</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openNewForm}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm text-white hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 14px rgba(220,38,38,0.4)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              + Tambah Report
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto px-5 py-5 space-y-5 pb-12 w-full">

        {/* ── Stat cards besar (identik reminder-schedule) ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Aktivitas', sub: 'Semua platform', value: stats.total, gradient: 'linear-gradient(135deg,#4f46e5,#6d28d9)', icon: '📋', shadow: 'rgba(79,70,229,0.45)' },
            { label: 'Pending', sub: 'Menunggu tindakan', value: stats.pending, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', icon: '⏳', shadow: 'rgba(245,158,11,0.45)' },
            { label: 'Selesai', sub: 'Terselesaikan', value: stats.selesai, gradient: 'linear-gradient(135deg,#10b981,#059669)', icon: '✅', shadow: 'rgba(16,185,129,0.45)' },
            { label: 'Hari Ini', sub: todayISO(), value: stats.hariIni, gradient: 'linear-gradient(135deg,#0891b2,#0e7490)', icon: '📅', shadow: 'rgba(8,145,178,0.45)' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5 relative overflow-hidden text-white" style={{ background: s.gradient, boxShadow: `0 6px 24px ${s.shadow}` }}>
              <div className="absolute right-4 top-3 text-5xl opacity-10 select-none">{s.icon}</div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{s.label}</p>
              <span className="text-4xl font-black leading-none">{s.value}</span>
              <p className="text-[10px] opacity-60 mt-2">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Source breakdown strip ── */}
        <div className="rounded-2xl px-5 py-3.5 flex items-center gap-6 flex-wrap" style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sumber Data</span>
          {([
            { label: 'Ticketing', value: stats.fromTicket,   icon: '🎫', bg: 'rgba(251,113,133,0.12)', color: '#be185d',  source: 'ticket' },
            { label: 'Schedule',  value: stats.fromReminder, icon: '🔔', bg: 'rgba(16,185,129,0.1)',   color: '#059669',  source: 'reminder' },
            { label: 'Manual',    value: stats.fromManual,   icon: '✍️', bg: 'rgba(245,158,11,0.1)',   color: '#b45309',  source: 'manual' },
          ] as const).map(s => (
            <button key={s.source}
              onClick={() => setFilterSource(filterSource === s.source ? '' : s.source)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.03]"
              style={{ background: filterSource === s.source ? s.bg : 'rgba(0,0,0,0.03)', color: filterSource === s.source ? s.color : '#64748b', border: filterSource === s.source ? `1.5px solid ${s.color}40` : '1.5px solid transparent' }}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
              <span className="ml-1 font-black text-sm" style={{ color: s.color }}>{s.value}</span>
              {filterSource === s.source && <span className="text-[9px] ml-0.5">✕</span>}
            </button>
          ))}
          {filterSource && (
            <span className="text-[10px] text-slate-400 italic ml-auto">Klik badge untuk reset filter</span>
          )}
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-4 gap-4">
          <MiniPieChart
            data={catPieData} title="Kegiatan / Kategori" icon="🖥️"
            activeFilter={filterCategory}
            onSliceClick={label => setFilterCategory(filterCategory === label ? null : label)}
          />
          <MiniPieChart
            data={handlerPieData} title="Team PTS" icon="👥"
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
              <svg className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
                  🏷️ {filterCategory} ✕
                </button>
              )}
              {filterHandler && (
                <button onClick={() => setFilterHandler(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#0ea5e9' }}>
                  👥 {filterHandler} ✕
                </button>
              )}
              {filterDivision && (
                <button onClick={() => setFilterDivision(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#10b981' }}>
                  👔 {filterDivision} ✕
                </button>
              )}
              {filterProduct && (
                <button onClick={() => setFilterProduct(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#f59e0b' }}>
                  🏷️ {filterProduct} ✕
                </button>
              )}
            </div>
          )}

          {/* Search + filter bar identik reminder-schedule */}
          <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[180px]" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)' }}>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={searchProject} onChange={e => setSearchProject(e.target.value)} placeholder="Cari project / lokasi..." className="bg-transparent outline-none text-xs text-slate-700 placeholder-slate-400 w-full" />
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', minWidth: '150px' }}>
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="bg-transparent outline-none text-xs text-slate-700 w-full">
                  <option value="">Team Handler</option>
                  {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', minWidth: '130px' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent outline-none text-xs text-slate-700 w-full">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Selesai</option>
                <option value="in progress">Proses</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', minWidth: '140px' }}>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="bg-transparent outline-none text-xs text-slate-700 w-full">
                <option value="">Semua Platform</option>
                <option value="ticket">🎫 Ticketing</option>
                <option value="reminder">🔔 Schedule</option>
                <option value="manual">✍️ Manual</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)' }}>
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-transparent outline-none text-xs text-slate-700" />
            </div>
            {(filterDate || filterUser || filterStatus || filterSource || searchProject) && (
              <button onClick={() => { setFilterDate(''); setFilterUser(''); setFilterStatus(''); setFilterSource(''); setSearchProject(''); }} className="px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-all">Reset</button>
            )}
          </div>

          {/* Table */}
          {liveLoading && filteredRows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span className="text-sm">Memuat aktivitas dari semua platform...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📋</div>
              <p className="font-semibold text-slate-500">Belum ada aktivitas</p>
              <p className="text-sm text-slate-400 mt-1">Data reminder &amp; ticket akan muncul otomatis di sini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
                  <colgroup>
                    <col style={{ width: '44px' }} />
                    <col />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '95px' }} />
                    <col style={{ width: '80px' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ ...TH, width: '40px', textAlign: 'center' as const }}>NO</th>
                      <th style={TH}>PROJECT</th>
                      <th style={TH}>PRODUCT</th>
                      <th style={TH}>KEGIATAN</th>
                      <th style={TH}>SALES</th>
                      <th style={TH}>HANDLER</th>
                      <th style={TH}>STATUS</th>
                      <th style={TH}>TANGGAL</th>
                      <th style={{ ...TH, textAlign: 'center' as const }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                  {filteredRows.map((row, i) => {
                    const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
                    const badge = row.source === 'manual' ? SB.manual : sb(row.status);
                    return (
                      <tr key={row.id} className="hover:bg-red-50/20 transition-colors cursor-pointer"
                        style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,250,252,0.5)' }}
                        onClick={() => setModalRow(row)}>
                        <td style={{ ...TD, textAlign: 'center' as const, color: '#94a3b8', fontSize: '12px' }}>{i + 1}</td>
                        <td style={TD}>
                          <p className="font-semibold text-slate-800 text-sm leading-tight">{row.project_name}</p>
                          {row.address && <p className="text-[11px] text-slate-400 mt-0.5">📍 {row.address}</p>}
                        </td>
                        <td style={TD}>
                          {row.product
                            ? <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">{row.product}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td style={TD}>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                            {row.kegiatan_icon} {row.source === 'ticket' ? 'Troubleshooting' : row.category}
                          </span>
                          {row.source === 'ticket' && <p className="text-[10px] text-slate-400 mt-0.5">{row.kegiatan_label}</p>}
                          <p className="mt-1">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={
                                row.source === 'ticket'
                                  ? { background: 'rgba(251,113,133,0.12)', color: '#be185d' }
                                  : row.source === 'reminder'
                                  ? { background: 'rgba(16,185,129,0.1)', color: '#059669' }
                                  : { background: 'rgba(245,158,11,0.1)', color: '#b45309' }
                              }>
                              {row.source === 'ticket' ? '🎫 Ticketing' : row.source === 'reminder' ? '🔔 Schedule' : '✍️ Manual'}
                            </span>
                          </p>
                        </td>
                        <td style={TD}>
                          {row.sales_name
                            ? <div><p className="text-xs font-semibold text-slate-700">{row.sales_name}</p>{row.sales_division && <p className="text-[10px] text-slate-400">{row.sales_division}</p>}</div>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td style={TD}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: avc(row.handler_name) }}>{ini(row.handler_name)}</div>
                            <span className="text-xs font-semibold text-slate-700">{row.handler_name || '—'}</span>
                          </div>
                        </td>
                        <td style={TD}>
                          <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={TD}>
                          <div className="rounded-xl text-center px-2.5 py-2 inline-flex flex-col items-center" style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.15)', minWidth: '64px' }}>
                            <span className="text-base font-black text-red-600 leading-none">{row.report_date?.split('-')[2] ?? '—'}</span>
                            <span className="text-[9px] font-bold text-red-400 uppercase">
                              {row.report_date ? new Date(row.report_date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }).toUpperCase() : '—'}
                            </span>
                            {row.jam !== '-' && <span className="text-[9px] text-slate-400 mt-0.5">{row.jam}</span>}
                          </div>
                        </td>
                        <td style={{ ...TD, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setModalRow(row)}
                              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-all" title="Lihat">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            {row.report_id && (
                              <button onClick={() => { const r = reports.find(x => x.id === row.report_id); if (r) openEditForm(r); }}
                                className="p-1.5 rounded-lg text-white transition-all" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }} title="Edit Report">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <FormModal />
      <DetailModal />
      <Toast t={toast} />
    </PW>
  );
}
