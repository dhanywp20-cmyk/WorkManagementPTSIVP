'use client';
// Incentive PTS - Tab: Skema Pembagian

import { useState, useEffect } from 'react';
import {
  SkemaInsentif, PorsiPeran, SKEMA_BAWAAN, periksaSkema, simpanSkema, ambilSkema,
  hitungPembagian, hitungManagerSebagaiPic, persenInstaller,
  riwayatSkema, labelSkema, type VersiSkema,
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

/**
 * Satu seksi bernomor dengan garis aksen di kiri judulnya.
 *
 * Gunanya jenjang: tanpa ini seluruh halaman berupa kartu putih seragam, dan
 * mata tidak punya petunjuk mana yang pokok dan mana yang pelengkap. Nomor
 * urut juga membuat halamannya bisa dirujuk lisan ("lihat seksi 2") - berguna
 * saat menjelaskan skema ke Finance lewat telepon.
 */
function Seksi({ no, judul, ket, warna, children }: {
  no: string; judul: string; ket: string; warna: string; children: React.ReactNode;
}) {
  return (
    // bg-slate-100 SOLID, bukan /70. Halaman ini berlatar foto gedung; latar
    // tembus pandang membuat teks keterangan duduk langsung di atas foto, dan
    // rasio kontras di atas foto tidak bisa dijamin berapa pun warna teksnya.
    <section className="rounded-2xl bg-slate-100 border border-slate-200 p-3 sm:p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-lg text-white text-[11px] font-black flex items-center justify-center mt-0.5"
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
    hitungPembagian(sk, CONTOH, remote, contohPenerima, adaSupport, spvJadiPic, 'PTS Daerah');

  return (
    <div className="space-y-3">
      {/* ── Kepala ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="font-bold text-gray-800 text-base">🧮 Skema Pembagian Insentif</h2>
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


      {/*
        TATA LETAK BERSEKSI, bukan sembilan kartu mengambang dalam satu grid.

        Bentuk lama menaruh semuanya sebagai kartu putih seragam di satu grid
        rapat. Akibatnya tidak ada jenjang sama sekali: "Porsi Normal" terlihat
        sama pentingnya dengan "Riwayat Skema", dan hal-hal yang saling
        bergantung - setelan Installer dengan akibatnya pada porsi Remote -
        terpisah jauh oleh kartu yang tidak berhubungan.

        Sekarang tiap seksi punya judul dengan garis aksen dan keterangan
        singkat, lalu kartunya duduk DI DALAM seksi itu. Yang berpasangan
        diletakkan berdampingan dengan items-stretch supaya tingginya sama -
        itu yang membuat barisannya rata, bukan kebetulan panjang isinya.
      */}

      {/*
        SEKSI 1 - CAKUPAN. Ditaruh paling atas karena ia menjawab pertanyaan
        yang mendahului semua angka di bawahnya: proyek mana yang masuk hitungan
        sama sekali. Dulu jawabannya dipaku di kode (INCENTIVE_CATEGORIES),
        sehingga menambah satu jenis layanan berarti mengubah kode lalu deploy
        ulang - tidak bisa dipakai perusahaan yang menamai layanannya sendiri.
      */}
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
                  className="text-rose-400 hover:text-rose-600 text-lg leading-none px-1">×</button>
              </div>
            ))}
            <button type="button"
              onClick={() => ubah({ kategoriProyek: [...sk.kategoriProyek, ''] })}
              className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-100">
              + Tambah kategori
            </button>
            {/*
              Peringatan, bukan pencegahan. Mengubah kategori TIDAK menyentuh
              proyek yang tahapannya sudah dibuat - itu memang disengaja - tapi
              orang yang menghapus satu kategori berhak tahu bahwa daftar
              proyeknya akan menyusut sebelum ia menyimpan.
            */}
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
      {/* ── Porsi normal ── */}
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
                className="col-span-1 text-rose-400 hover:text-rose-600 text-lg leading-none">×</button>
            </div>
          ))}
          <p className="text-[11px] text-gray-500 pt-1">
            <strong>bagi rata</strong> = porsi dibagi rata ke semua orang yang memegang peran itu
            (mis. beberapa anggota support). Tanpa centang, porsi jatuh ke satu orang.
          </p>
        </div>
      </div>
      {/* ── Tanpa support ── */}
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
        </div>
      </Seksi>

      <Seksi no="3" judul="PTS Daerah &amp; Mode Remote" warna="#2563eb"
        ket="Dinaikkan ke sini karena porsi Remote adalah AKIBAT langsung dari setelan PTS Daerah — keduanya harus terbaca bersamaan.">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,22rem)_1fr] gap-3 items-stretch">
      {/* ── PTS Daerah ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">🔧 Pembagian untuk PTS Daerah</h3>
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
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                Porsi PTS Daerah (%)
              </label>
              <input type="number" min={0} max={99} step="0.01" value={sk.installerRemotePersen}
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
      {/*
        Pola pembagian saat PTS Daerah aktif.

        Angka-angka ini TIDAK bisa disunting sendiri, dan itu disengaja. Ia
        diturunkan dari Porsi Normal / Tanpa Support di atas dikali (100 -
        porsi PTS Daerah)%. Kalau dijadikan isian tersendiri, akan ada EMPAT
        tabel yang masing-masing harus dijaga berjumlah 100% - dan begitu
        salah satunya diubah tanpa yang lain, platform membayar angka yang
        tidak sama dengan dokumen tanpa ada yang memberi tahu.

        Jadi yang bisa diatur tetap satu tempat (porsi dasar + porsi
        PTS Daerah), sementara panel ini memperlihatkan hasilnya supaya tidak
        perlu dihitung di kepala. Dihitung dengan mesin yang SAMA dengan
        proses pencairan sesungguhnya.
      */}
      {persenInstaller(sk, true) > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden h-full flex flex-col">
          <div className="px-4 sm:px-5 py-3 border-b border-blue-100 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
            <h3 className="font-bold text-gray-800 text-sm">🔧 Pola Pembagian saat PTS Daerah Aktif</h3>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Porsi PTS Daerah <strong>{persenInstaller(sk, true)}%</strong> dipotong dari pool lebih dulu;
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
                          <div className="relative w-24 flex-shrink-0">
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
                  <p className={`px-3 py-1.5 text-xs font-bold ${pas ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                    Total {totalPct.toFixed(2).replace(/\.00$/, '')}%
                  </p>
                  <p className="px-3 py-2 text-[10px] text-gray-500 leading-relaxed border-t border-gray-50">{ket}</p>
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

      <Seksi no="4" judul="Aturan Khusus &amp; Pencairan" warna="#7c3aed"
        ket="Perkecualian saat peran merangkap, dan jadwal pencairannya.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
      {/* ── Aturan khusus ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">Aturan Khusus</h3>
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-1">
              Supervisor merangkap PIC → porsi koordinasinya dialihkan ke
            </label>
            <select value={sk.hangusSupervisorKe} onChange={e => ubah({ hangusSupervisorKe: e.target.value })}
              aria-label="Tujuan porsi Supervisor yang hangus" className={inputKecil}>
              <option value="">— hangus, tanpa penerima —</option>
              {sk.porsi.filter(p => p.peran !== 'supervisor').map(p => (
                <option key={p.peran} value={p.peran}>{p.label}</option>
              ))}
            </select>
            {/*
              Akibat pilihan ini ditampilkan sebagai ANGKA, bukan dibiarkan
              dibayangkan. Aturan ini yang paling sulit dinilai benar-salahnya
              dari nama pilihannya saja: "dialihkan ke Manager" dan "dialihkan
              ke PIC" terdengar sama netral, padahal selisihnya belasan persen
              dari pool dan jatuh ke orang yang berbeda.
            */}
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
          {/*
            Manager sebagai PIC kini punya DUA keadaan, sama seperti skema
            standar. Sebelumnya cuma satu angka, jadi Manager selalu menerima
            seluruh pool - termasuk pada tahun ke-2 dan ke-3 ketika timnya yang
            mengerjakan Troubleshooting-nya, dan mereka tidak dapat apa-apa.
          */}
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
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{judul}</span>
                      <TotalPersen nilai={total} />
                    </div>
                    {[{ k: 'pic', l: 'Manager (sebagai PIC)' }, { k: 'support', l: 'Tim Support' }].map(b => (
                      <div key={b.k} className="flex items-center gap-2 mb-1.5 last:mb-0">
                        <span className="text-xs text-gray-600 flex-1 truncate">{b.l}</span>
                        <div className="relative w-20 flex-shrink-0">
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
          {/*
            Supervisor merangkap PIC PUNYA TABEL SENDIRI bila saklar ini
            dinyalakan - menanggung DUA peran sekaligus, dengan beban yang
            berbeda-beda menurut Remote/Onsite dan ada/tidaknya Support.
            Saklar mati (bawaan) = perilaku LAMA di atas ("dialihkan ke ...").
          */}
          <div className="sm:col-span-2 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                Supervisor merangkap PIC — tabel porsi tersendiri
              </span>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer flex-shrink-0">
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
                    //  Installer hanya ditawarkan pada grup Remote - onsite tidak
                    //  pernah membayar Installer (lihat installerHanyaRemote).
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
                              <div className="relative w-20 flex-shrink-0">
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
      {/* ── Tahapan pencairan ── */}
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
                className="col-span-1 text-rose-400 hover:text-rose-600 text-lg leading-none">×</button>
            </div>
          ))}
          <p className="text-[11px] text-gray-500 pt-1">Kolom kedua = persen, kolom ketiga = dicairkan pada tahun BAST + N.</p>
        </div>
      </div>
        </div>
      </Seksi>

      <Seksi no="5" judul="Pratinjau" warna="#0891b2"
        ket="Dihitung dengan mesin yang sama seperti proses pencairan sesungguhnya.">
      {/* ── Pratinjau ── */}
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
      {/* ── Riwayat versi skema ── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden h-full flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-sm">🕘 Riwayat Skema</h3>
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
                      <span className="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">BERLAKU</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
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
