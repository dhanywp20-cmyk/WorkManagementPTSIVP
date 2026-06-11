'use client';

/**
 * analytics-dashboard/page.tsx  —  Command Center
 *
 * Replaces the single-KPI view with a multi-source Command Center:
 *   • Live stats (tickets, reminders, projects, pending users)
 *   • Bottleneck alerts (overdue, stale, pending)
 *   • My Tasks (personal task list for current user)
 *   • Recent activity feed
 *   • Quick Access shortcuts
 *
 * Navigation: clicking Quick Access sends postMessage to parent frame
 * which is caught by dashboard/page.tsx and handled via handleMenuClick.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id: string; full_name: string; role: string;
  team_type?: string; jabatan?: string; allowed_menus?: string[];
}

interface TicketRow   { id: string; project_name: string; assign_name: string; status: string; date: string; created_at: string; }
interface ReminderRow { id: string; project_name: string; notes: string; due_date: string; status: string; assign_name: string; assigned_to: string; category: string; created_at: string; }
interface ProjectRow  { id: string; project_name: string; sales_name: string; status: string; created_at: string; requester_name?: string; }
interface NotifRow    { id: string; type: string; title: string; body: string | null; action_url: string | null; created_by: string | null; created_at: string; }

interface Stats {
  ticketOpen: number;  ticketOverdue: number;
  reminderPending: number; projectPending: number; userPending: number;
  overdueTickets: TicketRow[]; pendingReminders: ReminderRow[];
  pendingProjects: ProjectRow[];
  myOpenTickets: TicketRow[]; myTodayReminders: ReminderRow[];
  systemNotifs: NotifRow[];
  activity: { id: string; label: string; sub: string; time: string; dot: string }[];
}

// ── Helper components ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, gradient, alert }: {
  icon: string; label: string; value: number; sub?: string;
  gradient: string; alert?: number;
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
      <div className="flex-1 overflow-y-auto max-h-56 p-3 space-y-1.5">
        {children}
      </div>
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

// ── Main ──────────────────────────────────────────────────────────────────────

function CommandCenter() {
  const [user,    setUser]    = useState<User | null>(null);
  const [auth,    setAuth]    = useState<'checking' | 'ok' | 'denied'>('checking');
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock,   setClock]   = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auth
  useEffect(() => {
    const u = getSession<User>();
    if (!u) {
      const tgt = window.top !== window ? window.top : window;
      if (tgt) tgt.location.href = '/dashboard';
      return;
    }
    const r = (u.role ?? '').toLowerCase();
    const isAdmin   = ['admin', 'superadmin'].includes(r);
    const isPTSSup  = r === 'team' && u.jabatan === 'Supervisor';
    const isSalesSup= ['guest', 'sales'].includes(r)
                    && ['Supervisor','Manager','Deputy General Manager','General Manager','Direktur']
                       .includes(u.jabatan ?? '');
    const hasAccess = r === 'team' && (u.allowed_menus ?? []).includes('dashboard');
    if (!isAdmin && !isPTSSup && !isSalesSup && !hasAccess) { setAuth('denied'); return; }
    setUser(u);
    setAuth('ok');
    return startSessionWatcher();
  }, []);

  const today   = new Date().toISOString().split('T')[0];
  const isAdmin = user && ['admin', 'superadmin'].includes((user.role ?? '').toLowerCase());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [tRes, rRes, pRes, uRes, nRes] = await Promise.all([
        // Tickets — non-solved
        supabase.from('tickets')
          .select('id,project_name,assign_name,status,date,created_at')
          .not('status', 'eq', 'Solved')
          .order('created_at', { ascending: false }).limit(100),

        // Reminders — active
        supabase.from('reminders')
          .select('id,project_name,notes,due_date,status,assign_name,assigned_to,category,created_at')
          .not('status', 'in', '("done","cancelled")')
          .order('created_at', { ascending: false }).limit(100),

        // Design project requests — active
        supabase.from('project_requests')
          .select('id,project_name,sales_name,status,created_at,requester_name')
          .in('status', ['pending', 'approved', 'in_progress'])
          .order('created_at', { ascending: false }).limit(30),

        // Pending users
        supabase.from('users')
          .select('id', { count: 'exact', head: true })
          .eq('team_type', 'Pending Approval'),

        // System notifications for this user (if notifications table exists)
        supabase.from('notifications')
          .select('id,type,title,body,action_url,created_by,created_at')
          .eq('user_id', user.id).eq('is_read', false)
          .order('created_at', { ascending: false }).limit(10)
          .then((r: any) => r).catch(() => ({ data: [] })),
      ]);

      const tickets  = (tRes.data ?? []) as TicketRow[];
      const reminders= (rRes.data ?? []) as ReminderRow[];
      const projects = (pRes.data ?? []) as ProjectRow[];
      const userPend = (uRes as any).count ?? 0;
      const notifs   = (nRes as any).data ?? [] as NotifRow[];

      const overdueTickets  = tickets.filter(t => t.status === 'Overdue');
      const openTickets     = tickets.filter(t => !['Solved','Overdue'].includes(t.status));
      const pendingReminders= reminders.filter(r => !r.assigned_to || r.assigned_to === '');
      const pendingProjects = projects.filter(p => p.status === 'pending');
      const myTickets       = tickets.filter(t => t.assign_name === user.full_name && !['Solved'].includes(t.status));
      const myToday         = reminders.filter(r => r.assign_name === user.full_name && r.due_date === today);

      const activity = [
        ...tickets.slice(0,5).map(t => ({ id:t.id, label:t.project_name, sub:`🎫 ${t.assign_name} · ${t.status}`, time:t.created_at, dot:'#dc2626' })),
        ...reminders.filter(r=>r.assign_name).slice(0,5).map(r => ({ id:r.id, label:r.project_name, sub:`📅 ${r.category} · ${r.assign_name}`, time:r.created_at, dot:'#2563eb' })),
      ].sort((a,b) => new Date(b.time).getTime()-new Date(a.time).getTime()).slice(0,8);

      setStats({
        ticketOpen: openTickets.length, ticketOverdue: overdueTickets.length,
        reminderPending: pendingReminders.length, projectPending: pendingProjects.length, userPending: userPend,
        overdueTickets: overdueTickets.slice(0,6), pendingReminders: pendingReminders.slice(0,6),
        pendingProjects: pendingProjects.slice(0,6),
        myOpenTickets: myTickets.slice(0,6), myTodayReminders: myToday.slice(0,6),
        systemNotifs: notifs.slice(0,5), activity,
      });
    } catch (e) {
      console.error('[CC] load error:', e);
    }
    setLoading(false);
  }, [user, today]);

  useEffect(() => {
    if (auth !== 'ok' || !user) return;
    load();
    const chs = [
      supabase.channel('cc-t').on('postgres_changes',{event:'*',schema:'public',table:'tickets'},load).subscribe(),
      supabase.channel('cc-r').on('postgres_changes',{event:'*',schema:'public',table:'reminders'},load).subscribe(),
      supabase.channel('cc-p').on('postgres_changes',{event:'*',schema:'public',table:'project_requests'},load).subscribe(),
    ];
    return () => { chs.forEach(c => supabase.removeChannel(c)); };
  }, [auth, user, load]);

  // Navigate parent
  const nav = (url: string) => {
    if (window.parent !== window) window.parent.postMessage({ type: 'CC_NAVIGATE', url }, '*');
  };

  const greeting = () => {
    const h = clock.getHours();
    return h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
  };

  const fmtD = (d: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
    catch { return d; }
  };

  const rel = (d: string) => {
    if (!d) return '';
    const ms = Date.now() - new Date(d).getTime();
    const m  = Math.floor(ms/60000);
    if (m<1) return 'Baru';
    if (m<60) return `${m}m`;
    const h = Math.floor(m/60);
    if (h<24) return `${h}j`;
    return `${Math.floor(h/24)}h`;
  };

  // ── Auth states ─────────────────────────────────────────────────────────
  if (auth === 'denied') return (
    <div className="flex items-center justify-center h-screen" style={{ background: '#f8fafc' }}>
      <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
        <div className="text-5xl mb-3">🔒</div>
        <p className="font-bold text-gray-800">Akses Ditolak</p>
        <p className="text-sm text-gray-400 mt-1">Anda tidak memiliki izin ke halaman ini.</p>
      </div>
    </div>
  );

  if (auth === 'checking' || !user || loading) return (
    <div className="flex items-center justify-center h-screen bg-cover bg-center"
      style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
      <div className="flex flex-col items-center gap-4 bg-white/85 backdrop-blur-md rounded-2xl px-10 py-8">
        <div className="w-10 h-10 rounded-full border-4 border-t-amber-500 border-amber-200 animate-spin" />
        <p className="text-gray-700 font-semibold text-sm">Memuat Command Center...</p>
      </div>
    </div>
  );

  const totalAlerts = (stats?.ticketOverdue ?? 0) + (stats?.reminderPending ?? 0) + (stats?.userPending ?? 0);

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen overflow-y-auto bg-cover bg-center bg-fixed"
      style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
      <div className="max-w-[1200px] mx-auto px-4 py-5 pb-8 space-y-4">

        {/* HEADER */}
        <div className="rounded-2xl px-5 py-4"
          style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-black flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#78350f' }}>
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{greeting()},</p>
                <p className="text-xl font-black text-gray-900 leading-tight">{user.full_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {clock.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                  <span className="mx-1.5 opacity-40">·</span>
                  <span className="font-bold text-amber-600 tabular-nums">
                    {clock.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {totalAlerts > 0
                ? <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
                    <span className="text-base animate-pulse select-none">⚠️</span>
                    <div>
                      <p className="text-sm font-black text-red-700">{totalAlerts} item perlu perhatian</p>
                      <p className="text-xs text-red-400">Lihat bottleneck di bawah</p>
                    </div>
                  </div>
                : <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#d1fae5', border: '1px solid #6ee7b7' }}>
                    <span className="text-base select-none">✅</span>
                    <p className="text-sm font-bold text-emerald-700">Platform berjalan baik</p>
                  </div>
              }
              <button onClick={load}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}
                title="Refresh">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon="🎫" label="Tiket Open"       value={stats?.ticketOpen ?? 0}       sub={`${stats?.ticketOverdue ?? 0} overdue`}     gradient="linear-gradient(135deg,#dc2626,#991b1b)" alert={stats?.ticketOverdue} />
          <StatCard icon="📅" label="Jadwal Pending"   value={stats?.reminderPending ?? 0}  sub="Belum di-assign ke handler"                  gradient="linear-gradient(135deg,#2563eb,#1e40af)" alert={stats?.reminderPending} />
          <StatCard icon="🏗️" label="Proyek Pending"   value={stats?.projectPending ?? 0}   sub="Design request belum diproses"               gradient="linear-gradient(135deg,#7c3aed,#4c1d95)" alert={stats?.projectPending} />
          <StatCard icon="👥" label="User Pending"     value={stats?.userPending ?? 0}      sub="Menunggu aktivasi akun"                      gradient="linear-gradient(135deg,#d97706,#92400e)" alert={stats?.userPending} />
        </div>

        {/* SYSTEM NOTIFICATIONS (jika ada) */}
        {(stats?.systemNotifs ?? []).length > 0 && (
          <div className="rounded-2xl px-4 py-3 space-y-2"
            style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 2px 12px rgba(245,158,11,0.1)' }}>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">🔔 Notifikasi Untukmu</p>
            {(stats?.systemNotifs ?? []).map(n => (
              <div key={n.id} className="flex items-start gap-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-400 truncate">{n.body}</p>}
                </div>
                <span className="text-[10px] text-gray-300 whitespace-nowrap">{rel(n.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* BOTTLENECK PANELS 2×2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Overdue Tickets */}
          <Panel title="Tiket Overdue" icon="🚨" color="#dc2626" borderClr="rgba(220,38,38,0.22)" count={stats?.ticketOverdue}>
            {(stats?.overdueTickets ?? []).length === 0
              ? <Empty emoji="✅" msg="Tidak ada tiket overdue" />
              : (stats?.overdueTickets ?? []).map(t => (
                <Row key={t.id} dot="#dc2626" title={t.project_name} sub={`${t.assign_name} · ${fmtD(t.date)}`}
                  badge="OVERDUE" badgeBg="#fee2e2" badgeColor="#991b1b" badgeBorder="#fca5a5" />
              ))}
          </Panel>

          {/* Pending Reminders */}
          <Panel title="Request Jadwal Belum Di-Assign" icon="📅" color="#2563eb" borderClr="rgba(37,99,235,0.22)" count={stats?.reminderPending}>
            {(stats?.pendingReminders ?? []).length === 0
              ? <Empty emoji="✅" msg="Semua jadwal sudah diproses" />
              : (stats?.pendingReminders ?? []).map(r => (
                <Row key={r.id} dot="#2563eb" title={r.project_name} sub={`${r.category ?? '—'} · Due: ${fmtD(r.due_date)}`}
                  badge="UNASSIGNED" badgeBg="#eff6ff" badgeColor="#1d4ed8" badgeBorder="#bfdbfe" />
              ))}
          </Panel>

          {/* Pending Projects */}
          <Panel title="Proyek Design Menunggu Proses" icon="🏗️" color="#7c3aed" borderClr="rgba(124,58,237,0.22)" count={stats?.projectPending}>
            {(stats?.pendingProjects ?? []).length === 0
              ? <Empty emoji="✅" msg="Tidak ada proyek design pending" />
              : (stats?.pendingProjects ?? []).map(p => (
                <Row key={p.id} dot="#7c3aed" title={p.project_name} sub={`${p.sales_name} · ${fmtD(p.created_at)}`}
                  badge="PENDING" badgeBg="#faf5ff" badgeColor="#6d28d9" badgeBorder="#e9d5ff" />
              ))}
          </Panel>

          {/* My Tasks */}
          <Panel title={`My Tasks — ${user.full_name.split(' ')[0]}`} icon="📋" color="#059669" borderClr="rgba(5,150,105,0.22)">
            {(stats?.myTodayReminders ?? []).length === 0 && (stats?.myOpenTickets ?? []).length === 0
              ? <Empty emoji="🎉" msg="Tidak ada task aktif untukmu" />
              : <>
                  {(stats?.myTodayReminders ?? []).map(r => (
                    <Row key={r.id} dot="#059669" title={r.project_name} sub={`📅 ${r.category} · Hari ini`}
                      badge="TODAY" badgeBg="#d1fae5" badgeColor="#065f46" badgeBorder="#6ee7b7" />
                  ))}
                  {(stats?.myOpenTickets ?? []).map(t => (
                    <Row key={t.id} dot={t.status === 'Overdue' ? '#dc2626' : '#059669'}
                      title={t.project_name} sub={`🎫 Tiket · ${t.status}`}
                      badge={t.status}
                      badgeBg={t.status === 'Overdue' ? '#fee2e2' : '#d1fae5'}
                      badgeColor={t.status === 'Overdue' ? '#991b1b' : '#065f46'}
                      badgeBorder={t.status === 'Overdue' ? '#fca5a5' : '#6ee7b7'} />
                  ))}
                </>
            }
          </Panel>
        </div>

        {/* RECENT ACTIVITY */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.025)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <span className="text-base select-none">⚡</span>
            <span className="font-bold text-gray-700 text-sm">Aktivitas Platform Terbaru</span>
          </div>
          {(stats?.activity ?? []).length === 0
            ? <Empty emoji="📭" msg="Belum ada aktivitas" />
            : (stats?.activity ?? []).map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.dot }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{a.label}</p>
                  <p className="text-xs text-gray-400 truncate">{a.sub}</p>
                </div>
                <span className="text-[10px] text-gray-300 flex-shrink-0 tabular-nums">{rel(a.time)}</span>
              </div>
            ))}
        </div>

        {/* QUICK ACCESS */}
        <div className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.55)' }}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em] mb-3">⚡ Quick Access</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { icon: '🎫', label: 'Ticketing',   url: '/ticketing' },
              { icon: '🗓️', label: 'Reminder',    url: '/reminder-schedule' },
              { icon: '🏗️', label: 'Design Req',  url: '/form-require-project' },
              { icon: '📊', label: 'KPI Team',    url: '/kpi-team' },
              { icon: '💰', label: 'Insentif',    url: '/incentive-pts' },
              { icon: '🎓', label: 'Learning',    url: '/learning-center' },
            ].map((item, i) => (
              <button key={i} onClick={() => nav(item.url)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all hover:scale-105 active:scale-95 select-none"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,134,29,0.09)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'}>
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/40 select-none">
          Work Management Platform — IndoVisual PTS · Realtime · Auto-refresh
        </p>

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-cover bg-center"
        style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-amber-500 border-amber-200 animate-spin" />
      </div>
    }>
      <CommandCenter />
    </Suspense>
  );
}
