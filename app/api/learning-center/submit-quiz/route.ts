import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });

  const { attemptId, tabSwitches } = await request.json().catch(() => ({}));
  if (!attemptId) return NextResponse.json({ error: 'attemptId wajib diisi.' }, { status: 400 });

  const supabase = getAdminClient();

  const { data: attempt } = await supabase
    .from('lc_quiz_attempts').select('*').eq('id', attemptId).eq('user_id', caller.id).maybeSingle();
  if (!attempt) return NextResponse.json({ error: 'Attempt tidak ditemukan.' }, { status: 404 });
  if (attempt.is_submitted) {
    return NextResponse.json({ error: 'Quiz ini sudah pernah disubmit.' }, { status: 409 });
  }

  const { data: session } = await supabase
    .from('lc_quiz_sessions').select('*').eq('id', attempt.quiz_session_id).maybeSingle();
  if (!session) return NextResponse.json({ error: 'Sesi quiz tidak ditemukan.' }, { status: 404 });
  if (session.session_type === 'essay') {
    return NextResponse.json({ error: 'Quiz essay tidak lewat jalur ini.' }, { status: 400 });
  }

  const questionIds: string[] = session.question_ids ?? [];
  const [{ data: questions }, { data: answers }] = await Promise.all([
    supabase.from('lc_questions').select('id, correct_answer').in('id', questionIds),
    supabase.from('lc_answers').select('id, question_id, answer').eq('attempt_id', attemptId),
  ]);

  type AnswerRow = { id: string; question_id: string; answer: string };
  const answerRows = (answers ?? []) as AnswerRow[];
  const answerByQuestion = new Map(answerRows.map(a => [a.question_id, a]));
  const perQuestion: Record<string, { correct_answer: string; is_correct: boolean }> = {};
  let correct = 0;

  for (const q of questions ?? []) {
    const row = answerByQuestion.get(q.id);
    const isCorrect = !!row && row.answer === q.correct_answer;
    if (isCorrect) correct++;
    perQuestion[q.id] = { correct_answer: q.correct_answer, is_correct: isCorrect };
  }

  await Promise.all(
    answerRows.map(a => {
      const pq = perQuestion[a.question_id];
      if (!pq) return null;
      return supabase.from('lc_answers').update({ is_correct: pq.is_correct }).eq('id', a.id);
    }),
  );

  const total = questionIds.length;
  const score = total ? (correct / total) * 100 : 0;
  const passed = score >= session.passing_grade;
  const timeTakenSec = Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000);

  const tabSwitchesFinal = Math.max(attempt.tab_switches ?? 0, typeof tabSwitches === 'number' ? tabSwitches : 0);

  const { error } = await supabase.from('lc_quiz_attempts').update({
    submitted_at: new Date().toISOString(), score, total_correct: correct,
    total_questions: total, passed, is_submitted: true, time_taken_sec: timeTakenSec,
    grading_status: 'auto', tab_switches: tabSwitchesFinal,
  }).eq('id', attemptId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ score, correct, total, passed, perQuestion });
}
