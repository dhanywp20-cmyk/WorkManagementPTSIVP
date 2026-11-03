
export interface AttemptSertifikat {
  id: string; passed: boolean | null; is_submitted: boolean; score: number | null;
  submitted_at: string | null; grading_status?: 'auto' | 'pending_review' | 'graded' | null;
}

export const bolehSertifikat = (a: AttemptSertifikat | null | undefined): boolean =>
  !!a && a.is_submitted && a.passed === true && a.grading_status !== 'pending_review' && a.score !== null;

export function nomorSertifikat(a: Pick<AttemptSertifikat, 'id' | 'submitted_at'>): string {
  const t = new Date(new Date(a.submitted_at ?? 0).getTime() + 7 * 3600_000);
  const tgl = `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}`;
  return `LC-${tgl}-${a.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function tanggalSertifikat(iso: string | null): string {
  const t = new Date(new Date(iso ?? 0).getTime() + 7 * 3600_000);
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${t.getUTCDate()} ${bulan[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

export const ringkasJudul = (t: string, maks = 70) => (t.length > maks ? `${t.slice(0, maks - 1).trimEnd()}…` : t);
