'use client';
import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { Ikon } from '@/components/shared/Ikon';
import { KalkulatorLED } from './_components/KalkulatorLED';
import { KalkulatorLayar, KalkulatorProyektor, KalkulatorSinyal, KalkulatorAudio, KalkulatorDaya } from './_components/Kalkulator';

//  three.js (~600 KB) hanya diunduh saat alat Desain 3D dibuka.
const Desain3D = dynamic(() => import('./_components/Desain3D'), {
  ssr: false,
  loading: () => <div className="h-[420px] grid place-items-center text-sm text-slate-500">Memuat Desain 3D...</div>,
});

const ALAT = [
  { k: 'led', judul: 'LED Videotron', ket: 'Cabinet, resolusi, daya, berat, controller', ikon: '📺', C: KalkulatorLED },
  { k: '3d', judul: 'Desain 3D Ruang', ket: 'Tata letak ruang AV + analisis jarak pandang', ikon: '🧊', C: Desain3D },
  { k: 'layar', judul: 'Ukuran Layar', ket: 'Aturan 4-6-8: layar vs jarak penonton', ikon: '📐', C: KalkulatorLayar },
  { k: 'proyektor', judul: 'Proyektor', ket: 'Jarak lempar & kebutuhan lumen', ikon: '📽', C: KalkulatorProyektor },
  { k: 'sinyal', judul: 'Bandwidth Sinyal', ket: 'Gbps vs HDMI / HDBaseT / SDI', ikon: '〰', C: KalkulatorSinyal },
  { k: 'audio', judul: 'Audio', ket: 'Speaker plafon & SPL terhadap jarak', ikon: '🔊', C: KalkulatorAudio },
  { k: 'daya', judul: 'Daya & Panas', ket: 'Beban, MCB, UPS, BTU', ikon: '⚡', C: KalkulatorDaya },
] as const;

function ToolsKerjaInner() {
  const sp = useSearchParams();
  const [siap, setSiap] = useState(false);
  const [aktif, setAktif] = useState<string>(() => (ALAT.some(a => a.k === sp.get('alat')) ? sp.get('alat')! : 'led'));

  useEffect(() => {
    const u = getSession();
    if (!u) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setSiap(true);
    return startSessionWatcher();
  }, []);

  const pilih = (k: string) => {
    setAktif(k);
    try { const url = new URL(window.location.href); url.searchParams.set('alat', k); window.history.replaceState(null, '', url); } catch { /* abaikan */ }
  };
  const alat = ALAT.find(a => a.k === aktif) ?? ALAT[0];
  const C = alat.C;

  if (!siap) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="min-h-screen" style={{ background: 'var(--latar-halaman, #f1f5f9)' }}>
      <PageHeader icon="🧮" title="Tools Team" subtitle="Kalkulator & desain untuk engineer Audio Visual" color="#1d4ed8" colorLight="#dbeafe" />
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)] items-start">
        {/* Daftar alat: kolom di desktop, deret geser di HP */}
        <nav aria-label="Daftar alat" className="lg:sticky lg:top-20 flex lg:flex-col gap-2 overflow-x-auto -mx-3 px-3 lg:mx-0 lg:px-0 pb-1 [scrollbar-width:none] print:hidden">
          {ALAT.map(a => {
            const on = a.k === aktif;
            return (
              <button key={a.k} type="button" onClick={() => pilih(a.k)} aria-current={on ? 'page' : undefined}
                className={`flex-shrink-0 lg:w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${on ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <span className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${on ? 'bg-white/15' : 'bg-blue-50 text-blue-700'}`}><Ikon nama={a.ikon} ukuran={16} /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold whitespace-nowrap">{a.judul}</span>
                  <span className={`hidden lg:block text-[11px] leading-snug ${on ? 'text-blue-100' : 'text-slate-500'}`}>{a.ket}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <main className="min-w-0">
          <div className="mb-3">
            <h1 className="text-lg font-extrabold text-slate-900">{alat.judul}</h1>
            <p className="text-[12.5px] text-slate-600">{alat.ket}</p>
          </div>
          <C />
        </main>
      </div>
    </div>
  );
}

export default function ToolsKerjaPage() {
  return <Suspense fallback={null}><ToolsKerjaInner /></Suspense>;
}
