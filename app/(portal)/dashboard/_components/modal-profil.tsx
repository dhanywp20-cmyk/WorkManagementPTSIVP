'use client';

import { User, ALL_MENU_LABELS } from './shared';
import { ModalPortal, formatUsername } from '@/components/shared';

import { Kartu, Baris, Kelompok } from './modal-bersama';
import { bolehDiwaypiDan2FA } from '@/lib/constants';
import { InstallGuideModal } from './InstallGuideModal';
import { UnduhApk } from './UnduhApk';
import { Profil2FA } from './profil-2fa';
import { ProfilIntegrasi } from './profil-integrasi';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { useModalProfil } from './useModalProfil';

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
}

export function UserProfileModal({ currentUser, onClose }: UserProfileModalProps) {
  const {
    salam, userData, jabatanCfg, menuAktif, notification, telegramAktif, autoHubung, putuskanTelegram,
    menghubungkan, telegramBot, mulaiAutoHubung, pesanTelegram, editPhone, phoneInput, setPhoneInput, handleSavePhone,
    saving, setEditPhone, bergabung, atasanList, ivpList, sortedSubordinates, editPassword, passwordInput,
    setPasswordInput, getPasswordStrength, confirmPassword, setConfirmPassword, handleSavePassword, setEditPassword, statusInstall, handlePasangAplikasi,
    memasang, merek, setShowInstallGuide, roleClass, cariIzin, setCariIzin, menuTersaring, showInstallGuide,
  } = useModalProfil({ currentUser });

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} className="fixed inset-0 z-1000 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-50 rounded-kartu shadow-modal w-full max-w-5xl h-full max-h-full flex flex-col overflow-hidden border border-slate-200">

        <div className="shrink-0 px-6 py-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(120deg,#be123c,#9f1239 55%,#881337)' }}>
          <button aria-label="Tutup" onClick={onClose}
            className="absolute top-4 right-4 bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all z-10">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex flex-wrap items-end justify-between gap-4 pr-10">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-200/90 mb-1.5">
                {salam} · <span className="text-white/70 normal-case tracking-normal font-medium">{formatUsername(userData.username)}</span>
              </p>
              <h2 className="text-2xl sm:text-3xl sm:leading-9 font-black text-white tracking-tight leading-tight truncate">
                {userData.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {jabatanCfg && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/15 text-white backdrop-blur-sm">
                    <Ikon nama={jabatanCfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {userData.jabatan}
                  </span>
                )}
                {jabatanCfg && (userData.team_type || userData.sales_division) && (
                  <span className="text-white/40 text-xs">›</span>
                )}
                {(userData.team_type || userData.sales_division) && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/15 text-white backdrop-blur-sm">
                    {userData.team_type || userData.sales_division}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <div className="rounded-xl px-4 py-2.5 text-center min-w-[76px]" style={{ background: 'rgba(0,0,0,0.22)' }}>
                <p className="text-lg sm:text-2xl sm:leading-8 font-black text-white leading-none">{menuAktif.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-200/80 mt-1">Modul</p>
              </div>
              <div className="rounded-xl px-4 py-2.5 text-center min-w-[76px]" style={{ background: 'rgba(250,204,21,0.9)' }}>
                <p className="text-sm font-black text-amber-900 leading-none pt-1.5 truncate">{userData.role}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900/70 mt-1.5">Peran</p>
              </div>
            </div>
          </div>
        </div>

        {notification && (
          <div className={`mx-5 mt-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="lg:col-span-2 space-y-4">

              {telegramAktif && (
              <Kartu icon="✈️" judul="Notifikasi Telegram">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Status</span>
                    {userData.telegram_terhubung ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Terhubung
                      </span>
                    ) : autoHubung === 'menunggu' ? (
                      <span className="inline-flex items-center gap-1.5 text-sky-700 font-bold text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" /> Menunggu konfirmasi…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 font-bold text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Belum Terhubung
                      </span>
                    )}
                  </div>

                  {userData.telegram_terhubung ? (
                    <>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Notifikasi assign & jadwal akan ikut masuk ke Telegram, berdampingan dengan WhatsApp.
                      </p>
                      <button onClick={putuskanTelegram} disabled={menghubungkan}
                        className="w-full py-2 rounded-xl border border-red-200 bg-white text-xs font-bold text-red-600 hover:bg-red-50 transition-all disabled:opacity-40">
                        {menghubungkan ? 'Memutuskan…' : 'Putuskan Telegram'}
                      </button>
                    </>
                  ) : telegramBot.status === 'galat' ? (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Belum bisa dipakai - {telegramBot.alasan}
                    </p>
                  ) : (
                    <>
                      <ol className="text-[11px] text-slate-500 leading-relaxed space-y-1 list-decimal list-inside">
                        <li>Tekan <b>Buka Bot &amp; Kirim Start</b> - Telegram terbuka, tekan <b>Start</b> di sana.</li>
                        <li>Kembali ke sini - koneksi terdeteksi otomatis, tidak perlu menekan apa pun lagi.</li>
                      </ol>
                      <button onClick={mulaiAutoHubung} disabled={autoHubung === 'menunggu' || telegramBot.status !== 'siap'}
                        className="w-full py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ background: '#0088cc' }}>
                        {telegramBot.status === 'memuat' ? 'Memuat…' : autoHubung === 'menunggu' ? 'Menunggu konfirmasi…' : '➤ Buka Bot & Kirim Start'}
                      </button>
                      {autoHubung === 'menunggu' && (
                        <p className="text-[11px] text-sky-700 leading-relaxed">
                          <IkonTeks nama="⏳" />Mengecek otomatis tiap beberapa detik, maks. 5 menit setelah Anda menekan Start di Telegram.
                        </p>
                      )}
                      {autoHubung === 'gagal' && (
                        <p className="text-[11px] text-red-600 leading-relaxed">
                          <IkonTeks nama="⚠" />Belum terhubung. Pastikan sudah menekan Start di bot, lalu tekan tombolnya lagi.
                        </p>
                      )}
                    </>
                  )}

                  {pesanTelegram && (
                    <div className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold ${pesanTelegram.tipe === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {pesanTelegram.tipe === 'ok' ? '✅' : '⚠️'} {pesanTelegram.teks}
                    </div>
                  )}
                </div>
              </Kartu>
              )}

              <Kartu icon="👤" judul="Informasi Pribadi & Kontak">
                <div className="divide-y divide-slate-100">
                  <Baris icon="#"  label="Username / NIK"  value={formatUsername(userData.username)} />
                  <Baris icon="👤" label="Nama Lengkap"    value={userData.full_name} />
                  <Baris icon="📱" label="No. Telepon / WA">
                    {editPhone ? (
                      <div className="flex items-center gap-2">
                        <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          className="w-40 rounded-lg border border-slate-300 px-2.5 py-1 text-sm outline-hidden focus:ring-2 focus:ring-rose-200" />
                        <button onClick={handleSavePhone} disabled={saving}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">Simpan</button>
                        <button onClick={() => { setEditPhone(false); setPhoneInput(userData.phone_number || ''); }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">Batal</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={userData.phone_number ? 'text-slate-800 font-semibold text-sm' : 'text-slate-500 text-sm'}>
                          {userData.phone_number || 'Belum diisi'}
                        </span>
                        <button onClick={() => setEditPhone(true)}
                          className="text-[11px] text-rose-600 font-bold hover:underline">Ubah</button>
                      </div>
                    )}
                  </Baris>
                  {userData.team_type && (
                    <Baris icon="👥" label="Tim" value={userData.team_type} />
                  )}
                  {userData.sales_division && (
                    <Baris icon="🏢" label="Divisi" value={userData.sales_division} />
                  )}
                  {!userData.team_type && !userData.sales_division && (
                    <Baris icon="🏢" label="Divisi / Tim" value="—" />
                  )}
                  <Baris icon="⭐" label="Jabatan"       value={userData.jabatan || '—'} />
                  <Baris icon="📅" label="Bergabung Sejak" value={bergabung} />
                  <Baris icon="🔑" label="Status Akun">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Aktif
                    </span>
                  </Baris>
                </div>
              </Kartu>

              <Kartu icon="🗂️" judul="Struktur Organisasi">
                <div className="p-4 space-y-3">
                  <Kelompok label={`Atasan${userData.sales_division ? ' · ' + userData.sales_division : ''}`} kosong="Belum ada atasan terdaftar" orang={atasanList} warna="#b45309" />
                  <Kelompok label="Sales Internal (IVP)" kosong="Belum ada Sales Internal terpetakan" orang={ivpList} warna="#0369a1" />
                  <Kelompok label="Bawahan" kosong="Belum ada bawahan terdaftar" orang={sortedSubordinates} warna="#4d7c0f" />
                </div>
              </Kartu>

              <Kartu icon="🛡️" judul="Keamanan & Sandi">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Sesi Saat Ini</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online &amp; Terotentikasi
                    </span>
                  </div>
                  {editPassword ? (
                    <div className="space-y-2 pt-1">
                      <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                        placeholder="Password baru (min. 8 karakter, 1 kapital, 1 angka)"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-rose-200" />
                      {passwordInput && (() => {
                        const { score, label, color } = getPasswordStrength(passwordInput);
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full ${color} transition-all`} style={{ width: `${(score / 5) * 100}%` }} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-500">{label}</span>
                          </div>
                        );
                      })()}
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-rose-200" />
                      {confirmPassword && passwordInput !== confirmPassword && (
                        <p className="text-[11px] text-red-500 font-semibold">Password tidak cocok</p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={handleSavePassword} disabled={saving}
                          className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg disabled:opacity-40">Simpan Password</button>
                        <button onClick={() => { setEditPassword(false); setPasswordInput(''); setConfirmPassword(''); }}
                          className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg">Batal</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setEditPassword(true)}
                      className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                      <IkonTeks nama="🔑" />Ubah Password
                    </button>
                  )}
                  {bolehDiwaypiDan2FA(userData) && <><Profil2FA /><ProfilIntegrasi /></>}
                </div>
              </Kartu>
            </div>

            <div className="space-y-4">
              <Kartu icon="📲" judul="Aplikasi di HP">
                <div className="p-4 space-y-3">
                  {statusInstall === 'terpasang' ? (
                    <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sudah terpasang di perangkat ini.
                    </p>
                  ) : statusInstall === 'siap' ? (
                    <>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Akses lebih cepat + notifikasi langsung ke HP, seperti aplikasi biasa - tanpa file .apk.
                      </p>
                      <button onClick={handlePasangAplikasi} disabled={memasang}
                        className="w-full py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: `linear-gradient(135deg, ${merek.warnaUtama}, #881337)` }}>
                        {memasang ? 'Memasang…' : '⬇️ Install Aplikasi'}
                      </button>
                    </>
                  ) : statusInstall === 'ios' ? (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Tap ikon <strong>Share</strong> di Safari, lalu pilih <strong>&quot;Tambah ke Layar Utama&quot;</strong>.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Peramban ini belum menawarkan prompt install otomatis.
                      </p>
                      <button onClick={() => setShowInstallGuide(true)}
                        className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                        Lihat cara pasang manual
                      </button>
                    </>
                  )}
                  <UnduhApk />
                </div>
              </Kartu>

              <Kartu icon="🎭" judul="Peran Pengguna" hitung="1 Role">
                <div className="p-4 space-y-3">
                  <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold border ${roleClass}`}>
                    {userData.role}
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Level Akses</p>
                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      (userData as { access_level?: string }).access_level === 'full'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {(userData as { access_level?: string }).access_level === 'full' ? '🔓 Full Access' : '🔒 Guest'}
                    </span>
                  </div>
                </div>
              </Kartu>

              <Kartu icon="🔐" judul="Hak Akses Modul" hitung={String(menuAktif.length)}>
                <div className="p-4 space-y-2.5">
                  <input aria-label="Cari modul..." value={cariIzin} onChange={e => setCariIzin(e.target.value)}
                    placeholder="Cari modul..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-rose-200" />
                  <div className="flex flex-wrap gap-1.5">
                    {menuTersaring.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2">Tidak ada modul yang cocok.</p>
                    ) : menuTersaring.map(k => {
                      const cfg = ALL_MENU_LABELS[k];
                      return (
                        <span key={k}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <Ikon nama={cfg?.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {cfg?.label ?? k}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                    Daftar ini ditentukan admin lewat Admin Panel. Untuk menambah akses modul,
                    hubungi admin.
                  </p>
                </div>
              </Kartu>
            </div>
          </div>
        </div>
      </div>
    </div>
    {showInstallGuide && <InstallGuideModal warnaUtama={merek.warnaUtama} onClose={() => setShowInstallGuide(false)} />}
  </ModalPortal>
  );
}
