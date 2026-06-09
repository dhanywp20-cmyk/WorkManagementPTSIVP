'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { PageHeader } from '@/components/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIUser {
  id: string; full_name: string; role: string;
  team_type?: string; jabatan?: string; allowed_menus?: string[];
}

interface KPIMember {
  id: string; name: string; team_type: string; jabatan: string;
  ticketsHandled: number; ticketsSolved: number; ticketsOverdue: number; avgResolutionDays: number;
  remindersAssigned: number; remindersDone: number;
  lcAttempts: number; lcAvgScore: number; lcPassed: number;
  piketFilled: number; ticketAvgResponseHours: number;
  monthlyTickets: number[];
}

interface Scope {
  kind: 'admin' | 'pts_sup' | 'none';
  ptsTeamType?: string;
}

type PeriodKey = 'Minggu Ini' | 'Bulan Ini' | '3 Bulan' | '6 Bulan' | '1 Tahun';
type SortKey = 'name' | 'tickets' | 'solved' | 'solveRate' | 'avgDays' | 'remRate' | 'lcScore' | 'piket';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: PeriodKey[] = ['Minggu Ini', 'Bulan Ini', '3 Bulan', '6 Bulan', '1 Tahun'];
const PERIOD_EMOJI: Record<PeriodKey, string> = {
  'Minggu Ini': '📅', 'Bulan Ini': '🗓️', '3 Bulan': '📆', '6 Bulan': '🗃️', '1 Tahun': '📊',
};
const TEAM_COLORS: Record<string, string> = {
  'Team PTS': '#0284c7', 'Team PTS UMP': '#7c3aed', 'Team PTS MLDS': '#0d9488',
};
const STATUS_COLORS: Record<string, string> = {
  'Solved': '#10b981', 'Pending': '#3b82f6', 'Overdue': '#ef4444',
  'Waiting Approval': '#f59e0b', 'Cancelled': '#6b7280',
  'Process Repair': '#f97316', 'Warranty': '#8b5cf6',
  'Out Of Warranty': '#ec4899', 'Submit RMA': '#06b6d4',
};
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const KPI_COLOR = '#0284c7';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: Date): string { return d.toISOString().split('T')[0]; }

function getPeriodRange(period: PeriodKey) {
  const now = new Date();
  if (period === 'Minggu Ini') {
    const dow = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow)); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const pMon = new Date(mon); pMon.setDate(mon.getDate() - 7);
    const pSun = new Date(pMon); pSun.setDate(pMon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun), prevStart: fmt(pMon), prevEnd: fmt(pSun) };
  }
  if (period === 'Bulan Ini') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pe = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
  }
  if (period === '3 Bulan') {
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const s = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    const ps = new Date(pe.getFullYear(), pe.getMonth() - 2, 1);
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
  }
  if (period === '6 Bulan') {
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const s = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    const ps = new Date(pe.getFullYear(), pe.getMonth() - 5, 1);
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
  }
  // 1 Tahun
  const s = new Date(now.getFullYear(), 0, 1);
  const e = new Date(now.getFullYear(), 11, 31);
  const ps = new Date(now.getFullYear() - 1, 0, 1);
  const pe = new Date(now.getFullYear() - 1, 11, 31);
  return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
}

function progressColor(pct: number): string {
  if (pct >= 90) return '#10b981';
  if (pct >= 70) return '#f59e0b';
  return '#ef4444';
}

function exportCSV(members: KPIMember[], period: string) {
  const headers = ['Nama','Tim','Jabatan','Ticket Handled','Ticket Solved','Solve Rate%','Avg Resolusi(hari)','Overdue','Reminder Assigned','Reminder Done','Reminder Rate%','LC Attempts','LC Avg Score','Piket(hari)','Avg Response(jam)'];
  const rows = members.map(m => {
    const sr = m.ticketsHandled > 0 ? Math.round((m.ticketsSolved / m.ticketsHandled) * 100) : 0;
    const rr = m.remindersAssigned > 0 ? Math.round((m.remindersDone / m.remindersAssigned) * 100) : 0;
    return [m.name, m.team_type, m.jabatan, m.ticketsHandled, m.ticketsSolved, sr, m.avgResolutionDays, m.ticketsOverdue, m.remindersAssigned, m.remindersDone, rr, m.lcAttempts, m.lcAvgScore, m.piketFilled, m.ticketAvgResponseHours].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `KPI-Team-${period.replace(/\s/g,'-')}-${fmt(new Date())}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendBadge({ delta, lowerIsBetter = false }: { delta: number; lowerIsBetter?: boolean }) {
  const abs = Math.abs(delta);
  if (abs < 0.05) return <span className="text-[10px] text-slate-400 font-medium">— 0%</span>;
  const isGood = lowerIsBetter ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? '▲' : '▼';
  const color = isGood ? '#10b981' : '#ef4444';
  return (
    <span className="text-[10px] font-bold flex-shrink-0" style={{ color }}>
      {arrow} {abs.toFixed(1)}%
    </span>
  );
}

function ProgressBar({ value, max, showPct = true, h = 6 }: { value: number; max: number; showPct?: boolean; h?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = progressColor(pct);
  return (
    <div className="flex items-center gap-1.5 w-full min-w-0">
      <div className="flex-1 rounded-full overflow-hidden flex-shrink-0" style={{ height: h, background: '#f1f5f9', minWidth: 40 }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      {showPct && (
        <span className="text-[10px] font-bold w-7 text-right flex-shrink-0" style={{ color }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

function MiniSpark({ values, color = KPI_COLOR }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  const w = 56, h = 18;
  const bw = Math.max(2, Math.floor(w / values.length) - 1);
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * h);
        return <rect key={i} x={i * (bw + 1)} y={h - bh} width={bw} height={bh} rx={1}
          fill={color} opacity={0.35 + (i / values.length) * 0.65} />;
      })}
    </svg>
  );
}

function DonutChart({ segments, size = 56, label }: {
  segments: { value: number; color: string }[]; size?: number; label?: string;
}) {
  const sw = 8, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center flex-shrink-0">
      <span className="text-[9px] text-slate-300">—</span>
    </div>
  );
  let cum = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const offset = -(cum / total) * circ;
          cum += seg.value;
          return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color}
            strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} />;
        })}
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-black text-slate-700">{label}</span>
        </div>
      )}
    </div>
  );
}

function MonthBarChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const currentMonth = new Date().getMonth();
  return (
    <div className="flex items-end gap-0.5 h-[72px]">
      {values.map((v, i) => {
        const bh = Math.max(3, (v / max) * 72);
        const isNow = i === currentMonth;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
            {v > 0 && <span className="text-[7px] font-bold text-slate-500 leading-none">{v}</span>}
            <div className="w-full rounded-t-sm transition-all duration-500"
              style={{ height: bh, background: isNow ? color : `${color}55` }} />
            <span className="text-[7px] text-slate-400 leading-none">{MONTHS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color, trend, lowerIsBetter }: {
  icon: string; label: string; value: string | number; sub?: string;
  color: string; trend?: number; lowerIsBetter?: boolean;
}) {
  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-1.5 relative overflow-hidden"
      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-[0.08]"
        style={{ background: color, transform: 'translate(30%,-30%)' }} />
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: 'rgba(0,0,0,0.38)' }}>{label}</span>
      </div>
      <div className="text-2xl font-black leading-none tracking-tight" style={{ color }}>{value}</div>
      <div className="flex items-center justify-between gap-1 min-h-[14px]">
        {sub && <span className="text-[9px] text-slate-400 truncate">{sub}</span>}
        {trend !== undefined && <TrendBadge delta={trend} lowerIsBetter={lowerIsBetter} />}
      </div>
    </div>
  );
}

// ─── Drill-down Modal ─────────────────────────────────────────────────────────

function DrillModal({ member, onClose, period }: { member: KPIMember; onClose: () => void; period: PeriodKey }) {
  const solveRate = member.ticketsHandled > 0 ? Math.round((member.ticketsSolved / member.ticketsHandled) * 100) : 0;
  const remRate   = member.remindersAssigned > 0 ? Math.round((member.remindersDone / member.remindersAssigned) * 100) : 0;
  const teamColor = TEAM_COLORS[member.team_type] ?? KPI_COLOR;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}cc)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-black text-white"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              {member.name.charAt(0)}
            </div>
            <div>
              <div className="text-white font-black text-sm leading-tight">{member.name}</div>
              <div className="text-white/70 text-[10px]">{member.team_type.replace('Team ','')} · {member.jabatan} · {period}</div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all text-xs">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Ticket Stats */}
          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">🎫 Ticketing</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Ditangani', value: member.ticketsHandled, c: teamColor },
                { label: 'Solved',    value: member.ticketsSolved,  c: '#10b981' },
                { label: 'Overdue',   value: member.ticketsOverdue, c: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center p-2.5 rounded-xl"
                  style={{ background: `${s.c}12` }}>
                  <span className="text-2xl font-black leading-none" style={{ color: s.c }}>{s.value}</span>
                  <span className="text-[8px] text-slate-400 mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-500">Solve Rate</span>
                  <span className="font-bold" style={{ color: progressColor(solveRate) }}>{solveRate}%</span>
                </div>
                <ProgressBar value={member.ticketsSolved} max={member.ticketsHandled} showPct={false} h={7} />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Rata-rata resolusi</span>
                <span className="font-semibold text-slate-600">
                  {member.avgResolutionDays === 0 ? '—' : `${member.avgResolutionDays} hari`}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Avg first response</span>
                <span className="font-semibold text-slate-600">
                  {member.ticketAvgResponseHours === 0 ? '—' : `${member.ticketAvgResponseHours} jam`}
                </span>
              </div>
            </div>
          </section>

          {/* Reminder */}
          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">📅 Reminder Schedule</p>
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-500">Done Rate</span>
                <span className="font-bold" style={{ color: progressColor(remRate) }}>{remRate}%</span>
              </div>
              <ProgressBar value={member.remindersDone} max={member.remindersAssigned} showPct={false} h={7} />
              <div className="flex justify-between text-[10px] mt-1.5">
                <span className="text-slate-400">Diselesaikan</span>
                <span className="font-semibold text-slate-600">{member.remindersDone} / {member.remindersAssigned}</span>
              </div>
            </div>
          </section>

          {/* Learning Center */}
          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">📚 Learning Center</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Quiz Attempts', value: member.lcAttempts,  c: '#6366f1' },
                { label: 'Passed',        value: member.lcPassed,    c: '#10b981' },
                { label: 'Avg Score',     value: member.lcAvgScore === 0 ? '—' : member.lcAvgScore, c: teamColor },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center p-2.5 rounded-xl"
                  style={{ background: `${s.c}12` }}>
                  <span className="text-2xl font-black leading-none" style={{ color: s.c }}>{s.value}</span>
                  <span className="text-[8px] text-slate-400 mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Piket */}
          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">🏪 Piket Showroom</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black" style={{ color: '#0d9488' }}>{member.piketFilled}</span>
              <span className="text-[11px] text-slate-500">hari piket pada periode ini</span>
            </div>
          </section>

          {/* Monthly Trend */}
          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">📈 Trend Ticket per Bulan</p>
            <MonthBarChart values={member.monthlyTickets} color={teamColor} />
          </section>

        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KPITeamPage() {
  const [currentUser, setCurrentUser] = useState<KPIUser | null>(null);
  const [isLoggedIn,  setIsLoggedIn]  = useState(false);
  const [appReady,    setAppReady]    = useState(false);

  const [scope,      setScope]      = useState<Scope>({ kind: 'none' });
  const [scopeReady, setScopeReady] = useState(false);

  const [period,  setPeriod]  = useState<PeriodKey>('Bulan Ini');
  const [members, setMembers] = useState<KPIMember[]>([]);
  const [prevMembers, setPrevMembers] = useState<KPIMember[]>([]);
  const [loading, setLoading] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('tickets');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterTeam, setFilterTeam] = useState('all');
  const [drillMember, setDrillMember] = useState<KPIMember | null>(null);
  const [searchQ, setSearchQ] = useState('');

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const u = getSession<KPIUser>();
    if (!u) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(u);
    setIsLoggedIn(true);
    setTimeout(() => setAppReady(true), 200);
    return startSessionWatcher();
  }, []);

  // ── Scope resolution ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const role    = currentUser.role?.toLowerCase() ?? '';
      const jabatan = currentUser.jabatan ?? '';
      const PTS_TYPES = ['Team PTS', 'Team PTS UMP', 'Team PTS MLDS'];
      if (['admin', 'superadmin'].includes(role)) {
        setScope({ kind: 'admin' }); setScopeReady(true); return;
      }
      if (role === 'team' && PTS_TYPES.includes(currentUser.team_type ?? '') && jabatan === 'Supervisor') {
        setScope({ kind: 'pts_sup', ptsTeamType: currentUser.team_type ?? '' });
        setScopeReady(true); return;
      }
      setScope({ kind: 'none' }); setScopeReady(true);
    })();
  }, [currentUser]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const buildMembers = useCallback(async (membersData: any[], start: string, end: string): Promise<KPIMember[]> => {
    const endFull   = end + 'T23:59:59';
    const todayStr  = fmt(new Date());
    const mNames    = membersData.map((m: any) => m.full_name as string);
    const mIds      = membersData.map((m: any) => m.id as string);

    const [ticketsR, actR, remR, lcR, piketR] = await Promise.all([
      supabase.from('tickets').select('id,assign_name,status,date,created_at')
        .in('assign_name', mNames).gte('created_at', start).lte('created_at', endFull),
      supabase.from('activity_logs').select('id,ticket_id,handler_name,created_at')
        .in('handler_name', mNames).gte('created_at', start).lte('created_at', endFull)
        .order('created_at', { ascending: true }),
      supabase.from('reminders').select('id,assign_name,status,due_date')
        .in('assign_name', mNames).gte('created_at', start).lte('created_at', endFull),
      supabase.from('lc_quiz_attempts').select('id,user_id,score,passed,is_submitted,started_at')
        .in('user_id', mIds).eq('is_submitted', true)
        .gte('started_at', start).lte('started_at', endFull),
      supabase.from('piket_schedules').select('pic_ivp_name,pic_ump_name,pic_mlds_name,day_date')
        .gte('day_date', start).lte('day_date', end),
    ]);

    const tickets  = (ticketsR.data  ?? []) as any[];
    const actLogs  = (actR.data      ?? []) as any[];
    const reminders = (remR.data     ?? []) as any[];
    const lcAttempts = (lcR.data     ?? []) as any[];
    const piketRows  = (piketR.data  ?? []) as any[];

    return membersData.map((m: any): KPIMember => {
      const name = m.full_name as string;
      const uid  = m.id as string;

      // Tickets
      const myT   = tickets.filter((t: any) => t.assign_name === name);
      const tSol  = myT.filter((t: any) => t.status === 'Solved');
      const tOver = myT.filter((t: any) =>
        !['Solved','Cancelled'].includes(t.status) && t.date && t.date < todayStr);
      const tDays = tSol.reduce((acc: number, t: any) => {
        const d = (new Date(t.date).getTime() - new Date(t.created_at).getTime()) / 86400000;
        return acc + Math.max(0, d);
      }, 0);

      // Reminders
      const myRem  = reminders.filter((r: any) => r.assign_name === name);
      const remDone = myRem.filter((r: any) => r.status === 'done').length;

      // LC
      const myLC     = lcAttempts.filter((a: any) => a.user_id === uid);
      const lcScores = myLC.filter((a: any) => a.score != null).map((a: any) => a.score as number);
      const lcAvg    = lcScores.length ? Math.round(lcScores.reduce((a: number, b: number) => a + b, 0) / lcScores.length) : 0;

      // Piket
      const tt     = m.team_type as string;
      const picCol = tt === 'Team PTS' ? 'pic_ivp_name' : tt === 'Team PTS UMP' ? 'pic_ump_name' : 'pic_mlds_name';
      const piketFilled = piketRows.filter((p: any) => p[picCol] === name).length;

      // Avg response time (first activity per ticket)
      const myTIds = new Set(myT.map((t: any) => t.id as string));
      const firstAct: Record<string, string> = {};
      actLogs.filter((a: any) => myTIds.has(a.ticket_id) && a.handler_name === name)
        .forEach((a: any) => { if (!firstAct[a.ticket_id]) firstAct[a.ticket_id] = a.created_at; });
      const resTimes = myT.filter((t: any) => firstAct[t.id])
        .map((t: any) => Math.max(0, (new Date(firstAct[t.id]).getTime() - new Date(t.created_at).getTime()) / 3600000));
      const avgRT = resTimes.length ? Math.round(resTimes.reduce((a: number, b: number) => a + b, 0) / resTimes.length) : 0;

      // Monthly sparkline (12 months)
      const monthlyTickets = Array.from({ length: 12 }, (_, mi) =>
        myT.filter((t: any) => new Date(t.created_at).getMonth() === mi).length
      );

      return {
        id: uid, name, team_type: m.team_type ?? '', jabatan: m.jabatan ?? '',
        ticketsHandled: myT.length, ticketsSolved: tSol.length,
        ticketsOverdue: tOver.length,
        avgResolutionDays: tSol.length ? Math.round(tDays / tSol.length) : 0,
        remindersAssigned: myRem.length, remindersDone: remDone,
        lcAttempts: myLC.length, lcAvgScore: lcAvg,
        lcPassed: myLC.filter((a: any) => a.passed === true).length,
        piketFilled, ticketAvgResponseHours: avgRT, monthlyTickets,
      };
    });
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') return;
    setLoading(true);
    try {
      // Fetch member list once
      let mQ = supabase.from('users').select('id,full_name,jabatan,team_type,role');
      if (scope.kind === 'pts_sup') {
        mQ = mQ.eq('role', 'team').eq('team_type', scope.ptsTeamType ?? '');
      } else {
        mQ = mQ.in('team_type', ['Team PTS', 'Team PTS UMP', 'Team PTS MLDS']).eq('role', 'team');
      }
      const { data: mData } = await mQ;
      if (!mData?.length) { setLoading(false); return; }

      const { start, end, prevStart, prevEnd } = getPeriodRange(period);
      const [cur, prev] = await Promise.all([
        buildMembers(mData, start, end),
        buildMembers(mData, prevStart, prevEnd),
      ]);
      setMembers(cur);
      setPrevMembers(prev);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [scopeReady, scope, period, buildMembers]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── Computed values ───────────────────────────────────────────────────────

  const allTeamTypes = useMemo(() => Array.from(new Set(members.map(m => m.team_type))).sort(), [members]);

  const summary = useMemo(() => {
    const tot  = (arr: KPIMember[], fn: (m: KPIMember) => number) => arr.reduce((s, m) => s + fn(m), 0);
    const avg  = (arr: KPIMember[], fn: (m: KPIMember) => number) =>
      arr.length ? Math.round(tot(arr, fn) / arr.length) : 0;
    const trendPct = (cur: number, prev: number) =>
      prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

    const totalT  = tot(members, m => m.ticketsHandled);
    const totalS  = tot(members, m => m.ticketsSolved);
    const totalOD = tot(members, m => m.ticketsOverdue);
    const totalRA = tot(members, m => m.remindersAssigned);
    const totalRD = tot(members, m => m.remindersDone);
    const lcAvg   = avg(members, m => m.lcAvgScore);
    const avgDays = avg(members, m => m.avgResolutionDays);
    const sr      = totalT > 0 ? Math.round((totalS / totalT) * 100) : 0;
    const rr      = totalRA > 0 ? Math.round((totalRD / totalRA) * 100) : 0;

    const pTotalT  = tot(prevMembers, m => m.ticketsHandled);
    const pTotalS  = tot(prevMembers, m => m.ticketsSolved);
    const pTotalOD = tot(prevMembers, m => m.ticketsOverdue);
    const pTotalRA = tot(prevMembers, m => m.remindersAssigned);
    const pTotalRD = tot(prevMembers, m => m.remindersDone);
    const pLcAvg   = avg(prevMembers, m => m.lcAvgScore);
    const pAvgDays = avg(prevMembers, m => m.avgResolutionDays);
    const pSr      = pTotalT > 0 ? Math.round((pTotalS / pTotalT) * 100) : 0;
    const pRr      = pTotalRA > 0 ? Math.round((pTotalRD / pTotalRA) * 100) : 0;

    return {
      totalT, totalS, totalOD, totalRA, totalRD, lcAvg, avgDays, sr, rr,
      trendT:    trendPct(totalT,  pTotalT),
      trendSr:   sr - pSr,
      trendDays: trendPct(avgDays, pAvgDays),
      trendRr:   rr - pRr,
      trendLc:   lcAvg - pLcAvg,
      trendOD:   trendPct(totalOD, pTotalOD),
    };
  }, [members, prevMembers]);

  const sortedMembers = useMemo(() => {
    let list = [...members];
    if (filterTeam !== 'all') list = list.filter(m => m.team_type === filterTeam);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const v = (m: KPIMember): number | string => {
        switch (sortKey) {
          case 'name':     return m.name;
          case 'tickets':  return m.ticketsHandled;
          case 'solved':   return m.ticketsSolved;
          case 'solveRate': return m.ticketsHandled > 0 ? m.ticketsSolved / m.ticketsHandled : 0;
          case 'avgDays':  return m.avgResolutionDays;
          case 'remRate':  return m.remindersAssigned > 0 ? m.remindersDone / m.remindersAssigned : 0;
          case 'lcScore':  return m.lcAvgScore;
          case 'piket':    return m.piketFilled;
        }
      };
      const av = v(a), bv = v(b);
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [members, sortKey, sortDir, filterTeam, searchQ]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? <span className="text-sky-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
      : <span className="text-slate-300 ml-0.5">↕</span>;

  // ── Period label ──────────────────────────────────────────────────────────

  const { start, end } = getPeriodRange(period);
  const periodLabel = `${new Date(start).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })} — ${new Date(end).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}`;

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isLoggedIn || !appReady) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="w-8 h-8 border-[3px] border-sky-200 border-t-sky-600 rounded-full animate-spin" />
    </div>
  );

  if (scopeReady && scope.kind === 'none') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3" style={{ background: '#f8fafc' }}>
      <span className="text-5xl">🔒</span>
      <p className="text-slate-600 text-sm font-semibold">Akses Terbatas</p>
      <p className="text-slate-400 text-xs">Halaman ini hanya untuk Admin & Supervisor PTS</p>
    </div>
  );

  // ── Ticket status breakdown for donut chart ─────────────────────────────
  const donutSegments = [
    { value: summary.totalS,                                 color: STATUS_COLORS['Solved'] },
    { value: summary.totalOD,                                color: STATUS_COLORS['Overdue'] },
    { value: Math.max(0, summary.totalT - summary.totalS - summary.totalOD), color: STATUS_COLORS['Pending'] },
  ].filter(s => s.value > 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <PageHeader icon="📊" title="KPI Team" subtitle="PTS IVP — Key Performance Indicators"
        color={KPI_COLOR} colorLight="#0369a1">
        <button onClick={() => fetchAllData()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all bg-white hover:bg-sky-50"
          style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Sync
        </button>
        <button onClick={() => exportCSV(sortedMembers, period)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
          style={{ background: KPI_COLOR, borderColor: KPI_COLOR, color: '#fff', boxShadow: `0 2px 8px ${KPI_COLOR}40` }}>
          ⬇ Export CSV
        </button>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        {/* ── Period Selector Bar ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Periode</span>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
              style={{
                background:   period === p ? KPI_COLOR : '#fff',
                color:        period === p ? '#fff' : '#64748b',
                borderColor:  period === p ? KPI_COLOR : '#e2e8f0',
                boxShadow:    period === p ? `0 2px 10px ${KPI_COLOR}50` : 'none',
              }}>
              {PERIOD_EMOJI[p]} {p}
            </button>
          ))}
          <span className="ml-2 text-[10px] text-slate-400 italic">{periodLabel}</span>

          {loading && (
            <div className="ml-2 w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin flex-shrink-0" />
          )}

          {/* Team filter — admin only */}
          {scope.kind === 'admin' && allTeamTypes.length > 1 && (
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="ml-auto text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-sky-200">
              <option value="all">Semua Tim</option>
              {allTeamTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard icon="🎫" label="Total Ticket"
            value={loading ? '…' : summary.totalT}
            sub={`${summary.totalS} solved`}
            color="#dc2626" trend={loading ? undefined : summary.trendT} />
          <SummaryCard icon="✅" label="Solve Rate"
            value={loading ? '…' : `${summary.sr}%`}
            sub="target ≥90%"
            color={loading ? '#94a3b8' : progressColor(summary.sr)}
            trend={loading ? undefined : summary.trendSr} />
          <SummaryCard icon="⏱️" label="Avg Resolusi"
            value={loading ? '…' : `${summary.avgDays} hr`}
            sub="rata-rata hari"
            color="#f97316"
            trend={loading ? undefined : summary.trendDays} lowerIsBetter />
          <SummaryCard icon="📅" label="Reminder Done"
            value={loading ? '…' : `${summary.rr}%`}
            sub={`${summary.totalRD}/${summary.totalRA}`}
            color={loading ? '#94a3b8' : progressColor(summary.rr)}
            trend={loading ? undefined : summary.trendRr} />
          <SummaryCard icon="📚" label="LC Score"
            value={loading ? '…' : summary.lcAvg === 0 ? '—' : summary.lcAvg}
            sub="rata-rata quiz"
            color="#6366f1"
            trend={loading ? undefined : summary.trendLc} />
          <SummaryCard icon="⚠️" label="Overdue"
            value={loading ? '…' : summary.totalOD}
            sub="ticket terlambat"
            color="#ef4444"
            trend={loading ? undefined : summary.trendOD} lowerIsBetter />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Ticket distribution donut per team */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              📊 Status Ticket
            </div>
            {loading
              ? <div className="h-20 rounded-lg animate-pulse bg-slate-50" />
              : (
                <div className="flex items-center gap-4">
                  <DonutChart
                    segments={donutSegments}
                    size={72}
                    label={`${summary.totalT}`}
                  />
                  <div className="flex-1 space-y-1.5">
                    {[
                      { label: 'Solved',  value: summary.totalS,                                                color: '#10b981' },
                      { label: 'Active',  value: Math.max(0, summary.totalT - summary.totalS - summary.totalOD), color: '#3b82f6' },
                      { label: 'Overdue', value: summary.totalOD,                                               color: '#ef4444' },
                    ].filter(s => s.value > 0).map(s => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-[10px] text-slate-500 flex-1">{s.label}</span>
                        <span className="text-[10px] font-bold text-slate-700">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Per-team breakdown */}
            {!loading && allTeamTypes.length > 0 && (
              <div className="mt-3 space-y-1.5 pt-3 border-t border-slate-50">
                {allTeamTypes.filter(tt => filterTeam === 'all' || tt === filterTeam).map(tt => {
                  const tm   = members.filter(m => m.team_type === tt);
                  const ttot = tm.reduce((s, m) => s + m.ticketsHandled, 0);
                  const tsol = tm.reduce((s, m) => s + m.ticketsSolved, 0);
                  const pct  = ttot > 0 ? Math.round((tsol / ttot) * 100) : 0;
                  const col  = TEAM_COLORS[tt] ?? '#64748b';
                  return (
                    <div key={tt}>
                      <div className="flex justify-between text-[9px] mb-0.5">
                        <span className="font-semibold text-slate-500">{tt.replace('Team ', '')}</span>
                        <span className="font-bold" style={{ color: col }}>{ttot} · {pct}%</span>
                      </div>
                      <ProgressBar value={tsol} max={ttot} showPct={false} h={4} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Monthly ticket trend */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              📈 Trend Ticket Bulanan
            </div>
            {loading
              ? <div className="h-20 rounded-lg animate-pulse bg-slate-50" />
              : <MonthBarChart
                  values={Array.from({ length: 12 }, (_, mi) =>
                    members.filter(m => filterTeam === 'all' || m.team_type === filterTeam)
                      .reduce((s, m) => s + m.monthlyTickets[mi], 0)
                  )}
                  color={KPI_COLOR}
                />
            }
          </div>

          {/* Top performers */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
              🏆 Top Performer (Solved)
            </div>
            {loading
              ? <div className="h-20 rounded-lg animate-pulse bg-slate-50" />
              : (
                <div className="space-y-2">
                  {[...members]
                    .filter(m => filterTeam === 'all' || m.team_type === filterTeam)
                    .sort((a, b) => b.ticketsSolved - a.ticketsSolved)
                    .slice(0, 6)
                    .map((m, i) => {
                      const teamCol = TEAM_COLORS[m.team_type] ?? '#64748b';
                      const maxSol  = Math.max(...members.map(x => x.ticketsSolved), 1);
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-300 w-3">{i + 1}</span>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white flex-shrink-0"
                            style={{ background: teamCol }}>{m.name.charAt(0)}</div>
                          <span className="text-[10px] text-slate-600 flex-1 truncate">{m.name.split(' ')[0]}</span>
                          <ProgressBar value={m.ticketsSolved} max={maxSol} showPct={false} h={5} />
                          <span className="text-[10px] font-bold w-5 text-right flex-shrink-0" style={{ color: '#10b981' }}>{m.ticketsSolved}</span>
                        </div>
                      );
                    })}
                  {members.length === 0 && !loading && (
                    <p className="text-[10px] text-slate-400 text-center py-4">Tidak ada data</p>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* ── Handler Performance Table ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">👥 Handler Performance</span>
              {!loading && (
                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                  {sortedMembers.length} anggota
                </span>
              )}
            </div>
            {/* Search */}
            <input
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Cari nama..."
              className="text-[11px] border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-100 w-40"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {[
                    { key: 'name' as SortKey,     label: 'Nama',        align: 'left'   },
                    { key: 'tickets' as SortKey,  label: 'Ticket',      align: 'center' },
                    { key: 'solveRate' as SortKey,label: 'Solve Rate',  align: 'center' },
                    { key: 'avgDays' as SortKey,  label: 'Avg Resolusi',align: 'center' },
                    { key: 'remRate' as SortKey,  label: 'Reminder',    align: 'center' },
                    { key: 'lcScore' as SortKey,  label: 'LC Score',    align: 'center' },
                    { key: 'piket' as SortKey,    label: 'Piket',       align: 'center' },
                  ].map(col => (
                    <th key={col.key}
                      className={`px-3 py-2.5 font-bold text-slate-500 cursor-pointer select-none whitespace-nowrap text-${col.align}`}
                      onClick={() => handleSort(col.key)}>
                      {col.label}<SortIcon k={col.key} />
                    </th>
                  ))}
                  <th className="px-3 py-2.5 font-bold text-slate-500 text-center whitespace-nowrap">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3.5">
                        <div className="h-3 rounded-full animate-pulse bg-slate-100" style={{ width: j === 0 ? '80%' : '60%' }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && sortedMembers.map((m, idx) => {
                  const solveRate  = m.ticketsHandled > 0 ? Math.round((m.ticketsSolved / m.ticketsHandled) * 100) : 0;
                  const remRate    = m.remindersAssigned > 0 ? Math.round((m.remindersDone / m.remindersAssigned) * 100) : 0;
                  const teamCol    = TEAM_COLORS[m.team_type] ?? '#64748b';
                  const dayColor   = m.avgResolutionDays === 0 ? '#94a3b8'
                    : m.avgResolutionDays <= 3 ? '#10b981'
                    : m.avgResolutionDays <= 7 ? '#f59e0b' : '#ef4444';
                  const lcColor    = m.lcAvgScore === 0 ? '#94a3b8'
                    : m.lcAvgScore >= 80 ? '#10b981'
                    : m.lcAvgScore >= 60 ? '#f59e0b' : '#ef4444';

                  return (
                    <tr key={m.id}
                      onClick={() => setDrillMember(m)}
                      className="cursor-pointer transition-colors group"
                      style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}>

                      {/* Name */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                            style={{ background: `linear-gradient(135deg,${teamCol},${teamCol}cc)` }}>
                            {m.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-700 leading-tight truncate">{m.name}</div>
                            <div className="text-[9px] text-slate-400 truncate">{m.team_type.replace('Team ','')} · {m.jabatan}</div>
                          </div>
                        </div>
                      </td>

                      {/* Tickets */}
                      <td className="px-3 py-3 text-center">
                        <span className="font-black text-slate-700">{m.ticketsHandled}</span>
                        {m.ticketsOverdue > 0 && (
                          <div className="text-[8px] font-bold text-red-400">{m.ticketsOverdue} OD</div>
                        )}
                      </td>

                      {/* Solve Rate */}
                      <td className="px-3 py-3" style={{ minWidth: 100 }}>
                        <ProgressBar value={m.ticketsSolved} max={m.ticketsHandled} h={6} />
                      </td>

                      {/* Avg Days */}
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold" style={{ color: dayColor }}>
                          {m.avgResolutionDays === 0 ? '—' : `${m.avgResolutionDays}h`}
                        </span>
                      </td>

                      {/* Reminder */}
                      <td className="px-3 py-3" style={{ minWidth: 90 }}>
                        <ProgressBar value={m.remindersDone} max={m.remindersAssigned} h={6} />
                      </td>

                      {/* LC Score */}
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold" style={{ color: lcColor }}>
                          {m.lcAvgScore === 0 ? '—' : m.lcAvgScore}
                        </span>
                        {m.lcAttempts > 0 && (
                          <div className="text-[8px] text-slate-400">{m.lcAttempts}x</div>
                        )}
                      </td>

                      {/* Piket */}
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-slate-600">{m.piketFilled}</span>
                        <div className="text-[8px] text-slate-400">hari</div>
                      </td>

                      {/* Trend Spark */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex justify-center">
                          <MiniSpark values={m.monthlyTickets} color={teamCol} />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && sortedMembers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                      Tidak ada data untuk periode &amp; filter ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          {!loading && sortedMembers.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-50 flex items-center gap-4 flex-wrap">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Progress bar:</span>
              {[['≥90%', '#10b981'], ['70–89%', '#f59e0b'], ['<70%', '#ef4444']].map(([lbl, c]) => (
                <div key={lbl} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  <span className="text-[9px] text-slate-500 font-medium">{lbl}</span>
                </div>
              ))}
              <span className="text-[9px] text-slate-300 ml-auto italic">Klik baris untuk detail →</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Drill-down Modal ── */}
      {drillMember && (
        <DrillModal member={drillMember} period={period} onClose={() => setDrillMember(null)} />
      )}
    </div>
  );
}
