
export interface SoalTerurut {
  id: string;
  urutan?: number | null;
  created_at?: string;
}

export function bandingkanUrutan(a: SoalTerurut, b: SoalTerurut): number {
  const ua = a.urutan ?? null;
  const ub = b.urutan ?? null;
  if (ua !== null && ub !== null && ua !== ub) return ua - ub;
  if (ua !== null && ub === null) return -1;
  if (ua === null && ub !== null) return 1;
  return (b.created_at ?? '').localeCompare(a.created_at ?? '');
}

export function perubahanUrutan(susunanBaru: SoalTerurut[]): { id: string; urutan: number }[] {
  return susunanBaru
    .map((q, i) => ({ id: q.id, urutan: i + 1, lama: q.urutan ?? null }))
    .filter(x => x.lama !== x.urutan)
    .map(({ id, urutan }) => ({ id, urutan }));
}

export function geser<T extends SoalTerurut>(daftar: T[], idx: number, arah: -1 | 1): T[] | null {
  const tujuan = idx + arah;
  if (idx < 0 || idx >= daftar.length) return null;
  if (tujuan < 0 || tujuan >= daftar.length) return null;
  const baru = [...daftar];
  [baru[idx], baru[tujuan]] = [baru[tujuan], baru[idx]];
  return baru;
}

export function nomorBerikutnya(grup: SoalTerurut[]): number {
  return Math.max(0, ...grup.map(q => q.urutan ?? 0)) + 1;
}
