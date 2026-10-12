'use client';

/** useAksiTechNote - dipecah dari app/(portal)/tech-note/_components/bagian-tech-note.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { TechNote, TechNoteHistory } from './shared';
import { KATEGORI_FOLDER, linkOneDriveSah } from './aturan-tech-note';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { createNotification, createNotificationForAdmins } from '@/lib/notifications';
import { sendWANotif } from '@/lib/wa';
import { appLink } from '@/lib/app-url';
import React from 'react';
import { type ConfirmState } from '@/components/shared';
import { User } from '@/app/(portal)/dashboard/_components/shared';

export interface AksiTechNoteKonteks {
  approvalForm: { action: string; note: string; };
  approveModal: TechNote | null;
  beritahu: (type: "success" | "error", msg: string) => void;
  canManage: boolean;
  currentUser: User | null;
  editingNote: TechNote | null;
  fetchFolders: () => Promise<void>;
  fetchNotes: () => Promise<void>;
  folderForm: { name: string; icon: string; color: string; parent_id: string; category: string; };
  setApprovalForm: React.Dispatch<React.SetStateAction<{ action: string; note: string; }>>;
  setApproveModal: React.Dispatch<React.SetStateAction<TechNote | null>>;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState | null>>;
  setDetailHistory: React.Dispatch<React.SetStateAction<TechNoteHistory[]>>;
  setDetailNote: React.Dispatch<React.SetStateAction<TechNote | null>>;
  setEditingNote: React.Dispatch<React.SetStateAction<TechNote | null>>;
  setFolderForm: React.Dispatch<React.SetStateAction<{ name: string; icon: string; color: string; parent_id: string; category: string; }>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFolderModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowUploadModal: React.Dispatch<React.SetStateAction<boolean>>;
  setUploadForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; product: string; one_drive_link: string; folder_id: string; tags: string; }>>;
  uploadForm: { title: string; description: string; product: string; one_drive_link: string; folder_id: string; tags: string; };
  uploadSnapshotRef: React.RefObject<{ title: string; description: string; product: string; one_drive_link: string; folder_id: string; tags: string; } | null>;
}

export function useAksiTechNote(k: AksiTechNoteKonteks) {
  const { approvalForm, approveModal, beritahu, canManage, currentUser, editingNote, fetchFolders, fetchNotes, folderForm, setApprovalForm, setApproveModal, setConfirmState, setDetailHistory, setDetailNote, setEditingNote, setFolderForm, setSaving, setShowFolderModal, setShowUploadModal, setUploadForm, uploadForm, uploadSnapshotRef } = k;
  const openDetail = async (tn: TechNote) => {
    setDetailNote(tn);
    const { data } = await supabase.from('tech_note_history').select('*').eq('tech_note_id', tn.id).order('created_at');
    setDetailHistory((data ?? []) as TechNoteHistory[]);
  };

  const saveFolder = async () => {
    if (!folderForm.name.trim()) return;
    setSaving(true);
    const dasar = {
      name: folderForm.name.trim(),
      // Emoji mengikuti kategori, bukan diketik bebas - lihat KATEGORI_FOLDER.
      icon: KATEGORI_FOLDER.find(k => k.value === folderForm.category)?.icon ?? '📄',
      color: folderForm.color, parent_id: folderForm.parent_id || null,
      created_by: currentUser?.full_name ?? 'Admin',
    };
    let { error } = await supabase.from('tech_note_folders')
      .insert({ ...dasar, category: folderForm.category });
    if (error) {
      // Kolom `category` baru ada setelah sql/tech-note-folder-category.sql
      // dijalankan. Sebelum itu PostgREST menolak SELURUH insert, bukan cuma
      // kolom yang tak dikenal - jadi tanpa jalur mundur ini, membuat folder
      // gagal total di lingkungan yang migrasinya belum dijalankan.
      ({ error } = await supabase.from('tech_note_folders').insert(dasar));
    }
    setSaving(false);
    if (error) { beritahu('error', 'Gagal membuat folder: ' + error.message); return; }
    setFolderForm({ name:'', icon:'🖥️', color:'#ec4899', parent_id:'', category:'display' });
    setShowFolderModal(false); fetchFolders();
  };

  /** Buka modal upload dalam mode sunting, terisi nilai catatan yang dipilih. */
  const bukaEditNote = (n: TechNote) => {
    const form = {
      title: n.title ?? '', description: n.description ?? '', product: n.product ?? '',
      one_drive_link: n.one_drive_link ?? '', folder_id: n.folder_id ?? '',
      tags: (n.tags ?? []).join(', '),
    };
    setUploadForm(form);
    uploadSnapshotRef.current = form;
    setEditingNote(n);
    setShowUploadModal(true);
  };

  /** Hapus tech note beserta riwayatnya. */
  const hapusNote = (n: TechNote) => {
    setConfirmState({
      message: `Hapus tech note "${n.title}"?`,
      description: 'Riwayat review-nya ikut terhapus. Tindakan ini tidak bisa dibatalkan.',
      danger: true, confirmLabel: 'Hapus',
      onConfirm: async () => {
        // Riwayat dihapus DULUAN: kalau induknya lebih dulu hilang, baris
        // riwayatnya tertinggal tanpa tujuan dan tidak akan pernah terbaca lagi.
        await supabase.from('tech_note_history').delete().eq('tech_note_id', n.id);
        //  select('id') + panjangnya diperiksa: riwayatnya sudah kadung
        //  terhapus di atas, jadi kalau tech_notes-nya sendiri gagal
        //  terhapus (RLS menolak diam-diam, 0 baris, tanpa galat), "berhasil
        //  dihapus" akan menyembunyikan catatan yatim tanpa riwayat.
        const { data: terhapus, error } = await supabase.from('tech_notes').delete().eq('id', n.id).select('id');
        if (error || !terhapus || terhapus.length === 0) {
          beritahu('error', error ? 'Gagal menghapus: ' + error.message : 'Gagal menghapus (tidak punya akses). Riwayatnya sudah terhapus - hubungi admin.');
          return;
        }
        void logAudit({
          user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
          action: 'delete', module: 'tech-note', target_id: n.id, target_name: n.title,
        });
        setDetailNote(null);
        fetchNotes();
      },
    });
  };

  const submitTechNote = async () => {
    if (!uploadForm.title.trim() || !uploadForm.folder_id || !linkOneDriveSah(uploadForm.one_drive_link) || !currentUser) return;
    setSaving(true);
    const now = new Date().toISOString();
    const tags = uploadForm.tags.split(',').map(s=>s.trim()).filter(Boolean);

    // Mode sunting
    // status & author biasanya TIDAK disentuh: menyunting isi bukan berarti
    // catatannya jadi milik penyunting, dan bukan pula berarti hasil review-nya
    // batal - KECUALI kasus C3 (docs/UX-WORKFLOW-AUDIT.md): penulis sendiri
    // (bukan pengelola) menyunting catatan yang statusnya 'revision'/'rejected'.
    // Dulu status di kasus itu TIDAK PERNAH kembali ke 'pending', jadi hasil
    // perbaikan penulis tidak pernah masuk lagi ke antrean approval (tab
    // Pending memfilter status==='pending') - jalan buntu permanen. Action
    // 'resubmitted' sudah lama ada di ACTION_CONFIG (shared.ts) tapi tidak
    // pernah dipanggil di mana pun; disambungkan di sini.
    if (editingNote) {
      const resubmit = !canManage && (editingNote.status === 'revision' || editingNote.status === 'rejected');
      const payload: Record<string, unknown> = {
        title: uploadForm.title.trim(), description: uploadForm.description.trim(),
        folder_id: uploadForm.folder_id, one_drive_link: uploadForm.one_drive_link.trim(),
        product: uploadForm.product.trim(), tags,
      };
      if (resubmit) { payload.status = 'pending'; payload.submitted_at = now; }
      const { error } = await supabase.from('tech_notes').update(payload).eq('id', editingNote.id);
      setSaving(false);
      if (error) { beritahu('error', 'Gagal menyimpan: ' + error.message); return; }
      await supabase.from('tech_note_history').insert({
        tech_note_id: editingNote.id, action: resubmit ? 'resubmitted' : 'edited',
        performed_by: currentUser.id, performed_by_name: currentUser.full_name,
        note: resubmit ? 'Diajukan ulang setelah diperbaiki' : 'Detail disunting oleh pengelola',
        created_at: now,
      });
      void logAudit({
        user_id: currentUser.id, user_name: currentUser.full_name ?? '',
        action: 'update', module: 'tech-note', target_id: editingNote.id,
        target_name: uploadForm.title.trim(),
      });
      if (resubmit) {
        void createNotificationForAdmins({ type: 'system', title: `🔁 Tech Note diajukan ulang`, body: `"${uploadForm.title.trim()}" oleh ${currentUser.full_name} - perlu direview lagi`, action_url: '/tech-note', ref_id: editingNote.id, created_by: currentUser.full_name ?? '' });
      }
      setUploadForm({ title:'', description:'', product:'', one_drive_link:'', folder_id:'', tags:'' });
      setEditingNote(null); setShowUploadModal(false); setDetailNote(null); fetchNotes();
      return;
    }

    const { data: inserted } = await supabase.from('tech_notes').insert({
      title: uploadForm.title.trim(), description: uploadForm.description.trim(),
      folder_id: uploadForm.folder_id, author_id: currentUser.id, author_name: currentUser.full_name,
      one_drive_link: uploadForm.one_drive_link.trim(), product: uploadForm.product.trim(),
      tags, status:'pending', submitted_at: now, team_type: currentUser.team_type ?? '',
    }).select('id').single();
    if (inserted && (inserted as { id:string }).id) {
      await supabase.from('tech_note_history').insert({
        tech_note_id: (inserted as { id:string }).id, action:'submitted',
        performed_by: currentUser.id, performed_by_name: currentUser.full_name,
        note:'Submitted for review', created_at: now,
      });
    }
    if (inserted && (inserted as { id:string }).id) {
      const noteId = (inserted as { id:string }).id;
      void logAudit({ user_id: currentUser.id, user_name: currentUser.full_name ?? '', action: 'create', module: 'tech-note', target_id: noteId, target_name: uploadForm.title.trim() });
      void createNotificationForAdmins({ type: 'system', title: `📄 Tech Note baru menunggu review`, body: `"${uploadForm.title.trim()}" oleh ${currentUser.full_name}`, action_url: '/tech-note', ref_id: noteId, created_by: currentUser.full_name ?? '' });
    }
    setUploadForm({ title:'', description:'', product:'', one_drive_link:'', folder_id:'', tags:'' });
    setSaving(false); setShowUploadModal(false); fetchNotes();
  };

  const submitApproval = async () => {
    if (!approveModal || !currentUser) return;
    setSaving(true);
    const now = new Date().toISOString();
    const newStatus = approvalForm.action === 'approved' ? 'approved' : approvalForm.action === 'rejected' ? 'rejected' : 'revision';
    //  Hasilnya diperiksa: RLS yang menolak menjawab 0 baris TANPA galat, dan
    //  approval yang gagal diam-diam berarti penulisnya menunggu keputusan
    //  yang sebenarnya tidak pernah tersimpan.
    const { data: terubah, error: galatUbah } = await supabase.from('tech_notes')
      .update({ status:newStatus, reviewed_at:now,
        reviewed_by:currentUser.id, reviewed_by_name:currentUser.full_name,
        review_note:approvalForm.note||null })
      .eq('id',approveModal.id).select('id');
    if (galatUbah || !terubah || terubah.length === 0) {
      setSaving(false);
      beritahu('error', 'Gagal menyimpan keputusan review. Coba lagi atau hubungi admin.');
      return;
    }
    await supabase.from('tech_note_history').insert({
      tech_note_id:approveModal.id, action:approvalForm.action,
      performed_by:currentUser.id, performed_by_name:currentUser.full_name,
      note:approvalForm.note||null, created_at:now,
    });
    void logAudit({ user_id: currentUser.id, user_name: currentUser.full_name ?? '', action: approvalForm.action === 'approved' ? 'approve' : 'reject', module: 'tech-note', target_id: approveModal.id, target_name: approveModal.title, notes: approvalForm.note || undefined });
    if (approveModal.author_id) {
      const actionLabel = approvalForm.action === 'approved' ? '✅ Disetujui' : approvalForm.action === 'rejected' ? '❌ Ditolak' : '🔄 Perlu Revisi';
      void createNotification({ user_id: approveModal.author_id, type: 'system', title: `📄 Tech Note ${actionLabel}`, body: `"${approveModal.title}" — ${approvalForm.note || 'Tanpa catatan'}`, action_url: '/tech-note', ref_id: approveModal.id, created_by: currentUser.full_name ?? '' });

      /*
        Sebelum ini keputusan review HANYA badge in-app. Artinya penulis yang
        catatannya ditolak atau diminta revisi baru tahu kalau kebetulan
        membuka platform - padahal justru dialah yang harus menindaklanjuti,
        dan revisi yang tidak pernah dikerjakan membuat catatan teknis
        mengendap tanpa ada yang sadar.

        sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus (lib/wa.ts).
      */
      try {
        const { data: penulis } = await supabase.from('users')
          .select('full_name, phone_number').eq('id', approveModal.author_id).maybeSingle();
        if (penulis?.phone_number) {
          void sendWANotif({
            type: 'reminder_wa',
            target: penulis.phone_number,
            message: [
              `📄 *TECH NOTE ${actionLabel.replace(/^[^\s]+\s/, '').toUpperCase()}*`,
              '━━━━━━━━━━━━━━━━━━',
              `Halo *${penulis.full_name}*, catatan teknismu sudah direview oleh *${currentUser.full_name}*:`,
              `📌 *Judul  :* ${approveModal.title}`,
              `📝 *Catatan:* ${approvalForm.note || 'Tanpa catatan'}`,
              '━━━━━━━━━━━━━━━━━━',
              approvalForm.action === 'approved'
                ? 'Terima kasih sudah berbagi — catatanmu kini bisa dipakai tim. 🙌'
                : 'Silakan ditindaklanjuti lalu ajukan kembali.',
              `🔗 ${appLink('/tech-note')}`,
            ].join('\n'),
          });
        }
      } catch { /* kabar gagal tidak boleh membatalkan keputusan reviewnya */ }
    }
    setSaving(false); setApproveModal(null); setDetailNote(null);
    setApprovalForm({ action:'approved', note:'' }); fetchNotes();
  };
  return { openDetail, saveFolder, bukaEditNote, hapusNote, submitTechNote, submitApproval };
}
