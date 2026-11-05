'use client';
import { type ReactNode, useState } from 'react';
import { bendaBaru, spekVideowall, terapkanUkuran, type Benda, type Ruang } from '../../inti';

export interface PropsPanelBenda {
  b: Benda; plafon: number; batas: { x: number; z: number };
  onUbah: (b: Benda) => void; onGambar: () => void; onTutup: () => void;
  adaFoto?: boolean; onGambarObjek?: () => void;
   ekstra?: ReactNode;
  onSimpanProduk?: (label: string, ket: string) => Promise<string | null>;
  onSimpanObjek?: (nama: string, ket: string) => Promise<string | null>;
   semua?: Benda[];
   ruang?: Ruang;
}

export function useKonteksAtur(p: PropsPanelBenda) {
  const { b, plafon, batas, onUbah, onGambar, onTutup, ekstra, onSimpanProduk, onSimpanObjek, adaFoto = false, onGambarObjek, semua = [b], ruang = null } = p;
  const [formProduk, setFormProduk] = useState<{ label: string; ket: string; status: string; sibuk: boolean } | null>(null);
  const set = (x: Partial<Benda>) => onUbah({ ...b, ...x });
  const setUkuran = (x: Partial<Benda>) => {
    const nb = terapkanUkuran({ ...b, ...x });
    if (nb.jenis === 'videowall' && /^Videowall \d+" \d+×\d+$/.test(b.nama)) nb.nama = `Videowall ${spekVideowall(nb).inci}" ${nb.kol}×${nb.bar}`;
    if (nb.jenis === 'tv' && /^Signage \d+(\.\d+)?"$/.test(b.nama)) nb.nama = `Signage ${nb.diag}"`;
    if (nb.jenis === 'tribun' && /^Tribun \d+ baris × \d+$/.test(b.nama)) nb.nama = `Tribun ${nb.baris} baris × ${nb.kursiBaris}`;
    onUbah(nb);
  };
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1';
  const kosong = { x0: 0, p: 0, l: 0, t: plafon };

  const mm = (m: number) => Math.round(m * 1000);
  const bundar = b.jenis === 'mic' && b.mic === 'boundary';
  const ukuranBawaan = (): { w: number; h: number; d: number } | null => {
    if (b.jenis === 'model' || b.jenis === 'led' || b.jenis === 'objek') return null;
    const varian: Partial<Benda> = {};
    for (const k of ['vw', 'panel', 'kol', 'bar', 'diag', 'rasio', 'rakU', 'mic', 'bentukMeja', 'tipeKursi', 'tipeKamera', 'pasangProyektor', 'pasang', 'tipeSpeaker', 'modul',
      'baris', 'kursiBaris', 'tinggiAnak', 'bentukBidang', 'jariBidang', 'busur'] as const) {
      if (b[k] !== undefined) (varian as Record<string, unknown>)[k] = b[k];
    }
    const acuan = terapkanUkuran({ ...bendaBaru(b.jenis, kosong, varian), ...varian });
    return { w: acuan.w, h: acuan.h, d: acuan.d };
  };
  const bawaan = ukuranBawaan();
  const bedaBawaan = !!bawaan && (mm(bawaan.w) !== mm(b.w) || mm(bawaan.h) !== mm(b.h) || mm(bawaan.d) !== mm(b.d));
  const UKURAN_DARI_PILIHAN = ['videowall', 'layar', 'ifp', 'tv', 'rak', 'tribun', 'bidang'];
  return { b, plafon, batas, onUbah, onGambar, onTutup, ekstra, onSimpanProduk, onSimpanObjek, adaFoto, onGambarObjek, semua, ruang, formProduk, setFormProduk, set, setUkuran, label, kosong, mm, bundar, bawaan, bedaBawaan, UKURAN_DARI_PILIHAN };
}

export type KonteksAtur = ReturnType<typeof useKonteksAtur>;
