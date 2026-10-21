/**
 * uji/integrasi-diwaypi-menu.ts - aksi DIWAYPI untuk semua menu di luar tahap 1-2
 * (lib/integrasi-menu.ts, lib/integrasi-tulis.ts, lib/integrasi-analisa.ts):
 *   - token baca-saja tidak bisa menjalankan aksi tulis mana pun, tanpa menyentuh DB;
 *   - hak tombol Request Design (hakDesain) = aturan layar form-require-project;
 *   - setiap aksi tulis MENOLAK sebelum menulis apa pun bila syarat tombolnya tidak terpenuhi;
 *   - baris & pesan (WA / in-app / chat sistem) sama dengan hook peramban;
 *   - update yang ditolak RLS (0 baris tanpa galat) dilaporkan gagal, tanpa kabar susulan;
 *   - penyaring lihat per menu terpasang di query (Unit Movement, Form Review, Tech Note);
 *   - analisa: periode & temuan deterministik.
 * Klien Supabase & pengirim tiruan - tidak ada jaringan.
 *
 * Jalankan: npm test -- integrasi-diwaypi-menu
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AKSI_BACA, AKSI_TULIS, jalankanAksi, type KonteksAksi } from '../lib/integrasi-aksi';
import { AKSI_MENU_TULIS } from '../lib/integrasi-tulis';
import { hakDesain, type RequestDesain } from '../lib/integrasi-menu';
import { periodeAnalisa } from '../lib/integrasi-analisa';
import type { AkunTambahan } from '../lib/integrasi-bantu';
import type { UserLengkap } from '../lib/ai-server';
import type { EfekSamping } from '../lib/efek-samping';
import type { NotifPayload } from '../lib/notifications';
import type { AuditPayload } from '../lib/audit';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, detail = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${detail ? `\n         ${detail}` : ''}`); }
}

interface Kueri { tabel: string; op: 'select' | 'insert' | 'update' | 'delete' | 'rpc'; kolom?: string; head?: boolean; nilai?: unknown; filter: string[] }
type Hasil = { data?: unknown; error?: unknown; count?: number };

function klienTiruan(jawab: (q: Kueri) => Hasil | undefined) {
  const kueri: Kueri[] = [];
  const db = {
    from(tabel: string) {
      const q: Kueri = { tabel, op: 'select', filter: [] };
      kueri.push(q);
      const b: Record<string, unknown> = {};
      const rantai = (...nama: string[]) => nama.forEach(n => { b[n] = (...a: unknown[]) => { q.filter.push(`${n}:${a.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(',')}`); return b; }; });
      rantai('eq', 'neq', 'not', 'is', 'in', 'or', 'ilike', 'gte', 'gt', 'lte', 'lt', 'order', 'limit');
      b.select = (k?: string, o?: { head?: boolean }) => { if (q.op === 'select') { q.kolom = k; q.head = !!o?.head; } return b; };
      b.insert = (v: unknown) => { q.op = 'insert'; q.nilai = v; return b; };
      b.update = (v: unknown) => { q.op = 'update'; q.nilai = v; return b; };
      b.delete = () => { q.op = 'delete'; return b; };
      b.maybeSingle = () => b;
      b.single = () => b;
      b.then = (ok: (h: Hasil) => unknown, tolak?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => jawab(q) ?? { data: q.op === 'select' ? [] : null, error: null }).then(ok, tolak);
      return b;
    },
    rpc(nama: string, args: unknown) {
      const q: Kueri = { tabel: nama, op: 'rpc', nilai: args, filter: [] };
      kueri.push(q);
      return Promise.resolve().then(() => jawab(q) ?? { data: [] });
    },
  };
  return { db: db as unknown as SupabaseClient, kueri };
}

function efekTiruan() {
  const wa: { target: string; pesan: string; event?: string }[] = [];
  const inApp: NotifPayload[] = [];
  const audit: AuditPayload[] = [];
  const efek: EfekSamping = {
    wa: async (target, pesan, event) => { wa.push({ target, pesan, event }); return { ok: true }; },
    inApp: async p => { inApp.push(p); },
    audit: async p => { audit.push(p); },
  };
  return { efek, wa, inApp, audit };
}

const tulisan = (k: Kueri[]) => k.filter(q => q.op !== 'select' && q.op !== 'rpc');
const ctx = (db: SupabaseClient, u: UserLengkap, e: EfekSamping, cakupan: ('baca' | 'tulis')[] = ['baca', 'tulis']): KonteksAksi =>
  ({ db, admin: db, u, cakupan, efek: e });

const team: UserLengkap = { id: 'u-1', username: 'dhany', full_name: 'Dhany', role: 'team', sales_division: null,
  access_level: null, team_type: 'Team PTS IVP', jabatan: 'Engineer' };
const admin: UserLengkap = { ...team, id: 'a-1', username: 'admin1', full_name: 'Admin Satu', role: 'admin' };
const manajer: UserLengkap = { ...team, id: 'm-1', username: 'manajer', full_name: 'Manajer PTS', access_level: 'full', jabatan: 'Manager' };
const sales: UserLengkap = { ...team, id: 's-1', username: 'andi', full_name: 'Andi', role: 'guest', team_type: null, sales_division: 'A', jabatan: 'Staff' };
const tanpaTambahan: AkunTambahan = { pimpinan: false, is_internal_sales: false, piket_akses: null, piket_ubah: false, incentive_akses: null, phone_number: null };

const ORANG = [
  { id: 'u-1', username: 'dhany', full_name: 'Dhany', role: 'team', team_type: 'Team PTS IVP', phone_number: '0812', jabatan: 'Engineer', bisa_ditugaskan: true },
  { id: 'u-2', username: 'budi', full_name: 'Budi', role: 'team', team_type: 'Team PTS IVP', phone_number: '0814', jabatan: 'Engineer', bisa_ditugaskan: true },
  { id: 'sup-1', username: 'supri', full_name: 'Supri', role: 'team', team_type: 'Team PTS IVP', phone_number: '0813', jabatan: 'Supervisor', bisa_ditugaskan: true },
  { id: 'a-1', username: 'admin1', full_name: 'Admin Satu', role: 'admin', team_type: null, phone_number: '0811', jabatan: null },
  { id: 's-1', username: 'andi', full_name: 'Andi', role: 'guest', team_type: null, phone_number: '0815', jabatan: 'Staff', sales_division: 'A' },
];
/** Jawaban umum untuk tabel users (daftar tim, supervisor, penerima admin, akun tambahan). */
function jawabUsers(q: Kueri, tambahan: Partial<AkunTambahan> = {}): Hasil | undefined {
  if (q.tabel !== 'users' || q.op !== 'select') return undefined;
  if (q.kolom === '*') return { data: { ...tambahan } };
  const f = q.filter.join(' | ');
  const daftarIn = (kolom: string) => {
    const x = q.filter.find(y => y.startsWith(`in:${kolom},`));
    return x ? JSON.parse(x.slice(`in:${kolom},`.length)) as string[] : null;
  };
  if (f.includes('or:role.in.(admin,superadmin),access_level.eq.full')) return { data: ORANG.filter(o => o.role === 'admin') };
  if (daftarIn('role')) return { data: ORANG.filter(o => daftarIn('role')!.includes(o.role)) };
  if (f.includes('eq:jabatan,Supervisor')) return { data: ORANG.filter(o => o.jabatan === 'Supervisor') };
  const id = /eq:id,([^ |]+)/.exec(f)?.[1];
  if (id) return { data: ORANG.find(o => o.id === id) ?? null };
  const un = /eq:username,([^ |]+)/.exec(f)?.[1];
  if (un) return { data: ORANG.find(o => o.username === un) ?? null };
  const nama = daftarIn('full_name');
  if (nama) return { data: ORANG.filter(o => nama.includes(o.full_name)) };
  const ids = daftarIn('id');
  if (ids) return { data: ORANG.filter(o => ids.includes(o.id)) };
  return { data: ORANG };
}

const dasarReq: RequestDesain = {
  id: '11111111-aaaa-bbbb-cccc-000000000001', project_name: 'BCA Menara', room_name: 'Meeting Room', project_location: 'Jakarta',
  sales_name: 'Andi', sales_division: 'A', requester_id: 's-1', requester_name: 'Andi', status: 'pending', routing_status: null,
  assign_name: null, assigned_supervisor_id: null, ivp_assignee: null, rooms: [{ room_name: 'Command Center', status: 'pending', assign_name: null }],
};

async function main() {
  console.log('daftar aksi');
  const baru = ['desain_detail', 'tiket_persetujuan', 'catatan_cari', 'catatan_detail', 'unit_cari', 'review_cari', 'piket_jadwal',
    'kpi', 'insentif_saya', 'belajar', 'project_cari', 'project_detail', 'analisa'];
  cek('semua aksi baca baru terdaftar', baru.every(a => AKSI_BACA.includes(a)), JSON.stringify(baru.filter(a => !AKSI_BACA.includes(a))));
  cek('aksi tahap 1-2 tetap ada', ['tiket_selesai', 'jadwal_buat', 'jadwal_status', 'checklist_simpan'].every(a => AKSI_TULIS.includes(a)));
  cek('tidak ada aksi hapus / bayar insentif', ![...AKSI_BACA, ...AKSI_TULIS].some(a => /hapus|delete|bayar|paid|proses_batch/.test(a)));

  const { db: dbK, kueri: kK } = klienTiruan(() => undefined);
  const eK = efekTiruan();
  let semuaTolak = true;
  for (const nama of Object.keys(AKSI_MENU_TULIS)) {
    const r = await jalankanAksi(nama, { id: dasarReq.id }, ctx(dbK, admin, eK.efek, ['baca']));
    if (r.ok || !/hanya boleh MEMBACA/.test(String(r.galat))) semuaTolak = false;
  }
  cek('token baca-saja ditolak di SEMUA aksi tulis baru', semuaTolak);
  cek('...tanpa menyentuh DB / mengirim apa pun', kK.length === 0 && eK.wa.length === 0 && eK.inApp.length === 0);

  // ------------------------------------------------------------ hakDesain = aturan layar
  console.log('hak Request Design');
  const hAdmin = hakDesain(dasarReq, admin, tanpaTambahan, 0);
  cek('admin + pending: Approve & Assign, Tolak, route Supervisor; belum ada Update Status',
    hAdmin.approve && hAdmin.tolak && hAdmin.route_supervisor && hAdmin.ubah_status.length === 0, JSON.stringify(hAdmin));
  cek('internal_review mengunci approve admin', !hakDesain({ ...dasarReq, routing_status: 'internal_review' }, admin, tanpaTambahan, 0).approve);
  const disetujui: RequestDesain = { ...dasarReq, status: 'approved', assign_name: 'Dhany' };
  const hTeam = hakDesain(disetujui, team, tanpaTambahan, 0);
  cek('PTS yang di-assign: pending / in_progress / completed, tanpa approved/rejected',
    hTeam.ubah_status.join() === 'pending,in_progress,completed' && !hTeam.approve && !hTeam.reassign, JSON.stringify(hTeam));
  cek('PTS lain (bukan handler): tidak bisa ubah status', hakDesain(disetujui, { ...team, id: 'u-2', full_name: 'Budi' }, tanpaTambahan, 0).ubah_status.length === 0);
  const hMgr = hakDesain(disetujui, manajer, tanpaTambahan, 0);
  cek('Full Access (team) bukan handler: rejected ada, completed TIDAK (isTeamPTS), status sekarang tidak ditawarkan',
    hMgr.ubah_status.join() === 'pending,in_progress,rejected' && !hMgr.reassign, JSON.stringify(hMgr.ubah_status));
  cek('Re-assign (Admin Controls) hanya role admin, setelah approve', hakDesain(disetujui, admin, tanpaTambahan, 0).reassign);
  cek('ruangan ke-2 memakai status & handler ruangannya sendiri',
    hakDesain({ ...disetujui, rooms: [{ room_name: 'CC', status: 'approved', assign_name: 'Budi' }] }, { ...team, id: 'u-2', full_name: 'Budi' }, tanpaTambahan, 1)
      .ubah_status.includes('in_progress'));
  const hInt = hakDesain({ ...dasarReq, routing_status: 'internal_review', internal_sales_id: 's-9' }, { ...sales, id: 's-9' }, tanpaTambahan, 0);
  cek('Sales Internal pengulas: review internal + tolak', hInt.review_internal && hInt.tolak);
  const ditolak: RequestDesain = { ...dasarReq, status: 'rejected' };
  const hSales = hakDesain(ditolak, sales, tanpaTambahan, 0);
  cek('Sales pemilik request ditolak: ajukan ulang; chat tertutup', hSales.ajukan_ulang && !hSales.pesan && /ditolak/.test(String(hSales.alasan_pesan)));
  cek('Sales: request pending belum bisa chat', !hakDesain(dasarReq, sales, tanpaTambahan, 0).pesan);
  cek('PTS: request pending sudah bisa chat', hakDesain(dasarReq, team, tanpaTambahan, 0).pesan);

  // ------------------------------------------------------------ desain_status
  console.log('desain_status');
  const jawabReq = (req: RequestDesain, barisUpdate = 1) => (q: Kueri): Hasil | undefined => {
    const u = jawabUsers(q); if (u) return u;
    if (q.tabel === 'project_requests' && q.op === 'select') return { data: req };
    if (q.tabel === 'project_requests' && q.op === 'update') return { data: Array(barisUpdate).fill({ id: req.id }) };
    if (q.tabel === 'project_messages' && q.op === 'insert') return { data: [{ id: 'msg-1' }] };
    return undefined;
  };
  const e1 = efekTiruan();
  const { db: d1, kueri: k1 } = klienTiruan(jawabReq(disetujui));
  const r1 = await jalankanAksi('desain_status', { id: disetujui.id, status: 'in progress' }, ctx(d1, team, e1.efek));
  const upd1 = k1.find(q => q.tabel === 'project_requests' && q.op === 'update');
  const msg1 = k1.find(q => q.tabel === 'project_messages' && q.op === 'insert');
  cek('handler: Approved -> In Progress tersimpan', r1.ok === true && JSON.stringify(upd1?.nilai) === '{"status":"in_progress"}', JSON.stringify(r1));
  cek('pesan chat sama dengan aplikasi', JSON.stringify(msg1?.nilai).includes('🔄 Status diupdate menjadi: IN PROGRESS'));
  cek('badge in-app ke requester (notifyProjectStatusChange)', e1.inApp.some(n => n.user_id === 's-1' && n.title === '🏗️ BCA Menara — 🔄 Sedang Diproses'));
  cek('WA ke Sales: STATUS REQUEST DESIGN DIPERBARUI, event project.updated',
    e1.wa.some(w => w.target === '0815' && w.pesan.includes('*STATUS REQUEST DESIGN DIPERBARUI*') && w.event === 'project.updated'));
  cek('audit status_change', e1.audit.some(a => a.action === 'status_change' && a.old_value === 'approved' && a.new_value === 'in_progress'));

  const e2 = efekTiruan();
  const { db: d2, kueri: k2 } = klienTiruan(jawabReq(disetujui));
  const r2 = await jalankanAksi('desain_status', { id: disetujui.id, status: 'approved' }, ctx(d2, team, e2.efek));
  cek('status di luar pilihan tombol ditolak sebelum menulis', !r2.ok && /Pilihan untuk Anda/.test(String(r2.galat)) && tulisan(k2).length === 0);

  const e3 = efekTiruan();
  const { db: d3, kueri: k3 } = klienTiruan(jawabReq(disetujui, 0));
  const r3 = await jalankanAksi('desain_status', { id: disetujui.id, status: 'completed' }, ctx(d3, team, e3.efek));
  cek('0 baris (RLS) = gagal; tanpa pesan chat & tanpa WA',
    !r3.ok && !k3.some(q => q.tabel === 'project_messages') && e3.wa.length === 0, String(r3.galat));

  const duaRuang: RequestDesain = { ...disetujui, rooms: [{ room_name: 'Command Center', status: 'approved', assign_name: 'Dhany' }] };
  const { db: d4, kueri: k4 } = klienTiruan(jawabReq(duaRuang));
  const r4 = await jalankanAksi('desain_status', { id: duaRuang.id, status: 'in_progress', ruangan: 'Command Center' }, ctx(d4, team, efekTiruan().efek));
  const upd4 = k4.find(q => q.tabel === 'project_requests' && q.op === 'update');
  cek('ruangan ke-2: yang ditulis array rooms, kolom request tidak disentuh',
    r4.ok === true && JSON.stringify(upd4?.nilai) === '{"rooms":[{"room_name":"Command Center","status":"in_progress","assign_name":"Dhany"}]}', JSON.stringify(upd4?.nilai));

  // ------------------------------------------------------------ desain_assign
  console.log('desain_assign');
  const e5 = efekTiruan();
  const { db: d5, kueri: k5 } = klienTiruan(jawabReq(dasarReq));
  const r5 = await jalankanAksi('desain_assign', { id: dasarReq.id, handler: 'Budi' }, ctx(d5, admin, e5.efek));
  const upd5 = k5.find(q => q.tabel === 'project_requests' && q.op === 'update');
  cek('admin approve & assign: nama + uuid handler, status approved', r5.ok === true
    && JSON.stringify(upd5?.nilai).includes('"assign_name":"Budi","assign_user_id":"u-2","status":"approved"'), JSON.stringify(upd5?.nilai));
  cek('pesan sistem approve', JSON.stringify(k5.find(q => q.tabel === 'project_messages')?.nilai).includes('✅ Request diapprove oleh Admin Satu. Assigned ke Tim PTS: Budi.'));
  cek('WA ke handler (project.assigned) + badge', e5.wa.some(w => w.target === '0814' && w.event === 'project.assigned' && w.pesan.includes('Assigned ke Kamu'))
    && e5.inApp.some(n => n.user_id === 'u-2' && n.title === '🏗️ Request design di-assign ke kamu'));

  const e6 = efekTiruan();
  const { db: d6, kueri: k6 } = klienTiruan(jawabReq(dasarReq));
  const r6 = await jalankanAksi('desain_assign', { id: dasarReq.id, supervisor: 'Supri' }, ctx(d6, admin, e6.efek));
  const upd6 = k6.find(q => q.tabel === 'project_requests' && q.op === 'update');
  cek('route ke Supervisor: supervisor_assign, handler dikosongkan', r6.ok === true
    && JSON.stringify(upd6?.nilai).includes('"routing_status":"supervisor_assign","assigned_supervisor_id":"sup-1","assign_name":null'), JSON.stringify(upd6?.nilai));
  cek('WA ke Supervisor (project.routed_supervisor)', e6.wa.some(w => w.target === '0813' && w.event === 'project.routed_supervisor'));

  const { db: d7, kueri: k7 } = klienTiruan(jawabReq(dasarReq));
  const r7 = await jalankanAksi('desain_assign', { id: dasarReq.id, handler: 'Budi' }, ctx(d7, team, efekTiruan().efek));
  cek('Team PTS biasa tidak bisa approve: ditolak sebelum menulis', !r7.ok && tulisan(k7).length === 0, String(r7.galat));
  const r7b = await jalankanAksi('desain_assign', { id: dasarReq.id, handler: 'Orang Asing' }, ctx(klienTiruan(jawabReq(dasarReq)).db, admin, efekTiruan().efek));
  cek('handler yang tidak ada di daftar tim ditolak', !r7b.ok && /tidak ada di daftar/.test(String(r7b.galat)));

  // ------------------------------------------------------------ desain_tolak / pesan
  console.log('desain_tolak & desain_pesan');
  const { db: d8, kueri: k8 } = klienTiruan(jawabReq(dasarReq));
  const r8 = await jalankanAksi('desain_tolak', { id: dasarReq.id }, ctx(d8, admin, efekTiruan().efek));
  cek('tolak tanpa alasan ditolak', !r8.ok && /Alasan penolakan wajib/.test(String(r8.galat)) && tulisan(k8).length === 0);
  const e9 = efekTiruan();
  const { db: d9, kueri: k9 } = klienTiruan(jawabReq(dasarReq));
  const r9 = await jalankanAksi('desain_tolak', { id: dasarReq.id, alasan: 'Data ruangan kurang' }, ctx(d9, admin, e9.efek));
  cek('tolak: status rejected + alasan, pesan sistem, WA ke requester',
    r9.ok === true && JSON.stringify(k9.find(q => q.op === 'update')?.nilai) === '{"status":"rejected","rejection_reason":"Data ruangan kurang"}'
      && JSON.stringify(k9.find(q => q.tabel === 'project_messages')?.nilai).includes('❌ Request telah ditolak oleh Admin Satu. Alasan: Data ruangan kurang')
      && e9.wa.some(w => w.target === '0815' && w.pesan.includes('Request Ditolak')));
  const { db: d10, kueri: k10 } = klienTiruan(jawabReq(dasarReq));
  const r10 = await jalankanAksi('desain_pesan', { id: dasarReq.id, pesan: 'halo' }, ctx(d10, sales, efekTiruan().efek));
  cek('Sales tidak bisa chat request yang masih pending', !r10.ok && /pending approval/.test(String(r10.galat)) && tulisan(k10).length === 0);
  const { db: d11, kueri: k11 } = klienTiruan(jawabReq(disetujui));
  const r11 = await jalankanAksi('desain_pesan', { id: disetujui.id, pesan: 'sudah dicek', ruangan: 2 }, ctx(d11, team, efekTiruan().efek));
  cek('PTS chat dengan label ruangan', r11.ok === true && JSON.stringify(k11.find(q => q.tabel === 'project_messages')?.nilai).includes('"message":"[Command Center] sudah dicek"'));

  // ------------------------------------------------------------ tiket_buat / tiket_setujui
  console.log('tiket_buat & tiket_setujui');
  const jawabTiket = (tiket: Record<string, unknown> | null, barisUpdate = 1) => (q: Kueri): Hasil | undefined => {
    const u = jawabUsers(q); if (u) return u;
    if (q.tabel === 'tickets' && q.op === 'insert') return { data: { id: 'tk-baru' } };
    if (q.tabel === 'tickets' && q.op === 'select') return { data: tiket };
    if (q.tabel === 'tickets' && q.op === 'update') return { data: Array(barisUpdate).fill({ id: 'tk-1' }) };
    if (q.tabel === 'app_settings') return { data: null };
    return undefined;
  };
  const e12 = efekTiruan();
  const { db: d12, kueri: k12 } = klienTiruan(jawabTiket(null));
  const r12 = await jalankanAksi('tiket_buat', { project: 'RS Harapan', issue: 'LED mati sebagian' }, ctx(d12, team, e12.efek));
  const ins12 = k12.find(q => q.tabel === 'tickets' && q.op === 'insert');
  cek('akun team: ticket masuk Waiting Approval tanpa handler', r12.ok === true
    && JSON.stringify(ins12?.nilai).includes('"status":"Waiting Approval"') && JSON.stringify(ins12?.nilai).includes('"assign_name":""'), JSON.stringify(ins12?.nilai));
  cek('kabar ke approver: WA ticket.approval_needed + badge',
    e12.wa.some(w => w.target === '0811' && w.event === 'ticket.approval_needed' && w.pesan.includes('Request Ticket Baru'))
      && e12.inApp.some(n => n.user_id === 'a-1' && n.title === '🔔 Ticket baru menunggu approval'));
  const r12b = await jalankanAksi('tiket_buat', { project: 'X', issue: 'Y', handler: 'Budi' }, ctx(klienTiruan(jawabTiket(null)).db, team, efekTiruan().efek));
  cek('akun team tidak bisa menentukan handler sendiri', !r12b.ok && /Waiting Approval/.test(String(r12b.galat)));
  const r13 = await jalankanAksi('tiket_buat', { project: 'X', issue: 'Y' }, ctx(klienTiruan(jawabTiket(null)).db, manajer, efekTiruan().efek));
  cek('Full Access wajib menentukan penanganan', !r13.ok && /Tentukan penanganan/.test(String(r13.galat)));
  const e14 = efekTiruan();
  const { db: d14, kueri: k14 } = klienTiruan(jawabTiket(null));
  const r14 = await jalankanAksi('tiket_buat', { project: 'X', issue: 'Y', handler: 'Budi' }, ctx(d14, manajer, e14.efek));
  cek('Full Access + handler: langsung Pending & WA ke handler',
    r14.ok === true && JSON.stringify(k14.find(q => q.op === 'insert')?.nilai).includes('"assign_name":"Budi"')
      && JSON.stringify(k14.find(q => q.op === 'insert')?.nilai).includes('"status":"Pending"')
      && e14.wa.some(w => w.target === '0814' && w.event === 'ticket.assigned'));

  const menunggu = { id: '22222222-aaaa-bbbb-cccc-000000000001', project_name: 'RS Harapan', issue_case: 'LED mati', status: 'Waiting Approval',
    date: '2026-10-20', created_by: 'andi', sales_division: 'A', assign_name: '', routing_status: null, assigned_supervisor_id: null, is_deleted: false };
  const r15 = await jalankanAksi('tiket_setujui', { id: menunggu.id, handler: 'Budi' }, ctx(klienTiruan(jawabTiket(menunggu)).db, team, efekTiruan().efek));
  cek('approve ticket hanya Admin/Full Access', !r15.ok && /Admin atau pemegang Full Access/.test(String(r15.galat)));
  const e16 = efekTiruan();
  const { db: d16, kueri: k16 } = klienTiruan(jawabTiket(menunggu));
  const r16 = await jalankanAksi('tiket_setujui', { id: menunggu.id, handler: 'Budi' }, ctx(d16, admin, e16.efek));
  const upd16 = k16.find(q => q.tabel === 'tickets' && q.op === 'update');
  cek('approve: Pending + handler, dijaga status Waiting Approval', r16.ok === true
    && JSON.stringify(upd16?.nilai) === '{"status":"Pending","assign_name":"Budi"}' && upd16!.filter.includes('eq:status,Waiting Approval'));
  cek('Sales pembuat dikabari & handler dapat WA', e16.inApp.some(n => n.user_id === 's-1' && n.title === '🎫 Ticket disetujui')
    && e16.wa.some(w => w.target === '0814' && w.pesan.includes('Ticket Assigned ke Kamu')));
  const e17 = efekTiruan();
  const r17 = await jalankanAksi('tiket_setujui', { id: menunggu.id, handler: 'Budi' }, ctx(klienTiruan(jawabTiket(menunggu, 0)).db, admin, e17.efek));
  cek('sudah diproses penyetuju lain (0 baris): gagal tanpa kabar', !r17.ok && /sudah diproses lebih dulu/.test(String(r17.galat)) && e17.wa.length === 0);
  const dirouting = { ...menunggu, status: 'Pending', routing_status: 'supervisor_assign', assigned_supervisor_id: 'sup-1' };
  const { db: d18, kueri: k18 } = klienTiruan(jawabTiket(dirouting));
  const r18 = await jalankanAksi('tiket_setujui', { id: menunggu.id, handler: 'saya' },
    ctx(d18, { ...team, id: 'sup-1', username: 'supri', full_name: 'Supri', jabatan: 'Supervisor' }, efekTiruan().efek));
  cek('Supervisor yang di-route: kerjakan sendiri', r18.ok === true
    && JSON.stringify(k18.find(q => q.op === 'update')?.nilai) === '{"status":"Pending","assign_name":"Supri","routing_status":null}');

  // ------------------------------------------------------------ Tech Note
  console.log('tech note');
  const folders = [{ id: 'f-1', name: 'LED Display' }];
  const jawabCatatan = (note: Record<string, unknown> | null) => (q: Kueri): Hasil | undefined => {
    const u = jawabUsers(q); if (u) return u;
    if (q.tabel === 'tech_note_folders') return { data: folders };
    if (q.tabel === 'tech_notes' && q.op === 'insert') return { data: { id: 'tn-1' } };
    if (q.tabel === 'tech_notes' && q.op === 'select') return { data: note };
    if (q.tabel === 'tech_notes' && q.op === 'update') return { data: [{ id: 'tn-1' }] };
    return undefined;
  };
  const r19 = await jalankanAksi('catatan_buat', { judul: 'Kalibrasi', folder: 'LED Display', link: 'https://evil.example.com/x' },
    ctx(klienTiruan(jawabCatatan(null)).db, team, efekTiruan().efek));
  cek('link bukan OneDrive ditolak', !r19.ok && /OneDrive/.test(String(r19.galat)));
  const e20 = efekTiruan();
  const { db: d20, kueri: k20 } = klienTiruan(jawabCatatan(null));
  const r20 = await jalankanAksi('catatan_buat', { judul: 'Kalibrasi', folder: 'led display', link: 'https://1drv.ms/abc', tags: 'led, kalibrasi' }, ctx(d20, team, e20.efek));
  cek('tech note baru: pending + riwayat submitted + badge admin',
    r20.ok === true && JSON.stringify(k20.find(q => q.tabel === 'tech_notes' && q.op === 'insert')?.nilai).includes('"status":"pending"')
      && JSON.stringify(k20.find(q => q.tabel === 'tech_note_history')?.nilai).includes('"action":"submitted"')
      && e20.inApp.some(n => n.user_id === 'a-1' && n.title === '📄 Tech Note baru menunggu review'), JSON.stringify(r20));
  const pending = { id: '33333333-aaaa-bbbb-cccc-000000000001', title: 'Kalibrasi', status: 'pending', author_id: 'u-1' };
  const r21 = await jalankanAksi('catatan_review', { id: pending.id, keputusan: 'approved' }, ctx(klienTiruan(jawabCatatan(pending)).db, team, efekTiruan().efek));
  cek('review hanya Admin/Full Access', !r21.ok && /Full Access/.test(String(r21.galat)));
  const e22 = efekTiruan();
  const { db: d22, kueri: k22 } = klienTiruan(jawabCatatan(pending));
  const r22 = await jalankanAksi('catatan_review', { id: pending.id, keputusan: 'revisi', catatan: 'Tambah foto' }, ctx(d22, manajer, e22.efek));
  cek('revisi: status revision, riwayat revision_requested, WA ke penulis', r22.ok === true
    && JSON.stringify(k22.find(q => q.tabel === 'tech_notes' && q.op === 'update')?.nilai).includes('"status":"revision"')
    && JSON.stringify(k22.find(q => q.tabel === 'tech_note_history')?.nilai).includes('"action":"revision_requested"')
    && e22.wa.some(w => w.target === '0812' && w.pesan.includes('*TECH NOTE PERLU REVISI*')));
  const r23 = await jalankanAksi('catatan_review', { id: pending.id, keputusan: 'approved' },
    ctx(klienTiruan(jawabCatatan({ ...pending, status: 'approved' })).db, manajer, efekTiruan().efek));
  cek('hanya yang Pending yang bisa direview', !r23.ok && /Pending/.test(String(r23.galat)));

  // ------------------------------------------------------------ Unit Movement
  console.log('unit movement');
  const jawabUnit = (log: Record<string, unknown> | null, tambahan: Partial<AkunTambahan> = {}) => (q: Kueri): Hasil | undefined => {
    if (q.tabel === 'users' && q.kolom === 'full_name') return { data: [{ full_name: 'Dhany' }, { full_name: 'Budi' }] };
    const u = jawabUsers(q, tambahan); if (u) return u;
    if (q.tabel === 'app_settings') return { data: null };
    if (q.tabel === 'movement_logs' && q.op === 'insert') return { data: [{ id: 'mv-1' }] };
    if (q.tabel === 'movement_logs' && q.op === 'select') return { data: log };
    if (q.tabel === 'movement_logs' && q.op === 'update') return { data: [{ id: 'mv-1' }] };
    return undefined;
  };
  const r24 = await jalankanAksi('unit_catat', { project: 'BCA', tipe: 'LED Cabinet' }, ctx(klienTiruan(jawabUnit(null, { pimpinan: true })).db, team, efekTiruan().efek));
  cek('pimpinan tidak bisa menambah log', !r24.ok);
  const { db: d25, kueri: k25 } = klienTiruan(jawabUnit(null));
  const r25 = await jalankanAksi('unit_catat', { project: 'BCA', tipe: 'LED Cabinet', sn: 'SN1', kembali: '2026-11-01' }, ctx(d25, team, efekTiruan().efek));
  const ins25 = JSON.stringify(k25.find(q => q.tabel === 'movement_logs' && q.op === 'insert')?.nilai);
  cek('log Keluar: nama PTS = pemilik token, event bawaan Project, tanggal kembali', r25.ok === true
    && ins25.includes('"status_barang":"Keluar"') && ins25.includes('"nama_pts":"Dhany"') && ins25.includes('"event":"Project"')
    && ins25.includes('"expected_return_date":"2026-11-01"') && ins25.includes('"created_by":"dhany"'), ins25);
  const r26 = await jalankanAksi('unit_catat', { project: 'BCA', event: 'Liburan' }, ctx(klienTiruan(jawabUnit(null)).db, team, efekTiruan().efek));
  cek('event di luar daftar pilihan ditolak', !r26.ok && /Troubleshooting/.test(String(r26.galat)));
  const r27 = await jalankanAksi('unit_kembali', { id: '44444444-aaaa-bbbb-cccc-000000000001' },
    ctx(klienTiruan(jawabUnit({ id: 'mv-1', project_name: 'BCA', status_barang: 'Masuk', return_confirmed: false, created_by: 'dhany' })).db, team, efekTiruan().efek));
  cek('barang Masuk tidak bisa ditandai kembali', !r27.ok && /Keluar/.test(String(r27.galat)));
  const { db: d28, kueri: k28 } = klienTiruan(jawabUnit({ id: 'mv-1', project_name: 'BCA', status_barang: 'Keluar', return_confirmed: false, created_by: 'dhany' }));
  const r28 = await jalankanAksi('unit_kembali', { id: '44444444-aaaa-bbbb-cccc-000000000001' }, ctx(d28, team, efekTiruan().efek));
  cek('tandai kembali: return_confirmed=true', r28.ok === true && JSON.stringify(k28.find(q => q.op === 'update')?.nilai) === '{"return_confirmed":true}');

  // ------------------------------------------------------------ Piket
  console.log('piket');
  const jawabPiket = (adaDemo: number) => (q: Kueri): Hasil | undefined => {
    const u = jawabUsers(q); if (u) return u;
    if (q.tabel === 'app_settings') return { data: null };
    if (q.tabel === 'piket_schedules' && q.op === 'select') return { data: { id: 'pk-1', day_date: '2026-10-20' } };
    if (q.tabel === 'piket_tamu_detail' && q.op === 'select' && q.head) return { count: adaDemo };
    if (q.tabel === 'piket_tamu_detail' && q.op === 'insert') return { data: [{ id: 'kg-1' }] };
    return undefined;
  };
  const r29 = await jalankanAksi('piket_catat', { jenis: 'Demo Product', tamu: 'PT Maju' }, ctx(klienTiruan(jawabPiket(0)).db, sales, efekTiruan().efek));
  cek('akun non-PTS tanpa izin piket_ubah hanya melihat', !r29.ok && /hanya bisa melihat/.test(String(r29.galat)));
  const { db: d30, kueri: k30 } = klienTiruan(jawabPiket(0));
  const r30 = await jalankanAksi('piket_catat', { tanggal: '2026-10-20', jenis: 'demo product', tamu: 'PT Maju', kebutuhan: 'LED, Videowall', jam_mulai: '10:00', jam_selesai: '11:00' },
    ctx(d30, team, efekTiruan().efek));
  const ins30 = JSON.stringify(k30.find(q => q.tabel === 'piket_tamu_detail' && q.op === 'insert')?.nilai);
  const upd30 = JSON.stringify(k30.find(q => q.tabel === 'piket_schedules' && q.op === 'update')?.nilai);
  cek('Demo Product pertama hari itu: kegiatan tersimpan & ringkasan hari ikut', r30.ok === true
    && ins30.includes('"jenis_kegiatan":"Demo Product"') && ins30.includes('"tamu_instansi":"PT Maju"') && upd30.includes('"tamu_instansi":"PT Maju"'), upd30);
  const { db: d31, kueri: k31 } = klienTiruan(jawabPiket(1));
  await jalankanAksi('piket_catat', { tanggal: '2026-10-20', jenis: 'Demo Product', tamu: 'PT Lain' }, ctx(d31, team, efekTiruan().efek));
  cek('Demo kedua tidak menimpa ringkasan hari', !JSON.stringify(k31.find(q => q.tabel === 'piket_schedules' && q.op === 'update')?.nilai).includes('tamu_instansi'));
  const r32 = await jalankanAksi('piket_catat', { jenis: 'Karaoke' }, ctx(klienTiruan(jawabPiket(0)).db, team, efekTiruan().efek));
  cek('jenis kegiatan di luar daftar ditolak', !r32.ok && /Demo Product/.test(String(r32.galat)));

  // ------------------------------------------------------------ penyaring baca
  console.log('penyaring lihat');
  const { db: d33, kueri: k33 } = klienTiruan(q => jawabUsers(q));
  await jalankanAksi('unit_cari', {}, ctx(d33, sales, efekTiruan().efek, ['baca']));
  cek('Unit Movement: Sales hanya log yang ia catat / yang mencatat namanya',
    !!k33.find(q => q.tabel === 'movement_logs')?.filter.includes('or:created_by.eq."andi",nama_luar.eq."Andi"'));
  const { db: d34, kueri: k34 } = klienTiruan(q => jawabUsers(q));
  await jalankanAksi('unit_cari', {}, ctx(d34, team, efekTiruan().efek, ['baca']));
  cek('Unit Movement: orang dalam PTS tanpa penyaring', !k34.find(q => q.tabel === 'movement_logs')?.filter.some(f => f.startsWith('or:')));
  const { db: d35, kueri: k35 } = klienTiruan(q => jawabUsers(q));
  await jalankanAksi('review_cari', {}, ctx(d35, team, efekTiruan().efek, ['baca']));
  cek('Form Review: team tanpa Full Access = yang ia tangani', !!k35.find(q => q.tabel === 'form_reviews')?.filter.includes('eq:assigned_to,dhany'));
  const { db: d36, kueri: k36 } = klienTiruan(q => jawabUsers(q));
  await jalankanAksi('catatan_cari', {}, ctx(d36, team, efekTiruan().efek, ['baca']));
  const tn = k36.filter(q => q.tabel === 'tech_notes');
  cek('Tech Note: bukan pengelola = approved + miliknya', tn.length === 2 && tn[0].filter.includes('eq:status,approved') && tn[1].filter.includes('eq:author_id,u-1'));
  const { db: d37 } = klienTiruan(q => (q.tabel === 'project_requests' ? { data: { ...dasarReq, assign_name: null } } : jawabUsers(q)));
  const r37 = await jalankanAksi('desain_detail', { id: dasarReq.id }, ctx(d37, team, efekTiruan().efek, ['baca']));
  cek('Request Design: Team PTS biasa tidak melihat request yang belum di-assign', !r37.ok && /tidak punya akses/.test(String(r37.galat)));

  // ------------------------------------------------------------ analisa
  console.log('analisa');
  const p1 = periodeAnalisa({}, '2026-10-20');
  const p2 = periodeAnalisa({ periode: 'minggu' }, '2026-10-20');
  const p3 = periodeAnalisa({ periode: 'kuartal' }, '2026-10-20');
  cek('periode bawaan = bulan ini', p1.dari === '2026-10-01' && p1.sampai === '2026-10-31', JSON.stringify(p1));
  cek('periode minggu = Senin..Minggu', p2.dari === '2026-10-19' && p2.sampai === '2026-10-25', JSON.stringify(p2));
  cek('periode kuartal', p3.dari === '2026-10-01' && p3.sampai === '2026-12-31', JSON.stringify(p3));
  const lama = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const { db: d38 } = klienTiruan(q => {
    const u = jawabUsers(q); if (u) return u;
    if (q.tabel === 'tickets' && q.filter.some(f => f.startsWith('not:status,in'))) {
      return { data: [{ id: 't1', project_name: 'RS A', status: 'Overdue', assign_name: 'Budi', created_at: lama, updated_at: lama },
        { id: 't2', project_name: 'RS B', status: 'Pending', assign_name: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] };
    }
    if (q.tabel === 'reminders' && q.filter.some(f => f.startsWith('lt:due_date'))) {
      return { data: [{ id: 'r1', project_name: 'Kejaksaan', category: 'Installation', due_date: '2026-10-01', status: 'pending', assign_name: 'Budi' }] };
    }
    return undefined;
  });
  const r38 = await jalankanAksi('analisa', {}, ctx(d38, team, efekTiruan().efek, ['baca']));
  const temuan = (r38.temuan as string[] | undefined) ?? [];
  cek('analisa berjalan dengan token baca', r38.ok === true, JSON.stringify(r38).slice(0, 300));
  cek('temuan pertama = jadwal terlambat (paling mendesak)', /1 jadwal terlambat belum selesai, paling lama Kejaksaan/.test(temuan[0] ?? ''), JSON.stringify(temuan));
  cek('temuan tiket macet & Overdue', temuan.some(t => /1 tiket aktif tanpa update lebih dari 3 hari/.test(t)) && temuan.some(t => /1 tiket berstatus Overdue/.test(t)));
  cek('tiket tanpa handler terhitung', (r38.tiket as { belum_ada_handler: number }).belum_ada_handler === 1);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
