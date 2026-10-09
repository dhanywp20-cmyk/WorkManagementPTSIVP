import { KerangkaPortal } from './_kerangka/KerangkaPortal';

/**
 * Layout bersama semua modul: satu sesi, satu header/sidebar/menu bawah, modul dirender langsung
 * (bukan iframe). Halaman publik (berbagi checklist / Project Progress) sengaja di luar grup ini.
 */
export default function LayoutPortal({ children }: { children: React.ReactNode }) {
  return <KerangkaPortal>{children}</KerangkaPortal>;
}
