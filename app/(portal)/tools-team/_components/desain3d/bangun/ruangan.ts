/**
 * desain3d/bangun/ruangan.ts - Ruangan: lantai bertekstur + dinding tiap ruang (feature wall, sekat tembok / kaca / jendela / terbuka, pintu & jendela dinding luar). Dinding FrontSide: yang membelakangi kamera otomatis tembus seperti denah rumah boneka.
 * Dipanggil useAdegan setiap keadaan terkait berubah; isi lama dibuang dulu oleh pemanggil / fungsi ini.
 */
import { teksturDindingAksen } from '.';
import { teksturLantai } from './tekstur';
import { bukaanDinding, daftarRuang, jendelaSekat, type Kotak, pintuSekat, sambunganKe, type SisiDinding, teksturSah, UBIN_AWAL_DINDING, UBIN_AWAL_LANTAI, ukuranPintu, ulangTekstur, warnaSah } from '../inti';
import type * as T from 'three';
import type { Ruang } from '../inti';

/** Gambar tekstur lantai / dinding yang sudah termuat (kunci -> gambar); undefined = belum / tidak ada. */
export type AmbilGambarTekstur = (kunci: string) => HTMLImageElement | undefined;

export function bangunRuangan(THREE: typeof T, grupRuang: T.Group, ruang: Ruang, gambarTekstur?: AmbilGambarTekstur) {
  //  Lepas geometri, material & tekstur lantai lama (ukuran ruang bisa berubah tiap ketukan).
  grupRuang.traverse(o => {
    const mesh = o as T.Mesh; mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const mt of mats) { for (const v of Object.values(mt)) if (v instanceof THREE.Texture) v.dispose(); mt.dispose(); }
  });
  grupRuang.clear();
  const daftar = daftarRuang(ruang);
  const lantaiDari = (i: number) => (i === 0 ? ruang.lantai : sambunganKe(ruang, i)?.lantai ?? 'kayu');
  //  Tekstur gambar sendiri (inti/teksturRuang.ts): diulang per ubin (m). Gambar dipakai ulang antar bangun ulang,
  //  hanya objek Texture-nya yang dibuat baru (yang lama dilepas di atas).
  const teksturGambar = (img: HTMLImageElement, rx: number, ry: number) => {
    const t = new THREE.Texture(img);
    t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    return t;
  };
  const tL = teksturSah(ruang.teksturLantai, UBIN_AWAL_LANTAI), gambarLantai = tL ? gambarTekstur?.(tL.kunci) : undefined;
  const tD = teksturSah(ruang.teksturDinding, UBIN_AWAL_DINDING), gambarDinding = tD ? gambarTekstur?.(tD.kunci) : undefined;
  const bahanDinding = gambarDinding && tD
    ? new THREE.MeshStandardMaterial({ map: teksturGambar(gambarDinding, 1, 1), roughness: 0.9, side: THREE.FrontSide })
    : new THREE.MeshStandardMaterial({ color: warnaSah(ruang.warnaDinding) ?? 0xf5f5f4, roughness: 0.95, side: THREE.FrontSide });
  //  Feature wall depan: marmer / panel kayu, UV dalam meter supaya slab tidak melar.
  const aksen = ruang.dindingDepan && ruang.dindingDepan !== 'polos' ? teksturDindingAksen(THREE, ruang.dindingDepan) : null;
  const bahanAksen = aksen ? new THREE.MeshStandardMaterial({ map: aksen.tex, roughness: ruang.dindingDepan === 'marmer' ? 0.25 : 0.7, metalness: ruang.dindingDepan === 'marmer' ? 0.05 : 0, side: THREE.FrontSide }) : null;
  const garis = new THREE.LineBasicMaterial({ color: 0xa8a29e });
  //  Sekat antar ruang (j = sekat di kiri ruang j): 'tembok' (bawaan), 'kaca' = kaca penuh berangka
  //  aluminium, 'jendela' = tetap tembok dengan SATU jendela kaca persegi untuk melihat ke ruang
  //  sebelah (ruang observasi / sidang), 'terbuka' = tanpa sekat (dua ruang menyatu, mis. bentuk L).
  const jenisSekat = (j: number) => sambunganKe(ruang, j)?.sekat ?? 'tembok';
  const bahanRangkaGelap = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 });
  const bahanKaca = new THREE.MeshPhysicalMaterial({
    color: 0xcfe6f5, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  });
  const bahanRangka = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.35 });

  type Lubang = { x0: number; x1: number; y0: number; y1: number; jenis: 'pintu' | 'jendela' | 'terbuka'; luar?: boolean };
  //  Bahan pintu & jendela dinding luar - FrontSide supaya ikut "tembus" bersama dindingnya.
  const bahanKacaLuar = new THREE.MeshStandardMaterial({ color: 0xcfe3f5, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.FrontSide, depthWrite: false });
  const bahanKusenLuar = new THREE.MeshStandardMaterial({ color: 0x3f4650, metalness: 0.5, roughness: 0.4, side: THREE.FrontSide });
  const bahanDaunPintu = new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.6, side: THREE.FrontSide });
  const bahanGagang = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.25, side: THREE.FrontSide });
  /** Lubang pintu/jendela dinding luar ruang i, dalam koordinat lokal dinding (pusat dinding = 0). */
  const lubangLuar = (i: number, sisi: SisiDinding, panjang: number): Lubang[] =>
    bukaanDinding(ruang, i, sisi).map(x => ({ x0: x.x0 - panjang / 2, x1: x.x1 - panjang / 2, y0: x.y0, y1: x.y1, jenis: x.b.jenis, luar: true }));
  /**
   * Dinding sepanjang `panjang`, tengah (x,z), dengan lubang (koordinat lokal
   * dinding: x sepanjang dinding, y dari lantai). `tembus` = kaca penuh;
   * `pasangKaca` = isi lubang jendela dengan kaca + kusen (cukup di SATU sisi
   * sekat - dua bidang kaca di posisi yang sama akan berkedip).
   */
  const dinding = (panjang: number, tinggi: number, x: number, z: number, rotY: number, lubang: Lubang[] = [], opsi: { tembus?: boolean; pasangKaca?: boolean; aksen?: boolean } = {}) => {
    const tembus = !!opsi.tembus;
    const gw = new THREE.Group(); gw.position.set(x, 0, z); gw.rotation.y = rotY;
    const bidang = (x0: number, x1: number, y0: number, y1: number) => {
      if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
      const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
      //  UV dalam meter (dibagi ukuran ubin) supaya slab / gambar tidak melar mengikuti lebar dinding.
      const ubin = opsi.aksen && aksen && bahanAksen ? { w: aksen.ubinW, h: aksen.ubinH } : gambarDinding && tD ? { w: tD.ubin, h: tD.ubin } : null;
      if (ubin && !tembus) {
        const uv = geo.attributes.uv as T.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0) + panjang / 2) / ubin.w, (y0 + uv.getY(i) * (y1 - y0)) / ubin.h);
      }
      const d = new THREE.Mesh(geo, tembus ? bahanKaca : opsi.aksen && bahanAksen ? bahanAksen : bahanDinding);
      d.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); d.receiveShadow = !tembus; gw.add(d);
    };
    const balok = (w: number, h: number, bx: number, by: number, m: T.Material = bahanRangkaGelap, tebal = 0.07) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, tebal), m); o.position.set(bx, by, 0); gw.add(o);
    };
    if (tembus) {
      //  Rangka: tiang tiap ±1,2 m + ambang atas & bawah, supaya kacanya terbaca sebagai kaca.
      const n = Math.max(1, Math.round(panjang / 1.2));
      for (let i = 0; i <= n; i++) {
        const xt = -panjang / 2 + (panjang * i) / n;
        if (lubang.some(l => xt > l.x0 - 0.05 && xt < l.x1 + 0.05)) continue;   // jangan menghalangi pintu
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, tinggi, 0.05), bahanRangka);
        t.position.set(xt, tinggi / 2, 0); gw.add(t);
      }
      for (const y of [0.02, tinggi - 0.02]) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(panjang, 0.04, 0.05), bahanRangka);
        a.position.set(0, y, 0); gw.add(a);
      }
    }
    //  Isi dinding = potongan-potongan persegi di sekitar lubang: dibagi per
    //  lajur di antara tepi-tepi lubang, tiap lajur diisi di atas & bawah lubangnya.
    const xs = [...new Set([-panjang / 2, panjang / 2, ...lubang.flatMap(l => [l.x0, l.x1])]
      .map(v => Math.min(panjang / 2, Math.max(-panjang / 2, v))))].sort((p1, p2) => p1 - p2);
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1], tengah = (xa + xb) / 2;
      let y = 0;
      for (const l of lubang.filter(h => h.x0 < tengah && h.x1 > tengah).sort((h1, h2) => h1.y0 - h2.y0)) {
        bidang(xa, xb, y, l.y0); y = Math.max(y, l.y1);
      }
      bidang(xa, xb, y, tinggi);
    }
    for (const l of lubang) {
      if (l.luar) {
        //  Pintu/jendela dinding luar: bidang-bidang FrontSide (kusen, kaca / daun pintu) sedikit di depan dinding.
        const w = l.x1 - l.x0, h = l.y1 - l.y0, cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2;
        const kepingan = (pw: number, ph: number, px: number, py: number, m: T.Material, pz = 0.006) => {
          const o = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), m); o.position.set(px, py, pz); gw.add(o);
        };
        const k = l.jenis === 'pintu' ? 0.06 : 0.05;
        kepingan(w + 2 * k, k, cx, l.y1 + k / 2, bahanKusenLuar);
        if (l.jenis === 'jendela') kepingan(w + 2 * k, k, cx, l.y0 - k / 2, bahanKusenLuar);
        kepingan(k, h, l.x0 - k / 2, cy, bahanKusenLuar); kepingan(k, h, l.x1 + k / 2, cy, bahanKusenLuar);
        if (l.jenis === 'jendela') {
          kepingan(w, h, cx, cy, bahanKacaLuar, -0.004);
          //  Palang tengah tiap ±1 m supaya terbaca sebagai jendela, bukan lubang.
          const n = Math.max(1, Math.round(w / 1.0));
          for (let j = 1; j < n; j++) kepingan(0.035, h, l.x0 + (w * j) / n, cy, bahanKusenLuar, 0.004);
        } else {
          kepingan(w - 0.01, h - 0.005, cx, cy - 0.0025, bahanDaunPintu, 0.003);
          const gagang = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), bahanGagang);
          gagang.position.set(l.x1 - Math.min(0.09, w * 0.15), Math.min(1.0, h * 0.48), 0.008); gw.add(gagang);
          kepingan(0.11, 0.022, l.x1 - Math.min(0.09, w * 0.15) - 0.05, Math.min(1.0, h * 0.48), bahanGagang, 0.009);
        }
        continue;
      }
      if (l.jenis === 'pintu') {
        const kusen = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(l.x1 - l.x0, l.y1 - l.y0)), garis);
        kusen.position.set((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 0.002); gw.add(kusen);
      } else if (l.jenis === 'jendela' && opsi.pasangKaca) {
        //  Kaca jendela + kusen gelap di keempat sisi.
        const w = l.x1 - l.x0, h = l.y1 - l.y0, cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2, k = 0.05;
        const kaca2 = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bahanKaca); kaca2.position.set(cx, cy, 0); gw.add(kaca2);
        balok(w + 2 * k, k, cx, l.y1 + k / 2); balok(w + 2 * k, k, cx, l.y0 - k / 2);
        balok(k, h, l.x0 - k / 2, cy); balok(k, h, l.x1 + k / 2, cy);
      }
    }
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(panjang, tinggi)), garis);
    e.position.y = tinggi / 2; gw.add(e);
    grupRuang.add(gw);
  };

  /**
   * Lubang di sekat ke-j, dalam koordinat lokal dinding (z dunia -> x lokal). `kanan` = dinding kanan
   * ruang j-1 (rotY -90°: x lokal = z - l/2); bukan = dinding kiri ruang j (rotY +90°: x lokal = -(z - l/2)).
   */
  const lubangSekat = (j: number, kanan: boolean, k: Kotak): Lubang[] => {
    if (j < 1 || j >= daftar.length) return [];
    const keLokal = (z0: number, z1: number) => (kanan ? [z0 - k.l / 2, z1 - k.l / 2] : [-(z1 - k.l / 2), -(z0 - k.l / 2)]);
    const hasil: Lubang[] = [];
    if (jenisSekat(j) === 'terbuka') {
      //  Tanpa sekat: bagian yang bersinggungan dengan ruang sebelah dibiarkan terbuka; sisa dinding
      //  (ruang yang lebih dalam) tetap tembok - ruang bentuk L.
      const [x0, x1] = keLokal(0, Math.min(daftar[j - 1].l, daftar[j].l));
      hasil.push({ x0, x1, y0: 0, y1: k.t, jenis: 'terbuka' });
      return hasil;
    }
    const pintuDi = pintuSekat(ruang, j), jendela = jendelaSekat(ruang, j);
    if (pintuDi !== null) {
      const up = ukuranPintu(ruang, j);
      const [x0, x1] = keLokal(pintuDi - up.lebar / 2, pintuDi + up.lebar / 2);
      hasil.push({ x0, x1, y0: 0, y1: Math.min(up.tinggi, k.t - 0.1), jenis: 'pintu' });
    }
    if (jendela) {
      const [x0, x1] = keLokal(jendela.z0, jendela.z1);
      hasil.push({ x0, x1, y0: jendela.y0, y1: jendela.y1, jenis: 'jendela' });
    }
    return hasil;
  };

  daftar.forEach((k, i) => {
    const jenis = lantaiDari(i);
    const lantai = new THREE.Mesh(new THREE.PlaneGeometry(k.p, k.l),
      gambarLantai && tL
        ? new THREE.MeshStandardMaterial({ map: teksturGambar(gambarLantai, ...ulangTekstur(k.p, k.l, tL.ubin)), roughness: 0.7 })
        : new THREE.MeshStandardMaterial({ map: teksturLantai(THREE, jenis, k.p, k.l, i === 0 ? ruang.warnaLantai : sambunganKe(ruang, i)?.warnaLantai), roughness: jenis === 'keramik' ? 0.35 : 0.8 }));
    lantai.rotation.x = -Math.PI / 2; lantai.position.set(k.x0 + k.p / 2, 0, k.l / 2); lantai.receiveShadow = true;
    grupRuang.add(lantai);
    dinding(k.p, k.t, k.x0 + k.p / 2, 0, 0, lubangLuar(i, 'depan', k.p), { aksen: true });  // depan (feature wall)
    dinding(k.p, k.t, k.x0 + k.p / 2, k.l, Math.PI, lubangLuar(i, 'belakang', k.p));       // belakang
    //  Kiri (rotY +90°: sumbu lokal x = -z dunia) & kanan (-90°: lokal x = +z dunia).
    //  Sekat kaca penuh cukup satu bidang (milik ruang di kirinya) - dua bidang tembus pandang di posisi yang sama akan berkedip.
    const adaKanan = i < daftar.length - 1;
    if (!(i > 0 && jenisSekat(i) === 'kaca')) dinding(k.l, k.t, k.x0, k.l / 2, Math.PI / 2, [...lubangSekat(i, false, k), ...lubangLuar(i, 'kiri', k.l)]);
    dinding(k.l, k.t, k.x0 + k.p, k.l / 2, -Math.PI / 2, [...(adaKanan ? lubangSekat(i + 1, true, k) : []), ...lubangLuar(i, 'kanan', k.l)],
      { tembus: adaKanan && jenisSekat(i + 1) === 'kaca', pasangKaca: adaKanan });
  });
}
