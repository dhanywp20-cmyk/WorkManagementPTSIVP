export type Edisi = 'lite' | 'pro';

export interface KlaimLisensi {
  v: 1;
  id: string;
  pelanggan: string;
  edisi: Edisi;
  domain: string[];
  terbit: string;
  kedaluwarsa: string | null;
  pemilik?: boolean;
  demo?: boolean;
}

export type AlasanLisensi = 'tidak-ada' | 'format' | 'tanda-tangan' | 'domain' | 'kedaluwarsa' | 'kunci-publik';

export interface StatusLisensi {
  sah: boolean;
  edisi: Edisi | null;
  pemilik: boolean;
  pelanggan: string | null;
  id: string | null;
  domain: string[];
  kedaluwarsa: string | null;
  sisaHari: number | null;
  alasan: AlasanLisensi | null;
  pengembangan: boolean;
  demo: boolean;
}

export const AWALAN_KUNCI = 'WM1';
export const MENU_PRO = ['tools-team', 'learning-center', 'incentive-pts'];
export const MENU_PEMILIK = ['database-pts'];
export const HARI_PERINGATAN = 14;

const JALUR_PRO = [
  '/tools-team', '/learning-center', '/incentive-pts', '/kelas',
  '/api/tools-team', '/api/learning-center', '/api/incentive', '/api/kelas', '/api/admin/kelas-eksternal',
];

export const LABEL_ALASAN: Record<AlasanLisensi, string> = {
  'tidak-ada': 'Kunci lisensi belum dipasang',
  format: 'Kunci lisensi rusak atau terpotong',
  'tanda-tangan': 'Kunci lisensi tidak sah',
  domain: 'Kunci lisensi bukan untuk alamat server ini',
  kedaluwarsa: 'Masa lisensi sudah habis',
  'kunci-publik': 'Platform belum dipasangi kunci publik lisensi',
};

export const jalurPro = (path: string) => JALUR_PRO.some(p => path === p || path.startsWith(`${p}/`));

export function menuBoleh(kunci: string, s: Pick<StatusLisensi, 'sah' | 'edisi' | 'pemilik'> | null): boolean {
  if (MENU_PEMILIK.includes(kunci)) return !!s?.sah && s.pemilik;
  if (!s) return true;
  if (!s.sah) return false;
  return MENU_PRO.includes(kunci) ? s.edisi === 'pro' : true;
}

const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dariB64url = (s: string) => new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

export function pesanKunci(klaim: KlaimLisensi): string {
  return `${AWALAN_KUNCI}.${b64url(new TextEncoder().encode(JSON.stringify(klaim)))}`;
}

export const susunKunci = (pesan: string, tanda: Uint8Array) => `${pesan}.${b64url(tanda)}`;

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_DOMAIN = /^[a-z0-9*.-]{1,253}$/;

export function klaimSah(x: unknown): x is KlaimLisensi {
  const k = x as Partial<KlaimLisensi> | null;
  return !!k && k.v === 1 && typeof k.id === 'string' && k.id.length > 0 && typeof k.pelanggan === 'string' && k.pelanggan.trim().length > 0
    && (k.edisi === 'lite' || k.edisi === 'pro') && Array.isArray(k.domain) && k.domain.every(d => typeof d === 'string' && POLA_DOMAIN.test(d))
    && typeof k.terbit === 'string' && (k.kedaluwarsa === null || (typeof k.kedaluwarsa === 'string' && TANGGAL.test(k.kedaluwarsa)))
    && (k.pemilik === undefined || typeof k.pemilik === 'boolean') && (k.demo === undefined || typeof k.demo === 'boolean');
}

export function uraiKunci(teks: string): { klaim: KlaimLisensi; pesan: string; tanda: Uint8Array } | null {
  const bagian = teks.trim().split('.');
  if (bagian.length !== 3 || bagian[0] !== AWALAN_KUNCI) return null;
  try {
    const klaim: unknown = JSON.parse(new TextDecoder().decode(dariB64url(bagian[1])));
    if (!klaimSah(klaim)) return null;
    return { klaim, pesan: `${bagian[0]}.${bagian[1]}`, tanda: dariB64url(bagian[2]) };
  } catch {
    return null;
  }
}

export function hostTanpaPort(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

export function cocokDomain(host: string, pola: string): boolean {
  const h = hostTanpaPort(host), p = pola.trim().toLowerCase();
  if (!p.includes('*')) return h === p;
  const re = new RegExp(`^${p.split('*').map(x => x.replace(/[.+?^${}()|[\]\\-]/g, '\\$&')).join('[a-z0-9-]+')}$`);
  return re.test(h);
}

const AKHIR_HARI_WIB = 'T23:59:59+07:00';

export function sisaHariLisensi(kedaluwarsa: string | null, sekarang: number): number | null {
  if (!kedaluwarsa) return null;
  return Math.ceil((Date.parse(`${kedaluwarsa}${AKHIR_HARI_WIB}`) - sekarang) / 86_400_000);
}

export function nilaiKlaim(klaim: KlaimLisensi, host: string, sekarang: number): StatusLisensi {
  const dasar: StatusLisensi = {
    sah: false, edisi: klaim.edisi, pemilik: !!klaim.pemilik, pelanggan: klaim.pelanggan, id: klaim.id, domain: klaim.domain,
    kedaluwarsa: klaim.kedaluwarsa, sisaHari: sisaHariLisensi(klaim.kedaluwarsa, sekarang), alasan: null, pengembangan: false, demo: !!klaim.demo,
  };
  if (klaim.domain.length && !klaim.domain.some(d => cocokDomain(host, d))) return { ...dasar, alasan: 'domain' };
  if (dasar.sisaHari !== null && Date.parse(`${klaim.kedaluwarsa}${AKHIR_HARI_WIB}`) < sekarang) return { ...dasar, alasan: 'kedaluwarsa' };
  return { ...dasar, sah: true };
}

export const statusKosong = (alasan: AlasanLisensi): StatusLisensi => ({
  sah: false, edisi: null, pemilik: false, pelanggan: null, id: null, domain: [], kedaluwarsa: null, sisaHari: null, alasan, pengembangan: false, demo: false,
});

export const statusPengembangan = (): StatusLisensi => ({
  sah: true, edisi: 'pro', pemilik: false, pelanggan: 'Mode pengembangan', id: null, domain: [], kedaluwarsa: null, sisaHari: null, alasan: null, pengembangan: true, demo: false,
});

export const statusServerPemilik = (): StatusLisensi => ({
  sah: true, edisi: 'pro', pemilik: true, pelanggan: 'Server pemilik', id: null, domain: [], kedaluwarsa: null, sisaHari: null, alasan: null, pengembangan: false, demo: false,
});

export interface IsianTerbit { pelanggan: string; edisi: Edisi; domain: string[]; kedaluwarsa: string | null; pemilik?: boolean; demo?: boolean }

export function periksaIsianTerbit(x: unknown, hariIni: string): { ok: true; isian: IsianTerbit } | { ok: false; galat: string } {
  const a = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const pelanggan = typeof a.pelanggan === 'string' ? a.pelanggan.trim().slice(0, 80) : '';
  if (pelanggan.length < 2) return { ok: false, galat: 'Nama pelanggan minimal 2 huruf.' };
  if (a.edisi !== 'lite' && a.edisi !== 'pro') return { ok: false, galat: 'Pilih edisi Lite atau Pro.' };
  const domain = (Array.isArray(a.domain) ? a.domain : []).map(d => String(d).trim().toLowerCase()).filter(Boolean);
  if (domain.length > 10) return { ok: false, galat: 'Maksimal 10 domain.' };
  const salah = domain.find(d => !POLA_DOMAIN.test(d) || d.startsWith('http') || d.includes('/'));
  if (salah) return { ok: false, galat: `Domain tidak valid: ${salah}. Tulis tanpa http:// dan tanpa garis miring.` };
  const kedaluwarsa = typeof a.kedaluwarsa === 'string' && a.kedaluwarsa ? a.kedaluwarsa : null;
  if (kedaluwarsa && (!TANGGAL.test(kedaluwarsa) || kedaluwarsa < hariIni)) return { ok: false, galat: 'Tanggal kedaluwarsa harus hari ini atau sesudahnya.' };
  if (a.demo === true && !kedaluwarsa) return { ok: false, galat: 'Lisensi demo wajib punya tanggal berakhir.' };
  return { ok: true, isian: { pelanggan, edisi: a.edisi, domain, kedaluwarsa, ...(a.pemilik === true ? { pemilik: true } : {}), ...(a.demo === true ? { demo: true } : {}) } };
}
