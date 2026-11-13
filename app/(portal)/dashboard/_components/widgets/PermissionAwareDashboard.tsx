'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { User } from '../shared';
import { WIDGETS } from './Widgets';
import { supabase } from '@/lib/supabase';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { useKelompok } from '@/lib/kelompok/inti';
import { AnalyticsPlatform, type Tab as AnalyticsTab } from '@/app/analytics-dashboard/_components/AnalyticsPlatform';
import { Ikon } from '@/components/shared/Ikon';
import { hasFullAccess } from '@/lib/constants';
import PanelAgenda, { type RingkasAgenda } from '../workcenter/PanelAgenda';
import { IsiBeranda } from '../beranda/IsiBeranda';
import { useDasborWidget } from '../beranda/useDasborWidget';

const SIZE_SPAN: Record<string, string> = {
  lg: 'sm:col-span-2 lg:col-span-2',
  md: '',
  sm: '',
};

function TabHalaman({ tab, aktif, onPilih }: {
  tab: { kunci: AnalyticsTab; label: string; ikon: string; badge?: number }[];
  aktif: AnalyticsTab;
  onPilih: (t: AnalyticsTab) => void;
}) {
  const wadah = useRef<HTMLDivElement>(null);
  const [geser, setGeser] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const ukur = () => {
      const t = el.querySelector<HTMLElement>('[aria-current="page"]');
      if (t) setGeser({ left: t.offsetLeft, width: t.offsetWidth });
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aktif, tab.length]);
  return (
    <nav ref={wadah} className="bb-tab" aria-label="Bagian dashboard">
      {geser && <span className="bb-tab-geser" style={geser} aria-hidden="true" />}
      {tab.map(t => (
        <button key={t.kunci} type="button" aria-current={t.kunci === aktif ? 'page' : undefined} onClick={() => onPilih(t.kunci)}>
          <Ikon nama={t.ikon} ukuran={14} />
          <span className="hidden sm:inline">{t.label}</span>
          {!!t.badge && <span className="bb-tab-lencana">{t.badge > 99 ? '99+' : t.badge}</span>}
        </button>
      ))}
    </nav>
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
  const [tab, setTab] = useState<AnalyticsTab>('kpi');
  const [hitung, setHitung] = useState({ totalAlerts: 0, auditCount: 0 });
  const [ringkasAgenda, setRingkasAgenda] = useState<RingkasAgenda | null>(null);

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const p = await bacaPengaturan();
        if (!p.aktif.telegram) return;
        const { data, error } = await supabase.from('users')
          .select('telegram_terhubung').eq('id', currentUser.id).maybeSingle();
        if (!batal && !error && data && !data.telegram_terhubung) setAjakTelegram(true);
      } catch {  }
    })();
    return () => { batal = true; };
  }, [currentUser.id]);
  useKelompok();
  const widgetDasbor = useDasborWidget();

  const visible = WIDGETS
    .filter(w => w.permission(currentUser))
    .sort((a, b) => a.priority - b.priority);

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = (currentUser.full_name ?? '').trim().split(' ')[0] || currentUser.username || '';
  const adaAnalytics = visible.some(w => w.id === 'analytics');
  const adaAgenda = visible.some(w => w.id === 'work-queue');
  const monitor = visible.find(w => w.id === 'team-monitoring');
  const widgetUtama = visible.filter(w => w.size === 'full' && !['work-queue', 'team-monitoring', 'analytics'].includes(w.id));
  const widgetKisi = visible.filter(w => w.size !== 'full');

  const panel = adaAgenda && !widgetDasbor.sembunyi.includes('agenda')
    ? <PanelAgenda user={currentUser} openMenu={openMenu} openUrl={openUrl} onRingkas={setRingkasAgenda} />
    : undefined;

  return (
    <div className="dasbor-3d tema-beranda w-full h-full overflow-y-auto overflow-x-hidden"
      style={widgetDasbor.latarRedup ? { background: 'rgba(241,245,249,0.9)' } : undefined}>
      <header className="sticky top-0 z-40"
        style={{ background: 'rgba(255,255,255,0.96)', borderBottom: '1px solid #e2e8f0', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-base md:text-xl md:leading-7 font-extrabold tracking-tight leading-tight text-slate-900">{firstName ? `Halo, ${firstName}` : 'Halo'}</h1>
            <p className="text-[11px] md:text-xs text-slate-500 font-medium mt-0.5">{today}</p>
          </div>
          {adaAnalytics && (
            <TabHalaman aktif={tab} onPilih={setTab} tab={[
              { kunci: 'kpi', label: 'Analytics', ikon: '📊' },
              { kunci: 'command', label: 'Command Center', ikon: '🏠', badge: hitung.totalAlerts },
              { kunci: 'audit', label: 'Audit Log', ikon: '📋', badge: hitung.auditCount },
              ...(hasFullAccess(currentUser) ? [{ kunci: 'pemakaian' as const, label: 'Pemakaian', ikon: '👥' }] : []),
            ]} />
          )}
        </div>
      </header>

      <div className="bb-wadah">
        {ajakTelegram && !tutupAjakan && (
          <div className="rounded-xl flex items-center gap-3 md:gap-4 px-4 py-3 mb-3 flex-wrap"
            style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
            <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0 text-white text-base"
              style={{ background: '#f59e0b' }}>➤</span>
            <span className="flex-1 min-w-[220px]">
              <span className="block text-[13.5px] font-bold text-slate-800">Telegram Anda belum terhubung</span>
              <span className="block text-[12px] text-slate-600 mt-0.5 leading-relaxed">
                Notifikasi jadwal baru, assign tugas, dan approval belum bisa masuk ke Telegram.
                Cukup sekali hubungkan — tidak perlu diulang.
              </span>
            </span>
            <button type="button" onClick={() => setTutupAjakan(true)}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 shrink-0">
              Nanti saja
            </button>
            <button type="button" onClick={onHubungkanTelegram}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg text-white shrink-0"
              style={{ background: '#f59e0b' }}>
              Hubungkan sekarang →
            </button>
          </div>
        )}

        {adaAnalytics ? (
          <AnalyticsPlatform embedded injectedUser={currentUser}
            controlledTab={tab} onTabChange={setTab} onCounts={setHitung}
            renderIsiKpi={p => <IsiBeranda {...p} opsi={{
              user: currentUser,
              openMenu,
              panelSamping: panel,
              rincianAtas: monitor ? <monitor.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} /> : undefined,
            }} />} />
        ) : (
          <>
            {ringkasAgenda && (
              <p className="flex items-center gap-2 mb-3 text-[13px] font-semibold text-slate-700 bb-naik">
                <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: ringkasAgenda.aksi ? '#dc2626' : '#16a34a' }} />
                {ringkasAgenda.aksi ? `${ringkasAgenda.aksi} hal perlu tindakan Anda` : 'Tidak ada yang mendesak'}
                {ringkasAgenda.hari > 0 && ` · ${ringkasAgenda.hari} agenda hari ini`}
                {ringkasAgenda.nanti > 0 && ` · ${ringkasAgenda.nanti} agenda mendatang`}
              </p>
            )}
            <div className="bb-utama">
              <div className="grid grid-cols-1 gap-3 md:gap-4 content-start min-w-0">
                {widgetUtama.map(w => <w.Component key={w.id} user={currentUser} openMenu={openMenu} openUrl={openUrl} />)}
                {widgetKisi.length > 0 && (
                  <div className="bb-kisi-lain">
                    {widgetKisi.map(w => (
                      <div key={w.id} className={SIZE_SPAN[w.size] ?? ''}>
                        <w.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {panel && <aside className="bb-samping bb-naik">{panel}</aside>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
