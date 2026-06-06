'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, User, Material, Question, QuizSession, fmtDate, SearchInput, AppDialog, DialogState, BtnDelete } from './shared';

export function SessionsPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    session_name: '', material_id: '', batch_filter: '',
    question_count: 10, timer_minutes: 30, passing_grade: 70,
    allow_retake: true, target_mode: 'all' as 'all' | 'role' | 'user' | 'division',
    target_roles: [] as string[],
    target_user_ids: [] as string[],
    target_divisions: [] as string[],
    open_at: '', close_at: '',
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }, { data: q }, { data: u }] = await Promise.all([
      supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('lc_materials').select('*').order('materi_name'),
      supabase.from('lc_questions').select('id, material_id, difficulty, batch_name'),
      supabase.from('users').select('id, full_name, username, role, jabatan, sales_division').order('full_name'),
    ]);
    setSessions((s as QuizSession[]) ?? []);
    setMaterials(m ?? []);
    setQuestions(q ?? []);
    setTeamUsers((u ?? []) as User[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const uniqueRoles = [...new Set(teamUsers.map(u => (u.role ?? '').toLowerCase()).filter(Boolean))].sort();

  const roleLabel: Record<string, string> = {
    admin: '🔑 Admin', superadmin: '👑 Super Admin',
    team: '👥 Team', marketing: '📣 Marketing', guest: '👤 Guest',
  };

  const toggleTargetUser = (uid: string) => {
    setForm(p => ({
      ...p,
      target_user_ids: p.target_user_ids.includes(uid)
        ? p.target_user_ids.filter(id => id !== uid)
        : [...p.target_user_ids, uid],
    }));
  };

  const toggleTargetRole = (role: string) => {
    setForm(p => ({
      ...p,
      target_roles: p.target_roles.includes(role)
        ? p.target_roles.filter(r => r !== role)
        : [...p.target_roles, role],
    }));
  };

  const toggleTargetDivision = (div: string) => {
    setForm(p => ({
      ...p,
      target_divisions: p.target_divisions.includes(div)
        ? p.target_divisions.filter(d => d !== div)
        : [...p.target_divisions, div],
    }));
  };

  const uniqueDivisions = [...new Set(teamUsers.map(u => (u as any).sales_division).filter(Boolean))].sort();

  const handleCreate = async () => {
    if (!form.session_name.trim()) { setDialog({ type: 'error', message: 'Nama sesi wajib diisi!' }); return; }
    if (!form.material_id) { setDialog({ type: 'error', message: 'Pilih materi!' }); return; }
    if (form.target_mode === 'role' && form.target_roles.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 role!' }); return; }
    if (form.target_mode === 'user' && form.target_user_ids.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 anggota!' }); return; }
    if (form.target_mode === 'division' && form.target_divisions.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 sales division!' }); return; }
    if (form.open_at && form.close_at && new Date(form.open_at) >= new Date(form.close_at)) {
      setDialog({ type: 'error', message: 'Waktu tutup harus setelah waktu buka!' }); return;
    }
    const mat = materials.find(m => m.id === form.material_id);
    const pool = questions.filter(q =>
      q.material_id === form.material_id &&
      (!form.batch_filter || (q as any).batch_name === form.batch_filter)
    );
    if (pool.length < form.question_count) {
      const batchInfo = form.batch_filter ? ` di grup "${form.batch_filter}"` : '';
      setDialog({ type: 'error', message: `Hanya ada ${pool.length} soal${batchInfo}. Kurangi jumlah soal atau generate lebih banyak.` }); return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, form.question_count);
    let resolvedTargetIds: string[] | null = null;
    if (form.target_mode === 'role') {
      resolvedTargetIds = teamUsers
        .filter(u => form.target_roles.includes((u.role ?? '').toLowerCase()))
        .map(u => u.id);
    } else if (form.target_mode === 'user') {
      resolvedTargetIds = form.target_user_ids;
    } else if (form.target_mode === 'division') {
      resolvedTargetIds = teamUsers
        .filter(u => form.target_divisions.includes((u as any).sales_division ?? ''))
        .map(u => u.id);
    }
    setSaving(true);
    const { error } = await supabase.from('lc_quiz_sessions').insert([{
      session_name: form.session_name, material_id: form.material_id,
      materi_name: form.batch_filter ? `${mat?.materi_name ?? ''} — ${form.batch_filter}` : (mat?.materi_name ?? ''),
      question_ids: shuffled.map(q => q.id), question_count: form.question_count,
      timer_minutes: form.timer_minutes || null, passing_grade: form.passing_grade,
      allow_retake: form.allow_retake, is_active: true, created_by: user.id,
      target_user_ids: resolvedTargetIds,
      open_at: form.open_at ? new Date(form.open_at).toISOString() : null,
      close_at: form.close_at ? new Date(form.close_at).toISOString() : null,
      scheduled_at: form.open_at ? new Date(form.open_at).toISOString() : null,
    }]);
    setSaving(false);
    if (error) { setDialog({ type: 'error', message: 'Error: ' + error.message }); return; }
    setShowForm(false);
    setForm({ session_name: '', material_id: '', batch_filter: '', question_count: 10, timer_minutes: 30, passing_grade: 70, allow_retake: true, target_mode: 'all', target_roles: [], target_user_ids: [], target_divisions: [], open_at: '', close_at: '' });
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
      onConfirm: async () => {
        // 1. Ambil semua attempt yang terkait sesi ini
        const { data: attempts } = await supabase
          .from('lc_quiz_attempts')
          .select('id')
          .eq('quiz_session_id', id);

        // 2. Hapus answer records untuk setiap attempt (jika tabel lc_answer_records ada FK ke attempts)
        if (attempts && attempts.length > 0) {
          const attemptIds = attempts.map((a: any) => a.id);
          await supabase.from('lc_answer_records').delete().in('attempt_id', attemptIds);
        }

        // 3. Hapus semua attempts terkait sesi ini
        await supabase.from('lc_quiz_attempts').delete().eq('quiz_session_id', id);

        // 4. Baru hapus sesi-nya
        const { error } = await supabase.from('lc_quiz_sessions').delete().eq('id', id);
        if (error) {
          setDialog({ type: 'error', title: 'Gagal Menghapus', message: 'Error: ' + error.message });
          return;
        }
        load();
      },
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
    <div>
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
                <select value={form.material_id}
                  onChange={e => setForm(p => ({ ...p, material_id: e.target.value, batch_filter: '' }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
                  <option value="">-- Pilih Materi --</option>
                  {materials.map(m => {
                    const total = questions.filter(q => q.material_id === m.id).length;
                    const batches = [...new Set(questions.filter(q => q.material_id === m.id && (q as any).batch_name).map(q => (q as any).batch_name))];
                    return (
                      <option key={m.id} value={m.id}>
                        {m.materi_name} ({total} soal{batches.length > 0 ? `, ${batches.length} grup` : ''})
                      </option>
                    );
                  })}
                </select>
              </div>
              {/* ── Batch / Grup selector — dropdown, muncul setelah material dipilih dan punya batch ── */}
              {(() => {
                if (!form.material_id) return null;
                const batches = [...new Set(
                  questions.filter(q => q.material_id === form.material_id && (q as any).batch_name)
                    .map(q => (q as any).batch_name as string)
                )].sort();
                if (batches.length === 0) return null;
                return (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                      Grup / Batch Soal
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400 normal-case tracking-normal">Optional</span>
                    </label>
                    <select
                      value={form.batch_filter}
                      onChange={e => setForm(p => ({ ...p, batch_filter: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
                    >
                      <option value="">-- Semua Grup ({questions.filter(q => q.material_id === form.material_id).length} soal dicampur) --</option>
                      {batches.map(b => {
                        const count = questions.filter(q => q.material_id === form.material_id && (q as any).batch_name === b).length;
                        return <option key={b} value={b}>📌 {b} ({count} soal)</option>;
                      })}
                    </select>
                    {form.batch_filter && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
                        ✓ Hanya soal dari grup <strong>"{form.batch_filter}"</strong> yang akan dipakai
                      </p>
                    )}
                  </div>
                );
              })()}
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
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, target_mode: 'all', target_roles: [], target_user_ids: [], target_divisions: [] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'all' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                    🌐 Semua
                  </button>
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, target_mode: 'role', target_user_ids: [], target_divisions: [] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'role' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                    🏷️ Per Role
                  </button>
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, target_mode: 'division', target_roles: [], target_user_ids: [] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'division' ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}>
                    🏢 Per Sales Division
                  </button>
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, target_mode: 'user', target_roles: [], target_divisions: [] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'user' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                    👤 Per Anggota
                  </button>
                </div>

                {form.target_mode === 'all' && (
                  <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 font-medium">
                    🌐 Quiz akan dikirim ke <strong>semua user</strong> (team, marketing, guest, dll.)
                  </p>
                )}

                {form.target_mode === 'role' && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Pilih role yang akan menerima quiz ini:</p>
                    <div className="border border-slate-200 rounded-xl p-3 space-y-1">
                      {uniqueRoles.length === 0 && <p className="text-xs text-slate-400 text-center py-3">Tidak ada role ditemukan</p>}
                      {uniqueRoles.map(role => {
                        const checked = form.target_roles.includes(role);
                        const count = teamUsers.filter(u => (u.role ?? '').toLowerCase() === role).length;
                        return (
                          <label key={role} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${checked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleTargetRole(role)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-800 flex-1">
                              {roleLabel[role] ?? `📌 ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{count} user</span>
                          </label>
                        );
                      })}
                    </div>
                    {form.target_roles.length > 0 && (
                      <p className="text-xs text-indigo-600 font-semibold mt-1.5">
                        ✓ {form.target_roles.length} role dipilih · {teamUsers.filter(u => form.target_roles.includes((u.role ?? '').toLowerCase())).length} user
                      </p>
                    )}
                  </div>
                )}

                {form.target_mode === 'division' && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Pilih Sales Division yang akan menerima quiz ini:</p>
                    <div className="border border-slate-200 rounded-xl p-3 space-y-1">
                      {uniqueDivisions.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-3">Tidak ada sales division ditemukan. Pastikan field <code>sales_division</code> diisi di data user.</p>
                      )}
                      {uniqueDivisions.map(div => {
                        const checked = form.target_divisions.includes(div);
                        const count = teamUsers.filter(u => (u as any).sales_division === div).length;
                        return (
                          <label key={div} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${checked ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleTargetDivision(div)}
                              className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400 flex-shrink-0" />
                            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-bold flex-shrink-0">
                              🏢
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800">{div}</p>
                            </div>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{count} user</span>
                          </label>
                        );
                      })}
                    </div>
                    {form.target_divisions.length > 0 && (
                      <p className="text-xs text-orange-600 font-semibold mt-1.5">
                        ✓ {form.target_divisions.length} divisi dipilih · {teamUsers.filter(u => form.target_divisions.includes((u as any).sales_division ?? '')).length} user
                      </p>
                    )}
                  </div>
                )}

                {form.target_mode === 'user' && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Pilih anggota secara individual:</p>
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
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</p>
                              <p className="text-[10px] text-slate-400">{u.role}{u.jabatan ? ` · ${u.jabatan}` : ''}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {form.target_user_ids.length > 0 && (
                      <p className="text-xs text-indigo-600 font-semibold mt-1.5">✓ {form.target_user_ids.length} anggota dipilih</p>
                    )}
                  </div>
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
            <div className="flex justify-center py-16">
              <div className="text-center px-10 py-8 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                <div className="text-5xl mb-3">🎯</div>
                <p className="font-semibold text-slate-700">{search ? 'Tidak ada sesi yang cocok' : 'Belum ada sesi quiz'}</p>
                {!search && <p className="text-sm mt-1 text-slate-500">Klik + Buat Sesi Quiz untuk memulai</p>}
              </div>
            </div>
          )}
          {filtered.map(s => {
            const status = getSessionStatus(s);
            const targetNames = s.target_user_ids
              ? teamUsers.filter(u => s.target_user_ids!.includes(u.id)).map(u => u.full_name)
              : null;
            return (
              <div key={s.id} className="stagger-item rounded-2xl border border-white/60 shadow-sm p-5"
                style={{ background: '#ffffff' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-800">{s.session_name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${status.cls}`}>{status.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {s.materi_name.includes(' — ') ? (
                        <>
                          <span className="text-sm text-slate-500">{s.materi_name.split(' — ')[0]}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 border border-violet-200">
                            📌 {s.materi_name.split(' — ').slice(1).join(' — ')}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-slate-500">{s.materi_name}</span>
                      )}
                    </div>
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
                      ) : targetNames.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">—</span>
                      ) : (() => {
                        // Try to detect if this was a division-targeted session
                        const divMatches = [...new Set(
                          teamUsers.filter(u => s.target_user_ids?.includes(u.id) && (u as any).sales_division)
                            .map(u => (u as any).sales_division as string)
                        )];
                        const allFromDivisions = divMatches.length > 0 &&
                          teamUsers.filter(u => divMatches.includes((u as any).sales_division ?? '')).length === targetNames.length;
                        if (allFromDivisions) {
                          return (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="text-xs text-orange-500 font-semibold mr-1">🏢</span>
                              {divMatches.map((d, i) => (
                                <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">{d}</span>
                              ))}
                              <span className="text-xs text-slate-400 font-semibold">· {targetNames.length} user</span>
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-slate-400 font-semibold mr-1">👤</span>
                            {targetNames.slice(0, 4).map((n, i) => (
                              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">{n}</span>
                            ))}
                            {targetNames.length > 4 && <span className="text-xs text-slate-500 font-semibold">+{targetNames.length - 4} lainnya</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => toggleActive(s.id, s.is_active)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${s.is_active ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                      {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <BtnDelete onClick={() => handleDelete(s.id)} />
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
