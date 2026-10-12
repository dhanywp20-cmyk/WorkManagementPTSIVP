/** av-hitung-koneksi.ts - dipecah dari av-hitung.ts (scripts/pecah-modul.mjs); av-hitung.ts tetap mengekspor ulang semuanya. */

// ── Screen connection LED (urutan kabel data, seperti NovaLCT) ─────────────

export type SudutMulai = 'kiri-atas' | 'kanan-atas' | 'kiri-bawah' | 'kanan-bawah';

/** Satu receiving card di grid: [kolom, baris], 0 = kiri / atas. */
export type SelRC = [number, number];

export interface OpsiKoneksi {
  /** Grid receiving card (satu sel = satu receiving card). */ kolom: number; baris: number;
  /** Pixel satu receiving card bila semua sama. */ pxPerRC?: number;
  /** Lebar tiap kolom & tinggi tiap baris receiving card (px) - menimpa pxPerRC (ukuran berbeda-beda). */
  lebarPx?: number[]; tinggiPx?: number[];
  /** Sel tanpa receiving card (layar tidak persegi / ada lubang). */ kosong?: SelRC[];
  /** Kabel manual: urutan receiving card per port (indeks 0 = port 1). Diisi = template diabaikan. */ manual?: SelRC[][] | null;
  pxPerPort: number;
  /** Receiving card pertama di pojok mana, kabel berjalan mendatar (per baris) atau tegak (per kolom). */
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal';
  /** S = ular (bolak-balik), Z = tiap baris/kolom mulai dari sisi yang sama. */ pola: 'S' | 'Z';
  /** baris = tiap port mengambil baris/kolom utuh (kabel rapi; garis yang melebihi kapasitas port dibagi ke
   *  beberapa zona sama lebar); penuh = port diisi sampai batas (port paling hemat). */ bagi: 'baris' | 'penuh';
  /** Persentase kapasitas port yang boleh dipakai (bawaan 100). */ bebanMaks?: number;
  /** Port per controller / sending card - untuk penomoran "controller-port-RC". 0 = satu controller. */ portPerKartu?: number;
}

export interface SelKoneksi { c: number; r: number; port: number; urut: number; kartu: number; px: number }

export interface PortKoneksi { port: number; kartu: number; jumlah: number; px: number; beban: number; mulai: { c: number; r: number } | null }

export interface HasilKoneksi {
  /** Semua receiving card dalam urutan kabel (rantai port 1, lalu port 2, ...). */ sel: SelKoneksi[];
  port: PortKoneksi[];
  /** Receiving card terbesar yang muat per port (patokan). */ rcPerPortMaks: number; jumlahPort: number; jumlahKartu: number;
  /** Peringatan bila satu receiving card melebihi kapasitas satu port. */ galat: string | null;
  /** Receiving card yang belum tersambung ke port mana pun (mode manual). */ tanpaPort: { c: number; r: number }[];
  /** Port yang bebannya melewati batas. */ lewat: number[];
}

/**
 * Urutan kabel data receiving card & pembagian ke port LAN. Kolom c 0.. dari kiri,
 * baris r 0.. dari atas. Satu receiving card tidak bisa dibagi ke dua port; port dibatasi
 * jumlah PIXEL (receiving card boleh berbeda ukuran), bukan jumlah kartu.
 */
export function hitungKoneksi(o: OpsiKoneksi): HasilKoneksi {
  const K = Math.max(1, Math.round(o.kolom)), B = Math.max(1, Math.round(o.baris));
  const di = (c: number, r: number) => r * K + c;
  const dalam = ([c, r]: SelRC) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && c < K && r >= 0 && r < B;
  const kosong = new Set((o.kosong ?? []).filter(dalam).map(([c, r]) => di(c, r)));
  const ukuranBebas = !!o.lebarPx?.length && !!o.tinggiPx?.length;
  const pxSel = (c: number, r: number) => (kosong.has(di(c, r)) ? 0
    : ukuranBebas ? Math.max(0, o.lebarPx![c] ?? 0) * Math.max(0, o.tinggiPx![r] ?? 0) : Math.max(0, o.pxPerRC ?? 0));
  const batasPersen = Math.max(1, Math.min(100, o.bebanMaks ?? 100)) / 100;
  const batas = o.pxPerPort * batasPersen;
  let pxMaks = 0;
  for (let r = 0; r < B; r++) for (let c = 0; c < K; c++) pxMaks = Math.max(pxMaks, pxSel(c, r));
  const galat = pxMaks > batas
    ? `Satu receiving card (${Math.round(pxMaks).toLocaleString('id-ID')} px) melebihi ${Math.round(batasPersen * 100)}% kapasitas satu port (${Math.round(o.pxPerPort).toLocaleString('id-ID')} px) - perkecil area per receiving card atau turunkan refresh/bit.`
    : null;

  const potongan: { c: number; r: number }[][] = [];
  if (o.manual) {
    //  Manual: urutan dari pengguna; sel di luar grid, kosong, atau dobel diabaikan.
    const dipakai = new Set<number>();
    for (const rantai of o.manual) {
      const isi: { c: number; r: number }[] = [];
      for (const s of Array.isArray(rantai) ? rantai : []) {
        if (!Array.isArray(s) || !dalam(s)) continue;
        const i = di(s[0], s[1]);
        if (kosong.has(i) || dipakai.has(i)) continue;
        dipakai.add(i); isi.push({ c: s[0], r: s[1] });
      }
      potongan.push(isi);
    }
  } else {
    const kiri = o.mulai.startsWith('kiri'), atas = o.mulai.endsWith('atas');
    //  Garis = baris (horizontal) atau kolom (vertikal), urut dari pojok mulai. Posisi di sepanjang garis
    //  dihitung dari sisi mulai lalu dipetakan ke kolom/baris sebenarnya.
    const nGaris = o.arah === 'horizontal' ? B : K, panjang = o.arah === 'horizontal' ? K : B;
    const awalDiSisiMulai = o.arah === 'horizontal' ? kiri : atas;
    const selDi = (g: number, pos: number) => {
      const idxGaris = o.arah === 'horizontal' ? (atas ? g : B - 1 - g) : (kiri ? g : K - 1 - g);
      const ke = awalDiSisiMulai ? pos : panjang - 1 - pos;
      return o.arah === 'horizontal' ? { c: ke, r: idxGaris } : { c: idxGaris, r: ke };
    };
    const pxPos = (g: number, pos: number) => { const s = selDi(g, pos); return pxSel(s.c, s.r); };
    const ruas = (g: number, p0: number, p1: number, maju: boolean) => {
      const isi: { c: number; r: number }[] = [];
      for (let i = 0; i < p1 - p0; i++) {
        const s = selDi(g, maju ? p0 + i : p1 - 1 - i);
        if (!kosong.has(di(s.c, s.r))) isi.push(s);
      }
      return isi;
    };
    if (o.bagi === 'baris') {
      //  Zona: baris utuh yang lebih besar dari kapasitas port -> layar dibagi beberapa zona sama lebar,
      //  tiap zona dikabel sendiri dari sisi mulai (seperti layar lebar di lapangan).
      const batasZona = (z: number, n: number) => [Math.round((z * panjang) / n), Math.round(((z + 1) * panjang) / n)];
      const pxRuas = (g: number, p0: number, p1: number) => { let t = 0; for (let p = p0; p < p1; p++) t += pxPos(g, p); return t; };
      const muat = (n: number) => {
        for (let z = 0; z < n; z++) {
          const [p0, p1] = batasZona(z, n);
          for (let g = 0; g < nGaris; g++) if (pxRuas(g, p0, p1) > batas) return false;
        }
        return true;
      };
      let nZona = 1;
      while (nZona < panjang && !muat(nZona)) nZona++;
      for (let z = 0; z < nZona; z++) {
        const [p0, p1] = batasZona(z, nZona);
        //  Garis dikelompokkan per port selama muat; tiap port mulai lagi dari sisi mulai (kabel dari
        //  arah controller), pola S membalik arah di dalam port.
        let grup: number[] = [], jumlah = 0;
        const tutup = () => {
          if (grup.length) potongan.push(grup.flatMap((g, j) => ruas(g, p0, p1, o.pola === 'Z' || j % 2 === 0)));
          grup = []; jumlah = 0;
        };
        for (let g = 0; g < nGaris; g++) {
          const pxG = pxRuas(g, p0, p1);
          if (pxG <= 0) continue;
          if (grup.length && jumlah + pxG > batas) tutup();
          grup.push(g); jumlah += pxG;
        }
        tutup();
      }
    } else {
      //  Isi penuh: satu ular di seluruh layar, dipotong tiap kali port penuh.
      let isi: { c: number; r: number }[] = [], jumlah = 0;
      for (let g = 0; g < nGaris; g++) {
        for (const s of ruas(g, 0, panjang, o.pola === 'Z' || g % 2 === 0)) {
          const px = pxSel(s.c, s.r);
          if (isi.length && jumlah + px > batas) { potongan.push(isi); isi = []; jumlah = 0; }
          isi.push(s); jumlah += px;
        }
      }
      if (isi.length) potongan.push(isi);
    }
  }

  const ppk = Math.max(0, Math.round(o.portPerKartu ?? 0));
  const kartuDari = (port: number) => (ppk > 0 ? Math.ceil(port / ppk) : 1);
  const sel: SelKoneksi[] = [];
  const terhubung = new Set<number>();
  const port: PortKoneksi[] = potongan.map((isi, i) => {
    const p = i + 1;
    let px = 0;
    isi.forEach((x, j) => {
      const pxIni = pxSel(x.c, x.r);
      px += pxIni; terhubung.add(di(x.c, x.r));
      sel.push({ ...x, port: p, urut: j + 1, kartu: kartuDari(p), px: pxIni });
    });
    return { port: p, kartu: kartuDari(p), jumlah: isi.length, px, beban: (px / Math.max(1, o.pxPerPort)) * 100, mulai: isi[0] ?? null };
  });
  const tanpaPort: { c: number; r: number }[] = [];
  for (let r = 0; r < B; r++) for (let c = 0; c < K; c++) if (!kosong.has(di(c, r)) && !terhubung.has(di(c, r))) tanpaPort.push({ c, r });
  return {
    sel, port, rcPerPortMaks: Math.max(1, pxMaks > 0 ? Math.floor(batas / pxMaks) : 1), jumlahPort: port.length,
    jumlahKartu: port.length ? kartuDari(port.length) : 0, galat, tanpaPort, lewat: port.filter(p => p.px > batas).map(p => p.port),
  };
}

// ── Receiving card (kapasitas per kartu) ───────────────────────────────────

export interface ReceivingCard { nama: string; /** px maks mendatar */ w: number; /** px maks tegak */ h: number; ket: string }

/**
 * Receiving card Novastar umum: area maksimal per kartu pada 60 Hz (nilai datasheet umum;
 * kapasitas sebenarnya bergantung IC driver & scan modul - cek NovaLCT sebelum penawaran).
 */
export const RECEIVING_CARD: ReceivingCard[] = [
  { nama: 'A4s Plus', w: 256, h: 256, ket: 'Ekonomis; layar kecil / modul besar' },
  { nama: 'A5s Plus', w: 512, h: 384, ket: 'Umum indoor & outdoor' },
  { nama: 'A7s Plus', w: 512, h: 512, ket: 'Indoor fine pitch' },
  { nama: 'A8s', w: 512, h: 512, ket: 'Fine pitch, kalibrasi & HDR dasar' },
  { nama: 'A10s Plus', w: 512, h: 512, ket: 'Premium fine pitch, HDR, refresh tinggi' },
];

/**
 * Jumlah unit (modul/cabinet) per receiving card. Mulai dari usulan (mis. ±500 mm per kartu,
 * mengikuti cabinet) lalu dikecilkan sampai area kartu muat di kapasitas receiving card.
 */
export function unitPerRC(rc: ReceivingCard, pxX: number, pxY: number, usulKol: number, usulBaris: number) {
  let kol = Math.max(1, Math.round(usulKol)), baris = Math.max(1, Math.round(usulBaris));
  while (kol > 1 && kol * pxX > rc.w) kol--;
  while (baris > 1 && baris * pxY > rc.h) baris--;
  return { kol, baris, muat: kol * pxX <= rc.w && baris * pxY <= rc.h };
}
