/**
 * uji/blending-proyektor.ts - area blending antar proyektor (desain3d/inti/blending.ts):
 * lebar (cm) & persen tumpang tindih gambar, arah, keterhalangan, ujung garis ukur, teks label.
 *
 * Jalankan: npx tsx uji/blending-proyektor.ts
 */
import { bendaBaru, lensaDari, arahSinar, keGambar, dalamGambar, tumpangGaris, hitungBlending, teksBlending,
  barisKeterangan, pikselBlending, jarakTitik,
  type Benda, type Titik, type Lensa } from '../app/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const dekat = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const K = { x0: 0, p: 12, l: 8, t: 4 };

/** Proyektor menghadap dinding depan (z = 0) dari jarak tertentu, tanpa tilt. */
const proj = (x: number, z: number, tr = 1.5, atur: Partial<Benda> = {}): Benda =>
  ({ ...bendaBaru('proyektor', K, { pasangProyektor: 'plafon' }), x, z, rot: 180, elev: 2.5, tilt: 0, throwRatio: tr, offsetLensa: 0, ...atur });

/** Titik sinar (u, v) yang jatuh di dinding z = 0. */
const keDinding = (L: Lensa, u: number, v: number): Titik | null => {
  const d = arahSinar(L, u, v);
  if (d[2] >= 0) return null;
  const t = -L.O[2] / d[2];
  return [L.O[0] + d[0] * t, L.O[1] + d[1] * t, 0];
};
const N = 81;
const garis = (L: Lensa, sumbu: 'baris' | 'kolom') =>
  Array.from({ length: N }, (_, i) => { const s = i / (N - 1) - 0.5; return sumbu === 'baris' ? keDinding(L, s, 0) : keDinding(L, 0, s); });
const sampel = (p: Benda) => { const L = lensaDari(p); return { p, L, baris: garis(L, 'baris'), kolom: garis(L, 'kolom') }; };

console.log('Model lensa');
{
  const L = lensaDari(proj(4, 5));
  const pusat = keDinding(L, 0, 0)!;
  const k = keGambar(L, pusat)!;
  cek('keGambar(arahSinar(u,v)) kembali ke (u,v)', dekat(k.u, 0, 1e-9) && dekat(k.v, 0, 1e-9));
  const kanan = keDinding(L, 0.5, 0.2)!, kk = keGambar(L, kanan)!;
  cek('titik tepi kanan (0,5 ; 0,2) bolak-balik tepat', dekat(kk.u, 0.5, 1e-9) && dekat(kk.v, 0.2, 1e-9));
  const lebar = keDinding(L, 0.5, 0)![0] - keDinding(L, -0.5, 0)![0];
  cek('lebar gambar = jarak lempar / throw ratio', dekat(Math.abs(lebar), Math.abs(L.O[2]) / 1.5, 1e-6), `${lebar}`);
  cek('titik di luar bingkai terdeteksi', !dalamGambar(L, keDinding(L, 0.6, 0)!) && dalamGambar(L, pusat));
  cek('titik di belakang lensa = null', keGambar(L, [L.O[0], L.O[1], L.O[2] + 2]) === null);
}

console.log('Dua proyektor berdampingan di dinding datar');
{
  const A = proj(3, 6), B = proj(6.5, 6);
  const sA = sampel(A), sB = sampel(B);
  //  Tepi gambar sebenarnya di dinding -> lebar tumpang & persen yang diharapkan.
  const xa = [keDinding(sA.L, -0.5, 0)![0], keDinding(sA.L, 0.5, 0)![0]].sort((p, q) => p - q);
  const xb = [keDinding(sB.L, -0.5, 0)![0], keDinding(sB.L, 0.5, 0)![0]].sort((p, q) => p - q);
  const harap = Math.min(xa[1], xb[1]) - Math.max(xa[0], xb[0]);
  const lebarA = xa[1] - xa[0];
  const hasil = hitungBlending([sA, sB]);
  cek('satu pasangan blending', hasil.length === 1, JSON.stringify(hasil.map(h => [h.namaA, h.namaB])));
  const h = hasil[0];
  cek(`arah kiri-kanan`, h?.arah === 'kiri-kanan');
  cek(`lebar ±${Math.round(harap * 100)} cm (toleransi 1 sampel)`, !!h && dekat(h.lebarM, harap, lebarA / (N - 1)), `${h?.lebarM}`);
  cek('persen = lebar / lebar gambar', !!h && dekat(h.persenA, (harap / lebarA) * 100, 100 / (N - 1)), `${h?.persenA} vs ${(harap / lebarA) * 100}`);
  cek('gambar sama besar -> persen A = persen B', !!h && dekat(h.persenA, h.persenB, 0.5));
  cek('titik tengah di antara kedua tepi tumpang', !!h && h.tengah[0] > Math.max(xa[0], xb[0]) && h.tengah[0] < Math.min(xa[1], xb[1]));
  //  Gambar A tumpah ke permukaan lain di tepi kirinya (titik melompat jauh) -> persen tetap.
  const tumpah = { ...sA, baris: sA.baris.map((x, i) => (i < 10 && x ? [x[0] - 3, x[1], 2] as Titik : x)) };
  const h2 = hitungBlending([tumpah, sB])[0];
  cek('gambar tumpah ke dinding lain: persen tidak berubah', !!h2 && !!h && dekat(h2.persenA, h.persenA, 0.01), `${h2?.persenA} vs ${h?.persenA}`);
  const teks = h ? teksBlending(h) : '';
  cek('teks label "cm · %"', /^\d+ cm · \d+%$/.test(teks), teks);
  //  Garis ukur: ujungnya TEPAT di kedua tepi area blending (diinterpolasi di bingkai B, bukan per sampel).
  const xs = h ? h.garis.map(t => t[0]).sort((p, q) => p - q) : [];
  cek('garis ukur mulai tepat di tepi gambar B (±1 mm)', !!h && dekat(xs[0], Math.max(xa[0], xb[0]), 0.001), `${xs[0]} vs ${Math.max(xa[0], xb[0])}`);
  cek('garis ukur berakhir tepat di tepi gambar A (±1 mm)', !!h && dekat(xs[xs.length - 1], Math.min(xa[1], xb[1]), 0.001), `${xs[xs.length - 1]} vs ${Math.min(xa[1], xb[1])}`);
  const panjangGaris = h ? h.garis.slice(1).reduce((t, x, i) => t + jarakTitik(h.garis[i], x), 0) : 0;
  cek('panjang garis ukur = lebar area', !!h && dekat(panjangGaris, h.lebarM, 0.002), `${panjangGaris} vs ${h?.lebarM}`);
  cek('lebar kini tepat (±1 mm), bukan lagi ±1 sampel', !!h && dekat(h.lebarM, harap, 0.001), `${h?.lebarM} vs ${harap}`);
  cek('persen kini tepat (±0,05%)', !!h && dekat(h.persenA, (harap / lebarA) * 100, 0.05), `${h?.persenA} vs ${(harap / lebarA) * 100}`);
}

console.log('Keterangan detail (kartu di kanvas)');
{
  const b = { a: '1', b: '2', namaA: 'Proyektor 1', namaB: 'Proyektor 2', arah: 'kiri-kanan' as const, lebarM: 0.494, persenA: 12, persenB: 11.2, tengah: [0, 0, 0] as Titik, garis: [] };
  cek('piksel kiri-kanan dari 1920', pikselBlending(12, 'kiri-kanan') === 230);
  cek('piksel atas-bawah dari 1080', pikselBlending(10, 'atas-bawah') === 108);
  const k = barisKeterangan(b, n => n.replace('Proyektor ', 'P'));
  cek('kartu 4 baris', k.length === 4, JSON.stringify(k));
  cek('baris judul memuat pasangan & arah', k[0] === 'Area blending P1 ↔ P2 · kiri-kanan', k[0]);
  cek('baris lebar dalam cm', k[1] === 'Lebar area 49 cm', k[1]);
  cek('baris persen & piksel tiap proyektor', k[2] === 'P1: 12% ≈ 230 px · P2: 11% ≈ 215 px', k[2]);
  cek('atas-bawah memakai tinggi gambar', barisKeterangan({ ...b, arah: 'atas-bawah' })[1].startsWith('Tinggi area'));
}

console.log('Ukuran gambar berbeda, tidak bertumpuk, terhalang, tersusun atas-bawah');
{
  //  B lebih dekat ke dinding -> gambar lebih kecil -> persen tumpang di B lebih besar.
  const A = proj(3, 6), B = proj(5.6, 4);
  const h = hitungBlending([sampel(A), sampel(B)])[0];
  cek('gambar beda ukuran: persen B > persen A', !!h && h.persenB > h.persenA + 2, h ? `${h.persenA} / ${h.persenB}` : 'tak ada');
  cek('teks memuat dua persen', !!h && /\d+% \/ \d+%$/.test(teksBlending(h)), h ? teksBlending(h) : '');
  cek('berjauhan: tidak ada blending', hitungBlending([sampel(proj(1.5, 3)), sampel(proj(9, 3))]).length === 0);
  cek('terhalang benda (terlihat = false): tidak ada blending', hitungBlending([sampel(proj(3, 6)), sampel(proj(6.5, 6))], () => false).length === 0);
  //  Tersusun atas-bawah: x sama, lensa beda tinggi.
  const atas = proj(4, 6, 1.5, { elev: 3.6 }), bawah = proj(4, 6, 1.5, { elev: 2.0 });
  const v = hitungBlending([sampel(atas), sampel(bawah)])[0];
  cek('tersusun atas-bawah terdeteksi', v?.arah === 'atas-bawah', v ? `${v.arah} ${teksBlending(v)}` : 'tak ada');
  const garisA = sampel(proj(3, 6)).baris;
  cek('tumpangGaris tanpa tumpang = null', tumpangGaris(garisA, lensaDari(proj(11, 2))) === null);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
