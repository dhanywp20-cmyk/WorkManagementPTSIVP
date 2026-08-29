import { supabase } from './supabase';

/**
 * lib/cari-reminder.ts - mencari project di tabel `reminders` berdasarkan nama.
 *
 * KENAPA BERKAS INI ADA
 *
 * Dua tempat mencari project dengan cara yang sama - pencarian "Project
 * Existing" di Create Ticket, dan Global Search di dashboard - dan keduanya
 * dulu memakai satu kueri gabungan:
 *
 *     .select('id, project_name, title, ...')
 *     .or(`project_name.ilike.%q%,title.ilike.%q%`)
 *
 * `title` disebut dua kali di sana, dan di basis data ini kolom itu TIDAK ADA:
 *
 *     column reminders.title does not exist
 *
 * Satu kolom yang tidak ada membuat PostgREST menolak SELURUH kueri, termasuk
 * pencarian project_name yang tidak bersalah. Jadi pencarian project di dua
 * layar itu tidak pernah mengembalikan satu baris pun dari tabel reminders -
 * yang muncul hanya hasil dari tabel tickets, yang kuerinya tidak menyebut
 * `title`.
 *
 * Yang membuatnya bertahan lama bukan kegagalannya, melainkan BENTUK
 * kegagalannya: kedua pemanggil membuang `error` dan hanya memakai `data`.
 * Kueri yang ditolak menghasilkan data kosong, dan data kosong tampil sebagai
 * "project tidak ditemukan" - kalimat yang salah tetapi masuk akal, sehingga
 * orang mencari penyebabnya pada nama project, bukan pada pencariannya.
 *
 * Akibatnya berlanjut ke uang: ketika project tidak ketemu, orang mengetik
 * namanya manual, nama itu menyimpang dari nama di Reminder Schedule, dan
 * porsi Tim Support pada Incentive dicocokkan lewat nama.
 *
 * ATURAN BERKAS INI
 *
 *   1. Kueri UTAMA hanya menyentuh kolom yang pasti ada. Ia tidak boleh bisa
 *      dijatuhkan oleh kolom opsional mana pun.
 *   2. `title` dicari lewat kueri TERPISAH yang boleh gagal sendirian. Sekali
 *      basis data bilang kolomnya tidak ada, ia tidak dicoba lagi - bukan
 *      dicoba ulang tiap ketukan tombol.
 *   3. Galat kueri utama DIKEMBALIKAN, tidak ditelan.
 */

/** Bagian `%_\` di dalam pola LIKE harus dilucuti supaya tidak jadi wildcard. */
function polaAman(q: string): string {
  return `%${q.trim().replace(/([%_\\])/g, '\\$1')}%`;
}

/**
 * Apakah kolom `title` bisa dicari di basis data ini.
 *
 * null = belum pernah dicoba. false = basis data sudah bilang tidak ada, jadi
 * berhenti bertanya. Disimpan di tingkat modul supaya jawabannya berlaku untuk
 * seluruh sesi: tanpa ini, tiap ketukan tombol mengirim satu kueri yang sudah
 * pasti ditolak, lalu mencetak galatnya ke konsol berulang-ulang.
 */
let titleBisaDicari: boolean | null = null;

/** Kode Postgres untuk "kolom tidak ada" - undefined_column. */
function kolomTidakAda(pesan: string): boolean {
  return /does not exist/i.test(pesan);
}

export interface HasilCariReminder<T> {
  data: T[];
  /**
   * Galat kueri UTAMA saja. Kegagalan pencarian kolom `title` sengaja tidak
   * dilaporkan ke sini - kolom itu opsional, dan mengabarkan ketiadaannya
   * sebagai galat hanya menakuti tanpa ada yang bisa diperbuat.
   */
  error: { message: string } | null;
}

/**
 * Cari reminder yang namanya memuat `q`.
 *
 * @param kolom  kolom yang diambil. JANGAN menyertakan `title` di sini - lihat
 *               aturan 1 di atas; kolom opsional ditangani berkas ini sendiri.
 * @param batas  jumlah maksimum baris per kueri.
 */
/**
 * Reminder TERBARU, tanpa kata kunci - dipakai menampilkan kandidat begitu
 * langkah pencarian dibuka, sebelum siapa pun mengetik apa pun.
 *
 * Sengaja terpisah dari cariReminderByNama(), yang MENOLAK kueri kosong (lihat
 * alasannya di sana - kueri kosong di sana berarti "belum ada yang dicari").
 * Di sini kekosongannya justru yang diminta: bukan "cari semuanya", tapi
 * "tampilkan yang paling baru", dibatasi `batas` baris.
 *
 * Kolom `title` TIDAK ikut dicari di sini - daftar terbaru tidak butuh kolom
 * peninggalan itu, jadi tidak ada alasan menanggung risiko "column does not
 * exist" yang sama sekali tidak relevan untuk kasus ini.
 */
export async function reminderTerbaru<T = Record<string, unknown>>(
  kolom: string,
  batas: number,
  terapkanLingkup: <Q>(kueri: Q) => Q,
): Promise<HasilCariReminder<T>> {
  const { data, error } = await terapkanLingkup(
    supabase.from('reminders').select(kolom).order('created_at', { ascending: false }).limit(batas),
  );
  return { data: (data ?? []) as T[], error: error ? { message: error.message } : null };
}

export async function cariReminderByNama<T = Record<string, unknown>>(
  q: string,
  kolom: string,
  batas = 20,
  /**
   * Pembatas lingkup pencari, diterapkan ke kueri sebelum dijalankan.
   *
   * Sengaja berupa fungsi, bukan string `.or(...)`: tiap pemanggil menurunkan
   * lingkupnya dengan cara berbeda (filterLingkup di Ticketing, batasiLingkup
   * di Global Search), dan memaksakan satu bentuk string membuat salah satunya
   * harus menuliskan ulang aturannya - yaitu cara paling mudah membuat dua
   * aturan keamanan yang perlahan menyimpang.
   *
   * WAJIB diisi. Melewatkannya berarti memperlihatkan project seluruh divisi.
   */
  terapkanLingkup: <Q>(kueri: Q) => Q,
): Promise<HasilCariReminder<T>> {
  if (!q.trim()) return { data: [], error: null };
  const pola = polaAman(q);

  const bangun = (kolomNama: string, kolomAmbil: string) => terapkanLingkup(
    supabase
      .from('reminders')
      .select(kolomAmbil)
      .ilike(kolomNama, pola)
      .order('created_at', { ascending: false })
      .limit(batas),
  );

  // Kueri utama - hanya kolom yang diminta pemanggil, tanpa tambahan apa pun.
  const utama = await bangun('project_name', kolom);

  // Kueri peninggalan. Dilewati begitu diketahui kolomnya tidak ada.
  let barisLegacy: unknown[] = [];
  if (titleBisaDicari !== false) {
    const legacy = await bangun('title', `${kolom}, title`);
    if (legacy.error) {
      if (kolomTidakAda(legacy.error.message)) titleBisaDicari = false;
    } else {
      titleBisaDicari = true;
      barisLegacy = legacy.data ?? [];
    }
  }

  // Satu baris bisa lolos di kedua kueri (project_name DAN title memuat q).
  const sudah = new Set<string>();
  const unik = [...((utama.data ?? []) as unknown[]), ...barisLegacy].filter(r => {
    const id = String((r as { id?: unknown }).id ?? '');
    if (!id || sudah.has(id)) return false;
    sudah.add(id);
    return true;
  }) as T[];

  return { data: unik, error: utama.error ? { message: utama.error.message } : null };
}
