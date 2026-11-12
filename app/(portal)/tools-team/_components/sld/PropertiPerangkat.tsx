'use client';
import { useRef, useState } from 'react';
import { Copy, FlipHorizontal2, FlipVertical2, Image as IkonFoto, ImagePlus, Plug, RotateCcw, RotateCw, Ruler, Tag, Trash2, Type, Users } from 'lucide-react';
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

const QTY_CEPAT = [1, 2, 3, 4, 6, 8];
const fotoRasio = (src: string) => Object.values(FOTO_PRODUK).find(f => f.src === src)?.rasio;

type Grup = 'info' | 'foto' | 'teks' | 'ukuran' | 'kabel';
const GRUP: [Grup, string, typeof Tag][] = [['info', 'Info & BOQ', Tag], ['foto', 'Foto', IkonFoto], ['teks', 'Teks', Type], ['ukuran', 'Ukuran', Ruler], ['kabel', 'Kabel', Plug]];
const KUNCI_GRUP = 'tools-team-sld-grup-properti';
const grupAwal = (): Grup => {
  try { const g = localStorage.getItem(KUNCI_GRUP); return GRUP.some(x => x[0] === g) ? (g as Grup) : 'info'; } catch { return 'info'; }
};

export function PropertiPerangkat({ a, p, tim }: { a: KeadaanSLD; p: Perangkat; tim?: KatalogTim }) {
  const ubah = (x: Partial<Perangkat>) => a.ubahPerangkat(p.id, x);
  const berkas = useRef<HTMLInputElement>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [grup, setGrupState] = useState<Grup>(grupAwal);
  const setGrup = (g: Grup) => { setGrupState(g); try { localStorage.setItem(KUNCI_GRUP, g); } catch { return; } };
  const lain = a.dok.perangkat.filter(x => x.id !== p.id);
  const saran = templatIkon(p.ikon)?.saran ?? [];
  const jumlahNama = !(p.qty > 1) ? jumlahDariNama(p.nama) : null;

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
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => setGrup('foto')} title="Ganti foto / ilustrasi"
          className="w-16 h-12 rounded-lg border border-slate-200 bg-white grid place-items-center overflow-hidden shrink-0 hover:border-blue-300">
          {p.gambar || p.foto ? <img src={p.gambar ?? p.foto} alt="" className="max-w-full max-h-full object-contain" /> : <MiniIkon ikon={p.ikon} className="w-14 h-9" />}
        </button>
        <Teks label="#Nama di diagram" nilai={p.nama} onUbah={v => ubah({ nama: v })} className="flex-1" />
        <div className="flex gap-1 self-end">
          <button type="button" className={`${kelasTombol} !px-2.5`} onClick={() => a.duplikat(p.id)} aria-label="Duplikat perangkat" title="Duplikat"><Copy size={15} /></button>
          <button type="button" className={`${kelasTombol} !px-2.5 text-rose-700`} onClick={() => a.hapus({ jenis: 'p', id: p.id })} aria-label="Hapus perangkat" title="Hapus"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-0.5 rounded-xl bg-slate-100 p-0.5" role="tablist" aria-label="Grup pengaturan perangkat">
        {GRUP.map(([g, l, Ikon]) => (
          <button key={g} type="button" role="tab" aria-selected={grup === g} onClick={() => setGrup(g)}
            className={`relative flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10.5px] font-bold leading-tight transition-colors duration-150 ${grup === g ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            <Ikon size={15} aria-hidden="true" /> {l}
            {g === 'info' && jumlahNama && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="ada peringatan" />}
            {g === 'foto' && p.gambar && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-sky-500" aria-label="foto lokal" />}
          </button>
        ))}
      </div>

      {grup === 'info' && (<>
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <Teks label="No. BOM" nilai={p.no} onUbah={v => ubah({ no: v.slice(0, 12) })} placeholder={noOtomatis(a.dok).has(p.id) ? `${noOtomatis(a.dok).get(p.id)} (otomatis)` : 'luar BOM'} />
          <Teks label="Kategori" nilai={p.kategori} onUbah={v => ubah({ kategori: v })} />
        </div>
        <Teks label="Merek / model" nilai={p.model} onUbah={v => ubah({ model: v })} daftar={`saran-model-${p.id}`} placeholder={saran[0] ?? ''} />
        <datalist id={`saran-model-${p.id}`}>{saran.map(x => <option key={x} value={x} />)}</datalist>
        <PilihModel a={a} ids={[p.id]} saran={saran} />
        {jumlahNama && (
          <p className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-[11.5px] text-amber-900">
            Nama menyebut {jumlahNama.n} unit tetapi Qty masih 1.{' '}
            <button type="button" className="underline font-bold" onClick={() => ubah({ qty: jumlahNama.n, nama: jumlahNama.nama })}>Jadikan Qty {jumlahNama.n}</button>
          </p>
        )}
        <Isian label="1 gambar mewakili" bantuan="Tampil (4X) di Sheet 1; Sheet 2 & BOQ ikut menghitung qty-nya.">
          <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Jumlah unit yang diwakili gambar">
            {QTY_CEPAT.map(n => (
              <button key={n} type="button" role="radio" aria-checked={p.qty === n} onClick={() => ubah({ qty: n })}
                className={`${kelasTombol} !px-2.5 !py-1 !text-[12px] ${p.qty === n ? '!bg-blue-700 !text-white !border-blue-700' : ''}`}>{n}X</button>
            ))}
            <span className="inline-flex items-center gap-1 ml-1" title="Isi jumlah lain, mis. 12, 16, 24">
              <Angka nilai={p.qty} min={1} maks={9999} onUbah={v => ubah({ qty: Math.max(1, Math.round(v)) })} label="Jumlah unit lain (manual)"
                className={`${kelasKecil} !w-20 !py-1 ${QTY_CEPAT.includes(p.qty) ? '' : '!border-blue-500 ring-2 ring-blue-200'}`} />
              <span className="text-[12px] font-bold text-slate-600">X</span>
            </span>
          </div>
        </Isian>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Teks label="Satuan" nilai={p.satuan} onUbah={v => ubah({ satuan: v })} />
          <Teks label="Teks di kartu gambar" nilai={p.subGambar} onUbah={v => ubah({ subGambar: v })} placeholder={p.model || 'otomatis'} />
        </div>
      </>)}

      {grup === 'foto' && (<>
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
        {galat && <p className="text-[12px] text-rose-700">{galat}</p>}
        {p.gambar
          ? <p className="rounded-md bg-sky-50 border border-sky-200 px-2 py-1.5 text-[11.5px] text-sky-900">Foto ini <b>hanya ada di browser Anda</b> - akun lain melihat foto bawaan / ilustrasi. Klik <b>Simpan ke katalog tim</b> agar sama untuk semua.</p>
          : <p className="text-[11px] text-slate-500">Foto juga bisa diseret ke perangkat di diagram. Foto unggahan hanya disimpan di browser ini, kecuali disimpan ke katalog tim.</p>}
        {!p.gambar && (
          <Isian label="Ilustrasi">
            <select value={p.ikon} onChange={e => ubah({ ikon: e.target.value })} className={kelasKecil}>
              {DAFTAR_IKON.map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
            </select>
          </Isian>
        )}
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
      </>)}

      {grup === 'teks' && (<>
        <Teks label="*Peran (teks merah)" nilai={p.peran} onUbah={v => ubah({ peran: v })} placeholder="mis. Server Voice Command" />
        <Area label="Keterangan (satu baris per poin)" nilai={p.ket} onUbah={v => ubah({ ket: v })} placeholder={'Spesifikasi singkat\nDaya: adaptor 12 V'} />
        <PilihPosisiLabel nilai={p.labelDi} onPilih={x => a.aturLabelDi([p.id], x)} />
        <IsianHurufLabel label="Ukuran huruf label (baris #nama)" dasarMm={LABEL_PERANGKAT.nama.ukuran} faktor={p.huruf} bawaan={a.dok.huruf?.perangkat}
          onUbah={f => ubah({ huruf: f })} bantuan="Baris *peran dan keterangan ikut membesar / mengecil." />
      </>)}

      {grup === 'ukuran' && (<>
        <div className="grid grid-cols-2 gap-2">
          <Isian label="Lebar gambar (mm)"><Angka nilai={p.w} min={12} maks={200} onUbah={v => ubah({ w: v })} /></Isian>
          <Isian label="Tinggi gambar (mm)"><Angka nilai={p.h} min={8} maks={200} onUbah={v => ubah({ h: v })} /></Isian>
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
          <p className="mt-1 text-[11px] text-slate-500">Atau seret tombol bulat di atas perangkat (per 15°, tahan Shift untuk bebas). Tombol R = putar 90°, H / V = balik.</p>
        </Isian>
      </>)}

      {grup === 'kabel' && (<>
        <Teks label="Daftar port (pisahkan dengan koma)" nilai={p.port.join(', ')} onUbah={v => ubah({ port: v.split(',').map(s => s.trim()).filter(Boolean).slice(0, 48) })}
          bantuan="Dipakai sebagai pilihan port saat mengisi kabel." />
        {lain.length > 0 && (
          <Isian label="Sambungkan kabel ke">
            <select value="" onChange={e => e.target.value && a.hubungkan(p.id, e.target.value)} className={kelasKecil}>
              <option value="">Pilih perangkat tujuan...</option>
              {lain.map(x => <option key={x.id} value={x.id}>{x.nama || 'Tanpa nama'}</option>)}
            </select>
          </Isian>
        )}
      </>)}
    </div>
  );
}
