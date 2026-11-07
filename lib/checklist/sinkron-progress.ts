
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
