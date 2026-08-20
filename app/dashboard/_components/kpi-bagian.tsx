
'use client';
import React, { type ReactNode } from 'react';

/**
 * Tipe, warna, penolong tanggal, dan komponen kecil ringkasan KPI dashboard. Semuanya berdiri sendiri - tidak satu pun menyentuh state DashboardKPI.
 */

// Types

export interface KPIData {
  tickets: {
    total: number; open: number; solved: number; waitingApproval: number;
    byHandler: { name: string; count: number }[];
    byStatus: { status: string; count: number; color: string }[];
    byDivision: { div: string; count: number }[];
    resolvedToday: number; avgResolutionDays: number;
  };
  reminders: {
    total: number; pending: number; done: number; dueSoon: number;
    byCategory: { cat: string; count: number; color: string }[];
    overdueCount: number;
  };
  piket: {
    todayIVP: string | null; todayUMP: string | null; todayMvi: string | null;
    weekFilled: number; weekTotal: number; kegiatanToday: number;
  };
  units: { totalLogs: number; keluarThisMonth: number; masukThisMonth: number };
  users: { total: number; byRole: { role: string; count: number }[] };
  learning: { totalSessions: number; completedSessions: number; totalParticipants: number; avgScore: number };
}

export interface KPITeamMember {
  id: string;
  name: string;
  team_type: string;
  jabatan: string;
  // Auto dari platform
  ticketsHandled: number;
  ticketsSolved: number;
  ticketsOverdue: number;
  avgResolutionDays: number;
  remindersAssigned: number;
  remindersDone: number;
  remindersOverdue: number;
  lcAttempts: number;
  lcAvgScore: number;
  lcPassed: number;
  lcFailedBelow75: number;   // LC: jumlah attempt score < 75
  piketFilled: number;
  ticketAvgResponseHours: number;
  formReviewLowRating: number;
  // Monthly sparkline data (12 bulan)
  monthlyTickets: number[];
  monthlyLC: number[];
  // Manual input (KPI yg tidak bisa diambil otomatis)
  manual: {
    komplainCount: number;        // Technical knowledge - jumlah komplain (max 12)
    responTime: number;           // Kecepatan respon komplain (1=OK, 0=Tidak OK)
    technicalNote: number;        // RnD - jumlah technical note diterbitkan (min 6/thn)
    bastDemo: number;             // BAST & Demo - jumlah form selesai dalam 7 hari
    bastDemoTotal: number;        // Total BAST & Demo yang ada
    reportBulanan: number;        // Pelaporan bulanan tepat waktu (0-12)
    learningMastery: number;      // Penguasaan teknikal (0-12 kategori)
  };
}

export interface KPITeamState {
  members: KPITeamMember[];
  loading: boolean;
  editingMember: string | null;  // member id yang sedang diedit
  editValues: Partial<KPITeamMember['manual']>;
  filterYear: number;
  filterPeriod: '6m' | '1y';   // NEW: 6 bulan atau 1 tahun
  filterTeam: string;
}

export interface AuditEntry {
  id: string; module: string; actor: string; action: string;
  target: string; detail: string; ts: string;
  severity: 'info' | 'warn' | 'critical'; icon: string;
}

export interface Scope {
  kind: 'admin' | 'pts_sup' | 'none';
  // pts_sup
  ptsTeamType?: string;
  ptsMemberNames?: string[];
}

// Constants

export const STATUS_COLORS: Record<string, string> = {
  'Waiting Approval': '#f59e0b', 'Pending': '#3b82f6', 'Solved': '#10b981',
  'Cancelled': '#6b7280', 'Overdue': '#ef4444', 'Warranty': '#8b5cf6',
  'Out Of Warranty': '#ec4899', 'Process Repair': '#f97316', 'Submit RMA': '#06b6d4',
};

export const CATEGORY_COLORS: Record<string, string> = {
  'Demo Product': '#3b82f6', 'Meeting & Survey': '#8b5cf6', 'Konfigurasi': '#10b981',
  'Konfigurasi & Training': '#06b6d4', 'Troubleshooting': '#ef4444',
  'Training': '#f59e0b', 'Internal': '#6b7280',
};

export const SEVERITY_STYLE = {
  info:     { bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.18)',  dot: '#3b82f6', text: '#1e40af' },
  warn:     { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)',  dot: '#d97706', text: '#92400e' },
  critical: { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',   dot: '#ef4444', text: '#991b1b' },
};

// Helpers

export const todayStr   = () => new Date().toISOString().split('T')[0];

export const dayOfWeek  = () => ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];

export const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };

export function getMonday() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

// Sub-components

export function MiniDonut({ segments, size = 56 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={size/2-4} fill="none" stroke="#e2e8f0" strokeWidth={7}/></svg>;
  const r = size/2-5, circ = 2*Math.PI*r; let off = 0;
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8ecf0" strokeWidth={7}/>
      {segments.map((seg,i) => { const pct=seg.value/total, dash=pct*circ, gap=circ-dash;
        const el=<circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={7} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-off*circ} strokeLinecap="butt"/>;
        off+=pct; return el; })}
    </svg>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), w=80, h=28;
  const pts = values.map((v,i) => `${(i/(values.length-1))*w},${h-(v/max)*h}`).join(' ');
  return (
    <svg aria-hidden="true" focusable="false" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={(values.length-1)/(values.length-1)*w} cy={h-(values[values.length-1]/max)*h} r={3} fill={color}/>
    </svg>
  );
}

export function StatCard({ icon, label, value, sub, color, sparkline, donut, loading }: {
  icon: string; label: string; value: string|number; sub?: string; color: string;
  sparkline?: number[]; donut?: { segments: { value:number; color:string }[] }; loading?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden"
      style={{ background:'#ffffff', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.06]"
        style={{ background:color, transform:'translate(30%,-30%)' }}/>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{icon}</span>
            <span className="text-[11px] font-semibold tracking-wide uppercase truncate" style={{ color:'rgba(0,0,0,0.4)' }}>{label}</span>
          </div>
          {loading ? <div className="h-7 w-16 rounded animate-pulse" style={{ background:'rgba(0,0,0,0.08)' }}/> :
            <div className="text-2xl font-black tracking-tight" style={{ color }}>{value}</div>}
          {sub && <div className="text-[11px] mt-0.5 truncate" style={{ color:'rgba(0,0,0,0.35)' }}>{sub}</div>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {donut && <MiniDonut segments={donut.segments}/>}
          {sparkline && sparkline.length > 1 && <Sparkline values={sparkline} color={color}/>}
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({ icon, title, sub, right }: { icon:string; title:string; sub?:string; right?:ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background:'rgba(190,18,60,0.1)', border:'1px solid rgba(190,18,60,0.15)' }}>{icon}</div>
        <div>
          <h2 className="text-sm font-bold tracking-wide" style={{ color:'rgba(0,0,0,0.75)' }}>{title}</h2>
          {sub && <p className="text-[11px]" style={{ color:'rgba(0,0,0,0.4)' }}>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function HBarChart({ data, color, maxItems=6 }: { data:{label:string;value:number}[]; color:string; maxItems?:number }) {
  const top = data.slice(0, maxItems), max = Math.max(...top.map(d=>d.value), 1);
  return (
    <div className="space-y-1.5">
      {top.map((d,i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] w-24 truncate flex-shrink-0 text-right" style={{ color:'rgba(0,0,0,0.5)' }}>{d.label}</span>
          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background:'rgba(0,0,0,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${(d.value/max)*100}%`, background:color, opacity:0.85-i*0.07 }}/>
          </div>
          <span className="text-[11px] font-bold w-6 text-right" style={{ color:'rgba(0,0,0,0.6)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AuditRow({ entry }: { entry: AuditEntry }) {
  const s = SEVERITY_STYLE[entry.severity];
  const fmt = new Date(entry.ts).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{ background: s.bg, border:`1px solid ${s.border}` }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm"
        style={{ background:`${s.dot}18` }}>{entry.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold truncate" style={{ color:'rgba(0,0,0,0.75)' }}>{entry.action}</span>
          <span className="text-[10px] flex-shrink-0" style={{ color:'rgba(0,0,0,0.35)' }}>{fmt}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background:`${s.dot}18`, color:s.text }}>{entry.module}</span>
          <span className="text-[10px]" style={{ color:'rgba(0,0,0,0.4)' }}>by <b style={{ color:'rgba(0,0,0,0.6)' }}>{entry.actor}</b></span>
          {entry.target && <span className="text-[10px] truncate max-w-[180px]" style={{ color:'rgba(0,0,0,0.35)' }}>→ {entry.target}</span>}
        </div>
        {entry.detail && <p className="text-[10px] mt-0.5 truncate" style={{ color:'rgba(0,0,0,0.3)' }}>{entry.detail}</p>}
      </div>
    </div>
  );
}

export function ScopeBadge({ scope }: { scope: Scope }) {
  const cfg = {
    admin:     { label: 'Semua Data',         color: '#be123c', icon: '👑' },
    pts_sup:   { label: scope.ptsTeamType ?? 'PTS Supervisor', color: '#0891b2', icon: '🏪' },
    none:      { label: '-',                  color: '#6b7280', icon: '—'  },
  }[scope.kind];
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
      style={{ background:`${cfg.color}18`, color:cfg.color, border:`1px solid ${cfg.color}30` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
