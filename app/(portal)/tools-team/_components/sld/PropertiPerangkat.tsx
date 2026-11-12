'use client';
import { useRef, useState } from 'react';
import { Copy, FlipHorizontal2, FlipVertical2, ImagePlus, RotateCcw, RotateCw, Trash2, Users } from 'lucide-react';
import { sudutSah } from '@/lib/sld/geometri';
import { DAFTAR_IKON } from '@/lib/sld/ikon';
import { FOTO_PRODUK } from '@/lib/sld/foto-produk';
import { templatIkon } from '@/lib/sld/katalog';
import type { Perangkat } from '@/lib/sld/tipe';
import { noOtomatis } from '@/lib/sld/turunan';
import { jumlahDariNama } from '@/lib/sld/rapikan';
import { LABEL_PERANGKAT } from '@/lib/sld/gaya';
import { IsianHurufLabel } from './IsianHuruf';
import { PilihPosisiLabel } from './PanelPilihan';
import { PilihModel } from './PilihModel';
import { AmbilBrosur } from './AmbilBrosur';
import { kompresGambar } from './gambar';
import { Angka, Area, Isian, kelasKecil, kelasTombol, Teks } from './isian';
import { MiniIkon } from './PanelKatalog';
import type { KeadaanSLD } from './useKeadaanSLD';
import type { KatalogTim } from './useKatalogTim';

const fotoRasio = (src: string) => Object.values(FOTO_PRODUK).find(f => f.src === src)?.rasio;

export function PropertiPerangkat({ a, p, tim }: { a: KeadaanSLD; p: Perangkat; tim?: KatalogTim }) {
  const ubah = (x: Partial<Perangkat>) => a.ubahPerangkat(p.id, x);
  const berkas = useRef<HTMLInputElement>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const lain = a.dok.perangkat.filter(x => x.id !== p.id);
  const saran = templatIkon(p.ikon)?.saran ?? [];
  const jumlahNama = jumlahDariNama(p.nama);

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
          {tim && <button type="button" className={`${kelasTombol} text-blue-700`} onClick={() => tim.bukaDari(p)} title="Bagikan perangkat ini (dengan fotonya) ke katalog semua akun tim"><Users size={15} /> Simpan ke katalog tim</button>}
          {p.gambar && <button type="button" className={kelasTombol} onClick={() => ubah({ gambar: undefined, rasio: p.foto ? fotoRasio(p.foto) : undefined })}>{p.foto ? 'Foto bawaan' : 'Pakai ilustrasi'}</button>}
          {!p.gambar && p.foto && <button type="button" className={kelasTombol} onClick={() => ubah({ foto: undefined, rasio: undefined })}>Pakai ilustrasi</button>}
          <input ref={berkas} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => void unggah(e.target.files?.[0])} />
        </div>
      </div>
      {galat && <p className="text-[12px] text-rose-700">{galat}</p>}
      {p.gambar
        ? <p className="rounded-md bg-sky-50 border border-sky-200 px-2 py-1.5 text-[11.5px] text-sky-900">Foto ini <b>hanya ada di browser Anda</b> - akun lain melihat foto bawaan / ilustrasi. Klik <b>Simpan ke katalog tim</b> agar sama untuk semua.</p>
        : <p className="text-[11px] text-slate-500">Foto juga bisa diseret ke perangkat di diagram atau ditempel (Ctrl+V). Foto unggahan hanya disimpan di browser ini, kecuali disimpan ke katalog tim.</p>}
      <div className="grid grid-cols-[72px_1fr] gap-2">
        <Teks label="No. BOM" nilai={p.no} onUbah={v => ubah({ no: v.slice(0, 12) })} placeholder={noOtomatis(a.dok).has(p.id) ? `${noOtomatis(a.dok).get(p.id)} (otomatis)` : "luar BOM"} />
        <Teks label="#Nama di diagram" nilai={p.nama} onUbah={v => ubah({ nama: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Teks label="Kategori (Daftar Perangkat)" nilai={p.kategori} onUbah={v => ubah({ kategori: v })} />
        <Teks label="Merek / model" nilai={p.model} onUbah={v => ubah({ model: v })} daftar={`saran-model-${p.id}`} placeholder={saran[0] ?? ''} />
      </div>
      <PilihModel a={a} ids={[p.id]} saran={saran} />
      {!(p.qty > 1) && jumlahNama && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-[11.5px] text-amber-900">
          Nama menyebut {jumlahNama.n} unit tetapi Qty masih 1.{' '}
          <button type="button" className="underline font-bold" onClick={() => ubah({ qty: jumlahNama.n, nama: jumlahNama.nama })}>Jadikan Qty {jumlahNama.n}</button>
        </p>
      )}
      <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
        <Isian label="Qty">
          <Angka nilai={p.qty} min={0} onUbah={v => ubah({ qty: v })} />
        </Isian>
        <Teks label="Satuan" nilai={p.satuan} onUbah={v => ubah({ satuan: v })} />
        <Teks label="Teks di kartu gambar" nilai={p.subGambar} onUbah={v => ubah({ subGambar: v })} placeholder={p.model || 'otomatis'} />
      </div>
      <Isian label="1 gambar mewakili" bantuan="Ringkas banyak unit jadi 1 gambar: tampil (4X) di Sheet 1, Sheet 2 & BOQ ikut menghitung qty-nya.">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Jumlah unit yang diwakili gambar">
          {[1, 2, 3, 4, 6, 8].map(n => (
            <button key={n} type="button" role="radio" aria-checked={p.qty === n} onClick={() => ubah({ qty: n })}
              className={`${kelasTombol} !px-2.5 !py-1 !text-[12px] ${p.qty === n ? '!bg-blue-700 !text-white !border-blue-700' : ''}`}>{n}X</button>
          ))}
        </div>
      </Isian>
      <datalist id={`saran-model-${p.id}`}>{saran.map(x => <option key={x} value={x} />)}</datalist>
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
      <Teks label="*Peran (teks merah)" nilai={p.peran} onUbah={v => ubah({ peran: v })} placeholder="mis. Server Voice Command" />
      <Area label="Keterangan (satu baris per poin)" nilai={p.ket} onUbah={v => ubah({ ket: v })} placeholder={'Spesifikasi singkat\nDaya: adaptor 12 V'} />
      <PilihPosisiLabel nilai={p.labelDi} onPilih={x => a.aturLabelDi([p.id], x)} />
      <IsianHurufLabel label="Ukuran huruf label (baris #nama)" dasarMm={LABEL_PERANGKAT.nama.ukuran} faktor={p.huruf} bawaan={a.dok.huruf?.perangkat}
        onUbah={f => ubah({ huruf: f })} bantuan="Baris *peran dan keterangan ikut membesar / mengecil." />
      <Teks label="Daftar port (pisahkan dengan koma)" nilai={p.port.join(', ')} onUbah={v => ubah({ port: v.split(',').map(s => s.trim()).filter(Boolean).slice(0, 48) })}
        bantuan="Dipakai sebagai pilihan port saat mengisi kabel." />
      <div className="grid grid-cols-2 gap-2">
        <Isian label="Lebar gambar (mm)">
          <Angka nilai={p.w} min={12} maks={200} onUbah={v => ubah({ w: v })} />
        </Isian>
        <Isian label="Tinggi gambar (mm)">
          <Angka nilai={p.h} min={8} maks={200} onUbah={v => ubah({ h: v })} />
        </Isian>
      </div>
      <Isian label={`Putar & balik (${p.putar ?? 0}°${p.balikH ? ' · balik horizontal' : ''}${p.balikV ? ' · balik vertikal' : ''})`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={kelasTombol} onClick={() => a.putarPerangkat(p.id, -90)} aria-label="Putar 90° ke kiri"><RotateCcw size={15} /></button>
          <button type="button" className={kelasTombol} onClick={() => a.putarPerangkat(p.id, 90)} aria-label="Putar 90° ke kanan"><RotateCw size={15} /></button>
          <Angka nilai={p.putar ?? 0} min={0} maks={359} langkah={15} onUbah={v => ubah({ putar: sudutSah(v) || undefined })}
            className={`${kelasKecil} !w-20`} label="Sudut putar (derajat)" />
          <button type="button" className={`${kelasTombol} ${p.balikH ? '!bg-blue-50 !border-blue-300' : ''}`} onClick={() => a.balikPerangkat(p.id, 'h')} aria-pressed={!!p.balikH}
            title="Balik horizontal (H)"><FlipHorizontal2 size={15} /> Horizontal</button>
          <button type="button" className={`${kelasTombol} ${p.balikV ? '!bg-blue-50 !border-blue-300' : ''}`} onClick={() => a.balikPerangkat(p.id, 'v')} aria-pressed={!!p.balikV}
            title="Balik vertikal (V)"><FlipVertical2 size={15} /> Vertikal</button>
          {(!!p.putar || p.balikH || p.balikV) && <button type="button" className={kelasTombol} onClick={() => ubah({ putar: undefined, balikH: undefined, balikV: undefined })}>Tegak</button>}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Atau seret tombol bulat di atas perangkat (per 15°, tahan Shift untuk bebas). Tombol R = putar 90°, H / V = balik horizontal / vertikal.</p>
      </Isian>
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
