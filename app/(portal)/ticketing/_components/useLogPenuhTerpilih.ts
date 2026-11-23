'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Ticket } from './shared';
import { ambilLogPenuh, gabungLogTerpilih } from './data-ticket';

export function useLogPenuhTerpilih(idTerpilih: string | null, setSelectedTicket: Dispatch<SetStateAction<Ticket | null>>) {
  useEffect(() => {
    if (!idTerpilih) return;
    let batal = false;
    ambilLogPenuh(idTerpilih)
      .then(penuh => {
        if (batal) return;
        setSelectedTicket(prev => (prev && prev.id === idTerpilih
          ? { ...prev, activity_logs: gabungLogTerpilih(prev.activity_logs, prev.activity_logs, penuh) }
          : prev));
      })
      .catch(() => {});
    return () => { batal = true; };
  }, [idTerpilih, setSelectedTicket]);
}
