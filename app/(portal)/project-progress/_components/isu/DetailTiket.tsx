'use client';

import { useEffect, useMemo } from 'react';
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { KepalaDetailTicket } from '@/app/(portal)/ticketing/_components/TicketDetailPopup';
import { IsiDetailTicket } from '@/app/(portal)/ticketing/_components/IsiDetailTicket';
import { cetakTicket } from '@/app/(portal)/ticketing/_components/cetak-ticket';
import type { TiketIsu } from '@/lib/isu/inti';
import { keTicket } from './tiket-isu';

const tanpaAksi = () => {};
const tanpaData = () => null;

export function ModalDetailTiket({ tiket, urlTiket, onTutup }: { tiket: TiketIsu; urlTiket?: (id: string) => string; onTutup: () => void }) {
  const ticket = useMemo(() => keTicket(tiket), [tiket]);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    document.addEventListener('keydown', tekan);
    return () => document.removeEventListener('keydown', tekan);
  }, [onTutup]);

  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-1000 p-3"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) onTutup(); }}>
        <div className="bg-white rounded-kartu shadow-modal overflow-hidden w-full flex flex-col my-2" style={{ maxWidth: 720, maxHeight: '94vh' }}>
          <KepalaDetailTicket ticket={ticket} onTutup={onTutup} />
          <IsiDetailTicket selectedTicket={ticket} currentUser={null} setSupAssignTicket={tanpaAksi} setSupAssignTo={tanpaAksi}
            canManageTickets={false} bukaAdminEdit={tanpaAksi} getDeadline={tanpaData} users={[]} getWarrantyInfo={tanpaData} tanpaSolusiSerupa />
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2 bg-gray-50/50 shrink-0">
            <button type="button" onClick={() => void cetakTicket(ticket, { tanpaSales: true })} className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold">
              <IkonTeks nama="📄" />PDF
            </button>
            {urlTiket && (
              <a href={urlTiket(ticket.id)} className="tombol-kedua flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold">
                <IkonTeks nama="🎫" />Buka di Troubleshooting
              </a>
            )}
            <button type="button" onClick={onTutup} className="tombol-kedua ml-auto flex items-center gap-1.5 px-3 py-2 rounded-kontrol text-xs font-bold">Tutup</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
