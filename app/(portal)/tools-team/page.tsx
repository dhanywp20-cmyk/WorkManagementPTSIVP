'use client';
import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth/sesi';
import { Ikon } from '@/components/shared/Ikon';
import type { SubLED } from './_components/KalkulatorLED';
import { bolehLihatPustaka } from '@/lib/pustaka';
import { catatPemakaian } from '@/lib/pemakaian';
import { PenjagaAlat } from './_components/bersama/PenjagaAlat';

const Memuat = () => <div className="h-[420px] grid place-items-center text-sm text-slate-500">Memuat...</div>;
const Desain3D = dynamic(() => import('./_components/Desain3D'), { ssr: false, loading: Memuat });
const KalkulatorLED = dynamic(() => import('./_components/KalkulatorLED').then(m => m.KalkulatorLED), { loading: Memuat });
const KalkulatorAV = dynamic(() => import('./_components/KalkulatorAV').then(m => m.KalkulatorAV), { loading: Memuat });
const SLD = dynamic(() => import('./_components/SLD').then(m => m.SLD), { loading: Memuat });
const Pustaka = dynamic(() => import('./_components/Pustaka').then(m => m.Pustaka), { loading: Memuat });
const ProductComparison = dynamic(() => import('./_components/ProductComparison').then(m => m.ProductComparison), { loading: Memuat });
const ChecklistBarang = dynamic(() => import('./_components/ChecklistBarang').then(m => m.ChecklistBarang), { loading: Memuat });

const ALAT = [
  { k: '3d', judul: 'Desain 3D Ruang', ket: 'Tata letak ruang AV + analisis jarak pandang', ikon: '🧊', C: Desain3D },
  { k: 'led', judul: 'LED Videotron', ket: 'Calculator LED, Screen & Power Connection, daftar material & penawaran', ikon: '📺', C: KalkulatorLED },
  { k: 'av', judul: 'Kalkulator AV', ket: 'Ukuran layar, videowall & IFP (BOM & penawaran), proyektor, sinyal & jaringan AV, audio & akustik, daya, rak, PoE', ikon: '🧮', C: KalkulatorAV },
  { k: 'sld', judul: 'Single Line Diagram', ket: 'Diagram koneksi perangkat (SLD) A3: kanvas drag & drop, tabel koneksi, daftar perangkat, ekspor PDF / PNG', ikon: '〰', C: SLD },
  { k: 'banding', judul: 'Product Comparison', ket: 'Battle card perbandingan produk dari brosur PDF - template baku, diverifikasi Team PTS', ikon: '⚖️', C: ProductComparison },
  { k: 'cekbarang', judul: 'Checklist Barang', ket: 'Impor daftar barang dari Excel / PDF, centang hasil cek, unduh PDF bertanda tangan', ikon: '📋', C: ChecklistBarang },
  { k: 'pustaka', judul: 'Pustaka', ket: 'Katalog produk, data acuan & artikel panduan tim - diisi Admin, dipakai kalkulator', ikon: '📚', C: Pustaka },
] as const;

function ToolsKerjaInner() {
  const sp = useSearchParams();
  const [siap, setSiap] = useState(false);
  const [alat] = useState(() => ALAT.filter(x => x.k !== 'pustaka' || bolehLihatPustaka(getSession<Parameters<typeof bolehLihatPustaka>[0]>())));
  const [aktif, setAktif] = useState<string>(() => (sp.get('alat') === 'koneksi' ? 'led' : alat.some(a => a.k === sp.get('alat')) ? sp.get('alat')! : '3d'));
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
  useEffect(() => { if (siap) catatPemakaian('tools-team', aktif); }, [siap, aktif]);

  const [dibuka, setDibuka] = useState<string[]>([aktif]);
  if (!dibuka.includes(aktif)) setDibuka([...dibuka, aktif]);
  const pilih = (k: string) => {
    setAktif(k);
    try { const url = new URL(window.location.href); url.searchParams.set('alat', k); url.searchParams.delete('sub'); window.history.replaceState(null, '', url); } catch {  }
  };
  const pilihSub = (sub: SubLED) => {
    try { const url = new URL(window.location.href); url.searchParams.set('alat', 'led'); if (sub === 'led') url.searchParams.delete('sub'); else url.searchParams.set('sub', sub); window.history.replaceState(null, '', url); } catch {  }
  };

  if (!siap) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="min-h-screen" style={{ background: 'var(--latar-halaman, #f1f5f9)' }}>
      <PageHeader icon="🧮" title="AV Solution Tools" subtitle="Kalkulator & desain untuk engineer Audio Visual">
        {alat.map(a => {
          const on = a.k === aktif;
          return (
            <button key={a.k} type="button" onClick={() => pilih(a.k)} aria-pressed={on} title={a.ket}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 ${on ? 'text-white hover:opacity-90' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
              style={on ? { background: 'linear-gradient(135deg, var(--merek-utama), var(--merek-utama-2))', boxShadow: '0 4px 14px var(--merek-utama-tembus)' } : undefined}>
              <Ikon nama={a.ikon} ukuran={15} />{a.judul}
            </button>
          );
        })}
      </PageHeader>
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 space-y-4">
        <main className="min-w-0">
          {alat.filter(a => dibuka.includes(a.k)).map(a => (
            <section key={a.k} hidden={a.k !== aktif} aria-label={a.judul}>
              <PenjagaAlat nama={a.judul}>{a.k === 'led' ? <KalkulatorLED subAwal={subAwal} onSub={pilihSub} /> : <a.C />}</PenjagaAlat>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

export default function ToolsKerjaPage() {
  return <Suspense fallback={null}><ToolsKerjaInner /></Suspense>;
}
