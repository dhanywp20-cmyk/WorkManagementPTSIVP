'use client';

/** GrupBatchSoal - dipecah dari app/(portal)/learning-center/_components/QuestionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { bandingkanUrutan } from '@/lib/urutan-soal';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Material, Question, BtnEdit, BtnDelete } from '../shared';
import { DIFF_BG, DIFF_BORDER, DIFF_LABEL, DIFF_NUM_BG, DIFF_TEXT } from '../QuestionsPage';

export interface GrupBatchSoalProps {
  batchKeys: string[];
  buangDraf: (kunci: string) => void;
  bukaTambahDiGrup: (materialId: string, batchKey: string) => void;
  expandedBatches: Set<string>;
  geserSoal: (kunci: string, grup: Question[], idx: number, arah: -1 | 1) => void;
  handleDelete: (id: string) => void;
  handleDeleteBatch: (batchKey: string) => void;
  kolomUrutanAda: boolean;
  mat: Material;
  matColor: { gradient: string; light: string; icon: string; };
  menyimpanUrutan: string | null;
  qs: Question[];
  setEditQ: import("react").Dispatch<import("react").SetStateAction<Question | null>>;
  setExpandedBatches: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  simpanUrutan: (kunci: string, susunan: Question[]) => Promise<void>;
  susunanTampil: (kunci: string, grup: Question[]) => Question[];
  urutanDraf: Record<string, string[]>;
}

export function GrupBatchSoal({ batchKeys, buangDraf, bukaTambahDiGrup, expandedBatches, geserSoal, handleDelete, handleDeleteBatch, kolomUrutanAda, mat, matColor, menyimpanUrutan, qs, setEditQ, setExpandedBatches, simpanUrutan, susunanTampil, urutanDraf }: GrupBatchSoalProps) {
  return (
    <>
      <div className="space-y-2 pl-3 border-l-2" style={{ borderColor: matColor.icon + '40' }}>
        {batchKeys.map((batchKey, batchIdx) => {
          const batchTersimpan = qs.filter(q => (q.batch_name ?? '') === batchKey).sort(bandingkanUrutan);
          const BATCH_COLORS = [
            { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', dot: '#8b5cf6', hdr: '#ede9fe' },
            { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#10b981', hdr: '#d1fae5' },
            { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#3b82f6', hdr: '#dbeafe' },
            { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', dot: '#f97316', hdr: '#ffedd5' },
            { bg: '#fdf2f8', border: '#f9a8d4', text: '#9d174d', dot: '#ec4899', hdr: '#fce7f3' },
            { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', dot: '#22c55e', hdr: '#dcfce7' },
          ];
          const bc = BATCH_COLORS[batchIdx % BATCH_COLORS.length];
          const expandKey = `${mat.id}__${batchKey || '__none__'}`;
          const isExpanded = expandedBatches.has(expandKey);
          // Yang dirender adalah rancangan bila grup ini sedang disusun.
          const batchQs = susunanTampil(expandKey, batchTersimpan);
          const adaDraf = !!urutanDraf[expandKey];
          const sedangMenyimpan = menyimpanUrutan === expandKey;
          const easyN  = batchQs.filter(q => q.difficulty === 'easy').length;
          const medN   = batchQs.filter(q => q.difficulty === 'medium').length;
          const hardN  = batchQs.filter(q => q.difficulty === 'hard').length;

          return (
            <div key={batchKey || '__none__'} className="rounded-2xl border overflow-hidden transition-all"
              style={{ borderColor: bc.border }}>

              {/* ── Accordion header (always visible, click to toggle) ── */}
              <button
                type="button"
                onClick={() => setExpandedBatches(prev => {
                  const next = new Set(prev);
                  next.has(expandKey) ? next.delete(expandKey) : next.add(expandKey);
                  return next;
                })}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
                style={{ background: isExpanded ? bc.hdr : '#f8fafc' }}
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: bc.dot }} />
                  {batchKey
                    ? <span className="text-xs font-bold" style={{ color: bc.text }}><Ikon nama="📌" ukuran="1em" className="inline-block align-[-0.12em]" /> {batchKey}</span>
                    : <span className="text-xs font-semibold text-slate-500 italic">Tanpa Grup</span>
                  }
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border" style={{ color: bc.text, borderColor: bc.border }}>
                    {batchQs.length} soal
                  </span>
                  {/* Rancangan tetap hidup walau grupnya ditutup. Tanda ini
                      yang mencegahnya terlupakan di balik grup yang terlipat. */}
                  {adaDraf && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      ● Urutan belum disimpan
                    </span>
                  )}
                  {/* Difficulty mini-chips */}
                  <div className="flex gap-1">
                    {easyN > 0  && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIFF_BG.easy,   color: DIFF_TEXT.easy,   border: `1px solid ${DIFF_BORDER.easy}` }}>  Mudah {easyN}</span>}
                    {medN  > 0  && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIFF_BG.medium, color: DIFF_TEXT.medium, border: `1px solid ${DIFF_BORDER.medium}` }}>Sedang {medN}</span>}
                    {hardN > 0  && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIFF_BG.hard,   color: DIFF_TEXT.hard,   border: `1px solid ${DIFF_BORDER.hard}` }}>  Sulit {hardN}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    data-tulis onClick={e => { e.stopPropagation(); handleDeleteBatch(batchKey); }}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-500 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-all"
                  >
                    <svg aria-hidden="true" focusable="false" width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus
                  </button>
                  {/* Chevron */}
                  <svg aria-hidden="true" focusable="false"
                    width="16" height="16" fill="none" stroke={bc.text} viewBox="0 0 24 24"
                    className="transition-transform duration-200 flex-shrink-0"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* ── Question cards — only rendered when expanded ── */}
              {isExpanded && (
                <div className="p-3 space-y-2" style={{ background: '#fafafa' }}>
                  {/*
                    Bilah ini hanya muncul saat ada yang digeser, dan
                    menempel di atas daftar (sticky) - untuk grup
                    berisi 45 soal, tombol simpan yang ikut tergulir
                    ke luar layar berarti orang menyusun urutan lalu
                    kehilangan cara menyimpannya.
                  */}
                  {adaDraf && (
                    <div className="sticky top-0 z-20 -mx-3 -mt-3 mb-1 px-3 py-2.5 flex items-center gap-2 flex-wrap border-b"
                      style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                      <span className="text-[11px] font-bold text-amber-900 flex-1 min-w-[140px] leading-snug">
                        Urutan diubah — belum disimpan.
                      </span>
                      <button type="button" disabled={sedangMenyimpan}
                        onClick={() => buangDraf(expandKey)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50">
                        Batalkan
                      </button>
                      <button type="button" disabled={sedangMenyimpan}
                        onClick={() => simpanUrutan(expandKey, batchQs)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow transition-all disabled:opacity-60 flex items-center gap-1.5">
                        {sedangMenyimpan
                          ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan...</>
                          : <>💾 Simpan Urutan</>}
                      </button>
                    </div>
                  )}
                  {batchQs.map((q, idx) => (
                    <div key={q.id} className="flex rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
                      <div style={{
                        width: 48, background: DIFF_BG[q.difficulty] ?? '#f8fafc',
                        borderRight: `1px solid ${DIFF_BORDER[q.difficulty] ?? '#e2e8f0'}`,
                        flexShrink: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', paddingTop: 18, gap: 4,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: DIFF_NUM_BG[q.difficulty] ?? 'linear-gradient(135deg,#64748b,#475569)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 12, fontWeight: 900,
                        }}>{idx + 1}</div>
                        {/*
                          Panah, bukan seret-lepas. Seret-lepas lebih
                          luwes di tetikus, tapi di layar sentuh ia
                          berebut dengan gulir halaman - menahan lalu
                          menggeser soal ke luar layar adalah gerakan
                          yang sama dengan menggulir daftarnya. Panah
                          bekerja sama di keduanya, dan bisa dijangkau
                          lewat papan ketik.

                          Hanya muncul bila kolomnya sudah ada; tanpa
                          itu tombolnya akan selalu gagal saat ditekan.
                        */}
                        {kolomUrutanAda && batchQs.length > 1 && (
                          <div data-tulis className="flex flex-col gap-0.5">
                            <button type="button" aria-label={`Naikkan soal ${idx + 1}`}
                              title="Naikkan" disabled={idx === 0}
                              onClick={() => geserSoal(expandKey, batchQs, idx, -1)}
                              className="w-6 h-5 rounded flex items-center justify-center text-slate-500 bg-white/70 border border-slate-200 transition-all enabled:hover:text-slate-700 enabled:hover:bg-white disabled:opacity-25 disabled:cursor-not-allowed">
                              <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button type="button" aria-label={`Turunkan soal ${idx + 1}`}
                              title="Turunkan" disabled={idx === batchQs.length - 1}
                              onClick={() => geserSoal(expandKey, batchQs, idx, 1)}
                              className="w-6 h-5 rounded flex items-center justify-center text-slate-500 bg-white/70 border border-slate-200 transition-all enabled:hover:text-slate-700 enabled:hover:bg-white disabled:opacity-25 disabled:cursor-not-allowed">
                              <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, padding: '14px 18px' }}>
                        {q.question_type === 'essay' && (
                          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 mb-1.5"><IkonTeks nama="📝" />ESSAY</span>
                        )}
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.6, marginBottom: 10 }}>{q.question}</p>
                        {q.question_type === 'essay' ? (
                          q.model_answer ? (
                            <div className="px-2.5 py-2 rounded-lg border border-indigo-100 bg-indigo-50/60 text-xs text-indigo-800 mb-2.5">
                              <span className="font-bold">Kunci referensi: </span>{q.model_answer}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic mb-2.5">Tidak ada kunci referensi — dinilai manual sepenuhnya oleh admin.</p>
                          )
                        ) : (
                        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                          {(['a', 'b', 'c', 'd'] as const).map(opt => {
                            const isCorrect = q.correct_answer === opt.toUpperCase();
                            return (
                              <div key={opt} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${isCorrect ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold' : 'border-slate-200 bg-white text-slate-600'}`}>
                                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5 ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{opt.toUpperCase()}</span>
                                <span className="leading-snug">{(q as any)[`option_${opt}`]}</span>
                              </div>
                            );
                          })}
                        </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: DIFF_BG[q.difficulty] ?? '#f8fafc',
                            color: DIFF_TEXT[q.difficulty] ?? '#64748b',
                            border: `1px solid ${DIFF_BORDER[q.difficulty] ?? '#e2e8f0'}`,
                          }}>{DIFF_LABEL[q.difficulty] ?? q.difficulty}</span>
                          <div data-tulis className="flex gap-2">
                            <BtnEdit onClick={() => setEditQ(q)} />
                            <BtnDelete onClick={() => handleDelete(q.id)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/*
                    Tombol tambah diletakkan di BAWAH daftar, bukan
                    di kepala grup bersama tombol Hapus. Di sanalah
                    mata berhenti setelah membaca soal terakhir,
                    dan di sana pula soal barunya akan muncul -
                    jaraknya nol antara niat dan tempat hasilnya
                    terlihat. Menaruhnya di kepala berarti menekan
                    tombol di satu ujung lalu mencari hasilnya di
                    ujung yang lain.
                  */}
                  <button type="button"
                    data-tulis onClick={() => bukaTambahDiGrup(mat.id, batchKey)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed text-xs font-bold transition-all hover:bg-white"
                    style={{ borderColor: bc.border, color: bc.text, background: bc.bg }}>
                    <svg aria-hidden="true" focusable="false" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah soal ke {batchKey ? `"${batchKey}"` : 'grup ini'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
