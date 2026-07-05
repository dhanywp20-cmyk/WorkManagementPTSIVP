'use client';

/**
 * analytics-dashboard/page.tsx  —  Analytics Platform
 *
 * Tab order (default: Dashboard Analytics first):
 *   1. Dashboard Analytics — full DashboardKPI component (original KPI view)
 *   2. Command Center      — live bottleneck alerts, My Tasks, Aktivitas Terbaru
 *   3. Audit Log           — audit_trail + activity_logs (historical ticketing logs)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import DashboardKPI from '@/app/kpi-team/_components/DashboardKPI';
import { User as DashUser } from '@/app/dashboard/_components/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id: string; full_name: string; role: string;
  team_type?: string; jabatan?: string; allowed_menus?: string[];
  username?: string; sales_division?: string;
}

interface TicketRow   { id: string; project_name: string; assign_name: string; status: string; date: string; created_at: string; }
interface ReminderRow { id: string; project_name: string; notes: string; due_date: string; status: string; assign_name: string; assigned_to: string; category: string; created_at: string; }
interface ProjectRow  { id: string; project_name: string; sales_name: string; status: string; created_at: string; }

interface AuditRow {
  id: string; user_name: string; action: string; module: string;
  target_name: string | null; old_value: string | null; new_value: string | null;
  notes: string | null; created_at: string;
  source: 'audit_trail' | 'activity_logs';
}

interface Stats {
  ticketOpen: number; ticketOverdue: number;
  reminderPending: number; projectPending: number; userPending: number;
  overdueTickets: TicketRow[]; pendingReminders: ReminderRow[];
  pendingProjects: ProjectRow[];
  myOpenTickets: TicketRow[]; myTodayReminders: ReminderRow[];
  activity: { id: string; label: string; sub: string; time: string; dot: string }[];
}

type Tab = 'kpi' | 'command' | 'audit';

// ── Small helper components ───────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, gradient, alert }: {
  icon: string; label: string; value: number; sub?: string; gradient: string; alert?: number;
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{ background: gradient, boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}>
      {(alert ?? 0) > 0 && (
        <div className="absolute top-2.5 right-2.5 min-w-[20px] h-5 rounded-full bg-yellow-400
          flex items-center justify-center text-[10px] font-black text-yellow-900 px-1 shadow">
          {(alert ?? 0) > 99 ? '99+' : alert}
        </div>
      )}
      <div className="text-2xl mb-2 opacity-80 select-none">{icon}</div>
      <div className="text-3xl font-black text-white tabular-nums leading-none">{value}</div>
      <div className="text-sm font-bold text-white/90 mt-1 leading-tight">{label}</div>
      {sub && <div className="text-xs text-white/60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Panel({ title, icon, color, borderClr, count, children }: {
  title: string; icon: string; color: string; borderClr: string; count?: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'rgba(255,255,255,0.97)', border: `1px solid ${borderClr}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ background: `${color}10`, borderBottom: `1px solid ${borderClr}` }}>
        <span className="text-base select-none">{icon}</span>
        <span className="font-bold text-sm flex-1" style={{ color }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-56 p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Empty({ emoji, msg }: { emoji: string; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <span className="text-3xl select-none">{emoji}</span>
      <p className="text-xs font-medium text-gray-400 text-center">{msg}</p>
    </div>
  );
}

function Row({ dot, title, sub, badge, badgeBg, badgeColor, badgeBorder }: {
  dot: string; title: string; sub: string;
  badge?: string; badgeBg?: string; badgeColor?: string; badgeBorder?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-xl"
      style={{ background: `${dot}0C`, border: `1px solid ${dot}20` }}>
      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: dot }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{sub}</p>
      </div>
      {badge && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 mt-0.5"
          style={{ background: badgeBg ?? '#f3f4f6', color: badgeColor ?? '#374151', border: `1px solid ${badgeBorder ?? '#d1d5db'}` }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Action badge colors ───────────────────────────────────────────────────────
const ACTION_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  create:        { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  approve:       { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  mark_done:     { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  Solved:        { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  update:        { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  assign:        { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  status_change: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  export:        { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  delete:        { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  reject:        { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  Overdue:       { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  login:         { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  logout:        { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  'In Progress': { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  'Waiting Approval': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
};

const MODULE_ICON: Record<string, string> = {
  ticket: '🎫', reminder: '📅', project: '🏗️', piket: '🏪',
  kpi: '📊', incentive: '💰', movement: '🚚', user: '👥',
  learning: '🎓', 'tech-note': '📝', 'form-review': '⭐',
  'daily-report': '📈', system: '⚙️',
};

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ label, icon, active, onClick, badge }: {
  label: string; icon: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all relative whitespace-nowrap"
      style={active
        ? { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }
        : { background: 'rgba(0,0,0,0.04)', color: '#6b7280' }}>
      <span className="select-none">{icon}</span>
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-black px-1"
          style={{ background: active ? 'rgba(255,255,255,0.3)' : '#ef4444', color: 'white' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnalyticsPlatform({ embedded = false, injectedUser }: { embedded?: boolean; injectedUser?: User } = {}) {
  const [user,    setUser]    = useState<User | null>(injectedUser ?? null);
  const [auth,    setAuth]    = useState<'checking' | 'ok' | 'denied'>(injectedUser ? 'ok' : 'checking');
  const [tab,     setTab]     = useState<Tab>('kpi');   // Default: Dashboard Analytics
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Audit log state
  const [auditRows,    setAuditRows]    = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModule,  setAuditModule]  = useState('All');
  const [auditAction,  setAuditAction]  = useState('All');
  const [auditSearch,  setAuditSearch]  = useState('');
  const [auditPage,    setAuditPage]    = useState(0);
  const AUDIT_PAGE_SIZE = 30;

  useEffect(() => {
    // Embedded (di dashboard): user sudah di-inject & sudah lolos gate canAccessAnalytics.
    if (injectedUser) { setUser(injectedUser); setAuth('ok'); return; }
    const u = getSession<User>();
    if (!u) { const tgt = window.top !== window ? window.top : window; if (tgt) tgt.location.href = '/dashboard'; return; }
    const r = (u.role ?? '').toLowerCase();
    const ok = ['admin','superadmin'].includes(r)
      || (r === 'team' && u.jabatan === 'Supervisor')
      || (['guest','sales'].includes(r) && ['Supervisor','Manager','Deputy General Manager','General Manager','Direktur'].includes(u.jabatan ?? ''))
      || (r === 'team' && (u.allowed_menus ?? []).includes('dashboard'));
    setUser(u); setAuth(ok ? 'ok' : 'denied');
    return startSessionWatcher();
  }, [injectedUser]);

  const today = new Date().toISOString().split('T')[0];

  // ── Load Command Center stats ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tRes, rRes, pRes, uRes] = await Promise.all([
        supabase.from('tickets').select('id,project_name,assign_name,status,date,created_at').not('status','eq','Solved').order('created_at',{ascending:false}).limit(100),
        supabase.from('reminders').select('id,project_name,notes,due_date,status,assign_name,assigned_to,category,created_at').not('status','in','("done","cancelled")').order('created_at',{ascending:false}).limit(100),
        supabase.from('project_requests').select('id,project_name,sales_name,status,created_at').in('status',['pending','approved','in_progress']).order('created_at',{ascending:false}).limit(30),
        supabase.from('users').select('id',{count:'exact',head:true}).eq('team_type','Pending Approval'),
      ]);
      const tickets   = (tRes.data ?? []) as TicketRow[];
      const reminders = (rRes.data ?? []) as ReminderRow[];
      const projects  = (pRes.data ?? []) as ProjectRow[];
      const overdueTickets   = tickets.filter(t => t.status === 'Overdue');
      const openTickets      = tickets.filter(t => !['Solved','Overdue'].includes(t.status));
      const pendingReminders = reminders.filter(r => !r.assigned_to || r.assigned_to === '');
      const pendingProjects  = projects.filter(p => p.status === 'pending');
      const myTickets        = tickets.filter(t => t.assign_name === user.full_name && t.status !== 'Solved');
      const myToday          = reminders.filter(r => r.assign_name === user.full_name && r.due_date === today);
      const activity = [
        ...tickets.slice(0,4).map(t => ({ id:t.id, label:t.project_name, sub:`🎫 ${t.assign_name} · ${t.status}`, time:t.created_at, dot:'#dc2626' })),
        ...reminders.filter(r=>r.assign_name).slice(0,4).map(r => ({ id:r.id, label:r.project_name, sub:`📅 ${r.category} · ${r.assign_name}`, time:r.created_at, dot:'#2563eb' })),
      ].sort((a,b) => new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,8);
      setStats({
        ticketOpen: openTickets.length, ticketOverdue: overdueTickets.length,
        reminderPending: pendingReminders.length, projectPending: pendingProjects.length,
        userPending: (uRes as any).count ?? 0,
        overdueTickets: overdueTickets.slice(0,6), pendingReminders: pendingReminders.slice(0,6),
        pendingProjects: pendingProjects.slice(0,6),
        myOpenTickets: myTickets.slice(0,6), myTodayReminders: myToday.slice(0,6),
        activity,
      });
    } catch (e) { console.error('[CC]', e); }
    setLoading(false);
  }, [user, today]);

  // ── Load Audit Log — gabungan audit_trail + activity_logs ────────────────
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      // 1. New audit_trail table (platform-wide structured audit)
      const auditQ = supabase
        .from('audit_trail')
        .select('id,user_name,action,module,target_name,old_value,new_value,notes,created_at')
        .order('created_at', { ascending: false })
        .limit(300);

      // 2. Legacy activity_logs table (ticketing per-ticket activity — historical)
      const actQ = supabase
        .from('activity_logs')
        .select('id,handler_name,action_taken,new_status,notes,created_at,ticket_id')
        .order('created_at', { ascending: false })
        .limit(300);

      const [auditRes, actRes] = await Promise.all([auditQ, actQ]);

      // Map audit_trail rows
      const fromAudit: AuditRow[] = ((auditRes.data ?? []) as any[]).map(r => ({
        id:          r.id,
        user_name:   r.user_name ?? '—',
        action:      r.action ?? '—',
        module:      r.module ?? '—',
        target_name: r.target_name ?? null,
        old_value:   r.old_value ?? null,
        new_value:   r.new_value ?? null,
        notes:       r.notes ?? null,
        created_at:  r.created_at,
        source:      'audit_trail' as const,
      }));

      // Map activity_logs rows → same AuditRow shape
      const fromActivity: AuditRow[] = ((actRes.data ?? []) as any[]).map(r => ({
        id:          r.id,
        user_name:   r.handler_name ?? '—',
        action:      r.action_taken ?? r.new_status ?? '—',
        module:      'ticket',
        target_name: r.ticket_id ? `Tiket #${String(r.ticket_id).slice(0,8)}` : null,
        old_value:   null,
        new_value:   r.new_status ?? null,
        notes:       r.notes ?? null,
        created_at:  r.created_at,
        source:      'activity_logs' as const,
      }));

      // Merge + sort by created_at desc
      const merged = [...fromAudit, ...fromActivity]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Apply module/action filters
      const filtered = merged.filter(row => {
        const moduleMatch = auditModule === 'All' || row.module === auditModule;
        const actionMatch = auditAction === 'All' || row.action === auditAction || row.new_value === auditAction;
        return moduleMatch && actionMatch;
      });

      setAuditRows(filtered);
      setAuditPage(0);
    } catch (e) {
      console.error('[Audit]', e);
      setAuditRows([]);
    }
    setAuditLoading(false);
  }, [auditModule, auditAction]);

  useEffect(() => {
    if (auth !== 'ok' || !user) return;
    loadStats();
    const chs = [
      supabase.channel('cc-t').on('postgres_changes',{event:'*',schema:'public',table:'tickets'},loadStats).subscribe(),
      supabase.channel('cc-r').on('postgres_changes',{event:'*',schema:'public',table:'reminders'},loadStats).subscribe(),
      supabase.channel('cc-p').on('postgres_changes',{event:'*',schema:'public',table:'project_requests'},loadStats).subscribe(),
    ];
    // Polling fallback — realtime can miss events in iframe context
    const poll = setInterval(loadStats, 30000);
    return () => { chs.forEach(c => supabase.removeChannel(c)); clearInterval(poll); };
  }, [auth, user, loadStats]);

  useEffect(() => {
    if (auth !== 'ok' || tab !== 'audit') return;
    loadAudit();
  }, [auth, tab, loadAudit]);

  const fmtD  = (d: string) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); } catch { return d; } };
  const fmtDT = (d: string) => { if (!d) return '—'; try { return new Date(d).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); } catch { return d; } };
  const rel   = (d: string) => { if (!d) return ''; const m=Math.floor((Date.now()-new Date(d).getTime())/60000); if(m<1)return 'Baru'; if(m<60)return `${m}m`; const h=Math.floor(m/60); if(h<24)return `${h}j`; return `${Math.floor(h/24)}h`; };
  const greeting = () => { const h = new Date().getHours(); return h<11?'Selamat Pagi':h<15?'Selamat Siang':h<18?'Selamat Sore':'Selamat Malam'; };

  const totalAlerts = (stats?.ticketOverdue ?? 0) + (stats?.reminderPending ?? 0) + (stats?.userPending ?? 0);

  // Audit filtered + paged (search on top of already-filtered rows)
  const auditFiltered = auditRows.filter(a => {
    if (!auditSearch) return true;
    const q = auditSearch.toLowerCase();
    return (a.user_name ?? '').toLowerCase().includes(q)
      || (a.target_name ?? '').toLowerCase().includes(q)
      || (a.module ?? '').toLowerCase().includes(q)
      || (a.action ?? '').toLowerCase().includes(q);
  });
  const auditPaged      = auditFiltered.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE);
  const auditTotalPages = Math.ceil(auditFiltered.length / AUDIT_PAGE_SIZE);

  const AUDIT_MODULES = ['All','ticket','reminder','project','piket','kpi','incentive','movement','user','learning','system'];
  const AUDIT_ACTIONS = ['All','create','update','delete','approve','reject','assign','status_change','login','logout','export','mark_done','Solved','Overdue','In Progress','Waiting Approval'];

  // ── Auth screens ──────────────────────────────────────────────────────────
  if (auth === 'denied') return (
    <div className="flex items-center justify-center h-screen" style={{backgroundImage:'url(/IVP_Background.png)',backgroundSize:'cover'}}>
      <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
        <div className="text-5xl mb-3">🔒</div>
        <p className="font-bold text-gray-800">Akses Ditolak</p>
      </div>
    </div>
  );

  if (auth === 'checking' || !user) return (
    <div className="flex items-center justify-center h-screen bg-cover bg-center" style={{backgroundImage:'url(/IVP_Background.png)'}}>
      <div className="flex flex-col items-center gap-4 bg-white/85 backdrop-blur-md rounded-2xl px-10 py-8">
        <div className="w-10 h-10 rounded-full border-4 border-t-amber-500 border-amber-200 animate-spin" />
        <p className="text-gray-700 font-semibold text-sm">Memuat Analytics Platform...</p>
      </div>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={embedded ? 'flex flex-col w-full' : 'flex flex-col bg-cover bg-center bg-fixed'}
      style={embedded ? undefined : { height: '100dvh', backgroundImage: 'url(/IVP_Background.png)' }}>

      {embedded && (
        /* Embedded (di dashboard): tab bar ramping saja — banner besar disembunyikan
           supaya tidak terlihat seperti aplikasi/modal nested. */
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <TabBtn label="Analytics"      icon="📊" active={tab==='kpi'}     onClick={() => setTab('kpi')} />
          <TabBtn label="Command Center" icon="🏠" active={tab==='command'} onClick={() => setTab('command')} badge={totalAlerts || undefined} />
          <TabBtn label="Audit Log"      icon="📋" active={tab==='audit'}   onClick={() => setTab('audit')} badge={auditRows.length > 0 ? auditRows.length : undefined} />
          <button onClick={() => { loadStats(); if (tab === 'audit') loadAudit(); }} title="Refresh"
            className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)' }}>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
      )}

      {/* ── HEADER — full width, same style as PageHeader used in other platforms ── */}
      {!embedded && (
      <header className="flex-shrink-0 z-50"
        style={{background:'rgba(255,255,255,0.95)',backdropFilter:'blur(16px)',borderBottom:'3px solid #f59e0b'}}>
        <div className="max-w-[1600px] mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button
              className="flex items-center gap-3 text-left"
              onClick={() => setTab('kpi')}
              title="Kembali ke Dashboard Analytics"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',boxShadow:'0 3px 12px #f59e0b40'}}>
                <span className="text-lg">📊</span>
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight leading-tight" style={{color:'#d97706'}}>Analytics Platform</h1>
                <p className="text-[10px] text-slate-500 font-medium">Work Management PTS · {greeting()}, {user.full_name}</p>
              </div>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {totalAlerts > 0
                ? <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:'#fee2e2',border:'1px solid #fca5a5'}}>
                    <span className="text-base animate-pulse select-none">⚠️</span>
                    <div>
                      <p className="text-sm font-black text-red-700">{totalAlerts} item perlu perhatian</p>
                      <p className="text-xs text-red-400">Lihat Command Center</p>
                    </div>
                  </div>
                : <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:'#d1fae5',border:'1px solid #6ee7b7'}}>
                    <span className="text-base select-none">✅</span>
                    <p className="text-sm font-bold text-emerald-700">Platform berjalan baik</p>
                  </div>
              }
              <button onClick={loadStats} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110" style={{background:'rgba(0,0,0,0.05)',border:'1px solid rgba(0,0,0,0.08)'}}>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>
          </div>
          {/* Tab navigation */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <TabBtn label="Analytics"      icon="📊" active={tab==='kpi'}     onClick={() => setTab('kpi')} />
            <TabBtn label="Command Center" icon="🏠" active={tab==='command'} onClick={() => setTab('command')} badge={totalAlerts || undefined} />
            <TabBtn label="Audit Log"      icon="📋" active={tab==='audit'}   onClick={() => setTab('audit')} badge={auditRows.length > 0 ? auditRows.length : undefined} />
          </div>
        </div>
      </header>
      )}

      {/* ── SCROLLABLE CONTENT (embedded: ikut scroll dashboard, tanpa padding samping) ── */}
      <div className={embedded ? 'space-y-4' : 'flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-4'}>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 1 — DASHBOARD ANALYTICS (no white wrapper — same as other platforms) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'kpi' && (
          <DashboardKPI currentUser={user as unknown as DashUser} />
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 2 — COMMAND CENTER                                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'command' && (
          <div className="space-y-4">
            {loading
              ? <div className="flex justify-center py-16"><div className="w-10 h-10 rounded-full border-4 border-t-amber-500 border-amber-200 animate-spin" /></div>
              : <>
                {/* Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon="🎫" label="Tiket Open"     value={stats?.ticketOpen ?? 0}      sub={`${stats?.ticketOverdue??0} overdue`}  gradient="linear-gradient(135deg,#dc2626,#991b1b)" alert={stats?.ticketOverdue} />
                  <StatCard icon="📅" label="Jadwal Pending" value={stats?.reminderPending ?? 0} sub="Belum di-assign"                       gradient="linear-gradient(135deg,#2563eb,#1e40af)" alert={stats?.reminderPending} />
                  <StatCard icon="🏗️" label="Proyek Pending" value={stats?.projectPending ?? 0} sub="Design request"                        gradient="linear-gradient(135deg,#7c3aed,#4c1d95)" alert={stats?.projectPending} />
                  <StatCard icon="👥" label="User Pending"   value={stats?.userPending ?? 0}    sub="Menunggu aktivasi"                    gradient="linear-gradient(135deg,#d97706,#92400e)" alert={stats?.userPending} />
                </div>

                {/* Bottleneck 2×2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Panel title="Tiket Overdue" icon="🚨" color="#dc2626" borderClr="rgba(220,38,38,0.22)" count={stats?.ticketOverdue}>
                    {!(stats?.overdueTickets?.length) ? <Empty emoji="✅" msg="Tidak ada tiket overdue" /> : (stats?.overdueTickets ?? []).map(t => (
                      <Row key={t.id} dot="#dc2626" title={t.project_name} sub={`${t.assign_name} · ${fmtD(t.date)}`} badge="OVERDUE" badgeBg="#fee2e2" badgeColor="#991b1b" badgeBorder="#fca5a5" />
                    ))}
                  </Panel>
                  <Panel title="Request Jadwal Belum Di-Assign" icon="📅" color="#2563eb" borderClr="rgba(37,99,235,0.22)" count={stats?.reminderPending}>
                    {!(stats?.pendingReminders?.length) ? <Empty emoji="✅" msg="Semua jadwal sudah diproses" /> : (stats?.pendingReminders ?? []).map(r => (
                      <Row key={r.id} dot="#2563eb" title={r.project_name} sub={`${r.category??'—'} · Due: ${fmtD(r.due_date)}`} badge="UNASSIGNED" badgeBg="#eff6ff" badgeColor="#1d4ed8" badgeBorder="#bfdbfe" />
                    ))}
                  </Panel>
                  <Panel title="Proyek Design Menunggu Proses" icon="🏗️" color="#7c3aed" borderClr="rgba(124,58,237,0.22)" count={stats?.projectPending}>
                    {!(stats?.pendingProjects?.length) ? <Empty emoji="✅" msg="Tidak ada proyek pending" /> : (stats?.pendingProjects ?? []).map(p => (
                      <Row key={p.id} dot="#7c3aed" title={p.project_name} sub={`${p.sales_name} · ${fmtD(p.created_at)}`} badge="PENDING" badgeBg="#faf5ff" badgeColor="#6d28d9" badgeBorder="#e9d5ff" />
                    ))}
                  </Panel>
                  <Panel title={`My Tasks — ${user.full_name.split(' ')[0]}`} icon="📋" color="#059669" borderClr="rgba(5,150,105,0.22)">
                    {!(stats?.myTodayReminders?.length) && !(stats?.myOpenTickets?.length)
                      ? <Empty emoji="🎉" msg="Tidak ada task aktif untukmu" />
                      : <>
                          {(stats?.myTodayReminders ?? []).map(r => (<Row key={r.id} dot="#059669" title={r.project_name} sub={`📅 ${r.category} · Hari ini`} badge="TODAY" badgeBg="#d1fae5" badgeColor="#065f46" badgeBorder="#6ee7b7" />))}
                          {(stats?.myOpenTickets ?? []).map(t => (<Row key={t.id} dot={t.status==='Overdue'?'#dc2626':'#059669'} title={t.project_name} sub={`🎫 Tiket · ${t.status}`} badge={t.status} badgeBg={t.status==='Overdue'?'#fee2e2':'#d1fae5'} badgeColor={t.status==='Overdue'?'#991b1b':'#065f46'} badgeBorder={t.status==='Overdue'?'#fca5a5':'#6ee7b7'} />))}
                        </>
                    }
                  </Panel>
                </div>

                {/* Recent Activity */}
                <div className="rounded-2xl overflow-hidden" style={{background:'rgba(255,255,255,0.97)',border:'1px solid rgba(0,0,0,0.07)'}}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{background:'rgba(0,0,0,0.025)',borderBottom:'1px solid rgba(0,0,0,0.06)'}}>
                    <span className="text-base select-none">⚡</span>
                    <span className="font-bold text-gray-700 text-sm">Aktivitas Platform Terbaru</span>
                  </div>
                  {!(stats?.activity?.length)
                    ? <Empty emoji="📭" msg="Belum ada aktivitas" />
                    : (stats?.activity ?? []).map(a => (
                        <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:a.dot}} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{a.label}</p>
                            <p className="text-xs text-gray-400 truncate">{a.sub}</p>
                          </div>
                          <span className="text-[10px] text-gray-300 flex-shrink-0 tabular-nums">{rel(a.time)}</span>
                        </div>
                      ))
                  }
                </div>
              </>
            }
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 3 — AUDIT LOG  (audit_trail + activity_logs)               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'audit' && (
          <div className="rounded-2xl overflow-hidden"
            style={{background:'rgba(255,255,255,0.97)',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-1">Audit Trail</span>
              <input className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 focus:bg-white w-44"
                placeholder="🔍 User / Target / Aksi..." value={auditSearch}
                onChange={e => { setAuditSearch(e.target.value); setAuditPage(0); }} />
              <select className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 cursor-pointer"
                value={auditModule} onChange={e => { setAuditModule(e.target.value); setAuditPage(0); }}>
                {AUDIT_MODULES.map(m => <option key={m} value={m}>{m === 'All' ? 'Semua Modul' : m}</option>)}
              </select>
              <select className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 cursor-pointer"
                value={auditAction} onChange={e => { setAuditAction(e.target.value); setAuditPage(0); }}>
                {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a === 'All' ? 'Semua Aksi' : a}</option>)}
              </select>
              <button onClick={loadAudit} disabled={auditLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-60 bg-white">
                <svg className={`w-3.5 h-3.5 ${auditLoading?'animate-spin':''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Refresh
              </button>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{auditFiltered.length} log</span>
                {/* Source legend */}
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:'#ede9fe',color:'#5b21b6',border:'1px solid #c4b5fd'}}>audit_trail</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:'#dbeafe',color:'#1e40af',border:'1px solid #93c5fd'}}>activity_logs</span>
              </div>
            </div>

            {/* Table */}
            {auditLoading
              ? <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-4 border-t-amber-500 border-amber-200 animate-spin" /></div>
              : auditPaged.length === 0
              ? <div className="flex flex-col items-center py-16 gap-2">
                  <span className="text-4xl">📋</span>
                  <p className="text-sm text-gray-500 font-medium">Belum ada audit log</p>
                  <p className="text-xs text-gray-400">Log muncul setelah ada aksi di platform</p>
                </div>
              : <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{minWidth:750}}>
                    <thead>
                      <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                        {['Waktu','User','Aksi','Modul','Target','Perubahan','Catatan','Sumber'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditPaged.map((a, idx) => {
                        const as = ACTION_STYLE[a.action] ?? { bg:'#f1f5f9', color:'#475569', border:'#cbd5e1' };
                        const isLegacy = a.source === 'activity_logs';
                        return (
                          <tr key={`${a.source}-${a.id}`} className="hover:bg-amber-50/30 transition-colors"
                            style={{borderBottom:'1px solid #f1f5f9',background:idx%2===0?'white':'#fafafa'}}>
                            <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">{fmtDT(a.created_at)}</td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-semibold text-gray-800">{a.user_name || '—'}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded whitespace-nowrap"
                                style={{background:as.bg,color:as.color,border:`1px solid ${as.border}`}}>
                                {a.action}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs text-gray-600 flex items-center gap-1">
                                <span>{MODULE_ICON[a.module] ?? '📁'}</span>
                                {a.module}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 max-w-[160px]">
                              <span className="text-xs text-gray-700 truncate block" title={a.target_name ?? ''}>{a.target_name || '—'}</span>
                            </td>
                            <td className="px-4 py-2.5 max-w-[180px]">
                              {(a.old_value || a.new_value)
                                ? <div className="flex items-center gap-1 flex-wrap">
                                    {a.old_value && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 line-through">{a.old_value}</span>}
                                    {a.old_value && a.new_value && <span className="text-[10px] text-gray-300">→</span>}
                                    {a.new_value && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">{a.new_value}</span>}
                                  </div>
                                : <span className="text-[10px] text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 max-w-[160px]">
                              <span className="text-[11px] text-gray-400 truncate block" title={a.notes ?? ''}>{a.notes || '—'}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
                                style={isLegacy
                                  ? {background:'#dbeafe',color:'#1e40af',border:'1px solid #93c5fd'}
                                  : {background:'#ede9fe',color:'#5b21b6',border:'1px solid #c4b5fd'}}>
                                {isLegacy ? 'activity' : 'audit'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            }

            {/* Pagination */}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <button onClick={() => setAuditPage(p => Math.max(0, p-1))} disabled={auditPage === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                <span className="text-xs text-gray-400">
                  Hal {auditPage+1} dari {auditTotalPages} · {auditFiltered.length} log
                </span>
                <button onClick={() => setAuditPage(p => Math.min(auditTotalPages-1, p+1))} disabled={auditPage >= auditTotalPages-1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next →</button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[10px] text-white/40 select-none pb-2">
          Analytics Platform — IndoVisual PTS · Work Management
        </p>
      </div>{/* end scrollable content */}
    </div>
  );
}
