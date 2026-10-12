/** calc-support.ts - dipecah dari calc.ts (scripts/pecah-modul.mjs); calc.ts tetap mengekspor ulang semuanya. */
import { supabase } from '@/lib/supabase';
import { LateTicketLink } from './calc-tipe';

/**
 * Jendela penilaian Support untuk SATU tahap pencairan.
 *
 * KENAPA PER TAHAP, BUKAN SEKALI DI BAST
 *
 * Porsi Support bukan hadiah sekali jadi yang ditentukan pada hari BAST - ia
 * imbalan atas pendampingan yang berjalan terus. Siapa pun yang menangani
 * Troubleshooting pada tahun berjalan ikut mendapat bagian pada pencairan
 * tahun itu; tahun berikutnya dinilai ulang, dan yang menangani boleh orang
 * yang sama atau orang lain.
 *
 * Perhitungan lama memakai SATU daftar untuk seluruh tahun - diambil sekali
 * dengan batas BAST + 12 bulan, lalu dipakai ulang di tahap 2 dan 3. Akibatnya
 * orang yang membantu di tahun kedua tidak pernah dapat apa-apa, sementara
 * orang yang membantu sekali di tahun pertama terus dibayar sampai tahun
 * ketiga. Dua-duanya salah, dan keduanya diam-diam.
 *
 * Batas tahap pertama sengaja TIDAK punya awal: catatan Troubleshooting yang
 * dibuat sebelum BAST (saat proyek masih berjalan) tetap ikut dihitung di
 * tahap pertama. Tahap berikutnya barulah berupa rentang tertutup satu tahun.
 */
export function jendelaSupportTahap(
  bastDate: string | null | undefined,
  tahunKe: number,
): { dari: string | null; sampai: string | null } {
  if (!bastDate || tahunKe < 1) return { dari: null, sampai: null };
  const tgl = (tambahTahun: number) => {
    const d = new Date(bastDate);
    d.setFullYear(d.getFullYear() + tambahTahun);
    return d.toISOString().slice(0, 10);
  };
  return {
    dari: tahunKe === 1 ? null : tgl(tahunKe - 1),
    sampai: tgl(tahunKe),
  };
}

/**
 * Samakan bentuk nama proyek sebelum dibandingkan.
 *
 * Pencocokannya DULU memakai persamaan persis (`.eq`), dan itu diam-diam
 * merugikan tim. Catatan Troubleshooting lahir dari nama yang DIKETIK ULANG
 * orang - lewat Ticketing, atau manual ketika pencarian "Project Existing"
 * tidak menemukan proyeknya. "BPKP ICT TIMUR", "BPKP ICT Timur", dan
 * "BPKP  ICT Timur " adalah proyek yang sama bagi manusia, tetapi tiga nilai
 * berbeda bagi `.eq` - dan ketika tidak cocok, porsi Tim Support tahun itu
 * bukan tampil sebagai kesalahan, melainkan menghilang tanpa suara: skemanya
 * beralih ke "tanpa support" dan porsinya diserap PIC.
 *
 * Uang tidak boleh bergantung pada spasi ganda atau huruf kapital.
 */
function samakanNamaProyek(v: string): string {
  return v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Ambil bagian tanggal (YYYY-MM-DD) dari nilai tanggal apa pun bentuknya. */
function tanggalSaja(v: string | null | undefined): string {
  return (v ?? '').slice(0, 10);
}

function didalamRentang(tgl: string, rentang?: { dari?: string | null; sampai?: string | null }): boolean {
  //  Tanpa batas apa pun, semuanya masuk - termasuk baris yang tanggalnya
  //  kosong. Ini dipakai rekap "seluruh tahun" (Summary), yang memang tidak
  //  boleh menjatuhkan pekerjaan hanya karena tanggalnya belum terisi.
  if (!rentang?.dari && !rentang?.sampai) return true;
  if (!tgl) return false;
  if (rentang?.dari   && !(tgl > rentang.dari))   return false;
  if (rentang?.sampai && !(tgl <= rentang.sampai)) return false;
  return true;
}

interface BarisAktivitas {
  handler_username: string | null;
  handler_name: string | null;
  new_status: string | null;
  created_at: string | null;
}

/**
 * Siapa saja yang tercatat membantu Troubleshooting proyek ini dalam sebuah
 * rentang tanggal.
 *
 * DUA SUMBER, karena Troubleshooting memang tercatat di dua tempat:
 *
 *   1. `reminders` berkategori Troubleshooting berstatus selesai - jadwal yang
 *      dipegang seseorang lalu ditutup.
 *   2. `tickets` berstatus Solved - ticket yang benar-benar diselesaikan.
 *
 * Sebelumnya HANYA sumber 1 yang dibaca, dengan alasan "ticket bukan bukti
 * mengerjakan, ia baru laporan masalah". Alasan itu keliru untuk ticket yang
 * sudah Solved: menutupnya adalah pekerjaan, dan orang yang menutupnya sudah
 * tercatat namanya. Akibat kekeliruan itu, ticket yang diselesaikan tanpa
 * pernah dijadwalkan Onsite tidak menghasilkan porsi Support sama sekali -
 * dan seperti biasa, hilangnya tanpa pesan apa pun: skema beralih ke "tanpa
 * support" dan porsinya diserap PIC.
 *
 * TANGGAL YANG DIPAKAI untuk menentukan tahun pencairan adalah tanggal ticket
 * itu SELESAI (catatan aktivitas yang menaikkan statusnya ke Solved), bukan
 * tanggal ticket dibuat. Ticket yang dilaporkan Desember tahun ke-1 dan baru
 * selesai Januari tahun ke-2 adalah pekerjaan tahun ke-2.
 *
 * PENCOCOKAN PROYEK memakai reminder_id lebih dulu - itu tautan yang pasti,
 * dibuat saat ticket dipilih lewat "Project Existing". Nama proyek hanya
 * cadangan, untuk ticket lama yang dibuat sebelum penautan itu ada.
 *
 * Rentangnya setengah terbuka - `dari` eksklusif, `sampai` inklusif - dan
 * pemanggilnya memakai jendelaSupportTahap() supaya batas antar tahun tidak
 * ditulis ulang di beberapa tempat lalu menyimpang.
 */
/** Baris mentah ketiga sumber, diambil SEKALI untuk dipakai banyak proyek. */
export interface SumberSupport {
  reminders: { assigned_to: string | null; assign_name: string | null; project_name: string | null; due_date: string | null }[];
  tickets: {
    id: string; project_name: string | null; reminder_id: string | null;
    date: string | null; assign_name: string | null; activity_logs: BarisAktivitas[] | null;
  }[];
  /** nama lengkap (dinormalkan) -> username. Lihat catatan di bawah. */
  petaNama: Map<string, string>;
}

/**
 * Ambil ketiga sumber penilaian Support SEKALI SAJA.
 *
 * Dipisah dari pencocokannya karena rekap memerlukan jawaban untuk PULUHAN
 * proyek sekaligus. Memanggil fetchSupportFromTickets() per proyek berarti
 * tiga kueri dikalikan jumlah proyek - ratusan perjalanan bolak-balik untuk
 * data yang isinya sama persis. Diambil sekali di sini, dicocokkan di memori.
 *
 * Penyaringan tanggal TIDAK dilakukan di kueri (berbeda dengan pemakaian satu
 * proyek), sebab tiap proyek punya jendela tahunnya sendiri yang dihitung dari
 * BAST masing-masing. due_date karena itu ikut diambil dan disaring belakangan.
 */
export async function ambilSumberSupport(): Promise<{ data: SumberSupport; error: unknown }> {
  const qr = supabase
    .from('reminders')
    .select('assigned_to, assign_name, project_name, due_date')
    .eq('category', 'Troubleshooting')
    .eq('status', 'done');

  const qt = supabase
    .from('tickets')
    .select('id, project_name, reminder_id, status, date, assign_name, activity_logs(handler_username, handler_name, new_status, created_at)')
    .eq('status', 'Solved');

  // Tabel tickets hanya menyimpan NAMA handler-nya, sedangkan jalur reminder
  // menghasilkan username. Tanpa pemetaan ini satu orang yang sama bisa masuk
  // dua kali - sekali sebagai username, sekali sebagai nama - lalu porsi
  // Support dibagi ke dua "orang" yang sebenarnya satu.
  const qu = supabase.from('users').select('username, full_name');

  const [rRes, tRes, uRes] = await Promise.all([qr, qt, qu]);

  const petaNama = new Map<string, string>();
  for (const u of (uRes.data ?? []) as { username: string | null; full_name: string | null }[]) {
    const n = samakanNamaProyek(u.full_name ?? '');
    if (n && u.username) petaNama.set(n, u.username);
  }

  return {
    data: {
      reminders: (rRes.data ?? []) as SumberSupport['reminders'],
      tickets: (tRes.data ?? []) as SumberSupport['tickets'],
      petaNama,
    },
    error: rRes.error ?? tRes.error ?? uRes.error,
  };
}

/** Siapa yang membantu proyek ini dalam rentang tanggal, dari sumber yang sudah diambil. */
export function supportUntukProyek(
  sumber: SumberSupport,
  proyek: { id?: string | null; project_name: string },
  rentang?: { dari?: string | null; sampai?: string | null },
): { user_id: string; user_name: string }[] {
  const dicari = samakanNamaProyek(proyek?.project_name ?? '');
  if (!dicari) return [];
  const { petaNama } = sumber;
  /** Username milik sebuah nama lengkap; namanya sendiri bila tidak dikenali. */
  const usernameDariNama = (nama: string | null | undefined): string =>
    petaNama.get(samakanNamaProyek(nama ?? '')) ?? (nama ?? '');

  const hasil: { user_id: string; user_name: string }[] = [];
  const sudah = new Set<string>();
  const tambah = (user_id: string | null | undefined, user_name: string | null | undefined) => {
    const id = (user_id ?? '').trim();
    if (!id || sudah.has(id)) return;
    sudah.add(id);
    hasil.push({ user_id: id, user_name: user_name || '' });
  };

  // Sumber 1 - jadwal Troubleshooting yang ditutup selesai. Rentangnya
  // disaring di sini (bukan di kueri) supaya sumbernya bisa dipakai ulang
  // untuk banyak proyek yang jendela tahunnya berbeda-beda.
  for (const r of sumber.reminders) {
    if (samakanNamaProyek(r.project_name ?? '') !== dicari) continue;
    if (!didalamRentang(tanggalSaja(r.due_date), rentang)) continue;
    tambah(r.assigned_to, r.assign_name);
  }

  // Sumber 2 - ticket yang diselesaikan.
  for (const t of sumber.tickets) {
    const cocok = (proyek.id && t.reminder_id === proyek.id)
      || samakanNamaProyek(t.project_name ?? '') === dicari;
    if (!cocok) continue;

    const catatan = t.activity_logs ?? [];
    const jejakSolved = catatan.filter(a => (a.new_status ?? '').toLowerCase() === 'solved');

    // Tanggal selesai diambil dari catatan aktivitas. Bila ticket lama tidak
    // punya catatan itu, tanggal ticket dipakai sebagai perkiraan terbaik -
    // lebih baik daripada mengabaikan pekerjaannya sama sekali.
    const tglSelesai = jejakSolved.length
      ? jejakSolved.map(a => tanggalSaja(a.created_at)).sort().at(-1) ?? ''
      : tanggalSaja(t.date);
    if (!didalamRentang(tglSelesai, rentang)) continue;

    // YANG DIBAYAR ADALAH HANDLER TICKET, BUKAN YANG MENGKLIK "Solved".
    //
    // Catatan aktivitas menyimpan handler_username, yaitu akun yang menekan
    // tombolnya. Di lapangan itu sering Admin: teknisi melapor lewat telepon
    // atau grup, lalu Admin yang menutupkan ticketnya. Memakai nilai itu
    // membuat porsi Support jatuh ke "Admin" - orang yang tidak mengerjakan
    // apa pun - sementara teknisi yang menangani tidak dibayar.
    //
    // Catatan aktivitas tetap dipakai untuk menjawab KAPAN selesainya, karena
    // untuk pertanyaan itu ia memang sumber yang tepat. Yang diambil darinya
    // hanya tanggal, bukan orangnya.
    tambah(usernameDariNama(t.assign_name), t.assign_name);
  }

  return hasil;
}

/**
 * Siapa saja yang tercatat membantu Troubleshooting SATU proyek.
 *
 * Pembungkus tipis di atas ambilSumberSupport + supportUntukProyek, supaya
 * pemanggil yang memang hanya butuh satu proyek tidak berubah caranya.
 * Untuk banyak proyek sekaligus, panggil kedua fungsi itu langsung - lihat
 * catatan hemat kueri di ambilSumberSupport.
 */
export async function fetchSupportFromTickets(
  proyek: { id?: string | null; project_name: string },
  rentang?: { dari?: string | null; sampai?: string | null },
): Promise<{ data: { user_id: string; user_name: string }[]; error: unknown }> {
  const { data: sumber, error } = await ambilSumberSupport();
  return { data: supportUntukProyek(sumber, proyek, rentang), error };
}

export async function fetchLateTickets(parentProjectId?: string) {
  let q = supabase.from('late_ticket_links').select('*').order('attached_at', { ascending: false });
  if (parentProjectId) q = q.eq('parent_project_id', parentProjectId);
  const { data, error } = await q;
  return { data: (data || []) as LateTicketLink[], error };
}
