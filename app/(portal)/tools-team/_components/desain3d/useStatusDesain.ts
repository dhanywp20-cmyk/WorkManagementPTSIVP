'use client';
import { useEffect, useState } from 'react';
import { type Benda, KATEGORI_RUANG, type Ruang } from './inti';
import { isiDariIngatan, KATEGORI_AWAL } from './simpan/templateAwal';
import type { DesainTim } from './useKeadaanDesain';

export const KUNCI_SIMPAN = 'wm_desain3d';

export function useStatusDesain(isiAwal: ReturnType<typeof isiDariIngatan>) {
  const [namaDesain, setNamaDesain] = useState(() => (isiAwal ? `${isiAwal.nama} (salinan)` : 'Ruang Meeting'));
  const [asal, setAsal] = useState<{ jenis: 'baru' | 'laptop' | 'lokal' | 'template'; nama?: string }>(() => (isiAwal
    ? { jenis: 'template', nama: `${KATEGORI_RUANG.find(k => k.id === KATEGORI_AWAL)?.judul ?? isiAwal.nama} · default Admin` }
    : { jenis: 'baru' }));
  const [dasar, setDasar] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState<{ nama: string; ruang: Ruang; benda: Benda[] }[]>([]);
  const [daftarTim, setDaftarTim] = useState<DesainTim[] | null>(null);
  const [desainAktif, setDesainAktif] = useState<{ id: string; bolehUbah: boolean; versi: number } | null>(null);
  const [lihatVersi, setLihatVersi] = useState<{ versi: number; terbaru: number } | null>(null);
  const [statusSimpan, setStatusSimpan] = useState<{ teks: string; nada: 'ok' | 'galat' | 'info' } | null>(null);
  const [sibukSimpan, setSibukSimpan] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(KUNCI_SIMPAN); if (s) setTersimpan(JSON.parse(s)); } catch {  }
  }, []);
  return { namaDesain, setNamaDesain, asal, setAsal, dasar, setDasar, tersimpan, setTersimpan, daftarTim, setDaftarTim, desainAktif, setDesainAktif,
    lihatVersi, setLihatVersi, statusSimpan, setStatusSimpan, sibukSimpan, setSibukSimpan };
}
