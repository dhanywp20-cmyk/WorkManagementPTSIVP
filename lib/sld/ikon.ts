const G = '#57606a', GELAP = '#2d333b', TERANG = '#d0d7de', LATAR = '#eef2f5';

const ulang = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join('');

const IKON: Record<string, { l: string; svg: string }> = {
  umum: { l: 'Perangkat umum', svg: `<rect x="14" y="16" width="72" height="30" rx="3" fill="${GELAP}"/><rect x="20" y="22" width="22" height="4" rx="1" fill="${G}"/>`
    + `<circle cx="76" cy="24" r="1.6" fill="#3fb950"/>${ulang(4, i => `<rect x="${20 + i * 8}" y="36" width="5" height="4" rx=".6" fill="${TERANG}"/>`)}` },
  minipc: { l: 'Mini PC', svg: `<path d="M18 22 L30 12 H86 L74 22 Z" fill="#444c56"/><path d="M74 22 L86 12 V44 L74 54 Z" fill="#22272e"/>`
    + `<rect x="18" y="22" width="56" height="32" rx="2" fill="${GELAP}"/><rect x="24" y="34" width="6" height="4" rx=".6" fill="#f0883e"/><rect x="33" y="34" width="6" height="4" rx=".6" fill="#388bfd"/><circle cx="66" cy="36" r="2.4" fill="none" stroke="#58a6ff" stroke-width="1"/>` },
  switch: { l: 'Switch jaringan', svg: `<path d="M8 26 L18 18 H94 L84 26 Z" fill="#3b5998"/><rect x="8" y="26" width="76" height="18" rx="1.5" fill="#2a4480"/>`
    + `${ulang(12, i => `<rect x="${13 + i * 5.6}" y="${i % 2 ? 36 : 30}" width="4.2" height="4" rx=".4" fill="${TERANG}"/>`)}<circle cx="80" cy="30" r=".9" fill="#3fb950"/>` },
  controller: { l: 'Prosesor kontrol', svg: `<path d="M10 22 L22 12 H92 L80 22 Z" fill="#f6f8fa" stroke="${TERANG}" stroke-width=".6"/><rect x="10" y="22" width="70" height="30" rx="2" fill="#e6e9ec" stroke="${TERANG}" stroke-width=".6"/>`
    + `<path d="M80 22 L92 12 V42 L80 52 Z" fill="#c9ced3"/><text x="20" y="35" font-family="Arial" font-weight="700" font-style="italic" font-size="8" fill="${GELAP}">cue</text>`
    + `${ulang(10, i => `<circle cx="${30 + i * 4.6}" cy="46" r="1.1" fill="${GELAP}"/>`)}` },
  relay: { l: 'Modul relay (DIN)', svg: `<rect x="12" y="14" width="76" height="36" rx="3" fill="#e9ecef" stroke="${TERANG}" stroke-width=".6"/>`
    + `${ulang(3, i => `<rect x="${18 + i * 24}" y="40" width="18" height="8" rx="1" fill="#2da44e"/>`)}${ulang(8, i => `<circle cx="${26 + i * 7}" cy="24" r="1.1" fill="${G}"/>`)}` },
  panel: { l: 'Panel sentuh', svg: `<rect x="14" y="8" width="72" height="46" rx="3" fill="#161b22"/><rect x="18" y="12" width="64" height="38" rx="1" fill="#22324a"/>`
    + `${ulang(3, i => `<rect x="${21 + i * 20.5}" y="20" width="18" height="12" rx="1.2" fill="#2f4566"/>`)}${ulang(3, i => `<rect x="${21 + i * 20.5}" y="35" width="18" height="12" rx="1.2" fill="#2f4566"/>`)}`
    + `<circle cx="26" cy="26" r="2.4" fill="#ffd33d"/><rect x="46" y="23" width="9" height="6" fill="#79c0ff"/><rect x="25" y="39" width="10" height="5" rx="1" fill="#58a6ff"/>` },
  tv: { l: 'TV / display', svg: `<rect x="6" y="6" width="88" height="48" rx="1.5" fill="#161b22"/><rect x="8" y="8" width="84" height="44" fill="#3b6fb6"/>`
    + `<path d="M8 40 Q30 20 52 34 T92 22 V52 H8 Z" fill="#e85aad" opacity=".8"/><path d="M8 46 Q40 30 92 40 V52 H8 Z" fill="#f2a33a" opacity=".8"/><path d="M20 54 l-3 5 M80 54 l3 5" stroke="#161b22" stroke-width="1.6"/>` },
  proyektor: { l: 'Proyektor', svg: `<rect x="14" y="20" width="72" height="26" rx="5" fill="#f6f8fa" stroke="${TERANG}"/><circle cx="32" cy="33" r="9" fill="${GELAP}"/><circle cx="32" cy="33" r="5" fill="#58a6ff" opacity=".7"/>`
    + `${ulang(5, i => `<line x1="${52 + i * 5}" y1="26" x2="${52 + i * 5}" y2="40" stroke="${TERANG}" stroke-width="1.4"/>`)}` },
  speakerphone: { l: 'Speakerphone', svg: `<ellipse cx="50" cy="34" rx="32" ry="19" fill="#22272e"/><ellipse cx="50" cy="30" rx="30" ry="17" fill="#30363d"/>`
    + `<ellipse cx="50" cy="30" rx="22" ry="12" fill="#3b424a"/>${ulang(6, i => `<ellipse cx="50" cy="30" rx="${4 + i * 3.4}" ry="${2.2 + i * 1.9}" fill="none" stroke="#22272e" stroke-width=".5"/>`)}` },
  mic: { l: 'Mikrofon plafon', svg: `<ellipse cx="50" cy="34" rx="26" ry="20" fill="#e6e9ec"/><ellipse cx="50" cy="31" rx="24" ry="17" fill="#f6f8fa"/><circle cx="50" cy="31" r="5" fill="none" stroke="#3fb950" stroke-width="1.2"/>` },
  speaker: { l: 'Speaker', svg: `<rect x="30" y="6" width="40" height="50" rx="3" fill="${GELAP}"/><circle cx="50" cy="38" r="12" fill="#444c56"/><circle cx="50" cy="38" r="5" fill="#22272e"/><circle cx="50" cy="17" r="5" fill="#444c56"/>` },
  amplifier: { l: 'Amplifier', svg: `<rect x="8" y="20" width="84" height="22" rx="1.5" fill="${GELAP}"/>${ulang(4, i => `<circle cx="${24 + i * 12}" cy="31" r="3.4" fill="#444c56" stroke="${TERANG}" stroke-width=".5"/>`)}`
    + `<rect x="74" y="26" width="12" height="10" rx="1" fill="#0d1117"/><circle cx="80" cy="31" r="1" fill="#3fb950"/>` },
  kamera: { l: 'Kamera', svg: `<rect x="34" y="40" width="32" height="12" rx="2" fill="${GELAP}"/><rect x="30" y="12" width="40" height="28" rx="6" fill="#e6e9ec" stroke="${TERANG}"/><circle cx="50" cy="26" r="9" fill="${GELAP}"/><circle cx="50" cy="26" r="4" fill="#388bfd"/>` },
  tirai: { l: 'Motor tirai', svg: `<line x1="12" y1="10" x2="84" y2="10" stroke="${G}" stroke-width="2" stroke-linecap="round"/><rect x="82" y="6" width="9" height="7" rx="1" fill="${GELAP}"/>`
    + `<path d="M14 12 h30 v40 h-30 Z" fill="#ddf4ff" stroke="${G}" stroke-width=".5"/><path d="M54 12 h30 v40 h-30 Z" fill="#ddf4ff" stroke="${G}" stroke-width=".5"/><path d="M38 32 l5 -3 v6 z M60 32 l-5 -3 v6 z" fill="${G}"/>` },
  gorden: { l: 'Motor gorden', svg: `<line x1="12" y1="10" x2="84" y2="10" stroke="${G}" stroke-width="2" stroke-linecap="round"/><rect x="82" y="6" width="9" height="7" rx="1" fill="${GELAP}"/>`
    + `<path d="M14 12 h30 v40 h-30 Z" fill="#dafbe1" stroke="${G}" stroke-width=".5"/><path d="M54 12 h30 v40 h-30 Z" fill="#dafbe1" stroke="${G}" stroke-width=".5"/><path d="M38 32 l5 -3 v6 z M60 32 l-5 -3 v6 z" fill="${G}"/>` },
  lampu: { l: 'Lampu', svg: ulang(3, i => `<circle cx="${22 + i * 28}" cy="26" r="8" fill="#fff8c5" stroke="#9a6700" stroke-width=".7"/><path d="M${18 + i * 28} 27 q4 3 8 0" fill="none" stroke="#9a6700" stroke-width=".6"/>`
    + `<rect x="${18.5 + i * 28}" y="34" width="7" height="5" rx=".8" fill="#8c959f"/><line x1="${22 + i * 28}" y1="12" x2="${22 + i * 28}" y2="15" stroke="#d4a72c" stroke-width=".8"/>`) },
  ac: { l: 'AC split', svg: `<rect x="10" y="16" width="80" height="22" rx="4" fill="#fff" stroke="${G}" stroke-width=".8"/><line x1="16" y1="31" x2="84" y2="31" stroke="#8c959f" stroke-width=".8"/>`
    + `<circle cx="80" cy="22" r="1" fill="#3fb950"/>${ulang(3, i => `<path d="M${30 + i * 18} 42 q2 4 0 8" fill="none" stroke="#58a6ff" stroke-width=".8"/>`)}` },
  fcu: { l: 'FCU / thermostat', svg: `<rect x="6" y="20" width="22" height="24" rx="2" fill="#fff" stroke="${G}" stroke-width=".7"/><rect x="9" y="23" width="16" height="9" rx="1" fill="${GELAP}"/>`
    + `<text x="17" y="30" font-family="Arial" font-size="5" font-weight="700" fill="#58d1ff" text-anchor="middle">24°</text><rect x="36" y="16" width="58" height="32" rx="3" fill="${LATAR}" stroke="${G}" stroke-width=".8"/>`
    + `<circle cx="52" cy="32" r="10" fill="#fff" stroke="${G}" stroke-width=".7"/>${ulang(3, i => `<path d="M52 32 l${[7, -4, -3][i]} ${[-2, -6, 6][i]}" stroke="#8c959f" stroke-width="2.4" stroke-linecap="round"/>`)}`
    + `${ulang(8, i => `<line x1="${68 + i * 3}" y1="22" x2="${68 + i * 3}" y2="42" stroke="#8c959f" stroke-width=".5"/>`)}` },
  ups: { l: 'UPS', svg: `<rect x="34" y="6" width="32" height="50" rx="3" fill="${GELAP}"/><rect x="40" y="12" width="20" height="10" rx="1" fill="#58a6ff" opacity=".85"/><circle cx="50" cy="32" r="3.5" fill="none" stroke="${TERANG}" stroke-width="1"/>`
    + `${ulang(3, i => `<line x1="40" y1="${42 + i * 4}" x2="60" y2="${42 + i * 4}" stroke="${G}" stroke-width="1"/>`)}` },
  mcb: { l: 'MCB / panel listrik', svg: ulang(3, i => `<rect x="${24 + i * 18}" y="12" width="15" height="38" rx="1.5" fill="#f6f8fa" stroke="${G}" stroke-width=".7"/><rect x="${28 + i * 18}" y="24" width="7" height="12" rx="1" fill="#cf222e"/>`) },
  rak: { l: 'Rak perangkat', svg: `<rect x="28" y="4" width="44" height="54" rx="2" fill="${GELAP}"/>${ulang(5, i => `<rect x="32" y="${9 + i * 9.5}" width="36" height="7" rx=".8" fill="#444c56"/><circle cx="64" cy="${12.5 + i * 9.5}" r=".9" fill="#3fb950"/>`)}` },
};

export const DAFTAR_IKON = Object.entries(IKON).map(([v, x]) => ({ v, l: x.l }));

export function svgIkon(ikon: string, x: number, y: number, w: number, h: number): string {
  const i = IKON[ikon] ?? IKON.umum;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 100 62.5" preserveAspectRatio="xMidYMid meet" overflow="visible">${i.svg}</svg>`;
}
