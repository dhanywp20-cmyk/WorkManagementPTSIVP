/**
 * summary-project.ts - data untuk menu "Summary Project".
 *
 * Menggabungkan riwayat 4 tabel (reminders/tickets/project_requests/
 * form_reviews) per NAMA project - platform ini tidak punya tabel master
 * "Project", jadi pengelompokannya murni by project_name yang dinormalisasi,
 * dengan pengecualian manual lewat project_summary_links (lihat migrasi
 * 013) untuk record yang label project_name-nya beda ketik/belum nyambung.
 *
 * Scoping akses (siapa boleh lihat project siapa) memakai ulang
 * lib/project-scope.ts - SAMA PERSIS aturan yang sudah dipakai GlobalSearch,
 * bukan aturan baru.
 */

import { supabase } from './supabase';
import { hitungLingkupProject, filterLingkup, type LingkupProject } from './project-scope';

export { hitungLingkupProject };
export type { LingkupProject };

export type SourceTable = 'reminders' | 'tickets' | 'project_requests' | 'form_reviews';

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
}

export interface RingkasanProject {
  /** Kunci pengelompokan - nama yang sudah dinormalisasi, JANGAN ditampilkan apa adanya. */
  canonical: string;
  /** Nama untuk ditampilkan ke user (casing/spasi asli, atau nama kanonik hasil link manual). */
  display: string;
  jumlah: { reminders: number; tickets: number; requests: number; reviews: number };
}

interface OverrideRow { source_table: SourceTable; source_id: string; canonical_project_name: string }

export function normalisasiNamaProject(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function ambilOverride(): Promise<OverrideRow[]> {
  // Tabelnya kecil (isinya cuma pengecualian yang sengaja dibuat admin) -
  // aman diambil utuh sekali per pemanggilan, tidak perlu paginasi.
  const { data, error } = await supabase.from('project_summary_links')
    .select('source_table, source_id, canonical_project_name');
  if (error) { console.warn('[summary-project] gagal memuat override:', error.message); return []; }
  return (data ?? []) as OverrideRow[];
}

/** `.or()` PostgREST untuk lingkup, atau tidak dipasang sama sekali bila `lingkup.semua`. */
function pasangLingkup<T extends { or: (s: string) => T }>(
  q: T, lingkup: LingkupProject, kolomNama: string, kolomDivisi = 'sales_division',
): T {
  if (lingkup.semua) return q;
  const filter = filterLingkup(lingkup, kolomNama, kolomDivisi);
  return filter ? q.or(filter) : q;
}

const KOLOM_JUMLAH: Record<SourceTable, keyof RingkasanProject['jumlah']> = {
  reminders: 'reminders', tickets: 'tickets', project_requests: 'requests', form_reviews: 'reviews',
};

/**
 * Cari project by nama - dipakai search box halaman Summary Project.
 *
 * Query kosong -> "Project Terbaru" dari reminders (bukan kosong melompong).
 */
export async function cariProject(q: string, lingkup: LingkupProject, limit = 15): Promise<RingkasanProject[]> {
  const query = q.trim();
  const overrides = await ambilOverride();
  const overrideByKey = new Map(overrides.map(o => [`${o.source_table}:${o.source_id}`, o]));

  type Kandidat = { table: SourceTable; id: string; project_name: string | null };
  const kandidat: Kandidat[] = [];
  const seen = new Set<string>();
  const tambah = (table: SourceTable, id: string, project_name: string | null) => {
    const key = `${table}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    kandidat.push({ table, id, project_name });
  };

  if (!query) {
    // Project Terbaru: seed dari reminders yang paling baru jatuh temponya.
    let qr = supabase.from('reminders').select('id, project_name, sales_name, sales_division')
      .order('due_date', { ascending: false }).limit(limit * 4);
    qr = pasangLingkup(qr, lingkup, 'sales_name');
    const { data } = await qr;
    (data ?? []).forEach((r: { id: string; project_name: string }) => tambah('reminders', r.id, r.project_name));
  } else {
    let qr = supabase.from('reminders').select('id, project_name, sales_name, sales_division')
      .ilike('project_name', `%${query}%`).limit(30);
    qr = pasangLingkup(qr, lingkup, 'sales_name');
    let qt = supabase.from('tickets').select('id, project_name, sales_name, sales_division, created_by')
      .ilike('project_name', `%${query}%`).limit(30);
    qt = pasangLingkup(qt, lingkup, 'sales_name');
    let qp = supabase.from('project_requests').select('id, project_name, sales_name, sales_division')
      .ilike('project_name', `%${query}%`).limit(30);
    qp = pasangLingkup(qp, lingkup, 'sales_name');
    let qf = supabase.from('form_reviews').select('id, project_name, sales_name, sales_division')
      .ilike('project_name', `%${query}%`).limit(30);
    qf = pasangLingkup(qf, lingkup, 'sales_name');

    const [rRes, tRes, pRes, fRes] = await Promise.all([qr, qt, qp, qf]);
    (rRes.data ?? []).forEach((r: { id: string; project_name: string }) => tambah('reminders', r.id, r.project_name));
    (tRes.data ?? []).forEach((r: { id: string; project_name: string }) => tambah('tickets', r.id, r.project_name));
    (pRes.data ?? []).forEach((r: { id: string; project_name: string }) => tambah('project_requests', r.id, r.project_name));
    (fRes.data ?? []).forEach((r: { id: string; project_name: string }) => tambah('form_reviews', r.id, r.project_name));

    // Override yang nama kanoniknya cocok kata kunci - menutup kasus record
    // yang project_name ASLI-nya tidak mengandung kata kunci sama sekali
    // (justru itulah alasan record itu di-link manual).
    const normQ = normalisasiNamaProject(query);
    for (const o of overrides) {
      if (normalisasiNamaProject(o.canonical_project_name).includes(normQ)) {
        tambah(o.source_table, o.source_id, null);
      }
    }
  }

  const map = new Map<string, RingkasanProject>();
  for (const k of kandidat) {
    const ov = overrideByKey.get(`${k.table}:${k.id}`);
    const namaAsli = ov ? ov.canonical_project_name : (k.project_name ?? '');
    const canonical = normalisasiNamaProject(namaAsli);
    if (!canonical) continue;
    const entry = map.get(canonical) ?? { canonical, display: namaAsli, jumlah: { reminders: 0, tickets: 0, requests: 0, reviews: 0 } };
    entry.jumlah[KOLOM_JUMLAH[k.table]] += 1;
    map.set(canonical, entry);
  }
  return [...map.values()].sort((a, b) => a.display.localeCompare(b.display, 'id')).slice(0, limit);
}

/**
 * Ambil SELURUH riwayat 4 tabel untuk satu project.
 *
 * @param canonical    kunci hasil normalisasi (dari RingkasanProject.canonical)
 * @param namaUntukCari nama tampilan (RingkasanProject.display) - dipakai jaring
 *                       ilike awal supaya query tidak menyisir seluruh tabel.
 */
export async function ambilDetailProject(
  canonical: string, namaUntukCari: string, lingkup: LingkupProject,
): Promise<DetailProject> {
  const overrides = await ambilOverride();
  const targetOf = (table: SourceTable, id: string) => {
    const o = overrides.find(x => x.source_table === table && x.source_id === id);
    return o ? normalisasiNamaProject(o.canonical_project_name) : null;
  };
  const idsIkutLewatOverride = (table: SourceTable) => overrides
    .filter(o => o.source_table === table && normalisasiNamaProject(o.canonical_project_name) === canonical)
    .map(o => o.source_id);

  async function ambil<T extends { id: string; project_name?: string | null }>(
    table: SourceTable, kolom: string,
  ): Promise<T[]> {
    let q1 = supabase.from(table).select(kolom).ilike('project_name', `%${namaUntukCari}%`).limit(100);
    q1 = pasangLingkup(q1, lingkup, 'sales_name');
    const idsOverride = idsIkutLewatOverride(table);
    const q2 = idsOverride.length
      ? pasangLingkup(supabase.from(table).select(kolom).in('id', idsOverride), lingkup, 'sales_name')
      : null;
    const [r1, r2] = await Promise.all([q1, q2 ?? Promise.resolve({ data: [] as T[] })]);
    const gabung = [...((r1.data ?? []) as unknown as T[]), ...((r2?.data ?? []) as unknown as T[])];
    const seen = new Set<string>();
    return gabung.filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      // Buang baris yang JUSTRU di-override ke project LAIN - jaring ilike
      // di atas cuma cocok teks, override tetap berhak mengeluarkannya dari
      // sini walau teksnya kebetulan mirip.
      const target = targetOf(table, row.id);
      if (target !== null && target !== canonical) return false;
      if (target === null && normalisasiNamaProject(row.project_name ?? '') !== canonical) return false;
      return true;
    });
  }

  const [reminders, tickets, requests, reviews] = await Promise.all([
    ambil<ReminderRingkas>('reminders',
      'id, project_name, category, mode_penyelesaian, due_date, bast_date, status, assign_name, address'),
    ambil<TicketRingkas>('tickets',
      'id, project_name, issue_case, description, status, date, assign_name'),
    ambil<RequestRingkas>('project_requests',
      'id, project_name, status, requester_name, due_date, assigned_handler'),
    ambil<ReviewRingkas>('form_reviews',
      'id, project_name, reminder_id, review_category, guest_fullname, grade_product_knowledge, grade_training_customer, grade_product_knowledge_bast'),
  ]);

  // Form Review kadang project_name-nya kosong (kolom nullable) - tangkap
  // lewat reminder_id yang SUDAH ketemu di seksi Request Schedule di atas,
  // supaya review tetap tampil walau kolom project_name-nya tidak terisi.
  const reminderIds = new Set(reminders.map(r => r.id));
  if (reminderIds.size) {
    let qExtra = supabase.from('form_reviews')
      .select('id, project_name, reminder_id, review_category, guest_fullname, grade_product_knowledge, grade_training_customer, grade_product_knowledge_bast')
      .in('reminder_id', [...reminderIds]);
    qExtra = pasangLingkup(qExtra, lingkup, 'sales_name');
    const { data } = await qExtra;
    const known = new Set(reviews.map(r => r.id));
    for (const row of (data ?? []) as unknown as ReviewRingkas[]) {
      if (!known.has(row.id)) { reviews.push(row); known.add(row.id); }
    }
  }

  return { reminders, tickets, requests, reviews };
}
