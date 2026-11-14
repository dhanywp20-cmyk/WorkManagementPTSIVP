'use client';
import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import type { Benda, Ruang } from '../inti';
import { RUANG_AWAL } from '../useKeadaanDesain';
import type { AlatDesain } from '../panel/alat';

const KUNCI = 'wm_desain3d_draf';
type Draf = { nama: string; ruang: Ruang; benda: Benda[]; waktu: number };

const bacaDraf = (): Draf | null => {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI) ?? 'null') as Draf | null;
    return d && typeof d.nama === 'string' && d.ruang && Array.isArray(d.benda) && d.benda.length ? d : null;
  } catch { return null; }
};
const hapusDraf = () => { try { localStorage.removeItem(KUNCI); } catch { return; } };
const bersihkan = (bs: Benda[]): Benda[] => bs.map(b => ({
  ...b, konten: b.konten === 'gambar' ? 'pola' as const : b.konten, ...(b.jenis === 'model' ? { modelKunci: undefined } : {}),
}));

export function useDrafDesain(a: AlatDesain) {
  const { adaPerubahan, benda, dasar, hanyaLihat, kunciKini, namaDesain, ruang } = a.K;
  const [tawaran, setTawaran] = useState<Draf | null>(bacaDraf);
  useEffect(() => {
    if (hanyaLihat) return;
    if (dasar !== null && kunciKini === dasar) { hapusDraf(); return; }
    if (!adaPerubahan) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(KUNCI, JSON.stringify({ nama: namaDesain, ruang, benda: bersihkan(benda), waktu: Date.now() })); } catch { return; }
    }, 1500);
    return () => clearTimeout(t);
  }, [adaPerubahan, benda, dasar, hanyaLihat, kunciKini, namaDesain, ruang]);
  const pulihkan = () => {
    if (!tawaran) return;
    const { setAsal, setBenda, setDesainAktif, setDasar, setLihatVersi, setNamaDesain, setPesan, setPilih, setRuang, ruangRef } = a.K;
    const rb = { ...RUANG_AWAL, ...tawaran.ruang };
    ruangRef.current = rb;
    setRuang(rb); setBenda(tawaran.benda); setNamaDesain(tawaran.nama);
    setDesainAktif(null); setLihatVersi(null); setDasar(null); setPilih(null);
    setAsal({ jenis: 'lokal', nama: 'Draf otomatis' });
    setPesan('Draf dipulihkan sebagai salinan baru - Simpan untuk menyimpannya ke server tim.');
    setTawaran(null);
  };
  const buang = () => { hapusDraf(); setTawaran(null); };
  return { tawaran, pulihkan, buang };
}

export function BannerDraf({ a }: { a: AlatDesain }) {
  const { tawaran, pulihkan, buang } = useDrafDesain(a);
  if (!tawaran || a.K.hanyaLihat) return null;
  const waktu = new Date(tawaran.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
      <History size={16} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        Ada desain yang belum disimpan dari sesi sebelumnya: <b>{tawaran.nama || 'Tanpa nama'}</b> · {tawaran.benda.length} benda · {waktu}
      </span>
      <button type="button" onClick={pulihkan} className="rounded-lg bg-amber-700 px-3 py-1 text-[12.5px] font-bold text-white hover:bg-amber-800">Pulihkan</button>
      <button type="button" onClick={buang} aria-label="Buang draf" title="Buang draf" className="rounded-lg p-1 text-amber-800 hover:bg-amber-100"><X size={16} /></button>
    </div>
  );
}
