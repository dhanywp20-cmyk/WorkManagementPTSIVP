'use client';

/** useDaftarTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { useState, useEffect, useMemo } from 'react';
import { User, TeamMember, Ticket, OverdueSetting, adalahPending, TAHUN_TERBARU } from './shared';
import { supabase } from '@/lib/supabase';
import { isAssignablePTSTeam, bolehDitugaskanOleh, adalahAdminMurni } from '@/lib/teams';

export interface DaftarTicketKonteks {
  ITEMS_PER_PAGE: 15;
  currentPage: number;
  currentUser: User | null;
  currentUserTeamType: string;
  filterStatus: string;
  filterYear: string;
  handlerFilter: string | null;
  isTicketOverdue: (ticket: Ticket) => boolean;
  overdueSettings: OverdueSetting[];
  productFilter: string | null;
  salesDivisionFilter: string | null;
  searchProduct: string;
  searchProject: string;
  searchSalesName: string;
  setCurrentPage: import("react").Dispatch<import("react").SetStateAction<number>>;
  teamMembers: TeamMember[];
  tickets: Ticket[];
}

export function useDaftarTicket(k: DaftarTicketKonteks) {
  const { ITEMS_PER_PAGE, currentPage, currentUser, currentUserTeamType, filterStatus, filterYear, handlerFilter, isTicketOverdue, overdueSettings, productFilter, salesDivisionFilter, searchProduct, searchProject, searchSalesName, setCurrentPage, teamMembers, tickets } = k;
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const projectName = t.project_name || "";
      const issueCase = t.issue_case || "";
      const salesName = t.sales_name || "";
      const match = projectName.toLowerCase().includes(searchProject.toLowerCase()) || issueCase.toLowerCase().includes(searchProject.toLowerCase());
      const salesNameMatch = salesName.toLowerCase().includes(searchSalesName.toLowerCase());
      const ticketYear = t.created_at ? new Date(t.created_at).getFullYear().toString() : "";
      //  Server sudah membatasi rentangnya (lihat rentangTiket), jadi di sini
      //  'terbaru' tidak menyaring apa pun lagi - menyaring dua kali dengan
      //  aturan berbeda cuma menghasilkan baris yang hilang tanpa sebab.
      const yearMatch = filterYear === TAHUN_TERBARU || ticketYear === filterYear;
      let statusMatch = false;
      if (filterStatus === "All") statusMatch = true;
      else if (filterStatus === "Overdue") statusMatch = isTicketOverdue(t) && t.status !== "Solved";
      else if (filterStatus === "Solved Overdue") statusMatch = isTicketOverdue(t) && t.status === "Solved";
      else if (currentUserTeamType === "Team Services") statusMatch = t.services_status === filterStatus || t.status === filterStatus;
      // Klik kartu "Pending" menampilkan seluruh varian Pending, supaya angka
      // di kartu dan jumlah baris yang muncul tidak berbeda.
      else if (filterStatus === "Pending") statusMatch = (t.status ?? '').startsWith("Pending");
      else statusMatch = t.status === filterStatus;
      const handlerMatch = handlerFilter === null || t.assign_name === handlerFilter;
      const divisionMatch = salesDivisionFilter === null || t.sales_division === salesDivisionFilter;
      const productMatch = productFilter === null || (t.product || "") === productFilter;
      const productSearchMatch = !searchProduct || (t.product || "").toLowerCase().includes(searchProduct.toLowerCase());
      let teamVisibility = true;
      if (currentUserTeamType === "Team Services") teamVisibility = t.current_team === "Team Services" || !!t.services_status;
      if (t.status === "Waiting Approval" && currentUser?.role !== "admin" && currentUser?.role !== "superadmin" && currentUserTeamType !== "Team Services") {
        teamVisibility = teamVisibility && t.created_by === currentUser?.username;
      }
      return match && salesNameMatch && yearMatch && statusMatch && teamVisibility && handlerMatch && divisionMatch && productMatch && productSearchMatch;
    });
  }, [tickets, searchProject, searchSalesName, filterYear, filterStatus, currentUserTeamType, overdueSettings, handlerFilter, salesDivisionFilter, productFilter, searchProduct]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchProject, searchSalesName, filterYear, filterStatus, handlerFilter, salesDivisionFilter, productFilter, searchProduct]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage, ITEMS_PER_PAGE]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const processing = tickets.filter((t) => t.status === "In Progress").length;
    const pending = tickets.filter((t) => adalahPending(t.status)).length;
    const solved = tickets.filter((t) => t.status === "Solved").length;
    const overdue = tickets.filter((t) => isTicketOverdue(t) && t.status !== "Solved").length;
    const solvedOverdue = tickets.filter((t) => isTicketOverdue(t) && t.status === "Solved").length;
    /*
      Irisan donut harus saling lepas. Kartu statistik boleh tumpang-tindih
      (Solved sudah termasuk Solved Overdue; Pending/In Progress sudah termasuk
      yang Overdue), tapi di donut itu membuat tiket terhitung dua kali -
      totalnya pernah tampil 104 padahal tiketnya 94.
    */
    const pendingTepat = tickets.filter((t) => adalahPending(t.status) && !isTicketOverdue(t)).length;
    const processingTepat = tickets.filter((t) => t.status === "In Progress" && !isTicketOverdue(t)).length;
    return {
      total, pending, processing, solved, overdue, solvedOverdue,
      statusData: [
        { name: "Pending", value: pendingTepat, color: "#FCD34D" },
        { name: "In Progress", value: processingTepat, color: "#60A5FA" },
        { name: "Solved", value: solved - solvedOverdue, color: "#34D399" },
        ...(overdue > 0 ? [{ name: "Overdue", value: overdue, color: "#EF4444" }] : []),
        ...(solvedOverdue > 0 ? [{ name: "Solved (Overdue)", value: solvedOverdue, color: "#9333ea" }] : []),
      ].filter((d) => d.value > 0),
      handlerData: Object.entries(tickets.reduce((acc, t) => { acc[t.assign_name] = (acc[t.assign_name] || 0) + 1; return acc; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([name, tickets]) => {
        const member = teamMembers.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
        return { name, tickets, team: member?.team_type || "Team PTS IVP" };
      }),
    };
  }, [tickets, overdueSettings]);

  const salesDivisionStats = useMemo(() => {
    const divisionCounts: Record<string, number> = {};
    tickets.forEach((t) => { if (t.sales_division) divisionCounts[t.sales_division] = (divisionCounts[t.sales_division] || 0) + 1; });
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1", "#14B8A6", "#F43F5E", "#A855F7", "#22D3EE", "#EAB308"];
    const divisionData = Object.entries(divisionCounts).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })).sort((a, b) => b.value - a.value);
    return { data: divisionData, total: divisionData.reduce((sum, d) => sum + d.value, 0) };
  }, [tickets]);

  // Product stats untuk mini donut chart
  const productStats = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach((t) => { if (t.product) counts[t.product] = (counts[t.product] || 0) + 1; });
    const colors = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16","#F97316","#6366F1","#14B8A6","#F43F5E","#A855F7","#22D3EE","#EAB308"];
    const data = Object.entries(counts)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
      .sort((a, b) => b.value - a.value);
    return { data, total: data.reduce((s, d) => s + d.value, 0) };
  }, [tickets]);

  /*
    Daftar tahun untuk penyaring - DARI SERVER, bukan disimpulkan dari tiket
    yang sedang tampil.

    Dulu ia dikumpulkan dari array `tickets`. Itu benar selama seluruh tiket
    memang ditarik. Sekarang tarikan bawaannya dibatasi 12 bulan terakhir
    (lihat rentangTiket), jadi menyimpulkannya dari sana akan membuat pilihan
    tahun lama HILANG dari dropdown - dan begitu pilihannya hilang, tiket lama
    tidak bisa dijangkau sama sekali. Yang tadinya cuma "tidak ditampilkan"
    berubah jadi "tidak ada".

    Kuerinya sendiri murah: satu kolom, tanpa join, dan hanya dijalankan sekali
    saat halaman dibuka.
  */
  const [tahunTersedia, setTahunTersedia] = useState<string[]>([]);
  useEffect(() => {
    if (!currentUser) return;
    let hidup = true;
    (async () => {
      const { data } = await supabase.from("tickets").select("created_at");
      if (!hidup || !data) return;
      const tahun = new Set<string>();
      for (const b of data as { created_at: string | null }[]) {
        if (b.created_at) tahun.add(new Date(b.created_at).getFullYear().toString());
      }
      setTahunTersedia(Array.from(tahun).sort((a, b) => parseInt(b) - parseInt(a)));
    })();
    return () => { hidup = false; };
  }, [currentUser]);

  const availableYears = useMemo(() => {
    //  Gabungkan dengan tahun yang muncul di tiket yang sedang tampil, supaya
    //  penyaringnya tetap berguna kalau kueri daftar tahun di atas gagal.
    const years = new Set<string>(tahunTersedia);
    tickets.forEach((t) => { if (t.created_at) years.add(new Date(t.created_at).getFullYear().toString()); });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [tickets, tahunTersedia]);

  const uniqueProjectNames = useMemo(() => {
    const names = tickets.map((t) => t.project_name);
    return Array.from(new Set(names)).sort();
  }, [tickets]);

  // Team yg boleh di-assign tiket = ASSIGNABLE_PTS_TEAMS (IVP/MVI - UMP dikecualikan,
  // lihat lib/teams.ts). Manager dikecualikan - bukan handler teknis biasa.
  //  Dulu `m.jabatan !== "Manager"` dipaku di sini. Diganti toggle per akun
//  (lihat bolehDitugaskan di lib/teams.ts): perusahaan lain bisa saja
//  Manager-nya memang ikut mengerjakan, dan itu harus bisa diatur dari
//  Admin Panel tanpa menyunting kode. Manager hanya ditawarkan ke Admin
//  murni - lihat bolehDitugaskanOleh.
  const penugasAdmin = adalahAdminMurni(currentUser);
  const teamPTSMembers = useMemo(() => teamMembers.filter((m) => bolehDitugaskanOleh(m, penugasAdmin)), [teamMembers, penugasAdmin]);
  const teamServicesMembers = useMemo(() => teamMembers.filter((m) => m.team_type === "Team Services" && m.jabatan !== "Manager"), [teamMembers]);
  // Supervisor PTS - utk opsi "Route ke Supervisor" saat approve (tahap supervisor_assign).
  const supervisorMembers = useMemo(() => teamMembers.filter((m) => isAssignablePTSTeam(m.team_type) && m.jabatan === "Supervisor"), [teamMembers]);
  return { filteredTickets, totalPages, paginatedTickets, stats, salesDivisionStats, productStats, tahunTersedia, setTahunTersedia, availableYears, uniqueProjectNames, penugasAdmin, teamPTSMembers, teamServicesMembers, supervisorMembers };
}
