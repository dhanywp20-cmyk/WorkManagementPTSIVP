'use client';

/** DaftarSesi - dipecah dari app/(portal)/learning-center/_components/SessionsPage.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User, QuizSession, fmtDate, BtnDelete } from '../shared';

export interface DaftarSesiProps {
  filtered: QuizSession[];
  fmtDT: (d: string) => string;
  getSessionStatus: (s: QuizSession) => { label: string; cls: string; };
  handleDelete: (id: string) => void;
  handleResend: (session: QuizSession) => void;
  onViewResults: ((sessionId: string) => void) | undefined;
  openReassign: (session: QuizSession) => void;
  progresSesi: Record<string, { mulai: number; submit: number; }>;
  search: string;
  showForm: boolean;
  teamUsers: User[];
  toggleActive: (id: string, current: boolean) => Promise<void>;
}

export function DaftarSesi({ filtered, fmtDT, getSessionStatus, handleDelete, handleResend, onViewResults, openReassign, progresSesi, search, showForm, teamUsers, toggleActive }: DaftarSesiProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {filtered.length === 0 && !showForm && (
          <div className="flex justify-center py-16">
            <div className="text-center px-10 py-8 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
              <div className="text-5xl mb-3"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
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
              {/* Di layar sempit deretan tombol turun ke bawah, bukan berdesakan
                  di kanan judul: dengan flex-shrink-0 tombolnya tidak mau
                  mengecil, jadi ia meluber keluar kartu dan halaman ikut bisa
                  digeser ke samping. */}
              <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-800">{s.session_name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${status.cls}`}>{status.label}</span>
                    {s.session_type === 'essay' && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold border bg-indigo-100 text-indigo-700 border-indigo-200"><IkonTeks nama="📝" />Essay</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {s.materi_name.includes(' — ') ? (
                      <>
                        <span className="text-sm text-slate-500">{s.materi_name.split(' — ')[0]}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 border border-violet-200">
                          <Ikon nama="📌" ukuran="1em" className="inline-block align-[-0.12em]" /> {s.materi_name.split(' — ').slice(1).join(' — ')}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">{s.materi_name}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    <span><Ikon nama="📝" ukuran="1em" className="inline-block align-[-0.12em]" /> {s.question_count} soal</span>
                    <span><Ikon nama="⏱" ukuran="1em" className="inline-block align-[-0.12em]" /> {s.timer_minutes ? `${s.timer_minutes} mnt` : 'No timer'}</span>
                    <span><IkonTeks nama="🎯" />Passing: {s.passing_grade}%</span>
                    <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
                    {s.acak_soal && <span className="text-indigo-600 font-semibold"><IkonTeks nama="🔀" />Soal diacak</span>}
                    <span><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {fmtDate(s.created_at)}</span>
                  </div>
                  {(s.open_at || s.close_at) && (
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                      {s.open_at && <span className="text-amber-700 font-semibold"><IkonTeks nama="⏰" />Buka: {fmtDT(s.open_at)}</span>}
                      {s.close_at && <span className="text-rose-600 font-semibold"><IkonTeks nama="🔒" />Tutup: {fmtDT(s.close_at)}</span>}
                    </div>
                  )}
                  {/*
                    Berapa orang sudah MEMBUKA quiz ini, dan berapa yang sudah
                    selesai - dari total sasarannya. Tanpa angka "mulai", sesi
                    yang baru dibagikan terlihat sama persis dengan sesi yang
                    tidak dibuka siapa pun.
                  */}
                  {(() => {
                    const p = progresSesi[s.id] ?? { mulai: 0, submit: 0 };
                    //  Sasaran 'semua' tidak menyimpan daftar id (target_user_ids
                    //  null), jadi totalnya dihitung dari daftar akun yang ada.
                    const total = s.target_user_ids?.length ?? teamUsers.length;
                    const persen = total > 0 ? Math.round((p.mulai / total) * 100) : 0;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold border ${
                          p.mulai === 0
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          👀 {p.mulai} dari {total} sudah mulai{total > 0 && ` (${persen}%)`}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold border ${
                          p.submit === 0
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.submit} selesai
                        </span>
                        {p.mulai > p.submit && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold border bg-amber-50 text-amber-700 border-amber-200">
                            <Ikon nama="⏳" ukuran="1em" className="inline-block align-[-0.12em]" /> {p.mulai - p.submit} sedang mengerjakan
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <div className="mt-2">
                    {targetNames === null ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold"><IkonTeks nama="🌐" />Semua Team</span>
                    ) : targetNames.length === 0 ? (
                      <span className="text-xs text-slate-500 italic">—</span>
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
                            <span className="text-xs text-orange-700 font-semibold mr-1"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                            {divMatches.map((d, i) => (
                              <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-semibold">{d}</span>
                            ))}
                            <span className="text-xs text-slate-500 font-semibold">· {targetNames.length} user</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-xs text-slate-500 font-semibold mr-1"><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                          {targetNames.slice(0, 4).map((n, i) => (
                            <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">{n}</span>
                          ))}
                          {targetNames.length > 4 && <span className="text-xs text-slate-500 font-semibold">+{targetNames.length - 4} lainnya</span>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap w-full sm:w-auto sm:flex-shrink-0 justify-start sm:justify-end">
                  {onViewResults && (
                    <button
                      onClick={() => onViewResults(s.id)}
                      title="Lihat hasil & jawaban peserta yang sudah submit sesi ini"
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 flex items-center gap-1"
                    >
                      <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M5 7h14M5 12h5m-5 5h9" />
                      </svg>
                      Lihat Hasil
                    </button>
                  )}
                  <button data-tulis
                    onClick={() => openReassign(s)}
                    title="Assign soal yang sama ke tim / target berbeda"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                  >
                    <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Assign Ulang
                  </button>
                  <button data-tulis
                    onClick={() => handleResend(s)}
                    title="Duplikat & kirim ulang ke peserta yang sama"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 flex items-center gap-1"
                  >
                    <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Kirim Ulang
                  </button>
                  <button data-tulis onClick={() => toggleActive(s.id, s.is_active)}
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
    </>
  );
}
