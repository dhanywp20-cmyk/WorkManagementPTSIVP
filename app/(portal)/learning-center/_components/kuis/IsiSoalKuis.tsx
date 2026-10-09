'use client';

/** IsiSoalKuis - dipecah dari app/(portal)/learning-center/_components/MyQuizPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { type QuizQuestion } from '../MyQuizPage';

export interface IsiSoalKuisProps {
  answers: Record<string, string>;
  current: number;
  gambarJawaban: Record<string, string>;
  handleAnswer: (questionId: string, answer: string) => Promise<boolean>;
  handleUploadGambar: (questionId: string, file: File) => Promise<boolean>;
  isEssay: boolean;
  q: QuizQuestion;
  questions: QuizQuestion[];
  savedAnswers: Record<string, string>;
  setAnswers: import("react").Dispatch<import("react").SetStateAction<Record<string, string>>>;
  setCurrent: import("react").Dispatch<import("react").SetStateAction<number>>;
  unggah: string | null;
}

export function IsiSoalKuis({ answers, current, gambarJawaban, handleAnswer, handleUploadGambar, isEssay, q, questions, savedAnswers, setAnswers, setCurrent, unggah }: IsiSoalKuisProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 sm:py-8 lg:py-10">
        {/*
          Panah sebelumnya/berikutnya di SAMPING kartu, khusus laptop
          (lg+) - permintaan eksplisit supaya navigasi tidak melulu numpuk
          di bilah bawah yang sempit. Di ponsel/tablet tetap lewat bilah
          bawah seperti sebelumnya (dianggap sudah cukup), jadi tombol ini
          disembunyikan di bawah lg lewat hidden lg:flex, bukan dihapus.
        */}
        <div className="max-w-5xl mx-auto flex items-center gap-3 lg:gap-5">
          <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}
            aria-label="Soal sebelumnya"
            className="hidden lg:flex flex-shrink-0 w-12 h-12 rounded-full items-center justify-center bg-white border border-slate-200 text-slate-500 transition-all hover:text-[#5B5BF5] hover:border-[#5B5BF5] hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-500 disabled:hover:border-slate-200 disabled:hover:shadow-none"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 6px 16px -6px rgba(15,23,42,.12)' }}>
            <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

        {/*
          SATU kartu memuat nomor, soal, dan pilihan - dulu tiga blok
          terpisah di atas latar yang sama, yang membuat batas antara "soal"
          dan "antarmuka" kabur.

          Lebar dan padding-nya bertingkat lebih besar di layar lebar
          (sm/lg) - di laptop, kartu 672px yang cocok untuk ponsel duduk
          kecil di tengah layar kosong dan terasa sempit. Di ponsel ukurannya
          tidak diubah dari sebelumnya, sesuai yang diminta.
        */}
        <div className="flex-1 min-w-0 max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto rounded-2xl bg-white border border-slate-200 p-5 sm:p-8 lg:p-10"
          style={{ boxShadow: '0 1px 3px rgba(15,23,42,.05), 0 20px 40px -20px rgba(15,23,42,.18)' }}>
          <div className="flex items-center gap-2.5 mb-3.5 lg:mb-5 flex-wrap">
            <span className="text-[11px] lg:text-xs font-bold uppercase px-2.5 py-1 rounded-md"
              style={{ background: '#EEEEFE', color: '#5B5BF5', letterSpacing: '0.1em' }}>
              Soal {current + 1} / {questions.length}
            </span>
            <span className={`text-[11px] lg:text-xs font-bold px-2 py-0.5 rounded-full border ${q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : q.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{q.difficulty}</span>
          </div>
          {/*  break-words: pengaman untuk teks panjang tanpa spasi (mis. satu
               kata sangat panjang atau tautan) supaya tetap terbungkus rapi
               di layar sempit, bukan meluber keluar kartu. */}
          <p className="text-[17px] sm:text-xl lg:text-2xl font-semibold leading-snug mb-5 lg:mb-7 break-words"
            style={{ color: '#141828', letterSpacing: '-0.015em' }}>{q.question}</p>
          <div className="space-y-2.5 lg:space-y-3">
            {isEssay && q.answer_format === 'image' ? (
              /* Jawaban berupa foto - untuk soal merancang yang paling wajar
                 digambar tangan. Yang ditampilkan setelah unggah adalah
                 PRATINJAU kecilnya, bukan gambar penuh: peserta sudah tahu
                 apa yang ia foto, jadi mengunduh ulang versi besar hanya
                 menghabiskan kuotanya sendiri. */
              <div className="space-y-3">
                {gambarJawaban[q.id] ? (
                  <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3">
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={gambarJawaban[q.id]} alt="Pratinjau jawaban kamu"
                        className="w-24 h-24 object-cover rounded-lg border border-emerald-200 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-700">✓ Foto jawaban tersimpan</p>
                        <p className="text-[11px] text-emerald-700 leading-relaxed mt-0.5">
                          Boleh diganti selama quiz belum dikumpulkan.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <p className="text-3xl mb-1"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
                    <p className="text-sm font-semibold text-slate-600">Belum ada foto jawaban</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Gambar jawabanmu di kertas, lalu foto dan unggah di sini.
                    </p>
                  </div>
                )}
                <label className={`block w-full text-center px-4 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                  unggah === q.id ? 'bg-slate-200 text-slate-500 cursor-wait'
                                  : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                  {unggah === q.id ? 'Mengunggah…' : gambarJawaban[q.id] ? 'Ganti Foto' : 'Ambil / Pilih Foto'}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    disabled={unggah !== null}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      // Nilai input dikosongkan supaya memilih berkas yang SAMA
                      // dua kali tetap memicu onChange - kalau tidak, unggah
                      // ulang setelah gagal terasa seperti tombolnya rusak.
                      e.target.value = '';
                      if (f) void handleUploadGambar(q.id, f);
                    }} />
                </label>
                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Foto dikecilkan otomatis di perangkatmu sebelum dikirim, jadi hemat kuota.
                </p>
              </div>
            ) : isEssay ? (
              <textarea
                key={q.id}
                defaultValue={answers[q.id] ?? savedAnswers[q.id] ?? ''}
                onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                onBlur={e => handleAnswer(q.id, e.target.value)}
                rows={8}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-slate-500 resize-y"
                placeholder="Tulis jawaban essay kamu di sini..."
              />
            ) : (['A','B','C','D'] as const).map(opt => {
              const val = (q as any)[`option_${opt.toLowerCase()}`];
              const selected = (answers[q.id] ?? savedAnswers[q.id]) === opt;
              return (
                /*
                  Terpilih ditandai lewat KOTAK HURUF yang jadi solid, bukan
                  seluruh baris yang menghitam. Yang lama membalik latar dan
                  teksnya sekaligus - terbaca seperti tombol yang sedang
                  ditekan, bukan pilihan yang sudah diambil, dan di layar
                  terang perbedaannya menyilaukan saat berpindah soal.
                */
                <button key={opt} onClick={() => handleAnswer(q.id, opt)}
                  aria-pressed={selected}
                  className={`w-full flex items-center gap-3 lg:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 lg:py-5 rounded-xl text-left transition-all duration-200 ${selected ? '' : 'hover:border-[#C7CBF5] hover:-translate-y-px hover:shadow-sm'}`}
                  style={{
                    border: `1.5px solid ${selected ? '#5B5BF5' : '#E4E7F0'}`,
                    background: selected ? '#EEEEFE' : '#FFFFFF',
                    color: '#141828',
                    boxShadow: selected ? '0 1px 2px rgba(91,91,245,.12)' : undefined,
                  }}>
                  <span className="w-[30px] h-[30px] sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center text-[13px] sm:text-sm lg:text-base font-black flex-shrink-0 transition-all tabular-nums"
                    style={{
                      background: selected ? '#5B5BF5' : '#F1F2F8',
                      color: selected ? '#FFFFFF' : '#5A6180',
                    }}>{opt}</span>
                  {/*  min-w-0: tanpa ini, span di dalam flex row tidak mau
                       menyusut di bawah lebar isinya sendiri untuk teks yang
                       panjang tanpa spasi - baris pilihannya akan meluber
                       keluar kartu alih-alih membungkus rapi ke bawah. */}
                  <span className="text-[14.5px] sm:text-base lg:text-lg font-medium flex-1 min-w-0 break-words">{val}</span>
                  {selected && (
                    <svg aria-hidden="true" focusable="false" className="w-5 h-5 lg:w-6 lg:h-6 flex-shrink-0" style={{ color: '#5B5BF5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

          <button onClick={() => setCurrent(p => Math.min(questions.length - 1, p + 1))} disabled={current === questions.length - 1}
            aria-label="Soal berikutnya"
            className="hidden lg:flex flex-shrink-0 w-12 h-12 rounded-full items-center justify-center bg-white border border-slate-200 text-slate-500 transition-all hover:text-[#5B5BF5] hover:border-[#5B5BF5] hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-500 disabled:hover:border-slate-200 disabled:hover:shadow-none"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 6px 16px -6px rgba(15,23,42,.12)' }}>
            <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
