import { supabase } from '../supabase';

export const SEMUA_LONCENG = ['tiket', 'require', 'jadwal', 'review'] as const;
export type Lonceng = typeof SEMUA_LONCENG[number];

export const LABEL_LONCENG: Record<Lonceng, { ikon: string; label: string }> = {
  tiket:   { ikon: '🎫', label: 'Ticket' },
  require: { ikon: '🏗️', label: 'Require' },
  jadwal:  { ikon: '🗓️', label: 'Reminder' },
  review:  { ikon: '⭐', label: 'Review' },
};

export type JenisKelompok = 'pts' | 'services' | 'marketing' | 'sales';

export interface Kelompok {
  nama: string;
  label: string;
  jenis: JenisKelompok;
  ditugaskan: boolean;
  cabang: boolean;
  dashboard: 'team' | 'sales';
  lonceng: Lonceng[];
  aktif: boolean;
}

const EMPAT: Lonceng[] = ['tiket', 'require', 'jadwal', 'review'];

export const KELOMPOK_BAWAAN: Kelompok[] = [
  { nama: 'Team PTS IVP', label: 'PTS IVP',   jenis: 'pts',       ditugaskan: true,  cabang: false, dashboard: 'team', aktif: true, lonceng: EMPAT },
  { nama: 'Team PTS MVI', label: 'PTS MVI',   jenis: 'pts',       ditugaskan: true,  cabang: false, dashboard: 'team', aktif: true, lonceng: EMPAT },
  { nama: 'Team PTS UMP', label: 'PTS UMP',   jenis: 'pts',       ditugaskan: false, cabang: false, dashboard: 'team', aktif: true, lonceng: ['jadwal'] },
  { nama: 'Team Services', label: 'Services', jenis: 'services',  ditugaskan: false, cabang: false, dashboard: 'team', aktif: true, lonceng: ['tiket', 'require', 'jadwal'] },
  { nama: 'Marketing',    label: 'Marketing', jenis: 'marketing', ditugaskan: false, cabang: false, dashboard: 'team', aktif: true, lonceng: EMPAT },
  { nama: '',             label: 'Sales',     jenis: 'sales',     ditugaskan: false, cabang: false, dashboard: 'team', aktif: true, lonceng: EMPAT },
];

export const KUNCI_KELOMPOK = 'kelompok';
export const KUNCI_LINGKUP_MANAGER = 'lingkup_manager';

export type LingkupManager = Record<string, string[]>;

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
  try { window.sessionStorage.setItem(kunci, JSON.stringify(nilai)); } catch {  }
}

let kelompokSekarang: Kelompok[] = bacaSimpanan<Kelompok[]>(SIMPAN_KELOMPOK) ?? KELOMPOK_BAWAAN;
let lingkupSekarang: LingkupManager = bacaSimpanan<LingkupManager>(SIMPAN_LINGKUP) ?? {};

export function semuaKelompok(): Kelompok[] { return kelompokSekarang.filter(k => k.aktif); }

export function kelompokPTS(): Kelompok[] { return semuaKelompok().filter(k => k.jenis === 'pts'); }

export function namaKelompokPTS(): string[] { return kelompokPTS().map(k => k.nama); }

export function labelKelompokPTS(nama: string): string {
  return kelompokPTS().find(k => k.nama === nama)?.label ?? nama;
}

export function teamTypeDariLabelPTS(label: string): string | null {
  return kelompokPTS().find(k => k.label === label)?.nama ?? null;
}

export function kelompokDitugaskan(): Kelompok[] { return semuaKelompok().filter(k => k.ditugaskan); }

export function kelompokPTSDitugaskan(): Kelompok[] {
  return kelompokPTS().filter(k => k.ditugaskan);
}

export function namaKelompokPTSDitugaskan(): string[] {
  return kelompokPTSDitugaskan().map(k => k.nama);
}

export function kelompokCabang(): Kelompok[] {
  return semuaKelompok().filter(k => k.cabang);
}

export function namaSemuaKelompokTim(): string[] {
  return semuaKelompok().filter(k => k.nama.trim() !== '').map(k => k.nama);
}

export function namaKelompokCabang(): string[] {
  return kelompokCabang().map(k => k.nama);
}

export function gayaDashboard(teamType: string | null | undefined): 'team' | 'sales' {
  const nama = (teamType ?? '').trim();
  if (!nama) return 'team';
  return semuaKelompok().find(k => k.nama === nama)?.dashboard ?? 'team';
}

export function bolehKelolaIncentive(u: {
  role?: string | null; jabatan?: string | null; team_type?: string | null;
} | null | undefined): boolean {
  if (!u) return false;
  const r = (u.role ?? '').toLowerCase();
  if (r === 'admin' || r === 'superadmin') return true;
  const timPTS = r === 'team' || r === 'team_pts';
  return timPTS
    && (u.jabatan ?? '') === 'Manager'
    && namaKelompokPTS().includes(u.team_type ?? '');
}

export function cariKelompok(teamType?: string | null): Kelompok | null {
  const t = (teamType ?? '').trim();
  return kelompokSekarang.find(k => k.nama === t) ?? null;
}

export function lingkupManager(): LingkupManager { return lingkupSekarang; }

export function lingkupSaya(userId?: string | null): string[] {
  const dipetakan = userId ? lingkupSekarang[userId] : undefined;
  if (!dipetakan || dipetakan.length === 0) return namaKelompokPTS();
  const hidup = new Set(namaKelompokPTS());
  const hasil = dipetakan.filter(n => hidup.has(n));
  return hasil.length > 0 ? hasil : namaKelompokPTS();
}

export function bolehLihatKelompok(userId: string | null | undefined, teamType?: string | null): boolean {
  const t = (teamType ?? '').trim();
  if (!t) return true;
  return lingkupSaya(userId).includes(t);
}

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

let pemuatan: Promise<void> | null = null;
const pendengar = new Set<() => void>();
function beriTahu(): void { for (const f of pendengar) f(); }

function uraikan(nilai: unknown): unknown {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  if (typeof nilai === 'object') return nilai;
  if (typeof nilai !== 'string') return null;
  try { return JSON.parse(nilai); } catch { return null; }
}

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
    cabang: o.cabang === true,
    dashboard: o.dashboard === 'sales' ? 'sales' : 'team',
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
    } catch {  }
  })();
  return pemuatan;
}

export function muatUlangKelompok(): Promise<void> { pemuatan = null; return muatKelompok(); }

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

export async function kelompokTerpakai(): Promise<Record<string, number>> {
  const { data } = await supabase.from('users').select('team_type');
  const hitung: Record<string, number> = {};
  for (const b of (data ?? []) as { team_type: string | null }[]) {
    const t = (b.team_type ?? '').trim();
    hitung[t] = (hitung[t] ?? 0) + 1;
  }
  return hitung;
}

export function dengarKelompok(f: () => void): () => void {
  pendengar.add(f);
  return () => { pendengar.delete(f); };
}
