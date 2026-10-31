/**
 * Linimasa detail Summary Project - murni (tanpa React), diuji di uji/summary-project-linimasa.ts.
 *
 * Status ditampilkan dengan LABEL MENU ASALNYA (Request Schedule "Completed", Design "In Progress", ...), bukan
 * kode mentah basis data ("done", "in_progress"), dan setiap item tahu apakah ia masih terbuka / terlambat menurut
 * aturan menu asalnya - dasar penyaring "Perlu perhatian". Tanggal tiap jenis punya arti berbeda, jadi labelnya
 * ikut ditulis (Jadwal / Dilaporkan / Diajukan / Diisi).
 */
import type { DetailProject, SourceModule } from '@/lib/summary-project';
import type { AktivitasTipe } from './tampilan';

/**
 * Label status persis seperti di menu asal (tanpa ikon). Dijaga sama oleh uji: Request Schedule =
 * reminder-schedule/_components/shared.ts STATUS_CONFIG, Design = form-require-project/_components/shared.ts
 * statusConfig. Ticket memakai teks statusnya sendiri.
 */
export const LABEL_STATUS: Record<'schedule' | 'design', Record<string, string>> = {
  schedule: { pending: 'Pending', done: 'Completed', cancelled: 'Cancelled' },
  design: { pending: 'Pending', approved: 'Approved', in_progress: 'In Progress', completed: 'Completed', rejected: 'Rejected' },
};

/** Arti tanggal tiap jenis aktivitas - beda sumber, beda makna. */
export const LABEL_TANGGAL: Record<AktivitasTipe, string> = {
  schedule: 'Jadwal', ticket: 'Dilaporkan', design: 'Diajukan', review: 'Diisi',
};

/** Status yang sudah SELESAI (tidak perlu tindakan lagi) per menu asal. */
const SELESAI: Record<Exclude<AktivitasTipe, 'review'>, string[]> = {
  schedule: ['done', 'cancelled'],
  ticket: ['Solved', 'Rejected', 'Cancelled'],
  design: ['completed', 'rejected'],
};

export interface Aktivitas {
  id: string; tipe: AktivitasTipe;
  /** Tanggal posisi di linimasa (lihat LABEL_TANGGAL). */ tanggal: string | null;
  judul: string; meta: string;
  /** Kode status mentah & label menu asalnya. */ status?: string; labelStatus?: string;
  /** Masih perlu tindakan di menu asalnya. */ terbuka: boolean;
  /** Terbuka & lewat tenggat (jadwal / deadline sebelum hari ini, atau ticket berstatus Overdue). */ terlambat: boolean;
  href: string;
  /** Id baris project_source_links bila record ini dipetakan langsung (bukan ikut reminder). */ linkId?: string;
}

/** 'YYYY-MM-DD' hari ini (zona lokal peramban). */
export const hariIni = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** Tanggal (string ISO / 'YYYY-MM-DD') setelah hari ini - jadwal yang belum terjadi. */
export const diMasaDepan = (tgl: string | null | undefined, now = new Date()) => !!tgl && tgl.slice(0, 10) > hariIni(now);

const sebelumHariIni = (tgl: string | null | undefined, now: Date) => !!tgl && tgl.slice(0, 10) < hariIni(now);

/** Gabungkan 4 sumber jadi SATU linimasa kronologis, terbaru (dan jadwal mendatang) dulu. */
export function bangunLinimasa(detail: DetailProject, now = new Date()): Aktivitas[] {
  const list: Aktivitas[] = [];
  const link = (m: SourceModule, id: string) => detail.linkId[`${m}:${id}`];
  detail.reminders.forEach(r => {
    const terbuka = !SELESAI.schedule.includes(r.status);
    list.push({
      id: `r-${r.id}`, tipe: 'schedule', tanggal: r.due_date,
      judul: `${r.category} · ${r.mode_penyelesaian === 'remote' ? 'Remote' : 'Onsite'}`,
      meta: [r.assign_name, r.address].filter(Boolean).join(' · '),
      status: r.status, labelStatus: LABEL_STATUS.schedule[r.status] ?? r.status,
      terbuka, terlambat: terbuka && sebelumHariIni(r.due_date, now),
      href: `/reminder-schedule?open=${r.id}`, linkId: link('reminders', r.id),
    });
  });
  detail.tickets.forEach(t => {
    const terbuka = !SELESAI.ticket.includes(t.status);
    list.push({
      id: `t-${t.id}`, tipe: 'ticket', tanggal: t.date,
      judul: t.issue_case, meta: t.assign_name || 'Belum ada handler',
      status: t.status, labelStatus: t.status, terbuka, terlambat: terbuka && t.status === 'Overdue',
      href: `/ticketing?open=${t.id}`, linkId: link('tickets', t.id),
    });
  });
  detail.requests.forEach(r => {
    const terbuka = !SELESAI.design.includes(r.status);
    list.push({
      //  Posisi = tanggal diajukan (sama dengan "aktivitas terakhir" di daftar); deadline ditulis di keterangan.
      id: `p-${r.id}`, tipe: 'design', tanggal: r.created_at ?? r.due_date,
      judul: r.requester_name,
      meta: [r.assigned_handler || 'Belum ada handler', r.due_date && `deadline ${r.due_date.slice(0, 10)}`].filter(Boolean).join(' · '),
      status: r.status, labelStatus: LABEL_STATUS.design[r.status] ?? r.status,
      terbuka, terlambat: terbuka && sebelumHariIni(r.due_date, now),
      href: `/form-require-project?open=${r.id}`, linkId: link('project_requests', r.id),
    });
  });
  detail.reviews.forEach(r => list.push({
    id: `f-${r.id}`, tipe: 'review', tanggal: r.created_at ?? null,
    judul: r.review_category || 'Review', meta: r.guest_fullname,
    terbuka: false, terlambat: false,
    href: `/form-review?open=${r.id}`, linkId: link('form_reviews', r.id),
  }));
  return list.sort((a, b) => {
    if (!a.tanggal && !b.tanggal) return 0;
    if (!a.tanggal) return 1;
    if (!b.tanggal) return -1;
    return b.tanggal.localeCompare(a.tanggal);
  });
}

export type SaringLinimasa = 'semua' | 'terbuka' | 'terlambat';

export const saringLinimasa = (list: Aktivitas[], s: SaringLinimasa) =>
  s === 'semua' ? list : list.filter(a => (s === 'terbuka' ? a.terbuka : a.terlambat));
