export const ALAT_FILE = ['av-layar', 'av-display', 'av-proyektor', 'av-sinyal', 'av-audio', 'av-daya', 'av-rak', 'av-poe', 'cekbarang', 'banding'] as const;
export type AlatFile = (typeof ALAT_FILE)[number];

export const MAKS_BYTE_FILE = 1_500_000;
export const MAKS_NAMA_FILE = 120;
export const MAKS_RINGKASAN_FILE = 300;

export const alatSah = (x: unknown): x is AlatFile => typeof x === 'string' && (ALAT_FILE as readonly string[]).includes(x);

const bersihTeks = (x: unknown, maks: number) => String(x ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks);

export type HasilPeriksaFile =
  | { ok: true; alat: AlatFile; nama: string; data: Record<string, unknown>; ringkasan: string }
  | { ok: false; alasan: string };

export function periksaFile(b: unknown): HasilPeriksaFile {
  const o = b as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, alasan: 'Body tidak sah.' };
  if (!alatSah(o.alat)) return { ok: false, alasan: 'Alat tidak dikenal.' };
  const nama = bersihTeks(o.nama, MAKS_NAMA_FILE);
  if (!nama) return { ok: false, alasan: 'Nama berkas wajib diisi.' };
  const data = o.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, alasan: 'Isi berkas tidak sah.' };
  let teks: string;
  try { teks = JSON.stringify(data); } catch { return { ok: false, alasan: 'Isi berkas tidak bisa dibaca.' }; }
  if (teks.length > MAKS_BYTE_FILE) return { ok: false, alasan: `Isi berkas terlalu besar (maks ${Math.round(MAKS_BYTE_FILE / 1000)} KB).` };
  return { ok: true, alat: o.alat, nama, data: JSON.parse(teks) as Record<string, unknown>, ringkasan: bersihTeks(o.ringkasan, MAKS_RINGKASAN_FILE) };
}
