/**
 * lib/gabung-hasil-proyek.ts - menyatukan hasil pencarian "Project yang sudah ada"
 * (Create Ticket) dari tabel reminders dan tickets menjadi satu daftar pilihan.
 *
 * KENAPA KATEGORI IKUT JADI KUNCI
 *
 * Dulu baris disatukan hanya lewat nama + alamat. Satu project hampir selalu
 * punya BEBERAPA jadwal di Request Schedule - "MHU Coal" di CFX TOWER punya
 * Konfigurasi (30 Jun) dan Standby Event (9 Jul) - dan semuanya bernama dan
 * beralamat sama. Hasil diurutkan terbaru dulu, jadi yang tersisa hanya
 * Standby Event; Konfigurasi hilang dari daftar dan tidak bisa dipilih sama
 * sekali.
 *
 * Akibatnya sampai ke uang: memilih hasil menautkan tickets.reminder_id ke
 * jadwal itu, dan porsi Support di Incentive PTS mencocokkan ticket ke proyek
 * insentif lewat reminder_id - proyek insentif adalah jadwal Konfigurasi /
 * Training, bukan Standby Event. Ticket yang tertaut ke Standby Event hanya
 * tertolong pencocokan nama cadangan, dan itu pun hanya selama namanya persis.
 *
 * ATURAN
 *
 *   1. Jadwal (reminders) disatukan per nama + alamat + KATEGORI - kategori
 *      berbeda tetap pilihan berbeda. Kategori sama disatukan, yang terbaru
 *      (urutan masuk) dipertahankan, supaya project yang tiap bulan Maintenance
 *      tidak membanjiri daftar.
 *   2. Ticket lama hanya cadangan untuk project yang TIDAK punya jadwal sama
 *      sekali - ia tidak bisa menautkan reminder_id, jadi tidak pernah boleh
 *      menggeser jadwal yang sah.
 *   3. Pilihan satu project berkumpul berdekatan, dan kategori yang
 *      `diutamakan` (kategori proyek insentif) berada di atas kelompoknya.
 *
 * Spasi dan huruf diratakan: "Jl.Parangtritis" dan "Jl. Parangtritis" adalah
 * alamat yang sama, dan tanpa perataan keduanya lolos sebagai dua pilihan
 * identik yang lalu dipilih secara acak.
 */

export interface BarisHasilProyek {
  project_name: string;
  title?: string;
  address: string;
  category: string;
  _sumber?: 'reminder' | 'ticket';
}

const rapikan = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

/** Kunci satu project: nama + alamat, sudah diratakan. */
export function kunciProyek(r: BarisHasilProyek): string {
  return `${rapikan(r.project_name || r.title || '')}|${rapikan(r.address || '')}`;
}

export function gabungHasilProyek<T extends BarisHasilProyek>(
  jadwal: T[],
  tiket: T[],
  batas: number,
  diutamakan: (kategori: string) => boolean = () => false,
): T[] {
  /** Urutan kemunculan pertama tiap project, untuk menjaga urutan "terbaru dulu" antar project. */
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
  // Kunci ticket = kunci project saja, dan project yang sudah punya jadwal
  // (kategori apa pun) dilewati - lihat aturan 2.
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
