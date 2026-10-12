'use client';

/** useAksiJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Reminder, TeamUser, PRIORITY_CONFIG, STATUS_CONFIG, formatDate, sendFonnteWA } from './shared';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { appLink } from '@/lib/app-url';
import { URL_XLSX } from '@/lib/xlsx-loader';

export interface AksiJadwalKonteks {
  currentUser: TeamUser | null;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  filteredReminders: Reminder[];
  notify: (type: "success" | "error", msg: string) => void;
  reminders: Reminder[];
  rescheduleTarget: Reminder | null;
  setDetailReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setEditingReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setExtraDates: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  setFormData: import("react").Dispatch<import("react").SetStateAction<Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">>>;
  setRescheduleTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setSendingWA: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setShowFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function useAksiJadwal(k: AksiJadwalKonteks) {
  const { currentUser, fetchRemindersQuiet, filteredReminders, notify, reminders, rescheduleTarget, setDetailReminder, setEditingReminder, setExtraDates, setFormData, setRescheduleTarget, setSendingWA, setShowFormModal } = k;
  const openEdit = (r: Reminder) => {
    setEditingReminder(r);
    /*
      Tanggal sebatch ikut dimuat ke pemilih multi-tanggal.

      Jadwal 5 hari tersimpan sebagai lima baris ber-batch_id sama. Dulu form
      sunting hanya membawa tanggal baris yang diklik, jadi jadwal lima hari
      tampil seolah sehari - dan menyimpannya diam-diam meninggalkan empat
      baris lain dengan data lama. Yang tampil sekarang seluruh rentangnya,
      dan tanggalnya memang bisa ditambah atau dikurangi dari sini.
    */
    const sebatch = r.batch_id ? reminders.filter(x => x.batch_id === r.batch_id) : [r];
    const tanggal = Array.from(new Set(sebatch.map(x => x.due_date).filter(Boolean))).sort();
    setExtraDates(tanggal.slice(1));
    setFormData({ project_name: r.project_name || (r as any).title || '', description: r.description, assigned_to: r.assigned_to, assign_name: r.assign_name ?? '',
      // Tanggal utama = yang PALING AWAL di batch, bukan baris yang kebetulan
      // diklik - supaya rentangnya terbaca urut di pemilih tanggal.
      due_date: (r.batch_id
        ? [...new Set(reminders.filter(x => x.batch_id === r.batch_id).map(x => x.due_date).filter(Boolean))].sort()[0]
        : r.due_date) || r.due_date,
      due_time: r.due_time, priority: r.priority, status: r.status, repeat: r.repeat, category: r.category,
      sales_name: r.sales_name ?? '', sales_division: r.sales_division ?? '', address: r.address ?? '',
      /*
        brand DULU tidak ikut dimuat, jadi tiap kali jadwal disunting pilihan
        Brand kembali kosong - dan karena ia wajib, penyunting terpaksa
        memilihnya lagi dari ingatan. Salah pilih di situ memindahkan proyeknya
        ke petugas Finance yang lain.
      */
      brand: r.brand ?? undefined,
      pic_name: r.pic_name ?? '', pic_phone: r.pic_phone ?? '', notes: r.notes ?? '', product: r.product ?? '',
      warranty_years: r.warranty_years ?? null, mode_penyelesaian: r.mode_penyelesaian ?? null,
      installer_name: r.installer_name ?? null, installer_daerah: r.installer_daerah ?? null,
      requires_controller_automation: r.requires_controller_automation ?? false,
      controller_automation_brand: r.controller_automation_brand ?? null,
      pic_type: r.pic_type ?? 'standard', pic_id: r.pic_id ?? null,
      incentive_value: r.incentive_value ?? 0, bast_date: r.bast_date ?? null,
      // Tiga field ini PUNYA input di form, tapi dulu tidak pernah dimuat saat
      // menyunting: rentang pengerjaan tampil kosong padahal terisi, dan tipe
      // produk harus dipilih ulang hanya untuk lolos validasi simpan. Catatan
      // auditnya pun ikut salah - lihat komentar di lib/admin-edit.ts.
      progress_start_date: r.progress_start_date ?? '',
      progress_target_date: r.progress_target_date ?? '',
      product_type: r.product_type ?? '',
    });
    setDetailReminder(null);
    setShowFormModal(true);
  };

  // Re-Schedule

  const handleReschedule = async (newDate: string, newTime: string, reason: string) => {
    if (!rescheduleTarget) return;
    const noteAdd = reason ? `\n[Re-Schedule ${formatDate(newDate)}: ${reason}]` : '';
    const { error } = await supabase.from('reminders').update({
      due_date: newDate,
      due_time: newTime,
      updated_at: new Date().toISOString(),
      notes: (rescheduleTarget.notes ?? '') + noteAdd,
    }).eq('id', rescheduleTarget.id);
    if (error) {
      notify('error', `Gagal re-schedule: ${error.message}`);
      return;
    }
    logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'update', module: 'reminder',
      target_id: rescheduleTarget!.id, target_name: rescheduleTarget!.project_name,
      old_value: `${formatDate(rescheduleTarget!.due_date)} ${rescheduleTarget!.due_time ?? ''}`.trim(),
      new_value: `${formatDate(newDate)} ${newTime}`.trim(),
      notes: reason ? `Re-schedule: ${reason}` : 'Re-schedule',
    }).catch(() => {});
    notify('success', `Jadwal berhasil dipindah ke ${formatDate(newDate)}!`);
    // WA ke handler tentang reschedule
    try {
      const { data: handlerUser } = await supabase
        .from('users').select('phone_number, full_name')
        .eq('username', rescheduleTarget.assigned_to)
        .maybeSingle();
      if (handlerUser?.phone_number) {
        const msg =
          `📅 *JADWAL DIUBAH*\n\n` +
          `Halo *${handlerUser.full_name}*, jadwal kamu telah di-reschedule:\n\n` +
          `*Project: ${rescheduleTarget.project_name}*\n` +
          `*Kategori: ${rescheduleTarget.category}*\n` +
          `📦 *Product: ${rescheduleTarget.product ?? '-'}*\n` +
          `📌 Jadwal Lama: ${formatDate(rescheduleTarget.due_date)} ${rescheduleTarget.due_time}\n` +
          `📅 Jadwal Baru: *${formatDate(newDate)} ${newTime}*\n` +
          (rescheduleTarget.pic_name ? `🙋 PIC: ${rescheduleTarget.pic_name}\n` : '') +
          (rescheduleTarget.pic_phone ? `📱 No. PIC: ${rescheduleTarget.pic_phone}\n` : '') +
          (rescheduleTarget.notes ? `📝 Catatan: ${rescheduleTarget.notes}\n` : '') +
          (reason ? `📝 Alasan: ${reason}\n` : '') +
          `\n🔗 ${appLink()}`;
        await sendFonnteWA(handlerUser.phone_number, msg, undefined, 'reminder.rescheduled');
      }
    } catch { }
    setRescheduleTarget(null);
    setDetailReminder(null);
    fetchRemindersQuiet();
  };

  // Manual WA send

  const handleSendWA = async (r: Reminder) => {
    if (!r.assigned_to) { notify('error', 'Reminder belum di-assign ke handler.'); return; }
    setSendingWA(r.id);

    // Ambil phone_number handler dari tabel users. JANGAN filter team_type:
    // handler bisa dari Team PTS IVP/UMP/MVI mana pun, dan menyaring ke satu
    // tim membuat tombol ini selalu gagal untuk handler tim lain.
    const { data: handlerData, error: handlerErr } = await supabase
      .from('users')
      .select('phone_number, full_name')
      .eq('username', r.assigned_to)
      .maybeSingle();

    if (handlerErr || !handlerData?.phone_number) {
      setSendingWA(null);
      notify('error', `Nomor WA handler (${r.assign_name || r.assigned_to}) tidak tersedia di database.`);
      return;
    }

    const msg =
      `📋 *REMINDER JADWAL*\n\n` +
      `Halo *${handlerData.full_name}*, ada jadwal yang perlu kamu kerjakan:\n\n` +
      `*Nama Project: ${r.project_name}*\n` +
      `*Deskripsi: ${r.description}*\n` +
      `*Kategori: ${r.category}*\n` +
      `📦 *Product: ${r.product ?? '-'}*\n` +
      `📍 Lokasi: ${r.address || '-'}\n` +
      `👤 Sales: ${r.sales_name || '-'}\n` +
      `    Divisi Sales: ${r.sales_division || '-'}\n` +
      `🕐 Jadwal: *${formatDate(r.due_date)} · ${r.due_time}*\n` +
      (r.pic_name ? `🙋 PIC: ${r.pic_name}\n` : '') +
      (r.pic_phone ? `📱 No. PIC: ${r.pic_phone}\n` : '') +
      (r.notes ? `📝 Catatan: ${r.notes}\n` : '') +
      `\n_Pesan dari Request Schedule PTS IVP_`;

    const result = await sendFonnteWA(handlerData.phone_number, msg, { reminderType: 'manual', reminderId: r.id }, 'reminder.new_schedule');
    setSendingWA(null);
    if (result.ok) notify('success', `WA berhasil dikirim ke ${handlerData.full_name}!`);
    else notify('error', `Gagal kirim WA: ${result.reason ?? 'Unknown error'}`);
  };

  // Export Excel

  const handleExportExcel = () => {
    const runExport = (XLSX: any) => {
      const exportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      const border = { top:{style:'thin',color:{rgb:'E2E8F0'}},bottom:{style:'thin',color:{rgb:'E2E8F0'}},left:{style:'thin',color:{rgb:'E2E8F0'}},right:{style:'thin',color:{rgb:'E2E8F0'}} };
      const boldBorder = { top:{style:'thin',color:{rgb:'000000'}},bottom:{style:'thin',color:{rgb:'000000'}},left:{style:'thin',color:{rgb:'000000'}},right:{style:'thin',color:{rgb:'000000'}} };
      const hdr = { font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'0E7490'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border: boldBorder };
      const cell = (v: any) => ({ v: v ?? '', t: 's', s: { font:{name:'Arial',sz:10}, alignment:{vertical:'center',wrapText:true}, border } });
      const titleStyle = { font:{name:'Arial',bold:true,sz:14,color:{rgb:'0E7490'}}, alignment:{horizontal:'left',vertical:'center'} };
      const COLS = 14;
      const data: any[][] = [
        [{ v:'\uD83D\uDDD3\uFE0F Request Schedule \u2014 PTS IVP', t:'s', s:titleStyle }, ...Array(COLS-1).fill({v:'',t:'s',s:{}})],
        [{ v:`Tanggal Export: ${exportDate} | Total: ${filteredReminders.length} data`, t:'s', s:{font:{name:'Arial',sz:10,color:{rgb:'6B7280'}}} }, ...Array(COLS-1).fill({v:'',t:'s',s:{}})],
        Array(COLS).fill({v:'',t:'s',s:{}}),
        ['No','Project','Product','Kategori','Sales','Divisi','Assign To','Status','Prioritas','Tanggal','Waktu','PIC','Telepon PIC','Catatan'].map(h=>({v:h,t:'s',s:hdr})),
        ...filteredReminders.map((r,i) => {
          const status = STATUS_CONFIG[r.status];
          const statusCell = { v: status.label, t:'s', s:{ font:{name:'Arial',sz:10,bold:true}, fill:{fgColor:{rgb: r.status==='done'?'DCFCE7':r.status==='cancelled'?'F3F4F6':'FEF3C7'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center'}, border } };
          return [
            {v:i+1, t:'n', s:{font:{name:'Arial',sz:10},alignment:{horizontal:'center',vertical:'center'},border}},
            cell(r.project_name), cell(r.product), cell(r.category),
            cell(r.sales_name), cell(r.sales_division), cell(r.assign_name),
            statusCell,
            cell(PRIORITY_CONFIG[r.priority].label),
            cell(r.due_date), cell(r.due_time ?? '-'), cell(r.pic_name ?? '-'),
            cell(r.pic_phone ?? '-'), cell(r.notes ?? '-'),
          ];
        }),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:COLS-1} }, { s:{r:1,c:0}, e:{r:1,c:COLS-1} }];
      ws['!cols'] = [5,28,18,16,20,12,20,14,12,12,10,20,16,30].map(w=>({wch:w}));
      ws['!rows'] = [{hpt:28},{hpt:16},{hpt:6},{hpt:26}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '\uD83D\uDDD3\uFE0F Request Schedule');
      XLSX.writeFile(wb, `ReminderSchedule_PTS_${new Date().toISOString().split('T')[0]}.xlsx`, { bookType:'xlsx', type:'binary', cellStyles:true });
      notify('success', 'Export Excel berhasil!');
    };
    if ((window as any).XLSX) runExport((window as any).XLSX);
    else {
      const s = document.createElement('script');
      s.src = URL_XLSX;
      s.onload = () => runExport((window as any).XLSX);
      s.onerror = () => notify('error', 'Gagal memuat library Excel.');
      document.head.appendChild(s);
    }
  };
  return { openEdit, handleReschedule, handleSendWA, handleExportExcel };
}
