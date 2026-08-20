import { statusConfig, type ProjectRequest, type ProjectAttachment } from './shared';

/**
 * Paket unduhan satu Request Design Project: lembar detail plus seluruh
 * lampirannya, dibungkus jadi satu berkas ZIP.
 *
 * ZIP-nya disusun sendiri, tanpa pustaka luar - formatnya sederhana dan
 * menambah dependensi hanya untuk ini tidak sepadan.
 */
export interface ArgPaket {
  selectedRequest: ProjectRequest;
  attachments: ProjectAttachment[];
  ccLabel: string;
  notify: (tipe: 'success' | 'error' | 'info', pesan: string) => void;
}

const formatDueDate = (dt: string) => new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

const crc32Table = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

const crc32 = (buf: Uint8Array): number => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crc32Table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const dosDateTime = (): [number, number] => {
  const d = new Date();
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return [date, time];
};

const buildZip = (files: { name: string; data: Uint8Array }[]): Blob => {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;
  const [dosDate, dosTime] = dosDateTime();

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    // Local file header
    const lh = new DataView(new ArrayBuffer(30 + nameBytes.length));
    lh.setUint32(0, 0x04034B50, true);  // signature
    lh.setUint16(4, 20, true);           // version needed
    lh.setUint16(6, 0, true);            // flags
    lh.setUint16(8, 0, true);            // compression (stored)
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);           // extra length
    const lhArr = new Uint8Array(lh.buffer);
    nameBytes.forEach((b, i) => lhArr[30 + i] = b);
    parts.push(lhArr);
    parts.push(file.data);

    // Central directory entry
    const cd = new DataView(new ArrayBuffer(46 + nameBytes.length));
    cd.setUint32(0, 0x02014B50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint16(30, 0, true);
    cd.setUint16(32, 0, true);
    cd.setUint16(34, 0, true);
    cd.setUint16(36, 0, true);
    cd.setUint32(38, 0, true);
    cd.setUint32(42, offset, true);
    const cdArr = new Uint8Array(cd.buffer);
    nameBytes.forEach((b, i) => cdArr[46 + i] = b);
    centralDir.push(cdArr);
    offset += lhArr.length + size;
  }

  const cdBytes = centralDir.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; }, new Uint8Array(0));
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054B50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, cdBytes.length, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);

  const allParts = [...parts, cdBytes, new Uint8Array(eocd.buffer)];
  const total = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of allParts) { result.set(p, pos); pos += p.length; }
  return new Blob([result], { type: 'application/zip' });
};

export async function unduhPaketRequest({ selectedRequest, attachments, ccLabel, notify }: ArgPaket): Promise<void> {
  if (!selectedRequest) return;
    notify('info', 'Menyiapkan paket download...');
  try {
    const enc = new TextEncoder();
    const sc = statusConfig[selectedRequest.status] || statusConfig.pending;
    const dateStr = new Date().toISOString().split('T')[0];
    const projectSlug = selectedRequest.project_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const folderName = `FormRequire_${projectSlug}_${dateStr}`;
    const zipFiles: { name: string; data: Uint8Array }[] = [];

    // 1. Form Detail as PDF (HTML  printed to PDF via hidden iframe)
    // We generate it as a styled HTML file the user can open & print-to-PDF
    const sc2 = statusConfig[selectedRequest.status] || statusConfig.pending;
    const formHtml = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>Request Design Project — ${selectedRequest.project_name}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; color: #1e293b; background: #fff; padding: 32px; font-size: 13px; }
.header { background: linear-gradient(135deg,#0d9488,#0f766e); color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
.header h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
.header p { font-size: 11px; opacity: 0.85; }
.section { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
.section-title { background: #f1f5f9; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; border-bottom: 1px solid #e2e8f0; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 14px 16px; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-1 { grid-template-columns: 1fr; }
.field label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; }
.field p { font-size: 13px; font-weight: 600; color: #1e293b; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 16px; }
.chip { background: #f0fdf4; color: #065f46; border: 1px solid #6ee7b7; border-radius: 999px; padding: 3px 10px; font-size: 11px; font-weight: 600; }
.chip.no { background: #f8fafc; color: #64748b; border-color: #cbd5e1; }
.status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #065f46; border: 1px solid #6ee7b7; }
@media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
<h1>🏗️ Form Equipment Request — IVP</h1>
<p>Dicetak: ${new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })} &nbsp;|&nbsp; <span class="status-badge" style="background:rgba(255,255,255,0.2);color:white;border-color:rgba(255,255,255,0.92)">${sc2.label}</span></p>
</div>

<div class="section">
<div class="section-title">📁 Informasi Project</div>
<div class="grid">
  <div class="field"><label>Nama Project</label><p>${selectedRequest.project_name}</p></div>
  <div class="field"><label>Nama Ruangan</label><p>${selectedRequest.room_name || '—'}</p></div>
  <div class="field"><label>Lokasi Project</label><p>${selectedRequest.project_location || '—'}</p></div>
  <div class="field"><label>Sales / Account</label><p>${selectedRequest.sales_name || '—'}</p></div>
  <div class="field"><label>Divisi Sales</label><p>${selectedRequest.sales_division || '—'}</p></div>
  <div class="field"><label>Requester</label><p>${selectedRequest.requester_name}</p></div>
  ${selectedRequest.assign_name ? `<div class="field"><label>PTS Handler</label><p>${selectedRequest.assign_name}</p></div>` : ''}
  ${ccLabel ? `<div class="field"><label>Sales Internal (CC)</label><p>${ccLabel}</p></div>` : ''}
  ${selectedRequest.due_date ? `<div class="field"><label>Target Selesai</label><p>${formatDueDate(selectedRequest.due_date)}</p></div>` : ''}
  ${selectedRequest.approved_by ? `<div class="field"><label>Approved By</label><p>${selectedRequest.approved_by}</p></div>` : ''}
</div>
</div>

<div class="section">
<div class="section-title">🎯 Kategori Kebutuhan & Solution</div>
<div class="chips">
  ${[...(selectedRequest.kebutuhan||[]),selectedRequest.kebutuhan_other].filter(Boolean).map(i=>`<span class="chip">${i}</span>`).join('')||'<span class="chip no">—</span>'}
  ${[...(selectedRequest.solution_product||[]),selectedRequest.solution_other].filter(Boolean).map(i=>`<span class="chip">${i}</span>`).join('')||''}
</div>
${(selectedRequest.kebutuhan||[]).includes('Signage') ? `
<div class="chips" style="padding-top:0">
  ${(selectedRequest.layout_signage||[]).map(i=>`<span class="chip" style="background:#eff6ff;color:#1e40af;border-color:#93c5fd">${i}</span>`).join('')}
  ${(selectedRequest.jaringan_cms||[]).map(i=>`<span class="chip" style="background:#f0fdfa;color:#0f766e;border-color:#5eead4">${i}</span>`).join('')}
</div>
<div class="grid grid-2" style="padding-top:0">
  <div class="field"><label>Jumlah Input</label><p>${selectedRequest.jumlah_input||'—'}</p></div>
  <div class="field"><label>Jumlah Output</label><p>${selectedRequest.jumlah_output||'—'}</p></div>
</div>` : ''}
</div>

<div class="section">
<div class="section-title">🔌 Source & Peripheral</div>
<div class="chips">${[...(selectedRequest.source||[]),selectedRequest.source_other].filter(Boolean).map(i=>`<span class="chip">${i}</span>`).join('')||'<span class="chip no">—</span>'}</div>
<div class="grid">
  <div class="field"><label>Camera Conference</label><p>${selectedRequest.camera_conference === 'Yes' ? `Ya — ${selectedRequest.camera_jumlah||''} unit (${selectedRequest.camera_tracking?.join(', ')||''})` : 'Tidak'}</p></div>
  <div class="field"><label>Audio System</label><p>${selectedRequest.audio_system === 'Yes' ? `Ya — ${selectedRequest.audio_mixer||''} | ${selectedRequest.audio_detail?.join(', ')||''}` : 'Tidak'}</p></div>
  <div class="field"><label>Wallplate Input</label><p>${selectedRequest.wallplate_input === 'Yes' ? `Ya — ${selectedRequest.wallplate_jumlah||''} unit` : 'Tidak'}</p></div>
  <div class="field"><label>Tabletop Input</label><p>${selectedRequest.tabletop_input === 'Yes' ? `Ya — ${selectedRequest.tabletop_jumlah||''} unit` : 'Tidak'}</p></div>
  <div class="field"><label>Wireless Presentation</label><p>${selectedRequest.wireless_presentation === 'Yes' ? `Ya — ${selectedRequest.wireless_mode?.join(', ')||''}, Dongle: ${selectedRequest.wireless_dongle}` : 'Tidak'}</p></div>
  <div class="field"><label>Controller / Automation</label><p>${selectedRequest.controller_automation === 'Yes' ? `Ya — ${selectedRequest.controller_type?.join(', ')||''}` : 'Tidak'}</p></div>
</div>
</div>

<div class="section">
<div class="section-title">📐 Ruangan & Keterangan</div>
<div class="grid grid-2">
  <div class="field"><label>Ukuran Ruangan</label><p>${selectedRequest.ukuran_ruangan||'—'}</p></div>
  <div class="field"><label>Suggest Tampilan</label><p>${selectedRequest.suggest_tampilan||'—'}</p></div>
  ${selectedRequest.keterangan_lain ? `<div class="field" style="grid-column:span 2"><label>Keterangan Lain</label><p style="white-space:pre-wrap">${selectedRequest.keterangan_lain}</p></div>` : ''}
</div>
</div>
<p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:16px">Request Design Project — IndoVisual Pratama · ${new Date().toLocaleDateString('id-ID')}</p>
</body></html>`;
    zipFiles.push({ name: `${folderName}/01_Form_Detail_${projectSlug}.html`, data: enc.encode(formHtml) });

    // 2-4. Download LATEST revision per structured category (SLD/BOQ/3D) + all general
    const structuredCats: { cat: 'sld' | 'boq' | 'design3d'; prefix: string }[] = [
      { cat: 'sld', prefix: '02_SLD' },
      { cat: 'boq', prefix: '03_BOQ' },
      { cat: 'design3d', prefix: '04_Design3D' },
    ];

    for (const { cat, prefix } of structuredCats) {
      // Sort by revision_version desc, take only the latest
      const catFiles = attachments
        .filter(a => a.attachment_category === cat)
        .sort((a, b) => (b.revision_version || 0) - (a.revision_version || 0));
      const latest = catFiles[0];
      if (!latest) continue;
      try {
        const resp = await fetch(latest.file_url);
        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer();
          const revStr = latest.revision_version ? `_Rev${latest.revision_version}` : '';
          zipFiles.push({
            name: `${folderName}/${prefix}${revStr}_${latest.file_name}`,
            data: new Uint8Array(arrayBuf),
          });
        }
      } catch { /* skip inaccessible files */ }
    }

    // General files - download all
    const generalFiles = attachments.filter(a => a.attachment_category === 'general' || !a.attachment_category);
    for (let i = 0; i < generalFiles.length; i++) {
      const att = generalFiles[i];
      try {
        const resp = await fetch(att.file_url);
        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer();
          zipFiles.push({
            name: `${folderName}/05_Files_${i + 1}_${att.file_name}`,
            data: new Uint8Array(arrayBuf),
          });
        }
      } catch { /* skip inaccessible files */ }
    }

    if (zipFiles.length === 0) {
      notify('info', 'Tidak ada file untuk di-download pada ticket ini.');
      return;
    }

    const zipBlob = buildZip(zipFiles);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('success', `✅ "${folderName}.zip" berhasil didownload! (${zipFiles.length} file)`);
  } catch {
    notify('error', 'Gagal membuat paket download.');
  }
}
