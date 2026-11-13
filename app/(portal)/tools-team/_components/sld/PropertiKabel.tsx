'use client';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { ujungBaru } from '@/lib/sld/dok';
import { GAYA_KABEL, URUTAN_JENIS } from '@/lib/sld/gaya';
import { kodeKabel } from '@/lib/sld/geometri';
import type { JenisKabel, Kabel, PilihSisi, Ujung } from '@/lib/sld/tipe';
import { fungsiOtomatis } from '@/lib/sld/turunan';
import { LABEL_GARIS } from '@/lib/sld/gaya';
import { IsianHurufLabel } from './IsianHuruf';
import { Centang, Isian, kelasKecil, kelasTombol, Teks } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

const SISI: { v: PilihSisi; l: string }[] = [{ v: 'auto', l: 'Sisi otomatis' }, { v: 'kiri', l: 'Kiri' }, { v: 'kanan', l: 'Kanan' }, { v: 'atas', l: 'Atas' }, { v: 'bawah', l: 'Bawah' }];

function IsianUjung({ a, judul, u, onUbah, onHapus, idDaftar }: {
  a: KeadaanSLD; judul: string; u: Ujung; onUbah: (u: Ujung) => void; onHapus?: () => void; idDaftar: string;
}) {
  const p = a.dok.perangkat.find(x => x.id === u.p);
  return (
    <fieldset className="rounded-xl border border-slate-200 p-2.5 space-y-2">
      <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">{judul}</legend>
      <div className="flex gap-1.5">
        <select value={u.p} onChange={e => onUbah({ ...u, p: e.target.value })} className={kelasKecil} aria-label={`${judul}: perangkat`}>
          <option value="">Teks bebas (tidak digambar)</option>
          {a.dok.perangkat.map(x => <option key={x.id} value={x.id}>{x.nama || 'Tanpa nama'}</option>)}
        </select>
        {onHapus && <button type="button" onClick={onHapus} className={kelasTombol} aria-label="Hapus cabang"><X size={15} /></button>}
      </div>
      <Teks label={u.p ? 'Nama di tabel (kosong = nama perangkat)' : 'Nama di tabel'} nilai={u.nama} onUbah={v => onUbah({ ...u, nama: v })} placeholder={p?.nama} />
      <div className="grid grid-cols-2 gap-2">
        <Teks label="Port" nilai={u.port} onUbah={v => onUbah({ ...u, port: v })} daftar={idDaftar} />
        {u.p && (
          <Isian label="Sisi garis">
            <select value={u.sisi} onChange={e => onUbah({ ...u, sisi: e.target.value as PilihSisi })} className={kelasKecil}>
              {SISI.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </Isian>
        )}
      </div>
      <datalist id={idDaftar}>{p?.port.map(x => <option key={x} value={x} />)}</datalist>
    </fieldset>
  );
}

export function PropertiKabel({ a, c }: { a: KeadaanSLD; c: Kabel }) {
  const ubah = (x: Partial<Kabel>) => a.ubahKabel(c.id, x);
  const kode = kodeKabel(a.dok.kabel).get(c.id);
  const i = a.dok.kabel.findIndex(k => k.id === c.id);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-extrabold" style={{ color: GAYA_KABEL[c.jenis].warna }}>{kode}</span>
        <div className="flex gap-1">
          <button type="button" className={kelasTombol} disabled={i <= 0} onClick={() => a.geserKabel(c.id, -1)} aria-label="Nomor lebih awal"><ArrowUp size={15} /></button>
          <button type="button" className={kelasTombol} disabled={i >= a.dok.kabel.length - 1} onClick={() => a.geserKabel(c.id, 1)} aria-label="Nomor lebih akhir"><ArrowDown size={15} /></button>
        </div>
      </div>
      <Isian label="Jenis kabel (warna garis)">
        <select value={c.jenis} onChange={e => ubah({ jenis: e.target.value as JenisKabel })} className={kelasKecil}>
          {URUTAN_JENIS.map(j => <option key={j} value={j}>{GAYA_KABEL[j].label}</option>)}
        </select>
      </Isian>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        <Centang label="Catu daya (nomor P)" nilai={c.daya} onUbah={v => ubah({ daya: v })} />
        <Centang label="Dua arah (tanpa panah)" nilai={c.duaArah} onUbah={v => ubah({ duaArah: v })} />
      </div>
      <IsianUjung a={a} judul="Dari" u={c.dari} onUbah={u => ubah({ dari: u })} idDaftar={`port-dari-${c.id}`} />
      <IsianUjung a={a} judul="Ke" u={c.ke} onUbah={u => ubah({ ke: u })} idDaftar={`port-ke-${c.id}`} />
      {c.cabang.map((u, j) => (
        <IsianUjung key={j} a={a} judul={`Cabang ${j + 1}`} u={u} idDaftar={`port-cabang-${c.id}-${j}`}
          onUbah={b => ubah({ cabang: c.cabang.map((x, k) => (k === j ? b : x)) })} onHapus={() => ubah({ cabang: c.cabang.filter((_, k) => k !== j) })} />
      ))}
      {c.cabang.length < 8 && (
        <button type="button" className={`${kelasTombol} w-full`} onClick={() => ubah({ cabang: [...c.cabang, ujungBaru()] })}>
          <Plus size={15} /> Tambah cabang (bus / rantai)
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Teks label="Kabel / media (tabel)" nilai={c.media} onUbah={v => ubah({ media: v })} placeholder="Cat6 patch" />
        <Teks label="Teks di garis" nilai={c.teksGaris} onUbah={v => ubah({ teksGaris: v })} placeholder={c.media || 'Cat6'} />
      </div>
      <Teks label="Fungsi" nilai={c.fungsi} onUbah={v => ubah({ fungsi: v })} placeholder={fungsiOtomatis(c) ? `otomatis: ${fungsiOtomatis(c)}` : undefined} />
      <Teks label="Catatan" nilai={c.catatan} onUbah={v => ubah({ catatan: v })} />
      <Centang label="Label garis di sisi seberang" nilai={c.labelBalik} onUbah={v => ubah({ labelBalik: v })} />
      <IsianHurufLabel label="Ukuran huruf label kabel" dasarMm={LABEL_GARIS.ukuran} faktor={c.huruf} bawaan={a.dok.huruf?.kabel} onUbah={f => ubah({ huruf: f })} />
      <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11.5px] leading-snug text-slate-600">
        Atur jalur di kanvas: seret <b>kotak di tengah ruas</b> untuk menggeser ruas, seret <b>titik bulat</b> untuk memindah belokan.
        Klik 2x pada garis untuk menambah belokan, klik 2x titik untuk menghapusnya.
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(c.tengah !== undefined || !!c.jalur?.length) && <button type="button" className={kelasTombol} onClick={() => ubah({ tengah: undefined, jalur: undefined })}><RotateCcw size={15} /> Jalur otomatis</button>}
        <button type="button" className={`${kelasTombol} text-rose-700`} onClick={() => a.hapus({ jenis: 'k', id: c.id })}><Trash2 size={15} /> Hapus kabel</button>
      </div>
    </div>
  );
}
