
const POLA = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function galatBerkasTidakTermuat(e: { name?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return POLA.test(`${e.name ?? ''} ${e.message ?? ''}`);
}

export const KUNCI_MUAT_ULANG = 'galat-berkas-muat-ulang';

export const JEDA_MUAT_ULANG_MS = 60_000;

export function bolehMuatUlang(terakhir: string | null, kini: number): boolean {
  const t = Number(terakhir);
  return !terakhir || !Number.isFinite(t) || kini - t > JEDA_MUAT_ULANG_MS;
}
