'use client';
import { useEffect, useRef, useState } from 'react';
import { BookImage, Crop } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { pdfjs } from '../perbandingan/bacaPdf';
import { kompresGambar } from './gambar';
import { Centang, kelasTombol } from './isian';

type Dok = Awaited<ReturnType<Awaited<ReturnType<typeof pdfjs>>['getDocument']>['promise']>;
interface Kotak { x: number; y: number; w: number; h: number }

const MAKS_HALAMAN = 40;

async function gambarHalaman(dok: Dok, no: number, lebar: number): Promise<HTMLCanvasElement> {
  const hal = await dok.getPage(no);
  const v0 = hal.getViewport({ scale: 1 });
  const v = hal.getViewport({ scale: lebar / v0.width });
  const c = document.createElement('canvas');
  c.width = Math.round(v.width); c.height = Math.round(v.height);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await hal.render({ canvasContext: g, viewport: v, canvas: c } as Parameters<typeof hal.render>[0]).promise;
  hal.cleanup();
  return c;
}

function hapusLatarPutih(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!;
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const m = Math.min(d.data[i], d.data[i + 1], d.data[i + 2]);
    if (m > 244) d.data[i + 3] = 0;
    else if (m > 228) d.data[i + 3] = Math.round(((244 - m) / 16) * 255);
  }
  g.putImageData(d, 0, 0);
}

export function AmbilBrosur({ onPakai }: { onPakai: (f: { dataUrl: string; rasio: number }, nama: string) => void }) {
  const [buka, setBuka] = useState(false);
  const [dok, setDok] = useState<Dok | null>(null);
  const [nama, setNama] = useState('');
  const [mini, setMini] = useState<string[]>([]);
  const [hal, setHal] = useState(0);
  const [besar, setBesar] = useState<string>('');
  const [pilih, setPilih] = useState<Kotak | null>(null);
  const [tanpaLatar, setTanpaLatar] = useState(true);
  const [sibuk, setSibuk] = useState('');
  const [galat, setGalat] = useState('');
  const berkas = useRef<HTMLInputElement>(null);
  const wadah = useRef<HTMLDivElement>(null);
  const tarik = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => { void dok?.cleanup(); }, [dok]);

  const tutup = () => { setBuka(false); setPilih(null); };
  const bacaPdf = async (f?: File | null) => {
    if (!f) return;
    setSibuk('Membuka PDF...'); setGalat(''); setMini([]); setBesar(''); setPilih(null);
    try {
      if (f.size > 60_000_000) throw new Error('PDF terlalu besar (maks 60 MB).');
      const lib = await pdfjs();
      const d = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      setDok(d); setNama(f.name.replace(/\.pdf$/i, ''));
      const daftar: string[] = [];
      for (let i = 1; i <= Math.min(d.numPages, MAKS_HALAMAN); i++) daftar.push((await gambarHalaman(d, i, 180)).toDataURL('image/jpeg', 0.7));
      setMini(daftar);
      await bukaHalaman(d, 1);
    } catch (e) { setGalat(e instanceof Error ? e.message : 'PDF gagal dibuka.'); } finally {
      setSibuk('');
      if (berkas.current) berkas.current.value = '';
    }
  };
  const bukaHalaman = async (d: Dok, no: number) => {
    setSibuk('Menyiapkan halaman...'); setPilih(null); setHal(no);
    try { setBesar((await gambarHalaman(d, no, 1100)).toDataURL('image/jpeg', 0.85)); } finally { setSibuk(''); }
  };

  const titik = (e: React.PointerEvent) => {
    const r = wadah.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const mulai = (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); tarik.current = titik(e); setPilih(null); };
  const gerak = (e: React.PointerEvent) => {
    if (!tarik.current) return;
    const a = tarik.current, b = titik(e);
    setPilih({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
  };

  const pakai = async () => {
    if (!dok || !pilih || pilih.w < 0.02 || pilih.h < 0.02) return;
    setSibuk('Memotong gambar...'); setGalat('');
    try {
      const penuh = await gambarHalaman(dok, hal, 2400);
      const c = document.createElement('canvas');
      c.width = Math.round(pilih.w * penuh.width); c.height = Math.round(pilih.h * penuh.height);
      c.getContext('2d')!.drawImage(penuh, pilih.x * penuh.width, pilih.y * penuh.height, c.width, c.height, 0, 0, c.width, c.height);
      if (tanpaLatar) hapusLatarPutih(c);
      const blob = await new Promise<Blob>((ok, gagal) => c.toBlob(b => (b ? ok(b) : gagal(new Error('Potongan gagal dibuat.'))), 'image/png'));
      onPakai(await kompresGambar(blob), `${nama} hal. ${hal}`);
      tutup();
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Potongan gagal dipakai.'); } finally { setSibuk(''); }
  };

  return (
    <>
      <button type="button" className={kelasTombol} onClick={() => setBuka(true)}><BookImage size={15} /> Dari brosur PDF</button>
      <Modal buka={buka} onTutup={tutup} judul="Ambil gambar dari brosur PDF" ukuran="penuh" ikon={<BookImage size={18} />}
        keterangan="PDF dibuka di browser ini saja - tidak diunggah ke server. Tarik kotak di sekitar foto produk, lalu Pakai."
        footer={(
          <div className="flex flex-wrap items-center gap-2 w-full">
            <Centang label="Hapus latar putih" nilai={tanpaLatar} onUbah={setTanpaLatar} />
            {sibuk && <span className="text-[12.5px] text-slate-500">{sibuk}</span>}
            {galat && <span role="alert" className="text-[12.5px] text-rose-700">{galat}</span>}
            <button type="button" className={`${kelasTombol} ml-auto !bg-blue-700 !text-white !border-blue-700`} disabled={!pilih || !!sibuk} onClick={() => void pakai()}>
              <Crop size={15} /> Pakai potongan
            </button>
          </div>
        )}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={kelasTombol} onClick={() => berkas.current?.click()} disabled={!!sibuk}>Pilih PDF brosur...</button>
            {nama && <span className="text-[13px] text-slate-600 truncate max-w-[60%]">{nama} · halaman {hal}</span>}
            <input ref={berkas} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => void bacaPdf(e.target.files?.[0])} />
          </div>
          {mini.length > 0 && (
            <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
              <div className="flex md:flex-col gap-2 overflow-auto max-h-[62vh] pb-1">
                {mini.map((src, i) => (
                  <button key={i} type="button" onClick={() => dok && void bukaHalaman(dok, i + 1)} aria-label={`Halaman ${i + 1}`}
                    className={`shrink-0 rounded-lg border-2 overflow-hidden ${hal === i + 1 ? 'border-blue-600' : 'border-transparent hover:border-slate-300'}`}>
                    <img src={src} alt="" className="w-[120px] md:w-full block" />
                  </button>
                ))}
              </div>
              <div className="overflow-auto max-h-[62vh] rounded-xl border border-slate-200 bg-slate-100 p-2">
                {besar && (
                  <div ref={wadah} className="relative w-full select-none touch-none cursor-crosshair" onPointerDown={mulai} onPointerMove={gerak} onPointerUp={() => { tarik.current = null; }}>
                    <img src={besar} alt={`Halaman ${hal}`} className="w-full block pointer-events-none" draggable={false} />
                    {pilih && (
                      <div className="absolute border-2 border-blue-600 bg-blue-500/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
                        style={{ left: `${pilih.x * 100}%`, top: `${pilih.y * 100}%`, width: `${pilih.w * 100}%`, height: `${pilih.h * 100}%` }} />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
