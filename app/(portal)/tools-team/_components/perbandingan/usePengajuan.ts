'use client';
/** Data pengajuan verifikasi Product Comparison (/api/tools-team/perbandingan/pengajuan). */
import { useCallback, useEffect, useState } from 'react';
import type { KartuBanding } from '@/lib/perbandingan';

export interface RingkasPengajuan {
  id: string; judul: string; status: 'menunggu' | 'disetujui' | 'ditolak'; dibuat_oleh: string; dibuat_nama: string | null;
  catatan_verifikator: string | null; diverifikasi_nama: string | null; diverifikasi_at: string | null; created_at: string;
}
export interface Peran { verifikator: boolean; langsung: boolean; lolosSemua: boolean }

const API = '/api/tools-team/perbandingan/pengajuan';
const minta = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, { credentials: 'include', cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.alasan ?? 'Server tidak bisa dihubungi.');
  return j;
};

export function usePengajuan() {
  const [peran, setPeran] = useState<Peran | null>(null);
  const [daftar, setDaftar] = useState<RingkasPengajuan[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const muat = useCallback(async () => {
    try { const j = await minta(API); setPeran(j.peran); setDaftar(j.daftar); setGalat(null); } catch (e) { setGalat((e as Error).message); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void muat(); }, [muat]);
  return {
    peran, daftar, galat, muat,
    ambil: async (id: string): Promise<KartuBanding> => (await minta(`${API}?id=${encodeURIComponent(id)}`)).pengajuan.data as KartuBanding,
    ajukan: async (data: KartuBanding) => { await minta(API, { method: 'POST', body: JSON.stringify({ data }) }); await muat(); },
    putuskan: async (id: string, aksi: 'setujui' | 'tolak', catatan: string, data?: KartuBanding) => {
      await minta(API, { method: 'PATCH', body: JSON.stringify({ id, aksi, catatan, ...(data ? { data } : {}) }) }); await muat();
    },
  };
}
