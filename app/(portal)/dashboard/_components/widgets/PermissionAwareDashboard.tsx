'use client';

import React, { useEffect, useState } from 'react';
import type { User } from '../shared';
import { WIDGETS, type WidgetDef } from './Widgets';
import { supabase } from '@/lib/supabase';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { useKelompok } from '@/lib/kelompok';
import { AnalyticsPlatform, type Tab as AnalyticsTab } from '@/app/analytics-dashboard/_components/AnalyticsPlatform';
import { Ikon } from '@/components/shared/Ikon';
import { AKSEN_UTAMA } from './primitives';
import { hasFullAccess } from '@/lib/constants';

const SIZE_SPAN: Record<string, string> = {
  lg: 'sm:col-span-2 lg:col-span-2',
  md: '',
  sm: '',
};

function HeaderTabBtn({ label, icon, active, onClick, badge }: {
  label: string; icon: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 text-[11px] md:text-[11px] font-bold px-2 py-1 md:px-2.5 md:py-1.5 rounded-full transition-all flex-shrink-0"
      style={active
        ? { background: AKSEN_UTAMA, color: 'white', border: `1px solid ${AKSEN_UTAMA}` }
        : { background: 'white', color: '#475569', border: '1px solid #e2e8f0' }}>
      <span className="select-none"><Ikon nama={icon} ukuran={14} /></span>
      <span className="hidden sm:inline">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[10px] font-black px-1"
          style={{ background: active ? 'rgba(255,255,255,0.3)' : '#ef4444', color: 'white' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export default function PermissionAwareDashboard({ currentUser, openMenu, openUrl, onHubungkanTelegram }: {
  currentUser: User;
  openMenu: (key: string) => void;
  openUrl: (url: string, title: string) => void;
  onHubungkanTelegram?: () => void;
}) {
  const [ajakTelegram, setAjakTelegram] = useState(false);
  const [tutupAjakan, setTutupAjakan] = useState(false);

  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('kpi');
  const [analyticsCounts, setAnalyticsCounts] = useState({ totalAlerts: 0, auditCount: 0 });

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const p = await bacaPengaturan();
        if (!p.aktif.telegram) return;
        const { data, error } = await supabase.from('users')
          .select('telegram_chat_id').eq('id', currentUser.id).maybeSingle();
        if (!batal && !error && data && !data.telegram_chat_id) setAjakTelegram(true);
      } catch {  }
    })();
    return () => { batal = true; };
  }, [currentUser.id]);
  useKelompok();

  const visible = WIDGETS
    .filter(w => w.permission(currentUser))
    .sort((a, b) => a.priority - b.priority);

  const composed: ({ type: 'full'; widget: WidgetDef } | { type: 'grid'; widgets: WidgetDef[] })[] = [];
  let buffer: WidgetDef[] = [];
  const flush = () => { if (buffer.length) { composed.push({ type: 'grid', widgets: buffer }); buffer = []; } };
  for (const w of visible) {
    if (w.size === 'full') { flush(); composed.push({ type: 'full', widget: w }); }
    else buffer.push(w);
  }
  flush();

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = (currentUser.full_name ?? '').trim().split(' ')[0] || currentUser.username || '';
  const showAnalyticsTabs = visible.some(w => w.id === 'analytics');
  const adaTeam = visible.some(w => w.id === 'team-monitoring');
  const adaAgenda = visible.some(w => w.id === 'work-queue');

  return (
    <div className="dasbor-3d w-full h-full overflow-y-auto">
      <header className="sticky top-0 z-40"
        style={{ background: 'rgba(255,255,255,0.96)', borderBottom: '1px solid #e2e8f0', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-2.5 md:py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-extrabold tracking-tight leading-tight text-slate-900">{firstName ? `Halo, ${firstName}` : 'Halo'}</h1>
            <p className="text-[11px] md:text-xs text-slate-500 font-medium mt-0.5">{today}</p>
          </div>
          {showAnalyticsTabs && (
            <div className="flex items-center gap-1 md:gap-1.5 flex-wrap justify-end">
              <HeaderTabBtn label="Analytics"      icon="📊" active={analyticsTab==='kpi'}     onClick={() => setAnalyticsTab('kpi')} />
              <HeaderTabBtn label="Command Center" icon="🏠" active={analyticsTab==='command'} onClick={() => setAnalyticsTab('command')} badge={analyticsCounts.totalAlerts} />
              <HeaderTabBtn label="Audit Log"      icon="📋" active={analyticsTab==='audit'}   onClick={() => setAnalyticsTab('audit')} badge={analyticsCounts.auditCount} />
              {hasFullAccess(currentUser) && <HeaderTabBtn label="Pemakaian" icon="👥" active={analyticsTab==='pemakaian'} onClick={() => setAnalyticsTab('pemakaian')} />}
            </div>
          )}
        </div>
      </header>

      <div className="dasbor-masuk max-w-[1600px] mx-auto px-3 md:px-8 py-4 md:py-6
                      grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-stretch">

        {ajakTelegram && !tutupAjakan && (
          <div className="lg:col-span-12 rounded-xl flex items-center gap-3 md:gap-4 px-4 py-3.5 flex-wrap"
            style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
            <span className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 text-white text-base"
              style={{ background: '#f59e0b' }}>➤</span>
            <span className="flex-1 min-w-[220px]">
              <span className="block text-[13.5px] font-bold text-slate-800">Telegram Anda belum terhubung</span>
              <span className="block text-[12px] text-slate-600 mt-0.5 leading-relaxed">
                Notifikasi jadwal baru, assign tugas, dan approval belum bisa masuk ke Telegram.
                Cukup sekali hubungkan — tidak perlu diulang.
              </span>
            </span>
            <button type="button" onClick={() => setTutupAjakan(true)}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 flex-shrink-0">
              Nanti saja
            </button>
            <button type="button" onClick={onHubungkanTelegram}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
              style={{ background: '#f59e0b' }}>
              Hubungkan sekarang →
            </button>
          </div>
        )}

        {composed.map((block, i) =>
          block.type === 'full' ? (
            <div key={`full-${block.widget.id}-${i}`}
              className={
                block.widget.id === 'work-queue' ? (adaTeam ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12')
                : block.widget.id === 'team-monitoring' ? (adaAgenda ? 'lg:col-span-5 xl:col-span-4' : 'lg:col-span-12')
                : 'lg:col-span-12'
              }>
              {block.widget.id === 'analytics' ? (
                <AnalyticsPlatform embedded injectedUser={currentUser}
                  controlledTab={analyticsTab} onTabChange={setAnalyticsTab} onCounts={setAnalyticsCounts} />
              ) : (
                <block.widget.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} />
              )}
            </div>
          ) : (
            <div key={`grid-${i}`} className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {block.widgets.map(w => (
                <div key={w.id} className={SIZE_SPAN[w.size] ?? ''}>
                  <w.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
