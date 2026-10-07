/**
 * desain3d/mesin/alatBantu.ts - Alat bantu kanvas: label ukuran & produk, garis jarak terjauh, kerucut sudut pandang, sinar proyektor (raycast ke semua permukaan), jangkauan speaker, jalur kabel, garis ukuran display (mm).
 * Dipanggil useAdegan setiap keadaan terkait berubah; isi lama dibuang dulu oleh pemanggil / fungsi ini.
 */
import { f } from '../../bersama/ui';
import { arahProyektor, type Benda, berkasLineArray, cakupanSpeakerPlafon, DISPLAY, geserLensaDari, jangkauanDari, modulLA, offsetLensaDari, ruangDari, sebaranSpeaker, sebaranVSpeaker, sinarProyektor, throwRatioDari, TINGGI_DENGAR, tipeSpeakerDari, arahSinar, lensaDari, type Lensa, type Titik } from '../inti';
import { gambarJalurKabel } from './gambarKabel';
import { gambarBlending } from './blending';
import { gambarGarisUkurDisplay } from './garisUkurDisplay';
import type * as T from 'three';
import type { KeadaanDesain } from '../useKeadaanDesain';
import type { Mesin } from './tipe';

export type KeadaanAlatBantu = Pick<KeadaanDesain, 'analisis' | 'benda' | 'garisUkur' | 'jangkau' | 'kabel' | 'kerucut' | 'kotakRuang' | 'labelProduk' | 'pilih' | 'plafonDi' | 'ruang' | 'sinar' | 'sudutNyaman' | 'tampilKabel' | 'ukur' | 'tampilBlending' | 'setInfoBlending'>;

export function gambarAlatBantu(m: Mesin, k: KeadaanAlatBantu) {
  const { THREE, grupBantu, CSS2DObject } = m;
  const { analisis, benda, garisUkur, jangkau, kabel, kerucut, kotakRuang, labelProduk, pilih, plafonDi, ruang, sinar, sudutNyaman, tampilKabel, ukur, tampilBlending, setInfoBlending } = k;
  //  Isi lama dibuang BESERTA geometri & materialnya: efek ini berjalan tiap
  //  frame selama benda diseret, jadi tanpa dispose memori GPU terus naik.
  grupBantu.traverse(o => {
    const el = (o as { element?: HTMLElement }).element; if (el) el.remove();
    const mesh = o as T.Mesh; mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    mats.forEach(mt => mt.dispose());
  });
  grupBantu.clear();
  const label = (teks: string, pos: T.Vector3, nada: 'biru' | 'hijau' | 'merah' | 'abu' | 'ungu' = 'biru') => {
    const el = document.createElement('div');
    el.textContent = teks;
    const latar = { hijau: '#047857', merah: '#b91c1c', biru: '#1d4ed8', abu: '#334155', ungu: '#7c3aed' }[nada];
    el.style.cssText = `font:600 11px system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;color:#fff;background:${latar};box-shadow:0 1px 3px rgba(0,0,0,.3)`;
    const o = new CSS2DObject(el); o.position.copy(pos); grupBantu.add(o);
    return el;
  };
  /** Label produk: kecil, menempel di tepi benda (dy -1 = tepat di atas titik, 1 = tepat di bawah). */
  const labelP = (teks: string, pos: T.Vector3, dy: -1 | 1 = -1) => {
    const el = document.createElement('div');
    el.textContent = teks;
    el.dataset.produk = '1'; el.dataset.dy = String(dy);
    el.style.cssText = `font:600 9.5px system-ui,sans-serif;line-height:1.25;padding:0 5px;border-radius:999px;white-space:nowrap;color:#0f172a;background:rgba(255,255,255,.9);border:1px solid #cbd5e1;margin-top:${dy * 7}px`;
    const o = new CSS2DObject(el); o.position.copy(pos); grupBantu.add(o);
  };
  for (const a of analisis) {
    const d = a.d;
    const r = (d.rot * Math.PI) / 180;
    const pusat = new THREE.Vector3(d.x, d.elev + d.h / 2, d.z);
    if (kerucut) {
      // Kerucut nyaman ±sudutNyaman (bawaan 45°) di lantai, sejauh penonton terjauh (min 3 m), dipotong di dinding ruangnya.
      const k = kotakRuang[a.ri] ?? kotakRuang[0];
      const panjang = Math.max(3, a.terjauh + 0.5);
      const potong = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -k.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), k.x0 + k.p),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), k.l),
      ];
      const setengah = (Math.min(85, Math.max(5, sudutNyaman)) * Math.PI) / 180;
      const kipas = new THREE.Mesh(new THREE.CircleGeometry(panjang, 32, Math.PI / 2 - setengah, setengah * 2),
        new THREE.MeshBasicMaterial({ color: a.cukup ? 0x22c55e : 0xef4444, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: potong }));
      kipas.rotation.x = -Math.PI / 2; kipas.rotation.z = r;
      kipas.position.set(d.x, 0.01, d.z); grupBantu.add(kipas);
    }
    if (ukur || (labelProduk && !d.sembunyiLabel)) {
      //  Garis ukuran aktif: label cukup nama, digeser di atas angka mm supaya tidak bertumpuk.
      //  Ukuran mati tetapi label produk hidup: cukup nama display.
      const adaGaris = garisUkur && !d.sembunyiUkur;
      const naik = adaGaris ? Math.max(0.1, Math.min(0.3, Math.max(d.w, d.h) * 0.04)) + (d.jenis === 'layar' ? 0.22 : 0) + Math.max(0.1, Math.min(0.25, Math.max(d.w, d.h) * 0.035)) * 2.2 : 0.02;
      labelP(adaGaris || !ukur ? d.nama : `${d.nama}: ${f(d.w)} × ${f(d.h)} m`, new THREE.Vector3(d.x, d.elev + d.h + naik, d.z));
      if (a.terjauhP) {
        const ujung = new THREE.Vector3(a.terjauhP.x, 1.2, a.terjauhP.z);
        const garis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pusat, ujung]),
          new THREE.LineDashedMaterial({ color: a.cukup ? 0x047857 : 0xb91c1c, dashSize: 0.15, gapSize: 0.08 }));
        garis.computeLineDistances(); grupBantu.add(garis);
        label(`terjauh ${f(a.terjauh, 1)} m · ${a.cukup ? 'layar cukup' : `perlu tinggi ${f(a.tinggiPerlu)} m`}`,
          pusat.clone().lerp(ujung, 0.5), a.cukup ? 'hijau' : 'merah');
      }
    }
  }
  // Sinar proyektor: grid sinar dari lensa (TR/zoom, lens shift, pan & tilt) ditembakkan (raycast) ke
  // SEMUA permukaan - dinding, lantai, plafon, layar, bidang lengkung/cembung, furnitur, dan objek
  // .glb impor. Gambar jatuh tepat mengikuti permukaannya (melipat di sudut, menekuk di lengkungan);
  // tumpang-tindih antar proyektor (blending) tampil lebih terang karena dijumlahkan (aditif).
  // "Area blending": lebar (cm) & persen tumpang tiap pasangan + zona ungu - mesin/blending.ts.
  const daftarProj = benda.filter(p => p.jenis === 'proyektor');
  const hitungBlend = tampilBlending && daftarProj.length >= 2;
  if (!hitungBlend) setInfoBlending(v => (v.length ? [] : v));
  if ((sinar || hitungBlend) && daftarProj.length) {
    m.scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(); ray.near = 0.03; ray.far = 80;
    (ray.params as { Line?: { threshold: number } }).Line = { threshold: 0.0001 };
    //  Saat menyeret: grid lebih kasar supaya tetap lancar.
    const kasar = m.gizmo.dragging;
    const NX = kasar ? 12 : 24, NY = kasar ? 7 : 14;
    const cahaya = { transparent: true, depthWrite: false, toneMapped: false };
    //  Banyak proyektor (immersive): kerucut & bidang gambar diredam supaya tumpukannya tidak silau,
    //  label hanya untuk proyektor yang sedang dipilih.
    const banyak = daftarProj.length > 4, redam = banyak ? 0.35 : 1;
    /** Titik permukaan pertama yang terkena sinar (kaca & bayangan ditembus), mundur 1,2 cm ke arah lensa. */
    const tembak = (O: T.Vector3, arah: T.Vector3, sasaran: T.Object3D[]): T.Vector3 | null => {
      ray.set(O, arah);
      const hit = ray.intersectObjects(sasaran, true).find(h => {
        const o = h.object as T.Mesh;
        if (!o.isMesh) return false;
        const mt = (Array.isArray(o.material) ? o.material[0] : o.material) as T.Material & { opacity?: number };
        return !(mt?.transparent && (mt.opacity ?? 1) < 0.6);
      });
      return hit ? hit.point.clone().addScaledVector(arah, -0.012) : null;
    };
    /** Data per proyektor untuk area blending (inti/blending.ts). */
    const dataBlend: { p: Benda; L: Lensa; O: T.Vector3; sasaran: T.Object3D[]; kena: (T.Vector3 | null)[]; baris: (Titik | null)[]; kolom: (Titik | null)[] }[] = [];
    daftarProj.forEach((p, idx) => {
      const sn = sinarProyektor(p, benda, ruang);
      const O = new THREE.Vector3(...sn.asal);
      const sendiri = m.cache.get(p.id)?.obj;
      const sasaran = [...m.grupRuang.children, ...m.grupBenda.children.filter(o => o !== sendiri && !o.userData.sorot)];
      const r = (p.rot * Math.PI) / 180;
      const D = new THREE.Vector3(...arahProyektor(p)).normalize();
      const kanan = new THREE.Vector3(-Math.cos(r), 0, Math.sin(r));
      const atas = new THREE.Vector3().crossVectors(kanan, D).normalize();
      const w1 = 1 / throwRatioDari(p), h1 = (w1 * 9) / 16, arahV = p.pasangProyektor === 'meja' ? 1 : -1;
      const offV = offsetLensaDari(p), gH = geserLensaDari(p);
      const kena: (T.Vector3 | null)[] = [];
      const arah = new THREE.Vector3();
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const u = i / (NX - 1) - 0.5, v = j / (NY - 1) - 0.5;
        arah.copy(D).addScaledVector(kanan, (u + gH) * w1).addScaledVector(atas, (v + arahV * offV) * h1).normalize();
        kena.push(tembak(O, arah, sasaran));
      }
      const sel = (i: number, j: number) => kena[j * NX + i];
      if (hitungBlend) {
        //  Garis tengah mendatar & tegak gambar, sampel rapat (lebih kasar saat menyeret) - dasar ukur blending.
        const L = lensaDari(p), NB = kasar ? 31 : 81, NV = kasar ? 21 : 49;
        const keT = (v: T.Vector3 | null): Titik | null => (v ? [v.x, v.y, v.z] : null);
        const sampel = (u: number, v: number) => keT(tembak(O, arah.set(...arahSinar(L, u, v)), sasaran));
        dataBlend.push({
          p, L, O, sasaran, kena,
          baris: Array.from({ length: NB }, (_, i) => sampel(i / (NB - 1) - 0.5, 0)),
          kolom: Array.from({ length: NV }, (_, j) => sampel(0, j / (NV - 1) - 0.5)),
        });
      }
      if (!sinar) return;
      //  Bidang gambar: sel grid yang keempat sudutnya kena & tidak "melompat" (tepi objek ke dinding di belakangnya).
      const pos: number[] = [];
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const A = sel(i, j), B = sel(i + 1, j), C = sel(i + 1, j + 1), Dd = sel(i, j + 1);
        if (!A || !B || !C || !Dd) continue;
        const jarak = (A.distanceTo(O) + C.distanceTo(O)) / 2;
        const batas = ((jarak * w1) / (NX - 1)) * 6 + 0.05;
        if (A.distanceTo(B) > batas || B.distanceTo(C) > batas || C.distanceTo(Dd) > batas || Dd.distanceTo(A) > batas) continue;
        pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, A.x, A.y, A.z, C.x, C.y, C.z, Dd.x, Dd.y, Dd.z);
      }
      if (pos.length) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const gambar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfff1c2, opacity: (sn.layar ? 0.26 : 0.34) * (banyak ? 0.6 : 1), side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        gambar.renderOrder = 2; grupBantu.add(gambar);
      }
      //  Tepi gambar (warna per proyektor) + kerucut cahaya dari lensa ke tepi itu.
      const tepi: T.Vector3[] = [];
      for (let i = 0; i < NX; i++) tepi.push(sel(i, 0)!);
      for (let j = 1; j < NY; j++) tepi.push(sel(NX - 1, j)!);
      for (let i = NX - 2; i >= 0; i--) tepi.push(sel(i, NY - 1)!);
      for (let j = NY - 2; j > 0; j--) tepi.push(sel(0, j)!);
      const warnaTepi = new THREE.Color().setHSL((0.1 + idx * 0.17) % 1, 0.9, 0.55);
      const garis: number[] = [], kerucut: number[] = [], alfa: number[] = [];
      for (let i = 0; i < tepi.length; i++) {
        const A = tepi[i], B = tepi[(i + 1) % tepi.length];
        if (!A || !B) continue;
        if (A.distanceTo(B) < Math.max(0.6, A.distanceTo(O) * w1 * 0.4)) garis.push(A.x, A.y, A.z, B.x, B.y, B.z);
        kerucut.push(O.x, O.y, O.z, A.x, A.y, A.z, B.x, B.y, B.z);
        alfa.push(1, 0.84, 0.36, 0.45 * redam, 1, 0.9, 0.55, 0.08 * redam, 1, 0.9, 0.55, 0.08 * redam);
      }
      if (garis.length) {
        const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(garis, 3));
        grupBantu.add(new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ ...cahaya, color: warnaTepi, opacity: 0.95 })));
      }
      if (kerucut.length) {
        const g3 = new THREE.BufferGeometry();
        g3.setAttribute('position', new THREE.Float32BufferAttribute(kerucut, 3)); g3.setAttribute('color', new THREE.Float32BufferAttribute(alfa, 4));
        const kerucutSinar = new THREE.Mesh(g3, new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, side: THREE.DoubleSide }));
        kerucutSinar.renderOrder = 2; grupBantu.add(kerucutSinar);
      }
      const kilau = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfffbeb, blending: THREE.AdditiveBlending, opacity: 0.95 }));
      kilau.position.copy(O); grupBantu.add(kilau);
      if (ukur && (!banyak || p.id === pilih)) {
        const tengah = sel(Math.floor(NX / 2), Math.floor(NY / 2));
        const jarakSumbu = sn.layar ? sn.jarak : tengah ? tengah.distanceTo(O) : sn.jarak;
        const teks = `${p.nama}: lempar ${f(jarakSumbu)} m · gambar ±${f(jarakSumbu * w1)} × ${f(jarakSumbu * h1)} m`;
        //  Melayang di udara -> dari sudut tertentu bisa menimpa keterangan blending: mengalah (mesin/label.ts).
        label(teks, tengah ? O.clone().lerp(tengah, 0.3) : O.clone().addScaledVector(D, 0.5), 'abu').dataset.mengalah = '1';
      }
    });
    if (hitungBlend) gambarBlending(m, dataBlend, NX, NY, setInfoBlending);
  }
  //  Jangkauan suara speaker (kerucut sebaran H x V), dipotong di dinding, lantai & plafon ruangnya.
  //  Line array: satu berkas per modul + titik jatuh sumbunya di tinggi telinga. Tampil hanya bila
  //  dinyalakan: centang "Jangkauan speaker" (semua) atau "Tampilkan jangkauan" di panel Atur speaker itu.
  for (const b of benda) {
    if (!(b.jenis === 'speaker' || b.jenis === 'speaker-plafon')) continue;
    if (!(jangkau || b.tampilJangkauan)) continue;
    const k = kotakRuang[ruangDari(ruang, b.x)] ?? kotakRuang[0];
    const potong = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -k.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), k.x0 + k.p),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), k.l),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), k.t),
    ];
    const r = (b.rot * Math.PI) / 180;
    const maju = new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), kanan = new THREE.Vector3(-Math.cos(r), 0, Math.sin(r));
    const isi = (warna: number, opasitas: number) => new THREE.MeshBasicMaterial({ color: warna, transparent: true, opacity: opasitas, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: potong });
    /** Kerucut elips dari O sepanjang `sumbu`: lebar sebaran H (sepanjang kanan) x V (tegak lurus). */
    const kerucutElips = (O: T.Vector3, sumbu: T.Vector3, H: number, V: number, L: number, warna: number, opasitas: number) => {
      const rH = L * Math.tan((Math.min(170, H) / 2) * Math.PI / 180), rV = L * Math.tan((Math.min(170, V) / 2) * Math.PI / 180);
      const geo = new THREE.ConeGeometry(1, L, 48, 1, true); geo.translate(0, -L / 2, 0); geo.scale(rH, 1, rV);
      const sb = sumbu.clone().normalize(), sy = sb.clone().negate(), sz = new THREE.Vector3().crossVectors(kanan, sy).normalize();
      const m = new THREE.Mesh(geo, isi(warna, opasitas));
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(kanan, sy, sz)); m.position.copy(O);
      m.renderOrder = 3; grupBantu.add(m);
    };
    if (b.jenis === 'speaker-plafon') {
      const tinggi = b.elev - TINGGI_DENGAR;
      if (tinggi < 0.1) continue;
      const jari = cakupanSpeakerPlafon(b);
      const geo = new THREE.ConeGeometry(jari, tinggi, 40, 1, true); geo.translate(0, -tinggi / 2, 0);
      const kerucut = new THREE.Mesh(geo, isi(0xf59e0b, 0.07));
      kerucut.position.set(b.x, b.elev, b.z); kerucut.renderOrder = 3; grupBantu.add(kerucut);
      const cakram = new THREE.Mesh(new THREE.CircleGeometry(jari, 48), isi(0xf59e0b, 0.16));
      cakram.rotation.x = -Math.PI / 2; cakram.position.set(b.x, TINGGI_DENGAR, b.z); grupBantu.add(cakram);
      label(`Ø ${f(jari * 2)} m @ ${f(TINGGI_DENGAR)} m`, new THREE.Vector3(b.x, TINGGI_DENGAR + 0.1, b.z), 'abu');
      continue;
    }
    const tipe = tipeSpeakerDari(b), H = sebaranSpeaker(b), V = sebaranVSpeaker(b), L = jangkauanDari(b);
    if (tipe === 'linearray') {
      //  Tiap modul: berkas sempit (V per modul) ke arah sudutnya, warna bergradasi atas -> bawah,
      //  garis sumbu + titik jatuh di tinggi telinga = di mana modul itu "mendarat" di penonton.
      const berkas = berkasLineArray(b), n = berkas.length;
      const jatuh: number[] = [];
      berkas.forEach((x, i) => {
        const O = new THREE.Vector3(...x.asal), sumbu = new THREE.Vector3(...x.arah);
        const warna = new THREE.Color().setHSL(0.08 + 0.5 * (n > 1 ? i / (n - 1) : 0), 0.85, 0.55).getHex();
        kerucutElips(O, sumbu, H, V, L, warna, 0.06);
        const ujung = x.jatuh ? new THREE.Vector3(...x.jatuh) : O.clone().addScaledVector(sumbu, L);
        grupBantu.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([O, ujung]),
          new THREE.LineBasicMaterial({ color: warna, transparent: true, opacity: 0.85, clippingPlanes: potong })));
        if (x.jatuh && x.jarak !== null) {
          const titik = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshBasicMaterial({ color: warna, clippingPlanes: potong }));
          titik.position.copy(ujung); grupBantu.add(titik);
          jatuh.push(x.jarak);
        }
      });
      const teks = jatuh.length ? ` · menjangkau ${f(Math.min(...jatuh), 1)}–${f(Math.max(...jatuh), 1)} m` : '';
      label(`${b.nama}: ${modulLA(b)} modul · ${f(H, 0)}° H${teks}`, new THREE.Vector3(b.x, b.elev + b.h + 0.25, b.z), 'abu');
      continue;
    }
    //  Speaker dinding sedikit menunduk (10°) ke pendengar; portable & kotak berdiri lurus ke depan.
    const tunduk = tipe === 'kolom' ? 0 : 0.175;
    const tinggiPancar = tipe === 'kolom' ? b.elev + b.h - Math.min(0.85, Math.max(0.3, b.h * 0.36)) / 2 : b.elev + b.h / 2;
    const O = new THREE.Vector3(b.x, tinggiPancar, b.z).addScaledVector(maju, tipe === 'kolom' ? 0.06 : b.d / 2);
    const sumbu = maju.clone().multiplyScalar(Math.cos(tunduk)).add(new THREE.Vector3(0, -Math.sin(tunduk), 0)).normalize();
    kerucutElips(O, sumbu, H, V, L, 0xf59e0b, 0.08);
    label(`${b.nama}: ${f(H, 0)}° × ${f(V, 0)}° · ${f(L, 1)} m`, O.clone().addScaledVector(sumbu, Math.min(1.2, L * 0.25)).add(new THREE.Vector3(0, 0.2, 0)), 'abu');
  }
  if (ukur) {
    kotakRuang.forEach((k, i) => {
      label(`${f(k.p)} m`, new THREE.Vector3(k.x0 + k.p / 2, 0.05, k.l + 0.25));
      label(`${f(k.l)} m`, new THREE.Vector3(k.x0 + k.p + (i === kotakRuang.length - 1 ? 0.3 : -0.3), 0.05, k.l / 2));
      //  Di lantai pojok depan-kiri, bukan di tengah setinggi plafon: dari
      //  sudut kamera mana pun posisi itu jatuh tepat di atas display yang
      //  menempel di dinding, sehingga label "Ruang N" menutupi label ukuran
      //  display. Pojok depan-kiri jauh dari display & label ukuran ruang.
      if (kotakRuang.length > 1) label(`Ruang ${i + 1}`, new THREE.Vector3(k.x0 + Math.min(0.7, k.p / 4), 0.05, k.l - Math.min(0.45, k.l / 4)), 'abu');
    });
  }
  //  Jalur kabel ke rack (warna legend per jenis kabel).
  if (tampilKabel) gambarJalurKabel(THREE, grupBantu, kabel);
  //  Label produk: satu label per nama benda per ruang (kembar = "× jumlah"), di atas benda;
  //  benda di plafon (speaker plafon, proyektor gantung) labelnya di bawah benda.
  if (labelProduk) {
    const grup = new Map<string, Benda[]>();
    for (const b of benda) {
      //  Interior (meja, kursi, tribun, lampu) tidak diberi label - cukup perangkat AV.
      if (DISPLAY.includes(b.jenis) || ['meja', 'kursi', 'tribun', 'lampu'].includes(b.jenis) || b.sembunyiLabel) continue;
      const nama = b.nama.replace(/\s+\d+(\.\d+)?$/, '').trim() || b.nama;
      const kunci = `${ruangDari(ruang, b.x)}|${nama}`;
      const isi = grup.get(kunci); if (isi) isi.push(b); else grup.set(kunci, [b]);
    }
    for (const [kunci, isi] of grup) {
      const b = isi[0], nama = kunci.split('|').slice(1).join('|');
      const atas = b.elev + b.h;
      const diPlafon = atas > plafonDi(b.x) - 0.35;
      labelP(isi.length > 1 ? `${nama} ×${isi.length}` : nama,
        new THREE.Vector3(b.x, diPlafon ? Math.max(0.3, b.elev - 0.02) : atas + 0.02, b.z), diPlafon ? 1 : -1);
    }
  }
  //  Garis ukuran display: lebar di atas & tinggi di kanan, ujung bertanda, angka dalam mm.
  if (garisUkur) gambarGarisUkurDisplay(m, benda);
}
