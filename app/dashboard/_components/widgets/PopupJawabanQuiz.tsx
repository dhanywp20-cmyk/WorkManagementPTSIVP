'use client';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/shared';
import type { User } from '../shared';

/**
 * Impor DINAMIS, bukan statis - dan itu bukan sekadar gaya penulisan.
 *
 * UserAnswerReview hidup di TeamPage.tsx bersama seluruh mesin penilaian AI
 * (gradeEssayWithAI, daftar model, pengaturan penilai) yang HANYA berguna
 * untuk admin/penilai. Impor statis menarik semuanya ke dalam bundel
 * dashboard yang dimuat SETIAP orang yang login - termasuk Guest yang cuma
 * ingin mengintip nilai quiznya sendiri. Dengan next/dynamic, kodenya baru
 * diunduh saat popup ini BENAR-BENAR dibuka.
 */
const UserAnswerReview = dynamic(
  () => import('@/app/learning-center/_components/TeamPage').then(m => m.UserAnswerReview),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(67,56,202,0.25)', borderTopColor: '#4338ca' }} />
      </div>
    ),
  }
);

/**
 * Popup "lihat jawaban" dari kartu Learning Center di dashboard.
 *
 * Membungkus komponen review yang sama dengan yang dipakai halaman Riwayat
 * Quiz penuh (isAdminView=false di sana pun sudah berarti "lihat punya
 * sendiri, tanpa kontrol penilaian") - bukan menulis ulang tampilan soal dan
 * jawaban dari nol. `autoOpenAttemptId` melompat LANGSUNG ke detail attempt
 * yang diklik, melewati daftar - orangnya sudah menunjuk quiz yang mana.
 *
 * Modal bawaan platform (lihat catatan di Modal.tsx) menangani Esc, kunci
 * gulir, dan z-index sendiri. Isinya diberi margin negatif untuk membatalkan
 * padding standar Modal (px-5 py-4) - UserAnswerReview punya header sticky
 * dan padding sendiri yang dirancang menempel ke tepi wadahnya, bukan
 * berjarak dua kali lipat karena terjebak di dalam padding modal lagi.
 */
export function PopupJawabanQuiz({ user, attemptId, onClose }: {
  user: User; attemptId: string; onClose: () => void;
}) {
  return (
    <Modal buka onTutup={onClose} judul="📋 Detail Jawaban Quiz" ikon="🎓" ukuran="xl">
      <div className="-mx-5 -my-4">
        <UserAnswerReview user={user} onBack={onClose} isAdminView={false} autoOpenAttemptId={attemptId} />
      </div>
    </Modal>
  );
}
