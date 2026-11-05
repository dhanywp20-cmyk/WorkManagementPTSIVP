export function isPimpinan(user: unknown): boolean {
  return !!user && (user as { pimpinan?: unknown }).pimpinan === true;
}

export async function muatIdPimpinan(
  klien: { from: (t: string) => any },   // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Set<string>> {
  try {
    const { data, error } = await klien.from('users').select('id').eq('pimpinan', true);
    if (error || !Array.isArray(data)) return new Set();
    return new Set((data as { id: string }[]).map(r => r.id));
  } catch { return new Set(); }
}

export const PESAN_HANYA_LIHAT = 'Akun pimpinan hanya bisa melihat data - tidak bisa menambah, mengubah, atau menghapus.';

export async function pimpinanDiDb(
  klien: { from: (t: string) => any },   // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await klien.from('users').select('pimpinan').eq('id', userId).maybeSingle();
    return !error && (data as { pimpinan?: unknown } | null)?.pimpinan === true;
  } catch { return false; }
}
