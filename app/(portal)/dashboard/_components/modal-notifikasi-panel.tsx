'use client';
/** modal-notifikasi-panel.tsx - dipecah dari modal-notifikasi.tsx (scripts/pecah-modul.mjs); modal-notifikasi.tsx tetap mengekspor ulang semuanya. */
import { ModalPortal } from '@/components/shared/ModalPortal';
import React,{ useEffect,useState } from 'react';
import { NotificationItem } from './shared';

// Panel rincian notifikasi per bagian

export type BagianNotif = {
  kunci: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; bgColor: string; dotColor: string; items: NotificationItem[]; onMarkAllRead?: () => void;
};

/**
 * Di HP lonceng per bagian disembunyikan (tidak muat), sehingga yang terlihat
 * hanya angka total - orang tidak tahu notifikasi itu dari Ticket, Require,
 * atau Reminder. Badge total kini membuka panel ini: tiap bagian dengan
 * jumlahnya sendiri, ketuk untuk membuka daftarnya. Di HP tampil sebagai
 * lembar dari bawah; di layar lebar sebagai panel di bawah header.
 */
export function PanelNotifBagian({ bagian, onTutup, onItemClick }: {
  bagian: BagianNotif[]; onTutup: () => void; onItemClick: (item: NotificationItem) => void;
}) {
  const pertamaBerisi = bagian.find(b => b.items.length > 0)?.kunci ?? null;
  const [buka, setBuka] = useState<string | null>(pertamaBerisi);
  const total = bagian.reduce((n, b) => n + b.items.length, 0);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onTutup]);

  const waktu = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return `${m}m lalu`;
    if (m < 1440) return `${Math.floor(m / 60)}j lalu`;
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[1600] bg-slate-900/40" onClick={onTutup} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Rincian notifikasi"
        className="fixed z-[1601] inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl sm:inset-x-auto sm:bottom-auto sm:top-16 sm:right-4 sm:w-[380px] sm:max-h-[75vh] sm:rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">Notifikasi</p>
            <p className="text-[11px] text-slate-500">{total > 0 ? `${total} belum ditindaklanjuti` : 'Semua sudah beres'}</p>
          </div>
          <button type="button" onClick={onTutup} aria-label="Tutup"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {bagian.map(b => {
            const terbuka = buka === b.kunci;
            const Icon = b.icon;
            return (
              <section key={b.kunci} className="border-b border-slate-100 last:border-0">
                <button type="button" onClick={() => setBuka(terbuka ? null : b.kunci)} aria-expanded={terbuka}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 min-h-[52px]">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: b.bgColor }}>
                    <Icon className="w-4 h-4" style={{ color: b.color }} />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{b.label}</span>
                  {b.items.length > 0
                    ? <span className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: b.dotColor }}>{b.items.length > 99 ? '99+' : b.items.length}</span>
                    : <span className="text-[11px] font-semibold text-slate-500">0</span>}
                  <svg aria-hidden="true" className={`w-4 h-4 text-slate-500 transition-transform ${terbuka ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {terbuka && (
                  <div className="pb-2">
                    {b.onMarkAllRead && b.items.length > 0 && (
                      <button type="button" onClick={b.onMarkAllRead}
                        className="mx-4 mb-1 text-[12px] font-bold hover:underline" style={{ color: b.color }}>
                        Tandai semua dibaca
                      </button>
                    )}
                    {b.items.length === 0 ? (
                      <p className="px-4 pb-2 text-xs text-slate-500">Tidak ada notifikasi {b.label.toLowerCase()}.</p>
                    ) : b.items.map(item => (
                      <button key={item.id} type="button" onClick={() => { onItemClick(item); onTutup(); }}
                        className="w-full text-left pl-[60px] pr-4 py-2.5 flex items-start gap-3 hover:bg-slate-50">
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-slate-800 truncate leading-tight">{item.title}</span>
                          <span className="block text-[12px] text-slate-500 truncate mt-0.5">{item.subtitle}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 flex-shrink-0 mt-0.5">{waktu(item.time)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </ModalPortal>
  );
}
