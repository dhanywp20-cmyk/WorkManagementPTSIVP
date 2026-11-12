export const KUNCI_DASBOR_WIDGET = 'dasbor_widget';
export const EVENT_DASBOR_WIDGET = 'dasbor-widget-berubah';

export const DAFTAR_WIDGET = [
  { kunci: 'ringkasan', label: 'Kalimat ringkasan', ket: 'Baris status di atas kartu (hanya hal yang tidak tampil di kartu lain).', bagian: 'Atas' },
  { kunci: 'tiket-selesai', label: 'Tiket selesai', ket: 'Jumlah & persen tiket selesai pada periode.', bagian: 'Atas' },
  { kunci: 'jadwal-tim', label: 'Jadwal tim berikutnya', ket: 'Jadwal terdekat tim beserta harinya.', bagian: 'Atas' },
  { kunci: 'terlambat', label: 'Terlambat', ket: 'Tiket & jadwal yang lewat tenggat.', bagian: 'Atas' },
  { kunci: 'alur-kerja', label: 'Grafik alur kerja', ket: 'Grafik harian tiket / jadwal selesai vs belum.', bagian: 'Atas' },
  { kunci: 'piket', label: 'Piket Showroom', ket: 'Petugas piket hari ini per tim.', bagian: 'Atas' },
  { kunci: 'agenda', label: 'Agenda Saya', ket: 'Panel kanan: tugas & agenda pengguna yang membuka dashboard.', bagian: 'Samping' },
  { kunci: 'daily-report-tim', label: 'Daily Report tim', ket: 'Siapa yang sudah / belum mengisi Daily Report.', bagian: 'Bawah' },
  { kunci: 'menunggu-keputusan', label: 'Menunggu keputusan', ket: 'Approval tiket, jadwal, desain, tech note, akun baru.', bagian: 'Bawah' },
  { kunci: 'unit-di-luar', label: 'Unit di luar', ket: 'Unit pinjaman yang belum kembali.', bagian: 'Bawah' },
  { kunci: 'sumber-tiket', label: 'Sumber tiket', ket: 'Tiket per produk, divisi, handler, status.', bagian: 'Bawah' },
  { kunci: 'tren-tiket', label: 'Tren tiket tahunan', ket: 'Grafik tiket per bulan tahun ini.', bagian: 'Bawah' },
  { kunci: 'tiket-terlama', label: 'Tiket terlama', ket: 'Tiket terbuka paling lama.', bagian: 'Bawah' },
  { kunci: 'project-progress', label: 'Project Progress', ket: 'Proyek berjalan dengan target terdekat.', bagian: 'Bawah' },
  { kunci: 'nilai-sales', label: 'Nilai dari Sales', ket: 'Rata-rata nilai review Demo & BAST.', bagian: 'Bawah' },
  { kunci: 'pembelajaran', label: 'Pembelajaran tim', ket: 'Tingkat lulus quiz & Tech Note.', bagian: 'Bawah' },
] as const;

export type KunciWidget = (typeof DAFTAR_WIDGET)[number]['kunci'];

export type PengaturanDasbor = {
  sembunyi: KunciWidget[];
  latarRedup: boolean;
};

export const DASBOR_BAWAAN: PengaturanDasbor = { sembunyi: [], latarRedup: true };

const SEMUA = new Set<string>(DAFTAR_WIDGET.map(w => w.kunci));

export function rapikanDasbor(nilai: unknown): PengaturanDasbor {
  let o: unknown = nilai;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const r = (o && typeof o === 'object' && !Array.isArray(o) ? o : {}) as Record<string, unknown>;
  const sembunyi = Array.isArray(r.sembunyi) ? [...new Set(r.sembunyi.filter((k): k is KunciWidget => typeof k === 'string' && SEMUA.has(k)))] : [];
  return { sembunyi, latarRedup: typeof r.latarRedup === 'boolean' ? r.latarRedup : DASBOR_BAWAAN.latarRedup };
}

export const tampil = (p: PengaturanDasbor, k: KunciWidget) => !p.sembunyi.includes(k);

export function susunBaris<K extends string>(item: { kunci: K; lebar: number }[], kolom: number): Record<K, number> {
  const baris: { kunci: K; lebar: number }[][] = [];
  let isi = 0;
  for (const it of item) {
    if (!baris.length || isi + it.lebar > kolom) { baris.push([]); isi = 0; }
    baris[baris.length - 1].push(it);
    isi += it.lebar;
  }
  const hasil = {} as Record<K, number>;
  for (const b of baris) {
    const total = b.reduce((n, x) => n + x.lebar, 0);
    let sisa = kolom;
    b.forEach((x, i) => {
      const lebar = i === b.length - 1 ? Math.max(1, sisa) : Math.max(1, Math.round((x.lebar * kolom) / total));
      hasil[x.kunci] = lebar;
      sisa -= lebar;
    });
  }
  return hasil;
}
