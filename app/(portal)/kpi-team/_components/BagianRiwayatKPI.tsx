'use client';

/** BagianRiwayatKPI - dipecah dari app/(portal)/kpi-team/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import { KPIPeriodSnapshot, warnaTim } from './shared';
import React from 'react';

export interface BagianRiwayatKPIProps {
  expandedSnapshot: string | null;
  kpiSnapshots: KPIPeriodSnapshot[];
  kpiYear: number;
  setExpandedSnapshot: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedSnapMember: React.Dispatch<React.SetStateAction<string | null>>;
}

export function BagianRiwayatKPI({ expandedSnapshot, kpiSnapshots, kpiYear, setExpandedSnapshot, setSelectedSnapMember }: BagianRiwayatKPIProps) {
  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid rgba(255,255,255,0.7)' }}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500"><IkonTeks nama="📋" />Riwayat KPI</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>{kpiSnapshots.length} periode tersimpan</span>
          </div>
          {expandedSnapshot && (
            <button onClick={() => setExpandedSnapshot(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
              ← Kembali ke Daftar
            </button>
          )}
        </div>

        {kpiSnapshots.length === 0 ? (
          <p className="text-center py-10 text-slate-500 text-sm">
            Belum ada riwayat KPI. Klik 🚀 <b>Mulai KPI {kpiYear}</b> untuk menyimpan penilaian periode ini.
          </p>
        ) : expandedSnapshot ? (() => {
          const snap = kpiSnapshots.find(s => s.id === expandedSnapshot);
          if (!snap) return null;
          const snapMs = snap.members_json;
          const avgFin = snapMs.length ? Math.round(snapMs.reduce((s, m) => s + m.finalKPI, 0) / snapMs.length) : 0;
          const avgC   = avgFin >= 85 ? '#10b981' : avgFin >= 70 ? '#3b82f6' : avgFin >= 50 ? '#f59e0b' : '#ef4444';
          return (
            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="font-bold text-slate-700">{snap.period_label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
                  {snap.period === '1y' ? '1 Tahun' : '6 Bulan'}
                </span>
                <span className="text-xs text-slate-500">oleh <b className="text-slate-600">{snap.created_by}</b></span>
                <span className="text-xs text-slate-500">{new Date(snap.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</span>
                <span className="ml-auto text-sm font-black" style={{ color: avgC }}>Avg Tim: {avgFin}%</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      {['Nama','🎫 Ticketing','⭐ BAST','🎓 LC','📝 R&D','KPI Final'].map((h, i) => (
                        <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap ${i===0?'text-left':'text-center'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {snapMs.map((m, idx) => {
                      const c   = m.finalKPI >= 85 ? '#10b981' : m.finalKPI >= 70 ? '#3b82f6' : m.finalKPI >= 50 ? '#f59e0b' : '#ef4444';
                      const lbl = m.finalKPI >= 85 ? 'Excellent' : m.finalKPI >= 70 ? 'Good' : m.finalKPI >= 50 ? 'Fair' : 'Needs Work';
                      const tc  = warnaTim(m.team_type);
                      const sc  = (v: number) => v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444';
                      return (
                        <tr key={m.id} className="cursor-pointer transition-colors"
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                          onClick={() => setSelectedSnapMember(m.id + '__' + snap.id)}
                          onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                          onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg,${tc},${tc}cc)` }}>{m.name.charAt(0)}</div>
                              <div>
                                <div className="font-semibold text-slate-700 leading-tight">{m.name}</div>
                                <div className="text-[10px] text-slate-500">{m.team_type.replace('Team ','')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.tickScore) }}>{m.tickScore}%</span></td>
                          <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.bastScore) }}>{m.bastScore}%</span></td>
                          <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.lcScore) }}>{m.lcScore}%</span></td>
                          <td className="px-3 py-2.5 text-center"><span className="font-bold" style={{ color: sc(m.rndScore) }}>{m.rndScore}%</span></td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-base font-black" style={{ color: c }}>{m.finalKPI}%</span>
                              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c }}>{lbl}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(() => {
                      const at = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.tickScore,0)/snapMs.length) : 0;
                      const ab = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.bastScore,0)/snapMs.length) : 0;
                      const al = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.lcScore,0)/snapMs.length) : 0;
                      const ar = snapMs.length ? Math.round(snapMs.reduce((s,m)=>s+m.rndScore,0)/snapMs.length) : 0;
                      return (
                        <tr style={{ background: '#f0f9ff', borderTop: '2px solid #bae6fd' }}>
                          <td className="px-3 py-2 font-black text-sky-700 text-xs">RATA-RATA TIM</td>
                          {[at,ab,al,ar].map((v,i) => <td key={i} className="px-3 py-2 text-center font-black text-sky-700">{v}%</td>)}
                          <td className="px-3 py-2 text-center font-black text-sky-700 text-base">{avgFin}%</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })() : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['Periode','Anggota','Avg KPI','Distribusi','Disimpan oleh','Tanggal','Aksi'].map((h,i) => (
                    <th key={h} className={`px-4 py-2.5 font-bold text-slate-500 whitespace-nowrap ${i===0||i===4?'text-left':'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {kpiSnapshots.map((snap, idx) => {
                  const ms  = snap.members_json;
                  const avg = ms.length ? Math.round(ms.reduce((s,m)=>s+m.finalKPI,0)/ms.length) : 0;
                  const exc = ms.filter(m=>m.finalKPI>=85).length;
                  const gd  = ms.filter(m=>m.finalKPI>=70&&m.finalKPI<85).length;
                  const fr  = ms.filter(m=>m.finalKPI>=50&&m.finalKPI<70).length;
                  const nw  = ms.filter(m=>m.finalKPI<50).length;
                  const c   = avg >= 85 ? '#10b981' : avg >= 70 ? '#3b82f6' : avg >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={snap.id} className="cursor-pointer transition-colors"
                      style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                      onClick={() => setExpandedSnapshot(snap.id)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa')}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-700">{snap.period_label}</div>
                        <div className="text-[10px] text-slate-500">{snap.period === '1y' ? '1 Tahun' : '6 Bulan'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-slate-700">{ms.length}</span>
                        <div className="text-[10px] text-slate-500">anggota</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg font-black" style={{ color: c }}>{avg}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center flex-wrap">
                          {exc > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{exc} Excellent</span>}
                          {gd > 0  && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{gd} Good</span>}
                          {fr > 0  && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{fr} Fair</span>}
                          {nw > 0  && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">{nw} NW</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{snap.created_by}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{new Date(snap.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={e => { e.stopPropagation(); setExpandedSnapshot(snap.id); }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-sky-700 hover:bg-sky-50 border border-sky-200 transition-all">
                          Detail →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
