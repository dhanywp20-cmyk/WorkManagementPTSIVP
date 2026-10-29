'use client';
/**
 * Berkas yang sedang dibuka: nama (bisa diganti langsung), asalnya, dan status tersimpan. Dulu satu baris sendiri di
 * atas bilah alat; kini bagian kiri bilah atas (BilahAlat) supaya Desain 3D hanya punya satu bilah.
 */
import { Pencil } from 'lucide-react';
import type { AlatDesain } from './alat';

/** Kontrol kanvas (gaya SketchUp) - tooltip tombol bantuan di bilah atas. */
export const BANTUAN_KONTROL = [
  'Klik benda = pilih · Shift / Ctrl + klik = pilih banyak',
  'Seret di ruang kosong = putar kamera',
  'Klik kanan + seret, atau Spasi + seret = geser kanvas',
  'Roda / pinch = zoom ke kursor · klik dua kali = pusatkan',
  'Panah gizmo = geser benda (hijau = naik/turun) · cincin = putar',
  'Ctrl+Z / Ctrl+Y = undo / redo · A = Tambah · M = penggaris · G = snap · L = daftar benda',
].join('\n');

export function IdentitasBerkas({ a }: { a: AlatDesain }) {
  const { adaPerubahan, asal, desainAktif, lihatVersi, namaDesain, setNamaDesain } = a.K;
  //  Status ringkas: ikon / angka versi saja - penjelasan lengkap di tooltip (bukan kalimat di layar).
  const rinci: { isi: string; judul: string; nada: 'ok' | 'info' | 'awas' } = desainAktif
    ? (!desainAktif.bolehUbah
      ? { isi: '👁', judul: 'Desain tim - hanya lihat. Simpan membuat salinan milik Anda.', nada: 'info' }
      : lihatVersi
        ? { isi: `v${lihatVersi.versi}`, judul: `Melihat versi ${lihatVersi.versi} (terbaru v${lihatVersi.terbaru})`, nada: 'info' }
        : { isi: `☁ v${desainAktif.versi}`, judul: `Tersimpan di server, versi ${desainAktif.versi}`, nada: 'ok' })
    : asal.jenis === 'laptop' ? { isi: '💻', judul: `Dibuka dari laptop: ${asal.nama ?? '.glb'}`, nada: 'ok' }
    : asal.jenis === 'lokal' ? { isi: '📱', judul: 'Salinan di perangkat ini, belum tersimpan di server', nada: 'info' }
    : asal.jenis === 'template' ? { isi: /default Admin/.test(asal.nama ?? '') ? '🔒⭐' : '🔒', judul: `Template "${asal.nama}" (terkunci). Simpan membuat file baru milik Anda.`, nada: 'info' }
    : { isi: '●', judul: 'Desain baru, belum disimpan', nada: 'awas' };
  const kelas = { ok: 'bg-emerald-50 text-emerald-800 border-emerald-200', info: 'bg-blue-50 text-blue-800 border-blue-200', awas: 'bg-amber-50 text-amber-600 border-amber-200' }[rinci.nada];
  return (
    <div className="flex items-center gap-1.5 min-w-0" role="group" aria-label="Berkas yang sedang dibuka">
      <label className="relative min-w-[140px] w-[200px] max-w-[260px]" title="Klik untuk mengganti nama desain">
        <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} maxLength={80} placeholder="Nama desain..." aria-label="Nama desain"
          className="w-full h-8 rounded-lg border border-transparent bg-transparent pl-2 pr-7 text-[14px] font-bold text-slate-900 hover:border-slate-200 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-hidden truncate" />
        <Pencil size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden />
      </label>
      <span title={rinci.judul} aria-label={rinci.judul} className={`inline-flex items-center h-6 px-2 rounded-full border text-[11.5px] font-semibold cursor-help ${kelas}`}>{rinci.isi}</span>
      {adaPerubahan && (
        <span title="Ada perubahan belum disimpan" aria-label="Ada perubahan belum disimpan" className="w-2 h-2 rounded-full bg-amber-500 cursor-help" />
      )}
    </div>
  );
}
