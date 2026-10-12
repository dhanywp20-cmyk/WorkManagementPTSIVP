'use client';

/** useMuatInsentif - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { IncentiveProjectRow, IncentiveTranche, IncentiveSplit, LateTicketLink, fetchIncentiveProjects, fetchTranches, fetchVisibleSplits, fetchSupportFromTickets, jendelaSupportTahap, fetchLateTickets, findUpline, resolveUserId, OrgUser, ambilSkema, type SkemaInsentif } from './calc';
import { supabase } from '@/lib/supabase';
import { type CurrentUser } from './aturan-halaman';

export interface MuatInsentifKonteks {
  allUsers: CurrentUser[];
  setAllSplits: import("react").Dispatch<import("react").SetStateAction<IncentiveSplit[]>>;
  setAllUsers: import("react").Dispatch<import("react").SetStateAction<CurrentUser[]>>;
  setDetailProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setDetailSplits: import("react").Dispatch<import("react").SetStateAction<IncentiveSplit[]>>;
  setDetailSupports: import("react").Dispatch<import("react").SetStateAction<{ tahunKe: number; dari: string | null; sampai: string | null; orang: { user_id: string; user_name: string; }[]; }[]>>;
  setDetailTranches: import("react").Dispatch<import("react").SetStateAction<IncentiveTranche[]>>;
  setLateTickets: import("react").Dispatch<import("react").SetStateAction<LateTicketLink[]>>;
  setLoading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setProjects: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[]>>;
  setPtsTeamMappings: import("react").Dispatch<import("react").SetStateAction<{ staff_user_id: string; supervisor_user_id: string; }[]>>;
  setSkema: import("react").Dispatch<import("react").SetStateAction<SkemaInsentif | null>>;
  setSupportMap: import("react").Dispatch<import("react").SetStateAction<Map<string, Set<string>>>>;
  setTranches: import("react").Dispatch<import("react").SetStateAction<(IncentiveTranche & { project: IncentiveProjectRow; })[]>>;
  skema: SkemaInsentif | null;
}

export function useMuatInsentif(k: MuatInsentifKonteks) {
  const { allUsers, setAllSplits, setAllUsers, setDetailProject, setDetailSplits, setDetailSupports, setDetailTranches, setLateTickets, setLoading, setProjects, setPtsTeamMappings, setSkema, setSupportMap, setTranches, skema } = k;
  const loadAll = async () => {
    setLoading(true);
    // Skema dimuat bersama data lain. Selama ia belum ada, layar tidak
    // menghitung apa pun (lihat calcHandlerSplit) - lebih baik kolomnya kosong
    // sesaat daripada menampilkan angka dari aturan yang salah.
    const [projRes, trancheRes, splitRes, lateRes, sk] = await Promise.all([
      fetchIncentiveProjects(), fetchTranches(), fetchVisibleSplits(), fetchLateTickets(), ambilSkema(),
    ]);
    setSkema(sk);
    if (projRes.data) setProjects(projRes.data);
    if (trancheRes.data) setTranches(trancheRes.data);
    if (splitRes.data) setAllSplits(splitRes.data);
    if (lateRes.data) setLateTickets(lateRes.data);
    const [usersRes, ptsTeamRes, orgRes] = await Promise.all([
      supabase.from('users').select('id, username, full_name, role, team_type, incentive_akses, allow_incentive_input, incentive_brand_scope, access_level, jabatan').order('full_name'),
      supabase.from('pts_team_mappings').select('staff_user_id, supervisor_user_id'),
      // Query terpisah & tahan-error: atasan_id dari Struktur Organisasi
      supabase.from('users').select('id, atasan_id'),
    ]);
    if (usersRes.data) {
      const atasanMap = new Map<string, string | null>((orgRes.data ?? []).map((r: { id: string; atasan_id: string | null }) => [r.id, r.atasan_id]));
      setAllUsers((usersRes.data as CurrentUser[]).map(u => ({ ...u, atasan_id: atasanMap.get(u.id as string) ?? null })));
    }
    if (ptsTeamRes.data) setPtsTeamMappings(ptsTeamRes.data as { staff_user_id: string; supervisor_user_id: string }[]);
    // Support per project (dari ticket Troubleshooting selesai) - untuk filter visibilitas list
    const { data: trouble } = await supabase.from('reminders').select('project_name, assigned_to, assign_name').eq('category', 'Troubleshooting').eq('status', 'done');
    const sm = new Map<string, Set<string>>();
    for (const t of (trouble || []) as { project_name: string | null; assigned_to: string | null; assign_name: string | null }[]) {
      if (!t.project_name) continue;
      const set = sm.get(t.project_name) || new Set<string>();
      if (t.assigned_to) set.add(t.assigned_to.toLowerCase());
      if (t.assign_name) set.add(t.assign_name.toLowerCase());
      sm.set(t.project_name, set);
    }
    setSupportMap(sm);
    setLoading(false);
  };

  const openProjectDetail = async (p: IncentiveProjectRow) => {
    setDetailProject(p);
    //  Tahun-tahun yang dinilai diambil dari jadwal tahapan itu sendiri, bukan
    //  angka 3 yang ditulis tangan - kalau tahapannya kelak jadi 2 atau 4 tahun,
    //  daftar ini ikut tanpa disentuh.
    const tahunDinilai = Array.from(new Set((skema?.tranche ?? []).map(t => t.tahunKe))).sort((a, b) => a - b);
    const [splitsRes, tranchesRes, ...supportsPerTahun] = await Promise.all([
      fetchVisibleSplits(p.id),
      supabase.from('incentive_tranches').select('*').eq('project_id', p.id).order('tranche_number'),
      ...tahunDinilai.map(th => fetchSupportFromTickets(p, jendelaSupportTahap(p.bast_date, th))),
    ]);
    setDetailSplits(splitsRes.data || []);
    setDetailTranches((tranchesRes.data || []) as IncentiveTranche[]);
    //  PIC, Supervisor, dan Manager dikeluarkan dari daftar yang DITAMPILKAN,
    //  bukan cuma dari yang dibayar. Mesin hitung sudah membuangnya (lihat
    //  tanpaPeranTetap di calc.ts); kalau layar ini tetap menampilkannya, orang
    //  membaca "Yoga dapat porsi Support" padahal tidak - dan selisih antara
    //  yang terlihat dan yang dibayar adalah hal terakhir yang boleh terjadi
    //  di layar nominal.
    const rapikan = (v: string) => (v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const orgList = allUsers as unknown as OrgUser[];
    const picIdDetail = resolveUserId((p.pic_id || p.assigned_to) as string, p.assign_name, orgList);
    const supDetail = findUpline(picIdDetail, 'Supervisor', orgList);
    const mgrDetail = findUpline(picIdDetail, 'Manager', orgList);
    const picPenunjuk = new Set([
      p.assign_name, p.assigned_to, p.pic_id, picIdDetail,
      supDetail?.id, supDetail?.full_name,
      mgrDetail?.id, mgrDetail?.full_name,
    ].filter(Boolean).map(v => rapikan(String(v))));
    setDetailSupports(tahunDinilai.map((th, i) => ({
      tahunKe: th,
      ...jendelaSupportTahap(p.bast_date, th),
      orang: (supportsPerTahun[i]?.data || [])
        .filter((o: { user_id: string; user_name: string }) =>
          !picPenunjuk.has(rapikan(o.user_id)) && !picPenunjuk.has(rapikan(o.user_name))),
    })));
  };
  return { loadAll, openProjectDetail };
}
