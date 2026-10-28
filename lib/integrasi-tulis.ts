/**
 * lib/integrasi-tulis.ts - aksi UBAH DATA DIWAYPI di luar tahap 1-2.
 *
 * Tiap aksi menyalin satu tombol di aplikasi web LANGKAH DEMI LANGKAH - syarat tombolnya,
 * baris yang ditulis, isi WA/Telegram (efek.wa = sendWANotif), notifikasi in-app (efek.inApp =
 * createNotification) - dan berkas sumbernya disebut di atas fungsinya. Bedanya hanya dua, dan
 * keduanya ke arah lebih ketat: setiap update memeriksa baris yang benar-benar berubah
 * (RLS yang menolak menjawab 0 baris TANPA galat), dan setiap aksi tercatat di audit trail
 * (ditandai "via DIWAYPI" oleh lib/efek-server.ts).
 *
 * SENGAJA TIDAK ADA: hapus permanen, proses/bayar insentif, pengaturan & snapshot KPI,
 * mengerjakan / mengelola kuis Learning Center, serah tiket ke Team Services, mengisi nilai
 * Form Review (itu bagian pelanggan/Sales). Semuanya tetap lewat aplikasi.
 */
import crypto from 'crypto';
import { hasFullAccess } from '@/lib/constants';
import { JABATAN_CC_RULES } from '@/lib/jabatan';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { cobaIdentitas, idDariNama, tanpaIdentitas } from '@/lib/identitas';
import { adalahAdminMurni, bolehDitugaskanOleh, daftarTimDitugaskan, isAssignablePTSTeam } from '@/lib/teams';
import { appLink } from '@/lib/app-url';
import { bisaIsiKegiatan } from '@/lib/piket-akses';
import { bacaDaftarPilihan, KUNCI_DAFTAR_PILIHAN, type KunciDaftar } from '@/lib/daftar-pilihan-bawaan';
import { linkOneDriveSah } from '@/app/(portal)/tech-note/_components/aturan-tech-note';
import type { NotifPayload } from '@/lib/notifications';
import type { AuditAction } from '@/lib/audit';
import {
  akunTambahan, gagal, hariIniWIB, idSah, jamSah, peranDari, penerimaAdminServer, samaNama, teks, tglSah,
  type HasilAksi, type KonteksAksi,
} from '@/lib/integrasi-bantu';
import {
  adalahGalat, hakDesain, indeksRuangan, muatRequestDesain, namaRuangan, orangDalamUnit, statusRuangan,
  type RequestDesain, type RuanganDesain,
} from '@/lib/integrasi-menu';

type Aksi = (a: Record<string, unknown>, k: KonteksAksi) => Promise<HasilAksi>;
const GARIS = '━━━━━━━━━━━━━━━━━━';
const nama = (k: KonteksAksi) => k.u.full_name ?? k.u.username;

interface Orang {
  id: string; username: string; full_name: string; role?: string | null; team_type?: string | null;
  phone_number?: string | null; sales_division?: string | null; jabatan?: string | null; bisa_ditugaskan?: boolean | null;
}
const KOLOM_ORANG = 'id, username, full_name, role, team_type, phone_number, sales_division, jabatan, bisa_ditugaskan';

/**
 * Anggota Team PTS yang ditawarkan di dropdown assign (Ticketing, Request Design): role team /
 * team_pts, lalu bolehDitugaskanOleh(anggota, penugasAdminMurni) - Manager hanya untuk Admin murni.
 */
async function anggotaDitawarkan(k: KonteksAksi): Promise<Orang[] | HasilAksi> {
  try { await k.muatAturan?.(); } catch { /* pakai bawaan, sama dengan peramban yang gagal memuat */ }
  const { data, error } = await k.db.from('users').select(KOLOM_ORANG).in('role', ['team_pts', 'team']).order('full_name');
  if (error) return gagal(error.message);
  const penugasAdmin = adalahAdminMurni(k.u);
  return ((data ?? []) as Orang[]).filter(x => bolehDitugaskanOleh(x, penugasAdmin));
}
/** Supervisor tim PTS yang bisa ditugaskan - pilihan "Route ke Supervisor". */
async function daftarSupervisor(k: KonteksAksi): Promise<Orang[]> {
  try { await k.muatAturan?.(); } catch { /* bawaan */ }
  const { data } = await k.db.from('users').select(KOLOM_ORANG).eq('jabatan', 'Supervisor');
  return ((data ?? []) as Orang[]).filter(s => isAssignablePTSTeam(s.team_type));
}
/** "saya" / nama sendiri = kerjakan sendiri (opsi SELF di form); selain itu nama lengkap atau username. */
const diriSendiri = (v: string, k: KonteksAksi) => ['saya', 'sendiri', 'aku', 'self'].includes(v.trim().toLowerCase())
  || samaNama(k.u.full_name, v) || samaNama(k.u.username, v);
const cariOrang = (daftar: Orang[], v: string) => daftar.find(x => samaNama(x.username, v)) ?? daftar.find(x => samaNama(x.full_name, v));
const contoh = (daftar: Orang[]) => (daftar.length ? ` Contoh: ${daftar.slice(0, 8).map(x => x.full_name).join(', ')}.` : '');

/** Kirim WA tanpa pernah melempar; hasilnya dihitung untuk laporan. */
async function kirimWA(k: KonteksAksi, nomor: string | null | undefined, pesan: string, event?: string): Promise<boolean> {
  if (!(nomor ?? '').trim()) return false;
  const r = await k.efek.wa(String(nomor), pesan, event);
  return r.ok;
}
async function audit(k: KonteksAksi, p: { action: AuditAction; module: string; target_id?: string; target_name?: string;
  old_value?: string | null; new_value?: string | null; notes?: string }) {
  const { old_value, new_value, ...lain } = p;
  await k.efek.audit({ user_id: k.u.id, user_name: nama(k), ...lain,
    ...(old_value ? { old_value } : {}), ...(new_value ? { new_value } : {}) });
}

// ================================================================ Ticketing
/**
 * fetchWACCTargets (ticketing/_components/shared.ts) dengan klien pemilik token: atasan sesuai
 * JABATAN_CC_RULES dari division_supervisor_mappings + user_supervisor_mappings, plus handler IVP
 * divisi itu (division_ivp_mappings).
 */
export async function targetCC(k: KonteksAksi, userId: string, salesDiv: string): Promise<{ phone: string; name: string; relation: string }[]> {
  const targets: { phone: string; name: string; relation: string }[] = [];
  const db = k.db;
  try {
    const { data: userData } = await db.from('users').select('jabatan').eq('id', userId).maybeSingle();
    const jabatan = (userData as { jabatan?: string } | null)?.jabatan;
    const aturan = jabatan ? (JABATAN_CC_RULES as Record<string, string[]>)[jabatan] : undefined;
    if (aturan && aturan.length > 0) {
      const { data: supMaps } = await db.from('division_supervisor_mappings').select('supervisor_id').eq('sales_division', salesDiv);
      if (supMaps?.length) {
        const { data: sups } = await db.from('users').select('full_name, phone_number, jabatan')
          .in('id', (supMaps as { supervisor_id: string }[]).map(m => m.supervisor_id)).not('phone_number', 'is', null).neq('phone_number', '');
        for (const s of (sups ?? []) as { full_name: string; phone_number: string; jabatan: string | null }[]) {
          if (s.jabatan && aturan.includes(s.jabatan)) targets.push({ phone: s.phone_number, name: s.full_name, relation: 'supervisor' });
        }
      }
      const { data: userSupMaps } = await db.from('user_supervisor_mappings').select('supervisor_id').eq('user_id', userId);
      if (userSupMaps?.length) {
        const { data: manual } = await db.from('users').select('full_name, phone_number, jabatan')
          .in('id', (userSupMaps as { supervisor_id: string }[]).map(m => m.supervisor_id)).not('phone_number', 'is', null).neq('phone_number', '');
        for (const s of (manual ?? []) as { full_name: string; phone_number: string }[]) {
          if (!targets.find(t => t.phone === s.phone_number)) targets.push({ phone: s.phone_number, name: s.full_name, relation: 'supervisor' });
        }
      }
    }
    if (salesDiv && salesDiv !== 'IVP') {
      const { data: ivpRes } = await db.from('division_ivp_mappings').select('ivp_id').eq('sales_division', salesDiv);
      if (ivpRes?.length) {
        const { data: ivps } = await db.from('users').select('full_name, phone_number')
          .in('id', (ivpRes as { ivp_id: string }[]).map(s => s.ivp_id)).not('phone_number', 'is', null).neq('phone_number', '');
        for (const s of (ivps ?? []) as { full_name: string; phone_number: string }[]) {
          if (!targets.find(t => t.phone === s.phone_number)) targets.push({ phone: s.phone_number, name: s.full_name, relation: 'ivp_handler' });
        }
      }
    }
  } catch (e) { console.warn('[integrasi/targetCC]', e); }
  return targets;
}

/**
 * Buat ticket - useBuatTicket.ts createTicket. Admin/superadmin & Full Access (Manager PTS):
 * langsung Pending dengan penanganan wajib (handler / "saya" / supervisor). Lainnya: Waiting
 * Approval + kabar ke approver (admin, Full Access, manager_user_id) + CC atasan & IVP divisi.
 * Foto & brand Sales External tidak didukung lewat DIWAYPI.
 */
const tiketBuat: Aksi = async (a, k) => {
  const { db, u } = k;
  const project = teks(a.project, 150), issue = teks(a.issue, 300);
  if (!project || !issue) return gagal('project dan issue wajib diisi.');
  const role = peranDari(u);
  const elevated = role === 'admin' || role === 'superadmin' || hasFullAccess(u);
  const handlerArg = teks(a.handler, 80), supArg = teks(a.supervisor, 80);
  if (elevated && !handlerArg && !supArg) return gagal('Tentukan penanganan: handler (nama anggota Team PTS atau "saya") atau supervisor.');
  if (!elevated && (handlerArg || supArg)) return gagal('Ticket dari akun ini masuk Waiting Approval - penanganannya ditentukan Admin/Manager.');
  const tanggal = tglSah(a.tanggal) ?? hariIniWIB();

  let assignName = '', sup: Orang | undefined, handler: Orang | undefined, self = false;
  if (elevated) {
    if (supArg) {
      sup = cariOrang(await daftarSupervisor(k), supArg);
      if (!sup) return gagal(`Supervisor "${supArg}" tidak ditemukan di daftar Supervisor tim PTS.`);
    } else if (diriSendiri(handlerArg, k)) { self = true; assignName = u.full_name ?? ''; }
    else {
      const tim = await anggotaDitawarkan(k);
      if (adalahGalat(tim)) return tim;
      handler = cariOrang(tim, handlerArg);
      if (!handler) return gagal(`Handler "${handlerArg}" tidak ada di daftar Team PTS yang bisa ditugaskan.${contoh(tim)}`);
      assignName = handler.full_name;
    }
  }
  const { data: semua } = await db.from('users').select('id, username, full_name');
  const orang = (semua ?? []) as Orang[];
  const salesNama = role === 'guest' ? (u.full_name || teks(a.sales, 120) || null) : (teks(a.sales, 120) || null);
  const salesDiv = role === 'guest' ? (u.sales_division || teks(a.divisi, 40) || null) : (teks(a.divisi, 40) || null);
  const data: Record<string, unknown> = {
    project_name: project, address: teks(a.alamat, 300) || null, customer_phone: teks(a.telepon, 40) || null,
    sales_name: salesNama, sales_division: salesDiv, sn_unit: teks(a.sn, 80) || null, product: teks(a.produk, 150) || null,
    issue_case: issue, description: teks(a.deskripsi, 2000) || null, assign_name: assignName, date: tanggal,
    status: elevated ? 'Pending' : 'Waiting Approval', current_team: 'Team PTS IVP', services_status: null,
    created_by: u.username || null,
    sales_user_id: role === 'guest' ? u.id : idDariNama(orang, salesNama),
    assign_user_id: idDariNama(orang, assignName),
    photo_url: null, photo_name: null, reminder_id: null,
  };
  if (sup) { data.routing_status = 'supervisor_assign'; data.assigned_supervisor_id = sup.id; }
  const { data: masuk, error } = await cobaIdentitas(async pakai => await db.from('tickets')
    .insert([pakai ? data : tanpaIdentitas(data)]).select('id').single());
  if (error) return gagal(`Gagal menyimpan ticket: ${error.message}`);
  const id = (masuk as { id: string } | null)?.id;
  if (!id) return gagal('Ticket tidak tersimpan (ditolak sistem).');
  await audit(k, { action: 'create', module: 'ticket', target_id: id, target_name: project,
    notes: salesNama && salesNama !== u.full_name ? `Diinput ${u.full_name} atas nama Sales ${salesNama}` : `Issue: ${issue}` });

  let dikabari = 0;
  if (!elevated) {
    const approvers = (await penerimaAdminServer(db)).map(x => ({ id: x.id, phone_number: x.phone_number ?? '', full_name: x.full_name }));
    try {
      const { data: mgr } = await db.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN.MANAGER).maybeSingle();
      const managerId = (mgr as { value?: unknown } | null)?.value ? String((mgr as { value: unknown }).value).replace(/^"|"$/g, '') : '';
      if (managerId && !approvers.find(x => x.id === managerId)) {
        const { data: m } = await db.from('users').select('id, phone_number, full_name').eq('id', managerId).maybeSingle();
        if (m) approvers.push({ id: (m as Orang).id, phone_number: (m as Orang).phone_number ?? '', full_name: (m as Orang).full_name });
      }
    } catch { /* sama dengan aplikasi: override manager opsional */ }
    const pesan = ['🔔 *Request Ticket Baru — Menunggu Approval*', GARIS,
      `📌 *Project  :* ${project}`, `⚠️ *Issue    :* ${issue}`,
      `👤 *Requester:* ${u.full_name || '-'} (${u.username || '-'})`, `📅 *Tanggal  :* ${tanggal || '-'}`, GARIS,
      'Silakan buka dashboard untuk *Approve / Reject*.', `🔗 ${appLink()}`].join('\n');
    const hasil = await Promise.all(approvers.filter(x => x.phone_number).map(x => kirimWA(k, x.phone_number, pesan, 'ticket.approval_needed')));
    dikabari += hasil.filter(Boolean).length;
    for (const x of approvers) if (x.id) await k.efek.inApp({ user_id: x.id, type: 'ticket', title: '🔔 Ticket baru menunggu approval',
      body: `${project} — ${issue}`, action_url: '/ticketing', ref_id: id, created_by: u.full_name || '' });
    const ccDiv = salesDiv ?? u.sales_division ?? '';
    if (ccDiv && ccDiv !== 'IVP') {
      const cc = await targetCC(k, u.id, ccDiv);
      if (cc.length) {
        const ccMsg = [`🔔 *[CC] Ticket Baru — Divisi ${ccDiv}*`, GARIS, `📌 *Project  :* ${project}`, `⚠️ *Issue    :* ${issue}`,
          `👤 *Sales    :* ${u.full_name || '-'} (${ccDiv})`, `📅 *Tanggal  :* ${tanggal || '-'}`, GARIS,
          `📋 *CC ke   :* ${cc.map(t => t.name + (t.relation === 'ivp_handler' ? ' (IVP)' : '')).join(', ')}`, `🔗 ${appLink()}`].join('\n');
        dikabari += (await Promise.all(cc.map(t => kirimWA(k, t.phone, ccMsg, 'ticket.approval_needed')))).filter(Boolean).length;
      }
    }
  }
  if (sup) {
    await k.efek.inApp({ user_id: sup.id, type: 'ticket', title: '🎯 Ticket perlu kamu assign', body: `${project} — ${issue}`,
      action_url: '/ticketing', ref_id: id, created_by: u.full_name || '' });
    if (await kirimWA(k, sup.phone_number, ['🎯 *Ticket Perlu Di-assign ke Tim*', GARIS,
      `Halo *${sup.full_name}*, ${u.full_name} meneruskan ticket — silakan assign ke anggota tim / kerjakan sendiri:`,
      `📌 *Project :* ${project}`, `⚠️ *Issue   :* ${issue}`, GARIS, `🔗 ${appLink()}`].join('\n'), 'ticket.routed_supervisor')) dikabari++;
  }
  if (handler && !self) {
    if (await kirimWA(k, handler.phone_number, ['🎫 *Ticket Baru Assigned ke Kamu*', GARIS,
      `Halo *${handler.full_name}*, ada ticket baru untukmu:`, '',
      `📌 *Project :* ${project}`, `⚠️ *Issue   :* ${issue}`, `📝 *Deskripsi:* ${data.description || '-'}`,
      `🔢 *SN Unit :* ${data.sn_unit || '-'}`, `📱 *Customer:* ${data.customer_phone || '-'}`, `👤 *Sales   :* ${salesNama || '-'}`,
      `📅 *Tanggal :* ${tanggal || '-'}`, GARIS, 'Mohon segera ditangani. Semangat! 💪', `🔗 ${appLink()}`].join('\n'), 'ticket.assigned')) dikabari++;
  }
  return { ok: true, id, project, status: data.status, handler: assignName || null, supervisor: sup?.full_name ?? null, dikabari };
};

interface TiketSetuju {
  id: string; project_name: string; issue_case: string; status: string; date: string | null; created_by: string | null;
  sales_division: string | null; assign_name: string | null; routing_status: string | null; assigned_supervisor_id: string | null;
  is_deleted: boolean | null;
}

/**
 * Approve ticket Waiting Approval (useApproveTicket.ts) - Admin / Full Access: assign handler
 * atau route ke Supervisor, dengan penjaga `.eq('status','Waiting Approval')` + cek baris supaya
 * dua penyetuju tidak saling menimpa. Ticket yang di-route ke pemilik token sebagai Supervisor:
 * assign lanjut ke tim / kerjakan sendiri (useTugaskanSupervisor.ts).
 */
const tiketSetujui: Aksi = async (a, k) => {
  const { db, u } = k;
  const id = idSah(a.id);
  if (!id) return gagal('id tiket tidak sah (ambil dari tiket_persetujuan).');
  const { data, error } = await db.from('tickets')
    .select('id, project_name, issue_case, status, date, created_by, sales_division, assign_name, routing_status, assigned_supervisor_id, is_deleted')
    .eq('id', id).maybeSingle();
  if (error) return gagal(error.message);
  const t = data as TiketSetuju | null;
  if (!t || t.is_deleted) return gagal('Tiket tidak ditemukan atau Anda tidak punya akses.');
  const handlerArg = teks(a.handler, 80), supArg = teks(a.supervisor, 80);

  // ---- Supervisor yang di-route: assign lanjut ke tim
  if (t.routing_status === 'supervisor_assign' && t.assigned_supervisor_id === u.id && !(t.assign_name ?? '').trim()) {
    if (!handlerArg) return gagal('Pilih anggota tim (handler) atau "saya" untuk kerjakan sendiri.');
    const self = diriSendiri(handlerArg, k);
    let h: Orang | undefined;
    if (!self) {
      const tim = await anggotaDitawarkan(k);
      if (adalahGalat(tim)) return tim;
      h = cariOrang(tim.filter(m => m.full_name !== u.full_name), handlerArg);
      if (!h) return gagal(`Handler "${handlerArg}" tidak ada di daftar tim.${contoh(tim)}`);
    }
    const nm = self ? (u.full_name ?? '') : h!.full_name;
    const { data: rows, error: e } = await db.from('tickets').update({ status: 'Pending', assign_name: nm, routing_status: null })
      .eq('id', t.id).select('id');
    if (e) return gagal(e.message);
    if (!rows || rows.length === 0) return gagal('Perubahan ditolak sistem (RLS). Hubungi admin.');
    const notif = (uid: string): NotifPayload => ({ user_id: uid, type: 'ticket', title: `🎫 Tiket baru ditugaskan ke ${nm}`,
      body: `Project: ${t.project_name}`, action_url: '/ticketing', ref_id: t.id, created_by: u.full_name ?? 'Supervisor' });
    let wa = false;
    if (self) await k.efek.inApp(notif(u.id));
    else {
      await k.efek.inApp(notif(h!.id));
      wa = await kirimWA(k, h!.phone_number, ['🎫 *Ticket Assigned ke Kamu*', GARIS,
        `Halo *${h!.full_name || nm}*, kamu di-assign Supervisor *${u.full_name}*:`,
        `📌 *Project :* ${t.project_name}`, `⚠️ *Issue   :* ${t.issue_case}`, GARIS, 'Mohon segera ditangani. Semangat! 💪',
        `🔗 ${appLink()}`].join('\n'), 'ticket.assigned');
    }
    await audit(k, { action: 'assign', module: 'ticket', target_id: t.id, target_name: t.project_name, new_value: nm });
    return { ok: true, tiket: t.project_name, handler: nm, wa_handler: wa };
  }

  // ---- Approve Waiting Approval
  const role = peranDari(u);
  if (!(role === 'admin' || role === 'superadmin' || hasFullAccess(u))) {
    return gagal('Approve ticket hanya untuk Admin atau pemegang Full Access.');
  }
  if (t.status !== 'Waiting Approval') return gagal(`Ticket ini berstatus ${t.status}, bukan Waiting Approval.`);
  if (!handlerArg && !supArg) return gagal('Pilih handler (anggota Team PTS / "saya") atau supervisor untuk di-route.');

  if (supArg) {
    const s = cariOrang(await daftarSupervisor(k), supArg);
    if (!s) return gagal(`Supervisor "${supArg}" tidak ditemukan di daftar Supervisor tim PTS.`);
    const { data: rows, error: e } = await db.from('tickets').update({ status: 'Pending', assign_name: '',
      routing_status: 'supervisor_assign', assigned_supervisor_id: s.id }).eq('id', t.id).eq('status', 'Waiting Approval').select('id');
    if (e) return gagal(e.message);
    if (!rows || rows.length === 0) return gagal('Ticket ini sudah diproses lebih dulu (mungkin oleh admin lain).');
    await k.efek.inApp({ user_id: s.id, type: 'ticket', title: '🎯 Ticket perlu kamu assign', body: `${t.project_name} — ${t.issue_case}`,
      action_url: '/ticketing', ref_id: t.id, created_by: u.full_name || '' });
    const wa = await kirimWA(k, s.phone_number, ['🎯 *Ticket Perlu Di-assign ke Tim*', GARIS,
      `Halo *${s.full_name}*, ticket sudah diapprove Admin — silakan assign ke anggota tim / kerjakan sendiri:`,
      `📌 *Project :* ${t.project_name}`, `⚠️ *Issue   :* ${t.issue_case}`, GARIS, `🔗 ${appLink()}`].join('\n'), 'ticket.routed_supervisor');
    await audit(k, { action: 'approve', module: 'ticket', target_id: t.id, target_name: t.project_name, notes: `Routed to supervisor: ${s.full_name}` });
    return { ok: true, tiket: t.project_name, diteruskan_ke_supervisor: s.full_name, wa_supervisor: wa };
  }

  let h: Orang | undefined;
  if (diriSendiri(handlerArg, k)) h = { id: u.id, username: u.username, full_name: u.full_name ?? '' };
  else {
    const tim = await anggotaDitawarkan(k);
    if (adalahGalat(tim)) return tim;
    h = cariOrang(tim, handlerArg);
    if (!h) return gagal(`Handler "${handlerArg}" tidak ada di daftar Team PTS yang bisa ditugaskan.${contoh(tim)}`);
  }
  const { data: rows, error: e } = await db.from('tickets').update({ status: 'Pending', assign_name: h.full_name })
    .eq('id', t.id).eq('status', 'Waiting Approval').select('id');
  if (e) return gagal(e.message);
  if (!rows || rows.length === 0) return gagal('Ticket ini sudah diproses lebih dulu (mungkin oleh admin lain).');
  const { data: pembuat } = t.created_by
    ? await db.from('users').select('id, role, sales_division').eq('username', t.created_by).maybeSingle() : { data: null };
  const cr = pembuat as { id: string; role: string | null; sales_division: string | null } | null;
  if (cr && cr.role === 'guest') {
    await k.efek.inApp({ user_id: cr.id, type: 'ticket', title: '🎫 Ticket disetujui', body: `${t.project_name} — ditugaskan ke ${h.full_name}`,
      action_url: '/ticketing', ref_id: t.id, created_by: u.full_name || '' });
  }
  const { data: hu } = await db.from('users').select('id, phone_number, full_name').eq('username', h.username).maybeSingle();
  const hx = hu as { id: string; phone_number: string | null; full_name: string } | null;
  if (hx?.id) await k.efek.inApp({ user_id: hx.id, type: 'ticket', title: `🎫 Tiket baru ditugaskan ke ${h.full_name}`,
    body: `Project: ${t.project_name}`, action_url: '/ticketing', ref_id: t.id, created_by: u.full_name ?? 'Admin' });
  await audit(k, { action: 'assign', module: 'ticket', target_id: t.id, target_name: t.project_name, new_value: h.full_name });
  const wa = await kirimWA(k, hx?.phone_number, ['🎫 *Ticket Assigned ke Kamu*', GARIS,
    `Halo *${hx?.full_name || 'Handler'}*, ada ticket untukmu:`, '',
    `📌 *Project :* ${t.project_name}`, `⚠️ *Issue   :* ${t.issue_case}`, `📅 *Tanggal :* ${t.date || '-'}`, GARIS,
    'Mohon segera ditangani. Semangat! 💪', `🔗 ${appLink()}`].join('\n'), 'ticket.assigned');
  const ccDiv = t.sales_division ?? cr?.sales_division ?? '';
  let cc = 0;
  if (ccDiv && ccDiv !== 'IVP' && cr?.id) {
    const tg = await targetCC(k, cr.id, ccDiv);
    if (tg.length) {
      const msg = [`✅ *[CC] Ticket Diapprove — Divisi ${ccDiv}*`, GARIS, `📌 *Project  :* ${t.project_name}`, `⚠️ *Issue    :* ${t.issue_case}`,
        `👷 *Handler  :* ${h.full_name}`, GARIS, `📋 *CC ke   :* ${tg.map(x => x.name + (x.relation === 'ivp_handler' ? ' (IVP)' : '')).join(', ')}`,
        `🔗 ${appLink()}`].join('\n');
      cc = (await Promise.all(tg.map(x => kirimWA(k, x.phone, msg, 'ticket.approval_needed')))).filter(Boolean).length;
    }
  }
  return { ok: true, tiket: t.project_name, handler: h.full_name, wa_handler: wa, cc_terkirim: cc,
    ...(hx?.phone_number && !wa ? { peringatan: 'WA ke handler gagal dikirim. Ticket berhasil di-approve.' } : {}) };
};

// ================================================================ Request Design Project
async function requestDanRuangan(a: Record<string, unknown>, k: KonteksAksi) {
  const r = await muatRequestDesain(a.id, k);
  if (adalahGalat(r)) return r;
  const i = indeksRuangan(a, r);
  if (i === null) return gagal(`Ruangan tidak ada. Request ini punya ${1 + (r.rooms?.length ?? 0)} ruangan.`);
  const t = await akunTambahan(k);
  return { r, i, t, hak: hakDesain(r, k.u, t, i) };
}
const pesanSistem = (k: KonteksAksi, reqId: string, message: string) =>
  k.db.from('project_messages').insert([{ request_id: reqId, sender_id: k.u.id, sender_name: 'System', sender_role: 'system', message }]);
const pesanPelaku = (k: KonteksAksi, reqId: string, message: string) =>
  k.db.from('project_messages').insert([{ request_id: reqId, sender_id: k.u.id, sender_name: k.u.full_name, sender_role: k.u.role, message }]);
/** notifyProjectStatusChange (lib/notifications.ts). */
async function kabarStatusProject(k: KonteksAksi, requesterId: string | null, r: RequestDesain, status: string) {
  if (!requesterId) return;
  const label: Record<string, string> = { approved: '✅ Disetujui', rejected: '❌ Ditolak', in_progress: '🔄 Sedang Diproses', completed: '🎉 Selesai' };
  await k.efek.inApp({ user_id: requesterId, type: 'project', title: `🏗️ ${r.project_name} — ${label[status] ?? status}`,
    body: `Status diperbarui oleh ${k.u.full_name}`, action_url: '/form-require-project', ref_id: r.id, created_by: k.u.full_name ?? '' });
}

/**
 * Approve & Assign / Assign ke Tim / Re-assign Tim PTS / Route ke Supervisor - AssignPTSModal
 * (Modals-AssignPTSModal.tsx handleSave & handleRouteToSupervisor), dibuka dari HeaderDetail
 * (approve awal, Supervisor yang di-route) atau KontrolAdminDetail (re-assign).
 */
const desainAssign: Aksi = async (a, k) => {
  const x = await requestDanRuangan(a, k);
  if (adalahGalat(x)) return x;
  const { r, i, hak } = x;
  const { db, u } = k;
  if (!hak.approve && !hak.assign_supervisor && !hak.reassign) {
    return gagal(r.routing_status === 'internal_review'
      ? 'Request ini masih menunggu review Sales Internal - belum bisa diapprove.'
      : 'Anda tidak bisa meng-assign request ini (approve hanya Admin/Full Access saat Pending; Supervisor yang di-route; re-assign dari Admin Controls).');
  }
  const supArg = teks(a.supervisor, 80), handlerArg = teks(a.handler, 80);
  if (supArg) {
    if (!hak.route_supervisor) return gagal('Route ke Supervisor hanya saat approve awal / re-assign ruangan pertama.');
    const sup = cariOrang(await daftarSupervisor(k), supArg);
    if (!sup) return gagal(`Supervisor "${supArg}" tidak ditemukan di daftar Supervisor tim PTS.`);
    const patch: Record<string, unknown> = { status: 'approved', approved_by: u.full_name, approved_at: new Date().toISOString(),
      routing_status: 'supervisor_assign', assigned_supervisor_id: sup.id, assign_name: null, assign_user_id: null };
    const { data, error } = await cobaIdentitas(async pakai => await db.from('project_requests')
      .update(pakai ? patch : tanpaIdentitas(patch)).eq('id', r.id).select('id'));
    if (error) return gagal(`Gagal route: ${error.message}`);
    if (!data || data.length === 0) return gagal('Gagal route: perubahan ditolak sistem (RLS). Hubungi admin.');
    await pesanSistem(k, r.id, `✅ Request diapprove oleh ${u.full_name} & diteruskan ke Supervisor ${sup.full_name ?? '-'} untuk di-assign ke tim.`);
    const wa = await kirimWA(k, sup.phone_number, ['🎯 *Request Design — Perlu Di-assign ke Tim*', GARIS,
      `📋 Project  : ${r.project_name}`, `🏢 Sales    : ${r.sales_name || '-'} (${r.sales_division || '-'})`, `👤 Requester: ${r.requester_name}`, GARIS,
      'Sudah diapprove Admin/Manager — silakan assign ke anggota tim kamu atau kerjakan sendiri.', `🔗 ${appLink()}`].join('\n'), 'project.routed_supervisor');
    await k.efek.inApp({ user_id: sup.id, type: 'project', title: '🎯 Request perlu kamu assign', body: `${r.sales_name || '-'} — ${r.project_name}`,
      action_url: '/form-require-project', ref_id: r.id, created_by: u.full_name ?? '' });
    await audit(k, { action: 'approve', module: 'project', target_id: r.id, target_name: r.project_name, notes: `Route ke Supervisor ${sup.full_name}` });
    return { ok: true, request: r.project_name, diteruskan_ke_supervisor: sup.full_name, wa_supervisor: wa };
  }
  if (!handlerArg) return gagal('Pilih handler (nama anggota Team PTS atau "saya"), atau supervisor untuk route.');
  let h: Orang;
  if (diriSendiri(handlerArg, k)) h = { id: u.id, username: u.username, full_name: u.full_name ?? '', phone_number: null };
  else {
    const tim = await anggotaDitawarkan(k);
    if (adalahGalat(tim)) return tim;
    const ketemu = cariOrang(tim.filter(m => m.id !== u.id), handlerArg);
    if (!ketemu) return gagal(`Handler "${handlerArg}" tidak ada di daftar Team PTS yang bisa ditugaskan.${contoh(tim)}`);
    h = ketemu;
  }
  const kini = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (i === 0) {
    patch = { assign_name: h.full_name, assign_user_id: h.id, status: 'approved', approved_by: u.full_name, approved_at: kini };
    //  assigned_supervisor_id SENGAJA tidak dikosongkan (WITH CHECK RLS pr_update) - lihat handleSave.
    if (r.routing_status === 'supervisor_assign') patch.routing_status = null;
  } else {
    const rooms: RuanganDesain[] = [...(r.rooms || [])];
    rooms[i - 1] = { ...rooms[i - 1], assign_name: h.full_name, assign_user_id: h.id, status: 'approved', approved_by: u.full_name, approved_at: kini };
    patch = { rooms };
  }
  const { data, error } = await cobaIdentitas(async pakai => await db.from('project_requests')
    .update(pakai ? patch : tanpaIdentitas(patch)).eq('id', r.id).select('id'));
  if (error) return gagal(`Gagal approve: ${error.message}`);
  if (!data || data.length === 0) return gagal('Gagal approve: perubahan ditolak sistem (RLS). Hubungi admin.');
  await pesanSistem(k, r.id, `✅ Request diapprove oleh ${u.full_name}. Assigned ke Tim PTS: ${h.full_name}.`);
  let wa = false;
  if (h.phone_number && h.id !== u.id) {
    wa = await kirimWA(k, h.phone_number, ['🏗️ *request design Project — Assigned ke Kamu*', GARIS,
      `📋 Project  : ${r.project_name}`, `🛋️ Ruangan  : ${r.room_name || '-'}`, `🏢 Sales    : ${r.sales_name || '-'} (${r.sales_division || '-'})`,
      `👤 Requester: ${r.requester_name}`, GARIS, 'Segera proses dan update status ya! 💪', `🔗 ${appLink()}`].join('\n'), 'project.assigned');
  }
  await k.efek.inApp({ user_id: h.id, type: 'project',
    title: h.id === u.id ? '🏗️ Kamu assign request ini ke diri sendiri' : '🏗️ Request design di-assign ke kamu',
    body: `${r.project_name} — ${r.room_name || '-'}`, action_url: '/form-require-project', ref_id: r.id, created_by: u.full_name ?? '' });
  await audit(k, { action: 'assign', module: 'project', target_id: r.id, target_name: r.project_name, new_value: h.full_name,
    notes: i > 0 ? `Ruangan ${namaRuangan(r, i)}` : undefined });
  return { ok: true, request: r.project_name, ruangan: namaRuangan(r, i), handler: h.full_name, wa_handler: wa };
};

/** Update Status - useUbahStatusRequest.ts handleStatusUpdate (pilihan = ModalUpdateStatus). */
const desainStatus: Aksi = async (a, k) => {
  const x = await requestDanRuangan(a, k);
  if (adalahGalat(x)) return x;
  const { r, i, hak } = x;
  const { db, u } = k;
  const baru = String(a.status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!hak.ubah_status.length) return gagal('Anda tidak bisa mengubah status request ini (hanya Admin/Full Access atau PTS yang di-assign, setelah diapprove).');
  if (!hak.ubah_status.includes(baru)) return gagal(`Status tidak tersedia. Pilihan untuk Anda: ${hak.ubah_status.join(', ')}.`);
  const lama = statusRuangan(r, i);
  let patch: Record<string, unknown>;
  if (i === 0) patch = { status: baru };
  else {
    const rooms: RuanganDesain[] = [...(r.rooms || [])];
    rooms[i - 1] = { ...rooms[i - 1], status: baru };
    patch = { rooms };
  }
  const { data, error } = await db.from('project_requests').update(patch).eq('id', r.id).select('id');
  if (error || !data || data.length === 0) return gagal('Gagal update status: ' + (error?.message ?? 'akses ditolak database.'));
  await pesanPelaku(k, r.id, `🔄 Status diupdate menjadi: ${baru.replace('_', ' ').toUpperCase()}`);
  await kabarStatusProject(k, r.requester_id, r, baru);

  let wa = 0;
  try {
    const selesai = baru === 'completed';
    const namaOrang = [r.sales_name, r.assign_name, r.ivp_assignee].filter(Boolean) as string[];
    const idOrang = [r.requester_id].filter(Boolean) as string[];
    const [resNama, resId] = await Promise.all([
      namaOrang.length ? db.from('users').select('id,full_name,username,phone_number').in('full_name', namaOrang) : Promise.resolve({ data: [] }),
      idOrang.length ? db.from('users').select('id,full_name,username,phone_number').in('id', idOrang) : Promise.resolve({ data: [] }),
    ]);
    const penerima = new Map<string, Orang>();
    for (const o of [...((resNama.data ?? []) as Orang[]), ...((resId.data ?? []) as Orang[])]) if (o?.id) penerima.set(o.id, o);
    const ringkas = [`📌 *Project :* ${r.project_name}`, `👤 *Sales   :* ${r.sales_name || '-'}`,
      `🙋 *Dikerjakan:* ${r.assign_name || r.ivp_assignee || '-'}`].join('\n');
    for (const o of penerima.values()) {
      const dia = o.id === u.id;
      const pesan = (selesai && dia)
        ? ['🎉 *Terima Kasih!*', GARIS, `Halo *${o.full_name}*, request design ini sudah kamu tandai *Selesai*.`, ringkas, GARIS,
          'Terima kasih atas kerja kerasnya! 🙌', `🔗 ${appLink()}`].join('\n')
        : [selesai ? '✅ *REQUEST DESIGN SELESAI*' : '🔄 *STATUS REQUEST DESIGN DIPERBARUI*', GARIS,
          `Halo *${o.full_name}*, status request berubah menjadi *${baru}* oleh *${u.full_name}*:`, ringkas, GARIS, `🔗 ${appLink()}`].join('\n');
      if (await kirimWA(k, o.phone_number, pesan, 'project.updated')) wa++;
    }
  } catch { /* kabar gagal tidak boleh membatalkan perubahan statusnya */ }
  await audit(k, { action: 'status_change', module: 'project', target_id: r.id, target_name: r.project_name, old_value: lama ?? null, new_value: baru });
  return { ok: true, request: r.project_name, ruangan: namaRuangan(r, i), status_lama: lama, status_baru: baru, wa_terkirim: wa };
};

/** Tolak dengan alasan - useAksiPersetujuan.ts handleRejectConfirm. */
const desainTolak: Aksi = async (a, k) => {
  const x = await requestDanRuangan({ ...a, ruangan: undefined }, k);
  if (adalahGalat(x)) return x;
  const { r, hak } = x;
  if (!hak.tolak) return gagal('Tolak hanya untuk Admin/Full Access saat request Pending, atau Sales Internal pengulasnya.');
  const alasan = teks(a.alasan, 1000);
  if (!alasan) return gagal('Alasan penolakan wajib diisi!');
  const { data, error } = await k.db.from('project_requests').update({ status: 'rejected', rejection_reason: alasan }).eq('id', r.id).select('id');
  if (error) return gagal('Gagal reject: ' + error.message);
  if (!data || data.length === 0) return gagal('Gagal reject: perubahan ditolak sistem (RLS).');
  await pesanSistem(k, r.id, `❌ Request telah ditolak oleh ${k.u.full_name}. Alasan: ${alasan}`);
  let wa = false;
  try {
    const { data: req } = await k.db.from('users').select('phone_number').eq('id', r.requester_id ?? '').maybeSingle();
    wa = await kirimWA(k, (req as { phone_number?: string } | null)?.phone_number, `❌ *Request Design — Request Ditolak*

Halo *${r.requester_name}*, request kamu ditolak:

📋 *Project:* ${r.project_name}
📝 *Alasan:* ${alasan}

Hubungi Admin untuk info lebih lanjut.
🔗 ${appLink()}`);
  } catch { /* abaikan galat WA (sama dengan aplikasi) */ }
  await kabarStatusProject(k, r.requester_id, r, 'rejected');
  await audit(k, { action: 'reject', module: 'project', target_id: r.id, target_name: r.project_name, notes: alasan });
  return { ok: true, request: r.project_name, status_baru: 'rejected', wa_requester: wa };
};

/** Sales Internal: Approve & Teruskan ke Admin - useAksiPersetujuan.ts jalankanInternalApprove. */
const desainReviewInternal: Aksi = async (a, k) => {
  const x = await requestDanRuangan({ ...a, ruangan: undefined }, k);
  if (adalahGalat(x)) return x;
  const { r, hak } = x;
  const { u } = k;
  if (!hak.review_internal) return gagal('Request ini tidak menunggu review Sales Internal dari Anda.');
  const kini = new Date().toISOString();
  const kedua = !!r.internal_sales_id_2 && r.internal_sales_id_2 === u.id;
  const patch: Record<string, unknown> = kedua ? { internal_approved_at_2: kini } : { internal_approved_by: u.id, internal_approved_at: kini };
  const semua = !r.internal_sales_id_2 || (kedua ? !!r.internal_approved_at : !!r.internal_approved_at_2);
  if (semua) patch.routing_status = 'admin_review';
  const { data, error } = await k.db.from('project_requests').update(patch).eq('id', r.id).select('id');
  if (error) return gagal('Gagal approve: ' + error.message);
  if (!data || data.length === 0) return gagal('Gagal approve: perubahan ditolak sistem (RLS).');
  if (!semua) {
    await audit(k, { action: 'approve', module: 'project', target_id: r.id, target_name: r.project_name, notes: 'Internal review approved (menunggu reviewer kedua)' });
    return { ok: true, request: r.project_name, menunggu_reviewer_kedua: true };
  }
  await audit(k, { action: 'approve', module: 'project', target_id: r.id, target_name: r.project_name, notes: 'Internal review approved' });
  let wa = 0;
  try {
    const admins = await penerimaAdminServer(k.db);
    const msg = `✅ *REQUEST DESIGN LOLOS REVIEW SALES INTERNAL*\n\n`
      + `Request dari *${r.sales_name}* untuk *${r.project_name}* sudah di-review oleh *${u.full_name}* — silakan diproses/di-assign.\n`
      + `🔗 ${appLink()}`;
    wa = (await Promise.all(admins.filter(x => x.phone_number).map(x => kirimWA(k, x.phone_number, msg, 'project.approval_needed')))).filter(Boolean).length;
    for (const ad of admins) if (ad.id) await k.efek.inApp({ user_id: ad.id, type: 'project', title: '✅ Request lolos review Sales Internal',
      body: `${r.sales_name} — ${r.project_name}`, action_url: '/form-require-project', ref_id: r.id, created_by: u.full_name ?? '' });
  } catch { /* abaikan */ }
  return { ok: true, request: r.project_name, diteruskan_ke_admin: true, wa_terkirim: wa };
};

/** Ajukan ulang request yang ditolak - useAksiPersetujuan.ts handleResubmit (Sales pemiliknya). */
const desainAjukanUlang: Aksi = async (a, k) => {
  const x = await requestDanRuangan({ ...a, ruangan: undefined }, k);
  if (adalahGalat(x)) return x;
  const { r, hak } = x;
  if (!hak.ajukan_ulang) return gagal('Hanya request berstatus Rejected milik Anda (Sales) yang bisa diajukan ulang.');
  const { data, error } = await k.db.from('project_requests').update({ status: 'pending', rejection_reason: null }).eq('id', r.id).select('id');
  if (error) return gagal('Gagal re-submit: ' + error.message);
  if (!data || data.length === 0) return gagal('Gagal re-submit: perubahan ditolak sistem (RLS).');
  await pesanPelaku(k, r.id, `🔄 Request di-submit ulang oleh ${k.u.full_name}.`);
  await audit(k, { action: 'resubmit', module: 'project', target_id: r.id, target_name: r.project_name });
  let wa = 0;
  try {
    const pesan = ['🔁 *REQUEST DESIGN DIAJUKAN ULANG*', GARIS, `👤 *Sales   :* ${r.sales_name || k.u.full_name}`,
      `📌 *Project :* ${r.project_name}`, GARIS, 'Sudah diperbaiki dan menunggu approval kembali.', `🔗 ${appLink()}`].join('\n');
    for (const p of await penerimaAdminServer(k.db)) if (await kirimWA(k, p.phone_number, pesan, 'project.updated')) wa++;
  } catch { /* kabar gagal tidak boleh membatalkan pengajuan ulangnya */ }
  return { ok: true, request: r.project_name, status_baru: 'pending', wa_terkirim: wa };
};

/** Kirim pesan di chat request - usePesanLampiran.ts handleSendMessage (tanpa lampiran). */
const desainPesan: Aksi = async (a, k) => {
  const x = await requestDanRuangan(a, k);
  if (adalahGalat(x)) return x;
  const { r, i, hak } = x;
  const isi = teks(a.pesan, 2000);
  if (!isi) return gagal('Isi pesannya.');
  if (!hak.pesan) return gagal(hak.alasan_pesan ?? 'Anda tidak memiliki akses untuk mengirim pesan.');
  const pakaiLabel = a.ruangan !== undefined && a.ruangan !== null && a.ruangan !== '';
  const final = pakaiLabel ? `[${namaRuangan(r, i)}] ${isi}` : isi;
  const { data, error } = await k.db.from('project_messages').insert([{ request_id: r.id, sender_id: k.u.id, sender_name: k.u.full_name,
    sender_role: k.u.role, message: final }]).select('id');
  if (error || !data || data.length === 0) return gagal('Gagal kirim pesan.');
  await audit(k, { action: 'update', module: 'project', target_id: r.id, target_name: r.project_name, notes: 'Pesan chat request' });
  return { ok: true, request: r.project_name, terkirim: final };
};

// ================================================================ Tech Note
/** Unggah tech note baru (status pending) - useAksiTechNote.ts submitTechNote (mode baru). */
const catatanBuat: Aksi = async (a, k) => {
  const { db, u } = k;
  const judul = teks(a.judul, 200);
  const link = teks(a.link, 1000);
  const folderArg = teks(a.folder, 120);
  if (!judul) return gagal('judul wajib diisi.');
  if (!linkOneDriveSah(link)) return gagal('link wajib tautan OneDrive/SharePoint https (1drv.ms, onedrive.live.com, *.sharepoint.com).');
  const { data: folders, error: fe } = await db.from('tech_note_folders').select('id, name').order('name');
  if (fe) return gagal(fe.message);
  const fl = (folders ?? []) as { id: string; name: string }[];
  const folder = fl.find(f => f.id === folderArg) ?? fl.find(f => samaNama(f.name, folderArg));
  if (!folder) return gagal(`folder wajib salah satu folder Tech Note: ${fl.map(f => f.name).join(', ') || '(belum ada folder)'}.`);
  const tags = (Array.isArray(a.tags) ? a.tags.map(String) : String(a.tags ?? '').split(',')).map(s => s.trim()).filter(Boolean).slice(0, 20);
  const kini = new Date().toISOString();
  const { data: masuk, error } = await db.from('tech_notes').insert({
    title: judul, description: teks(a.deskripsi, 3000), folder_id: folder.id, author_id: u.id, author_name: u.full_name,
    one_drive_link: link, product: teks(a.produk, 150), tags, status: 'pending', submitted_at: kini, team_type: u.team_type ?? '',
  }).select('id').single();
  const id = (masuk as { id?: string } | null)?.id;
  if (error || !id) return gagal(`Gagal menyimpan tech note${error ? `: ${error.message}` : ' (ditolak sistem).'}`);
  await db.from('tech_note_history').insert({ tech_note_id: id, action: 'submitted', performed_by: u.id, performed_by_name: u.full_name,
    note: 'Submitted for review', created_at: kini });
  await audit(k, { action: 'create', module: 'tech-note', target_id: id, target_name: judul });
  for (const ad of await penerimaAdminServer(db)) await k.efek.inApp({ user_id: ad.id, type: 'system', title: '📄 Tech Note baru menunggu review',
    body: `"${judul}" oleh ${u.full_name}`, action_url: '/tech-note', ref_id: id, created_by: u.full_name ?? '' });
  return { ok: true, id, judul, folder: folder.name, status: 'pending' };
};

const PETA_REVIEW: Record<string, 'approved' | 'revision_requested' | 'rejected'> = {
  approved: 'approved', approve: 'approved', setuju: 'approved', disetujui: 'approved',
  revision: 'revision_requested', revision_requested: 'revision_requested', revisi: 'revision_requested',
  rejected: 'rejected', reject: 'rejected', tolak: 'rejected', ditolak: 'rejected',
};

/** Review tech note (Approve / Revisi / Tolak) - useAksiTechNote.ts submitApproval; ModalDetailNote: canManage && pending. */
const catatanReview: Aksi = async (a, k) => {
  const { db, u } = k;
  if (!hasFullAccess(u)) return gagal('Review tech note hanya untuk Admin atau pemegang Full Access.');
  const id = idSah(a.id);
  if (!id) return gagal('id tech note tidak sah (ambil dari catatan_cari).');
  const aksi = PETA_REVIEW[String(a.keputusan ?? '').trim().toLowerCase()];
  if (!aksi) return gagal('keputusan wajib: approved, revisi, atau rejected.');
  const { data: n, error: ne } = await db.from('tech_notes').select('id, title, status, author_id').eq('id', id).maybeSingle();
  if (ne) return gagal(ne.message);
  const c = n as { id: string; title: string; status: string; author_id: string | null } | null;
  if (!c) return gagal('Tech note tidak ditemukan.');
  if (c.status !== 'pending') return gagal(`Tech note ini berstatus ${c.status} - hanya yang Pending yang bisa direview.`);
  const catatan = teks(a.catatan, 1000);
  const kini = new Date().toISOString();
  const statusBaru = aksi === 'approved' ? 'approved' : aksi === 'rejected' ? 'rejected' : 'revision';
  const { data: terubah, error } = await db.from('tech_notes').update({ status: statusBaru, reviewed_at: kini, reviewed_by: u.id,
    reviewed_by_name: u.full_name, review_note: catatan || null }).eq('id', id).select('id');
  if (error || !terubah || terubah.length === 0) return gagal('Gagal menyimpan keputusan review. Coba lagi atau hubungi admin.');
  await db.from('tech_note_history').insert({ tech_note_id: id, action: aksi, performed_by: u.id, performed_by_name: u.full_name,
    note: catatan || null, created_at: kini });
  await audit(k, { action: aksi === 'approved' ? 'approve' : 'reject', module: 'tech-note', target_id: id, target_name: c.title, notes: catatan || undefined });
  let wa = false;
  if (c.author_id) {
    const label = aksi === 'approved' ? '✅ Disetujui' : aksi === 'rejected' ? '❌ Ditolak' : '🔄 Perlu Revisi';
    await k.efek.inApp({ user_id: c.author_id, type: 'system', title: `📄 Tech Note ${label}`, body: `"${c.title}" — ${catatan || 'Tanpa catatan'}`,
      action_url: '/tech-note', ref_id: id, created_by: u.full_name ?? '' });
    try {
      const { data: p } = await db.from('users').select('full_name, phone_number').eq('id', c.author_id).maybeSingle();
      const penulis = p as { full_name: string; phone_number: string | null } | null;
      if (penulis?.phone_number) {
        wa = await kirimWA(k, penulis.phone_number, [`📄 *TECH NOTE ${label.replace(/^[^\s]+\s/, '').toUpperCase()}*`, GARIS,
          `Halo *${penulis.full_name}*, catatan teknismu sudah direview oleh *${u.full_name}*:`,
          `📌 *Judul  :* ${c.title}`, `📝 *Catatan:* ${catatan || 'Tanpa catatan'}`, GARIS,
          aksi === 'approved' ? 'Terima kasih sudah berbagi — catatanmu kini bisa dipakai tim. 🙌' : 'Silakan ditindaklanjuti lalu ajukan kembali.',
          `🔗 ${appLink('/tech-note')}`].join('\n'));
      }
    } catch { /* kabar gagal tidak boleh membatalkan keputusan reviewnya */ }
  }
  return { ok: true, judul: c.title, status_baru: statusBaru, wa_penulis: wa };
};

// ================================================================ Unit Movement
const KONDISI = ['Baik', 'Perlu Service', 'Rusak'];

/** Daftar pilihan Admin Panel (app_settings daftar_pilihan) - bawaan bila belum diatur. */
async function daftarPilihan(k: KonteksAksi, kunci: KunciDaftar): Promise<string[]> {
  try {
    const { data } = await k.db.from('app_settings').select('value').eq('key', KUNCI_DAFTAR_PILIHAN).maybeSingle();
    return bacaDaftarPilihan((data as { value?: unknown } | null)?.value ?? null)[kunci];
  } catch { return bacaDaftarPilihan(null)[kunci]; }
}

/** Catat barang masuk/keluar - unit-movement AddEditModal handleSave (mode baru, tanpa foto); canAddLog. */
const unitCatat: Aksi = async (a, k) => {
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
  try { await k.muatAturan?.(); } catch { /* bawaan */ }
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

/** Tandai barang sudah kembali - unit-movement/page.tsx handleMarkReturned (!pimpinan). */
const unitKembali: Aksi = async (a, k) => {
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

// ================================================================ Piket Showroom
/**
 * Tambah SATU kegiatan ke catatan piket sebuah hari - padanan FillDetailModal handleSave untuk
 * satu baris baru (aplikasi menulis ulang semua baris hari itu; di sini cukup menambah satu, jadi
 * catatan orang lain di hari yang sama tidak tersentuh). Ringkasan hari (tamu_instansi, kebutuhan)
 * mengikuti Demo Product PERTAMA hari itu, sama dengan aplikasi.
 */
const piketCatat: Aksi = async (a, k) => {
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

export const AKSI_MENU_TULIS: Record<string, Aksi> = {
  tiket_buat: tiketBuat,
  tiket_setujui: tiketSetujui,
  desain_assign: desainAssign,
  desain_status: desainStatus,
  desain_tolak: desainTolak,
  desain_review_internal: desainReviewInternal,
  desain_ajukan_ulang: desainAjukanUlang,
  desain_pesan: desainPesan,
  catatan_buat: catatanBuat,
  catatan_review: catatanReview,
  unit_catat: unitCatat,
  unit_kembali: unitKembali,
  piket_catat: piketCatat,
};

