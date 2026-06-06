'use client';
import { useState, useEffect, useCallback } from 'react';
import { User } from './shared';

// ─── Tour Steps ────────────────────────────────────────────────────────────────

interface TourStep {
  id: string;
  icon: string;
  title: string;
  desc: string;
  highlight?: string; // CSS selector atau keyword untuk highlight area
  position: 'center' | 'top' | 'bottom';
  color: string;
  bg: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    icon: '👋',
    title: 'Selamat datang di Work Management Platform!',
    desc: 'Platform terpadu IndoVisual untuk mengelola jadwal, proyek, tiket, dan laporan tim PTS. Mari kami tunjukkan cara menggunakannya — hanya butuh 1 menit!',
    position: 'center',
    color: '#be123c',
    bg: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
  },
  {
    id: 'menu-cards',
    icon: '🗂️',
    title: 'Menu Utama — Pilih Modul',
    desc: 'Halaman utama berisi kartu-kartu menu sesuai akses Anda. Klik kartu untuk membuka modul. Setiap modul memiliki fungsi berbeda — dari form proyek hingga jadwal piket.',
    position: 'center',
    color: '#0891b2',
    bg: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
  },
  {
    id: 'reminder',
    icon: '🗓️',
    title: 'Reminder Schedule',
    desc: 'Jadwal kegiatan tim PTS: Demo Product, Meeting & Survey, Konfigurasi, Training. Anda bisa request jadwal dari sini dan melihat status penyelesaiannya.',
    position: 'center',
    color: '#0f766e',
    bg: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)',
  },
  {
    id: 'ticket',
    icon: '🎫',
    title: 'Ticket Troubleshooting',
    desc: 'Laporkan masalah teknis produk di sini. Isi detail masalah, assign ke tim PTS, dan pantau statusnya dari Open hingga Solved — lengkap dengan SLA countdown.',
    position: 'center',
    color: '#be123c',
    bg: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
  },
  {
    id: 'form-bast',
    icon: '⭐',
    title: 'Form Review Demo & BAST',
    desc: 'Setelah demo produk atau serah terima (BAST), isi form review di sini. Berikan penilaian (grade) untuk knowledge produk dan training customer.',
    position: 'center',
    color: '#d97706',
    bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
  },
  {
    id: 'require-project',
    icon: '🏗️',
    title: 'Request Design Project',
    desc: 'Butuh desain ruangan atau BOQ? Buat request di sini. Upload foto survei dan file BOQ, lalu tim IVP akan memproses dan memberikan hasilnya melalui platform.',
    position: 'center',
    color: '#7c3aed',
    bg: 'linear-gradient(135deg, #faf5ff, #ede9fe)',
  },
  {
    id: 'search',
    icon: '🔍',
    title: 'Global Search — Cari Apa Saja',
    desc: 'Gunakan tombol Search di header (atau tekan Ctrl+K / ⌘K) untuk mencari ticket, reminder, project, dan data lain di seluruh platform sekaligus.',
    position: 'center',
    color: '#374151',
    bg: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
  },
  {
    id: 'profile',
    icon: '👤',
    title: 'Profil & Pengaturan Akun',
    desc: 'Klik "User Profile" di header untuk menambahkan nomor WhatsApp Anda. Nomor ini dipakai untuk notifikasi otomatis ketika ada update ticket atau jadwal.',
    position: 'center',
    color: '#065f46',
    bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
  },
  {
    id: 'done',
    icon: '🚀',
    title: 'Siap digunakan!',
    desc: 'Anda sudah siap! Jika ingin melihat panduan ini lagi, klik tombol "Jelajahi Platform" di pojok kanan bawah halaman utama.',
    position: 'center',
    color: '#be123c',
    bg: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
  },
];

// ─── Storage key ──────────────────────────────────────────────────────────────

const getTourKey = (userId: string) => `pts_tour_done_${userId}`;

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current, color }: { total: number; current: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            background: i === current ? color : `${color}40`,
          }} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface OnboardingTourProps {
  currentUser: User;
  /** Paksa tampil (dari tombol "Jelajahi Platform") */
  forceShow?: boolean;
  onDone?: () => void;
}

export default function OnboardingTour({ currentUser, forceShow, onDone }: OnboardingTourProps) {
  const [visible, setVisible]   = useState(false);
  const [step, setStep]         = useState(0);
  const [animDir, setAnimDir]   = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);

  const tourKey = getTourKey(currentUser.id);

  // ── Show logic: tampil jika belum pernah selesai ATAU force ──
  useEffect(() => {
    if (forceShow) { setStep(0); setVisible(true); return; }
    try {
      const done = localStorage.getItem(tourKey);
      if (!done) { setStep(0); setVisible(true); }
    } catch { /* ignore */ }
  }, [forceShow, tourKey]);

  const markDone = useCallback(() => {
    try { localStorage.setItem(tourKey, '1'); } catch { /* ignore */ }
  }, [tourKey]);

  const close = useCallback(() => {
    setVisible(false);
    markDone();
    onDone?.();
  }, [markDone, onDone]);

  const goTo = useCallback((nextStep: number, dir: 'next' | 'prev') => {
    if (animating) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 180);
  }, [animating]);

  const next = () => {
    if (step < TOUR_STEPS.length - 1) goTo(step + 1, 'next');
    else close();
  };
  const prev = () => {
    if (step > 0) goTo(step - 1, 'prev');
  };

  if (!visible) return null;

  const s = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  // Slide animation
  const slideStyle: React.CSSProperties = animating
    ? {
        opacity: 0,
        transform: animDir === 'next' ? 'translateX(20px)' : 'translateX(-20px)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
      }
    : {
        opacity: 1,
        transform: 'translateX(0)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[210]"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
        onClick={close} />

      {/* Tour card */}
      <div className="fixed inset-0 z-[211] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md"
          style={{ animation: 'dropIn 0.25s ease-out' }}>

          {/* Step number + skip */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] font-bold text-white/60 tracking-widest uppercase">
              Langkah {step + 1} dari {TOUR_STEPS.length}
            </span>
            <button onClick={close}
              className="text-[11px] font-semibold text-white/60 hover:text-white transition-all px-2 py-1 rounded-lg hover:bg-white/10">
              Lewati tour →
            </button>
          </div>

          {/* Card */}
          <div className="rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: 'white', border: `2px solid ${s.color}30` }}>

            {/* Color header */}
            <div className="px-8 pt-8 pb-6 flex flex-col items-center text-center"
              style={{ background: s.bg }}>
              <div className="text-6xl mb-4" style={{ animation: 'bounceIn 0.4s ease' }}>
                {s.icon}
              </div>
              <div style={slideStyle}>
                <h2 className="text-lg font-black text-slate-800 leading-snug">{s.title}</h2>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-6">
              <div style={slideStyle}>
                <p className="text-sm text-slate-600 leading-relaxed text-center">{s.desc}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 pb-7 flex flex-col gap-4 items-center">
              {/* Progress */}
              <ProgressDots total={TOUR_STEPS.length} current={step} color={s.color} />

              {/* Buttons */}
              <div className="flex items-center gap-3 w-full">
                {step > 0 && (
                  <button onClick={prev}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: '#f1f5f9', color: '#64748b' }}>
                    ← Kembali
                  </button>
                )}
                <button onClick={next}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all text-white shadow-md"
                  style={{ background: s.color, boxShadow: `0 4px 14px ${s.color}40` }}>
                  {isLast ? '🚀 Mulai Sekarang!' : 'Lanjut →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounceIn {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}

// ─── Jelajahi Platform Button ─────────────────────────────────────────────────

export function JelajahiButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95"
      style={{ background: 'linear-gradient(135deg,#be123c,#9f1239)', boxShadow: '0 4px 20px rgba(190,18,60,0.4)' }}
      title="Buka kembali panduan platform">
      <span className="text-base">🗺️</span>
      <span className="hidden sm:inline">Jelajahi Platform</span>
    </button>
  );
}
