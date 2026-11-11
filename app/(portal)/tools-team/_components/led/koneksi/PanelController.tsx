'use client';
import { useMemo } from 'react';
import { gambarPanelKoneksi } from './panel';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

export function PanelController({ a }: { a: AlatRuangKoneksi }) {
  const { d, t } = a;
  const { gambar, sisa } = useMemo(() => gambarPanelKoneksi(d, t), [d, t]);
  if (!gambar.length) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
      <div>
        <p className="text-[12px] font-bold text-slate-800">Sending box / video controller · port yang dipakai</p>
        <p className="text-[11px] text-slate-500">Port LAN berwarna = terpakai, label P1, P2, … sama dengan diagram{t.cadangan !== 'tidak' ? '; B = kabel cadangan' : ''}. Abu-abu = kosong.</p>
      </div>
      {gambar.map(g => (
        <div key={g.judul}>
          <div className="[&>svg]:block [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-w-[1100px]" role="img" aria-label={`Panel belakang ${g.judul}`} dangerouslySetInnerHTML={{ __html: g.svg }} />
        </div>
      ))}
      {sisa > 0 && <p className="text-[11px] text-slate-500">+{sisa} controller lagi dengan susunan port yang sama pola.</p>}
    </section>
  );
}
