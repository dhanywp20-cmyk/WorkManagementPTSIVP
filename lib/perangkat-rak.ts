export type JenisPerangkatRak =
  | 'patch' | 'kabel' | 'switch' | 'server' | 'nas' | 'amp' | 'dsp' | 'matrix' | 'codec' | 'pdu' | 'shelf' | 'ups' | 'kosong';
export interface PerangkatRak { jenis: JenisPerangkatRak; u: number; nama: string }

export const PERANGKAT_RAK: Record<JenisPerangkatRak, { label: string; u: number; warna: string }> = {
  patch: { label: 'Patch panel 24 port', u: 1, warna: '#334155' },
  kabel: { label: 'Cable manager', u: 1, warna: '#1f2937' },
  switch: { label: 'Network switch 24 port', u: 1, warna: '#1e3a8a' },
  server: { label: 'Server / PC', u: 2, warna: '#64748b' },
  nas: { label: 'NAS / recorder', u: 2, warna: '#475569' },
  amp: { label: 'Power amplifier', u: 2, warna: '#7c2d12' },
  dsp: { label: 'DSP audio', u: 1, warna: '#0e7490' },
  matrix: { label: 'Matrix switcher', u: 2, warna: '#4338ca' },
  codec: { label: 'Codec video conference', u: 1, warna: '#0f766e' },
  pdu: { label: 'PDU', u: 1, warna: '#991b1b' },
  shelf: { label: 'Shelf / rak tray', u: 1, warna: '#57534e' },
  ups: { label: 'UPS', u: 3, warna: '#166534' },
  kosong: { label: 'Blank panel', u: 1, warna: '#e2e8f0' },
};
export const JENIS_RAK = Object.keys(PERANGKAT_RAK) as JenisPerangkatRak[];

export function isiRakBawaan(U: number): PerangkatRak[] {
  const urutan: [JenisPerangkatRak, number][] = [['patch', 1], ['kabel', 1], ['switch', 1], ['patch', 1], ['switch', 1], ['kosong', 1], ['server', 2], ['server', 2], ['nas', 2],
    ['kosong', 1], ['amp', 2], ['dsp', 1], ['matrix', 2], ['kosong', 1], ['amp', 2], ['server', 2], ['kosong', 2]];
  const ups = Math.min(3, Math.max(0, U - 6));
  const hasil: PerangkatRak[] = [];
  let y = 0, i = 0;
  while (y < U - ups) {
    const [jenis, tinggi] = urutan[i % urutan.length]; i++;
    const t = Math.min(tinggi, U - ups - y);
    hasil.push({ jenis, u: t, nama: PERANGKAT_RAK[jenis].label });
    y += t;
  }
  if (ups) hasil.push({ jenis: 'ups', u: ups, nama: 'UPS' });
  return hasil;
}

export function bersihkanIsiRak(x: unknown): PerangkatRak[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const hasil = x.slice(0, 60).flatMap(v => {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    if (!JENIS_RAK.includes(o.jenis as JenisPerangkatRak)) return [];
    const u = typeof o.u === 'number' && Number.isFinite(o.u) ? Math.min(12, Math.max(1, Math.round(o.u))) : 1;
    const nama = typeof o.nama === 'string' ? o.nama.trim().slice(0, 60) : '';
    return [{ jenis: o.jenis as JenisPerangkatRak, u, nama: nama || PERANGKAT_RAK[o.jenis as JenisPerangkatRak].label }];
  });
  return hasil.length ? hasil : undefined;
}
