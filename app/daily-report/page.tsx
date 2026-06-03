'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

import {
  CATEGORIES, CATEGORY_CONFIG, SALES_DIVISIONS,
  formatDate,
  type TeamUser, type GuestUser,
} from '@/app/reminder-schedule/_components/shared';

import {
  todayISO, formatLogTime,
  fetchReminderActivities, fetchTicketActivities,
  fetchExistingReport, fetchReports,
  saveReport, saveTeamEntries,
  type ReminderActivity, type TicketActivity,
  type ManualActivity, type TeamEntry,
  type DailyReport, type DailyReportTeamEntry,
} from './_components/shared';

import {
  FormField, SectionHeaderSmall,
  LoadingScreen,
} from '@/components/shared';

// ─── Style helpers (identik reminder-schedule) ─────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.95)',
  border: '1.5px solid rgba(0,0,0,0.12)',
  borderRadius: '12px',
  color: '#1e293b',
  fontSize: '14px',
  padding: '10px 14px',
  width: '100%',
  outline: 'none',
};
const inputCls = 'transition-all focus:ring-2 focus:ring-red-300';

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.95)',
  borderRadius: '16px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  border: '1px solid rgba(255,255,255,0.8)',
  overflow: 'hidden',
};

const cardHeaderStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

// ─── Table styles identik reminder-schedule ────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left' as const,
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap' as const,
  background: 'rgba(248,250,252,0.95)',
  borderBottom: '2px solid rgba(0,0,0,0.07)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#1e293b',
  verticalAlign: 'middle' as const,
  borderBottom: '1px solid rgba(0,0,0,0.04)',
};

function newManualKey() { return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function newTeamKey()   { return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`; }

function emptyManual(currentUsername = ''): ManualActivity {
  return { _key: newManualKey(), category: 'Internal', project_name: '', address: '', description: '', sales_name: '', sales_division: '', pic_name: '', pic_phone: '', submitted_by: currentUsername };
}
function emptyTeamEntry(member: TeamUser): TeamEntry {
  return { _key: newTeamKey(), member_user_id: member.id, member_name: member.full_name, category: 'Internal', project_name: '', address: '', sales_name: '', sales_division: member.sales_division ?? '', supervisor_notes: '' };
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  done:          { label: 'Selesai',   bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  completed:     { label: 'Selesai',   bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  pending:       { label: 'Pending',   bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  cancelled:     { label: 'Batal',     bg: '#f3f4f6', color: '#374151', border: '#6b7280' },
  'in progress': { label: 'Proses',    bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' },
};
function statusBadge(s: string) {
  return STATUS_BADGE[s?.toLowerCase()] ?? { label: s || '-', bg: '#f3f4f6', color: '#374151', border: '#6b7280' };
}

const AV_COLORS = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#e11d48','#6366f1'];
function avatarColor(name: string) { return AV_COLORS[(name?.charCodeAt(0) ?? 0) % AV_COLORS.length]; }
function initials(name: string) { return (name || 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

// ─── Category picker ───────────────────────────────────────────────────────────
function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map(cat => {
        const c = CATEGORY_CONFIG[cat];
        const sel = value === cat;
        return (
          <button key={cat} type="button" onClick={() => onChange(cat)}
            className="flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-left transition-all"
            style={sel ? { borderColor: c.accent, background: c.bg, color: c.color } : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
            <span className="text-xl">{c.icon}</span>
            <span className="text-xs font-bold leading-tight flex-1">{cat}</span>
            {sel && <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sales dropdown ────────────────────────────────────────────────────────────
function SalesDropdown({ value, division, guestUsers, onChange }: { value: string; division: string; guestUsers: GuestUser[]; onChange: (name: string, div: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = guestUsers.filter(u => !search.trim() || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()) || (u.sales_division ?? '').toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="relative">
      <div className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between cursor-pointer transition-all"
        style={{ ...inputStyle, borderColor: open ? 'rgba(220,38,38,0.5)' : 'rgba(0,0,0,0.12)' }}
        onClick={() => { setOpen(o => !o); if (!open) setSearch(''); }}>
        {value ? <span className="font-semibold text-slate-800">{value}{division && <span className="font-normal text-red-400"> · {division}</span>}</span> : <span className="text-slate-400">-- Pilih Sales --</span>}
        <svg className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      {open && (
        <>
          <div className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden" style={{ background: 'white', border: '1.5px solid rgba(220,38,38,0.25)', maxHeight: '240px' }}>
            <div className="p-2 border-b" style={{ borderColor: 'rgba(220,38,38,0.1)' }}>
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama sales..." onClick={e => e.stopPropagation()}
                className="w-full pl-3 pr-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', color: '#1e293b' }} />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
              <div className="px-4 py-2.5 text-sm cursor-pointer hover:bg-red-50 text-slate-400 italic" onClick={() => { onChange('', ''); setOpen(false); setSearch(''); }}>-- Pilih Sales --</div>
              {filtered.map(u => (
                <div key={u.id} className="px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2"
                  style={{ background: value === u.full_name ? 'rgba(220,38,38,0.07)' : undefined, borderLeft: value === u.full_name ? '3px solid #dc2626' : '3px solid transparent' }}
                  onClick={() => { onChange(u.full_name, u.sales_division ?? ''); setOpen(false); setSearch(''); }}>
                  <div><p className="text-sm font-semibold text-slate-800">{u.full_name}</p><p className="text-xs text-red-400">@{u.username}{u.sales_division ? ` · ${u.sales_division}` : ''}</p></div>
                  {value === u.full_name && <span className="text-red-500">✓</span>}
                </div>
              ))}
              {search.trim() && filtered.length === 0 && <div className="px-4 py-4 text-center text-xs text-gray-400">Tidak ada sales ditemukan</div>}
            </div>
          </div>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
        </>
      )}
    </div>
  );
}

// ─── PageWrapper identik reminder-schedule ────────────────────────────────────
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(10,10,30,0.55)' }} />
      <div className="relative z-10 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
}

// ─── Helper: flatten semua aktivitas 1 report jadi flat rows untuk tabel ───────
interface FlatRow {
  source: 'reminder' | 'ticket' | 'manual';
  project_name: string;
  address: string;
  product: string;
  kegiatan_label: string;
  kegiatan_icon: string;
  sales_name: string;
  sales_division: string;
  handler_name: string;   // user_name dari report
  status: string;
  tanggal: string;        // due_time / log_time / '-'
  category: string;
}

function flattenReport(r: DailyReport): FlatRow[] {
  const rows: FlatRow[] = [];

  // Reminder activities
  r.reminder_activities.forEach(a => {
    rows.push({
      source: 'reminder',
      project_name: a.project_name || a.title || '-',
      address: a.address || '',
      product: a.product || '',
      kegiatan_label: a.title || 'Reminder',
      kegiatan_icon: '🔔',
      sales_name: a.sales_name || '',
      sales_division: a.sales_division || '',
      handler_name: r.user_name,
      status: a.status || 'pending',
      tanggal: a.due_time || '-',
      category: a.category || 'Internal',
    });
  });

  // Ticket activities
  r.ticket_activities.forEach(a => {
    rows.push({
      source: 'ticket',
      project_name: a.project_name || '-',
      address: a.address || '',
      product: '',
      kegiatan_label: a.issue_case || 'Troubleshooting',
      kegiatan_icon: '🔧',
      sales_name: a.sales_name || '',
      sales_division: a.sales_division || '',
      handler_name: r.user_name,
      status: a.new_status || '-',
      tanggal: a.log_time || '-',
      category: 'Troubleshooting',
    });
  });

  // Manual activities
  r.manual_activities.forEach(a => {
    rows.push({
      source: 'manual',
      project_name: a.project_name || '-',
      address: a.address || '',
      product: '',
      kegiatan_label: a.description || a.category || 'Kegiatan Manual',
      kegiatan_icon: '✍️',
      sales_name: a.sales_name || '',
      sales_division: a.sales_division || '',
      handler_name: r.user_name,
      status: 'manual',
      tanggal: '-',
      category: a.category || 'Internal',
    });
  });

  return rows;
}

// ─── Tabel Reminder di form/detail ────────────────────────────────────────────
function ReminderTable({ activities }: { activities: ReminderActivity[] }) {
  if (activities.length === 0) return (
    <div className="text-center py-8 text-slate-400">
      <div className="text-3xl mb-2">🔔</div>
      <p className="text-sm">Tidak ada jadwal reminder pada tanggal ini</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '36px' }}>NO</th>
            <th style={thStyle}>PROJECT</th>
            <th style={thStyle}>PRODUCT</th>
            <th style={thStyle}>KEGIATAN</th>
            <th style={thStyle}>SALES</th>
            <th style={thStyle}>STATUS</th>
            <th style={thStyle}>WAKTU</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((r, i) => {
            const c = CATEGORY_CONFIG[r.category] ?? CATEGORY_CONFIG['Internal'];
            const sb = statusBadge(r.status);
            return (
              <tr key={r.reminder_id ?? i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,250,252,0.5)' }}>
                <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '12px', textAlign: 'center' }}>{i + 1}</td>
                <td style={tdStyle}>
                  <p className="font-semibold text-slate-800 text-sm leading-tight">{r.project_name || r.title || '-'}</p>
                  {r.address && <p className="text-[11px] text-slate-400 mt-0.5">📍 {r.address}</p>}
                </td>
                <td style={tdStyle}>
                  {r.product
                    ? <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">{r.product}</span>
                    : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td style={tdStyle}>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                    {c.icon} {r.category}
                  </span>
                  {r.description && <p className="text-[11px] text-slate-400 mt-1 italic">{r.description}</p>}
                </td>
                <td style={tdStyle}>
                  {r.sales_name
                    ? <div><p className="text-xs font-semibold text-slate-700">{r.sales_name}</p>{r.sales_division && <p className="text-[10px] text-slate-400">{r.sales_division}</p>}</div>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td style={tdStyle}>
                  <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>
                    {sb.label}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: '#dc2626', whiteSpace: 'nowrap' as const }}>
                  {r.due_time || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tabel Ticket di form/detail ──────────────────────────────────────────────
function TicketTable({ activities }: { activities: TicketActivity[] }) {
  if (activities.length === 0) return (
    <div className="text-center py-8 text-slate-400">
      <div className="text-3xl mb-2">🎫</div>
      <p className="text-sm">Tidak ada ticket pada tanggal ini</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '36px' }}>NO</th>
            <th style={thStyle}>PROJECT</th>
            <th style={thStyle}>PRODUCT / MASALAH</th>
            <th style={thStyle}>KEGIATAN</th>
            <th style={thStyle}>SALES</th>
            <th style={thStyle}>STATUS</th>
            <th style={thStyle}>JAM</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((t, i) => {
            const sb = statusBadge(t.new_status);
            return (
              <tr key={t.ticket_id ?? i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,250,252,0.5)' }}>
                <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '12px', textAlign: 'center' }}>{i + 1}</td>
                <td style={tdStyle}>
                  <p className="font-semibold text-slate-800 text-sm leading-tight">{t.project_name}</p>
                  {t.address && <p className="text-[11px] text-slate-400 mt-0.5">📍 {t.address}</p>}
                </td>
                <td style={tdStyle}>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(251,113,133,0.1)', color: '#be185d', border: '1px solid rgba(251,113,133,0.3)' }}>
                    🔧 {t.issue_case}
                  </span>
                </td>
                <td style={tdStyle}>
                  <p className="text-xs text-slate-600 leading-relaxed">{t.action_taken || '—'}</p>
                </td>
                <td style={tdStyle}>
                  {t.sales_name
                    ? <div><p className="text-xs font-semibold text-slate-700">{t.sales_name}</p>{t.sales_division && <p className="text-[10px] text-slate-400">{t.sales_division}</p>}</div>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td style={tdStyle}>
                  <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>
                    {sb.label}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: '#dc2626', whiteSpace: 'nowrap' as const }}>
                  {t.log_time || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function DailyReportPage() {
  const [appReady, setAppReady]       = useState(false);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [loginForm, setLoginForm]     = useState({ username: '', password: '' });
  const [loginErr, setLoginErr]       = useState('');
  const [currentUser, setCurrentUser] = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]     = useState<TeamUser[]>([]);
  const [guestUsers, setGuestUsers]   = useState<GuestUser[]>([]);

  type View = 'list' | 'form' | 'detail';
  const [view, setView]                 = useState<View>('list');
  const [detailReport, setDetailReport] = useState<DailyReport | null>(null);

  const [reports, setReports]         = useState<DailyReport[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [filterDate, setFilterDate]   = useState('');
  const [filterUser, setFilterUser]   = useState('');
  const [searchProject, setSearchProject] = useState('');

  const [editingId, setEditingId]     = useState<string | null>(null);
  const [formDate, setFormDate]       = useState(todayISO());
  const [formUserId, setFormUserId]   = useState('');
  const [reminderNotes, setReminderNotes] = useState('');

  const [reminderActs, setReminderActs] = useState<ReminderActivity[]>([]);
  const [ticketActs, setTicketActs]     = useState<TicketActivity[]>([]);
  const [manualActs, setManualActs]     = useState<ManualActivity[]>([]);
  const [teamEntries, setTeamEntries]   = useState<TeamEntry[]>([]);

  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const Toast = () => toast ? (
    <div className="fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 text-white"
      style={{ background: toast.type === 'success' ? '#059669' : '#dc2626' }}>
      {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
    </div>
  ) : null;

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('currentUser');
    const user = saved ? (JSON.parse(saved) as TeamUser) : null;
    if (user) { setCurrentUser(user); setIsLoggedIn(true); }
    Promise.all([fetchTeamUsersData(), fetchGuestUsersData()]).then(() => setAppReady(true));
    const checkSession = () => {
      const savedTime = localStorage.getItem('loginTime');
      if (!savedTime) return;
      if (Date.now() - parseInt(savedTime) > 6 * 60 * 60 * 1000) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('loginTime');
        const t = window.top !== window ? window.top : window;
        if (t) t.location.href = '/dashboard';
      }
    };
    checkSession();
    const iv = setInterval(checkSession, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { if (currentUser) fetchReportList(); }, [currentUser]);

  const fetchTeamUsersData = async () => {
    const { data } = await supabase
      .from('users')
      .select('id,username,full_name,role,team_type,phone_number,sales_division,allowed_menus')
      .order('full_name');
    if (data) setTeamUsers(data.filter((u: TeamUser) => u.team_type === 'Team PTS'));
  };

  const fetchGuestUsersData = async () => {
    const { data } = await supabase
      .from('users')
      .select('id,username,full_name,role,phone_number,sales_division')
      .eq('role', 'guest')
      .order('full_name');
    if (data) setGuestUsers(data as GuestUser[]);
  };

  const fetchReportList = useCallback(async () => {
    if (!currentUser) return;
    setListLoading(true);
    try {
      const data = await fetchReports({
        date: filterDate || undefined,
        userId: filterUser || undefined,
        isAdmin,
        currentUserId: currentUser.id,
      });
      setReports(data);
    } catch (e) { console.error('fetchReports error:', e); }
    setTimeout(() => setListLoading(false), 300);
  }, [currentUser, filterDate, filterUser, isAdmin]);

  useEffect(() => { fetchReportList(); }, [fetchReportList]);

  // ── Auto-load activities ─────────────────────────────────────────────────────
  const loadActivities = useCallback(async (username: string, date: string) => {
    if (!username || !date) { setReminderActs([]); setTicketActs([]); return; }
    setActivitiesLoading(true);
    try {
      const [rem, tick] = await Promise.all([
        fetchReminderActivities(username, date),
        fetchTicketActivities(username, date),
      ]);
      setReminderActs(rem);
      setTicketActs(tick);
    } catch (e) { console.error('loadActivities error:', e); }
    setActivitiesLoading(false);
  }, []);

  useEffect(() => {
    if (view !== 'form') return;
    const username = isAdmin
      ? (teamUsers.find(u => u.id === formUserId)?.username ?? '')
      : (currentUser?.username ?? '');
    loadActivities(username, formDate);
  }, [formDate, formUserId, view, teamUsers]);

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginErr('');
    const { data, error } = await supabase
      .from('users').select('*')
      .eq('username', loginForm.username.trim())
      .eq('password', loginForm.password)
      .maybeSingle();
    if (error || !data) { setLoginErr('Username atau password salah.'); return; }
    const allowedMenus: string[] = data.allowed_menus ?? [];
    if (data.role !== 'admin' && data.role !== 'superadmin' && !allowedMenus.includes('daily-report')) {
      setLoginErr('Akun tidak memiliki akses Daily Report.');
      return;
    }
    localStorage.setItem('currentUser', JSON.stringify(data));
    localStorage.setItem('loginTime', String(Date.now()));
    setCurrentUser(data); setIsLoggedIn(true);
  };

  const openNewForm = async () => {
    const date = todayISO();
    setFormDate(date);
    setFormUserId(isAdmin ? '' : currentUser?.id ?? '');
    setReminderNotes('');
    setManualActs([emptyManual(currentUser?.username ?? '')]);
    setEditingId(null);
    setReminderActs([]); setTicketActs([]);
    if (isAdmin) setTeamEntries(teamUsers.map(u => emptyTeamEntry(u)));
    else setTeamEntries([]);
    if (!isAdmin && currentUser?.username) {
      setActivitiesLoading(true);
      const [rem, tick] = await Promise.all([
        fetchReminderActivities(currentUser.username, date),
        fetchTicketActivities(currentUser.username, date),
      ]);
      setReminderActs(rem); setTicketActs(tick);
      setActivitiesLoading(false);
    }
    setView('form');
  };

  const openEditForm = async (report: DailyReport) => {
    setFormDate(report.report_date);
    setFormUserId(report.user_id);
    setReminderNotes(report.reminder_notes ?? '');
    setManualActs(
      (report.manual_activities ?? []).length
        ? report.manual_activities.map(m => ({ ...m, _key: newManualKey() }))
        : [emptyManual(currentUser?.username ?? '')]
    );
    setEditingId(report.id);
    // fetch fresh dari DB — selalu up-to-date
    const username = isAdmin
      ? (teamUsers.find(u => u.id === report.user_id)?.username ?? '')
      : (currentUser?.username ?? '');
    setActivitiesLoading(true);
    const [rem, tick] = await Promise.all([
      fetchReminderActivities(username, report.report_date),
      fetchTicketActivities(username, report.report_date),
    ]);
    setReminderActs(rem); setTicketActs(tick);
    setActivitiesLoading(false);
    setView('form');
  };

  const handleSave = async () => {
    const targetUserId = isAdmin ? formUserId : currentUser?.id ?? '';
    const targetUser = teamUsers.find(u => u.id === targetUserId) ?? currentUser;
    if (!formDate) { notify('error', 'Tanggal wajib dipilih!'); return; }
    if (!targetUserId) { notify('error', 'Pilih anggota team!'); return; }
    if (!editingId) {
      const existing = await fetchExistingReport(targetUserId, formDate);
      if (existing) {
        notify('error', `Report ${targetUser?.full_name} tanggal ${formatDate(formDate)} sudah ada!`);
        return;
      }
    }
    setSaving(true);
    const cleanManual = manualActs
      .filter(m => m.project_name.trim() || m.description.trim())
      .map(({ _key, ...rest }) => ({ ...rest, submitted_by: rest.submitted_by || currentUser?.username || 'system' }));
    const result = await saveReport({
      ...(editingId ? { id: editingId } : {}),
      report_date: formDate,
      user_id: targetUserId,
      user_name: targetUser?.full_name ?? '',
      sales_division: targetUser?.sales_division ?? '',
      reminder_activities: reminderActs,
      ticket_activities: ticketActs,
      manual_activities: cleanManual,
      reminder_notes: reminderNotes,
      created_by: currentUser?.username ?? 'system',
    } as any);
    if (!result.ok) { notify('error', 'Gagal menyimpan: ' + result.error); setSaving(false); return; }
    if (isAdmin && teamEntries.length) {
      const clean = teamEntries
        .filter(e => e.project_name.trim())
        .map(({ _key, ...rest }) => ({ ...rest, report_date: formDate, source: 'manual' as const }));
      if (clean.length) await saveTeamEntries(clean as any, formDate, currentUser?.username ?? '');
    }
    notify('success', editingId ? 'Report diperbarui!' : 'Daily Report berhasil disimpan!');
    setSaving(false); setView('list'); setEditingId(null); fetchReportList();
  };

  const updateManual = (key: string, patch: Partial<ManualActivity>) =>
    setManualActs(prev => prev.map(m => m._key === key ? { ...m, ...patch } : m));
  const removeManual = (key: string) =>
    setManualActs(prev => prev.filter(m => m._key !== key));
  const addManual = () =>
    setManualActs(prev => [...prev, emptyManual(currentUser?.username ?? '')]);
  const updateTeamEntry = (key: string, patch: Partial<TeamEntry>) =>
    setTeamEntries(prev => prev.map(e => e._key === key ? { ...e, ...patch } : e));

  if (!appReady) return <LoadingScreen />;

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <PageWrapper>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm border border-white/20 shadow-2xl">
            <div className="text-center mb-6">
              <span className="text-4xl">📋</span>
              <h1 className="text-xl font-bold text-white mt-2">Daily Report</h1>
              <p className="text-white/60 text-sm mt-1">PTS IVP &amp; MLDS</p>
            </div>
            <div className="space-y-3">
              <input value={loginForm.username}
                onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))}
                placeholder="Username"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
              <input type="password" value={loginForm.password}
                onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
              {loginErr && <p className="text-red-300 text-xs">{loginErr}</p>}
              <button onClick={handleLogin}
                className="w-full py-3 rounded-xl font-bold text-sm text-white hover:scale-[1.02] transition-all"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>Masuk</button>
            </div>
          </div>
        </div>
        <Toast />
      </PageWrapper>
    );
  }

  // ── DETAIL ───────────────────────────────────────────────────────────────────
  if (view === 'detail' && detailReport) {
    const flatRows = flattenReport(detailReport);
    return (
      <PageWrapper>
        <div className="sticky top-0 z-30 backdrop-blur-md border-b border-white/10" style={{ background: 'rgba(15,15,35,0.85)' }}>
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-3">
            <button onClick={() => { setView('list'); setDetailReport(null); }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">Detail Daily Report</h2>
              <p className="text-white/50 text-xs truncate">{detailReport.user_name} · {formatDate(detailReport.report_date)}</p>
            </div>
            <div className="flex items-center gap-2">
              {detailReport.reminder_activities.length > 0 && <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>🔔 {detailReport.reminder_activities.length}</span>}
              {detailReport.ticket_activities.length > 0 && <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(251,113,133,0.2)', color: '#fda4af' }}>🎫 {detailReport.ticket_activities.length}</span>}
              {detailReport.manual_activities.length > 0 && <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.2)', color: '#fde68a' }}>✍️ {detailReport.manual_activities.length}</span>}
              <button onClick={() => openEditForm(detailReport)}
                className="px-4 py-2 rounded-xl font-semibold text-sm text-white hover:scale-[1.02] transition-all"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}>✏️ Edit</button>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 py-5 space-y-4 pb-10 w-full">

          {/* ── Tabel utama persis reminder-schedule ── */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span className="text-sm font-bold text-slate-700">📋 Semua Aktivitas — {detailReport.user_name}</span>
              <span className="text-xs font-bold text-slate-400">{formatDate(detailReport.report_date)}</span>
            </div>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '40px' }}>NO</th>
                    <th style={thStyle}>PROJECT</th>
                    <th style={thStyle}>PRODUCT</th>
                    <th style={thStyle}>KEGIATAN</th>
                    <th style={thStyle}>SALES</th>
                    <th style={thStyle}>HANDLER</th>
                    <th style={thStyle}>STATUS</th>
                    <th style={thStyle}>TANGGAL / JAM</th>
                    <th style={thStyle}>SUMBER</th>
                  </tr>
                </thead>
                <tbody>
                  {flatRows.length === 0 ? (
                    <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '32px' }}>Tidak ada aktivitas</td></tr>
                  ) : flatRows.map((row, i) => {
                    const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
                    const sb = row.source === 'manual'
                      ? { label: 'Manual', bg: 'rgba(245,158,11,0.1)', color: '#b45309', border: 'rgba(245,158,11,0.3)' }
                      : statusBadge(row.status);
                    const sourceBadge = row.source === 'reminder'
                      ? { label: 'Reminder', bg: 'rgba(16,185,129,0.1)', color: '#059669', border: 'rgba(16,185,129,0.3)' }
                      : row.source === 'ticket'
                        ? { label: 'Ticket', bg: 'rgba(251,113,133,0.1)', color: '#be185d', border: 'rgba(251,113,133,0.3)' }
                        : { label: 'Manual', bg: 'rgba(245,158,11,0.1)', color: '#b45309', border: 'rgba(245,158,11,0.3)' };
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,250,252,0.5)' }}>
                        <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '12px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={tdStyle}>
                          <p className="font-semibold text-slate-800 text-sm leading-tight">{row.project_name}</p>
                          {row.address && <p className="text-[11px] text-slate-400 mt-0.5">📍 {row.address}</p>}
                        </td>
                        <td style={tdStyle}>
                          {row.product
                            ? <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">{row.product}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td style={tdStyle}>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                            {row.kegiatan_icon} {row.source === 'ticket' ? row.kegiatan_label : row.category}
                          </span>
                          {row.source === 'ticket' && <p className="text-[11px] text-slate-500 mt-1">{row.kegiatan_label}</p>}
                        </td>
                        <td style={tdStyle}>
                          {row.sales_name
                            ? <div><p className="text-xs font-semibold text-slate-700">{row.sales_name}</p>{row.sales_division && <p className="text-[10px] text-slate-400">{row.sales_division}</p>}</div>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td style={tdStyle}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ background: avatarColor(row.handler_name) }}>
                              {initials(row.handler_name)}
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{row.handler_name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>
                            {sb.label}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: '#dc2626', whiteSpace: 'nowrap' as const }}>
                          {row.tanggal !== '-' ? row.tanggal : <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td style={tdStyle}>
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold"
                            style={{ background: sourceBadge.bg, color: sourceBadge.color, border: `1px solid ${sourceBadge.border}` }}>
                            {sourceBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {detailReport.reminder_notes && (
              <div className="mx-5 mb-4 mt-3 px-3 py-2 rounded-xl" style={{ background: '#fef9c3', border: '1px solid #fde047' }}>
                <p className="text-xs text-yellow-700">📝 Catatan Reminder: {detailReport.reminder_notes}</p>
              </div>
            )}
          </div>
        </div>
        <Toast />
      </PageWrapper>
    );
  }

  // ── FORM ─────────────────────────────────────────────────────────────────────
  if (view === 'form') {
    const targetUser = isAdmin ? teamUsers.find(u => u.id === formUserId) : currentUser;
    const autoCount = reminderActs.length + ticketActs.length;
    return (
      <PageWrapper>
        <div className="sticky top-0 z-30 backdrop-blur-md border-b border-white/10" style={{ background: 'rgba(15,15,35,0.85)' }}>
          <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-3">
            <button onClick={() => { setView('list'); setEditingId(null); }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">{editingId ? '✏️ Edit Report' : '📋 Daily Report Baru'}</h2>
              <p className="text-white/50 text-xs">
                {activitiesLoading
                  ? 'Memuat aktivitas dari Reminder & Ticket...'
                  : autoCount > 0
                    ? `${reminderActs.length} reminder + ${ticketActs.length} ticket ter-insert otomatis`
                    : 'Data reminder & ticket akan auto ter-insert'}
              </p>
            </div>
            {activitiesLoading
              ? <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(14,165,233,0.15)', color: '#7dd3fc' }}>
                  <div className="w-3 h-3 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />Auto-loading...
                </div>
              : autoCount > 0
                ? <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>✓ {autoCount} Auto</div>
                : null}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-5 py-5 space-y-4 pb-10 w-full">

          {/* Identitas */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}><span className="text-sm font-bold text-slate-700">👤 Identitas &amp; Tanggal</span></div>
            <div className="px-5 py-4 space-y-4">
              <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <FormField label="Tanggal Report *">
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={inputCls} style={inputStyle} />
                </FormField>
                {isAdmin && (
                  <FormField label="Anggota Team *">
                    <select value={formUserId} onChange={e => setFormUserId(e.target.value)} className={inputCls} style={inputStyle}>
                      <option value="">-- Pilih anggota --</option>
                      {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </FormField>
                )}
              </div>
              {targetUser && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: avatarColor(targetUser.full_name) }}>{initials(targetUser.full_name)}</div>
                  <div><p className="text-sm font-bold text-slate-800">{targetUser.full_name}</p><p className="text-xs text-slate-500">{targetUser.team_type} · {targetUser.sales_division || '-'}</p></div>
                </div>
              )}
            </div>
          </div>

          {/* Tabel Reminder AUTO */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">🔔 Reminder Schedule</span>
                {!activitiesLoading && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${reminderActs.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {reminderActs.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>Auto-insert</span>
            </div>
            {activitiesLoading
              ? <div className="px-5 py-6 flex items-center gap-3 text-slate-400 text-sm"><div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />Memuat dari Reminder Schedule...</div>
              : <>
                  <ReminderTable activities={reminderActs} />
                  {reminderActs.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-50">
                      <FormField label="Catatan Tambahan (Opsional)">
                        <textarea value={reminderNotes} onChange={e => setReminderNotes(e.target.value)} rows={2}
                          className={`${inputCls} resize-none`} style={inputStyle} placeholder="Kendala, hasil, atau info tambahan..." />
                      </FormField>
                    </div>
                  )}
                </>}
          </div>

          {/* Tabel Ticket AUTO */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">🎫 Ticket Troubleshooting</span>
                {!activitiesLoading && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ticketActs.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-400'}`}>
                    {ticketActs.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>Auto-insert</span>
            </div>
            {activitiesLoading
              ? <div className="px-5 py-6 flex items-center gap-3 text-slate-400 text-sm"><div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />Memuat dari Ticket Troubleshooting...</div>
              : <TicketTable activities={ticketActs} />}
          </div>

          {/* Aktivitas Manual */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">✍️ Aktivitas Manual</span>
                <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">{manualActs.length}</span>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>Manual</span>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: avatarColor(currentUser?.full_name ?? '') }}>{initials(currentUser?.full_name ?? 'U')}</div>
                <div><p className="text-xs font-semibold text-sky-800">Diisi oleh: {currentUser?.full_name}</p><p className="text-[10px] text-sky-600">@{currentUser?.username}</p></div>
              </div>
              {manualActs.map((m, idx) => (
                <div key={m._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <SectionHeaderSmall icon="📌" title={`Aktivitas #${idx + 1}`} />
                    {manualActs.length > 1 && <button onClick={() => removeManual(m._key)} className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">Hapus</button>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Kategori *</label>
                    <CategoryPicker value={m.category} onChange={v => updateManual(m._key, { category: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Nama Project / Keterangan *">
                      <input value={m.project_name} onChange={e => updateManual(m._key, { project_name: e.target.value })} className={inputCls} style={inputStyle} placeholder="cth: Rapat internal" />
                    </FormField>
                    <FormField label="Lokasi / Alamat">
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2">📍</span>
                        <input value={m.address} onChange={e => updateManual(m._key, { address: e.target.value })} className={`${inputCls} pl-9`} style={inputStyle} placeholder="cth: Kantor / Online" />
                      </div>
                    </FormField>
                  </div>
                  <FormField label="Sales">
                    <SalesDropdown value={m.sales_name} division={m.sales_division} guestUsers={guestUsers}
                      onChange={(name, div) => updateManual(m._key, { sales_name: name, sales_division: div })} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Nama PIC (Opsional)">
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2">🙋</span>
                        <input value={m.pic_name} onChange={e => updateManual(m._key, { pic_name: e.target.value })} className={`${inputCls} pl-9`} style={inputStyle} placeholder="Nama PIC" />
                      </div>
                    </FormField>
                    <FormField label="No. PIC (Opsional)">
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2">📱</span>
                        <input type="tel" value={m.pic_phone} onChange={e => updateManual(m._key, { pic_phone: e.target.value })} className={`${inputCls} pl-9`} style={inputStyle} placeholder="08xxx" />
                      </div>
                    </FormField>
                  </div>
                  <FormField label="Deskripsi Kegiatan">
                    <textarea value={m.description} onChange={e => updateManual(m._key, { description: e.target.value })} rows={2}
                      className={`${inputCls} resize-none`} style={inputStyle} placeholder="Detail kegiatan..." />
                  </FormField>
                </div>
              ))}
              <button onClick={addManual} className="w-full py-3 rounded-xl font-semibold text-sm hover:scale-[1.01] transition-all"
                style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1.5px dashed rgba(220,38,38,0.35)' }}>
                + Tambah Aktivitas Manual
              </button>
            </div>
          </div>

          {/* Team Entries (admin only) */}
          {isAdmin && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <span className="text-sm font-bold text-slate-700">👥 Insert Report Tim (Supervisor)</span>
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>Manual</span>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <span>💡</span><p className="text-xs text-sky-700">Kosongkan baris yang tidak ada kegiatannya.</p>
                </div>
                {teamEntries.map(e => (
                  <div key={e._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: avatarColor(e.member_name) }}>{initials(e.member_name)}</div>
                      <div><p className="text-sm font-bold text-slate-800">{e.member_name}</p><p className="text-xs text-slate-400">{e.sales_division || 'Team PTS'}</p></div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Kategori</label>
                      <CategoryPicker value={e.category} onChange={v => updateTeamEntry(e._key, { category: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Nama Project"><input value={e.project_name} onChange={ev => updateTeamEntry(e._key, { project_name: ev.target.value })} className={inputCls} style={inputStyle} placeholder="cth: Konfigurasi NVR" /></FormField>
                      <FormField label="Lokasi / Alamat"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2">📍</span><input value={e.address} onChange={ev => updateTeamEntry(e._key, { address: ev.target.value })} className={`${inputCls} pl-9`} style={inputStyle} placeholder="cth: Kantor pelanggan" /></div></FormField>
                    </div>
                    <FormField label="Sales"><SalesDropdown value={e.sales_name} division={e.sales_division} guestUsers={guestUsers} onChange={(name, div) => updateTeamEntry(e._key, { sales_name: name, sales_division: div })} /></FormField>
                    <FormField label="Catatan Supervisor"><textarea value={e.supervisor_notes} onChange={ev => updateTeamEntry(e._key, { supervisor_notes: ev.target.value })} rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Hasil kerja, kendala, penilaian..." /></FormField>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save buttons */}
          <div className="flex gap-3 pb-4">
            <button onClick={() => { setView('list'); setEditingId(null); }}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>Batal</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 14px rgba(220,38,38,0.35)' }}>
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingId ? 'Simpan Perubahan' : '📋 Simpan Daily Report'}
            </button>
          </div>
        </div>
        <Toast />
      </PageWrapper>
    );
  }

  // ── LIST — persis reminder-schedule ──────────────────────────────────────────
  // Flatten semua reports jadi per-baris aktivitas
  const allFlatRows: (FlatRow & { report_date: string; report_id: string; user_name: string })[] = [];
  reports.forEach(r => {
    flattenReport(r).forEach(row => {
      allFlatRows.push({ ...row, report_date: r.report_date, report_id: r.id, user_name: r.user_name });
    });
  });

  // Filter search
  const filteredRows = allFlatRows.filter(row => {
    if (!searchProject) return true;
    const q = searchProject.toLowerCase();
    return row.project_name.toLowerCase().includes(q) ||
      row.address.toLowerCase().includes(q) ||
      row.sales_name.toLowerCase().includes(q) ||
      row.handler_name.toLowerCase().includes(q);
  });

  return (
    <PageWrapper>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 backdrop-blur-md border-b border-white/10" style={{ background: 'rgba(15,15,35,0.85)' }}>
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-white">📋 Daily Report</h1>
            <p className="text-white/50 text-xs mt-0.5">PTS IVP &amp; MLDS · {currentUser?.full_name}</p>
          </div>
          <button onClick={openNewForm}
            className="px-4 py-2 rounded-xl font-bold text-sm text-white hover:scale-[1.02] transition-all flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Buat Report
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-4 pb-10 w-full">

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Report', value: reports.length, gradient: 'linear-gradient(135deg,#4f46e5,#6d28d9)', icon: '📋', shadow: 'rgba(79,70,229,0.4)' },
            { label: 'Bulan Ini', value: reports.filter(r => r.report_date?.startsWith(new Date().toISOString().slice(0,7))).length, gradient: 'linear-gradient(135deg,#0891b2,#0e7490)', icon: '📅', shadow: 'rgba(8,145,178,0.4)' },
            { label: 'Total Aktivitas', value: allFlatRows.length, gradient: 'linear-gradient(135deg,#059669,#047857)', icon: '⚡', shadow: 'rgba(5,150,105,0.4)' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2" style={{ background: card.gradient, boxShadow: `0 4px 20px ${card.shadow}` }}>
              <div className="absolute right-3 top-2 text-4xl opacity-[0.15] select-none">{card.icon}</div>
              <span className="text-3xl font-black text-white leading-none">{card.value}</span>
              <p className="text-xs font-bold text-white/80">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter — identik reminder-schedule */}
        <div style={{ ...cardStyle, overflow: 'visible' }}>
          <div className="px-5 py-3 flex flex-wrap gap-3 items-center">
            {/* Search project/lokasi */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 flex-1 min-w-[180px]" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)' }}>
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={searchProject} onChange={e => setSearchProject(e.target.value)} placeholder="Cari project / lokasi..."
                className="bg-transparent outline-none text-xs text-slate-700 placeholder-slate-400 w-full" />
            </div>
            {/* Filter tanggal */}
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)', minWidth: '160px' }}>
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="bg-transparent outline-none text-xs text-slate-700 w-full" />
            </div>
            {/* Filter anggota (admin) */}
            {isAdmin && (
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs outline-none"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)', color: '#1e293b', minWidth: '160px' }}>
                <option value="">👤 Semua anggota</option>
                {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            )}
            {(filterDate || filterUser || searchProject) && (
              <button onClick={() => { setFilterDate(''); setFilterUser(''); setSearchProject(''); }}
                className="text-xs text-red-500 hover:text-red-700 font-semibold px-3 py-2 rounded-xl hover:bg-red-50 transition-all">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Main table — persis reminder-schedule: NO, PROJECT, PRODUCT, KEGIATAN, SALES, HANDLER, STATUS, TANGGAL, ACTION */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Daily Report</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{filteredRows.length}</span>
            </div>
            <button onClick={fetchReportList} disabled={listLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 border border-gray-200 text-gray-600 bg-white disabled:opacity-60 transition-all">
              <svg className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
          </div>

          {listLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span className="text-sm">Memuat report...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-4">📋</div>
              <p className="font-semibold text-slate-500">{reports.length === 0 ? 'Belum ada Daily Report' : 'Tidak ada hasil pencarian'}</p>
              <p className="text-sm mt-1 text-slate-400">{reports.length === 0 ? 'Klik "Buat Report" untuk mulai' : 'Coba ubah filter atau keyword'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '960px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '40px' }}>NO</th>
                    <th style={thStyle}>PROJECT</th>
                    <th style={thStyle}>PRODUCT</th>
                    <th style={thStyle}>KEGIATAN</th>
                    <th style={thStyle}>SALES</th>
                    <th style={thStyle}>HANDLER</th>
                    <th style={thStyle}>STATUS</th>
                    <th style={thStyle}>TANGGAL</th>
                    <th style={{ ...thStyle, textAlign: 'center' as const }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => {
                    const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
                    const sb = row.source === 'manual'
                      ? { label: 'Manual', bg: 'rgba(245,158,11,0.1)', color: '#b45309', border: 'rgba(245,158,11,0.3)' }
                      : statusBadge(row.status);
                    // tanggal cell: report_date + jam
                    const report = reports.find(r => r.id === row.report_id);
                    return (
                      <tr key={`${row.report_id}-${i}`}
                        className="hover:bg-red-50/30 transition-colors cursor-pointer"
                        style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(248,250,252,0.5)' }}
                        onClick={() => { if (report) { setDetailReport(report); setView('detail'); } }}>
                        <td style={{ ...tdStyle, color: '#94a3b8', fontSize: '12px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={tdStyle}>
                          <p className="font-semibold text-slate-800 text-sm leading-tight">{row.project_name}</p>
                          {row.address && <p className="text-[11px] text-slate-400 mt-0.5">📍 {row.address}</p>}
                          <p className="text-[10px] text-slate-400 mt-0.5">{row.report_date}</p>
                        </td>
                        <td style={tdStyle}>
                          {row.product
                            ? <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">{row.product}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td style={tdStyle}>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                            {row.kegiatan_icon} {row.source === 'ticket' ? 'Troubleshooting' : row.category}
                          </span>
                          {row.source === 'ticket' && <p className="text-[10px] text-slate-400 mt-0.5">{row.kegiatan_label}</p>}
                          {row.source === 'reminder' && <p className="text-[10px] text-slate-400 mt-0.5">🔔 Reminder</p>}
                          {row.source === 'manual' && <p className="text-[10px] text-slate-400 mt-0.5">✍️ Manual</p>}
                        </td>
                        <td style={tdStyle}>
                          {row.sales_name
                            ? <div><p className="text-xs font-semibold text-slate-700">{row.sales_name}</p>{row.sales_division && <p className="text-[10px] text-slate-400">{row.sales_division}</p>}</div>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td style={tdStyle}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ background: avatarColor(row.handler_name) }}>
                              {initials(row.handler_name)}
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{row.handler_name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>
                            {sb.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div className="rounded-xl text-center px-3 py-2 flex flex-col items-center" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.12)', minWidth: '80px' }}>
                            <span className="text-base font-black text-red-600 leading-none">{row.report_date.split('-')[2]}</span>
                            <span className="text-[10px] font-bold text-red-400 uppercase mt-0.5">
                              {new Date(row.report_date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }).toUpperCase()}
                            </span>
                            {row.tanggal !== '-' && <span className="text-[9px] text-slate-400 mt-0.5">{row.tanggal}</span>}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' as const }} onClick={ev => ev.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => { if (report) { setDetailReport(report); setView('detail'); } }}
                              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-all" title="Detail">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button onClick={() => { if (report) openEditForm(report); }}
                              className="p-1.5 rounded-lg text-white transition-all" title="Edit"
                              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
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
      <Toast />
    </PageWrapper>
  );
}
