
export const JEDA_PERIKSA_MS = 10 * 60 * 1000;

export function perluPeriksa(tersembunyiSejak: number | null, sekarang: number, jeda = JEDA_PERIKSA_MS): boolean {
  return tersembunyiSejak !== null && sekarang - tersembunyiSejak >= jeda;
}

export function adaVersiBaru(komitHalaman: string | null | undefined, komitServer: string | null | undefined): boolean {
  const a = (komitHalaman ?? '').trim(), b = (komitServer ?? '').trim();
  return !!a && !!b && a !== b;
}
