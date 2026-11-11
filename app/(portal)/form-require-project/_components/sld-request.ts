import { bersihkanDok } from '@/lib/sld/dok';
import { barisPerangkat, type BarisPerangkat } from '@/lib/sld/turunan';
import type { DokSLD } from '@/lib/sld/tipe';
import type { IzinRuang } from './desain-3d-request';

export interface TautanSld {
  id: string;
  room_idx: number;
  sld_id: string;
  versi: number;
  dilampirkan_oleh_nama: string;
  created_at: string;
  updated_at: string;
  snapshot: { nama: string; created_at: string; dibuat_oleh_nama: string } | null;
  sumber: { nama: string; versi: number; diarsipkan_at: string | null } | null;
}

export type DataSld = { tautan: TautanSld[]; izin: IzinRuang[]; galat?: string };

const api = (requestId: string) => `/api/form-require-project/${encodeURIComponent(requestId)}/sld`;

export async function muatTautanSld(requestId: string): Promise<DataSld | { galat: string }> {
  try {
    const r = await fetch(api(requestId), { credentials: 'include', cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { galat: j?.alasan ?? 'SLD tertaut tidak bisa dimuat.' };
    return { tautan: j.tautan as TautanSld[], izin: j.izin as IzinRuang[] };
  } catch { return { galat: 'Tidak terhubung ke server.' }; }
}

export const tautanSldKeTools = (t: Pick<TautanSld, 'sld_id' | 'versi'>) =>
  `/tools-team?alat=sld&sld=${encodeURIComponent(t.sld_id)}&versi=${t.versi}`;

export const namaTautanSld = (t: TautanSld) => t.snapshot?.nama ?? t.sumber?.nama ?? 'SLD';

const simpanan = new Map<string, Promise<DokSLD | null>>();

export function dokTautanSld(requestId: string, t: Pick<TautanSld, 'id' | 'versi'>): Promise<DokSLD | null> {
  const kunci = `${t.id}|${t.versi}`;
  let p = simpanan.get(kunci);
  if (!p) {
    p = fetch(`${api(requestId)}?tautan=${encodeURIComponent(t.id)}&v=${t.versi}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null)).then(j => (j?.ok ? bersihkanDok(j.sld.data) : null)).catch(() => null);
    p.then(d => { if (!d) simpanan.delete(kunci); });
    simpanan.set(kunci, p);
  }
  return p;
}

export const ringkasanSld = (d: DokSLD): BarisPerangkat[] => barisPerangkat(d);

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface IsiSeksiSld { t: TautanSld; dok: DokSLD | null; gambar?: string }

export function htmlSeksiSld(isi: IsiSeksiSld[], namaRuang: (idx: number) => string): string {
  if (!isi.length) return '';
  const kartu = isi.map(({ t, dok, gambar }) => {
    const baris = dok ? ringkasanSld(dok).map(p => `<tr><td style="padding:3px 8px;color:#64748b">${esc(p.kategori)}</td><td style="padding:3px 8px">${esc(p.model)}</td><td style="padding:3px 8px;text-align:right;font-weight:700">${esc(p.qty)}</td></tr>`).join('') : '';
    const baru = t.sumber && !t.sumber.diarsipkan_at && t.sumber.versi > t.versi
      ? `<div style="margin-top:4px;font-size:10px;color:#b45309">Versi terbaru di AV Solution Tools: v${t.sumber.versi} (dokumen ini memakai v${t.versi}).</div>` : '';
    return `<div style="padding:10px 14px;border-bottom:1px solid #e2e8f0;page-break-inside:avoid">
  <div style="font-size:13px;font-weight:800">${esc(namaTautanSld(t))} <span style="font-size:10px;font-weight:700;color:#1d4ed8">v${t.versi}</span></div>
  <div style="font-size:11px;color:#475569;margin-top:2px">${esc(namaRuang(t.room_idx))} · ${dok ? `${dok.perangkat.length} perangkat · ${dok.kabel.length} kabel · ` : ''}ditautkan ${esc(t.dilampirkan_oleh_nama)}</div>
  ${baru}
  ${gambar ? `<img src="${gambar}" alt="" style="display:block;width:100%;height:auto;margin-top:8px;border:1px solid #e2e8f0"/>` : ''}
  ${baris ? `<table style="margin-top:6px;border-collapse:collapse;font-size:11px;width:100%">${baris}</table>` : ''}
</div>`;
  }).join('');
  return `<div class="section"><div class="section-title" style="background:#eff6ff;color:#1e40af;border-color:#bfdbfe">📐 Single Line Diagram (AV Solution Tools)</div>${kartu}
<div style="padding:6px 14px;font-size:10px;color:#94a3b8">SLD lengkap (Sheet 1 &amp; 2, PDF A3 / Visio) dibuka dari AV Solution Tools. Foto unggahan pembuat SLD hanya tersimpan di browser pembuat, jadi di sini memakai foto bawaan atau ilustrasi.</div></div>`;
}

export async function isiSeksiSld(requestId: string, tautan: TautanSld[], gambar: boolean): Promise<IsiSeksiSld[]> {
  const { lembarSvg } = await import('@/lib/sld/ekspor');
  return Promise.all(tautan.map(async t => {
    const dok = await dokTautanSld(requestId, t);
    if (!dok || !gambar) return { t, dok };
    try {
      const [svg] = await lembarSvg(dok, { simple: true });
      return { t, dok, gambar: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
    } catch { return { t, dok }; }
  }));
}

export async function berkasPaketSld(requestId: string, tautan: TautanSld[]): Promise<{ name: string; data: Uint8Array }[]> {
  if (!tautan.length) return [];
  const { berkasPaket } = await import('@/lib/sld/ekspor');
  const hasil: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < tautan.length; i++) {
    const t = tautan[i];
    const dok = await dokTautanSld(requestId, t);
    if (!dok) continue;
    const nama = namaTautanSld(t).replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
    try { hasil.push(...await berkasPaket(dok, `02_SLD_Tools_${i + 1}_${nama}_v${t.versi}`)); } catch {  }
  }
  return hasil;
}
