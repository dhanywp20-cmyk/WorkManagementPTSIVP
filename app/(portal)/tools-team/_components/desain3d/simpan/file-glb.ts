import { periksaDesain } from '@/lib/tools-team';
import { type Benda, POLA_KUNCI_TEKSTUR, type Ruang } from '../inti';

export const KUNCI_DESAIN = 'desainPTS';
export const FORMAT_DESAIN = 'pts-desain-3d';

export interface DesainFile {
  format: typeof FORMAT_DESAIN;
  versi: 1;
  nama: string;
  ruang: Ruang;
  benda: Benda[];
  gambar?: Record<string, string>;
  tekstur?: Record<string, string>;
  disimpan?: string;
}

const MAGIC_GLB = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const MAKS_GAMBAR = 8_000_000;

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

export function dataDesainFile(nama: string, ruang: Ruang, benda: Benda[], gambar: Record<string, string>, tekstur: Record<string, string> = {}): DesainFile {
  return { format: FORMAT_DESAIN, versi: 1, nama, ruang, benda, gambar, ...(Object.keys(tekstur).length ? { tekstur } : {}), disimpan: new Date().toISOString() };
}

export const namaFileDesain = (nama: string) => `${(nama || 'desain-av').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'desain-av'}.glb`;
