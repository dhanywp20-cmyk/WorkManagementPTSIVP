import { cariTargetCC } from '@/lib/atasan';
import { adalahAdminMurni, bolehDitugaskanOleh, isAssignablePTSTeam } from '@/lib/teams';
import type { AuditAction } from '@/lib/audit';
import { gagal, samaNama, type HasilAksi, type KonteksAksi } from '@/lib/integrasi/bantu';


export type Aksi = (a: Record<string, unknown>, k: KonteksAksi) => Promise<HasilAksi>;
export const GARIS = '━━━━━━━━━━━━━━━━━━';
export const nama = (k: KonteksAksi) => k.u.full_name ?? k.u.username;

export interface Orang {
  id: string; username: string; full_name: string; role?: string | null; team_type?: string | null;
  phone_number?: string | null; sales_division?: string | null; jabatan?: string | null; bisa_ditugaskan?: boolean | null;
}
export const KOLOM_ORANG = 'id, username, full_name, role, team_type, phone_number, sales_division, jabatan, bisa_ditugaskan';

export async function anggotaDitawarkan(k: KonteksAksi): Promise<Orang[] | HasilAksi> {
  try { await k.muatAturan?.(); } catch {  }
  const { data, error } = await k.db.from('users').select(KOLOM_ORANG).in('role', ['team_pts', 'team']).order('full_name');
  if (error) return gagal(error.message);
  const penugasAdmin = adalahAdminMurni(k.u);
  return ((data ?? []) as Orang[]).filter(x => bolehDitugaskanOleh(x, penugasAdmin));
}
export async function daftarSupervisor(k: KonteksAksi): Promise<Orang[]> {
  try { await k.muatAturan?.(); } catch {  }
  const { data } = await k.db.from('users').select(KOLOM_ORANG).eq('jabatan', 'Supervisor');
  return ((data ?? []) as Orang[]).filter(s => isAssignablePTSTeam(s.team_type));
}
export const diriSendiri = (v: string, k: KonteksAksi) => ['saya', 'sendiri', 'aku', 'self'].includes(v.trim().toLowerCase())
  || samaNama(k.u.full_name, v) || samaNama(k.u.username, v);
export const cariOrang = (daftar: Orang[], v: string) => daftar.find(x => samaNama(x.username, v)) ?? daftar.find(x => samaNama(x.full_name, v));
export const contoh = (daftar: Orang[]) => (daftar.length ? ` Contoh: ${daftar.slice(0, 8).map(x => x.full_name).join(', ')}.` : '');

export async function kirimWA(k: KonteksAksi, nomor: string | null | undefined, pesan: string, event?: string): Promise<boolean> {
  if (!(nomor ?? '').trim()) return false;
  const r = await k.efek.wa(String(nomor), pesan, event);
  return r.ok;
}
export async function audit(k: KonteksAksi, p: { action: AuditAction; module: string; target_id?: string; target_name?: string;
  old_value?: string | null; new_value?: string | null; notes?: string }) {
  const { old_value, new_value, ...lain } = p;
  await k.efek.audit({ user_id: k.u.id, user_name: nama(k), ...lain,
    ...(old_value ? { old_value } : {}), ...(new_value ? { new_value } : {}) });
}

export async function targetCC(k: KonteksAksi, userId: string, salesDiv: string): Promise<{ phone: string; name: string; relation: string }[]> {
  return cariTargetCC(k.db, userId, salesDiv);
}
