'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User, ProjectRequest, ProjectMessage, ProjectAttachment, JABATAN_TIER } from './shared';

export interface MuatRequestKonteks {
  currentUser: User;
  isIVPGuest: boolean;
  isPTS: boolean;
  isTeamPTS: boolean;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  pimpinan: boolean;
  setAppReady: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setAttachments: import("react").Dispatch<import("react").SetStateAction<ProjectAttachment[]>>;
  setLastSeenMap: import("react").Dispatch<import("react").SetStateAction<Record<string, number>>>;
  setLoading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setMessages: import("react").Dispatch<import("react").SetStateAction<ProjectMessage[]>>;
  setPtsMembersList: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  setRequests: import("react").Dispatch<import("react").SetStateAction<ProjectRequest[]>>;
  setUnreadMsgMap: import("react").Dispatch<import("react").SetStateAction<Record<string, number>>>;
}

export function useMuatRequest(k: MuatRequestKonteks) {
  const { currentUser, isIVPGuest, isPTS, isTeamPTS, notify, pimpinan, setAppReady, setAttachments, setLastSeenMap, setLoading, setMessages, setPtsMembersList, setRequests, setUnreadMsgMap } = k;
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('project_requests').select('*').order('created_at', { ascending: false });
    const kutip = (n: string) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const atasNama = (nama?: string | null) => (nama ? `sales_name.eq.${kutip(nama)}` : '');
    if (isPTS || pimpinan) {
    } else if (isIVPGuest) {
      const { data: ivpDivMaps } = await supabase.from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
      const handledDivisions = (ivpDivMaps ?? []).map((m) => m.sales_division as string);
      const divFilter = handledDivisions.map((d: string) => `sales_division.eq.${d}`).join(',');
      query = query.or([
        `requester_id.eq.${currentUser.id}`, `ivp_assignee.eq.${currentUser.full_name}`,
        atasNama(currentUser.full_name), divFilter,
      ].filter(Boolean).join(','));
    } else {
      const selfJabatan = (currentUser).jabatan as string | undefined;
      const selfTier = selfJabatan ? (JABATAN_TIER[selfJabatan] ?? 0) : 0;
      const selfDiv = currentUser.sales_division;

      if (selfTier > 1 && selfDiv) {
        const { data: supMaps } = await supabase.from('division_supervisor_mappings').select('sales_division').eq('supervisor_id', currentUser.id);
        const supDivisions = (supMaps ?? []).map((m) => m.sales_division as string);
        if (!supDivisions.includes(selfDiv)) supDivisions.push(selfDiv);

        const { data: allGuests } = await supabase.from('users').select('id, full_name, jabatan, sales_division').eq('role', 'guest');
        const subIds = (allGuests ?? [])
          .filter((u) => (JABATAN_TIER[(u.jabatan as string) || ''] ?? 0) < selfTier && supDivisions.includes(u.sales_division ?? ''))
          .map((u) => u.id as string);

        const { data: manualSubs } = await supabase.from('user_supervisor_mappings').select('user_id').eq('supervisor_id', currentUser.id);
        (manualSubs ?? []).forEach((m) => { if (!subIds.includes(m.user_id)) subIds.push(m.user_id); });

        if (subIds.length > 0) {
          const namaBawahan: string[] = subIds
            .map((id: string) => (allGuests ?? []).find((u) => u.id === id)?.full_name as string | undefined)
            .filter((n?: string): n is string => !!n);
          const orFilter = [
            `requester_id.eq.${currentUser.id}`,
            atasNama(currentUser.full_name),
            ...subIds.map((id: string) => `requester_id.eq.${id}`),
            ...namaBawahan.map(n => atasNama(n)),
          ].filter(Boolean).join(',');
          query = query.or(orFilter);
        } else {
          query = query.or([`requester_id.eq.${currentUser.id}`, atasNama(currentUser.full_name)].filter(Boolean).join(','));
        }
      } else {
        query = query.or([`requester_id.eq.${currentUser.id}`, atasNama(currentUser.full_name)].filter(Boolean).join(','));
      }
    }
    const { data, error } = await query;
    if (!error && data) {
      let filtered = data as unknown as ProjectRequest[];
      if (!isPTS && !isIVPGuest && !pimpinan && currentUser.team_type === 'Marketing') {
        const KOLOM_DASAR = 'id, project_name, status, sales_name, created_at, rooms, requester_id';
        const KOLOM_BRAND = 'brand_display_pic_id, brand_display_2_pic_id, brand_middleware_pic_id';
        let allReqsRes = await supabase.from('project_requests')
          .select(`${KOLOM_DASAR}, ${KOLOM_BRAND}`).order('created_at', { ascending: false });
        if (allReqsRes.error) {
          allReqsRes = (await supabase.from('project_requests')
            .select(KOLOM_DASAR).order('created_at', { ascending: false })) as unknown as typeof allReqsRes;
        }
        const allReqs = allReqsRes.data;
        (allReqs ?? []).forEach((r) => {
          if (filtered.find(x => x.id === r.id)) return;
          if (!r.rooms || !Array.isArray(r.rooms)) return;
          const cocok = (o: any) =>
            o?.brand_display_pic_id === currentUser.id
            || o?.brand_display_2_pic_id === currentUser.id
            || o?.brand_middleware_pic_id === currentUser.id;
          const isBrandPic = cocok(r) || r.rooms.some(cocok);
          if (isBrandPic) filtered.push(r as ProjectRequest);
        });
      }
      const selfJabatanPTS = (currentUser).jabatan as string | undefined;
      const isManagerPTS = isTeamPTS && selfJabatanPTS === 'Manager';
      if (isTeamPTS && !isManagerPTS) {
        filtered = filtered.filter(r => !!r.assign_name || r.assigned_supervisor_id === currentUser.id);
      }
      setRequests(filtered);
      const assigned = [...new Set(filtered.map(r => r.assign_name).filter(Boolean) as string[])].sort();
      setPtsMembersList(assigned);
      const ids = filtered.map(r => r.id);
      if (ids.length > 0) {
        const { data: msgData } = await supabase.from('project_messages').select('request_id, created_at')
          .in('request_id', ids).neq('sender_role', 'system').order('created_at', { ascending: false });
        if (msgData) {
          const counts: Record<string, number> = {};
          const stored = JSON.parse(localStorage.getItem('pts_last_seen') || '{}');
          setLastSeenMap(stored);
          for (const row of msgData as { request_id: string; created_at: string }[]) {
            const lastSeen = stored[row.request_id] || 0;
            const msgTime = new Date(row.created_at).getTime();
            if (msgTime > lastSeen) counts[row.request_id] = (counts[row.request_id] || 0) + 1;
          }
          setUnreadMsgMap(counts);
        }
      }
    } else if (error) {
      notify('error', 'Gagal memuat data request: ' + error.message);
    }
    setLoading(false);
    setAppReady(true);
  }, [currentUser.id, currentUser.sales_division, (currentUser).jabatan, isPTS, isIVPGuest]);

  const fetchMessages = useCallback(async (requestId: string) => {
    const { data, error } = await supabase.from('project_messages').select('id,request_id,sender_id,sender_name,sender_role,message,created_at').eq('request_id', requestId).order('created_at', { ascending: true });
    if (!error && data) setMessages(data as ProjectMessage[]);
  }, []);

  const fetchAttachments = useCallback(async (requestId: string) => {
    const { data, error } = await supabase.from('project_attachments').select('id,message_id,request_id,file_name,file_url,file_type,file_size,uploaded_by,uploaded_at,attachment_category,revision_version').eq('request_id', requestId).order('uploaded_at', { ascending: false });
    if (!error && data) {
      const normalized = (data as ProjectAttachment[]).map(a => ({
        ...a,
        attachment_category: (a.attachment_category as string) === 'design3d' ? 'design3d' : a.attachment_category || 'general',
      }));
      setAttachments(normalized);
    }
  }, []);
  return { fetchRequests, fetchMessages, fetchAttachments };
}
