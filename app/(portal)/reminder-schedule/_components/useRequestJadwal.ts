'use client';

import { type JadwalRequest } from './RequestJadwalModal';
import { supabase } from '@/lib/supabase';
import { setSession } from '@/lib/auth/sesi';
import { Reminder, TeamUser, GuestUser, formatDate, newBatchId, sendFonnteWA, DEFAULT_REQUEST_NOTE, fetchManagerTargets } from './shared';
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { adalahKategoriInsentif } from '@/lib/incentive/scheme';
import { triggersProjectProgress } from '@/lib/checklist/sinkron-progress';
import { logAudit } from '@/lib/audit';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { appLink } from '@/lib/app-url';
import { createNotification, createNotificationForAdmins } from '@/lib/notifications';

export interface RequestJadwalKonteks {
  currentUser: TeamUser | null;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  guestUsers: GuestUser[];
  notify: (type: "success" | "error", msg: string) => void;
  proyekLamaTerpilih: Reminder[] | null;
  resolveGrupInsentif: (sumber: Reminder[]) => Promise<string>;
  setCurrentUser: import("react").Dispatch<import("react").SetStateAction<TeamUser | null>>;
  setProyekLamaTerpilih: import("react").Dispatch<import("react").SetStateAction<Reminder[] | null>>;
  setShowRequestModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function useRequestJadwal(k: RequestJadwalKonteks) {
  const { currentUser, fetchRemindersQuiet, guestUsers, notify, proyekLamaTerpilih, resolveGrupInsentif, setCurrentUser, setProyekLamaTerpilih, setShowRequestModal } = k;
  const handleRequestJadwal = async (data: JadwalRequest) => {
    if (!currentUser) return;

    let salesDivision = (data).sales_division || currentUser.sales_division || '';
    if (!salesDivision) {
      try {
        const { data: freshUser } = await supabase
          .from('users')
          .select('sales_division')
          .eq('id', currentUser.id)
          .single();
        if (freshUser?.sales_division) {
          salesDivision = freshUser.sales_division;
          const updatedUser = { ...currentUser, sales_division: salesDivision };
          setCurrentUser(updatedUser);
          setSession(updatedUser);
        }
      } catch {  }
    }

    const allDates = Array.from(new Set([data.due_date, ...data.extra_dates].filter(Boolean))).sort();
    const usulanLine = allDates.length > 1
      ? `🕐 *Usulan (${allDates.length} hari):* ${allDates.map(d => formatDate(d)).join(', ')}${data.due_time ? ' · ' + data.due_time : ''}`
      : `🕐 Usulan: *${formatDate(data.due_date)}${data.due_time ? ' · ' + data.due_time : ''}*`;

    let routingStatus: 'internal_review' | 'admin_review' = 'admin_review';
    let internalSalesId: string | null = null;
    let internalSalesId2: string | null = null;
    let internalHandlers: { id: string; phone_number: string | null; full_name: string }[] = [];
    const chosenBrand: Brand | null = (data.brand as Brand | undefined) ?? null;
    const { data: freshSelf } = await supabase.from('users').select('is_internal_sales, team_type').eq('id', currentUser.id).maybeSingle();
    const isInternalOrMarketing = !!freshSelf?.is_internal_sales || freshSelf?.team_type === 'Marketing';
    if (!isInternalOrMarketing && salesDivision) {
      const brand: Brand = chosenBrand ?? 'MVI';
      const res = await resolveBrandInternals(salesDivision, brand);
      if (res.missing.length > 0) {
        notify('error', `Divisi ${salesDivision} belum punya PIC Sales Internal untuk brand: ${res.missing.join(' & ')}. Hubungi Admin untuk mapping dulu.`);
        return;
      }
      routingStatus = 'internal_review';
      const primary = res.mvi ?? res.ivp;
      internalSalesId = primary?.id ?? null;
      if (brand === 'BOTH' && res.mvi && res.ivp && res.mvi.id !== res.ivp.id) internalSalesId2 = res.ivp.id;
      const uniq = new Map<string, { id: string; phone_number: string | null; full_name: string }>();
      [res.mvi, res.ivp].forEach(h => { if (h && !uniq.has(h.id)) uniq.set(h.id, { id: h.id, phone_number: h.phone_number, full_name: h.full_name }); });
      internalHandlers = Array.from(uniq.values());
      if (!internalSalesId) {
        notify('error', `Divisi ${salesDivision} belum memiliki PIC Sales Internal. Hubungi Admin untuk mapping divisi ini sebelum request.`);
        return;
      }
    }

    const sbuName = data.sbu_name?.trim();
    const effectiveSalesName = sbuName || currentUser.full_name;
    if (sbuName && data.sbu_division?.trim()) salesDivision = data.sbu_division.trim();
    const effectiveSalesUserId = sbuName
      ? (data.sbu_user_id ?? idDariNama(guestUsers, sbuName))
      : (currentUser.id ?? null);

    const notesVal = data.notes
      ? `[REQUEST SALES] ${data.notes}`
      : `[REQUEST SALES] ${DEFAULT_REQUEST_NOTE}`;
    const batchId = allDates.length > 1 ? newBatchId() : null;

    const relevanGuest = proyekLamaTerpilih && adalahKategoriInsentif(data.category)
      ? proyekLamaTerpilih.filter(r => adalahKategoriInsentif(r.category))
      : [];
    const grupInsentifGuest = relevanGuest.length > 0 ? await resolveGrupInsentif([...relevanGuest]) : null;

    const payloads = allDates.map(d => ({
      project_name: data.project_name,
      description: data.description,
      address: data.address,
      category: data.category,
      ...(grupInsentifGuest ? { incentive_group_id: grupInsentifGuest } : {}),
      product_type: data.product_type,
      due_date: d,
      ...(triggersProjectProgress(data.category) ? {
        progress_start_date:  data.progress_start_date  || null,
        progress_target_date: data.progress_target_date || null,
      } : {}),
      batch_id: batchId,
      due_time: data.due_time,
      sales_name: effectiveSalesName,
      sales_user_id: effectiveSalesUserId,
      sales_division: salesDivision,
      pic_name: data.pic_name,
      pic_phone: data.pic_phone,
      product: data.product,
      notes: notesVal,
      priority: 'medium' as const,
      status: 'pending' as const,
      repeat: 'none' as const,
      assigned_to: '',
      assign_name: '',
      created_by: currentUser.username,
      routing_status: routingStatus,
      internal_sales_id: internalSalesId,
      ...(chosenBrand ? { internal_sales_id_2: internalSalesId2, brand: chosenBrand } : {}),
    }));

    const { data: dibuat, error } = await cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
      .insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas)).select('id, project_name'));
    if (error) {
      notify('error', 'Gagal mengirim request: ' + error.message);
      return;
    }
    const d0 = payloads[0]?.due_date as string;

    const atasNamaLain = effectiveSalesName && effectiveSalesName !== currentUser.full_name;
    for (const row of (dibuat ?? []) as { id: string; project_name: string | null }[]) {
      logAudit({
        user_id: currentUser.id, user_name: currentUser.full_name,
        action: 'create', module: 'reminder',
        target_id: row.id, target_name: row.project_name ?? data.project_name,
        notes: (atasNamaLain ? `Diinput atas nama Sales ${effectiveSalesName}` : 'Request diajukan Sales')
          + `${salesDivision ? ` (${salesDivision})` : ''} — kategori ${data.category}, usulan ${formatDate(d0)}`,
      }).catch(() => {});
    }

    notify('success', routingStatus === 'internal_review'
      ? `Request dikirim! Menunggu review ${internalHandlers[0]?.full_name ?? 'Sales Internal'} terlebih dahulu.`
      : (allDates.length > 1 ? `${allDates.length} request jadwal berhasil dikirim! Menunggu approval Admin.` : 'Request jadwal berhasil dikirim! Menunggu approval Admin.'));
    setShowRequestModal(false);
    setProyekLamaTerpilih(null);
    fetchRemindersQuiet();

    try {
      const admins = await penerimaAdminBernomor();

      if (routingStatus === 'internal_review') {
        const internalMsg =
          `📩 *REQUEST JADWAL BARU — PERLU REVIEW KAMU*\n\n` +
          `Sales External *${currentUser.full_name}* (${salesDivision}) mengajukan request jadwal:\n\n` +
          `📋 *Project: ${data.project_name}*\n` +
          `🏷️ Kategori: ${data.category}\n` +
          `📦 Product: ${data.product || '-'}\n` +
          `📍 Lokasi: ${data.address}\n` +
          `${usulanLine}\n` +
          (data.description ? `📝 Deskripsi: ${data.description}\n` : '') +
          `\nSilakan review & teruskan ke Admin:\n` +
          `🔗 ${appLink()}`;
        for (const h of internalHandlers) {
          if (h.phone_number) await sendFonnteWA(h.phone_number, internalMsg, undefined, 'reminder.new_schedule');
          createNotification({
            user_id: h.id,
            type: 'reminder',
            title: `📩 Request jadwal perlu review kamu`,
            body: `${currentUser.full_name} (${salesDivision}) — ${data.project_name}`,
            action_url: '/reminder-schedule',
            ref_id: dibuat?.[0]?.id,
            created_by: currentUser.full_name,
          }).catch(() => {});
        }
        if (admins && admins.length > 0) {
          const adminHeadsUp =
            `ℹ️ *ADA REQUEST JADWAL BARU (pengingat)*\n\n` +
            `Sales External *${currentUser.full_name}* mengajukan request untuk *${data.project_name}*.\n` +
            `Sedang menunggu review dari Sales Internal *${internalHandlers[0]?.full_name ?? '-'}* sebelum bisa diproses Admin.`;
          for (const admin of admins) {
            if (admin.phone_number) await sendFonnteWA(admin.phone_number, adminHeadsUp, undefined, 'reminder.new_schedule');
          }
        }
      } else {
        const managerTargets = await fetchManagerTargets();
        if ((admins && admins.length > 0) || managerTargets.length > 0) {
          const msg =
            `📩 *REQUEST JADWAL BARU — PTS IVP*\n\n` +
            `Sales *${currentUser.full_name}* mengajukan request jadwal:\n\n` +
            `📋 *Project: ${data.project_name}*\n` +
            `🏷️ Kategori: ${data.category}\n` +
            `📦 Product: ${data.product || '-'}\n` +
            `📍 Lokasi: ${data.address}\n` +
            `${usulanLine}\n` +
            (data.description ? `📝 Deskripsi: ${data.description}\n` : '') +
            (data.pic_name ? `🙋 PIC: ${data.pic_name}${data.pic_phone ? ' - ' + data.pic_phone : ''}\n` : '') +
            `\nSilakan review & assign ke Team PTS IVP:\n` +
            `🔗 ${appLink()}`;
          for (const admin of (admins ?? [])) {
            if (admin.phone_number) await sendFonnteWA(admin.phone_number, msg, undefined, 'reminder.new_schedule');
          }
          for (const mgr of managerTargets) {
            if (mgr.phone_number) await sendFonnteWA(mgr.phone_number, msg, undefined, 'reminder.new_schedule');
          }
        }
        createNotificationForAdmins({
          type: 'reminder',
          title: `📩 Request jadwal baru menunggu approval`,
          body: `${currentUser.full_name} — ${data.project_name}`,
          action_url: '/reminder-schedule',
          ref_id: dibuat?.[0]?.id,
          created_by: currentUser.full_name,
        }).catch(() => {});
        for (const mgr of managerTargets) {
          createNotification({
            user_id: mgr.id,
            type: 'reminder',
            title: `📩 Request jadwal baru menunggu approval kamu`,
            body: `${currentUser.full_name} — ${data.project_name}`,
            action_url: '/reminder-schedule',
            ref_id: dibuat?.[0]?.id,
            created_by: currentUser.full_name,
          }).catch(() => {});
        }
      }
    } catch { }
  };
  return { handleRequestJadwal };
}
