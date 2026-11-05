'use client';

import { useEffect } from 'react';
import { User, Ticket, OverdueSetting, JEDA_POLLING_MS, JEDA_GABUNG_REALTIME_MS, MAKS_SEGAR_SEBAGIAN } from './shared';
import { ambilTiketTertentu } from './data-ticket';
import { supabase, supabaseServices } from '@/lib/supabase';

export interface EfekLiveTicketingKonteks {
  currentUser: User | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  isTicketOverdue: (ticket: Ticket) => boolean;
  overdueSettings: OverdueSetting[];
  setSelectedTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setTickets: import("react").Dispatch<import("react").SetStateAction<Ticket[]>>;
  tickets: Ticket[];
  ticketsRef: import("react").RefObject<Ticket[]>;
}

export function useEfekLiveTicketing(k: EfekLiveTicketingKonteks) {
  const { currentUser, fetchData, isTicketOverdue, overdueSettings, setSelectedTicket, setTickets, tickets, ticketsRef } = k;
  useEffect(() => {
    if (!currentUser) return;
    const antre = { ids: new Set<string>(), penuh: false, timer: null as ReturnType<typeof setTimeout> | null };
    const proses = async () => {
      const ids = Array.from(antre.ids);
      const penuh = antre.penuh || ids.length > MAKS_SEGAR_SEBAGIAN || ids.some(id => !ticketsRef.current.some(t => t.id === id));
      antre.ids.clear(); antre.penuh = false; antre.timer = null;
      if (penuh) { fetchData(currentUser, true); return; }
      try {
        const segar = new Map((await ambilTiketTertentu(currentUser, ids)).map(t => [t.id, t] as const));
        setTickets(prev => prev.flatMap(t => (!ids.includes(t.id) ? [t] : segar.has(t.id) ? [segar.get(t.id)!] : [])));
        setSelectedTicket(prev => {
          if (!prev || !ids.includes(prev.id)) return prev;
          const baru = segar.get(prev.id);
          return baru ? { ...baru, activity_logs: (prev.activity_logs?.length ?? 0) > (baru.activity_logs?.length ?? 0) ? prev.activity_logs : baru.activity_logs } : prev;
        });
      } catch { fetchData(currentUser, true); }
    };
    const jadwalkan = (id: unknown) => {
      if (typeof id === "string" && id) antre.ids.add(id); else antre.penuh = true;
      if (!antre.timer) antre.timer = setTimeout(() => void proses(), JEDA_GABUNG_REALTIME_MS);
    };
    type Muatan = { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> };
    const dariTicket = (p: Muatan) => jadwalkan(p.eventType === "INSERT" ? null : (p.new?.id ?? p.old?.id));
    const dariLog = (p: Muatan) => jadwalkan(p.new?.ticket_id ?? p.old?.ticket_id);
    const ptsCh = supabase.channel("pts-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, dariTicket)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, dariLog)
      .subscribe();
    const svcCh = supabaseServices.channel("svc-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => jadwalkan(null))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, dariLog)
      .subscribe();
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const mulaiPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => fetchData(currentUser, true), JEDA_POLLING_MS);
    };
    const hentikanPolling = () => {
      if (!pollInterval) return;
      clearInterval(pollInterval);
      pollInterval = null;
    };
    const saatVisibilitasBerubah = () => {
      if (document.visibilityState === 'hidden') { hentikanPolling(); return; }
      fetchData(currentUser, true);
      mulaiPolling();
    };
    if (document.visibilityState !== 'hidden') mulaiPolling();
    document.addEventListener('visibilitychange', saatVisibilitasBerubah);

    return () => {
      if (antre.timer) clearTimeout(antre.timer);
      supabase.removeChannel(ptsCh);
      supabaseServices.removeChannel(svcCh);
      document.removeEventListener('visibilitychange', saatVisibilitasBerubah);
      hentikanPolling();
    };
  }, [currentUser]);

  useEffect(() => {
    const isAdminUser = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
    if (!isAdminUser || !tickets.length) return;
    const toEscalate = tickets.filter(t =>
      isTicketOverdue(t)
      && t.status !== 'Solved'
      && t.status !== 'Overdue'
      && t.status !== 'Waiting Approval'
    );
    if (!toEscalate.length) return;
    const ids = toEscalate.map(t => t.id);
    Promise.resolve(supabase.from('tickets').update({ status: 'Overdue' }).in('id', ids))
      .then(() => { if (currentUser) fetchData(currentUser, true); })
      .catch((e: unknown) => console.warn('[SLA] auto-escalation error:', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, overdueSettings]);
  return {  };
}
