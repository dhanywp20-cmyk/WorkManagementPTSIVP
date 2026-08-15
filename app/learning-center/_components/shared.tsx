'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ModalPortal } from '@/components/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  full_name: string;
  username: string;
  role: string;
  jabatan?: string | null;
  sales_division?: string | null;
  phone_number?: string | null;
  team_type?: string | null;
  access_level?: string | null;
}

export interface Material {
  id: string;
  materi_name: string;
  content_text: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  folder_path: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  material_id: string;
  materi_name: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  difficulty: 'easy' | 'medium' | 'hard';
  batch_name?: string | null;
  created_at: string;
  // ── Essay addition (non-breaking; defaults to 'abcd' for all existing rows) ──
  question_type?: 'abcd' | 'essay';
  model_answer?: string | null; // kunci/referensi jawaban essay, untuk bantu admin menilai manual
}

export interface QuizSession {
  id: string;
  session_name: string;
  material_id: string;
  materi_name: string;
  question_ids: string[];
  question_count: number;
  timer_minutes: number | null;
  passing_grade: number;
  is_active: boolean;
  allow_retake: boolean;
  created_at: string;
  scheduled_at: string | null;
  closed_at: string | null;
  target_user_ids: string[] | null;
  open_at: string | null;
  close_at: string | null;
  // ── Essay addition ──
  session_type?: 'abcd' | 'essay';
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_session_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_correct: number;
  total_questions: number;
  passed: boolean | null;
  time_taken_sec: number | null;
  is_submitted: boolean;
  // ── Essay addition: attempt tetap is_submitted=true, tapi belum final sampai admin nilai ──
  grading_status?: 'auto' | 'pending_review' | 'graded';
  graded_by?: string | null;
  graded_at?: string | null;
}

export interface AnswerRecord {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean;
  // ── Essay addition ──
  essay_text?: string | null;
  manual_score?: number | null; // 0-100 per soal — SKOR FINAL, diisi/dikoreksi admin
  // ── AI grading addition — SARAN saja, tidak pernah jadi skor final sendiri ──
  ai_score?: number | null;
  ai_feedback?: string | null;
}

export type AdminView = 'dashboard' | 'materi' | 'questions' | 'sessions' | 'team' | 'report';
export type TeamView = 'my-quiz' | 'materi' | 'history' | 'score';

// ─── Gemini (server-side proxy — API key tidak terekspos ke browser) ─────────

export const GEMINI_URL = '/api/ai/generate';

export const DIFF_COLOR: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  hard: 'bg-rose-100 text-rose-700 border-rose-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function ScoreBadge({ score, passing }: { score: number | null; passing: number }) {
  if (score === null) return <span className="text-slate-400 text-xs">—</span>;
  const pass = score >= passing;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${pass ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
      {pass ? '✅' : '❌'} {score.toFixed(0)}
    </span>
  );
}

// ─── Essay grading status badge (dipakai di HistoryPage, ScorePage, ReportPage) ─
export function GradingStatusBadge({ attempt }: { attempt: { grading_status?: string | null; passed: boolean | null } }) {
  if (attempt.grading_status === 'pending_review') {
    return (
      <span className="text-xs font-bold px-2 py-1 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
        ⏳ Menunggu Penilaian
      </span>
    );
  }
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${attempt.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
      {attempt.passed ? '✅ LULUS' : '❌ TIDAK LULUS'}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Cari...'}
        className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white w-64"
      />
    </div>
  );
}

// ─── Gemini helpers ───────────────────────────────────────────────────────────

export async function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res((e.target?.result as string).split(',')[1]);
    reader.onerror = () => rej(new Error('Read failed'));
    reader.readAsDataURL(f);
  });
}

export async function generateWithGemini(prompt: string, pdfFile?: File | null): Promise<string> {
  const parts: any[] = [];
  if (pdfFile) {
    const base64 = await fileToBase64(pdfFile);
    parts.push({ inline_data: { mime_type: pdfFile.type || 'application/pdf', data: base64 } });
  }
  parts.push({ text: prompt });
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? 'Gemini API error');
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * Minta AI menilai SATU jawaban essay terhadap kunci referensi — dipakai
 * TeamPage sebagai SARAN awal (bukan skor final) supaya admin sebisa mungkin
 * tinggal konfirmasi, bukan menilai semuanya dari nol. Skor final tetap
 * manual_score yang admin simpan sendiri (lihat lc_answers.ai_score vs
 * manual_score di sql/learning-center-ai-grading.sql).
 *
 * Melempar Error kalau AI gagal/keluaran tidak bisa dibaca — pemanggil wajib
 * menangkapnya dan tetap membiarkan admin menilai manual (AI tidak boleh
 * memblokir alur penilaian sama sekali).
 */
export async function gradeEssayWithAI(
  question: string, modelAnswer: string | null | undefined, studentAnswer: string,
): Promise<{ score: number; feedback: string }> {
  const prompt = `Kamu adalah asisten penilai kuis internal perusahaan. Nilai jawaban essay peserta berikut secara OBJEKTIF, dengan mempertimbangkan kesesuaian isi terhadap kunci referensi (bukan sekadar kemiripan kata demi kata — paham konsep yang sama tetap dinilai benar).

SOAL:
${question}

${modelAnswer ? `KUNCI REFERENSI (acuan admin, bukan satu-satunya jawaban benar):\n${modelAnswer}\n` : '(Tidak ada kunci referensi — nilai berdasar kelayakan & kelengkapan jawaban secara umum.)\n'}
JAWABAN PESERTA:
${studentAnswer || '(kosong / tidak dijawab)'}

Balas HANYA dengan JSON valid persis format ini, tanpa markdown, tanpa teks lain:
{"score": <angka 0-100>, "feedback": "<1-2 kalimat alasan singkat dalam Bahasa Indonesia>"}`;

  const raw = await generateWithGemini(prompt);
  // Gemini kadang membungkus JSON dalam code fence ```json ... ``` walau
  // sudah diminta "tanpa markdown" — dibersihkan dulu sebelum parse.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed: { score?: unknown; feedback?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Keluaran AI tidak berupa JSON yang valid.');
  }
  const score = Number(parsed.score);
  if (!Number.isFinite(score)) throw new Error('AI tidak mengembalikan skor yang valid.');
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
  };
}

// ─── Folder Tree ──────────────────────────────────────────────────────────────

export interface FolderNode {
  name: string;
  path: string;
  children: Record<string, FolderNode>;
  materials: Material[];
}

export function buildFolderTree(materials: Material[]): FolderNode {
  const root: FolderNode = { name: 'root', path: '', children: {}, materials: [] };
  materials.forEach(m => {
    const rawPath = (m.folder_path ?? '').trim();
    if (!rawPath) { root.materials.push(m); return; }
    const parts = rawPath.split('/').map(p => p.trim()).filter(Boolean);
    let node = root;
    let currentPath = '';
    parts.forEach(part => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!node.children[part]) {
        node.children[part] = { name: part, path: currentPath, children: {}, materials: [] };
      }
      node = node.children[part];
    });
    node.materials.push(m);
  });
  return root;
}

export function countMaterials(node: FolderNode): number {
  let count = node.materials.length;
  for (const child of Object.values(node.children)) count += countMaterials(child);
  return count;
}

// ─── App Dialog ───────────────────────────────────────────────────────────────

export type DialogState = {
  type: 'info' | 'success' | 'error' | 'warning' | 'confirm';
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void | Promise<void>;
} | null;

export function AppDialog({ dialog, onClose }: { dialog: DialogState; onClose: () => void }) {
  const [running, setRunning] = useState(false);
  if (!dialog) return null;
  const cfgMap = {
    info:    { icon: 'ℹ️',  iconBg: 'bg-blue-50 border-blue-200',    btn: 'bg-blue-600 hover:bg-blue-700' },
    success: { icon: '✅',  iconBg: 'bg-emerald-50 border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    error:   { icon: '❌',  iconBg: 'bg-rose-50 border-rose-200',     btn: 'bg-rose-600 hover:bg-rose-700' },
    warning: { icon: '⚠️', iconBg: 'bg-amber-50 border-amber-200',   btn: 'bg-amber-600 hover:bg-amber-700' },
    confirm: { icon: '🗑️', iconBg: 'bg-slate-50 border-slate-200',   btn: 'bg-rose-600 hover:bg-rose-700' },
  };
  const cfg = cfgMap[dialog.type];
  const isConfirm = dialog.type === 'confirm';
  return (
  <ModalPortal>
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm border border-slate-200">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-14 h-14 ${cfg.iconBg} border rounded-2xl flex items-center justify-center text-2xl mb-4`}>
            {cfg.icon}
          </div>
          {dialog.title && <h3 className="text-base font-bold text-slate-800 mb-2">{dialog.title}</h3>}
          <p className="text-sm text-slate-600 leading-relaxed">{dialog.message}</p>
        </div>
        <div className={`flex gap-3 ${isConfirm ? '' : 'justify-center'}`}>
          {isConfirm && (
            <button onClick={onClose} disabled={running}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-50">
              Batal
            </button>
          )}
          <button
            disabled={running}
            onClick={async () => {
              if (dialog.onConfirm) {
                setRunning(true);
                try { await dialog.onConfirm(); } catch (e) { console.error('onConfirm error:', e); }
                setRunning(false);
              }
              onClose();
            }}
            className={`${isConfirm ? 'flex-1' : 'px-8'} py-2.5 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60 ${cfg.btn}`}>
            {running
              ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Memproses...</span>
              : isConfirm ? (dialog.confirmLabel ?? 'Konfirmasi') : 'OK'}
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

// ─── Icon SVGs ────────────────────────────────────────────────────────────────

export function IcoView({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export function IcoEdit({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  );
}

export function IcoDelete({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );
}

export function IcoOpen({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    </svg>
  );
}

// ─── Action Button Components ─────────────────────────────────────────────────
// Icon-only (w-7 h-7) when no children; text+icon when children provided (e.g. "Lihat Jawaban")

const iconOnlyBase = 'inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';
const textBase = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all duration-150 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';

export function BtnView({ onClick, children, disabled }: { onClick?: () => void; children?: React.ReactNode; disabled?: boolean }) {
  const hasText = !!children;
  return (
    <button onClick={onClick} disabled={disabled} title={hasText ? undefined : 'Lihat'}
      className={`${hasText ? textBase : iconOnlyBase} text-blue-600 bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-200`}>
      <IcoView size={hasText ? 12 : 13} />{hasText && children}
    </button>
  );
}

export function BtnEdit({ onClick, children, disabled }: { onClick?: () => void; children?: React.ReactNode; disabled?: boolean }) {
  const hasText = !!children;
  return (
    <button onClick={onClick} disabled={disabled} title={hasText ? undefined : 'Edit'}
      className={`${hasText ? textBase : iconOnlyBase} text-emerald-600 bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200`}>
      <IcoEdit size={hasText ? 12 : 13} />{hasText && children}
    </button>
  );
}

export function BtnDelete({ onClick, children, disabled }: { onClick?: () => void; children?: React.ReactNode; disabled?: boolean }) {
  const hasText = !!children;
  return (
    <button onClick={onClick} disabled={disabled} title={hasText ? undefined : 'Hapus'}
      className={`${hasText ? textBase : iconOnlyBase} text-rose-600 bg-white border-slate-200 hover:bg-rose-50 hover:border-rose-200`}>
      <IcoDelete size={hasText ? 12 : 13} />{hasText && children}
    </button>
  );
}

export function BtnOpen({ onClick, children, disabled }: { onClick?: () => void; children?: React.ReactNode; disabled?: boolean }) {
  const hasText = !!children;
  return (
    <button onClick={onClick} disabled={disabled} title={hasText ? undefined : 'Buka'}
      className={`${hasText ? textBase : iconOnlyBase} text-violet-600 bg-white border-slate-200 hover:bg-violet-50 hover:border-violet-200`}>
      <IcoOpen size={hasText ? 12 : 13} />{hasText && children}
    </button>
  );
}

export { supabase };
