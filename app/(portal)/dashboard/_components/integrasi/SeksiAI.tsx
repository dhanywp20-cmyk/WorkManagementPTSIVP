'use client';

/** SeksiAI - dipecah dari app/(portal)/dashboard/_components/modal-integrasi.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { type StatusRahasia } from '../modal-integrasi';
import { type PengaturanAI, type PengaturanPenilai } from '@/lib/ai-pengaturan';
import { BlokToken, PilihModel } from '../modal-integrasi';

export interface SeksiAIProps {
  ai: PengaturanAI;
  hapusRahasia: (kunci: string) => Promise<void>;
  penilai: PengaturanPenilai;
  rahasia: Record<string, StatusRahasia>;
  seksi: "kanal" | "wa" | "tg" | "push" | "tim" | "ai";
  setAi: import("react").Dispatch<import("react").SetStateAction<PengaturanAI>>;
  setPenilai: import("react").Dispatch<import("react").SetStateAction<PengaturanPenilai>>;
  simpanRahasia: (kunci: string, nilai: string) => Promise<void>;
}

export function SeksiAI({ ai, hapusRahasia, penilai, rahasia, seksi, setAi, setPenilai, simpanRahasia }: SeksiAIProps) {
  return (
    <>
      {seksi === 'ai' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700">Pembuat Soal AI</h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">Dipakai Learning Center untuk menyusun soal dari materi.</p>
            </div>
            <div className="p-3 space-y-3">
              <BlokToken
                judul="Token AI" kunci="ai.gemini_token" status={rahasia['ai.gemini_token']}
                onSimpan={n => simpanRahasia('ai.gemini_token', n)}
                onHapus={() => hapusRahasia('ai.gemini_token')}
                petunjuk={<>Ambil dari Google AI Studio (aistudio.google.com → Get API key). Token disimpan di server
                  dan tidak pernah dikirim ke peramban.</>} />
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Model</label>
                <PilihModel nilai={ai.model} warna="sky" onGanti={m => setAi(x => ({ ...x, model: m }))} />
              </div>
              <div>
                <label htmlFor="f-dashboard-components-modal-integrasi-3" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Arahan topik <span className="normal-case tracking-normal font-normal text-slate-400">— opsional</span>
                </label>
                <textarea id="f-dashboard-components-modal-integrasi-3" value={ai.arahan} rows={3} onChange={e => setAi(x => ({ ...x, arahan: e.target.value }))}
                  placeholder={'Contoh:\nUtamakan topik konfigurasi videowall dan troubleshooting sinyal HDMI/HDBaseT.\nHindari pertanyaan tentang sejarah merek atau harga.'}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed" />
                <p className="text-[11px] text-slate-500 mt-1">
                  Ditambahkan pada instruksi AI, bukan menggantinya — aturan bentuk soal tetap dipegang platform.
                </p>
              </div>
              <div>
                <label htmlFor="f-dashboard-components-modal-integrasi-4" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Variasi soal <span className="normal-case tracking-normal font-normal text-slate-500">({ai.suhu.toFixed(1)})</span>
                </label>
                <input id="f-dashboard-components-modal-integrasi-4" type="range" min={0} max={2} step={0.1} value={ai.suhu} aria-label="Variasi soal"
                  onChange={e => setAi(x => ({ ...x, suhu: Number(e.target.value) }))} className="w-full accent-sky-500" />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0 — taat pada materi</span><span>2 — banyak variasi</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200 overflow-hidden" style={{ background: 'rgba(14,165,233,0.04)' }}>
            <div className="px-4 py-3 border-b border-sky-100">
              <h3 className="text-sm font-bold text-sky-800">Asisten AI (Tanya Platform & draf Daily Report)</h3>
              <p className="text-[11.5px] text-slate-600 mt-0.5">
                Dipakai seluruh tim setiap hari. Batas per orang: 20 pertanyaan/jam, 80/hari.
              </p>
            </div>
            <div className="p-3">
              <BlokToken
                judul="Token AI Asisten" kunci="ai.gemini_token_asisten" status={rahasia['ai.gemini_token_asisten']}
                onSimpan={n => simpanRahasia('ai.gemini_token_asisten', n)}
                onHapus={() => hapusRahasia('ai.gemini_token_asisten')}
                petunjuk={<>Kosongkan untuk memakai Token AI pembuat soal. Disarankan kunci dari <b>proyek Google
                  terpisah</b> supaya jatah pembuat soal & penilai tidak ikut habis.</>} />
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 overflow-hidden" style={{ background: 'rgba(139,92,246,0.04)' }}>
            <div className="px-4 py-3 border-b border-violet-100">
              <h3 className="text-sm font-bold text-violet-700">Penilai Jawaban Essay</h3>
              <p className="text-[11.5px] text-violet-400 mt-0.5">
                Token terpisah supaya penilaian borongan tidak menghabiskan jatah pembuat soal.
              </p>
            </div>
            <div className="p-3 space-y-3">
              <BlokToken
                judul="Token AI Koreksi" kunci="ai.gemini_token_koreksi" status={rahasia['ai.gemini_token_koreksi']}
                onSimpan={n => simpanRahasia('ai.gemini_token_koreksi', n)}
                onHapus={() => hapusRahasia('ai.gemini_token_koreksi')}
                petunjuk={<>Kosongkan untuk memakai Token AI pembuat soal. Isi dengan kunci dari <b>proyek Google
                  terpisah</b> supaya jatahnya tidak berebut.</>} />
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Model penilai</label>
                <PilihModel nilai={penilai.model} profil="penilai" warna="violet"
                  onGanti={m => setPenilai(x => ({ ...x, model: m }))} />
              </div>
              <div>
                <label htmlFor="f-dashboard-components-modal-integrasi-5" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Arahan penilaian <span className="normal-case tracking-normal font-normal text-slate-400">— opsional</span>
                </label>
                <textarea id="f-dashboard-components-modal-integrasi-5" value={penilai.arahan} rows={3} onChange={e => setPenilai(x => ({ ...x, arahan: e.target.value }))}
                  placeholder={'Contoh:\nHargai jawaban yang benar secara konsep walau istilahnya tidak baku.\nJangan mengurangi nilai karena ejaan.'}
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-400 leading-relaxed" />
              </div>
              <div>
                <label htmlFor="f-dashboard-components-modal-integrasi-6" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Ketaatan pada kunci <span className="normal-case tracking-normal font-normal text-slate-500">({penilai.suhu.toFixed(1)})</span>
                </label>
                <input id="f-dashboard-components-modal-integrasi-6" type="range" min={0} max={2} step={0.1} value={penilai.suhu}
                  aria-label="Ketaatan penilaian pada kunci referensi"
                  onChange={e => setPenilai(x => ({ ...x, suhu: Number(e.target.value) }))} className="w-full accent-violet-500" />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0 — taat pada kunci</span><span>2 — longgar</span>
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={penilai.otomatis}
                  onChange={e => setPenilai(x => ({ ...x, otomatis: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded accent-violet-600 flex-shrink-0" />
                <span className="text-[11.5px] leading-snug text-slate-600">
                  <b>Nilai otomatis saat halaman penilaian dibuka</b>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Mati secara bawaan. Bila dinyalakan, sekadar <em>membuka</em> jawaban seorang peserta sudah
                    memakai jatah — termasuk saat penilai hanya ingin membacanya.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
