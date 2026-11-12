'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { getSession, startSessionWatcher } from '@/lib/auth/sesi';
import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { lingkupSaya, muatKelompok, namaKelompokPTS } from '@/lib/kelompok/inti';
import { hitungSkorKPI, KPIUser, KPIMember, KPISettings, DEFAULT_KPI_SETTINGS, KPIPeriodSnapshot, Scope, PeriodKey, SortKey, SortDir, MN, getPeriodRange } from './shared';
import { useSumberKpi } from './useSumberKpi';

export function useKpiTeam() {
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

  const [kpiSettings, setKpiSettings] = useState<KPISettings>(DEFAULT_KPI_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedKPIMember, setSelectedKPIMember] = useState<string | null>(null);
  const [kpiMembers, setKpiMembers] = useState<KPIMember[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiYear, setKpiYear] = useState(new Date().getFullYear());
  const [kpiPeriodLen, setKpiPeriodLen] = useState<'6m' | '1y'>('1y');
  const [kpiStartMonth, setKpiStartMonth] = useState(1);

  const [kpiSnapshots, setKpiSnapshots] = useState<KPIPeriodSnapshot[]>([]);
  const [showStartKPI, setShowStartKPI] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
  const [selectedSnapMember, setSelectedSnapMember] = useState<string | null>(null);

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

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      await muatKelompok();
      const role    = currentUser.role?.toLowerCase() ?? '';
      const jabatan = currentUser.jabatan ?? '';
      const PTS_TYPES = namaKelompokPTS();
      if (['admin', 'superadmin'].includes(role) || hasFullAccess(currentUser) || isPimpinan(currentUser)) {
        setScope({ kind: 'admin' }); setScopeReady(true); return;
      }
      if (role === 'team' && PTS_TYPES.includes(currentUser.team_type ?? '') && jabatan === 'Supervisor') {
        setScope({ kind: 'pts_sup', ptsTeamType: currentUser.team_type ?? '' });
        setScopeReady(true); return;
      }
      if (role === 'team') {
        setScope({ kind: 'team' }); setScopeReady(true); return;
      }
      setScope({ kind: 'none' }); setScopeReady(true);
    })();
  }, [currentUser]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('kpi_global_settings').select('settings').eq('id', 1).single();
        if (data?.settings) { setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...(data.settings as Partial<KPISettings>) }); return; }
      } catch {  }
      try {
        const s = typeof window !== 'undefined' ? localStorage.getItem('kpi_global_settings') : null;
        if (s) setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...JSON.parse(s) });
      } catch {  }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { buildMembers, fetchAllData, saveKpiSettings } = useSumberKpi({ scopeReady, scope, setLoading, currentUser, period, setMembers, setPrevMembers });

  const fetchKPIMembers = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') return;
    setKpiLoading(true);
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const monthCount = kpiPeriodLen === '6m' ? 6 : 12;
      const endMonth   = Math.min(kpiStartMonth + monthCount - 1, 12);
      const endDay     = new Date(kpiYear, endMonth, 0).getDate();
      const kpiStart   = `${kpiYear}-${pad(kpiStartMonth)}-01`;
      const kpiEnd     = `${kpiYear}-${pad(endMonth)}-${endDay}`;

      let mQ = supabase.from('users').select('id,full_name,jabatan,team_type,role,kpi_enabled');
      if (scope.kind === 'team') {
        mQ = mQ.eq('id', currentUser!.id);
      } else {
        mQ = mQ.eq('kpi_enabled', true);
        if (scope.kind === 'pts_sup') {
          mQ = mQ.eq('role', 'team').eq('team_type', scope.ptsTeamType ?? '');
        } else {
          mQ = mQ.in('team_type', lingkupSaya(currentUser?.id)).eq('role', 'team');
        }
      }
      const { data: mData } = await mQ;
      if (!mData?.length) { setKpiMembers([]); setKpiLoading(false); return; }

      const built = await buildMembers(mData, kpiStart, kpiEnd);
      setKpiMembers(built);
    } catch {  }
    finally { setKpiLoading(false); }
  }, [scopeReady, scope, kpiYear, kpiPeriodLen, kpiStartMonth, buildMembers, currentUser]);

  useEffect(() => { fetchKPIMembers(); }, [fetchKPIMembers]);

  const fetchKPISnapshots = useCallback(async () => {
    try {
      let q = supabase.from('kpi_period_snapshots').select('*').order('created_at', { ascending: false });
      if (scope.kind === 'pts_sup') q = q.eq('team_type', scope.ptsTeamType ?? '');
      const { data } = await q;
      setKpiSnapshots((data ?? []) as KPIPeriodSnapshot[]);
    } catch {  }
  }, [scope]);

  useEffect(() => {
    if (scopeReady && scope.kind !== 'none') fetchKPISnapshots();
  }, [fetchKPISnapshots, scopeReady, scope]);

  const saveKPISnapshot = useCallback(async () => {
    if (!currentUser) return;
    setSavingSnapshot(true);
    try {
      const _s = kpiSettings;
      const membersJson = kpiMembers.map(m => {
        const { tickScore, bastScore, lcScore, rndScore, finalKPI, kpiDasar, faktorLC } = hitungSkorKPI(m, _s);
        return {
          id: m.id, name: m.name, jabatan: m.jabatan, team_type: m.team_type,
          ticketsHandled: m.ticketsHandled, ticketsSolved: m.ticketsSolved, ticketsOverdue: m.ticketsOverdue,
          lcAttempts: m.lcAttempts, lcAvgScore: m.lcAvgScore, lcPassed: m.lcPassed,
          formReviewTotal: m.formReviewTotal, formReviewLowRating: m.formReviewLowRating, techNotesApproved: m.techNotesApproved,
          tickScore: Math.round(tickScore * 100), bastScore: Math.round(bastScore * 100),
          lcScore: Math.round(lcScore * 100), rndScore: Math.round(rndScore * 100), finalKPI,
          kpiDasar, faktorLC: Math.round(faktorLC * 1000) / 1000,
          lcSesiWajib: m.lcTahunan?.wajib ?? 0, lcSesiLulus: m.lcTahunan?.lulus ?? 0,
        };
      });
      const endMonth = Math.min(kpiStartMonth + (kpiPeriodLen === '6m' ? 5 : 11), 12);
      const snapshotLabel = `${MN[kpiStartMonth - 1]}–${MN[endMonth - 1]} ${kpiYear}`;
      const { data: snapInserted } = await supabase.from('kpi_period_snapshots').insert({
        period_label: snapshotLabel,
        year: kpiYear, period: kpiPeriodLen, start_month: kpiStartMonth, end_month: endMonth,
        team_type: scope.kind === 'pts_sup' ? scope.ptsTeamType ?? 'all' : 'all',
        created_by: currentUser.full_name, members_json: membersJson, settings_json: _s,
      }).select('id').single();
      if (snapInserted?.id) {
        const memberRows = membersJson.map(m => ({
          snapshot_id: snapInserted.id,
          member_id: m.id, name: m.name, jabatan: m.jabatan, team_type: m.team_type,
          tickets_handled: m.ticketsHandled, tickets_solved: m.ticketsSolved, tickets_overdue: m.ticketsOverdue,
          lc_attempts: m.lcAttempts, lc_avg_score: m.lcAvgScore, lc_passed: m.lcPassed,
          form_review_total: m.formReviewTotal, form_review_low: m.formReviewLowRating,
          tech_notes_approved: m.techNotesApproved,
          tick_score: m.tickScore, bast_score: m.bastScore,
          lc_score: m.lcScore, rnd_score: m.rndScore, final_kpi: m.finalKPI,
        }));
        void supabase.from('kpi_snapshot_members').insert(memberRows);
      }
      void logAudit({ user_id: currentUser.id, user_name: currentUser.full_name ?? '', action: 'create', module: 'kpi-team', notes: `Snapshot KPI ${snapshotLabel}` });
      await fetchKPISnapshots();
      setShowStartKPI(false);
    } catch {  }
    finally { setSavingSnapshot(false); }
  }, [currentUser, kpiSettings, kpiMembers, kpiStartMonth, kpiPeriodLen, kpiYear, scope, fetchKPISnapshots]);

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
      ? <span className="text-sky-700 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
      : <span className="text-slate-400 ml-0.5">↕</span>;

  const { start, end } = getPeriodRange(period);
  const periodLabel = `${new Date(start).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })} — ${new Date(end).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}`;

  const kpiEndMonth    = Math.min(kpiStartMonth + (kpiPeriodLen === '6m' ? 5 : 11), 12);
  const kpiPeriodLabel = `${MN[kpiStartMonth - 1]}–${MN[kpiEndMonth - 1]} ${kpiYear}`;
  const kpiFiltered    = filterTeam === 'all' ? kpiMembers : kpiMembers.filter(m => m.team_type === filterTeam);

  const calcKPI = (m: KPIMember) => hitungSkorKPI(m, kpiSettings).finalKPI;
  const kpiScoreColor = (score: number, noData: boolean) =>
    noData ? '#64748b' : score >= 85 ? '#047857' : score >= 70 ? '#1d4ed8' : score >= 50 ? '#b45309' : '#dc2626';
  const kpiScoreLabel = (score: number, noData: boolean) =>
    noData ? 'Belum Ada Data' : score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work';
  return {
    isLoggedIn, appReady, scopeReady, scope, summary, currentUser, fetchAllData, fetchKPIMembers,
    setShowStartKPI, kpiLoading, kpiMembers, kpiYear, setShowSettings, sortedMembers, period, kpiSettings,
    calcKPI, filterTeam, kpiFiltered, kpiPeriodLabel, kpiPeriodLen, kpiScoreColor, kpiScoreLabel, kpiStartMonth,
    setKpiPeriodLen, setKpiStartMonth, setKpiYear, setSelectedKPIMember, setPeriod, periodLabel, loading, allTeamTypes,
    setFilterTeam, SortIcon, handleSort, searchQ, setDrillMember, setSearchQ, expandedSnapshot, kpiSnapshots,
    setExpandedSnapshot, setSelectedSnapMember, drillMember, selectedKPIMember, saveKPISnapshot, savingSnapshot, showStartKPI, selectedSnapMember,
    saveKpiSettings, setKpiSettings, showSettings,
  };
}
