import { ukuranDariDiagonal } from '@/lib/av/hitung';
import { angkaDari, bacaPoligonShift, type EntriPustaka, teksDari } from '@/lib/pustaka';
import { PANEL_VW_AWAL } from './produk';
import { throwRatioDari } from './proyektor';
import type { Benda, Jenis, PanelVW, RasioProyektor, ResolusiProyektor } from './tipe';

export const PUSTAKA_UNTUK: Partial<Record<Jenis, string>> = {
  proyektor: 'proyektor', videowall: 'display', tv: 'display', ifp: 'display', speaker: 'speaker', 'speaker-plafon': 'speaker',
};

const RESOLUSI: Record<string, [number, number]> = { XGA: [1024, 768], WXGA: [1280, 800], FHD: [1920, 1080], WUXGA: [1920, 1200], '4K': [3840, 2160], '4KDCI': [4096, 2160] };
const bulat = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export function cocokPustaka(jenis: Jenis, e: EntriPustaka): boolean {
  if (PUSTAKA_UNTUK[jenis] !== e.jenis) return false;
  if (e.jenis === 'display') return jenis === 'videowall' ? angkaDari(e, 'bezel') > 0 : angkaDari(e, 'bezel') <= 0;
  if (e.jenis === 'speaker') return (teksDari(e, 'tipe') === 'plafon') === (jenis === 'speaker-plafon');
  return true;
}

export function isiDariPustaka(b: Benda, e: EntriPustaka): Partial<Benda> | null {
  if (!cocokPustaka(b.jenis, e)) return null;
  const nama = e.nama.slice(0, 120);
  if (b.jenis === 'proyektor') {
    const trMin = angkaDari(e, 'throwMin'), trMax = Math.max(trMin, angkaDari(e, 'throwMaks'));
    const lumen = Math.round(angkaDari(e, 'lumen'));
    const tr = Math.min(trMax, Math.max(trMin, throwRatioDari(b)));
    const rasioDari: Record<string, RasioProyektor> = { XGA: '4:3', FHD: '16:9', '4K': '16:9', WUXGA: '16:10', WXGA: '16:10', '4KDCI': '17:9' };
    const rasioProyektor = rasioDari[teksDari(e, 'resolusi')];
    const resolusiProyektor = rasioProyektor ? (teksDari(e, 'resolusi') as ResolusiProyektor) : undefined;
    const ada = (k: string) => typeof e.data[k] === 'number';
    const angka = (k: string, skala = 1) => (ada(k) ? bulat(angkaDari(e, k) / skala, 6) : undefined);
    const lensa: Partial<Benda> = {
      koreksiJarak: angka('koreksiJarak'), koreksiJarakTele: angka('koreksiJarakTele'),
      shiftAtasMaks: angka('shiftAtas', 100), shiftBawahMaks: angka('shiftBawah', 100), shiftHMaks: angka('shiftHorizontal', 100),
      offsetTetap: angka('offsetTetap', 100), kontrasAsli: ada('kontras') ? angkaDari(e, 'kontras') : undefined, koefRasio: undefined, sumberLensa: undefined,
      poligonShift: bacaPoligonShift(teksDari(e, 'poligonShift')),
      ...(ada('offsetTetap') ? { offsetLensa: angka('offsetTetap', 100), geserLensaH: 0 } : {}),
    };
    return { nama, ...(lumen > 0 ? { lumen } : {}), ...(trMin > 0 ? { trMin, trMax, throwRatio: bulat(tr, 6) } : {}), ...(rasioProyektor ? { rasioProyektor, resolusiProyektor } : { resolusiProyektor: undefined }), ...lensa };
  }
  if (b.jenis === 'videowall') {
    const u = ukuranDariDiagonal(angkaDari(e, 'diagonal'));
    const bezelMm = angkaDari(e, 'bezel');
    const [resX, resY] = RESOLUSI[teksDari(e, 'resolusi')] ?? [1920, 1080];
    const watt = angkaDari(e, 'watt');
    const lama = { ...PANEL_VW_AWAL, ...(b.panel ?? {}) };
    const panel: PanelVW = { ...lama, w: bulat(u.lebarM + bezelMm / 1000, 4), h: bulat(u.tinggiM + bezelMm / 1000, 4), bezelMm, resX, resY,
      ...(watt > 0 ? { wTipikal: watt, wMaks: Math.max(watt, lama.wMaks) } : {}) };
    return { nama, vw: 'custom', panel };
  }
  if (b.jenis === 'tv' || b.jenis === 'ifp') {
    const diag = angkaDari(e, 'diagonal');
    return { nama, ...(diag > 0 ? { diag } : {}) };
  }
  if (b.jenis === 'speaker' || b.jenis === 'speaker-plafon') {
    const sudut = angkaDari(e, 'sudut');
    return { nama, ...(sudut > 0 ? { sebaran: sudut } : {}) };
  }
  return null;
}
