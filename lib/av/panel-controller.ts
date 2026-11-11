export type JenisKonektor =
  | 'rj45' | 'rj45-neutrik' | 'opt' | 'hdmi' | 'dvi' | 'dp' | 'bnc' | 'usb-a' | 'usb-b' | 'audio' | 'serial' | 'sensor' | 'lan' | 'ir' | 'ac';

export interface Konektor { jenis: JenisKonektor; label: string; jumlah?: number }
export interface KelompokPanel { judul: 'Input' | 'Loop' | 'Output' | 'Kontrol' | 'Daya'; isi: Konektor[] }

export interface PanelController {
  model: string;
  merek: 'NovaStar' | 'Hikvision';
  rak: '1U' | '1U ½' | '2U';
  kelompok: KelompokPanel[];
  sumber: string;
  catatan?: string;
}

const AC: KelompokPanel = { judul: 'Daya', isi: [{ jenis: 'ac', label: 'AC 100–240V' }] };
const lanOut = (n: number, neutrik = false): Konektor => ({ jenis: neutrik ? 'rj45-neutrik' : 'rj45', label: 'Ethernet', jumlah: n });
const SPEK = 'https://oss.novastar.tech/uploads/';

export const PANEL_CONTROLLER: PanelController[] = [
  {
    model: 'MCTRL300', merek: 'NovaStar', rak: '1U ½', sumber: `${SPEK}2024/11/MCTRL300-LED-Display-Controller-Specifications-V2.4.1.pdf`,
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'dvi', label: 'DVI IN' }, { jenis: 'audio', label: 'AUDIO' }] },
      { judul: 'Output', isi: [lanOut(2)] },
      { judul: 'Kontrol', isi: [{ jenis: 'usb-b', label: 'USB' }, { jenis: 'serial', label: 'UART IN' }, { jenis: 'serial', label: 'UART OUT' }, { jenis: 'sensor', label: 'LIGHT SENSOR' }] },
      AC,
    ],
  },
  {
    model: 'MCTRL600', merek: 'NovaStar', rak: '1U', sumber: `${SPEK}2025/07/MCTRL600-LED-Display-Controller-Specifications-V2.3.4.pdf`,
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'dvi', label: 'DVI IN' }, { jenis: 'hdmi', label: 'HDMI IN' }, { jenis: 'audio', label: 'AUDIO' }] },
      { judul: 'Output', isi: [lanOut(4)] },
      { judul: 'Kontrol', isi: [{ jenis: 'usb-b', label: 'USB' }, { jenis: 'serial', label: 'UART IN' }, { jenis: 'serial', label: 'UART OUT' }, { jenis: 'sensor', label: 'LIGHT SENSOR' }] },
      AC,
    ],
  },
  {
    model: 'MCTRL660', merek: 'NovaStar', rak: '1U', sumber: `${SPEK}2024/11/MCTRL660-LED-Display-Controller-Specifications-V1.4.4.pdf`,
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'dvi', label: 'DVI IN' }, { jenis: 'hdmi', label: 'HDMI IN' }, { jenis: 'audio', label: 'AUDIO' }] },
      { judul: 'Loop', isi: [{ jenis: 'dvi', label: 'DVI OUT' }, { jenis: 'hdmi', label: 'HDMI OUT' }] },
      { judul: 'Output', isi: [lanOut(4)] },
      { judul: 'Kontrol', isi: [{ jenis: 'usb-b', label: 'USB' }, { jenis: 'serial', label: 'UART IN' }, { jenis: 'serial', label: 'UART OUT' }] },
      AC,
    ],
  },
  {
    model: 'MCTRL660 PRO', merek: 'NovaStar', rak: '1U', sumber: `${SPEK}2025/12/MCTRL660-PRO-Independent-Controller-Specifications-V1.4.2.pdf`,
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'bnc', label: '3G-SDI IN' }, { jenis: 'hdmi', label: 'HDMI 1.4a IN' }, { jenis: 'dvi', label: 'DVI IN' }] },
      { judul: 'Loop', isi: [{ jenis: 'bnc', label: '3G-SDI LOOP' }, { jenis: 'hdmi', label: 'HDMI LOOP' }, { jenis: 'dvi', label: 'DVI LOOP' }] },
      { judul: 'Output', isi: [lanOut(6), { jenis: 'opt', label: 'OPT1' }, { jenis: 'opt', label: 'OPT2' }] },
      { judul: 'Kontrol', isi: [
        { jenis: 'lan', label: 'ETHERNET' }, { jenis: 'usb-b', label: 'USB IN' }, { jenis: 'usb-a', label: 'USB OUT' },
        { jenis: 'bnc', label: 'GENLOCK IN' }, { jenis: 'bnc', label: 'GENLOCK LOOP' },
      ] },
      AC,
    ],
  },
  {
    model: 'MCTRL700', merek: 'NovaStar', rak: '1U', sumber: `${SPEK}2024/11/MCTRL700-LED-Display-Controller-Specifications-V1.2.2.pdf`,
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'dvi', label: 'DVI IN' }, { jenis: 'hdmi', label: 'HDMI IN' }, { jenis: 'audio', label: 'AUDIO' }] },
      { judul: 'Loop', isi: [{ jenis: 'dvi', label: 'DVI LOOP' }, { jenis: 'hdmi', label: 'HDMI LOOP' }] },
      { judul: 'Output', isi: [lanOut(6)] },
      { judul: 'Kontrol', isi: [{ jenis: 'usb-b', label: 'USB' }, { jenis: 'serial', label: 'UART IN' }, { jenis: 'serial', label: 'UART OUT' }] },
      AC,
    ],
  },
  {
    model: 'MCTRL4K', merek: 'NovaStar', rak: '1U', sumber: `${SPEK}2025/12/MCTRL4K-LED-Display-Controller-Specifications-V1.2.2.pdf`,
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'dp', label: 'DP 1.2' }, { jenis: 'hdmi', label: 'HDMI 2.0' }, { jenis: 'dvi', label: 'DL-DVI', jumlah: 2 }] },
      { judul: 'Output', isi: [lanOut(16, true), { jenis: 'opt', label: 'OPT', jumlah: 4 }] },
      { judul: 'Kontrol', isi: [{ jenis: 'lan', label: 'ETHERNET' }, { jenis: 'usb-b', label: 'USB IN' }, { jenis: 'usb-a', label: 'USB OUT' }] },
      AC,
    ],
  },
  ...['DS-DT20C-01HI02NO', 'DS-DT20C-01HI04NO', 'DS-DT20C-01HI06NO'].map((model, i): PanelController => ({
    model, merek: 'Hikvision', rak: '1U ½',
    sumber: 'https://display.hikvision.com/content/dam/hikvision/products/S000000001/S000013643/S000019843/S000019858/OFR029609/M000140344/Data_Sheet/DS-DT20C-01HI04NO_Datasheet_20240619.pdf',
    catatan: i === 1 ? undefined : 'Konektor selain jumlah port LED mengikuti datasheet DS-DT20C-01HI04NO (satu seri).',
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'hdmi', label: 'HDMI 1.4 IN' }] },
      { judul: 'Output', isi: [{ jenis: 'rj45', label: 'LED OUT', jumlah: [2, 4, 6][i] }, { jenis: 'audio', label: 'AUDIO OUT' }] },
      { judul: 'Kontrol', isi: [{ jenis: 'lan', label: 'NETWORK', jumlah: 2 }, { jenis: 'usb-a', label: 'USB 2.0' }, { jenis: 'serial', label: 'RS-485' }, { jenis: 'serial', label: 'DEBUG' }, { jenis: 'ir', label: 'IR' }] },
      AC,
    ],
  })),
  ...([['VX400 Pro', 4, '2025/09/VX400-Pro-All-in-One-Controller-Specifications-V1.1.1.pdf'], ['VX600 Pro', 6, '2025/10/VX600-Pro-All-in-One-Controller-Specifications-V1.2.0.pdf'],
    ['VX1000 Pro', 10, '2025/10/VX1000-Pro-All-in-One-Controller-Specifications-V1.2.0.pdf']] as const).map(([model, lan, berkas]): PanelController => ({
    model, merek: 'NovaStar', rak: '2U', sumber: `${SPEK}${berkas}`,
    kelompok: ([
      { judul: 'Input', isi: [{ jenis: 'hdmi', label: 'HDMI 2.0 IN' }, { jenis: 'hdmi', label: 'HDMI 1.3', jumlah: 2 }, { jenis: 'bnc', label: '3G-SDI IN' }, { jenis: 'opt', label: 'OPT 1' }, { jenis: 'usb-a', label: 'USB 3.0' }] },
      { judul: 'Loop', isi: [{ jenis: 'hdmi', label: 'HDMI 2.0 LOOP' }, { jenis: 'bnc', label: '3G-SDI LOOP' }] },
      { judul: 'Output', isi: [lanOut(lan), { jenis: 'opt', label: 'OPT 2', jumlah: 2 }, ...(model === 'VX400 Pro' ? [{ jenis: 'hdmi' as const, label: 'HDMI MONITOR' }] : [])] },
      { judul: 'Kontrol', isi: [
        ...(model === 'VX1000 Pro' ? [{ jenis: 'bnc' as const, label: 'GENLOCK IN' }, { jenis: 'bnc' as const, label: 'GENLOCK LOOP' }, { jenis: 'usb-b' as const, label: 'USB' }] : []),
        ...(model === 'VX400 Pro' ? [{ jenis: 'serial' as const, label: 'RS232' }] : []),
        ...(model === 'VX600 Pro' ? [] : [{ jenis: 'sensor' as const, label: 'LIGHT SENSOR' }]),
      ] },
      AC,
    ] satisfies KelompokPanel[]).filter(k => k.isi.length > 0),
  })),
  {
    model: 'VX2000 Pro', merek: 'NovaStar', rak: '2U', sumber: `${SPEK}2024/12/VX2000-Pro-All-in-One-Controller-Specifications-V1.0.1.pdf`,
    catatan: 'Jumlah port fiber: spesifikasi menyebut 2× (fitur) dan 4× (detail); digambar 4.',
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'dp', label: 'DP 1.2' }, { jenis: 'hdmi', label: 'HDMI 2.0', jumlah: 2 }, { jenis: 'hdmi', label: 'HDMI 1.3', jumlah: 4 }, { jenis: 'bnc', label: '12G-SDI IN' }] },
      { judul: 'Loop', isi: [{ jenis: 'bnc', label: '12G-SDI LOOP' }] },
      { judul: 'Output', isi: [lanOut(20), { jenis: 'opt', label: 'OPT', jumlah: 4 }, { jenis: 'hdmi', label: 'HDMI MONITOR' }] },
      AC,
    ],
  },
  {
    model: 'NovaPro UHD Jr', merek: 'NovaStar', rak: '2U', sumber: `${SPEK}2024/07/NovaPro-UHD-Jr-All-in-One-Controller-Specifications-V1.5.0.pdf`,
    kelompok: [
      { judul: 'Input', isi: [{ jenis: 'dp', label: 'DP 1.2' }, { jenis: 'hdmi', label: 'HDMI 2.0 IN' }, { jenis: 'bnc', label: '12G-SDI IN', jumlah: 2 }, { jenis: 'dvi', label: 'DVI', jumlah: 4 }] },
      { judul: 'Loop', isi: [{ jenis: 'hdmi', label: 'HDMI LOOP' }, { jenis: 'bnc', label: '12G-SDI LOOP', jumlah: 2 }] },
      { judul: 'Output', isi: [lanOut(16, true), { jenis: 'opt', label: 'OPT', jumlah: 4 }, { jenis: 'hdmi', label: 'MONITOR' }] },
      AC,
    ],
  },
];

export const panelUntuk = (nama: string | null | undefined): PanelController | null =>
  (nama ? PANEL_CONTROLLER.find(p => p.model.toLowerCase() === nama.trim().toLowerCase()) ?? null : null);

export function panelUmum(nama: string, jumlahPort: number): PanelController {
  return {
    model: nama, merek: 'NovaStar', rak: jumlahPort > 10 ? '2U' : '1U', sumber: '',
    catatan: 'Spesifikasi resmi tipe ini tidak tersedia di situs pabrikan; hanya port LAN yang digambar.',
    kelompok: [{ judul: 'Output', isi: [lanOut(Math.max(1, jumlahPort))] }, AC],
  };
}

export const jumlahLanPanel = (p: PanelController) =>
  p.kelompok.flatMap(k => k.judul === 'Output' ? k.isi : []).filter(k => k.jenis === 'rj45' || k.jenis === 'rj45-neutrik').reduce((a, k) => a + (k.jumlah ?? 1), 0);

export interface TandaPort { warna: string; label: string; cadangan?: boolean }

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const HURUF = 'font-family="Segoe UI,Arial"';
const LEBAR: Record<JenisKonektor, number> = {
  rj45: 22, 'rj45-neutrik': 26, opt: 22, hdmi: 30, dvi: 50, dp: 28, bnc: 22, 'usb-a': 22, 'usb-b': 18, audio: 18, serial: 26, sensor: 18, lan: 22, ir: 16, ac: 40,
};

function bentuk(j: JenisKonektor, x: number, y: number, tandai: TandaPort | null): string {
  const w = LEBAR[j], isi = tandai ? tandai.warna : '#1f2937', garis = tandai ? tandai.warna : '#94a3b8';
  const tepi = tandai ? `stroke="${garis}" stroke-width="2"${tandai.cadangan ? ' stroke-dasharray="3 2"' : ''}` : `stroke="${garis}" stroke-width="1"`;
  switch (j) {
    case 'rj45': case 'rj45-neutrik': case 'lan': {
      const h = j === 'rj45-neutrik' ? 26 : 20;
      const ring = j === 'rj45-neutrik' ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${h / 2}" fill="none" stroke="#64748b" stroke-width="1.2"/>` : '';
      return `${ring}<rect x="${x + (j === 'rj45-neutrik' ? 4 : 0)}" y="${y + (j === 'rj45-neutrik' ? 4 : 0)}" width="${j === 'rj45-neutrik' ? 18 : w}" height="${j === 'rj45-neutrik' ? 18 : h}" rx="2" fill="${isi}" ${tepi}/>`
        + `<rect x="${x + w / 2 - 4}" y="${y + (j === 'rj45-neutrik' ? 18 : 15)}" width="8" height="4" fill="#0f172a"/>`;
    }
    case 'opt': return `<rect x="${x}" y="${y + 3}" width="${w}" height="14" rx="2" fill="${isi}" ${tepi}/><rect x="${x + 4}" y="${y + 7}" width="5" height="6" fill="#e2e8f0"/><rect x="${x + 13}" y="${y + 7}" width="5" height="6" fill="#e2e8f0"/>`;
    case 'hdmi': return `<path d="M${x} ${y + 5} H${x + w} V${y + 11} L${x + w - 4} ${y + 16} H${x + 4} L${x} ${y + 11} Z" fill="${isi}" ${tepi}/>`;
    case 'dp': return `<path d="M${x} ${y + 5} H${x + w} V${y + 16} H${x + 5} L${x} ${y + 11} Z" fill="${isi}" ${tepi}/>`;
    case 'dvi': return `<path d="M${x} ${y + 4} H${x + w} L${x + w - 4} ${y + 17} H${x + 4} Z" fill="${isi}" ${tepi}/>`
      + Array.from({ length: 8 }, (_, i) => `<circle cx="${x + 9 + i * 4.6}" cy="${y + 10.5}" r="1" fill="#94a3b8"/>`).join('');
    case 'bnc': return `<circle cx="${x + w / 2}" cy="${y + 10}" r="9" fill="#cbd5e1" stroke="#64748b"/><circle cx="${x + w / 2}" cy="${y + 10}" r="4" fill="${isi}" ${tepi}/>`;
    case 'usb-a': return `<rect x="${x}" y="${y + 6}" width="${w}" height="9" rx="1" fill="${isi}" ${tepi}/><rect x="${x + 3}" y="${y + 8}" width="${w - 6}" height="3" fill="#e2e8f0"/>`;
    case 'usb-b': return `<path d="M${x} ${y + 4} H${x + w} V${y + 18} H${x} Z" fill="${isi}" ${tepi}/><path d="M${x + 4} ${y + 7} H${x + w - 4} V${y + 13} L${x + w - 7} ${y + 15} H${x + 7} L${x + 4} ${y + 13} Z" fill="#e2e8f0"/>`;
    case 'audio': case 'sensor': case 'ir': return `<circle cx="${x + w / 2}" cy="${y + 10}" r="${j === 'ir' ? 5 : 7}" fill="${isi}" ${tepi}/><circle cx="${x + w / 2}" cy="${y + 10}" r="2.5" fill="#e2e8f0"/>`;
    case 'serial': return `<rect x="${x}" y="${y + 4}" width="${w}" height="13" rx="2" fill="#16a34a" stroke="#14532d"/>`
      + Array.from({ length: 4 }, (_, i) => `<circle cx="${x + 5 + i * 5.3}" cy="${y + 10.5}" r="1.4" fill="#052e16"/>`).join('');
    case 'ac': return `<rect x="${x}" y="${y}" width="24" height="20" rx="3" fill="#1f2937" stroke="#94a3b8"/>`
      + [5, 11, 17].map(d => `<rect x="${x + d}" y="${y + 5}" width="3" height="8" fill="#e2e8f0"/>`).join('')
      + `<rect x="${x + 28}" y="${y + 3}" width="12" height="14" rx="2" fill="#dc2626"/>`;
  }
}

export function svgPanelController(p: PanelController, judul: string, tandaLan: Map<number, TandaPort>): string {
  const JARAK = 7, ATAS = 58, BARIS = 50;
  const kisi: string[] = [];
  let x = 18, nomorLan = 0, barisMaks = 1;
  const barisLan = (n: number) => (n > 10 ? 2 : 1);
  for (const k of p.kelompok) {
    const awal = x;
    const isi: string[] = [];
    for (const kon of k.isi) {
      const n = kon.jumlah ?? 1, w = LEBAR[kon.jenis];
      const lan = k.judul === 'Output' && (kon.jenis === 'rj45' || kon.jenis === 'rj45-neutrik');
      const baris = lan ? barisLan(n) : 1, perBaris = Math.ceil(n / baris);
      barisMaks = Math.max(barisMaks, baris);
      const teks = lan && baris > 1 ? `${kon.label} 1–${n}` : `${kon.label}${n > 1 && !lan ? ` ×${n}` : ''}`;
      const lebarKon = Math.max(perBaris * (w + JARAK) - JARAK, 0);
      const lebarBlok = Math.max(lebarKon, teks.length * 4.9 + 4);
      const ax = x + (lebarBlok - lebarKon) / 2;
      isi.push(`<text x="${x + lebarBlok / 2}" y="${ATAS + 18}" font-size="8" text-anchor="middle" fill="#e2e8f0" ${HURUF}>${esc(teks)}</text>`);
      for (let i = 0; i < n; i++) {
        const b = Math.floor(i / perBaris), c = i % perBaris;
        const cx = ax + c * (w + JARAK), cy = ATAS + 34 + b * BARIS;
        const nomor = lan ? ++nomorLan : 0;
        const tanda = lan ? tandaLan.get(nomor) ?? null : null;
        isi.push(bentuk(kon.jenis, cx, cy, tanda));
        if (lan) {
          isi.push(`<text x="${cx + w / 2}" y="${cy + (kon.jenis === 'rj45-neutrik' ? 36 : 32)}" font-size="8.5" text-anchor="middle" fill="#cbd5e1" ${HURUF}>${nomor}</text>`);
          if (tanda) {
            isi.push(`<text x="${cx + w / 2}" y="${cy - 3}" font-size="9" font-weight="800" text-anchor="middle" fill="${tanda.warna}" stroke="#334155" stroke-width="2.5" paint-order="stroke" ${HURUF}>${esc(tanda.label)}</text>`);
          }
        } else if (n > 1) {
          isi.push(`<text x="${cx + w / 2}" y="${cy + 32}" font-size="8" text-anchor="middle" fill="#94a3b8" ${HURUF}>${i + 1}</text>`);
        }
      }
      x += lebarBlok + 12;
    }
    kisi.push(`<text x="${awal}" y="${ATAS - 6}" font-size="9" font-weight="800" fill="#475569" letter-spacing="0.6" ${HURUF}>${k.judul.toUpperCase()}</text>`);
    kisi.push(`<line x1="${awal}" y1="${ATAS - 2}" x2="${x - 12}" y2="${ATAS - 2}" stroke="#94a3b8" stroke-width="1"/>`);
    kisi.push(...isi);
    x += 12;
  }
  const tinggiPanel = Math.max(p.rak === '2U' ? 110 : 84, 34 + barisMaks * BARIS + 6);
  const W = Math.max(x + 8, 360), H = ATAS + tinggiPanel + (p.catatan ? 26 : 12);
  const kaki = [p.merek, p.rak, p.sumber ? 'skema dari spesifikasi resmi' : ''].filter(Boolean).join(' · ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<text x="10" y="16" font-size="12" font-weight="800" fill="#0f172a" ${HURUF}>${esc(judul)}</text>`
    + `<text x="10" y="31" font-size="9.5" fill="#64748b" ${HURUF}>Tampak belakang · ${esc(kaki)}</text>`
    + `<rect x="6" y="${ATAS + 4}" width="${W - 12}" height="${tinggiPanel}" rx="6" fill="#334155" stroke="#0f172a" stroke-width="1.5"/>`
    + kisi.join('')
    + (p.catatan ? `<text x="10" y="${H - 8}" font-size="9" fill="#92400e" ${HURUF}>${esc(p.catatan)}</text>` : '')
    + `</svg>`;
}
