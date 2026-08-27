import { supabase } from '@/lib/supabase';
import {
  SkemaInsentif, PenerimaPeran, hitungPembagian, hitungManagerSebagaiPic, ambilSkema,
  persenInstaller, bagikanTepat, labelSkema,
} from '@/lib/incentive-scheme';

export type { SkemaInsentif };
export { ambilSkema, persenInstaller, bagikanTepat, labelSkema };

// Types

export interface IncentiveProjectRow {
  id: string;
  project_name: string;
  category: string;
  assigned_to: string;
  assign_name: string;
  status: string;
  requires_controller_automation: boolean;
  controller_automation_brand: string | null;
  /** 'MVI' | 'IVP' | 'BOTH' — menentukan petugas Finance mana yang boleh melihatnya. */
  brand?: string | null;
  pic_type: 'standard' | 'manager_pic';
  pic_id: string | null;
  domain_owner: string | null;
  mode_penyelesaian: 'onsite' | 'remote' | null;
  installer_name: string | null;
  installer_daerah: string | null;
  bast_date: string | null;
  incentive_value: number;
  sales_name: string;
  sales_division: string;
  address: string;
  product: string;
  created_at: string;
  due_date: string;
}

export interface IncentiveTranche {
  id: string;
  project_id: string;
  tranche_number: number;
  percentage: number;
  payment_year: number;
  status: 'pending' | 'processed' | 'paid';
  processed_at: string | null;
  paid_at: string | null;
  created_at: string;
  project?: IncentiveProjectRow;
  /** Salinan skema saat tahapan ini dibuat. Lihat sql/incentive-skema-versi.sql. */
  scheme_snapshot?: SkemaInsentif | null;
  scheme_label?: string | null;
}

export interface IncentiveSplit {
  id: string;
  project_id: string;
  tranche_id: string | null;
  /** Kunci peran; bebas karena peran baru bisa ditambah lewat Pengaturan. */
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
  source_ticket_id: string | null;
  created_at: string;
}

export interface SupportAssignment {
  id: string;
  ticket_id: string | null;
  project_id: string;
  user_id: string;
  user_name: string;
  domain: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface LateTicketLink {
  id: string;
  late_ticket_id: string;
  parent_project_id: string;
  attached_tranche_number: number;
  attached_at: string;
  note: string | null;
  ticket_value: number;
  is_sunset: boolean;
}

export interface SplitResult {
  /** Kunci peran; bukan union tertutup karena peran baru bisa ditambah admin. */
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}

// Calculation Engine

// Org hierarchy lookup - baca dari Struktur Organisasi (users.atasan_id + jabatan)
// JANGAN hardcode nama di code. Manager & Supervisor ditentukan dari pohon atasan
// yang dikelola di Admin Panel  User Management  Struktur Organisasi.
export interface OrgUser { id: string; full_name?: string | null; jabatan?: string | null; atasan_id?: string | null }

// Telusuri rantai atasan ke atas (TERMASUK node awal)  user pertama dengan jabatan cocok.
// Untuk PIC staff: Supervisor = atasan langsung yg ber-jabatan Supervisor; Manager = di atasnya lagi.
// Kalau PIC sendiri ber-jabatan Supervisor, ia dikembalikan sebagai supervisor (memicu forfeiture).
export function findUpline(startId: string, targetJabatan: string, users: OrgUser[]): OrgUser | null {
  let cur: OrgUser | undefined = users.find(u => u.id === startId);
  let guard = 0;
  while (cur && guard < 60) {
    if ((cur.jabatan || '') === targetJabatan) return cur;
    cur = cur.atasan_id ? users.find(u => u.id === cur!.atasan_id) : undefined;
    guard++;
  }
  return null;
}

// Tahan-error: kalau kolom atasan_id belum ada (migration belum jalan), kembalikan [].
export async function fetchOrgUsers(): Promise<OrgUser[]> {
  const { data } = await supabase.from('users').select('id, full_name, jabatan, atasan_id');
  return (data || []) as OrgUser[];
}

// Resolve user id dari kandidat id ATAU nama. reminders.assigned_to belum tentu
// UUID user - fallback cocokkan via full_name (assign_name) supaya walk-up atasan jalan.
export function resolveUserId(idCandidate: string | null | undefined, nameCandidate: string | null | undefined, users: OrgUser[]): string {
  if (idCandidate && users.some(u => u.id === idCandidate)) return idCandidate;
  const nm = (nameCandidate || '').toLowerCase().trim();
  if (nm) {
    const byName = users.find(u => (u.full_name || '').toLowerCase().trim() === nm);
    if (byName) return byName.id;
  }
  return idCandidate || '';
}

// Deprecated - name-based fallback lama. Hanya dipakai bila Struktur Organisasi belum diisi.
export function getSupervisorTeamForPic(picName: string): 'wahyu' | 'yoga' | null {
  const n = (picName || '').toLowerCase();
  if (n.includes('wahyu') || n.includes('ade') || n.includes('pandu')) return 'wahyu';
  if (n.includes('yoga') || n.includes('farhan') || n.includes('ferdin') || n.includes('deni')) return 'yoga';
  return null;
}

/**
 * Apakah dua penunjuk ini mengarah ke orang yang sama.
 *
 * Dicocokkan lewat id ATAU nama, karena satu orang bisa masuk lewat dua jalur
 * dengan penunjuk yang berbeda bentuk: username dari jalur reminder, nama
 * lengkap dari jalur ticket, uuid dari Struktur Organisasi.
 */
function orangSama(a: string | null | undefined, b: string | null | undefined): boolean {
  const rapikan = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const x = rapikan(a ?? ''), y = rapikan(b ?? '');
  return !!x && !!y && x === y;
}

/**
 * Buang orang yang SUDAH punya porsi tetap di proyek ini dari daftar Support.
 *
 * Porsi Support adalah untuk ORANG LAIN yang ikut membantu - di luar rantai
 * tanggung jawab yang memang sudah dibayar lewat perannya sendiri:
 *
 *   PIC         porsinya sudah mencakup tanggung jawab atas proyek itu.
 *   Supervisor  menangani Troubleshooting anak buahnya MEMANG tugasnya, dan
 *               itulah yang dibayar porsi koordinasi 15%.
 *   Manager     sama, lewat porsi Manager.
 *
 * Membayar mereka lagi lewat slot Support berarti satu orang menerima dua
 * bagian dari satu pool untuk pekerjaan yang sama.
 *
 * Bila di suatu tahun ternyata tidak ada seorang pun di luar ketiganya yang
 * menangani, tahun itu dihitung sebagai "tanpa support" dan porsinya
 * dibagikan lewat skema tanpaSupport - bukan diberikan dua kali.
 */
function tanpaPeranTetap(
  supports: { user_id: string; user_name: string }[],
  ...penunjuk: (string | null | undefined)[]
): { user_id: string; user_name: string }[] {
  const dipakai = penunjuk.filter(Boolean) as string[];
  // Id dan nama saling disilang: satu orang bisa masuk daftar Support lewat
  // username (jalur reminder) sementara di sini dikenal lewat nama lengkap
  // (jalur ticket), atau sebaliknya.
  return supports.filter(s => !dipakai.some(d =>
    orangSama(s.user_id, d) || orangSama(s.user_name, d)));
}

/**
 * Pembagian mengikuti SKEMA yang diatur admin. Angka porsinya tidak ditulis di
 * sini melainkan dibaca dari lib/incentive-scheme.ts (tabel
 * incentive_scheme_settings), supaya perubahan kebijakan cukup dilakukan lewat
 * layar Pengaturan.
 */
export function calculateStandardScheme(
  sk: SkemaInsentif,
  pool: number,
  modePenyelesaian: 'onsite' | 'remote' | null,
  picUserId: string,
  picUserName: string,
  managerUserId: string,
  managerUserName: string,
  supervisorUserId: string,
  supervisorUserName: string,
  assignedSupports: { user_id: string; user_name: string }[],
  installerName?: string | null,
): SplitResult[] {
  // Supervisor merangkap PIC - porsinya dialihkan, bukan dibayar dua kali.
  //
  // Dicocokkan lewat id ATAU nama. Sebelumnya id saja, dan itu nyaris tidak
  // pernah cocok: reminders.pic_id umumnya kosong (kolomnya baru ditambahkan
  // migrasi Incentive dan tidak diisi alur normal), sehingga picUserId ikut
  // kosong dan perbandingannya selalu gagal. Akibatnya orang yang sama muncul
  // DUA KALI pada satu proyek - sebagai PIC dan sebagai Supervisor - lalu
  // dibayar dua kali, persis yang hendak dicegah baris ini.
  const supervisorJadiPic =
    orangSama(picUserId, supervisorUserId) || orangSama(picUserName, supervisorUserName);

  // PIC, Supervisor, dan Manager tidak ikut menerima porsi Support - masing
  // masing sudah dibayar lewat porsi perannya sendiri. Lihat tanpaPeranTetap().
  const support = tanpaPeranTetap(assignedSupports,
    picUserId, picUserName,
    supervisorUserId, supervisorUserName,
    managerUserId, managerUserName);

  const penerima: PenerimaPeran[] = [{ peran: 'pic', user_id: picUserId, user_name: picUserName }];
  for (const s of support) penerima.push({ peran: 'support', user_id: s.user_id, user_name: s.user_name });
  if (supervisorUserId && !supervisorJadiPic) {
    penerima.push({ peran: 'supervisor', user_id: supervisorUserId, user_name: supervisorUserName });
  }
  penerima.push({ peran: 'manager', user_id: managerUserId, user_name: managerUserName });

  return hitungPembagian(
    sk, pool, modePenyelesaian === 'remote', penerima,
    support.length > 0, supervisorJadiPic, installerName,
  ) as SplitResult[];
}

/** Manager sendiri yang menjadi PIC - tanpa slot Supervisor & Manager terpisah. */
export function calculateManagerPicScheme(
  sk: SkemaInsentif,
  pool: number,
  modePenyelesaian: 'onsite' | 'remote' | null,
  dhanyUserId: string,
  dhanyUserName: string,
  installerName?: string | null,
  assignedSupports: { user_id: string; user_name: string }[] = [],
): SplitResult[] {
  // Aturan yang sama berlaku di sini: Manager yang menangani sendiri
  // Troubleshooting proyeknya tidak menerima porsi Support di atas porsi
  // PIC-nya. Tanpa penyaringan ini, Manager-as-PIC yang turun tangan sendiri
  // akan muncul dua kali - sebagai PIC dan sebagai Support.
  const support = tanpaPeranTetap(assignedSupports, dhanyUserId, dhanyUserName);

  return hitungManagerSebagaiPic(
    sk, pool, modePenyelesaian === 'remote', dhanyUserId, dhanyUserName, installerName,
    support.map(s => ({ peran: 'support', user_id: s.user_id, user_name: s.user_name })),
  ) as SplitResult[];
}

export function calculateIncentiveSplits(
  sk: SkemaInsentif,
  project: IncentiveProjectRow,
  managerUserId: string,
  managerUserName: string,
  supervisorUserId: string,
  supervisorUserName: string,
  assignedSupports: { user_id: string; user_name: string }[],
  /**
   * Id PIC yang SUDAH diselesaikan pemanggil lewat resolveUserId().
   *
   * Wajib diteruskan. Sebelumnya fungsi ini memakai project.pic_id mentah,
   * padahal pemanggil sudah bersusah payah menyelesaikannya dari assigned_to
   * dan assign_name - hasilnya dibuang, dan penjagaan "Supervisor merangkap
   * PIC" jadi tidak pernah aktif.
   */
  picUserIdTerselesaikan?: string,
): SplitResult[] {
  const pool = project.incentive_value || 0;
  if (pool <= 0) return [];

  if (project.pic_type === 'manager_pic') {
    //  assignedSupports IKUT diteruskan. Tanpa ini, seluruh perbaikan
    //  "Manager-as-PIC boleh berbagi dengan Support" berhenti di layar
    //  pengaturan dan tidak pernah sampai ke pembayaran.
    return calculateManagerPicScheme(
      sk, pool, project.mode_penyelesaian, managerUserId, managerUserName,
      project.installer_name, assignedSupports,
    );
  }

  return calculateStandardScheme(
    sk, pool, project.mode_penyelesaian,
    picUserIdTerselesaikan || project.pic_id || '', project.assign_name || '',
    managerUserId, managerUserName,
    supervisorUserId, supervisorUserName,
    assignedSupports, project.installer_name,
  );
}

export function validateSplitTotal(splits: SplitResult[], pool: number): { valid: boolean; diff: number } {
  const total = splits.reduce((s, r) => s + r.amount, 0);
  const diff = Math.abs(total - pool);
  return { valid: diff <= 1, diff };
}

// Tranche Generation

/**
 * Tahapan pencairan diambil dari skema, bukan dipatok di sini.
 *
 * Pengecualian yang tetap ada: bila Installer Cabang memang diberi porsi DAN
 * disetel dibayar di muka, tahap terakhir dipindah ke tahun pertama - sebab
 * itulah tahap yang menampung porsinya. Bila porsi Installer 0 (keadaan saat
 * ini), tidak ada yang perlu dipindah dan seluruh tahap berjalan normal.
 */
export function generateTranches(
  sk: SkemaInsentif,
  projectId: string,
  bastDate: string,
  modePenyelesaian?: 'onsite' | 'remote' | null,
): { tranche_number: number; percentage: number; payment_year: number }[] {
  const baseYear = new Date(bastDate).getFullYear();
  const installerDiMuka =
    persenInstaller(sk, modePenyelesaian === 'remote') > 0 && sk.installerBayarDiMuka;
  const terakhir = sk.tranche.length ? Math.max(...sk.tranche.map(t => t.nomor)) : 0;
  return sk.tranche.map(t => ({
    tranche_number: t.nomor,
    percentage: t.persen,
    payment_year: baseYear + (installerDiMuka && t.nomor === terakhir ? 1 : t.tahunKe),
  }));
}

// DB Helpers

export const INCENTIVE_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;

export async function fetchIncentiveProjects() {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .in('category', ['Konfigurasi', 'Konfigurasi & Training', 'Training'])
    .eq('status', 'done')
    .order('due_date', { ascending: false });
  return { data: (data || []) as IncentiveProjectRow[], error };
}

export async function fetchTranches(filters?: { payment_year?: number; status?: string }) {
  let q = supabase.from('incentive_tranches').select('*, project:reminders(*)').order('payment_year');
  if (filters?.payment_year) q = q.eq('payment_year', filters.payment_year);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  return { data: (data || []) as (IncentiveTranche & { project: IncentiveProjectRow })[], error };
}

export async function fetchSplits(projectId?: string) {
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  return { data: (data || []) as IncentiveSplit[], error };
}

/**
 * Baca splits lewat server route dengan filter privasi (admin/allow_incentive_input
 * lihat semua; selain itu hanya jatahnya sendiri). Dipakai UI menggantikan
 * fetchSplits setelah RLS incentive_splits dikunci dari anon.
 */
export async function fetchVisibleSplits(projectId?: string): Promise<{ data: IncentiveSplit[]; error: unknown }> {
  try {
    const url = projectId
      ? `/api/incentive/splits?projectId=${encodeURIComponent(projectId)}`
      : '/api/incentive/splits';
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: [], error: { message: json.error || 'Gagal memuat data incentive' } };
    return { data: (json.data || []) as IncentiveSplit[], error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

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
export async function fetchSupportFromTickets(
  proyek: { id?: string | null; project_name: string },
  rentang?: { dari?: string | null; sampai?: string | null },
): Promise<{ data: { user_id: string; user_name: string }[]; error: unknown }> {
  const dicari = samakanNamaProyek(proyek?.project_name ?? '');
  if (!dicari) return { data: [], error: null };

  // Penyaringan nama dilakukan di sisi aplikasi, bukan di kueri, karena
  // PostgREST tidak bisa menormalkan spasi di sisi basis data. Yang diambil
  // hanya baris yang sudah selesai, jadi jumlahnya kecil - bukan seluruh tabel.
  let qr = supabase
    .from('reminders')
    .select('assigned_to, assign_name, project_name')
    .eq('category', 'Troubleshooting')
    .eq('status', 'done');
  if (rentang?.dari)   qr = qr.gt('due_date', rentang.dari);
  if (rentang?.sampai) qr = qr.lte('due_date', rentang.sampai);

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

  // Sumber 1 - jadwal Troubleshooting yang ditutup selesai.
  for (const r of (rRes.data ?? []) as {
    assigned_to: string | null; assign_name: string | null; project_name: string | null;
  }[]) {
    if (samakanNamaProyek(r.project_name ?? '') !== dicari) continue;
    tambah(r.assigned_to, r.assign_name);
  }

  // Sumber 2 - ticket yang diselesaikan.
  for (const t of (tRes.data ?? []) as {
    id: string; project_name: string | null; reminder_id: string | null;
    date: string | null; assign_name: string | null; activity_logs: BarisAktivitas[] | null;
  }[]) {
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

  return { data: hasil, error: rRes.error ?? tRes.error };
}

export async function fetchLateTickets(parentProjectId?: string) {
  let q = supabase.from('late_ticket_links').select('*').order('attached_at', { ascending: false });
  if (parentProjectId) q = q.eq('parent_project_id', parentProjectId);
  const { data, error } = await q;
  return { data: (data || []) as LateTicketLink[], error };
}

/**
 * Buat tahapan pencairan DAN bekukan skema yang dipakai ke tiap barisnya.
 *
 * Skemanya disalin di sini - bukan dibaca ulang saat pencairan - karena satu
 * proyek dicairkan tiga kali dalam tiga tahun. Tanpa salinan ini, mengubah
 * porsi di tahun ke-2 akan membuat tahap 2 & 3 memakai angka baru sementara
 * tahap 1 sudah dibayar dengan angka lama, dan selisihnya tidak bisa
 * dijelaskan ke Finance yang sudah menerima rekap tahap 1.
 *
 * Yang membeku adalah aturan pada saat proyek SELESAI - itu kebijakan yang
 * berlaku ketika pekerjaannya dikerjakan, jadi itu pula yang seharusnya
 * membayarnya sampai lunas.
 */
export async function insertTranches(sk: SkemaInsentif, projectId: string, bastDate: string, modePenyelesaian?: 'onsite' | 'remote' | null) {
  const tranches = generateTranches(sk, projectId, bastDate, modePenyelesaian);
  const label = labelSkema(sk, new Date().toISOString(), null);
  const rows = tranches.map(t => ({
    project_id: projectId,
    tranche_number: t.tranche_number,
    percentage: t.percentage,
    payment_year: t.payment_year,
    status: 'pending',
    scheme_snapshot: sk as unknown as Record<string, unknown>,
    scheme_label: label,
  }));
  return supabase.from('incentive_tranches').insert(rows);
}

export async function insertSplits(
  projectId: string,
  trancheId: string | null,
  splits: SplitResult[],
  sourceTicketId?: string | null,
) {
  const rows = splits.map(s => ({
    project_id: projectId,
    tranche_id: trancheId,
    role: s.role,
    user_id: s.user_id || null,
    user_name: s.user_name,
    percentage: s.percentage,
    amount: s.amount,
    source_ticket_id: sourceTicketId || null,
  }));
  return supabase.from('incentive_splits').insert(rows);
}

export async function processYearlyBatch(processingYear: number, managerUserId: string, managerUserName: string) {
  const { data: dueTranches, error: fetchErr } = await supabase
    .from('incentive_tranches')
    .select('*, project:reminders(*)')
    .eq('payment_year', processingYear)
    .eq('status', 'pending');

  if (fetchErr || !dueTranches) return { error: fetchErr, processed: 0 };

  /*
    Skema TERKINI dibaca sekali di depan, TAPI ia hanya cadangan.

    Yang dipakai menghitung tiap tahapan adalah salinan skema yang dibekukan
    pada tahapan itu sendiri (scheme_snapshot). Satu proyek dicairkan tiga kali
    dalam tiga tahun; kalau tiap pencairan membaca skema terkini, mengubah
    porsi di tahun ke-2 akan membayar tahap 2 & 3 dengan angka yang berbeda
    dari tahap 1 yang sudah lunas - tanpa jejak bahwa keduanya berbeda.

    Cadangan ini dipakai hanya untuk tahapan yang dibuat SEBELUM pembekuan ada
    (salinannya null). Perilakunya sama seperti sebelumnya, jadi baris lama
    tidak mendadak gagal diproses.
  */
  const skTerkini = await ambilSkema();

  // Baca hierarki dari Struktur Organisasi (users.atasan_id + jabatan).
  // Fallback transisi: pts_team_mappings bila atasan_id belum dipetakan.
  const orgUsers = await fetchOrgUsers();
  type PtsMap = { staff_user_id: string; supervisor_user_id: string; supervisor: { id: string; full_name: string } };
  const { data: ptsTeamData } = await supabase.from('pts_team_mappings').select('staff_user_id, supervisor_user_id, supervisor:users!supervisor_user_id(id, full_name)');

  let processed = 0;
  const errors: string[] = [];

  for (const tranche of dueTranches) {
    const project = tranche.project as unknown as IncentiveProjectRow;
    if (!project) { errors.push(`Tranche ${tranche.id}: project not found`); continue; }

    //  Skema yang membayar tahapan ini = yang dibekukan saat tahapan dibuat.
    const sk = (tranche.scheme_snapshot as SkemaInsentif | null) ?? skTerkini;
    if (!project.mode_penyelesaian) { errors.push(`Project "${project.project_name}": mode_penyelesaian kosong`); continue; }

    // Manager & Supervisor dari pohon atasan PIC (Struktur Organisasi)
    const picId = resolveUserId(project.pic_id || project.assigned_to, project.assign_name, orgUsers);
    const supUp = findUpline(picId, 'Supervisor', orgUsers);
    const mgrUp = findUpline(picId, 'Manager', orgUsers);
    const ptsMap = (ptsTeamData as PtsMap[] | null)?.find(m => m.staff_user_id === project.assigned_to);
    const supervisorUserId   = supUp?.id || ptsMap?.supervisor_user_id || '';
    const supervisorUserName = supUp?.full_name || ptsMap?.supervisor?.full_name || 'Supervisor';
    const projManagerId   = mgrUp?.id || managerUserId;
    const projManagerName = mgrUp?.full_name || managerUserName;

    /*
      Support dinilai untuk TAHAP INI saja, bukan sekali untuk seluruh proyek.
      tahunKe diambil dari jadwal tahapan; kalau nomornya tidak ditemukan
      (skema berubah sesudah tahapan dibuat), jatuh ke selisih tahun pembayaran
      terhadap tahun BAST - keduanya menghasilkan angka yang sama pada jadwal
      normal, dan yang kedua tetap masuk akal saat jadwalnya sudah berubah.
    */
    const tahunKe = sk.tranche.find(t => t.nomor === tranche.tranche_number)?.tahunKe
      ?? Math.max(1, (tranche.payment_year || 0) - new Date(project.bast_date || '').getFullYear());
    const rentangSupport = jendelaSupportTahap(project.bast_date, tahunKe);
    const { data: supports } = await fetchSupportFromTickets(project, rentangSupport);
    const splits = calculateIncentiveSplits(
      sk, project, projManagerId, projManagerName,
      supervisorUserId, supervisorUserName,
      (supports || []).map(s => ({ user_id: s.user_id, user_name: s.user_name || '' })),
      picId,
    );

    const pool = project.incentive_value || 0;

    // Porsi Installer & tahapan pencairan
    // Bila Installer Cabang diberi porsi DAN disetel dibayar di muka, tahap
    // terakhir menampung porsinya utuh dan porsi Tim PTS dibagi ke tahap
    // sisanya sebanding dengan persentase tahap itu. Cara ini membuat jumlahnya
    // tetap tepat berapa pun angka yang disetel admin, bukan hanya saat porsi
    // Installer kebetulan sama dengan persentase tahap terakhir.
    const pctInstaller = persenInstaller(sk, project.mode_penyelesaian === 'remote');
    const tahapTerakhir = sk.tranche.length ? Math.max(...sk.tranche.map(t => t.nomor)) : 0;
    const installerAmbilTahapTerakhir = pctInstaller > 0 && sk.installerBayarDiMuka;
    const tahapTim = sk.tranche.filter(t => !installerAmbilTahapTerakhir || t.nomor !== tahapTerakhir);
    const totalTahapTim = tahapTim.reduce((n, t) => n + (t.persen || 0), 0) || 100;

    let trancheSplits: SplitResult[];
    let tranchePool: number;

    if (installerAmbilTahapTerakhir && tranche.tranche_number === tahapTerakhir) {
      tranchePool = Math.round((pool * pctInstaller) / 100);
      trancheSplits = [{
        role: 'installer', user_id: '',
        user_name: project.installer_name || 'Installer Cabang',
        percentage: pctInstaller, amount: tranchePool,
      }];
    } else {
      // Bagian tahap ini terhadap seluruh porsi Tim PTS.
      const bagian = (tranche.percentage || 0) / totalTahapTim;
      //  Pool tahap ini DIBULATKAN dulu. Sebelumnya ia dibiarkan pecahan
      //  (mis. 13.259.488,50) lalu dibandingkan dengan jumlah rupiah bulat -
      //  perbandingan yang tidak pernah bisa pas, dan itulah sebab separuh
      //  tranche ditolak "split total mismatch" padahal angkanya benar.
      tranchePool = Math.round(pool * ((100 - pctInstaller) / 100) * bagian);
      const timSaja = splits.filter(s => s.role !== 'installer');
      //  Dibagi habis ke sesama anggota tim: persentase dinormalkan ke porsi
      //  tim (bukan ke pool penuh) supaya jumlahnya persis tranchePool.
      const totalPctTim = timSaja.reduce((n, s) => n + s.percentage, 0) || 1;
      const rupiahTahap = bagikanTepat(tranchePool, timSaja.map(s => (s.percentage / totalPctTim) * 100));
      trancheSplits = timSaja.map((s, i) => ({ ...s, amount: rupiahTahap[i] }));
    }

    const validation = validateSplitTotal(trancheSplits, tranchePool);
    if (!validation.valid) {
      errors.push(`Project "${project.project_name}" tranche ${tranche.tranche_number}: split total mismatch (diff: Rp ${validation.diff})`);
      continue;
    }

    const { error: splitErr } = await insertSplits(project.id, tranche.id, trancheSplits);
    if (splitErr) { errors.push(`Insert splits failed: ${splitErr.message}`); continue; }

    await supabase.from('incentive_tranches').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', tranche.id);
    processed++;
  }

  return { processed, errors, total: dueTranches.length };
}

// Formatting

export function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export function formatPct(n: number): string {
  return n.toFixed(1) + '%';
}

export const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pic:        { label: 'PIC',        color: '#2563eb', bg: 'rgba(37,99,235,0.12)'   },
  support:    { label: 'Support',    color: '#7c3aed', bg: 'rgba(124,58,237,0.12)'  },
  supervisor: { label: 'Supervisor', color: '#0891b2', bg: 'rgba(8,145,178,0.12)'   },
  manager:    { label: 'Manager',    color: '#059669', bg: 'rgba(5,150,105,0.12)'   },
  installer:  { label: 'Installer',  color: '#d97706', bg: 'rgba(217,119,6,0.12)'   },
};

export const TRANCHE_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#92400e', bg: '#fef3c7', icon: '⏳' },
  processed: { label: 'Processed', color: '#1e40af', bg: '#dbeafe', icon: '📋' },
  paid:      { label: 'Paid',      color: '#065f46', bg: '#d1fae5', icon: '✅' },
};
