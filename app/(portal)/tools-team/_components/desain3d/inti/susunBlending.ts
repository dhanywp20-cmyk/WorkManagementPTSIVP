/**
 * desain3d/inti/susunBlending.ts - Susun proyektor IDENTIK menjadi satu gambar edge blending di layar, dengan cara
 * kalkulator Panasonic: tiap proyektor LURUS (tanpa keystone) tepat di depan pusat ubinnya, jarak lempar dari
 * rumus lensa (TR di dalam rentang zoom + koreksi b), tinggi lensa memakai lens shift di dalam daerah lensa.
 * Ukuran ubin, overlap & peta piksel dari rencanaBlending (lib/av-layar-proyektor.ts) - angka yang sama dengan
 * Kalkulator AV › Proyektor › Edge blending. Yang tidak tercapai (ruang kurang dalam, shift kurang sehingga perlu
 * tilt, badan bertabrakan) dilaporkan, bukan disembunyikan.
 *
 * Murni (diuji di uji/desain3d-susun-blending.ts).
 */
import { rencanaBlending, type RencanaBlending } from '@/lib/av-layar-proyektor';
import { idBaru } from './katalog';
import { pasangKeLayar, rasioProyektorDari, resolusiProyektorDari, sinarProyektor } from './proyektor';
import { ruangDari } from './ruang';
import type { Benda, Kotak, Ruang } from './tipe';

export interface AturSusunBlending { kolom: number; baris: number; /** % lebar & tinggi gambar satu proyektor */ overlapPersen: number }

export interface HasilSusunBlending {
  benda: Benda[];
  /** Proyektor yang dipakai, urut ubin (kiri-atas -> kanan-bawah, dilihat dari penonton). */ ids: string[];
  rencana: RencanaBlending;
  /** Hal yang tidak tercapai / perlu dicek - kosong = semua sesuai lensa. */ peringatan: string[];
}

/** Data optik & badan yang disamakan dari proyektor contoh: blending butuh model, lensa & panel yang sama. */
const SAMA: (keyof Benda)[] = [
  'w', 'h', 'd', 'pasangProyektor', 'throwRatio', 'trMin', 'trMax', 'koreksiJarak', 'koreksiJarakTele', 'offsetLensa', 'offsetTetap',
  'shiftAtasMaks', 'shiftBawahMaks', 'shiftHMaks', 'poligonShift', 'rasioProyektor', 'resolusiProyektor', 'lumen', 'kontrasAsli',
];

const cm = (m: number) => `${Math.round(m * 100)} cm`;

/**
 * Susun `aturan.kolom` × `aturan.baris` proyektor seperti `contoh` ke layar `l`. Proyektor lain di ruang yang sama
 * yang sudah menyorot layar itu dipakai lebih dulu (urut kiri -> kanan), kekurangannya disalin dari `contoh`.
 */
export function susunBlending(contoh: Benda, semua: Benda[], l: Benda, k: Kotak, ruang: Ruang, aturan: AturSusunBlending): HasilSusunBlending {
  const kolom = Math.max(1, Math.min(12, Math.round(aturan.kolom))), baris = Math.max(1, Math.min(6, Math.round(aturan.baris)));
  const n = kolom * baris;
  const res = resolusiProyektorDari(contoh) ?? rasioProyektorDari(contoh).px;
  const rencana = rencanaBlending({
    kolom, baris, resX: res.x, resY: res.y, overlapH: aturan.overlapPersen, overlapV: aturan.overlapPersen,
    mode: 'target', targetLebarM: l.w, targetTinggiM: l.h,
  });
  const m = rencana.lebarSatuM / res.x;

  //  Proyektor yang sudah menyorot layar ini (termasuk contoh), urut dari kiri ke kanan dilihat dari penonton.
  const rl = (l.rot * Math.PI) / 180, ri = ruangDari(ruang, l.x);
  const u = (b: Benda) => (b.x - l.x) * Math.cos(rl) - (b.z - l.z) * Math.sin(rl);
  const ada = semua.filter(b => b.jenis === 'proyektor' && ruangDari(ruang, b.x) === ri
    && (b.id === contoh.id || sinarProyektor(b, semua, ruang).layar?.id === l.id)).sort((a, b) => u(a) - u(b) || b.elev - a.elev);
  const dasar = contoh.nama.replace(/\s*\(blending\)\s*/i, '').replace(/\s+\d+$/, '').trim() || 'Proyektor';
  const sama = Object.fromEntries(SAMA.map(kunci => [kunci, contoh[kunci]])) as Partial<Benda>;

  const peringatan: string[] = [];
  const hasil: Benda[] = [];
  let kurang = 0, tiltMaks = 0, lewat = 0;
  for (let i = 0; i < n; i++) {
    const pt = rencana.peta[i];
    //  Pusat ubin dari pusat kanvas (kanvas di tengah layar; kelebihan satu arah di-mask rata kiri-kanan / atas-bawah).
    const du = (pt.x + res.x / 2 - rencana.kanvasX / 2) * m, dv = (rencana.kanvasY / 2 - (pt.y + res.y / 2)) * m;
    const lama = ada[i];
    const awal: Benda = lama
      ? { ...lama, ...sama }
      : { ...contoh, id: idBaru(), nama: `${dasar} ${i + 1}`, warnaSinar: undefined };
    const ps = pasangKeLayar({ ...awal, tilt: 0 }, l, k, ruang, { du, dv, lebar: rencana.lebarSatuM });
    hasil.push(ps.benda);
    if (ps.kurangJarakM > 0.01) kurang = Math.max(kurang, ps.jarakPerluM);
    if (Math.abs(ps.tiltDerajat) > 0.3) tiltMaks = Math.max(tiltMaks, Math.abs(ps.tiltDerajat));
    if (ps.lewatShift) lewat++;
  }
  if (kurang > 0) peringatan.push(`Ruang kurang dalam: lensa perlu ${kurang.toFixed(2)} m dari layar (zoom terlebar) - gambar lebih kecil dari ubinnya. Pindah layar / pakai lensa lebih lebar.`);
  if (tiltMaks > 0) peringatan.push(`Lens shift tidak cukup: sisa tinggi ditutup tilt sampai ${tiltMaks.toFixed(1)}° (gambar trapesium, blending sulit). Turunkan / naikkan proyektor (drop pole) atau pakai lensa ber-shift lebih besar.`);
  if (lewat) peringatan.push(`${lewat} proyektor memakai lens shift di luar daerah lensa.`);
  const bebasH = rencana.jarakLensaHM - (contoh.w ?? 0), bebasV = rencana.jarakLensaVM - (contoh.h ?? 0);
  if (kolom > 1 && bebasH < 0.02) peringatan.push(`Badan proyektor bertabrakan: jarak antar lensa ${cm(rencana.jarakLensaHM)} < lebar badan ${cm(contoh.w)}. Perbesar gambar / kurangi kolom, atau geser dengan lens shift kiri-kanan.`);
  if (baris > 1 && bebasV < 0.02) peringatan.push(`Badan proyektor bertumpuk: jarak antar lensa atas-bawah ${cm(rencana.jarakLensaVM)} < tinggi badan ${cm(contoh.h)}.`);
  if (ada.length > n) peringatan.push(`${ada.length - n} proyektor lain yang menyorot layar ini tidak dipakai susunan - hapus atau arahkan ke layar lain.`);

  const id = new Set(hasil.map(b => b.id));
  const benda = [...semua.map(b => (id.has(b.id) ? hasil.find(h => h.id === b.id)! : b)), ...hasil.filter(h => !semua.some(b => b.id === h.id))];
  return { benda, ids: hasil.map(b => b.id), rencana, peringatan };
}
