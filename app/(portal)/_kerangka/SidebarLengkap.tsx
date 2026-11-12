'use client';

import type { MenuItem } from '../dashboard/_components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { MENU_ICONS, LEARNING_KEYS, PROJECT_KEYS, INTERNAL_DAILY_KEYS } from './daftar-menu';

export interface SidebarLengkapProps {
  onBeranda: () => void;
  showDashboardPanel: boolean;
  visibleMenuItems: MenuItem[];
  aktifUrl: (url: string) => boolean;
  tourHighlightKey: string | null;
  onMenu: (item: MenuItem["items"][0], judulMenu: string) => void;
  isFullAccess: boolean;
  pendingRequests: number;
}

export function SidebarLengkap({
  onBeranda, showDashboardPanel, visibleMenuItems, aktifUrl, tourHighlightKey, onMenu, isFullAccess, pendingRequests,
}: SidebarLengkapProps) {
  return (
    <div className="space-y-4">
    
      <div>
        <button
          onClick={() => onBeranda()}
          aria-current={showDashboardPanel ? 'page' : undefined}
          className="menu-3d w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
          style={showDashboardPanel
            ? { background: 'rgba(200,134,29,0.12)', border: '1px solid rgba(200,134,29,0.30)', color: '#92600a' }
            : { background: 'transparent', border: '1px solid transparent', color: '#475569' }}
          onMouseEnter={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'; } }}
          onMouseLeave={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}
        >
          <span className="w-5 h-5 text-sm flex items-center justify-center shrink-0"><Ikon nama="🏠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <span className="text-sm font-semibold truncate">Dashboard</span>
          {showDashboardPanel && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
        </button>
      </div>
    
      {visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key)).length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(0,0,0,0.56)' }}>Learning</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </div>
          <div className="space-y-0.5">
            {visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key)).map(menu => {
              if (menu.items.length === 1) {
                const item = menu.items[0];
                const isActive = aktifUrl(item.url);
                const isTourHL = tourHighlightKey === menu.key;
                return (
                  <button
                    key={menu.key}
                    id={`tour-menu-${menu.key}`}
                    onClick={() => onMenu(item, menu.title)}
                    aria-current={isActive ? 'page' : undefined}
                    className="menu-3d w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                    style={
                      isTourHL
                        ? { background: 'rgba(250,204,21,0.13)', border: '1.5px solid rgba(250,204,21,0.65)', color: '#334155', animation: 'tourMenuPulse 1.6s ease-in-out infinite', position: 'relative', zIndex: 1510 }
                        : isActive
                          ? { background: 'rgba(67,56,202,0.10)', border: '1px solid rgba(67,56,202,0.25)', color: '#3730a3' }
                          : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                    }
                    onMouseEnter={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(67,56,202,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(67,56,202,0.12)'; } }}
                    onMouseLeave={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                  >
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: isActive ? 'rgba(67,56,202,0.15)' : 'rgba(0,0,0,0.06)',
                        color: isActive ? '#3730a3' : '#64748b',
                      }}
                    >
                      {MENU_ICONS[menu.key] ?? <span><Ikon nama={menu.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{menu.title}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#4338ca' }} />
                    )}
                  </button>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
    
      {visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key)).length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(0,0,0,0.56)' }}>Project</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </div>
          <div className="space-y-0.5">
            {visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key)).map(menu => {
              if (menu.items.length === 1) {
                const item = menu.items[0];
                const isActive = aktifUrl(item.url);
                const isTourHL = tourHighlightKey === menu.key;
                return (
                  <button
                    key={menu.key}
                    id={`tour-menu-${menu.key}`}
                    onClick={() => onMenu(item, menu.title)}
                    aria-current={isActive ? 'page' : undefined}
                    className="menu-3d w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                    style={
                      isTourHL
                        ? { background: 'rgba(250,204,21,0.13)', border: '1.5px solid rgba(250,204,21,0.65)', color: '#334155', animation: 'tourMenuPulse 1.6s ease-in-out infinite', position: 'relative', zIndex: 1510 }
                        : isActive
                          ? { background: 'rgba(200,134,29,0.11)', border: '1px solid rgba(200,134,29,0.28)', color: '#92600a' }
                          : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                    }
                    onMouseEnter={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; } }}
                    onMouseLeave={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                  >
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                        color: isActive ? '#92600a' : '#64748b',
                      }}
                    >
                      {MENU_ICONS[menu.key] ?? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{menu.title}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c8861d' }} />
                    )}
                  </button>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
    
      {visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)).length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(0,0,0,0.56)' }}>Internal Daily</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </div>
          <div className="space-y-0.5">
            {visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)).flatMap(menu =>
              menu.items.map((item, itemIndex) => {
                const isActive = aktifUrl(item.url);
                const isTourHL = tourHighlightKey === menu.key;
                return (
                  <button
                    key={`${menu.key}-${itemIndex}`}
                    id={`tour-menu-${menu.key}`}
                    onClick={() => onMenu(item, menu.title)}
                    aria-current={isActive ? 'page' : undefined}
                    className="menu-3d w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                    style={
                      isTourHL
                        ? { background: 'rgba(250,204,21,0.13)', border: '1.5px solid rgba(250,204,21,0.65)', color: '#334155', animation: 'tourMenuPulse 1.6s ease-in-out infinite', position: 'relative', zIndex: 1510 }
                        : isActive
                          ? { background: 'rgba(200,134,29,0.11)', border: '1px solid rgba(200,134,29,0.28)', color: '#92600a' }
                          : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                    }
                    onMouseEnter={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; } }}
                    onMouseLeave={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                  >
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                        color: isActive ? '#92600a' : '#64748b',
                      }}
                    >
                      {MENU_ICONS[menu.key] ?? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
                    {menu.key === 'reminder-schedule' && isFullAccess && pendingRequests > 0 && (
                      <span className="text-[11px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none shrink-0">
                        {pendingRequests}
                      </span>
                    )}
                    {item.external && !item.embed && (
                      <svg aria-hidden="true" focusable="false" className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                    {isActive && !item.external && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c8861d' }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    
    </div>
  );
}
