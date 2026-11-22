'use client';
import React from 'react';
import { Ikon } from '@/components/shared/Ikon';
import { LogoMerek } from '@/components/shared';
import { IkonTema, LABEL_TAMPILAN, URUTAN_TAMPILAN, useTampilan, useTema } from '@/components/shared/Tema';
import { MENU_ICONS, LEARNING_KEYS, PROJECT_KEYS, INTERNAL_DAILY_KEYS } from './daftar-menu';
import type { SidebarPortalProps } from './SidebarPortal';

const GRUP: { label: string; keys: string[] }[] = [
  { label: 'Learning', keys: LEARNING_KEYS },
  { label: 'Project', keys: PROJECT_KEYS },
  { label: 'Internal Daily', keys: INTERNAL_DAILY_KEYS },
];
const SEMUA_KUNCI_GRUP = GRUP.flatMap(g => g.keys);

const IKON_DASHBOARD = (
  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" strokeWidth={1.9} /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" strokeWidth={1.9} />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" strokeWidth={1.9} /><rect x="3.5" y="15.5" width="7" height="5" rx="1.5" strokeWidth={1.9} />
  </svg>
);

export interface SidebarKacaProps extends SidebarPortalProps {
  namaPlatform: string;
  namaPerusahaan: string;
}

export function SidebarKaca({
  sidebarCollapsed: ciut, setSidebarCollapsed, tourVisible, tourHighlightKey, visibleMenuItems,
  showDashboardPanel, aktifUrl, currentUser, isAdmin, isFullAccess, pendingUsers, pendingRequests,
  onMenu, onBeranda, onProfil, onAdminPanel, onKeluar, namaPlatform, namaPerusahaan,
}: SidebarKacaProps) {
  const [tampilan, pilihTampilan] = useTampilan();
  const [, putarTema, temaBerikut] = useTema();
  let urut = 0;

  const grup = [
    ...GRUP.map(g => ({ label: g.label, menu: visibleMenuItems.filter(m => g.keys.includes(m.key)) })),
    { label: 'Lainnya', menu: visibleMenuItems.filter(m => !SEMUA_KUNCI_GRUP.includes(m.key)) },
  ].filter(g => g.menu.length > 0);

  const inisial = currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <aside aria-label="Menu samping" data-ciut={ciut ? '' : undefined}
      className="pk-rel hidden md:flex"
      style={tourVisible ? { zIndex: 1505 } : undefined}>

      <div className="pk-rel-kepala">
        <LogoMerek ukuran="sm" />
        {!ciut && (
          <div className="pk-rel-nama">
            <b>{namaPlatform}</b>
            <span>{namaPerusahaan}</span>
          </div>
        )}
      </div>

      <button type="button" className="pk-handle" onClick={() => setSidebarCollapsed(!ciut)}
        aria-label={ciut ? 'Buka menu samping' : 'Ciutkan menu samping'} aria-expanded={!ciut}
        title={ciut ? 'Buka menu samping' : 'Ciutkan menu samping'}>
        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <nav className="pk-rel-isi" aria-label="Menu utama">
        <div className="pk-grup">
          {!ciut && <p className="pk-grup-label">Utama</p>}
          <TombolMenu ciut={ciut} urut={urut++} judul="Dashboard" aktif={showDashboardPanel} ikon={IKON_DASHBOARD} onClick={onBeranda} />
        </div>

        {grup.map(g => (
          <div key={g.label} className="pk-grup">
            {ciut ? <span className="pk-grup-garis" aria-hidden="true" /> : <p className="pk-grup-label">{g.label}</p>}
            {g.menu.flatMap(menu => menu.items.map((item, idx) => (
              <TombolMenu key={`${menu.key}-${idx}`} ciut={ciut} urut={urut++}
                id={idx === 0 ? `tour-menu-${menu.key}` : undefined}
                judul={g.label === 'Internal Daily' || menu.items.length > 1 ? item.name : menu.title}
                aktif={!showDashboardPanel && aktifUrl(item.url)}
                sorotTour={tourHighlightKey === menu.key}
                ikon={MENU_ICONS[menu.key] ?? <Ikon nama={menu.icon} ukuran="1.05em" className="inline-block" />}
                lencana={menu.key === 'reminder-schedule' && isFullAccess ? pendingRequests : 0}
                luar={item.external && !item.embed}
                onClick={() => onMenu(item, menu.title)} />
            )))}
          </div>
        ))}
      </nav>

      <div className="pk-rel-kaki">
        {ciut ? (
          <>
            <button type="button" className="pk-avatar" onClick={onProfil} aria-label={`Profil ${currentUser?.full_name ?? ''}`} title={currentUser?.full_name ?? ''}>{inisial}</button>
            {isAdmin && (
              <button type="button" className="pk-ikon-tombol" onClick={onAdminPanel}
                aria-label="Admin Panel" title={pendingUsers > 0 ? `Admin Panel — ${pendingUsers} user menunggu persetujuan` : 'Admin Panel'}>
                <IkonAdmin />
                {pendingUsers > 0 && <span className="pk-lencana pk-lencana-titik">{pendingUsers}</span>}
              </button>
            )}
            <button type="button" className="pk-ikon-tombol" onClick={putarTema}
              aria-label={`Tampilan: ${LABEL_TAMPILAN[tampilan]}. Ganti ke ${LABEL_TAMPILAN[temaBerikut]}`}
              title={`Ganti ke ${LABEL_TAMPILAN[temaBerikut]}`}>
              <IkonTema tampilan={tampilan} />
            </button>
            <button type="button" className="pk-ikon-tombol pk-bahaya" onClick={onKeluar} aria-label="Sign Out" title="Sign Out"><IkonKeluar /></button>
          </>
        ) : (
          <>
            <button type="button" className="pk-profil" onClick={onProfil}>
              <span className="pk-avatar" aria-hidden="true">{inisial}</span>
              <span className="min-w-0 flex-1 text-left">
                <b>{currentUser?.full_name ?? '-'}</b>
                <small>{currentUser?.role ?? '-'}</small>
              </span>
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="pk-segmen" role="radiogroup" aria-label="Tampilan">
              {URUTAN_TAMPILAN.map(t => (
                <button key={t} type="button" role="radio" aria-checked={tampilan === t} onClick={() => pilihTampilan(t)} title={`Tampilan ${LABEL_TAMPILAN[t]}`}>
                  <IkonTema tampilan={t} className="w-3.5 h-3.5" />
                  <span>{LABEL_TAMPILAN[t].replace('PTS ', '')}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <button type="button" className="pk-baris-tombol" onClick={onAdminPanel}>
                  <IkonAdmin /><span>Admin</span>
                  {pendingUsers > 0 && <span className="pk-lencana">{pendingUsers}</span>}
                </button>
              )}
              <button type="button" className="pk-baris-tombol pk-bahaya" onClick={onKeluar}>
                <IkonKeluar /><span>Sign out</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function TombolMenu({ ciut, urut, id, judul, aktif, sorotTour, ikon, lencana, luar, onClick }: {
  ciut: boolean; urut: number; id?: string; judul: string; aktif: boolean; sorotTour?: boolean; ikon: React.ReactNode;
  lencana?: number; luar?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" id={id} onClick={onClick}
      aria-current={aktif ? 'page' : undefined}
      aria-label={ciut ? judul : undefined}
      title={ciut ? judul : undefined}
      data-tour={sorotTour ? '' : undefined}
      className={`menu-3d pk-menu ${ciut ? 'h-9' : ''}`}
      style={{ ['--i' as string]: urut } as React.CSSProperties}>
      <span className="pk-menu-ikon">{ikon}</span>
      {!ciut && <span className="pk-menu-label">{judul}</span>}
      {!!lencana && lencana > 0 && <span className={`pk-lencana ${ciut ? 'pk-lencana-titik' : ''}`}>{lencana > 99 ? '99+' : lencana}</span>}
      {!ciut && luar && (
        <svg aria-hidden="true" focusable="false" className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      )}
    </button>
  );
}

const D_ADMIN = 'M10.3 4.3c.4-1.7 3-1.7 3.4 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.6c1.8.4 1.8 3 0 3.4a1.7 1.7 0 00-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 00-2.6'
  + ' 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 00-2.6-1c-1.5.9-3.3-.9-2.4-2.4a1.7 1.7 0 00-1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 001-2.6c-.9-1.6.9-3.3 2.4-2.4a1.7 1.7 0 002.6-1.1z';

function IkonAdmin() {
  return (
    <svg aria-hidden="true" focusable="false" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9}
        d={D_ADMIN} />
      <circle cx="12" cy="12" r="3" strokeWidth={1.9} />
    </svg>
  );
}

function IkonKeluar() {
  return (
    <svg aria-hidden="true" focusable="false" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
