import type { IzinRuang } from './desain-3d-request';

export interface TautanScreen {
  id: string;
  room_idx: number;
  led_id: string | null;
  nama: string;
  sumber_diubah_at: string | null;
  dilampirkan_oleh_nama: string;
  created_at: string;
  updated_at: string;
  sumber: { nama: string; updated_at: string } | null;
}

export type DataScreen = { tautan: TautanScreen[]; izin: IzinRuang[]; galat?: string };

const api = (requestId: string) => `/api/form-require-project/${encodeURIComponent(requestId)}/screen-connection`;

export async function muatTautanScreen(requestId: string): Promise<DataScreen | { galat: string }> {
  try {
    const r = await fetch(api(requestId), { credentials: 'include', cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { galat: j?.alasan ?? 'Screen Connection tertaut tidak bisa dimuat.' };
    return { tautan: j.tautan as TautanScreen[], izin: j.izin as IzinRuang[] };
  } catch { return { galat: 'Tidak terhubung ke server.' }; }
}

export const tautanScreenKeTools = (t: Pick<TautanScreen, 'led_id'>) =>
  `/tools-team?alat=led&sub=koneksi${t.led_id ? `&led=${encodeURIComponent(t.led_id)}` : ''}`;

export const adaVersiBaru = (t: TautanScreen) =>
  !!(t.sumber && t.sumber_diubah_at && new Date(t.sumber.updated_at).getTime() > new Date(t.sumber_diubah_at).getTime());

const simpanan = new Map<string, Promise<string | null>>();

export function svgTautanScreen(requestId: string, t: Pick<TautanScreen, 'id' | 'updated_at'>): Promise<string | null> {
  const kunci = `${t.id}|${t.updated_at}`;
  let p = simpanan.get(kunci);
  if (!p) {
    p = fetch(`${api(requestId)}?tautan=${encodeURIComponent(t.id)}&v=${encodeURIComponent(t.updated_at)}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then(j => (j?.ok && typeof j.svg === 'string' ? j.svg as string : null)).catch(() => null);
    p.then(s => { if (!s) simpanan.delete(kunci); });
    simpanan.set(kunci, p);
  }
  return p;
}

export const urlGambarSvg = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
