'use client';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import { StatCard } from '@/components/shared';
import {
  StatusDonutCard, SalesDivisionDonutCard, HandlerDonutCard, ProductDonutCard,
} from './DonutCards';
import type { Ticket, User } from './shared';

type TicketStats = {
  total: number; pending: number; processing: number; solved: number; overdue: number; solvedOverdue: number;
  statusData: { name: string; value: number; color: string }[];
  handlerData: { name: string; tickets: number; team: string }[];
};
type SebaranStats = { data: { name: string; value: number; color: string }[]; total: number };

/**
 * Kartu ringkasan + donut chart (Ticketing) - dipindah dari
 * app/ticketing/page.tsx apa adanya (JSX identik, dua varian: guest &
 * admin/team). State & handler tetap di page.tsx, komponen ini murni
 * presentasional.
 */
export function StatsSection({
  currentUser, currentUserTeamType, stats, tickets,
  filterStatus, setFilterStatus, handlerFilter, setHandlerFilter,
  ticketListRef, selectedHandlerTeam, setSelectedHandlerTeam,
  salesDivisionStats, salesDivisionFilter, setSalesDivisionFilter,
  productStats, productFilter, setProductFilter,
}: {
  currentUser: User | null;
  currentUserTeamType: string;
  stats: TicketStats;
  tickets: Ticket[];
  filterStatus: string;
  setFilterStatus: Dispatch<SetStateAction<string>>;
  handlerFilter: string | null;
  setHandlerFilter: Dispatch<SetStateAction<string | null>>;
  ticketListRef: RefObject<HTMLDivElement | null>;
  selectedHandlerTeam: "PTS" | "Services";
  setSelectedHandlerTeam: Dispatch<SetStateAction<"PTS" | "Services">>;
  salesDivisionStats: SebaranStats;
  salesDivisionFilter: string | null;
  setSalesDivisionFilter: Dispatch<SetStateAction<string | null>>;
  productStats: SebaranStats;
  productFilter: string | null;
  setProductFilter: Dispatch<SetStateAction<string | null>>;
}) {
  return (
    <>
      {/* ── GUEST SUMMARY SECTION (same style as admin) ── */}
      {currentUser?.role === "guest" && (
        <div className="mb-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-slide-up anim-d80">
            {[
              { label: "Total Tickets", value: stats.total, sub: "Seluruh tiket saya", accent: "#4f46e5" },
              { label: "Waiting Approval", value: tickets.filter((t) => t.status === "Waiting Approval").length, sub: "Menunggu persetujuan", accent: "#c2410c" },
              { label: "Pending", value: stats.pending, sub: "Menunggu tindakan", accent: "#b45309" },
              { label: "In Progress", value: stats.processing, sub: "Sedang ditangani", accent: "#1d4ed8" },
              { label: "Solved", value: stats.solved, sub: "Terselesaikan", accent: "#047857" },
            ].map((card, i) => <StatCard key={i} {...card} />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-zoom-in anim-d160">
            <StatusDonutCard
              data={[
                { name: "Waiting Approval", value: tickets.filter((t) => t.status === "Waiting Approval").length, color: "#FB923C" },
                ...stats.statusData,
              ].filter((d) => d.value > 0)}
              total={stats.total}
              onSliceClick={() => {}}
              title="Status Distribution"
              icon="🥧"
            />
            <HandlerDonutCard
              data={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).map((h: any, i: number) => ({ name: h.name, value: h.tickets, color: ["#7c3aed","#0ea5e9","#10b981","#e11d48","#f59e0b","#6366f1"][i%6] }))}
              total={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).reduce((s:number,h:any) => s+h.tickets, 0)}
              teamToggle={selectedHandlerTeam}
              onToggle={(t: "PTS" | "Services") => setSelectedHandlerTeam(t)}
              onSliceClick={() => {}}
              activeHandler={null}
              title="Team Handlers"
              icon="👥"
            />
            <SalesDivisionDonutCard
              data={salesDivisionStats.data}
              total={salesDivisionStats.total}
              onSliceClick={() => {}}
              activeDivision={null}
            />
            <ProductDonutCard
              data={productStats.data}
              total={productStats.total}
              onSliceClick={() => {}}
              activeProduct={null}
            />
          </div>
        </div>
      )}

      {(currentUser?.role === "admin" || currentUser?.role === "superadmin" || (currentUser?.role === "team" && currentUserTeamType === "Team PTS IVP" || currentUserTeamType === "Guest")) && (
        <div className="mb-4 space-y-4">
          {/* ── Stat Cards (Redesigned like ReminderSchedule) ── */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 animate-slide-up anim-d80">
            {[
              { label: "Total Tickets", value: stats.total, sub: "Seluruh tiket", accent: "#4f46e5", onClick: () => { setFilterStatus("All"); setHandlerFilter(null); }, active: filterStatus === "All" && !handlerFilter },
              { label: "Pending", value: stats.pending, sub: "Menunggu tindakan", accent: "#b45309", onClick: () => { setFilterStatus(filterStatus === "Pending" ? "All" : "Pending"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Pending" },
              { label: "In Progress", value: stats.processing, sub: "Sedang ditangani", accent: "#1d4ed8", onClick: () => { setFilterStatus(filterStatus === "In Progress" ? "All" : "In Progress"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "In Progress" },
              { label: "Solved", value: stats.solved, sub: "Terselesaikan", accent: "#047857", onClick: () => { setFilterStatus(filterStatus === "Solved" ? "All" : "Solved"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Solved" },
              { label: "Overdue", value: stats.overdue, sub: "Berpotensi denda", accent: "#b91c1c", onClick: () => { setFilterStatus(filterStatus === "Overdue" ? "All" : "Overdue"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Overdue" },
              { label: "Solved Overdue", value: stats.solvedOverdue, sub: "Butuh verifikasi", accent: "#6d28d9", onClick: () => { setFilterStatus(filterStatus === "Solved Overdue" ? "All" : "Solved Overdue"); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }, active: filterStatus === "Solved Overdue" },
            ].map((card, i) => <StatCard key={i} {...card} />)}
          </div>

          {/* ── Donut Charts ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-zoom-in anim-d160">
            <StatusDonutCard data={stats.statusData} total={stats.statusData.reduce((s, d) => s + d.value, 0)} onSliceClick={(name: string) => { const mapped = name === "Solved (Overdue)" ? "Solved Overdue" : name; setFilterStatus((prev) => prev === mapped ? "All" : mapped); setHandlerFilter(null); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} title="Status Distribution" icon="🥧" />
            <HandlerDonutCard data={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).map((h: any, i: number) => ({ name: h.name, value: h.tickets, color: ["#7c3aed", "#0ea5e9", "#10b981", "#e11d48", "#f59e0b", "#6366f1", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"][i % 12] }))} total={stats.handlerData.filter((h: any) => h.team.startsWith(`Team ${selectedHandlerTeam}`)).reduce((s, h) => s + h.tickets, 0)} teamToggle={selectedHandlerTeam} onToggle={(t: "PTS" | "Services") => setSelectedHandlerTeam(t)} onSliceClick={(name: string) => { setHandlerFilter((prev: string | null) => prev === name ? null : name); setFilterStatus("All"); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} activeHandler={handlerFilter} title="Team Handlers" icon="👥" />
            <SalesDivisionDonutCard data={salesDivisionStats.data} total={salesDivisionStats.total} onSliceClick={(division: string) => { setSalesDivisionFilter((prev: string | null) => prev === division ? null : division); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} activeDivision={salesDivisionFilter} />
            <ProductDonutCard data={productStats.data} total={productStats.total} onSliceClick={(prod: string) => { setProductFilter((prev) => prev === prod ? null : prod); ticketListRef.current?.scrollIntoView({ behavior: "smooth" }); }} activeProduct={productFilter} />
          </div>
        </div>
      )}
    </>
  );
}
