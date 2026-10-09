'use client';
import { Ikon } from './Ikon';
import { NETRAL } from '@/lib/desain';

/**
 * Kartu "angka utama + peringkat berbatang" - pengganti donut untuk data
 * besaran per entitas (progres %, jumlah isu per project).
 *
 * Donut dipakai untuk komposisi (bagian dari keseluruhan). Progres tiap
 * project bukan bagian dari apa pun, dan donut dengan satu irisan tidak
 * menyampaikan apa-apa. Di sini:
 *  - angka utama besar di atas (rata-rata / total),
 *  - opsional: satu batang komposisi (mis. Selesai/Berjalan/Belum mulai)
 *    dengan celah 2px antarsegmen + legenda berlabel,
 *  - daftar peringkat: batang tipis SATU warna (besaran, bukan identitas),
 *    angka rata kanan dengan warna tinta, bukan warna batang,
 *  - baris bernilai nol dilipat jadi satu kalimat, bukan deretan 0%.
 */

export type Segmen = { label: string; value: number; color: string };
export type BarisPeringkat = { label: string; value: number; teks?: string };

export function KartuPeringkat({
  title, icon, angka, ketAngka, segmen, baris, maks, warnaBatang,
  lipatan, kosong, onPilih, batas = 6,
}: {
  title: string;
  icon: string;
  angka: string | number;
  ketAngka: string;
  segmen?: Segmen[];
  baris: BarisPeringkat[];
  /** Nilai penuh skala batang (100 untuk persen; bawaan = nilai terbesar). */
  maks?: number;
  warnaBatang: string;
  /** Kalimat untuk baris yang dilipat, mis. "6 project belum mulai". */
  lipatan?: { teks: string; rincian?: string };
  /** Pesan bila tidak ada baris sama sekali. */
  kosong?: string;
  onPilih?: (label: string) => void;
  batas?: number;
}) {
  const skala = maks ?? Math.max(1, ...baris.map(b => b.value));
  const tampil = baris.slice(0, batas);
  const lebih = baris.length - tampil.length;
  const totalSeg = (segmen ?? []).reduce((s, x) => s + x.value, 0);
  const bisaKlik = typeof onPilih === 'function';

  return (
    <div className="rounded-xl p-2.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 min-w-0"
      style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <p className="flex items-center gap-1.5 text-[11px] sm:text-[12.5px] font-semibold text-slate-700 leading-tight">
        <Ikon nama={icon} ukuran={14} className="text-slate-500" />
        <span className="truncate">{title}</span>
      </p>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none tabular-nums">{angka}</span>
        <span className="text-[11px] font-medium text-slate-500">{ketAngka}</span>
      </div>

      {segmen && totalSeg > 0 && (
        <div>
          <div className="flex h-2 rounded-full overflow-hidden gap-[2px]" role="img"
            aria-label={segmen.map(s => `${s.label} ${s.value}`).join(', ')}>
            {segmen.filter(s => s.value > 0).map(s => (
              <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(s.value / totalSeg) * 100}%`, background: s.color }}
                title={`${s.label}: ${s.value}`} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {segmen.map(s => (
              <li key={s.label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} aria-hidden="true" />
                {s.label} <span className="font-semibold text-slate-800 tabular-nums">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tampil.length === 0 ? (
        <p className="text-[11px] sm:text-xs text-slate-500 py-2">{kosong ?? 'Belum ada data'}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tampil.map(b => (
            <li key={b.label}>
              <button type="button" disabled={!bisaKlik} onClick={() => onPilih?.(b.label)}
                title={`${b.label}: ${b.teks ?? b.value}`}
                className={`w-full text-left group ${bisaKlik ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className="flex items-center justify-between gap-2 text-[11px] sm:text-[11.5px]">
                  <span className={`truncate text-slate-600 font-medium ${bisaKlik ? 'group-hover:text-slate-900' : ''}`}>{b.label}</span>
                  <span className="font-semibold text-slate-800 tabular-nums flex-shrink-0">{b.teks ?? b.value}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: NETRAL.garis }}>
                  <div className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.max(2, Math.min(100, (b.value / skala) * 100))}%`, background: warnaBatang }} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(lebih > 0 || lipatan) && (
        <p className="text-[11px] text-slate-500" title={lipatan?.rincian}>
          {lebih > 0 && <>+{lebih} lainnya{lipatan ? ' · ' : ''}</>}
          {lipatan?.teks}
        </p>
      )}
    </div>
  );
}
