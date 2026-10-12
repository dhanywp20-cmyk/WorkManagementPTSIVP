'use client';

/** KartuAturanNominal - siapa yang boleh melihat nominal total proyek (disimpan di app_settings lewat /api/incentive/nominal). */
import { useEffect, useState } from 'react';
import { IkonTeks } from '@/components/shared/Ikon';
import { ambilPetaNominal, simpanAturanNominal } from '@/lib/incentive-nominal-api';
import type { LihatNominal } from '@/lib/incentive-nominal';

const PILIHAN: { nilai: LihatNominal; label: string; petunjuk: string }[] = [
  { nilai: 'petugas', label: 'Petugas saja', petunjuk: 'Nominal total proyek hanya terlihat oleh pemegang akses Input/Penuh. Yang lain hanya melihat bagiannya yang sudah tercatat.' },
  { nilai: 'terlibat', label: 'Petugas + terlibat', petunjuk: 'Selain petugas, PIC/handler proyek dan yang sudah punya baris bagian melihat nominal proyeknya sendiri.' },
];

export function KartuAturanNominal() {
  const [nilai, setNilai] = useState<LihatNominal | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let batal = false;
    ambilPetaNominal().then(h => { if (!batal && h.aturan) setNilai(h.aturan.lihat); });
    return () => { batal = true; };
  }, []);

  async function pilih(n: LihatNominal) {
    if (menyimpan || n === nilai) return;
    setMenyimpan(true); setGalat('');
    const { error } = await simpanAturanNominal({ lihat: n });
    if (error) setGalat(error.message); else setNilai(n);
    setMenyimpan(false);
  }

  return (
    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
      <span className="text-xs font-bold text-gray-600"><IkonTeks nama="🔒" />Nominal proyek terlihat oleh</span>
      <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
        {PILIHAN.map(p => (
          <button key={p.nilai} type="button" title={p.petunjuk} disabled={menyimpan || nilai === null} onClick={() => pilih(p.nilai)}
            className={`px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${nilai === p.nilai ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-indigo-50'}`}>
            {p.label}
          </button>
        ))}
      </div>
      {galat && <span className="text-[11px] text-rose-600">{galat}</span>}
    </div>
  );
}
