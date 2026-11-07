import { supabase } from '@/lib/supabase';
import { LateTicketLink } from './calc-tipe';

export function jendelaSupportTahap(
  bastDate: string | null | undefined,
  tahunKe: number,
): { dari: string | null; sampai: string | null } {
  if (!bastDate || tahunKe < 1) return { dari: null, sampai: null };
  const tgl = (tambahTahun: number) => {
    const d = new Date(bastDate);
    d.setFullYear(d.getFullYear() + tambahTahun);
    return d.toISOString().slice(0, 10);
  };
  return {
    dari: tahunKe === 1 ? null : tgl(tahunKe - 1),
    sampai: tgl(tahunKe),
  };
}

export function samakanNamaProyek(v: string): string {
  return v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function tanggalSaja(v: string | null | undefined): string {
  return (v ?? '').slice(0, 10);
}

export function didalamRentang(tgl: string, rentang?: { dari?: string | null; sampai?: string | null }): boolean {
  if (!rentang?.dari && !rentang?.sampai) return true;
  if (!tgl) return false;
  if (rentang?.dari   && !(tgl > rentang.dari))   return false;
  if (rentang?.sampai && !(tgl <= rentang.sampai)) return false;
  return true;
}

interface BarisAktivitas {
  handler_username: string | null;
  handler_name: string | null;
  new_status: string | null;
  created_at: string | null;
}

export interface SumberSupport {
  reminders: { assigned_to: string | null; assign_name: string | null; project_name: string | null; due_date: string | null }[];
  tickets: {
    id: string; project_name: string | null; reminder_id: string | null;
    date: string | null; assign_name: string | null; activity_logs: BarisAktivitas[] | null;
    created_at?: string | null;
  }[];
  petaNama: Map<string, string>;
}

export async function ambilSumberSupport(): Promise<{ data: SumberSupport; error: unknown }> {
  const qr = supabase
    .from('reminders')
    .select('assigned_to, assign_name, project_name, due_date')
    .eq('category', 'Troubleshooting')
    .eq('status', 'done');

  const qt = supabase
    .from('tickets')
    .select('id, project_name, reminder_id, status, date, created_at, assign_name, activity_logs(handler_username, handler_name, new_status, created_at)')
    .eq('status', 'Solved');

  const qu = supabase.from('users').select('username, full_name');

  const [rRes, tRes, uRes] = await Promise.all([qr, qt, qu]);

  const petaNama = new Map<string, string>();
  for (const u of (uRes.data ?? []) as { username: string | null; full_name: string | null }[]) {
    const n = samakanNamaProyek(u.full_name ?? '');
    if (n && u.username) petaNama.set(n, u.username);
  }

  return {
    data: {
      reminders: (rRes.data ?? []) as SumberSupport['reminders'],
      tickets: (tRes.data ?? []) as SumberSupport['tickets'],
      petaNama,
    },
    error: rRes.error ?? tRes.error ?? uRes.error,
  };
}

function jejakSolved(t: SumberSupport['tickets'][number]): BarisAktivitas[] {
  return (t.activity_logs ?? []).filter(a => (a.new_status ?? '').toLowerCase() === 'solved');
}

export function tglSelesaiTiket(t: SumberSupport['tickets'][number]): string {
  const jejak = jejakSolved(t);
  return jejak.length
    ? jejak.map(a => tanggalSaja(a.created_at)).sort().at(-1) ?? ''
    : tanggalSaja(t.date);
}

export function waktuTercatatTiket(t: SumberSupport['tickets'][number]): number {
  const keUtc = (v: string) => (/T.*(Z|[+-]\d\d:?\d\d)$/.test(v) || !v.includes('T') ? v : `${v}Z`);
  const waktu = [...jejakSolved(t).map(a => a.created_at), t.created_at, t.date]
    .map(v => (v ? Date.parse(keUtc(v)) : NaN))
    .filter(n => !Number.isNaN(n));
  return waktu.length ? Math.max(...waktu) : NaN;
}

export function supportUntukProyek(
  sumber: SumberSupport,
  proyek: { id?: string | null; project_name: string },
  rentang?: { dari?: string | null; sampai?: string | null },
  lampiran?: ReadonlySet<string>,
): { user_id: string; user_name: string }[] {
  const dicari = samakanNamaProyek(proyek?.project_name ?? '');
  if (!dicari) return [];
  const { petaNama } = sumber;
  const usernameDariNama = (nama: string | null | undefined): string =>
    petaNama.get(samakanNamaProyek(nama ?? '')) ?? (nama ?? '');

  const hasil: { user_id: string; user_name: string }[] = [];
  const sudah = new Set<string>();
  const tambah = (user_id: string | null | undefined, user_name: string | null | undefined) => {
    const id = (user_id ?? '').trim();
    if (!id || sudah.has(id)) return;
    sudah.add(id);
    hasil.push({ user_id: id, user_name: user_name || '' });
  };

  for (const r of sumber.reminders) {
    if (samakanNamaProyek(r.project_name ?? '') !== dicari) continue;
    if (!didalamRentang(tanggalSaja(r.due_date), rentang)) continue;
    tambah(r.assigned_to, r.assign_name);
  }

  for (const t of sumber.tickets) {
    const cocok = (proyek.id && t.reminder_id === proyek.id)
      || samakanNamaProyek(t.project_name ?? '') === dicari;
    if (!cocok) continue;

    if (!lampiran?.has(t.id) && !didalamRentang(tglSelesaiTiket(t), rentang)) continue;

    tambah(usernameDariNama(t.assign_name), t.assign_name);
  }

  return hasil;
}

export async function fetchSupportFromTickets(
  proyek: { id?: string | null; project_name: string },
  rentang?: { dari?: string | null; sampai?: string | null },
  lampiran?: ReadonlySet<string>,
): Promise<{ data: { user_id: string; user_name: string }[]; error: unknown }> {
  const { data: sumber, error } = await ambilSumberSupport();
  return { data: supportUntukProyek(sumber, proyek, rentang, lampiran), error };
}

export async function fetchLateTickets(parentProjectId?: string) {
  let q = supabase.from('late_ticket_links').select('*').order('attached_at', { ascending: false });
  if (parentProjectId) q = q.eq('parent_project_id', parentProjectId);
  const { data, error } = await q;
  return { data: (data || []) as LateTicketLink[], error };
}

export async function idTiketLampiranTahap(projectId: string, nomorTahap: number): Promise<Set<string>> {
  const { data } = await supabase
    .from('late_ticket_links')
    .select('late_ticket_id')
    .eq('parent_project_id', projectId)
    .eq('attached_tranche_number', nomorTahap)
    .eq('is_sunset', false);
  return new Set(((data ?? []) as { late_ticket_id: string | null }[]).map(b => b.late_ticket_id ?? '').filter(Boolean));
}

export async function lampirkanTiketTelat(baris: Omit<LateTicketLink, 'id' | 'attached_at'>) {
  return supabase.from('late_ticket_links').insert(baris);
}

export async function lepasTiketTelat(id: string) {
  return supabase.from('late_ticket_links').delete().eq('id', id);
}
