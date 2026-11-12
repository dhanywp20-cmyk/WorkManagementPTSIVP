'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import type { ConfirmState } from '@/components/shared/ConfirmDialog';
import { DAFTAR_IKON } from '@/lib/sld/ikon';
import { KATALOG, LABEL_KELOMPOK, URUTAN_KELOMPOK, type KelompokKatalog } from '@/lib/sld/katalog';
import { urlFotoTim, type ItemTim } from '@/lib/sld/katalog-tim';
import { Angka, Area, Isian, kelasKecil, kelasTombol, Teks } from './isian';
import { MiniIkon } from './PanelKatalog';
import { fotoUntukTim, type FormTim, type FotoTim, type KatalogTim } from './useKatalogTim';
import type { KeadaanSLD } from './useKeadaanSLD';

const KARTU = 'group relative flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 pt-1.5 pb-2 min-h-[76px] text-center';
const AKSI = 'w-6 h-6 grid place-items-center rounded-md bg-white/95 border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm';
const KATEGORI = [...new Set(KATALOG.map(t => t.kategori))];

export function SeksiKatalogTim({ a, tim, cari, konfirmasi }: { a: KeadaanSLD; tim: KatalogTim; cari: string; konfirmasi: (s: ConfirmState) => void }) {
  const [galat, setGalat] = useState('');
  const q = cari.trim().toLowerCase();
  const isi = q ? tim.daftar.filter(t => `${t.nama} ${t.kategori} ${t.model}`.toLowerCase().includes(q)) : tim.daftar;
  const hapus = (t: ItemTim) => konfirmasi({
    message: `Hapus "${t.nama}" dari katalog tim?`, description: 'Object hilang dari katalog semua akun. SLD yang sudah memakainya tetap bergambar.',
    confirmLabel: 'Hapus', danger: true, onConfirm: async () => setGalat((await tim.hapus(t.id)) ?? ''),
  });
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-blue-700 flex items-center gap-1"><Users size={12} aria-hidden="true" /> Katalog tim</p>
        <button type="button" onClick={tim.bukaBaru} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-bold text-blue-700 hover:bg-blue-50">
          <Plus size={13} /> Tambah object
        </button>
      </div>
      {tim.status === 'muat' && <p className="text-[11.5px] text-slate-500">Memuat katalog tim…</p>}
      {tim.status === 'galat' && (
        <p className="text-[11.5px] text-rose-700">Katalog tim belum bisa dimuat. <button type="button" onClick={() => void tim.muat()} className="underline font-bold inline-flex items-center gap-1"><RefreshCw size={11} /> Coba lagi</button></p>
      )}
      {tim.status === 'siap' && !tim.daftar.length && (
        <p className="text-[11.5px] text-slate-500">Belum ada. Object yang belum ada di katalog bisa ditambah di sini sekali, lalu muncul sama di semua akun tim.</p>
      )}
      {galat && <p className="text-[11.5px] text-rose-700 mb-1">{galat}</p>}
      {isi.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-1.5">
          {isi.map(t => (
            <div key={t.id} className={`${KARTU} hover:border-blue-300 hover:bg-blue-50/60`}>
              <button type="button" onClick={() => a.tambahObjekTim(t)} title={`${t.nama} · ${t.kategori || 'tanpa kategori'} · oleh ${t.oleh || 'tim'}`}
                className="flex flex-col items-center gap-1 w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-300 rounded-lg">
                {t.adaFoto
                  ? <img src={urlFotoTim(t.id, t.versi)} alt="" loading="lazy" className="w-[72px] h-[45px] object-contain" />
                  : <MiniIkon ikon={t.ikon} className="w-[72px] h-[45px]" />}
                <span className="text-[11px] font-semibold leading-tight text-slate-700">{t.nama}</span>
              </button>
              {t.bolehUbah && (
                <span className="absolute top-1 right-1 hidden group-hover:flex group-focus-within:flex gap-0.5">
                  <button type="button" className={AKSI} onClick={() => tim.bukaUbah(t)} aria-label={`Ubah ${t.nama}`}><Pencil size={12} /></button>
                  <button type="button" className={`${AKSI} hover:!text-rose-700`} onClick={() => hapus(t)} aria-label={`Hapus ${t.nama}`}><Trash2 size={12} /></button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {q && tim.daftar.length > 0 && !isi.length && <p className="text-[11.5px] text-slate-500">Tidak ada object tim yang cocok.</p>}
    </div>
  );
}

export function DialogObjekTim({ tim, form: f }: { tim: KatalogTim; form: FormTim }) {
  const [isi, setIsi] = useState(f.isi);
  const [foto, setFoto] = useState<FotoTim | null | undefined>(undefined);
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(!!f.sumberFoto);
  const berkas = useRef<HTMLInputElement>(null);
  const sumber = f.sumberFoto;

  useEffect(() => {
    if (!sumber) return;
    let hidup = true;
    fotoUntukTim(sumber).then(x => { if (hidup) setFoto(x); }).catch(() => { if (hidup) setGalat('Foto perangkat tidak bisa dipakai - pilih foto lain.'); })
      .finally(() => { if (hidup) setProses(false); });
    return () => { hidup = false; };
  }, [sumber]);

  const ubah = (x: Partial<typeof isi>) => setIsi({ ...isi, ...x });
  const pratinjau = foto ? foto.dataUrl : foto === null ? null : f.item?.adaFoto ? urlFotoTim(f.item.id, f.item.versi) : null;
  const pilihFoto = async (b?: File | null) => {
    if (!b) return;
    setProses(true); setGalat('');
    try { setFoto(await fotoUntukTim(b)); } catch (e) { setGalat(e instanceof Error ? e.message : 'Foto gagal dipakai.'); } finally {
      setProses(false);
      if (berkas.current) berkas.current.value = '';
    }
  };
  const simpan = async () => {
    if (!isi.nama.trim()) { setGalat('Nama object wajib diisi.'); return; }
    const g = await tim.simpan(isi, f.item?.id, f.item ? foto : foto ?? undefined);
    if (g) setGalat(g); else tim.tutup();
  };

  return (
    <Modal buka onTutup={tim.tutup} judul={f.item ? `Ubah object tim: ${f.item.nama}` : 'Tambah object ke katalog tim'} ukuran="md" tutupDiLuar={false}
      keterangan="Muncul sama di semua akun. Foto dikecilkan otomatis (maks 400 px) supaya ringan."
      footer={<>
        <TombolModal onClick={tim.tutup} disabled={tim.sibuk}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => void simpan()} disabled={tim.sibuk || proses || !isi.nama.trim()}>{tim.sibuk ? 'Menyimpan…' : 'Simpan ke katalog tim'}</TombolModal>
      </>}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-28 h-20 rounded-lg border border-slate-200 bg-white grid place-items-center overflow-hidden shrink-0">
            {pratinjau ? <img src={pratinjau} alt="" className="max-w-full max-h-full object-contain" /> : <MiniIkon ikon={isi.ikon} className="w-24 h-14" />}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={kelasTombol} disabled={proses} onClick={() => berkas.current?.click()}><ImagePlus size={15} /> {proses ? 'Memproses…' : pratinjau ? 'Ganti foto' : 'Pilih foto'}</button>
            {pratinjau && <button type="button" className={kelasTombol} onClick={() => setFoto(null)}>Pakai ilustrasi</button>}
            <input ref={berkas} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => void pilihFoto(e.target.files?.[0])} />
          </div>
        </div>
        <Teks label="Nama object *" nilai={isi.nama} onUbah={v => ubah({ nama: v.slice(0, 80) })} placeholder="mis. Kamera PTZ Aver TR313" />
        <div className="grid grid-cols-2 gap-2">
          <Teks label="Kategori" nilai={isi.kategori} onUbah={v => ubah({ kategori: v.slice(0, 80) })} daftar="kategori-tim-sld" placeholder="mis. Kamera" />
          <Isian label="Kelompok katalog">
            <select value={isi.kelompok} onChange={e => ubah({ kelompok: e.target.value as KelompokKatalog })} className={kelasKecil}>
              {URUTAN_KELOMPOK.map(k => <option key={k} value={k}>{LABEL_KELOMPOK[k]}</option>)}
            </select>
          </Isian>
        </div>
        <datalist id="kategori-tim-sld">{KATEGORI.map(k => <option key={k} value={k} />)}</datalist>
        <Teks label="Merek / model / part no" nilai={isi.model} onUbah={v => ubah({ model: v.slice(0, 120) })} placeholder="mis. AVer TR313" />
        <Teks label="Port (pisahkan dengan koma)" nilai={isi.port.join(', ')} onUbah={v => ubah({ port: v.split(',').map(s => s.trim()).filter(Boolean).slice(0, 48) })}
          placeholder="mis. HDMI out, LAN (PoE), RS-232" />
        <Area label="Keterangan bawaan (satu baris per poin)" nilai={isi.ket} onUbah={v => ubah({ ket: v.slice(0, 400) })} baris={2} />
        <div className="grid grid-cols-2 gap-2">
          <Isian label="Ilustrasi (bila tanpa foto)">
            <select value={isi.ikon} onChange={e => ubah({ ikon: e.target.value })} className={kelasKecil}>
              {DAFTAR_IKON.map(i => <option key={i.v} value={i.v}>{i.l}</option>)}
            </select>
          </Isian>
          <Isian label="Lebar di diagram (mm)"><Angka nilai={isi.lebar} min={12} maks={200} onUbah={v => ubah({ lebar: v })} /></Isian>
        </div>
        {galat && <p className="text-[12.5px] text-rose-700">{galat}</p>}
      </div>
    </Modal>
  );
}
