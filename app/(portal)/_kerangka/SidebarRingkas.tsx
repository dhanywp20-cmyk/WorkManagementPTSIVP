'use client';

import type { MenuItem } from '../dashboard/_components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { MENU_ICONS, IKON_BERANDA, LEARNING_KEYS, PROJECT_KEYS, INTERNAL_DAILY_KEYS } from './daftar-menu';
import { useTipSamping } from './TipSamping';

export interface SidebarRingkasProps {
  setSidebarCollapsed: (v: boolean) => void;
  onBeranda: () => void;
  showDashboardPanel: boolean;
  visibleMenuItems: MenuItem[];
  aktifUrl: (url: string) => boolean;
  onMenu: (item: MenuItem["items"][0], judulMenu: string) => void;
  isFullAccess: boolean;
  pendingRequests: number;
}

export function SidebarRingkas({
  setSidebarCollapsed, onBeranda, showDashboardPanel, visibleMenuItems, aktifUrl, onMenu, isFullAccess, pendingRequests,
}: SidebarRingkasProps) {
  const grup = [
    visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key) && m.items.length === 1),
    visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key) && m.items.length === 1),
    visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)),
  ].filter(g => g.length > 0);
  const { pasang, elemen: tip } = useTipSamping();
  return (
    <div className="space-y-1">
      {tip}
      <button aria-label="Buka menu samping" {...pasang('Buka menu samping')}
        onClick={() => setSidebarCollapsed(false)}
        className="w-full h-9 rounded-lg flex items-center justify-center transition-all mb-1"
        style={{ color: '#94a3b8' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
      >
        <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onBeranda()}
        {...pasang('Dashboard')}
        aria-label="Dashboard"
        aria-current={showDashboardPanel ? 'page' : undefined}
        className="menu-3d w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
        style={showDashboardPanel
          ? { background: 'var(--kc-aksen-lembut, rgba(200,134,29,0.15))', border: '1px solid var(--kc-aksen-tepi, rgba(200,134,29,0.35))', color: 'var(--kc-aksen-2, #92600a)' }
          : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
      >{IKON_BERANDA}</button>
      {grup.map((menuGrup, gi) => menuGrup.map((menu, mi) => (
        <div key={menu.key}>
          {gi > 0 && mi === 0 && <span aria-hidden="true" className="block h-px mx-2 mb-1 bg-slate-200" />}
          {menu.items.map((item, itemIndex) => {
            const isActive = !showDashboardPanel && aktifUrl(item.url);
            return (
              <button
                key={itemIndex}
                {...pasang(menu.title === item.name ? menu.title : `${menu.title} — ${item.name}`)}
                onClick={() => onMenu(item, menu.title)}
                aria-label={menu.title === item.name ? menu.title : `${menu.title} — ${item.name}`}
                aria-current={isActive ? 'page' : undefined}
                className="menu-3d relative w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                style={
                  isActive
                    ? { background: 'var(--kc-aksen-lembut, rgba(200,134,29,0.15))', border: '1px solid var(--kc-aksen-tepi, rgba(200,134,29,0.35))', color: 'var(--kc-aksen-2, #92600a)' }
                    : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }
                }
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                {MENU_ICONS[menu.key] ?? <span><Ikon nama={menu.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>}
                {menu.key === 'reminder-schedule' && isFullAccess && pendingRequests > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {pendingRequests}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )))}
    </div>
  );
}
