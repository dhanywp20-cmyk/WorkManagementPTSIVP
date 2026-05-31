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

  // ─── Design tokens ──────────────────────────────────────────────────────────
  const CARD  = { background:'rgba(10,14,26,0.62)', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 8px 32px rgba(0,0,0,0.35)' } as const;
  const CARD_ACCENT = (c:string) => ({ ...CARD, borderLeft:`2px solid ${c}`, boxShadow:`0 8px 32px rgba(0,0,0,0.35), inset 1px 0 0 ${c}22` });
  const LABEL = 'text-[10px] font-bold tracking-[0.12em] uppercase text-white/40';
  const DIVIDER = { background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)', height:1 };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full" style={{ animation:'fadeInUp 0.35s ease forwards' }}>

      {/* ══ Dark overlay wrapper ══ */}
      <div className="relative rounded-3xl overflow-hidden"
        style={{ background:'rgba(6,9,20,0.55)', backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', border:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 0 80px rgba(0,0,0,0.5)' }}>

        {/* Subtle red accent glow top-left — brand color */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full pointer-events-none"
          style={{ background:'radial-gradient(circle,rgba(190,18,60,0.18) 0%,transparent 70%)' }}/>
        <div className="absolute -bottom-10 right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background:'radial-gradient(circle,rgba(29,78,216,0.10) 0%,transparent 70%)' }}/>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4"
          style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background:'linear-gradient(135deg,#be123c,#9f1239)', boxShadow:'0 0 12px rgba(190,18,60,0.4)' }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm tracking-wide">{scopeTitle}</span>
                <ScopeBadge scope={scope}/>
              </div>
              <span className="text-white/30 text-[10px] tracking-widest">LAST SYNC {lastRefresh.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={()=>{ setLoading(true); setAuditLoading(true); fetchKPI(); fetchAudit(); setLastRefresh(new Date()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ color:'rgba(255,255,255,0.45)', border:'1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e=>{ (e.currentTarget as HTMLButtonElement).style.color='white'; (e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.06)'; }}
              onMouseLeave={e=>{ (e.currentTarget as HTMLButtonElement).style.color='rgba(255,255,255,0.45)'; (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Sync
            </button>
            {/* Tab pills */}
            <div className="flex rounded-lg overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.3)' }}>
              {TAB_CONFIG.map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition-all"
                  style={tab===t.key
                    ? {background:'rgba(190,18,60,0.35)', color:'white', borderRight:'1px solid rgba(255,255,255,0.06)'}
                    : {color:'rgba(255,255,255,0.35)', borderRight:'1px solid rgba(255,255,255,0.05)'}}>
                  {t.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        <div className="p-5 space-y-5">

          {/* ══════════ TAB KPI ══════════ */}
          {tab==='kpi' && (
            <div className="space-y-5">

              {/* Piket Hari Ini */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div style={DIVIDER} className="flex-1"/>
                  <span className={LABEL}>Piket Showroom — {dayOfWeek()}, {new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</span>
                  <div style={DIVIDER} className="flex-1"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {team:'IVP', person:kpi?.piket.todayIVP, color:'#ef4444', highlight:isPTSIVP||scope.kind==='admin'},
                    {team:'UMP', person:kpi?.piket.todayUMP, color:'#f59e0b', highlight:isPTSUMP||scope.kind==='admin'},
                    {team:'MLDS',person:kpi?.piket.todayMlds,color:'#3b82f6', highlight:isPTSMLDS||scope.kind==='admin'},
                  ].map(p=>(
                    <div key={p.team} className="rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                      style={{ ...CARD, ...(p.highlight ? { borderLeft:`2px solid ${p.color}`, boxShadow:`0 0 20px ${p.color}18, 0 8px 32px rgba(0,0,0,0.35)` } : {}) }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 text-white"
                        style={{ background:`linear-gradient(135deg,${p.color},${p.color}aa)`, boxShadow:`0 0 10px ${p.color}40` }}>
                        {p.team}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={LABEL + ' mb-0.5'}>PIC {p.team}</div>
                        {loading
                          ? <div className="h-4 w-20 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.08)' }}/>
                          : p.person
                            ? <div className="text-sm font-bold text-white truncate">{p.person}</div>
                            : <div className="text-xs text-white/25 italic">Belum diisi</div>}
                      </div>
                      {!loading&&p.person&&(
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:'#10b981', boxShadow:'0 0 6px #10b981' }}/>
                      )}
                    </div>
                  ))}
                </div>
                {!loading&&kpi&&(
                  <div className="mt-2 flex items-center gap-4 px-1">
                    <span className="text-[10px] text-white/35 tracking-wide">
                      MINGGU INI <span className="text-white/70 font-bold">{kpi.piket.weekFilled}/{kpi.piket.weekTotal}</span> hari terisi
                    </span>
                    {kpi.piket.kegiatanToday>0&&(
                      <span className="text-[10px] text-white/35 tracking-wide">
                        TAMU HARI INI <span className="text-white/70 font-bold">{kpi.piket.kegiatanToday}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Tickets */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div style={DIVIDER} className="flex-1"/>
                  <span className={LABEL}>Ticket Troubleshooting — {scope.kind==='pts_sup'?scope.ptsTeamType:scope.kind==='sales_sup'?'Divisi Anda':'Semua'}</span>
                  <div style={DIVIDER} className="flex-1"/>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard icon="" label="Total Ticket" value={loading?'—':kpi?.tickets.total??0} sub="Sepanjang waktu" color="#64748b" loading={loading}
                    donut={{ segments:(kpi?.tickets.byStatus??[]).map(s=>({value:s.count,color:s.color})) }}/>
                  <StatCard icon="" label="Open / Aktif" value={loading?'—':kpi?.tickets.open??0} sub="Belum selesai" color="#ef4444" loading={loading}/>
                  <StatCard icon="" label="Waiting Approval" value={loading?'—':kpi?.tickets.waitingApproval??0} sub="Perlu tindakan" color="#f59e0b" loading={loading}/>
                  <StatCard icon="" label="Solved Hari Ini" value={loading?'—':kpi?.tickets.resolvedToday??0} sub={`Avg ${kpi?.tickets.avgResolutionDays??0}h/ticket`} color="#10b981" loading={loading}/>
                </div>
              </div>

              {/* Reminders */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div style={DIVIDER} className="flex-1"/>
                  <span className={LABEL}>Reminder Schedule</span>
                  <div style={DIVIDER} className="flex-1"/>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard icon="" label="Total Reminder" value={loading?'—':kpi?.reminders.total??0} sub="Semua status" color="#6366f1" loading={loading}
                    donut={{ segments:(kpi?.reminders.byCategory??[]).slice(0,5).map(c=>({value:c.count,color:c.color})) }}/>
                  <StatCard icon="" label="Pending" value={loading?'—':kpi?.reminders.pending??0} sub="Belum selesai" color="#f59e0b" loading={loading}/>
                  <StatCard icon="" label="Overdue" value={loading?'—':kpi?.reminders.overdueCount??0} sub="Terlewat" color="#ef4444" loading={loading}/>
                  <StatCard icon="" label="7 Hari ke Depan" value={loading?'—':kpi?.reminders.dueSoon??0} sub="Perlu perhatian" color="#0891b2" loading={loading}/>
                </div>
              </div>

              {/* Unit + Users — admin */}
              {scope.kind==='admin'&&(
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div style={DIVIDER} className="flex-1"/>
                      <span className={LABEL}>Unit Movement — Bulan Ini</span>
                      <div style={DIVIDER} className="flex-1"/>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard icon="" label="Total Log" value={loading?'—':kpi?.units.totalLogs??0} color="#64748b" loading={loading}/>
                      <StatCard icon="" label="Keluar" value={loading?'—':kpi?.units.keluarThisMonth??0} color="#f59e0b" loading={loading}/>
                      <StatCard icon="" label="Masuk" value={loading?'—':kpi?.units.masukThisMonth??0} color="#10b981" loading={loading}/>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div style={DIVIDER} className="flex-1"/>
                      <span className={LABEL}>Pengguna Platform</span>
                      <div style={DIVIDER} className="flex-1"/>
                    </div>
                    <div className="rounded-xl px-5 py-4" style={CARD}>
                      {loading
                        ? <div className="h-10 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.08)' }}/>
                        : <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-4xl font-black text-white" style={{ fontVariantNumeric:'tabular-nums' }}>{kpi?.users.total??0}</span>
                            <div className="flex flex-wrap gap-2">
                              {(kpi?.users.byRole??[]).map(r=>(
                                <span key={r.role} className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider"
                                  style={{ background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.09)' }}>
                                  {r.role.toUpperCase()}&nbsp;<span style={{ color:'rgba(255,255,255,0.85)' }}>{r.count}</span>
                                </span>
                              ))}
                            </div>
                          </div>}
                    </div>
                  </div>
                </div>
              )}

              {/* Unit — PTS sup */}
              {scope.kind==='pts_sup'&&(
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div style={DIVIDER} className="flex-1"/>
                    <span className={LABEL}>Unit Movement — {scope.ptsTeamType}</span>
                    <div style={DIVIDER} className="flex-1"/>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon="" label="Total Log" value={loading?'—':kpi?.units.totalLogs??0} color="#64748b" loading={loading}/>
                    <StatCard icon="" label="Keluar" value={loading?'—':kpi?.units.keluarThisMonth??0} color="#f59e0b" loading={loading}/>
                    <StatCard icon="" label="Masuk" value={loading?'—':kpi?.units.masukThisMonth??0} color="#10b981" loading={loading}/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB ANALYTICS ══════════ */}
          {tab==='analytics'&&(
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Handler */}
                <div className="rounded-xl p-5" style={CARD}>
                  <div className={LABEL + ' mb-4'}>Ticket Open per Handler</div>
                  {loading?<div className="h-32 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.06)' }}/>:
                    kpi?.tickets.byHandler.length
                      ? <HBarChart data={kpi.tickets.byHandler.map(h=>({label:h.name.split(' ')[0],value:h.count}))} color="#ef4444"/>
                      : <p className="text-white/25 text-xs text-center py-6">Tidak ada data</p>}
                </div>
                {/* Divisi */}
                <div className="rounded-xl p-5" style={CARD}>
                  <div className={LABEL + ' mb-4'}>Ticket per Divisi</div>
                  {loading?<div className="h-32 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.06)' }}/>:
                    kpi?.tickets.byDivision.length
                      ? <HBarChart data={kpi.tickets.byDivision.map(d=>({label:d.div,value:d.count}))} color="#6366f1"/>
                      : <p className="text-white/25 text-xs text-center py-6">Tidak ada data</p>}
                </div>
              </div>
              {/* Status donut */}
              <div className="rounded-xl p-5" style={CARD}>
                <div className={LABEL + ' mb-4'}>Distribusi Status Ticket</div>
                {loading?<div className="h-16 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.06)' }}/>:(
                  <div className="flex items-center gap-6 flex-wrap">
                    <MiniDonut size={72} segments={(kpi?.tickets.byStatus??[]).map(s=>({value:s.count,color:s.color}))}/>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {(kpi?.tickets.byStatus??[]).map(s=>(
                        <div key={s.status} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:s.color, boxShadow:`0 0 4px ${s.color}` }}/>
                          <span className="text-[11px] text-white/55">{s.status}</span>
                          <span className="text-[11px] font-bold text-white/80">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reminder kategori */}
                <div className="rounded-xl p-5" style={CARD}>
                  <div className={LABEL + ' mb-4'}>Reminder per Kategori</div>
                  {loading?<div className="h-32 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.06)' }}/>:(
                    <div className="flex items-center gap-5">
                      <MiniDonut size={64} segments={(kpi?.reminders.byCategory??[]).map(c=>({value:c.count,color:c.color}))}/>
                      <div className="space-y-2 flex-1">
                        {(kpi?.reminders.byCategory??[]).map(c=>(
                          <div key={c.cat} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:c.color, boxShadow:`0 0 4px ${c.color}` }}/>
                            <span className="text-[11px] text-white/50 flex-1 truncate">{c.cat}</span>
                            <span className="text-[11px] font-bold text-white/80">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Performa */}
                <div className="rounded-xl p-5" style={CARD}>
                  <div className={LABEL + ' mb-4'}>Performa Resolusi</div>
                  {loading?<div className="h-32 rounded animate-pulse" style={{ background:'rgba(255,255,255,0.06)' }}/>:(
                    <div className="space-y-4">
                      {[
                        {label:'Avg. Resolusi Ticket',value:`${kpi?.tickets.avgResolutionDays??0} hari`,color:'#ef4444'},
                        {label:'Solved Hari Ini',value:`${kpi?.tickets.resolvedToday??0} ticket`,color:'#10b981'},
                        {label:'Reminder Overdue',value:`${kpi?.reminders.overdueCount??0} jadwal`,color:'#f59e0b'},
                        {label:'Piket Terisi Minggu Ini',value:`${kpi?.piket.weekFilled??0}/${kpi?.piket.weekTotal??6} hari`,color:'#6366f1'},
                      ].map(m=>(
                        <div key={m.label} className="flex items-center justify-between gap-3">
                          <span className="text-[11px] text-white/40 tracking-wide">{m.label.toUpperCase()}</span>
                          <span className="text-sm font-black" style={{ color:m.color, fontVariantNumeric:'tabular-nums' }}>{m.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB AUDIT TRAIL ══════════ */}
          {tab==='audit'&&(
            <div className="space-y-3">
              {/* Search + filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}
                    placeholder="Cari actor, aksi, target..."
                    className="w-full rounded-lg pl-8 pr-3 py-2 text-xs outline-none"
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.09)', color:'rgba(255,255,255,0.8)' }}/>
                </div>
                {(['all','ticket','reminder','piket','user'] as const).map(f=>(
                  <button key={f} onClick={()=>setAuditFilter(f)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all"
                    style={auditFilter===f
                      ? { background:'rgba(190,18,60,0.35)', color:'white', border:'1px solid rgba(190,18,60,0.4)' }
                      : { background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.35)', border:'1px solid rgba(255,255,255,0.07)' }}>
                    {f==='all'?'SEMUA':f.toUpperCase()}
                  </button>
                ))}
                <span className="text-[10px] text-white/25 ml-auto tracking-widest">{filteredAudit.length} ENTRI</span>
              </div>
              {/* List */}
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1"
                style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.1) transparent' }}>
                {auditLoading
                  ? Array.from({length:6}).map((_,i)=>(
                      <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background:'rgba(255,255,255,0.04)' }}/>
                    ))
                  : filteredAudit.length===0
                    ? <div className="text-center py-12 text-white/20 text-xs tracking-widest">TIDAK ADA DATA</div>
                    : filteredAudit.map((entry:AuditEntry,idx:number)=>(
                        <div key={entry.id??idx}><AuditRow entry={entry}/></div>
                      ))}
              </div>
            </div>
          )}

        </div>{/* end content */}
      </div>{/* end dark overlay wrapper */}
    </div>
  );
}
