export const PEMISAH_PILIHAN = '␟';

export function uraiPilihan(nilai: string | null | undefined, kosong = 'all'): string[] {
  if (!nilai || nilai === kosong) return [];
  return nilai.split(PEMISAH_PILIHAN).filter(Boolean);
}

export function gabungPilihan(daftar: readonly string[], kosong = 'all'): string {
  return daftar.length ? daftar.join(PEMISAH_PILIHAN) : kosong;
}

export function tukarPilihanTeks(nilai: string | null | undefined, label: string, kosong = 'all'): string {
  const daftar = uraiPilihan(nilai, kosong);
  return gabungPilihan(daftar.includes(label) ? daftar.filter(x => x !== label) : [...daftar, label], kosong);
}

export function cocokPilihan(nilai: string | null | undefined, isi: string | null | undefined, kosong = 'all'): boolean {
  const daftar = uraiPilihan(nilai, kosong);
  return daftar.length === 0 || daftar.includes(isi ?? '');
}

export function teksPilihan(nilai: string | null | undefined, kosong = 'all'): string {
  return uraiPilihan(nilai, kosong).join(', ');
}

export function banyakPilihan(nilai: string | null | undefined): boolean {
  return !!nilai && nilai.includes(PEMISAH_PILIHAN);
}
