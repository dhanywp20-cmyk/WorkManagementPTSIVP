'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { User } from './shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowChip {
  icon: string;
  label: string;
  state: 'normal' | 'active' | 'done' | 'wait';
}

interface TourStep {
  id: string;
  menuKey: string | null;
  icon: string;
  title: string;
  desc: string;
  color: string;
  accentBg: string;
  flow?: FlowChip[];
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const ALL_STEPS: TourStep[] = [
  {
    id: 'welcome', menuKey: null, icon: '👋',
    title: 'Selamat datang di Work Management!',
    desc: 'Platform terpadu IndoVisual untuk tim PTS — kelola jadwal, tiket, proyek, dan laporan harian. Panduan ini akan memandu kamu langkah demi langkah.',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
  },
  {
    id: 'learning-center', menuKey: 'learning-center', icon: '🎓',
    title: 'Learning Center',
    desc: 'Platform training & quiz online tim PTS. Selesaikan kuis yang di-assign oleh admin dan lihat perkembanganmu.',
    color: '#1d4ed8', accentBg: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
    flow: [
      { icon: '📚', label: 'Buka Quiz', state: 'normal' },
      { icon: '▶', label: 'Mulai', state: 'active' },
      { icon: '✏️', label: 'Jawab Soal', state: 'normal' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '🏆', label: 'Nilai', state: 'done' },
    ],
  },
  {
    id: 'tech-note', menuKey: 'tech-note', icon: '📝',
    title: 'Tech Note R&D',
    desc: 'Dokumentasi teknikal & riset. Note yang di-approve supervisor dihitung sebagai KPI.',
    color: '#be185d', accentBg: 'linear-gradient(135deg,#fdf2f8,#fce7f3)',
    flow: [
      { icon: '➕', label: 'Tambah Note', state: 'normal' },
      { icon: '✏️', label: 'Isi Konten', state: 'active' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '⏳', label: 'Review', state: 'wait' },
      { icon: '✅', label: 'Approved', state: 'done' },
    ],
  },
  {
    id: 'reminder-schedule', menuKey: 'reminder-schedule', icon: '🗓️',
    title: 'Request Schedule',
    desc: 'Jadwal Demo, Meeting, Konfigurasi & Training. Sales request jadwal, tim PTS update status.',
    color: '#0f766e', accentBg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
    flow: [
      { icon: '📋', label: 'Request Jadwal', state: 'normal' },
      { icon: '📤', label: 'Kirim', state: 'active' },
      { icon: '⏳', label: 'Menunggu', state: 'wait' },
      { icon: '🔧', label: 'On Progress', state: 'wait' },
      { icon: '✅', label: 'Selesai', state: 'done' },
    ],
  },
  {
    id: 'request-design-project', menuKey: 'request-design-project', icon: '🏗️',
    title: 'Request Design Project',
    desc: 'Request desain ruangan, BOQ, dan proposal teknis dari tim IVP.',
    color: '#7c3aed', accentBg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
    flow: [
      { icon: '📋', label: 'Buat Request', state: 'normal' },
      { icon: '📝', label: 'Isi Detail', state: 'active' },
      { icon: '📤', label: 'Kirim', state: 'active' },
      { icon: '⏳', label: 'Processing', state: 'wait' },
      { icon: '✅', label: 'Done', state: 'done' },
    ],
  },
  {
    id: 'form-bast', menuKey: 'form-bast', icon: '⭐',
    title: 'Form Review Demo & BAST',
    desc: 'Penilaian kualitas Demo Produk dan serah terima. Rating di bawah 3★ mengurangi KPI.',
    color: '#d97706', accentBg: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
    flow: [
      { icon: '⭐', label: 'Isi Review', state: 'normal' },
      { icon: '⭐⭐', label: 'Beri Rating', state: 'active' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '✅', label: 'Tersimpan', state: 'done' },
    ],
  },
  {
    id: 'ticket-troubleshooting', menuKey: 'ticket-troubleshooting', icon: '🎫',
    title: 'Ticket Troubleshooting',
    desc: 'Pelaporan masalah teknis produk. SLA countdown otomatis — tiket overdue mengurangi KPI.',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
    flow: [
      { icon: '🎫', label: 'Buat Tiket', state: 'normal' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '⏳', label: 'In Progress', state: 'wait' },
      { icon: '✅', label: 'Solved', state: 'done' },
    ],
  },
  {
    id: 'picket-showroom', menuKey: 'picket-showroom', icon: '🏪',
    title: 'Piket Showroom',
    desc: 'Jadwal piket showroom tim PTS IVP, UMP & MVI. Data piket masuk ke laporan KPI bulanan.',
    color: '#0f766e', accentBg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
    flow: [
      { icon: '📅', label: 'Lihat Jadwal', state: 'normal' },
      { icon: '✔️', label: 'Check-in', state: 'active' },
      { icon: '💾', label: 'Simpan', state: 'active' },
      { icon: '✅', label: 'Tercatat', state: 'done' },
    ],
  },
  {
    id: 'daily-report', menuKey: 'daily-report', icon: '📈',
    title: 'Daily Report',
    desc: 'Catatan aktivitas harian & performa tim. Laporan terakumulasi otomatis setiap hari.',
    color: '#059669', accentBg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
    flow: [
      { icon: '📈', label: 'Tambah Laporan', state: 'normal' },
      { icon: '✏️', label: 'Isi Aktivitas', state: 'active' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '✅', label: 'Tersimpan', state: 'done' },
    ],
  },
  {
    id: 'unit-movement', menuKey: 'unit-movement', icon: '🚚',
    title: 'Unit Movement Log',
    desc: 'Tracking keluar-masuk unit demo & peralatan. Semua gerakan tercatat untuk akuntabilitas inventori.',
    color: '#d97706', accentBg: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
    flow: [
      { icon: '🚚', label: 'Catat Keluar', state: 'normal' },
      { icon: '📝', label: 'Isi Detail', state: 'active' },
      { icon: '💾', label: 'Simpan', state: 'active' },
      { icon: '✅', label: 'Tercatat', state: 'done' },
    ],
  },
  {
    id: 'incentive-pts', menuKey: 'incentive-pts', icon: '💰',
    title: 'Incentive PTS',
    desc: 'Kalkulasi & rekap incentive tim per project. Admin input biaya, sistem hitung pembagian otomatis.',
    color: '#6d28d9', accentBg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
    flow: [
      { icon: '📋', label: 'Data Project', state: 'normal' },
      { icon: '💵', label: 'Input Biaya', state: 'active' },
      { icon: '🧮', label: 'Auto Hitung', state: 'wait' },
      { icon: '✅', label: 'Lunas', state: 'done' },
    ],
  },
  {
    id: 'done', menuKey: null, icon: '🚀',
    title: 'Siap menggunakan semua platform!',
    desc: 'Kamu sudah mengenal semua fitur Work Management Platform. Klik menu di sidebar untuk memulai. Sampai jumpa di tour berikutnya! 💪',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
  },
];

const getTourKey = (userId: string) => `pts_tour_done_${userId}`;

// ─── Flow chip color ──────────────────────────────────────────────────────────

function chipStyle(state: FlowChip['state']): React.CSSProperties {
  if (state === 'done')   return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
  if (state === 'active') return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
  if (state === 'wait')   return { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
}

// ─── Mini flow visualization ──────────────────────────────────────────────────

function FlowViz({ flow }: { flow: FlowChip[] }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, marginTop: 8 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
        Alur penggunaan
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {flow.map((chip, i) => (
          <React.Fragment key={i}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
              ...chipStyle(chip.state),
            }}>
              <span style={{ fontSize: 12 }}>{chip.icon}</span>
              {chip.label}
            </span>
            {i < flow.length - 1 && (
              <span style={{ color: '#cbd5e1', fontSize: 10, fontWeight: 700 }}>›</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current, color }: { total: number; current: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 999,
          transition: 'all 0.3s',
          width: i === current ? 14 : 4,
          height: 4,
          background: i === current ? color : `${color}30`,
        }} />
      ))}
    </div>
  );
}

// ─── Spotlight overlay (4-quad technique) ────────────────────────────────────

function SpotlightOverlay({ rect, onClick }: { rect: DOMRect; onClick: () => void }) {
  const pad = 10;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const dark = 'rgba(2,6,23,0.78)';

  return (
    <>
      {/* Top */}
      <div onClick={onClick} style={{ position: 'fixed', inset: 0, bottom: `calc(100vh - ${y}px)`, background: dark, zIndex: 1500 }} />
      {/* Bottom */}
      <div onClick={onClick} style={{ position: 'fixed', inset: 0, top: y + h, background: dark, zIndex: 1500 }} />
      {/* Left */}
      <div onClick={onClick} style={{ position: 'fixed', top: y, left: 0, width: Math.max(0, x), height: h, background: dark, zIndex: 1500 }} />
      {/* Right */}
      <div onClick={onClick} style={{ position: 'fixed', top: y, left: x + w, right: 0, height: h, background: dark, zIndex: 1500 }} />
      {/* Highlight ring */}
      <div style={{
        position: 'fixed', top: y, left: x, width: w, height: h,
        borderRadius: 12, zIndex: 1501, pointerEvents: 'none',
        border: '2.5px solid rgba(251,191,36,0.9)',
        boxShadow: '0 0 0 4px rgba(251,191,36,0.2), inset 0 0 0 1px rgba(251,191,36,0.15)',
        animation: 'tourRingPulse 1.8s ease-in-out infinite',
      }} />
    </>
  );
}

// ─── Full dark backdrop (for center-mode steps) ───────────────────────────────

function FullBackdrop({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.75)', zIndex: 1500 }} />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  currentUser: User;
  visibleMenuKeys: string[];
  forceShow?: boolean;
  onDone?: () => void;
  onHighlightKey?: (key: string | null) => void;
  onVisibleChange?: (visible: boolean) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingTour({ currentUser, visibleMenuKeys, forceShow, onDone, onHighlightKey, onVisibleChange }: Props) {
  const [visible, setVisible]     = useState(false);
  const [step, setStep]           = useState(0);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir]     = useState<'next' | 'prev'>('next');
  const [popupPos, setPopupPos]   = useState<{ top: number; left: number; side: 'right' | 'left' | 'center' } | null>(null);
  const [spotRect, setSpotRect]   = useState<DOMRect | null>(null);

  const tourKey   = getTourKey(String(currentUser.id));
  const menuCount = visibleMenuKeys.length;
  const steps     = ALL_STEPS.filter(s => s.menuKey === null || visibleMenuKeys.includes(s.menuKey));
  const s         = steps[Math.min(step, steps.length - 1)] ?? steps[0];
  const isLast    = step >= steps.length - 1;

  useEffect(() => { onVisibleChange?.(visible); }, [visible]);

  useEffect(() => {
    if (menuCount === 0) return;
    if (forceShow) { setStep(0); setVisible(true); return; }
    try { if (!localStorage.getItem(tourKey)) { setStep(0); setVisible(true); } } catch { /* noop */ }
  }, [forceShow, tourKey, menuCount]);

  // ── Recompute spotlight & popup position when step changes ──
  useEffect(() => {
    if (!visible) { onHighlightKey?.(null); setSpotRect(null); setPopupPos(null); return; }
    if (!s?.menuKey) {
      // Center modal — no spotlight
      onHighlightKey?.(null);
      setSpotRect(null);
      setPopupPos({ top: 0, left: 0, side: 'center' });
      return;
    }
    const compute = () => {
      const el = document.getElementById(`tour-menu-${s.menuKey}`);
      if (!el) { setSpotRect(null); setPopupPos({ top: 0, left: 0, side: 'center' }); return; }
      const r   = el.getBoundingClientRect();
      const vW  = window.innerWidth;
      const vH  = window.innerHeight;
      const pad = 10;
      setSpotRect(r);
      // Determine which side to show popup
      const cardW = 320;
      const spaceRight = vW - (r.right + pad);
      const spaceLeft  = r.left - pad;
      let side: 'right' | 'left' | 'center' = 'center';
      let left = 0;
      if (spaceRight >= cardW + 12) { side = 'right'; left = r.right + pad + 16; }
      else if (spaceLeft >= cardW + 12) { side = 'left'; left = r.left - pad - 16 - cardW; }
      else { side = 'center'; left = Math.max(8, (vW - cardW) / 2); }
      const top = Math.max(80, Math.min(r.top + r.height / 2, vH - 280));
      setPopupPos({ top, left, side });
    };
    compute();
    onHighlightKey?.(s.menuKey);
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [visible, step]);

  const close = useCallback(() => {
    setVisible(false); setSpotRect(null); setPopupPos(null);
    onHighlightKey?.(null);
    try { localStorage.setItem(tourKey, '1'); } catch { /* noop */ }
    onDone?.();
  }, [tourKey, onDone]);

  const goTo = useCallback((next: number, dir: 'next' | 'prev') => {
    if (animating) return;
    setAnimDir(dir); setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 180);
  }, [animating]);

  const goNext = () => { if (!isLast) goTo(step + 1, 'next'); else close(); };
  const goPrev = () => { if (step > 0) goTo(step - 1, 'prev'); };

  if (!visible || !popupPos) return null;

  const isSidebar = popupPos.side !== 'center' && spotRect !== null;
  const isCenter  = popupPos.side === 'center';

  const slideStyle: React.CSSProperties = animating
    ? { opacity: 0, transform: animDir === 'next' ? 'translateX(12px)' : 'translateX(-12px)', transition: 'all 0.16s ease' }
    : { opacity: 1, transform: 'translateX(0)', transition: 'all 0.22s ease' };

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    width: 320,
    zIndex: 1502,
    ...(isCenter
      ? { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
      : { top: popupPos.top, left: popupPos.left, transform: 'translateY(-50%)' }
    ),
  };

  return (
    <>
      {/* Spotlight or full backdrop */}
      {isSidebar && spotRect
        ? <SpotlightOverlay rect={spotRect} onClick={close} />
        : <FullBackdrop onClick={close} />
      }

      {/* Tooltip arrow (sidebar mode) */}
      {isSidebar && spotRect && (
        <div style={{
          position: 'fixed',
          top: popupPos.top,
          left: popupPos.side === 'right' ? popupPos.left - 10 : popupPos.left + 320 + 2,
          transform: 'translateY(-50%)',
          width: 0, height: 0,
          borderTop: '9px solid transparent',
          borderBottom: '9px solid transparent',
          ...(popupPos.side === 'right'
            ? { borderRight: '10px solid white' }
            : { borderLeft: '10px solid white' }
          ),
          zIndex: 1503,
          filter: 'drop-shadow(-2px 0px 3px rgba(0,0,0,0.12))',
        }} />
      )}

      {/* Popup card */}
      <div style={cardStyle}>
        <div style={{
          background: 'white',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: `0 24px 64px rgba(0,0,0,0.28), 0 0 0 1.5px ${s.color}18`,
          animation: 'tourCardIn 0.26s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
        }}>

          {/* Top accent strip */}
          <div style={{ height: 3, background: `linear-gradient(90deg,${s.color},${s.color}60,transparent)` }} />

          {/* Header */}
          <div style={{ padding: '14px 16px 12px', background: s.accentBg }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, ...slideStyle }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, background: `${s.color}18`, border: `1px solid ${s.color}20`,
              }}>
                {s.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: `${s.color}99`, marginBottom: 3 }}>
                  Langkah {step + 1} dari {steps.length}
                </p>
                <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b', lineHeight: 1.35, margin: 0 }}>
                  {s.title}
                </h3>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '12px 16px 4px', ...slideStyle }}>
            <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.65, margin: 0 }}>
              {s.desc}
            </p>
            {s.flow && <FlowViz flow={s.flow} />}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 16px 16px' }}>
            <ProgressDots total={steps.length} current={step} color={s.color} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <button onClick={close} style={{
                padding: '7px 12px', borderRadius: 10, fontSize: 11.5, fontWeight: 600,
                background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer',
                transition: 'opacity 0.15s', flexShrink: 0,
              }}>
                Lewati
              </button>
              {step > 0 && (
                <button onClick={goPrev} style={{
                  padding: '7px 12px', borderRadius: 10, fontSize: 11.5, fontWeight: 600,
                  background: `${s.color}12`, color: s.color, border: 'none', cursor: 'pointer',
                  transition: 'opacity 0.15s', flexShrink: 0,
                }}>
                  ← Kembali
                </button>
              )}
              <button onClick={goNext} style={{
                flex: 1, padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: s.color, color: 'white', border: 'none', cursor: 'pointer',
                boxShadow: `0 4px 14px ${s.color}40`, transition: 'opacity 0.15s',
              }}>
                {isLast ? '🚀 Mulai Sekarang!' : 'Lanjut →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes tourCardIn {
          0%   { opacity:0; transform:scale(0.88) translateY(8px); }
          100% { opacity:1; transform:none; }
        }
        @keyframes tourRingPulse {
          0%,100% { box-shadow: 0 0 0 4px rgba(251,191,36,0.20), inset 0 0 0 1px rgba(251,191,36,0.15); }
          50%     { box-shadow: 0 0 0 8px rgba(251,191,36,0.08), inset 0 0 0 1px rgba(251,191,36,0.25); }
        }
      `}</style>
    </>
  );
}

// ─── "Jelajahi Platform" floating button ─────────────────────────────────────

/**
 * Tombol melayang "Jelajahi Platform".
 *
 * Tombol ini menempel di pojok kanan-bawah SEMUA halaman, sehingga menutupi
 * tombol aksi yang kebetulan berada di posisi sama (mis. "Simpan Nilai Essay"
 * di Learning Center). Karena panduan hanya sesekali dipakai sementara tombol
 * di bawahnya dipakai untuk bekerja, tombol ini yang mengalah: tampil penuh
 * sebentar setelah halaman dibuka, lalu menyingkir ke tepi kanan dan menyisakan
 * ikon kecil. Klik ikonnya untuk memunculkannya kembali.
 */
export function JelajahiButton({ onClick }: { onClick: () => void }) {
  const [melebar, setMelebar] = useState(true);

  // Menyingkir sendiri 5 detik setelah halaman dibuka/di-refresh. Timer di-set
  // ulang tiap kali tombol dilebarkan lagi, supaya tidak menetap menutupi layar.
  useEffect(() => {
    if (!melebar) return;
    const t = setTimeout(() => setMelebar(false), 5000);
    return () => clearTimeout(t);
  }, [melebar]);

  return (
    <button
      onClick={() => { if (melebar) onClick(); else setMelebar(true); }}
      className={`fixed bottom-6 z-[1504] flex items-center gap-2 py-2.5 text-xs font-bold text-white shadow-xl active:scale-95 ${
        melebar
          ? 'right-6 px-4 rounded-2xl hover:scale-105'
          : 'right-0 pl-3 pr-2 rounded-l-2xl opacity-60 hover:opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg,#be123c,#9f1239)',
        boxShadow: '0 4px 20px rgba(190,18,60,0.45)',
        transition: 'right 0.35s ease, opacity 0.25s ease, padding 0.35s ease, border-radius 0.35s ease',
      }}
      title={melebar ? 'Buka kembali panduan platform' : 'Tampilkan tombol Jelajahi Platform'}
      aria-label={melebar ? 'Buka panduan platform' : 'Tampilkan tombol panduan platform'}>
      <span style={{ fontSize: 16 }}>🗺️</span>
      {melebar && <span className="hidden sm:inline whitespace-nowrap">Jelajahi Platform</span>}
    </button>
  );
}
