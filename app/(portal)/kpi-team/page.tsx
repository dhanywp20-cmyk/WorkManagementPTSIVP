'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { PageHeader, MobileListCard, MobileCardBadge, MiniSpark, ListEmptyState } from '@/components/shared';
import { notifyKPIAlert } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { lingkupSaya, muatKelompok, namaKelompokPTS } from '@/lib/kelompok';
import { hitungSkorKPI, KPIUser, KPIMember, KPISettings, DEFAULT_KPI_SETTINGS, KPIPeriodSnapshot, Scope, PeriodKey, SortKey, SortDir, PERIODS, PERIOD_EMOJI, TEAM_COLORS, warnaTim, STATUS_COLORS, MN, KPI_COLOR, fmt, getPeriodRange } from './_components/shared';
import { bacaPicPiket } from '@/app/(portal)/picket-showroom/_components/shared';
import { ambilRekapLCTahunan, REKAP_LC_KOSONG } from '@/lib/kpi-lc-tahunan';
import { ingat } from '@/lib/cache-singkat';
import { saringSumberKPI, type SumberKPI } from '@/lib/kpi-sumber';
import { DrillModal, ProgressBar } from './_components/DrillModal';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ModalPengaturanKPI } from './_components/ModalPengaturanKPI';
import { ModalDetailSnapshot } from './_components/ModalDetailSnapshot';
import { ModalMulaiKPI } from './_components/ModalMulaiKPI';
import { ModalDetailAnggotaKPI } from './_components/ModalDetailAnggotaKPI';
import { BagianRiwayatKPI } from './_components/BagianRiwayatKPI';
import { TabelKinerjaHandler } from './_components/TabelKinerjaHandler';
import { BagianPenilaianKPI } from './_components/BagianPenilaianKPI';

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
      if (['admin', 'superadmin'].includes(role) || hasFullAccess(currentUser) || isPimpinan(currentUser)) {
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

  /** 7 tabel sumber penilaian untuk anggota & rentang ini (lihat lib/kpi-sumber.ts). */
  const ambilSumber = useCallback(async (membersData: any[], start: string, end: string): Promise<SumberKPI> => {
    const endFull   = end + 'T23:59:59';
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
      supabase.from('piket_schedules').select('pic,pic_ivp_name,pic_ump_name,pic_mvi_name,pic_ivp_id,pic_ump_id,pic_mvi_id,day_date')
        .gte('day_date', start).lte('day_date', end),
      supabase.from('form_reviews')
        .select('id,assign_name,grade_product_knowledge,grade_training_customer,grade_product_knowledge_bast,created_at')
        .in('assign_name', mNames).gte('created_at', start).lte('created_at', endFull)
        .not('grade_product_knowledge_bast', 'is', null),
      supabase.from('tech_notes').select('id,author_id,status,reviewed_at')
        .in('author_id', mIds).eq('status', 'approved')
        .gte('reviewed_at', start).lte('reviewed_at', endFull),
    ]);
    return {
      tickets: (ticketsR.data ?? []) as any[],
      actLogs: (actR.data ?? []) as any[],
      reminders: (remR.data ?? []) as any[],
      lcAttempts: (lcR.data ?? []) as any[],
      piketRows: (piketR.data ?? []) as any[],
      formReviews: (formRevR.data ?? []) as any[],
      techNotes: (techNotesR.data ?? []) as any[],
    };
  }, []);

  /**
   * `sumberGabung` = baris sumber yang sudah diambil untuk rentang lebih lebar (periode ini +
   * sebelumnya) - dipilah ke [start, end] tanpa bertanya ke Supabase lagi.
   */
  const buildMembers = useCallback(async (membersData: any[], start: string, end: string, sumberGabung?: SumberKPI): Promise<KPIMember[]> => {
    const todayStr  = fmt(new Date());
    const mIds      = membersData.map((m: any) => m.id as string);
    const tahun     = new Date(end).getFullYear();

    // Tahun basis faktor LC = tahun akhir periode yang dilihat. Periode ini & sebelumnya sering
    // setahun - rekapnya diingat sebentar supaya tidak diminta dua kali.
    const [sumber, rekapLC] = await Promise.all([
      sumberGabung ? saringSumberKPI(sumberGabung, start, end) : ambilSumber(membersData, start, end),
      ingat(`rekap-lc:${tahun}:${[...mIds].sort().join(',')}`, () => ambilRekapLCTahunan(mIds, tahun), 60_000),
    ]);
    const { tickets, actLogs, reminders, lcAttempts, piketRows, formReviews, techNotes } = sumber;

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

      //  Piket - dicocokkan lewat bacaPicPiket(), bukan menebak nama kolom dari
      //  tim orangnya. Cara lama hanya mengenal tiga tim: anggota kelompok PTS
      //  yang ditambahkan admin selalu jatuh ke kolom 'pic_mvi_name' dan
      //  piketnya tidak pernah terhitung sama sekali.
      const piketFilled = piketRows.filter((p: any) => bacaPicPiket(p)?.name === name).length;

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
        lcTahunan: rekapLC[uid] ?? REKAP_LC_KOSONG,
      };
    });
  }, [ambilSumber]);

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
      //  Satu pengambilan untuk kedua periode (prevStart..end), lalu dipilah per periode.
      const sumberGabung = await ambilSumber(mData, prevStart, end);
      const [cur, prev] = await Promise.all([
        buildMembers(mData, start, end, sumberGabung),
        buildMembers(mData, prevStart, prevEnd, sumberGabung),
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
  }, [scopeReady, scope, period, buildMembers, ambilSumber, currentUser]);

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
      ? <span className="text-sky-700 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
      : <span className="text-slate-400 ml-0.5">↕</span>;

  // Period label

  const { start, end } = getPeriodRange(period);
  const periodLabel = `${new Date(start).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })} — ${new Date(end).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}`;

  // KPI period + helpers (used both in Penilaian section and Mulai KPI)

  const kpiEndMonth    = Math.min(kpiStartMonth + (kpiPeriodLen === '6m' ? 5 : 11), 12);
  const kpiPeriodLabel = `${MN[kpiStartMonth - 1]}–${MN[kpiEndMonth - 1]} ${kpiYear}`;
  const kpiFiltered    = filterTeam === 'all' ? kpiMembers : kpiMembers.filter(m => m.team_type === filterTeam);

  const calcKPI = (m: KPIMember) => hitungSkorKPI(m, kpiSettings).finalKPI;
  const kpiScoreColor = (score: number, noData: boolean) =>
    noData ? '#64748b' : score >= 85 ? '#047857' : score >= 70 ? '#1d4ed8' : score >= 50 ? '#b45309' : '#dc2626'; // tone 700: dipakai sebagai warna TEKS skor, harus lolos AA
  const kpiScoreLabel = (score: number, noData: boolean) =>
    noData ? 'Belum Ada Data' : score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work';

  // Guards

  if (!isLoggedIn || !appReady) return (
    <div className="flex items-center justify-center min-h-screen"
      style={{ background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="w-8 h-8 border-[3px] rounded-full animate-spin" style={{ borderColor: 'rgba(2,132,199,0.2)', borderTopColor: '#0284c7' }} />
    </div>
  );

  if (scopeReady && scope.kind === 'none') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3"
      style={{ background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <span className="text-5xl"><Ikon nama="🔒" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <p className="text-slate-600 text-sm font-semibold">Akses Terbatas</p>
        <p className="text-slate-500 text-xs">Halaman ini hanya untuk Admin & Supervisor PTS</p>
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
      style={{ background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <PageHeader icon="📊" title="KPI Team" subtitle="PTS IVP — Key Performance Indicators"
        color={KPI_COLOR} colorLight="#0369a1">
        {scope.kind === 'team' && (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(14,165,233,0.12)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.3)' }}>
            <IkonTeks nama="👤" />Profil KPI Saya
          </span>
        )}
        {!isPimpinan(currentUser) && (
        <button onClick={() => { fetchAllData(); fetchKPIMembers(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
          style={{ background: 'rgba(255,255,255,0.9)', borderColor: '#e2e8f0', color: '#64748b' }}>
          <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Sync
        </button>
        )}
        {scope.kind !== 'team' && !isPimpinan(currentUser) && (
          <>
            <button onClick={() => setShowStartKPI(true)}
              disabled={kpiLoading || kpiMembers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#047857', borderColor: '#047857', color: '#fff', boxShadow: '0 2px 8px rgba(4,120,87,0.3)' }}>
              <IkonTeks nama="🚀" />Mulai KPI {kpiYear}
            </button>
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ background: 'rgba(255,255,255,0.9)', borderColor: '#ddd6fe', color: '#7c3aed' }}>
              <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Pengaturan KPI
            </button>
            <button onClick={async () => { const { exportKPIExcel } = await import('./_components/ekspor-kpi'); exportKPIExcel(sortedMembers, period, kpiSettings, `${kpiYear}`); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ background: KPI_COLOR, borderColor: KPI_COLOR, color: '#fff', boxShadow: `0 2px 8px ${KPI_COLOR}40` }}>
              <IkonTeks nama="⬇" />Export KPI Excel
            </button>
          </>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        {/* ── Penilaian KPI (TOP — data mandiri, tidak ikut period picker) ── */}
        <BagianPenilaianKPI
          calcKPI={calcKPI} currentUser={currentUser} fetchKPIMembers={fetchKPIMembers} filterTeam={filterTeam} kpiFiltered={kpiFiltered} kpiLoading={kpiLoading} kpiPeriodLabel={kpiPeriodLabel} kpiPeriodLen={kpiPeriodLen} kpiScoreColor={kpiScoreColor} kpiScoreLabel={kpiScoreLabel} kpiSettings={kpiSettings} kpiStartMonth={kpiStartMonth} kpiYear={kpiYear} setKpiPeriodLen={setKpiPeriodLen} setKpiStartMonth={setKpiStartMonth} setKpiYear={setKpiYear} setSelectedKPIMember={setSelectedKPIMember}
        />

        {/* ── Period Selector Bar ── berpanel: latar halaman bisa foto (Admin Panel > Merek) */}
        <div className="flex items-center gap-2 flex-wrap rounded-2xl px-3 py-2 border border-slate-200 shadow-sm"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Periode</span>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
              style={{
                background:   period === p ? KPI_COLOR : 'rgba(255,255,255,0.85)',
                color:        period === p ? '#fff' : '#64748b',
                borderColor:  period === p ? KPI_COLOR : '#e2e8f0',
                boxShadow:    period === p ? `0 2px 10px ${KPI_COLOR}50` : '0 1px 4px rgba(0,0,0,0.08)',
              }}>
              {p}
            </button>
          ))}
          <span className="ml-2 text-[11px] text-slate-500">{periodLabel}</span>

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
        <TabelKinerjaHandler
          SortIcon={SortIcon} filterTeam={filterTeam} handleSort={handleSort} loading={loading} period={period} searchQ={searchQ} setDrillMember={setDrillMember} setFilterTeam={setFilterTeam} setSearchQ={setSearchQ} sortedMembers={sortedMembers}
        />


        {/* ── Riwayat KPI (Snapshot History) ── */}
        <BagianRiwayatKPI
          expandedSnapshot={expandedSnapshot} kpiSnapshots={kpiSnapshots} kpiYear={kpiYear} setExpandedSnapshot={setExpandedSnapshot} setSelectedSnapMember={setSelectedSnapMember}
        />

      </div>
      </div>{/* end flex-1 overflow-y-auto */}

      {/* ── Drill-down Modal (Performance) ── */}
      {drillMember && (
        <DrillModal member={drillMember} period={period} onClose={() => setDrillMember(null)}
          onViewBreakdown={() => { const id = drillMember.id; setDrillMember(null); setSelectedKPIMember(id); }} />
      )}

      {/* ── KPI Member Detail Popup ── */}
      <ModalDetailAnggotaKPI
        kpiMembers={kpiMembers} kpiSettings={kpiSettings} kpiYear={kpiYear} selectedKPIMember={selectedKPIMember} setSelectedKPIMember={setSelectedKPIMember}
      />

      {/* ── Mulai KPI Confirm Modal ── */}
      <ModalMulaiKPI
        kpiMembers={kpiMembers} kpiPeriodLabel={kpiPeriodLabel} kpiSettings={kpiSettings} kpiYear={kpiYear} saveKPISnapshot={saveKPISnapshot} savingSnapshot={savingSnapshot} setShowStartKPI={setShowStartKPI} showStartKPI={showStartKPI}
      />

      {/* ── Snapshot Member Detail Popup ── */}
      <ModalDetailSnapshot
        kpiSnapshots={kpiSnapshots} selectedSnapMember={selectedSnapMember} setSelectedSnapMember={setSelectedSnapMember}
      />

      {/* ── KPI Settings Modal ── */}
      <ModalPengaturanKPI
        kpiSettings={kpiSettings} saveKpiSettings={saveKpiSettings} setKpiSettings={setKpiSettings} setShowSettings={setShowSettings} showSettings={showSettings}
      />
    </div>
  );
}
