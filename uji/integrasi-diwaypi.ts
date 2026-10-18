/**
 * uji/integrasi-diwaypi.ts - token pribadi DIWAYPI & daftar aksinya: bentuk/hash token, token
 * dicabut, token baca-saja tidak bisa menulis, aturan status tiket Team PTS, dan aksi tahap 2
 * ditolak dengan alasan. Klien Supabase tiruan - tidak ada jaringan.
 *
 * Jalankan: npm test -- integrasi-diwaypi
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ambilBearer, bentukSah, buatTokenMentah, hashToken, verifikasiToken } from '../lib/token-integrasi';
import { jalankanAksi, statusResmi, type KonteksAksi } from '../lib/integrasi-aksi';
import type { UserLengkap } from '../lib/ai-server';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, detail = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${detail ? `\n         ${detail}` : ''}`); }
}

interface Kueri { tabel: string; op: 'select' | 'insert' | 'update'; nilai?: unknown; filter: string[] }
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
      rantai('eq', 'neq', 'not', 'is', 'in', 'or', 'ilike', 'gte', 'lte', 'lt', 'order', 'limit');
      b.select = () => b;
      b.insert = (v: unknown) => { q.op = 'insert'; q.nilai = v; return b; };
      b.update = (v: unknown) => { q.op = 'update'; q.nilai = v; return b; };
      b.maybeSingle = () => b;
      b.single = () => b;
      b.then = (ok: (h: Hasil) => unknown, tolak?: (e: unknown) => unknown) => Promise.resolve().then(() => jawab(q)).then(ok, tolak);
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, kueri };
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
  const ctxBaca: KonteksAksi = { db: dbKosong, admin: dbKosong, u, cakupan: ['baca'] };
  const r1 = await jalankanAksi('tiket_aktivitas', { id: '11111111-2222-3333-4444-555555555555', status: 'Call' }, ctxBaca);
  cek('token baca-saja tidak bisa menulis', !r1.ok && /hanya boleh MEMBACA/.test(String(r1.galat)));
  cek('...dan tidak menyentuh DB sama sekali', kKosong.length === 0, JSON.stringify(kKosong));
  const r2 = await jalankanAksi('jadwal_selesai', {}, ctxBaca);
  cek('aksi tahap 2 ditolak dengan alasan', !r2.ok && /belum bisa lewat DIWAYPI/.test(String(r2.galat)));
  const r3 = await jalankanAksi('hapus_semua', {}, ctxBaca);
  cek('aksi tak dikenal ditolak', !r3.ok && /tidak dikenal/.test(String(r3.galat)));

  // tiket_aktivitas: aturan alur-status ditegakkan sebelum menulis apa pun
  const tiket = { id: '11111111-2222-3333-4444-555555555555', status: 'Pending', project_name: 'BCA', issue_case: 'LED mati',
    product: 'LED', sn_unit: null, sales_name: 'Andi', sales_division: 'A', address: 'Jl. X', customer_phone: '08', current_team: 'Team PTS IVP', is_deleted: false };
  const tulisan: Kueri[] = [];
  const { db: dbTiket } = klienTiruan(q => {
    if (q.op !== 'select') tulisan.push(q);
    if (q.tabel === 'tickets' && q.op === 'select') return { data: tiket };
    if (q.tabel === 'tickets' && q.op === 'update') return { data: [{ id: tiket.id }] };
    if (q.tabel === 'reminders' && q.op === 'select') return { data: [] };
    return { data: null, error: null };
  });
  const ctxTulis: KonteksAksi = { db: dbTiket, admin: dbTiket, u, cakupan: ['baca', 'tulis'] };

  const r4 = await jalankanAksi('tiket_aktivitas', { id: tiket.id, status: 'Solved', catatan: 'beres' }, ctxTulis);
  cek('Solved ditolak (tahap 2)', !r4.ok && /belum bisa lewat DIWAYPI/.test(String(r4.galat)) && tulisan.length === 0);
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
  cek('tercatat di audit trail via DIWAYPI', tulisan.some(q => q.tabel === 'audit_trail' && JSON.stringify(q.nilai).includes('via DIWAYPI')));

  // update yang ditolak RLS (0 baris tanpa galat) tidak boleh dilaporkan berhasil
  const { db: dbRls } = klienTiruan(q => {
    if (q.tabel === 'tickets' && q.op === 'select') return { data: tiket };
    if (q.tabel === 'tickets' && q.op === 'update') return { data: [] };
    return { data: null };
  });
  const r8 = await jalankanAksi('tiket_aktivitas', { id: tiket.id, status: 'Call' }, { db: dbRls, admin: dbRls, u, cakupan: ['baca', 'tulis'] });
  cek('0 baris (RLS) = gagal, bukan berhasil', !r8.ok && /TIDAK berubah/.test(String(r8.galat)));

  const r9 = await jalankanAksi('tiket_aktivitas', { id: tiket.id, status: 'Call' },
    { db: dbTiket, admin: dbTiket, u: { ...u, team_type: 'Team Services' }, cakupan: ['baca', 'tulis'] });
  cek('akun Team Services diarahkan ke aplikasi', !r9.ok && /Team Services/.test(String(r9.galat)));

  const r10 = await jalankanAksi('daily_report_tambah', { tanggal: '2999-01-01', deskripsi: 'x' }, ctxTulis);
  cek('daily report masa depan ditolak', !r10.ok && /belum terjadi/.test(String(r10.galat)));

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
