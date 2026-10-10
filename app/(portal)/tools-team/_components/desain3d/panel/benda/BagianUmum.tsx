'use client';
/** Bagian umum panel Atur benda: warna, ukuran produk, posisi, label, konten layar, simpan ke Produk saya. */
import { Angka, Pilih, Catatan } from '../../../bersama/ui';
import { type Benda, DISPLAY, type KontenLayar, warnaSah } from '../../inti';
import { Ikon } from '@/components/shared/Ikon';
import type { KonteksAtur } from './konteks';

/** Warna bawaan per jenis untuk pemilih warna (hanya titik awal pemilih; model tetap memakai bawaannya bila kosong). */
const WARNA_AWAL: Partial<Record<Benda['jenis'], string>> = {
  videowall: '#0a0a0a', led: '#1f2937', layar: '#111827', ifp: '#1f2937', tv: '#111111', meja: '#6c452b', kursi: '#30353d',
  speaker: '#16181c', 'speaker-plafon': '#f4f5f7', mic: '#111827', touchpanel: '#c7ccd3', kamera: '#50555d',
  proyektor: '#f1f2f4', rak: '#111827', lift: '#15171b', bidang: '#f3f4f6', panggung: '#6b6b6b', objek: '#e5e7eb',
};
/** Apa yang diwarnai, per jenis - supaya jelas bagian mana yang berubah. */
const BAGIAN_WARNA: Partial<Record<Benda['jenis'], string>> = {
  videowall: 'bezel & rangka', led: 'rangka cabinet', layar: 'bingkai', ifp: 'bezel', tv: 'bezel', meja: 'permukaan (laminasi polos)',
  kursi: 'kain / cangkang', speaker: 'kabinet & gril', 'speaker-plafon': 'cincin & gril', mic: 'badan / kain', touchpanel: 'badan',
  kamera: 'badan', proyektor: 'cangkang', rak: 'kabinet', lift: 'rangka & tutup', bidang: 'permukaan layar', objek: 'permukaan objek',
};

export function BagianUmum({ c }: { c: KonteksAtur }) {
  const { UKURAN_DARI_PILIHAN, b, batas, bawaan, bedaBawaan, bundar, formProduk, label, mm, onGambar, onSimpanProduk, plafon, set, setFormProduk } = c;
  return (
    <>
      {b.jenis !== 'model' && b.jenis !== 'teks' && (
        <div>
          <span className={label}>Warna{BAGIAN_WARNA[b.jenis] ? ` · ${BAGIAN_WARNA[b.jenis]}` : ''}</span>
          <div className="flex items-center gap-2">
            <input type="color" aria-label="Warna utama" value={warnaSah(b.warna) ?? WARNA_AWAL[b.jenis] ?? '#808080'}
              onChange={e => set({ warna: e.target.value })}
              className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
            <span className="text-[12px] font-mono text-slate-700">{warnaSah(b.warna) ?? 'bawaan'}</span>
            {warnaSah(b.warna) && (
              <button type="button" onClick={() => set({ warna: undefined })}
                className="ml-auto px-2 py-1 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Warna bawaan</button>
            )}
          </div>
        </div>
      )}

      {b.jenis !== 'teks' && (
      <div>
        <span className={label}>Ukuran produk</span>
        <div className="grid grid-cols-3 gap-2">
          <Angka label={bundar ? 'Diameter (mm)' : 'Lebar (mm)'} nilai={mm(b.w)} step={1}
            onUbah={v => v >= 5 && v <= 30000 && set(bundar ? { w: v / 1000, d: v / 1000 } : { w: v / 1000 })} />
          <Angka label="Tinggi (mm)" nilai={mm(b.h)} step={1} onUbah={v => v >= 2 && v <= 15000 && set({ h: v / 1000 })} />
          {!bundar && (
            <Angka label={b.jenis === 'meja' ? 'Panjang (mm)' : 'Tebal (mm)'} nilai={mm(b.d)} step={1}
              onUbah={v => v >= 2 && v <= 30000 && set({ d: v / 1000 })} />
          )}
        </div>
        {bawaan && bedaBawaan && (
          <button type="button" onClick={() => set(bawaan)}
            className="mt-1.5 w-full px-2 py-1.5 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            Kembalikan ukuran bawaan ({mm(bawaan.w)} × {mm(bawaan.h)} × {mm(bawaan.d)} mm)
          </button>
        )}
        <Catatan>
          {UKURAN_DARI_PILIHAN.includes(b.jenis)
            ? 'Terisi otomatis dari model/inci/U yang dipilih. Ganti dengan angka datasheet bila berbeda; memilih model/inci/U lagi mengembalikan ukuran bawaannya.'
            : 'Sesuaikan dengan datasheet / ukuran produk sebenarnya (presisi 1 mm).'}
        </Catatan>
      </div>
      )}

      <div>
        <span className={label}>Posisi</span>
        <div className="grid grid-cols-2 gap-2">
          <Angka label="X" nilai={b.x} satuan="m" onUbah={v => set({ x: Math.min(batas.x, Math.max(0, v)) })} />
          <Angka label="Z" nilai={b.z} satuan="m" onUbah={v => set({ z: Math.min(batas.z, Math.max(0, v)) })} />
          <Angka label="Putar" nilai={b.rot} satuan="°" onUbah={v => set({ rot: ((v % 360) + 360) % 360 })} />
          <Angka label="Dari lantai" nilai={Math.round(b.elev * 100) / 100} satuan="m" onUbah={v => v >= 0 && set({ elev: Math.min(Math.max(0, plafon - b.h), v) })} />
        </div>
      </div>

      {b.jenis !== 'teks' && <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
        <input type="checkbox" className="w-4 h-4" checked={!b.sembunyiLabel} onChange={e => set({ sembunyiLabel: e.target.checked ? undefined : true })} />
        Tampilkan label produk benda ini
      </label>}
      {DISPLAY.includes(b.jenis) && (
        <div className="space-y-2">
          <Pilih label="Konten layar" nilai={b.konten ?? 'pola'} onUbah={(v: KontenLayar) => (v === 'gambar' ? onGambar() : set({ konten: v }))}
            opsi={[
              { v: 'pola', l: 'Pola uji (color bar)' }, { v: 'campuran', l: 'Command center: grafik + CCTV' }, { v: 'cctv', l: 'CCTV (grid kamera)' },
              { v: 'dashboard', l: 'Dashboard / grafik' }, { v: 'desktop', l: 'Home screen (IFP / signage)' }, { v: 'gambar', l: 'Gambar unggahan...' }, { v: 'mati', l: 'Mati (layar hitam)' },
            ] as { v: KontenLayar; l: string }[]} />
          <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
            <input type="checkbox" className="w-4 h-4" checked={!b.sembunyiUkur} onChange={e => set({ sembunyiUkur: e.target.checked ? undefined : true })} />
            Tampilkan garis ukuran (mm) benda ini
          </label>
        </div>
      )}
      {onSimpanProduk && b.jenis !== 'model' && b.jenis !== 'objek' && b.jenis !== 'teks' && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
          {!formProduk ? (
            <button type="button" onClick={() => setFormProduk({ label: b.nama, ket: '', status: '', sibuk: false })}
              className="w-full px-3 py-2 rounded-lg text-[12.5px] font-bold text-violet-800 bg-white border border-violet-200 hover:bg-violet-100">
              <Ikon nama="⭐" ukuran={14} /> Simpan ke Produk saya
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-800">Simpan sebagai template tim</p>
              <input value={formProduk.label} maxLength={80} onChange={e => setFormProduk({ ...formProduk, label: e.target.value })} placeholder="Nama produk (mis. Samsung QM55C)"
                aria-label="Nama produk" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm" />
              <input value={formProduk.ket} maxLength={120} onChange={e => setFormProduk({ ...formProduk, ket: e.target.value })} placeholder="Keterangan (opsional, mis. merek / tipe)"
                aria-label="Keterangan produk" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm" />
              <Catatan>Disimpan: ukuran, model, warna, spesifikasi &amp; tinggi pasang - muncul di Tambah → Produk saya untuk seluruh tim.</Catatan>
              {formProduk.status && <p className="text-[12px] font-semibold text-rose-700">{formProduk.status}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={formProduk.sibuk || !formProduk.label.trim()}
                  onClick={async () => {
                    setFormProduk({ ...formProduk, sibuk: true, status: '' });
                    const galat = await onSimpanProduk(formProduk.label.trim(), formProduk.ket.trim());
                    if (galat) setFormProduk({ ...formProduk, sibuk: false, status: galat }); else setFormProduk(null);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-50">
                  {formProduk.sibuk ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={() => setFormProduk(null)}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Batal</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
