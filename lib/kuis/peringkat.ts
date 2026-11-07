
export interface BarisAttempt {
  user_id: string;
  score: number | null;
  grading_status: string | null;
  role: string | null;
  sales_division: string | null;
  attempt_id?: string | null;
  quiz_session_id?: string | null;
  full_name?: string | null;
  passed?: boolean | null;
  tab_switches?: number | null;
  time_taken_sec?: number | null;
}

export interface BarisPapan {
  rank: number;
  nama: string;
  quiz: number;
  avg: number;
  avgWaktu: number;
  lulus: number;
  flags: number;
  aku: boolean;
  disisipkan?: boolean;
  belumDinilai?: boolean;
}

export interface HasilPeringkat {
  role: string;
  globalRank: number | null;
  globalTotal: number;
  divisi: string | null;
  divisiRank: number | null;
  divisiTotal: number;
  papan: BarisPapan[];
  peringkatSesi: Record<string, { rank: number; total: number }>;
}

export const PAPAN_TERATAS = 20;

export function hitungPeringkat(
  rows: BarisAttempt[],
  caller: { id: string; role: string | null; sales_division: string | null },
): HasilPeringkat {
  const myRole = (caller.role ?? '').toLowerCase();

  const perOrang = new Map<string, {
    role: string; divisi: string | null; nama: string;
    total: number; jumlah: number; lulus: number; flags: number; waktu: number;
  }>();
  for (const a of rows) {
    if (a.grading_status === 'pending_review') continue;
    if (!a.role) continue;
    const rec = perOrang.get(a.user_id)
      ?? {
        role: a.role.toLowerCase(), divisi: a.sales_division, nama: a.full_name ?? '-',
        total: 0, jumlah: 0, lulus: 0, flags: 0, waktu: 0,
      };
    rec.total += a.score ?? 0;
    rec.jumlah += 1;
    if (a.passed) rec.lulus += 1;
    rec.flags += a.tab_switches ?? 0;
    rec.waktu += a.time_taken_sec ?? 0;
    perOrang.set(a.user_id, rec);
  }

  const terurut = [...perOrang.entries()]
    .filter(([, r]) => r.role === myRole)
    .map(([userId, r]) => ({
      userId, avg: r.total / r.jumlah, avgWaktu: r.waktu / r.jumlah, divisi: r.divisi,
      nama: r.nama, quiz: r.jumlah, lulus: r.lulus, flags: r.flags,
    }))
    .sort((a, b) => b.avg - a.avg || a.avgWaktu - b.avgWaktu || a.userId.localeCompare(b.userId));

  const sekelompok = terurut.map((p, i) => {
    const sblm = i > 0 ? terurut[i - 1] : null;
    return { ...p, peringkat: 0, seriDenganAtas: !!sblm && sblm.avg === p.avg && sblm.avgWaktu === p.avgWaktu };
  });
  let nomor = 0;
  sekelompok.forEach((p, i) => { if (!p.seriDenganAtas) nomor = i + 1; p.peringkat = nomor; });

  const globalIdx = sekelompok.findIndex(p => p.userId === caller.id);
  const globalRank = globalIdx >= 0 ? sekelompok[globalIdx].peringkat : null;
  const globalTotal = sekelompok.length;

  let divisiRank: number | null = null;
  let divisiTotal = 0;
  if (caller.sales_division) {
    const sedivisi = sekelompok.filter(p => p.divisi === caller.sales_division);
    const idx = sedivisi.findIndex(p => p.userId === caller.id);
    if (idx >= 0) {
      let n = 0;
      let rankKu = 1;
      sedivisi.forEach((p, i) => {
        const sblm = i > 0 ? sedivisi[i - 1] : null;
        if (!sblm || sblm.avg !== p.avg || sblm.avgWaktu !== p.avgWaktu) n = i + 1;
        if (i === idx) rankKu = n;
      });
      divisiRank = rankKu;
    }
    divisiTotal = sedivisi.length;
  }

  const jadiBaris = (p: typeof sekelompok[number], i: number): BarisPapan => {
    const aku = p.userId === caller.id;
    return {
      rank: p.peringkat,
      nama: aku ? p.nama : `Peserta #${i + 1}`,
      quiz: p.quiz,
      avg: Math.round(p.avg * 10) / 10,
      avgWaktu: Math.round(p.avgWaktu),
      lulus: p.lulus,
      flags: p.flags,
      aku,
    };
  };

  const papan: BarisPapan[] = sekelompok.slice(0, PAPAN_TERATAS).map(jadiBaris);

  if (globalIdx >= PAPAN_TERATAS) {
    papan.push({ ...jadiBaris(sekelompok[globalIdx], globalIdx), disisipkan: true });
  } else if (globalIdx < 0) {
    const milikku = perOrang.get(caller.id);
    papan.push(milikku
      ? {
          rank: 0, nama: milikku.nama, quiz: milikku.jumlah,
          avg: Math.round((milikku.total / milikku.jumlah) * 10) / 10,
          avgWaktu: Math.round(milikku.waktu / milikku.jumlah),
          lulus: milikku.lulus, flags: milikku.flags,
          aku: true, disisipkan: true,
        }
      : {
          rank: 0, nama: 'Kamu', quiz: 0, avg: 0, avgWaktu: 0, lulus: 0, flags: 0,
          aku: true, disisipkan: true, belumDinilai: true,
        });
  }

  const perSesi = new Map<string, BarisAttempt[]>();
  for (const a of rows) {
    if (a.grading_status === 'pending_review') continue;
    if (!a.role || !a.quiz_session_id) continue;
    if (a.role.toLowerCase() !== myRole) continue;
    const daftar = perSesi.get(a.quiz_session_id) ?? [];
    daftar.push(a);
    perSesi.set(a.quiz_session_id, daftar);
  }

  const peringkatSesi: Record<string, { rank: number; total: number }> = {};
  for (const [, daftar] of perSesi) {
    const urut = [...daftar].sort((x, y) =>
      (y.score ?? 0) - (x.score ?? 0)
      || (x.time_taken_sec ?? Infinity) - (y.time_taken_sec ?? Infinity)
      || String(x.attempt_id ?? '').localeCompare(String(y.attempt_id ?? '')));
    let nomor = 0;
    urut.forEach((a, i) => {
      const sblm = i > 0 ? urut[i - 1] : null;
      const seri = !!sblm && (sblm.score ?? 0) === (a.score ?? 0)
        && (sblm.time_taken_sec ?? null) === (a.time_taken_sec ?? null);
      if (!seri) nomor = i + 1;
      if (a.user_id === caller.id && a.attempt_id) {
        peringkatSesi[a.attempt_id] = { rank: nomor, total: urut.length };
      }
    });
  }

  return { role: myRole, globalRank, globalTotal, divisi: caller.sales_division, divisiRank, divisiTotal, papan, peringkatSesi };
}

export async function ambilPeringkatSaya(): Promise<HasilPeringkat | null> {
  try {
    const res = await fetch('/api/learning-center/rank', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as HasilPeringkat;
  } catch {
    return null;
  }
}
