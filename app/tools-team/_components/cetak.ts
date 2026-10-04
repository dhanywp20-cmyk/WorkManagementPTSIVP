/**
 * Lembar cetak Tools Team (Kalkulator LED, Desain 3D).
 *
 * Mengikuti pola cetak Request Design Project (form-require-project/
 * _components/cetak-request.ts): dokumen A4 tersendiri yang ditulis ke
 * jendela baru lalu dicetak - BUKAN window.print() halaman, yang mencetak
 * tampilan web apa adanya (tombol, sidebar, latar foto, ukuran tidak
 * proporsional). window.open('') + document.write juga dijembatani oleh
 * aplikasi Android (res/raw/sisip.js -> cetakHtml), jadi berjalan di HP.
 *
 * Semua teks dari pengguna (nama project, customer, nama benda) di-escape.
 */

export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface Info { label: string; nilai: string; sorot?: boolean }

export type Seksi =
  | { judul: string; jenis: 'info'; kiri: Info[]; kanan?: Info[] }
  | { judul: string; jenis: 'tabel'; kepala: string[]; isi: string[][]; rataKanan?: number[] }
  | { judul: string; jenis: 'html'; html: string };

export interface Lembar {
  /** Judul dokumen, mis. "Kalkulator LED Videotron". */ judul: string;
  /** Baris kecil di bawah judul, mis. nama project. */ subjudul: string;
  /** Pasangan label-nilai di sisi kanan header. */ kepala: [string, string][];
  seksi: Seksi[];
  catatan?: string;
  /** Label kolom tanda tangan di bagian bawah, mis. ['Dibuat oleh', 'Diperiksa']. */ tandaTangan?: { label: string; nama?: string }[];
}

const kotakInfo = (i: Info) =>
  `<div class="info-box"><div class="info-label">${esc(i.label)}</div><div class="info-value${i.sorot ? ' sorot' : ''}">${esc(i.nilai || '—')}</div></div>`;

function seksiHtml(s: Seksi): string {
  const isi = s.jenis === 'info'
    ? (s.kanan?.length
      ? `<div class="grid2"><div>${s.kiri.map(kotakInfo).join('')}</div><div>${s.kanan.map(kotakInfo).join('')}</div></div>`
      : s.kiri.map(kotakInfo).join(''))
    : s.jenis === 'tabel'
      ? `<table><thead><tr>${s.kepala.map((k, i) => `<th${s.rataKanan?.includes(i) ? ' class="r"' : ''}>${esc(k)}</th>`).join('')}</tr></thead>
         <tbody>${s.isi.map(r => `<tr>${r.map((c, i) => `<td${s.rataKanan?.includes(i) ? ' class="r"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : s.html;
  return `<div class="section"><div class="section-title">${esc(s.judul)}</div>${isi}</div>`;
}

export function bukaCetak(l: Lembar): void {
  const dicetak = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<title>${esc(l.judul)} — ${esc(l.subjudul)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 12mm; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 12.5px; }
.page { padding: 24px 28px; max-width: 940px; margin: 0 auto; }
.header { background: linear-gradient(135deg,#1d4ed8,#1e3a8a); color: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 18px;
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.header h1 { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
.header p { font-size: 11.5px; opacity: .88; }
.header-right { text-align: right; font-size: 11px; opacity: .9; line-height: 1.75; white-space: nowrap; }
.section { border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
.section-title { background: #eff6ff; color: #1e3a8a; padding: 8px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; border-bottom: 1px solid #dbeafe; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; }
.grid2 > div:first-child { border-right: 1px solid #e2e8f0; }
.info-box { padding: 9px 14px; border-bottom: 1px solid #e2e8f0; }
.info-box:last-child { border-bottom: none; }
.info-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; margin-bottom: 2px; }
.info-value { font-size: 12.5px; font-weight: 600; color: #1e293b; line-height: 1.45; }
.info-value.sorot { font-size: 15px; font-weight: 800; color: #1d4ed8; }
table { width: 100%; border-collapse: collapse; }
th { background: #f8fafc; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }
td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
tr:last-child td { border-bottom: none; }
.r { text-align: right; }
.gambar { padding: 12px; display: grid; gap: 10px; }
.gambar.dua { grid-template-columns: 1fr 1fr; }
.gambar figure { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.gambar img { width: 100%; display: block; }
.gambar figcaption { font-size: 10.5px; color: #64748b; padding: 5px 8px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
.diagram { padding: 14px; text-align: center; }
.baik { color: #047857; font-weight: 700; } .buruk { color: #b91c1c; font-weight: 700; }
.catatan { font-size: 10.5px; color: #64748b; line-height: 1.6; margin: 4px 2px 0; }
.ttd { display: flex; gap: 48px; margin-top: 36px; page-break-inside: avoid; }
.ttd div { flex: 0 0 200px; border-top: 1.5px solid #334155; padding-top: 8px; }
.ttd .l { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
.ttd .n { margin-top: 6px; font-size: 12.5px; font-weight: 800; color: #1e3a8a; min-height: 16px; }
.footer { margin-top: 18px; padding-top: 10px; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
@media print { .page { padding: 0; } }
</style></head>
<body><div class="page">
<div class="header">
  <div><h1>${esc(l.judul)}</h1><p>${esc(l.subjudul)}</p></div>
  <div class="header-right">${[['Dicetak', dicetak], ...l.kepala].filter(([, v]) => v).map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div>
</div>
${l.seksi.map(seksiHtml).join('\n')}
${l.catatan ? `<p class="catatan">${esc(l.catatan)}</p>` : ''}
${l.tandaTangan?.length ? `<div class="ttd">${l.tandaTangan.map(t => `<div><div class="l">${esc(t.label)}</div><div class="n">${esc(t.nama ?? '')}</div></div>`).join('')}</div>` : ''}
<div class="footer"><div>IndoVisual Professional Tools — Tools Team</div><div>Dicetak: ${esc(dicetak)}</div></div>
</div></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

/** Diagram susunan cabinet/modul (SVG) dengan proporsi sebenarnya + label ukuran. */
export function diagramSusunan(kolom: number, baris: number, lebarM: number, tinggiM: number, satuan: string): string {
  const maksW = 480, maksH = 170;
  const skala = Math.min(maksW / Math.max(0.01, lebarM), maksH / Math.max(0.01, tinggiM));
  const w = lebarM * skala, h = tinggiM * skala, ox = 40, oy = 16;
  const garis: string[] = [];
  const tebal = kolom * baris > 600 ? 0.4 : 0.8;
  if (kolom <= 80) for (let i = 1; i < kolom; i++) garis.push(`<line x1="${ox + (i * w) / kolom}" y1="${oy}" x2="${ox + (i * w) / kolom}" y2="${oy + h}" />`);
  if (baris <= 80) for (let i = 1; i < baris; i++) garis.push(`<line x1="${ox}" y1="${oy + (i * h) / baris}" x2="${ox + w}" y2="${oy + (i * h) / baris}" />`);
  const fm = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  return `<div class="diagram"><svg xmlns="http://www.w3.org/2000/svg" width="${w + 80}" height="${h + 56}" viewBox="0 0 ${w + 80} ${h + 56}" style="max-width:100%;height:auto">
  <rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="#0f172a" stroke="#1d4ed8" stroke-width="1.5" rx="2"/>
  <g stroke="#334155" stroke-width="${tebal}">${garis.join('')}</g>
  <text x="${ox + w / 2}" y="${oy + h + 18}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial">${fm(lebarM)} m · ${kolom} ${esc(satuan)}</text>
  <text x="${ox - 8}" y="${oy + h / 2}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial" transform="rotate(-90 ${ox - 8} ${oy + h / 2})">${fm(tinggiM)} m · ${baris} ${esc(satuan)}</text>
</svg></div>`;
}
