'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GAYA_KABEL } from '@/lib/sld/gaya';
import { barisKoneksi } from '@/lib/sld/turunan';
import { PanelDokumen } from './PanelDokumen';
import { PropertiKabel } from './PropertiKabel';
import { PropertiPerangkat } from './PropertiPerangkat';
import { PropertiTeks } from './PropertiTeks';
import type { KatalogTim } from './useKatalogTim';
import { PanelBanyak, PropertiZona } from './PanelPilihan';
import { kabelYatim } from '@/lib/sld/dok';
import type { KeadaanSLD } from './useKeadaanSLD';

type Tab = 'properti' | 'koneksi' | 'dokumen' | 'periksa';

function DaftarKoneksi({ a, onPilih }: { a: KeadaanSLD; onPilih: () => void }) {
  const baris = barisKoneksi(a.dok);
  const jenis = new Map(a.dok.kabel.map(c => [c.id, c.jenis]));
  if (!baris.length) return <p className="text-[13px] text-slate-500">Belum ada kabel. Pilih perangkat di diagram, lalu tarik tombol + biru ke perangkat lain.</p>;
  return (
    <ul className="space-y-1">
      {baris.map(r => (
        <li key={r.id}>
          <button type="button" onClick={() => { a.setPilih({ jenis: 'k', id: r.id }); onPilih(); }}
            className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-[12.5px] ${a.pilih?.id === r.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <span className="font-extrabold mr-1.5" style={{ color: GAYA_KABEL[jenis.get(r.id) ?? 'lain'].warna }}>{r.kode}</span>
            <span className="text-slate-700">{r.dari || '?'} → {r.ke || '?'}</span>
            {r.media && <span className="block text-[11px] text-slate-500">{r.media}{r.fungsi ? ` · ${r.fungsi}` : ''}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PanelSamping({ a, onTutup, tim }: { a: KeadaanSLD; onTutup?: () => void; tim?: KatalogTim }) {
  const [tab, setTab] = useState<Tab>('properti');
  const p = a.pilih?.jenis === 'p' ? a.dok.perangkat.find(x => x.id === a.pilih!.id) : undefined;
  const c = a.pilih?.jenis === 'k' ? a.dok.kabel.find(x => x.id === a.pilih!.id) : undefined;
  const tk = a.pilih?.jenis === 't' ? a.dok.teks.find(x => x.id === a.pilih!.id) : undefined;
  const zn = a.pilih?.jenis === 'z' ? a.dok.zona?.find(x => x.id === a.pilih!.id) : undefined;
  const yatim = kabelYatim(a.dok).length;
  const awas = a.temuan.filter(t => t.tingkat === 'awas').length;
  const TAB: { k: Tab; l: string }[] = [
    { k: 'properti', l: 'Properti' }, { k: 'koneksi', l: `Koneksi (${a.dok.kabel.length})` }, { k: 'dokumen', l: 'Judul & catatan' },
    { k: 'periksa', l: `Periksa${a.temuan.length ? ` (${a.temuan.length})` : ''}` },
  ];
  const aktif = tab;
  const idPilih = a.pilih?.id;
  useEffect(() => { if (idPilih) setTab('properti'); }, [idPilih]);
  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-3 sm:p-4">
      <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="Panel SLD">
        {TAB.map(t => (
          <button key={t.k} type="button" role="tab" aria-selected={aktif === t.k} onClick={() => setTab(t.k)}
            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${aktif === t.k ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'} ${t.k === 'periksa' && awas ? 'ring-1 ring-amber-300' : ''}`}>
            {t.l}
          </button>
        ))}
        {onTutup && (
          <button type="button" onClick={onTutup} aria-label="Tutup panel properti" className="ml-auto w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        )}
      </div>
      {aktif === 'properti' && (a.terpilih.length > 1 ? <PanelBanyak a={a} /> : zn ? <PropertiZona key={zn.id} a={a} z={zn} /> : p ? <PropertiPerangkat key={p.id} a={a} p={p} tim={tim} /> : c ? <PropertiKabel key={c.id} a={a} c={c} /> : tk ? <PropertiTeks key={tk.id} a={a} t={tk} /> : (
        <div className="text-[13px] text-slate-600 space-y-2">
          <p>Klik perangkat atau garis kabel di diagram untuk mengubahnya.</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-500">
            <li>Seret perangkat untuk memindahkan; kotak kecil di pojok kanan bawah untuk mengubah ukuran.</li>
            <li>Tarik tombol <b className="text-blue-700">+</b> biru ke perangkat lain untuk membuat kabel (K1, K2, ...).</li>
            <li>Kotak putih di tengah garis menggeser jalur kabel.</li>
            <li>Tombol <b>Teks</b> atau klik dua kali di area kosong menambah tulisan bebas.</li>
            <li>Delete menghapus yang dipilih; Ctrl+Z / Ctrl+Y untuk batal / ulang.</li>
          </ul>
        </div>
      ))}
      {aktif === 'koneksi' && <DaftarKoneksi a={a} onPilih={() => setTab('properti')} />}
      {aktif === 'dokumen' && <PanelDokumen a={a} />}
      {aktif === 'periksa' && yatim > 0 && (
        <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-[12.5px] text-amber-900">
          {yatim} kabel tidak lagi tersambung ke perangkat (perangkatnya sudah dihapus) tetapi masih tercatat di Sheet 2.
          <button type="button" onClick={a.bersihkanKabelYatim} className="ml-1 underline font-bold">Hapus kabel tersebut</button>
        </div>
      )}
      {aktif === 'periksa' && (a.temuan.length ? (
        <ul className="space-y-1.5">
          {a.temuan.map((t, i) => (
            <li key={i} className={`rounded-lg px-2.5 py-1.5 text-[12.5px] ${t.tingkat === 'awas' ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-50 text-slate-700'}`}>{t.pesan}</li>
          ))}
        </ul>
      ) : <p className="text-[13px] text-emerald-700 font-semibold">Tidak ada temuan.</p>)}
    </section>
  );
}
