/**
 * desain3d/inti/pustaka.ts - Isi benda Desain 3D dari Pustaka Tools Team (katalog produk yang diisi
 * Admin): proyektor (lumen & rentang zoom), display/panel videowall (diagonal, bezel, resolusi, daya),
 * speaker (sudut sebaran). Murni - diuji di uji/desain3d-pustaka.ts.
 */
import { ukuranDariDiagonal } from '@/lib/av-hitung';
import { angkaDari, bacaPoligonShift, type EntriPustaka, teksDari } from '@/lib/pustaka';
import { PANEL_VW_AWAL } from './produk';
import { throwRatioDari } from './proyektor';
import type { Benda, Jenis, PanelVW, RasioProyektor } from './tipe';

/** Jenis pustaka yang bisa mengisi tiap jenis benda. */
export const PUSTAKA_UNTUK: Partial<Record<Jenis, string>> = {
  proyektor: 'proyektor', videowall: 'display', tv: 'display', ifp: 'display', speaker: 'speaker', 'speaker-plafon': 'speaker',
};

const RESOLUSI: Record<string, [number, number]> = { XGA: [1024, 768], WXGA: [1280, 800], FHD: [1920, 1080], WUXGA: [1920, 1200], '4K': [3840, 2160], '4KDCI': [4096, 2160] };
const bulat = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/** Entri yang cocok: panel videowall (bezel > 0) hanya untuk videowall; speaker plafon hanya untuk speaker plafon. */
export function cocokPustaka(jenis: Jenis, e: EntriPustaka): boolean {
  if (PUSTAKA_UNTUK[jenis] !== e.jenis) return false;
  if (e.jenis === 'display') return jenis === 'videowall' ? angkaDari(e, 'bezel') > 0 : angkaDari(e, 'bezel') <= 0;
  if (e.jenis === 'speaker') return (teksDari(e, 'tipe') === 'plafon') === (jenis === 'speaker-plafon');
  return true;
}

/**
 * Perubahan benda dari entri pustaka (posisi & arah tidak disentuh). Pemanggil menjalankan
 * terapkanUkuran sesudahnya supaya ukuran ikut diagonal / panel. null = entri tidak cocok.
 */
export function isiDariPustaka(b: Benda, e: EntriPustaka): Partial<Benda> | null {
  if (!cocokPustaka(b.jenis, e)) return null;
  const nama = e.nama.slice(0, 120);
  if (b.jenis === 'proyektor') {
    const trMin = angkaDari(e, 'throwMin'), trMax = Math.max(trMin, angkaDari(e, 'throwMaks'));
    const lumen = Math.round(angkaDari(e, 'lumen'));
    //  Posisi zoom sekarang dipertahankan bila masih dalam rentang lensa baru.
    const tr = Math.min(trMax, Math.max(trMin, throwRatioDari(b)));
    //  Rasio gambar dari resolusi di pustaka (WUXGA / WXGA = 16:10, Full HD / 4K = 16:9) - cakupan & blending ikut.
    const rasioDari: Record<string, RasioProyektor> = { XGA: '4:3', FHD: '16:9', '4K': '16:9', WUXGA: '16:10', WXGA: '16:10', '4KDCI': '17:9' };
    const rasioProyektor = rasioDari[teksDari(e, 'resolusi')];
    //  Data LENSA (rumus jarak, batas lens shift, offset tetap, kontras asli) diganti UTUH dari entri: model lain = lensa
    //  lain, jadi nilai model sebelumnya tidak boleh tertinggal (dulu b model lama terbawa ke model yang b-nya kosong).
    //  0 tetap 0 (lensa tanpa shift); hanya bidang yang kosong yang jadi undefined (tidak dibatasi / bawaan).
    const ada = (k: string) => typeof e.data[k] === 'number';
    const angka = (k: string, skala = 1) => (ada(k) ? bulat(angkaDari(e, k) / skala, 6) : undefined);
    const lensa: Partial<Benda> = {
      koreksiJarak: angka('koreksiJarak'), koreksiJarakTele: angka('koreksiJarakTele'),
      shiftAtasMaks: angka('shiftAtas', 100), shiftBawahMaks: angka('shiftBawah', 100), shiftHMaks: angka('shiftHorizontal', 100),
      offsetTetap: angka('offsetTetap', 100), kontrasAsli: ada('kontras') ? angkaDari(e, 'kontras') : undefined,
      poligonShift: bacaPoligonShift(teksDari(e, 'poligonShift')),
      ...(ada('offsetTetap') ? { offsetLensa: angka('offsetTetap', 100), geserLensaH: 0 } : {}),
    };
    return { nama, ...(lumen > 0 ? { lumen } : {}), ...(trMin > 0 ? { trMin, trMax, throwRatio: bulat(tr, 2) } : {}), ...(rasioProyektor ? { rasioProyektor } : {}), ...lensa };
  }
  if (b.jenis === 'videowall') {
    const u = ukuranDariDiagonal(angkaDari(e, 'diagonal'));
    const bezelMm = angkaDari(e, 'bezel');
    const [resX, resY] = RESOLUSI[teksDari(e, 'resolusi')] ?? [1920, 1080];
    const watt = angkaDari(e, 'watt');
    const lama = { ...PANEL_VW_AWAL, ...(b.panel ?? {}) };
    //  Ukuran set = area aktif + bezel (separuh bezel-to-bezel di tiap sisi).
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
