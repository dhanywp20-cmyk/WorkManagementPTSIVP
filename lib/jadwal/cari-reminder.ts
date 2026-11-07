import { supabase } from '../supabase';

function polaAman(q: string): string {
  return `%${q.trim().replace(/([%_\\])/g, '\\$1')}%`;
}

let titleBisaDicari: boolean | null = null;

function kolomTidakAda(pesan: string): boolean {
  return /does not exist/i.test(pesan);
}

export interface HasilCariReminder<T> {
  data: T[];
  error: { message: string } | null;
}

export async function reminderTerbaru<T = Record<string, unknown>>(
  kolom: string,
  batas: number,
  terapkanLingkup: <Q>(kueri: Q) => Q,
): Promise<HasilCariReminder<T>> {
  const { data, error } = await terapkanLingkup(
    supabase.from('reminders').select(kolom).order('created_at', { ascending: false }).limit(batas),
  );
  return { data: (data ?? []) as T[], error: error ? { message: error.message } : null };
}

export async function cariReminderByNama<T = Record<string, unknown>>(
  q: string,
  kolom: string,
  batas = 20,
  terapkanLingkup: <Q>(kueri: Q) => Q,
): Promise<HasilCariReminder<T>> {
  if (!q.trim()) return { data: [], error: null };
  const pola = polaAman(q);

  const bangun = (kolomNama: string, kolomAmbil: string) => terapkanLingkup(
    supabase
      .from('reminders')
      .select(kolomAmbil)
      .ilike(kolomNama, pola)
      .order('created_at', { ascending: false })
      .limit(batas),
  );

  const utama = await bangun('project_name', kolom);

  let barisLegacy: unknown[] = [];
  if (titleBisaDicari !== false) {
    const legacy = await bangun('title', `${kolom}, title`);
    if (legacy.error) {
      if (kolomTidakAda(legacy.error.message)) titleBisaDicari = false;
    } else {
      titleBisaDicari = true;
      barisLegacy = legacy.data ?? [];
    }
  }

  const sudah = new Set<string>();
  const unik = [...((utama.data ?? []) as unknown[]), ...barisLegacy].filter(r => {
    const id = String((r as { id?: unknown }).id ?? '');
    if (!id || sudah.has(id)) return false;
    sudah.add(id);
    return true;
  }) as T[];

  return { data: unik, error: utama.error ? { message: utama.error.message } : null };
}
