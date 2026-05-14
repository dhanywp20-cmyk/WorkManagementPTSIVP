'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, AdminView, TeamView } from './_components/shared';
import { AdminDashboard } from './_components/AdminDashboard';
import { MateriPage } from './_components/MateriPage';
import { QuestionsPage } from './_components/QuestionsPage';
import { SessionsPage } from './_components/SessionsPage';
import { TeamPage } from './_components/TeamPage';
import { ReportPage } from './_components/ReportPage';
import { AnalyticsPage } from './_components/AnalyticsPage';
import { MyQuizPage } from './_components/MyQuizPage';
import { HistoryPage } from './_components/HistoryPage';
import { ScorePage } from './_components/ScorePage';

export default function LearningCenterPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const saved = localStorage.getItem('currentUser');
      const savedTime = localStorage.getItem('loginTime');
      if (!saved) { setLoading(false); return; }
      if (savedTime) {
        const sixHours = 6 * 60 * 60 * 1000;
        if (Date.now() - parseInt(savedTime) > sixHours) {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('loginTime');
          setLoading(false); return;
        }
      }
      try {
        const parsed: User = JSON.parse(saved);
        const { data } = await supabase.from('users').select('*').eq('id', parsed.id).single();
        setCurrentUser(data ?? parsed);
      } catch {
        setCurrentUser(null);
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

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{
        backgroundImage: "url('/IVP_Background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="relative z-10 flex flex-col min-h-screen">
        {isAdmin
          ? <AdminTopNav view={adminView} onChange={setAdminView} />
          : <TeamTopNav view={teamView} onChange={setTeamView} />}

        <div className="flex-1 overflow-y-auto" style={{ minHeight: 'calc(100vh - 100px)' }}>
          {isAdmin ? (
            <>
              {adminView === 'dashboard'  && <AdminDashboard user={currentUser} />}
              {adminView === 'materi'     && <MateriPage user={currentUser} isAdmin={true} />}
              {adminView === 'questions'  && <QuestionsPage user={currentUser} />}
              {adminView === 'sessions'   && <SessionsPage user={currentUser} />}
              {adminView === 'team'       && <TeamPage />}
              {adminView === 'report'     && <ReportPage currentUser={currentUser} />}
              {adminView === 'analytics'  && <AnalyticsPage />}
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
    { key: 'analytics', icon: '📈', label: 'Analytics' },
  ];
  return (
    <div style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', borderBottom: '3px solid #dc2626' }}
      className="flex-shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-3 px-6 pt-4 pb-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-base shadow">🎓</div>
        <div>
          <span className="text-sm font-bold text-slate-800 leading-tight">Learning Center</span>
          <span className="ml-2 text-[10px] text-blue-600 font-semibold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full">Admin Portal</span>
        </div>
      </div>
      <nav className="flex items-end gap-1 px-4 pt-2">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap
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
      className="flex-shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-3 px-6 pt-4 pb-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-base shadow">🎓</div>
        <div>
          <span className="text-sm font-bold text-slate-800 leading-tight">Learning Center</span>
          <span className="ml-2 text-[10px] text-indigo-500 font-semibold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full">Team Portal</span>
        </div>
      </div>
      <nav className="flex items-end gap-1 px-4 pt-2">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap
              ${view === i.key ? 'text-indigo-700 border-indigo-600 bg-indigo-50/60 font-semibold' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}>
            <span className="text-sm">{i.icon}</span>{i.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
