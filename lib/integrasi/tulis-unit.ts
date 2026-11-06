import crypto from 'crypto';
import { hasFullAccess } from '@/lib/constants';
import { daftarTimDitugaskan } from '@/lib/teams';
import { bisaIsiKegiatan } from '@/lib/piket/akses';
import { bacaDaftarPilihan, KUNCI_DAFTAR_PILIHAN, type KunciDaftar } from '@/lib/daftar-pilihan-bawaan';
import { akunTambahan, gagal, hariIniWIB, idSah, jamSah, peranDari, samaNama, teks, tglSah, type KonteksAksi } from '@/lib/integrasi/bantu';
import { orangDalamUnit } from '@/lib/integrasi/menu';

import { type Aksi, audit } from '@/lib/integrasi/tulis-bersama';

const KONDISI = ['Baik', 'Perlu Service', 'Rusak'];

async function daftarPilihan(k: KonteksAksi, kunci: KunciDaftar): Promise<string[]> {
  try {
    const { data } = await k.db.from('app_settings').select('value').eq('key', KUNCI_DAFTAR_PILIHAN).maybeSingle();
    return bacaDaftarPilihan((data as { value?: unknown } | null)?.value ?? null)[kunci];
  } catch { return bacaDaftarPilihan(null)[kunci]; }
}

export const unitCatat: Aksi = async (a, k) => {
  const { db, u } = k;
  const t = await akunTambahan(k);
  if (t.pimpinan || !(hasFullAccess(u) || ['team', 'team_pts', 'marketing', 'guest'].includes(peranDari(u)))) {
    return gagal('Akun ini tidak bisa menambah log Unit Movement.');
  }
  const stRaw = String(a.status_barang ?? 'Keluar').trim().toLowerCase();
  const status = stRaw === 'masuk' ? 'Masuk' : stRaw === 'keluar' ? 'Keluar' : null;
  if (!status) return gagal('status_barang: Masuk atau Keluar.');
  const tanggal = tglSah(a.tanggal) ?? hariIniWIB();
  const project = teks(a.project, 150);
  try { await k.muatAturan?.(); } catch {  }
  const { data: tim } = await db.from('users').select('full_name').in('team_type', daftarTimDitugaskan()).order('full_name');
  const anggota = ((tim ?? []) as { full_name: string }[]).map(x => x.full_name);
  const ptsArg = teks(a.nama_pts, 100) || (anggota.includes(u.full_name ?? '') ? (u.full_name ?? '') : '');
  const pts = anggota.find(n => samaNama(n, ptsArg));
  if (!pts || !project) return gagal(`Tanggal, Nama PTS, dan Project wajib diisi!${anggota.length ? ` Nama PTS: ${anggota.slice(0, 8).join(', ')}.` : ''}`);
  const events = await daftarPilihan(k, 'unit-event');
  const eventArg = teks(a.event, 60) || 'Project';
  const event = events.find(e => samaNama(e, eventArg));
  if (!event) return gagal(`event: ${events.join(', ')}.`);
  const kondisi = KONDISI.find(x => samaNama(x, teks(a.kondisi, 30) || 'Baik'));
  if (!kondisi) return gagal(`kondisi: ${KONDISI.join(', ')}.`);
  const payload = {
    tanggal, status_barang: status, nama_pts: pts, nama_luar: teks(a.nama_luar, 100), event, project_name: project,
    type_barang: teks(a.tipe, 150), serial_number: teks(a.sn, 120), catatan: teks(a.catatan, 1000),
    foto_surat_url: '', foto_barang_url: '', created_by: u.username, kondisi_barang: kondisi,
    expected_return_date: status === 'Keluar' ? tglSah(a.kembali) : null,
  };
  const { data, error } = await db.from('movement_logs').insert([payload]).select('id');
  if (error) return gagal('Gagal: ' + error.message);
  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (!id) return gagal('Log tidak tersimpan (ditolak sistem).');
  await audit(k, { action: 'create', module: 'movement', target_id: id, target_name: project, notes: `${status} · ${payload.type_barang || '-'}` });
  return { ok: true, id, status_barang: status, project, nama_pts: pts, event, kembali: payload.expected_return_date };
};

export const unitKembali: Aksi = async (a, k) => {
  const { db, u } = k;
  const t = await akunTambahan(k);
  if (t.pimpinan) return gagal('Akun pimpinan hanya bisa melihat Unit Movement.');
  const id = idSah(a.id);
  if (!id) return gagal('id log tidak sah (ambil dari unit_cari).');
  const { data: l, error: le } = await db.from('movement_logs').select('id, project_name, status_barang, return_confirmed, created_by, nama_luar')
    .eq('id', id).maybeSingle();
  if (le) return gagal(le.message);
  const log = l as { id: string; project_name: string | null; status_barang: string; return_confirmed: boolean | null; created_by: string | null; nama_luar: string | null } | null;
  if (!log || (!orangDalamUnit(u, t) && log.created_by !== u.username && log.nama_luar !== u.full_name)) {
    return gagal('Log tidak ditemukan atau Anda tidak punya akses.');
  }
  if (log.status_barang !== 'Keluar') return gagal('Hanya barang Keluar yang bisa ditandai sudah kembali.');
  if (log.return_confirmed) return gagal('Barang ini sudah ditandai kembali.');
  const { data, error } = await db.from('movement_logs').update({ return_confirmed: true }).eq('id', id).select('id');
  if (error) return gagal('Gagal menandai kembali: ' + error.message);
  if (!data || data.length === 0) return gagal('Gagal menandai kembali: ditolak sistem (RLS).');
  await audit(k, { action: 'update', module: 'movement', target_id: id, target_name: log.project_name ?? '', notes: 'Tandai barang sudah kembali' });
  return { ok: true, project: log.project_name, sudah_kembali: true };
};

export const piketCatat: Aksi = async (a, k) => {
  const { db, u } = k;
  const t = await akunTambahan(k);
  if (!bisaIsiKegiatan({ role: u.role, team_type: u.team_type, access_level: u.access_level, piket_akses: t.piket_akses, piket_ubah: t.piket_ubah })) {
    return gagal('Akun ini hanya bisa melihat Piket Showroom (mengisi kegiatan = Tim PTS / akun yang diberi izin).');
  }
  const tanggal = tglSah(a.tanggal) ?? hariIniWIB();
  const { data: row, error: re } = await db.from('piket_schedules').select('id, day_date').eq('day_date', tanggal).maybeSingle();
  if (re) return gagal(re.message);
  const p = row as { id: string } | null;
  if (!p) return gagal(`Belum ada jadwal piket tanggal ${tanggal}.`);
  const jenisList = await daftarPilihan(k, 'piket-kegiatan');
  const jenis = jenisList.find(j => samaNama(j, teks(a.jenis, 60)));
  if (!jenis) return gagal(`jenis kegiatan: ${jenisList.join(', ')}.`);
  const daftar = (v: unknown) => (Array.isArray(v) ? v.map(String) : String(v ?? '').split(',')).map(s => s.trim()).filter(Boolean).slice(0, 30);
  const demo = jenis === 'Demo Product';
  const kini = new Date().toISOString();
  const baris = {
    id: crypto.randomUUID(), piket_id: p.id, jenis_kegiatan: jenis,
    jam_mulai: jamSah(a.jam_mulai), jam_selesai: jamSah(a.jam_selesai), produk: daftar(a.produk),
    tamu_instansi: demo ? (teks(a.tamu, 150) || null) : null, nama_sales: demo ? (teks(a.sales, 120) || null) : null,
    sales_division: demo ? (teks(a.divisi, 40) || null) : null, kebutuhan: demo ? daftar(a.kebutuhan) : [],
    keterangan: !demo ? (teks(a.keterangan, 1000) || null) : null, team_rnd: jenis === 'RnD' ? (teks(a.team_rnd, 100) || null) : null,
    created_at: kini, updated_at: kini, edited_by_name: u.full_name || null,
  };
  const { count: demoSebelum } = await db.from('piket_tamu_detail').select('id', { count: 'exact', head: true })
    .eq('piket_id', p.id).eq('jenis_kegiatan', 'Demo Product');
  const { data: ins, error } = await db.from('piket_tamu_detail').insert([baris]).select('id');
  if (error) return gagal('Gagal: ' + error.message);
  if (!ins || ins.length === 0) return gagal('Kegiatan tidak tersimpan (ditolak sistem).');
  const ubah: Record<string, unknown> = { updated_at: kini };
  if (u.full_name) ubah.edited_by_name = u.full_name;
  if (demo && !demoSebelum) { ubah.tamu_instansi = baris.tamu_instansi; ubah.kebutuhan = baris.kebutuhan; }
  const { error: ue } = await db.from('piket_schedules').update(ubah).eq('id', p.id);
  if (ue) console.warn('[integrasi/piket] Gagal update piket_schedules:', ue.message);
  await audit(k, { action: 'create', module: 'piket', target_id: p.id, target_name: tanggal, notes: `${jenis}${baris.tamu_instansi ? ` · ${baris.tamu_instansi}` : ''}` });
  return { ok: true, tanggal, jenis, tamu: baris.tamu_instansi, jam: baris.jam_mulai ? `${baris.jam_mulai}-${baris.jam_selesai ?? ''}` : null };
};
