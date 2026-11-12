'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ingat } from '@/lib/cache-singkat';
import { namaKelompokPTS } from '@/lib/kelompok/inti';
import { hasMenu, canAccessAnalytics, canSeeTeamMonitoring } from './permissions';
import {
  getMonday, getDayDate, toKey, DAYS_OF_WEEK, getRollingNameForDate, type PiketRow,
} from '@/lib/piket/inti';
import { AnalyticsPlatform } from '@/app/analytics-dashboard/_components/AnalyticsPlatform';
import { isSalesGuest } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import { ambilPeringkatSaya, type HasilPeringkat } from '@/lib/kuis/peringkat';
import { PopupJawabanQuiz } from './PopupJawabanQuiz';
import { SalesAnalyticsWidget, hasSalesAnalyticsData } from './SalesAnalyticsWidget';

import {
  type WidgetProps, type WidgetSize, type WidgetDef,
  WidgetCard, EmptyState, Loading, AKSEN_UTAMA,
} from './primitives';
export type { WidgetProps, WidgetSize, WidgetDef };
export { WidgetCard, EmptyState, Loading };
import PanelAgenda from '../workcenter/PanelAgenda';
import { Ikon } from '@/components/shared/Ikon';
import { TeamMonitoringWidget } from './WidgetMonitoringTim';

const AnalyticsNativeWidget: React.FC<WidgetProps> = ({ user }) => (
  <AnalyticsPlatform embedded injectedUser={user} />
);

interface RiwayatQuizRingkas {
  id: string; score: number | null; passed: boolean | null;
  grading_status: string | null; submitted_at: string | null; sesi: string;
}

function fmtTglSingkat(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function BarisRiwayatQuiz({ r, onClick }: { r: RiwayatQuizRingkas; onClick: () => void }) {
  const menunggu = r.grading_status === 'pending_review';
  const warna = menunggu ? 'bg-amber-100 text-amber-700' : r.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 py-1.5 w-full text-left border-b border-indigo-100/70 last:border-0 hover:bg-indigo-100/40 rounded-lg px-1 -mx-1 transition-colors">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${warna}`}>
        {menunggu ? '⏳' : (r.score?.toFixed(0) ?? '—')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-indigo-900 truncate leading-tight">{r.sesi}</p>
        {r.submitted_at && <p className="text-[10px] text-indigo-400 leading-tight mt-0.5">{fmtTglSingkat(r.submitted_at)}</p>}
      </div>
      <span aria-hidden="true" className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-indigo-100 text-indigo-600">→</span>
    </button>
  );
}

function BarisAngka({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-indigo-50/70 border border-indigo-100">
      <span className="text-lg shrink-0" aria-hidden="true"><Ikon nama={icon} ukuran={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-indigo-400 font-semibold leading-none">{label}</div>
        <div className="text-sm font-black text-indigo-800 leading-tight mt-0.5">
          {value}{sub && <span className="text-[11px] font-medium text-indigo-400 ml-1">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

const LearningWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const guest = isSalesGuest({ role: user.role });
  const [milikSaya, setMilikSaya] = useState<{ total: number; avg: number } | null>(null);
  const [peringkat, setPeringkat] = useState<HasilPeringkat | null>(null);
  const [loading, setLoading] = useState(guest);

  useEffect(() => {
    if (!guest) return;
    let alive = true;
    (async () => {
      const [attRes, rank] = await Promise.all([
        supabase.from('lc_quiz_attempts').select('score, grading_status')
          .eq('user_id', user.id).eq('is_submitted', true),
        ambilPeringkatSaya(),
      ]);
      if (!alive) return;
      const dinilai = ((attRes.data ?? []) as { score: number | null; grading_status: string | null }[])
        .filter(a => a.grading_status !== 'pending_review');
      setMilikSaya({
        total: dinilai.length,
        avg: dinilai.length ? dinilai.reduce((s, a) => s + (a.score ?? 0), 0) / dinilai.length : 0,
      });
      setPeringkat(rank);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [guest, user.id]);

  return (
    <WidgetCard title="Learning Center" icon="🎓" accent="#4338ca">
      {!guest ? (
        <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-2">
          <div className="text-3xl"><Ikon nama="🎓" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
          <p className="text-[11px] text-slate-500 leading-snug px-2">Training, quiz online &amp; materi pengembangan tim.</p>
          <button onClick={() => openMenu('learning-center')}
            className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
            style={{ background: AKSEN_UTAMA }}>Buka Learning →</button>
        </div>
      ) : loading ? <Loading /> : (
        <div className="flex flex-col gap-2.5 h-full">
          <div className="grid grid-cols-2 gap-2">
            <BarisAngka icon="📝" label="Quiz Diikuti" value={String(milikSaya?.total ?? 0)} />
            <BarisAngka icon="📊" label="Rata-rata Skor" value={(milikSaya?.avg ?? 0).toFixed(0)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BarisAngka icon="🏆" label="Peringkat Global"
              value={peringkat?.globalRank ? `#${peringkat.globalRank}` : '—'}
              sub={peringkat?.globalTotal ? `dari ${peringkat.globalTotal}` : undefined} />
            <BarisAngka icon="🏢" label={peringkat?.divisi ? `Divisi ${peringkat.divisi}` : 'Peringkat Divisi'}
              value={peringkat?.divisiRank ? `#${peringkat.divisiRank}` : '—'}
              sub={peringkat?.divisiTotal ? `dari ${peringkat.divisiTotal}` : (peringkat?.divisi ? undefined : 'Divisi belum diset')} />
          </div>
          <button onClick={() => openMenu('learning-center')}
            className="mt-auto px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.02] self-start"
            style={{ background: AKSEN_UTAMA }}>Buka Learning →</button>
        </div>
      )}
    </WidgetCard>
  );
};

const RiwayatQuizWidget: React.FC<WidgetProps> = ({ user }) => {
  const [riwayat, setRiwayat] = useState<RiwayatQuizRingkas[] | null>(null);
  const [attemptDibuka, setAttemptDibuka] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('lc_quiz_attempts')
      .select('id, score, passed, grading_status, submitted_at, lc_quiz_sessions(session_name)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .order('submitted_at', { ascending: false }).limit(10)
      .then(({ data }: { data: any[] | null }) => {
        if (!alive) return;
        setRiwayat((data ?? []).map(a => ({
          id: a.id, score: a.score, passed: a.passed, grading_status: a.grading_status,
          submitted_at: a.submitted_at, sesi: a.lc_quiz_sessions?.session_name ?? 'Quiz',
        })));
      });
    return () => { alive = false; };
  }, [user.id]);

  return (
    <WidgetCard title="Riwayat Quiz" icon="🕐" accent="#4338ca">
      {riwayat === null ? <Loading /> : riwayat.length === 0 ? (
        <EmptyState text="Belum ada quiz yang diselesaikan." />
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 -mr-0.5">
            {riwayat.map(r => <BarisRiwayatQuiz key={r.id} r={r} onClick={() => setAttemptDibuka(r.id)} />)}
          </div>
        </div>
      )}
      {attemptDibuka && (
        <PopupJawabanQuiz user={user} attemptId={attemptDibuka} onClose={() => setAttemptDibuka(null)} />
      )}
    </WidgetCard>
  );
};

interface PicketDay { day: string; dateKey: string; name: string; isToday: boolean; team: string; libur: boolean; }

const ShowroomWidget: React.FC<WidgetProps> = ({ openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<PicketDay[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rowsRes, holRes, usersRes] = await Promise.all([
          supabase.from('piket_schedules').select('id,day_date,week_start,day_of_week,pic,pic_ivp_id,pic_ivp_name,pic_ump_id,pic_ump_name,pic_mvi_id,pic_mvi_name'),
          supabase.from('picket_holidays').select('date'),
          ingat(`users:kelompok-pts:${namaKelompokPTS().join(',')}`, () => supabase.from('users').select('full_name, team_type').in('team_type', namaKelompokPTS())),
        ]);
        const allRows = (rowsRes.data ?? []) as unknown as PiketRow[];
        const holidays = (holRes.data ?? []).map((h) => h.date as string);
        const teamByName: Record<string, string> = {};
        (usersRes.data ?? []).forEach((u) => { if (u.full_name) teamByName[u.full_name] = u.team_type ?? ''; });
        const monday = getMonday(new Date());
        const todayKey = toKey(new Date());
        const list: PicketDay[] = DAYS_OF_WEEK.map((day) => {
          const date = getDayDate(monday, day);
          const name = getRollingNameForDate(date, allRows, holidays);
          return { day, dateKey: toKey(date), name, isToday: toKey(date) === todayKey, team: name ? (teamByName[name] ?? '') : '', libur: holidays.includes(toKey(date)) };
        });
        if (alive) setDays(list);
      } catch {  }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <WidgetCard title="Piket Showroom" icon="🏪" accent="#0d9488"><Loading /></WidgetCard>;
  const today = days.find(d => d.isToday);

  return (
    <WidgetCard title="Piket Showroom" icon="🏪" accent="#0d9488" onSeeAll={() => openMenu('picket-showroom')}>
      <div className="rounded-xl p-3 mb-3 text-center" style={{ background: 'rgba(13,148,136,0.1)' }}>
        <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wide">PIC Piket Hari Ini</div>
        {today && today.name ? (
          <>
            <div className="text-base font-black text-slate-800 mt-0.5">{today.name}</div>
            {today.team && <div className="text-[11px] text-slate-500">{today.team.replace('Team ', '')}</div>}
          </>
        ) : (
          <div className="text-xs font-semibold text-slate-600 mt-1">
            {!today ? 'Akhir pekan - tidak ada piket' : today.libur ? 'Hari libur - tidak ada piket' : 'Belum ada PIC terjadwal'}
          </div>
        )}
      </div>
      <div>
        {days.map(d => (
          <div key={d.day} className="flex items-center gap-2 py-1.5 px-1 border-b border-slate-100 last:border-0"
            style={d.isToday ? { background: 'rgba(13,148,136,0.06)', borderRadius: 8 } : undefined}>
            <span className="text-[11px] font-bold w-12 shrink-0" style={{ color: d.isToday ? '#0f766e' : '#64748b' }}>{d.day}</span>
            <span className="text-xs font-semibold text-slate-700 truncate flex-1">{d.name || <span className="text-slate-500 font-normal">{d.libur ? 'Libur' : '—'}</span>}</span>
            {d.isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: '#0f766e', color: 'white' }}>Hari ini</span>}
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

export const WIDGETS: WidgetDef[] = [
  { id: 'work-queue',     permission: (u) => !isPimpinan(u), priority: 0,   size: 'full', Component: PanelAgenda },
  { id: 'sales-analytics', permission: (u) => !canAccessAnalytics(u) && hasSalesAnalyticsData(u), priority: 0.5, size: 'full', Component: SalesAnalyticsWidget },
  { id: 'team-monitoring', permission: canSeeTeamMonitoring, priority: 1, size: 'full', Component: TeamMonitoringWidget },
  { id: 'analytics',       permission: canAccessAnalytics,   priority: 2, size: 'full', Component: AnalyticsNativeWidget },
  { id: 'showroom',        permission: (u) => !canAccessAnalytics(u),               priority: 6, size: 'md', Component: ShowroomWidget },
  { id: 'learning',        permission: (u) => hasMenu(u, 'learning-center')        && !canAccessAnalytics(u), priority: 7, size: 'sm', Component: LearningWidget },
  { id: 'riwayat-quiz',    permission: (u) => isSalesGuest({ role: u.role }) && hasMenu(u, 'learning-center') && !canAccessAnalytics(u), priority: 7.1, size: 'sm', Component: RiwayatQuizWidget },
];
