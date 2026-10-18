/**
 * lib/integrasi-aksi.ts - daftar aksi TETAP yang boleh dijalankan DIWAYPI lewat
 * /api/integrasi/diwaypi. Tidak ada kueri bebas: setiap aksi di bawah ditulis tangan.
 *
 * Identitas: semua baca/tulis memakai `db` = klienSebagaiUser(pemilik token), jadi RLS
 * berlaku persis seperti di layar orang itu. Checklist memakai `admin` + hakAtas(), sama
 * persis dengan /api/project-progress/checklist/[id] (route itu juga service role + cek hak).
 *
 * Tahap 1: baca semua; tiket = tambah catatan & ubah status Team PTS (bukan serah ke Services);
 * daily report = tambah aktivitas manual; checklist = centang/kendala.
 * Tahap 2: tiket Solved, buat jadwal, ubah status jadwal (termasuk Completed). Efek berantainya
 * (WA/Telegram, notifikasi in-app, form review, detail pelaksanaan, Project Progress, tutup
 * jadwal tiket) TIDAK ditulis ulang di sini: modul bersama yang sama dengan aplikasi web
 * (lib/tiket-selesai.ts, lib/jadwal-status.ts, lib/jadwal-buat.ts), dengan efek server
 * (lib/efek-server.ts) sebagai ganti fungsi peramban.
 */
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserLengkap } from '@/lib/ai-server';
import type { Cakupan } from '@/lib/token-integrasi';
import { updateSah, wajibCatatan } from '@/app/(portal)/ticketing/_components/alur-status';
import { hakAtas, muatChecklist, simpanPerubahan, type Akun } from '@/lib/checklist-server';
import type { EfekSamping } from '@/lib/efek-samping';
import { KOLOM_KABAR_TIKET, kabarkanTicketSelesai, tutupJadwalTicket, type TiketUntukKabar } from '@/lib/tiket-selesai';
import { INCENTIVE_TRIGGER_CATEGORIES, CATEGORIES, bolehUbahJadwal, galatIsianJadwal, proyekSerupa, type StatusJadwal } from '@/lib/jadwal-aturan';
import { KOLOM_BARIS_JADWAL, simpanDetailPelaksanaan, ubahStatusJadwal, type BarisJadwal, type IsianPelaksanaan } from '@/lib/jadwal-status';
import { buatJadwal, tandaiGrupInsentif, type IsianJadwal, type OrangTim } from '@/lib/jadwal-buat';
import { triggersProjectProgress } from '@/lib/project-progress-sync';
import { sinkronkanReminderKeProgress } from '@/lib/sinkron-progress-server';
import { bolehDitugaskanOleh } from '@/lib/teams';
import { hasFullAccess } from '@/lib/constants';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { idDariNama } from '@/lib/identitas';
import { appBaseUrl } from '@/lib/app-url';

export interface KonteksAksi {
  /** Klien Supabase SEBAGAI pemilik token (RLS berlaku). */
  db: SupabaseClient;
  /** Service role - hanya untuk checklist (pola route checklist) & data akun. */
  admin: SupabaseClient;
  u: UserLengkap;
  cakupan: Cakupan[];
  /** WA / in-app / audit sisi server (buatEfekServer) - pengganti fungsi peramban. */
  efek: EfekSamping;
  /**
   * Muat aturan yang di peramban dimuat saat halaman dibuka (daftar tim yang bisa
   * ditugaskan, kategori insentif). Route mengisinya; uji tidak (tanpa jaringan).
   */
  muatAturan?: () => Promise<void>;
}

export type HasilAksi = Record<string, unknown> & { ok: boolean; galat?: string };

const BARIS = 25;
const STATUS_TIKET = ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Overdue', 'Solved', 'Rejected'];
const STATUS_PTS = ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Solved'];
const KATEGORI_DR = ['Demo Product', 'Meeting & Survey', 'Konfigurasi', 'Konfigurasi & Training', 'Troubleshooting',
  'Training', 'Maintenance', 'Standby Event', 'Internal', 'Design Single Line Diagram', 'Research and Development'];

export const AKSI_BACA = ['profil', 'ringkasan', 'tiket_cari', 'tiket_detail', 'jadwal_cari', 'progres_project',
  'checklist_detail', 'daily_report', 'daily_report_tim'] as const;
export const AKSI_TULIS = ['tiket_aktivitas', 'tiket_selesai', 'jadwal_buat', 'jadwal_status', 'jadwal_selesai',
  'daily_report_tambah', 'checklist_simpan'] as const;

// ---------------------------------------------------------------- bantu
export function hariIniWIB(offset = 0): string {
  return new Date(Date.now() + 7 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10);
}
function jamWIB(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 16);
}
/** Isian bebas untuk filter PostgREST (.or / ilike): tanpa karakter sintaks. */
export function bersih(v: unknown, maks = 60): string {
  return String(v ?? '').replace(/[%*,()\\"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks);
}
/** Teks yang DISIMPAN: hanya dipangkas & dibatasi (boleh tanda baca). */
export function teks(v: unknown, maks: number): string {
  return String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maks);
}
export const tglSah = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const jamSah = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
const idSah = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{8,64}$/i.test(v) ? v : null);
const gagal = (galat: string): HasilAksi => ({ ok: false, galat });

export function adalahAtasan(u: UserLengkap): boolean {
  const r = (u.role ?? '').toLowerCase();
  const j = (u.jabatan ?? '').toLowerCase();
  return r === 'admin' || r === 'superadmin' || u.access_level === 'full' || /supervisor|manager|head|kepala/.test(j);
}

/** Status tiket dari isian bebas ("in progress", "solved") -> ejaan resmi, atau null. */
export function statusResmi(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  return STATUS_TIKET.find(x => x.toLowerCase() === s) ?? null;
}

// ---------------------------------------------------------------- pintu utama
export async function jalankanAksi(nama: string, a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const tulis = (AKSI_TULIS as readonly string[]).includes(nama);
  if (!tulis && !(AKSI_BACA as readonly string[]).includes(nama)) return gagal(`Aksi tidak dikenal: ${nama}`);
  if (tulis && !k.cakupan.includes('tulis')) {
    return gagal('Token ini hanya boleh MEMBACA. Buat token baru dengan izin ubah data di Profil > Integrasi DIWAYPI.');
  }
  switch (nama) {
    case 'profil': return profil(k);
    case 'ringkasan': return ringkasan(k);
    case 'tiket_cari': return tiketCari(a, k);
    case 'tiket_detail': return tiketDetail(a, k);
    case 'jadwal_cari': return jadwalCari(a, k);
    case 'progres_project': return progresProject(a, k);
    case 'checklist_detail': return checklistDetail(a, k);
    case 'daily_report': return dailyReport(a, k);
    case 'daily_report_tim': return dailyReportTim(a, k);
    case 'tiket_aktivitas': return tiketAktivitas(a, k);
    case 'tiket_selesai': return tiketAktivitas({ ...a, status: 'Solved' }, k);
    case 'jadwal_status': return jadwalStatus(a, k);
    case 'jadwal_selesai': return jadwalStatus({ ...a, status: 'done' }, k);
    case 'jadwal_buat': return jadwalBuat(a, k);
    case 'daily_report_tambah': return dailyReportTambah(a, k);
    case 'checklist_simpan': return checklistSimpan(a, k);
  }
  return gagal(`Aksi tidak dikenal: ${nama}`);
}

// ---------------------------------------------------------------- baca
function profil({ u, cakupan }: KonteksAksi): HasilAksi {
  return { ok: true, nama: u.full_name ?? u.username, username: u.username, peran: u.role, jabatan: u.jabatan,
    tim: u.team_type, atasan: adalahAtasan(u), cakupan };
}

async function ringkasan({ db, u }: KonteksAksi): Promise<HasilAksi> {
  const nm = u.full_name ?? '';
  const hari = hariIniWIB();
  const hitung = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then(r => r.count ?? 0);
  const [tiketAktif, jadwalHariIni, jadwalTerlambat, dr] = await Promise.all([
    hitung(db.from('tickets').select('id', { count: 'exact', head: true }).eq('assign_name', nm)
      .not('is_deleted', 'is', true).not('status', 'in', '("Solved","Rejected")')),
    hitung(db.from('reminders').select('id', { count: 'exact', head: true }).eq('assign_name', nm)
      .not('is_deleted', 'is', true).eq('due_date', hari)),
    hitung(db.from('reminders').select('id', { count: 'exact', head: true }).eq('assign_name', nm)
      .not('is_deleted', 'is', true).lt('due_date', hari).not('status', 'in', '("done","cancelled")')),
    db.from('daily_reports').select('id').eq('user_id', u.id).eq('report_date', hari).maybeSingle(),
  ]);
  return { ok: true, tanggal: hari, tiket_aktif_saya: tiketAktif, jadwal_hari_ini_saya: jadwalHariIni,
    jadwal_terlambat_saya: jadwalTerlambat, daily_report_hari_ini: !!(dr as { data: unknown }).data };
}

async function tiketCari(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
  let q = db.from('tickets')
    .select('id, project_name, issue_case, product, status, priority, assign_name, current_team, created_at, updated_at')
    .not('is_deleted', 'is', true).order('updated_at', { ascending: false }).limit(BARIS);
  if (a.saya) q = q.eq('assign_name', u.full_name ?? '');
  const st = statusResmi(a.status);
  if (st) q = q.eq('status', st);
  else if (a.aktif) q = q.not('status', 'in', '("Solved","Rejected")');
  const k = bersih(a.kata);
  if (k) q = q.or(`project_name.ilike.%${k}%,issue_case.ilike.%${k}%,product.ilike.%${k}%`);
  const { data, error } = await q;
  return error ? gagal(error.message) : { ok: true, jumlah: data?.length ?? 0, tiket: data ?? [] };
}

async function tiketDetail(a: Record<string, unknown>, { db }: KonteksAksi): Promise<HasilAksi> {
  const id = idSah(a.id);
  if (!id) return gagal('id tiket tidak sah.');
  const { data: t, error } = await db.from('tickets')
    .select('id, project_name, issue_case, description, product, sn_unit, status, services_status, priority, assign_name, '
      + 'current_team, sales_name, address, date, created_at, updated_at, is_deleted')
    .eq('id', id).maybeSingle();
  if (error) return gagal(error.message);
  if (!t || (t as { is_deleted?: boolean }).is_deleted) return gagal('Tiket tidak ditemukan atau Anda tidak punya akses.');
  const { data: log } = await db.from('activity_logs')
    .select('created_at, handler_name, action_taken, notes, new_status').eq('ticket_id', id)
    .order('created_at', { ascending: false }).limit(10);
  return { ok: true, tiket: t, aktivitas_terakhir: log ?? [] };
}

async function jadwalCari(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
  const dari = tglSah(a.dari) ?? (a.terlambat ? '2000-01-01' : hariIniWIB());
  const sampai = tglSah(a.sampai) ?? (a.terlambat ? hariIniWIB(-1) : hariIniWIB(7));
  let q = db.from('reminders')
    .select('id, project_name, category, due_date, due_time, assign_name, status, address, sales_name, product, ticket_id')
    .not('is_deleted', 'is', true).gte('due_date', dari).lte('due_date', sampai).order('due_date').limit(BARIS);
  if (a.terlambat) q = q.not('status', 'in', '("done","cancelled")');
  if (a.saya) q = q.eq('assign_name', u.full_name ?? '');
  const kat = bersih(a.kategori, 40);
  if (kat) q = q.ilike('category', `%${kat}%`);
  const k = bersih(a.kata);
  if (k) q = q.or(`project_name.ilike.%${k}%,address.ilike.%${k}%`);
  const { data, error } = await q;
  return error ? gagal(error.message) : { ok: true, rentang: `${dari} s/d ${sampai}`, jumlah: data?.length ?? 0, jadwal: data ?? [] };
}

async function progresProject(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
  const k = bersih(a.kata);
  let qp = db.from('checklist_proyek').select('id, nama, client, sales_name, status, target_date').limit(BARIS);
  if (k) qp = qp.or(`nama.ilike.%${k}%,client.ilike.%${k}%`);
  const { data: proyek, error: pErr } = await qp;
  if (pErr) return gagal(pErr.message);
  let qd = db.from('checklist_daftar').select('id, proyek_id, judul, start_date, target_date')
    .order('target_date', { ascending: true, nullsFirst: false }).limit(BARIS);
  const idProyek = ((proyek ?? []) as { id: string }[]).map(p => p.id);
  if (k) qd = qd.or(`judul.ilike.%${k}%${idProyek.length ? `,proyek_id.in.(${idProyek.join(',')})` : ''}`);
  if (a.saya) {
    const { data: ang } = await db.from('checklist_anggota').select('daftar_id').eq('user_id', u.id);
    const milik = ((ang ?? []) as { daftar_id: string }[]).map(x => x.daftar_id);
    if (!milik.length) return { ok: true, hari_ini: hariIniWIB(), lokasi: [] };
    qd = qd.in('id', milik);
  }
  const { data: daftar, error: dErr } = await qd;
  if (dErr) return gagal(dErr.message);
  const dl = (daftar ?? []) as { id: string; proyek_id: string; judul: string; start_date: string | null; target_date: string | null }[];
  const ids = dl.map(d => d.id);
  const [{ data: items }, { data: semuaProyek }] = ids.length ? await Promise.all([
    db.from('checklist_item').select('daftar_id, selesai, kendala').in('daftar_id', ids).limit(5000),
    db.from('checklist_proyek').select('id, nama, client, status').in('id', Array.from(new Set(dl.map(d => d.proyek_id)))),
  ]) : [{ data: [] }, { data: [] }];
  const it = (items ?? []) as { daftar_id: string; selesai: boolean; kendala: boolean }[];
  const pr = new Map(((semuaProyek ?? []) as { id: string; nama: string; client: string | null; status: string }[]).map(p => [p.id, p]));
  return {
    ok: true, hari_ini: hariIniWIB(),
    lokasi: dl.map(d => {
      const milik = it.filter(i => i.daftar_id === d.id);
      return { daftar_id: d.id, proyek: pr.get(d.proyek_id)?.nama, client: pr.get(d.proyek_id)?.client,
        status_proyek: pr.get(d.proyek_id)?.status, lokasi: d.judul, mulai: d.start_date, target: d.target_date,
        selesai: milik.filter(i => i.selesai).length, total: milik.length,
        kendala_terbuka: milik.filter(i => i.kendala && !i.selesai).length };
    }),
  };
}

async function akunChecklist(k: KonteksAksi): Promise<Akun> {
  const { data: pim } = await k.admin.from('users').select('pimpinan').eq('id', k.u.id).maybeSingle();
  return { id: k.u.id, nama: (k.u.full_name || k.u.username || '').trim(), role: k.u.role ?? '',
    pimpinan: (pim as { pimpinan?: boolean } | null)?.pimpinan === true };
}

async function checklistDetail(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const id = idSah(a.daftar_id);
  if (!id) return gagal('daftar_id tidak sah (ambil dari progres_project).');
  const db = k.admin as unknown as Parameters<typeof hakAtas>[0];
  const akses = await hakAtas(db, await akunChecklist(k), id);
  if (!akses) return gagal('Checklist tidak ditemukan atau Anda tidak punya akses.');
  const detail = await muatChecklist(db, id, { publik: false, hak: akses.hak });
  if (!detail) return gagal('Checklist tidak ditemukan.');
  const d = detail as unknown as { items?: { id: string; teks: string; selesai: boolean; kendala: boolean; kendala_catatan?: string | null; bagian_id?: string | null }[] };
  return { ok: true, boleh_ubah: akses.hak.edit,
    item: (d.items ?? []).map(i => ({ id: i.id, teks: i.teks, selesai: i.selesai, kendala: i.kendala, catatan_kendala: i.kendala_catatan ?? '' })) };
}

async function dailyReport(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
  const tgl = tglSah(a.tanggal) ?? hariIniWIB();
  const { data, error } = await db.from('daily_reports')
    .select('report_date, ticket_activities, reminder_activities, manual_activities, reminder_notes')
    .eq('user_id', u.id).eq('report_date', tgl).maybeSingle();
  if (error) return gagal(error.message);
  return data ? { ok: true, tanggal: tgl, ada: true, laporan: data } : { ok: true, tanggal: tgl, ada: false };
}

async function dailyReportTim(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
  if (!adalahAtasan(u)) return gagal('Data tim hanya untuk Supervisor, Manager, atau Admin.');
  const tgl = tglSah(a.tanggal) ?? hariIniWIB();
  const [{ data: tim }, { data: dr }] = await Promise.all([
    db.from('users').select('id, full_name, jabatan, team_type').ilike('team_type', 'Team PTS%').limit(100),
    db.from('daily_reports').select('user_id').eq('report_date', tgl).limit(200),
  ]);
  const sudah = new Set(((dr ?? []) as { user_id: string }[]).map(r => r.user_id));
  const daftar = (tim ?? []) as { id: string; full_name: string; jabatan: string | null }[];
  return { ok: true, tanggal: tgl,
    sudah: daftar.filter(t => sudah.has(t.id)).map(t => t.full_name),
    belum: daftar.filter(t => !sudah.has(t.id)).map(t => `${t.full_name}${t.jabatan ? ` (${t.jabatan})` : ''}`) };
}

// ---------------------------------------------------------------- tulis
interface BarisTiket extends TiketUntukKabar {
  id: string; status: string; project_name: string; issue_case: string; product: string | null; sn_unit: string | null;
  sales_name: string | null; sales_division: string | null; address: string | null; customer_phone: string | null;
  current_team: string | null; is_deleted: boolean | null;
}

/**
 * Tambah aktivitas tiket - jalur Team PTS di useTambahAktivitas.ts, langkah demi langkah:
 * aturan alur-status, catatan otomatis Call/Onsite, activity_logs, update tickets (cek baris:
 * update yang ditolak RLS mengembalikan 0 baris tanpa galat), perpanjangan Pending Action,
 * dan jadwal Onsite otomatis (dengan penjaga duplikat). Solved: sesudah tiketnya benar-benar
 * tersimpan, kabar penyelesaian + tutup jadwal tiket - lib/tiket-selesai.ts, sama dengan aplikasi.
 */
async function tiketAktivitas(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const { db, u } = k;
  const id = idSah(a.id);
  if (!id) return gagal('id tiket tidak sah (ambil dari tiket_cari).');
  if ((u.team_type ?? '') === 'Team Services') {
    return gagal('Akun Team Services memakai alur status Services - perbarui lewat aplikasi.');
  }
  const { data, error } = await db.from('tickets')
    .select(`${KOLOM_KABAR_TIKET}, status, product, sn_unit, sales_division, address, customer_phone, current_team, is_deleted`)
    .eq('id', id).maybeSingle();
  if (error) return gagal(error.message);
  const t = data as BarisTiket | null;
  if (!t || t.is_deleted) return gagal('Tiket tidak ditemukan atau Anda tidak punya akses.');
  if (t.current_team === 'Team Services') return gagal('Tiket ini sedang ditangani Team Services.');

  const baru = a.status === undefined || a.status === null || a.status === '' ? t.status : statusResmi(a.status);
  if (!baru || !STATUS_PTS.includes(baru)) return gagal(`Status tidak dikenal. Pilihan: ${STATUS_PTS.join(', ')}.`);
  if (a.ke_services) return gagal('Serah tiket ke Team Services belum bisa lewat DIWAYPI - lakukan dari aplikasi.');
  const catatanSaja = baru === t.status;
  if (!updateSah(t.status, baru)) {
    return gagal(catatanSaja ? `Tiket berstatus ${t.status} tidak bisa diberi catatan saja.`
      : `Status tidak bisa diubah dari ${t.status} ke ${baru}.`);
  }
  const catatan = teks(a.catatan, 2000);
  if (wajibCatatan(t.status, baru) && !catatan) return gagal(catatanSaja ? 'Isi catatannya dulu.' : 'Catatan wajib diisi untuk status ini.');

  const jadwalTgl = baru === 'Onsite' ? tglSah(a.jadwal_tanggal) : null;
  const jadwalJam = jadwalTgl ? (jamSah(a.jadwal_jam) ?? '08:00') : null;
  let otomatis = '';
  if (!catatanSaja && baru === 'Call') otomatis = 'Sedang melakukan Call ke customer.';
  if (!catatanSaja && baru === 'Onsite') {
    otomatis = jadwalTgl ? `Dijadwalkan Onsite pada ${jadwalTgl} pukul ${jadwalJam} WIB.` : 'Tim sedang Onsite ke lokasi customer.';
  }
  const pakaiOtomatis = !!otomatis;

  const { error: logErr } = await db.from('activity_logs').insert([{
    ticket_id: t.id,
    handler_name: u.full_name ?? u.username,
    handler_username: u.username,
    action_taken: pakaiOtomatis ? '' : teks(a.tindakan, 500),
    notes: pakaiOtomatis ? otomatis : catatan,
    new_status: baru,
    team_type: u.team_type || 'Team PTS IVP',
    assigned_to_services: false,
    file_url: '', file_name: '', photo_url: '', photo_name: '',
  }]).select();
  if (logErr) return gagal(`Gagal mencatat aktivitas: ${logErr.message}`);

  const ubah: Record<string, unknown> = { status: baru };
  const sn = teks(a.sn_unit, 80);
  if (sn) ubah.sn_unit = sn;
  const { data: terubah, error: updErr } = await db.from('tickets').update(ubah).eq('id', t.id).select('id');
  if (updErr) return gagal(`Gagal memperbarui tiket: ${updErr.message}`);
  if (!terubah || terubah.length === 0) {
    return gagal('Catatan tersimpan, tapi status tiket TIDAK berubah (ditolak sistem). Cek di aplikasi.');
  }

  //  Kabar penyelesaian baru dikirim SESUDAH ticketnya benar-benar tersimpan sebagai Solved,
  //  lalu jadwal Onsite yang lahir dari ticket ini ikut ditutup (useTambahAktivitas, jalur PTS).
  let dikabari = 0;
  let jadwalDitutup: number | null = null;
  if (baru === 'Solved') {
    dikabari = await kabarkanTicketSelesai(db, k.efek, t, catatan, { id: u.id, full_name: u.full_name });
    const tutup = await tutupJadwalTicket(db, t.id, 'done');
    jadwalDitutup = tutup.ok ? tutup.jumlah : null;
  }

  let tenggatDiperpanjang = false;
  const hari = Math.max(0, Math.min(30, parseInt(String(a.perpanjang_hari ?? '0'), 10) || 0));
  if (baru === 'Pending Action' && hari > 0) {
    try {
      const due = new Date(Date.now() + hari * 86_400_000).toISOString();
      const { data: ada } = await db.from('overdue_settings').select('id').eq('ticket_id', t.id).maybeSingle();
      const r = ada
        ? await db.from('overdue_settings').update({ due_date: due, due_hours: null, set_by: u.username }).eq('id', (ada as { id: string }).id)
        : await db.from('overdue_settings').insert([{ ticket_id: t.id, due_date: due, due_hours: null, set_by: u.username }]);
      tenggatDiperpanjang = !r.error;
    } catch { /* perpanjangan gagal tidak membatalkan update status (sama dengan aplikasi) */ }
  }

  let jadwalOnsite: 'dibuat' | 'sudah_ada' | null = null;
  if (baru === 'Onsite' && !catatanSaja) {
    try {
      const { data: terbuka } = await db.from('reminders').select('id').eq('ticket_id', t.id).neq('status', 'done').limit(1);
      if (terbuka && terbuka.length > 0) jadwalOnsite = 'sudah_ada';
      else {
        const { error: rErr } = await db.from('reminders').insert([{
          project_name: t.project_name,
          description: `[AUTO dari Ticketing] Issue: ${t.issue_case}${t.product ? ` | Product: ${t.product}` : ''}`,
          assigned_to: u.username,
          assign_name: u.full_name || u.username,
          due_date: jadwalTgl ?? hariIniWIB(),
          due_time: jadwalJam ?? jamWIB(),
          priority: 'high', status: 'pending', repeat: 'none', category: 'Troubleshooting',
          sales_name: t.sales_name || '', sales_division: t.sales_division || '', address: t.address || '',
          pic_name: t.customer_phone || '', pic_phone: '',
          product: t.product || t.sn_unit || '',
          created_by: u.username,
          ticket_id: t.id,
          notes: `Ticket ID: ${t.id} | Project: ${t.project_name} | Dibuat otomatis dari Platform Ticketing saat status Onsite dijadwalkan`,
        }]);
        if (!rErr) jadwalOnsite = 'dibuat';
      }
    } catch { /* sama dengan aplikasi: jadwal otomatis gagal tidak membatalkan update */ }
  }

  await k.efek.audit({ user_id: u.id, user_name: u.full_name ?? u.username, action: catatanSaja ? 'update' : 'status_change',
    module: 'ticket', target_id: t.id, target_name: t.project_name, old_value: t.status, new_value: baru });
  return { ok: true, tiket: t.project_name, status_lama: t.status, status_baru: baru, catatan_saja: catatanSaja,
    tenggat_diperpanjang_hari: tenggatDiperpanjang ? hari : 0, jadwal_onsite: jadwalOnsite,
    ...(baru === 'Solved' ? { dikabari, jadwal_ditutup: jadwalDitutup,
      ...(jadwalDitutup === null ? { peringatan: 'Ticket tersimpan, tapi jadwal di Reminder Schedule gagal ditutup. Mohon tutup manual.' } : {}) } : {}) };
}

/** Tambah satu aktivitas manual ke Daily Report (tanggal bawaan: hari ini WIB). */
async function dailyReportTambah(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const { db, u } = k;
  const tgl = tglSah(a.tanggal) ?? hariIniWIB();
  if (tgl > hariIniWIB()) return gagal('Daily Report tidak bisa diisi untuk tanggal yang belum terjadi.');
  const deskripsi = teks(a.deskripsi, 1000);
  if (!deskripsi) return gagal('Isi deskripsi aktivitasnya.');
  const kat = KATEGORI_DR.find(c => c.toLowerCase() === String(a.kategori ?? '').trim().toLowerCase()) ?? 'Internal';
  const item = {
    _key: crypto.randomUUID(), category: kat, project_name: teks(a.project, 150), address: teks(a.alamat, 200),
    description: deskripsi, sales_name: teks(a.sales, 80), sales_division: '', pic_name: '', pic_phone: '',
    submitted_by: u.username,
  };
  const { data: ada, error } = await db.from('daily_reports').select('id, manual_activities')
    .eq('user_id', u.id).eq('report_date', tgl).maybeSingle();
  if (error) return gagal(error.message);
  if (ada) {
    const lama = Array.isArray((ada as { manual_activities?: unknown }).manual_activities)
      ? (ada as { manual_activities: unknown[] }).manual_activities : [];
    const { data: ok, error: e } = await db.from('daily_reports')
      .update({ manual_activities: [...lama, item], updated_at: new Date().toISOString() })
      .eq('id', (ada as { id: string }).id).select('id');
    if (e) return gagal(e.message);
    if (!ok || ok.length === 0) return gagal('Daily Report tidak berubah (ditolak sistem).');
  } else {
    const { error: e } = await db.from('daily_reports').insert([{
      report_date: tgl, user_id: u.id, user_name: u.full_name ?? u.username, sales_division: u.sales_division ?? '',
      reminder_activities: [], ticket_activities: [], manual_activities: [item], reminder_notes: '', created_by: u.username,
    }]);
    if (e) return gagal(e.message);
  }
  await k.efek.audit({ user_id: u.id, user_name: u.full_name ?? u.username, action: ada ? 'update' : 'create',
    module: 'daily-report', target_name: tgl, new_value: deskripsi.slice(0, 200) });
  return { ok: true, tanggal: tgl, kategori: kat, ditambahkan: deskripsi };
}

/** Centang / kendala item checklist - sama dengan aksi 'simpan' route checklist. */
async function checklistSimpan(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const id = idSah(a.daftar_id);
  if (!id) return gagal('daftar_id tidak sah (ambil dari progres_project).');
  const masuk = Array.isArray(a.perubahan) ? a.perubahan : [a];
  const perubahan = masuk.slice(0, 50).map(p => {
    const x = p as Record<string, unknown>;
    return {
      itemId: String(x.item_id ?? x.itemId ?? ''),
      ...(typeof x.selesai === 'boolean' ? { selesai: x.selesai } : {}),
      ...(typeof x.kendala === 'boolean' ? { kendala: x.kendala } : {}),
      ...(x.catatan !== undefined ? { catatan: teks(x.catatan, 500) } : {}),
      waktu: new Date().toISOString(),
    };
  }).filter(p => idSah(p.itemId));
  if (!perubahan.length) return gagal('Tidak ada item yang valid (item_id dari checklist_detail).');
  const db = k.admin as unknown as Parameters<typeof hakAtas>[0];
  const akun = await akunChecklist(k);
  const akses = await hakAtas(db, akun, id);
  if (!akses) return gagal('Checklist tidak ditemukan.');
  if (!akses.hak.edit) return gagal('Anda tidak di-assign ke checklist ini, jadi hanya bisa melihat.');
  const hasil = await simpanPerubahan(db, id, perubahan, akun.nama, 'admin');
  if ('galat' in hasil) return gagal(hasil.galat);
  return { ok: true, diubah: perubahan.length };
}

// ---------------------------------------------------------------- jadwal (tahap 2)
/** Peran untuk aturan jadwal - sama dengan useTurunanJadwal (isAdmin, isManager, pimpinan). */
async function peranJadwal(k: KonteksAksi): Promise<{ isAdmin: boolean; isManager: boolean; pimpinan: boolean }> {
  const isAdmin = ['admin', 'superadmin'].includes((k.u.role ?? '').toLowerCase());
  const [akun, { data: mgr }] = await Promise.all([
    akunChecklist(k),
    k.db.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN.MANAGER).maybeSingle(),
  ]);
  const managerId = String((mgr as { value?: unknown } | null)?.value ?? '').replace(/^"|"$/g, '');
  return { isAdmin, isManager: hasFullAccess(k.u) || (!!managerId && k.u.id === managerId), pimpinan: !!akun.pimpinan };
}

const PETA_STATUS_JADWAL: Record<string, StatusJadwal> = {
  pending: 'pending', menunggu: 'pending',
  done: 'done', selesai: 'done', completed: 'done', complete: 'done',
  cancelled: 'cancelled', canceled: 'cancelled', batal: 'cancelled', dibatalkan: 'cancelled',
};

const PETUNJUK_PELAKSANAAN = 'Kategori ini wajib detail pelaksanaan: mode (onsite/remote), tipe_display (led/lcd/mix), '
  + 'bast_tanggal (bawaan hari ini), middleware/controller (true/false), controller_merek (cue/extron/wyrestorm), '
  + 'dan untuk remote: installer_nama + installer_daerah.';

function pilih<T extends string>(v: unknown, boleh: readonly T[]): T | null {
  const s = String(v ?? '').trim().toLowerCase();
  return (boleh as readonly string[]).includes(s) ? s as T : null;
}

/** Isian panel Mode Penyelesaian dari argumen DIWAYPI (bawaan = bawaan panel di aplikasi). */
function isianPelaksanaan(a: Record<string, unknown>): IsianPelaksanaan {
  return {
    mode: pilih(a.mode, ['onsite', 'remote'] as const),
    installerName: teks(a.installer_nama, 100),
    installerUserId: null,
    installerDaerah: teks(a.installer_daerah, 100),
    bastDate: tglSah(a.bast_tanggal) ?? hariIniWIB(),
    displayType: pilih(a.tipe_display, ['led', 'lcd', 'mix'] as const),
    requiresMiddleware: a.middleware === true,
    requiresControllerAuto: a.controller === true,
    controllerBrand: pilih(a.controller_merek, ['cue', 'extron', 'wyrestorm'] as const),
  };
}

/**
 * Ubah status jadwal (pending / done / cancelled) - tombol Update Status di detail jadwal:
 * hanya pelaku jadwalnya (bolehUbahJadwal) dan jadwal yang punya pelaksana; Completed tidak
 * bisa diubah kembali. Completed untuk kategori insentif wajib detail pelaksanaan dulu
 * (handleModeConfirm), lalu status + WA handler + form review otomatis (handleStatusChange).
 * Foto penyelesaian (opsional di aplikasi) tidak didukung lewat DIWAYPI.
 */
async function jadwalStatus(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const { db, u } = k;
  const id = idSah(a.id);
  if (!id) return gagal('id jadwal tidak sah (ambil dari jadwal_cari).');
  const status = PETA_STATUS_JADWAL[String(a.status ?? '').trim().toLowerCase()];
  if (!status) return gagal('Status jadwal tidak dikenal. Pilihan: pending, done (selesai), cancelled (batal).');
  const { data, error } = await db.from('reminders').select(KOLOM_BARIS_JADWAL).eq('id', id).maybeSingle();
  if (error) return gagal(error.message);
  const r = data as (BarisJadwal & { is_deleted?: boolean | null }) | null;
  if (!r || r.is_deleted) return gagal('Jadwal tidak ditemukan atau Anda tidak punya akses.');
  if (!r.assigned_to) return gagal('Jadwal ini belum punya pelaksana - statusnya belum bisa diubah.');
  if (!bolehUbahJadwal(u, r, await peranJadwal(k))) {
    return gagal('Hanya pelaksana, Sales, pembuat jadwal, admin, atau Manager yang bisa mengubah status jadwal ini.');
  }
  if (r.status === 'done') return gagal('Jadwal sudah Completed - status completed tidak dapat diubah kembali.');
  if (r.status === status) return gagal(`Jadwal sudah berstatus ${status}.`);

  let detail: Record<string, unknown> | null = null;
  if (status === 'done' && (INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(r.category)) {
    const simpan = await simpanDetailPelaksanaan(db, r, isianPelaksanaan(a));
    if (!simpan.ok) return gagal(`${simpan.galat} ${PETUNJUK_PELAKSANAAN}`);
    detail = simpan.isi;
  }
  //  Jumlah tanggal sebatch yang tampak di daftar (baris terhapus tidak ikut dihitung).
  let jumlahSebatch: number | undefined;
  if (r.batch_id) {
    const { data: sb } = await db.from('reminders').select('id').eq('batch_id', r.batch_id).not('is_deleted', 'is', true);
    jumlahSebatch = (sb ?? []).length;
  }
  const h = await ubahStatusJadwal(db, k.efek, {
    id, status, sebelum: r, pelaku: { id: u.id, full_name: u.full_name }, jumlahSebatch,
  });
  if (!h.ok) return gagal(h.galat);
  return {
    ok: true, jadwal: r.project_name, kategori: r.category, status_lama: r.status, status_baru: status,
    jumlah_tanggal: h.jumlahTanggal, form_review_untuk: h.formReviewUntuk,
    ...(detail ? { detail_pelaksanaan: detail } : {}),
    ...(h.galatKabarHandler ? { peringatan: 'WA ke handler gagal dikirim. Status berhasil disimpan.' } : {}),
  };
}

interface OrangPengguna extends OrangTim {
  role?: string | null; team_type?: string | null; sales_division?: string | null;
  jabatan?: string | null; bisa_ditugaskan?: boolean | null;
}

/**
 * Buat jadwal baru untuk SATU pelaksana (bawaan: diri sendiri), satu atau beberapa tanggal -
 * tombol + di Reminder Schedule (admin & akun Team). Assign massal dan alih ke Supervisor
 * tetap lewat aplikasi. Bila proyek kategori insentif bernama sama sudah ada, aplikasi
 * BERTANYA "kelanjutan atau terpisah?" - di sini jawabannya wajib lewat `lanjutan`.
 */
async function jadwalBuat(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const { db, u } = k;
  const isAdmin = ['admin', 'superadmin'].includes((u.role ?? '').toLowerCase());
  if (!isAdmin && u.role !== 'team') return gagal('Hanya admin dan akun Team yang bisa membuat jadwal (sama dengan aplikasi).');
  try { await k.muatAturan?.(); } catch { /* pakai bawaan, sama dengan peramban yang gagal memuat */ }

  const mentah = Array.isArray(a.tanggal) ? a.tanggal : [a.tanggal];
  const tanggal = Array.from(new Set(mentah.map(tglSah).filter((d): d is string => !!d))).sort().slice(0, 31);
  if (!tanggal.length) return gagal('tanggal wajib (YYYY-MM-DD, atau daftar tanggal untuk jadwal beberapa hari).');
  const kategori = CATEGORIES.find(c => c.toLowerCase() === String(a.kategori ?? '').trim().toLowerCase());
  if (!kategori) return gagal(`kategori wajib. Pilihan: ${CATEGORIES.join(', ')}.`);
  const jam = a.jam === undefined || a.jam === null || a.jam === '' ? '09:00' : jamSah(a.jam);
  if (!jam) return gagal('jam harus HH:MM (24 jam).');
  const prioritas = pilih(a.prioritas, ['low', 'medium', 'high', 'urgent'] as const) ?? 'medium';

  //  Daftar orang sama dengan useMuatPengguna: tim yang bisa ditugaskan (tanpa admin) + guest.
  const [{ data: semua, error: e1 }, { data: tamu, error: e2 }] = await Promise.all([
    db.from('users').select('id, username, full_name, role, team_type, phone_number, sales_division, jabatan, bisa_ditugaskan').order('full_name'),
    db.from('users').select('id, username, full_name, role, phone_number, sales_division').eq('role', 'guest').order('full_name'),
  ]);
  if (e1 || e2) return gagal((e1 ?? e2)!.message);
  const tim = ((semua ?? []) as OrangPengguna[])
    .filter(x => bolehDitugaskanOleh(x, true) && x.role !== 'admin' && x.role !== 'superadmin');
  const ditawarkan = tim.filter(x => bolehDitugaskanOleh(x, isAdmin));
  const sama = (x: string | null | undefined, y: string) => (x ?? '').trim().toLowerCase() === y.trim().toLowerCase();

  const cariHandler = teks(a.handler, 80) || u.username;
  const pelaksana = ditawarkan.find(x => sama(x.username, cariHandler)) ?? ditawarkan.find(x => sama(x.full_name, cariHandler));
  if (!pelaksana) {
    return gagal(`Pelaksana "${cariHandler}" tidak ada di daftar anggota tim yang bisa ditugaskan.`
      + (ditawarkan.length ? ` Contoh: ${ditawarkan.slice(0, 8).map(x => x.full_name).join(', ')}.` : ''));
  }
  const orangSales = [...((tamu ?? []) as OrangPengguna[]), ...tim];
  const namaSales = teks(a.sales, 120);
  const sales = namaSales ? orangSales.find(x => sama(x.full_name, namaSales)) : undefined;
  if (namaSales && !sales) return gagal(`Sales "${namaSales}" tidak ditemukan (pakai nama lengkap akun guest/Sales).`);

  const isian: IsianJadwal = {
    project_name: teks(a.project, 150), description: teks(a.deskripsi, 1000),
    assigned_to: pelaksana.username, assign_name: '', sales_user_id: null, assign_user_id: null,
    due_date: tanggal[0], due_time: jam, priority: prioritas, status: 'pending', repeat: 'none', category: kategori,
    sales_name: sales?.full_name ?? '', sales_division: sales?.sales_division ?? '', address: teks(a.alamat, 300),
    pic_name: teks(a.pic_nama, 100), pic_phone: teks(a.pic_telepon, 40),
    progress_start_date: '', progress_target_date: '',
    notes: teks(a.catatan, 1000), product: teks(a.produk, 150), warranty_years: null,
    requires_controller_automation: false, controller_automation_brand: null,
    pic_type: 'standard', pic_id: null, incentive_value: 0, bast_date: null, product_type: '',
  };
  const salah = galatIsianJadwal(isian, true);
  if (salah) return gagal(`${salah} (argumen: project, tanggal, alamat, sales, kategori)`);

  //  "Kelanjutan proyek yang sudah ada?" - aplikasi bertanya; DIWAYPI wajib menjawab.
  let grupInsentif: string | null | undefined;
  let peringatan: string | undefined;
  const kata = bersih(isian.project_name, 150);
  const { data: mirip } = kata
    ? await db.from('reminders').select('id, project_name, category, status, due_date, assign_name, incentive_group_id')
      .ilike('project_name', `%${kata}%`).not('is_deleted', 'is', true).limit(200)
    : { data: [] };
  const serupa = proyekSerupa((mirip ?? []) as { id: string; project_name: string; category: string; status: string;
    due_date: string; assign_name: string; incentive_group_id: string | null }[], isian.project_name, kategori);
  if (serupa.length > 0) {
    if (typeof a.lanjutan !== 'boolean') {
      return { ok: false, perlu_jawaban: true,
        galat: `Proyek "${isian.project_name}" sudah punya ${serupa.length} jadwal ${serupa.map(x => x.category).join('/')}. `
          + 'Tanyakan ke pengguna: jadwal baru ini KELANJUTAN proyek itu (satu proyek insentif) atau proyek TERPISAH? '
          + 'Ulangi jadwal_buat dengan lanjutan: true atau false.',
        jadwal_sebelumnya: serupa.slice(0, 10).map(x => ({ id: x.id, kategori: x.category, tanggal: x.due_date, pelaksana: x.assign_name, status: x.status })) };
    }
    if (a.lanjutan) {
      const g = await tandaiGrupInsentif(db, serupa);
      grupInsentif = g.grup;
      if (g.sebagianGagal) peringatan = 'Sebagian jadwal lama gagal ditandai satu proyek yang sama - periksa manual di Incentive PTS.';
    } else grupInsentif = null;
  }

  let progres = { created: 0, errors: [] as string[] };
  const h = await buatJadwal(db, k.efek, {
    isian, tanggal, grupInsentif,
    timeline: triggersProjectProgress(kategori)
      ? { progress_start_date: tglSah(a.progress_mulai), progress_target_date: tglSah(a.progress_target) }
      : { progress_start_date: null, progress_target_date: null },
    pelaksana, alihKeSupervisor: null, supervisor: null,
    salesUserId: idDariNama(orangSales, isian.sales_name),
    pelaku: { id: u.id, username: u.username, full_name: u.full_name },
    //  Sama dengan syncRemindersToProjectProgress -> /api/project-progress/sinkron, tanpa sesi cookie.
    sinkronProgress: async rows => {
      const ids = rows.filter(r => r.id && triggersProjectProgress(r.category)).map(r => r.id);
      if (!ids.length) return;
      try {
        const db2 = k.admin as unknown as Parameters<typeof sinkronkanReminderKeProgress>[0];
        progres = await sinkronkanReminderKeProgress(db2, await akunChecklist(k), ids, appBaseUrl());
      } catch (e) {
        progres = { created: 0, errors: [e instanceof Error ? e.message : String(e)] };
      }
      if (progres.errors.length) console.warn('[project-progress-sync]', progres.errors);
    },
  });
  if (!h.ok) return gagal(h.galat);
  return { ok: true, dibuat: h.baris.length, id: h.baris.map(b => b.id), project: isian.project_name, kategori, tanggal,
    jam, pelaksana: pelaksana.full_name, sales: isian.sales_name, wa_pelaksana: h.waPelaksana?.ok ?? false,
    kelanjutan_proyek: grupInsentif ? true : grupInsentif === null ? false : undefined,
    checklist_progress_dibuat: progres.created, ...(peringatan ? { peringatan } : {}) };
}
