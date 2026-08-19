import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compress';

// Types

export interface User {
  id: string; username: string; password: string;
  full_name: string; role: string; team_type?: string;
  sales_division?: string; allowed_menus?: string[]; access_level?: string;
}

export interface MovementLog {
  id: string; tanggal: string; nama_pts: string; nama_luar: string;
  status_barang: 'Masuk' | 'Keluar'; event: string; project_name: string;
  type_barang: string; serial_number: string; catatan: string;
  foto_surat_url: string; foto_barang_url: string;
  created_by: string; created_at: string;
  // Asset tracking fields (added in migration 001)
  kondisi_barang?: 'Baik' | 'Perlu Service' | 'Rusak';
  expected_return_date?: string;        // ISO date - when item should return (Keluar only)
  return_confirmed?: boolean;           // True when the Masuk log confirms this Keluar is returned
  checkout_reference_id?: string;       // On a Masuk row: references the original Keluar row id
}

export const KONDISI_BARANG_LIST = ['Baik', 'Perlu Service', 'Rusak'] as const;
export type KondisiBarang = typeof KONDISI_BARANG_LIST[number];

// Constants

export const EVENTS = ['Troubleshooting', 'R&D', 'Demo Product', 'Project', 'Service'];
export const COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

// Helpers

export function splitTypeLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(/\n/)
    .map(s => s.replace(/\\n/g, ' ').replace(/\xa0/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

export function fmtDate(d: string, long = false) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('id-ID', long ? { day:'2-digit',month:'long',year:'numeric' } : { day:'2-digit',month:'short',year:'numeric' }); }
  catch { return d; }
}

export async function uploadFiles(files: File[], folder: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    // Foto dari HP biasanya 3-8MB. Sebelumnya diunggah MENTAH, sehingga boros
    // storage dan egress Supabase. compressImage meneruskan file non-gambar
    // (PDF, dll) apa adanya, jadi aman untuk semua jenis lampiran.
    const toUpload = await compressImage(file);
    const ext  = toUpload.name.split('.').pop() ?? 'bin';
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    // Nama berkas di-generate (bukan nama asli) sehingga isinya tidak pernah
    // berubah  aman di-cache lama. '3600' membuat browser mengunduh ulang
    // tiap jam tanpa alasan.
    const { error } = await supabase.storage.from('movement-files').upload(path, toUpload, { cacheControl:'31536000', upsert:false });
    if (error) throw new Error(`Upload ${file.name}: ${error.message}`);
    const { data } = supabase.storage.from('movement-files').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
