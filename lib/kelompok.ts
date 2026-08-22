/**
 * lib/kelompok.ts - daftar KELOMPOK kerja beserta hak loncengnya, dan lingkup
 * kelompok yang dibawahi tiap Manager. Semuanya dari database, bukan kode.
 *
 * Yang dulu terpaku di kode dan hanya bisa diubah lewat deploy:
 *
 *   1. Nama kelompok. 'Team PTS IVP' / 'Team PTS MVI' / 'Team PTS UMP'
 *      tertulis langsung di dua puluhan berkas. Menambah satu kelompok PTS
 *      baru berarti menyunting semuanya - dan yang terlewat akan membuat
 *      kelompok itu tidak muncul di sebagian menu, tanpa pesan apa pun.
 *
 *   2. Siapa yang berhak melihat lonceng notifikasi mana. Dulu berupa deretan
 *      syarat di modal-notifikasi.tsx yang menyebut nama kelompok satu per
 *      satu. Persis itulah sebabnya Team PTS MVI tidak pernah dapat lonceng
 *      Ticket, Require, dan Review: namanya memang tidak pernah disebut.
 *
 *   3. Kelompok mana saja yang dibawahi seorang Manager. Sebelumnya tidak ada
 *      sama sekali - akun ber-Full Access melihat SELURUH pekerjaan PTS,
 *      termasuk kelompok yang bukan tanggung jawabnya.
 *
 * Ketiganya sekarang tersimpan di `app_settings` dan disunting dari Admin
 * Panel. NILAI BAWAAN DI BAWAH MENIRU PERSIS perilaku yang berlaku sekarang,
 * jadi selama pengaturannya belum ada, tidak ada satu pun akun yang berubah
 * haknya.
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Lonceng

/** Lonceng notifikasi di pojok kanan atas dashboard. */
export const SEMUA_LONCENG = ['tiket', 'require', 'jadwal', 'review'] as const;
export type Lonceng = typeof SEMUA_LONCENG[number];

export const LABEL_LONCENG: Record<Lonceng, { ikon: string; label: string }> = {
  tiket:   { ikon: '🎫', label: 'Ticket' },
  require: { ikon: '🏗️', label: 'Require' },
  jadwal:  { ikon: '🗓️', label: 'Reminder' },
  review:  { ikon: '⭐', label: 'Review' },
};

// Kelompok

export type JenisKelompok = 'pts' | 'services' | 'marketing' | 'sales';

export interface Kelompok {
  /**
   * Nilai `users.team_type` yang menandai kelompok ini. Untuk Sales dipakai
   * string kosong: akun Sales memang tidak punya team_type, dan memaksakan
   * nilai palsu ke sana akan merusak penyaringan yang sudah ada.
   */
  nama: string;
  /** Nama yang ditampilkan, mis. 'PTS IVP'. */
  label: string;
  jenis: JenisKelompok;
  /**
   * Ikut daftar "assign ke tim" di Ticketing, Request Schedule, dan Request
   * Design Project. Team PTS UMP sengaja tidak - pekerjaannya di Piket
   * Showroom, yang punya daftar tim sendiri.
   */
  ditugaskan: boolean;
  /** Lonceng yang boleh dilihat anggota kelompok ini. */
  lonceng: Lonceng[];
  aktif: boolean;
}

const EMPAT: Lonceng[] = ['tiket', 'require', 'jadwal', 'review'];

/**
 * Bawaan - MENIRU PERSIS syarat yang sebelumnya tertulis di
 * modal-notifikasi.tsx, bukan menebak apa yang "sebaiknya":
 *
 *   Ticket & Require : semua, KECUALI Team PTS UMP
 *   Reminder         : semua tanpa kecuali
 *   Review           : semua, KECUALI Team PTS UMP dan Team Services
 *
 * Menyimpangkan salah satunya di sini berarti diam-diam mengubah hak orang
 * yang sedang bekerja.
 */
export const KELOMPOK_BAWAAN: Kelompok[] = [
  { nama: 'Team PTS IVP', label: 'PTS IVP',   jenis: 'pts',       ditugaskan: true,  aktif: true, lonceng: EMPAT },
  { nama: 'Team PTS MVI', label: 'PTS MVI',   jenis: 'pts',       ditugaskan: true,  aktif: true, lonceng: EMPAT },
  { nama: 'Team PTS UMP', label: 'PTS UMP',   jenis: 'pts',       ditugaskan: false, aktif: true, lonceng: ['jadwal'] },
  { nama: 'Team Services', label: 'Services', jenis: 'services',  ditugaskan: false, aktif: true, lonceng: ['tiket', 'require', 'jadwal'] },
  { nama: 'Marketing',    label: 'Marketing', jenis: 'marketing', ditugaskan: false, aktif: true, lonceng: EMPAT },
  { nama: '',             label: 'Sales',     jenis: 'sales',     ditugaskan: false, aktif: true, lonceng: EMPAT },
];

export const KUNCI_KELOMPOK = 'kelompok';
export const KUNCI_LINGKUP_MANAGER = 'lingkup_manager';

/**
 * Kelompok mana saja yang dibawahi seorang Manager, dikunci id akun.
 *
 * Daftar KOSONG atau akun yang tidak terdaftar berarti TANPA BATAS - persis
 * seperti sekarang. Ini disengaja: memberi arti "tidak melihat apa-apa" pada
 * ketiadaan pengaturan akan mengunci semua Manager keluar pada detik fitur ini
 * menyala, sebelum satu pun pemetaan sempat dibuat.
 */
export type LingkupManager = Record<string, string[]>;

// Simpanan

const SIMPAN_KELOMPOK = 'ivp_kelompok';
const SIMPAN_LINGKUP = 'ivp_lingkup_manager';

function bacaSimpanan<T>(kunci: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const mentah = window.sessionStorage.getItem(kunci);
    return mentah ? (JSON.parse(mentah) as T) : null;
  } catch { return null; }
}

function tulisSimpanan(kunci: string, nilai: unknown): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(kunci, JSON.stringify(nilai)); } catch { /* kuota penuh */ }
}

let kelompokSekarang: Kelompok[] = bacaSimpanan<Kelompok[]>(SIMPAN_KELOMPOK) ?? KELOMPOK_BAWAAN;
let lingkupSekarang: LingkupManager = bacaSimpanan<LingkupManager>(SIMPAN_LINGKUP) ?? {};

/** Seluruh kelompok yang aktif. */
export function semuaKelompok(): Kelompok[] { return kelompokSekarang.filter(k => k.aktif); }

/** Kelompok PTS yang aktif - dipakai daftar tim, KPI, dan Piket Showroom. */
export function kelompokPTS(): Kelompok[] { return semuaKelompok().filter(k => k.jenis === 'pts'); }

/** Nama team_type kelompok PTS yang aktif. */
export function namaKelompokPTS(): string[] { return kelompokPTS().map(k => k.nama); }

/** Kelompok yang ikut daftar "assign ke tim". */
export function kelompokDitugaskan(): Kelompok[] { return semuaKelompok().filter(k => k.ditugaskan); }

/** Cari kelompok dari nilai team_type. Sales dikenali lewat string kosong. */
export function cariKelompok(teamType?: string | null): Kelompok | null {
  const t = (teamType ?? '').trim();
  return kelompokSekarang.find(k => k.nama === t) ?? null;
}

/** Lingkup kelompok yang dibawahi tiap Manager. */
export function lingkupManager(): LingkupManager { return lingkupSekarang; }

/**
 * Kelompok yang boleh dilihat satu akun.
 *
 * Akun tanpa pemetaan mendapat SELURUH kelompok PTS - keadaan sekarang. Yang
 * sudah dipetakan hanya mendapat kelompok yang benar-benar dibawahinya, supaya
 * pekerjaan kelompok lain tidak ikut terbaca.
 */
export function lingkupSaya(userId?: string | null): string[] {
  const dipetakan = userId ? lingkupSekarang[userId] : undefined;
  if (!dipetakan || dipetakan.length === 0) return namaKelompokPTS();
  // Kelompok yang sudah dihapus dari daftar tidak ikut dikembalikan.
  const hidup = new Set(namaKelompokPTS());
  const hasil = dipetakan.filter(n => hidup.has(n));
  return hasil.length > 0 ? hasil : namaKelompokPTS();
}

/** Apakah akun ini boleh menyentuh pekerjaan kelompok tertentu. */
export function bolehLihatKelompok(userId: string | null | undefined, teamType?: string | null): boolean {
  const t = (teamType ?? '').trim();
  if (!t) return true;
  return lingkupSaya(userId).includes(t);
}

/**
 * Apakah lonceng ini tampil untuk akun tersebut.
 *
 * Admin melihat semuanya - hak itu memang tidak bergantung kelompok. Selain
 * itu, jawabannya diambil dari kelompok si akun; kelompok yang tidak dikenal
 * (data lama, team_type yang belum didaftarkan) mendapat semua lonceng, sama
 * seperti sebelum pengaturan ini ada.
 */
export function loncengTampil(opts: {
  peranAdmin: boolean;
  teamType?: string | null;
  lonceng: Lonceng;
}): boolean {
  if (opts.peranAdmin) return true;
  const k = cariKelompok(opts.teamType);
  if (!k) return true;
  return k.lonceng.includes(opts.lonceng);
}

// Pemuatan

let pemuatan: Promise<void> | null = null;
const pendengar = new Set<() => void>();
function beriTahu(): void { for (const f of pendengar) f(); }

function uraikan(nilai: unknown): unknown {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  if (typeof nilai === 'object') return nilai;
  if (typeof nilai !== 'string') return null;
  try { return JSON.parse(nilai); } catch { return null; }
}

/** Bersihkan satu kelompok dari data yang tidak dikenal. */
function rapikanKelompok(x: unknown): Kelompok | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.nama !== 'string') return null;
  const jenis = o.jenis as JenisKelompok;
  const lonceng = Array.isArray(o.lonceng)
    ? (o.lonceng.filter(l => (SEMUA_LONCENG as readonly string[]).includes(l as string)) as Lonceng[])
    : [];
  return {
    nama: o.nama.trim(),
    label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : (o.nama.trim() || 'Sales'),
    jenis: (['pts', 'services', 'marketing', 'sales'] as string[]).includes(jenis) ? jenis : 'pts',
    ditugaskan: o.ditugaskan === true,
    lonceng,
    aktif: o.aktif !== false,
  };
}

export function rapikanDaftarKelompok(isi: unknown): Kelompok[] {
  if (!Array.isArray(isi)) return [];
  const terlihat = new Set<string>();
  const hasil: Kelompok[] = [];
  for (const x of isi) {
    const k = rapikanKelompok(x);
    if (!k) continue;
    if (terlihat.has(k.nama)) continue;
    terlihat.add(k.nama);
    hasil.push(k);
  }
  return hasil;
}

export function muatKelompok(): Promise<void> {
  if (pemuatan) return pemuatan;
  pemuatan = (async () => {
    try {
      const { data } = await supabase.from('app_settings').select('key, value')
        .in('key', [KUNCI_KELOMPOK, KUNCI_LINGKUP_MANAGER]);
      for (const baris of (data ?? []) as { key: string; value: unknown }[]) {
        const isi = uraikan(baris.value);
        if (isi === null) continue;
        if (baris.key === KUNCI_KELOMPOK) {
          const bersih = rapikanDaftarKelompok(isi);
          // Daftar kosong ditolak: satu kesalahan simpan tidak boleh membuat
          // SELURUH platform kehilangan daftar timnya.
          if (bersih.length > 0) {
            kelompokSekarang = bersih;
            tulisSimpanan(SIMPAN_KELOMPOK, bersih);
            beriTahu();
          }
        } else if (baris.key === KUNCI_LINGKUP_MANAGER && typeof isi === 'object') {
          const bersih: LingkupManager = {};
          for (const [id, daftar] of Object.entries(isi as Record<string, unknown>)) {
            if (Array.isArray(daftar)) bersih[id] = daftar.filter(d => typeof d === 'string') as string[];
          }
          lingkupSekarang = bersih;
          tulisSimpanan(SIMPAN_LINGKUP, bersih);
          beriTahu();
        }
      }
    } catch { /* pertahankan nilai yang sedang berlaku */ }
  })();
  return pemuatan;
}

export function muatUlangKelompok(): Promise<void> { pemuatan = null; return muatKelompok(); }

// Penyimpanan

export async function simpanKelompok(baru: Kelompok[]): Promise<{ error: string | null }> {
  const bersih = rapikanDaftarKelompok(baru);
  if (bersih.length === 0) return { error: 'Daftar kelompok tidak boleh kosong.' };
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_KELOMPOK, value: JSON.stringify(bersih) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  kelompokSekarang = bersih;
  tulisSimpanan(SIMPAN_KELOMPOK, bersih);
  beriTahu();
  return { error: null };
}

export async function simpanLingkupManager(baru: LingkupManager): Promise<{ error: string | null }> {
  // Pemetaan kosong dibuang, bukan disimpan sebagai larik kosong: keduanya
  // sama artinya (tanpa batas), dan menyimpan yang kosong hanya menumpuk
  // baris yang tidak berarti.
  const bersih: LingkupManager = {};
  for (const [id, daftar] of Object.entries(baru)) {
    const d = (daftar ?? []).filter(Boolean);
    if (d.length > 0) bersih[id] = d;
  }
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_LINGKUP_MANAGER, value: JSON.stringify(bersih) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  lingkupSekarang = bersih;
  tulisSimpanan(SIMPAN_LINGKUP, bersih);
  beriTahu();
  return { error: null };
}

/** Berapa akun yang memakai tiap team_type - dipakai sebelum menghapus kelompok. */
export async function kelompokTerpakai(): Promise<Record<string, number>> {
  const { data } = await supabase.from('users').select('team_type');
  const hitung: Record<string, number> = {};
  for (const b of (data ?? []) as { team_type: string | null }[]) {
    const t = (b.team_type ?? '').trim();
    hitung[t] = (hitung[t] ?? 0) + 1;
  }
  return hitung;
}

// Jembatan React

function pakai<T>(ambil: () => T): T {
  const [nilai, setNilai] = useState<T>(ambil);
  useEffect(() => {
    const segarkan = () => setNilai(ambil());
    pendengar.add(segarkan);
    void muatKelompok().then(segarkan);
    return () => { pendengar.delete(segarkan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return nilai;
}

export function useKelompok(): Kelompok[] { return pakai(semuaKelompok); }
export function useKelompokPTS(): Kelompok[] { return pakai(kelompokPTS); }
export function useLingkupManager(): LingkupManager { return pakai(lingkupManager); }
