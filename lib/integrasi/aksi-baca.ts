import { hakAtas, muatChecklist } from '@/lib/checklist/server';
import { BARIS, adalahAtasan, bersih, gagal, hariIniWIB, idSah, tglSah, type HasilAksi, type KonteksAksi } from '@/lib/integrasi/bantu';

import { STATUS_DESAIN, statusResmi, akunChecklist } from '@/lib/integrasi/aksi-dasar';

export function profil({ u, cakupan }: KonteksAksi): HasilAksi {
  return { ok: true, nama: u.full_name ?? u.username, username: u.username, peran: u.role, jabatan: u.jabatan,
    tim: u.team_type, atasan: adalahAtasan(u), cakupan };
}

export async function ringkasan({ db, u }: KonteksAksi): Promise<HasilAksi> {
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

export async function tiketCari(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
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

export async function tiketDetail(a: Record<string, unknown>, { db }: KonteksAksi): Promise<HasilAksi> {
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

export async function jadwalCari(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
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

export async function progresProject(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
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

export async function checklistDetail(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
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

export async function dailyReport(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
  const tgl = tglSah(a.tanggal) ?? hariIniWIB();
  const { data, error } = await db.from('daily_reports')
    .select('report_date, ticket_activities, reminder_activities, manual_activities, reminder_notes')
    .eq('user_id', u.id).eq('report_date', tgl).maybeSingle();
  if (error) return gagal(error.message);
  return data ? { ok: true, tanggal: tgl, ada: true, laporan: data } : { ok: true, tanggal: tgl, ada: false };
}

export async function dailyReportTim(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
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

export async function desainCari(a: Record<string, unknown>, { db, u }: KonteksAksi): Promise<HasilAksi> {
  let q = db.from('project_requests')
    .select('id, project_name, room_name, project_location, sales_name, sales_division, requester_name, status, '
      + 'routing_status, assign_name, assigned_supervisor_id, due_date, created_at, approved_at, rejection_reason, brand')
    .order('created_at', { ascending: false }).limit(BARIS);
  const st = String(a.status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (STATUS_DESAIN.includes(st)) q = q.eq('status', st);
  else if (a.aktif) q = q.not('status', 'in', '("completed","rejected")');
  if (a.saya) q = q.eq('assign_name', u.full_name ?? '');
  const k = bersih(a.kata);
  if (k) q = q.or(`project_name.ilike.%${k}%,room_name.ilike.%${k}%,sales_name.ilike.%${k}%,project_location.ilike.%${k}%`);
  const { data, error } = await q;
  if (error) return gagal(error.message);
  let baris = (data ?? []) as unknown as { assign_name: string | null; assigned_supervisor_id: string | null }[];
  const role = (u.role ?? '').toLowerCase();
  if ((role === 'team_pts' || role === 'team') && u.jabatan !== 'Manager') {
    baris = baris.filter(r => !!r.assign_name || r.assigned_supervisor_id === u.id);
  }
  return { ok: true, jumlah: baris.length, request: baris };
}

