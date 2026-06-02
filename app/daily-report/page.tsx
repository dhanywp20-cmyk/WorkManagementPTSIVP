'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  FormField, SectionHeader, SectionHeaderSmall, InfoRow,
  LoadingScreen,
} from '@/components/shared';

// ─── BG gradient identik dengan reminder-schedule ─────────────────────────────
const PAGE_BG = 'linear-gradient(135deg,#1e1e2e 0%,#2d1f3f 50%,#1a1a2e 100%)';

// ─── Style helpers ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  border: '1.5px solid rgba(0,0,0,0.12)',
  borderRadius: '12px',
  color: '#1e293b',
  fontSize: '14px',
  padding: '10px 14px',
  width: '100%',
  outline: 'none',
};
const inputCls = 'transition-all focus:ring-2 focus:ring-red-300';

function newManualKey() { return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function newTeamKey()   { return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`; }

function emptyManual(currentUsername = ''): ManualActivity {
  return {
    _key: newManualKey(),
    category: 'Internal',
    project_name: '',
    address: '',
    description: '',
    sales_name: '',
    sales_division: '',
    pic_name: '',
    pic_phone: '',
    submitted_by: currentUsername,
  };
}

function emptyTeamEntry(member: TeamUser): TeamEntry {
  return {
    _key: newTeamKey(),
    member_user_id: member.id,
    member_name: member.full_name,
    category: 'Internal',
    project_name: '',
    address: '',
    sales_name: '',
    sales_division: member.sales_division ?? '',
    supervisor_notes: '',
  };
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  done:        { label: 'Selesai',   bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  completed:   { label: 'Selesai',   bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  pending:     { label: 'Pending',   bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  cancelled:   { label: 'Batal',     bg: '#f3f4f6', color: '#374151', border: '#6b7280' },
  'in progress':{ label: 'Proses',  bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' },
};
function statusBadge(s: string) {
  return STATUS_BADGE[s?.toLowerCase()] ?? { label: s || '-', bg: '#f3f4f6', color: '#374151', border: '#6b7280' };
}

const AV_COLORS = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#e11d48','#6366f1'];
function avatarColor(name: string) { return AV_COLORS[(name?.charCodeAt(0) ?? 0) % AV_COLORS.length]; }
function initials(name: string) { return (name || 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

// ─── Category picker ──────────────────────────────────────────────────────────
function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map(cat => {
        const c = CATEGORY_CONFIG[cat];
        const sel = value === cat;
        return (
          <button key={cat} type="button" onClick={() => onChange(cat)}
            className="flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-left transition-all"
            style={sel
              ? { borderColor: c.accent, background: c.bg, color: c.color }
              : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
            <span className="text-xl">{c.icon}</span>
            <span className="text-xs font-bold leading-tight flex-1">{cat}</span>
            {sel && (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sales dropdown ───────────────────────────────────────────────────────────
function SalesDropdown({ value, division, guestUsers, onChange }: {
  value: string; division: string; guestUsers: GuestUser[];
  onChange: (name: string, div: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = guestUsers.filter(u =>
    !search.trim() ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.sales_division ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between cursor-pointer transition-all"
        style={{ ...inputStyle, borderColor: open ? 'rgba(220,38,38,0.5)' : 'rgba(0,0,0,0.12)' }}
        onClick={() => { setOpen(o => !o); if (!open) setSearch(''); }}>
        {value
          ? <span className="font-semibold text-slate-800">{value}{division && <span className="font-normal text-red-400"> · {division}</span>}</span>
          : <span className="text-slate-400">-- Pilih Sales --</span>}
        <svg className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <>
          <div className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden"
            style={{ background: 'white', border: '1.5px solid rgba(220,38,38,0.25)', maxHeight: '240px' }}>
            <div className="p-2 border-b" style={{ borderColor: 'rgba(220,38,38,0.1)' }}>
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama sales..." onClick={e => e.stopPropagation()}
                className="w-full pl-3 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', color: '#1e293b' }} />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
              <div className="px-4 py-2.5 text-sm cursor-pointer hover:bg-red-50 text-slate-400 italic"
                onClick={() => { onChange('', ''); setOpen(false); setSearch(''); }}>-- Pilih Sales --</div>
              {filtered.map(u => (
                <div key={u.id} className="px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2"
                  style={{ background: value === u.full_name ? 'rgba(220,38,38,0.07)' : undefined, borderLeft: value === u.full_name ? '3px solid #dc2626' : '3px solid transparent' }}
                  onClick={() => { onChange(u.full_name, u.sales_division ?? ''); setOpen(false); setSearch(''); }}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                    <p className="text-xs text-red-400">@{u.username}{u.sales_division ? ` · ${u.sales_division}` : ''}</p>
                  </div>
                  {value === u.full_name && <span className="text-red-500">✓</span>}
                </div>
              ))}
              {search.trim() && filtered.length === 0 && (
                <div className="px-4 py-4 text-center text-xs text-gray-400">Tidak ada sales ditemukan</div>
              )}
            </div>
          </div>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />
        </>
      )}
    </div>
  );
}

// ─── HALAMAN UTAMA ────────────────────────────────────────────────────────────
export default function DailyReportPage() {

  const [appReady, setAppReady]         = useState(false);
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [loginForm, setLoginForm]       = useState({ username: '', password: '' });
  const [loginErr, setLoginErr]         = useState('');
  const [currentUser, setCurrentUser]   = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]       = useState<TeamUser[]>([]);
  const [guestUsers, setGuestUsers]     = useState<GuestUser[]>([]);

  type View = 'list' | 'form' | 'detail';
  const [view, setView]                 = useState<View>('list');
  const [detailReport, setDetailReport] = useState<DailyReport | null>(null);

  const [reports, setReports]           = useState<DailyReport[]>([]);
  const [listLoading, setListLoading]   = useState(false);
  const [filterDate, setFilterDate]     = useState('');
  const [filterUser, setFilterUser]     = useState('');

  const [editingId, setEditingId]       = useState<string | null>(null);
  const [formDate, setFormDate]         = useState(todayISO());
  const [formUserId, setFormUserId]     = useState('');
  const [reminderNotes, setReminderNotes] = useState('');

  const [reminderActs, setReminderActs] = useState<ReminderActivity[]>([]);
  const [ticketActs, setTicketActs]     = useState<TicketActivity[]>([]);
  const [manualActs, setManualActs]     = useState<ManualActivity[]>([]);
  const [teamEntries, setTeamEntries]   = useState<TeamEntry[]>([]);

  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('currentUser');
    const user = saved ? (JSON.parse(saved) as TeamUser) : null;
    if (user) { setCurrentUser(user); setIsLoggedIn(true); }
    Promise.all([fetchTeamUsersData(), fetchGuestUsersData()]).then(() => setAppReady(true));

    const checkSession = () => {
      const savedTime = localStorage.getItem('loginTime');
      if (!savedTime) return;
      if (Date.now() - parseInt(savedTime) > 6 * 60 * 60 * 1000) {
        localStorage.removeItem('currentUser'); localStorage.removeItem('loginTime');
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
    const { data } = await supabase.from('users')
      .select('id,username,full_name,role,team_type,phone_number,sales_division,allowed_menus')
      .order('full_name');
    if (data) setTeamUsers(data.filter((u: TeamUser) => u.team_type === 'Team PTS'));
  };

  const fetchGuestUsersData = async () => {
    const { data } = await supabase.from('users')
      .select('id,username,full_name,role,phone_number,sales_division')
      .eq('role', 'guest').order('full_name');
    if (data) setGuestUsers(data as GuestUser[]);
  };

  const fetchReportList = useCallback(async () => {
    if (!currentUser) return;
    setListLoading(true);
    const data = await fetchReports({
      date: filterDate || undefined,
      userId: filterUser || undefined,
      isAdmin,
      currentUserId: currentUser.id,
    });
    setReports(data);
    setTimeout(() => setListLoading(false), 300);
  }, [currentUser, filterDate, filterUser, isAdmin]);

  useEffect(() => { fetchReportList(); }, [fetchReportList]);

  const loadActivities = useCallback(async (username: string, date: string) => {
    if (!username || !date) { setReminderActs([]); setTicketActs([]); return; }
    setActivitiesLoading(true);
    const [rem, tick] = await Promise.all([
      fetchReminderActivities(username, date),
      fetchTicketActivities(username, date),
    ]);
    setReminderActs(rem);
    setTicketActs(tick);
    setActivitiesLoading(false);
  }, []);

  useEffect(() => {
    if (view !== 'form') return;
    const username = isAdmin
      ? teamUsers.find(u => u.id === formUserId)?.username ?? ''
      : currentUser?.username ?? '';
    loadActivities(username, formDate);
  }, [formDate, formUserId, view, teamUsers]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginErr('');
    const { data, error } = await supabase.from('users').select('*')
      .eq('username', loginForm.username.trim()).eq('password', loginForm.password).maybeSingle();
    if (error || !data) { setLoginErr('Username atau password salah.'); return; }
    const allowedMenus: string[] = data.allowed_menus ?? [];
    if (data.role !== 'admin' && data.role !== 'superadmin' && !allowedMenus.includes('daily-report')) {
      setLoginErr('Akun kamu tidak memiliki akses ke Daily Report.'); return;
    }
    localStorage.setItem('currentUser', JSON.stringify(data));
    localStorage.setItem('loginTime', String(Date.now()));
    setCurrentUser(data); setIsLoggedIn(true); fetchReportList();
  };

  const openNewForm = async () => {
    const date = todayISO();
    const uid = isAdmin ? '' : currentUser?.id ?? '';
    setFormDate(date); setFormUserId(uid); setReminderNotes('');
    setManualActs([emptyManual(currentUser?.username ?? '')]);
    setEditingId(null); setReminderActs([]); setTicketActs([]);
    if (isAdmin) setTeamEntries(teamUsers.map(u => emptyTeamEntry(u)));
    else setTeamEntries([]);
    if (!isAdmin && currentUser?.username) {
      setActivitiesLoading(true);
      const [rem, tick] = await Promise.all([
        fetchReminderActivities(currentUser.username, date),
        fetchTicketActivities(currentUser.username, date),
      ]);
      setReminderActs(rem); setTicketActs(tick); setActivitiesLoading(false);
    }
    setView('form');
  };

  const openEditForm = async (report: DailyReport) => {
    setFormDate(report.report_date); setFormUserId(report.user_id);
    setReminderNotes(report.reminder_notes ?? '');
    setReminderActs(report.reminder_activities ?? []);
    setTicketActs(report.ticket_activities ?? []);
    setManualActs(
      (report.manual_activities ?? []).length
        ? report.manual_activities.map(m => ({ ...m, _key: newManualKey(), submitted_by: m.submitted_by ?? report.created_by }))
        : [emptyManual(currentUser?.username ?? '')]
    );
    setEditingId(report.id);
    const username = isAdmin
      ? teamUsers.find(u => u.id === report.user_id)?.username ?? ''
      : currentUser?.username ?? '';
    loadActivities(username, report.report_date);
    setView('form');
  };

  const handleSave = async () => {
    const targetUserId = isAdmin ? formUserId : currentUser?.id ?? '';
    const targetUser   = teamUsers.find(u => u.id === targetUserId) ?? currentUser;
    if (!formDate)     { notify('error', 'Tanggal wajib dipilih!'); return; }
    if (!targetUserId) { notify('error', 'Pilih anggota team!'); return; }
    for (const m of manualActs) {
      if (!m.project_name.trim() && (m.address.trim() || m.description.trim())) {
        notify('error', 'Nama project wajib diisi!'); return;
      }
    }
    if (!editingId) {
      const existing = await fetchExistingReport(targetUserId, formDate);
      if (existing) { notify('error', `Report ${targetUser?.full_name} ${formatDate(formDate)} sudah ada! Gunakan Edit.`); return; }
    }
    setSaving(true);
    const cleanManual = manualActs
      .filter(m => m.project_name.trim() || m.description.trim())
      .map(({ _key, ...rest }) => ({ ...rest, submitted_by: rest.submitted_by || currentUser?.username || 'system' }));
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      report_date: formDate, user_id: targetUserId,
      user_name: targetUser?.full_name ?? '', sales_division: targetUser?.sales_division ?? '',
      reminder_activities: reminderActs, ticket_activities: ticketActs,
      manual_activities: cleanManual, reminder_notes: reminderNotes,
      created_by: currentUser?.username ?? 'system',
    };
    const result = await saveReport(payload as any);
    if (!result.ok) { notify('error', 'Gagal menyimpan: ' + result.error); setSaving(false); return; }
    if (isAdmin && teamEntries.length) {
      const cleanTeam = teamEntries.filter(e => e.project_name.trim())
        .map(({ _key, ...rest }) => ({ ...rest, report_date: formDate, source: 'manual' as const }));
      if (cleanTeam.length) {
        const tr = await saveTeamEntries(cleanTeam as any, formDate, currentUser?.username ?? '');
        if (!tr.ok) notify('error', 'Report tersimpan, team entries gagal: ' + tr.error);
      }
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

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: PAGE_BG }}>
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm border border-white/20 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-4xl">📋</span>
            <h1 className="text-xl font-bold text-white mt-2">Daily Report</h1>
            <p className="text-white/60 text-sm mt-1">PTS IVP &amp; MLDS</p>
          </div>
          <div className="space-y-3">
            <input value={loginForm.username} onChange={e => setLoginForm(p => ({ ...p, username: e.target.value }))}
              placeholder="Username" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
            <input type="password" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Password" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
            {loginErr && <p className="text-red-300 text-xs">{loginErr}</p>}
            <button onClick={handleLogin}
              className="w-full py-3 rounded-xl font-bold text-sm text-white hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>Masuk</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail ────────────────────────────────────────────────────────────────
  if (view === 'detail' && detailReport) {
    const allCats = [
      ...detailReport.reminder_activities.map(r => r.category),
      ...detailReport.ticket_activities.map(t => t.issue_case),
      ...detailReport.manual_activities.map(m => m.category),
    ];
    const catCount: Record<string, number> = {};
    allCats.forEach(c => { catCount[c] = (catCount[c] ?? 0) + 1; });

    return (
      <div className="fixed inset-0 overflow-y-auto" style={{ background: PAGE_BG }}>
        {/* Header */}
        <div className="sticky top-0 z-30 backdrop-blur-lg border-b border-white/10"
          style={{ background: 'rgba(30,30,46,0.9)' }}>
          <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
            <button onClick={() => { setView('list'); setDetailReport(null); }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">Detail Daily Report</h2>
              <p className="text-white/50 text-xs truncate">{detailReport.user_name} · {formatDate(detailReport.report_date)}</p>
            </div>
            <button onClick={() => openEditForm(detailReport)}
              className="px-4 py-2 rounded-xl font-semibold text-sm text-white hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}>
              ✏️ Edit
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-5 py-5 space-y-4 pb-10">
          {/* Kategori chips */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(catCount).map(([cat, cnt]) => {
              const c = CATEGORY_CONFIG[cat] ?? { icon: '📌', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.4)', accent: '#64748b' };
              return (
                <span key={cat} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                  {c.icon} {cat} ({cnt})
                </span>
              );
            })}
          </div>

          {/* Auto activities */}
          {(detailReport.reminder_activities.length > 0 || detailReport.ticket_activities.length > 0) && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Aktivitas dari Platform</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>AUTO</span>
              </div>
              {detailReport.reminder_activities.length > 0 && (
                <div className="px-5 py-3 border-b border-gray-50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">🔔 Reminder Schedule ({detailReport.reminder_activities.length})</p>
                  <div className="space-y-2">
                    {detailReport.reminder_activities.map((r, i) => {
                      const c = CATEGORY_CONFIG[r.category] ?? CATEGORY_CONFIG['Internal'];
                      const sb = statusBadge(r.status);
                      return (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                          style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                          <span className="text-lg mt-0.5">{c.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold" style={{ color: c.accent }}>{r.project_name}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>{sb.label}</span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: c.color }}>{r.category} · {r.due_time || '-'}</p>
                            {r.address && <p className="text-xs text-slate-500 mt-0.5">📍 {r.address}</p>}
                            {r.sales_name && <p className="text-xs text-slate-500">👤 {r.sales_name}{r.sales_division ? ` · ${r.sales_division}` : ''}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {detailReport.reminder_notes && (
                    <div className="mt-2 px-3 py-2 rounded-xl" style={{ background: '#fef9c3', border: '1px solid #fde047' }}>
                      <p className="text-xs text-yellow-700">📝 {detailReport.reminder_notes}</p>
                    </div>
                  )}
                </div>
              )}
              {detailReport.ticket_activities.length > 0 && (
                <div className="px-5 py-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">🎫 Ticket ({detailReport.ticket_activities.length})</p>
                  <div className="space-y-2">
                    {detailReport.ticket_activities.map((t, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)' }}>
                        <span className="text-lg mt-0.5">🔧</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{t.project_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{t.issue_case} · {t.log_time}</p>
                          {t.address && <p className="text-xs text-slate-400 mt-0.5">📍 {t.address}</p>}
                          <p className="text-xs text-slate-600 mt-1 font-medium">{t.action_taken}</p>
                          <p className="text-xs font-semibold mt-0.5" style={{ color: '#10b981' }}>→ {t.new_status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual */}
          {detailReport.manual_activities.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Aktivitas Manual</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>{detailReport.manual_activities.length}</span>
              </div>
              {detailReport.manual_activities.map((m, i) => {
                const c = CATEGORY_CONFIG[m.category] ?? CATEGORY_CONFIG['Internal'];
                return (
                  <div key={i} className="px-5 py-4 border-b border-gray-50 last:border-0">
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">{m.project_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{m.category}</p>
                        {m.address && <p className="text-xs text-slate-400 mt-0.5">📍 {m.address}</p>}
                        {m.sales_name && <p className="text-xs text-slate-400">👤 {m.sales_name}{m.sales_division ? ` · ${m.sales_division}` : ''}</p>}
                        {m.pic_name && <p className="text-xs text-slate-400">🙋 {m.pic_name}{m.pic_phone ? ` - ${m.pic_phone}` : ''}</p>}
                        {m.description && <p className="text-xs text-slate-600 mt-1">{m.description}</p>}
                        {m.submitted_by && <p className="text-xs text-slate-400 mt-0.5">✍️ @{m.submitted_by}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  if (view === 'form') {
    const targetUser = isAdmin ? teamUsers.find(u => u.id === formUserId) : currentUser;
    const autoCount = reminderActs.length + ticketActs.length;

    return (
      <div className="fixed inset-0 overflow-y-auto" style={{ background: PAGE_BG }}>
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 backdrop-blur-lg border-b border-white/10"
          style={{ background: 'rgba(30,30,46,0.9)' }}>
          <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
            <button onClick={() => { setView('list'); setEditingId(null); }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white">{editingId ? '✏️ Edit Report' : '📋 Daily Report Baru'}</h2>
              <p className="text-white/50 text-xs">
                {activitiesLoading ? 'Memuat aktivitas dari platform...'
                  : autoCount > 0 ? `${autoCount} aktivitas auto (Reminder & Ticket)`
                  : 'Isi aktivitas harian'}
              </p>
            </div>
            {activitiesLoading
              ? <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(14,165,233,0.15)', color: '#7dd3fc' }}>
                  <div className="w-3 h-3 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" /> Loading...
                </div>
              : autoCount > 0
                ? <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}>✓ {autoCount} Auto</div>
                : null}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-5 py-5 space-y-4 pb-10">

          {/* ── Identitas ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <span className="text-base">👤</span>
              <span className="text-sm font-bold text-slate-700">Identitas &amp; Tanggal</span>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <FormField label="Tanggal Report *">
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className={inputCls} style={inputStyle} />
                </FormField>
                {isAdmin && (
                  <FormField label="Anggota Team *">
                    <select value={formUserId} onChange={e => setFormUserId(e.target.value)}
                      className={inputCls} style={inputStyle}>
                      <option value="">-- Pilih anggota --</option>
                      {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </FormField>
                )}
              </div>
              {targetUser && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: avatarColor(targetUser.full_name) }}>
                    {initials(targetUser.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{targetUser.full_name}</p>
                    <p className="text-xs text-slate-500">{targetUser.team_type} · {targetUser.sales_division || '-'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Auto activities summary ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <span className="text-sm font-bold text-slate-700">Aktivitas Ter-generate Otomatis</span>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full"
                style={{ background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>Auto</span>
            </div>
            {activitiesLoading ? (
              <div className="px-5 py-5 flex items-center gap-3 text-slate-400 text-sm">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
                Memuat dari Reminder Schedule &amp; Ticketing...
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  {/* Reminder card */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 min-w-[150px]"
                    style={{
                      background: reminderActs.length > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.03)',
                      border: reminderActs.length > 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(0,0,0,0.08)',
                    }}>
                    <span className="text-2xl">🔔</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: reminderActs.length > 0 ? '#059669' : '#94a3b8' }}>
                        {reminderActs.length} Jadwal Reminder
                      </p>
                      <p className="text-[10px] text-slate-400">dari Reminder Schedule</p>
                    </div>
                    {reminderActs.length > 0 && <span className="text-emerald-500 font-bold text-lg">✓</span>}
                  </div>
                  {/* Ticket card */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 min-w-[150px]"
                    style={{
                      background: ticketActs.length > 0 ? 'rgba(251,113,133,0.08)' : 'rgba(0,0,0,0.03)',
                      border: ticketActs.length > 0 ? '1px solid rgba(251,113,133,0.3)' : '1px solid rgba(0,0,0,0.08)',
                    }}>
                    <span className="text-2xl">🎫</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: ticketActs.length > 0 ? '#e11d48' : '#94a3b8' }}>
                        {ticketActs.length} Ticket Dikerjakan
                      </p>
                      <p className="text-[10px] text-slate-400">dari Ticket Troubleshooting</p>
                    </div>
                    {ticketActs.length > 0 && <span className="text-rose-500 font-bold text-lg">✓</span>}
                  </div>
                </div>
                {reminderActs.length === 0 && ticketActs.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-1">
                    {formUserId || !isAdmin ? 'Tidak ada aktivitas auto pada tanggal ini.' : 'Pilih anggota team untuk memuat.'}
                  </p>
                )}
                {reminderActs.length > 0 && (
                  <FormField label="Catatan Tambahan Reminder (Opsional)">
                    <textarea value={reminderNotes} onChange={e => setReminderNotes(e.target.value)}
                      rows={2} className={`${inputCls} resize-none`} style={inputStyle}
                      placeholder="Kendala, hasil, atau info tambahan dari jadwal hari ini..." />
                  </FormField>
                )}
              </div>
            )}
          </div>

          {/* ── Manual ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">✍️</span>
                <span className="text-sm font-bold text-slate-700">Aktivitas Manual</span>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>Manual</span>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Submitter info */}
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: avatarColor(currentUser?.full_name ?? '') }}>
                  {initials(currentUser?.full_name ?? 'U')}
                </div>
                <div>
                  <p className="text-xs font-semibold text-sky-800">Diisi oleh: {currentUser?.full_name}</p>
                  <p className="text-[10px] text-sky-600">@{currentUser?.username} · Aktivitas manual tercatat atas nama kamu</p>
                </div>
              </div>

              {manualActs.map((m, idx) => (
                <div key={m._key} className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <SectionHeaderSmall icon="📌" title={`Aktivitas #${idx + 1}`} />
                    {manualActs.length > 1 && (
                      <button onClick={() => removeManual(m._key)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">Hapus</button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Kategori *</label>
                    <CategoryPicker value={m.category} onChange={v => updateManual(m._key, { category: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Nama Project / Keterangan *">
                      <input value={m.project_name} onChange={e => updateManual(m._key, { project_name: e.target.value })}
                        className={inputCls} style={inputStyle} placeholder="cth: Rapat internal divisi" />
                    </FormField>
                    <FormField label="Lokasi / Alamat">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2">📍</span>
                        <input value={m.address} onChange={e => updateManual(m._key, { address: e.target.value })}
                          className={`${inputCls} pl-9`} style={inputStyle} placeholder="cth: Kantor / Online" />
                      </div>
                    </FormField>
                  </div>
                  <FormField label="Sales">
                    <SalesDropdown value={m.sales_name} division={m.sales_division} guestUsers={guestUsers}
                      onChange={(name, div) => updateManual(m._key, { sales_name: name, sales_division: div })} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Nama PIC (Opsional)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2">🙋</span>
                        <input value={m.pic_name} onChange={e => updateManual(m._key, { pic_name: e.target.value })}
                          className={`${inputCls} pl-9`} style={inputStyle} placeholder="Nama PIC di lokasi" />
                      </div>
                    </FormField>
                    <FormField label="No. PIC (Opsional)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2">📱</span>
                        <input type="tel" value={m.pic_phone} onChange={e => updateManual(m._key, { pic_phone: e.target.value })}
                          className={`${inputCls} pl-9`} style={inputStyle} placeholder="08xxx" />
                      </div>
                    </FormField>
                  </div>
                  <FormField label="Deskripsi Kegiatan">
                    <textarea value={m.description} onChange={e => updateManual(m._key, { description: e.target.value })}
                      rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Detail kegiatan..." />
                  </FormField>
                </div>
              ))}

              <button onClick={addManual}
                className="w-full py-3 rounded-xl font-semibold text-sm hover:scale-[1.01] transition-all"
                style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1.5px dashed rgba(220,38,38,0.35)' }}>
                + Tambah Aktivitas Manual
              </button>
            </div>
          </div>

          {/* ── Team Entries (admin) ── */}
          {isAdmin && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">👥</span>
                  <span className="text-sm font-bold text-slate-700">Insert Report Tim (Supervisor)</span>
                </div>
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>Manual</span>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <span className="text-base">💡</span>
                  <p className="text-xs text-sky-700">Form ini untuk input manual harian per anggota. <strong>Kosongkan baris yang tidak ada kegiatannya.</strong></p>
                </div>
                {teamEntries.map(e => (
                  <div key={e._key} className="rounded-xl p-4 space-y-3"
                    style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: avatarColor(e.member_name) }}>
                        {initials(e.member_name)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{e.member_name}</p>
                        <p className="text-xs text-slate-400">{e.sales_division || 'Team PTS'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Kategori</label>
                      <CategoryPicker value={e.category} onChange={v => updateTeamEntry(e._key, { category: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Nama Project">
                        <input value={e.project_name} onChange={ev => updateTeamEntry(e._key, { project_name: ev.target.value })}
                          className={inputCls} style={inputStyle} placeholder="cth: Konfigurasi NVR" />
                      </FormField>
                      <FormField label="Lokasi / Alamat">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2">📍</span>
                          <input value={e.address} onChange={ev => updateTeamEntry(e._key, { address: ev.target.value })}
                            className={`${inputCls} pl-9`} style={inputStyle} placeholder="cth: Kantor pelanggan" />
                        </div>
                      </FormField>
                    </div>
                    <FormField label="Sales">
                      <SalesDropdown value={e.sales_name} division={e.sales_division} guestUsers={guestUsers}
                        onChange={(name, div) => updateTeamEntry(e._key, { sales_name: name, sales_division: div })} />
                    </FormField>
                    <FormField label="Catatan Supervisor">
                      <textarea value={e.supervisor_notes} onChange={ev => updateTeamEntry(e._key, { supervisor_notes: ev.target.value })}
                        rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Hasil kerja, kendala, penilaian..." />
                    </FormField>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Simpan ── */}
          <div className="flex gap-3 pb-4">
            <button onClick={() => { setView('list'); setEditingId(null); }}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
              Batal
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 4px 14px rgba(220,38,38,0.35)' }}>
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingId ? 'Simpan Perubahan' : '📋 Simpan Daily Report'}
            </button>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl"
            style={{ background: toast.type === 'success' ? '#10b981' : '#ef4444', color: 'white', maxWidth: '320px' }}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  const totalActivities = (r: DailyReport) =>
    r.reminder_activities.length + r.ticket_activities.length + r.manual_activities.length;

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: PAGE_BG }}>

      {/* Sticky Header */}
      <div className="sticky top-0 z-30 backdrop-blur-lg border-b border-white/10"
        style={{ background: 'rgba(30,30,46,0.9)' }}>
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">📋 Daily Report</h1>
            <p className="text-white/50 text-xs mt-0.5">PTS IVP &amp; MLDS · {currentUser?.full_name}</p>
          </div>
          <button onClick={openNewForm}
            className="px-4 py-2 rounded-xl font-bold text-sm text-white hover:scale-[1.02] transition-all flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Buat Report
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-5 space-y-4 pb-10">

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Report', value: reports.length, gradient: 'linear-gradient(135deg,#4f46e5,#6d28d9)', icon: '📋', shadow: 'rgba(79,70,229,0.35)' },
            { label: 'Bulan Ini',    value: reports.filter(r => r.report_date?.startsWith(new Date().toISOString().slice(0,7))).length, gradient: 'linear-gradient(135deg,#0891b2,#0e7490)', icon: '📅', shadow: 'rgba(8,145,178,0.35)' },
            { label: 'Total Aktivitas', value: reports.reduce((s, r) => s + totalActivities(r), 0), gradient: 'linear-gradient(135deg,#059669,#047857)', icon: '⚡', shadow: 'rgba(5,150,105,0.35)' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2"
              style={{ background: card.gradient, boxShadow: `0 4px 16px ${card.shadow}` }}>
              <div className="absolute right-3 top-2 text-4xl opacity-[0.15] select-none">{card.icon}</div>
              <span className="text-3xl font-black text-white leading-none">{card.value}</span>
              <p className="text-xs font-bold text-white/80">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Filter &amp; Cari</span>
            {(filterDate || filterUser) && (
              <button onClick={() => { setFilterDate(''); setFilterUser(''); }}
                className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors">Reset</button>
            )}
          </div>
          <div className="px-5 py-3">
            <div className={`grid gap-2 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tanggal</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)', color: '#1e293b' }} />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Anggota</label>
                  <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.1)', color: '#1e293b' }}>
                    <option value="">Semua anggota</option>
                    {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.4)' }}>
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Daily Report List</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{reports.length}</span>
            </div>
            <button onClick={fetchReportList} disabled={listLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 border border-gray-200 text-gray-600 bg-white disabled:opacity-60 transition-all">
              <svg className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {listLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              <span className="text-sm">Memuat report...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-4">📋</div>
              <p className="font-semibold text-slate-500">Belum ada Daily Report</p>
              <p className="text-sm mt-1 text-slate-400">Klik &quot;Buat Report&quot; untuk mulai</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {reports.map(r => {
                const allCats = [
                  ...r.reminder_activities.map(a => a.category),
                  ...r.ticket_activities.map(a => a.issue_case),
                  ...r.manual_activities.map(a => a.category),
                ];
                const uniqueCats = [...new Set(allCats)];
                const total = totalActivities(r);
                return (
                  <div key={r.id} className="px-5 py-4 cursor-pointer hover:bg-gray-50/80 transition-all"
                    onClick={() => { setDetailReport(r); setView('detail'); }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: avatarColor(r.user_name) }}>
                        {initials(r.user_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">{r.user_name}</p>
                          {r.sales_division && <span className="text-[10px] text-slate-400">{r.sales_division}</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.report_date)}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {r.reminder_activities.length > 0 && <span className="text-[10px] text-emerald-600 font-semibold">🔔 {r.reminder_activities.length} reminder</span>}
                          {r.ticket_activities.length > 0 && <span className="text-[10px] text-rose-500 font-semibold">🎫 {r.ticket_activities.length} ticket</span>}
                          {r.manual_activities.length > 0 && <span className="text-[10px] text-amber-600 font-semibold">✍️ {r.manual_activities.length} manual</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {uniqueCats.slice(0, 3).map(cat => {
                            const c = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG['Internal'];
                            return (
                              <span key={cat} className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: c.bg, color: c.accent, border: `1px solid ${c.border}` }}>
                                {c.icon} {cat}
                              </span>
                            );
                          })}
                          {uniqueCats.length > 3 && <span className="text-[9px] text-slate-400">+{uniqueCats.length - 3} lainnya</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-slate-600">{total} aktivitas</span>
                        <button onClick={ev => { ev.stopPropagation(); openEditForm(r); }}
                          className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all">
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl"
          style={{ background: toast.type === 'success' ? '#10b981' : '#ef4444', color: 'white', maxWidth: '320px' }}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}
    </div>
  );
}
