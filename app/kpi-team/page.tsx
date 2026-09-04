'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { PageHeader, MobileListCard, MobileCardBadge, MiniSpark, ListEmptyState } from '@/components/shared';
import { notifyKPIAlert } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { lingkupSaya, muatKelompok, namaKelompokPTS } from '@/lib/kelompok';
import { KPIUser, KPIMember, KPISettings, DEFAULT_KPI_SETTINGS, KPIPeriodSnapshot, Scope, PeriodKey, SortKey, SortDir, PERIODS, PERIOD_EMOJI, TEAM_COLORS, STATUS_COLORS, MN, KPI_COLOR, fmt, getPeriodRange } from './_components/shared';
import { exportKPIExcel } from './_components/ekspor-kpi';
import { DrillModal, ProgressBar } from './_components/DrillModal';

// Main Page

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

  // KPI scoring - separate data + period (tidak ikut period picker atas)
  const [kpiSettings, setKpiSettings] = useState<KPISettings>(DEFAULT_KPI_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedKPIMember, setSelectedKPIMember] = useState<string | null>(null);
  const [kpiMembers, setKpiMembers] = useState<KPIMember[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiYear, setKpiYear] = useState(new Date().getFullYear());
  const [kpiPeriodLen, setKpiPeriodLen] = useState<'6m' | '1y'>('1y');
  const [kpiStartMonth, setKpiStartMonth] = useState(1);

  // Riwayat KPI snapshots
  const [kpiSnapshots, setKpiSnapshots] = useState<KPIPeriodSnapshot[]>([]);
  const [showStartKPI, setShowStartKPI] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
  const [selectedSnapMember, setSelectedSnapMember] = useState<string | null>(null);

  // Auth

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

  // Scope resolution

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      /*
        Pemetaan kelompok DIMUAT LEBIH DULU, dan itu bukan kerapian.
        lingkupSaya() membaca keadaan di dalam lib/kelompok.ts; selama
        muatKelompok() belum pernah dipanggil, isinya masih nilai bawaan -
        yaitu SELURUH kelompok PTS. Penyaringan di bawah akan berjalan tanpa
        menyaring apa pun, dan kebocorannya kembali persis seperti semula.
      */
      await muatKelompok();
      const role    = currentUser.role?.toLowerCase() ?? '';
      const jabatan = currentUser.jabatan ?? '';
      const PTS_TYPES = namaKelompokPTS();
      // Admin/superadmin ATAU akun Team PTS dengan toggle "Full Access" aktif
      // (lihat lib/constants.ts hasFullAccess) - lihat seluruh tim, bukan cuma
      // KPI-nya sendiri atau tim satu jenis PTS saja seperti Supervisor.
      if (['admin', 'superadmin'].includes(role) || hasFullAccess(currentUser)) {
        setScope({ kind: 'admin' }); setScopeReady(true); return;
      }
      if (role === 'team' && PTS_TYPES.includes(currentUser.team_type ?? '') && jabatan === 'Supervisor') {
        setScope({ kind: 'pts_sup', ptsTeamType: currentUser.team_type ?? '' });
        setScopeReady(true); return;
      }
      // Regular team member - can view their own KPI (read-only)
      if (role === 'team') {
        setScope({ kind: 'team' }); setScopeReady(true); return;
      }
      setScope({ kind: 'none' }); setScopeReady(true);
    })();
  }, [currentUser]);

  // Load / save KPI settings

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('kpi_global_settings').select('settings').eq('id', 1).single();
        if (data?.settings) { setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...data.settings }); return; }
      } catch { /* table may not exist */ }
      try {
        const s = typeof window !== 'undefined' ? localStorage.getItem('kpi_global_settings') : null;
        if (s) setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...JSON.parse(s) });
      } catch { /* ignore */ }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveKpiSettings = useCallback(async (s: KPISettings) => {
    try { localStorage.setItem('kpi_global_settings', JSON.stringify(s)); } catch { /* ignore */ }
    try { await supabase.from('kpi_global_settings').upsert({ id: 1, settings: s, updated_at: new Date().toISOString() }); } catch { /* ignore */ }
  }, []);

  // Data fetching

  const buildMembers = useCallback(async (membersData: any[], start: string, end: string): Promise<KPIMember[]> => {
    const endFull   = end + 'T23:59:59';
    const todayStr  = fmt(new Date());
    const mNames    = membersData.map((m: any) => m.full_name as string);
    const mIds      = membersData.map((m: any) => m.id as string);

    const [ticketsR, actR, remR, lcR, piketR, formRevR, techNotesR] = await Promise.all([
      supabase.from('tickets').select('id,assign_name,status,date,created_at')
        .in('assign_name', mNames).gte('created_at', start).lte('created_at', endFull),
      supabase.from('activity_logs').select('id,ticket_id,handler_name,created_at')
        .in('handler_name', mNames).gte('created_at', start).lte('created_at', endFull)
        .order('created_at', { ascending: true }),
      supabase.from('reminders').select('id,assign_name,status,due_date')
        .in('assign_name', mNames).gte('created_at', start).lte('created_at', endFull),
      supabase.from('lc_quiz_attempts').select('id,user_id,score,passed,is_submitted,started_at,grading_status')
        .in('user_id', mIds).eq('is_submitted', true)
        .gte('started_at', start).lte('started_at', endFull),
      supabase.from('piket_schedules').select('pic_ivp_name,pic_ump_name,pic_mvi_name,day_date')
        .gte('day_date', start).lte('day_date', end),
      supabase.from('form_reviews')
        .select('id,assign_name,grade_product_knowledge,grade_training_customer,grade_product_knowledge_bast,created_at')
        .in('assign_name', mNames).gte('created_at', start).lte('created_at', endFull)
        .not('grade_product_knowledge_bast', 'is', null),
      supabase.from('tech_notes').select('id,author_id,status,reviewed_at')
        .in('author_id', mIds).eq('status', 'approved')
        .gte('reviewed_at', start).lte('reviewed_at', endFull),
    ]);

    const tickets  = (ticketsR.data  ?? []) as any[];
    const actLogs  = (actR.data      ?? []) as any[];
    const reminders = (remR.data     ?? []) as any[];
    const lcAttempts = (lcR.data     ?? []) as any[];
    const piketRows  = (piketR.data  ?? []) as any[];
    const formReviews = (formRevR.data ?? []) as any[];
    const techNotes   = (techNotesR.data ?? []) as any[];

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
      // Essay yang belum dinilai dikecualikan: skornya belum ada, jadi kalau
      // ikut dihitung, penyebut lcAttempts membesar dan skor KPI bergeser oleh
      // pekerjaan yang belum selesai dinilai.
      const myLC     = lcAttempts.filter((a: any) => a.user_id === uid && a.grading_status !== 'pending_review');
      const lcScoreArr = myLC.filter((a: any) => a.score != null).map((a: any) => a.score as number);
      const lcScores = lcScoreArr;
      const lcAvg    = lcScoreArr.length ? Math.round(lcScoreArr.reduce((a: number, b: number) => a + b, 0) / lcScoreArr.length) : 0;

      // Form reviews (BAST & Demo - low rating = bintang <3)
      const myReviews = formReviews.filter((r: any) => r.assign_name === name);
      const formReviewTotal = myReviews.length;
      const formReviewLowRating = myReviews.filter((r: any) => {
        const g1 = r.grade_product_knowledge ?? 5;
        const g2 = r.grade_training_customer ?? 5;
        const g3 = r.grade_product_knowledge_bast ?? 5;
        return g1 < 3 || g2 < 3 || g3 < 3;
      }).length;

      // Tech Notes approved (R&D - auto from platform)
      const techNotesApproved = techNotes.filter((tn: any) => tn.author_id === uid).length;

      // Piket
      const tt     = m.team_type as string;
      const picCol = tt === 'Team PTS IVP' ? 'pic_ivp_name' : tt === 'Team PTS UMP' ? 'pic_ump_name' : 'pic_mvi_name';
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
        lcScores,
        piketFilled, ticketAvgResponseHours: avgRT,
        formReviewTotal, formReviewLowRating,
        techNotesApproved,
        monthlyTickets,
      };
    });
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') return;
    setLoading(true);
    try {
      // Fetch member list once
      let mQ = supabase.from('users').select('id,full_name,jabatan,team_type,role');
      if (scope.kind === 'team') {
        mQ = mQ.eq('id', currentUser!.id);
      } else if (scope.kind === 'pts_sup') {
        mQ = mQ.eq('role', 'team').eq('team_type', scope.ptsTeamType ?? '');
      } else {
        // lingkupSaya(), bukan daftar tim ditulis langsung: kalau tidak,
        // kelompok yang sengaja tidak dibawahi Manager ini (mis. PTS UMP)
        // ikut bocor tampil di Team Overview walau sudah dikeluarkan dari
        // pengaturan Lingkup Manager - persis pola yang sama dengan
        // fetchKPIMembers di bawah, cuma sempat terlewat di sini.
        mQ = mQ.in('team_type', lingkupSaya(currentUser?.id)).eq('role', 'team');
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
      // Notify members whose solve rate is critically low (< 50% of handled tickets)
      cur.forEach(m => {
        if (m.ticketsHandled >= 5 && m.id) {
          const solveRate = (m.ticketsSolved / m.ticketsHandled) * 100;
          if (solveRate < 50) void notifyKPIAlert(m.id, m.name, solveRate);
        }
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [scopeReady, scope, period, buildMembers, currentUser]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // KPI scoring fetch (independent of period picker)

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
        // Self-view: only current user's own record, no kpi_enabled filter
        mQ = mQ.eq('id', currentUser!.id);
      } else {
        mQ = mQ.eq('kpi_enabled', true);
        if (scope.kind === 'pts_sup') {
          mQ = mQ.eq('role', 'team').eq('team_type', scope.ptsTeamType ?? '');
        } else {
          /*
            Kelompok yang boleh dilihat akun ini, BUKAN seluruh kelompok PTS.

            Sebelumnya ketiga nama kelompok ditulis langsung di sini, jadi
            siapa pun yang lolos ke cabang ini melihat semuanya - termasuk
            Manager PTS IVP yang tidak membawahi PTS UMP sama sekali. Nilai
            KPI seseorang adalah penilaian atas dirinya; ia tidak semestinya
            terbaca oleh atasan dari kelompok lain.

            lingkupSaya() mengembalikan SELURUH kelompok PTS bila akunnya
            belum dipetakan - itu disengaja di lib/kelompok.ts, supaya
            menyalakan fitur ini tidak mendadak mengosongkan layar semua
            Manager sebelum satu pun pemetaan dibuat. Pemetaannya diatur di
            Admin Panel -> Kelompok & Notifikasi.
          */
          mQ = mQ.in('team_type', lingkupSaya(currentUser?.id)).eq('role', 'team');
        }
      }
      const { data: mData } = await mQ;
      if (!mData?.length) { setKpiMembers([]); setKpiLoading(false); return; }

      const built = await buildMembers(mData, kpiStart, kpiEnd);
      setKpiMembers(built);
    } catch { /* silent */ }
    finally { setKpiLoading(false); }
  }, [scopeReady, scope, kpiYear, kpiPeriodLen, kpiStartMonth, buildMembers, currentUser]);

  useEffect(() => { fetchKPIMembers(); }, [fetchKPIMembers]);

  // KPI Snapshots

  const fetchKPISnapshots = useCallback(async () => {
    try {
      let q = supabase.from('kpi_period_snapshots').select('*').order('created_at', { ascending: false });
      if (scope.kind === 'pts_sup') q = q.eq('team_type', scope.ptsTeamType ?? '');
      const { data } = await q;
      setKpiSnapshots((data ?? []) as KPIPeriodSnapshot[]);
    } catch { /* silent */ }
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
        const lcFailedDyn = m.lcScores.filter(sc => sc < _s.lcMinScore).length;
        const tickScore = m.ticketsHandled > 0 ? Math.max(0, 1 - m.ticketsOverdue / Math.max(m.ticketsHandled, 1)) : 0;
        const bastScore = m.formReviewTotal === 0 ? 0 : m.formReviewLowRating === 0 ? 1 : Math.max(0, 1 - m.formReviewLowRating / Math.max(m.formReviewTotal, 1));
        const lcScore   = m.lcAttempts === 0 ? 0 : Math.max(0, 1 - lcFailedDyn / Math.max(m.lcAttempts, 1));
        const rndScore  = m.techNotesApproved >= _s.rndTarget ? 1 : m.techNotesApproved / Math.max(_s.rndTarget, 1);
        const finalKPI  = Math.round((_s.ticketOverdueWeight * tickScore + _s.bastWeight * bastScore + _s.lcWeight * lcScore + _s.rndWeight * rndScore) * 100);
        return {
          id: m.id, name: m.name, jabatan: m.jabatan, team_type: m.team_type,
          ticketsHandled: m.ticketsHandled, ticketsSolved: m.ticketsSolved, ticketsOverdue: m.ticketsOverdue,
          lcAttempts: m.lcAttempts, lcAvgScore: m.lcAvgScore, lcPassed: m.lcPassed,
          formReviewTotal: m.formReviewTotal, formReviewLowRating: m.formReviewLowRating, techNotesApproved: m.techNotesApproved,
          tickScore: Math.round(tickScore * 100), bastScore: Math.round(bastScore * 100),
          lcScore: Math.round(lcScore * 100), rndScore: Math.round(rndScore * 100), finalKPI,
        };
      });
      const endMonth = Math.min(kpiStartMonth + (kpiPeriodLen === '6m' ? 5 : 11), 12);
      const snapshotLabel = `${MN[kpiStartMonth - 1]}–${MN[endMonth - 1]} ${kpiYear}`;
      const { data: snapInserted } = await supabase.from('kpi_period_snapshots').insert({
        period_label: snapshotLabel,
        year: kpiYear, period: kpiPeriodLen, start_month: kpiStartMonth, end_month: endMonth,
        team_type: scope.kind === 'pts_sup' ? scope.ptsTeamType : 'all',
        created_by: currentUser.full_name, members_json: membersJson, settings_json: _s,
      }).select('id').single();
      // Also write to relational table (requires migration 004_kpi_snapshot_members.sql)
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
    } catch { /* silent */ }
    finally { setSavingSnapshot(false); }
  }, [currentUser, kpiSettings, kpiMembers, kpiStartMonth, kpiPeriodLen, kpiYear, scope, fetchKPISnapshots]);

  // Computed values

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

  // Period label

  const { start, end } = getPeriodRange(period);
  const periodLabel = `${new Date(start).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })} — ${new Date(end).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}`;

  // KPI period + helpers (used both in Penilaian section and Mulai KPI)

  const kpiEndMonth    = Math.min(kpiStartMonth + (kpiPeriodLen === '6m' ? 5 : 11), 12);
  const kpiPeriodLabel = `${MN[kpiStartMonth - 1]}–${MN[kpiEndMonth - 1]} ${kpiYear}`;
  const kpiFiltered    = filterTeam === 'all' ? kpiMembers : kpiMembers.filter(m => m.team_type === filterTeam);

  const calcKPI = (m: KPIMember) => {
    const s = kpiSettings;
    const lcFailed = m.lcScores.filter(sc => sc < s.lcMinScore).length;
    const tickS = m.ticketsHandled > 0 ? Math.max(0, 1 - m.ticketsOverdue / Math.max(m.ticketsHandled, 1)) : 0;
    const bastS = m.formReviewTotal === 0 ? 0 : m.formReviewLowRating === 0 ? 1 : Math.max(0, 1 - m.formReviewLowRating / Math.max(m.formReviewTotal, 1));
    const lcS   = m.lcAttempts === 0 ? 0 : Math.max(0, 1 - lcFailed / Math.max(m.lcAttempts, 1));
    const rndS  = m.techNotesApproved >= s.rndTarget ? 1 : m.techNotesApproved / Math.max(s.rndTarget, 1);
    return Math.round((s.ticketOverdueWeight * tickS + s.bastWeight * bastS + s.lcWeight * lcS + s.rndWeight * rndS) * 100);
  };
  const kpiScoreColor = (score: number, noData: boolean) =>
    noData ? '#94a3b8' : score >= 85 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
  const kpiScoreLabel = (score: number, noData: boolean) =>
    noData ? 'Belum Ada Data' : score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work';

  // Guards

  if (!isLoggedIn || !appReady) return (
    <div className="flex items-center justify-center min-h-screen"
      style={{ backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="w-8 h-8 border-[3px] rounded-full animate-spin" style={{ borderColor: 'rgba(2,132,199,0.2)', borderTopColor: '#0284c7' }} />
    </div>
  );

  if (scopeReady && scope.kind === 'none') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3"
      style={{ backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <span className="text-5xl">🔒</span>
        <p className="text-slate-600 text-sm font-semibold">Akses Terbatas</p>
        <p className="text-slate-400 text-xs">Halaman ini hanya untuk Admin & Supervisor PTS</p>
      </div>
    </div>
  );

  // Ticket status breakdown for donut chart
  const donutSegments = [
    { value: summary.totalS,                                 color: STATUS_COLORS['Solved'] },
    { value: summary.totalOD,                                color: STATUS_COLORS['Overdue'] },
    { value: Math.max(0, summary.totalT - summary.totalS - summary.totalOD), color: STATUS_COLORS['Pending'] },
  ].filter(s => s.value > 0);

  // Render

  return (
    <div className="h-screen overflow-hidden flex flex-col"
      style={{ backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <PageHeader icon="📊" title="KPI Team" subtitle="PTS IVP — Key Performance Indicators"
        color={KPI_COLOR} colorLight="#0369a1">
        {scope.kind === 'team' && (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(14,165,233,0.12)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.3)' }}>
            👤 Profil KPI Saya
          </span>
        )}
        <button onClick={() => { fetchAllData(); fetchKPIMembers(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
          style={{ background: 'rgba(255,255,255,0.9)', borderColor: '#e2e8f0', color: '#64748b' }}>
          <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Sync
        </button>
        {scope.kind !== 'team' && (
          <>
            <button onClick={() => setShowStartKPI(true)}
              disabled={kpiLoading || kpiMembers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(16,185,129,0.9)', borderColor: '#059669', color: '#fff', boxShadow: '0 2px 8px rgba(16,185,129,0.4)' }}>
              🚀 Mulai KPI {kpiYear}
            </button>
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ background: 'rgba(255,255,255,0.9)', borderColor: '#ddd6fe', color: '#7c3aed' }}>
              <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Pengaturan KPI
            </button>
            <button onClick={() => exportKPIExcel(sortedMembers, period, kpiSettings, `${kpiYear}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ background: KPI_COLOR, borderColor: KPI_COLOR, color: '#fff', boxShadow: `0 2px 8px ${KPI_COLOR}40` }}>
              ⬇ Export KPI Excel
            </button>
          </>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        {/* ── Penilaian KPI (TOP — data mandiri, tidak ikut period picker) ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.7)' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">🏅 Penilaian KPI</span>
              <span className="text-[9px] font-bold px-2 py-1 rounded-lg text-blue-700" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                📅 {kpiPeriodLabel}
              </span>
              {kpiLoading && <div className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin flex-shrink-0" />}
            </div>
            {/* KPI period controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(['6m','1y'] as const).map(p => (
                  <button key={p} onClick={() => { setKpiPeriodLen(p); if (p==='1y') setKpiStartMonth(1); }}
                    className="px-2.5 py-1 text-[10px] font-bold transition-all"
                    style={{ background: kpiPeriodLen===p ? '#0284c7' : '#fff', color: kpiPeriodLen===p ? '#fff' : '#64748b' }}>
                    {p==='6m' ? '6 Bln' : '1 Thn'}
                  </button>
                ))}
              </div>
              {kpiPeriodLen === '6m' && (
                <select value={kpiStartMonth} onChange={e => setKpiStartMonth(Number(e.target.value))} aria-label="Periode enam bulan"
                  className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none">
                  {[{v:1,l:'Jan–Jun'},{v:2,l:'Feb–Jul'},{v:3,l:'Mar–Agt'},{v:4,l:'Apr–Sep'},{v:5,l:'Mei–Okt'},{v:6,l:'Jun–Nov'},{v:7,l:'Jul–Des'}].map(o=>(
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              )}
              <select value={kpiYear} onChange={e => setKpiYear(Number(e.target.value))} aria-label="Tahun"
                className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none">
                {[2024,2025,2026,2027].map(y=>(<option key={y} value={y}>{y}</option>))}
              </select>
              <button onClick={() => fetchKPIMembers()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 transition-all">
                <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Refresh
              </button>
              <span className="text-[9px] font-semibold px-2 py-1 rounded-lg text-slate-500" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                🎫{Math.round(kpiSettings.ticketOverdueWeight*100)}% ⭐{Math.round(kpiSettings.bastWeight*100)}% 🎓{Math.round(kpiSettings.lcWeight*100)}% 📝{Math.round(kpiSettings.rndWeight*100)}%
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl text-[11px] text-sky-700 leading-relaxed"
            style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <b>📌 Keterangan:</b> Data ✅ otomatis dari platform.&nbsp;
            <b>🎫 Ticketing</b> (nilai penuh jika 0 overdue) · <b>⭐ BAST &amp; Demo</b> (nilai penuh jika tidak ada bintang &lt;3) ·{' '}
            <b>🎓 LC</b> (nilai penuh jika tidak ada nilai &lt;{kpiSettings.lcMinScore}) ·{' '}
            <b>📝 R&D</b> (nilai penuh jika ≥{kpiSettings.rndTarget} tech note/tahun). Klik kartu untuk detail.
          </div>

          {/* Member chips */}
          {kpiLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
            </div>
          ) : kpiFiltered.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">Tidak ada anggota dengan KPI aktif. Aktifkan kpi_enabled di user management.</p>
          ) : (() => {
            // Urutan & isinya mengikuti lingkup akun ini - lihat catatan di
            // pemuatan anggota. Kelompok di luar lingkup tidak pernah sampai
            // ke kpiFiltered, jadi baris ini hanya menentukan urutan tampil.
            const teams = lingkupSaya(currentUser?.id);
            const rows = filterTeam === 'all'
              ? teams.map(tt => ({ tt, ms: kpiFiltered.filter(m => m.team_type === tt) })).filter(r => r.ms.length > 0)
              : [{ tt: filterTeam, ms: kpiFiltered }];

            return (
              <div className="p-4 space-y-3">
                {rows.map(({ tt, ms }) => {
                  const col = TEAM_COLORS[tt] ?? '#64748b';
                  const abbr = tt.replace('Team PTS ', '').replace('Team PTS IVP', 'IVP');
                  const scored = ms.filter(m => !(m.ticketsHandled === 0 && m.lcAttempts === 0 && m.techNotesApproved === 0));
                  const avg = scored.length ? Math.round(scored.reduce((s, m) => s + calcKPI(m), 0) / scored.length) : null;
                  const avgC = avg == null ? '#94a3b8' : avg >= 85 ? '#10b981' : avg >= 70 ? '#3b82f6' : avg >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={tt} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100" style={{ background: `${col}08` }}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{ background: col }}>{abbr[0]}</div>
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">{tt}</span>
                        <span className="text-[10px] text-slate-400">{ms.length} anggota</span>
                        {avg !== null && <span className="ml-auto text-sm font-black" style={{ color: avgC }}>avg {avg}%</span>}
                      </div>
                      <div className="flex gap-2 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {ms.map(m => {
                          const score = calcKPI(m);
                          const noData = m.ticketsHandled === 0 && m.lcAttempts === 0 && m.techNotesApproved === 0;
                          const c = kpiScoreColor(score, noData);
                          const lbl = kpiScoreLabel(score, noData);
                          const sparkMax = Math.max(...m.monthlyTickets, 1);
                          const W = 72, H = 18;
                          const pts = m.monthlyTickets.map((v, i) => `${(i / 11) * W},${H - (v / sparkMax) * H}`).join(' ');
                          const lcFailed = m.lcScores.filter(sc => sc < kpiSettings.lcMinScore).length;
                          const alerts: string[] = [];
                          if (m.ticketsHandled === 0) alerts.push('🎫0');
                          if (lcFailed > 0) alerts.push(`📚${lcFailed}×`);
                          if (m.formReviewLowRating > 0) alerts.push(`⭐${m.formReviewLowRating}×`);
                          if (m.ticketAvgResponseHours > 24) alerts.push(`⏱${m.ticketAvgResponseHours}j`);
                          return (
                            <div key={m.id} onClick={() => setSelectedKPIMember(m.id)}
                              className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border cursor-pointer hover:shadow-md transition-all"
                              style={{ background: noData ? '#f8fafc' : `${c}08`, borderColor: noData ? '#e2e8f0' : `${c}40`, minWidth: 88, maxWidth: 104 }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm flex-shrink-0"
                                style={{ background: `linear-gradient(135deg,${c},${c}88)` }}>
                                {m.name.charAt(0)}
                              </div>
                              <div className="text-[10px] font-bold text-slate-700 text-center leading-tight w-full truncate" title={m.name}>
                                {m.name.split(' ')[0]}
                              </div>
                              <div className="text-sm font-black leading-none" style={{ color: c }}>
                                {noData ? '—' : `${score}%`}
                              </div>
                              <div className="text-[8px] font-bold uppercase tracking-wide" style={{ color: c }}>{lbl}</div>
                              {m.monthlyTickets.some(v => v > 0) && (
                                <svg aria-hidden="true" focusable="false" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                                  <polyline points={pts} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
                                  <circle cx={W} cy={H - (m.monthlyTickets[11] / sparkMax) * H} r={2.5} fill={c} />
                                </svg>
                              )}
                              {alerts.length > 0 && (
                                <div className="flex gap-0.5 flex-wrap justify-center">
                                  {alerts.map((a, i) => (
                                    <span key={i} className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 leading-none">{a}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Period Selector Bar ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider mr-1 drop-shadow">Periode</span>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
              style={{
                background:   period === p ? KPI_COLOR : 'rgba(255,255,255,0.85)',
                color:        period === p ? '#fff' : '#64748b',
                borderColor:  period === p ? KPI_COLOR : 'rgba(255,255,255,0.6)',
                boxShadow:    period === p ? `0 2px 10px ${KPI_COLOR}50` : '0 1px 4px rgba(0,0,0,0.08)',
              }}>
              {PERIOD_EMOJI[p]} {p}
            </button>
          ))}
          <span className="ml-2 text-[10px] text-white/70 italic drop-shadow">{periodLabel}</span>

          {loading && (
            <div className="ml-2 w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin flex-shrink-0" />
          )}

          {/* Team filter — admin only */}
          {scope.kind === 'admin' && allTeamTypes.length > 1 && (
            <select aria-label="Semua Tim" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="ml-auto text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-sky-200">
              <option value="all">Semua Tim</option>
              {allTeamTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* ── Handler Performance Table ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.7)' }}>
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
            <input aria-label="Cari nama..."
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Cari nama..."
              className="text-[11px] border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-100 w-40"
            />
          </div>

          {/* ── MOBILE: kartu ringkas KPI per anggota (tap utk detail) ── */}
          <div className="md:hidden divide-y divide-gray-100">
            {!loading && sortedMembers.length === 0 && (
              <ListEmptyState
                adaFilterAktif={filterTeam !== 'all' || searchQ.trim() !== ''}
                onReset={() => { setFilterTeam('all'); setSearchQ(''); }}
                icon="📈"
                judulKosong={`Belum ada data KPI untuk ${period}`}
                deskripsiKosong="Angka terkumpul dari tiket & jadwal yang dikerjakan pada periode ini."
              />
            )}
            {!loading && sortedMembers.map((m) => {
              const solveRate = m.ticketsHandled > 0 ? Math.round((m.ticketsSolved / m.ticketsHandled) * 100) : 0;
              const remRate = m.remindersAssigned > 0 ? Math.round((m.remindersDone / m.remindersAssigned) * 100) : 0;
              const teamCol = TEAM_COLORS[m.team_type] ?? '#64748b';
              return (
                <MobileListCard
                  key={m.id}
                  title={m.name}
                  onClick={() => setDrillMember(m)}
                  meta={<div className="truncate">{m.team_type.replace('Team ', '')} · {m.jabatan}</div>}
                  badges={<MobileCardBadge style={{ background: `${teamCol}1a`, color: teamCol }}>{m.ticketsHandled} tiket</MobileCardBadge>}
                  fields={[
                    { label: 'Solve', value: `${solveRate}%` },
                    { label: 'Avg', value: m.avgResolutionDays === 0 ? '—' : `${m.avgResolutionDays}h` },
                    { label: 'Reminder', value: `${remRate}%` },
                    { label: 'LC', value: m.lcAvgScore === 0 ? '—' : m.lcAvgScore },
                    { label: 'Piket', value: `${m.piketFilled} hari` },
                    { label: 'Overdue', value: m.ticketsOverdue, hide: m.ticketsOverdue === 0, valueClass: 'text-red-500 font-bold' },
                  ]}
                />
              );
            })}
          </div>

          {/* ── DESKTOP: tabel KPI penuh (TIDAK diubah) ── */}
          <div className="hidden md:block overflow-x-auto">
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

        {/* ── Riwayat KPI ── */}
        {false && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">🏅 Penilaian KPI</span>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-lg text-blue-700" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    📅 {kpiPeriodLabel}
                  </span>
                  {kpiLoading && <div className="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin flex-shrink-0" />}
                </div>
                {/* KPI period controls */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* 6m / 1y toggle */}
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                    {(['6m','1y'] as const).map(p => (
                      <button key={p} onClick={() => { setKpiPeriodLen(p); if (p==='1y') setKpiStartMonth(1); }}
                        className="px-2.5 py-1 text-[10px] font-bold transition-all"
                        style={{ background: kpiPeriodLen===p ? '#0284c7' : '#fff', color: kpiPeriodLen===p ? '#fff' : '#64748b' }}>
                        {p==='6m' ? '6 Bln' : '1 Thn'}
                      </button>
                    ))}
                  </div>
                  {/* Start month (only for 6m) */}
                  {kpiPeriodLen === '6m' && (
                    <select value={kpiStartMonth} onChange={e => setKpiStartMonth(Number(e.target.value))}
                      className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none">
                      {[{v:1,l:'Jan–Jun'},{v:2,l:'Feb–Jul'},{v:3,l:'Mar–Agt'},{v:4,l:'Apr–Sep'},{v:5,l:'Mei–Okt'},{v:6,l:'Jun–Nov'},{v:7,l:'Jul–Des'}].map(o=>(
                        <option key={o.v} value={o.v}>{o.l}</option>
                      ))}
                    </select>
                  )}
                  {/* Year */}
                  <select value={kpiYear} onChange={e => setKpiYear(Number(e.target.value))}
                    className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none">
                    {[2024,2025,2026,2027].map(y=>(<option key={y} value={y}>{y}</option>))}
                  </select>
                  <button onClick={() => fetchKPIMembers()}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 transition-all">
                    <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Refresh
                  </button>
                  <span className="text-[9px] font-semibold px-2 py-1 rounded-lg text-slate-500" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    🎫{Math.round(kpiSettings.ticketOverdueWeight*100)}% ⭐{Math.round(kpiSettings.bastWeight*100)}% 🎓{Math.round(kpiSettings.lcWeight*100)}% 📝{Math.round(kpiSettings.rndWeight*100)}%
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl text-[11px] text-sky-700 leading-relaxed"
                style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <b>📌 Keterangan:</b> Data ✅ otomatis dari platform.&nbsp;
                <b>🎫 Ticketing</b> (nilai penuh jika 0 overdue) · <b>⭐ BAST &amp; Demo</b> (nilai penuh jika tidak ada bintang &lt;3) ·{' '}
                <b>🎓 LC</b> (nilai penuh jika tidak ada nilai &lt;{kpiSettings.lcMinScore}) ·{' '}
                <b>📝 R&D</b> (nilai penuh jika ≥{kpiSettings.rndTarget} tech note/tahun). Klik kartu untuk detail.
              </div>

              {/* Member chips */}
              {kpiLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                </div>
              ) : kpiFiltered.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm">Tidak ada anggota dengan KPI aktif. Aktifkan kpi_enabled di user management.</p>
              ) : (() => {
                // Urutan & isinya mengikuti lingkup akun ini - lihat catatan di
            // pemuatan anggota. Kelompok di luar lingkup tidak pernah sampai
            // ke kpiFiltered, jadi baris ini hanya menentukan urutan tampil.
            const teams = lingkupSaya(currentUser?.id);
                const rows = filterTeam === 'all'
                  ? teams.map(tt => ({ tt, ms: kpiFiltered.filter(m => m.team_type === tt) })).filter(r => r.ms.length > 0)
                  : [{ tt: filterTeam, ms: kpiFiltered }];

                return (
                  <div className="p-4 space-y-3">
                    {rows.map(({ tt, ms }) => {
                      const col = TEAM_COLORS[tt] ?? '#64748b';
                      const abbr = tt.replace('Team PTS ', '').replace('Team PTS IVP', 'IVP');
                      const scored = ms.filter(m => !(m.ticketsHandled === 0 && m.lcAttempts === 0 && m.techNotesApproved === 0));
                      const avg = scored.length ? Math.round(scored.reduce((s, m) => s + calcKPI(m), 0) / scored.length) : null;
                      const avgC = avg == null ? '#94a3b8' : avg >= 85 ? '#10b981' : avg >= 70 ? '#3b82f6' : avg >= 50 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={tt} className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100" style={{ background: `${col}08` }}>
                            <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{ background: col }}>{abbr[0]}</div>
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">{tt}</span>
                            <span className="text-[10px] text-slate-400">{ms.length} anggota</span>
                            {avg !== null && <span className="ml-auto text-sm font-black" style={{ color: avgC }}>avg {avg}%</span>}
                          </div>
                          <div className="flex gap-2 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                            {ms.map(m => {
                              const score = calcKPI(m);
                              const noData = m.ticketsHandled === 0 && m.lcAttempts === 0 && m.techNotesApproved === 0;
                              const c = kpiScoreColor(score, noData);
                              const lbl = kpiScoreLabel(score, noData);
                              const sparkMax = Math.max(...m.monthlyTickets, 1);
                              const W = 72, H = 18;
                              const pts = m.monthlyTickets.map((v, i) => `${(i / 11) * W},${H - (v / sparkMax) * H}`).join(' ');
                              const lcFailed = m.lcScores.filter(sc => sc < kpiSettings.lcMinScore).length;
                              const alerts: string[] = [];
                              if (m.ticketsHandled === 0) alerts.push('🎫0');
                              if (lcFailed > 0) alerts.push(`📚${lcFailed}×`);
                              if (m.formReviewLowRating > 0) alerts.push(`⭐${m.formReviewLowRating}×`);
                              if (m.ticketAvgResponseHours > 24) alerts.push(`⏱${m.ticketAvgResponseHours}j`);
                              return (
                                <div key={m.id} onClick={() => setSelectedKPIMember(m.id)}
                                  className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border cursor-pointer hover:shadow-md transition-all"
                                  style={{ background: noData ? '#f8fafc' : `${c}08`, borderColor: noData ? '#e2e8f0' : `${c}40`, minWidth: 88, maxWidth: 104 }}>
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white shadow-sm flex-shrink-0"
                                    style={{ background: `linear-gradient(135deg,${c},${c}88)` }}>
                                    {m.name.charAt(0)}
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-700 text-center leading-tight w-full truncate" title={m.name}>
                                    {m.name.split(' ')[0]}
                                  </div>
                                  <div className="text-sm font-black leading-none" style={{ color: c }}>
                                    {noData ? '—' : `${score}%`}
                                  </div>
                                  <div className="text-[8px] font-bold uppercase tracking-wide" style={{ color: c }}>{lbl}</div>
                                  {m.monthlyTickets.some(v => v > 0) && (
                                    <svg aria-hidden="true" focusable="false" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                                      <polyline points={pts} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
                                      <circle cx={W} cy={H - (m.monthlyTickets[11] / sparkMax) * H} r={2.5} fill={c} />
                                    </svg>
                                  )}
                                  {alerts.length > 0 && (
                                    <div className="flex gap-0.5 flex-wrap justify-center">
                                      {alerts.map((a, i) => (
                                        <span key={i} className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 leading-none">{a}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
        )}

        {/* ── Riwayat KPI (Snapshot History) ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.7)' }}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">📋 Riwayat KPI</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>{kpiSnapshots.length} periode tersimpan</span>
            </div>
            {expandedSnapshot && (
              <button onClick={() => setExpandedSnapshot(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
                ← Kembali ke Daftar
              </button>
            )}
          </div>

          {kpiSnapshots.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">
              Belum ada riwayat KPI. Klik 🚀 <b>Mulai KPI {kpiYear}</b> untuk menyimpan penilaian periode ini.
            </p>
          ) : expandedSnapshot ? (() => {
            const snap = kpiSnapshots.find(s => s.id === expandedSnapshot);
            if (!snap) return null;
            const snapMs = snap.members_json;
            const avgFin = snapMs.length ? Math.round(snapMs.reduce((s, m) => s + m.finalKPI, 0) / snapMs.length) : 0;
            const avgC   = avgFin >= 85 ? '#10b981' : avgFin >= 70 ? '#3b82f6' : avgFin >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="font-bold text-slate-700">{snap.period_label}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>
                    {snap.period === '1y' ? '1 Tahun' : '6 Bulan'}
                  </span>
                  <span className="text-xs text-slate-400">oleh <b className="text-slate-600">{snap.created_by}</b></span>
                  <span className="text-xs text-slate-400">{new Date(snap.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</span>
                  <span className="ml-auto text-sm font-black" style={{ color: avgC }}>Avg Tim: {avgFin}%</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        {['Nama','🎫 Ticketing','⭐ BAST','🎓 LC','📝 R&D','KPI Final'].map((h, i) => (
                          <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap ${i===0?'text-left':'text-center'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {snapMs.map((m, idx) => {
                        const c   = m.finalKPI >= 85 ? '#10b981' : m.finalKPI >= 70 ? '#3b82f6' : m.finalKPI >= 50 ? '#f59e0b' : '#ef4444';
                        const lbl = m.finalKPI >= 85 ? 'Excellent' : m.finalKPI >= 70 ? 'Good' : m.finalKPI >= 50 ? 'Fair' : 'Needs Work';
                        const tc  = TEAM_COLORS[m.team_type] ?? '#64748b';
                        const sc  = (v: number) => v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444';
                        return (
                          <tr key={m.id} className="cursor-pointer transition-colors"
                            style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                            onClick={() => setSelectedSnapMember(m.id + '__' + snap.id)}
                            onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                            onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                                  style={{ background: `linear-gradient(135deg,${tc},${tc}cc)` }}>{m.name.charAt(0)}</div>
                                <div>
                                  <div className="font-semibold text-slate-700 leading-tight">{m.name}</div>
                                  <div className="text-[9px] text-slate-400">{m.team_type.replace('Team ','')}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.tickScore) }}>{m.tickScore}%</span></td>
                            <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.bastScore) }}>{m.bastScore}%</span></td>
                            <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.lcScore) }}>{m.lcScore}%</span></td>
                            <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.rndScore) }}>{m.rndScore}%</span></td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-base font-black" style={{ color: c }}>{m.finalKPI}%</span>
                                <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: c }}>{lbl}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const at = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.tickScore,0)/snapMs.length) : 0;
                        const ab = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.bastScore,0)/snapMs.length) : 0;
                        const al = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.lcScore,0)/snapMs.length) : 0;
                        const ar = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.rndScore,0)/snapMs.length) : 0;
                        return (
                          <tr style={{ background: '#f0f9ff', borderTop: '2px solid #bae6fd' }}>
                            <td className="px-3 py-2 font-black text-sky-700 text-xs">RATA-RATA TIM</td>
                            {[at,ab,al,ar].map((v,i) => <td key={i} className="px-3 py-2 text-center font-black text-sky-600">{v}%</td>)}
                            <td className="px-3 py-2 text-center font-black text-sky-600 text-base">{avgFin}%</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })() : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Periode','Anggota','Avg KPI','Distribusi','Disimpan oleh','Tanggal','Aksi'].map((h,i) => (
                      <th key={h} className={`px-4 py-2.5 font-bold text-slate-500 whitespace-nowrap ${i===0||i===4?'text-left':'text-center'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {kpiSnapshots.map((snap, idx) => {
                    const ms  = snap.members_json;
                    const avg = ms.length ? Math.round(ms.reduce((s,m)=>s+m.finalKPI,0)/ms.length) : 0;
                    const exc = ms.filter(m=>m.finalKPI>=85).length;
                    const gd  = ms.filter(m=>m.finalKPI>=70&&m.finalKPI<85).length;
                    const fr  = ms.filter(m=>m.finalKPI>=50&&m.finalKPI<70).length;
                    const nw  = ms.filter(m=>m.finalKPI<50).length;
                    const c   = avg >= 85 ? '#10b981' : avg >= 70 ? '#3b82f6' : avg >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={snap.id} className="cursor-pointer transition-colors"
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                        onClick={() => setExpandedSnapshot(snap.id)}
                        onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-700">{snap.period_label}</div>
                          <div className="text-[9px] text-slate-400">{snap.period === '1y' ? '1 Tahun' : '6 Bulan'}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-slate-700">{ms.length}</span>
                          <div className="text-[9px] text-slate-400">anggota</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-black" style={{ color: c }}>{avg}%</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-center flex-wrap">
                            {exc > 0 && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">{exc} Excellent</span>}
                            {gd > 0  && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700">{gd} Good</span>}
                            {fr > 0  && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">{fr} Fair</span>}
                            {nw > 0  && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600">{nw} NW</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{snap.created_by}</td>
                        <td className="px-4 py-3 text-center text-slate-400">{new Date(snap.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={e => { e.stopPropagation(); setExpandedSnapshot(snap.id); }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-sky-600 hover:bg-sky-50 border border-sky-200 transition-all">
                            Detail →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
      </div>{/* end flex-1 overflow-y-auto */}

      {/* ── Drill-down Modal (Performance) ── */}
      {drillMember && (
        <DrillModal member={drillMember} period={period} onClose={() => setDrillMember(null)} />
      )}

      {/* ── KPI Member Detail Popup ── */}
      {selectedKPIMember && typeof document !== 'undefined' && (() => {
        const member = kpiMembers.find(m => m.id === selectedKPIMember);
        if (!member) return null;
        const _s = kpiSettings;
        const lcFailed = member.lcScores.filter(sc => sc < _s.lcMinScore).length;
        const tickScore = member.ticketsHandled > 0 ? Math.max(0, 1 - member.ticketsOverdue / Math.max(member.ticketsHandled, 1)) : 0;
        const bastScore = member.formReviewTotal === 0 ? 0 : member.formReviewLowRating === 0 ? 1 : Math.max(0, 1 - member.formReviewLowRating / Math.max(member.formReviewTotal, 1));
        const lcScore   = member.lcAttempts === 0 ? 0 : Math.max(0, 1 - lcFailed / Math.max(member.lcAttempts, 1));
        const rndScore  = member.techNotesApproved >= _s.rndTarget ? 1 : member.techNotesApproved / Math.max(_s.rndTarget, 1);
        const finalKPI  = Math.round((_s.ticketOverdueWeight * tickScore + _s.bastWeight * bastScore + _s.lcWeight * lcScore + _s.rndWeight * rndScore) * 100);
        const noData    = member.ticketsHandled === 0 && member.lcAttempts === 0 && member.techNotesApproved === 0;
        const c         = noData ? '#94a3b8' : finalKPI >= 85 ? '#10b981' : finalKPI >= 70 ? '#3b82f6' : finalKPI >= 50 ? '#f59e0b' : '#ef4444';

        return createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedKPIMember(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto" style={{ maxHeight: '100%', scrollbarWidth: 'thin' }}>

              {/* Modal header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg,${c},${c}99)` }}>
                  {member.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-sm truncate">{member.name}</div>
                  <div className="text-xs text-slate-400">{member.jabatan} · {member.team_type}</div>
                </div>
                <div className="flex flex-col items-end mr-1 flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: c }}>{noData ? '—' : `${finalKPI}%`}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">KPI Score</div>
                </div>
                <button aria-label="Tutup" onClick={() => setSelectedKPIMember(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Score breakdown cards */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Ticketing',      raw: Math.round(tickScore * 100), pct: Math.round(tickScore * _s.ticketOverdueWeight * 100), w: Math.round(_s.ticketOverdueWeight * 100), color: '#ef4444', icon: '🎫', bg: '#fef2f2', border: '#ef444440' },
                    { label: 'BAST & Demo',    raw: Math.round(bastScore * 100),  pct: Math.round(bastScore * _s.bastWeight * 100),          w: Math.round(_s.bastWeight * 100),          color: '#f59e0b', icon: '⭐', bg: '#fffbeb', border: '#f59e0b40' },
                    { label: 'Learning Center',raw: Math.round(lcScore * 100),    pct: Math.round(lcScore * _s.lcWeight * 100),              w: Math.round(_s.lcWeight * 100),            color: '#6366f1', icon: '🎓', bg: '#f5f3ff', border: '#6366f140' },
                    { label: 'R&D Tech Note',  raw: Math.round(rndScore * 100),   pct: Math.round(rndScore * _s.rndWeight * 100),            w: Math.round(_s.rndWeight * 100),           color: '#ec4899', icon: '📝', bg: '#fdf4ff', border: '#ec489940' },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl border p-2 text-center" style={{ background: k.bg, borderColor: k.border }}>
                      <div className="text-xs mb-0.5">{k.icon}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight mb-1">{k.label}</div>
                      <div className="text-lg font-black leading-none" style={{ color: k.color }}>{k.pct}%</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">bobot {k.w}%</div>
                    </div>
                  ))}
                </div>

                {/* Auto platform data */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">✅ Data Platform (Otomatis)</div>
                  <div className="grid grid-cols-3 gap-2">

                    {/* Ticketing */}
                    <div className="rounded-xl border p-3" style={{ borderColor: '#ef444440', background: '#fef2f2' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">🎫 Ticketing</div>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: tickScore >= 1 ? '#d1fae5' : '#fee2e2', color: tickScore >= 1 ? '#065f46' : '#991b1b' }}>
                          {Math.round(tickScore * _s.ticketOverdueWeight * 100)}/{Math.round(_s.ticketOverdueWeight * 100)}%
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <div className="flex justify-between"><span>Handled</span><b className="text-slate-800">{member.ticketsHandled}</b></div>
                        <div className="flex justify-between"><span>Solved</span><b className="text-emerald-600">{member.ticketsSolved}</b></div>
                        <div className="flex justify-between"><span>Overdue</span><b className={member.ticketsOverdue > 0 ? 'text-red-600' : 'text-emerald-600'}>{member.ticketsOverdue}</b></div>
                        <div className="flex justify-between"><span>Avg Response</span><b className={member.ticketAvgResponseHours > 24 ? 'text-red-600' : 'text-emerald-600'}>{member.ticketAvgResponseHours > 0 ? `${member.ticketAvgResponseHours}j` : '—'}</b></div>
                        {member.ticketsOverdue === 0
                          ? <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Tidak ada overdue</div>
                          : <div className="text-[10px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1">⚠ {member.ticketsOverdue} ticket overdue</div>}
                      </div>
                    </div>

                    {/* BAST & Demo */}
                    <div className="rounded-xl border p-3" style={{ borderColor: '#f59e0b40', background: '#fffbeb' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">⭐ BAST &amp; Demo</div>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: bastScore >= 1 ? '#d1fae5' : '#fee2e2', color: bastScore >= 1 ? '#065f46' : '#991b1b' }}>
                          {Math.round(bastScore * _s.bastWeight * 100)}/{Math.round(_s.bastWeight * 100)}%
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <div className="text-[9px] text-slate-400 mb-1">Sumber: Form Review BAST &amp; Demo</div>
                        <div className="flex justify-between"><span>Total Review</span><b className="text-slate-800">{member.formReviewTotal}</b></div>
                        <div className="flex justify-between"><span>Komplain (★1-2)</span><b className={member.formReviewLowRating > 0 ? 'text-red-600' : 'text-emerald-600'}>{member.formReviewLowRating}x</b></div>
                        {member.formReviewTotal === 0
                          ? <div className="text-[10px] text-slate-400 font-semibold bg-slate-50 rounded-lg px-2 py-1">⏳ Belum ada review</div>
                          : member.formReviewLowRating === 0
                            ? <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Tidak ada komplain dari {member.formReviewTotal} review</div>
                            : <div className="text-[10px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1">⚠ {member.formReviewLowRating}x komplain dari {member.formReviewTotal} review</div>}
                      </div>
                    </div>

                    {/* Learning Center */}
                    <div className="rounded-xl border p-3" style={{ borderColor: '#6366f140', background: '#f5f3ff' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">🎓 Learning Center</div>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: lcScore >= 1 ? '#d1fae5' : '#fee2e2', color: lcScore >= 1 ? '#065f46' : '#991b1b' }}>
                          {Math.round(lcScore * _s.lcWeight * 100)}/{Math.round(_s.lcWeight * 100)}%
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        <div className="text-[9px] text-slate-400 mb-1">Nilai penuh jika tidak ada &lt;{_s.lcMinScore}</div>
                        <div className="flex justify-between"><span>Total Attempt</span><b className="text-slate-800">{member.lcAttempts}</b></div>
                        <div className="flex justify-between"><span>Avg Score</span><b className={member.lcAvgScore < _s.lcMinScore && member.lcAvgScore > 0 ? 'text-red-600' : 'text-emerald-600'}>{member.lcAvgScore || '—'}</b></div>
                        <div className="flex justify-between"><span>Lulus</span><b className="text-emerald-600">{member.lcPassed}</b></div>
                        <div className="flex justify-between"><span>Nilai &lt;{_s.lcMinScore}</span><b className={lcFailed > 0 ? 'text-red-600' : 'text-emerald-600'}>{lcFailed}x</b></div>
                        {lcFailed > 0
                          ? <div className="text-[10px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1">⚠ {lcFailed}x nilai &lt;{_s.lcMinScore}</div>
                          : member.lcAttempts > 0
                            ? <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1">✓ Semua nilai ≥{_s.lcMinScore}</div>
                            : null}
                      </div>
                    </div>
                  </div>

                  {/* Reminder & Piket */}
                  <div className="mt-2 bg-slate-50 rounded-xl border border-slate-100 p-3 text-[11px] text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
                    <span>📅 Reminder: <b className="text-slate-800">{member.remindersDone}</b>/{member.remindersAssigned} done</span>
                    <span>🏪 Piket: <b className="text-slate-800">{member.piketFilled}</b> hari bertugas</span>
                    <span>⏱ Avg response: <b className={member.ticketAvgResponseHours > 24 ? 'text-red-600 text-slate-800' : 'text-slate-800'}>{member.ticketAvgResponseHours > 0 ? `${member.ticketAvgResponseHours} jam` : '—'}</b></span>
                  </div>
                </div>

                {/* R&D Tech Note */}
                <div className="rounded-xl border p-3" style={{ borderColor: '#ec489940', background: '#fdf4ff' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-pink-600 uppercase tracking-wider">📝 R&amp;D Tech Note (Otomatis dari Platform)</div>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: rndScore >= 1 ? '#d1fae5' : '#fee2e2', color: rndScore >= 1 ? '#065f46' : '#991b1b' }}>
                      {Math.round(rndScore * _s.rndWeight * 100)}/{Math.round(_s.rndWeight * 100)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2">
                    Target: <b className="text-slate-700">{_s.rndTarget} Tech Note approved</b> per tahun
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-black" style={{ color: rndScore >= 1 ? '#059669' : '#dc2626' }}>{member.techNotesApproved}</span>
                    <span className="text-[10px] text-slate-400 font-medium">/ {_s.rndTarget}</span>
                    <div className="h-2 flex-1 rounded-full bg-pink-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, rndScore * 100)}%`, background: rndScore >= 1 ? '#10b981' : '#f472b6' }} />
                    </div>
                  </div>
                  {member.techNotesApproved === 0
                    ? <div className="text-[10px] text-red-500 font-semibold bg-red-50 rounded-lg px-2 py-1.5">⚠️ Belum ada Tech Note yang diapprove tahun ini</div>
                    : member.techNotesApproved >= _s.rndTarget
                      ? <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 rounded-lg px-2 py-1.5">✅ KKM Tech Note terpenuhi ({member.techNotesApproved}/{_s.rndTarget})</div>
                      : <div className="text-[10px] text-amber-600 font-semibold bg-amber-50 rounded-lg px-2 py-1.5">⏳ Kurang {_s.rndTarget - member.techNotesApproved} Tech Note lagi</div>}
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── Mulai KPI Confirm Modal ── */}
      {showStartKPI && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowStartKPI(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>🚀</div>
              <div>
                <div className="font-bold text-slate-800 text-base">Mulai KPI {kpiYear}</div>
                <div className="text-xs text-slate-400 mt-0.5">Simpan snapshot penilaian KPI periode ini</div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-4 text-sm text-slate-600 leading-relaxed" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <b>📋 Ringkasan yang akan disimpan:</b>
                <ul className="mt-2 space-y-1 list-disc list-inside text-slate-500">
                  <li>Periode: <b className="text-slate-700">{kpiPeriodLabel}</b></li>
                  <li>Anggota: <b className="text-slate-700">{kpiMembers.length} orang</b></li>
                  <li>Bobot: 🎫{Math.round(kpiSettings.ticketOverdueWeight*100)}% ⭐{Math.round(kpiSettings.bastWeight*100)}% 🎓{Math.round(kpiSettings.lcWeight*100)}% 📝{Math.round(kpiSettings.rndWeight*100)}%</li>
                </ul>
              </div>
              <p className="text-sm text-slate-500">
                Data KPI akan dibekukan dan disimpan ke Riwayat KPI. Proses ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-5 justify-end">
              <button onClick={() => setShowStartKPI(false)} disabled={savingSnapshot}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Batal
              </button>
              <button onClick={() => saveKPISnapshot()} disabled={savingSnapshot}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 2px 8px rgba(16,185,129,0.4)' }}>
                {savingSnapshot ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan…</>
                ) : (
                  <>🚀 Simpan KPI</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Snapshot Member Detail Popup ── */}
      {selectedSnapMember && typeof document !== 'undefined' && (() => {
        const [memberId, snapId] = selectedSnapMember.split('__');
        const snap = kpiSnapshots.find(s => s.id === snapId);
        const m    = snap?.members_json.find(x => x.id === memberId);
        if (!snap || !m) return null;
        const c   = m.finalKPI >= 85 ? '#10b981' : m.finalKPI >= 70 ? '#3b82f6' : m.finalKPI >= 50 ? '#f59e0b' : '#ef4444';
        const lbl = m.finalKPI >= 85 ? 'Excellent' : m.finalKPI >= 70 ? 'Good' : m.finalKPI >= 50 ? 'Fair' : 'Needs Work';
        const tc  = TEAM_COLORS[m.team_type] ?? '#64748b';
        const sc  = (v: number) => v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444';
        return createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedSnapMember(null); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto" style={{ maxHeight: '100%' }}>
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white flex-shrink-0"
                  style={{ background: `linear-gradient(135deg,${tc},${tc}cc)` }}>{m.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 text-sm truncate">{m.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    {m.jabatan} · {m.team_type}
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>🔒 Snapshot</span>
                  </div>
                </div>
                <div className="flex flex-col items-end mr-1 flex-shrink-0">
                  <div className="text-2xl font-black" style={{ color: c }}>{m.finalKPI}%</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: c }}>{lbl}</div>
                </div>
                <button aria-label="Tutup" onClick={() => setSelectedSnapMember(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all flex-shrink-0">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-[10px] text-slate-400 text-center italic">📅 {snap.period_label} — Data dibekukan pada {new Date(snap.created_at).toLocaleDateString('id-ID')}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Ticketing', val: m.tickScore, color: '#ef4444', icon: '🎫', bg: '#fef2f2' },
                    { label: 'BAST',      val: m.bastScore,  color: '#f59e0b', icon: '⭐', bg: '#fffbeb' },
                    { label: 'LC',        val: m.lcScore,    color: '#6366f1', icon: '🎓', bg: '#f5f3ff' },
                    { label: 'R&D',       val: m.rndScore,   color: '#ec4899', icon: '📝', bg: '#fdf4ff' },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl border p-2 text-center" style={{ background: k.bg, borderColor: `${k.color}40` }}>
                      <div className="text-xs mb-0.5">{k.icon}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-tight mb-1">{k.label}</div>
                      <div className="text-lg font-black" style={{ color: sc(k.val) }}>{k.val}%</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between"><span>Tickets Handled</span><b className="text-slate-800">{m.ticketsHandled}</b></div>
                  <div className="flex justify-between"><span>Tickets Overdue</span><b className={m.ticketsOverdue > 0 ? 'text-red-600' : 'text-emerald-600'}>{m.ticketsOverdue}</b></div>
                  <div className="flex justify-between"><span>LC Attempts</span><b className="text-slate-800">{m.lcAttempts}</b></div>
                  <div className="flex justify-between"><span>LC Passed</span><b className="text-emerald-600">{m.lcPassed}</b></div>
                  <div className="flex justify-between"><span>Form Reviews</span><b className="text-slate-800">{m.formReviewTotal}</b></div>
                  <div className="flex justify-between"><span>Review Komplain</span><b className={m.formReviewLowRating > 0 ? 'text-red-600' : 'text-emerald-600'}>{m.formReviewLowRating}x</b></div>
                  <div className="flex justify-between"><span>Tech Notes Approved</span><b className="text-slate-800">{m.techNotesApproved}</b></div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── KPI Settings Modal ── */}
      {showSettings && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800 text-base">⚙️ Pengaturan KPI</div>
                <div className="text-xs text-slate-400 mt-0.5">Atur batas & bobot masing-masing komponen</div>
              </div>
              <button aria-label="Tutup" onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">✕</button>
            </div>
            <div className="p-6 space-y-5">
              {/* LC Min Score */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">🎓 Learning Center — Batas Nilai Minimum</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={40} max={85} step={5} value={kpiSettings.lcMinScore}
                    onChange={e => setKpiSettings(p => ({ ...p, lcMinScore: Number(e.target.value) }))}
                    className="flex-1 accent-violet-600" />
                  <span className="text-lg font-black text-violet-600 w-12 text-right">&lt;{kpiSettings.lcMinScore}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Nilai di bawah ini dianggap tidak lulus KPI LC</div>
              </div>
              {/* RnD Target */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">📝 R&D Tech Note — Target per Tahun</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={8} step={1} value={kpiSettings.rndTarget}
                    onChange={e => setKpiSettings(p => ({ ...p, rndTarget: Number(e.target.value) }))}
                    className="flex-1 accent-pink-600" />
                  <span className="text-lg font-black text-pink-600 w-12 text-right">{kpiSettings.rndTarget}x</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Minimal Tech Note approved per tahun untuk nilai penuh</div>
              </div>
              {/* Bobot */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">📊 Bobot Komponen KPI (total harus 100%)</label>
                <div className="space-y-3">
                  {([
                    { key: 'ticketOverdueWeight' as keyof KPISettings, label: '🎫 Ticketing',      color: '#ef4444' },
                    { key: 'bastWeight'           as keyof KPISettings, label: '⭐ BAST & Demo',    color: '#f59e0b' },
                    { key: 'lcWeight'             as keyof KPISettings, label: '🎓 Learning Center',color: '#6366f1' },
                    { key: 'rndWeight'            as keyof KPISettings, label: '📝 R&D Tech Note',  color: '#ec4899' },
                  ]).map(item => (
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 w-36 flex-shrink-0">{item.label}</span>
                      <input type="range" min={5} max={60} step={5}
                        value={Math.round((kpiSettings[item.key] as number) * 100)}
                        onChange={e => setKpiSettings(p => ({ ...p, [item.key]: Number(e.target.value) / 100 }))}
                        className="flex-1" style={{ accentColor: item.color }} />
                      <span className="text-xs font-black w-10 text-right" style={{ color: item.color }}>
                        {Math.round((kpiSettings[item.key] as number) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total bobot sekarang:</span>
                  <span className={`text-xs font-black ${Math.round((kpiSettings.ticketOverdueWeight + kpiSettings.bastWeight + kpiSettings.lcWeight + kpiSettings.rndWeight) * 100) === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Math.round((kpiSettings.ticketOverdueWeight + kpiSettings.bastWeight + kpiSettings.lcWeight + kpiSettings.rndWeight) * 100)}%
                    {Math.round((kpiSettings.ticketOverdueWeight + kpiSettings.bastWeight + kpiSettings.lcWeight + kpiSettings.rndWeight) * 100) === 100 ? ' ✓' : ' ⚠ harus 100%'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5 justify-end">
              <button onClick={() => { setKpiSettings(DEFAULT_KPI_SETTINGS); saveKpiSettings(DEFAULT_KPI_SETTINGS); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Reset Default
              </button>
              <button onClick={() => { saveKpiSettings(kpiSettings); setShowSettings(false); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
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
