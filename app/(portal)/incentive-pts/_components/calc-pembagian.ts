/** calc-pembagian.ts - dipecah dari calc.ts (scripts/pecah-modul.mjs); calc.ts tetap mengekspor ulang semuanya. */
import { PenerimaPeran, SkemaInsentif, hitungManagerSebagaiPic, hitungPembagian } from '@/lib/incentive-scheme';
import { supabase } from '@/lib/supabase';
import { IncentiveProjectRow, SplitResult } from './calc-tipe';

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

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve user id dari kandidat id ATAU nama. reminders.assigned_to belum tentu
// UUID user - fallback cocokkan via full_name (assign_name) supaya walk-up atasan jalan.
export function resolveUserId(idCandidate: string | null | undefined, nameCandidate: string | null | undefined, users: OrgUser[]): string {
  if (idCandidate && users.some(u => u.id === idCandidate)) return idCandidate;
  const nm = (nameCandidate || '').toLowerCase().trim();
  if (nm) {
    const byName = users.find(u => (u.full_name || '').toLowerCase().trim() === nm);
    if (byName) return byName.id;
  }
  /*
    Fallback TERAKHIR: idCandidate dipakai apa adanya HANYA kalau memang
    berbentuk UUID (mis. user asli yang kebetulan belum termuat di `users`).

    Bug nyata: pemanggil sering mengoper `project.pic_id || project.assigned_to`
    sebagai idCandidate - assigned_to itu USERNAME (mis. "Ferdinan_PTSIVP"),
    bukan UUID. Kalau pencocokan nama di atas juga gagal (mis. assign_name
    tidak persis sama dengan full_name di Struktur Organisasi), baris ini dulu
    mengembalikan username itu apa adanya - lalu meledak saat ditulis ke kolom
    UUID (incentive_splits.user_id dkk): "invalid input syntax for type uuid".
    Kosong di sini berarti split tetap tercatat tanpa user_id - jauh lebih
    aman daripada menulis nilai yang pasti ditolak database.
  */
  return (idCandidate && UUID_RE.test(idCandidate)) ? idCandidate : '';
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
  installerUserId?: string | null,
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
    support.length > 0, supervisorJadiPic, installerName, installerUserId,
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
  installerUserId?: string | null,
): SplitResult[] {
  // Aturan yang sama berlaku di sini: Manager yang menangani sendiri
  // Troubleshooting proyeknya tidak menerima porsi Support di atas porsi
  // PIC-nya. Tanpa penyaringan ini, Manager-as-PIC yang turun tangan sendiri
  // akan muncul dua kali - sebagai PIC dan sebagai Support.
  const support = tanpaPeranTetap(assignedSupports, dhanyUserId, dhanyUserName);

  return hitungManagerSebagaiPic(
    sk, pool, modePenyelesaian === 'remote', dhanyUserId, dhanyUserName, installerName,
    support.map(s => ({ peran: 'support', user_id: s.user_id, user_name: s.user_name })),
    installerUserId,
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
      project.installer_name, assignedSupports, project.installer_user_id,
    );
  }

  return calculateStandardScheme(
    sk, pool, project.mode_penyelesaian,
    picUserIdTerselesaikan || project.pic_id || '', project.assign_name || '',
    managerUserId, managerUserName,
    supervisorUserId, supervisorUserName,
    assignedSupports, project.installer_name, project.installer_user_id,
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
