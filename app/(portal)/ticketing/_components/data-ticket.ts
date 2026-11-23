import { supabase, supabaseServices } from "@/lib/supabase";
import { isPimpinan } from "@/lib/pimpinan";
import { hasFullAccess } from "@/lib/constants";
import { kutipNilai, cobaIdentitas } from "@/lib/identitas";
import { ambilBawahan, type OrangBawahan } from "@/lib/atasan";
import { KOLOM_LOG_RINGKAS, type User, type ActivityLog, type Ticket } from "./shared";

const sebagaiTicket = (baris: unknown): Ticket[] => (baris ?? []) as Ticket[];

export interface RentangTiket { dari: string; sebelum: string }

async function ambilTiketTim(tim: OrangBawahan[], rentang: RentangTiket): Promise<Ticket[]> {
  if (!tim.length) return [];
  const ids = tim.map(b => b.id).join(",");
  const klausa = [`internal_sales_id.in.(${ids})`, `internal_sales_id_2.in.(${ids})`, `sales_user_id.in.(${ids})`,
    ...tim.map(b => (b.username ? `created_by.eq.${kutipNilai(b.username)}` : "")),
    ...tim.map(b => (b.full_name ? `sales_name.eq.${kutipNilai(b.full_name)}` : ""))].filter(Boolean).join(",");
  const { data } = await supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`).or(klausa)
    .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum).order("created_at", { ascending: false });
  return sebagaiTicket(data);
}

export async function ambilTiketUntuk(
  activeUser: User | null | undefined,
  rentang: RentangTiket,
): Promise<{ tickets: Ticket[]; periksaPilihan: boolean }> {
  if (activeUser?.role === "guest" && !isPimpinan(activeUser)) {
    const { data: freshUser } = await supabase
      .from("users")
      .select("id, username, full_name, jabatan, sales_division, role")
      .eq("id", activeUser.id)
      .maybeSingle();
    const resolvedUser = { ...activeUser, ...(freshUser ?? {}) };
    const selfUsername = resolvedUser.username;
    const selfDiv = resolvedUser.sales_division;
    const selfFullName = (freshUser?.full_name || (resolvedUser).full_name) as string | undefined;
    const selfFirstName = selfFullName?.split(' ')[0];

    const klausaNama = [
      `created_by.eq.${kutipNilai(selfUsername)}`,
      selfFullName ? `sales_name.eq.${kutipNilai(selfFullName)}` : null,
      (selfFirstName && selfFirstName !== selfFullName)
        ? `sales_name.eq.${kutipNilai(selfFirstName)}` : null,
      `sales_name.eq.${kutipNilai(selfUsername)}`,
    ].filter(Boolean) as string[];

    const klausaMilik = [`sales_user_id.eq.${resolvedUser.id}`, ...klausaNama].join(",");
    const klausaMilikTanpaUuid = klausaNama.join(",");

    const ownBase: Ticket[] = [];
    const addOwn = (t: Ticket) => { if (!ownBase.find(x => x.id === t.id)) ownBase.push(t); };
    const isIVP = selfDiv === "IVP" || selfDiv === "MVI";
    const [{ data: milikSaya }, pemetaanA, pemetaanB] = await Promise.all([
      cobaIdentitas(async pakaiUuid => await supabase.from("tickets")
        .select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
        .or(pakaiUuid ? klausaMilik : klausaMilikTanpaUuid)
        .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
        .order("created_at", { ascending: false })),
      isIVP
        ? supabase.from("division_ivp_mappings").select("sales_division, brand_type").eq("ivp_id", resolvedUser.id)
        : Promise.resolve({ data: null }),
      isIVP
        ? supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
          .or(`internal_sales_id.eq.${resolvedUser.id},internal_sales_id_2.eq.${resolvedUser.id}`).gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
          .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
    ]);
    const tim = await ambilBawahan(supabase, resolvedUser);
    sebagaiTicket(milikSaya).forEach(addOwn);

    if (isIVP) {
      const ivpDivMaps = pemetaanA.data;
      const myBrandMaps = (ivpDivMaps ?? []) as { sales_division: string; brand_type: string | null }[];
      const handledDivisions = Array.from(new Set(myBrandMaps.map(m => m.sales_division)));
      const ivpTickets: Ticket[] = [...ownBase];
      const addIVP = (t: Ticket) => { if (!ivpTickets.find(x => x.id === t.id)) ivpTickets.push(t); };
      if (handledDivisions.length > 0) {
        const { data: divTickets } = await supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`).in("sales_division", handledDivisions).gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
        sebagaiTicket(divTickets).forEach((t: Ticket) => {
          const tBrand = (t.brand ?? null) as string | null;
          const myBrands = myBrandMaps.filter(m => m.sales_division === t.sales_division).map(m => m.brand_type);
          const match = !tBrand || tBrand === "BOTH" || myBrands.includes(tBrand) || myBrands.includes(null);
          if (match) addIVP(t);
        });
      }
      const byInternalId = pemetaanB.data as Ticket[] | null;
      (byInternalId ?? []).forEach(addIVP);
      (await ambilTiketTim(tim, rentang)).forEach(addIVP);
      ivpTickets.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      return { tickets: ivpTickets, periksaPilihan: true };
    } else {
      const finalTickets: Ticket[] = [...ownBase];
      const addUnique = (t: Ticket) => { if (!finalTickets.find(x => x.id === t.id)) finalTickets.push(t); };

      (await ambilTiketTim(tim, rentang)).forEach(addUnique);

      finalTickets.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      return { tickets: finalTickets, periksaPilihan: true };
    }
  } else {
    const { data: ticketsData } = await supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`).gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
    const mergedTickets = await gabungLogServices(saringTimBiasa(activeUser, sebagaiTicket(ticketsData)));
    return { tickets: mergedTickets, periksaPilihan: false };
  }
}

function saringTimBiasa(activeUser: User | null | undefined, tickets: Ticket[]): Ticket[] {
  const roleLc2 = (activeUser?.role ?? "").toLowerCase();
  const isAdminUser2 = roleLc2 === "admin" || roleLc2 === "superadmin";
  const isManagerUser2 = hasFullAccess(activeUser);
  if (isAdminUser2 || isManagerUser2) return tickets;
  return tickets.filter((t) =>
    t.status !== "Waiting Approval" &&
    !(t.routing_status === "supervisor_assign" && t.assigned_supervisor_id !== activeUser?.id)
  );
}

async function gabungLogServices(tickets: Ticket[]): Promise<Ticket[]> {
  try {
    const idTampil = tickets.map((t: Ticket) => t.id).filter(Boolean);
    const svcLogs: ActivityLog[] = [];
    const potongan: number[] = [];
    for (let i = 0; i < idTampil.length; i += 100) potongan.push(i);
    const hasil = await Promise.all(potongan.map(i => supabaseServices.from("activity_logs")
        .select(KOLOM_LOG_RINGKAS)
        .in("ticket_id", idTampil.slice(i, i + 100))
        .order("created_at", { ascending: false })));
    for (const { data } of hasil) if (data) svcLogs.push(...(data as ActivityLog[]));
    if (svcLogs.length === 0) return tickets;
    return tickets.map((ticket: Ticket) => {
      const svcTicketLogs = svcLogs.filter((l: ActivityLog) => l.ticket_id === ticket.id);
      if (svcTicketLogs.length === 0) return ticket;
      const existingLogs = ticket.activity_logs || [];
      const allLogs = [...existingLogs, ...svcTicketLogs].reduce((acc: ActivityLog[], log: ActivityLog) => {
        if (!acc.find((l) => l.id === log.id)) acc.push(log);
        return acc;
      }, []);
      allLogs.sort((a: ActivityLog, b: ActivityLog) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return { ...ticket, activity_logs: allLogs };
    });
  } catch { return tickets; }
}

export async function ambilTiketTertentu(activeUser: User | null | undefined, ids: string[]): Promise<Ticket[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`).in("id", ids);
  if (error) throw error;
  const hasil: Ticket[] = sebagaiTicket(data);
  if (activeUser?.role === "guest" && !isPimpinan(activeUser)) return hasil;
  return gabungLogServices(saringTimBiasa(activeUser, hasil));
}
