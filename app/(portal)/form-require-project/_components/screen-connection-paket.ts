import { esc } from './desain-3d-request';
import { svgTautanScreen, urlGambarSvg, type TautanScreen } from './screen-connection-request';

export interface IsiScreen { tautan: TautanScreen; svg: string | null }

export async function isiSeksiScreen(requestId: string, tautan: TautanScreen[]): Promise<IsiScreen[]> {
  return Promise.all(tautan.map(async t => ({ tautan: t, svg: await svgTautanScreen(requestId, t) })));
}

export function htmlSeksiScreen(isi: IsiScreen[], namaRuang: (idx: number) => string): string {
  if (!isi.length) return '';
  const kartu = isi.map(({ tautan: t, svg }) => `<div style="padding:10px 14px;border-bottom:1px solid #e2e8f0;page-break-inside:avoid">
  <div style="font-size:13px;font-weight:800">${esc(t.nama || t.sumber?.nama || 'Screen Connection')}</div>
  <div style="font-size:11px;color:#475569;margin-top:2px">${esc(namaRuang(t.room_idx))} · ditautkan ${esc(t.dilampirkan_oleh_nama)}</div>
  ${svg
    ? `<img src="${esc(urlGambarSvg(svg))}" alt="" style="display:block;width:100%;max-width:720px;height:auto;margin-top:8px;border-radius:6px;border:1px solid #e2e8f0;background:#fff"/>`
    : '<div style="margin-top:6px;font-size:11px;color:#b45309">Diagram tidak bisa dimuat dari AV Solution Tools.</div>'}
</div>`).join('');
  return `<div class="section"><div class="section-title" style="background:#eff6ff;color:#1e40af;border-color:#bfdbfe">🖥️ Screen Connection (AV Solution Tools)</div>${kartu}</div>`;
}

export function berkasPaketScreen(isi: IsiScreen[]): { name: string; data: Uint8Array }[] {
  const enc = new TextEncoder();
  return isi.flatMap(({ tautan: t, svg }, i) => {
    if (!svg) return [];
    const nama = (t.nama || t.sumber?.nama || 'Screen').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
    return [{ name: `04_Screen_Connection_Tools_${i + 1}_${nama}.svg`, data: enc.encode(svg) }];
  });
}
