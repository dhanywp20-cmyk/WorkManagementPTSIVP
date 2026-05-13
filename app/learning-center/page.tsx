'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  full_name: string;
  username: string;
  role: string;
  jabatan?: string | null;
  sales_division?: string | null;
  phone_number?: string | null;
}

// Material sekarang punya folder_path untuk grouping (contoh: "Produk/Microvision")
interface Material {
  id: string;
  materi_name: string;
  content_text: string | null;
  file_url: string | null;       // OneDrive link
  file_name: string | null;
  file_type: string | null;
  folder_path: string | null;    // NEW: "Produk" atau "Produk/Microvision"
  created_by: string | null;
  created_at: string;
}

interface Question {
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
  created_at: string;
}

interface QuizSession {
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
}

interface QuizAttempt {
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
}

// Answer record (from lc_answers table)
interface AnswerRecord {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean;
}

type AdminView = 'dashboard' | 'materi' | 'questions' | 'sessions' | 'team' | 'report' | 'analytics';
type TeamView = 'my-quiz' | 'materi' | 'history' | 'score';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

const DIFF_COLOR: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  hard: 'bg-rose-100 text-rose-700 border-rose-200',
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

function ScoreBadge({ score, passing }: { score: number | null; passing: number }) {
  if (score === null) return <span className="text-slate-400 text-xs">—</span>;
  const pass = score >= passing;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${pass ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
      {pass ? '✅' : '❌'} {score.toFixed(0)}
    </span>
  );
}

// ─── Gemini Helper ────────────────────────────────────────────────────────────

async function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res((e.target?.result as string).split(',')[1]);
    reader.onerror = () => rej(new Error('Read failed'));
    reader.readAsDataURL(f);
  });
}

// PDF hanya dikirim ke Gemini untuk generate soal — TIDAK disimpan ke Supabase
async function generateWithGemini(prompt: string, pdfFile?: File | null): Promise<string> {
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

// ─── Folder Tree Helpers ──────────────────────────────────────────────────────

interface FolderNode {
  name: string;
  path: string;
  children: Record<string, FolderNode>;
  materials: Material[];
}

function buildFolderTree(materials: Material[]): FolderNode {
  const root: FolderNode = { name: 'root', path: '', children: {}, materials: [] };

  materials.forEach(m => {
    const rawPath = (m.folder_path ?? '').trim();
    if (!rawPath) {
      root.materials.push(m);
      return;
    }
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

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function LearningCenterPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const saved = localStorage.getItem('currentUser');
      const savedTime = localStorage.getItem('loginTime');
      if (!saved) { setLoading(false); return; }
      if (savedTime) {
        const sixHours = 6 * 60 * 60 * 1000;
        if (Date.now() - parseInt(savedTime) > sixHours) {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('loginTime');
          setLoading(false); return;
        }
      }
      try {
        const parsed: User = JSON.parse(saved);
        const { data } = await supabase.from('users').select('*').eq('id', parsed.id).single();
        setCurrentUser(data ?? parsed);
      } catch {
        setCurrentUser(null);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{backgroundImage:"url('/IVP_Background.png')",backgroundSize:'cover',backgroundPosition:'center'}}>
        <div className="text-center px-10 py-8 rounded-3xl" style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px)',boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
          <div className="text-4xl mb-3 animate-pulse">🎓</div>
          <p className="text-slate-500 font-medium">Memuat Learning Center...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center" style={{backgroundImage:"url('/IVP_Background.png')",backgroundSize:'cover',backgroundPosition:'center'}}>
        <div className="text-center px-10 py-8 rounded-3xl" style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px)',boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-slate-500 font-medium">Silakan login terlebih dahulu.</p>
        </div>
      </div>
    );
  }

  return <LearningCenter currentUser={currentUser} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function LearningCenter({ currentUser }: { currentUser: User }) {
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [teamView, setTeamView] = useState<TeamView>('my-quiz');

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{
        backgroundImage: "url('/IVP_Background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.10)' }} />
      <div className="relative z-10 flex flex-col min-h-screen">
        {isAdmin
          ? <AdminTopNav view={adminView} onChange={setAdminView} />
          : <TeamTopNav view={teamView} onChange={setTeamView} />}

        <div className="flex-1 overflow-y-auto" style={{minHeight:"calc(100vh - 100px)"}}>
          {isAdmin ? (
            <>
              {adminView === 'dashboard'  && <AdminDashboard user={currentUser} />}
              {adminView === 'materi'     && <MateriPage user={currentUser} isAdmin={true} />}
              {adminView === 'questions'  && <QuestionsPage user={currentUser} />}
              {adminView === 'sessions'   && <SessionsPage user={currentUser} />}
              {adminView === 'team'       && <TeamPage />}
              {adminView === 'report'     && <ReportPage currentUser={currentUser} />}
              {adminView === 'analytics'  && <AnalyticsPage />}
            </>
          ) : (
            <>
              {teamView === 'my-quiz'  && <MyQuizPage user={currentUser} />}
              {teamView === 'materi'   && <MateriPage user={currentUser} isAdmin={false} />}
              {teamView === 'history'  && <HistoryPage user={currentUser} />}
              {teamView === 'score'    && <ScorePage user={currentUser} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Top Navbars ──────────────────────────────────────────────────────────────

function AdminTopNav({ view, onChange }: { view: AdminView; onChange: (v: AdminView) => void }) {
  const items: { key: AdminView; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'materi', icon: '📚', label: 'Materi' },
    { key: 'questions', icon: '🧩', label: 'Bank Soal' },
    { key: 'sessions', icon: '🎯', label: 'Sesi Quiz' },
    { key: 'team', icon: '👥', label: 'Team' },
    { key: 'report', icon: '📋', label: 'Laporan' },
    { key: 'analytics', icon: '📈', label: 'Analytics' },
  ];
  return (
    <div style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",borderBottom:"3px solid #dc2626"}} className="flex-shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-3 px-6 pt-4 pb-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-base shadow">🎓</div>
        <div>
          <span className="text-sm font-bold text-slate-800 leading-tight">Learning Center</span>
          <span className="ml-2 text-[10px] text-blue-600 font-semibold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full">Admin Portal</span>
        </div>
      </div>
      <nav className="flex items-end gap-1 px-4 pt-2">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap
              ${view === i.key ? 'text-blue-700 border-blue-600 bg-blue-50/60 font-semibold' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}>
            <span className="text-sm">{i.icon}</span>{i.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TeamTopNav({ view, onChange }: { view: TeamView; onChange: (v: TeamView) => void }) {
  const items: { key: TeamView; icon: string; label: string }[] = [
    { key: 'my-quiz', icon: '📝', label: 'My Quiz' },
    { key: 'materi', icon: '📚', label: 'Materi' },
    { key: 'history', icon: '🕐', label: 'Riwayat' },
    { key: 'score', icon: '🏆', label: 'Nilai Saya' },
  ];
  return (
    <div style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(16px)",borderBottom:"3px solid #dc2626"}} className="flex-shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-3 px-6 pt-4 pb-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-base shadow">🎓</div>
        <div>
          <span className="text-sm font-bold text-slate-800 leading-tight">Learning Center</span>
          <span className="ml-2 text-[10px] text-indigo-500 font-semibold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full">Team Portal</span>
        </div>
      </div>
      <nav className="flex items-end gap-1 px-4 pt-2">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap
              ${view === i.key ? 'text-indigo-700 border-indigo-600 bg-indigo-50/60 font-semibold' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}>
            <span className="text-sm">{i.icon}</span>{i.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-white/30 sticky top-0 z-10" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(12px)'}}>
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── ADMIN: Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState({ materials: 0, questions: 0, sessions: 0, attempts: 0 });
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [mat, que, ses, att] = await Promise.all([
        supabase.from('lc_materials').select('id', { count: 'exact', head: true }),
        supabase.from('lc_questions').select('id', { count: 'exact', head: true }),
        supabase.from('lc_quiz_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('lc_quiz_attempts').select('id', { count: 'exact', head: true }),
      ]);
      setStats({ materials: mat.count ?? 0, questions: que.count ?? 0, sessions: ses.count ?? 0, attempts: att.count ?? 0 });

      const { data } = await supabase
        .from('lc_quiz_attempts')
        .select('*, users(full_name), lc_quiz_sessions(session_name, passing_grade)')
        .eq('is_submitted', true)
        .order('submitted_at', { ascending: false })
        .limit(8);
      setRecentAttempts(data ?? []);
    };
    load();
  }, []);

  const cards = [
    { label: 'Total Materi', value: stats.materials, icon: '📚', color: 'from-blue-500 to-blue-600' },
    { label: 'Bank Soal', value: stats.questions, icon: '🧩', color: 'from-violet-500 to-violet-600' },
    { label: 'Sesi Aktif', value: stats.sessions, icon: '🎯', color: 'from-emerald-500 to-emerald-600' },
    { label: 'Total Attempt', value: stats.attempts, icon: '📝', color: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Selamat datang, ${user.full_name}`} />
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-4 gap-5">
          {cards.map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/60 overflow-hidden shadow-sm" style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Aktivitas Terbaru</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAttempts.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm">Belum ada aktivitas quiz</div>
            )}
            {recentAttempts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                  {a.users?.full_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.users?.full_name ?? '-'}</p>
                  <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.session_name ?? '-'}</p>
                </div>
                <ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} />
                <span className="text-xs text-slate-400 flex-shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Folder Tree Component ─────────────────────────────────────────────────────

function FolderTreeView({
  node,
  depth = 0,
  isAdmin,
  onDelete,
  expandedPaths,
  togglePath,
}: {
  node: FolderNode;
  depth?: number;
  isAdmin: boolean;
  onDelete?: (id: string) => void;
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
}) {
  const folderKeys = Object.keys(node.children).sort();
  const hasMaterials = node.materials.length > 0;
  const hasFolders = folderKeys.length > 0;

  if (!hasMaterials && !hasFolders) return null;

  return (
    <div className={depth > 0 ? 'ml-5 border-l-2 border-slate-200 pl-4 mt-1' : ''}>
      {/* Subfolders */}
      {folderKeys.map(key => {
        const child = node.children[key];
        const isOpen = expandedPaths.has(child.path);
        const totalInside = countMaterials(child);
        return (
          <div key={child.path} className="mb-1">
            <button
              onClick={() => togglePath(child.path)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-blue-50 transition-all group text-left"
            >
              <span className="text-base">{isOpen ? '📂' : '📁'}</span>
              <span className="flex-1 font-semibold text-slate-700 text-sm">{child.name}</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{totalInside} materi</span>
              <span className="text-slate-400 text-xs ml-1">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <FolderTreeView
                node={child}
                depth={depth + 1}
                isAdmin={isAdmin}
                onDelete={onDelete}
                expandedPaths={expandedPaths}
                togglePath={togglePath}
              />
            )}
          </div>
        );
      })}

      {/* Materials in this folder */}
      {node.materials.map(m => (
        <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={onDelete} />
      ))}
    </div>
  );
}

function countMaterials(node: FolderNode): number {
  let count = node.materials.length;
  for (const child of Object.values(node.children)) count += countMaterials(child);
  return count;
}

function MaterialCard({ material: m, isAdmin, onDelete }: { material: Material; isAdmin: boolean; onDelete?: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/60 shadow-sm p-4 flex items-start gap-4 group hover:shadow-md transition-all mb-2"
      style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">📄</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800 text-sm">{m.materi_name}</h4>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {m.folder_path && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">📁 {m.folder_path}</span>
          )}
          {m.content_text && (
            <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">✅ Teks AI tersedia</span>
          )}
          <span className="text-[10px] text-slate-400">{fmtDate(m.created_at)}</span>
        </div>
        {m.file_url && (
          <a href={m.file_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1 rounded-lg transition-all">
            ☁️ Buka di OneDrive
          </a>
        )}
      </div>
      {isAdmin && onDelete && (
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onDelete(m.id)}
            className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-all" title="Hapus">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN/TEAM: Materi Page ──────────────────────────────────────────────────

function MateriPage({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    materi_name: '',
    file_url: '',
    folder_path: '',
    content_text: '',
  });
  const [uploading, setUploading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'folder' | 'list'>('folder');

  const load = useCallback(async () => {
    const { data } = await supabase.from('lc_materials').select('*').order('folder_path', { ascending: true }).order('materi_name', { ascending: true });
    setMaterials(data ?? []);
    // Auto-expand all folders on first load
    const paths = new Set<string>();
    (data ?? []).forEach((m: Material) => {
      if (m.folder_path) {
        const parts = m.folder_path.split('/');
        let p = '';
        parts.forEach(part => {
          p = p ? `${p}/${part}` : part;
          paths.add(p);
        });
      }
    });
    setExpandedPaths(paths);
  }, []);
  useEffect(() => { load(); }, [load]);

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.materi_name.trim()) return alert('Nama materi wajib diisi!');
    setUploading(true);
    const { error } = await supabase.from('lc_materials').insert([{
      materi_name: form.materi_name,
      content_text: form.content_text || null,
      file_url: form.file_url || null,
      folder_path: form.folder_path.trim() || null,
      file_name: null,
      file_type: null,
      created_by: user.id,
    }]);
    setUploading(false);
    if (error) return alert('Gagal menyimpan: ' + error.message);
    setShowForm(false);
    setForm({ materi_name: '', file_url: '', folder_path: '', content_text: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus materi ini?')) return;
    await supabase.from('lc_materials').delete().eq('id', id);
    load();
  };

  const tree = buildFolderTree(materials);
  const rootHasFolders = Object.keys(tree.children).length > 0;

  return (
    <div>
      <PageHeader
        title="📚 Materi Training"
        subtitle={isAdmin ? "Kelola & organisir materi training team" : "Materi training tersedia untuk dipelajari"}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
              <button onClick={() => setViewMode('folder')}
                className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'folder' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                📁 Folder
              </button>
              <button onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                📋 List
              </button>
            </div>
            {isAdmin && (
              <button onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
                <span>+</span> Tambah Materi
              </button>
            )}
          </div>
        }
      />
      <div className="p-8">
        {/* Add Form (Admin only) */}
        {isAdmin && showForm && (
          <div className="rounded-2xl border border-blue-100 shadow-lg p-6 mb-8" style={{background:"rgba(255,255,255,0.94)",backdropFilter:"blur(12px)"}}>
            <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">✏️ Form Materi Baru</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
                  <input value={form.materi_name} onChange={e => setForm(p => ({ ...p, materi_name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="contoh: Pengenalan Produk Microvision" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                    Folder Path
                    <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional, pisahkan dengan /)</span>
                  </label>
                  <input value={form.folder_path} onChange={e => setForm(p => ({ ...p, folder_path: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="contoh: Produk/Microvision" />
                  <p className="text-[10px] text-slate-400 mt-1">Kosongkan = di root. Gunakan / untuk subfolder seperti Google Drive</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Link OneDrive
                  <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional — hemat storage Supabase)</span>
                </label>
                <input value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="https://1drv.ms/b/s!..." />
                <p className="text-[10px] text-slate-400 mt-1">Paste link share OneDrive — file tidak disimpan di Supabase</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Konten Teks untuk AI
                  <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional — digunakan generate soal jika tidak upload PDF saat generate)</span>
                </label>
                <textarea value={form.content_text} onChange={e => setForm(p => ({ ...p, content_text: e.target.value }))}
                  rows={4} placeholder="Paste ringkasan atau poin-poin materi untuk keperluan generate soal AI. Kosongkan jika selalu upload PDF saat generate."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
                <p className="text-xs text-slate-400 mt-1">{form.content_text.length} karakter</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={uploading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60">
                  {uploading ? '💾 Menyimpan...' : '💾 Simpan Materi'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info banner untuk Team */}
        {!isAdmin && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <span className="text-lg">ℹ️</span>
            <p className="text-sm text-indigo-700">Klik tombol <strong>Buka di OneDrive</strong> untuk mengakses file materi. File PDF tersimpan di OneDrive, bukan di sini.</p>
          </div>
        )}

        {materials.length === 0 && !showForm && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-semibold">Belum ada materi</p>
            {isAdmin && <p className="text-sm mt-1">Klik + Tambah Materi untuk mulai</p>}
          </div>
        )}

        {materials.length > 0 && (
          <>
            {viewMode === 'folder' ? (
              <div>
                {/* Root materials (no folder) */}
                {tree.materials.length > 0 && (
                  <div className="mb-4">
                    {rootHasFolders && (
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">📄 Tanpa Folder</p>
                    )}
                    {tree.materials.map(m => (
                      <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                    ))}
                  </div>
                )}
                {/* Folder tree */}
                <FolderTreeView
                  node={tree}
                  isAdmin={isAdmin}
                  onDelete={isAdmin ? handleDelete : undefined}
                  expandedPaths={expandedPaths}
                  togglePath={togglePath}
                />
              </div>
            ) : (
              /* List view */
              <div className="space-y-3">
                {materials.map(m => (
                  <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN: Questions (Bank Soal) ─────────────────────────────────────────────

function QuestionsPage({ user }: { user: User }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMat, setSelectedMat] = useState<string>('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [genDiff, setGenDiff] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [editQ, setEditQ] = useState<Question | null>(null);
  // PDF hanya untuk generate — TIDAK disimpan ke Supabase
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: mats } = await supabase.from('lc_materials').select('*').order('materi_name');
    setMaterials(mats ?? []);
    let q = supabase.from('lc_questions').select('*').order('created_at', { ascending: false });
    if (selectedMat) q = q.eq('material_id', selectedMat);
    const { data } = await q;
    setQuestions(data ?? []);
  }, [selectedMat]);
  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!selectedMat) return alert('Pilih materi terlebih dahulu!');
    const mat = materials.find(m => m.id === selectedMat);
    if (!pdfFile && !mat?.content_text) {
      return alert('Upload PDF materi atau pastikan materi sudah punya konten teks.');
    }

    setGenerating(true);
    setGenStatus('Menghubungi Gemini AI...');
    try {
      const diffInstruction = genDiff === 'mixed'
        ? 'Buat soal dengan campuran tingkat kesulitan: easy, medium, dan hard secara merata.'
        : `Semua soal tingkat kesulitan: ${genDiff}.`;

      const prompt = `Kamu adalah instruktur training profesional. ${pdfFile ? 'Berdasarkan dokumen PDF yang dilampirkan' : 'Berdasarkan materi berikut'}, buat tepat ${genCount} soal pilihan ganda (A, B, C, D) dalam Bahasa Indonesia.
${diffInstruction}
${!pdfFile && mat?.content_text ? `\nMATERI:\n${mat.content_text.slice(0, 30000)}` : ''}

Kembalikan HANYA JSON array, tanpa markdown, tanpa teks lain:
[
  {
    "question": "Pertanyaan lengkap?",
    "option_a": "Jawaban A",
    "option_b": "Jawaban B",
    "option_c": "Jawaban C",
    "option_d": "Jawaban D",
    "correct_answer": "A",
    "difficulty": "easy"
  }
]`;

      setGenStatus(pdfFile ? '📄 Mengirim PDF ke Gemini... (PDF tidak disimpan ke Supabase)' : '🧠 Generating soal...');
      const text = await generateWithGemini(prompt, pdfFile ?? null);
      // PDF sudah digunakan Gemini — tidak perlu simpan ke Supabase

      setGenStatus('⚙️ Memproses hasil...');
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const match = jsonStr.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Format JSON tidak ditemukan dalam response Gemini');
      const parsed: any[] = JSON.parse(match[0]);

      const rows = parsed.map(q => ({
        material_id: selectedMat,
        materi_name: mat?.materi_name ?? '',
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: (q.correct_answer ?? 'A').toUpperCase(),
        difficulty: q.difficulty ?? 'medium',
        created_by: user.id,
      }));

      setGenStatus('💾 Menyimpan soal ke database...');
      const { error } = await supabase.from('lc_questions').insert(rows);
      if (error) throw error;

      // Hapus PDF dari state setelah generate berhasil
      setPdfFile(null);
      if (pdfRef.current) pdfRef.current.value = '';

      alert(`✅ ${rows.length} soal berhasil digenerate!\n\n📝 Soal & jawaban sudah tersimpan di Supabase.\n📄 PDF tidak disimpan — storage Supabase tetap hemat.`);
      setShowGenerate(false);
      setGenStatus('');
      load();
    } catch (err: any) {
      alert('Gagal generate: ' + (err.message ?? String(err)));
      setGenStatus('');
    }
    setGenerating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return;
    await supabase.from('lc_questions').delete().eq('id', id);
    load();
  };

  const handleSaveEdit = async () => {
    if (!editQ) return;
    await supabase.from('lc_questions').update({
      question: editQ.question, option_a: editQ.option_a, option_b: editQ.option_b,
      option_c: editQ.option_c, option_d: editQ.option_d, correct_answer: editQ.correct_answer,
      difficulty: editQ.difficulty,
    }).eq('id', editQ.id);
    setEditQ(null);
    load();
  };

  return (
    <div>
      <PageHeader title="🧩 Bank Soal" subtitle={`${questions.length} soal tersedia`}
        action={
          <button onClick={() => setShowGenerate(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
            ✨ Generate AI
          </button>
        }
      />
      <div className="p-8 space-y-6">
        {/* Filter */}
        <div className="flex gap-3 items-center">
          <select value={selectedMat} onChange={e => setSelectedMat(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">Semua Materi</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.materi_name}</option>)}
          </select>
          <span className="text-sm text-slate-500">{questions.length} soal</span>
        </div>

        {/* Generate Panel */}
        {showGenerate && (
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-200 p-6">
            <h3 className="font-bold text-violet-800 mb-1 flex items-center gap-2">✨ Generate Soal dengan Gemini AI</h3>
            <p className="text-xs text-violet-500 mb-1">Upload PDF langsung — Gemini membaca isi PDF secara otomatis</p>
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 mb-4 font-medium">
              ✅ PDF hanya digunakan untuk generate — <strong>tidak disimpan ke Supabase</strong>. Soal & jawaban yang digenerate akan tersimpan.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
                <select value={selectedMat} onChange={e => setSelectedMat(e.target.value)}
                  className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
                  <option value="">-- Pilih Materi --</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.materi_name}{m.content_text ? ' ✅' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jumlah Soal</label>
                <input type="number" min={1} max={100} value={genCount} onChange={e => setGenCount(+e.target.value)}
                  className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Tingkat Kesulitan</label>
                <select value={genDiff} onChange={e => setGenDiff(e.target.value as any)}
                  className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
                  <option value="mixed">Mixed (Campuran)</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Upload PDF Materi
                  <span className="ml-1 text-[10px] font-normal text-violet-500 normal-case tracking-normal">(sementara, tidak disimpan)</span>
                </label>
                <input ref={pdfRef} type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} className="hidden" />
                <div className="flex items-center gap-2">
                  <button onClick={() => pdfRef.current?.click()}
                    className="px-3 py-2 bg-white border border-violet-200 hover:bg-violet-50 text-violet-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5">
                    📄 Pilih PDF
                  </button>
                  {pdfFile
                    ? <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">✅ {pdfFile.name}</span>
                    : <span className="text-xs text-slate-400">atau gunakan teks dari materi ✅</span>}
                  {pdfFile && <button onClick={() => { setPdfFile(null); if (pdfRef.current) pdfRef.current.value = ''; }} className="text-xs text-rose-500 hover:text-rose-700">✕</button>}
                </div>
              </div>
            </div>
            {genStatus && (
              <div className="mb-4 flex items-center gap-2 text-sm text-violet-700 bg-violet-100 border border-violet-200 rounded-xl px-4 py-2.5 font-medium">
                <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin flex-shrink-0" />
                {genStatus}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleGenerate} disabled={generating}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60 flex items-center gap-2">
                {generating
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
                  : '✨ Generate Sekarang'}
              </button>
              <button onClick={() => { setShowGenerate(false); setPdfFile(null); setGenStatus(''); if (pdfRef.current) pdfRef.current.value = ''; }}
                className="px-5 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editQ && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{background:"rgba(255,255,255,0.97)",backdropFilter:"blur(16px)"}}>
              <h3 className="font-bold text-slate-800 mb-4">✏️ Edit Soal</h3>
              <div className="space-y-3">
                <textarea value={editQ.question} onChange={e => setEditQ(p => p && ({ ...p, question: e.target.value }))}
                  rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" placeholder="Pertanyaan" />
                {(['a','b','c','d'] as const).map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${editQ.correct_answer === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{opt.toUpperCase()}</span>
                    <input value={(editQ as any)[`option_${opt}`]} onChange={e => setEditQ(p => p && ({ ...p, [`option_${opt}`]: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    <button onClick={() => setEditQ(p => p && ({ ...p, correct_answer: opt.toUpperCase() as any }))}
                      className={`text-xs px-2 py-1 rounded-lg font-semibold transition-all ${editQ.correct_answer === opt.toUpperCase() ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-500 hover:bg-green-50'}`}>
                      Benar
                    </button>
                  </div>
                ))}
                <select value={editQ.difficulty} onChange={e => setEditQ(p => p && ({ ...p, difficulty: e.target.value as any }))}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={handleSaveEdit} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all">Simpan</button>
                <button onClick={() => setEditQ(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">Batal</button>
              </div>
            </div>
          </div>
        )}

        {/* Question List */}
        <div className="space-y-3">
          {questions.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🧩</div>
              <p className="font-semibold">Belum ada soal</p>
              <p className="text-sm mt-1">Generate soal dengan AI atau pilih materi dahulu</p>
            </div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 group hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 flex-shrink-0 mt-0.5">{idx+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                  <div className="grid grid-cols-2 gap-1.5 mt-3">
                    {(['a','b','c','d'] as const).map(opt => (
                      <div key={opt} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${q.correct_answer === opt.toUpperCase() ? 'bg-green-50 border border-green-200 text-green-700 font-bold' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 ${q.correct_answer === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-slate-300 text-white'}`}>{opt.toUpperCase()}</span>
                        <span className="truncate">{(q as any)[`option_${opt}`]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DIFF_COLOR[q.difficulty]}`}>{q.difficulty}</span>
                    <span className="text-xs text-slate-400">{q.materi_name}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => setEditQ(q)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Quiz Sessions ─────────────────────────────────────────────────────

function SessionsPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    session_name: '', material_id: '', question_count: 10,
    timer_minutes: 30, passing_grade: 70, allow_retake: true, scheduled_at: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }, { data: q }] = await Promise.all([
      supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('lc_materials').select('*').order('materi_name'),
      supabase.from('lc_questions').select('id, material_id, difficulty'),
    ]);
    setSessions(s ?? []); setMaterials(m ?? []); setQuestions(q ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.session_name.trim()) return alert('Nama sesi wajib diisi!');
    if (!form.material_id) return alert('Pilih materi!');
    const mat = materials.find(m => m.id === form.material_id);
    const pool = questions.filter(q => q.material_id === form.material_id);
    if (pool.length < form.question_count) return alert(`Hanya ada ${pool.length} soal. Kurangi jumlah soal atau generate lebih banyak.`);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, form.question_count);
    setSaving(true);
    const { error } = await supabase.from('lc_quiz_sessions').insert([{
      session_name: form.session_name, material_id: form.material_id, materi_name: mat?.materi_name ?? '',
      question_ids: shuffled.map(q => q.id), question_count: form.question_count,
      timer_minutes: form.timer_minutes || null, passing_grade: form.passing_grade,
      allow_retake: form.allow_retake, is_active: true, created_by: user.id,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    }]);
    setSaving(false);
    if (error) return alert('Error: ' + error.message);
    setShowForm(false);
    setForm({ session_name: '', material_id: '', question_count: 10, timer_minutes: 30, passing_grade: 70, allow_retake: true, scheduled_at: '' });
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('lc_quiz_sessions').update({ is_active: !current }).eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus sesi quiz ini? Semua jawaban akan ikut terhapus.')) return;
    await supabase.from('lc_quiz_sessions').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <PageHeader title="🎯 Sesi Quiz" subtitle="Buat & kelola sesi quiz untuk team"
        action={
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
            + Buat Sesi Quiz
          </button>
        }
      />
      <div className="p-8 space-y-6">
        {showForm && (
          <div className="rounded-2xl border border-emerald-100 shadow-lg p-6" style={{background:"rgba(255,255,255,0.94)",backdropFilter:"blur(12px)"}}>
            <h3 className="font-bold text-slate-800 mb-5">📋 Form Sesi Quiz Baru</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Sesi *</label>
                <input value={form.session_name} onChange={e => setForm(p => ({ ...p, session_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                  placeholder="contoh: Quiz Microvision — Batch 1 — Mei 2025" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
                <select value={form.material_id} onChange={e => setForm(p => ({ ...p, material_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
                  <option value="">-- Pilih Materi --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.materi_name} ({questions.filter(q => q.material_id === m.id).length} soal)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jumlah Soal</label>
                <input type="number" min={1} max={100} value={form.question_count}
                  onChange={e => setForm(p => ({ ...p, question_count: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Timer (menit, 0 = tanpa timer)</label>
                <input type="number" min={0} value={form.timer_minutes}
                  onChange={e => setForm(p => ({ ...p, timer_minutes: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Passing Grade (%)</label>
                <input type="number" min={0} max={100} value={form.passing_grade}
                  onChange={e => setForm(p => ({ ...p, passing_grade: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jadwal (opsional)</label>
                <input type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.allow_retake} onChange={e => setForm(p => ({ ...p, allow_retake: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                  <span className="text-sm font-medium text-slate-700">Boleh Retake</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60">
                {saving ? 'Membuat...' : '🎯 Buat Sesi Quiz'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">Batal</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {sessions.length === 0 && !showForm && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🎯</div>
              <p className="font-semibold">Belum ada sesi quiz</p>
            </div>
          )}
          {sessions.map(s => (
            <div key={s.id} className="rounded-2xl border border-white/60 shadow-sm p-5" style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-800">{s.session_name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${s.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {s.is_active ? '🟢 Aktif' : '⭕ Non-aktif'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.materi_name}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    <span>📝 {s.question_count} soal</span>
                    <span>⏱️ {s.timer_minutes ? `${s.timer_minutes} mnt` : 'No timer'}</span>
                    <span>🎯 Passing: {s.passing_grade}%</span>
                    <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
                    <span>📅 {fmtDate(s.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(s.id, s.is_active)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${s.is_active ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                    {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Team ──────────────────────────────────────────────────────────────

function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const load = useCallback(async () => {
    const [{ data: u }, { data: a }] = await Promise.all([
      supabase.from('users').select('id, full_name, username, role, jabatan, sales_division').order('full_name'),
      supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
    ]);
    setUsers((u ?? []).filter((u: any) => u.role !== 'guest'));
    setAttempts(a ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (selectedUser) {
    return <UserAnswerReview user={selectedUser} onBack={() => setSelectedUser(null)} isAdminView={true} />;
  }

  return (
    <div>
      <PageHeader title="👥 Team" subtitle="Daftar anggota team & partisipasi quiz" />
      <div className="p-8">
        <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden" style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200" style={{background:"rgba(248,250,252,0.95)"}}>
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Nama</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Role</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz Diikuti</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Rata-rata Skor</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Pass Rate</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const ua = attempts.filter((a: any) => a.user_id === u.id);
                const avg = ua.length ? ua.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / ua.length : null;
                const passed = ua.filter((a: any) => a.passed).length;
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {u.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">{ua.length}</td>
                    <td className="px-5 py-3.5 text-center">
                      {avg !== null ? <span className={`font-bold ${avg >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>{avg.toFixed(1)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {ua.length ? <span className="text-xs font-bold text-indigo-600">{Math.round(passed/ua.length*100)}%</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {ua.length > 0 && (
                        <button onClick={() => setSelectedUser(u)}
                          className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                          👁️ Lihat Jawaban
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Answer Review Component ──────────────────────────────────────────────────
// Admin bisa lihat jawaban siapapun, Team hanya bisa lihat punya sendiri

function UserAnswerReview({ user, onBack, isAdminView }: { user: User; onBack: () => void; isAdminView: boolean }) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [answerDetails, setAnswerDetails] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('lc_quiz_attempts')
        .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
        .eq('user_id', user.id)
        .eq('is_submitted', true)
        .order('submitted_at', { ascending: false });
      setAttempts(data ?? []);
    };
    load();
  }, [user.id]);

  const handleViewDetail = async (attempt: any) => {
    setSelectedAttempt(attempt);
    setLoadingDetail(true);
    const questionIds: string[] = attempt.lc_quiz_sessions?.question_ids ?? [];

    const [{ data: ans }, { data: qs }] = await Promise.all([
      supabase.from('lc_answers').select('*').eq('attempt_id', attempt.id),
      questionIds.length > 0
        ? supabase.from('lc_questions').select('*').in('id', questionIds)
        : Promise.resolve({ data: [] }),
    ]);

    const orderedQs = questionIds.map((id: string) => (qs ?? []).find((q: any) => q.id === id)).filter(Boolean) as Question[];
    setQuestions(orderedQs);
    setAnswerDetails(ans ?? []);
    setLoadingDetail(false);
  };

  const getAnswerFor = (questionId: string) => answerDetails.find(a => a.question_id === questionId);

  if (selectedAttempt) {
    return (
      <div>
        <PageHeader
          title={`📋 Review Jawaban — ${user.full_name}`}
          subtitle={selectedAttempt.lc_quiz_sessions?.session_name}
          action={
            <button onClick={() => setSelectedAttempt(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2">
              ← Kembali
            </button>
          }
        />
        <div className="p-8">
          {/* Score summary */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Skor', value: selectedAttempt.score?.toFixed(0) ?? '—', color: (selectedAttempt.score ?? 0) >= (selectedAttempt.lc_quiz_sessions?.passing_grade ?? 70) ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600' },
              { label: 'Benar', value: `${selectedAttempt.total_correct}/${selectedAttempt.total_questions}`, color: 'from-blue-500 to-blue-600' },
              { label: 'Status', value: selectedAttempt.passed ? 'LULUS' : 'TIDAK LULUS', color: selectedAttempt.passed ? 'from-emerald-500 to-emerald-600' : 'from-rose-500 to-rose-600' },
              { label: 'Waktu', value: selectedAttempt.time_taken_sec ? `${Math.floor(selectedAttempt.time_taken_sec/60)}m ${selectedAttempt.time_taken_sec%60}s` : '—', color: 'from-indigo-500 to-indigo-600' },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-4 text-white shadow-lg text-center`}>
                <div className="text-2xl font-black">{c.value}</div>
                <div className="text-white/80 text-xs font-medium mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          {loadingDetail ? (
            <div className="text-center py-10 text-slate-400">Memuat detail jawaban...</div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const ans = getAnswerFor(q.id);
                const userAnswer = ans?.answer ?? null;
                const isCorrect = userAnswer === q.correct_answer;
                const notAnswered = !userAnswer;
                return (
                  <div key={q.id} className={`rounded-2xl border-2 shadow-sm p-5 ${notAnswered ? 'border-slate-200' : isCorrect ? 'border-emerald-300 bg-emerald-50/30' : 'border-rose-300 bg-rose-50/30'}`}
                    style={{background: notAnswered ? 'rgba(255,255,255,0.90)' : undefined, backdropFilter:'blur(8px)'}}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white ${notAnswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {notAnswered ? '—' : isCorrect ? '✓' : '✗'}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-500 mb-1">Soal {idx+1} · <span className={`${DIFF_COLOR[q.difficulty].split(' ')[1]}`}>{q.difficulty}</span></p>
                        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 ml-10">
                      {(['A','B','C','D'] as const).map(opt => {
                        const optVal = (q as any)[`option_${opt.toLowerCase()}`];
                        const isUserChoice = userAnswer === opt;
                        const isCorrectOpt = q.correct_answer === opt;
                        let style = 'bg-white border-slate-200 text-slate-600';
                        if (isCorrectOpt) style = 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold';
                        if (isUserChoice && !isCorrectOpt) style = 'bg-rose-50 border-rose-400 text-rose-800 font-bold';
                        return (
                          <div key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs transition-all ${style}`}>
                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isCorrectOpt ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{opt}</span>
                            <span className="flex-1">{optVal}</span>
                            {isCorrectOpt && <span className="text-emerald-600 font-bold">✓ Benar</span>}
                            {isUserChoice && !isCorrectOpt && <span className="text-rose-600 font-bold">← Pilihan</span>}
                          </div>
                        );
                      })}
                    </div>
                    {notAnswered && <p className="ml-10 mt-2 text-xs text-slate-400 italic">Tidak dijawab</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isAdminView ? `👁️ Jawaban — ${user.full_name}` : '📋 Lihat Jawaban Saya'}
        subtitle="Pilih quiz untuk melihat detail jawaban"
        action={
          <button onClick={onBack}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2">
            ← Kembali
          </button>
        }
      />
      <div className="p-8 space-y-4">
        {attempts.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-semibold">Belum ada quiz yang diselesaikan</p>
          </div>
        )}
        {attempts.map(a => (
          <div key={a.id} className="rounded-2xl border border-white/60 shadow-sm p-5 flex items-center gap-5"
            style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 ${a.passed ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
              {a.score?.toFixed(0) ?? '—'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</h4>
              <p className="text-sm text-slate-500">{a.lc_quiz_sessions?.materi_name ?? '-'}</p>
              <div className="flex gap-3 mt-1 text-xs text-slate-400">
                <span>✅ {a.total_correct}/{a.total_questions} benar</span>
                <span>🎯 Passing: {a.lc_quiz_sessions?.passing_grade ?? 70}%</span>
                {a.time_taken_sec && <span>⏱️ {Math.floor(a.time_taken_sec/60)}m {a.time_taken_sec%60}s</span>}
                <span>📅 {a.submitted_at ? fmtDate(a.submitted_at) : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                {a.passed ? '✅ LULUS' : '❌ TIDAK LULUS'}
              </span>
              <button onClick={() => handleViewDetail(a)}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5">
                👁️ Detail Jawaban
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADMIN: Report ────────────────────────────────────────────────────────────

function ReportPage({ currentUser }: { currentUser: User }) {
  const [data, setData] = useState<any[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [viewingUser, setViewingUser] = useState<{ user: User; attemptId: string } | null>(null);

  useEffect(() => {
    supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false })
      .then(({ data: s }) => setSessions(s ?? []));
  }, []);

  useEffect(() => {
    if (!selectedSession) { setData([]); return; }
    supabase.from('lc_quiz_attempts')
      .select('*, users(id, full_name, username, jabatan, role)')
      .eq('quiz_session_id', selectedSession).eq('is_submitted', true)
      .order('score', { ascending: false })
      .then(({ data: a }) => setData(a ?? []));
  }, [selectedSession]);

  const session = sessions.find(s => s.id === selectedSession);

  if (viewingUser) {
    return <UserAnswerReview user={viewingUser.user} onBack={() => setViewingUser(null)} isAdminView={true} />;
  }

  return (
    <div>
      <PageHeader title="📋 Laporan" subtitle="Hasil quiz per sesi" />
      <div className="p-8 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Pilih Sesi Quiz</label>
          <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white min-w-[320px]">
            <option value="">-- Pilih Sesi --</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
          </select>
        </div>

        {data.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Peserta', value: data.length },
                { label: 'Rata-rata', value: (data.reduce((s: number, a: any) => s+(a.score??0),0)/data.length).toFixed(1) },
                { label: 'Lulus', value: data.filter((a: any) => a.passed).length },
                { label: 'Pass Rate', value: `${Math.round(data.filter((a: any) => a.passed).length/data.length*100)}%` },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-slate-800">{c.value}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">{c.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden" style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200" style={{background:"rgba(248,250,252,0.95)"}}>
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Peserta</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Waktu</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((a: any, i: number) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mx-auto ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'text-slate-400'}`}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : i+1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{a.users?.full_name}</td>
                      <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                      <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={session?.passing_grade ?? 70} /></td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                          {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{a.time_taken_sec ? `${Math.floor(a.time_taken_sec/60)}m ${a.time_taken_sec%60}s` : '—'}</td>
                      <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        {a.users && (
                          <button
                            onClick={() => setViewingUser({ user: a.users as User, attemptId: a.id })}
                            className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                            👁️ Jawaban
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selectedSession && data.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-semibold">Belum ada peserta yang submit</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN: Analytics ─────────────────────────────────────────────────────────

function AnalyticsPage() {
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: a } = await supabase.from('lc_quiz_attempts').select('user_id, score, passed, users(full_name)').eq('is_submitted', true);
      if (a) {
        const byUser: Record<string, { name: string; scores: number[]; passed: number }> = {};
        a.forEach((att: any) => {
          if (!byUser[att.user_id]) byUser[att.user_id] = { name: att.users?.full_name ?? '-', scores: [], passed: 0 };
          byUser[att.user_id].scores.push(att.score ?? 0);
          if (att.passed) byUser[att.user_id].passed++;
        });
        const top = Object.entries(byUser).map(([uid, v]) => ({
          uid, name: v.name,
          avg: v.scores.reduce((s: number, n: number) => s + n, 0) / v.scores.length,
          total: v.scores.length, passed: v.passed,
        })).sort((a, b) => b.avg - a.avg).slice(0, 10);
        setTopUsers(top);
      }
      const { data: ss } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (ss) {
        const stats = await Promise.all(ss.map(async (s: any) => {
          const { data: att, count } = await supabase.from('lc_quiz_attempts').select('score, passed', { count: 'exact' }).eq('quiz_session_id', s.id).eq('is_submitted', true);
          const avg = att?.length ? att.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / att.length : 0;
          const passed = att?.filter((a: any) => a.passed).length ?? 0;
          return { name: s.session_name, total: count ?? 0, avg, passed };
        }));
        setSessionStats(stats.filter((s: any) => s.total > 0));
      }
    };
    load();
  }, []);

  return (
    <div>
      <PageHeader title="📈 Analytics" subtitle="Performa team & statistik quiz" />
      <div className="p-8 space-y-8">
        <div>
          <h3 className="font-bold text-slate-800 mb-4">🏆 Top Performers</h3>
          <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden" style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200" style={{background:"rgba(248,250,252,0.95)"}}>
                <tr>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Nama</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Avg Score</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Lulus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topUsers.map((u, i) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-center text-sm font-black text-slate-400">{i+1}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="px-5 py-3 text-center text-slate-600">{u.total}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`font-black text-base ${u.avg >= 80 ? 'text-emerald-600' : u.avg >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{u.avg.toFixed(1)}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-indigo-600 font-bold">{u.passed}</td>
                  </tr>
                ))}
                {topUsers.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">Belum ada data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {sessionStats.length > 0 && (
          <div>
            <h3 className="font-bold text-slate-800 mb-4">📊 Statistik Per Sesi</h3>
            <div className="grid grid-cols-1 gap-3">
              {sessionStats.map(s => (
                <div key={s.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-sm truncate">{s.name}</span>
                    <div className="flex gap-3 text-xs flex-shrink-0">
                      <span className="text-slate-500">{s.total} peserta</span>
                      <span className="font-bold text-indigo-600">avg: {s.avg.toFixed(1)}</span>
                      <span className="font-bold text-emerald-600">{s.passed} lulus</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(s.avg, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TEAM: My Quiz ────────────────────────────────────────────────────────────

function MyQuizPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [activeAttempts, setActiveAttempts] = useState<Record<string, QuizAttempt>>({});
  const [playingSession, setPlayingSession] = useState<QuizSession | null>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('lc_quiz_sessions').select('*').eq('is_active', true).order('created_at', { ascending: false });
    setSessions(s ?? []);
    const { data: a } = await supabase.from('lc_quiz_attempts').select('*').eq('user_id', user.id).eq('is_submitted', false);
    const map: Record<string, QuizAttempt> = {};
    (a ?? []).forEach((att: any) => { map[att.quiz_session_id] = att; });
    setActiveAttempts(map);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const handleStart = async (session: QuizSession) => {
    if (activeAttempts[session.id]) { setPlayingSession(session); return; }
    if (!session.allow_retake) {
      const { data: prev } = await supabase.from('lc_quiz_attempts')
        .select('id').eq('user_id', user.id).eq('quiz_session_id', session.id).eq('is_submitted', true);
      if (prev && prev.length > 0) { alert('Quiz ini tidak mengizinkan retake. Kamu sudah pernah submit.'); return; }
    }
    const { data: att, error } = await supabase.from('lc_quiz_attempts').insert([{
      user_id: user.id, quiz_session_id: session.id, total_questions: session.question_count,
    }]).select().single();
    if (error || !att) return alert('Gagal memulai quiz: ' + error?.message);
    await load();
    setPlayingSession(session);
  };

  if (playingSession) {
    return <QuizPlayer session={playingSession} user={user}
      attempt={activeAttempts[playingSession.id]!}
      onDone={() => { setPlayingSession(null); load(); }} />;
  }

  return (
    <div>
      <PageHeader title="📝 My Quiz" subtitle="Quiz yang tersedia untuk kamu" />
      <div className="p-8 grid grid-cols-1 gap-4">
        {sessions.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🎯</div>
            <p className="font-semibold">Belum ada quiz aktif</p>
            <p className="text-sm mt-1">Tunggu admin membuat sesi quiz baru</p>
          </div>
        )}
        {sessions.map(s => {
          const inProgress = activeAttempts[s.id];
          return (
            <div key={s.id} className="rounded-2xl border border-white/60 shadow-sm p-6 flex items-start gap-5 hover:shadow-md transition-all"
              style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-lg">{s.session_name}</h4>
                <p className="text-sm text-slate-500 mt-1">{s.materi_name}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                  <span>📝 {s.question_count} soal</span>
                  <span>⏱️ {s.timer_minutes ? `${s.timer_minutes} mnt` : 'No timer'}</span>
                  <span>🎯 Passing: {s.passing_grade}%</span>
                  <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
                </div>
                {inProgress && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                      ⏳ Sedang Berlangsung
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => handleStart(s)}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl shadow transition-all flex-shrink-0 ${inProgress ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                {inProgress ? '▶️ Lanjutkan' : '🚀 Mulai Quiz'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quiz Player ──────────────────────────────────────────────────────────────

function QuizPlayer({ session, user, attempt, onDone }: {
  session: QuizSession; user: User; attempt: QuizAttempt; onDone: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; passed: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(session.timer_minutes ? session.timer_minutes * 60 : null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      if (!session.question_ids?.length) return;
      const { data } = await supabase.from('lc_questions').select('*').in('id', session.question_ids);
      const ordered = session.question_ids.map(id => data?.find((q: any) => q.id === id)).filter(Boolean) as Question[];
      setQuestions(ordered);
    };
    load();
    const loadAnswers = async () => {
      const { data } = await supabase.from('lc_answers').select('*').eq('attempt_id', attempt.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach((a: any) => { map[a.question_id] = a.answer; });
      setSavedAnswers(map);
      setAnswers(map);
    };
    loadAnswers();
  }, []);

  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setInterval(() => setTimeLeft(p => (p ?? 1) - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, submitted]);

  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden && !submitted) {
        setTabSwitches(p => {
          const next = p + 1;
          supabase.from('lc_quiz_attempts').update({ tab_switches: next }).eq('id', attempt.id);
          if (next >= 3) alert('⚠️ Peringatan: Kamu telah berpindah tab sebanyak ' + next + ' kali. Data ini direkam admin.');
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [submitted]);

  const handleAnswer = async (questionId: string, answer: string) => {
    setAnswers(p => ({ ...p, [questionId]: answer }));
    const existing = savedAnswers[questionId];
    if (existing) {
      await supabase.from('lc_answers').update({ answer, answered_at: new Date().toISOString() })
        .eq('attempt_id', attempt.id).eq('question_id', questionId);
    } else {
      const q = questions.find(q => q.id === questionId);
      await supabase.from('lc_answers').insert([{
        attempt_id: attempt.id, user_id: user.id, quiz_session_id: session.id,
        question_id: questionId, answer, is_correct: q?.correct_answer === answer,
      }]);
      setSavedAnswers(p => ({ ...p, [questionId]: answer }));
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !confirm('Submit jawaban? Pastikan semua soal sudah dijawab.')) return;
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
    let correct = 0;
    questions.forEach(q => { if ((answers[q.id] ?? savedAnswers[q.id]) === q.correct_answer) correct++; });
    const score = questions.length ? (correct / questions.length) * 100 : 0;
    const passed = score >= session.passing_grade;

    await Promise.all(questions.map(q => {
      const ans = answers[q.id] ?? savedAnswers[q.id];
      if (!ans) return;
      return supabase.from('lc_answers').update({ is_correct: ans === q.correct_answer })
        .eq('attempt_id', attempt.id).eq('question_id', q.id);
    }));

    await supabase.from('lc_quiz_attempts').update({
      submitted_at: new Date().toISOString(), score, total_correct: correct,
      total_questions: questions.length, passed, is_submitted: true, time_taken_sec: timeTaken,
    }).eq('id', attempt.id);

    setResult({ score, correct, passed });
    setSubmitted(true);
  };

  const fmtTimer = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // Result screen with review option
  if (submitted && result) {
    if (showReview) {
      return (
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
            <div>
              <h2 className="font-bold text-slate-800">📋 Review Jawaban</h2>
              <p className="text-xs text-slate-500">{session.session_name} · Skor {result.score.toFixed(0)}</p>
            </div>
            <button onClick={() => setShowReview(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all">
              ← Kembali ke Hasil
            </button>
          </div>
          <div className="p-8 space-y-4">
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id] ?? savedAnswers[q.id] ?? null;
              const isCorrect = userAnswer === q.correct_answer;
              const notAnswered = !userAnswer;
              return (
                <div key={q.id} className={`rounded-2xl border-2 p-5 ${notAnswered ? 'border-slate-200 bg-white' : isCorrect ? 'border-emerald-300 bg-emerald-50/30' : 'border-rose-300 bg-rose-50/30'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 text-white ${notAnswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                      {notAnswered ? '—' : isCorrect ? '✓' : '✗'}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500 mb-1">Soal {idx+1}</p>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 ml-10">
                    {(['A','B','C','D'] as const).map(opt => {
                      const optVal = (q as any)[`option_${opt.toLowerCase()}`];
                      const isUserChoice = userAnswer === opt;
                      const isCorrectOpt = q.correct_answer === opt;
                      let style = 'bg-white border-slate-200 text-slate-600';
                      if (isCorrectOpt) style = 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold';
                      if (isUserChoice && !isCorrectOpt) style = 'bg-rose-50 border-rose-400 text-rose-800 font-bold';
                      return (
                        <div key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs ${style}`}>
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isCorrectOpt ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{opt}</span>
                          <span className="flex-1">{optVal}</span>
                          {isCorrectOpt && <span className="text-emerald-600">✓</span>}
                          {isUserChoice && !isCorrectOpt && <span className="text-rose-600">←</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 max-w-md w-full text-center">
          <div className="text-6xl mb-4">{result.passed ? '🎉' : '😔'}</div>
          <h2 className="text-2xl font-black text-slate-800 mb-1">{result.passed ? 'Selamat, Lulus!' : 'Belum Lulus'}</h2>
          <p className="text-slate-500 text-sm mb-6">{session.session_name}</p>
          <div className={`text-6xl font-black mb-2 ${result.passed ? 'text-emerald-500' : 'text-rose-500'}`}>{result.score.toFixed(0)}</div>
          <p className="text-slate-500 text-sm mb-8">Benar {result.correct} dari {questions.length} soal · Passing {session.passing_grade}%</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowReview(true)}
              className="px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-xl shadow transition-all">
              📋 Review Jawaban
            </button>
            <button onClick={onDone}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-all">
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-400">Memuat soal...</div>;
  }

  const q = questions[current];
  const answered = Object.keys(answers).filter(k => answers[k]).length;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h2 className="font-bold text-slate-800">{session.session_name}</h2>
            <p className="text-xs text-slate-500">{answered}/{questions.length} soal dijawab</p>
          </div>
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm border ${timeLeft < 60 ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                ⏱️ {fmtTimer(timeLeft)}
              </div>
            )}
            <button onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition-all">
              ✅ Submit
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Soal {current+1} dari {questions.length}</span>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${((current+1)/questions.length)*100}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/60 shadow-sm p-6 mb-6" style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
              <p className="text-base font-semibold text-slate-800 leading-relaxed">{q.question}</p>
            </div>
            <div className="space-y-3">
              {(['A','B','C','D'] as const).map(opt => {
                const val = (q as any)[`option_${opt.toLowerCase()}`];
                const selected = (answers[q.id] ?? savedAnswers[q.id]) === opt;
                return (
                  <button key={opt} onClick={() => handleAnswer(q.id, opt)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all font-medium text-sm
                      ${selected ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${selected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {opt}
                    </span>
                    {val}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setCurrent(p => Math.max(0, p-1))} disabled={current === 0}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-40">
                ← Sebelumnya
              </button>
              <button onClick={() => setCurrent(p => Math.min(questions.length-1, p+1))} disabled={current === questions.length-1}
                className="px-5 py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-40">
                Berikutnya →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigator */}
      <div className="w-52 bg-white border-l border-slate-200 p-4 overflow-y-auto flex-shrink-0">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">Navigasi Soal</p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((_, i) => {
            const ans = answers[questions[i].id] ?? savedAnswers[questions[i].id];
            return (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-full aspect-square rounded-lg text-xs font-bold transition-all
                  ${i === current ? 'bg-indigo-500 text-white shadow' : ans ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {i+1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300 flex-shrink-0" />Terjawab</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 flex-shrink-0" />Belum</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-indigo-500 flex-shrink-0" />Aktif</div>
        </div>
        {tabSwitches > 0 && (
          <div className="mt-4 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
            ⚠️ Tab switches: {tabSwitches}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TEAM: History ────────────────────────────────────────────────────────────

function HistoryPage({ user }: { user: User }) {
  const [history, setHistory] = useState<any[]>([]);
  const [viewingAttempt, setViewingAttempt] = useState<any | null>(null);

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => setHistory(data ?? []));
  }, [user.id]);

  if (viewingAttempt) {
    return <UserAnswerReview user={user} onBack={() => setViewingAttempt(null)} isAdminView={false} />;
  }

  return (
    <div>
      <PageHeader title="🕐 Riwayat Quiz" subtitle="Semua quiz yang pernah kamu ikuti" />
      <div className="p-8">
        <div className="space-y-4">
          {history.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🕐</div>
              <p className="font-semibold">Belum ada riwayat quiz</p>
            </div>
          )}
          {history.map(a => (
            <div key={a.id} className="rounded-2xl border border-white/60 shadow-sm p-5 flex items-center gap-5"
              style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 ${a.passed ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
                {a.score?.toFixed(0) ?? '—'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</h4>
                <p className="text-sm text-slate-500">{a.lc_quiz_sessions?.materi_name ?? '-'}</p>
                <div className="flex gap-3 mt-1.5 text-xs text-slate-400">
                  <span>✅ {a.total_correct}/{a.total_questions} benar</span>
                  <span>🎯 Passing: {a.lc_quiz_sessions?.passing_grade ?? 70}%</span>
                  {a.time_taken_sec && <span>⏱️ {Math.floor(a.time_taken_sec/60)}m {a.time_taken_sec%60}s</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-3">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                    {a.passed ? '✅ LULUS' : '❌ TIDAK LULUS'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1.5">{a.submitted_at ? fmtDate(a.submitted_at) : ''}</p>
                </div>
                <button onClick={() => setViewingAttempt(a)}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5">
                  📋 Lihat Jawaban
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TEAM: Score ──────────────────────────────────────────────────────────────

function ScorePage({ user }: { user: User }) {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [viewingAttempt, setViewingAttempt] = useState<any | null>(null);

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name, question_ids)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .then(({ data }) => setAttempts(data ?? []));
  }, [user.id]);

  const avg = attempts.length ? attempts.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / attempts.length : 0;
  const passed = attempts.filter((a: any) => a.passed).length;

  if (viewingAttempt) {
    return <UserAnswerReview user={user} onBack={() => setViewingAttempt(null)} isAdminView={false} />;
  }

  return (
    <div>
      <PageHeader title="🏆 Nilai Saya" subtitle="Rekap performa quiz kamu" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-3 gap-5">
          {[
            { label: 'Quiz Diikuti', value: attempts.length, icon: '📝', color: 'from-blue-500 to-blue-600' },
            { label: 'Rata-rata Skor', value: avg.toFixed(1), icon: '📊', color: 'from-indigo-500 to-indigo-600' },
            { label: 'Total Lulus', value: passed, icon: '✅', color: 'from-emerald-500 to-emerald-600' },
          ].map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden" style={{background:"rgba(255,255,255,0.90)",backdropFilter:"blur(8px)"}}>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Rekap Nilai Per Quiz</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200" style={{background:"rgba(248,250,252,0.95)"}}>
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Belum ada quiz yang diselesaikan</td></tr>
              )}
              {attempts.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</td>
                  <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} /></td>
                  <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                      {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    <button onClick={() => setViewingAttempt(a)}
                      className="px-2 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
                      📋 Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
