import { DEFS_LAYAR, IKON_LAYAR } from './ikon-layar';

const n = (v: number) => String(Math.round(v * 100) / 100);

const DEFS = '<defs>'
  + '<linearGradient id="sldg-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".45" stop-color="#fff" stop-opacity=".03"/>'
  + '<stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>'
  + '<linearGradient id="sldg-kaca" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".38" stop-color="#fff" stop-opacity=".05"/>'
  + '<stop offset=".39" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="sldg-logam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e5e8ec"/><stop offset=".3" stop-color="#f8f9fa"/><stop offset=".55" stop-color="#d3d8de"/>'
  + '<stop offset=".8" stop-color="#eef0f3"/><stop offset="1" stop-color="#c3c9d1"/></linearGradient>'
  + '<radialGradient id="sldg-bayang"><stop offset="0" stop-color="#0f172a" stop-opacity=".32"/><stop offset="1" stop-color="#0f172a" stop-opacity="0"/></radialGradient>'
  + '<linearGradient id="sldg-tv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b2a6f"/><stop offset=".4" stop-color="#4c1d95"/><stop offset=".72" stop-color="#be185d"/>'
  + '<stop offset="1" stop-color="#f59e0b"/></linearGradient>'
  + '<linearGradient id="sldg-desk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c4a6e"/><stop offset=".6" stop-color="#0369a1"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>'
  + '<radialGradient id="sldg-lensa" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#5b6b82"/><stop offset=".35" stop-color="#1e293b"/><stop offset="1" stop-color="#05070a"/></radialGradient>'
  + '<radialGradient id="sldg-kerucut" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#4b5563"/><stop offset=".6" stop-color="#1f2328"/><stop offset="1" stop-color="#0b0c0e"/></radialGradient>'
  + '<radialGradient id="sldg-hangat" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbeb"/><stop offset=".6" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>'
  + '<linearGradient id="sldg-sinar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a" stop-opacity=".55"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="sldg-lipat" x1="0" y1="0" x2="7" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="repeat"><stop offset="0" stop-color="#000" stop-opacity=".14"/>'
  + '<stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>'
  + '<pattern id="sldg-jaring" width="2.2" height="2.2" patternUnits="userSpaceOnUse"><circle cx="1.1" cy="1.1" r=".55" fill="#000" fill-opacity=".45"/></pattern>'
  + '<filter id="sldg-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4"/></filter>'
  + '</defs>';

const DX = 0.5, DY = 0.3;

function kubus(x: number, y: number, w: number, h: number, d: number, warna: string, o: { atas?: string; r?: number; sisi?: string } = {}): string {
  const dx = d * DX, dy = d * DY;
  const atas = `${n(x)},${n(y)} ${n(x + dx)},${n(y - dy)} ${n(x + w + dx)},${n(y - dy)} ${n(x + w)},${n(y)}`;
  const sisi = `${n(x + w)},${n(y)} ${n(x + w + dx)},${n(y - dy)} ${n(x + w + dx)},${n(y + h - dy)} ${n(x + w)},${n(y + h)}`;
  const r = o.r ? ` rx="${o.r}"` : '';
  return `<polygon points="${atas}" fill="${o.atas ?? warna}"/><polygon points="${atas}" fill="#fff" fill-opacity=".22"/>`
    + `<polygon points="${sisi}" fill="${o.sisi ?? warna}"/><polygon points="${sisi}" fill="#000" fill-opacity=".3"/>`
    + `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r} fill="${warna}"/><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r} fill="url(#sldg-v)"/>`
    + `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r} fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".45"/>`
    + `<line x1="${n(x + 0.6)}" y1="${n(y + 0.35)}" x2="${n(x + w - 0.6)}" y2="${n(y + 0.35)}" stroke="#fff" stroke-opacity=".45" stroke-width=".5"/>`;
}

const bayang = (cx: number, cy: number, rx: number, ry = 3.6) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#sldg-bayang)"/>`;
const led = (x: number, y: number, c: string, r = 0.65) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 2.4)}" fill="${c}" fill-opacity=".22"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${c}"/>`;
const rj45 = (x: number, y: number) => `<rect x="${n(x)}" y="${n(y)}" width="4" height="3.3" rx=".3" fill="#0a0b0d"/><rect x="${n(x + 0.6)}" y="${n(y + 0.5)}" width="2.8" height=".55" fill="#c9a227"/>`;
const hdmi = (x: number, y: number) => `<rect x="${n(x)}" y="${n(y)}" width="5.4" height="2.4" rx=".5" fill="#0a0b0d"/><rect x="${n(x + 0.8)}" y="${n(y + 0.7)}" width="3.8" height="1" fill="#b8bec6"/>`;
const usb = (x: number, y: number) => `<rect x="${n(x)}" y="${n(y)}" width="4.2" height="1.8" rx=".2" fill="#0a0b0d"/><rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="3.2" height=".6" fill="#2563eb"/>`;
const kaca = (x: number, y: number, w: number, h: number) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#sldg-kaca)"/>`;

function rak1u(x: number, y: number, w: number, h: number, d: number, warna: string, telinga = true): string {
  const t = telinga ? `<rect x="${n(x - 5)}" y="${n(y)}" width="5.2" height="${n(h)}" fill="${warna}"/><rect x="${n(x - 5)}" y="${n(y)}" width="5.2" height="${n(h)}" fill="url(#sldg-v)"/>`
    + `<rect x="${n(x + w - 0.2)}" y="${n(y)}" width="5.2" height="${n(h)}" fill="${warna}"/><rect x="${n(x + w - 0.2)}" y="${n(y)}" width="5.2" height="${n(h)}" fill="url(#sldg-v)"/>`
    + `<ellipse cx="${n(x - 2.5)}" cy="${n(y + h / 2)}" rx="1.1" ry="1.5" fill="#0a0b0d"/><ellipse cx="${n(x + w + 2.5)}" cy="${n(y + h / 2)}" rx="1.1" ry="1.5" fill="#0a0b0d"/>` : '';
  return bayang(x + w / 2 + d * DX * 0.5, y + h + 2.5, w * 0.62) + kubus(x, y, w, h, d, warna) + t;
}

const IKON: Record<string, { l: string; svg: () => string; vb?: [number, number, number] }> = {
  ...IKON_LAYAR,
  matrix: { l: 'Matrix switcher', svg: () => rak1u(14, 50, 112, 18, 50, '#17191d')
    + `<rect x="20" y="53.5" width="18" height="10" rx=".8" fill="#0a1a3a"/><rect x="21" y="54.5" width="16" height="8" rx=".5" fill="#1d4ed8"/>${kaca(21, 54.5, 16, 8)}`
    + [0, 1].map(j => Array.from({ length: 8 }, (_, i) => `<rect x="${44 + i * 7.6}" y="${53 + j * 6.6}" width="5.4" height="4.2" rx=".9" fill="#2b2f36"/>`
      + led(46.7 + i * 7.6, 55.1 + j * 6.6, j ? '#60a5fa' : '#22c55e', 0.45)).join('')).join('') + led(120, 59, '#3b82f6', 0.8) },
  switcher: { l: 'Presentation switcher', vb: [36, 32, 104], svg: () => bayang(80, 74, 42) + kubus(42, 54, 70, 16, 44, '#1b1e23', { r: 1 })
    + Array.from({ length: 4 }, (_, i) => `<rect x="${47 + i * 9}" y="58" width="6.5" height="5" rx="1" fill="#2c3139"/>${led(50.2 + i * 9, 66, i === 1 ? '#22c55e' : '#475569', 0.5)}`).join('')
    + `<rect x="86" y="59.5" width="7" height="2.4" rx="1.2" fill="#0a0b0d"/>${hdmi(97, 59.4)}${led(108, 58, '#3b82f6')}` },
  extender: { l: 'Extender HDBaseT (TX/RX)', svg: () => bayang(42, 74, 26) + bayang(118, 74, 26)
    + `<path d="M58 64 C76 84 92 84 104 64" fill="none" stroke="#13a3e0" stroke-width="2" stroke-linecap="round"/>`
    + kubus(18, 56, 44, 14, 30, '#1b1e23', { r: 1 }) + kubus(98, 56, 44, 14, 30, '#1b1e23', { r: 1 })
    + hdmi(23, 61) + rj45(31, 60.5) + led(56, 60, '#22c55e') + rj45(103, 60.5) + hdmi(111, 61) + led(136, 60, '#22c55e') },
  encoder: { l: 'AV over IP encoder / decoder', vb: [38, 26, 104], svg: () => bayang(80, 76, 44) + kubus(44, 56, 66, 16, 48, '#202328', { r: 1 })
    + Array.from({ length: 9 }, (_, i) => `<line x1="${50 + i * 7}" y1="${55}" x2="${50 + i * 7 + 24 * DX}" y2="${55 - 24 * DY}" stroke="#000" stroke-opacity=".35" stroke-width=".9"/>`).join('')
    + hdmi(49, 61) + rj45(58, 60.5) + usb(66, 61) + led(100, 60, '#22c55e') + led(104, 60, '#3b82f6') },
  controller: { l: 'Prosesor kontrol', vb: [24, 26, 128], svg: () => bayang(84, 82, 48) + kubus(30, 50, 90, 24, 52, '#e4e7eb', { r: 1.5 })
    + `<rect x="30" y="50" width="90" height="24" rx="1.5" fill="url(#sldg-logam)" fill-opacity=".85"/>`
    + Array.from({ length: 4 }, (_, i) => `<rect x="${36 + i * 13}" y="62" width="11" height="7" rx=".6" fill="#15803d"/>`
      + [0, 1, 2].map(k => `<circle cx="${38.4 + i * 13 + k * 3}" cy="64.2" r=".8" fill="#9ca3af"/>`).join('')).join('')
    + Array.from({ length: 10 }, (_, i) => led(36 + i * 4.2, 56, i % 4 ? '#94a3b8' : '#22c55e', 0.5)).join('') + rj45(94, 61) + rj45(101, 61) + led(113, 56, '#22c55e') },
  relay: { l: 'Modul relay (DIN)', svg: () => `<rect x="10" y="44" width="140" height="10" fill="url(#sldg-logam)"/>` + bayang(82, 86, 48, 3)
    + kubus(34, 22, 92, 60, 12, '#e3e6ea', { r: 2 }) + kubus(50, 38, 60, 28, 6, '#eceef1', { r: 1.5 })
    + [26, 72].map(y => Array.from({ length: 4 }, (_, i) => `<rect x="${38 + i * 21.5}" y="${y}" width="18" height="7" rx=".6" fill="#15803d"/>`
      + [0, 1, 2].map(k => `<circle cx="${41.5 + i * 21.5 + k * 5.3}" cy="${y + 3.5}" r="1.2" fill="#a1a8b1"/>`).join('')).join('')).join('')
    + Array.from({ length: 8 }, (_, i) => led(56 + i * 6.8, 52, i % 3 ? '#22c55e' : '#ef4444', 0.6)).join('') },
  switch: { l: 'Switch jaringan', svg: () => rak1u(14, 50, 112, 18, 50, '#2a3a58')
    + [0, 1].map(j => Array.from({ length: 12 }, (_, i) => rj45(30 + i * 5.6 + Math.floor(i / 6) * 2.4, 52.6 + j * 6.4)).join('')).join('')
    + Array.from({ length: 4 }, (_, i) => `<rect x="${101 + i * 5.4}" y="56" width="4.4" height="5" rx=".3" fill="#0a0b0d"/>`).join('')
    + Array.from({ length: 6 }, (_, i) => led(19 + (i % 3) * 3, 54 + Math.floor(i / 3) * 4, i % 2 ? '#22c55e' : '#f59e0b', 0.45)).join('') },
  minipc: { l: 'Mini PC', vb: [40, 30, 100], svg: () => bayang(80, 80, 40) + kubus(46, 56, 58, 20, 58, '#2a2d33', { r: 1.5, atas: '#15171b' })
    + `<polygon points="46,56 75,38.6 133,38.6 104,56" fill="#fff" fill-opacity=".08"/>`
    + usb(51, 64) + usb(57, 64) + `<rect x="64" y="64" width="4" height="1.8" rx=".9" fill="#0a0b0d"/>`
    + `<circle cx="96" cy="65" r="2.6" fill="none" stroke="#60a5fa" stroke-width=".8"/><circle cx="96" cy="65" r="4.6" fill="#3b82f6" fill-opacity=".15"/>` },
  pc: { l: 'PC desktop', vb: [30, 10, 112], svg: () => bayang(84, 88, 30) + kubus(62, 22, 36, 66, 42, '#1c1f24', { r: 1.5 })
    + `<rect x="65" y="26" width="30" height="46" rx="1" fill="url(#sldg-jaring)"/>${usb(67, 76)}${usb(73, 76)}`
    + `<circle cx="89" cy="78" r="2.4" fill="none" stroke="#22d3ee" stroke-width=".8"/>` },
  laptop: { l: 'Laptop', svg: () => bayang(84, 84, 56)
    + `<polygon points="28,80 120,80 138,68 46,68" fill="#c7cdd4"/><polygon points="28,80 120,80 138,68 46,68" fill="url(#sldg-v)"/>`
    + `<polygon points="40,77 112,77 126,70 54,70" fill="#2b2f36"/><polygon points="64,79 84,79 87,77.4 67,77.4" fill="#aeb5bd"/>`
    + `<polygon points="46,68 138,68 142,16 50,16" fill="#1a1c20"/><polygon points="49,66 135,66 138.6,19 52.6,19" fill="url(#sldg-desk)"/>`
    + `<polygon points="60,58 92,58 94,30 62,30" fill="#f8fafc" fill-opacity=".9"/><polygon points="49,66 135,66 138.6,19 52.6,19" fill="url(#sldg-kaca)"/>` },
  nvr: { l: 'NVR CCTV', vb: [14, 22, 144], svg: () => bayang(80, 76, 54) + kubus(20, 54, 104, 18, 58, '#16181c', { r: 1 })
    + Array.from({ length: 4 }, (_, i) => `<rect x="${26 + i * 17}" y="57" width="15" height="11" rx=".6" fill="#22252b"/><rect x="${27 + i * 17}" y="66" width="13" height=".9" fill="#0a0b0d"/>`).join('')
    + Array.from({ length: 5 }, (_, i) => led(98 + i * 4, 59, i === 0 ? '#3b82f6' : '#22c55e', 0.5)).join('') + usb(98, 64) + usb(105, 64) },
  kamera: { l: 'Kamera PTZ', svg: () => bayang(80, 88, 30)
    + kubus(56, 74, 46, 12, 30, '#e9ecef', { r: 3 }) + `<rect x="71" y="62" width="16" height="13" fill="#d7dbe0"/><rect x="71" y="62" width="16" height="13" fill="url(#sldg-v)"/>`
    + kubus(52, 22, 54, 40, 26, '#f1f3f5', { r: 6 }) + `<circle cx="78" cy="42" r="15" fill="#2b2f36"/><circle cx="78" cy="42" r="12" fill="url(#sldg-lensa)"/>`
    + `<circle cx="74" cy="38" r="3" fill="#fff" fill-opacity=".3"/>${led(98, 28, '#22c55e')}` },
  mediaplayer: { l: 'Media player signage', vb: [42, 36, 100], svg: () => bayang(80, 78, 42) + kubus(48, 62, 60, 10, 58, '#1d1f23', { r: 1.5, atas: '#26292e' })
    + `<polygon points="48,62 77,44.6 137,44.6 108,62" fill="none" stroke="#8b5cf6" stroke-width="1"/>`
    + hdmi(53, 65.5) + rj45(61, 65) + usb(67, 65.7) + led(102, 66, '#22c55e') },
  speakerphone: { l: 'Speakerphone', vb: [18, 24, 124], svg: () => bayang(80, 78, 56, 6)
    + `<path d="M26 54 V62 A54 16 0 0 0 134 62 V54 Z" fill="#202328"/><path d="M26 54 V62 A54 16 0 0 0 134 62 V54 Z" fill="url(#sldg-v)"/>`
    + `<ellipse cx="80" cy="54" rx="54" ry="16" fill="#2c3036"/><ellipse cx="80" cy="54" rx="50" ry="14.4" fill="url(#sldg-jaring)"/>`
    + `<ellipse cx="80" cy="54" rx="14" ry="4.2" fill="none" stroke="#22d3ee" stroke-width="1.2"/><ellipse cx="80" cy="54" rx="18" ry="5.6" fill="#22d3ee" fill-opacity=".12"/>`
    + `<ellipse cx="66" cy="47" rx="26" ry="5" fill="#fff" fill-opacity=".06"/>` },
  videobar: { l: 'Video bar', svg: () => bayang(80, 74, 66) + kubus(12, 50, 128, 20, 16, '#1e2126', { r: 4 })
    + `<rect x="16" y="53" width="120" height="14" rx="3" fill="url(#sldg-jaring)"/><circle cx="76" cy="60" r="7" fill="#2b2f36"/>`
    + `<circle cx="76" cy="60" r="5.4" fill="url(#sldg-lensa)"/>${led(86, 56, '#22c55e', 0.6)}` },
  mic: { l: 'Mikrofon plafon', svg: () => `<rect x="10" y="20" width="140" height="10" fill="#f1f5f9"/>` + bayang(80, 66, 46, 5)
    + `<path d="M36 40 V48 A44 13 0 0 0 124 48 V40 Z" fill="#dfe3e8"/><ellipse cx="80" cy="40" rx="44" ry="13" fill="#f8fafc"/>`
    + `<ellipse cx="80" cy="40" rx="40" ry="11.4" fill="url(#sldg-jaring)" opacity=".25"/><ellipse cx="80" cy="40" rx="9" ry="2.8" fill="none" stroke="#22c55e" stroke-width="1"/>` },
  dsp: { l: 'Audio DSP / hub mic', svg: () => rak1u(14, 50, 112, 18, 50, '#1b1d21')
    + `<rect x="22" y="54" width="22" height="9" rx=".6" fill="#052e2b"/><rect x="23" y="55" width="20" height="7" fill="#10b981" fill-opacity=".55"/>`
    + Array.from({ length: 8 }, (_, i) => `<rect x="${52 + i * 6.5}" y="${55 + (i % 3)}" width="2" height="${8 - (i % 3)}" fill="${i < 5 ? '#22c55e' : '#f59e0b'}"/>`).join('')
    + rj45(108, 56) + led(118, 58, '#3b82f6') },
  amplifier: { l: 'Amplifier', svg: () => rak1u(14, 44, 112, 28, 54, '#16181c')
    + Array.from({ length: 4 }, (_, i) => `<circle cx="${32 + i * 18}" cy="58" r="6" fill="#9aa3ad"/><circle cx="${32 + i * 18}" cy="58" r="4.6" fill="url(#sldg-logam)"/>`
      + `<line x1="${32 + i * 18}" y1="58" x2="${32 + i * 18}" y2="53.6" stroke="#374151" stroke-width=".6"/>`).join('')
    + `<rect x="104" y="52" width="16" height="8" rx=".6" fill="#052e2b"/>${led(112, 66, '#22c55e')}` },
  speaker: { l: 'Speaker', svg: () => bayang(76, 90, 30) + kubus(52, 14, 46, 74, 34, '#1a1c20', { r: 2 })
    + `<circle cx="75" cy="64" r="15" fill="#2b2f36"/><circle cx="75" cy="64" r="13" fill="url(#sldg-kerucut)"/><circle cx="75" cy="64" r="4" fill="#3f4651"/>`
    + `<circle cx="75" cy="32" r="7.5" fill="#2b2f36"/><circle cx="75" cy="32" r="5.6" fill="url(#sldg-kerucut)"/><circle cx="73.6" cy="30.6" r="1.5" fill="#fff" fill-opacity=".3"/>` },
  ups: { l: 'UPS', vb: [28, 10, 112], svg: () => bayang(84, 88, 34) + kubus(60, 24, 40, 64, 56, '#17191d', { r: 2 })
    + `<rect x="66" y="31" width="28" height="12" rx="1" fill="#0a1a3a"/><rect x="67.5" y="32.5" width="25" height="9" fill="#0ea5e9" fill-opacity=".75"/>${kaca(67.5, 32.5, 25, 9)}`
    + `<circle cx="80" cy="52" r="3.4" fill="#2b2f36" stroke="#9aa3ad" stroke-width=".6"/>`
    + Array.from({ length: 6 }, (_, i) => `<rect x="66" y="${62 + i * 3.6}" width="28" height="1.4" rx=".7" fill="#0a0b0d"/>`).join('') },
  mcb: { l: 'MCB / panel listrik', svg: () => bayang(82, 86, 50, 3) + kubus(30, 22, 100, 62, 14, '#eef0f2', { r: 2 })
    + `<rect x="36" y="40" width="88" height="5" fill="url(#sldg-logam)"/>`
    + Array.from({ length: 5 }, (_, i) => `<rect x="${42 + i * 16}" y="32" width="13" height="38" rx="1" fill="#fafafa" stroke="#cbd5e1" stroke-width=".5"/>`
      + `<rect x="${45.5 + i * 16}" y="44" width="6" height="11" rx="1" fill="${i < 3 ? '#1d4ed8' : '#b91c1c'}"/>`).join('') },
  rak: { l: 'Rak perangkat', svg: () => bayang(80, 92, 40) + kubus(52, 8, 52, 82, 44, '#1b1d21', { r: 1 })
    + Array.from({ length: 5 }, (_, i) => `<rect x="56" y="${14 + i * 13}" width="44" height="9" rx=".5" fill="#2b2f36"/>${led(96, 18.5 + i * 13, i % 2 ? '#3b82f6' : '#22c55e', 0.5)}`).join('')
    + `<rect x="54" y="10" width="48" height="78" rx="1" fill="#93c5fd" fill-opacity=".12" stroke="#64748b" stroke-width=".6"/>${kaca(54, 10, 48, 78)}` },
  tirai: { l: 'Motor tirai', svg: () => tirai('#dbe7f3') },
  gorden: { l: 'Motor gorden', svg: () => tirai('#d9ecdf') },
  lampu: { l: 'Lampu', svg: () => `<rect x="8" y="16" width="144" height="8" fill="#f1f5f9"/>` + [34, 80, 126].map(x =>
    `<polygon points="${x - 9},28 ${x + 9},28 ${x + 22},84 ${x - 22},84" fill="url(#sldg-sinar)"/><ellipse cx="${x}" cy="24" rx="15" ry="4.4" fill="#e5e7eb"/>`
    + `<ellipse cx="${x}" cy="24" rx="11" ry="3.2" fill="url(#sldg-hangat)"/><ellipse cx="${x}" cy="24" rx="15" ry="4.4" fill="none" stroke="#cbd5e1" stroke-width=".6"/>`).join('') },
  ac: { l: 'AC split', svg: () => `<rect x="20" y="36" width="122" height="38" rx="6" fill="#0f172a" fill-opacity=".14" filter="url(#sldg-blur)"/>`
    + kubus(18, 32, 120, 36, 14, '#fbfbfc', { r: 6 }) + `<rect x="24" y="58" width="108" height="5" rx="2.5" fill="#cfd4da"/>`
    + `<rect x="24" y="61" width="108" height="2" rx="1" fill="#6b7280" fill-opacity=".35"/>${led(122, 42, '#22c55e')}`
    + [50, 78, 106].map(x => `<path d="M${x} 74 q3 5 0 10" fill="none" stroke="#7dd3fc" stroke-width="1" stroke-linecap="round"/>`).join('') },
  fcu: { l: 'FCU / thermostat', svg: () => kubus(10, 34, 30, 30, 4, '#f8fafc', { r: 3 })
    + `<rect x="14" y="38" width="22" height="13" rx="1" fill="#0f172a"/><text x="25" y="47.6" font-family="Arial" font-size="7" font-weight="700" fill="#38bdf8" text-anchor="middle">24°</text>`
    + bayang(102, 80, 48) + kubus(52, 30, 96, 44, 18, '#e9ecef', { r: 2 })
    + Array.from({ length: 13 }, (_, i) => `<rect x="${58 + i * 6.6}" y="36" width="3.2" height="32" rx="1.2" fill="#9aa3ad" fill-opacity=".55"/>`).join('') },
  umum: { l: 'Perangkat lain', vb: [30, 26, 124], svg: () => bayang(80, 76, 46) + kubus(36, 54, 88, 20, 48, '#24272c', { r: 1.5 })
    + hdmi(42, 61) + rj45(50, 60.5) + usb(57, 61.3) + led(108, 60, '#22c55e') + led(113, 60, '#3b82f6') },
};

function tirai(warna: string): string {
  const panel = (x: number) => `<path d="M${x} 16 H${x + 52} V84 q-6.5 3 -13 0 t-13 0 t-13 0 t-13 0 Z" fill="${warna}"/>`
    + `<path d="M${x} 16 H${x + 52} V84 q-6.5 3 -13 0 t-13 0 t-13 0 t-13 0 Z" fill="url(#sldg-lipat)"/>`;
  return bayang(80, 90, 62, 3) + panel(24) + panel(84)
    + `<rect x="18" y="11" width="124" height="5" rx="2.5" fill="url(#sldg-logam)"/><rect x="18" y="11" width="124" height="5" rx="2.5" fill="none" stroke="#9aa3ad" stroke-width=".4"/>`
    + kubus(136, 7, 12, 11, 6, '#24272c', { r: 1.5 }) + led(142, 12.5, '#22c55e', 0.5);
}

export const DAFTAR_IKON = Object.entries(IKON).map(([v, x]) => ({ v, l: x.l }));

export const isiIkon = (ikon: string) => DEFS + DEFS_LAYAR + (IKON[ikon] ?? IKON.umum).svg();

export const viewBoxIkon = (ikon: string) => {
  const [x, y, w] = (IKON[ikon] ?? IKON.umum).vb ?? [0, 0, 160];
  return `${x} ${y} ${w} ${n(w / 1.6)}`;
};

export function svgIkon(ikon: string, x: number, y: number, w: number, h: number): string {
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBoxIkon(ikon)}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${isiIkon(ikon)}</svg>`;
}
