import { SENDING_CARD, VIDEO_PROCESSOR } from '../lib/av/hitung-led';
import { jumlahLanPanel, panelUmum, panelUntuk, PANEL_CONTROLLER, svgPanelController, type TandaPort } from '../lib/av/panel-controller';

let lulus = 0, gagal = 0;
const cek = (n: string, ok: boolean, c = '') => {
  if (ok) { lulus++; console.log(`  ok    ${n}`); }
  else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); }
};

console.log('\n1. Setiap controller di katalog punya panel dengan jumlah LAN yang sama');
for (const hw of [...SENDING_CARD, ...VIDEO_PROCESSOR]) {
  const p = panelUntuk(hw.nama);
  if (hw.nama === 'V1260') { cek('V1260 tanpa spesifikasi resmi memakai panel umum', !p); continue; }
  cek(`${hw.nama}: ${hw.port} port`, !!p && jumlahLanPanel(p) === hw.port, p ? `panel ${jumlahLanPanel(p)}` : 'panel tidak ada');
}

console.log('\n2. Panel bersumber resmi');
cek('semua panel punya sumber', PANEL_CONTROLLER.every(p => p.sumber.startsWith('https://')));
cek('sumber NovaStar dari oss.novastar.tech', PANEL_CONTROLLER.filter(p => p.merek === 'NovaStar').every(p => p.sumber.startsWith('https://oss.novastar.tech/')));

console.log('\n3. Gambar menandai port yang dipakai');
{
  const p = panelUntuk('MCTRL700')!;
  const tanda = new Map<number, TandaPort>([[1, { warna: '#2563eb', label: 'P1' }], [2, { warna: '#16a34a', label: 'P2' }]]);
  const svg = svgPanelController(p, 'MCTRL700', tanda);
  cek('label P1 & P2 tampil', svg.includes('>P1<') && svg.includes('>P2<'));
  cek('warna port dipakai', svg.includes('fill="#2563eb"') && svg.includes('fill="#16a34a"'));
  cek('nomor port 1-6 tertulis', [1, 2, 3, 4, 5, 6].every(n => svg.includes(`>${n}</text>`)));
  cek('SVG aman (tanpa script)', !/<script|\son[a-z]+=/i.test(svg));
}
{
  const u = panelUmum('V1260', 16);
  cek('panel umum 16 port', jumlahLanPanel(u) === 16 && !!u.catatan);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
