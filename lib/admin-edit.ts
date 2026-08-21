/**
 * Perkakas bersama untuk panel "Edit Detail & Re-route" milik admin, dipakai
 * Ticketing, Request Schedule, dan Request Design Project. Bentuk datanya
 * berbeda-beda, tapi tiga hal ini sama di ketiganya: menentukan apa yang
 * berubah, menuliskannya ke audit trail, dan memberitahukannya lewat WA.
 */

export type AdminFieldType = 'text' | 'textarea' | 'tel' | 'date' | 'time' | 'number' | 'select';

export interface AdminField {
  key: string;
  label: string;
  type?: AdminFieldType;
  options?: { value: string; label: string }[];
  /** Lebar kolom pada grid 3 kolom. Default 1. */
  span?: 1 | 2 | 3;
  placeholder?: string;
}

export interface Perubahan {
  key: string;
  label: string;
  dari: string;
  ke: string;
}

/**
 * Penanda tujuan "alihkan ke Supervisor" pada dropdown assign, bentuknya
 * `SUP::<id>::<nama>`. Ini nilai INTERNAL <option> - id-nya dipakai mengisi
 * assigned_supervisor_id, bukan untuk dibaca manusia.
 */
export const PENANDA_SUPERVISOR = 'SUP::';

/** Baca penanda supervisor jadi id + nama. Null bila nilainya bukan penanda. */
export function bacaTujuanSupervisor(nilai: unknown): { id: string; nama: string } | null {
  if (typeof nilai !== 'string' || !nilai.startsWith(PENANDA_SUPERVISOR)) return null;
  const bagian = nilai.split('::');
  // Nama sengaja disambung kembali: kalau suatu saat ada nama bertanda '::',
  // yang terpotong hanya id-nya, bukan namanya.
  return { id: bagian[1] ?? '', nama: bagian.slice(2).join('::') };
}

/**
 * Ubah nilai apa pun jadi teks yang enak dibaca manusia di audit & WA.
 *
 * Penanda `SUP::<id>::<nama>` diterjemahkan ke namanya. Tanpa ini, uuid mentah
 * ikut tercetak di Riwayat Perubahan yang dibaca Sales dan tim - membocorkan
 * pengenal internal sekaligus membuat catatannya tidak terbaca.
 */
function jadikanTeks(v: unknown): string {
  const sup = bacaTujuanSupervisor(v);
  if (sup) return `${sup.nama || 'Supervisor'} (Supervisor)`;
  if (v === null || v === undefined || v === '') return '(kosong)';
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak';
  return String(v);
}

/**
 * Bandingkan nilai lama dan baru, kembalikan HANYA yang benar-benar berubah.
 *
 * Perbandingannya sengaja lewat teks: nilai dari <input> selalu string,
 * sementara nilai dari database bisa number/null. Tanpa penyeragaman ini,
 * membuka lalu menutup form tanpa mengubah apa pun akan tercatat sebagai
 * belasan "perubahan" - dan ikut mengirim WA.
 */
export function bandingkan(
  fields: AdminField[],
  lama: Record<string, unknown>,
  baru: Record<string, unknown>,
): Perubahan[] {
  const hasil: Perubahan[] = [];
  for (const f of fields) {
    // Field yang TIDAK ikut form ini dilewati. Tidak ikut form berarti tidak
    // pernah dikirim ke database, jadi nilainya di sana tetap seperti semula -
    // mencatatnya sebagai "→ (kosong)" akan melaporkan perubahan yang tidak
    // pernah terjadi. Dikosongkan sungguhan tetap terbaca, karena <input>
    // mengirim string kosong, bukan menghilangkan kuncinya.
    if (!(f.key in baru) || baru[f.key] === undefined) continue;
    const a = lama[f.key];
    const b = baru[f.key];
    const sa = a === null || a === undefined ? '' : String(a);
    const sb = b === null || b === undefined ? '' : String(b);
    if (sa === sb) continue;
    hasil.push({ key: f.key, label: f.label, dari: jadikanTeks(a), ke: jadikanTeks(b) });
  }
  return hasil;
}

/** Ringkasan satu baris per perubahan - dipakai di catatan audit. */
export function ringkasPerubahan(p: Perubahan[]): string {
  return p.map(x => `${x.label}: ${x.dari} → ${x.ke}`).join('; ');
}

/**
 * Pesan WA untuk orang yang menangani pekerjaan ini.
 *
 * Isinya menyebut APA yang berubah, bukan sekadar "ada perubahan" - supaya
 * penerimanya tidak perlu membuka platform hanya untuk tahu apakah perubahan
 * itu menyangkut dirinya.
 */
export function pesanWAPerubahan(opts: {
  namaPenerima: string;
  namaPengubah: string;
  judulItem: string;
  jenisItem: string;
  perubahan: Perubahan[];
  reroute?: { dari: string; ke: string } | null;
  tautan?: string;
}): string {
  const { namaPenerima, namaPengubah, judulItem, jenisItem, perubahan, reroute, tautan } = opts;
  const garis = '━━━━━━━━━━━━━━━━━━';
  const baris: string[] = [
    reroute ? `🔀 *${jenisItem} Dialihkan*` : `✏️ *${jenisItem} Diperbarui*`,
    garis,
    `Halo *${namaPenerima}*,`,
    reroute
      ? `*${namaPengubah}* mengalihkan pekerjaan ini dari *${reroute.dari || '(belum ada)'}* ke *${reroute.ke}*.`
      : `*${namaPengubah}* memperbarui data pekerjaan ini.`,
    `📌 *Item :* ${judulItem}`,
  ];
  if (perubahan.length > 0) {
    baris.push(garis, '*Yang berubah:*');
    // Dibatasi 12 baris: WA memotong pesan yang terlalu panjang, dan daftar
    // yang terpotong di tengah lebih membingungkan daripada yang jelas-jelas
    // menyebut sisanya berapa.
    for (const x of perubahan.slice(0, 12)) baris.push(`• ${x.label}: ${x.dari} → ${x.ke}`);
    if (perubahan.length > 12) baris.push(`• …dan ${perubahan.length - 12} perubahan lain`);
  }
  baris.push(garis);
  if (tautan) baris.push(`🔗 ${tautan}`);
  return baris.join('\n');
}
