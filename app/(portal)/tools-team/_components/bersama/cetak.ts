/**
 * Lembar cetak Tools Team - bagian umumnya kini di lib/lembar-cetak.ts (dipakai seluruh platform);
 * di sini tinggal yang khusus Tools Team.
 */
import { esc } from '@/lib/lembar-cetak';

export * from '@/lib/lembar-cetak';

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
