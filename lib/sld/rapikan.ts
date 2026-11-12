import { geometri, hurufPerangkat, kotakTampak, type Kotak } from './geometri';
import { letakLabel } from './lembar1';
import { potongKotak, potongRuas } from './rute';
import { areaDok, type DokSLD, type GeoKabel, type Perangkat, type PosisiLabel } from './tipe';

const POLA_JUMLAH = /\s+(?:\(\s*(\d{1,4})\s*[x×]\s*\)|[x×]\s?(\d{1,4})|(\d{1,4})\s?[x×])\s*$/i;

export function jumlahDariNama(nama: string): { n: number; nama: string } | null {
  const m = POLA_JUMLAH.exec(nama);
  const n = m ? Number(m[1] ?? m[2] ?? m[3]) : 0;
  const sisa = m ? nama.slice(0, m.index).trim() : '';
  return n >= 2 && sisa ? { n, nama: sisa } : null;
}

export const qtyDiNama = (d: Pick<DokSLD, 'perangkat'>) => d.perangkat.filter(p => !(p.qty > 1) && !!jumlahDariNama(p.nama));

export function terapkanQtyDiNama<T extends Pick<DokSLD, 'perangkat'>>(d: T): T {
  return { ...d, perangkat: d.perangkat.map(p => { const j = p.qty > 1 ? null : jumlahDariNama(p.nama); return j ? { ...p, qty: j.n, nama: j.nama } : p; }) };
}

export function kotakLabel(p: Perangkat, f = 1): Kotak | null {
  const l = letakLabel(p, f);
  return l.w > 0 && l.h > 0 ? { x: l.kanan ? l.x - l.w : l.x, y: l.atas, w: l.w, h: l.h } : null;
}

const URUT_COBA: PosisiLabel[] = ['bawah', 'kanan', 'atas', 'kiri', 'kanan-bawah', 'kiri-bawah', 'kanan-atas', 'kiri-atas'];

function penghalang(d: DokSLD, geo: GeoKabel[]) {
  const ruas = geo.flatMap(g => g.garis.flatMap(gr => gr.titik.slice(1).map((t, i) => [gr.titik[i], t] as const)));
  const kotak = new Map(d.perangkat.map(p => [p.id, kotakTampak(p)]));
  return { ruas, kotak };
}

function tabrakLabel(k: Kotak, id: string, h: ReturnType<typeof penghalang>, label: Kotak[], area: Kotak): boolean {
  if (k.x < area.x || k.y < area.y || k.x + k.w > area.x + area.w || k.y + k.h > area.y + area.h) return true;
  if (h.ruas.some(([a, b]) => potongRuas(a, b, k, 0.3))) return true;
  for (const [pid, b] of h.kotak) if (pid !== id && potongKotak(b, k)) return true;
  return label.some(l => potongKotak(l, k));
}

export function labelTertimpa(d: DokSLD, geo: GeoKabel[] = geometri(d)): string[] {
  const h = penghalang(d, geo), area = areaDok(d), semua = d.perangkat.map(p => kotakLabel(p, hurufPerangkat(p, d)));
  return d.perangkat.filter((p, i) => { const k = semua[i]; return !!k && tabrakLabel(k, p.id, h, semua.filter((x, j): x is Kotak => j !== i && !!x), area); }).map(p => p.id);
}

export function rapikanLabel(d: DokSLD, geo: GeoKabel[] = geometri(d)): { dok: DokSLD; dipindah: number } {
  const h = penghalang(d, geo), area = areaDok(d), salah = new Set(labelTertimpa(d, geo));
  const tetap: Kotak[] = d.perangkat.filter(p => !salah.has(p.id)).map(p => kotakLabel(p, hurufPerangkat(p, d))).filter((k): k is Kotak => !!k);
  let dipindah = 0;
  const perangkat = d.perangkat.map(p => {
    if (!salah.has(p.id)) return p;
    const f = hurufPerangkat(p, d);
    for (const pos of URUT_COBA) {
      const cobaP = { ...p, labelDi: pos === 'bawah' ? undefined : pos }, k = kotakLabel(cobaP, f);
      if (k && !tabrakLabel(k, p.id, h, tetap, area)) {
        tetap.push(k);
        if ((p.labelDi ?? 'bawah') !== pos) dipindah++;
        return cobaP;
      }
    }
    const k = kotakLabel(p, f);
    if (k) tetap.push(k);
    return p;
  });
  return { dok: { ...d, perangkat }, dipindah };
}
