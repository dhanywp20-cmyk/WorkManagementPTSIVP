/**
 * lib/solusi-serupa.ts - cari tiket lama yang sudah Solved dengan kasus mirip,
 * beserta catatan penyelesaiannya, plus Tech Note R&D yang relevan.
 *
 * Sengaja TANPA AI: pencocokan kata kunci di Postgres (ilike) lalu diberi
 * skor jumlah kata yang cocok. Cepat, gratis, dan hasilnya bisa dijelaskan
 * ("cocok karena: hdmi, blank"). Dipakai panel "Solusi serupa" di detail
 * tiket dan alat `solusi_serupa` milik Asisten.
 *
 * Klien yang diberikan menentukan hak baca - panggil dengan klien milik
 * user (lib/ai-server.ts klienSebagaiUser) supaya RLS tetap berlaku.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const KATA_UMUM = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'tidak', 'bisa', 'ada', 'ini', 'itu',
  'atau', 'saat', 'sudah', 'belum', 'akan', 'karena', 'jadi', 'unit', 'masalah', 'kendala', 'mohon',
  'tolong', 'customer', 'user', 'the', 'and', 'not', 'for', 'with', 'tiket', 'ticket', 'issue',
]);

/** Kata kunci bermakna (>=3 huruf, bukan kata umum), maksimal 6. */
export function kataKunci(teks: string): string[] {
  const kata = (teks || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 3 && !KATA_UMUM.has(k));
  return Array.from(new Set(kata)).slice(0, 6);
}

export interface TiketSerupa {
  id: string; project_name: string | null; issue_case: string | null; product: string | null;
  assign_name: string | null; tanggal: string; cocok: string[]; solusi: string | null;
}
export interface TechNoteSerupa { id: string; title: string; product: string | null; cocok: string[] }

export async function cariSolusiSerupa(db: SupabaseClient, teks: string, opsi: { kecualiId?: string; batas?: number } = {}): Promise<{
  kata: string[]; tiket: TiketSerupa[]; techNote: TechNoteSerupa[];
}> {
  const kata = kataKunci(teks);
  if (kata.length === 0) return { kata, tiket: [], techNote: [] };
  const batas = opsi.batas ?? 5;

  const orTiket = kata.flatMap(k => [`issue_case.ilike.%${k}%`, `description.ilike.%${k}%`, `product.ilike.%${k}%`]).join(',');
  const orNote = kata.flatMap(k => [`title.ilike.%${k}%`, `description.ilike.%${k}%`, `product.ilike.%${k}%`]).join(',');

  const [{ data: kandidat }, { data: notes }] = await Promise.all([
    db.from('tickets')
      .select('id, project_name, issue_case, description, product, assign_name, updated_at, created_at')
      .eq('status', 'Solved').not('is_deleted', 'is', true).or(orTiket)
      .order('updated_at', { ascending: false }).limit(40),
    db.from('tech_notes').select('id, title, description, product, tags')
      .eq('status', 'approved').or(orNote).limit(20),
  ]);

  const skor = (teksBaris: string): string[] => kata.filter(k => teksBaris.includes(k));
  const tiket = ((kandidat ?? []) as {
    id: string; project_name: string | null; issue_case: string | null; description: string | null;
    product: string | null; assign_name: string | null; updated_at: string | null; created_at: string;
  }[])
    .filter(t => t.id !== opsi.kecualiId)
    .map(t => ({ t, cocok: skor(`${t.issue_case ?? ''} ${t.description ?? ''} ${t.product ?? ''}`.toLowerCase()) }))
    .filter(x => x.cocok.length > 0)
    .sort((a, b) => b.cocok.length - a.cocok.length)
    .slice(0, batas);

  //  Catatan penyelesaian = aktivitas terakhir tiket itu (biasanya yang
  //  mengubah status ke Solved). Satu kueri untuk semua kandidat.
  const solusiPer = new Map<string, string>();
  if (tiket.length) {
    const { data: akt } = await db.from('activity_logs')
      .select('ticket_id, action_taken, notes, new_status, created_at')
      .in('ticket_id', tiket.map(x => x.t.id))
      .order('created_at', { ascending: false }).limit(200);
    for (const a of (akt ?? []) as { ticket_id: string; action_taken: string | null; notes: string | null; new_status: string | null }[]) {
      if (solusiPer.has(a.ticket_id)) continue;
      const isi = [a.action_taken, a.notes].filter(Boolean).join(' - ').trim();
      if (isi) solusiPer.set(a.ticket_id, isi.slice(0, 400));
    }
  }

  const techNote = ((notes ?? []) as { id: string; title: string; description: string | null; product: string | null; tags: string[] | null }[])
    .map(n => ({ n, cocok: skor(`${n.title} ${n.description ?? ''} ${n.product ?? ''} ${(n.tags ?? []).join(' ')}`.toLowerCase()) }))
    .filter(x => x.cocok.length > 0)
    .sort((a, b) => b.cocok.length - a.cocok.length)
    .slice(0, 3)
    .map(({ n, cocok }) => ({ id: n.id, title: n.title, product: n.product, cocok }));

  return {
    kata,
    tiket: tiket.map(({ t, cocok }) => ({
      id: t.id, project_name: t.project_name, issue_case: t.issue_case, product: t.product,
      assign_name: t.assign_name, tanggal: (t.updated_at ?? t.created_at).slice(0, 10), cocok,
      solusi: solusiPer.get(t.id) ?? null,
    })),
    techNote,
  };
}
