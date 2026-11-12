'use client';
import type { User } from '../dashboard/_components/shared';
import { JABATAN_LIST, JABATAN_CONFIG } from '../dashboard/_components/shared';
import { gradasiPanelLogin, angkaTembus } from '@/lib/merek/inti';
import { ModalPortal, LogoMerek, ChipVersi } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { LangkahDuaFaktor } from './LangkahDuaFaktor';
import { useLayarMasuk } from './useLayarMasuk';

export function LayarMasuk({ onMasuk, onSelesai }: {
  onMasuk: (pengguna: User, dbToken: string | null) => void;
  onSelesai: () => void;
}) {
  const {
    masukBerhasil, merek, putaranAnim, animKartu, showRegister, namaSapa, langkah2fa, lanjutMasuk,
    setLangkah2fa, setLoginForm, loginForm, handleLogin, showLoginPwd, setLoginErr, setShowLoginPwd, loginErr,
    loginLoading, pindahForm, setShowForgot, setForgotStep, setForgotMsg, registerSuccess, registerBypass, registerForm,
    setRegisterForm, showRegPwd, setShowRegPwd, showRegConfirmPwd, setShowRegConfirmPwd, daftarKelompokPTS, daftarDivisi, registerErr,
    setRegisterErr, handleRegister, registerLoading, showForgot, forgotMsg, forgotStep, forgotUsername, setForgotUsername,
    handleForgotRequest, forgotLoading, forgotMaskedPhone, forgotOtp, setForgotOtp, forgotNewPwd, setForgotNewPwd, forgotConfirmPwd,
    setForgotConfirmPwd, handleForgotVerify,
  } = useLayarMasuk({ onMasuk, onSelesai });

    return (
      <>
      <div className={`${masukBerhasil ? 'lc-masuk-pudar' : ''} flex bg-cover bg-center bg-fixed`} style={{ minHeight: '100dvh', backgroundImage: `url(${merek.gambarLatar})` }}>
        <div className={`hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden`}
          style={{ background: gradasiPanelLogin(merek) }}>
          <div className="flex items-center gap-2.5">
            <LogoMerek ukuran="lg" gaya="tembus" />
            <span className="text-lg font-bold tracking-tight">{merek.namaPlatform} <span className="font-normal text-white/75">· {merek.namaPortal}</span></span>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-black leading-tight mb-4">{merek.judulLogin}</h1>
            <p className="text-white/85 text-base leading-relaxed mb-8">{merek.subjudulLogin}</p>
            <div className="flex flex-wrap gap-2.5">
              {[['🗓️', 'Request Schedule'], ['🎫', 'Ticket Troubleshooting'], ['🏗️', 'Design Project'], ['🏪', 'Piket Showroom']].map(([ic, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/12 backdrop-blur-sm text-sm font-semibold border border-white/15">{ic} {l}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-white/55 text-xs">
              © {new Date().getFullYear()} {merek.namaPerusahaan}
              {merek.kredit && <span className="text-white/40"> · {merek.kredit}</span>}
            </p>
            <ChipVersi gaya="terang" />
          </div>
        </div>

        <div className={`relative overflow-hidden flex-1 flex items-center justify-center p-4 sm:p-8`}
          style={{ background: `rgba(255,255,255,${angkaTembus(merek.tembusKanan, 0.55)})` }}>
          <div
            key={putaranAnim}
            className={`lc-kartu ${
              animKartu === 'masuk' ? 'lc-kartu-masuk'
                : animKartu === 'tukarKeluar' ? 'lc-tukar-keluar' : 'lc-tukar-masuk'
            } kaca-login w-full ${showRegister ? 'max-w-2xl' : 'max-w-md'} p-6 pt-8 sm:p-9 sm:pt-11`}
          >
            <span aria-hidden="true" className="kaca-latar" />
            <span aria-hidden="true" className="kaca-serpih kaca-serpih-atas" />
            <span aria-hidden="true" className="kaca-serpih kaca-serpih-bawah" />
            {masukBerhasil && (
              <div className="lc-sukses absolute inset-0 z-10 kaca-isi flex flex-col items-center justify-center text-center px-6" role="status" aria-live="polite">
                <svg viewBox="0 0 52 52" width="80" height="80" aria-hidden="true" focusable="false">
                  <circle cx="26" cy="26" r="23" fill="none" stroke={merek.warnaUtama} strokeWidth="3" strokeLinecap="round" className="lc-sukses-lingkar" />
                  <path d="M15 27l8 8 14-16" fill="none" stroke={merek.warnaUtama} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lc-sukses-centang" />
                </svg>
                <p className="lc-sukses-teks mt-5 text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                  Selamat datang{namaSapa ? `, ${namaSapa}` : ''}
                </p>
                <p className="lc-sukses-teks mt-1 text-sm text-slate-500" style={{ animationDelay: '380ms' }}>Menyiapkan portal…</p>
              </div>
            )}
            <div className="mb-8">
              <div className="flex lg:hidden items-center gap-2.5 mb-6">
                <LogoMerek ukuran="lg" />
                <span className="text-lg font-bold text-slate-800">{merek.namaPlatform} <span className="text-slate-500 font-normal">· {merek.namaPortal}</span></span>
              </div>
              <h2 className="text-xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {showRegister ? 'Buat Akun ' : 'Selamat '}<span className="kaca-judul-aksen">{showRegister ? 'Baru' : 'Datang'}</span>
              </h2>
              <p className="text-slate-500 text-sm mt-1.5">{showRegister ? 'Lengkapi data untuk mendaftar. Akun akan diverifikasi admin.' : 'Masuk ke akun Anda untuk melanjutkan'}</p>
            </div>

            {!showRegister && langkah2fa && (
              <LangkahDuaFaktor tahap={langkah2fa.tahap} tantangan={langkah2fa.tantangan}
                onBerhasil={lanjutMasuk} onBatal={() => { setLangkah2fa(null); setLoginForm(f => ({ ...f, password: '' })); }} />
            )}

            {!showRegister && !langkah2fa && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="f-dashboard-page-1" className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Email</label>
                  <input id="f-dashboard-page-1" type="text" autoComplete="username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white text-slate-800 font-medium text-sm outline-hidden"
                    placeholder="email@perusahaan.com" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                </div>
                <div>
                  <label htmlFor="f-dashboard-login-pwd" className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Password</label>
                  <div className="relative">
                    <input id="f-dashboard-login-pwd" autoComplete="current-password" type={showLoginPwd ? 'text' : 'password'} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl pl-4 pr-11 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white text-slate-800 font-medium text-sm outline-hidden"
                      placeholder="Masukkan password" onKeyDown={(e) => { if (e.key === 'Enter') { setLoginErr(''); handleLogin(); } }} />
                    <button type="button" onClick={() => setShowLoginPwd(v => !v)} tabIndex={-1}
                      aria-label={showLoginPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors">
                      {showLoginPwd ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                {loginErr && (
                  <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">
                    {loginErr}
                  </div>
                )}
                <button onClick={handleLogin} disabled={loginLoading || masukBerhasil} className="kaca-tombol w-full py-3.5 rounded-xl font-bold transition-all tracking-wide text-sm mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {masukBerhasil ? (
                    <>
                      <svg aria-hidden="true" focusable="false" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      Berhasil masuk
                    </>
                  ) : loginLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>🔐 Masuk ke Portal</>
                  )}
                </button>
                <p className="text-center text-xs text-slate-500 pt-1">
                  Belum punya akun? <button onClick={() => pindahForm(true)} className="font-bold hover:underline" style={{ color: merek.warnaUtama }}>Daftar di sini</button>
                  <span className="mx-2 text-slate-400">|</span>
                  <button onClick={() => { setShowForgot(true); setForgotStep('request'); setForgotMsg(null); }} className="font-bold hover:underline" style={{ color: merek.warnaUtama }}>Lupa Password?</button>
                </p>
              </div>
            )}

            {showRegister && (
              <div>
                {registerSuccess ? (
                  <div className="text-center py-6">
                    <div className="text-5xl mb-4">{registerBypass ? '🎓' : '✅'}</div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Pendaftaran Berhasil!</h3>
                    <p className="text-slate-500 text-sm mb-4">
                      {registerBypass
                        ? 'Akun kamu sudah langsung aktif untuk Learning Center - tidak perlu menunggu admin. Silakan login sekarang.'
                        : 'Akun kamu akan diverifikasi oleh admin. Kamu akan dihubungi setelah akun diaktifkan.'}
                    </p>
                    <button onClick={() => pindahForm(false)} className="kaca-tombol px-6 py-2.5 rounded-xl font-bold text-sm transition-all">Kembali ke Login</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="f-dashboard-page-2" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Nama Lengkap *</label>
                          <input id="f-dashboard-page-2" type="text" value={registerForm.full_name} onChange={e => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Nama lengkap" />
                        </div>
                        <div>
                          <label htmlFor="f-dashboard-page-3" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Email *</label>
                          <input id="f-dashboard-page-3" type="email" value={registerForm.username} onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="email@perusahaan.com" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Password *</label>
                          <div className="relative">
                            <input type={showRegPwd ? 'text' : 'password'} value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl pl-4 pr-11 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="min. 8 karakter, ada kapital & angka" />
                            <button type="button" onClick={() => setShowRegPwd(v => !v)} tabIndex={-1}
                              aria-label={showRegPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors">
                              {showRegPwd ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Konfirmasi Password *</label>
                          <div className="relative">
                            <input type={showRegConfirmPwd ? 'text' : 'password'} value={registerForm.confirm_password} onChange={e => setRegisterForm({ ...registerForm, confirm_password: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl pl-4 pr-11 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="ulangi password" />
                            <button type="button" onClick={() => setShowRegConfirmPwd(v => !v)} tabIndex={-1}
                              aria-label={showRegConfirmPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors">
                              {showRegConfirmPwd ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="f-dashboard-page-4" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Divisi *</label>
                          <select id="f-dashboard-page-4" value={registerForm.divisi} onChange={e => setRegisterForm({ ...registerForm, divisi: e.target.value, pts_type: '', sales_division: '' })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                            <option value="">-- Pilih Divisi --</option>
                            <option value="PTS">PTS</option>
                            <option value="Sales">Sales</option>
                            <option value="Marketing">Marketing</option>
                          </select>
                        </div>
                        {registerForm.divisi === 'PTS' && (
                          <div>
                            <label htmlFor="f-dashboard-page-5" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widests uppercase">Tipe PTS *</label>
                            <select id="f-dashboard-page-5" value={registerForm.pts_type} onChange={e => setRegisterForm({ ...registerForm, pts_type: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih Tipe PTS --</option>
                              {daftarKelompokPTS.map(k => <option key={k.nama} value={k.label}>{k.label}</option>)}
                            </select>
                          </div>
                        )}
                        {(registerForm.divisi === 'Sales' || registerForm.divisi === 'Marketing') && (
                          <div>
                            <label htmlFor="f-dashboard-page-6" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">
                              {registerForm.divisi === 'Marketing' ? 'Marketing Division *' : 'Sales Division *'}
                            </label>
                            <select id="f-dashboard-page-6" value={registerForm.sales_division} onChange={e => setRegisterForm({ ...registerForm, sales_division: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih {registerForm.divisi} Division --</option>
                              {daftarDivisi.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label htmlFor="f-dashboard-page-7" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Jabatan / Posisi</label>
                          <select id="f-dashboard-page-7" value={registerForm.jabatan} onChange={e => setRegisterForm({ ...registerForm, jabatan: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                            <option value="">— Pilih Jabatan —</option>
                            {JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="f-dashboard-page-8" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">No. HP</label>
                          <input id="f-dashboard-page-8" type="text" value={registerForm.phone_number} onChange={e => setRegisterForm({ ...registerForm, phone_number: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="08xx..." />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="f-dashboard-page-9" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Kode Acara (opsional)</label>
                      <input id="f-dashboard-page-9" type="text" value={registerForm.event_code} onChange={e => setRegisterForm({ ...registerForm, event_code: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Isi hanya jika diberikan admin" />
                    </div>
                    {registerErr && (
                      <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{registerErr}</div>
                    )}
                    <button onClick={() => { setRegisterErr(''); handleRegister(); }} disabled={registerLoading}
                      className="kaca-tombol w-full py-3.5 rounded-xl font-bold transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                      {registerLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      <IkonTeks nama="📝" />Daftar Akun
                    </button>
                    <p className="text-center text-xs text-slate-500">Sudah punya akun? <button onClick={() => pindahForm(false)} className="font-bold hover:underline" style={{ color: merek.warnaUtama }}>Login</button></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {showForgot && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-1000 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800"><IkonTeks nama="🔐" />Reset Password</h3>
                <button aria-label="Tutup" onClick={() => setShowForgot(false)} className="text-slate-500 hover:text-slate-600 font-bold text-lg leading-none">✕</button>
              </div>
              {forgotMsg && (
                <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${forgotMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {forgotMsg.text}
                </div>
              )}
              {forgotStep === 'request' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Kode OTP dikirim ke WhatsApp terdaftar.</p>
                  <input type="text" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)}
                    placeholder="Email / Username" onKeyDown={e => e.key === 'Enter' && handleForgotRequest()}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-hidden" />
                  <button onClick={handleForgotRequest} disabled={forgotLoading}
                    className="w-full text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition-all hover:opacity-90" style={{ background: merek.warnaUtama }}>
                    {forgotLoading ? 'Mengirim...' : 'Kirim Kode OTP'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Masukkan kode 6-digit yang dikirim ke WA {forgotMaskedPhone ? <strong>{forgotMaskedPhone}</strong> : 'terdaftar'}, lalu buat password baru.</p>
                  <input type="text" value={forgotOtp} onChange={e => setForgotOtp(e.target.value)}
                    placeholder="Kode OTP (6 digit)" maxLength={6}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-center tracking-widest font-bold focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-hidden" />
                  <input type="password" value={forgotNewPwd} onChange={e => setForgotNewPwd(e.target.value)}
                    placeholder="Password baru (min. 8, ada kapital & angka)"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-hidden" />
                  <input type="password" value={forgotConfirmPwd} onChange={e => setForgotConfirmPwd(e.target.value)}
                    placeholder="Konfirmasi password baru"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-hidden" />
                  <div className="flex gap-2">
                    <button onClick={() => { setForgotStep('request'); setForgotMsg(null); }}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-all">Kembali</button>
                    <button onClick={handleForgotVerify} disabled={forgotLoading}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-all hover:opacity-90" style={{ background: merek.warnaUtama }}>
                      {forgotLoading ? 'Menyimpan...' : 'Reset Password'}
                    </button>
                  </div>
                  <button onClick={handleForgotRequest} disabled={forgotLoading}
                    className="w-full text-xs text-slate-500 hover:text-rose-500 transition-all">
                    Kirim ulang OTP
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
        )}
      </div>
      </>
    );
}
