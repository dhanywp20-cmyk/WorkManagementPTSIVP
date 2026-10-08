'use client';

/** HasilBandingSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import type { SisiBanding } from '../QuestionsPage';

export interface HasilBandingSoalProps {
  generating: boolean;
  hasilBanding: { a: SisiBanding; b: SisiBanding; } | null;
  setHasilBanding: import("react").Dispatch<import("react").SetStateAction<{ a: SisiBanding; b: SisiBanding; } | null>>;
  simpanHasil: (rows: Record<string, unknown>[]) => Promise<void>;
}

export function HasilBandingSoal({ generating, hasilBanding, setHasilBanding, simpanHasil }: HasilBandingSoalProps) {
  return (
    <>
      {hasilBanding && (
        <div className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {([hasilBanding.a, hasilBanding.b] as const).map((sisi, i) => (
              <div key={i} className="rounded-xl border border-slate-200 overflow-hidden flex flex-col bg-white">
                <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2 flex-wrap"
                  style={{ background: i === 0 ? '#eef2ff' : '#f0fdf4' }}>
                  <span className="text-[11px] font-black uppercase tracking-wider"
                    style={{ color: i === 0 ? '#4338ca' : '#15803d' }}>{i === 0 ? 'Model A' : 'Model B'}</span>
                  <span className="text-[11px] font-bold text-slate-700 truncate">{sisi.model}</span>
                  <span className="ml-auto text-[11px] font-semibold text-slate-500">
                    {sisi.galat ? '—' : `${sisi.rows.length} soal`}
                  </span>
                </div>

                <div className="p-2 space-y-1.5 max-h-[340px] overflow-y-auto flex-1">
                  {sisi.galat ? (
                    <p className="text-xs text-rose-600 p-2 leading-relaxed">{sisi.galat}</p>
                  ) : sisi.rows.map((r, j) => (
                    <div key={j} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                      <p className="text-[11.5px] font-semibold text-slate-800 leading-snug">
                        {j + 1}. {String(r.question ?? '')}
                      </p>
                      {r.question_type === 'essay' ? (
                        r.model_answer ? <p className="text-[11px] text-indigo-700 mt-1 leading-snug">Kunci: {String(r.model_answer)}</p> : null
                      ) : (
                        <div className="grid grid-cols-2 gap-1 mt-1.5">
                          {(['a', 'b', 'c', 'd'] as const).map(o => {
                            const benar = r.correct_answer === o.toUpperCase();
                            return (
                              <div key={o} className={`text-[11px] px-1.5 py-1 rounded border leading-snug ${
                                benar ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold'
                                      : 'border-slate-200 bg-white text-slate-500'}`}>
                                <b>{o.toUpperCase()}.</b> {String((r as Record<string, unknown>)[`option_${o}`] ?? '')}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-2 border-t border-slate-100">
                  <button type="button" disabled={generating || !!sisi.galat || sisi.rows.length === 0}
                    onClick={() => simpanHasil(sisi.rows)}
                    className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40"
                    style={{ background: i === 0 ? '#4f46e5' : '#16a34a' }}>
                    <IkonTeks nama="💾" />Simpan hasil {i === 0 ? 'Model A' : 'Model B'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setHasilBanding(null)}
            className="mt-2 text-[11px] text-slate-500 underline">
            Buang keduanya, coba lagi
          </button>
        </div>
      )}
    </>
  );
}
