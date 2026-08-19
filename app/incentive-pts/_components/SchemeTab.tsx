'use client';
// ─── Incentive PTS — Tab: Skema Pembagian ────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  SkemaInsentif, PorsiPeran, SKEMA_BAWAAN, periksaSkema, simpanSkema, ambilSkema,
  hitungPembagian, hitungManagerSebagaiPic,
} from '@/lib/incentive-scheme';

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const inputKecil = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100';

/** Contoh nominal untuk pratinjau — angka bulat supaya mudah dicocokkan manual. */
const CONTOH = 5_000_000;

export function SchemeTab({ olehNama, notify }: {
  olehNama: string;
  notify: (type: 'success' | 'error', msg: string) => void;
}) {
  const [sk, setSk] = useState<SkemaInsentif | null>(null);
  const [awal, setAwal] = useState<string>('');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => { ambilSkema().then(x => { setSk(x); setAwal(JSON.stringify(x)); }); }, []);

  if (!sk) return <div className="py-16 text-center text-sm text-gray-400">Memuat skema…</div>;

  const ubah = (patch: Partial<SkemaInsentif>) => setSk({ ...sk, ...patch });
  const masalah = periksaSkema(sk);
  const berubah = JSON.stringify(sk) !== awal;

  const ubahPorsi = (i: number, patch: Partial<PorsiPeran>) =>
    ubah({ porsi: sk.porsi.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const tambahPeran = () =>
    ubah({ porsi: [...sk.porsi, { peran: '', label: 'Peran Baru', persen: 0, bagiRata: true }] });

  const hapusPeran = (i: number) => {
    const dibuang = sk.porsi[i].peran;
    const sisaTanpa = { ...sk.tanpaSupport };
    delete sisaTanpa[dibuang];
    ubah({ porsi: sk.porsi.filter((_, j) => j !== i), tanpaSupport: sisaTanpa });
  };

  const simpan = async () => {
    setMenyimpan(true);
    const { error } = await simpanSkema(sk, olehNama);
    setMenyimpan(false);
    if (error) { notify('error', error); return; }
    setAwal(JSON.stringify(sk));
    notify('success', 'Skema pembagian tersimpan. Perhitungan berikutnya memakai angka ini.');
  };

  // ── Pratinjau: memakai mesin hitung yang SAMA dengan proses sebenarnya ─────
  // Kalau pratinjau memakai rumusnya sendiri, ia bisa menampilkan angka yang
  // tidak pernah terjadi saat batch dijalankan — persis jenis selisih yang
  // paling sulit ditelusuri belakangan.
  const contohPenerima = [
    { peran: 'pic', user_id: '1', user_name: 'PIC' },
    ...sk.porsi.filter(p => p.peran === 'support').flatMap(() => [
      { peran: 'support', user_id: '2', user_name: 'Support A' },
      { peran: 'support', user_id: '3', user_name: 'Support B' },
    ]),
    ...sk.porsi.filter(p => !['pic', 'support', 'installer'].includes(p.peran))
      .map((p, i) => ({ peran: p.peran, user_id: `x${i}`, user_name: p.label })),
  ];
  const pratinjau = (remote: boolean, adaSupport: boolean, spvJadiPic: boolean) =>
    hitungPembagian(sk, CONTOH, remote, contohPenerima, adaSupport, spvJadiPic, 'Installer Cabang');

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Kepala ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="font-bold text-gray-800 text-base">🧮 Skema Pembagian Insentif</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Seluruh angka pembagian diambil dari halaman ini — bukan dari kode. Mengubah porsi,
          menambah peran baru, atau menghidupkan kembali porsi Installer Cabang cukup dilakukan
          di sini; perhitungan berikutnya langsung mengikuti.
        </p>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 leading-relaxed">
          Perubahan berlaku untuk perhitungan <strong>selanjutnya</strong>. Tranche yang sudah
          diproses tidak dihitung ulang — angkanya sudah menjadi catatan pembayaran.
        </p>
      </div>

      {/* ── Porsi normal ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Porsi Normal</h3>
            <p className="text-[11px] text-gray-400">Dipakai bila ada anggota support yang tercatat membantu.</p>
          </div>
          <button type="button" onClick={tambahPeran}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 transition-all">
            + Tambah Peran
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-2">
          {sk.porsi.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input value={p.label} onChange={e => ubahPorsi(i, { label: e.target.value })}
                aria-label={`Nama peran baris ${i + 1}`} placeholder="Nama peran"
                className={`${inputKecil} col-span-12 sm:col-span-4`} />
              <input value={p.peran} onChange={e => ubahPorsi(i, { peran: e.target.value.trim().toLowerCase() })}
                aria-label={`Kunci peran baris ${i + 1}`} placeholder="kunci (pic/support/…)"
                className={`${inputKecil} col-span-5 sm:col-span-3 font-mono text-xs`} />
              <div className="col-span-4 sm:col-span-2 relative">
                <input type="number" min={0} max={100} step="0.01" value={p.persen}
                  onChange={e => ubahPorsi(i, { persen: parseFloat(e.target.value) || 0 })}
                  aria-label={`Persentase ${p.label}`} className={`${inputKecil} pr-6`} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400" aria-hidden="true">%</span>
              </div>
              <label className="col-span-2 flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                <input type="checkbox" checked={p.bagiRata} onChange={e => ubahPorsi(i, { bagiRata: e.target.checked })} />
                bagi rata
              </label>
              <button type="button" onClick={() => hapusPeran(i)} aria-label={`Hapus peran ${p.label}`}
                className="col-span-1 text-rose-400 hover:text-rose-600 text-lg leading-none">×</button>
            </div>
          ))}
          <p className="text-[11px] text-gray-400 pt-1">
            <strong>bagi rata</strong> = porsi dibagi rata ke semua orang yang memegang peran itu
            (mis. beberapa anggota support). Tanpa centang, porsi jatuh ke satu orang.
          </p>
        </div>
      </div>

      {/* ── Tanpa support ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">Bila Tidak Ada Support yang Membantu</h3>
          <p className="text-[11px] text-gray-400">
            Porsi pengganti saat tidak ada anggota support tercatat dalam jendela penilaian.
          </p>
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sk.porsi.map(p => (
            <div key={p.peran}>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">{p.label}</label>
              <input type="number" min={0} max={100} step="0.01"
                value={sk.tanpaSupport[p.peran] ?? 0}
                onChange={e => ubah({ tanpaSupport: { ...sk.tanpaSupport, [p.peran]: parseFloat(e.target.value) || 0 } })}
                aria-label={`Porsi ${p.label} tanpa support`} className={inputKecil} />
            </div>
          ))}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
              Jendela penilaian support (bulan sejak BAST)
            </label>
            <input type="number" min={0} value={sk.jendelaSupportBulan}
              onChange={e => ubah({ jendelaSupportBulan: parseInt(e.target.value) || 0 })}
              aria-label="Jendela penilaian support dalam bulan"
              className={`${inputKecil} sm:max-w-[200px]`} />
          </div>
        </div>
      </div>

      {/* ── Aturan khusus ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">Aturan Khusus</h3>
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
              Supervisor merangkap PIC → porsinya dialihkan ke
            </label>
            <select value={sk.hangusSupervisorKe} onChange={e => ubah({ hangusSupervisorKe: e.target.value })}
              aria-label="Tujuan porsi Supervisor yang hangus" className={inputKecil}>
              <option value="">— hangus, tanpa penerima —</option>
              {sk.porsi.filter(p => p.peran !== 'supervisor').map(p => (
                <option key={p.peran} value={p.peran}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
              Manager sebagai PIC — porsi PIC (%)
            </label>
            <input type="number" min={0} max={100} value={sk.managerSebagaiPic.pic ?? 100}
              onChange={e => ubah({ managerSebagaiPic: { pic: parseFloat(e.target.value) || 0 } })}
              aria-label="Porsi Manager sebagai PIC" className={inputKecil} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
              Porsi Installer Cabang saat REMOTE (%)
            </label>
            <input type="number" min={0} max={99} step="0.01" value={sk.installerRemotePersen}
              onChange={e => ubah({ installerRemotePersen: parseFloat(e.target.value) || 0 })}
              aria-label="Porsi Installer Cabang saat remote" className={inputKecil} />
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Isi <strong>0</strong> bila Installer tidak mendapat insentif. Nama & daerah Installer
              tetap dicatat dari Request Schedule apa pun angkanya — pencatatan itu tidak
              bergantung pada porsi.
            </p>
          </div>
          <div className="flex items-start pt-5">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={sk.installerBayarDiMuka}
                onChange={e => ubah({ installerBayarDiMuka: e.target.checked })} />
              Installer dibayar penuh di muka (tidak ikut tahapan)
            </label>
          </div>
        </div>
      </div>

      {/* ── Tahapan pencairan ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-gray-800 text-sm">Tahapan Pencairan Tim PTS</h3>
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
              <span className="col-span-1 text-[11px] text-gray-400">thn</span>
              <button type="button" onClick={() => ubah({ tranche: sk.tranche.filter((_, j) => j !== i) })}
                aria-label={`Hapus tahap ${t.nomor}`}
                className="col-span-1 text-rose-400 hover:text-rose-600 text-lg leading-none">×</button>
            </div>
          ))}
          <p className="text-[11px] text-gray-400 pt-1">Kolom kedua = persen, kolom ketiga = dicairkan pada tahun BAST + N.</p>
        </div>
      </div>

      {/* ── Pratinjau ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">Pratinjau — pool {rp(CONTOH)}</h3>
          <p className="text-[11px] text-gray-400">Dihitung dengan mesin yang sama seperti proses pencairan sesungguhnya.</p>
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {([
            ['Ada support (2 orang)', pratinjau(false, true, false)],
            ['Tanpa support aktif',   pratinjau(false, false, false)],
            ['Supervisor jadi PIC',   pratinjau(false, true, true)],
          ] as const).map(([judul, hasil]) => {
            const total = hasil.reduce((n, h) => n + h.amount, 0);
            const totalPct = hasil.reduce((n, h) => n + h.percentage, 0);
            const pas = Math.abs(total - CONTOH) <= 2;
            return (
              <div key={judul} className="rounded-xl border border-gray-100 overflow-hidden">
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50">{judul}</p>
                <div className="divide-y divide-gray-50">
                  {hasil.map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                      <span className="text-gray-600 truncate">{h.user_name}</span>
                      <span className="text-gray-800 font-semibold whitespace-nowrap">
                        {h.percentage.toFixed(2).replace(/\.00$/, '')}% · {rp(h.amount)}
                      </span>
                    </div>
                  ))}
                  {!hasil.length && <p className="px-3 py-3 text-xs text-gray-400 italic">Belum ada porsi.</p>}
                </div>
                <p className={`px-3 py-2 text-xs font-bold ${pas ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                  Total {totalPct.toFixed(2).replace(/\.00$/, '')}% · {rp(total)}
                </p>
              </div>
            );
          })}
        </div>
        {sk.installerRemotePersen > 0 && (
          <div className="px-4 sm:px-5 pb-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1.5">Mode Remote (ada porsi Installer)</p>
              {pratinjau(true, true, false).map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-amber-900/80">{h.user_name}</span>
                  <span className="font-semibold text-amber-900">{h.percentage.toFixed(2).replace(/\.00$/, '')}% · {rp(h.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="px-4 sm:px-5 pb-5">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Manager sebagai PIC</p>
            {hitungManagerSebagaiPic(sk, CONTOH, false, 'm', 'Manager (PIC)').map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-gray-600">{h.user_name}</span>
                <span className="font-semibold text-gray-800">{h.percentage.toFixed(2).replace(/\.00$/, '')}% · {rp(h.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Simpan ── */}
      {masalah.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-bold text-rose-700 mb-1.5">Skema belum bisa disimpan:</p>
          <ul className="text-xs text-rose-600 space-y-0.5 list-disc pl-4">
            {masalah.map((m, i) => <li key={i}>{m.pesan}</li>)}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 justify-end pb-6">
        <button type="button" onClick={() => setSk(SKEMA_BAWAAN)}
          className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
          Kembalikan ke bawaan
        </button>
        <button type="button" onClick={simpan} disabled={menyimpan || !!masalah.length || !berubah}
          className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#e11d48,#9f1239)', boxShadow: '0 4px 14px rgba(225,29,72,0.35)' }}>
          {menyimpan ? 'Menyimpan…' : berubah ? 'Simpan Skema' : 'Tersimpan'}
        </button>
      </div>
    </div>
  );
}
