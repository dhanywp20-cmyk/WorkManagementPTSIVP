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
