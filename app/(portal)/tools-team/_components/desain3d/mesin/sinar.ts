import { f, fTetap } from '../../bersama/ui';
import { arahSinar, type Benda, kotakGrid, warnaSah, type Blending, type CahayaDiPermukaan, hasilPanasonic, keGambar, kontrasProyektor, koreksiJarakDari, kunciBidangMask, lensaDari, type Lensa, lumenGambarDari, permukaanUtama, rollDari, ronaProyektor, sisiTampil, sinarProyektor, type Titik, ujiKenaBidang, ukuranTampak, uvAsli, uvTampil, warnaSinarProyektor } from '../inti';
import type * as T from 'three';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { type DataBlend, gambarBlending } from './blending';
import { gambarCahayaBenda, type SumberCahaya } from './cahayaBenda';
import { gambarGridCahaya, gambarTeksCahaya, TINGGI_HURUF, type BlokTeks, geserKeTerlihat, kotakTerlihat } from './teksCahaya';
import { bahanSinarUdara, CAHAYA_UDARA } from './sinarUdara';
import { buatPenembak, type Penembak } from './penembak';
import { aturLampuProyektor, batasProyektorNyata, kontenProyektor, type MasukanLampu } from './proyektorNyata';
import type { Mesin } from './tipe';

export type KeadaanSinar = Pick<KeadaanDesain, 'benda' | 'ruang' | 'sinar' | 'ukur' | 'labelProduk' | 'plafonDi' | 'tampilBlending' | 'detailBlending' | 'gridSinar' | 'teksSinar' | 'setInfoBlending' | 'setUkuranCahaya' | 'sinarNyata' | 'gambarLayar'>;

const BIDANG_PROYEKSI = new Set<Benda['jenis']>(['layar', 'bidang']);
const BIDANG_TEKS = new Set<Benda['jenis']>(['layar', 'bidang', 'objek', 'model']);
const ANGKAT = 0.008;

interface Kena { p: T.Vector3; id: string | null; n: T.Vector3 | null; kunci: string; cos: number }

function sePermukaan(a: Kena, b: Kena): boolean {
  if (!a.n || !b.n) return a.kunci === b.kunci;
  const d = a.n.dot(b.n);
  if (a.kunci === b.kunci) return d > 0.7;
  return d > 0.995 && Math.abs(a.n.x * (b.p.x - a.p.x) + a.n.y * (b.p.y - a.p.y) + a.n.z * (b.p.z - a.p.z)) < 0.02;
}

export function gambarSinar(m: Mesin, k: KeadaanSinar, labelP: (teks: string, pos: T.Vector3, dy?: -1 | 1) => void) {
  const { THREE, grupBantu } = m;
  const { benda, ruang, sinar, ukur, labelProduk, plafonDi, tampilBlending, detailBlending, gridSinar, teksSinar, setInfoBlending, setUkuranCahaya, sinarNyata, gambarLayar } = k;
  const daftarProj = benda.filter(p => p.jenis === 'proyektor');
  const gambarNyata = sinar && daftarProj.length > 0 && daftarProj.length <= batasProyektorNyata(m), nyata = gambarNyata && sinarNyata;
  const hitungBlend = (tampilBlending || gambarNyata) && daftarProj.length >= 2;
  if (!hitungBlend) setInfoBlending(v => (v.length ? [] : v));
  if (!gambarNyata) aturLampuProyektor(m, []);
  if (!(sinar || hitungBlend) || !daftarProj.length) return;

  m.scene.updateMatrixWorld(true);
  const menyeret = m.gizmo.dragging, kasar = menyeret || !!m.kasarPaksa;
  const NX = kasar ? 12 : 24, NY = kasar ? 7 : 14;
  const cahaya = { transparent: true, depthWrite: false, toneMapped: false };
  const bahanKerucut = new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, side: THREE.DoubleSide });
  const banyak = daftarProj.length > 4, redam = banyak ? 0.35 : 1;
  const jenisDari = new Map(benda.map(b => [b.id, b.jenis]));
  const sasaranTeks = [...m.grupRuang.children, ...m.grupBenda.children.filter(o => {
    const j = jenisDari.get(o.userData.id as string);
    return !!j && BIDANG_TEKS.has(j);
  })];

  const idMesh = new Map<string, string | null>();
  const idDari = (mesh: T.Object3D) => {
    let id = idMesh.get(mesh.uuid);
    if (id === undefined) {
      let o: T.Object3D | null = mesh;
      while (o && !o.userData.id) o = o.parent;
      id = (o?.userData.id as string | undefined) ?? null; idMesh.set(mesh.uuid, id);
    }
    return id;
  };
  const tembakRinci = (O: T.Vector3, arah: T.Vector3, tembakan: Penembak): Kena | null => {
    const hit = tembakan(O, arah);
    if (!hit) return null;
    const n = hit.normal;
    if (n && n.dot(arah) > 0) n.negate();
    const p = n ? hit.titik.clone().addScaledVector(n, ANGKAT) : hit.titik.clone().addScaledVector(arah, -0.012);
    return { p, id: idDari(hit.mesh), n, kunci: hit.mesh.uuid, cos: n ? -n.dot(arah) : 1 };
  };
  const tembak = (O: T.Vector3, arah: T.Vector3, tembakan: Penembak) => tembakRinci(O, arah, tembakan)?.p ?? null;
  let penembakTeks: Penembak | null = null;
  const tembakTeks = () => (penembakTeks ??= buatPenembak(THREE, sasaranTeks));
  const diBenda = (id: string | null) => !!id && !BIDANG_PROYEKSI.has(jenisDari.get(id) ?? 'objek');
  const diBidang = (id: string | null) => !!id && BIDANG_PROYEKSI.has(jenisDari.get(id) ?? 'objek');
  const namaBenda = new Map(benda.map(b => [b.id, b.nama]));
  const namaPermukaan = (kenaId: (string | null)[]) => {
    const id = permukaanUtama(kenaId, x => BIDANG_TEKS.has(jenisDari.get(x) ?? 'kursi'));
    return id ? namaBenda.get(id) ?? null : null;
  };

  let maskBidang: MasukanLampu['mask'] = null;
  const maskDari = () => (maskBidang ??= { uji: benda.filter(b => BIDANG_PROYEKSI.has(b.jenis)).map(ujiKenaBidang), kunci: kunciBidangMask(benda) });
  const dataBlend: DataBlend[] = [];
  const sumberCahaya: SumberCahaya[] = [];
  const bidangGambar: { p: Benda; isi: boolean; L: Lensa; pos: number[]; uv: number[]; warnaTitik: number[]; opasitas: number; warna: T.Color; tepi: T.Color; lebar: number; tinggi: number; permukaan: string | null; teks: { info: string[]; lux: (number | null)[]; pos: number[]; uv: number[] } | null; normal: T.Vector3 | null; pusat: T.Vector3 | null }[] = [];
  const bendaTersinari = new Set<string>();
  daftarProj.forEach((p, idx) => {
    const sn = sinarProyektor(p, benda, ruang);
    const kj = koreksiJarakDari(p);
    const Lp = lensaDari(p), O = new THREE.Vector3(...Lp.O), ujung = new THREE.Vector3(...sn.asal);
    const sendiri = m.cache.get(p.id)?.obj;
    const sasaran = [...m.grupRuang.children, ...m.grupBenda.children.filter(o => o !== sendiri && !o.userData.sorot)];
    const tembakIni = buatPenembak(THREE, sasaran);
    const D = new THREE.Vector3(...Lp.D), kanan = new THREE.Vector3(...Lp.kanan), atas = new THREE.Vector3(...Lp.atas), { w1, h1, gH, gV } = Lp;
    const arah = new THREE.Vector3();
    const arahUV = (u: number, v: number) => arah.copy(D).addScaledVector(kanan, (u + gH) * w1).addScaledVector(atas, (v + gV) * h1).normalize();
    const ingat = new Map<number, Kena | null>();
    const tembakUV = (u: number, v: number) => {
      const k = Math.round(u * 1e7) * 1e8 + Math.round(v * 1e7);
      let h = ingat.get(k);
      if (h === undefined) { h = tembakRinci(O, arahUV(u - 0.5, v - 0.5), tembakIni); ingat.set(k, h); }
      return h;
    };
    const kena: (T.Vector3 | null)[] = [], kenaId: (string | null)[] = [], rinci: (Kena | null)[] = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const t = tembakUV(i / (NX - 1), j / (NY - 1));
      kena.push(t?.p ?? null); kenaId.push(t?.id ?? null); rinci.push(t);
      if (t && diBenda(t.id)) bendaTersinari.add(t.id!);
    }
    const sel = (i: number, j: number) => kena[j * NX + i];
    const zona: number[] = [], zonaN: number[] = [], zonaMesh: string[] = [];
    const keZona = (t: Kena[], mesh: string) => {
      for (const x of t) { const n = x.n ?? O.clone().sub(x.p).normalize(); zona.push(x.p.x, x.p.y, x.p.z); zonaN.push(n.x, n.y, n.z); }
      zonaMesh.push(mesh);
    };
    if (hitungBlend) {
      const L = lensaDari(p), NB = kasar ? 31 : 81, NV = kasar ? 21 : 49;
      const sampel = (u: number, v: number): Titik | null => {
        const h = tembakRinci(O, arah.set(...arahSinar(L, u, v)), tembakIni);
        return h && (!p.maskBidang || diBidang(h.id)) ? [h.p.x, h.p.y, h.p.z] : null;
      };
      dataBlend.push({
        p, L, O, tembak: tembakIni, zona, zonaN, zonaMesh,
        baris: Array.from({ length: NB }, (_, i) => sampel(i / (NB - 1) - 0.5, 0)),
        kolom: Array.from({ length: NV }, (_, j) => sampel(0, j / (NV - 1) - 0.5)),
      });
    }
    if (!sinar && !hitungBlend) return;
    const warna = new THREE.Color(warnaSinarProyektor(p, idx, daftarProj.length));
    const adaIsi = gambarNyata && p.konten !== 'mati';
    if (sinar && !nyata && !adaIsi) sumberCahaya.push({ O, L: lensaDari(p), sasaran, kuat: (sn.layar ? 0.8 : 1) * (banyak ? 0.6 : 1), warna: [warna.r, warna.g, warna.b] });

    const mask = !!p.maskBidang;
    const bolehId = (id: string | null) => !diBenda(id) && (!mask || diBidang(id));
    const bolehZona = (id: string | null) => !mask || diBidang(id);
    const terang = (P: T.Vector3, n: T.Vector3 | null) => {
      const r = P.clone().sub(O), d2 = Math.max(0.01, r.lengthSq()); r.normalize();
      const cosA = Math.max(0.2, r.dot(D)), cosT = n ? Math.abs(r.dot(n)) : 1;
      return Math.max(0.05, cosT) / (cosA ** 3 * d2);
    };
    const pusatGambar = tembakRinci(O, arahUV(0, 0).clone(), tembakIni);
    const terangAcuan = pusatGambar ? terang(pusatGambar.p, pusatGambar.n) : 1 / Math.max(0.25, sn.jarak ** 2);
    const faktor = (P: T.Vector3, n: T.Vector3 | null) => Math.min(1.4, Math.max(0.06, terang(P, n) / terangAcuan));
    const pos: number[] = [], uv: number[] = [], warnaTitik: number[] = [];
    const quadKe = (P: number[], U: number[], W?: number[]) => (A: T.Vector3, B: T.Vector3, C: T.Vector3, Dd: T.Vector3, batas: number, u0: number, v0: number, u1: number, v1: number, k?: number[]) => {
      if (A.distanceTo(B) > batas || B.distanceTo(C) > batas || C.distanceTo(Dd) > batas || Dd.distanceTo(A) > batas) return;
      P.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, A.x, A.y, A.z, C.x, C.y, C.z, Dd.x, Dd.y, Dd.z);
      U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      if (W) for (const s of [0, 1, 2, 0, 2, 3]) { const f = k?.[s] ?? 1; W.push(warna.r * f, warna.g * f, warna.b * f); }
    };
    const quad = quadKe(pos, uv, warnaTitik);
    const batasSel = (jarak: number, cos: number, bagi = 1) => ((jarak * w1) / (NX - 1) / bagi) * Math.max(6, 2.5 / Math.max(0.05, cos)) + 0.05;
    const isi = (q: Kena[], batas: number, u0: number, v0: number, u1: number, v1: number) => {
      if (q.some((x, s) => x.p.distanceTo(q[(s + 1) % 4].p) > batas)) return;
      const [A, B, C, Dd] = q.map(x => x.p), id = q[0].id;
      if (hitungBlend && bolehZona(id)) { keZona([q[0], q[1], q[2]], q[0].kunci); keZona([q[0], q[2], q[3]], q[0].kunci); }
      if (sinar && bolehId(id)) quad(A, B, C, Dd, Infinity, u0, v0, u1, v1, q.map(x => faktor(x.p, x.n)));
    };
    const satuSel = (q: (Kena | null)[]): q is Kena[] => q.every(x => !!x && x.id === q[0]!.id && sePermukaan(q[0]!, x));
    const melengkung = (q: Kena[]) => {
      let c = 0, d = 1;
      for (let s = 0; s < 4; s++) {
        c = Math.max(c, q[s].p.distanceTo(q[(s + 1) % 4].p));
        if (q[s].n && q[0].n) d = Math.min(d, q[s].n!.dot(q[0].n!));
      }
      return (c * Math.acos(Math.min(1, d))) / 8 > ANGKAT * 0.5;
    };
    const LANGKAH_BAGI = 4, langkahBagi = kasar ? 2 : LANGKAH_BAGI, BAGI_MAKS = kasar ? 2 : 10, TEPAT = 0.002;
    type Titik2 = { k: Kena; u: number; v: number; x?: 1 | 2 };
    const bagiDua = (a: number[], b: number[], kenaA: Kena, anggota: (x: Kena | null) => x is Kena): Titik2 => {
      let lo = 0, hi = 1, kenaLo = kenaA;
      const sudut = Math.hypot(b[0] - a[0], b[1] - a[1]) * w1;
      for (let n = 0; n < BAGI_MAKS; n++) {
        if (n >= langkahBagi && ((hi - lo) * sudut * kenaLo.p.distanceTo(O)) / Math.max(0.1, kenaLo.cos) < TEPAT) break;
        const t = (lo + hi) / 2, h = tembakUV(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        if (anggota(h)) { lo = t; kenaLo = h; } else hi = t;
      }
      return { k: kenaLo, u: a[0] + (b[0] - a[0]) * lo, v: a[1] + (b[1] - a[1]) * lo };
    };
    const tepiHalus = (s4: (Kena | null)[], uvS: number[][], jarak: number, S: number) => {
      const sudah: Kena[] = [];
      for (const rep of s4) {
        if (!rep || sudah.some(x => x.id === rep.id && sePermukaan(x, rep))) continue;
        sudah.push(rep);
        const lampu = sinar && bolehId(rep.id), zon = hitungBlend && bolehZona(rep.id);
        if (!lampu && !zon) continue;
        const anggota = (x: Kena | null): x is Kena => !!x && x.id === rep.id && sePermukaan(rep, x);
        const dalam = s4.map(anggota);
        if (dalam[0] === dalam[2] && dalam[1] === dalam[3] && dalam[0] !== dalam[1]) continue;
        const poli: Titik2[] = [];
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4;
          if (dalam[k]) poli.push({ k: s4[k]!, u: uvS[k][0], v: uvS[k][1] });
          if (dalam[k] === dalam[k2]) continue;
          const [ia, ib] = dalam[k] ? [k, k2] : [k2, k];
          poli.push({ ...bagiDua(uvS[ia], uvS[ib], s4[ia]!, anggota), x: dalam[k] ? 1 : 2 });
        }
        const ie = poli.findIndex((p, s) => p.x === 1 && poli[(s + 1) % poli.length].x === 2);
        if (!kasar && ie >= 0) {
          const di = uvS.filter((_, k) => dalam[k]), A = [0, 1].map(s => di.reduce((t, x) => t + x[s], 0) / di.length);
          const ke = (s: number, d: number) => (Math.abs(d) < 1e-12 ? Infinity : ((d > 0 ? Math.max(uvS[0][s], uvS[2][s]) : Math.min(uvS[0][s], uvS[2][s])) - A[s]) / d);
          const E1 = poli[ie], E2 = poli[(ie + 1) % poli.length], baru: Titik2[] = [];
          for (const f of [0.25, 0.5, 0.75]) {
            const M = [E1.u + (E2.u - E1.u) * f, E1.v + (E2.v - E1.v) * f], d = [M[0] - A[0], M[1] - A[1]], t = Math.min(ke(0, d[0]), ke(1, d[1]));
            const B = [A[0] + d[0] * t, A[1] + d[1] * t], T = [M[0] + (B[0] - M[0]) * 0.1, M[1] + (B[1] - M[1]) * 0.1], hT = t > 1 && t < 1e6 ? tembakUV(T[0], T[1]) : null;
            if (anggota(hT)) baru.push(bagiDua(T, B, hT, anggota));
          }
          poli.splice(ie + 1, 0, ...baru);
        }
        if (poli.length < 3) continue;
        const batas = batasSel(jarak, Math.min(...poli.map(x => x.k.cos)), S);
        if (poli.some((x, s) => x.k.p.distanceTo(poli[(s + 1) % poli.length].k.p) > batas)) continue;
        const f = lampu ? poli.map(x => faktor(x.k.p, x.k.n)) : [];
        for (let s = 1; s + 1 < poli.length; s++) {
          if (zon) keZona([poli[0].k, poli[s].k, poli[s + 1].k], rep.kunci);
          if (lampu) for (const n of [0, s, s + 1]) {
            const P = poli[n].k.p;
            pos.push(P.x, P.y, P.z); uv.push(poli[n].u, poli[n].v); warnaTitik.push(warna.r * f[n], warna.g * f[n], warna.b * f[n]);
          }
        }
      }
    };
    const gu = (i: number) => i / (NX - 1), gv = (j: number) => j / (NY - 1), S_LENGKUNG = 8, S_TEPI = 4, KX = NX - 1;
    const selQ = (i: number, j: number) => [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => rinci[b * NX + a]);
    const campur = Array.from({ length: (NY - 1) * KX }, (_, s) => !satuSel(selQ(s % KX, Math.floor(s / KX))));
    const dekatTepi = (i: number, j: number) => [-1, 0, 1].some(b => [-1, 0, 1].some(a => i + a >= 0 && i + a < KX && j + b >= 0 && j + b < NY - 1 && campur[(j + b) * KX + i + a]));
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const q = selQ(i, j), ada = q.filter((x): x is Kena => !!x);
      if (!ada.length) continue;
      const jarak = ada.reduce((s, x) => s + x.p.distanceTo(O), 0) / ada.length;
      const satu = satuSel(q), lengkung = satu && !kasar && melengkung(q);
      if (satu && !lengkung && (kasar || !dekatTepi(i, j))) { isi(q, batasSel(jarak, Math.min(...q.map(x => x.cos))), gu(i), gv(j), gu(i + 1), gv(j + 1)); continue; }
      if (kasar) { tepiHalus(q, [[gu(i), gv(j)], [gu(i + 1), gv(j)], [gu(i + 1), gv(j + 1)], [gu(i), gv(j + 1)]], jarak, 1); continue; }
      const S = lengkung ? S_LENGKUNG : S_TEPI, sub: (Kena | null)[] = [];
      for (let b = 0; b <= S; b++) for (let a = 0; a <= S; a++) sub.push(tembakUV(gu(i + a / S), gv(j + b / S)));
      const t = (a: number, b: number) => sub[b * (S + 1) + a];
      for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
        const s4 = [t(a, b), t(a + 1, b), t(a + 1, b + 1), t(a, b + 1)];
        const u0 = gu(i + a / S), v0 = gv(j + b / S), u1 = gu(i + (a + 1) / S), v1 = gv(j + (b + 1) / S);
        if (satuSel(s4)) isi(s4, batasSel(jarak, Math.min(...s4.map(x => x.cos)), S), u0, v0, u1, v1);
        else tepiHalus(s4, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], jarak, S);
      }
    }
    if (!sinar) return;
    const ujiMask = mask ? maskDari().uji.map(f => f([O.x, O.y, O.z])) : [];
    const dalamMask = (u: number, v: number) => { const d = arahUV(u - 0.5, v - 0.5); return ujiMask.some(f => f(d.x, d.y, d.z)); };
    const LANGKAH_TEPI = 32, BAGI_TEPI = 12;
    const titikTepi = (u: number, v: number): Kena | null => {
      if (!mask || dalamMask(u, v)) return tembakUV(u, v);
      const di = (s: number): [number, number] => [u + (0.5 - u) * s, v + (0.5 - v) * s];
      let luar = 0, dalam = -1;
      for (let n = 1; n <= LANGKAH_TEPI && dalam < 0; n++) { const s = n / LANGKAH_TEPI; if (dalamMask(...di(s))) dalam = s; else luar = s; }
      if (dalam < 0) return null;
      for (let n = 0; n < BAGI_TEPI; n++) { const s = (luar + dalam) / 2; if (dalamMask(...di(s))) dalam = s; else luar = s; }
      return tembakUV(...di(dalam));
    };
    const K_TEPI = mask ? (kasar ? 3 : 2) : 1, nU = (NX - 1) * K_TEPI, nV = (NY - 1) * K_TEPI;
    const tepi: (Kena | null)[] = [];
    for (let i = 0; i < nU; i++) tepi.push(titikTepi(i / nU, 0));
    for (let j = 0; j < nV; j++) tepi.push(titikTepi(1, j / nV));
    for (let i = nU; i > 0; i--) tepi.push(titikTepi(i / nU, 1));
    for (let j = nV; j > 0; j--) tepi.push(titikTepi(0, j / nV));
    const warnaTepi = p.warnaSinar ? warna.clone().offsetHSL(0, 0.1, -0.18) : new THREE.Color().setHSL(ronaProyektor(idx), 0.9, 0.55);
    const lebarGaris = Math.min(0.03, Math.max(0.01, sn.jarak * w1 * 0.003));
    const keLensa = (P: T.Vector3) => O.clone().sub(P).normalize();
    const pita: number[] = [], kerucut: number[] = [], alfa: number[] = [];
    for (let i = 0; i < tepi.length; i++) {
      const A = tepi[i], B = tepi[(i + 1) % tepi.length];
      if (!A || !B) continue;
      if (!nyata && A.p.distanceTo(B.p) < Math.max(0.6, A.p.distanceTo(O) * w1 * 0.4)) {
        const n = new THREE.Vector3().addVectors(A.n ?? keLensa(A.p), B.n ?? keLensa(B.p)).normalize();
        const s = new THREE.Vector3().crossVectors(n, B.p.clone().sub(A.p)).normalize().multiplyScalar(lebarGaris / 2);
        const a0 = A.p.clone().sub(s), a1 = A.p.clone().add(s), b0 = B.p.clone().sub(s), b1 = B.p.clone().add(s);
        for (const v of [a0, b0, b1, a0, b1, a1]) pita.push(v.x, v.y, v.z);
      }
      kerucut.push(ujung.x, ujung.y, ujung.z, A.p.x, A.p.y, A.p.z, B.p.x, B.p.y, B.p.z);
      if (nyata) {
        const [cr, cg, cb] = CAHAYA_UDARA.warna, ujungA = CAHAYA_UDARA.layar * redam;
        alfa.push(cr, cg, cb, CAHAYA_UDARA.lensa * redam, cr, cg, cb, ujungA, cr, cg, cb, ujungA);
      } else alfa.push(warnaTepi.r, warnaTepi.g, warnaTepi.b, 0.45 * redam, warna.r, warna.g, warna.b, 0.08 * redam, warna.r, warna.g, warna.b, 0.08 * redam);
    }
    if (pita.length) {
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pita, 3));
      const garisTepi = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ ...cahaya, color: warnaTepi, opacity: 0.95, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      garisTepi.renderOrder = 3; grupBantu.add(garisTepi);
    }
    if (kerucut.length) {
      const g3 = new THREE.BufferGeometry();
      g3.setAttribute('position', new THREE.Float32BufferAttribute(kerucut, 3)); g3.setAttribute(nyata ? 'warnaSinar' : 'color', new THREE.Float32BufferAttribute(alfa, 4));
      if (nyata) g3.computeVertexNormals();
      const kerucutSinar = new THREE.Mesh(g3, nyata ? bahanSinarUdara(THREE) : bahanKerucut);
      kerucutSinar.renderOrder = 2; grupBantu.add(kerucutSinar);
    }
    const kilau = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfffbeb, blending: THREE.AdditiveBlending, opacity: 0.95 }));
    kilau.position.copy(ujung); grupBantu.add(kilau);
    const tulis = teksSinar && !menyeret;
    const teksPos: number[] = [], teksUv: number[] = [];
    let tengah = sel(Math.floor(NX / 2), Math.floor(NY / 2));
    if (tulis) {
      const kt: (T.Vector3 | null)[] = [];
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) kt.push(tembak(O, arahUV(gu(i) - 0.5, gv(j) - 0.5), tembakTeks()));
      const quadTeks = quadKe(teksPos, teksUv);
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const [A, B, C, Dd] = [kt[j * NX + i], kt[j * NX + i + 1], kt[(j + 1) * NX + i + 1], kt[(j + 1) * NX + i]];
        if (!A || !B || !C || !Dd) continue;
        quadTeks(A, B, C, Dd, (((A.distanceTo(O) + C.distanceTo(O)) / 2) * w1 / (NX - 1)) * 6 + 0.05, gu(i), gv(j), gu(i + 1), gv(j + 1));
      }
      tengah = kt[Math.floor(NY / 2) * NX + Math.floor(NX / 2)] ?? tengah;
      if (Lp.putar) for (let i = 0; i < teksUv.length; i += 2) [teksUv[i], teksUv[i + 1]] = uvTampil(Lp.putar, teksUv[i], teksUv[i + 1]);
    }
    const jarakSumbu = sn.layar ? sn.jarak + kj : tengah ? Math.max(0, tengah.clone().sub(O).dot(D)) : sn.jarak + kj;
    const hp = hasilPanasonic(p, benda, ruang);
    const Ltulis = hp.L ?? Math.max(0, jarakSumbu - kj);
    const ukurTulis = hp.L !== null ? hp
      : { lebar: jarakSumbu * w1, tinggi: jarakSumbu * h1, diagonalInci: Math.hypot(jarakSumbu * w1, jarakSumbu * h1) / 0.0254, lux: null };
    const E0 = lumenGambarDari(p) / (w1 * h1), ut = ukuranTampak(p, ukurTulis.lebar, ukurTulis.tinggi), roll = rollDari(p);
    const luxDi = (u: number, v: number) => {
      const r = arahUV(u, v).clone(), t = tembakRinci(O, r, tembakTeks());
      if (!t) return null;
      const d = t.p.distanceTo(O), cosA = Math.max(0.2, r.dot(D)), cosT = t.n ? Math.abs(r.dot(t.n)) : 1;
      return (E0 * cosT) / (cosA ** 3 * d * d);
    };
    bidangGambar.push({ p, isi: adaIsi, L: lensaDari(p), normal: pusatGambar?.n ?? null, pos, uv, warnaTitik, warna, tepi: warnaTepi, lebar: jarakSumbu * w1, tinggi: jarakSumbu * h1, permukaan: sn.layar ? null : namaPermukaan(kenaId), opasitas: (sn.layar ? 0.26 : 0.34) * (banyak ? 0.6 : 1),
      pusat: pusatGambar?.p.clone() ?? null, teks: tulis ? {
        info: [p.nama, `L (lensa → ${hp.sasaran?.nama ?? 'bidang'}) ${fTetap(Ltulis)} m`,
          `Gambar ${fTetap(ut.lebar)} × ${fTetap(ut.tinggi)} m (${fTetap(ukurTulis.diagonalInci, 2)}")${roll ? ` · putar ${f(roll, 0)}°` : ''}`,
          `Pusat ${f(ukurTulis.lux ?? luxDi(0, 0) ?? E0 / (jarakSumbu * jarakSumbu), 0)} lx · ${f(lumenGambarDari(p), 0)} lm`],
        lux: ([[-0.48, 0.47], [0.48, 0.47], [-0.48, -0.47], [0.48, -0.47]] as const).map(([x, y]) => luxDi(...uvAsli(Lp.putar, x, y))),
        pos: teksPos, uv: teksUv,
      } : null });
    if (ukur) {
      if (!labelProduk || p.sembunyiLabel) {
        const diPlafon = p.elev + p.h > plafonDi(p.x) - 0.35;
        labelP(p.nama, new THREE.Vector3(p.x, diPlafon ? Math.max(0.3, p.elev - 0.02) : p.elev + p.h + 0.02, p.z), diPlafon ? 1 : -1);
      }
    }
  });
  if (sinar && !nyata && sumberCahaya.length && bendaTersinari.size) {
    const akar = [...bendaTersinari].map(id => m.cache.get(id)?.obj).filter((o): o is T.Object3D => !!o);
    gambarCahayaBenda(m, sumberCahaya, akar, kasar);
  }
  const blending: Blending[] = hitungBlend ? gambarBlending(m, dataBlend, setInfoBlending, detailBlending, tampilBlending) : [];
  const grid = gridSinar && !menyeret;
  if (!kasar) {
    const ukuran: Record<string, CahayaDiPermukaan> = {};
    for (const bg of bidangGambar) ukuran[bg.p.id] = { lebar: Math.round(bg.lebar * 1000) / 1000, tinggi: Math.round(bg.tinggi * 1000) / 1000, permukaan: bg.permukaan };
    setUkuranCahaya(v => (JSON.stringify(v) === JSON.stringify(ukuran) ? v : ukuran));
  }
  const lampu: MasukanLampu[] = [];
  for (const bg of bidangGambar) {
    let kiri = 0, kanan = 0, atas = 0, bawah = 0;
    for (const b of blending) {
      if (b.a !== bg.p.id && b.b !== bg.p.id) continue;
      const g = keGambar(bg.L, b.tengah), porsi = Math.min(0.6, (b.a === bg.p.id ? b.persenA : b.persenB) / 100);
      if (!g) continue;
      if (b.arah === 'kiri-kanan') { if (g.u < 0) kiri = Math.max(kiri, porsi); else kanan = Math.max(kanan, porsi); }
      else if (g.v > 0) atas = Math.max(atas, porsi); else bawah = Math.max(bawah, porsi);
    }
    if (gambarNyata) {
      const kt = kontenProyektor(THREE, bg.p, gridSinar, bg.lebar, bg.tinggi, gambarLayar.current);
      const kp = kontrasProyektor(bg.p, benda, ruang, 15);
      lampu.push({ p: bg.p, L: bg.L, normal: bg.normal, pusat: bg.pusat, lebar: bg.lebar, tinggi: bg.tinggi, luxAmbien: kp.cahaya.total, luxGambar: kp.luxGambar, silau: kp.silau.rasio,
        konten: kt.sumber, kunciKonten: kt.kunci, mati: kt.mati, blend: { kiri, kanan, atas, bawah }, mask: bg.p.maskBidang ? maskDari() : null });
    }
    if (!bg.pos.length) continue;
    if (!nyata) {
      if (!bg.isi) {
        const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bg.pos, 3)).setAttribute('uv', new THREE.Float32BufferAttribute(bg.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(bg.warnaTitik, 3));
        const gambar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, opacity: bg.opasitas * (grid ? 0.45 : 1), side: THREE.FrontSide, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
        gambar.renderOrder = 2; grupBantu.add(gambar);
      }
      if (grid) {
        const kg = kotakGrid(bg.lebar, bg.tinggi, bg.p.gridKolom);
        const wg = warnaSah(bg.p.warnaGrid);
        gambarGridCahaya(m, bg.pos, bg.uv, wg ? new THREE.Color(wg) : bg.tepi, kg.kolom, kg.baris);
      }
    }
    if (bg.teks) {
      const hl = TINGGI_HURUF * 1.28, ws = 0.09, hs = hl + 0.012, tepi = 0.01;
      const pojok = (i: number, x: number, y: number, kanan: boolean, tampil: boolean): BlokTeks | null =>
        tampil && bg.teks!.lux[i] !== null ? { x, y, w: ws, h: hs, baris: [`${f(bg.teks!.lux[i]!, 0)} lx`], kanan } : null;
      const sd = sisiTampil(bg.L.putar, { kiri, kanan, atas, bawah }), kiriAtas = !sd.kiri && !sd.atas;
      const blok = [
        pojok(0, tepi, tepi, false, kiriAtas),
        pojok(1, 1 - tepi - ws, tepi, true, !sd.kanan && !sd.atas),
        pojok(2, tepi, 1 - tepi - hs, false, !sd.kiri && !sd.bawah),
        pojok(3, 1 - tepi - ws, 1 - tepi - hs, true, !sd.kanan && !sd.bawah),
        { x: Math.min(0.5, tepi + sd.kiri), y: Math.min(0.5, (kiriAtas ? tepi + hs : tepi) + sd.atas), w: 0.24, h: hl * bg.teks.info.length + 0.012, baris: bg.teks.info, tebalPertama: true },
      ];
      const kotak = kotakTerlihat(bg.teks.uv);
      const ARAH: [1 | -1, 1 | -1][] = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 1]];
      const terlihat = blok.map((b, i) => (b ? geserKeTerlihat(b, kotak, ARAH[i][0], ARAH[i][1]) : null)).filter((b): b is BlokTeks => !!b);
      gambarTeksCahaya(m, bg.teks.pos, bg.teks.uv, terlihat);
    }
  }
  if (gambarNyata) bahanKerucut.opacity = Math.sqrt(aturLampuProyektor(m, lampu, kasar, menyeret));
}
