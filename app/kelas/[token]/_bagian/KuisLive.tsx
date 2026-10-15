'use client';

/**
 * Kuis Live (ala Kahoot) - layar PESERTA. Isi nama -> lobi (menunggu admin menekan Mulai) -> tiap
 * soal: hitung mundur, pilih satu dari 4 warna/bentuk, lihat Benar/Salah + poin + peringkat ->
 * papan skor -> podium. Semua yang menentukan (soal aktif, waktu, poin) datang dari server; jam
 * perangkat dikoreksi ke jam server supaya semua HP serentak.
 *
 * Kuis berjalan sendiri mengikuti waktu (lib/kuis-live.ts jadwalLive). Pembaruan: penyegaran berkala
 * tiap 2,5 dtk (menangkap Mulai / Lewati / semua sudah menjawab) + penyegaran terjadwal tepat di akhir
 * tiap tahap. Sengaja TANPA Supabase Realtime: 100+ HP melewati batas pesan/detik paket Free dan
 * Supabase lalu memutus semua koneksi realtime proyek (lihat lib/kuis-live-server.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Lock, Trophy, Users, X } from 'lucide-react';
import type { Pilihan } from '@/lib/kelas-eksternal';
import {
  BilahSoal, BilahWaktu, HIJAU, HitungMundur, LatarKuis, LogoEvent, MERAH, PILIHAN_KUIS, Podium,
  WARNA_PILIHAN, formatPoin, ukuranTeks, useDetak, useJamServer,
} from '@/components/kuis-live/tema';
import { panggilKelas, simpanTokenPeserta, type InfoLive } from './api';

type JawabanLokal = { sesi: number; indeks: number; pilihan: Pilihan; galat?: string };

export function KuisLive({ token, awal }: { token: string; awal: InfoLive }) {
  const [info, setInfo] = useState(awal);
  const [nama, setNama] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');
  const [lokal, setLokal] = useState<JawabanLokal | null>(null);
  const { catat, sekarang } = useJamServer();
  const sedangMuat = useRef(false);
  const muatLagi = useRef(false);

  /** Ambil status terbaru. Permintaan yang datang saat masih memuat digabung jadi satu susulan. */
  const segarkan = useCallback(async () => {
    if (sedangMuat.current) { muatLagi.current = true; return; }
    sedangMuat.current = true;
    try {
      do {
        muatLagi.current = false;
        const t0 = Date.now();
        const r = await panggilKelas<InfoLive>(token);
        if (r.ok && r.data.live) { catat(r.data.live.sekarang, t0, Date.now()); setInfo(r.data); }
      } while (muatLagi.current);
    } finally { sedangMuat.current = false; }
  }, [token, catat]);

  //  Ukur jam server segera (data awal belum terkalibrasi).
  useEffect(() => { void segarkan(); }, [segarkan]);

  const live = info.live;
  useEffect(() => {
    const jeda = live.tahap === 'selesai' ? 10_000 : 2_500;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void segarkan(); }, jeda);
    const kembali = () => { if (document.visibilityState === 'visible') void segarkan(); };
    document.addEventListener('visibilitychange', kembali);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', kembali); };
  }, [live.tahap, segarkan]);

  //  Tepat setelah waktu soal habis: ambil hasil (benar/salah, poin, peringkat).
  useEffect(() => {
    //  Kuis berjalan sendiri: tiap tahap punya waktu akhir (soal -> hasil -> papan -> soal berikutnya).
    if (!live.akhirMs || live.tahap === 'siap') return;
    const tunggu = live.akhirMs + 200 + Math.random() * 600 - sekarang();
    const t = window.setTimeout(() => void segarkan(), Math.max(0, tunggu));
    return () => window.clearTimeout(t);
  }, [live.tahap, live.akhirMs, live.indeks, segarkan, sekarang]);

  useDetak(live.tahap === 'siap' || live.tahap === 'soal', 200);

  const kini = sekarang();
  const tahap = live.tahap === 'siap' && live.mulaiMs && kini >= live.mulaiMs ? 'soal' : live.tahap;
  const waktuHabis = tahap === 'soal' && !!live.tutupMs && kini >= live.tutupMs;
  const lokalIni = lokal && lokal.sesi === live.sesi && lokal.indeks === live.indeks ? lokal : null;
  const pilihanku: Pilihan | null = live.jawabanSaya?.pilihan ?? (lokalIni && !lokalIni.galat ? lokalIni.pilihan : null);
  const tema = info.kelas.tema;

  const jawab = async (p: Pilihan) => {
    if (pilihanku || lokalIni || waktuHabis) return;
    const k: JawabanLokal = { sesi: live.sesi, indeks: live.indeks, pilihan: p };
    setLokal(k); setPesan('');
    try { navigator.vibrate?.(30); } catch { /* tidak semua perangkat */ }
    for (let coba = 0; coba < 3; coba++) {
      const r = await panggilKelas<{ pilihan: Pilihan }>(token, { aksi: 'jawab', indeks: k.indeks, pilihan: p });
      if (r.ok) { setLokal({ ...k, pilihan: r.data.pilihan }); return; }
      if (r.status === 401) { setLokal(null); void segarkan(); return; }
      if (r.status >= 400 && r.status < 500) { setLokal({ ...k, galat: r.data.error || 'Jawaban tidak terkirim.' }); return; }
      await new Promise(res => setTimeout(res, 500));
    }
    setLokal(null);
    setPesan('Koneksi terputus - tekan jawabanmu lagi.');
  };

  const masuk = async () => {
    setSibuk(true); setPesan('');
    const r = await panggilKelas<{ token: string; nama: string }>(token, { aksi: 'daftar', nama });
    if (!r.ok) { setSibuk(false); setPesan(r.data.error || 'Gagal masuk.'); return; }
    simpanTokenPeserta(token, r.data.token);
    await segarkan();
    setSibuk(false);
  };

  // ── Belum masuk ────────────────────────────────────────────────────────────
  if (!info.peserta) {
    const buka = info.status === 'buka';
    return (
      <LatarKuis tema={tema}>
        <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 gap-5">
          <LogoEvent url={tema.logo} tinggi={64} />
          <div className="text-center max-w-md">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-white/75">Kuis Live</p>
            <h1 className="mt-1 text-[26px] sm:text-[30px] font-black leading-tight drop-shadow">{info.kelas.judul}</h1>
            {info.kelas.keterangan && <p className="mt-2 text-[14px] text-white/85 whitespace-pre-line">{info.kelas.keterangan}</p>}
          </div>
          {buka ? (
            <form className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl space-y-3 text-slate-900"
              onSubmit={e => { e.preventDefault(); if (nama.trim().length >= 2 && !sibuk) void masuk(); }}>
              <label htmlFor="nama-kuis" className="sr-only">Nama kamu</label>
              <input id="nama-kuis" value={nama} onChange={e => setNama(e.target.value)} maxLength={80} autoComplete="name" autoFocus
                placeholder="Nama kamu"
                className="w-full h-14 rounded-xl border-2 border-slate-300 px-4 text-center text-[20px] font-extrabold outline-none focus:border-slate-900" />
              <button type="submit" disabled={sibuk || nama.trim().length < 2}
                className="w-full h-14 rounded-xl bg-slate-900 text-white text-[18px] font-black disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                {sibuk && <Loader2 size={18} className="animate-spin" />}Masuk
              </button>
              {pesan && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] font-bold text-red-700 text-center">{pesan}</p>}
            </form>
          ) : (
            <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 text-center text-slate-800 shadow-2xl">
              <Lock size={28} className="mx-auto text-slate-400" />
              <p className="mt-2 text-[16px] font-extrabold">{info.pesan}</p>
            </div>
          )}
          <p className="text-[13px] font-bold text-white/85 text-center">
            {info.kelas.jumlahSoal} soal · {info.kelas.detikPerSoal} detik per soal · {live.jumlahPemain} pemain
          </p>
          {buka && live.tahap !== 'lobi' && (
            <p className="rounded-full bg-black/25 px-4 py-1.5 text-[12.5px] font-bold">Kuis sedang berjalan - kamu langsung ikut di soal berikutnya.</p>
          )}
        </main>
      </LatarKuis>
    );
  }

  // ── Sudah masuk ────────────────────────────────────────────────────────────
  const posisi = live.posisi;
  const tampilBilah = tahap !== 'lobi';
  const kunci = live.kunci as Pilihan | null;
  const benar = live.jawabanSaya && 'benar' in live.jawabanSaya ? live.jawabanSaya.benar : null;
  const warnaLatar = tahap === 'hasil' ? (benar ? HIJAU : MERAH) : undefined;

  return (
    <LatarKuis tema={tema} warna={warnaLatar}>
      <div className="min-h-dvh flex flex-col">
        <header className="flex items-center gap-2 px-3 pt-3">
          <LogoEvent url={tema.logo} tinggi={22} className="!px-2 !py-1 !rounded-lg" />
          <p className="flex-1 min-w-0 truncate text-[13px] font-extrabold text-white/90">{info.kelas.judul}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[12px] font-bold"><Users size={12} />{live.jumlahPemain}</span>
        </header>
        {tampilBilah && (
          <div className="px-3 pt-3">
            <BilahSoal indeks={live.indeks} total={live.total} selesai={tahap === 'selesai' || ((tahap === 'hasil' || tahap === 'papan') && live.indeks + 1 >= live.total)} />
          </div>
        )}

        <main className="flex-1 flex flex-col px-3 pt-4 pb-24">
          {tahap === 'lobi' && (
            <div className="m-auto text-center space-y-4 max-w-sm">
              <p className="text-[30px] font-black leading-tight drop-shadow">Kamu sudah masuk!</p>
              <p className="text-[15px] font-bold text-white/85">Lihat namamu di layar</p>
              <div className="mx-auto w-14 h-14 rounded-full border-[5px] border-white/25 border-t-white animate-spin" aria-hidden="true" />
              <p className="text-[14px] font-bold text-white/85">Menunggu admin menekan <span className="font-black text-white">Mulai</span>…</p>
              <p className="text-[12px] text-white/70">Biarkan halaman ini terbuka. Soal muncul serentak untuk semua.</p>
            </div>
          )}

          {tahap === 'siap' && (
            <div className="m-auto text-center space-y-5 max-w-lg">
              <p className="text-[14px] font-black uppercase tracking-[0.2em] text-white/80">Soal {live.indeks + 1}</p>
              {live.soal && <p className="text-[22px] sm:text-[26px] font-black leading-snug drop-shadow">{live.soal.teks}</p>}
              <HitungMundur sisaMs={(live.mulaiMs ?? 0) - kini} />
              <p className="text-[13px] font-bold text-white/80">Siap-siap…</p>
            </div>
          )}

          {tahap === 'soal' && !pilihanku && !lokalIni && !waktuHabis && live.soal && (
            <div className="flex-1 flex flex-col gap-3">
              <BilahWaktu sisaMs={(live.tutupMs ?? 0) - kini} durasiMs={live.detik * 1000} />
              <p className="rounded-2xl bg-white text-slate-900 px-4 py-3.5 text-center text-[17px] sm:text-[20px] font-extrabold leading-snug shadow-lg">{live.soal.teks}</p>
              <div className="flex-1 grid grid-cols-2 gap-2.5 sm:gap-3 auto-rows-fr min-h-[48vh]">
                {PILIHAN_KUIS.map(p => (
                  <button key={p} type="button" onClick={() => void jawab(p)} aria-label={`Pilihan ${p}: ${live.soal!.pilihan[p]}`}
                    className="rounded-2xl p-3 flex items-center justify-center text-center shadow-[0_6px_0_rgba(0,0,0,.25)] active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,.25)] transition-transform"
                    style={{ backgroundColor: WARNA_PILIHAN[p] }}>
                    <span className="font-extrabold leading-snug line-clamp-5 break-words"
                      style={{ fontSize: ukuranTeks(live.soal!.pilihan[p], [[25, 20], [60, 17], [9999, 15]]) }}>{live.soal!.pilihan[p]}</span>
                  </button>
                ))}
              </div>
              {pesan && <p className="rounded-xl bg-black/35 px-3 py-2 text-center text-[13px] font-bold">{pesan}</p>}
            </div>
          )}

          {tahap === 'soal' && (pilihanku || lokalIni || waktuHabis) && (
            <div className="m-auto text-center space-y-5 max-w-sm">
              {pilihanku ? (
                <>
                  <div className="mx-auto max-w-xs rounded-2xl px-5 py-5 shadow-xl" style={{ backgroundColor: WARNA_PILIHAN[pilihanku] }}>
                    <p className="text-[18px] font-extrabold leading-snug break-words">{live.soal?.pilihan[pilihanku]}</p>
                  </div>
                  <p className="text-[26px] font-black drop-shadow">Jawaban terkirim!</p>
                  <p className="text-[14px] font-bold text-white/85">Cepat juga kamu… tunggu hasilnya.</p>
                </>
              ) : (
                <>
                  <p className="text-[28px] font-black drop-shadow">{lokalIni?.galat ?? 'Waktu habis!'}</p>
                  <p className="text-[14px] font-bold text-white/85">Menunggu hasil…</p>
                </>
              )}
              <Loader2 size={30} className="mx-auto animate-spin text-white/80" />
            </div>
          )}

          {tahap === 'hasil' && (
            <div className="m-auto text-center space-y-4 max-w-sm w-full">
              <div className="mx-auto w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center">
                {benar ? <Check size={56} strokeWidth={3.5} /> : <X size={56} strokeWidth={3.5} />}
              </div>
              <p className="text-[34px] font-black drop-shadow">{benar ? 'Benar!' : live.jawabanSaya ? 'Salah' : 'Waktu habis'}</p>
              {benar
                ? <p className="inline-block rounded-xl bg-black/30 px-5 py-2 text-[24px] font-black tabular-nums">+{formatPoin(live.jawabanSaya && 'poin' in live.jawabanSaya ? live.jawabanSaya.poin : 0)}</p>
                : kunci && live.soal && (
                  <div className="rounded-2xl bg-black/25 p-3 space-y-2">
                    <p className="text-[12px] font-black uppercase tracking-wider text-white/80">Jawaban benar</p>
                    <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: WARNA_PILIHAN[kunci] }}>
                      <span className="text-[16px] font-extrabold leading-snug break-words">{live.soal.pilihan[kunci]}</span>
                    </div>
                  </div>
                )}
              {posisi && <KeteranganPosisi posisi={posisi} />}
            </div>
          )}

          {tahap === 'papan' && (
            <div className="m-auto w-full max-w-md space-y-4">
              <p className="text-center text-[26px] font-black drop-shadow">Papan Skor</p>
              <ol className="space-y-2">
                {(live.papan ?? []).map((b, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-white text-slate-900 px-3 py-2.5 shadow-md">
                    <span className="w-7 text-center text-[16px] font-black tabular-nums">{b.peringkat}</span>
                    <span className="flex-1 min-w-0 truncate text-[15px] font-extrabold">{b.nama}</span>
                    <span className="text-[15px] font-black tabular-nums">{formatPoin(b.poin)}</span>
                  </li>
                ))}
              </ol>
              {posisi && <KeteranganPosisi posisi={posisi} />}
            </div>
          )}

          {tahap === 'selesai' && (
            <div className="m-auto w-full max-w-md space-y-6 text-center">
              {posisi && posisi.peringkat <= 3 && posisi.poin > 0 ? (
                <div className="space-y-1">
                  <Trophy size={48} className="mx-auto text-[#ffd34d] drop-shadow" />
                  <p className="text-[30px] font-black drop-shadow">Juara {posisi.peringkat}!</p>
                </div>
              ) : (
                <p className="text-[26px] font-black drop-shadow">Kuis selesai!</p>
              )}
              {(live.papan ?? []).length > 0 && <Podium juara={(live.papan ?? []).slice(0, 3)} />}
              {posisi && (
                <div className="rounded-2xl bg-white text-slate-900 p-4 shadow-xl">
                  <p className="text-[13px] font-bold text-slate-500">Peringkat kamu</p>
                  <p className="text-[34px] font-black tabular-nums leading-tight">{posisi.peringkat}<span className="text-[16px] text-slate-500"> dari {posisi.jumlah}</span></p>
                  <p className="text-[14px] font-bold text-slate-600 tabular-nums">{formatPoin(posisi.poin)} poin · {posisi.benar} dari {live.total} benar</p>
                </div>
              )}
              <p className="text-[12.5px] font-bold text-white/80">Terima kasih sudah ikut!</p>
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 inset-x-0 z-10 flex items-center gap-3 bg-white px-4 py-3 text-slate-900 shadow-[0_-4px_14px_rgba(0,0,0,.15)]">
          <span className="flex-1 min-w-0 truncate text-[15px] font-extrabold">{info.peserta.nama}</span>
          <span className="rounded-lg bg-slate-900 px-3 py-1 text-[15px] font-black text-white tabular-nums">{formatPoin(posisi?.poin ?? 0)}</span>
        </footer>
      </div>
    </LatarKuis>
  );
}

/** "Peringkat 3 dari 20 · 120 poin di belakang Budi" */
function KeteranganPosisi({ posisi }: { posisi: { peringkat: number; jumlah: number; poin: number; atas: { nama: string; selisih: number } | null } }) {
  return (
    <div className="inline-block rounded-2xl bg-black/30 px-4 py-2.5">
      <p className="text-[16px] font-black">Peringkat {posisi.peringkat} dari {posisi.jumlah}</p>
      <p className="text-[13px] font-bold text-white/85">
        {posisi.atas
          ? <>{formatPoin(posisi.atas.selisih)} poin di belakang <span className="font-black text-white">{posisi.atas.nama}</span></>
          : posisi.poin > 0 ? 'Kamu memimpin!' : 'Ayo, kejar di soal berikutnya!'}
      </p>
    </div>
  );
}
