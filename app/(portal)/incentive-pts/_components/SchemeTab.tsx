'use client';

import { useState, useEffect } from 'react';
import {
  SkemaInsentif, PorsiPeran, SKEMA_BAWAAN, periksaSkema, simpanSkema, ambilSkema,
  hitungPembagian, hitungManagerSebagaiPic, persenInstaller,
  riwayatSkema, labelSkema, type VersiSkema,
} from '@/lib/incentive/scheme';
import { IkonTeks } from '@/components/shared/Ikon';
import { rp, inputKecil, CONTOH, TotalPersen, Seksi, SeksiDaerahRemote, SeksiAturanPencairan } from './seksi-skema';

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

  if (!sk) return <div className="py-16 text-center text-sm text-gray-500">Memuat skema…</div>;

  const ubah = (patch: Partial<SkemaInsentif>) => setSk({ ...sk, ...patch });
  const semuaMasalah = periksaSkema(sk);
  const masalah = semuaMasalah.filter(m => !m.peringatan);
  const peringatan = semuaMasalah.filter(m => m.peringatan);
  const berubah = JSON.stringify(sk) !== awal;

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
    hitungPembagian(sk, CONTOH, remote, contohPenerima, adaSupport, spvJadiPic, 'PTS Daerah');

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="font-bold text-gray-800 text-base"><IkonTeks nama="🧮" />Skema Pembagian Insentif</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Seluruh angka pembagian diambil dari halaman ini — bukan dari kode. Mengubah porsi,
          menambah peran baru, atau menghidupkan kembali porsi PTS Daerah cukup dilakukan
          di sini; perhitungan berikutnya langsung mengikuti.
        </p>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 leading-relaxed">
          Perubahan berlaku untuk perhitungan <strong>selanjutnya</strong>. Tranche yang sudah
          diproses tidak dihitung ulang — angkanya sudah menjadi catatan pembayaran.
        </p>
      </div>

      <Seksi no="1" judul="Cakupan Proyek" warna="#0d9488"
        ket="Kategori Request Schedule mana yang dihitung sebagai proyek insentif. Namanya harus PERSIS sama dengan pilihan kategori di Request Schedule.">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Kategori yang Masuk Incentive</h3>
            <p className="text-[11px] text-gray-500">
              Hanya jadwal berstatus <strong>Done</strong> pada kategori di bawah ini yang muncul di daftar Incentive PTS.
            </p>
          </div>
          <div className="p-4 sm:p-5 space-y-2">
            {sk.kategoriProyek.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={k}
                  onChange={e => {
                    const baru = [...sk.kategoriProyek];
                    baru[i] = e.target.value;
                    ubah({ kategoriProyek: baru });
                  }}
                  placeholder="mis. Konfigurasi" aria-label={`Kategori ${i + 1}`}
                  className={inputKecil} />
                <button type="button" aria-label={`Hapus kategori ${k || i + 1}`}
                  onClick={() => ubah({ kategoriProyek: sk.kategoriProyek.filter((_, j) => j !== i) })}
                  className="text-rose-600 hover:text-rose-700 text-lg leading-none px-1">×</button>
              </div>
            ))}
            <button type="button"
              onClick={() => ubah({ kategoriProyek: [...sk.kategoriProyek, ''] })}
              className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100">
              + Tambah kategori
            </button>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-2">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>Perhatian.</strong> Menghapus sebuah kategori membuat proyek berkategori itu
                hilang dari daftar Incentive. Tahapan &amp; pembagian yang sudah terlanjur dibuat
                <strong> tidak</strong> ikut terhapus — datanya tetap ada, hanya tidak lagi tampil di daftar.
                Kembalikan kategorinya untuk memunculkannya lagi.
              </p>
            </div>
          </div>
        </div>
      </Seksi>

      <Seksi no="2" judul="Pembagian Porsi" warna="#e11d48"
        ket="Dasar seluruh perhitungan. Dua sisi dari satu keputusan: ada Support yang membantu, atau tidak ada.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Porsi Normal</h3>
            <p className="text-[11px] text-gray-500">Dipakai bila ada anggota support yang tercatat membantu.</p>
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
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500" aria-hidden="true">%</span>
              </div>
              <label className="col-span-2 flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                <input type="checkbox" checked={p.bagiRata} onChange={e => ubahPorsi(i, { bagiRata: e.target.checked })} />
                bagi rata
              </label>
              <button type="button" onClick={() => hapusPeran(i)} aria-label={`Hapus peran ${p.label}`}
                className="col-span-1 text-rose-600 hover:text-rose-700 text-lg leading-none">×</button>
            </div>
          ))}
          <p className="text-[11px] text-gray-500 pt-1">
            <strong>bagi rata</strong> = porsi dibagi rata ke semua orang yang memegang peran itu
            (mis. beberapa anggota support). Tanpa centang, porsi jatuh ke satu orang.
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Bila Tidak Ada Support yang Membantu</h3>
            <p className="text-[11px] text-gray-500">
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
        </div>
      </Seksi>

      <SeksiDaerahRemote sk={sk} ubah={ubah} pratinjau={pratinjau} />

      <SeksiAturanPencairan sk={sk} ubah={ubah} totalTranche={totalTranche} />

      <Seksi no="5" judul="Pratinjau" warna="#0891b2"
        ket="Dihitung dengan mesin yang sama seperti proses pencairan sesungguhnya.">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">Pratinjau — pool {rp(CONTOH)}</h3>
          <p className="text-[11px] text-gray-500">Dihitung dengan mesin yang sama seperti proses pencairan sesungguhnya.</p>
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
                  {!hasil.length && <p className="px-3 py-3 text-xs text-gray-500 italic">Belum ada porsi.</p>}
                </div>
                <p className={`px-3 py-2 text-xs font-bold ${pas ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                  Total {totalPct.toFixed(2).replace(/\.00$/, '')}% · {rp(total)}
                </p>
              </div>
            );
          })}
        </div>
        {persenInstaller(sk, true) > 0 && (
          <div className="px-4 sm:px-5 pb-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1.5">
                {sk.installerHanyaRemote ? 'Mode Remote (ada porsi PTS Daerah)' : 'Dengan porsi PTS Daerah'}
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
            {hitungManagerSebagaiPic(sk, CONTOH, false, 'm', 'Manager (PIC)', null, [{ peran: 'support', user_id: 's1', user_name: 'Support A' }]).map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-gray-600">{h.user_name}</span>
                <span className="font-semibold text-gray-800">{h.percentage.toFixed(2).replace(/\.00$/, '')}% · {rp(h.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </Seksi>

      <Seksi no="6" judul="Riwayat Skema" warna="#64748b"
        ket="Tiap penyimpanan membuat versi baru — versi lama tidak ditimpa.">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm"><IkonTeks nama="🕘" />Riwayat Skema</h3>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Tiap penyimpanan membuat versi baru — versi lama tidak ditimpa. Proyek yang tahapannya
            sudah dibuat tetap dibayar memakai skema yang berlaku saat itu, jadi mengubah porsi di
            sini tidak pernah mengubah proyek yang sedang berjalan.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          {riwayat.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Belum ada versi tersimpan.</p>
          ) : (
            <div className="space-y-1.5">
              {riwayat.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-700">{labelSkema(v.scheme)}</span>
                    {i === 0 && (
                      <span className="ml-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">BERLAKU</span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">
                    {new Date(v.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {v.updated_by ? ` · ${v.updated_by}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </Seksi>

      {masalah.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-bold text-rose-700 mb-1.5">
            <IkonTeks nama="⚠" />Skema belum seimbang — belum bisa disimpan:
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
          className="tombol-utama px-5 py-2 rounded-kontrol text-xs font-bold transition-all disabled:opacity-40">
          {menyimpan ? 'Menyimpan…' : berubah ? 'Simpan Skema' : 'Tersimpan'}
        </button>
      </div>
    </div>
  );
}
