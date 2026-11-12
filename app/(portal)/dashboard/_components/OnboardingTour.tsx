'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { User } from './shared';
import { Ikon } from '@/components/shared/Ikon';
import { ALL_STEPS, type FlowChip } from './langkah-tour';

const getTourKey = (userId: string) => `pts_tour_done_${userId}`;

function chipStyle(state: FlowChip['state']): React.CSSProperties {
  if (state === 'done')   return { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' };
  if (state === 'active') return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
  if (state === 'wait')   return { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
}

function FlowViz({ flow }: { flow: FlowChip[] }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, marginTop: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
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
              <span style={{ fontSize: 12 }}><Ikon nama={chip.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
              {chip.label}
            </span>
            {i < flow.length - 1 && (
              <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 700 }}>›</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

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

function SpotlightOverlay({ rect, onClick }: { rect: DOMRect; onClick: () => void }) {
  const pad = 10;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const dark = 'rgba(2,6,23,0.78)';

  return (
    <>
      <div aria-hidden="true" onClick={onClick} style={{ position: 'fixed', inset: 0, bottom: `calc(100vh - ${y}px)`, background: dark, zIndex: 1500 }} />
      <div aria-hidden="true" onClick={onClick} style={{ position: 'fixed', inset: 0, top: y + h, background: dark, zIndex: 1500 }} />
      <div aria-hidden="true" onClick={onClick} style={{ position: 'fixed', top: y, left: 0, width: Math.max(0, x), height: h, background: dark, zIndex: 1500 }} />
      <div aria-hidden="true" onClick={onClick} style={{ position: 'fixed', top: y, left: x + w, right: 0, height: h, background: dark, zIndex: 1500 }} />
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

function FullBackdrop({ onClick }: { onClick: () => void }) {
  return (
    <div aria-hidden="true" onClick={onClick} style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.75)', zIndex: 1500 }} />
  );
}

interface Props {
  currentUser: User;
  visibleMenuKeys: string[];
  forceShow?: boolean;
  onDone?: () => void;
  onHighlightKey?: (key: string | null) => void;
  onVisibleChange?: (visible: boolean) => void;
}

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
    try { if (!localStorage.getItem(tourKey)) { setStep(0); setVisible(true); } } catch {  }
  }, [forceShow, tourKey, menuCount]);

  useEffect(() => {
    if (!visible) { onHighlightKey?.(null); setSpotRect(null); setPopupPos(null); return; }
    if (!s?.menuKey) {
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
    try { localStorage.setItem(tourKey, '1'); } catch {  }
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
      {isSidebar && spotRect
        ? <SpotlightOverlay rect={spotRect} onClick={close} />
        : <FullBackdrop onClick={close} />
      }

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

      <div style={cardStyle}>
        <div style={{
          background: 'white',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: `0 24px 64px rgba(0,0,0,0.28), 0 0 0 1.5px ${s.color}18`,
          animation: 'tourCardIn 0.26s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
        }}>

          <div style={{ height: 3, background: `linear-gradient(90deg,${s.color},${s.color}60,transparent)` }} />

          <div style={{ padding: '14px 16px 12px', background: s.accentBg }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, ...slideStyle }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, background: `${s.color}18`, border: `1px solid ${s.color}20`,
              }}>
                <Ikon nama={s.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: `${s.color}99`, marginBottom: 3 }}>
                  Langkah {step + 1} dari {steps.length}
                </p>
                <h3 style={{ fontSize: 13.5, fontWeight: 800, color: '#1e293b', lineHeight: 1.35, margin: 0 }}>
                  {s.title}
                </h3>
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 16px 4px', ...slideStyle }}>
            <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.65, margin: 0 }}>
              {s.desc}
            </p>
            {s.flow && <FlowViz flow={s.flow} />}
          </div>

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

export function JelajahiButton({ onClick }: { onClick: () => void }) {
  const [melebar, setMelebar] = useState(true);

  useEffect(() => {
    if (!melebar) return;
    const t = setTimeout(() => setMelebar(false), 5000);
    return () => clearTimeout(t);
  }, [melebar]);

  return (
    <button
      onClick={() => { if (melebar) onClick(); else setMelebar(true); }}
      className={`fixed bottom-6 z-1504 flex items-center gap-2 py-2.5 text-xs font-bold text-white shadow-xl active:scale-95 ${
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
