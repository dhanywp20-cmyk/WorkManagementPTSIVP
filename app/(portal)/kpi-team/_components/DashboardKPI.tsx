'use client';
import type { PenggunaPortal as User } from '@/lib/tipe-pengguna';
import { DEFAULT_KPI_SETTINGS, KPISettings } from '@/app/(portal)/kpi-team/_components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { hasFullAccess } from '@/lib/constants';
import { muatKelompok, namaKelompokPTS } from '@/lib/kelompok/inti';
import { isPimpinan } from '@/lib/pimpinan';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ModalPengaturanDasborKPI } from './dasbor/ModalPengaturanDasborKPI';
import { AuditEntry, KPIData, KPITeamState, Scope } from './DashboardKPI-tipe';
import { useAuditKPI } from './useAuditKPI';
import { useMuatKPI } from './useMuatKPI';
import { IsiDashboardKPI } from './IsiDashboardKPI';
import { IsiBeranda, type OpsiBeranda } from '@/app/(portal)/dashboard/_components/beranda/IsiBeranda';

interface DashboardKPIProps { currentUser: User; opsiBeranda?: OpsiBeranda; }

export default function DashboardKPI({ currentUser: userProp, opsiBeranda }: DashboardKPIProps) {
  const userKey = JSON.stringify(userProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentUser = useMemo(() => userProp, [userKey]);
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
    filterStartMonth: new Date().getMonth() < 6 ? 1 : 7,
    filterTeam: 'all',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [kpiSettings, setKpiSettings] = useState<KPISettings>(DEFAULT_KPI_SETTINGS);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase.from('kpi_global_settings').select('settings').eq('id', 1).single();
        if (data?.settings) {
          setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...data.settings });
          return;
        }
      } catch {  }
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('kpi_global_settings') : null;
        if (stored) setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...JSON.parse(stored) });
      } catch {  }
    };
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveKpiSettings = async (s: KPISettings) => {
    try { localStorage.setItem('kpi_global_settings', JSON.stringify(s)); } catch {  }
    try {
      await supabase.from('kpi_global_settings').upsert({ id: 1, settings: s, updated_at: new Date().toISOString() });
    } catch {  }
  };

  useEffect(() => {
    (async () => {
      await muatKelompok();
      const role   = currentUser.role?.toLowerCase() ?? '';
      const jabatan = currentUser.jabatan ?? '';
      const PTS_TYPES = namaKelompokPTS();

      if (['admin','superadmin'].includes(role) || hasFullAccess(currentUser) || isPimpinan(currentUser)) {
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

      if (role === 'team' || role === 'team_pts') {
        const hasDashboard = (currentUser.allowed_menus ?? []).includes('dashboard');
        setScope({ kind: hasDashboard ? 'team' : 'none' }); setScopeReady(true); return;
      }

      setScope({ kind:'none' }); setScopeReady(true);
    })();
  }, [currentUser]);

  const { fetchKPI } = useMuatKPI({ currentUser, scope, scopeReady, setKpi, setLoading });

  const { fetchAudit } = useAuditKPI({ scope, scopeReady, setAudit, setAuditLoading });

  useEffect(() => {
    if (!scopeReady) return;
    const segarkan = () => { fetchKPI(); fetchAudit(); setLastRefresh(new Date()); };
    const mulaiPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(segarkan, 3 * 60 * 1000);
    };
    const hentikanPolling = () => {
      if (!intervalRef.current) return;
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    const saatVisibilitasBerubah = () => {
      if (document.visibilityState === 'hidden') { hentikanPolling(); return; }
      segarkan();
      mulaiPolling();
    };
    segarkan();
    if (document.visibilityState !== 'hidden') mulaiPolling();
    document.addEventListener('visibilitychange', saatVisibilitasBerubah);
    return () => {
      hentikanPolling();
      document.removeEventListener('visibilitychange', saatVisibilitasBerubah);
    };
  }, [scopeReady, fetchKPI, fetchAudit]);

  const filteredAudit = audit.filter(a => {
    const matchFilter = auditFilter==='all'
      ||(auditFilter==='ticket'&&a.module==='Ticketing')
      ||(auditFilter==='reminder'&&a.module==='Reminder')
      ||(auditFilter==='piket'&&a.module==='Piket')
      ||(auditFilter==='user'&&a.module==='User');
    const q=auditSearch.toLowerCase();
    return matchFilter && (!q||[a.actor,a.target,a.action,a.detail].some(x=>x.toLowerCase().includes(q)));
  });

  if (!scopeReady) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"/>
    </div>
  );

  const scopeTitle = scope.kind==='admin' ? 'Dashboard'
    : scope.kind==='pts_sup' ? `Summary ${scope.ptsTeamType}`
    : scope.kind==='team' ? 'Dashboard'
    : 'KPI Dashboard';

  const TAB_CONFIG = [
    {key:'analytics' as const, icon:'📊', label:'Analytics'},
  ];

  function SectionPill({ icon, children }: { icon: string; children: React.ReactNode }) {
    return (
      <h3 className="text-sm font-bold uppercase tracking-widest mb-4 inline-flex items-center gap-1.5 bg-white text-slate-700 px-3 py-1.5 rounded-full shadow-xs backdrop-blur-xs border border-slate-200">
        <span><Ikon nama={icon} ukuran={14} /></span>{children}
      </h3>
    );
  }

  function MiniBar({ value, max, color='#3b82f6', h=4 }: { value:number; max:number; color?:string; h?:number }) {
    const pct = max>0 ? Math.min(100,(value/max)*100) : 0;
    return (
      <div className="w-full rounded-full overflow-hidden flex-1" style={{height:h,background:'#f1f5f9'}}>
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:color}}/>
      </div>
    );
  }

  return (
    <div className="w-full">
        {opsiBeranda
          ? <IsiBeranda kpi={kpi} loading={loading} scope={scope} opsi={opsiBeranda} />
          : <IsiDashboardKPI auditFilter={auditFilter} auditLoading={auditLoading} auditSearch={auditSearch} filteredAudit={filteredAudit} kpi={kpi} loading={loading} scope={scope} setAuditFilter={setAuditFilter} setAuditSearch={setAuditSearch} tab={tab} />}

      <ModalPengaturanDasborKPI
        kpiSettings={kpiSettings} saveKpiSettings={saveKpiSettings} setKpiSettings={setKpiSettings} setShowSettings={setShowSettings} showSettings={showSettings}
      />
    </div>
  );
}
export * from './DashboardKPI-bantu';
export * from './DashboardKPI-grafik';
export * from './DashboardKPI-pita';
export * from './DashboardKPI-tipe';
export * from './DashboardKPI-tren';
export * from './DashboardKPI-ubin';
