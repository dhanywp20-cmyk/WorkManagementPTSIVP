'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hasMenu } from './permissions';
import { type WidgetProps, WidgetCard, Loading, QuickActionChip } from './primitives';

interface SalesAnalytics {
  schedule: { total: number; active: number; done: number };
  project: { total: number; pending: number; progress: number; done: number };
  review: { total: number; demo: number; bast: number };
  ticket: { total: number; open: number; solved: number };
}

function AnalyticStat({ accent, label, value, subs }: {
  accent: string; label: string; value: number;
  subs: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-xl px-3 py-2.5 sm:px-4 sm:py-3.5 relative overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.10)', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent, opacity: 0.55 }} />
      <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none" style={{ color: '#0f172a' }}>{value}</div>
      <div className="text-[11px] sm:text-[13px] font-bold mt-1 leading-tight" style={{ color: '#1e293b' }}>{label}</div>
      <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-2.5">
        {subs.map((s, i) => (
          <div key={i}>
            <div className="text-sm font-black tabular-nums leading-none text-slate-700">{s.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SalesAnalyticsWidget: React.FC<WidgetProps> = ({ user, openMenu, openUrl }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const showSchedule = hasMenu(user, 'reminder-schedule');
  const showProject  = hasMenu(user, 'request-design-project');
  const showReview   = hasMenu(user, 'form-bast');
  const showTicket   = hasMenu(user, 'ticket-troubleshooting');
  const showProgress = hasMenu(user, 'project-progress');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [remRes, prRes, rvRes, tkRes] = await Promise.all([
          showSchedule ? supabase.from('reminders').select('status').or(`sales_name.eq.${user.full_name},created_by.eq.${user.username}`) : Promise.resolve({ data: [] }),
          showProject  ? supabase.from('project_requests').select('status').or(`requester_id.eq.${user.id},ivp_assignee.eq.${user.full_name}`) : Promise.resolve({ data: [] }),
          showReview   ? supabase.from('form_reviews').select('review_category').or(`guest_username.eq.${user.username},sales_name.eq.${user.full_name}`) : Promise.resolve({ data: [] }),
          showTicket   ? supabase.from('tickets').select('status').or(`created_by.eq.${user.username},sales_name.eq.${user.full_name}`) : Promise.resolve({ data: [] }),
        ]);
        const rem = (remRes.data ?? []) as { status: string }[];
        const pr  = (prRes.data ?? []) as { status: string }[];
        const rv  = (rvRes.data ?? []) as { review_category: string }[];
        const tk  = (tkRes.data ?? []) as { status: string }[];
        if (alive) setData({
          schedule: {
            total: rem.length,
            active: rem.filter(r => r.status !== 'done' && r.status !== 'cancelled').length,
            done: rem.filter(r => r.status === 'done').length,
          },
          project: {
            total: pr.length,
            pending: pr.filter(p => p.status === 'pending').length,
            progress: pr.filter(p => p.status === 'in_progress' || p.status === 'approved').length,
            done: pr.filter(p => p.status === 'completed').length,
          },
          review: {
            total: rv.length,
            demo: rv.filter(r => (r.review_category ?? '').toLowerCase().includes('demo')).length,
            bast: rv.filter(r => (r.review_category ?? '').toLowerCase().includes('bast')).length,
          },
          ticket: {
            total: tk.length,
            open: tk.filter(t => t.status !== 'Solved').length,
            solved: tk.filter(t => t.status === 'Solved').length,
          },
        });
      } catch {  }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, showSchedule, showProject, showReview, showTicket]);

  const adaQuickAction = showSchedule || showProject || showTicket || showReview || showProgress;

  return (
    <WidgetCard title="Analytics Saya" icon="📊" accent="#c8861d">
      {loading || !data ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
            {showSchedule && (
              <AnalyticStat accent="#0e7490" label="Request Schedule" value={data.schedule.total}
                subs={[{ label: 'Aktif', value: data.schedule.active }, { label: 'Selesai', value: data.schedule.done }]} />
            )}
            {showProject && (
              <AnalyticStat accent="#6d28d9" label="Design Project" value={data.project.total}
                subs={[{ label: 'Pending', value: data.project.pending }, { label: 'Proses', value: data.project.progress }, { label: 'Selesai', value: data.project.done }]} />
            )}
            {showReview && (
              <AnalyticStat accent="#475569" label="Form Review/BAST" value={data.review.total}
                subs={[{ label: 'Demo', value: data.review.demo }, { label: 'BAST', value: data.review.bast }]} />
            )}
            {showTicket && (
              <AnalyticStat accent="#be123c" label="Ticket" value={data.ticket.total}
                subs={[{ label: 'Aktif', value: data.ticket.open }, { label: 'Solved', value: data.ticket.solved }]} />
            )}
          </div>
          {adaQuickAction && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
              {showSchedule && (
                <QuickActionChip label="Request Schedule" icon="🗓️" warna="#0891b2"
                  onClick={() => openUrl('/reminder-schedule?buat=1', 'Request Schedule')} />
              )}
              {showProject && (
                <QuickActionChip label="Design Project" icon="🏗️" warna="#7c3aed"
                  onClick={() => openUrl('/form-require-project?buat=1', 'Request Design Project')} />
              )}
              {showTicket && (
                <QuickActionChip label="Buat Ticket" icon="🎫" warna="#e11d48"
                  onClick={() => openUrl('/ticketing?buat=1', 'Ticket Troubleshooting')} />
              )}
              {showReview && (
                <QuickActionChip label="Form Review" icon="⭐" warna="#475569"
                  onClick={() => openMenu('form-bast')} />
              )}
              {showProgress && (
                <QuickActionChip label="Project Progress" icon="📊" warna="#0d9488"
                  onClick={() => openMenu('project-progress')} />
              )}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
};

export function hasSalesAnalyticsData(user: Parameters<typeof hasMenu>[0]): boolean {
  return hasMenu(user, 'reminder-schedule') || hasMenu(user, 'request-design-project')
    || hasMenu(user, 'form-bast') || hasMenu(user, 'ticket-troubleshooting') || hasMenu(user, 'project-progress');
}
