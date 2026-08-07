/**
 * Skala z-index terpusat.
 *
 * Tujuan: menghapus "magic number" z-[9995] / z-[9990] yang tersebar di JSX,
 * sehingga urutan tumpukan (stacking order) bisa dibaca dari nama, bukan angka.
 *
 * PENTING — angka di bawah ini sengaja dipilih agar SAMA PERSIS dengan nilai
 * yang sudah dipakai sebelumnya. Jangan diubah tanpa mengecek seluruh layer
 * pada halaman terkait, karena beberapa komponen lain (mis. _components/Modals.tsx)
 * masih memakai kelas Tailwind literal z-[9998] / z-[9999] dan harus tetap
 * berada di antara modalBlocking dan toast.
 *
 * Urutan tumpukan pada halaman form-require-project (dari bawah ke atas):
 *
 *   modal          100    dropdown notifikasi, konfirmasi bulk delete
 *   modalNested    9990   DETAIL MODAL (full screen)
 *   modalNestedTop 9995   reject / status update / delete / edit  (di atas detail)
 *   modalBlocking  9996   peringatan "masih ada tiket aktif"      (memblok interaksi)
 *   ── 9998 / 9999        Modals.tsx (literal, belum dimigrasi)
 *   toast          10000  notifikasi toast — HARUS selalu paling atas
 */
export const Z = {
  /** Layer modal/dropdown standar dalam alur halaman biasa. */
  modal: 100,

  /** Modal full-screen yang menjadi "kanvas" bagi modal lain di atasnya. */
  modalNested: 9990,

  /** Modal yang tampil DI ATAS modalNested (reject, status, delete, edit). */
  modalNestedTop: 9995,

  /** Peringatan yang memblokir aksi; di atas modalNestedTop, di bawah toast. */
  modalBlocking: 9996,

  /** Toast/notifikasi — lapisan tertinggi, tidak boleh tertutup apa pun. */
  toast: 10000,
} as const;

export type ZLayer = keyof typeof Z;
