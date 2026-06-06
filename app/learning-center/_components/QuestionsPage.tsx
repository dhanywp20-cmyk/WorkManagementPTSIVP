'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase, User, Material, Question, FolderNode,
  buildFolderTree, DIFF_COLOR, SearchInput,
  generateWithGemini, fileToBase64, AppDialog, DialogState,
  BtnEdit, BtnDelete,
} from './shared';

// ─── Folder color palette ───────────────────────────────────────────────────
const FOLDER_COLORS = [
  { gradient: 'linear-gradient(135deg,#3b82f6,#4f46e5)', light: '#dbeafe', icon: '#3b82f6' },
  { gradient: 'linear-gradient(135deg,#10b981,#0d9488)', light: '#d1fae5', icon: '#10b981' },
  { gradient: 'linear-gradient(135deg,#8b5cf6,#9333ea)', light: '#ede9fe', icon: '#8b5cf6' },
  { gradient: 'linear-gradient(135deg,#f59e0b,#f97316)', light: '#fef3c7', icon: '#f59e0b' },
  { gradient: 'linear-gradient(135deg,#f43f5e,#db2777)', light: '#ffe4e6', icon: '#f43f5e' },
  { gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)', light: '#cffafe', icon: '#06b6d4' },
];
const getFolderColor = (name: string) => FOLDER_COLORS[name.charCodeAt(0) % FOLDER_COLORS.length];

// ─── Difficulty helpers ─────────────────────────────────────────────────────
const DIFF_BG: Record<string, string> = { easy: '#ecfdf5', medium: '#fffbeb', hard: '#fff1f2' };
const DIFF_BORDER: Record<string, string> = { easy: '#d1fae5', medium: '#fef3c7', hard: '#ffe4e6' };
const DIFF_TEXT: Record<string, string> = { easy: '#065f46', medium: '#92400e', hard: '#be123c' };
const DIFF_NUM_BG: Record<string, string> = {
  easy: 'linear-gradient(135deg,#10b981,#059669)',
  medium: 'linear-gradient(135deg,#f59e0b,#d97706)',
  hard: 'linear-gradient(135deg,#f43f5e,#e11d48)',
};
const DIFF_LABEL: Record<string, string> = { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' };

export function QuestionsPage({ user }: { user: User }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMat, setSelectedMat] = useState<string>('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [newQ, setNewQ] = useState({
    question: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'A', difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    material_id: '', batch_name: '',
  });
  const [genCount, setGenCount] = useState(10);
  const [genDiff, setGenDiff] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [batchName, setBatchName] = useState('');
  const [genExtraPrompt, setGenExtraPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [editQ, setEditQ] = useState<Question | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedSubFolder, setSelectedSubFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [renameFolder, setRenameFolder] = useState<{ oldName: string; newName: string } | null>(null);
  // collapsed state: key = `${matId}__${batchKey}` — collapsed by default
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [renameSaving, setRenameSaving] = useState(false);

  const handleDeleteFolder = (fKey: string) => {
    const fNode = folderTree.children[fKey];
    if (!fNode) return;
    const collectMats = (n: FolderNode): Material[] => [...n.materials, ...Object.values(n.children).flatMap(c => collectMats(c))];
    const matIds = collectMats(fNode).map(m => m.id);
    const qCount = questions.filter(q => matIds.includes(q.material_id)).length;
    setDialog({
      type: 'confirm',
      title: 'Hapus Soal Folder',
      message: `Semua ${qCount} soal dalam folder "${fKey}" akan dihapus permanen. Lanjutkan?`,
      confirmLabel: 'Hapus Semua',
      onConfirm: async () => {
        if (matIds.length > 0) {
          // Get all question IDs in this folder, delete answers first
          const qIds = questions.filter(q => matIds.includes(q.material_id)).map(q => q.id);
          if (qIds.length > 0) await supabase.from('lc_answers').delete().in('question_id', qIds);
          const { error } = await supabase.from('lc_questions').delete().in('material_id', matIds);
          if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
        }
        load();
      },
    });
  };

  const handleRenameFolder = async () => {
    if (!renameFolder || !renameFolder.newName.trim()) return;
    const { oldName, newName } = renameFolder;
    if (oldName === newName.trim()) { setRenameFolder(null); return; }
    setRenameSaving(true);
    const affected = materials.filter(m => m.folder_path === oldName || m.folder_path?.startsWith(oldName + '/'));
    await Promise.all(affected.map(m =>
      supabase.from('lc_materials').update({ folder_path: m.folder_path!.replace(oldName, newName.trim()) }).eq('id', m.id)
    ));
    setRenameSaving(false);
    setRenameFolder(null);
    if (selectedFolder === oldName) setSelectedFolder(newName.trim());
    if (selectedSubFolder === oldName) setSelectedSubFolder(newName.trim());
    load();
  };

  const load = useCallback(async () => {
    const { data: mats } = await supabase.from('lc_materials').select('*').order('materi_name');
    setMaterials(mats ?? []);
    let q = supabase.from('lc_questions').select('*').order('created_at', { ascending: false });
    if (selectedMat) q = q.eq('material_id', selectedMat);
    const { data } = await q;
    setQuestions(data ?? []);
  }, [selectedMat]);
  useEffect(() => { load(); }, [load]);

  // Reset material selection when navigating between folders
  useEffect(() => {
    setSelectedMat('');
    setShowGenerate(false);
  }, [selectedFolder, selectedSubFolder]);

  const folderTree = buildFolderTree(materials);
  const rootFolders = Object.keys(folderTree.children).sort();
  const rootMaterials = folderTree.materials;

  const getMaterialsInView = (): Material[] => {
    if (selectedFolder === null) return [];
    const folderNode = folderTree.children[selectedFolder];
    if (!folderNode) return [];
    if (selectedSubFolder && selectedSubFolder !== '__direct__') {
      return folderNode.children[selectedSubFolder]?.materials ?? [];
    }
    if (selectedSubFolder === '__direct__') return folderNode.materials;
    const collect = (node: FolderNode): Material[] => {
      let mats = [...node.materials];
      for (const child of Object.values(node.children)) mats = mats.concat(collect(child));
      return mats;
    };
    return collect(folderNode);
  };

  const viewMaterials = selectedFolder === '__root__' ? rootMaterials : getMaterialsInView();
  const viewMaterialIds = viewMaterials.map(m => m.id);
  const visibleQuestions = selectedFolder !== null
    ? questions.filter(q => viewMaterialIds.includes(q.material_id))
    : [];

  const filteredQuestions = search
    ? visibleQuestions.filter(q =>
        q.question.toLowerCase().includes(search.toLowerCase()) ||
        q.materi_name.toLowerCase().includes(search.toLowerCase())
      )
    : visibleQuestions;

  const handleGenerate = async () => {
    if (!selectedMat) { setDialog({ type: 'error', message: 'Pilih materi terlebih dahulu!' }); return; }
    const mat = materials.find(m => m.id === selectedMat);
    if (!pdfFile && !mat?.content_text) { setDialog({ type: 'error', message: 'Upload PDF materi atau pastikan materi sudah punya konten teks.' }); return; }
    setGenerating(true);
    setGenStatus('Menghubungi Gemini AI...');
    try {
      const diffInstruction = genDiff === 'mixed'
        ? 'Buat soal dengan campuran tingkat kesulitan: easy, medium, dan hard secara merata.'
        : `Semua soal tingkat kesulitan: ${genDiff}.`;
      const extraInstruction = genExtraPrompt.trim()
        ? `\n\nFOKUS TOPIK KHUSUS: ${genExtraPrompt.trim()}\nPastikan seluruh soal yang dibuat berfokus pada topik tersebut dari materi ini.`
        : '';
      const prompt = `Kamu adalah instruktur training profesional. ${pdfFile ? 'Berdasarkan dokumen PDF yang dilampirkan' : 'Berdasarkan materi berikut'}, buat tepat ${genCount} soal pilihan ganda (A, B, C, D) dalam Bahasa Indonesia.\n${diffInstruction}${extraInstruction}\n${!pdfFile && mat?.content_text ? `\nMATERI:\n${mat.content_text.slice(0, 30000)}` : ''}\n\nOUTPUT RULE: Balas HANYA dengan JSON array murni. Tidak boleh ada teks, penjelasan, atau markdown di luar array. Mulai langsung dengan [ dan akhiri dengan ].\n[\n  {\n    "question": "Pertanyaan lengkap?",\n    "option_a": "Jawaban A",\n    "option_b": "Jawaban B",\n    "option_c": "Jawaban C",\n    "option_d": "Jawaban D",\n    "correct_answer": "A",\n    "difficulty": "easy"\n  }\n]`;
      setGenStatus(pdfFile ? '📄 Mengirim PDF ke Gemini...' : '🧠 Generating soal...');
      const text = await generateWithGemini(prompt, pdfFile ?? null);
      setGenStatus('⚙️ Memproses hasil...');

      // ── Robust JSON extraction ──────────────────────────────────────────────
      // 1. Strip all markdown code fences (```json, ```javascript, ```, etc.)
      let cleanText = text
        .replace(/```[\w]*\n?/gi, '')  // opening fence with optional lang tag
        .replace(/```/g, '')            // any remaining closing fences
        .trim();

      // 2. Try regex match for JSON array first
      let jsonMatch = cleanText.match(/\[[\s\S]*\]/);

      // 3. Fallback: manually find outermost [ ... ] brackets
      if (!jsonMatch) {
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          jsonMatch = [cleanText.slice(firstBracket, lastBracket + 1)];
        }
      }

      // 4. Last fallback: try parsing the entire cleaned text directly
      if (!jsonMatch) {
        try {
          const direct = JSON.parse(cleanText);
          if (Array.isArray(direct)) jsonMatch = [cleanText];
        } catch { /* ignore */ }
      }

      if (!jsonMatch) {
        // Show first 300 chars of raw response for debugging
        const preview = text.slice(0, 300).replace(/\n/g, ' ');
        throw new Error(`Format JSON tidak ditemukan. Response Gemini: "${preview}..."`);
      }

      const parsed: any[] = JSON.parse(jsonMatch[0]);
      const rows = parsed.map(q => ({
        material_id: selectedMat, materi_name: mat?.materi_name ?? '',
        batch_name: batchName.trim() || null,
        question: q.question, option_a: q.option_a, option_b: q.option_b,
        option_c: q.option_c, option_d: q.option_d,
        correct_answer: (q.correct_answer ?? 'A').toUpperCase(),
        difficulty: q.difficulty ?? 'medium', created_by: user.id,
      }));
      setGenStatus('💾 Menyimpan soal ke database...');
      const { error } = await supabase.from('lc_questions').insert(rows);
      if (error) throw error;
      // Track Gemini usage in localStorage
      const today = new Date().toISOString().slice(0, 10);
      const storageKey = `gemini_usage_${today}`;
      const current = parseInt(localStorage.getItem(storageKey) ?? '0');
      localStorage.setItem(storageKey, String(current + 1));
      localStorage.setItem('gemini_last_used', new Date().toISOString());
      setPdfFile(null);
      if (pdfRef.current) pdfRef.current.value = '';
      setBatchName(''); setGenExtraPrompt('');
      setShowGenerate(false); setGenStatus(''); load();
      setDialog({ type: 'success', title: 'Generate Selesai', message: `${rows.length} soal berhasil digenerate dan disimpan!${batchName.trim() ? ` (Batch: ${batchName.trim()})` : ''}` });
    } catch (err: any) {
      setDialog({ type: 'error', title: 'Generate Gagal', message: 'Gagal generate: ' + (err.message ?? String(err)) });
      setGenStatus('');
    }
    setGenerating(false);
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm', title: 'Hapus Soal',
      message: 'Soal ini akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        // Delete linked answers first (FK constraint)
        await supabase.from('lc_answers').delete().eq('question_id', id);
        const { error } = await supabase.from('lc_questions').delete().eq('id', id);
        if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
        load();
      },
    });
  };

  const handleDeleteMatGroup = (matId: string, matName: string) => {
    const count = questions.filter(q => q.material_id === matId).length;
    setDialog({
      type: 'confirm', title: 'Hapus Semua Soal Materi',
      message: `Semua ${count} soal pada materi "${matName}" akan dihapus permanen. Lanjutkan?`,
      confirmLabel: 'Hapus Semua',
      onConfirm: async () => {
        // Get question IDs first, delete answers, then questions
        const qIds = questions.filter(q => q.material_id === matId).map(q => q.id);
        if (qIds.length > 0) await supabase.from('lc_answers').delete().in('question_id', qIds);
        const { error } = await supabase.from('lc_questions').delete().eq('material_id', matId);
        if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
        load();
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editQ) return;
    await supabase.from('lc_questions').update({
      question: editQ.question, option_a: editQ.option_a, option_b: editQ.option_b,
      option_c: editQ.option_c, option_d: editQ.option_d,
      correct_answer: editQ.correct_answer, difficulty: editQ.difficulty,
    }).eq('id', editQ.id);
    setEditQ(null); load();
  };

  const handleAddManual = async () => {
    if (!newQ.material_id) { setDialog({ type: 'error', message: 'Pilih materi terlebih dahulu!' }); return; }
    if (!newQ.question.trim()) { setDialog({ type: 'error', message: 'Pertanyaan wajib diisi!' }); return; }
    if (!newQ.option_a.trim() || !newQ.option_b.trim() || !newQ.option_c.trim() || !newQ.option_d.trim()) {
      setDialog({ type: 'error', message: 'Semua pilihan jawaban (A, B, C, D) wajib diisi!' }); return;
    }
    const mat = materials.find(m => m.id === newQ.material_id);
    const { error } = await supabase.from('lc_questions').insert([{
      ...newQ, materi_name: mat?.materi_name ?? '', created_by: user.id,
    }]);
    if (error) { setDialog({ type: 'error', message: 'Error: ' + error.message }); return; }
    setShowAddManual(false);
    setNewQ({ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', difficulty: 'medium', material_id: '', batch_name: '' });
    load();
    setDialog({ type: 'success', message: 'Soal berhasil ditambahkan!' });
  };

  const goBack = () => {
    if (selectedSubFolder) { setSelectedSubFolder(null); return; }
    setSelectedFolder(null); setSelectedMat('');
  };

  // ─── Rename Folder Modal ────────────────────────────────────────────────────
  const renameFolderModalJSX = renameFolder ? (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-slate-800 mb-1 text-base">✏️ Ubah Nama Folder</h3>
        <p className="text-xs text-slate-400 mb-4">Semua materi dalam folder ini akan diperbarui secara otomatis.</p>
        <input
          value={renameFolder?.newName ?? ''}
          onChange={e => setRenameFolder(p => p && ({ ...p, newName: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setRenameFolder(null); }}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-4"
          autoFocus
          placeholder="Nama folder baru..."
        />
        <div className="flex gap-3">
          <button
            onClick={handleRenameFolder}
            disabled={renameSaving}
            className="flex-1 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-60 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#4f46e5)' }}
          >
            {renameSaving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menyimpan...
              </span>
            ) : '💾 Simpan'}
          </button>
          <button
            onClick={() => setRenameFolder(null)}
            className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ─── Gemini usage helper ────────────────────────────────────────────────────
  const getGeminiUsage = () => {
    if (typeof window === 'undefined') return { count: 0, lastUsed: null };
    const today = new Date().toISOString().slice(0, 10);
    const count = parseInt(localStorage.getItem(`gemini_usage_${today}`) ?? '0');
    const lastUsed = localStorage.getItem('gemini_last_used');
    return { count, lastUsed };
  };
  const geminiUsage = getGeminiUsage();
  const geminiRemaining = Math.max(0, 50 - geminiUsage.count); // conservative daily estimate
  const geminiLastUsedStr = geminiUsage.lastUsed
    ? new Date(geminiUsage.lastUsed).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : null;

  // ─── Generate Panel (plain JSX var — NOT a sub-component, avoids remount on every keystroke) ──
  const generatePanelJSX = (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-200 p-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-violet-800 flex items-center gap-2">✨ Generate Soal dengan Gemini AI</h3>
        {/* Gemini usage badge */}
        <div className="flex items-center gap-2 text-[11px] font-semibold flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${geminiRemaining <= 5 ? 'bg-rose-50 border-rose-200 text-rose-700' : geminiRemaining <= 15 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <span>{geminiRemaining <= 5 ? '⚠️' : geminiRemaining <= 15 ? '🟡' : '🟢'}</span>
            <span>Hari ini: <strong>{geminiUsage.count}</strong> kali</span>
            <span className="text-slate-300">|</span>
            <span>Sisa ~<strong>{geminiRemaining}</strong></span>
          </div>
          {geminiLastUsedStr && (
            <span className="text-slate-400 text-[10px]">Terakhir: {geminiLastUsedStr}</span>
          )}
        </div>
      </div>
      {/* Limit info */}
      <div className="flex items-start gap-2 text-xs bg-violet-100/60 border border-violet-200 rounded-xl px-3 py-2 mb-4">
        <span>ℹ️</span>
        <span className="text-violet-700">Gemini 2.5 Flash free tier: <strong>10 req/menit</strong>, ~<strong>50 req/hari</strong>. Jika error limit, tunggu 1 menit atau coba besok.</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            Nama Grup / Batch
            <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">Optional</span>
          </label>
          <input value={batchName} onChange={e => setBatchName(e.target.value)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white"
            placeholder="contoh: Instalasi Dasar, Troubleshooting Level 1, Quiz Minggu ke-3..." />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            Topik Khusus
            <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">Optional</span>
          </label>
          <textarea value={genExtraPrompt} onChange={e => setGenExtraPrompt(e.target.value)} rows={2}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white resize-none"
            placeholder="contoh: Fokus pada cara pemasangan LED indoor P2.5, atau khusus troubleshooting sinyal HDMI..." />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
          <select value={selectedMat} onChange={e => setSelectedMat(e.target.value)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
            <option value="">-- Pilih Materi --</option>
            {(viewMaterials.length > 0 ? viewMaterials : materials).map(m =>
              <option key={m.id} value={m.id}>{m.materi_name}{m.content_text ? ' ✅' : ''}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jumlah Soal</label>
          <input type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(+e.target.value)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Tingkat Kesulitan</label>
          <select value={genDiff} onChange={e => setGenDiff(e.target.value as any)}
            className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
            <option value="mixed">Mixed (Campuran)</option>
            <option value="easy">Easy — Mudah</option>
            <option value="medium">Medium — Sedang</option>
            <option value="hard">Hard — Sulit</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
            Upload PDF <span className="text-[10px] font-normal text-violet-500 normal-case tracking-normal">(sementara, tidak disimpan)</span>
          </label>
          <input ref={pdfRef} type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files?.[0] ?? null)} className="hidden" />
          <div className="flex items-center gap-2">
            <button onClick={() => pdfRef.current?.click()}
              className="px-3 py-2 bg-white border border-violet-200 hover:bg-violet-50 text-violet-700 text-xs font-semibold rounded-xl transition-all">
              📄 Pilih PDF
            </button>
            {pdfFile
              ? <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">✅ {pdfFile.name}</span>
              : <span className="text-xs text-slate-400">atau dari teks materi</span>}
            {pdfFile && <button onClick={() => { setPdfFile(null); if (pdfRef.current) pdfRef.current.value = ''; }} className="text-xs text-rose-500">✕</button>}
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
          {generating ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</> : '✨ Generate Sekarang'}
        </button>
        <button onClick={() => { setShowGenerate(false); setPdfFile(null); setGenStatus(''); setBatchName(''); setGenExtraPrompt(''); if (pdfRef.current) pdfRef.current.value = ''; }}
          className="px-5 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">Batal</button>
      </div>
    </div>
  );

  // ─── Manual Add Modal (plain JSX var — NOT a sub-component, avoids remount on every keystroke) ──
  const addManualModalJSX = showAddManual ? (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
      <div className="rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#ffffff' }}>
        <h3 className="font-bold text-slate-800 mb-1 text-base">➕ Tambah Soal Manual</h3>
        <p className="text-xs text-slate-400 mb-4">Isi semua field, klik tombol "✓ Benar" untuk menandai jawaban yang benar.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
            <select value={newQ.material_id} onChange={e => setNewQ(p => ({ ...p, material_id: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
              <option value="">-- Pilih Materi --</option>
              {(viewMaterials.length > 0 ? viewMaterials : materials).map(m =>
                <option key={m.id} value={m.id}>{m.materi_name}</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Pertanyaan *</label>
            <textarea value={newQ.question} onChange={e => setNewQ(p => ({ ...p, question: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 resize-none"
              placeholder="Tulis pertanyaan di sini..." />
          </div>
          {(['a', 'b', 'c', 'd'] as const).map(opt => (
            <div key={opt} className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${newQ.correct_answer === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{opt.toUpperCase()}</span>
              <input value={(newQ as any)[`option_${opt}`]} onChange={e => setNewQ(p => ({ ...p, [`option_${opt}`]: e.target.value }))}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                placeholder={`Pilihan ${opt.toUpperCase()}`} />
              <button onClick={() => setNewQ(p => ({ ...p, correct_answer: opt.toUpperCase() }))}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all flex-shrink-0 ${newQ.correct_answer === opt.toUpperCase() ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-500 hover:bg-green-50 border border-transparent'}`}>
                ✓ Benar
              </button>
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
              Nama Grup / Batch
              <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">Optional</span>
            </label>
            <input value={newQ.batch_name} onChange={e => setNewQ(p => ({ ...p, batch_name: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
              placeholder="contoh: Instalasi Dasar, Quiz Minggu 1, Troubleshooting..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Tingkat Kesulitan</label>
            <select value={newQ.difficulty} onChange={e => setNewQ(p => ({ ...p, difficulty: e.target.value as any }))}
              className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleAddManual}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition-all">
            💾 Simpan Soal
          </button>
          <button onClick={() => setShowAddManual(false)}
            className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">Batal</button>
        </div>
      </div>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Folder Selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedFolder === null) {
    return (
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-slate-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>
                🧩
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">Bank Soal</h1>
                <p className="text-xs text-slate-500">Pilih folder untuk mulai</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddManual(true)}
                className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Tambah Manual
              </button>
              <button
                onClick={() => setShowGenerate(true)}
                className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
                ✨ Generate AI
              </button>
            </div>
          </div>
          {/* Stats bar */}
          <div className="flex items-center gap-3 px-6 py-2.5 bg-slate-50 border-t border-slate-100">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {questions.length} total soal
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full shadow-sm">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              {rootFolders.length} folder
            </span>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
          {showGenerate && generatePanelJSX}

          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {rootMaterials.length > 0 && (() => {
                const fc = getFolderColor('Tanpa');
                return (
                  <button
                    onClick={() => setSelectedFolder('__root__')}
                    className="group flex flex-col p-4 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                  >
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: fc.light }}
                    >
                      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate">Tanpa Folder</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {questions.filter(q => rootMaterials.map(m => m.id).includes(q.material_id)).length} soal
                    </p>
                    <div className="flex justify-end mt-2">
                      <svg width="14" height="14" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })()}
              {rootFolders.map(fKey => {
                const fNode = folderTree.children[fKey];
                const collectMats = (n: FolderNode): Material[] => [...n.materials, ...Object.values(n.children).flatMap(child => collectMats(child))];
                const matIds = collectMats(fNode).map(m => m.id);
                const qCount = questions.filter(q => matIds.includes(q.material_id)).length;
                const subCount = Object.keys(fNode.children).length;
                const fc = getFolderColor(fKey);
                return (
                  <div key={fKey} className="group relative">
                    <button
                      onClick={() => { setSelectedFolder(fKey); setSelectedSubFolder(null); }}
                      className="w-full flex flex-col p-4 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                    >
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: fc.light }}>
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-slate-800 truncate pr-6">{fKey}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{subCount > 0 ? `${subCount} subfolder · ` : ''}{qCount} soal</p>
                    </button>
                    {/* Folder action buttons */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={e => { e.stopPropagation(); setRenameFolder({ oldName: fKey, newName: fKey }); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-blue-100 bg-white/80 border border-slate-200 hover:border-blue-300"
                        title="Ubah nama folder">
                        <svg width="11" height="11" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteFolder(fKey); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-rose-100 bg-white/80 border border-slate-200 hover:border-rose-300"
                        title="Hapus semua soal folder">
                        <svg width="11" height="11" fill="none" stroke="#be123c" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {rootFolders.length === 0 && rootMaterials.length === 0 && (
              <div className="flex justify-center py-16">
                <div className="text-center px-10 py-8 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                  <div className="text-5xl mb-3">🧩</div>
                  <p className="font-semibold text-slate-700">Belum ada materi</p>
                  <p className="text-sm mt-1 text-slate-500">Tambah materi di tab Materi terlebih dahulu</p>
                </div>
              </div>
            )}
          </div>
          </div>{/* end max-w-5xl */}
        </div>

        {addManualModalJSX}
        {renameFolderModalJSX}
        {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 2 — Folder View with questions
  // ═══════════════════════════════════════════════════════════════════════════
  const currentFolderNode = selectedFolder === '__root__' ? null : folderTree.children[selectedFolder];
  const subFolders = currentFolderNode ? Object.keys(currentFolderNode.children).sort() : [];

  // Stats for filter chips
  const easyCount = filteredQuestions.filter(q => q.difficulty === 'easy').length;
  const mediumCount = filteredQuestions.filter(q => q.difficulty === 'medium').length;
  const hardCount = filteredQuestions.filter(q => q.difficulty === 'hard').length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 gap-4">
          <div className="min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-xs text-slate-400 mb-1 flex-wrap">
              <span className="font-medium">Bank Soal</span>
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-slate-600 truncate max-w-[120px]">
                {selectedFolder === '__root__' ? 'Tanpa Folder' : selectedFolder}
              </span>
              {selectedSubFolder && selectedSubFolder !== '__direct__' && (
                <>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-slate-600 truncate max-w-[120px]">{selectedSubFolder}</span>
                </>
              )}
              {selectedSubFolder === '__direct__' && (
                <>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium text-slate-600">Langsung</span>
                </>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">🧩 Bank Soal</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari soal..." />
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-3 py-2 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali
            </button>
            <button
              onClick={() => setShowAddManual(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-white text-sm font-semibold rounded-xl shadow transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Manual
            </button>
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-white text-sm font-semibold rounded-xl shadow transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
              </svg>
              Generate AI
            </button>
          </div>
        </div>
        {/* Stats bar */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
            Total: {filteredQuestions.length}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm"
            style={{ background: DIFF_BG.easy, color: DIFF_TEXT.easy, border: `1px solid ${DIFF_BORDER.easy}` }}>
            Mudah: {easyCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm"
            style={{ background: DIFF_BG.medium, color: DIFF_TEXT.medium, border: `1px solid ${DIFF_BORDER.medium}` }}>
            Sedang: {mediumCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shadow-sm"
            style={{ background: DIFF_BG.hard, color: DIFF_TEXT.hard, border: `1px solid ${DIFF_BORDER.hard}` }}>
            Sulit: {hardCount}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
        {showGenerate && generatePanelJSX}

        {/* Subfolder grid */}
        {subFolders.length > 0 && !selectedSubFolder && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
              {subFolders.map(sfKey => {
                const sfNode = currentFolderNode!.children[sfKey];
                const sfQCount = questions.filter(q => sfNode.materials.map(m => m.id).includes(q.material_id)).length;
                const fc = getFolderColor(sfKey);
                return (
                  <div key={sfKey} className="group relative">
                    <button
                      onClick={() => setSelectedSubFolder(sfKey)}
                      className="w-full flex flex-col p-3 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: fc.light }}>
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-slate-800 truncate pr-6">{sfKey}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{sfNode.materials.length} materi · {sfQCount} soal</p>
                      <div className="flex justify-end mt-1.5">
                        <svg width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                    {/* Subfolder action buttons */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={e => { e.stopPropagation(); setRenameFolder({ oldName: sfKey, newName: sfKey }); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-blue-100 bg-white/80 border border-slate-200 hover:border-blue-300"
                        title="Ubah nama subfolder">
                        <svg width="11" height="11" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          // Delete all questions in this subfolder
                          const sfQIds = sfNode.materials.map(m => m.id);
                          const sfQCount = questions.filter(q => sfQIds.includes(q.material_id)).length;
                          setDialog({
                            type: 'confirm', title: 'Hapus Soal Subfolder',
                            message: `Semua ${sfQCount} soal dalam subfolder "${sfKey}" akan dihapus permanen. Lanjutkan?`,
                            confirmLabel: 'Hapus Semua',
                            onConfirm: async () => {
                              if (sfQIds.length > 0) {
                                const sfQuestionIds = questions.filter(q => sfQIds.includes(q.material_id)).map(q => q.id);
                                if (sfQuestionIds.length > 0) await supabase.from('lc_answers').delete().in('question_id', sfQuestionIds);
                                const { error } = await supabase.from('lc_questions').delete().in('material_id', sfQIds);
                                if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
                              }
                              load();
                            },
                          });
                        }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-rose-100 bg-white/80 border border-slate-200 hover:border-rose-300"
                        title="Hapus semua soal subfolder">
                        <svg width="11" height="11" fill="none" stroke="#be123c" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {currentFolderNode?.materials && currentFolderNode.materials.length > 0 && (() => {
                const fc = getFolderColor('Langsung');
                return (
                  <button
                    onClick={() => setSelectedSubFolder('__direct__')}
                    className="group flex flex-col p-3 rounded-2xl border-2 border-slate-200 bg-white hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: fc.light }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={fc.icon}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-800">Langsung</p>
                    <p className="text-xs text-slate-400 mt-0.5">{currentFolderNode.materials.length} materi</p>
                    <div className="flex justify-end mt-1.5">
                      <svg width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* Material filter chips */}
        {viewMaterials.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
            <button
              onClick={() => setSelectedMat('')}
              className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
              style={selectedMat === ''
                ? { background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: '1px solid #6366f1', boxShadow: '0 2px 6px rgba(99,102,241,0.35)' }
                : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
              Semua
            </button>
            {viewMaterials.map((m, i) => {
              const col = FOLDER_COLORS[i % FOLDER_COLORS.length];
              const active = selectedMat === m.id;
              return (
                <button key={m.id}
                  onClick={() => setSelectedMat(active ? '' : m.id)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all"
                  style={active
                    ? { background: col.gradient, color: '#fff', border: `1px solid ${col.icon}`, boxShadow: `0 2px 6px ${col.icon}40` }
                    : { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                  {m.materi_name}
                </button>
              );
            })}
          </div>
        )}

        {/* Edit Soal Modal */}
        {editQ && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
            <div className="rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#ffffff' }}>
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
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={handleSaveEdit} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all">Simpan</button>
                <button onClick={() => setEditQ(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">Batal</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Soal dikelompokkan per Materi ─── */}
        <div className="space-y-8">
          {filteredQuestions.length === 0 && (
            <div className="flex justify-center py-16">
              <div className="text-center px-10 py-8 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                <div className="text-5xl mb-3">🧩</div>
                <p className="font-semibold text-slate-700">{search ? 'Tidak ada soal yang cocok' : 'Belum ada soal di folder ini'}</p>
                {!search && <p className="text-sm mt-1 text-slate-500">Generate soal dengan AI atau tambah soal manual</p>}
              </div>
            </div>
          )}
          {viewMaterials
            .map((mat, matIdx) => ({ mat, matIdx, qs: filteredQuestions.filter(q => q.material_id === mat.id) }))
            .filter(({ qs }) => qs.length > 0)
            .map(({ mat, matIdx, qs }) => {
              const totalForMat = questions.filter(q => q.material_id === mat.id).length;
              const matColor = FOLDER_COLORS[matIdx % FOLDER_COLORS.length];

              // Group questions by batch_name within this material
              const batchKeys = Array.from(new Set(qs.map(q => q.batch_name ?? '')))
                .sort((a, b) => {
                  if (a === '') return 1; // ungrouped goes last
                  if (b === '') return -1;
                  return a.localeCompare(b);
                });

              const handleDeleteBatch = (batchKey: string) => {
                const batchQs = qs.filter(q => (q.batch_name ?? '') === batchKey);
                const label = batchKey || 'Tanpa Grup';
                setDialog({
                  type: 'confirm', title: 'Hapus Grup Soal',
                  message: `Semua ${batchQs.length} soal dalam grup "${label}" akan dihapus permanen. Lanjutkan?`,
                  confirmLabel: 'Hapus',
                  onConfirm: async () => {
                    const ids = batchQs.map(q => q.id);
                    if (ids.length > 0) {
                      await supabase.from('lc_answers').delete().in('question_id', ids);
                      const { error } = await supabase.from('lc_questions').delete().in('id', ids);
                      if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Error: ' + error.message }); return; }
                    }
                    load();
                  },
                });
              };

              return (
                <div key={mat.id}>
                  {/* Material header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ background: matColor.gradient }}>
                        📖 {mat.materi_name}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full shadow-sm">
                        {totalForMat} soal · {batchKeys.filter(b => b !== '').length} grup
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteMatGroup(mat.id, mat.materi_name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-all"
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Hapus Semua ({totalForMat})
                    </button>
                  </div>

                  {/* Batch sub-groups — collapsible accordion */}
                  <div className="space-y-2 pl-3 border-l-2" style={{ borderColor: matColor.icon + '40' }}>
                    {batchKeys.map((batchKey, batchIdx) => {
                      const batchQs = qs.filter(q => (q.batch_name ?? '') === batchKey);
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
                                ? <span className="text-xs font-bold" style={{ color: bc.text }}>📌 {batchKey}</span>
                                : <span className="text-xs font-semibold text-slate-400 italic">Tanpa Grup</span>
                              }
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border" style={{ color: bc.text, borderColor: bc.border }}>
                                {batchQs.length} soal
                              </span>
                              {/* Difficulty mini-chips */}
                              <div className="flex gap-1">
                                {easyN > 0  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIFF_BG.easy,   color: DIFF_TEXT.easy,   border: `1px solid ${DIFF_BORDER.easy}` }}>  Mudah {easyN}</span>}
                                {medN  > 0  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIFF_BG.medium, color: DIFF_TEXT.medium, border: `1px solid ${DIFF_BORDER.medium}` }}>Sedang {medN}</span>}
                                {hardN > 0  && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DIFF_BG.hard,   color: DIFF_TEXT.hard,   border: `1px solid ${DIFF_BORDER.hard}` }}>  Sulit {hardN}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); handleDeleteBatch(batchKey); }}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-rose-500 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-all"
                              >
                                <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Hapus
                              </button>
                              {/* Chevron */}
                              <svg
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
                              {batchQs.map((q, idx) => (
                                <div key={q.id} className="flex rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
                                  <div style={{
                                    width: 48, background: DIFF_BG[q.difficulty] ?? '#f8fafc',
                                    borderRight: `1px solid ${DIFF_BORDER[q.difficulty] ?? '#e2e8f0'}`,
                                    flexShrink: 0, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', paddingTop: 18,
                                  }}>
                                    <div style={{
                                      width: 28, height: 28, borderRadius: 8,
                                      background: DIFF_NUM_BG[q.difficulty] ?? 'linear-gradient(135deg,#64748b,#475569)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: '#fff', fontSize: 12, fontWeight: 900,
                                    }}>{idx + 1}</div>
                                  </div>
                                  <div style={{ flex: 1, padding: '14px 18px' }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.6, marginBottom: 10 }}>{q.question}</p>
                                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                                      {(['a', 'b', 'c', 'd'] as const).map(opt => {
                                        const isCorrect = q.correct_answer === opt.toUpperCase();
                                        return (
                                          <div key={opt} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${isCorrect ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold' : 'border-slate-200 bg-white text-slate-600'}`}>
                                            <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-0.5 ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{opt.toUpperCase()}</span>
                                            <span className="leading-snug">{(q as any)[`option_${opt}`]}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                        background: DIFF_BG[q.difficulty] ?? '#f8fafc',
                                        color: DIFF_TEXT[q.difficulty] ?? '#64748b',
                                        border: `1px solid ${DIFF_BORDER[q.difficulty] ?? '#e2e8f0'}`,
                                      }}>{DIFF_LABEL[q.difficulty] ?? q.difficulty}</span>
                                      <div className="flex gap-2">
                                        <BtnEdit onClick={() => setEditQ(q)} />
                                        <BtnDelete onClick={() => handleDelete(q.id)} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
        </div>{/* end max-w-5xl */}
      </div>

      {addManualModalJSX}
      {renameFolderModalJSX}
      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
