'use client';

/**
 * Kuis Live (ala Kahoot) - LAYAR HOST admin, untuk diproyeksikan. Admin hanya menekan Mulai; sesudah
 * itu kuis berjalan sendiri mengikuti waktu tiap soal (hitung mundur -> soal -> jawaban benar &
 * distribusi -> papan skor -> soal berikutnya -> podium). Lewati = maju satu tahap sekarang juga.
 * Peserta tidak bisa mulai sebelum Mulai ditekan.
 *
 * Kendali presenter: Jeda / Lanjutkan (jam kuis beku - waktu membaca soal atau diskusi), Ulang soal ini,
 * Mundur ke soal sebelumnya (jawaban soal itu dianulir), dan Dari awal (kembali ke lobi kapan saja;
 * Mulai berikutnya = sesi baru, skor sesi lama tetap ada di Hasil).
 *
 * Tampil di atas SELURUH platform (portal ke <body>, lapisan Z.layarHost) dan isinya disusun di
 * panggung 16:9 yang diskalakan memenuhi layar, jadi di proyektor/monitor mana pun tidak ada yang
 * terpotong. Layar tegak (HP) memakai tata letak biasa yang bisa digulir.
 * Status dibaca dari /api/admin/kelas-eksternal?live=<id> (berkala) dan tombol mengirim aksi live_*.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Check, Maximize, Minimize, Pause, Play, RefreshCcw, RotateCcw, SkipBack, SkipForward, Square, Users, X } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import { ModalPortal } from '@/components/shared/ModalPortal';
import { GambarSoal } from '@/components/shared/GambarSoal';
import { appBaseUrl } from '@/lib/app-url';
import type { KelasEksternal, Pilihan } from '@/lib/kelas-eksternal';
import type { AksiLive, Tahap } from '@/lib/kuis-live';
import type { KeadaanHost } from '@/lib/kuis-live-server';
import { Z } from '@/lib/z-index';
import {
  BilahSoal, BilahWaktu, HitungMundur, LatarKuis, LogoEvent, PILIHAN_KUIS, Podium, WARNA_PILIHAN,
  formatPoin, ukuranTeks, useDetak, useJamServer, type TemaKuis,
} from '@/components/kuis-live/tema';

/** Ukuran panggung yang dirancang; diskalakan ke layar sebenarnya. */
const LEBAR = 1280;
const TINGGI = 720;

const tombolUtama = 'inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[17px] font-black text-slate-900 shadow-[0_5px_0_rgba(0,0,0,.25)] active:translate-y-1 active:shadow-none disabled:opacity-50';
const tombolKecil = 'inline-flex items-center gap-1.5 rounded-lg bg-black/25 hover:bg-black/40 px-3 py-2 text-[13px] font-bold';

/** Skala panggung 16:9 agar pas di layar mendatar; null = layar tegak (tata letak biasa). */
function useSkala() {
  const [skala, setSkala] = useState<number | null>(null);
  useEffect(() => {
    const hitung = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setSkala(w > h ? Math.min(w / LEBAR, h / TINGGI) : null);
    };
    hitung();
    window.addEventListener('resize', hitung);
    return () => window.removeEventListener('resize', hitung);
  }, []);
  return skala;
}

/** Keluar layar penuh (bila sedang) - dipakai saat layar host ditutup. */
export function keluarLayarPenuh() {
  if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

/** Masuk layar penuh. Harus dipanggil langsung dari klik (aturan peramban). */
export function masukLayarPenuh() {
  if (typeof document !== 'undefined' && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
}

export function LayarHost({ kelas, onTutup, onHasil }: { kelas: KelasEksternal; onTutup: () => void; onHasil: () => void }) {
  const [host, setHost] = useState<KeadaanHost | null>(null);
  const [tema, setTema] = useState<TemaKuis>({ warna: kelas.tema_warna, logo: kelas.logo_url, latar: kelas.latar_url });
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [qr, setQr] = useState('');
  const [penuh, setPenuh] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const { catat, sekarang } = useJamServer();
  const skala = useSkala();
  const sedangMuat = useRef(false);
  //  Domain yang sedang dibuka, bukan appBaseUrl(): peserta harus masuk ke deployment yang sama
  //  dengan layar host (di Preview, domain produksi belum tentu punya versi kuis yang sama).
  const url = `${typeof window !== 'undefined' ? window.location.origin : appBaseUrl()}/kelas/${kelas.token}`;

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
    void import('qrcode').then(m => m.default.toDataURL(url, { width: 640, margin: 1 })).then(setQr).catch(() => {});
  }, [url]);

  const tahapServer = host?.tahap;
  useEffect(() => {
    //  Pergantian tahap ditangkap penyegaran terjadwal di bawah; berkala ini untuk jumlah menjawab & pemain baru.
    const jeda = tahapServer === 'selesai' ? 10_000 : 3000;
    const t = window.setInterval(() => void muat(), jeda);
    return () => window.clearInterval(t);
  }, [tahapServer, muat]);

  //  Tepat saat tahap berganti otomatis (waktu habis, hasil -> papan, papan -> soal berikutnya).
  useEffect(() => {
    if (!host?.akhirMs || host.tahap === 'siap') return;
    const t = window.setTimeout(() => void muat(), Math.max(0, host.akhirMs + 120 - sekarang()));
    return () => window.clearTimeout(t);
  }, [host?.tahap, host?.akhirMs, muat, sekarang]);

  const berjalan = !!host && host.tahap !== 'lobi' && host.tahap !== 'selesai';
  useDetak(berjalan, 250);

  useEffect(() => {
    const ubah = () => setPenuh(!!document.fullscreenElement);
    ubah();
    document.addEventListener('fullscreenchange', ubah);
    return () => document.removeEventListener('fullscreenchange', ubah);
  }, []);

  const h = host;
  //  Dijeda: jam kuis beku di titik jeda - hitung mundur & bilah waktu berhenti di layar.
  const kini = h?.jedaMs ?? sekarang();
  const dijeda = !!h?.jedaMs;
  //  Layar tegak (admin memegang HP): huruf diperkecil dan teks tidak dipotong - halaman bisa digulir.
  const huruf = (teks: string, tangga: [number, number][]) => Math.round(ukuranTeks(teks, tangga) * (skala ? 1 : 0.6));
  const potong = skala ? 'line-clamp-3' : '';
  //  Hitung mundur -> soal tanpa menunggu penyegaran (soal & pilihan sudah ada di data).
  const tahap: Tahap | null = !h ? null : h.tahap === 'siap' && h.mulaiMs && kini >= h.mulaiMs ? 'soal' : h.tahap;
  const waktuHabis = tahap === 'soal' && !!h?.tutupMs && kini >= h.tutupMs;
  const sisaOtomatis = h?.akhirMs ? Math.max(0, Math.ceil((h.akhirMs - kini) / 1000)) : null;
  const terakhir = !!h && h.indeks + 1 >= h.total;

  const aksi = async (a: AksiLive | 'live_keluarkan', tambahan: Record<string, unknown> = {}) => {
    if (!h || !tahap) return;
    setSibuk(true);
    try {
      const r = await fetch('/api/admin/kelas-eksternal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: a, id: kelas.id, dari: { tahap, indeks: h.indeks }, ...tambahan }),
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
  const tutup = () => { keluarLayarPenuh(); onTutup(); };
  const pastikan = (message: string, description: string, confirmLabel: string, a: AksiLive) => setKonfirmasi({
    message, description, confirmLabel, danger: true, onConfirm: async () => { setKonfirmasi(null); await aksi(a); },
  });
  const ulangSoal = () => pastikan(`Ulang soal ${(h?.indeks ?? 0) + 1}?`,
    'Soal ini dimainkan lagi dari hitung mundur. Jawaban yang sudah masuk untuk soal ini dianulir dan poinnya dihapus.', 'Ulang soal', 'live_ulang_soal');
  const mundur = () => pastikan(`Kembali ke soal ${h?.indeks ?? 0}?`,
    'Soal sebelumnya dimainkan lagi. Jawaban soal itu dan soal sesudahnya dianulir, papan skor ikut mundur.', 'Mundur', 'live_mundur');
  const dariAwal = () => pastikan('Ulang kuis dari awal?',
    'Kembali ke lobi, pemain tetap terdaftar. Tekan Mulai untuk sesi baru - skor sesi ini tetap tersimpan di Hasil (pilih sesi).', 'Dari awal', 'live_ulang');

  const keteranganOtomatis = dijeda ? 'Dijeda - tekan Lanjutkan bila sudah siap'
    : !h || sisaOtomatis === null ? null
    : tahap === 'siap' ? `Pilihan muncul dalam ${sisaOtomatis}`
      : tahap === 'hasil' ? `Papan skor dalam ${sisaOtomatis}`
        : tahap === 'papan' ? `${terakhir ? 'Podium' : 'Soal berikutnya'} dalam ${sisaOtomatis}`
          : null;

  const isi = (
    <>
      <header className="flex items-center gap-3 px-6 pt-4 shrink-0">
        <LogoEvent url={tema.logo} tinggi={34} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Kuis Live{h && h.sesi > 1 ? ` · sesi ${h.sesi}` : ''}</p>
          <p className="truncate text-[17px] font-black">{kelas.judul}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-[14px] font-black tabular-nums"><Users size={15} />{h?.pemain.length ?? 0}</span>
        {berjalan && (
          <>
            {h!.indeks > 0 && <button type="button" className={tombolKecil} onClick={mundur} disabled={sibuk} title="Mainkan lagi soal sebelumnya"><SkipBack size={13} />Mundur</button>}
            <button type="button" className={tombolKecil} onClick={ulangSoal} disabled={sibuk} title="Mainkan lagi soal ini"><RotateCcw size={13} />Ulang soal</button>
            <button type="button" className={tombolKecil} onClick={dariAwal} disabled={sibuk} title="Kembali ke lobi - sesi baru"><RefreshCcw size={13} />Dari awal</button>
            <button type="button" className={tombolKecil} onClick={akhiri} disabled={sibuk}><Square size={13} />Akhiri</button>
          </>
        )}
        <button type="button" className={tombolKecil} onClick={() => (penuh ? keluarLayarPenuh() : masukLayarPenuh())} title="Layar penuh">
          {penuh ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>
        <button type="button" className={tombolKecil} onClick={tutup} aria-label="Tutup layar host"><X size={16} /></button>
      </header>

      {h && tahap !== 'lobi' && (
        <div className="px-6 pt-3 shrink-0">
          <BilahSoal indeks={h.indeks} total={h.total} selesai={tahap === 'selesai' || ((tahap === 'hasil' || tahap === 'papan') && terakhir)} />
        </div>
      )}
      {galat && <p className="mx-6 mt-3 rounded-xl bg-red-600/90 px-4 py-2 text-[14px] font-bold shrink-0">{galat}</p>}
      {dijeda && (
        <p className="mx-6 mt-3 self-center inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 text-[18px] font-black text-slate-900 shadow-lg shrink-0">
          <Pause size={18} fill="currentColor" />DIJEDA
        </p>
      )}

      <main className="flex-1 min-h-0 flex flex-col px-6 py-4">
        {!h && <div className="m-auto w-12 h-12 rounded-full border-[5px] border-white/25 border-t-white animate-spin" aria-label="Memuat" />}

        {h && tahap === 'lobi' && (
          <div className={`flex-1 min-h-0 grid gap-6 ${skala ? 'grid-cols-[minmax(0,400px)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
            <section className="rounded-3xl bg-white text-slate-900 p-6 shadow-2xl flex flex-col items-center justify-center gap-3 min-h-0">
              <p className="text-[14px] font-black uppercase tracking-[0.18em] text-slate-500">Pindai untuk bergabung</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr ? <img src={qr} alt="QR untuk bergabung" className="w-full max-w-[340px] aspect-square" /> : <div className="w-full max-w-[340px] aspect-square rounded-xl bg-slate-100" />}
              <p className="text-[13px] font-semibold text-slate-500 text-center">Isi nama di HP, lalu tunggu kuis dimulai.</p>
            </section>
            <section className="min-w-0 min-h-0 flex flex-col gap-5">
              <div>
                <h1 className="text-[40px] font-black leading-tight drop-shadow-sm line-clamp-2">{kelas.judul}</h1>
                <p className="mt-1 text-[16px] font-bold text-white/85">{h.total} soal · {h.detik} detik per soal</p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="rounded-2xl bg-black/30 px-5 py-3 text-[30px] font-black tabular-nums leading-none">{h.pemain.length}<span className="ml-2 text-[15px] font-bold text-white/80">pemain</span></span>
                <button type="button" className={tombolUtama} disabled={sibuk || h.pemain.length === 0 || h.total === 0} onClick={() => void aksi('live_mulai')}>
                  <Play size={20} fill="currentColor" />Mulai
                </button>
                {h.pemain.length === 0 && <span className="text-[14px] font-bold text-white/80">Menunggu pemain pertama…</span>}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-wrap content-start gap-2.5 pr-1">
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
          <div className="m-auto w-full text-center space-y-6">
            <p className="text-[16px] font-black uppercase tracking-[0.25em] text-white/80">Soal {h.indeks + 1} dari {h.total}</p>
            {h.soal && (
              <p className="rounded-3xl bg-white text-slate-900 px-8 py-6 font-black leading-tight shadow-2xl"
                style={{ fontSize: huruf(h.soal.teks, [[70, 44], [130, 36], [220, 30], [9999, 24]]) }}>{h.soal.teks}</p>
            )}
            <GambarSoal url={h.soal?.gambar} tinggi="max-h-[38vh]" className="shadow-2xl" />
            <HitungMundur sisaMs={(h.mulaiMs ?? 0) - kini} />
          </div>
        )}

        {h && (tahap === 'soal' || tahap === 'hasil') && h.soal && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <p className={`shrink-0 rounded-3xl bg-white text-slate-900 px-8 py-4 text-center font-black leading-tight shadow-2xl ${potong}`}
              style={{ fontSize: huruf(h.soal.teks, [[70, 34], [130, 28], [220, 24], [9999, 20]]) }}>{h.soal.teks}</p>
            <GambarSoal url={h.soal.gambar} tinggi="max-h-[30vh]" className="shrink-0 shadow-2xl" />

            {tahap === 'soal' ? (
              <div className="flex-1 min-h-0 grid grid-cols-[auto_1fr_auto] items-center gap-8">
                <div className="w-36 h-36 rounded-full bg-black/30 border-[6px] border-white flex items-center justify-center">
                  <span className="text-[60px] font-black tabular-nums">{Math.max(0, Math.ceil(((h.tutupMs ?? 0) - kini) / 1000))}</span>
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
                  {waktuHabis && <p className="text-[18px] font-black">Waktu habis!</p>}
                </div>
                <div className="text-center">
                  <p className="text-[64px] font-black tabular-nums leading-none">{h.jumlahMenjawab}</p>
                  <p className="text-[14px] font-bold text-white/80">Jawaban</p>
                </div>
              </div>
            ) : (
              <Distribusi distribusi={h.distribusi} kunci={h.kunci as Pilihan | null} />
            )}

            <div className="shrink-0 grid grid-cols-2 gap-3">
              {PILIHAN_KUIS.map(p => {
                const teks = h.soal!.pilihan[p];
                const benar = tahap === 'hasil' && h.kunci === p;
                const redup = tahap === 'hasil' && !!h.kunci && !benar;
                return (
                  <div key={p} className={`flex items-center gap-4 rounded-2xl shadow-[0_5px_0_rgba(0,0,0,.2)] transition-opacity ${skala ? 'px-6 py-3 min-h-[76px]' : 'px-4 py-3'}`}
                    style={{ backgroundColor: WARNA_PILIHAN[p], opacity: redup ? 0.35 : 1 }}>
                    <span className={`flex-1 font-extrabold leading-snug wrap-break-word ${potong}`}
                      style={{ fontSize: huruf(teks, [[30, 24], [60, 20], [110, 17], [9999, 15]]) }}>{teks}</span>
                    {benar && <Check size={34} strokeWidth={4} className="shrink-0" aria-label="Jawaban benar" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {h && tahap === 'papan' && (
          <div className="m-auto w-full max-w-3xl space-y-5">
            <style>{'@keyframes kuis-geser{0%{transform:translateX(-40px);opacity:0}100%{transform:none;opacity:1}}'}</style>
            <p className="text-center text-[44px] font-black drop-shadow-sm">Papan Skor</p>
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
          </div>
        )}

        {h && tahap === 'selesai' && (
          <div className="m-auto w-full max-w-5xl space-y-5 text-center">
            <p className="text-[38px] font-black drop-shadow-sm">Selamat untuk para juara!</p>
            {(h.papan ?? []).length > 0
              ? <Podium juara={(h.papan ?? []).slice(0, 3)} besar />
              : <p className="text-[16px] font-bold text-white/80">Tidak ada pemain yang menjawab.</p>}
            {(h.papan ?? []).length > 3 && (
              <ol className={`mx-auto max-w-3xl grid gap-1.5 text-left ${skala ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {(h.papan ?? []).slice(3, 9).map(b => (
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
        <footer className="shrink-0 flex items-center justify-end gap-3 flex-wrap px-6 pb-4">
          {keteranganOtomatis && (
            <span className="mr-auto rounded-full bg-black/25 px-4 py-2 text-[14px] font-bold tabular-nums">{keteranganOtomatis}</span>
          )}
          {berjalan && (
            dijeda ? (
              <button type="button" className={tombolUtama} disabled={sibuk} onClick={() => void aksi('live_lanjutkan')}>
                <Play size={19} fill="currentColor" />Lanjutkan
              </button>
            ) : (
              <button type="button" className={`${tombolKecil} text-[15px]! px-4! py-3!`} disabled={sibuk} onClick={() => void aksi('live_jeda')}
                title="Bekukan waktu - untuk membaca soal atau diskusi">
                <Pause size={16} fill="currentColor" />Jeda
              </button>
            )
          )}
          {berjalan && (
            <button type="button" className={tombolUtama} disabled={sibuk || dijeda} onClick={() => void aksi('live_lewati')}>
              <SkipForward size={19} />Lewati
            </button>
          )}
          {tahap === 'selesai' && (
            <>
              <button type="button" className={`${tombolKecil} text-[15px]! px-4! py-3!`} onClick={onHasil}><BarChart3 size={16} />Hasil lengkap</button>
              <button type="button" className={tombolUtama} disabled={sibuk} onClick={() => void aksi('live_ulang')}><RotateCcw size={18} />Main lagi</button>
            </>
          )}
        </footer>
      )}
    </>
  );

  return (
    <ModalPortal>
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: Z.layarHost }} role="dialog" aria-modal="true" aria-label={`Layar host ${kelas.judul}`}>
        <LatarKuis tema={tema} className="h-full">
          {skala ? (
            <div className="h-dvh w-full flex items-center justify-center overflow-hidden">
              <div className="shrink-0 flex flex-col" style={{ width: LEBAR, height: TINGGI, transform: `scale(${skala})` }}>{isi}</div>
            </div>
          ) : (
            <div className="h-dvh overflow-y-auto flex flex-col">{isi}</div>
          )}
        </LatarKuis>
        <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
      </div>
    </ModalPortal>
  );
}

/** Grafik batang jumlah pemilih tiap pilihan; yang benar diberi centang, lainnya diredupkan. */
function Distribusi({ distribusi, kunci }: { distribusi: Record<Pilihan, number> | null; kunci: Pilihan | null }) {
  const d = distribusi ?? { A: 0, B: 0, C: 0, D: 0 };
  const maks = Math.max(1, ...Object.values(d));
  return (
    <div className="flex-1 min-h-[120px] flex items-end justify-center gap-8">
      {PILIHAN_KUIS.map(p => (
        <div key={p} className="h-full w-28 flex flex-col items-center justify-end gap-2" style={{ opacity: kunci && kunci !== p ? 0.45 : 1 }}>
          <span className="flex items-center gap-1 text-[26px] font-black tabular-nums">
            {d[p]}{kunci === p && <Check size={24} strokeWidth={4} aria-label="Jawaban benar" />}
          </span>
          <div className="w-full rounded-xl" style={{ backgroundColor: WARNA_PILIHAN[p], height: `${8 + (d[p] / maks) * 72}%`, transition: 'height .5s ease-out' }} />
        </div>
      ))}
    </div>
  );
}
