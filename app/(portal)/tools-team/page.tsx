'use client';
import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { Ikon } from '@/components/shared/Ikon';
import { KalkulatorLED, type SubLED } from './_components/KalkulatorLED';
import { KalkulatorAV } from './_components/KalkulatorAV';
import { Pustaka } from './_components/Pustaka';

//  three.js (~600 KB) hanya diunduh saat alat Desain 3D dibuka.
const Desain3D = dynamic(() => import('./_components/Desain3D'), {
  ssr: false,
  loading: () => <div className="h-[420px] grid place-items-center text-sm text-slate-500">Memuat Desain 3D...</div>,
});

//  Desain 3D pertama = alat yang tampil saat halaman dibuka.
const ALAT = [
  { k: '3d', judul: 'Desain 3D Ruang', ket: 'Tata letak ruang AV + analisis jarak pandang', ikon: '🧊', C: Desain3D },
  { k: 'led', judul: 'LED Videotron', ket: 'Calculator LED, Screen & Power Connection, daftar material & penawaran', ikon: '📺', C: KalkulatorLED },
  { k: 'av', judul: 'Kalkulator AV', ket: 'Ukuran layar, proyektor, sinyal & jaringan AV, audio & akustik, daya, rak, PoE', ikon: '🧮', C: KalkulatorAV },
  { k: 'pustaka', judul: 'Pustaka', ket: 'Katalog produk, data acuan & artikel panduan tim - diisi Admin, dipakai kalkulator', ikon: '📚', C: Pustaka },
] as const;

function ToolsKerjaInner() {
  const sp = useSearchParams();
  const [siap, setSiap] = useState(false);
  //  ?alat=koneksi (tautan lama) = LED Videotron, sub menu Screen Connection.
  const [aktif, setAktif] = useState<string>(() => (sp.get('alat') === 'koneksi' ? 'led' : ALAT.some(a => a.k === sp.get('alat')) ? sp.get('alat')! : '3d'));
  const subQ = sp.get('sub');
  const subAwal: SubLED = sp.get('alat') === 'koneksi' ? 'koneksi' : (['koneksi', 'daya', 'banding', 'konten'] as const).find(v => v === subQ) ?? 'led';

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
    try { const url = new URL(window.location.href); url.searchParams.set('alat', k); url.searchParams.delete('sub'); window.history.replaceState(null, '', url); } catch { /* abaikan */ }
  };
  const pilihSub = (sub: SubLED) => {
    try { const url = new URL(window.location.href); url.searchParams.set('alat', 'led'); if (sub === 'led') url.searchParams.delete('sub'); else url.searchParams.set('sub', sub); window.history.replaceState(null, '', url); } catch { /* abaikan */ }
  };

  if (!siap) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="min-h-screen" style={{ background: 'var(--latar-halaman, #f1f5f9)' }}>
      <PageHeader icon="🧮" title="Tools Team" subtitle="Kalkulator & desain untuk engineer Audio Visual" color="#1d4ed8" colorLight="#3b82f6">
        {/* Pilihan alat di header (pola tombol "Mapping Center" di Summary Project): yang aktif berisi gradien, yang lain putih. */}
        {ALAT.map(a => {
          const on = a.k === aktif;
          return (
            <button key={a.k} type="button" onClick={() => pilih(a.k)} aria-pressed={on} title={a.ket}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 ${on ? 'text-white hover:opacity-90' : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'}`}
              style={on ? { background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', boxShadow: '0 4px 14px rgba(29,78,216,0.35)' } : undefined}>
              <Ikon nama={a.ikon} ukuran={15} />{a.judul}
            </button>
          );
        })}
      </PageHeader>
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 space-y-4">
        <main className="min-w-0">
          {/* LED Videotron berisi sub menu Calculator LED | Screen Connection. */}
          {/*  Tiap alat dirender eksplisit - alat baru di ALAT WAJIB punya cabang di sini (dulu Pustaka jatuh ke Desain 3D). */}
          {aktif === 'led' ? <KalkulatorLED subAwal={subAwal} onSub={pilihSub} />
            : aktif === 'av' ? <KalkulatorAV />
            : aktif === 'pustaka' ? <Pustaka />
            : <Desain3D />}
        </main>
      </div>
    </div>
  );
}

export default function ToolsKerjaPage() {
  return <Suspense fallback={null}><ToolsKerjaInner /></Suspense>;
}
