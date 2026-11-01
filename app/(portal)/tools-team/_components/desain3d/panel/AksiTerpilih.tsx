'use client';
/**
 * Alat benda terpilih - satu kolom ikon di rel kiri, tepat di bawah alat umum (BilahKiri), berbingkai biru supaya
 * terbedakan: Atur · Geser / Putar · Geser ▾ (geser cepat & geser tepat) · Duplikat · Lainnya ▾ · Hapus. Menu terbuka ke
 * kanan. Yang jarang dipakai (larik / ratakan, salin ke ruang lain, tempel ke dinding, fokus kamera, kunci, sembunyikan)
 * ada di menu Lainnya. Dulu bilah melayang di tengah-atas yang menutupi gambar. Aturan tata letak: inti/tata.ts.
 */
import { type ReactNode, useState } from 'react';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical,
  Copy, CopyPlus, Crosshair, EyeOff, Grid2x2Plus, Lock, LockOpen, MoreHorizontal, Move, Move3d, MoveHorizontal, PanelTop, Rotate3d, Ruler,
  Settings2, StretchHorizontal, StretchVertical, Trash2,
} from 'lucide-react';
import { BISA_TEMPEL, duplikatBanyak, kunciSembunyi, larik, MAKS_LARIK, ratakan, ruangDari, sebar } from '../inti';
import type { Sisi } from '../mesin/tipe';
import { GeserCepat } from './GeserCepat';
import { itemMenu, judulMenu, menuMelayang } from './gaya';
import type { AlatDesain } from './alat';

const biasa = 'text-slate-700 hover:bg-slate-100 active:bg-slate-200';
/** Menu yang terbuka ke kanan kolom. */
const kanan = 'absolute left-full top-0 ml-2 max-w-[calc(100vw-7rem)]';

type AtributAria = { role?: string; 'aria-pressed'?: boolean; 'aria-checked'?: boolean; 'aria-expanded'?: boolean; 'aria-haspopup'?: 'menu' | 'dialog' };
/** Tombol ikon kolom (ukuran sama dengan rel alat). */
function Ikon({ judul, onClick, kelas, children, ...aria }: { judul: string; onClick: () => void; kelas: string; children: ReactNode } & AtributAria) {
  return <button type="button" title={judul} aria-label={judul} onClick={onClick} className={`w-9 h-9 grid place-items-center ${kelas}`} {...aria}>{children}</button>;
}

/** Baris menu Lainnya: ikon, judul & keterangan pendek. */
function Baris({ ikon, judul, ket, onClick, aktif, bahaya }: { ikon: ReactNode; judul: string; ket?: string; onClick: () => void; aktif?: boolean; bahaya?: boolean }) {
  return (
    <button type="button" role={aktif === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={aktif} onClick={onClick}
      className={`${itemMenu} flex items-start gap-2.5 ${aktif ? 'bg-amber-50' : ''} ${bahaya ? 'text-rose-700' : 'text-slate-800'}`}>
      <span className="mt-0.5 shrink-0">{ikon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{judul}</span>
        {ket && <span className="block text-[11.5px] text-slate-500">{ket}</span>}
      </span>
    </button>
  );
}

export function AksiTerpilih({ a, onGeserTepat }: { a: AlatDesain; onGeserTepat: () => void }) {
  const { alatKanvas, batas, benda, duaRuang, hanyaLihat, kotakRuang, modeGizmo, panel, pilihLain, ruang, sembunyiGolongan, setSembunyiGolongan,
    setBenda, setModeGizmo, setPanel, setPesan, setPilih, setPilihan, setSisi, terpilih } = a.K;
  const { duplikat, salinKeRuangLain, tempel } = a.aksi;
  const [menu, setMenu] = useState<'lain' | 'geser' | 'rata' | 'larik' | null>(null);
  const [isiLarik, setIsiLarik] = useState({ kolom: '4', baris: '2', jx: '900', jz: '1200' });
  if (!terpilih) return null;
  const ids = [terpilih.id, ...pilihLain];
  const banyak = pilihLain.length > 0;
  const kunci = !!terpilih.terkunci;
  const bisaGeser = alatKanvas === 'pilih' && !kunci;
  const ruangLain = (ruangDari(ruang, terpilih.x) + 1) % kotakRuang.length + 1;
  const buka = (m: typeof menu) => setMenu(v => (v === m ? null : m));
  const lalu = (f: () => unknown) => () => { setMenu(null); f(); };

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
  const isian = 'w-full rounded-md border border-slate-200 px-2 py-1 text-base sm:text-[12.5px] tabular-nums';
  const tutupLatar = <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenu(null)} />;

  return (
    <div className="relative" role="toolbar" aria-orientation="vertical" aria-label={banyak ? `Aksi ${ids.length} benda terpilih` : `Aksi ${terpilih.nama}`}>
      <div className="flex flex-col rounded-xl bg-white/95 backdrop-blur border border-blue-300 shadow-md overflow-hidden divide-y divide-slate-100">
        {banyak && <span className="h-6 grid place-items-center bg-blue-700 text-white text-[11px] font-bold" title={`${ids.length} benda terpilih`}>{ids.length}</span>}
        <Ikon judul={`Atur ${banyak ? `${ids.length} benda` : terpilih.nama}: ukuran, posisi & pilihan`} aria-pressed={panel} onClick={() => { setSisi(null); setPanel(p => !p); }}
          kelas={panel ? 'bg-blue-700 text-white' : biasa}><Settings2 size={17} /></Ikon>
        {bisaGeser && (
          <div className="flex flex-col divide-y divide-slate-100" role="radiogroup" aria-label="Geser atau putar dengan gizmo (R)">
            {([['translate', 'Geser dengan gizmo (R)', Move3d], ['rotate', 'Putar dengan gizmo (R)', Rotate3d]] as const).map(([m, l, I]) => (
              <Ikon key={m} judul={l} role="radio" aria-checked={modeGizmo === m} onClick={() => setModeGizmo(m)}
                kelas={modeGizmo === m ? 'bg-blue-50 text-blue-800' : biasa}><I size={17} /></Ikon>
            ))}
          </div>
        )}
        {bisaGeser && !hanyaLihat && (
          <Ikon judul="Geser cepat (panah keyboard) & geser tepat (mm)" aria-expanded={menu === 'geser'} aria-haspopup="dialog" onClick={() => buka('geser')}
            kelas={menu === 'geser' ? 'bg-blue-50 text-blue-800' : biasa}><Move size={17} /></Ikon>
        )}
        <Ikon judul={banyak ? 'Duplikat semua yang terpilih' : 'Duplikat benda ini'} kelas={biasa} onClick={() => {
          if (!banyak) { duplikat(terpilih); return; }
          const h = duplikatBanyak(benda, ids, batas.x);
          setBenda(h.benda); setPilihan(h.baru[0]?.id ?? null, h.baru.slice(1).map(b => b.id));
        }}><Copy size={17} /></Ikon>
        <Ikon judul={kunci ? 'Terkunci - menu lainnya' : 'Lainnya: larik / ratakan, salin ke ruang lain, tempel ke dinding, fokus kamera, kunci, sembunyikan'}
          aria-expanded={menu === 'lain'} aria-haspopup="menu" onClick={() => buka('lain')}
          kelas={menu === 'lain' || menu === 'rata' || menu === 'larik' ? 'bg-blue-50 text-blue-800' : kunci ? 'bg-amber-100 text-amber-900' : biasa}>
          {kunci ? <Lock size={17} /> : <MoreHorizontal size={17} />}
        </Ikon>
        <Ikon judul={banyak ? 'Hapus semua yang terpilih' : 'Hapus benda ini'} kelas="text-rose-700 hover:bg-rose-50"
          onClick={() => { const s = new Set(ids); setBenda(b => b.filter(x => !s.has(x.id))); setPilih(null); }}><Trash2 size={17} /></Ikon>
      </div>

      {/*  Geser cepat selalu terpasang: panah keyboard tetap jalan walau panelnya tertutup. */}
      {bisaGeser && !hanyaLihat && (
        <>
          {menu === 'geser' && tutupLatar}
          <div className={menu === 'geser' ? `${kanan} w-64 ${menuMelayang} space-y-2 p-2.5` : 'hidden'} role="dialog" aria-label="Geser benda">
            <GeserCepat a={a} />
            <button type="button" onClick={lalu(onGeserTepat)} className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50">
              <Ruler size={14} /> Geser tepat (mm) <span className="text-slate-400 font-normal">· atau ketik angka</span>
            </button>
          </div>
        </>
      )}

      {menu === 'lain' && (
        <>
          {tutupLatar}
          <div className={`${kanan} w-72 max-h-[min(60vh,440px)] overflow-y-auto ${menuMelayang}`} role="menu">
            {!banyak && <Baris ikon={<Grid2x2Plus size={15} />} judul="Larik" ket="Ulangi benda dalam baris × kolom berjarak tetap" onClick={() => setMenu('larik')} />}
            {banyak && <Baris ikon={<AlignCenterVertical size={15} />} judul="Ratakan & sebar" ket="Sejajarkan / bagi rata benda terpilih" onClick={() => setMenu('rata')} />}
            {duaRuang && <Baris ikon={<CopyPlus size={15} />} judul={`Salin ke Ruang ${ruangLain}`} onClick={lalu(() => salinKeRuangLain(terpilih))} />}
            <Baris ikon={<Crosshair size={15} />} judul="Fokus kamera" ket="Dekatkan kamera ke benda ini" onClick={lalu(a.kamera.fokusBenda)} />
            {BISA_TEMPEL.includes(terpilih.jenis) && !kunci && (
              <div className="px-3 py-2">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-800"><PanelTop size={15} /> Tempel ke dinding</p>
                <div className="mt-1.5 grid grid-cols-4 gap-1">
                  {(['depan', 'belakang', 'kiri', 'kanan'] as Sisi[]).map(s => (
                    <button key={s} type="button" onClick={lalu(() => tempel(s))} className="py-1 rounded-md text-[12px] font-semibold border border-slate-200 text-slate-700 hover:bg-blue-50 capitalize">{s}</button>
                  ))}
                </div>
              </div>
            )}
            <p className={judulMenu}>Benda</p>
            <Baris ikon={kunci ? <LockOpen size={15} /> : <Lock size={15} />} aktif={kunci} judul={kunci ? 'Buka kunci' : 'Kunci posisi'} ket={kunci ? 'Bisa digeser lagi' : 'Tidak bisa tergeser tanpa sengaja'}
              onClick={lalu(() => setBenda(bs => bs.map(b => (ids.includes(b.id) ? { ...b, terkunci: kunci ? undefined : true } : b))))} />
            <Baris ikon={<EyeOff size={15} />} judul="Sembunyikan" ket="Tampilkan lagi lewat daftar Benda"
              onClick={lalu(() => { setSembunyiGolongan([...new Set([...sembunyiGolongan, ...ids.map(kunciSembunyi)])]); setPilihan(null, []); })} />
          </div>
        </>
      )}
      {menu === 'rata' && (
        <>
          {tutupLatar}
          <div className={`${kanan} w-56 ${menuMelayang} p-2 space-y-2`}>
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
        </>
      )}
      {menu === 'larik' && (
        <>
          {tutupLatar}
          <div className={`${kanan} w-56 ${menuMelayang} p-2.5 space-y-2`}>
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
        </>
      )}
    </div>
  );
}
