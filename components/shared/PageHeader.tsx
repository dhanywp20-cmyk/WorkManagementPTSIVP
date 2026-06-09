'use client';

import { ReactNode } from 'react';

interface PageHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  /** Hex color for border accent and icon background gradient (e.g. '#dc2626') */
  color: string;
  /** Lighter shade for icon gradient end (optional, auto-derived if omitted) */
  colorLight?: string;
  /** Right-side actions / buttons */
  children?: ReactNode;
}

/**
 * Shared sticky page header used across all platform modules.
 * Enforces consistent visual identity per module through `color` prop.
 *
 * @example
 * <PageHeader icon="🎫" title="Ticket Troubleshooting" color="#dc2626">
 *   <button>...</button>
 * </PageHeader>
 */
export function PageHeader({ icon, title, subtitle, color, colorLight, children }: PageHeaderProps) {
  // Auto-derive a lighter shade if not provided (darken ~20% → use as gradient end)
  const iconBg = `linear-gradient(135deg,${color},${colorLight ?? color + 'cc'})`;
  const iconShadow = `0 3px 12px ${color}40`;

  return (
    <header
      className="sticky top-0 z-50 animate-slide-down anim-d0"
      style={{
        background: 'rgba(255,255,255,0.95)',
        borderBottom: `3px solid ${color}`,
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        {/* Left: icon + title */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg, boxShadow: iconShadow }}
          >
            <span className="text-lg">{icon}</span>
          </div>
          <div>
            <h1
              className="text-base font-black tracking-tight leading-tight"
              style={{ color }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] text-slate-500 font-medium">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: action slot */}
        {children && (
          <div className="flex items-center gap-2 flex-wrap">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
