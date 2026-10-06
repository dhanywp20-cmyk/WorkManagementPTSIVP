/**
 * Rack elevation: isi rack 19" per U (urutan dari atas). Dipakai tekstur isi rack 3D,
 * diagram elevation (SVG) di panel, lembar cetak, dan PNG. Murni - tanpa three.js / React.
 */
import type { Benda } from './tipe';

export type JenisPerangkatRak =
  | 'patch' | 'kabel' | 'switch' | 'server' | 'nas' | 'amp' | 'dsp' | 'matrix' | 'codec' | 'pdu' | 'shelf' | 'ups' | 'kosong';
export interface PerangkatRak { jenis: JenisPerangkatRak; u: number; nama: string }

export const PERANGKAT_RAK: Record<JenisPerangkatRak, { label: string; u: number; warna: string }> = {
  patch: { label: 'Patch panel 24 port', u: 1, warna: '#334155' },
  kabel: { label: 'Cable manager', u: 1, warna: '#1f2937' },
  switch: { label: 'Network switch 24 port', u: 1, warna: '#1e3a8a' },
  server: { label: 'Server / PC', u: 2, warna: '#64748b' },
  nas: { label: 'NAS / recorder', u: 2, warna: '#475569' },
  amp: { label: 'Power amplifier', u: 2, warna: '#7c2d12' },
  dsp: { label: 'DSP audio', u: 1, warna: '#0e7490' },
  matrix: { label: 'Matrix switcher', u: 2, warna: '#4338ca' },
  codec: { label: 'Codec video conference', u: 1, warna: '#0f766e' },
  pdu: { label: 'PDU', u: 1, warna: '#991b1b' },
  shelf: { label: 'Shelf / rak tray', u: 1, warna: '#57534e' },
  ups: { label: 'UPS', u: 3, warna: '#166534' },
  kosong: { label: 'Blank panel', u: 1, warna: '#e2e8f0' },
};
export const JENIS_RAK = Object.keys(PERANGKAT_RAK) as JenisPerangkatRak[];

/** Isi bawaan (sama dengan gambar rack sebelum ada rack elevation): jaringan di atas, UPS di bawah. */
export function isiRakBawaan(U: number): PerangkatRak[] {
  const urutan: [JenisPerangkatRak, number][] = [['patch', 1], ['kabel', 1], ['switch', 1], ['patch', 1], ['switch', 1], ['kosong', 1], ['server', 2], ['server', 2], ['nas', 2],
    ['kosong', 1], ['amp', 2], ['dsp', 1], ['matrix', 2], ['kosong', 1], ['amp', 2], ['server', 2], ['kosong', 2]];
  const ups = Math.min(3, Math.max(0, U - 6));
  const hasil: PerangkatRak[] = [];
  let y = 0, i = 0;
  while (y < U - ups) {
    const [jenis, tinggi] = urutan[i % urutan.length]; i++;
    const t = Math.min(tinggi, U - ups - y);
    hasil.push({ jenis, u: t, nama: PERANGKAT_RAK[jenis].label });
    y += t;
  }
  if (ups) hasil.push({ jenis: 'ups', u: ups, nama: 'UPS' });
  return hasil;
}

export const uRak = (b: Pick<Benda, 'rakU'>) => Math.max(4, b.rakU ?? 20);
export const isiRakDari = (b: Pick<Benda, 'rakU' | 'isiRak'>): PerangkatRak[] => (b.isiRak?.length ? b.isiRak : isiRakBawaan(uRak(b)));

/** Posisi tiap perangkat: U teratas & terbawah (U1 = paling bawah), sisa U kosong, dan yang tidak muat. */
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

/** Bersihkan isi rack dari data tersimpan / template (jenis dikenal, 1-12 U, nama <= 60 huruf, maks 60 baris). */
export function bersihkanIsiRak(x: unknown): PerangkatRak[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const hasil = x.slice(0, 60).flatMap(v => {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    if (!JENIS_RAK.includes(o.jenis as JenisPerangkatRak)) return [];
    const u = typeof o.u === 'number' && Number.isFinite(o.u) ? Math.min(12, Math.max(1, Math.round(o.u))) : 1;
    const nama = typeof o.nama === 'string' ? o.nama.trim().slice(0, 60) : '';
    return [{ jenis: o.jenis as JenisPerangkatRak, u, nama: nama || PERANGKAT_RAK[o.jenis as JenisPerangkatRak].label }];
  });
  return hasil.length ? hasil : undefined;
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Diagram rack elevation (tampak depan) - SVG mandiri untuk panel, cetak, dan PNG. */
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
