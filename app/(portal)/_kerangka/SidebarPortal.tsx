'use client';
import { IkonTema, useTema } from '@/components/shared/Tema';
import type { User, MenuItem } from '../dashboard/_components/shared';
import { SidebarLengkap } from './SidebarLengkap';
import { SidebarRingkas } from './SidebarRingkas';

export interface SidebarPortalProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  tourVisible: boolean;
  tourHighlightKey: string | null;
  visibleMenuItems: MenuItem[];
  showDashboardPanel: boolean;
  aktifUrl: (url: string) => boolean;
  currentUser: User | null;
  isAdmin: boolean;
  isFullAccess: boolean;
  pendingUsers: number;
  pendingRequests: number;
  onMenu: (item: MenuItem['items'][0], judulMenu: string) => void;
  onBeranda: () => void;
  onProfil: () => void;
  onAdminPanel: () => void;
  onKeluar: () => void;
}

export function SidebarPortal({
  sidebarCollapsed, setSidebarCollapsed, tourVisible, tourHighlightKey, visibleMenuItems,
  showDashboardPanel, aktifUrl, currentUser, isAdmin, isFullAccess, pendingUsers, pendingRequests,
  onMenu, onBeranda, onProfil, onAdminPanel, onKeluar,
}: SidebarPortalProps) {
  const [gelap, tukarTema] = useTema();
  return (
        <div
      className={`
        sidebar-3d hidden md:flex flex-col relative transition-all duration-300 ease-in-out shrink-0
        ${sidebarCollapsed ? 'w-[64px]' : 'w-[272px]'}
      `}
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '2px 0 20px rgba(0,0,0,0.10)',
        borderRight: '1px solid rgba(0,0,0,0.07)',
        ...(tourVisible ? { zIndex: 1505 } : {}),
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #c8861d 40%, #e2a84b 60%, transparent)' }} />

      {!sidebarCollapsed && (
        <div className="flex items-center justify-between gap-2 shrink-0 pl-3.5 pr-2 pt-2.5 pb-1">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 truncate">Menu</span>
          <button aria-label="Ciutkan menu samping" aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
            title="Ciutkan menu samping"
          >
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto px-2.5 pb-3 ${sidebarCollapsed ? 'pt-3' : 'pt-0.5'}`} style={{ scrollbarWidth: 'none' }}>

        {sidebarCollapsed ? (
          <SidebarRingkas
            setSidebarCollapsed={setSidebarCollapsed} onBeranda={onBeranda} showDashboardPanel={showDashboardPanel} visibleMenuItems={visibleMenuItems} aktifUrl={aktifUrl} onMenu={onMenu}
            isFullAccess={isFullAccess} pendingRequests={pendingRequests}
          />
        ) : (
          <SidebarLengkap
            onBeranda={onBeranda} showDashboardPanel={showDashboardPanel} visibleMenuItems={visibleMenuItems} aktifUrl={aktifUrl} tourHighlightKey={tourHighlightKey} onMenu={onMenu}
            isFullAccess={isFullAccess} pendingRequests={pendingRequests}
          />
        )}
      </div>

      <div className="shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
        {sidebarCollapsed ? (
          <div className="py-2 px-1.5 flex flex-col items-center gap-1.5">
            <button aria-label={currentUser?.full_name ?? ''}
              onClick={() => onProfil()}
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all"
              style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}
              title={currentUser?.full_name ?? ''}
            >
              {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </button>

            {isAdmin && (
              <button
                onClick={onAdminPanel}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                style={{ color: '#94a3b8' }}
                title={pendingUsers > 0 ? `Admin Panel — ${pendingUsers} user menunggu persetujuan` : 'Admin Panel'}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {pendingUsers > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{pendingUsers}</span>
                )}
              </button>
            )}

            <button aria-label={gelap ? 'Mode terang' : 'Mode gelap'} title={gelap ? 'Mode terang' : 'Mode gelap'} onClick={tukarTema}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <IkonTema gelap={gelap} />
            </button>

            <button aria-label="Sign Out"
              onClick={onKeluar}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
              style={{ color: '#94a3b8' }}
              title="Sign Out"
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-1">

            <button
              onClick={() => onProfil()}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
              style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,134,29,0.22)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}
              >
                {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-tight" style={{ color: '#1e293b' }}>{currentUser?.full_name ?? '-'}</p>
                <p className="text-[11px] font-bold tracking-widest uppercase mt-0.5" style={{ color: '#c8861d' }}>{currentUser?.role ?? '-'}</p>
              </div>
              <div className="w-5 h-5 rounded-sm flex items-center justify-center shrink-0" style={{ color: '#94a3b8' }}>
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {isAdmin && (
              <button
                onClick={onAdminPanel}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: '#64748b', border: '1px solid transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
              >
                <svg aria-hidden="true" focusable="false" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Admin Panel</span>
                {pendingUsers > 0 && (
                  <span className="ml-auto text-[11px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">{pendingUsers}</span>
                )}
              </button>
            )}

            <div className="flex items-center gap-1.5">
            <button
              onClick={onKeluar}
              className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ color: '#64748b', border: '1px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
            >
              <svg aria-hidden="true" focusable="false" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
            <button type="button" onClick={tukarTema} aria-label={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'} title={gelap ? 'Mode terang' : 'Mode gelap'}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
              <IkonTema gelap={gelap} />
            </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
