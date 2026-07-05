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
import { hasMenu, canAccessAnalytics, canSeeTeamMonitoring } from './permissions';
import {
  getMonday, getDayDate, toKey, DAYS_OF_WEEK, getRollingNameForDate, type PiketRow,
} from '@/app/picket-showroom/_components/shared';
import { AnalyticsPlatform } from '@/app/analytics-dashboard/_components/AnalyticsPlatform';

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

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Analytics (native) — render AnalyticsPlatform LANGSUNG (BUKAN iframe),
// lengkap dgn tab Analytics / Command Center / Audit Log. Tema analytics penuh utk
// Admin/Team, digabung ke dashboard. Widget ringkasan personal disembunyikan utk
// role ini (`!canAccessAnalytics`) → anti-duplikat.
// ═══════════════════════════════════════════════════════════════════════════════
const AnalyticsNativeWidget: React.FC<WidgetProps> = ({ user }) => (
  <AnalyticsPlatform embedded injectedUser={user} />
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
// WIDGET: Analytics Saya (Sales/Marketing) — tema analytics, DATA MILIK SENDIRI.
// Menggabung 4 platform: Request Schedule, Request Design Project, Form Review BAST,
// Ticket Troubleshooting. Tiap panel hanya muncul kalau user punya menunya.
// ═══════════════════════════════════════════════════════════════════════════════
interface SalesAnalytics {
  schedule: { total: number; active: number; done: number; byCat: { name: string; count: number }[] };
  project: { total: number; pending: number; progress: number; done: number };
  review: { total: number; demo: number; bast: number };
  ticket: { total: number; open: number; solved: number };
}

function AnalyticStat({ gradient, icon, label, value, subs }: {
  gradient: string; icon: string; label: string; value: number;
  subs: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: gradient, boxShadow: '0 6px 20px rgba(0,0,0,0.16)' }}>
      <div className="text-xl mb-1.5 opacity-80 select-none">{icon}</div>
      <div className="text-3xl font-black text-white tabular-nums leading-none">{value}</div>
      <div className="text-xs font-bold text-white/90 mt-1 leading-tight">{label}</div>
      <div className="flex gap-3 mt-2.5">
        {subs.map((s, i) => (
          <div key={i}>
            <div className="text-sm font-black text-white tabular-nums leading-none">{s.value}</div>
            <div className="text-[9px] text-white/70 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SalesAnalyticsWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const showSchedule = hasMenu(user, 'reminder-schedule');
  const showProject  = hasMenu(user, 'request-design-project');
  const showReview   = hasMenu(user, 'form-bast');
  const showTicket   = hasMenu(user, 'ticket-troubleshooting');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [remRes, prRes, rvRes, tkRes] = await Promise.all([
          showSchedule ? supabase.from('reminders').select('status,category').eq('sales_name', user.full_name) : Promise.resolve({ data: [] }),
          showProject  ? supabase.from('project_requests').select('status').eq('requester_id', user.id) : Promise.resolve({ data: [] }),
          showReview   ? supabase.from('form_reviews').select('review_category').or(`guest_username.eq.${user.username},sales_name.eq.${user.full_name}`) : Promise.resolve({ data: [] }),
          showTicket   ? supabase.from('tickets').select('status').eq('created_by', user.username) : Promise.resolve({ data: [] }),
        ]);
        const rem = (remRes.data ?? []) as { status: string; category: string }[];
        const pr  = (prRes.data ?? []) as { status: string }[];
        const rv  = (rvRes.data ?? []) as { review_category: string }[];
        const tk  = (tkRes.data ?? []) as { status: string }[];
        const catMap: Record<string, number> = {};
        rem.forEach(r => { if (r.category) catMap[r.category] = (catMap[r.category] ?? 0) + 1; });
        const byCat = Object.entries(catMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 4);
        if (alive) setData({
          schedule: {
            total: rem.length,
            active: rem.filter(r => r.status !== 'done' && r.status !== 'cancelled').length,
            done: rem.filter(r => r.status === 'done').length,
            byCat,
          },
          project: {
            total: pr.length,
            pending: pr.filter(p => p.status === 'pending').length,
            progress: pr.filter(p => p.status === 'in_progress' || p.status === 'approved').length,
            done: pr.filter(p => p.status === 'completed').length,
          },
          review: {
            total: rv.length,
            demo: rv.filter(r => (r.review_category ?? '').toLowerCase().includes('demo')).length,
            bast: rv.filter(r => (r.review_category ?? '').toLowerCase().includes('bast')).length,
          },
          ticket: {
            total: tk.length,
            open: tk.filter(t => t.status !== 'Solved').length,
            solved: tk.filter(t => t.status === 'Solved').length,
          },
        });
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, showSchedule, showProject, showReview, showTicket]);

  return (
    <WidgetCard title="Analytics Saya" icon="📊" accent="#c8861d">
      {loading || !data ? <Loading /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {showSchedule && (
              <AnalyticStat gradient="linear-gradient(135deg,#0891b2,#0e7490)" icon="🗓️" label="Request Schedule" value={data.schedule.total}
                subs={[{ label: 'Aktif', value: data.schedule.active }, { label: 'Selesai', value: data.schedule.done }]} />
            )}
            {showProject && (
              <AnalyticStat gradient="linear-gradient(135deg,#7c3aed,#5b21b6)" icon="🏗️" label="Design Project" value={data.project.total}
                subs={[{ label: 'Pending', value: data.project.pending }, { label: 'Proses', value: data.project.progress }, { label: 'Selesai', value: data.project.done }]} />
            )}
            {showReview && (
              <AnalyticStat gradient="linear-gradient(135deg,#64748b,#475569)" icon="⭐" label="Form Review/BAST" value={data.review.total}
                subs={[{ label: 'Demo', value: data.review.demo }, { label: 'BAST', value: data.review.bast }]} />
            )}
            {showTicket && (
              <AnalyticStat gradient="linear-gradient(135deg,#e11d48,#9f1239)" icon="🎫" label="Ticket" value={data.ticket.total}
                subs={[{ label: 'Aktif', value: data.ticket.open }, { label: 'Solved', value: data.ticket.solved }]} />
            )}
          </div>
          {/* Breakdown kategori Request Schedule */}
          {showSchedule && data.schedule.byCat.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Request Schedule per Kategori</div>
              <div className="space-y-1.5">
                {data.schedule.byCat.map(c => {
                  const pct = data.schedule.total > 0 ? Math.round((c.count / data.schedule.total) * 100) : 0;
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-600 w-32 truncate">{c.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#0891b2' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 w-6 text-right">{c.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            {showSchedule && <button onClick={() => openMenu('reminder-schedule')} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(8,145,178,0.1)', color: '#0891b2' }}>🗓️ Request Schedule →</button>}
            {showProject && <button onClick={() => openMenu('request-design-project')} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>🏗️ Design Project →</button>}
            {showTicket && <button onClick={() => openMenu('ticket-troubleshooting')} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>🎫 Ticket →</button>}
          </div>
        </>
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
  // Analytics native (DashboardKPI, tanpa iframe) — tema analytics penuh utk Admin/Team.
  // Sudah memuat Ticket/Reminder/Piket/Unit/Pengguna/Learning → widget di bawah
  // DISEMBUNYIKAN utk role ini (`!canAccessAnalytics`) supaya TIDAK duplikat data.
  { id: 'analytics',       permission: canAccessAnalytics,   priority: 2, size: 'full', Component: AnalyticsNativeWidget },
  // Analytics Saya (Sales/Marketing) — tema analytics, DATA SENDIRI, 4 platform.
  // Hanya utk role TANPA analytics global & punya minimal 1 dari 4 menu terkait.
  { id: 'sales-analytics', permission: (u) => !canAccessAnalytics(u) && (hasMenu(u, 'reminder-schedule') || hasMenu(u, 'request-design-project') || hasMenu(u, 'form-bast') || hasMenu(u, 'ticket-troubleshooting')), priority: 3, size: 'full', Component: SalesAnalyticsWidget },
  // Piket Showroom: role tanpa analytics (Admin/Team sudah lihat piket di dalam analytics).
  { id: 'showroom',        permission: (u) => !canAccessAnalytics(u),               priority: 6, size: 'md', Component: ShowroomWidget },
  { id: 'learning',        permission: (u) => hasMenu(u, 'learning-center')        && !canAccessAnalytics(u), priority: 7, size: 'sm', Component: LearningWidget },
];
