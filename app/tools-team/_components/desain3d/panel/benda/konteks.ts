'use client';
/** Keadaan & helper bersama panel Atur benda (dipakai semua bagian per jenis di folder ini). */
import { type ReactNode, useState } from 'react';
import { bendaBaru, spekVideowall, terapkanUkuran, type Benda } from '../../inti';

export interface PropsPanelBenda {
  b: Benda; plafon: number; batas: { x: number; z: number };
  onUbah: (b: Benda) => void; onGambar: () => void; onTutup: () => void;
  /** Objek dari gambar: foto permukaannya ada di memori; buat ulang siluet dari gambar lain. */
  adaFoto?: boolean; onGambarObjek?: () => void;
  /** Isi tambahan khusus jenis (mis. info jarak lempar proyektor). */ ekstra?: ReactNode;
  /** Simpan benda ini sebagai template "Produk saya" (tim). Mengembalikan pesan galat atau null. Tanpa prop = tidak tersedia. */
  onSimpanProduk?: (label: string, ket: string) => Promise<string | null>;
  /** Semua benda di desain (kabel otomatis: ada rack? ada kamera untuk USB meja?). */ semua?: Benda[];
}

export function useKonteksAtur(p: PropsPanelBenda) {
  const { b, plafon, batas, onUbah, onGambar, onTutup, ekstra, onSimpanProduk, adaFoto = false, onGambarObjek, semua = [b] } = p;
  const [formProduk, setFormProduk] = useState<{ label: string; ket: string; status: string; sibuk: boolean } | null>(null);
  const set = (x: Partial<Benda>) => onUbah({ ...b, ...x });
  const setUkuran = (x: Partial<Benda>) => {
    const nb = terapkanUkuran({ ...b, ...x });
    //  Nama bawaan videowall ("Videowall 55" 2×2") ikut model/kolom/baris; nama yang sudah diganti engineer dibiarkan.
    if (nb.jenis === 'videowall' && /^Videowall \d+" \d+×\d+$/.test(b.nama)) nb.nama = `Videowall ${spekVideowall(nb).inci}" ${nb.kol}×${nb.bar}`;
    if (nb.jenis === 'tv' && /^Signage \d+(\.\d+)?"$/.test(b.nama)) nb.nama = `Signage ${nb.diag}"`;
    if (nb.jenis === 'tribun' && /^Tribun \d+ baris × \d+$/.test(b.nama)) nb.nama = `Tribun ${nb.baris} baris × ${nb.kursiBaris}`;
    onUbah(nb);
  };
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1';
  /** Kotak semu untuk mengambil ukuran bawaan varian dari bendaBaru (posisi tidak dipakai). */
  const kosong = { x0: 0, p: 0, l: 0, t: plafon };

  //  Ukuran produk dalam mm (satuan datasheet), presisi 1 mm. Semua jenis bisa diubah - ukuran
  //  bawaan katalog bisa saja tidak persis sama dengan produk yang dipakai.
  const mm = (m: number) => Math.round(m * 1000);
  const bundar = b.jenis === 'mic' && b.mic === 'boundary';
  /** Ukuran bawaan untuk varian yang sedang dipilih (model/inci/U/tipe), atau null bila tidak ada patokan. */
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
  return { b, plafon, batas, onUbah, onGambar, onTutup, ekstra, onSimpanProduk, adaFoto, onGambarObjek, semua, formProduk, setFormProduk, set, setUkuran, label, kosong, mm, bundar, bawaan, bedaBawaan, UKURAN_DARI_PILIHAN };
}

export type KonteksAtur = ReturnType<typeof useKonteksAtur>;
