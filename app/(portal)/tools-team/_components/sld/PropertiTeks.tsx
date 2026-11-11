'use client';
import { Bold, Copy, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { sudutSah } from '@/lib/sld/geometri';
import { LABEL_WARNA_TEKS, WARNA_TEKS } from '@/lib/sld/teks-bebas';
import type { TeksBebas, WarnaTeks } from '@/lib/sld/tipe';
import { IsianPt } from './IsianHuruf';
import { Area, Isian, kelasKecil, kelasTombol } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

export function PropertiTeks({ a, t }: { a: KeadaanSLD; t: TeksBebas }) {
  const ubah = (x: Partial<TeksBebas>) => a.ubahTeks(t.id, x);
  return (
    <div className="space-y-3">
      <Area label="Teks (Enter untuk baris baru)" nilai={t.isi} onUbah={v => ubah({ isi: v.slice(0, 500) })} baris={4} placeholder="Tulis teks..." />
      <IsianPt label="Ukuran huruf" mm={t.ukuran} onUbah={mm => ubah({ ukuran: Math.round(mm * 100) / 100 })} />
      <Isian label="Warna">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(WARNA_TEKS) as WarnaTeks[]).map(w => (
            <button key={w} type="button" onClick={() => ubah({ warna: w })} aria-pressed={t.warna === w}
              className={`${kelasTombol} !px-2.5 ${t.warna === w ? '!border-blue-500 ring-2 ring-blue-200' : ''}`}>
              <span className="w-3 h-3 rounded-full" style={{ background: WARNA_TEKS[w] }} aria-hidden="true" /> {LABEL_WARNA_TEKS[w]}
            </button>
          ))}
        </div>
      </Isian>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={`${kelasTombol} ${t.tebal ? '!bg-blue-50 !border-blue-300' : ''}`} onClick={() => ubah({ tebal: !t.tebal })} aria-pressed={t.tebal}>
          <Bold size={15} /> Tebal
        </button>
        <button type="button" className={kelasTombol} onClick={() => ubah({ putar: sudutSah((t.putar ?? 0) - 90) || undefined })} aria-label="Putar 90° ke kiri"><RotateCcw size={15} /></button>
        <button type="button" className={kelasTombol} onClick={() => ubah({ putar: sudutSah((t.putar ?? 0) + 90) || undefined })} aria-label="Putar 90° ke kanan"><RotateCw size={15} /></button>
        <input type="number" min={0} max={359} step={15} value={t.putar ?? 0} onChange={e => ubah({ putar: sudutSah(e.target.value) || undefined })}
          className={`${kelasKecil} !w-20`} aria-label="Sudut putar teks (derajat)" />
        <span className="text-[12px] text-slate-500">°</span>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button type="button" className={kelasTombol} onClick={() => a.duplikatTeks(t.id)}><Copy size={15} /> Duplikat</button>
        <button type="button" className={`${kelasTombol} text-rose-700`} onClick={() => a.hapus({ jenis: 't', id: t.id })}><Trash2 size={15} /> Hapus</button>
      </div>
      <p className="text-[11px] text-slate-500">Seret teks di diagram untuk memindahkan. Klik dua kali di area kosong diagram untuk menambah teks di titik itu.</p>
    </div>
  );
}
