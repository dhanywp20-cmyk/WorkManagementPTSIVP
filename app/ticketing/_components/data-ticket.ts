/**
 * Lapisan data Ticketing (dipisah dari page.tsx): aturan SIAPA MELIHAT TICKET APA.
 *
 *   - Pimpinan & akun internal: semua ticket dalam rentang (anggota tim biasa tidak melihat
 *     yang masih Waiting Approval / di-route ke Supervisor lain).
 *   - Guest: ticket milik sendiri lewat semua jalur kepemilikan; Sales Internal IVP/MVI:
 *     ticket divisi yang dihandle (sesuai brand); atasan: ticket bawahan di divisi yang
 *     disupervisi (tier lebih rendah) atau yang di-CC manual.
 *
 * Isi dipindahkan APA ADANYA dari TicketingSystemInner.fetchData; yang berubah hanya titik
 * keluarnya: dulu memanggil setTickets/setSelectedTicket, kini mengembalikan hasilnya.
 */
import { supabase, supabaseServices } from "@/lib/supabase";
import { isPimpinan } from "@/lib/pimpinan";
import { hasFullAccess } from "@/lib/constants";
import { kutipNilai, cobaIdentitas } from "@/lib/identitas";
import { JABATAN_TIER, KOLOM_LOG_RINGKAS, type User, type ActivityLog, type Ticket } from "./shared";

export interface RentangTiket { dari: string; sebelum: string }

/** `periksaPilihan`: caller perlu memastikan ticket yang sedang dibuka masih ada di daftar (cabang guest). */
export async function ambilTiketUntuk(
  activeUser: User | null | undefined,
  rentang: RentangTiket,
): Promise<{ tickets: Ticket[]; periksaPilihan: boolean }> {
  //  Pimpinan (lib/pimpinan.ts) melihat SEMUA tiket - tidak masuk cabang "guest dibatasi".
  if (activeUser?.role === "guest" && !isPimpinan(activeUser)) {
    // Fetch fresh user dari DB termasuk jabatan & full_name
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
    // selfFullName bisa berupa full name ("Handono Sugianto") atau nama singkat ("Handono")
    // DB ticket sales_name sering menyimpan nama pertama atau username - cek keduanya
    const selfFullName = (freshUser?.full_name || (resolvedUser as any).full_name) as string | undefined;
    const selfFirstName = selfFullName?.split(' ')[0]; // nama pertama saja
    // Helper: apakah ticket ini "milik" user ini
    const isMyTicket = (t: Ticket) =>
      t.created_by === selfUsername ||
      (selfFullName && t.sales_name === selfFullName) ||
      (selfFirstName && t.sales_name === selfFirstName) ||
      t.sales_name === selfUsername;

    // Semua ticket milik sendiri, lewat SEMUA jalur kepemilikan sekaligus.
    //
    // Jalur pertama sales_user_id adalah yang benar: ia menunjuk orangnya,
    // bukan tulisan namanya. Empat jalur berikutnya mencocokkan teks, dan
    // sengaja DIPERTAHANKAN karena baris lama banyak yang uuid-nya masih
    // kosong - sql/identitas-uuid.sql menolak menebak nama yang ambigu.
    //
    // Kelimanya digabung jadi satu .or() alih-alih lima query berurutan:
    // hasilnya sama persis, tapi satu perjalanan ke basis data, bukan lima.
    //
    // Jalur nama dan jalur uuid disimpan TERPISAH lalu digabung, bukan
    // digabung lalu dipisah lagi. Memisah ulang dengan split(",") akan
    // mencacah nama yang memuat koma - "Rio, Putra" jadi dua potongan
    // sintaks rusak, dan seluruh filternya ditolak.
    const klausaNama = [
      `created_by.eq.${kutipNilai(selfUsername)}`,
      selfFullName ? `sales_name.eq.${kutipNilai(selfFullName)}` : null,
      (selfFirstName && selfFirstName !== selfFullName)
        ? `sales_name.eq.${kutipNilai(selfFirstName)}` : null,
      `sales_name.eq.${kutipNilai(selfUsername)}`,
    ].filter(Boolean) as string[];

    // Jalur uuid dilepas kalau basis datanya belum punya kolomnya - lihat
    // catatan di lib/identitas.ts. Tanpa itu, satu deploy yang mendahului
    // SQL-nya akan membuat list ticket Sales kosong sama sekali.
    const klausaMilik = [`sales_user_id.eq.${resolvedUser.id}`, ...klausaNama].join(",");
    const klausaMilikTanpaUuid = klausaNama.join(",");

    const ownBase: Ticket[] = [];
    const addOwn = (t: Ticket) => { if (!ownBase.find(x => x.id === t.id)) ownBase.push(t); };
    const { data: milikSaya } = await cobaIdentitas(async pakaiUuid => await supabase.from("tickets")
      .select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
      .or(pakaiUuid ? klausaMilik : klausaMilikTanpaUuid)
      .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false }));
    (milikSaya ?? []).forEach(addOwn);

    // Sales Internal (IVP/MVI): lihat ticket dari semua divisi yang dia handle
    // (division_ivp_mappings) - ini yang mewujudkan "CC ke list ticket" utk
    // Troubleshooting (fast-track, tanpa gerbang approval, tapi tetap visible).
    const isIVP = selfDiv === "IVP" || selfDiv === "MVI";
    if (isIVP) {
      // IVP/MVI guest: lihat ticket divisi yg dia handle, TAPI hanya utk BRAND yg dia
      // pegang (division_ivp_mappings.brand_type). Ticket lama tanpa brand / brand BOTH /
      // guest dgn mapping legacy (brand_type null)  tetap tampil (backward compat).
      const { data: ivpDivMaps } = await supabase.from("division_ivp_mappings").select("sales_division, brand_type").eq("ivp_id", resolvedUser.id);
      const myBrandMaps = (ivpDivMaps ?? []) as { sales_division: string; brand_type: string | null }[];
      const handledDivisions = Array.from(new Set(myBrandMaps.map(m => m.sales_division)));
      let ivpTickets: Ticket[] = [...ownBase];
      const addIVP = (t: Ticket) => { if (!ivpTickets.find(x => x.id === t.id)) ivpTickets.push(t); };
      if (handledDivisions.length > 0) {
        const { data: divTickets } = await supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`).in("sales_division", handledDivisions).gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
        (divTickets ?? []).forEach((t: Ticket) => {
          const tBrand = (t.brand ?? null) as string | null;
          const myBrands = myBrandMaps.filter(m => m.sales_division === t.sales_division).map(m => m.brand_type);
          const match = !tBrand || tBrand === "BOTH" || myBrands.includes(tBrand) || myBrands.includes(null);
          if (match) addIVP(t);
        });
      }
      // Ticket yg secara eksplisit di-CC ke guest ini (internal_sales_id / _2) - brand match.
      const { data: byInternalId } = await supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
        .or(`internal_sales_id.eq.${resolvedUser.id},internal_sales_id_2.eq.${resolvedUser.id}`).gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
      (byInternalId ?? []).forEach(addIVP);
      // Sort akhir berdasarkan created_at descending
      ivpTickets.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      return { tickets: ivpTickets, periksaPilihan: true };
    } else {
      // Non-IVP guest: mulai dari semua ticket milik sendiri (sudah di ownBase)
      let finalTickets: Ticket[] = [...ownBase];
      const addUnique = (t: Ticket) => { if (!finalTickets.find(x => x.id === t.id)) finalTickets.push(t); };

      // Cek apakah user terdaftar sebagai supervisor di division_supervisor_mappings
      const { data: supMaps } = await supabase.from("division_supervisor_mappings")
        .select("sales_division").eq("supervisor_id", resolvedUser.id);
      const supervisedDivisions = (supMaps ?? []).map((m: any) => m.sales_division as string);

      // Auto: jika punya jabatan tier > 1, otomatis supervisi divisi sendiri
      if (selfDiv && selfTier > 1 && !supervisedDivisions.includes(selfDiv)) {
        supervisedDivisions.push(selfDiv);
      }

      // Cek user_supervisor_mappings - user yang secara manual di-CC ke user ini
      const { data: userSupMapsData } = await supabase.from("user_supervisor_mappings")
        .select("user_id").eq("supervisor_id", resolvedUser.id);
      const manualSubordinateIds = new Set((userSupMapsData ?? []).map((m: any) => m.user_id as string));

      const isSupervisor = (supervisedDivisions.length > 0 && selfTier > 0) || manualSubordinateIds.size > 0;

      if (isSupervisor) {
        // Ambil SEMUA guest users untuk build tier lookup
        const { data: allGuestUsers } = await supabase.from("users")
          .select("id, username, full_name, jabatan, sales_division")
          .eq("role", "guest");

        const idToTier: Record<string, number> = {};
        const nameTierMap: Record<string, number> = {};
        const nameToId: Record<string, string> = {};
        (allGuestUsers ?? []).forEach((u: any) => {
          const tier = u.jabatan ? (JABATAN_TIER[u.jabatan as string] ?? 0) : 0;
          idToTier[u.id] = tier;
          if (u.full_name) { nameTierMap[u.full_name] = tier; nameToId[u.full_name] = u.id; }
          if (u.username) { nameTierMap[u.username] = tier; nameToId[u.username] = u.id; }
          if (u.full_name) {
            const firstName = u.full_name.split(' ')[0];
            if (!nameTierMap[firstName]) { nameTierMap[firstName] = tier; nameToId[firstName] = u.id; }
          }
        });

        // Semua user id dengan tier < selfTier DAN berada di divisi yang di-supervisi
        // (atau di-mapping manual). Tidak boleh lintas divisi sembarangan.
        const subordinateIds = new Set(
          (allGuestUsers ?? []).filter((u: any) => {
            if (idToTier[u.id] >= selfTier) return false; // tier harus lebih rendah
            // Boleh masuk jika:
            // 1. Divisinya ada di supervisedDivisions (termasuk divisi sendiri jika tier > 1), ATAU
            // 2. Di-mapping manual via user_supervisor_mappings
            const inSupervisedDiv = supervisedDivisions.length > 0 && u.sales_division && supervisedDivisions.includes(u.sales_division);
            const inManualMap = manualSubordinateIds.has(u.id);
            return inSupervisedDiv || inManualMap;
          }).map((u: any) => u.id as string)
        );
        const subordinateUsernames = new Set(
          (allGuestUsers ?? []).filter((u: any) => subordinateIds.has(u.id)).map((u: any) => u.username as string)
        );

        // Ambil ticket dari divisi yang di-supervisi
        let allDivTickets: Ticket[] = [];
        if (supervisedDivisions.length > 0) {
          const { data: dt } = await supabase.from("tickets")
            .select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
            .in("sales_division", supervisedDivisions)
            .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
          if (dt) allDivTickets = dt;
        }

        // Tambah ticket dari manual subordinates (bisa beda divisi)
        if (manualSubordinateIds.size > 0) {
          const manualUsers = (allGuestUsers ?? []).filter((u: any) => manualSubordinateIds.has(u.id));
          const manualUsernames = manualUsers.map((u: any) => u.username).filter(Boolean);
          if (manualUsernames.length > 0) {
            const { data: manualTickets } = await supabase.from("tickets")
              .select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
              .in("created_by", manualUsernames)
              .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
            (manualTickets ?? []).forEach((t: Ticket) => {
              if (!allDivTickets.find(x => x.id === t.id)) allDivTickets.push(t);
            });
          }
        }

        // Fallback: ticket tanpa sales_division tapi sales_name = bawahan (divisi valid)
        // Menangkap ticket yang dibuat admin/superadmin untuk bawahan di divisi yang disupervisi,
        // dimana sales_division tidak diisi, sehingga query .in("sales_division") melewatinya.
        // subordinateNames sudah terfilter hanya bawahan yang divisinya valid (subordinateIds).
        try {
          const allSubordinateUsers = (allGuestUsers ?? []).filter((u: any) =>
            subordinateIds.has(u.id) || manualSubordinateIds.has(u.id)
          );
          const subordinateNames = Array.from(new Set(
            allSubordinateUsers.flatMap((u: any) => [
              u.full_name,
              u.username,
              u.full_name ? u.full_name.split(' ')[0] : null,
            ].filter(Boolean))
          )) as string[];
          if (subordinateNames.length > 0) {
            const { data: noDivTickets } = await supabase.from("tickets")
              .select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
              .in("sales_name", subordinateNames)
              .is("sales_division", null)
              .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
            (noDivTickets ?? []).forEach((t: Ticket) => {
              if (!allDivTickets.find(x => x.id === t.id)) allDivTickets.push(t);
            });
            // TIDAK mengambil ticket dari divisi lain berdasarkan nama bawahan saja.
            // Akses lintas divisi HARUS melalui explicit mapping di
            // division_supervisor_mappings atau user_supervisor_mappings.
          }
        } catch { }

        allDivTickets.forEach((t: Ticket) => {
          // Ticket milik sendiri selalu masuk
          if (isMyTicket(t)) { addUnique(t); return; }

          // Cek via created_by username  apakah bawahan yang valid (divisi + tier)
          if (t.created_by && subordinateUsernames.has(t.created_by)) { addUnique(t); return; }

          // Cek via manual subordinate
          const ownerId = t.sales_name ? nameToId[t.sales_name] : null;
          if (ownerId && manualSubordinateIds.has(ownerId)) { addUnique(t); return; }

          // Cek via sales_name: userId harus ada di subordinateIds
          // (sudah tervalidasi divisi + tier - tidak lolos hanya karena tier saja)
          if (t.sales_name) {
            const salesUserId = nameToId[t.sales_name];
            if (salesUserId && subordinateIds.has(salesUserId)) { addUnique(t); return; }
          }
        });

        
      } else {
        // Guest biasa: HANYA ticket milik sendiri berdasarkan sales_name atau created_by
        if (selfDiv) {
          const { data: divTickets } = await supabase.from("tickets")
            .select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`)
            .eq("sales_division", selfDiv)
            .gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
          (divTickets ?? []).forEach((t: Ticket) => {
            if (isMyTicket(t)) addUnique(t);
          });
        }
      }

      // Sort akhir berdasarkan created_at descending - gabungan ticket sendiri + bawahan
      finalTickets.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      return { tickets: finalTickets, periksaPilihan: true };
    }
  } else {
    const { data: ticketsData } = await supabase.from("tickets").select(`*, activity_logs(${KOLOM_LOG_RINGKAS})`).gte("created_at", rentang.dari).lt("created_at", rentang.sebelum)
      .order("created_at", { ascending: false });
    let mergedTickets: Ticket[] = ticketsData || [];
    // Visibility (catatan spec): anggota tim biasa (bukan admin/superadmin,
    // bukan Manager) TIDAK lihat ticket yg masih pending approval / belum
    // di-assign. Yg di-route ke Supervisor hanya tampil ke Supervisor ybs.
    // Admin & Manager tetap lihat semua.
    const roleLc2 = (activeUser?.role ?? "").toLowerCase();
    const isAdminUser2 = roleLc2 === "admin" || roleLc2 === "superadmin";
    const isManagerUser2 = hasFullAccess(activeUser);
    if (!isAdminUser2 && !isManagerUser2) {
      mergedTickets = mergedTickets.filter((t) =>
        t.status !== "Waiting Approval" &&
        !(t.routing_status === "supervisor_assign" && t.assigned_supervisor_id !== activeUser?.id)
      );
    }
    try {
      // Ambil HANYA log milik ticket yang benar-benar tampil. Menarik
      // seluruh activity_logs lalu menyaringnya di browser berarti log
      // ticket organisasi lain ikut terunduh, dan ukurannya tumbuh terus.
      const idTampil = mergedTickets.map((t: Ticket) => t.id).filter(Boolean);
      const svcLogs: ActivityLog[] = [];
      for (let i = 0; i < idTampil.length; i += 100) {
        const { data } = await supabaseServices.from("activity_logs")
          //  Ringkas juga: kueri ini ikut jalan pada SETIAP polling, jadi
          //  kolom berat di sini sama mahalnya dengan yang di basis PTS.
          .select(KOLOM_LOG_RINGKAS)
          //  TANPA batas rentang: yang disaring di sini LOG, bukan tiket.
          //  Log ditulis SESUDAH tiketnya dibuat - kadang jauh sesudahnya -
          //  jadi memakai jendela tanggal milik tiket akan membuang catatan
          //  terbaru pada tiket lama, tepat pada saat seseorang membuka
          //  tahun lampau untuk membacanya. Pembatasnya sudah ticket_id:
          //  daftarnya cuma berisi tiket yang memang sedang ditampilkan.
          .in("ticket_id", idTampil.slice(i, i + 100))
          .order("created_at", { ascending: false });
        if (data) svcLogs.push(...(data as ActivityLog[]));
      }
      if (svcLogs.length > 0) {
        mergedTickets = mergedTickets.map((ticket: Ticket) => {
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
      }
    } catch { }
    return { tickets: mergedTickets, periksaPilihan: false };
  }
}
