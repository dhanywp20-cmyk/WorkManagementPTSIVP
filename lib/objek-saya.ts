/**
 * lib/objek-saya.ts - "Objek saya" Desain 3D: perpustakaan objek PRIBADI per akun (beda dengan "Produk saya"
 * yang dipakai bersama seluruh tim). Benda apa pun yang sudah diatur (ukuran, warna, teks, siluet objek
 * mapping, model 3D impor) bisa disimpan, dipakai lagi di desain lain, lalu diekspor ke berkas .json dan
 * diimpor oleh akun lain.
 *
 * Isi berkas impor bisa berasal dari siapa saja, jadi `atur` disaring ketat: hanya bidang Benda yang
 * dikenal, dengan tipe nilai yang benar; warna wajib #rrggbb; posisi & id dibuang. Murni - dipakai route
 * server (/api/tools-team/objek-saya) dan peramban (ekspor / impor). Diuji di uji/objek-saya.ts.
 */
import { bersihkanIsiRak } from '@/app/(portal)/tools-team/_components/desain3d/inti/rak';

export const FORMAT_OBJEK_SAYA = 'pts-objek-saya';
export const MAKS_OBJEK_PER_AKUN = 150;
export const MAKS_MODEL_PER_AKUN = 5;
/** Model 3D (GLB) sebagai data URL base64: ±1,5 MB berkas. Model lebih besar tetap bisa lewat .glb laptop. */
export const MAKS_BYTE_MODEL = 2_000_000;
/** Batas total model 3D di Objek saya SELURUH akun (byte data URL) - pengaman kuota basis data paket gratis. */
export const MAKS_TOTAL_MODEL = 100_000_000;
export const MAKS_BYTE_ATUR = 60_000;
export const MAKS_IMPOR_SEKALI = 50;

/** Jenis benda Desain 3D (sama dengan inti/tipe.ts Jenis - dijaga uji/objek-saya.ts). */
export const JENIS_OBJEK = ['videowall', 'led', 'layar', 'ifp', 'tv', 'meja', 'kursi', 'speaker', 'speaker-plafon', 'mic', 'touchpanel',
  'kamera', 'proyektor', 'rak', 'lift', 'model', 'tribun', 'panggung', 'bidang', 'lampu', 'objek', 'perangkat', 'teks'] as const;
export type JenisObjek = (typeof JENIS_OBJEK)[number];

type Tipe = 'angka' | 'bool' | 'teks' | 'warna' | 'angka3';
/** Bidang Benda yang boleh ikut (tanpa id, x, z, rot, modelKunci, konten gambar - semuanya milik desain, bukan objek). */
const BIDANG: Record<string, Tipe> = {
  nama: 'teks', w: 'angka', h: 'angka', d: 'angka', elev: 'angka', diag: 'angka', rasio: 'teks', pitch: 'angka', cabW: 'angka', cabH: 'angka',
  vw: 'teks', kol: 'angka', bar: 'angka', warna: 'warna', jangkauan: 'angka', sebaran: 'angka', sebaranV: 'angka', tipeSpeaker: 'teks',
  modul: 'angka', sudutModul: 'angka', tiltLA: 'angka', gantung: 'bool', tampilJangkauan: 'bool', trMin: 'angka', trMax: 'angka',
  baris: 'angka', kursiBaris: 'angka', tinggiAnak: 'angka', bentukBidang: 'teks', jariBidang: 'angka', busur: 'angka', offsetLensa: 'angka',
  geserLensaH: 'angka', warnaSinar: 'warna', lumen: 'angka', pasang: 'teks', rakU: 'angka', mic: 'teks', bentukMeja: 'teks', finish: 'teks',
  tipeKursi: 'teks', tipeKamera: 'teks', naik: 'bool', pasangProyektor: 'teks', throwRatio: 'angka', tilt: 'angka', konten: 'teks',
  sembunyiUkur: 'bool', sembunyiLabel: 'bool', monitorMeja: 'angka', tipeRak: 'teks', tipeLampu: 'teks', sudutLampu: 'angka', dimmer: 'angka',
  kelvin: 'angka', gantungLampu: 'angka', putarModel: 'angka', ukuranFile: 'angka3', satuanModel: 'teks', bentukObjek: 'teks',
  tipePerangkat: 'teks', pakaiDongle: 'bool', teks: 'teks', tinggiHuruf: 'angka', hadapTeks: 'teks', latarTeks: 'warna',
};
const POLA_PILIHAN = /^[a-z0-9:.\- ]{1,40}$/i;
const POLA_MODEL = /^data:model\/gltf-binary;base64,[A-Za-z0-9+/=]+$/;

/** `atur` yang aman dari isian mana pun: bidang dikenal & tipe benar; selain itu dibuang diam-diam. */
export function bersihkanAturObjek(x: unknown): Record<string, unknown> {
  const a = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const hasil: Record<string, unknown> = {};
  for (const [k, tipe] of Object.entries(BIDANG)) {
    const v = a[k];
    if (tipe === 'angka' && typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100_000) hasil[k] = v;
    else if (tipe === 'bool' && typeof v === 'boolean') hasil[k] = v;
    else if (tipe === 'warna' && typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) hasil[k] = v.toLowerCase();
    else if (tipe === 'angka3' && Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n))) hasil[k] = v;
    else if (tipe === 'teks' && typeof v === 'string') {
      //  Teks bebas (nama, isi teks) dipangkas; nilai pilihan (enum) harus berbentuk kode pendek.
      if (k === 'nama') { if (v.trim()) hasil[k] = v.trim().slice(0, 80); } else if (k === 'teks') hasil[k] = v.slice(0, 300);
      else if (POLA_PILIHAN.test(v)) hasil[k] = v;
    }
  }
  if (hasil.konten === 'gambar') delete hasil.konten;   // foto unggahan hanya ada di memori desain
  const isiRak = bersihkanIsiRak(a.isiRak);
  if (isiRak) hasil.isiRak = isiRak;
  const panel = a.panel as Record<string, unknown> | undefined;
  if (panel && typeof panel === 'object' && !Array.isArray(panel)) {
    const p: Record<string, number> = {};
    for (const [k, v] of Object.entries(panel)) if (/^[a-z]{1,12}$/i.test(k) && typeof v === 'number' && Number.isFinite(v)) p[k] = v;
    if (Object.keys(p).length) hasil.panel = p;
  }
  //  Siluet objek mapping: [{ l: number[], h?: number[][] }] dengan angka 0..1.
  if (Array.isArray(a.kontur)) {
    const n01 = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= -0.01 && v <= 1.01;
    const kontur = a.kontur.slice(0, 64).flatMap(b => {
      const o = b as { l?: unknown; h?: unknown };
      if (!Array.isArray(o?.l) || o.l.length > 8000 || !o.l.every(n01)) return [];
      const h = Array.isArray(o.h) ? o.h.filter(x => Array.isArray(x) && x.length <= 8000 && x.every(n01)).slice(0, 64) as number[][] : [];
      return [{ l: o.l as number[], h }];
    });
    if (kontur.length) hasil.kontur = kontur;
  }
  if (Array.isArray(a.kabelCustom)) {
    const kabel = a.kabelCustom.slice(0, 20).flatMap(k => {
      const o = k as { golongan?: unknown; jumlah?: unknown };
      return typeof o?.golongan === 'string' && POLA_PILIHAN.test(o.golongan) && typeof o.jumlah === 'number' && o.jumlah >= 0 && o.jumlah <= 50
        ? [{ golongan: o.golongan, jumlah: Math.round(o.jumlah) }] : [];
    });
    if (kabel.length) hasil.kabelCustom = kabel;
  }
  return hasil;
}

export interface IsiObjekSaya { nama: string; ket: string; jenis: JenisObjek; atur: Record<string, unknown>; model?: string }

/** Satu objek yang sah untuk disimpan, atau alasan penolakan. */
export function periksaObjekSaya(x: unknown): { ok: true; data: IsiObjekSaya } | { ok: false; alasan: string } {
  const d = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const nama = typeof d.nama === 'string' ? d.nama.trim().slice(0, 80) : '';
  if (!nama) return { ok: false, alasan: 'Nama objek wajib diisi.' };
  const jenis = d.jenis as JenisObjek;
  if (!JENIS_OBJEK.includes(jenis)) return { ok: false, alasan: `Jenis objek "${String(d.jenis)}" tidak dikenal.` };
  const atur = bersihkanAturObjek(d.atur);
  if (!(typeof atur.w === 'number' && typeof atur.h === 'number' && typeof atur.d === 'number')) return { ok: false, alasan: `Ukuran objek "${nama}" tidak sah.` };
  if (JSON.stringify(atur).length > MAKS_BYTE_ATUR) return { ok: false, alasan: `Data objek "${nama}" terlalu besar.` };
  const data: IsiObjekSaya = { nama, ket: typeof d.ket === 'string' ? d.ket.trim().slice(0, 120) : '', jenis, atur };
  if (d.model !== undefined && d.model !== null) {
    if (jenis !== 'model') return { ok: false, alasan: 'Berkas model hanya untuk objek model 3D.' };
    if (typeof d.model !== 'string' || !POLA_MODEL.test(d.model)) return { ok: false, alasan: `Model 3D "${nama}" tidak sah.` };
    if (d.model.length > MAKS_BYTE_MODEL) return { ok: false, alasan: `Model 3D "${nama}" terlalu besar untuk Objek saya (maks ±1,5 MB) - simpan lewat .glb laptop.` };
    data.model = d.model;
  }
  if (jenis === 'model' && !data.model) return { ok: false, alasan: `Model 3D "${nama}" tidak membawa berkas modelnya.` };
  return { ok: true, data };
}

export interface BerkasObjekSaya { format: typeof FORMAT_OBJEK_SAYA; versi: 1; diekspor: string; oleh?: string; objek: IsiObjekSaya[] }

export function berkasObjekSaya(objek: IsiObjekSaya[], oleh?: string): BerkasObjekSaya {
  return { format: FORMAT_OBJEK_SAYA, versi: 1, diekspor: new Date().toISOString(), ...(oleh ? { oleh } : {}), objek };
}

/** Isi berkas ekspor: objek-objek yang sah + daftar penolakan (per objek, tidak menggagalkan yang lain). */
export function bacaBerkasObjekSaya(json: unknown): { ok: true; objek: IsiObjekSaya[]; ditolak: string[] } | { ok: false; alasan: string } {
  const b = json as Partial<BerkasObjekSaya> | null;
  if (!b || typeof b !== 'object' || b.format !== FORMAT_OBJEK_SAYA || !Array.isArray(b.objek)) {
    return { ok: false, alasan: 'Berkas ini bukan ekspor Objek saya dari Tools Team.' };
  }
  if (b.objek.length > MAKS_IMPOR_SEKALI) return { ok: false, alasan: `Maksimal ${MAKS_IMPOR_SEKALI} objek per impor.` };
  const objek: IsiObjekSaya[] = [], ditolak: string[] = [];
  for (const o of b.objek) { const c = periksaObjekSaya(o); if (c.ok) objek.push(c.data); else ditolak.push(c.alasan); }
  return { ok: true, objek, ditolak };
}
