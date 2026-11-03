
interface Isi { waktu: number; janji: Promise<unknown> }

const simpanan = new Map<string, Isi>();

export const UMUR_RUJUKAN = 5 * 60_000;

export function ingat<F extends () => PromiseLike<unknown>>(kunci: string, ambil: F, umurMs = UMUR_RUJUKAN): Promise<Awaited<ReturnType<F>>> {
  type T = Awaited<ReturnType<F>>;
  const ada = simpanan.get(kunci);
  if (ada && Date.now() - ada.waktu < umurMs) return ada.janji as Promise<T>;
  const janji = Promise.resolve(ambil() as PromiseLike<T>).then(hasil => {
    if ((hasil as { error?: unknown } | null)?.error) simpanan.delete(kunci);
    return hasil;
  }, galat => { simpanan.delete(kunci); throw galat; });
  simpanan.set(kunci, { waktu: Date.now(), janji });
  return janji;
}

export function lupakan(awalan = ''): void {
  for (const k of Array.from(simpanan.keys())) if (k.startsWith(awalan)) simpanan.delete(k);
}
