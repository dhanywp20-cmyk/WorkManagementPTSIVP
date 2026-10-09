'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Ikon } from '@/components/shared/Ikon';
import { Angka, f, Segmen, Catatan } from '../../bersama/ui';
import { type HasilKontur, type Kontur, konturDariPiksel, type ModeLatar } from '../impor/kontur';

/**
 * "Objek dari gambar": foto / gambar patung, tampak gedung, logo, atau sketsa bidang dari user
 * menjadi objek 3D untuk mapping - siluet diekstrusi setebal yang diisi (volume) atau panel tipis.
 * Latar dibuang otomatis (PNG transparan / warna latar dari tepi gambar), garis tepinya terlihat
 * di pratinjau sebelum objek dibuat.
 */

export interface HasilObjekGambar {
  nama: string; kontur: Kontur;
  /** Foto yang sudah dipotong ke kotak batas objek (maks 1280 px) - jadi tekstur permukaan depan. */ foto: HTMLCanvasElement | null;
  w: number; h: number; d: number;
}

/** Sisi terpanjang gambar yang dianalisis (piksel): cukup halus, tetap cepat di HP. */
const SISI_ANALISIS = 320;
const SISI_FOTO = 1280;
const PRATINJAU = { w: 520, h: 300 };

type Bentuk = 'volume' | 'panel';

export function ModalObjekGambar({ buka, onTutup, onJadi }: {
  buka: boolean; onTutup: () => void; onJadi: (h: HasilObjekGambar) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const [gambar, setGambar] = useState<{ img: HTMLImageElement; nama: string } | null>(null);
  const [galat, setGalat] = useState('');
  const [latar, setLatar] = useState<ModeLatar>('otomatis');
  const [toleransi, setToleransi] = useState(22);
  const [lubangLatar, setLubangLatar] = useState(false);
  const [bentuk, setBentuk] = useState<Bentuk>('volume');
  const [tebalCm, setTebalCm] = useState(30);
  const [tinggi, setTinggi] = useState(2);
  const [foto, setFoto] = useState(true);

  //  Tutup = mulai bersih lagi berikutnya (gambar besar tidak tertahan di memori).
  useEffect(() => { if (!buka) { setGambar(null); setGalat(''); } }, [buka]);

  const pilihBerkas = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setGalat('Pilih berkas gambar (JPG, PNG, WebP).'); return; }
    if (file.size > 25 * 1024 * 1024) { setGalat('Gambar maksimal 25 MB.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setGambar({ img, nama: file.name.replace(/\.[^.]+$/, '') }); setGalat(''); URL.revokeObjectURL(url); };
    img.onerror = () => { setGalat('Gambar tidak bisa dibaca.'); URL.revokeObjectURL(url); };
    img.src = url;
  };

  /** Piksel gambar yang dianalisis (diperkecil) - dihitung sekali per gambar. */
  const analisis = useMemo(() => {
    if (!gambar) return null;
    const { img } = gambar, k = Math.min(1, SISI_ANALISIS / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(4, Math.round(img.naturalWidth * k)), h = Math.max(4, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); if (!g) return null;
    g.drawImage(img, 0, 0, w, h);
    return { w, h, data: g.getImageData(0, 0, w, h).data };
  }, [gambar]);

  const hasil: HasilKontur | null = useMemo(
    () => (analisis ? konturDariPiksel(analisis.data, analisis.w, analisis.h, { latar, toleransi, lubangLatar }) : null),
    [analisis, latar, toleransi, lubangLatar],
  );
  const rasio = hasil ? (hasil.kotak.x1 - hasil.kotak.x0) / Math.max(1, hasil.kotak.y1 - hasil.kotak.y0) : 1;
  const lebar = tinggi * rasio;

  //  Pratinjau: gambar + latar yang dibuang diredupkan + garis tepi siluet.
  useEffect(() => {
    const c = kanvas.current; if (!c || !gambar || !analisis) return;
    const k = Math.min(PRATINJAU.w / analisis.w, PRATINJAU.h / analisis.h);
    const w = Math.round(analisis.w * k), h = Math.round(analisis.h * k), dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`;
    const g = c.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    //  Papan catur = area transparan.
    for (let y = 0; y < h; y += 10) for (let x = 0; x < w; x += 10) { g.fillStyle = (x + y) % 20 ? '#e2e8f0' : '#f8fafc'; g.fillRect(x, y, 10, 10); }
    g.drawImage(gambar.img, 0, 0, w, h);
    if (!hasil) return;
    const { x0, y0, x1, y1 } = hasil.kotak;
    const px = (u: number) => (x0 + u * (x1 - x0)) * k, py = (v: number) => (y0 + (1 - v) * (y1 - y0)) * k;
    const jalur = new Path2D();
    const tambah = (p: number[]) => { jalur.moveTo(px(p[0]), py(p[1])); for (let i = 2; i < p.length; i += 2) jalur.lineTo(px(p[i]), py(p[i + 1])); jalur.closePath(); };
    for (const b of hasil.kontur) { tambah(b.l); for (const hl of b.h ?? []) tambah(hl); }
    //  Latar diredupkan: seluruh kanvas dikurangi siluet (aturan genap-ganjil).
    const luar = new Path2D(); luar.rect(0, 0, w, h); luar.addPath(jalur);
    g.fillStyle = 'rgba(15,23,42,0.55)'; g.fill(luar, 'evenodd');
    g.lineWidth = 2; g.strokeStyle = '#f43f5e'; g.stroke(jalur);
  }, [gambar, analisis, hasil]);

  const buat = () => {
    if (!gambar || !analisis || !hasil) return;
    const { img } = gambar, s = img.naturalWidth / analisis.w;
    const { x0, y0, x1, y1 } = hasil.kotak;
    let fotoKanvas: HTMLCanvasElement | null = null;
    if (foto) {
      const sw = (x1 - x0) * s, sh = (y1 - y0) * s, k = Math.min(1, SISI_FOTO / Math.max(sw, sh));
      fotoKanvas = document.createElement('canvas');
      fotoKanvas.width = Math.max(1, Math.round(sw * k)); fotoKanvas.height = Math.max(1, Math.round(sh * k));
      fotoKanvas.getContext('2d')?.drawImage(img, x0 * s, y0 * s, sw, sh, 0, 0, fotoKanvas.width, fotoKanvas.height);
    }
    const r = (v: number) => Math.round(v * 1000) / 1000;
    onJadi({ nama: gambar.nama || 'Objek dari gambar', kontur: hasil.kontur, foto: fotoKanvas, w: r(lebar), h: r(tinggi), d: bentuk === 'panel' ? 0.02 : r(tebalCm / 100) });
  };

  return (
    <Modal buka={buka} onTutup={onTutup} judul="Objek dari gambar" ukuran="lg" ikon={<Ikon nama="🖼️" ukuran={18} />}
      keterangan="Foto / gambar patung, tampak gedung, logo atau sketsa bidang menjadi objek 3D untuk dicek sinar proyektornya. Latar dibuang otomatis.">
      <div className="space-y-3">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={e => { pilihBerkas(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        <button type="button" onClick={() => input.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/60 px-3 py-3 text-[13px] font-bold text-violet-900 hover:bg-violet-100">
          {gambar ? `Ganti gambar (${gambar.nama})` : 'Pilih gambar - JPG / PNG / WebP'}
        </button>
        {galat && <p className="text-[12.5px] font-semibold text-rose-700">{galat}</p>}

        {gambar && (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 grid place-items-center overflow-hidden">
              <canvas ref={kanvas} className="max-w-full h-auto" />
            </div>
            <p className="text-[11.5px] text-slate-600">
              {hasil
                ? <>Garis merah = tepi objek ({hasil.kontur.length} bagian, {hasil.titik} titik{hasil.mode === 'transparan' ? ', latar transparan' : hasil.mode === 'warna' ? ', latar dari warna tepi' : ''}). Area gelap dibuang.</>
                : <span className="font-semibold text-rose-700">Objek tidak terdeteksi - turunkan toleransi atau pilih &quot;Seluruh gambar&quot;.</span>}
            </p>

            <Segmen label="Latar gambar" nilai={latar} onUbah={setLatar}
              opsi={[{ v: 'otomatis', l: 'Otomatis' }, { v: 'warna', l: 'Warna tepi' }, { v: 'transparan', l: 'PNG transparan' }, { v: 'utuh', l: 'Seluruh gambar' }]} />
            {(latar === 'warna' || (latar === 'otomatis' && hasil?.mode === 'warna')) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                <label className="block">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Toleransi warna latar · {toleransi}</span>
                  <input type="range" min={3} max={70} value={toleransi} onChange={e => setToleransi(Number(e.target.value))} className="w-full" />
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-slate-700 pb-1">
                  <input type="checkbox" className="w-4 h-4" checked={lubangLatar} onChange={e => setLubangLatar(e.target.checked)} />
                  Warna latar di dalam objek jadi lubang
                </label>
              </div>
            )}

            <Segmen label="Bentuk objek" nilai={bentuk} onUbah={setBentuk}
              opsi={[{ v: 'volume', l: 'Siluet 3D (bertebal)' }, { v: 'panel', l: 'Panel tipis (2 cm)' }]} />
            <div className="grid grid-cols-3 gap-2">
              <Angka label="Tinggi nyata" nilai={tinggi} satuan="m" step={0.1} onUbah={v => v >= 0.05 && v <= 100 && setTinggi(v)} />
              <Angka label="Lebar (otomatis)" nilai={Math.round(lebar * 100) / 100} satuan="m" step={0.1}
                onUbah={v => v >= 0.05 && v <= 200 && rasio > 0 && setTinggi(Math.round((v / rasio) * 1000) / 1000)} />
              {bentuk === 'volume'
                ? <Angka label="Tebal" nilai={tebalCm} satuan="cm" step={5} onUbah={v => v >= 1 && v <= 5000 && setTebalCm(v)} />
                : <div />}
            </div>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
              <input type="checkbox" className="w-4 h-4" checked={foto} onChange={e => setFoto(e.target.checked)} />
              Tampilkan foto di permukaan depan (matikan untuk objek putih polos seperti saat dimapping)
            </label>
            <Catatan>
              Ukuran jadi {f(lebar)} × {f(tinggi)} × {bentuk === 'panel' ? '0,02' : f(tebalCm / 100)} m. Siluet & foto ikut tersimpan
              (server & laptop). Untuk bentuk yang lebih rumit (patung utuh), impor model 3D dari SketchUp / Blender.
            </Catatan>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onTutup} className="px-3 py-2 rounded-lg text-[12.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="button" disabled={!hasil} onClick={buat}
                className="px-4 py-2 rounded-lg text-[12.5px] font-bold text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-50">Tambahkan ke ruang</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
