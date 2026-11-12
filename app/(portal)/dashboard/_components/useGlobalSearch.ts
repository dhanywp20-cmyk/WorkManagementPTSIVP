'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { namaKelompokPTS } from '@/lib/kelompok/inti';
import { User } from './shared';
import { hitungLingkupProject, type LingkupProject } from '@/lib/project-scope';
import { hasFullAccess } from '@/lib/constants';
import { ALL_TYPES, type ResultType, type SearchResult } from './cari-global-tipe';
import { cariPengguna } from './cari/cariPengguna';
import { cariMateri } from './cari/cariMateri';
import { cariBast } from './cari/cariBast';
import { cariDailyReport } from './cari/cariDailyReport';
import { cariTechNote } from './cari/cariTechNote';
import { cariProgress } from './cari/cariProgress';
import { cariUnitMovement } from './cari/cariUnitMovement';
import { cariPiket } from './cari/cariPiket';
import { cariRequestDesain } from './cari/cariRequestDesain';
import { cariJadwal } from './cari/cariJadwal';
import { cariTiket } from './cari/cariTiket';

export interface GlobalSearchKonteks {
  currentUser: User;
  onNavigate: ((url: string, query: string, type: ResultType) => void) | undefined;
}

export function useGlobalSearch(k: GlobalSearchKonteks) {
  const { currentUser, onNavigate } = k;
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
    return (data ?? []).map((u) => u.full_name as string);
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
    const divisions = (divMapsRes.data ?? []).map((m) => m.sales_division as string);
    if (currentUser.sales_division && !divisions.includes(currentUser.sales_division)) {
      divisions.push(currentUser.sales_division);
    }

    const directUserIds = (userSupMapsRes.data ?? []).map((m) => m.user_id as string);
    const subFromDivRes = await supabase.from('users')
      .select('id, full_name, sales_division, jabatan')
      .in('sales_division', divisions.length ? divisions : ['__none__'])
      .in('role', ['guest','sales']);
    const divUsers = (subFromDivRes.data ?? []).filter((u) => {
      const tier = u.jabatan === 'Supervisor' ? 2 : u.jabatan === 'Manager' ? 3 : u.jabatan === 'Deputy General Manager' ? 4 : u.jabatan === 'General Manager' ? 5 : u.jabatan === 'Direktur' ? 6 : 1;
      return tier <= selfTier && u.id !== currentUser.id;
    });

    const allSubIds = [...new Set([...divUsers.map((u) => u.id as string), ...directUserIds])];
    const allSubNamesRes = allSubIds.length
      ? await supabase.from('users').select('full_name').in('id', allSubIds)
      : { data: [] };
    const subNames = [...new Set([
      currentUser.full_name,
      ...(allSubNamesRes.data ?? []).map((u) => u.full_name as string),
      ...divUsers.map((u) => u.full_name as string),
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

    await cariTiket({
      bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesDivisions, salesSubNames,
      res,
    });

    await cariJadwal({
      bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesDivisions, salesSubNames,
      res,
    });

    await cariRequestDesain({
      bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesSubNames, salesDivisions,
      currentUser, isAdmin, res,
    });

    await cariPiket({ bolehModul, q, isSalesBiasa, isSalesSup, isPTSsup, currentUser, ql, res });

    await cariUnitMovement({ bolehModul, tanpaBatas, q, isPTSsup, ptsMemberNames, res });

    await cariProgress({ bolehModul, q, tanpaBatas, batasiLingkup, lingkup, res });

    await cariTechNote({ bolehModul, tanpaBatas, q, res });

    await cariDailyReport({ bolehModul, q, tanpaBatas, batasiLingkup, lingkup, res });

    await cariBast({
      bolehModul, q, tanpaBatas, batasiLingkup, lingkup, isSalesSup, salesDivisions, salesSubNames,
      res,
    });

    await cariMateri({ bolehModul, q, res });

    await cariPengguna({ isAdmin, q, res });

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
  return {
    open, setOpen, inputRef, query, setQuery, loading, results, setActiveType,
    activeType, typeCounts, listRef, filtered, selected, handleSelect, setSelected, isAdmin,
    isPTSsup, isSalesSup,
  };
}
