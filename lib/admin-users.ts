
type Res = { error: { message: string } | null };

async function call(body: Record<string, unknown>): Promise<{ data?: { id?: string }; error: { message: string } | null }> {
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: json.error || 'Gagal memproses.' } };
    return { data: json, error: null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

export async function adminCreateUser(payload: Record<string, unknown>): Promise<{ id?: string; error: { message: string } | null }> {
  const { data, error } = await call({ action: 'create', payload });
  return { id: data?.id, error };
}

export async function adminUpdateUser(userId: string, payload: Record<string, unknown>): Promise<Res> {
  return call({ action: 'update', userId, payload });
}

export async function adminSetAccessLevel(userId: string, value: 'full' | 'guest'): Promise<Res> {
  return call({ action: 'setAccessLevel', userId, value });
}
