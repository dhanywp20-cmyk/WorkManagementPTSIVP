import { hasFullAccess } from '@/lib/constants';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { cobaIdentitas, idDariNama, tanpaIdentitas } from '@/lib/identitas';
import { appLink } from '@/lib/app-url';
import type { NotifPayload } from '@/lib/notifications';
import { gagal, hariIniWIB, idSah, peranDari, penerimaAdminServer, teks, tglSah } from '@/lib/integrasi/bantu';
import { adalahGalat } from '@/lib/integrasi/menu';

import { type Aksi, GARIS, type Orang, anggotaDitawarkan, daftarSupervisor, diriSendiri, cariOrang, contoh, kirimWA, audit, targetCC } from '@/lib/integrasi/tulis-bersama';

export const tiketBuat: Aksi = async (a, k) => {
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
    } catch {  }
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

export const tiketSetujui: Aksi = async (a, k) => {
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
