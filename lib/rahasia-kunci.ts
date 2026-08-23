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
] as const;

export type KunciRahasia = typeof KUNCI_RAHASIA[number];
