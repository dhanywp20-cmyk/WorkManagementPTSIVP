'use client';

/** useEfekHalamanRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, ProjectRequest, ProjectMessage } from '../shared';

export interface EfekHalamanRequestKonteks {
  activeRequestIdRef: import("react").RefObject<string | null>;
  appReady: boolean;
  currentUser: User;
  fetchAttachments: (requestId: string) => Promise<void>;
  fetchRequests: () => Promise<void>;
  isIVPGuest: boolean;
  isPTS: boolean;
  messages: ProjectMessage[];
  messagesEndRef: import("react").RefObject<HTMLDivElement | null>;
  requests: ProjectRequest[];
  selectedRequest: ProjectRequest | null;
  setMessages: import("react").Dispatch<import("react").SetStateAction<ProjectMessage[]>>;
  setShowTicketPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setTicketPopupShown: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setUnreadCount: import("react").Dispatch<import("react").SetStateAction<number>>;
  setUnreadMsgMap: import("react").Dispatch<import("react").SetStateAction<Record<string, number>>>;
  ticketPopupShown: boolean;
}

export function useEfekHalamanRequest(k: EfekHalamanRequestKonteks) {
  const { activeRequestIdRef, appReady, currentUser, fetchAttachments, fetchRequests, isIVPGuest, isPTS, messages, messagesEndRef, requests, selectedRequest, setMessages, setShowTicketPopup, setTicketPopupShown, setUnreadCount, setUnreadMsgMap, ticketPopupShown } = k;
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Popup tiket pending/in_progress - muncul sekali saat masuk platform
  useEffect(() => {
    if (!appReady || ticketPopupShown) return;
    const activeTickets = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
    if (activeTickets.length > 0) {
      setShowTicketPopup(true);
      setTicketPopupShown(true);
    }
  }, [appReady, requests, ticketPopupShown]);

  useEffect(() => {
    const channel = supabase.channel('global_messages_notif')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages' },
        (payload) => {
          const msg = payload.new as ProjectMessage;
          if (msg.sender_role === 'system') return;
          setUnreadMsgMap(prev => {
            if (!selectedRequest || selectedRequest.id !== msg.request_id) {
              return { ...prev, [msg.request_id]: (prev[msg.request_id] || 0) + 1 };
            }
            return prev;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRequest]);

  useEffect(() => {
    if (!isPTS) return;
    // For IVP guest: count approved requests linked to them (new assignments)
    // For PTS/admin: count pending requests needing action
    // For non-IVP guest: count own pending requests
    const pendingCount = isIVPGuest
      ? requests.filter(r => r.ivp_assignee === currentUser.full_name && (r.status === 'approved' || r.status === 'in_progress')).length
      : requests.filter(r => r.status === 'pending').length;
    setUnreadCount(pendingCount);
  }, [requests, isPTS]);

  useEffect(() => {
    if (!selectedRequest) { activeRequestIdRef.current = null; return; }
    const reqId = selectedRequest.id;
    activeRequestIdRef.current = reqId;
    const channelName = `detail_chat:${reqId}_${Date.now()}`;
    // fetchAttachments di-debounce: tanpa itu, mengunggah enam berkas sekaligus
    // memicu enam kali penarikan ulang daftar lampiran.
    let attachDebounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages', filter: `request_id=eq.${reqId}` },
        (payload) => {
          if (activeRequestIdRef.current !== reqId) return;
          setMessages(prev => {
            const exists = prev.some(m => m.id === (payload.new as ProjectMessage).id);
            if (exists) return prev;
            return [...prev, payload.new as ProjectMessage];
          });
          const stored = JSON.parse(localStorage.getItem('pts_last_seen') || '{}');
          stored[reqId] = Date.now();
          localStorage.setItem('pts_last_seen', JSON.stringify(stored));
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_attachments', filter: `request_id=eq.${reqId}` },
        () => {
          if (activeRequestIdRef.current !== reqId) return;
          if (attachDebounce) clearTimeout(attachDebounce);
          attachDebounce = setTimeout(() => fetchAttachments(reqId), 800);
        })
      .subscribe();

    // EGRESS FIX: polling fallback dinaikkan dari 3 DETIK  60 detik. Realtime
    // di atas sudah append pesan baru langsung ke state (tanpa refetch), jadi
    // polling 3 detik ini sepenuhnya redundant - full refetch pesan tiap 3
    // detik selama modal detail terbuka adalah kontributor egress yang berat.
    // Sekarang murni jaring pengaman kalau koneksi Realtime putus.
    const pollInterval = setInterval(async () => {
      if (activeRequestIdRef.current !== reqId) return;
      const { data } = await supabase.from('project_messages').select('id,request_id,sender_id,sender_name,sender_role,message,created_at').eq('request_id', reqId).order('created_at', { ascending: true });
      if (data && activeRequestIdRef.current === reqId) {
        setMessages(prev => { if (data.length === prev.length) return prev; return data as ProjectMessage[]; });
      }
    }, 60000);

    return () => {
      activeRequestIdRef.current = null;
      if (attachDebounce) clearTimeout(attachDebounce);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [selectedRequest?.id, fetchAttachments]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  return {  };
}
