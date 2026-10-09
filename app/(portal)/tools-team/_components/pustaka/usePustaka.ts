'use client';
/**
 * Klien Pustaka Tools Team (lib/pustaka.ts, /api/tools-team/pustaka).
 *
 * Tiap jenis dimuat SEKALI per sesi tab lalu dipakai bersama semua kalkulator (hemat egress); setelah
 * Admin mengubah isi, segarkanPustaka(jenis) membuang ingatan & memberi tahu semua pemakai. Gagal muat
 * tidak diingat - kalkulator memakai nilai bawaan kode dan mencoba lagi lain kali.
 */
import { useEffect, useState } from 'react';
import type { EntriPustaka } from '@/lib/pustaka';

const API = '/api/tools-team/pustaka';
interface HasilMuat { entri: EntriPustaka[]; bolehAtur: boolean; gagal: boolean }
const ingatan = new Map<string, Promise<HasilMuat>>();
const pendengar = new Set<() => void>();

function muat(jenis: string): Promise<HasilMuat> {
  const ada = ingatan.get(jenis);
  if (ada) return ada;
  const p = fetch(`${API}?jenis=${encodeURIComponent(jenis)}`, { credentials: 'include', cache: 'no-store' })
    .then(r => r.json().then(j => ({ r, j })))
    .then(({ r, j }) => {
      if (!r.ok || !j?.ok) throw new Error(j?.alasan ?? 'gagal');
      return { entri: (j.entri ?? []) as EntriPustaka[], bolehAtur: !!j.bolehAtur, gagal: false };
    })
    .catch(() => { ingatan.delete(jenis); return { entri: [], bolehAtur: false, gagal: true }; });
  ingatan.set(jenis, p);
  return p;
}

/** Buang ingatan (satu jenis / semua) lalu muat ulang di semua komponen yang memakainya. */
export function segarkanPustaka(jenis?: string) {
  if (jenis) ingatan.delete(jenis); else ingatan.clear();
  pendengar.forEach(f => f());
}

/** Entri satu jenis pustaka. `memuat` true sampai jawaban pertama datang. */
export function usePustaka(jenis: string) {
  const [isi, setIsi] = useState<HasilMuat & { memuat: boolean }>({ entri: [], bolehAtur: false, gagal: false, memuat: true });
  useEffect(() => {
    let hidup = true;
    const tarik = () => { void muat(jenis).then(h => { if (hidup) setIsi({ ...h, memuat: false }); }); };
    tarik();
    pendengar.add(tarik);
    return () => { hidup = false; pendengar.delete(tarik); };
  }, [jenis]);
  return isi;
}

async function kirim(init: RequestInit, url = API): Promise<{ ok: boolean; alasan?: string; entri?: EntriPustaka }> {
  try {
    const r = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
    const j = await r.json().catch(() => null);
    return r.ok && j?.ok ? { ok: true, entri: j.entri } : { ok: false, alasan: j?.alasan ?? 'Gagal menyimpan.' };
  } catch { return { ok: false, alasan: 'Tidak terhubung ke server.' }; }
}

export async function simpanEntri(e: { id?: string; jenis: string; nama: string; data: Record<string, string | number> }) {
  const h = await kirim({ method: 'POST', body: JSON.stringify(e) });
  if (h.ok) segarkanPustaka(e.jenis);
  return h;
}

export async function hapusEntri(id: string, jenis: string) {
  const h = await kirim({ method: 'DELETE' }, `${API}?id=${encodeURIComponent(id)}`);
  if (h.ok) segarkanPustaka(jenis);
  return h;
}
