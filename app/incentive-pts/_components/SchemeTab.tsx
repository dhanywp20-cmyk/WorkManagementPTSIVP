'use client';
// Incentive PTS - Tab: Skema Pembagian

import { useState, useEffect } from 'react';
import {
  SkemaInsentif, PorsiPeran, SKEMA_BAWAAN, periksaSkema, simpanSkema, ambilSkema,
  hitungPembagian, hitungManagerSebagaiPic, persenInstaller,
  riwayatSkema, labelSkema, hitungPool, type VersiSkema, type TarifKelayakan,
} from '@/lib/incentive-scheme';

const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const inputKecil = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100';

/** Contoh nominal untuk pratinjau - angka bulat supaya mudah dicocokkan manual. */
const CONTOH = 5_000_000;

/**
 * Penunjuk total persen yang hidup saat angkanya diketik.
 *
 * Kotak merah di bawah halaman sudah menahan skema yang tidak berjumlah 100
 * agar tidak tersimpan, tapi ia baru terbaca setelah orangnya menggulir ke
 * bawah - dan ia tidak menyebutkan bagian MANA yang berat sebelah. Lencana ini
 * duduk tepat di judul tiap bagian dan menyebutkan selisihnya, jadi
 * ketidakseimbangan terlihat pada ketikan yang membuatnya, bukan di ujung
 * halaman beberapa gulir kemudian.
 */
function TotalPersen({ nilai }: { nilai: number }) {
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

export function SchemeTab({ olehNama, notify }: {
  olehNama: string;
  notify: (type: 'success' | 'error', msg: string) => void;
}) {
  const [sk, setSk] = useState<SkemaInsentif | null>(null);
  const [awal, setAwal] = useState<string>('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [riwayat, setRiwayat] = useState<VersiSkema[]>([]);

  const muatRiwayat = () => riwayatSkema(10).then(setRiwayat);
  useEffect(() => { ambilSkema().then(x => { setSk(x); setAwal(JSON.stringify(x)); }); muatRiwayat(); }, []);

  if (!sk) return <div className="py-16 text-center text-sm text-gray-400">Memuat skema…</div>;

  const ubah = (patch: Partial<SkemaInsentif>) => setSk({ ...sk, ...patch });
  //  Galat MENAHAN penyimpanan; peringatan hanya memberi tahu. Dipisah supaya
  //  tombol Simpan tidak terkunci oleh hal yang perhitungannya sebenarnya benar.
  const semuaMasalah = periksaSkema(sk);
  const masalah = semuaMasalah.filter(m => !m.peringatan);
  const peringatan = semuaMasalah.filter(m => m.peringatan);
  const berubah = JSON.stringify(sk) !== awal;

  //  Dihitung dari state yang sedang disunting, bukan dari yang tersimpan -
  //  itu memang gunanya: angkanya bergerak seiring ketikan.
  const totalPorsi = sk.porsi.reduce((t, p) => t + (p.persen || 0), 0);
  const totalTanpaSupport = Object.values(sk.tanpaSupport).reduce((t, n) => t + (n || 0), 0);
  const totalTranche = sk.tranche.reduce((t, x) => t + (x.persen || 0), 0);

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
    await muatRiwayat();
    notify('success', 'Skema tersimpan sebagai versi baru. Proyek yang tahapannya sudah dibuat tetap memakai skema lamanya.');
  };

  // Pratinjau: memakai mesin hitung yang SAMA dengan proses sebenarnya
  // Kalau pratinjau memakai rumusnya sendiri, ia bisa menampilkan angka yang
  // tidak pernah terjadi saat batch dijalankan - persis jenis selisih yang
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
    <div className="space-y-3">
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

      {/*
        DUA KOLOM untuk bagian pengaturan.
        Isinya kolom-kolom sempit (nama peran, kunci, satu angka persen), jadi
        satu bagian per baris selebar layar menyisakan separuh kanan kosong di
        hampir setiap baris. Bagian yang isinya memang melebar - Tahapan
        Pencairan dan Pratinjau - mengambil dua kolom lewat col-span, sehingga
        tidak ada slot menggantung.
      */}
      <div className="grid grid-flow-row-dense grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 items-start">

      {/* ── Porsi normal ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Porsi Normal</h3>
            <p className="text-[11px] text-gray-400">Dipakai bila ada anggota support yang tercatat membantu.</p>
          </div>
          <TotalPersen nilai={totalPorsi} />
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
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Bila Tidak Ada Support yang Membantu</h3>
            <p className="text-[11px] text-gray-400">
              Porsi pengganti saat tidak ada anggota support tercatat dalam jendela penilaian.
            </p>
          </div>
          <TotalPersen nilai={totalTanpaSupport} />
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
          {/*
            Isian "Jendela penilaian support (bulan)" DIHAPUS dari sini.

            Jendelanya kini mengikuti jadwal Tahapan Pencairan di bawah: Support
            dinilai ulang tiap tahun pencairan, jadi tahun ke-2 memakai rentang
            tahun ke-2, dan seterusnya. Angkanya sudah ditentukan tahapan, jadi
            isian ini tidak lagi berpengaruh pada apa pun.

            Dihapus, bukan dibiarkan: kotak isian yang tidak menyambung ke mana
            pun lebih berbahaya daripada tidak ada - admin akan mengubahnya,
            tidak terjadi apa-apa, dan tidak ada yang menjelaskan kenapa.
          */}
          <div className="sm:col-span-3 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
            <p className="text-[11px] text-sky-800 leading-relaxed">
              <strong>Support dinilai per tahun pencairan.</strong> Yang menangani ticket
              Troubleshooting pada tahun berjalan ikut dibagi pada pencairan tahun itu — tahun
              berikutnya dinilai ulang, dan yang menangani boleh orang yang sama atau berbeda.
              Bila suatu tahun tidak ada Troubleshooting sama sekali, porsi Support tahun itu
              memakai angka <strong>tanpa support</strong> di atas. Rentang tiap tahun mengikuti
              Tahapan Pencairan di bawah.
            </p>
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
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                Manager sebagai PIC — porsi PIC (%)
              </label>
              <TotalPersen nilai={Object.values(sk.managerSebagaiPic).reduce((t, n) => t + (n || 0), 0)} />
            </div>
            <input type="number" min={0} max={100} value={sk.managerSebagaiPic.pic ?? 100}
              onChange={e => ubah({ managerSebagaiPic: { pic: parseFloat(e.target.value) || 0 } })}
              aria-label="Porsi Manager sebagai PIC" className={inputKecil} />
          </div>
        </div>
      </div>

      {/* ── Installer Cabang ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">🔧 Pembagian untuk Installer</h3>
            <p className="text-[11px] text-gray-400">Porsinya dipotong dari pool lebih dulu; sisanya dibagi ke Tim PTS.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={sk.installerAktif}
              onChange={e => ubah({ installerAktif: e.target.checked })}
              aria-label="Installer ikut mendapat pembagian" />
            Installer ikut dapat bagian
          </label>
        </div>

        {!sk.installerAktif ? (
          <p className="px-4 sm:px-5 py-4 text-xs text-gray-400 leading-relaxed">
            Installer <strong>tidak</strong> mendapat porsi insentif. Nama & daerahnya tetap dicatat
            dari Request Schedule — pencatatan rekam jejak tidak bergantung pada pembagian uang.
          </p>
        ) : (
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                Porsi Installer (%)
              </label>
              <input type="number" min={0} max={99} step="0.01" value={sk.installerRemotePersen}
                onChange={e => ubah({ installerRemotePersen: parseFloat(e.target.value) || 0 })}
                aria-label="Porsi Installer" className={inputKecil} />
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                Sisa <strong>{(100 - (sk.installerRemotePersen || 0)).toFixed(2).replace(/\.00$/, '')}%</strong> dibagi
                ke Tim PTS menurut Porsi Normal di atas. Totalnya tetap 100% berapa pun angka ini.
              </p>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={sk.installerBayarDiMuka}
                  onChange={e => ubah({ installerBayarDiMuka: e.target.checked })} />
                <span>
                  <strong>Dibayar penuh di tahun pertama.</strong> Porsi Installer tidak ikut dipecah
                  ke tahapan bertahun-tahun seperti Tim PTS.
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={sk.installerHanyaRemote}
                  onChange={e => ubah({ installerHanyaRemote: e.target.checked })} />
                <span>
                  <strong>Hanya proyek REMOTE.</strong> Lepas centang ini bila Installer berhak atas
                  porsinya pada proyek mana pun, termasuk onsite.
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── Tahapan pencairan ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
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
      <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl border border-gray-200 bg-white overflow-hidden">
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
        {/*
          Syaratnya persenInstaller(), bukan installerRemotePersen > 0. Angkanya
          bisa tersimpan > 0 sementara saklarnya dimatikan - dan pratinjau yang
          memperlihatkan porsi Installer padahal hitungannya memberi nol persis
          jenis selisih yang membuat orang percaya pada angka yang salah.
        */}
        {persenInstaller(sk, true) > 0 && (
          <div className="px-4 sm:px-5 pb-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1.5">
                {sk.installerHanyaRemote ? 'Mode Remote (ada porsi Installer)' : 'Dengan porsi Installer'}
              </p>
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

      {/*
        Pola pembagian saat Installer aktif.

        Angka-angka ini TIDAK bisa disunting sendiri, dan itu disengaja. Ia
        diturunkan dari Porsi Normal / Tanpa Support di atas dikali (100 -
        porsi Installer)%. Kalau dijadikan isian tersendiri, akan ada EMPAT
        tabel yang masing-masing harus dijaga berjumlah 100% - dan begitu
        salah satunya diubah tanpa yang lain, platform membayar angka yang
        tidak sama dengan dokumen tanpa ada yang memberi tahu.

        Jadi yang bisa diatur tetap satu tempat (porsi dasar + porsi
        Installer), sementara panel ini memperlihatkan hasilnya supaya tidak
        perlu dihitung di kepala. Dihitung dengan mesin yang SAMA dengan
        proses pencairan sesungguhnya.
      */}
      {persenInstaller(sk, true) > 0 && (
        <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl border border-blue-200 bg-blue-50/40 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-blue-100 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
            <h3 className="font-bold text-gray-800 text-sm">🔧 Pola Pembagian saat Installer Aktif</h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Porsi Installer <strong>{persenInstaller(sk, true)}%</strong> dipotong dari pool lebih dulu;
              sisa <strong>{(100 - persenInstaller(sk, true)).toFixed(2).replace(/\.00$/, '')}%</strong> dibagi
              ke Tim PTS menurut porsi di atas. Angka di bawah dihitung otomatis — ubah porsi dasarnya
              dan ini ikut berubah.
            </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer flex-shrink-0">
              <input type="checkbox" checked={sk.porsiRemote.aktif}
                onChange={e => ubah({ porsiRemote: { ...sk.porsiRemote, aktif: e.target.checked } })}
                aria-label="Atur porsi Remote sendiri" />
              Atur sendiri
            </label>
          </div>
          {sk.porsiRemote.aktif ? (
            /*
              DIATUR SENDIRI. Angkanya dipakai apa adanya oleh mesin hitung -
              tidak dikali apa pun. Baris Installer ikut di dalam tabel supaya
              yang terbaca admin adalah pembagian utuh yang berjumlah 100%,
              bukan angka yang masih harus dikalikan sendiri di kepala.
            */
            <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                ['adaSupport', 'Ada Support PTS di tahun itu'],
                ['tanpaSupport', 'TIDAK ada Support PTS di tahun itu'],
              ] as const).map(([kunciPeta, judul]) => {
                const peta = sk.porsiRemote[kunciPeta];
                const total = Object.values(peta).reduce((t, n) => t + (n || 0), 0);
                const barisPeran = [...sk.porsi.map(p => ({ k: p.peran, l: p.label })), { k: 'installer', l: '🔧 Installer' }];
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
                          <div className="relative w-24 flex-shrink-0">
                            <input type="number" min={0} max={100} step="0.01" value={peta[b.k] ?? 0}
                              onChange={e => ubah({ porsiRemote: { ...sk.porsiRemote,
                                [kunciPeta]: { ...peta, [b.k]: parseFloat(e.target.value) || 0 } } })}
                              aria-label={`Porsi Remote ${b.l} (${judul})`} className={`${inputKecil} pr-6`} />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400" aria-hidden="true">%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="md:col-span-2 text-[11px] text-gray-500 leading-relaxed">
                Angka ini dipakai <strong>apa adanya</strong> — tidak dikali apa pun, dan porsi Installer
                diambil dari baris di tabel ini, bukan dari kolom &quot;Porsi Installer&quot; di atas.
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
                    {!hasil.length && <p className="px-3 py-3 text-xs text-gray-400 italic">Belum ada porsi.</p>}
                  </div>
                  <p className={`px-3 py-1.5 text-xs font-bold ${pas ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                    Total {totalPct.toFixed(2).replace(/\.00$/, '')}%
                  </p>
                  <p className="px-3 py-2 text-[10px] text-gray-400 leading-relaxed border-t border-gray-50">{ket}</p>
                </div>
              );
            })}
          </div>
          )}
          <p className="px-4 sm:px-5 pb-4 text-[11px] text-gray-500 leading-relaxed">
            Contoh nominal memakai pool {rp(CONTOH)}. Installer dibayar
            {sk.installerBayarDiMuka ? ' penuh di tahun pertama' : ' mengikuti tahapan seperti Tim PTS'};
            porsi Tim PTS tetap dipecah ke Tahapan Pencairan.
          </p>
        </div>
      )}

      {/* ── Tarif kelayakan ── */}
      <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">📐 Tarif Kelayakan Proyek</h3>
            <p className="text-[11px] text-gray-400">
              Menentukan BESAR pool, bukan pembagiannya. Dipakai saat mengisi nominal proyek.
            </p>
          </div>
          <button type="button"
            onClick={() => ubah({ tarif: [...sk.tarif, { kunci: '', label: 'Kategori Baru', jenis: 'persen', nilai: 0, basis: 'HPP Proyek' }] })}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 transition-all">
            + Tambah Kategori
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-2">
          {sk.tarif.map((t, i) => {
            const ubahTarif = (patch: Partial<TarifKelayakan>) =>
              ubah({ tarif: sk.tarif.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={t.label} onChange={e => ubahTarif({ label: e.target.value })}
                  aria-label={`Nama kategori ${i + 1}`} placeholder="Nama kategori"
                  className={`${inputKecil} col-span-12 sm:col-span-4`} />
                <input value={t.kunci} onChange={e => ubahTarif({ kunci: e.target.value.trim().toLowerCase().replace(/\s+/g, '_') })}
                  aria-label={`Kunci kategori ${i + 1}`} placeholder="kunci"
                  className={`${inputKecil} col-span-5 sm:col-span-2 font-mono text-xs`} />
                <select value={t.jenis} onChange={e => ubahTarif({ jenis: e.target.value as TarifKelayakan['jenis'] })}
                  aria-label={`Jenis tarif ${i + 1}`} className={`${inputKecil} col-span-4 sm:col-span-2`}>
                  <option value="persen">% dari dasar</option>
                  <option value="flat">Flat (Rp)</option>
                  <option value="tidak">Tidak berhak</option>
                </select>
                <input type="number" min={0} step="0.01" value={t.nilai} disabled={t.jenis === 'tidak'}
                  onChange={e => ubahTarif({ nilai: parseFloat(e.target.value) || 0 })}
                  aria-label={`Nilai tarif ${i + 1}`}
                  className={`${inputKecil} col-span-3 sm:col-span-2 disabled:bg-gray-50 disabled:text-gray-300`} />
                <input value={t.basis} onChange={e => ubahTarif({ basis: e.target.value })}
                  aria-label={`Basis hitung ${i + 1}`} placeholder="HPP Proyek"
                  className={`${inputKecil} col-span-11 sm:col-span-1 text-xs`} />
                <button type="button" onClick={() => ubah({ tarif: sk.tarif.filter((_, j) => j !== i) })}
                  aria-label={`Hapus kategori ${t.label}`}
                  className="col-span-1 text-rose-400 hover:text-rose-600 text-lg leading-none">×</button>
              </div>
            );
          })}
          {/*
            Contoh nominal dicetak dari rumus yang SAMA dengan yang dipakai
            layar Input Nominal. Kalau di sini memakai rumusnya sendiri, ia
            bisa menampilkan angka yang tidak pernah benar-benar tersimpan.
          */}
          <p className="text-[11px] text-gray-400 pt-1 leading-relaxed">
            Contoh dasar Rp 500.000.000 → {sk.tarif.filter(t => t.jenis !== 'tidak').slice(0, 4)
              .map(t => `${t.label.split(' ')[0]} ${rp(hitungPool(t, 500_000_000))}`).join(' · ')}
          </p>
        </div>
      </div>

      {/* ── Riwayat versi skema ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">🕘 Riwayat Skema</h3>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Tiap penyimpanan membuat versi baru — versi lama tidak ditimpa. Proyek yang tahapannya
            sudah dibuat tetap dibayar memakai skema yang berlaku saat itu, jadi mengubah porsi di
            sini tidak pernah mengubah proyek yang sedang berjalan.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          {riwayat.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Belum ada versi tersimpan.</p>
          ) : (
            <div className="space-y-1.5">
              {riwayat.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-700">{labelSkema(v.scheme)}</span>
                    {i === 0 && (
                      <span className="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">BERLAKU</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(v.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {v.updated_by ? ` · ${v.updated_by}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      </div>

      {/* ── Simpan ── */}
      {masalah.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-bold text-rose-700 mb-1.5">
            ⚠️ Skema belum seimbang — belum bisa disimpan:
          </p>
          <ul className="text-xs text-rose-600 space-y-0.5 list-disc pl-4">
            {masalah.map((m, i) => <li key={i}>{m.pesan}</li>)}
          </ul>
        </div>
      )}
      {peringatan.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-800 mb-1.5">
            Boleh disimpan, tapi perlu Anda ketahui:
          </p>
          <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4 leading-relaxed">
            {peringatan.map((m, i) => <li key={i}>{m.pesan}</li>)}
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
