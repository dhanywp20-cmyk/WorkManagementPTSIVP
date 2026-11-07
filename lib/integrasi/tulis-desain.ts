import { cobaIdentitas, tanpaIdentitas } from '@/lib/identitas';
import { appLink } from '@/lib/app-url';
import { akunTambahan, gagal, penerimaAdminServer, teks, type KonteksAksi } from '@/lib/integrasi/bantu';
import { adalahGalat, hakDesain, indeksRuangan, muatRequestDesain, namaRuangan, statusRuangan, type RequestDesain, type RuanganDesain } from '@/lib/integrasi/menu';

import { type Aksi, GARIS, type Orang, anggotaDitawarkan, daftarSupervisor, diriSendiri, cariOrang, contoh, kirimWA, audit } from '@/lib/integrasi/tulis-bersama';

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
async function kabarStatusProject(k: KonteksAksi, requesterId: string | null, r: RequestDesain, status: string) {
  if (!requesterId) return;
  const label: Record<string, string> = { approved: '✅ Disetujui', rejected: '❌ Ditolak', in_progress: '🔄 Sedang Diproses', completed: '🎉 Selesai' };
  await k.efek.inApp({ user_id: requesterId, type: 'project', title: `🏗️ ${r.project_name} — ${label[status] ?? status}`,
    body: `Status diperbarui oleh ${k.u.full_name}`, action_url: '/form-require-project', ref_id: r.id, created_by: k.u.full_name ?? '' });
}

export const desainAssign: Aksi = async (a, k) => {
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

export const desainStatus: Aksi = async (a, k) => {
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
  } catch {  }
  await audit(k, { action: 'status_change', module: 'project', target_id: r.id, target_name: r.project_name, old_value: lama ?? null, new_value: baru });
  return { ok: true, request: r.project_name, ruangan: namaRuangan(r, i), status_lama: lama, status_baru: baru, wa_terkirim: wa };
};

export const desainTolak: Aksi = async (a, k) => {
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
  } catch {  }
  await kabarStatusProject(k, r.requester_id, r, 'rejected');
  await audit(k, { action: 'reject', module: 'project', target_id: r.id, target_name: r.project_name, notes: alasan });
  return { ok: true, request: r.project_name, status_baru: 'rejected', wa_requester: wa };
};

export const desainReviewInternal: Aksi = async (a, k) => {
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
  } catch {  }
  return { ok: true, request: r.project_name, diteruskan_ke_admin: true, wa_terkirim: wa };
};

export const desainAjukanUlang: Aksi = async (a, k) => {
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
  } catch {  }
  return { ok: true, request: r.project_name, status_baru: 'pending', wa_terkirim: wa };
};

export const desainPesan: Aksi = async (a, k) => {
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
