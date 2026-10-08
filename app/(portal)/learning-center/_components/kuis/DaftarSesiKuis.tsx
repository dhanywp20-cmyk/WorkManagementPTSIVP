'use client';

/** DaftarSesiKuis - dipecah dari app/(portal)/learning-center/_components/MyQuizPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { QuizSession, QuizAttempt } from '../shared';
import { tenggatQuiz } from '../MyQuizPage';

export interface DaftarSesiKuisProps {
  activeAttempts: Record<string, QuizAttempt>;
  filteredSessions: QuizSession[];
  handleStart: (session: QuizSession) => Promise<void>;
  pendingReviewIds: Set<string>;
  search: string;
  submittedSessionIds: Set<string>;
}

export function DaftarSesiKuis({ activeAttempts, filteredSessions, handleStart, pendingReviewIds, search, submittedSessionIds }: DaftarSesiKuisProps) {
  return (
    <>
      <div className="p-4 sm:p-8 grid grid-cols-1 gap-4">
        {filteredSessions.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              <p className="font-semibold text-slate-700">{search ? 'Tidak ada quiz yang cocok' : 'Belum ada quiz aktif'}</p>
              {!search && <p className="text-sm mt-1 text-slate-500">Tunggu admin membuat sesi quiz baru</p>}
            </div>
          </div>
        )}
        {filteredSessions.map(s => {
          const inProgress  = activeAttempts[s.id];
          const alreadyDone = !s.allow_retake && submittedSessionIds.has(s.id);
          const menungguNilai = pendingReviewIds.has(s.id);
          const tenggat = tenggatQuiz(s.close_at);

          /*
            Tombolnya ditulis sekali lalu dipakai di dua tempat: di kanan judul
            saat ruangnya cukup, dan selebar kartu di layar sempit. Menyalinnya
            dua kali berarti dua tombol yang bisa berbeda diam-diam - dan yang
            di ponsel justru yang paling jarang dilihat saat menyunting.
          */
          const tombol = alreadyDone ? (
            <button disabled
              className="px-5 py-2.5 text-sm font-bold rounded-xl bg-slate-200 text-slate-500 cursor-not-allowed w-full formulir:w-auto"
              title="Quiz ini sudah kamu kerjakan dan tidak bisa diulang">
              <IkonTeks nama="✅" />Selesai
            </button>
          ) : (
            <button onClick={() => handleStart(s)}
              className={`px-5 py-2.5 text-sm font-bold rounded-xl shadow transition-all w-full formulir:w-auto ${inProgress ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
              {inProgress ? '▶️ Lanjutkan Quiz' : '🚀 Mulai Quiz'}
            </button>
          );

          return (
            <div key={s.id} className="stagger-item rounded-2xl border border-white/60 shadow-sm p-5 sm:p-6 hover:shadow-md transition-all"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', opacity: alreadyDone ? 0.75 : 1 }}>
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-2xl flex-shrink-0"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-base sm:text-lg">
                    {s.session_name}
                    {s.session_type === 'essay' && <span className="ml-2 align-middle text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 border border-indigo-200"><IkonTeks nama="📝" />Essay</span>}
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">{s.materi_name}</p>
                </div>
                {/*
                  Tombol di kanan HANYA saat ruangnya cukup. Di lebar ponsel ia
                  dan judul quiz berebut lebar yang sama: judulnya pecah jadi
                  beberapa baris sementara tombolnya tetap menahan ruangnya.
                  Di bawah 'formulir' tombolnya turun ke bawah, selebar kartu.
                */}
                <div className="hidden formulir:block flex-shrink-0">{tombol}</div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 text-xs text-slate-500">
                <span><Ikon nama="📝" ukuran="1em" className="inline-block align-[-0.12em]" /> {s.question_count} soal</span>
                <span><Ikon nama="⏱" ukuran="1em" className="inline-block align-[-0.12em]" /> {s.timer_minutes ? `${s.timer_minutes} mnt` : 'Tanpa batas waktu'}</span>
                <span><IkonTeks nama="🎯" />Passing: {s.passing_grade}%</span>
                <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
              </div>

              {/*
                SATU baris lencana yang membungkus, bukan tiga div bertumpuk.
                Yang lama memberi tiap lencana div-nya sendiri dengan mt-2, jadi
                kartunya memanjang ke bawah satu tingkat per lencana - melar
                persis saat isinya paling ramai.
              */}
              {(inProgress || menungguNilai || alreadyDone || tenggat) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {inProgress && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold"><IkonTeks nama="⏳" />Sedang Berlangsung</span>
                  )}
                  {menungguNilai && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold"><IkonTeks nama="⏳" />Menunggu Penilaian Admin</span>
                  )}
                  {alreadyDone && !menungguNilai && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold"><IkonTeks nama="✅" />Sudah Dikerjakan</span>
                  )}
                  {tenggat && !alreadyDone && (
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${
                      tenggat.mendesak
                        ? 'bg-rose-100 text-rose-700 border-rose-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      <Ikon nama="🔒" ukuran="1em" className="inline-block align-[-0.12em]" /> {tenggat.teks}
                    </span>
                  )}
                </div>
              )}

              <div className="formulir:hidden mt-4">{tombol}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
