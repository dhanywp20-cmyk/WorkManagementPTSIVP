'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, setSession } from '@/lib/auth';
import { User, AdminView, TeamView } from './_components/shared';
import { AdminDashboard } from './_components/AdminDashboard';
import { MateriPage } from './_components/MateriPage';
import { QuestionsPage } from './_components/QuestionsPage';
import { SessionsPage } from './_components/SessionsPage';
import { TeamPage } from './_components/TeamPage';
import { ReportPage } from './_components/ReportPage';
import { MyQuizPage } from './_components/MyQuizPage';
import { HistoryPage } from './_components/HistoryPage';
import { ScorePage } from './_components/ScorePage';

export default function LearningCenterPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const parsed = getSession<User>();
      if (!parsed) { setLoading(false); return; }
      try {
        const { data } = await supabase.from('users').select('*').eq('id', parsed.id).single();
        const user = data ?? parsed;
        setCurrentUser(user);
        if (data) setSession(user); // refresh session dengan data terbaru
      } catch {
        setCurrentUser(parsed);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center"
        style={{ backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="text-center px-10 py-8 rounded-3xl"
          style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
          <div className="text-4xl mb-3 animate-pulse">🎓</div>
          <p className="text-slate-500 font-medium">Memuat Learning Center...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center"
        style={{ backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="text-center px-10 py-8 rounded-3xl"
          style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-slate-500 font-medium">Silakan login terlebih dahulu.</p>
        </div>
      </div>
    );
  }

  return <LearningCenter currentUser={currentUser} />;
}

function LearningCenter({ currentUser }: { currentUser: User }) {
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [teamView, setTeamView] = useState<TeamView>('my-quiz');
  const [loading, setLoading] = useState(false);
  const [contentKey, setContentKey] = useState(0);

  const changeAdminView = (v: AdminView) => {
    if (v === adminView) return;
    setLoading(true);
    setTimeout(() => {
      setAdminView(v);
      setLoading(false);
      setContentKey(k => k + 1);
    }, 160);
  };

  const changeTeamView = (v: TeamView) => {
    if (v === teamView) return;
    setLoading(true);
    setTimeout(() => {
      setTeamView(v);
      setLoading(false);
      setContentKey(k => k + 1);
    }, 160);
  };

  const LoadingView = () => (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 110px)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-blue-500 animate-spin" />
        <span className="text-xs text-slate-400 font-medium tracking-wide">Memuat...</span>
      </div>
    </div>
  );

  return (
    <div
      className="flex flex-col h-screen overflow-hidden font-sans"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url('/IVP_Background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        {isAdmin
          ? <AdminTopNav view={adminView} onChange={changeAdminView} />
          : <TeamTopNav view={teamView} onChange={changeTeamView} />}

        <div className="flex-1 overflow-y-auto">
          {loading ? <LoadingView /> : (
            <div key={contentKey} className="lc-page-enter">
              {isAdmin ? (
                <>
                  {adminView === 'dashboard'  && <AdminDashboard user={currentUser} />}
                  {adminView === 'materi'     && <MateriPage user={currentUser} isAdmin={true} />}
                  {adminView === 'questions'  && <QuestionsPage user={currentUser} />}
                  {adminView === 'sessions'   && <SessionsPage user={currentUser} />}
                  {adminView === 'team'       && <TeamPage />}
                  {adminView === 'report'     && <ReportPage currentUser={currentUser} />}
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
          )}
        </div>
      </div>
    </div>
  );
}

function AdminTopNav({ view, onChange }: { view: AdminView; onChange: (v: AdminView) => void }) {
  const items: { key: AdminView; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'materi', icon: '📚', label: 'Materi' },
    { key: 'questions', icon: '🧩', label: 'Bank Soal' },
    { key: 'sessions', icon: '🎯', label: 'Sesi Quiz' },
    { key: 'team', icon: '👥', label: 'Team' },
    { key: 'report', icon: '📋', label: 'Laporan' },
  ];
  return (
    <div style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', borderBottom: '3px solid #dc2626' }}
      className="flex-shrink-0 sticky top-0 z-50 animate-slide-down anim-d0">
      <div className="flex items-center gap-3 px-6 pt-4 pb-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-base shadow">🎓</div>
        <div>
          <span className="text-sm font-bold text-slate-800 leading-tight">Learning Center</span>
          <span className="ml-2 text-[10px] text-blue-600 font-semibold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full">Admin Portal</span>
        </div>
      </div>
      <nav className="flex items-end gap-1 px-4 pt-2 overflow-x-auto">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap flex-shrink-0
              ${view === i.key ? 'text-blue-700 border-blue-600 bg-blue-50/60 font-semibold' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}>
            <span className="text-sm">{i.icon}</span>{i.label}
          </button>
        ))}
        <button onClick={() => window.location.reload()} title="Refresh halaman"
          className="ml-1 mb-1 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-200 text-base flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
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
    <div style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', borderBottom: '3px solid #dc2626' }}
      className="flex-shrink-0 sticky top-0 z-50 animate-slide-down anim-d0">
      <div className="flex items-center gap-3 px-6 pt-4 pb-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-base shadow">🎓</div>
        <div>
          <span className="text-sm font-bold text-slate-800 leading-tight">Learning Center</span>
          <span className="ml-2 text-[10px] text-indigo-500 font-semibold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full">Team Portal</span>
        </div>
      </div>
      <nav className="flex items-end gap-1 px-4 pt-2 overflow-x-auto">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap flex-shrink-0
              ${view === i.key ? 'text-indigo-700 border-indigo-600 bg-indigo-50/60 font-semibold' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}>
            <span className="text-sm">{i.icon}</span>{i.label}
          </button>
        ))}
        <button onClick={() => window.location.reload()} title="Refresh halaman"
          className="ml-1 mb-1 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-200 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </nav>
    </div>
  );
}
