'use client';

/** DaftarProyekInsentifHP - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { bisaKonfig, bisaInput, calcHandlerSplit, type CurrentUser } from './aturan-halaman';
import { MobileListCard, MobileCardBadge, Paginasi } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, IncentiveTranche, type SkemaInsentif, formatRupiah } from './calc';

export interface DaftarProyekInsentifHPProps {
  currentUser: CurrentUser | null;
  filteredProjects: IncentiveProjectRow[];
  hal: import("@/components/shared/Paginasi").HasilPaginasi<IncentiveProjectRow>;
  openProjectDetail: (p: IncentiveProjectRow) => Promise<void>;
  setGenerateProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setHapusTahapan: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setKetikHapusTahapan: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNominalBast: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNominalProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setNominalValue: import("react").Dispatch<import("react").SetStateAction<string>>;
  setShowGenerateModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  skema: SkemaInsentif | null;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function DaftarProyekInsentifHP({ currentUser, filteredProjects, hal, openProjectDetail, setGenerateProject, setHapusTahapan, setKetikHapusTahapan, setNominalBast, setNominalProject, setNominalValue, setShowGenerateModal, skema, tranches }: DaftarProyekInsentifHPProps) {
  return (
    <>
      <div className="md:hidden bg-gray-50/70 p-1.5 space-y-1.5">
        {filteredProjects.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">Belum ada project incentive.</div>
        ) : hal.potongan.map((p) => {
          const hasNominal = (p.incentive_value || 0) > 0;
          const handlerSplit = calcHandlerSplit(skema, p);
          //  Diurutkan ulang di sini - fetchTranches() mengurutkan lewat
          //  payment_year (dipakai tab Tahapan Pencairan mengelompokkan per
          //  tahun), bukan tranche_number. Kalau dua tahapan kebetulan
          //  bertahun sama (mis. gara-gara data lama yang salah), badge di
          //  sini bisa tampil "T1 T3 T2" - urutan tampilan proyek per
          //  proyek harus tetap T1 T2 T3 apa pun urutan hasil fetch-nya.
          const projTranches = tranches.filter(t => t.project_id === p.id)
            .sort((a, b) => a.tranche_number - b.tranche_number);
          const showNominal = bisaInput(currentUser);
          return (
            <MobileListCard
              key={p.id}
              title={p.project_name}
              onClick={() => openProjectDetail(p)}
              meta={<>
                {p.product && <div className="truncate"><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.product}</div>}
                <div className="truncate"><Ikon nama="👷" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.assign_name || '—'}{p.bast_date ? ` · BAST ${new Date(p.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}` : ''}</div>
              </>}
              badges={<>
                <MobileCardBadge className="bg-purple-100 text-purple-700 border border-purple-200">{p.category}</MobileCardBadge>
                {/*
                  Nominal tampil utk semua role (dulu ikut showNominal,
                  yang privileged-only) - list ini sudah tersaring ke
                  project sendiri (userInProject), jadi bukan kebocoran
                  baru. showNominal TETAP dipakai di bawah utk tombol
                  Input Nominal & field Bagian Handler - dua hal itu
                  beda: satu aksi ubah data, satu lagi bisa jadi bagian
                  ORANG LAIN.
                */}
                {hasNominal
                  ? <span className="text-sm font-black text-emerald-700 whitespace-nowrap">{formatRupiah(p.incentive_value || 0)}</span>
                  : <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap"><IkonTeks nama="⏳" />Belum nominal</span>}
              </>}
              fields={[
                { label: 'Mode', value: p.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : p.mode_penyelesaian === 'remote' ? '💻 Remote' : '—' },
                { label: 'Tranche', value: projTranches.length > 0 ? projTranches.map(t => `T${t.tranche_number}`).join(' ') : '—' },
                { label: 'Bagian Handler', value: handlerSplit ? <span className="text-rose-700 font-bold">{formatRupiah(handlerSplit.amt)} ({handlerSplit.pct.toFixed(0)}%)</span> : '—', span2: true, hide: !showNominal },
              ]}
              actions={<>
                <button aria-label="Lihat Detail" onClick={() => openProjectDetail(p)} title="Lihat Detail" className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-slate-200 text-blue-500 hover:bg-blue-50">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                {showNominal && (
                  <button aria-label="Input Nominal" disabled={tranches.some(t => t.project_id === p.id)}
                  onClick={() => { setNominalProject(p); setNominalValue(String(p.incentive_value || '')); setNominalBast((p.bast_date ?? '').slice(0, 10)); }}
                  title={tranches.some(t => t.project_id === p.id) ? 'Nominal terkunci — tahapan pencairan sudah dibuat' : 'Input Nominal'}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-slate-200 text-rose-500 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white">
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                )}
                {hasNominal && projTranches.length === 0 && p.bast_date && (
                  <button aria-label="Generate Tranche" onClick={() => { setGenerateProject(p); setShowGenerateModal(true); }} title="Generate Tranche" className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-slate-200 text-blue-500 hover:bg-blue-50">
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </button>
                )}
                {bisaKonfig(currentUser) && projTranches.length > 0
                  && !projTranches.some(t => t.status === 'paid') && (
                  <button aria-label={`Hapus tahapan ${p.project_name}`}
                    onClick={() => { setHapusTahapan(p); setKetikHapusTahapan(''); }}
                    title="Hapus tahapan pencairan (nominal terbuka lagi)"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-amber-200 text-amber-700 hover:bg-amber-50">
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 110 8h-1m-9-8l4-4m-4 4l4 4" /></svg>
                  </button>
                )}
              </>}
            />
          );
        })}
        <Paginasi {...hal} satuan="project" warna="#4f46e5" />
      </div>
    </>
  );
}
