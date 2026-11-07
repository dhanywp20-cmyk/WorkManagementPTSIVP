

export type SudutMulai = 'kiri-atas' | 'kanan-atas' | 'kiri-bawah' | 'kanan-bawah';

export type SelRC = [number, number];

export interface OpsiKoneksi {
   kolom: number; baris: number;
   pxPerRC?: number;
  lebarPx?: number[]; tinggiPx?: number[];
   kosong?: SelRC[];
   manual?: SelRC[][] | null;
  pxPerPort: number;
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal';
   pola: 'S' | 'Z';
   bagi: 'baris' | 'penuh';
   bebanMaks?: number;
   portPerKartu?: number;
}

export interface SelKoneksi { c: number; r: number; port: number; urut: number; kartu: number; px: number }

export interface PortKoneksi { port: number; kartu: number; jumlah: number; px: number; beban: number; mulai: { c: number; r: number } | null }

export interface HasilKoneksi {
   sel: SelKoneksi[];
  port: PortKoneksi[];
   rcPerPortMaks: number; jumlahPort: number; jumlahKartu: number;
   galat: string | null;
   tanpaPort: { c: number; r: number }[];
   lewat: number[];
}

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

export interface ReceivingCard { nama: string;  w: number;  h: number; ket: string }

export const NAMA_RC_LAMA: Readonly<Record<string, string>> = { 'A4s Plus': 'A4s', A8s: 'A8s-N', 'A10s Plus': 'A10s Plus-N' };

export const RECEIVING_CARD: ReceivingCard[] = [
  { nama: 'MRV208-1', w: 256, h: 256, ket: 'NovaStar; HUB75E ×8' },
  { nama: 'MRV412-N', w: 512, h: 512, ket: 'NovaStar; HUB75E ×12' },
  { nama: 'MRV416-N', w: 512, h: 512, ket: 'NovaStar; HUB75E ×16' },
  { nama: 'MRV532', w: 512, h: 512, ket: 'NovaStar; HUB320F ×10' },
  { nama: 'A4s', w: 256, h: 256, ket: 'NovaStar seri lama; tidak ada di daftar situs saat ini' },
  { nama: 'A5s Plus', w: 512, h: 384, ket: 'NovaStar Armor' },
  { nama: 'A7s Plus', w: 512, h: 512, ket: 'NovaStar Armor' },
  { nama: 'A8s-N', w: 512, h: 384, ket: 'NovaStar Armor; HDR' },
  { nama: 'A10s Plus-N', w: 512, h: 512, ket: 'NovaStar Armor; HDR' },
  { nama: 'A10s Pro', w: 512, h: 512, ket: 'NovaStar Armor; HDR; 512×384 untuk video 12-bit' },
  { nama: 'DS-D44R08-N', w: 256, h: 256, ket: 'Hikvision; HUB75E ×8' },
  { nama: 'DS-D44R12-N', w: 512, h: 512, ket: 'Hikvision; HUB75E ×12' },
  { nama: 'DS-D44R16-N', w: 512, h: 384, ket: 'Hikvision; HUB75E ×16' },
  { nama: 'DS-D44R38-N', w: 512, h: 512, ket: 'Hikvision; HUB320 ×8' },
  { nama: 'DS-DR31C-08', w: 512, h: 512, ket: 'Hikvision; HUB320 ×8' },
  { nama: 'DS-DR31H-08', w: 512, h: 512, ket: 'Hikvision; HUB75E ×8' },
  { nama: 'DS-DR31H-12', w: 512, h: 512, ket: 'Hikvision; HUB75E ×12' },
  { nama: 'DS-DR31H-16', w: 512, h: 512, ket: 'Hikvision; HUB75E ×16' },
];

export function unitPerRC(rc: ReceivingCard, pxX: number, pxY: number, usulKol: number, usulBaris: number) {
  let kol = Math.max(1, Math.round(usulKol)), baris = Math.max(1, Math.round(usulBaris));
  while (kol > 1 && kol * pxX > rc.w) kol--;
  while (baris > 1 && baris * pxY > rc.h) baris--;
  return { kol, baris, muat: kol * pxX <= rc.w && baris * pxY <= rc.h };
}
