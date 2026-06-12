'use client';
import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { User } from '@/app/dashboard/_components/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIData {
  tickets: {
    total: number; open: number; solved: number; waitingApproval: number;
    byHandler: { name: string; count: number }[];
    byStatus: { status: string; count: number; color: string }[];
    byDivision: { div: string; count: number }[];
    byProduct: { product: string; count: number }[];
    resolvedToday: number; avgResolutionDays: number;
    monthlyTickets: number[];
  };
  reminders: {
    total: number; pending: number; done: number; dueSoon: number;
    byCategory: { cat: string; count: number; color: string }[];
    byProduct: { product: string; byCategory: { cat: string; count: number }[] }[];
    overdueCount: number;
  };
  piket: {
    todayIVP: string | null; todayUMP: string | null; todayMlds: string | null;
    weekFilled: number; weekTotal: number; kegiatanToday: number;
  };
  units: { totalLogs: number; keluarThisMonth: number; masukThisMonth: number };
  users: { total: number; byRole: { role: string; count: number }[] };
  learning: { totalSessions: number; completedSessions: number; totalParticipants: number; avgScore: number };
}

interface KPITeamMember {
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
  lcFailedBelow75: number;   // LC: jumlah attempt score < 75 (hardcode, untuk backward compat)
  lcScores: number[];        // semua score mentah — untuk recompute dengan lcMinScore dinamis
  piketFilled: number;
  ticketAvgResponseHours: number;
  formReviewLowRating: number;
  formReviewTotal: number;     // total form review submitted by sales
  // Monthly sparkline data (12 bulan)
  monthlyTickets: number[];
  monthlyLC: number[];
  // Auto dari Tech Note platform
  techNotesApproved: number;     // RnD - jumlah tech note approved (target 2/thn, otomatis)
  // Manual input (KPI yg tidak bisa diambil otomatis)
  manual: {
    komplainCount: number;        // Technical knowledge - jumlah komplain (max 12)
    responTime: number;           // Kecepatan respon komplain (1=OK, 0=Tidak OK)
    bastDemo: number;             // BAST & Demo - jumlah form selesai dalam 7 hari
    bastDemoTotal: number;        // Total BAST & Demo yang ada
    reportBulanan: number;        // Pelaporan bulanan tepat waktu (0-12)
    learningMastery: number;      // Penguasaan teknikal (0-12 kategori)
  };
}

interface KPITeamState {
  members: KPITeamMember[];
  loading: boolean;
  editingMember: string | null;  // member id yang sedang diedit
  editValues: Partial<KPITeamMember['manual']>;
  filterYear: number;
  filterPeriod: '6m' | '1y';   // 6 bulan atau 1 tahun
  filterStartMonth: number;     // 1–12: bulan mulai periode (sumber kebenaran utama)
  filterTeam: string;
}

interface KPISettings {
  lcMinScore: number;       // batas minimum LC (default 70)
  rndTarget: number;        // target tech note per tahun (default 2)
  ticketOverdueWeight: number; // bobot ticketing (default 0.20)
  bastWeight: number;       // bobot BAST (default 0.40)
  lcWeight: number;         // bobot LC (default 0.30)
  rndWeight: number;        // bobot RnD (default 0.10)
}

interface KPIPeriodSnapshot {
  id: string;
  period_label: string;       // e.g. "Jan–Jun 2025" atau "Jan–Des 2025"
  year: number;
  period: '6m' | '1y';
  start_month: number;        // 1-12 (bulan mulai)
  end_month: number;          // 1-12 (bulan akhir, otomatis)
  team_type: string;          // scope: "all" | "Team PTS" | "Team PTS MLDS"
  created_at: string;
  created_by: string;
  members_json: {
    id: string; name: string; jabatan: string; team_type: string;
    ticketsHandled: number; ticketsSolved: number; ticketsOverdue: number;
    lcAttempts: number; lcAvgScore: number; lcPassed: number;
    formReviewTotal: number; formReviewLowRating: number;
    techNotesApproved: number;
    tickScore: number; bastScore: number; lcScore: number; rndScore: number;
    finalKPI: number;
  }[];
  settings_json?: {
    lcMinScore: number; rndTarget: number;
    ticketOverdueWeight: number; bastWeight: number; lcWeight: number; rndWeight: number;
  } | null;
}

interface AuditEntry {
  id: string; module: string; actor: string; action: string;
  target: string; detail: string; ts: string;
  severity: 'info' | 'warn' | 'critical'; icon: string;
}

interface Scope {
  kind: 'admin' | 'pts_sup' | 'team' | 'none';
  // pts_sup
  ptsTeamType?: string;
  ptsMemberNames?: string[];
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr   = () => new Date().toISOString().split('T')[0];
const dayOfWeek  = () => ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
function getMonday() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniDonut({ segments, size = 72 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={size/2-5} fill="none" stroke="#e2e8f0" strokeWidth={9}/></svg>;
  const r = size/2-6, circ = 2*Math.PI*r; let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8ecf0" strokeWidth={9}/>
      {segments.map((seg,i) => { const pct=seg.value/total, dash=pct*circ, gap=circ-dash;
        const el=<circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={9} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-off*circ} strokeLinecap="butt"/>;
        off+=pct; return el; })}
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
      style={{ background:'rgba(255,255,255,0.93)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
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

function SectionHeader({ icon, title, sub, right }: { icon:string; title:string; sub?:string; right?:ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background:'rgba(190,18,60,0.1)', border:'1px solid rgba(190,18,60,0.15)' }}>{icon}</div>
        <div>
          <h2 className="text-base font-bold tracking-wide" style={{ color:'rgba(0,0,0,0.75)' }}>{title}</h2>
          {sub && <p className="text-sm" style={{ color:'rgba(0,0,0,0.4)' }}>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function HBarChart({ data, color, maxItems=6 }: { data:{label:string;value:number}[]; color:string; maxItems?:number }) {
  const top = data.slice(0, maxItems), max = Math.max(...top.map(d=>d.value), 1);
  return (
    <div className="space-y-1.5">
      {top.map((d,i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] flex-shrink-0 text-right" style={{ color:'rgba(0,0,0,0.55)', width:'7rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
          <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background:'rgba(0,0,0,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${(d.value/max)*100}%`, background:color, opacity:0.85-i*0.07 }}/>
          </div>
          <span className="text-[11px] font-bold w-5 text-right flex-shrink-0" style={{ color:'rgba(0,0,0,0.6)' }}>{d.value}</span>
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
          <span className="text-sm font-bold truncate" style={{ color:'rgba(0,0,0,0.75)' }}>{entry.action}</span>
          <span className="text-sm flex-shrink-0" style={{ color:'rgba(0,0,0,0.35)' }}>{fmt}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-sm font-semibold px-1.5 py-0.5 rounded-full" style={{ background:`${s.dot}18`, color:s.text }}>{entry.module}</span>
          <span className="text-sm" style={{ color:'rgba(0,0,0,0.4)' }}>by <b style={{ color:'rgba(0,0,0,0.6)' }}>{entry.actor}</b></span>
          {entry.target && <span className="text-sm truncate max-w-[180px]" style={{ color:'rgba(0,0,0,0.35)' }}>→ {entry.target}</span>}
        </div>
        {entry.detail && <p className="text-[11px] mt-0.5 truncate" style={{ color:'rgba(0,0,0,0.3)' }}>{entry.detail}</p>}
      </div>
    </div>
  );
}

// ── Scope badge ──
function ScopeBadge({ scope }: { scope: Scope }) {
  const cfg = {
    admin:     { label: 'Semua Data',         color: '#be123c', icon: '👑' },
    pts_sup:   { label: scope.ptsTeamType ?? 'PTS Supervisor', color: '#0891b2', icon: '🏪' },
    team:      { label: 'Team Member',        color: '#7c3aed', icon: '👤' },
    none:      { label: '-',                  color: '#6b7280', icon: '—'  },
  }[scope.kind];
  return (
    <span className="flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full"
      style={{ background:`${cfg.color}18`, color:cfg.color, border:`1px solid ${cfg.color}30` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DashboardKPIProps { currentUser: User; }

export default function DashboardKPI({ currentUser }: DashboardKPIProps) {
  const [scope, setScope]           = useState<Scope>({ kind: 'none' });
  const [scopeReady, setScopeReady] = useState(false);
  const [kpi, setKpi]               = useState<KPIData | null>(null);
  const [audit, setAudit]           = useState<AuditEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [tab, setTab]               = useState<'analytics'>('analytics');
  const [auditFilter, setAuditFilter] = useState<'all'|'ticket'|'reminder'|'piket'|'user'>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [kpiTeam, setKpiTeam] = useState<KPITeamState>({
    members: [],
    loading: false,
    editingMember: null,
    editValues: {},
    filterYear: new Date().getFullYear(),
    filterPeriod: '6m',
    filterStartMonth: new Date().getMonth() < 6 ? 1 : 7, // otomatis semester saat ini
    filterTeam: 'all',
  });
  const [showSettings, setShowSettings] = useState(false);
  const DEFAULT_KPI_SETTINGS: KPISettings = {
    lcMinScore: 70, rndTarget: 2,
    ticketOverdueWeight: 0.20, bastWeight: 0.40, lcWeight: 0.30, rndWeight: 0.10,
  };
  const [kpiSettings, setKpiSettings] = useState<KPISettings>(DEFAULT_KPI_SETTINGS);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Load KPI settings from Supabase (fallback: localStorage) ────────────────
  // Table needed in Supabase:
  //   CREATE TABLE kpi_global_settings (
  //     id INT PRIMARY KEY DEFAULT 1,
  //     settings JSONB NOT NULL,
  //     updated_at TIMESTAMPTZ DEFAULT NOW()
  //   );
  useEffect(() => {
    const loadSettings = async () => {
      // 1. Try Supabase first
      try {
        const { data } = await supabase.from('kpi_global_settings').select('settings').eq('id', 1).single();
        if (data?.settings) {
          setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...data.settings });
          return;
        }
      } catch { /* table may not exist yet */ }
      // 2. Fallback to localStorage
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('kpi_global_settings') : null;
        if (stored) setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...JSON.parse(stored) });
      } catch { /* ignore */ }
    };
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveKpiSettings = async (s: KPISettings) => {
    // Always save to localStorage immediately (works without any DB setup)
    try { localStorage.setItem('kpi_global_settings', JSON.stringify(s)); } catch { /* ignore */ }
    // Try to also save to Supabase (requires kpi_global_settings table)
    try {
      await supabase.from('kpi_global_settings').upsert({ id: 1, settings: s, updated_at: new Date().toISOString() });
    } catch { /* table may not exist — localStorage is the fallback */ }
  };

  // ── 1. Resolve scope ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const role   = currentUser.role?.toLowerCase() ?? '';
      const jabatan = currentUser.jabatan ?? '';
      const PTS_TYPES = ['Team PTS','Team PTS UMP','Team PTS MLDS'];

      if (['admin','superadmin'].includes(role)) {
        setScope({ kind: 'admin' }); setScopeReady(true); return;
      }

      // PTS supervisor
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

      // Regular team member — check if they have dashboard access
      if (role === 'team' || role === 'team_pts') {
        const hasDashboard = (currentUser.allowed_menus ?? []).includes('dashboard');
        setScope({ kind: hasDashboard ? 'team' : 'none' }); setScopeReady(true); return;
      }

      setScope({ kind:'none' }); setScopeReady(true);
    })();
  }, [currentUser]);

  // ── 2. Fetch KPI (scope-aware) ────────────────────────────────────────────

  const fetchKPI = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') { setLoading(false); return; }
    setLoading(true);
    try {
      const today     = todayStr();
      const inOneWeek = new Date(); inOneWeek.setDate(inOneWeek.getDate()+7);
      const oneWeekStr = inOneWeek.toISOString().split('T')[0];

      // ── Helpers to build scoped queries ──
      const scopeTickets = (q: any) => {
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length) {
          return q.in('assign_name', scope.ptsMemberNames);
        }
        return q;
      };
      const scopeReminders = (q: any) => {
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length) {
          return q.in('assign_name', scope.ptsMemberNames);
        }
        return q;
      };

      // ── Parallel fetches ──
      const [ticketsRes, actLogsRes, remindersRes, piketTodayRes, piketWeekRes, kegiatanRes, movRes, usersRes, lcSessionsRes] =
        await Promise.all([
          scopeTickets(supabase.from('tickets').select('id,status,assign_name,sales_division,date,created_at,product')),
          supabase.from('activity_logs').select('id,ticket_id,new_status,created_at,handler_name').order('created_at',{ascending:false}).limit(500),
          scopeReminders(supabase.from('reminders').select('id,status,category,due_date,product')),
          supabase.from('piket_schedules').select('day_of_week,pic_ivp_name,pic_ump_name,pic_mlds_name,day_date').eq('day_date', todayStr()),
          supabase.from('piket_schedules').select('id,day_date,pic_ivp_name,pic_ump_name,pic_mlds_name').gte('day_date', getMonday()).lte('day_date', todayStr()),
          supabase.from('piket_tamu_detail').select('id,created_at').gte('created_at', today),
          supabase.from('movement_logs').select('id,status_barang,tanggal,nama_pts').gte('tanggal', monthStart()),
          scope.kind === 'admin'
            ? supabase.from('users').select('id,role,team_type')
            : Promise.resolve({ data: [] }),
          scope.kind === 'admin'
            ? supabase.from('lc_quiz_attempts').select('id,user_id,score,passed,is_submitted').eq('is_submitted', true)
            : Promise.resolve({ data: [] }),
        ]);

      let tickets   = (ticketsRes.data   ?? []) as any[];
      let reminders = (remindersRes.data ?? []) as any[];
      let movements = (movRes.data       ?? []) as any[];
      const actLogs    = (actLogsRes.data    ?? []) as any[];
      const piketToday = ((piketTodayRes.data ?? [])[0]) ?? null;
      const piketWeek  = (piketWeekRes.data  ?? []) as any[];
      const kegiatan   = (kegiatanRes.data   ?? []) as any[];
      const users      = (usersRes.data      ?? []) as any[];
      const lcAttempts = (lcSessionsRes.data ?? []) as any[];

      // PTS scope: filter piket & movements to own team
      if (scope.kind === 'pts_sup') {
        const tt = scope.ptsTeamType ?? '';
        movements = movements.filter((m:any) => scope.ptsMemberNames?.includes(m.nama_pts));
        // piket: show all, but today card highlights their team column
      }

      // ── KPI calculations (identical to before, just on scoped data) ──
      const open           = tickets.filter((t:any)=>!['Solved','Cancelled'].includes(t.status)).length;
      const solved         = tickets.filter((t:any)=>t.status==='Solved').length;
      const waitingApproval= tickets.filter((t:any)=>t.status==='Waiting Approval').length;

      // Resolved today: cross-reference actLogs that belong to scoped tickets
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
      const productTicketMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ if(t.product) productTicketMap[t.product]=(productTicketMap[t.product]||0)+1; });
      const byProduct = Object.entries(productTicketMap).map(([product,count])=>({product,count})).sort((a,b)=>b.count-a.count);

      const solvedT = tickets.filter((t:any)=>t.status==='Solved'&&t.date&&t.created_at);
      const totalDays = solvedT.reduce((acc:number,t:any)=>{
        const d=(new Date(t.date).getTime()-new Date(t.created_at).getTime())/86400000;
        return acc+Math.max(0,d);
      },0);
      const avgResolutionDays = solvedT.length?Math.round(totalDays/solvedT.length):0;

      const currentYear = new Date().getFullYear();
      const monthlyTickets = Array.from({length: 12}, (_, mi) =>
        tickets.filter((t: any) => {
          const d = new Date(t.created_at);
          return d.getFullYear() === currentYear && d.getMonth() === mi;
        }).length
      );

      const catMap: Record<string,number> = {};
      reminders.forEach((r:any)=>{ catMap[r.category]=(catMap[r.category]||0)+1; });
      const byCategory = Object.entries(catMap).map(([cat,count])=>({ cat,count,color:CATEGORY_COLORS[cat]??'#94a3b8' })).sort((a,b)=>b.count-a.count);
      const dueSoon     = reminders.filter((r:any)=>r.status==='pending'&&r.due_date>=today&&r.due_date<=oneWeekStr).length;
      const overdueCount= reminders.filter((r:any)=>r.status==='pending'&&r.due_date<today).length;
      // Reminder byProduct: per produk, group by category
      const reminderProdMap: Record<string, Record<string,number>> = {};
      reminders.forEach((r:any)=>{ 
        if(r.product) {
          if(!reminderProdMap[r.product]) reminderProdMap[r.product]={};
          reminderProdMap[r.product][r.category||'Lainnya']=(reminderProdMap[r.product][r.category||'Lainnya']||0)+1;
        }
      });
      const remindersByProduct = Object.entries(reminderProdMap).map(([product,catMap])=>({
        product,
        byCategory: Object.entries(catMap).map(([cat,count])=>({cat,count})).sort((a,b)=>b.count-a.count),
      })).sort((a,b)=>b.byCategory.reduce((s,c)=>s+c.count,0)-a.byCategory.reduce((s,c)=>s+c.count,0));

      const weekFilled = piketWeek.filter((p:any)=>p.pic_ivp_name||p.pic_ump_name||p.pic_mlds_name).length;
      // weekTotal = jumlah hari kerja (Senin-Jumat) dari awal minggu ini s.d. hari ini
      // weekTotal selalu 5 (Senin-Jumat), bukan hanya sampai hari ini
      const weekWorkDays = 5;

      const roleMap: Record<string,number> = {};
      users.forEach((u:any)=>{ roleMap[u.role]=(roleMap[u.role]||0)+1; });

      // Learning: dari lc_quiz_attempts (submitted)
      const lcSubmitted = lcAttempts.length;
      const lcPassed = lcAttempts.filter((a:any) => a.passed === true).length;
      const lcParticipants = new Set(lcAttempts.map((a:any) => a.user_id as string).filter(Boolean)).size;
      const lcScores = lcAttempts.filter((a:any) => a.score != null).map((a:any) => a.score as number);
      const lcAvgScore = lcScores.length ? Math.round(lcScores.reduce((a:number,b:number)=>a+b,0)/lcScores.length) : 0;

      setKpi({
        tickets:{ total:tickets.length,open,solved,waitingApproval,byHandler,byStatus,byDivision,byProduct,resolvedToday,avgResolutionDays,monthlyTickets },
        reminders:{ total:reminders.length,pending:reminders.filter((r:any)=>r.status==='pending').length,done:reminders.filter((r:any)=>r.status==='done').length,dueSoon,byCategory,byProduct:remindersByProduct,overdueCount },
        piket:{ todayIVP:piketToday?.pic_ivp_name??null,todayUMP:piketToday?.pic_ump_name??null,todayMlds:piketToday?.pic_mlds_name??null,weekFilled,weekTotal:weekWorkDays,kegiatanToday:kegiatan.length },
        units:{ totalLogs:movements.length,keluarThisMonth:movements.filter((m:any)=>m.status_barang==='Keluar').length,masukThisMonth:movements.filter((m:any)=>m.status_barang==='Masuk').length },
        users:{ total:users.length,byRole:Object.entries(roleMap).map(([role,count])=>({role,count})) },
        learning:{ totalSessions:lcSubmitted, completedSessions:lcPassed, totalParticipants:lcParticipants, avgScore:lcAvgScore },
      });
    } catch(e){ console.error('KPI fetch error:',e); }
    finally { setLoading(false); }
  }, [scope, scopeReady]);

  // ── 3. Fetch Audit (scope-aware) ──────────────────────────────────────────

  const fetchAudit = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') { setAuditLoading(false); return; }
    setAuditLoading(true);
    try {
      // Build ticket filter
      const ticketQ = (() => {
        let q = supabase.from('tickets').select('id,project_name,status,assign_name,created_by,created_at,date').order('created_at',{ascending:false}).limit(40);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('assign_name',scope.ptsMemberNames);
        return q;
      })();
      const actQ = (() => {
        let q = supabase.from('activity_logs').select('id,ticket_id,handler_name,action_taken,new_status,notes,created_at').order('created_at',{ascending:false}).limit(80);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('handler_name',scope.ptsMemberNames);
        return q;
      })();
      const reminderQ = (() => {
        let q = supabase.from('reminders').select('id,project_name,category,status,assign_name,created_by,created_at,updated_at').order('updated_at',{ascending:false}).limit(50);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('assign_name',scope.ptsMemberNames);
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
      (remindersRes.data??[]).forEach((r:any)=>{
        const isUpdated = r.updated_at && r.updated_at !== r.created_at;
        const ts = r.updated_at ?? r.created_at;
        const action = r.status==='done' ? 'Reminder diselesaikan' : isUpdated ? 'Reminder diupdate' : 'Reminder dibuat';
        const icon = r.status==='done' ? '✅' : isUpdated ? '🔄' : '🗓️';
        const sev: 'info'|'warn' = r.status==='done' ? 'info' : 'warn';
        entries.push({ id:`rem-${r.id}`,module:'Reminder',icon, actor:r.created_by??'Unknown', action, target:r.project_name??'-', detail:`${r.category??''}${r.assign_name?` · ${r.assign_name}`:''}`, ts, severity:sev });
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

  // ── Effects: trigger fetch when scope is resolved ─────────────────────────

  useEffect(() => {
    if (!scopeReady) return;
    fetchKPI(); fetchAudit();
    intervalRef.current = setInterval(() => {
      fetchKPI(); fetchAudit(); setLastRefresh(new Date());
    }, 3 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [scopeReady, fetchKPI, fetchAudit]);

  // ── Filtered Audit ────────────────────────────────────────────────────────

  const filteredAudit = audit.filter(a => {
    const matchFilter = auditFilter==='all'
      ||(auditFilter==='ticket'&&a.module==='Ticketing')
      ||(auditFilter==='reminder'&&a.module==='Reminder')
      ||(auditFilter==='piket'&&a.module==='Piket')
      ||(auditFilter==='user'&&a.module==='User');
    const q=auditSearch.toLowerCase();
    return matchFilter && (!q||[a.actor,a.target,a.action,a.detail].some(x=>x.toLowerCase().includes(q)));
  });

  // ── Early return if no access ─────────────────────────────────────────────
  if (!scopeReady) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"/>
    </div>
  );
  // ── Piket card highlight per team ─────────────────────────────────────────
  const isPTSIVP  = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS';
  const isPTSUMP  = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS UMP';
  const isPTSMLDS = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS MLDS';

  const scopeTitle = scope.kind==='admin' ? 'Dashboard'
    : scope.kind==='pts_sup' ? `Summary ${scope.ptsTeamType}`
    : scope.kind==='team' ? 'Dashboard'
    : 'KPI Dashboard';

  const TAB_CONFIG = [
    {key:'analytics' as const, icon:'📊', label:'Analytics'},
  ];

  // ─── LC-style design helpers ────────────────────────────────────────────────
  function SectionPill({ icon, children }: { icon: string; children: React.ReactNode }) {
    return (
      <h3 className="text-sm font-bold uppercase tracking-widest mb-4 inline-flex items-center gap-1.5 bg-white text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm border border-slate-200">
        <span>{icon}</span>{children}
      </h3>
    );
  }

  // ── Full DonutChart (same as LC) ──
  function DonutChart({ segments, size = 68, strokeWidth = 10, label = '' }: {
    segments: { value: number; color: string }[]; size?: number; strokeWidth?: number; label?: string;
  }) {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center flex-shrink-0">
        <span className="text-sm text-slate-300 font-bold">—</span>
      </div>
    );
    let cumBefore = 0;
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => {
            const dash = (seg.value / total) * circ;
            const offset = -(cumBefore / total) * circ;
            cumBefore += seg.value;
            return (
              <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color}
                strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} />
            );
          })}
        </svg>
        {label && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-black text-slate-700">{label}</span>
          </div>
        )}
      </div>
    );
  }

  // ── MiniBar: horizontal progress bar ──
  function MiniBar({ value, max, color='#3b82f6', h=4 }: { value:number; max:number; color?:string; h?:number }) {
    const pct = max>0 ? Math.min(100,(value/max)*100) : 0;
    return (
      <div className="w-full rounded-full overflow-hidden flex-1" style={{height:h,background:'#f1f5f9'}}>
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:color}}/>
      </div>
    );
  }

  // ── MiniSpark: tiny SVG bar spark ──
  function MiniSpark({ values, color='#3b82f6', height=20, width=56 }: { values:number[]; color?:string; height?:number; width?:number }) {
    const bw = Math.floor(width/values.length)-1;
    const max = Math.max(...values,1);
    return (
      <svg width={width} height={height} className="flex-shrink-0">
        {values.map((v,i)=>{
          const bh = Math.max(2,(v/max)*height);
          return <rect key={i} x={i*(bw+1)} y={height-bh} width={bw} height={bh} rx={1}
            fill={color} opacity={0.5+(i/values.length)*0.5}/>;
        })}
      </svg>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ animation:'fadeInUp 0.35s ease forwards', background:'rgba(0,0,0,0.10)' }}>

        {/* ── Top bar — sticky menempel di atas seperti Learning Center ── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 flex-shrink-0 sticky top-0 z-50"
          style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'3px solid #dc2626' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 leading-tight">{scopeTitle}</span>
                <ScopeBadge scope={scope}/>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">SYNC {lastRefresh.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={()=>{ setLoading(true); setAuditLoading(true); fetchKPI(); fetchAudit(); setLastRefresh(new Date()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 transition-all">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Sync
            </button>
          </div>
        </div>

        {/* ── Content area — scrollable, transparan ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* ══════════ TAB ANALYTICS ══════════ */}
          {tab==='analytics' && (
            <div className="space-y-3">

              {/* ── ROW 1: Piket + Ticket dalam 1 baris ── */}
              <div className="grid grid-cols-2 gap-3">

                {/* PIKET SHOWROOM */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">🏪 Piket Showroom</span>
                    <span className="text-[10px] text-slate-400">{new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}</span>
                  </div>
                  {/* PIC row */}
                  <div className="flex flex-col gap-1.5 mb-2">
                    {[
                      {team:'IVP',  person:kpi?.piket.todayIVP,  c:'#ef4444', bg:'#fef2f2'},
                      {team:'UMP',  person:kpi?.piket.todayUMP,  c:'#f59e0b', bg:'#fffbeb'},
                      {team:'MLDS', person:kpi?.piket.todayMlds, c:'#3b82f6', bg:'#eff6ff'},
                    ].map(p=>(
                      <div key={p.team} className="flex items-center gap-1.5">
                        <span className="text-sm font-black px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{background:p.bg,color:p.c}}>{p.team}</span>
                        {loading
                          ? <div className="h-2.5 w-20 rounded animate-pulse bg-slate-100 flex-1"/>
                          : <span className="text-sm font-semibold text-slate-700 truncate flex-1">
                              {p.person ?? <span className="italic text-slate-300 text-sm">Belum diisi</span>}
                            </span>}
                      </div>
                    ))}
                  </div>
                  {/* Week progress bar */}
                  {!loading&&kpi&&(
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-slate-400">Minggu ini</span>
                        <span className="text-[11px] font-bold text-slate-600">{kpi.piket.weekFilled}/{kpi.piket.weekTotal} hari · {kpi.piket.kegiatanToday} tamu</span>
                      </div>
                      <MiniBar value={kpi.piket.weekFilled} max={kpi.piket.weekTotal} color="#10b981" h={5}/>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-sm text-slate-300">0%</span>
                        <span className="text-sm font-bold text-emerald-600">{Math.min(100,Math.round((kpi.piket.weekFilled/Math.max(kpi.piket.weekTotal,1))*100))}% terpenuhi</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* TICKET TROUBLESHOOTING */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">🎫 Ticket</span>
                    <span className="text-[10px] text-slate-400">{scope.kind==='pts_sup'?scope.ptsTeamType:'Semua'}</span>
                  </div>
                  {/* Mini stat row */}
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {[
                      {label:'Total', value:kpi?.tickets.total??0,         c:'#64748b'},
                      {label:'Open',  value:kpi?.tickets.open??0,          c:'#ef4444'},
                      {label:'Solved',value:kpi?.tickets.solved??0,        c:'#10b981'},
                      {label:'Hari ini',value:kpi?.tickets.resolvedToday??0,c:'#0891b2'},
                    ].map(s=>(
                      <div key={s.label} className="flex flex-col items-center p-1 rounded-lg" style={{background:s.c+'10'}}>
                        {loading ? <div className="h-4 w-5 rounded animate-pulse bg-slate-100 mb-0.5"/> :
                          <span className="text-sm font-black leading-none" style={{color:s.c}}>{s.value}</span>}
                        <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight font-medium">{s.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Donut + status list */}
                  {!loading&&kpi&&kpi.tickets.byStatus.length>0&&(
                    <div className="flex items-start gap-3">
                      <DonutChart segments={kpi.tickets.byStatus.map(s=>({value:s.count,color:s.color}))}
                        size={80} strokeWidth={10} label={`${kpi.tickets.total}`}/>
                      <div className="flex-1 min-w-0 space-y-1">
                        {kpi.tickets.byStatus.slice(0,6).map(s=>(
                          <div key={s.status} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:s.color}}/>
                            <span className="text-[10px] text-slate-500 flex-shrink-0" style={{width:'6.5rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.status}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#f1f5f9',minWidth:16}}>
                              <div className="h-full rounded-full" style={{width:`${kpi.tickets.total>0?(s.count/kpi.tickets.total)*100:0}%`,background:s.color}}/>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 flex-shrink-0 w-5 text-right">{s.count}</span>
                          </div>
                        ))}
                        <div className="flex justify-end mt-0.5">
                          <span className="text-[9px] text-slate-400">Avg resolusi </span>
                          <span className="text-[10px] font-black text-rose-500 ml-1">{kpi.tickets.avgResolutionDays}h</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── ROW 2: Reminder + Unit Movement ── */}
              <div className="grid grid-cols-2 gap-3">

                {/* REMINDER SCHEDULE */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">📅 Reminder Schedule</span>
                  </div>
                  {/* Stat row */}
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {[
                      {label:'Total',   value:kpi?.reminders.total??0,       c:'#6366f1'},
                      {label:'Pending', value:kpi?.reminders.pending??0,     c:'#f59e0b'},
                      {label:'Overdue', value:kpi?.reminders.overdueCount??0,c:'#ef4444'},
                      {label:'Done',    value:kpi?.reminders.done??0,        c:'#10b981'},
                    ].map(s=>(
                      <div key={s.label} className="flex flex-col items-center p-1 rounded-lg" style={{background:s.c+'10'}}>
                        {loading ? <div className="h-4 w-5 rounded animate-pulse bg-slate-100 mb-0.5"/> :
                          <span className="text-sm font-black leading-none" style={{color:s.c}}>{s.value}</span>}
                        <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight font-medium">{s.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Donut + category bar list */}
                  {!loading&&kpi&&kpi.reminders.byCategory.length>0&&(
                    <div className="flex items-start gap-3">
                      <DonutChart segments={kpi.reminders.byCategory.map(c=>({value:c.count,color:c.color}))}
                        size={80} strokeWidth={10} label={`${kpi.reminders.total}`}/>
                      <div className="flex-1 min-w-0 space-y-1">
                        {kpi.reminders.byCategory.slice(0,6).map(c=>(
                          <div key={c.cat} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:c.color}}/>
                            <span className="text-[10px] text-slate-500 flex-shrink-0" style={{width:'6.5rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.cat}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#f1f5f9',minWidth:16}}>
                              <div className="h-full rounded-full" style={{width:`${kpi.reminders.total>0?(c.count/kpi.reminders.total)*100:0}%`,background:c.color}}/>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 flex-shrink-0 w-5 text-right">{c.count}</span>
                          </div>
                        ))}
                        {/* Done rate */}
                        <div className="flex justify-end mt-0.5">
                          <span className="text-[9px] text-slate-400">Done rate </span>
                          <span className="text-[10px] font-black text-emerald-600 ml-1">
                            {kpi.reminders.total>0?Math.round((kpi.reminders.done/kpi.reminders.total)*100):0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* UNIT MOVEMENT + PENGGUNA (admin) / hanya unit (pts_sup) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">🚚 Unit Movement</span>
                    <span className="text-[10px] text-slate-400">Bulan ini</span>
                  </div>
                  {/* Unit stats */}
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {[
                      {label:'Log',   value:kpi?.units.totalLogs??0,        c:'#64748b'},
                      {label:'Keluar',value:kpi?.units.keluarThisMonth??0,  c:'#f59e0b'},
                      {label:'Masuk', value:kpi?.units.masukThisMonth??0,   c:'#10b981'},
                    ].map(s=>(
                      <div key={s.label} className="flex flex-col items-center p-1 rounded-lg" style={{background:s.c+'12'}}>
                        {loading ? <div className="h-4 w-5 rounded animate-pulse bg-slate-100 mb-0.5"/> :
                          <span className="text-sm font-black leading-none" style={{color:s.c}}>{s.value}</span>}
                        <span className="text-[10px] text-slate-400 mt-0.5">{s.label}</span>
                      </div>
                    ))}
                  </div>
                  {!loading&&kpi&&(
                    <div className="flex items-start gap-3 mb-2">
                      <DonutChart size={80} strokeWidth={10}
                        segments={[
                          {value:kpi.units.keluarThisMonth,color:'#f59e0b'},
                          {value:kpi.units.masukThisMonth, color:'#10b981'},
                          {value:Math.max(kpi.units.totalLogs-kpi.units.keluarThisMonth-kpi.units.masukThisMonth,0),color:'#e2e8f0'},
                        ]} label={`${kpi.units.totalLogs}`}/>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"/>
                          <span className="text-[10px] text-slate-500 flex-shrink-0 w-10">Keluar</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#f1f5f9',minWidth:12}}>
                            <div className="h-full rounded-full bg-amber-400" style={{width:`${kpi.units.totalLogs>0?(kpi.units.keluarThisMonth/kpi.units.totalLogs)*100:0}%`}}/>
                          </div>
                          <span className="text-[10px] font-bold text-slate-700 flex-shrink-0 w-5 text-right">{kpi.units.keluarThisMonth}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"/>
                          <span className="text-[10px] text-slate-500 flex-shrink-0 w-10">Masuk</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#f1f5f9',minWidth:12}}>
                            <div className="h-full rounded-full bg-emerald-500" style={{width:`${kpi.units.totalLogs>0?(kpi.units.masukThisMonth/kpi.units.totalLogs)*100:0}%`}}/>
                          </div>
                          <span className="text-[10px] font-bold text-slate-700 flex-shrink-0 w-5 text-right">{kpi.units.masukThisMonth}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Pengguna platform — hanya admin, inline di bawah unit */}
                  {scope.kind==='admin'&&!loading&&kpi&&(
                    <div className="border-t border-slate-100 pt-2 mt-1">
                      <div className="flex items-start gap-3">
                        <DonutChart
                          segments={(kpi.users.byRole).map((r,i)=>({value:r.count,color:['#6366f1','#10b981','#f59e0b','#ef4444','#0891b2'][i%5]}))}
                          size={80} strokeWidth={10} label={`${kpi.users.total}`}/>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">👥 Pengguna</div>
                          <div className="space-y-1">
                            {kpi.users.byRole.map((r,i)=>(
                              <div key={r.role} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{background:['#6366f1','#10b981','#f59e0b','#ef4444','#0891b2'][i%5]}}/>
                                <span className="text-[10px] text-slate-500 flex-shrink-0 uppercase" style={{width:'4.5rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.role}</span>
                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'#f1f5f9',minWidth:12}}>
                                  <div className="h-full rounded-full" style={{width:`${kpi.users.total>0?(r.count/kpi.users.total)*100:0}%`,background:['#6366f1','#10b981','#f59e0b','#ef4444','#0891b2'][i%5]}}/>
                                </div>
                                <span className="text-[10px] font-bold text-slate-700 flex-shrink-0 w-5 text-right">{r.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── ROW 3: Learning Center (admin) — compact 1 card full width ── */}
              {scope.kind==='admin'&&(
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">🎓 Learning Center</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Stat mini col */}
                    <div className="grid grid-cols-2 gap-1 col-span-1">
                      {[
                        {label:'Attempts', value:kpi?.learning.totalSessions??0,    c:'#6366f1'},
                        {label:'Lulus',    value:kpi?.learning.completedSessions??0, c:'#10b981'},
                        {label:'Peserta',  value:kpi?.learning.totalParticipants??0, c:'#0891b2'},
                        {label:'Avg Skor', value:kpi?.learning.avgScore??0,          c:'#f59e0b'},
                      ].map(s=>(
                        <div key={s.label} className="flex flex-col items-center p-1 rounded-lg" style={{background:s.c+'10'}}>
                          {loading?<div className="h-4 w-8 rounded animate-pulse bg-slate-100 mb-0.5"/>:
                            <span className="text-sm font-black leading-none" style={{color:s.c}}>{s.value}</span>}
                          <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight font-medium">{s.label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Pass rate donut */}
                    {!loading&&kpi&&(
                      <>
                        <div className="flex flex-col items-center justify-center gap-1">
                          <DonutChart
                            segments={[
                              {value:kpi.learning.completedSessions,color:'#10b981'},
                              {value:Math.max(kpi.learning.totalSessions-kpi.learning.completedSessions,0),color:'#fee2e2'},
                            ]}
                            size={52} strokeWidth={8}
                            label={`${kpi.learning.totalSessions>0?Math.round((kpi.learning.completedSessions/kpi.learning.totalSessions)*100):0}%`}/>
                          <span className="text-sm font-bold text-slate-500">Pass Rate</span>
                          <span className="text-[10px] text-slate-400">{kpi.learning.completedSessions}✓ · {kpi.learning.totalSessions-kpi.learning.completedSessions}✗</span>
                        </div>
                        {/* Avg score donut */}
                        <div className="flex flex-col items-center justify-center gap-1">
                          <DonutChart
                            segments={[
                              {value:kpi.learning.avgScore,color:kpi.learning.avgScore>=80?'#10b981':kpi.learning.avgScore>=60?'#f59e0b':'#ef4444'},
                              {value:Math.max(100-kpi.learning.avgScore,0),color:'#f1f5f9'},
                            ]}
                            size={52} strokeWidth={8} label={`${kpi.learning.avgScore}`}/>
                          <span className="text-sm font-bold text-slate-500">Avg Score</span>
                          <span className="text-[10px] text-slate-400">{kpi.learning.totalParticipants} peserta</span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Spark bar: simple pass vs fail visual */}
                  {!loading&&kpi&&kpi.learning.totalSessions>0&&(
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400 w-10 flex-shrink-0">Lulus</span>
                        <MiniBar value={kpi.learning.completedSessions} max={kpi.learning.totalSessions} color="#10b981" h={5}/>
                        <span className="text-sm text-slate-400 w-10 flex-shrink-0">Tidak</span>
                        <MiniBar value={kpi.learning.totalSessions-kpi.learning.completedSessions} max={kpi.learning.totalSessions} color="#ef4444" h={5}/>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}


          {/* ══════════ TAB ANALYTICS — KPI Live Charts ══════════ */}
          {tab==='analytics'&&(
            <div className="space-y-6">
              {/* ── ROW A: 3-col Ticket charts ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Handler */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🎫 Ticket Open per Handler</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byHandler.length
                      ? <HBarChart data={kpi.tickets.byHandler.map(h=>({label:h.name.split(' ')[0],value:h.count}))} color="#ef4444"/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>
                {/* Divisi */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🏢 Ticket per Divisi</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byDivision.length
                      ? <HBarChart data={kpi.tickets.byDivision.map(d=>({label:d.div,value:d.count}))} color="#6366f1"/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>
                {/* Product */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">📦 Ticket per Produk</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byProduct?.length
                      ? <HBarChart data={kpi.tickets.byProduct.map(p=>({label:p.product,value:p.count}))} color="#0891b2"/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data produk</p>}
                </div>
              </div>

              {/* ── ROW B: Reminder Kategori + Reminder per Produk ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🗂️ Reminder per Kategori</h3>
                  {loading?<div className="h-28 rounded animate-pulse bg-slate-100"/>:(
                    <div className="flex items-start gap-5">
                      <div className="flex-shrink-0">
                      <DonutChart size={80} strokeWidth={10}
                          segments={(kpi?.reminders.byCategory??[]).map(c=>({value:c.count,color:c.color}))}
                          label={`${kpi?.reminders.total??0}`}/>
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {(kpi?.reminders.byCategory??[]).map(c=>(
                          <div key={c.cat} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:c.color }}/>
                            <span className="text-[11px] text-slate-600 font-medium flex-shrink-0" style={{width:'9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.cat}</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'#f1f5f9',minWidth:16}}>
                              <div className="h-full rounded-full" style={{width:`${(kpi?.reminders.total??0)>0?(c.count/(kpi?.reminders.total??1))*100:0}%`,background:c.color}}/>
                            </div>
                            <span className="text-[11px] font-black text-slate-700 flex-shrink-0 w-5 text-right">{c.count}</span>
                          </div>
                        ))}
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Done rate</span>
                          <span className="text-[11px] font-black text-emerald-600">
                            {kpi && kpi.reminders.total>0?Math.round((kpi.reminders.done/kpi.reminders.total)*100):0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Reminder per Produk */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🏷️ Reminder per Produk</h3>
                  {loading?<div className="h-28 rounded animate-pulse bg-slate-100"/>:(
                    (kpi?.reminders.byProduct??[]).length === 0
                      ? <p className="text-sm text-center py-8 text-slate-400">Tidak ada data produk</p>
                      : <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1" style={{scrollbarWidth:'thin'}}>
                          {(kpi?.reminders.byProduct??[]).map(p=>{
                            const total = p.byCategory.reduce((s,c)=>s+c.count,0);
                            return (
                              <div key={p.product} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                                {/* Produk header */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-700 leading-snug" style={{maxWidth:'85%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.product}</span>
                                  <span className="text-[11px] font-black text-slate-500 flex-shrink-0 ml-1">{total}</span>
                                </div>
                                {/* Kategori: satu per baris */}
                                <div className="space-y-1">
                                  {p.byCategory.map(c=>{
                                    const col = CATEGORY_COLORS[c.cat]||'#64748b';
                                    return (
                                      <div key={c.cat} className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:col}}/>
                                        <span className="text-[10px] text-slate-500 flex-shrink-0" style={{width:'8rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.cat}</span>
                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:`${col}20`,minWidth:12}}>
                                          <div className="h-full rounded-full" style={{width:`${total>0?(c.count/total)*100:0}%`,background:col}}/>
                                        </div>
                                        <span className="text-[10px] font-bold flex-shrink-0 w-4 text-right" style={{color:col}}>{c.count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                  )}
                </div>
              </div>

              {/* ── Trend Ticket Bulanan ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">📈 Trend Ticket Bulanan {new Date().getFullYear()}</h3>
                {loading ? <div className="h-32 rounded animate-pulse bg-slate-100"/> : (
                  kpi?.tickets.monthlyTickets?.some(v => v > 0) ? (() => {
                    const MN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
                    const data = kpi.tickets.monthlyTickets;
                    const max = Math.max(...data, 1);
                    const total = data.reduce((s, v) => s + v, 0);
                    const curMonth = new Date().getMonth();
                    return (
                      <div>
                        <div className="flex items-end gap-1" style={{height: 120}}>
                          {data.map((v, i) => {
                            const hPct = Math.round((v / max) * 108);
                            const isCur = i === curMonth;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group cursor-default" title={`${MN[i]}: ${v} ticket`}>
                                <div className="w-full rounded-t transition-all duration-700"
                                  style={{ height: v > 0 ? Math.max(hPct, 4) : 2, background: isCur ? '#ef4444' : '#fca5a5', opacity: isCur ? 1 : 0.7 }}/>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-1 mt-1 mb-2">
                          {MN.map((m, i) => (
                            <div key={i} className="flex-1 text-center">
                              <span className={`text-[9px] ${i === curMonth ? 'font-black text-red-500' : 'text-slate-400'}`}>{m}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{background:'#ef4444'}}/><span className="text-[11px] text-slate-500">Bulan ini</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{background:'#fca5a5'}}/><span className="text-[11px] text-slate-500">Bulan lain</span></div>
                          </div>
                          <span className="text-sm font-black text-red-500">{total} total</span>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <span className="text-3xl opacity-20">📊</span>
                      <p className="text-[11px] text-slate-400">Belum ada data ticket tahun ini.</p>
                    </div>
                  )
                )}
              </div>

              {/* Performa Resolusi */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">⚡ Ringkasan Performa</h3>
                {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:(
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      {label:'Avg. Resolusi Ticket',value:`${kpi?.tickets.avgResolutionDays??0} hari`,color:'#ef4444',icon:'⏱️'},
                      {label:'Solved Hari Ini',value:`${kpi?.tickets.resolvedToday??0} ticket`,color:'#10b981',icon:'✅'},
                      {label:'Reminder Overdue',value:`${kpi?.reminders.overdueCount??0} jadwal`,color:'#f59e0b',icon:'🔴'},
                      {label:'Piket Terisi Minggu Ini',value:`${kpi?.piket.weekFilled??0}/${kpi?.piket.weekTotal??6} hari`,color:'#6366f1',icon:'🏪'},
                      {label:'Tamu Showroom Hari Ini',value:`${kpi?.piket.kegiatanToday??0} orang`,color:'#0891b2',icon:'👤'},
                      ...(scope.kind==='admin'?[{label:'LC Avg. Skor',value:`${kpi?.learning.avgScore??0} poin`,color:'#8b5cf6',icon:'🎓'}]:[]),
                    ].map(m=>(
                      <div key={m.label} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <span className="text-xl">{m.icon}</span>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</div>
                          <div className="text-sm font-black" style={{ color:m.color }}>{m.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cross-Module and Audit Trail tabs removed — moved to Analytics Platform page */}
          {(tab as string)==='cross_removed'&&(
            <div className="space-y-5">
              <div className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">🔀 Cross-Module Overview — Ticket · Reminder · Learning Center</div>

              {/* Monthly bar chart: 3 modules side by side */}
              {(() => {
                const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
                const year = new Date().getFullYear();
                // Build monthly data from kpi data available in state
                // We'll use kpiTeam member data to aggregate
                const allMembers = kpiTeam.members;
                const ticketsByMonth = Array.from({length:12},(_,mi)=>
                  allMembers.reduce((s,m)=>s+(m.monthlyTickets?.[mi]??0),0)
                );
                const lcByMonth = Array.from({length:12},(_,mi)=>
                  allMembers.reduce((s,m)=>s+(m.monthlyLC?.[mi]??0),0)
                );
                // For reminders we use kpi.reminders.byCategory total as flat (no monthly breakdown yet)
                const maxVal = Math.max(...ticketsByMonth, ...lcByMonth, 1);
                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">📅 Aktivitas Bulanan {year}</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#ef4444'}}/>Ticket</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#6366f1'}}/>LC Attempt</span>
                      </div>
                    </div>
                    {allMembers.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <span className="text-3xl opacity-20">📊</span>
                        <p className="text-[10px] text-slate-400">Data KPI Team belum tersedia. Buka menu KPI Team untuk memuat data.</p>
                      </div>
                    ) : (
                      <div className="flex items-end gap-1.5" style={{height:160}}>
                        {MONTHS.map((m,mi)=>{
                          const t=ticketsByMonth[mi], l=lcByMonth[mi];
                          const hT=Math.round((t/maxVal)*140), hL=Math.round((l/maxVal)*140);
                          return (
                            <div key={mi} className="flex-1 flex flex-col items-center gap-1 group">
                              <div className="flex items-end gap-0.5 w-full justify-center" style={{height:148}}>
                                <div className="w-[42%] rounded-t transition-all duration-700" title={`Ticket: ${t}`}
                                  style={{height:hT||2, background:'#ef4444', opacity:t?0.85:0.12}}/>
                                <div className="w-[42%] rounded-t transition-all duration-700" title={`LC: ${l}`}
                                  style={{height:hL||2, background:'#6366f1', opacity:l?0.85:0.12}}/>
                              </div>
                              <span className="text-[10px] text-slate-400">{m}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Module summary comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tickets */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{background:'#fee2e2'}}>🎫</div>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Ticketing</span>
                  </div>
                  {[
                    {label:'Total',val:kpi?.tickets.total??0,color:'#64748b'},
                    {label:'Open',val:kpi?.tickets.open??0,color:'#ef4444'},
                    {label:'Solved',val:kpi?.tickets.solved??0,color:'#10b981'},
                    {label:'Overdue',val:(kpi?.tickets.byStatus??[]).find(s=>s.status==='Overdue')?.count??0,color:'#f59e0b'},
                  ].map(r=>(
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{r.label}</span>
                      <span className="text-sm font-black" style={{color:r.color}}>{loading?'—':r.val}</span>
                    </div>
                  ))}
                </div>
                {/* Reminders */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{background:'#ede9fe'}}>📅</div>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Reminder</span>
                  </div>
                  {[
                    {label:'Total',val:kpi?.reminders.total??0,color:'#64748b'},
                    {label:'Pending',val:kpi?.reminders.pending??0,color:'#f59e0b'},
                    {label:'Done',val:kpi?.reminders.done??0,color:'#10b981'},
                    {label:'Overdue',val:kpi?.reminders.overdueCount??0,color:'#ef4444'},
                  ].map(r=>(
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{r.label}</span>
                      <span className="text-sm font-black" style={{color:r.color}}>{loading?'—':r.val}</span>
                    </div>
                  ))}
                </div>
                {/* Learning Center */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{background:'#ede9fe'}}>🎓</div>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Learning Center</span>
                  </div>
                  {[
                    {label:'Total Sesi',val:kpi?.learning.totalSessions??0,color:'#64748b'},
                    {label:'Selesai',val:kpi?.learning.completedSessions??0,color:'#10b981'},
                    {label:'Peserta Unik',val:kpi?.learning.totalParticipants??0,color:'#6366f1'},
                    {label:'Avg Skor',val:`${kpi?.learning.avgScore??0} pts`,color:'#f59e0b'},
                  ].map(r=>(
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{r.label}</span>
                      <span className="text-sm font-black" style={{color:r.color}}>{loading?'—':r.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team KPI summary table */}
              {kpiTeam.members.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">👥 Ringkasan KPI Tim — {kpiTeam.filterYear}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{minWidth:560}}>
                      <thead>
                        <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                          {['Nama','Tim','Ticket','LC','BAST','Skor KPI'].map(h=>(
                            <th key={h} className="px-3 py-2 text-left text-sm font-bold uppercase tracking-widest text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kpiTeam.members.map(m=>{
                          const _s = kpiSettings;
                          const lcFailedDyn = (m.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
                          const tickS = m.ticketsHandled>0?Math.max(0,1-m.ticketsOverdue/Math.max(m.ticketsHandled,1)):0;
                          const bastS = m.formReviewTotal===0?0:m.formReviewLowRating===0?1:Math.max(0,1-m.formReviewLowRating/Math.max(m.formReviewTotal,1));
                          const lcS   = m.lcAttempts===0?0:Math.max(0,1-(lcFailedDyn/Math.max(m.lcAttempts,1)));
                          const rndS  = m.techNotesApproved>=_s.rndTarget?1:m.techNotesApproved/_s.rndTarget;
                          const final = Math.round((_s.ticketOverdueWeight*tickS + _s.bastWeight*bastS + _s.lcWeight*lcS + _s.rndWeight*rndS) * 100);
                          const noData = m.ticketsHandled===0&&m.lcAttempts===0&&m.techNotesApproved===0;
                          const c = noData?'#94a3b8':final>=85?'#10b981':final>=70?'#3b82f6':final>=50?'#f59e0b':'#ef4444';
                          return (
                            <tr key={m.id} style={{borderBottom:'1px solid #f1f5f9'}} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-semibold text-slate-700">{m.name.split(' ').slice(0,2).join(' ')}</td>
                              <td className="px-3 py-2 text-slate-400 text-sm">{m.team_type.replace('Team PTS ','')}</td>
                              <td className="px-3 py-2"><span className="font-bold text-red-500">{m.ticketsHandled}</span><span className="text-slate-400 ml-1">({m.ticketsOverdue} overdue)</span></td>
                              <td className="px-3 py-2"><span className="font-bold text-indigo-500">{m.lcAttempts}</span><span className="text-slate-400 ml-1">avg {m.lcAvgScore}</span></td>
                              <td className="px-3 py-2"><span className="font-bold text-amber-500">{m.formReviewLowRating}</span><span className="text-slate-400 ml-1">low-rating</span></td>
                              <td className="px-3 py-2"><span className="text-sm font-black" style={{color:c}}>{noData?'—':`${final}%`}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {(tab as string)==='audit_removed'&&(
            <div className="rounded-2xl p-4 space-y-3"
              style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' }}>
              {/* Search + filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}
                    placeholder="Cari actor, aksi, target..."
                    className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none bg-slate-50 border border-slate-200 text-slate-700 focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-all"/>
                </div>
                {(['all','ticket','reminder','piket','user'] as const).map(f=>(
                  <button key={f} onClick={()=>setAuditFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold tracking-wide transition-all border ${auditFilter===f ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    {f==='all'?'SEMUA':f.toUpperCase()}
                  </button>
                ))}
                <span className="text-sm ml-auto tracking-widest text-slate-400">{filteredAudit.length} ENTRI</span>
              </div>
              {/* List */}
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1"
                style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(0,0,0,0.1) transparent' }}>
                {auditLoading
                  ? Array.from({length:6}).map((_,i)=>(
                      <div key={i} className="h-12 rounded-lg animate-pulse bg-slate-100"/>
                    ))
                  : filteredAudit.length===0
                    ? <div className="text-center py-12 text-sm tracking-widest text-slate-300">TIDAK ADA DATA</div>
                    : filteredAudit.map((entry:AuditEntry,idx:number)=>(
                        <div key={entry.id??idx}><AuditRow entry={entry}/></div>
                      ))}
              </div>
            </div>
          )}

        </div>{/* end content */}

      {/* ══ Settings Modal ══ */}
      {showSettings && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800 text-base">⚙️ Pengaturan KPI</div>
                <div className="text-sm text-slate-400 mt-0.5">Atur batas & bobot masing-masing komponen</div>
              </div>
              <button onClick={()=>setShowSettings(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <div className="p-6 space-y-5">
              {/* LC Min Score */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 uppercase tracking-wide">🎓 Learning Center — Batas Nilai Minimum</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={40} max={85} step={5} value={kpiSettings.lcMinScore}
                    onChange={e=>setKpiSettings(p=>({...p, lcMinScore:Number(e.target.value)}))}
                    className="flex-1 accent-violet-600"/>
                  <span className="text-lg font-black text-violet-600 w-12 text-right">&lt;{kpiSettings.lcMinScore}</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">Nilai di bawah ini dianggap tidak lulus KPI LC</div>
              </div>
              {/* RnD Target */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 uppercase tracking-wide">📝 R&D Tech Note — Target per Tahun</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={8} step={1} value={kpiSettings.rndTarget}
                    onChange={e=>setKpiSettings(p=>({...p, rndTarget:Number(e.target.value)}))}
                    className="flex-1 accent-pink-600"/>
                  <span className="text-lg font-black text-pink-600 w-12 text-right">{kpiSettings.rndTarget}x</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">Minimal Tech Note approved per tahun untuk nilai penuh</div>
              </div>
              {/* Bobot section */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">📊 Bobot Komponen KPI (total harus 100%)</label>
                <div className="space-y-3">
                  {([
                    {key:'ticketOverdueWeight', label:'🎫 Ticketing', color:'#ef4444'},
                    {key:'bastWeight', label:'⭐ BAST & Demo', color:'#f59e0b'},
                    {key:'lcWeight', label:'🎓 Learning Center', color:'#6366f1'},
                    {key:'rndWeight', label:'📝 R&D Tech Note', color:'#ec4899'},
                  ] as {key: keyof KPISettings, label:string, color:string}[]).map(item=>(
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-600 w-36 flex-shrink-0">{item.label}</span>
                      <input type="range" min={5} max={60} step={5} value={Math.round((kpiSettings[item.key] as number)*100)}
                        onChange={e=>setKpiSettings(p=>({...p, [item.key]:Number(e.target.value)/100}))}
                        className="flex-1" style={{accentColor:item.color}}/>
                      <span className="text-sm font-black w-10 text-right" style={{color:item.color}}>
                        {Math.round((kpiSettings[item.key] as number)*100)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total bobot sekarang:</span>
                  <span className={`text-sm font-black ${Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)===100?'text-emerald-600':'text-red-500'}`}>
                    {Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)}%
                    {Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)===100?' ✓':' ⚠ harus 100%'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5 justify-end">
              <button onClick={()=>{
                  const def = {lcMinScore:70,rndTarget:2,ticketOverdueWeight:0.20,bastWeight:0.40,lcWeight:0.30,rndWeight:0.10};
                  setKpiSettings(def);
                  saveKpiSettings(def);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Reset Default
              </button>
              <button onClick={()=>{ saveKpiSettings(kpiSettings); setShowSettings(false); }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
                ✓ Simpan & Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
