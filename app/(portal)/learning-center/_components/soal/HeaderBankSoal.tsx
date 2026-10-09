'use client';

/** HeaderBankSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import { Question, SearchInput } from '../shared';
import { DIFF_BG, DIFF_BORDER, DIFF_TEXT } from '../QuestionsPage';

export interface HeaderBankSoalProps {
  easyCount: number;
  filteredQuestions: Question[];
  goBack: () => void;
  hardCount: number;
  mediumCount: number;
  search: string;
  selectedFolder: string;
  selectedSubFolder: string | null;
  setSearch: import("react").Dispatch<import("react").SetStateAction<string>>;
  setShowAddManual: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowGenerate: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function HeaderBankSoal({ easyCount, filteredQuestions, goBack, hardCount, mediumCount, search, selectedFolder, selectedSubFolder, setSearch, setShowAddManual, setShowGenerate }: HeaderBankSoalProps) {
  return (
    <>
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 gap-4">
          <div className="min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1 flex-wrap">
              <span className="font-medium">Bank Soal</span>
              <svg aria-hidden="true" focusable="false" width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-slate-600 truncate max-w-[120px]">
                {selectedFolder === '__root__' ? 'Tanpa Folder' : selectedFolder}
              </span>
              {selectedSubFolder && selectedSubFolder !== '__direct__' && (
                <>
                  <svg aria-hidden="true" focusable="false" width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-slate-600 truncate max-w-[120px]">{selectedSubFolder}</span>
                </>
              )}
              {selectedSubFolder === '__direct__' && (
                <>
                  <svg aria-hidden="true" focusable="false" width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-slate-600">Langsung</span>
                </>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight"><IkonTeks nama="🧩" />Bank Soal</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari soal..." />
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-3 py-2 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
            >
              <svg aria-hidden="true" focusable="false" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali
            </button>
            <button
              data-tulis onClick={() => setShowAddManual(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-white text-sm font-semibold rounded-xl shadow transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
            >
              <svg aria-hidden="true" focusable="false" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Manual
            </button>
            <button
              data-tulis onClick={() => setShowGenerate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-white text-sm font-semibold rounded-xl shadow transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}
            >
              <svg aria-hidden="true" focusable="false" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
              </svg>
              Generate AI
            </button>
          </div>
        </div>
        {/* Stats bar */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
            Total: {filteredQuestions.length}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm"
            style={{ background: DIFF_BG.easy, color: DIFF_TEXT.easy, border: `1px solid ${DIFF_BORDER.easy}` }}>
            Mudah: {easyCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm"
            style={{ background: DIFF_BG.medium, color: DIFF_TEXT.medium, border: `1px solid ${DIFF_BORDER.medium}` }}>
            Sedang: {mediumCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm"
            style={{ background: DIFF_BG.hard, color: DIFF_TEXT.hard, border: `1px solid ${DIFF_BORDER.hard}` }}>
            Sulit: {hardCount}
          </span>
        </div>
      </div>
    </>
  );
}
