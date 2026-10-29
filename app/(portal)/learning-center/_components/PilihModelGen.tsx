'use client';

/** PilihModelGen - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { type ModelAI } from './shared';
import { type SisiBanding } from './QuestionsPage';

export interface PilihModelGenProps {
  daftarModelGen: ModelAI[];
  modeBanding: boolean;
  modelBandingA: string;
  modelBandingB: string;
  setHasilBanding: import("react").Dispatch<import("react").SetStateAction<{ a: SisiBanding; b: SisiBanding; } | null>>;
  setModeBanding: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setModelBandingA: import("react").Dispatch<import("react").SetStateAction<string>>;
  setModelBandingB: import("react").Dispatch<import("react").SetStateAction<string>>;
}

export function PilihModelGen({ daftarModelGen, modeBanding, modelBandingA, modelBandingB, setHasilBanding, setModeBanding, setModelBandingA, setModelBandingB }: PilihModelGenProps) {
  return (
    <>
      {daftarModelGen.length > 1 && (
        <div className="mb-4 rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex">
            {([
              { v: false, judul: '1 Model', ket: 'langsung disimpan' },
              { v: true,  judul: 'Bandingkan 2 Model', ket: 'pilih hasilnya dulu' },
            ] as const).map(o => (
              <button key={String(o.v)} type="button"
                onClick={() => { setModeBanding(o.v); setHasilBanding(null); }}
                aria-pressed={modeBanding === o.v}
                className={`flex-1 px-3 py-2 text-left transition-all ${
                  modeBanding === o.v ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-violet-50'}`}>
                <div className="text-xs font-bold">{o.judul}</div>
                <div className={`text-[11px] ${modeBanding === o.v ? 'text-violet-100' : 'text-slate-500'}`}>{o.ket}</div>
              </button>
            ))}
          </div>

          {modeBanding && (
            <div className="p-3 bg-violet-50/50 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { lbl: 'Model A', val: modelBandingA, set: setModelBandingA },
                  { lbl: 'Model B', val: modelBandingB, set: setModelBandingB },
                ] as const).map(m => (
                  <div key={m.lbl}>
                    <label className="block text-[11px] font-bold text-violet-600 uppercase tracking-wide mb-1">{m.lbl}</label>
                    <select aria-label="Model AI" value={m.val} onChange={e => m.set(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded-lg border border-violet-200 bg-white outline-hidden focus:border-violet-400">
                      {daftarModelGen.map(x => <option key={x.id} value={x.id}>{x.id}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-violet-700 mt-2 leading-relaxed">
                Materi, jumlah soal, tingkat kesulitan, dan arahan yang sama dikirim ke keduanya —
                jadi yang berbeda benar-benar hanya modelnya. <b>Tidak ada yang disimpan</b> sampai
                Anda memilih salah satu hasilnya.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
