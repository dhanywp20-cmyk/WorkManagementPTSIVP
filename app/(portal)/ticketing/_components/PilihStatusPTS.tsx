'use client';

/**
 * Panel pilih status Team PTS di "Update Status". Status SEKARANG tampil terpisah dari pilihan,
 * yang tampil hanya status yang memang boleh dipilih (beserta artinya), dan ada opsi "tambah
 * catatan saja" untuk update tanpa ganti status. Tidak ada pilihan bawaan - harus dipilih sendiri.
 * Aturannya di alur-status.ts.
 */
import { Ikon } from '@/components/shared/Ikon';
import { ARTI_STATUS, alasanBelumBisa, bolehCatatanSaja, statusBerikutnya, type StatusAlurPTS } from './alur-status';

const GAYA: Record<StatusAlurPTS, { ikon: string; pilih: string; biasa: string; chip: string }> = {
  Pending:          { ikon: '🟡', pilih: 'bg-amber-500 text-white border-amber-500',     biasa: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',     chip: 'bg-amber-100 text-amber-800' },
  Call:             { ikon: '📞', pilih: 'bg-cyan-600 text-white border-cyan-600',       biasa: 'bg-white text-cyan-700 border-cyan-200 hover:bg-cyan-50',       chip: 'bg-cyan-100 text-cyan-800' },
  Onsite:           { ikon: '🚗', pilih: 'bg-purple-600 text-white border-purple-600',   biasa: 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50', chip: 'bg-purple-100 text-purple-800' },
  'In Progress':    { ikon: '🔵', pilih: 'bg-blue-600 text-white border-blue-600',       biasa: 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',       chip: 'bg-blue-100 text-blue-800' },
  'Pending Action': { ikon: '⏸️', pilih: 'bg-orange-600 text-white border-orange-600',   biasa: 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50', chip: 'bg-orange-100 text-orange-800' },
  Solved:           { ikon: '✅', pilih: 'bg-emerald-500 text-white border-emerald-500', biasa: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50', chip: 'bg-emerald-100 text-emerald-800' },
};

function Centang() {
  return (
    <svg aria-hidden="true" focusable="false" className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

export function PilihStatusPTS({ sekarang, dipilih, onPilih, jadwalOnsite }: {
  sekarang: string;
  /** '' = belum memilih. Sama dengan `sekarang` = tambah catatan saja. */
  dipilih: string;
  onPilih: (status: string) => void;
  /** Isian jadwal yang tampil di bawah Onsite saat Onsite dipilih. */
  jadwalOnsite?: React.ReactNode;
}) {
  const pilihan = statusBerikutnya(sekarang);
  const alasan = alasanBelumBisa(sekarang);
  const gayaSekarang = GAYA[sekarang as StatusAlurPTS];
  const catatanSaja = dipilih !== '' && dipilih === sekarang;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Status sekarang</span>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${gayaSekarang?.chip ?? 'bg-gray-100 text-gray-700'}`}>
          {gayaSekarang && <Ikon nama={gayaSekarang.ikon} ukuran="1em" className="inline-block align-[-0.12em]" />}{sekarang}
        </span>
      </div>

      <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mt-1">Ubah status ke *</p>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Ubah status ke">
        {pilihan.map(s => {
          const g = GAYA[s];
          const aktif = dipilih === s;
          return (
            <div key={s}>
              <button type="button" role="radio" aria-checked={aktif} onClick={() => onPilih(s)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 text-left transition-all ${aktif ? `${g.pilih} shadow-md` : g.biasa}`}>
                <Ikon nama={g.ikon} ukuran="1.15em" className="inline-block shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold">{s}</span>
                  <span className={`block text-[10.5px] font-medium ${aktif ? 'text-white/85' : 'text-gray-500'}`}>{ARTI_STATUS[s]}</span>
                </span>
                {aktif && <Centang />}
              </button>
              {s === 'Onsite' && aktif && jadwalOnsite}
            </div>
          );
        })}
      </div>

      {alasan && (
        <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-snug text-slate-600">
          <Ikon nama="ℹ️" ukuran="1em" className="inline-block shrink-0 mt-px" />
          <span>{alasan}</span>
        </p>
      )}

      {bolehCatatanSaja(sekarang) && (
        <button type="button" role="radio" aria-checked={catatanSaja} onClick={() => onPilih(sekarang)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-dashed text-left transition-all ${catatanSaja ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}>
          <Ikon nama="📝" ukuran="1.15em" className="inline-block shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold">Tambah catatan saja</span>
            <span className={`block text-[10.5px] font-medium ${catatanSaja ? 'text-white/80' : 'text-gray-500'}`}>Status tetap {sekarang}</span>
          </span>
          {catatanSaja && <Centang />}
        </button>
      )}
    </div>
  );
}
