/**
 * lib/ai-pengaturan.ts - pengaturan pembuat soal AI di Learning Center.
 *
 * Yang dulu terpaku di kode dan hanya bisa diubah lewat deploy:
 *
 *   1. TOKEN. Dibaca dari process.env.GEMINI_API_KEY, jadi menggantinya
 *      berarti menyunting variabel lingkungan di Vercel lalu men-deploy ulang.
 *      Sekarang tokennya tersimpan di tabel rahasia_integrasi dan diatur dari
 *      Admin Panel - berlaku seketika. Variabel lingkungan tetap dibaca
 *      sebagai cadangan, jadi pemasangan yang sudah ada tidak mendadak mati.
 *
 *   2. MODEL. Nama modelnya tertulis di URL. Model AI berganti nama dan
 *      dihentikan jauh lebih sering daripada aplikasi ini di-deploy, dan
 *      ketika itu terjadi pembuat soal berhenti bekerja sampai ada yang
 *      menyunting kode.
 *
 *   3. ARAHAN TOPIK. Tidak ada sama sekali. Soal yang dihasilkan mengikuti
 *      apa pun isi materinya, tanpa cara memberi tahu AI bahwa yang penting
 *      untuk tim ini adalah - misalnya - konfigurasi videowall dan
 *      troubleshooting sinyal, bukan sejarah mereknya.
 *
 * Nilai bawaannya MENIRU perilaku yang berlaku sekarang, jadi selama
 * pengaturannya belum diisi tidak ada satu pun yang berubah.
 */
import { supabase } from './supabase';

export const KUNCI_AI = 'ai.pembuat_soal';

/*
  Penilai jawaban essay punya pengaturannya SENDIRI, terpisah dari pembuat soal.

  Bukan sekadar kerapian. Kedua pekerjaan ini berbeda bentuk pemakaiannya, dan
  perbedaan itu langsung menabrak batas paket gratis:

    Pembuat soal   dijalankan sesekali - satu panggilan menghasilkan 10 soal.
    Penilai        dijalankan sekali untuk TIAP jawaban TIAP peserta.

  Satu sesi berisi 30 peserta dan 5 soal essay berarti 150 panggilan, sedangkan
  jatah harian gratis Gemini 2.5 Flash hanya puluhan permintaan. Dengan satu
  pengaturan bersama, penilaian yang boros memaksa pembuat soal ikut memakai
  model yang sama, dan kehabisan jatah di satu sisi mematikan sisi lainnya.

  Terpisah, penilai bisa dipasangi model berjatah besar (mis. seri Flash-Lite)
  sementara pembuat soal tetap memakai model terbaik - karena mutu soal jauh
  lebih penting daripada mutu satu saran nilai yang tetap dikoreksi manusia.
*/
export const KUNCI_AI_PENILAI = 'ai.penilai';

export interface PengaturanAI {
  /**
   * Nama model. Dibiarkan bebas teks, bukan daftar tertutup: daftar model
   * bertambah lebih cepat daripada berkas ini disunting, dan daftar yang
   * ketinggalan zaman justru menghalangi.
   */
  model: string;
  /**
   * Arahan tambahan untuk AI - topik yang perlu ditekankan, gaya soal, hal
   * yang harus dihindari. Ditempelkan pada instruksi sistem, bukan menggantinya:
   * aturan bentuk keluaran (JSON, jumlah opsi) tetap dipegang aplikasi supaya
   * arahan yang keliru tidak bisa merusak bentuk datanya.
   */
  arahan: string;
  /** Suhu 0-2. Makin rendah makin taat pada materi, makin tinggi makin bervariasi. */
  suhu: number;
}

export const AI_BAWAAN: PengaturanAI = {
  model: 'gemini-2.5-flash',
  arahan: '',
  suhu: 0.7,
};

export interface PengaturanPenilai extends PengaturanAI {
  /**
   * Menilai otomatis begitu halaman penilaian dibuka.
   *
   * MATI secara bawaan, dan itu perubahan yang disengaja dari perilaku
   * sebelumnya. Dulu membuka satu peserta langsung menembak AI sekali per soal
   * essay - jadi sekadar MELIHAT jawaban orang menghabiskan jatah, bahkan
   * ketika penilainya sudah tahu nilainya dan hanya ingin membacanya. Dengan
   * jatah harian yang cuma puluhan permintaan, beberapa kali buka-tutup
   * halaman sudah cukup untuk menghabiskannya.
   *
   * Sekarang penilaian dimulai kalau diminta - dan sekali diminta, seluruh
   * jawaban satu peserta dinilai dalam SATU panggilan.
   */
  otomatis: boolean;
}

export const PENILAI_BAWAAN: PengaturanPenilai = {
  // Flash-Lite: jatah harian gratisnya jauh lebih longgar daripada Flash, dan
  // untuk membandingkan jawaban dengan kunci referensi itu sudah memadai -
  // hasilnya toh hanya SARAN yang tetap dikoreksi penilai manusia.
  model: 'gemini-2.5-flash-lite',
  arahan: '',
  suhu: 0.2,   // menilai butuh taat pada kunci, bukan variasi
  otomatis: false,
};

export function rapikanPengaturanPenilai(isi: unknown): PengaturanPenilai {
  const dasar = rapikanPengaturanAI(isi);
  const r = (isi ?? {}) as Partial<PengaturanPenilai>;
  const adaModel = typeof r.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(r.model.trim());
  const adaSuhu  = Number.isFinite(Number(r.suhu));
  return {
    // Bawaan penilai BUKAN bawaan pembuat soal - jadi nilai yang tidak diisi
    // jatuh ke bawaannya sendiri, bukan ke model pembuat soal yang jatahnya
    // lebih sempit.
    model:  adaModel ? dasar.model : PENILAI_BAWAAN.model,
    arahan: dasar.arahan,
    suhu:   adaSuhu ? dasar.suhu : PENILAI_BAWAAN.suhu,
    otomatis: r.otomatis === true,
  };
}

export function rapikanPengaturanAI(isi: unknown): PengaturanAI {
  const r = (isi ?? {}) as Partial<PengaturanAI>;
  const suhu = Number(r.suhu);
  return {
    // Nama model dibatasi ke karakter yang memang dipakai nama model, karena
    // nilainya masuk ke URL. Tanpa itu, isian sembarang bisa mengubah alamat
    // yang dipanggil server.
    model: (typeof r.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(r.model.trim()))
      ? r.model.trim() : AI_BAWAAN.model,
    arahan: typeof r.arahan === 'string' ? r.arahan.slice(0, 4000) : '',
    suhu: Number.isFinite(suhu) ? Math.min(2, Math.max(0, suhu)) : AI_BAWAAN.suhu,
  };
}

/** Baca pengaturan AI. Dipakai sisi klien (layar admin) maupun server. */
export async function ambilPengaturanAI(): Promise<PengaturanAI> {
  try {
    const { data } = await supabase
      .from('app_settings').select('value').eq('key', KUNCI_AI).maybeSingle();
    // Kolom `value` menyimpan TEKS JSON, bukan objek - sama seperti pengaturan
    // lain di tabel ini. Menyerahkannya mentah ke rapikanPengaturanAI() akan
    // membuat seluruh isian gagal dikenali lalu jatuh ke nilai bawaan, tanpa
    // pesan apa pun: pengaturan yang tersimpan seolah tidak pernah tersimpan.
    const mentah = (data as { value?: unknown } | null)?.value;
    const isi = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
    return rapikanPengaturanAI(isi);
  } catch {
    // Tabelnya belum ada / tidak terbaca - jalan dengan bawaan, jangan meledak.
    return AI_BAWAAN;
  }
}

/** Baca pengaturan penilai essay. Dipakai sisi klien maupun server. */
export async function ambilPengaturanPenilai(): Promise<PengaturanPenilai> {
  try {
    const { data } = await supabase
      .from('app_settings').select('value').eq('key', KUNCI_AI_PENILAI).maybeSingle();
    const mentah = (data as { value?: unknown } | null)?.value;
    const isi = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
    return rapikanPengaturanPenilai(isi);
  } catch {
    return PENILAI_BAWAAN;
  }
}

/** Simpan pengaturan penilai essay. Hanya dipanggil layar admin. */
export async function simpanPengaturanPenilai(p: PengaturanPenilai): Promise<{ ok: boolean; pesan?: string }> {
  try {
    const bersih = rapikanPengaturanPenilai(p);
    const { error } = await supabase.from('app_settings')
      .upsert({ key: KUNCI_AI_PENILAI, value: JSON.stringify(bersih) }, { onConflict: 'key' });
    if (error) return { ok: false, pesan: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : 'gagal menyimpan' };
  }
}

/** Simpan pengaturan AI. Hanya dipanggil layar admin. */
export async function simpanPengaturanAI(p: PengaturanAI): Promise<{ ok: boolean; pesan?: string }> {
  try {
    const bersih = rapikanPengaturanAI(p);
    const { error } = await supabase.from('app_settings')
      .upsert({ key: KUNCI_AI, value: JSON.stringify(bersih) }, { onConflict: 'key' });
    if (error) return { ok: false, pesan: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: e instanceof Error ? e.message : 'gagal menyimpan' };
  }
}
