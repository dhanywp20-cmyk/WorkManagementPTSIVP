'use client';

import type { MenuItem } from '../dashboard/_components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { MENU_ICONS } from './daftar-menu';

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
  return (
    <div className="space-y-1">
      <button aria-label="Main Menu"
        onClick={() => setSidebarCollapsed(false)}
        className="w-full h-9 rounded-lg flex items-center justify-center transition-all mb-1"
        style={{ color: '#94a3b8' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
        title="Main Menu"
      >
        <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onBeranda()}
        title="Dashboard"
        aria-label="Dashboard"
        aria-current={showDashboardPanel ? 'page' : undefined}
        className="menu-3d w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
        style={showDashboardPanel
          ? { background: 'rgba(200,134,29,0.15)', border: '1px solid rgba(200,134,29,0.35)', color: '#92600a' }
          : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
      ><Ikon nama="🏠" ukuran="1em" className="inline-block align-[-0.12em]" /></button>
      {visibleMenuItems.map((menu) => (
        <div key={menu.key}>
          {menu.items.map((item, itemIndex) => {
            const isActive = !showDashboardPanel && aktifUrl(item.url);
            return (
              <button
                key={itemIndex}
                onClick={() => onMenu(item, menu.title)}
                title={`${menu.title} — ${item.name}`}
                aria-current={isActive ? 'page' : undefined}
                className="menu-3d relative w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                style={
                  isActive
                    ? { background: 'rgba(200,134,29,0.15)', border: '1px solid rgba(200,134,29,0.35)', color: '#92600a' }
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
      ))}
    </div>
  );
}
