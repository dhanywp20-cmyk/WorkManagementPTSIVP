'use client';

/** FormSesi - dipecah dari app/(portal)/learning-center/_components/SessionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User, Material, Question } from '../shared';

export interface FormSesiProps {
  cariAnggota: string;
  cariDivisi: string;
  form: { session_name: string; material_id: string; batch_filter: string; question_count: number; timer_minutes: number; passing_grade: number; allow_retake: boolean; acak_soal: boolean; target_mode: "all" | "role" | "user" | "division"; target_roles: string[]; target_user_ids: string[]; target_divisions: string[]; open_at: string; close_at: string; session_type: "abcd" | "essay"; };
  handleCreate: () => Promise<void>;
  materials: Material[];
  questions: Question[];
  roleLabel: Record<string, string>;
  saving: boolean;
  setCariAnggota: import("react").Dispatch<import("react").SetStateAction<string>>;
  setCariDivisi: import("react").Dispatch<import("react").SetStateAction<string>>;
  setForm: import("react").Dispatch<import("react").SetStateAction<{ session_name: string; material_id: string; batch_filter: string; question_count: number; timer_minutes: number; passing_grade: number; allow_retake: boolean; acak_soal: boolean; target_mode: "all" | "role" | "user" | "division"; target_roles: string[]; target_user_ids: string[]; target_divisions: string[]; open_at: string; close_at: string; session_type: "abcd" | "essay"; }>>;
  setShowForm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showForm: boolean;
  teamUsers: User[];
  toggleTargetDivision: (div: string) => void;
  toggleTargetRole: (role: string) => void;
  toggleTargetUser: (uid: string) => void;
  uniqueDivisions: any[];
  uniqueRoles: string[];
}

export function FormSesi({ cariAnggota, cariDivisi, form, handleCreate, materials, questions, roleLabel, saving, setCariAnggota, setCariDivisi, setForm, setShowForm, showForm, teamUsers, toggleTargetDivision, toggleTargetRole, toggleTargetUser, uniqueDivisions, uniqueRoles }: FormSesiProps) {
  return (
    <>
      {showForm && (
        <div className="rounded-2xl border border-emerald-100 shadow-lg p-6" style={{ background: '#ffffff' }}>
          <h3 className="font-bold text-slate-800 mb-5"><IkonTeks nama="📋" />Form Sesi Quiz Baru</h3>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest mr-1">Tipe Sesi</span>
            {(['abcd', 'essay'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm(p => ({ ...p, session_type: t, material_id: '', batch_filter: '' }))}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${form.session_type === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-emerald-50'}`}>
                {t === 'abcd' ? '🔤 Pilihan Ganda (ABCD)' : '📝 Essay'}
              </button>
            ))}
            <span className="text-[11px] text-slate-500 ml-1">Sesi essay hanya bisa berisi soal essay, tidak dicampur ABCD.</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="f-learning-center-components-sessionspage-1" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Sesi *</label>
              <input id="f-learning-center-components-sessionspage-1" value={form.session_name} onChange={e => setForm(p => ({ ...p, session_name: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                placeholder="contoh: Quiz Microvision — Batch 1 — Mei 2025" />
            </div>
            <div>
              <label htmlFor="f-learning-center-components-sessionspage-2" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
              <select id="f-learning-center-components-sessionspage-2" value={form.material_id}
                onChange={e => setForm(p => ({ ...p, material_id: e.target.value, batch_filter: '' }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
                <option value="">-- Pilih Materi --</option>
                {materials.map(m => {
                  const total = questions.filter(q => q.material_id === m.id && ((q as any).question_type ?? 'abcd') === form.session_type).length;
                  const batches = [...new Set(questions.filter(q => q.material_id === m.id && (q as any).batch_name && ((q as any).question_type ?? 'abcd') === form.session_type).map(q => (q as any).batch_name))];
                  return (
                    <option key={m.id} value={m.id} disabled={total === 0}>
                      {m.materi_name} ({total} soal {form.session_type === 'essay' ? 'essay' : 'ABCD'}{batches.length > 0 ? `, ${batches.length} grup` : ''})
                    </option>
                  );
                })}
              </select>
            </div>
            {/* ── Batch / Grup selector — dropdown, muncul setelah material dipilih dan punya batch ── */}
            {(() => {
              if (!form.material_id) return null;
              const batches = [...new Set(
                questions.filter(q => q.material_id === form.material_id && (q as any).batch_name && ((q as any).question_type ?? 'abcd') === form.session_type)
                  .map(q => (q as any).batch_name as string)
              )].sort();
              if (batches.length === 0) return null;
              return (
                <div>
                  <label htmlFor="f-learning-center-components-sessionspage-3" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                    Grup / Batch Soal
                    <span className="ml-1.5 text-[11px] font-normal text-slate-500 normal-case tracking-normal">Optional</span>
                  </label>
                  <select id="f-learning-center-components-sessionspage-3"
                    value={form.batch_filter}
                    onChange={e => setForm(p => ({ ...p, batch_filter: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
                  >
                    <option value="">-- Semua Grup ({questions.filter(q => q.material_id === form.material_id && ((q as any).question_type ?? 'abcd') === form.session_type).length} soal dicampur) --</option>
                    {batches.map(b => {
                      const count = questions.filter(q => q.material_id === form.material_id && (q as any).batch_name === b && ((q as any).question_type ?? 'abcd') === form.session_type).length;
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
              <label htmlFor="f-learning-center-components-sessionspage-4" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jumlah Soal</label>
              <input id="f-learning-center-components-sessionspage-4" type="number" min={1} max={100} value={form.question_count}
                onChange={e => setForm(p => ({ ...p, question_count: +e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="f-learning-center-components-sessionspage-5" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Timer (menit, 0 = tanpa timer)</label>
              <input id="f-learning-center-components-sessionspage-5" type="number" min={0} value={form.timer_minutes}
                onChange={e => setForm(p => ({ ...p, timer_minutes: +e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="f-learning-center-components-sessionspage-6" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Passing Grade (%)</label>
              <input id="f-learning-center-components-sessionspage-6" type="number" min={0} max={100} value={form.passing_grade}
                onChange={e => setForm(p => ({ ...p, passing_grade: +e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="f-learning-center-components-sessionspage-7" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5"><IkonTeks nama="⏰" />Waktu Dibuka</label>
              <input id="f-learning-center-components-sessionspage-7" type="datetime-local" value={form.open_at} onChange={e => setForm(p => ({ ...p, open_at: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              <p className="text-[11px] text-slate-500 mt-1">Kosongkan = langsung aktif sekarang</p>
            </div>
            <div>
              <label htmlFor="f-learning-center-components-sessionspage-8" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5"><IkonTeks nama="🔒" />Waktu Ditutup</label>
              <input id="f-learning-center-components-sessionspage-8" type="datetime-local" value={form.close_at} onChange={e => setForm(p => ({ ...p, close_at: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              <p className="text-[11px] text-slate-500 mt-1">Kosongkan = tidak ada batas waktu</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.allow_retake} onChange={e => setForm(p => ({ ...p, allow_retake: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-400" />
                <span className="text-sm font-medium text-slate-700">Boleh Retake</span>
              </label>
              {/* Mengacak urutan TAMPIL saja - penilaian tetap per question_id
                  di server, jadi tidak ada hubungannya dengan kunci jawaban. */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.acak_soal} onChange={e => setForm(p => ({ ...p, acak_soal: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                <span className="text-sm font-medium text-slate-700"><IkonTeks nama="🔀" />Acak Urutan Soal</span>
                <span className="text-[11px] text-slate-500">(beda tiap peserta)</span>
              </label>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2"><IkonTeks nama="👥" />Target Penerima Quiz</label>
              <div className="flex gap-2 mb-3 flex-wrap">
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, target_mode: 'all', target_roles: [], target_user_ids: [], target_divisions: [] }))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'all' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                  <IkonTeks nama="🌐" />Semua
                </button>
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, target_mode: 'role', target_user_ids: [], target_divisions: [] }))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'role' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                  <IkonTeks nama="🏷" />Per Role
                </button>
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, target_mode: 'division', target_roles: [], target_user_ids: [] }))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'division' ? 'bg-orange-500 text-white border-orange-500 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'}`}>
                  <IkonTeks nama="🏢" />Per Sales Division
                </button>
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, target_mode: 'user', target_roles: [], target_divisions: [] }))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${form.target_mode === 'user' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                  <IkonTeks nama="👤" />Per Anggota
                </button>
              </div>

              {form.target_mode === 'all' && (
                <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 font-medium">
                  <IkonTeks nama="🌐" />Quiz akan dikirim ke <strong>semua user</strong> (team, marketing, guest, dll.)
                </p>
              )}

              {form.target_mode === 'role' && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Pilih role yang akan menerima quiz ini:</p>
                  <div className="border border-slate-200 rounded-xl p-3 space-y-1">
                    {uniqueRoles.length === 0 && <p className="text-xs text-slate-500 text-center py-3">Tidak ada role ditemukan</p>}
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
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{count} user</span>
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
                  <p className="text-xs text-slate-500 mb-2">Pilih Sales Division yang akan menerima quiz ini:</p>
                  <input aria-label="Cari divisi..." value={cariDivisi} onChange={e => setCariDivisi(e.target.value)}
                    placeholder="Cari divisi..."
                    className="w-full mb-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                  <div className="border border-slate-200 rounded-xl p-3 max-h-52 overflow-y-auto space-y-1">
                    {uniqueDivisions.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-3">Tidak ada sales division ditemukan. Pastikan field <code>sales_division</code> diisi di data user.</p>
                    )}
                    {uniqueDivisions
                      // Divisi terpilih tetap tampil walau tidak cocok kata kunci,
                      // sama alasannya dengan daftar anggota di bawah.
                      .filter(div => !cariDivisi.trim()
                        || form.target_divisions.includes(div)
                        || div.toLowerCase().includes(cariDivisi.trim().toLowerCase()))
                      .map(div => {
                      const checked = form.target_divisions.includes(div);
                      const count = teamUsers.filter(u => (u as any).sales_division === div).length;
                      return (
                        <label key={div} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${checked ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleTargetDivision(div)}
                            className="w-4 h-4 rounded border-slate-300 text-orange-700 focus:ring-orange-400 flex-shrink-0" />
                          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-bold flex-shrink-0">
                            <Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">{div}</p>
                          </div>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{count} user</span>
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
                  <p className="text-xs text-slate-500 mb-2">Pilih anggota secara individual:</p>
                  <input aria-label="Cari nama, role, atau jabatan..." value={cariAnggota} onChange={e => setCariAnggota(e.target.value)}
                    placeholder="Cari nama, role, atau jabatan..."
                    className="w-full mb-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
                  <div className="border border-slate-200 rounded-xl p-3 max-h-52 overflow-y-auto space-y-1">
                    {teamUsers.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Tidak ada user ditemukan</p>}
                    {(() => {
                      const q = cariAnggota.trim().toLowerCase();
                      // Yang SUDAH dicentang selalu ikut tampil walau tidak cocok
                      // dengan kata kunci - kalau tidak, pilihan yang sudah dibuat
                      // seolah hilang begitu kata kuncinya diganti, dan mudah
                      // dikira ikut terhapus.
                      const tampil = q
                        ? teamUsers.filter(u =>
                            form.target_user_ids.includes(u.id) ||
                            `${u.full_name ?? ''} ${u.role ?? ''} ${u.jabatan ?? ''}`.toLowerCase().includes(q))
                        : teamUsers;
                      if (tampil.length === 0) {
                        return <p className="text-xs text-slate-500 text-center py-4">Tidak ada yang cocok dengan &quot;{cariAnggota}&quot;</p>;
                      }
                      return tampil.map(u => {
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
                            <p className="text-[11px] text-slate-500">{u.role}{u.jabatan ? ` · ${u.jabatan}` : ''}</p>
                          </div>
                        </label>
                      );
                      });
                    })()}
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
    </>
  );
}
