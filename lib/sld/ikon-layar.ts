const n = (v: number) => String(Math.round(v * 100) / 100);

export const DEFS_LAYAR = '<defs>'
  + '<filter id="sldl-b3" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>'
  + '<filter id="sldl-b6" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>'
  + '<filter id="sldl-b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1"/></filter>'
  + '<filter id="sldl-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="2" seed="7"/>'
  + '<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .5"/></feComponentTransfer></filter>'
  + '<linearGradient id="sldl-tepi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9aa3ad"/><stop offset=".5" stop-color="#3a3f47"/><stop offset="1" stop-color="#7c8591"/></linearGradient>'
  + '<linearGradient id="sldl-sisi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b1e23"/><stop offset="1" stop-color="#4a5059"/></linearGradient>'
  + '<linearGradient id="sldl-kilau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".42" stop-color="#fff" stop-opacity=".04"/>'
  + '<stop offset=".43" stop-color="#fff" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="sldl-langit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1633"/><stop offset=".5" stop-color="#3b2466"/><stop offset=".78" stop-color="#c2410c"/>'
  + '<stop offset="1" stop-color="#fb923c"/></linearGradient>'
  + '<linearGradient id="sldl-malam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#030712"/><stop offset="1" stop-color="#0b1440"/></linearGradient>'
  + '<linearGradient id="sldl-badan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdfd"/><stop offset=".55" stop-color="#eceef1"/><stop offset="1" stop-color="#c9ced5"/></linearGradient>'
  + '<linearGradient id="sldl-badan-sisi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfd4da"/><stop offset="1" stop-color="#a7aeb7"/></linearGradient>'
  + '<linearGradient id="sldl-logam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3f4f6"/><stop offset=".45" stop-color="#9aa3ad"/><stop offset=".55" stop-color="#d1d5db"/>'
  + '<stop offset="1" stop-color="#6b7280"/></linearGradient>'
  + '<radialGradient id="sldl-kaca-lensa" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#64748b"/><stop offset=".3" stop-color="#1e293b"/><stop offset="1" stop-color="#020617"/></radialGradient>'
  + '<radialGradient id="sldl-bayang" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0f172a" stop-opacity=".38"/><stop offset="1" stop-color="#0f172a" stop-opacity="0"/></radialGradient>'
  + '<pattern id="sldl-piksel" width="1.25" height="1.25" patternUnits="userSpaceOnUse"><rect width="1.25" height="1.25" fill="none" stroke="#000" stroke-opacity=".38" stroke-width=".32"/></pattern>'
  + '</defs>';

type Tema = 'aurora' | 'kota' | 'gelombang' | 'ui';

function blob(cx: number, cy: number, r: number, warna: string, op = 0.85, f = 'sldl-b6') {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${warna}" fill-opacity="${op}" filter="url(#${f})"/>`;
}

function isiLayar(id: string, w: number, h: number, tema: Tema): string {
  const clip = `<clipPath id="sldl-c-${id}"><rect width="${n(w)}" height="${n(h)}"/></clipPath>`;
  let isi = '';
  if (tema === 'aurora' || tema === 'ui') {
    isi = `<rect width="${n(w)}" height="${n(h)}" fill="url(#sldl-malam)"/>`
      + blob(w * 0.22, h * 0.72, w * 0.3, '#2563eb') + blob(w * 0.52, h * 0.3, w * 0.26, '#7c3aed') + blob(w * 0.8, h * 0.68, w * 0.24, '#db2777')
      + blob(w * 0.66, h * 1.02, w * 0.22, '#f59e0b', 0.9) + blob(w * 0.1, h * 0.12, w * 0.16, '#0ea5e9', 0.55)
      + `<path d="M0 ${n(h * 0.78)} C${n(w * 0.3)} ${n(h * 0.42)} ${n(w * 0.62)} ${n(h * 1.02)} ${n(w)} ${n(h * 0.5)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="${n(h * 0.03)}" filter="url(#sldl-b1)"/>`;
  } else if (tema === 'kota') {
    const gedung: string[] = [];
    let x = 0, i = 0;
    while (x < w) {
      const lw = w * (0.05 + ((i * 37) % 7) / 100), lh = h * (0.22 + ((i * 53) % 9) / 22);
      gedung.push(`<rect x="${n(x)}" y="${n(h - lh)}" width="${n(lw)}" height="${n(lh)}" fill="#0a0f1f"/>`);
      for (let k = 0; k < 6; k++) {
        const wx = x + lw * (0.2 + ((k * 29 + i * 11) % 60) / 100), wy = h - lh + lh * (0.12 + ((k * 41 + i * 7) % 70) / 100);
        gedung.push(`<rect x="${n(wx)}" y="${n(wy)}" width="${n(lw * 0.08)}" height="${n(h * 0.012)}" fill="#fde68a" fill-opacity=".8"/>`);
      }
      x += lw + w * 0.004; i++;
    }
    isi = `<rect width="${n(w)}" height="${n(h)}" fill="url(#sldl-langit)"/>` + blob(w * 0.62, h * 0.74, w * 0.16, '#fdba74', 0.95, 'sldl-b6')
      + blob(w * 0.62, h * 0.74, w * 0.05, '#fff7ed', 1, 'sldl-b3') + gedung.join('')
      + [0.12, 0.3, 0.46, 0.78, 0.9].map((fx, k) => blob(w * fx, h * (0.9 + (k % 2) * 0.05), w * 0.025, k % 2 ? '#fcd34d' : '#f472b6', 0.7, 'sldl-b1')).join('');
  } else {
    isi = `<rect width="${n(w)}" height="${n(h)}" fill="#04111f"/>` + blob(w * 0.2, h * 0.3, w * 0.28, '#0d9488') + blob(w * 0.55, h * 0.7, w * 0.3, '#2563eb')
      + blob(w * 0.85, h * 0.25, w * 0.22, '#9333ea') + blob(w * 0.42, h * 0.05, w * 0.15, '#22d3ee', 0.6)
      + [0.35, 0.5, 0.65].map((fy, k) => `<path d="M0 ${n(h * fy)} C${n(w * 0.25)} ${n(h * (fy - 0.25))} ${n(w * 0.6)} ${n(h * (fy + 0.25))} ${n(w)} ${n(h * (fy - 0.1))}"`
        + ` fill="none" stroke="#e0f2fe" stroke-opacity="${0.45 - k * 0.1}" stroke-width="${n(h * 0.012)}"/>`).join('');
  }
  if (tema === 'ui') {
    const kartu = (x: number, y: number, kw: number, kh: number) => `<rect x="${n(x)}" y="${n(y)}" width="${n(kw)}" height="${n(kh)}" rx="${n(h * 0.03)}" fill="#fff" fill-opacity=".14"`
      + ` stroke="#fff" stroke-opacity=".25" stroke-width=".3"/><rect x="${n(x + kw * 0.12)}" y="${n(y + kh * 0.2)}" width="${n(kw * 0.5)}" height="${n(kh * 0.1)}" rx=".4" fill="#fff" fill-opacity=".85"/>`
      + `<rect x="${n(x + kw * 0.12)}" y="${n(y + kh * 0.62)}" width="${n(kw * 0.34)}" height="${n(kh * 0.18)}" rx="${n(kh * 0.09)}" fill="#fff" fill-opacity=".9"/>`;
    isi += `<rect width="${n(w)}" height="${n(h)}" fill="#000" fill-opacity=".25"/>`
      + `<rect x="${n(w * 0.05)}" y="${n(h * 0.07)}" width="${n(w * 0.3)}" height="${n(h * 0.06)}" rx=".5" fill="#fff" fill-opacity=".9"/>`
      + [0, 1, 2].map(i => kartu(w * (0.05 + i * 0.31), h * 0.22, w * 0.28, h * 0.32)).join('') + [0, 1, 2].map(i => kartu(w * (0.05 + i * 0.31), h * 0.6, w * 0.28, h * 0.32)).join('');
  }
  return `${clip}<g clip-path="url(#sldl-c-${id})">${isi}<rect width="${n(w)}" height="${n(h)}" filter="url(#sldl-grain)" opacity=".16"/>`
    + `<polygon points="0,0 ${n(w * 0.62)},0 ${n(w * 0.18)},${n(h)} 0,${n(h)}" fill="url(#sldl-kilau)"/></g>`;
}

interface OpsiPanel { id: string; x: number; y: number; w: number; h: number; tebal: number; bezel: number; warna: string; tema: Tema; miring: number; r?: number }

function panelLayar(o: OpsiPanel): string {
  const { w, h, bezel: b, tebal: t } = o;
  const sisi = `<polygon points="${n(w)},${n(0.4)} ${n(w + t)},${n(-t * 0.35)} ${n(w + t)},${n(h - t * 0.35)} ${n(w)},${n(h - 0.4)}" fill="url(#sldl-sisi)"/>`
    + `<polygon points="${n(0.4)},0 ${n(t)},${n(-t * 0.35)} ${n(w + t)},${n(-t * 0.35)} ${n(w)},0" fill="#4a5059"/>`;
  return `<g transform="translate(${n(o.x)} ${n(o.y)}) skewY(${-o.miring})">${sisi}`
    + `<rect width="${n(w)}" height="${n(h)}" rx="${n(o.r ?? 0.7)}" fill="${o.warna}"/>`
    + `<rect x=".25" y=".25" width="${n(w - 0.5)}" height="${n(h - 0.5)}" rx="${n(o.r ?? 0.7)}" fill="none" stroke="url(#sldl-tepi)" stroke-width=".5"/>`
    + `<g transform="translate(${n(b)} ${n(b)})">${isiLayar(o.id, w - 2 * b, h - 2 * b, o.tema)}</g></g>`;
}

const bayangLantai = (cx: number, cy: number, rx: number, ry = 3.4) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#sldl-bayang)"/>`;
const bayangDinding = (x: number, y: number, w: number, h: number, miring: number) =>
  `<g transform="translate(${n(x + 3)} ${n(y + 3.5)}) skewY(${-miring})"><rect width="${n(w)}" height="${n(h)}" fill="#0f172a" fill-opacity=".32" filter="url(#sldl-b3)"/></g>`;

export const IKON_LAYAR: Record<string, { l: string; svg: () => string }> = {
  tv: { l: 'TV (TCL / umum)', svg: () => bayangLantai(80, 91, 60)
    + `<path d="M36 82 L30 90 H34.5 L41 82 Z M124 79 L130 87.5 H125.5 L119 79 Z" fill="url(#sldl-logam)"/>`
    + panelLayar({ id: 'tv', x: 14, y: 14, w: 128, h: 72, tebal: 2.6, bezel: 1.1, warna: '#0a0b0d', tema: 'aurora', miring: 3 })
    + `<rect x="74" y="83.6" width="10" height=".9" rx=".45" fill="#6b7280" transform="skewY(-3)"/>` },
  signage: { l: 'Signage Philips BDL', svg: () => bayangDinding(12, 10, 132, 75, 3)
    + panelLayar({ id: 'sg', x: 12, y: 10, w: 132, h: 75, tebal: 4.2, bezel: 1.5, warna: '#1d2025', tema: 'kota', miring: 3 }) },
  videowall: { l: 'Videowall (kolom x baris otomatis)', svg: () => '' },
  led: { l: 'LED display (ukuran otomatis)', svg: () => '' },
  layar: { l: 'Layar proyektor', svg: () => bayangDinding(22, 14, 116, 70, 2)
    + '<rect x="16" y="9" width="128" height="6" rx="3" fill="url(#sldl-badan)" stroke="#9aa3ad" stroke-width=".4"/>'
    + '<rect x="22" y="15" width="116" height="70" fill="#1b1e23"/><rect x="24.5" y="21" width="111" height="61.5" fill="#fbfbfc"/>'
    + '<rect x="22" y="85" width="116" height="2.2" rx="1.1" fill="#2b2f36"/>' },
  panel: { l: 'Panel sentuh', svg: () => bayangLantai(82, 86, 46)
    + `<polygon points="66,84 104,84 110,72 74,72" fill="#2b2f36"/><polygon points="66,84 104,84 104.8,82.6 66.8,82.6" fill="#4b5563"/>`
    + panelLayar({ id: 'pn', x: 30, y: 16, w: 96, h: 60, tebal: 4, bezel: 4.2, warna: '#0d0e10', tema: 'ui', miring: 4, r: 3 }) },
  proyektor: { l: 'Proyektor', svg: () => bayangLantai(84, 84, 58, 4)
    + '<path d="M26 50 Q26 44 32 42 L104 32 Q110 31 116 33 L138 40 Q142 42 142 46 L142 64 Q142 68 138 70 L116 78 Q110 80 104 79 L32 77 Q26 76 26 71 Z" fill="url(#sldl-badan-sisi)"/>'
    + '<path d="M26 50 Q26 44 32 42 L104 32 Q110 31 116 33 L138 40 Q130 42 122 42 L36 52 Q29 53 26 50 Z" fill="#fff"/>'
    + '<path d="M26 52 Q26 49 30 49 L118 44 Q124 44 124 49 L124 76 Q124 80 118 80 L32 80 Q26 80 26 75 Z" fill="url(#sldl-badan)"/>'
    + '<path d="M26 52 Q26 49 30 49 L118 44 Q124 44 124 49 L124 76 Q124 80 118 80 L32 80 Q26 80 26 75 Z" fill="none" stroke="#9aa3ad" stroke-width=".4"/>'
    + '<circle cx="50" cy="63" r="13.5" fill="#1b1e23"/><circle cx="50" cy="63" r="11.6" fill="url(#sldl-logam)"/><circle cx="50" cy="63" r="9.4" fill="#0b0c0e"/>'
    + '<circle cx="50" cy="63" r="8.2" fill="url(#sldl-kaca-lensa)"/><path d="M44 58 A8 8 0 0 1 55 57" fill="none" stroke="#818cf8" stroke-opacity=".7" stroke-width="1"/>'
    + '<circle cx="46.6" cy="59.6" r="1.8" fill="#fff" fill-opacity=".55"/>'
    + Array.from({ length: 12 }, (_, i) => `<rect x="${78 + i * 3.4}" y="56" width="1.5" height="16" rx=".75" fill="#3f4651" fill-opacity=".75"/>`).join('')
    + '<rect x="78" y="51" width="40" height="1.4" rx=".7" fill="#cbd5e1"/><circle cx="118" cy="51.8" r=".8" fill="#22c55e"/>'
    + '<rect x="34" y="80" width="8" height="2.6" rx="1" fill="#2b2f36"/><rect x="108" y="80" width="8" height="2.6" rx="1" fill="#2b2f36"/>' },
};
