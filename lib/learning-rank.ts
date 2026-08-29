/**
 * lib/learning-rank.ts - peringkat quiz seseorang, DAN klien tipis untuk
 * memanggilnya lewat /api/learning-center/rank.
 *
 * `hitungPeringkat` murni (tanpa Supabase/React) supaya bisa diuji langsung
 * dengan data tiruan - lihat uji/peringkat-quiz.ts. Route handler-nya sendiri
 * (app/api/learning-center/rank/route.ts) hanya menarik baris dari DB lalu
 * memanggil fungsi ini; `ambilPeringkatSaya` dipakai kartu dashboard dan
 * ScorePage.tsx supaya bentuk datanya - dan cara gagalnya - sama persis di
 * keduanya.
 */

export interface BarisAttempt {
  user_id: string;
  score: number | null;
  grading_status: string | null;
  role: string | null;
  sales_division: string | null;
}

export interface HasilPeringkat {
  role: string;
  globalRank: number | null;
  globalTotal: number;
  divisi: string | null;
  divisiRank: number | null;
  divisiTotal: number;
}

/**
 * Hitung peringkat SATU pemanggil dari seluruh baris attempt yang sudah
 * submit. Peer group = role yang SAMA PERSIS ('guest' tidak digabung dengan
 * 'sales') - menyamai konvensi lama ScorePage ("Top Performers — Guest").
 */
export function hitungPeringkat(
  rows: BarisAttempt[],
  caller: { id: string; role: string | null; sales_division: string | null },
): HasilPeringkat {
  const myRole = (caller.role ?? '').toLowerCase();

  const perOrang = new Map<string, { role: string; divisi: string | null; total: number; jumlah: number }>();
  for (const a of rows) {
    if (a.grading_status === 'pending_review') continue;   // belum dinilai final
    if (!a.role) continue;                                  // baris yatim - user tidak ditemukan
    const rec = perOrang.get(a.user_id)
      ?? { role: a.role.toLowerCase(), divisi: a.sales_division, total: 0, jumlah: 0 };
    rec.total += a.score ?? 0;
    rec.jumlah += 1;
    perOrang.set(a.user_id, rec);
  }

  const sekelompok = [...perOrang.entries()]
    .filter(([, r]) => r.role === myRole)
    .map(([userId, r]) => ({ userId, avg: r.total / r.jumlah, divisi: r.divisi }))
    .sort((a, b) => b.avg - a.avg);

  const globalIdx = sekelompok.findIndex(p => p.userId === caller.id);
  const globalRank = globalIdx >= 0 ? globalIdx + 1 : null;
  const globalTotal = sekelompok.length;

  let divisiRank: number | null = null;
  let divisiTotal = 0;
  if (caller.sales_division) {
    const sedivisi = sekelompok.filter(p => p.divisi === caller.sales_division);
    const idx = sedivisi.findIndex(p => p.userId === caller.id);
    divisiRank = idx >= 0 ? idx + 1 : null;
    divisiTotal = sedivisi.length;
  }

  return { role: myRole, globalRank, globalTotal, divisi: caller.sales_division, divisiRank, divisiTotal };
}

export async function ambilPeringkatSaya(): Promise<HasilPeringkat | null> {
  try {
    const res = await fetch('/api/learning-center/rank', { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as HasilPeringkat;
  } catch {
    return null;
  }
}
