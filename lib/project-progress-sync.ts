import { supabase } from './supabase';
import { logAudit } from './audit';

/**
 * lib/project-progress-sync.ts — jembatan Reminder Schedule → Project Progress.
 *
 * SATU ARAH SAJA. Nilai yang disalin adalah SNAPSHOT saat reminder dibuat.
 * Setelah itu kedua sisi berdiri sendiri: menyunting draft di Project Progress
 * tidak menulis balik ke reminder, dan menyunting reminder tidak memperbarui
 * draft. Ini disengaja — progres lapangan sering menyimpang dari rencana awal,
 * dan menimpanya otomatis akan menghapus pekerjaan admin.
 *
 * Pemetaan field (dicek langsung dari skema, bukan asumsi):
 *   reminders.project_name    ("Nama Project*")   → progress_projects.name
 *   reminders.address         ("Lokasi Project*") → progress_locations.name
 *   reminders.sales_name      → sales_name  (proyek & lokasi)
 *   reminders.sales_division  → sales_division
 *   reminders.assign_name     → progress_locations.pic
 *   reminders.due_date        → progress_locations.target_date
 *
 * Item Komponen SENGAJA dikosongkan — tidak ada komponen yang dibuat di sini.
 */

/** Kategori reminder yang memicu pembuatan draft. */
export const PROGRESS_TRIGGER_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training'] as const;

export function triggersProjectProgress(category: string | null | undefined): boolean {
  return (PROGRESS_TRIGGER_CATEGORIES as readonly string[]).includes((category ?? '').trim());
}

export interface ReminderSnapshot {
  id: string;
  project_name: string | null;
  address: string | null;
  sales_name: string | null;
  sales_division: string | null;
  assign_name: string | null;
  due_date: string | null;
  category: string | null;
}

export interface SyncActor {
  id?: string;
  full_name?: string;
}

export interface SyncOutcome {
  created: number;
  skipped: number;
  errors: string[];
}

/** Normalisasi untuk pencocokan nama proyek: rapikan spasi, abaikan besar-kecil huruf. */
function normalizeName(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Buat draft lokasi di Project Progress untuk sekumpulan reminder.
 *
 * Tahan gagal: kegagalan satu reminder tidak membatalkan yang lain, dan TIDAK
 * PERNAH melempar error. Pembuatan reminder adalah aksi utama user — integrasi
 * ini pelengkap, jadi tidak boleh menggagalkannya.
 */
export async function syncRemindersToProjectProgress(
  reminders: ReminderSnapshot[],
  actor: SyncActor,
): Promise<SyncOutcome> {
  const out: SyncOutcome = { created: 0, skipped: 0, errors: [] };

  const relevan = reminders.filter(r => triggersProjectProgress(r.category) && r.id);
  if (relevan.length === 0) return out;

  try {
    // ── Cegah draft ganda: reminder yang sudah punya lokasi dilewati ──
    const { data: sudahAda } = await supabase
      .from('progress_locations')
      .select('source_reminder_id')
      .in('source_reminder_id', relevan.map(r => r.id));
    const terpakai = new Set((sudahAda ?? []).map((r: { source_reminder_id: string }) => r.source_reminder_id));

    // ── Muat proyek yang ada sekali saja, lalu cocokkan di memori ──
    const { data: proyekAda } = await supabase
      .from('progress_projects')
      .select('id, name, sales_name, sales_division');
    const petaProyek = new Map<string, string>(); // nama ternormalisasi → id
    for (const p of (proyekAda ?? []) as { id: string; name: string }[]) {
      const key = normalizeName(p.name);
      if (key && !petaProyek.has(key)) petaProyek.set(key, p.id);
    }

    for (const r of relevan) {
      if (terpakai.has(r.id)) { out.skipped++; continue; }

      const namaProyek = (r.project_name ?? '').trim();
      const namaLokasi = (r.address ?? '').trim();
      if (!namaProyek || !namaLokasi) { out.skipped++; continue; }

      // 1) Cari proyek yang cocok; kalau tidak ada, buat baru.
      let projectId = petaProyek.get(normalizeName(namaProyek));
      let proyekBaru = false;

      if (!projectId) {
        const { data: dibuat, error: errProyek } = await supabase
          .from('progress_projects')
          .insert([{
            name: namaProyek,
            client: null,
            status: 'in_progress',
            sales_name: r.sales_name || null,
            sales_division: r.sales_division || null,
            origin: 'auto_reminder',
            source_reminder_id: r.id,
            created_by: actor.full_name ?? null,
          }])
          .select('id')
          .single();
        if (errProyek || !dibuat) {
          out.errors.push(`Proyek "${namaProyek}": ${errProyek?.message ?? 'gagal dibuat'}`);
          continue;
        }
        projectId = (dibuat as { id: string }).id;
        petaProyek.set(normalizeName(namaProyek), projectId);
        proyekBaru = true;
      }

      // 2) Urutan lokasi baru = setelah lokasi terakhir di proyek itu.
      const { count } = await supabase
        .from('progress_locations')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);

      // 3) Draft lokasi. Item Komponen sengaja TIDAK dibuat.
      const { error: errLokasi } = await supabase.from('progress_locations').insert([{
        project_id: projectId,
        name: namaLokasi,
        pic: r.assign_name || null,
        status: 'in_progress',
        progress: 0,
        sales_name: r.sales_name || null,
        sales_division: r.sales_division || null,
        target_date: r.due_date || null,
        origin: 'auto_reminder',
        source_reminder_id: r.id,
        sort_order: count ?? 0,
      }]);

      if (errLokasi) {
        // Index unik bisa menolak bila dua proses berjalan bersamaan —
        // itu justru perilaku yang diinginkan, jadi dihitung sebagai skip.
        if ((errLokasi.message ?? '').toLowerCase().includes('duplicate')) out.skipped++;
        else out.errors.push(`Lokasi "${namaLokasi}": ${errLokasi.message}`);
        continue;
      }

      out.created++;
      void logAudit({
        user_id: actor.id ?? '',
        user_name: actor.full_name ?? '',
        action: 'create',
        module: 'project-progress',
        target_id: projectId,
        target_name: `${namaProyek} — ${namaLokasi}`,
        notes: `Draft otomatis dari Reminder Schedule (kategori ${r.category})`
             + (proyekBaru ? '. Proyek baru dibuat otomatis.' : '')
             + ' Item komponen dikosongkan, diisi manual menyusul.',
      });
    }
  } catch (e) {
    // Jangan sampai integrasi menggagalkan pembuatan reminder.
    out.errors.push((e as { message?: string }).message ?? 'kesalahan tidak diketahui');
  }

  return out;
}
