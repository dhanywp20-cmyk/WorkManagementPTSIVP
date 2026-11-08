import { daftarRuang, ruangDari } from './ruang';
import { type Benda, type Kotak, type RasioProyektor, type ResolusiProyektor, type Ruang, type Titik, warnaSah } from './tipe';

export function keDunia(b: Benda, [lx, ly, lz]: Titik): Titik {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [b.x + lx * c + lz * s, b.elev + ly, b.z - lx * s + lz * c];
}
export const lensaDatar = (b: Benda): Titik => [b.w * 0.22, b.h * 0.5, b.d / 2 + 0.035];
export const engselProyektor = (b: Benda): Titik => (b.pasangProyektor === 'meja' ? [0, 0, -b.d / 2 + 0.04] : [0, b.h + 0.04, 0]);
export const tiltDari = (b: Benda) => Math.max(-90, Math.min(45, b.tilt ?? 0));
export function zoomLensa(b: Benda): [number, number] {
  const tr = throwRatioDari(b);
  const lo = Math.max(0.1, b.trMin ?? tr), hi = Math.max(lo, b.trMax ?? tr);
  return [Math.min(lo, hi), Math.max(lo, hi)];
}
export function arahkanKe(p: Benda, [tx, ty, tz]: Titik): Benda {
  const dx = tx - p.x, dz = tz - p.z, dy = ty - (p.elev + p.h / 2), datar = Math.hypot(dx, dz);
  const rot = datar > 1e-3 ? ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360 : p.rot;
  const tilt = Math.max(-90, Math.min(45, (Math.atan2(dy, Math.max(1e-6, datar)) * 180) / Math.PI));
  return { ...p, rot: Math.round(rot * 10) / 10, tilt: Math.round(tilt * 10) / 10 };
}
function miringkan(b: Benda, [x, y, z]: Titik): Titik {
  const t = (tiltDari(b) * Math.PI) / 180;
  if (!t) return [x, y, z];
  const [, py, pz] = engselProyektor(b);
  const dy = y - py, dz = z - pz;
  return [x, py + dy * Math.cos(t) + dz * Math.sin(t), pz - dy * Math.sin(t) + dz * Math.cos(t)];
}
export const lensaProyektor = (b: Benda): Titik => miringkan(b, lensaDatar(b));
export function arahProyektor(b: Benda): Titik {
  const r = (b.rot * Math.PI) / 180, t = (tiltDari(b) * Math.PI) / 180;
  return [Math.sin(r) * Math.cos(t), Math.sin(t), Math.cos(r) * Math.cos(t)];
}
export const RASIO_PROYEKTOR: Record<RasioProyektor, { lebar: number; tinggi: number; label: string; px: { x: number; y: number } }> = {
  '16:9': { lebar: 16, tinggi: 9, label: '16:9 (Full HD / 4K)', px: { x: 1920, y: 1080 } },
  '16:10': { lebar: 16, tinggi: 10, label: '16:10 (WUXGA)', px: { x: 1920, y: 1200 } },
  '17:9': { lebar: 17, tinggi: 9, label: '17:9 (Native 4K)', px: { x: 1920, y: 1016 } },
  '4:3': { lebar: 4, tinggi: 3, label: '4:3 (XGA)', px: { x: 1920, y: 1440 } },
  '21:9': { lebar: 64, tinggi: 27, label: '21:9 (ultra-wide)', px: { x: 1920, y: 810 } },
};
export const rasioProyektorDari = (p: Pick<Benda, 'rasioProyektor'>) => RASIO_PROYEKTOR[p.rasioProyektor ?? '16:9'] ?? RASIO_PROYEKTOR['16:9'];
export const RESOLUSI_PROYEKTOR: Record<ResolusiProyektor, { x: number; y: number; rasio: RasioProyektor; label: string }> = {
  XGA: { x: 1024, y: 768, rasio: '4:3', label: 'XGA 1024 × 768' },
  SXGAP: { x: 1400, y: 1050, rasio: '4:3', label: 'SXGA+ 1400 × 1050' },
  WXGAH: { x: 1366, y: 768, rasio: '16:9', label: 'WXGA 1366 × 768' },
  WXGA: { x: 1280, y: 800, rasio: '16:10', label: 'WXGA 1280 × 800' },
  FHD: { x: 1920, y: 1080, rasio: '16:9', label: 'Full HD 1920 × 1080' },
  WUXGA: { x: 1920, y: 1200, rasio: '16:10', label: 'WUXGA 1920 × 1200' },
  WQXGA: { x: 2560, y: 1600, rasio: '16:10', label: 'WQXGA 2560 × 1600' },
  '4K': { x: 3840, y: 2160, rasio: '16:9', label: '4K UHD 3840 × 2160' },
  '4KP': { x: 3840, y: 2400, rasio: '16:10', label: '4K+ 3840 × 2400' },
  '4KDCI': { x: 4096, y: 2160, rasio: '17:9', label: 'Native 4K 4096 × 2160' },
};
export const rasioPanelDari = (p: Pick<Benda, 'resolusiProyektor' | 'rasioProyektor'>): RasioProyektor =>
  (p.resolusiProyektor && RESOLUSI_PROYEKTOR[p.resolusiProyektor]?.rasio) || (p.rasioProyektor ?? '16:9');
export function bagianPanel(p: Pick<Benda, 'resolusiProyektor' | 'rasioProyektor'>): { lebar: number; tinggi: number } {
  return bagianPanelRasio(rasioPanelDari(p), p.rasioProyektor ?? '16:9');
}
export function bagianPanelRasio(panel: RasioProyektor, sinyal: RasioProyektor): { lebar: number; tinggi: number } {
  const n = RASIO_PROYEKTOR[panel] ?? RASIO_PROYEKTOR['16:9'], u = RASIO_PROYEKTOR[sinyal] ?? RASIO_PROYEKTOR['16:9'];
  const rn = n.lebar / n.tinggi, ru = u.lebar / u.tinggi;
  return ru >= rn ? { lebar: 1, tinggi: rn / ru } : { lebar: ru / rn, tinggi: 1 };
}
export function resolusiProyektorDari(p: Pick<Benda, 'resolusiProyektor' | 'rasioProyektor'>) {
  const r = p.resolusiProyektor ? RESOLUSI_PROYEKTOR[p.resolusiProyektor] : undefined;
  if (!r) return null;
  const bp = bagianPanel(p);
  return { kunci: p.resolusiProyektor!, ...r, x: Math.round(r.x * bp.lebar), y: Math.round(r.y * bp.tinggi), panelX: r.x, panelY: r.y };
}
export function gantiRasioProyektor(p: Benda, rasio: RasioProyektor): Partial<Benda> {
  const [lo, hi] = zoomLensa(p), t = hi - lo > 1e-9 ? Math.min(1, Math.max(0, (throwRatioDari(p) - lo) / (hi - lo))) : 0;
  const bulat = (v: number) => Math.round(v * 1e6) / 1e6;
  const k = p.koefRasio?.[rasio];
  if (k) {
    const [trW, trT, bW, bT] = k;
    return { rasioProyektor: rasio, trMin: trW, trMax: trT, throwRatio: bulat(trW + (trT - trW) * t), koreksiJarak: bW || undefined, koreksiJarakTele: bT };
  }
  const f = bagianPanel(p).lebar / bagianPanel({ ...p, rasioProyektor: rasio }).lebar;
  if (Math.abs(f - 1) < 1e-9) return { rasioProyektor: rasio };
  return {
    rasioProyektor: rasio, throwRatio: bulat(throwRatioDari(p) * f),
    ...(p.trMin !== undefined ? { trMin: bulat(p.trMin * f) } : {}), ...(p.trMax !== undefined ? { trMax: bulat(p.trMax * f) } : {}),
  };
}
export const rasioGambarProyektor = (p: Pick<Benda, 'rasioProyektor'>) => { const r = rasioProyektorDari(p); return r.tinggi / r.lebar; };
export const JARAK_LENSA_PERMUKAAN = 0.03;
export function jepitProyektor(b: Benda, X: number, Z: number, plafon: number): { x: number; z: number; elev: number } {
  const [lx, ly, lz] = keDunia(b, lensaProyektor(b));
  const m = JARAK_LENSA_PERMUKAAN;
  const geser = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) - v;
  return { x: b.x + geser(lx, m, X - m), z: b.z + geser(lz, m, Z - m), elev: Math.max(0, b.elev + geser(ly, m, plafon - m)) };
}
export const throwRatioDari = (b: Benda) => Math.max(0.1, b.throwRatio ?? 1.5);
export const BATAS_B = 5, BATAS_TR = 50;
export const offsetLensaDari = (p: Benda) => Math.min(1.5, Math.max(-0.5, p.offsetTetap ?? p.offsetLensa ?? OFFSET_GAMBAR));
export function koreksiJarakDari(p: Benda, tr = throwRatioDari(p)) {
  const jepit = (v: number) => Math.min(BATAS_B, Math.max(-BATAS_B, v));
  const wide = p.koreksiJarak ?? 0;
  if (p.koreksiJarakTele === undefined) return jepit(wide);
  const [lo, hi] = zoomLensa(p);
  const t = hi - lo > 1e-6 ? Math.min(1, Math.max(0, (tr - lo) / (hi - lo))) : 0;
  return jepit(wide + (p.koreksiJarakTele - wide) * t);
}
export const lebarGambarDi = (p: Benda, jarak: number, tr = throwRatioDari(p)) => Math.max(0, (jarak + koreksiJarakDari(p, tr)) / tr);
export function trUntukLebar(p: Benda, jarak: number, lebar: number): number {
  let tr = throwRatioDari(p);
  for (let i = 0; i < 4; i++) tr = (jarak + koreksiJarakDari(p, tr)) / Math.max(0.01, lebar);
  return tr;
}
export function jarakUntukLebar(p: Benda, lebar: number): [number, number] {
  const [lo, hi] = zoomLensa(p);
  return [lo * lebar - koreksiJarakDari(p, lo), hi * lebar - koreksiJarakDari(p, hi)];
}
export const gainLayarDari = (l: Benda | null | undefined) => Math.min(5, Math.max(0.1, l?.gainLayar ?? 1));
export const luminanceDari = (lux: number, gain = 1) => (lux * gain) / Math.PI;
function diDalamPoligon(pg: number[], x: number, y: number): boolean {
  let dalam = false;
  for (let i = 0, j = pg.length - 2; i < pg.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [pg[i], pg[i + 1], pg[j], pg[j + 1]];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}
export function shiftMuat(pg: number[], h: number, v: number, bp: { lebar: number; tinggi: number } = { lebar: 1, tinggi: 1 }): boolean {
  const besar = pg.map(n => n * 1.0001);
  return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].every(([a, b]) => diDalamPoligon(besar, (h + a) * bp.lebar, (v + b) * bp.tinggi));
}
function shiftTerjauh(pg: number[], dx: number, dy: number, bp?: { lebar: number; tinggi: number }): number {
  if (!shiftMuat(pg, 0, 0, bp)) return 0;
  let lo = 0, hi = 3;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (shiftMuat(pg, dx * m, dy * m, bp)) lo = m; else hi = m; }
  return Math.round(lo * 1000) / 1000;
}
export function batasPoligonShift(pg: number[], bp?: { lebar: number; tinggi: number }) {
  return { atas: shiftTerjauh(pg, 0, 1, bp), bawah: shiftTerjauh(pg, 0, -1, bp), h: Math.min(shiftTerjauh(pg, 1, 0, bp), shiftTerjauh(pg, -1, 0, bp)) };
}
export function batasPoligonShiftLuas(pg: number[], bp?: { lebar: number; tinggi: number }) {
  if (shiftMuat(pg, 0, 0, bp)) return batasPoligonShift(pg, bp);
  let awal: [number, number] | null = null;
  for (let dh = 0; dh <= 1.5 && !awal; dh += 0.01) {
    for (const h of dh ? [dh, -dh] : [0]) {
      for (let dv = 0; dv <= 2 && !awal; dv += 0.005) for (const v of dv ? [dv, -dv] : [0]) if (!awal && shiftMuat(pg, h, v, bp)) awal = [h, v];
      if (awal) break;
    }
  }
  if (!awal) return { atas: 0, bawah: 0, h: 0 };
  const [h0, v0] = awal;
  const ujung = (dx: number, dy: number) => {
    let lo = 0, hi = 3;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (shiftMuat(pg, h0 + dx * m, v0 + dy * m, bp)) lo = m; else hi = m; }
    return lo;
  };
  const bulat = (x: number) => Math.round(x * 1000) / 1000;
  const hKanan = h0 + ujung(1, 0), hKiri = h0 - ujung(-1, 0);
  return { atas: bulat(v0 + ujung(0, 1)), bawah: bulat(-(v0 - ujung(0, -1))), h: hKiri <= 0 && hKanan >= 0 ? bulat(Math.min(hKanan, -hKiri)) : 0 };
}
const batasPoligonUntuk = (p: Benda, pg: number[], bp: { lebar: number; tinggi: number }) =>
  (/^Panasonic/.test(p.sumberLensa ?? '') ? batasPoligonShift(pg, bp) : batasPoligonShiftLuas(pg, bp));
export function batasShift(p: Benda) {
  if (p.offsetTetap !== undefined) return { atas: 0, bawah: 0, h: 0, lewatV: false, lewatH: false, lewatGabungan: false, ada: true, tetap: true };
  const v = offsetLensaDari(p), g = geserLensaDari(p);
  const pg = p.poligonShift && p.poligonShift.length >= 6 ? p.poligonShift : null;
  if (pg) {
    const bp = bagianPanel(p);
    const { atas, bawah, h } = batasPoligonUntuk(p, pg, bp);
    const lewatV = !shiftMuat(pg, 0, v, bp), lewatH = !shiftMuat(pg, g, 0, bp);
    return { atas, bawah, h, lewatV, lewatH, lewatGabungan: !lewatV && !lewatH && !shiftMuat(pg, g, v, bp), ada: true, tetap: false };
  }
  const atas = p.shiftAtasMaks ?? null, bawah = p.shiftBawahMaks ?? null, h = p.shiftHMaks ?? null;
  const lewatV = (atas !== null && v > atas + 1e-6) || (bawah !== null && v < -bawah - 1e-6);
  const lewatH = h !== null && Math.abs(g) > h + 1e-6;
  return { atas, bawah, h, lewatV, lewatH, lewatGabungan: false, ada: atas !== null || bawah !== null || h !== null, tetap: false };
}
export const geserLensaDari = (p: Benda) => (p.offsetTetap !== undefined ? 0 : Math.min(0.6, Math.max(-0.6, p.geserLensaH ?? 0)));
export const lumenDari = (p: Benda) => Math.max(100, p.lumen ?? (p.pasangProyektor === 'meja' ? 3500 : 5000));
export const lumenGambarDari = (p: Benda) => { const bp = bagianPanel(p); return lumenDari(p) * bp.lebar * bp.tinggi; };
export function kecerahanProyektor(p: Benda, luasM2: number) {
  const lux = lumenGambarDari(p) / Math.max(0.05, luasM2);
  return { lux, nits: lux / Math.PI, nada: (lux >= 300 ? 'baik' : lux >= 150 ? 'awas' : 'buruk') as 'baik' | 'awas' | 'buruk' };
}
export const OFFSET_GAMBAR = 0.5;
export interface Sinar {
   asal: Titik;
   sudut: [Titik, Titik, Titik, Titik];
   layar: Benda | null;
   jarak: number;
  lebar: number; tinggi: number;
   trPas: number | null;
  selisihV: number | null; selisihH: number | null;
}
function hslKeHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export const ronaProyektor = (urutan: number) => (0.1 + urutan * 0.17) % 1;

export function warnaSinarProyektor(p: Benda, urutan: number, jumlah: number): string {
  const pilihan = warnaSah(p.warnaSinar);
  if (pilihan) return pilihan;
  return jumlah < 2 ? '#fff1c2' : hslKeHex(ronaProyektor(urutan), 0.85, 0.72);
}

export function sinarProyektor(p: Benda, semua: Benda[], ruang: Ruang): Sinar {
  const asal = keDunia(p, lensaProyektor(p));
  const D = arahProyektor(p);
  const r = (p.rot * Math.PI) / 180;
  const maju = [Math.sin(r), Math.cos(r)];
  const ri = ruangDari(ruang, p.x);
  const tr = throwRatioDari(p), rasioG = rasioGambarProyektor(p);
  const naikTurun = p.pasangProyektor === 'meja' ? 1 : -1;
  const offV = offsetLensaDari(p), geserH = geserLensaDari(p);
  const kananP: Titik = [-Math.cos(r), 0, Math.sin(r)];
  const persegi = (pusat: Titik, kanan: Titik, lebar: number, tinggi: number): Sinar['sudut'] => {
    const t = (u: number, v: number): Titik => [pusat[0] + kanan[0] * u, pusat[1] + v, pusat[2] + kanan[2] * u];
    return [t(-lebar / 2, -tinggi / 2), t(lebar / 2, -tinggi / 2), t(lebar / 2, tinggi / 2), t(-lebar / 2, tinggi / 2)];
  };

  let sasaran: { l: Benda; tegak: number; t: number; pusat: Titik } | null = null;
  for (const l of semua) {
    if (l.jenis !== 'layar' || ruangDari(ruang, l.x) !== ri) continue;
    const rl = (l.rot * Math.PI) / 180, n = [Math.sin(rl), 0, Math.cos(rl)];
    const pusat = keDunia(l, [0, l.h / 2, l.d / 2]);
    const dx = asal[0] - pusat[0], dz = asal[2] - pusat[2];
    const tegak = dx * n[0] + dz * n[2];
    if (tegak < 0.3) continue;
    const cos = (-dx * maju[0] - dz * maju[1]) / Math.max(1e-6, Math.hypot(dx, dz));
    if (cos < Math.cos((50 * Math.PI) / 180)) continue;
    const dn = D[0] * n[0] + D[2] * n[2];
    if (dn > -0.2) continue;
    const t = -tegak / dn;
    if (!sasaran || tegak < sasaran.tegak) sasaran = { l, tegak, t, pusat };
  }
  if (sasaran) {
    const { l, t, pusat: S } = sasaran;
    const rl = (l.rot * Math.PI) / 180;
    const lebar = lebarGambarDi(p, t, tr), tinggi = lebar * rasioG;
    const kanan: Titik = [Math.cos(rl), 0, -Math.sin(rl)];
    const pusat: Titik = [
      asal[0] + D[0] * t + Math.sin(rl) * 0.004 + kananP[0] * lebar * geserH,
      asal[1] + D[1] * t + naikTurun * tinggi * offV,
      asal[2] + D[2] * t + Math.cos(rl) * 0.004 + kananP[2] * lebar * geserH,
    ];
    const selisihH = (pusat[0] - S[0]) * kanan[0] + (pusat[2] - S[2]) * kanan[2];
    return {
      asal, sudut: persegi(pusat, kanan, lebar, tinggi), layar: l, jarak: t, lebar, tinggi,
      trPas: trUntukLebar(p, t, Math.max(0.01, l.w, l.h / rasioG)), selisihV: pusat[1] - S[1], selisihH,
    };
  }
  const k = daftarRuang(ruang)[ri] ?? daftarRuang(ruang)[0];
  const ke = (v: number, a: number, lo: number, hi: number) => (a > 1e-6 ? (hi - v) / a : a < -1e-6 ? (lo - v) / a : Infinity);
  const jarak = Math.min(15, Math.max(0.3, Math.min(ke(asal[0], D[0], k.x0, k.x0 + k.p), ke(asal[2], D[2], 0, k.l), ke(asal[1], D[1], 0, k.t))));
  const lebar = lebarGambarDi(p, jarak, tr), tinggi = lebar * rasioG, jg = jarak - 0.005;
  const pusat: Titik = [asal[0] + D[0] * jg + kananP[0] * lebar * geserH, asal[1] + D[1] * jg + naikTurun * tinggi * offV, asal[2] + D[2] * jg + kananP[2] * lebar * geserH];
  return { asal, sudut: persegi(pusat, [Math.cos(r), 0, -Math.sin(r)], lebar, tinggi), layar: null, jarak, lebar, tinggi, trPas: null, selisihV: null, selisihH: null };
}
export function layarTerdekat(p: Benda, semua: Benda[], ruang: Ruang): Benda | null {
  const ri = ruangDari(ruang, p.x);
  return semua.filter(l => l.jenis === 'layar' && ruangDari(ruang, l.x) === ri)
    .reduce<Benda | null>((m, l) => (!m || Math.hypot(l.x - p.x, l.z - p.z) < Math.hypot(m.x - p.x, m.z - p.z) ? l : m), null);
}
export function tiltKeLayar(p: Benda, l: Benda, ruang: Ruang, dv = 0): Benda {
  let lo = -60, hi = 45;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const coba = { ...p, tilt: mid };
    const sv = sinarProyektor(coba, [l, coba], ruang).selisihV;
    if (sv === null) break;
    if (sv - dv > 0) hi = mid; else lo = mid;
  }
  return { ...p, tilt: Math.round(((lo + hi) / 2) * 10) / 10 };
}
export function shiftOtomatis(p: Benda, semua: Benda[], ruang: Ruang) {
  if (p.offsetTetap !== undefined) return null;
  const s = sinarProyektor(p, semua, ruang);
  if (!s.layar || s.selisihV === null || s.selisihH === null) return null;
  const naikTurun = p.pasangProyektor === 'meja' ? 1 : -1;
  const searah = -Math.cos(((p.rot - s.layar.rot) * Math.PI) / 180);
  let v = Math.min(1.5, Math.max(-0.5, offsetLensaDari(p) - s.selisihV / (naikTurun * s.tinggi)));
  let g = Math.abs(searah) < 0.2 ? geserLensaDari(p) : Math.min(0.6, Math.max(-0.6, geserLensaDari(p) - s.selisihH / (s.lebar * searah)));
  const pg = p.poligonShift && p.poligonShift.length >= 6 ? p.poligonShift : null;
  if (pg) {
    const bp = bagianPanel(p), bt = batasPoligonUntuk(p, pg, bp);
    v = Math.min(bt.atas, Math.max(-bt.bawah, v));
    if (!shiftMuat(pg, g, v, bp)) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (shiftMuat(pg, g * m, v, bp)) lo = m; else hi = m; }
      g *= lo;
    }
  } else {
    const { atas, bawah, h } = batasShift({ ...p, offsetLensa: 0, geserLensaH: 0 });
    if (atas !== null) v = Math.min(v, atas);
    if (bawah !== null) v = Math.max(v, -bawah);
    if (h !== null) g = Math.max(-h, Math.min(h, g));
  }
  const bulat = (x: number) => Math.trunc(x * 1e4) / 1e4;
  const q = { ...p, offsetLensa: bulat(v), geserLensaH: bulat(g) };
  const s2 = sinarProyektor(q, semua, ruang);
  return { offsetLensa: q.offsetLensa, geserLensaH: q.geserLensaH, sisaV: s2.selisihV ?? 0, sisaH: s2.selisihH ?? 0 };
}
export const OFFSET_MAKS_OTOMATIS = 1;

export function proyektorKeLayar(p: Benda, l: Benda, k: Kotak, ruang: Ruang): Benda {
  return pasangKeLayar(p, l, k, ruang).benda;
}

export interface SasaranLayar { du: number; dv: number; lebar: number }

export function pasangKeLayar(p: Benda, l: Benda, k: Kotak, ruang: Ruang, sasaran?: SasaranLayar) {
  const rl = (l.rot * Math.PI) / 180;
  const n = [Math.sin(rl), Math.cos(rl)];
  const du = sasaran?.du ?? 0, dv = sasaran?.dv ?? 0;
  const S0 = keDunia(l, [0, l.h / 2, l.d / 2]);
  const S: Titik = [S0[0] + Math.cos(rl) * du, S0[1] + dv, S0[2] - Math.sin(rl) * du];
  const rot = (((l.rot + 180) % 360) + 360) % 360;
  const plafon = p.pasangProyektor !== 'meja';
  const rasioG = rasioGambarProyektor(p);
  const lebarPerlu = sasaran ? sasaran.lebar : Math.max(l.w, l.h / rasioG);

  const ke = (v: number, a: number, lo: number, hi: number) => (a > 1e-6 ? (hi - v) / a : a < -1e-6 ? (lo - v) / a : Infinity);
  const bebas = Math.min(ke(S[0], n[0], k.x0, k.x0 + k.p), ke(S[2], n[1], 0, k.l)) - p.d - 0.2;
  const [trLo, trHi] = zoomLensa(p);
  let tr = Math.min(trHi, Math.max(trLo, throwRatioDari(p)));
  if (tr * lebarPerlu - koreksiJarakDari(p, tr) > bebas) tr = Math.max(trLo, Math.min(trHi, trUntukLebar({ ...p, throwRatio: tr }, bebas, lebarPerlu)));
  const jarakPerlu = tr * lebarPerlu - koreksiJarakDari(p, tr);
  const jarak = Math.max(0.5, Math.min(jarakPerlu, bebas));
  const tinggiGambar = lebarGambarDi(p, jarak, tr) * rasioG;

  const arahV = plafon ? -1 : 1, off0 = offsetLensaDari(p);
  const yLokal = lensaDatar(p)[1];
  const elev = plafon
    ? Math.max(0.3, Math.min(k.t - p.h - 0.06, S[1] - arahV * off0 * tinggiGambar - yLokal))
    : p.elev;
  const yLensa = elev + yLokal;
  const offPerlu = (S[1] - yLensa) / (arahV * tinggiGambar);
  const offMaks = Math.min(OFFSET_MAKS_OTOMATIS, batasShift({ ...p, geserLensaH: 0 }).atas ?? Infinity);
  const off = Math.abs(offPerlu - off0) < 0.005 ? off0 : Math.min(offMaks, Math.max(0, offPerlu));

  const taruh = (q: Benda, jarakLensa: number): Benda => {
    const [ox, , oz] = keDunia({ ...q, rot, x: 0, z: 0, elev: 0 }, lensaProyektor(q));
    return { ...q, rot, x: S[0] + n[0] * jarakLensa - ox, z: S[2] + n[1] * jarakLensa - oz };
  };
  const bulatMm = (v: number) => Math.round(v * 1000) / 1000;
  let q = taruh({ ...p, elev: bulatMm(elev), tilt: 0, throwRatio: Math.round(tr * 1e6) / 1e6, offsetLensa: Math.round(off * 1000) / 1000, geserLensaH: 0 }, jarak);
  if (Math.abs((sinarProyektor(q, [l, q], ruang).selisihV ?? 0) - dv) > 0.01) {
    let jarakTegak = jarak;
    for (let i = 0; i < 4; i++) {
      q = tiltKeLayar(q, l, ruang, dv);
      const sn = sinarProyektor(q, [l, q], ruang);
      if (!sn.layar) break;
      jarakTegak += (jarak - sn.jarak) * Math.cos((tiltDari(q) * Math.PI) / 180);
      q = taruh(q, jarakTegak);
    }
    q = tiltKeLayar(q, l, ruang, dv);
  }
  const diRuang = { ...q, x: bulatMm(Math.min(k.x0 + k.p - 0.1, Math.max(k.x0 + 0.1, q.x))), z: bulatMm(Math.min(k.l - 0.1, Math.max(0.1, q.z))) };
  const akhir = sinarProyektor(diRuang, [l, diRuang], ruang);
  const trPas = akhir.layar ? Math.min(trHi, Math.max(trLo, trUntukLebar(diRuang, akhir.jarak, lebarPerlu))) : throwRatioDari(diRuang);
  const benda = { ...diRuang, throwRatio: Math.round(trPas * 1e6) / 1e6 };
  const bs = batasShift(benda);
  return { benda, kurangJarakM: Math.max(0, jarakPerlu - jarak), tiltDerajat: tiltDari(benda), lewatShift: bs.lewatV || bs.lewatH || bs.lewatGabungan, jarakPerluM: jarakPerlu };
}
