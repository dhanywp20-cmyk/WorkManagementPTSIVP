'use client';
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ClipboardPaste, Copy, CopyPlus, Trash2,
} from 'lucide-react';
import type { Rata } from '@/lib/sld/pilih';
import { LABEL_WARNA_ZONA, LABEL_ZONA_CEPAT, WARNA_ZONA } from '@/lib/sld/zona';
import { POSISI_LABEL, type PosisiLabel, type WarnaZona, type ZonaSLD } from '@/lib/sld/tipe';
import { Angka, Isian, kelasTombol, Teks } from './isian';
import { PilihModel } from './PilihModel';
import type { KeadaanSLD } from './useKeadaanSLD';

const PANAH: Record<PosisiLabel, string> = { 'kiri-atas': '↖', atas: '↑', 'kanan-atas': '↗', kiri: '←', kanan: '→', 'kiri-bawah': '↙', bawah: '↓', 'kanan-bawah': '↘' };

export function PilihPosisiLabel({ nilai, onPilih }: { nilai?: PosisiLabel; onPilih: (p: PosisiLabel) => void }) {
  const sel = [...POSISI_LABEL.slice(0, 4), null, ...POSISI_LABEL.slice(4)];
  return (
    <Isian label="Posisi teks keterangan" bantuan="Pindahkan label ke sisi / pojok lain agar tidak tertimpa kabel.">
      <div className="grid grid-cols-3 gap-1 w-[132px]" role="radiogroup" aria-label="Posisi teks keterangan">
        {sel.map((p, i) => p ? (
          <button key={p} type="button" role="radio" aria-checked={(nilai ?? 'bawah') === p} onClick={() => onPilih(p)} title={p.replace('-', ' ')}
            className={`h-10 rounded-lg border text-[15px] font-bold ${(nilai ?? 'bawah') === p ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
            {PANAH[p]}
          </button>
        ) : <span key={`t${i}`} className="h-10 rounded-lg bg-slate-100 border border-slate-200 grid place-items-center text-[10px] text-slate-500">item</span>)}
      </div>
    </Isian>
  );
}

const RATA: [Rata, typeof AlignStartVertical, string][] = [
  ['kiri', AlignStartVertical, 'Rata kiri'], ['tengahH', AlignCenterVertical, 'Rata tengah (horizontal)'], ['kanan', AlignEndVertical, 'Rata kanan'],
  ['atas', AlignStartHorizontal, 'Rata atas'], ['tengahV', AlignCenterHorizontal, 'Rata tengah (vertikal)'], ['bawah', AlignEndHorizontal, 'Rata bawah'],
];

export function PanelBanyak({ a }: { a: KeadaanSLD }) {
  const ids = a.terpilih, perangkat = a.dok.perangkat.filter(p => ids.includes(p.id));
  const label = perangkat.length && perangkat.every(p => (p.labelDi ?? 'bawah') === (perangkat[0].labelDi ?? 'bawah')) ? perangkat[0].labelDi : undefined;
  return (
    <div className="space-y-3">
      <p className="text-[14px] font-bold text-slate-800">{ids.length} item dipilih</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={kelasTombol} onClick={() => a.salin()}><Copy size={15} /> Salin</button>
        <button type="button" className={kelasTombol} onClick={() => a.tempel()}><ClipboardPaste size={15} /> Tempel</button>
        <button type="button" className={kelasTombol} onClick={() => { if (a.salin()) a.tempel(); }}><CopyPlus size={15} /> Duplikat</button>
        <button type="button" className={`${kelasTombol} text-rose-700`} onClick={a.hapusTerpilih}><Trash2 size={15} /> Hapus</button>
      </div>
      {perangkat.length > 1 && (
        <Isian label="Ratakan perangkat">
          <div className="flex flex-wrap gap-1">
            {RATA.map(([k, Ikon, l]) => (
              <button key={k} type="button" className={`${kelasTombol} !px-2.5`} onClick={() => a.ratakanTerpilih(k)} aria-label={l} title={l}><Ikon size={16} /></button>
            ))}
          </div>
        </Isian>
      )}
      {perangkat.length > 0 && <PilihModel a={a} ids={perangkat.map(x => x.id)} />}
      {perangkat.length > 0 && <PilihPosisiLabel nilai={label} onPilih={p => a.aturLabelDi(perangkat.map(x => x.id), p)} />}
      <p className="text-[11.5px] text-slate-500">
        Seret salah satu item untuk memindahkan semuanya. Shift + klik menambah / mengurangi pilihan; seret kotak di area kosong untuk memilih banyak.
        Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+A, Delete untuk hapus.
      </p>
    </div>
  );
}

export function PropertiZona({ a, z }: { a: KeadaanSLD; z: ZonaSLD }) {
  const ubah = (p: Partial<ZonaSLD>) => a.ubahZona(z.id, p);
  return (
    <div className="space-y-3">
      <Teks label="Label area" nilai={z.label} onUbah={v => ubah({ label: v.slice(0, 60) })} placeholder="mis. Rack, Wall, Ceiling, Ruang Rapat" />
      <div className="flex flex-wrap gap-1">
        {LABEL_ZONA_CEPAT.map(l => <button key={l} type="button" className={`${kelasTombol} !py-1 !px-2.5 !text-[12px]`} onClick={() => ubah({ label: l })}>{l}</button>)}
      </div>
      <Isian label="Warna garis">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(WARNA_ZONA) as WarnaZona[]).map(w => (
            <button key={w} type="button" onClick={() => ubah({ warna: w })} aria-pressed={z.warna === w}
              className={`${kelasTombol} !px-2.5 ${z.warna === w ? '!border-blue-500 ring-2 ring-blue-200' : ''}`}>
              <span className="w-3 h-3 rounded-sm border-2 border-dashed" style={{ borderColor: WARNA_ZONA[w] }} aria-hidden="true" /> {LABEL_WARNA_ZONA[w]}
            </button>
          ))}
        </div>
      </Isian>
      <div className="grid grid-cols-2 gap-2">
        <Isian label="Lebar (mm)"><Angka nilai={z.w} min={10} maks={420} onUbah={v => ubah({ w: v })} /></Isian>
        <Isian label="Tinggi (mm)"><Angka nilai={z.h} min={8} maks={300} onUbah={v => ubah({ h: v })} /></Isian>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button type="button" className={kelasTombol} onClick={() => { if (a.salin()) a.tempel(); }}><CopyPlus size={15} /> Duplikat</button>
        <button type="button" className={`${kelasTombol} text-rose-700`} onClick={() => a.hapus({ jenis: 'z', id: z.id })}><Trash2 size={15} /> Hapus</button>
      </div>
      <p className="text-[11px] text-slate-500">Seret garis area untuk memindahkan, kotak kecil di pojok kanan bawah untuk mengubah ukuran. Area tidak masuk BOQ.</p>
    </div>
  );
}
