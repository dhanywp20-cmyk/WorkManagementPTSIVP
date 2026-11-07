import { daftarRuang, ruangDari } from './ruang';
import type { Benda, GolonganKabelSinyal, KabelCustom, Ruang, Titik } from './tipe';

export type GolonganKabel = GolonganKabelSinyal | 'power';
export const LEGENDA_KABEL: { golongan: GolonganKabel; warna: number; nama: string; label: string }[] = [
  { golongan: 'lan', warna: 0x2563eb, nama: 'Biru', label: 'LAN cable (CAT6 / HDBaseT)' },
  { golongan: 'hdmi', warna: 0xdc2626, nama: 'Merah', label: 'HDMI / HDMI AOC' },
  { golongan: 'audio', warna: 0x16a34a, nama: 'Hijau', label: 'Line audio signal (mic / XLR)' },
  { golongan: 'speaker', warna: 0xea580c, nama: 'Orange', label: 'Speaker cable' },
  { golongan: 'usb', warna: 0x7c3aed, nama: 'Ungu', label: 'USB cable' },
  { golongan: 'power', warna: 0x111111, nama: 'Hitam', label: 'Power cable' },
  { golongan: 'fiber', warna: 0x9ca3af, nama: 'Abu-abu', label: 'Fiber optic' },
];
const WARNA = Object.fromEntries(LEGENDA_KABEL.map(l => [l.golongan, l.warna])) as Record<GolonganKabel, number>;

export interface JenisKabel { kunci: string; nama: string; warna: number; golongan: GolonganKabel }
const jenis = (kunci: string, nama: string, golongan: GolonganKabel): JenisKabel => ({ kunci, nama, golongan, warna: WARNA[golongan] });
export const KABEL = {
  hdmi: jenis('hdmi', 'HDMI', 'hdmi'),
  hdmiAoc: jenis('hdmi-aoc', 'HDMI AOC (fiber aktif, > 10 m)', 'hdmi'),
  lan: jenis('lan', 'LAN CAT6 (data / kontrol / PoE)', 'lan'),
  audio: jenis('audio', 'Kabel audio / mic XLR', 'audio'),
  speaker: jenis('speaker', 'Kabel speaker 2×1,5 mm²', 'speaker'),
  usb: jenis('usb', 'USB (extender CAT6 bila > 5 m)', 'usb'),
  power: jenis('power', 'Kabel power 3×1,5 mm² ke stop kontak', 'power'),
  fiberVideo: jenis('fiber-video', 'Fiber optik (HDMI over fiber)', 'fiber'),
  fiberLan: jenis('fiber-lan', 'Fiber optik (LAN, > 90 m)', 'fiber'),
  fiber: jenis('fiber', 'Fiber optik', 'fiber'),
} satisfies Record<string, JenisKabel>;

export const HDMI_MAKS = 10;
export const AOC_MAKS = 100;
export const LAN_MAKS = 90;

export const GOLONGAN_SINYAL = LEGENDA_KABEL.filter(l => l.golongan !== 'power') as (typeof LEGENDA_KABEL[number] & { golongan: GolonganKabelSinyal })[];
export const MAKS_TARIKAN = 8;

export interface JalurKabel {
  id: string; dari: string; ke: string; kabel: JenisKabel;
  titik: Titik[];  panjang: number; lewat: 'plafon' | 'lantai' | 'dinding';
}

type Butuh = 'video' | 'data' | 'audio' | 'speaker' | 'usb';

const adaKamera = (benda: Benda[]) => benda.some(b => b.jenis === 'kamera');

function kebutuhan(b: Benda, semua: Benda[]): Butuh[] {
  switch (b.jenis) {
    case 'videowall': case 'tv': case 'ifp': case 'lift': return ['video', 'data'];
    case 'led': return ['data'];
    case 'proyektor': return ['video', 'data'];
    case 'kamera': return ['video', 'data'];
    case 'speaker': case 'speaker-plafon': return ['speaker'];
    case 'mic': return ['audio'];
    case 'touchpanel': return ['data'];
    case 'perangkat': return b.tipePerangkat === 'pc' ? ['video', 'data'] : [];
    case 'meja':
      switch (b.bentukMeja) {
        case 'operator': return ['video', 'data'];
        case 'rapat': case 'bulat': case 'dosen': return adaKamera(semua) ? ['video', 'data', 'usb'] : ['video', 'data'];
        case 'podium': return ['video', 'audio'];
        default: return [];
      }
    default: return [];
  }
}

function namaSumber(b: Benda): string {
  if (b.jenis !== 'meja') return b.nama;
  return `${b.nama} (${b.bentukMeja === 'operator' ? 'PC operator' : 'laptop'})`;
}

function butuhPower(b: Benda): boolean {
  if (['videowall', 'led', 'tv', 'ifp', 'lift', 'proyektor', 'rak'].includes(b.jenis)) return true;
  if (b.jenis === 'perangkat') return b.tipePerangkat === 'pc';
  if (b.jenis === 'speaker') return b.tipeSpeaker === 'kolom' || b.tipeSpeaker === 'linearray';
  if (b.jenis === 'meja') return ['operator', 'rapat', 'bulat', 'dosen', 'podium'].includes(b.bentukMeja ?? 'rapat');
  return false;
}

const bulatSetengah = (v: number) => Math.ceil(v * 2) / 2;
const panjangRute = (t: Titik[]) => {
  let s = 0;
  for (let k = 1; k < t.length; k++) s += Math.hypot(t[k][0] - t[k - 1][0], t[k][1] - t[k - 1][1], t[k][2] - t[k - 1][2]);
  return s;
};

function pilihKabel(butuh: Butuh, panjang: number): JenisKabel {
  switch (butuh) {
    case 'video': return panjang <= HDMI_MAKS ? KABEL.hdmi : panjang <= AOC_MAKS ? KABEL.hdmiAoc : KABEL.fiberVideo;
    case 'data': return panjang <= LAN_MAKS ? KABEL.lan : KABEL.fiberLan;
    case 'audio': return KABEL.audio;
    case 'speaker': return KABEL.speaker;
    case 'usb': return KABEL.usb;
  }
}

function kabelGolongan(g: GolonganKabelSinyal, panjang: number): JenisKabel {
  switch (g) {
    case 'hdmi': return panjang <= HDMI_MAKS ? KABEL.hdmi : KABEL.hdmiAoc;
    case 'lan': return KABEL.lan;
    case 'audio': return KABEL.audio;
    case 'speaker': return KABEL.speaker;
    case 'usb': return KABEL.usb;
    case 'fiber': return KABEL.fiber;
  }
}

const GOLONGAN_BUTUH: Record<Butuh, GolonganKabelSinyal> = { video: 'hdmi', data: 'lan', audio: 'audio', speaker: 'speaker', usb: 'usb' };

export function kabelOtomatis(b: Benda, semua: Benda[]): KabelCustom[] {
  const hasil: KabelCustom[] = [];
  for (const k of kebutuhan(b, semua)) {
    const g = GOLONGAN_BUTUH[k];
    const ada = hasil.find(h => h.golongan === g);
    if (ada) ada.jumlah++; else hasil.push({ golongan: g, jumlah: 1 });
  }
  return hasil;
}

function daftarKabel(b: Benda, semua: Benda[]): ((panjang: number) => JenisKabel)[] {
  if (b.kabelCustom) {
    return b.kabelCustom.flatMap(k => Array.from({ length: Math.max(0, Math.min(MAKS_TARIKAN, Math.round(k.jumlah) || 0)) },
      () => (panjang: number) => kabelGolongan(k.golongan, panjang)));
  }
  return kebutuhan(b, semua).map(k => (panjang: number) => pilihKabel(k, panjang));
}

export const perluKabelSinyal = (benda: Benda[]) => benda.some(b => daftarKabel(b, benda).length > 0);

export function jalurKabel(benda: Benda[], ruang: Ruang, opsi: { power?: boolean } = {}): JalurKabel[] {
  const rak = benda.filter(b => b.jenis === 'rak');
  const kotak = daftarRuang(ruang);
  const hasil: JalurKabel[] = [];
  let urut = 0;
  for (const b of benda) {
    const butuh = rak.length ? daftarKabel(b, benda) : [];
    const ri = ruangDari(ruang, b.x);
    if (butuh.length) {
      const sama = rak.filter(r => ruangDari(ruang, r.x) === ri);
      const tujuan = (sama.length ? sama : rak).reduce((a, r) => (Math.hypot(r.x - b.x, r.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? r : a));
      const plafon = Math.min(kotak[ri]?.t ?? ruang.t, kotak[ruangDari(ruang, tujuan.x)]?.t ?? ruang.t);
      const lewat: 'plafon' | 'lantai' = b.elev + b.h / 2 < 1.2 ? 'lantai' : 'plafon';
      const yAwal = b.jenis === 'meja' ? b.elev + b.h : b.elev + b.h / 2;
      butuh.forEach((pilih, i) => {
        const geser = ((urut++ % 6) - 2.5) * 0.025 + i * 0.035;
        const yJalur = lewat === 'plafon' ? plafon - 0.06 - Math.abs(geser) : 0.02 + Math.abs(geser) * 0.4;
        const awal: Titik = [b.x + (b.jenis === 'meja' ? geser : 0), yAwal, b.z];
        const akhir: Titik = [tujuan.x + geser, lewat === 'plafon' ? tujuan.elev + tujuan.h : 0.12, tujuan.z];
        const titik: Titik[] = [awal, [awal[0], yJalur, awal[2]], [akhir[0], yJalur, awal[2] + geser], [akhir[0], yJalur, akhir[2]], akhir];
        const panjang = bulatSetengah(panjangRute(titik) * 1.1 + 1.5);
        hasil.push({ id: `${b.id}-${i}`, dari: namaSumber(b), ke: tujuan.nama, kabel: pilih(panjang), titik, panjang, lewat });
      });
    }
    if (opsi.power && butuhPower(b)) {
      const k = kotak[ri] ?? kotak[0];
      const awal: Titik = [b.x, b.jenis === 'meja' ? b.elev + b.h : b.elev + b.h / 2, b.z];
      let titik: Titik[];
      if (b.jenis === 'proyektor' && b.pasangProyektor !== 'meja') {
        titik = [awal, [b.x, k.t - 0.02, b.z]];
      } else {
        const pilihan: [number, Titik][] = [
          [b.x - k.x0, [k.x0 + 0.02, 0.3, b.z]], [k.x0 + k.p - b.x, [k.x0 + k.p - 0.02, 0.3, b.z]],
          [b.z, [b.x, 0.3, 0.02]], [k.l - b.z, [b.x, 0.3, k.l - 0.02]],
        ];
        const dinding = pilihan.reduce((a, c) => (c[0] < a[0] ? c : a))[1];
        const yLantai = 0.03;
        titik = [awal, [awal[0], yLantai, awal[2]], [dinding[0], yLantai, dinding[2]], dinding];
      }
      hasil.push({ id: `${b.id}-p`, dari: namaSumber(b), ke: 'Stop kontak terdekat', kabel: KABEL.power, titik, panjang: bulatSetengah(panjangRute(titik) + 1), lewat: 'dinding' });
    }
  }
  return hasil;
}

export const golonganDipakai = (jalur: JalurKabel[]) => new Set(jalur.map(j => j.kabel.golongan));

export function rekapKabel(jalur: JalurKabel[]) {
  const peta = new Map<string, { kabel: JenisKabel; tarikan: number; meter: number }>();
  for (const j of jalur) {
    const a = peta.get(j.kabel.kunci) ?? { kabel: j.kabel, tarikan: 0, meter: 0 };
    a.tarikan++; a.meter += j.panjang; peta.set(j.kabel.kunci, a);
  }
  return [...peta.values()].map(x => ({
    ...x,
    gulungan: x.kabel.kunci === 'lan' ? `${Math.ceil(x.meter / 305)} box 305 m`
      : x.kabel.kunci === 'speaker' || x.kabel.kunci === 'audio' ? `${Math.ceil(x.meter / 100)} roll 100 m`
        : x.kabel.kunci === 'power' ? `${Math.ceil(x.meter / 50)} roll 50 m`
          : `${x.tarikan} kabel jadi`,
  }));
}
