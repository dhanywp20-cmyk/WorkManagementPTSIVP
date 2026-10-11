'use client';
/**
 * "Objek saya" (pribadi per akun) di Desain 3D: simpan benda terpilih, pasang lagi ke desain, hapus,
 * ekspor ke berkas .json, dan impor berkas dari akun lain. Server: /api/tools-team/objek-saya;
 * aturan & penyaring isi: lib/objek-saya.ts. Beda dengan "Produk saya" (useProdukTim) yang milik tim.
 */
import { useEffect, useRef, useState } from 'react';
import { unduhUrl } from '@/lib/lembar-cetak';
import { bacaBerkasObjekSaya, berkasObjekSaya, type IsiObjekSaya, MAKS_BYTE_MODEL, periksaObjekSaya } from '@/lib/objek-saya';
import { type Benda, bendaBaru, idBaru } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';

const API = '/api/tools-team/objek-saya';

export interface ObjekSayaC {
  id: string; nama: string; ket: string; jenis: Benda['jenis']; atur: Record<string, unknown>;
  adaModel: boolean; ukuranModel: number; updated_at: string;
}
export interface KuotaObjek { objek: number; model: number; maksObjek: number; maksModel: number }

const keBase64 = (buf: ArrayBuffer) => {
  const u8 = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const dariBase64 = (dataUrl: string) => {
  const s = atob(dataUrl.slice(dataUrl.indexOf(',') + 1)); const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8.buffer;
};

export function useObjekSaya(K: KeadaanDesain) {
  const { hanyaLihat, kotakRuang, mesin, modelImpor, setBenda, setKonfirmasi, setPesan, setPilih, sisi, targetRuang } = K;
  const [daftar, setDaftar] = useState<ObjekSayaC[] | null>(null);
  const [kuota, setKuota] = useState<KuotaObjek | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState<string | null>(null);
  /** Isi model (data URL) per id objek - diambil sekali per sesi. */
  const modelCache = useRef(new Map<string, string>());

  const muat = async () => {
    setGalat('');
    try {
      const r = await fetch(API, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setDaftar(j.daftar as ObjekSayaC[]); setKuota(j.kuota as KuotaObjek); } else setGalat(j?.alasan ?? 'Objek saya tidak bisa dimuat.');
    } catch { setGalat('Tidak terhubung ke server.'); }
  };
  useEffect(() => { if (sisi === 'tambah' && !daftar) void muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sisi]);

  /** Model impor di memori -> GLB data URL. */
  const glbDari = (kunci: string): Promise<string | null> => new Promise(ok => {
    const m = mesin.current, src = modelImpor.current.get(kunci);
    if (!m || !src) { ok(null); return; }
    new m.GLTFExporter().parse(src, hasil => ok(hasil instanceof ArrayBuffer ? `data:model/gltf-binary;base64,${keBase64(hasil)}` : null), () => ok(null), { binary: true, maxTextureSize: 1024 });
  });
  const ambilModel = async (id: string): Promise<string | null> => {
    const ada = modelCache.current.get(id); if (ada) return ada;
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}&model=1`, { credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return null;
      modelCache.current.set(id, j.model as string);
      return j.model as string;
    } catch { return null; }
  };
  /** Kirim objek ke server: model satu per permintaan (batas ukuran permintaan Vercel), sisanya sekaligus. */
  const kirim = async (objek: IsiObjekSaya[]): Promise<{ baru: ObjekSayaC[]; galat: string[] }> => {
    const kelompok = [objek.filter(o => !o.model), ...objek.filter(o => o.model).map(o => [o])].filter(k => k.length);
    const baru: ObjekSayaC[] = [], galatnya: string[] = [];
    for (const k of kelompok) {
      try {
        const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objek: k }) });
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) { baru.push(...(j.baru as ObjekSayaC[])); galatnya.push(...((j.ditolak as string[]) ?? [])); } else galatnya.push(j?.alasan ?? 'Gagal menyimpan.');
      } catch { galatnya.push('Tidak terhubung ke server.'); }
    }
    if (baru.length) { setDaftar(d => [...baru, ...(d ?? [])]); void muat(); }
    return { baru, galat: galatnya };
  };

  /** Simpan benda ke Objek saya. Mengembalikan pesan galat atau null. */
  const simpan = async (b: Benda, nama: string, ket: string): Promise<string | null> => {
    const { id: _id, x: _x, z: _z, rot: _r, modelKunci, ...atur } = b;
    void _id; void _x; void _z; void _r;
    let model: string | undefined;
    if (b.jenis === 'model') {
      if (!modelKunci) return 'Berkas model ini tidak ada di memori - impor ulang berkasnya dulu.';
      model = (await glbDari(modelKunci)) ?? undefined;
      if (!model) return 'Model 3D gagal dikemas.';
      if (model.length > MAKS_BYTE_MODEL) return `Model ${(model.length / 1.37 / 1048576).toFixed(1)} MB terlalu besar untuk Objek saya (maks ±1,5 MB) - simpan lewat Simpan .glb.`;
    }
    const c = periksaObjekSaya({ nama, ket, jenis: b.jenis, atur, model });
    if (!c.ok) return c.alasan;
    const h = await kirim([c.data]);
    if (!h.baru.length) return h.galat[0] ?? 'Gagal menyimpan.';
    setPesan(`"${c.data.nama}" tersimpan di Objek saya.`);
    return null;
  };

  /** Pasang objek ke ruang tujuan (model 3D diambil dari server lalu dipasang ke memori). */
  const tambah = async (o: ObjekSayaC) => {
    const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
    const atur = o.atur as Partial<Benda>;
    let modelKunci: string | undefined;
    if (o.jenis === 'model') {
      const m = mesin.current; if (!m) return;
      setSibuk(o.id);
      const url = await ambilModel(o.id);
      const scene = url ? await new Promise<import('three').Group | null>(ok => new m.GLTFLoader().parse(dariBase64(url), '', g => ok(g.scene), () => ok(null))) : null;
      setSibuk(null);
      if (!scene) { setPesan(`Model "${o.nama}" tidak bisa dimuat.`); return; }
      modelKunci = idBaru(); modelImpor.current.set(modelKunci, scene);
    }
    const b0 = bendaBaru(o.jenis, k, { ...atur, ...(modelKunci ? { modelKunci } : {}) });
    const b: Benda = { ...b0, w: atur.w ?? b0.w, h: atur.h ?? b0.h, d: atur.d ?? b0.d, elev: atur.elev ?? b0.elev, nama: atur.nama ?? o.nama };
    setBenda(bs => [...bs, b]); setPilih(b.id);
  };

  const hapus = (o: ObjekSayaC) => setKonfirmasi({
    message: `Hapus "${o.nama}" dari Objek saya?`, danger: true, confirmLabel: 'Hapus',
    description: 'Benda yang sudah dipasang di desain tidak ikut terhapus.',
    onConfirm: async () => {
      setKonfirmasi(null);
      const r = await fetch(`${API}?id=${encodeURIComponent(o.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (!r?.ok || !j?.ok) { setPesan(j?.alasan ?? 'Gagal menghapus.'); return; }
      modelCache.current.delete(o.id);
      setDaftar(d => (d ?? []).filter(x => x.id !== o.id)); void muat();
    },
  });

  /** Ekspor objek terpilih (kosong = semua) ke berkas .json - bisa diimpor akun lain. */
  const ekspor = async (pilihan?: ObjekSayaC[]) => {
    const isi = pilihan?.length ? pilihan : daftar ?? [];
    if (!isi.length) return;
    setSibuk('ekspor');
    const objek: IsiObjekSaya[] = [];
    for (const o of isi) {
      const model = o.adaModel ? await ambilModel(o.id) : null;
      if (o.adaModel && !model) continue;
      objek.push({ nama: o.nama, ket: o.ket, jenis: o.jenis as IsiObjekSaya['jenis'], atur: o.atur, ...(model ? { model } : {}) });
    }
    setSibuk(null);
    const blob = new Blob([JSON.stringify(berkasObjekSaya(objek))], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const tgl = new Date().toISOString().slice(0, 10);
    unduhUrl(url, `objek-saya-${isi.length === 1 ? isi[0].nama.replace(/[^\w-]+/g, '-').slice(0, 40) : tgl}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setPesan(`${objek.length} objek diekspor (${(blob.size / 1024).toFixed(0)} KB).`);
  };

  /** Impor berkas ekspor (dari akun mana pun) ke Objek saya akun ini. */
  const impor = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setPesan('Berkas terlalu besar (maks 12 MB).'); return; }
    let json: unknown;
    try { json = JSON.parse(await file.text()); } catch { setPesan('Berkas tidak bisa dibaca (bukan JSON).'); return; }
    const hasil = bacaBerkasObjekSaya(json);
    if (!hasil.ok) { setPesan(hasil.alasan); return; }
    if (!hasil.objek.length) { setPesan(hasil.ditolak[0] ?? 'Tidak ada objek yang sah di berkas ini.'); return; }
    setSibuk('impor');
    const h = await kirim(hasil.objek);
    setSibuk(null);
    const tolak = [...hasil.ditolak, ...h.galat];
    setPesan(`${h.baru.length} objek diimpor${tolak.length ? ` · ${tolak.length} dilewati: ${tolak[0]}` : ''}.`);
  };

  return { bolehUbah: !hanyaLihat, daftar, ekspor, galat, hapus, impor, kuota, muat, sibuk, simpan, tambah };
}
