import { statusConfig, type ProjectRequest } from './shared';

/**
 * Lembar cetak satu Request Design Project.
 *
 * Label Sales Internal (CC) diterima jadi argumen, bukan dihitung di sini:
 * penyusunannya butuh peta nama internal sales yang hanya ada di halaman.
 */
const formatDate = (dt: string) => new Date(dt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDueDate = (dt: string) => new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export function cetakRequest(selectedRequest: ProjectRequest, ccLabel: string): void {
  if (!selectedRequest) return;
  const sc = statusConfig[selectedRequest.status] || statusConfig.pending;
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions);
  const statusColorMap: Record<string, string> = {
    pending: '#d97706', approved: '#0d9488', in_progress: '#2563eb', completed: '#7c3aed', rejected: '#dc2626',
  };
  const statusColor = statusColorMap[selectedRequest.status] || '#0d9488';
  const statusLabel = sc.label;

  const infoBox = (label: string, value: string, highlight = false) =>
    value ? `<div class="info-box"><div class="info-label">${label}</div><div class="info-value"${highlight ? ' style="font-size:14px;font-weight:800;color:#065f46"' : ''}>${value}</div></div>` : '';

  const printContent = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>Request Design Project — ${selectedRequest.project_name}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 13px; }
.page { padding: 28px 32px; max-width: 940px; margin: 0 auto; }
.header { background: linear-gradient(135deg,#059669,#065f46); color: white; border-radius: 12px; padding: 18px 22px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
.header-left h1 { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
.header-left p { font-size: 11px; opacity: 0.85; }
.header-right { text-align: right; font-size: 11px; opacity: 0.85; line-height: 1.8; }
.status-pill { display: inline-block; padding: 3px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
  background: rgba(255,255,255,0.92); border: 1px solid rgba(255,255,255,0.5); color: white; margin-top: 6px; }
.section { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid; }
.section-title { background: #f1f5f9; padding: 8px 14px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em; color: #475569; border-bottom: 1px solid #e2e8f0; }
.section-title.green { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; }
.grid2 > * { border-right: 1px solid #e2e8f0; }
.grid2 > *:last-child { border-right: none; }
.info-box { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
.info-box:last-child { border-bottom: none; }
.info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 3px; }
.info-value { font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.5; }
.full-col { grid-column: span 2; }
.footer { margin-top: 20px; padding-top: 12px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
.assign-box { margin-top: 40px; page-break-inside: avoid; border-top: 1.5px solid #334155; padding-top: 12px; text-align: left; max-width: 240px; margin-left: 0; margin-right: auto; }
.assign-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
.assign-name { margin-top: 8px; font-size: 13px; font-weight: 800; color: #065f46; }
@media print {
  .page { padding: 16px 20px; }
  .section { page-break-inside: avoid; }
  button { display: none !important; }
}
</style>
</head>
<body><div class="page">

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <h1>🏗️ Request Design Project — IVP</h1>
    <p>Request ID: ${selectedRequest.id?.substring(0,8).toUpperCase()}</p>
    <div class="status-pill">Status: ${statusLabel}</div>
  </div>
  <div class="header-right">
    <div><b>Dicetak:</b> ${printDate}</div>
    <div><b>Handler:</b> ${selectedRequest.assign_name || '—'}</div>
    <div><b>Requester:</b> ${selectedRequest.requester_name}</div>
    <div><b>Dibuat:</b> ${formatDate(selectedRequest.created_at)}</div>
  </div>
</div>

<!-- INFORMASI REQUEST -->
<div class="section">
  <div class="section-title green">🏗️ Informasi Request</div>
  <div class="grid2">
    <div>
      ${infoBox('Nama Project', selectedRequest.project_name, true)}
      ${infoBox('Nama Ruangan', selectedRequest.room_name || '—')}
      ${infoBox('Lokasi Project', selectedRequest.project_location || '—')}
    </div>
    <div>
      ${infoBox('Sales / Account', selectedRequest.sales_name || '—')}
      ${infoBox('Divisi Sales', selectedRequest.sales_division || '—')}
      ${infoBox('Requester', selectedRequest.requester_name || '—')}
    </div>
  </div>
</div>

<!-- STATUS & PENUGASAN -->
<div class="section">
  <div class="section-title green">📋 Status & Penugasan</div>
  <div class="grid2">
    <div>
      <div class="info-box"><div class="info-label">Status Request</div>
        <div><span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${statusColor}22;color:${statusColor};border:1.5px solid ${statusColor}66">${selectedRequest.status.replace('_',' ').toUpperCase()}</span></div>
      </div>
      ${infoBox('PTS Handler (Assign)', selectedRequest.assign_name || '—')}
      ${ccLabel ? infoBox('Sales Internal (CC)', ccLabel) : ''}
      ${infoBox('Approved By', selectedRequest.approved_by || '—')}
    </div>
    <div>
      ${infoBox('Tanggal Dibuat', formatDate(selectedRequest.created_at))}
      ${selectedRequest.approved_at ? infoBox('Tanggal Approved', formatDate(selectedRequest.approved_at)) : ''}
      ${selectedRequest.due_date ? infoBox('Target Selesai', formatDueDate(selectedRequest.due_date)) : ''}
    </div>
  </div>
</div>

<!-- KEBUTUHAN & SOLUTION -->
<div class="section">
  <div class="section-title green">🎯 Kebutuhan & Solution</div>
  <div class="grid2">
    <div>
      ${infoBox('Kebutuhan', [...(selectedRequest.kebutuhan||[]), selectedRequest.kebutuhan_other].filter(Boolean).join(', ') || '—')}
      ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Layout Signage', selectedRequest.layout_signage?.join(', ') || '—') : ''}
    </div>
    <div>
      ${infoBox('Solution / Product', [...(selectedRequest.solution_product||[]), selectedRequest.solution_other].filter(Boolean).join(', ') || '—')}
      ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jaringan CMS', selectedRequest.jaringan_cms?.join(', ') || '—') : ''}
      ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Input', selectedRequest.jumlah_input || '—') : ''}
      ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Output', selectedRequest.jumlah_output || '—') : ''}
    </div>
  </div>
  ${!(selectedRequest.kebutuhan||[]).includes('Signage') ? '' : ''}
</div>

<!-- PERANGKAT & KONEKSI -->
<div class="section">
  <div class="section-title green">🔌 Perangkat & Koneksi</div>
  <div class="grid2">
    <div>
      ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Input', selectedRequest.jumlah_input || '—') : ''}
      ${infoBox('Source', [...(selectedRequest.source||[]), selectedRequest.source_other].filter(Boolean).join(', ') || '—')}
      ${infoBox('Wallplate Input', selectedRequest.wallplate_input === 'Yes' ? `Ya — ${selectedRequest.wallplate_jumlah} unit` : 'Tidak')}
      ${infoBox('Tabletop Input', selectedRequest.tabletop_input === 'Yes' ? `Ya — ${selectedRequest.tabletop_jumlah} unit` : 'Tidak')}
    </div>
    <div>
      ${(selectedRequest.kebutuhan||[]).includes('Signage') ? infoBox('Jumlah Output', selectedRequest.jumlah_output || '—') : ''}
      ${infoBox('Camera Conference', selectedRequest.camera_conference === 'Yes' ? `Ya — ${selectedRequest.camera_jumlah} unit, ${selectedRequest.camera_tracking?.join(', ')||''}` : 'Tidak')}
      ${infoBox('Audio System', selectedRequest.audio_system === 'Yes' ? `Ya — ${selectedRequest.audio_mixer}, ${selectedRequest.audio_detail?.join(', ')||''}` : 'Tidak')}
      ${infoBox('Wireless Presentation', selectedRequest.wireless_presentation === 'Yes' ? `Ya — ${selectedRequest.wireless_mode?.join(', ')}, Dongle: ${selectedRequest.wireless_dongle}` : 'Tidak')}
    </div>
  </div>
</div>

<!-- CONTROLLER & RUANGAN -->
<div class="section">
  <div class="section-title green">📐 Controller & Ruangan</div>
  <div class="grid2">
    <div>
      ${infoBox('Controller / Automation', selectedRequest.controller_automation === 'Yes' ? `Ya — ${selectedRequest.controller_type?.join(', ')||''}` : 'Tidak')}
      ${infoBox('Ukuran Ruangan (P×L×T)', selectedRequest.ukuran_ruangan || '—')}
    </div>
    <div>
      ${infoBox('Suggest Tampilan (W×H)', selectedRequest.suggest_tampilan || '—')}
      ${selectedRequest.keterangan_lain ? infoBox('Keterangan Lain', selectedRequest.keterangan_lain) : ''}
    </div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <div>🏗️ IndoVisual Professional Tools — Request Design Project</div>
  <div>Dicetak: ${printDate} | Status: ${selectedRequest.status.replace('_',' ').toUpperCase()}</div>
</div>

<!-- ASSIGN NAME (HANDLER) -->
${selectedRequest.assign_name ? `
<div class="assign-box">
  <div class="assign-label">Handler / PTS Assign</div>
  <div class="assign-name">${selectedRequest.assign_name}</div>
</div>` : ''}

</div></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(printContent); w.document.close(); setTimeout(() => w.print(), 300); }
}
