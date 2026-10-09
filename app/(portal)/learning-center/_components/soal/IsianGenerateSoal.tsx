'use client';

/** IsianGenerateSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Material, MAX_PDF_BYTES, DialogState } from '../shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface IsianGenerateSoalProps {
  batchName: string;
  genCount: number;
  genDiff: "easy" | "medium" | "hard" | "mixed";
  genExtraPrompt: string;
  materials: Material[];
  pdfFile: File | null;
  pdfRef: import("react").RefObject<HTMLInputElement | null>;
  selectedMat: string;
  setBatchName: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDialog: import("react").Dispatch<import("react").SetStateAction<DialogState>>;
  setGenCount: import("react").Dispatch<import("react").SetStateAction<number>>;
  setGenDiff: import("react").Dispatch<import("react").SetStateAction<"easy" | "medium" | "hard" | "mixed">>;
  setGenExtraPrompt: import("react").Dispatch<import("react").SetStateAction<string>>;
  setPdfFile: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setSelectedMat: import("react").Dispatch<import("react").SetStateAction<string>>;
  viewMaterials: Material[];
}

export function IsianGenerateSoal({ batchName, genCount, genDiff, genExtraPrompt, materials, pdfFile, pdfRef, selectedMat, setBatchName, setDialog, setGenCount, setGenDiff, setGenExtraPrompt, setPdfFile, setSelectedMat, viewMaterials }: IsianGenerateSoalProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="col-span-2">
          <label htmlFor="f-learning-center-components-questionspage-1" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            Nama Grup / Batch
            <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">Optional</span>
          </label>
          <input id="f-learning-center-components-questionspage-1" value={batchName} onChange={e => setBatchName(e.target.value)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white"
            placeholder="contoh: Instalasi Dasar, Troubleshooting Level 1, Quiz Minggu ke-3..." />
        </div>
        <div className="col-span-2">
          <label htmlFor="f-learning-center-components-questionspage-2" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            Topik Khusus
            <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">Optional</span>
          </label>
          <textarea id="f-learning-center-components-questionspage-2" value={genExtraPrompt} onChange={e => setGenExtraPrompt(e.target.value)} rows={2}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white resize-none"
            placeholder="contoh: Fokus pada cara pemasangan LED indoor P2.5, atau khusus troubleshooting sinyal HDMI..." />
        </div>
        <div>
          <label htmlFor="f-learning-center-components-questionspage-3" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
          <select id="f-learning-center-components-questionspage-3" value={selectedMat} onChange={e => setSelectedMat(e.target.value)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
            <option value="">-- Pilih Materi --</option>
            {(viewMaterials.length > 0 ? viewMaterials : materials).map(m =>
              <option key={m.id} value={m.id}>{m.materi_name}{m.content_text ? ' ✅' : ''}</option>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="f-learning-center-components-questionspage-4" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jumlah Soal</label>
          <input id="f-learning-center-components-questionspage-4" type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(+e.target.value)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white" />
        </div>
        <div>
          <label htmlFor="f-learning-center-components-questionspage-5" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Tingkat Kesulitan</label>
          <select id="f-learning-center-components-questionspage-5" value={genDiff} onChange={e => setGenDiff(e.target.value as any)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
            <option value="mixed">Mixed (Campuran)</option>
            <option value="easy">Easy — Mudah</option>
            <option value="medium">Medium — Sedang</option>
            <option value="hard">Hard — Sulit</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-learning-center-components-questionspage-6" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            Upload PDF <span className="text-[11px] font-normal text-violet-500 normal-case tracking-normal">(sementara, tidak disimpan)</span>
          </label>
          <input id="f-learning-center-components-questionspage-6" ref={pdfRef} type="file" accept=".pdf" onChange={e => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > MAX_PDF_BYTES) {
              setDialog({
                type: 'error',
                title: 'PDF Terlalu Besar',
                message: `File "${f.name}" berukuran ${(f.size / 1_000_000).toFixed(1)} MB, maksimal ${(MAX_PDF_BYTES / 1_000_000).toFixed(1)} MB. Kompres dulu atau pakai PDF yang lebih kecil.`,
              });
              e.target.value = '';
              setPdfFile(null);
              return;
            }
            setPdfFile(f);
          }} className="hidden" />
          <div className="flex items-center gap-2">
            <button onClick={() => pdfRef.current?.click()}
              className="px-3 py-2 bg-white border border-violet-200 hover:bg-violet-50 text-violet-700 text-xs font-semibold rounded-xl transition-all">
              <IkonTeks nama="📄" />Pilih PDF
            </button>
            {pdfFile
              ? <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /> {pdfFile.name}</span>
              : <span className="text-xs text-slate-500">atau dari teks materi</span>}
            {pdfFile && <button aria-label="Tutup" onClick={() => { setPdfFile(null); if (pdfRef.current) pdfRef.current.value = ''; }} className="text-xs text-rose-500">✕</button>}
          </div>
        </div>
      </div>
    </>
  );
}
