'use client';
import {
  BoxSelect, Eraser, FolderOpen, HardDriveDownload, HardDriveUpload, House, Keyboard, LayoutTemplate, ListTree, Maximize2, Minimize2, MousePointer2, Plus, Redo2,
  Ruler, Save, Type, Undo2, X,
} from 'lucide-react';
import { KATALOG } from '../inti';
import { GarisMenu, ItemMenu, kelasIkon, Menu, Pemisah, Segmen, TombolIkon } from '../../bersama/MenuBilah';
import { AksiTerpilih } from './AksiTerpilih';
import { BANTUAN_KONTROL, IdentitasBerkas } from './BilahBerkas';
import { MenuEkspor } from './MenuEkspor';
import { MenuSnap, MenuTampilan } from './MenuKanvas';
import { type AlatAktif, useAlatKanvas } from './useAlatKanvas';
import type { AlatDesain } from './alat';

const ITEM_TEKS = KATALOG.flatMap(g => g.item).find(i => i.kunci === 'teks-dinding');
const ALAT: [AlatAktif, typeof MousePointer2, string, string][] = [
  ['pilih', MousePointer2, 'Pilih', 'Pilih & geser benda (V)'],
  ['banyak', BoxSelect, 'Pilih banyak', 'Pilih banyak - klik beberapa benda (atau Shift / Ctrl + klik)'],
  ['ukur', Ruler, 'Penggaris', 'Penggaris - ukur jarak dua titik (M)'],
];
const SUDUT = [['3d', '3D', 'Perspektif 3D'], ['atas', 'Atas', 'Denah dari atas'], ['kursi', 'Dari kursi', 'Sudut pandang penonton']] as const;
const KAMERA = { '3d': 'iso', atas: 'atas', kursi: 'kursi' } as const;

function StatusUkur({ a, onSelesai }: { a: AlatDesain; onSelesai: () => void }) {
  const { ruang, setRuang, titikUkur } = a.K;
  const n = ruang.penggaris?.length ?? 0;
  return (
    <div className="flex items-center gap-0.5" role="status">
      <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-rose-50 text-[12px] font-bold text-rose-700">
        <Ruler size={14} /> {titikUkur ? 'Klik titik kedua' : 'Klik titik pertama'}
      </span>
      {n > 0 && <TombolIkon ikon={Eraser} label={`Hapus ${n} garis ukur`} teks={`Hapus ${n}`} onClick={() => setRuang(r => ({ ...r, penggaris: [] }))} />}
      <TombolIkon ikon={X} label="Selesai mengukur (Esc)" teks="Selesai" onClick={onSelesai} />
    </div>
  );
}

export function BilahAlat({ a }: { a: AlatDesain }) {
  const { adaPerubahan, benda, bukaSisi, daftarKanvas, hanyaLihat, inputLaptop, layarPenuh, riwayat, setDaftarKanvas, setLayarPenuh, setModal, sisi, tampilan } = a.K;
  const alat = useAlatKanvas(a);
  return (
    <section aria-label="Toolbar Desain 3D" className="relative z-40 bg-white border-b border-slate-200 divide-y divide-slate-100">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
        <Menu label="Menu file" teks="File" lebar="w-64">
          <ItemMenu ikon={FolderOpen} label="Buka desain..." onClick={() => setModal('buka')} />
          <ItemMenu ikon={HardDriveUpload} label="Buka dari laptop (.glb)" onClick={() => inputLaptop.current?.click()} />
          <GarisMenu />
          {!hanyaLihat && <ItemMenu ikon={Save} label="Simpan & kelola desain..." onClick={() => setModal('simpan')} />}
          <ItemMenu ikon={HardDriveDownload} label="Simpan ke laptop (.glb)" onClick={() => void a.simpan.unduhGLB()} />
          <GarisMenu />
          <ItemMenu ikon={LayoutTemplate} label="Template kategori ruangan" onClick={() => bukaSisi('kategori')} />
        </Menu>
        {!hanyaLihat && (
          <button type="button" onClick={() => setModal('simpan')} title={adaPerubahan ? 'Ada perubahan belum disimpan - simpan ke server tim' : 'Simpan ke server tim'}
            className={`${kelasIkon} ${adaPerubahan ? '!bg-amber-50 !text-amber-900' : ''}`}>
            <Save size={16} /> Simpan
            {adaPerubahan && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="belum disimpan" />}
          </button>
        )}
        <IdentitasBerkas a={a} />
        <Pemisah />
        <TombolIkon ikon={Undo2} label="Batal (Ctrl+Z)" onClick={riwayat.undo} disabled={!riwayat.bisaUndo} />
        <TombolIkon ikon={Redo2} label="Ulang (Ctrl+Y)" onClick={riwayat.redo} disabled={!riwayat.bisaRedo} />
        <div className="ml-auto flex flex-wrap items-center gap-0.5">
          <TombolIkon ikon={LayoutTemplate} label="Kategori: template meeting, auditorium, smart classroom, mapping, immersive" teks="Kategori" teksKelas="hidden xl:inline"
            aktif={sisi === 'kategori'} onClick={() => bukaSisi('kategori')} />
          <TombolIkon ikon={House} label="Ruangan: ukuran, cahaya, dinding, pintu & jendela" teks="Ruangan" teksKelas="hidden xl:inline"
            aktif={sisi === 'ruang'} onClick={() => bukaSisi('ruang')} />
          <TombolIkon ikon={ListTree} label="Daftar benda (L): cari, pilih, sembunyikan, isolasi kelompok" teks="Benda" teksKelas="hidden xl:inline" lencana={benda.length}
            aktif={daftarKanvas} onClick={() => setDaftarKanvas(!daftarKanvas)} />
          <Pemisah />
          <Segmen label="Sudut pandang" nilai={tampilan} opsi={SUDUT} onPilih={v => a.kamera.pilihSudut(KAMERA[v])} />
          <Pemisah />
          <span tabIndex={0} className={`${kelasIkon} cursor-help`} aria-label={`Pintasan & kontrol: ${BANTUAN_KONTROL}`} title={BANTUAN_KONTROL}><Keyboard size={16} /></span>
          <TombolIkon ikon={layarPenuh ? Minimize2 : Maximize2} label={layarPenuh ? 'Keluar layar penuh (Esc)' : 'Layar penuh'} onClick={() => setLayarPenuh(v => !v)} />
          <span className="w-1" aria-hidden="true" />
          <MenuEkspor a={a} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
        {!hanyaLihat && (
          <button type="button" onClick={() => bukaSisi('tambah')} aria-pressed={sisi === 'tambah'} title="Tambah benda dari katalog (A)"
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 mr-1 rounded-lg text-[12.5px] font-bold border transition-colors duration-150 ${
              sisi === 'tambah' ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
            <Plus size={16} /> Tambah benda
          </button>
        )}
        <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label="Alat kanvas">
          {ALAT.map(([k, Ikon, l, t]) => {
            const aktif = alat.aktif === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={aktif} title={t} aria-label={l} onClick={() => alat.pilihAlat(k !== 'pilih' && aktif ? 'pilih' : k)}
                className={`inline-flex items-center gap-1.5 h-7 min-w-7 justify-center px-1.5 rounded-md text-[12.5px] font-bold transition-colors duration-150 ${
                  aktif ? `bg-white shadow-sm ${k === 'ukur' ? 'text-rose-700' : 'text-blue-700'}` : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'}`}>
                <Ikon size={15} />{aktif && <span className="pr-0.5">{l}</span>}
              </button>
            );
          })}
        </div>
        {!hanyaLihat && ITEM_TEKS && <TombolIkon ikon={Type} label="Tambah teks / keterangan" onClick={() => a.aksi.tambah(ITEM_TEKS)} className="ml-0.5" />}
        <Pemisah />
        <MenuSnap a={a} />
        <MenuTampilan a={a} />
        <Pemisah />
        {alat.ukur ? <StatusUkur a={a} onSelesai={() => alat.pilihAlat('pilih')} /> : <AksiTerpilih a={a} />}
      </div>
    </section>
  );
}
