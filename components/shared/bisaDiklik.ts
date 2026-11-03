import type { KeyboardEvent } from 'react';

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
