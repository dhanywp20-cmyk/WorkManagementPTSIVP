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
  const [tab, setTab]               = useState<'analytics'|'kpi_team'|'history'|'cross'|'audit'>('analytics');
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
  const [selectedKPIMember, setSelectedKPIMember] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [kpiSettings, setKpiSettings] = useState<KPISettings>({
    lcMinScore: 70,
    rndTarget: 2,
    ticketOverdueWeight: 0.20,
    bastWeight: 0.40,
    lcWeight: 0.30,
    rndWeight: 0.10,
  });
  const [kpiSnapshots, setKpiSnapshots]   = useState<KPIPeriodSnapshot[]>([]);
  const [showStartKPI, setShowStartKPI]   = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
  const [selectedSnapMember, setSelectedSnapMember] = useState<string | null>(null); // popup detail member di Riwayat KPI
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

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
        tickets:{ total:tickets.length,open,solved,waitingApproval,byHandler,byStatus,byDivision,byProduct,resolvedToday,avgResolutionDays },
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

  // ── 4. Fetch KPI Team data ───────────────────────────────────────────────

  const fetchKPITeam = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') return;
    setKpiTeam(prev => ({ ...prev, loading: true }));
    try {
      const year = kpiTeam.filterYear;
      const period = kpiTeam.filterPeriod;
      const startMonth = kpiTeam.filterStartMonth; // ← pakai pilihan user, bukan auto-detect
      const monthCount = period === '6m' ? 6 : 12;
      const endMonth = Math.min(startMonth + monthCount - 1, 12);

      const pad = (n: number) => String(n).padStart(2, '0');
      const yearStart = `${year}-${pad(startMonth)}-01`;
      // Last day of endMonth
      const endDay = new Date(year, endMonth, 0).getDate();
      const effectiveEnd = `${year}-${pad(endMonth)}-${endDay}`;

      // Get team members
      let membersQ = supabase.from('users').select('id,full_name,jabatan,team_type,role,kpi_enabled');
      // Hanya tampilkan member yang diaktifkan dalam KPI Roster
      membersQ = membersQ.eq('kpi_enabled', true);
      if (scope.kind === 'pts_sup') {
        membersQ = membersQ.eq('role', 'team').eq('team_type', scope.ptsTeamType ?? '');
      } else if (scope.kind === 'admin') {
        membersQ = membersQ.in('team_type', ['Team PTS', 'Team PTS UMP', 'Team PTS MLDS']).eq('role', 'team');
      } else if (scope.kind === 'team') {
        // Team member: only fetch their own data
        membersQ = membersQ.eq('id', currentUser.id);
      } else {
        setKpiTeam(prev => ({ ...prev, loading: false }));
        return;
      }
      const { data: membersData } = await membersQ;
      if (!membersData?.length) {
        setKpiTeam(prev => ({ ...prev, members: [], loading: false }));
        return;
      }

      const memberNames = membersData.map((m: any) => m.full_name as string);
      const memberIds = membersData.map((m: any) => m.id as string);

      // Parallel fetch platform data per member
      const [ticketsRes, actLogsRes, remindersRes, lcAttemptsRes, piketRes, formReviewRes, manualRes, techNotesRes] = await Promise.all([
        supabase.from('tickets')
          .select('id,assign_name,status,date,created_at')
          .in('assign_name', memberNames)
          .gte('created_at', yearStart)
          .lte('created_at', effectiveEnd + 'T23:59:59'),
        // Activity logs untuk response time (first response per ticket)
        supabase.from('activity_logs')
          .select('id,ticket_id,handler_name,created_at')
          .in('handler_name', memberNames)
          .gte('created_at', yearStart)
          .lte('created_at', effectiveEnd + 'T23:59:59')
          .order('created_at', { ascending: true }),
        supabase.from('reminders')
          .select('id,assign_name,status,due_date,updated_at')
          .in('assign_name', memberNames)
          .gte('created_at', yearStart)
          .lte('created_at', effectiveEnd + 'T23:59:59'),
        supabase.from('lc_quiz_attempts')
          .select('id,user_id,score,passed,is_submitted')
          .in('user_id', memberIds)
          .eq('is_submitted', true)
          .gte('started_at', yearStart)
          .lte('started_at', effectiveEnd + 'T23:59:59'),
        supabase.from('piket_schedules')
          .select('pic_ivp_name,pic_ump_name,pic_mlds_name,day_date')
          .gte('day_date', yearStart)
          .lte('day_date', effectiveEnd),
        // Form Review: hanya yang sudah diisi rating oleh sales (grade_product_knowledge_bast NOT NULL)
        supabase.from('form_reviews')
          .select('id,assign_name,grade_product_knowledge,grade_training_customer,grade_product_knowledge_bast,created_at')
          .in('assign_name', memberNames)
          .gte('created_at', yearStart)
          .lte('created_at', effectiveEnd + 'T23:59:59')
          .not('grade_product_knowledge_bast', 'is', null),
        // Manual KPI values stored in kpi_manual_values table (jika ada)
        supabase.from('kpi_manual_values')
          .select('*')
          .in('user_id', memberIds)
          .eq('year', year),
        // Tech Notes approved (otomatis dari platform tech-note)
        supabase.from('tech_notes')
          .select('id,author_id,status,reviewed_at')
          .in('author_id', memberIds)
          .eq('status', 'approved')
          .gte('reviewed_at', yearStart)
          .lte('reviewed_at', effectiveEnd + 'T23:59:59'),
      ]);

      const tickets = (ticketsRes.data ?? []) as any[];
      const actLogs = (actLogsRes.data ?? []) as any[];
      const reminders = (remindersRes.data ?? []) as any[];
      const lcAttempts = (lcAttemptsRes.data ?? []) as any[];
      const piketSchedules = (piketRes.data ?? []) as any[];
      const formReviews = (formReviewRes.data ?? []) as any[];
      const manualValues = (manualRes.data ?? []) as any[];
      const techNotesAll = (techNotesRes.data ?? []) as any[];
      const todayStr2 = new Date().toISOString().split('T')[0];

      // Build member KPI
      const members: KPITeamMember[] = membersData.map((m: any) => {
        const name = m.full_name as string;
        const uid = m.id as string;

        // Tickets
        const myTickets = tickets.filter((t: any) => t.assign_name === name);
        const tSolved = myTickets.filter((t: any) => t.status === 'Solved');
        const tOverdue = myTickets.filter((t: any) => t.status !== 'Solved' && t.status !== 'Cancelled' && t.date && t.date < todayStr2);
        const tDays = tSolved.reduce((acc: number, t: any) => {
          const d = (new Date(t.date).getTime() - new Date(t.created_at).getTime()) / 86400000;
          return acc + Math.max(0, d);
        }, 0);
        const avgRes = tSolved.length ? Math.round(tDays / tSolved.length) : 0;

        // Reminders
        const myRem = reminders.filter((r: any) => r.assign_name === name);
        const remDone = myRem.filter((r: any) => r.status === 'done').length;
        const remOver = myRem.filter((r: any) => r.status === 'pending' && r.due_date && r.due_date < todayStr2).length;

        // LC
        const myLC = lcAttempts.filter((a: any) => a.user_id === uid);
        const lcScores = myLC.filter((a: any) => a.score != null).map((a: any) => a.score as number);
        const lcAvg = lcScores.length ? Math.round(lcScores.reduce((a: number, b: number) => a + b, 0) / lcScores.length) : 0;
        const lcFailedBelow75 = myLC.filter((a: any) => a.score != null && a.score < 70).length;
        // Piket: count days where this member is assigned
        const tt = m.team_type as string;
        const picCol = tt === 'Team PTS' ? 'pic_ivp_name' : tt === 'Team PTS UMP' ? 'pic_ump_name' : 'pic_mlds_name';
        const piketFilled = piketSchedules.filter((p: any) => p[picCol] === name).length;

        // Ticket response time: avg jam dari ticket created → first activity_log per ticket
        const myTicketIds = new Set(myTickets.map((t: any) => t.id as string));
        const firstActPerTicket: Record<string, string> = {};
        actLogs.filter((a: any) => myTicketIds.has(a.ticket_id) && a.handler_name === name).forEach((a: any) => {
          if (!firstActPerTicket[a.ticket_id]) firstActPerTicket[a.ticket_id] = a.created_at;
        });
        const responseTimes = myTickets.filter((t: any) => firstActPerTicket[t.id]).map((t: any) => {
          const h = (new Date(firstActPerTicket[t.id]).getTime() - new Date(t.created_at).getTime()) / 3600000;
          return Math.max(0, h);
        });
        const ticketAvgResponseHours = responseTimes.length ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length) : 0;

        // Form Review: low rating (bintang < 3) per assign_name
        const myReviews = formReviews.filter((r: any) => r.assign_name === name);
        const formReviewTotal = myReviews.length;
        const formReviewLowRating = myReviews.filter((r: any) => {
          const g1 = r.grade_product_knowledge ?? 5;
          const g2 = r.grade_training_customer ?? 5;
          const g3 = r.grade_product_knowledge_bast ?? 5;
          return g1 < 3 || g2 < 3 || g3 < 3;
        }).length;

        // Manual KPI values (from DB or defaults)
        const saved = manualValues.find((v: any) => v.user_id === uid);
        const manual = {
          komplainCount: saved?.komplain_count ?? 0,
          responTime: saved?.respon_time ?? 12,
          bastDemo: saved?.bast_demo ?? 0,
          bastDemoTotal: saved?.bast_demo_total ?? 0,
          reportBulanan: saved?.report_bulanan ?? 0,
          learningMastery: saved?.learning_mastery ?? 0,
        };

        // Tech Notes approved (otomatis dari platform, target 2/tahun)
        const techNotesApproved = techNotesAll.filter((tn: any) => tn.author_id === uid).length;

        // Monthly sparkline: tickets handled per month (12 months of filterYear)
        const monthlyTickets = Array.from({length:12},(_,mi)=>
          myTickets.filter((t:any)=>{ const d=new Date(t.created_at); return d.getMonth()===mi; }).length
        );
        const monthlyLC = Array.from({length:12},(_,mi)=>
          myLC.filter((a:any)=>{ const d=new Date(a.started_at||''); return !isNaN(d.getTime())&&d.getMonth()===mi; }).length
        );

        return {
          id: uid, name, team_type: m.team_type ?? '', jabatan: m.jabatan ?? '',
          ticketsHandled: myTickets.length, ticketsSolved: tSolved.length, ticketsOverdue: tOverdue.length, avgResolutionDays: avgRes,
          remindersAssigned: myRem.length, remindersDone: remDone, remindersOverdue: remOver,
          lcAttempts: myLC.length, lcAvgScore: lcAvg, lcPassed: myLC.filter((a: any) => a.passed === true).length,
          lcFailedBelow75,
          lcScores: lcScores,
          piketFilled, ticketAvgResponseHours, formReviewLowRating, formReviewTotal,
          techNotesApproved,
          monthlyTickets, monthlyLC,
          manual,
        };
      });

      setKpiTeam(prev => ({ ...prev, members, loading: false }));
    } catch (e) { console.error('KPI Team fetch error:', e); setKpiTeam(prev => ({ ...prev, loading: false })); }
  }, [scope, scopeReady, kpiTeam.filterYear, kpiTeam.filterPeriod, kpiTeam.filterStartMonth]);

  // ── 5. Fetch KPI Period Snapshots ────────────────────────────────────────

  const fetchKPISnapshots = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') return;
    try {
      let q = supabase.from('kpi_period_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (scope.kind === 'pts_sup') {
        q = q.eq('team_type', scope.ptsTeamType ?? '');
      }
      const { data } = await q;
      if (data) setKpiSnapshots(data as KPIPeriodSnapshot[]);
    } catch (e) { console.error('fetchKPISnapshots error:', e); }
  }, [scope, scopeReady]);

  // ── Save KPI Snapshot ─────────────────────────────────────────────────────

  const saveKPISnapshot = useCallback(async () => {
    if (!kpiTeam.members.length) return;
    setSavingSnapshot(true);
    try {
      const _s = kpiSettings;
      const year = kpiTeam.filterYear;
      const period = kpiTeam.filterPeriod;
      const startMonth = kpiTeam.filterStartMonth; // ← satu sumber kebenaran
      const monthCount = period === '6m' ? 6 : 12;
      const endMonth = Math.min(startMonth + monthCount - 1, 12);
      const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
      const periodLabel = `${MONTH_NAMES[startMonth-1]}–${MONTH_NAMES[endMonth-1]} ${year}`;
      const teamType = scope.kind === 'pts_sup'
        ? (scope.ptsTeamType ?? 'all')
        : 'all';

      const membersJson = kpiTeam.members.map(m => {
        const lcFailedDyn = (m.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
        const tickScore = m.ticketsHandled > 0 ? Math.max(0, 1 - m.ticketsOverdue / Math.max(m.ticketsHandled,1)) : 0;
        const bastScore = m.formReviewTotal === 0 ? 0
          : m.formReviewLowRating === 0 ? 1
          : Math.max(0, 1 - m.formReviewLowRating / Math.max(m.formReviewTotal,1));
        const lcScore = m.lcAttempts === 0 ? 0 : Math.max(0, 1 - (lcFailedDyn / Math.max(m.lcAttempts,1)));
        const rndScore = m.techNotesApproved >= _s.rndTarget ? 1 : m.techNotesApproved / Math.max(_s.rndTarget,1);
        const finalKPI = Math.round((_s.ticketOverdueWeight*tickScore + _s.bastWeight*bastScore + _s.lcWeight*lcScore + _s.rndWeight*rndScore) * 100);
        return {
          id: m.id, name: m.name, jabatan: m.jabatan, team_type: m.team_type,
          ticketsHandled: m.ticketsHandled, ticketsSolved: m.ticketsSolved, ticketsOverdue: m.ticketsOverdue,
          lcAttempts: m.lcAttempts, lcAvgScore: m.lcAvgScore, lcPassed: m.lcPassed,
          formReviewTotal: m.formReviewTotal, formReviewLowRating: m.formReviewLowRating,
          techNotesApproved: m.techNotesApproved,
          tickScore: Math.round(tickScore*100), bastScore: Math.round(bastScore*100),
          lcScore: Math.round(lcScore*100), rndScore: Math.round(rndScore*100),
          finalKPI,
        };
      });

      await supabase.from('kpi_period_snapshots').insert({
        period_label: periodLabel,
        year,
        period,
        start_month: startMonth,
        end_month: endMonth,
        team_type: teamType,
        created_by: currentUser.full_name,
        members_json: membersJson,
        settings_json: _s,
      });

      await fetchKPISnapshots();
      setShowStartKPI(false);
    } catch (e) { console.error('saveKPISnapshot error:', e); }
    finally { setSavingSnapshot(false); }
  }, [kpiTeam, kpiSettings, scope, currentUser, fetchKPISnapshots]);



  useEffect(() => {
    if (!scopeReady) return;
    fetchKPI(); fetchAudit();
    intervalRef.current = setInterval(() => { fetchKPI(); fetchAudit(); setLastRefresh(new Date()); }, 3*60*1000);
  }, [scopeReady, fetchKPI, fetchAudit]);

  useEffect(() => {
    if (tab === 'kpi_team' && scopeReady) fetchKPITeam();
    if ((tab === 'kpi_team' || tab === 'history') && scopeReady) fetchKPISnapshots();
    // For team scope: auto-fetch their own KPI on load
    if (scope.kind === 'team' && scopeReady) fetchKPITeam();
    return () => { if(intervalRef.current) clearInterval(intervalRef.current); };
  }, [tab, scopeReady, fetchKPITeam, fetchKPISnapshots, scope.kind]);

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
    {key:'kpi_team'  as const, icon:'👥', label:'KPI Team'},
    ...(scope.kind !== 'team' ? [{key:'history' as const, icon:'📋', label:'Riwayat KPI'}] : []),
    {key:'cross'     as const, icon:'🔀', label:'Cross-Module'},
    {key:'audit'     as const, icon:'🔍', label:'Audit Trail'},
  ];

  // ─── LC-style design helpers ────────────────────────────────────────────────
  function SectionPill({ icon, children }: { icon: string; children: React.ReactNode }) {
    return (
      <h3 className="text-sm font-bold uppercase tracking-widest mb-4 inline-flex items-center gap-1.5 bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm border border-slate-200">
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
            <button onClick={()=>{ setLoading(true); setAuditLoading(true); fetchKPI(); fetchAudit(); if(scope.kind==='team')fetchKPITeam(); setLastRefresh(new Date()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 transition-all">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Sync
            </button>
            {/* Tab pills */}
            <nav className="flex items-center gap-1">
              {TAB_CONFIG.map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-all
                    ${tab===t.key ? 'text-blue-700 border-blue-600 bg-blue-50/60 font-semibold' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}>
                  <span className="text-sm">{t.icon}</span>{t.label}
                </button>
              ))}
            </nav>
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-3">
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-3">
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-3">
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-3">
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
                        ]} label=""/>
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-3">
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


          {/* ══════════ TAB KPI TEAM ══════════ */}
          {tab==='kpi_team' && (scope.kind==='admin' || scope.kind==='pts_sup' || scope.kind==='team') && (
            <div className="space-y-4">
              {/* Header + filter */}
              <div className="flex flex-wrap items-center gap-3">
                <SectionPill icon="👥">KPI Team {scope.kind==='pts_sup'?scope.ptsTeamType:scope.kind==='team'?currentUser.team_type??'':'PTS IVP & MLDS'}</SectionPill>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* Filter Periode — hidden for regular team members */}
                  {scope.kind !== 'team' && (() => {
                    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
                    const startM = kpiTeam.filterStartMonth;
                    const duration = kpiTeam.filterPeriod === '6m' ? 6 : 12;
                    const endM = Math.min(startM + duration - 1, 12);
                    const periodLabel = `${MONTHS_SHORT[startM-1]}–${MONTHS_SHORT[endM-1]} ${kpiTeam.filterYear}`;
                    return (
                      <>
                      {/* Durasi toggle */}
                      <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden bg-white">
                        {(['6m','1y'] as const).map(p=>(
                          <button key={p}
                            onClick={()=>{
                              const newDuration = p === '6m' ? 6 : 12;
                              // Jika ganti ke 1y, start bulan otomatis Jan
                              // Jika ganti ke 6m, start bulan otomatis ke semester saat ini
                              const newStart = p === '1y' ? 1 : (kpiTeam.filterStartMonth <= 6 ? 1 : 7);
                              setKpiTeam(prev=>({...prev, filterPeriod:p, filterStartMonth:newStart}));
                            }}
                            className={`px-3 py-1.5 text-sm font-bold transition-all ${kpiTeam.filterPeriod===p?'bg-blue-600 text-white':'text-slate-500 hover:bg-slate-50'}`}>
                            {p==='6m'?'6 Bulan':'1 Tahun'}
                          </button>
                        ))}
                      </div>
                      {/* Bulan mulai — hanya tampil kalau 6 bulan */}
                      {kpiTeam.filterPeriod === '6m' && (
                        <select
                          value={kpiTeam.filterStartMonth}
                          onChange={e => setKpiTeam(prev=>({...prev, filterStartMonth:Number(e.target.value)}))}
                          className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:border-blue-300"
                        >
                          {[{v:1,l:'Jan – Jun'},{v:2,l:'Feb – Jul'},{v:3,l:'Mar – Agt'},{v:4,l:'Apr – Sep'},{v:5,l:'Mei – Okt'},{v:6,l:'Jun – Nov'},{v:7,l:'Jul – Des'}].map(o=>(
                            <option key={o.v} value={o.v}>{o.l}</option>
                          ))}
                        </select>
                      )}
                      {/* Tahun */}
                      <select
                        value={kpiTeam.filterYear}
                        onChange={e => setKpiTeam(prev=>({...prev, filterYear:Number(e.target.value)}))}
                        className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:border-blue-300"
                      >
                        {[2024,2025,2026,2027].map(y=>(<option key={y} value={y}>{y}</option>))}
                      </select>
                      {/* Periode badge aktif */}
                      <span className="text-sm font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                        📅 {periodLabel}
                      </span>
                      <button
                        onClick={()=>fetchKPITeam()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Refresh
                      </button>
                  <button
                    onClick={()=>setShowSettings(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-violet-600 hover:text-white hover:bg-violet-600 bg-white border border-violet-200 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    Pengaturan KPI
                  </button>
                  {/* ── Mulai KPI (Snapshot) ── */}
                  <button
                    onClick={() => setShowStartKPI(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-rose-600 hover:text-white hover:bg-rose-600 bg-white border border-rose-200 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                    Mulai KPI {kpiTeam.filterYear}
                  </button>
                  {/* Download Excel per orang — format corporate seperti Formulir KPI */}
                  <button
                    onClick={async () => {
                      const allMembers = kpiTeam.members;
                      if (!allMembers.length) return;

                      // ── load SheetJS from CDN ──
                      const XLSX_MOD: any = await new Promise((resolve, reject) => {
                        if ((window as any).XLSX) { resolve((window as any).XLSX); return; }
                        const s = document.createElement('script');
                        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                        s.onload = () => resolve((window as any).XLSX);
                        s.onerror = reject;
                        document.head.appendChild(s);
                      });

                      const pm = kpiTeam.filterPeriod === '6m' ? 0.5 : 1;
                      const rndTarget = 2;
                      const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','Sept','Okt','Nov','Des'];

                      const calcScores = (m: KPITeamMember) => {
                        const _s = kpiSettings;
                        const lcFailedDyn = (m.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
                        const tickS = m.ticketsHandled > 0 ? Math.max(0, 1 - m.ticketsOverdue / Math.max(m.ticketsHandled,1)) : 0;
                        const bastS = m.formReviewTotal === 0 ? 0 : m.formReviewLowRating === 0 ? 1 : Math.max(0, 1 - m.formReviewLowRating / Math.max(m.formReviewTotal,1));
                        const lcS   = m.lcAttempts === 0 ? 0 : Math.max(0, 1 - lcFailedDyn / Math.max(m.lcAttempts,1));
                        const rndS  = _s.rndTarget > 0 ? Math.min(1, m.techNotesApproved / _s.rndTarget) : 0;
                        const final = Math.round((_s.ticketOverdueWeight*tickS + _s.bastWeight*bastS + _s.lcWeight*lcS + _s.rndWeight*rndS) * 100);
                        const noData = m.ticketsHandled === 0 && m.lcAttempts === 0 && m.techNotesApproved === 0;
                        const label = noData ? 'Belum Ada Data' : final>=85?'Excellent':final>=70?'Good':final>=50?'Fair':'Needs Work';
                        return { tickS, bastS, lcS, rndS, final, noData, label };
                      };

                      for (let mi = 0; mi < allMembers.length; mi++) {
                        const m = allMembers[mi];
                        const s = calcScores(m);
                        const team = m.team_type.replace('Team PTS ','').replace('Team PTS','IVP');
                        const year = kpiTeam.filterYear;
                        const MNX = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
                        const smX = kpiTeam.filterStartMonth;
                        const emX = Math.min(smX + (kpiTeam.filterPeriod === '6m' ? 5 : 11), 12);
                        const periodStrX = `${MNX[smX-1]}–${MNX[emX-1]} ${year}`;

                        const wb = XLSX_MOD.utils.book_new();
                        const wsName = ('KPI ' + m.name).substring(0, 31);
                        const aoa: (string|number|null)[][] = [];

                        // Row 1 — Company
                        aoa.push(['INDOVISUAL GROUP', null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'No','']);
                        // Row 2 — Form title
                        aoa.push(['FORMULIR MONITORING KEY PERFORMANCE INDICATOR', null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'Dokumen :','']);
                        // Row 3-5 — Identity
                        aoa.push([`Nama              : ${m.name}`,null,null,null,null,null,null,null,null,null,null,null,null,'Divisi',':', team,null,null,null,'Developed by :','']);
                        aoa.push([`No. Karyawan   : —`,null,null,null,null,null,null,null,null,null,null,null,null,'Department',':', 'Indovisual',null,null,null,'Initial by :','']);
                        aoa.push([`Periode Penilaian : ${periodStrX}`,null,null,null,null,null,null,null,null,null,null,null,null,'Level / Posisi',':', m.jabatan,null,null,null,'','']);
                        // Row 6 — Col headers
                        aoa.push(['Sasaran','Indikator Kinerja','Sumber Data','Periode Isla\nRata2/Total','TARGET\nRata2/Total','', `${MNX[smX-1]} — ${MNX[emX-1]} ${year}`,null,null,null,null,null,null,null,null,null,null,null,null,'BOBOT','Nilai\nAkhir']);
                        // Row 7 — Month names
                        aoa.push([null,null,null,null,null,...([''].concat(MONTHS)), null,'Rata2/Total',null,null]);

                        // Helper — push 3 sub-rows for a KPI component
                        const pushRows = (
                          sasaran: string, indikator: string, sumber: string,
                          target: string, bobot: string, nilaiNum: number,
                          aktualMonths: number[], aktualTot: number|string,
                          pctVal: number
                        ) => {
                          const pct = pctVal / 100;
                          const aktualRow: (string|number|null)[] = [sasaran, indikator, sumber, 'Rata2/Total', target, 'Target',
                            0,0,0,0,0,0,0,0,0,0,0,0, 0, bobot, nilaiNum];
                          const targetRow: (string|number|null)[] = [null,null,null,null,null,'Aktual',
                            ...aktualMonths, aktualTot, null, null];
                          const pctRow: (string|number|null)[] = [null,null,null,null,null,'% Pencapaian',
                            pct,pct,pct,pct,pct,pct,pct,pct,pct,pct,pct,pct, pct, null, null];
                          aoa.push(aktualRow);
                          aoa.push(targetRow);
                          aoa.push(pctRow);
                        };

                        // ── Section: Customer Perspective ──
                        aoa.push(['Customer Perspective',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]);
                        pushRows(
                          'Technical knowledge\n(Troubleshooting Platform)',
                          'Jumlah komplain terhadap produk & service',
                          'Formulir complain/ Email/ WA',
                          'max 12 komplain sampai dengan Des',
                          '15%', Math.round(s.tickS * 0.15 * 100),
                          [0,0,0,0,0,0,0,0,0,0,0,0], m.ticketsOverdue,
                          Math.round(s.tickS * 100)
                        );
                        pushRows(
                          '',
                          'Kecepatan respon terhadap komplain perbulan',
                          'Formulir complain/ Email/ WA',
                          'max respon time 1x24 jam setelah form/email/ WA masuk',
                          '10%', 10,
                          [1,1,1,1,1,1,1,1,1,1,1,1], 1,
                          100
                        );

                        // ── Section: Internal process ──
                        aoa.push(['Internal process Perspective',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]);
                        pushRows(
                          'Technical knowledge\n(Learning Center Platform)',
                          'Menguasai seluruh teknikal produk & software Produk yang di jual/ akan dijual oleh Perusahaan',
                          'Form penilaian dari Atasan',
                          '100% pengetahuan dikuasai dalam 12 kategori sampai dengan Des 2025',
                          '35%', Math.round(s.lcS * 0.35 * 100),
                          [1,1,1,1,1,1,1,1,1,1,1,1], m.lcPassed,
                          Math.round(s.lcS * 100)
                        );
                        pushRows(
                          'Implementasi Project\n(Form Review BAST dan Demo Product)',
                          'Memastikan item-item/ system yang terpasang sesuai dengan Load Schedule yang ada.',
                          'Load Schedule dan form Demo / BAST yang sudah di TTD Sales',
                          'Maksimal 7 hari Setelah Project Selesai',
                          '20%', Math.round(s.bastS * 0.20 * 100),
                          [1,1,1,1,1,1,1,1,1,1,1,1], s.bastS >= 1 ? 1 : 0,
                          Math.round(s.bastS * 100)
                        );
                        const rndActMonths = Array.from({length:12},(_,i)=>i<m.techNotesApproved?1:0);
                        pushRows(
                          'Penelitian & Development\n(Menyerahkan Technote)',
                          'Melakukan R&D dan menerbitkan technical note terhadap produk inovasinya.',
                          'Technical Note yang diterbitkan setiap bulannya',
                          'Minimal 1 technical note setiap bulannya',
                          '15%', Math.round(s.rndS * 0.15 * 100),
                          rndActMonths, m.techNotesApproved,
                          Math.round(s.rndS * 100)
                        );
                        pushRows(
                          'Pelaporan Report harian',
                          'Penyerahan Laporan Bulanan Tepat waktu',
                          'Laporan Bulanan yg sudah di check Atasan',
                          'Maksimal Tgl 1 report stiap bln nya',
                          '5%', 5,
                          [1,1,1,1,1,1,1,1,1,1,1,1], 1,
                          100
                        );

                        // Total row
                        aoa.push([null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'100.0%', `${s.final}%`]);
                        aoa.push([null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,`Status: ${s.label}`,null]);

                        // Note
                        aoa.push(['Catatan Insiden Penting : (catatan dapat dibuat dikertas terpisah sebagai lampiran, dilengkapi keterangan tanggal)',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]);
                        for (let i=0;i<3;i++) aoa.push([null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]);
                        aoa.push([null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]);

                        // Signatures
                        aoa.push(['Dibuat oleh,',null,null,null,null,null,null,'Diperiksa oleh atasan langsung',null,null,null,null,null,null,'Disetujui oleh atasan berikutnya',null,null,null,null,null,null]);
                        for (let i=0;i<4;i++) aoa.push([null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]);
                        aoa.push([m.name,null,null,null,null,null,null,'Dhany Wahyu Perdana',null,null,null,null,null,null,'Jony',null,null,null,null,null,null]);
                        aoa.push(['Tanggal',null,null,null,null,null,null,'Tanggal',null,null,null,null,null,null,'Tanggal',null,null,null,null,null,null]);

                        const ws2 = XLSX_MOD.utils.aoa_to_sheet(aoa);

                        // ── Column widths ──
                        ws2['!cols'] = [
                          {wch:28},{wch:32},{wch:22},{wch:11},{wch:18},{wch:11},
                          {wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},
                          {wch:8},{wch:8},{wch:8},{wch:8},{wch:8},{wch:8},
                          {wch:10},{wch:9},{wch:10},
                        ];

                        // ── Merges ──
                        const M = (r1:number,c1:number,r2:number,c2:number) => ({s:{r:r1,c:c1},e:{r:r2,c:c2}});
                        ws2['!merges'] = [
                          M(0,0,0,18), // Row1 company
                          M(1,0,1,18), // Row2 form title
                          M(2,0,2,6),  M(3,0,3,6),  M(4,0,4,6),   // Identity left
                          M(2,15,2,18),M(3,15,3,18),M(4,15,4,18), // Identity right val
                          M(5,0,6,0),  M(5,1,6,1),  M(5,2,6,2),   // Header row spans
                          M(5,3,6,3),  M(5,4,6,4),  M(5,5,6,5),
                          M(5,6,5,17), // Jan-Dec header
                          M(5,18,6,18),M(5,19,6,19),M(5,20,6,20),
                        ];

                        // Format % cells in data rows (rows 8 onwards, cols 6-18 & 18 for pct rows)
                        // SheetJS basic: just set sheet with data
                        XLSX_MOD.utils.book_append_sheet(wb, ws2, wsName);

                        const wbOut = XLSX_MOD.write(wb, { bookType:'xlsx', type:'array' });
                        const blob = new Blob([wbOut], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const nameSafe = m.name.replace(/[^a-zA-Z0-9]/g,'_');
                        a.download = `KPI_${nameSafe}_${year}_${kpiTeam.filterPeriod}.xlsx`;
                        a.click();
                        URL.revokeObjectURL(url);
                        await new Promise(res => setTimeout(res, 500));
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-600 hover:text-white hover:bg-emerald-600 bg-white border border-emerald-200 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Excel {kpiTeam.filterYear} ({kpiTeam.filterPeriod==='6m'?'6bln':'1thn'})
                  </button>

                  {/* ── Export Summary Gabungan ── */}
                  <button
                    onClick={async () => {
                      const allMembers = kpiTeam.members;
                      if (!allMembers.length) return;
                      const XLSX_MOD: any = await new Promise((resolve, reject) => {
                        if ((window as any).XLSX) { resolve((window as any).XLSX); return; }
                        const s = document.createElement('script');
                        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                        s.onload = () => resolve((window as any).XLSX);
                        s.onerror = reject;
                        document.head.appendChild(s);
                      });
                      const year = kpiTeam.filterYear;
                      const pm = kpiTeam.filterPeriod === '6m' ? 0.5 : 1;
                      const rndTarget = 2;
                      const wb = XLSX_MOD.utils.book_new();
                      const MN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
                      const sm = kpiTeam.filterStartMonth;
                      const em = Math.min(sm + (kpiTeam.filterPeriod === '6m' ? 5 : 11), 12);
                      const periodStr = `${MN[sm-1]}–${MN[em-1]} ${year}`;

                      // ── Sheet 1: Rekap Tim ──
                      const summaryAoa: (string|number|null)[][] = [
                        ['REKAP KPI TIM PTS — INDOVISUAL GROUP', null, null, null, null, null, null, null, null],
                        [`Tahun: ${year}  |  Periode: ${periodStr}  |  Durasi: ${kpiTeam.filterPeriod==='6m'?'6 Bulan':'1 Tahun'}`, null, null, null, null, null, null, null, null],
                        [],
                        ['No','Nama','Tim','Jabatan','Ticket Handled','Ticket Overdue','LC Attempts','LC Avg Score','Low Rating BAST','Tech Note','Skor KPI (%)','Predikat'],
                      ];
                      allMembers.forEach((m, idx) => {
                        const _s = kpiSettings;
                        const lcFailedDyn = (m.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
                        const tickS = m.ticketsHandled > 0 ? Math.max(0, 1 - m.ticketsOverdue / Math.max(m.ticketsHandled,1)) : 0;
                        const bastS = m.formReviewTotal === 0 ? 0 : m.formReviewLowRating === 0 ? 1 : Math.max(0, 1 - m.formReviewLowRating / Math.max(m.formReviewTotal,1));
                        const lcS   = m.lcAttempts === 0 ? 0 : Math.max(0, 1 - lcFailedDyn / Math.max(m.lcAttempts,1));
                        const rndS  = m.techNotesApproved >= _s.rndTarget ? 1 : m.techNotesApproved / _s.rndTarget;
                        const final = Math.round((_s.ticketOverdueWeight*tickS + _s.bastWeight*bastS + _s.lcWeight*lcS + _s.rndWeight*rndS) * 100);
                        const noData = m.ticketsHandled===0&&m.lcAttempts===0&&m.techNotesApproved===0;
                        const label = noData?'Belum Ada Data':final>=85?'Excellent':final>=70?'Good':final>=50?'Fair':'Needs Work';
                        summaryAoa.push([
                          idx+1, m.name, m.team_type.replace('Team PTS ','').replace('Team PTS','IVP'),
                          m.jabatan, m.ticketsHandled, m.ticketsOverdue,
                          m.lcAttempts, m.lcAvgScore, m.formReviewLowRating,
                          m.techNotesApproved, noData ? 0 : final, label,
                        ]);
                      });
                      summaryAoa.push([]);
                      summaryAoa.push(['','','','','','','','','','','TOTAL ANGGOTA',allMembers.length]);
                      const avgFinal = allMembers.length
                        ? Math.round(allMembers.reduce((sum, m) => {
                            const _s = kpiSettings;
                            const lcFailedDyn = (m.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
                            const tickS = m.ticketsHandled>0?Math.max(0,1-m.ticketsOverdue/Math.max(m.ticketsHandled,1)):0;
                            const bastS = m.formReviewTotal===0?0:m.formReviewLowRating===0?1:Math.max(0,1-m.formReviewLowRating/Math.max(m.formReviewTotal,1));
                            const lcS   = m.lcAttempts===0?0:Math.max(0,1-(lcFailedDyn/Math.max(m.lcAttempts,1)));
                            const rndS  = m.techNotesApproved>=_s.rndTarget?1:m.techNotesApproved/_s.rndTarget;
                            return sum + Math.round((_s.ticketOverdueWeight*tickS + _s.bastWeight*bastS + _s.lcWeight*lcS + _s.rndWeight*rndS) * 100);
                          }, 0) / allMembers.length)
                        : 0;
                      summaryAoa.push(['','','','','','','','','','','RATA-RATA KPI', `${avgFinal}%`]);
                      const wsSummary = XLSX_MOD.utils.aoa_to_sheet(summaryAoa);
                      wsSummary['!cols'] = [{wch:5},{wch:28},{wch:14},{wch:20},{wch:9},{wch:14},{wch:12},{wch:13},{wch:15},{wch:10},{wch:12},{wch:14}];
                      XLSX_MOD.utils.book_append_sheet(wb, wsSummary, 'Rekap Tim');

                      // ── Sheet 2: Detail per tim (IVP vs MLDS) ──
                      const teams: Record<string, typeof allMembers[0][]> = {};
                      allMembers.forEach(m => {
                        const k = m.team_type;
                        if (!teams[k]) teams[k] = [];
                        teams[k].push(m);
                      });
                      Object.entries(teams).forEach(([teamName, tMembers]) => {
                        const sheetName = ('Detail ' + teamName.replace('Team PTS ','').replace('Team PTS','IVP')).substring(0,31);
                        const aoa: (string|number|null)[][] = [
                          [`Detail KPI — ${teamName} — ${year}`, null, null, null, null, null],
                          [],
                          ['Nama','Jabatan','Ticket Handled','Solved','Overdue','Avg Res (hr)','Reminder Done','LC Attempts','LC Avg','Piket','Technote','Skor KPI'],
                        ];
                        tMembers.forEach(m => {
                          const _s = kpiSettings;
                          const lcFailedDyn = (m.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
                          const tickS = m.ticketsHandled>0?Math.max(0,1-m.ticketsOverdue/Math.max(m.ticketsHandled,1)):0;
                          const bastS = m.formReviewTotal===0?0:m.formReviewLowRating===0?1:Math.max(0,1-m.formReviewLowRating/Math.max(m.formReviewTotal,1));
                          const lcS   = m.lcAttempts===0?0:Math.max(0,1-(lcFailedDyn/Math.max(m.lcAttempts,1)));
                          const rndS  = m.techNotesApproved>=_s.rndTarget?1:m.techNotesApproved/_s.rndTarget;
                          const final = Math.round((_s.ticketOverdueWeight*tickS + _s.bastWeight*bastS + _s.lcWeight*lcS + _s.rndWeight*rndS) * 100);
                          aoa.push([m.name, m.jabatan, m.ticketsHandled, m.ticketsSolved, m.ticketsOverdue, m.avgResolutionDays, m.remindersDone, m.lcAttempts, m.lcAvgScore, m.piketFilled, m.techNotesApproved, final]);
                        });
                        const ws = XLSX_MOD.utils.aoa_to_sheet(aoa);
                        ws['!cols'] = [{wch:28},{wch:20},{wch:14},{wch:9},{wch:9},{wch:12},{wch:14},{wch:12},{wch:9},{wch:9},{wch:10},{wch:10}];
                        XLSX_MOD.utils.book_append_sheet(wb, ws, sheetName);
                      });

                      const wbOut = XLSX_MOD.write(wb, { bookType:'xlsx', type:'array' });
                      const blob = new Blob([wbOut], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `KPI_Summary_Tim_${year}_${kpiTeam.filterPeriod}.xlsx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-blue-600 hover:text-white hover:bg-blue-600 bg-white border border-blue-200 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Rekap Tim {kpiTeam.filterYear}
                  </button>
                  </>);
                  })()} {/* end scope.kind !== 'team' */}
                </div>
              </div>

              {/* Legend */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 leading-relaxed">
                <b>📌 Keterangan:</b> Data ✅ otomatis dari platform.
                <span className="ml-2 font-semibold">🎫 Ticketing {Math.round(kpiSettings.ticketOverdueWeight*100)}%</span> (nilai penuh jika 0 overdue),
                <span className="ml-1 font-semibold">⭐ BAST &amp; Demo {Math.round(kpiSettings.bastWeight*100)}%</span> (nilai penuh jika tidak ada komplain/bintang &lt;3),
                <span className="ml-1 font-semibold">🎓 Learning Center {Math.round(kpiSettings.lcWeight*100)}%</span> (nilai penuh jika tidak ada nilai &lt;{kpiSettings.lcMinScore}),
                <span className="ml-1 font-semibold">📝 R&amp;D Tech Note {Math.round(kpiSettings.rndWeight*100)}%</span> (nilai penuh jika ≥{kpiSettings.rndTarget} approved/tahun).
                Klik kartu untuk detail &amp; edit.
              </div>

              {/* Loading */}
              {kpiTeam.loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-7 h-7 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"/>
                </div>
              )}

              {/* No data */}
              {!kpiTeam.loading && kpiTeam.members.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">Tidak ada anggota team ditemukan untuk scope ini.</div>
              )}

              {/* ── Team PTS IVP ── */}
              {!kpiTeam.loading && (() => {
                const ivpMembers = kpiTeam.members.filter(m => m.team_type === 'Team PTS');
                const mldsMembers = kpiTeam.members.filter(m => m.team_type === 'Team PTS MLDS');
                const umpMembers = kpiTeam.members.filter(m => m.team_type === 'Team PTS UMP');
                const calcKPI = (member: KPITeamMember) => {
                  const s = kpiSettings;
                  // Helper: hitung jumlah LC score di bawah lcMinScore secara dinamis
                  const lcFailedDyn = (member.lcScores ?? []).filter((sc: number) => sc < s.lcMinScore).length;
                  // Ticketing 20%: nilai penuh jika 0 overdue. Jika belum ada ticket = 0
                  const tickScore = member.ticketsHandled > 0
                    ? Math.max(0, 1 - member.ticketsOverdue / Math.max(member.ticketsHandled, 1))
                    : 0;
                  // BAST & Demo: nilai penuh jika tidak ada komplain (bintang <3). Jika Sales belum submit review = 0
                  const bastScore = member.formReviewTotal === 0
                    ? 0  // belum ada review dari sales → belum dihitung
                    : member.formReviewLowRating === 0
                      ? 1
                      : Math.max(0, 1 - member.formReviewLowRating / Math.max(member.formReviewTotal, 1));
                  // Learning Center: nilai penuh jika tidak ada nilai < lcMinScore (dinamis dari settings)
                  const lcScore = member.lcAttempts === 0
                    ? 0
                    : Math.max(0, 1 - (lcFailedDyn / Math.max(member.lcAttempts, 1)));
                  // R&D Tech Note: nilai penuh jika >= rndTarget approved
                  const rndScore = member.techNotesApproved >= s.rndTarget ? 1 : member.techNotesApproved / Math.max(s.rndTarget, 1);
                  return Math.round((s.ticketOverdueWeight*tickScore + s.bastWeight*bastScore + s.lcWeight*lcScore + s.rndWeight*rndScore) * 100);
                };
                // ── Compact horizontal member chip ───────────────────────
                  const MemberChip = ({ member }: { member: KPITeamMember }) => {
                  const finalKPI = calcKPI(member);
                  const noData   = member.ticketsHandled===0 && member.lcAttempts===0 && member.techNotesApproved===0;
                  const kpiColor = noData?'#94a3b8':finalKPI>=85?'#10b981':finalKPI>=70?'#3b82f6':finalKPI>=50?'#f59e0b':'#ef4444';
                  const kpiLabel = noData?'—':finalKPI>=85?'Excellent':finalKPI>=70?'Good':finalKPI>=50?'Fair':'Needs Work';
                  const lcFailedDynChip = (member.lcScores ?? []).filter((sc: number) => sc < kpiSettings.lcMinScore).length;
                  const alerts: string[] = [];
                  if (member.ticketsHandled===0)          alerts.push('🎫0');
                  if (lcFailedDynChip>0)                  alerts.push(`📚${lcFailedDynChip}×`);
                  if (member.formReviewLowRating>0)       alerts.push(`⭐${member.formReviewLowRating}×`);
                  if (member.ticketAvgResponseHours>24)   alerts.push(`⏱${member.ticketAvgResponseHours}j`);
                  // Sparkline: prefer tickets, fallback to LC attempts
                  const spark = member.monthlyTickets?.some(v=>v>0) ? member.monthlyTickets : (member.monthlyLC ?? []);
                  const sparkMax = Math.max(...spark, 1);
                  const sparkW = 72, sparkH = 18;
                  const sparkPts = spark.map((v,i)=>`${(i/11)*sparkW},${sparkH-(v/sparkMax)*sparkH}`).join(' ');
                  return (
                    <div onClick={() => setSelectedKPIMember(member.id)}
                      className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border cursor-pointer hover:shadow-md transition-all group"
                      style={{
                        background: noData ? '#f8fafc' : `${kpiColor}08`,
                        borderColor: noData ? '#e2e8f0' : `${kpiColor}40`,
                        minWidth: 88, maxWidth: 104,
                      }}>
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm flex-shrink-0"
                        style={{background:`linear-gradient(135deg,${kpiColor},${kpiColor}88)`}}>
                        {member.name.charAt(0)}
                      </div>
                      {/* Name */}
                      <div className="text-[10px] font-bold text-slate-700 text-center leading-tight w-full truncate"
                        title={member.name}>{member.name.split(' ')[0]}</div>
                      {/* KPI Score */}
                      <div className="text-sm font-black leading-none" style={{color:kpiColor}}>
                        {noData ? '—' : `${finalKPI}%`}
                      </div>
                      <div className="text-[8px] font-bold uppercase tracking-wide" style={{color:kpiColor}}>{kpiLabel}</div>
                      {/* Sparkline tickets trend */}
                      {spark.some(v=>v>0) && (
                        <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`} style={{overflow:'visible'}}>
                          <polyline points={sparkPts} fill="none" stroke={kpiColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7}/>
                          <circle cx={(11/11)*sparkW} cy={sparkH-(spark[11]/sparkMax)*sparkH} r={2.5} fill={kpiColor}/>
                        </svg>
                      )}
                      {/* Alert dots */}
                      {alerts.length>0 && (
                        <div className="flex gap-0.5 flex-wrap justify-center">
                          {alerts.map((a,i)=>(
                            <span key={i} className="text-[11px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 leading-none">{a}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                };

                // ── Team row: 1 line horizontal scroll ──────────────────
                const TeamRow = ({ members, label, color, abbr }: { members: KPITeamMember[]; label: string; color: string; abbr: string }) => {
                  const scored = members.filter(m=>!(m.ticketsHandled===0&&m.lcAttempts===0&&m.techNotesApproved===0));
                  const avg    = scored.length ? Math.round(scored.reduce((s,m)=>s+calcKPI(m),0)/scored.length) : null;
                  const avgC   = avg==null?'#94a3b8':avg>=85?'#10b981':avg>=70?'#3b82f6':avg>=50?'#f59e0b':'#ef4444';
                  return (
                    <div className="bg-white/95 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100" style={{background:`${color}08`}}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-sm font-black flex-shrink-0" style={{background:color}}>{abbr}</div>
                        <span className="text-sm font-black text-slate-600 uppercase tracking-wider">{label}</span>
                        <span className="text-[10px] text-slate-400">{members.length} anggota</span>
                        {avg!==null && (
                          <span className="ml-auto text-sm font-black" style={{color:avgC}}>avg {avg}%</span>
                        )}
                      </div>
                      {/* Horizontal scroll member chips */}
                      <div className="flex gap-2 px-3 py-2 overflow-x-auto"
                        style={{scrollbarWidth:'none'}}>
                        {members.map(m => <MemberChip key={m.id} member={m}/>)}
                      </div>
                    </div>
                  );
                };

                // For team scope, show only their own card (single member)
                if (scope.kind === 'team') {
                  const myMember = kpiTeam.members.find(m => m.id === currentUser.id);
                  if (!myMember) return <div className="text-center py-8 text-slate-400 text-sm">Data KPI kamu belum tersedia.</div>;
                  const MONTHS_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                  const startM = kpiTeam.filterStartMonth;
                  const duration = kpiTeam.filterPeriod === '6m' ? 6 : 12;
                  const endM = Math.min(startM + duration - 1, 12);
                  const periodLabel = `${MONTHS_FULL[startM-1]} – ${MONTHS_FULL[endM-1]} ${kpiTeam.filterYear}`;
                  return (
                    <div className="bg-white/95 rounded-2xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-black text-slate-600 uppercase tracking-wider">📊 Dashboard KPI — {currentUser.full_name}</span>
                      </div>
                      {/* Info periode — konteks utama */}
                      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
                        <span className="text-blue-500 text-sm">📅</span>
                        <div>
                          <p className="text-sm text-blue-400 font-semibold uppercase tracking-wider">Periode Penilaian</p>
                          <p className="text-sm font-black text-blue-700">{periodLabel}</p>
                        </div>
                        <span className="ml-auto text-sm font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 border border-blue-200">
                          {kpiTeam.filterPeriod === '6m' ? '6 Bulan' : '1 Tahun'}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <MemberChip member={myMember}/>
                      </div>
                    </div>
                  );
                }

                // Admin/supervisor: semua tim dalam 1 baris gabungan
                const allPTSMembers = [...ivpMembers, ...mldsMembers, ...umpMembers];
                if (!allPTSMembers.length) return null;
                return (
                  <div className="space-y-3">
                    <TeamRow
                      members={allPTSMembers}
                      label={scope.kind==='pts_sup' ? (scope.ptsTeamType ?? 'Team PTS') : 'Team PTS (Semua)'}
                      color="#be123c"
                      abbr="PTS"
                    />
                  </div>
                );
              })()}



              {/* ── Detail Popup Modal — rendered via Portal ── */}
              {selectedKPIMember && (() => {
                const member = kpiTeam.members.find(m => m.id === selectedKPIMember);
                if (!member) return null;
                // New 4-component scoring — belum ada data = 0, bukan 100%
                const _s = kpiSettings;
                const lcFailedDyn = (member.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
                const tickScore = member.ticketsHandled > 0 ? Math.max(0, 1 - member.ticketsOverdue / Math.max(member.ticketsHandled,1)) : 0;
                const bastScore = member.formReviewTotal === 0
                  ? 0
                  : member.formReviewLowRating === 0 ? 1 : Math.max(0, 1 - member.formReviewLowRating / Math.max(member.formReviewTotal, 1));
                const lcScore = member.lcAttempts === 0 ? 0 : Math.max(0, 1 - (lcFailedDyn / Math.max(member.lcAttempts,1)));
                const rndScore = member.techNotesApproved >= _s.rndTarget ? 1 : member.techNotesApproved / Math.max(_s.rndTarget, 1);
                const finalKPI = Math.round((_s.ticketOverdueWeight*tickScore + _s.bastWeight*bastScore + _s.lcWeight*lcScore + _s.rndWeight*rndScore) * 100);
                const noData = member.ticketsHandled === 0 && member.lcAttempts === 0 && member.techNotesApproved === 0;
                const kpiColor = noData ? '#94a3b8' : finalKPI>=85?'#10b981':finalKPI>=70?'#3b82f6':finalKPI>=50?'#f59e0b':'#ef4444';
                const isEditing = kpiTeam.editingMember === member.id;
                const modalContent = (
                  <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) { setSelectedKPIMember(null); setKpiTeam(prev=>({...prev,editingMember:null,editValues:{}})); } }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                      style={{ scrollbarWidth:'thin' }}>
                      {/* Modal header */}
                      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${kpiColor}, ${kpiColor}99)` }}>
                          {member.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 text-sm truncate">{member.name}</div>
                          <div className="text-xs text-slate-400">{member.jabatan} · {member.team_type}</div>
                        </div>
                        <div className="flex flex-col items-end mr-1 flex-shrink-0">
                          <div className="text-2xl font-black" style={{ color: kpiColor }}>{noData ? '—' : `${finalKPI}%`}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">KPI Score</div>
                        </div>
                        {(scope.kind==='admin' || scope.kind==='pts_sup') && (
                          <button
                            onClick={()=>{
                              if (isEditing) {
                                const uid = member.id;
                                const vals = kpiTeam.editValues;
                                supabase.from('kpi_manual_values').upsert({
                                  user_id: uid, year: kpiTeam.filterYear,
                                  komplain_count: vals.komplainCount ?? member.manual.komplainCount,
                                  respon_time: vals.responTime ?? member.manual.responTime,
                                  bast_demo: vals.bastDemo ?? member.manual.bastDemo,
                                  bast_demo_total: vals.bastDemoTotal ?? member.manual.bastDemoTotal,
                                  report_bulanan: vals.reportBulanan ?? member.manual.reportBulanan,
                                  learning_mastery: vals.learningMastery ?? member.manual.learningMastery,
                                  updated_by: currentUser.full_name,
                                  updated_at: new Date().toISOString(),
                                }, { onConflict: 'user_id,year' }).then(() => fetchKPITeam());
                                setKpiTeam(prev=>({...prev, editingMember:null, editValues:{}}));
                              } else {
                                setKpiTeam(prev=>({...prev, editingMember:member.id, editValues:{...member.manual}}));
                              }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                            style={isEditing
                              ? {background:'#10b98120',color:'#059669',borderColor:'#10b98140'}
                              : {background:'#f1f5f9',color:'#64748b',borderColor:'#e2e8f0'}}>
                            {isEditing ? '💾 Simpan' : '✏️ Edit'}
                          </button>
                        )}
                        <button onClick={() => { setSelectedKPIMember(null); setKpiTeam(prev=>({...prev,editingMember:null,editValues:{}})); }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>

                      <div className="p-4 space-y-3">

                        {/* ── KPI Score Breakdown ── */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            {label:'Ticketing', raw:Math.round(tickScore*100), pct:Math.round(tickScore*_s.ticketOverdueWeight*100), weight:Math.round(_s.ticketOverdueWeight*100)+'%', color:'#ef4444', icon:'🎫', bg:'#fef2f2', border:'#ef444440'},
                            {label:'BAST & Demo', raw:Math.round(bastScore*100), pct:Math.round(bastScore*_s.bastWeight*100), weight:Math.round(_s.bastWeight*100)+'%', color:'#f59e0b', icon:'⭐', bg:'#fffbeb', border:'#f59e0b40'},
                            {label:'Learning Center', raw:Math.round(lcScore*100), pct:Math.round(lcScore*_s.lcWeight*100), weight:Math.round(_s.lcWeight*100)+'%', color:'#6366f1', icon:'🎓', bg:'#f5f3ff', border:'#6366f140'},
                            {label:'R&D Tech Note', raw:Math.round(rndScore*100), pct:Math.round(rndScore*_s.rndWeight*100), weight:Math.round(_s.rndWeight*100)+'%', color:'#ec4899', icon:'📝', bg:'#fdf4ff', border:'#ec489940'},
                          ].map(k=>(
                            <div key={k.label} className="rounded-xl border p-2 text-center" style={{background:k.bg, borderColor:k.border}}>
                              <div className="text-xs mb-0.5">{k.icon}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight mb-1">{k.label}</div>
                              <div className="text-lg font-black leading-none" style={{color:k.color}}>{k.pct}%</div>
                              <div className="text-[9px] text-slate-400 mt-0.5">bobot {k.weight}</div>
                            </div>
                          ))}
                        </div>

                        {/* ── Platform auto section ── */}
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">✅ Data Platform (Otomatis)</div>
                          <div className="grid grid-cols-3 gap-2">

                            {/* Ticketing — 20% */}
                            <div className="rounded-xl border p-3" style={{borderColor:'#ef444440', background:'#fef2f2'}}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">🎫 Ticketing</div>
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{background:tickScore>=1?'#d1fae5':'#fee2e2',color:tickScore>=1?'#065f46':'#991b1b'}}>{Math.round(tickScore*_s.ticketOverdueWeight*100)}/{Math.round(_s.ticketOverdueWeight*100)}% bobot</span>
                              </div>
                              <div className="space-y-1.5 text-[11px] text-slate-600">
                                <div className="flex justify-between"><span>Handled</span><b className="text-slate-800">{member.ticketsHandled}</b></div>
                                <div className="flex justify-between"><span>Solved</span><b className="text-emerald-600">{member.ticketsSolved}</b></div>
                                <div className="flex justify-between"><span>Overdue</span>
                                  <b className={member.ticketsOverdue > 0 ? 'text-red-600' : 'text-emerald-600'}>{member.ticketsOverdue}</b>
                                </div>
                                <div className="flex justify-between"><span>Avg Response</span>
                                  <b className={member.ticketAvgResponseHours > 24 ? 'text-red-600' : 'text-emerald-600'}>
                                    {member.ticketAvgResponseHours > 0 ? `${member.ticketAvgResponseHours}j` : '—'}
                                  </b>
                                </div>
                                {member.ticketsOverdue === 0
                                  ? <div className="text-sm text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Tidak ada overdue</div>
                                  : <div className="text-sm text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1">⚠ {member.ticketsOverdue} ticket overdue</div>}
                              </div>
                            </div>

                            {/* BAST & Demo — 30% (Form Review) */}
                            <div className="rounded-xl border p-3" style={{borderColor:'#f59e0b40', background:'#fffbeb'}}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">⭐ BAST &amp; Demo</div>
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{background:bastScore>=1?'#d1fae5':'#fee2e2',color:bastScore>=1?'#065f46':'#991b1b'}}>{Math.round(bastScore*_s.bastWeight*100)}/{Math.round(_s.bastWeight*100)}% bobot</span>
                              </div>
                              <div className="space-y-1.5 text-[11px] text-slate-600">
                                <div className="text-[10px] text-slate-400 mb-1">Sumber: Form Review BAST & Demo (bintang &lt;3)</div>
                                <div className="flex justify-between"><span>Total Review</span><b className="text-slate-800">{member.formReviewTotal}</b></div>
                                <div className="flex justify-between"><span>Komplain (★1-2)</span>
                                  <b className={member.formReviewLowRating > 0 ? 'text-red-600' : 'text-emerald-600'}>
                                    {member.formReviewLowRating}x
                                  </b>
                                </div>
                                {member.formReviewTotal === 0
                                  ? <div className="text-sm text-slate-400 font-semibold bg-slate-50 rounded-lg px-2 py-1">⏳ Sales belum submit review — belum dihitung</div>
                                  : member.formReviewLowRating === 0
                                    ? <div className="text-sm text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Tidak ada komplain dari {member.formReviewTotal} review</div>
                                    : <div className="text-sm text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1">⚠ {member.formReviewLowRating}x komplain dari {member.formReviewTotal} review</div>}
                              </div>
                            </div>

                            {/* Tech Knowledge — 40% (LC) */}
                            <div className="rounded-xl border p-3" style={{borderColor:'#6366f140', background:'#f5f3ff'}}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">🎓 Learning Center</div>
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{background:lcScore>=1?'#d1fae5':'#fee2e2',color:lcScore>=1?'#065f46':'#991b1b'}}>{Math.round(lcScore*_s.lcWeight*100)}/{Math.round(_s.lcWeight*100)}% bobot</span>
                              </div>
                              <div className="space-y-1.5 text-[11px] text-slate-600">
                                <div className="text-[10px] text-slate-400 mb-1">Sumber: Learning Center (nilai penuh jika tidak ada &lt;{_s.lcMinScore})</div>
                                <div className="flex justify-between"><span>Total Attempt</span><b className="text-slate-800">{member.lcAttempts}</b></div>
                                <div className="flex justify-between"><span>Avg Score</span><b className={member.lcAvgScore < _s.lcMinScore ? 'text-red-600' : 'text-emerald-600'}>{member.lcAvgScore || '—'}</b></div>
                                <div className="flex justify-between"><span>Lulus</span><b className="text-emerald-600">{member.lcPassed}</b></div>
                                <div className="flex justify-between"><span>Nilai &lt;{_s.lcMinScore}</span>
                                  <b className={lcFailedDyn > 0 ? 'text-red-600' : 'text-emerald-600'}>{lcFailedDyn}x</b>
                                </div>
                                {lcFailedDyn > 0
                                  ? <div className="text-sm text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1">⚠ {lcFailedDyn}x nilai di bawah {_s.lcMinScore}</div>
                                  : member.lcAttempts > 0
                                    ? <div className="text-sm text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Semua nilai ≥{_s.lcMinScore}</div>
                                    : null}
                              </div>
                            </div>

                          </div>
                          {/* Reminder & Piket info */}
                          <div className="mt-2 bg-slate-50 rounded-xl border border-slate-100 p-3 text-[11px] text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
                            <span>📅 Reminder: <b className="text-slate-800">{member.remindersDone}</b>/{member.remindersAssigned} done{member.remindersOverdue>0?<span className="text-red-500"> · {member.remindersOverdue} overdue</span>:null}</span>
                            <span>🏪 Piket: <b className="text-slate-800">{member.piketFilled}</b> hari bertugas</span>
                          </div>
                        </div>

                        {/* ── R&D Tech Note — Otomatis dari platform Tech Note ── */}
                        <div>
                          <div className="text-[10px] font-bold text-pink-600 uppercase tracking-wider mb-2">📝 R&amp;D Tech Note (Otomatis dari Platform)</div>
                          <div className="rounded-xl border p-3" style={{borderColor:'#ec489940', background:'#fdf4ff'}}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] font-bold text-pink-600 uppercase tracking-wider">📝 R&amp;D Tech Note</div>
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{background:rndScore>=1?'#d1fae5':'#fee2e2',color:rndScore>=1?'#065f46':'#991b1b'}}>{Math.round(rndScore*_s.rndWeight*100)}/{Math.round(_s.rndWeight*100)}% bobot</span>
                            </div>
                            <div className="text-sm text-slate-500 mb-3">
                              Target: <b className="text-slate-700">{_s.rndTarget} Tech Note approved</b> per tahun · Data otomatis dari platform Tech Note
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl font-black" style={{color: rndScore>=1?'#059669':'#dc2626'}}>{member.techNotesApproved}</span>
                              <span className="text-[10px] text-slate-400 font-medium">/ {_s.rndTarget}</span>
                              <div className="h-2 flex-1 rounded-full bg-pink-100 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{width:`${Math.min(100,rndScore*100)}%`, background: rndScore>=1?'#10b981':'#f472b6'}}/>
                              </div>
                            </div>
                            {member.techNotesApproved === 0 ? (
                              <div className="text-sm text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                                ⚠️ Belum ada Tech Note yang diapprove tahun ini
                              </div>
                            ) : member.techNotesApproved >= _s.rndTarget ? (
                              <div className="text-sm text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                                ✅ KKM Tech Note terpenuhi ({member.techNotesApproved}/{_s.rndTarget} approved)
                              </div>
                            ) : (
                              <div className="text-sm text-amber-600 font-semibold bg-amber-50 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                                ⏳ Kurang {_s.rndTarget - member.techNotesApproved} Tech Note lagi untuk mencapai KKM
                              </div>
                            )}
                            <a href="/tech-note" target="_blank" rel="noopener noreferrer"
                              className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-pink-600 hover:text-pink-800 transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                              Buka Platform Tech Note →
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
                return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
              })()}
            </div>
          )}

          {/* ══════════ TAB ANALYTICS — KPI Live Charts ══════════ */}
          {tab==='analytics'&&(
            <div className="space-y-6">
              {/* ── ROW A: 3-col Ticket charts ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Handler */}
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🎫 Ticket Open per Handler</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byHandler.length
                      ? <HBarChart data={kpi.tickets.byHandler.map(h=>({label:h.name.split(' ')[0],value:h.count}))} color="#ef4444"/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>
                {/* Divisi */}
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">🏢 Ticket per Divisi</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byDivision.length
                      ? <HBarChart data={kpi.tickets.byDivision.map(d=>({label:d.div,value:d.count}))} color="#6366f1"/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>
                {/* Product */}
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">📦 Ticket per Produk</h3>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byProduct?.length
                      ? <HBarChart data={kpi.tickets.byProduct.map(p=>({label:p.product,value:p.count}))} color="#0891b2"/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data produk</p>}
                </div>
              </div>

              {/* ── ROW B: Reminder Kategori + Reminder per Produk ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
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

              {/* Performa Resolusi */}
              <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
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

          {/* ══════════ TAB RIWAYAT KPI ══════════ */}
          {tab==='history' && (scope.kind==='admin' || scope.kind==='pts_sup') && (() => {
            const MN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
            const kpiColor = (s:number) => s>=85?'#10b981':s>=70?'#3b82f6':s>=50?'#f59e0b':'#ef4444';
            const kpiLabel = (s:number) => s>=85?'Excellent':s>=70?'Good':s>=50?'Fair':'Needs Work';

            const deleteSnapshot = async (id:string, label:string) => {
              if (!confirm(`Hapus periode "${label}"?\nTindakan ini permanen dan tidak bisa dibatalkan.`)) return;
              await supabase.from('kpi_period_snapshots').delete().eq('id', id);
              await fetchKPISnapshots();
              if (expandedSnapshot === id) setExpandedSnapshot(null);
            };

            const exportSnapshotExcel = async (snap: KPIPeriodSnapshot) => {
              const XLSX_MOD: any = await new Promise((resolve, reject) => {
                if ((window as any).XLSX) { resolve((window as any).XLSX); return; }
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                s.onload = () => resolve((window as any).XLSX);
                s.onerror = reject;
                document.head.appendChild(s);
              });
              const avg = snap.members_json.length
                ? Math.round(snap.members_json.reduce((s,m)=>s+m.finalKPI,0)/snap.members_json.length) : 0;
              const wb = XLSX_MOD.utils.book_new();
              const aoa: (string|number|null)[][] = [
                ['REKAP KPI — ' + snap.period_label.toUpperCase(),null,null,null,null,null,null,null,null,null],
                [`Periode: ${snap.period_label}  |  Tim: ${snap.team_type}  |  Disimpan: ${new Date(snap.created_at).toLocaleDateString('id-ID')} oleh ${snap.created_by}`,null,null,null,null,null,null,null,null,null],
                [],
                ['No','Nama','Jabatan','Tim','Ticket (20%)','BAST (40%)','LC (30%)','RnD (10%)','KPI Final (%)','Predikat'],
              ];
              snap.members_json.slice().sort((a,b)=>b.finalKPI-a.finalKPI).forEach((m,i)=>{
                const nd = m.tickScore===0&&m.bastScore===0&&m.lcScore===0&&m.rndScore===0;
                aoa.push([i+1,m.name,m.jabatan,(m.team_type||'').replace('Team PTS ','').replace('Team PTS','IVP'),
                  m.tickScore/100,m.bastScore/100,m.lcScore/100,m.rndScore/100,nd?0:m.finalKPI/100,nd?'Belum Ada Data':kpiLabel(m.finalKPI)]);
              });
              aoa.push([]);
              aoa.push([null,null,null,null,null,null,null,'Rata-rata Tim',avg/100,kpiLabel(avg)]);
              const ws = XLSX_MOD.utils.aoa_to_sheet(aoa);
              const fmt = '0%';
              snap.members_json.forEach((_,i)=>{
                ['E','F','G','H','I'].forEach(col=>{
                  const cell = ws[`${col}${i+5}`];
                  if(cell) cell.z = fmt;
                });
              });
              ws['!cols'] = [{wch:4},{wch:28},{wch:16},{wch:10},{wch:13},{wch:13},{wch:10},{wch:10},{wch:13},{wch:14}];
              XLSX_MOD.utils.book_append_sheet(wb, ws, 'Rekap KPI');
              const out = XLSX_MOD.write(wb, {bookType:'xlsx',type:'array'});
              const url = URL.createObjectURL(new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
              Object.assign(document.createElement('a'),{href:url,download:`KPI_${snap.period_label.replace(/[^a-zA-Z0-9]/g,'_')}.xlsx`}).click();
              URL.revokeObjectURL(url);
            };

            const selectedSnap = kpiSnapshots.find(s=>s.id===expandedSnapshot) ?? null;

            return (
              <div className="space-y-0">

                {/* ── Page header ── */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">Riwayat Periode KPI</div>
                    <div className="text-sm text-slate-400 mt-0.5">{kpiSnapshots.length} periode tersimpan</div>
                  </div>
                  <button onClick={fetchKPISnapshots}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 transition-all">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Refresh
                  </button>
                </div>

                {kpiSnapshots.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
                    <span className="text-5xl opacity-20">📋</span>
                    <p className="text-sm font-semibold text-slate-500">Belum ada periode yang disimpan</p>
                    <p className="text-sm text-center leading-relaxed">
                      Buka tab <b className="text-blue-500">KPI Team</b>, pilih periode &amp; filter,<br/>
                      lalu klik <b className="text-rose-500">Mulai KPI</b> untuk menyimpan periode pertama.
                    </p>
                  </div>
                ) : selectedSnap ? (
                  /* ══ DETAIL VIEW ══ */
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Detail header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                      <button
                        onClick={()=>setExpandedSnapshot(null)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                        Kembali
                      </button>
                      <div className="w-px h-4 bg-slate-200"/>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-800 text-sm">{selectedSnap.period_label}</span>
                        <span className="ml-2 text-sm text-slate-400">
                          {MN[(selectedSnap.start_month??1)-1]}–{MN[(selectedSnap.end_month??12)-1]} {selectedSnap.year}
                          &nbsp;·&nbsp;{selectedSnap.members_json.length} anggota
                          &nbsp;·&nbsp;{new Date(selectedSnap.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
                          &nbsp;oleh&nbsp;<b className="text-slate-600">{selectedSnap.created_by}</b>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>exportSnapshotExcel(selectedSnap)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          Export Excel
                        </button>
                        {scope.kind==='admin' && (
                          <button onClick={()=>deleteSnapshot(selectedSnap.id, selectedSnap.period_label)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-600 hover:text-white transition-all">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary strip */}
                    {(() => {
                      const avg = selectedSnap.members_json.length
                        ? Math.round(selectedSnap.members_json.reduce((s,m)=>s+m.finalKPI,0)/selectedSnap.members_json.length) : 0;
                      const dist = [
                        {label:'Excellent', count:selectedSnap.members_json.filter(m=>m.finalKPI>=85).length, c:'#10b981'},
                        {label:'Good',      count:selectedSnap.members_json.filter(m=>m.finalKPI>=70&&m.finalKPI<85).length, c:'#3b82f6'},
                        {label:'Fair',      count:selectedSnap.members_json.filter(m=>m.finalKPI>=50&&m.finalKPI<70).length, c:'#f59e0b'},
                        {label:'Needs Work',count:selectedSnap.members_json.filter(m=>m.finalKPI<50).length, c:'#ef4444'},
                      ];
                      return (
                        <div className="grid grid-cols-5 divide-x divide-slate-100 border-b border-slate-100">
                          <div className="px-4 py-3">
                            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-0.5">Avg Tim</div>
                            <div className="text-xl font-black" style={{color:kpiColor(avg)}}>{avg}%</div>
                            <div className="text-sm font-bold mt-0.5" style={{color:kpiColor(avg)}}>{kpiLabel(avg)}</div>
                          </div>
                          {dist.map(d=>(
                            <div key={d.label} className="px-4 py-3">
                              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-0.5">{d.label}</div>
                              <div className="text-xl font-black" style={{color:d.c}}>{d.count}</div>
                              <div className="text-[10px] text-slate-400">orang</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Member table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100" style={{background:'#f8fafc'}}>
                            <th className="px-4 py-2.5 text-left text-sm font-bold text-slate-400 uppercase tracking-widest w-8">#</th>
                            <th className="px-3 py-2.5 text-left text-sm font-bold text-slate-400 uppercase tracking-widest">Nama</th>
                            <th className="px-3 py-2.5 text-left text-sm font-bold text-slate-400 uppercase tracking-widest">Tim</th>
                            <th className="px-3 py-2.5 text-center text-sm font-bold uppercase tracking-widest" style={{color:'#ef4444'}}>Ticket<br/><span className="normal-case font-normal text-slate-300">20%</span></th>
                            <th className="px-3 py-2.5 text-center text-sm font-bold uppercase tracking-widest" style={{color:'#f59e0b'}}>BAST<br/><span className="normal-case font-normal text-slate-300">40%</span></th>
                            <th className="px-3 py-2.5 text-center text-sm font-bold uppercase tracking-widest" style={{color:'#6366f1'}}>LC<br/><span className="normal-case font-normal text-slate-300">30%</span></th>
                            <th className="px-3 py-2.5 text-center text-sm font-bold uppercase tracking-widest" style={{color:'#ec4899'}}>RnD<br/><span className="normal-case font-normal text-slate-300">10%</span></th>
                            <th className="px-3 py-2.5 text-center text-sm font-bold text-slate-500 uppercase tracking-widest">KPI Final</th>
                            <th className="px-4 py-2.5 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">Predikat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSnap.members_json.slice().sort((a,b)=>b.finalKPI-a.finalKPI).map((m,idx)=>{
                            const noData = m.tickScore===0&&m.bastScore===0&&m.lcScore===0&&m.rndScore===0;
                            const c = noData?'#94a3b8':kpiColor(m.finalKPI);
                            const lbl = noData?'—':kpiLabel(m.finalKPI);
                            return (
                              <tr key={m.id}
                                className="border-b border-slate-50 hover:bg-blue-50/40 cursor-pointer transition-colors group"
                                onClick={()=>setSelectedSnapMember(m.id)}>
                                <td className="px-4 py-3 text-sm text-slate-300 font-semibold">{idx+1}</td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                                      style={{background:c}}>
                                      {m.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{m.name}</div>
                                      <div className="text-[10px] text-slate-400">{m.jabatan}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-slate-400">
                                  {(m.team_type||'').replace('Team PTS ','').replace('Team PTS','IVP')}
                                </td>
                                {[{v:m.tickScore,c:'#ef4444'},{v:m.bastScore,c:'#f59e0b'},{v:m.lcScore,c:'#6366f1'},{v:m.rndScore,c:'#ec4899'}].map((sc,i)=>(
                                  <td key={i} className="px-3 py-3">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-sm font-bold" style={{color:sc.c}}>{sc.v}%</span>
                                      <div className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{width:`${sc.v}%`,background:sc.c}}/>
                                      </div>
                                    </div>
                                  </td>
                                ))}
                                <td className="px-3 py-3 text-center">
                                  <span className="text-base font-black" style={{color:c}}>{noData?'—':`${m.finalKPI}%`}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-sm font-bold px-2 py-1 rounded-full whitespace-nowrap"
                                    style={{background:`${c}15`,color:c,border:`1px solid ${c}25`}}>
                                    {lbl}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{background:'#f1f5f9',borderTop:'1.5px solid #e2e8f0'}}>
                            <td colSpan={3} className="px-4 py-2.5 text-sm font-black text-slate-600">Rata-rata Tim</td>
                            {(()=>{
                              const mj = selectedSnap.members_json;
                              const n = Math.max(mj.length,1);
                              const avgT=Math.round(mj.reduce((s,m)=>s+m.tickScore,0)/n);
                              const avgB=Math.round(mj.reduce((s,m)=>s+m.bastScore,0)/n);
                              const avgL=Math.round(mj.reduce((s,m)=>s+m.lcScore,0)/n);
                              const avgR=Math.round(mj.reduce((s,m)=>s+m.rndScore,0)/n);
                              const avgF=Math.round(mj.reduce((s,m)=>s+m.finalKPI,0)/n);
                              return (
                                <>
                                  {[{v:avgT,c:'#ef4444'},{v:avgB,c:'#f59e0b'},{v:avgL,c:'#6366f1'},{v:avgR,c:'#ec4899'}].map((sc,i)=>(
                                    <td key={i} className="px-3 py-2.5 text-center text-sm font-black" style={{color:sc.c}}>{sc.v}%</td>
                                  ))}
                                  <td className="px-3 py-2.5 text-center text-sm font-black" style={{color:kpiColor(avgF)}}>{avgF}%</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className="text-sm font-bold px-2 py-1 rounded-full"
                                      style={{background:`${kpiColor(avgF)}15`,color:kpiColor(avgF),border:`1px solid ${kpiColor(avgF)}25`}}>
                                      {kpiLabel(avgF)}
                                    </span>
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* ══ LIST VIEW ══ */
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr style={{background:'#f8fafc'}} className="border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-sm font-bold text-slate-400 uppercase tracking-widest">Periode</th>
                          <th className="px-3 py-3 text-left text-sm font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Disimpan</th>
                          <th className="px-3 py-3 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">Anggota</th>
                          <th className="px-3 py-3 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">Avg KPI</th>
                          <th className="px-3 py-3 text-center text-sm font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">Distribusi</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-slate-400 uppercase tracking-widest">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiSnapshots.map((snap, idx) => {
                          const avg = snap.members_json.length
                            ? Math.round(snap.members_json.reduce((s,m)=>s+m.finalKPI,0)/snap.members_json.length) : 0;
                          const c = kpiColor(avg);
                          const excellent = snap.members_json.filter(m=>m.finalKPI>=85).length;
                          const good      = snap.members_json.filter(m=>m.finalKPI>=70&&m.finalKPI<85).length;
                          const fair      = snap.members_json.filter(m=>m.finalKPI>=50&&m.finalKPI<70).length;
                          const needsW    = snap.members_json.filter(m=>m.finalKPI<50).length;
                          return (
                            <tr key={snap.id}
                              className="border-b border-slate-50 hover:bg-blue-50/30 cursor-pointer transition-colors group"
                              onClick={()=>setExpandedSnapshot(snap.id)}>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black"
                                    style={{background:`${c}12`,color:c,border:`1px solid ${c}25`}}>
                                    {snap.period==='6m'?'6B':'1T'}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{snap.period_label}</div>
                                    <div className="text-[10px] text-slate-400">
                                      {MN[(snap.start_month??1)-1]} – {MN[(snap.end_month??12)-1]} {snap.year}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3.5 hidden sm:table-cell">
                                <div className="text-sm text-slate-500">
                                  {new Date(snap.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
                                </div>
                                <div className="text-[10px] text-slate-400">{snap.created_by}</div>
                              </td>
                              <td className="px-3 py-3.5 text-center">
                                <span className="text-[11px] font-bold text-slate-700">{snap.members_json.length}</span>
                              </td>
                              <td className="px-3 py-3.5 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <span className="text-base font-black" style={{color:c}}>{avg}%</span>
                                  <span className="text-sm font-bold" style={{color:c}}>{kpiLabel(avg)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3.5 hidden sm:table-cell">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {excellent>0 && <span className="text-sm font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{excellent} Excellent</span>}
                                  {good>0      && <span className="text-sm font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{good} Good</span>}
                                  {fair>0      && <span className="text-sm font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">{fair} Fair</span>}
                                  {needsW>0    && <span className="text-sm font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">{needsW} NW</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3.5" onClick={e=>e.stopPropagation()}>
                                <div className="flex items-center gap-1.5 justify-end">
                                  <button onClick={()=>exportSnapshotExcel(snap)}
                                    title="Export Excel"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                  </button>
                                  {scope.kind==='admin' && (
                                    <button onClick={()=>deleteSnapshot(snap.id,snap.period_label)}
                                      title="Hapus periode ini"
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                  )}
                                  <button onClick={()=>setExpandedSnapshot(snap.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══ POPUP DETAIL MEMBER — RIWAYAT KPI (Snapshot) ══ */}
          {selectedSnapMember && (() => {
            // Cari snapshot yang sedang dibuka
            const snap = kpiSnapshots.find(s => s.id === expandedSnapshot);
            if (!snap) return null;
            const m = snap.members_json.find(x => x.id === selectedSnapMember);
            if (!m) return null;
            const noData = m.tickScore===0&&m.bastScore===0&&m.lcScore===0&&m.rndScore===0;
            const kpiCol = (s:number) => s>=85?'#10b981':s>=70?'#3b82f6':s>=50?'#f59e0b':'#ef4444';
            const c = noData ? '#94a3b8' : kpiCol(m.finalKPI);
            const lbl = noData?'Belum Ada Data':m.finalKPI>=85?'Excellent':m.finalKPI>=70?'Good':m.finalKPI>=50?'Fair':'Needs Work';
            const modalContent = (
              <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)'}}
                onClick={e=>{if(e.target===e.currentTarget)setSelectedSnapMember(null);}}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                  style={{scrollbarWidth:'thin'}}>

                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white flex-shrink-0"
                      style={{background:`linear-gradient(135deg,${c},${c}99)`}}>
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.jabatan} · {(m.team_type||'').replace('Team PTS ','').replace('Team PTS','IVP')}</div>
                    </div>
                    <div className="flex flex-col items-end mr-1 flex-shrink-0">
                      <div className="text-2xl font-black" style={{color:c}}>{noData?'—':`${m.finalKPI}%`}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">KPI Score</div>
                    </div>
                    {/* Frozen badge */}
                    <div className="flex flex-col items-center gap-0.5 mr-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 whitespace-nowrap">
                        🔒 Snapshot
                      </span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{snap.period_label}</span>
                    </div>
                    <button onClick={()=>setSelectedSnapMember(null)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>

                  <div className="p-4 space-y-3">

                    {/* Info snapshot frozen */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
                      <span className="text-base">🔒</span>
                      <span>Data ini adalah <b>snapshot yang dikunci</b> pada periode <b>{snap.period_label}</b>. Nilai tidak akan berubah meski data platform terus update — ini adalah catatan final periode tersebut.</span>
                    </div>

                    {/* KPI Score Breakdown */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        {label:'Ticketing',      val:m.tickScore, weight:'20%', color:'#ef4444', icon:'🎫', bg:'#fef2f2', border:'#ef444440'},
                        {label:'BAST & Demo',     val:m.bastScore, weight:'40%', color:'#f59e0b', icon:'⭐', bg:'#fffbeb', border:'#f59e0b40'},
                        {label:'Learning Center', val:m.lcScore,   weight:'30%', color:'#6366f1', icon:'🎓', bg:'#f5f3ff', border:'#6366f140'},
                        {label:'R&D Tech Note',   val:m.rndScore,  weight:'10%', color:'#ec4899', icon:'📝', bg:'#fdf4ff', border:'#ec489940'},
                      ].map(k=>(
                        <div key={k.label} className="rounded-xl border p-2 text-center" style={{background:k.bg,borderColor:k.border}}>
                          <div className="text-xs mb-0.5">{k.icon}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight mb-1">{k.label}</div>
                          <div className="text-lg font-black leading-none" style={{color:k.color}}>{k.val}%</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">bobot {k.weight}</div>
                          <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                            <div className="h-full rounded-full" style={{width:`${k.val}%`,background:k.color}}/>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Predikat final */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border"
                      style={{background:`${c}08`,borderColor:`${c}30`}}>
                      <span className="text-[11px] font-bold text-slate-600">KPI Final</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black" style={{color:c}}>{noData?'—':`${m.finalKPI}%`}</span>
                        <span className="text-sm font-bold px-2.5 py-1 rounded-full"
                          style={{background:`${c}15`,color:c,border:`1px solid ${c}30`}}>
                          {lbl}
                        </span>
                      </div>
                    </div>

                    {/* Detail per komponen */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">📊 Detail Komponen (Data Saat Snapshot)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Ticketing */}
                        <div className="rounded-xl border p-3" style={{borderColor:'#ef444440',background:'#fef2f2'}}>
                          <div className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2">🎫 Ticketing — Skor {m.tickScore}%</div>
                          <div className="space-y-1 text-sm text-slate-600">
                            <div className="flex justify-between"><span>Handled</span><b>{m.ticketsHandled??'—'}</b></div>
                            <div className="flex justify-between"><span>Solved</span><b className="text-emerald-600">{m.ticketsSolved??'—'}</b></div>
                            <div className="flex justify-between"><span>Overdue</span><b className={(m.ticketsOverdue??0)>0?'text-red-600':'text-emerald-600'}>{m.ticketsOverdue??'—'}</b></div>
                          </div>
                        </div>
                        {/* BAST */}
                        <div className="rounded-xl border p-3" style={{borderColor:'#f59e0b40',background:'#fffbeb'}}>
                          <div className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-2">⭐ BAST & Demo — Skor {m.bastScore}%</div>
                          <div className="space-y-1 text-sm text-slate-600">
                            <div className="flex justify-between"><span>Total Review</span><b>{m.formReviewTotal??'—'}</b></div>
                            <div className="flex justify-between"><span>Komplain (★1-2)</span><b className={(m.formReviewLowRating??0)>0?'text-red-600':'text-emerald-600'}>{m.formReviewLowRating??0}x</b></div>
                          </div>
                        </div>
                        {/* Learning Center */}
                        <div className="rounded-xl border p-3" style={{borderColor:'#6366f140',background:'#f5f3ff'}}>
                          <div className="text-sm font-bold text-violet-600 uppercase tracking-wider mb-2">🎓 Learning Center — Skor {m.lcScore}%</div>
                          <div className="space-y-1 text-sm text-slate-600">
                            <div className="flex justify-between"><span>Total Attempt</span><b>{m.lcAttempts??'—'}</b></div>
                            <div className="flex justify-between"><span>Avg Score</span><b>{m.lcAvgScore??'—'}</b></div>
                            <div className="flex justify-between"><span>Lulus</span><b className="text-emerald-600">{m.lcPassed??'—'}</b></div>
                          </div>
                        </div>
                        {/* R&D Tech Note */}
                        <div className="rounded-xl border p-3" style={{borderColor:'#ec489940',background:'#fdf4ff'}}>
                          <div className="text-[10px] font-bold text-pink-600 uppercase tracking-wider mb-2">📝 R&D Tech Note — Skor {m.rndScore}%</div>
                          <div className="space-y-1 text-sm text-slate-600">
                            <div className="flex justify-between"><span>Tech Note Approved</span><b className="text-pink-700">{m.techNotesApproved??0}</b></div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
            return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
          })()}

          {/* ══════════ TAB CROSS-MODULE ANALYTICS ══════════ */}
          {tab==='cross'&&(
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
                  <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5">
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
                        <p className="text-[10px] text-slate-400">Buka tab KPI Team dulu untuk memuat data anggota</p>
                        <button onClick={()=>{ setTab('kpi_team'); setTimeout(()=>fetchKPITeam(),100); }}
                          className="mt-2 px-4 py-2 rounded-lg text-sm font-bold text-white"
                          style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)'}}>
                          Muat Data KPI Team
                        </button>
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
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
                <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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

          {/* ══════════ TAB AUDIT TRAIL ══════════ */}
          {tab==='audit'&&(
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
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold tracking-wide transition-all border ${auditFilter===f ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white/90 text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
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

      {/* ══ Modal Mulai KPI (Snapshot) ══ */}
      {showStartKPI && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget && !savingSnapshot) setShowStartKPI(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{background:'linear-gradient(135deg,#fff1f2,#fff)'}}>
              <div>
                <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <span className="text-lg">📸</span> Simpan Periode KPI
                </div>
                <div className="text-sm text-slate-400 mt-0.5">
                  Snapshot data akan tersimpan permanen & tidak berubah
                </div>
              </div>
              {!savingSnapshot && (
                <button onClick={()=>setShowStartKPI(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">×</button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {(() => {
                const MN_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                const MN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
                const sm = kpiTeam.filterStartMonth;
                const dur = kpiTeam.filterPeriod === '6m' ? 6 : 12;
                const em = Math.min(sm + dur - 1, 12);
                const periodLabel = `${MN_SHORT[sm-1]}–${MN_SHORT[em-1]} ${kpiTeam.filterYear}`;
                const avgKPI = kpiTeam.members.length
                  ? Math.round(kpiTeam.members.reduce((sum, m) => {
                      const _s = kpiSettings;
                      const lcFd = (m.lcScores??[]).filter(sc=>sc<_s.lcMinScore).length;
                      const tS = m.ticketsHandled>0?Math.max(0,1-m.ticketsOverdue/Math.max(m.ticketsHandled,1)):0;
                      const bS = m.formReviewTotal===0?0:m.formReviewLowRating===0?1:Math.max(0,1-m.formReviewLowRating/Math.max(m.formReviewTotal,1));
                      const lS = m.lcAttempts===0?0:Math.max(0,1-(lcFd/Math.max(m.lcAttempts,1)));
                      const rS = m.techNotesApproved>=_s.rndTarget?1:m.techNotesApproved/_s.rndTarget;
                      return sum+Math.round((_s.ticketOverdueWeight*tS+_s.bastWeight*bS+_s.lcWeight*lS+_s.rndWeight*rS)*100);
                    },0)/kpiTeam.members.length)
                  : 0;
                const needsWork = kpiTeam.members.filter(m=>{
                  const _s=kpiSettings; const lcFd=(m.lcScores??[]).filter(sc=>sc<_s.lcMinScore).length;
                  const tS=m.ticketsHandled>0?Math.max(0,1-m.ticketsOverdue/Math.max(m.ticketsHandled,1)):0;
                  const bS=m.formReviewTotal===0?0:m.formReviewLowRating===0?1:Math.max(0,1-m.formReviewLowRating/Math.max(m.formReviewTotal,1));
                  const lS=m.lcAttempts===0?0:Math.max(0,1-(lcFd/Math.max(m.lcAttempts,1)));
                  const rS=m.techNotesApproved>=_s.rndTarget?1:m.techNotesApproved/_s.rndTarget;
                  return Math.round((_s.ticketOverdueWeight*tS+_s.bastWeight*bS+_s.lcWeight*lS+_s.rndWeight*rS)*100)<50;
                }).length;
                return (
                  <>
                  {/* Periode card */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
                    <div className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-2">Periode Review</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black text-blue-700">{periodLabel}</div>
                        <div className="text-sm text-blue-500 mt-0.5">
                          {MN_FULL[sm-1]} s.d. {MN_FULL[em-1]} {kpiTeam.filterYear} · {kpiTeam.filterPeriod==='6m'?'6 Bulan':'12 Bulan'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-blue-400 font-semibold">Tim</div>
                        <div className="font-bold text-blue-700 text-sm">{scope.kind==='pts_sup'?scope.ptsTeamType:'Semua Tim PTS'}</div>
                      </div>
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {val:kpiTeam.members.length,label:'Anggota',c:'#64748b'},
                      {val:`${avgKPI}%`,label:'Avg KPI',c:avgKPI>=70?'#10b981':avgKPI>=50?'#f59e0b':'#ef4444'},
                      {val:needsWork,label:'Needs Work',c:'#ef4444'},
                    ].map((s,i)=>(
                      <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                        <div className="text-2xl font-black" style={{color:s.c}}>{s.val}</div>
                        <div className="text-sm text-slate-400 font-semibold mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Member pills */}
                  {kpiTeam.members.length>0&&(
                    <div>
                      <div className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Preview Anggota</div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1" style={{scrollbarWidth:'thin'}}>
                        {kpiTeam.members.map(m=>{
                          const _s=kpiSettings; const lcFd=(m.lcScores??[]).filter(sc=>sc<_s.lcMinScore).length;
                          const tS=m.ticketsHandled>0?Math.max(0,1-m.ticketsOverdue/Math.max(m.ticketsHandled,1)):0;
                          const bS=m.formReviewTotal===0?0:m.formReviewLowRating===0?1:Math.max(0,1-m.formReviewLowRating/Math.max(m.formReviewTotal,1));
                          const lS=m.lcAttempts===0?0:Math.max(0,1-(lcFd/Math.max(m.lcAttempts,1)));
                          const rS=m.techNotesApproved>=_s.rndTarget?1:m.techNotesApproved/_s.rndTarget;
                          const f=Math.round((_s.ticketOverdueWeight*tS+_s.bastWeight*bS+_s.lcWeight*lS+_s.rndWeight*rS)*100);
                          const noData=m.ticketsHandled===0&&m.lcAttempts===0&&m.techNotesApproved===0;
                          const c=noData?'#94a3b8':f>=85?'#10b981':f>=70?'#3b82f6':f>=50?'#f59e0b':'#ef4444';
                          return (
                            <span key={m.id} className="text-sm font-bold px-2 py-1 rounded-full"
                              style={{background:`${c}15`,color:c,border:`1px solid ${c}30`}}>
                              {m.name.split(' ')[0]} {noData?'—':`${f}%`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </>
                );
              })()}

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                <b>⚠️ Perhatian:</b> Setelah disimpan, data KPI periode ini <b>tidak dapat diubah</b>.
                Pastikan semua data sudah lengkap sebelum menyimpan.
                {kpiTeam.members.length===0&&(
                  <div className="mt-1 text-red-600 font-bold">❌ Belum ada data anggota. Load data KPI Team dahulu.</div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-5 justify-end">
              <button onClick={()=>setShowStartKPI(false)} disabled={savingSnapshot}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40">
                Batal
              </button>
              <button onClick={saveKPISnapshot}
                disabled={savingSnapshot||kpiTeam.members.length===0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{background:'linear-gradient(135deg,#be123c,#9f1239)'}}>
                {savingSnapshot?(
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Menyimpan...</>
                ):(
                  <><span>📸</span> Simpan Periode KPI</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
              <button onClick={()=>{setKpiSettings({lcMinScore:70,rndTarget:2,ticketOverdueWeight:0.20,bastWeight:0.40,lcWeight:0.30,rndWeight:0.10}); }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Reset Default
              </button>
              <button onClick={()=>setShowSettings(false)}
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
