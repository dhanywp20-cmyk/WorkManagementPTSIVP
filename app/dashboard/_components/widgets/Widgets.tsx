'use client';

/**
 * Widgets.tsx — kumpulan widget reusable + Widget Registry.
 *
 * Setiap widget: komponen mandiri yang fetch datanya sendiri & render 1 kartu.
 * Registry (WIDGETS) = metadata deklaratif (id, permission, priority, size,
 * Component). Permission Resolver ada di permissions.ts. Proses compose
 * (filter → sort → render) ada di PermissionAwareDashboard.tsx.
 *
 * Prinsip: widget = RINGKASAN untuk homepage, bukan list otoritatif — angka &
 * beberapa item terbaru, lalu "Lihat semua" membuka menu aslinya.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '../shared';
import { hasMenu, canAccessAnalytics, canSeeTeamMonitoring, isAdminRole, isTeamMember } from './permissions';
import {
  getMonday, getDayDate, toKey, DAYS_OF_WEEK, getRollingNameForDate, type PiketRow,
} from '@/app/picket-showroom/_components/shared';

// ── Kontrak widget ────────────────────────────────────────────────────────────

export interface WidgetProps {
  user: User;
  openMenu: (key: string) => void;            // buka menu by key (reuse handleMenuClick di page)
  openUrl: (url: string, title: string) => void; // buka halaman internal full-screen (mis. Analytics)
}

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetDef {
  id: string;
  permission: (u: User) => boolean;
  priority: number;
  size: WidgetSize;
  Component: React.FC<WidgetProps>;
}

const todayStr = () => new Date().toISOString().split('T')[0];

// ── UI primitives ──────────────────────────────────────────────────────────────

function WidgetCard({ title, icon, accent, children, onSeeAll, seeAllLabel }: {
  title: string; icon: string; accent: string;
  children: React.ReactNode; onSeeAll?: () => void; seeAllLabel?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-lg border border-black/5 p-4 flex flex-col h-full"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: `${accent}1a`, color: accent }}>{icon}</div>
        <h3 className="font-bold text-slate-800 text-sm truncate flex-1">{title}</h3>
        {onSeeAll && (
          <button onClick={onSeeAll}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg transition-all hover:scale-[1.03] flex-shrink-0"
            style={{ background: `${accent}14`, color: accent }}>
            {seeAllLabel ?? 'Lihat semua'} →
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function StatPills({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      {items.map((s, i) => (
        <div key={i} className="rounded-xl px-2 py-2 text-center" style={{ background: `${s.color}12` }}>
          <div className="text-lg font-black leading-none" style={{ color: s.color }}>{s.value}</div>
          <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function MiniRow({ title, sub, tone }: { title: string; sub: string; tone?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: tone ?? '#94a3b8' }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-700 truncate">{title}</div>
        <div className="text-[10px] text-slate-400 truncate">{sub}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center h-full min-h-[60px] text-[11px] text-slate-400 text-center px-2">{text}</div>;
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px]">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.25)', borderTopColor: '#e2a84b' }} />
    </div>
  );
}

// ── Lightweight row types ────────────────────────────────────────────────────

interface RemRow { id: string; project_name: string; category: string; due_date: string; status: string; assigned_to?: string; sales_name?: string; notes?: string; routing_status?: string | null; internal_sales_id?: string | null; assigned_supervisor_id?: string | null; }
interface TkRow { id: string; project_name: string; issue_case: string; status: string; created_at: string; assign_name?: string; created_by?: string; sales_name?: string; }
interface PrRow { id: string; project_name: string; status: string; created_at: string; requester_id?: string; assign_name?: string; ivp_assignee?: string; routing_status?: string | null; internal_sales_id?: string | null; }

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Analytics Platform (launcher) — buka halaman penuh, TIDAK di-embed.
// Menghindari "aplikasi nested" + duplikasi data dgn widget ringkasan di bawah.
// ═══════════════════════════════════════════════════════════════════════════════
const AnalyticsLauncherWidget: React.FC<WidgetProps> = ({ openUrl }) => (
  <WidgetCard title="Analytics Platform" icon="📊" accent="#c8861d">
    <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-2">
      <div className="text-3xl">📊</div>
      <p className="text-[11px] text-slate-500 leading-snug px-2">Analitik lengkap, Command Center &amp; Audit Log.</p>
      <button onClick={() => openUrl('/analytics-dashboard', 'Analytics Platform')}
        className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
        style={{ background: 'linear-gradient(135deg,#c8861d,#e2a84b)' }}>Buka Analytics →</button>
    </div>
  </WidgetCard>
);

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Team Monitoring Hari Ini (Team/Admin).
// ═══════════════════════════════════════════════════════════════════════════════
const TeamMonitoringWidget: React.FC<WidgetProps> = ({ openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ id: string; name: string; reported: boolean; active: number }[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const today = todayStr();
        const [{ data: team }, { data: reports }, { data: rems }] = await Promise.all([
          supabase.from('users').select('id, username, full_name, team_type').eq('role', 'team')
            .in('team_type', ['Team PTS IVP', 'Team PTS UMP', 'Team PTS MVI']),
          supabase.from('daily_reports').select('user_id').eq('report_date', today),
          supabase.from('reminders').select('assigned_to').eq('due_date', today).neq('status', 'done').neq('status', 'cancelled'),
        ]);
        const reported = new Set((reports ?? []).map((r: any) => r.user_id));
        const activeBy: Record<string, number> = {};
        (rems ?? []).forEach((r: any) => { if (r.assigned_to) activeBy[r.assigned_to] = (activeBy[r.assigned_to] ?? 0) + 1; });
        const list = (team ?? []).map((m: any) => ({
          id: m.id as string, name: m.full_name as string, reported: reported.has(m.id), active: activeBy[m.username] ?? 0,
        })).sort((a: { reported: boolean; active: number }, b: { reported: boolean; active: number }) =>
          Number(a.reported) - Number(b.reported) || b.active - a.active);
        if (alive) setRows(list);
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <WidgetCard title="Team Monitoring Hari Ini" icon="🧭" accent="#0891b2"><Loading /></WidgetCard>;

  const total = rows.length;
  const sudah = rows.filter(r => r.reported).length;
  const belum = total - sudah;
  const pct = total > 0 ? Math.round((sudah / total) * 100) : 0;
  const belumList = rows.filter(r => !r.reported);

  return (
    <WidgetCard title="Team Monitoring Hari Ini" icon="🧭" accent="#0891b2"
      onSeeAll={() => openMenu('daily-report')} seeAllLabel="Daily Report">
      {total === 0 ? (
        <EmptyState text="Belum ada anggota Team PTS terdaftar." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Kiri: ringkasan angka + progress */}
          <div>
            <StatPills items={[
              { label: 'Total Team', value: total, color: '#0891b2' },
              { label: 'Sudah', value: sudah, color: '#16a34a' },
              { label: 'Belum', value: belum, color: belum > 0 ? '#ea580c' : '#94a3b8' },
            ]} />
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ea580c' }} />
              </div>
              <span className="text-[11px] font-bold text-slate-600">{pct}% update</span>
            </div>
          </div>
          {/* Kanan: daftar yang belum daily report (multi-kolom) */}
          <div>
            {belumList.length === 0 ? (
              <div className="text-xs font-semibold text-green-600 flex items-center h-full min-h-[60px]">🎉 Semua tim sudah update Daily Report hari ini!</div>
            ) : (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Belum Daily Report ({belumList.length})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-0.5">
                  {belumList.map(r => (
                    <button key={r.id} onClick={() => openMenu('daily-report')}
                      className="flex items-center gap-2 py-1.5 px-1.5 hover:bg-slate-50 rounded-lg transition-colors text-left">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.active > 0 ? '#dc2626' : '#f59e0b' }} />
                      <span className="text-xs font-semibold text-slate-700 truncate flex-1">{r.name}</span>
                      {r.active > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>{r.active} aktif</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Request Schedule Saya (menu reminder-schedule).
// ═══════════════════════════════════════════════════════════════════════════════
const RequestScheduleWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RemRow[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sel = 'id, project_name, category, due_date, status, assigned_to, sales_name, notes, routing_status, internal_sales_id, assigned_supervisor_id';
        let data: RemRow[] = [];
        if (isAdminRole(user)) {
          const res = await supabase.from('reminders').select(sel).neq('status', 'cancelled').order('due_date', { ascending: true }).limit(300);
          data = (res.data ?? []) as RemRow[];
        } else if (isTeamMember(user)) {
          const res = await supabase.from('reminders').select(sel).eq('assigned_to', user.username).neq('status', 'cancelled').order('due_date', { ascending: true }).limit(200);
          data = (res.data ?? []) as RemRow[];
        } else {
          const res = await supabase.from('reminders').select(sel).eq('sales_name', user.full_name).order('due_date', { ascending: false }).limit(200);
          data = (res.data ?? []) as RemRow[];
          // Sales Internal reviewer: request yang menunggu review dia
          const rev = await supabase.from('reminders').select('id', { count: 'exact', head: true })
            .eq('internal_sales_id', user.id).eq('routing_status', 'internal_review');
          if (alive) setReviewCount(rev.count ?? 0);
        }
        if (alive) setItems(data);
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  if (loading) return <WidgetCard title="Request Schedule Saya" icon="🗓️" accent="#0891b2"><Loading /></WidgetCard>;

  const today = todayStr();
  const active = items.filter(r => r.status !== 'done' && r.status !== 'cancelled');
  const todayCount = active.filter(r => r.due_date === today).length;
  const doneCount = items.filter(r => r.status === 'done').length;
  const upcoming = active.slice(0, 3);

  return (
    <WidgetCard title="Request Schedule Saya" icon="🗓️" accent="#0891b2"
      onSeeAll={() => openMenu('reminder-schedule')}>
      <StatPills items={[
        { label: 'Aktif', value: active.length, color: '#0891b2' },
        { label: 'Hari Ini', value: todayCount, color: '#f59e0b' },
        { label: 'Selesai', value: doneCount, color: '#16a34a' },
      ]} />
      {reviewCount > 0 && (
        <button onClick={() => openMenu('reminder-schedule')}
          className="w-full mb-2 flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all hover:scale-[1.01]"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span className="text-base">🔍</span>
          <span className="text-[11px] font-bold text-amber-700 flex-1">{reviewCount} request menunggu review kamu</span>
        </button>
      )}
      {upcoming.length === 0 ? <EmptyState text="Belum ada jadwal aktif." /> : (
        <div>{upcoming.map(r => (
          <MiniRow key={r.id} title={r.project_name} sub={`${r.category} · ${r.due_date}`}
            tone={r.due_date === today ? '#f59e0b' : '#0891b2'} />
        ))}</div>
      )}
    </WidgetCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Ticket Saya (menu ticket-troubleshooting).
// ═══════════════════════════════════════════════════════════════════════════════
const TicketWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TkRow[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sel = 'id, project_name, issue_case, status, created_at, assign_name, created_by, sales_name';
        let data: TkRow[] = [];
        if (isAdminRole(user)) {
          const res = await supabase.from('tickets').select(sel).neq('status', 'Solved').order('created_at', { ascending: false }).limit(100);
          data = (res.data ?? []) as TkRow[];
        } else if (isTeamMember(user)) {
          const res = await supabase.from('tickets').select(sel).eq('assign_name', user.full_name).neq('status', 'Solved').order('created_at', { ascending: false }).limit(60);
          data = (res.data ?? []) as TkRow[];
        } else {
          const res = await supabase.from('tickets').select(sel).eq('created_by', user.username).order('created_at', { ascending: false }).limit(60);
          data = (res.data ?? []) as TkRow[];
        }
        if (alive) setItems(data);
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  if (loading) return <WidgetCard title="Ticket Saya" icon="🎫" accent="#e11d48"><Loading /></WidgetCard>;

  const open = items.filter(t => t.status !== 'Solved');
  const waiting = items.filter(t => (t.status ?? '').toLowerCase().includes('waiting')).length;
  const solved = items.filter(t => t.status === 'Solved').length;

  return (
    <WidgetCard title={isAdminRole(user) ? 'Ticket Aktif' : 'Ticket Saya'} icon="🎫" accent="#e11d48"
      onSeeAll={() => openMenu('ticket-troubleshooting')}>
      <StatPills items={[
        { label: 'Aktif', value: open.length, color: '#e11d48' },
        { label: 'Menunggu', value: waiting, color: '#f59e0b' },
        { label: 'Solved', value: solved, color: '#16a34a' },
      ]} />
      {open.length === 0 ? <EmptyState text="Tidak ada ticket aktif." /> : (
        <div>{open.slice(0, 3).map(t => (
          <MiniRow key={t.id} title={t.project_name} sub={`${t.status} · ${t.issue_case}`} tone="#e11d48" />
        ))}</div>
      )}
    </WidgetCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Project Saya (menu request-design-project).
// ═══════════════════════════════════════════════════════════════════════════════
const ProjectWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PrRow[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sel = 'id, project_name, status, created_at, requester_id, assign_name, ivp_assignee, routing_status, internal_sales_id';
        let data: PrRow[] = [];
        if (isAdminRole(user)) {
          const res = await supabase.from('project_requests').select(sel).order('created_at', { ascending: false }).limit(100);
          data = (res.data ?? []) as PrRow[];
        } else if (isTeamMember(user)) {
          const res = await supabase.from('project_requests').select(sel).eq('assign_name', user.full_name).order('created_at', { ascending: false }).limit(60);
          data = (res.data ?? []) as PrRow[];
        } else {
          const res = await supabase.from('project_requests').select(sel)
            .or(`requester_id.eq.${user.id},ivp_assignee.eq.${user.full_name}`)
            .order('created_at', { ascending: false }).limit(80);
          data = (res.data ?? []) as PrRow[];
          const rev = await supabase.from('project_requests').select('id', { count: 'exact', head: true })
            .eq('internal_sales_id', user.id).eq('routing_status', 'internal_review');
          if (alive) setReviewCount(rev.count ?? 0);
        }
        if (alive) setItems(data);
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  if (loading) return <WidgetCard title="Project Saya" icon="🏗️" accent="#7c3aed"><Loading /></WidgetCard>;

  const pending = items.filter(p => p.status === 'pending');
  const inProgress = items.filter(p => p.status === 'in_progress' || p.status === 'approved');
  const done = items.filter(p => p.status === 'completed');

  return (
    <WidgetCard title="Project Saya" icon="🏗️" accent="#7c3aed"
      onSeeAll={() => openMenu('request-design-project')}>
      <StatPills items={[
        { label: 'Pending', value: pending.length, color: '#f59e0b' },
        { label: 'Proses', value: inProgress.length, color: '#7c3aed' },
        { label: 'Selesai', value: done.length, color: '#16a34a' },
      ]} />
      {reviewCount > 0 && (
        <button onClick={() => openMenu('request-design-project')}
          className="w-full mb-2 flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all hover:scale-[1.01]"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span className="text-base">🔍</span>
          <span className="text-[11px] font-bold text-amber-700 flex-1">{reviewCount} request design menunggu review kamu</span>
        </button>
      )}
      {items.length === 0 ? <EmptyState text="Belum ada project." /> : (
        <div>{items.slice(0, 3).map(p => (
          <MiniRow key={p.id} title={p.project_name} sub={p.status} tone="#7c3aed" />
        ))}</div>
      )}
    </WidgetCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Learning (menu learning-center) — CTA ringkas.
// ═══════════════════════════════════════════════════════════════════════════════
const LearningWidget: React.FC<WidgetProps> = ({ openMenu }) => (
  <WidgetCard title="Learning Center" icon="🎓" accent="#4338ca">
    <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-2">
      <div className="text-3xl">🎓</div>
      <p className="text-[11px] text-slate-500 leading-snug px-2">Training, quiz online & materi pengembangan tim.</p>
      <button onClick={() => openMenu('learning-center')}
        className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
        style={{ background: 'linear-gradient(135deg,#4338ca,#6366f1)' }}>Buka Learning →</button>
    </div>
  </WidgetCard>
);

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Piket Showroom — siapa PIC piket hari ini + minggu ini.
// Muncul utk SEMUA role (info penting bersama: Sales/Marketing perlu tahu PIC).
// Nama PIC dihitung dgn getRollingNameForDate — SAMA persis dgn halaman Piket.
// ═══════════════════════════════════════════════════════════════════════════════
interface PicketDay { day: string; dateKey: string; name: string; isToday: boolean; team: string; }

const ShowroomWidget: React.FC<WidgetProps> = ({ openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<PicketDay[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rowsRes, holRes, usersRes] = await Promise.all([
          supabase.from('piket_schedules').select('id,day_date,week_start,day_of_week,pic_ivp_id,pic_ivp_name,pic_ump_id,pic_ump_name,pic_mvi_id,pic_mvi_name'),
          supabase.from('picket_holidays').select('date'),
          supabase.from('users').select('full_name, team_type').in('team_type', ['Team PTS IVP', 'Team PTS UMP', 'Team PTS MVI']),
        ]);
        const allRows = (rowsRes.data ?? []) as unknown as PiketRow[];
        const holidays = (holRes.data ?? []).map((h: any) => h.date as string);
        const teamByName: Record<string, string> = {};
        (usersRes.data ?? []).forEach((u: any) => { if (u.full_name) teamByName[u.full_name] = u.team_type ?? ''; });
        const monday = getMonday(new Date());
        const todayKey = toKey(new Date());
        const list: PicketDay[] = DAYS_OF_WEEK.map((day) => {
          const date = getDayDate(monday, day);
          const name = getRollingNameForDate(date, allRows, holidays);
          return { day, dateKey: toKey(date), name, isToday: toKey(date) === todayKey, team: name ? (teamByName[name] ?? '') : '' };
        });
        if (alive) setDays(list);
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <WidgetCard title="Piket Showroom" icon="🏪" accent="#0d9488"><Loading /></WidgetCard>;
  const today = days.find(d => d.isToday);

  return (
    <WidgetCard title="Piket Showroom" icon="🏪" accent="#0d9488" onSeeAll={() => openMenu('picket-showroom')}>
      <div className="rounded-xl p-3 mb-3 text-center" style={{ background: 'rgba(13,148,136,0.1)' }}>
        <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">PIC Piket Hari Ini</div>
        {today && today.name ? (
          <>
            <div className="text-base font-black text-slate-800 mt-0.5">{today.name}</div>
            {today.team && <div className="text-[10px] text-slate-500">{today.team.replace('Team ', '')}</div>}
          </>
        ) : (
          <div className="text-xs font-semibold text-slate-400 mt-1">Tidak ada piket (libur / akhir pekan)</div>
        )}
      </div>
      <div>
        {days.map(d => (
          <div key={d.day} className="flex items-center gap-2 py-1.5 px-1 border-b border-slate-100 last:border-0"
            style={d.isToday ? { background: 'rgba(13,148,136,0.06)', borderRadius: 8 } : undefined}>
            <span className="text-[11px] font-bold w-12 flex-shrink-0" style={{ color: d.isToday ? '#0d9488' : '#94a3b8' }}>{d.day}</span>
            <span className="text-xs font-semibold text-slate-700 truncate flex-1">{d.name || <span className="text-slate-300">— kosong</span>}</span>
            {d.isToday && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#0d9488', color: 'white' }}>Hari ini</span>}
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET REGISTRY — metadata deklaratif. Compose di PermissionAwareDashboard.
// ═══════════════════════════════════════════════════════════════════════════════
export const WIDGETS: WidgetDef[] = [
  // Team Monitoring paling atas utk Admin/Team (full width) — jawab "mana report tim".
  { id: 'team-monitoring', permission: canSeeTeamMonitoring, priority: 1, size: 'full', Component: TeamMonitoringWidget },
  { id: 'request-schedule',permission: (u) => hasMenu(u, 'reminder-schedule'),      priority: 3, size: 'md', Component: RequestScheduleWidget },
  { id: 'ticket',          permission: (u) => hasMenu(u, 'ticket-troubleshooting'), priority: 4, size: 'md', Component: TicketWidget },
  { id: 'project',         permission: (u) => hasMenu(u, 'request-design-project'), priority: 5, size: 'md', Component: ProjectWidget },
  // Piket Showroom: SEMUA role (Sales/Marketing perlu tahu PIC piket hari ini).
  { id: 'showroom',        permission: () => true,                                   priority: 6, size: 'md', Component: ShowroomWidget },
  { id: 'learning',        permission: (u) => hasMenu(u, 'learning-center'),        priority: 7, size: 'sm', Component: LearningWidget },
  // Analytics Platform = launcher (buka full-screen), bukan embed. Hanya Admin/Team.
  { id: 'analytics',       permission: canAccessAnalytics,   priority: 8, size: 'sm', Component: AnalyticsLauncherWidget },
];
