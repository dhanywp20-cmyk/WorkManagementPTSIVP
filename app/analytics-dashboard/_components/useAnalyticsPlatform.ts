'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { getSession, startSessionWatcher } from '@/lib/auth/sesi';
import { hasFullAccess } from '@/lib/constants';
import type { User, Tab, Stats, AuditRow, TicketRow, ReminderRow, ProjectRow } from './AnalyticsPlatform';

export interface AnalyticsPlatformKonteks {
  injectedUser: User | undefined;
  controlledTab: Tab | undefined;
  onTabChange: ((tab: Tab) => void) | undefined;
  onCounts: ((counts: { totalAlerts: number; auditCount: number; }) => void) | undefined;
}

export function useAnalyticsPlatform(k: AnalyticsPlatformKonteks) {
  const { injectedUser, controlledTab, onTabChange, onCounts } = k;
  const [user,    setUser]    = useState<User | null>(injectedUser ?? null);
  const [auth,    setAuth]    = useState<'checking' | 'ok' | 'denied'>(injectedUser ? 'ok' : 'checking');
  const [tabState, setTabState] = useState<Tab>('kpi');
  const [diLuarBingkai, setDiLuarBingkai] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { setDiLuarBingkai(window.self === window.top); } catch {  } }, []);
  const tab = controlledTab ?? tabState;
  const lihatPemakaian = hasFullAccess(user);
  const setTab = (t: Tab) => { onTabChange?.(t); if (controlledTab === undefined) setTabState(t); };
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [auditRows,    setAuditRows]    = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModule,  setAuditModule]  = useState('All');
  const [auditAction,  setAuditAction]  = useState('All');
  const [auditSearch,  setAuditSearch]  = useState('');
  const [auditPage,    setAuditPage]    = useState(0);
  const AUDIT_PAGE_SIZE = 30;

  useEffect(() => {
    if (injectedUser) { setUser(injectedUser); setAuth('ok'); return; }
    const u = getSession<User>();
    if (!u) { const tgt = window.top !== window ? window.top : window; if (tgt) tgt.location.href = '/dashboard'; return; }
    const r = (u.role ?? '').toLowerCase();
    const ok = ['admin','superadmin'].includes(r) || r === 'team' || isPimpinan(u);
    setUser(u); setAuth(ok ? 'ok' : 'denied');
    return startSessionWatcher();
  }, [injectedUser]);

  const today = new Date().toISOString().split('T')[0];

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

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const auditQ = supabase
        .from('audit_trail')
        .select('id,user_name,action,module,target_name,old_value,new_value,notes,created_at')
        .order('created_at', { ascending: false })
        .limit(300);

      const actQ = supabase
        .from('activity_logs')
        .select('id,handler_name,action_taken,new_status,notes,created_at,ticket_id')
        .order('created_at', { ascending: false })
        .limit(300);

      const [auditRes, actRes] = await Promise.all([auditQ, actQ]);

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

      const merged = [...fromAudit, ...fromActivity]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
    let poll: ReturnType<typeof setInterval> | null = null;
    const mulaiPolling = () => { if (!poll) poll = setInterval(loadStats, 120_000); };
    const hentikanPolling = () => { if (poll) { clearInterval(poll); poll = null; } };
    const saatVisibilitasBerubah = () => {
      if (document.visibilityState === 'hidden') { hentikanPolling(); return; }
      loadStats();
      mulaiPolling();
    };
    if (document.visibilityState !== 'hidden') mulaiPolling();
    document.addEventListener('visibilitychange', saatVisibilitasBerubah);

    return () => {
      chs.forEach(c => supabase.removeChannel(c));
      document.removeEventListener('visibilitychange', saatVisibilitasBerubah);
      hentikanPolling();
    };
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

  useEffect(() => {
    onCounts?.({ totalAlerts, auditCount: auditRows.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAlerts, auditRows.length]);

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
  return {
    auth, user, tab, setTab, totalAlerts, auditRows, lihatPemakaian, loadStats,
    loadAudit, greeting, loading, stats, fmtD, rel, auditSearch, setAuditSearch,
    setAuditPage, auditModule, setAuditModule, AUDIT_MODULES, auditAction, setAuditAction, AUDIT_ACTIONS, auditLoading,
    auditFiltered, auditPaged, fmtDT, auditTotalPages, auditPage, diLuarBingkai,
  };
}
