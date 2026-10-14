'use client';

/**
 * Kelas Eksternal Learning Center - halaman CUSTOMER (publik, tanpa login, tanpa header platform).
 * Alur: isi nama -> kerjakan quiz -> nilai. Perangkat yang sama dikenali (token di localStorage),
 * jadi membuka link lagi melanjutkan / menampilkan nilai, bukan mendaftar ulang.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, FileQuestion, Loader2, Lock, RotateCcw, Target } from 'lucide-react';
import { hapusDraf, panggilKelas, simpanTokenPeserta, type Hasil, type InfoKelas, type Percobaan } from './_bagian/api';
import { LayarQuiz } from './_bagian/LayarQuiz';

function Kartu({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-6 sm:p-8">{children}</div>
    </div>
  );
}

function Info({ ikon, teks }: { ikon: React.ReactNode; teks: string }) {
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[12px] font-semibold text-slate-600">{ikon}{teks}</span>;
}

export default function HalamanKelas() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<InfoKelas | null>(null);
  const [galat, setGalat] = useState('');
  const [nama, setNama] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');
  const [percobaan, setPercobaan] = useState<Percobaan | null>(null);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [bolehUlang, setBolehUlang] = useState(false);

  const muat = useCallback(async () => {
    const r = await panggilKelas<InfoKelas>(token);
    if (!r.ok) { setGalat(r.data.error || 'Link kelas tidak ditemukan.'); return; }
    setInfo(r.data);
    setHasil(r.data.hasil);
    setBolehUlang(!r.data.kelas.satuKali);
    document.title = r.data.kelas.judul;
  }, [token]);
  useEffect(() => { void muat(); }, [muat]);

  const mulai = async () => {
    setSibuk(true); setPesan('');
    const r = await panggilKelas<Percobaan & { hasil?: Hasil }>(token, { aksi: 'mulai' });
    setSibuk(false);
    if (r.ok) { setPercobaan(r.data); setHasil(null); return; }
    if (r.data.hasil) { setHasil(r.data.hasil); return; }
    setPesan(r.data.error || 'Gagal memulai.');
  };

  const daftarLaluMulai = async () => {
    setSibuk(true); setPesan('');
    const r = await panggilKelas<{ token: string; nama: string }>(token, { aksi: 'daftar', nama });
    if (!r.ok) { setSibuk(false); setPesan(r.data.error || 'Pendaftaran gagal.'); return; }
    simpanTokenPeserta(token, r.data.token);
    setInfo(i => (i ? { ...i, peserta: { nama: r.data.nama } } : i));
    await mulai();
  };

  const kirim = useCallback(async (jawaban: Record<string, string>) => {
    if (!percobaan) return;
    for (let coba = 0; coba < 3; coba++) {
      const r = await panggilKelas<{ hasil: Hasil; bolehUlang: boolean }>(token, { aksi: 'kirim', jawaban });
      if (r.ok && r.data.hasil) {
        hapusDraf(token, percobaan.percobaan);
        setHasil(r.data.hasil); setBolehUlang(r.data.bolehUlang); setPercobaan(null);
        return;
      }
      await new Promise(res => setTimeout(res, 1500 * (coba + 1)));
    }
    setPesan('Jawaban belum terkirim. Periksa internet lalu tekan Kirim lagi - jawaban Anda tersimpan di perangkat ini.');
  }, [percobaan, token]);

  if (galat) {
    return <Kartu><div className="text-center space-y-3"><Lock size={32} className="mx-auto text-slate-400" /><p className="text-[15px] font-bold text-slate-800">{galat}</p></div></Kartu>;
  }
  if (!info) {
    return <div className="min-h-dvh bg-slate-50 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-slate-400" /></div>;
  }
  if (percobaan) {
    return (
      <>
        <LayarQuiz kelas={token} judul={info.kelas.judul} data={percobaan} onKirim={kirim} />
        {pesan && <p className="fixed bottom-20 inset-x-4 mx-auto max-w-md z-30 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] font-semibold text-red-700">{pesan}</p>}
      </>
    );
  }

  const k = info.kelas;

  if (hasil) {
    return (
      <Kartu>
        <div className="text-center space-y-4">
          <p className="text-[13px] font-semibold text-slate-500">{k.judul}</p>
          {info.peserta && <p className="text-[15px] font-bold text-slate-800">{info.peserta.nama}</p>}
          <div className={`mx-auto w-36 h-36 rounded-full flex flex-col items-center justify-center border-[10px] ${hasil.lulus ? 'border-emerald-500' : 'border-amber-400'}`}>
            <span className="text-[40px] font-extrabold text-slate-900 tabular-nums leading-none">{hasil.skor}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">Nilai</span>
          </div>
          <p className={`text-[15px] font-bold ${hasil.lulus ? 'text-emerald-700' : 'text-amber-700'}`}>{hasil.lulus ? 'Lulus' : 'Belum lulus'}</p>
          <p className="text-[13px] text-slate-600 tabular-nums">{hasil.benar} dari {hasil.jumlah} benar · nilai lulus {k.passingGrade}</p>
          {bolehUlang && info.status === 'buka' && (
            <button type="button" onClick={() => void mulai()} disabled={sibuk}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-700 disabled:opacity-60">
              <RotateCcw size={15} />Ulangi
            </button>
          )}
          {pesan && <p className="text-[13px] font-semibold text-red-700">{pesan}</p>}
        </div>
      </Kartu>
    );
  }

  const terdaftar = !!info.peserta;
  const bisaDaftar = info.status === 'buka';
  return (
    <Kartu>
      <h1 className="text-[20px] sm:text-[22px] font-bold text-slate-900 leading-tight">{k.judul}</h1>
      {k.keterangan && <p className="mt-2 text-[13.5px] text-slate-600 whitespace-pre-line">{k.keterangan}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Info ikon={<FileQuestion size={13} />} teks={`${k.jumlahSoal} soal`} />
        <Info ikon={<Clock size={13} />} teks={k.timerMenit ? `${k.timerMenit} menit` : 'Tanpa batas waktu'} />
        <Info ikon={<Target size={13} />} teks={`Lulus ≥ ${k.passingGrade}`} />
      </div>

      <div className="mt-6 space-y-3">
        {terdaftar ? (
          <p className="text-[14px] text-slate-700">Halo, <span className="font-bold">{info.peserta!.nama}</span></p>
        ) : bisaDaftar ? (
          <div>
            <label htmlFor="nama-peserta" className="block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nama lengkap</label>
            <input id="nama-peserta" value={nama} onChange={e => setNama(e.target.value)} maxLength={80} autoComplete="name" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && nama.trim().length >= 2) void daftarLaluMulai(); }}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-[15px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Nama Anda" />
          </div>
        ) : null}

        {!terdaftar && !bisaDaftar && info.pesan && (
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-[13.5px] font-semibold text-slate-700">{info.pesan}</p>
        )}
        {pesan && <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] font-semibold text-red-700">{pesan}</p>}

        {(terdaftar || bisaDaftar) && (
          <button type="button" onClick={() => void (terdaftar ? mulai() : daftarLaluMulai())}
            disabled={sibuk || (!terdaftar && nama.trim().length < 2)}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-[15px] font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {sibuk && <Loader2 size={16} className="animate-spin" />}
            {info.berjalan ? 'Lanjutkan quiz' : 'Mulai quiz'}
          </button>
        )}
        {k.timerMenit && !info.berjalan && (terdaftar || bisaDaftar) && (
          <p className="text-center text-[12px] text-slate-500">Waktu berjalan sejak tombol ditekan.</p>
        )}
      </div>
    </Kartu>
  );
}
