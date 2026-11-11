'use client';
import { useRef, useState } from 'react';
import { Copy, ImagePlus, Trash2 } from 'lucide-react';
import { DAFTAR_IKON } from '@/lib/sld/ikon';
import { FOTO_PRODUK } from '@/lib/sld/foto-produk';
import { templatIkon } from '@/lib/sld/katalog';
import type { Perangkat } from '@/lib/sld/tipe';
import { AmbilBrosur } from './AmbilBrosur';
import { kompresGambar } from './gambar';
import { Area, Isian, kelasKecil, kelasTombol, Teks } from './isian';
import { MiniIkon } from './PanelKatalog';
import type { KeadaanSLD } from './useKeadaanSLD';

const fotoRasio = (src: string) => Object.values(FOTO_PRODUK).find(f => f.src === src)?.rasio;

export function PropertiPerangkat({ a, p }: { a: KeadaanSLD; p: Perangkat }) {
  const ubah = (x: Partial<Perangkat>) => a.ubahPerangkat(p.id, x);
  const berkas = useRef<HTMLInputElement>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const lain = a.dok.perangkat.filter(x => x.id !== p.id);
  const saran = templatIkon(p.ikon)?.saran ?? [];

  const unggah = async (f?: File | null) => {
    if (!f) return;
    setSibuk(true); setGalat('');
    try {
      a.pasangFotoKe(p.id, await kompresGambar(f), f.name.replace(/\.[^.]+$/, ''));
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Gambar gagal dipakai.'); } finally {
      setSibuk(false);
      if (berkas.current) berkas.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-20 h-14 rounded-lg border border-slate-200 bg-white grid place-items-center overflow-hidden shrink-0">
          {p.gambar || p.foto ? <img src={p.gambar ?? p.foto} alt="" className="max-w-full max-h-full object-contain" /> : <MiniIkon ikon={p.ikon} className="w-16 h-10" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={kelasTombol} disabled={sibuk} onClick={() => berkas.current?.click()}>
            <ImagePlus size={15} /> {sibuk ? 'Memproses...' : p.gambar ? 'Ganti foto' : 'Pakai foto'}
          </button>
          <AmbilBrosur onPakai={(f, nama) => a.pasangFotoKe(p.id, f, nama)} />
          {p.gambar && <button type="button" className={kelasTombol} onClick={() => ubah({ gambar: undefined, rasio: p.foto ? fotoRasio(p.foto) : undefined })}>{p.foto ? 'Foto bawaan' : 'Pakai ilustrasi'}</button>}
          {!p.gambar && p.foto && <button type="button" className={kelasTombol} onClick={() => ubah({ foto: undefined, rasio: undefined })}>Pakai ilustrasi</button>}
          <input ref={berkas} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => void unggah(e.target.files?.[0])} />
        </div>
      </div>
      {galat && <p className="text-[12px] text-rose-700">{galat}</p>}
      <p className="text-[11px] text-slate-500">Foto juga bisa diseret ke perangkat di diagram atau ditempel (Ctrl+V). Foto hanya disimpan di browser ini, tidak diunggah ke server.</p>
      {a.galeri.length > 0 && (
        <Isian label={`Galeri foto di browser ini (${a.galeri.length})`}>
          <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
            {a.galeri.map(g => (
              <div key={g.id} className="relative group">
                <button type="button" title={g.nama} onClick={() => a.pasangFotoKe(p.id, { dataUrl: g.gambar, rasio: g.rasio }, g.nama)}
                  className={`w-full h-12 rounded-lg border bg-white grid place-items-center overflow-hidden ${p.gambar === g.gambar ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-300'}`}>
                  <img src={g.gambar} alt={g.nama} className="max-w-full max-h-full object-contain" />
                </button>
                <button type="button" onClick={() => a.hapusGaleri(g.id)} aria-label={`Hapus ${g.nama} dari galeri`}
                  className="absolute -top-1 -right-1 hidden group-hover:grid place-items-center w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] leading-none">×</button>
              </div>
            ))}
          </div>
        </Isian>
      )}
      {!p.gambar && (
        <Isian label="Ilustrasi">
          <select value={p.ikon} onChange={e => ubah({ ikon: e.target.value })} className={kelasKecil}>
            {DAFTAR_IKON.map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
          </select>
        </Isian>
      )}
      <div className="grid grid-cols-[72px_1fr] gap-2">
        <Teks label="No. BOM" nilai={p.no} onUbah={v => ubah({ no: v.slice(0, 12) })} placeholder="1" />
        <Teks label="#Nama di diagram" nilai={p.nama} onUbah={v => ubah({ nama: v })} />
      </div>
      <Teks label="*Peran (teks merah)" nilai={p.peran} onUbah={v => ubah({ peran: v })} placeholder="mis. Server Voice Command" />
      <Area label="Keterangan (satu baris per poin)" nilai={p.ket} onUbah={v => ubah({ ket: v })} placeholder={'Spesifikasi singkat\nDaya: adaptor 12 V'} />
      <div className="grid grid-cols-2 gap-2">
        <Teks label="Kategori (Daftar Perangkat)" nilai={p.kategori} onUbah={v => ubah({ kategori: v })} />
        <Teks label="Merek / model" nilai={p.model} onUbah={v => ubah({ model: v })} daftar={`saran-model-${p.id}`} placeholder={saran[0] ?? ''} />
      </div>
      <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
        <Isian label="Qty">
          <input type="number" min={0} value={p.qty} onChange={e => ubah({ qty: Math.max(0, Number(e.target.value) || 0) })} className={kelasKecil} />
        </Isian>
        <Teks label="Satuan" nilai={p.satuan} onUbah={v => ubah({ satuan: v })} />
        <Teks label="Teks di kartu gambar" nilai={p.subGambar} onUbah={v => ubah({ subGambar: v })} placeholder={p.model || 'otomatis'} />
      </div>
      <datalist id={`saran-model-${p.id}`}>{saran.map(x => <option key={x} value={x} />)}</datalist>
      <Teks label="Daftar port (pisahkan dengan koma)" nilai={p.port.join(', ')} onUbah={v => ubah({ port: v.split(',').map(s => s.trim()).filter(Boolean).slice(0, 48) })}
        bantuan="Dipakai sebagai pilihan port saat mengisi kabel." />
      <div className="grid grid-cols-2 gap-2">
        <Isian label="Lebar gambar (mm)">
          <input type="number" min={12} max={200} value={p.w} onChange={e => ubah({ w: Math.max(12, Number(e.target.value) || 12) })} className={kelasKecil} />
        </Isian>
        <Isian label="Tinggi gambar (mm)">
          <input type="number" min={8} max={200} value={p.h} onChange={e => ubah({ h: Math.max(8, Number(e.target.value) || 8) })} className={kelasKecil} />
        </Isian>
      </div>
      {lain.length > 0 && (
        <Isian label="Sambungkan kabel ke">
          <select value="" onChange={e => e.target.value && a.hubungkan(p.id, e.target.value)} className={kelasKecil}>
            <option value="">Pilih perangkat tujuan...</option>
            {lain.map(x => <option key={x.id} value={x.id}>{x.nama || 'Tanpa nama'}</option>)}
          </select>
        </Isian>
      )}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button type="button" className={kelasTombol} onClick={() => a.duplikat(p.id)}><Copy size={15} /> Duplikat</button>
        <button type="button" className={`${kelasTombol} text-rose-700`} onClick={() => a.hapus({ jenis: 'p', id: p.id })}><Trash2 size={15} /> Hapus</button>
      </div>
    </div>
  );
}
