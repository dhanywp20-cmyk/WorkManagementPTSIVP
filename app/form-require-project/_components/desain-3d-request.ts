import type { RingkasanDesain } from '@/lib/tools-team';

/**
 * Design 3D dari Tools Team yang ditautkan ke Request Design Project -
 * TAMBAHAN di samping unggahan file "Design 3D" (PDF), keduanya opsional.
 *
 * Yang dimuat halaman request hanya ringkasan & pratinjau VERSI yang
 * ditautkan (tidak berubah walau desain di Tools Team diedit); data 3D penuh
 * baru dimuat saat "Buka di Tools Team".
 */
export interface TautanDesain3D {
  id: string;
  room_idx: number;
  desain_id: string;
  versi: number;
  dilampirkan_oleh_nama: string;
  created_at: string;
  updated_at: string;
  snapshot: { nama: string; ringkasan: Partial<RingkasanDesain>; gambar: string | null; created_at: string; dibuat_oleh_nama: string } | null;
  sumber: { nama: string; versi: number; diarsipkan_at: string | null } | null;
}

export type IzinRuang = { ok: true } | { ok: false; alasan: string };

export async function muatTautanDesain3D(requestId: string): Promise<{ tautan: TautanDesain3D[]; izin: IzinRuang[] } | { galat: string }> {
  try {
    const r = await fetch(`/api/form-require-project/${encodeURIComponent(requestId)}/desain-3d`, { credentials: 'include', cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { galat: j?.alasan ?? 'Design 3D tidak bisa dimuat.' };
    return { tautan: j.tautan as TautanDesain3D[], izin: j.izin as IzinRuang[] };
  } catch { return { galat: 'Tidak terhubung ke server.' }; }
}

export const tautanKeTools = (t: Pick<TautanDesain3D, 'desain_id' | 'versi'>) =>
  `/tools-team?alat=3d&desain=${encodeURIComponent(t.desain_id)}&versi=${t.versi}`;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const angka = (n: number) => (Math.round(n * 100) / 100).toLocaleString('id-ID');
export const ukuranRuang = (rs: Partial<RingkasanDesain> | undefined) =>
  (rs?.ruang ?? []).map(r => `${angka(r.p)} × ${angka(r.l)} × ${angka(r.t)} m`).join(' + ');

/**
 * Seksi "Design 3D (Tools Team)" untuk lembar cetak & paket ZIP. String kosong
 * bila tidak ada tautan - request tanpa Design 3D tetap tercetak utuh tanpa
 * seksi "kosong".
 */
export function htmlSeksiDesain3D(tautan: TautanDesain3D[], namaRuang: (idx: number) => string): string {
  if (!tautan.length) return '';
  const kartu = tautan.map(t => {
    const s = t.snapshot, rs = s?.ringkasan;
    const perangkat = (rs?.perangkat ?? []).map(p => `<tr><td style="padding:3px 8px;color:#64748b">${esc(p.kategori)}</td><td style="padding:3px 8px">${esc(p.nama)}</td><td style="padding:3px 8px;text-align:right;font-weight:700">${p.jumlah}</td></tr>`).join('');
    const baru = t.sumber && !t.sumber.diarsipkan_at && t.sumber.versi > t.versi
      ? `<div style="margin-top:4px;font-size:10px;color:#b45309">Versi terbaru di Tools Team: v${t.sumber.versi} (dokumen ini memakai v${t.versi}).</div>` : '';
    return `<div style="display:flex;gap:12px;padding:10px 14px;border-bottom:1px solid #e2e8f0;page-break-inside:avoid">
  ${s?.gambar ? `<img src="${esc(s.gambar)}" alt="" style="width:200px;height:auto;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0"/>` : ''}
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:800">${esc(s?.nama ?? t.sumber?.nama ?? 'Design 3D')} <span style="font-size:10px;font-weight:700;color:#7c3aed">v${t.versi}</span></div>
    <div style="font-size:11px;color:#475569;margin-top:2px">${esc(namaRuang(t.room_idx))} · ${esc(ukuranRuang(rs) || '—')} · ${rs?.jumlah ?? 0} benda · ditautkan ${esc(t.dilampirkan_oleh_nama)}</div>
    ${baru}
    ${perangkat ? `<table style="margin-top:6px;border-collapse:collapse;font-size:11px;width:100%">${perangkat}</table>` : ''}
  </div>
</div>`;
  }).join('');
  return `<div class="section"><div class="section-title" style="background:#f5f3ff;color:#5b21b6;border-color:#ddd6fe">🧊 Design 3D (Tools Team)</div>${kartu}
<div style="padding:6px 14px;font-size:10px;color:#94a3b8">Daftar perangkat dari desain 3D adalah estimasi tata letak; verifikasi dengan datasheet dan kondisi lokasi sebelum penawaran/instalasi.</div></div>`;
}

/** Gambar pratinjau (data URL JPEG) -> byte, untuk dimasukkan ke ZIP. */
export function bytePratinjau(dataUrl: string | null | undefined): Uint8Array | null {
  const m = /^data:image\/(jpeg|webp);base64,(.+)$/.exec(dataUrl ?? '');
  if (!m) return null;
  try {
    const bin = atob(m[2]); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}
