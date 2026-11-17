import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { type Benda, bendaBaru, bolaBidang, daftarRuang, lengkungDari, type Ruang, terapkanUkuran } from '../app/(portal)/tools-team/_components/desain3d/inti';
import { bangunBidang, bangunObjek } from '../app/(portal)/tools-team/_components/desain3d/bangun/mapping';
import { buatPenembak } from '../app/(portal)/tools-team/_components/desain3d/mesin/penembak';
import { buatPenjagaBayangan } from '../app/(portal)/tools-team/_components/desain3d/mesin/bayanganHemat';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const ruang: Ruang = { p: 10, l: 10, t: 4, lantai: 'polos', r2: null };
const k = daftarRuang(ruang)[0];
const D = 'app/(portal)/tools-team/_components/desain3d/';

function grupDari(b: Benda, bangun: typeof bangunBidang) {
  const g = new THREE.Group();
  bangun({ THREE, g, b, W: (x: number) => x } as never);
  g.position.set(b.x, b.elev, b.z); g.rotation.y = (b.rot * Math.PI) / 180;
  return g;
}

console.log('\n1. Penembak cepat = raycaster three.js');
const bola = terapkanUkuran({ ...bendaBaru('bidang', k, { bentukBidang: 'bola', jariBidang: 2, busur: 225 }), atasBola: 90, h: 3, x: 3, z: 2, elev: 0.38, rot: 20 });
const cekung = { ...bendaBaru('bidang', k, { bentukBidang: 'lengkung', ...lengkungDari(4, 0.8) }), x: 7.5, z: 1.5, h: 2, elev: 0.5, rot: -30 };
const datar = { ...bendaBaru('bidang', k, { bentukBidang: 'datar' }), w: 3, x: 5, z: 8.5, h: 2, elev: 0.4, rot: 180 };
const pesawat = { ...bendaBaru('objek', k, { bentukObjek: 'pesawat' }), x: 3, z: 3.5, elev: 0, rot: 0 };
const akar = [grupDari(bola, bangunBidang), grupDari(cekung, bangunBidang), grupDari(datar, bangunBidang), grupDari(pesawat, bangunObjek)];
const scene = new THREE.Scene(); scene.add(...akar); scene.updateMatrixWorld(true);
const analitik: THREE.Mesh[] = [];
scene.traverse(o => { if ((o as THREE.Mesh).isMesh && o.userData.analitik) analitik.push(o as THREE.Mesh); });
cek('layar bola, cekung & datar ditandai permukaan analitik', analitik.length === 3);
const calon: THREE.Mesh[] = [];
const kaca = (m: THREE.Mesh) => { const mt = m.material as THREE.Material; return mt.transparent && mt.opacity < 0.6; };
const lis: THREE.Mesh[] = [];
scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh && o.userData.tanpaBayangan) lis.push(o as THREE.Mesh); else if ((o as THREE.Mesh).isMesh && !kaca(o as THREE.Mesh)) calon.push(o as THREE.Mesh); });
const tembak = buatPenembak(THREE, akar);
const rc = new THREE.Raycaster(); rc.near = 0.03; rc.far = 80;
let seed = 11;
const acak = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const sumber = [new THREE.Vector3(3, 1.38, 3.2), new THREE.Vector3(3.4, 2.4, 4.6), new THREE.Vector3(7, 2.5, 4), new THREE.Vector3(5, 1.5, 6)];
const sinar: [THREE.Vector3, THREE.Vector3][] = [];
for (let i = 0; i < 4000; i++) sinar.push([sumber[i % sumber.length].clone(), new THREE.Vector3(acak() * 2 - 1, acak() * 2 - 1, acak() * 2 - 1).normalize()]);
let samaMesh = 0, kena = 0, selisihSegitiga = 0, selisihAnalitik: number[] = [];
let t0 = performance.now();
const hasilRc = sinar.map(([O, d]) => { rc.set(O, d); return rc.intersectObjects(calon, false)[0] ?? null; });
const msRc = performance.now() - t0;
t0 = performance.now();
const hasilP = sinar.map(([O, d]) => tembak(O, d));
const msP = performance.now() - t0;
sinar.forEach((_, i) => {
  const a = hasilRc[i], b = hasilP[i];
  if (!a && !b) { samaMesh++; return; }
  if (!a || !b || a.object !== b.mesh) return;
  samaMesh++; kena++;
  const s = Math.abs(a.distance - b.jarak);
  if (b.mesh.userData.analitik) selisihAnalitik.push(s); else selisihSegitiga = Math.max(selisihSegitiga, s);
});
selisihAnalitik = selisihAnalitik.sort((x, y) => x - y);
const median = selisihAnalitik[Math.floor(selisihAnalitik.length / 2)] ?? 0;
cek(`benda pertama yang kena sama untuk ${((samaMesh / sinar.length) * 100).toFixed(2)}% dari ${sinar.length} sinar (${kena} kena benda)`, samaMesh / sinar.length >= 0.995 && kena > 1000);
cek(`jarak ke segitiga (pesawat, kaki) identik (selisih maks ${selisihSegitiga.toExponential(1)} m)`, selisihSegitiga < 1e-9);
const semua = [...calon, ...lis], kenaLis = sinar.filter(([O, d]) => { rc.set(O, d); const h = rc.intersectObjects(semua, false)[0]; return !!h && lis.includes(h.object as THREE.Mesh); });
cek(`lis / bingkai tepi layar (${lis.length} mesh) dilewati sinar: tidak memotong gambar di tepi layar (${kenaLis.length} sinar lewat lis)`,
  lis.length >= 3 && kenaLis.length > 0 && kenaLis.every(([O, d]) => !lis.includes(tembak(O, d)?.mesh as THREE.Mesh)));
cek(`jarak ke layar analitik = jarak ke mesh bersegi (median ${(median * 1000).toFixed(2)} mm, ${selisihAnalitik.length} sinar)`, selisihAnalitik.length > 300 && median < 0.002);
cek(`lebih cepat dari raycaster three.js (${msP.toFixed(0)} ms vs ${msRc.toFixed(0)} ms)`, msP * 2 < msRc);
const bl = bolaBidang(bola), r = (bola.rot * Math.PI) / 180;
const atas = tembak(new THREE.Vector3(bola.x + bl.zP * Math.sin(r), bola.elev + bl.yP, bola.z + bl.zP * Math.cos(r)), new THREE.Vector3(-Math.sin(r) * Math.cos(1.4), Math.sin(1.4), -Math.cos(r) * Math.cos(1.4)));
cek('layar bola atas tertutup: sinar 80° ke atas dari pusat (mata pilot) kena layar di jari-jari 2 m', !!atas && atas.mesh.userData.analitik?.jenis === 'bola' && Math.abs(atas.jarak - 2) < 0.03);

console.log('\n2. Bayangan diperbarui hanya saat adegan berubah');
const sm = { autoUpdate: true, needsUpdate: false, type: THREE.PCFSoftShadowMap, enabled: true };
const s2 = new THREE.Scene();
const kotak = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); kotak.castShadow = true; s2.add(kotak);
const bantu = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()); s2.add(bantu);
const lampu = new THREE.SpotLight(0xffffff, 1); lampu.castShadow = true; lampu.position.set(0, 3, 2); s2.add(lampu, lampu.target);
const jaga = buatPenjagaBayangan({ shadowMap: sm } as unknown as THREE.WebGLRenderer, s2);
const langkah = (ubah: () => void) => { sm.needsUpdate = false; ubah(); jaga(); return sm.needsUpdate; };
cek('peta bayangan tidak lagi dirender ulang tiap frame', sm.autoUpdate === false && sm.needsUpdate === true);
langkah(() => undefined);
cek('frame tanpa perubahan -> bayangan tidak dihitung ulang', !langkah(() => undefined));
cek('benda bergeser -> bayangan dihitung ulang', langkah(() => { kotak.position.x = 0.5; }));
cek('lalu diam lagi -> tidak dihitung ulang', !langkah(() => undefined));
cek('lampu proyektor diputar / sudut berubah -> dihitung ulang', langkah(() => { lampu.target.position.set(1, 0, 0); }) && langkah(() => { lampu.angle = 0.4; }));
cek('benda disembunyikan -> dihitung ulang', langkah(() => { kotak.visible = false; }) && langkah(() => { kotak.visible = true; }));
cek('garis bantu / sinar tanpa bayangan bergerak -> tidak dihitung ulang', !langkah(() => { bantu.position.y = 2; }));
cek('benda baru berbayangan -> dihitung ulang', langkah(() => { const b = kotak.clone(); b.position.z = 2; s2.add(b); }));
const mesin = readFileSync(`${D}mesin/useMesin.ts`, 'utf8');
cek('loop render memakai penjaga bayangan; ekspor & pratinjau memaksa bayangan terbaru',
  /jagaBayangan\(\); renderer\.render\(scene, kamera\)/.test(mesin) && /shadowMap\.needsUpdate = true;\r?\n\s+m\.renderer\.render/.test(readFileSync(`${D}ekspor/useEkspor.ts`, 'utf8'))
  && /shadowMap\.needsUpdate = true;\r?\n\s+m\.renderer\.render/.test(readFileSync(`${D}simpan/useSimpanDesain.ts`, 'utf8')));

console.log('\n3. Sinar nyata memakai penembak cepat');
const sinarTs = readFileSync(`${D}mesin/sinar.ts`, 'utf8'), blend = readFileSync(`${D}mesin/blending.ts`, 'utf8');
cek('sinar & blending tidak lagi memakai Raycaster three.js', !/Raycaster/.test(sinarTs) && !/Raycaster/.test(blend) && /buatPenembak\(THREE, sasaran\)/.test(sinarTs));
cek('info blending proyektor ber-Mask hanya dihitung di layar (bukan di pesawat / dinding yang tidak disinari)', /return h && \(!p\.maskBidang \|\| diBidang\(h\.id\)\) \? \[h\.p\.x, h\.p\.y, h\.p\.z\] : null;/.test(sinarTs));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
