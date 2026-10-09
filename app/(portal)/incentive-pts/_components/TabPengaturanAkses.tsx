'use client';

/** TabPengaturanAkses - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { bisaKonfig, type CurrentUser, type TabKey } from './aturan-halaman';
import { IkonTeks } from '@/components/shared/Ikon';
import { tingkatAkses, LABEL_AKSES, JELAS_AKSES, URUTAN_AKSES, type TingkatAkses } from '@/lib/incentive-akses';

export interface TabPengaturanAksesProps {
  allUsers: CurrentUser[];
  cariUser: string;
  currentUser: CurrentUser | null;
  handleSetAkses: (userId: string, nilai: TingkatAkses) => Promise<void>;
  handleSetBrandScope: (userId: string, scope: string | null) => Promise<void>;
  loading: boolean;
  setCariUser: import("react").Dispatch<import("react").SetStateAction<string>>;
  tab: TabKey;
}

export function TabPengaturanAkses({ allUsers, cariUser, currentUser, handleSetAkses, handleSetBrandScope, loading, setCariUser, tab }: TabPengaturanAksesProps) {
  return (
    <>
      {tab === 'settings' && bisaKonfig(currentUser) && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))' }}>
            <h2 className="font-bold text-gray-800"><IkonTeks nama="⚙" />Akses Incentive PTS</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tingkat akses tiap orang diatur di sini — tidak ada lagi yang ditentukan dari kode.
              Role <strong>admin</strong> selalu Konfigurasi penuh dan selalu melihat semua brand.
            </p>
            {/*
              Keterangan tiga tingkat dicetak di layar, bukan hanya di tooltip.
              Tombol yang membagi-bagi uang harus bisa dibaca akibatnya
              sebelum ditekan, terutama oleh orang yang baru memakai modul ini.
            */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {URUTAN_AKSES.map(t => (
                <div key={t} className="rounded-lg border border-indigo-100 bg-white/70 px-3 py-2">
                  <p className="text-[11px] font-bold text-indigo-700">{LABEL_AKSES[t]}</p>
                  <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{JELAS_AKSES[t]}</p>
                </div>
              ))}
            </div>
            {/*
              Pencarian. Daftar ini berisi seluruh user guest & team - pada
              perusahaan sebesar ini menggulirnya untuk menemukan dua orang
              Finance jauh lebih lambat daripada mengetik namanya.
            */}
            <input value={cariUser} onChange={e => setCariUser(e.target.value)}
              placeholder="Cari nama atau username…" aria-label="Cari pengguna"
              className="mt-3 w-full sm:max-w-xs text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="divide-y divide-gray-100">
            {(() => {
              const q = cariUser.trim().toLowerCase();
              const daftar = allUsers
                .filter(u => u.role === 'guest' || u.role === 'team')
                .filter(u => !q
                  || ((u.full_name as string) || '').toLowerCase().includes(q)
                  || ((u.username as string) || '').toLowerCase().includes(q));
              if (daftar.length === 0) {
                return <p className="px-5 py-4 text-sm text-gray-500 italic">
                  {q ? `Tidak ada pengguna cocok dengan "${cariUser}".` : 'Tidak ada user guest/team.'}
                </p>;
              }
              return daftar.map(u => {
                const akses = tingkatAkses(u);
                const diriSendiri = u.id === currentUser?.id;
                /*
                  Full Access (Kelola Akun) SELALU menang jadi 'penuh' di
                  sini juga (lihat tingkatAkses di lib/incentive-akses.ts) -
                  tombol tiga tingkat di bawah karena itu tidak berarti
                  apa-apa untuknya: mengklik "Lihat saja" akan tersimpan ke
                  kolom, tapi tampilannya tetap 'penuh' di render berikutnya
                  karena Full Access mengambil alih. Daripada tombolnya
                  terlihat "tidak berfungsi", untuk akun begini tombolnya
                  diganti keterangan - turunkan aksesnya lewat Kelola Akun,
                  bukan dari sini.
                */
                const viaFullAccess = (u.role === 'team' || u.role === 'team_pts') && (u.access_level as string | null) === 'full';
                return (
                  <div key={u.id as string} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-700">
                        {u.full_name as string}
                        {diriSendiri && <span className="ml-1.5 text-[11px] font-bold text-indigo-600">(Anda)</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {u.username as string} · {u.role as string}
                        {u.jabatan ? ` · ${u.jabatan as string}` : ''}{u.team_type ? ` · ${u.team_type as string}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/*
                        Pemilih lingkup hanya muncul untuk yang sudah punya
                        akses input/penuh. Menetapkan lingkup pada orang yang
                        hanya boleh melihat tidak berakibat apa-apa, dan
                        menampilkannya hanya membuat daftar ini penuh kontrol
                        yang tidak mengubah apa pun.
                      */}
                      {akses !== 'lihat' && (
                        <div className="flex items-center gap-1" role="group" aria-label={`Lingkup brand ${u.full_name as string}`}>
                          {([['MVI', '🏠 MVI'], ['IVP', '🌐 IVP'], [null, 'Semua']] as const).map(([nilai, label]) => {
                            const aktif = (u.incentive_brand_scope ?? null) === nilai;
                            return (
                              <button key={label} onClick={() => handleSetBrandScope(u.id as string, nilai)}
                                title={nilai ? `Hanya proyek brand ${nilai} (proyek Kedua Brand tetap terlihat)` : 'Melihat semua brand'}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${aktif
                                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                  : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300'}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/*
                        Tiga tombol, bukan satu saklar: tingkat aksesnya
                        memang tiga, dan menyembunyikan yang ketiga di balik
                        saklar dua keadaan itulah yang dulu membuat "beri
                        Manager akses penuh" mustahil tanpa mengubah kode.
                      */}
                      {viaFullAccess ? (
                        <span title="Diberikan lewat toggle Full Access di Kelola Akun. Untuk mengubahnya, cabut Full Access di sana - bukan di sini."
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-2"
                          style={{ borderColor: '#10b981', background: '#ecfdf5', color: '#047857' }}>
                          <IkonTeks nama="🔓" />Konfigurasi penuh · Full Access
                        </span>
                      ) : (
                      <div className="flex items-center gap-1" role="group" aria-label={`Tingkat akses ${u.full_name as string}`}>
                        {URUTAN_AKSES.map(t => {
                          const aktif = akses === t;
                          //  Menurunkan akses diri sendiri ditolak server; tombolnya
                          //  dimatikan di sini supaya penolakan itu tidak jadi kejutan.
                          const terkunci = diriSendiri && t !== 'penuh';
                          //  Warnanya lewat style, bukan kelas Tailwind yang
                          //  dirangkai dari variabel: kelas seperti
                          //  `border-${warna}-500` tidak pernah ikut ter-build
                          //  karena Tailwind memindai kode sebagai teks.
                          const warna = t === 'penuh'
                            ? { garis: '#10b981', latar: '#ecfdf5', teks: '#047857' }
                            : t === 'input'
                              ? { garis: '#6366f1', latar: '#eef2ff', teks: '#4338ca' }
                              : { garis: '#9ca3af', latar: '#f9fafb', teks: '#4b5563' };
                          return (
                            <button key={t} disabled={terkunci}
                              onClick={() => handleSetAkses(u.id as string, t)}
                              title={terkunci ? 'Tidak bisa menurunkan akses Anda sendiri.' : JELAS_AKSES[t]}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all ${terkunci
                                ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                                : aktif ? '' : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300'}`}
                              style={aktif && !terkunci
                                ? { borderColor: warna.garis, background: warna.latar, color: warna.teks }
                                : undefined}>
                              {aktif ? '✅ ' : ''}{LABEL_AKSES[t]}
                            </button>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </>
  );
}
