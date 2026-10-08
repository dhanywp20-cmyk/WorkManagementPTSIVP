'use client';

/** TabelProyekInsentif - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { bisaKonfig, bisaInput, calcHandlerSplit, type CurrentUser } from './aturan-halaman';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { type CSSProperties } from 'react';
import { IncentiveProjectRow, IncentiveTranche, type SkemaInsentif, formatRupiah, TRANCHE_STATUS } from './calc';
import { Paginasi } from '@/components/shared';

export interface TabelProyekInsentifProps {
  bolehHapus: boolean;
  brandEditFor: string | null;
  currentUser: CurrentUser | null;
  filteredProjects: IncentiveProjectRow[];
  hal: import("@/components/shared/Paginasi").HasilPaginasi<IncentiveProjectRow>;
  handleSetProjectBrand: (projectId: string, brand: "MVI" | "IVP" | "BOTH") => Promise<void>;
  mintaKonfirmasiHapus: (target: IncentiveProjectRow[]) => Promise<void>;
  openProjectDetail: (p: IncentiveProjectRow) => Promise<void>;
  pilihHapus: Set<string>;
  setBrandEditFor: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setGenerateProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setHapusTahapan: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setKetikHapusTahapan: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNominalBast: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNominalProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setNominalValue: import("react").Dispatch<import("react").SetStateAction<string>>;
  setShowGenerateModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  skema: SkemaInsentif | null;
  thCls: "px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200";
  togglePilih: (id: string) => void;
  totalPool: number;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function TabelProyekInsentif({ bolehHapus, brandEditFor, currentUser, filteredProjects, hal, handleSetProjectBrand, mintaKonfirmasiHapus, openProjectDetail, pilihHapus, setBrandEditFor, setGenerateProject, setHapusTahapan, setKetikHapusTahapan, setNominalBast, setNominalProject, setNominalValue, setShowGenerateModal, skema, thCls, togglePilih, totalPool, tranches }: TabelProyekInsentifProps) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto bg-slate-100/60 px-3 pb-2">
        <table className="w-full text-sm tabel-kartu">
          <thead>
            <tr style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07))' }}>
              <th className={`${thCls} w-10 text-center`}>No</th>
              <th className={`${thCls} w-[210px] max-w-[210px]`}>Project</th>
              <th className={`${thCls} w-[130px]`}>Handler</th>
              <th className={`${thCls} w-[140px]`}>Kategori</th>
              <th className={`${thCls} w-[100px]`}>Mode</th>
              <th className={`${thCls} w-[110px]`}>BAST</th>
              {/*
                Nominal SEKARANG tampil utk semua role (dulu khusus
                canInputNominal) - list ini sudah tersaring ke project
                yang usernya sendiri terlibat (lihat userInProject di
                atas), jadi menampilkan pool project di sini bukan
                kebocoran baru: nominal & bagiannya sendiri sudah bisa
                dilihat lewat modal detail juga. "Bagian Handler" TETAP
                privileged-only - itu bisa jadi bagian ORANG LAIN kalau
                yang login bukan handler-nya, beda dari Nominal (pool
                project, bukan bagian personal siapa pun).
              */}
              <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 w-[150px]">Nominal</th>
              {bisaInput(currentUser) && <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 w-[145px]">Bagian Handler</th>}
              <th className={`${thCls} w-[90px] text-center`}>Tranche</th>
              <th className={`${thCls} ${bolehHapus ? 'w-[130px]' : 'w-[100px]'} text-center`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr><td colSpan={bisaInput(currentUser) ? 10 : 9} className="px-4 py-16 text-center border border-gray-200">
                <p className="text-4xl mb-3"><Ikon nama="📭" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
                <p className="text-gray-500 font-medium">Belum ada project incentive</p>
                <p className="text-gray-500 text-xs mt-1">Data muncul dari Reminder Schedule kategori Konfigurasi / Training yang sudah Completed</p>
              </td></tr>
            ) : hal.potongan.map((p, idx) => {
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30';
              const cellCls = `border border-gray-200 px-3 py-2.5 ${rowBg}`;
              const hasNominal = (p.incentive_value || 0) > 0;
              //  Lihat catatan di baris kartu mobile di atas - fetchTranches()
              //  mengurutkan lewat payment_year, bukan tranche_number.
              const projTranches = tranches.filter(t => t.project_id === p.id)
                .sort((a, b) => a.tranche_number - b.tranche_number);
              const handlerSplit = calcHandlerSplit(skema, p);
              return (
                <tr key={p.id} className="group" style={{ '--aksen-baris': '#fb7185', '--bg-baris-sorot': '#fff1f2' } as CSSProperties}>
                  <td className={`${cellCls} text-xs text-gray-500 text-center`}>{hal.mulai + idx + 1}</td>
                  <td className={`${cellCls} max-w-[210px]`}>
                    <p className="font-semibold text-gray-800 leading-snug truncate max-w-[195px]" title={p.project_name}>{p.project_name}</p>
                    {p.product && <p className="text-[11px] text-rose-500 mt-0.5 truncate max-w-[195px]" title={p.product}><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.product}</p>}
                    {p.address && <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[195px]" title={p.address}><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.address}</p>}
                  </td>
                  <td className={cellCls}>
                    <p className="text-sm font-medium text-gray-700">{p.assign_name || '—'}</p>
                    {p.pic_type === 'manager_pic' && <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block">Manager PIC</span>}
                    {/*
                      Lencana brand. Dua petugas Finance memakai daftar
                      yang sudah tersaring, jadi lencana ini bukan sekadar
                      hiasan - ia yang menjelaskan KENAPA sebuah proyek
                      ada di daftarnya, dan kenapa yang lain tidak.

                      Utk Admin, lencana ini KLIK-ABLE - membuka picker
                      MVI/IVP/Kedua kecil di bawahnya utk set manual.
                      Sebelumnya satu-satunya jalan membetulkan project
                      "tanpa brand" adalah hapus reminder lalu Sync ulang
                      dari Reminder Schedule - berisiko ikut menghapus
                      BAST/nominal/tahapan yang sudah terlanjur diproses,
                      padahal yang salah cuma satu kolom.
                    */}
                    {bisaKonfig(currentUser) ? (
                      <span className="relative inline-block mt-0.5 ml-1">
                        <button type="button"
                          onClick={() => setBrandEditFor(brandEditFor === p.id ? null : p.id)}
                          title="Klik untuk set brand manual"
                          className={`text-[11px] font-bold px-1.5 py-0.5 rounded border inline-block hover:opacity-75 transition-opacity ${
                            p.brand === 'MVI'  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : p.brand === 'IVP' ? 'text-blue-700 bg-blue-50 border-blue-200'
                            : p.brand === 'BOTH' ? 'text-violet-700 bg-violet-50 border-violet-200'
                            : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                          {p.brand === 'MVI' ? '🏠 MVI' : p.brand === 'IVP' ? '🌐 IVP'
                            : p.brand === 'BOTH' ? '🏠🌐 Kedua' : '⚠️ tanpa brand'} <Ikon nama="✏" ukuran="1em" className="inline-block align-[-0.12em]" />
                        </button>
                        {brandEditFor === p.id && (
                          <div className="absolute z-20 top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 flex gap-1 whitespace-nowrap">
                            {(['MVI', 'IVP', 'BOTH'] as const).map(b => (
                              <button key={b} type="button"
                                onClick={() => { handleSetProjectBrand(p.id, b); setBrandEditFor(null); }}
                                className="text-[11px] font-bold px-2 py-1 rounded hover:bg-gray-100 text-gray-700 border border-transparent hover:border-gray-200">
                                {b === 'MVI' ? '🏠 MVI' : b === 'IVP' ? '🌐 IVP' : '🏠🌐 Kedua'}
                              </button>
                            ))}
                          </div>
                        )}
                      </span>
                    ) : (
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ml-1 inline-block ${
                        p.brand === 'MVI'  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : p.brand === 'IVP' ? 'text-blue-700 bg-blue-50 border-blue-200'
                        : p.brand === 'BOTH' ? 'text-violet-700 bg-violet-50 border-violet-200'
                        : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                        {p.brand === 'MVI' ? '🏠 MVI' : p.brand === 'IVP' ? '🌐 IVP'
                          : p.brand === 'BOTH' ? '🏠🌐 Kedua' : '⚠️ tanpa brand'}
                      </span>
                    )}
                  </td>
                  <td className={cellCls}>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">{p.category}</span>
                    {p.requires_controller_automation && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><Ikon nama="⚡" ukuran="1em" className="inline-block align-[-0.12em]" />{p.controller_automation_brand?.toUpperCase()}</span>
                    )}
                  </td>
                  <td className={cellCls}>
                    {p.mode_penyelesaian === 'onsite' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><IkonTeks nama="🏢" />Onsite</span>}
                    {p.mode_penyelesaian === 'remote' && (
                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200"><IkonTeks nama="💻" />Remote</span>
                        {p.installer_name && <p className="text-[11px] text-blue-600 mt-0.5 truncate max-w-[90px]"><Ikon nama="🔧" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.installer_name}</p>}
                        {p.installer_daerah && <p className="text-[11px] text-gray-500 truncate max-w-[90px]"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.installer_daerah}</p>}
                      </div>
                    )}
                    {!p.mode_penyelesaian && <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className={cellCls}>
                    {p.bast_date
                      ? <p className="text-xs font-semibold text-gray-700">{new Date(p.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      : <span className="text-xs text-amber-700 italic">Belum diisi</span>}
                  </td>
                  <td className={`${cellCls} text-right`}>
                    {hasNominal
                      ? <p className="text-sm font-black text-emerald-700">{formatRupiah(p.incentive_value || 0)}</p>
                      : <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"><IkonTeks nama="⏳" />Belum</span>}
                  </td>
                  {bisaInput(currentUser) && (
                    <td className={`${cellCls} text-right`}>
                      {handlerSplit ? (
                        <div>
                          <p className="text-sm font-black text-rose-700">{formatRupiah(handlerSplit.amt)}</p>
                          <p className="text-[11px] text-gray-500">{handlerSplit.pct.toFixed(0)}% pool</p>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  )}
                  <td className={`${cellCls} text-center`}>
                    {projTranches.length > 0 ? (
                      <div className="flex gap-0.5 justify-center">
                        {projTranches.map(t => {
                          const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                          return <span key={t.id} title={`T${t.tranche_number} ${st.label}`} className="w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center" style={{ background: st.bg, color: st.color }}>{t.tranche_number}</span>;
                        })}
                      </div>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className={`${cellCls} text-center`} onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center">
                      {/* View — semua role bisa akses */}
                      <button aria-label="Lihat Detail" onClick={() => openProjectDetail(p)}
                        title="Lihat Detail"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm">
                        <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      {bisaInput(currentUser) && (
                        <button aria-label="Input Nominal" onClick={() => { setNominalProject(p); setNominalValue(String(p.incentive_value || '')); setNominalBast((p.bast_date ?? '').slice(0, 10)); }}
                          title="Input Nominal"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      )}
                      {hasNominal && projTranches.length === 0 && p.bast_date && (
                        <button aria-label="Generate Tranche" onClick={() => { setGenerateProject(p); setShowGenerateModal(true); }}
                          title="Generate Tranche"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>
                      )}
                      {/*
                        Jalan kembali dari Generate Tranche. Muncul hanya
                        bila tahapannya memang ada DAN belum ada yang Paid -
                        tahap yang sudah dibayar tidak boleh dihapus dari layar.
                        */}
                        {bisaKonfig(currentUser) && projTranches.length > 0
                        && !projTranches.some(t => t.status === 'paid') && (
                        <button aria-label={`Hapus tahapan ${p.project_name}`}
                          onClick={() => { setHapusTahapan(p); setKetikHapusTahapan(''); }}
                          title="Hapus tahapan pencairan (nominal terbuka lagi)"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-400 hover:shadow-sm">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 110 8h-1m-9-8l4-4m-4 4l4 4" /></svg>
                        </button>
                        )}
                      {bolehHapus && (
                        <>
                          <button aria-label={`Keluarkan ${p.project_name} dari Incentive`}
                            onClick={() => mintaKonfirmasiHapus([p])} title="Keluarkan dari Incentive"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-300 hover:shadow-sm">
                            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                          <input type="checkbox" checked={pilihHapus.has(p.id)}
                            onChange={() => togglePilih(p.id)}
                            aria-label={`Pilih ${p.project_name}`}
                            title="Pilih untuk dikeluarkan bersama yang lain"
                            className="w-4 h-4 self-center accent-red-600 cursor-pointer" />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filteredProjects.length > 0 && (bisaInput(currentUser) ? (
            <tfoot>
              <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                <td colSpan={6} className="px-3 py-2.5 border border-gray-200 text-xs font-bold text-gray-600 text-right">TOTAL</td>
                <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-emerald-700">{formatRupiah(totalPool)}</td>
                <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-rose-700">
                  {formatRupiah(filteredProjects.reduce((s, p) => s + (calcHandlerSplit(skema, p)?.amt || 0), 0))}
                </td>
                <td colSpan={2} className="border border-gray-200" />
              </tr>
            </tfoot>
          ) : (
            /*
              Non-privileged: total DIHITUNG DARI filteredProjects (yang
              sudah tersaring ke project dia sendiri), BUKAN dari
              `totalPool` (total SELURUH platform) - kalau dipakai
              totalPool di sini, Team akan melihat total nominal
              seluruh perusahaan, bukan cuma project miliknya sendiri.
              Tanpa kolom Bagian Handler - itu bisa jadi bagian orang
              lain, tidak pas dijumlah jadi satu angka utk yang login.
            */
            <tfoot>
              <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                <td colSpan={6} className="px-3 py-2.5 border border-gray-200 text-xs font-bold text-gray-600 text-right">TOTAL (project saya)</td>
                <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-emerald-700">
                  {formatRupiah(filteredProjects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0))}
                </td>
                <td colSpan={2} className="border border-gray-200" />
              </tr>
            </tfoot>
          ))}
        </table>
        <Paginasi {...hal} satuan="project" warna="#4f46e5" />
      </div>
    </>
  );
}
