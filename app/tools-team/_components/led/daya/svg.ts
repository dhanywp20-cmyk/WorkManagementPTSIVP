/** Gambar SVG Power Connection (diagram & poster cetak/PNG). */
import { esc } from '../../bersama/cetak';
import { f } from '../../bersama/ui';
import { warnaPort } from '../koneksi/data';
import { type DataDaya, type PengaturanDaya, susunDaya, WARNA_FASE } from './data';
import { teksCara } from './teks';
import type { HasilDayaLED } from '@/lib/av-hitung';

/** Diagram sirkuit power (SVG mandiri) untuk layar, cetak, dan unduhan. */
export function svgDaya(d: DataDaya, h: HasilDayaLED, arah: 'horizontal' | 'vertikal', judul?: string): string {
  const lebarM = (d.kolom * d.wUnit) / 1000, tinggiM = (d.baris * d.hUnit) / 1000;
  const skala = Math.min(860 / Math.max(0.01, lebarM), 430 / Math.max(0.01, tinggiM));
  const W = lebarM * skala, H = tinggiM * skala, cw = W / d.kolom, ch = H / d.baris;
  const ox = 52, oy = judul ? 52 : 30;
  const n = (v: number) => Math.round(v * 10) / 10;
  const pusat = (c: number, r: number) => [ox + (c + 0.5) * cw, oy + (r + 0.5) * ch];
  const selMin = Math.min(cw, ch);
  const banyak = d.kolom * d.baris > 2500;
  const out: string[] = [];
  const noSirkuit = new Map<string, number>();
  for (const s of h.hasil.sel) noSirkuit.set(`${s.c},${s.r}`, s.port);
  for (let r = 0; r < d.baris; r++) for (let c = 0; c < d.kolom; c++) {
    const no = noSirkuit.get(`${c},${r}`);
    out.push(`<rect x="${n(ox + c * cw)}" y="${n(oy + r * ch)}" width="${n(cw)}" height="${n(ch)}" fill="${no ? warnaPort(no) : '#fff'}" fill-opacity="0.17" stroke="#94a3b8" stroke-width="${banyak ? 0.2 : 0.6}"/>`);
  }
  out.push(`<rect x="${ox}" y="${oy}" width="${n(W)}" height="${n(H)}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`);
  if (!banyak) {
    const perSirkuit = new Map<number, number[][]>();
    for (const s of h.hasil.sel) { const a = perSirkuit.get(s.port) ?? []; a.push(pusat(s.c, s.r)); perSirkuit.set(s.port, a); }
    perSirkuit.forEach((titik, no) => {
      if (titik.length > 1) out.push(`<polyline points="${titik.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${warnaPort(no)}" stroke-width="${n(Math.max(1, Math.min(2.5, selMin * 0.06)))}" stroke-linejoin="round" stroke-opacity="0.85"/>`);
    });
  }
  //  Titik masuk tiap sirkuit: label sirkuit + fase di tepi terdekat.
  for (const s of h.sirkuit) {
    if (!s.mulai) continue;
    const m = s.mulai, [cx, cy] = pusat(m.c, m.r), warna = warnaPort(s.no);
    //  Seri jarak: sisi searah kabel didahulukan (kabel tegak masuk dari atas/bawah).
    const searah = (sisi: string) => ((sisi === 'atas' || sisi === 'bawah') === (arah === 'vertikal') ? 1 : 0);
    const jarak = [{ sisi: 'kiri', v: m.c }, { sisi: 'kanan', v: d.kolom - 1 - m.c }, { sisi: 'atas', v: m.r }, { sisi: 'bawah', v: d.baris - 1 - m.r }]
      .sort((a, b) => a.v - b.v || searah(b.sisi) - searah(a.sisi));
    const teks = `C${s.no} · ${s.fase}`, lw = 10 + teks.length * 6, lh = 15;
    out.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.max(2.5, Math.min(6, selMin * 0.16)))}" fill="${warna}" stroke="#fff" stroke-width="1.2"/>`);
    const sisi = jarak[0].v === 0 ? jarak[0].sisi : 'dalam';
    const [lx, ly] = sisi === 'kiri' ? [ox - lw - 6, cy - lh / 2] : sisi === 'kanan' ? [ox + W + 6, cy - lh / 2]
      : sisi === 'atas' ? [cx - lw / 2, oy - lh - 5] : sisi === 'bawah' ? [cx - lw / 2, oy + H + 5] : [cx - lw / 2, cy + 4];
    if (sisi !== 'dalam') {
      const [ex, ey] = sisi === 'kiri' ? [ox, cy] : sisi === 'kanan' ? [ox + W, cy] : sisi === 'atas' ? [cx, oy] : [cx, oy + H];
      out.push(`<line x1="${n(lx + (sisi === 'kiri' ? lw : sisi === 'kanan' ? 0 : lw / 2))}" y1="${n(ly + (sisi === 'atas' ? lh : sisi === 'bawah' ? 0 : lh / 2))}" x2="${n(ex)}" y2="${n(ey)}" stroke="${warna}" stroke-width="1.6"/>`);
    }
    out.push(`<rect x="${n(lx)}" y="${n(ly)}" width="${n(lw)}" height="${lh}" rx="4" fill="${warna}"/>`);
    out.push(`<rect x="${n(lx + lw - 5)}" y="${n(ly)}" width="5" height="${lh}" rx="2" fill="${WARNA_FASE[s.fase] ?? '#334155'}"/>`);
    out.push(`<text x="${n(lx + (lw - 4) / 2)}" y="${n(ly + 11)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${esc(teks)}</text>`);
  }
  const fm = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  out.push(`<text x="${n(ox + W / 2)}" y="${n(oy + H + 36)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial">${fm(lebarM)} m · ${d.kolom} ${d.satuan}</text>`);
  out.push(`<text x="${n(ox - 34)}" y="${n(oy + H / 2)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial" transform="rotate(-90 ${n(ox - 34)} ${n(oy + H / 2)})">${fm(tinggiM)} m · ${d.baris} baris</text>`);
  if (judul) out.push(`<text x="${ox}" y="20" font-size="13" font-weight="700" fill="#0f172a" font-family="Segoe UI,Arial">${esc(judul)}</text>`);
  const lebar = n(W + ox + 80), tinggi = n(H + oy + 48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}" viewBox="0 0 ${lebar} ${tinggi}" style="max-width:100%;height:auto">${out.join('')}</svg>`;
}

/** Gambar siap kirim: judul, ringkasan, diagram, legenda fase & sirkuit. */
export function svgPosterDaya(d: DataDaya, s: PengaturanDaya, judul: string, sub: string): string {
  const h = susunDaya(d, s);
  const diagram = svgDaya(d, h, s.arah);
  const dw = Number(/\swidth="([\d.]+)"/.exec(diagram)?.[1] ?? 800), dh = Number(/\sheight="([\d.]+)"/.exec(diagram)?.[1] ?? 400);
  const W = Math.max(dw, 820) + 40;
  const baris = [...h.perFase.map(p => ({ warna: WARNA_FASE[p.fase], teks: `Fase ${p.fase}: ${p.sirkuit} sirkuit · ${f(p.watt / 1000)} kW · ${f(p.arus, 1)} A · MCB utama ${p.mcb} A` })),
    ...h.sirkuit.map(c => ({ warna: warnaPort(c.no), teks: `C${c.no} (${c.fase}) · ${c.unit} ${d.satuan} · ${f(c.watt, 0)} W · ${f(c.arus, 1)} A` }))];
  const kolom = baris.length > 24 ? 3 : baris.length > 8 ? 2 : 1, per = Math.ceil(baris.length / kolom), lk = (W - 40) / kolom;
  const yD = 92, yL = yD + dh + 16, H = yL + 30 + per * 19 + 34;
  const huruf = 'font-family="Segoe UI,Arial"';
  const legenda = baris.map((b, i) => {
    const x = 20 + Math.floor(i / per) * lk, y = yL + 30 + (i % per) * 19;
    return `<rect x="${x}" y="${y - 10}" width="11" height="11" rx="2" fill="${b.warna}"/><text x="${x + 17}" y="${y}" font-size="11.5" fill="#1e293b" ${huruf}>${esc(b.teks)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="0" y="0" width="${W}" height="62" fill="#b45309"/>
<text x="20" y="28" font-size="18" font-weight="800" fill="#ffffff" ${huruf}>${esc(judul)}</text>
<text x="20" y="48" font-size="12" fill="#fef3c7" ${huruf}>${esc(sub)}</text>
<text x="20" y="80" font-size="12" font-weight="600" fill="#334155" ${huruf}>${esc(`${h.sirkuit.length} sirkuit · total ${f(h.totalW / 1000)} kW maks · ${teksCara(s)}`)}</text>
${diagram.replace(/ style="[^"]*"/, '').replace('<svg ', `<svg x="${Math.round((W - dw) / 2)}" y="${yD}" `)}
<text x="20" y="${yL + 12}" font-size="11" font-weight="800" fill="#92400e" letter-spacing="0.6" ${huruf}>FASE &amp; SIRKUIT</text>
${legenda}
<text x="20" y="${H - 12}" font-size="10" fill="#94a3b8" ${huruf}>IndoVisual Professional Tools — Tools Team · angka daya = maksimum (putih penuh); verifikasi dengan datasheet &amp; instalatir listrik</text>
</svg>`;
}
