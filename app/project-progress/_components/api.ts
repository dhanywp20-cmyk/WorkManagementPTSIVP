/** Panggil route /api/project-progress/... dan lempar pesan galat yang bisa ditampilkan. */
export async function panggil<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store', credentials: 'include', ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Gagal (${res.status})`);
  return json as T;
}

export function pesanGalat(e: unknown, cadangan: string): string {
  return e instanceof Error ? e.message : cadangan;
}
