'use client';
import {
  IncentiveProjectRow, calculateIncentiveSplits, findUpline, resolveUserId, OrgUser,
  type SkemaInsentif,
} from './calc';
import { nonaktifPada, tanggalJatuhTempo } from '@/lib/incentive/redistribusi';

export type Peran = { user_id: string; user_name: string; role: string; percentage: number; amount: number };
export type Proyek = {
  p: IncentiveProjectRow;
  hasNominal: boolean; isEstimate: boolean; pool: number; mode: 'onsite' | 'remote';
  pic: Peran[]; support: Peran[]; supervisor: Peran[]; manager: Peran[]; installer: Peran[];
  bastYear: number | null;
};
export type BarisInstaller = { nama: string; lokasi: string; tahun: number; jumlah: number };
export type BarisRedistribusi = { dari: string; proyek: string; tahap: number; tahun: number; jumlah: number };

export function siapkanDataSummary({ projects, supportsMap, orgList, managerUserId, managerName, sk, tahapUrut, totalPersenTahap }: {
  projects: IncentiveProjectRow[];
  supportsMap: Map<string, { user_id: string; user_name: string }[]>;
  orgList: OrgUser[];
  managerUserId: string;
  managerName: string;
  sk: SkemaInsentif;
  tahapUrut: SkemaInsentif['tranche'];
  totalPersenTahap: number;
}) {

  const daftarProyek: Proyek[] = projects.map(p => {
    const projectSupports = supportsMap.get(p.project_name) || [];
    const picId = resolveUserId((p.pic_id || p.assigned_to) as string, p.assign_name, orgList);
    const supUp = findUpline(picId, 'Supervisor', orgList);
    const mgrUp = findUpline(picId, 'Manager', orgList);
    const supervisorId   = (supUp?.id        || '') as string;
    const supervisorName = (supUp?.full_name || 'Supervisor') as string;
    const projManagerId   = mgrUp?.id || managerUserId;
    const projManagerName = mgrUp?.full_name || managerName;

    const hasNominal = (p.incentive_value || 0) > 0;
    const isEstimate = !hasNominal || !p.mode_penyelesaian;
    const pool = hasNominal ? p.incentive_value : 1_000_000;
    const mode: 'onsite' | 'remote' = p.mode_penyelesaian === 'remote' ? 'remote' : 'onsite';
    const displayProject = { ...p, incentive_value: pool, mode_penyelesaian: mode };
    const splits = calculateIncentiveSplits(sk, displayProject, projManagerId, projManagerName, supervisorId, supervisorName, projectSupports, picId) as Peran[];

    return {
      p, hasNominal, isEstimate, pool, mode,
      pic: splits.filter(s => s.role === 'pic'),
      support: splits.filter(s => s.role === 'support'),
      supervisor: splits.filter(s => s.role === 'supervisor'),
      manager: splits.filter(s => s.role === 'manager'),
      installer: splits.filter(s => s.role === 'installer'),
      bastYear: p.bast_date ? new Date(p.bast_date).getFullYear() : null,
    };
  });

  const akumulasi: { nama: string; peran: string; jumlah: number; bastYear: number; proyek: string }[] = [];
  const semuaNamaTim = new Map<string, Set<string>>();
  for (const pr of daftarProyek) {
    for (const s of [...pr.pic, ...pr.support, ...pr.supervisor, ...pr.manager]) {
      const nm = s.user_name || '—';
      const set = semuaNamaTim.get(nm) ?? new Set<string>();
      set.add(s.role);
      semuaNamaTim.set(nm, set);
      if (!pr.isEstimate && pr.bastYear) akumulasi.push({ nama: nm, peran: s.role, jumlah: s.amount, bastYear: pr.bastYear, proyek: pr.p.project_name });
    }
  }

  const urutPeran: Record<string, number> = { manager: 0, supervisor: 1, pic: 2, support: 3 };
  const perOrang = new Map<string, { nama: string; peran: Set<string>; total: number; jumlah: number }>();
  for (const { nama, peran, jumlah } of akumulasi) {
    const e = perOrang.get(nama) ?? { nama, peran: new Set<string>(), total: 0, jumlah: 0 };
    e.peran.add(peran); e.total += jumlah; e.jumlah += 1;
    perOrang.set(nama, e);
  }
  const namaBelumFinal = new Set<string>();
  for (const [nama, peranSet] of semuaNamaTim) {
    if (perOrang.has(nama)) continue;
    perOrang.set(nama, { nama, peran: new Set(peranSet), total: 0, jumlah: 0 });
    namaBelumFinal.add(nama);
  }
  const orangUrut = [...perOrang.values()].sort((a, b) => {
    const pa = Math.min(...[...a.peran].map(r => urutPeran[r] ?? 9));
    const pb = Math.min(...[...b.peran].map(r => urutPeran[r] ?? 9));
    return pa - pb || a.nama.localeCompare(b.nama, 'id');
  });

  const perOrangTahun = new Map<string, Map<number, number>>();
  const tahunSet = new Set<number>();
  const nonaktif = new Map(orgList.map(u => [(u.full_name ?? '').trim().toLowerCase(), u.tanggal_nonaktif ?? null]));
  const redistribusiList: BarisRedistribusi[] = [];
  for (const { nama, jumlah, bastYear, proyek } of akumulasi) {
    const ember = perOrangTahun.get(nama) ?? new Map<number, number>();
    const tglNonaktif = nonaktif.get(nama.trim().toLowerCase());
    for (const t of tahapUrut) {
      const th = bastYear + t.tahunKe;
      tahunSet.add(th);
      const nilai = Math.round((jumlah * (t.persen || 0)) / totalPersenTahap);
      if (nonaktifPada(tglNonaktif, tanggalJatuhTempo(th))) {
        if (nilai > 0) redistribusiList.push({ dari: nama, proyek, tahap: t.nomor, tahun: th, jumlah: nilai });
        continue;
      }
      ember.set(th, (ember.get(th) ?? 0) + nilai);
    }
    perOrangTahun.set(nama, ember);
  }
  const installerList: BarisInstaller[] = [];
  for (const pr of daftarProyek) {
    if (pr.isEstimate || !pr.bastYear) continue;
    for (const s of pr.installer) {
      const th = sk.installerBayarDiMuka ? pr.bastYear + (tahapUrut[0]?.tahunKe ?? 1) : pr.bastYear;
      tahunSet.add(th);
      installerList.push({ nama: s.user_name || '—', lokasi: pr.p.installer_daerah || '', tahun: th, jumlah: s.amount });
    }
  }
  const tahunUrut = [...tahunSet].sort((a, b) => a - b);
  const sufiksTahun = tahunUrut.length === 0 ? ''
    : tahunUrut.length === 1 ? ` Tahun ${tahunUrut[0]}`
    : ` Tahun ${tahunUrut[0]}–${tahunUrut[tahunUrut.length - 1]}`;

  return { daftarProyek, akumulasi, namaBelumFinal, orangUrut, perOrangTahun, installerList, redistribusiList, tahunUrut, sufiksTahun, urutPeran };
}
