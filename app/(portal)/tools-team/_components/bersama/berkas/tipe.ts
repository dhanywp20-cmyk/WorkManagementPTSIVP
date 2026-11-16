import type { AlatFile } from '@/lib/tools-file';

export interface FileAktif { id: string; nama: string; bolehUbah: boolean }
export interface BarisFile { id: string; nama: string; ket: string; oleh: string; pada: string; bolehUbah: boolean }

export interface AdapterBerkas {
  jenis: string;
  daftar: (q: string) => Promise<BarisFile[]>;
  ambil: (id: string) => Promise<{ data: unknown; file: FileAktif }>;
  kirim: (b: { id?: string; nama: string; data: unknown }) => Promise<FileAktif>;
  hapus: (id: string) => Promise<void>;
}

type Jawaban = Record<string, unknown> & { ok?: boolean; alasan?: string };

export async function mintaJson<T = Jawaban>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    credentials: 'include', cache: 'no-store', ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  }).catch(() => null);
  if (!r) throw new Error('Tidak terhubung ke server.');
  const j = (await r.json().catch(() => null)) as Jawaban | null;
  if (!r.ok || !j?.ok) throw new Error(j?.alasan ?? 'Permintaan gagal.');
  return j as T;
}

interface BarisServer { id: string; nama: string; alat?: string; ringkasan?: string; dibuat_oleh_nama?: string; diubah_oleh_nama?: string; updated_at: string; bolehUbah?: boolean }

const API_FILE = '/api/tools-team/file';

export function adapterTim(alat: AlatFile, jenis: string, ringkasan?: (data: unknown) => string): AdapterBerkas {
  return {
    jenis,
    daftar: async q => {
      const j = await mintaJson<{ daftar: BarisServer[] }>(`${API_FILE}?alat=${alat}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
      return j.daftar.map(d => ({ id: d.id, nama: d.nama, ket: d.ringkasan ?? '', oleh: d.diubah_oleh_nama || d.dibuat_oleh_nama || '', pada: d.updated_at, bolehUbah: !!d.bolehUbah }));
    },
    ambil: async id => {
      const j = await mintaJson<{ file: BarisServer & { data: unknown } }>(`${API_FILE}?id=${encodeURIComponent(id)}`);
      if (j.file.alat !== alat) throw new Error('Berkas ini milik alat lain.');
      return { data: j.file.data, file: { id: j.file.id, nama: j.file.nama, bolehUbah: !!j.file.bolehUbah } };
    },
    kirim: async ({ id, nama, data }) => {
      const j = await mintaJson<{ file: BarisServer }>(API_FILE, { method: 'POST', body: JSON.stringify({ id, alat, nama, data, ringkasan: ringkasan?.(data) ?? '' }) });
      return { id: j.file.id, nama: j.file.nama, bolehUbah: true };
    },
    hapus: async id => { await mintaJson(`${API_FILE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  };
}
