'use client';

/** KepalaTambahSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Question } from './shared';

export interface KepalaTambahSoalProps {
  questions: Question[];
  rootFolders: string[];
  setShowAddManual: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowGenerate: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function KepalaTambahSoal({ questions, rootFolders, setShowAddManual, setShowGenerate }: KepalaTambahSoalProps) {
  return (
    <>
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-slate-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
              <Ikon nama="🧩" ukuran="1em" className="inline-block align-[-0.12em]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">Bank Soal</h1>
              <p className="text-xs text-slate-500">Pilih folder untuk mulai</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-tulis onClick={() => setShowAddManual(true)}
              className="tombol-kedua flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-kontrol shadow transition-all hover:opacity-90"
            >
              <svg aria-hidden="true" focusable="false" width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Tambah Manual
            </button>
            <button
              data-tulis onClick={() => setShowGenerate(true)}
              className="tombol-utama flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-kontrol shadow transition-all hover:opacity-90"
            >
              <svg aria-hidden="true" focusable="false" width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
              </svg>
              <IkonTeks nama="✨" />Generate AI
            </button>
          </div>
        </div>
        {/* Stats bar */}
        <div className="flex items-center gap-3 px-6 py-2.5 bg-slate-50 border-t border-slate-100">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
            <svg aria-hidden="true" focusable="false" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {questions.length} total soal
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full shadow-sm">
            <svg aria-hidden="true" focusable="false" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            {rootFolders.length} folder
          </span>
        </div>
      </div>
    </>
  );
}
