/**
 * lib/wa.ts — Pengirim notifikasi WhatsApp terpusat (sisi klien)
 *
 * Semua modul (ticketing, form-require-project, reminder-schedule) memakai
 * helper yang sama: POST ke Supabase Edge Function `swift-responder`, yang
 * meneruskan ke gateway WA (Fonnte). Sebelumnya logika ini diduplikasi di
 * beberapa _components/shared.ts — sekarang satu sumber.
 *
 * Catatan: gagal kirim WA TIDAK boleh menggagalkan alur utama → selalu silent.
 *
 * Route server (cron escalate, forgot-password) memanggil Fonnte langsung
 * dengan token rahasia dan TIDAK lewat helper ini (transport berbeda).
 */

// Internal: POST mentah ke Edge Function swift-responder.
async function postSwift(body: Record<string, unknown>): Promise<unknown> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${supabaseUrl}/functions/v1/swift-responder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Fire-and-forget: kirim WA, abaikan hasil. Dipakai ticketing & form-require-project.
 */
export async function sendWANotif(body: Record<string, unknown>): Promise<void> {
  try {
    await postSwift(body);
  } catch {
    // silent — kegagalan WA tidak boleh memutus alur utama
  }
}

/**
 * Kirim WA dan kembalikan status. Dipakai reminder-schedule yang perlu tahu
 * apakah pengiriman sukses (untuk menampilkan feedback ke user).
 */
export async function sendWA(
  target: string,
  message: string,
  type = 'reminder_wa',
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const data = (await postSwift({ type, target, message })) as { ok?: boolean; reason?: string };
    return { ok: data?.ok === true, reason: data?.reason };
  } catch {
    return { ok: false, reason: 'network error' };
  }
}
