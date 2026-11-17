import { type DataKoneksi, kodePort, type PengaturanKoneksi, type Susunan, susunKoneksi } from './data';

export interface LayarKoneksi { nama: string; d: DataKoneksi; s: PengaturanKoneksi }

export const KUNCI_VP = ['ppk', 'cadangan', 'pxPort', 'beban'] as const satisfies readonly (keyof PengaturanKoneksi)[];
const ambilVP = (s: PengaturanKoneksi) => ({ ppk: s.ppk, cadangan: s.cadangan, pxPort: s.pxPort, beban: s.beban });

export interface BagianLayar {
  i: number; nama: string; d: DataKoneksi;
  s: PengaturanKoneksi;
  t: Susunan;
  off: number;
  rentang: [number, number] | null;
}

export interface SusunanMulti {
  per: BagianLayar[];
  gabung: Susunan;
  multi: boolean;
  pemilik: (port: number) => number;
}

function geser(t: Susunan, off: number, controller: number): Susunan {
  const kartu = (p: number) => (t.ppk > 0 ? Math.ceil(p / t.ppk) : 1);
  return {
    ...t, controller, controllerCadangan: t.cadangan === 'controller' ? controller : 0,
    hasil: {
      ...t.hasil,
      sel: t.hasil.sel.map(x => ({ ...x, port: x.port + off, kartu: kartu(x.port + off) })),
      port: t.hasil.port.map(p => ({ ...p, port: p.port + off, kartu: kartu(p.port + off) })),
      lewat: t.hasil.lewat.map(p => p + off),
    },
  };
}

export function susunMulti(daftar: LayarKoneksi[], pisahKartu: boolean): SusunanMulti {
  const vp = ambilVP(daftar[0].s);
  const lokal = daftar.map((l, i) => {
    const s = i ? { ...l.s, ...vp } : l.s;
    return { ...l, s, t: susunKoneksi(l.d, s) };
  });
  if (lokal.length === 1) {
    const b = lokal[0], dipakai = b.t.hasil.port.filter(p => p.jumlah);
    return {
      per: [{ i: 0, nama: b.nama, d: b.d, s: b.s, t: b.t, off: 0, rentang: dipakai.length ? [dipakai[0].port, dipakai[dipakai.length - 1].port] : null }],
      gabung: b.t, multi: false, pemilik: () => 0,
    };
  }
  const { ppk, lanKartu } = lokal[0].t;
  let jalan = 0, akhir = 0;
  const offs = lokal.map(l => {
    if (jalan > 0 && pisahKartu && lanKartu > 0) jalan = Math.ceil(jalan / lanKartu) * lanKartu;
    const off = jalan;
    jalan += l.t.hasil.port.length;
    const terisi = l.t.hasil.port.filter(p => p.jumlah);
    if (terisi.length) akhir = Math.max(akhir, off + terisi[terisi.length - 1].port);
    return off;
  });
  const controller = akhir ? (ppk > 0 ? Math.ceil(akhir / ppk) : 1) : 0;
  const per: BagianLayar[] = lokal.map((l, i) => {
    const t = geser(l.t, offs[i], controller);
    const dipakai = t.hasil.port.filter(p => p.jumlah);
    return { i, nama: l.nama, d: l.d, s: l.s, t, off: offs[i], rentang: dipakai.length ? [dipakai[0].port, dipakai[dipakai.length - 1].port] : null };
  });
  const port = per.flatMap(b => b.t.hasil.port);
  const portTerpakai = per.reduce((a, b) => a + b.t.portTerpakai, 0);
  const t0 = per[0].t;
  const gabung: Susunan = {
    ...t0, controller, controllerCadangan: t0.cadangan === 'controller' ? controller : 0,
    portTerpakai, portCadangan: t0.cadangan === 'tidak' ? 0 : portTerpakai,
    rcLewat: per.some(b => b.t.rcLewat),
    hasil: {
      ...t0.hasil,
      sel: per.flatMap(b => b.t.hasil.sel), port,
      galat: per.map(b => b.t.hasil.galat).find(Boolean) ?? null,
      tanpaPort: per.flatMap(b => b.t.hasil.tanpaPort), lewat: per.flatMap(b => b.t.hasil.lewat),
      jumlahPort: port.length, jumlahKartu: controller,
    },
  };
  const pemilik = (p: number) => {
    for (let i = per.length - 1; i >= 0; i--) if (p > per[i].off) return i;
    return 0;
  };
  return { per, gabung, multi: true, pemilik };
}

export const teksRentangPort = (b: BagianLayar) => (!b.rentang ? 'belum ada kabel'
  : b.rentang[0] === b.rentang[1] ? kodePort(b.t, b.rentang[0]) : `${kodePort(b.t, b.rentang[0])}–${kodePort(b.t, b.rentang[1])}`);
