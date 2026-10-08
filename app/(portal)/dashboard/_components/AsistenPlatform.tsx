'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';
import { ModalPortal } from '@/components/shared/ModalPortal';
import { PANDUAN, cariPanduan, type Panduan } from '@/lib/panduan';

/**
 * Asisten Platform - satu tombol melayang (menggantikan "Jelajahi Platform")
 * yang membuka panel dua tab:
 *   - Tanya: obrolan dengan asisten AI (/api/asisten) yang membaca data
 *     platform dengan hak akses penanya sendiri.
 *   - Panduan: cara pakai modul yang sedang dibuka (lib/panduan.ts), modul
 *     lain, dan tombol memulai tur platform.
 *
 * Tombolnya tetap "mengalah" seperti tombol Jelajahi dulu: tampil penuh
 * sebentar lalu menyingkir ke tepi kanan supaya tidak menutupi tombol aksi.
 */
type Pesan = { peran: 'user' | 'model'; teks: string; galat?: boolean };

const KUNCI_SIMPAN = 'wm_asisten_obrolan';

/** Markdown minimal & aman: butir "- ", **tebal**, baris baru. React meng-escape teksnya. */
function TeksAsisten({ teks }: { teks: string }) {
  const tebal = (baris: string) => baris.split(/(\*\*[^*]+\*\*)/g).map((b, i) =>
    b.startsWith('**') && b.endsWith('**') ? <strong key={i}>{b.slice(2, -2)}</strong> : <React.Fragment key={i}>{b}</React.Fragment>);
  const baris = teks.split('\n');
  const keluar: React.ReactNode[] = [];
  let butir: string[] = [];
  const tutupButir = () => {
    if (butir.length) keluar.push(<ul key={`u${keluar.length}`} className="list-disc pl-4 space-y-0.5 my-1">{butir.map((b, i) => <li key={i}>{tebal(b)}</li>)}</ul>);
    butir = [];
  };
  for (const l of baris) {
    const m = l.match(/^\s*[-*•]\s+(.*)$/);
    if (m) { butir.push(m[1]); continue; }
    tutupButir();
    if (l.trim()) keluar.push(<p key={`p${keluar.length}`} className="my-1">{tebal(l)}</p>);
  }
  tutupButir();
  return <>{keluar}</>;
}

function KartuPanduan({ p }: { p: Panduan }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-slate-900">{p.judul}</p>
        <p className="text-[12.5px] text-slate-600 mt-0.5">{p.guna}</p>
      </div>
      <ol className="space-y-2">
        {p.langkah.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-[12.5px] text-slate-700 leading-relaxed">
            <span className="w-5 h-5 rounded-full bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
            <span>{l}</span>
          </li>
        ))}
      </ol>
      {p.tips.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1">Tips</p>
          <ul className="list-disc pl-4 space-y-1 text-[12px] text-slate-700">
            {p.tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AsistenPlatform({ modul, atasan, onMulaiTur }: {
  /** Kunci modul yang sedang dibuka (lib/panduan.ts), mis. 'ticketing'. */
  modul: string;
  /** Supervisor/Manager/Admin - menambah saran pertanyaan tentang tim. */
  atasan: boolean;
  onMulaiTur: () => void;
}) {
  const [melebar, setMelebar] = useState(true);
  const [buka, setBuka] = useState(false);
  const [tab, setTab] = useState<'tanya' | 'panduan'>('tanya');
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [isian, setIsian] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [modulPanduan, setModulPanduan] = useState(modul);
  const ujungRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!melebar || buka) return;
    const t = setTimeout(() => setMelebar(false), 5000);
    return () => clearTimeout(t);
  }, [melebar, buka]);

  useEffect(() => { setModulPanduan(modul); }, [modul]);

  // Obrolan bertahan selama tab peramban terbuka (bukan lintas perangkat).
  useEffect(() => {
    try { const s = sessionStorage.getItem(KUNCI_SIMPAN); if (s) setPesan(JSON.parse(s)); } catch { /* abaikan */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(KUNCI_SIMPAN, JSON.stringify(pesan.slice(-20))); } catch { /* abaikan */ }
    ujungRef.current?.scrollIntoView({ block: 'end' });
  }, [pesan, sibuk]);

  useEffect(() => {
    if (!buka) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [buka]);

  const panduanAktif = cariPanduan(modulPanduan) ?? cariPanduan('dashboard')!;

  const kirim = async (teks: string) => {
    const t = teks.trim();
    if (!t || sibuk) return;
    setTab('tanya');
    const riwayat = pesan.filter(p => !p.galat).slice(-8).map(p => ({ peran: p.peran, teks: p.teks }));
    setPesan(p => [...p, { peran: 'user', teks: t }]);
    setIsian('');
    setSibuk(true);
    try {
      const r = await fetch('/api/asisten', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: t, riwayat, modul }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.alasan ?? 'Asisten sedang tidak bisa menjawab.');
      setPesan(p => [...p, { peran: 'model', teks: j.jawaban }]);
    } catch (e) {
      setPesan(p => [...p, { peran: 'model', teks: (e as Error).message, galat: true }]);
    } finally {
      setSibuk(false);
    }
  };

  const saran = [
    'Tiket saya yang masih aktif apa saja?',
    'Jadwal saya 7 hari ke depan?',
    ...(atasan ? ['Siapa yang belum isi Daily Report hari ini?'] : ['Daily Report saya hari ini sudah lengkap?']),
    `Bagaimana cara pakai ${cariPanduan(modul)?.judul ?? 'Beranda'}?`,
  ];
  //  Satu kasus per lini produk yang kita pasang, bukan LED saja - dijawab
  //  dari tiket lama yang Solved & Tech Note, atau langkah cek umum bila
  //  belum pernah ada tiketnya (lihat prompt di /api/asisten).
  const saranTroubleshoot = [
    'Cara mengatasi layar LED blank / sebagian mati?',
    'Cara mengatasi touch interactive display tidak merespon?',
    'Cara mengatasi proyektor tidak ada gambar atau redup?',
    'Cara mengatasi WyreStorm HDBaseT / matrix no signal?',
    'Cara mengatasi panel kontrol Extron tidak merespon?',
  ];

  return (
    <>
      <button
        onClick={() => { if (melebar) { setBuka(true); } else setMelebar(true); }}
        className={`fixed bottom-28 md:bottom-6 z-[1504] flex items-center gap-2 py-2.5 text-xs font-bold text-white shadow-xl active:scale-95 ${
          melebar ? 'right-6 px-4 rounded-2xl hover:scale-105' : 'right-0 pl-3 pr-2 rounded-l-2xl opacity-70 hover:opacity-100'}`}
        style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', boxShadow: '0 4px 20px rgba(29,78,216,0.4)',
          transition: 'right 0.35s ease, opacity 0.25s ease, padding 0.35s ease, border-radius 0.35s ease' }}
        aria-label={melebar ? 'Buka Asisten Platform' : 'Tampilkan tombol Asisten'}
        title={melebar ? 'Tanya asisten & panduan platform' : 'Tampilkan tombol Asisten'}>
        <Ikon nama="✨" ukuran={16} />
        {melebar && <span className="hidden sm:inline whitespace-nowrap">Asisten</span>}
      </button>

      {buka && (
        <ModalPortal>
          <div className="fixed inset-0 z-[1600] bg-slate-900/30 sm:bg-transparent" onClick={() => setBuka(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Asisten Platform"
            className="fixed z-[1601] inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px] sm:h-[min(640px,calc(100dvh-110px))] sm:rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="px-4 pt-3 pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0"><Ikon nama="✨" ukuran={16} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 leading-tight">Asisten Platform</p>
                    <p className="text-[11px] text-slate-500 truncate">Tanya data kerja Anda atau cara pakai menu</p>
                  </div>
                </div>
                <button type="button" onClick={() => setBuka(false)} aria-label="Tutup"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 flex-shrink-0">
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-slate-100 mt-3">
                {([['tanya', 'Tanya'], ['panduan', 'Panduan']] as const).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                    className={`flex-1 py-1.5 rounded-lg text-[12.5px] font-semibold ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
                ))}
              </div>
            </div>

            {tab === 'tanya' ? (
              <>
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
                  {pesan.length === 0 && (
                    <div className="space-y-3">
                      <p className="text-[12.5px] text-slate-600 leading-relaxed">
                        Halo! Saya bisa membantu mencari tiket, jadwal, progres project, Daily Report, solusi dari tiket lama, dan cara memakai setiap menu.
                        Data yang saya tampilkan sama dengan yang boleh Anda lihat di platform.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {saran.map(s => (
                          <button key={s} type="button" onClick={() => kirim(s)}
                            className="text-left text-[12px] font-medium px-3 py-1.5 rounded-full border border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100">{s}</button>
                        ))}
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-1">Troubleshooting perangkat</p>
                      <div className="flex flex-wrap gap-1.5">
                        {saranTroubleshoot.map(s => (
                          <button key={s} type="button" onClick={() => kirim(s)}
                            className="text-left text-[12px] font-medium px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100">{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {pesan.map((p, i) => (
                    <div key={i} className={`flex ${p.peran === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                        p.peran === 'user' ? 'bg-blue-700 text-white rounded-br-md'
                        : p.galat ? 'bg-rose-50 text-rose-800 border border-rose-100 rounded-bl-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'}`}>
                        {p.peran === 'model' ? <TeksAsisten teks={p.teks} /> : p.teks}
                      </div>
                    </div>
                  ))}
                  {sibuk && (
                    <div className="flex justify-start" aria-live="polite">
                      <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2.5 flex gap-1" aria-label="Asisten sedang menjawab">
                        {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={ujungRef} />
                </div>
                <form onSubmit={e => { e.preventDefault(); void kirim(isian); }}
                  className="border-t border-slate-100 p-3 flex items-end gap-2">
                  <textarea value={isian} onChange={e => setIsian(e.target.value)} rows={1} maxLength={1000}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void kirim(isian); } }}
                    placeholder="Tulis pertanyaan..." aria-label="Pertanyaan untuk asisten"
                    className="flex-1 resize-none max-h-28 rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                  <button type="submit" disabled={sibuk || !isian.trim()} aria-label="Kirim"
                    className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                    <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                </form>
                {pesan.length > 0 && (
                  <button type="button" onClick={() => setPesan([])}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 pb-2 -mt-1">Mulai obrolan baru</button>
                )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
                <KartuPanduan p={panduanAktif} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => kirim(`Jelaskan cara memakai ${panduanAktif.judul} untuk peran saya.`)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800">Tanya asisten tentang menu ini</button>
                  <button type="button" onClick={() => { setBuka(false); onMulaiTur(); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Mulai tur platform</button>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Menu lain</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PANDUAN.filter(p => p.kunci !== panduanAktif.kunci).map(p => (
                      <button key={p.kunci} type="button" onClick={() => setModulPanduan(p.kunci)}
                        className="text-[12px] font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50">{p.judul}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModalPortal>
      )}
    </>
  );
}
