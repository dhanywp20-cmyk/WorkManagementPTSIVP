'use client';

/** useEfekLiveTicketing - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
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
    /*
      Event realtime TIDAK lagi memuat ulang seluruh daftar satu per satu.

      Satu perubahan ticket biasanya = 2-4 event (baris tickets + baris activity_logs, di dua basis),
      dan dulu tiap event menarik SEMUA ticket beserta lognya di setiap tab yang terbuka - query itu
      jalan >127 ribu kali. Sekarang event dikumpulkan JEDA_GABUNG_REALTIME_MS, lalu:
        - perubahan / hapus pada ticket yang sudah ada di daftar -> muat ulang ticket itu saja;
        - ticket baru, event tanpa id, terlalu banyak sekaligus, atau galat -> satu muat ulang penuh.
    */
    const antre = { ids: new Set<string>(), penuh: false, timer: null as ReturnType<typeof setTimeout> | null };
    const proses = async () => {
      const ids = Array.from(antre.ids);
      const penuh = antre.penuh || ids.length > MAKS_SEGAR_SEBAGIAN || ids.some(id => !ticketsRef.current.some(t => t.id === id));
      antre.ids.clear(); antre.penuh = false; antre.timer = null;
      if (penuh) { fetchData(currentUser, true); return; } // silent: tidak trigger loading spinner
      try {
        const segar = new Map((await ambilTiketTertentu(currentUser, ids)).map(t => [t.id, t] as const));
        setTickets(prev => prev.flatMap(t => (!ids.includes(t.id) ? [t] : segar.has(t.id) ? [segar.get(t.id)!] : [])));
        //  Ticket yang sedang dibuka ikut disegarkan, tapi log lengkapnya (muatLogPenuh) dipertahankan.
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
    // PTS DB realtime
    const ptsCh = supabase.channel("pts-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, dariTicket)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, dariLog)
      .subscribe();
    // Services DB realtime (untuk update services_status dari platform Services). Baris tickets
    // Services bukan baris daftar ini - perubahannya selalu lewat muat ulang penuh (tetap digabung).
    const svcCh = supabaseServices.channel("svc-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => jadwalkan(null))
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, dariLog)
      .subscribe();
    /*
      Polling cadangan - JARING PENGAMAN kalau realtime di atas meleset, bukan
      sumber data utama.

      Dulu 30 detik dan berjalan terus tanpa syarat. Biayanya nyata: sekali
      tarik ~150 KB (seluruh tiket beserta ringkasan lognya), dua kali semenit,
      per tab yang terbuka - sekitar 4,8 GB sebulan untuk SATU orang yang
      meninggalkan halaman ini terbuka sepanjang jam kerja. Kuota egress
      Supabase Free-nya 5 GB. Satu tab yang menganggur nyaris menghabiskan
      jatah sebulan tanpa ada yang mengerjakan apa pun.

      Dua perubahan:

      1. BERHENTI saat tab tidak terlihat. Halaman yang ditinggal di belakang
         tidak punya siapa pun yang membaca hasilnya. Saat tab kembali dilihat
         kita menarik SEKALI supaya layarnya langsung segar - tanpa itu
         penghematannya dibayar dengan data basi, dan orang akan menekan
         refresh sendiri (yang jauh lebih mahal).
      2. 30 detik -> 2 menit. Realtime yang menangani perubahan langsung;
         jaring pengaman tidak perlu ditebar dua kali semenit.
    */
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
      fetchData(currentUser, true);   // segarkan sekali begitu kembali dilihat
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

  // SLA Auto-Escalation
  // Runs whenever tickets or overdueSettings change.
  // Finds tickets that exceed their SLA deadline and automatically marks them
  // as 'Overdue' in the DB so the Command Center and all clients see it in real-time.
  // Admin-only: only admins/superadmins trigger the escalation to avoid race conditions.
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
