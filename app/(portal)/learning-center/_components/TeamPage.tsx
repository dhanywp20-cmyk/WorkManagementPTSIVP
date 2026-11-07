'use client';

import { useState, useEffect, useCallback } from 'react';
import { ListEmptyState } from '@/components/shared';
import { supabase, User, QuizAttempt, SearchInput, BtnView } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { UserAnswerReview } from './UlasanJawaban';

export function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');

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

  const filtered = search
    ? users.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.role ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight"><IkonTeks nama="👥" />Team</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Daftar anggota team & partisipasi quiz</p>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Cari anggota..." />
      </div>
      <div className="p-4 sm:p-8">
        <div className="rounded-2xl border border-slate-200 shadow-xs overflow-hidden overflow-x-auto"
          style={{ background: '#ffffff' }}>
          <table className="w-full text-sm table-zebra">
            <thead className="border-b border-slate-200" style={{ background: 'rgba(248,250,252,0.98)' }}>
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
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-0">
                  <ListEmptyState
                    adaFilterAktif={search.trim() !== ''}
                    onReset={() => setSearch('')}
                    icon="👥"
                    judulKosong="Belum ada data anggota"
                    deskripsiKosong="Nilai quiz anggota tim akan muncul di sini setelah mereka mengerjakan."
                  />
                </td></tr>
              )}
              {filtered.map(u => {
                const ua = attempts.filter((a: any) => a.user_id === u.id);
                const gradedUa = ua.filter((a: any) => (a as any).grading_status !== 'pending_review');
                const pendingCount = ua.length - gradedUa.length;
                const avg = gradedUa.length ? gradedUa.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / gradedUa.length : null;
                const passed = gradedUa.filter((a: any) => a.passed).length;
                return (
                  <tr key={u.id} className="stagger-item hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {u.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.full_name}</p>
                          <p className="text-[11px] text-slate-500">{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">
                      {ua.length}
                      {pendingCount > 0 && <span className="ml-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full"><Ikon nama="⏳" ukuran="1em" className="inline-block align-[-0.12em]" /> {pendingCount}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {avg !== null ? <span className={`font-bold ${avg >= 70 ? 'text-emerald-700' : 'text-rose-600'}`}>{avg.toFixed(1)}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {gradedUa.length ? <span className="text-xs font-bold text-indigo-600">{Math.round(passed/gradedUa.length*100)}%</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {ua.length > 0 && (
                        <BtnView onClick={() => setSelectedUser(u)}>Lihat Jawaban</BtnView>
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
