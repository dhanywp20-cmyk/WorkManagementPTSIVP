import { supabase } from './supabase';

/**
 * lib/cari-reminder.ts - mencari project di tabel `reminders` berdasarkan nama.
 *
 * KENAPA BERKAS INI ADA
 *
 * Dua tempat mencari project dengan cara yang sama persis - pencarian "Project
 * Existing" di Create Ticket, dan Global Search di dashboard - dan keduanya
 * memakai satu kueri gabungan:
 *
 *     .or(`project_name.ilike.%q%,title.ilike.%q%`)
 *
 * `title` adalah kolom peninggalan: nama project data lama tersimpan di sana,
 * dan seluruh aplikasi menampilkan `project_name || title`. Menyertakannya
 * memang benar secara maksud - tetapi menaruhnya di dalam SATU kueri bersama
 * `project_name` membuat keduanya hidup-mati bersama. Bila kolom itu tidak ada
 * di basis data, atau tipenya tidak bisa di-ilike, PostgREST menolak SELURUH
 * kueri - termasuk bagian project_name yang sebenarnya tidak bermasalah.
 *
 * Yang membuatnya berbahaya bukan kegagalannya, melainkan BENTUK kegagalannya:
 * kedua pemanggil membuang `error` dan hanya memakai `data`. Kueri yang ditolak
 * menghasilkan data kosong, dan data kosong tampil sebagai "project tidak
 * ditemukan" - kalimat yang salah tetapi masuk akal, sehingga orang mencari
 * penyebabnya pada nama project, bukan pada pencariannya.
 *
 * Akibatnya berlanjut ke uang: ketika project tidak ketemu, orang mengetik
 * namanya manual, nama itu menyimpang, dan porsi Tim Support pada Incentive
 * tidak pernah tercocokkan.
 *
 * Karena itu pencariannya dipecah: `project_name` berdiri sendiri dan HARUS
 * berhasil, `title` menyusul sebagai kueri terpisah yang boleh gagal tanpa
 * menyeret yang lain. Galat kueri utama dikembalikan, bukan ditelan.
 */

/** Bagian `%_` di dalam pola LIKE harus dilucuti supaya tidak jadi wildcard. */
function polaAman(q: string): string {
  return `%${q.trim().replace(/([%_\\])/g, '\\$1')}%`;
}

export interface HasilCariReminder<T> {
  data: T[];
  /**
   * Galat kueri UTAMA saja. Kegagalan pencarian kolom `title` sengaja tidak
   * dilaporkan - kolom itu opsional, dan mengabarkan ketiadaannya sebagai galat
   * hanya akan menakuti tanpa ada yang bisa diperbuat.
   */
  error: { message: string } | null;
  /** true bila kolom `title` tidak bisa dicari, jadi project data lama terlewat. */
  titleTerlewat: boolean;
}

/**
 * Cari reminder yang namanya memuat `q`.
 *
 * @param kolom  daftar kolom yang diambil - pemanggil butuh bentuk berbeda.
 * @param batas  jumlah maksimum baris per kueri.
 */
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
   * aturan yang perlahan menyimpang.
   *
   * WAJIB diisi. Melewatkannya berarti memperlihatkan project seluruh divisi.
   */
  terapkanLingkup: <Q>(kueri: Q) => Q,
): Promise<HasilCariReminder<T>> {
  const pola = polaAman(q);
  if (!q.trim()) return { data: [], error: null, titleTerlewat: false };

  const bangun = (kolomNama: string) => terapkanLingkup(
    supabase
      .from('reminders')
      .select(kolom)
      .ilike(kolomNama, pola)
      .order('created_at', { ascending: false })
      .limit(batas),
  );

  const utama = await bangun('project_name');

  // Kueri kedua khusus kolom peninggalan. Dipisah supaya penolakan di sini
  // tidak menghapus hasil kueri utama.
  const legacy = await bangun('title');

  const gabung = [
    ...((utama.data ?? []) as unknown as T[]),
    ...((legacy.data ?? []) as unknown as T[]),
  ];

  // Satu baris bisa lolos di kedua kueri (project_name DAN title memuat q).
  const sudah = new Set<string>();
  const unik = gabung.filter(r => {
    const id = String((r as { id?: unknown }).id ?? '');
    if (!id || sudah.has(id)) return false;
    sudah.add(id);
    return true;
  });

  return {
    data: unik,
    error: utama.error ? { message: utama.error.message } : null,
    titleTerlewat: !!legacy.error,
  };
}
