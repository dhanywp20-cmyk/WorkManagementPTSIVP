'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, User, Material, Question, QuizSession, fmtDate, SearchInput, AppDialog, DialogState } from './shared';

export function SessionsPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    session_name: '', material_id: '', question_count: 10,
    timer_minutes: 30, passing_grade: 70, allow_retake: true,
    target_all: true, target_user_ids: [] as string[],
    open_at: '', close_at: '',
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }, { data: q }, { data: u }] = await Promise.all([
      supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('lc_materials').select('*').order('materi_name'),
      supabase.from('lc_questions').select('id, material_id, difficulty'),
      supabase.from('users').select('id, full_name, username, role, jabatan').order('full_name'),
    ]);
    setSessions((s as QuizSession[]) ?? []);
    setMaterials(m ?? []);
    setQuestions(q ?? []);
    setTeamUsers(((u ?? []) as User[]).filter((usr: User) => !['guest'].includes(usr.role?.toLowerCase())));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleTargetUser = (uid: string) => {
    setForm(p => ({
      ...p,
      target_user_ids: p.target_user_ids.includes(uid)
        ? p.target_user_ids.filter(id => id !== uid)
        : [...p.target_user_ids, uid],
    }));
  };

  const handleCreate = async () => {
    if (!form.session_name.trim()) { setDialog({ type: 'error', message: 'Nama sesi wajib diisi!' }); return; }
    if (!form.material_id) { setDialog({ type: 'error', message: 'Pilih materi!' }); return; }
    if (!form.target_all && form.target_user_ids.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 anggota team!' }); return; }
    if (form.open_at && form.close_at && new Date(form.open_at) >= new Date(form.close_at)) {
      setDialog({ type: 'error', message: 'Waktu tutup harus setelah waktu buka!' }); return;
    }
    const mat = materials.find(m => m.id === form.material_id);
    const pool = questions.filter(q => q.material_id === form.material_id);
    if (pool.length < form.question_count) {
      setDialog({ type: 'error', message: `Hanya ada ${pool.length} soal. Kurangi jumlah soal atau generate lebih banyak.` }); return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, form.question_count);
    setSaving(true);
    const { error } = await supabase.from('lc_quiz_sessions').insert([{
      session_name: form.session_name, material_id: form.material_id, materi_name: mat?.materi_name ?? '',
      question_ids: shuffled.map(q => q.id), question_count: form.question_count,
      timer_minutes: form.timer_minutes || null, passing_grade: form.passing_grade,
      allow_retake: form.allow_retake, is_active: true, created_by: user.id,
      target_user_ids: form.target_all ? null : form.target_user_ids,
      open_at: form.open_at ? new Date(form.open_at).toISOString() : null,
      close_at: form.close_at ? new Date(form.close_at).toISOString() : null,
      scheduled_at: form.open_at ? new Date(form.open_at).toISOString() : null,
    }]);
    setSaving(false);
    if (error) { setDialog({ type: 'error', message: 'Error: ' + error.message }); return; }
    setShowForm(false);
    setForm({ session_name: '', material_id: '', question_count: 10, timer_minutes: 30, passing_grade: 70, allow_retake: true, target_all: true, target_user_ids: [], open_at: '', close_at: '' });
    load();
    setDialog({ type: 'success', message: 'Sesi quiz berhasil dibuat!' });
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('lc_quiz_sessions').update({ is_active: !current }).eq('id', id); load();
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm', title: 'Hapus Sesi Quiz',
      message: 'Sesi quiz dan semua jawaban akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus',
      onConfirm: async () => { await supabase.from('lc_quiz_sessions').delete().eq('id', id); load(); },
    });
  };

  const getSessionStatus = (s: QuizSession) => {
    const now = new Date();
    if (!s.is_active) return { label: '⭕ Non-aktif', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
    if (s.open_at && new Date(s.open_at) > now) return { label: '⏳ Belum Dibuka', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (s.close_at && new Date(s.close_at) < now) return { label: '🔒 Ditutup', cls: 'bg-rose-100 text-rose-600 border-rose-200' };
    return { label: '🟢 Aktif', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  const fmtDT = (d: string) =>
    new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filtered = search
    ? sessions.filter(s =>
        s.session_name.toLowerCase().includes(search.toLowerCase()) ||
        s.materi_name.toLowerCase().includes(search.toLowerCase())
      )
    : sessions;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">🎯 Sesi Quiz</h1>
          <p className="text-sm text-slate-500 mt-0.5">Buat & kelola sesi quiz untuk team</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari sesi..." />
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
            + Buat Sesi Quiz
          </button>
        </div>
      </div>
      <div className="p-8 space-y-6">
        {showForm && (
          <div className="rounded-2xl border border-emerald-100 shadow-lg p-6" style={{ background: '#ffffff' }}>
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
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">⏰ Waktu Dibuka</label>
                <input type="datetime-local" value={form.open_at} onChange={e => setForm(p => ({ ...p, open_at: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
                <p className="text-[10px] text-slate-400 mt-1">Kosongkan = langsung aktif sekarang</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">🔒 Waktu Ditutup</label>
                <input type="datetime-local" value={form.close_at} onChange={e => setForm(p => ({ ...p, close_at: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
                <p className="text-[10px] text-slate-400 mt-1">Kosongkan = tidak ada batas waktu</p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.allow_retake} onChange={e => setForm(p => ({ ...p, allow_retake: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                  <span className="text-sm font-medium text-slate-700">Boleh Retake</span>
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">👥 Target Penerima Quiz</label>
                <div className="flex gap-3 mb-3">
                  <button type="button" onClick={() => setForm(p => ({ ...p, target_all: true, target_user_ids: [] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_all ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                    🌐 Semua Team
                  </button>
                  <button type="button" onClick={() => setForm(p => ({ ...p, target_all: false }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${!form.target_all ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                    👤 Pilih Anggota
                  </button>
                </div>
                {!form.target_all && (
                  <div className="border border-slate-200 rounded-xl p-3 max-h-52 overflow-y-auto space-y-1">
                    {teamUsers.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Tidak ada user ditemukan</p>}
                    {teamUsers.map(u => {
                      const checked = form.target_user_ids.includes(u.id);
                      return (
                        <label key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${checked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleTargetUser(u.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 flex-shrink-0" />
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                            {u.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</p>
                            <p className="text-[10px] text-slate-400">{u.role}{u.jabatan ? ` · ${u.jabatan}` : ''}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                {!form.target_all && form.target_user_ids.length > 0 && (
                  <p className="text-xs text-indigo-600 font-semibold mt-1.5">✓ {form.target_user_ids.length} anggota dipilih</p>
                )}
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
          {filtered.length === 0 && !showForm && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🎯</div>
              <p className="font-semibold">{search ? 'Tidak ada sesi yang cocok' : 'Belum ada sesi quiz'}</p>
            </div>
          )}
          {filtered.map(s => {
            const status = getSessionStatus(s);
            const targetNames = s.target_user_ids
              ? teamUsers.filter(u => s.target_user_ids!.includes(u.id)).map(u => u.full_name)
              : null;
            return (
              <div key={s.id} className="rounded-2xl border border-white/60 shadow-sm p-5"
                style={{ background: '#ffffff' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-800">{s.session_name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{s.materi_name}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                      <span>📝 {s.question_count} soal</span>
                      <span>⏱️ {s.timer_minutes ? `${s.timer_minutes} mnt` : 'No timer'}</span>
                      <span>🎯 Passing: {s.passing_grade}%</span>
                      <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
                      <span>📅 {fmtDate(s.created_at)}</span>
                    </div>
                    {(s.open_at || s.close_at) && (
                      <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                        {s.open_at && <span className="text-amber-600 font-semibold">⏰ Buka: {fmtDT(s.open_at)}</span>}
                        {s.close_at && <span className="text-rose-600 font-semibold">🔒 Tutup: {fmtDT(s.close_at)}</span>}
                      </div>
                    )}
                    <div className="mt-2">
                      {targetNames === null ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">🌐 Semua Team</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-xs text-slate-400 font-semibold mr-1">👤</span>
                          {targetNames.slice(0, 4).map((n, i) => (
                            <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">{n}</span>
                          ))}
                          {targetNames.length > 4 && <span className="text-xs text-slate-500 font-semibold">+{targetNames.length - 4} lainnya</span>}
                        </div>
                      )}
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
            );
          })}
        </div>
      </div>
      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
