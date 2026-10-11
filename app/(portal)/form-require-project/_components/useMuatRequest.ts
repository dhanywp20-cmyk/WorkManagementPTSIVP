'use client';

/** useMuatRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
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
    // Request yang DIBUATKAN admin/PTS (atau Sales Internal) atas nama Sales lain
    // menyimpan requester_id = si pembuat, sedangkan Sales yang dituju hanya
    // tercatat di sales_name. Tanpa klausa ini Sales itu tidak pernah melihat
    // request atas namanya sendiri, walau RLS di database sudah mengizinkan
    // (boleh_lihat_baris mencocokkan sales_name) - yang menahannya di sini.
    // Dicocokkan lewat nama, sama seperti canEdit & RLS; dikutip supaya nama
    // yang memuat koma/titik tidak merusak sintaks or() PostgREST.
    const kutip = (n: string) => `"${n.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const atasNama = (nama?: string | null) => (nama ? `sales_name.eq.${kutip(nama)}` : '');
    if (isPTS || pimpinan) {
      // admin/superadmin: semua request; team PTS: semua request (filter assign di UI); pimpinan: semua, hanya baca
    } else if (isIVPGuest) {
      const { data: ivpDivMaps } = await supabase.from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
      const handledDivisions = (ivpDivMaps ?? []).map((m: any) => m.sales_division as string);
      // Reviewer (internal_sales_id / _2) sudah ter-cover divFilter di bawah karena
      // reviewer selalu di-mapping ke divisi ybs. (Tidak menaruh internal_sales_id_2 di
      // .or() supaya query tak error kalau kolomnya belum ada / migrasi belum di-run.)
      const divFilter = handledDivisions.map((d: string) => `sales_division.eq.${d}`).join(',');
      query = query.or([
        `requester_id.eq.${currentUser.id}`, `ivp_assignee.eq.${currentUser.full_name}`,
        atasNama(currentUser.full_name), divFilter,
      ].filter(Boolean).join(','));
    } else {
      // non-IVP guest: cek jabatan tier untuk supervisor visibility + brand PIC
      const selfJabatan = (currentUser as any).jabatan as string | undefined;
      const selfTier = selfJabatan ? (JABATAN_TIER[selfJabatan] ?? 0) : 0;
      const selfDiv = currentUser.sales_division;
      const isBrandPICUser = currentUser.team_type === 'Marketing';

      // Supervisor tier > 1: lihat request bawahan di divisi sendiri + divisi yang di-supervisi
      if (selfTier > 1 && selfDiv) {
        const { data: supMaps } = await supabase.from('division_supervisor_mappings').select('sales_division').eq('supervisor_id', currentUser.id);
        const supDivisions = (supMaps ?? []).map((m: any) => m.sales_division as string);
        if (!supDivisions.includes(selfDiv)) supDivisions.push(selfDiv);

        // Ambil subordinate ids (tier lebih rendah)
        const { data: allGuests } = await supabase.from('users').select('id, full_name, jabatan, sales_division').eq('role', 'guest');
        const subIds = (allGuests ?? [])
          .filter((u: any) => (JABATAN_TIER[(u.jabatan as string) || ''] ?? 0) < selfTier && supDivisions.includes(u.sales_division))
          .map((u: any) => u.id as string);

        // Also include manual user_supervisor_mappings
        const { data: manualSubs } = await supabase.from('user_supervisor_mappings').select('user_id').eq('supervisor_id', currentUser.id);
        (manualSubs ?? []).forEach((m: any) => { if (!subIds.includes(m.user_id)) subIds.push(m.user_id); });

        if (subIds.length > 0) {
          const namaBawahan: string[] = subIds
            .map((id: string) => (allGuests ?? []).find((u: any) => u.id === id)?.full_name as string | undefined)
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
        // Staff biasa: request miliknya + request yang diatasnamakan dirinya
        query = query.or([`requester_id.eq.${currentUser.id}`, atasNama(currentUser.full_name)].filter(Boolean).join(','));
      }
    }
    const { data, error } = await query;
    if (!error && data) {
      let filtered = data as ProjectRequest[];
      // Brand PIC: tambahkan request yang brand pic-nya = user ini (dari rooms JSONB)
      const selfDiv = currentUser.sales_division;
      if (!isPTS && !isIVPGuest && !pimpinan && currentUser.team_type === 'Marketing') {
        // Kolom brand Ruangan 1 ikut diambil, dengan jalur mundur: kolomnya
        // baru ada setelah sql/design-project-brand-display-2.sql dijalankan,
        // dan PostgREST menolak SELURUH query kalau satu kolom tak dikenal.
        const KOLOM_DASAR = 'id, project_name, status, sales_name, created_at, rooms, requester_id';
        const KOLOM_BRAND = 'brand_display_pic_id, brand_display_2_pic_id, brand_middleware_pic_id';
        let allReqsRes = await supabase.from('project_requests')
          .select(`${KOLOM_DASAR}, ${KOLOM_BRAND}`).order('created_at', { ascending: false });
        if (allReqsRes.error) {
          allReqsRes = await supabase.from('project_requests')
            .select(KOLOM_DASAR).order('created_at', { ascending: false });
        }
        const allReqs = allReqsRes.data;
        (allReqs ?? []).forEach((r: any) => {
          if (filtered.find(x => x.id === r.id)) return;
          if (!r.rooms || !Array.isArray(r.rooms)) return;
          // brand_display_2_pic_id WAJIB ikut dicek: tanpa itu, PIC display
          // kedua tidak akan pernah melihat request-nya sama sekali - slot
          // display keduanya jadi sekadar catatan, bukan penugasan.
          // Ruangan 1 disimpan di kolom tabel (r.brand_*), ruangan ke-2 dst di
          // r.rooms - keduanya harus dicek, kalau tidak PIC Ruangan 1 tidak
          // pernah melihat request-nya.
          const cocok = (o: any) =>
            o?.brand_display_pic_id === currentUser.id
            || o?.brand_display_2_pic_id === currentUser.id
            || o?.brand_middleware_pic_id === currentUser.id;
          const isBrandPic = cocok(r) || r.rooms.some(cocok);
          if (isBrandPic) filtered.push(r as ProjectRequest);
        });
      }
      // Visibility (catatan spec): anggota tim PTS biasa (bukan admin, bukan
      // Manager) HANYA boleh lihat request yg SUDAH di-assign ke handler
      // (assign_name terisi). Request yg masih pending approval / belum di-assign
      // disembunyikan. Admin/superadmin & Manager tetap lihat semua.
      const selfJabatanPTS = (currentUser as any).jabatan as string | undefined;
      const isManagerPTS = isTeamPTS && selfJabatanPTS === 'Manager';
      if (isTeamPTS && !isManagerPTS) {
        // Tampil kalau sudah di-assign ke handler (assign_name) ATAU kalau
        // request di-route ke user ini sbg Supervisor utk di-assign lanjut.
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
      // Tanpa ini, gagal fetch (RLS, jaringan putus, dst) tampil identik
      // dengan "memang belum ada request" - daftar tetap pada nilai
      // sebelumnya tanpa penjelasan apa pun ke user.
      notify('error', 'Gagal memuat data request: ' + error.message);
    }
    setLoading(false);
    setAppReady(true);
  }, [currentUser.id, currentUser.sales_division, (currentUser as any).jabatan, isPTS, isIVPGuest]);

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
