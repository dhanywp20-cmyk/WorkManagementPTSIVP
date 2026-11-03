
export type AdminFieldType = 'text' | 'textarea' | 'tel' | 'date' | 'time' | 'number' | 'select';

export interface AdminField {
  key: string;
  label: string;
  type?: AdminFieldType;
  options?: { value: string; label: string }[];
  span?: 1 | 2 | 3;
  placeholder?: string;
}

export interface Perubahan {
  key: string;
  label: string;
  dari: string;
  ke: string;
}

export const PENANDA_SUPERVISOR = 'SUP::';

export function bacaTujuanSupervisor(nilai: unknown): { id: string; nama: string } | null {
  if (typeof nilai !== 'string' || !nilai.startsWith(PENANDA_SUPERVISOR)) return null;
  const bagian = nilai.split('::');
  return { id: bagian[1] ?? '', nama: bagian.slice(2).join('::') };
}

export function bersihkanPenandaSupervisor(teks: string): string {
  return teks.replace(/SUP::[0-9a-fA-F-]+::([^;\n]+)/g, (_cocok, nama: string) => `${nama.trim()} (Supervisor)`);
}

function jadikanTeks(v: unknown): string {
  const sup = bacaTujuanSupervisor(v);
  if (sup) return `${sup.nama || 'Supervisor'} (Supervisor)`;
  if (v === null || v === undefined || v === '') return '(kosong)';
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak';
  return String(v);
}

export function bandingkan(
  fields: AdminField[],
  lama: Record<string, unknown>,
  baru: Record<string, unknown>,
): Perubahan[] {
  const hasil: Perubahan[] = [];
  for (const f of fields) {
    if (!(f.key in baru) || baru[f.key] === undefined) continue;
    const a = lama[f.key];
    const b = baru[f.key];
    const sa = a === null || a === undefined ? '' : String(a);
    const sb = b === null || b === undefined ? '' : String(b);
    if (sa === sb) continue;
    hasil.push({ key: f.key, label: f.label, dari: jadikanTeks(a), ke: jadikanTeks(b) });
  }
  return hasil;
}

export function ringkasPerubahan(p: Perubahan[]): string {
  return p.map(x => `${x.label}: ${x.dari} → ${x.ke}`).join('; ');
}

export function pesanWAPerubahan(opts: {
  namaPenerima: string;
  namaPengubah: string;
  judulItem: string;
  jenisItem: string;
  perubahan: Perubahan[];
  reroute?: { dari: string; ke: string } | null;
  tautan?: string;
}): string {
  const { namaPenerima, namaPengubah, judulItem, jenisItem, perubahan, reroute, tautan } = opts;
  const garis = '━━━━━━━━━━━━━━━━━━';
  const baris: string[] = [
    reroute ? `🔀 *${jenisItem} Dialihkan*` : `✏️ *${jenisItem} Diperbarui*`,
    garis,
    `Halo *${namaPenerima}*,`,
    reroute
      ? `*${namaPengubah}* mengalihkan pekerjaan ini dari *${reroute.dari || '(belum ada)'}* ke *${reroute.ke}*.`
      : `*${namaPengubah}* memperbarui data pekerjaan ini.`,
    `📌 *Item :* ${judulItem}`,
  ];
  if (perubahan.length > 0) {
    baris.push(garis, '*Yang berubah:*');
    for (const x of perubahan.slice(0, 12)) baris.push(`• ${x.label}: ${x.dari} → ${x.ke}`);
    if (perubahan.length > 12) baris.push(`• …dan ${perubahan.length - 12} perubahan lain`);
  }
  baris.push(garis);
  if (tautan) baris.push(`🔗 ${tautan}`);
  return baris.join('\n');
}
