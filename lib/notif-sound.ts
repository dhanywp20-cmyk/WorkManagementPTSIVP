'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Alarm suara notifikasi - dipakai NotificationBar (dashboard) supaya orang
 * yang membiarkan tab ini terbuka seharian tetap sadar ada ticket/notifikasi
 * baru tanpa harus melirik layar terus-menerus.
 */
/**
 * Berkas di /public, BUKAN data URI seperti sebelumnya.
 *
 * Suara lamanya chime sintetis ~38 KB yang ikut terbundel ke dalam JavaScript,
 * jadi setiap orang yang membuka dashboard mengunduhnya lagi bersama kodenya -
 * termasuk yang alarmnya dimatikan dan tidak akan pernah membunyikannya.
 * Sebagai berkas terpisah ia diunduh sekali lalu disimpan cache peramban, dan
 * bundel kodenya ikut menyusut sebesar itu.
 */
const BERKAS_SUARA = '/notif.wav';

const KUNCI_MUTE = 'wm_notif_sound_muted';

/**
 * Bunyi SEKALI per rentetan: notifikasi yang datang berdekatan (mis. beberapa ticket
 * sekaligus) cukup satu bunyi. Dicatat juga di localStorage supaya beberapa tab yang
 * terbuka bersamaan tidak berbunyi bergantian.
 */
const JEDA_BUNYI_MS = 10_000;
const KUNCI_TERAKHIR = 'wm_notif_sound_terakhir';

export function useNotifSoundAlarm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const terakhirRef = useRef(0);
  /** Bertambah tiap bunyi notifikasi asli - unlock yang sedang berjalan tidak boleh menghentikannya. */
  const putaranRef = useRef(0);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(KUNCI_MUTE) === '1'; } catch { return false; }
  });

  useEffect(() => {
    audioRef.current = new Audio(BERKAS_SUARA);
    //  Diminta diunduh lebih awal: kalau baru dimuat saat notifikasi datang,
    //  bunyinya terlambat beberapa ratus milidetik dari munculnya baris baru.
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 0.55;
    /*
      Browser modern menolak audio.play() sebelum ada interaksi user di
      halaman itu (autoplay policy). "Unlock"-nya dengan main sebentar lalu
      langsung pause+reset begitu klik/keydown PERTAMA terjadi di halaman -
      setelahnya audio yang sama boleh diputar dari kode (mis. dari event
      realtime) tanpa interaksi baru.

      DUA hal yang dulu membuat bunyi "terpotong seperti kaset macet":
        1. Unlock dulu dibunyikan KERAS - potongan denting terdengar di klik pertama.
           Sekarang dibisukan (muted) selama unlock.
        2. Kalau peramban sudah mengizinkan autoplay (situs yang dipakai seharian),
           notifikasi bisa berbunyi SEBELUM klik pertama. Klik berikutnya - sering
           justru klik ke lonceng karena mendengar bunyinya - menjalankan unlock yang
           pause() + currentTime = 0: dentingnya diputus di tengah. Sekarang unlock
           tidak menyentuh audio yang sedang berbunyi, dan bunyi yang sudah pernah
           berhasil diputar dianggap sudah membuka kunci.
    */
    const unlock = () => {
      const a = audioRef.current;
      if (unlockedRef.current || !a) return;
      if (!a.paused) { unlockedRef.current = true; return; }
      const putaranSaatUnlock = putaranRef.current;
      a.muted = true;
      a.play().then(() => {
        //  Notifikasi asli mulai berbunyi selama unlock berjalan -> biarkan.
        if (putaranRef.current === putaranSaatUnlock) { a.pause(); a.currentTime = 0; }
        a.muted = false;
        unlockedRef.current = true;
      }).catch(() => { a.muted = false; /* unlock dicoba lagi di interaksi berikutnya */ });
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted(m => {
      const next = !m;
      try { localStorage.setItem(KUNCI_MUTE, next ? '1' : '0'); } catch { /* localStorage tidak tersedia - lanjut tanpa disimpan */ }
      return next;
    });
  }, []);

  const playIfAllowed = useCallback(() => {
    if (muted || !audioRef.current) return;
    const sekarang = Date.now();
    let terakhir = terakhirRef.current;
    try { terakhir = Math.max(terakhir, Number(localStorage.getItem(KUNCI_TERAKHIR)) || 0); } catch { /* localStorage tidak tersedia */ }
    if (sekarang - terakhir < JEDA_BUNYI_MS) return;
    terakhirRef.current = sekarang;
    try { localStorage.setItem(KUNCI_TERAKHIR, String(sekarang)); } catch { /* localStorage tidak tersedia */ }
    /*
      play() mengembalikan Promise - penolakannya (NotAllowedError saat user
      belum berinteraksi dengan halaman) TIDAK tertangkap try/catch, jadi
      harus ditangkap lewat .catch() supaya tidak jadi uncaught exception.
    */
    const a = audioRef.current;
    putaranRef.current += 1;
    try {
      a.muted = false;
      a.currentTime = 0;
      a.play().then(() => { unlockedRef.current = true; }).catch(() => { /* autoplay ditolak - abaikan */ });
    } catch { /* abaikan - jangan sampai galat audio memutus alur notifikasi */ }
  }, [muted]);

  return { muted, toggleMuted, playIfAllowed };
}
