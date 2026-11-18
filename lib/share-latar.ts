import type { CSSProperties } from 'react';

export const BUCKET_LATAR_SHARE = 'merek-files';
export const FOLDER_LATAR_SHARE = 'share-latar';
export const BATAS_LATAR_SHARE = 4 * 1024 * 1024;

const POLA_URL = /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/merek-files\/share-latar\/[A-Za-z0-9._-]{1,120}$/;

export function rapikanLatarShare(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return POLA_URL.test(s) ? s : undefined;
}

export function gayaLatarShare(latar: string | null | undefined, menunggu = false): CSSProperties {
  if (menunggu) return { background: 'var(--halaman)' };
  if (!latar) return { background: 'var(--latar-halaman)' };
  return { background: `var(--halaman) url("${latar.replace(/"/g, '%22')}") center / cover no-repeat fixed` };
}
