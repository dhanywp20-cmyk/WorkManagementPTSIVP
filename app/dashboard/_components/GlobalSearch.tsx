'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from './shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultType = 'ticket' | 'reminder' | 'project' | 'piket' | 'unit' | 'user'
  | 'progress' | 'technote' | 'daily' | 'review' | 'materi';

interface SearchResult {
  id: string;
  type: ResultType;
  icon: string;
  title: string;
  sub: string;
  meta: string;
  url?: string;
  badge?: string;
  badgeColor?: string;
}

const TYPE_CONFIG: Record<ResultType, { label: string; color: string; bg: string }> = {
  ticket:   { label: 'Ticket',         color: '#be123c', bg: 'rgba(254,205,211,0.5)' },
  reminder: { label: 'Reminder',       color: '#0e7490', bg: 'rgba(207,250,254,0.5)' },
  project:  { label: 'Form Require',   color: '#7e22ce', bg: 'rgba(233,213,255,0.5)' },
  piket:    { label: 'Piket Showroom', color: '#0f766e', bg: 'rgba(204,251,241,0.5)' },
  unit:     { label: 'Unit Movement',  color: '#92400e', bg: 'rgba(254,243,199,0.5)' },
  user:     { label: 'User',           color: '#374151', bg: 'rgba(243,244,246,0.8)' },
  progress: { label: 'Project Progress', color: '#0e7490', bg: 'rgba(207,250,254,0.5)' },
  technote: { label: 'Tech Note',      color: '#3730a3', bg: 'rgba(224,231,255,0.6)' },
  daily:    { label: 'Daily Report',   color: '#065f46', bg: 'rgba(209,250,229,0.5)' },
  review:   { label: 'Form Review',    color: '#b45309', bg: 'rgba(254,243,199,0.5)' },
  materi:   { label: 'Learning Center', color: '#1d4ed8', bg: 'rgba(219,234,254,0.6)' },
};

const ALL_TYPES: ResultType[] = [
  'ticket','reminder','project','progress','review','daily',
  'piket','unit','technote','materi','user',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch({ currentUser, onNavigate }: {
  currentUser: User;
  onNavigate?: (url: string, query: string, type: ResultType) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [activeType, setActiveType] = useState<ResultType | 'all'>('all');
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * ── Cakupan pencarian ────────────────────────────────────────────────────
   *
   * BUG yang ditutup di sini: sebelumnya penyaringan hanya punya cabang untuk
   * PTS Supervisor dan Sales Supervisor. Sales BIASA — role guest tanpa jabatan
   * supervisor, yang jumlahnya paling banyak — tidak masuk cabang mana pun,
   * sehingga LOLOS DARI SELURUH PENYARINGAN dan bisa melihat tiket, jadwal,
   * serta project milik sales lain lewat kotak pencarian.
   *
   * Aturan sekarang:
   *   admin · superadmin · team  → seluruh data, tanpa batas
   *   sales supervisor           → divisi & bawahannya
   *   sales biasa                → HANYA yang mencatat namanya
   *
   * Penyaringan sales biasa dilakukan DI QUERY (lihat batasiMilikSendiri),
   * bukan setelah data tiba. Menyaring setelah tiba berarti data sales lain
   * sudah sampai di browser dan terbaca lewat DevTools — untuk daftar
   * pelanggan dan nilai project, itu kebocoran yang sesungguhnya.
   */
  const isAdmin  = ['admin','superadmin'].includes(currentUser.role?.toLowerCase() ?? '');
  /** Orang dalam PTS: admin, superadmin, dan seluruh role team. */
  const tanpaBatas = isAdmin || currentUser.role?.toLowerCase() === 'team';
  const isPTSsup = currentUser.role === 'team' &&
    ['Team PTS IVP','Team PTS UMP','Team PTS MVI'].includes(currentUser.team_type ?? '') &&
    currentUser.jabatan === 'Supervisor';
  const isSalesSup = ['guest','sales'].includes(currentUser.role?.toLowerCase() ?? '') &&
    ['Supervisor','Manager','Deputy General Manager','General Manager','Direktur'].includes(currentUser.jabatan ?? '');

  /** Sales biasa = guest/sales yang BUKAN supervisor. Inilah yang dulu terlewat. */
  const isSalesBiasa = ['guest','sales'].includes(currentUser.role?.toLowerCase() ?? '') && !isSalesSup;

  /**
   * Tempelkan batas "hanya milik saya" ke sebuah query.
   *
   * Nilai dikutip ganda karena nama bisa memuat koma — tanpa kutip, PostgREST
   * akan membacanya sebagai pemisah kondisi dan batasannya jadi melar.
   * Tanda kutip di dalam nama dibuang, bukan di-escape, supaya tidak ada celah
   * penyisipan sintaks filter.
   */
  const batasiMilikSendiri = <T,>(query: T, kolom: string[]): T => {
    const nama = (currentUser.full_name ?? '').replace(/"/g, '');
    const user = (currentUser.username ?? '').replace(/"/g, '');
    const syarat = kolom
      .map(k => (k === 'created_by' ? `${k}.eq."${user}"` : `${k}.eq."${nama}"`))
      .join(',');
    // .or() kedua di-AND-kan dengan .or() pencarian teks oleh PostgREST,
    // jadi hasilnya: (cocok kata kunci) DAN (milik saya).
    return (query as { or: (f: string) => T }).or(syarat);
  };

  // ── Open/close via keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(''); setResults([]); setSelected(0); }
  }, [open]);

  // ── Keyboard navigation inside modal ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const filtered = activeType === 'all' ? results : results.filter(r => r.type === activeType);
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && filtered[selected]) { handleSelect(filtered[selected]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selected, activeType]);

  // ── Fetch scope: get team member names for PTS supervisor ──
  const getPTSTeamNames = useCallback(async (): Promise<string[]> => {
    const { data } = await supabase.from('users')
      .select('full_name')
      .eq('role', 'team')
      .eq('team_type', currentUser.team_type ?? '');
    return (data ?? []).map((u: any) => u.full_name as string);
  }, [currentUser]);

  // ── Fetch scope: get supervised divisions & subordinate names for Sales supervisor ──
  const getSalesScope = useCallback(async (): Promise<{ divisions: string[]; subNames: string[] }> => {
    const selfTier = currentUser.jabatan === 'Supervisor' ? 2 :
                     currentUser.jabatan === 'Manager' ? 3 :
                     currentUser.jabatan === 'Deputy General Manager' ? 4 :
                     currentUser.jabatan === 'General Manager' ? 5 :
                     currentUser.jabatan === 'Direktur' ? 6 : 1;

    const [divMapsRes, userSupMapsRes] = await Promise.all([
      supabase.from('division_supervisor_mappings').select('sales_division').eq('supervisor_id', currentUser.id),
      supabase.from('user_supervisor_mappings').select('user_id').eq('supervisor_id', currentUser.id),
    ]);
    const divisions = (divMapsRes.data ?? []).map((m: any) => m.sales_division as string);
    if (currentUser.sales_division && !divisions.includes(currentUser.sales_division)) {
      divisions.push(currentUser.sales_division);
    }

    // Get subordinate user names from division + direct mapping
    const directUserIds = (userSupMapsRes.data ?? []).map((m: any) => m.user_id as string);
    const subFromDivRes = await supabase.from('users')
      .select('id, full_name, sales_division, jabatan')
      .in('sales_division', divisions.length ? divisions : ['__none__'])
      .in('role', ['guest','sales']);
    const divUsers = (subFromDivRes.data ?? []).filter((u: any) => {
      const tier = u.jabatan === 'Supervisor' ? 2 : u.jabatan === 'Manager' ? 3 : u.jabatan === 'Deputy General Manager' ? 4 : u.jabatan === 'General Manager' ? 5 : u.jabatan === 'Direktur' ? 6 : 1;
      return tier <= selfTier && u.id !== currentUser.id;
    });

    const allSubIds = [...new Set([...divUsers.map((u: any) => u.id as string), ...directUserIds])];
    const allSubNamesRes = allSubIds.length
      ? await supabase.from('users').select('full_name').in('id', allSubIds)
      : { data: [] };
    const subNames = [...new Set([
      currentUser.full_name,
      ...(allSubNamesRes.data ?? []).map((u: any) => u.full_name as string),
      ...divUsers.map((u: any) => u.full_name as string),
    ])];

    return { divisions, subNames };
  }, [currentUser]);

  // ── Main search ──
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const ql = q.toLowerCase();

    let ptsMemberNames: string[] = [];
    let salesDivisions: string[] = [];
    let salesSubNames: string[] = [];

    if (isPTSsup) ptsMemberNames = await getPTSTeamNames();
    if (isSalesSup) {
      const scope = await getSalesScope();
      salesDivisions = scope.divisions;
      salesSubNames = scope.subNames;
    }

    const res: SearchResult[] = [];

    // ── 1. Tickets ──
    try {
      let q2 = supabase.from('tickets')
        .select('id, project_name, issue_case, assign_name, status, date, sales_division, sales_name, created_by')
        .or(`project_name.ilike.%${q}%,issue_case.ilike.%${q}%,assign_name.ilike.%${q}%,sales_name.ilike.%${q}%,sn_unit.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(20);

      // Sales biasa: dibatasi DI QUERY — tiket sales lain tidak pernah dikirim
      // ke browser, bukan sekadar disembunyikan setelah tiba.
      if (isSalesBiasa) q2 = batasiMilikSendiri(q2, ['sales_name', 'created_by']);

      const { data: tData } = await q2;
      let tickets = (tData ?? []) as any[];

      // Scope filter
      if (tanpaBatas) {
        // admin, superadmin, team — tanpa batas, sesuai aturan cakupan di atas.
      } else if (isSalesSup) {
        tickets = tickets.filter((t: any) =>
          salesDivisions.includes(t.sales_division) ||
          salesSubNames.some(n => n === t.sales_name || n === t.created_by)
        );
      }

      tickets.forEach((t: any) => res.push({
        id: `ticket-${t.id}`, type: 'ticket', icon: '🎫',
        title: t.project_name ?? '-',
        sub: t.issue_case ?? '-',
        meta: `${t.status} · ${t.assign_name ?? '-'}`,
        badge: t.status,
        badgeColor: t.status === 'Solved' ? '#10b981' : t.status === 'Waiting Approval' ? '#f59e0b' : '#3b82f6',
        url: '/ticketing',
      }));
    } catch (e) { console.error('[search] tickets:', e); }

    // ── 2. Reminders ──
    try {
      let qr = supabase.from('reminders')
        .select('id, project_name, category, due_date, assign_name, sales_name, sales_division, status')
        .or(`project_name.ilike.%${q}%,category.ilike.%${q}%,assign_name.ilike.%${q}%,sales_name.ilike.%${q}%,address.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(20);
      if (isSalesBiasa) qr = batasiMilikSendiri(qr, ['sales_name', 'created_by']);
      const { data: rData } = await qr;
      let reminders = (rData ?? []) as any[];

      if (tanpaBatas) {
        // tanpa batas
      } else if (isSalesSup) {
        reminders = reminders.filter((r: any) =>
          salesDivisions.includes(r.sales_division) ||
          salesSubNames.some(n => n === r.sales_name)
        );
      }

      reminders.forEach((r: any) => res.push({
        id: `reminder-${r.id}`, type: 'reminder', icon: '🗓️',
        title: r.project_name ?? '-',
        sub: `${r.category} · ${r.due_date ?? '-'}`,
        meta: r.assign_name ?? '-',
        badge: r.status,
        badgeColor: r.status === 'done' ? '#10b981' : r.status === 'cancelled' ? '#6b7280' : '#f59e0b',
        url: '/reminder-schedule',
      }));
    } catch (e) { console.error('[search] reminders:', e); }

    // ── 3. Form Require Project ──
    try {
      let qp = supabase.from('project_requests')
        .select('id, project_name, status, sales_name, sales_division, created_at, requester_id')
        .or(`project_name.ilike.%${q}%,sales_name.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(15);
      if (isSalesBiasa) qp = batasiMilikSendiri(qp, ['sales_name']);
      const { data: pData } = await qp;
      let projects = (pData ?? []) as any[];

      if (isSalesSup) {
        const allSubIdsRes = salesSubNames.length
          ? await supabase.from('users').select('id').in('full_name', salesSubNames)
          : { data: [] };
        const subIds = (allSubIdsRes.data ?? []).map((u: any) => u.id as string);
        projects = projects.filter((p: any) =>
          salesDivisions.includes(p.sales_division) || subIds.includes(p.requester_id)
        );
      } else if (currentUser.role?.toLowerCase() === 'team' && !isAdmin) {
        projects = []; // Team PTS tidak berkepentingan dengan Form Require Project
      }

      projects.forEach((p: any) => res.push({
        id: `proj-${p.id}`, type: 'project', icon: '🏗️',
        title: p.project_name ?? '-',
        sub: p.sales_name ?? '-',
        meta: p.status ?? '-',
        badge: p.status,
        badgeColor: p.status === 'Done' ? '#10b981' : p.status === 'Pending' ? '#f59e0b' : '#3b82f6',
        url: '/form-require-project',
      }));
    } catch (e) { console.error('[search] projects:', e); }

    // ── 4. Piket Showroom ──
    try {
      const { data: pkData } = await supabase.from('piket_schedules')
        .select('id, day_date, day_of_week, pic_ivp_name, pic_ump_name, pic_mvi_name')
        .or(`pic_ivp_name.ilike.%${q}%,pic_ump_name.ilike.%${q}%,pic_mvi_name.ilike.%${q}%,day_date.ilike.%${q}%`)
        .order('day_date', { ascending: false }).limit(10);
      let pikets = (pkData ?? []) as any[];

      if (isSalesBiasa || isSalesSup) {
        pikets = []; // Piket showroom bukan wilayah Sales
      } else if (isPTSsup) {
        const myTeam = currentUser.team_type;
        pikets = pikets.filter((p: any) => {
          if (myTeam === 'Team PTS IVP') return (p.pic_ivp_name ?? '').toLowerCase().includes(ql);
          if (myTeam === 'Team PTS UMP') return (p.pic_ump_name ?? '').toLowerCase().includes(ql);
          if (myTeam === 'Team PTS MVI') return (p.pic_mvi_name ?? '').toLowerCase().includes(ql);
          return true;
        });
      }

      pikets.forEach((p: any) => res.push({
        id: `piket-${p.id}`, type: 'piket', icon: '🏪',
        title: `Piket ${p.day_of_week ?? ''} ${p.day_date ?? ''}`,
        sub: [p.pic_ivp_name, p.pic_ump_name, p.pic_mvi_name].filter(Boolean).join(' · ') || '-',
        meta: p.day_date ?? '-',
        url: '/picket-showroom',
      }));
    } catch (e) { console.error('[search] piket:', e); }

    // ── 5. Unit Movement ──
    try {
      if (tanpaBatas) {
        const { data: uData } = await supabase.from('movement_logs')
          .select('id, project_name, event, status_barang, nama_pts, tanggal, serial_number')
          .or(`project_name.ilike.%${q}%,event.ilike.%${q}%,nama_pts.ilike.%${q}%,serial_number.ilike.%${q}%`)
          .order('created_at', { ascending: false }).limit(10);
        let units = (uData ?? []) as any[];

        if (isPTSsup && ptsMemberNames.length) {
          units = units.filter((u: any) => ptsMemberNames.some(n => n === u.nama_pts));
        }

        units.forEach((u: any) => res.push({
          id: `unit-${u.id}`, type: 'unit', icon: '🚚',
          title: u.project_name ?? u.event ?? '-',
          sub: `${u.status_barang} · ${u.nama_pts ?? '-'}`,
          meta: u.tanggal ?? '-',
          badge: u.status_barang,
          badgeColor: u.status_barang === 'Masuk' ? '#10b981' : '#f59e0b',
          url: '/unit-movement',
        }));
      }
    } catch (e) { console.error('[search] units:', e); }

    // ── 7. Project Progress ──
    //  RLS di progress_* sudah menegakkan isolasi Sales di level basis data,
    //  jadi query ini otomatis hanya mengembalikan proyek yang memang haknya —
    //  tanpa perlu penyaringan tambahan di sini. Batas untuk sales biasa tetap
    //  dipasang sebagai lapis kedua, kalau-kalau RLS dimatikan sewaktu-waktu.
    try {
      let qpp = supabase.from('progress_projects')
        .select('id, name, client, status, sales_name')
        .or(`name.ilike.%${q}%,client.ilike.%${q}%,sales_name.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(10);
      if (isSalesBiasa) qpp = batasiMilikSendiri(qpp, ['sales_name']);
      const { data } = await qpp;
      (data ?? []).forEach((p: any) => res.push({
        id: `progress-${p.id}`, type: 'progress', icon: '📊',
        title: p.name ?? '-',
        sub: p.client ?? 'Tanpa client',
        meta: p.sales_name ?? '-',
        badge: p.status,
        badgeColor: p.status === 'done' ? '#10b981' : p.status === 'blocked' ? '#f43f5e' : '#f59e0b',
        url: '/project-progress',
      }));
    } catch (e) { console.error('[search] project progress:', e); }

    // ── 8. Tech Note ──
    //  Catatan teknis adalah pengetahuan bersama tim PTS — tidak dibatasi per
    //  orang, tapi Sales memang tidak berkepentingan dengannya.
    try {
      if (tanpaBatas) {
        const { data } = await supabase.from('tech_notes')
          .select('id, title, description, product, author_name, status')
          .or(`title.ilike.%${q}%,description.ilike.%${q}%,product.ilike.%${q}%,author_name.ilike.%${q}%`)
          .order('submitted_at', { ascending: false }).limit(10);
        (data ?? []).forEach((t: any) => res.push({
          id: `technote-${t.id}`, type: 'technote', icon: '📝',
          title: t.title ?? '-',
          sub: t.product ?? '-',
          meta: t.author_name ?? '-',
          badge: t.status,
          badgeColor: t.status === 'approved' ? '#10b981' : t.status === 'rejected' ? '#ef4444' : '#f59e0b',
          url: '/tech-note',
        }));
      }
    } catch (e) { console.error('[search] tech note:', e); }

    // ── 9. Daily Report ──
    try {
      let qd = supabase.from('daily_reports')
        .select('id, report_date, user_name, sales_division, reminder_notes')
        .or(`user_name.ilike.%${q}%,reminder_notes.ilike.%${q}%,sales_division.ilike.%${q}%`)
        .order('report_date', { ascending: false }).limit(10);
      if (isSalesBiasa) qd = batasiMilikSendiri(qd, ['user_name']);
      const { data } = await qd;
      (data ?? []).forEach((d: any) => res.push({
        id: `daily-${d.id}`, type: 'daily', icon: '📋',
        title: `Laporan ${d.user_name ?? '-'}`,
        sub: d.reminder_notes || 'Tanpa catatan',
        meta: d.report_date ?? '-',
        url: '/daily-report',
      }));
    } catch (e) { console.error('[search] daily report:', e); }

    // ── 10. Form Review ──
    try {
      let qf = supabase.from('form_reviews')
        .select('id, project_name, address, sales_name, sales_division, assign_name')
        .or(`project_name.ilike.%${q}%,address.ilike.%${q}%,sales_name.ilike.%${q}%,assign_name.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(10);
      if (isSalesBiasa) qf = batasiMilikSendiri(qf, ['sales_name']);
      const { data } = await qf;
      let reviews = (data ?? []) as any[];
      if (isSalesSup) {
        reviews = reviews.filter((r: any) =>
          salesDivisions.includes(r.sales_division) || salesSubNames.some(n => n === r.sales_name));
      }
      reviews.forEach((r: any) => res.push({
        id: `review-${r.id}`, type: 'review', icon: '⭐',
        title: r.project_name ?? '-',
        sub: r.address ?? '-',
        meta: r.sales_name ?? '-',
        url: '/form-review',
      }));
    } catch (e) { console.error('[search] form review:', e); }

    // ── 11. Materi Learning Center ──
    //  Materi pelatihan terbuka untuk semua yang login — tidak ada isi rahasia
    //  antar-orang di sini, jadi tidak perlu dibatasi.
    try {
      const { data } = await supabase.from('lc_materials')
        .select('id, materi_name')
        .ilike('materi_name', `%${q}%`)
        .order('materi_name').limit(8);
      (data ?? []).forEach((m: any) => res.push({
        id: `materi-${m.id}`, type: 'materi', icon: '🎓',
        title: m.materi_name ?? '-',
        sub: 'Materi Learning Center',
        meta: '',
        url: '/learning-center',
      }));
    } catch (e) { console.error('[search] materi:', e); }

    // ── 6. Users (admin only) ──
    try {
      if (isAdmin) {
        const { data: usrData } = await supabase.from('users')
          .select('id, full_name, username, role, team_type, sales_division')
          .or(`full_name.ilike.%${q}%,username.ilike.%${q}%,sales_division.ilike.%${q}%`)
          .limit(8);
        (usrData ?? []).forEach((u: any) => res.push({
          id: `user-${u.id}`, type: 'user', icon: '👤',
          title: u.full_name ?? '-',
          sub: u.username ?? '-',
          meta: `${u.role}${u.team_type ? ` · ${u.team_type}` : ''}${u.sales_division ? ` · ${u.sales_division}` : ''}`,
        }));
      }
    } catch (e) { console.error('[search] users:', e); }

    setResults(res);
    setSelected(0);
    setLoading(false);
  }, [isAdmin, isPTSsup, isSalesSup, currentUser, getPTSTeamNames, getSalesScope]);

  // ── Debounced search ──
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(() => doSearch(query), 320);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, doSearch]);

  const handleSelect = (r: SearchResult) => {
    if (r.url) {
      const destUrl = query.trim() ? `${r.url}?q=${encodeURIComponent(query.trim())}` : r.url;
      if (onNavigate) onNavigate(destUrl, query, r.type);
      else window.location.href = destUrl;
    }
    setOpen(false);
  };

  const filtered = activeType === 'all' ? results : results.filter(r => r.type === activeType);
  const typeCounts = ALL_TYPES.reduce((acc, t) => {
    acc[t] = results.filter(r => r.type === t).length;
    return acc;
  }, {} as Record<ResultType, number>);

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:shadow-md"
      style={{ background: 'rgba(15,23,42,0.06)', border: '1.5px solid rgba(15,23,42,0.12)', color: '#475569' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.12)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(15,23,42,0.22)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(15,23,42,0.12)'; }}
      title="Cari platform... (⌘K)">
      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[12vh] px-4"
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>

      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.98)', border: '1.5px solid rgba(0,0,0,0.1)', animation: 'dropIn 0.18s ease-out' }}>

        {/* ── Search input ── */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cari ticket, reminder, project, piket, unit, user..."
            className="flex-1 text-sm font-medium text-slate-800 outline-none bg-transparent placeholder-slate-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <button onClick={() => setOpen(false)}
            className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-100 transition-all flex-shrink-0">
            ESC
          </button>
        </div>

        {/* ── Type filter tabs ── */}
        {results.length > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto">
            <button onClick={() => setActiveType('all')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all"
              style={activeType === 'all'
                ? { background: '#0f172a', color: 'white' }
                : { background: '#f1f5f9', color: '#64748b' }}>
              Semua ({results.length})
            </button>
            {ALL_TYPES.filter(t => typeCounts[t] > 0).map(t => (
              <button key={t} onClick={() => setActiveType(t)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all"
                style={activeType === t
                  ? { background: TYPE_CONFIG[t].color, color: 'white' }
                  : { background: TYPE_CONFIG[t].bg, color: TYPE_CONFIG[t].color }}>
                {TYPE_CONFIG[t].label} ({typeCounts[t]})
              </button>
            ))}
          </div>
        )}

        {/* ── Results list ── */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm font-semibold text-slate-600">Cari di seluruh platform</p>
              <p className="text-[11px] text-slate-400 mt-1">Ticket · Reminder · Project · Piket · Unit Movement · User</p>
              <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono">↑↓</kbd> navigasi</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono">↵</kbd> buka</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-mono">ESC</kbd> tutup</span>
              </div>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="space-y-2 p-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-200 rounded w-48" />
                    <div className="h-2.5 bg-slate-100 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-3xl mb-2">😶</div>
              <p className="text-sm text-slate-500">Tidak ada hasil untuk <b>"{query}"</b></p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filtered.map((r, i) => {
                const cfg = TYPE_CONFIG[r.type as ResultType] ?? { label: r.type, color: '#64748b', bg: '#f1f5f9' };
                const isSelected = i === selected;
                return (
                  <button key={r.id} onClick={() => handleSelect(r)}
                    onMouseEnter={() => setSelected(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={isSelected
                      ? { background: '#f1f5f9', outline: `2px solid ${cfg.color}22` }
                      : { background: 'transparent' }}>
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: cfg.bg }}>
                      {r.icon}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{r.title}</span>
                        {r.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${r.badgeColor}18`, color: r.badgeColor }}>
                            {r.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 truncate">{r.sub}</span>
                        {r.meta && <span className="text-[10px] text-slate-400 flex-shrink-0">· {r.meta}</span>}
                      </div>
                    </div>
                    {/* Module badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {/* Arrow */}
                    {isSelected && r.url && (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: cfg.color }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {results.length > 0 ? `${results.length} hasil ditemukan` : 'Ketik untuk mulai pencarian'}
          </span>
          <span className="text-[10px] text-slate-400">
            {isAdmin ? 'Semua data' : isPTSsup ? `Scope: ${currentUser.team_type}` : isSalesSup ? 'Scope: divisi Anda' : 'Data Anda'}
          </span>
        </div>
      </div>
    </div>
  );
}
