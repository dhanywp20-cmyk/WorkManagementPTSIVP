
export interface BarisHasilProyek {
  project_name: string;
  title?: string;
  address: string;
  category: string;
  _sumber?: 'reminder' | 'ticket';
}

const rapikan = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

export function kunciProyek(r: BarisHasilProyek): string {
  return `${rapikan(r.project_name || r.title || '')}|${rapikan(r.address || '')}`;
}

export function gabungHasilProyek<T extends BarisHasilProyek>(
  jadwal: T[],
  tiket: T[],
  batas: number,
  diutamakan: (kategori: string) => boolean = () => false,
): T[] {
  const urutanProyek = new Map<string, number>();
  const sudah = new Set<string>();
  const hasil: { r: T; proyek: string; ke: number }[] = [];

  const tambah = (r: T, kunci: string) => {
    if (sudah.has(kunci)) return;
    sudah.add(kunci);
    const proyek = kunciProyek(r);
    if (!urutanProyek.has(proyek)) urutanProyek.set(proyek, urutanProyek.size);
    hasil.push({ r, proyek, ke: hasil.length });
  };

  for (const r of jadwal) tambah(r, `${kunciProyek(r)}|${rapikan(r.category || '')}`);
  for (const t of tiket) {
    if (urutanProyek.has(kunciProyek(t))) continue;
    tambah(t, kunciProyek(t));
  }

  const bobot = (r: T) => (r._sumber !== 'ticket' && diutamakan(r.category) ? 0 : 1);
  hasil.sort((a, b) =>
    (urutanProyek.get(a.proyek)! - urutanProyek.get(b.proyek)!)
    || (bobot(a.r) - bobot(b.r))
    || (a.ke - b.ke));

  return hasil.slice(0, batas).map(h => h.r);
}
