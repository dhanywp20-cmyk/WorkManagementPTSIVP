import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string; username: string; password: string;
  full_name: string; role: string; team_type?: string;
  sales_division?: string; allowed_menus?: string[];
}

export interface MovementLog {
  id: string; tanggal: string; nama_pts: string; nama_luar: string;
  status_barang: 'Masuk' | 'Keluar'; event: string; project_name: string;
  type_barang: string; serial_number: string; catatan: string;
  foto_surat_url: string; foto_barang_url: string;
  created_by: string; created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const EVENTS = ['Troubleshooting', 'R&D', 'Demo Product', 'Project', 'Service'];
export const COLORS = ['#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    const ext  = file.name.split('.').pop() ?? 'bin';
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('movement-files').upload(path, file, { cacheControl:'3600', upsert:false });
    if (error) throw new Error(`Upload ${file.name}: ${error.message}`);
    const { data } = supabase.storage.from('movement-files').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
