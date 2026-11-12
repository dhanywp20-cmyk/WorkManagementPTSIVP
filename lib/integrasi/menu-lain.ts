import { hasFullAccess } from '@/lib/constants';
import { filterLingkup } from '@/lib/project-scope';
import { bisaLihatSemuaTamu } from '@/lib/piket/akses';
import { BARIS, akunTambahan, bersih, gagal, hariIniWIB, idSah, peranDari, tglSah, type AkunTambahan, type KonteksAksi } from '@/lib/integrasi/bantu';
import { str, lingkupServer, type Aksi, type Baris } from '@/lib/integrasi/menu-dasar';

export const STATUS_CATATAN = ['pending', 'approved', 'revision', 'rejected'];

export const catatanCari: Aksi = async (a, k) => {
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

export const catatanDetail: Aksi = async (a, k) => {
  const id = idSah(a.id);
  if (!id) return gagal('id tech note tidak sah (ambil dari catatan_cari).');
  const { data: n, error } = await k.db.from('tech_notes').select('*').eq('id', id).maybeSingle();
  if (error) return gagal(error.message);
  const c = n as Baris | null;
  if (!c || (!hasFullAccess(k.u) && c.status !== 'approved' && c.author_id !== k.u.id)) {
    return gagal('Tech note tidak ditemukan atau Anda tidak punya akses.');
  }
  const { data: riwayat } = await k.db.from('tech_note_history').select('action, performed_by_name, note, created_at')
    .eq('tech_note_id', id).order('created_at');
  return { ok: true, catatan: c, riwayat: riwayat ?? [], boleh_review: hasFullAccess(k.u) && c.status === 'pending' };
};

export const KOLOM_UNIT = 'id,tanggal,nama_pts,nama_luar,status_barang,event,project_name,type_barang,serial_number,catatan,'
  + 'created_by,created_at,kondisi_barang,expected_return_date,return_confirmed';

export function orangDalamUnit(u: KonteksAksi['u'], t: AkunTambahan): boolean {
  return hasFullAccess(u) || t.pimpinan || ['admin', 'superadmin', 'team', 'team_pts', 'marketing'].includes(peranDari(u));
}

export const unitCari: Aksi = async (a, k) => {
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

export const KOLOM_REVIEW = 'id,reminder_id,project_name,address,sales_name,sales_division,assign_name,assigned_to,reminder_category,'
  + 'review_category,product_demo,grade_product_knowledge,catatan_grade_product_knowledge,product_bast,grade_training_customer,'
  + 'catatan_grade_training_customer,grade_product_knowledge_bast,catatan_grade_product_knowledge_bast,guest_username,created_at,updated_at';

export const reviewCari: Aksi = async (a, k) => {
  const t = await akunTambahan(k);
  let q = k.db.from('form_reviews').select(KOLOM_REVIEW).order('created_at', { ascending: false }).limit(500);
  const role = peranDari(k.u);
  if (role === 'guest' && !t.pimpinan) {
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

export function senin(tgl: string): string {
  const d = new Date(`${tgl}T00:00:00Z`);
  const hari = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (hari === 0 ? -6 : 1 - hari));
  return d.toISOString().slice(0, 10);
}

export const tambahHari = (tgl: string, n: number) => new Date(Date.parse(`${tgl}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function picPiket(r: Baris): string | null {
  const p = r.pic as { name?: string; user_id?: string } | null | undefined;
  if (p && typeof p === 'object' && p.user_id) return p.name ?? '';
  return str(r.pic_ivp_name) || str(r.pic_ump_name) || str(r.pic_mvi_name) || null;
}

export const piketJadwal: Aksi = async (a, k) => {
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

export const kpi: Aksi = async (a, k) => {
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

export const insentifSaya: Aksi = async (a, k) => {
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

export const belajar: Aksi = async (_a, k) => {
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
