import { hasFullAccess } from '@/lib/constants';
import { BARIS, adalahPTS, akunTambahan, gagal, idSah, peranDari, samaNama, type AkunTambahan, type HasilAksi, type KonteksAksi } from '@/lib/integrasi/bantu';
import { str, type Aksi, type Baris } from '@/lib/integrasi/menu-dasar';

export interface RuanganDesain {
  room_name?: string | null; status?: string | null; assign_name?: string | null; assign_user_id?: string | null;
  approved_by?: string | null; approved_at?: string | null;
}

export interface RequestDesain {
  id: string; project_name: string; room_name: string | null; project_location?: string | null;
  sales_name: string | null; sales_division: string | null; requester_id: string | null; requester_name: string | null;
  status: string; routing_status?: string | null; assign_name: string | null; assign_user_id?: string | null;
  assigned_supervisor_id?: string | null; ivp_assignee?: string | null; due_date?: string | null; created_at?: string;
  rejection_reason?: string | null; rooms?: RuanganDesain[] | null;
  internal_sales_id?: string | null; internal_sales_id_2?: string | null;
  internal_approved_at?: string | null; internal_approved_at_2?: string | null;
}

export const statusRuangan = (r: RequestDesain, i: number) => (i === 0 ? r.status : r.rooms?.[i - 1]?.status ?? r.status);

export const handlerRuangan = (r: RequestDesain, i: number) =>
  (i === 0 ? r.assign_name : r.rooms?.[i - 1]?.assign_name ?? r.assign_name) ?? null;

export const namaRuangan = (r: RequestDesain, i: number) =>
  (i === 0 ? r.room_name : r.rooms?.[i - 1]?.room_name)?.trim() || `Ruangan ${i + 1}`;

export function indeksRuangan(a: Record<string, unknown>, r: RequestDesain): number | null {
  const v = a.ruangan;
  if (v === undefined || v === null || v === '') return 0;
  const total = 1 + (r.rooms?.length ?? 0);
  const n = typeof v === 'number' ? v : /^\d+$/.test(String(v).trim()) ? parseInt(String(v), 10) : NaN;
  if (!Number.isNaN(n)) return n >= 1 && n <= total ? n - 1 : null;
  for (let i = 0; i < total; i++) if (samaNama(i === 0 ? r.room_name : r.rooms?.[i - 1]?.room_name, String(v))) return i;
  return null;
}

export function bolehReviewInternal(r: RequestDesain, uid: string): boolean {
  if (r.routing_status !== 'internal_review') return false;
  if (uid === r.internal_sales_id && !r.internal_approved_at) return true;
  return uid === r.internal_sales_id_2 && !r.internal_approved_at_2;
}

export interface HakDesain {
  ubah_status: string[];
  approve: boolean;
  assign_supervisor: boolean;
  reassign: boolean;
  route_supervisor: boolean;
  tolak: boolean;
  review_internal: boolean;
  ajukan_ulang: boolean;
  pesan: boolean;
  alasan_pesan?: string;
}

export function hakDesain(r: RequestDesain, u: KonteksAksi['u'], t: AkunTambahan, i: number): HakDesain {
  const role = peranDari(u);
  const me = u.full_name ?? '';
  const isPTS = adalahPTS(u);
  const isTeamPTS = role === 'team_pts' || role === 'team';
  const kelola = role === 'admin' || role === 'superadmin' || hasFullAccess(u);
  const st = statusRuangan(r, i);
  const handler = handlerRuangan(r, i);
  const pending = st === 'pending';
  const ditugaskan = !!me && handler === me;

  let ubah: string[] = [];
  if (isPTS && !pending && (kelola || ditugaskan)) {
    ubah = ['pending', 'in_progress', 'completed', ...(kelola ? ['approved', 'rejected'] : [])].filter(s => {
      if (s === st) return false;
      if (s === 'in_progress' && !(isPTS && (kelola || ditugaskan))) return false;
      if (s === 'completed' && isTeamPTS && !ditugaskan) return false;
      return true;
    });
  }
  const internal = bolehReviewInternal(r, u.id);
  const approve = kelola && i === 0 && pending && r.routing_status !== 'internal_review';
  const assignSup = i === 0 && r.routing_status === 'supervisor_assign' && r.assigned_supervisor_id === u.id;
  const reassign = isPTS && !isTeamPTS && st !== 'pending' && st !== 'rejected';

  const pemilik = r.requester_id === u.id;
  const ivpGuest = role === 'guest' && !t.pimpinan && (u.sales_division === 'IVP' || u.sales_division === 'MVI');
  let alasan: string | undefined;
  if (r.status === 'rejected') alasan = 'Request ini sudah ditolak. Tidak bisa mengirim pesan.';
  else if (r.status === 'pending' && !isPTS) alasan = 'Request masih pending approval. Chat akan aktif setelah diapprove.';
  else if (!(isPTS || pemilik || (ivpGuest && r.ivp_assignee === me))) alasan = 'Anda tidak memiliki akses untuk mengirim pesan.';

  return {
    ubah_status: ubah,
    approve,
    assign_supervisor: assignSup,
    reassign,
    route_supervisor: (approve || reassign) && i === 0 && r.routing_status !== 'supervisor_assign',
    tolak: approve || internal,
    review_internal: internal,
    ajukan_ulang: r.status === 'rejected' && !isPTS && (pemilik || samaNama(r.sales_name, me)),
    pesan: !alasan,
    ...(alasan ? { alasan_pesan: alasan } : {}),
  };
}

export function terlihatTeamPTS(r: { assign_name?: string | null; assigned_supervisor_id?: string | null }, u: KonteksAksi['u']): boolean {
  const role = peranDari(u);
  if (!((role === 'team_pts' || role === 'team') && u.jabatan !== 'Manager')) return true;
  return !!r.assign_name || r.assigned_supervisor_id === u.id;
}

export async function muatRequestDesain(id: unknown, k: KonteksAksi): Promise<RequestDesain | HasilAksi> {
  const rid = idSah(id);
  if (!rid) return gagal('id request tidak sah (ambil dari desain_cari).');
  const { data, error } = await k.db.from('project_requests').select('*').eq('id', rid).maybeSingle();
  if (error) return gagal(error.message);
  const r = data as RequestDesain | null;
  if (!r || !terlihatTeamPTS(r, k.u)) return gagal('Request tidak ditemukan atau Anda tidak punya akses.');
  return r;
}

export const adalahGalat = (x: unknown): x is HasilAksi => !!x && typeof x === 'object' && (x as HasilAksi).ok === false;

export const desainDetail: Aksi = async (a, k) => {
  const r = await muatRequestDesain(a.id, k);
  if (adalahGalat(r)) return r;
  const i = indeksRuangan(a, r);
  if (i === null) return gagal(`Ruangan tidak ada. Request ini punya ${1 + (r.rooms?.length ?? 0)} ruangan.`);
  const [{ data: pesan }, { data: lampiran }, t] = await Promise.all([
    k.db.from('project_messages').select('sender_name, sender_role, message, created_at').eq('request_id', r.id)
      .order('created_at', { ascending: false }).limit(20),
    k.db.from('project_attachments').select('file_name, attachment_category, uploaded_by, created_at, file_url')
      .eq('request_id', r.id).order('created_at', { ascending: false }).limit(30),
    akunTambahan(k),
  ]);
  const ruangan = [0, ...(r.rooms ?? []).map((_, j) => j + 1)].map(j => ({
    nomor: j + 1, nama: namaRuangan(r, j), status: statusRuangan(r, j), handler: handlerRuangan(r, j) ?? null,
  }));
  return {
    ok: true,
    request: {
      id: r.id, project_name: r.project_name, lokasi: r.project_location ?? null, sales: r.sales_name, divisi: r.sales_division,
      requester: r.requester_name, status: r.status, routing_status: r.routing_status ?? null, handler: r.assign_name,
      ivp_assignee: r.ivp_assignee ?? null, due_date: r.due_date ?? null, masuk: r.created_at, alasan_ditolak: r.rejection_reason ?? null,
    },
    ruangan, ruangan_dipilih: i + 1,
    pesan_terakhir: ((pesan ?? []) as Baris[]).reverse(),
    lampiran: lampiran ?? [],
    aksi_tersedia: hakDesain(r, k.u, t, i),
  };
};

export const tiketPersetujuan: Aksi = async (_a, k) => {
  const kolom = 'id, project_name, issue_case, product, sales_name, sales_division, created_by, date, created_at, status, assign_name, routing_status, assigned_supervisor_id';
  const [{ data: wa, error }, { data: sup }] = await Promise.all([
    k.db.from('tickets').select(kolom).eq('status', 'Waiting Approval').not('is_deleted', 'is', true)
      .order('created_at', { ascending: true }).limit(BARIS),
    k.db.from('tickets').select(kolom).eq('routing_status', 'supervisor_assign').eq('assigned_supervisor_id', k.u.id)
      .not('is_deleted', 'is', true).limit(BARIS),
  ]);
  if (error) return gagal(error.message);
  const routed = ((sup ?? []) as Baris[]).filter(t => !str(t.assign_name ?? '').trim());
  return { ok: true, menunggu_approval: wa ?? [], dirouting_ke_saya: routed,
    boleh_approve: ['admin', 'superadmin'].includes(peranDari(k.u)) || hasFullAccess(k.u) };
};
