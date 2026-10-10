'use client';

/** useEditRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { User, ProjectRequest, RoomDetail, sendWANotif, emptyRoom } from './shared';
import { EDIT_ROOM_LABELS, ambilFieldRuangan, namaRuangan, type EditRoomFields } from './ruangan';
import { bandingkan, ringkasPerubahan, pesanWAPerubahan, type AdminField, type Perubahan } from '@/lib/admin-edit';
import { tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { appLink } from '@/lib/app-url';
import { createNotification } from '@/lib/notifications';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';

export interface EditRequestKonteks {
  currentUser: User;
  detailRoomIdx: number;
  editDueDate: string;
  editFormData: { project_name: string; room_name: string; project_location: string; sales_name: string; sales_division: string; sales_user_id: string | null; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; };
  editNewRoomIds: string[];
  editRoomIdx: number;
  editRooms: RoomDetail[];
  fetchMessages: (requestId: string) => Promise<void>;
  fetchRequests: () => Promise<void>;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  rerouteTarget: ProjectRequest | null;
  rerouteTo: string;
  rosterPTS: { id: string; full_name: string; jabatan: string | null; phone_number: string | null; team_type?: string | null; bisa_ditugaskan?: boolean | null; }[];
  selectedRequest: ProjectRequest | null;
  setDetailRoomIdx: import("react").Dispatch<import("react").SetStateAction<number>>;
  setEditDueDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setEditFormData: import("react").Dispatch<import("react").SetStateAction<{ project_name: string; room_name: string; project_location: string; sales_name: string; sales_division: string; sales_user_id: string | null; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; }>>;
  setEditFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setEditNewRoomIds: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  setEditRoomIdx: import("react").Dispatch<import("react").SetStateAction<number>>;
  setEditRooms: import("react").Dispatch<import("react").SetStateAction<RoomDetail[]>>;
  setRerouteSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setRerouteTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setRerouteTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
}

export function useEditRequest(k: EditRequestKonteks) {
  const { currentUser, detailRoomIdx, editDueDate, editFormData, editNewRoomIds, editRoomIdx, editRooms, fetchMessages, fetchRequests, notify, rerouteTarget, rerouteTo, rosterPTS, selectedRequest, setDetailRoomIdx, setEditDueDate, setEditFormData, setEditFormModal, setEditNewRoomIds, setEditRoomIdx, setEditRooms, setRerouteSaving, setRerouteTarget, setRerouteTo, setSelectedRequest } = k;
  const handleOpenEditForm = () => {
    if (!selectedRequest) return;
    setEditDueDate(selectedRequest.due_date || '');
    setEditFormData({
      project_name: selectedRequest.project_name || '', room_name: selectedRequest.room_name || '',
      project_location: selectedRequest.project_location || '',
      sales_name: selectedRequest.sales_name || '', sales_division: selectedRequest.sales_division || '',
      // uuid ikut dibawa masuk supaya menyimpan tanpa mengganti Sales tidak
      // menghapus identitas yang sudah tercatat.
      sales_user_id: selectedRequest.sales_user_id ?? null, kebutuhan: selectedRequest.kebutuhan || [],
      kebutuhan_other: selectedRequest.kebutuhan_other || '', solution_product: selectedRequest.solution_product || [],
      solution_other: selectedRequest.solution_other || '', layout_signage: selectedRequest.layout_signage || [],
      jaringan_cms: selectedRequest.jaringan_cms || [], jumlah_input: selectedRequest.jumlah_input || '',
      jumlah_output: selectedRequest.jumlah_output || '', source: selectedRequest.source || [],
      source_other: selectedRequest.source_other || '', camera_conference: selectedRequest.camera_conference || 'No',
      camera_jumlah: selectedRequest.camera_jumlah || '', camera_tracking: selectedRequest.camera_tracking || [],
      audio_system: selectedRequest.audio_system || 'No', audio_mixer: selectedRequest.audio_mixer || '', audio_detail: selectedRequest.audio_detail || [],
      wallplate_input: selectedRequest.wallplate_input || 'No', wallplate_jumlah: selectedRequest.wallplate_jumlah || '',
      tabletop_input: selectedRequest.tabletop_input || 'No', tabletop_jumlah: selectedRequest.tabletop_jumlah || '',
      wireless_presentation: selectedRequest.wireless_presentation || 'No', wireless_mode: selectedRequest.wireless_mode || [], wireless_dongle: selectedRequest.wireless_dongle || 'No',
      controller_automation: selectedRequest.controller_automation || 'No', controller_type: selectedRequest.controller_type || [],
      ukuran_ruangan: selectedRequest.ukuran_ruangan || '',
      suggest_tampilan: selectedRequest.suggest_tampilan || '', keterangan_lain: selectedRequest.keterangan_lain || '',
    });
    const ruanganTersimpan = selectedRequest.rooms || [];
    setEditRooms(ruanganTersimpan.map(r => ({ ...emptyRoom(), ...r })));
    setEditNewRoomIds([]);
    // Buka di tab ruangan yang sedang dilihat di modal Detail, bukan selalu Ruangan 1.
    setEditRoomIdx(Math.min(detailRoomIdx, ruanganTersimpan.length));
    setEditFormModal(true);
  };

  // Data & pengubah untuk tab ruangan yang sedang aktif di form Edit.
  const editCur: EditRoomFields = editRoomIdx === 0 ? editFormData : (editRooms[editRoomIdx - 1] ?? emptyRoom());
  const editUpd = (patch: Partial<EditRoomFields>) => {
    if (editRoomIdx === 0) setEditFormData(p => ({ ...p, ...patch }));
    else setEditRooms(rs => rs.map((r, i) => (i === editRoomIdx - 1 ? { ...r, ...patch } : r)));
  };
  const editRoomAktifBaru = editRoomIdx > 0 && !!editRooms[editRoomIdx - 1] && editNewRoomIds.includes(editRooms[editRoomIdx - 1].id);

  const handleEditAddRoom = () => {
    const baru = emptyRoom();
    setEditRooms(p => [...p, baru]);
    setEditNewRoomIds(p => [...p, baru.id]);
    setEditRoomIdx(1 + editRooms.length);
  };
  // Hanya ruangan yang BELUM tersimpan yang bisa dibuang. Ruangan yang sudah
  // tersimpan tidak boleh dihapus/digeser dari sini: file lampiran terikat ke
  // NOMOR ruangan ("[room3] ...") dan chat ke namanya, jadi menghapus satu
  // ruangan membuat lampiran & chat pindah ke ruangan yang salah.
  const handleEditRemoveNewRoom = () => {
    const r = editRooms[editRoomIdx - 1];
    if (!r || !editNewRoomIds.includes(r.id)) return;
    setEditRooms(p => p.filter(x => x.id !== r.id));
    setEditNewRoomIds(p => p.filter(id => id !== r.id));
    setEditRoomIdx(i => Math.max(0, i - 1));
  };

  /**
   * Field yang dilacak untuk audit & pesan WA.
   *
   * Hanya field yang berarti bagi orang yang mengerjakan. Isian teknis
   * (checkbox perangkat, ukuran, dsb) tetap tersimpan seperti biasa - cuma
   * tidak diuraikan satu per satu di WA, karena daftarnya bisa puluhan baris
   * dan justru menenggelamkan yang penting.
   */
  const REQUEST_FIELDS: AdminField[] = [
    { key: 'project_name',     label: 'Nama Project' },
    { key: 'room_name',        label: 'Nama Ruangan' },
    { key: 'project_location', label: 'Lokasi' },
    { key: 'sales_name',       label: 'Sales' },
    { key: 'sales_division',   label: 'Divisi Sales' },
    { key: 'due_date',         label: 'Target Selesai' },
    { key: 'ukuran_ruangan',   label: 'Ukuran Ruangan' },
    { key: 'suggest_tampilan', label: 'Saran Tampilan' },
    { key: 'keterangan_lain',  label: 'Keterangan' },
  ];

  /** Alihkan request ke anggota tim / supervisor lain. */
  const simpanReroute = async () => {
    if (!rerouteTarget || !rerouteTo) return;
    setRerouteSaving(true);
    try {
      const orang = rosterPTS.find(u => u.id === rerouteTo);
      if (!orang) throw new Error('Tujuan tidak ditemukan');
      const dari = rerouteTarget.assign_name || '(belum ada)';

      const payload: Record<string, unknown> = orang.jabatan === 'Supervisor'
        // Ke Supervisor: dikembalikan ke tahap supervisor_assign supaya
        // Supervisor itu yang menentukan pelaksananya - sama seperti alur
        // normal, bukan jalur pintas yang melompati tahapannya.
        ? { assign_name: null, assign_user_id: null, assigned_supervisor_id: orang.id, routing_status: 'supervisor_assign', status: 'approved' }
        : { assign_name: orang.full_name, assign_user_id: orang.id, assigned_supervisor_id: null, routing_status: null, status: 'approved' };

      const { error, data } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
        .update(pakaiUuid ? payload : tanpaIdentitas(payload)).eq('id', rerouteTarget.id).select('id'));
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Perubahan ditolak sistem (RLS). Hubungi admin.');

      void logAudit({
        user_id: currentUser.id, user_name: currentUser.full_name,
        action: 'assign', module: 'require',
        target_id: rerouteTarget.id, target_name: rerouteTarget.project_name,
        notes: `Re-route: ${dari} → ${orang.full_name}`,
      });

      if (orang.phone_number && orang.full_name !== currentUser.full_name) {
        void sendWANotif({ type: 'reminder_wa', event: 'project.assigned', target: orang.phone_number, message: pesanWAPerubahan({
          namaPenerima: orang.full_name,
          namaPengubah: currentUser.full_name,
          judulItem: rerouteTarget.project_name,
          jenisItem: 'Request Design Project',
          perubahan: [],
          reroute: { dari, ke: orang.full_name },
          tautan: appLink('/form-require-project'),
        }) });
      }
      void createNotification({
        user_id: orang.id, type: 'project',
        title: '🔀 Request dialihkan ke kamu',
        body: `${rerouteTarget.project_name} — oleh ${currentUser.full_name}`,
        action_url: '/form-require-project', ref_id: rerouteTarget.id,
        created_by: currentUser.full_name,
      });

      notify('success', `Dialihkan ke ${orang.full_name}`);
      setRerouteTarget(null); setRerouteTo('');
      fetchRequests();
    } catch (e: any) {
      notify('error', 'Gagal mengalihkan: ' + e.message);
    } finally { setRerouteSaving(false); }
  };

  const handleEditFormSubmit = async () => {
    if (!selectedRequest) return;

    // Ruangan baru wajib punya Kebutuhan - aturan yang sama dengan form pembuatan.
    const idxKosong = editRooms.findIndex(r => editNewRoomIds.includes(r.id) && r.kebutuhan.length === 0 && !r.kebutuhan_other.trim());
    if (idxKosong >= 0) { setEditRoomIdx(idxKosong + 1); notify('error', `Pilih Kebutuhan untuk Ruangan ${idxKosong + 2}!`); return; }

    // Ruangan 2+ : gabungkan ke rooms[] TERBARU di database, bukan ke salinan
    // yang dibuka saat form dibuka. Selama form terbuka, admin bisa saja
    // meng-approve/assign ruangan lain - menulis balik seluruh array dari
    // salinan lama akan menimpa status & assign itu.
    const editanLama = editRooms.filter(r => !editNewRoomIds.includes(r.id));
    const ruanganBaru = editRooms.filter(r => editNewRoomIds.includes(r.id));
    let roomsPayload: RoomDetail[] | null = null;
    const perubahanRuangan: Perubahan[] = [];
    const namaRuanganBaru: string[] = [];
    let butuhApprovalRuanganBaru = false;
    if (editanLama.length > 0 || ruanganBaru.length > 0) {
      const { data: segar } = await supabase.from('project_requests').select('rooms, status').eq('id', selectedRequest.id).maybeSingle();
      const dbRooms: RoomDetail[] = Array.isArray(segar?.rooms) ? segar.rooms : (selectedRequest.rooms || []);
      const statusRequest = (segar?.status ?? selectedRequest.status) as string;
      let adaPerubahan = false;
      const merged = dbRooms.map((dbR, i) => {
        const e = editanLama[i];
        if (!e) return dbR;
        const lama = ambilFieldRuangan(dbR);
        const baru = ambilFieldRuangan(e);
        baru.room_name = baru.room_name.trim();
        if (JSON.stringify(lama) === JSON.stringify(baru)) return dbR;
        adaPerubahan = true;
        const nama = namaRuangan(dbR, i + 2);
        perubahanRuangan.push(...bandingkan(
          EDIT_ROOM_LABELS.map(f => ({ ...f, label: `[${nama}] ${f.label}` })),
          lama as unknown as Record<string, unknown>,
          baru as unknown as Record<string, unknown>,
        ));
        return { ...dbR, ...baru };
      });
      // Ruangan yang ditambah setelah request lewat tahap pending harus
      // menunggu approve sendiri; kalau tidak diberi status, getRoomStatus()
      // jatuh ke status request (mis. "completed") dan ruangan baru tampak selesai.
      butuhApprovalRuanganBaru = statusRequest !== 'pending';
      const tambahan: RoomDetail[] = ruanganBaru.map(r => ({
        ...r, room_name: r.room_name.trim(),
        ...(butuhApprovalRuanganBaru ? { status: 'pending' as const } : {}),
      }));
      tambahan.forEach((r, i) => {
        const nama = namaRuangan(r, dbRooms.length + i + 2);
        namaRuanganBaru.push(nama);
        perubahanRuangan.push({ key: 'rooms', label: 'Ruangan baru', dari: '(kosong)', ke: nama });
      });
      if (adaPerubahan || tambahan.length > 0) roomsPayload = [...merged, ...tambahan];
    }

    const updateData = {
      ...editFormData,
      sales_division: editFormData.sales_division || '',
      due_date: editDueDate || null,
      ...(roomsPayload ? { rooms: roomsPayload } : {}),
    };
    const perubahanReq = bandingkan(
      REQUEST_FIELDS,
      selectedRequest as unknown as Record<string, unknown>,
      updateData as unknown as Record<string, unknown>,
    );
    const semuaPerubahan = [...perubahanReq, ...perubahanRuangan];
    const { error } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
      .update(pakaiUuid ? updateData : tanpaIdentitas(updateData)).eq('id', selectedRequest.id));
    if (error) { notify('error', 'Gagal menyimpan perubahan.'); return; }

    // Jejak siapa mengubah apa. Tanpa ini, satu-satunya bukti perubahan adalah
    // pesan otomatis di kolom diskusi - yang tidak menyebut nilai lamanya.
    void logAudit({
      user_id: currentUser.id, user_name: currentUser.full_name,
      action: 'update', module: 'require',
      target_id: selectedRequest.id, target_name: String(updateData.project_name ?? selectedRequest.project_name),
      notes: semuaPerubahan.length ? ringkasPerubahan(semuaPerubahan) : 'Disimpan tanpa perubahan',
    });

    // Kabari yang mengerjakan: tanpa ini orang bisa berangkat memakai data lama.
    const penangani = String(selectedRequest.assign_name ?? '');
    if (semuaPerubahan.length > 0 && penangani && penangani !== currentUser.full_name) {
      try {
        const { data: u } = await supabase.from('users')
          .select('id, phone_number, full_name').eq('full_name', penangani).maybeSingle();
        if (u?.phone_number) {
          void sendWANotif({ type: 'reminder_wa', event: 'project.updated', target: u.phone_number, message: pesanWAPerubahan({
            namaPenerima: u.full_name || penangani,
            namaPengubah: currentUser.full_name,
            judulItem: String(updateData.project_name ?? selectedRequest.project_name),
            jenisItem: 'Request Design Project',
            perubahan: semuaPerubahan,
            reroute: null,
            tautan: appLink('/form-require-project'),
          }) });
        }
      } catch { /* WA gagal tidak membatalkan perubahan yang sudah tersimpan */ }
    }

    // Ruangan baru yang berstatus pending butuh keputusan admin - kabari mereka,
    // sama seperti request baru. Tanpa ini ruangannya diam menunggu tanpa ada yang tahu.
    if (namaRuanganBaru.length > 0 && butuhApprovalRuanganBaru) {
      try {
        const admins = (await penerimaAdminBernomor()) as { id?: string; phone_number?: string | null }[] | null;
        const pesanAdmin = [
          '🏗️ *Request Design Project — Ruangan Baru*',
          `📋 *Project  :* ${String(updateData.project_name ?? selectedRequest.project_name)}`,
          `🛋️ *Ruangan  :* ${namaRuanganBaru.join(', ')}`,
          `👤 *Oleh     :* ${currentUser.full_name}`,
          'Ruangan ini berstatus *Pending* - buka dashboard untuk *Approve / Reject*.',
          appLink('/form-require-project'),
        ].join('\n');
        await Promise.allSettled((admins ?? [])
          .filter(a => a.phone_number && a.id !== currentUser.id)
          .map(a => sendWANotif({ type: 'reminder_wa', event: 'project.approval_needed', target: a.phone_number as string, message: pesanAdmin })));
      } catch { /* notifikasi gagal tidak membatalkan perubahan yang sudah tersimpan */ }
    }

    notify('success', 'Perubahan disimpan!');
    setEditFormModal(false);
    fetchRequests();
    setSelectedRequest(prev => prev ? { ...prev, ...editFormData, due_date: editDueDate || undefined, ...(roomsPayload ? { rooms: roomsPayload } : {}) } : null);
    setDetailRoomIdx(editRoomIdx);
    await supabase.from('project_messages').insert([
      { request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `✏️ Kebutuhan project diperbarui oleh ${currentUser.full_name}.` },
      // Diberi awalan [Nama Ruangan] supaya muncul di tab chat ruangan barunya.
      ...namaRuanganBaru.map(nama => ({ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `[${nama}] ➕ Ruangan ditambahkan oleh ${currentUser.full_name}.` })),
    ]);
    fetchMessages(selectedRequest.id);
  };
  return { handleOpenEditForm, editCur, editUpd, editRoomAktifBaru, handleEditAddRoom, handleEditRemoveNewRoom, REQUEST_FIELDS, simpanReroute, handleEditFormSubmit };
}
