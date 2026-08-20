import { Ticket, formatDateTime } from './shared';

/**
 * Ekspor daftar ticket ke Excel berformat, termasuk lembar ringkasan.
 *
 * Seluruh yang dibutuhkannya diterima sebagai argumen, jadi fungsi sepanjang
 * ini tidak perlu tinggal di dalam komponen halaman - dan bisa diuji tanpa
 * merender apa pun.
 */
export interface ArgEkspor {
  tickets: Ticket[];
  filteredTickets: Ticket[];
  currentUserTeamType: string;
  stats: {
    total: number; pending: number; processing: number;
    solved: number; overdue: number; solvedOverdue: number;
  };
  isTicketOverdue: (t: Ticket) => boolean;
  notify: (tipe: 'success' | 'error', pesan: string) => void;
}

export function eksporExcel({ tickets, filteredTickets, currentUserTeamType, stats, isTicketOverdue, notify }: ArgEkspor): void {
  const runExport = (XLSX: any) => {
    const exportTickets = currentUserTeamType === "Team Services" ? filteredTickets : tickets;
    const isServicesExport = currentUserTeamType === "Team Services";
    const border = { top: { style: "thin", color: { rgb: "D1D5DB" } }, bottom: { style: "thin", color: { rgb: "D1D5DB" } }, left: { style: "thin", color: { rgb: "D1D5DB" } }, right: { style: "thin", color: { rgb: "D1D5DB" } } };
    const boldBorder = { top: { style: "thin", color: { rgb: "000000" } }, bottom: { style: "thin", color: { rgb: "000000" } }, left: { style: "thin", color: { rgb: "000000" } }, right: { style: "thin", color: { rgb: "000000" } } };
    const hdrStyle = { font: { name: "Arial", bold: true, sz: 11, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: boldBorder };
    const secHdrStyle = { font: { name: "Arial", bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" }, patternType: "solid" }, alignment: { horizontal: "center", vertical: "center" }, border: boldBorder };
    const cellStyle = { font: { name: "Arial", sz: 10 }, alignment: { vertical: "center", wrapText: true }, border };
    const altStyle = { ...cellStyle, fill: { fgColor: { rgb: "EFF6FF" }, patternType: "solid" } };
    const titleStyle = { font: { name: "Arial", bold: true, sz: 15, color: { rgb: "1E3A5F" } }, alignment: { horizontal: "left", vertical: "center" } };
    const statusStyles: Record<string, object> = {
      Solved: { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "166534" } }, fill: { fgColor: { rgb: "DCFCE7" }, patternType: "solid" } },
      "In Progress": { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "1E40AF" } }, fill: { fgColor: { rgb: "DBEAFE" }, patternType: "solid" } },
      Pending: { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "92400E" } }, fill: { fgColor: { rgb: "FEF3C7" }, patternType: "solid" } },
      Overdue: { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "991B1B" } }, fill: { fgColor: { rgb: "FEE2E2" }, patternType: "solid" } },
      "Waiting Approval": { ...cellStyle, font: { name: "Arial", sz: 10, bold: true, color: { rgb: "9A3412" } }, fill: { fgColor: { rgb: "FFEDD5" }, patternType: "solid" } },
    };
    const c = (v: any, s: object) => ({ v, s, t: typeof v === "number" ? "n" : "s" });
    const empty = () => ({ v: "", s: cellStyle, t: "s" });
    const row = (cells: number) => Array(cells).fill(empty());
    const wb = XLSX.utils.book_new();
    const exportDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    // Dashboard sheet
    {
      const COLS = 5;
      const dashTitle = isServicesExport ? "📊 TICKET REPORT — TEAM SERVICES" : "📊 TICKET REPORT — DASHBOARD ANALYTICS";
      const data: any[][] = [
        [c(dashTitle, titleStyle), ...row(COLS - 1)],
        [c(`Tanggal Export: ${exportDate}`, { font: { name: "Arial", sz: 10, color: { rgb: "6B7280" } } }), ...row(COLS - 1)],
        row(COLS),
        [c("RINGKASAN STATISTIK", secHdrStyle), ...row(COLS - 1)],
        [c("Kategori", hdrStyle), c("Jumlah", hdrStyle), c("Persentase", hdrStyle), c("", hdrStyle), c("", hdrStyle)],
      ];
      const totalExport = exportTickets.length;
      const statItems = isServicesExport ? [
        { label: "Total Tickets (Services)", value: totalExport, color: "1E3A5F" },
        { label: "Pending Check", value: exportTickets.filter((t: Ticket) => t.services_status === "Pending").length, color: "92400E" },
        { label: "Process Repair", value: exportTickets.filter((t: Ticket) => t.services_status === "Process Repair").length, color: "1E40AF" },
        { label: "Solved", value: exportTickets.filter((t: Ticket) => t.services_status === "Solved").length, color: "166534" },
      ] : [
        { label: "Total Tickets", value: stats.total, color: "1E3A5F" },
        { label: "Pending", value: stats.pending, color: "92400E" },
        { label: "In Progress", value: stats.processing, color: "1E40AF" },
        { label: "Solved", value: stats.solved, color: "166534" },
      ];
      statItems.forEach((item, i) => {
        const total = isServicesExport ? totalExport : stats.total;
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) + "%" : "0%";
        const rs = { ...cellStyle, ...(i % 2 ? { fill: { fgColor: { rgb: "EFF6FF" }, patternType: "solid" } } : {}) };
        data.push([
          c(item.label, { ...rs, font: { name: "Arial", sz: 10, bold: true, color: { rgb: item.color } } }),
          c(item.value, { ...rs, alignment: { horizontal: "center", vertical: "center" } }),
          c(pct, { ...rs, alignment: { horizontal: "center", vertical: "center" } }),
          empty(), empty(),
        ]);
      });
      data.push(row(COLS));
      const handlerMap: Record<string, number> = {};
      exportTickets.forEach((t: Ticket) => { if (t.assign_name) handlerMap[t.assign_name] = (handlerMap[t.assign_name] || 0) + 1; });
      data.push([c("HANDLER", hdrStyle), c("JUMLAH TICKET", hdrStyle), c("PERSENTASE", hdrStyle), c("", hdrStyle), c("", hdrStyle)]);
      Object.entries(handlerMap).forEach(([handler, count], i) => {
        const total = exportTickets.length;
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
        const rs = i % 2 === 0 ? cellStyle : altStyle;
        data.push([c(handler, rs), c(count, { ...rs, alignment: { horizontal: "center", vertical: "center" } }), c(pct, { ...rs, alignment: { horizontal: "center", vertical: "center" } }), empty(), empty()]);
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } }, { s: { r: 3, c: 0 }, e: { r: 3, c: COLS - 1 } }];
      ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
      ws["!rows"] = [{ hpt: 30 }, { hpt: 18 }, { hpt: 8 }];
      XLSX.utils.book_append_sheet(wb, ws, "📊 Dashboard");
    }
    // Tickets sheet
    {
      const headers = ["No.", "Project Name", "Alamat", "Nama & Telepon Customer", "Sales", "Issue / Masalah", "Deskripsi", "SN Unit", "Product", "Handler (Assigned To)", "Status PTS", "Status Services", "Current Team", "Tgl Ticket", "Dibuat Oleh", "Dibuat Pada", "Jumlah Activity Log"];
      const COLS = headers.length;
      const data: any[][] = [[c(isServicesExport ? "📋 DATA TICKET — TEAM SERVICES" : "📋 DATA SEMUA TICKET", { ...titleStyle, font: { name: "Arial", bold: true, sz: 14, color: { rgb: "1E3A5F" } } }), ...row(COLS - 1)], row(COLS), headers.map((h) => c(h, hdrStyle))];
      exportTickets.forEach((t: Ticket, idx: number) => {
        const rs = idx % 2 === 0 ? cellStyle : altStyle;
        const overdue = isTicketOverdue(t);
        const effectiveStatus = overdue && t.status !== "Solved" ? "Overdue" : t.status;
        const statusDisplay = overdue && t.status !== "Solved" ? `${t.status} (OVERDUE)` : t.status;
        const ctr = { ...rs, alignment: { horizontal: "center", vertical: "center" } };
        data.push([
          c(idx + 1, ctr), c(t.project_name || "-", rs), c(t.address || "-", rs), c(t.customer_phone || "-", rs),
          c(t.sales_name || "-", rs), c(t.issue_case || "-", rs), c(t.description || "-", rs), c(t.sn_unit || "-", ctr), c((t as any).product || "-", rs),
          c(t.assign_name || "-", rs), c(statusDisplay, statusStyles[effectiveStatus] || rs), c(t.services_status || "-", t.services_status ? statusStyles[t.services_status] || rs : rs),
          c(t.current_team || "-", rs), c(t.date || "-", ctr), c(t.created_by || "-", rs),
          c(t.created_at ? formatDateTime(t.created_at) : "-", ctr), c(t.activity_logs?.length || 0, ctr),
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }];
      ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 30 }, { wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 38 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 10 }];
      ws["!rows"] = [{ hpt: 28 }, { hpt: 6 }, { hpt: 32 }];
      XLSX.utils.book_append_sheet(wb, ws, "📋 Semua Ticket");
    }
    // Activity Logs sheet
    {
      const headers = ["No.", "Project Name", "Issue", "Status Ticket", "Handler", "Team", "Action Taken", "Notes", "Status Baru", "Ke Services?", "File Lampiran", "Waktu Activity"];
      const COLS = headers.length;
      const data: any[][] = [[c(isServicesExport ? "📝 ACTIVITY LOG — TEAM SERVICES" : "📝 DETAIL ACTIVITY LOG", { ...titleStyle, font: { name: "Arial", bold: true, sz: 14, color: { rgb: "1E3A5F" } } }), ...row(COLS - 1)], row(COLS), headers.map((h) => c(h, hdrStyle))];
      let rowIdx = 0;
      exportTickets.forEach((ticket: Ticket) => {
        if (!ticket.activity_logs || ticket.activity_logs.length === 0) {
          const rs = rowIdx % 2 === 0 ? cellStyle : altStyle;
          data.push([
            c(rowIdx + 1, { ...rs, alignment: { horizontal: "center", vertical: "center" } }),
            c(ticket.project_name || "-", rs), c(ticket.issue_case || "-", rs), c(ticket.status || "-", statusStyles[ticket.status] || rs),
            c("-", rs), c("-", rs), c("-", rs), c("(Belum ada activity log)", { ...rs, font: { name: "Arial", sz: 10, color: { rgb: "9CA3AF" } } }),
            c("-", rs), c("-", rs), c("-", rs), c("-", rs),
          ]);
          rowIdx++;
          return;
        }
        [...ticket.activity_logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach((log) => {
          const rs = rowIdx % 2 === 0 ? cellStyle : altStyle;
          const ctr = { ...rs, alignment: { horizontal: "center", vertical: "center" } };
          data.push([
            c(rowIdx + 1, ctr), c(ticket.project_name || "-", rs), c(ticket.issue_case || "-", rs), c(ticket.status || "-", statusStyles[ticket.status] || rs),
            c(log.handler_name || "-", rs), c(log.team_type || "-", rs), c(log.action_taken || "-", rs),
            c(log.notes || "-", { ...rs, alignment: { horizontal: "left", vertical: "center", wrapText: true } }),
            c(log.new_status || "-", statusStyles[log.new_status] || rs),
            c(log.assigned_to_services ? "✅ Ya" : "Tidak", { ...ctr, font: { name: "Arial", sz: 10, bold: !!log.assigned_to_services, color: { rgb: log.assigned_to_services ? "166534" : "374151" } } }),
            c(log.file_name || "-", rs), c(log.created_at ? formatDateTime(log.created_at) : "-", ctr),
          ]);
          rowIdx++;
        });
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }];
      ws["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 40 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 22 }];
      ws["!rows"] = [{ hpt: 28 }, { hpt: 6 }, { hpt: 32 }];
      XLSX.utils.book_append_sheet(wb, ws, "📝 Activity Logs");
    }
    const teamLabel = isServicesExport ? "Services" : "PTS";
    const fileName = `Ticket_Report_${teamLabel}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName, { bookType: "xlsx", type: "binary", cellStyles: true });
  };
  if ((window as any).XLSX) runExport((window as any).XLSX);
  else {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => runExport((window as any).XLSX);
    script.onerror = () => notify("error", "Gagal memuat library Excel.");
    document.head.appendChild(script);
  }
}
