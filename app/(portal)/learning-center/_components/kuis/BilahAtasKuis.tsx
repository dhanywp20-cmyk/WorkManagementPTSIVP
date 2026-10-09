'use client';

/** BilahAtasKuis - dipecah dari app/(portal)/learning-center/_components/MyQuizPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { QuizSession } from '../shared';
import { type QuizQuestion } from '../MyQuizPage';

export interface BilahAtasKuisProps {
  KELILING: number;
  KET_WAKTU: { readonly tenang: "Sisa waktu"; readonly waspada: "Waktu menipis"; readonly kritis: "Segera kumpulkan"; };
  WARNA_WAKTU: { readonly tenang: "#059669"; readonly waspada: "#D97706"; readonly kritis: "#DC2626"; };
  answered: number;
  fmtTimer: (s: number) => string;
  handleSubmit: (autoSubmit?: boolean) => Promise<void>;
  isUrgent: boolean;
  porsiWaktu: number;
  questions: QuizQuestion[];
  session: QuizSession;
  setKonfirmasiKeluar: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  timeLeft: number | null;
  tingkatWaktu: "tenang" | "waspada" | "kritis";
}

export function BilahAtasKuis({ KELILING, KET_WAKTU, WARNA_WAKTU, answered, fmtTimer, handleSubmit, isUrgent, porsiWaktu, questions, session, setKonfirmasiKeluar, timeLeft, tingkatWaktu }: BilahAtasKuisProps) {
  return (
    <>
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 flex-shrink-0 bg-white border-b border-slate-200"
        style={{ boxShadow: '0 8px 24px -18px rgba(15,23,42,.18)' }}>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-[12.5px] sm:text-sm truncate text-slate-800">
            {session.session_name}
          </h2>
          <p className="text-[11px] sm:text-[11.5px] mt-0.5 text-slate-500">
            {answered} dari {questions.length} soal terjawab
          </p>
        </div>

        {/*
          TIMER - benda terbesar di bilah ini, dan memang seharusnya.

          Bentuk lamanya sebuah pil kecil seukuran tombol Submit di sebelahnya.
          Padahal di quiz berbatas waktu, inilah angka yang paling sering
          dicari orang. Cincin di kirinya menyusut mengikuti sisa waktu, jadi
          bisa dibaca sekilas tanpa memproses angkanya.
        */}
        {timeLeft !== null && (
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="relative flex-shrink-0" style={{ width: 38, height: 38 }}>
              <svg width="38" height="38" viewBox="0 0 46 46" aria-hidden="true"
                style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                <circle cx="23" cy="23" r="19" fill="none" stroke="#E2E8F0" strokeWidth="4" />
                <circle cx="23" cy="23" r="19" fill="none" strokeWidth="4" strokeLinecap="round"
                  stroke={WARNA_WAKTU[tingkatWaktu]}
                  strokeDasharray={KELILING}
                  strokeDashoffset={KELILING * (1 - porsiWaktu)}
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }} />
              </svg>
            </div>
            <div>
              <div role="timer"
                className={`font-black tabular-nums leading-none text-[26px] sm:text-[34px] ${isUrgent ? 'animate-pulse' : ''}`}
                style={{ color: WARNA_WAKTU[tingkatWaktu], letterSpacing: '-0.02em' }}>
                {fmtTimer(timeLeft)}
              </div>
              <span className="block text-[10px] font-bold uppercase mt-1 text-slate-500"
                style={{ letterSpacing: '0.16em' }}>
                {KET_WAKTU[tingkatWaktu]}
              </span>
            </div>
          </div>
        )}

        {/*
          Submit di bilah atas TINGGAL jalan keluar untuk mengumpulkan lebih
          awal - dan hanya selama masih ada soal kosong. Begitu semua
          terjawab ia menghilang, digantikan tombol besar di bawah, tempat
          mata peserta sudah berada.
        */}
        {answered < questions.length && (
          <button onClick={() => handleSubmit(false)}
            className="px-3 py-2 lg:px-7 lg:py-3.5 text-[12px] lg:text-base font-bold rounded-lg lg:rounded-xl transition-all flex-shrink-0 hidden formulir:block bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200">
            Submit
          </button>
        )}

        {/* Tutup TIDAK langsung keluar - lihat dialog konfirmasi di bawah.
            Menutup quiz berbatas waktu tanpa peringatan berarti kehilangan
            kesempatan mengerjakan, dan itu tidak bisa dibatalkan. */}
        <button onClick={() => setKonfirmasiKeluar(true)} aria-label="Keluar dari quiz"
          className="w-9 h-9 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl flex items-center justify-center transition-all flex-shrink-0 bg-transparent hover:bg-slate-100 text-slate-500 border border-slate-200">
          <svg aria-hidden="true" focusable="false" className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}
