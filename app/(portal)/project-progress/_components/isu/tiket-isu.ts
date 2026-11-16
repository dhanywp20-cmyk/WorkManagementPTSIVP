import type { ActivityLog, Ticket } from '@/app/(portal)/ticketing/_components/shared';
import { STATUS_ISU, type Isu, type RiwayatIsu, type StatusIsu, type TiketIsu } from '@/lib/isu/inti';

const PRIORITAS: Record<string, Ticket['priority']> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export function keTicket(t: TiketIsu): Ticket {
  return {
    id: t.id,
    project_name: t.project_name ?? '',
    address: t.address ?? undefined,
    customer_phone: t.customer_phone ?? '',
    sales_name: t.sales_name ?? '',
    issue_case: t.issue_case ?? '',
    description: t.description ?? '',
    sn_unit: t.sn_unit ?? undefined,
    product: t.product ?? undefined,
    assign_name: t.assign_name ?? '',
    status: t.status ?? '',
    date: t.date ?? '',
    created_at: t.created_at,
    created_by: t.created_by ?? undefined,
    current_team: t.current_team ?? 'Team PTS IVP',
    services_status: t.services_status ?? undefined,
    sales_division: t.sales_division ?? undefined,
    photo_url: t.photo_url ?? undefined,
    photo_name: t.photo_name ?? undefined,
    rejection_reason: t.rejection_reason ?? undefined,
    reminder_id: t.reminder_id,
    priority: PRIORITAS[(t.priority ?? '').toLowerCase()],
    routing_status: t.routing_status,
    brand: t.brand,
    activity_logs: t.activity_logs.map((a): ActivityLog => ({
      id: a.id, ticket_id: a.ticket_id, handler_name: a.handler_name ?? '', handler_username: a.handler_username ?? '',
      action_taken: a.action_taken ?? '', notes: a.notes ?? '', file_url: a.file_url ?? '', file_name: a.file_name ?? '',
      photo_url: a.photo_url ?? undefined, photo_name: a.photo_name ?? undefined, new_status: a.new_status ?? '',
      team_type: a.team_type ?? 'Team PTS IVP', assigned_to_services: a.assigned_to_services ?? false, created_at: a.created_at,
    })),
  };
}

const labelStatus = (s: string | null) => (s && s in STATUS_ISU ? STATUS_ISU[s as StatusIsu].label : '');

export function isuKeTicket(i: Isu, riwayat: RiwayatIsu[]): Ticket {
  return {
    id: i.id,
    project_name: i.lokasi,
    customer_phone: '',
    sales_name: i.pelapor,
    issue_case: i.judul,
    description: [i.deskripsi, i.solusi ? `Solusi: ${i.solusi}` : ''].filter(Boolean).join('\n\n'),
    product: i.kategori,
    assign_name: i.pic,
    status: STATUS_ISU[i.status].label,
    date: i.tanggal,
    created_at: i.created_at,
    created_by: i.dibuat_oleh_nama ?? undefined,
    current_team: 'Team PTS IVP',
    photo_url: i.foto_url ?? undefined,
    activity_logs: riwayat.map(r => ({
      id: r.id, handler_name: r.nama ?? '', handler_username: '',
      action_taken: r.aksi === 'dibuat' ? 'Isu dicatat' : r.aksi === 'ubah' ? r.keterangan : '',
      notes: r.aksi === 'ubah' ? '' : r.keterangan, file_url: '', file_name: '',
      new_status: labelStatus(r.ke) || (r.aksi === 'action' ? 'Update' : ''), team_type: 'Team PTS IVP', created_at: r.created_at,
    })),
  };
}
