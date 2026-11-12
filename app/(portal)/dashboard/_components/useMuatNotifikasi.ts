'use client';

import { useCallback } from 'react';
import { ingat } from '@/lib/cache-singkat';
import { supabase } from '@/lib/supabase';
import { NotificationItem, User } from './shared';

export interface MuatNotifikasiKonteks {
  batasiLingkup: boolean;
  bolehJadwal: boolean;
  bolehRequire: boolean;
  bolehReview: boolean;
  bolehTiket: boolean;
  currentUser: User;
  isAdmin: boolean;
  kunciLingkup: string;
  lingkupKu: string[];
  roleLC: string;
  setPersonalNotifs: import("react").Dispatch<import("react").SetStateAction<NotificationItem[]>>;
  setPutaranMuat: import("react").Dispatch<import("react").SetStateAction<number>>;
  setReminderNotifs: import("react").Dispatch<import("react").SetStateAction<NotificationItem[]>>;
  setRequireNotifs: import("react").Dispatch<import("react").SetStateAction<NotificationItem[]>>;
  setReviewNotifs: import("react").Dispatch<import("react").SetStateAction<NotificationItem[]>>;
  setTicketNotifs: import("react").Dispatch<import("react").SetStateAction<NotificationItem[]>>;
  teamType: string;
}

export function useMuatNotifikasi(k: MuatNotifikasiKonteks) {
  const { batasiLingkup, bolehJadwal, bolehRequire, bolehReview, bolehTiket, currentUser, isAdmin, kunciLingkup, lingkupKu, roleLC, setPersonalNotifs, setPutaranMuat, setReminderNotifs, setRequireNotifs, setReviewNotifs, setTicketNotifs, teamType } = k;
  const fetchAll = useCallback(async () => {
    let assignedName: string = currentUser.full_name;
    let memberTeamType: string = teamType;
    const kelompokDariNama = new Map<string, string>();
    try {
      const { data: allMembers } = await ingat('team_members:nama-kelompok', () => supabase.from('team_members').select('name, team_type, username'));
      if (allMembers && allMembers.length > 0) {
        for (const m of allMembers as any[]) {
          if (m?.name && m?.team_type) kelompokDariNama.set(String(m.name).trim().toLowerCase(), String(m.team_type));
        }
        const found = (allMembers as any[]).find(m =>
          (m.username ?? '').toLowerCase().trim() === currentUser.username.toLowerCase().trim()
        );
        if (found?.name) assignedName = found.name;
        if (found?.team_type) memberTeamType = found.team_type;
      }
    } catch {  }
    try {
      const { data: semuaAkun } = await ingat('users:team-kelompok', () => supabase.from('users').select('full_name, team_type').eq('role', 'team'));
      for (const u of (semuaAkun ?? []) as any[]) {
        const n = String(u?.full_name ?? '').trim().toLowerCase();
        if (n && u?.team_type && !kelompokDariNama.has(n)) kelompokDariNama.set(n, String(u.team_type));
      }
    } catch {  }

    const dalamLingkup = (nama?: string | null): boolean => {
      if (!batasiLingkup) return true;
      const k = kelompokDariNama.get(String(nama ?? '').trim().toLowerCase());
      return !k || lingkupKu.includes(k);
    };

    const namesToCheck = [...new Set([assignedName, currentUser.full_name].filter(Boolean))];

    try {
      if (isAdmin) {
        const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').neq('status', 'Solved').order('created_at', { ascending: false }).limit(50);
        setTicketNotifs((data ?? []).filter((t: any) => dalamLingkup(t.assign_name)).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
      } else if (roleLC === 'guest') {
        const isIVPUser = currentUser.sales_division === 'IVP';
        if (isIVPUser) {
          const { data: ivpDivMaps } = await supabase
            .from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
          const handledDivs = (ivpDivMaps ?? []).map((m) => m.sales_division as string);
          if (handledDivs.length > 0) {
            const { data } = await supabase.from('tickets')
              .select('id, project_name, issue_case, assign_name, status, created_at, sales_division')
              .in('sales_division', handledDivs).neq('status', 'Solved')
              .order('created_at', { ascending: false }).limit(50);
            setTicketNotifs((data ?? []).map((t: any) => ({
              id: t.id, type: 'ticket' as const,
              title: t.project_name,
              subtitle: `${t.status} · ${t.issue_case} · ${t.sales_division}`,
              time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting',
            })));
          } else { setTicketNotifs([]); }
        } else {
          const q = supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').neq('status', 'Solved')
            .eq('created_by', currentUser.username);
          const { data } = await q.order('created_at', { ascending: false }).limit(30);
          setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        }
      } else if (roleLC === 'team' || roleLC === 'team_pts') {
        if (memberTeamType === 'Team Services') {
          const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, services_status, created_at').in('assign_name', namesToCheck).neq('services_status', 'Solved').not('services_status', 'is', null).order('created_at', { ascending: false }).limit(30);
          setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `Svc: ${t.services_status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        } else {
          const { data: assignedT } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').in('assign_name', namesToCheck).neq('status', 'Solved').order('created_at', { ascending: false }).limit(30);
          let supRoutedT: any[] = [];
          try {
            const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at, routing_status, assigned_supervisor_id').eq('assigned_supervisor_id', currentUser.id).eq('routing_status', 'supervisor_assign').neq('status', 'Solved').order('created_at', { ascending: false }).limit(30);
            supRoutedT = data ?? [];
          } catch { supRoutedT = []; }
          const supTIds = new Set((supRoutedT ?? []).map((t: any) => t.id));
          const seenT = new Set<string>();
          const combinedT = [...(supRoutedT ?? []), ...(assignedT ?? [])].filter((t: any) => { if (seenT.has(t.id)) return false; seenT.add(t.id); return true; });
          setTicketNotifs(combinedT.map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: supTIds.has(t.id) ? `🎯 Perlu di-assign ke tim · ${t.issue_case}` : `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        }
      }
    } catch (e) { console.error('[notif] ticket fetch error:', e); }

    const DONE_STATUSES = ['completed', 'rejected', 'cancelled'];
    const excludeDone = (q: any) => DONE_STATUSES.reduce((acc, s) => acc.neq('status', s), q);
    const toRequireNotif = (r: any) => {
      const _sLbl: Record<string, string> = { pending: '⏳ Pending', approved: '✅ Approved', in_progress: '🔄 In Progress' };
      return { id: r.id, type: 'require' as const, title: r.project_name, subtitle: `${_sLbl[r.status] ?? ('🏗️ ' + r.status)} · ${r.sales_name}`, time: r.created_at, url: '/form-require-project', internalUrl: '/form-require-project', menuTitle: 'Request Design Project' };
    };

    try {
      if (isAdmin) {
        const { data } = await excludeDone(
          supabase.from('project_requests').select('id, project_name, status, sales_name, assign_name, created_at')
        ).order('created_at', { ascending: false }).limit(50);
        setRequireNotifs((data ?? []).filter((r: any) => dalamLingkup(r.assign_name)).map(toRequireNotif));

      } else if (roleLC === 'team' && bolehRequire && !isAdmin) {
        const namesToCheck = [...new Set([assignedName, currentUser.full_name].filter(Boolean))];
        const { data: assignedData } = await excludeDone(
          supabase.from('project_requests')
            .select('id, project_name, status, sales_name, assign_name, created_at')
            .in('assign_name', namesToCheck)
        ).order('created_at', { ascending: false }).limit(30);
        let supRouted: any[] = [];
        try {
          const { data } = await supabase.from('project_requests')
            .select('id, project_name, status, sales_name, assign_name, created_at, routing_status, assigned_supervisor_id')
            .eq('assigned_supervisor_id', currentUser.id).eq('routing_status', 'supervisor_assign')
            .order('created_at', { ascending: false }).limit(30);
          supRouted = data ?? [];
        } catch { supRouted = []; }
        const supIds = new Set((supRouted ?? []).map((r: any) => r.id));
        const seenReq = new Set<string>();
        const combinedReq = [...(supRouted ?? []), ...(assignedData ?? [])]
          .filter((r: any) => { if (seenReq.has(r.id)) return false; seenReq.add(r.id); return true; });
        setRequireNotifs(combinedReq.map((r: any) => supIds.has(r.id)
          ? { id: r.id, type: 'require' as const, title: r.project_name, subtitle: `🎯 Perlu di-assign ke tim · ${r.sales_name}`, time: r.created_at, url: '/form-require-project', internalUrl: '/form-require-project', menuTitle: 'Request Design Project' }
          : toRequireNotif(r)));

      } else if (roleLC === 'guest' || roleLC === 'sales') {
        const isIVPUser2 = currentUser.sales_division === 'IVP' || currentUser.sales_division === 'MVI';
        const BRAND_DIVS = ['MLDS', 'UMP', 'OSS'];
        const isBrandPICNotif = BRAND_DIVS.includes(currentUser.sales_division || '');
        const selfJabatanN = (currentUser as any).jabatan as string | undefined;
        const TIER_MAP: Record<string, number> = { 'Staff': 1, 'Supervisor': 2, 'Manager': 3, 'Deputy General Manager': 4, 'General Manager': 5, 'Direktur': 6 };
        const selfTierN = selfJabatanN ? (TIER_MAP[selfJabatanN] ?? 0) : 0;
        const selfDivN = currentUser.sales_division;

        const [{ data: ownReqs }, { data: ivpAssignedReqs }, { data: atasNamaReqs }] = await Promise.all([
          excludeDone(
            supabase.from('project_requests')
              .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
              .eq('requester_id', currentUser.id)
          ).order('created_at', { ascending: false }).limit(50),
          excludeDone(
            supabase.from('project_requests')
              .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
              .eq('ivp_assignee', currentUser.full_name)
          ).order('created_at', { ascending: false }).limit(50),
          currentUser.full_name
            ? excludeDone(
              supabase.from('project_requests')
                .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
                .eq('sales_name', currentUser.full_name)
            ).order('created_at', { ascending: false }).limit(50)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const baseMap = new Map<string, any>();
        [...(ownReqs ?? []), ...(ivpAssignedReqs ?? []), ...(atasNamaReqs ?? [])].forEach((r: any) => {
          if (!baseMap.has(r.id)) baseMap.set(r.id, r);
        });

        if (isIVPUser2) {
          const { data: ivpDivMaps2 } = await supabase
            .from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
          const handledDivs2 = (ivpDivMaps2 ?? []).map((m) => m.sales_division as string);
          if (handledDivs2.length > 0) {
            const { data: divReqs } = await excludeDone(
              supabase.from('project_requests')
                .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
                .in('sales_division', handledDivs2)
            ).order('created_at', { ascending: false }).limit(50);
            (divReqs ?? []).forEach((r: any) => { if (!baseMap.has(r.id)) baseMap.set(r.id, r); });
          }

        } else if (isBrandPICNotif) {
          const { data: allReqsBrand } = await excludeDone(
            supabase.from('project_requests')
              .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee, rooms')
          ).order('created_at', { ascending: false }).limit(100);
          (allReqsBrand ?? []).forEach((r: any) => {
            if (baseMap.has(r.id)) return;
            if (!r.rooms || !Array.isArray(r.rooms)) return;
            const isBrandPic = r.rooms.some((room: any) =>
              room.brand_display_pic_id === currentUser.id || room.brand_middleware_pic_id === currentUser.id
            );
            if (isBrandPic) baseMap.set(r.id, r);
          });

        } else if (selfTierN > 1 && selfDivN) {
          const { data: supMapsN } = await ingat(`division_supervisor_mappings:${currentUser.id}`, () => supabase.from('division_supervisor_mappings')
            .select('sales_division').eq('supervisor_id', currentUser.id));
          const supDivsN = (supMapsN ?? []).map((m) => m.sales_division as string);
          if (!supDivsN.includes(selfDivN)) supDivsN.push(selfDivN);

          const { data: allGuestsN } = await ingat('users:guest-sales', () => supabase.from('users')
            .select('id, full_name, jabatan, sales_division').in('role', ['guest', 'sales']));
          const bawahanN = (allGuestsN ?? [])
            .filter((u: any) => (TIER_MAP[(u.jabatan as string) ?? ''] ?? 0) < selfTierN && supDivsN.includes(u.sales_division));
          const subIdsN = bawahanN.map((u) => u.id as string);
          const subNamesN = bawahanN.map((u) => u.full_name as string).filter(Boolean);

          if (subNamesN.length > 0) {
            const { data: subAtasNama } = await excludeDone(
              supabase.from('project_requests')
                .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
                .in('sales_name', subNamesN)
            ).order('created_at', { ascending: false }).limit(50);
            (subAtasNama ?? []).forEach((r: any) => { if (!baseMap.has(r.id)) baseMap.set(r.id, r); });
          }

          if (subIdsN.length > 0) {
            const { data: subReqs } = await excludeDone(
              supabase.from('project_requests')
                .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
                .in('requester_id', subIdsN)
            ).order('created_at', { ascending: false }).limit(50);
            (subReqs ?? []).forEach((r: any) => { if (!baseMap.has(r.id)) baseMap.set(r.id, r); });
          }
        }

        setRequireNotifs(Array.from(baseMap.values()).map(toRequireNotif));
      } else { setRequireNotifs([]); }
    } catch (e) { console.error('[notif] require fetch error:', e); }

    try {
      if (isAdmin) {
        const { data } = await supabase
          .from('reminders')
          .select('id, project_name, category, due_date, status, assigned_to, assign_name, sales_name, sales_division, routing_status, created_at')
          .neq('status', 'done')
          .neq('status', 'cancelled')
          .order('due_date', { ascending: true })
          .limit(30);
        setReminderNotifs((data ?? []).filter((r: any) => dalamLingkup(r.assign_name)).map((r: any) => ({
          id: r.id,
          type: 'reminder' as const,
          title: r.project_name,
          subtitle: (r.routing_status === 'admin_review' && !r.assigned_to)
            ? `✅ Perlu approval kamu · ${r.category} · ${r.due_date}`
            : `🗓️ ${r.category} · ${r.due_date}${r.sales_name ? ' · ' + r.sales_name : ''}`,
          time: r.created_at,
          url: '/reminder-schedule',
          internalUrl: '/reminder-schedule',
          menuTitle: 'Request Schedule',
        })));
      } else if (roleLC === 'team') {
        const selfJabatanTeam = (currentUser as any).jabatan as string | undefined;
        const isManagerTeam = selfJabatanTeam === 'Manager';
        const [{ data: assignedToMe }, { data: needsMyAssign }, { data: needsMyApproval }] = await Promise.all([
          supabase.from('reminders')
            .select('id, project_name, category, due_date, status, assigned_to, created_at')
            .neq('status', 'done').neq('status', 'cancelled')
            .eq('assigned_to', currentUser.username)
            .order('due_date', { ascending: true }).limit(20),
          supabase.from('reminders')
            .select('id, project_name, category, due_date, status, assigned_to, created_at')
            .eq('assigned_supervisor_id', currentUser.id).eq('routing_status', 'supervisor_assign')
            .order('created_at', { ascending: false }).limit(20),
          isManagerTeam
            ? supabase.from('reminders')
                .select('id, project_name, category, due_date, status, assigned_to, created_at')
                .eq('routing_status', 'admin_review')
                .order('created_at', { ascending: false }).limit(20)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        const needsMyApprovalFiltered = (needsMyApproval ?? []).filter((r: any) => !r.assigned_to);
        const needsAssignIds = new Set((needsMyAssign ?? []).map((r) => r.id));
        const needsApprovalIds = new Set(needsMyApprovalFiltered.map((r: any) => r.id));
        const seenTeam = new Set<string>();
        const combinedTeam = [...needsMyApprovalFiltered, ...(needsMyAssign ?? []), ...(assignedToMe ?? [])]
          .filter((r: any) => { if (seenTeam.has(r.id)) return false; seenTeam.add(r.id); return true; });
        setReminderNotifs(combinedTeam.map((r: any) => ({
          id: r.id,
          type: 'reminder' as const,
          title: r.project_name,
          subtitle: needsApprovalIds.has(r.id)
            ? `✅ Perlu approval kamu · ${r.category} · ${r.due_date}`
            : needsAssignIds.has(r.id)
            ? `🎯 Perlu di-assign · ${r.category} · ${r.due_date}`
            : `🗓️ ${r.category} · ${r.due_date}`,
          time: r.created_at,
          url: '/reminder-schedule',
          internalUrl: '/reminder-schedule',
          menuTitle: 'Request Schedule',
        })));
      } else if (roleLC === 'guest' || roleLC === 'sales') {
        const [{ data: ownReminders }, { data: awaitingReview }] = await Promise.all([
          supabase.from('reminders')
            .select('id, project_name, category, due_date, status, sales_name, created_at')
            .eq('sales_name', currentUser.full_name).neq('status', 'done').neq('status', 'cancelled')
            .order('due_date', { ascending: true }).limit(20),
          supabase.from('reminders')
            .select('id, project_name, category, due_date, status, sales_name, created_at')
            .eq('internal_sales_id', currentUser.id).eq('routing_status', 'internal_review')
            .order('created_at', { ascending: false }).limit(20),
        ]);
        const reviewIds = new Set((awaitingReview ?? []).map((r) => r.id));
        const seen = new Set<string>();
        const combined = [...(awaitingReview ?? []), ...(ownReminders ?? [])]
          .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
        setReminderNotifs(combined.map((r: any) => ({
          id: r.id,
          type: 'reminder' as const,
          title: r.project_name,
          subtitle: reviewIds.has(r.id)
            ? `🔍 Perlu review kamu · ${r.category} · ${r.due_date}`
            : `🗓️ ${r.category} · ${r.due_date}`,
          time: r.created_at,
          url: '/reminder-schedule',
          internalUrl: '/reminder-schedule',
          menuTitle: 'Request Schedule',
        })));
      } else { setReminderNotifs([]); }
    } catch (e) { console.error('[notif] reminder fetch error:', e); }

    try {
      if (isAdmin) {
        const { data } = await supabase.from('form_reviews')
          .select('id, project_name, reminder_category, sales_name, assign_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
          .order('created_at', { ascending: false }).limit(50);
        const pending = (data ?? []).filter((r) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        ).filter((r) => dalamLingkup(r.assign_name));
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else if (roleLC === 'team' && bolehReview) {
        const { data } = await supabase.from('form_reviews').select('id, project_name, reminder_category, sales_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer').in('assign_name', namesToCheck).order('created_at', { ascending: false }).limit(30);
        const pending = (data ?? []).filter((r) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        );
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else if (roleLC === 'guest' || roleLC === 'sales') {
        const { data } = await supabase.from('form_reviews')
          .select('id, project_name, reminder_category, sales_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
          .eq('sales_name', currentUser.full_name)
          .order('created_at', { ascending: false }).limit(30);
        const pending = (data ?? []).filter((r) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        );
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else { setReviewNotifs([]); }
    } catch (e) { console.error('[notif] review fetch error:', e); }

    try {
      const { data: pn } = await supabase
        .from('notifications')
        .select('id, type, title, body, action_url, ref_id, created_at')
        .eq('user_id', currentUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(30);
      setPersonalNotifs((pn ?? []).map((n: any) => ({
        id: n.id,
        type: 'ticket' as const,
        title: n.title,
        subtitle: n.body ?? '',
        time: n.created_at,
        url: n.action_url ?? '/dashboard',
        internalUrl: n.action_url ?? '',
        menuTitle: 'Notifikasi',
        refId: n.ref_id ?? undefined,
      })));
    } catch {  }
    setPutaranMuat(n => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAdmin, roleLC, teamType, bolehTiket, bolehRequire, bolehJadwal, bolehReview, batasiLingkup, kunciLingkup]);
  return { fetchAll };
}
