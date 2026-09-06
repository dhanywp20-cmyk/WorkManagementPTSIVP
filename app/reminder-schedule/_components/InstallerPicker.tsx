'use client';
import { useState } from 'react';

/**
 * Dropdown akun PTS Cabang/Perwakilan (menggantikan isian manual "Nama
 * Installer") + tetap bisa ketik manual untuk yang belum terdaftar sebagai
 * akun. Dipakai di ModePenyelesaianPanel saat jadwal Konfigurasi/Training
 * diselesaikan Remote.
 *
 * Mode manual dipilih otomatis kalau data yang sudah ada (mis. membuka
 * kembali proyek lama) berupa nama teks tanpa akun tertaut - supaya nama
 * lama tidak hilang begitu saja saat panel dibuka.
 */
export function InstallerPicker({
  daftarCabang, installerUserId, installerName, onPilihAkun, onKetikManual,
}: {
  daftarCabang: { id: string; full_name: string; pts_daerah: string | null }[];
  installerUserId: string | null;
  installerName: string;
  /** daerah = alamat daerah akun ini (users.pts_daerah) - dipakai auto-fill Daerah/Kota. */
  onPilihAkun: (id: string, nama: string, daerah: string | null) => void;
  onKetikManual: (nama: string) => void;
}) {
  const [manual, setManual] = useState(
    daftarCabang.length === 0 || (!installerUserId && installerName.trim() !== '')
  );

  if (manual) {
    return (
      <div className="space-y-1.5">
        <input value={installerName} onChange={e => onKetikManual(e.target.value)}
          placeholder="Nama PTS Daerah / mitra"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        {daftarCabang.length > 0 && (
          <button type="button" onClick={() => setManual(false)}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800">
            ← Pilih dari daftar akun PTS Cabang
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      aria-label="Pilih PTS Daerah"
      value={installerUserId ?? ''}
      onChange={e => {
        if (e.target.value === '__manual__') { setManual(true); return; }
        const akun = daftarCabang.find(a => a.id === e.target.value);
        if (akun) onPilihAkun(akun.id, akun.full_name, akun.pts_daerah);
      }}
      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
      <option value="">-- Pilih PTS Cabang --</option>
      {daftarCabang.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
      <option value="__manual__">✏️ Ketik manual...</option>
    </select>
  );
}
