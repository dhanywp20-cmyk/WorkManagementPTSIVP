'use client';
import React, { useEffect, useState } from 'react';
import {
  Kelompok, JenisKelompok, Lonceng, SEMUA_LONCENG, LABEL_LONCENG,
  KELOMPOK_BAWAAN, semuaKelompok, muatKelompok, simpanKelompok, kelompokTerpakai,
} from '@/lib/kelompok';
import { supabase } from '@/lib/supabase';
import { DEFAULT_MENU_KEYS, SALES_MENU_KEYS } from './shared';

/**
 * Bentuk nama kelompok dari apa yang diketik admin.
 *
 * Nama yang disimpan HARUS sama persis dengan isi users.team_type - itulah
 * yang dicocokkan seluruh platform - jadi awalannya dibakukan di sini supaya
 * admin cukup mengetik "SBY", bukan menghafal bentuk penuhnya.
 *
 * Awalan yang SUDAH diketik ikut dibuang lebih dulu. Tanpa itu, admin yang
 * mengetik "PTS Daerah" mendapat "Team PTS PTS Daerah" - persis yang terjadi
 * pada kelompok PTS Daerah pertama, dan label dobelnya ("PTS PTS Daerah")
 * ikut tampil di dropdown Tipe PTS pada form akun.
 */
export function namaKelompokDari(ketikan: string): string {
  const asli = ketikan.trim();
  let inti = asli;
  //  Berulang, bukan sekali: "Team PTS PTS Daerah" (nama yang terlanjur dobel)
  //  harus ikut kembali menjadi "Team PTS Daerah" kalau diketik ulang.
  let sebelum: string;
  do {
    sebelum = inti;
    inti = inti.replace(/^team\s+/i, '').replace(/^pts\s+/i, '').trim();
  } while (inti !== sebelum);
  //  Kalau seluruh ketikan habis tersaring (admin mengetik "PTS" saja),
  //  pakai ketikan aslinya - lebih baik namanya kurang rapi daripada tombol
  //  Tambah yang diam saja tanpa memberi tahu kenapa.
  const dipakai = inti || asli;
  return dipakai ? `Team PTS ${dipakai}` : '';
}

const LABEL_JENIS: Record<JenisKelompok, string> = {
  pts: 'Team PTS', services: 'Services', marketing: 'Marketing', sales: 'Sales',
};

/**
 * Bagian "Kelompok & Notifikasi" pada Admin Panel.
 *
 * Satu tabel: baris = kelompok, kolom = lonceng. Bentuk ini dipilih karena
 * pertanyaan yang biasanya muncul bukan "apa hak kelompok X" melainkan "siapa
 * saja yang dapat lonceng Review" - dan itu terbaca sekali lihat kalau
 * disusun sebagai tabel, bukan sebagai daftar kartu.
 */
export function KelompokSettingInline() {
  const [daftar, setDaftar] = useState<Kelompok[]>([]);
  const [terpakai, setTerpakai] = useState<Record<string, number>>({});
  const [namaBaru, setNamaBaru] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null);
  const [siap, setSiap] = useState(false);
  const [menerapkan, setMenerapkan] = useState<string | null>(null);
  /**
   * Nilai "Tampilan Dashboard" saat halaman dimuat / terakhir diterapkan.
   *
   * Dipakai untuk tahu kelompok mana yang setelannya BARU diubah tapi akun
   * lamanya belum disamakan - tanpa penanda ini, admin mengubah dropdown,
   * menekan Simpan, lalu heran kenapa akun yang sudah ada tidak berubah.
   * Persis yang terjadi pada kelompok PTS Daerah.
   */
  const [dashboardTerpakai, setDashboardTerpakai] = useState<Record<string, 'team' | 'sales'>>({});

  const beritahu = (jenis: 'ok' | 'gagal', teks: string) => {
    setKabar({ jenis, teks });
    setTimeout(() => setKabar(null), 5000);
  };

  useEffect(() => {
    void muatKelompok().then(() => {
      const k = semuaKelompok();
      setDaftar(k);
      setDashboardTerpakai(Object.fromEntries(k.map(x => [x.nama, x.dashboard])));
      setSiap(true);
    });
    void kelompokTerpakai().then(setTerpakai);
  }, []);

  const ubah = (nama: string, patch: Partial<Kelompok>) =>
    setDaftar(d => d.map(k => (k.nama === nama ? { ...k, ...patch } : k)));

  /**
   * Samakan menu akun yang SUDAH ADA di kelompok ini dengan pilihan
   * "Tampilan Dashboard"-nya.
   *
   * Sengaja tombol terpisah, bukan otomatis ikut saat pilihannya diganti:
   * menu tiap akun boleh disesuaikan satu per satu di Account Settings, dan
   * menimpanya diam-diam akan menghapus penyesuaian yang sudah dibuat admin
   * tanpa ia sadari. Di sini admin memilih sendiri kapan menyamakannya.
   */
  const terapkanKeAkun = async (k: Kelompok) => {
    const jumlah = terpakai[k.nama] ?? 0;
    if (!k.nama || jumlah === 0) return;
    const paket = k.dashboard === 'sales' ? SALES_MENU_KEYS : DEFAULT_MENU_KEYS;
    setMenerapkan(k.nama);
    const { error } = await supabase.from('users')
      .update({ allowed_menus: paket })
      .eq('team_type', k.nama);
    setMenerapkan(null);
    if (error) { beritahu('gagal', 'Gagal menerapkan: ' + error.message); return; }
    setDashboardTerpakai(prev => ({ ...prev, [k.nama]: k.dashboard }));
    beritahu('ok', `Menu ${jumlah} akun di ${k.label} disamakan dengan tampilan "${k.dashboard === 'sales' ? 'Seperti Sales' : 'Seperti Team'}". Mereka perlu memuat ulang halamannya.`);
  };

  /**
   * Centang "PTS Cabang" ikut menyesuaikan dua bawaan yang, kalau dibiarkan,
   * membuat mitra luar diperlakukan seperti anggota tim internal.
   *
   * Kelompok baru lahir dengan ditugaskan:true dan SELURUH lonceng - masuk
   * akal untuk tim internal, tapi salah untuk kelompok Cabang: anggotanya
   * memang hanya dipilih di SATU titik (dropdown PTS Daerah saat jadwal
   * Remote diselesaikan), bukan di dropdown assign Ticketing/Request
   * Schedule/Design Project, dan tidak perlu menerima lonceng tiket internal.
   * Ini persis yang terjadi pada kelompok PTS Daerah pertama yang dibuat.
   *
   * Hanya menyesuaikan saat DINYALAKAN, dan semuanya tetap bisa dikembalikan
   * admin - ini bawaan yang menolong, bukan aturan yang mengunci.
   */
  const tandaiCabang = (k: Kelompok) => {
    if (k.cabang) { ubah(k.nama, { cabang: false }); return; }
    const perluDisesuaikan = k.ditugaskan || k.lonceng.length > 1;
    ubah(k.nama, {
      cabang: true,
      ditugaskan: false,
      lonceng: k.lonceng.filter(l => l === 'jadwal'),
    });
    if (perluDisesuaikan) {
      beritahu('ok', `${k.label} ditandai PTS Cabang — "Bisa Ditugaskan" dimatikan dan loncengnya disisakan Jadwal saja. Ubah lagi kalau memang perlu.`);
    }
  };

  const geserLonceng = (nama: string, l: Lonceng) =>
    setDaftar(d => d.map(k => k.nama !== nama ? k : {
      ...k,
      lonceng: k.lonceng.includes(l) ? k.lonceng.filter(x => x !== l) : [...k.lonceng, l],
    }));

  const tambah = () => {
    const inti = namaBaru.trim();
    if (!inti) return;
    const nama = namaKelompokDari(inti);
    if (daftar.some(k => k.nama.toLowerCase() === nama.toLowerCase())) {
      beritahu('gagal', `"${nama}" sudah ada.`);
      return;
    }
    setDaftar(d => [...d, {
      nama, label: nama.replace(/^Team /i, ''), jenis: 'pts',
      ditugaskan: true, cabang: false, dashboard: 'team', aktif: true, lonceng: [...SEMUA_LONCENG],
    }]);
    setNamaBaru('');
  };

  const hapus = (k: Kelompok) => {
    const jumlah = terpakai[k.nama] ?? 0;
    if (jumlah > 0) { beritahu('gagal', `"${k.label}" masih dipakai ${jumlah} akun. Pindahkan akunnya dulu.`); return; }
    setDaftar(d => d.filter(x => x.nama !== k.nama));
  };

  const simpan = async () => {
    setMenyimpan(true);
    const { error } = await simpanKelompok(daftar);
    setMenyimpan(false);
    if (error) { beritahu('gagal', 'Gagal menyimpan: ' + error); return; }
    //  Menyimpan setelan TIDAK menyentuh akun yang sudah ada - itu disengaja
    //  (lihat terapkanKeAkun), tapi diam saja soal itu membuat admin mengira
    //  perubahannya gagal. Jadi disebutkan, lengkap dengan nama kelompoknya.
    const perluTerapkan = daftar.filter(k =>
      k.nama && (terpakai[k.nama] ?? 0) > 0 && dashboardTerpakai[k.nama] !== k.dashboard);
    beritahu('ok', perluTerapkan.length > 0
      ? `Tersimpan. Tapi menu akun yang SUDAH ADA belum ikut berubah — tekan "Terapkan" pada baris ${perluTerapkan.map(k => k.label).join(', ')}.`
      : 'Tersimpan. Lonceng ikut berubah tanpa perlu deploy.');
  };

  if (!siap) return <div className="p-6 text-sm text-slate-400">Memuat pengaturan…</div>;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-5">
      {kabar && (
        <div className="rounded-xl px-4 py-3 text-sm font-semibold"
          style={kabar.jenis === 'ok'
            ? { background: 'rgba(16,185,129,0.1)', color: '#047857', border: '1px solid rgba(16,185,129,0.35)' }
            : { background: 'rgba(239,68,68,0.1)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.35)' }}>
          {kabar.teks}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm">Kelompok & Hak Lonceng</h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Centang lonceng yang boleh dilihat tiap kelompok. Admin & Full Access selalu melihat semuanya.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold tracking-widest uppercase text-slate-400 border-b border-slate-100">
                <th className="text-left px-4 py-2.5">Kelompok</th>
                <th className="text-left px-3 py-2.5">Jenis</th>
                <th className="text-center px-3 py-2.5" title="Ikut dropdown assign di Ticketing, Request Schedule, Request Design Project">Bisa&nbsp;Ditugaskan</th>
                <th className="text-center px-3 py-2.5" title="Anggotanya muncul di dropdown PTS Cabang / Perwakilan saat jadwal Remote diselesaikan">PTS&nbsp;Cabang</th>
                <th className="text-center px-3 py-2.5" title="Paket menu yang didapat anggota kelompok ini. Hanya soal menu - role, hak assign, dan pencatatan Incentive PTS tidak berubah.">Tampilan&nbsp;Dashboard</th>
                {SEMUA_LONCENG.map(l => (
                  <th key={l} className="text-center px-3 py-2.5 whitespace-nowrap">
                    {LABEL_LONCENG[l].ikon} {LABEL_LONCENG[l].label}
                  </th>
                ))}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {daftar.map(k => {
                const jumlah = terpakai[k.nama] ?? 0;
                const bawaan = KELOMPOK_BAWAAN.some(b => b.nama === k.nama);
                return (
                  <tr key={k.nama || '(sales)'} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-800">{k.label}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {k.nama || '(tanpa team_type)'}
                        {jumlah > 0 && <span className="ml-1.5 font-sans font-bold">· {jumlah} akun</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-semibold text-slate-500">{LABEL_JENIS[k.jenis]}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Centang aktif={k.ditugaskan} label={`${k.label} bisa ditugaskan`}
                        onKlik={() => ubah(k.nama, { ditugaskan: !k.ditugaskan })} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Centang aktif={k.cabang} label={`${k.label} PTS Cabang`}
                        onKlik={() => tandaiCabang(k)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <select aria-label={`Tampilan dashboard ${k.label}`} value={k.dashboard}
                          onChange={e => ubah(k.nama, { dashboard: e.target.value as 'team' | 'sales' })}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold bg-white outline-none focus:border-slate-400">
                          <option value="team">Seperti Team</option>
                          <option value="sales">Seperti Sales</option>
                        </select>
                        {jumlah > 0 && (() => {
                          //  Menonjol kalau setelannya sudah diubah tapi akun lamanya
                          //  belum disamakan - tombol yang tampak sama saja dalam dua
                          //  keadaan itulah yang membuat orang mengira sudah selesai.
                          const belumSelaras = dashboardTerpakai[k.nama] !== k.dashboard;
                          return (
                            <button type="button" onClick={() => terapkanKeAkun(k)} disabled={menerapkan === k.nama}
                              title={belumSelaras
                                ? `${jumlah} akun di ${k.label} masih memakai menu lama — tekan untuk menyamakannya`
                                : `Samakan menu ${jumlah} akun yang sudah ada di ${k.label} dengan pilihan ini`}
                              className={`text-[10px] font-bold px-1.5 py-1 rounded-lg border disabled:opacity-50 transition-all whitespace-nowrap ${belumSelaras
                                ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'}`}>
                              {menerapkan === k.nama ? '…' : belumSelaras ? `Terapkan ke ${jumlah} akun` : 'Terapkan'}
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                    {SEMUA_LONCENG.map(l => (
                      <td key={l} className="px-3 py-2.5 text-center">
                        <Centang aktif={k.lonceng.includes(l)} label={`${k.label} lonceng ${LABEL_LONCENG[l].label}`}
                          onKlik={() => geserLonceng(k.nama, l)} />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      {!bawaan && (
                        <button type="button" onClick={() => hapus(k)}
                          className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-all">
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 space-y-3">
          <div>
            <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">Tambah Kelompok PTS</label>
            <div className="flex gap-2">
              <input value={namaBaru} onChange={e => setNamaBaru(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tambah(); } }}
                placeholder="mis. SBY — jadi &quot;Team PTS SBY&quot;"
                className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400 bg-white" />
              <button type="button" onClick={tambah}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white flex-shrink-0 hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg,#7e22ce,#6b21a8)' }}>
                Tambah
              </button>
            </div>
            {namaBaru.trim() && (
              <p className="text-[11px] mt-1.5 font-semibold" style={{ color: '#6b21a8' }}>
                Akan disimpan sebagai: <span className="font-mono">{namaKelompokDari(namaBaru)}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Namanya harus sama persis dengan isi kolom <span className="font-mono">team_type</span> di akun —
              itulah yang dicocokkan seluruh platform. Awalan &quot;Team PTS &quot; ditambahkan otomatis
              (awalan yang sudah kamu ketik tidak akan dobel).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <p className="text-[11px] text-slate-400 mr-auto">Kelompok yang masih dipakai akun tidak bisa dihapus.</p>
            <button type="button" onClick={() => setDaftar(KELOMPOK_BAWAAN)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
              Kembalikan ke bawaan
            </button>
            <button type="button" onClick={simpan} disabled={menyimpan || daftar.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#7e22ce,#6b21a8)' }}>
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Kelompok yang tidak bisa ditugaskan tetap punya loncengnya sendiri — Team PTS UMP misalnya, yang
        pekerjaannya di Piket Showroom, hanya perlu lonceng Reminder. Siapa yang membawahi kelompok mana
        diatur terpisah di User Management → Lingkup Manager.
      </p>
    </div>
  );
}

function Centang({ aktif, label, onKlik }: { aktif: boolean; label: string; onKlik: () => void }) {
  return (
    <button type="button" onClick={onKlik} role="checkbox" aria-checked={aktif} aria-label={label}
      className="w-5 h-5 rounded-md border transition-all inline-flex items-center justify-center"
      style={aktif
        ? { background: '#7e22ce', borderColor: '#7e22ce', color: '#fff' }
        : { background: '#fff', borderColor: '#cbd5e1', color: 'transparent' }}>
      <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
}
