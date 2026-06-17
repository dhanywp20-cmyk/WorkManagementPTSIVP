'use client';
// ─── Incentive PTS — Tab: Rekap Incentive (Quarterly/Yearly View) ─────────────

import { useMemo, useState } from 'react';
import { IncentiveProject, IncentiveDisbursement, User } from './types';
import { Badge, fmtRp } from './shared';

// ── Quarter helpers ───────────────────────────────────────────────────────────
const MONTH_NAMES: Record<number, string> = {
  1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',
  7:'Jul',8:'Agu',9:'Sep',10:'Okt',11:'Nov',12:'Des',
};

function getQuarterKey(periode: string): string {
  const year  = periode.slice(0, 4);
  const month = parseInt(periode.slice(5, 7));
  return `${year}-Q${Math.ceil(month / 3)}`;
}

function getQuarterLabel(key: string): string {
  // key: "2026-Q2"
  const [year, q] = key.split('-');
  const n   = parseInt(q.slice(1));
  const s   = (n - 1) * 3 + 1;
  const e   = n * 3;
  return `${q} ${year}  (${MONTH_NAMES[s]}–${MONTH_NAMES[e]} ${year})`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PersonRekap {
  name          : string;
  handlerCount  : number;
  backupCount   : number;
  installerCount: number;
  atasanCount   : number;
  totalRp       : number;
}

interface QuarterGroup {
  key      : string;
  label    : string;
  projects : IncentiveProject[];
  persons  : PersonRekap[];
  totalBiaya   : number;
  totalIncentive: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  projects     : IncentiveProject[];
  disbursements: IncentiveDisbursement[];
  isTeamPTS    : boolean;
  isAdmin      : boolean;
  currentUser  : User | null;
  onExport     : () => void;
  // legacy props kept for back-compat (unused in new view)
  rekapData?   : unknown;
  filterPeriode?: string;
  filterLabel? : string;
}

export function RekapTab({ projects, disbursements, isTeamPTS, isAdmin, currentUser, onExport }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // ── Build quarterly groups from ALL projects ──────────────────────────────
  const quarterGroups = useMemo((): QuarterGroup[] => {
    const map = new Map<string, QuarterGroup>();

    const sorted = [...projects].sort((a, b) =>
      (b.periode ?? '').localeCompare(a.periode ?? '')
    );

    for (const proj of sorted) {
      if (!proj.periode) continue;
      // Team PTS only sees their own projects
      if (isTeamPTS && !isAdmin) {
        const mine =
          proj.handler_name === currentUser?.full_name ||
          proj.backup_names.includes(currentUser?.full_name ?? '');
        if (!mine) continue;
      }

      const key = getQuarterKey(proj.periode);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label          : getQuarterLabel(key),
          projects       : [],
          persons        : [],
          totalBiaya     : 0,
          totalIncentive : 0,
        });
      }
      const g = map.get(key)!;
      g.projects.push(proj);
      g.totalBiaya += proj.biaya_cadangan;

      // Accumulate person incentives from disbursements
      const projDisb = disbursements.filter((d) => d.project_id === proj.id);
      for (const d of projDisb) {
        // For team users, only accumulate own record
        if (isTeamPTS && !isAdmin && d.person_name !== currentUser?.full_name) continue;
        g.totalIncentive += d.amount_rp;
        let person = g.persons.find((p) => p.name === d.person_name);
        if (!person) {
          person = { name: d.person_name, handlerCount: 0, backupCount: 0, installerCount: 0, atasanCount: 0, totalRp: 0 };
          g.persons.push(person);
        }
        person.totalRp += d.amount_rp;
        if (d.role_type === 'handler') person.handlerCount++;
        else if (d.role_type === 'backup') person.backupCount++;
        else if (d.role_type === 'installer') person.installerCount++;
        else if (d.role_type === 'atasan') person.atasanCount++;
      }
    }

    // Sort persons within each group by totalRp desc
    for (const g of map.values()) {
      g.persons.sort((a, b) => b.totalRp - a.totalRp);
    }

    return Array.from(map.values());
  }, [projects, disbursements, isTeamPTS, isAdmin, currentUser]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-800">📊 Rekap Incentive per Kuartal</h2>
          <p className="text-xs text-gray-400 mt-0.5">Seluruh riwayat incentive dikelompokkan per triwulan</p>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      {quarterGroups.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-500">Belum ada data rekap</p>
        </div>
      ) : (
        quarterGroups.map((g) => {
          const isOpen = expanded.has(g.key);
          return (
            <div key={g.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Quarter header — clickable to expand/collapse */}
              <button
                onClick={() => toggle(g.key)}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Quarter badge */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                  >
                    {g.key.split('-')[1]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate">{g.label}</p>
                    <p className="text-xs text-gray-400">
                      {g.projects.length} project
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Totals */}
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-400">Total Biaya</p>
                    <p className="text-sm font-bold text-indigo-600">{fmtRp(g.totalBiaya)}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-gray-400">Total Incentive</p>
                    <p className="text-sm font-bold text-emerald-600">{fmtRp(g.totalIncentive)}</p>
                  </div>
                  {/* Chevron */}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Mobile totals row */}
              <div className="sm:hidden px-5 pb-3 flex gap-4">
                <div>
                  <p className="text-[10px] text-gray-400">Total Biaya</p>
                  <p className="text-sm font-bold text-indigo-600">{fmtRp(g.totalBiaya)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Total Incentive</p>
                  <p className="text-sm font-bold text-emerald-600">{fmtRp(g.totalIncentive)}</p>
                </div>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {/* Per-person breakdown */}
                  {g.persons.length > 0 && (
                    <div className="px-5 py-3 space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Distribusi Incentive</p>
                      {g.persons.map((person, pi) => {
                        const pct = g.totalIncentive > 0 ? (person.totalRp / g.totalIncentive) * 100 : 0;
                        return (
                          <div key={person.name} className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                              {pi + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-700 truncate">{person.name}</span>
                                <span className="font-bold text-indigo-600 text-sm whitespace-nowrap">{fmtRp(person.totalRp)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Progress bar */}
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap flex gap-1">
                                  {person.handlerCount   > 0 && <span>H:{person.handlerCount}</span>}
                                  {person.backupCount    > 0 && <span>B:{person.backupCount}</span>}
                                  {person.installerCount > 0 && <span className="text-sky-500">INS:{person.installerCount}</span>}
                                  {person.atasanCount    > 0 && <span className="text-purple-500">MGR:{person.atasanCount}</span>}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Project list */}
                  <div className="border-t border-gray-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-5 pt-3 pb-1">Daftar Project</p>
                    <div className="divide-y divide-gray-50">
                      {g.projects.map((proj) => (
                        <div key={proj.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-700 truncate">{proj.project_name}</p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {proj.handler_name}
                              {proj.backup_names.length > 0 && ` · +${proj.backup_names.length} backup`}
                              {proj.sales_division && ` · ${proj.sales_division}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {proj.biaya_cadangan > 0 ? (
                              <span className="text-xs font-semibold text-indigo-600">{fmtRp(proj.biaya_cadangan)}</span>
                            ) : (
                              <span className="text-xs text-gray-400">Belum diinput</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
