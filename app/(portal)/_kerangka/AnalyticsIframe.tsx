'use client';
import { useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';

export function AnalyticsIframe() {
  const [iframeState, setIframeState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <div style={{ animation: 'fadeInUp 0.35s ease forwards', opacity: 0, height: '85vh', position: 'relative' }}>
      {iframeState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/10 rounded-3xl z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.3)', borderTopColor: '#e2a84b' }} />
            <p className="text-white/70 text-sm">Memuat analytics...</p>
          </div>
        </div>
      )}
      {iframeState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5 rounded-3xl z-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-4xl"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <p className="text-white/80 font-semibold">Analytics tidak dapat dimuat</p>
            <p className="text-white/50 text-sm">Coba refresh halaman</p>
            <button onClick={() => setIframeState('loading')} className="mt-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
              Coba Lagi
            </button>
          </div>
        </div>
      )}
      <iframe
        src="/analytics-dashboard"
        className="w-full h-full border-0 rounded-3xl overflow-hidden"
        style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.12)', opacity: iframeState === 'ready' ? 1 : 0, transition: 'opacity 0.3s' }}
        title="Analytics Dashboard"
        onLoad={() => setIframeState('ready')}
        onError={() => setIframeState('error')}
      />
    </div>
  );
}
