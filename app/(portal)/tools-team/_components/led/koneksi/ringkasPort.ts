import { namaPort, type Susunan } from './data';

export interface BarisPort { unit: string; dari: number; sampai: number; jumlah: number; px: number; beban: number }

export function ringkasPort(t: Susunan): BarisPort[] {
  const baris: BarisPort[] = [];
  for (const p of t.hasil.port) {
    if (!p.jumlah) continue;
    const m = /^(.*?)(?: · )?port (\d+)$/i.exec(namaPort(t, p.port));
    const unit = (m?.[1] ?? '').replace(/^./, c => c.toUpperCase()) || 'Controller', no = m ? Number(m[2]) : p.port;
    const akhir = baris[baris.length - 1];
    if (akhir && akhir.unit === unit && akhir.sampai === no - 1 && akhir.jumlah === p.jumlah && akhir.px === p.px && Math.round(akhir.beban) === Math.round(p.beban)) akhir.sampai = no;
    else baris.push({ unit, dari: no, sampai: no, jumlah: p.jumlah, px: p.px, beban: p.beban });
  }
  return baris;
}

export const teksRentang = (b: BarisPort) => (b.dari === b.sampai ? `port ${b.dari}` : `port ${b.dari}–${b.sampai} (${b.sampai - b.dari + 1} port)`);
