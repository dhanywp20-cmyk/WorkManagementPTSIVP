'use client';
/** Panel Tambah benda: Produk saya (tim), katalog per grup, set ruang kelas, objek dari luar. */
import { Angka, Segmen } from '../../bersama/ui';
import { TERIMA_3D } from '../impor/berkas3d';
import { KATALOG, LABEL, type OpsiKelas, ukuranSetKelas } from '../inti';
import { Trash2 } from 'lucide-react';
import type { AlatDesain } from './alat';

export function PanelTambah({ a }: { a: AlatDesain }) {
  const { bukaKelas, cariProduk, duaRuang, galatProduk, impor, inputModel, kotakRuang, opsiKelas, produkTim, setBukaKelas, setCariProduk, setObjekGambar, setOpsiKelas, setTargetRuang, sisi, targetRuang } = a.K;
  const { tambah, tambahSetKelas } = a.aksi;
  const { hapusProduk, tambahProduk } = a.produk;
  return (
    <>
      {sisi === 'tambah' && (
        <>
          {duaRuang && (
            <div className="mb-3 max-w-xs">
              <Segmen label="Tambah ke" nilai={targetRuang} onUbah={setTargetRuang} opsi={kotakRuang.map((_, i) => ({ v: String(i), l: `Ruang ${i + 1}` }))} />
            </div>
          )}
          <div className="space-y-4">
            {/* Produk saya: template produk yang disimpan engineer, dipakai seluruh tim. */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">⭐ Produk saya (tim)</p>
                {produkTim && produkTim.daftar.length > 6 && (
                  <input value={cariProduk} onChange={e => setCariProduk(e.target.value)} placeholder="Cari..." aria-label="Cari produk saya"
                    className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-[12px]" />
                )}
              </div>
              {galatProduk && <p className="text-[12px] font-semibold text-rose-700 mb-1">{galatProduk}</p>}
              {!produkTim ? <p className="text-[12px] text-slate-500">Memuat...</p>
                : produkTim.daftar.length === 0 ? (
                  <p className="text-[12px] text-slate-600 leading-relaxed">Belum ada. Atur ukuran/warna/spesifikasi sebuah benda, lalu di panel Atur pilih <b>Simpan ke Produk saya</b>.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                    {produkTim.daftar.filter(p => !cariProduk.trim() || `${p.label} ${p.ket} ${p.oleh}`.toLowerCase().includes(cariProduk.trim().toLowerCase())).map(p => (
                      <div key={p.id} className="relative">
                        <button type="button" onClick={() => tambahProduk(p)}
                          className="w-full h-full text-left rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2.5 pr-7 hover:border-violet-400 hover:bg-violet-100/60">
                          <span className="block text-[13px] font-bold text-slate-900 break-words">{p.label}</span>
                          <span className="block text-[11.5px] text-slate-600">{p.ket || LABEL[p.jenis]}</span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">
                            {typeof p.atur.w === 'number' && typeof p.atur.h === 'number' ? `${Math.round((p.atur.w as number) * 1000)} × ${Math.round((p.atur.h as number) * 1000)} mm · ` : ''}{p.oleh}
                          </span>
                        </button>
                        {p.bolehHapus && (
                          <button type="button" onClick={() => void hapusProduk(p)} aria-label={`Hapus ${p.label} dari Produk saya`} title="Hapus dari Produk saya"
                            className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
            {KATALOG.map(g => (
              <div key={g.grup}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">{g.grup}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                  {g.item.map(it => (
                    <button key={it.kunci} type="button" onClick={() => (it.kunci === 'set-kelas' ? setBukaKelas(v => !v) : tambah(it))}
                      aria-expanded={it.kunci === 'set-kelas' ? bukaKelas : undefined}
                      className={`text-left rounded-xl border px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50/60 ${it.kunci === 'set-kelas' && bukaKelas ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200'}`}>
                      <span className="block text-[13px] font-bold text-slate-900">{it.label}</span>
                      <span className="block text-[11.5px] text-slate-600">{it.ket}</span>
                    </button>
                  ))}
                </div>
                {g.item.some(it => it.kunci === 'set-kelas') && bukaKelas && (() => {
                  const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
                  const u = ukuranSetKelas(k, opsiKelas);
                  const setO = (x: Partial<OpsiKelas>) => setOpsiKelas(o => ({ ...o, ...x }));
                  return (
                    <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Set ruang kelas</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Angka label="Kolom meja" nilai={u.kolom} step={1} onUbah={v => v >= 1 && v <= 12 && setO({ kolom: Math.round(v) })} />
                        <Angka label="Baris" nilai={u.baris} step={1} onUbah={v => v >= 1 && v <= 20 && setO({ baris: Math.round(v) })} />
                        <Angka label="Jarak baris" nilai={u.jarakBaris} satuan="m" step={0.05} onUbah={v => v >= 0.8 && v <= 4 && setO({ jarakBaris: v })} />
                        <Angka label="Celah antar meja" nilai={u.celah} satuan="m" step={0.05} onUbah={v => v >= 0.2 && v <= 3 && setO({ celah: v })} />
                      </div>
                      <Segmen label="Kursi per meja" nilai={String(u.perMeja)} onUbah={v => setO({ kursiPerMeja: Number(v) })}
                        opsi={[{ v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3', l: '3' }]} />
                      <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                        <input type="checkbox" className="w-4 h-4" checked={opsiKelas.pengajar !== false} onChange={e => setO({ pengajar: e.target.checked })} /> Meja pengajar
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={tambahSetKelas}
                          className="flex-1 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-blue-700 hover:bg-blue-800">
                          Tambahkan {u.kolom * u.baris} meja & {u.kolom * u.baris * u.perMeja} kursi
                        </button>
                        <button type="button" onClick={() => setOpsiKelas({})} title="Kembali ke hitungan otomatis dari ukuran ruang"
                          className="px-3 py-2 rounded-lg text-[12.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Otomatis</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Objek dari luar (mapping patung, gedung, produk)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                <button type="button" disabled={impor.sibuk} onClick={() => inputModel.current?.click()}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-left hover:bg-violet-100 disabled:opacity-60">
                  <span className="block text-[13px] font-bold text-violet-900">{impor.sibuk ? 'Membaca berkas...' : 'Impor berkas 3D'}</span>
                  <span className="block text-[11.5px] text-violet-800">SketchUp (ekspor .dae / .obj / .stl / .kmz), .glb, .fbx, .3ds, .ply, atau .zip berisi model + tekstur · maks 60 MB</span>
                </button>
                <button type="button" onClick={() => setObjekGambar({})}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-left hover:bg-violet-100">
                  <span className="block text-[13px] font-bold text-violet-900">Objek dari gambar</span>
                  <span className="block text-[11.5px] text-violet-800">Foto patung / tampak gedung / logo / sketsa bidang → siluet 3D atau panel</span>
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                Berkas .skp tidak bisa dibaca langsung: di SketchUp pilih File → Export → 3D Model → COLLADA (.dae). Pilih model bersama
                tekstur/.mtl-nya sekaligus (atau satu .zip). Bentuk dasar (kotak, silinder, kubah...) ada di grup Objek mapping di atas.
              </p>
              <input ref={inputModel} type="file" multiple accept={TERIMA_3D} className="hidden"
                onChange={e => { const daftar = Array.from(e.target.files ?? []); e.target.value = ''; void impor.imporBerkas(daftar); }} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
