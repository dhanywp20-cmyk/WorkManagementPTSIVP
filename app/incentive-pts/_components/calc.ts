import { supabase } from '@/lib/supabase';
import { gabungkanProyek } from '@/lib/kelompok-insentif';
import {
  SkemaInsentif, PenerimaPeran, hitungPembagian, hitungManagerSebagaiPic, ambilSkema,
  persenInstaller, persenPicBerlaku, petaPorsiBerlaku, bagikanTepat, labelSkema, INCENTIVE_CATEGORIES,
} from '@/lib/incentive-scheme';

export type { SkemaInsentif };
export { ambilSkema, persenInstaller, persenPicBerlaku, petaPorsiBerlaku, bagikanTepat, labelSkema };

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
  /** true = sengaja dikeluarkan dari perhitungan insentif; jadwalnya tetap ada. */
  incentive_excluded?: boolean | null;
  /**
   * Pengikat jadwal multi-tanggal: lima hari berturut-turut = lima baris
   * reminder dengan batch_id yang sama, tapi SATU proyek insentif.
   * Lihat gabungkanPerBatch().
   */
  batch_id?: string | null;
  /**
   * Beberapa jadwal terpisah yang merupakan SATU proyek (mis. Konfigurasi
   * Senin + Training tiga hari kemudian). Hanya diisi lewat keputusan manusia -
   * lihat lib/kelompok-insentif.ts dan sql/incentive-kelompok-proyek.sql.
   */
  incentive_group_id?: string | null;
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
 * TAHAPAN INI MILIK TIM PTS. Installer TIDAK punya tahapnya sendiri.
 *
 * Bentuk sebelumnya memindahkan tahap TERAKHIR ke tahun pertama supaya tahap
 * itu bisa dipakai menampung porsi Installer. Akibatnya, pada proyek Remote,
 * Tim PTS hanya dibayar dua kali (tahap 1 dan 2) dan tahun ketiga hilang -
 * padahal yang dibayar penuh di muka hanyalah porsi Installer, bukan porsi
 * siapa pun di Tim PTS.
 *
 * Sekarang seluruh tahap tetap pada tahunnya masing-masing (BAST + tahunKe),
 * dan porsi Installer dititipkan sebagai BARIS TAMBAHAN di tahap pertama -
 * lihat processYearlyBatch. Jadi tiap orang di Tim PTS tetap menerima
 * porsinya sendiri yang dipecah 50/35/15 selama tiga tahun, sementara
 * Installer menerima 15% miliknya sekali lunas di tahun pertama.
 */
export function generateTranches(
  sk: SkemaInsentif,
  projectId: string,
  bastDate: string,
  modePenyelesaian?: 'onsite' | 'remote' | null,
): { tranche_number: number; percentage: number; payment_year: number }[] {
  void modePenyelesaian;
  const baseYear = new Date(bastDate).getFullYear();
  return sk.tranche.map(t => ({
    tranche_number: t.nomor,
    percentage: t.persen,
    payment_year: baseYear + t.tahunKe,
  }));
}

// DB Helpers

// Dipindah ke lib/incentive-scheme.ts - lihat catatan di sana. Di-ekspor
// ulang supaya pemanggil lama tidak perlu diubah.
export { INCENTIVE_CATEGORIES };

/**
 * Apakah kolom `incentive_excluded` sudah ada di basis data ini.
 *
 * null = belum diketahui. Disimpan di tingkat modul supaya jawabannya berlaku
 * untuk sisa sesi, bukan ditanyakan ulang tiap kali daftar dimuat.
 */
let kolomKeluarkanAda: boolean | null = null;

/**
 * Daftar proyek insentif.
 *
 * PENYARINGAN "dikeluarkan" DIBUAT TAHAN bila kolomnya belum dipasang.
 *
 * Ini bukan kehati-hatian yang berlebihan - persis inilah yang terjadi. Saat
 * penyaring `.not('incentive_excluded', ...)` pertama kali dipasang, kolomnya
 * belum ada di produksi; PostgREST menolak SELURUH kueri, dan daftar Incentive
 * tampil KOSONG. Bukan pesan galat, bukan daftar sebagian - kosong, seolah
 * tidak ada satu pun proyek. Kode aplikasi dan skema basis data tidak pernah
 * mendarat pada detik yang sama, jadi jeda di antaranya harus tetap bisa
 * dipakai bekerja.
 *
 * Bila kolomnya memang belum ada, daftarnya tetap tampil utuh - hanya fitur
 * "keluarkan" yang belum berfungsi, dan itu memang belum dipasang.
 */
/*
  Penggabungan jadwal jadi satu proyek insentif pindah ke lib/kelompok-insentif.ts.

  Sebabnya bukan kerapian: aturannya kini dipakai DUA layar - daftar insentif di
  sini dan pertanyaan "kelanjutan atau terpisah?" saat jadwal dibuat. Dua salinan
  aturan uang yang bisa menyimpang diam-diam adalah cara paling mudah membuat
  layar dan basis data tidak sepakat.
*/
export { gabungkanProyek, deteksiKandidatGabung, idUntukDigabung } from '@/lib/kelompok-insentif';
export type { KandidatGabung } from '@/lib/kelompok-insentif';

/**
 * Satukan beberapa jadwal jadi satu proyek insentif. Dipanggil tombol
 * "Gabungkan" - tidak pernah otomatis.
 *
 * Yang ditandai BUKAN hanya baris wakilnya. Jadwal 5 hari diwakili satu baris
 * di layar, tapi kelimanya harus ikut - kalau tidak, empat sisanya tetap
 * berdiri sendiri dan proyeknya muncul lagi sebagai duplikat begitu daftar
 * dimuat ulang.
 *
 * Penandaannya lewat batch_id, bukan dengan mengambil dulu seluruh barisnya:
 * satu perintah update per batch, tanpa satu pun pembacaan tambahan.
 */
export async function satukanProyek(
  anggota: { id: string; batch_id?: string | null }[],
): Promise<{ error: { message: string } | null; grup: string }> {
  const grup = crypto.randomUUID();
  const batchIds = [...new Set(anggota.map(a => a.batch_id).filter(Boolean))] as string[];
  const idLepas = anggota.filter(a => !a.batch_id).map(a => a.id);

  const hasil: { error: { message: string } | null }[] = [];
  if (batchIds.length > 0) {
    hasil.push(await supabase.from('reminders')
      .update({ incentive_group_id: grup }).in('batch_id', batchIds));
  }
  if (idLepas.length > 0) {
    hasil.push(await supabase.from('reminders')
      .update({ incentive_group_id: grup }).in('id', idLepas));
  }
  const gagal = hasil.find(r => r.error)?.error ?? null;
  return { error: gagal, grup };
}

/**
 * Batalkan penggabungan.
 *
 * Ada karena keputusan soal uang harus bisa dicabut. Menggabungkan dua proyek
 * yang ternyata memang terpisah akan menghilangkan satu pool - dan tanpa jalan
 * kembali, satu-satunya cara membetulkannya adalah menyunting basis data
 * langsung.
 */
export async function pisahkanProyek(grup: string) {
  return await supabase.from('reminders')
    .update({ incentive_group_id: null }).eq('incentive_group_id', grup);
}

export async function fetchIncentiveProjects() {
  const dasar = () => supabase
    .from('reminders')
    .select('*')
    .in('category', INCENTIVE_CATEGORIES as unknown as string[])
    .eq('status', 'done')
    .order('due_date', { ascending: false });

  if (kolomKeluarkanAda !== false) {
    // `not.is.true` DIPILIH karena ia juga meloloskan baris NULL; `neq.true`
    // tidak, dan itu akan menyembunyikan seluruh proyek lama yang kolomnya
    // belum pernah diisi.
    const r = await dasar().not('incentive_excluded', 'is', true);
    if (!r.error) {
      kolomKeluarkanAda = true;
      return { data: gabungkanProyek((r.data || []) as IncentiveProjectRow[]), error: r.error };
    }
    if (!/does not exist/i.test(r.error.message)) {
      // Galat lain - jangan disembunyikan di balik percobaan kedua.
      return { data: [] as IncentiveProjectRow[], error: r.error };
    }
    kolomKeluarkanAda = false;
    console.warn(
      '[incentive] kolom incentive_excluded belum ada - daftar ditampilkan utuh. ' +
      'Jalankan sql/incentive-keluarkan-proyek.sql untuk mengaktifkan fitur "keluarkan dari Incentive".');
  }

  const r2 = await dasar();
  return { data: gabungkanProyek((r2.data || []) as IncentiveProjectRow[]), error: r2.error };
}

/**
 * Keluarkan / masukkan kembali proyek ke daftar Incentive PTS.
 *
 * Yang berubah hanya penanda; jadwalnya di Request Schedule tidak disentuh.
 * Pemeriksaan "tahapan sudah diproses" dilakukan pemanggil sebelum sampai ke
 * sini, karena pesannya perlu menyebut proyek yang mana.
 */
export async function setProyekDikeluarkan(ids: string[], keluar: boolean) {
  if (!ids.length) return { error: null };
  const { error } = await supabase
    .from('reminders')
    .update({ incentive_excluded: keluar })
    .in('id', ids);
  return { error };
}

/**
 * Tahapan pencairan yang UANGNYA SUDAH BERJALAN untuk sekumpulan proyek.
 *
 * Dipakai menolak penghapusan: rekap yang sudah diterima Finance tidak boleh
 * kehilangan proyeknya, karena angka di rekap itu jadi tidak bisa dijelaskan.
 */
export async function tahapanSudahJalan(projectIds: string[]) {
  if (!projectIds.length) return { data: [] as { project_id: string; status: string }[], error: null };
  const { data, error } = await supabase
    .from('incentive_tranches')
    .select('project_id, status')
    .in('project_id', projectIds)
    .in('status', ['processed', 'paid']);
  return { data: (data || []) as { project_id: string; status: string }[], error };
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

    /*
      PORSI INSTALLER vs TAHAPAN TIM PTS - dua hal yang berbeda.

      Tim PTS: porsi tiap orang dipecah menurut tahapan (50/35/15), jadi
      seseorang yang porsinya Rp 500.000 menerima 250rb, 175rb, lalu 75rb -
      tiga tahun berturut-turut.

      Installer: 15% miliknya dibayar LUNAS sekali, di tahap pertama. Ia tidak
      ikut dipecah tiga tahun. Karena itu porsinya dititipkan sebagai baris
      tambahan pada tahap pertama, BUKAN dengan mengambil alih tahap terakhir
      seperti sebelumnya - cara lama itu menghapus pencairan tahun ketiga
      untuk seluruh Tim PTS, bukan hanya untuk Installer.

      Bila `installerBayarDiMuka` dimatikan, Installer diperlakukan sama
      seperti Tim PTS: porsinya ikut dipecah ke tiap tahap.
    */
    /*
      Persentase diambil dari `splits` - hasil hitungPembagian - BUKAN dihitung
      ulang di sini.

      Sebelumnya porsi Installer dibaca lewat persenInstaller(), yang hanya
      melihat kolom "Porsi Installer". Padahal saat tabel Porsi Remote diatur
      sendiri, porsi Installer yang berlaku diambil dari BARIS installer di
      tabel itu. Kalau keduanya disetel berbeda, pool Tim PTS dipotong dengan
      satu angka sementara Installer dibayar dengan angka lain - jumlahnya
      tidak lagi sama dengan pool, dan seluruh tranche ditolak "split total
      mismatch". Membaca dari splits menghapus kemungkinan itu: yang memotong
      dan yang membayar kini sumbernya sama persis.
    */
    const barisInstaller = splits.find(s => s.role === 'installer');
    const pctInstaller = barisInstaller?.percentage ?? 0;
    const tahapPertama = sk.tranche.length ? Math.min(...sk.tranche.map(t => t.nomor)) : 1;
    const installerDiMuka = pctInstaller > 0 && sk.installerBayarDiMuka;
    const totalTahapTim = sk.tranche.reduce((n, t) => n + (t.persen || 0), 0) || 100;

    // Bagian tahap ini terhadap seluruh porsi Tim PTS (mis. 50/100).
    const bagian = (tranche.percentage || 0) / totalTahapTim;

    const timSaja = splits.filter(s => s.role !== 'installer');

    //  Rupiah "ideal" (masih pecahan) tiap penerima pada tahap ini: porsinya
    //  sendiri terhadap pool, lalu dipecah menurut tahapan. Inilah kebijakannya
    //  apa adanya - "porsi Anda Rp 500.000, dibayar 50/35/15 selama 3 tahun".
    const komponen: { split: SplitResult; ideal: number }[] = timSaja.map(s => ({
      split: s,
      ideal: pool * (s.percentage / 100) * bagian,
    }));

    if (pctInstaller > 0) {
      const idealInstaller = installerDiMuka
        ? (tranche.tranche_number === tahapPertama ? (pool * pctInstaller) / 100 : 0)
        : pool * (pctInstaller / 100) * bagian;
      if (idealInstaller > 0) {
        komponen.push({
          split: {
            ...(barisInstaller ?? {
              role: 'installer', user_id: '',
              user_name: project.installer_name || 'Installer Cabang',
              percentage: pctInstaller,
            }),
            amount: 0,
          },
          ideal: idealInstaller,
        });
      }
    }

    //  Pool tahap ini DIBULATKAN dulu. Sebelumnya ia dibiarkan pecahan
    //  (mis. 13.259.488,50) lalu dibandingkan dengan jumlah rupiah bulat -
    //  perbandingan yang tidak pernah bisa pas, dan itulah sebab separuh
    //  tranche ditolak "split total mismatch" padahal angkanya benar.
    const tranchePool = Math.round(komponen.reduce((n, k) => n + k.ideal, 0));
    //  Dibagi habis: persentase dinormalkan ke pool TAHAP INI (bukan ke pool
    //  proyek) supaya jumlah seluruh baris persis sama dengan tranchePool.
    const rupiahTahap = bagikanTepat(
      tranchePool,
      komponen.map(k => (tranchePool > 0 ? (k.ideal / tranchePool) * 100 : 0)),
    );
    const trancheSplits: SplitResult[] = komponen.map((k, i) => ({ ...k.split, amount: rupiahTahap[i] }));

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

// Pembatalan (rollback)

/*
  DUA PEMBATALAN, DUA TINGKAT - dan keduanya menolak menyentuh yang sudah Paid.

  Ini ada supaya seluruh alur insentif bisa diuji tanpa mempertaruhkan data
  yang sudah jadi. Tanpa jalan kembali, satu kali salah pencet pada Process
  Batch akan meninggalkan baris pembagian yang tidak bisa dicabut, dan
  satu-satunya cara membersihkannya adalah menghapus baris lewat SQL langsung
  di produksi - persis keadaan yang paling mudah membuat celaka.

  YANG SUDAH `paid` TIDAK PERNAH BISA DIBATALKAN dari sini. Status itu berarti
  uangnya sudah keluar; membatalkannya di layar tidak menarik uang itu kembali,
  ia hanya membuat catatan platform tidak lagi cocok dengan yang benar-benar
  terjadi. Bila memang ada kekeliruan pada tahap yang sudah dibayar, itu
  perkara koreksi pembukuan, bukan tombol.
*/

export interface HasilPembatalan {
  /** Jumlah tahapan yang dikembalikan / dihapus. */
  jumlah: number;
  /** Tahapan yang DILEWATI karena sudah berstatus paid. */
  dilewati: number;
  error: { message: string } | null;
}

/**
 * Batalkan hasil Process Batch satu tahun: hapus baris pembagian yang dibuat
 * batch itu, lalu kembalikan tahapannya dari `processed` ke `pending`.
 *
 * Tahapannya sendiri TIDAK dihapus - yang dibatalkan hanya pemrosesannya,
 * sehingga batch tahun itu bisa dijalankan ulang setelah datanya dibetulkan.
 */
export async function batalkanBatchTahun(paymentYear: number): Promise<HasilPembatalan> {
  const { data: semua, error: bacaErr } = await supabase
    .from('incentive_tranches')
    .select('id, status')
    .eq('payment_year', paymentYear);
  if (bacaErr) return { jumlah: 0, dilewati: 0, error: bacaErr };

  const baris = (semua ?? []) as { id: string; status: string }[];
  const bisa = baris.filter(t => t.status === 'processed');
  const dilewati = baris.filter(t => t.status === 'paid').length;
  if (bisa.length === 0) return { jumlah: 0, dilewati, error: null };

  const ids = bisa.map(t => t.id);

  //  Pembagian dihapus LEBIH DULU. Kalau urutannya dibalik dan penghapusan
  //  split gagal, tahapannya sudah terlanjur jadi `pending` sementara baris
  //  pembagiannya masih ada - menjalankan batch lagi akan menambah set kedua
  //  di atas yang lama, dan orang dibayar dua kali.
  const { error: hapusErr } = await supabase.from('incentive_splits').delete().in('tranche_id', ids);
  if (hapusErr) return { jumlah: 0, dilewati, error: hapusErr };

  const { error: ubahErr } = await supabase
    .from('incentive_tranches')
    .update({ status: 'pending', processed_at: null })
    .in('id', ids);
  if (ubahErr) return { jumlah: 0, dilewati, error: ubahErr };

  return { jumlah: bisa.length, dilewati, error: null };
}

/**
 * Hapus SELURUH tahapan pencairan satu proyek, berikut pembagiannya.
 *
 * Dipakai bila tahapannya memang ter-generate keliru - mis. nominal pool salah,
 * atau skemanya baru dibetulkan sesudah tahapan dibuat. Sesudah ini, nominal
 * proyek terbuka lagi untuk disunting dan tahapannya bisa dibuat ulang.
 */
export async function hapusTahapanProyek(projectId: string): Promise<HasilPembatalan> {
  const { data: semua, error: bacaErr } = await supabase
    .from('incentive_tranches')
    .select('id, status')
    .eq('project_id', projectId);
  if (bacaErr) return { jumlah: 0, dilewati: 0, error: bacaErr };

  const baris = (semua ?? []) as { id: string; status: string }[];
  const sudahDibayar = baris.filter(t => t.status === 'paid').length;
  if (sudahDibayar > 0) {
    return {
      jumlah: 0, dilewati: sudahDibayar,
      error: { message: `Proyek ini punya ${sudahDibayar} tahapan berstatus Paid — tahapannya tidak boleh dihapus.` },
    };
  }
  if (baris.length === 0) return { jumlah: 0, dilewati: 0, error: null };

  const ids = baris.map(t => t.id);
  //  Split dihapus lewat project_id, bukan hanya tranche_id: baris pembagian
  //  yang tranche_id-nya null (dibuat sebelum tahapan ada) juga ikut, kalau
  //  tidak ia tertinggal sebagai yatim yang tetap terhitung di rekap.
  const { error: hapusSplit } = await supabase.from('incentive_splits').delete().eq('project_id', projectId);
  if (hapusSplit) return { jumlah: 0, dilewati: 0, error: hapusSplit };

  const { error: hapusTr } = await supabase.from('incentive_tranches').delete().in('id', ids);
  if (hapusTr) return { jumlah: 0, dilewati: 0, error: hapusTr };

  return { jumlah: baris.length, dilewati: 0, error: null };
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
