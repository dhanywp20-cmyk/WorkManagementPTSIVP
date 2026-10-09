'use client';

/** FilterProyekInsentif - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { bisaKonfig, bisaInput, type CurrentUser } from './aturan-halaman';
import { IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, type KandidatGabung, formatRupiah } from './calc';

export interface FilterProyekInsentifProps {
  bastYearsProjects: number[];
  bolehHapus: boolean;
  currentUser: CurrentUser | null;
  exporting: boolean;
  filterBastYear: number | null;
  filteredProjects: IncentiveProjectRow[];
  handleExportSummary: () => Promise<void>;
  kandidatBulkGenerate: (tahun: number) => IncentiveProjectRow[];
  kandidatGabung: KandidatGabung[];
  mintaKonfirmasiHapus: (target: IncentiveProjectRow[]) => Promise<void>;
  pilihHapus: Set<string>;
  searchProject: string;
  setBulkGenerateConfirm: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
  setFilterBastYear: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setKonfirmGabung: import("react").Dispatch<import("react").SetStateAction<KandidatGabung | null>>;
  setPilihHapus: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSummaryExportYear: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  summaryExportYear: number | null;
}

export function FilterProyekInsentif({ bastYearsProjects, bolehHapus, currentUser, exporting, filterBastYear, filteredProjects, handleExportSummary, kandidatBulkGenerate, kandidatGabung, mintaKonfirmasiHapus, pilihHapus, searchProject, setBulkGenerateConfirm, setFilterBastYear, setKonfirmGabung, setPilihHapus, setSearchProject, setSummaryExportYear, summaryExportYear }: FilterProyekInsentifProps) {
  return (
    <>
      <div className="px-4 pt-4 pb-3 border-b border-gray-200 space-y-2">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <input aria-label="Cari project atau handler..." value={searchProject} onChange={e => setSearchProject(e.target.value)}
            placeholder="Cari project atau handler..."
            className="flex-1 min-w-[180px] max-w-sm px-4 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-rose-400" />
          <select aria-label="Filter Tahun BAST" value={filterBastYear ?? ''}
            onChange={e => setFilterBastYear(e.target.value === '' ? null : Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 text-gray-700 focus:ring-2 focus:ring-rose-400">
            <option value="">Semua Tahun BAST</option>
            {bastYearsProjects.map(y => <option key={y} value={y}>Tahun BAST {y}</option>)}
          </select>
          <div className="flex items-center gap-2 flex-wrap">
            {bisaInput(currentUser) && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200"><IkonTeks nama="✏" />Kamu bisa input nominal</span>
            )}
            {bisaInput(currentUser) && (<>
              {/*
                Tahun export Summary TERPISAH dari filter Tahun BAST di
                atas - filter di atas cuma mengubah tampilan tabel,
                sedangkan orang yang lupa mengembalikannya ke "Semua"
                sebelum export tidak boleh diam-diam mendapat file yang
                lebih kecil dari yang dikira. Defaultnya selalu Semua
                Tahun, harus dipilih sendiri kalau memang mau per tahun.
              */}
              <select aria-label="Tahun Export Summary" value={summaryExportYear ?? ''}
                onChange={e => setSummaryExportYear(e.target.value === '' ? null : Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 outline-none">
                <option value="">Semua Tahun</option>
                {bastYearsProjects.map(y => <option key={y} value={y}>Tahun {y}</option>)}
              </select>
              <button onClick={handleExportSummary} disabled={exporting}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5">
                {exporting ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-500 rounded-full animate-spin" /> : '📊'} Export Summary
              </button>
            </>)}
            {bisaKonfig(currentUser) && filterBastYear != null && kandidatBulkGenerate(filterBastYear).length > 0 && (
              <button onClick={() => setBulkGenerateConfirm(kandidatBulkGenerate(filterBastYear))}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 flex items-center gap-1.5">
                <IkonTeks nama="🚀" />Generate Tahapan Massal {filterBastYear} ({kandidatBulkGenerate(filterBastYear).length})
              </button>
            )}
            {/* Tombol massal hanya muncul saat ada yang dipilih - tombol
                hapus yang selalu terlihat mengundang klik tanpa maksud. */}
            {bolehHapus && pilihHapus.size > 0 && (
              <>
                <span className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200">
                  {pilihHapus.size} dipilih
                </span>
                <button onClick={() => setPilihHapus(new Set())}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50">
                  Batal pilih
                </button>
                <button onClick={() => mintaKonfirmasiHapus(filteredProjects.filter(p => pilihHapus.has(p.id)))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 border border-red-700 hover:bg-red-700 flex items-center gap-1.5">
                  <IkonTeks nama="🗑" />Keluarkan dari Incentive
                </button>
              </>
            )}
          </div>
        </div>

        {/*
          Spanduk kandidat gabung. Hanya muncul kalau ada yang terdeteksi,
          dan hanya untuk yang boleh mengelola insentif.

          Diletakkan di ATAS daftar, bukan sebagai lencana kecil di baris
          proyeknya: yang perlu diketahui adalah bahwa dua baris berbeda
          sebenarnya satu, dan itu tidak bisa disampaikan dari dalam salah
          satu barisnya saja.
        */}
        {bolehHapus && kandidatGabung.length > 0 && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-amber-200">
              <p className="text-[13px] font-bold text-amber-900">
                {kandidatGabung.length} proyek terdeteksi tercatat lebih dari sekali
              </p>
              <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                Nama proyeknya sama dan tanggal BAST-nya berdekatan (selisih maksimal 7 hari),
                tapi jadwalnya terpisah — biasanya Konfigurasi dan Training yang dijadwalkan
                di hari berbeda dan ditutup dengan dua BAST berurutan. Selama belum
                digabungkan, masing-masing punya pool nominal sendiri.
                <b> Periksa dulu:</b> kalau ini memang dua kontrak berbeda, biarkan terpisah.
              </p>
            </div>
            <div className="divide-y divide-amber-200">
              {kandidatGabung.map((k, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{k.nama}</p>
                    <p className="text-[11px] text-slate-600">
                      BAST {k.bast_date} · {k.anggota.length} jadwal ·{' '}
                      {k.anggota.map(a => `${a.category ?? '-'} (${a.assign_name ?? '-'})`).join(' + ')}
                    </p>
                  </div>
                  <button type="button" onClick={() => setKonfirmGabung(k)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 flex-shrink-0">
                    Gabungkan
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/*
          SPANDUK KELENGKAPAN DATA.

          Process Batch menolak proyek yang mode_penyelesaian-nya kosong -
          dan dulu satu-satunya cara mengetahuinya adalah menekan tombolnya
          lalu membaca daftar galat. Kelengkapan yang menentukan berhasil
          atau tidaknya pemrosesan harus terbaca SEBELUM tombol ditekan,
          bukan sesudah.

          Brand kosong tidak menggagalkan pemrosesan, tapi membuat proyek
          itu terlihat oleh SEMUA petugas apa pun lingkup brand-nya (lihat
          bolehLihatBrand) - jadi tetap perlu disebut, dengan nada yang
          lebih ringan.
        */}
        {bisaInput(currentUser) && (() => {
          const tanpaMode  = filteredProjects.filter(p => !p.mode_penyelesaian);
          const tanpaBrand = filteredProjects.filter(p => !p.brand);
          if (tanpaMode.length === 0 && tanpaBrand.length === 0) return null;
          return (
            <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5">
              <p className="text-[13px] font-bold text-sky-900">Data proyek belum lengkap</p>
              <p className="text-[11px] text-sky-800 leading-relaxed mt-0.5">
                {tanpaMode.length > 0 && (
                  <>
                    <b>{tanpaMode.length} proyek tanpa mode penyelesaian</b> (Remote/Onsite) — proyek ini
                    akan <b>gagal</b> saat Process Batch karena porsinya tidak bisa dihitung.
                    Isi dari Request Schedule, atau lewat tombol Input Nominal.{' '}
                  </>
                )}
                {tanpaBrand.length > 0 && (
                  <>
                    <b>{tanpaBrand.length} proyek tanpa brand</b> — masih ikut terhitung, tapi terlihat
                    oleh semua petugas apa pun lingkup brand-nya. Klik lencana brand di baris proyeknya
                    untuk menetapkan MVI / IVP / Kedua Brand.
                  </>
                )}
              </p>
            </div>
          );
        })()}
        <p className="text-xs text-gray-500">
          <span className="font-bold text-gray-600">{filteredProjects.length}</span> project
          {bisaInput(currentUser) && (<>
            &nbsp;·&nbsp;<span className="font-bold text-emerald-700">{filteredProjects.filter(p => (p.incentive_value||0)>0).length}</span> ada nominal ·&nbsp;
            <span className="font-bold text-amber-700">{filteredProjects.filter(p => !(p.incentive_value||0)).length}</span> belum isi nominal
          </>)}
          {/*
            Total nominal utk SEMUA role - dijumlah dari filteredProjects
            (sudah tersaring ke project sendiri utk non-privileged),
            BUKAN dari totalPool (total seluruh platform).
          */}
          &nbsp;·&nbsp;Total:&nbsp;
          <span className="font-bold text-emerald-700">
            {formatRupiah(filteredProjects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0))}
          </span>
        </p>
      </div>
    </>
  );
}
