import { jumlahLanPanel, panelUmum, panelUntuk, svgPanelController, type PanelController, type TandaPort } from '@/lib/av/panel-controller';
import { type DataKoneksi, type Susunan, warnaPort } from './data';

export const MAKS_PANEL = 4;

export interface GambarPanel { judul: string; svg: string }

function panelDipakai(d: DataKoneksi, t: Susunan): PanelController | null {
  if (t.ppkPenuh <= 0) return null;
  const resmi = panelUntuk(d.namaHw);
  if (resmi && jumlahLanPanel(resmi) === t.ppkPenuh) return resmi;
  return panelUmum(d.namaHw ? `${d.namaHw}${resmi ? ' (port diatur manual)' : ''}` : 'Controller', t.ppkPenuh);
}

export function gambarPanelKoneksi(d: DataKoneksi, t: Susunan): { gambar: GambarPanel[]; sisa: number } {
  const panel = panelDipakai(d, t);
  if (!panel || t.controller <= 0) return { gambar: [], sisa: 0 };
  const per = Array.from({ length: t.controller }, () => new Map<number, TandaPort>());
  for (const p of t.hasil.port) {
    if (!p.jumlah) continue;
    const ke = t.ppk > 0 ? Math.ceil(p.port / t.ppk) - 1 : 0;
    const lokal = t.ppk > 0 ? ((p.port - 1) % t.ppk) + 1 : p.port;
    const peta = per[ke];
    if (!peta) continue;
    peta.set(lokal, { warna: warnaPort(p.port), label: `P${p.port}` });
    if (t.cadangan === 'loop' && t.ppk > 0) peta.set(lokal + t.ppk, { warna: warnaPort(p.port), label: `B${p.port}`, cadangan: true });
  }
  const nama = panel.model;
  const daftar: GambarPanel[] = per.map((tanda, i) => ({
    judul: `${t.controller > 1 ? `Controller ${i + 1} · ` : ''}${nama}`,
    svg: svgPanelController(panel, `${t.controller > 1 ? `Controller ${i + 1} · ` : ''}${nama}`, tanda),
  }));
  if (t.cadangan === 'controller') {
    per.forEach((tanda, i) => {
      const cadangan = new Map([...tanda].map(([k, v]) => [k, { ...v, label: v.label.replace('P', 'B'), cadangan: true }]));
      const judul = `Controller cadangan${t.controller > 1 ? ` ${i + 1}` : ''} · ${nama}`;
      daftar.push({ judul, svg: svgPanelController(panel, judul, cadangan) });
    });
  }
  return { gambar: daftar.slice(0, MAKS_PANEL), sisa: Math.max(0, daftar.length - MAKS_PANEL) };
}
