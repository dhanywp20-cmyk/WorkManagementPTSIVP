'use client';

/**
 * Isian tambahan saat peserta masuk, sesuai kelas.isian_peserta (lib/kelas-eksternal.ts):
 * perusahaan/instansi (wajib) dan email/HP + izin dihubungi (opsional). Dipakai halaman kuis mandiri
 * (gaya 'terang') dan Kuis Live (gaya 'kuis', isian besar di kartu putih). Server memeriksa ulang.
 */
import { MAKS_INSTANSI, MAKS_KONTAK, type IsianPeserta } from '@/lib/kelas-eksternal';

export interface NilaiIsian { instansi: string; kontak: string; izin_kontak: boolean }
export const ISIAN_KOSONG: NilaiIsian = { instansi: '', kontak: '', izin_kontak: false };

/** Isian wajib sudah terpenuhi (pemeriksaan ringan di peramban - aturan lengkapnya di server). */
export const isianLengkap = (isian: IsianPeserta, n: NilaiIsian) => isian === 'nama' || n.instansi.trim().length >= 2;

export function IsianTambahan({ isian, nilai, ubah, gaya }: {
  isian: IsianPeserta; nilai: NilaiIsian; ubah: (n: NilaiIsian) => void; gaya: 'terang' | 'kuis';
}) {
  if (isian === 'nama') return null;
  const kuis = gaya === 'kuis';
  const kelasInput = kuis
    ? 'w-full h-12 rounded-xl border-2 border-slate-300 px-4 text-center text-[16px] font-bold outline-none focus:border-slate-900'
    : 'w-full rounded-xl border border-slate-300 px-4 py-3 text-[15px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  const label = (htmlFor: string, teks: string, opsional = false) => (
    <label htmlFor={htmlFor} className={kuis ? 'sr-only' : 'block text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-1.5'}>
      {teks}{opsional && !kuis && <span className="ml-1 normal-case tracking-normal font-normal text-slate-400">(opsional)</span>}
    </label>
  );
  return (
    <div className="space-y-3">
      <div>
        {label('instansi-peserta', 'Perusahaan / instansi')}
        <input id="instansi-peserta" value={nilai.instansi} maxLength={MAKS_INSTANSI} autoComplete="organization"
          onChange={e => ubah({ ...nilai, instansi: e.target.value })}
          placeholder={kuis ? 'Perusahaan / instansi' : 'Nama perusahaan atau instansi'} className={kelasInput} />
      </div>
      {isian === 'kontak' && (
        <>
          <div>
            {label('kontak-peserta', 'Email atau nomor HP', true)}
            <input id="kontak-peserta" value={nilai.kontak} maxLength={MAKS_KONTAK} autoComplete="email" inputMode="email"
              onChange={e => ubah({ ...nilai, kontak: e.target.value, izin_kontak: e.target.value.trim() ? nilai.izin_kontak : false })}
              placeholder={kuis ? 'Email / HP (opsional)' : 'nama@perusahaan.com atau 08xx'} className={kelasInput} />
          </div>
          {nilai.kontak.trim() && (
            <label className="flex items-start gap-2 text-left text-[12.5px] text-slate-600 cursor-pointer">
              <input type="checkbox" checked={nilai.izin_kontak} onChange={e => ubah({ ...nilai, izin_kontak: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0" />
              <span>Saya bersedia dihubungi untuk informasi produk dan pelatihan berikutnya.</span>
            </label>
          )}
        </>
      )}
    </div>
  );
}
