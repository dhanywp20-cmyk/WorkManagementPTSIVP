'use client';
/** Kontrol di atas kanvas 3D: centang tampilan, aksi benda terpilih, pesan, kontrol kamera & menu sudut. */
import { DISPLAY, duplikatBanyak, nirkabel, ruangDari } from '../inti';
import { BoxSelect, Copy, CopyPlus, Maximize2, Minimize2, Settings2, Trash2 } from 'lucide-react';
import type { AlatDesain } from './alat';

export function KontrolKanvas({ a }: { a: AlatDesain }) {
  const { adaProyektor, bayangan, benda, chipBuka, detailBlending, duaRuang, garisUkur, gridSinar, setGridSinar, jangkau, jumlahProyektor, kabel, kabelPower, kerucut, kotakRuang, labelProduk, panel, ruang, setBayangan, setBenda, setChipBuka, setDetailBlending, setGarisUkur, setJangkau, setKabelPower, setKerucut, setLabelProduk, setPanel, setPilih, setSinar, setSisi, setTampilBlending, setTampilKabel, setUkur, sinar, tampilBlending, tampilKabel, tampilShare, setTampilShare, terpilih, ukur, pilihLain, setPilihan, modeBanyak, setModeBanyak, layarPenuh, setLayarPenuh, batas } = a.K;
  const { duplikat, salinKeRuangLain } = a.aksi;
  return (
    <>
      <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-16px)]">
        <button type="button" onClick={() => setChipBuka(v => !v)} aria-expanded={chipBuka}
          className="sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 border border-slate-200 text-[12px] font-bold text-slate-700 shadow-sm">
          <Settings2 size={14} /> Tampilan {chipBuka ? '▴' : '▾'}
        </button>
        <div className={`${chipBuka ? 'flex' : 'hidden'} sm:flex gap-1.5 flex-wrap`}>
          {[{ v: ukur, s: setUkur, l: 'Ukuran' },
            ...(benda.some(b => DISPLAY.includes(b.jenis)) ? [{ v: garisUkur, s: setGarisUkur, l: 'Garis ukuran (mm)' }] : []),
            { v: labelProduk, s: setLabelProduk, l: 'Label produk' },
            { v: kerucut, s: setKerucut, l: 'Sudut pandang' },
            ...(adaProyektor ? [{ v: sinar, s: setSinar, l: 'Sinar proyektor' }] : []),
            //  Mode grid: gambar tiap proyektor sebagai pola garis 16 x 9 (bentuk & sambungan antar gambar terlihat).
            ...(adaProyektor && sinar ? [{ v: gridSinar, s: setGridSinar, l: 'Grid sinar' }] : []),
            ...(jumlahProyektor >= 2 ? [{ v: tampilBlending, s: setTampilBlending, l: 'Area blending' }] : []),
            //  Garis ukur & angka cm ikut "Area blending"; kartu keterangan (persen & piksel) bisa disembunyikan sendiri.
            ...(jumlahProyektor >= 2 && tampilBlending ? [{ v: detailBlending, s: setDetailBlending, l: 'Detail blending' }] : []),
            ...(benda.some(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon') ? [{ v: jangkau, s: setJangkau, l: 'Jangkauan speaker' }] : []),
            ...(kabel.length ? [{ v: tampilKabel, s: setTampilKabel, l: 'Jalur kabel' }] : []),
            ...(benda.some(nirkabel) ? [{ v: tampilShare, s: setTampilShare, l: 'Share nirkabel' }] : []),
            ...(kabel.length && tampilKabel ? [{ v: kabelPower, s: setKabelPower, l: 'Kabel power' }] : []),
            { v: bayangan, s: setBayangan, l: 'Bayangan & cahaya' }].map(t => (
            <label key={t.l} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-[11.5px] font-semibold text-slate-700 shadow-sm">
              <input type="checkbox" checked={t.v} onChange={e => t.s(e.target.checked)} /> {t.l}
            </label>
          ))}
        </div>
        {/* Aksi benda terpilih: kiri-atas, di atas tombol seret/zoom. Ponsel: deret ikon mendatar (hemat tinggi); layar lebar: kolom bertulisan. */}
        {terpilih && (
          <div className="flex flex-row sm:flex-col gap-1 rounded-xl bg-white/95 border border-slate-200 shadow-sm p-1" role="toolbar" aria-label={`Aksi ${terpilih.nama}`}>
            {pilihLain.length > 0 && (
              <span className="self-center px-2 py-0.5 rounded-full bg-blue-700 text-white text-[11.5px] font-bold" title="Benda terpilih">{pilihLain.length + 1}</span>
            )}
            <button type="button" onClick={() => { setSisi(null); setPanel(p => !p); }} aria-pressed={panel} title="Atur ukuran, posisi & pilihan benda"
              className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${panel ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
              <Settings2 size={15} /> <span className="sr-only sm:not-sr-only">Atur</span>
            </button>
            <button type="button" onClick={() => {
              if (!pilihLain.length) { duplikat(terpilih); return; }
              const h = duplikatBanyak(benda, [terpilih.id, ...pilihLain], batas.x);
              setBenda(h.benda); setPilihan(h.baru[0]?.id ?? null, h.baru.slice(1).map(b => b.id));
            }} title={pilihLain.length ? 'Duplikat semua yang terpilih' : 'Duplikat benda ini'}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-slate-100">
              <Copy size={15} /> <span className="sr-only sm:not-sr-only">Duplikat</span>
            </button>
            {duaRuang && (
              <button type="button" onClick={() => salinKeRuangLain(terpilih)} title={`Salin ke Ruang ${(ruangDari(ruang, terpilih.x) + 1) % kotakRuang.length + 1}`}
                className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-slate-100">
                <CopyPlus size={15} /> <span className="sr-only sm:not-sr-only">Salin ke Ruang {(ruangDari(ruang, terpilih.x) + 1) % kotakRuang.length + 1}</span>
              </button>
            )}
            <button type="button" onClick={() => { const ids = new Set([terpilih.id, ...pilihLain]); setBenda(b => b.filter(x => !ids.has(x.id))); setPilih(null); }} title={pilihLain.length ? 'Hapus semua yang terpilih' : 'Hapus benda ini'}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-rose-700 hover:bg-rose-50">
              <Trash2 size={15} /> <span className="sr-only sm:not-sr-only">Hapus</span>
            </button>
          </div>
        )}
        {/*  Mode pilih banyak (layar sentuh tanpa Shift / Ctrl). */}
        <button type="button" onClick={() => setModeBanyak(v => !v)} aria-pressed={modeBanyak}
          title={modeBanyak ? 'Pilih banyak: aktif - ketuk benda untuk menambah / melepas' : 'Pilih banyak (atau Shift / Ctrl + klik)'} aria-label="Pilih banyak"
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border shadow-sm ${modeBanyak ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
          <BoxSelect size={16} />
        </button>
      </div>
      <button type="button" onClick={() => setLayarPenuh(v => !v)} aria-pressed={layarPenuh}
        title={layarPenuh ? 'Keluar layar penuh (Esc)' : 'Layar penuh'} aria-label={layarPenuh ? 'Keluar layar penuh' : 'Layar penuh'}
        className="absolute right-2 top-2 z-10 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/95 border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">
        {layarPenuh ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </>
  );
}
