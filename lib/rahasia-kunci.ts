/**
 * lib/rahasia-kunci.ts - daftar tertutup kunci rahasia yang boleh disimpan.
 *
 * Berdiri sendiri karena dua sebab. Pertama, berkas route Next.js hanya boleh
 * mengekspor handler HTTP - mengekspor konstanta dari sana menggagalkan build.
 * Kedua, daftarnya memang perlu dibaca dua pihak: route yang menyimpan dan UI
 * yang menampilkan statusnya.
 *
 * Daftar ini TERTUTUP dan itu disengaja: route hanya menyimpan kunci yang
 * tercantum di sini, bukan apa pun yang dikirim peramban. Tanpa itu, siapa pun
 * yang lolos penjaga admin bisa menjejali tabel rahasia dengan baris sembarang.
 */

export const KUNCI_RAHASIA = [
  'whatsapp.token',          // Fonnte
  'whatsapp.meta_token',     // WhatsApp Cloud API (resmi Meta)
  'whatsapp.kustom_token',   // webhook penyedia lain
  'telegram.bot_token',
  'ai.gemini_token',         // Google AI Studio - PEMBUAT SOAL Learning Center
  /*
    Token terpisah untuk PENILAI jawaban essay.

    Dua pekerjaan ini punya bentuk pemakaian yang sangat berbeda. Membuat soal
    dijalankan sesekali, sekali per angkatan soal. Menilai dijalankan sekali
    untuk tiap jawaban tiap peserta - satu sesi berisi 30 peserta dan 5 soal
    essay sudah 150 panggilan, sementara jatah harian gratis Gemini 2.5 Flash
    hanya puluhan permintaan.

    Dengan satu token, penilaian yang boros menghabiskan jatah yang sama dan
    pembuat soal ikut mati - padahal keduanya tidak berhubungan. Dipisah supaya
    kehabisan di satu sisi tidak menyeret sisi lainnya, dan supaya masing-masing
    bisa memakai proyek Google (atau model) yang cocok dengan polanya sendiri.

    Bila dikosongkan, penilai memakai token pembuat soal - jadi pemasangan lama
    tetap jalan tanpa diubah.
  */
  'ai.gemini_token_koreksi',
] as const;

export type KunciRahasia = typeof KUNCI_RAHASIA[number];
