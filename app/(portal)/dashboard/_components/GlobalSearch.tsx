'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { namaKelompokPTS } from '@/lib/kelompok';
import { bacaPicPiket } from '@/lib/piket';
import { User } from './shared';
import { ModalPortal } from '@/components/shared';
import { cariReminderByNama } from '@/lib/cari-reminder';
import { hitungLingkupProject, type LingkupProject } from '@/lib/project-scope';
import { hasFullAccess } from '@/lib/constants';
import { Ikon } from '@/components/shared/Ikon';
import { TYPE_CONFIG, ALL_TYPES, type ResultType, type SearchResult } from './cari-global-tipe';

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

  const isAdmin  = ['admin','superadmin'].includes(currentUser.role?.toLowerCase() ?? '');
  const tanpaBatas = isAdmin || currentUser.role?.toLowerCase() === 'team' || isPimpinan(currentUser);
  const isPTSsup = currentUser.role === 'team' &&
    namaKelompokPTS().includes(currentUser.team_type ?? '') &&
    currentUser.jabatan === 'Supervisor';
  const isSalesSup = ['guest','sales'].includes(currentUser.role?.toLowerCase() ?? '') && !isPimpinan(currentUser) &&
    ['Supervisor','Manager','Deputy General Manager','General Manager','Direktur'].includes(currentUser.jabatan ?? '');

  const isSalesBiasa = ['guest','sales'].includes(currentUser.role?.toLowerCase() ?? '') && !isSalesSup && !isPimpinan(currentUser);

  const batasiLingkup = <T,>(lingkup: LingkupProject, query: T, kolomMilik: string[], kolomDivisi = 'sales_division'): T => {
    if (lingkup.semua) return query;
    const nama = (currentUser.full_name ?? '').replace(/"/g, '');
    const user = (currentUser.username ?? '').replace(/"/g, '');
    const syarat = kolomMilik
      .map(k => (k === 'created_by' ? `${k}.eq."${user}"` : `${k}.eq."${nama}"`));
    for (const d of lingkup.divisi) syarat.push(`${kolomDivisi}.eq."${d.replace(/"/g, '')}"`);
    return (query as { or: (x: string) => T }).or(syarat.join(','));
  };

  const bolehModul = (kunci: string): boolean => {
    if (hasFullAccess(currentUser)) return true;
    const izin = (currentUser as { allowed_menus?: string[] }).allowed_menus;
    if (!izin) return true;
    return izin.includes(kunci);
  };

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

  const getPTSTeamNames = useCallback(async (): Promise<string[]> => {
    const { data } = await supabase.from('users')
      .select('full_name')
      .eq('role', 'team')
      .eq('team_type', currentUser.team_type ?? '');
    return (data ?? []).map((u: any) => u.full_name as string);
  }, [currentUser]);

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

  const doSearch = useCallback(async (q: string) => {
    const lingkup = await hitungLingkupProject(currentUser as never);
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

    if (bolehModul('ticket-troubleshooting')) try {
      let q2 = supabase.from('tickets')
        .select('id, project_name, issue_case, assign_name, status, date, sales_division, sales_name, created_by')
        .or(`project_name.ilike.%${q}%,issue_case.ilike.%${q}%,assign_name.ilike.%${q}%,sales_name.ilike.%${q}%,sn_unit.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(20);

      if (!tanpaBatas) q2 = batasiLingkup(lingkup, q2, ['sales_name', 'created_by']);

      const { data: tData } = await q2;
      let tickets = (tData ?? []) as any[];

      if (tanpaBatas) {
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

    if (bolehModul('reminder-schedule')) try {
      const KOLOM_REMINDER =
        'id, project_name, category, due_date, assign_name, sales_name, sales_division, status';
      const namaRes = await cariReminderByNama<any>(q, KOLOM_REMINDER, 20,
        kueri => (tanpaBatas ? kueri : batasiLingkup(lingkup, kueri, ['sales_name', 'created_by'])));
      if (namaRes.error) console.error('[search] reminders (nama):', namaRes.error.message);

      let qr = supabase.from('reminders')
        .select(KOLOM_REMINDER)
        .or(`category.ilike.%${q}%,assign_name.ilike.%${q}%,sales_name.ilike.%${q}%,address.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(20);
      if (!tanpaBatas) qr = batasiLingkup(lingkup, qr, ['sales_name', 'created_by']);
      const { data: rData, error: rErr } = await qr;
      if (rErr) console.error('[search] reminders (pendukung):', rErr.message);

      const terlihat = new Set<string>();
      let reminders = [...namaRes.data, ...((rData ?? []) as any[])]
        .filter((r: any) => !terlihat.has(String(r.id)) && terlihat.add(String(r.id)));

      if (tanpaBatas) {
      } else if (isSalesSup) {
        reminders = reminders.filter((r: any) =>
          salesDivisions.includes(r.sales_division) ||
          salesSubNames.some(n => n === r.sales_name)
        );
      }

      reminders.forEach((r: any) => res.push({
        id: `reminder-${r.id}`, type: 'reminder', icon: '🗓️',
        title: r.project_name || r.title || '-',
        sub: `${r.category} · ${r.due_date ?? '-'}`,
        meta: r.assign_name ?? '-',
        badge: r.status,
        badgeColor: r.status === 'done' ? '#10b981' : r.status === 'cancelled' ? '#6b7280' : '#f59e0b',
        url: '/reminder-schedule',
      }));
    } catch (e) { console.error('[search] reminders:', e); }

    if (bolehModul('request-design-project')) try {
      let qp = supabase.from('project_requests')
        .select('id, project_name, status, sales_name, sales_division, created_at, requester_id')
        .or(`project_name.ilike.%${q}%,sales_name.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(15);
      if (!tanpaBatas) qp = batasiLingkup(lingkup, qp, ['sales_name']);
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
        projects = [];
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

    if (bolehModul('picket-showroom')) try {
      const { data: pkData } = await supabase.from('piket_schedules')
        .select('id, day_date, day_of_week, pic, pic_ivp_name, pic_ump_name, pic_mvi_name, pic_ivp_id, pic_ump_id, pic_mvi_id')
        .or(`pic_ivp_name.ilike.%${q}%,pic_ump_name.ilike.%${q}%,pic_mvi_name.ilike.%${q}%,day_date.ilike.%${q}%`)
        .order('day_date', { ascending: false }).limit(10);
      let pikets = (pkData ?? []) as any[];

      if (isSalesBiasa || isSalesSup) {
        pikets = [];
      } else if (isPTSsup) {
        const myTeam = currentUser.team_type;
        pikets = pikets.filter((p: any) => {
          const pic = bacaPicPiket(p);
          if (!pic) return false;
          return pic.team_type === myTeam && (pic.name ?? '').toLowerCase().includes(ql);
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

    if (bolehModul('unit-movement')) try {
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

    if (bolehModul('project-progress')) try {
      let qpp = supabase.from('checklist_proyek')
        .select('id, nama, client, status, sales_name')
        .or(`nama.ilike.%${q}%,client.ilike.%${q}%,sales_name.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(10);
      if (!tanpaBatas) qpp = batasiLingkup(lingkup, qpp, ['sales_name']);
      const { data } = await qpp;
      (data ?? []).forEach((p: any) => res.push({
        id: `progress-${p.id}`, type: 'progress', icon: '📊',
        title: p.nama ?? '-',
        sub: p.client ?? 'Tanpa client',
        meta: p.sales_name ?? '-',
        badge: p.status,
        badgeColor: p.status === 'done' ? '#10b981' : p.status === 'blocked' ? '#f43f5e' : '#f59e0b',
        url: '/project-progress',
      }));
    } catch (e) { console.error('[search] project progress:', e); }

    if (bolehModul('tech-note')) try {
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

    if (bolehModul('daily-report')) try {
      let qd = supabase.from('daily_reports')
        .select('id, report_date, user_name, sales_division, reminder_notes')
        .or(`user_name.ilike.%${q}%,reminder_notes.ilike.%${q}%,sales_division.ilike.%${q}%`)
        .order('report_date', { ascending: false }).limit(10);
      if (!tanpaBatas) qd = batasiLingkup(lingkup, qd, ['user_name']);
      const { data } = await qd;
      (data ?? []).forEach((d: any) => res.push({
        id: `daily-${d.id}`, type: 'daily', icon: '📋',
        title: `Laporan ${d.user_name ?? '-'}`,
        sub: d.reminder_notes || 'Tanpa catatan',
        meta: d.report_date ?? '-',
        url: '/daily-report',
      }));
    } catch (e) { console.error('[search] daily report:', e); }

    if (bolehModul('form-bast')) try {
      let qf = supabase.from('form_reviews')
        .select('id, project_name, address, sales_name, sales_division, assign_name')
        .or(`project_name.ilike.%${q}%,address.ilike.%${q}%,sales_name.ilike.%${q}%,assign_name.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(10);
      if (!tanpaBatas) qf = batasiLingkup(lingkup, qf, ['sales_name']);
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

    if (bolehModul('learning-center')) try {
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
    <button aria-label="Pencarian semua platform (Ctrl+K)" onClick={() => setOpen(true)}
      className="flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-xl transition-all hover:shadow-md"
      style={{ background: 'rgba(15,23,42,0.06)', border: '1.5px solid rgba(15,23,42,0.12)', color: '#475569' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.12)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(15,23,42,0.22)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(15,23,42,0.12)'; }}
      title="Pencarian semua platform (Ctrl+K)">
      <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="hidden sm:inline text-sm font-bold text-slate-600 whitespace-nowrap">Pencarian</span>
      <kbd className="hidden lg:inline text-[11px] font-bold text-slate-500 border border-slate-300 rounded px-1 py-0.5 leading-none">⌘K</kbd>
    </button>
  );

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-start justify-center pt-[12vh] px-4"
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>

      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.98)', border: '1.5px solid rgba(0,0,0,0.1)', animation: 'dropIn 0.18s ease-out' }}>

        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input aria-label="Cari ticket, reminder, project, piket, unit, user..." ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cari ticket, reminder, project, piket, unit, user..."
            className="flex-1 text-sm font-medium text-slate-800 outline-none bg-transparent placeholder-slate-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <button onClick={() => setOpen(false)}
            className="text-[11px] font-bold text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-100 transition-all flex-shrink-0">
            ESC
          </button>
        </div>

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

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center">
              <div className="text-4xl mb-3"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              <p className="text-sm font-semibold text-slate-600">Cari di seluruh platform</p>
              <p className="text-[11px] text-slate-500 mt-1">Ticket · Reminder · Project · Piket · Unit Movement · User</p>
              <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-slate-500">
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
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: cfg.bg }}>
                      <Ikon nama={r.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{r.title}</span>
                        {r.badge && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${r.badgeColor}18`, color: r.badgeColor }}>
                            {r.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 truncate">{r.sub}</span>
                        {r.meta && <span className="text-[11px] text-slate-500 flex-shrink-0">· {r.meta}</span>}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {isSelected && r.url && (
                      <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: cfg.color }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {results.length > 0 ? `${results.length} hasil ditemukan` : 'Ketik untuk mulai pencarian'}
          </span>
          <span className="text-[11px] text-slate-500">
            {isAdmin || isPimpinan(currentUser) ? 'Semua data' : isPTSsup ? `Scope: ${currentUser.team_type}` : isSalesSup ? 'Scope: divisi Anda' : 'Data Anda'}
          </span>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
