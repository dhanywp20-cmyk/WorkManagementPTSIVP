'use client';
import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, JABATAN_CONFIG, type JabatanType } from './shared';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIData {
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
    completionRate: number;
  };
  piket: {
    todayIVP: string | null; todayUMP: string | null; todayMlds: string | null;
    weekFilled: number; weekTotal: number; kegiatanToday: number;
  };
  units: { totalLogs: number; keluarThisMonth: number; masukThisMonth: number };
  users: { total: number; byRole: { role: string; count: number }[] };
  learning: { totalSessions: number; completedSessions: number; totalParticipants: number; avgScore: number };
  // Per-team KPI (hanya untuk admin/pts_sup)
  teamKPI?: {
    ivp: TeamKPI;
    mlds: TeamKPI;
  };
}

interface TeamKPI {
  teamName: string;
  ticketTotal: number;
  ticketSolved: number;
  ticketOpen: number;
  ticketAvgResolution: number;
  reminderTotal: number;
  reminderDone: number;
  reminderPending: number;
  reminderOverdue: number;
  reminderCompletionRate: number;
  memberCount: number;
  members: string[];
  // KPI Score sesuai template Excel
  kpiScores: KPIScore[];
  totalKPI: number;
}

interface KPIScore {
  sasaran: string;
  indikator: string;
  bobot: number;
  pencapaian: number; // 0-1
  nilai: number;      // bobot * pencapaian
}

interface AuditEntry {
  id: string; module: string; actor: string; action: string;
  target: string; detail: string; ts: string;
  severity: 'info' | 'warn' | 'critical'; icon: string;
}

interface Scope {
  kind: 'admin' | 'pts_sup' | 'sales_sup' | 'none';
  ptsTeamType?: string;
  ptsMemberNames?: string[];
  salesDivisions?: string[];
  salesSubNames?: string[];
  salesSubIds?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'Waiting Approval': '#f59e0b', 'Pending': '#3b82f6', 'Solved': '#10b981',
  'Cancelled': '#6b7280', 'Overdue': '#ef4444', 'Warranty': '#8b5cf6',
  'Out Of Warranty': '#ec4899', 'Process Repair': '#f97316', 'Submit RMA': '#06b6d4',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Demo Product': '#3b82f6', 'Meeting & Survey': '#8b5cf6', 'Konfigurasi': '#10b981',
  'Konfigurasi & Training': '#06b6d4', 'Troubleshooting': '#ef4444',
  'Training': '#f59e0b', 'Internal': '#6b7280',
};

const SEVERITY_STYLE = {
  info:     { bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.18)',  dot: '#3b82f6', text: '#1e40af' },
  warn:     { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)',  dot: '#d97706', text: '#92400e' },
  critical: { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',   dot: '#ef4444', text: '#991b1b' },
};

// KPI bobot sesuai template Excel
const KPI_TEMPLATE: Array<{ sasaran: string; indikator: string; bobot: number; kategori: 'ticket'|'reminder'|'learning'|'piket' }> = [
  { sasaran: 'Customer Perspective',       indikator: 'Jumlah komplain / ticket troubleshooting',        bobot: 0.15, kategori: 'ticket'   },
  { sasaran: 'Customer Perspective',       indikator: 'Kecepatan respon terhadap ticket (max 1x24 jam)',  bobot: 0.10, kategori: 'ticket'   },
  { sasaran: 'Internal Process',           indikator: 'Technical knowledge (Learning Center)',            bobot: 0.35, kategori: 'learning' },
  { sasaran: 'Internal Process',           indikator: 'Implementasi Reminder & Jadwal Kegiatan',          bobot: 0.20, kategori: 'reminder' },
  { sasaran: 'Internal Process',           indikator: 'Pelaporan & piket showroom',                       bobot: 0.05, kategori: 'piket'    },
  { sasaran: 'Learning & Growth',          indikator: 'Research & Development (Reminder selesai tepat)',  bobot: 0.15, kategori: 'reminder' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr   = () => new Date().toISOString().split('T')[0];
const dayOfWeek  = () => ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
const yearStart  = (year: number) => `${year}-01-01`;
const yearEnd    = (year: number) => `${year}-12-31`;

function getMonday() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

// Hitung KPI score untuk satu team
function calcTeamKPI(
  tickets: any[],
  reminders: any[],
  lcSessions: any[],
  piketWeekFilled: number,
  piketWeekTotal: number,
  actLogs: any[],
  today: string
): KPIScore[] {
  const ticketTotal  = tickets.length;
  const ticketSolved = tickets.filter((t:any)=>t.status==='Solved').length;
  const ticketOpen   = tickets.filter((t:any)=>!['Solved','Cancelled'].includes(t.status)).length;

  // KPI 1: komplain - semakin sedikit semakin baik, target max 12/tahun
  // Jika <=12 komplain = 100%, lebih dari itu dikurangi
  const komplainPencapaian = Math.min(1, ticketOpen <= 12 ? 1 : Math.max(0, (12 - ticketOpen) / 12));

  // KPI 2: respon cepat - % ticket yang solved dari total
  const responPencapaian = ticketTotal > 0 ? Math.min(1, ticketSolved / ticketTotal) : 1;

  // KPI 3: learning center
  const lcScore = lcSessions.filter((s:any)=>s.final_score!=null).map((s:any)=>s.final_score as number);
  const lcAvg   = lcScore.length ? lcScore.reduce((a:number,b:number)=>a+b,0)/lcScore.length : 0;
  const learningPencapaian = Math.min(1, lcAvg / 100);

  // KPI 4: implementasi reminder (completion rate)
  const remDone    = reminders.filter((r:any)=>r.status==='done').length;
  const remTotal   = reminders.length;
  const remPencapaian = remTotal > 0 ? Math.min(1, remDone / remTotal) : 1;

  // KPI 5: piket showroom
  const piketPencapaian = piketWeekTotal > 0 ? Math.min(1, piketWeekFilled / piketWeekTotal) : 1;

  // KPI 6: RnD / reminder tepat waktu (selesai sebelum due_date)
  const remOnTime = reminders.filter((r:any)=>r.status==='done'&&r.due_date>=r.created_at?.split('T')[0]).length;
  const rdPencapaian = remTotal > 0 ? Math.min(1, remOnTime / Math.max(remTotal, 1)) : 1;

  const pencapaians = [komplainPencapaian, responPencapaian, learningPencapaian, remPencapaian, piketPencapaian, rdPencapaian];

  return KPI_TEMPLATE.map((t, i) => ({
    sasaran: t.sasaran,
    indikator: t.indikator,
    bobot: t.bobot,
    pencapaian: pencapaians[i] ?? 0,
    nilai: Math.round((t.bobot * (pencapaians[i] ?? 0)) * 100) / 100,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DonutChart({ segments, size = 56, strokeWidth = 7, label }: {
  segments: { value: number; color: string }[]; size?: number; strokeWidth?: number; label?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = size/2 - strokeWidth/2 - 1;
  const circ = 2 * Math.PI * r;
  if (!total) return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth}/>
      {label && <text x={size/2} y={size/2+4} textAnchor="middle" fontSize={size*0.18} fontWeight="bold" fill="#94a3b8">{label}</text>}
    </svg>
  );
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8ecf0" strokeWidth={strokeWidth}/>
      {segments.map((seg, i) => {
        const pct = seg.value / total, dash = pct * circ, gap = circ - dash;
        const el = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color}
          strokeWidth={strokeWidth} strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-off * circ} strokeLinecap="butt"/>;
        off += pct; return el;
      })}
      {label && <text x={size/2} y={size/2+4} textAnchor="middle" fontSize={size*0.18} fontWeight="bold" fill="#374151"
        style={{ transform:`rotate(90deg)`, transformOrigin:`${size/2}px ${size/2}px` }}>{label}</text>}
    </svg>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), w=80, h=28;
  const pts = values.map((v,i) => `${(i/(values.length-1))*w},${h-(v/max)*h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={(values.length-1)/(values.length-1)*w} cy={h-(values[values.length-1]/max)*h} r={3} fill={color}/>
    </svg>
  );
}

function StatCard({ icon, label, value, sub, color, sparkline, donut, loading }: {
  icon: string; label: string; value: string|number; sub?: string; color: string;
  sparkline?: number[]; donut?: { segments: { value:number; color:string }[] }; loading?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden"
      style={{ background:'#ffffff', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
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
          {donut && <DonutChart segments={donut.segments}/>}
          {sparkline && sparkline.length > 1 && <Sparkline values={sparkline} color={color}/>}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, sub, right }: { icon:string; title:string; sub?:string; right?:ReactNode }) {
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

function SectionPill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{children}</h3>
    </div>
  );
}

function HBarChart({ data, color, maxItems=6 }: { data:{label:string;value:number}[]; color:string; maxItems?:number }) {
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

function AuditRow({ entry }: { entry: AuditEntry }) {
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

function ScopeBadge({ scope }: { scope: Scope }) {
  const cfg = {
    admin:     { label: 'Semua Data',         color: '#be123c', icon: '👑' },
    pts_sup:   { label: scope.ptsTeamType ?? 'PTS Supervisor', color: '#0891b2', icon: '🏪' },
    sales_sup: { label: 'Divisi Anda',        color: '#7c3aed', icon: '💼' },
    none:      { label: '-',                  color: '#6b7280', icon: '—'  },
  }[scope.kind];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ background:`${cfg.color}12`, color: cfg.color, border:`1px solid ${cfg.color}25` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── KPI Team Card ──
function TeamKPICard({ teamKPI, loading }: { teamKPI: TeamKPI; loading: boolean }) {
  const totalScore = teamKPI.kpiScores.reduce((s, k) => s + k.nilai, 0);
  const pct = Math.round(totalScore * 100);
  const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';
  return (
    <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{teamKPI.teamName}</div>
          <div className="text-xl font-black text-slate-800">{loading ? '—' : `${pct}%`}</div>
          <div className="text-[10px] text-slate-400">Total KPI Score</div>
        </div>
        <DonutChart size={64} strokeWidth={9}
          segments={[{ value: pct, color }, { value: Math.max(100-pct,0), color:'#e2e8f0' }]}
          label={`${pct}%`}/>
      </div>
      {!loading && (
        <div className="space-y-1.5">
          {teamKPI.kpiScores.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] truncate flex-1 text-slate-500">{k.indikator.split('(')[0].trim()}</span>
              <div className="w-20 h-2 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                <div className="h-full rounded-full" style={{ width:`${Math.round(k.pencapaian*100)}%`, background: k.pencapaian>=0.9?'#10b981':k.pencapaian>=0.75?'#f59e0b':'#ef4444' }}/>
              </div>
              <span className="text-[10px] font-bold w-10 text-right text-slate-600">{Math.round(k.pencapaian*100)}%</span>
              <span className="text-[10px] w-8 text-right font-bold" style={{ color }}>{k.nilai.toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-1.5 mt-1.5 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-500">TOTAL NILAI KPI</span>
            <span className="text-sm font-black" style={{ color }}>{totalScore.toFixed(2)}</span>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1">
        {teamKPI.members.slice(0,5).map(m => (
          <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{m.split(' ')[0]}</span>
        ))}
        {teamKPI.members.length > 5 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">+{teamKPI.members.length-5}</span>}
      </div>
    </div>
  );
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

function exportKPIExcel(teamKPIs: { ivp: TeamKPI; mlds: TeamKPI }, year: number) {
  const wb = XLSX.utils.book_new();
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  const buildSheet = (team: TeamKPI) => {
    const rows: any[][] = [];
    // Header
    rows.push(['', '', 'INDOVISUAL GROUP', '', '', '', '', '', '', '', '', '', '', '', 'No']);
    rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Dokumen:']);
    rows.push(['', '', 'FORMULIR MONITORING KEY PERFORMANCE INDICATOR', '', '', '', '', '', '', '', '', '', '', '', 'Developed by:']);
    rows.push([]);
    rows.push(['Nama', '', ': (Team ' + team.teamName + ')', '', '', '', '', '', 'Divisi', '', ': IVP']);
    rows.push(['Periode Penilaian', '', `: ${year}`, '', '', '', '', '', 'Department', '', ': Indovisual']);
    rows.push([]);
    // Sub-header bulan
    const h = ['Sasaran', '', '', 'Indikator Kinerja', 'Sumber Data', '', 'TARGET', ...months, 'Rata2/Total', 'BOBOT', 'Nilai Akhir'];
    rows.push(h);
    rows.push([]);

    team.kpiScores.forEach((k) => {
      const monthVals = months.map(() => Math.round(k.pencapaian * 100) + '%');
      const avg = Math.round(k.pencapaian * 100) + '%';
      rows.push(['', '', k.sasaran, k.indikator, 'Platform', '', '', ...monthVals, avg, k.bobot, k.nilai.toFixed(2)]);
      rows.push([]);
    });

    rows.push([]);
    rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL KPI', '', team.kpiScores.reduce((s,k)=>s+k.nilai,0).toFixed(2)]);
    rows.push([]);
    // Summary
    rows.push(['=== RINGKASAN DATA PLATFORM ===']);
    rows.push(['Ticket Total', team.ticketTotal]);
    rows.push(['Ticket Solved', team.ticketSolved]);
    rows.push(['Ticket Open', team.ticketOpen]);
    rows.push(['Avg Resolusi (hari)', team.ticketAvgResolution]);
    rows.push(['Reminder Total', team.reminderTotal]);
    rows.push(['Reminder Done', team.reminderDone]);
    rows.push(['Reminder Overdue', team.reminderOverdue]);
    rows.push(['Completion Rate Reminder', Math.round(team.reminderCompletionRate * 100) + '%']);
    rows.push(['Jumlah Member', team.memberCount]);
    rows.push(['Anggota Tim', team.members.join(', ')]);

    return XLSX.utils.aoa_to_sheet(rows);
  };

  // Sheet per team
  ['ivp', 'mlds'].forEach(key => {
    const team = teamKPIs[key as 'ivp'|'mlds'];
    const ws = buildSheet(team);
    ws['!cols'] = Array(20).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, ws, `KPI Team ${team.teamName} ${year}`);
  });

  // Sheet ringkasan gabungan
  const summary: any[][] = [
    [`RINGKASAN KPI TEAM PTS IVP & MLDS — TAHUN ${year}`],
    [],
    ['Team', 'Total Ticket', 'Solved', 'Open', 'Avg Resolusi', 'Reminder Total', 'Reminder Done', 'Overdue', 'Completion Rate', 'Total KPI Score', 'Status'],
  ];
  ['ivp','mlds'].forEach(key => {
    const t = teamKPIs[key as 'ivp'|'mlds'];
    const score = t.kpiScores.reduce((s,k)=>s+k.nilai,0);
    const pct = Math.round(score*100);
    summary.push([
      t.teamName, t.ticketTotal, t.ticketSolved, t.ticketOpen,
      t.ticketAvgResolution + ' hari', t.reminderTotal, t.reminderDone, t.reminderOverdue,
      Math.round(t.reminderCompletionRate*100)+'%',
      score.toFixed(2),
      pct >= 90 ? 'BAIK' : pct >= 75 ? 'CUKUP' : 'PERLU PERHATIAN',
    ]);
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = Array(12).fill({ wch: 20 });
  XLSX.utils.book_append_sheet(wb, wsSummary, `Summary ${year}`);

  XLSX.writeFile(wb, `KPI_PTS_IVP_MLDS_${year}.xlsx`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardKPI({ currentUser }: { currentUser: User }) {
  const [scope, setScope]           = useState<Scope>({ kind: 'none' });
  const [scopeReady, setScopeReady] = useState(false);
  const [kpi, setKpi]               = useState<KPIData | null>(null);
  const [audit, setAudit]           = useState<AuditEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [tab, setTab]               = useState<'kpi'|'analytics'|'audit'>('kpi');
  const [auditFilter, setAuditFilter] = useState<'all'|'ticket'|'reminder'|'piket'|'user'>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 4 }, (_, i) => currentYear - i);

  // ── 1. Resolve scope ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const role   = currentUser.role?.toLowerCase() ?? '';
      const jabatan = currentUser.jabatan ?? '';
      const jabTier = (JABATAN_CONFIG[jabatan as JabatanType]?.tier ?? 0);
      const PTS_TYPES = ['Team PTS','Team PTS UMP','Team PTS MLDS'];

      if (['admin','superadmin'].includes(role)) {
        setScope({ kind: 'admin' }); setScopeReady(true); return;
      }

      if (role === 'team' && PTS_TYPES.includes(currentUser.team_type ?? '') && jabatan === 'Supervisor') {
        const { data } = await supabase.from('users').select('full_name')
          .eq('role','team').eq('team_type', currentUser.team_type ?? '');
        setScope({
          kind: 'pts_sup',
          ptsTeamType: currentUser.team_type ?? '',
          ptsMemberNames: (data ?? []).map((u:any) => u.full_name as string),
        });
        setScopeReady(true); return;
      }

      if (['guest','sales'].includes(role) && jabTier >= 2) {
        const selfDiv = currentUser.sales_division ?? '';
        const { data: divMaps } = await supabase.from('division_supervisor_mappings')
          .select('sales_division').eq('supervisor_id', currentUser.id);
        const divisions: string[] = [...new Set([
          selfDiv,
          ...(divMaps ?? []).map((m:any) => m.sales_division as string),
        ].filter(Boolean))];
        const { data: userMaps } = await supabase.from('user_supervisor_mappings')
          .select('user_id').eq('supervisor_id', currentUser.id);
        const directIds = (userMaps ?? []).map((m:any) => m.user_id as string);
        const { data: divUsers } = await supabase.from('users')
          .select('id, full_name, jabatan, sales_division')
          .in('sales_division', divisions.length ? divisions : ['__none__'])
          .in('role',['guest','sales']);
        const subFromDiv = (divUsers ?? []).filter((u:any) => {
          const t = JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0;
          return t <= jabTier && u.id !== currentUser.id;
        });
        const directNamesRes = directIds.length
          ? await supabase.from('users').select('id, full_name').in('id', directIds)
          : { data: [] };
        const directUsers = directNamesRes.data ?? [];
        const salesSubIds   = [...new Set([...subFromDiv.map((u:any)=>u.id as string), ...directIds])];
        const salesSubNames = [...new Set([
          currentUser.full_name,
          ...subFromDiv.map((u:any) => u.full_name as string),
          ...directUsers.map((u:any) => u.full_name as string),
        ])];
        setScope({ kind:'sales_sup', salesDivisions:divisions, salesSubNames, salesSubIds });
        setScopeReady(true); return;
      }

      setScope({ kind:'none' }); setScopeReady(true);
    })();
  }, [currentUser]);

  // ── 2. Fetch KPI (scope-aware, year-filtered) ─────────────────────────────

  const fetchKPI = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') { setLoading(false); return; }
    setLoading(true);
    try {
      const today     = todayStr();
      const inOneWeek = new Date(); inOneWeek.setDate(inOneWeek.getDate()+7);
      const oneWeekStr = inOneWeek.toISOString().split('T')[0];
      const yStart = yearStart(selectedYear);
      const yEnd   = yearEnd(selectedYear);

      const scopeTickets = (q: any) => {
        // filter tahun
        q = q.gte('created_at', yStart).lte('created_at', yEnd + 'T23:59:59');
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length)
          return q.in('assign_name', scope.ptsMemberNames);
        if (scope.kind === 'sales_sup') {
          const divFilter = (scope.salesDivisions ?? []).map(d=>`sales_division.eq.${d}`).join(',');
          const nameFilter = (scope.salesSubNames ?? []).map(n=>`sales_name.eq.${n}`).join(',');
          const combined = [divFilter, nameFilter].filter(Boolean).join(',');
          return combined ? q.or(combined) : q;
        }
        return q;
      };
      const scopeReminders = (q: any) => {
        q = q.gte('created_at', yStart).lte('created_at', yEnd + 'T23:59:59');
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length)
          return q.in('assign_name', scope.ptsMemberNames);
        if (scope.kind === 'sales_sup') {
          const divFilter = (scope.salesDivisions ?? []).map(d=>`sales_division.eq.${d}`).join(',');
          const nameFilter = (scope.salesSubNames ?? []).map(n=>`sales_name.eq.${n}`).join(',');
          const combined = [divFilter, nameFilter].filter(Boolean).join(',');
          return combined ? q.or(combined) : q;
        }
        return q;
      };

      const [ticketsRes, actLogsRes, remindersRes, piketTodayRes, piketWeekRes, kegiatanRes, movRes, usersRes, lcSessionsRes] =
        await Promise.all([
          scopeTickets(supabase.from('tickets').select('id,status,assign_name,sales_division,date,created_at')),
          supabase.from('activity_logs').select('id,ticket_id,new_status,created_at,handler_name').order('created_at',{ascending:false}).limit(500),
          scopeReminders(supabase.from('reminders').select('id,status,category,due_date,created_at')),
          supabase.from('piket_schedules').select('day_of_week,pic_ivp_name,pic_ump_name,pic_mlds_name,day_date').eq('day_of_week', dayOfWeek()),
          supabase.from('piket_schedules').select('id,day_date,pic_ivp_name,pic_ump_name,pic_mlds_name').gte('day_date', getMonday()),
          supabase.from('piket_tamu_detail').select('id,created_at').gte('created_at', today),
          supabase.from('movement_logs').select('id,status_barang,tanggal,nama_pts').gte('tanggal', monthStart()),
          scope.kind === 'admin'
            ? supabase.from('users').select('id,role,team_type')
            : Promise.resolve({ data: [] }),
          scope.kind === 'admin'
            ? supabase.from('lc_quiz_sessions').select('id,status,created_by,final_score')
            : Promise.resolve({ data: [] }),
        ]);

      let tickets   = (ticketsRes.data   ?? []) as any[];
      let reminders = (remindersRes.data ?? []) as any[];
      let movements = (movRes.data       ?? []) as any[];
      const actLogs    = (actLogsRes.data    ?? []) as any[];
      const piketToday = ((piketTodayRes.data ?? [])[0]) ?? null;
      const piketWeek  = (piketWeekRes.data  ?? []) as any[];
      const kegiatan   = (kegiatanRes.data   ?? []) as any[];
      const users      = (usersRes.data      ?? []) as any[];;
      const lcSessions = (lcSessionsRes.data ?? []) as any[];

      if (scope.kind === 'pts_sup') {
        movements = movements.filter((m:any) => scope.ptsMemberNames?.includes(m.nama_pts));
      }
      if (scope.kind === 'sales_sup') movements = [];

      // ── KPI calculations ──
      const open           = tickets.filter((t:any)=>!['Solved','Cancelled'].includes(t.status)).length;
      const solved         = tickets.filter((t:any)=>t.status==='Solved').length;
      const waitingApproval= tickets.filter((t:any)=>t.status==='Waiting Approval').length;

      const scopedTicketIds = new Set(tickets.map((t:any)=>t.id as string));
      const resolvedToday = actLogs.filter((a:any)=>
        a.new_status==='Solved' && a.created_at?.startsWith(today) && scopedTicketIds.has(a.ticket_id)
      ).length;

      const handlerMap: Record<string,number> = {};
      tickets.filter((t:any)=>t.assign_name && !['Solved','Cancelled'].includes(t.status))
        .forEach((t:any)=>{ handlerMap[t.assign_name]=(handlerMap[t.assign_name]||0)+1; });
      const byHandler = Object.entries(handlerMap).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);

      const statusMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ statusMap[t.status]=(statusMap[t.status]||0)+1; });
      const byStatus = Object.entries(statusMap).map(([status,count])=>({ status,count,color:STATUS_COLORS[status]??'#94a3b8' })).sort((a,b)=>b.count-a.count);

      const divMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ if(t.sales_division) divMap[t.sales_division]=(divMap[t.sales_division]||0)+1; });
      const byDivision = Object.entries(divMap).map(([div,count])=>({div,count})).sort((a,b)=>b.count-a.count);

      const solvedT = tickets.filter((t:any)=>t.status==='Solved'&&t.date&&t.created_at);
      const totalDays = solvedT.reduce((acc:number,t:any)=>{
        const d=(new Date(t.date).getTime()-new Date(t.created_at).getTime())/86400000;
        return acc+Math.max(0,d);
      },0);
      const avgResolutionDays = solvedT.length?Math.round(totalDays/solvedT.length):0;

      const catMap: Record<string,number> = {};
      reminders.forEach((r:any)=>{ catMap[r.category]=(catMap[r.category]||0)+1; });
      const byCategory = Object.entries(catMap).map(([cat,count])=>({ cat,count,color:CATEGORY_COLORS[cat]??'#94a3b8' })).sort((a,b)=>b.count-a.count);
      const dueSoon     = reminders.filter((r:any)=>r.status==='pending'&&r.due_date>=today&&r.due_date<=oneWeekStr).length;
      const overdueCount= reminders.filter((r:any)=>r.status==='pending'&&r.due_date<today).length;
      const remDone     = reminders.filter((r:any)=>r.status==='done').length;
      const completionRate = reminders.length > 0 ? remDone / reminders.length : 1;

      const weekFilled = piketWeek.filter((p:any)=>p.pic_ivp_name||p.pic_ump_name||p.pic_mlds_name).length;

      const roleMap: Record<string,number> = {};
      users.forEach((u:any)=>{ roleMap[u.role]=(roleMap[u.role]||0)+1; });

      const lcCompleted = lcSessions.filter((s:any) => s.status === 'completed').length;
      const lcParticipants = new Set(lcSessions.map((s:any) => s.created_by as string).filter(Boolean)).size;
      const lcScores = lcSessions.filter((s:any) => s.final_score != null).map((s:any) => s.final_score as number);
      const lcAvgScore = lcScores.length ? Math.round(lcScores.reduce((a:number,b:number)=>a+b,0)/lcScores.length) : 0;

      // ── Per-team KPI (admin only) ──
      let teamKPI: KPIData['teamKPI'] | undefined;
      if (scope.kind === 'admin') {
        const [ivpUsersRes, mldsUsersRes] = await Promise.all([
          supabase.from('users').select('full_name').eq('role','team').eq('team_type','Team PTS'),
          supabase.from('users').select('full_name').eq('role','team').eq('team_type','Team PTS MLDS'),
        ]);
        const ivpMembers  = (ivpUsersRes.data ?? []).map((u:any)=>u.full_name as string);
        const mldsMembers = (mldsUsersRes.data ?? []).map((u:any)=>u.full_name as string);

        const ivpTickets  = tickets.filter((t:any) => ivpMembers.includes(t.assign_name));
        const mldsTickets = tickets.filter((t:any) => mldsMembers.includes(t.assign_name));
        const ivpReminders  = reminders.filter((r:any) => ivpMembers.includes(r.assign_name));
        const mldsReminders = reminders.filter((r:any) => mldsMembers.includes(r.assign_name));
        const ivpLC  = lcSessions.filter((s:any) => ivpMembers.includes(s.created_by));
        const mldsLC = lcSessions.filter((s:any) => mldsMembers.includes(s.created_by));

        const buildTeamKPI = (name: string, tix: any[], rem: any[], lc: any[], members: string[]): TeamKPI => {
          const tSolved = tix.filter((t:any)=>t.status==='Solved');
          const avgRes  = tSolved.length ? Math.round(tSolved.reduce((acc:number,t:any)=>{
            const d=(new Date(t.date||today).getTime()-new Date(t.created_at).getTime())/86400000;
            return acc+Math.max(0,d);
          },0)/tSolved.length) : 0;
          const rDone    = rem.filter((r:any)=>r.status==='done').length;
          const rOverdue = rem.filter((r:any)=>r.status==='pending'&&r.due_date<today).length;
          const kpiScores = calcTeamKPI(tix, rem, lc, weekFilled, 6, actLogs, today);
          return {
            teamName: name,
            ticketTotal: tix.length,
            ticketSolved: tSolved.length,
            ticketOpen: tix.filter((t:any)=>!['Solved','Cancelled'].includes(t.status)).length,
            ticketAvgResolution: avgRes,
            reminderTotal: rem.length,
            reminderDone: rDone,
            reminderPending: rem.filter((r:any)=>r.status==='pending').length,
            reminderOverdue: rOverdue,
            reminderCompletionRate: rem.length > 0 ? rDone/rem.length : 1,
            memberCount: members.length,
            members,
            kpiScores,
            totalKPI: kpiScores.reduce((s,k)=>s+k.nilai,0),
          };
        };

        teamKPI = {
          ivp:  buildTeamKPI('PTS IVP',  ivpTickets,  ivpReminders,  ivpLC,  ivpMembers),
          mlds: buildTeamKPI('PTS MLDS', mldsTickets, mldsReminders, mldsLC, mldsMembers),
        };
      }

      setKpi({
        tickets:{ total:tickets.length,open,solved,waitingApproval,byHandler,byStatus,byDivision,resolvedToday,avgResolutionDays },
        reminders:{ total:reminders.length,pending:reminders.filter((r:any)=>r.status==='pending').length,done:remDone,dueSoon,byCategory,overdueCount,completionRate },
        piket:{ todayIVP:piketToday?.pic_ivp_name??null,todayUMP:piketToday?.pic_ump_name??null,todayMlds:piketToday?.pic_mlds_name??null,weekFilled,weekTotal:6,kegiatanToday:kegiatan.length },
        units:{ totalLogs:movements.length,keluarThisMonth:movements.filter((m:any)=>m.status_barang==='Keluar').length,masukThisMonth:movements.filter((m:any)=>m.status_barang==='Masuk').length },
        users:{ total:users.length,byRole:Object.entries(roleMap).map(([role,count])=>({role,count})) },
        learning:{ totalSessions:lcSessions.length, completedSessions:lcCompleted, totalParticipants:lcParticipants, avgScore:lcAvgScore },
        teamKPI,
      });
    } catch(e){ console.error('KPI fetch error:',e); }
    finally { setLoading(false); }
  }, [scope, scopeReady, selectedYear]);

  // ── 3. Fetch Audit (scope-aware) ──────────────────────────────────────────
  // BUG FIX: sebelumnya reminder diambil order by created_at, padahal yg diupdate
  // tidak otomatis update updated_at dari DB. Sekarang order by updated_at dan
  // juga ambil limit lebih besar agar update terbaru (29 Mei) muncul.

  const fetchAudit = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') { setAuditLoading(false); return; }
    setAuditLoading(true);
    try {
      const ticketQ = (() => {
        let q = supabase.from('tickets').select('id,project_name,status,assign_name,created_by,created_at,date').order('created_at',{ascending:false}).limit(40);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('assign_name',scope.ptsMemberNames);
        if (scope.kind==='sales_sup') {
          const f=[...(scope.salesDivisions??[]).map(d=>`sales_division.eq.${d}`), ...(scope.salesSubNames??[]).map(n=>`sales_name.eq.${n}`), ...(scope.salesSubNames??[]).map(n=>`created_by.eq.${n}`)].join(',');
          if(f) q=q.or(f);
        }
        return q;
      })();
      const actQ = (() => {
        let q = supabase.from('activity_logs').select('id,ticket_id,handler_name,action_taken,new_status,notes,created_at').order('created_at',{ascending:false}).limit(80);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('handler_name',scope.ptsMemberNames);
        return q;
      })();

      // FIX: order by updated_at DESC (bukan created_at) supaya entry yang di-update
      // terbaru (mis. 29 Mei) muncul di atas, dan limit 100 supaya tidak terpotong.
      const reminderQ = (() => {
        let q = supabase.from('reminders')
          .select('id,project_name,category,status,assign_name,created_by,created_at,updated_at')
          .order('updated_at',{ascending:false})
          .limit(100);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('assign_name',scope.ptsMemberNames);
        if (scope.kind==='sales_sup') {
          const f=[...(scope.salesDivisions??[]).map(d=>`sales_division.eq.${d}`), ...(scope.salesSubNames??[]).map(n=>`sales_name.eq.${n}`)].join(',');
          if(f) q=q.or(f);
        }
        return q;
      })();

      const [ticketsRes, actLogsRes, remindersRes, usersRes, movRes] = await Promise.all([
        ticketQ, actQ, reminderQ,
        scope.kind==='admin' ? supabase.from('users').select('id,full_name,role,created_at').order('created_at',{ascending:false}).limit(20) : Promise.resolve({data:[]}),
        (scope.kind==='admin'||scope.kind==='pts_sup') ? supabase.from('movement_logs').select('id,nama_pts,event,status_barang,project_name,created_at,created_by').order('created_at',{ascending:false}).limit(20) : Promise.resolve({data:[]}),
      ]);

      const entries: AuditEntry[] = [];

      (ticketsRes.data??[]).forEach((t:any)=>{
        entries.push({ id:`ticket-${t.id}`,module:'Ticketing',icon:'🎫', actor:t.created_by??'Unknown', action:'Ticket dibuat', target:t.project_name??'-', detail:`Status: ${t.status}${t.assign_name?` · Handler: ${t.assign_name}`:''}`, ts:t.created_at, severity:t.status==='Waiting Approval'?'warn':'info' });
      });
      (actLogsRes.data??[]).forEach((a:any)=>{
        const isCrit=['Solved','Overdue'].includes(a.new_status), isWarn=['Waiting Approval','Warranty','Out Of Warranty'].includes(a.new_status);
        entries.push({ id:`act-${a.id}`,module:'Ticketing',icon:isCrit?'✅':'🔄', actor:a.handler_name??'System', action:`Status → ${a.new_status}`, target:a.action_taken??'', detail:a.notes??'', ts:a.created_at, severity:isCrit?'critical':isWarn?'warn':'info' });
      });

      // FIX: gunakan updated_at sebagai timestamp audit (bukan created_at) agar
      // perubahan status/data yang di-update pada 29 Mei muncul dengan tanggal benar.
      (remindersRes.data??[]).forEach((r:any)=>{
        // Tampilkan baik reminder baru maupun yang di-update
        const ts = r.updated_at ?? r.created_at;
        const isUpdate = r.updated_at && r.updated_at !== r.created_at;
        const actionLabel = r.status==='done'
          ? 'Reminder selesai (Done)'
          : r.status==='cancelled'
          ? 'Reminder dibatalkan'
          : isUpdate
          ? 'Reminder diperbarui'
          : 'Reminder dibuat';
        entries.push({
          id:`rem-${r.id}`,
          module:'Reminder',
          icon: r.status==='done' ? '✅' : r.status==='cancelled' ? '❌' : isUpdate ? '✏️' : '🗓️',
          actor: r.created_by??'Unknown',
          action: actionLabel,
          target: r.project_name??'-',
          detail: `${r.category}${r.assign_name?` · ${r.assign_name}`:''}`,
          ts,
          severity: r.status==='done' ? 'info' : isUpdate ? 'warn' : 'info',
        });
      });

      (usersRes.data??[]).forEach((u:any)=>{
        entries.push({ id:`usr-${u.id}`,module:'User',icon:'👤', actor:'Admin', action:'User ditambahkan', target:u.full_name, detail:`Role: ${u.role}`, ts:u.created_at, severity:'info' });
      });
      (movRes.data??[]).forEach((m:any)=>{
        entries.push({ id:`mov-${m.id}`,module:'Unit Movement',icon:'🚚', actor:m.created_by??m.nama_pts??'Unknown', action:`Unit ${m.status_barang}`, target:m.project_name??m.event??'-', detail:m.event??'', ts:m.created_at, severity:'info' });
      });

      entries.sort((a,b)=>new Date(b.ts).getTime()-new Date(a.ts).getTime());
      setAudit(entries);
    } catch(e){ console.error('Audit error:',e); }
    finally { setAuditLoading(false); }
  }, [scope, scopeReady]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!scopeReady) return;
    fetchKPI(); fetchAudit();
    intervalRef.current = setInterval(() => { fetchKPI(); fetchAudit(); setLastRefresh(new Date()); }, 3*60*1000);
    return () => { if(intervalRef.current) clearInterval(intervalRef.current); };
  }, [scopeReady, fetchKPI, fetchAudit]);

  // Refetch KPI ketika tahun berubah
  useEffect(() => {
    if (!scopeReady) return;
    fetchKPI();
  }, [selectedYear, scopeReady, fetchKPI]);

  // ── Filtered Audit ────────────────────────────────────────────────────────

  const filteredAudit = audit.filter(a => {
    const matchFilter = auditFilter==='all'
      ||(auditFilter==='ticket'&&a.module==='Ticketing')
      ||(auditFilter==='reminder'&&a.module==='Reminder')
      ||(auditFilter==='piket'&&a.module==='Piket')
      ||(auditFilter==='user'&&a.module==='User');
    const q=auditSearch.toLowerCase();
    const matchSearch = !q||a.actor.toLowerCase().includes(q)||a.action.toLowerCase().includes(q)||a.target.toLowerCase().includes(q)||a.module.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  const isPTSIVP  = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS';
  const isPTSUMP  = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS UMP';
  const isPTSMLDS = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS MLDS';

  const TABS = [
    {key:'kpi',icon:'📊',label:'KPI Live'},
    {key:'analytics',icon:'📈',label:'Analytics'},
    {key:'audit',icon:'🔍',label:'Audit Trail'},
  ] as const;

  const title = scope.kind==='admin'
    ? 'Dashboard Monitoring — Semua Team'
    : scope.kind==='pts_sup' ? `Summary ${scope.ptsTeamType}`
    : scope.kind==='sales_sup' ? `Summary Divisi Anda`
    : 'Dashboard KPI';

  return (
    <div className="min-h-screen" style={{ background:'linear-gradient(135deg,#fdf2f8 0%,#fce7f3 40%,#ede9fe 100%)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-white/60 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-tight">{title}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <ScopeBadge scope={scope}/>
                <span className="text-[11px] text-slate-400">
                  Refresh: {lastRefresh.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* ── Filter Tahun ── */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-sm">📅</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* ── Download KPI Excel (admin only) ── */}
              {scope.kind==='admin' && kpi?.teamKPI && (
                <button
                  onClick={() => exportKPIExcel(kpi.teamKPI!, selectedYear)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
                >
                  <span>⬇️</span> Download KPI Excel {selectedYear}
                </button>
              )}

              <button onClick={()=>{ setLoading(true); setAuditLoading(true); fetchKPI(); fetchAudit(); setLastRefresh(new Date()); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all">
                <span>🔄</span> Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-slate-100/70 rounded-xl p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${tab===t.key?'bg-white shadow text-slate-800':'text-slate-500 hover:text-slate-700'}`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">

          {/* ══════════ TAB KPI ══════════ */}
          {tab==='kpi' && (
            <div className="space-y-8">

              {/* ── Piket Showroom Today ── */}
              <div>
                <SectionPill icon="🏪">Piket Showroom — {dayOfWeek()}, {new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</SectionPill>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {team:'IVP',  person:kpi?.piket.todayIVP,  color:'#ef4444', gradient:'from-red-500/90 to-rose-600/90',    highlight:isPTSIVP||scope.kind==='admin'},
                    {team:'UMP',  person:kpi?.piket.todayUMP,  color:'#f59e0b', gradient:'from-amber-500/90 to-orange-500/90', highlight:isPTSUMP||scope.kind==='admin'},
                    {team:'MLDS', person:kpi?.piket.todayMlds, color:'#3b82f6', gradient:'from-blue-500/90 to-indigo-500/90',  highlight:isPTSMLDS||scope.kind==='admin'},
                  ].map(p=>(
                    <div key={p.team}
                      className={`bg-white/90 rounded-2xl border ${p.highlight?'border-slate-300 shadow-md':'border-slate-200 shadow-sm'} p-4 flex items-center gap-3 transition-all`}>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center font-black text-sm text-white flex-shrink-0 shadow`}>
                        {p.team}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">PIC {p.team} Hari Ini</div>
                        {loading
                          ? <div className="h-4 w-24 rounded animate-pulse bg-slate-100"/>
                          : p.person
                            ? <div className="text-sm font-bold text-slate-800 truncate">{p.person}</div>
                            : <div className="text-xs italic text-slate-300">Belum diisi</div>}
                        {!loading&&p.person&&(
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full mt-1 inline-block">● Bertugas</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!loading&&kpi&&(
                  <div className="mt-3 flex items-center gap-6 px-1 flex-wrap">
                    <span className="text-[11px] text-slate-500">Minggu ini: <span className="font-bold text-slate-700">{kpi.piket.weekFilled}/{kpi.piket.weekTotal} hari</span> terisi</span>
                    <span className="text-[11px] text-slate-500">Tamu hari ini: <span className="font-bold text-slate-700">{kpi.piket.kegiatanToday}</span></span>
                    <div className="flex items-center gap-2">
                      <DonutChart size={24} strokeWidth={5}
                        segments={[{value:kpi.piket.weekFilled,color:'#10b981'},{value:Math.max(kpi.piket.weekTotal-kpi.piket.weekFilled,0),color:'#e2e8f0'}]}
                        label=""/>
                      <span className="text-[10px] text-slate-400">{Math.round((kpi.piket.weekFilled/Math.max(kpi.piket.weekTotal,1))*100)}% terpenuhi</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── KPI Per Team (admin only) ── */}
              {scope.kind==='admin' && (
                <div>
                  <SectionPill icon="🏆">KPI Per Team — {selectedYear}</SectionPill>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {kpi?.teamKPI ? (
                      <>
                        <TeamKPICard teamKPI={kpi.teamKPI.ivp}  loading={loading}/>
                        <TeamKPICard teamKPI={kpi.teamKPI.mlds} loading={loading}/>
                      </>
                    ) : (
                      <>
                        <div className="h-48 rounded-2xl animate-pulse bg-slate-100"/>
                        <div className="h-48 rounded-2xl animate-pulse bg-slate-100"/>
                      </>
                    )}
                  </div>
                  {/* Comparison bar */}
                  {!loading && kpi?.teamKPI && (
                    <div className="mt-4 bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Perbandingan Skor KPI</div>
                      {['PTS IVP','PTS MLDS'].map((name, i) => {
                        const t = i===0 ? kpi.teamKPI!.ivp : kpi.teamKPI!.mlds;
                        const score = t.kpiScores.reduce((s,k)=>s+k.nilai,0);
                        const pct = Math.round(score*100);
                        const color = pct>=90?'#10b981':pct>=75?'#f59e0b':'#ef4444';
                        return (
                          <div key={name} className="flex items-center gap-3 mb-2">
                            <span className="text-[11px] font-bold text-slate-600 w-20 flex-shrink-0">{name}</span>
                            <div className="flex-1 h-5 rounded-full overflow-hidden bg-slate-100">
                              <div className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                                style={{ width:`${pct}%`, background:color }}>
                                <span className="text-[10px] font-black text-white">{pct}%</span>
                              </div>
                            </div>
                            <span className="text-[11px] font-black w-14 text-right" style={{ color }}>{score.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Ticket Troubleshooting ── */}
              <div>
                <SectionPill icon="🎫">Ticket Troubleshooting — {scope.kind==='pts_sup'?scope.ptsTeamType:scope.kind==='sales_sup'?'Divisi Anda':'Semua'} ({selectedYear})</SectionPill>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                  {[
                    {icon:'🎫', label:'Total Ticket',      value:kpi?.tickets.total??0,            sub:'Periode ini',         color:'#64748b', grad:'from-slate-500/90 to-slate-600/90'},
                    {icon:'🔥', label:'Open / Aktif',      value:kpi?.tickets.open??0,             sub:'Belum selesai',       color:'#ef4444', grad:'from-red-500/90 to-rose-600/90'},
                    {icon:'⏳', label:'Waiting Approval',  value:kpi?.tickets.waitingApproval??0,  sub:'Perlu tindakan',      color:'#f59e0b', grad:'from-amber-400/90 to-orange-500/90'},
                    {icon:'✅', label:'Solved Total',       value:kpi?.tickets.solved??0,           sub:`Avg ${kpi?.tickets.avgResolutionDays??0} hari`,color:'#10b981',grad:'from-emerald-500/90 to-green-600/90'},
                    {icon:'⚡', label:'Solved Hari Ini',   value:kpi?.tickets.resolvedToday??0,    sub:'Diselesaikan hari ini',color:'#0891b2', grad:'from-cyan-500/90 to-sky-600/90'},
                  ].map(c=>(
                    <div key={c.label} className={`bg-gradient-to-br ${c.grad} rounded-2xl p-4 text-white shadow-lg`}>
                      <div className="text-2xl mb-1">{c.icon}</div>
                      {loading ? <div className="h-7 w-10 rounded animate-pulse bg-white/30 mb-1"/> :
                        <div className="text-2xl font-black">{c.value}</div>}
                      <div className="text-white/80 text-xs font-medium leading-tight mt-0.5">{c.label}</div>
                      <div className="text-white/60 text-[10px] mt-0.5">{c.sub}</div>
                    </div>
                  ))}
                </div>
                {!loading&&kpi&&kpi.tickets.byStatus.length>0&&(
                  <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-5 flex-wrap">
                      <div className="flex items-center gap-3">
                        <DonutChart
                          segments={kpi.tickets.byStatus.map(s=>({value:s.count,color:s.color}))}
                          size={52} strokeWidth={8} label={`${kpi.tickets.total}`}/>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Distribusi<br/>Status</div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 flex-1">
                        {kpi.tickets.byStatus.map(s=>(
                          <div key={s.status} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:s.color }}/>
                            <span className="text-[10px] text-slate-500">{s.status}</span>
                            <span className="text-[10px] font-bold text-slate-700">{s.count}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-slate-400">Avg Resolusi</div>
                        <div className="text-lg font-black text-rose-600">{kpi.tickets.avgResolutionDays}<span className="text-xs font-normal text-slate-400 ml-0.5">hari</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Reminder Schedule ── */}
              <div>
                <SectionPill icon="📅">Reminder Schedule ({selectedYear})</SectionPill>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                  {[
                    {icon:'📅', label:'Total Reminder',   value:kpi?.reminders.total??0,         sub:'Periode ini',      color:'#6366f1', grad:'from-indigo-500/90 to-violet-600/90'},
                    {icon:'🟡', label:'Pending',           value:kpi?.reminders.pending??0,       sub:'Belum selesai',    color:'#f59e0b', grad:'from-amber-400/90 to-yellow-500/90'},
                    {icon:'🔴', label:'Overdue',           value:kpi?.reminders.overdueCount??0,  sub:'Terlewat deadline', color:'#ef4444', grad:'from-red-500/90 to-rose-600/90'},
                    {icon:'🔔', label:'Due 7 Hari',        value:kpi?.reminders.dueSoon??0,       sub:'Perlu perhatian',  color:'#0891b2', grad:'from-sky-500/90 to-cyan-600/90'},
                    {icon:'🟢', label:'Selesai (Done)',    value:kpi?.reminders.done??0,          sub:'Sudah dikerjakan', color:'#10b981', grad:'from-emerald-500/90 to-green-600/90'},
                  ].map(c=>(
                    <div key={c.label} className={`bg-gradient-to-br ${c.grad} rounded-2xl p-4 text-white shadow-lg`}>
                      <div className="text-2xl mb-1">{c.icon}</div>
                      {loading ? <div className="h-7 w-10 rounded animate-pulse bg-white/30 mb-1"/> :
                        <div className="text-2xl font-black">{c.value}</div>}
                      <div className="text-white/80 text-xs font-medium leading-tight mt-0.5">{c.label}</div>
                      <div className="text-white/60 text-[10px] mt-0.5">{c.sub}</div>
                    </div>
                  ))}
                </div>
                {!loading&&kpi&&(
                  <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-start gap-5">
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <DonutChart
                          segments={[
                            {value:kpi.reminders.done, color:'#10b981'},
                            {value:kpi.reminders.overdueCount, color:'#ef4444'},
                            {value:Math.max(kpi.reminders.pending-kpi.reminders.overdueCount,0), color:'#f59e0b'},
                          ]}
                          size={64} strokeWidth={9} label={`${Math.round(kpi.reminders.completionRate*100)}%`}/>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Completion</span>
                      </div>
                      <div className="flex-1">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-2">
                          {kpi.reminders.byCategory.map(c=>(
                            <div key={c.cat} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:c.color }}/>
                              <span className="text-[10px] text-slate-500 flex-1 truncate">{c.cat}</span>
                              <span className="text-[10px] font-bold text-slate-700">{c.count}</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Completion rate: <span className="font-bold text-emerald-600">{Math.round(kpi.reminders.completionRate*100)}%</span>
                          {kpi.reminders.overdueCount > 0 && <span className="ml-2 text-red-500 font-bold">⚠️ {kpi.reminders.overdueCount} overdue</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Unit Movement + Users (admin) ── */}
              {scope.kind==='admin'&&(
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <SectionPill icon="🚚">Unit Movement — Bulan Ini</SectionPill>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {icon:'📦',label:'Total Log',value:kpi?.units.totalLogs??0,  grad:'from-slate-500/90 to-slate-600/90'},
                        {icon:'📤',label:'Keluar',   value:kpi?.units.keluarThisMonth??0, grad:'from-amber-400/90 to-orange-500/90'},
                        {icon:'📥',label:'Masuk',    value:kpi?.units.masukThisMonth??0,  grad:'from-emerald-500/90 to-green-600/90'},
                      ].map(c=>(
                        <div key={c.label} className={`bg-gradient-to-br ${c.grad} rounded-2xl p-4 text-white shadow-lg`}>
                          <div className="text-xl mb-1">{c.icon}</div>
                          {loading?<div className="h-7 w-10 rounded animate-pulse bg-white/30 mb-1"/>:
                            <div className="text-2xl font-black">{c.value}</div>}
                          <div className="text-white/80 text-xs font-medium mt-0.5">{c.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <SectionPill icon="👥">Pengguna Platform</SectionPill>
                    <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                      {loading
                        ? <div className="h-16 rounded animate-pulse bg-slate-100"/>
                        : (
                          <div className="flex items-center gap-5">
                            <DonutChart
                              segments={(kpi?.users.byRole??[]).map((r,i)=>({
                                value:r.count,
                                color:['#6366f1','#10b981','#f59e0b','#ef4444','#0891b2'][i%5]
                              }))}
                              size={64} strokeWidth={9} label={`${kpi?.users.total??0}`}/>
                            <div>
                              <div className="text-3xl font-black text-slate-800 leading-none">{kpi?.users.total??0}</div>
                              <div className="text-xs text-slate-400 mb-2">total pengguna</div>
                              <div className="flex flex-wrap gap-1.5">
                                {(kpi?.users.byRole??[]).map((r,i)=>(
                                  <span key={r.role} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background:['#6366f115','#10b98115','#f59e0b15','#ef444415','#0891b215'][i%5], color:['#6366f1','#10b981','#d97706','#ef4444','#0891b2'][i%5] }}>
                                    {r.role.toUpperCase()} {r.count}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Unit Movement (PTS supervisor) ── */}
              {scope.kind==='pts_sup'&&(
                <div>
                  <SectionPill icon="🚚">Unit Movement — {scope.ptsTeamType}</SectionPill>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {icon:'📦',label:'Total Log',value:kpi?.units.totalLogs??0,  grad:'from-slate-500/90 to-slate-600/90'},
                      {icon:'📤',label:'Keluar',   value:kpi?.units.keluarThisMonth??0, grad:'from-amber-400/90 to-orange-500/90'},
                      {icon:'📥',label:'Masuk',    value:kpi?.units.masukThisMonth??0,  grad:'from-emerald-500/90 to-green-600/90'},
                    ].map(c=>(
                      <div key={c.label} className={`bg-gradient-to-br ${c.grad} rounded-2xl p-4 text-white shadow-lg`}>
                        <div className="text-xl mb-1">{c.icon}</div>
                        {loading?<div className="h-7 w-10 rounded animate-pulse bg-white/30 mb-1"/>:
                          <div className="text-2xl font-black">{c.value}</div>}
                        <div className="text-white/80 text-xs font-medium mt-0.5">{c.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Learning Center (admin) ── */}
              {scope.kind==='admin'&&(
                <div>
                  <SectionPill icon="🎓">Learning Center</SectionPill>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      {icon:'🎯',label:'Total Sesi Quiz',  value:kpi?.learning.totalSessions??0,    sub:'Semua sesi',         grad:'from-indigo-500/90 to-violet-600/90'},
                      {icon:'✅',label:'Sesi Selesai',      value:kpi?.learning.completedSessions??0, sub:'Status completed',   grad:'from-emerald-500/90 to-green-600/90'},
                      {icon:'👥',label:'Peserta Unik',      value:kpi?.learning.totalParticipants??0, sub:'User berbeda',       grad:'from-sky-500/90 to-cyan-600/90'},
                      {icon:'⭐',label:'Rata-rata Skor',    value:`${kpi?.learning.avgScore??0}`,     sub:'Dari sesi berhasil', grad:'from-amber-400/90 to-orange-500/90'},
                    ].map(c=>(
                      <div key={c.label} className={`bg-gradient-to-br ${c.grad} rounded-2xl p-5 text-white shadow-lg`}>
                        <div className="text-3xl mb-2">{c.icon}</div>
                        {loading?<div className="h-7 w-12 rounded animate-pulse bg-white/30 mb-1"/>:
                          <div className="text-3xl font-black">{c.value}</div>}
                        <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
                        <div className="text-white/60 text-[10px] mt-0.5">{c.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ══════════ TAB ANALYTICS ══════════ */}
          {tab==='analytics'&&(
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🎫 Ticket Open per Handler</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byHandler.length
                      ? <HBarChart data={kpi.tickets.byHandler.map(h=>({label:h.name.split(' ')[0],value:h.count}))} color="#ef4444"/>
                      : <p className="text-xs text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🏢 Ticket per Divisi</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byDivision.length
                      ? <HBarChart data={kpi.tickets.byDivision.map(d=>({label:d.div,value:d.count}))} color="#6366f1"/>
                      : <p className="text-xs text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">📊 Distribusi Status Ticket</h3>
                  {loading?<div className="h-20 rounded animate-pulse bg-slate-100"/>:(
                    <div className="flex items-center gap-5 flex-wrap">
                      <DonutChart size={72} strokeWidth={10}
                        segments={(kpi?.tickets.byStatus??[]).map(s=>({value:s.count,color:s.color}))}
                        label={`${kpi?.tickets.total??0}`}/>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 flex-1">
                        {(kpi?.tickets.byStatus??[]).map(s=>(
                          <div key={s.status} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:s.color }}/>
                            <span className="text-[11px] text-slate-500">{s.status}</span>
                            <span className="text-[11px] font-bold text-slate-700">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🗂️ Reminder per Kategori</h3>
                  {loading?<div className="h-20 rounded animate-pulse bg-slate-100"/>:(
                    <div className="flex items-center gap-5">
                      <DonutChart size={64} strokeWidth={9}
                        segments={(kpi?.reminders.byCategory??[]).map(c=>({value:c.count,color:c.color}))}
                        label={`${kpi?.reminders.total??0}`}/>
                      <div className="space-y-1.5 flex-1">
                        {(kpi?.reminders.byCategory??[]).map(c=>(
                          <div key={c.cat} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:c.color }}/>
                            <span className="text-[10px] flex-1 truncate text-slate-500">{c.cat}</span>
                            <span className="text-[10px] font-bold text-slate-700">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">⚡ Ringkasan Performa</h3>
                {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:(
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      {label:'Avg. Resolusi Ticket',value:`${kpi?.tickets.avgResolutionDays??0} hari`,color:'#ef4444',icon:'⏱️'},
                      {label:'Solved Hari Ini',value:`${kpi?.tickets.resolvedToday??0} ticket`,color:'#10b981',icon:'✅'},
                      {label:'Reminder Overdue',value:`${kpi?.reminders.overdueCount??0} jadwal`,color:'#f59e0b',icon:'🔴'},
                      {label:'Completion Rate Reminder',value:`${Math.round((kpi?.reminders.completionRate??0)*100)}%`,color:'#6366f1',icon:'📊'},
                      {label:'Piket Terisi Minggu Ini',value:`${kpi?.piket.weekFilled??0}/${kpi?.piket.weekTotal??6} hari`,color:'#0891b2',icon:'🏪'},
                      ...(scope.kind==='admin'?[{label:'LC Avg. Skor',value:`${kpi?.learning.avgScore??0} poin`,color:'#8b5cf6',icon:'🎓'}]:[]),
                    ].map(m=>(
                      <div key={m.label} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <span className="text-xl">{m.icon}</span>
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</div>
                          <div className="text-sm font-black" style={{ color:m.color }}>{m.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ TAB AUDIT TRAIL ══════════ */}
          {tab==='audit'&&(
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}
                    placeholder="Cari actor, aksi, target..."
                    className="w-full rounded-lg pl-8 pr-3 py-2 text-xs outline-none bg-slate-50 border border-slate-200 text-slate-700 focus:border-blue-300"/>
                </div>
                {(['all','ticket','reminder','piket','user'] as const).map(f=>(
                  <button key={f} onClick={()=>setAuditFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all border ${auditFilter===f ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white/90 text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    {f==='all'?'SEMUA':f.toUpperCase()}
                  </button>
                ))}
                <span className="text-[10px] ml-auto tracking-widest text-slate-400">{filteredAudit.length} ENTRI</span>
              </div>

              {/* Info box reminder audit fix */}
              {auditFilter==='reminder' && filteredAudit.length === 0 && !auditLoading && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
                  <b>💡 Tips:</b> Jika reminder tidak muncul, pastikan kolom <code>updated_at</code> di tabel <code>reminders</code> di Supabase sudah diisi (trigger <code>moddatetime</code> harus aktif). Lihat panduan perbaikan di bawah.
                </div>
              )}

              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1"
                style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(0,0,0,0.1) transparent' }}>
                {auditLoading
                  ? Array.from({length:6}).map((_,i)=>(
                      <div key={i} className="h-12 rounded-lg animate-pulse bg-slate-100"/>
                    ))
                  : filteredAudit.length===0
                    ? <div className="text-center py-12 text-xs tracking-widest text-slate-300">TIDAK ADA DATA</div>
                    : filteredAudit.map((entry:AuditEntry,idx:number)=>(
                        <div key={entry.id??idx}><AuditRow entry={entry}/></div>
                      ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
