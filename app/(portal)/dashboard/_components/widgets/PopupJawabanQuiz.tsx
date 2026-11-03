'use client';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/shared';
import type { User } from '../shared';

const UserAnswerReview = dynamic(
  () => import('@/app/(portal)/learning-center/_components/TeamPage').then(m => m.UserAnswerReview),
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
