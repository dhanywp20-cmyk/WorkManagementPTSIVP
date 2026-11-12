'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ProjectRequest } from './shared';

export interface FilterRequestKonteks {
  filterStatus: string;
  filterYear: string;
  filterMonth: string;
  filterHandler: string;
  searchQuery: string;
}

export function useFilterRequest(k: FilterRequestKonteks) {
  const { filterStatus, filterYear, filterMonth, filterHandler, searchQuery } = k;
  const [searchSales, setSearchSales] = useState(() => {
    try { return sessionStorage.getItem('frp_searchSales') || ''; } catch { return ''; }
  });
  const [filterDivision, setFilterDivision] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterDivision') || 'all'; } catch { return 'all'; }
  });
  const [filterKebutuhan, setFilterKebutuhan] = useState<string>(() => {
    try { return sessionStorage.getItem('frp_filterKebutuhan') || 'all'; } catch { return 'all'; }
  });
  const [ptsMembersList, setPtsMembersList] = useState<string[]>([]);
  const [rosterPTS, setRosterPTS] = useState<{ id: string; full_name: string; jabatan: string | null; phone_number: string | null; team_type?: string | null; bisa_ditugaskan?: boolean | null }[]>([]);
  const [rerouteTarget, setRerouteTarget] = useState<ProjectRequest | null>(null);
  const [rerouteTo, setRerouteTo] = useState('');
  const [rerouteSaving, setRerouteSaving] = useState(false);

  useEffect(() => {
    supabase.from('users').select('id, full_name, jabatan, phone_number, team_type, bisa_ditugaskan')
      .in('role', ['team', 'team_pts']).order('full_name')
      .then((res: { data: unknown }) => setRosterPTS((res.data ?? []) as never));
  }, []);
  const [unreadMsgMap, setUnreadMsgMap] = useState<Record<string, number>>({});
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, number>>({});
  useEffect(() => { try { sessionStorage.setItem('frp_filterStatus', filterStatus); } catch {} }, [filterStatus]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterYear', filterYear); } catch {} }, [filterYear]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterMonth', filterMonth); } catch {} }, [filterMonth]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterHandler', filterHandler); } catch {} }, [filterHandler]);
  useEffect(() => { try { sessionStorage.setItem('frp_searchQuery', searchQuery); } catch {} }, [searchQuery]);
  useEffect(() => { try { sessionStorage.setItem('frp_searchSales', searchSales); } catch {} }, [searchSales]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterDivision', filterDivision); } catch {} }, [filterDivision]);
  useEffect(() => { try { sessionStorage.setItem('frp_filterKebutuhan', filterKebutuhan); } catch {} }, [filterKebutuhan]);
  return {
    setLastSeenMap, setPtsMembersList, setUnreadMsgMap, filterDivision, filterKebutuhan, searchSales, rerouteTarget, rerouteTo,
    rosterPTS, setRerouteSaving, setRerouteTarget, setRerouteTo, ptsMembersList, unreadMsgMap, setFilterDivision, setFilterKebutuhan,
    setSearchSales, rerouteSaving,
  };
}
