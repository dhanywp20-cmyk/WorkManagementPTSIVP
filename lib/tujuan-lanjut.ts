export function tujuanLanjutAman(nilai: string | null | undefined): string | null {
  if (!nilai) return null;
  const t = nilai.trim();
  if (!t.startsWith('/') || t.startsWith('//') || t.startsWith('/\\')) return null;
  if (/^\/(api|_next)(\/|$)/.test(t)) return null;
  if (/[\u0000-\u001f]/.test(t)) return null;
  try {
    const u = new URL(t, 'https://contoh.invalid');
    if (u.origin !== 'https://contoh.invalid') return null;
    const hasil = u.pathname + u.search + u.hash;
    return hasil === '/dashboard' ? null : hasil;
  } catch { return null; }
}
