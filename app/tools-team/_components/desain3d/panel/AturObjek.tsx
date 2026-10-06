'use client';
import { Angka, f, Pilih, Segmen } from '../../ui';
import { type Benda, type BentukObjek, LABEL_BENTUK_OBJEK } from '../inti';
import { FAKTOR_SATUAN, LABEL_SATUAN, type Satuan, ukuranModel } from '../impor/berkas3d';

/**
 * Bagian panel "Atur benda" untuk objek mapping (bentuk dasar & siluet gambar) dan model 3D impor:
 * bentuk, foto permukaan, satuan berkas, posisi tegak, dan tinggi nyata yang menjaga proporsi.
 */
export function AturObjek({ b, set, adaFoto, onGambarBaru }: {
  b: Benda; set: (x: Partial<Benda>) => void;
  /** Foto permukaan objek gambar masih ada di memori (bisa dinyalakan lagi). */ adaFoto: boolean;
  /** Buat ulang siluet dari gambar lain (posisi & nama tetap). */ onGambarBaru: () => void;
}) {
  /** Skala seragam dari tinggi baru - lebar & tebal ikut, bentuk tidak gepeng. */
  const skalaTinggi = (h: number) => {
    if (!(h > 0.01 && h <= 200) || !b.h) return;
    const k = h / b.h, r = (v: number) => Math.round(v * k * 1000) / 1000;
    set({ w: r(b.w), h: Math.round(h * 1000) / 1000, d: r(b.d) });
  };
  const tinggiNyata = <Angka label="Tinggi nyata (proporsional)" nilai={Math.round(b.h * 1000) / 1000} satuan="m" step={0.1} onUbah={skalaTinggi} />;

  if (b.jenis === 'objek' && (b.bentukObjek ?? 'kotak') !== 'gambar') {
    const pilihan = (Object.keys(LABEL_BENTUK_OBJEK) as BentukObjek[]).filter(k => k !== 'gambar');
    return (
      <Pilih label="Bentuk" nilai={b.bentukObjek ?? 'kotak'}
        onUbah={(v: BentukObjek) => set({ bentukObjek: v, nama: b.nama === LABEL_BENTUK_OBJEK[b.bentukObjek ?? 'kotak'] ? LABEL_BENTUK_OBJEK[v] : b.nama })}
        opsi={pilihan.map(v => ({ v, l: LABEL_BENTUK_OBJEK[v] }))} />
    );
  }

  if (b.jenis === 'objek') {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-2.5 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-800">Siluet dari gambar</p>
        <div className="grid grid-cols-2 gap-2">
          {tinggiNyata}
          <Angka label="Tebal" nilai={Math.round(b.d * 100)} satuan="cm" step={5} onUbah={v => v >= 1 && v <= 5000 && set({ d: v / 100 })} />
        </div>
        <label className={`flex items-center gap-2 text-[12.5px] ${adaFoto ? 'text-slate-700' : 'text-slate-400'}`}>
          <input type="checkbox" className="w-4 h-4" disabled={!adaFoto} checked={b.konten === 'gambar'}
            onChange={e => set({ konten: e.target.checked ? 'gambar' : undefined })} />
          Foto di permukaan depan{adaFoto ? '' : ' (tidak ada foto)'}
        </label>
        <button type="button" onClick={onGambarBaru}
          className="w-full px-3 py-1.5 rounded-lg text-[12.5px] font-bold border border-violet-200 bg-white text-violet-800 hover:bg-violet-100">
          Buat ulang dari gambar lain...
        </button>
      </div>
    );
  }

  //  Model 3D impor.
  const putar = b.putarModel ?? 0;
  const ubahTegak = (v: number) => {
    if (b.ukuranFile) { set({ putarModel: v || undefined, ...ukuranModel(b.ukuranFile, b.satuanModel ?? 'm', v) }); return; }
    //  Tanpa ukuran berkas (desain lama): tukar tinggi & tebal bila sumbu tegaknya berganti.
    const tukar = (Math.abs(Math.round(v / 90)) % 2) !== (Math.abs(Math.round(putar / 90)) % 2);
    set({ putarModel: v || undefined, ...(tukar ? { h: b.d, d: b.h } : {}) });
  };
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-2.5 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-violet-800">Model 3D impor</p>
      <Segmen label="Posisi tegak" nilai={String(putar)} onUbah={v => ubahTegak(Number(v))}
        opsi={[{ v: '0', l: 'Asli' }, { v: '90', l: 'Tegakkan (Z-up)' }, { v: '-90', l: 'Tegakkan terbalik' }, { v: '180', l: 'Balik' }]} />
      <div className="grid grid-cols-2 gap-2">
        {b.ukuranFile && (
          <Pilih label="Satuan berkas" nilai={b.satuanModel ?? 'm'}
            onUbah={(s: Satuan) => set({ satuanModel: s, ...ukuranModel(b.ukuranFile!, s, putar) })}
            opsi={(Object.keys(FAKTOR_SATUAN) as Satuan[]).map(v => ({ v, l: LABEL_SATUAN[v] }))} />
        )}
        {tinggiNyata}
      </div>
      <p className="text-[11px] text-slate-500">
        {b.ukuranFile ? `Ukuran di berkas ${b.ukuranFile.map(v => f(v, 1)).join(' × ')} (${b.satuanModel ?? 'm'}). ` : ''}
        Model rebah? pilih Tegakkan. Ukuran salah 10×/1000×? ganti satuan. Model tidak ikut ke server - simpan juga ke laptop.
      </p>
    </div>
  );
}
