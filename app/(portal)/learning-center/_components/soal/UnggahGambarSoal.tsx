'use client';

/**
 * Gambar opsional sebuah soal (lc_questions.gambar_url, migrasi 054) di form tambah & ubah soal.
 * Dikecilkan di peramban dulu (maks 1600 px) supaya ringan dibuka di HP peserta Kuis Live, lalu
 * diunggah lewat /api/admin/kelas-eksternal/unggah (jenis 'soal' - admin / Full Access, sama dengan
 * policy tulis lc_questions).
 */
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

export function UnggahGambarSoal({ url, ubah }: { url: string | null | undefined; ubah: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  const unggah = async (berkas: File | undefined) => {
    if (!berkas) return;
    setSibuk(true); setGalat('');
    let siap = berkas;
    try { const { compressImage } = await import('@/lib/image-compress'); siap = await compressImage(berkas, { maxDim: 1600, quality: 0.82 }); } catch { /* kirim aslinya */ }
    const fd = new FormData();
    fd.append('berkas', siap); fd.append('jenis', 'soal');
    try {
      const r = await fetch('/api/admin/kelas-eksternal/unggah', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setGalat(j.error || 'Unggah gagal.');
      else ubah(j.url as string);
    } catch { setGalat('Unggah gagal - periksa koneksi.'); }
    setSibuk(false);
  };

  return (
    <div>
      <p className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
        Gambar soal
        <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">Optional - foto perangkat, diagram, denah</span>
      </p>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Pilih gambar soal"
        onChange={e => { void unggah(e.target.files?.[0]); e.target.value = ''; }} />
      {url ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Gambar soal" className="h-24 w-auto max-w-[60%] object-contain rounded-lg border border-slate-200 bg-slate-50" />
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => input.current?.click()} disabled={sibuk}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              {sibuk ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}Ganti
            </button>
            <button type="button" onClick={() => ubah('')} disabled={sibuk}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
              <Trash2 size={13} />Hapus
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={sibuk}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60">
          {sibuk ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
          {sibuk ? 'Mengunggah…' : 'Tambah gambar (PNG / JPG / WebP)'}
        </button>
      )}
      {galat && <p className="mt-1.5 text-xs font-semibold text-rose-600">{galat}</p>}
    </div>
  );
}
