'use client';
import {
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, BoxSelect, BringToFront, FlipHorizontal2, FlipVertical2, LayoutGrid, Route, Scaling, SendToBack,
  StretchHorizontal, StretchVertical, WandSparkles,
} from 'lucide-react';
import { GarisMenu, ItemMenu, JudulMenu, kelasIkon, Menu } from '../bersama/MenuBilah';
import { RATA } from './PanelPilihan';
import type { KeadaanSLD } from './useKeadaanSLD';

export function MenuSusun({ a, kanvas, onPesan }: { a: KeadaanSLD; kanvas: boolean; onPesan: (t: string) => void }) {
  const idPer = new Set(a.dok.perangkat.map(p => p.id)), idZona = new Set((a.dok.zona ?? []).map(z => z.id));
  const nPer = a.terpilih.filter(id => idPer.has(id)).length;
  const bisaSamakan = nPer >= 2 || a.terpilih.filter(id => idZona.has(id)).length >= 2;
  const bisaUrut = a.terpilih.some(id => !a.dok.kabel.some(c => c.id === id));
  const tunggal = a.terpilih.length <= 1 ? a.pilih : null;
  const kabelPilih = tunggal?.jenis === 'k' ? a.dok.kabel.find(c => c.id === tunggal.id) : undefined;
  const rapikanLabel = () => {
    const n = a.rapikanSemuaLabel();
    onPesan(n ? `${n} label dipindah ke posisi kosong (bisa Ctrl+Z).` : 'Tidak ada posisi label yang lebih baik - geser perangkat sedikit.');
  };
  return (
      <Menu label="Susun & rapikan" ikon={LayoutGrid} teks="Susun" lebar="w-64" disabled={!kanvas}>
        <JudulMenu>Ratakan · pilih ≥ 2 perangkat</JudulMenu>
        <div className="grid grid-cols-6 gap-0.5 px-1.5 pb-1">
          {RATA.map(([k, Ikon, l]) => (
            <button key={k} type="button" className={kelasIkon} onClick={() => a.ratakanTerpilih(k)} disabled={nPer < 2} aria-label={l} title={l}><Ikon size={16} /></button>
          ))}
        </div>
        <JudulMenu>Sebar merata · pilih ≥ 3 perangkat</JudulMenu>
        <ItemMenu ikon={AlignHorizontalDistributeCenter} label="Jarak horizontal sama" onClick={() => a.ratakanTerpilih('sebarH')} disabled={nPer < 3} tetapBuka />
        <ItemMenu ikon={AlignVerticalDistributeCenter} label="Jarak vertikal sama" onClick={() => a.ratakanTerpilih('sebarV')} disabled={nPer < 3} tetapBuka />
        <JudulMenu>Samakan ukuran · ikut yang diklik terakhir</JudulMenu>
        <div className="grid grid-cols-3 gap-0.5 px-1.5 pb-1">
          {([['w', StretchHorizontal, 'Lebar'], ['h', StretchVertical, 'Tinggi'], ['wh', Scaling, 'Keduanya']] as const).map(([k, Ikon, l]) => (
            <button key={k} type="button" className={`${kelasIkon} !h-auto flex-col !gap-0.5 py-1 !text-[11px]`} onClick={() => a.samakanUkuranTerpilih(k)} disabled={!bisaSamakan}
              title={`Samakan ${l.toLowerCase()} perangkat / area terpilih`}><Ikon size={16} />{l}</button>
          ))}
        </div>
        <GarisMenu />
        <ItemMenu ikon={BringToFront} label="Bawa ke depan" pintas="Ctrl+Shift+F" onClick={() => a.urutkanTerpilih('depan')} disabled={!bisaUrut} tetapBuka />
        <ItemMenu ikon={SendToBack} label="Kirim ke belakang" pintas="Ctrl+Shift+B" onClick={() => a.urutkanTerpilih('belakang')} disabled={!bisaUrut} tetapBuka />
        <GarisMenu />
        <ItemMenu ikon={FlipHorizontal2} label="Balik horizontal" pintas="H" onClick={() => tunggal && a.balikPerangkat(tunggal.id, 'h')} disabled={tunggal?.jenis !== 'p'} tetapBuka />
        <ItemMenu ikon={FlipVertical2} label="Balik vertikal" pintas="V" onClick={() => tunggal && a.balikPerangkat(tunggal.id, 'v')} disabled={tunggal?.jenis !== 'p'} tetapBuka />
        <ItemMenu ikon={Route} label="Jalur kabel otomatis" onClick={() => kabelPilih && a.ubahKabel(kabelPilih.id, { tengah: undefined, jalur: undefined })}
          disabled={!kabelPilih || (kabelPilih.tengah === undefined && !kabelPilih.jalur?.length)} />
        <GarisMenu />
        <ItemMenu ikon={BoxSelect} label="Pilih semua" pintas="Ctrl+A" onClick={() => a.pilihBanyak([...a.dok.perangkat, ...a.dok.teks, ...(a.dok.zona ?? [])].map(o => o.id))} />
        <ItemMenu ikon={WandSparkles} label="Rapikan semua label" onClick={rapikanLabel} disabled={!a.dok.perangkat.length} />
      </Menu>
  );
}
