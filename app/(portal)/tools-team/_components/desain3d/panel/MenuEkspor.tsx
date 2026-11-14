'use client';
import type React from 'react';
import { useState } from 'react';
import {
  Box, Camera, ClipboardCopy, Download, DraftingCompass, FileImage, FileSpreadsheet, Grid2x2, ListChecks, Map as Denah, PanelLeft, Printer, RectangleHorizontal,
} from 'lucide-react';
import { GarisMenu, ItemMenu, JudulMenu, Menu, Sakelar } from '../../bersama/MenuBilah';
import { ModalChecklistBom } from './ModalChecklistBom';
import type { AlatDesain } from './alat';

type Item = [React.ElementType, string, string, () => unknown];

export function MenuEkspor({ a }: { a: AlatDesain }) {
  const { namaDesain, setPesan } = a.K;
  const { denahCetak, setDenahCetak, cetak, draftChecklist, jalankanPng, menuPng, pngLembar, ringkasan, setMenuPng, sibukPng, unduhBomExcel, unduhDxf, unduhEmpatTampak, unduhFoto } = a.ekspor;
  const [checklistBuka, setChecklistBuka] = useState(false);
  const salin = async () => {
    try { await navigator.clipboard.writeText(ringkasan()); setPesan('Ringkasan desain tersalin - tempel di WA / penawaran.'); }
    catch { setPesan('Gagal menyalin - izinkan akses clipboard di peramban.'); }
  };
  const kelompok: { judul: string; ket?: string; item: Item[] }[] = [
    { judul: 'Gambar PNG', ket: 'Label yang sedang tampil ikut tergambar. Resolusi 2× layar.', item: [
      [Camera, 'Tampilan sekarang', 'Sudut kamera saat ini', () => unduhFoto('sekarang', 'tampilan')],
      [Denah, 'Denah dari atas', 'Tata letak & ukuran', () => unduhFoto('atas', 'denah')],
      [RectangleHorizontal, 'Tampak depan', 'Menghadap dinding depan', () => unduhFoto('depan', 'tampak depan')],
      [PanelLeft, 'Tampak samping', 'Dari sisi kanan ruang', () => unduhFoto('kiri', 'tampak samping')],
      [Grid2x2, '4 tampak dalam 1 gambar', 'Perspektif, denah, depan, samping', unduhEmpatTampak],
      [FileImage, 'Lembar lengkap', 'Sama dengan Cetak, sebagai gambar', () => jalankanPng(pngLembar)],
    ] },
    { judul: 'Dokumen', item: [
      [Printer, 'Cetak lembar A4', 'Gambar, daftar perangkat, catatan', cetak],
      [DraftingCompass, 'Denah CAD (.dxf)', 'AutoCAD · ukuran mm, per lapis', unduhDxf],
      [FileSpreadsheet, 'BOM Excel (.xlsx)', 'Perangkat, aksesori, isi rack, kabel', unduhBomExcel],
      [ListChecks, 'Jadikan checklist proyek', 'Checklist instalasi di Project Progress', () => setChecklistBuka(true)],
      [ClipboardCopy, 'Salin ringkasan', 'Teks daftar perangkat untuk WA / penawaran', salin],
    ] },
    { judul: 'Model 3D', item: [
      [Box, 'Simpan ke laptop (.glb)', 'Buka lagi di sini, SketchUp atau Blender', a.simpan.unduhGLB],
    ] },
  ];
  return (
    <>
      <Menu label="Ekspor: gambar, denah CAD, BOM Excel, cetak, ringkasan, model .glb" ikon={Download} teks={sibukPng ? 'Membuat...' : 'Ekspor'} utama kanan lebar="w-72"
        buka={menuPng} onBuka={setMenuPng} disabled={sibukPng}>
        {kelompok.map((k, i) => (
          <div key={k.judul}>
            {i > 0 && <GarisMenu />}
            <JudulMenu><span title={k.ket}>{k.judul}</span></JudulMenu>
            {k.item.map(([Ikon, l, ket, aksi]) => <ItemMenu key={l} ikon={Ikon} label={l} judul={ket} onClick={() => void aksi()} />)}
          </div>
        ))}
        <GarisMenu />
        <div className="px-2.5 py-1.5">
          <Sakelar label="Denah 2D di Cetak" nilai={denahCetak} onUbah={setDenahCetak} judul="Sertakan denah 2D berskala di Cetak & Lembar lengkap" />
        </div>
      </Menu>
      {checklistBuka && <ModalChecklistBom judulAwal={namaDesain || 'Ruang AV'} buatDraft={draftChecklist} onTutup={() => setChecklistBuka(false)} />}
    </>
  );
}
