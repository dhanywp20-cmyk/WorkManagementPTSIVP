'use client';

/**
 * SalesAnalyticsWidget.tsx - "Analytics Saya" (Sales/Marketing), tema
 * analytics dengan DATA MILIK SENDIRI. Menggabung 4 platform: Request
 * Schedule, Request Design Project, Form Review BAST, Ticket Troubleshooting.
 * Tiap panel hanya muncul kalau user punya menunya.
 *
 * Dipindah dari Widgets.tsx ke file sendiri supaya bisa dipakai LANGSUNG oleh
 * widget Work Center (QuickActionsSection, layout "kiri-kanan Analytics
 * Saya") tanpa circular import - Widgets.tsx sendiri memuat widget Work
 * Center lewat WIDGETS registry, jadi widget Work Center tidak bisa balik
 * mengimpor apa pun dari Widgets.tsx.
 *
 * Pintasan "Buat Request Schedule/Design Project/Ticket" yang dulu ada di
 * bawah kartu ini SUDAH DIHAPUS - sekarang jadi tanggung jawab Quick Action
 * di Work Center (chip kiri/kanan kartu ini), supaya tidak ada dua baris
 * tombol yang persis sama artinya tampil dua kali di satu halaman.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hasMenu } from './permissions';
import { type WidgetProps, WidgetCard, Loading } from './primitives';

interface SalesAnalytics {
  schedule: { total: number; active: number; done: number };
  project: { total: number; pending: number; progress: number; done: number };
  review: { total: number; demo: number; bast: number };
  ticket: { total: number; open: number; solved: number };
}

/**
 * Kartu ini menampilkan satu angka utama PLUS rincian pecahannya, jadi tidak
 * bisa langsung memakai StatCard bersama (yang hanya membawa satu angka).
 * Gayanya disamakan secara manual: permukaan putih, angka gelap, dan warna
 * kategori dipakai sebagai pita tepi - persis seperti StatCard.
 */
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
            <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SalesAnalyticsWidget: React.FC<WidgetProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const showSchedule = hasMenu(user, 'reminder-schedule');
  const showProject  = hasMenu(user, 'request-design-project');
  const showReview   = hasMenu(user, 'form-bast');
  const showTicket   = hasMenu(user, 'ticket-troubleshooting');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Scope "data sendiri": cocokkan lewat created_by (username) ATAU nama sales
        // (full_name) - menangkap request/tiket yg dia buat maupun yg atas namanya.
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
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, showSchedule, showProject, showReview, showTicket]);

  return (
    <WidgetCard title="Analytics Saya" icon="📊" accent="#c8861d">
      {loading || !data ? <Loading /> : (
        // Dua kolom sejak layar tersempit: satu kolom membuat empat kartu
        // memakan hampir seluruh layar ponsel.
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
      )}
    </WidgetCard>
  );
};

/** Sama seperti hasMenu di atas - dipakai QuickActionsSection utk tahu kapan Analytics Saya relevan ditampilkan. */
export function hasSalesAnalyticsData(user: Parameters<typeof hasMenu>[0]): boolean {
  return hasMenu(user, 'reminder-schedule') || hasMenu(user, 'request-design-project')
    || hasMenu(user, 'form-bast') || hasMenu(user, 'ticket-troubleshooting');
}
