/**
 * lib/pemakaian.ts - catatan pemakaian menu (tabel pemakaian_menu, migrasi 058).
 *
 * - catatPemakaian(): dipanggil peramban saat modul dibuka (KerangkaPortal) dan saat alat
 *   AV Solution Tools berganti (tools-team/page.tsx). Modul yang sama dalam 10 menit dilewati.
 * - modulSah()/subSah(): saringan /api/pemakaian - hanya rute portal yang dikenal.
 * - ringkasPemakaian(): murni, dipakai GET /api/pemakaian & diuji di uji/pemakaian.ts.
 */

/** Rute portal = folder app/(portal) (uji/pemakaian.ts memastikan daftar ini tetap sama). */
export const MODUL_DICATAT = [
  'dashboard', 'daily-report', 'form-require-project', 'form-review', 'incentive-pts', 'kpi-team',
  'learning-center', 'picket-showroom', 'project-progress', 'reminder-schedule', 'summary-project',
  'tech-note', 'ticketing', 'tools-team', 'unit-movement',
] as const;
export type ModulDicatat = typeof MODUL_DICATAT[number];

/** Alat di AV Solution Tools (ALAT di tools-team/page.tsx). */
export const ALAT_TOOLS = ['3d', 'led', 'av', 'banding', 'pustaka'] as const;

export const modulSah = (v: unknown): v is ModulDicatat => typeof v === 'string' && (MODUL_DICATAT as readonly string[]).includes(v);
/** Sub hanya untuk AV Solution Tools; modul lain selalu tanpa sub. */
export const subSah = (modul: ModulDicatat, v: unknown): boolean =>
  v === null || v === undefined || v === '' ? true : modul === 'tools-team' && (ALAT_TOOLS as readonly string[]).includes(String(v));

const JEDA_MS = 10 * 60_000;
const terakhir = new Map<string, number>();

/** Fire-and-forget: tidak pernah melempar, tidak menunggu, tidak mengganggu perpindahan menu. */
export function catatPemakaian(modul: string, sub?: string | null): void {
  if (typeof window === 'undefined') return;
  const kunci = `${modul}|${sub ?? ''}`;
  const kini = Date.now();
  if (kini - (terakhir.get(kunci) ?? 0) < JEDA_MS) return;
  terakhir.set(kunci, kini);
  try {
    fetch('/api/pemakaian', {
      method: 'POST', credentials: 'include', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modul, sub: sub ?? null }),
    }).catch(() => { /* pencatatan tidak boleh mengganggu pemakaian */ });
  } catch { /* idem */ }
}

/* ── Ringkasan untuk tab Pemakaian ─────────────────────────────────────────── */

export type Kelompok = 'admin' | 'team' | 'marketing' | 'lain';
export const LABEL_KELOMPOK: Record<Kelompok, string> = {
  admin: 'Admin', team: 'Team Product', marketing: 'Marketing', lain: 'Sales & lainnya',
};
export const URUTAN_KELOMPOK: Kelompok[] = ['team', 'marketing', 'lain', 'admin'];

export interface BarisPemakaian { user_id: string; modul: string; sub: string | null; created_at: string }
export interface AkunPemakaian { id: string; full_name: string | null; username: string | null; role: string | null; team_type: string | null }

export function kelompokAkun(a: Pick<AkunPemakaian, 'role' | 'team_type'> | undefined): Kelompok {
  const role = (a?.role ?? '').toLowerCase();
  const tim = (a?.team_type ?? '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return 'admin';
  if (role === 'team' || role === 'team_pts' || tim.startsWith('team ')) return 'team';
  if (tim === 'marketing') return 'marketing';
  return 'lain';
}

export interface RingkasModul {
  modul: string;
  kunjungan: number;
  pengguna: number;
  /** Pengguna unik per kelompok. */
  perKelompok: Record<Kelompok, number>;
  terakhir: string | null;
}
export interface RingkasPemakaian {
  modul: RingkasModul[];
  /** Modul yang tidak dibuka sama sekali dalam rentang ini. */
  tidakDibuka: string[];
  /** Alat AV Solution Tools: kunjungan & pengguna unik. */
  alat: { sub: string; kunjungan: number; pengguna: number }[];
  /** Akun paling aktif (jumlah kunjungan). */
  teraktif: { nama: string; kelompok: Kelompok; kunjungan: number; modul: number }[];
  /** Akun yang membuka platform per kelompok vs total akun kelompok itu. */
  jangkauan: Record<Kelompok, { aktif: number; total: number }>;
}

const nol = (): Record<Kelompok, number> => ({ admin: 0, team: 0, marketing: 0, lain: 0 });

export function ringkasPemakaian(baris: BarisPemakaian[], akun: AkunPemakaian[]): RingkasPemakaian {
  const peta = new Map(akun.map(a => [a.id, a]));
  const perModul = new Map<string, { kunjungan: number; pengguna: Set<string>; terakhir: string | null }>();
  const perAlat = new Map<string, { kunjungan: number; pengguna: Set<string> }>();
  const perAkun = new Map<string, { kunjungan: number; modul: Set<string> }>();

  for (const b of baris) {
    const m = perModul.get(b.modul) ?? { kunjungan: 0, pengguna: new Set<string>(), terakhir: null };
    m.kunjungan++; m.pengguna.add(b.user_id);
    if (!m.terakhir || b.created_at > m.terakhir) m.terakhir = b.created_at;
    perModul.set(b.modul, m);
    if (b.modul === 'tools-team' && b.sub) {
      const s = perAlat.get(b.sub) ?? { kunjungan: 0, pengguna: new Set<string>() };
      s.kunjungan++; s.pengguna.add(b.user_id); perAlat.set(b.sub, s);
    }
    const u = perAkun.get(b.user_id) ?? { kunjungan: 0, modul: new Set<string>() };
    u.kunjungan++; u.modul.add(b.modul); perAkun.set(b.user_id, u);
  }

  const modul: RingkasModul[] = [...perModul].map(([nama, m]) => {
    const perKelompok = nol();
    for (const id of m.pengguna) perKelompok[kelompokAkun(peta.get(id))]++;
    return { modul: nama, kunjungan: m.kunjungan, pengguna: m.pengguna.size, perKelompok, terakhir: m.terakhir };
  }).sort((a, b) => b.pengguna - a.pengguna || b.kunjungan - a.kunjungan);

  const jangkauan = { admin: { aktif: 0, total: 0 }, team: { aktif: 0, total: 0 }, marketing: { aktif: 0, total: 0 }, lain: { aktif: 0, total: 0 } };
  for (const a of akun) jangkauan[kelompokAkun(a)].total++;
  //  Hanya akun yang masih ada - akun terhapus tidak boleh menaikkan "aktif" melewati "total".
  for (const id of perAkun.keys()) { const a = peta.get(id); if (a) jangkauan[kelompokAkun(a)].aktif++; }

  return {
    modul,
    tidakDibuka: MODUL_DICATAT.filter(m => !perModul.has(m)),
    alat: ALAT_TOOLS.map(sub => ({ sub, kunjungan: perAlat.get(sub)?.kunjungan ?? 0, pengguna: perAlat.get(sub)?.pengguna.size ?? 0 })),
    teraktif: [...perAkun].map(([id, u]) => {
      const a = peta.get(id);
      return { nama: a?.full_name || a?.username || 'Akun terhapus', kelompok: kelompokAkun(a), kunjungan: u.kunjungan, modul: u.modul.size };
    }).sort((a, b) => b.kunjungan - a.kunjungan).slice(0, 10),
    jangkauan,
  };
}
