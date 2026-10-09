'use client';

/**
 * SidebarPortal - menu samping desktop/laptop (HP & APK memakai NavBawahMobile). Dipecah dari
 * KerangkaPortal; semua keadaan tetap milik induk, di sini hanya tampilan + callback.
 */
import React from 'react';
import type { User, MenuItem } from '../dashboard/_components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { MENU_ICONS, LEARNING_KEYS, PROJECT_KEYS, INTERNAL_DAILY_KEYS } from './daftar-menu';

export interface SidebarPortalProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  tourVisible: boolean;
  tourHighlightKey: string | null;
  menuLoading: boolean;
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
  sidebarCollapsed, setSidebarCollapsed, tourVisible, tourHighlightKey, menuLoading, visibleMenuItems,
  showDashboardPanel, aktifUrl, currentUser, isAdmin, isFullAccess, pendingUsers, pendingRequests,
  onMenu, onBeranda, onProfil, onAdminPanel, onKeluar,
}: SidebarPortalProps) {
  return (
        <div
      className={`
        hidden md:flex flex-col relative transition-all duration-300 ease-in-out flex-shrink-0
        ${sidebarCollapsed ? 'w-[64px]' : 'w-[272px]'}
      `}
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '2px 0 20px rgba(0,0,0,0.10)',
        borderRight: '1px solid rgba(0,0,0,0.07)',
        // Sidebar hanya untuk desktop / laptop; HP & APK memakai NavBawahMobile.
        ...(tourVisible ? { zIndex: 1505 } : {}),
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #c8861d 40%, #e2a84b 60%, transparent)' }} />

      {/*
        Baris kepala sidebar - tombol ciutkan tinggal DI SINI, bukan
        melayang absolute di pojok.

        Versi lamanya `absolute top-2 right-2`, sementara daftar menu di
        bawahnya mulai pada padding 12px. Keduanya berebut titik yang sama,
        jadi tombolnya menumpuk persis di atas tepi kanan item menu pertama
        (Dashboard) - terbaca seperti tombol MILIK item itu, bukan milik
        sidebar-nya. Sebagai baris sendiri, ia punya ruangnya sendiri dan
        tidak pernah bisa menimpa apa pun, berapa pun panjang daftar menunya.

        Label "Menu" bukan sekadar pengisi: tanpanya barisnya cuma tombol
        menggantung di kanan tanpa penjelasan apa yang diciutkan.
      */}
      {!sidebarCollapsed && (
        <div className="flex items-center justify-between gap-2 flex-shrink-0 pl-3.5 pr-2 pt-2.5 pb-1">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 truncate">Menu</span>
          <button aria-label="Ciutkan menu samping" aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
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

      {/* ── SIDEBAR SCROLLABLE CONTENT ── */}
      {/*  Padding atas ikut keadaan: saat mengembang, baris kepala di atas
           sudah memberi jarak, jadi py-3 penuh akan menggandakannya. */}
      <div className={`flex-1 overflow-y-auto px-2.5 pb-3 ${sidebarCollapsed ? 'pt-3' : 'pt-0.5'}`} style={{ scrollbarWidth: 'none' }}>

        {menuLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.35)', borderTopColor: '#e2a84b' }} />
          </div>
        ) : sidebarCollapsed ? (
          /* Collapsed: icon-only */
          <div className="space-y-1">
            {/* Expand button - top */}
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
              className="w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
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
                      className="relative w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                      style={
                        isActive
                          ? { background: 'rgba(200,134,29,0.15)', border: '1px solid rgba(200,134,29,0.35)', color: '#92600a' }
                          : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }
                      }
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      {MENU_ICONS[menu.key] ?? <span><Ikon nama={menu.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>}
                      {/* Antrean request jadwal muncul DI SINI — di menu yang
                          benar-benar memuatnya, bukan di ikon Admin Panel. */}
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
        ) : (
          /* Expanded: full nav */
          <div className="space-y-4">

            {/* ── Dashboard/Home item (untuk SEMUA role — homepage adaptif) ── */}
            <div>
              <button
                onClick={() => onBeranda()}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                style={showDashboardPanel
                  ? { background: 'rgba(200,134,29,0.12)', border: '1px solid rgba(200,134,29,0.30)', color: '#92600a' }
                  : { background: 'transparent', border: '1px solid transparent', color: '#475569' }}
                onMouseEnter={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'; } }}
                onMouseLeave={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}
              >
                <span className="w-5 h-5 text-sm flex items-center justify-center flex-shrink-0"><Ikon nama="🏠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <span className="text-sm font-semibold truncate">Dashboard</span>
                {showDashboardPanel && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
              </button>
            </div>

            {/* Learning Center section */}
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
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
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
                            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{
                              background: isActive ? 'rgba(67,56,202,0.15)' : 'rgba(0,0,0,0.06)',
                              color: isActive ? '#3730a3' : '#64748b',
                            }}
                          >
                            {MENU_ICONS[menu.key] ?? <span><Ikon nama={menu.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium">{menu.title}</span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4338ca' }} />
                          )}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}

            {/* Project section */}
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
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
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
                            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{
                              background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                              color: isActive ? '#92600a' : '#64748b',
                            }}
                          >
                            {MENU_ICONS[menu.key] ?? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium">{menu.title}</span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#c8861d' }} />
                          )}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}

            {/* Internal Daily section */}
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
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
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
                            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{
                              background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                              color: isActive ? '#92600a' : '#64748b',
                            }}
                          >
                            {MENU_ICONS[menu.key] ?? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
                      {/* Antrean request jadwal muncul DI SINI — di menu yang
                          benar-benar memuatnya, bukan di ikon Admin Panel. */}
                          {menu.key === 'reminder-schedule' && isFullAccess && pendingRequests > 0 && (
                            <span className="text-[11px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                              {pendingRequests}
                            </span>
                          )}
                          {item.external && !item.embed && (
                            <svg aria-hidden="true" focusable="false" className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          )}
                          {isActive && !item.external && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#c8861d' }} />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}


          </div>
        )}
      </div>

      {/* ── SIDEBAR FOOTER: User + Admin + Sign Out ── */}
      <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
        {sidebarCollapsed ? (
          /* Collapsed footer */
          <div className="py-2 px-1.5 flex flex-col items-center gap-1.5">
            {/* Avatar */}
            <button aria-label={currentUser?.full_name ?? ''}
              onClick={() => onProfil()}
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-all"
              style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}
              title={currentUser?.full_name ?? ''}
            >
              {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </button>

            {/* Admin */}
            {isAdmin && (
              <button
                onClick={() => onAdminPanel}
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

            {/* Sign out */}
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
          /* Expanded footer */
          <div className="p-3 space-y-1">

            {/* User profile row */}
            <button
              onClick={() => onProfil()}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
              style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,134,29,0.22)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}
              >
                {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-tight" style={{ color: '#1e293b' }}>{currentUser?.full_name ?? '-'}</p>
                <p className="text-[11px] font-bold tracking-widest uppercase mt-0.5" style={{ color: '#c8861d' }}>{currentUser?.role ?? '-'}</p>
              </div>
              <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ color: '#94a3b8' }}>
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Admin Panel */}
            {isAdmin && (
              <button
                onClick={() => onAdminPanel}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: '#64748b', border: '1px solid transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
              >
                <svg aria-hidden="true" focusable="false" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Admin Panel</span>
                {pendingUsers > 0 && (
                  <span className="ml-auto text-[11px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">{pendingUsers}</span>
                )}
              </button>
            )}

            {/* Sign out */}
            <button
              onClick={onKeluar}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ color: '#64748b', border: '1px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
            >
              <svg aria-hidden="true" focusable="false" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>

          </div>
        )}
      </div>
    </div>
  );
}
