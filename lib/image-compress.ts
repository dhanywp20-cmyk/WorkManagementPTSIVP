/**
 * lib/image-compress.ts - resize + compress foto DI BROWSER sebelum upload ke
 * Supabase Storage. Tujuan: kurangi egress Supabase (storage + bandwidth),
 * karena foto dari HP biasanya 3000-4000px / 3-8MB padahal cuma ditampilkan
 * di layar kecil (thumbnail/preview 400-800px).
 *
 * Strategi: turunkan resolusi ke max sisi terpanjang (default 1600px, cukup
 * tajam bahkan untuk full-screen preview desktop), lalu re-encode JPEG
 * dengan quality ~0.75. Biasanya foto 4-8MB  150-400KB (turun 90%+).
 *
 * Tidak menyentuh file non-gambar (PDF, dll) - dikembalikan apa adanya.
 */

export interface CompressOptions {
  maxDim?: number;   // sisi terpanjang maksimum, px (default 1600)
  quality?: number;  // JPEG quality 0-1 (default 0.75)
}

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.75;

/** File image yang TIDAK di-compress (animasi/vector - resize bisa merusak). */
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  // Bukan gambar (PDF, dll) atau tipe yang sengaja di-skip  kembalikan asli.
  if (!file.type.startsWith('image/') || SKIP_TYPES.has(file.type)) return file;

  const maxDim = opts.maxDim ?? DEFAULT_MAX_DIM;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Sudah cukup kecil  skip proses, kembalikan file asli (hemat waktu).
    if (width <= maxDim && height <= maxDim && file.size <= 400 * 1024) {
      bitmap.close?.();
      return file;
    }

    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file; // canvas tak didukung  fallback file asli

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) return file; // gagal encode  fallback file asli

    // Kalau hasil compress malah lebih besar dari asli (jarang, tapi bisa
    // terjadi utk gambar yang sudah heavily compressed), pakai yang asli.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    // createImageBitmap/canvas gagal (browser lama, file korup, dll)  jangan
    // blokir upload, kembalikan file asli.
    return file;
  }
}

/** Compress banyak file sekaligus (skip otomatis untuk yang bukan gambar). */
export async function compressImages(files: File[], opts?: CompressOptions): Promise<File[]> {
  return Promise.all(files.map(f => compressImage(f, opts)));
}
