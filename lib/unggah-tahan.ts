const POLA_UNGGAH = /\/storage\/v1\/object\/(?!public\/|sign\/|list\/|info\/|move$|copy$)/;
const MAKS_ULANG = 2;

export const PESAN_BERKAS_TAK_TERBACA = 'Foto/berkas tidak bisa dibaca dari perangkat. Pilih ulang berkasnya lalu kirim lagi.';

function urlDari(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

async function berkasDiMemori(b: Blob): Promise<Blob> {
  let isi: ArrayBuffer;
  try { isi = await b.arrayBuffer(); } catch { throw new Error(PESAN_BERKAS_TAK_TERBACA); }
  return typeof File !== 'undefined' && b instanceof File
    ? new File([isi], b.name, { type: b.type, lastModified: b.lastModified })
    : new Blob([isi], { type: b.type });
}

export async function bodiDiMemori(body: BodyInit): Promise<BodyInit> {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const salinan = new FormData();
    for (const [kunci, nilai] of body.entries()) {
      if (typeof nilai === 'string') salinan.append(kunci, nilai);
      else salinan.append(kunci, await berkasDiMemori(nilai), nilai.name);
    }
    return salinan;
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return berkasDiMemori(body);
  return body;
}

async function sudahAda(res: Response): Promise<boolean> {
  if (res.status === 409) return true;
  try {
    const j = await res.clone().json() as { statusCode?: string | number; error?: string };
    return String(j.statusCode) === '409' || /duplicate|already exists/i.test(j.error ?? '');
  } catch { return false; }
}

const jeda = (ms: number) => new Promise(r => setTimeout(r, ms));

export function denganUnggahTahan(dasar: typeof fetch, jedaMs = 1000): typeof fetch {
  return async (input, init) => {
    const url = urlDari(input);
    const metode = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!init?.body || !POLA_UNGGAH.test(url) || (metode !== 'POST' && metode !== 'PUT')) return dasar(input, init);

    const body = await bodiDiMemori(init.body);
    for (let percobaan = 0; ; percobaan++) {
      try {
        const res = await dasar(input, { ...init, body });
        if (percobaan > 0 && !res.ok && metode === 'POST' && await sudahAda(res)) {
          const kunci = decodeURIComponent(url.split('/storage/v1/object/')[1]?.split('?')[0] ?? '');
          return new Response(JSON.stringify({ Key: kunci }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return res;
      } catch (galat) {
        const dibatalkan = galat instanceof Error && (galat.name === 'AbortError' || galat.name === 'ServicesTakTerjangkau' || galat.message === PESAN_BERKAS_TAK_TERBACA);
        if (dibatalkan || percobaan >= MAKS_ULANG) throw galat;
        await jeda(jedaMs * (percobaan + 1));
      }
    }
  };
}

export async function salinBerkas(f: File | null | undefined): Promise<File | null> {
  if (!f) return null;
  try { return await berkasDiMemori(f) as File; } catch { return f; }
}
