/**
 * desain3d/file-glb.ts - simpan & buka desain di LAPTOP sebagai .glb.
 *
 * File .glb biasa (bisa dibuka SketchUp / Blender / viewer 3D mana pun) yang
 * MENYIMPAN JUGA data desain Tools Team di `extras` node akarnya: ruangan,
 * daftar benda, dan gambar layar unggahan. Membuka file itu lagi di Tools Team
 * mengembalikan desain yang bisa diedit - bukan sekadar tampilan.
 *
 * Tujuannya hemat storage Supabase (paket gratis): desain bisa disimpan di
 * laptop sendiri tanpa satu byte pun ke server.
 *
 * Membaca data cukup dengan mengurai potongan JSON dari GLB - tidak perlu
 * memuat seluruh geometri. Tanpa three / React, jadi bisa diuji di Node.
 */
import { periksaDesain } from '@/lib/tools-team';
import { type Benda, POLA_KUNCI_TEKSTUR, type Ruang } from '../inti';

/** Kunci `userData` / `extras` tempat data desain disimpan. */
export const KUNCI_DESAIN = 'desainPTS';
export const FORMAT_DESAIN = 'pts-desain-3d';

export interface DesainFile {
  format: typeof FORMAT_DESAIN;
  versi: 1;
  nama: string;
  ruang: Ruang;
  benda: Benda[];
  /** Gambar layar unggahan per id benda (data URL) - di server tidak ikut disimpan. */
  gambar?: Record<string, string>;
  /** Tekstur lantai / dinding (kunci 'tx-...' -> data URL), lihat inti/teksturRuang.ts. */
  tekstur?: Record<string, string>;
  disimpan?: string;
}

const MAGIC_GLB = 0x46546c67;   // 'glTF'
const CHUNK_JSON = 0x4e4f534a;  // 'JSON'
const MAKS_GAMBAR = 8_000_000;  // per gambar (data URL)

/** Potongan JSON dari file .glb, atau null bila bukan GLB yang sah. */
export function jsonDariGLB(buf: ArrayBuffer): Record<string, unknown> | null {
  if (buf.byteLength < 20) return null;
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC_GLB) return null;
  const panjangChunk = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== CHUNK_JSON || 20 + panjangChunk > buf.byteLength) return null;
  try {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, panjangChunk))) as Record<string, unknown>;
  } catch { return null; }
}

/**
 * Data desain Tools Team di dalam .glb, atau null bila file ini bukan desain
 * Tools Team (mis. model produk dari pabrikan) / datanya tidak sah.
 */
export function bacaDesainGLB(buf: ArrayBuffer): DesainFile | null {
  const json = jsonDariGLB(buf);
  if (!json) return null;
  const kandidat = [
    ...((json.scenes as { extras?: Record<string, unknown> }[] | undefined) ?? []),
    ...((json.nodes as { extras?: Record<string, unknown> }[] | undefined) ?? []),
  ];
  const mentah = kandidat.map(x => x?.extras?.[KUNCI_DESAIN]).find(Boolean) as Partial<DesainFile> | undefined;
  if (!mentah || mentah.format !== FORMAT_DESAIN) return null;
  const cek = periksaDesain({ ruang: mentah.ruang, benda: mentah.benda });
  if (!cek.ok) return null;
  const sah = (url: unknown): url is string =>
    typeof url === 'string' && url.length <= MAKS_GAMBAR && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
  const gambar: Record<string, string> = {};
  for (const [id, url] of Object.entries(mentah.gambar ?? {})) if (sah(url)) gambar[id] = url;
  const tekstur: Record<string, string> = {};
  for (const [k, url] of Object.entries(mentah.tekstur ?? {})) if (POLA_KUNCI_TEKSTUR.test(k) && sah(url)) tekstur[k] = url;
  return {
    format: FORMAT_DESAIN, versi: 1,
    nama: typeof mentah.nama === 'string' && mentah.nama.trim() ? mentah.nama.trim().slice(0, 120) : 'Desain dari laptop',
    ruang: cek.data.ruang as Ruang, benda: cek.data.benda as Benda[], gambar, tekstur,
    disimpan: typeof mentah.disimpan === 'string' ? mentah.disimpan : undefined,
  };
}

/** Isi `userData[KUNCI_DESAIN]` untuk node akar yang akan diekspor. */
export function dataDesainFile(nama: string, ruang: Ruang, benda: Benda[], gambar: Record<string, string>, tekstur: Record<string, string> = {}): DesainFile {
  return { format: FORMAT_DESAIN, versi: 1, nama, ruang, benda, gambar, ...(Object.keys(tekstur).length ? { tekstur } : {}), disimpan: new Date().toISOString() };
}

/** Nama file aman dari nama desain. */
export const namaFileDesain = (nama: string) => `${(nama || 'desain-av').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'desain-av'}.glb`;
