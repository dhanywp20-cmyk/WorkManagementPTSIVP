import { supabase, supabaseServices } from "@/lib/supabase";
import { isPimpinan } from "@/lib/pimpinan";
import { hasFullAccess } from "@/lib/constants";
import { kutipNilai, cobaIdentitas } from "@/lib/identitas";
import { JABATAN_TIER, KOLOM_LOG_RINGKAS, type User, type ActivityLog, type Ticket } from "./shared";

const sebagaiTicket = (baris: unknown): Ticket[] => (baris ?? []) as Ticket[];

export interface RentangTiket { dari: string; sebelum: string }

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
    const selfJabatan = (resolvedUser as any).jabatan as string | undefined;
    const selfTier = selfJabatan ? (JABATAN_TIER[selfJabatan] ?? 0) : 0;
    const selfUsername = resolvedUser.username;
    const selfDiv = resolvedUser.sales_division;
    const selfFullName = (freshUser?.full_name || (resolvedUser as any).full_name) as string | undefined;
    const selfFirstName = selfFullName?.split(' ')[0];
    const isMyTicket = (t: Ticket) =>
      t.created_by === selfUsername ||
      (selfFullName && t.sales_name === selfFullName) ||
      (selfFirstName && t.sales_name === selfFirstName) ||
      t.sales_name === selfUsername;

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
        : supabase.from("division_supervisor_mappings").select("sales_division").eq("supervisor_id", resolvedUser.id),
      isIVP
        ? supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
          .or(`internal_sales_id.eq.${resolvedUser.id},internal_sales_id_2.eq.${resolvedUser.id}`).gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
          .order("created_at", { ascending: false })
        : supabase.from("user_supervisor_mappings").select("user_id").eq("supervisor_id", resolvedUser.id),
    ]);
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
      ivpTickets.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      return { tickets: ivpTickets, periksaPilihan: true };
    } else {
      const finalTickets: Ticket[] = [...ownBase];
      const addUnique = (t: Ticket) => { if (!finalTickets.find(x => x.id === t.id)) finalTickets.push(t); };

      const supMaps = pemetaanA.data;
      const supervisedDivisions = (supMaps ?? []).map((m) => m.sales_division as string);

      if (selfDiv && selfTier > 1 && !supervisedDivisions.includes(selfDiv)) {
        supervisedDivisions.push(selfDiv);
      }

      const userSupMapsData = pemetaanB.data as { user_id: string }[] | null;
      const manualSubordinateIds = new Set((userSupMapsData ?? []).map((m) => m.user_id as string));

      const isSupervisor = (supervisedDivisions.length > 0 && selfTier > 0) || manualSubordinateIds.size > 0;

      if (isSupervisor) {
        const { data: allGuestUsers } = await supabase.from("users")
          .select("id, username, full_name, jabatan, sales_division")
          .eq("role", "guest");

        const idToTier: Record<string, number> = {};
        const nameTierMap: Record<string, number> = {};
        const nameToId: Record<string, string> = {};
        (allGuestUsers ?? []).forEach((u) => {
          const tier = u.jabatan ? (JABATAN_TIER[u.jabatan as string] ?? 0) : 0;
          idToTier[u.id] = tier;
          if (u.full_name) { nameTierMap[u.full_name] = tier; nameToId[u.full_name] = u.id; }
          if (u.username) { nameTierMap[u.username] = tier; nameToId[u.username] = u.id; }
          if (u.full_name) {
            const firstName = u.full_name.split(' ')[0];
            if (!nameTierMap[firstName]) { nameTierMap[firstName] = tier; nameToId[firstName] = u.id; }
          }
        });

        const subordinateIds = new Set(
          (allGuestUsers ?? []).filter((u) => {
            if (idToTier[u.id] >= selfTier) return false;
            const inSupervisedDiv = supervisedDivisions.length > 0 && u.sales_division && supervisedDivisions.includes(u.sales_division);
            const inManualMap = manualSubordinateIds.has(u.id);
            return inSupervisedDiv || inManualMap;
          }).map((u) => u.id as string)
        );
        const subordinateUsernames = new Set(
          (allGuestUsers ?? []).filter((u) => subordinateIds.has(u.id)).map((u) => u.username as string)
        );

        const manualUsernames = manualSubordinateIds.size > 0
          ? (allGuestUsers ?? []).filter((u) => manualSubordinateIds.has(u.id)).map((u) => u.username).filter(Boolean)
          : [];
        const subordinateNames = Array.from(new Set(
          (allGuestUsers ?? []).filter((u) => subordinateIds.has(u.id) || manualSubordinateIds.has(u.id))
            .flatMap((u) => [u.full_name, u.username, u.full_name ? u.full_name.split(' ')[0] : null].filter(Boolean))
        )) as string[];
        const tiketDari = (q: (b: any) => any) => q(supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`))
          .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
          .order("created_at", { ascending: false });
        const kosong = Promise.resolve({ data: null as Ticket[] | null });
        const [divRes, manualRes, noDivRes] = await Promise.all([
          supervisedDivisions.length > 0 ? tiketDari(b => b.in("sales_division", supervisedDivisions)) : kosong,
          manualUsernames.length > 0 ? tiketDari(b => b.in("created_by", manualUsernames)) : kosong,
          subordinateNames.length > 0
            ? Promise.resolve(tiketDari(b => b.in("sales_name", subordinateNames).is("sales_division", null))).catch(() => ({ data: null }))
            : kosong,
        ]);
        const allDivTickets: Ticket[] = (divRes.data as Ticket[] | null) ?? [];
        for (const t of [...((manualRes.data as Ticket[] | null) ?? []), ...((noDivRes.data as Ticket[] | null) ?? [])]) {
          if (!allDivTickets.find(x => x.id === t.id)) allDivTickets.push(t);
        }

        allDivTickets.forEach((t: Ticket) => {
          if (isMyTicket(t)) { addUnique(t); return; }

          if (t.created_by && subordinateUsernames.has(t.created_by)) { addUnique(t); return; }

          const ownerId = t.sales_name ? nameToId[t.sales_name] : null;
          if (ownerId && manualSubordinateIds.has(ownerId)) { addUnique(t); return; }

          if (t.sales_name) {
            const salesUserId = nameToId[t.sales_name];
            if (salesUserId && subordinateIds.has(salesUserId)) { addUnique(t); return; }
          }
        });

      } else {
        if (selfDiv) {
          const { data: divTickets } = await supabase.from("tickets")
            .select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
            .eq("sales_division", selfDiv)
            .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
          sebagaiTicket(divTickets).forEach((t: Ticket) => {
            if (isMyTicket(t)) addUnique(t);
          });
        }
      }

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
