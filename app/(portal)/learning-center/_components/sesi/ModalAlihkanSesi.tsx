'use client';

/** ModalAlihkanSesi - dipecah dari app/(portal)/learning-center/_components/SessionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User, QuizSession } from '../shared';

export interface ModalAlihkanSesiProps {
  cariAnggotaUlang: string;
  cariDivisiUlang: string;
  handleReassign: () => Promise<void>;
  reassignForm: { session_name: string; timer_minutes: number; passing_grade: number; allow_retake: boolean; acak_soal: boolean; target_mode: "all" | "role" | "user" | "division"; target_roles: string[]; target_user_ids: string[]; target_divisions: string[]; open_at: string; close_at: string; };
  reassignSource: QuizSession | null;
  reassigning: boolean;
  roleLabel: Record<string, string>;
  setCariAnggotaUlang: import("react").Dispatch<import("react").SetStateAction<string>>;
  setCariDivisiUlang: import("react").Dispatch<import("react").SetStateAction<string>>;
  setReassignForm: import("react").Dispatch<import("react").SetStateAction<{ session_name: string; timer_minutes: number; passing_grade: number; allow_retake: boolean; acak_soal: boolean; target_mode: "all" | "role" | "user" | "division"; target_roles: string[]; target_user_ids: string[]; target_divisions: string[]; open_at: string; close_at: string; }>>;
  setShowReassign: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showReassign: boolean;
  teamUsers: User[];
  uniqueDivisions: any[];
  uniqueRoles: string[];
}

export function ModalAlihkanSesi({ cariAnggotaUlang, cariDivisiUlang, handleReassign, reassignForm, reassignSource, reassigning, roleLabel, setCariAnggotaUlang, setCariDivisiUlang, setReassignForm, setShowReassign, showReassign, teamUsers, uniqueDivisions, uniqueRoles }: ModalAlihkanSesiProps) {
  return (
    <>
      {showReassign && reassignSource && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowReassign(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-6 border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)' }}>
              <div>
                <div className="font-bold text-slate-800 text-base"><IkonTeks nama="📤" />Assign Ulang Quiz</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">Soal dari: <span className="font-semibold text-emerald-700">{reassignSource.session_name}</span></div>
              </div>
              <button aria-label="Tutup" onClick={() => setShowReassign(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-white/80 text-lg leading-none">×</button>
            </div>

            {/* Info materi — read-only */}
            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3 flex-wrap">
              <span className="text-sm"><Ikon nama="📚" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{reassignSource.materi_name}</p>
                <p className="text-[11px] text-slate-500">{reassignSource.question_count} soal · soal yang sama dipakai ulang</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">Reuse ♻️</span>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Nama Sesi */}
              <div>
                <label htmlFor="f-learning-center-components-sessionspage-9" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Sesi *</label>
                <input id="f-learning-center-components-sessionspage-9" value={reassignForm.session_name}
                  onChange={e => setReassignForm(p => ({ ...p, session_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Nama sesi untuk target baru..." />
              </div>

              {/* Pengaturan ringkas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="f-learning-center-components-sessionspage-10" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Timer (mnt)</label>
                  <input id="f-learning-center-components-sessionspage-10" type="number" min={0} value={reassignForm.timer_minutes}
                    onChange={e => setReassignForm(p => ({ ...p, timer_minutes: +e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                </div>
                <div>
                  <label htmlFor="f-learning-center-components-sessionspage-11" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Passing (%)</label>
                  <input id="f-learning-center-components-sessionspage-11" type="number" min={0} max={100} value={reassignForm.passing_grade}
                    onChange={e => setReassignForm(p => ({ ...p, passing_grade: +e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                </div>
                <div className="flex items-end pb-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={reassignForm.allow_retake}
                      onChange={e => setReassignForm(p => ({ ...p, allow_retake: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-400" />
                    <span className="text-sm font-medium text-slate-700">Retake</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={reassignForm.acak_soal}
                      onChange={e => setReassignForm(p => ({ ...p, acak_soal: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                    <span className="text-sm font-medium text-slate-700"><IkonTeks nama="🔀" />Acak</span>
                  </label>
                </div>
              </div>

              {/* Waktu buka / tutup */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f-learning-center-components-sessionspage-12" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5"><IkonTeks nama="⏰" />Waktu Dibuka</label>
                  <input id="f-learning-center-components-sessionspage-12" type="datetime-local" value={reassignForm.open_at}
                    onChange={e => setReassignForm(p => ({ ...p, open_at: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                </div>
                <div>
                  <label htmlFor="f-learning-center-components-sessionspage-13" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5"><IkonTeks nama="🔒" />Waktu Ditutup</label>
                  <input id="f-learning-center-components-sessionspage-13" type="datetime-local" value={reassignForm.close_at}
                    onChange={e => setReassignForm(p => ({ ...p, close_at: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                </div>
              </div>

              {/* Target Penerima */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2"><IkonTeks nama="👥" />Target Penerima</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {([
                    { mode: 'all',      icon: '🌐', label: 'Semua',    active: 'bg-indigo-600 text-white border-indigo-600' },
                    { mode: 'role',     icon: '🏷️', label: 'Per Role',  active: 'bg-indigo-600 text-white border-indigo-600' },
                    { mode: 'division', icon: '🏢', label: 'Per Divisi', active: 'bg-orange-500 text-white border-orange-500' },
                    { mode: 'user',     icon: '👤', label: 'Per Anggota', active: 'bg-indigo-600 text-white border-indigo-600' },
                  ] as const).map(opt => (
                    <button key={opt.mode} type="button"
                      onClick={() => setReassignForm(p => ({ ...p, target_mode: opt.mode, target_roles: [], target_user_ids: [], target_divisions: [] }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${reassignForm.target_mode === opt.mode ? opt.active + ' shadow' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                      <Ikon nama={opt.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {opt.label}
                    </button>
                  ))}
                </div>

                {reassignForm.target_mode === 'all' && (
                  <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 font-medium">
                    <IkonTeks nama="🌐" />Quiz akan dikirim ke <strong>semua user</strong>
                  </p>
                )}

                {reassignForm.target_mode === 'role' && (
                  <div className="border border-slate-200 rounded-xl p-3 space-y-1 max-h-44 overflow-y-auto">
                    {uniqueRoles.length === 0 && <p className="text-xs text-slate-500 text-center py-3">Tidak ada role ditemukan</p>}
                    {uniqueRoles.map(role => {
                      const checked = reassignForm.target_roles.includes(role);
                      const count = teamUsers.filter(u => (u.role ?? '').toLowerCase() === role).length;
                      return (
                        <label key={role} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${checked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setReassignForm(p => ({ ...p, target_roles: p.target_roles.includes(role) ? p.target_roles.filter(r => r !== role) : [...p.target_roles, role] }))}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 flex-shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 flex-1">{roleLabel[role] ?? `📌 ${role}`}</span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{count} user</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {reassignForm.target_mode === 'division' && (
                  <div>
                  <input aria-label="Cari divisi..." value={cariDivisiUlang} onChange={e => setCariDivisiUlang(e.target.value)}
                    placeholder="Cari divisi..."
                    className="w-full mb-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400" />
                  <div className="border border-slate-200 rounded-xl p-3 space-y-1 max-h-44 overflow-y-auto">
                    {uniqueDivisions.length === 0 && <p className="text-xs text-slate-500 text-center py-3">Tidak ada sales division ditemukan</p>}
                    {uniqueDivisions
                      // Divisi terpilih tetap tampil walau tidak cocok kata kunci -
                      // alasan yang sama dengan daftar anggota di bawah.
                      .filter(div => !cariDivisiUlang.trim()
                        || reassignForm.target_divisions.includes(div)
                        || div.toLowerCase().includes(cariDivisiUlang.trim().toLowerCase()))
                      .map(div => {
                      const checked = reassignForm.target_divisions.includes(div);
                      const count = teamUsers.filter(u => (u as any).sales_division === div).length;
                      return (
                        <label key={div} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${checked ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setReassignForm(p => ({ ...p, target_divisions: p.target_divisions.includes(div) ? p.target_divisions.filter(d => d !== div) : [...p.target_divisions, div] }))}
                            className="w-4 h-4 rounded border-slate-300 text-orange-700 focus:ring-orange-400 flex-shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 flex-1"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /> {div}</span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{count} user</span>
                        </label>
                      );
                    })}
                  </div>
                  </div>
                )}

                {reassignForm.target_mode === 'user' && (
                  <div>
                  <input aria-label="Cari nama, role, atau jabatan..." value={cariAnggotaUlang} onChange={e => setCariAnggotaUlang(e.target.value)}
                    placeholder="Cari nama, role, atau jabatan..."
                    className="w-full mb-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
                  <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                    {teamUsers.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Tidak ada user ditemukan</p>}
                    {(() => {
                      const q = cariAnggotaUlang.trim().toLowerCase();
                      // Yang SUDAH dicentang selalu ikut tampil walau tidak cocok
                      // dengan kata kunci - kalau tidak, pilihan yang sudah dibuat
                      // seolah hilang begitu kata kuncinya diganti, dan mudah
                      // dikira ikut terhapus.
                      const tampil = q
                        ? teamUsers.filter(u =>
                            reassignForm.target_user_ids.includes(u.id) ||
                            `${u.full_name ?? ''} ${u.role ?? ''} ${u.jabatan ?? ''}`.toLowerCase().includes(q))
                        : teamUsers;
                      if (tampil.length === 0) {
                        return <p className="text-xs text-slate-500 text-center py-4">Tidak ada yang cocok dengan &quot;{cariAnggotaUlang}&quot;</p>;
                      }
                      return tampil.map(u => {
                      const checked = reassignForm.target_user_ids.includes(u.id);
                      return (
                        <label key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${checked ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setReassignForm(p => ({ ...p, target_user_ids: p.target_user_ids.includes(u.id) ? p.target_user_ids.filter(id => id !== u.id) : [...p.target_user_ids, u.id] }))}
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
                  </div>
                )}

                {/* Summary */}
                {reassignForm.target_mode === 'role' && reassignForm.target_roles.length > 0 && (
                  <p className="text-xs text-indigo-600 font-semibold mt-1.5">
                    ✓ {reassignForm.target_roles.length} role · {teamUsers.filter(u => reassignForm.target_roles.includes((u.role ?? '').toLowerCase())).length} user
                  </p>
                )}
                {reassignForm.target_mode === 'division' && reassignForm.target_divisions.length > 0 && (
                  <p className="text-xs text-orange-600 font-semibold mt-1.5">
                    ✓ {reassignForm.target_divisions.length} divisi · {teamUsers.filter(u => reassignForm.target_divisions.includes((u as any).sales_division ?? '')).length} user
                  </p>
                )}
                {reassignForm.target_mode === 'user' && reassignForm.target_user_ids.length > 0 && (
                  <p className="text-xs text-indigo-600 font-semibold mt-1.5">✓ {reassignForm.target_user_ids.length} anggota dipilih</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-5 pt-1 justify-end border-t border-slate-100">
              <button onClick={() => setShowReassign(false)} disabled={reassigning}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleReassign} disabled={reassigning}
                className="px-5 py-2.5 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                {reassigning
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Menyimpan...</>
                  : <>📤 Assign Sekarang</>}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
