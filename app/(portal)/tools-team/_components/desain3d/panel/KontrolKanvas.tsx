'use client';
/**
 * Kontrol di atas kanvas 3D, tata letak gaya aplikasi CAD - tiap kelompok punya satu tempat tetap:
 *   kiri          rel alat (BilahKiri): Tambah, teks · pilih banyak, penggaris, snap
 *   tengah-atas   benda terpilih: SATU baris (AksiTerpilih) - geser / putar, panel Geser, menu Lainnya; geser tepat di bawahnya
 *   kiri-bawah    menu Tampilan (centang dikelompokkan) - dulu deretan chip yang menutupi kanvas
 *   kanan-bawah   navigasi kamera (NavKamera)
 *   kanan-atas    daftar benda (DaftarKanvas, tombol Benda di bilah atas): cari, tampil / sembunyikan, isolasi, pusatkan
 */
import { useEffect, useState } from 'react';
import { DISPLAY, nirkabel } from '../inti';
import { ChevronUp, Layers3 } from 'lucide-react';
import { AksiTerpilih } from './AksiTerpilih';
import { GeserTepat } from './GeserTepat';
import { BilahKiri } from './BilahKiri';
import { DaftarKanvas } from './DaftarKanvas';
import { judulMenu, panelKanvas } from './gaya';
import type { AlatDesain } from './alat';

interface Centang { v: boolean; s: (v: boolean) => void; l: string }

export function KontrolKanvas({ a }: { a: AlatDesain }) {
  const { sinarNyata, setSinarNyata, sembunyiTeks, setSembunyiTeks, jarakDinding, setJarakDinding, teksSinar, setTeksSinar, adaProyektor, bayangan, benda, detailBlending, garisUkur, gridSinar, setGridSinar, jangkau, jumlahProyektor, kabel, kabelPower, kerucut, labelProduk, setBayangan, setDetailBlending, setGarisUkur, setJangkau, setKabelPower, setKerucut, setLabelProduk, setSinar, setTampilBlending, setTampilKabel, setUkur, sinar, tampilBlending, tampilKabel, tampilShare, setTampilShare, terpilih, ukur, alatKanvas } = a.K;
  //  Geser tepat terikat ke benda yang terpilih saat dibuka - pilih benda lain = otomatis tertutup.
  const [geser, setGeser] = useState<{ id: string; teks: string } | null>(null);
  const geserAktif = geser && geser.id === terpilih?.id ? geser : null;
  //  Menu Tampilan: tertutup saat halaman dibuka (keadaan lokal - tidak dibaca dari penyimpanan, jadi tidak ada
  //  beda tampilan server / peramban saat hidrasi).
  const [tampilanBuka, setTampilanBuka] = useState(false);
  //  Ketik angka (atau -) saat benda terpilih = buka Geser tepat dengan angka itu.
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!terpilih || terpilih.terkunci || geserAktif || alatKanvas !== 'pilih' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role=dialog]')) return;
      if (/^[0-9-]$/.test(e.key)) { e.preventDefault(); setGeser({ id: terpilih.id, teks: e.key }); }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [terpilih, geserAktif, alatKanvas]);

  const kelompok: { judul: string; isi: Centang[] }[] = ([
    { judul: 'Ukuran & label', isi: [
      { v: ukur, s: setUkur, l: 'Ukuran' },
      //  Jarak benda terpilih ke dinding: bawaan mati (lima angka mm menutupi gambar).
      { v: jarakDinding, s: setJarakDinding, l: 'Jarak ke dinding' },
      ...(benda.some(b => DISPLAY.includes(b.jenis)) ? [{ v: garisUkur, s: setGarisUkur, l: 'Garis ukuran (mm)' }] : []),
      { v: labelProduk, s: setLabelProduk, l: 'Label produk' },
      //  Satu sakelar untuk SEMUA tulisan di kanvas (label, ukuran, angka blending, keterangan di cahaya).
      { v: !sembunyiTeks, s: (v: boolean) => setSembunyiTeks(!v), l: 'Tulisan di kanvas' },
    ] },
    { judul: 'Analisis', isi: [
      { v: kerucut, s: setKerucut, l: 'Sudut pandang' },
      ...(benda.some(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon') ? [{ v: jangkau, s: setJangkau, l: 'Jangkauan speaker' }] : []),
      ...(kabel.length ? [{ v: tampilKabel, s: setTampilKabel, l: 'Jalur kabel' }] : []),
      ...(kabel.length && tampilKabel ? [{ v: kabelPower, s: setKabelPower, l: 'Kabel power' }] : []),
      ...(benda.some(nirkabel) ? [{ v: tampilShare, s: setTampilShare, l: 'Share nirkabel' }] : []),
    ] },
    { judul: 'Proyektor', isi: adaProyektor ? [
      { v: sinar, s: setSinar, l: 'Sinar proyektor' },
      //  Sinar nyata: proyektor = lampu bergambar (lumen vs cahaya ruangan, bayangan, bahan); mati = penanda warna.
      ...(sinar ? [{ v: sinarNyata, s: setSinarNyata, l: 'Sinar nyata' }] : []),
      //  Mode grid: gambar tiap proyektor sebagai pola garis 16 x 9 (bentuk & sambungan antar gambar terlihat).
      ...(sinar ? [{ v: gridSinar, s: setGridSinar, l: 'Grid sinar' }] : []),
      ...(sinar ? [{ v: teksSinar, s: setTeksSinar, l: 'Keterangan sinar' }] : []),
      ...(jumlahProyektor >= 2 ? [{ v: tampilBlending, s: setTampilBlending, l: 'Area blending' }] : []),
      //  Zona ungu, garis ukur & angka cm ikut "Area blending"; kartu keterangan (persen & piksel) bawaannya
      //  tersembunyi - centang ini untuk semua, atau klik ⓘ di angka cm untuk satu area.
      ...(jumlahProyektor >= 2 && tampilBlending ? [{ v: detailBlending, s: setDetailBlending, l: 'Keterangan blending' }] : []),
    ] : [] },
    { judul: 'Render', isi: [{ v: bayangan, s: setBayangan, l: 'Bayangan & cahaya' }] },
  ] as { judul: string; isi: Centang[] }[]).filter(k => k.isi.length);
  const jumlahAktif = kelompok.reduce((n, k) => n + k.isi.filter(c => c.v).length, 0);

  return (
    <>
      {/* Kiri: rel alat. */}
      <div className="kontrol-kanvas lapis-tembus absolute left-2 top-2 z-10 flex flex-col items-start gap-1.5">
        <BilahKiri a={a} />
      </div>

      {/* Tengah-atas: semua yang berlaku untuk benda terpilih, berkumpul di satu tempat. */}
      {terpilih && (
        <div className="kontrol-kanvas lapis-tembus absolute left-1/2 -translate-x-1/2 top-2 z-10 flex flex-col items-center gap-1.5 max-w-[calc(100%-120px)]">
          <AksiTerpilih a={a} onGeserTepat={() => terpilih && setGeser({ id: terpilih.id, teks: '' })} />
          {geserAktif && <GeserTepat a={a} awal={geserAktif.teks} onTutup={() => setGeser(null)} />}
        </div>
      )}

      {/* Kiri-bawah: menu Tampilan. */}
      <div className="kontrol-kanvas absolute left-2 bottom-2 z-10">
        <button type="button" onClick={() => setTampilanBuka(v => !v)} aria-expanded={tampilanBuka} aria-haspopup="dialog"
          title="Pilih yang tampil di kanvas: ukuran, label, sinar proyektor, kabel, bayangan"
          className={`inline-flex items-center gap-1.5 h-9 px-3 ${panelKanvas} text-[12.5px] font-semibold ${tampilanBuka ? 'text-blue-800 border-blue-300' : 'text-slate-700 hover:bg-slate-50'}`}>
          <Layers3 size={16} /> Tampilan
          <span className="min-w-5 h-5 px-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 grid place-items-center">{jumlahAktif}</span>
          <ChevronUp size={14} className={`transition-transform ${tampilanBuka ? '' : 'rotate-180'}`} />
        </button>
        {tampilanBuka && (
          <>
            <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setTampilanBuka(false)} />
            <div role="dialog" aria-label="Pilihan tampilan" className={`absolute left-0 bottom-full mb-1.5 z-30 w-60 max-h-[min(70vh,460px)] overflow-y-auto ${panelKanvas} p-1.5`}>
              {kelompok.map(k => (
                <div key={k.judul}>
                  <p className={judulMenu}>{k.judul}</p>
                  {k.isi.map(c => (
                    <label key={c.l} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-[12.5px] text-slate-800 hover:bg-slate-50 cursor-pointer">
                      {c.l}
                      <input type="checkbox" className="w-4 h-4 accent-blue-700" checked={c.v} onChange={e => c.s(e.target.checked)} />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <DaftarKanvas a={a} />
    </>
  );
}
