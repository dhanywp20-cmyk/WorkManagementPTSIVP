'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyKPIAlert } from '@/lib/notifications';
import { lingkupSaya } from '@/lib/kelompok/inti';
import { KPIUser, KPIMember, KPISettings, Scope, PeriodKey, fmt, getPeriodRange } from './shared';
import { bacaPicPiket } from '@/lib/piket/inti';
import { ambilRekapLCTahunan, REKAP_LC_KOSONG } from '@/lib/kuis/kpi-lc-tahunan';
import { ingat } from '@/lib/cache-singkat';
import { saringSumberKPI, type SumberKPI } from '@/lib/kpi-sumber';

export interface SumberKpiKonteks {
  scopeReady: boolean;
  scope: Scope;
  setLoading: Dispatch<SetStateAction<boolean>>;
  currentUser: KPIUser | null;
  period: PeriodKey;
  setMembers: Dispatch<SetStateAction<KPIMember[]>>;
  setPrevMembers: Dispatch<SetStateAction<KPIMember[]>>;
}

export function useSumberKpi(k: SumberKpiKonteks) {
  const { scopeReady, scope, setLoading, currentUser, period, setMembers, setPrevMembers } = k;
  const saveKpiSettings = useCallback(async (s: KPISettings) => {
    try { localStorage.setItem('kpi_global_settings', JSON.stringify(s)); } catch {  }
    try { await supabase.from('kpi_global_settings').upsert({ id: 1, settings: s, updated_at: new Date().toISOString() }); } catch {  }
  }, []);

  const ambilSumber = useCallback(async (membersData: any[], start: string, end: string): Promise<SumberKPI> => {
    const endFull   = end + 'T23:59:59';
    const mNames    = membersData.map((m) => m.full_name as string);
    const mIds      = membersData.map((m) => m.id as string);
    const [ticketsR, actR, remR, lcR, piketR, formRevR, techNotesR] = await Promise.all([
      supabase.from('tickets').select('id,assign_name,status,date,created_at')
        .in('assign_name', mNames).gte('created_at', start).lte('created_at', endFull),
      supabase.from('activity_logs').select('id,ticket_id,handler_name,created_at')
        .in('handler_name', mNames).gte('created_at', start).lte('created_at', endFull)
        .order('created_at', { ascending: true }),
      supabase.from('reminders').select('id,assign_name,status,due_date,created_at')
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
      tickets: (ticketsR.data ?? []),
      actLogs: (actR.data ?? []),
      reminders: (remR.data ?? []),
      lcAttempts: (lcR.data ?? []),
      piketRows: (piketR.data ?? []),
      formReviews: (formRevR.data ?? []),
      techNotes: (techNotesR.data ?? []),
    };
  }, []);

  const buildMembers = useCallback(async (membersData: any[], start: string, end: string, sumberGabung?: SumberKPI): Promise<KPIMember[]> => {
    const todayStr  = fmt(new Date());
    const mIds      = membersData.map((m) => m.id as string);
    const tahun     = new Date(end).getFullYear();

    const [sumber, rekapLC] = await Promise.all([
      sumberGabung ? saringSumberKPI(sumberGabung, start, end) : ambilSumber(membersData, start, end),
      ingat(`rekap-lc:${tahun}:${[...mIds].sort().join(',')}`, () => ambilRekapLCTahunan(mIds, tahun), 60_000),
    ]);
    const { tickets, actLogs, reminders, lcAttempts, piketRows, formReviews, techNotes } = sumber;

    return membersData.map((m: any): KPIMember => {
      const name = m.full_name as string;
      const uid  = m.id as string;

      const myT   = tickets.filter((t) => t.assign_name === name);
      const tSol  = myT.filter((t) => t.status === 'Solved');
      const tOver = myT.filter((t) =>
        !['Solved','Cancelled'].includes(t.status ?? '') && t.date && t.date < todayStr);
      const tDays = tSol.reduce((acc: number, t) => {
        const d = (new Date(t.date ?? '').getTime() - new Date(t.created_at ?? '').getTime()) / 86400000;
        return acc + Math.max(0, d);
      }, 0);

      const myRem  = reminders.filter((r) => r.assign_name === name);
      const remDone = myRem.filter((r) => r.status === 'done').length;

      const myLC     = lcAttempts.filter((a) => a.user_id === uid && a.grading_status !== 'pending_review');
      const lcScoreArr = myLC.filter((a) => a.score != null).map((a) => a.score as number);
      const lcScores = lcScoreArr;
      const lcAvg    = lcScoreArr.length ? Math.round(lcScoreArr.reduce((a: number, b: number) => a + b, 0) / lcScoreArr.length) : 0;

      const myReviews = formReviews.filter((r) => r.assign_name === name);
      const formReviewTotal = myReviews.length;
      const formReviewLowRating = myReviews.filter((r) => {
        const g1 = r.grade_product_knowledge ?? 5;
        const g2 = r.grade_training_customer ?? 5;
        const g3 = r.grade_product_knowledge_bast ?? 5;
        return g1 < 3 || g2 < 3 || g3 < 3;
      }).length;

      const techNotesApproved = techNotes.filter((tn) => tn.author_id === uid).length;

      const piketFilled = piketRows.filter((p) => bacaPicPiket(p as unknown as Parameters<typeof bacaPicPiket>[0])?.name === name).length;

      const myTIds = new Set(myT.map((t) => t.id as string));
      const firstAct: Record<string, string> = {};
      actLogs.filter((a) => myTIds.has(a.ticket_id ?? '') && a.handler_name === name)
        .forEach((a) => { if (a.ticket_id && a.created_at && !firstAct[a.ticket_id]) firstAct[a.ticket_id] = a.created_at; });
      const resTimes = myT.filter((t) => firstAct[t.id])
        .map((t) => Math.max(0, (new Date(firstAct[t.id]).getTime() - new Date(t.created_at ?? '').getTime()) / 3600000));
      const avgRT = resTimes.length ? Math.round(resTimes.reduce((a: number, b: number) => a + b, 0) / resTimes.length) : 0;

      const monthlyTickets = Array.from({ length: 12 }, (_, mi) =>
        myT.filter((t) => new Date(t.created_at ?? '').getMonth() === mi).length
      );

      return {
        id: uid, name, team_type: m.team_type ?? '', jabatan: m.jabatan ?? '',
        ticketsHandled: myT.length, ticketsSolved: tSol.length,
        ticketsOverdue: tOver.length,
        avgResolutionDays: tSol.length ? Math.round(tDays / tSol.length) : 0,
        remindersAssigned: myRem.length, remindersDone: remDone,
        lcAttempts: myLC.length, lcAvgScore: lcAvg,
        lcPassed: myLC.filter((a) => a.passed === true).length,
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
      let mQ = supabase.from('users').select('id,full_name,jabatan,team_type,role');
      if (scope.kind === 'team') {
        mQ = mQ.eq('id', currentUser!.id);
      } else if (scope.kind === 'pts_sup') {
        mQ = mQ.eq('role', 'team').eq('team_type', scope.ptsTeamType ?? '');
      } else {
        mQ = mQ.in('team_type', lingkupSaya(currentUser?.id)).eq('role', 'team');
      }
      const { data: mData } = await mQ;
      if (!mData?.length) { setLoading(false); return; }

      const { start, end, prevStart, prevEnd } = getPeriodRange(period);
      const sumberGabung = await ambilSumber(mData, prevStart, end);
      const [cur, prev] = await Promise.all([
        buildMembers(mData, start, end, sumberGabung),
        buildMembers(mData, prevStart, prevEnd, sumberGabung),
      ]);
      setMembers(cur);
      setPrevMembers(prev);
      cur.forEach(m => {
        if (m.ticketsHandled >= 5 && m.id) {
          const solveRate = (m.ticketsSolved / m.ticketsHandled) * 100;
          if (solveRate < 50) void notifyKPIAlert(m.id, m.name, solveRate);
        }
      });
    } catch {  }
    finally { setLoading(false); }
  }, [scopeReady, scope, period, buildMembers, ambilSumber, currentUser]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);
  return { buildMembers, fetchAllData, saveKpiSettings };
}
