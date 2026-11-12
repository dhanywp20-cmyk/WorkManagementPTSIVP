'use client';

import { LABEL_KATEGORI } from './lampiran-kategori';
import type { KategoriLampiran } from './shared';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compress';
import { User, ProjectRequest, ProjectMessage, ProjectAttachment } from './shared';

export interface PesanLampiranKonteks {
  activeRequestIdRef: import("react").RefObject<string | null>;
  attachments: ProjectAttachment[];
  chatRoomFilter: string;
  currentUser: User;
  detailRoomIdx: number;
  fetchAttachments: (requestId: string) => Promise<void>;
  fetchMessages: (requestId: string) => Promise<void>;
  getFileRoomIdx: (fileName: string) => number;
  internalSalesNames: Record<string, string>;
  isIVPGuest: boolean;
  isPTS: boolean;
  msgText: string;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedRequest: ProjectRequest | null;
  setAttachments: import("react").Dispatch<import("react").SetStateAction<ProjectAttachment[]>>;
  setChatRoomFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDetailMobileTab: import("react").Dispatch<import("react").SetStateAction<"info" | "chat">>;
  setDetailRoomIdx: import("react").Dispatch<import("react").SetStateAction<number>>;
  setInternalSalesNames: import("react").Dispatch<import("react").SetStateAction<Record<string, string>>>;
  setMessages: import("react").Dispatch<import("react").SetStateAction<ProjectMessage[]>>;
  setMsgText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setSendingMsg: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowDetailModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setUnreadMsgMap: import("react").Dispatch<import("react").SetStateAction<Record<string, number>>>;
  setUploadingCategory: import("react").Dispatch<import("react").SetStateAction<KategoriLampiran | null>>;
  setUploadingFile: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  toStorageSafeName: (name: string) => string;
}

export function usePesanLampiran(k: PesanLampiranKonteks) {
  const { activeRequestIdRef, attachments, chatRoomFilter, currentUser, detailRoomIdx, fetchAttachments, fetchMessages, getFileRoomIdx, internalSalesNames, isIVPGuest, isPTS, msgText, notify, selectedRequest, setAttachments, setChatRoomFilter, setDetailMobileTab, setDetailRoomIdx, setInternalSalesNames, setMessages, setMsgText, setSelectedRequest, setSendingMsg, setShowDetailModal, setUnreadMsgMap, setUploadingCategory, setUploadingFile, toStorageSafeName } = k;
  const handleSendMessage = async () => {
    if (!msgText.trim() || !selectedRequest) return;
    if (selectedRequest.status === 'rejected') { notify('error', 'Request ini sudah ditolak. Tidak bisa mengirim pesan.'); return; }
    if (selectedRequest.status === 'pending' && !isPTS) { notify('error', 'Request masih pending approval. Chat akan aktif setelah diapprove.'); return; }
    const isOwner = selectedRequest.requester_id === currentUser.id;
    const isLinkedIVP = isIVPGuest && selectedRequest.ivp_assignee === currentUser.full_name;
    const canChat = isPTS || isOwner || isLinkedIVP;
    if (!canChat) { notify('error', 'Anda tidak memiliki akses untuk mengirim pesan.'); return; }
    setSendingMsg(true);
    let finalMessage = msgText.trim();
    if (chatRoomFilter !== 'all') {
      finalMessage = `[${chatRoomFilter}] ${finalMessage}`;
    }
    const { error } = await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role ?? '', message: finalMessage }]);
    setSendingMsg(false);
    if (error) { notify('error', 'Gagal kirim pesan.'); return; }
    setMsgText('');
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedRequest) return;
    setUploadingFile(true);
    const toUpload = await compressImage(file);
    const taggedName = detailRoomIdx > 0 ? `[room${detailRoomIdx + 1}] ${file.name}` : file.name;
    const filePath = `project-files/${selectedRequest.id}/${Date.now()}-${toStorageSafeName(taggedName)}`;
    const { error: storageError } = await supabase.storage.from('project-files').upload(filePath, toUpload, { cacheControl: '31536000', upsert: false });
    if (storageError) { notify('error', 'Upload gagal: ' + storageError.message); setUploadingFile(false); return; }
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
    await supabase.from('project_attachments').insert([{ request_id: selectedRequest.id, message_id: null, file_name: taggedName, file_url: urlData.publicUrl, file_type: toUpload.type, file_size: toUpload.size, uploaded_by: currentUser.full_name, attachment_category: 'general' }]);
    setUploadingFile(false);
    notify('success', `File "${file.name}" berhasil diupload!`);
    fetchAttachments(selectedRequest.id);
    const roomLabelChat = detailRoomIdx > 0 ? (selectedRequest.rooms?.[detailRoomIdx - 1]?.room_name?.trim() || `Ruangan ${detailRoomIdx + 1}`) : null;
    await supabase.from('project_messages').insert([{ request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role ?? '', message: `${roomLabelChat ? `[${roomLabelChat}] ` : ''}📎 Melampirkan file: ${file.name}` }]);
  };

  const handleCategoryUpload = async (file: File, category: KategoriLampiran) => {
    if (!selectedRequest) return;
    if ((category === 'screen' || category === 'sld') && !(file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
      notify('error', `${category === 'screen' ? 'Screen Connection' : 'SLD'} wajib berupa file PDF.`);
      return;
    }
    setUploadingCategory(category);
    const existing = attachments.filter(a => a.attachment_category === category && getFileRoomIdx(a.file_name) === detailRoomIdx);
    const revisionNum = existing.length + 1;
    const label = LABEL_KATEGORI[category];
    const toUpload = await compressImage(file);
    const taggedName = detailRoomIdx > 0 ? `[room${detailRoomIdx + 1}] ${file.name}` : file.name;
    const filePath = `project-files/${selectedRequest.id}/${category}-rev${revisionNum}-${Date.now()}-${toStorageSafeName(taggedName)}`;
    const { error: storageError } = await supabase.storage.from('project-files').upload(filePath, toUpload, { cacheControl: '31536000', upsert: false });
    if (storageError) { notify('error', `Upload ${label} gagal: ` + storageError.message); setUploadingCategory(null); return; }
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
    await supabase.from('project_attachments').insert([{ request_id: selectedRequest.id, message_id: null, file_name: taggedName, file_url: urlData.publicUrl, file_type: toUpload.type, file_size: toUpload.size, uploaded_by: currentUser.full_name, attachment_category: category, revision_version: revisionNum }]);
    setUploadingCategory(null);
    notify('success', `${label} Rev-${revisionNum} berhasil diupload!`);
    fetchAttachments(selectedRequest.id);
    const roomLabelChat = detailRoomIdx > 0 ? (selectedRequest.rooms?.[detailRoomIdx - 1]?.room_name?.trim() || `Ruangan ${detailRoomIdx + 1}`) : null;
    await supabase.from('project_messages').insert([{
      request_id: selectedRequest.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role ?? '',
      message: `${roomLabelChat ? `[${roomLabelChat}] ` : ''}📁 ${label} Revision ${revisionNum} diupload: ${file.name}`,
    }]);
  };

  const handleOpenDetail = async (req: ProjectRequest) => {
    activeRequestIdRef.current = req.id;
    setSelectedRequest(req);
    setMessages([]);
    setAttachments([]);
    setShowDetailModal(true);
    setDetailRoomIdx(0);
    setDetailMobileTab('info');
    setChatRoomFilter('all');
    await fetchMessages(req.id);
    await fetchAttachments(req.id);
    const ccIds = [req.internal_sales_id, req.internal_sales_id_2].filter(
      (id): id is string => !!id && !internalSalesNames[id]
    );
    if (ccIds.length > 0) {
      const { data: ccUsers } = await supabase.from('users').select('id, full_name').in('id', ccIds);
      if (ccUsers?.length) {
        setInternalSalesNames(prev => {
          const next = { ...prev };
          ccUsers.forEach((u) => { next[u.id] = u.full_name; });
          return next;
        });
      }
    }
    const stored = JSON.parse(localStorage.getItem('pts_last_seen') || '{}');
    stored[req.id] = Date.now();
    localStorage.setItem('pts_last_seen', JSON.stringify(stored));
    setUnreadMsgMap(prev => { const n = { ...prev }; delete n[req.id]; return n; });
  };

  const getCCLabel = (req: ProjectRequest): string => {
    const parts: string[] = [];
    if (req.internal_sales_id) {
      const name = internalSalesNames[req.internal_sales_id];
      if (name) parts.push(req.brand === 'BOTH' ? `${name} (MVI)` : name);
    }
    if (req.internal_sales_id_2) {
      const name = internalSalesNames[req.internal_sales_id_2];
      if (name) parts.push(`${name} (IVP)`);
    }
    if (parts.length > 0) return parts.join(' & ');
    return req.ivp_assignee || '';
  };

  const handleCloseDetail = () => {
    activeRequestIdRef.current = null;
    setShowDetailModal(false);
    setSelectedRequest(null);
    setMessages([]);
    setAttachments([]);
  };
  return { handleSendMessage, handleFileUpload, handleCategoryUpload, handleOpenDetail, getCCLabel, handleCloseDetail };
}
