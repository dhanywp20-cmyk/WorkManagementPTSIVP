
export const KUNCI_RAHASIA = [
  'whatsapp.token',
  'whatsapp.meta_token',
  'whatsapp.kustom_token',
  'telegram.bot_token',
  'ai.gemini_token',
  'ai.gemini_token_koreksi',
  'ai.gemini_token_asisten',
  'push.vapid_public_key',
  'push.vapid_private_key',
  'push.fcm_service_account',
] as const;

export type KunciRahasia = typeof KUNCI_RAHASIA[number];

export function galatBentukRahasia(kunci: KunciRahasia, nilai: string): string | null {
  if (kunci === 'push.fcm_service_account') {
    try {
      const j = JSON.parse(nilai);
      if (j?.type === 'service_account' && j.project_id && j.client_email && j.private_key) return null;
    } catch {  }
    return 'Bukan service account JSON Firebase. Unduh dari Firebase Console -> Project settings -> '
      + 'Service accounts -> Generate new private key, lalu tempel SELURUH isi berkasnya.';
  }
  if (kunci === 'telegram.bot_token') {
    if (/^\d+:[A-Za-z0-9_-]{30,45}$/.test(nilai)) return null;
    if (!nilai.includes(':')) {
      return 'Token ini kelihatan terpotong - tidak ada tanda titik dua. '
        + 'Token bot Telegram berbentuk "8333710505:AAF…", lengkap dengan angka ID bot di depannya. '
        + 'Klik dua kali pada teks di pesan BotFather sering hanya memilih separuh setelah ":" - '
        + 'blok manual dari awal sampai akhir baris, atau salin lewat tombol salin bila tersedia.';
    }
    return 'Token bot Telegram tidak sesuai format "<angka>:<kode>". Salin ulang seluruh baris dari pesan BotFather.';
  }
  return null;
}
