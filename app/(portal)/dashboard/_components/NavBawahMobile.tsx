'use client';
import { cloneElement, isValidElement, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { TOMBOL_TERLIHAT, urutNav, type MenuNav } from './nav-bawah';

/**
 * Navigasi HP & aplikasi (APK) - pola aplikasi seluler, bukan sidebar: bar bawah berisi
 * Dashboard + SEMUA menu yang boleh dibuka akun ini + Admin Panel / Keluar, digeser kiri-kanan.
 * Lima tombol terlihat sekaligus; menu paling sering dipakai ada di depan; menu yang sedang
 * dibuka selalu digeser ke tengah. Hanya tampil di layar < md; desktop tetap memakai sidebar.
 *
 * Bar berada DI DALAM alur layout (anak flex-col terakhir sebelum footer), jadi area modul
 * menyusut setinggi bar - tidak ada konten yang tertutup.
 */

const IKON_DASHBOARD = (
  <svg aria-hidden="true" focusable="false" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" strokeWidth={1.8} /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" strokeWidth={1.8} />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" strokeWidth={1.8} /><rect x="3.5" y="15.5" width="7" height="5" rx="1.5" strokeWidth={1.8} />
  </svg>
);
export const IKON_AKUN = {
  admin: (
    <svg aria-hidden="true" focusable="false" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.3 4.3c.4-1.7 3-1.7 3.4 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.6c1.8.4 1.8 3 0 3.4a1.7 1.7 0 00-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 00-2.6-1c-1.5.9-3.3-.9-2.4-2.4a1.7 1.7 0 00-1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 001-2.6c-.9-1.6.9-3.3 2.4-2.4a1.7 1.7 0 002.6-1.1z" />
      <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
    </svg>
  ),
  keluar: (
    <svg aria-hidden="true" focusable="false" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
};

/** Ikon SVG garis diperbesar seragam; ikon lain (emoji) dibungkus ukuran huruf. */
function IkonNav({ ikon, ukuran }: { ikon: ReactNode; ukuran: number }) {
  if (isValidElement(ikon) && ikon.type === 'svg') {
    return cloneElement(ikon as ReactElement<{ className?: string; style?: CSSProperties }>, { className: '', style: { width: ukuran, height: ukuran } });
  }
  return <span className="leading-none" style={{ fontSize: ukuran - 2 }}>{ikon}</span>;
}

export function NavBawahMobile({ beranda, menu, akun, aksen = '#b45309' }: {
  beranda: Omit<MenuNav, 'ikon'> & { ikon?: ReactNode };
  /** Menu modul yang boleh dibuka akun ini. */ menu: MenuNav[];
  /** Admin Panel, Keluar - di ujung kanan bar. */ akun: MenuNav[];
  aksen?: string;
}) {
  const jalur = useRef<HTMLDivElement>(null);
  const daftar: MenuNav[] = [{ ...beranda, ikon: beranda.ikon ?? IKON_DASHBOARD }, ...urutNav(menu), ...akun];
  const kunciAktif = daftar.find(m => m.aktif)?.key;

  //  Menu yang sedang dibuka selalu terlihat: bar menggeser item aktif ke tengah.
  //  (scrollTo pada bar itu sendiri - scrollIntoView ikut menggulir halaman & terhenti di tengah oleh snap.)
  useEffect(() => {
    const bar = jalur.current, el = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !el) return;
    bar.scrollTo({ left: Math.max(0, el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2), behavior: 'smooth' });
  }, [kunciAktif]);

  return (
    <nav aria-label="Menu utama" className="md:hidden flex-shrink-0 relative"
      style={{
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(18px) saturate(170%)', WebkitBackdropFilter: 'blur(18px) saturate(170%)',
        borderTop: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 -4px 18px rgba(15,23,42,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
      <div ref={jalur} className="relative flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
        {daftar.map(m => {
          const warna = m.bahaya ? '#dc2626' : m.aktif ? aksen : '#64748b';
          return (
            <button key={m.key} type="button" onClick={m.onPilih} aria-current={m.aktif ? 'page' : undefined}
              className="relative snap-start flex-shrink-0 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 active:scale-95 transition-transform"
              style={{ width: `${100 / TOMBOL_TERLIHAT}%`, minWidth: 64, color: warna }}>
              {/*  Garis penanda di atas tombol aktif. */}
              {m.aktif && <span aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full" style={{ background: aksen }} />}
              <span className="relative">
                <IkonNav ikon={m.ikon} ukuran={24} />
                {!!m.badge && m.badge > 0 && (
                  <span className="absolute -top-1.5 left-1/2 ml-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center ring-2 ring-white">
                    {m.badge > 99 ? '99+' : m.badge}
                  </span>
                )}
              </span>
              <span className={`w-full px-0.5 truncate text-center text-[11px] leading-tight ${m.aktif ? 'font-bold' : 'font-semibold'}`}>{m.pendek ?? m.label}</span>
            </button>
          );
        })}
      </div>
      {/*  Pudar di tepi kanan: petunjuk bahwa barisnya bisa digeser. */}
      {daftar.length > TOMBOL_TERLIHAT && (
        <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 bottom-0 w-6"
          style={{ background: 'linear-gradient(270deg, rgba(255,255,255,0.95), rgba(255,255,255,0))' }} />
      )}
    </nav>
  );
}
