import type { Question } from '../shared';

export type QuizQuestion = Omit<Question, 'correct_answer' | 'model_answer'>;

export function terjemahkanGalatUnggah(pesan?: string): string {
  const p = pesan ?? 'Gagal mengunggah.';
  if (/row-level security|violates row/i.test(p)) {
    return 'Penyimpanan gambar belum diizinkan di server. Ini bukan kesalahan kamu — '
      + 'hubungi admin untuk menjalankan sql/perbaikan-unggah-jawaban-gambar.sql. '
      + 'Jawaban lain yang sudah kamu isi tetap tersimpan.';
  }
  if (/bucket not found|not found/i.test(p)) {
    return 'Tempat penyimpanan gambar belum dibuat di server. Hubungi admin — '
      + 'jalankan sql/learning-center-essay-gambar.sql.';
  }
  if (/exceeded the maximum allowed size|payload too large|413/i.test(p)) {
    return 'Fotonya terlalu besar walau sudah dikecilkan. Coba foto ulang dari jarak '
      + 'lebih dekat, atau potong bagian yang tidak perlu.';
  }
  if (/mime type|not supported/i.test(p)) {
    return 'Jenis berkasnya tidak didukung. Pakai foto biasa (JPG atau PNG).';
  }
  return p;
}

export function acakDenganBenih<T>(daftar: T[], benih: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < benih.length; i++) {
    h ^= benih.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const acak = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hasil = [...daftar];
  for (let i = hasil.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

export function tenggatQuiz(closeAt: string | null | undefined): { teks: string; mendesak: boolean } | null {
  if (!closeAt) return null;
  const tutup = new Date(closeAt);
  if (Number.isNaN(tutup.getTime())) return null;

  const sisaJam = (tutup.getTime() - Date.now()) / 3_600_000;
  if (sisaJam <= 0) return null;

  const jam = tutup.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (sisaJam < 1) {
    return { teks: `Tutup ${Math.max(1, Math.round(sisaJam * 60))} menit lagi · ${jam}`, mendesak: true };
  }
  if (sisaJam < 24) {
    return { teks: `Tutup ${Math.round(sisaJam)} jam lagi · ${jam}`, mendesak: true };
  }
  const tanggal = tutup.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  return { teks: `Tutup ${tanggal} · ${jam}`, mendesak: false };
}
