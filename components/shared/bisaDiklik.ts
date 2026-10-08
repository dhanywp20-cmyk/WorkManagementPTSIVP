import type { KeyboardEvent } from 'react';

/**
 * Elemen non-tombol (kartu, baris daftar) yang bisa diklik: jadikan bisa dijangkau keyboard &
 * pembaca layar - fokus dengan Tab, jalankan dengan Enter / Spasi, diumumkan sebagai tombol.
 * Pakai: <div {...bisaDiklik(() => buka(x))} className="...">. Untuk <tr> pakai { peran: false }
 * supaya semantik tabel tetap (hanya fokus & tombol keyboard yang ditambahkan).
 */
export function bisaDiklik(aksi: () => void, opsi: { peran?: boolean } = {}) {
  return {
    ...(opsi.peran === false ? {} : { role: 'button' as const }),
    tabIndex: 0,
    onClick: aksi,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aksi(); }
    },
  };
}
