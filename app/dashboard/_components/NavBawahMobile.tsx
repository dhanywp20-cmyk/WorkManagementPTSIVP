'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Bar menu bawah untuk HP (< md): deretan ikon + nama yang bisa digeser kiri-kanan untuk
 * melihat SEMUA menu, dengan efek kaca ala iOS (latar tembus pandang + blur + garis tepi
 * terang) - mengikuti platform Installer. Sidebar desktop tidak berubah.
 *
 * Berada DI DALAM alur layout (anak flex-col terakhir, di atas footer), bukan melayang
 * menimpa isi: area modul menyusut setinggi bar, jadi tidak ada konten/tombol modul
 * yang tertutup. Efek kaca tetap terlihat karena latar dasbor ada di belakangnya.
 */

export interface ItemNavBawah {
  key: string;
  label: string;
  ikon: ReactNode;
  aktif: boolean;
  /** Angka kecil di pojok ikon (mis. antrean request), 0/undefined = tidak tampil. */
  badge?: number;
  onPilih: () => void;
}

export function NavBawahMobile({ item }: { item: ItemNavBawah[] }) {
  const jalur = useRef<HTMLDivElement>(null);
  const kunciAktif = item.find(i => i.aktif)?.key;

  //  Menu yang sedang dibuka selalu terlihat: bar menggulir ke tengah pada item aktif.
  useEffect(() => {
    const el = jalur.current?.querySelector<HTMLElement>('[data-aktif="1"]');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [kunciAktif]);

  if (!item.length) return null;
  return (
    <nav aria-label="Menu utama" className="md:hidden flex-shrink-0 px-2.5 pt-1.5"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
      <div className="relative rounded-[26px] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.58)',
          backdropFilter: 'blur(26px) saturate(180%)',
          WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.72)',
          boxShadow: '0 8px 30px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}>
        <div ref={jalur} role="tablist" aria-orientation="horizontal"
          className="flex gap-1 overflow-x-auto px-2 py-1.5 snap-x"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
          {item.map(i => (
            <button key={i.key} type="button" role="tab" aria-selected={i.aktif} data-aktif={i.aktif ? '1' : undefined}
              onClick={i.onPilih}
              className="relative snap-center flex-shrink-0 flex flex-col items-center gap-0.5 rounded-2xl px-2.5 pt-1.5 pb-1 transition-all active:scale-95"
              style={{ width: 72, color: i.aktif ? '#92600a' : '#475569', background: i.aktif ? 'rgba(255,255,255,0.78)' : 'transparent',
                boxShadow: i.aktif ? '0 1px 6px rgba(15,23,42,0.10), inset 0 0 0 1px rgba(200,134,29,0.28)' : 'none' }}>
              <span className="w-8 h-7 flex items-center justify-center text-[19px] leading-none">{i.ikon}</span>
              <span className={`w-full h-[24px] text-center text-[10px] leading-[12px] line-clamp-2 break-words ${i.aktif ? 'font-bold' : 'font-medium'}`}>{i.label}</span>
              {!!i.badge && i.badge > 0 && (
                <span className="absolute top-0.5 right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{i.badge}</span>
              )}
            </button>
          ))}
        </div>
        {/* Pudar di kedua tepi: petunjuk bahwa barisnya bisa digeser. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-5" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.55), transparent)' }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-5" style={{ background: 'linear-gradient(270deg, rgba(255,255,255,0.55), transparent)' }} />
      </div>
    </nav>
  );
}
