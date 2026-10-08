/** Screen Connection: pengaturan, data dari Kalkulator LED, susunan kabel per port (murni, tanpa React). */
import { type HasilKoneksi, hitungKoneksi, RECEIVING_CARD, type SelRC, type SudutMulai, unitPerRC } from '@/lib/av-hitung';

/** Pengaturan screen connection (disimpan bersama hitungan LED, ikut undo/redo). */
export interface PengaturanKoneksi {
  mode: 'template' | 'manual';
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z'; bagi: 'baris' | 'penuh';
  /** Batas beban port (%). */ beban: number;
  /** Jumlah modul/cabinet per receiving card (mendatar × tegak); null = otomatis. */ rcKol: number | null; rcBaris: number | null;
  /** Port LAN per controller; null = ikut hardware terpilih. */ ppk: number | null;
  /** Ukuran receiving card bebas: lebar tiap kolom & tinggi tiap baris (px). null = ikut kalkulator. */
  lebarKol: number[] | null; tinggiBaris: number[] | null;
  /** Sel tanpa receiving card. */ kosong: SelRC[];
  /** Kabel manual per port. */ manual: SelRC[][] | null;
  /** Kapasitas port (px); null = dari refresh & bit kalkulator. */ pxPort: number | null;
  /** Model receiving card (RECEIVING_CARD); null = umum ±512×512. */ rcModel: string | null;
  /** Kabel cadangan: tidak, loop (ujung rantai kembali ke port cadangan controller yang sama), atau controller cadangan. */
  cadangan: 'tidak' | 'loop' | 'controller';
}

export const KONEKSI_AWAL: PengaturanKoneksi = {
  mode: 'template', mulai: 'kiri-atas', arah: 'horizontal', pola: 'S', bagi: 'baris', beban: 100, rcKol: null, rcBaris: null, ppk: null,
  lebarKol: null, tinggiBaris: null, kosong: [], manual: null, pxPort: null, rcModel: null, cadangan: 'tidak',
};

/** Pengaturan dari hitungan tersimpan: nilai asing / tidak sah diganti bawaan. */
export function bersihkanKoneksi(x: unknown): PengaturanKoneksi {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const pilih = <T extends string>(v: unknown, sah: readonly T[], awal: T): T => (sah.includes(v as T) ? (v as T) : awal);
  const bulat = (v: unknown, min: number, maks: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, Math.round(v))) : null);
  const sel = (v: unknown): SelRC | null => (Array.isArray(v) && v.length === 2 && bulat(v[0], 0, 999) !== null && bulat(v[1], 0, 999) !== null
    ? [bulat(v[0], 0, 999)!, bulat(v[1], 0, 999)!] : null);
  const daftarSel = (v: unknown, maks: number) => (Array.isArray(v) ? v.slice(0, maks).map(sel).filter((s): s is SelRC => !!s) : []);
  const ukuran = (v: unknown) => (Array.isArray(v) && v.length >= 1 && v.length <= 256 && v.every(n => bulat(n, 1, 8192) !== null) ? v.map(n => bulat(n, 1, 8192)!) : null);
  const A = KONEKSI_AWAL;
  const lebarKol = ukuran(o.lebarKol), tinggiBaris = ukuran(o.tinggiBaris);
  return {
    mode: pilih(o.mode, ['template', 'manual'] as const, A.mode),
    mulai: pilih(o.mulai, ['kiri-atas', 'kanan-atas', 'kiri-bawah', 'kanan-bawah'] as const, A.mulai),
    arah: pilih(o.arah, ['horizontal', 'vertikal'] as const, A.arah),
    pola: pilih(o.pola, ['S', 'Z'] as const, A.pola),
    bagi: pilih(o.bagi, ['baris', 'penuh'] as const, A.bagi),
    beban: bulat(o.beban, 10, 100) ?? A.beban,
    rcKol: bulat(o.rcKol, 1, 1000), rcBaris: bulat(o.rcBaris, 1, 1000), ppk: bulat(o.ppk, 0, 256),
    lebarKol: lebarKol && tinggiBaris ? lebarKol : null, tinggiBaris: lebarKol && tinggiBaris ? tinggiBaris : null,
    kosong: daftarSel(o.kosong, 4096),
    manual: Array.isArray(o.manual) ? o.manual.slice(0, 256).map(r => daftarSel(r, 4096)) : null,
    pxPort: bulat(o.pxPort, 1000, 20_000_000),
    rcModel: RECEIVING_CARD.some(r => r.nama === o.rcModel) ? (o.rcModel as string) : null,
    cadangan: pilih(o.cadangan, ['tidak', 'loop', 'controller'] as const, A.cadangan),
  };
}

/** Data layar dari kalkulator. */
export interface DataKoneksi {
  /** Susunan unit (modul / cabinet). */ kolom: number; baris: number;
  /** Ukuran unit (mm) & pixel per unit. */ wUnit: number; hUnit: number; pxX: number; pxY: number;
  satuan: 'modul' | 'cabinet';
  pxPerPort: number; /** Perkiraan port dari total pixel. */ portIdeal: number;
  /** Port per unit hardware & namanya (0 / null = belum ada). */ ppkHw: number; namaHw: string | null;
  refresh: number; bit: number;
}

const WARNA_PORT = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#059669', '#b91c1c', '#7c3aed'];

export const warnaPort = (p: number) => WARNA_PORT[(p - 1) % WARNA_PORT.length];

export const SUDUT: { v: SudutMulai; l: string }[] = [
  { v: 'kiri-atas', l: 'Kiri atas' }, { v: 'kanan-atas', l: 'Kanan atas' }, { v: 'kiri-bawah', l: 'Kiri bawah' }, { v: 'kanan-bawah', l: 'Kanan bawah' },
];

/** Batas umum area satu receiving card (512 × 512 px). */
export const PX_RC_UMUM = 512 * 512;

export const kunci = (c: number, r: number) => `${c},${r}`;

/** Grid receiving card (ukuran tiap kolom/baris) & urutan kabelnya. */
export function susunKoneksi(d: DataKoneksi, s: PengaturanKoneksi) {
  const otoKol = d.satuan === 'cabinet' ? 1 : Math.max(1, Math.round(500 / Math.max(1, d.wUnit)));
  const otoBaris = d.satuan === 'cabinet' ? 1 : Math.max(1, Math.round(500 / Math.max(1, d.hUnit)));
  //  Model receiving card dipilih: usulan otomatis dikecilkan sampai muat kapasitas kartu.
  const rc = RECEIVING_CARD.find(r => r.nama === s.rcModel) ?? null;
  const oto = rc ? unitPerRC(rc, d.pxX, d.pxY, otoKol, otoBaris) : { kol: otoKol, baris: otoBaris };
  const rcKol = Math.min(d.kolom, Math.max(1, Math.round(s.rcKol ?? oto.kol)));
  const rcBaris = Math.min(d.baris, Math.max(1, Math.round(s.rcBaris ?? oto.baris)));
  const custom = !!(s.lebarKol?.length && s.tinggiBaris?.length);
  //  Ikut kalkulator: receiving card di tepi kanan/bawah memuat sisa modul (ukurannya tepat, bukan dibulatkan).
  const lebar = custom ? s.lebarKol! : Array.from({ length: Math.ceil(d.kolom / rcKol) }, (_, c) => Math.min(rcKol, d.kolom - c * rcKol) * d.pxX);
  const tinggi = custom ? s.tinggiBaris! : Array.from({ length: Math.ceil(d.baris / rcBaris) }, (_, r) => Math.min(rcBaris, d.baris - r * rcBaris) * d.pxY);
  const K = lebar.length, B = tinggi.length;
  //  Loop cadangan: separuh port tiap controller untuk kabel utama, separuh untuk kabel cadangan.
  const ppkPenuh = Math.max(0, Math.round(s.ppk ?? d.ppkHw));
  const ppk = s.cadangan === 'loop' && ppkPenuh > 1 ? Math.floor(ppkPenuh / 2) : ppkPenuh;
  const pxPort = s.pxPort ?? d.pxPerPort;
  const kosong = new Set(s.kosong.filter(([c, r]) => c < K && r < B).map(([c, r]) => kunci(c, r)));
  const hasil = hitungKoneksi({
    kolom: K, baris: B, lebarPx: lebar, tinggiPx: tinggi, kosong: s.kosong, manual: s.mode === 'manual' ? (s.manual ?? []) : null,
    pxPerPort: pxPort, mulai: s.mulai, arah: s.arah, pola: s.pola, bagi: s.bagi, bebanMaks: s.beban, portPerKartu: ppk,
  });
  //  Port kosong (mode manual) tidak dihitung; controller = sampai port terakhir yang terisi.
  const terisi = hasil.port.filter(p => p.jumlah);
  const portTerpakai = terisi.length;
  const controller = !terisi.length ? 0 : ppk > 0 ? Math.ceil(terisi[terisi.length - 1].port / ppk) : 1;
  const cadangan = s.cadangan;
  //  Kapasitas model receiving card: kartu terbesar di grid harus muat.
  const rcLewat = rc ? lebar.some(w => w > rc.w) || tinggi.some(h => h > rc.h) : false;
  return {
    K, B, lebar, tinggi, custom, rcKol, rcBaris, otoKol: oto.kol, otoBaris: oto.baris, ppk, ppkPenuh, pxPort, kosong, hasil, arah: s.arah, portTerpakai, controller,
    rc, rcLewat, cadangan,
    /** Kabel LAN cadangan & controller cadangan. */
    portCadangan: cadangan === 'tidak' ? 0 : portTerpakai, controllerCadangan: cadangan === 'controller' ? controller : 0,
    resX: lebar.reduce((a, b) => a + b, 0), resY: tinggi.reduce((a, b) => a + b, 0),
  };
}

export type Susunan = ReturnType<typeof susunKoneksi>;

/** Rantai kabel per port dari hasil (untuk menyalin template ke manual). */
export const rantaiDari = (h: HasilKoneksi): SelRC[][] => h.port.map(p => h.sel.filter(x => x.port === p.port).map(x => [x.c, x.r] as SelRC));

export const namaPort = (t: Susunan, port: number) =>
  t.ppk > 0 && t.controller > 1 ? `Controller ${Math.ceil(port / t.ppk)} · port ${((port - 1) % t.ppk) + 1}` : `Port ${port}`;

/** Tujuan kabel cadangan dari ujung rantai port `port`. */
export const namaCadangan = (t: Susunan, port: number) => {
  if (t.cadangan === 'controller') return `${t.controller > 1 && t.ppk > 0 ? `Controller cadangan ${Math.ceil(port / t.ppk)}` : 'Controller cadangan'} · port ${t.ppk > 0 ? ((port - 1) % t.ppk) + 1 : port}`;
  if (t.ppk <= 0) return `Port cadangan ${port}`;
  const lokal = ((port - 1) % t.ppk) + 1 + t.ppk;
  return t.controller > 1 ? `Controller ${Math.ceil(port / t.ppk)} · port ${lokal}` : `Port ${lokal}`;
};
