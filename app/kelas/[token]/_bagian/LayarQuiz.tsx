'use client';

/**
 * Mengerjakan quiz: satu soal per layar, daftar nomor, waktu mundur, draf jawaban di perangkat.
 * Dikirim otomatis bila waktu habis, batas pelanggaran tercapai, atau admin mengakhiri kelas.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Grid3x3, Timer } from 'lucide-react';
import type { AlasanKirimOtomatis } from '@/lib/kelas-eksternal';
import { bacaDraf, panggilKelas, tulisDraf, type InfoKelas, type Percobaan } from './api';
import { usePengawas } from './usePengawas';

/** Mode admin: cek tiap 15 dtk apakah kelas diakhiri pengajar. */
const CEK_DIAKHIRI_MS = 15_000;

const fmtWaktu = (ms: number) => {
  const d = Math.ceil(ms / 1000);
  const j = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  return `${j ? `${j}:` : ''}${String(m).padStart(j ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
};

export function LayarQuiz({ kelas, judul, data, modeAdmin, onKirim }: {
  kelas: string; judul: string; data: Percobaan; modeAdmin: boolean;
  onKirim: (jawaban: Record<string, string>, alasan?: AlasanKirimOtomatis) => Promise<void>;
}) {
  const [jawaban, setJawaban] = useState<Record<string, string>>(() => bacaDraf(kelas, data.percobaan));
  const [i, setI] = useState(0);
  const [lihatDaftar, setLihatDaftar] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  //  Waktu dihitung dari jam server saat mulai (sisaMs) + jam perangkat sejak itu - mengubah jam HP
  //  tidak menambah waktu; server juga menandai kiriman yang lewat batas.
  const [batasAwal] = useState<number | null>(() => (data.sisaMs === null ? null : Date.now() + data.sisaMs));
  const batas = useRef<number | null>(batasAwal);
  const [sisa, setSisa] = useState<number | null>(data.sisaMs);
  const terkirim = useRef(false);

  const kirim = useCallback(async (alasan?: AlasanKirimOtomatis) => {
    if (terkirim.current) return;
    terkirim.current = true;
    setMengirim(true);
    await onKirim(jawaban, alasan);
    terkirim.current = false;
    setMengirim(false);
  }, [jawaban, onKirim]);

  useEffect(() => { tulisDraf(kelas, data.percobaan, jawaban); }, [kelas, data.percobaan, jawaban]);

  useEffect(() => {
    if (batas.current === null) return;
    const t = window.setInterval(() => {
      const s = Math.max(0, (batas.current ?? 0) - Date.now());
      setSisa(s);
      if (s === 0) { window.clearInterval(t); void kirim('waktu'); }
    }, 500);
    return () => window.clearInterval(t);
  }, [kirim]);

  const { peringatan, tutupPeringatan } = usePengawas({ kelas, aktif: !mengirim, onBatasTercapai: () => void kirim('pelanggaran') });

  useEffect(() => {
    if (!modeAdmin) return;
    const t = window.setInterval(async () => {
      const r = await panggilKelas<InfoKelas>(kelas);
      if (r.ok && r.data.status === 'selesai') void kirim('diakhiri');
    }, CEK_DIAKHIRI_MS);
    return () => window.clearInterval(t);
  }, [modeAdmin, kelas, kirim]);

  useEffect(() => {
    const cegah = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', cegah);
    return () => window.removeEventListener('beforeunload', cegah);
  }, []);

  const soal = data.soal[i];
  const dijawab = data.soal.filter(s => jawaban[s.id]).length;
  const kosong = data.soal.length - dijawab;
  const genting = sisa !== null && sisa <= 60_000;
  const pilih = (p: string) => setJawaban(j => ({ ...j, [soal.id]: p }));

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50">
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800 truncate">{judul}</p>
            <p className="text-[11.5px] font-semibold text-slate-500 tabular-nums">{dijawab}/{data.soal.length} dijawab</p>
          </div>
          {sisa !== null && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold tabular-nums ${genting ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-700'}`}
              aria-live={genting ? 'polite' : 'off'} title="Sisa waktu">
              <Timer size={14} />{fmtWaktu(sisa)}
            </span>
          )}
          <button type="button" onClick={() => setLihatDaftar(v => !v)} aria-expanded={lihatDaftar} aria-label="Daftar soal" title="Daftar soal"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Grid3x3 size={16} /></button>
        </div>
        <div className="h-1 bg-slate-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${(dijawab / data.soal.length) * 100}%` }} /></div>
        {lihatDaftar && (
          <div className="max-w-3xl mx-auto px-4 py-3 grid grid-cols-8 sm:grid-cols-12 gap-1.5 border-t border-slate-100">
            {data.soal.map((s, n) => (
              <button key={s.id} type="button" onClick={() => { setI(n); setLihatDaftar(false); }} aria-label={`Soal ${n + 1}`}
                className={`h-9 rounded-md text-[12.5px] font-bold tabular-nums border ${n === i ? 'ring-2 ring-indigo-500' : ''} ${jawaban[s.id] ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                {n + 1}
              </button>
            ))}
          </div>
        )}
      </header>

      {peringatan && (
        <div className="sticky top-[72px] z-10 max-w-3xl w-full mx-auto px-4 pt-3" role="alert">
          <button type="button" onClick={tutupPeringatan}
            className="w-full flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-left text-[13px] font-semibold text-red-700">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1">{peringatan.label} tercatat</span>
            {peringatan.total !== null && (
              <span className="tabular-nums font-bold">{peringatan.batas ? `${peringatan.total}/${peringatan.batas}` : `${peringatan.total}×`}</span>
            )}
          </button>
        </div>
      )}

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5 sm:py-8 select-none">
        <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-2">Soal {i + 1} dari {data.soal.length}</p>
        <h2 className="text-[16px] sm:text-[18px] font-semibold text-slate-900 leading-relaxed whitespace-pre-line">{soal.teks}</h2>
        <div className="mt-5 space-y-2.5" role="radiogroup" aria-label={`Pilihan jawaban soal ${i + 1}`}>
          {(['A', 'B', 'C', 'D'] as const).filter(p => soal.pilihan[p]).map(p => {
            const aktif = jawaban[soal.id] === p;
            return (
              <button key={p} type="button" role="radio" aria-checked={aktif} onClick={() => pilih(p)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 transition-colors ${aktif ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${aktif ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{p}</span>
                <span className="text-[14.5px] text-slate-800 leading-snug pt-0.5">{soal.pilihan[p]}</span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="sticky bottom-0 bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <button type="button" onClick={() => setI(n => Math.max(0, n - 1))} disabled={i === 0}
            className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-700 disabled:opacity-40">
            <ChevronLeft size={16} />Sebelumnya
          </button>
          <span className="flex-1" />
          {i < data.soal.length - 1 ? (
            <button type="button" onClick={() => setI(n => n + 1)}
              className="inline-flex items-center gap-1 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[13.5px] font-semibold">
              Berikutnya<ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={() => (kosong ? setKonfirmasi(true) : void kirim())} disabled={mengirim}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-[13.5px] font-bold disabled:opacity-60">
              <CheckCircle2 size={16} />{mengirim ? 'Mengirim…' : 'Kirim jawaban'}
            </button>
          )}
        </div>
      </footer>

      {konfirmasi && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Kirim jawaban">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4 shadow-xl">
            <p className="text-[15px] font-bold text-slate-900">{kosong} soal belum dijawab</p>
            <p className="text-[13px] text-slate-600">Soal yang tidak dijawab dihitung salah.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setKonfirmasi(false)} aria-label="Tutup" className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-700">Kembali</button>
              <button type="button" onClick={() => { setKonfirmasi(false); void kirim(); }} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-[13.5px] font-bold">Kirim</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
