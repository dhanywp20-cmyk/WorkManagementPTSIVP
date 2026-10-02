/**
 * lib/project-progress-sync.ts - jembatan Request Schedule ke Project Progress.
 *
 * SATU ARAH SAJA, dan yang disalin adalah snapshot saat reminder dibuat.
 * Sesudah itu kedua sisi berdiri sendiri: progres lapangan sering menyimpang
 * dari rencana awal, dan menimpanya otomatis akan menghapus pekerjaan admin.
 *
 * Penulisan dikerjakan server (/api/project-progress/sinkron) karena tabel
 * checklist_* hanya boleh ditulis lewat route server. Berkas ini dipakai di
 * klien (Request Schedule) maupun server (route sinkron), jadi tidak boleh
 * mengimpor apa pun yang khusus salah satu sisi.
 */

/** Kategori reminder yang memicu pembuatan checklist lokasi. */
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
  progress_start_date: string | null;
  progress_target_date: string | null;
  batch_id?: string | null;
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

/**
 * Buat checklist lokasi di Project Progress untuk sekumpulan reminder.
 *
 * Tahan gagal: TIDAK PERNAH melempar error. Pembuatan reminder adalah aksi
 * utama user - integrasi ini pelengkap, jadi tidak boleh menggagalkannya.
 * `actor` tidak dikirim: server memakai akun dari sesi.
 */
export async function syncRemindersToProjectProgress(
  reminders: ReminderSnapshot[],
  _actor?: SyncActor,
): Promise<SyncOutcome> {
  const ids = reminders.filter(r => r.id && triggersProjectProgress(r.category)).map(r => r.id);
  if (!ids.length) return { created: 0, skipped: reminders.length, errors: [] };
  try {
    const res = await fetch('/api/project-progress/sinkron', {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderIds: ids }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { created: 0, skipped: 0, errors: [json.error ?? `HTTP ${res.status}`] };
    return json as SyncOutcome;
  } catch (e) {
    return { created: 0, skipped: 0, errors: [(e as { message?: string }).message ?? 'kesalahan jaringan'] };
  }
}
