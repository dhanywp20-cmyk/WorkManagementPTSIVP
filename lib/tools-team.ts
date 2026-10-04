/**
 * lib/tools-team.ts - bentuk & validasi data Tools Team yang disimpan di
 * server (desain ruang 3D, tabel referensi LED bersama).
 *
 * Dipakai DUA sisi: route server (app/api/tools-team/*) memvalidasi apa yang
 * dikirim peramban sebelum menyimpannya, dan peramban memakai bentuk yang
 * sama. Tanpa React / jaringan supaya aman diimpor dari mana saja.
 */
import type { ModulLED, Hardware } from '@/lib/av-hitung';

export interface RefLED { modul: ModulLED[]; kartu: Hardware[]; vp: Hardware[] }

/** Baris app_settings tempat referensi LED bersama disimpan. */
export const KUNCI_REFERENSI_LED = 'tools_team_referensi_led';

/** Batas ukuran satu desain tersimpan (JSON) & jumlah benda. */
export const MAKS_BYTE_DESAIN = 400_000;
export const MAKS_BENDA = 600;

const teks = (v: unknown, maks: number) => (typeof v === 'string' ? v.slice(0, maks) : null);
const angka = (v: unknown, min: number, maks: number) =>
  (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= maks ? v : null);
const bulat = (v: unknown, min: number, maks: number) => {
  const n = angka(v, min, maks);
  return n === null ? null : Math.round(n);
};

function bersihkanModul(x: unknown): ModulLED | null {
  const m = x as Record<string, unknown>;
  if (!m || typeof m !== 'object') return null;
  const kode = teks(m.kode, 40), guna = teks(m.guna ?? '', 200);
  const pitch = angka(m.pitch, 0.1, 100), w = angka(m.w, 1, 5000), h = angka(m.h, 1, 5000);
  const pxW = bulat(m.pxW, 1, 20000), pxH = bulat(m.pxH, 1, 20000);
  const tipe = m.tipe === 'Indoor' || m.tipe === 'Indoor/Outdoor' || m.tipe === 'Outdoor' ? m.tipe : null;
  if (!kode || guna === null || pitch === null || w === null || h === null || pxW === null || pxH === null || !tipe) return null;
  return { kode, pitch, w, h, pxW, pxH, tipe, guna };
}

function bersihkanHardware(x: unknown): Hardware | null {
  const hw = x as Record<string, unknown>;
  if (!hw || typeof hw !== 'object') return null;
  const nama = teks(hw.nama, 60), ket = teks(hw.ket ?? '', 200);
  const maksPx = bulat(hw.maksPx, 1, 1e9), port = bulat(hw.port, 0, 200);
  if (!nama || ket === null || maksPx === null || port === null || typeof hw.senderBawaan !== 'boolean') return null;
  return { nama, ket, maksPx, port, senderBawaan: hw.senderBawaan };
}

/** Referensi LED yang sah (semua baris valid, maks 200 per tabel), atau null. */
export function bersihkanReferensiLED(x: unknown): RefLED | null {
  const r = x as Record<string, unknown>;
  if (!r || !Array.isArray(r.modul) || !Array.isArray(r.kartu) || !Array.isArray(r.vp)) return null;
  if (!r.modul.length || r.modul.length > 200 || r.kartu.length > 200 || r.vp.length > 200) return null;
  const modul = r.modul.map(bersihkanModul), kartu = r.kartu.map(bersihkanHardware), vp = r.vp.map(bersihkanHardware);
  if (modul.includes(null) || kartu.includes(null) || vp.includes(null)) return null;
  return { modul: modul as ModulLED[], kartu: kartu as Hardware[], vp: vp as Hardware[] };
}

/** Data desain 3D yang sah ({ ruang, benda }) beserta jumlah benda, atau alasan penolakan. */
export function periksaDesain(x: unknown): { ok: true; data: { ruang: unknown; benda: unknown[] }; jumlah: number } | { ok: false; alasan: string } {
  const d = x as Record<string, unknown>;
  if (!d || typeof d !== 'object' || !d.ruang || typeof d.ruang !== 'object' || !Array.isArray(d.benda)) {
    return { ok: false, alasan: 'Data desain tidak sah.' };
  }
  if (d.benda.length > MAKS_BENDA) return { ok: false, alasan: `Maksimal ${MAKS_BENDA} benda per desain.` };
  if (d.benda.some(b => !b || typeof b !== 'object' || typeof (b as { jenis?: unknown }).jenis !== 'string')) {
    return { ok: false, alasan: 'Data benda tidak sah.' };
  }
  const data = { ruang: d.ruang, benda: d.benda };
  if (JSON.stringify(data).length > MAKS_BYTE_DESAIN) return { ok: false, alasan: 'Desain terlalu besar untuk disimpan.' };
  return { ok: true, data, jumlah: d.benda.length };
}
