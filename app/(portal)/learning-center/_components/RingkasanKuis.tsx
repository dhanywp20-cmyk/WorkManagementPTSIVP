import React from 'react';
import { DonutChart } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-widest mb-4 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-xs backdrop-blur-xs">
      {children}
    </h3>
  );
}

export type StatOverview = {
  totalUsers: number; participants: number; mulai: number; passCount: number; failCount: number;
  scoreGood: number; scoreMid: number; scoreLow: number; submitted: number; abandoned: number;
};

export function RingkasanKuis({ o }: { o: StatOverview }) {
  if (!(o.submitted > 0)) return null;
  const partPct   = o.totalUsers > 0 ? Math.round(o.mulai / o.totalUsers * 100) : 0;
  const passPct   = o.submitted > 0 ? Math.round(o.passCount / o.submitted * 100) : 0;
  const compTotal = o.submitted + o.abandoned;
  const compPct   = compTotal > 0 ? Math.round(o.submitted / compTotal * 100) : 0;
  const miniCards = [
    { title: 'Sudah Akses Quiz',
      sub: `${o.mulai} mulai · ${o.participants} selesai · dari ${o.totalUsers} akun`,
      label: `${partPct}%`,
      segments: [{ value: o.mulai, color: '#6366f1' }, { value: Math.max(o.totalUsers - o.mulai, 0), color: '#e0e7ff' }] },
    { title: 'Pass Rate Global', sub: `${o.passCount} lulus · ${o.failCount} gagal`, label: `${passPct}%`,
      segments: [{ value: o.passCount, color: '#10b981' }, { value: o.failCount, color: '#f43f5e' }] },
    { title: 'Distribusi Nilai', sub: `≥80: ${o.scoreGood} · 60–79: ${o.scoreMid} · <60: ${o.scoreLow}`, label: `${o.submitted}`,
      segments: [{ value: o.scoreGood, color: '#3b82f6' }, { value: o.scoreMid, color: '#f59e0b' }, { value: o.scoreLow, color: '#ef4444' }] },
    { title: 'Completion Rate',  sub: `${o.abandoned} tidak selesai`, label: `${compPct}%`,
      segments: [{ value: o.submitted, color: '#10b981' }, { value: o.abandoned, color: '#cbd5e1' }] },
  ];
  return (
    <div>
      <SectionHeader><IkonTeks nama="🥧" />Analytics Overview</SectionHeader>
      <div className="grid grid-cols-2 gap-3">
        {miniCards.map(c => (
          <div key={c.title} className="bg-white/90 rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col items-center gap-3">
            <DonutChart segments={c.segments} size={72} strokeWidth={10} label={c.label} />
            <div className="text-center">
              <p className="text-xs font-bold text-slate-700">{c.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
