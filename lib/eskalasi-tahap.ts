
export interface BarisTahap {
  sumber: 'Jadwal' | 'Design' | 'Ticket';
  project_name: string | null;
  routing_status: string | null;
  status: string | null;
  internal_sales_id?: string | null;
  internal_sales_id_2?: string | null;
  assigned_supervisor_id?: string | null;
  sejak: string;
}

export interface ItemTahap {
  penerima: string[];
  label: string;
  tanggal: string;
  terlambat: boolean;
  ringan: boolean;
}

const SELESAI = new Set(['done', 'cancelled', 'completed', 'rejected', 'solved', 'Solved', 'Rejected']);
const LABEL_TAHAP: Record<string, string> = {
  internal_review: 'review Sales Internal',
  admin_review: 'persetujuan Admin',
  supervisor_assign: 'assign oleh Supervisor',
};

export function itemTahapTertahan(baris: BarisTahap[], sekarang: number): ItemTahap[] {
  const hasil: ItemTahap[] = [];
  for (const b of baris) {
    const tahap = b.routing_status ?? '';
    if (!LABEL_TAHAP[tahap] || SELESAI.has(b.status ?? '')) continue;
    const jam = (sekarang - new Date(b.sejak).getTime()) / 3_600_000;
    if (!(jam > 24)) continue;
    const penerima = tahap === 'internal_review'
      ? [b.internal_sales_id, b.internal_sales_id_2].filter((x): x is string => !!x)
      : tahap === 'supervisor_assign'
        ? [b.assigned_supervisor_id].filter((x): x is string => !!x)
        : ['admin'];
    if (!penerima.length) continue;
    const hari = Math.floor(jam / 24);
    hasil.push({
      penerima,
      label: `⏳ ${b.sumber} menunggu ${LABEL_TAHAP[tahap]} Anda ${hari} hari: ${b.project_name ?? '-'}`,
      tanggal: b.sejak.slice(0, 10),
      terlambat: jam > 48,
      ringan: !(jam > 48),
    });
  }
  return hasil;
}
