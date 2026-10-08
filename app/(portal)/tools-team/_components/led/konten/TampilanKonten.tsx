'use client';
/**
 * Sub menu Konten & Pola Uji: spesifikasi konten untuk tim kreatif (resolusi PERSIS layar, rasio,
 * frame rate, bagaimana materi 1080p/4K akan tampil) + unduh PNG pola uji pada resolusi asli.
 */
import { useEffect, useRef, useState } from 'react';
import { Catatan, f, Kartu, Nilai, Pilih, Segmen, TombolSalin } from '../../bersama/ui';
import { namaBerkas, unduhKanvasPNG } from '../../bersama/cetak';
import { polaUjiBisa } from '@/lib/led-banding';
import { BarSub } from '../panel/BarSub';
import { KartuLayar } from '../panel/KartuLayar';
import { ModalBersama } from '../panel/ModalBersama';
import type { AlatLED } from '../panel/alat';
import { type JenisPola, kanvasPola, type PolaUji, WARNA_POLOS } from './polaUji';

const SUMBER = [{ l: 'Full HD 1920 × 1080', x: 1920, y: 1080 }, { l: '4K UHD 3840 × 2160', x: 3840, y: 2160 }];
const JENIS: { v: JenisPola; l: string }[] = [{ v: 'grid', l: 'Grid cabinet' }, { v: 'warna', l: 'Bar warna' }, { v: 'polos', l: 'Warna polos' }];
const KET_JENIS: Record<JenisPola, string> = {
  grid: 'Tiap kotak = 1 cabinet/modul berlabel K(kolom)B(baris) - cek urutan mapping di software controller & cabinet tertukar. Diagonal harus lurus, lingkaran bulat, garis ungu 1 px terlihat di keempat tepi.',
  warna: 'Bar warna & gradasi abu/RGB - cek kalibrasi warna antar cabinet dan gradasi bertangga (banding) karena kedalaman bit.',
  polos: 'Satu warna penuh - cek piksel mati, modul belang/berbeda kecerahan. Ulangi untuk merah, hijau, biru, putih & hitam.',
};

/** Materi sumber dipasang "fit" ke layar: ukuran tampil & sisa bar hitam. */
function pasMateri(sx: number, sy: number, rx: number, ry: number) {
  const s = Math.min(rx / sx, ry / sy);
  const w = Math.round(sx * s), h = Math.round(sy * s);
  return { s, w, h, barX: rx - w, barY: ry - h };
}

export function TampilanKonten({ a }: { a: AlatLED }) {
  const { h, kolom, baris, refresh, bit, labelLED, project } = a.K;
  const [jenis, setJenis] = useState<JenisPola>('grid');
  const [warna, setWarna] = useState(WARNA_POLOS[0].v);
  const [status, setStatus] = useState<'siap' | 'proses' | 'gagal'>('siap');
  const pratinjau = useRef<HTMLCanvasElement>(null);
  const bisa = polaUjiBisa(h.resX, h.resY);
  const pola: PolaUji = { resX: h.resX, resY: h.resY, kolom, baris, pxCabX: h.pxCabX, pxCabY: h.pxCabY, jenis, warna, judul: labelLED };

  //  Pratinjau ± 720 px lebar, digambar ulang saat layar / jenis pola berubah.
  useEffect(() => {
    if (!pratinjau.current || !bisa) return;
    kanvasPola(pola, Math.min(1, 720 / Math.max(1, h.resX)), pratinjau.current);
  });

  const unduh = async () => {
    setStatus('proses');
    try {
      //  Beri kesempatan tombol menampilkan "..." sebelum kanvas besar digambar.
      await new Promise(r => setTimeout(r, 30));
      await unduhKanvasPNG(kanvasPola(pola), namaBerkas('Pola uji', jenis, `${h.resX}x${h.resY}`, project));
      setStatus('siap');
    } catch { setStatus('gagal'); setTimeout(() => setStatus('siap'), 2500); }
  };

  const lewat4K = h.resX > 3840 || h.resY > 2160;
  const fps = refresh >= 120 ? 60 : refresh;
  const teks = () => [
    `*Spesifikasi konten LED* ${labelLED}${project ? ` - ${project}` : ''}`,
    `- Resolusi kanvas: ${h.resX} × ${h.resY} px (persis, jangan diskalakan) · rasio ${h.rasioTerdekat}`,
    `- Ukuran fisik: ${f(h.lebarM)} × ${f(h.tinggiM)} m · ${kolom} × ${baris} unit @ ${h.pxCabX} × ${h.pxCabY} px`,
    `- Frame rate: ${fps} fps · warna ${bit}-bit · format MP4 H.264${lewat4K ? '/H.265 atau dibagi per output controller' : ''}, PNG/JPG untuk gambar diam`,
    ...SUMBER.map(m => { const p = pasMateri(m.x, m.y, h.resX, h.resY); return `- Materi ${m.l}: tampil ${p.w} × ${p.h} px (skala ${f(p.s * 100, 0)}%), sisa ${p.barX ? `${p.barX} px kiri-kanan` : `${p.barY} px atas-bawah`}`; }),
    '- Teks penting jauhi 1 cabinet dari tepi; minimal tinggi huruf ±1/20 tinggi layar untuk penonton jauh.',
  ].join('\n');

  return (
    <div className="space-y-4">
      <BarSub a={a} />
      <KartuLayar a={a} judul="Konten & Pola Uji"><TombolSalin key="salin" teks={teks} /></KartuLayar>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
        <Kartu judul="Spesifikasi konten">
          <div className="grid grid-cols-2 gap-2.5">
            <Nilai label="Resolusi kanvas" nilai={`${h.resX} × ${h.resY}`} satuan="px" ket="buat materi persis ukuran ini" />
            <Nilai label="Rasio" nilai={h.rasioTerdekat} ket={h.rasio} />
            <Nilai label="Per unit" nilai={`${h.pxCabX} × ${h.pxCabY}`} satuan="px" ket={`${kolom} × ${baris} unit`} />
            <Nilai label="Frame rate" nilai={fps} satuan="fps" ket={`refresh ${refresh} Hz · ${bit}-bit`} />
          </div>
          <div className="mt-3 space-y-1.5">
            {SUMBER.map(m => {
              const p = pasMateri(m.x, m.y, h.resX, h.resY);
              const pas = p.barX === 0 && p.barY === 0;
              return (
                <p key={m.l} className={`text-[12.5px] rounded-lg px-2.5 py-1.5 border ${pas ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  Materi <b>{m.l}</b> tampil {p.w} × {p.h} px (skala {f(p.s * 100, 0)}%){pas ? ' - pas penuh.' : `, sisa hitam ${p.barX ? `${p.barX} px kiri-kanan` : `${p.barY} px atas-bawah`}.`}
                </p>
              );
            })}
          </div>
          {lewat4K && <p className="mt-2 text-[12.5px] rounded-lg px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-900">Melebihi 4K: materi perlu dibagi per output media server/controller, atau dibuat 4K lalu dipetakan.</p>}
          <Catatan>Konten dengan resolusi persis layar tampil tajam tanpa skala. Hindari garis/teks 1 px yang bergerak lambat (berkedip di LED), dan latar putih penuh yang lama (boros daya & panas).</Catatan>
        </Kartu>
        <Kartu judul="Pola uji (PNG resolusi asli)" aksi={
          <button type="button" onClick={unduh} disabled={!bisa || status === 'proses'}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-60 ${status === 'gagal' ? 'border-rose-200 text-rose-700 bg-rose-50' : 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'}`}>
            {status === 'proses' ? 'Membuat...' : status === 'gagal' ? 'Gagal' : `Unduh PNG ${h.resX} × ${h.resY}`}
          </button>}>
          <div className="flex flex-wrap items-end gap-3">
            <Segmen label="Jenis pola" nilai={jenis} onUbah={setJenis} opsi={JENIS} />
            {jenis === 'polos' && <div className="w-40"><Pilih label="Warna" nilai={warna} onUbah={setWarna} opsi={WARNA_POLOS} /></div>}
          </div>
          {bisa
            ? <canvas ref={pratinjau} className="mt-3 w-full h-auto rounded-lg border border-slate-200 bg-black" style={{ imageRendering: 'pixelated' }} aria-label="Pratinjau pola uji" />
            : <p className="mt-3 text-[12.5px] rounded-lg px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-900">Resolusi {h.resX} × {h.resY} px melebihi batas kanvas peramban (16384 px per sisi) - buat pola per bagian layar di software controller.</p>}
          <Catatan>{KET_JENIS[jenis]}</Catatan>
        </Kartu>
      </div>
      <ModalBersama a={a} />
    </div>
  );
}
