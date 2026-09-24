/**
 * uji/kpi-lc-tahunan.ts - rekapLCTahunan() & hitungSkorKPI().
 *
 * Aturan (keputusan pemilik platform 2026-09-24):
 *   KPI akhir = KPI dasar × (sesi LC lulus ÷ sesi LC wajib di tahun itu);
 *   sesi bertarget yang tidak dikerjakan sampai selesai = tidak lulus.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
 *   NEXT_PUBLIC_SUPABASE_SERVICES_URL=https://y.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY=dummy \
 *   npx tsx uji/kpi-lc-tahunan.ts
 */
import { rekapLCTahunan, type SesiLC, type AttemptLC } from '../lib/kpi-lc-tahunan';
import { hitungSkorKPI, DEFAULT_KPI_SETTINGS, type KPIMember } from '../app/kpi-team/_components/shared';

let lulus = 0, gagal = 0;
function ok(nama: string, syarat: boolean, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}
function sama(nama: string, dapat: unknown, harap: unknown) {
  ok(nama, JSON.stringify(dapat) === JSON.stringify(harap), `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
}

const SEKARANG = new Date('2026-09-24T00:00:00Z');
function sesi(id: string, o: Partial<SesiLC> = {}): SesiLC {
  return { id, open_at: '2026-05-01T00:00:00Z', scheduled_at: null, created_at: '2026-04-30T00:00:00Z',
    close_at: '2026-05-02T00:00:00Z', closed_at: null, is_active: false, target_user_ids: null, ...o };
}
const att = (user_id: string, quiz_session_id: string, passed: boolean | null, grading_status: string | null = 'graded'): AttemptLC =>
  ({ user_id, quiz_session_id, passed, grading_status });

console.log('rekapLCTahunan');
{
  const r = rekapLCTahunan('u1', 2026, [], [], SEKARANG);
  sama('tanpa sesi -> faktor 1, tanpa potongan', r, { wajib: 0, lulus: 0, gagal: 0, tidakIkut: 0, faktor: 1 });
}
{
  const S = [sesi('a'), sesi('b'), sesi('c'), sesi('d')];
  const A = [att('u1', 'a', true), att('u1', 'b', true), att('u1', 'c', true), att('u1', 'd', false)];
  const r = rekapLCTahunan('u1', 2026, S, A, SEKARANG);
  sama('3 dari 4 lulus -> faktor 0.75', [r.wajib, r.lulus, r.gagal, r.faktor], [4, 3, 1, 0.75]);
}
{
  const A = [att('u1', 'a', false), att('u1', 'a', true)];
  const r = rekapLCTahunan('u1', 2026, [sesi('a')], A, SEKARANG);
  sama('retake yang akhirnya lulus = sesi lulus', [r.wajib, r.lulus, r.faktor], [1, 1, 1]);
}
{
  const S = [sesi('a', { target_user_ids: ['u1', 'u2'] })];
  const r = rekapLCTahunan('u1', 2026, S, [att('u2', 'a', true)], SEKARANG);
  sama('ditargetkan, sesi selesai, tidak dikerjakan -> tidak lulus', [r.wajib, r.tidakIkut, r.faktor], [1, 1, 0]);
}
{
  const S = [sesi('a', { target_user_ids: ['u1'], close_at: '2026-12-01T00:00:00Z', is_active: true })];
  const r = rekapLCTahunan('u1', 2026, S, [], SEKARANG);
  sama('ditargetkan tapi sesi masih buka -> belum dihitung', r.wajib, 0);
}
{
  const S = [sesi('a', { target_user_ids: ['u1'], close_at: null, open_at: null, is_active: false })];
  const r = rekapLCTahunan('u1', 2026, S, [], SEKARANG);
  sama('draf nonaktif yang belum pernah dijalankan -> tidak menghukum', r.wajib, 0);
}
{
  const r = rekapLCTahunan('u1', 2026, [sesi('a')], [att('u1', 'a', null, 'pending_review')], SEKARANG);
  sama('essay belum dinilai -> dikecualikan', r.wajib, 0);
}
{
  const S = [sesi('lama', { open_at: '2025-11-01T00:00:00Z' }), sesi('baru')];
  const A = [att('u1', 'lama', false), att('u1', 'baru', true)];
  const r = rekapLCTahunan('u1', 2026, S, A, SEKARANG);
  sama('gagal di tahun lain tidak ikut dihitung', [r.wajib, r.faktor], [1, 1]);
}

{
  const S = [sesi('a', { allow_retake: true, is_active: true, close_at: '2026-12-01T00:00:00Z' })];
  const r = rekapLCTahunan('u1', 2026, S, [att('u1', 'a', false)], SEKARANG);
  sama('gagal di sesi yang masih buka & boleh retake -> belum final', r.wajib, 0);
}
{
  const S = [sesi('a', { allow_retake: true })];
  const r = rekapLCTahunan('u1', 2026, S, [att('u1', 'a', false)], SEKARANG);
  sama('gagal & sesi sudah ditutup (walau boleh retake) -> gagal', [r.wajib, r.gagal], [1, 1]);
}
{
  const S = [sesi('a', { target_user_ids: null })];
  const r = rekapLCTahunan('u1', 2026, S, [att('u2', 'a', true)], SEKARANG);
  sama('sesi target "semua" yang tidak diikuti -> tidak menghukum', r.wajib, 0);
}

console.log('hitungSkorKPI');
function anggota(o: Partial<KPIMember> = {}): KPIMember {
  return { id: 'u1', name: 'A', team_type: 'T', jabatan: '', ticketsHandled: 10, ticketsSolved: 10, ticketsOverdue: 0,
    avgResolutionDays: 0, remindersAssigned: 0, remindersDone: 0, lcAttempts: 2, lcAvgScore: 90, lcPassed: 2,
    lcScores: [90, 90], piketFilled: 0, ticketAvgResponseHours: 0, formReviewTotal: 1, formReviewLowRating: 0,
    techNotesApproved: 2, monthlyTickets: [], ...o };
}
{
  const r = hitungSkorKPI(anggota(), DEFAULT_KPI_SETTINGS);
  sama('tanpa rekap LC -> sama dengan rumus lama (100)', [r.kpiDasar, r.finalKPI, r.potonganLC], [100, 100, 0]);
}
{
  const r = hitungSkorKPI(anggota({ lcTahunan: { wajib: 4, lulus: 3, gagal: 1, tidakIkut: 0, faktor: 0.75 } }), DEFAULT_KPI_SETTINGS);
  sama('lulus 3/4 -> 100 × 75% = 75, potongan 25', [r.kpiDasar, r.finalKPI, r.potonganLC], [100, 75, 25]);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
