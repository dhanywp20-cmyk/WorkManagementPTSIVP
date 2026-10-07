/**
 * desain3d/mesin/ukurBlending.ts - Garis ukur satu area blending di kanvas, gaya gambar kerja:
 *   |<------ 49 cm ------>|   garis menyusuri permukaan dari tepi ke tepi area blending (ikut
 *            |                lengkung layar), panah di kedua ujung tepat di tepi gambar, kaki ukur
 *            o                tegak di kedua ujung, angka lebar di atas garis, lalu garis penunjuk
 *   [ kartu keterangan ]      ke kartu detail (persen & perkiraan piksel tiap proyektor).
 * Garis & panah berupa mesh (ikut ke PNG / cetak), angka & kartu berupa label CSS2D (mesin/label.ts).
 */
import type * as T from 'three';
import { barisKeterangan, type Blending, type Lensa } from '../inti';
import type { Mesin } from './tipe';

const UNGU = 0x6d28d9;
const batas = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function gambarUkurBlending(m: Mesin, b: Blending, O: T.Vector3, L: Lensa, nama: (n: string) => string) {
  const { THREE, grupBantu, CSS2DObject } = m;
  if (b.garis.length < 2) return;
  //  Diangkat 3 cm dari permukaan ke arah lensa supaya garis tidak tenggelam di layar.
  const titik = b.garis.map(t => { const v = new THREE.Vector3(t[0], t[1], t[2]); return v.addScaledVector(O.clone().sub(v).normalize(), 0.03); });
  const panjang = titik.slice(1).reduce((s, p, i) => s + p.distanceTo(titik[i]), 0);
  if (panjang < 0.01) return;

  /** Titik sejauh `d` menyusuri garis dari ujung awal (atau dari ujung akhir bila `balik`). */
  const sepanjang = (d: number, balik = false) => {
    const t = balik ? [...titik].reverse() : titik;
    for (let i = 1; i < t.length; i++) {
      const s = t[i - 1].distanceTo(t[i]);
      if (d <= s) return t[i - 1].clone().lerp(t[i], s > 0 ? d / s : 0);
      d -= s;
    }
    return t[t.length - 1].clone();
  };
  const tengah = sepanjang(panjang / 2);
  const jarak = tengah.distanceTo(O);
  //  Ukuran penanda mengikuti besar gambar di titik itu, supaya terbaca di ruang kecil maupun besar.
  const kiriKanan = b.arah === 'kiri-kanan';
  const sisiTegak = jarak * (kiriKanan ? L.h1 : L.w1);
  const r = batas(jarak * L.w1 * 0.0045, 0.008, 0.025);
  const bahan = new THREE.MeshBasicMaterial({ color: UNGU, toneMapped: false });
  const Y = new THREE.Vector3(0, 1, 0);
  const tambah = (g: T.BufferGeometry, pos: T.Vector3, arah?: T.Vector3) => {
    const o = new THREE.Mesh(g, bahan); o.position.copy(pos); o.renderOrder = 4;
    if (arah) o.quaternion.setFromUnitVectors(Y, arah);
    grupBantu.add(o);
  };
  const batang = (a: T.Vector3, c: T.Vector3, rr = r) => {
    const d = c.clone().sub(a), len = d.length();
    if (len > 1e-4) tambah(new THREE.CylinderGeometry(rr, rr, len, 8), a.clone().addScaledVector(d, 0.5), d.normalize());
  };

  //  Garis ukur.
  for (let i = 1; i < titik.length; i++) batang(titik[i - 1], titik[i]);

  //  Arah "kaki" = tegak lurus garis di permukaan: sumbu atas gambar (blending kiri-kanan) / kanan (atas-bawah).
  const sumbuKaki = new THREE.Vector3(...(kiriKanan ? L.atas : L.kanan));
  const kakiDi = (singgung: T.Vector3) => sumbuKaki.clone().addScaledVector(singgung, -sumbuKaki.dot(singgung)).normalize();
  const tinggiPanah = Math.min(r * 9, panjang * 0.3), panjangKaki = batas(sisiTegak * 0.12, 0.12, 0.5);
  for (const balik of [false, true]) {
    const ujung = balik ? titik[titik.length - 1] : titik[0];
    const arah = ujung.clone().sub(sepanjang(Math.max(tinggiPanah, 0.02), balik)).normalize();
    //  Panah: ujung kerucut tepat di tepi area blending, menghadap keluar.
    tambah(new THREE.ConeGeometry(tinggiPanah * 0.38, tinggiPanah, 14), ujung.clone().addScaledVector(arah, -tinggiPanah / 2), arah);
    const kaki = kakiDi(arah);
    batang(ujung.clone().addScaledVector(kaki, -panjangKaki / 2), ujung.clone().addScaledVector(kaki, panjangKaki / 2), r * 0.7);
  }

  const singgungTengah = sepanjang(panjang / 2 + 0.01).sub(sepanjang(Math.max(0, panjang / 2 - 0.01))).normalize();
  const kaki = kakiDi(singgungTengah);
  //  data-penting: selalu tampil, label lain yang bertabrakan disembunyikan sementara (mesin/label.ts).
  //  Titik tumpu label (center CSS2D) dipindah tiap frame ke sisi yang MENJAUHI `dari` di layar: kartu &
  //  angka selalu berada di luar garis ukurnya, dari sudut kamera mana pun (PNG ikut, mesin/label.ts).
  const css = (el: HTMLElement, pos: T.Vector3, dari: T.Vector3) => {
    el.dataset.penting = '1';
    const o = new CSS2DObject(el) as T.Object3D & { center: T.Vector2 };
    o.position.copy(pos);
    const a = new THREE.Vector3(), c = new THREE.Vector3();
    o.onBeforeRender = ((rd: { getSize(): { width: number; height: number } }, _s: unknown, kamera: T.Camera) => {
      const { width, height } = rd.getSize();
      a.copy(dari).project(kamera); c.setFromMatrixPosition(o.matrixWorld).project(kamera);
      const sx = (c.x - a.x) * width, sy = (a.y - c.y) * height, k = Math.max(Math.abs(sx), Math.abs(sy));
      if (k > 1e-6) o.center.set(0.5 - (0.5 * sx) / k, 0.5 - (0.5 * sy) / k);
    }) as unknown as T.Object3D['onBeforeRender'];
    grupBantu.add(o);
  };

  //  Angka lebar di luar kaki ukur, seperti garis ukur gambar kerja.
  const angka = document.createElement('div');
  angka.textContent = `${Math.round(b.lebarM * 100)} cm`;
  angka.style.cssText = 'font:700 12px system-ui,sans-serif;color:#6d28d9;background:rgba(255,255,255,.92);border:1px solid #c4b5fd;padding:0 5px;border-radius:4px;white-space:nowrap';
  css(angka, tengah.clone().addScaledVector(kaki, panjangKaki / 2 + 0.03), tengah);

  //  Garis penunjuk (titik bulat di garis ukur) ke kartu keterangan detail di sisi seberang angka.
  const ujungPenunjuk = tengah.clone().addScaledVector(kaki, -batas(sisiTegak * 0.22, 0.3, 1.4));
  tambah(new THREE.SphereGeometry(r * 2.2, 12, 8), tengah);
  batang(tengah, ujungPenunjuk, r * 0.6);
  const kartu = document.createElement('div');
  kartu.style.cssText = 'font:500 11px system-ui,sans-serif;line-height:1.35;padding:4px 8px;border-radius:8px;white-space:nowrap;color:#fff;background:#7c3aed;box-shadow:0 2px 6px rgba(0,0,0,.3)';
  barisKeterangan(b, nama).forEach((teks, i, semua) => {
    const baris = document.createElement('div');
    baris.textContent = teks;
    if (i === 0) baris.style.fontWeight = '700';
    if (i === semua.length - 1) { baris.style.fontSize = '10px'; baris.style.opacity = '0.85'; }
    kartu.appendChild(baris);
  });
  css(kartu, ujungPenunjuk, tengah);
}
