'use client';

/** ModalDetailProyekInsentif - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { bisaKonfig, bisaInput, type CurrentUser } from './aturan-halaman';
import { IncentiveProjectRow, IncentiveTranche, IncentiveSplit, calculateIncentiveSplits, findUpline, resolveUserId, OrgUser, type SkemaInsentif, formatRupiah, formatPct, ROLE_LABELS, TRANCHE_STATUS } from './calc';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface ModalDetailProyekInsentifProps {
  allUsers: CurrentUser[];
  currentUser: CurrentUser | null;
  detailProject: IncentiveProjectRow | null;
  detailSplits: IncentiveSplit[];
  detailSupports: { tahunKe: number; dari: string | null; sampai: string | null; orang: { user_id: string; user_name: string; }[]; }[];
  detailTranches: IncentiveTranche[];
  konfirmasiMarkPaid: (trancheId: string, projectName: string, trancheNumber: number) => void;
  markingPaid: string | null;
  ptsTeamMappings: { staff_user_id: string; supervisor_user_id: string; }[];
  setDetailProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  skema: SkemaInsentif | null;
}

export function ModalDetailProyekInsentif({ allUsers, currentUser, detailProject, detailSplits, detailSupports, detailTranches, konfirmasiMarkPaid, markingPaid, ptsTeamMappings, setDetailProject, skema }: ModalDetailProyekInsentifProps) {
  return (
    <>
      {detailProject && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setDetailProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden border border-gray-200">
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{detailProject.project_name}</h2>
                  <p className="text-xs text-rose-200 mt-0.5">{detailProject.assign_name} · {detailProject.category}</p>
                </div>
                <button aria-label="Tutup" onClick={() => setDetailProject(null)} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
              <div className={`grid ${bisaInput(currentUser) ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                {bisaInput(currentUser) && (
                  <div className="rounded-xl p-3 text-center bg-emerald-50 border border-emerald-100">
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">Total Pool</p>
                    <p className="text-base font-black text-emerald-700">{formatRupiah(detailProject.incentive_value || 0)}</p>
                  </div>
                )}
                <div className="rounded-xl p-3 text-center bg-blue-50 border border-blue-100">
                  <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Mode</p>
                  <p className="text-sm font-bold text-blue-700">{detailProject.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : detailProject.mode_penyelesaian === 'remote' ? '💻 Remote' : '—'}</p>
                  {detailProject.mode_penyelesaian === 'remote' && detailProject.installer_name && (
                    <p className="text-[11px] text-blue-500 mt-0.5 font-medium"><Ikon nama="🔧" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailProject.installer_name}{detailProject.installer_daerah ? ` · ${detailProject.installer_daerah}` : ''}</p>
                  )}
                </div>
                <div className="rounded-xl p-3 text-center bg-violet-50 border border-violet-100">
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-widest">BAST</p>
                  <p className="text-sm font-bold text-violet-700">{detailProject.bast_date ? new Date(detailProject.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                </div>
              </div>

              {/*
                Controller Automation yang dipilih di Reminder Schedule.
                Datanya SUDAH tersimpan sejak dulu (requires_controller_automation
                + controller_automation_brand) dan sudah tampil sebagai lencana di
                kartu daftar - tapi hilang begitu detailnya dibuka. Padahal justru
                di sinilah ia dibutuhkan: brand Controller-lah yang menjelaskan
                kenapa sebuah proyek jatuh ke skema Manager-sebagai-PIC (Extron /
                Wyrestorm biasanya ditangani langsung Manager), jadi tanpa
                keterangan ini pembagiannya terlihat seperti keputusan tanpa sebab.
              */}
              <div className="rounded-xl p-3 border border-emerald-100 bg-emerald-50/60">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest"><IkonTeks nama="⚡" />Controller Automation</p>
                  {detailProject.requires_controller_automation ? (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-600 text-white">
                      {detailProject.controller_automation_brand?.toUpperCase() || 'YA'}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">Tidak dipakai</span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-700/70 mt-1 leading-relaxed">
                  Dipilih saat pembuatan Request Schedule dan ikut tercatat pada proyek ini.
                  {detailProject.pic_type === 'manager_pic' && ' Proyek ini memakai skema Manager-sebagai-PIC karena handler-nya berjabatan Manager.'}
                </p>
              </div>

              {/* Pembagian Incentive — auto-calculated, selalu tampil */}
              {(() => {
                //  Skema dimuat async di loadAll() - kalau popup ini sempat terbuka
                //  sebelum itu selesai (mis. refresh cepat), skema masih null.
                //  Tanpa penjagaan ini seluruh popup detail proyek crash.
                if (!skema) return <p className="text-sm text-gray-500">Memuat skema insentif...</p>;
                const pool = detailProject.incentive_value || 0;
                const effectiveMode = detailProject.mode_penyelesaian || 'onsite';
                const effectivePool = pool > 0 ? pool : 1_000_000;
                const isEstimate = pool <= 0 || !detailProject.mode_penyelesaian;
                // Manager & Supervisor dibaca dari Struktur Organisasi (users.atasan_id + jabatan),
                // BUKAN hardcode nama. Resolve PIC via id/nama, lalu walk-up pohon atasan.
                const orgList = allUsers as unknown as OrgUser[];
                const picId = resolveUserId((detailProject.pic_id || detailProject.assigned_to) as string, detailProject.assign_name, orgList);
                const mgrUp = findUpline(picId, 'Manager', orgList);
                const supUp = findUpline(picId, 'Supervisor', orgList);
                // Fallback transisi (tanpa hardcode nama): pts_team_mappings utk supervisor, jabatan utk manager
                const dbPtsMap = ptsTeamMappings.find(m => m.staff_user_id === detailProject.assigned_to);
                const mgrUser = mgrUp
                  ? allUsers.find(u => u.id === mgrUp.id)
                  : (allUsers.find(u => ((u.jabatan as string) || '') === 'Manager' && ((u.team_type as string) || '').toLowerCase().includes('pts'))
                     ?? allUsers.find(u => ((u.jabatan as string) || '') === 'Manager'));
                const supUser = supUp
                  ? allUsers.find(u => u.id === supUp.id)
                  : dbPtsMap ? allUsers.find(u => u.id === dbPtsMap.supervisor_user_id) : undefined;
                const managerId   = (mgrUser?.id        || '') as string;
                const managerName = (mgrUser?.full_name || 'Manager') as string;
                const supervisorId   = (supUser?.id        || '') as string;
                const supervisorName = (supUser?.full_name || 'Supervisor') as string;
                const displayProject: IncentiveProjectRow = { ...detailProject, incentive_value: effectivePool, mode_penyelesaian: effectiveMode };
                //  Pratinjau memakai Support TAHUN PERTAMA - komposisinya berbeda tiap
                //  tahun, jadi satu angka gabungan tidak akan pernah benar untuk
                //  tahun mana pun. Rinciannya ada di daftar per tahun di bawah.
                const supportTahun1 = detailSupports.find(x => x.tahunKe === 1)?.orang ?? [];
                const splits = calculateIncentiveSplits(skema, displayProject, managerId, managerName, supervisorId, supervisorName, supportTahun1, picId);
                if (!splits.length) return null;
                // Privasi: non-privileged (selain Admin & yang ditunjuk input nominal)
                // hanya melihat bagiannya sendiri - bukan total pool / bagian orang lain.
                const privileged = bisaInput(currentUser);
                const myName = (currentUser?.full_name || '').toLowerCase().trim();
                const visibleSplits = privileged
                  ? splits
                  : splits.filter(s => (s.user_id && s.user_id === currentUser?.id) || (!!myName && (s.user_name || '').toLowerCase().trim() === myName));
                const schemeLabel = detailProject.pic_type === 'manager_pic' ? 'Manager sebagai PIC' : 'Standard';
                const modeLabel = effectiveMode === 'remote' ? 'Remote' : 'Onsite';
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-700">{privileged ? '💰 Pembagian Incentive' : '💰 Bagian Saya'}</h3>
                      <div className="flex items-center gap-1.5">
                        {privileged && <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{schemeLabel} · {modeLabel}</span>}
                        {isEstimate && <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Estimasi</span>}
                      </div>
                    </div>
                    {!privileged && visibleSplits.length === 0 && (
                      <div className="rounded-xl px-4 py-6 text-center bg-gray-50 border border-gray-100">
                        <p className="text-sm text-gray-500">Kamu tidak tercatat mendapat bagian di project ini.</p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {visibleSplits.map((s, i) => {
                        const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                        const isInstaller = s.role === 'installer';
                        return (
                          <div key={i} className="flex items-center justify-between rounded-xl px-4 py-2.5"
                            style={{ background: isInstaller ? 'rgba(245,158,11,0.07)' : 'rgba(99,102,241,0.05)', border: `1px solid ${isInstaller ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.12)'}` }}>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{s.user_name || '—'}</p>
                                {isInstaller && detailProject.installer_daerah && (
                                  <p className="text-[11px] text-gray-500"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailProject.installer_daerah}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-gray-800">
                                {pool > 0 ? formatRupiah(s.amount) : '—'}
                              </p>
                              <p className="text-[11px] text-gray-500">{formatPct(s.percentage)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {isEstimate && (
                      <p className="text-[11px] text-amber-700 mt-1.5 italic">
                        {!pool
                          ? '* Belum ada nominal — angka Rp akan muncul setelah input nominal.'
                          : '* Mode belum diset (estimasi Onsite) — akan update setelah Handler klik Completed di Reminder Schedule.'}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2"><IkonTeks nama="📅" />Tranches</h3>
                {detailTranches.length === 0
                  ? <p className="text-xs text-gray-500 italic">Belum ada tranche.</p>
                  : detailTranches.map(t => {
                    const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                    const amt = (detailProject.incentive_value || 0) * (t.percentage / 100);
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded-lg px-4 py-3 bg-gray-50 border border-gray-100 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-gray-700">T{t.tranche_number}</span>
                          <span className="text-sm text-gray-600">{t.percentage}%{bisaInput(currentUser) ? ` · ${formatRupiah(Math.round(amt))}` : ''}</span>
                          <span className="text-xs text-gray-500">Tahun {t.payment_year}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}><Ikon nama={st.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {st.label}</span>
                          {t.status === 'processed' && bisaKonfig(currentUser) && (
                            <button onClick={() => konfirmasiMarkPaid(t.id, detailProject.project_name || '—', t.tranche_number)}
                              disabled={markingPaid === t.id}
                              className="px-2 py-1 rounded text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 disabled:opacity-50">
                              {markingPaid === t.id ? '⏳...' : 'Tandai Paid'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">{bisaInput(currentUser) ? '💰 Incentive Splits' : '💰 Bagian Saya (Tercatat)'}</h3>
                {(() => {
                  const myNm = (currentUser?.full_name || '').toLowerCase().trim();
                  const visDb = bisaInput(currentUser) ? detailSplits : detailSplits.filter(s => (s.user_id && s.user_id === currentUser?.id) || (!!myNm && (s.user_name || '').toLowerCase().trim() === myNm));
                  return visDb.length === 0
                  ? <p className="text-xs text-gray-500 italic">{bisaInput(currentUser) ? 'Belum ada split. Proses batch untuk generate.' : 'Belum ada bagian tercatat untukmu.'}</p>
                  : visDb.map(s => {
                    const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-lg px-4 py-2.5 bg-gray-50 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
                          <span className="text-sm text-gray-700">{s.user_name || '—'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-800">{formatRupiah(s.amount || 0)}</span>
                          <span className="text-xs text-gray-500 ml-2">({formatPct(s.percentage)})</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-1"><IkonTeks nama="👥" />Support per Tahun Pencairan</h3>
                <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">
                  Diambil otomatis dari <strong>ticket Troubleshooting yang berstatus Solved</strong> dan dari
                  <strong> jadwal Troubleshooting yang ditutup selesai</strong> — keduanya dibaca, karena
                  Troubleshooting memang tercatat di dua tempat. Yang menentukan tahunnya adalah tanggal
                  pekerjaan itu <strong>selesai</strong>, bukan tanggal dilaporkan. Tiap tahun dinilai ulang:
                  yang menangani boleh orang yang sama atau berbeda, dan yang tidak menangani di tahun itu
                  tidak ikut dibayar untuk tahun itu.
                </p>
                <div className="space-y-2">
                  {detailSupports.map(th => {
                    const rentang = th.dari
                      ? `${new Date(th.dari).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} → ${th.sampai ? new Date(th.sampai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}`
                      : `s.d. ${th.sampai ? new Date(th.sampai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} (termasuk sebelum BAST)`;
                    return (
                      <div key={th.tahunKe} className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Tahun {th.tahunKe}</span>
                          <span className="text-[11px] text-gray-500">{rentang}</span>
                        </div>
                        {th.orang.length === 0 ? (
                          //  Bukan sekadar "kosong": tanpa Support di tahun itu, porsinya
                          //  jatuh ke PIC menurut skema "tanpa support" - dan itu perlu
                          //  terbaca supaya angkanya tidak terlihat seperti salah hitung.
                          <p className="text-[11px] text-gray-500 italic px-3 py-2">
                            Belum ada Troubleshooting yang selesai di tahun ini — porsi Support tahun ini diserap PIC.
                          </p>
                        ) : th.orang.map(s => (
                          <div key={`${th.tahunKe}-${s.user_id}`} className="flex items-center justify-between px-3 py-1.5 border-t border-gray-50">
                            <span className="text-sm text-gray-700">{s.user_name || s.user_id}</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200">Troubleshooting</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
