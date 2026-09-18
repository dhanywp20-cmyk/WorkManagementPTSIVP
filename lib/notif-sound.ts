'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Alarm suara notifikasi - dipakai NotificationBar (dashboard) supaya orang
 * yang membiarkan tab ini terbuka seharian tetap sadar ada ticket/notifikasi
 * baru tanpa harus melirik layar terus-menerus.
 *
 * Suaranya di-embed sebagai data URI (bukan berkas terpisah di /public) -
 * dua nada pendek, generate sekali lewat skrip lokal, supaya tidak nambah
 * permintaan jaringan tiap kali dashboard dibuka.
 */
const NOTIF_SOUND_DATA_URI = 'data:audio/wav;base64,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';

const KUNCI_MUTE = 'wm_notif_sound_muted';

export function useNotifSoundAlarm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(KUNCI_MUTE) === '1'; } catch { return false; }
  });

  useEffect(() => {
    audioRef.current = new Audio(NOTIF_SOUND_DATA_URI);
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
