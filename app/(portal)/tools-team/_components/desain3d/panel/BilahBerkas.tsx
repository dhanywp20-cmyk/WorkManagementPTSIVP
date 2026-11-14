'use client';
import type { AlatDesain } from './alat';

export const BANTUAN_KONTROL = [
  'Klik benda = pilih · Shift / Ctrl + klik = pilih banyak',
  'Seret di ruang kosong = putar kamera',
  'Klik kanan + seret, atau Spasi + seret = geser kanvas',
  'Roda / pinch = zoom ke kursor · klik dua kali = pusatkan',
  'Panah gizmo = geser benda (hijau = naik/turun) · cincin = putar',
  'Ctrl+Z / Ctrl+Y = undo / redo · A = Tambah · M = penggaris · G = snap · L = daftar benda',
].join('\n');

export function IdentitasBerkas({ a }: { a: AlatDesain }) {
  const { asal, desainAktif, lihatVersi, namaDesain, setNamaDesain } = a.K;
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
  const kelas = { ok: 'bg-emerald-50 text-emerald-800 border-emerald-200', info: 'bg-blue-50 text-blue-800 border-blue-200', awas: 'bg-amber-50 text-amber-800 border-amber-200' }[rinci.nada];
  return (
    <div className="flex items-center gap-1 min-w-0 ml-0.5" role="group" aria-label="Berkas yang sedang dibuka">
      <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} maxLength={80} placeholder="Nama desain" aria-label="Nama desain" title="Nama desain - klik untuk mengganti"
        className="h-8 w-28 sm:w-44 xl:w-52 rounded-lg border border-transparent bg-slate-50 px-2.5 text-[13px] font-semibold text-slate-800 placeholder:font-normal hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-hidden truncate" />
      <span title={rinci.judul} aria-label={rinci.judul} className={`inline-flex items-center h-6 px-2 rounded-full border text-[11.5px] font-semibold cursor-help ${kelas}`}>{rinci.isi}</span>
    </div>
  );
}
