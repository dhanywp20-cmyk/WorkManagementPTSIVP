'use client';

/** BilahNavigasiSoal - dipecah dari app/(portal)/learning-center/_components/MyQuizPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import { type QuizQuestion } from '../MyQuizPage';

export interface BilahNavigasiSoalProps {
  answered: number;
  current: number;
  handleSubmit: (autoSubmit?: boolean) => Promise<void>;
  questions: QuizQuestion[];
  setCurrent: import("react").Dispatch<import("react").SetStateAction<number>>;
  tabSwitches: number;
}

export function BilahNavigasiSoal({ answered, current, handleSubmit, questions, setCurrent, tabSwitches }: BilahNavigasiSoalProps) {
  return (
    <>
      <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 bg-white border-t border-slate-200"
        style={{ boxShadow: '0 -8px 24px -16px rgba(15,23,42,.16)' }}>
        <div className="max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto flex flex-col gap-2.5">

          {answered < questions.length && (
            <p className="text-[12px] text-slate-500">
              <b className="text-slate-800">{questions.length - answered} soal belum dijawab.</b>{' '}
              <span className="lg:hidden">Ketuk ruas abu di rel atas untuk lompat ke sana.</span>
              <span className="hidden lg:inline">Pakai panah di samping soal, atau ruas abu di rel atas, untuk lompat ke sana.</span>
            </p>
          )}

          {/*
            Tombol besar muncul di soal MANA PUN begitu seluruh soal
            terjawab, bukan cuma di soal terakhir: orang tidak selalu selesai
            di nomor terakhir - ia melompat ke nomor yang tadi dilewati,
            mengisinya, lalu berhenti di sana.

            Tombol Sebelumnya/Berikutnya polos disembunyikan di layar lg -
            di laptop navigasinya sudah dipegang panah di samping kartu
            soal (lihat di atas), jadi tidak perlu dobel di sini.
          */}
          {answered === questions.length ? (
            <div className="flex gap-2.5">
              <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}
                className="lg:hidden px-4 sm:px-5 py-4 text-sm font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200">
                ←<span className="hidden formulir:inline"> Sebelumnya</span>
              </button>
              <button onClick={() => handleSubmit(false)}
                className="flex-1 px-6 py-4 text-[15px] sm:text-base font-black rounded-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white">
                ✓ Kumpulkan Jawaban
              </button>
            </div>
          ) : (
            <div className="flex gap-2.5">
              <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}
                className="lg:hidden px-4 sm:px-5 py-3.5 text-sm font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200">
                ←<span className="hidden formulir:inline"> Sebelumnya</span>
              </button>
              {current === questions.length - 1 ? (
                //  Soal terakhir tapi masih ada yang kosong: Berikutnya tidak
                //  ada gunanya lagi, jadi tempatnya dipakai Submit - dengan
                //  angkanya, supaya jelas ini mengumpulkan pekerjaan separuh.
                //  Tombol ini TETAP tampil di lg (bukan navigasi polos).
                <button onClick={() => handleSubmit(false)}
                  className="flex-1 px-5 py-3.5 text-sm font-bold rounded-xl transition-all bg-slate-800 hover:bg-slate-900 text-white">
                  Submit ({answered}/{questions.length})
                </button>
              ) : (
                <button onClick={() => setCurrent(p => Math.min(questions.length - 1, p + 1))}
                  className="lg:hidden flex-1 px-5 py-3.5 text-sm font-bold rounded-xl transition-all"
                  style={{ background: '#5B5BF5', color: '#FFFFFF' }}>
                  Berikutnya →
                </button>
              )}
            </div>
          )}

          {tabSwitches > 0 && (
            <p className="text-[11px] font-semibold text-rose-600">
              <IkonTeks nama="⚠" />Berpindah tab tercatat: {tabSwitches}x
            </p>
          )}
        </div>
      </div>
    </>
  );
}
