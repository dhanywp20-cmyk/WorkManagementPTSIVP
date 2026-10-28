/**
 * lib/integrasi-analisa.ts - aksi `analisa` DIWAYPI: satu potret kerja lintas menu (Ticketing,
 * Reminder Schedule, Request Design Project, Project Progress, Daily Report) untuk satu periode,
 * plus daftar `temuan` yang disusun DETERMINISTIK dari angka itu - bukan tebakan model.
 *
 * Semua baca memakai `db` (RLS pemilik token), jadi cakupannya persis yang ia lihat di layar.
 * Setiap kueri dibatasi barisnya; angka yang terpotong ditandai `+` di `terpotong`.
 */
import { BARIS, adalahAtasan, gagal, hariIniWIB, type HasilAksi, type KonteksAksi } from '@/lib/integrasi-bantu';
import { terlihatTeamPTS } from '@/lib/integrasi-menu';

type Baris = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const MAKS = 1000;
const HARI_MS = 86_400_000;
const tglMs = (s: string) => Date.parse(/T/.test(s) ? s : `${s}T00:00:00+07:00`);
const umurHari = (dari: string, ke = Date.now()) => Math.max(0, Math.floor((ke - tglMs(dari)) / HARI_MS));

/** Periode: minggu | bulan (bawaan) | kuartal | tahun, atau dari/sampai (YYYY-MM-DD). */
export function periodeAnalisa(a: Record<string, unknown>, hari = hariIniWIB()): { dari: string; sampai: string; label: string } {
  const sah = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const d = sah(a.dari), s = sah(a.sampai);
  if (d && s) return { dari: d <= s ? d : s, sampai: d <= s ? s : d, label: `${d} s/d ${s}` };
  const p = str(a.periode).toLowerCase();
  const [y, m] = [Number(hari.slice(0, 4)), Number(hari.slice(5, 7))];
  const pad = (n: number) => String(n).padStart(2, '0');
  const akhirBulan = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (p === 'minggu') {
    const t = new Date(`${hari}T00:00:00Z`);
    const geser = t.getUTCDay() === 0 ? -6 : 1 - t.getUTCDay();
    const senin = new Date(t.getTime() + geser * HARI_MS).toISOString().slice(0, 10);
    return { dari: senin, sampai: new Date(Date.parse(`${senin}T00:00:00Z`) + 6 * HARI_MS).toISOString().slice(0, 10), label: 'minggu ini' };
  }
  if (p === 'kuartal') {
    const q0 = Math.floor((m - 1) / 3) * 3 + 1;
    return { dari: `${y}-${pad(q0)}-01`, sampai: `${y}-${pad(q0 + 2)}-${pad(akhirBulan(y, q0 + 2))}`, label: `kuartal ${Math.ceil(m / 3)} ${y}` };
  }
  if (p === 'tahun') return { dari: `${y}-01-01`, sampai: `${y}-12-31`, label: `tahun ${y}` };
  return { dari: `${y}-${pad(m)}-01`, sampai: `${y}-${pad(m)}-${pad(akhirBulan(y, m))}`, label: 'bulan ini' };
}

function hitungPer(baris: Baris[], kolom: string): Record<string, number> {
  const h: Record<string, number> = {};
  for (const b of baris) { const k = str(b[kolom]) || '(kosong)'; h[k] = (h[k] ?? 0) + 1; }
  return h;
}
const teratas = (h: Record<string, number>, n = 5) => Object.entries(h).sort((x, y) => y[1] - x[1]).slice(0, n)
  .map(([nama, jumlah]) => ({ nama, jumlah }));

export async function analisa(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const { db, u } = k;
  const hari = hariIniWIB();
  const per = periodeAnalisa(a, hari);
  const bagian = str(a.bagian).toLowerCase() || 'semua';
  const mau = (b: string) => bagian === 'semua' || bagian === b;
  const awalTs = `${per.dari}T00:00:00+07:00`, akhirTs = `${per.sampai}T23:59:59+07:00`;
  const terpotong: string[] = [];
  const cek = (nama: string, data: unknown[] | null | undefined) => { if ((data?.length ?? 0) >= MAKS) terpotong.push(nama); return (data ?? []) as Baris[]; };
  const temuan: string[] = [];
  const hasil: HasilAksi = { ok: true, periode: per, hari_ini: hari };

  // ---------------------------------------------------------------- Ticketing
  if (mau('tiket')) {
    const kolom = 'id, project_name, issue_case, product, status, assign_name, created_at, updated_at';
    const [aktif, masuk, solved] = await Promise.all([
      db.from('tickets').select(kolom).not('is_deleted', 'is', true).not('status', 'in', '("Solved","Rejected")').limit(MAKS),
      db.from('tickets').select('id, status').not('is_deleted', 'is', true).gte('created_at', awalTs).lte('created_at', akhirTs).limit(MAKS),
      db.from('tickets').select('id, created_at, updated_at').not('is_deleted', 'is', true).eq('status', 'Solved')
        .gte('updated_at', awalTs).lte('updated_at', akhirTs).limit(MAKS),
    ]);
    if (aktif.error) return gagal(aktif.error.message);
    const ak = cek('tiket aktif', aktif.data), ms = cek('tiket masuk', masuk.data), sv = cek('tiket solved', solved.data);
    const batas = Date.now() - 3 * HARI_MS;
    const macet = ak.filter(t => tglMs(str(t.updated_at || t.created_at)) < batas);
    const tertua = [...ak].sort((x, y) => str(x.created_at).localeCompare(str(y.created_at)))[0];
    const durasi = sv.map(t => (tglMs(str(t.updated_at)) - tglMs(str(t.created_at))) / HARI_MS).filter(x => x >= 0);
    const beban = teratas(hitungPer(ak.filter(t => str(t.assign_name)), 'assign_name'));
    hasil.tiket = {
      aktif: ak.length, per_status_aktif: hitungPer(ak, 'status'), macet_3_hari: macet.length,
      overdue: ak.filter(t => t.status === 'Overdue').length,
      belum_ada_handler: ak.filter(t => !str(t.assign_name).trim()).length,
      masuk_periode: ms.length, solved_periode: sv.length,
      rata_hari_selesai: durasi.length ? Math.round((durasi.reduce((s, x) => s + x, 0) / durasi.length) * 10) / 10 : null,
      tertua: tertua ? { project: tertua.project_name, issue: tertua.issue_case, status: tertua.status, umur_hari: umurHari(str(tertua.created_at)) } : null,
      beban_handler: beban, produk_terbanyak: teratas(hitungPer(ak.filter(t => str(t.product)), 'product')),
      contoh_macet: macet.slice(0, 5).map(t => ({ id: t.id, project: t.project_name, status: t.status, handler: t.assign_name || null,
        tanpa_update_hari: umurHari(str(t.updated_at || t.created_at)) })),
    };
    if (macet.length) temuan.push(`${macet.length} tiket aktif tanpa update lebih dari 3 hari.`);
    if (ak.some(t => t.status === 'Overdue')) temuan.push(`${ak.filter(t => t.status === 'Overdue').length} tiket berstatus Overdue.`);
    if (beban[0] && beban[0].jumlah >= 5) temuan.push(`Beban tiket aktif terbanyak: ${beban[0].nama} (${beban[0].jumlah}).`);
    if (tertua && umurHari(str(tertua.created_at)) >= 14) temuan.push(`Tiket aktif tertua ${umurHari(str(tertua.created_at))} hari: ${tertua.project_name}.`);
  }

  // ---------------------------------------------------------------- Reminder Schedule
  if (mau('jadwal')) {
    const kolom = 'id, project_name, category, due_date, status, assign_name';
    const [periodeQ, telatQ] = await Promise.all([
      db.from('reminders').select(kolom).not('is_deleted', 'is', true).gte('due_date', per.dari).lte('due_date', per.sampai).limit(MAKS),
      db.from('reminders').select(kolom).not('is_deleted', 'is', true).lt('due_date', hari)
        .not('status', 'in', '("done","cancelled")').order('due_date').limit(MAKS),
    ]);
    if (periodeQ.error) return gagal(periodeQ.error.message);
    const jp = cek('jadwal periode', periodeQ.data), tl = cek('jadwal terlambat', telatQ.data);
    const jatuhTempo = jp.filter(j => str(j.due_date) <= hari && j.status !== 'cancelled');
    const selesai = jatuhTempo.filter(j => j.status === 'done').length;
    hasil.jadwal = {
      periode_total: jp.length, per_kategori: hitungPer(jp, 'category'), per_status: hitungPer(jp, 'status'),
      sudah_jatuh_tempo: jatuhTempo.length, selesai_dari_jatuh_tempo: selesai,
      persen_selesai: jatuhTempo.length ? Math.round((selesai / jatuhTempo.length) * 100) : null,
      terlambat_belum_selesai: tl.length, terlambat_per_handler: teratas(hitungPer(tl, 'assign_name')),
      terlambat_tertua: tl.slice(0, 5).map(j => ({ id: j.id, project: j.project_name, kategori: j.category, tanggal: j.due_date,
        handler: j.assign_name || null, telat_hari: umurHari(str(j.due_date)) })),
    };
    if (tl.length) temuan.unshift(`${tl.length} jadwal terlambat belum selesai, paling lama ${tl[0].project_name} (${tl[0].category}) tanggal ${tl[0].due_date}.`);
    if (jatuhTempo.length >= 5 && selesai / jatuhTempo.length < 0.8) {
      temuan.push(`Jadwal ${per.label}: baru ${selesai} dari ${jatuhTempo.length} yang sudah jatuh tempo ditandai selesai (${Math.round((selesai / jatuhTempo.length) * 100)}%).`);
    }
  }

  // ---------------------------------------------------------------- Request Design Project
  if (mau('desain')) {
    const { data, error } = await db.from('project_requests')
      .select('id, project_name, status, assign_name, assigned_supervisor_id, routing_status, due_date, created_at, sales_name')
      .not('status', 'in', '("completed","rejected")').order('created_at').limit(MAKS);
    if (error) return gagal(error.message);
    const rq = cek('request desain', data).filter(r => terlihatTeamPTS(r as { assign_name?: string | null; assigned_supervisor_id?: string | null }, u));
    const pending = rq.filter(r => r.status === 'pending');
    const lewat = rq.filter(r => str(r.due_date) && str(r.due_date) < hari);
    const tanpa = rq.filter(r => r.status !== 'pending' && !str(r.assign_name).trim());
    const tertua = pending[0];
    hasil.desain = {
      aktif: rq.length, per_status: hitungPer(rq, 'status'), pending: pending.length,
      pending_tertua: tertua ? { id: tertua.id, project: tertua.project_name, sales: tertua.sales_name, umur_hari: umurHari(str(tertua.created_at)) } : null,
      approved_tanpa_handler: tanpa.length, lewat_target: lewat.length,
      contoh_lewat_target: lewat.slice(0, 5).map(r => ({ id: r.id, project: r.project_name, status: r.status, target: r.due_date, handler: r.assign_name || null })),
    };
    if (tertua && umurHari(str(tertua.created_at)) >= 3) temuan.push(`Request Design pending paling lama ${umurHari(str(tertua.created_at))} hari: ${tertua.project_name}.`);
    if (lewat.length) temuan.push(`${lewat.length} Request Design melewati target selesai.`);
    if (tanpa.length) temuan.push(`${tanpa.length} Request Design sudah diapprove tapi belum ada handler.`);
  }

  // ---------------------------------------------------------------- Project Progress
  if (mau('progres')) {
    const { data: daftar, error } = await db.from('checklist_daftar').select('id, proyek_id, judul, target_date').limit(200);
    if (error) return gagal(error.message);
    const dl = (daftar ?? []) as { id: string; proyek_id: string; judul: string; target_date: string | null }[];
    const ids = dl.map(d => d.id);
    const [{ data: items }, { data: proyek }] = ids.length ? await Promise.all([
      db.from('checklist_item').select('daftar_id, selesai, kendala').in('daftar_id', ids).limit(5000),
      db.from('checklist_proyek').select('id, nama, status').in('id', Array.from(new Set(dl.map(d => d.proyek_id)))),
    ]) : [{ data: [] }, { data: [] }];
    const it = (items ?? []) as { daftar_id: string; selesai: boolean; kendala: boolean }[];
    const pr = new Map(((proyek ?? []) as { id: string; nama: string; status: string }[]).map(p => [p.id, p]));
    const lokasi = dl.map(d => {
      const m = it.filter(i => i.daftar_id === d.id);
      const pct = m.length ? Math.round((m.filter(i => i.selesai).length / m.length) * 100) : 0;
      return { daftar_id: d.id, proyek: pr.get(d.proyek_id)?.nama ?? null, lokasi: d.judul, target: d.target_date, persen: pct,
        kendala_terbuka: m.filter(i => i.kendala && !i.selesai).length, total_item: m.length };
    }).filter(l => l.total_item > 0 && pr.get(dl.find(d => d.id === l.daftar_id)!.proyek_id)?.status !== 'done');
    const telat = lokasi.filter(l => l.target && l.target < hari && l.persen < 100).sort((x, y) => str(x.target).localeCompare(str(y.target)));
    const kendala = lokasi.filter(l => l.kendala_terbuka > 0).sort((x, y) => y.kendala_terbuka - x.kendala_terbuka);
    hasil.progres = {
      lokasi_aktif: lokasi.length,
      rata_persen: lokasi.length ? Math.round(lokasi.reduce((s, l) => s + l.persen, 0) / lokasi.length) : null,
      lewat_target_belum_100: telat.length, dengan_kendala: kendala.length,
      lewat_target: telat.slice(0, 5), kendala_terbanyak: kendala.slice(0, 5),
    };
    if (telat.length) temuan.push(`${telat.length} lokasi checklist melewati target tapi belum 100%, mis. ${telat[0].proyek ?? '-'} · ${telat[0].lokasi} (${telat[0].persen}%).`);
    if (kendala.length) temuan.push(`${kendala.reduce((s, l) => s + l.kendala_terbuka, 0)} kendala checklist masih terbuka di ${kendala.length} lokasi.`);
  }

  // ---------------------------------------------------------------- Daily Report (atasan)
  if (mau('daily_report') && adalahAtasan(u)) {
    const [{ data: tim }, { data: dr }] = await Promise.all([
      db.from('users').select('id, full_name, team_type').ilike('team_type', 'Team PTS%').limit(100),
      db.from('daily_reports').select('user_id').eq('report_date', hari).limit(200),
    ]);
    const sudah = new Set(((dr ?? []) as { user_id: string }[]).map(r => r.user_id));
    const daftar = (tim ?? []) as { id: string; full_name: string }[];
    const belum = daftar.filter(t => !sudah.has(t.id)).map(t => t.full_name);
    hasil.daily_report = { tanggal: hari, anggota: daftar.length, sudah: daftar.length - belum.length, belum };
    if (belum.length) temuan.push(`Daily Report hari ini belum diisi ${belum.length} orang: ${belum.slice(0, 5).join(', ')}${belum.length > 5 ? ', …' : ''}.`);
  }

  if (!temuan.length) temuan.push('Tidak ada yang menonjol: tidak ada keterlambatan atau penumpukan di data yang terbaca.');
  hasil.temuan = temuan.slice(0, BARIS);
  if (terpotong.length) hasil.terpotong = terpotong;
  return hasil;
}
