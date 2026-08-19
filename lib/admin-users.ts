/**
 * lib/admin-users.ts - pemanggil /api/admin/users dari klien.
 *
 * Operasi yang menyentuh kolom hak akses (role, team_type, allow_incentive_input,
 * allowed_menus) WAJIB lewat sini - kolom itu dibekukan untuk anon oleh trigger DB
 * (sql/lock-users-privileged-columns.sql). Route server memverifikasi admin lalu
 * menulis pakai service-role. Mengembalikan { error? } seperti pola supabase.
 */

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

/** Buat user baru (kolom hak akses di-set di server). Mengembalikan id baru. */
export async function adminCreateUser(payload: Record<string, unknown>): Promise<{ id?: string; error: { message: string } | null }> {
  const { data, error } = await call({ action: 'create', payload });
  return { id: data?.id, error };
}

/** Update field user (termasuk role/team_type/allowed_menus). */
export async function adminUpdateUser(userId: string, payload: Record<string, unknown>): Promise<Res> {
  return call({ action: 'update', userId, payload });
}

/** Set izin input nominal incentive. */
export async function adminSetIncentiveInput(userId: string, value: boolean): Promise<Res> {
  return call({ action: 'setIncentiveInput', userId, value });
}

/**
 * Toggle "Full Access" - akses setara admin di modul data (Piket Showroom,
 * Learning Center, KPI Team, Form Review, Ticketing, Reminder Schedule, Daily
 * Report, Unit Movement, Project Progress) untuk akun Team PTS tertentu.
 * Lihat lib/constants.ts hasFullAccess() dan sql/user-full-access-toggle.sql.
 */
export async function adminSetAccessLevel(userId: string, value: 'full' | 'guest'): Promise<Res> {
  return call({ action: 'setAccessLevel', userId, value });
}
