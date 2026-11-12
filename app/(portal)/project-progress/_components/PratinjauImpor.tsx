'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { DraftBagian } from '@/lib/checklist/inti';
import { NETRAL } from '@/lib/desain';
import { BATAS, type DraftChecklist } from '@/lib/checklist/inti';
import { TEMA, fontAngka } from './tampilan';

export interface PratinjauImporProps {
  draft: DraftChecklist | null;
  setDraft: Dispatch<SetStateAction<DraftChecklist | null>>;
  terpilih: DraftBagian[];
  jumlahItem: number;
  ikut: boolean[];
  setIkut: Dispatch<SetStateAction<boolean[]>>;
}

export function PratinjauImpor({
  draft, setDraft, terpilih, jumlahItem, ikut, setIkut,
}: PratinjauImporProps) {
  return (
    <>{draft && (
      <div className="space-y-4">
        <div className="grid gap-3">
          {draft.keterangan && (
            <label className="block">
              <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Keterangan (dari teks sebelum bagian pertama)</span>
              <textarea value={draft.keterangan} rows={2} maxLength={BATAS.keterangan}
                onChange={e => setDraft({ ...draft, keterangan: e.target.value })}
                className="mt-1 w-full rounded-xl px-3 py-2 text-[12.5px] outline-hidden focus:ring-2"
                style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
            </label>
          )}
        </div>
    
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-bold" style={{ color: NETRAL.tinta }}>
            <span style={fontAngka}>{terpilih.length}</span> bagian · <span style={fontAngka}>{jumlahItem}</span> item akan diimpor
          </p>
          <span className="text-[11px]" style={{ color: TEMA.samar }}>Hapus centang untuk melewatkan bagian</span>
        </div>
    
        <div className="rounded-xl divide-y max-h-[46vh] overflow-y-auto" style={{ border: `1px solid ${NETRAL.garis}`, borderColor: NETRAL.garis }}>
          {draft.bagian.map((b, i) => {
            const kelompok = Array.from(new Set(b.items.map(it => it.kelompok).filter(Boolean)));
            const sudah = b.items.filter(it => it.selesai).length;
            return (
              <label key={i} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
                style={{ opacity: ikut[i] ? 1 : 0.5, background: NETRAL.permukaan }}>
                <input type="checkbox" checked={!!ikut[i]} className="mt-1 w-4 h-4 accent-blue-600"
                  onChange={e => setIkut(prev => prev.map((v, k) => (k === i ? e.target.checked : v)))} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-bold" style={{ color: NETRAL.tinta }}>{b.judul}</span>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-sm" style={{ ...fontAngka, background: TEMA.tint, color: TEMA.warnaTua }}>
                      {b.items.length} item
                    </span>
                    {sudah > 0 && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: TEMA.selesaiTint, color: TEMA.selesai }}>
                        {sudah} sudah selesai
                      </span>
                    )}
                    {b.catatan && (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-sm" style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2 }}>
                        + catatan
                      </span>
                    )}
                  </span>
                  {kelompok.length > 0 && (
                    <span className="block text-[11.5px] mt-0.5" style={{ color: TEMA.warnaTua }}>{kelompok.join(' · ')}</span>
                  )}
                  {b.items.length > 0 && (
                    <span className="block text-[12px] mt-0.5 truncate" style={{ color: TEMA.samar }}>
                      {b.items.slice(0, 3).map(it => it.teks).join(' · ')}{b.items.length > 3 ? ' …' : ''}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    )}</>
  );
}
