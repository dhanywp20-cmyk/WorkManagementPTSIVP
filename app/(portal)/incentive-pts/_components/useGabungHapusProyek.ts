'use client';

/** useGabungHapusProyek - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { IncentiveProjectRow, satukanProyek, type KandidatGabung, setProyekDikeluarkan, tahapanSudahJalan } from './calc';
import { logAudit } from '@/lib/audit';
import { useState } from 'react';
import { type CurrentUser } from './aturan-halaman';

export interface GabungHapusProyekKonteks {
  currentUser: CurrentUser | null;
  konfirmGabung: KandidatGabung | null;
  loadAll: () => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  setKonfirmGabung: import("react").Dispatch<import("react").SetStateAction<KandidatGabung | null>>;
  setMenggabung: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function useGabungHapusProyek(k: GabungHapusProyekKonteks) {
  const { currentUser, konfirmGabung, loadAll, notify, setKonfirmGabung, setMenggabung } = k;
  const jalankanGabung = async () => {
    if (!konfirmGabung) return;
    setMenggabung(true);
    const { error } = await satukanProyek(konfirmGabung.anggota);
    setMenggabung(false);
    if (error) { notify('error', 'Gagal menggabungkan: ' + error.message); return; }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive-pts', action: 'update',
      target_id: konfirmGabung.anggota[0].id, target_name: konfirmGabung.nama,
      old_value: `${konfirmGabung.anggota.length} proyek terpisah`,
      new_value: '1 proyek insentif',
      notes: `Digabungkan lewat tombol Gabungkan · BAST ${konfirmGabung.bast_date} · kategori: `
        + konfirmGabung.anggota.map(a => a.category ?? '-').join(', '),
    });
    setKonfirmGabung(null);
    notify('success', `"${konfirmGabung.nama}" kini dihitung sebagai satu proyek.`);
    await loadAll();
  };
  const [pilihHapus, setPilihHapus] = useState<Set<string>>(new Set());
  const [konfirmHapus, setKonfirmHapus] = useState<IncentiveProjectRow[] | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const togglePilih = (id: string) => setPilihHapus(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const mintaKonfirmasiHapus = async (target: IncentiveProjectRow[]) => {
    if (!target.length) return;
    /*
      Tahapan yang sudah diproses / dibayar MENGUNCI proyeknya.

      Rekap yang sudah diterima Finance memuat proyek ini. Kalau proyeknya
      hilang dari platform, angka pada rekap itu tidak bisa dijelaskan lagi -
      dan yang paling merepotkan, tidak ada yang tahu selisihnya berasal dari
      mana. Diperiksa ke basis data, bukan ke daftar di layar, karena layar
      bisa tertinggal dari keadaan sebenarnya.
    */
    const { data: terkunci } = await tahapanSudahJalan(target.map(p => p.id));
    if (terkunci.length) {
      const idTerkunci = new Set(terkunci.map(t => t.project_id));
      const nama = target.filter(p => idTerkunci.has(p.id)).map(p => p.project_name);
      notify('error',
        `Tidak bisa dikeluarkan — tahapan pencairannya sudah diproses/dibayar: ${nama.join(', ')}. ` +
        'Batalkan dulu tahapannya bila memang keliru.');
      return;
    }
    setKonfirmHapus(target);
  };

  const jalankanHapus = async () => {
    if (!konfirmHapus) return;
    setMenghapus(true);
    const ids = konfirmHapus.map(p => p.id);
    const { error } = await setProyekDikeluarkan(ids, true);
    setMenghapus(false);
    if (error) { notify('error', 'Gagal mengeluarkan: ' + error.message); return; }

    // Dicatat satu per satu, bukan sebagai satu baris "3 project dikeluarkan":
    // yang perlu bisa ditelusuri kelak adalah proyek MANA, bukan berapa banyak.
    for (const p of konfirmHapus) {
      void logAudit({
        user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
        module: 'incentive-pts', action: 'update',
        target_id: p.id, target_name: p.project_name,
        old_value: 'ikut dihitung di Incentive',
        new_value: 'dikeluarkan dari Incentive (jadwal tetap ada)',
        notes: 'Dikeluarkan lewat tombol Hapus di daftar Incentive PTS',
      });
    }
    setKonfirmHapus(null);
    setPilihHapus(new Set());
    notify('success', `${ids.length} project dikeluarkan dari Incentive. Jadwalnya tetap ada di Request Schedule.`);
    await loadAll();
  };
  return { jalankanGabung, pilihHapus, setPilihHapus, konfirmHapus, setKonfirmHapus, menghapus, setMenghapus, togglePilih, mintaKonfirmasiHapus, jalankanHapus };
}
