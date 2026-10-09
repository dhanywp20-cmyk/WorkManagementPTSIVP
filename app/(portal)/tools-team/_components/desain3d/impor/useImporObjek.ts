'use client';
import { type MutableRefObject, useState } from 'react';
import type * as T from 'three';
import { type Benda, bendaBaru, idBaru, type Kotak } from '../inti';
import { bacaBerkas3D, GalatImpor, ukuranModel } from './berkas3d';
import type { HasilObjekGambar } from '../panel/ModalObjekGambar';

/** Ukuran wajar objek di ruang (m) - di luar ini satuan berkas hampir pasti salah tebak. */
const UKURAN_WAJAR = { min: 0.03, maks: 150 };

/**
 * Menambah objek dari luar ke kanvas Desain 3D:
 *   - imporBerkas : model 3D (glTF/OBJ/FBX/DAE/KMZ/STL/3DS/PLY/ZIP) -> benda 'model'
 *   - dariGambar  : hasil ModalObjekGambar (siluet + foto) -> benda 'objek' bentuk 'gambar'
 * Geometri model & foto disimpan di peta memori milik Desain3D (modelImpor, gambarLayar) - sama
 * seperti gambar layar unggahan - jadi ikut tersimpan ke laptop (.glb) & server (foto).
 */
export function useImporObjek(p: {
  THREE: () => typeof T | null;
  modelImpor: MutableRefObject<Map<string, T.Object3D>>;
  gambarLayar: MutableRefObject<Map<string, T.Texture>>;
  kotak: () => Kotak;
  tambahBenda: (b: Benda) => void;
  gambarBerubah: () => void;
  setPesan: (s: string) => void; setGalat: (s: string) => void;
}) {
  const [sibuk, setSibuk] = useState(false);

  const imporBerkas = async (berkas: File[]) => {
    const THREE = p.THREE(); if (!THREE || !berkas.length) return;
    setSibuk(true); p.setGalat('');
    try {
      const h = await bacaBerkas3D(THREE, berkas);
      const kunci = idBaru();
      p.modelImpor.current.set(kunci, h.obj);
      let u = ukuranModel(h.ukuranFile, h.satuan, h.putar);
      const catatan = [...h.catatan];
      const maks = Math.max(u.w, u.h, u.d);
      if (maks > UKURAN_WAJAR.maks || maks < UKURAN_WAJAR.min) {
        //  Satuan tidak masuk akal -> tinggi 2 m sebagai titik awal, ukuran nyata diisi di panel.
        const k = 2 / Math.max(1e-6, u.h || maks);
        u = { w: u.w * k, h: u.h * k, d: u.d * k };
        catatan.push('Ukuran berkas tidak wajar - objek diatur setinggi 2 m. Isi tinggi sebenarnya / satuan di panel.');
      }
      const b: Benda = {
        ...bendaBaru('model', p.kotak()), nama: h.nama, ...u, modelKunci: kunci,
        ukuranFile: h.ukuranFile, satuanModel: h.satuan, putarModel: h.putar || undefined,
      };
      p.tambahBenda(b);
      p.setPesan(`${h.nama} (${h.format.toUpperCase()}, ${h.segitiga.toLocaleString('id-ID')} segitiga) ditambahkan.${catatan.length ? ' ' + catatan.join(' ') : ''}`);
      return true;
    } catch (e) {
      p.setGalat(e instanceof GalatImpor ? e.message : 'Gagal membaca berkas model.');
      return false;
    } finally { setSibuk(false); }
  };

  const dariGambar = (h: HasilObjekGambar, ganti?: Benda) => {
    const THREE = p.THREE(); if (!THREE) return;
    const dasar = ganti ?? bendaBaru('objek', p.kotak(), { bentukObjek: 'gambar' });
    const b: Benda = { ...dasar, nama: ganti ? dasar.nama : h.nama, bentukObjek: 'gambar', kontur: h.kontur, w: h.w, h: h.h, d: h.d, konten: h.foto ? 'gambar' : undefined };
    if (h.foto) {
      const tex = new THREE.CanvasTexture(h.foto);
      tex.colorSpace = THREE.SRGBColorSpace;
      p.gambarLayar.current.set(b.id, tex);
      p.gambarBerubah();
    }
    p.tambahBenda(b);
    p.setPesan(`Objek "${b.nama}" dibuat dari gambar (${h.w} × ${h.h} × ${h.d} m). Arahkan proyektor ke permukaannya.`);
  };

  return { imporBerkas, dariGambar, sibuk };
}
