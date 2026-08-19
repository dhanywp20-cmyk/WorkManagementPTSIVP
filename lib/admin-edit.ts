/**
 * Perkakas bersama untuk panel "Edit Detail & Re-route" milik admin.
 *
 * Dipakai Ticketing, Request Schedule, dan Request Design Project. Ketiganya
 * punya bentuk data yang berbeda, tapi tiga hal ini persis sama di semuanya:
 * menentukan apa yang berubah, menuliskannya ke audit trail, dan
 * memberitahukannya lewat WA.
 *
 * Alasan panel ini ada: sebelumnya satu-satunya cara membetulkan data yang
 * salah adalah mengeditnya langsung di Supabase. Itu berarti tidak ada jejak
 * siapa yang mengubah apa, dan orang yang menangani pekerjaannya tidak pernah
 * diberi tahu bahwa datanya berubah.
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

/** Ubah nilai apa pun jadi teks yang enak dibaca manusia di audit & WA. */
function jadikanTeks(v: unknown): string {
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
