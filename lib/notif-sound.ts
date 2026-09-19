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

export function useNotifSoundAlarm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
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
    */
    const unlock = () => {
      if (unlockedRef.current || !audioRef.current) return;
      audioRef.current.play().then(() => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        unlockedRef.current = true;
      }).catch(() => { /* biarkan - unlock akan dicoba lagi di interaksi berikutnya */ });
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
    try { audioRef.current.currentTime = 0; void audioRef.current.play(); } catch { /* abaikan - jangan sampai galat audio memutus alur notifikasi */ }
  }, [muted]);

  return { muted, toggleMuted, playIfAllowed };
}
