/**
 * lib/sertifikat.ts - aturan sertifikat Learning Center: siapa yang berhak (lulus & nilai final),
 * nomor sertifikat (tetap untuk attempt yang sama), dan isi teksnya. Murni - diuji di uji/sertifikat.ts.
 * Gambar (kanvas A4 mendatar, PNG & cetak): learning-center/_components/sertifikat.ts.
 */

export interface AttemptSertifikat {
  id: string; passed: boolean | null; is_submitted: boolean; score: number | null;
  submitted_at: string | null; grading_status?: 'auto' | 'pending_review' | 'graded' | null;
}

/** Berhak sertifikat: sudah dikirim, lulus, dan nilainya final (essay yang belum dinilai tidak). */
export const bolehSertifikat = (a: AttemptSertifikat | null | undefined): boolean =>
  !!a && a.is_submitted && a.passed === true && a.grading_status !== 'pending_review' && a.score !== null;

/** Nomor sertifikat: LC-YYYYMMDD-XXXXXX (tanggal WIB kirim + 6 karakter id attempt) - sama tiap diunduh. */
export function nomorSertifikat(a: Pick<AttemptSertifikat, 'id' | 'submitted_at'>): string {
  const t = new Date(new Date(a.submitted_at ?? 0).getTime() + 7 * 3600_000);
  const tgl = `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}`;
  return `LC-${tgl}-${a.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/** Tanggal panjang Indonesia (WIB), mis. "9 Oktober 2026". */
export function tanggalSertifikat(iso: string | null): string {
  const t = new Date(new Date(iso ?? 0).getTime() + 7 * 3600_000);
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${t.getUTCDate()} ${bulan[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

/** Potong teks panjang supaya muat satu baris sertifikat. */
export const ringkasJudul = (t: string, maks = 70) => (t.length > maks ? `${t.slice(0, maks - 1).trimEnd()}…` : t);
