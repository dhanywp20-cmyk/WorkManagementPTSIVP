'use client';
import { useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { type BarisBom, bacaBom, isiDariBom } from '@/lib/sld/bom';
import { idBaru, perangkatBaru } from '@/lib/sld/dok';
import { tebakTemplat } from '@/lib/sld/katalog';
import { AREA, MAKS_PERANGKAT } from '@/lib/sld/tipe';
import { type FotoSiap, kompresGambar } from './gambar';
import { kelasTombol } from './isian';
import type { KeadaanSLD } from './useKeadaanSLD';

interface Hasil { nama: string; baris: BarisBom[]; foto: Map<string, FotoSiap>; dipasang: number; belum: BarisBom[] }

async function olah(f: File): Promise<Omit<Hasil, 'dipasang' | 'belum'>> {
  if (f.size > 30_000_000) throw new Error('Berkas BOM terlalu besar (maks 30 MB).');
  if (!/\.xlsx$/i.test(f.name)) throw new Error('Pilih BOM berformat Excel .xlsx.');
  const baris = await bacaBom(new Uint8Array(await f.arrayBuffer()));
  if (!baris.length) throw new Error('Tidak ada baris BOM yang terbaca. Pastikan ada kolom "No" dan "Model" / "Qty".');
  const foto = new Map<string, FotoSiap>();
  for (const r of baris) {
    if (!r.foto) continue;
    try { foto.set(r.no, await kompresGambar(new Blob([r.foto.isi as BlobPart], { type: r.foto.mime }), r.foto.potong)); } catch {  }
  }
  return { nama: f.name, baris, foto };
}

export function ImporBom({ a }: { a: KeadaanSLD }) {
  const berkas = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [hasil, setHasil] = useState<Hasil | null>(null);

  const baca = async (f?: File | null) => {
    if (!f) return;
    setSibuk(true); setGalat(''); setHasil(null);
    try {
      const h = await olah(f);
      const sudah = new Set(a.dok.perangkat.map(p => p.no.trim()).filter(Boolean));
      const dipasang = a.dok.perangkat.filter(p => !p.gambar && h.foto.has(p.no.trim())).length;
      a.setDok(d => ({ ...d, blok: { ...d.blok, acuan: d.blok.acuan || h.nama }, perangkat: d.perangkat.map(p => {
        const r = h.baris.find(x => x.no === p.no.trim());
        if (!r) return p;
        const fo = h.foto.get(r.no), isi = isiDariBom(r);
        return {
          ...p, kategori: p.kategori || isi.kategori, model: p.model || isi.model, subGambar: p.subGambar || isi.subGambar,
          ...(fo && !p.gambar ? { gambar: fo.dataUrl, rasio: fo.rasio, h: Math.max(10, Math.min(80, Math.round((p.w / fo.rasio) * 2) / 2)) } : {}),
        };
      }) }));
      for (const r of h.baris) { const fo = h.foto.get(r.no); if (fo) a.ingatFoto(isiDariBom(r).model, fo); }
      a.tambahGaleri(h.baris.filter(r => h.foto.has(r.no)).map(r => ({ id: idBaru('g'), nama: `${r.no}. ${r.model || r.merek}`, gambar: h.foto.get(r.no)!.dataUrl, rasio: h.foto.get(r.no)!.rasio })));
      setHasil({ ...h, dipasang, belum: h.baris.filter(r => !sudah.has(r.no)) });
    } catch (e) { setGalat(e instanceof Error ? e.message : 'BOM gagal dibaca.'); } finally {
      setSibuk(false);
      if (berkas.current) berkas.current.value = '';
    }
  };

  const tambahSemua = () => {
    if (!hasil) return;
    a.setDok(d => {
      const baru = hasil.belum.slice(0, Math.max(0, MAKS_PERANGKAT - d.perangkat.length)).map((r, i) => {
        const isi = isiDariBom(r), fo = hasil.foto.get(r.no);
        const p = perangkatBaru(tebakTemplat(`${r.kategori} ${r.model} ${r.spek}`), AREA.x + 12 + (i % 5) * 72, AREA.y + 10 + Math.floor(i / 5) * 70, { ...isi, id: idBaru('p') });
        return fo ? { ...p, gambar: fo.dataUrl, rasio: fo.rasio, w: 46, h: Math.max(10, Math.min(40, Math.round((46 / fo.rasio) * 2) / 2)) } : p;
      });
      return { ...d, perangkat: [...d.perangkat, ...baru] };
    });
    setHasil(h => (h ? { ...h, belum: [] } : h));
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-2">
      <button type="button" className={`${kelasTombol} w-full`} disabled={sibuk} onClick={() => berkas.current?.click()}>
        <FileSpreadsheet size={15} /> {sibuk ? 'Membaca BOM...' : 'Impor BOM (.xlsx)'}
      </button>
      <input ref={berkas} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => void baca(e.target.files?.[0])} />
      <p className="text-[11px] leading-snug text-emerald-900">Foto produk diambil dari kolom Gambar dan dipasang ke perangkat dengan No. BOM yang sama. Dibaca di browser ini saja, tidak diunggah ke server.</p>
      {galat && <p className="text-[12px] text-rose-700">{galat}</p>}
      {hasil && (
        <div className="text-[12px] text-slate-700 space-y-1.5">
          <p><b>{hasil.baris.length}</b> baris terbaca, <b>{hasil.foto.size}</b> foto. {hasil.dipasang} perangkat di diagram diberi foto.</p>
          {hasil.belum.length > 0 && (
            <button type="button" className={`${kelasTombol} w-full !text-[12px]`} onClick={tambahSemua}>
              Tambahkan {hasil.belum.length} perangkat yang belum ada
            </button>
          )}
        </div>
      )}
    </div>
  );
}
