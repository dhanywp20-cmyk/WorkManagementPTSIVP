'use client';
/**
 * Rel alat kiri kanvas - satu panel tetap: Tambah, Teks cepat, Pilih banyak, Penggaris, Snap grid (+ magnet),
 * Kelompok (sembunyikan / isolasi), Daftar benda, Pusatkan isi. Alat untuk benda terpilih (geser / putar, geser
 * cepat) ada di bilah benda terpilih (KontrolKanvas). Pintasan: A = Tambah, M = penggaris, G = snap,
 * R = geser/putar, L = daftar benda, panah = geser, Esc = batal.
 */
import { useEffect, useRef, useState } from 'react';
import { AlignCenterVertical, BoxSelect, Grid3x3, Layers, ListTree, Magnet, Plus, Ruler, Type } from 'lucide-react';
import { golonganDari, jumlahSembunyiSendiri, type Golongan, KATALOG, LABEL_GOLONGAN, labelLangkah, LANGKAH_SNAP, MAKS_PENGGARIS, SUDUT_SNAP, titikSnap, type Titik } from '../inti';
import { grupNav, itemMenu, menuMelayang } from './gaya';
import { TombolNav } from './TombolNav';
import type { AlatDesain } from './alat';

const ITEM_TEKS = KATALOG.flatMap(g => g.item).find(i => i.kunci === 'teks-dinding');

export function BilahKiri({ a }: { a: AlatDesain }) {
  const { benda, daftarKanvas, setDaftarKanvas, sembunyiGolongan, setSembunyiGolongan, alatKanvas, bukaSisi, hanyaLihat, klikUkurRef, menuPusat, modeBanyak, modeGizmo, ruang, setAlatKanvas, setMenuPusat, setModeBanyak, setModeGizmo,
    setPilih, setPilihLain, setRuang, setSnap, setTitikUkur, sisi, snap, terpilih, titikUkur } = a.K;
  const { pusatkan } = a.aksi;
  const [menuSnap, setMenuSnap] = useState(false);
  const [menuKelompok, setMenuKelompok] = useState(false);
  //  Kelompok yang ada di desain ini (urutan tetap), untuk sembunyikan / isolasi.
  const kelompok = (Object.keys(LABEL_GOLONGAN) as Golongan[]).filter(g => benda.some(b => golonganDari(b.jenis) === g));
  const titikRef = useRef<Titik | null>(titikUkur); titikRef.current = titikUkur;
  const snapRef = useRef(snap); snapRef.current = snap;
  const ukur = alatKanvas === 'ukur';
  const jumlahGaris = ruang.penggaris?.length ?? 0;

  //  Mode penggaris: klik pertama = titik awal, klik kedua = garis jadi (mode tetap aktif untuk garis berikutnya).
  useEffect(() => {
    if (!ukur) { klikUkurRef.current = null; return; }
    klikUkurRef.current = p => {
      const t = titikSnap(p, snapRef.current);
      const awal = titikRef.current;
      if (!awal) { setTitikUkur(t); return; }
      setTitikUkur(null);
      if (Math.hypot(t[0] - awal[0], t[1] - awal[1], t[2] - awal[2]) < 0.005) return;
      setRuang(r => ({ ...r, penggaris: [...(r.penggaris ?? []), { id: `u${Date.now().toString(36)}`, a: awal, b: t }].slice(-MAKS_PENGGARIS) }));
    };
    return () => { klikUkurRef.current = null; };
  }, [ukur, klikUkurRef, setRuang, setTitikUkur]);

  const keluarUkur = () => { setAlatKanvas('pilih'); setTitikUkur(null); };
  const mulaiUkur = () => { setPilih(null); setPilihLain([]); setModeBanyak(false); setAlatKanvas('ukur'); };

  //  Pintasan papan ketik (diabaikan saat mengetik di isian).
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"], [role=dialog]')) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' && ukur) { if (titikRef.current) setTitikUkur(null); else keluarUkur(); }
      else if (k === 'm') { if (ukur) keluarUkur(); else mulaiUkur(); }
      else if (k === 'l') setDaftarKanvas(!daftarKanvas);
      else if (k === 'g') setSnap({ ...snapRef.current, aktif: !snapRef.current.aktif });
      else if (k === 'a' && !hanyaLihat) bukaSisi('tambah');
      else if (k === 'r' && terpilih) setModeGizmo(modeGizmo === 'translate' ? 'rotate' : 'translate');
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  });

  const tutupSemua = () => { setMenuSnap(false); setMenuKelompok(false); setMenuPusat(false); };
  const pilihan = (aktif: boolean) => `px-2 py-1 rounded-md text-[12px] font-semibold border ${aktif ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`;
  return (
    <div className="lapis-tembus relative flex flex-col gap-1.5" role="toolbar" aria-label="Alat desain">
      <div className={`${grupNav} self-start`}>
        {!hanyaLihat && (
          <button type="button" onClick={() => bukaSisi('tambah')} aria-pressed={sisi === 'tambah'} title="Tambah benda (A)" aria-label="Tambah benda"
            className={`w-9 h-9 grid place-items-center text-white ${sisi === 'tambah' ? 'bg-blue-800' : 'bg-blue-700 hover:bg-blue-800'}`}><Plus size={18} /></button>
        )}
        {!hanyaLihat && ITEM_TEKS && <TombolNav judul="Tambah teks / keterangan" onClick={() => a.aksi.tambah(ITEM_TEKS)}><Type size={17} /></TombolNav>}
        <TombolNav judul={modeBanyak ? 'Pilih banyak: aktif' : 'Pilih banyak (atau Shift / Ctrl + klik)'} aktif={modeBanyak} onClick={() => { keluarUkur(); setModeBanyak(!modeBanyak); }}><BoxSelect size={17} /></TombolNav>
        <TombolNav judul={ukur ? 'Penggaris: aktif - klik dua titik (M / Esc untuk selesai)' : 'Penggaris - ukur jarak dua titik (M)'} aktif={ukur} onClick={() => (ukur ? keluarUkur() : mulaiUkur())}><Ruler size={17} /></TombolNav>
        <TombolNav judul={snap.aktif ? `Snap grid ${labelLangkah(snap.langkah)} · ${snap.sudut}° (G)` : 'Snap grid - geser & putar presisi (G)'} aktif={snap.aktif || menuSnap} onClick={() => { tutupSemua(); setMenuSnap(v => !v); }}><Grid3x3 size={17} /></TombolNav>
        <TombolNav judul={sembunyiGolongan.length ? `${sembunyiGolongan.length - jumlahSembunyiSendiri(sembunyiGolongan)} kelompok & ${jumlahSembunyiSendiri(sembunyiGolongan)} benda disembunyikan` : 'Sembunyikan / isolasi kelompok benda'} aktif={sembunyiGolongan.length > 0 || menuKelompok}
          onClick={() => { tutupSemua(); setMenuKelompok(v => !v); }}><Layers size={17} /></TombolNav>
        <TombolNav judul={daftarKanvas ? 'Tutup daftar benda (L)' : 'Daftar benda - pilih dari nama (L)'} aktif={daftarKanvas} onClick={() => setDaftarKanvas(!daftarKanvas)}><ListTree size={17} /></TombolNav>
        {!hanyaLihat && <TombolNav judul="Pusatkan isi - geser semua benda ke tengah ruang" aktif={menuPusat} onClick={() => { tutupSemua(); setMenuPusat(v => !v); }}><AlignCenterVertical size={17} /></TombolNav>}
      </div>
      {ukur && (
        <div className="self-start flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-2 py-1 text-[11.5px] font-bold shadow-xs">
          <Ruler size={13} /> {titikUkur ? 'Titik kedua' : 'Titik pertama'}
          {jumlahGaris > 0 && (
            <button type="button" onClick={() => setRuang(r => ({ ...r, penggaris: [] }))} title="Hapus semua garis ukur"
              className="ml-1 rounded-sm bg-white/20 px-1.5 hover:bg-white/30">Hapus {jumlahGaris}</button>
          )}
        </div>
      )}
      {menuPusat && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuPusat(false)} />
          <div className={`absolute left-11 top-10 w-64 ${menuMelayang}`}>
            {([['xz', 'Tengah ruang', 'Kiri-kanan & depan-belakang'], ['x', 'Kiri-kanan saja', 'Jarak ke layar tidak berubah'], ['z', 'Depan-belakang saja', 'Posisi kiri-kanan tetap']] as const).map(([v, l, k]) => (
              <button key={v} type="button" onClick={() => pusatkan(v)} className={itemMenu}>
                <span className="block text-[13px] font-semibold text-slate-900">{l}</span>
                <span className="block text-[11.5px] text-slate-500">{k}</span>
              </button>
            ))}
            <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500 border-t border-slate-100 mt-1">
              Meja-kursi jadi patokan tengah. Benda yang menempel dinding tetap di dindingnya; proyektor ikut layarnya.
            </p>
          </div>
        </>
      )}
      {menuKelompok && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuKelompok(false)} />
          <div className="absolute left-11 top-10 z-30 w-60 rounded-xl bg-white border border-slate-200 shadow-xl p-2.5 space-y-1">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tampilkan kelompok</p>
            {kelompok.map(g => (
              <div key={g} className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 text-[12.5px] text-slate-700">
                  <input type="checkbox" className="w-4 h-4" checked={!sembunyiGolongan.includes(g)}
                    onChange={e => setSembunyiGolongan(e.target.checked ? sembunyiGolongan.filter(x => x !== g) : [...sembunyiGolongan, g])} />
                  {LABEL_GOLONGAN[g]}
                </label>
                <button type="button" onClick={() => setSembunyiGolongan(kelompok.filter(x => x !== g))} title={`Isolasi: tampilkan hanya ${LABEL_GOLONGAN[g]}`}
                  className="px-1.5 py-0.5 rounded-sm text-[11px] font-semibold text-blue-700 hover:bg-blue-50">Hanya</button>
              </div>
            ))}
            {sembunyiGolongan.length > 0 && (
              <button type="button" onClick={() => setSembunyiGolongan([])} className="w-full mt-1 px-2 py-1 rounded-md text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Tampilkan semua</button>
            )}
          </div>
        </>
      )}
      {menuSnap && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuSnap(false)} />
          <div className="absolute left-11 top-10 z-30 w-56 rounded-xl bg-white border border-slate-200 shadow-xl p-2.5 space-y-2">
            <label className="flex items-center justify-between text-[12.5px] font-bold text-slate-800">
              Snap grid
              <input type="checkbox" className="w-4 h-4" checked={snap.aktif} onChange={e => setSnap({ ...snap, aktif: e.target.checked })} />
            </label>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Geser</p>
              <div className="flex flex-wrap gap-1">
                {LANGKAH_SNAP.map(l => <button key={l} type="button" onClick={() => setSnap({ ...snap, aktif: true, langkah: l })} className={pilihan(snap.aktif && snap.langkah === l)}>{labelLangkah(l)}</button>)}
              </div>
            </div>
            <label className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700" title="Saat digeser, benda menempel ke tepi / tengah benda lain dalam jarak 5 cm">
              <span className="inline-flex items-center gap-1.5"><Magnet size={14} /> Magnet ke benda</span>
              <input type="checkbox" className="w-4 h-4" checked={snap.magnet} onChange={e => setSnap({ ...snap, magnet: e.target.checked })} />
            </label>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">Putar</p>
              <div className="flex flex-wrap gap-1">
                {SUDUT_SNAP.map(s => <button key={s} type="button" onClick={() => setSnap({ ...snap, aktif: true, sudut: s })} className={pilihan(snap.aktif && snap.sudut === s)}>{s}°</button>)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
