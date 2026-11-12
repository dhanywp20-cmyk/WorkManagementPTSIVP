import crypto from 'crypto';
import { updateSah, wajibCatatan } from '@/lib/alur-status-ticket';
import { hakAtas } from '@/lib/checklist/server';
import { simpanPerubahan } from '@/lib/checklist/server-simpan';
import { KOLOM_KABAR_TIKET, kabarkanTicketSelesai, tutupJadwalTicket, type TiketUntukKabar } from '@/lib/tiket-selesai';
import { hasFullAccess } from '@/lib/constants';
import { adalahAtasan, bersih, gagal, hariIniWIB, idSah, jamSah, jamWIB, teks, tglSah, type HasilAksi, type KonteksAksi } from '@/lib/integrasi/bantu';
import { AKSI_MENU_BACA } from '@/lib/integrasi/menu';
import { AKSI_MENU_TULIS } from '@/lib/integrasi/tulis';
import { analisa } from '@/lib/integrasi/analisa';

import { STATUS_PTS, KATEGORI_DR, statusResmi, akunChecklist } from '@/lib/integrasi/aksi-dasar';
import { checklistDetail, dailyReport, dailyReportTim, desainCari, jadwalCari, profil, progresProject, ringkasan, tiketCari, tiketDetail } from '@/lib/integrasi/aksi-baca';
import { jadwalBuat, jadwalStatus } from '@/lib/integrasi/aksi-jadwal';

export { adalahAtasan, bersih, hariIniWIB, teks, tglSah, type HasilAksi, type KonteksAksi };
export { statusResmi };

export const AKSI_BACA: readonly string[] = ['profil', 'ringkasan', 'tiket_cari', 'tiket_detail', 'jadwal_cari', 'progres_project',
  'checklist_detail', 'daily_report', 'daily_report_tim', 'desain_cari', 'analisa', ...Object.keys(AKSI_MENU_BACA)];
export const AKSI_TULIS: readonly string[] = ['tiket_aktivitas', 'tiket_selesai', 'jadwal_buat', 'jadwal_status', 'jadwal_selesai',
  'daily_report_tambah', 'checklist_simpan', ...Object.keys(AKSI_MENU_TULIS)];

export async function jalankanAksi(nama: string, a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const tulis = AKSI_TULIS.includes(nama);
  if (!tulis && !AKSI_BACA.includes(nama)) return gagal(`Aksi tidak dikenal: ${nama}`);
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
    case 'desain_cari': return desainCari(a, k);
    case 'tiket_aktivitas': return tiketAktivitas(a, k);
    case 'tiket_selesai': return tiketAktivitas({ ...a, status: 'Solved' }, k);
    case 'jadwal_status': return jadwalStatus(a, k);
    case 'jadwal_selesai': return jadwalStatus({ ...a, status: 'done' }, k);
    case 'jadwal_buat': return jadwalBuat(a, k);
    case 'daily_report_tambah': return dailyReportTambah(a, k);
    case 'checklist_simpan': return checklistSimpan(a, k);
    case 'analisa': return analisa(a, k);
  }
  const punya = (o: object) => Object.prototype.hasOwnProperty.call(o, nama);
  const menu = punya(AKSI_MENU_BACA) ? AKSI_MENU_BACA[nama] : punya(AKSI_MENU_TULIS) ? AKSI_MENU_TULIS[nama] : null;
  if (menu) return menu(a, k);
  return gagal(`Aksi tidak dikenal: ${nama}`);
}

interface BarisTiket extends TiketUntukKabar {
  id: string; status: string; project_name: string; issue_case: string; product: string | null; sn_unit: string | null;
  sales_name: string | null; sales_division: string | null; address: string | null; customer_phone: string | null;
  current_team: string | null; is_deleted: boolean | null;
}

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
  if (!hasFullAccess(u) && t.assign_name !== u.full_name) {
    return gagal('Hanya handler tiket ini atau pemegang akses penuh yang boleh memperbaruinya.');
  }
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
    } catch {  }
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
    } catch {  }
  }

  await k.efek.audit({ user_id: u.id, user_name: u.full_name ?? u.username, action: catatanSaja ? 'update' : 'status_change',
    module: 'ticket', target_id: t.id, target_name: t.project_name, old_value: t.status, new_value: baru });
  return { ok: true, tiket: t.project_name, status_lama: t.status, status_baru: baru, catatan_saja: catatanSaja,
    tenggat_diperpanjang_hari: tenggatDiperpanjang ? hari : 0, jadwal_onsite: jadwalOnsite,
    ...(baru === 'Solved' ? { dikabari, jadwal_ditutup: jadwalDitutup,
      ...(jadwalDitutup === null ? { peringatan: 'Ticket tersimpan, tapi jadwal di Reminder Schedule gagal ditutup. Mohon tutup manual.' } : {}) } : {}) };
}

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
  const u = k.u;
  await k.efek.audit({ user_id: u.id, user_name: u.full_name ?? u.username, action: 'update',
    module: 'checklist', target_id: id, notes: `DIWAYPI: ${perubahan.length} item checklist diubah` });
  return { ok: true, diubah: perubahan.length };
}
