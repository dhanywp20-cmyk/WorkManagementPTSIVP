import type { RefObject } from 'react';
import type { RingkasanLED } from '@/lib/tools-team';
import { f } from '../bersama/ui';
import { type AdapterBerkas, mintaJson } from '../bersama/berkas/tipe';

const API = '/api/tools-team/led';

export interface EkstraLED { ringkasan: RingkasanLED; svg: () => string }
interface BarisLED { id: string; nama: string; ringkasan?: Partial<RingkasanLED>; dibuat_oleh_nama?: string; diubah_oleh_nama?: string; updated_at: string; bolehUbah?: boolean }

const ket = (r: Partial<RingkasanLED>) => [
  [r.project, r.customer].filter(Boolean).join(' · ') || '',
  r.kode ? `${r.kode} ${f(r.lebarM ?? 0)} × ${f(r.tinggiM ?? 0)} m` : '',
  r.resX ? `${r.resX}×${r.resY} px` : '',
  (r.screen ?? 1) > 1 ? `${r.screen} screen` : '',
].filter(Boolean).join(' · ');

export function adapterLED(ekstra: RefObject<() => EkstraLED>): AdapterBerkas {
  return {
    jenis: 'hitungan LED',
    daftar: async q => {
      const j = await mintaJson<{ daftar: BarisLED[] }>(`${API}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      return j.daftar.map(d => ({ id: d.id, nama: d.nama, ket: ket(d.ringkasan ?? {}), oleh: d.diubah_oleh_nama || d.dibuat_oleh_nama || '', pada: d.updated_at, bolehUbah: !!d.bolehUbah }));
    },
    ambil: async id => {
      const j = await mintaJson<{ file: BarisLED & { data: unknown } }>(`${API}?id=${encodeURIComponent(id)}`);
      return { data: j.file.data, file: { id: j.file.id, nama: j.file.nama, bolehUbah: !!j.file.bolehUbah } };
    },
    kirim: async ({ id, nama, data }) => {
      const e = ekstra.current();
      let svg: string | null = null;
      try { svg = e.svg(); } catch { svg = null; }
      const j = await mintaJson<{ file: BarisLED }>(API, { method: 'POST', body: JSON.stringify({ id, nama, data, ringkasan: e.ringkasan, svg_koneksi: svg }) });
      return { id: j.file.id, nama: j.file.nama, bolehUbah: true };
    },
    hapus: async id => { await mintaJson(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  };
}
