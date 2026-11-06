import type { Benda } from './tipe';
import { PERANGKAT_RAK, isiRakBawaan, type PerangkatRak } from '@/lib/av/perangkat-rak';

export { PERANGKAT_RAK, JENIS_RAK, isiRakBawaan, bersihkanIsiRak, type JenisPerangkatRak, type PerangkatRak } from '@/lib/av/perangkat-rak';

export const uRak = (b: Pick<Benda, 'rakU'>) => Math.max(4, b.rakU ?? 20);
export const isiRakDari = (b: Pick<Benda, 'rakU' | 'isiRak'>): PerangkatRak[] => (b.isiRak?.length ? b.isiRak : isiRakBawaan(uRak(b)));

export function susunRak(b: Pick<Benda, 'rakU' | 'isiRak'>) {
  const U = uRak(b);
  let atas = U;
  const posisi: { p: PerangkatRak; uAtas: number; uBawah: number; muat: boolean }[] = [];
  for (const p of isiRakDari(b)) {
    const u = Math.max(1, Math.round(p.u));
    posisi.push({ p: { ...p, u }, uAtas: atas, uBawah: atas - u + 1, muat: atas - u + 1 >= 1 });
    atas -= u;
  }
  const terpakai = U - Math.max(0, atas);
  return { U, posisi, terpakai: Math.min(U, terpakai), sisa: Math.max(0, atas), lewat: Math.max(0, -atas) };
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function svgElevasiRak(b: Pick<Benda, 'rakU' | 'isiRak' | 'nama'>, judul = true): string {
  const s = susunRak(b);
  const tU = s.U > 32 ? 14 : 18, lebar = 300, ox = 36, oy = judul ? 34 : 10;
  const H = s.U * tU, W = ox + lebar + 40;
  const huruf = 'font-family="Segoe UI,Arial"';
  const out: string[] = [`<rect width="${W}" height="${oy + H + 30}" fill="#ffffff"/>`];
  if (judul) out.push(`<text x="${ox}" y="20" font-size="13" font-weight="700" fill="#0f172a" ${huruf}>${esc(b.nama)} · ${s.U}U · terpakai ${s.terpakai}U</text>`);
  out.push(`<rect x="${ox - 8}" y="${oy - 4}" width="${lebar + 16}" height="${H + 8}" rx="3" fill="#111827"/>`);
  for (let i = 0; i < s.U; i++) {
    const y = oy + i * tU;
    out.push(`<rect x="${ox}" y="${y}" width="${lebar}" height="${tU}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5"/>`);
    out.push(`<text x="${ox - 12}" y="${y + tU * 0.7}" font-size="${tU * 0.5}" text-anchor="end" fill="#64748b" ${huruf}>${s.U - i}</text>`);
  }
  for (const { p, uAtas, uBawah, muat } of s.posisi) {
    if (!muat && uAtas < 1) continue;
    const bawah = Math.max(1, uBawah);
    const y = oy + (s.U - uAtas) * tU, h = (uAtas - bawah + 1) * tU;
    const spek = PERANGKAT_RAK[p.jenis];
    const kosong = p.jenis === 'kosong';
    out.push(`<rect x="${ox + 1}" y="${y + 1}" width="${lebar - 2}" height="${h - 2}" rx="2" fill="${spek.warna}" ${kosong ? 'stroke="#94a3b8" stroke-dasharray="3 2"' : ''}/>`);
    out.push(`<text x="${ox + 10}" y="${y + h / 2 + tU * 0.2}" font-size="${Math.min(12, tU * 0.62)}" font-weight="600" fill="${kosong ? '#64748b' : '#ffffff'}" ${huruf}>${esc(p.nama)}</text>`);
    out.push(`<text x="${ox + lebar - 8}" y="${y + h / 2 + tU * 0.2}" font-size="${Math.min(11, tU * 0.55)}" text-anchor="end" fill="${kosong ? '#64748b' : '#e2e8f0'}" ${huruf}>${p.u}U</text>`);
    if (!muat) out.push(`<rect x="${ox + 1}" y="${y + 1}" width="${lebar - 2}" height="${h - 2}" fill="none" stroke="#dc2626" stroke-width="2"/>`);
  }
  out.push(`<text x="${ox}" y="${oy + H + 20}" font-size="11" fill="${s.lewat ? '#b91c1c' : '#475569'}" ${huruf}>${s.lewat ? `Melebihi kapasitas ${s.lewat}U - kurangi perangkat atau pilih rack lebih tinggi` : `Sisa ${s.sisa}U kosong`}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${oy + H + 30}" viewBox="0 0 ${W} ${oy + H + 30}" style="max-width:100%;height:auto">${out.join('')}</svg>`;
}
