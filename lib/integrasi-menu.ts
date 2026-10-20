/**
 * lib/integrasi-menu.ts - aksi BACA DIWAYPI untuk menu di luar tahap 1-2: Request Design Project
 * (detail + hak per tombol), persetujuan tiket, Tech Note, Unit Movement, Form Review, Piket
 * Showroom, KPI Team, Incentive PTS (bagian sendiri), Learning Center, Summary Project.
 *
 * Aturan lihat tiap menu disalin dari halamannya (dikutip di tiap fungsi) dan dipasang DI
 * QUERY - sama dengan halaman - di atas RLS yang berlaku karena `db` = klien pemilik token.
 * hakDesain() diekspor: sisi tulis (lib/integrasi-tulis.ts) memakai aturan yang sama persis
 * untuk menolak sebelum menulis apa pun.
 */
import { hasFullAccess } from '@/lib/constants';
import { filterLingkup, type LingkupProject } from '@/lib/project-scope';
import { bisaLihatSemuaTamu } from '@/lib/piket-akses';
import {
  BARIS, adalahPTS, akunTambahan, bersih, gagal, hariIniWIB, idSah, peranDari, samaNama, tglSah,
  type AkunTambahan, type HasilAksi, type KonteksAksi,
} from '@/lib/integrasi-bantu';

type Baris = Record<string, unknown>;
type Aksi = (a: Record<string, unknown>, k: KonteksAksi) => Promise<HasilAksi>;
const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

// ================================================================ Request Design Project
export interface RuanganDesain {
  room_name?: string | null; status?: string | null; assign_name?: string | null; assign_user_id?: string | null;
  approved_by?: string | null; approved_at?: string | null;
}
export interface RequestDesain {
  id: string; project_name: string; room_name: string | null; project_location?: string | null;
  sales_name: string | null; sales_division: string | null; requester_id: string | null; requester_name: string | null;
  status: string; routing_status?: string | null; assign_name: string | null; assign_user_id?: string | null;
  assigned_supervisor_id?: string | null; ivp_assignee?: string | null; due_date?: string | null; created_at?: string;
  rejection_reason?: string | null; rooms?: RuanganDesain[] | null;
  internal_sales_id?: string | null; internal_sales_id_2?: string | null;
  internal_approved_at?: string | null; internal_approved_at_2?: string | null;
}

/** getRoomStatus / getRoomAssignName (form-require-project/_components/shared.ts). */
export const statusRuangan = (r: RequestDesain, i: number) => (i === 0 ? r.status : r.rooms?.[i - 1]?.status ?? r.status);
export const handlerRuangan = (r: RequestDesain, i: number) =>
  (i === 0 ? r.assign_name : r.rooms?.[i - 1]?.assign_name ?? r.assign_name) ?? null;
export const namaRuangan = (r: RequestDesain, i: number) =>
  (i === 0 ? r.room_name : r.rooms?.[i - 1]?.room_name)?.trim() || `Ruangan ${i + 1}`;

/** `ruangan`: nomor 1..n (1 = ruangan pertama) atau nama ruangan. Bawaan ruangan pertama. */
export function indeksRuangan(a: Record<string, unknown>, r: RequestDesain): number | null {
  const v = a.ruangan;
  if (v === undefined || v === null || v === '') return 0;
  const total = 1 + (r.rooms?.length ?? 0);
  const n = typeof v === 'number' ? v : /^\d+$/.test(String(v).trim()) ? parseInt(String(v), 10) : NaN;
  if (!Number.isNaN(n)) return n >= 1 && n <= total ? n - 1 : null;
  for (let i = 0; i < total; i++) if (samaNama(i === 0 ? r.room_name : r.rooms?.[i - 1]?.room_name, String(v))) return i;
  return null;
}

/** Sales Internal pengulas (utama / kedua utk brand BOTH) yang bagiannya belum di-approve. */
export function bolehReviewInternal(r: RequestDesain, uid: string): boolean {
  if (r.routing_status !== 'internal_review') return false;
  if (uid === r.internal_sales_id && !r.internal_approved_at) return true;
  return uid === r.internal_sales_id_2 && !r.internal_approved_at_2;
}

export interface HakDesain {
  /** Pilihan Update Status yang tampil di ModalUpdateStatus untuk ruangan ini. */
  ubah_status: string[];
  /** Approve & Assign PTS (approve awal, hanya ruangan pertama). */
  approve: boolean;
  /** Supervisor yang di-route: assign lanjut ke tim / kerjakan sendiri. */
  assign_supervisor: boolean;
  /** Re-assign Tim PTS dari Admin Controls. */
  reassign: boolean;
  /** Opsi "Route ke Supervisor" di popup assign. */
  route_supervisor: boolean;
  tolak: boolean;
  review_internal: boolean;
  ajukan_ulang: boolean;
  pesan: boolean;
  alasan_pesan?: string;
}

/**
 * Hak tiap tombol Request Design untuk satu ruangan - form-require-project/page.tsx (isPTS,
 * isTeamPTS, bisaKelolaRequest, canSetInProgress, canInternalApproveProject), HeaderDetail.tsx,
 * ModalUpdateStatus.tsx, KontrolAdminDetail.tsx, BlokAssignPTS.tsx, ModalDetailRequest.tsx,
 * usePesanLampiran.ts. Dipakai baca (aksi_tersedia) DAN tulis (penolakan sebelum menulis).
 */
export function hakDesain(r: RequestDesain, u: KonteksAksi['u'], t: AkunTambahan, i: number): HakDesain {
  const role = peranDari(u);
  const me = u.full_name ?? '';
  const isPTS = adalahPTS(u);
  const isTeamPTS = role === 'team_pts' || role === 'team';
  const kelola = role === 'admin' || role === 'superadmin' || hasFullAccess(u);
  const st = statusRuangan(r, i);
  const handler = handlerRuangan(r, i);
  const pending = st === 'pending';
  const ditugaskan = !!me && handler === me;

  let ubah: string[] = [];
  if (isPTS && !pending && (kelola || ditugaskan)) {
    ubah = ['pending', 'in_progress', 'completed', ...(kelola ? ['approved', 'rejected'] : [])].filter(s => {
      if (s === st) return false;
      if (s === 'in_progress' && !(isPTS && (kelola || ditugaskan))) return false;
      if (s === 'completed' && isTeamPTS && !ditugaskan) return false;
      return true;
    });
  }
  const internal = bolehReviewInternal(r, u.id);
  const approve = kelola && i === 0 && pending && r.routing_status !== 'internal_review';
  const assignSup = i === 0 && r.routing_status === 'supervisor_assign' && r.assigned_supervisor_id === u.id;
  const reassign = isPTS && !isTeamPTS && st !== 'pending' && st !== 'rejected';

  const pemilik = r.requester_id === u.id;
  const ivpGuest = role === 'guest' && !t.pimpinan && (u.sales_division === 'IVP' || u.sales_division === 'MVI');
  let alasan: string | undefined;
  if (r.status === 'rejected') alasan = 'Request ini sudah ditolak. Tidak bisa mengirim pesan.';
  else if (r.status === 'pending' && !isPTS) alasan = 'Request masih pending approval. Chat akan aktif setelah diapprove.';
  else if (!(isPTS || pemilik || (ivpGuest && r.ivp_assignee === me))) alasan = 'Anda tidak memiliki akses untuk mengirim pesan.';

  return {
    ubah_status: ubah,
    approve,
    assign_supervisor: assignSup,
    reassign,
    route_supervisor: (approve || reassign) && i === 0 && r.routing_status !== 'supervisor_assign',
    tolak: approve || internal,
    review_internal: internal,
    ajukan_ulang: r.status === 'rejected' && !isPTS && (pemilik || samaNama(r.sales_name, me)),
    pesan: !alasan,
    ...(alasan ? { alasan_pesan: alasan } : {}),
  };
}

/** Aturan tampilan halaman untuk Team PTS biasa: hanya request yang sudah di-assign / di-route ke dia. */
export function terlihatTeamPTS(r: { assign_name?: string | null; assigned_supervisor_id?: string | null }, u: KonteksAksi['u']): boolean {
  const role = peranDari(u);
  if (!((role === 'team_pts' || role === 'team') && u.jabatan !== 'Manager')) return true;
  return !!r.assign_name || r.assigned_supervisor_id === u.id;
}

/** Satu request yang boleh dilihat pemilik token, atau galat yang bisa diucapkan. */
export async function muatRequestDesain(id: unknown, k: KonteksAksi): Promise<RequestDesain | HasilAksi> {
  const rid = idSah(id);
  if (!rid) return gagal('id request tidak sah (ambil dari desain_cari).');
  const { data, error } = await k.db.from('project_requests').select('*').eq('id', rid).maybeSingle();
  if (error) return gagal(error.message);
  const r = data as RequestDesain | null;
  if (!r || !terlihatTeamPTS(r, k.u)) return gagal('Request tidak ditemukan atau Anda tidak punya akses.');
  return r;
}
export const adalahGalat = (x: unknown): x is HasilAksi => !!x && typeof x === 'object' && (x as HasilAksi).ok === false;

const desainDetail: Aksi = async (a, k) => {
  const r = await muatRequestDesain(a.id, k);
  if (adalahGalat(r)) return r;
  const i = indeksRuangan(a, r);
  if (i === null) return gagal(`Ruangan tidak ada. Request ini punya ${1 + (r.rooms?.length ?? 0)} ruangan.`);
  const [{ data: pesan }, { data: lampiran }, t] = await Promise.all([
    k.db.from('project_messages').select('sender_name, sender_role, message, created_at').eq('request_id', r.id)
      .order('created_at', { ascending: false }).limit(20),
    k.db.from('project_attachments').select('file_name, attachment_category, uploaded_by, created_at, file_url')
      .eq('request_id', r.id).order('created_at', { ascending: false }).limit(30),
    akunTambahan(k),
  ]);
  const ruangan = [0, ...(r.rooms ?? []).map((_, j) => j + 1)].map(j => ({
    nomor: j + 1, nama: namaRuangan(r, j), status: statusRuangan(r, j), handler: handlerRuangan(r, j) ?? null,
  }));
  return {
    ok: true,
    request: {
      id: r.id, project_name: r.project_name, lokasi: r.project_location ?? null, sales: r.sales_name, divisi: r.sales_division,
      requester: r.requester_name, status: r.status, routing_status: r.routing_status ?? null, handler: r.assign_name,
      ivp_assignee: r.ivp_assignee ?? null, due_date: r.due_date ?? null, masuk: r.created_at, alasan_ditolak: r.rejection_reason ?? null,
    },
    ruangan, ruangan_dipilih: i + 1,
    pesan_terakhir: ((pesan ?? []) as Baris[]).reverse(),
    lampiran: lampiran ?? [],
    aksi_tersedia: hakDesain(r, k.u, t, i),
  };
};

// ================================================================ Ticketing: menunggu persetujuan
/**
 * Ticket yang menunggu keputusan pemilik token: Waiting Approval (antrean Approve di Ticketing,
 * RLS menentukan siapa yang melihatnya) + ticket yang di-route ke dia sebagai Supervisor dan
 * belum di-assign ke handler.
 */
const tiketPersetujuan: Aksi = async (_a, k) => {
  const kolom = 'id, project_name, issue_case, product, sales_name, sales_division, created_by, date, created_at, status, assign_name, routing_status, assigned_supervisor_id';
  const [{ data: wa, error }, { data: sup }] = await Promise.all([
    k.db.from('tickets').select(kolom).eq('status', 'Waiting Approval').not('is_deleted', 'is', true)
      .order('created_at', { ascending: true }).limit(BARIS),
    k.db.from('tickets').select(kolom).eq('routing_status', 'supervisor_assign').eq('assigned_supervisor_id', k.u.id)
      .not('is_deleted', 'is', true).limit(BARIS),
  ]);
  if (error) return gagal(error.message);
  const routed = ((sup ?? []) as Baris[]).filter(t => !str(t.assign_name ?? '').trim());
  return { ok: true, menunggu_approval: wa ?? [], dirouting_ke_saya: routed,
    boleh_approve: ['admin', 'superadmin'].includes(peranDari(k.u)) || hasFullAccess(k.u) };
};

// ================================================================ Tech Note
const STATUS_CATATAN = ['pending', 'approved', 'revision', 'rejected'];

/**
 * Aturan visibilitas tech-note/_components/useMuatTechNote.ts: pengelola (hasFullAccess) melihat
 * semua tech note tahun itu; lainnya = semua yang approved + miliknya sendiri apa pun statusnya.
 */
const catatanCari: Aksi = async (a, k) => {
  const tahun = /^\d{4}$/.test(str(a.tahun)) ? str(a.tahun) : hariIniWIB().slice(0, 4);
  const kelola = hasFullAccess(k.u);
  const kolom = 'id, title, description, product, tags, status, author_id, author_name, folder_id, submitted_at, reviewed_by_name, review_note, one_drive_link';
  const rentang = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(q: T) =>
    q.gte('submitted_at', `${tahun}-01-01`).lte('submitted_at', `${tahun}-12-31T23:59:59`);
  let baris: Baris[] = [];
  if (kelola) {
    const { data, error } = await rentang(k.db.from('tech_notes').select(kolom)).order('submitted_at', { ascending: false }).limit(500);
    if (error) return gagal(error.message);
    baris = (data ?? []) as Baris[];
  } else {
    const [ok, milik] = await Promise.all([
      rentang(k.db.from('tech_notes').select(kolom).eq('status', 'approved')).limit(500),
      rentang(k.db.from('tech_notes').select(kolom).eq('author_id', k.u.id).neq('status', 'approved')).limit(200),
    ]);
    if (ok.error || milik.error) return gagal((ok.error ?? milik.error)!.message);
    const lihat = new Set<string>();
    for (const n of [...(ok.data ?? []), ...(milik.data ?? [])] as Baris[]) if (!lihat.has(str(n.id))) { lihat.add(str(n.id)); baris.push(n); }
    baris.sort((x, y) => str(y.submitted_at).localeCompare(str(x.submitted_at)));
  }
  const st = str(a.status).trim().toLowerCase();
  if (STATUS_CATATAN.includes(st)) baris = baris.filter(n => n.status === st);
  if (a.saya) baris = baris.filter(n => n.author_id === k.u.id);
  const kata = bersih(a.kata).toLowerCase();
  if (kata) baris = baris.filter(n => [n.title, n.description, n.product, ...(Array.isArray(n.tags) ? n.tags : [])]
    .some(v => str(v).toLowerCase().includes(kata)));
  const { data: folder } = await k.db.from('tech_note_folders').select('id, name');
  const namaFolder = new Map(((folder ?? []) as { id: string; name: string }[]).map(f => [f.id, f.name]));
  return { ok: true, tahun, pengelola: kelola, jumlah: baris.length,
    menunggu_review: kelola ? baris.filter(n => n.status === 'pending').length : undefined,
    catatan: baris.slice(0, BARIS).map(n => ({ ...n, folder: namaFolder.get(str(n.folder_id)) ?? null })) };
};

const catatanDetail: Aksi = async (a, k) => {
  const id = idSah(a.id);
  if (!id) return gagal('id tech note tidak sah (ambil dari catatan_cari).');
  const { data: n, error } = await k.db.from('tech_notes').select('*').eq('id', id).maybeSingle();
  if (error) return gagal(error.message);
  const c = n as Baris | null;
  //  Sama dengan daftar di layar: bukan pengelola hanya melihat yang approved atau miliknya.
  if (!c || (!hasFullAccess(k.u) && c.status !== 'approved' && c.author_id !== k.u.id)) {
    return gagal('Tech note tidak ditemukan atau Anda tidak punya akses.');
  }
  const { data: riwayat } = await k.db.from('tech_note_history').select('action, performed_by_name, note, created_at')
    .eq('tech_note_id', id).order('created_at');
  return { ok: true, catatan: c, riwayat: riwayat ?? [], boleh_review: hasFullAccess(k.u) && c.status === 'pending' };
};

// ================================================================ Unit Movement
const KOLOM_UNIT = 'id,tanggal,nama_pts,nama_luar,status_barang,event,project_name,type_barang,serial_number,catatan,'
  + 'created_by,created_at,kondisi_barang,expected_return_date,return_confirmed';

/** Orang dalam PTS melihat seluruh lalu lintas unit; lainnya hanya yang ia catat / yang mencatat namanya. */
export function orangDalamUnit(u: KonteksAksi['u'], t: AkunTambahan): boolean {
  return hasFullAccess(u) || t.pimpinan || ['admin', 'superadmin', 'team', 'team_pts', 'marketing'].includes(peranDari(u));
}

const unitCari: Aksi = async (a, k) => {
  const t = await akunTambahan(k);
  let q = k.db.from('movement_logs').select(KOLOM_UNIT).order('tanggal', { ascending: false }).limit(500);
  if (!orangDalamUnit(k.u, t)) {
    const nama = (k.u.full_name ?? '').replace(/"/g, '');
    const user = (k.u.username ?? '').replace(/"/g, '');
    q = q.or(`created_by.eq."${user}",nama_luar.eq."${nama}"`);
  }
  const { data, error } = await q;
  if (error) return gagal(error.message);
  let baris = (data ?? []) as unknown as Baris[];
  const hari = hariIniWIB();
  const terlambat = baris.filter(l => l.status_barang === 'Keluar' && !l.return_confirmed && !!l.expected_return_date && str(l.expected_return_date) < hari);
  if (a.belum_kembali) baris = terlambat;
  else if (a.dipinjam) baris = baris.filter(l => l.status_barang === 'Keluar' && !l.return_confirmed);
  const st = str(a.status).trim().toLowerCase();
  if (st === 'masuk' || st === 'keluar') baris = baris.filter(l => str(l.status_barang).toLowerCase() === st);
  if (/^\d{4}$/.test(str(a.tahun))) baris = baris.filter(l => str(l.tanggal).startsWith(str(a.tahun)));
  const kata = bersih(a.kata).toLowerCase();
  if (kata) baris = baris.filter(l => [l.project_name, l.type_barang, l.serial_number, l.nama_luar, l.nama_pts]
    .some(v => str(v).toLowerCase().includes(kata)));
  return { ok: true, jumlah: baris.length, terlambat_kembali: terlambat.length, log: baris.slice(0, BARIS) };
};

// ================================================================ Form Review
const KOLOM_REVIEW = 'id,reminder_id,project_name,address,sales_name,sales_division,assign_name,assigned_to,reminder_category,'
  + 'review_category,product_demo,grade_product_knowledge,catatan_grade_product_knowledge,product_bast,grade_training_customer,'
  + 'catatan_grade_training_customer,grade_product_knowledge_bast,catatan_grade_product_knowledge_bast,guest_username,created_at,updated_at';

/** Penyaring FormReviewPageInner.fetchReviewsQuiet: guest = miliknya, team tanpa Full Access = yang ia tangani. */
const reviewCari: Aksi = async (a, k) => {
  const t = await akunTambahan(k);
  let q = k.db.from('form_reviews').select(KOLOM_REVIEW).order('created_at', { ascending: false }).limit(500);
  const role = peranDari(k.u);
  if (role === 'guest' && !t.pimpinan) {
    //  Nilai dikutip ganda (nama bisa memuat koma) - pola unit_cari / lib/identitas.ts kutipNilai.
    const kutip = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '')}"`;
    q = q.or(`guest_username.eq.${kutip(k.u.username)},sales_name.eq.${kutip(k.u.full_name)}`);
  }
  else if (role === 'team' && !hasFullAccess(k.u)) q = q.eq('assigned_to', k.u.username);
  const { data, error } = await q;
  if (error) return gagal(error.message);
  const semua = (data ?? []) as unknown as Baris[];
  let baris = semua;
  const terisi = (r: Baris) => r.grade_product_knowledge != null || r.grade_product_knowledge_bast != null || r.grade_training_customer != null;
  const belum = semua.filter(r => !terisi(r));
  if (a.belum_diisi) baris = belum;
  const kata = bersih(a.kata).toLowerCase();
  if (kata) baris = baris.filter(r => [r.project_name, r.assign_name, r.sales_name].some(v => str(v).toLowerCase().includes(kata)));
  const nilai = semua.flatMap(r => [r.grade_product_knowledge, r.grade_training_customer, r.grade_product_knowledge_bast])
    .filter((v): v is number => typeof v === 'number');
  return { ok: true, jumlah: baris.length, belum_diisi: belum.length,
    rata_rata_nilai: nilai.length ? Math.round((nilai.reduce((x, y) => x + y, 0) / nilai.length) * 10) / 10 : null,
    review: baris.slice(0, BARIS) };
};

// ================================================================ Piket Showroom
function senin(tgl: string): string {
  const d = new Date(`${tgl}T00:00:00Z`);
  const hari = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (hari === 0 ? -6 : 1 - hari));
  return d.toISOString().slice(0, 10);
}
const tambahHari = (tgl: string, n: number) => new Date(Date.parse(`${tgl}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** bacaPicPiket (picket-showroom/_components/shared.ts): kolom pic dulu, lalu kolom lama per tim. */
export function picPiket(r: Baris): string | null {
  const p = r.pic as { name?: string; user_id?: string } | null | undefined;
  if (p && typeof p === 'object' && p.user_id) return p.name ?? '';
  return str(r.pic_ivp_name) || str(r.pic_ump_name) || str(r.pic_mvi_name) || null;
}

/** Lingkup Sales (hitungLingkupProject, lib/project-scope.ts) dengan klien pemilik token. */
export async function lingkupServer(k: KonteksAksi, t: AkunTambahan): Promise<LingkupProject> {
  if (adalahPTS(k.u)) return { semua: true, divisi: [], namaSendiri: k.u.full_name ?? '' };
  const divisi = new Set<string>();
  if (t.is_internal_sales) {
    const { data } = await k.db.from('division_ivp_mappings').select('sales_division').eq('ivp_id', k.u.id);
    for (const m of (data ?? []) as { sales_division: string }[]) if (m.sales_division) divisi.add(m.sales_division);
    if (k.u.sales_division) divisi.add(k.u.sales_division);
  }
  return { semua: false, divisi: Array.from(divisi), namaSendiri: k.u.full_name ?? '' };
}

/**
 * Roster piket minggu ini + depan (atau minggu dari `tanggal`) dan kegiatan tiap hari. Kegiatan
 * tamu dibatasi lingkup Sales persis seperti picket-showroom/page.tsx fetchData.
 */
const piketJadwal: Aksi = async (a, k) => {
  const acuan = tglSah(a.tanggal) ?? hariIniWIB();
  const wk = senin(acuan), wk2 = tambahHari(wk, 7);
  const t = await akunTambahan(k);
  const { data: jadwal, error } = await k.db.from('piket_schedules').select('*').in('week_start', [wk, wk2]).order('day_date');
  if (error) return gagal(error.message);
  const rows = (jadwal ?? []) as Baris[];
  let kg = (rows.length
    ? k.db.from('piket_tamu_detail').select('piket_id, jenis_kegiatan, jam_mulai, jam_selesai, produk, tamu_instansi, nama_sales, sales_division, kebutuhan, keterangan')
      .in('piket_id', rows.map(r => str(r.id))).order('created_at')
    : null);
  const pengguna = { role: k.u.role, team_type: k.u.team_type, access_level: k.u.access_level, piket_akses: t.piket_akses, piket_ubah: t.piket_ubah };
  if (kg && !bisaLihatSemuaTamu(pengguna)) {
    const batas = filterLingkup(await lingkupServer(k, t), 'nama_sales', 'sales_division', { sertakanTanpaPemilik: true });
    if (batas) kg = kg.or(batas);
  }
  const { data: kegiatan } = kg ? await kg : { data: [] };
  const perHari = new Map<string, Baris[]>();
  for (const x of (kegiatan ?? []) as Baris[]) perHari.set(str(x.piket_id), [...(perHari.get(str(x.piket_id)) ?? []), x]);
  const hari = hariIniWIB();
  const daftar = rows.map(r => ({ id: r.id, tanggal: r.day_date, hari: r.day_of_week, pic: picPiket(r), kegiatan: perHari.get(str(r.id)) ?? [] }));
  return { ok: true, minggu: `${wk} s/d ${tambahHari(wk2, 6)}`, hari_ini: daftar.find(d => d.tanggal === hari) ?? null, jadwal: daftar };
};

// ================================================================ KPI Team
/**
 * KPI resmi = snapshot yang disimpan halaman KPI Team (kpi_period_snapshots, finalKPI per
 * anggota). Cakupan sama dengan kpi-team/page.tsx: admin / Full Access / pimpinan = semua,
 * Supervisor tim PTS = timnya, anggota team = hanya barisnya sendiri.
 */
const kpi: Aksi = async (a, k) => {
  const t = await akunTambahan(k);
  const role = peranDari(k.u);
  const semua = ['admin', 'superadmin'].includes(role) || hasFullAccess(k.u) || t.pimpinan;
  const sup = !semua && role === 'team' && /^Team PTS/.test(k.u.team_type ?? '') && k.u.jabatan === 'Supervisor';
  if (!semua && !sup && role !== 'team') return gagal('KPI Team hanya untuk akun Team PTS, Supervisor, Manager, atau Admin.');
  let q = k.db.from('kpi_period_snapshots').select('id, period_label, year, period, start_month, end_month, team_type, created_at, created_by, members_json')
    .order('created_at', { ascending: false }).limit(6);
  if (sup) q = q.eq('team_type', k.u.team_type ?? '');
  const { data, error } = await q;
  if (error) return gagal(error.message);
  const snap = (data ?? []) as (Baris & { members_json?: Baris[] })[];
  if (!snap.length) return { ok: true, ada_snapshot: false, catatan: 'Belum ada periode KPI yang disimpan di KPI Team.' };
  const pilih = str(a.periode).trim().toLowerCase();
  const s = (pilih && snap.find(x => str(x.period_label).toLowerCase().includes(pilih))) || snap[0];
  let anggota = (s.members_json ?? []).map(m => ({ nama: m.name, jabatan: m.jabatan, tim: m.team_type, kpi: m.finalKPI,
    kpi_dasar: m.kpiDasar ?? null, tiket_ditangani: m.ticketsHandled, tiket_solved: m.ticketsSolved, tiket_overdue: m.ticketsOverdue,
    lc_rata: m.lcAvgScore, form_review: m.formReviewTotal, review_rendah: m.formReviewLowRating, tech_note: m.techNotesApproved, id: m.id }));
  if (!semua && !sup) anggota = anggota.filter(m => m.id === k.u.id);
  anggota.sort((x, y) => Number(y.kpi ?? 0) - Number(x.kpi ?? 0));
  return { ok: true, ada_snapshot: true, periode: s.period_label, dibuat: s.created_at, cakupan: semua ? 'semua' : sup ? k.u.team_type : 'saya',
    periode_lain: snap.map(x => x.period_label), anggota: anggota.map(({ id: _id, ...m }) => m) };
};

// ================================================================ Incentive PTS
/** Bagian insentif pemilik token (incentive_splits miliknya), status tahapan, nama project. */
const insentifSaya: Aksi = async (a, k) => {
  const { data: split, error } = await k.db.from('incentive_splits').select('id, project_id, tranche_id, role, percentage, amount, created_at')
    .eq('user_id', k.u.id).limit(1000);
  if (error) return gagal(error.message);
  const sp = (split ?? []) as { project_id: string; tranche_id: string | null; role: string; percentage: number; amount: number | null }[];
  const tIds = Array.from(new Set(sp.map(x => x.tranche_id).filter((x): x is string => !!x)));
  const pIds = Array.from(new Set(sp.map(x => x.project_id)));
  const [{ data: tr }, { data: pr }] = await Promise.all([
    tIds.length ? k.db.from('incentive_tranches').select('id, tranche_number, percentage, payment_year, status, processed_at, paid_at').in('id', tIds)
      : Promise.resolve({ data: [] }),
    pIds.length ? k.db.from('reminders').select('id, project_name, category').in('id', pIds) : Promise.resolve({ data: [] }),
  ]);
  const tMap = new Map(((tr ?? []) as Baris[]).map(x => [str(x.id), x]));
  const pMap = new Map(((pr ?? []) as Baris[]).map(x => [str(x.id), x]));
  const tahun = /^\d{4}$/.test(str(a.tahun)) ? Number(a.tahun) : null;
  const baris = sp.map(x => {
    const t = x.tranche_id ? tMap.get(x.tranche_id) : undefined;
    return { project: pMap.get(x.project_id)?.project_name ?? null, peran: x.role, persen: x.percentage, nominal: x.amount ?? null,
      tahap: t?.tranche_number ?? null, tahun_bayar: t?.payment_year ?? null, status: str(t?.status ?? 'pending') || 'pending' };
  }).filter(x => tahun === null || x.tahun_bayar === tahun);
  const total = (st: string) => baris.filter(x => x.status === st).reduce((s, x) => s + (Number(x.nominal) || 0), 0);
  return { ok: true, jumlah: baris.length, total: { pending: total('pending'), processed: total('processed'), paid: total('paid') },
    bagian: baris.sort((x, y) => str(y.tahun_bayar).localeCompare(str(x.tahun_bayar))).slice(0, 50) };
};

// ================================================================ Learning Center
/**
 * Sesi kuis aktif, attempt pemilik token, dan rekap kelulusan tahunan (pengali KPI) - rekapnya
 * dari RPC rekap_lc_tahunan, sumber yang sama dengan halaman KPI (lib/kpi-lc-tahunan.ts).
 */
const belajar: Aksi = async (_a, k) => {
  const tahun = Number(hariIniWIB().slice(0, 4));
  const [{ data: sesi, error }, { data: att }, { count: materi }, { data: rekap }] = await Promise.all([
    k.db.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false }).limit(200),
    k.db.from('lc_quiz_attempts').select('quiz_session_id, score, passed, grading_status, is_submitted, submitted_at')
      .eq('user_id', k.u.id).order('started_at', { ascending: false }).limit(200),
    k.db.from('lc_materials').select('id', { count: 'exact', head: true }),
    k.db.rpc('rekap_lc_tahunan', { p_user_ids: [k.u.id], p_tahun: tahun }),
  ]);
  if (error) return gagal(error.message);
  const ss = (sesi ?? []) as { id: string; session_name: string; materi_name?: string | null; passing_grade?: number | null;
    is_active?: boolean | null; target_user_ids?: string[] | null }[];
  const aa = (att ?? []) as { quiz_session_id: string; score: number | null; passed: boolean | null; grading_status?: string | null;
    is_submitted: boolean; submitted_at: string | null }[];
  const nama = new Map(ss.map(x => [x.id, x.session_name]));
  const dikerjakan = new Set(aa.map(x => x.quiz_session_id));
  const r = ((rekap ?? []) as { wajib: number; lulus: number; gagal: number; tidak_ikut: number }[])[0];
  return {
    ok: true, materi: materi ?? 0,
    sesi_aktif: ss.filter(x => x.is_active).map(x => ({ nama: x.session_name, materi: x.materi_name ?? null, nilai_lulus: x.passing_grade ?? null,
      sudah_dikerjakan: dikerjakan.has(x.id), ditargetkan: (x.target_user_ids ?? []).includes(k.u.id) })),
    attempt_terakhir: aa.filter(x => x.is_submitted).slice(0, 10).map(x => ({ sesi: nama.get(x.quiz_session_id) ?? null, nilai: x.score,
      lulus: x.passed, status_nilai: x.grading_status ?? null, dikirim: x.submitted_at })),
    rekap_tahun_ini: r ? { tahun, wajib: r.wajib, lulus: r.lulus, gagal: r.gagal, tidak_ikut: r.tidak_ikut,
      faktor_kpi: r.wajib ? Math.round((r.lulus / r.wajib) * 100) / 100 : 1 } : null,
  };
};

// ================================================================ Summary Project
/** daftarProject (lib/summary-project.ts) dengan lingkup yang sama, klien pemilik token. */
const projectCari: Aksi = async (a, k) => {
  const t = await akunTambahan(k);
  let q = k.db.from('v_project_summary').select('*').order('last_activity', { ascending: false, nullsFirst: false }).limit(BARIS);
  const batas = filterLingkup(await lingkupServer(k, t), 'sales_name');
  if (batas) q = q.or(batas);
  const kata = bersih(a.kata);
  if (kata) q = q.or(`name.ilike.%${kata}%,code.ilike.%${kata}%,customer.ilike.%${kata}%,location.ilike.%${kata}%`);
  const st = str(a.status).trim().toLowerCase();
  if (['active', 'done', 'archived'].includes(st)) q = q.eq('status', st);
  const { data, error } = await q;
  return error ? gagal(error.message) : { ok: true, jumlah: data?.length ?? 0, project: data ?? [] };
};

const KOLOM_DETAIL_PROJECT: Record<string, string> = {
  reminders: 'id, project_name, category, due_date, bast_date, status, assign_name, address',
  tickets: 'id, project_name, issue_case, status, date, assign_name',
  project_requests: 'id, project_name, status, requester_name, due_date, assign_name',
  form_reviews: 'id, project_name, reminder_id, review_category, grade_product_knowledge, grade_training_customer, grade_product_knowledge_bast',
};

/** ambilDetailProject (lib/summary-project.ts): record yang DIPETAKAN ke project ini. */
const projectDetail: Aksi = async (a, k) => {
  const id = idSah(a.id);
  if (!id) return gagal('id project tidak sah (ambil dari project_cari).');
  const t = await akunTambahan(k);
  const lingkup = await lingkupServer(k, t);
  const batas = filterLingkup(lingkup, 'sales_name');
  let qp = k.db.from('v_project_summary').select('*').eq('project_id', id);
  if (batas) qp = qp.or(batas);
  const { data: p } = await qp.maybeSingle();
  if (!p) return gagal('Project tidak ditemukan atau Anda tidak punya akses.');
  const { data: links } = await k.db.from('project_source_links').select('source_module, source_record_id').eq('project_id', id);
  const ids: Record<string, string[]> = { reminders: [], tickets: [], project_requests: [], form_reviews: [] };
  for (const l of (links ?? []) as { source_module: string; source_record_id: string }[]) ids[l.source_module]?.push(l.source_record_id);
  const ambil = async (modul: string) => {
    if (!ids[modul].length) return [] as Baris[];
    let q = k.db.from(modul).select(KOLOM_DETAIL_PROJECT[modul]).in('id', ids[modul]);
    if (modul !== 'form_reviews') q = q.or('is_deleted.is.null,is_deleted.eq.false');
    if (batas) q = q.or(batas);
    const { data } = await q;
    return (data ?? []) as unknown as Baris[];
  };
  const [jadwal, tiket, desain] = await Promise.all([ambil('reminders'), ambil('tickets'), ambil('project_requests')]);
  return { ok: true, project: p, jadwal, tiket, request_desain: desain };
};

export const AKSI_MENU_BACA: Record<string, Aksi> = {
  desain_detail: desainDetail,
  tiket_persetujuan: tiketPersetujuan,
  catatan_cari: catatanCari,
  catatan_detail: catatanDetail,
  unit_cari: unitCari,
  review_cari: reviewCari,
  piket_jadwal: piketJadwal,
  kpi,
  insentif_saya: insentifSaya,
  belajar,
  project_cari: projectCari,
  project_detail: projectDetail,
};
