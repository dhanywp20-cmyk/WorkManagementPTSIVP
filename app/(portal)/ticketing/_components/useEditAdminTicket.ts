'use client';

/** useEditAdminTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { sendWANotif, User, TeamMember, Ticket, TICKET_ADMIN_FIELDS } from './shared';
import { bandingkan, ringkasPerubahan, pesanWAPerubahan } from '@/lib/admin-edit';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { appLink } from '@/lib/app-url';

export interface EditAdminTicketKonteks {
  adminEditForm: Record<string, unknown>;
  adminEditTicket: Ticket | null;
  adminRerouteTo: string;
  currentUser: User | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  setAdminEditForm: import("react").Dispatch<import("react").SetStateAction<Record<string, unknown>>>;
  setAdminEditSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setAdminEditTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setAdminRerouteTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  teamMembers: TeamMember[];
}

export function useEditAdminTicket(k: EditAdminTicketKonteks) {
  const { adminEditForm, adminEditTicket, adminRerouteTo, currentUser, fetchData, notify, setAdminEditForm, setAdminEditSaving, setAdminEditTicket, setAdminRerouteTo, teamMembers } = k;
  const bukaAdminEdit = (t: Ticket) => {
    const isi: Record<string, unknown> = {};
    for (const f of TICKET_ADMIN_FIELDS) isi[f.key] = (t as unknown as Record<string, unknown>)[f.key] ?? '';
    setAdminEditForm(isi);
    setAdminRerouteTo('');
    setAdminEditTicket(t);
  };

  /**
   * Simpan perubahan admin: koreksi field dan/atau pengalihan pekerjaan.
   *
   * Urutannya disengaja - simpan dulu, baru beri tahu. Kalau WA dikirim
   * duluan lalu penyimpanannya gagal, orang sudah terlanjur diberi tahu soal
   * perubahan yang tidak pernah terjadi.
   */
  const simpanAdminEdit = async () => {
    if (!adminEditTicket) return;
    const t = adminEditTicket;
    const lama = t as unknown as Record<string, unknown>;
    const perubahan = bandingkan(TICKET_ADMIN_FIELDS, lama, adminEditForm);
    const adaReroute = adminRerouteTo !== '';

    if (perubahan.length === 0 && !adaReroute) { notify('error', 'Tidak ada yang diubah.'); return; }

    setAdminEditSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const x of perubahan) payload[x.key] = adminEditForm[x.key] === '' ? null : adminEditForm[x.key];

      // Pengalihan pekerjaan
      let penerimaBaru = '';
      let labelTujuanLama = t.assign_name || '';
      if (adaReroute) {
        if (adminRerouteTo.startsWith('SUP::')) {
          const [, supId, supName] = adminRerouteTo.split('::');
          payload.routing_status = 'supervisor_assign';
          payload.assigned_supervisor_id = supId;
          payload.assign_name = '';
          payload.status = 'Waiting Approval';
          penerimaBaru = supName;
        } else {
          const nama = adminRerouteTo === 'SELF' ? (currentUser?.full_name ?? '') : adminRerouteTo;
          payload.routing_status = null;
          payload.assigned_supervisor_id = null;
          payload.assign_name = nama;
          // Status hanya diturunkan ke Pending kalau memang belum jalan -
          // dan bolehReroute sudah menjamin itu, jadi tidak ada progress hilang.
          payload.status = 'Pending';
          penerimaBaru = nama;
        }
        if (!labelTujuanLama && t.assigned_supervisor_id) {
          labelTujuanLama = teamMembers.find(m => m.id === t.assigned_supervisor_id)?.name ?? '';
        }
      }

      const { error, data } = await supabase.from('tickets').update(payload).eq('id', t.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Perubahan ditolak sistem (RLS). Hubungi admin.');

      // Catat ke audit
      const catatan = [
        adaReroute ? `Re-route: ${labelTujuanLama || '(belum ada)'} → ${penerimaBaru}` : '',
        perubahan.length ? ringkasPerubahan(perubahan) : '',
      ].filter(Boolean).join(' | ');
      void logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: adaReroute ? 'assign' : 'update', module: 'ticket',
        target_id: t.id, target_name: String(adminEditForm.project_name ?? t.project_name),
        notes: catatan,
      });

      // Beri tahu lewat WA
      // Dikirim ke penerima BARU kalau dialihkan, dan ke penanganya sekarang
      // kalau cuma koreksi data. Keduanya sama-sama perlu tahu.
      const targetNama = penerimaBaru || t.assign_name || '';
      // Admin mengalihkan ke DIRI SENDIRI: WA ke nomor sendiri tidak berguna,
      // tapi badge in-app tetap dikirim - supaya ada catatan/link yang bisa
      // dibuka lagi nanti, sama seperti reroute ke orang lain.
      if (adaReroute && targetNama && targetNama === currentUser?.full_name && currentUser?.id) {
        void createNotification({
          user_id: currentUser.id, type: 'ticket',
          title: '🔀 Kamu alihkan ticket ini ke diri sendiri',
          body: `${adminEditForm.project_name ?? t.project_name}`,
          action_url: '/ticketing', ref_id: t.id, created_by: currentUser.full_name ?? 'Admin',
        });
      }
      if (targetNama && targetNama !== currentUser?.full_name) {
        try {
          const tm = teamMembers.find(m => m.name === targetNama);
          const { data: u } = tm?.username
            ? await supabase.from('users').select('id, phone_number, full_name').eq('username', tm.username).maybeSingle()
            : { data: null };
          if (u?.id) {
            void createNotification({
              user_id: u.id, type: 'ticket',
              title: adaReroute ? '🔀 Ticket dialihkan ke kamu' : '✏️ Detail ticket diperbarui',
              body: `${adminEditForm.project_name ?? t.project_name} — oleh ${currentUser?.full_name ?? 'Admin'}`,
              action_url: '/ticketing', ref_id: t.id, created_by: currentUser?.full_name ?? 'Admin',
            });
          }
          if (u?.phone_number) {
            await sendWANotif({ type: 'reminder_wa', event: 'ticket.updated', target: u.phone_number, message: pesanWAPerubahan({
              namaPenerima: u.full_name || targetNama,
              namaPengubah: currentUser?.full_name ?? 'Admin',
              judulItem: String(adminEditForm.project_name ?? t.project_name),
              jenisItem: 'Ticket',
              perubahan,
              reroute: adaReroute ? { dari: labelTujuanLama, ke: penerimaBaru } : null,
              tautan: appLink('/ticketing'),
            }) });
          }
        } catch { /* WA gagal tidak boleh membatalkan perubahan yang sudah tersimpan */ }
      }

      setAdminEditTicket(null);
      await fetchData();
      notify('success', adaReroute ? `Dialihkan ke ${penerimaBaru}` : `${perubahan.length} perubahan tersimpan`);
    } catch (err: any) {
      notify('error', 'Gagal menyimpan: ' + err.message);
    } finally { setAdminEditSaving(false); }
  };
  return { bukaAdminEdit, simpanAdminEdit };
}
