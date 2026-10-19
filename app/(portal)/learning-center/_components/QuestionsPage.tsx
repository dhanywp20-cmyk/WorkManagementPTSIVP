'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ModalPortal } from '@/components/shared';
import { bandingkanUrutan, perubahanUrutan, geser, nomorBerikutnya } from '@/lib/urutan-soal';
import {
  supabase, User, Material, Question, FolderNode,
  buildFolderTree, DIFF_COLOR, SearchInput,
  generateWithGemini, fileToBase64, MAX_PDF_BYTES, AppDialog, DialogState,
  BtnEdit, BtnDelete, ambilDaftarModel, type ModelAI,
} from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { GrupBatchSoal } from './soal/GrupBatchSoal';
import { GridSubfolderSoal } from './soal/GridSubfolderSoal';
import { HeaderBankSoal } from './soal/HeaderBankSoal';
import { IsiFolderSoal } from './soal/IsiFolderSoal';
import { DialogFormSoal } from './soal/DialogFormSoal';
import { HasilBandingSoal } from './soal/HasilBandingSoal';
import { IsianGenerateSoal } from './soal/IsianGenerateSoal';
import { useUrutanSoal } from './useUrutanSoal';
import { useKelolaSoal } from './useKelolaSoal';
import { useBuatSoal } from './useBuatSoal';
import { IsiBankSoal } from './IsiBankSoal';
import { KepalaTambahSoal } from './KepalaTambahSoal';
import { PilihModelGen } from './PilihModelGen';

// Folder color palette
export const FOLDER_COLORS = [
  { gradient: 'linear-gradient(135deg,#3b82f6,#4f46e5)', light: '#dbeafe', icon: '#3b82f6' },
  { gradient: 'linear-gradient(135deg,#10b981,#0d9488)', light: '#d1fae5', icon: '#10b981' },
  { gradient: 'linear-gradient(135deg,#8b5cf6,#9333ea)', light: '#ede9fe', icon: '#8b5cf6' },
  { gradient: 'linear-gradient(135deg,#f59e0b,#f97316)', light: '#fef3c7', icon: '#f59e0b' },
  { gradient: 'linear-gradient(135deg,#f43f5e,#db2777)', light: '#ffe4e6', icon: '#f43f5e' },
  { gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)', light: '#cffafe', icon: '#06b6d4' },
];
export const getFolderColor = (name: string) => FOLDER_COLORS[name.charCodeAt(0) % FOLDER_COLORS.length];

// Difficulty helpers
export const DIFF_BG: Record<string, string> = { easy: '#ecfdf5', medium: '#fffbeb', hard: '#fff1f2' };
export const DIFF_BORDER: Record<string, string> = { easy: '#d1fae5', medium: '#fef3c7', hard: '#ffe4e6' };
export const DIFF_TEXT: Record<string, string> = { easy: '#065f46', medium: '#92400e', hard: '#be123c' };
export const DIFF_NUM_BG: Record<string, string> = {
  easy: 'linear-gradient(135deg,#10b981,#059669)',
  medium: 'linear-gradient(135deg,#f59e0b,#d97706)',
  hard: 'linear-gradient(135deg,#f43f5e,#e11d48)',
};
export const DIFF_LABEL: Record<string, string> = { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' };

/** Satu sisi hasil banding dua model AI. */
export interface SisiBanding { model: string; rows: Record<string, unknown>[]; galat: string }

export function QuestionsPage({ user }: { user: User }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMat, setSelectedMat] = useState<string>('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  /*
    Menambah soal LANGSUNG ke grup yang sedang dibuka, bukan lewat tombol
    "Tambah Manual" di kepala halaman.

    Keduanya menambah satu soal, tapi titik berangkatnya berbeda dan itu yang
    menentukan bedanya. Dari kepala halaman, materi dan nama grupnya belum
    diketahui - keduanya harus dipilih dan diketik ulang, dan salah ketik satu
    huruf pada nama grup diam-diam melahirkan grup kedua yang tampak sama.
    Dari dalam grupnya, keduanya sudah pasti. Karena itu tombol lama tidak
    diubah maupun dihilangkan: ia dipakai ketika grupnya memang belum ada.
  */
  const [modeGrup, setModeGrup] = useState(false);
  const [newQ, setNewQ] = useState({
    question: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'A', difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    material_id: '', batch_name: '',
    question_type: 'abcd' as 'abcd' | 'essay', model_answer: '',
    /** Hanya berarti untuk soal essay - lihat sql/learning-center-essay-gambar.sql. */
    answer_format: 'text' as 'text' | 'image',
    /** Gambar opsional soal (migrasi 054); '' = tanpa gambar. */
    gambar_url: '',
  });
  const [genCount, setGenCount] = useState(10);
  const [genDiff, setGenDiff] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  // Tipe soal untuk panel Generate AI - soal essay tidak dicampur dengan ABCD dalam satu batch generate
  const [genType, setGenType] = useState<'abcd' | 'essay'>('abcd');
  const [batchName, setBatchName] = useState('');

  /*
    Bandingkan dua model pada materi yang sama.

    Ada karena pertanyaan "model mana yang lebih baik untuk soal saya" tidak
    bisa dijawab dari spesifikasi. Model yang unggul di tolok ukur umum belum
    tentu unggul pada materi teknis AV berbahasa Indonesia - dan satu-satunya
    cara tahu adalah melihat keluarannya berdampingan pada materi yang benar-
    benar dipakai.

    Pembuat soal jalan sesekali, jadi dua panggilan sekali coba tidak
    mengganggu jatah - berbeda dengan penilaian, di mana jumlah panggilan
    justru menjadi soal utamanya.
  */
  const [modeBanding, setModeBanding] = useState(false);
  const [modelBandingA, setModelBandingA] = useState('');
  const [modelBandingB, setModelBandingB] = useState('');
  const [daftarModelGen, setDaftarModelGen] = useState<ModelAI[]>([]);
  const [hasilBanding, setHasilBanding] = useState<{ a: SisiBanding; b: SisiBanding } | null>(null);

  useEffect(() => {
    ambilDaftarModel()
      .then(m => {
        setDaftarModelGen(m);
        // Isian awal: dua model teratas yang berbeda, supaya tombolnya langsung
        // bisa ditekan tanpa memilih apa pun dulu.
        if (m.length > 0) { setModelBandingA(p => p || m[0].id); }
        if (m.length > 1) { setModelBandingB(p => p || m[1].id); }
      })
      .catch(() => { /* daftar gagal - mode banding disembunyikan, lihat render */ });
  }, []);
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
  // collapsed state: key = `${matId}__${batchKey}` - collapsed by default
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

  /*
    Apakah kolom `urutan` sudah ada di database.

    Diintip dari baris yang sudah termuat, bukan dari kueri terpisah:
    PostgREST menghilangkan kunci untuk kolom yang tidak ada, sementara kolom
    yang ada tapi belum diisi tetap muncul sebagai null. Bedanya itu yang
    dipakai - dan cara ini tidak menambah satu pun permintaan.

    Yang sengaja TIDAK dilakukan: menaruh .order('urutan') pada kueri
    pemuatannya. Kalau kolomnya belum ada, seluruh kueri ditolak dan daftarnya
    tampil KOSONG - persis kegagalan diam-diam yang pernah membuat daftar
    Incentive mendadak kosong sebelum SQL-nya dijalankan. Pengurutan dikerjakan
    di sisi klien, jadi tanpa kolomnya pun daftarnya tetap utuh; yang hilang
    hanya tombol pengaturnya.
  */
  const kolomUrutanAda = questions.length > 0
    && Object.prototype.hasOwnProperty.call(questions[0], 'urutan');

  const KOSONG_SOAL = {
    question: '', option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: 'A', model_answer: '', gambar_url: '',
  } as const;

  /**
   * Panggil AI sekali dan kembalikan baris soal siap simpan.
   *
   * Dipisah dari penyimpanannya supaya bisa dipanggil DUA kali dengan model
   * berbeda tanpa satu pun menyentuh database - itu inti fitur banding: yang
   * kalah tidak boleh meninggalkan jejak apa pun.
   */
  const { hasilkanSoal, simpanHasil, handleGenerate, handleBanding } = useBuatSoal({ batchName, genCount, genDiff, genExtraPrompt, genType, kolomUrutanAda, load, materials, modelBandingA, modelBandingB, pdfFile, pdfRef, questions, selectedMat, setBatchName, setDialog, setGenExtraPrompt, setGenStatus, setGenerating, setHasilBanding, setPdfFile, setShowGenerate, user });


  const { handleDelete, handleDeleteMatGroup, handleSaveEdit, handleAddManual } = useKelolaSoal({ KOSONG_SOAL, editQ, kolomUrutanAda, load, materials, modeGrup, newQ, questions, setDialog, setEditQ, setNewQ, setShowAddManual, user });


  /** Buka form tambah soal dengan materi & grup yang sudah terkunci dari konteks. */
  const bukaTambahDiGrup = (materialId: string, batchKey: string) => {
    setNewQ({
      ...KOSONG_SOAL, difficulty: 'medium', question_type: 'abcd', answer_format: 'text',
      material_id: materialId, batch_name: batchKey,
    });
    setModeGrup(true);
    setShowAddManual(true);
  };

  const tutupTambahManual = () => { setShowAddManual(false); setModeGrup(false); };


  /*
    Penyusunan ulang ditahan dulu di layar, tidak langsung dikirim.

    Menyusun urutan itu pekerjaan yang berlangsung: soal ke-7 naik empat
    tingkat berarti empat kali tekan, dan menyimpan tiap tekanan berarti empat
    perjalanan ke database untuk satu keputusan yang belum selesai diambil.
    Menahannya juga berarti salah tekan bisa dibatalkan - selama belum
    disimpan, tidak ada apa pun di database yang berubah.

    Kunci petanya sama dengan kunci buka-tutup grup, jadi tiap grup punya
    rancangannya sendiri dan menyusun satu grup tidak mengganggu yang lain.
    Isinya daftar id, bukan nomor - nomornya baru dihitung saat disimpan,
    supaya rancangan yang tertinggal tidak pernah menyimpan angka basi.
  */
  const [urutanDraf, setUrutanDraf] = useState<Record<string, string[]>>({});
  const [menyimpanUrutan, setMenyimpanUrutan] = useState<string | null>(null);

  /**
   * Susunan yang TAMPIL untuk satu grup: rancangan bila ada, kalau tidak
   * susunan tersimpan.
   *
   * Soal yang belum ada di rancangan - misalnya baru ditambahkan saat
   * rancangannya masih terbuka - diletakkan di ekor, bukan dibuang. Tanpa itu
   * soal yang baru saja disimpan akan hilang dari layar sampai halamannya
   * dimuat ulang.
   */
  const { susunanTampil, geserSoal, buangDraf, simpanUrutan } = useUrutanSoal({ load, setDialog, setMenyimpanUrutan, setUrutanDraf, urutanDraf });

  const goBack = () => {
    if (selectedSubFolder) { setSelectedSubFolder(null); return; }
    setSelectedFolder(null); setSelectedMat('');
  };

  // Rename Folder Modal
  const renameFolderModalJSX = renameFolder ? (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 flex items-center justify-center z-1000 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-slate-800 mb-1 text-base"><IkonTeks nama="✏" />Ubah Nama Folder</h3>
        <p className="text-xs text-slate-500 mb-4">Semua materi dalam folder ini akan diperbarui secara otomatis.</p>
        <input
          value={renameFolder?.newName ?? ''}
          onChange={e => setRenameFolder(p => p && ({ ...p, newName: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setRenameFolder(null); }}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-4"
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
  </ModalPortal>
  ) : null;

  // Gemini usage helper
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

  // Generate Panel (plain JSX var - NOT a sub-component, avoids remount on every keystroke)
  const generatePanelJSX = (
    <div className="bg-linear-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-200 p-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-violet-800 flex items-center gap-2"><IkonTeks nama="✨" />Generate Soal dengan Gemini AI</h3>
        {/* Gemini usage badge */}
        <div className="flex items-center gap-2 text-[11px] font-semibold shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${geminiRemaining <= 5 ? 'bg-rose-50 border-rose-200 text-rose-700' : geminiRemaining <= 15 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <span>{geminiRemaining <= 5 ? '⚠️' : geminiRemaining <= 15 ? '🟡' : '🟢'}</span>
            <span>Hari ini: <strong>{geminiUsage.count}</strong> kali</span>
            <span className="text-slate-400">|</span>
            <span>Sisa ~<strong>{geminiRemaining}</strong></span>
          </div>
          {geminiLastUsedStr && (
            <span className="text-slate-500 text-[11px]">Terakhir: {geminiLastUsedStr}</span>
          )}
        </div>
      </div>
      {/* Limit info */}
      <div className="flex items-start gap-2 text-xs bg-violet-100/60 border border-violet-200 rounded-xl px-3 py-2 mb-4">
        <span><Ikon nama="ℹ" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <span className="text-violet-700">Gemini 2.5 Flash free tier: <strong>10 req/menit</strong>, ~<strong>50 req/hari</strong>. Jika error limit, tunggu 1 menit atau coba besok.</span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest mr-1">Tipe Soal</span>
        {(['abcd', 'essay'] as const).map(t => (
          <button key={t} type="button" onClick={() => setGenType(t)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${genType === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-violet-50'}`}>
            {t === 'abcd' ? '🔤 Pilihan Ganda (ABCD)' : '📝 Essay'}
          </button>
        ))}
      </div>
      <IsianGenerateSoal
        batchName={batchName} genCount={genCount} genDiff={genDiff} genExtraPrompt={genExtraPrompt} materials={materials} pdfFile={pdfFile} pdfRef={pdfRef} selectedMat={selectedMat} setBatchName={setBatchName} setDialog={setDialog} setGenCount={setGenCount} setGenDiff={setGenDiff} setGenExtraPrompt={setGenExtraPrompt} setPdfFile={setPdfFile} setSelectedMat={setSelectedMat} viewMaterials={viewMaterials}
      />
      {/* ── Mode: satu model, atau bandingkan dua ──────────────────────────
          Saklarnya hanya muncul bila daftar model bisa dibaca. Menawarkan
          perbandingan yang pasti gagal karena modelnya tidak bisa dipilih
          hanya membuang waktu orang. */}
      <PilihModelGen
        daftarModelGen={daftarModelGen} modeBanding={modeBanding} modelBandingA={modelBandingA} modelBandingB={modelBandingB} setHasilBanding={setHasilBanding} setModeBanding={setModeBanding} setModelBandingA={setModelBandingA} setModelBandingB={setModelBandingB}
      />

      {genStatus && (
        <div className="mb-4 flex items-center gap-2 text-sm text-violet-700 bg-violet-100 border border-violet-200 rounded-xl px-4 py-2.5 font-medium">
          <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin shrink-0" />
          {genStatus}
        </div>
      )}

      {/* ── Hasil banding: berdampingan, dan HANYA satu yang bisa disimpan ── */}
      <HasilBandingSoal
        generating={generating} hasilBanding={hasilBanding} setHasilBanding={setHasilBanding} simpanHasil={simpanHasil}
      />

      <div className="flex gap-3">
        <button onClick={modeBanding ? handleBanding : handleGenerate} disabled={generating}
          className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-60 flex items-center gap-2">
          {generating
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{modeBanding ? 'Membandingkan...' : 'Generating...'}</>
            : (modeBanding ? '⚖️ Bandingkan Sekarang' : '✨ Generate Sekarang')}
        </button>
        <button onClick={() => { setShowGenerate(false); setPdfFile(null); setGenStatus(''); setBatchName(''); setGenExtraPrompt(''); setHasilBanding(null); if (pdfRef.current) pdfRef.current.value = ''; }}
          className="px-5 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">Batal</button>
      </div>
    </div>
  );

  // Manual Add Modal (plain JSX var - NOT a sub-component, avoids remount on every keystroke)
  const addManualModalJSX = showAddManual ? (
  <ModalPortal>
    <DialogFormSoal
      handleAddManual={handleAddManual} materials={materials} modeGrup={modeGrup} newQ={newQ} setNewQ={setNewQ} tutupTambahManual={tutupTambahManual} viewMaterials={viewMaterials}
    />
  </ModalPortal>
  ) : null;

  // SCREEN 1 - Folder Selection
  if (selectedFolder === null) {
    return (
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <KepalaTambahSoal
          questions={questions} rootFolders={rootFolders} setShowAddManual={setShowAddManual} setShowGenerate={setShowGenerate}
        />

        {/* ── Content ── */}
        <IsiFolderSoal
          folderTree={folderTree} generatePanelJSX={generatePanelJSX} handleDeleteFolder={handleDeleteFolder} questions={questions} rootFolders={rootFolders} rootMaterials={rootMaterials} setRenameFolder={setRenameFolder} setSelectedFolder={setSelectedFolder} setSelectedSubFolder={setSelectedSubFolder} showGenerate={showGenerate}
        />

        {addManualModalJSX}
        {renameFolderModalJSX}
        {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
      </div>
    );
  }

  // SCREEN 2 - Folder View with questions
  const currentFolderNode = selectedFolder === '__root__' ? null : folderTree.children[selectedFolder];
  const subFolders = currentFolderNode ? Object.keys(currentFolderNode.children).sort() : [];

  // Stats for filter chips
  const easyCount = filteredQuestions.filter(q => q.difficulty === 'easy').length;
  const mediumCount = filteredQuestions.filter(q => q.difficulty === 'medium').length;
  const hardCount = filteredQuestions.filter(q => q.difficulty === 'hard').length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <HeaderBankSoal
        easyCount={easyCount} filteredQuestions={filteredQuestions} goBack={goBack} hardCount={hardCount} mediumCount={mediumCount} search={search} selectedFolder={selectedFolder} selectedSubFolder={selectedSubFolder} setSearch={setSearch} setShowAddManual={setShowAddManual} setShowGenerate={setShowGenerate}
      />

      {/* ── Content ── */}
      <IsiBankSoal
        buangDraf={buangDraf} bukaTambahDiGrup={bukaTambahDiGrup} currentFolderNode={currentFolderNode} editQ={editQ} expandedBatches={expandedBatches} filteredQuestions={filteredQuestions} generatePanelJSX={generatePanelJSX} geserSoal={geserSoal} handleDelete={handleDelete} handleDeleteMatGroup={handleDeleteMatGroup} handleSaveEdit={handleSaveEdit} kolomUrutanAda={kolomUrutanAda} load={load} menyimpanUrutan={menyimpanUrutan} questions={questions} search={search} selectedMat={selectedMat} selectedSubFolder={selectedSubFolder} setDialog={setDialog} setEditQ={setEditQ} setExpandedBatches={setExpandedBatches} setRenameFolder={setRenameFolder} setSelectedMat={setSelectedMat} setSelectedSubFolder={setSelectedSubFolder} showGenerate={showGenerate} simpanUrutan={simpanUrutan} subFolders={subFolders} susunanTampil={susunanTampil} urutanDraf={urutanDraf} viewMaterials={viewMaterials}
      />

      {addManualModalJSX}
      {renameFolderModalJSX}
      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
