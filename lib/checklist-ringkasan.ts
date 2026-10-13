/**
 * lib/checklist-ringkasan.ts - angka "siapa mengerjakan" & "berapa per hari" untuk ringkasan Project
 * Progress. Murni, dipakai server (detail proyek: diagregasi dulu supaya yang dikirim kecil) dan
 * peramban (link share & checklist, item sudah dimuat).
 *
 * "Dikerjakan Oleh" HANYA menghitung handler - anggota yang di-assign di checklist lokasi itu. Admin /
 * orang lain yang membantu mencentang tetap tercatat di item (selesai_oleh) dan riwayat, tetapi tidak
 * masuk grafik kontribusi.
 */

export interface ItemSelesai { daftar_id: string; selesai: boolean; selesai_oleh: string | null; selesai_pada: string | null }
export interface AnggotaNama { daftar_id: string; nama: string }
export interface Kontribusi { nama: string; jumlah: number }

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Item selesai per handler (anggota checklist item tersebut), terbanyak dulu. */
export function kontribusiHandler(items: ItemSelesai[], anggota: AnggotaNama[]): Kontribusi[] {
  const handler = new Map<string, Map<string, string>>();   // daftar_id -> (nama dinormalkan -> nama tampil)
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

/** Tanggal (WIB) dari stempel waktu ISO - satu zona untuk semua orang, server maupun HP. */
export function tanggalWIB(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/** Jumlah item selesai per tanggal WIB (siapa pun yang mencentang - ini laju pekerjaan, bukan kontribusi). */
export function selesaiPerHari(items: ItemSelesai[]): Record<string, number> {
  const peta: Record<string, number> = {};
  for (const it of items) if (it.selesai && it.selesai_pada) {
    const t = tanggalWIB(it.selesai_pada);
    peta[t] = (peta[t] ?? 0) + 1;
  }
  return peta;
}

/** Ringkasan aktivitas untuk dikirim server ke detail proyek (kecil, tanpa daftar item). */
export interface AktivitasProyek { kontribusi: Kontribusi[]; perHari: Record<string, number> }

export function aktivitasProyek(items: ItemSelesai[], anggota: AnggotaNama[]): AktivitasProyek {
  return { kontribusi: kontribusiHandler(items, anggota), perHari: selesaiPerHari(items) };
}
