'use client';
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, JABATAN_CONFIG, type JabatanType } from './shared';

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
  };
  piket: {
    todayIVP: string | null; todayUMP: string | null; todayMlds: string | null;
    weekFilled: number; weekTotal: number; kegiatanToday: number;
  };
  units: { totalLogs: number; keluarThisMonth: number; masukThisMonth: number };
  users: { total: number; byRole: { role: string; count: number }[] };
}

interface AuditEntry {
  id: string; module: string; actor: string; action: string;
  target: string; detail: string; ts: string;
  severity: 'info' | 'warn' | 'critical'; icon: string;
}

interface Scope {
  kind: 'admin' | 'pts_sup' | 'sales_sup' | 'none';
  // pts_sup
  ptsTeamType?: string;
  ptsMemberNames?: string[];
  // sales_sup
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
  info:     { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  dot: '#3b82f6', text: '#1e40af' },
  warn:     { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)', dot: '#f59e0b', text: '#92400e' },
  critical: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   dot: '#ef4444', text: '#991b1b' },
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

function MiniDonut({ segments, size = 56 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={size/2-4} fill="none" stroke="#e2e8f0" strokeWidth={7}/></svg>;
  const r = size/2-5, circ = 2*Math.PI*r; let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={7}/>
      {segments.map((seg,i) => { const pct=seg.value/total, dash=pct*circ, gap=circ-dash;
        const el=<circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={7} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-off*circ} strokeLinecap="butt"/>;
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
      style={{ background:'rgba(255,255,255,0.10)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:'1px solid rgba(255,255,255,0.20)', boxShadow:'0 4px 20px rgba(0,0,0,0.15)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.08]"
        style={{ background:color, transform:'translate(30%,-30%)' }}/>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{icon}</span>
            <span className="text-[11px] font-semibold text-white/60 tracking-wide uppercase truncate">{label}</span>
          </div>
          {loading ? <div className="h-7 w-16 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.15)' }}/> :
            <div className="text-2xl font-black tracking-tight" style={{ color }}>{value}</div>}
          {sub && <div className="text-[11px] text-white/50 mt-0.5 truncate">{sub}</div>}
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
          style={{ background:'rgba(15,23,42,0.72)', backdropFilter:'blur(8px)' }}>{icon}</div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
          {sub && <p className="text-[11px] text-white/60">{sub}</p>}
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
          <span className="text-[11px] text-white/70 w-24 truncate flex-shrink-0 text-right">{d.label}</span>
          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${(d.value/max)*100}%`, background:color, opacity:0.85-i*0.08 }}/>
          </div>
          <span className="text-[11px] font-bold text-white/80 w-6 text-right">{d.value}</span>
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
        style={{ background:`${s.dot}22` }}>{entry.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-white truncate">{entry.action}</span>
          <span className="text-[10px] text-white/50 flex-shrink-0">{fmt}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background:`${s.dot}25`, color:s.text }}>{entry.module}</span>
          <span className="text-[10px] text-white/60">by <b className="text-white/80">{entry.actor}</b></span>
          {entry.target && <span className="text-[10px] text-white/50 truncate max-w-[180px]">→ {entry.target}</span>}
        </div>
        {entry.detail && <p className="text-[10px] text-white/40 mt-0.5 truncate">{entry.detail}</p>}
      </div>
    </div>
  );
}

// ── Scope badge ──
function ScopeBadge({ scope }: { scope: Scope }) {
  const cfg = {
    admin:     { label: 'Semua Data',         color: '#be123c', icon: '👑' },
    pts_sup:   { label: scope.ptsTeamType ?? 'PTS Supervisor', color: '#0891b2', icon: '🏪' },
    sales_sup: { label: 'Divisi Anda',        color: '#7c3aed', icon: '💼' },
    none:      { label: '-',                  color: '#6b7280', icon: '—'  },
  }[scope.kind];
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
      style={{ background:`${cfg.color}18`, color:cfg.color, border:`1px solid ${cfg.color}30` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
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
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

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

      // Sales supervisor (guest/sales dengan jabatan Supervisor+)
      if (['guest','sales'].includes(role) && jabTier >= 2) {
        const selfDiv = currentUser.sales_division ?? '';

        // Divisi yang di-supervisi via mapping
        const { data: divMaps } = await supabase.from('division_supervisor_mappings')
          .select('sales_division').eq('supervisor_id', currentUser.id);
        const divisions: string[] = [...new Set([
          selfDiv,
          ...(divMaps ?? []).map((m:any) => m.sales_division as string),
        ].filter(Boolean))];

        // Direct user mappings (CC)
        const { data: userMaps } = await supabase.from('user_supervisor_mappings')
          .select('user_id').eq('supervisor_id', currentUser.id);
        const directIds = (userMaps ?? []).map((m:any) => m.user_id as string);

        // Semua user di divisi dengan tier lebih rendah
        const { data: divUsers } = await supabase.from('users')
          .select('id, full_name, jabatan, sales_division')
          .in('sales_division', divisions.length ? divisions : ['__none__'])
          .in('role',['guest','sales']);
        const subFromDiv = (divUsers ?? []).filter((u:any) => {
          const t = JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0;
          return t <= jabTier && u.id !== currentUser.id;
        });

        // Nama + ID dari direct mapping
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
        if (scope.kind === 'sales_sup') {
          // filter by division OR sub user names (sales_name)
          const divFilter = (scope.salesDivisions ?? []).map(d=>`sales_division.eq.${d}`).join(',');
          const nameFilter = (scope.salesSubNames ?? []).map(n=>`sales_name.eq.${n}`).join(',');
          const combined = [divFilter, nameFilter].filter(Boolean).join(',');
          return combined ? q.or(combined) : q;
        }
        return q;
      };
      const scopeReminders = (q: any) => {
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length) {
          return q.in('assign_name', scope.ptsMemberNames);
        }
        if (scope.kind === 'sales_sup') {
          const divFilter = (scope.salesDivisions ?? []).map(d=>`sales_division.eq.${d}`).join(',');
          const nameFilter = (scope.salesSubNames ?? []).map(n=>`sales_name.eq.${n}`).join(',');
          const combined = [divFilter, nameFilter].filter(Boolean).join(',');
          return combined ? q.or(combined) : q;
        }
        return q;
      };

      // ── Parallel fetches ──
      const [ticketsRes, actLogsRes, remindersRes, piketTodayRes, piketWeekRes, kegiatanRes, movRes, usersRes] =
        await Promise.all([
          scopeTickets(supabase.from('tickets').select('id,status,assign_name,sales_division,date,created_at')),
          supabase.from('activity_logs').select('id,ticket_id,new_status,created_at,handler_name').order('created_at',{ascending:false}).limit(500),
          scopeReminders(supabase.from('reminders').select('id,status,category,due_date')),
          supabase.from('piket_schedules').select('day_of_week,pic_ivp_name,pic_ump_name,pic_mlds_name,day_date').eq('day_of_week', dayOfWeek()),
          supabase.from('piket_schedules').select('id,day_date,pic_ivp_name,pic_ump_name,pic_mlds_name').gte('day_date', getMonday()),
          supabase.from('piket_tamu_detail').select('id,created_at').gte('created_at', today),
          supabase.from('movement_logs').select('id,status_barang,tanggal,nama_pts').gte('tanggal', monthStart()),
          scope.kind === 'admin'
            ? supabase.from('users').select('id,role,team_type')
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

      // PTS scope: filter piket & movements to own team
      if (scope.kind === 'pts_sup') {
        const tt = scope.ptsTeamType ?? '';
        movements = movements.filter((m:any) => scope.ptsMemberNames?.includes(m.nama_pts));
        // piket: show all, but today card highlights their team column
      }
      if (scope.kind === 'sales_sup') {
        // movements not relevant for sales scope
        movements = [];
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

      const weekFilled = piketWeek.filter((p:any)=>p.pic_ivp_name||p.pic_ump_name||p.pic_mlds_name).length;

      const roleMap: Record<string,number> = {};
      users.forEach((u:any)=>{ roleMap[u.role]=(roleMap[u.role]||0)+1; });

      setKpi({
        tickets:{ total:tickets.length,open,solved,waitingApproval,byHandler,byStatus,byDivision,resolvedToday,avgResolutionDays },
        reminders:{ total:reminders.length,pending:reminders.filter((r:any)=>r.status==='pending').length,done:reminders.filter((r:any)=>r.status==='done').length,dueSoon,byCategory,overdueCount },
        piket:{ todayIVP:piketToday?.pic_ivp_name??null,todayUMP:piketToday?.pic_ump_name??null,todayMlds:piketToday?.pic_mlds_name??null,weekFilled,weekTotal:6,kegiatanToday:kegiatan.length },
        units:{ totalLogs:movements.length,keluarThisMonth:movements.filter((m:any)=>m.status_barang==='Keluar').length,masukThisMonth:movements.filter((m:any)=>m.status_barang==='Masuk').length },
        users:{ total:users.length,byRole:Object.entries(roleMap).map(([role,count])=>({role,count})) },
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
      const reminderQ = (() => {
        let q = supabase.from('reminders').select('id,project_name,category,status,assign_name,created_by,created_at,updated_at').order('created_at',{ascending:false}).limit(30);
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
      (remindersRes.data??[]).forEach((r:any)=>{
        entries.push({ id:`rem-${r.id}`,module:'Reminder',icon:'🗓️', actor:r.created_by??'Unknown', action:r.status==='done'?'Reminder selesai':'Reminder dibuat', target:r.project_name??'-', detail:`${r.category}${r.assign_name?` · ${r.assign_name}`:''}`, ts:r.updated_at??r.created_at, severity:'info' });
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
  if (scope.kind === 'none') return null;

  // ── Piket card highlight per team ─────────────────────────────────────────
  const isPTSIVP  = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS';
  const isPTSUMP  = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS UMP';
  const isPTSMLDS = scope.kind==='pts_sup'&&scope.ptsTeamType==='Team PTS MLDS';

  const TAB_CONFIG = [
    {key:'kpi',icon:'📊',label:'KPI Live'},
    {key:'analytics',icon:'📈',label:'Analytics'},
    {key:'audit',icon:'🔍',label:'Audit Trail'},
  ] as const;

  // ── Title by scope ────────────────────────────────────────────────────────
  const scopeTitle = scope.kind==='admin' ? 'Dashboard' :
    scope.kind==='pts_sup' ? `Summary ${scope.ptsTeamType}` :
    'Summary Divisi Anda';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* ── Header strip ── */}
      <div className="rounded-2xl mb-5 px-5 py-4 flex items-center justify-between gap-4"
        style={{ background:'rgba(15,23,42,0.72)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#ef4444,#b91c1c)' }}>📡</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-black text-base tracking-tight">{scopeTitle}</h1>
              <ScopeBadge scope={scope}/>
            </div>
            <p className="text-white/50 text-[11px]">Refresh {lastRefresh.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={()=>{ setLoading(true); setAuditLoading(true); fetchKPI(); fetchAudit(); setLastRefresh(new Date()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all">
            ↻ Refresh
          </button>
          <div className="flex rounded-xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.12)' }}>
            {TAB_CONFIG.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                style={tab===t.key?{background:'rgba(255,255,255,0.18)',color:'white'}:{color:'rgba(255,255,255,0.5)'}}>
                <span>{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════ TAB: KPI LIVE ══════════════════ */}
      {tab==='kpi' && (
        <div className="space-y-6">

          {/* Piket Hari Ini — semua bisa lihat, highlight sesuai team */}
          <div>
            <SectionHeader icon="🏪" title="Piket Showroom Hari Ini"
              sub={`${dayOfWeek()}, ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}`}/>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {team:'IVP', person:kpi?.piket.todayIVP, color:'#ef4444', highlight:isPTSIVP||scope.kind==='admin'},
                {team:'UMP', person:kpi?.piket.todayUMP, color:'#f59e0b', highlight:isPTSUMP||scope.kind==='admin'},
                {team:'MLDS',person:kpi?.piket.todayMlds,color:'#3b82f6', highlight:isPTSMLDS||scope.kind==='admin'},
              ].map(p=>(
                <div key={p.team} className="rounded-2xl p-4 flex items-center gap-3 transition-all"
                  style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:`1.5px solid ${p.highlight?p.color+'70':'rgba(255,255,255,0.2)'}`, boxShadow:p.highlight?`0 0 20px ${p.color}30`:'0 4px 20px rgba(0,0,0,0.12)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 text-white"
                    style={{ background:p.color }}>{p.team}</div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider">PIC {p.team}</div>
                    {loading?<div className="h-4 w-20 bg-slate-100 rounded animate-pulse mt-1"/>:
                      p.person?<div className="text-sm font-bold text-white truncate">{p.person}</div>:
                      <div className="text-sm font-semibold text-white/40 italic">Belum diisi</div>}
                  </div>
                  {!loading&&p.person&&<div className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ background:'#10b981',boxShadow:'0 0 6px #10b981' }}/>}
                </div>
              ))}
            </div>
            {!loading&&kpi&&(
              <div className="mt-2 flex items-center gap-4 px-1">
                <span className="text-[11px] text-white/60">Piket minggu ini: <b className="text-white">{kpi.piket.weekFilled}/{kpi.piket.weekTotal}</b> hari terisi</span>
                {kpi.piket.kegiatanToday>0&&<span className="text-[11px] text-white/60">Tamu hari ini: <b className="text-white">{kpi.piket.kegiatanToday}</b></span>}
              </div>
            )}
          </div>

          {/* Tickets */}
          <div>
            <SectionHeader icon="🎫" title="Ticket Troubleshooting"
              sub={scope.kind==='pts_sup'?`Handler: ${scope.ptsTeamType}`:scope.kind==='sales_sup'?'Divisi Anda':'Status real-time'}/>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon="📋" label="Total Ticket" value={loading?'—':kpi?.tickets.total??0} sub="Sepanjang waktu" color="#64748b" loading={loading}
                donut={{ segments:(kpi?.tickets.byStatus??[]).map(s=>({value:s.count,color:s.color})) }}/>
              <StatCard icon="🔥" label="Open / Aktif" value={loading?'—':kpi?.tickets.open??0} sub="Belum Solved/Cancelled" color="#ef4444" loading={loading}/>
              <StatCard icon="⏳" label="Waiting Approval" value={loading?'—':kpi?.tickets.waitingApproval??0} sub="Perlu tindakan admin" color="#f59e0b" loading={loading}/>
              <StatCard icon="✅" label="Solved Hari Ini" value={loading?'—':kpi?.tickets.resolvedToday??0} sub={`Avg ${kpi?.tickets.avgResolutionDays??0} hari/ticket`} color="#10b981" loading={loading}/>
            </div>
          </div>

          {/* Reminders */}
          <div>
            <SectionHeader icon="🗓️" title="Reminder Schedule" sub={scope.kind==='pts_sup'?`Handler: ${scope.ptsTeamType}`:scope.kind==='sales_sup'?'Divisi Anda':'Jadwal & tugas tim'}/>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon="📁" label="Total Reminder" value={loading?'—':kpi?.reminders.total??0} sub="Semua status" color="#6366f1" loading={loading}
                donut={{ segments:(kpi?.reminders.byCategory??[]).slice(0,5).map(c=>({value:c.count,color:c.color})) }}/>
              <StatCard icon="⏰" label="Pending" value={loading?'—':kpi?.reminders.pending??0} sub="Belum selesai" color="#f59e0b" loading={loading}/>
              <StatCard icon="🚨" label="Overdue" value={loading?'—':kpi?.reminders.overdueCount??0} sub="Jatuh tempo terlewat" color="#ef4444" loading={loading}/>
              <StatCard icon="📅" label="7 Hari ke Depan" value={loading?'—':kpi?.reminders.dueSoon??0} sub="Perlu perhatian" color="#0891b2" loading={loading}/>
            </div>
          </div>

          {/* Unit + Users (admin only) */}
          {scope.kind==='admin'&&(
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <SectionHeader icon="🚚" title="Unit Movement Bulan Ini"/>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard icon="📦" label="Total Log" value={loading?'—':kpi?.units.totalLogs??0} color="#6b7280" loading={loading}/>
                  <StatCard icon="⬆️" label="Keluar" value={loading?'—':kpi?.units.keluarThisMonth??0} color="#f59e0b" loading={loading}/>
                  <StatCard icon="⬇️" label="Masuk" value={loading?'—':kpi?.units.masukThisMonth??0} color="#10b981" loading={loading}/>
                </div>
              </div>
              <div>
                <SectionHeader icon="👥" title="Pengguna Platform"/>
                <div className="rounded-2xl p-4"
                  style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.22)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
                  {loading?<div className="h-16 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.12)' }}/> :(
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-3xl font-black text-white">{kpi?.users.total??0}</div>
                      <div className="flex flex-wrap gap-2">
                        {(kpi?.users.byRole??[]).map(r=>(
                          <span key={r.role} className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white/80" style={{ background:"rgba(255,255,255,0.12)" }}>{r.role}: {r.count}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Unit Movement untuk PTS sup */}
          {scope.kind==='pts_sup'&&(
            <div>
              <SectionHeader icon="🚚" title={`Unit Movement — ${scope.ptsTeamType}`} sub="Bulan ini"/>
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon="📦" label="Total Log" value={loading?'—':kpi?.units.totalLogs??0} color="#6b7280" loading={loading}/>
                <StatCard icon="⬆️" label="Keluar" value={loading?'—':kpi?.units.keluarThisMonth??0} color="#f59e0b" loading={loading}/>
                <StatCard icon="⬇️" label="Masuk" value={loading?'—':kpi?.units.masukThisMonth??0} color="#10b981" loading={loading}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ TAB: ANALYTICS ══════════════════ */}
      {tab==='analytics'&&(
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.22)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center gap-2 mb-4"><span className="text-sm">👷</span><span className="text-xs font-bold text-white/70 uppercase tracking-wider">Ticket Open per Handler</span></div>
              {loading?<div className="h-32 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.12)" }}/>:
                kpi?.tickets.byHandler.length?
                  <HBarChart data={kpi.tickets.byHandler.map(h=>({label:h.name.split(' ')[0],value:h.count}))} color="#ef4444"/>:
                  <p className="text-slate-400 text-sm text-center py-4">Tidak ada data</p>}
            </div>
            <div className="rounded-2xl p-5" style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.22)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center gap-2 mb-4"><span className="text-sm">🏢</span><span className="text-xs font-bold text-white/70 uppercase tracking-wider">Ticket per Divisi</span></div>
              {loading?<div className="h-32 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.12)" }}/>:
                kpi?.tickets.byDivision.length?
                  <HBarChart data={kpi.tickets.byDivision.map(d=>({label:d.div,value:d.count}))} color="#6366f1"/>:
                  <p className="text-slate-400 text-sm text-center py-4">Tidak ada data</p>}
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.22)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center gap-2 mb-4"><span className="text-sm">📊</span><span className="text-xs font-bold text-white/70 uppercase tracking-wider">Distribusi Status Ticket</span></div>
            {loading?<div className="h-16 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.12)" }}/>:(
              <div className="flex items-center gap-6 flex-wrap">
                <MiniDonut size={72} segments={(kpi?.tickets.byStatus??[]).map(s=>({value:s.count,color:s.color}))}/>
                <div className="flex flex-wrap gap-3">
                  {(kpi?.tickets.byStatus??[]).map(s=>(
                    <div key={s.status} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background:s.color }}/>
                      <span className="text-xs text-white/70">{s.status} <b className="text-slate-800">({s.count})</b></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.22)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center gap-2 mb-4"><span className="text-sm">🏷️</span><span className="text-xs font-bold text-white/70 uppercase tracking-wider">Reminder per Kategori</span></div>
              {loading?<div className="h-32 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.12)" }}/>:(
                <div className="flex items-center gap-5">
                  <MiniDonut size={64} segments={(kpi?.reminders.byCategory??[]).map(c=>({value:c.count,color:c.color}))}/>
                  <div className="space-y-1.5 flex-1">
                    {(kpi?.reminders.byCategory??[]).map(c=>(
                      <div key={c.cat} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background:c.color }}/>
                        <span className="text-[11px] text-white/70 flex-1 truncate">{c.cat}</span>
                        <span className="text-[11px] font-bold text-white/90">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl p-5" style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.22)', boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
              <div className="flex items-center gap-2 mb-4"><span className="text-sm">⚡</span><span className="text-xs font-bold text-white/70 uppercase tracking-wider">Performa Resolusi</span></div>
              {loading?<div className="h-32 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.12)" }}/>:(
                <div className="space-y-4">
                  {[
                    {label:'Avg. Resolusi Ticket',value:`${kpi?.tickets.avgResolutionDays??0} hari`,color:'#ef4444',icon:'⏱️'},
                    {label:'Ticket Solved Hari Ini',value:`${kpi?.tickets.resolvedToday??0} ticket`,color:'#10b981',icon:'✅'},
                    {label:'Reminder Overdue',value:`${kpi?.reminders.overdueCount??0} jadwal`,color:'#f59e0b',icon:'🚨'},
                    {label:'Piket Terisi Minggu Ini',value:`${kpi?.piket.weekFilled??0}/${kpi?.piket.weekTotal??6} hari`,color:'#6366f1',icon:'📅'},
                  ].map(m=>(
                    <div key={m.label} className="flex items-center gap-3">
                      <span className="text-base">{m.icon}</span>
                      <div className="flex-1">
                        <div className="text-[11px] text-white/55">{m.label}</div>
                        <div className="text-sm font-black" style={{ color:m.color }}>{m.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ TAB: AUDIT TRAIL ══════════════════ */}
      {tab==='audit'&&(
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}
              placeholder="Cari actor, target, aksi..."
              className="rounded-xl px-3 py-2 text-xs font-medium flex-1 min-w-[160px] outline-none"
              style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.25)', color:'white' }}/>
            {(['all','ticket','reminder','piket','user'] as const).map(f=>(
              <button key={f} onClick={()=>setAuditFilter(f)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={auditFilter===f?{background:'rgba(15,23,42,0.75)',color:'white'}:{background:'rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.65)',border:'1px solid rgba(255,255,255,0.15)'}}>
                {f==='all'?'Semua':f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
            <span className="text-[11px] text-white/50 ml-auto">{filteredAudit.length} entri</span>
          </div>
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1"
            style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.25) transparent', maxHeight:'520px' }}>
            {auditLoading?Array.from({length:8}).map((_,i)=><div key={i} className="h-14 rounded-xl bg-white/30 animate-pulse"/>):
              filteredAudit.length===0?<div className="text-center py-12 text-white/50 text-sm">Tidak ada data audit</div>:
              filteredAudit.map((entry:AuditEntry,idx:number)=>(
                <div key={entry.id??idx}><AuditRow entry={entry}/></div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
