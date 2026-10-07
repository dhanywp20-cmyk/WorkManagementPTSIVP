'use client';
/** Modal "Buka desain tersimpan", pratinjau versi, pemilih warna & judul panel samping (dipisah dari Desain3D.tsx). */
import { useEffect, useState } from 'react';
import { HardDriveUpload, History } from 'lucide-react';
import { Ikon } from '@/components/shared/Ikon';
import { Modal } from '@/components/shared/Modal';
import { urlGambarDesain } from '@/lib/tools-team';
import { type Ruang, warnaSah } from '../inti';

interface BarisDesain {
  id: string; nama: string; versi: number; jumlah_benda: number; dibuat_oleh_nama: string; diubah_oleh_nama: string;
  updated_at: string; ruang: Ruang | null;
}

/** Pratinjau satu versi: dimuat malas & di-cache peramban; placeholder bila belum ada gambar. */
export function GambarVersi({ id, versi, className }: { id: string; versi: number; className: string }) {
  const [gagal, setGagal] = useState(false);
  if (gagal) return <div className={`${className} rounded-lg bg-slate-100 grid place-items-center flex-shrink-0 text-slate-400`}><Ikon nama="🧊" ukuran={18} /></div>;
  return <img src={urlGambarDesain(id, versi)} alt="" loading="lazy" decoding="async" onError={() => setGagal(true)}
    className={`${className} object-cover rounded-lg border border-slate-100 flex-shrink-0 bg-slate-50`} />;
}

/**
 * Daftar desain tersimpan seluruh tim untuk dibuka lagi (cari di server),
 * dengan pratinjau dan riwayat versi - versi lama bisa dibuka; menyimpannya
 * membuat versi baru, riwayat tidak berubah.
 */
export const JUDUL_SISI: Record<'kategori' | 'tambah' | 'ruang' | 'daftar', { judul: string; ikon: string; ket?: string }> = {
  kategori: { judul: 'Kategori ruangan', ikon: '🏛', ket: 'Mulai dari tata letak siap pakai - semua isi tetap bisa diubah. Isi kanvas sekarang diganti (bisa dikembalikan dengan Undo).' },
  tambah: { judul: 'Tambah benda', ikon: '➕', ket: 'Klik produk untuk menambahkannya; panel tetap terbuka supaya bisa menambah beberapa sekaligus.' },
  ruang: { judul: 'Ruangan', ikon: '🏠', ket: 'Maks 4 ruang berderet ke kanan; sekat terbuka + lebar berbeda = ruang bentuk L. Saat ukuran diubah, isi ruang ikut menyesuaikan.' },
  daftar: { judul: 'Daftar benda', ikon: '📋', ket: 'Klik nama benda untuk memilihnya di tampilan 3D.' },
};

export function ModalBukaDesain({ buka, onTutup, aktifId, onBuka, onLaptop }: {
  buka: boolean; onTutup: () => void; aktifId: string | null; onBuka: (id: string, versi?: number) => void; onLaptop: () => void;
}) {
  const [q, setQ] = useState('');
  const [daftar, setDaftar] = useState<BarisDesain[] | null>(null);
  const [galat, setGalat] = useState('');
  const [riwayatId, setRiwayatId] = useState<string | null>(null);
  const [versi, setVersi] = useState<{ versi: number; created_at: string; dibuat_oleh_nama: string }[] | null>(null);

  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tools-team/desain${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!hidup) return;
        if (r.ok && j?.ok) { setDaftar(j.daftar); setGalat(''); } else { setDaftar([]); setGalat(j?.alasan ?? 'Daftar tidak bisa dimuat.'); }
      } catch { if (hidup) { setDaftar([]); setGalat('Tidak terhubung ke server.'); } }
    }, q ? 300 : 0);
    return () => { hidup = false; clearTimeout(t); };
  }, [buka, q]);

  const lihatRiwayat = async (id: string) => {
    if (riwayatId === id) { setRiwayatId(null); return; }
    setRiwayatId(id); setVersi(null);
    try {
      const r = await fetch(`/api/tools-team/desain?id=${encodeURIComponent(id)}&riwayat=1`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      setVersi(r.ok && j?.ok ? j.versi : []);
    } catch { setVersi([]); }
  };
  const tgl = (x: string) => new Date(x).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal buka={buka} onTutup={onTutup} judul="Buka desain tersimpan" ukuran="lg" ikon={<Ikon nama="📁" ukuran={18} />}
      keterangan="Dari laptop, atau dari desain yang disimpan anggota tim di server (versi lama bisa dibuka dari riwayat).">
      <button type="button" onClick={onLaptop}
        className="w-full mb-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left hover:bg-emerald-100">
        <HardDriveUpload size={20} className="text-emerald-700 flex-shrink-0" />
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-emerald-900">Buka dari laptop (.glb)</span>
          <span className="block text-[11.5px] text-emerald-800">File yang disimpan lewat "Simpan .glb" - tanpa storage server</span>
        </span>
      </button>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Desain tim di server</p>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama desain atau pembuat" aria-label="Cari desain"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm mb-3" />
      {galat && <p className="text-[12.5px] text-rose-700 mb-2">{galat}</p>}
      {daftar === null ? <p className="text-sm text-slate-500">Memuat...</p> : daftar.length === 0 ? (
        <p className="text-sm text-slate-500">{q ? 'Tidak ada desain yang cocok.' : 'Belum ada desain tersimpan. Simpan desain lewat tombol Simpan.'}</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {daftar.map(d => (
            <li key={d.id} className={`rounded-xl border p-2 ${aktifId === d.id ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'}`}>
              <div className="flex gap-2.5">
                <GambarVersi id={d.id} versi={d.versi} className="w-24 h-14" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{d.nama}{aktifId === d.id && <span className="ml-1 text-[11px] font-bold text-emerald-700">· terbuka</span>}</p>
                  <p className="text-[11.5px] text-slate-600 truncate">v{d.versi} · {d.ruang ? `${d.ruang.p}×${d.ruang.l} m${d.ruang.r2?.aktif ? ` + ${1 + (d.ruang.lain ?? []).filter(x => x?.aktif).length} ruang` : ''} · ` : ''}{d.jumlah_benda} benda</p>
                  <p className="text-[11px] text-slate-500 truncate">{d.diubah_oleh_nama || d.dibuat_oleh_nama || '—'} · {tgl(d.updated_at)}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => onBuka(d.id)} className="flex-1 px-2 py-1.5 rounded-lg text-[12px] font-bold text-white bg-blue-700 hover:bg-blue-800">Buka</button>
                {d.versi > 1 && (
                  <button type="button" onClick={() => void lihatRiwayat(d.id)} aria-expanded={riwayatId === d.id}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
                    <History size={13} /> Riwayat ({d.versi})
                  </button>
                )}
              </div>
              {riwayatId === d.id && (
                <ul className="mt-2 border-t border-slate-100 pt-1.5 space-y-0.5 max-h-48 overflow-y-auto">
                  {versi === null ? <li className="text-[12px] text-slate-500">Memuat...</li> : versi.map(v => (
                    <li key={v.versi} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="text-slate-700"><b>v{v.versi}</b> · {v.dibuat_oleh_nama || '—'} · {tgl(v.created_at)}</span>
                      <button type="button" onClick={() => onBuka(d.id, v.versi)} className="text-blue-700 font-bold hover:underline">Buka</button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Pemilih warna dengan tombol kembali ke bawaan; `nilai` kosong = warna bawaan. */
export function PilihWarna({ label, nilai, awal, onUbah }: { label: string; nilai?: string; awal: string; onUbah: (w: string | undefined) => void }) {
  const sah = warnaSah(nilai);
  return (
    <div className="mt-2">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={sah ?? awal} onChange={e => onUbah(e.target.value)}
          className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
        <span className="text-[12px] font-mono text-slate-700">{sah ?? 'bawaan'}</span>
        {sah && (
          <button type="button" onClick={() => onUbah(undefined)}
            className="ml-auto px-2 py-1 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Bawaan</button>
        )}
      </div>
    </div>
  );
}
