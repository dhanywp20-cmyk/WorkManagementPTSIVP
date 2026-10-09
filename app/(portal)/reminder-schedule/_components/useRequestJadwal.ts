'use client';

/** useRequestJadwal - dipecah dari app/(portal)/reminder-schedule/_components/useAlurPersetujuan.ts (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { type JadwalRequest } from './RequestJadwalModal';
import { supabase } from '@/lib/supabase';
import { setSession } from '@/lib/auth';
import { Reminder, TeamUser, GuestUser, formatDate, newBatchId, sendFonnteWA, DEFAULT_REQUEST_NOTE, fetchManagerTargets } from './shared';
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { adalahKategoriInsentif } from '@/lib/incentive-scheme';
import { triggersProjectProgress } from '@/lib/project-progress-sync';
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

    // Selalu fetch sales_division terbaru dari DB untuk menghindari data stale di localStorage
    // Ambil dari data modal dulu (paling fresh), lalu currentUser, lalu fetch DB
    let salesDivision = (data as any).sales_division || currentUser.sales_division || '';
    if (!salesDivision) {
      try {
        const { data: freshUser } = await supabase
          .from('users')
          .select('sales_division')
          .eq('id', currentUser.id)
          .single();
        if (freshUser?.sales_division) {
          salesDivision = freshUser.sales_division;
          // Update currentUser di state & localStorage agar sinkron
          const updatedUser = { ...currentUser, sales_division: salesDivision };
          setCurrentUser(updatedUser);
          setSession(updatedUser);
        }
      } catch { /* gunakan nilai kosong jika gagal */ }
    }

    // Multi-tanggal: request 1 kali untuk beberapa hari sekaligus (mis. tanggal 1, 2, 3)
    //  1 baris reminder per tanggal, semua status pending menunggu assign Admin.
    const allDates = Array.from(new Set([data.due_date, ...data.extra_dates].filter(Boolean))).sort();
    const usulanLine = allDates.length > 1
      ? `🕐 *Usulan (${allDates.length} hari):* ${allDates.map(d => formatDate(d)).join(', ')}${data.due_time ? ' · ' + data.due_time : ''}`
      : `🕐 Usulan: *${formatDate(data.due_date)}${data.due_time ? ' · ' + data.due_time : ''}*`;

    // Fase 2 routing: cek apakah requester Sales Internal atau External
    // External  wajib direview Sales Internal (division_ivp_mappings) dulu,
    // BARU Admin/Manager dapat notifikasi actionable. Internal (atau Marketing,
    // atau divisi tanpa mapping)  langsung ke Admin seperti alur lama - Sales
    // Internal & Marketing sering request utk kebutuhan mereka sendiri (project
    // direct ke user / kebutuhan internal), bukan lewat Sales External, jadi
    // TIDAK boleh kena gerbang review. team_type==='Marketing' dicek terpisah
    // dari is_internal_sales sebagai jaring pengaman kedua (independen dari
    // flag, kalau-kalau ada akun Marketing yang belum sempat di-backfill).
    let routingStatus: 'internal_review' | 'admin_review' = 'admin_review';
    let internalSalesId: string | null = null;
    let internalSalesId2: string | null = null;   // reviewer kedua (IVP) saat brand BOTH
    let internalHandlers: { id: string; phone_number: string | null; full_name: string }[] = [];
    const chosenBrand: Brand | null = (data.brand as Brand | undefined) ?? null;
    // Sales External (bukan internal/marketing): WAJIB pilih brand + ada PIC Sales
    // Internal utk brand itu. BOTH  2 reviewer (wajib keduanya approve). Kalau brand
    // belum di-mapping  BLOK submit. freshSelf dicek dulu supaya bisa blokir sebelum insert.
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
      const primary = res.mvi ?? res.ivp;          // reviewer utama (MVI kalau ada, else IVP)
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

    // SBU: kalau creator Sales Internal memilih Sales External di dropdown SBU,
    // schedule diatasnamakan Sales External tsb (nama + divisi). created_by tetap
    // username Sales Internal (jejak siapa yang membuat). Routing TIDAK berubah -
    // tetap admin_review karena pembuat = Sales Internal (spec kondisi 2).
    const sbuName = data.sbu_name?.trim();
    const effectiveSalesName = sbuName || currentUser.full_name;
    if (sbuName && data.sbu_division?.trim()) salesDivision = data.sbu_division.trim();
    // uuid pemilik jadwal, sejalan dengan effectiveSalesName di atas. Saat atas
    // nama Sales External, uuid-nya diambil langsung dari pilihan dropdown -
    // jadi tidak ada tebakan nama sama sekali. Fallback pencarian nama hanya
    // dipakai kalau dropdown-nya belum sempat mengirim id (data lama).
    const effectiveSalesUserId = sbuName
      ? (data.sbu_user_id ?? idDariNama(guestUsers, sbuName))
      : (currentUser.id ?? null);

    // Insert ke tabel reminders dengan status pending & assigned_to kosong
    // Admin nantinya assign ke team dari list yang ada
    const notesVal = data.notes
      ? `[REQUEST SALES] ${data.notes}`
      : `[REQUEST SALES] ${DEFAULT_REQUEST_NOTE}`;
    // Grup semua tanggal dari 1 submission - supaya Schedule List menampilkannya
    // sbg 1 baris (bukan N baris identik per tanggal).
    const batchId = allDates.length > 1 ? newBatchId() : null;

    /*
      Kalau request ini datang dari pencarian "Project Lama Anda"
      (proyekLamaTerpilih terisi), dan kategorinya sama-sama relevan untuk
      insentif, tandai langsung dari sini - bukan menunggu Lapis 2 mendeteksinya
      belakangan di Incentive PTS. Request Sales tidak lewat handleSave (admin),
      jadi resolusinya perlu diulang di sini; aturannya tetap sama:
      resolveGrupInsentif satu fungsi bersama, dipakai empat jalur sekarang
      (Lapis 1, Lapis 4-admin, Lapis 4-guest).
    */
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
      // Usulan rentang pengerjaan dari Sales. Hanya bermakna untuk kategori
      // pemicu; disimpan sekarang, dipakai nanti saat request di-assign.
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
      // assigned_to & assign_name dikosongkan - Admin yang assign
      assigned_to: '',
      assign_name: '',
      created_by: currentUser.username,
      routing_status: routingStatus,
      internal_sales_id: internalSalesId,
      // Kolom brand hanya ditulis kalau ada brand (Sales External) - supaya create
      // request internal/admin tetap jalan walau sql/brand-multi-internal.sql belum di-run.
      ...(chosenBrand ? { internal_sales_id_2: internalSalesId2, brand: chosenBrand } : {}),
    }));

    const { data: dibuat, error } = await cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
      .insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas)).select('id, project_name'));
    if (error) {
      notify('error', 'Gagal mengirim request: ' + error.message);
      return;
    }
    const d0 = payloads[0]?.due_date as string;

    // Pangkal riwayat: tanpa ini jejak sebuah request baru dimulai dari
    // "disetujui", dan pembacanya tidak pernah tahu siapa yang mengajukan.
    // user_name WAJIB pelaku sebenarnya - yang menekan tombol - bukan
    // effectiveSalesName. Saat Sales Internal mengajukan atas nama Sales
    // External (SBU), "atas nama" ditulis di notes, bukan menggantikan pelaku.
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

    // Kirim WA sesuai tahap routing
    try {
      // Termasuk pemegang Full Access (Manager PTS IVP), bukan hanya role
      // admin - lihat lib/penerima-admin.ts.
      const admins = await penerimaAdminBernomor();

      if (routingStatus === 'internal_review') {
        // 1) WA WAJIB ke Sales Internal - dia yang harus review dulu.
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
        // 2) WA ke Admin - PENGINGAT saja (belum bisa diproses, menunggu Sales Internal).
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
        // Alur lama: langsung actionable ke Admin/Manager (requester internal / tanpa mapping).
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
          // Manager (role='team') tidak ke-cover query role='admin' di atas - WA & badge terpisah,
          // dikirim BERSAMAAN dengan admin (bukan menyusul), sesuai jadi PENTING sama.
          for (const mgr of managerTargets) {
            if (mgr.phone_number) await sendFonnteWA(mgr.phone_number, msg, undefined, 'reminder.new_schedule');
          }
        }
        // Badge notifikasi in-app - supaya tidak perlu buka tabel utk tahu ada yg perlu approval.
        // createNotificationForAdmins sudah ikut meng-cover akun Full Access (lib/notifications.ts),
        // jadi di sini cukup tambahkan target dari app_settings.manager_user_id (kalau ada &
        // belum ke-cover) supaya tidak dobel - lihat fetchManagerTargets.
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
