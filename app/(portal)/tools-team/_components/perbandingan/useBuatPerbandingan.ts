'use client';
/**
 * Alur "buat" Product Comparison: brosur dibaca di peramban, lalu disusun AI - otomatis (Gemini platform,
 * /api/tools-team/perbandingan) atau lewat AI chat pilihan pengguna (salin prompt, tempel jawaban). Kedua jalan
 * diperiksa dengan aturan yang sama (periksaHasil: kutipan wajib ada di brosur).
 */
import { useRef, useState } from 'react';
import { type Bahasa, type KartuBanding, MAKS_PRODUK, MIN_PRODUK, periksaDaftarBerkas, periksaHasil } from '@/lib/perbandingan';
import { ambilJson, promptSalin, type SumberProduk, teksBertanda } from '@/lib/perbandingan-prompt';
import { bacaTeksPdf } from './bacaPdf';
import type { Brosur } from './UnggahBrosur';

export interface HasilSusun { data: KartuBanding; dicek: number; terpangkas: string[] }

export function useBuatPerbandingan() {
  const [brosur, setBrosur] = useState<Brosur[]>([]);
  const [unggulan, setUnggulan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const batal = useRef<AbortController | null>(null);
  const ubahSatu = (id: string, x: Partial<Brosur>) => setBrosur(bs => bs.map(b => (b.id === id ? { ...b, ...x } : b)));

  const tambah = (files: File[]): string | null => {
    const sisa = MAKS_PRODUK - brosur.length;
    if (sisa <= 0) return `Maksimal ${MAKS_PRODUK} produk.`;
    const baru = files.slice(0, sisa).map(file => ({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, file, nama: '', status: 'membaca' as const }));
    setBrosur(bs => [...bs, ...baru]);
    if (!unggulan && baru[0]) setUnggulan(baru[0].id);
    for (const b of baru) {
      bacaTeksPdf(b.file).then(hasil => ubahSatu(b.id, { status: 'siap', hasil }), e => ubahSatu(b.id, { status: 'galat', galat: (e as Error).message }));
    }
    return files.length > sisa ? `Hanya ${sisa} berkas pertama yang ditambahkan (maks ${MAKS_PRODUK} produk).` : null;
  };
  const hapus = (id: string) => { setBrosur(bs => bs.filter(b => b.id !== id)); if (unggulan === id) setUnggulan(brosur.find(b => b.id !== id)?.id ?? null); };

  /** Urutan kolom: unggulan dulu. null = belum siap (alasan dikembalikan). */
  const sumber = (): SumberProduk[] | string => {
    const salah = periksaDaftarBerkas(brosur.map(b => ({ nama: b.file.name, ukuran: b.file.size })));
    if (salah) return salah;
    if (brosur.some(b => b.status === 'membaca')) return 'Tunggu semua brosur selesai dibaca.';
    const rusak = brosur.find(b => b.status === 'galat');
    if (rusak) return `${rusak.galat} Hapus berkas itu dulu.`;
    const urut = [...brosur].sort((a, b) => Number(b.id === unggulan) - Number(a.id === unggulan));
    return urut.map(b => ({ nama: b.nama.trim(), berkas: b.file.name, halaman: b.hasil!.halaman }));
  };

  const otomatis = async (bahasa: Bahasa): Promise<HasilSusun> => {
    const s = sumber(); if (typeof s === 'string') throw new Error(s);
    batal.current = new AbortController(); setSibuk(true);
    try {
      const r = await fetch('/api/tools-team/perbandingan', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, signal: batal.current.signal,
        body: JSON.stringify({ bahasa, produk: s }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.alasan ?? (r.status === 504 ? 'Server terlalu lama - coba lagi atau kurangi brosur.' : 'Server tidak bisa dihubungi.'));
      return { data: j.data, dicek: j.dicek, terpangkas: j.terpangkas ?? [] };
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('Dibatalkan.');
      throw e;
    } finally { setSibuk(false); batal.current = null; }
  };

  const prompt = (bahasa: Bahasa): string => { const s = sumber(); if (typeof s === 'string') throw new Error(s); return promptSalin(bahasa, s); };

  /** Jawaban dari AI chat lain -> diperiksa terhadap teks brosur yang sama. */
  const pakaiJawaban = (teks: string, bahasa: Bahasa): HasilSusun => {
    const s = sumber(); if (typeof s === 'string') throw new Error(s);
    const json = ambilJson(teks);
    if (!json) throw new Error('Jawaban bukan JSON - salin seluruh jawaban AI (termasuk kurung kurawal).');
    const h = periksaHasil(json, s.map(p => teksBertanda(p).teks), bahasa);
    if (!h.ok) throw new Error(h.alasan);
    return { data: h.data, dicek: h.dicek, terpangkas: [] };
  };

  return {
    brosur, unggulan, sibuk, siap: brosur.length >= MIN_PRODUK && brosur.every(b => b.status === 'siap'),
    tambah, hapus, ubahNama: (id: string, nama: string) => ubahSatu(id, { nama }), setUnggulan,
    otomatis, batalkan: () => batal.current?.abort(), prompt, pakaiJawaban,
  };
}
