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
  // Target delivery
  target_user_ids: string[] | null;   // null = semua user, array = user tertentu
  open_at: string | null;             // waktu quiz mulai bisa diakses
  close_at: string | null;            // waktu quiz ditutup otomatis
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

type AdminView = 'dashboard' | 'materi' | 'bank-soal' | 'questions' | 'sessions' | 'team' | 'report' | 'analytics';
type TeamView = 'my-quiz' | 'materi' | 'bank-soal' | 'history' | 'score';

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
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [teamView, setTeamView] = useState<TeamView>('my-quiz');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('Auth Error:', authError);
          setError('Authentication error: ' + authError.message);
          setIsLoading(false);
          return;
        }
        
        if (!user) {
          console.warn('No authenticated user');
          setError('Tidak ada user yang login. Silakan login terlebih dahulu.');
          setIsLoading(false);
          return;
        }

        const { data, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (dbError) {
          console.error('Database Error:', dbError);
          setError('Database error: ' + dbError.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          console.warn('User data not found in database');
          setError('Data user tidak ditemukan di database. Silakan hubungi administrator.');
          setIsLoading(false);
          return;
        }

        setCurrentUser(data);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Unexpected Error:', err);
        setError('Unexpected error: ' + err?.message);
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Error state
  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md text-center border-l-4 border-red-500">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-red-600 mb-3">Terjadi Kesalahan</h2>
          <p className="text-slate-600 text-sm mb-6 font-mono bg-red-50 p-3 rounded border border-red-200">{error}</p>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
              🔄 Reload
            </button>
            <button onClick={() => window.location.href = '/'}
              className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-colors">
              🏠 Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || !currentUser) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Memuat Learning Center...</h2>
          <p className="text-slate-500">Mohon tunggu sebentar</p>
        </div>
      </div>
    );
  }

  // Success - render based on role
  if (currentUser.role === 'admin') {
    return (
      <AdminLearningCenter user={currentUser} view={adminView} setView={setAdminView} />
    );
  }

  return <TeamLearningCenter user={currentUser} view={teamView} setView={setTeamView} />;
}

// ─── PAGE HEADER ──────────────────────────────────────────────────────────────

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-8 py-8 border-b border-slate-700">
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="text-slate-300 mt-1">{subtitle}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ─── ADMIN LEARNING CENTER ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════════

function AdminLearningCenter({ user, view, setView }: { user: User; view: AdminView; setView: (v: AdminView) => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navbar user={user} />
      
      <div className="flex">
        <AdminSidebar view={view} setView={setView} />
        <div className="flex-1">
          {view === 'dashboard' && <AdminDashboard user={user} />}
          {view === 'materi' && <AdminMateriPage user={user} />}
          {view === 'bank-soal' && <BankSoalPage user={user} isAdmin={true} />}
          {view === 'questions' && <AdminQuestionsPage user={user} />}
          {view === 'sessions' && <AdminSessionsPage user={user} />}
          {view === 'team' && <AdminTeamPage user={user} />}
        </div>
      </div>
    </div>
  );
}

function AdminSidebar({ view, setView }: { view: AdminView; setView: (v: AdminView) => void }) {
  const items: { label: string; icon: string; view: AdminView }[] = [
    { label: 'Dashboard', icon: '📊', view: 'dashboard' },
    { label: 'Materi', icon: '📚', view: 'materi' },
    { label: 'Bank Soal', icon: '🏦', view: 'bank-soal' },
    { label: 'Sesi Quiz', icon: '🎯', view: 'sessions' },
    { label: 'Tim', icon: '👥', view: 'team' },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 p-4 sticky top-20 h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-2">
        {items.map(item => (
          <button key={item.view} onClick={() => setView(item.view)}
            className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${view === item.view ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Navbar({ user }: { user: User }) {
  return (
    <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center text-white font-bold">🎓</div>
        <div>
          <h1 className="font-black text-lg">Learning Center</h1>
          <p className="text-xs text-slate-500">{user.role === 'admin' ? 'ADMIN PORTAL' : 'TEAM PORTAL'}</p>
        </div>
      </div>
      <div className="text-sm text-slate-600">{user.full_name}</div>
    </div>
  );
}

// ─── ADMIN: Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState({ materials: 0, questions: 0, sessions: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const results: Array<{ error?: any; count?: number | null }> = await Promise.all([
          supabase.from('lc_materials').select('id', { count: 'exact' }),
          supabase.from('lc_questions').select('id', { count: 'exact' }),
          supabase.from('lc_quiz_sessions').select('id', { count: 'exact' }),
          supabase.from('users').select('id', { count: 'exact' }),
        ]);

        // Check for errors
        const hasError = results.some((r: any) => r.error);
        if (hasError) {
          const errorMsg = results.find((r: any) => r.error)?.error?.message ?? 'Unknown error';
          throw new Error(errorMsg);
        }

        setStats({
          materials: (results[0] as any).count ?? 0,
          questions: (results[1] as any).count ?? 0,
          sessions: (results[2] as any).count ?? 0,
          users: (results[3] as any).count ?? 0,
        });
        setLoading(false);
      } catch (err: any) {
        console.error('Stats loading error:', err);
        setError(err?.message ?? 'Failed to load statistics');
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div>
      <PageHeader title="📊 Dashboard" subtitle="Ringkasan aktivitas learning center" />
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}
        <div className="grid grid-cols-4 gap-5">
          {[
            { label: 'Total Materi', value: loading ? '—' : stats.materials, icon: '📚', color: 'from-blue-500 to-blue-600' },
            { label: 'Total Soal', value: loading ? '—' : stats.questions, icon: '❓', color: 'from-amber-500 to-amber-600' },
            { label: 'Sesi Quiz', value: loading ? '—' : stats.sessions, icon: '🎯', color: 'from-purple-500 to-purple-600' },
            { label: 'Pengguna', value: loading ? '—' : stats.users, icon: '👥', color: 'from-emerald-500 to-emerald-600' },
          ].map((item, idx) => (
            <div key={idx} className={`bg-gradient-to-br ${item.color} rounded-2xl p-6 text-white shadow-lg`}>
              <div className="text-4xl mb-3">{item.icon}</div>
              <div className="text-4xl font-black">{item.value}</div>
              <div className="text-white/80 text-sm font-medium mt-2">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Materi (Windows Folder Style) ──────────────────────────────────

function AdminMateriPage({ user }: { user: User }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: dbError } = await supabase.from('lc_materials').select('*');
        
        if (dbError) {
          throw new Error(dbError.message);
        }
        
        setMaterials(data ?? []);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading materials:', err);
        setError(err?.message ?? 'Failed to load materials');
        setLoading(false);
      }
    };

    loadMaterials();
  }, []);

  const root = buildFolderTree(materials);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderFolderTree = (node: FolderNode, depth = 0): React.ReactNode[] => {
    const items: React.ReactNode[] = [];
    const folders = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
    const materials_sorted = node.materials.sort((a, b) => (a.materi_name ?? '').localeCompare(b.materi_name ?? ''));

    // Render folders
    folders.forEach(folder => {
      const hasContent = Object.keys(folder.children).length > 0 || folder.materials.length > 0;
      const isExpanded = expandedFolders[folder.path];

      items.push(
        <div key={`folder-${folder.path}`}>
          <button
            onClick={() => toggleFolder(folder.path)}
            className="w-full px-4 py-3 rounded-lg hover:bg-slate-100 text-left flex items-center gap-3 group transition-colors"
          >
            <span className="text-lg flex-shrink-0">
              {isExpanded ? '📂' : '📁'}
            </span>
            <span className="font-semibold text-slate-800 group-hover:text-indigo-700">{folder.name}</span>
            {hasContent && (
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full ml-auto flex-shrink-0">
                {Object.keys(folder.children).length + folder.materials.length}
              </span>
            )}
          </button>
          {isExpanded && hasContent && (
            <div className="ml-4 border-l-2 border-slate-200 pl-2 space-y-1">
              {renderFolderTree(folder, depth + 1)}
            </div>
          )}
        </div>
      );
    });

    // Render materials in this level
    materials_sorted.forEach(m => {
      items.push(
        <div key={`material-${m.id}`} className="px-4 py-2 rounded-lg hover:bg-slate-100 text-left flex items-center gap-3 group transition-colors">
          <span className="text-lg flex-shrink-0">📄</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 group-hover:text-indigo-700 truncate">{m.materi_name}</p>
            {m.file_name && <p className="text-xs text-slate-500">{m.file_name}</p>}
          </div>
          {m.file_url && (
            <a href={m.file_url} target="_blank" rel="noopener noreferrer"
              className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors flex-shrink-0">
              📥 Buka
            </a>
          )}
        </div>
      );
    });

    return items;
  };

  return (
    <div>
      <PageHeader title="📚 Materi Training" subtitle="Kelola materi training team" />
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}
        
        <div className="mb-6 flex justify-end">
          <button onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2">
            ➕ Tambah Materi
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800">📁 Folder Materi</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                <p className="text-slate-500">Memuat materi...</p>
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">Belum ada materi</p>
              </div>
            ) : (
              <div className="space-y-1">
                {renderFolderTree(root)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Bank Soal (Separate Tab) ──────────────────────────────────────

function BankSoalPage({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: dbError } = await supabase.from('lc_questions').select('*');
        
        if (dbError) {
          throw new Error(dbError.message);
        }
        
        setQuestions(data ?? []);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading questions:', err);
        setError(err?.message ?? 'Failed to load questions');
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  const filtered = questions.filter(q =>
    (q.question.toLowerCase().includes(filter.toLowerCase()) ||
     q.materi_name.toLowerCase().includes(filter.toLowerCase())) &&
    (!difficulty || q.difficulty === difficulty)
  );

  return (
    <div>
      <PageHeader 
        title={isAdmin ? "🏦 Bank Soal" : "🏦 Bank Soal"} 
        subtitle={isAdmin ? "Kelola semua soal pembelajaran" : "Lihat dan pelajari soal"} 
      />
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
            <p className="text-slate-500">Memuat bank soal...</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex gap-4">
              <input type="text" placeholder="Cari soal..." value={filter} onChange={e => setFilter(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Semua Level</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg">📭 Tidak ada soal</p>
            </div>
          ) : (
            filtered.map((q, idx) => (
              <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500">#{idx + 1} • {q.materi_name}</p>
                    <h4 className="font-semibold text-slate-800 mt-2 text-lg">{q.question}</h4>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${DIFF_COLOR[q.difficulty]}`}>
                    {q.difficulty.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {['A', 'B', 'C', 'D'].map(opt => {
                    const key = `option_${opt.toLowerCase()}` as keyof Question;
                    const text = q[key] as string;
                    const isCorrect = q.correct_answer === opt;
                    return (
                      <div key={opt} className={`p-3 rounded-lg border ${isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-xs font-bold text-slate-600 mb-1">{opt}</p>
                        <p className={`text-sm ${isCorrect ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`}>{text}</p>
                        {isCorrect && <p className="text-xs text-emerald-600 font-bold mt-1">✅ Jawaban Benar</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN: Questions ──────────────────────────────────────────────────────

function AdminQuestionsPage({ user }: { user: User }) {
  return <div className="p-8"><PageHeader title="❓ Kelola Soal" subtitle="Manajemen soal pembelajaran" /></div>;
}

// ─── ADMIN: Sessions ───────────────────────────────────────────────────────

function AdminSessionsPage({ user }: { user: User }) {
  return <div className="p-8"><PageHeader title="🎯 Sesi Quiz" subtitle="Kelola sesi dan jadwal quiz" /></div>;
}

// ─── ADMIN: Team ──────────────────────────────────────────────────────────

function AdminTeamPage({ user }: { user: User }) {
  return <div className="p-8"><PageHeader title="👥 Tim" subtitle="Kelola anggota tim" /></div>;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ─── TEAM LEARNING CENTER ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════════

function TeamLearningCenter({ user, view, setView }: { user: User; view: TeamView; setView: (v: TeamView) => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navbar user={user} />
      
      <div className="flex">
        <TeamSidebar view={view} setView={setView} />
        <div className="flex-1">
          {view === 'my-quiz' && <TeamMyQuizPage user={user} />}
          {view === 'materi' && <TeamMateriPage user={user} />}
          {view === 'bank-soal' && <BankSoalPage user={user} isAdmin={false} />}
          {view === 'history' && <HistoryPage user={user} />}
          {view === 'score' && <ScorePage user={user} />}
        </div>
      </div>
    </div>
  );
}

function TeamSidebar({ view, setView }: { view: TeamView; setView: (v: TeamView) => void }) {
  const items: { label: string; icon: string; view: TeamView }[] = [
    { label: 'Quiz Saya', icon: '🎯', view: 'my-quiz' },
    { label: 'Materi', icon: '📚', view: 'materi' },
    { label: 'Bank Soal', icon: '🏦', view: 'bank-soal' },
    { label: 'Riwayat', icon: '🕐', view: 'history' },
    { label: 'Nilai Saya', icon: '🏆', view: 'score' },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 p-4 sticky top-20 h-[calc(100vh-80px)] overflow-y-auto">
      <div className="space-y-2">
        {items.map(item => (
          <button key={item.view} onClick={() => setView(item.view)}
            className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-all ${view === item.view ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'}`}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TEAM: My Quiz ─────────────────────────────────────────────────────────

function TeamMyQuizPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [startingQuiz, setStartingQuiz] = useState<QuizSession | null>(null);

  useEffect(() => {
    supabase.from('lc_quiz_sessions').select('*').eq('is_active', true)
      .then(({ data }: { data: QuizSession[] | null }) => setSessions(data ?? []));
  }, []);

  if (startingQuiz) {
    return <QuizPage user={user} session={startingQuiz} onBack={() => setStartingQuiz(null)} />;
  }

  return (
    <div>
      <PageHeader title="🎯 Quiz Saya" subtitle="Quiz yang tersedia untuk dikerjakan" />
      <div className="p-8">
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-semibold">Belum ada quiz tersedia</p>
            </div>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{s.session_name}</h4>
                  <p className="text-sm text-slate-600 mt-1">{s.materi_name}</p>
                  <div className="flex gap-4 mt-3 text-xs text-slate-500">
                    <span>📝 {s.question_count} soal</span>
                    {s.timer_minutes && <span>⏱️ {s.timer_minutes} menit</span>}
                    <span>🎯 Passing: {s.passing_grade}%</span>
                  </div>
                </div>
                <button onClick={() => setStartingQuiz(s)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex-shrink-0">
                  ▶️ Mulai
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TEAM: Materi ─────────────────────────────────────────────────────────

function TeamMateriPage({ user }: { user: User }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.from('lc_materials').select('*')
      .then(({ data }: { data: Material[] | null }) => setMaterials(data ?? []));
  }, []);

  const root = buildFolderTree(materials);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderFolderTree = (node: FolderNode): React.ReactNode[] => {
    const items: React.ReactNode[] = [];
    const folders = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
    const materials_sorted = node.materials.sort((a, b) => (a.materi_name ?? '').localeCompare(b.materi_name ?? ''));

    folders.forEach(folder => {
      const hasContent = Object.keys(folder.children).length > 0 || folder.materials.length > 0;
      const isExpanded = expandedFolders[folder.path];

      items.push(
        <div key={`folder-${folder.path}`}>
          <button
            onClick={() => toggleFolder(folder.path)}
            className="w-full px-4 py-3 rounded-lg hover:bg-slate-100 text-left flex items-center gap-3 group transition-colors"
          >
            <span className="text-lg flex-shrink-0">
              {isExpanded ? '📂' : '📁'}
            </span>
            <span className="font-semibold text-slate-800 group-hover:text-indigo-700">{folder.name}</span>
            {hasContent && (
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full ml-auto flex-shrink-0">
                {Object.keys(folder.children).length + folder.materials.length}
              </span>
            )}
          </button>
          {isExpanded && hasContent && (
            <div className="ml-4 border-l-2 border-slate-200 pl-2 space-y-1">
              {renderFolderTree(folder)}
            </div>
          )}
        </div>
      );
    });

    materials_sorted.forEach(m => {
      items.push(
        <div key={`material-${m.id}`} className="px-4 py-2 rounded-lg hover:bg-slate-100 text-left flex items-center gap-3 group transition-colors">
          <span className="text-lg flex-shrink-0">📄</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 group-hover:text-indigo-700 truncate">{m.materi_name}</p>
            {m.file_name && <p className="text-xs text-slate-500">{m.file_name}</p>}
          </div>
          {m.file_url && (
            <a href={m.file_url} target="_blank" rel="noopener noreferrer"
              className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 transition-colors flex-shrink-0">
              📥 Buka
            </a>
          )}
        </div>
      );
    });

    return items;
  };

  return (
    <div>
      <PageHeader title="📚 Materi Training" subtitle="Akses materi pembelajaran" />
      <div className="p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800">📁 Folder Materi</h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            {materials.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">Belum ada materi</p>
              </div>
            ) : (
              <div className="space-y-1">
                {renderFolderTree(root)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QUIZ: Take Quiz (Professional Theme) ──────────────────────────────────

function QuizPage({ user, session, onBack }: { user: User; session: QuizSession; onBack: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [timeLeft, setTimeLeft] = useState(session.timer_minutes ? session.timer_minutes * 60 : null);
  const [submitted, setSubmitted] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);

  useEffect(() => {
    // Load questions
    if (session.question_ids?.length) {
      supabase.from('lc_questions').select('*').in('id', session.question_ids)
        .then(({ data }: { data: Question[] | null }) => setQuestions(data ?? []));
    }

    // Create attempt
    supabase.from('lc_quiz_attempts').insert({
      user_id: user.id,
      quiz_session_id: session.id,
      started_at: new Date().toISOString(),
      total_questions: session.question_count,
    }).select().single().then(({ data }: { data: QuizAttempt | null }) => setAttempt(data));
  }, [session]);

  // Timer
  useEffect(() => {
    if (!timeLeft || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t && t <= 1) {
          handleSubmit();
          return 0;
        }
        return (t ?? 0) - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitted]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) setTabSwitches(t => t + 1);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!attempt || submitted) return;
    
    let correct = 0;
    for (const q of questions) {
      if ((answers[q.id] ?? savedAnswers[q.id]) === q.correct_answer) correct++;
    }

    const score = (correct / questions.length) * 100;
    const passed = score >= session.passing_grade;
    const time_taken = session.timer_minutes ? (session.timer_minutes * 60 - (timeLeft ?? 0)) : null;

    await supabase.from('lc_quiz_attempts').update({
      submitted_at: new Date().toISOString(),
      is_submitted: true,
      score: Math.round(score),
      total_correct: correct,
      passed,
      time_taken_sec: time_taken,
    }).eq('id', attempt.id);

    setSubmitted(true);
  };

  if (!attempt || questions.length === 0) {
    return <div className="flex items-center justify-center min-h-screen">Loading quiz...</div>;
  }

  if (submitted) {
    const correct = questions.filter(q => (answers[q.id] ?? savedAnswers[q.id]) === q.correct_answer).length;
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= session.passing_grade;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-12 text-center max-w-md shadow-2xl">
          <div className={`text-6xl mb-4 ${passed ? '🎉' : '📌'}`}></div>
          <h2 className={`text-3xl font-black mb-2 ${passed ? 'text-emerald-600' : 'text-slate-800'}`}>
            {passed ? 'Selamat!' : 'Hasil Quiz'}
          </h2>
          <div className={`text-5xl font-black mb-4 ${passed ? 'text-emerald-500' : 'text-amber-500'}`}>
            {score}%
          </div>
          <p className="text-slate-600 mb-2">✅ Benar: {correct}/{questions.length}</p>
          {session.passing_grade && <p className="text-slate-600 mb-6">🎯 Passing: {session.passing_grade}%</p>}
          <button onClick={onBack} className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Main Quiz Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">{session.session_name}</h2>
            <p className="text-slate-400 text-sm">{session.materi_name}</p>
          </div>
          <div className="flex items-center gap-6 text-white">
            <div className="text-center">
              <p className="text-xs text-slate-400">Soal</p>
              <p className="font-bold text-lg">{current + 1}/{questions.length}</p>
            </div>
            {timeLeft !== null && (
              <div className={`text-center px-4 py-2 rounded-lg ${timeLeft < 300 ? 'bg-red-500/20 border border-red-500' : 'bg-slate-700'}`}>
                <p className="text-xs text-slate-400">Waktu Tersisa</p>
                <p className={`font-black text-lg ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>{formatTime(timeLeft)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Soal {current + 1}</p>
              <h3 className="text-2xl font-bold text-white leading-relaxed">{q.question}</h3>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {['A', 'B', 'C', 'D'].map(opt => {
                const key = `option_${opt.toLowerCase()}` as keyof Question;
                const text = q[key] as string;
                const selected = (answers[q.id] ?? savedAnswers[q.id]) === opt;

                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(q.id, opt)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 font-bold ${
                        selected ? 'bg-indigo-400 border-indigo-300 text-indigo-900' : 'border-slate-600'
                      }`}>
                        {opt}
                      </div>
                      <p className="mt-0.5">{text}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex gap-4 mt-12">
              <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                ← Sebelumnya
              </button>
              <button onClick={() => setCurrent(p => Math.min(questions.length - 1, p + 1))} disabled={current === questions.length - 1}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Berikutnya →
              </button>
              <button onClick={handleSubmit}
                className="ml-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all">
                ✅ Selesai & Kirim
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigator Sidebar */}
      <div className="w-56 bg-slate-800 border-l border-slate-700 p-5 overflow-y-auto flex-shrink-0">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Navigasi Soal</p>
        <div className="grid grid-cols-5 gap-2">
          {questions.map((_, i) => {
            const ans = answers[questions[i].id] ?? savedAnswers[questions[i].id];
            return (
              <button key={i} onClick={() => setCurrent(i)}
                className={`aspect-square rounded-lg text-xs font-bold transition-all ${
                  i === current
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : ans
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-6 space-y-2 text-xs">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-600 flex-shrink-0" />Terjawab</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-700 flex-shrink-0" />Belum</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-indigo-600 flex-shrink-0" />Aktif</div>
        </div>
        {tabSwitches > 0 && (
          <div className="mt-6 p-3 bg-red-500/20 border border-red-500 rounded-lg text-xs text-red-300 font-semibold">
            ⚠️ Pergantian Tab: {tabSwitches}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TEAM: History ────────────────────────────────────────────────────────

function HistoryPage({ user }: { user: User }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .order('submitted_at', { ascending: false })
      .then(({ data }: { data: any[] | null }) => setHistory(data ?? []));
  }, [user.id]);

  return (
    <div>
      <PageHeader title="🕐 Riwayat Quiz" subtitle="Semua quiz yang pernah kamu ikuti" />
      <div className="p-8">
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-semibold">Belum ada riwayat quiz</p>
            </div>
          ) : (
            history.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
                <div className="flex items-center gap-5 flex-1">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 ${a.passed ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-rose-500 to-rose-600'}`}>
                    {a.score?.toFixed(0) ?? '—'}%
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</h4>
                    <p className="text-sm text-slate-600 mt-0.5">{a.lc_quiz_sessions?.materi_name ?? '-'}</p>
                    <div className="flex gap-3 mt-2 text-xs text-slate-500">
                      <span>✅ {a.total_correct}/{a.total_questions} benar</span>
                      <span>🎯 Passing: {a.lc_quiz_sessions?.passing_grade ?? 70}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                    {a.passed ? '✅ LULUS' : '❌ TIDAK LULUS'}
                  </span>
                  <p className="text-xs text-slate-400">{a.submitted_at ? fmtDate(a.submitted_at) : ''}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TEAM: Score ──────────────────────────────────────────────────────────

function ScorePage({ user }: { user: User }) {
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('lc_quiz_attempts')
      .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .then(({ data }: { data: any[] | null }) => setAttempts(data ?? []));
  }, [user.id]);

  const avg = attempts.length ? attempts.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / attempts.length : 0;
  const passed = attempts.filter((a: any) => a.passed).length;

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
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-6 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800">Rekap Nilai Per Quiz</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {attempts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Belum ada quiz yang diselesaikan</td></tr>
              ) : (
                attempts.map(a => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
