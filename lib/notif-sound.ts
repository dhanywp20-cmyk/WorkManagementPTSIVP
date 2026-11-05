'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { dengarSuaraNotif, muatSuaraNotif, suaraNotif, sumberSuara } from './suara-notif';

const KUNCI_MUTE = 'wm_notif_sound_muted';

const JEDA_BUNYI_MS = 10_000;
const KUNCI_TERAKHIR = 'wm_notif_sound_terakhir';

export function useNotifSoundAlarm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const terakhirRef = useRef(0);
  const putaranRef = useRef(0);
  const [muted, setMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(KUNCI_MUTE) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const awal = suaraNotif();
    audioRef.current = new Audio(sumberSuara(awal));
    audioRef.current.preload = 'auto';
    audioRef.current.volume = awal.volume;
    const terapkan = () => {
      const a = audioRef.current, s = suaraNotif();
      if (!a) return;
      a.volume = s.volume;
      const src = new URL(sumberSuara(s), location.href).href;
      if (a.src !== src && a.paused) { a.src = src; a.load(); }
    };
    const lepasPengaturan = dengarSuaraNotif(terapkan);
    void muatSuaraNotif().then(terapkan);
    const unlock = () => {
      const a = audioRef.current;
      if (unlockedRef.current || !a) return;
      if (!a.paused) { unlockedRef.current = true; return; }
      const putaranSaatUnlock = putaranRef.current;
      a.muted = true;
      a.play().then(() => {
        if (putaranRef.current === putaranSaatUnlock) { a.pause(); a.currentTime = 0; }
        a.muted = false;
        unlockedRef.current = true;
      }).catch(() => { a.muted = false;  });
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      lepasPengaturan();
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted(m => {
      const next = !m;
      try { localStorage.setItem(KUNCI_MUTE, next ? '1' : '0'); } catch {  }
      return next;
    });
  }, []);

  const playIfAllowed = useCallback(() => {
    if (muted || !audioRef.current) return;
    const sekarang = Date.now();
    let terakhir = terakhirRef.current;
    try { terakhir = Math.max(terakhir, Number(localStorage.getItem(KUNCI_TERAKHIR)) || 0); } catch {  }
    if (sekarang - terakhir < JEDA_BUNYI_MS) return;
    terakhirRef.current = sekarang;
    try { localStorage.setItem(KUNCI_TERAKHIR, String(sekarang)); } catch {  }
    const a = audioRef.current;
    putaranRef.current += 1;
    try {
      a.muted = false;
      a.currentTime = 0;
      a.play().then(() => { unlockedRef.current = true; }).catch(() => {  });
    } catch {  }
  }, [muted]);

  return { muted, toggleMuted, playIfAllowed };
}
