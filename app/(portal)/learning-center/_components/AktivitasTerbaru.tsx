'use client';

import { fmtDate, ScoreBadge } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { SectionHeader } from './RingkasanKuis';

export interface AktivitasTerbaruProps {
  filteredRecent: any[];
  search: string;
}

export function AktivitasTerbaru({
  filteredRecent, search,
}: AktivitasTerbaruProps) {
  return (
    <section>
      <SectionHeader><IkonTeks nama="🕐" />Aktivitas Terbaru</SectionHeader>
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs" style={{ background: 'rgba(255,255,255,0.90)' }}>
        <div className="divide-y divide-slate-100">
          {filteredRecent.length === 0 && (
            <div className="text-center text-slate-500 py-10 text-sm">
              {search ? 'Tidak ada hasil yang cocok' : 'Belum ada aktivitas quiz'}
            </div>
          )}
          {filteredRecent.slice(0, 10).map((a: any, _ri: number) => {
            const tq = a.total_questions ?? 0;
            const ts = a.time_taken_sec ?? Infinity;
            const isFast = tq >= 5 && ts < tq * 5;
            return (
              <div key={a.id} className="stagger-item flex items-center gap-4 px-6 py-3.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                  {a.users?.full_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.users?.full_name ?? '-'}</p>
                  <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.session_name ?? '-'}</p>
                </div>
                <ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} />
                {isFast && (
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                    <Ikon nama="🚨" ukuran="1em" className="inline-block align-[-0.12em]" /> {Math.round(ts)}s
                  </span>
                )}
                {(a.tab_switches ?? 0) > 0 && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                    <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {a.tab_switches}× tab
                  </span>
                )}
                <span className="text-xs text-slate-500 shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
