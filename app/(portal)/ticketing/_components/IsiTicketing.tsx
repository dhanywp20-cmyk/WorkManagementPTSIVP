'use client';

import { StatsSection } from './StatsSection';
import { FilterBar } from './FilterBar';
import { TicketListBody } from './TicketListBody';
import { useKonteksTicket } from './konteks-ticket';

export function IsiTicketing() {
  const k = useKonteksTicket();
  const { ticketListRef } = k.data;
  return (
    <>
      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">

        <StatsSection />

        <div ref={ticketListRef} className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(200,200,200,0.6)", backdropFilter: "blur(12px)" }}>
          <FilterBar />

          <TicketListBody />
        </div>
      </div>
    </>
  );
}
