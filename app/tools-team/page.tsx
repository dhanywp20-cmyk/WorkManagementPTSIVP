'use client';
import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { Ikon } from '@/components/shared/Ikon';
import { KalkulatorLED } from './_components/KalkulatorLED';

//  three.js (~600 KB) hanya diunduh saat alat Desain 3D dibuka.
const Desain3D = dynamic(() => import('./_components/Desain3D'), {
  ssr: false,
  loading: () => <div className="h-[420px] grid place-items-center text-sm text-slate-500">Memuat Desain 3D...</div>,
});

const ALAT = [
  { k: 'led', judul: 'LED Videotron', ket: 'Modul/cabinet, resolusi, daya, sending card & VP', ikon: '📺', C: KalkulatorLED },
  { k: '3d', judul: 'Desain 3D Ruang', ket: 'Tata letak ruang AV + analisis jarak pandang', ikon: '🧊', C: Desain3D },
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
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Pilihan alat: switch di atas, lebar tombol sama. Selalu di atas kartu
            putih supaya tetap terbaca di atas gambar latar merek. */}
        <nav aria-label="Daftar alat" className="rounded-2xl bg-white border border-slate-200 shadow-sm p-1.5 print:hidden">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${ALAT.length}, minmax(0, 1fr))` }}>
            {ALAT.map(a => {
              const on = a.k === aktif;
              return (
                <button key={a.k} type="button" onClick={() => pilih(a.k)} aria-pressed={on}
                  className={`min-w-0 flex items-center justify-center sm:justify-start gap-2.5 px-2 sm:px-3 py-2.5 rounded-xl transition-colors ${on ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
                  <span className={`hidden sm:grid w-8 h-8 rounded-lg place-items-center flex-shrink-0 ${on ? 'bg-white/15' : 'bg-blue-50 text-blue-700'}`}><Ikon nama={a.ikon} ukuran={16} /></span>
                  <span className="min-w-0 text-center sm:text-left">
                    <span className="block text-[13px] font-bold truncate">{a.judul}</span>
                    <span className={`hidden sm:block text-[11.5px] leading-snug truncate ${on ? 'text-blue-100' : 'text-slate-600'}`}>{a.ket}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
        <main className="min-w-0">
          <C />
        </main>
      </div>
    </div>
  );
}

export default function ToolsKerjaPage() {
  return <Suspense fallback={null}><ToolsKerjaInner /></Suspense>;
}
