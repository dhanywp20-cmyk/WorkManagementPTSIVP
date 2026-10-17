'use client';
/**
 * Aksi benda terpilih di kiri-atas kanvas: Atur, Duplikat, Salin ke ruang lain, Kunci, Sembunyikan, Larik, Ratakan & sebar
 * (pilih banyak), Geser tepat, Hapus. Aturan tata letak: inti/tata.ts. Satu baris mendatar (ponsel: ikon; layar lebar: berlabel),
 * supaya kolom kiri kanvas tidak memanjang sampai menabrak kontrol kamera.
 */
import { useState } from 'react';
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical,
  Copy, CopyPlus, EyeOff, Grid2x2Plus, Lock, LockOpen, MoveHorizontal, Ruler, Settings2, StretchHorizontal, StretchVertical, Trash2 } from 'lucide-react';
import { duplikatBanyak, kunciSembunyi, larik, MAKS_LARIK, ratakan, ruangDari, sebar } from '../inti';
import type { AlatDesain } from './alat';

const kelasAksi = 'inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold';

export function AksiTerpilih({ a, onGeserTepat }: { a: AlatDesain; onGeserTepat: () => void }) {
  const { batas, benda, duaRuang, kotakRuang, panel, pilihLain, ruang, sembunyiGolongan, setSembunyiGolongan, setBenda, setPanel, setPesan, setPilih, setPilihan, setSisi, terpilih } = a.K;
  const { duplikat, salinKeRuangLain } = a.aksi;
  const [menu, setMenu] = useState<'rata' | 'larik' | null>(null);
  const [isiLarik, setIsiLarik] = useState({ kolom: '4', baris: '2', jx: '900', jz: '1200' });
  if (!terpilih) return null;
  const ids = [terpilih.id, ...pilihLain];
  const banyak = pilihLain.length > 0;
  const kunci = !!terpilih.terkunci;
  const ruangLain = (ruangDari(ruang, terpilih.x) + 1) % kotakRuang.length + 1;

  const buatLarik = () => {
    const n = (v: string) => Number(v.replace(',', '.'));
    const salinan = larik(terpilih, n(isiLarik.kolom), n(isiLarik.baris), n(isiLarik.jx) / 1000, n(isiLarik.jz) / 1000, batas);
    if (!salinan.length) { setPesan('Tidak ada salinan yang muat di dalam ruangan - periksa jarak & arah.'); return; }
    setBenda(bs => [...bs, ...salinan]);
    setPilihan(terpilih.id, salinan.map(b => b.id));
    setMenu(null);
    setPesan(`${salinan.length} salinan "${terpilih.nama}" dibuat - semuanya terpilih, bisa digeser bersama.`);
  };
  const rata = (f: (bs: typeof benda) => typeof benda) => { setBenda(f); setMenu(null); };
  const ikon = (k: string) => `${kelasAksi} ${k}`;
  const isian = 'w-full rounded-md border border-slate-200 px-2 py-1 text-base sm:text-[12.5px] tabular-nums';

  return (
    <div className="relative flex flex-row flex-wrap gap-1 rounded-xl bg-white/95 border border-slate-200 shadow-xs p-1" role="toolbar" aria-label={`Aksi ${terpilih.nama}`}>
      {banyak && <span className="self-center px-2 py-0.5 rounded-full bg-blue-700 text-white text-[11.5px] font-bold" title="Benda terpilih">{ids.length}</span>}
      <button type="button" onClick={() => { setSisi(null); setPanel(p => !p); }} aria-pressed={panel} title="Atur ukuran, posisi & pilihan benda"
        className={ikon(panel ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100')}><Settings2 size={15} /> <span className="sr-only sm:not-sr-only">Atur</span></button>
      <button type="button" onClick={() => {
        if (!banyak) { duplikat(terpilih); return; }
        const h = duplikatBanyak(benda, ids, batas.x);
        setBenda(h.benda); setPilihan(h.baru[0]?.id ?? null, h.baru.slice(1).map(b => b.id));
      }} title={banyak ? 'Duplikat semua yang terpilih' : 'Duplikat benda ini'} className={ikon('text-slate-700 hover:bg-slate-100')}>
        <Copy size={15} /> <span className="sr-only sm:not-sr-only">Duplikat</span>
      </button>
      {duaRuang && (
        <button type="button" onClick={() => salinKeRuangLain(terpilih)} title={`Salin ke Ruang ${ruangLain}`} className={ikon('text-slate-700 hover:bg-slate-100')}>
          <CopyPlus size={15} /> <span className="sr-only sm:not-sr-only">Salin ke Ruang {ruangLain}</span>
        </button>
      )}
      {!banyak && (
        <button type="button" onClick={() => setMenu(m => (m === 'larik' ? null : 'larik'))} aria-expanded={menu === 'larik'} title="Larik: ulangi benda dalam baris × kolom berjarak tetap"
          className={ikon(menu === 'larik' ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100')}><Grid2x2Plus size={15} /> <span className="sr-only sm:not-sr-only">Larik</span></button>
      )}
      {banyak && (
        <button type="button" onClick={() => setMenu(m => (m === 'rata' ? null : 'rata'))} aria-expanded={menu === 'rata'} title="Ratakan & sebar benda terpilih"
          className={ikon(menu === 'rata' ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100')}><AlignCenterVertical size={15} /> <span className="sr-only sm:not-sr-only">Ratakan</span></button>
      )}
      {!kunci && (
        <button type="button" onClick={onGeserTepat} title="Geser tepat (mm) - atau ketik angka langsung" className={ikon('text-slate-700 hover:bg-slate-100')}>
          <Ruler size={15} /> <span className="sr-only sm:not-sr-only">Geser tepat</span>
        </button>
      )}
      <button type="button" onClick={() => setBenda(bs => bs.map(b => (ids.includes(b.id) ? { ...b, terkunci: kunci ? undefined : true } : b)))}
        aria-pressed={kunci} title={kunci ? 'Buka kunci - bisa digeser lagi' : 'Kunci posisi - tidak bisa tergeser'}
        className={ikon(kunci ? 'bg-amber-100 text-amber-900' : 'text-slate-700 hover:bg-slate-100')}>
        {kunci ? <Lock size={15} /> : <LockOpen size={15} />} <span className="sr-only sm:not-sr-only">{kunci ? 'Terkunci' : 'Kunci'}</span>
      </button>
      <button type="button" onClick={() => { setSembunyiGolongan([...new Set([...sembunyiGolongan, ...ids.map(kunciSembunyi)])]); setPilihan(null, []); }}
        title={banyak ? 'Sembunyikan yang terpilih (tampilkan lagi lewat daftar benda / Kelompok)' : 'Sembunyikan benda ini (tampilkan lagi lewat daftar benda / Kelompok)'}
        className={ikon('text-slate-700 hover:bg-slate-100')}><EyeOff size={15} /> <span className="sr-only sm:not-sr-only">Sembunyikan</span></button>
      <button type="button" onClick={() => { const s = new Set(ids); setBenda(b => b.filter(x => !s.has(x.id))); setPilih(null); }} title={banyak ? 'Hapus semua yang terpilih' : 'Hapus benda ini'}
        className={ikon('text-rose-700 hover:bg-rose-50')}><Trash2 size={15} /> <span className="sr-only sm:not-sr-only">Hapus</span></button>

      {menu === 'rata' && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-56 rounded-xl bg-white border border-slate-200 shadow-xl p-2 space-y-2">
          {([['Kiri-kanan', 'x', [AlignStartVertical, AlignCenterVertical, AlignEndVertical]], ['Depan-belakang', 'z', [AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal]]] as const).map(([l, s, ik]) => (
            <div key={s}>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">{l}</p>
              <div className="flex gap-1">
                {(['awal', 'tengah', 'akhir'] as const).map((c, i) => {
                  const I = ik[i];
                  return <button key={c} type="button" onClick={() => rata(bs => ratakan(bs, ids, s, c))} title={`Ratakan ${l.toLowerCase()} · ${c === 'awal' ? (s === 'x' ? 'kiri' : 'depan') : c === 'akhir' ? (s === 'x' ? 'kanan' : 'belakang') : 'tengah'}`}
                    className="flex-1 grid place-items-center py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-blue-50"><I size={15} /></button>;
                })}
                <button type="button" disabled={ids.length < 3} onClick={() => rata(bs => sebar(bs, ids, s))} title={`Sebar merata ${l.toLowerCase()} (min. 3 benda)`}
                  className="flex-1 grid place-items-center py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-blue-50 disabled:opacity-40">
                  {s === 'x' ? <StretchHorizontal size={15} /> : <StretchVertical size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {menu === 'larik' && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-56 rounded-xl bg-white border border-slate-200 shadow-xl p-2.5 space-y-2">
          <p className="text-[12px] font-bold text-slate-800 flex items-center gap-1.5"><Grid2x2Plus size={14} /> Larik {terpilih.nama}</p>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-600">
            <label>Kolom (kiri-kanan)<input inputMode="numeric" value={isiLarik.kolom} onChange={e => setIsiLarik({ ...isiLarik, kolom: e.target.value })} className={isian} /></label>
            <label>Baris (ke belakang)<input inputMode="numeric" value={isiLarik.baris} onChange={e => setIsiLarik({ ...isiLarik, baris: e.target.value })} className={isian} /></label>
            <label>Jarak kolom (mm)<input inputMode="numeric" value={isiLarik.jx} onChange={e => setIsiLarik({ ...isiLarik, jx: e.target.value })} className={isian} /></label>
            <label>Jarak baris (mm)<input inputMode="numeric" value={isiLarik.jz} onChange={e => setIsiLarik({ ...isiLarik, jz: e.target.value })} className={isian} /></label>
          </div>
          <button type="button" onClick={buatLarik} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-blue-700 hover:bg-blue-800">
            <MoveHorizontal size={14} /> Buat {Math.max(0, Math.min(MAKS_LARIK, (Number(isiLarik.kolom) || 1) * (Number(isiLarik.baris) || 1) - 1))} salinan
          </button>
        </div>
      )}
    </div>
  );
}
