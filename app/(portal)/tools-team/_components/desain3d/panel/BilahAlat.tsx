'use client';
/**
 * Bilah atas Desain 3D - SATU baris (gaya aplikasi CAD): nama berkas & status · Kategori / Ruangan / Benda ·
 * Buka / Simpan / undo · sudut pandang · Ekspor (PNG, DXF, BOM, checklist, cetak, salin, .glb) · bantuan · layar
 * penuh. Dulu dua baris dengan belasan tombol sejajar; ekspor, salin, cetak & .glb kini satu menu.
 */
import { useState } from 'react';
import { ModalChecklistBom } from './ModalChecklistBom';
import { IdentitasBerkas, BANTUAN_KONTROL } from './BilahBerkas';
import { itemMenu, judulMenu, menuMelayang, pemisah, tombol, tombolAktif, tombolIkon, tombolUtama } from './gaya';
import { Ikon } from '@/components/shared/Ikon';
import { ChevronDown, Download, FolderOpen, HelpCircle, LayoutTemplate, Maximize2, Minimize2, Redo2, Save, Undo2 } from 'lucide-react';
import type { AlatDesain } from './alat';

export function BilahAlat({ a }: { a: AlatDesain }) {
  const { benda, bukaSisi, hanyaLihat, layarPenuh, riwayat, setLayarPenuh, setModal, setPesan, sisi, tampilan } = a.K;
  const { pilihSudut } = a.kamera;
  const { denahCetak, setDenahCetak, cetak, draftChecklist, jalankanPng, menuPng, pngLembar, ringkasan, setMenuPng, sibukPng, unduhBomExcel, unduhDxf, unduhEmpatTampak, unduhFoto } = a.ekspor;
  const { namaDesain } = a.K;
  const [checklistBuka, setChecklistBuka] = useState(false);
  const { unduhGLB } = a.simpan;
  const tutup = (f: () => unknown) => () => { setMenuPng(false); void f(); };
  const salin = async () => {
    try { await navigator.clipboard.writeText(ringkasan()); setPesan('Ringkasan desain tersalin - tempel di WA / penawaran.'); }
    catch { setPesan('Gagal menyalin - izinkan akses clipboard di peramban.'); }
  };
  const kelompokEkspor: { judul: string; item: [string, string, () => unknown][] }[] = [
    { judul: 'Gambar PNG', item: [
      ['Tampilan sekarang', 'Sudut kamera saat ini', () => unduhFoto('sekarang', 'tampilan')],
      ['Denah dari atas', 'Tata letak & ukuran', () => unduhFoto('atas', 'denah')],
      ['Tampak depan', 'Menghadap dinding depan', () => unduhFoto('depan', 'tampak depan')],
      ['Tampak samping', 'Dari sisi kanan ruang', () => unduhFoto('kiri', 'tampak samping')],
      ['4 tampak dalam 1 gambar', 'Perspektif, denah, depan, samping', unduhEmpatTampak],
      ['Lembar lengkap', 'Sama dengan Cetak, sebagai gambar', () => jalankanPng(pngLembar)],
    ] },
    { judul: 'Dokumen', item: [
      ['Cetak lembar', 'Lembar A4: gambar, daftar perangkat, catatan', cetak],
      ['Denah CAD (.dxf)', 'AutoCAD · ukuran mm, per lapis', unduhDxf],
      ['BOM Excel (.xlsx)', 'Perangkat, aksesori, isi rack, kabel', unduhBomExcel],
      ['Jadikan checklist proyek', 'Checklist instalasi di Project Progress', () => setChecklistBuka(true)],
      ['Salin ringkasan', 'Teks daftar perangkat untuk WA / penawaran', salin],
    ] },
    { judul: 'Berkas', item: [
      ['Simpan ke laptop (.glb)', 'Buka lagi di sini, SketchUp atau Blender', unduhGLB],
    ] },
  ];
  const sudut = ([['3d', '3D', 'iso'], ['atas', 'Atas', 'atas'], ['kursi', 'Dari kursi', 'kursi']] as const);
  return (
    <>
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-200 bg-white flex-wrap" role="toolbar" aria-label="Bilah Desain 3D">
        <IdentitasBerkas a={a} />
        <span className={pemisah} aria-hidden />
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => bukaSisi('kategori')} aria-pressed={sisi === 'kategori'} className={sisi === 'kategori' ? tombolAktif : tombol}
            title="Template ruangan: meeting, auditorium, smart classroom, mapping, immersive"><LayoutTemplate size={15} /> <span className="hidden lg:inline">Kategori</span></button>
          <button type="button" onClick={() => bukaSisi('ruang')} aria-pressed={sisi === 'ruang'} className={sisi === 'ruang' ? tombolAktif : tombol}
            title="Ukuran ruangan, cahaya, dinding, pintu & jendela"><Ikon nama="🏠" ukuran={15} /> <span className="hidden lg:inline">Ruangan</span></button>
          <button type="button" onClick={() => bukaSisi('daftar')} aria-pressed={sisi === 'daftar'} className={sisi === 'daftar' ? tombolAktif : tombol}
            title="Daftar semua benda di desain"><Ikon nama="📋" ukuran={15} /> <span className="hidden lg:inline">Benda</span>
            <span className="min-w-5 h-5 px-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 grid place-items-center">{benda.length}</span></button>
        </div>
        <span className={pemisah} aria-hidden />
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setModal('buka')} className={tombol} title="Buka desain tersimpan / dari laptop"><FolderOpen size={15} /> <span className="hidden xl:inline">Buka</span></button>
          {!hanyaLihat && <button type="button" onClick={() => setModal('simpan')} className={tombolUtama} title="Simpan desain ke server"><Save size={15} /> <span className="hidden xl:inline">Simpan</span></button>}
          <div className="inline-flex" role="group" aria-label="Undo dan redo">
            <button type="button" onClick={riwayat.undo} disabled={!riwayat.bisaUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={`${tombolIkon} rounded-r-none`}><Undo2 size={15} /></button>
            <button type="button" onClick={riwayat.redo} disabled={!riwayat.bisaRedo} title="Redo (Ctrl+Y)" aria-label="Redo" className={`${tombolIkon} rounded-l-none border-l-0`}><Redo2 size={15} /></button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div role="radiogroup" aria-label="Sudut pandang" className="inline-flex h-8 p-0.5 rounded-lg bg-slate-100">
            {sudut.map(([v, l, s]) => (
              <button key={v} type="button" role="radio" aria-checked={tampilan === v} onClick={() => pilihSudut(s)}
                className={`px-2.5 rounded-md text-[12.5px] font-semibold whitespace-nowrap ${tampilan === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
            ))}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setMenuPng(v => !v)} aria-expanded={menuPng} aria-haspopup="menu" disabled={sibukPng} className={menuPng ? tombolAktif : tombol}
              title="Unduh gambar, denah CAD, BOM Excel, cetak, salin ringkasan, simpan .glb">
              <Download size={15} /> <span className="hidden sm:inline">{sibukPng ? 'Membuat...' : 'Ekspor'}</span> <ChevronDown size={13} />
            </button>
            {menuPng && (<>
              <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuPng(false)} />
              <div className={`absolute right-0 top-full mt-1.5 w-72 max-h-[70vh] overflow-y-auto ${menuMelayang}`} role="menu">
                {kelompokEkspor.map(k => (
                  <div key={k.judul}>
                    <p className={judulMenu}>{k.judul}</p>
                    {k.item.map(([l, ket, aksi]) => (
                      <button key={l} type="button" role="menuitem" onClick={tutup(aksi)} className={itemMenu}>
                        <span className="block text-[13px] font-semibold text-slate-900">{l}</span>
                        <span className="block text-[11.5px] text-slate-500">{ket}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <label className="flex items-center justify-between gap-2 mx-1.5 mt-1 px-1.5 pt-2 border-t border-slate-100 text-[12.5px] font-semibold text-slate-800 cursor-pointer" title="Sertakan denah 2D berskala di Cetak & Lembar lengkap">
                  Denah 2D di Cetak
                  <input type="checkbox" className="w-4 h-4" checked={denahCetak} onChange={e => setDenahCetak(e.target.checked)} />
                </label>
                <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500">Label yang sedang tampil ikut tergambar. Resolusi 2× layar.</p>
              </div>
            </>)}
          </div>
          <span tabIndex={0} className={`${tombolIkon} cursor-help`} aria-label={`Bantuan kontrol: ${BANTUAN_KONTROL}`} title={BANTUAN_KONTROL}><HelpCircle size={15} /></span>
          <button type="button" onClick={() => setLayarPenuh(v => !v)} aria-pressed={layarPenuh} className={tombolIkon}
            title={layarPenuh ? 'Keluar layar penuh (Esc)' : 'Layar penuh'} aria-label={layarPenuh ? 'Keluar layar penuh' : 'Layar penuh'}>
            {layarPenuh ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>
      {checklistBuka && <ModalChecklistBom judulAwal={namaDesain || 'Ruang AV'} buatDraft={draftChecklist} onTutup={() => setChecklistBuka(false)} />}
    </>
  );
}
