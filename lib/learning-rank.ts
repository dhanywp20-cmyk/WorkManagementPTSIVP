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
  /** Nama asli - HANYA dipakai server; yang bukan milik pemanggil disamarkan sebelum dikirim. */
  full_name?: string | null;
  passed?: boolean | null;
  tab_switches?: number | null;
}

/**
 * Satu baris papan peringkat SESUDAH disamarkan.
 *
 * `nama` untuk peserta lain sudah diganti di SERVER jadi "Peserta #N" - bukan
 * dikirim utuh lalu ditutup blur() di CSS. Bedanya bukan kosmetik: yang kedua
 * tetap terbaca lengkap di DevTools/Network, jadi ia bukan proteksi sama
 * sekali. Angkanya (skor, jumlah quiz, lulus) sengaja tetap dikirim - itulah
 * yang membuat papan ini ada gunanya, dan tanpa nama ia tidak menunjuk siapa
 * pun.
 */
export interface BarisPapan {
  rank: number;
  nama: string;
  quiz: number;
  avg: number;
  lulus: number;
  flags: number;
  /** true = baris milik pemanggil sendiri; hanya baris ini yang bernama asli. */
  aku: boolean;
}

export interface HasilPeringkat {
  role: string;
  globalRank: number | null;
  globalTotal: number;
  divisi: string | null;
  divisiRank: number | null;
  divisiTotal: number;
  /** Papan peringkat sekelompok (role yang sama), nama peserta lain sudah disamarkan. */
  papan: BarisPapan[];
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

  const perOrang = new Map<string, {
    role: string; divisi: string | null; nama: string;
    total: number; jumlah: number; lulus: number; flags: number;
  }>();
  for (const a of rows) {
    if (a.grading_status === 'pending_review') continue;   // belum dinilai final
    if (!a.role) continue;                                  // baris yatim - user tidak ditemukan
    const rec = perOrang.get(a.user_id)
      ?? {
        role: a.role.toLowerCase(), divisi: a.sales_division, nama: a.full_name ?? '-',
        total: 0, jumlah: 0, lulus: 0, flags: 0,
      };
    rec.total += a.score ?? 0;
    rec.jumlah += 1;
    if (a.passed) rec.lulus += 1;
    rec.flags += a.tab_switches ?? 0;
    perOrang.set(a.user_id, rec);
  }

  const sekelompok = [...perOrang.entries()]
    .filter(([, r]) => r.role === myRole)
    .map(([userId, r]) => ({
      userId, avg: r.total / r.jumlah, divisi: r.divisi,
      nama: r.nama, quiz: r.jumlah, lulus: r.lulus, flags: r.flags,
    }))
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

  /*
    Penyamaran nama dilakukan DI SINI - sebelum data meninggalkan server -
    supaya tidak ada jalan mendapatkannya kembali dari sisi klien. Baris milik
    pemanggil sendiri tetap bernama asli, karena itu memang datanya sendiri
    dan ia harus bisa menemukan dirinya di papan.
  */
  const papan: BarisPapan[] = sekelompok.map((p, i) => {
    const aku = p.userId === caller.id;
    return {
      rank: i + 1,
      nama: aku ? p.nama : `Peserta #${i + 1}`,
      quiz: p.quiz,
      avg: Math.round(p.avg * 10) / 10,
      lulus: p.lulus,
      flags: p.flags,
      aku,
    };
  });

  return { role: myRole, globalRank, globalTotal, divisi: caller.sales_division, divisiRank, divisiTotal, papan };
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
