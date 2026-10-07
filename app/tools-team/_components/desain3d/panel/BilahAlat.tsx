'use client';
/** Bilah alat: kategori, tambah, ruangan, daftar benda, pusatkan, buka/simpan, undo, sudut pandang, PNG, cetak. */
import { Segmen, TombolSalin } from '../../bersama/ui';
import { tombol, tombolAktif, tombolUtama } from './gaya';
import { Ikon } from '@/components/shared/Ikon';
import { AlignCenterVertical, FolderOpen, HardDriveDownload, LayoutTemplate, Redo2, Undo2 } from 'lucide-react';
import type { AlatDesain } from './alat';

export function BilahAlat({ a }: { a: AlatDesain }) {
  const { benda, bukaSisi, hanyaLihat, menuPusat, riwayat, setMenuPusat, setModal, sisi, tampilan } = a.K;
  const { pilihSudut } = a.kamera;
  const { pusatkan } = a.aksi;
  const { cetak, jalankanPng, menuPng, pngLembar, ringkasan, setMenuPng, sibukPng, unduhEmpatTampak, unduhFoto } = a.ekspor;
  const { unduhGLB } = a.simpan;
  return (
    <>
      {/* Bilah alat */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => bukaSisi('kategori')} aria-pressed={sisi === 'kategori'} className={sisi === 'kategori' ? tombolAktif : tombol}
            title="Template ruangan: meeting, auditorium, smart classroom, mapping, immersive"><LayoutTemplate size={14} /> <span className="sr-only sm:not-sr-only">Kategori</span></button>
          <button type="button" onClick={() => bukaSisi('tambah')} aria-pressed={sisi === 'tambah'} className={`${tombolUtama} ${sisi === 'tambah' ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}><Ikon nama="➕" ukuran={14} /> Tambah</button>
          <button type="button" onClick={() => bukaSisi('ruang')} aria-pressed={sisi === 'ruang'} className={sisi === 'ruang' ? tombolAktif : tombol}><Ikon nama="🏠" ukuran={14} /> <span className="sr-only sm:not-sr-only">Ruangan</span></button>
          <button type="button" onClick={() => bukaSisi('daftar')} aria-pressed={sisi === 'daftar'} className={sisi === 'daftar' ? tombolAktif : tombol}><Ikon nama="📋" ukuran={14} /> <span className="sr-only sm:not-sr-only">Benda</span> ({benda.length})</button>
          <div className="relative">
            <button type="button" onClick={() => setMenuPusat(v => !v)} aria-expanded={menuPusat} className={menuPusat ? tombolUtama : tombol}
              title="Geser semua benda ke tengah ruang"><AlignCenterVertical size={14} /> <span className="sr-only sm:not-sr-only">Pusatkan isi</span></button>
            {menuPusat && (<>
              <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuPusat(false)} />
              <div className="absolute left-0 top-full mt-1.5 z-30 w-64 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5">
                {([['xz', 'Tengah ruang', 'Kiri-kanan & depan-belakang'], ['x', 'Kiri-kanan saja', 'Jarak ke layar tidak berubah'], ['z', 'Depan-belakang saja', 'Posisi kiri-kanan tetap']] as const).map(([v, l, k]) => (
                  <button key={v} type="button" onClick={() => pusatkan(v)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50">
                    <span className="block text-[13px] font-bold text-slate-900">{l}</span>
                    <span className="block text-[11.5px] text-slate-600">{k}</span>
                  </button>
                ))}
                <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500 border-t border-slate-100 mt-1">
                  Meja-kursi jadi patokan tengah. Benda yang menempel dinding tetap di dindingnya; proyektor ikut layarnya.
                </p>
              </div>
            </>)}
          </div>
          <button type="button" onClick={() => setModal('buka')} className={tombol}><FolderOpen size={14} /> <span className="sr-only sm:not-sr-only">Buka</span></button>
          {!hanyaLihat && <button type="button" onClick={() => setModal('simpan')} className={tombol}><Ikon nama="💾" ukuran={14} /> <span className="sr-only sm:not-sr-only">Simpan</span></button>}
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="group" aria-label="Undo dan redo">
            <button type="button" onClick={riwayat.undo} disabled={!riwayat.bisaUndo} title="Undo (Ctrl+Z)" aria-label="Undo"
              className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"><Undo2 size={15} /></button>
            <button type="button" onClick={riwayat.redo} disabled={!riwayat.bisaRedo} title="Redo (Ctrl+Y)" aria-label="Redo"
              className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 border-l border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"><Redo2 size={15} /></button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Segmen nilai={tampilan} onUbah={v => pilihSudut(v === 'kursi' ? 'kursi' : v === 'atas' ? 'atas' : 'iso')}
            opsi={[{ v: '3d', l: '3D' }, { v: 'atas', l: 'Atas' }, { v: 'kursi', l: 'Dari kursi' }]} />
          <div className="relative">
            <button type="button" onClick={() => setMenuPng(v => !v)} aria-expanded={menuPng} disabled={sibukPng} className={menuPng ? tombolUtama : tombol}
              title="Unduh gambar PNG (label ukuran ikut tergambar)"><Ikon nama="📷" ukuran={14} /> {sibukPng ? 'Membuat...' : 'PNG ▾'}</button>
            {menuPng && (<>
              <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuPng(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-30 w-64 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5" role="menu">
                {([
                  ['Tampilan sekarang', 'Sudut kamera saat ini', () => unduhFoto('sekarang', 'tampilan')],
                  ['Denah dari atas', 'Tata letak & ukuran', () => unduhFoto('atas', 'denah')],
                  ['Tampak depan', 'Menghadap dinding depan', () => unduhFoto('depan', 'tampak depan')],
                  ['Tampak samping', 'Dari sisi kanan ruang', () => unduhFoto('kiri', 'tampak samping')],
                  ['4 tampak dalam 1 gambar', 'Perspektif, denah, depan, samping', unduhEmpatTampak],
                  ['Lembar lengkap', 'Sama dengan Cetak, sebagai gambar', () => jalankanPng(pngLembar)],
                ] as const).map(([l, k, aksi]) => (
                  <button key={l} type="button" role="menuitem" onClick={() => void aksi()} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50">
                    <span className="block text-[13px] font-bold text-slate-900">{l}</span>
                    <span className="block text-[11.5px] text-slate-600">{k}</span>
                  </button>
                ))}
                <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500 border-t border-slate-100 mt-1">Label yang sedang tampil (ukuran, sudut, sinar) ikut tergambar. Resolusi 2× layar.</p>
              </div>
            </>)}
          </div>
          <button type="button" onClick={unduhGLB} className={tombol} title="Simpan ke laptop (.glb) - bisa dibuka lagi di sini & di SketchUp/Blender, tanpa storage server">
            <HardDriveDownload size={14} /> <span className="sr-only sm:not-sr-only">Simpan .glb</span><span className="sm:hidden">.glb</span>
          </button>
          <TombolSalin teks={ringkasan} onCetak={cetak} />
        </div>
      </div>
    </>
  );
}
