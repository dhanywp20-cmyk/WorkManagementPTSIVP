'use client';
import React from 'react';
import { setDbToken } from '@/lib/supabase';
import { setSession } from '@/lib/auth/sesi';
import { hasFullAccess } from '@/lib/constants';
import { UserProfileModal, NotificationBar, AdminPanelModal } from '../dashboard/_components/Modals';
import GlobalSearch from '../dashboard/_components/GlobalSearch';
import PermissionAwareDashboard from '../dashboard/_components/widgets/PermissionAwareDashboard';
import OnboardingTour from '../dashboard/_components/OnboardingTour';
import { NavBawahMobile, IKON_AKUN } from '../dashboard/_components/NavBawahMobile';
import { LABEL_PENDEK } from '../dashboard/_components/nav-bawah';
import { AsistenPlatform } from '../dashboard/_components/AsistenPlatform';
import { LayarMasuk } from './LayarMasuk';
import { SidebarPortal } from './SidebarPortal';
import { MENU_ICONS } from './daftar-menu';
import { latarDasbor } from '@/lib/merek/inti';
import { LogoMerek, FooterPlatform } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { AnalyticsIframe } from './AnalyticsIframe';
import { GridMenuPortal } from './KartuMenuPortal';
import { BannerLisensi } from '@/components/shared/Lisensi';
import { useKerangkaPortal } from './useKerangkaPortal';

export function KerangkaPortal({ children }: { children: React.ReactNode }) {
  const {
    loading, merek, isLoggedIn, setCurrentUser, autoNavigatedRef, masukKeDashboard, currentUser, setShowSidebar,
    pindahKe, handleNotifNavigate, showSidebar, setShowUserProfile, handleLogout, layarPenuh, berandaTersorot, visibleMenuItems,
    aktifUrl, isFullAccess, pendingRequests, handleMenuClick, isAdmin, pendingUsers, setAdminPanelTab, setShowAdminPanel,
    showAdminPanel, adminPanelTab, showUserProfile, dasborMuncul, tourVisible, modulAktif, asistenAtasan, setShowTour,
    canAccessKPI, learningMenuItems, projectMenuItems, internalMenuItems, showTour, setTourHighlightKey, setTourVisible, sidebarCollapsed,
    setSidebarCollapsed, tourHighlightKey, sedangPindah, showDashboardPanel, openMenuByKey, setIsiEl, lisensi,
  } = useKerangkaPortal();

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ background: 'var(--latar-halaman)', minHeight: '100dvh' }} aria-busy="true">
        <div className="flex flex-col items-center gap-5" style={{ animation: 'fadeIn 400ms ease 200ms both' }}>
          <LogoMerek ukuran="lg" />
          <div className="w-28 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.1)' }}>
            <div className="h-full w-1/2 rounded-full" style={{ background: merek.warnaUtama, animation: 'loadingBar 1.1s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LayarMasuk
        onMasuk={(data, token) => {
          setCurrentUser(data);
          setSession(data);
          setDbToken(token);
          autoNavigatedRef.current = true;
        }}
        onSelesai={masukKeDashboard}
      />
    );
  }

  const renderHeader = (_withBackBtn = false) => (
    <div className="kepala-3d bg-white/80 backdrop-blur-md shadow-md shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'relative', zIndex: 60 }}>
      <div className="w-full px-3 md:px-4 py-3 md:py-3.5">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <LogoMerek ukuran="sm" className="flex md:hidden" />
            <LogoMerek ukuran="md" className="hidden md:flex" />
            <div>
              <div className="flex items-center gap-1.5 md:gap-2.5">
                <h1 className="text-sm md:text-xl md:leading-7 font-bold text-slate-800 tracking-tight leading-tight">
                  <span className="hidden sm:inline">{merek.namaPlatform}</span>
                  <span className="sm:hidden">{merek.namaPlatformSingkat}</span>
                </h1>
                <span className="hidden sm:inline text-slate-400 font-light">|</span>
                <span className="hidden sm:inline text-xs md:text-sm font-bold tracking-wide" style={{ color: merek.warnaAksen }}>{merek.namaPortal}</span>
              </div>
              <p className="text-slate-500 text-[11px] md:text-xs font-medium mt-0.5 hidden sm:block">{merek.namaPerusahaan}</p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {currentUser && (
              <GlobalSearch
                currentUser={currentUser}
                onNavigate={(url) => { setShowSidebar(true); pindahKe(url); }}
              />
            )}
            {currentUser && (
              <NotificationBar currentUser={currentUser} onNavigate={handleNotifNavigate} />
            )}
            {!showSidebar && (
              <div className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl border border-slate-200/80 bg-white/70 backdrop-blur-xs">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                  style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                  {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-800">{currentUser?.full_name}</p>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-amber-700">{currentUser?.role}</p>
                </div>
              </div>
            )}

            {currentUser && (
              <button type="button" onClick={() => setShowUserProfile(true)} aria-label={`Profil ${currentUser.full_name ?? ''}`}
                className="md:hidden w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                {currentUser.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
              </button>
            )}

            {!showSidebar && (
              <button onClick={() => setShowUserProfile(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#065f46' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.08)'; }}>
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                User Profile
              </button>
            )}

            {!showSidebar && (
              <button onClick={handleLogout}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', color: '#b91c1c' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.13)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)'; }}>
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );

  const bukaDashboard = () => { setShowSidebar(true); pindahKe('/dashboard'); };
  const renderNavBawah = () => (!layarPenuh && currentUser ? (
    <NavBawahMobile
      aksen={merek.warnaAksen}
      beranda={{ key: '__dashboard', label: 'Dashboard', aktif: showSidebar ? berandaTersorot : true, onPilih: bukaDashboard }}
      menu={visibleMenuItems.filter(m => m.items.length).map(menu => {
        const it = menu.items[0];
        return {
          key: menu.key, label: menu.title, pendek: LABEL_PENDEK[menu.key],
          ikon: MENU_ICONS[menu.key] ?? <Ikon nama={menu.icon} ukuran="1em" className="inline-block align-[-0.12em]" />,
          aktif: showSidebar && !berandaTersorot && menu.items.some(x => aktifUrl(x.url)),
          badge: menu.key === 'reminder-schedule' && isFullAccess ? pendingRequests : 0,
          onPilih: () => handleMenuClick(it, menu.title),
        };
      })}
      akun={[
        ...(isAdmin ? [{ key: '__admin', label: 'Admin Panel', ikon: IKON_AKUN.admin, badge: pendingUsers,
          onPilih: () => { setAdminPanelTab(pendingUsers > 0 ? 'userManagement' : 'settings'); setShowAdminPanel(true); } }] : []),
        { key: '__keluar', label: 'Keluar', ikon: IKON_AKUN.keluar, bahaya: true, onPilih: handleLogout },
      ]}
    />
  ) : null);

  const renderModals = () => (
    <>
      {showAdminPanel && <AdminPanelModal initialTab={adminPanelTab} onClose={() => setShowAdminPanel(false)} />}
      {showUserProfile && currentUser && <UserProfileModal currentUser={currentUser} onClose={() => setShowUserProfile(false)} />}
    </>
  );

  if (!showSidebar) {
    return (
      <div className={`${dasborMuncul ? 'lc-dasbor-pudar' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ ...latarDasbor(merek), height: '100dvh' }}>
        {renderModals()}
        {currentUser && !tourVisible && (
          <AsistenPlatform modul={modulAktif} atasan={asistenAtasan} onMulaiTur={() => setShowTour(true)} />
        )}
        {renderHeader()}

        <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8">
          <div className="max-w-[1600px] mx-auto space-y-8">
            {(
              <>
                {canAccessKPI && currentUser && (
                  <AnalyticsIframe />
                )}
                <GridMenuPortal learningMenuItems={learningMenuItems} projectMenuItems={projectMenuItems}
                  internalMenuItems={internalMenuItems} onMenuClick={handleMenuClick} />

              </>
            )}
          </div>
        </div>

        {renderNavBawah()}
        <FooterPlatform />

        <style>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
          @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`${dasborMuncul ? 'lc-dasbor-pudar' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ ...latarDasbor(merek), height: '100dvh' }}>
      {renderModals()}

      {currentUser && (
        <>
          <OnboardingTour
            currentUser={currentUser}
            visibleMenuKeys={visibleMenuItems.map(m => m.key)}
            forceShow={showTour}
            onDone={() => setShowTour(false)}
            onHighlightKey={setTourHighlightKey}
            onVisibleChange={setTourVisible}
          />
          {!tourVisible && (
            <AsistenPlatform modul={modulAktif} atasan={asistenAtasan} onMulaiTur={() => setShowTour(true)} />
          )}
        </>
      )}
      {renderHeader()}

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <SidebarPortal
          sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
          tourVisible={tourVisible} tourHighlightKey={tourHighlightKey}
          visibleMenuItems={visibleMenuItems} showDashboardPanel={berandaTersorot} aktifUrl={aktifUrl}
          currentUser={currentUser} isAdmin={isAdmin} isFullAccess={isFullAccess}
          pendingUsers={pendingUsers} pendingRequests={pendingRequests}
          onMenu={handleMenuClick} onBeranda={() => pindahKe('/dashboard')}
          onProfil={() => setShowUserProfile(true)}
          onAdminPanel={() => { setAdminPanelTab(pendingUsers > 0 ? 'userManagement' : 'settings'); setShowAdminPanel(true); }}
          onKeluar={handleLogout}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className={`flex-1 min-h-0 overflow-hidden relative ${sedangPindah ? 'isi-sedang-pindah' : ''}`}
            style={{ ['--warna-pindah' as string]: merek.warnaAksen }}>
            {sedangPindah && <div aria-hidden="true" className="bilah-pindah-menu" />}
            {showDashboardPanel && currentUser ? (
              <div className="w-full h-full overflow-hidden relative"
                style={latarDasbor(merek)}>
                <PermissionAwareDashboard currentUser={currentUser} openMenu={openMenuByKey} openUrl={handleNotifNavigate}
                  onHubungkanTelegram={() => setShowUserProfile(true)} />
              </div>
            ) : (
              <div ref={setIsiEl} className={layarPenuh
                ? 'isi-portal fixed inset-0 z-300 bg-white overflow-auto'
                : 'isi-portal w-full h-full overflow-auto relative'}>
                <BannerLisensi s={lisensi} admin={hasFullAccess(currentUser)} />
                {children}
              </div>
            )}
          </div>
        </div>
      </div>

      {renderNavBawah()}

      <FooterPlatform />

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes loadingBar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(80%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
