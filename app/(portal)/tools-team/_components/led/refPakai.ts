import { type Hardware, kunciModul, type ModulLED } from '@/lib/av/hitung';
import { bersihkanReferensiLED, type RefLED } from '@/lib/tools-team';

export interface RefPakai { modul: ModulLED; vp: Hardware | null; kartu: Hardware | null }

export function bacaRefPakai(x: unknown): RefPakai | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !o.modul) return null;
  const r = bersihkanReferensiLED({ modul: [o.modul], kartu: o.kartu ? [o.kartu] : [], vp: o.vp ? [o.vp] : [] });
  return r ? { modul: r.modul[0], vp: r.vp[0] ?? null, kartu: r.kartu[0] ?? null } : null;
}

const pasang = <T>(daftar: T[], x: T | null, sama: (a: T) => boolean): T[] => {
  if (!x) return daftar;
  const i = daftar.findIndex(sama);
  if (i < 0) return [...daftar, x];
  return daftar.map((a, j) => (j === i ? x : a)).filter((a, j) => j <= i || !sama(a));
};

export function gabungRef(ref: RefLED, p: RefPakai | null): RefLED {
  if (!p) return ref;
  const k = kunciModul(p.modul);
  return {
    ...ref,
    modul: pasang(ref.modul, p.modul, m => kunciModul(m) === k),
    vp: pasang(ref.vp, p.vp, h => h.nama === p.vp?.nama),
    kartu: pasang(ref.kartu, p.kartu, h => h.nama === p.kartu?.nama),
  };
}
