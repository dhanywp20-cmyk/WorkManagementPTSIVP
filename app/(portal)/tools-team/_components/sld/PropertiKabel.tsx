'use client';
import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Cable, Plug, Plus, RotateCcw, Route, Trash2, Type, X } from 'lucide-react';
import { Keterangan } from '@/components/shared/Keterangan';
import { ujungBaru } from '@/lib/sld/dok';
import { GAYA_KABEL, LABEL_GARIS, URUTAN_JENIS } from '@/lib/sld/gaya';
import { kodeKabel } from '@/lib/sld/geometri';
import type { JenisKabel, Kabel, PilihSisi, Ujung } from '@/lib/sld/tipe';
import { fungsiOtomatis } from '@/lib/sld/turunan';
import { IsianHurufLabel } from './IsianHuruf';
import { Area, Centang, Isian, kelasKecil, kelasTombol, Teks } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

const SISI: { v: PilihSisi; l: string }[] = [{ v: 'auto', l: 'Otomatis' }, { v: 'kiri', l: 'Kiri' }, { v: 'kanan', l: 'Kanan' }, { v: 'atas', l: 'Atas' }, { v: 'bawah', l: 'Bawah' }];

type Grup = 'kabel' | 'sambung' | 'label' | 'jalur';
const GRUP: [Grup, string, typeof Cable][] = [['kabel', 'Kabel', Cable], ['sambung', 'Sambungan', Plug], ['label', 'Label', Type], ['jalur', 'Jalur', Route]];
const KUNCI_GRUP = 'tools-team-sld-grup-kabel';
const grupAwal = (): Grup => {
  try { const g = localStorage.getItem(KUNCI_GRUP); return GRUP.some(x => x[0] === g) ? (g as Grup) : 'kabel'; } catch { return 'kabel'; }
};

function IsianUjung({ a, u, onUbah, idDaftar, judul }: { a: KeadaanSLD; u: Ujung; onUbah: (u: Ujung) => void; idDaftar: string; judul: string }) {
  const p = a.dok.perangkat.find(x => x.id === u.p);
  return (
    <div className="space-y-2">
      <Isian label="Perangkat">
        <select value={u.p} onChange={e => onUbah({ ...u, p: e.target.value })} className={kelasKecil} aria-label={`${judul}: perangkat`}>
          <option value="">Teks bebas (tidak digambar)</option>
          {a.dok.perangkat.map(x => <option key={x.id} value={x.id}>{x.nama.replace(/\n/g, ' ') || 'Tanpa nama'}</option>)}
        </select>
      </Isian>
      <div className="grid grid-cols-2 gap-2">
        <Teks label={u.p ? 'Nama di tabel' : 'Nama di tabel *'} nilai={u.nama} onUbah={v => onUbah({ ...u, nama: v })} placeholder={p?.nama.replace(/\n/g, ' ') || 'nama ujung'} />
        <Teks label="Port" nilai={u.port} onUbah={v => onUbah({ ...u, port: v })} daftar={idDaftar} />
      </div>
      <datalist id={idDaftar}>{p?.port.map(x => <option key={x} value={x} />)}</datalist>
    </div>
  );
}

function PilihSisiUjung({ judul, u, onUbah }: { judul: string; u: Ujung; onUbah: (u: Ujung) => void }) {
  return (
    <Isian label={judul}>
      <select value={u.sisi} onChange={e => onUbah({ ...u, sisi: e.target.value as PilihSisi })} className={kelasKecil} disabled={!u.p}>
        {SISI.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
      </select>
    </Isian>
  );
}

export function PropertiKabel({ a, c }: { a: KeadaanSLD; c: Kabel }) {
  const ubah = (x: Partial<Kabel>) => a.ubahKabel(c.id, x);
  const kode = kodeKabel(a.dok.kabel).get(c.id);
  const i = a.dok.kabel.findIndex(k => k.id === c.id);
  const [grup, setGrupState] = useState<Grup>(grupAwal);
  const setGrup = (g: Grup) => { setGrupState(g); try { localStorage.setItem(KUNCI_GRUP, g); } catch { return; } };
  const [pilihUjung, setUjung] = useState(0);
  const ujung = [c.dari, c.ke, ...c.cabang];
  const iu = Math.min(pilihUjung, ujung.length - 1);
  const namaUjung = (u: Ujung) => u.nama || a.dok.perangkat.find(x => x.id === u.p)?.nama.replace(/\n/g, ' ') || '?';
  const judulUjung = (k: number) => (k === 0 ? 'Dari' : k === 1 ? 'Ke' : `Cabang ${k - 1}`);
  const ubahUjung = (k: number, u: Ujung) => ubah(k === 0 ? { dari: u } : k === 1 ? { ke: u } : { cabang: c.cabang.map((x, j) => (j === k - 2 ? u : x)) });
  const manual = c.tengah !== undefined || !!c.jalur?.length;
  const warna = GAYA_KABEL[c.jenis].warna;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="min-w-[44px] rounded-lg px-2 py-1 text-center text-[15px] font-extrabold text-white" style={{ background: warna }}>{kode}</span>
        <select value={c.jenis} onChange={e => ubah({ jenis: e.target.value as JenisKabel })} className={`${kelasKecil} flex-1`} aria-label="Jenis kabel (warna garis)">
          {URUTAN_JENIS.map(j => <option key={j} value={j}>{GAYA_KABEL[j].label}</option>)}
        </select>
        <div className="flex gap-0.5">
          <button type="button" className={`${kelasTombol} !px-2`} disabled={i <= 0} onClick={() => a.geserKabel(c.id, -1)} aria-label="Nomor lebih awal" title="Nomor lebih awal">
            <ArrowUp size={15} />
          </button>
          <button type="button" className={`${kelasTombol} !px-2`} disabled={i >= a.dok.kabel.length - 1} onClick={() => a.geserKabel(c.id, 1)} aria-label="Nomor lebih akhir" title="Nomor lebih akhir">
            <ArrowDown size={15} />
          </button>
          <button type="button" className={`${kelasTombol} !px-2 text-rose-700`} onClick={() => a.hapus({ jenis: 'k', id: c.id })} aria-label="Hapus kabel" title="Hapus kabel">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 min-w-0">
        <span className="truncate">{namaUjung(c.dari)}</span><ArrowRight size={13} className="shrink-0 text-slate-400" />
        <span className="truncate">{namaUjung(c.ke)}</span>
        {c.cabang.length > 0 && <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[11px]">+{c.cabang.length} cabang</span>}
      </p>

      <div className="grid grid-cols-4 gap-0.5 rounded-xl bg-slate-100 p-0.5" role="tablist" aria-label="Grup pengaturan kabel">
        {GRUP.map(([g, l, Ikon]) => (
          <button key={g} type="button" role="tab" aria-selected={grup === g} onClick={() => setGrup(g)}
            className={`relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10.5px] font-bold leading-tight transition-colors duration-150 ${
              grup === g ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            <Ikon size={15} aria-hidden="true" /> {l}
            {g === 'jalur' && manual && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-sky-500" aria-label="jalur manual" />}
          </button>
        ))}
      </div>

      {grup === 'kabel' && (<>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <Centang label="Catu daya (nomor P)" nilai={c.daya} onUbah={v => ubah({ daya: v })} />
          <Centang label="Dua arah (tanpa panah)" nilai={c.duaArah} onUbah={v => ubah({ duaArah: v })} />
        </div>
        <Teks label="Kabel / media (tabel)" nilai={c.media} onUbah={v => ubah({ media: v })} placeholder="Cat6 patch" />
        <Teks label="Fungsi" nilai={c.fungsi} onUbah={v => ubah({ fungsi: v })} placeholder={fungsiOtomatis(c) ? `otomatis: ${fungsiOtomatis(c)}` : undefined} />
        <Area label="Catatan" nilai={c.catatan} onUbah={v => ubah({ catatan: v })} baris={2} />
      </>)}

      {grup === 'sambung' && (<>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Ujung kabel">
          {ujung.map((u, k) => (
            <button key={k} type="button" role="tab" aria-selected={iu === k} onClick={() => setUjung(k)} title={namaUjung(u)}
              className={`h-7 px-2.5 rounded-md border text-[12px] font-bold transition-colors duration-150 ${
                iu === k ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {judulUjung(k)}
            </button>
          ))}
          <button type="button" onClick={() => { ubah({ cabang: [...c.cabang, ujungBaru()] }); setUjung(ujung.length); }} title="Tambah cabang (bus / rantai)"
            className="h-7 px-2 rounded-md border border-dashed border-slate-300 text-[12px] font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1">
            <Plus size={13} /> Cabang
          </button>
        </div>
        <IsianUjung key={`${c.id}-${iu}`} a={a} u={ujung[iu]} judul={judulUjung(iu)} onUbah={u => ubahUjung(iu, u)} idDaftar={`port-${c.id}-${iu}`} />
        {iu >= 2 && (
          <button type="button" className={`${kelasTombol} w-full text-rose-700`} onClick={() => { ubah({ cabang: c.cabang.filter((_, j) => j !== iu - 2) }); setUjung(iu - 1); }}>
            <X size={15} /> Hapus {judulUjung(iu).toLowerCase()}
          </button>
        )}
      </>)}

      {grup === 'label' && (<>
        <Teks label="Teks di garis" nilai={c.teksGaris} onUbah={v => ubah({ teksGaris: v })} placeholder={c.media || 'Cat6'} />
        <Centang label="Label di sisi seberang garis" nilai={c.labelBalik} onUbah={v => ubah({ labelBalik: v })} />
        <IsianHurufLabel label="Ukuran huruf label kabel" dasarMm={LABEL_GARIS.ukuran} faktor={c.huruf} bawaan={a.dok.huruf?.kabel} onUbah={f => ubah({ huruf: f })} />
      </>)}

      {grup === 'jalur' && (<>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700">
            Jalur: <b className={manual ? 'text-sky-700' : 'text-slate-900'}>{c.jalur?.length ? `manual · ${c.jalur.length} titik` : manual ? 'digeser' : 'otomatis'}</b>
            <Keterangan>
              Di kanvas: seret kotak di tengah ruas untuk menggeser ruas, seret titik bulat untuk memindah belokan.
              Klik 2x garis untuk menambah belokan, klik 2x titik untuk menghapusnya. Alat Garis di toolbar untuk menggambar kabel baru.
            </Keterangan>
          </span>
          <button type="button" className={`${kelasTombol} !px-2.5 !py-1.5 !text-[12px]`} disabled={!manual} onClick={() => ubah({ tengah: undefined, jalur: undefined })}>
            <RotateCcw size={14} /> Otomatis
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ujung.map((u, k) => (
            <PilihSisiUjung key={k} judul={`Sisi ${judulUjung(k).toLowerCase()}`} u={u} onUbah={x => ubahUjung(k, x)} />
          ))}
        </div>
      </>)}
    </div>
  );
}
