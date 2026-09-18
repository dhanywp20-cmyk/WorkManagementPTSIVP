/**
 * Ikon garis (bukan emoji) untuk NotificationBar - satu bahasa visual dengan
 * ikon pencarian/menu yang sudah ada di header (stroke=currentColor, sudut
 * membulat). Sebelumnya tiap lonceng memakai emoji (🎫🏗️🗓️⭐🔔) yang gaya
 * dan bobotnya beda-beda tergantung sistem operasi/peramban - berdampingan
 * dengan ikon SVG yang rapi, hasilnya terlihat tidak seragam.
 *
 * Warna ikon dilempar lewat prop `style`/currentColor, bukan dipaku - jadi
 * tiap lonceng tetap tampil dengan warna aksennya sendiri (Ticket=rose,
 * Require=ungu, Reminder=cyan, dst) yang sudah didefinisikan di
 * NotificationBar, hanya bentuknya yang sekarang seragam.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function IconTicket(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <circle cx="12" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Require (Request Design Project) - motif tas kerja/proyek. */
export function IconBriefcase(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <polygon points="12.00,2.80 14.17,9.01 20.75,9.16 15.52,13.14 17.41,19.44 12.00,15.70 6.59,19.44 8.48,13.14 3.25,9.16 9.83,9.01" />
    </svg>
  );
}

/** Sama persis dengan bell badge total di NotificationBar - satu bentuk lonceng untuk semua. */
export function IconBell(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

export function IconSpeaker({ muted, ...props }: IconProps & { muted?: boolean }) {
  return (
    <svg {...base} {...props}>
      <path d="M3 9v6h3l5 4V5L6 9H3Z" />
      {muted ? (
        <>
          <line x1="16" y1="9" x2="21" y2="15" />
          <line x1="21" y1="9" x2="16" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18 6a8.5 8.5 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

export function IconDevicePhone(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="2" width="8" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}
