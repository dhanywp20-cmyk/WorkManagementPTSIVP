/** Gambar SVG Screen Connection (diagram interaktif & poster cetak/PNG). */
import { esc } from '../../bersama/cetak';
import { f } from '../../bersama/ui';
import { type DataKoneksi, kunci, namaCadangan, namaPort, type PengaturanKoneksi, type Susunan, susunKoneksi, warnaPort } from './data';
import { teksCadangan, teksCara } from './teks';

/** Diagram koneksi (SVG mandiri) - dipakai di layar (interaktif), cetak, dan unduhan. */
export function svgKoneksi(d: DataKoneksi, t: Susunan, o: { judul?: string; interaktif?: boolean; portAktif?: number } = {}): string {
  const skala = Math.min(860 / Math.max(1, t.resX), 430 / Math.max(1, t.resY));
  const W = t.resX * skala, H = t.resY * skala;
  const ox = 52, oy = o.judul ? 52 : 30;
  const xs = [ox], ys = [oy];
  t.lebar.forEach(w => xs.push(xs[xs.length - 1] + w * skala));
  t.tinggi.forEach(h => ys.push(ys[ys.length - 1] + h * skala));
  const pusat = (c: number, r: number) => [(xs[c] + xs[c + 1]) / 2, (ys[r] + ys[r + 1]) / 2];
  let selMin = Infinity;
  for (let i = 0; i < t.K; i++) selMin = Math.min(selMin, xs[i + 1] - xs[i]);
  for (let i = 0; i < t.B; i++) selMin = Math.min(selMin, ys[i + 1] - ys[i]);
  const banyak = t.K * t.B > 2500;
  const fs = Math.min(12, selMin * 0.24);
  const n = (v: number) => Math.round(v * 10) / 10;
  const peta = new Map(t.hasil.sel.map(s => [kunci(s.c, s.r), s]));
  const out: string[] = [];
  out.push('<defs><pattern id="arsir-koneksi" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e2e8f0"/><line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" stroke-width="1.6"/></pattern></defs>');
  if (o.interaktif) out.push('<style>.sel{cursor:pointer}.sel:hover{stroke:#1d4ed8;stroke-width:2.5}</style>');
  //  Sel receiving card: warna port, putih = belum tersambung, arsir = kosong (tidak ada receiving card).
  for (let r = 0; r < t.B; r++) for (let c = 0; c < t.K; c++) {
    const k = kunci(c, r), s = peta.get(k);
    const isi = t.kosong.has(k) ? 'fill="url(#arsir-koneksi)"'
      : s ? `fill="${warnaPort(s.port)}" fill-opacity="${o.portAktif === s.port ? 0.32 : 0.17}"` : 'fill="#ffffff"';
    out.push(`<rect x="${n(xs[c])}" y="${n(ys[r])}" width="${n(xs[c + 1] - xs[c])}" height="${n(ys[r + 1] - ys[r])}" ${isi}${o.interaktif ? ` class="sel" data-sel="${k}"` : ''}/>`);
  }
  //  Semua hiasan di atas sel tidak menangkap klik.
  const atas: string[] = [];
  if (!t.custom && (t.rcKol > 1 || t.rcBaris > 1) && d.kolom <= 160 && d.baris <= 160) {
    const tipis: string[] = [];
    for (let i = 1; i < d.kolom; i++) if (i % t.rcKol) { const x = n(ox + i * d.pxX * skala); tipis.push(`<line x1="${x}" y1="${oy}" x2="${x}" y2="${n(oy + H)}"/>`); }
    for (let i = 1; i < d.baris; i++) if (i % t.rcBaris) { const y = n(oy + i * d.pxY * skala); tipis.push(`<line x1="${ox}" y1="${y}" x2="${n(ox + W)}" y2="${y}"/>`); }
    if (tipis.length) atas.push(`<g stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="3 2">${tipis.join('')}</g>`);
  }
  const batas: string[] = [];
  for (let i = 1; i < t.K; i++) batas.push(`<line x1="${n(xs[i])}" y1="${oy}" x2="${n(xs[i])}" y2="${n(oy + H)}"/>`);
  for (let i = 1; i < t.B; i++) batas.push(`<line x1="${ox}" y1="${n(ys[i])}" x2="${n(ox + W)}" y2="${n(ys[i])}"/>`);
  atas.push(`<g stroke="#64748b" stroke-width="${banyak ? 0.3 : 0.8}">${batas.join('')}</g>`);
  atas.push(`<rect x="${ox}" y="${oy}" width="${n(W)}" height="${n(H)}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`);
  //  Belum tersambung (manual): bingkai putus-putus jingga.
  for (const { c, r } of t.hasil.tanpaPort) {
    atas.push(`<rect x="${n(xs[c] + 2)}" y="${n(ys[r] + 2)}" width="${n(xs[c + 1] - xs[c] - 4)}" height="${n(ys[r + 1] - ys[r] - 4)}" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4 3"/>`);
  }
  //  Port aktif (mode manual) dipertegas.
  if (o.portAktif) for (const s of t.hasil.sel) if (s.port === o.portAktif) {
    atas.push(`<rect x="${n(xs[s.c] + 1)}" y="${n(ys[s.r] + 1)}" width="${n(xs[s.c + 1] - xs[s.c] - 2)}" height="${n(ys[s.r + 1] - ys[s.r] - 2)}" fill="none" stroke="${warnaPort(s.port)}" stroke-width="2"/>`);
  }
  //  Rantai kabel per port + panah arah.
  const tebal = Math.max(1, Math.min(2.5, selMin * 0.06));
  const panah = Math.max(2.5, Math.min(6, selMin * 0.13));
  const perPort = new Map<number, number[][]>();
  for (const s of t.hasil.sel) { const a = perPort.get(s.port) ?? []; a.push(pusat(s.c, s.r)); perPort.set(s.port, a); }
  if (!banyak) {
    perPort.forEach((titik, port) => {
      const warna = warnaPort(port);
      if (titik.length > 1) atas.push(`<polyline points="${titik.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${warna}" stroke-width="${n(tebal)}" stroke-linejoin="round" stroke-opacity="0.85"/>`);
      if (selMin >= 12) {
        const seg: string[] = [];
        for (let i = 1; i < titik.length; i++) {
          const [x0, y0] = titik[i - 1], [x1, y1] = titik[i];
          const pj = Math.hypot(x1 - x0, y1 - y0); if (pj < 1) continue;
          const ux = (x1 - x0) / pj, uy = (y1 - y0) / pj, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          const bx = mx - panah * ux, by = my - panah * uy;
          seg.push(`${n(mx + panah * ux)},${n(my + panah * uy)} ${n(bx - 0.8 * panah * uy)},${n(by + 0.8 * panah * ux)} ${n(bx + 0.8 * panah * uy)},${n(by - 0.8 * panah * ux)}`);
        }
        if (seg.length) atas.push(`<g fill="${warna}">${seg.map(p => `<polygon points="${p}"/>`).join('')}</g>`);
      }
    });
  }
  //  Titik masuk tiap port. Di tepi layar: label di luar tepi terdekat (seri: sisi searah kabel didahulukan).
  //  Di tengah layar (zona / isi penuh / manual): label langsung di sel pertama.
  const utama = (sisi: string) => ((sisi === 'kiri' || sisi === 'kanan') === (t.arah === 'horizontal') ? 1 : 0);
  const masuk = t.hasil.port.filter(p => p.mulai).map(p => {
    const m = p.mulai!;
    const jarak = [
      { sisi: 'kiri', v: m.c }, { sisi: 'kanan', v: t.K - 1 - m.c }, { sisi: 'atas', v: m.r }, { sisi: 'bawah', v: t.B - 1 - m.r },
    ].sort((a, b) => a.v - b.v || utama(b.sisi) - utama(a.sisi));
    return { p, m, sisi: jarak[0].v === 0 ? jarak[0].sisi : null };
  });
  const diSel = new Set(masuk.filter(x => !x.sisi).map(x => x.p.port));
  const adaLabel = !banyak && fs >= 5.5;
  if (adaLabel) {
    const lbl: string[] = [];
    for (const s of t.hasil.sel) {
      const [x, y] = pusat(s.c, s.r);
      if (!(s.urut === 1 && diSel.has(s.port))) lbl.push(`<text x="${n(x)}" y="${n(y - fs * 0.55)}">${s.port}-${s.urut}</text>`);
    }
    atas.push(`<g font-size="${n(fs)}" font-weight="700" text-anchor="middle" fill="#0f172a" font-family="Segoe UI,Arial" paint-order="stroke" stroke="#ffffff" stroke-width="2.4">${lbl.join('')}</g>`);
    //  Ukuran receiving card (px) bila sel cukup besar - seperti tampilan NovaLCT.
    const kecil = Math.max(6, fs * 0.78), ukur: string[] = [];
    for (let r = 0; r < t.B; r++) for (let c = 0; c < t.K; c++) {
      const w = xs[c + 1] - xs[c], h = ys[r + 1] - ys[r];
      if (t.kosong.has(kunci(c, r)) || w < kecil * 5.2 || h < fs * 3.4) continue;
      const [x, y] = pusat(c, r);
      ukur.push(`<text x="${n(x)}" y="${n(y + h * 0.36)}">${t.lebar[c]}×${t.tinggi[r]}</text>`);
    }
    if (ukur.length) atas.push(`<g font-size="${n(kecil)}" text-anchor="middle" fill="#475569" font-family="Segoe UI,Arial">${ukur.join('')}</g>`);
  }
  for (const { p, m, sisi } of masuk) {
    const warna = warnaPort(p.port);
    const [cx, cy] = pusat(m.c, m.r);
    const r = Math.max(3, Math.min(7, selMin * 0.16));
    atas.push(`<circle cx="${n(cx)}" cy="${n(cy + (adaLabel ? r * 0.9 : 0))}" r="${n(r)}" fill="${warna}" stroke="#fff" stroke-width="1.2"/>`);
    const teks = `P${p.port}`;
    if (!sisi) {
      const fb = Math.max(6, Math.min(10, fs + 1)), bw = 5 + teks.length * fb * 0.62, bh = fb + 4;
      const by = adaLabel ? cy - fs * 0.55 - fb * 0.85 : cy - bh / 2;
      atas.push(`<rect x="${n(cx - bw / 2)}" y="${n(by)}" width="${n(bw)}" height="${n(bh)}" rx="3" fill="${warna}" stroke="#fff" stroke-width="1"/>`);
      atas.push(`<text x="${n(cx)}" y="${n(by + bh - 3)}" font-size="${n(fb)}" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${teks}</text>`);
      continue;
    }
    const lw = 8 + teks.length * 6.4, lh = 15;
    const [lx, ly] = sisi === 'kiri' ? [ox - lw - 6, cy - lh / 2] : sisi === 'kanan' ? [ox + W + 6, cy - lh / 2]
      : sisi === 'atas' ? [cx - lw / 2, oy - lh - 5] : [cx - lw / 2, oy + H + 5];
    const [ex, ey] = sisi === 'kiri' ? [ox, cy] : sisi === 'kanan' ? [ox + W, cy] : sisi === 'atas' ? [cx, oy] : [cx, oy + H];
    const [tx, ty] = sisi === 'kiri' ? [lx + lw, cy] : sisi === 'kanan' ? [lx, cy] : sisi === 'atas' ? [cx, ly + lh] : [cx, ly];
    atas.push(`<line x1="${n(tx)}" y1="${n(ty)}" x2="${n(ex)}" y2="${n(ey)}" stroke="${warna}" stroke-width="1.6"/>`);
    atas.push(`<rect x="${n(lx)}" y="${n(ly)}" width="${n(lw)}" height="${lh}" rx="4" fill="${warna}"/>`);
    atas.push(`<text x="${n(lx + lw / 2)}" y="${n(ly + 11)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${teks}</text>`);
  }
  //  Kabel cadangan: dari receiving card terakhir tiap port ke tepi terdekat (garis putus-putus, label B1, B2, ...).
  if (t.cadangan !== 'tidak') {
    const akhir = new Map<number, { c: number; r: number; urut: number }>();
    for (const s of t.hasil.sel) { const a = akhir.get(s.port); if (!a || s.urut > a.urut) akhir.set(s.port, s); }
    akhir.forEach((m, port) => {
      const warna = warnaPort(port);
      const [cx, cy] = pusat(m.c, m.r);
      const jarak = [{ sisi: 'kiri', v: m.c }, { sisi: 'kanan', v: t.K - 1 - m.c }, { sisi: 'atas', v: m.r }, { sisi: 'bawah', v: t.B - 1 - m.r }].sort((a, b) => a.v - b.v);
      const teks = `B${port}`, lw = 8 + teks.length * 6.4, lh = 15;
      const tag = (x: number, y: number) => {
        atas.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(lw)}" height="${lh}" rx="4" fill="#fff" stroke="${warna}" stroke-width="1.4" stroke-dasharray="3 2"/>`);
        atas.push(`<text x="${n(x + lw / 2)}" y="${n(y + 11)}" font-size="10" font-weight="700" text-anchor="middle" fill="${warna}" font-family="Segoe UI,Arial">${teks}</text>`);
      };
      if (jarak[0].v > 0) { tag(cx - lw / 2, cy + 2); return; }
      const sisi = jarak[0].sisi;
      const [lx, ly] = sisi === 'kiri' ? [ox - lw - 6, cy + 4] : sisi === 'kanan' ? [ox + W + 6, cy + 4]
        : sisi === 'atas' ? [cx + 4, oy - lh - 5] : [cx + 4, oy + H + 5];
      const [tx, ty] = sisi === 'kiri' ? [lx + lw, ly + lh / 2] : sisi === 'kanan' ? [lx, ly + lh / 2] : sisi === 'atas' ? [lx + lw / 2, ly + lh] : [lx + lw / 2, ly];
      atas.push(`<polyline points="${n(cx)},${n(cy)} ${n(tx)},${n(ty)}" fill="none" stroke="${warna}" stroke-width="1.4" stroke-dasharray="4 3"/>`);
      tag(lx, ly);
    });
  }
  const fm = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const mmPerPx = d.wUnit / Math.max(1, d.pxX);
  atas.push(`<text x="${n(ox + W / 2)}" y="${n(oy + H + 36)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial">${t.resX} px · ±${fm((t.resX * mmPerPx) / 1000)} m · ${t.K} kolom receiving card</text>`);
  atas.push(`<text x="${n(ox - 34)}" y="${n(oy + H / 2)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial" transform="rotate(-90 ${n(ox - 34)} ${n(oy + H / 2)})">${t.resY} px · ±${fm((t.resY * mmPerPx) / 1000)} m · ${t.B} baris</text>`);
  if (o.judul) atas.push(`<text x="${ox}" y="20" font-size="13" font-weight="700" fill="#0f172a" font-family="Segoe UI,Arial">${esc(o.judul)}</text>`);
  out.push(`<g pointer-events="none">${atas.join('')}</g>`);
  const lebar = n(W + ox + 52), tinggi = n(H + oy + 48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}" viewBox="0 0 ${lebar} ${tinggi}" style="max-width:100%;height:auto;touch-action:${o.interaktif ? 'none' : 'auto'}">${out.join('')}</svg>`;
}

/**
 * Gambar siap kirim (PNG/SVG): judul, ringkasan, diagram lengkap, dan legenda port - satu berkas
 * yang bisa langsung ditempel ke penawaran / dikirim ke installer.
 */
export function svgPosterKoneksi(d: DataKoneksi, s: PengaturanKoneksi, judul: string, sub: string): string {
  const t = susunKoneksi(d, s), k = t.hasil;
  const diagram = svgKoneksi(d, t);
  const dw = Number(/\swidth="([\d.]+)"/.exec(diagram)?.[1] ?? 800), dh = Number(/\sheight="([\d.]+)"/.exec(diagram)?.[1] ?? 400);
  const W = Math.max(dw, 820) + 40;
  const port = k.port;
  const kolomLegenda = port.length > 24 ? 3 : port.length > 8 ? 2 : 1;
  const barisLegenda = Math.ceil(port.length / kolomLegenda);
  const yDiagram = 92, yLegenda = yDiagram + dh + 16, tinggiBaris = 19;
  const H = yLegenda + 30 + barisLegenda * tinggiBaris + 46;
  const lebarKolom = (W - 40) / kolomLegenda;
  const huruf = 'font-family="Segoe UI,Arial"';
  const legenda = port.map((p, i) => {
    const x = 20 + Math.floor(i / barisLegenda) * lebarKolom, y = yLegenda + 30 + (i % barisLegenda) * tinggiBaris;
    const teks = `${namaPort(t, p.port)} · ${p.jumlah} RC · ${p.px.toLocaleString('id-ID')} px · ${f(p.beban, 0)}%${p.mulai ? ` · masuk kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}` : ''}${t.cadangan !== 'tidak' && p.jumlah ? ` · B${p.port} → ${namaCadangan(t, p.port)}` : ''}`;
    return `<rect x="${x}" y="${y - 10}" width="11" height="11" rx="2" fill="${warnaPort(p.port)}"/><text x="${x + 17}" y="${y}" font-size="11.5" fill="${p.beban > s.beban ? '#b91c1c' : '#1e293b'}" ${huruf}>${esc(teks)}</text>`;
  }).join('');
  const ringkas = `${k.sel.length} receiving card${t.rc ? ` ${t.rc.nama}` : ''} (${t.K} × ${t.B}) · ${t.resX} × ${t.resY} px · ${t.portTerpakai} port LAN${t.ppkPenuh > 0 ? ` · ${t.controller} controller × ${t.ppkPenuh} port` : ''}${teksCadangan(t)} · ${teksCara(s)}`;
  const peringatan = [k.galat, k.tanpaPort.length ? `${k.tanpaPort.length} receiving card belum tersambung` : '', k.lewat.length ? `Port ${k.lewat.join(', ')} melebihi batas beban ${s.beban}%` : '']
    .filter(Boolean).join(' · ');
  const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="0" y="0" width="${W}" height="62" fill="#1d4ed8"/>
<text x="20" y="28" font-size="18" font-weight="800" fill="#ffffff" ${huruf}>${esc(judul)}</text>
<text x="20" y="48" font-size="12" fill="#dbeafe" ${huruf}>${esc(sub)}</text>
<text x="${W - 20}" y="28" font-size="11" text-anchor="end" fill="#dbeafe" ${huruf}>${esc(tanggal)}</text>
<text x="20" y="80" font-size="12" font-weight="600" fill="#334155" ${huruf}>${esc(ringkas)}</text>
${diagram.replace(/ style="[^"]*"/, '').replace('<svg ', `<svg x="${Math.round((W - dw) / 2)}" y="${yDiagram}" `)}
<text x="20" y="${yLegenda + 12}" font-size="11" font-weight="800" fill="#1e3a8a" letter-spacing="0.6" ${huruf}>PEMBAGIAN PORT LAN</text>
${legenda}
${peringatan ? `<text x="20" y="${H - 30}" font-size="11" fill="#b91c1c" ${huruf}>${esc(peringatan)}</text>` : ''}
<text x="20" y="${H - 12}" font-size="10" fill="#94a3b8" ${huruf}>IndoVisual Professional Tools — Tools Team · label sel = port-urutan, angka kecil = ukuran receiving card (px)</text>
</svg>`;
}
