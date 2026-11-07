'use client';

import { SkemaInsentif, hitungPembagian, persenInstaller } from '@/lib/incentive/scheme';
import { IkonTeks } from '@/components/shared/Ikon';

export const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export const inputKecil = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-hidden focus:border-rose-400 focus:ring-2 focus:ring-rose-100';

export const CONTOH = 5_000_000;

export function TotalPersen({ nilai }: { nilai: number }) {
  const bulat = Math.round(nilai * 100) / 100;
  const pas = bulat === 100;
  const selisih = Math.round((bulat - 100) * 100) / 100;
  return (
    <span
      className="text-[11px] font-bold px-2 py-1 rounded-lg whitespace-nowrap"
      style={{
        background: pas ? '#dcfce7' : '#ffe4e6',
        color: pas ? '#15803d' : '#be123c',
      }}>
      {pas
        ? `Total ${bulat}% ✓`
        : `Total ${bulat}% — ${selisih > 0 ? `lebih ${selisih}` : `kurang ${Math.abs(selisih)}`}%`}
    </span>
  );
}

export function Seksi({ no, judul, ket, warna, children }: {
  no: string; judul: string; ket: string; warna: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-slate-100 border border-slate-200 p-3 sm:p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="shrink-0 w-6 h-6 rounded-lg text-white text-[11px] font-black flex items-center justify-center mt-0.5"
          style={{ background: warna }} aria-hidden="true">{no}</span>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-800 text-sm leading-tight">{judul}</h3>
          <p className="text-[11px] text-gray-600 leading-relaxed mt-0.5">{ket}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

type Pratinjau = (remote: boolean, adaSupport: boolean, spvJadiPic: boolean) => ReturnType<typeof hitungPembagian>;

export function SeksiDaerahRemote({ sk, ubah, pratinjau }: {
  sk: SkemaInsentif; ubah: (patch: Partial<SkemaInsentif>) => void; pratinjau: Pratinjau;
}) {
  return (
    <Seksi no="3" judul="PTS Daerah &amp; Mode Remote" warna="#2563eb"
      ket="Dinaikkan ke sini karena porsi Remote adalah AKIBAT langsung dari setelan PTS Daerah — keduanya harus terbaca bersamaan.">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,22rem)_1fr] gap-3 items-stretch">
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-gray-800 text-sm"><IkonTeks nama="🔧" />Pembagian untuk PTS Daerah</h3>
          <p className="text-[11px] text-gray-500">Porsinya dipotong dari pool lebih dulu; sisanya dibagi ke Tim PTS.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
          <input type="checkbox" checked={sk.installerAktif}
            onChange={e => ubah({ installerAktif: e.target.checked })}
            aria-label="PTS Daerah ikut mendapat pembagian" />
          PTS Daerah ikut dapat bagian
        </label>
      </div>

      {!sk.installerAktif ? (
        <p className="px-4 sm:px-5 py-4 text-xs text-gray-500 leading-relaxed">
          PTS Daerah <strong>tidak</strong> mendapat porsi insentif. Nama & daerahnya tetap dicatat
          dari Request Schedule — pencatatan rekam jejak tidak bergantung pada pembagian uang.
        </p>
      ) : (
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="f-incentive-pts-components-schemetab-1" className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
              Porsi PTS Daerah (%)
            </label>
            <input id="f-incentive-pts-components-schemetab-1" type="number" min={0} max={99} step="0.01" value={sk.installerRemotePersen}
              onChange={e => ubah({ installerRemotePersen: parseFloat(e.target.value) || 0 })}
              aria-label="Porsi PTS Daerah" className={inputKecil} />
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Sisa <strong>{(100 - (sk.installerRemotePersen || 0)).toFixed(2).replace(/\.00$/, '')}%</strong> dibagi
              ke Tim PTS menurut Porsi Normal di atas. Totalnya tetap 100% berapa pun angka ini.
            </p>
          </div>
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={sk.installerBayarDiMuka}
                onChange={e => ubah({ installerBayarDiMuka: e.target.checked })} />
              <span>
                <strong>Dibayar penuh di tahun pertama.</strong> Porsi PTS Daerah tidak ikut dipecah
                ke tahapan bertahun-tahun seperti Tim PTS.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={sk.installerHanyaRemote}
                onChange={e => ubah({ installerHanyaRemote: e.target.checked })} />
              <span>
                <strong>Hanya proyek REMOTE.</strong> Lepas centang ini bila PTS Daerah berhak atas
                porsinya pada proyek mana pun, termasuk onsite.
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
    {persenInstaller(sk, true) > 0 && (
      <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden h-full flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-blue-100 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
          <h3 className="font-bold text-gray-800 text-sm"><IkonTeks nama="🔧" />Pola Pembagian saat PTS Daerah Aktif</h3>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Porsi PTS Daerah <strong>{persenInstaller(sk, true)}%</strong> dipotong dari pool lebih dulu;
            sisa <strong>{(100 - persenInstaller(sk, true)).toFixed(2).replace(/\.00$/, '')}%</strong> dibagi
            ke Tim PTS menurut porsi di atas. Angka di bawah dihitung otomatis — ubah porsi dasarnya
            dan ini ikut berubah.
          </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer shrink-0">
            <input type="checkbox" checked={sk.porsiRemote.aktif}
              onChange={e => ubah({ porsiRemote: { ...sk.porsiRemote, aktif: e.target.checked } })}
              aria-label="Atur porsi Remote sendiri" />
            Atur sendiri
          </label>
        </div>
        {sk.porsiRemote.aktif ? (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ['adaSupport', 'Ada Support PTS di tahun itu'],
              ['tanpaSupport', 'TIDAK ada Support PTS di tahun itu'],
            ] as const).map(([kunciPeta, judul]) => {
              const peta = sk.porsiRemote[kunciPeta];
              const total = Object.values(peta).reduce((t, n) => t + (n || 0), 0);
              const barisPeran = [...sk.porsi.map(p => ({ k: p.peran, l: p.label })), { k: 'installer', l: '🔧 PTS Daerah' }];
              return (
                <div key={kunciPeta} className="rounded-xl border border-blue-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <p className="text-[11px] font-black uppercase tracking-widest text-blue-700">{judul}</p>
                    <TotalPersen nilai={total} />
                  </div>
                  <div className="space-y-1.5">
                    {barisPeran.map(b => (
                      <div key={b.k} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 flex-1 truncate">{b.l}</span>
                        <div className="relative w-24 shrink-0">
                          <input type="number" min={0} max={100} step="0.01" value={peta[b.k] ?? 0}
                            onChange={e => ubah({ porsiRemote: { ...sk.porsiRemote,
                              [kunciPeta]: { ...peta, [b.k]: parseFloat(e.target.value) || 0 } } })}
                            aria-label={`Porsi Remote ${b.l} (${judul})`} className={`${inputKecil} pr-6`} />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500" aria-hidden="true">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="md:col-span-2 text-[11px] text-gray-500 leading-relaxed">
              Angka ini dipakai <strong>apa adanya</strong> — tidak dikali apa pun, dan porsi PTS Daerah
              diambil dari baris di tabel ini, bukan dari kolom &quot;Porsi PTS Daerah&quot; di atas.
              Kedua tabel wajib berjumlah tepat 100% sebelum bisa disimpan.
            </p>
          </div>
        ) : (
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ['Ada Support PTS di tahun itu', pratinjau(true, true, false),
              'Porsi Support dibagi rata ke semua yang menangani Troubleshooting pada tahun bersangkutan.'],
            ['TIDAK ada Support PTS di tahun itu', pratinjau(true, false, false),
              'Memakai angka "Bila Tidak Ada Support" di atas, lalu dikali sisa pool. Porsi Support diserap sesuai pengaturan itu — untuk tahun itu saja; tahun lain dinilai ulang sendiri.'],
          ] as const).map(([judul, hasil, ket]) => {
            const totalPct = hasil.reduce((n, h) => n + h.percentage, 0);
            const pas = Math.abs(totalPct - 100) < 0.01;
            return (
              <div key={judul} className="rounded-xl border border-blue-100 bg-white overflow-hidden">
                <p className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-blue-700 bg-blue-50">{judul}</p>
                <div className="divide-y divide-gray-50">
                  {hasil.map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs gap-2">
                      <span className={`truncate ${h.role === 'installer' ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                        {h.role === 'installer' ? '🔧 ' : ''}{h.user_name}
                      </span>
                      <span className="font-semibold text-gray-800 whitespace-nowrap">
                        {h.percentage.toFixed(2).replace(/\.00$/, '')}% · {rp(h.amount)}
                      </span>
                    </div>
                  ))}
                  {!hasil.length && <p className="px-3 py-3 text-xs text-gray-500 italic">Belum ada porsi.</p>}
                </div>
                <p className={`px-3 py-1.5 text-xs font-bold ${pas ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                  Total {totalPct.toFixed(2).replace(/\.00$/, '')}%
                </p>
                <p className="px-3 py-2 text-[11px] text-gray-500 leading-relaxed border-t border-gray-50">{ket}</p>
              </div>
            );
          })}
        </div>
        )}
        <p className="px-4 sm:px-5 pb-4 text-[11px] text-gray-500 leading-relaxed">
          Contoh nominal memakai pool {rp(CONTOH)}. PTS Daerah dibayar
          {sk.installerBayarDiMuka ? ' penuh di tahun pertama' : ' mengikuti tahapan seperti Tim PTS'};
          porsi Tim PTS tetap dipecah ke Tahapan Pencairan.
        </p>
      </div>
    )}
      </div>
    </Seksi>
  );
}

export function SeksiAturanPencairan({ sk, ubah, totalTranche }: {
  sk: SkemaInsentif; ubah: (patch: Partial<SkemaInsentif>) => void; totalTranche: number;
}) {
  return (
    <Seksi no="4" judul="Aturan Khusus &amp; Pencairan" warna="#7c3aed"
      ket="Perkecualian saat peran merangkap, dan jadwal pencairannya.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 text-sm">Aturan Khusus</h3>
      </div>
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="f-incentive-pts-components-schemetab-2" className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-1">
            Supervisor merangkap PIC → porsi koordinasinya dialihkan ke
          </label>
          <select id="f-incentive-pts-components-schemetab-2" value={sk.hangusSupervisorKe} onChange={e => ubah({ hangusSupervisorKe: e.target.value })}
            aria-label="Tujuan porsi Supervisor yang hangus" className={inputKecil}>
            <option value="">— hangus, tanpa penerima —</option>
            {sk.porsi.filter(p => p.peran !== 'supervisor').map(p => (
              <option key={p.peran} value={p.peran}>{p.label}</option>
            ))}
          </select>
          {(() => {
            const spv = sk.porsi.find(p => p.peran === 'supervisor')?.persen ?? 0;
            const tujuan = sk.hangusSupervisorKe;
            const label = sk.porsi.find(p => p.peran === tujuan)?.label;
            const asal = sk.porsi.find(p => p.peran === tujuan)?.persen ?? 0;
            return (
              <p className="mt-1.5 text-[11px] text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
                Baris <strong>Supervisor hilang</strong> dari pembagian — orang yang sama tidak dibayar
                dua kali.{' '}
                {tujuan && label
                  ? <>Porsinya <strong>{spv}%</strong> pindah ke <strong>{label}</strong>, sehingga peran itu
                      menerima <strong>{asal}% + {spv}% = {asal + spv}%</strong> pada proyek tersebut.</>
                  : <>Porsinya <strong>{spv}%</strong> tidak diberikan ke siapa pun — sisa porsi lain
                      dinaikkan sebanding supaya totalnya tetap 100%.</>}
              </p>
            );
          })()}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
            Manager sebagai PIC — porsi per tahun pencairan
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['adaSupport', 'Ada Troubleshooting di tahun itu'],
              ['tanpaSupport', 'Tidak ada Troubleshooting'],
            ] as const).map(([kunciPeta, judul]) => {
              const peta = sk.managerSebagaiPic[kunciPeta];
              const total = Object.values(peta).reduce((t, n) => t + (n || 0), 0);
              return (
                <div key={kunciPeta} className="rounded-xl border border-gray-100 bg-gray-50/60 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">{judul}</span>
                    <TotalPersen nilai={total} />
                  </div>
                  {[{ k: 'pic', l: 'Manager (sebagai PIC)' }, { k: 'support', l: 'Tim Support' }].map(b => (
                    <div key={b.k} className="flex items-center gap-2 mb-1.5 last:mb-0">
                      <span className="text-xs text-gray-600 flex-1 truncate">{b.l}</span>
                      <div className="relative w-20 shrink-0">
                        <input type="number" min={0} max={100} step="0.01" value={peta[b.k] ?? 0}
                          onChange={e => ubah({ managerSebagaiPic: { ...sk.managerSebagaiPic,
                            [kunciPeta]: { ...peta, [b.k]: parseFloat(e.target.value) || 0 } } })}
                          aria-label={`Manager sebagai PIC — ${b.l} (${judul})`} className={`${inputKecil} pr-6`} />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500" aria-hidden="true">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-2 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-widest text-violet-700">
              Supervisor merangkap PIC — tabel porsi tersendiri
            </span>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer shrink-0">
              <input type="checkbox" checked={sk.supervisorSebagaiPic.aktif}
                onChange={e => ubah({ supervisorSebagaiPic: { ...sk.supervisorSebagaiPic, aktif: e.target.checked } })}
                aria-label="Atur porsi Supervisor-sebagai-PIC sendiri" />
              Atur sendiri
            </label>
          </div>
          {sk.supervisorSebagaiPic.aktif ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ['remote', 'tanpaSupport', 'Remote — tanpa Support'],
                  ['remote', 'adaSupport', 'Remote — ada Support'],
                  ['onsite', 'tanpaSupport', 'Onsite — tanpa Support'],
                  ['onsite', 'adaSupport', 'Onsite — ada Support'],
                ] as const).map(([kunciMode, kunciPeta, judul]) => {
                  const peta = sk.supervisorSebagaiPic[kunciMode][kunciPeta];
                  const total = Object.values(peta).reduce((t, n) => t + (n || 0), 0);
                  const barisPeran = [
                    { k: 'pic', l: 'PIC (Supervisor)' },
                    { k: 'support', l: 'Tim Support' },
                    { k: 'manager', l: 'Manager' },
                    ...(kunciMode === 'remote' ? [{ k: 'installer', l: '🔧 PTS Daerah' }] : []),
                  ];
                  return (
                    <div key={`${kunciMode}-${kunciPeta}`} className="rounded-xl border border-violet-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <p className="text-[11px] font-black uppercase tracking-widest text-violet-700">{judul}</p>
                        <TotalPersen nilai={total} />
                      </div>
                      <div className="space-y-1.5">
                        {barisPeran.map(b => (
                          <div key={b.k} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 flex-1 truncate">{b.l}</span>
                            <div className="relative w-20 shrink-0">
                              <input type="number" min={0} max={100} step="0.01" value={peta[b.k] ?? 0}
                                onChange={e => ubah({ supervisorSebagaiPic: { ...sk.supervisorSebagaiPic,
                                  [kunciMode]: { ...sk.supervisorSebagaiPic[kunciMode],
                                    [kunciPeta]: { ...peta, [b.k]: parseFloat(e.target.value) || 0 } } } })}
                                aria-label={`Supervisor-sebagai-PIC ${b.l} (${judul})`} className={`${inputKecil} pr-6`} />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500" aria-hidden="true">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                Angka ini dipakai <strong>apa adanya</strong> menggantikan porsi PIC-staff-biasa di atas -
                bukan menambahnya. Keempat tabel wajib berjumlah tepat 100% sebelum bisa disimpan.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-violet-800 leading-relaxed">
              Saklar mati — Supervisor-sebagai-PIC memakai aturan &quot;Aturan Khusus&quot; di atas: porsi
              koordinasinya <strong>dialihkan ke {sk.porsi.find(p => p.peran === sk.hangusSupervisorKe)?.label ?? '(hangus)'}</strong>,
              di atas peta PIC-staff-biasa yang sama — tidak dibedakan Remote/Onsite atau ada/tidaknya Support.
            </p>
          )}
        </div>
      </div>
    </div>
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-gray-800 text-sm">Tahapan Pencairan Tim PTS</h3>
        <TotalPersen nilai={totalTranche} />
        <button type="button"
          onClick={() => ubah({ tranche: [...sk.tranche, { nomor: sk.tranche.length + 1, persen: 0, tahunKe: sk.tranche.length + 1 }] })}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 transition-all">
          + Tahap
        </button>
      </div>
      <div className="p-4 sm:p-5 space-y-2">
        {sk.tranche.map((t, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <span className="col-span-3 sm:col-span-2 text-xs font-bold text-gray-600">Tahap {t.nomor}</span>
            <div className="col-span-4 sm:col-span-3">
              <input type="number" min={0} max={100} step="0.01" value={t.persen}
                onChange={e => ubah({ tranche: sk.tranche.map((x, j) => j === i ? { ...x, persen: parseFloat(e.target.value) || 0 } : x) })}
                aria-label={`Persentase tahap ${t.nomor}`} className={inputKecil} />
            </div>
            <div className="col-span-4 sm:col-span-3">
              <input type="number" min={0} value={t.tahunKe}
                onChange={e => ubah({ tranche: sk.tranche.map((x, j) => j === i ? { ...x, tahunKe: parseInt(e.target.value) || 0 } : x) })}
                aria-label={`Tahun ke berapa untuk tahap ${t.nomor}`} className={inputKecil} />
            </div>
            <span className="col-span-1 text-[11px] text-gray-500">thn</span>
            <button type="button" onClick={() => ubah({ tranche: sk.tranche.filter((_, j) => j !== i) })}
              aria-label={`Hapus tahap ${t.nomor}`}
              className="col-span-1 text-rose-600 hover:text-rose-700 text-lg leading-none">×</button>
          </div>
        ))}
        <p className="text-[11px] text-gray-500 pt-1">Kolom kedua = persen, kolom ketiga = dicairkan pada tahun BAST + N.</p>
      </div>
    </div>
      </div>
    </Seksi>
  );
}
