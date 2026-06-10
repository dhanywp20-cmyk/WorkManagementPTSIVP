'use client';
import { useState, useEffect, useCallback } from 'react';
import { User } from './shared';

// ─── Tour step definitions ────────────────────────────────────────────────────

interface TourStep {
  id: string;
  menuKey: string | null; // null = center modal (welcome / done)
  icon: string;
  title: string;
  desc: string;
  color: string;
  accentBg: string;
}

const ALL_STEPS: TourStep[] = [
  {
    id: 'welcome', menuKey: null, icon: '👋',
    title: 'Selamat datang di Work Management Platform!',
    desc: 'Platform terpadu IndoVisual untuk tim PTS — kelola jadwal, tiket, proyek, dan laporan harian dalam satu tempat. Panduan ini akan memperkenalkan setiap modul. Klik tombol menu di sidebar untuk langsung membukanya.',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
  },
  {
    id: 'learning-center', menuKey: 'learning-center', icon: '🎓',
    title: 'Learning Center',
    desc: '📚 Platform training & quiz online tim PTS.\n\n▶ Cara pakai: Klik "Quiz Saya" untuk melihat kuis aktif → klik "Mulai Quiz" → jawab soal → klik "Submit" untuk mengirim hasil.\n\n🔘 Tombol penting: Mulai Quiz · Lihat Materi · Riwayat Nilai. Admin: Tambah Materi, Buat Quiz, Assign Quiz ke Tim.',
    color: '#1d4ed8', accentBg: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
  },
  {
    id: 'tech-note', menuKey: 'tech-note', icon: '📝',
    title: 'Tech Note R&D',
    desc: '🔬 Dokumentasi teknikal produk & riset tim PTS.\n\n▶ Cara submit: Klik "Tambah Tech Note" → isi judul & isi → pilih kategori → klik "Submit" untuk menyimpan.\n\n🔘 Tombol: Tambah Tech Note · Edit · Hapus · Approve (Supervisor). Note yang di-Approve dihitung sebagai KPI.',
    color: '#be185d', accentBg: 'linear-gradient(135deg,#fdf2f8,#fce7f3)',
  },
  {
    id: 'reminder-schedule', menuKey: 'reminder-schedule', icon: '🗓️',
    title: 'Reminder Schedule',
    desc: '🗓️ Jadwal Demo, Meeting, Konfigurasi & Training.\n\n▶ Cara submit jadwal (Sales): Klik "Request Jadwal" → isi nama project, tanggal, dan detail → klik "Kirim Request".\n\n▶ Cara update status (PTS): Klik ikon ✓ untuk Selesai, ✏ Edit, atau 🗑 Hapus. Klik nama jadwal untuk melihat detail lengkap.',
    color: '#0f766e', accentBg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
  },
  {
    id: 'request-design-project', menuKey: 'request-design-project', icon: '🏗️',
    title: 'Request Design Project',
    desc: '🏗️ Request desain ruangan, BOQ, dan proposal teknis.\n\n▶ Cara submit: Klik "Buat Request" → isi detail proyek dan kebutuhan → upload foto/dokumen jika perlu → klik "Kirim".\n\n🔘 Tombol: Buat Request · Lihat Detail · Update Status. Tim IVP akan memproses dan mengunggah hasil desain.',
    color: '#7c3aed', accentBg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
  },
  {
    id: 'form-bast', menuKey: 'form-bast', icon: '⭐',
    title: 'Form Review Demo & BAST',
    desc: '⭐ Penilaian kualitas Demo Produk dan serah terima (BAST).\n\n▶ Cara submit review: Klik "Isi Review" → pilih nama handler → beri rating bintang 1-5 per kategori → isi catatan → klik "Submit Review".\n\n🔘 Tombol: Isi Review · Lihat Rekap · Export. Rating di bawah 3 bintang dihitung sebagai peringatan KPI.',
    color: '#d97706', accentBg: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
  },
  {
    id: 'ticket-troubleshooting', menuKey: 'ticket-troubleshooting', icon: '🎫',
    title: 'Ticket Troubleshooting',
    desc: '🎫 Pelaporan dan penanganan masalah teknis produk.\n\n▶ Cara buat tiket: Klik "Buat Tiket" → isi masalah, lokasi, dan assign ke PTS → klik "Submit". Pantau status: Open → In Progress → Solved.\n\n🔘 Tombol: Buat Tiket · Assign · Update Status · Selesaikan. SLA countdown otomatis — tiket overdue mengurangi KPI.',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
  },
  {
    id: 'picket-showroom', menuKey: 'picket-showroom', icon: '🏪',
    title: 'Piket Showroom',
    desc: '🏪 Jadwal piket showroom tim PTS IVP, UMP & MLDS.\n\n▶ Cara isi kehadiran: Buka tanggal hari ini → klik "Check-in" jika hadir, atau centang nama Anda → klik "Simpan".\n\n🔘 Tombol: Check-in · Lihat Jadwal · Export Rekap. Data piket digunakan sebagai salah satu komponen laporan bulanan KPI.',
    color: '#0f766e', accentBg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
  },
  {
    id: 'daily-report', menuKey: 'daily-report', icon: '📈',
    title: 'Daily Report',
    desc: '📈 Catatan aktivitas harian & performance tim.\n\n▶ Cara isi laporan: Klik "Tambah Laporan" → isi aktivitas hari ini, hasil, dan tantangan → klik "Submit Laporan".\n\n🔘 Tombol: Tambah Laporan · Lihat Riwayat · Export. Laporan terakumulasi otomatis setiap hari — admin bisa melihat rekap per periode.',
    color: '#059669', accentBg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
  },
  {
    id: 'unit-movement', menuKey: 'unit-movement', icon: '🚚',
    title: 'Unit Movement Log',
    desc: '🚚 Tracking keluar-masuk unit demo & peralatan.\n\n▶ Cara catat gerakan: Klik "Catat Keluar/Masuk" → pilih unit, tujuan, dan tanggal → klik "Simpan".\n\n🔘 Tombol: Catat Keluar · Catat Masuk · Lihat Riwayat · Export. Semua gerakan unit tercatat lengkap untuk menjaga akuntabilitas inventori tim.',
    color: '#d97706', accentBg: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
  },
  {
    id: 'incentive-pts', menuKey: 'incentive-pts', icon: '💰',
    title: 'Incentive PTS',
    desc: '💰 Kalkulasi & rekap incentive tim per project.\n\n▶ Data project masuk otomatis dari Reminder Schedule (kategori Training). Admin: klik "Input Biaya" untuk memasukkan nominal → klik "Simpan". Klik "Tandai Lunas" setelah pembayaran.\n\n🔘 Tombol: Input Biaya · Set Tim Backup · Tandai Lunas · Export Excel. Pembagian otomatis ke handler & backup.',
    color: '#6d28d9', accentBg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
  },
  {
    id: 'done', menuKey: null, icon: '🚀',
    title: 'Siap menggunakan semua platform!',
    desc: '✅ Anda sudah mengenal semua fitur Work Management Platform IndoVisual.\n\nTips: Klik tombol menu di sidebar untuk membuka platform. Klik "Jelajahi Platform" kapan saja untuk membuka panduan ini kembali. Selamat bekerja, tim! 💪',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
  },
];

const getTourKey = (userId: string) => `pts_tour_done_${userId}`;

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressDots({ total, current, color }: { total: number; current: number; color: string }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 14 : 4,
            height: 4,
            background: i === current ? color : `${color}30`,
          }} />
      ))}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  currentUser: User;
  visibleMenuKeys: string[];
  forceShow?: boolean;
  onDone?: () => void;
  /** Called with menu key when step changes, null when tour closes */
  onHighlightKey?: (key: string | null) => void;
  /** Called whenever the tour card becomes visible or hidden */
  onVisibleChange?: (visible: boolean) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingTour({ currentUser, visibleMenuKeys, forceShow, onDone, onHighlightKey, onVisibleChange }: Props) {
  const [visible, setVisible]     = useState(false);
  const [step, setStep]           = useState(0);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir]     = useState<'next' | 'prev'>('next');
  const [popupPos, setPopupPos]   = useState<{ top: number; left: number } | null>(null);

  const tourKey = getTourKey(String(currentUser.id));
  const menuCount = visibleMenuKeys.length;

  // Filter steps to menus visible to this user (always include welcome + done)
  const steps = ALL_STEPS.filter(s => s.menuKey === null || visibleMenuKeys.includes(s.menuKey));
  const s = steps[Math.min(step, steps.length - 1)] ?? steps[0];
  const isLast = step >= steps.length - 1;

  // ── Notify parent when visible state changes ──
  useEffect(() => {
    onVisibleChange?.(visible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Auto-show: wait for menus to load, then check localStorage ──
  useEffect(() => {
    // Wait until sidebar menus are populated (avoids showing with 0 steps)
    if (menuCount === 0) return;
    if (forceShow) { setStep(0); setVisible(true); return; }
    try {
      if (!localStorage.getItem(tourKey)) { setStep(0); setVisible(true); }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceShow, tourKey, menuCount]);

  // ── Position popup next to highlighted sidebar item ──
  useEffect(() => {
    if (!visible || !s?.menuKey) {
      setPopupPos(null);
      onHighlightKey?.(s?.menuKey ? s.menuKey : null);
      if (!visible) onHighlightKey?.(null);
      return;
    }
    const recompute = () => {
      const el = document.getElementById(`tour-menu-${s.menuKey}`);
      if (el) {
        const r  = el.getBoundingClientRect();
        const vH = window.innerHeight;
        // Clamp vertically so card doesn't go off-screen
        const top = Math.max(80, Math.min(r.top + r.height / 2, vH - 200));
        setPopupPos({ top, left: r.right + 20 });
      } else {
        setPopupPos(null); // fallback: center modal
      }
    };
    recompute();
    onHighlightKey?.(s.menuKey);
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step]);

  const close = useCallback(() => {
    setVisible(false);
    onHighlightKey?.(null);
    try { localStorage.setItem(tourKey, '1'); } catch { /* ignore */ }
    onDone?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourKey, onDone]);

  const goTo = useCallback((next: number, dir: 'next' | 'prev') => {
    if (animating) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 200);
  }, [animating]);

  const goNext = () => { if (!isLast) goTo(step + 1, 'next'); else close(); };
  const goPrev = () => { if (step > 0) goTo(step - 1, 'prev'); };

  if (!visible) return null;

  // ── Whether to use sidebar mode or center modal ──
  const isSidebar = !!s.menuKey && popupPos !== null;

  // Slide animation for text content
  const slideStyle: React.CSSProperties = animating
    ? { opacity: 0, transform: animDir === 'next' ? 'translateX(10px)' : 'translateX(-10px)', transition: 'all 0.18s ease' }
    : { opacity: 1, transform: 'translateX(0)', transition: 'all 0.22s ease' };

  return (
    <>
      {/* ── Backdrop ── */}
      <div className="fixed inset-0 z-[210]"
        style={{ background: 'rgba(2,6,23,0.65)', backdropFilter: 'blur(3px)' }}
        onClick={close} />

      {/* ── Popup container ── */}
      <div className="fixed z-[211] pointer-events-none"
        style={isSidebar
          ? { top: popupPos.top, left: popupPos.left, transform: 'translateY(-50%)' }
          : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
        }
      >
        {/* Animated wrapper (scale-in) — SEPARATE from translate so they don't fight */}
        <div className="pointer-events-auto" style={{ width: 308, animation: 'tourCardIn 0.28s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}>

          {/* Left-pointing arrow for sidebar mode */}
          {isSidebar && (
            <div style={{
              position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: `8px solid white`,
              filter: `drop-shadow(-3px 0px 4px ${s.color}30)`,
            }} />
          )}

          {/* ── Card ── */}
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: 'white',
              boxShadow: `0 20px 60px rgba(0,0,0,0.25), 0 0 0 1.5px ${s.color}20`,
            }}>

            {/* Top color accent strip */}
            <div className="h-1" style={{ background: `linear-gradient(90deg,${s.color},${s.color}70,transparent)` }} />

            {/* Gradient header */}
            <div className="px-5 pt-4 pb-3.5" style={{ background: s.accentBg }}>
              <div className="flex items-start gap-3" style={slideStyle}>
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{ background: `${s.color}18`, border: `1px solid ${s.color}20` }}>
                  {s.icon}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] mb-0.5"
                    style={{ color: `${s.color}99` }}>
                    Langkah {step + 1} dari {steps.length}
                  </p>
                  <h3 className="font-black text-slate-800 leading-snug" style={{ fontSize: 13 }}>
                    {s.title}
                  </h3>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-3.5">
              <p className="text-slate-500 leading-relaxed" style={{ fontSize: 12.5, ...slideStyle }}>
                {s.desc}
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-1">
              <ProgressDots total={steps.length} current={step} color={s.color} />
              <div className="flex items-center gap-2 mt-3">
                {/* Skip */}
                <button onClick={close}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 flex-shrink-0"
                  style={{ background: '#f1f5f9', color: '#64748b' }}>
                  Lewati
                </button>
                {/* Back */}
                {step > 0 && (
                  <button onClick={goPrev}
                    className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80 flex-shrink-0"
                    style={{ background: `${s.color}12`, color: s.color }}>
                    ← Kembali
                  </button>
                )}
                {/* Next */}
                <button onClick={goNext}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: s.color, boxShadow: `0 4px 14px ${s.color}40` }}>
                  {isLast ? '🚀 Mulai Sekarang!' : 'Lanjut →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Global keyframes (injected while tour is visible) ── */}
      <style>{`
        @keyframes tourCardIn {
          0%   { opacity: 0; transform: scale(0.85) translateY(6px); }
          100% { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes tourMenuPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(250,200,21,0.65), 0 0 0 0 rgba(250,200,21,0.25); }
          50%     { box-shadow: 0 0 0 4px rgba(250,200,21,0.30), 0 0 0 10px rgba(250,200,21,0.08); }
        }
      `}</style>
    </>
  );
}

// ─── "Jelajahi Platform" floating button ─────────────────────────────────────

export function JelajahiButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-white shadow-xl transition-all hover:scale-105 active:scale-95"
      style={{
        background: 'linear-gradient(135deg,#be123c,#9f1239)',
        boxShadow: '0 4px 20px rgba(190,18,60,0.45)',
      }}
      title="Buka kembali panduan platform">
      <span className="text-base">🗺️</span>
      <span className="hidden sm:inline">Jelajahi Platform</span>
    </button>
  );
}
