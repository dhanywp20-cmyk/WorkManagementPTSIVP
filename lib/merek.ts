import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from './supabase';
import { type Merek, MEREK_BAWAAN, FIELD_LOGIN, KUNCI_MEREK, KUNCI_DIVISI } from './merek-bawaan';
export { type Merek, MEREK_BAWAAN, FIELD_LOGIN, KUNCI_MEREK, KUNCI_DIVISI };

export const DIVISI_BAWAAN: string[] = [
  'IVP', 'MVI', 'MLDS', 'HAVS', 'Enterprise', 'DEC', 'ICS', 'POJ', 'VOJ', 'LOCOS',
  'VISIONMEDIA', 'UMP', 'BISOL', 'KIMS', 'IDC', 'IOCMEDAN', 'IOCPekanbaru',
  'IOCBandung', 'IOCJATENG', 'IOCSEMARANG', 'POSSurabaya', 'IOCSurabaya',
  'IOCBali', 'SGP', 'SGP 1', 'SGP 2', 'OSS',
];

const SIMPAN_MEREK = 'ivp_merek';
const SIMPAN_DIVISI = 'ivp_divisi';

function bacaSimpanan<T>(kunci: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const mentah = window.sessionStorage.getItem(kunci);
    return mentah ? (JSON.parse(mentah) as T) : null;
  } catch { return null; }
}

function tulisSimpanan(kunci: string, nilai: unknown): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(kunci, JSON.stringify(nilai)); } catch {  }
}

let merekSekarang: Merek = { ...MEREK_BAWAAN, ...(bacaSimpanan<Partial<Merek>>(SIMPAN_MEREK) ?? {}) };
if (typeof document !== 'undefined') {
  queueMicrotask(() => tulisWarnaKeCSS());
}
let divisiSekarang: string[] = bacaSimpanan<string[]>(SIMPAN_DIVISI) ?? DIVISI_BAWAAN;
if (typeof window !== 'undefined' && bacaSimpanan(SIMPAN_MEREK) === null) {
  queueMicrotask(() => { void muatMerek(); });
}

export function merek(): Merek { return merekSekarang; }

export function divisiSales(): string[] { return divisiSekarang; }

function uraikan(nilai: unknown): unknown {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  if (typeof nilai === 'object') return nilai;
  if (typeof nilai !== 'string') return null;
  try { return JSON.parse(nilai); } catch { return null; }
}

let pemuatan: Promise<void> | null = null;

export function muatMerek(): Promise<void> {
  if (pemuatan) return pemuatan;
  pemuatan = (async () => {
    try {
      const { data } = await supabase
        .from('app_settings').select('key, value')
        .in('key', [KUNCI_MEREK, KUNCI_DIVISI]);
      for (const baris of (data ?? []) as { key: string; value: unknown }[]) {
        const isi = uraikan(baris.value);
        if (isi === null) continue;
        if (baris.key === KUNCI_MEREK) {
          merekSekarang = { ...MEREK_BAWAAN, ...bersihkanMerek(isi as Partial<Merek>) };
          tulisSimpanan(SIMPAN_MEREK, merekSekarang);
          tulisWarnaKeCSS();
          beriTahuPendengar();
        } else if (baris.key === KUNCI_DIVISI) {
          const bersih = rapikanDivisi(isi);
          if (bersih.length > 0) {
            divisiSekarang = bersih;
            tulisSimpanan(SIMPAN_DIVISI, bersih);
            beriTahuPendengar();
          }
        }
      }
    } catch {  }
  })();
  return pemuatan;
}

export function muatUlangMerek(): Promise<void> { pemuatan = null; return muatMerek(); }

function bersihkanMerek(isi: Partial<Merek>): Partial<Merek> {
  const hasil: Partial<Merek> = {};
  for (const kunci of Object.keys(MEREK_BAWAAN) as (keyof Merek)[]) {
    const nilai = isi[kunci];
    if (typeof nilai === 'string' && nilai.trim() !== '') hasil[kunci] = nilai.trim();
  }
  return hasil;
}

export function warnaTembus(hex: string, alfa: number): string {
  const cocok = /^#([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!cocok) return hex;
  const n = parseInt(cocok[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

export function angkaTembus(nilai: string, bawaan: number): number {
  const n = Number.parseFloat(nilai);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : bawaan;
}

export function latarDasbor(m: Merek): CSSProperties {
  return m.latarDasbor === 'gambar'
    ? { backgroundImage: `url(${m.gambarLatarDasbor})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'var(--halaman)' };
}

export function gradasiPanelLogin(m: Merek): string {
  const a = angkaTembus(m.tembusLogin, 0.84);
  return `linear-gradient(135deg, ${warnaTembus(m.warnaLogin, Math.min(1, a - 0.02))}, ${warnaTembus(m.warnaLogin2, Math.min(1, a + 0.02))})`;
}

export function rapikanDivisi(isi: unknown): string[] {
  if (!Array.isArray(isi)) return [];
  const terlihat = new Set<string>();
  const hasil: string[] = [];
  for (const x of isi) {
    if (typeof x !== 'string') continue;
    const nilai = x.trim();
    if (!nilai) continue;
    const kunci = nilai.toLowerCase();
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    hasil.push(nilai);
  }
  return hasil;
}

export async function simpanMerek(baru: Merek): Promise<{ error: string | null }> {
  const ringkas: Partial<Merek> = {};
  for (const kunci of Object.keys(MEREK_BAWAAN) as (keyof Merek)[]) {
    const nilai = (baru[kunci] ?? '').trim();
    if (nilai && nilai !== MEREK_BAWAAN[kunci]) ringkas[kunci] = nilai;
  }
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_MEREK, value: JSON.stringify(ringkas) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  merekSekarang = { ...MEREK_BAWAAN, ...ringkas };
  tulisSimpanan(SIMPAN_MEREK, merekSekarang);
  tulisWarnaKeCSS();
  beriTahuPendengar();
  return { error: null };
}

export async function simpanDivisi(baru: string[]): Promise<{ error: string | null }> {
  const bersih = rapikanDivisi(baru);
  if (bersih.length === 0) return { error: 'Daftar divisi tidak boleh kosong.' };
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_DIVISI, value: JSON.stringify(bersih) }, { onConflict: 'key' });
  if (error) return { error: error.message };
  divisiSekarang = bersih;
  tulisSimpanan(SIMPAN_DIVISI, bersih);
  beriTahuPendengar();
  return { error: null };
}

export async function divisiTerpakai(): Promise<Record<string, number>> {
  const { data } = await supabase.from('users').select('sales_division');
  const hitung: Record<string, number> = {};
  for (const b of (data ?? []) as { sales_division: string | null }[]) {
    const d = (b.sales_division ?? '').trim();
    if (d) hitung[d] = (hitung[d] ?? 0) + 1;
  }
  return hitung;
}

const BUCKET_MEREK = 'merek-files';
const BUCKET_CADANGAN = 'project-files';

const BATAS_LOGO = 2 * 1024 * 1024;
const BATAS_LATAR = 8 * 1024 * 1024;

export async function unggahBerkasMerek(
  berkas: File,
  jenis: 'logo' | 'latar' | 'latarDasbor',
): Promise<{ url: string | null; error: string | null }> {
  if (!berkas.type.startsWith('image/')) {
    return { url: null, error: 'Berkasnya harus gambar (PNG, JPG, SVG, atau WebP).' };
  }
  const batas = jenis === 'logo' ? BATAS_LOGO : BATAS_LATAR;
  if (berkas.size > batas) {
    return { url: null, error: `Ukurannya ${(berkas.size / 1048576).toFixed(1)}MB, batasnya ${batas / 1048576}MB.` };
  }

  let siap = berkas;
  if (jenis === 'latar' || jenis === 'latarDasbor') {
    try {
      const { compressImage } = await import('./image-compress');
      siap = await compressImage(berkas, { maxDim: 2400, quality: 0.82 });
    } catch {  }
  }

  const ext = (siap.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const nama = `merek/${jenis}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  for (const bucket of [BUCKET_MEREK, BUCKET_CADANGAN]) {
    const { error } = await supabase.storage.from(bucket)
      .upload(nama, siap, { cacheControl: '31536000', upsert: false, contentType: siap.type });
    if (!error) {
      return { url: supabase.storage.from(bucket).getPublicUrl(nama).data.publicUrl, error: null };
    }
    const pesan = (error.message || '').toLowerCase();
    if (!pesan.includes('not found') && !pesan.includes('bucket')) {
      return { url: null, error: error.message };
    }
  }
  return { url: null, error: 'Tidak ada bucket penyimpanan yang bisa dipakai. Jalankan sql/pengaturan-merek.sql.' };
}

export function tulisWarnaKeCSS(m: Merek = merekSekarang): void {
  if (typeof document === 'undefined') return;
  const akar = document.documentElement;
  akar.style.setProperty('--merek-utama', m.warnaUtama);
  akar.style.setProperty('--merek-utama-2', m.warnaUtama2);
  akar.style.setProperty('--merek-aksen', m.warnaAksen);
  akar.style.setProperty('--merek-utama-tembus', warnaTembus(m.warnaUtama, 0.1));
  if (m.latarDasbor === 'gambar' && m.gambarLatarDasbor) {
    akar.style.setProperty('--latar-halaman',
      `var(--halaman) url("${m.gambarLatarDasbor.replace(/"/g, '%22')}") center / cover no-repeat fixed`);
  } else {
    akar.style.removeProperty('--latar-halaman');
  }
}

const pendengar = new Set<() => void>();

function beriTahuPendengar(): void { for (const f of pendengar) f(); }

function usePengaturan<T>(ambil: () => T): T {
  const [nilai, setNilai] = useState<T>(ambil);
  useEffect(() => {
    const segarkan = () => setNilai(ambil());
    pendengar.add(segarkan);
    void muatMerek().then(segarkan);
    return () => { pendengar.delete(segarkan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return nilai;
}

export function useMerek(): Merek { return usePengaturan(merek); }

export function useDivisiSales(): string[] { return usePengaturan(divisiSales); }
