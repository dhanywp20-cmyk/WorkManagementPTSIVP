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
import { gagal, hariIniWIB, idSah, jamSah, teks, tglSah, type HasilAksi, type KonteksAksi } from '@/lib/integrasi-bantu';

import { akunChecklist } from '@/lib/integrasi-aksi-dasar';

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

export async function jadwalStatus(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
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

export async function jadwalBuat(a: Record<string, unknown>, k: KonteksAksi): Promise<HasilAksi> {
  const { db, u } = k;
  const isAdmin = ['admin', 'superadmin'].includes((u.role ?? '').toLowerCase());
  if (!isAdmin && u.role !== 'team') return gagal('Hanya admin dan akun Team yang bisa membuat jadwal (sama dengan aplikasi).');
  try { await k.muatAturan?.(); } catch {  }

  const mentah = Array.isArray(a.tanggal) ? a.tanggal : [a.tanggal];
  const tanggal = Array.from(new Set(mentah.map(tglSah).filter((d): d is string => !!d))).sort().slice(0, 31);
  if (!tanggal.length) return gagal('tanggal wajib (YYYY-MM-DD, atau daftar tanggal untuk jadwal beberapa hari).');
  const kategori = CATEGORIES.find(c => c.toLowerCase() === String(a.kategori ?? '').trim().toLowerCase());
  if (!kategori) return gagal(`kategori wajib. Pilihan: ${CATEGORIES.join(', ')}.`);
  const jam = a.jam === undefined || a.jam === null || a.jam === '' ? '09:00' : jamSah(a.jam);
  if (!jam) return gagal('jam harus HH:MM (24 jam).');
  const prioritas = pilih(a.prioritas, ['low', 'medium', 'high', 'urgent'] as const) ?? 'medium';

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

  let grupInsentif: string | null | undefined;
  let peringatan: string | undefined;
  const kata = isian.project_name.replace(/[\\%*]/g, '_');
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
