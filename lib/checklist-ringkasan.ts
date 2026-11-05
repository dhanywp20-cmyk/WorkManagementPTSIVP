
export interface ItemSelesai { daftar_id: string; selesai: boolean; selesai_oleh: string | null; selesai_pada: string | null }
export interface AnggotaNama { daftar_id: string; nama: string }
export interface Kontribusi { nama: string; jumlah: number }

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export function kontribusiHandler(items: ItemSelesai[], anggota: AnggotaNama[]): Kontribusi[] {
  const handler = new Map<string, Map<string, string>>();
  for (const a of anggota) {
    const m = handler.get(a.daftar_id) ?? new Map<string, string>();
    m.set(norm(a.nama), a.nama.trim());
    handler.set(a.daftar_id, m);
  }
  const hitung = new Map<string, number>();
  for (const it of items) {
    if (!it.selesai) continue;
    const nama = handler.get(it.daftar_id)?.get(norm(it.selesai_oleh));
    if (nama) hitung.set(nama, (hitung.get(nama) ?? 0) + 1);
  }
  return [...hitung].map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'));
}

export function lokasiPerHandler(anggota: AnggotaNama[]): Kontribusi[] {
  const lokasi = new Map<string, { nama: string; daftar: Set<string> }>();
  for (const a of anggota) {
    const k = norm(a.nama);
    if (!k) continue;
    const e = lokasi.get(k) ?? { nama: a.nama.trim(), daftar: new Set<string>() };
    e.daftar.add(a.daftar_id);
    lokasi.set(k, e);
  }
  return [...lokasi.values()].map(e => ({ nama: e.nama, jumlah: e.daftar.size }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'));
}

export function tanggalWIB(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export function selesaiPerHari(items: ItemSelesai[]): Record<string, number> {
  const peta: Record<string, number> = {};
  for (const it of items) if (it.selesai && it.selesai_pada) {
    const t = tanggalWIB(it.selesai_pada);
    peta[t] = (peta[t] ?? 0) + 1;
  }
  return peta;
}

export interface AktivitasProyek {  kontribusi: Kontribusi[]; perHari: Record<string, number> }

export function aktivitasProyek(items: ItemSelesai[], anggota: AnggotaNama[]): AktivitasProyek {
  return { kontribusi: lokasiPerHandler(anggota), perHari: selesaiPerHari(items) };
}
