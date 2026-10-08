'use client';
/**
 * Admin Panel › Daftar Pilihan - isi dropdown yang dulu tertulis di kode: merek display/middleware
 * (Request Design, PIC Brand), kebutuhan/produk/kegiatan Piket Showroom, event Unit Movement.
 * Tambah, hapus, urutkan, kembalikan bawaan; satu tombol simpan untuk semua. Nilai terkunci (dipakai
 * logika kode) tidak bisa dihapus. Data lama yang memakai nilai yang dihapus tetap utuh dan tetap
 * tampil saat diedit (denganNilai). Aturan: lib/daftar-pilihan-bawaan.ts.
 */
import React, { useEffect, useState } from 'react';
import { DAFTAR_PILIHAN, type DefDaftar, type KunciDaftar, MAKS_ITEM, MAKS_PANJANG, muatDaftarPilihan, rapikanDaftar, semuaDaftarPilihan, simpanDaftarPilihan, type SemuaDaftar } from '@/lib/daftar-pilihan';

const sama = (a: string[], b: string[]) => a.join('\u0000') === b.join('\u0000');

function KartuDaftar({ d, isi, onUbah }: { d: DefDaftar; isi: string[]; onUbah: (v: string[]) => void }) {
  const [baru, setBaru] = useState('');
  const [galat, setGalat] = useState('');
  const kunci = new Set((d.terkunci ?? []).map(x => x.toLowerCase()));
  const tambah = () => {
    const v = baru.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (isi.some(x => x.toLowerCase() === v.toLowerCase())) { setGalat(`"${v}" sudah ada.`); return; }
    if (isi.length >= MAKS_ITEM) { setGalat(`Maksimal ${MAKS_ITEM} pilihan.`); return; }
    onUbah([...isi, v.slice(0, MAKS_PANJANG)]); setBaru(''); setGalat('');
  };
  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= isi.length) return;
    const v = [...isi]; [v[i], v[j]] = [v[j], v[i]]; onUbah(v);
  };
  const diubah = !sama(isi, d.bawaan);
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-800 text-sm">{d.judul} <span className="text-slate-500 font-semibold">· {isi.length}</span>
            {diubah && <span className="ml-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">diubah</span>}</h3>
          <p className="text-slate-500 text-xs mt-0.5"><b className="text-slate-600">{d.menu}</b> - {d.ket}</p>
        </div>
        {diubah && (
          <button type="button" onClick={() => onUbah([...d.bawaan])}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Kembalikan bawaan</button>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <input value={baru} onChange={e => { setBaru(e.target.value); setGalat(''); }} maxLength={MAKS_PANJANG}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tambah(); } }}
            placeholder={`Tambah ${d.judul.toLowerCase()}…`} aria-label={`Tambah ${d.judul}`}
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3.5 py-2.5 text-base sm:text-sm outline-none focus:border-slate-400 bg-white" />
          <button type="button" onClick={tambah}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white flex-shrink-0 hover:opacity-90" style={{ background: 'linear-gradient(135deg,#0f766e,#115e59)' }}>Tambah</button>
        </div>
        {galat && <p className="text-xs font-semibold text-rose-700">{galat}</p>}
        <div className="flex flex-wrap gap-1.5">
          {isi.map((x, i) => {
            const terkunci = kunci.has(x.toLowerCase());
            return (
              <span key={x} className="inline-flex items-center gap-0.5 pl-2.5 pr-1 py-1 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                {terkunci && <span title="Dipakai logika menu - tidak bisa dihapus" aria-label="terkunci">🔒</span>}
                <span className="mx-0.5">{x}</span>
                <button type="button" onClick={() => geser(i, -1)} disabled={i === 0} aria-label={`Geser ${x} ke kiri`}
                  className="w-5 h-5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30">‹</button>
                <button type="button" onClick={() => geser(i, 1)} disabled={i === isi.length - 1} aria-label={`Geser ${x} ke kanan`}
                  className="w-5 h-5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30">›</button>
                {!terkunci && (
                  <button type="button" onClick={() => onUbah(isi.filter((_, j) => j !== i))} disabled={isi.length <= 1} aria-label={`Hapus ${x}`}
                    className="w-5 h-5 rounded-md text-slate-500 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-30">✕</button>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DaftarPilihanInline() {
  const [isi, setIsi] = useState<SemuaDaftar | null>(null);
  const [awal, setAwal] = useState<SemuaDaftar | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null);

  useEffect(() => {
    void muatDaftarPilihan().then(() => { const s = semuaDaftarPilihan(); setIsi(s); setAwal(s); });
  }, []);

  if (!isi || !awal) return <div className="p-4 text-sm text-slate-500">Memuat daftar pilihan…</div>;
  const berubah = DAFTAR_PILIHAN.some(d => !sama(isi[d.k], awal[d.k]));
  const ubah = (k: KunciDaftar, v: string[]) => setIsi(s => s && { ...s, [k]: v });
  const simpan = async () => {
    setMenyimpan(true);
    const rapi = Object.fromEntries(DAFTAR_PILIHAN.map(d => [d.k, rapikanDaftar(isi[d.k], d)])) as SemuaDaftar;
    const { error } = await simpanDaftarPilihan(rapi);
    setMenyimpan(false);
    if (error) { setKabar({ jenis: 'gagal', teks: 'Gagal menyimpan: ' + error }); return; }
    setIsi(rapi); setAwal(rapi);
    setKabar({ jenis: 'ok', teks: 'Daftar pilihan tersimpan - langsung dipakai di semua menu.' });
    setTimeout(() => setKabar(null), 4000);
  };

  const kelompok = Array.from(new Set(DAFTAR_PILIHAN.map(d => d.menu.split(' · ')[0])));
  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-3 text-xs text-teal-900 leading-relaxed">
        Isi dropdown di menu-menu berikut diatur di sini, tanpa menunggu pembaruan aplikasi. Menghapus pilihan
        <b> tidak mengubah data lama</b> - data yang sudah memakai nilai itu tetap utuh dan tetap tampil saat diedit.
        Pilihan bertanda 🔒 dipakai logika menu (mis. isian tamu Demo Product) sehingga tidak bisa dihapus.
      </div>
      {kabar && (
        <div role="status" className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold border ${kabar.jenis === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>{kabar.teks}</div>
      )}
      {kelompok.map(g => (
        <section key={g} className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{g}</h2>
          {DAFTAR_PILIHAN.filter(d => d.menu.startsWith(g)).map(d => <KartuDaftar key={d.k} d={d} isi={isi[d.k]} onUbah={v => ubah(d.k, v)} />)}
        </section>
      ))}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center justify-end gap-2">
        {berubah && <p className="text-[11px] text-amber-700 font-semibold mr-auto">Ada perubahan yang belum disimpan.</p>}
        {berubah && <button type="button" onClick={() => setIsi(awal)} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Batal</button>}
        <button type="button" onClick={simpan} disabled={menyimpan || !berubah}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 hover:opacity-90" style={{ background: 'linear-gradient(135deg,#0f766e,#115e59)' }}>
          {menyimpan ? 'Menyimpan…' : 'Simpan Daftar Pilihan'}
        </button>
      </div>
    </div>
  );
}
