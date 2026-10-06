/**
 * Jalur & panjang kabel AV: tiap perangkat dikabel ke rack (rack di ruang yang sama, atau
 * rack terdekat). Rute siku-siku seperti tray kabel di lapangan: perangkat dinding/plafon lewat
 * plafon, perangkat meja/lantai lewat lantai (floor box). Panjang = rute + 10% lekukan + 1,5 m
 * service loop, dibulatkan ke atas per 0,5 m. Murni - tanpa three.js / React.
 */
import { daftarRuang, ruangDari, type Benda, type Ruang, type Titik } from './model';

export interface JenisKabel { kunci: string; nama: string; warna: number }
export const KABEL: Record<string, JenisKabel> = {
  hdmi: { kunci: 'hdmi', nama: 'HDMI', warna: 0x2563eb },
  hdbt: { kunci: 'hdbt', nama: 'HDBaseT (CAT6A)', warna: 0x7c3aed },
  lan: { kunci: 'lan', nama: 'LAN CAT6 (kontrol / PoE)', warna: 0x0891b2 },
  speaker: { kunci: 'speaker', nama: 'Kabel speaker 2×1,5 mm²', warna: 0xea580c },
  mic: { kunci: 'mic', nama: 'Kabel mic XLR / audio', warna: 0xdb2777 },
};
/** Batas HDMI pasif; lebih panjang -> HDBaseT lewat CAT6A. */
export const HDMI_MAKS = 10;

export interface JalurKabel {
  id: string; dari: string; ke: string; kabel: JenisKabel;
  titik: Titik[]; /** m, sudah termasuk lekukan & service loop */ panjang: number; lewat: 'plafon' | 'lantai';
}

/** Kabel yang dibutuhkan satu perangkat (sebelum memilih HDMI / HDBaseT dari panjang). */
function kebutuhan(b: Benda): ('video' | keyof typeof KABEL)[] {
  switch (b.jenis) {
    case 'videowall': case 'tv': case 'ifp': case 'lift': return ['video', 'lan'];
    case 'led': return ['lan'];
    case 'proyektor': return ['video', 'lan'];
    case 'kamera': return ['video', 'lan'];
    case 'speaker': case 'speaker-plafon': return ['speaker'];
    case 'mic': return ['mic'];
    case 'touchpanel': return ['lan'];
    default: return [];
  }
}

const bulatSetengah = (v: number) => Math.ceil(v * 2) / 2;

/** Semua jalur kabel di desain (kosong bila belum ada rack). */
export function jalurKabel(benda: Benda[], ruang: Ruang): JalurKabel[] {
  const rak = benda.filter(b => b.jenis === 'rak');
  if (!rak.length) return [];
  const kotak = daftarRuang(ruang);
  const hasil: JalurKabel[] = [];
  let urut = 0;
  for (const b of benda) {
    const butuh = kebutuhan(b);
    if (!butuh.length) continue;
    const ri = ruangDari(ruang, b.x);
    const sama = rak.filter(r => ruangDari(ruang, r.x) === ri);
    const tujuan = (sama.length ? sama : rak).reduce((a, r) => (Math.hypot(r.x - b.x, r.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? r : a));
    const plafon = Math.min(kotak[ri]?.t ?? ruang.t, kotak[ruangDari(ruang, tujuan.x)]?.t ?? ruang.t);
    const lewat: JalurKabel['lewat'] = b.elev + b.h / 2 < 1.2 ? 'lantai' : 'plafon';
    butuh.forEach((jenis, i) => {
      //  Kabel sejajar digeser sedikit supaya tidak menumpuk di gambar.
      const geser = ((urut++ % 6) - 2.5) * 0.025 + i * 0.02;
      const yJalur = lewat === 'plafon' ? plafon - 0.06 - Math.abs(geser) : 0.02 + Math.abs(geser) * 0.4;
      const awal: Titik = [b.x, b.elev + b.h / 2, b.z];
      const akhir: Titik = [tujuan.x + geser, lewat === 'plafon' ? tujuan.elev + tujuan.h : 0.12, tujuan.z];
      const titik: Titik[] = [awal, [awal[0], yJalur, awal[2]], [akhir[0], yJalur, awal[2] + geser], [akhir[0], yJalur, akhir[2]], akhir];
      let rute = 0;
      for (let k = 1; k < titik.length; k++) rute += Math.hypot(titik[k][0] - titik[k - 1][0], titik[k][1] - titik[k - 1][1], titik[k][2] - titik[k - 1][2]);
      const panjang = bulatSetengah(rute * 1.1 + 1.5);
      const kabel = jenis === 'video' ? (panjang <= HDMI_MAKS ? KABEL.hdmi : KABEL.hdbt) : KABEL[jenis];
      hasil.push({ id: `${b.id}-${i}`, dari: b.nama, ke: tujuan.nama, kabel, titik, panjang, lewat });
    });
  }
  return hasil;
}

/** Total per jenis kabel (m) + jumlah tarikan, untuk daftar belanja kabel (gulungan 305 m untuk CAT6 / 100 m speaker). */
export function rekapKabel(jalur: JalurKabel[]) {
  const peta = new Map<string, { kabel: JenisKabel; tarikan: number; meter: number }>();
  for (const j of jalur) {
    const a = peta.get(j.kabel.kunci) ?? { kabel: j.kabel, tarikan: 0, meter: 0 };
    a.tarikan++; a.meter += j.panjang; peta.set(j.kabel.kunci, a);
  }
  return [...peta.values()].map(x => ({
    ...x,
    gulungan: x.kabel.kunci === 'lan' || x.kabel.kunci === 'hdbt' ? `${Math.ceil(x.meter / 305)} box 305 m`
      : x.kabel.kunci === 'speaker' || x.kabel.kunci === 'mic' ? `${Math.ceil(x.meter / 100)} roll 100 m` : `${x.tarikan} kabel jadi`,
  }));
}
