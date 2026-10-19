/**
 * uji/integrasi-diwaypi.ts - token pribadi DIWAYPI & daftar aksinya: bentuk/hash token, token
 * dicabut, token baca-saja tidak bisa menulis, aturan status tiket Team PTS, dan aksi tahap 2
 * (tiket Solved, ubah status jadwal, buat jadwal). Klien Supabase & pengirim tiruan - tidak
 * ada jaringan.
 *
 * Bukti "efek sama dengan aplikasi web": untuk tiap aksi tahap 2, modul bersama dipanggil juga
 * PERSIS seperti hook peramban memanggilnya (useSelesaiTicket / useUbahStatus / useSimpanJadwal),
 * lalu baris yang ditulis dan pesan yang dikirim kedua jalur dibandingkan.
 *
 * Jalankan: npm test -- integrasi-diwaypi
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ambilBearer, bentukSah, buatTokenMentah, hashToken, verifikasiToken } from '../lib/token-integrasi';
import { jalankanAksi, statusResmi, type KonteksAksi } from '../lib/integrasi-aksi';
import type { UserLengkap } from '../lib/ai-server';
import type { EfekSamping } from '../lib/efek-samping';
import type { NotifPayload } from '../lib/notifications';
import type { AuditPayload } from '../lib/audit';
import { kabarkanTicketSelesai } from '../lib/tiket-selesai';
import { ubahStatusJadwal, type BarisJadwal } from '../lib/jadwal-status';
import { buatJadwal, type IsianJadwal } from '../lib/jadwal-buat';
import { buatEfekServer } from '../lib/efek-server';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, detail = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${detail ? `\n         ${detail}` : ''}`); }
}

interface Kueri { tabel: string; op: 'select' | 'insert' | 'update' | 'delete' | 'rpc'; kolom?: string; nilai?: unknown; filter: string[] }
type Hasil = { data?: unknown; error?: unknown; count?: number };

/** Pembangun query tiruan yang mencatat setiap permintaan dan menjawab lewat `jawab`. */
function klienTiruan(jawab: (q: Kueri) => Hasil) {
  const kueri: Kueri[] = [];
  const db = {
    from(tabel: string) {
      const q: Kueri = { tabel, op: 'select', filter: [] };
      kueri.push(q);
      const b: Record<string, unknown> = {};
      const rantai = (...nama: string[]) => nama.forEach(n => { b[n] = (...a: unknown[]) => { q.filter.push(`${n}:${a.map(String).join(',')}`); return b; }; });
      rantai('eq', 'neq', 'not', 'is', 'in', 'or', 'ilike', 'gte', 'gt', 'lte', 'lt', 'order', 'limit');
      b.select = (k?: string) => { if (q.op === 'select') q.kolom = k; return b; };
      b.insert = (v: unknown) => { q.op = 'insert'; q.nilai = v; return b; };
      b.update = (v: unknown) => { q.op = 'update'; q.nilai = v; return b; };
      b.delete = () => { q.op = 'delete'; return b; };
      b.maybeSingle = () => b;
      b.single = () => b;
      b.then = (ok: (h: Hasil) => unknown, tolak?: (e: unknown) => unknown) => Promise.resolve().then(() => jawab(q)).then(ok, tolak);
      return b;
    },
    rpc(nama: string, args: unknown) {
      const q: Kueri = { tabel: nama, op: 'rpc', nilai: args, filter: [] };
      kueri.push(q);
      return Promise.resolve().then(() => jawab(q));
    },
  };
  return { db: db as unknown as SupabaseClient, kueri };
}

/** Pengirim tiruan: mencatat WA, notifikasi in-app, dan audit. */
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

/** Tulisan (bukan baca) dengan cap waktu dibuang - supaya dua jalur bisa dibandingkan. */
function tulisanBersih(kueri: Kueri[]) {
  const buang = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === 'updated_at' || k === 'batch_id' && typeof x === 'string' && x.length > 20 ? '<x>' : x)));
  return JSON.stringify(kueri.filter(q => q.op !== 'select').map(q => ({ t: q.tabel, op: q.op, f: q.filter, v: buang(q.nilai) })));
}

const u: UserLengkap = { id: 'u-1', username: 'dhany', full_name: 'Dhany', role: 'team', sales_division: null,
  access_level: null, team_type: 'Team PTS IVP', jabatan: 'Engineer' };

async function main() {
  console.log('token');
  const t = buatTokenMentah();
  cek('bentuk token dwp_ + 32 karakter', bentukSah(t) && t.length === 36, t);
  cek('dua token berbeda', buatTokenMentah() !== t);
  cek('hash sha256 hex 64', /^[0-9a-f]{64}$/.test(hashToken(t)));
  cek('Bearer dibaca', ambilBearer(`Bearer ${t}`) === t);
  cek('Bearer bentuk salah ditolak', ambilBearer('Bearer abc') === null && ambilBearer(t) === null && ambilBearer(null) === null);

  const hash = hashToken(t);
  const baris = { id: 'tk-1', user_id: 'u-1', cakupan: ['baca'], dicabut: null as string | null, terakhir_dipakai: new Date().toISOString(), token_hash: hash };
  const { db: dbTok } = klienTiruan(q => (q.tabel === 'token_integrasi' && q.filter.includes(`eq:token_hash,${hash}`) ? { data: baris } : { data: null }));
  const p = await verifikasiToken(dbTok, t);
  cek('token terdaftar dikenali', p?.userId === 'u-1' && p.cakupan.join() === 'baca');
  cek('token asing ditolak', (await verifikasiToken(dbTok, buatTokenMentah())) === null);
  baris.dicabut = new Date().toISOString();
  cek('token dicabut ditolak', (await verifikasiToken(dbTok, t)) === null);

  console.log('aksi');
  cek('statusResmi menormalkan ejaan', statusResmi('in progress') === 'In Progress' && statusResmi('xyz') === null);

  const { db: dbKosong, kueri: kKosong } = klienTiruan(() => ({ data: null }));
  const eKosong = efekTiruan();
  const ctxBaca: KonteksAksi = { db: dbKosong, admin: dbKosong, u, cakupan: ['baca'], efek: eKosong.efek };
  const r1 = await jalankanAksi('tiket_aktivitas', { id: '11111111-2222-3333-4444-555555555555', status: 'Call' }, ctxBaca);
  cek('token baca-saja tidak bisa menulis', !r1.ok && /hanya boleh MEMBACA/.test(String(r1.galat)));
  for (const nama of ['tiket_selesai', 'jadwal_buat', 'jadwal_status', 'jadwal_selesai']) {
    const r = await jalankanAksi(nama, { id: '11111111-2222-3333-4444-555555555555', status: 'done' }, ctxBaca);
    cek(`token baca-saja tidak bisa ${nama}`, !r.ok && /hanya boleh MEMBACA/.test(String(r.galat)));
  }
  cek('...dan tidak menyentuh DB / mengirim apa pun', kKosong.length === 0 && eKosong.wa.length === 0, JSON.stringify(kKosong));
  const r3 = await jalankanAksi('hapus_semua', {}, ctxBaca);
  cek('aksi tak dikenal ditolak', !r3.ok && /tidak dikenal/.test(String(r3.galat)));

  // tiket_aktivitas: aturan alur-status ditegakkan sebelum menulis apa pun
  const tiket = { id: '11111111-2222-3333-4444-555555555555', status: 'Pending', project_name: 'BCA', issue_case: 'LED mati',
    product: 'LED', sn_unit: null, sales_name: 'Andi', sales_division: 'A', address: 'Jl. X', customer_phone: '08', current_team: 'Team PTS IVP',
    is_deleted: false, assign_name: 'Dhany', created_by: 'admin1', assigned_supervisor_id: 'sup-1', internal_sales_id: null, internal_sales_id_2: null };
  const tulisan: Kueri[] = [];
  const { db: dbTiket } = klienTiruan(q => {
    if (q.op !== 'select') tulisan.push(q);
    if (q.tabel === 'tickets' && q.op === 'select') return { data: tiket };
    if (q.tabel === 'tickets' && q.op === 'update') return { data: [{ id: tiket.id }] };
    if (q.tabel === 'reminders' && q.op === 'select') return { data: [] };
    return { data: null, error: null };
  });
  const eTiket = efekTiruan();
  const ctxTulis: KonteksAksi = { db: dbTiket, admin: dbTiket, u, cakupan: ['baca', 'tulis'], efek: eTiket.efek };

  const r5 = await jalankanAksi('tiket_aktivitas', { id: tiket.id, status: 'Pending Action', catatan: 'x' }, ctxTulis);
  cek('loncat status tak sah ditolak (Pending -> Pending Action)', !r5.ok && /tidak bisa diubah/.test(String(r5.galat)) && tulisan.length === 0, String(r5.galat));
  const r6 = await jalankanAksi('tiket_aktivitas', { id: tiket.id }, ctxTulis);
  cek('catatan saja tanpa catatan ditolak', !r6.ok && /Isi catatannya/.test(String(r6.galat)) && tulisan.length === 0, String(r6.galat));

  const r7 = await jalankanAksi('tiket_aktivitas', { id: tiket.id, status: 'onsite', jadwal_tanggal: '2026-10-20', jadwal_jam: '09:30' }, ctxTulis);
  const log = tulisan.find(q => q.tabel === 'activity_logs');
  const upd = tulisan.find(q => q.tabel === 'tickets');
  const rem = tulisan.find(q => q.tabel === 'reminders' && q.op === 'insert');
  cek('Onsite sah tersimpan', r7.ok === true && r7.status_baru === 'Onsite', JSON.stringify(r7));
  cek('catatan otomatis Onsite berjadwal (sama dengan aplikasi)',
    JSON.stringify(log?.nilai).includes('Dijadwalkan Onsite pada 2026-10-20 pukul 09:30 WIB.'), JSON.stringify(log?.nilai));
  cek('handler = pemilik token', JSON.stringify(log?.nilai).includes('"handler_username":"dhany"'));
  cek('status tiket diperbarui', JSON.stringify(upd?.nilai) === '{"status":"Onsite"}', JSON.stringify(upd?.nilai));
  cek('jadwal Onsite otomatis dibuat & tertaut ke tiket',
    !!rem && JSON.stringify(rem.nilai).includes(`"ticket_id":"${tiket.id}"`) && JSON.stringify(rem.nilai).includes('"due_time":"09:30"'));
  cek('tercatat di audit trail', eTiket.audit.some(a => a.module === 'ticket' && a.new_value === 'Onsite'));
  cek('status selain Solved tidak mengabari siapa pun', eTiket.wa.length === 0 && eTiket.inApp.length === 0);

  // update yang ditolak RLS (0 baris tanpa galat) tidak boleh dilaporkan berhasil
  const tiketTolak = { ...tiket, status: 'In Progress' };
  const { db: dbRls, kueri: kRls } = klienTiruan(q => {
    if (q.tabel === 'tickets' && q.op === 'select') return { data: tiketTolak };
    if (q.tabel === 'tickets' && q.op === 'update') return { data: [] };
    return { data: null };
  });
  const eRls = efekTiruan();
  const ctxRls: KonteksAksi = { db: dbRls, admin: dbRls, u, cakupan: ['baca', 'tulis'], efek: eRls.efek };
  const r8 = await jalankanAksi('tiket_aktivitas', { id: tiket.id, status: 'Call' }, ctxRls);
  cek('0 baris (RLS) = gagal, bukan berhasil', !r8.ok && /TIDAK berubah/.test(String(r8.galat)));
  const r8b = await jalankanAksi('tiket_selesai', { id: tiket.id, catatan: 'beres' }, ctxRls);
  cek('Solved ditolak RLS: tidak ada kabar & jadwal tidak ditutup',
    !r8b.ok && eRls.wa.length === 0 && eRls.inApp.length === 0 && !kRls.some(q => q.op === 'rpc'));

  const r9 = await jalankanAksi('tiket_aktivitas', { id: tiket.id, status: 'Call' },
    { ...ctxTulis, u: { ...u, team_type: 'Team Services' } });
  cek('akun Team Services diarahkan ke aplikasi', !r9.ok && /Team Services/.test(String(r9.galat)));

  //  Syarat tombol Update Status (bolehUpdateTicket): RLS juga meloloskan pembuat tiket, tapi
  //  Sales pembuat tiket tidak boleh menutupnya lewat DIWAYPI.
  const eSales = efekTiruan();
  const { db: dbSales, kueri: kSales } = klienTiruan(q => q.tabel === 'tickets' && q.op === 'select' ? { data: { ...tiket, status: 'In Progress' } } : { data: null });
  const r9b = await jalankanAksi('tiket_selesai', { id: tiket.id, catatan: 'beres' },
    { db: dbSales, admin: dbSales, u: { ...u, role: 'sales', access_level: 'guest', full_name: 'Andi Sales' }, cakupan: ['baca', 'tulis'], efek: eSales.efek });
  cek('bukan handler & tanpa akses penuh: ditolak sebelum menulis apa pun',
    !r9b.ok && /handler/.test(String(r9b.galat)) && !kSales.some(q => q.op !== 'select') && eSales.wa.length === 0, String(r9b.galat));

  const r10 = await jalankanAksi('daily_report_tambah', { tanggal: '2999-01-01', deskripsi: 'x' }, ctxTulis);
  cek('daily report masa depan ditolak', !r10.ok && /belum terjadi/.test(String(r10.galat)));

  await ujiTiketSelesai(tiket);
  await ujiJadwalStatus();
  await ujiJadwalBuat();
  await ujiEfekServer();

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
}

// ---------------------------------------------------------------- tiket Solved
const ORANG = [
  { id: 's-1', full_name: 'Andi', username: 'andi', phone_number: '0811' },
  { id: 'u-1', full_name: 'Dhany', username: 'dhany', phone_number: '0812' },
  { id: 'a-1', full_name: 'Admin Satu', username: 'admin1', phone_number: null },
  { id: 'sup-1', full_name: 'Supri', username: 'supri', phone_number: '0813' },
];
function jawabOrang(q: Kueri): Hasil | null {
  if (q.tabel !== 'users' || q.kolom !== 'id,full_name,username,phone_number') return null;
  const f = q.filter[0] ?? '';
  const [kolom, ...nilai] = f.replace(/^in:/, '').split(',');
  return { data: ORANG.filter(o => nilai.includes(String((o as Record<string, unknown>)[kolom]))) };
}

async function ujiTiketSelesai(tiketDasar: Record<string, unknown> & { id: string }) {
  console.log('tiket_selesai');
  const tiket = { ...tiketDasar, status: 'In Progress' };
  const { db, kueri } = klienTiruan(q => {
    const o = jawabOrang(q); if (o) return o;
    if (q.tabel === 'tickets' && q.op === 'select') return { data: tiket };
    if (q.tabel === 'tickets' && q.op === 'update') return { data: [{ id: tiket.id }] };
    if (q.op === 'rpc') return { data: 1 };
    return { data: null, error: null };
  });
  const e = efekTiruan();
  const ctx: KonteksAksi = { db, admin: db, u, cakupan: ['baca', 'tulis'], efek: e.efek };

  const tanpa = await jalankanAksi('tiket_selesai', { id: tiket.id }, ctx);
  cek('Solved tanpa catatan penyelesaian ditolak', !tanpa.ok && /Catatan wajib/.test(String(tanpa.galat))
    && !kueri.some(q => q.op !== 'select'), String(tanpa.galat));

  const r = await jalankanAksi('tiket_selesai', { id: tiket.id, catatan: 'beres' }, ctx);
  const iLog = kueri.findIndex(q => q.tabel === 'activity_logs' && q.op === 'insert');
  const iUpd = kueri.findIndex(q => q.tabel === 'tickets' && q.op === 'update');
  const iRpc = kueri.findIndex(q => q.op === 'rpc');
  cek('Solved tersimpan', r.ok === true && r.status_baru === 'Solved', JSON.stringify(r));
  cek('activity log Solved berisi catatan penyelesaian',
    JSON.stringify(kueri[iLog]?.nilai).includes('"new_status":"Solved"') && JSON.stringify(kueri[iLog]?.nilai).includes('"notes":"beres"'));
  cek('status tiket = Solved', JSON.stringify(kueri[iUpd]?.nilai) === '{"status":"Solved"}');
  cek('rpc tutup_jadwal_ticket(done) SESUDAH tiket tersimpan', iRpc > iUpd
    && kueri[iRpc].tabel === 'tutup_jadwal_ticket' && JSON.stringify(kueri[iRpc].nilai) === `{"p_ticket_id":"${tiket.id}","p_status":"done"}`);
  cek('Sales, handler, pembuat & Supervisor dikabari in-app', e.inApp.length === 4 && r.dikabari === 4, JSON.stringify(e.inApp.map(x => x.user_id)));
  cek('WA hanya ke yang punya nomor', e.wa.map(w => w.target).sort().join() === '0811,0812,0813', JSON.stringify(e.wa.map(w => w.target)));
  const keSaya = e.wa.find(w => w.target === '0812')?.pesan ?? '';
  const keSales = e.wa.find(w => w.target === '0811')?.pesan ?? '';
  cek('penutup menerima ucapan terima kasih', keSaya.includes('🎉 *Terima Kasih!*') && keSaya.includes('sudah kamu tutup sebagai *Solved*'));
  cek('pihak lain: "diselesaikan oleh" + catatan', keSales.includes('sudah diselesaikan oleh *Dhany*') && keSales.includes('📝 *Catatan :* beres'));
  cek('jadwal tiket ikut ditutup dilaporkan', r.jadwal_ditutup === 1);

  //  Sama dengan aplikasi: useSelesaiTicket memanggil modul yang sama dengan (supabase, efekPeramban, t, catatan, currentUser).
  const { db: db2 } = klienTiruan(q => jawabOrang(q) ?? { data: null });
  const e2 = efekTiruan();
  await kabarkanTicketSelesai(db2, e2.efek, tiket as never, 'beres', { id: 'u-1', full_name: 'Dhany' });
  cek('kabar DIWAYPI = kabar aplikasi web (WA & in-app identik)',
    JSON.stringify(e2.wa) === JSON.stringify(e.wa) && JSON.stringify(e2.inApp) === JSON.stringify(e.inApp));
}

// ---------------------------------------------------------------- jadwal_status
const JADWAL: BarisJadwal & { is_deleted: boolean } = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001', project_name: 'BCA Sentul', category: 'Konfigurasi', status: 'pending',
  due_date: '2026-10-20', assigned_to: 'dhany', assign_name: 'Dhany', sales_name: 'Budi Guest', sales_division: 'Div A',
  sales_user_id: null, created_by: 'admin1', batch_id: 'B1', product: 'LED P2', address: 'Jl. X', is_deleted: false,
};
function klienJadwal(jadwal: typeof JADWAL) {
  return klienTiruan(q => {
    if (q.tabel === 'reminders' && q.op === 'select' && q.kolom?.includes('project_name')) return { data: jadwal };
    if (q.tabel === 'reminders') return { data: [{ id: jadwal.id }, { id: 'aaaaaaaa-0000-0000-0000-000000000002' }] };
    if (q.tabel === 'app_settings') return { data: { value: '"mgr-x"' } };
    if (q.tabel === 'users' && q.kolom === 'pimpinan') return { data: { pimpinan: false } };
    if (q.tabel === 'users' && q.kolom === 'jabatan') return { data: { jabatan: 'Engineer' } };
    if (q.tabel === 'users' && q.kolom === 'phone_number, full_name') return { data: { phone_number: '0812', full_name: 'Dhany' } };
    if (q.tabel === 'users' && q.filter.includes('eq:role,guest')) return { data: { id: 'g-1', username: 'budi', full_name: 'Budi Guest', role: 'guest', phone_number: '0899' } };
    if (q.tabel === 'form_reviews' && q.op === 'select') return { data: null };
    return { data: null, error: null };
  });
}

async function ujiJadwalStatus() {
  console.log('jadwal_status');
  const { db, kueri } = klienJadwal(JADWAL);
  const e = efekTiruan();
  const ctx: KonteksAksi = { db, admin: db, u, cakupan: ['baca', 'tulis'], efek: e.efek };

  const r0 = await jalankanAksi('jadwal_selesai', { id: JADWAL.id }, ctx);
  cek('Konfigurasi selesai tanpa detail pelaksanaan ditolak', !r0.ok && /Pilih mode penyelesaian/.test(String(r0.galat))
    && !kueri.some(q => q.op !== 'select') && e.wa.length === 0, String(r0.galat));
  const rRemote = await jalankanAksi('jadwal_status', { id: JADWAL.id, status: 'selesai', mode: 'remote', tipe_display: 'lcd' }, ctx);
  cek('mode Remote tanpa PTS Daerah ditolak', !rRemote.ok && /PTS Daerah wajib/.test(String(rRemote.galat)));

  const n0 = kueri.length;
  const r = await jalankanAksi('jadwal_status', { id: JADWAL.id, status: 'done', mode: 'onsite', tipe_display: 'led', bast_tanggal: '2026-10-21' }, ctx);
  const baru = kueri.slice(n0);
  const iDetail = baru.findIndex(q => q.tabel === 'reminders' && q.op === 'update' && JSON.stringify(q.nilai).includes('mode_penyelesaian'));
  const iStatus = baru.findIndex(q => q.tabel === 'reminders' && q.op === 'update' && JSON.stringify(q.nilai).includes('"status":"done"'));
  const review = baru.find(q => q.tabel === 'form_reviews' && q.op === 'insert');
  cek('jadwal Completed tersimpan', r.ok === true && r.status_baru === 'done' && r.jumlah_tanggal === 2, JSON.stringify(r));
  cek('detail pelaksanaan ditulis ke seluruh batch SEBELUM status', iDetail >= 0 && iDetail < iStatus
    && baru[iDetail].filter.includes('eq:batch_id,B1') && JSON.stringify(baru[iDetail].nilai).includes('"bast_date":"2026-10-21"')
    && JSON.stringify(baru[iDetail].nilai).includes('"pic_type":"standard"'), JSON.stringify(baru[iDetail]));
  cek('status done ditulis ke seluruh batch', baru[iStatus]?.filter.includes('eq:batch_id,B1'));
  cek('form review otomatis: BAST, produk, guest & batch', !!review && /"review_category":"BAST"/.test(JSON.stringify(review.nilai))
    && /"product_bast":"LED P2"/.test(JSON.stringify(review.nilai)) && /"guest_user_id":"g-1"/.test(JSON.stringify(review.nilai))
    && /"batch_id":"B1"/.test(JSON.stringify(review.nilai)) && r.form_review_untuk === 'Budi Guest', JSON.stringify(review?.nilai));
  cek('WA "JADWAL SELESAI" ke handler', e.wa.some(w => w.target === '0812' && w.pesan.startsWith('✅ *JADWAL SELESAI*') && w.event === 'reminder.updated'));
  cek('WA permintaan review ke guest', e.wa.some(w => w.target === '0899' && w.pesan.startsWith('⭐ *REVIEW DIMINTA') && w.event === 'reminder.form_review_sent'));
  cek('audit: status_change, 2 tanggal', e.audit.some(a => a.action === 'status_change' && a.new_value === 'done' && /2 tanggal/.test(a.notes ?? '')));

  //  Sama dengan aplikasi: useUbahStatus memanggil ubahStatusJadwal dengan baris jadwal dari state,
  //  sesudah useModePenyelesaian menulis detail - di sini cukup bagian status (detail sudah dicek di atas).
  const { db: db2, kueri: k2 } = klienJadwal(JADWAL);
  const e2 = efekTiruan();
  await ubahStatusJadwal(db2, e2.efek, { id: JADWAL.id, status: 'done', sebelum: JADWAL, pelaku: { id: 'u-1', full_name: 'Dhany' }, jumlahSebatch: 2 });
  const statusDiwaypi = baru.slice(iStatus);
  cek('baris & WA DIWAYPI = aplikasi web (status Completed)', tulisanBersih(statusDiwaypi) === tulisanBersih(k2)
    && JSON.stringify(e.wa) === JSON.stringify(e2.wa), `${tulisanBersih(statusDiwaypi)}\n         ${tulisanBersih(k2)}`);

  const { db: db3, kueri: k3 } = klienJadwal({ ...JADWAL, status: 'done' });
  const r3 = await jalankanAksi('jadwal_status', { id: JADWAL.id, status: 'pending' }, { ...ctx, db: db3, admin: db3 });
  cek('Completed tidak bisa diubah kembali', !r3.ok && /tidak dapat diubah kembali/.test(String(r3.galat)) && !k3.some(q => q.op !== 'select'));

  const { db: db4, kueri: k4 } = klienJadwal(JADWAL);
  const orangLain: UserLengkap = { ...u, id: 'u-9', username: 'sari', full_name: 'Sari' };
  const r4 = await jalankanAksi('jadwal_status', { id: JADWAL.id, status: 'cancelled' }, { ...ctx, db: db4, admin: db4, u: orangLain });
  cek('bukan pelaku jadwal ditolak (aturan tombol Update Status)', !r4.ok && /Hanya pelaksana/.test(String(r4.galat)) && !k4.some(q => q.op !== 'select'));

  const tunggal = { ...JADWAL, category: 'Troubleshooting', batch_id: null };
  const { db: db5, kueri: k5 } = klienJadwal(tunggal);
  const e5 = efekTiruan();
  const r5 = await jalankanAksi('jadwal_status', { id: JADWAL.id, status: 'batal' }, { ...ctx, db: db5, admin: db5, efek: e5.efek });
  const upd5 = k5.find(q => q.op === 'update');
  cek('batal: satu baris, tanpa detail/WA/form review', r5.ok === true && !!upd5 && upd5.filter.includes(`eq:id,${JADWAL.id}`)
    && JSON.stringify(upd5.nilai).includes('"status":"cancelled"') && e5.wa.length === 0 && !k5.some(q => q.tabel === 'form_reviews'), JSON.stringify(r5));
}

// ---------------------------------------------------------------- jadwal_buat
const PENGGUNA = [
  { id: 'u-1', username: 'dhany', full_name: 'Dhany', role: 'team', team_type: 'Team PTS IVP', phone_number: '0812', sales_division: null, jabatan: 'Engineer', bisa_ditugaskan: true },
  { id: 'u-9', username: 'sari', full_name: 'Sari', role: 'team', team_type: 'Team PTS IVP', phone_number: '0819', sales_division: null, jabatan: 'Engineer', bisa_ditugaskan: true },
  { id: 'ad-1', username: 'admin1', full_name: 'Admin Satu', role: 'admin', team_type: null, phone_number: '0800', sales_division: null, jabatan: null, bisa_ditugaskan: true },
];
const TAMU = [{ id: 'g-1', username: 'budi', full_name: 'Budi Guest', role: 'guest', phone_number: '0899', sales_division: 'Div A' }];

function klienBuat(lama: unknown[] = []) {
  let nomor = 0;
  return klienTiruan(q => {
    if (q.tabel === 'users' && q.filter.includes('eq:role,guest')) return { data: TAMU };
    if (q.tabel === 'users' && q.kolom === 'pimpinan') return { data: { pimpinan: false } };
    if (q.tabel === 'users') return { data: PENGGUNA };
    if (q.tabel === 'reminders' && q.op === 'select') return { data: q.filter.some(f => f.startsWith('ilike:')) ? lama : [] };
    if (q.tabel === 'reminders' && q.op === 'insert') {
      return { data: (q.nilai as Record<string, unknown>[]).map(v => ({ ...v, id: `rem-${++nomor}` })) };
    }
    if (q.tabel === 'reminders' && q.op === 'update') return { data: (lama as { id: string }[]).map(x => ({ id: x.id })) };
    return { data: null, error: null };
  });
}

async function ujiJadwalBuat() {
  console.log('jadwal_buat');
  const { db, kueri } = klienBuat();
  const e = efekTiruan();
  const ctx: KonteksAksi = { db, admin: db, u, cakupan: ['baca', 'tulis'], efek: e.efek };
  const args = { project: 'BCA Sentul', tanggal: ['2026-10-21', '2026-10-20'], jam: '10:00', kategori: 'demo product',
    alamat: 'Jl. X', sales: 'budi guest', produk: 'LED', deskripsi: 'Demo LED' };

  const rTamu = await jalankanAksi('jadwal_buat', args, { ...ctx, u: { ...u, role: 'guest' } });
  cek('akun guest tidak bisa membuat jadwal', !rTamu.ok && /Hanya admin dan akun Team/.test(String(rTamu.galat)));
  const rTanpaSales = await jalankanAksi('jadwal_buat', { ...args, sales: '' }, ctx);
  cek('tanpa Sales ditolak (sama dengan form)', !rTanpaSales.ok && /Pilih Sales wajib/.test(String(rTanpaSales.galat)));
  const rAsing = await jalankanAksi('jadwal_buat', { ...args, handler: 'Admin Satu' }, ctx);
  cek('pelaksana di luar daftar yang bisa ditugaskan ditolak', !rAsing.ok && /tidak ada di daftar/.test(String(rAsing.galat)));
  cek('...tanpa menulis apa pun', !kueri.some(q => q.op !== 'select') && e.wa.length === 0);

  const r = await jalankanAksi('jadwal_buat', args, ctx);
  const ins = kueri.find(q => q.tabel === 'reminders' && q.op === 'insert');
  const rows = (ins?.nilai ?? []) as Record<string, unknown>[];
  cek('jadwal 2 hari dibuat', r.ok === true && r.dibuat === 2, JSON.stringify(r));
  cek('dua baris, satu batch_id, tanggal urut', rows.length === 2 && !!rows[0].batch_id && rows[0].batch_id === rows[1].batch_id
    && rows[0].due_date === '2026-10-20' && rows[1].due_date === '2026-10-21');
  cek('pelaksana bawaan = pemilik token (username + nama + uuid)', rows.every(x => x.assigned_to === 'dhany' && x.assign_name === 'Dhany'
    && x.assign_user_id === 'u-1' && x.created_by === 'dhany'));
  cek('Sales dinormalkan ke akun + uuid + divisi', rows.every(x => x.sales_name === 'Budi Guest' && x.sales_user_id === 'g-1' && x.sales_division === 'Div A'));
  cek('kategori resmi & tanpa timeline Project Progress', rows.every(x => x.category === 'Demo Product' && x.progress_start_date === null && x.status === 'pending'));
  cek('audit create per baris', e.audit.filter(a => a.action === 'create' && a.notes === 'Dibuat langsung oleh admin — kategori Demo Product').length === 2);
  const wa = e.wa[0];
  cek('WA "JADWAL BARU" ke pelaksana dengan baris 2 hari', e.wa.length === 1 && wa.target === '0812' && wa.event === 'reminder.assigned'
    && wa.pesan.startsWith('🗓️ *JADWAL BARU — PTS IVP*') && wa.pesan.includes('🕐 *Jadwal (2 hari):*') && wa.pesan.includes('· 10:00'));

  //  Sama dengan aplikasi: useSimpanJadwal (jalur buat baru) memanggil buatJadwal dengan formData-nya.
  const { db: db2, kueri: k2 } = klienBuat();
  const e2 = efekTiruan();
  await buatJadwal(db2, e2.efek, {
    isian: rows[0] as unknown as IsianJadwal, tanggal: ['2026-10-20', '2026-10-21'],
    timeline: { progress_start_date: null, progress_target_date: null },
    pelaksana: { id: 'u-1', username: 'dhany', full_name: 'Dhany', phone_number: '0812' }, alihKeSupervisor: null, supervisor: null,
    salesUserId: 'g-1', pelaku: { id: 'u-1', username: 'dhany', full_name: 'Dhany' }, sinkronProgress: async () => {},
  });
  const ins2 = k2.find(q => q.op === 'insert');
  cek('baris & WA DIWAYPI = aplikasi web (buat jadwal)', tulisanBersih([ins!]) === tulisanBersih([ins2!])
    && JSON.stringify(e.wa) === JSON.stringify(e2.wa), `${tulisanBersih([ins!])}\n         ${tulisanBersih([ins2!])}`);

  // proyek insentif yang sudah ada: aplikasi bertanya - DIWAYPI wajib menjawab
  const lama = [{ id: 'old-1', project_name: 'BCA  sentul', category: 'Training', status: 'done', due_date: '2026-09-01', assign_name: 'Sari', incentive_group_id: null }];
  const { db: db3, kueri: k3 } = klienBuat(lama);
  const ctx3: KonteksAksi = { db: db3, admin: db3, u, cakupan: ['baca', 'tulis'], efek: efekTiruan().efek };
  const argsK = { ...args, tanggal: '2026-10-22', kategori: 'Konfigurasi', progress_mulai: '2026-10-22', progress_target: '2026-10-30' };
  const tanya = await jalankanAksi('jadwal_buat', argsK, ctx3);
  cek('proyek serupa: minta jawaban kelanjutan, tidak menulis', !tanya.ok && tanya.perlu_jawaban === true
    && Array.isArray(tanya.jadwal_sebelumnya) && !k3.some(q => q.op !== 'select'), JSON.stringify(tanya));
  const lanjut = await jalankanAksi('jadwal_buat', { ...argsK, lanjutan: true }, ctx3);
  const tandai = k3.find(q => q.tabel === 'reminders' && q.op === 'update');
  const ins3 = k3.find(q => q.tabel === 'reminders' && q.op === 'insert');
  const grup = (tandai?.nilai as { incentive_group_id?: string } | undefined)?.incentive_group_id;
  cek('lanjutan: jadwal lama & baru satu incentive_group_id', lanjut.ok === true && !!grup && tandai!.filter.includes('in:id,old-1')
    && JSON.stringify(ins3?.nilai).includes(`"incentive_group_id":"${grup}"`), JSON.stringify(lanjut));
  cek('Konfigurasi: timeline Project Progress ikut ditulis', JSON.stringify(ins3?.nilai).includes('"progress_start_date":"2026-10-22"')
    && JSON.stringify(ins3?.nilai).includes('"progress_target_date":"2026-10-30"'));
  cek('Konfigurasi: sinkron Project Progress dijalankan untuk baris baru',
    k3.some(q => q.tabel === 'reminders' && q.op === 'select' && q.filter.some(f => f.startsWith('in:id,rem-'))));
}

// ---------------------------------------------------------------- efek server
async function ujiEfekServer() {
  console.log('efek server');
  const { db, kueri } = klienTiruan(() => ({ data: null, error: null }));
  const { db: admin, kueri: kAdmin } = klienTiruan(q => (q.tabel === 'wa_kirim_log' && q.op === 'select' ? { count: 60 } : { data: null }));
  const efek = buatEfekServer(db, admin, 'u-1');
  await efek.audit({ user_id: 'u-1', user_name: 'Dhany', action: 'status_change', module: 'reminder', notes: 'Berlaku untuk 2 tanggal' });
  const a = kueri.find(q => q.tabel === 'audit_trail');
  cek('audit server ditandai via DIWAYPI', JSON.stringify(a?.nilai).includes('"notes":"Berlaku untuk 2 tanggal · via DIWAYPI"'), JSON.stringify(a?.nilai));
  const h = await efek.wa('0812', 'tes');
  cek('WA server tunduk batas kirim yang sama (wa_kirim_log)', !h.ok && /Terlalu banyak/.test(String(h.reason))
    && !kAdmin.some(q => q.op === 'insert'));
}

main().catch(e => { console.error(e); process.exit(1); });
