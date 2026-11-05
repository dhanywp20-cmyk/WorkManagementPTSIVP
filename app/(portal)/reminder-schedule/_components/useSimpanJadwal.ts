'use client';

import { Reminder, TeamUser, GuestUser, newBatchId, sendFonnteWA, REMINDER_FIELDS } from './shared';
import { supabase } from '@/lib/supabase';
import { adalahKategoriInsentif } from '@/lib/incentive-scheme';
import { barisJadwalWA, galatIsianJadwal, pesanJadwalBaru, proyekSerupa } from '@/lib/jadwal-aturan';
import { buatJadwal, tandaiGrupInsentif } from '@/lib/jadwal-buat';
import { efekPeramban } from '@/lib/efek-peramban';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { type ReminderSnapshot } from '@/lib/project-progress-sync';
import { appLink } from '@/lib/app-url';
import { bandingkan, ringkasPerubahan, pesanWAPerubahan } from '@/lib/admin-edit';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export interface SimpanJadwalKonteks {
  bulkTarget: "none" | "ivp" | "mvi" | "ump";
  currentUser: TeamUser | null;
  editingReminder: Reminder | null;
  emptyForm: Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">;
  extraDates: string[];
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  formData: Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">;
  guestUsers: GuestUser[];
  notify: (type: "success" | "error", msg: string) => void;
  progressTimelinePayload: () => { progress_start_date: string | null; progress_target_date: string | null; };
  proyekLamaTerpilih: Reminder[] | null;
  reminders: Reminder[];
  setBulkTarget: import("react").Dispatch<import("react").SetStateAction<"none" | "ivp" | "mvi" | "ump">>;
  setEditingReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setExtraDates: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  setFormData: import("react").Dispatch<import("react").SetStateAction<Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">>>;
  setProyekLamaTerpilih: import("react").Dispatch<import("react").SetStateAction<Reminder[] | null>>;
  setSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setTanyaLanjutan: import("react").Dispatch<import("react").SetStateAction<{ nama: string; sebelumnya: Reminder[]; lanjut: (grup: string | null) => void; } | null>>;
  setView: import("react").Dispatch<import("react").SetStateAction<"list" | "form">>;
  syncNewRemindersToProgress: (rows: ReminderSnapshot[]) => Promise<void>;
  teamUsers: TeamUser[];
}

export function useSimpanJadwal(k: SimpanJadwalKonteks) {
  const { bulkTarget, currentUser, editingReminder, emptyForm, extraDates, fetchRemindersQuiet, formData, guestUsers, notify, progressTimelinePayload, proyekLamaTerpilih, reminders, setBulkTarget, setEditingReminder, setExtraDates, setFormData, setProyekLamaTerpilih, setSaving, setShowFormModal, setTanyaLanjutan, setView, syncNewRemindersToProgress, teamUsers } = k;
  const resolveGrupInsentif = async (sumber: Reminder[]): Promise<string> => {
    const { grup, sebagianGagal } = await tandaiGrupInsentif(supabase, sumber);
    if (sebagianGagal) {
      notify('error', 'Sebagian jadwal lama gagal ditandai satu proyek yang sama - periksa manual di Incentive PTS.');
    }
    return grup;
  };

  const cariProyekSerupa = (nama: string, kategori: string): Reminder[] => proyekSerupa(reminders, nama, kategori);

  const handleSave = async (argGrup?: string | null) => {
    const grupInsentif = (typeof argGrup === 'string' || argGrup === null) ? argGrup : undefined;

    const salahIsian = galatIsianJadwal(formData, bulkTarget === 'none');
    if (salahIsian) { notify('error', salahIsian); return; }

    const semuaOrang = [...guestUsers, ...teamUsers];
    const salesUserId = idDariNama(semuaOrang, formData.sales_name);

    if (!editingReminder && grupInsentif === undefined) {
      if (proyekLamaTerpilih) {
        const relevan = adalahKategoriInsentif(formData.category)
          ? proyekLamaTerpilih.filter(r => adalahKategoriInsentif(r.category))
          : [];
        const grup = relevan.length > 0 ? await resolveGrupInsentif([...relevan]) : null;
        void handleSave(grup);
        return;
      }
      const serupa = cariProyekSerupa(formData.project_name, formData.category);
      if (serupa.length > 0) {
        setTanyaLanjutan({
          nama: formData.project_name.trim(),
          sebelumnya: serupa,
          lanjut: (grup) => { setTanyaLanjutan(null); void handleSave(grup); },
        });
        return;
      }
    }

    const allDates: string[] = Array.from(
      new Set([formData.due_date, ...extraDates].filter(Boolean))).sort();
    const batchId = (!editingReminder && allDates.length > 1) ? newBatchId() : null;
    const jadwalLine = barisJadwalWA(allDates, formData.due_time);

    if (bulkTarget !== 'none') {
      const teamTypeMap: Record<string, string> = { ivp: 'Team PTS IVP', mvi: 'Team PTS MVI', ump: 'Team PTS UMP' };
      const bulkLabelMap: Record<string, string> = { ivp: 'PTS IVP', mvi: 'PTS MVI', ump: 'PTS UMP' };
      const targets = teamUsers.filter(u => u.team_type === teamTypeMap[bulkTarget] && u.jabatan !== 'Manager');
      if (targets.length === 0) { notify('error', 'Tidak ada anggota team yang ditemukan!'); return; }
      setSaving(true);
      const payloads = targets.flatMap(u => allDates.map(d => ({
        ...formData,
        due_date: d,
        ...progressTimelinePayload(),
        batch_id: batchId,
        assigned_to: u.username,
        assign_name: u.full_name,
        sales_user_id: salesUserId,
        assign_user_id: u.id,
        created_by: currentUser?.username ?? 'system',
        ...progressTimelinePayload(),
      })));
      const { data: bulkRows, error: bulkErr } = await cobaIdentitas(async pakaiUuid =>
        await supabase.from('reminders').insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas))
          .select('id, project_name, address, sales_name, sales_division, assign_name, due_date, category, progress_start_date, progress_target_date'));
      if (bulkErr) { notify('error', 'Gagal menyimpan: ' + bulkErr.message); setSaving(false); return; }
      void syncNewRemindersToProgress((bulkRows ?? []) as ReminderSnapshot[]);
      notify('success', `${payloads.length} reminder dibuat untuk Tim ${bulkLabelMap[bulkTarget]}${allDates.length > 1 ? ` (${allDates.length} hari)` : ''}!`);
      for (const u of targets) {
        if (u.phone_number) {
          const msg = pesanJadwalBaru(u.full_name, formData, jadwalLine, appLink());
          await sendFonnteWA(u.phone_number, msg, { reminderType: 'new_schedule' }, 'reminder.assigned');
        }
      }
      setSaving(false);
      setShowFormModal(false);
      setView('list');
      setEditingReminder(null);
      setFormData(emptyForm);
      setBulkTarget('none');
      setExtraDates([]);
      fetchRemindersQuiet();
      return;
    }

    const assignee = teamUsers.find(u => u.username === formData.assigned_to);

    setSaving(true);
    let error: { message: string } | null = null;
    const alihKeSupervisor = formData.assigned_to.startsWith('SUP::')
      ? formData.assigned_to.split('::')
      : null;

    if (!editingReminder) {
      const hasil = await buatJadwal(supabase, efekPeramban, {
        isian: formData, tanggal: allDates, timeline: progressTimelinePayload(), grupInsentif,
        pelaksana: assignee, alihKeSupervisor,
        supervisor: alihKeSupervisor ? teamUsers.find(u => u.id === alihKeSupervisor[1]) : null,
        salesUserId, pelaku: currentUser,
        sinkronProgress: async rows => { void syncNewRemindersToProgress(rows); },
        lapor: { tersimpan: n => notify('success', n > 1 ? `${n} reminder dibuat!` : 'Reminder ditambahkan!') },
      });
      if (!hasil.ok) { notify('error', hasil.galat); setSaving(false); return; }
      if (hasil.waPelaksana?.ok) notify('success', `WA notifikasi terkirim ke ${hasil.waPelaksana.nama}!`);
      setSaving(false);
      setShowFormModal(false);
      setView('list');
      setEditingReminder(null);
      setFormData(emptyForm);
      setExtraDates([]);
      setProyekLamaTerpilih(null);
      fetchRemindersQuiet();
      return;
    }

    if (editingReminder) {
      const namaSalesTetap = (formData.sales_name ?? '').trim() === (editingReminder.sales_name ?? '').trim();
      const payload = { ...formData, ...progressTimelinePayload(),
        assign_name: assignee?.full_name ?? formData.assigned_to,
        sales_user_id: namaSalesTetap ? (editingReminder.sales_user_id ?? salesUserId) : salesUserId,
        assign_user_id: assignee?.id ?? null,
        created_by: editingReminder.created_by ?? currentUser?.username ?? 'system',
        updated_at: new Date().toISOString() };
      if (alihKeSupervisor) {
        const [, supId] = alihKeSupervisor;
        Object.assign(payload, {
          assigned_to: '', assign_name: '', assign_user_id: null,
          routing_status: 'supervisor_assign', assigned_supervisor_id: supId,
        });
      }
      const sebatchLama = editingReminder.batch_id
        ? reminders.filter(x => x.batch_id === editingReminder.batch_id)
        : [editingReminder];
      const barisLama = [...sebatchLama].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
      const { due_date: _tanggalBersama, ...payloadBersama } = payload as Record<string, unknown>;

      const batchSunting = allDates.length > 1
        ? (editingReminder.batch_id ?? newBatchId())
        : editingReminder.batch_id ?? null;

      const jumlahDipakai = Math.min(barisLama.length, allDates.length);
      const galatSunting: string[] = [];
      for (let i = 0; i < jumlahDipakai; i++) {
        const r = await cobaIdentitas(async pakaiUuid => {
          const isi = { ...payloadBersama, due_date: allDates[i], batch_id: batchSunting };
          return await supabase.from('reminders')
            .update(pakaiUuid ? isi : tanpaIdentitas(isi as typeof payload))
            .eq('id', barisLama[i].id);
        });
        if (r.error) galatSunting.push(r.error.message);
      }
      const dibuang = barisLama.slice(jumlahDipakai).map(r => r.id);
      if (dibuang.length > 0) {
        const r = await supabase.from('reminders').delete().in('id', dibuang).select('id');
        if (r.error) galatSunting.push(r.error.message);
        else if ((r.data ?? []).length < dibuang.length) {
          galatSunting.push(`${dibuang.length - (r.data ?? []).length} jadwal lama gagal dihapus (tidak punya akses).`);
        }
      }
      if (allDates.length > barisLama.length) {
        const tambahan = allDates.slice(barisLama.length).map(d => ({
          ...payloadBersama, due_date: d, batch_id: batchSunting,
        }));
        const r = await cobaIdentitas(async pakaiUuid =>
          await supabase.from('reminders')
            .insert((pakaiUuid ? tambahan : tambahan.map(x => tanpaIdentitas(x as typeof payload))) as typeof tambahan));
        if (r.error) galatSunting.push(r.error.message);
      }
      error = galatSunting.length > 0 ? { message: galatSunting[0] } : null;
    }

    if (error) {
      notify('error', 'Gagal menyimpan: ' + error.message);
      setSaving(false);
      return;
    }

    if (editingReminder) {
      const bandingkanDengan = { ...(formData as unknown as Record<string, unknown>) };
      if (alihKeSupervisor) delete bandingkanDengan.assigned_to;
      const perubahanEdit = bandingkan(
        REMINDER_FIELDS,
        editingReminder as unknown as Record<string, unknown>,
        bandingkanDengan,
      );
      logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'update', module: 'reminder',
        target_id: editingReminder.id, target_name: formData.project_name,
        notes: alihKeSupervisor
          ? `Re-route ke Supervisor ${alihKeSupervisor[2]}${perubahanEdit.length ? ' | ' + ringkasPerubahan(perubahanEdit) : ''}`
          : (perubahanEdit.length ? ringkasPerubahan(perubahanEdit) : 'Disimpan tanpa perubahan'),
      }).catch(() => {});

      if (alihKeSupervisor) {
        const supUser = teamUsers.find(u => u.id === alihKeSupervisor[1]);
        if (supUser?.phone_number) {
          void sendFonnteWA(supUser.phone_number, pesanWAPerubahan({
            namaPenerima: supUser.full_name,
            namaPengubah: currentUser?.full_name ?? 'Admin',
            judulItem: formData.project_name,
            jenisItem: 'Jadwal',
            perubahan: perubahanEdit,
            reroute: { dari: editingReminder.assign_name ?? '', ke: supUser.full_name },
            tautan: appLink('/reminder-schedule'),
          }), undefined, 'reminder.updated');
        }
        if (supUser?.id) {
          void createNotification({
            user_id: supUser.id, type: 'reminder',
            title: '🔀 Jadwal dialihkan ke kamu',
            body: `${formData.project_name} — pilih anggota tim yang mengerjakan`,
            action_url: '/reminder-schedule', ref_id: editingReminder.id,
            created_by: currentUser?.full_name ?? 'Admin',
          });
        }
      }

      if (perubahanEdit.length > 0 && assignee?.id) {
        if (assignee.full_name === currentUser?.full_name) {
          void createNotification({
            user_id: assignee.id, type: 'reminder',
            title: '✏️ Jadwal kamu diperbarui',
            body: `${formData.project_name}`,
            action_url: '/reminder-schedule', ref_id: editingReminder.id,
            created_by: currentUser?.full_name ?? 'Admin',
          });
        } else if (assignee.phone_number) {
          void sendFonnteWA(
            assignee.phone_number,
            pesanWAPerubahan({
              namaPenerima: assignee.full_name ?? formData.assigned_to,
              namaPengubah: currentUser?.full_name ?? 'Admin',
              judulItem: formData.project_name,
              jenisItem: 'Jadwal',
              perubahan: perubahanEdit,
              reroute: null,
              tautan: appLink('/reminder-schedule'),
            }),
            undefined, 'reminder.updated',
          );
        }
      }
    }
    notify('success', 'Reminder diperbarui!');

    setSaving(false);
    setShowFormModal(false);
    setView('list');
    setEditingReminder(null);
    setFormData(emptyForm);
    setExtraDates([]);
    setProyekLamaTerpilih(null);
    fetchRemindersQuiet();
  };
  return { resolveGrupInsentif, cariProyekSerupa, handleSave };
}
