'use client';
import { useState } from 'react';

/**
 * Shared MiniPieChart - basis pattern dari ticketing StatusDonutCard.
 * Dipakai di semua platform KECUALI piket-showroom (yang punya style sendiri).
 *
 * Props compatibility:
 * - data: array {label/name, value, color}. Mendukung kedua key (label/name) untuk backward-compat.
 * - title + icon di header
 * - activeFilter (optional) untuk highlight slice yang sedang difilter
 * - onSliceClick (optional) untuk klik filter
 */
export function MiniPieChart({
  data, title, icon, activeFilter, onSliceClick,
  centerValue, centerLabel, valueSuffix,
}: {
  data: { label?: string; name?: string; value: number; color: string }[];
  title: string; icon: string;
  activeFilter?: string | null;
  onSliceClick?: (label: string) => void;
  /**
   * Angka besar di tengah donat. Default = jumlah seluruh nilai ("TOTAL").
   * Diisi manual bila menjumlahkan slice TIDAK bermakna - mis. saat nilainya
   * berupa persentase, di mana totalnya tidak berarti apa-apa.
   */
  centerValue?: string | number;
  centerLabel?: string;
  /** Akhiran nilai di legenda, mis. '%'. */
  valueSuffix?: string;
}) {
  const [hov, setHov] = useState<number | null>(null);
  // Normalize: terima data dengan label atau name
  const normalized = data.map(d => ({ ...d, label: d.label ?? d.name ?? '' }));
  const total = normalized.reduce((s, d) => s + d.value, 0);

  if (total === 0) return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{icon} {title}</p>
      <p className="text-gray-400 text-sm text-center py-4">Belum ada data</p>
    </div>
  );

  let cumAngle = -Math.PI / 2;
  const cx = 60, cy = 60, r = 50, ir = 28;

  const slices = normalized.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    if (normalized.length === 1) return { ...d, path: '', isFullCircle: true, i };
    const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle);
    const x2 = cx + r * Math.cos(cumAngle + angle), y2 = cy + r * Math.sin(cumAngle + angle);
    const xi1 = cx + ir * Math.cos(cumAngle), yi1 = cy + ir * Math.sin(cumAngle);
    const xi2 = cx + ir * Math.cos(cumAngle + angle), yi2 = cy + ir * Math.sin(cumAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z`;
    cumAngle += angle;
    return { ...d, path, isFullCircle: false, i };
  });

  return (
    <div className="rounded-2xl p-2.5 sm:p-4 flex flex-col gap-2 sm:gap-3"
      style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}>
      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">{icon} {title}</p>
      {/* justify-center + lebar maksimum pada legenda: sebelumnya legenda memakai
          flex-1 tanpa batas, sehingga ia melahap SELURUH sisa lebar kartu dan
          mendorong donat menempel ke tepi kiri. Pada kartu lebar dengan legenda
          pendek, donat jadi terlihat tidak center. Dengan legenda dibatasi,
          pasangan donat+legenda mengambang di tengah kartu.

          flex-wrap DITAMBAHKAN, dan itu bukan sekadar kerapian. Bersama
          `min-w-0` pada legenda, susunan satu baris membuat legenda bisa
          menyusut sampai NOL ketika kartunya sempit - donatnya tetap 120px
          karena ukurannya tetap, jadi yang mengalah selalu teksnya. Terukur:
          pada kartu selebar 78px dan 108px legendanya benar-benar 0px, dan
          pada 180px pun hanya 14px. Yang tampak di layar cuma lingkaran warna
          tanpa keterangan - grafik yang tidak bisa dibaca.

          Dengan flex-wrap + lebar minimum, legenda TURUN ke bawah donat begitu
          tidak muat di sampingnya, bukan menghilang. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Ukuran donat MENGECIL di layar sempit. Atribut width/height tetap
            120 sebagai cadangan bila CSS tidak termuat; kelas Tailwind di
            bawahnya yang menentukan ukuran sebenarnya - CSS menang atas
            atribut. Tanpa ini, donat 120px + legenda 150px tidak muat pada
            kartu selebar ~132px (dua kolom di ponsel 360px), dan yang
            menjorok keluar akan membuat halamannya bisa digeser ke samping. */}
        <svg aria-hidden="true" focusable="false" width="120" height="120" viewBox="0 0 120 120"
          className="flex-shrink-0 w-[92px] h-[92px] sm:w-[120px] sm:h-[120px]">
          {slices.map((s) => (
            s.isFullCircle ? (
              <g key={s.i} style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
                onClick={() => onSliceClick && onSliceClick(s.label)}
                onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)}>
                <circle cx={60} cy={60} r={50} fill={s.color}
                  opacity={hov === null || hov === s.i ? 1 : 0.45}
                  style={{ filter: hov === s.i || activeFilter === s.label ? `drop-shadow(0 0 4px ${s.color})` : 'none' }} />
                <circle cx={60} cy={60} r={28} fill="white" />
              </g>
            ) : (
              <path key={s.i} d={s.path} fill={s.color}
                opacity={hov === null || hov === s.i ? 1 : 0.45}
                style={{ cursor: onSliceClick ? 'pointer' : 'default', transition: 'opacity 0.15s', filter: hov === s.i || activeFilter === s.label ? `drop-shadow(0 0 4px ${s.color})` : 'none' }}
                onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)}
                onClick={() => onSliceClick && onSliceClick(s.label)} />
            )
          ))}
          <text x="60" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1e293b">{centerValue ?? total}</text>
          <text x="60" y="70" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">{centerLabel ?? 'TOTAL'}</text>
        </svg>
        <div className="flex flex-col gap-1.5 flex-1 basis-[110px] min-w-[110px] sm:basis-[150px] sm:min-w-[150px] max-w-[210px] max-h-[120px] overflow-y-auto">
          {slices.map((s) => {
            const isActive = activeFilter === s.label;
            return (
              <div key={s.i}
                className="flex items-center gap-1.5 cursor-pointer rounded-lg px-1.5 py-0.5 transition-all"
                style={{
                  background: hov === s.i || isActive ? `${s.color}20` : 'transparent',
                  outline: isActive ? `1px solid ${s.color}` : 'none',
                }}
                onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)}
                onClick={() => onSliceClick && onSliceClick(s.label)}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-[10px] font-semibold text-gray-600 truncate flex-1">{s.label}</span>
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: s.color }}>{s.value}{valueSuffix ?? ''}</span>
                {isActive && <span className="text-[9px] font-bold text-purple-600 flex-shrink-0">✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
