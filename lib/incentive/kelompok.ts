
export interface BarisKelompok {
  id: string;
  project_name?: string | null;
  category?: string | null;
  assign_name?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  bast_date?: string | null;
  batch_id?: string | null;
  incentive_group_id?: string | null;
}

export function normalkanNama(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function kunciProyek(r: BarisKelompok): string {
  if (r.incentive_group_id) return `grup:${r.incentive_group_id}`;
  if (r.batch_id) return `batch:${r.batch_id}::${r.assigned_to ?? ''}`;
  return `baris:${r.id}`;
}

export function gabungkanProyek<T extends BarisKelompok>(baris: T[]): T[] {
  const terpilih = new Map<string, T>();
  const bastTerpinjam = new Map<string, string>();
  for (const r of baris) {
    const k = kunciProyek(r);
    const ada = terpilih.get(k);
    if (!ada) { terpilih.set(k, r); }
    else {
      const lebihBaru = (r.due_date ?? '') > (ada.due_date ?? '')
        || ((r.due_date ?? '') === (ada.due_date ?? '') && r.id < ada.id);
      if (lebihBaru) terpilih.set(k, r);
    }
    if (r.bast_date && !bastTerpinjam.has(k)) bastTerpinjam.set(k, r.bast_date);
  }
  return [...terpilih.values()]
    .map(r => {
      if (r.bast_date) return r;
      const pinjaman = bastTerpinjam.get(kunciProyek(r));
      return pinjaman ? { ...r, bast_date: pinjaman } : r;
    })
    .sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''));
}

export interface KandidatGabung {
  nama: string;
  bast_date: string;
  anggota: BarisKelompok[];
}

export function deteksiKandidatGabung(baris: BarisKelompok[]): KandidatGabung[] {
  const TOLERANSI_HARI = 7;
  const hari = (tgl: string) => Math.floor(new Date(`${tgl}T00:00:00`).getTime() / 86_400_000);

  const perNama = new Map<string, BarisKelompok[]>();
  for (const r of gabungkanProyek(baris)) {
    if (r.incentive_group_id) continue;
    if (!r.bast_date) continue;
    const nama = normalkanNama(r.project_name);
    if (!nama) continue;
    if (!perNama.has(nama)) perNama.set(nama, []);
    perNama.get(nama)!.push(r);
  }

  const hasil: KandidatGabung[] = [];
  for (const daftar of perNama.values()) {
    if (daftar.length < 2) continue;
    const urut = [...daftar].sort((a, b) => (a.bast_date ?? '').localeCompare(b.bast_date ?? ''));

    let kelompok: BarisKelompok[] = [urut[0]];
    const tutup = () => {
      if (kelompok.length >= 2) {
        hasil.push({
          nama: (kelompok[0].project_name ?? '').trim(),
          bast_date: kelompok[0].bast_date ?? '',
          anggota: [...kelompok],
        });
      }
    };
    for (let i = 1; i < urut.length; i++) {
      const jarak = Math.abs(hari(urut[i].bast_date!) - hari(urut[i - 1].bast_date!));
      if (jarak <= TOLERANSI_HARI) kelompok.push(urut[i]);
      else { tutup(); kelompok = [urut[i]]; }
    }
    tutup();
  }
  return hasil.sort((a, b) => b.bast_date.localeCompare(a.bast_date));
}

export function idUntukDigabung(kandidat: KandidatGabung, semua: BarisKelompok[]): string[] {
  const kunci = new Set(kandidat.anggota.map(kunciProyek));
  return semua.filter(r => kunci.has(kunciProyek(r))).map(r => r.id);
}
