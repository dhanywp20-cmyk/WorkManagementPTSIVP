'use client';

import { useEffect, useState } from 'react';
import { SESSION_DURATION_MS } from '@/lib/constants';

const WARN_BEFORE_MS = 5 * 60 * 1000; // tampilkan peringatan 5 menit sebelum expired
const CHECK_INTERVAL_MS = 30_000;

export default function SessionExpiryBanner() {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [extended, setExtended] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        const savedTime = sessionStorage.getItem('ivp_login_time');
        if (!savedTime) return;
        const loginTime = parseInt(savedTime, 10);
        const expiresAt = loginTime + SESSION_DURATION_MS;
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
          setMinutesLeft(0);
        } else if (remaining <= WARN_BEFORE_MS) {
          setMinutesLeft(Math.ceil(remaining / 60_000));
        } else {
          setMinutesLeft(null);
        }
      } catch { }
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [extended]);

  const handleExtend = async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        sessionStorage.setItem('ivp_login_time', String(Date.now()));
        setExtended(true);
        setMinutesLeft(null);
        setTimeout(() => setExtended(false), 3000);
      }
    } catch { }
  };

  if (minutesLeft === null) return null;

  if (minutesLeft === 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[500] bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg">
        <span>⏰ Sesi Anda telah berakhir. Silakan login ulang.</span>
        <button onClick={() => { window.location.href = '/dashboard'; }} className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-50 transition-all">
          Login Ulang
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[500] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg">
      {extended ? (
        <span>✅ Sesi berhasil diperpanjang!</span>
      ) : (
        <>
          <span>⚠️ Sesi Anda akan berakhir dalam <strong>{minutesLeft} menit</strong></span>
          <button onClick={handleExtend} className="bg-white text-amber-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-50 transition-all">
            Perpanjang Sesi
          </button>
        </>
      )}
    </div>
  );
}
