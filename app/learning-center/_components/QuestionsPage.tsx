'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase, User, Material, Question, FolderNode,
  buildFolderTree, DIFF_COLOR, SearchInput,
  generateWithGemini, fileToBase64, AppDialog, DialogState,
} from './shared';

export function QuestionsPage({ user }: { user: User }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMat, setSelectedMat] = useState<string>('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [newQ, setNewQ] = useState({
    question: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'A', difficulty: 'medium' as 'easy' | 'medium' | 'hard', material_id: '',
  });
  const [genCount, setGenCount] = useState(10);
  const [genDiff, setGenDiff] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [editQ, setEditQ] = useState<Question | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedSubFolder, setSelectedSubFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

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
      const prompt = `Kamu adalah instruktur training profesional. ${pdfFile ? 'Berdasarkan dokumen PDF yang dilampirkan' : 'Berdasarkan materi berikut'}, buat tepat ${genCount} soal pilihan ganda (A, B, C, D) dalam Bahasa Indonesia.\n${diffInstruction}\n${!pdfFile && mat?.content_text ? `\nMATERI:\n${mat.content_text.slice(0, 30000)}` : ''}\n\nKembalikan HANYA JSON array, tanpa markdown, tanpa teks lain:\n[\n  {\n    "question": "Pertanyaan lengkap?",\n    "option_a": "Jawaban A",\n    "option_b": "Jawaban B",\n    "option_c": "Jawaban C",\n    "option_d": "Jawaban D",\n    "correct_answer": "A",\n    "difficulty": "easy"\n  }\n]`;
      setGenStatus(pdfFile ? '📄 Mengirim PDF ke Gemini...' : '🧠 Generating soal...');
      const text = await generateWithGemini(prompt, pdfFile ?? null);
      setGenStatus('⚙️ Memproses hasil...');
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const match = jsonStr.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Format JSON tidak ditemukan dalam response Gemini');
      const parsed: any[] = JSON.parse(match[0]);
      const rows = parsed.map(q => ({
        material_id: selectedMat, materi_name: mat?.materi_name ?? '',
        question: q.question, option_a: q.option_a, option_b: q.option_b,
        option_c: q.option_c, option_d: q.option_d,
        correct_answer: (q.correct_answer ?? 'A').toUpperCase(),
        difficulty: q.difficulty ?? 'medium', created_by: user.id,
      }));
      setGenStatus('💾 Menyimpan soal ke database...');
      const { error } = await supabase.from('lc_questions').insert(rows);
      if (error) throw error;
      setPdfFile(null);
      if (pdfRef.current) pdfRef.current.value = '';
      setShowGenerate(false); setGenStatus(''); load();
      setDialog({ type: 'success', title: 'Generate Selesai', message: `${rows.length} soal berhasil digenerate dan disimpan!` });
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
      onConfirm: async () => { await supabase.from('lc_questions').delete().eq('id', id); load(); },
    });
  };

  const handleDeleteMatGroup = (matId: string, matName: string) => {
    const count = questions.filter(q => q.material_id === matId).length;
    setDialog({
      type: 'confirm', title: 'Hapus Semua Soal Materi',
      message: `Semua ${count} soal pada materi "${matName}" akan dihapus permanen. Lanjutkan?`,
      confirmLabel: 'Hapus Semua',
      onConfirm: async () => { await supabase.from('lc_questions').delete().eq('material_id', matId); load(); },
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
    setNewQ({ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', difficulty: 'medium', material_id: '' });
    load();
    setDialog({ type: 'success', message: 'Soal berhasil ditambahkan!' });
  };

  const goBack = () => {
    if (selectedSubFolder) { setSelectedSubFolder(null); return; }
    setSelectedFolder(null); setSelectedMat('');
  };

  const GeneratePanel = () => (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-200 p-6">
      <h3 className="font-bold text-violet-800 mb-1 flex items-center gap-2">✨ Generate Soal dengan Gemini AI</h3>
      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 mb-4 font-medium">
        ✅ PDF hanya digunakan untuk generate — <strong>tidak disimpan ke Supabase</strong>.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
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
        <button onClick={() => { setShowGenerate(false); setPdfFile(null); setGenStatus(''); if (pdfRef.current) pdfRef.current.value = ''; }}
          className="px-5 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">Batal</button>
      </div>
    </div>
  );

  // ─── Manual Add Modal ───────────────────────────────────────────────────────
  const AddManualModal = () => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
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
  );

  if (selectedFolder === null) {
    return (
      <div>
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
          style={{ background: '#ffffff' }}>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">🧩 Bank Soal</h1>
            <p className="text-sm text-slate-500 mt-0.5">{questions.length} total soal — pilih folder untuk kelola</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddManual(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
              ✏️ Tambah Manual
            </button>
            <button onClick={() => setShowGenerate(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
              ✨ Generate AI
            </button>
          </div>
        </div>
        <div className="p-8 space-y-6">
          {showGenerate && <GeneratePanel />}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">Pilih Folder Bank Soal</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {rootMaterials.length > 0 && (
                <button onClick={() => setSelectedFolder('__root__')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all">
                  <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
                    <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="#FCD34D" />
                    <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="none" stroke="#D97706" strokeWidth="1.5" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-800">Tanpa Folder</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {rootMaterials.length} materi · {questions.filter(q => rootMaterials.map(m => m.id).includes(q.material_id)).length} soal
                    </p>
                  </div>
                </button>
              )}
              {rootFolders.map(fKey => {
                const fNode = folderTree.children[fKey];
                const matIds = (() => { const c = (n: FolderNode): Material[] => [...n.materials, ...Object.values(n.children).flatMap(c)]; return c(fNode).map(m => m.id); })();
                const qCount = questions.filter(q => matIds.includes(q.material_id)).length;
                const subCount = Object.keys(fNode.children).length;
                return (
                  <button key={fKey} onClick={() => { setSelectedFolder(fKey); setSelectedSubFolder(null); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all">
                    <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
                      <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="#FBBF24" />
                      <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="none" stroke="#D97706" strokeWidth="1.5" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-800">{fKey}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{subCount > 0 ? `${subCount} subfolder · ` : ''}{qCount} soal</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {rootFolders.length === 0 && rootMaterials.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">🧩</div>
                <p className="font-semibold">Belum ada materi. Tambah materi di tab Materi terlebih dahulu.</p>
              </div>
            )}
          </div>
        </div>
        {showAddManual && <AddManualModal />}
        {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
      </div>
    );
  }

  const currentFolderNode = selectedFolder === '__root__' ? null : folderTree.children[selectedFolder];
  const subFolders = currentFolderNode ? Object.keys(currentFolderNode.children).sort() : [];

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">🧩 Bank Soal</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {selectedSubFolder && selectedSubFolder !== '__direct__'
              ? `${selectedFolder} / ${selectedSubFolder} — ${filteredQuestions.length} soal`
              : selectedFolder === '__root__' ? `Tanpa Folder — ${filteredQuestions.length} soal`
              : `${selectedFolder} — ${filteredQuestions.length} soal`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari soal..." />
          <button onClick={goBack} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-1.5">← Kembali</button>
          <button onClick={() => setShowAddManual(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">✏️ Tambah Manual</button>
          <button onClick={() => setShowGenerate(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">✨ Generate AI</button>
        </div>
      </div>
      <div className="p-8 space-y-6">
        {showGenerate && <GeneratePanel />}

        {subFolders.length > 0 && !selectedSubFolder && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">Subfolder</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {subFolders.map(sfKey => {
                const sfNode = currentFolderNode!.children[sfKey];
                const sfQCount = questions.filter(q => sfNode.materials.map(m => m.id).includes(q.material_id)).length;
                return (
                  <button key={sfKey} onClick={() => setSelectedSubFolder(sfKey)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all">
                    <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                      <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="#FBBF24" />
                      <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="none" stroke="#D97706" strokeWidth="1.5" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-800">{sfKey}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{sfNode.materials.length} materi · {sfQCount} soal</p>
                    </div>
                  </button>
                );
              })}
              {currentFolderNode?.materials && currentFolderNode.materials.length > 0 && (
                <button onClick={() => setSelectedSubFolder('__direct__')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all">
                  <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                    <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="#FCD34D" />
                    <path d="M4 15C4 13.34 5.34 12 7 12H18L22 16H41C42.66 16 44 17.34 44 19V37C44 38.66 42.66 40 41 40H7C5.34 40 4 38.66 4 37V15z" fill="none" stroke="#D97706" strokeWidth="1.5" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-800">Langsung</p>
                    <p className="text-xs text-slate-500 mt-0.5">{currentFolderNode.materials.length} materi</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {viewMaterials.length > 0 && (
          <div className="flex gap-3 items-center">
            <select value={selectedMat} onChange={e => setSelectedMat(e.target.value)}
              className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
              <option value="">Semua Materi di Folder Ini</option>
              {viewMaterials.map(m => <option key={m.id} value={m.id}>{m.materi_name}</option>)}
            </select>
            <span className="text-sm text-slate-500">{filteredQuestions.length} soal</span>
          </div>
        )}

        {/* Edit Soal Modal */}
        {editQ && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
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
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🧩</div>
              <p className="font-semibold">{search ? 'Tidak ada soal yang cocok' : 'Belum ada soal di folder ini'}</p>
              {!search && <p className="text-sm mt-1">Generate soal dengan AI atau tambah soal manual</p>}
            </div>
          )}
          {viewMaterials
            .map(mat => ({ mat, qs: filteredQuestions.filter(q => q.material_id === mat.id) }))
            .filter(({ qs }) => qs.length > 0)
            .map(({ mat, qs }) => {
              const totalForMat = questions.filter(q => q.material_id === mat.id).length;
              return (
                <div key={mat.id}>
                  {/* Group header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-widest inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
                        📖 {mat.materi_name}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold bg-white border border-slate-200 px-2.5 py-0.5 rounded-full shadow-sm">
                        {totalForMat} soal
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteMatGroup(mat.id, mat.materi_name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-all">
                      🗑️ Hapus Semua ({totalForMat})
                    </button>
                  </div>
                  {/* Questions in this group */}
                  <div className="space-y-3">
                    {qs.map((q, idx) => (
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
                            <button onClick={() => setEditQ(q)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-all" title="Edit soal">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(q.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-all" title="Hapus soal ini">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
      {showAddManual && <AddManualModal />}
      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
