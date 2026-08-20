import { Ticket, ringkasPenanganan, formatDateTime } from './shared';

/**
 * Laporan cetak satu ticket: menyusun HTML lengkap dengan gaya cetaknya
 * sendiri lalu membukanya di jendela baru untuk dicetak sebagai PDF.
 *
 * Murni - tidak menyentuh state halaman sama sekali. Yang dibutuhkannya cuma
 * ticket-nya, dan itulah alasan fungsi sepanjang ini tidak perlu tinggal di
 * dalam komponen halaman.
 */
export async function cetakTicket(ticket: Ticket): Promise<void> {
  const printDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

  const statusLabel = ticket.status;

  // Aturan handler/team/catatan pelimpahan hidup di satu tempat supaya layar
  // View Ticket dan laporan cetak tidak pernah menjawab berbeda.
  const { handlerPTS, teamHandler, catatanServices } = ringkasPenanganan(ticket);

  const statusColor = ticket.status === "Solved" ? "#059669"
    : ticket.status === "In Progress" ? "#2563eb"
    : ticket.status === "Pending" ? "#d97706"
    : ticket.status === "Onsite" ? "#7c3aed"
    : ticket.status === "Call" ? "#0891b2"
    : ticket.status === "Waiting Approval" ? "#ea580c"
    : "#64748b";

  const row = (label: string, value: string | null | undefined) =>
    value ? `<tr>
      <td style="font-weight:600;color:#475569;width:160px;padding:7px 12px;border:1px solid #e2e8f0;font-size:12px;background:#f8fafc">${label}</td>
      <td style="padding:7px 12px;border:1px solid #e2e8f0;font-size:12px;color:#1e293b">${value}</td>
    </tr>` : "";

  const badge = (text: string, bg = "#fef3c7", color = "#92400e") =>
    `<span style="display:inline-block;padding:2px 10px;border-radius:20px;background:${bg};color:${color};font-size:11px;font-weight:700;margin:2px 2px 2px 0">${text}</span>`;

  // Activity log rows
  const activityRows = (ticket.activity_logs || [])
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((log: any, idx: number) => {
      const ts = formatDateTime(log.created_at);
      const teamColor = log.team_type === "Team Services" ? "#92400e" : "#1d4ed8";
      const statusCol = log.new_status === "Solved" ? "#065f46"
        : log.new_status === "In Progress" ? "#1d4ed8"
        : log.new_status === "Pending" ? "#92400e"
        : "#475569";
      return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
        <td style="padding:10px 12px;border:1px solid #e2e8f0;width:120px;white-space:nowrap;vertical-align:top">
          <div style="font-size:11px;color:#64748b">${ts}</div>
          <div style="margin-top:3px;font-size:10px;font-weight:700;color:${teamColor}">${log.team_type || "Team PTS IVP"}</div>
        </td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;width:130px;vertical-align:top">
          <div style="font-weight:700;font-size:12px;color:#1e293b">${log.handler_name || "-"}</div>
          <div style="margin-top:4px;font-size:10px;font-weight:700;color:${statusCol}">${log.new_status}</div>
          ${log.assigned_to_services ? `<div style="margin-top:4px;font-size:10px;font-weight:700;color:#dc2626">🔄 → Team Services</div>` : ""}
        </td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top">
          ${log.action_taken ? `<div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:4px">🔧 ${log.action_taken}</div>` : ""}
          ${log.notes ? `<div style="font-size:12px;color:#1e293b;line-height:1.6;white-space:pre-line">${log.notes}</div>` : "<div style=\"color:#94a3b8;font-size:11px;font-style:italic\">—</div>"}
          ${log.file_url ? `<div style="margin-top:6px"><a href="${log.file_url}" style="font-size:11px;color:#2563eb;font-weight:600">📎 ${log.file_name || "Download"}</a></div>` : ""}
          ${log.photo_url ? `<div style="margin-top:6px"><img src="${log.photo_url}" style="max-height:100px;border-radius:6px;border:1px solid #e2e8f0" alt="bukti"/></div>` : ""}
        </td>
      </tr>`;
    }).join("");

  const printContent = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>Ticket Report — ${ticket.project_name}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 13px; }
.page { padding: 28px 32px; max-width: 940px; margin: 0 auto; }
.header { background: linear-gradient(135deg,#dc2626,#991b1b); color: white; border-radius: 12px; padding: 18px 22px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
.header-left h1 { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
.header-left p { font-size: 11px; opacity: 0.85; }
.header-right { text-align: right; font-size: 11px; opacity: 0.85; line-height: 1.8; }
/* Dulu di sini ada .status-pill: latar rgba(255,255,255,0.92) dengan tulisan
   putih — praktis putih di atas putih, jadi teksnya tidak pernah terbaca.
   Latar bulat itu dibuang seluruhnya di laporan ini; statusnya cukup teks. */
.status-line { font-size: 11px; font-weight: 700; margin-top: 6px; opacity: 1; }
.section { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
.section-title { background: #f1f5f9; padding: 8px 14px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em; color: #475569; border-bottom: 1px solid #e2e8f0; }
.log-section .section-title { background: #fff1f2; color: #9f1239; border-color: #fecdd3; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; }
.grid2 > * { border-right: 1px solid #e2e8f0; }
.grid2 > *:last-child { border-right: none; }
.info-box { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
.info-box:last-child { border-bottom: none; }
.info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 3px; }
.info-value { font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.5; }
table.log { width: 100%; border-collapse: collapse; }
.footer { margin-top: 20px; padding-top: 12px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
.sign-grid { margin-top: 40px; display: grid; grid-template-columns: 250px; page-break-inside: avoid; }
.sign-box { border-top: 1.5px solid #334155; padding-top: 8px; text-align: center; }
.sign-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
.sign-space { height: 58px; }
.sign-name { font-size: 12px; font-weight: 700; color: #1e293b; border-top: 1px solid #cbd5e1; padding-top: 6px; }
@media print {
  .page { padding: 16px 20px; }
  .section, .log-section { page-break-inside: avoid; }
  button { display: none !important; }
}
</style>
</head>
<body><div class="page">

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <h1>🎫 Report Troubleshooting — IVP</h1>
    <p>Ticket ID: ${ticket.id?.substring(0,8).toUpperCase()}</p>
    <div class="status-line">PTS: ${statusLabel}${ticket.services_status ? " &nbsp;·&nbsp; Services: " + ticket.services_status : ""}</div>
  </div>
  <div class="header-right">
    <div><b>Dicetak:</b> ${printDate}</div>
    <div><b>Handler:</b> ${handlerPTS || "—"}</div>
    <div><b>Team:</b> ${teamHandler}</div>
    <div><b>Status:</b> ${statusLabel}${catatanServices}</div>
    <div><b>Dibuat:</b> ${formatDateTime(ticket.created_at)}</div>
  </div>
</div>

<!-- INFORMASI TICKET -->
<div class="section">
  <div class="section-title">🎫 Informasi Ticket</div>
  <div class="grid2">
    <div>
      <div class="info-box"><div class="info-label">Nama Project</div><div class="info-value" style="font-size:14px;font-weight:800;color:#dc2626">${ticket.project_name}</div></div>
      <div class="info-box"><div class="info-label">Issue Case</div><div class="info-value">${ticket.issue_case}</div></div>
      <div class="info-box"><div class="info-label">Deskripsi</div><div class="info-value" style="font-weight:400;color:#475569">${ticket.description || "—"}</div></div>
    </div>
    <div>
      <div class="info-box"><div class="info-label">Address / Lokasi</div><div class="info-value">${ticket.address || "—"}</div></div>
      <div class="info-box"><div class="info-label">Product / Unit</div><div class="info-value">${ticket.product || "—"}</div></div>
      <div class="info-box"><div class="info-label">SN Unit</div><div class="info-value">${ticket.sn_unit || "—"}</div></div>
    </div>
  </div>
</div>

<!-- INFORMASI SALES & STATUS -->
<div class="section">
  <div class="section-title">🏢 Sales & Status</div>
  <div class="grid2">
    <div>
      <div class="info-box"><div class="info-label">Sales / Account</div><div class="info-value">${ticket.sales_name || "—"}</div></div>
      <div class="info-box"><div class="info-label">Divisi Sales</div><div class="info-value">${ticket.sales_division || "—"}</div></div>
      <div class="info-box"><div class="info-label">Customer / User</div><div class="info-value">${ticket.customer_phone || "—"}</div></div>
    </div>
    <div>
      <div class="info-box"><div class="info-label">Status Team PTS IVP</div>
        <div class="info-value" style="color:${statusColor}">${ticket.status}${catatanServices}</div>
      </div>
      ${ticket.services_status ? `<div class="info-box"><div class="info-label">Status Team Services</div>
        <div class="info-value" style="color:#b45309">${ticket.services_status}</div>
      </div>` : ""}
      <div class="info-box"><div class="info-label">Tanggal Dibuat</div><div class="info-value">${formatDateTime(ticket.created_at)}</div></div>
      <div class="info-box"><div class="info-label">Created By</div><div class="info-value">${ticket.created_by || "—"}</div></div>
    </div>
  </div>
</div>

<!-- ACTIVITY LOG -->
<div class="section log-section">
  <div class="section-title">📋 Activity Log — Riwayat Penanganan</div>
  ${activityRows ? `
  <table class="log">
    <thead>
      <tr style="background:#fff1f2">
        <th style="padding:8px 12px;font-size:10px;font-weight:700;text-align:left;color:#9f1239;border-bottom:1.5px solid #fecdd3;width:130px">Waktu</th>
        <th style="padding:8px 12px;font-size:10px;font-weight:700;text-align:left;color:#9f1239;border-bottom:1.5px solid #fecdd3;width:140px">Handler & Status</th>
        <th style="padding:8px 12px;font-size:10px;font-weight:700;text-align:left;color:#9f1239;border-bottom:1.5px solid #fecdd3">Action & Notes</th>
      </tr>
    </thead>
    <tbody>${activityRows}</tbody>
  </table>` : `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">Belum ada activity log</div>`}
</div>

<!-- FOTO TICKET -->
${ticket.photo_url ? `
<div class="section" style="page-break-inside:avoid">
  <div class="section-title">📸 Foto Ticket</div>
  <div style="padding:12px;text-align:center">
    <img src="${ticket.photo_url}" style="max-height:220px;max-width:100%;border-radius:8px;border:1.5px solid #e2e8f0" alt="foto ticket"/>
  </div>
</div>` : ""}

<!-- FOOTER -->
<div class="footer">
  <div>🎫 IndoVisual Professional Tools — Ticket Troubleshooting System</div>
  <div>Dicetak: ${printDate} | Status: ${ticket.status}${catatanServices}</div>
</div>

<!-- TANDA TANGAN -->
<div class="sign-grid">
  <div class="sign-box">
    <div class="sign-label">Handler / ${teamHandler}</div>
    <div class="sign-space"></div>
    <div class="sign-name">${handlerPTS || "( ............................ )"}</div>
  </div>
</div>

</div></body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(printContent); win.document.close(); setTimeout(() => win.print(), 300); }
}
