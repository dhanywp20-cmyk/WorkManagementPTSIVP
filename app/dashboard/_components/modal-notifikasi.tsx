'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

import { hasFullAccess } from '@/lib/constants';
import {
  loncengTampil, useKelompok, useLingkupManager, lingkupSaya, namaKelompokPTS,
  type Lonceng,
} from '@/lib/kelompok';

import { User, NotificationItem, NotifBellProps } from './shared';
import { markAllNotifsRead } from '@/lib/notifications';

// Notification Bell Component

export function NotifBell({ icon, label, count, color, bgColor, borderColor, dotColor, items, onItemClick, onMarkAllRead }: NotifBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m lalu`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}j lalu`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: count > 0 ? bgColor : 'rgba(255,255,255,0.55)',
          border: `1.5px solid ${count > 0 ? borderColor : 'rgba(0,0,0,0.1)'}`,
          boxShadow: count > 0 ? `0 2px 12px ${borderColor}55` : 'none',
        }}
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="text-xs font-bold hidden sm:block" style={{ color: count > 0 ? color : '#64748b' }}>{label}</span>
        {count > 0 && (
          <span className="flex items-center justify-center rounded-full text-white font-black text-[10px] min-w-[18px] h-[18px] px-1 animate-pulse"
            style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}88` }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
        {count === 0 && <span className="text-[10px] font-semibold text-slate-400">0</span>}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-[40] rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 320,
            background: 'rgba(255,255,255,0.97)',
            border: `1.5px solid ${borderColor}`,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px ${borderColor}33`,
            animation: 'dropIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: bgColor, borderBottom: `1px solid ${borderColor}44` }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-bold" style={{ color }}>{label}</span>
            </div>
            {count > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: dotColor }}>{count} baru</span>
            )}
          </div>
          {onMarkAllRead && count > 0 && (
            <button onClick={() => onMarkAllRead()}
              className="w-full text-center py-2 text-[11px] font-bold hover:bg-slate-50 transition-colors border-b border-slate-100"
              style={{ color }}>
              ✓ Tandai semua dibaca
            </button>
          )}
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-3xl opacity-40">✅</span>
                <p className="text-xs text-slate-400 font-medium">Tidak ada notifikasi</p>
              </div>
            ) : (
              items.map((item) => (
                <button key={item.id} onClick={() => { onItemClick(item); setOpen(false); }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100/80 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{item.title}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{formatTime(item.time)}</span>
                </button>
              ))
            )}
          </div>
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100">
              <p className="text-[10px] text-center text-slate-400 font-medium">Klik item untuk membuka</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Notification Bar Component
interface NotificationBarProps {
  currentUser: User;
  onNavigate: (internalUrl: string, title: string) => void;
}

export function NotificationBar({ currentUser, onNavigate }: NotificationBarProps) {
  const [ticketNotifs, setTicketNotifs]   = useState<NotificationItem[]>([]);
  const [requireNotifs, setRequireNotifs] = useState<NotificationItem[]>([]);
  const [reminderNotifs, setReminderNotifs] = useState<NotificationItem[]>([]);
  const [reviewNotifs, setReviewNotifs]   = useState<NotificationItem[]>([]);
  // User-specific in-app notifications (from `notifications` table)
  const [personalNotifs, setPersonalNotifs] = useState<NotificationItem[]>([]);

  const roleLC = (currentUser.role ?? '').trim().toLowerCase();
  const teamType = (currentUser.team_type ?? '').trim();
  // isAdmin di sini dipakai sebagai "lihat SEMUA notifikasi" (bukan hak kelola
  // akun) - jadi ikut diperluas ke akun Team PTS dengan toggle "Full Access"
  // aktif (lihat lib/constants.ts hasFullAccess), mis. Manager PTS.
  const isAdmin = ['admin', 'superadmin'].includes(roleLC) || hasFullAccess(currentUser);

  /**
   * Lonceng mana yang tampil - dibaca dari pengaturan kelompok di Admin Panel,
   * bukan dari deretan syarat yang menyebut nama kelompok satu per satu.
   *
   * Bentuk lama itulah yang membuat Team PTS MVI tidak pernah mendapat lonceng
   * Ticket, Require, dan Review: namanya memang tidak pernah disebut, dan
   * tidak ada tempat untuk memperbaikinya selain menyunting kode. Sekarang
   * kelompok baru cukup didaftarkan sekali beserta hak loncengnya.
   *
   * useKelompok() ikut dipanggil supaya lonceng dirender ulang begitu
   * pengaturannya termuat - tanpa itu, hak yang baru disimpan baru terlihat
   * setelah halaman dibuka ulang.
   */
  useKelompok();
  const bolehLonceng = (l: Lonceng) => loncengTampil({ peranAdmin: isAdmin, teamType, lonceng: l });
  const bolehTiket = bolehLonceng('tiket');
  const bolehRequire = bolehLonceng('require');
  const bolehJadwal = bolehLonceng('jadwal');
  const bolehReview = bolehLonceng('review');

  /**
   * Kelompok yang dibawahi akun ini. Akun yang TIDAK dipetakan di Admin Panel
   * mendapat seluruh kelompok, jadi selama belum ada satu pun pemetaan,
   * penyaringan di bawah tidak mengubah apa pun.
   *
   * Yang disaring hanya daftar milik akun berjangkauan luas (admin / Full
   * Access). Anggota tim biasa sudah tersaring lebih dulu oleh namanya
   * sendiri, jadi lingkup tidak menambah apa-apa di sana.
   */
  useLingkupManager();
  const lingkupKu = lingkupSaya(currentUser.id);
  const batasiLingkup = isAdmin && lingkupKu.length < namaKelompokPTS().length;
  // Dependensi berupa TEKS, bukan lariknya. lingkupSaya() membuat larik baru
  // tiap render; memakainya langsung sebagai dependensi membuat fetchAll
  // dibuat ulang tiap render, dan effect yang bergantung padanya berputar
  // tanpa henti - satu query ke database tiap kali komponen dirender.
  const kunciLingkup = lingkupKu.join('|');

  const fetchAll = useCallback(async () => {
    let assignedName: string = currentUser.full_name;
    let memberTeamType: string = teamType;
    /** Nama pelaksana -> kelompoknya. Dipakai menyaring menurut lingkup. */
    const kelompokDariNama = new Map<string, string>();
    try {
      const { data: allMembers } = await supabase.from('team_members').select('name, team_type, username');
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
    } catch { /* fallback */ }
    // users melengkapi team_members: sebagian orang hanya ada di salah satunya,
    // dan nama yang tidak ketemu kelompoknya akan lolos penyaringan di bawah.
    try {
      const { data: semuaAkun } = await supabase.from('users').select('full_name, team_type').eq('role', 'team');
      for (const u of (semuaAkun ?? []) as any[]) {
        const n = String(u?.full_name ?? '').trim().toLowerCase();
        if (n && u?.team_type && !kelompokDariNama.has(n)) kelompokDariNama.set(n, String(u.team_type));
      }
    } catch { /* fallback */ }

    /**
     * Saring menurut lingkup kelompok yang dibawahi akun ini.
     *
     * Akun tanpa pemetaan mendapat SELURUH kelompok, jadi baris ini tidak
     * mengubah apa pun sampai ada Manager yang benar-benar dipetakan - lihat
     * lingkupSaya() di lib/kelompok.ts.
     *
     * Nama yang TIDAK ketemu kelompoknya sengaja dibiarkan lolos: lebih baik
     * seorang Manager melihat satu baris yang bukan bagiannya daripada
     * kehilangan pekerjaan timnya sendiri hanya karena namanya berbeda tipis
     * antara users dan team_members.
     */
    const dalamLingkup = (nama?: string | null): boolean => {
      if (!batasiLingkup) return true;
      const k = kelompokDariNama.get(String(nama ?? '').trim().toLowerCase());
      return !k || lingkupKu.includes(k);
    };

    // Nama-nama yang mungkin dipakai sebagai assign_name di berbagai tabel
    // (cover perbedaan nama di team_members vs nama asli user)
    const namesToCheck = [...new Set([assignedName, currentUser.full_name].filter(Boolean))];

    // 1. Ticket Troubleshooting
    try {
      if (isAdmin) {
        const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').neq('status', 'Solved').order('created_at', { ascending: false }).limit(50);
        setTicketNotifs((data ?? []).filter((t: any) => dalamLingkup(t.assign_name)).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
      } else if (roleLC === 'guest') {
        const isIVPUser = currentUser.sales_division === 'IVP';
        if (isIVPUser) {
          // IVP: notif ticket dari semua divisi yang dia handle
          const { data: ivpDivMaps } = await supabase
            .from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
          const handledDivs = (ivpDivMaps ?? []).map((m: any) => m.sales_division as string);
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
          // Non-IVP guest: existing logic
          const { data: mappings } = await supabase.from('guest_mappings').select('project_name').eq('guest_username', currentUser.username);
          const mapped = (mappings ?? []).map((m: any) => m.project_name as string);
          let q = supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').neq('status', 'Solved');
          if (mapped.length > 0) {
            q = q.or(`created_by.eq.${currentUser.username},project_name.in.(${mapped.map((p: string) => `"${p}"`).join(',')})`);
          } else {
            q = q.eq('created_by', currentUser.username);
          }
          const { data } = await q.order('created_at', { ascending: false }).limit(30);
          setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        }
      } else if (roleLC === 'team' || roleLC === 'team_pts') {
        if (memberTeamType === 'Team Services') {
          // Fix: pakai .in() agar match meskipun nama beda antara team_members vs tickets
          const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, services_status, created_at').in('assign_name', namesToCheck).neq('services_status', 'Solved').not('services_status', 'is', null).order('created_at', { ascending: false }).limit(30);
          setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `Svc: ${t.services_status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        } else {
          // Ticket yg di-assign ke user + ticket yg di-route ke dia sbg Supervisor.
          const { data: assignedT } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').in('assign_name', namesToCheck).neq('status', 'Solved').order('created_at', { ascending: false }).limit(30);
          // Query supervisor-routed dipisah + di-try supaya kalau kolom routing belum
          // ada (migrasi belum di-run) badge ticket lain tetap tampil, tidak kosong.
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

    // 2. Form Require Project
    // Helper: status yang dianggap "selesai" - exclude dari notif
    const DONE_STATUSES = ['completed', 'rejected', 'cancelled'];
    const excludeDone = (q: any) => DONE_STATUSES.reduce((acc, s) => acc.neq('status', s), q);
    // Helper: build notif item dari row
    const toRequireNotif = (r: any) => {
      const _sLbl: Record<string, string> = { pending: '⏳ Pending', approved: '✅ Approved', in_progress: '🔄 In Progress' };
      return { id: r.id, type: 'require' as const, title: r.project_name, subtitle: `${_sLbl[r.status] ?? ('🏗️ ' + r.status)} · ${r.sales_name}`, time: r.created_at, url: '/form-require-project', internalUrl: '/form-require-project', menuTitle: 'Request Design Project' };
    };

    try {
      if (isAdmin) {
        // Admin/superadmin: semua request aktif
        const { data } = await excludeDone(
          supabase.from('project_requests').select('id, project_name, status, sales_name, assign_name, created_at')
        ).order('created_at', { ascending: false }).limit(50);
        setRequireNotifs((data ?? []).filter((r: any) => dalamLingkup(r.assign_name)).map(toRequireNotif));

      } else if (roleLC === 'team' && bolehRequire && !isAdmin) {
        // Team PTS: request yang di-assign ke mereka (cek dua nama: dari team_members DAN full_name login)
        // Ini fix utama: assign_name bisa pakai nama team_members ATAU currentUser.full_name
        // + request yang di-route ke user ini sbg Supervisor (perlu di-assign lanjut).
        const namesToCheck = [...new Set([assignedName, currentUser.full_name].filter(Boolean))];
        const { data: assignedData } = await excludeDone(
          supabase.from('project_requests')
            .select('id, project_name, status, sales_name, assign_name, created_at')
            .in('assign_name', namesToCheck)
        ).order('created_at', { ascending: false }).limit(30);
        // Query supervisor-routed dipisah supaya kalau kolom assigned_supervisor_id
        // belum ada (migrasi belum di-run) badge require lain tetap tampil.
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

        // Base: selalu ambil milik sendiri + yang di-assign via ivp_assignee
        // Ini cover semua kasus termasuk Hendri yang request-nya di-assign ke dia
        const [{ data: ownReqs }, { data: ivpAssignedReqs }] = await Promise.all([
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
        ]);

        // Mulai dengan set base (milik sendiri + di-assign ke user ini)
        const baseMap = new Map<string, any>();
        [...(ownReqs ?? []), ...(ivpAssignedReqs ?? [])].forEach((r: any) => {
          if (!baseMap.has(r.id)) baseMap.set(r.id, r);
        });

        // Extended scope berdasarkan role
        if (isIVPUser2) {
          // IVP guest: tambahkan request dari divisi yang dia handle via mapping
          const { data: ivpDivMaps2 } = await supabase
            .from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
          const handledDivs2 = (ivpDivMaps2 ?? []).map((m: any) => m.sales_division as string);
          if (handledDivs2.length > 0) {
            const { data: divReqs } = await excludeDone(
              supabase.from('project_requests')
                .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
                .in('sales_division', handledDivs2)
            ).order('created_at', { ascending: false }).limit(50);
            (divReqs ?? []).forEach((r: any) => { if (!baseMap.has(r.id)) baseMap.set(r.id, r); });
          }

        } else if (isBrandPICNotif) {
          // Brand PIC (MLDS/UMP/OSS): tambahkan request yang brand pic-nya = user ini
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
          // Supervisor+: tambahkan request dari bawahan di divisi yang di-supervisi
          const { data: supMapsN } = await supabase.from('division_supervisor_mappings')
            .select('sales_division').eq('supervisor_id', currentUser.id);
          const supDivsN = (supMapsN ?? []).map((m: any) => m.sales_division as string);
          if (!supDivsN.includes(selfDivN)) supDivsN.push(selfDivN);

          const { data: allGuestsN } = await supabase.from('users')
            .select('id, jabatan, sales_division').in('role', ['guest', 'sales']);
          const subIdsN = (allGuestsN ?? [])
            .filter((u: any) => (TIER_MAP[(u.jabatan as string) ?? ''] ?? 0) < selfTierN && supDivsN.includes(u.sales_division))
            .map((u: any) => u.id as string);

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

    // 3. Request Schedule
    try {
      if (isAdmin) {
        // Admin: semua reminder aktif (tidak done/cancelled)
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
        // Team PTS (IVP/UMP/MVI, termasuk Supervisor & Manager): jadwal aktif yang
        // di-assign ke diri sendiri + request yang MENUNGGU DI-ASSIGN dia sbg
        // Supervisor (assigned_supervisor_id + routing_status='supervisor_assign')
        // + kalau dia Manager (jabatan='Manager'), request yang MENUNGGU APPROVAL
        // dia (routing_status='admin_review'). Manager ber-role='team', jadi
        // tanpa cabang ini item yang perlu di-approve tidak pernah dapat badge.
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
        // routing_status='admin_review' bisa jadi stale (belum di-clear) meski
        // assigned_to sudah terisi - saring client-side, jangan andalkan filter DB.
        const needsMyApprovalFiltered = (needsMyApproval ?? []).filter((r: any) => !r.assigned_to);
        const needsAssignIds = new Set((needsMyAssign ?? []).map((r: any) => r.id));
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
        // Guest/Sales (termasuk Marketing & Sales Internal): reminder miliknya
        // sendiri yang aktif + request yang MENUNGGU REVIEW dia (Sales Internal,
        // Fase 2 routing pipeline).
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
        const reviewIds = new Set((awaitingReview ?? []).map((r: any) => r.id));
        const seen = new Set<string>();
        const combined = [...(awaitingReview ?? []), ...(ownReminders ?? [])]
          .filter((r: any) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
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

    // 4. Form Review
    try {
      if (isAdmin) {
        // Admin/superadmin: semua review yang belum di-grade
        const { data } = await supabase.from('form_reviews')
          .select('id, project_name, reminder_category, sales_name, assign_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
          .order('created_at', { ascending: false }).limit(50);
        const pending = (data ?? []).filter((r: any) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        ).filter((r: any) => dalamLingkup(r.assign_name));
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else if (roleLC === 'team' && bolehReview) {
        // Team PTS: review yang di-assign ke mereka dan belum di-grade
        const { data } = await supabase.from('form_reviews').select('id, project_name, reminder_category, sales_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer').in('assign_name', namesToCheck).order('created_at', { ascending: false }).limit(30);
        const pending = (data ?? []).filter((r: any) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        );
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else if (roleLC === 'guest' || roleLC === 'sales') {
        // Guest & Sales: review yang ditujukan untuk mereka (sales_name = full_name) dan belum di-grade
        const { data } = await supabase.from('form_reviews')
          .select('id, project_name, reminder_category, sales_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
          .eq('sales_name', currentUser.full_name)
          .order('created_at', { ascending: false }).limit(30);
        const pending = (data ?? []).filter((r: any) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        );
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else { setReviewNotifs([]); }
    } catch (e) { console.error('[notif] review fetch error:', e); }

    // 5. Personal / System Notifications (from `notifications` table)
    try {
      const { data: pn } = await supabase
        .from('notifications')
        .select('id, type, title, body, action_url, created_at')
        .eq('user_id', currentUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(30);
      setPersonalNotifs((pn ?? []).map((n: any) => ({
        id: n.id,
        type: 'ticket' as const,   // generic type for rendering
        title: n.title,
        subtitle: n.body ?? '',
        time: n.created_at,
        url: n.action_url ?? '/dashboard',
        internalUrl: n.action_url ?? '',
        menuTitle: 'Notifikasi',
      })));
    } catch { /* notifications table might not exist yet — fail silently */ }
    // Keempat izin ikut jadi dependensi: kalau tidak, pengaturan lonceng yang
    // baru disimpan akan mengubah tombolnya tapi tidak isinya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAdmin, roleLC, teamType, bolehTiket, bolehRequire, bolehJadwal, bolehReview, batasiLingkup, kunciLingkup]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 120_000); // setiap 2 menit
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const ch1 = supabase.channel('dash-notif-tickets-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    const ch2 = supabase.channel('dash-notif-requires-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    const ch3 = supabase.channel('dash-notif-reminders-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    const ch4 = supabase.channel('dash-notif-reviews-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'form_reviews' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    const ch5 = supabase.channel(`dash-notif-personal-${currentUser.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, () => { setTimeout(fetchAll, 400); }).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); supabase.removeChannel(ch5); };
  }, [fetchAll]);

  const handleClick = (item: NotificationItem) => {
    // Mark personal notification as read if it came from the `notifications` table
    if (personalNotifs.find(n => n.id === item.id)) {
      supabase.from('notifications').update({ is_read: true }).eq('id', item.id)
        .then(() => setPersonalNotifs(p => p.filter(n => n.id !== item.id)))
        .catch(() => {});
    }
    if (item.internalUrl) onNavigate(item.internalUrl, item.menuTitle);
  };

  const handleMarkAllPersonalRead = () => {
    const sebelum = personalNotifs;
    setPersonalNotifs([]);
    markAllNotifsRead(currentUser.id).catch(() => {
      // Gagal di server - kembalikan tanda supaya tidak terlihat "sudah dibaca"
      // padahal masih tersimpan belum-dibaca di database.
      setPersonalNotifs(sebelum);
    });
  };

  /*
    C1 (docs/UX-WORKFLOW-AUDIT.md): personalNotifs (tabel `notifications` -
    peringatan KPI, "user baru menunggu approval", dst.) dulu di-fetch tapi
    TIDAK PERNAH dirender - tidak ada lonceng, tidak ada dropdown. Sekarang
    ikut render sebagai lonceng seperti Ticket/Require/Reminder/Review, dan
    ikut dihitung ke totalCount (badge merah ringkasan) - alasan lama
    mengeluarkannya ("tak punya chip") sudah tidak berlaku karena sekarang
    chip-nya ada.
  */
  const totalCount = ticketNotifs.length + requireNotifs.length + reminderNotifs.length + reviewNotifs.length + personalNotifs.length;

  // Personal bell is shown to ALL users regardless of team type
  // Other bells still respect team-type gating
  const hasAnyBell = true; // personal notif bell always renders

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
      {/* Total count badge — di depan (kiri) */}
      {totalCount > 0 ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0 mr-1"
          style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 1px 4px rgba(220,38,38,0.35)' }}>
          <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-white font-bold text-xs leading-none">{totalCount}</span>
        </div>
      ) : (
        <div className="flex items-center justify-center px-2 py-1 rounded-lg flex-shrink-0 mr-1"
          style={{ background: 'rgba(0,0,0,0.05)' }}>
          <svg aria-hidden="true" focusable="false" className="w-4 h-4" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
      )}
      {/* Separator — hidden on small mobile */}
      <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.09)' }} />
      {/* Individual bells — hidden on small mobile (summary badge is enough) */}
      <div className="hidden sm:flex items-center gap-1">
        {/* Ticket */}
        {bolehTiket && (
          <NotifBell icon="🎫" label="Ticket" count={ticketNotifs.length} color="#be123c" bgColor="rgba(254,205,211,0.6)" borderColor="#fda4af" dotColor="#e11d48" items={ticketNotifs} onItemClick={handleClick} />
        )}
        {/* Require */}
        {bolehRequire && (
          <NotifBell icon="🏗️" label="Require" count={requireNotifs.length} color="#7e22ce" bgColor="rgba(233,213,255,0.6)" borderColor="#c4b5fd" dotColor="#9333ea" items={requireNotifs} onItemClick={handleClick} />
        )}
        {/* Reminder — semua Team PTS (IVP/UMP/MVI), bukan cuma IVP, supaya Supervisor
            tim mana pun tetap dapat badge "perlu di-assign" (routing pipeline). */}
        {bolehJadwal && (
          <NotifBell icon="🗓️" label="Reminder" count={reminderNotifs.length} color="#0e7490" bgColor="rgba(207,250,254,0.6)" borderColor="#67e8f9" dotColor="#0891b2" items={reminderNotifs} onItemClick={handleClick} />
        )}
        {/* Review */}
        {bolehReview && (
          <NotifBell icon="⭐" label="Review" count={reviewNotifs.length} color="#b45309" bgColor="rgba(254,243,199,0.6)" borderColor="#fcd34d" dotColor="#d97706" items={reviewNotifs} onItemClick={handleClick} />
        )}
        {/* Notifikasi personal (tabel `notifications`) - peringatan KPI, dst.
            Ditampilkan untuk SEMUA role, tidak digerbangi bolehLonceng seperti
            4 lonceng di atas karena isinya memang personal per akun. */}
        <NotifBell icon="🔔" label="Notifikasi" count={personalNotifs.length} color="#4338ca" bgColor="rgba(224,231,255,0.6)" borderColor="#a5b4fc" dotColor="#4f46e5" items={personalNotifs} onItemClick={handleClick} onMarkAllRead={handleMarkAllPersonalRead} />
      </div>
    </div>
  );
}
