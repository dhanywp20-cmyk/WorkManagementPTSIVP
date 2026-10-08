/**
 * desain3d/inti/ruang.ts - Geometri ruangan: ruang bersambung, sekat, pintu & jendela, salin / petakan / pusatkan isi ruang.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d.ts).
 */
import { idBaru } from './katalog';
import { keDunia, sinarProyektor } from './proyektor';
import type { Benda, Bukaan, Kotak, Ruang, RuangSambung, SisiDinding } from './tipe';

export const MAKS_RUANG = 4;
/** Ruang tambahan yang aktif, berurutan (ruang ke-2, ke-3, ...); berhenti di yang pertama tidak aktif. */
export function sambungan(r: Ruang): RuangSambung[] {
  const hasil: RuangSambung[] = [];
  for (const x of [r.r2, ...(r.lain ?? [])]) {
    if (!x?.aktif || hasil.length >= MAKS_RUANG - 1) break;
    hasil.push(x);
  }
  return hasil;
}
/** Ruang tambahan ke-j (j >= 1 = ruang indeks j) beserta sekat di kirinya. */
export const sambunganKe = (r: Ruang, j: number): RuangSambung | null => (j >= 1 ? sambungan(r)[j - 1] ?? null : null);
export function daftarRuang(r: Ruang): Kotak[] {
  const hasil: Kotak[] = [{ x0: 0, p: r.p, l: r.l, t: r.t }];
  let x = r.p;
  for (const s of sambungan(r)) { hasil.push({ x0: x, p: s.p, l: s.l, t: s.t }); x += s.p; }
  return hasil;
}
/** Indeks ruang tempat titik x berada (0 = ruang 1). */
export function ruangDari(r: Ruang, x: number): number {
  const k = daftarRuang(r);
  for (let i = k.length - 1; i > 0; i--) if (x > k[i].x0) return i;
  return 0;
}
/** Lebar & tinggi lubang pintu penghubung, dan posisi pusatnya di sepanjang sekat (z dunia). */
export const PINTU = { lebar: 0.9, tinggi: 2.1 };
/** Ukuran pintu penghubung (custom bila diisi), dijepit agar muat di sekat. */
export function ukuranPintu(r: Ruang, j = 1): { lebar: number; tinggi: number } {
  const k = daftarRuang(r), s = sambunganKe(r, j), kiri = k[j - 1] ?? k[0];
  const u = s?.pintuUkuran;
  const L = Math.min(kiri.l, s?.l ?? kiri.l), T = Math.min(kiri.t, s?.t ?? kiri.t);
  return {
    lebar: Math.max(0.5, Math.min(u?.lebar ?? PINTU.lebar, L - 0.4)),
    tinggi: Math.max(1.5, Math.min(u?.tinggi ?? PINTU.tinggi, T - 0.1)),
  };
}
/** Pusat pintu penghubung di sekat ke-j (kiri ruang j) sepanjang z dunia; bawaan 1 m dari dinding belakang. */
export function pintuSekat(r: Ruang, j = 1): number | null {
  const s = sambunganKe(r, j);
  if (!s || !s.pintu || s.sekat === 'terbuka') return null;
  const kiri = daftarRuang(r)[j - 1];
  const L = Math.min(kiri.l, s.l), setengah = ukuranPintu(r, j).lebar / 2;
  const z = s.pintuUkuran?.z ?? L - 1.0;
  return Math.max(setengah + 0.15, Math.min(L - setengah - 0.15, z));
}
export const JENDELA_AWAL = { lebar: 2.0, tinggi: 1.2, ambang: 0.9, geser: 0 };
export const ANALISIS_AWAL: NonNullable<Ruang['analisis']> = { jenis: 'analitis', faktor: 5, sudut: 45 };
export const analisisDari = (r: Ruang): NonNullable<Ruang['analisis']> => ({ ...ANALISIS_AWAL, ...(r.analisis ?? {}) });
export const BUKAAN_AWAL = { pintu: { lebar: 0.9, tinggi: 2.1, ambang: 0 }, jendela: { lebar: 1.5, tinggi: 1.2, ambang: 0.9 } };
/** Dinding luar ruang i - dinding sekat antar ruang tidak termasuk (pintu/jendelanya diatur di r2). */
export function sisiLuar(r: Ruang, i: number): SisiDinding[] {
  const n = daftarRuang(r).length;
  return (['depan', 'belakang', 'kiri', 'kanan'] as SisiDinding[]).filter(s => !(s === 'kiri' && i > 0) && !(s === 'kanan' && i < n - 1));
}
export const panjangDinding = (k: Kotak, sisi: SisiDinding) => (sisi === 'depan' || sisi === 'belakang' ? k.p : k.l);
/**
 * Bukaan di satu dinding luar, dijepit supaya utuh di dalam dinding (sisa >= 10 cm di tepi,
 * >= 5 cm di bawah plafon). x0..x1 dari ujung kiri dinding (dilihat dari dalam), y0..y1 dari lantai.
 */
export function bukaanDinding(r: Ruang, i: number, sisi: SisiDinding): { b: Bukaan; x0: number; x1: number; y0: number; y1: number }[] {
  if (!sisiLuar(r, i).includes(sisi)) return [];
  const k = daftarRuang(r)[i]; if (!k) return [];
  const P = panjangDinding(k, sisi);
  const jepit = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return (r.bukaan ?? []).filter(b => b.ruang === i && b.sisi === sisi).map(b => {
    const lebar = jepit(b.lebar, 0.3, Math.max(0.3, P - 0.2));
    const y0 = b.jenis === 'pintu' ? 0 : jepit(b.ambang, 0, Math.max(0, k.t - 0.35));
    const y1 = jepit(y0 + b.tinggi, y0 + 0.2, k.t - 0.05);
    const c = jepit(b.posisi, 0.1 + lebar / 2, Math.max(0.1 + lebar / 2, P - 0.1 - lebar / 2));
    return { b, x0: c - lebar / 2, x1: c + lebar / 2, y0, y1 };
  });
}
/**
 * Jendela kaca di sekat antar ruang (sekat 'jendela'), dalam koordinat dunia:
 * z0..z1 sepanjang sekat, y0..y1 dari lantai. Ukuran dibatasi supaya tetap
 * di dalam dinding (sisa >= 20 cm di tiap tepi) dan TIDAK menimpa pintu
 * penghubung - bila bertabrakan, jendela digeser menjauhi pintu.
 */
export function jendelaSekat(r: Ruang, ke = 1): { z0: number; z1: number; y0: number; y1: number } | null {
  const s = sambunganKe(r, ke);
  if (!s || s.sekat !== 'jendela') return null;
  const kiri = daftarRuang(r)[ke - 1];
  const j = { ...JENDELA_AWAL, ...(s.jendela ?? {}) };
  const L = Math.min(kiri.l, s.l), T = Math.min(kiri.t, s.t), tepi = 0.2;
  const lebar = Math.max(0.3, Math.min(j.lebar, L - 2 * tepi));
  const y0 = Math.max(0.1, Math.min(j.ambang, T - 0.4));
  const y1 = Math.max(y0 + 0.2, Math.min(y0 + j.tinggi, T - 0.15));
  let tengah = L / 2 + j.geser;
  tengah = Math.min(L - tepi - lebar / 2, Math.max(tepi + lebar / 2, tengah));
  const pintu = pintuSekat(r, ke);
  if (pintu !== null) {
    const lp = ukuranPintu(r, ke).lebar;
    const p0 = pintu - lp / 2 - 0.15, p1 = pintu + lp / 2 + 0.15;
    if (tengah + lebar / 2 > p0 && tengah - lebar / 2 < p1) {
      //  Pindah ke sisi yang lebih lega (depan / belakang pintu).
      const ruangDepan = p0 - tepi, ruangBelakang = L - tepi - p1;
      tengah = ruangDepan >= ruangBelakang ? Math.min(tengah, p0 - lebar / 2) : Math.max(tengah, p1 + lebar / 2);
      tengah = Math.min(L - tepi - lebar / 2, Math.max(tepi + lebar / 2, tengah));
    }
  }
  const b = (v: number) => Math.round(v * 1000) / 1000;
  return { z0: b(tengah - lebar / 2), z1: b(tengah + lebar / 2), y0: b(y0), y1: b(y1) };
}
// ── Salin ke ruang sebelah ─────────────────────────────────────────────────

export const bulat2 = (v: number) => Math.round(v * 100) / 100;
/**
 * Salinan benda di ruang `tujuan` (id baru). Bila ukuran kedua ruang sama,
 * posisinya identik. Bila berbeda: benda yang menempel dinding (celah <= 25 cm)
 * tetap menempel dinding yang sama, perangkat plafon tetap tergantung dari
 * plafon, dan sisanya bergeser bersama titik tengah ruang - susunan meja &
 * kursi tidak ikut menyusut/merenggang.
 */
export function salinKeRuang(b: Benda, asal: Kotak, tujuan: Kotak): Benda {
  return { ...petakanKeKotak(b, asal, tujuan), id: idBaru() };
}
/** Posisi benda di kotak `tujuan` (aturan salinKeRuang), id tetap. */
export function petakanKeKotak(b: Benda, asal: Kotak, tujuan: Kotak): Benda {
  const r = (b.rot * Math.PI) / 180;
  //  Setengah jejak benda searah sumbu dunia (memperhitungkan rotasi).
  const ex = (Math.abs(Math.cos(r)) * b.w + Math.abs(Math.sin(r)) * b.d) / 2;
  const ez = (Math.abs(Math.sin(r)) * b.w + Math.abs(Math.cos(r)) * b.d) / 2;
  const TEMPEL = 0.25;
  const peta = (v: number, a0: number, aP: number, t0: number, tP: number, e: number) => {
    const rel = v - a0, celahA = rel - e, celahB = aP - rel - e;
    const baru = celahA <= TEMPEL && celahA <= celahB ? t0 + rel
      : celahB <= TEMPEL ? t0 + tP - (aP - rel)
        : t0 + tP / 2 + (rel - aP / 2);
    const m = Math.max(0.01, Math.min(e, tP / 2 - 0.01));
    return bulat2(Math.min(t0 + tP - m, Math.max(t0 + m, baru)));
  };
  const diPlafon = b.jenis === 'speaker-plafon' || (b.jenis === 'proyektor' && b.pasangProyektor !== 'meja') || b.elev + b.h >= asal.t - 0.05;
  const elev = diPlafon ? tujuan.t - (asal.t - b.elev) : Math.min(b.elev, tujuan.t - b.h);
  return {
    ...b,
    x: peta(b.x, asal.x0, asal.p, tujuan.x0, tujuan.p, ex),
    z: peta(b.z, 0, asal.l, 0, tujuan.l, ez),
    elev: bulat2(Math.max(0, elev)),
  };
}
/**
 * Salin seluruh isi satu ruang ke ruang sebelah. Sama dengan salinKeRuang per
 * benda, ditambah: proyektor yang sedang menembak layar di ruang asal
 * diletakkan pada posisi & arah yang sama relatif terhadap salinan layarnya,
 * jadi jarak lempar dan ukuran gambar tidak berubah walau ruangnya beda ukuran.
 */
export function salinIsi(isi: Benda[], ruang: Ruang, asal: Kotak, tujuan: Kotak): Benda[] {
  return petakanIsi(isi, ruang, asal, tujuan).map(b => ({ ...b, id: idBaru() }));
}
/** Seperti salinIsi, tapi id tetap (dipakai saat ukuran ruang diubah). */
function petakanIsi(isi: Benda[], ruang: Ruang, asal: Kotak, tujuan: Kotak): Benda[] {
  const baru = isi.map(b => petakanKeKotak(b, asal, tujuan));
  const indeks = new Map(isi.map((b, i) => [b.id, i]));
  isi.forEach((p, i) => {
    if (p.jenis !== 'proyektor') return;
    const layar = sinarProyektor(p, isi, ruang).layar;
    const j = layar ? indeks.get(layar.id) : undefined;
    if (!layar || j === undefined) return;
    const ke = baru[j];
    //  Posisi proyektor dalam koordinat lokal layar asal (kebalikan keDunia), lalu ke layar salinan.
    const r0 = (layar.rot * Math.PI) / 180, dx = p.x - layar.x, dz = p.z - layar.z;
    const [x, , z] = keDunia(ke, [dx * Math.cos(r0) - dz * Math.sin(r0), 0, dx * Math.sin(r0) + dz * Math.cos(r0)]);
    baru[i] = {
      ...baru[i], rot: (((p.rot - layar.rot + ke.rot) % 360) + 360) % 360,
      x: bulat2(Math.min(tujuan.x0 + tujuan.p - 0.1, Math.max(tujuan.x0 + 0.1, x))),
      z: bulat2(Math.min(tujuan.l - 0.1, Math.max(0.1, z))),
    };
  });
  return baru;
}
/**
 * Ukuran ruang diubah: isi tiap ruang ikut menyesuaikan dengan aturan yang
 * sama seperti salin ke ruang sebelah - yang menempel dinding tetap menempel,
 * perangkat plafon tetap di plafon, susunan meja-kursi bergeser bersama titik
 * tengah ruang (tidak tertinggal di posisi lama), proyektor tetap pada jarak
 * lemparnya ke layar. Isi Ruang 2 ikut bergeser bila Ruang 1 memanjang/
 * memendek. Ruang yang ukurannya tidak berubah tidak disentuh.
 */
export function sesuaikanUkuranRuang(benda: Benda[], lama: Ruang, baru: Ruang): Benda[] {
  const kLama = daftarRuang(lama), kBaru = daftarRuang(baru);
  const hasil = new Map<string, Benda>();
  kLama.forEach((asal, i) => {
    const tujuan = kBaru[i];
    if (!tujuan || (asal.x0 === tujuan.x0 && asal.p === tujuan.p && asal.l === tujuan.l && asal.t === tujuan.t)) return;
    const isi = benda.filter(b => ruangDari(lama, b.x) === i);
    petakanIsi(isi, lama, asal, tujuan).forEach(b => hasil.set(b.id, b));
  });
  return hasil.size ? benda.map(b => hasil.get(b.id) ?? b) : benda;
}
export type SumbuPusat = 'x' | 'z' | 'xz';
/**
 * Pusatkan isi tiap ruang (tombol "Pusatkan isi").
 *
 * Yang digeser hanya benda yang BEBAS di sumbu itu: benda yang menempel
 * dinding kiri/kanan (celah <= 25 cm) tidak digeser kiri-kanan, yang menempel
 * dinding depan/belakang tidak digeser maju-mundur - jadi videowall tetap di
 * dindingnya tetapi ikut ke tengah sepanjang dinding itu.
 *
 * Patokan titik tengah = susunan meja & kursi (yang memang ingin di tengah);
 * bila ruang tidak punya furnitur bebas, semua benda bebas. Seluruh benda
 * bebas digeser sejauh yang sama, jadi jarak antar benda tidak berubah.
 * Proyektor yang menembak layar ikut bergeser bersama layarnya (bukan
 * sendiri), supaya jarak lempar & arah tidak rusak.
 */
export function pusatkanIsi(benda: Benda[], ruang: Ruang, sumbu: SumbuPusat = 'xz'): Benda[] {
  const TEMPEL = 0.25;
  const hasil = new Map<string, Benda>();
  daftarRuang(ruang).forEach((k, ri) => {
    const isi = benda.filter(b => ruangDari(ruang, b.x) === ri);
    if (!isi.length) return;
    const jejak = (b: Benda) => {
      const r = (b.rot * Math.PI) / 180;
      return {
        ex: (Math.abs(Math.cos(r)) * b.w + Math.abs(Math.sin(r)) * b.d) / 2,
        ez: (Math.abs(Math.sin(r)) * b.w + Math.abs(Math.cos(r)) * b.d) / 2,
      };
    };
    const bebasX = (b: Benda) => { const { ex } = jejak(b); return b.x - k.x0 - ex > TEMPEL && k.x0 + k.p - b.x - ex > TEMPEL; };
    const bebasZ = (b: Benda) => { const { ez } = jejak(b); return b.z - ez > TEMPEL && k.l - b.z - ez > TEMPEL; };
    //  Proyektor yang menembak layar mengikuti layarnya.
    const ikutLayar = new Map<string, Benda>();
    for (const p of isi) {
      if (p.jenis !== 'proyektor') continue;
      const l = sinarProyektor(p, isi, ruang).layar;
      if (l) ikutLayar.set(p.id, l);
    }
    const geser = (axis: 'x' | 'z') => {
      const bebas = axis === 'x' ? bebasX : bebasZ;
      const gerak = isi.filter(b => !ikutLayar.has(b.id) && bebas(b));
      if (!gerak.length) return 0;
      const furnitur = gerak.filter(b => b.jenis === 'meja' || b.jenis === 'kursi');
      const patokan = furnitur.length ? furnitur : gerak;
      let min = Infinity, maks = -Infinity;
      for (const b of patokan) {
        const e = axis === 'x' ? jejak(b).ex : jejak(b).ez;
        min = Math.min(min, b[axis] - e); maks = Math.max(maks, b[axis] + e);
      }
      const tengah = axis === 'x' ? k.x0 + k.p / 2 : k.l / 2;
      return bulat2(tengah - (min + maks) / 2);
    };
    const dx = sumbu.includes('x') ? geser('x') : 0;
    const dz = sumbu.includes('z') ? geser('z') : 0;
    if (!dx && !dz) return;
    const pindah = (b: Benda, gx: boolean, gz: boolean): Benda => {
      const { ex, ez } = jejak(b);
      const lx = Math.min(ex, k.p / 2 - 0.01), lz = Math.min(ez, k.l / 2 - 0.01);
      return {
        ...b,
        x: gx && dx ? bulat2(Math.min(k.x0 + k.p - lx, Math.max(k.x0 + lx, b.x + dx))) : b.x,
        z: gz && dz ? bulat2(Math.min(k.l - lz, Math.max(lz, b.z + dz))) : b.z,
      };
    };
    for (const b of isi) {
      const l = ikutLayar.get(b.id);
      const baru = l ? pindah(b, bebasX(l), bebasZ(l)) : pindah(b, bebasX(b), bebasZ(b));
      if (baru.x !== b.x || baru.z !== b.z) hasil.set(b.id, baru);
    }
  });
  return hasil.size ? benda.map(b => hasil.get(b.id) ?? b) : benda;
}
