/**
 * summary-project.ts - data untuk menu "Summary Project" (Project 360, fase 2).
 *
 * Tulang punggungnya PEMETAAN YANG TERSIMPAN, bukan pencocokan nama:
 *   - public.projects             master project (kode PRJ-0001, dst)
 *   - public.project_source_links record reminders/tickets/project_requests/
 *                                 form_reviews -> project_id (atau 'ignored')
 *   - public.v_project_summary    jumlah aktivitas per project (security_invoker)
 * Lihat supabase/migrations/014_project_360.sql.
 *
 * Nama project hanya dipakai sebagai SARAN di Mapping Center (RPC
 * saran_project, trigram) - pengecekan data nyata menunjukkan dari 221 nama
 * unik hanya segelintir yang sama persis antar modul, jadi menggabungkan
 * otomatis by nama akan salah lebih sering daripada benar.
 *
 * Form Review sengaja tidak pernah dipetakan sendiri: ia selalu terikat ke
 * satu reminder lewat reminder_id, jadi ikut project reminder-nya.
 *
 * Scoping akses memakai ulang lib/project-scope.ts - aturan yang sama dengan
 * GlobalSearch, diterapkan ke daftar project (kolom sales_name/sales_division
 * milik projects) dan ke setiap tabel sumber saat detail dibuka.
 */

import { supabase } from './supabase';
import { hitungLingkupProject, filterLingkup, type LingkupProject } from './project-scope';

export { hitungLingkupProject };
export type { LingkupProject };

export type SourceModule = 'reminders' | 'tickets' | 'project_requests' | 'form_reviews';
/** Modul yang dipetakan langsung di Mapping Center (form_reviews ikut reminder-nya). */
export type ModulTerpeta = Exclude<SourceModule, 'form_reviews'>;

export interface ReminderRingkas {
  id: string; project_name: string; category: string; mode_penyelesaian: string | null;
  due_date: string; bast_date: string | null; status: string; assign_name: string; address: string | null;
}
export interface TicketRingkas {
  id: string; project_name: string; issue_case: string; description: string | null;
  status: string; date: string | null; assign_name: string;
}
export interface RequestRingkas {
  id: string; project_name: string; status: string; requester_name: string;
  due_date: string | null; assigned_handler: string | null;
}
export interface ReviewRingkas {
  id: string; project_name: string | null; reminder_id: string; review_category: string | null;
  guest_fullname: string; grade_product_knowledge: number | null;
  grade_training_customer: number | null; grade_product_knowledge_bast: number | null;
}

export interface DetailProject {
  reminders: ReminderRingkas[];
  tickets: TicketRingkas[];
  requests: RequestRingkas[];
  reviews: ReviewRingkas[];
  /** `${module}:${record_id}` -> id baris project_source_links (untuk lepas link). */
  linkId: Record<string, string>;
}

/** Satu baris v_project_summary. */
export interface RingkasanProject {
  project_id: string; code: string; name: string;
  customer: string | null; location: string | null;
  sales_name: string | null; sales_division: string | null;
  status: 'active' | 'done' | 'archived'; created_at: string;
  schedule_count: number; ticket_count: number; design_count: number; review_count: number;
  total_activity: number; last_activity: string | null;
}

export function normalisasiNamaProject(s: string): string {
  // Harus sama persis dengan public.norm_nama_project() di basis data.
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** `.or()` PostgREST untuk lingkup, atau tidak dipasang sama sekali bila `lingkup.semua`. */
function pasangLingkup<T extends { or: (s: string) => T }>(
  q: T, lingkup: LingkupProject, kolomNama: string, kolomDivisi = 'sales_division',
): T {
  if (lingkup.semua) return q;
  const filter = filterLingkup(lingkup, kolomNama, kolomDivisi);
  return filter ? q.or(filter) : q;
}

/** Karakter yang punya arti di sintaks .or()/ilike PostgREST dibuang dari kata kunci. */
const bersihkanKataKunci = (q: string) => q.replace(/[%,()*\\"]/g, ' ').trim();

// ── Daftar & detail ────────────────────────────────────────────────────────

/**
 * Seluruh project yang boleh dilihat user (v_project_summary), aktivitas
 * terbaru dulu. Penyaringan & paginasi dilakukan di halaman - jumlahnya
 * ratusan, bukan ribuan, jadi satu kali ambil lebih cepat dirasakan
 * daripada query ulang tiap ketikan.
 */
export async function daftarProject(lingkup: LingkupProject): Promise<RingkasanProject[]> {
  let query = supabase.from('v_project_summary').select('*')
    .order('last_activity', { ascending: false, nullsFirst: false })
    .limit(3000);
  query = pasangLingkup(query, lingkup, 'sales_name');
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as RingkasanProject[];
}

/** Cari project untuk dipilih (pindah record / gabung project / Mapping Center). */
export async function cariProjectUntukPilih(kata: string, kecuali?: string): Promise<SaranProject[]> {
  const k = bersihkanKataKunci(kata);
  if (!k) return [];
  let q = supabase.from('projects').select('id, code, name, location, sales_name')
    .or(`name.ilike.%${k}%,code.ilike.%${k}%`).neq('status', 'archived').order('name').limit(10);
  if (kecuali) q = q.neq('id', kecuali);
  const { data } = await q;
  return ((data ?? []) as { id: string; code: string; name: string; location: string | null; sales_name: string | null }[])
    .map(p => ({ project_id: p.id, code: p.code, name: p.name, location: p.location, sales_name: p.sales_name, skor: 0 }));
}

const KOLOM_DETAIL: Record<SourceModule, string> = {
  reminders: 'id, project_name, category, mode_penyelesaian, due_date, bast_date, status, assign_name, address',
  tickets: 'id, project_name, issue_case, description, status, date, assign_name',
  project_requests: 'id, project_name, status, requester_name, due_date, assigned_handler',
  form_reviews: 'id, project_name, reminder_id, review_category, guest_fullname, grade_product_knowledge, grade_training_customer, grade_product_knowledge_bast',
};

/** Seluruh riwayat satu project, dari record yang dipetakan ke project itu. */
export async function ambilDetailProject(projectId: string, lingkup: LingkupProject): Promise<DetailProject> {
  const { data: links } = await supabase.from('project_source_links')
    .select('id, source_module, source_record_id').eq('project_id', projectId);
  const linkId: Record<string, string> = {};
  const ids: Record<SourceModule, string[]> = { reminders: [], tickets: [], project_requests: [], form_reviews: [] };
  for (const l of (links ?? []) as { id: string; source_module: SourceModule; source_record_id: string }[]) {
    ids[l.source_module].push(l.source_record_id);
    linkId[`${l.source_module}:${l.source_record_id}`] = l.id;
  }

  async function ambil<T>(modul: SourceModule, daftarId: string[]): Promise<T[]> {
    if (!daftarId.length) return [];
    let q = supabase.from(modul).select(KOLOM_DETAIL[modul]).in('id', daftarId);
    if (modul !== 'form_reviews') q = q.or('is_deleted.is.null,is_deleted.eq.false');
    q = pasangLingkup(q, lingkup, 'sales_name');
    const { data } = await q;
    return (data ?? []) as unknown as T[];
  }

  const [reminders, tickets, requests, reviewsLangsung] = await Promise.all([
    ambil<ReminderRingkas>('reminders', ids.reminders),
    ambil<TicketRingkas>('tickets', ids.tickets),
    ambil<RequestRingkas>('project_requests', ids.project_requests),
    ambil<ReviewRingkas>('form_reviews', ids.form_reviews),
  ]);

  // Form Review ikut project reminder-nya.
  const reviews = [...reviewsLangsung];
  if (reminders.length) {
    let q = supabase.from('form_reviews').select(KOLOM_DETAIL.form_reviews)
      .in('reminder_id', reminders.map(r => r.id));
    q = pasangLingkup(q, lingkup, 'sales_name');
    const { data } = await q;
    const dikenal = new Set(reviews.map(r => r.id));
    for (const r of (data ?? []) as unknown as ReviewRingkas[]) if (!dikenal.has(r.id)) reviews.push(r);
  }

  return { reminders, tickets, requests, reviews, linkId };
}

// ── Mapping Center (admin) ─────────────────────────────────────────────────

export interface RecordBelumTerpeta {
  source_module: ModulTerpeta; source_record_id: string;
  project_name: string; info: string; tanggal: string | null;
}

/** Record yang belum terpeta, dikelompokkan per nama yang dinormalisasi. */
export interface GrupAntrean {
  kunci: string; nama: string; records: RecordBelumTerpeta[];
}

export interface SaranProject {
  project_id: string; code: string; name: string;
  location: string | null; sales_name: string | null; skor: number;
}

export interface StatistikMapping {
  auto_mapped: number; manual_mapped: number; diabaikan: number;
  belum_terpeta: number; total_project: number;
}

export async function ambilStatistikMapping(): Promise<StatistikMapping | null> {
  const { data, error } = await supabase.rpc('ringkasan_mapping');
  if (error) { console.warn('[summary-project] ringkasan_mapping:', error.message); return null; }
  const row = (Array.isArray(data) ? data[0] : data) as StatistikMapping | undefined;
  return row ?? null;
}

export async function ambilAntrean(limit = 500): Promise<GrupAntrean[]> {
  const { data, error } = await supabase.rpc('record_belum_terpeta', { p_limit: limit });
  if (error) throw new Error(error.message);
  const grup = new Map<string, GrupAntrean>();
  for (const r of (data ?? []) as RecordBelumTerpeta[]) {
    const kunci = normalisasiNamaProject(r.project_name);
    const g = grup.get(kunci) ?? { kunci, nama: r.project_name.trim(), records: [] };
    g.records.push(r);
    grup.set(kunci, g);
  }
  // Grup terbesar dulu: satu keputusan di sana membereskan paling banyak record.
  return [...grup.values()].sort((a, b) => b.records.length - a.records.length || a.nama.localeCompare(b.nama, 'id'));
}

export async function saranProject(nama: string, limit = 5): Promise<SaranProject[]> {
  const { data, error } = await supabase.rpc('saran_project', { p_nama: nama, p_limit: limit });
  if (error) { console.warn('[summary-project] saran_project:', error.message); return []; }
  return (data ?? []) as SaranProject[];
}

type RecordKunci = Pick<RecordBelumTerpeta, 'source_module' | 'source_record_id'>;

async function simpanLinks(
  records: RecordKunci[], projectId: string | null,
  jenis: 'auto' | 'manual' | 'ignored', oleh: string, alasan: string,
): Promise<void> {
  if (!records.length) return;
  const { error } = await supabase.from('project_source_links').upsert(
    records.map(r => ({
      source_module: r.source_module, source_record_id: r.source_record_id,
      project_id: projectId, mapping_type: jenis,
      confidence: jenis === 'auto' ? 1 : null, match_reason: alasan,
      mapped_by: oleh, mapped_at: new Date().toISOString(),
    })),
    { onConflict: 'source_module,source_record_id' },
  );
  if (error) throw new Error(error.message);
}

export function petakanKeProject(records: RecordKunci[], projectId: string, oleh: string) {
  return simpanLinks(records, projectId, 'manual', oleh, 'dipilih admin di Mapping Center');
}

export function abaikanRecord(records: RecordKunci[], oleh: string) {
  return simpanLinks(records, null, 'ignored', oleh, 'ditandai tanpa project');
}

/** Pindahkan satu record ke project lain (koreksi pemetaan otomatis). */
export async function pindahkanLink(linkId: string, projectId: string, oleh: string): Promise<void> {
  const { error } = await supabase.from('project_source_links').update({
    project_id: projectId, mapping_type: 'manual', confidence: null,
    match_reason: 'dipindah admin', mapped_by: oleh, mapped_at: new Date().toISOString(),
  }).eq('id', linkId);
  if (error) throw new Error(error.message);
}

/**
 * Gabungkan project duplikat (mis. beda ketik yang dibuat terpisah oleh
 * pemetaan otomatis): semua record `asal` pindah ke `tujuan`, lalu `asal`
 * dihapus. Record yang dipindah bertanda 'manual' supaya tidak dihitung
 * ulang oleh trigger saat namanya diubah nanti.
 */
export async function gabungkanProject(asal: string, tujuan: string, oleh: string): Promise<void> {
  // Lewat RPC supaya pindah-link + hapus-project terjadi dalam SATU transaksi.
  const { error } = await supabase.rpc('gabungkan_project', { p_asal: asal, p_tujuan: tujuan, p_oleh: oleh });
  if (error) throw new Error(error.message);
}

export interface KandidatDuplikat {
  a_id: string; a_code: string; a_name: string; a_total: number;
  b_id: string; b_code: string; b_name: string; b_total: number; skor: number;
}

/** Pasangan project bernama mirip - kemungkinan beda ketik dari pemetaan otomatis. */
export async function ambilKandidatDuplikat(ambang = 0.5): Promise<KandidatDuplikat[]> {
  const { data, error } = await supabase.rpc('kandidat_duplikat_project', { p_ambang: ambang, p_limit: 200 });
  if (error) throw new Error(error.message);
  return (data ?? []) as KandidatDuplikat[];
}

export async function lepasLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('project_source_links').delete().eq('id', linkId);
  if (error) throw new Error(error.message);
}

/**
 * Buat project baru dari satu grup antrean lalu petakan seluruh record-nya.
 * Sales & lokasi diambil dari record pertama yang punya isian - admin bisa
 * mengubahnya nanti, tapi daftar project tanpa pemilik tidak akan terlihat
 * oleh akun Sales (lihat filterLingkup).
 */
export async function buatProjectDariGrup(
  nama: string, records: RecordKunci[], oleh: string,
): Promise<string> {
  const pemilik = await tebakPemilik(records);
  const { data, error } = await supabase.from('projects').insert({
    name: nama.trim(), created_by: oleh, ...pemilik,
  }).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'Gagal membuat project');
  await simpanLinks(records, data.id, 'manual', oleh, 'project dibuat dari grup nama');
  return data.id as string;
}

async function tebakPemilik(records: RecordKunci[]) {
  const kolomLokasi: Record<ModulTerpeta, string> = {
    reminders: 'address', tickets: 'address', project_requests: 'project_location',
  };
  for (const modul of ['reminders', 'project_requests', 'tickets'] as ModulTerpeta[]) {
    const idModul = records.filter(r => r.source_module === modul).map(r => r.source_record_id);
    if (!idModul.length) continue;
    const { data } = await supabase.from(modul)
      .select(`sales_name, sales_division, ${kolomLokasi[modul]}`).in('id', idModul).limit(20);
    const baris = ((data ?? []) as unknown as Record<string, string | null>[]).find(b => b.sales_name);
    if (baris) {
      return {
        sales_name: baris.sales_name, sales_division: baris.sales_division ?? null,
        location: baris[kolomLokasi[modul]] ?? null,
      };
    }
  }
  return {};
}

// Pemetaan nama-persis kini dikerjakan trigger basis data (migrasi 015) saat
// record dibuat/diubah namanya. Tombol "Auto nama persis" di Mapping Center
// dihapus: antrean yang tersisa justru record yang SENGAJA dilepas admin atau
// yang ambigu, dan tombol itu memetakan ulang record yang baru ditolak admin.

export async function ubahProject(
  id: string, isian: Partial<Pick<RingkasanProject, 'name' | 'customer' | 'location' | 'sales_name' | 'sales_division' | 'status'>>,
): Promise<void> {
  const { error } = await supabase.from('projects')
    .update({ ...isian, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
