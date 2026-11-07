
export const KUNCI_DAFTAR_PILIHAN = 'daftar_pilihan';
export const MAKS_ITEM = 100;
export const MAKS_PANJANG = 60;

export type KunciDaftar = 'merek-display' | 'merek-middleware' | 'piket-kegiatan' | 'piket-produk' | 'piket-kebutuhan' | 'unit-event';

export interface DefDaftar { k: KunciDaftar; judul: string; menu: string; ket: string; bawaan: string[]; terkunci?: string[] }

export const DAFTAR_PILIHAN: DefDaftar[] = [
  { k: 'merek-display', judul: 'Merek display', menu: 'Request Design Project · PIC Brand',
    ket: 'Pilihan merek display di form ruangan & daftar PIC Brand.',
    bawaan: ['Microvision', 'Philips', 'Panasonic', 'Newline', 'Promethean', 'Maxhub', 'Ledman', 'Taniled', 'Vivitek'] },
  { k: 'merek-middleware', judul: 'Merek middleware', menu: 'Request Design Project · PIC Brand',
    ket: 'Pilihan merek middleware / kontrol di form ruangan & daftar PIC Brand.',
    bawaan: ['Tricolor', 'Wyrestorm', 'Extron', 'Crestron', 'AVCiT', 'Brightsign', 'Cue'] },
  { k: 'piket-kegiatan', judul: 'Jenis kegiatan piket', menu: 'Piket Showroom',
    ket: '"Demo Product" (isian tamu & kebutuhan) dan "RnD" (tim R&D) punya isian khusus - tidak bisa dihapus.',
    bawaan: ['Demo Product', 'RnD', 'Maintenance', 'Shooting Markom'], terkunci: ['Demo Product', 'RnD'] },
  { k: 'piket-produk', judul: 'Produk showroom', menu: 'Piket Showroom',
    ket: '"All Product" = semua produk di daftar ini (dihitung ke tiap produk di ringkasan & Excel).',
    bawaan: ['All Product', 'Videowall', 'LED', 'IFP', 'Projector', 'Audio System', 'Lighting', 'Kiosk'], terkunci: ['All Product'] },
  { k: 'piket-kebutuhan', judul: 'Kebutuhan tamu', menu: 'Piket Showroom',
    ket: 'Kebutuhan / solusi yang ditanyakan tamu demo.',
    bawaan: ['Meeting Room', 'Auditorium', 'Command Center', 'Digital Signage Kiosk', 'Digital Signage Custom', 'Paging System',
      'Background Music', 'Signage LED Outdoor', 'Smartclass Room', 'Ballroom', 'Camera ETLE', 'Conference Room',
      'Paperless System', 'Delegate System', 'Camera Tracking'] },
  { k: 'unit-event', judul: 'Event barang', menu: 'Unit Movement',
    ket: 'Keperluan barang masuk / keluar.',
    bawaan: ['Troubleshooting', 'R&D', 'Demo Product', 'Project', 'Service'] },
];

export const defDaftar = (k: KunciDaftar): DefDaftar => DAFTAR_PILIHAN.find(d => d.k === k)!;
export type SemuaDaftar = Record<KunciDaftar, string[]>;

export const bawaanSemua = (): SemuaDaftar =>
  Object.fromEntries(DAFTAR_PILIHAN.map(d => [d.k, [...d.bawaan]])) as SemuaDaftar;

export function rapikanDaftar(isi: unknown, d: DefDaftar): string[] {
  const terlihat = new Set<string>();
  const hasil: string[] = [];
  for (const x of Array.isArray(isi) ? isi : []) {
    if (typeof x !== 'string') continue;
    const v = x.trim().replace(/\s+/g, ' ').slice(0, MAKS_PANJANG);
    if (!v || terlihat.has(v.toLowerCase())) continue;
    terlihat.add(v.toLowerCase());
    hasil.push(v);
    if (hasil.length >= MAKS_ITEM) break;
  }
  if (!hasil.length) return [...d.bawaan];
  const hilang = (d.terkunci ?? []).filter(t => !terlihat.has(t.toLowerCase()));
  return [...hilang, ...hasil];
}

export function bacaDaftarPilihan(nilai: unknown): SemuaDaftar {
  let o: unknown = nilai;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const obj = (o && typeof o === 'object' && !Array.isArray(o) ? o : {}) as Record<string, unknown>;
  return Object.fromEntries(DAFTAR_PILIHAN.map(d => [d.k, d.k in obj ? rapikanDaftar(obj[d.k], d) : [...d.bawaan]])) as SemuaDaftar;
}

export function ringkasDaftarPilihan(semua: Partial<SemuaDaftar>): Partial<SemuaDaftar> {
  const hasil: Partial<SemuaDaftar> = {};
  for (const d of DAFTAR_PILIHAN) {
    const v = semua[d.k];
    if (!v) continue;
    const r = rapikanDaftar(v, d);
    if (r.join('\u0000') !== d.bawaan.join('\u0000')) hasil[d.k] = r;
  }
  return hasil;
}

export function denganNilai(daftar: string[], ...nilai: (string | null | undefined | string[])[]): string[] {
  const ada = new Set(daftar.map(x => x.toLowerCase()));
  const tambah: string[] = [];
  for (const v of nilai.flat()) {
    const t = (v ?? '').trim();
    if (t && !ada.has(t.toLowerCase())) { ada.add(t.toLowerCase()); tambah.push(t); }
  }
  return tambah.length ? [...daftar, ...tambah] : daftar;
}

export const produkSpesifik = (produk: string[]) => produk.filter(p => p !== 'All Product');
