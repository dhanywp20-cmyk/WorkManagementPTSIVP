'use client';

/**
 * Kuis Live (ala Kahoot) - LAYAR HOST admin, untuk diproyeksikan. Admin memandu tiap langkah:
 * lobi (link + QR + nama pemain) -> Mulai -> soal (waktu, jumlah menjawab) -> hasil (distribusi
 * jawaban, kunci) -> papan skor -> ... -> podium. Peserta tidak bisa mulai sebelum Mulai ditekan.
 * Status dibaca dari /api/admin/kelas-eksternal?live=<id> (berkala) dan tombol mengirim aksi live_*.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Check, Maximize, Minimize, Play, RotateCcw, SkipForward, Square, Users, X } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import { appBaseUrl } from '@/lib/app-url';
import type { KelasEksternal, Pilihan } from '@/lib/kelas-eksternal';
import { TOLERANSI_MS, tahapEfektif, type AksiLive, type Tahap } from '@/lib/kuis-live';
import type { KeadaanHost } from '@/lib/kuis-live-server';
import {
  BentukPilihan, BilahSoal, BilahWaktu, HitungMundur, LatarKuis, LogoEvent, PILIHAN_KUIS, Podium, WARNA_PILIHAN,
  formatPoin, useDetak, useJamServer, type TemaKuis,
} from '@/components/kuis-live/tema';

const tombolUtama = 'inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[17px] font-black text-slate-900 shadow-[0_5px_0_rgba(0,0,0,.25)] active:translate-y-1 active:shadow-none disabled:opacity-50';
const tombolKecil = 'inline-flex items-center gap-1.5 rounded-lg bg-black/25 hover:bg-black/40 px-3 py-2 text-[13px] font-bold';

export function LayarHost({ kelas, onTutup, onHasil }: { kelas: KelasEksternal; onTutup: () => void; onHasil: () => void }) {
  const [host, setHost] = useState<KeadaanHost | null>(null);
  const [tema, setTema] = useState<TemaKuis>({ warna: kelas.tema_warna, logo: kelas.logo_url, latar: kelas.latar_url });
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [qr, setQr] = useState('');
  const [penuh, setPenuh] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const { catat, sekarang } = useJamServer();
  const sedangMuat = useRef(false);
  const url = `${appBaseUrl()}/kelas/${kelas.token}`;

  const muat = useCallback(async () => {
    if (sedangMuat.current) return;
    sedangMuat.current = true;
    try {
      const t0 = Date.now();
      const r = await fetch(`/api/admin/kelas-eksternal?live=${kelas.id}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setGalat(j.error || 'Gagal memuat.'); return; }
      catat(j.host.sekarang, t0, Date.now());
      setHost(j.host); setGalat('');
      setTema({ warna: j.kelas.tema_warna, logo: j.kelas.logo_url, latar: j.kelas.latar_url });
    } catch { setGalat('Koneksi terputus - mencoba lagi…'); } finally { sedangMuat.current = false; }
  }, [kelas.id, catat]);

  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => {
    void import('qrcode').then(m => m.default.toDataURL(url, { width: 480, margin: 1 })).then(setQr).catch(() => {});
  }, [url]);

  const tahapServer = host?.tahap;
  useEffect(() => {
    const jeda = tahapServer === 'selesai' ? 5000 : tahapServer === 'lobi' ? 2000 : 1500;
    const t = window.setInterval(() => void muat(), jeda);
    return () => window.clearInterval(t);
  }, [tahapServer, muat]);

  //  Tepat setelah waktu habis: ambil distribusi & kunci.
  useEffect(() => {
    if (!host?.tutupMs || (host.tahap !== 'siap' && host.tahap !== 'soal')) return;
    const t = window.setTimeout(() => void muat(), Math.max(0, host.tutupMs + TOLERANSI_MS + 100 - sekarang()));
    return () => window.clearTimeout(t);
  }, [host?.tahap, host?.tutupMs, muat, sekarang]);

  useDetak(host?.tahap === 'siap' || host?.tahap === 'soal', 200);

  useEffect(() => {
    const ubah = () => setPenuh(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', ubah);
    return () => document.removeEventListener('fullscreenchange', ubah);
  }, []);
  const layarPenuh = () => {
    //  Seluruh dokumen (bukan elemen ini) supaya dialog konfirmasi tetap tampil saat layar penuh.
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const kini = sekarang();
  //  Tahap menurut jam sekarang (hitung mundur -> soal -> waktu habis) tanpa menunggu penyegaran.
  const tahap: Tahap | null = !host ? null
    : host.tahap === 'siap' || host.tahap === 'soal' || host.tahap === 'hasil'
      ? tahapEfektif({
        live_tahap: 'soal',
        live_soal_mulai: host.mulaiMs ? new Date(host.mulaiMs).toISOString() : null,
        live_soal_tutup: host.tutupMs ? new Date(host.tutupMs).toISOString() : null,
      }, kini)
      : host.tahap;
  const menungguHasil = tahap === 'hasil' && host?.tahap !== 'hasil';

  const aksi = async (a: AksiLive | 'live_keluarkan', tambahan: Record<string, unknown> = {}) => {
    if (!host || !tahap) return;
    setSibuk(true);
    try {
      const r = await fetch('/api/admin/kelas-eksternal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: a, id: kelas.id, dari: { tahap, indeks: host.indeks }, ...tambahan }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setGalat(j.error || 'Gagal.');
      else if (j.host) { setHost(j.host); setGalat(''); }
    } catch { setGalat('Koneksi terputus. Coba lagi.'); } finally { setSibuk(false); }
  };

  const akhiri = () => setKonfirmasi({
    message: 'Akhiri kuis sekarang?', description: 'Soal yang belum dimainkan dilewati, podium langsung ditampilkan.',
    confirmLabel: 'Akhiri', danger: true, onConfirm: async () => { setKonfirmasi(null); await aksi('live_akhiri'); },
  });
  const tutup = () => { if (document.fullscreenElement) void document.exitFullscreen(); onTutup(); };

  const h = host;
  const jalan = tahap === 'siap' || tahap === 'soal' || tahap === 'hasil' || tahap === 'papan';
  const terakhir = !!h && h.indeks + 1 >= h.total;

  return (
    <div className="fixed inset-0 z-[1500] overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Layar host ${kelas.judul}`}>
      <LatarKuis tema={tema}>
        <div className="min-h-dvh flex flex-col">
          <header className="flex items-center gap-3 px-4 sm:px-6 pt-4">
            <LogoEvent url={tema.logo} tinggi={34} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Kuis Live{h && h.sesi > 1 ? ` · sesi ${h.sesi}` : ''}</p>
              <p className="truncate text-[17px] font-black">{kelas.judul}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-[14px] font-black tabular-nums"><Users size={15} />{h?.pemain.length ?? 0}</span>
            {jalan && <button type="button" className={tombolKecil} onClick={akhiri} disabled={sibuk}><Square size={13} />Akhiri</button>}
            <button type="button" className={tombolKecil} onClick={layarPenuh} title="Layar penuh (untuk proyektor)">
              {penuh ? <Minimize size={15} /> : <Maximize size={15} />}<span className="hidden sm:inline">{penuh ? 'Keluar' : 'Layar penuh'}</span>
            </button>
            <button type="button" className={tombolKecil} onClick={tutup} aria-label="Tutup layar host"><X size={16} /></button>
          </header>

          {h && tahap !== 'lobi' && (
            <div className="px-4 sm:px-6 pt-3">
              <BilahSoal indeks={h.indeks} total={h.total} selesai={tahap === 'selesai' || ((tahap === 'hasil' || tahap === 'papan') && terakhir)} />
            </div>
          )}
          {galat && <p className="mx-4 sm:mx-6 mt-3 rounded-xl bg-red-600/90 px-4 py-2 text-[14px] font-bold">{galat}</p>}

          <main className="flex-1 flex flex-col px-4 sm:px-6 py-4">
            {!h && <div className="m-auto w-12 h-12 rounded-full border-[5px] border-white/25 border-t-white animate-spin" aria-label="Memuat" />}

            {h && tahap === 'lobi' && (
              <div className="flex-1 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
                <section className="rounded-3xl bg-white text-slate-900 p-5 sm:p-6 shadow-2xl text-center space-y-3">
                  <p className="text-[13px] font-black uppercase tracking-[0.18em] text-slate-500">Gabung lewat HP</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qr ? <img src={qr} alt="QR untuk bergabung" className="mx-auto w-full max-w-[300px] aspect-square" /> : <div className="mx-auto w-full max-w-[300px] aspect-square rounded-xl bg-slate-100" />}
                  <p className="text-[15px] sm:text-[17px] font-black break-all leading-snug">{url.replace(/^https?:\/\//, '')}</p>
                  <p className="text-[12.5px] font-semibold text-slate-500">Pindai QR atau buka link, isi nama, lalu tunggu.</p>
                </section>
                <section className="space-y-5 min-w-0">
                  <div>
                    <h1 className="text-[30px] sm:text-[40px] font-black leading-tight drop-shadow">{kelas.judul}</h1>
                    <p className="mt-1 text-[15px] font-bold text-white/80">{h.total} soal · {h.detik} detik per soal · poin ala Kahoot</p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="rounded-2xl bg-black/30 px-5 py-3 text-[28px] font-black tabular-nums leading-none">{h.pemain.length}<span className="ml-2 text-[15px] font-bold text-white/80">pemain</span></span>
                    <button type="button" className={tombolUtama} disabled={sibuk || h.pemain.length === 0 || h.total === 0} onClick={() => void aksi('live_mulai')}>
                      <Play size={20} fill="currentColor" />Mulai
                    </button>
                    {h.pemain.length === 0 && <span className="text-[14px] font-bold text-white/80">Menunggu pemain pertama…</span>}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {h.pemain.map(p => (
                      <button key={p.id} type="button" title="Klik untuk mengeluarkan"
                        onClick={() => setKonfirmasi({
                          message: `Keluarkan "${p.nama}"?`, description: 'Pemain ini harus mengisi nama lagi untuk ikut.',
                          confirmLabel: 'Keluarkan', danger: true,
                          onConfirm: async () => { setKonfirmasi(null); await aksi('live_keluarkan', { peserta_id: p.id }); },
                        })}
                        className="rounded-xl bg-black/30 hover:bg-red-600/80 px-4 py-2 text-[17px] font-extrabold transition-colors animate-[kuis-muncul_.35s_ease-out]">
                        {p.nama}
                      </button>
                    ))}
                  </div>
                  <style>{'@keyframes kuis-muncul{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}'}</style>
                </section>
              </div>
            )}

            {h && tahap === 'siap' && (
              <div className="m-auto text-center space-y-6 max-w-4xl">
                <p className="text-[16px] font-black uppercase tracking-[0.25em] text-white/80">Soal {h.indeks + 1} dari {h.total}</p>
                {h.soal && <p className="rounded-3xl bg-white text-slate-900 px-6 py-6 text-[28px] sm:text-[40px] font-black leading-tight shadow-2xl">{h.soal.teks}</p>}
                <HitungMundur sisaMs={(h.mulaiMs ?? 0) - kini} />
              </div>
            )}

            {h && (tahap === 'soal' || tahap === 'hasil') && h.soal && (
              <div className="flex-1 flex flex-col gap-4">
                <p className="rounded-3xl bg-white text-slate-900 px-6 py-5 text-center text-[24px] sm:text-[34px] font-black leading-tight shadow-2xl">{h.soal.teks}</p>

                {tahap === 'soal' || menungguHasil ? (
                  <div className="flex-1 grid grid-cols-[auto_1fr_auto] items-center gap-4 sm:gap-8">
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-black/30 border-[6px] border-white flex items-center justify-center">
                      <span className="text-[44px] sm:text-[60px] font-black tabular-nums">{Math.max(0, Math.ceil(((h.tutupMs ?? 0) - kini) / 1000))}</span>
                    </div>
                    <div className="space-y-3">
                      <BilahWaktu sisaMs={(h.tutupMs ?? 0) - kini} durasiMs={h.detik * 1000} />
                      <div>
                        <div className="flex justify-between text-[13px] font-extrabold text-white/85 mb-1">
                          <span>Sudah menjawab</span><span className="tabular-nums">{h.jumlahMenjawab}/{h.pemain.length}</span>
                        </div>
                        <div className="h-3 rounded-full bg-black/25 overflow-hidden">
                          <div className="h-full rounded-full bg-[#7ee081]" style={{ width: `${(h.jumlahMenjawab / Math.max(1, h.pemain.length)) * 100}%`, transition: 'width .4s' }} />
                        </div>
                      </div>
                      {menungguHasil && <p className="text-[18px] font-black">Waktu habis!</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-[48px] sm:text-[64px] font-black tabular-nums leading-none">{h.jumlahMenjawab}</p>
                      <p className="text-[14px] font-bold text-white/80">Jawaban</p>
                    </div>
                  </div>
                ) : (
                  <Distribusi distribusi={h.distribusi} kunci={h.kunci as Pilihan | null} />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PILIHAN_KUIS.map(p => {
                    const redup = tahap === 'hasil' && !menungguHasil && h.kunci && h.kunci !== p;
                    return (
                      <div key={p} className={`flex items-center gap-4 rounded-2xl px-5 shadow-[0_5px_0_rgba(0,0,0,.2)] transition-opacity ${tahap === 'hasil' ? 'py-2.5' : 'py-4'}`}
                        style={{ backgroundColor: WARNA_PILIHAN[p], opacity: redup ? 0.35 : 1 }}>
                        <BentukPilihan p={p} ukuran={36} />
                        <span className="flex-1 text-[18px] sm:text-[22px] font-extrabold leading-snug break-words">{h.soal!.pilihan[p]}</span>
                        {tahap === 'hasil' && !menungguHasil && h.kunci === p && <Check size={34} strokeWidth={4} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {h && tahap === 'papan' && (
              <div className="m-auto w-full max-w-3xl space-y-5">
                <p className="text-center text-[34px] sm:text-[44px] font-black drop-shadow">Papan Skor</p>
                <ol className="space-y-3">
                  {(h.papan ?? []).slice(0, 5).map((b, i) => (
                    <li key={b.peserta_id} className="flex items-center gap-4 rounded-2xl bg-white text-slate-900 px-5 py-3.5 shadow-xl animate-[kuis-geser_.4s_ease-out_both]"
                      style={{ animationDelay: `${i * 80}ms` }}>
                      <span className="w-9 text-center text-[24px] font-black tabular-nums">{b.peringkat}</span>
                      <span className="flex-1 min-w-0 truncate text-[22px] font-extrabold">{b.nama}</span>
                      <span className="text-[22px] font-black tabular-nums">{formatPoin(b.poin)}</span>
                    </li>
                  ))}
                </ol>
                {(h.papan ?? []).length === 0 && <p className="text-center text-[16px] font-bold text-white/80">Belum ada pemain.</p>}
                <style>{'@keyframes kuis-geser{0%{transform:translateX(-40px);opacity:0}100%{transform:none;opacity:1}}'}</style>
              </div>
            )}

            {h && tahap === 'selesai' && (
              <div className="m-auto w-full max-w-5xl space-y-5 text-center">
                <p className="text-[30px] sm:text-[38px] font-black drop-shadow">Selamat untuk para juara!</p>
                {(h.papan ?? []).length > 0
                  ? <Podium juara={(h.papan ?? []).slice(0, 3)} besar />
                  : <p className="text-[16px] font-bold text-white/80">Tidak ada pemain yang menjawab.</p>}
                {(h.papan ?? []).length > 3 && (
                  <ol className="mx-auto max-w-3xl grid sm:grid-cols-2 gap-1.5 text-left">
                    {(h.papan ?? []).slice(3, 10).map(b => (
                      <li key={b.peserta_id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-2">
                        <span className="w-7 text-center font-black tabular-nums">{b.peringkat}</span>
                        <span className="flex-1 min-w-0 truncate font-bold">{b.nama}</span>
                        <span className="font-black tabular-nums">{formatPoin(b.poin)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </main>

          {h && tahap !== 'lobi' && (
            <footer className="sticky bottom-0 flex items-center justify-end gap-3 flex-wrap px-4 sm:px-6 pb-4 pt-2">
              {(tahap === 'siap' || (tahap === 'soal' && !menungguHasil)) && (
                <button type="button" className={tombolUtama} disabled={sibuk} onClick={() => void aksi('live_tutup_soal')}>
                  <SkipForward size={19} />Lewati
                </button>
              )}
              {tahap === 'hasil' && !menungguHasil && (
                <button type="button" className={tombolUtama} disabled={sibuk} onClick={() => void aksi('live_lanjut')}>Papan skor<SkipForward size={19} /></button>
              )}
              {tahap === 'papan' && (
                <button type="button" className={tombolUtama} disabled={sibuk} onClick={() => void aksi('live_lanjut')}>
                  {terakhir ? 'Lihat podium' : 'Soal berikutnya'}<SkipForward size={19} />
                </button>
              )}
              {tahap === 'selesai' && (
                <>
                  <button type="button" className={tombolKecil + ' !text-[15px] !px-4 !py-3'} onClick={onHasil}><BarChart3 size={16} />Hasil lengkap</button>
                  <button type="button" className={tombolUtama} disabled={sibuk} onClick={() => void aksi('live_ulang')}><RotateCcw size={18} />Main lagi</button>
                </>
              )}
            </footer>
          )}
        </div>
      </LatarKuis>
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

/** Grafik batang jumlah pemilih tiap pilihan; yang benar diberi centang, lainnya diredupkan. */
function Distribusi({ distribusi, kunci }: { distribusi: Record<Pilihan, number> | null; kunci: Pilihan | null }) {
  const d = distribusi ?? { A: 0, B: 0, C: 0, D: 0 };
  const maks = Math.max(1, ...Object.values(d));
  return (
    <div className="flex-1 flex items-end justify-center gap-4 sm:gap-8 min-h-[150px]">
      {PILIHAN_KUIS.map(p => (
        <div key={p} className="flex flex-col items-center gap-2 w-20 sm:w-28" style={{ opacity: kunci && kunci !== p ? 0.45 : 1 }}>
          <span className="text-[26px] font-black tabular-nums">{d[p]}</span>
          <div className="w-full rounded-t-xl" style={{ backgroundColor: WARNA_PILIHAN[p], height: `${10 + (d[p] / maks) * 110}px`, transition: 'height .5s ease-out' }} />
          <div className="w-full flex items-center justify-center gap-1.5 rounded-b-xl py-2" style={{ backgroundColor: WARNA_PILIHAN[p] }}>
            <BentukPilihan p={p} ukuran={22} />{kunci === p && <Check size={22} strokeWidth={4} />}
          </div>
        </div>
      ))}
    </div>
  );
}
