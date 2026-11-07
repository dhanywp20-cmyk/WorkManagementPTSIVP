
export type KategoriEvent = 'assignment' | 'approval' | 'reminder' | 'schedule' | 'project' | 'ticket' | 'system';

export interface DefinisiEvent {
  key: string;
  label: string;
  kategori: KategoriEvent;
  bawaanKanal: Array<'in_app' | 'whatsapp' | 'telegram'>;
}

export const EVENT_TERSAMBUNG: ReadonlySet<string> = new Set<string>([
  'system.account_created',
  'ticket.approval_needed',
  'ticket.assigned',
  'ticket.routed_supervisor',
  'ticket.updated',
  'ticket.reopened',
  'reminder.new_schedule',
  'reminder.assigned',
  'reminder.routed_supervisor',
  'reminder.rescheduled',
  'reminder.updated',
  'reminder.form_review_sent',
  'project.approval_needed',
  'project.assigned',
  'project.routed_supervisor',
  'project.updated',
  'project.internal_review',
  'project.brand_cc',
  'system.digest',
  'system.overdue_escalation',
  'system.password_reset',
  'tools.perbandingan',
  'system.health_alert',
]);

export function eventTersambung(key: string): boolean {
  return EVENT_TERSAMBUNG.has(key);
}

export const KATALOG_EVENT: DefinisiEvent[] = [
  { key: 'ticket.assigned',           label: 'Tiket di-assign ke anggota',        kategori: 'ticket',      bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.reopened',           label: 'Tiket dibuka kembali',              kategori: 'ticket',      bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.approval_needed',    label: 'Tiket menunggu approval admin',     kategori: 'approval',    bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.routed_supervisor',  label: 'Tiket dialihkan ke Supervisor',     kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'ticket.updated',            label: 'Detail tiket diperbarui',           kategori: 'ticket',      bawaanKanal: ['whatsapp'] },
  { key: 'reminder.new_schedule',     label: 'Jadwal baru dibuat',                kategori: 'schedule',    bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'reminder.assigned',         label: 'Jadwal di-assign ke anggota',       kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'reminder.routed_supervisor',label: 'Jadwal dialihkan ke Supervisor',    kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'reminder.rescheduled',      label: 'Jadwal dipindah (re-schedule)',     kategori: 'schedule',    bawaanKanal: ['whatsapp'] },
  { key: 'reminder.updated',          label: 'Detail jadwal diperbarui',          kategori: 'schedule',    bawaanKanal: ['whatsapp'] },
  { key: 'reminder.form_review_sent', label: 'Form review dikirim ke Guest/Sales',kategori: 'schedule',    bawaanKanal: ['whatsapp'] },
  { key: 'project.approval_needed',   label: 'Request project menunggu approval', kategori: 'approval',    bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'project.assigned',          label: 'Request project di-assign',         kategori: 'assignment',  bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'project.routed_supervisor', label: 'Request project dialihkan ke Supervisor', kategori: 'assignment', bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'project.updated',           label: 'Detail request project diperbarui',kategori: 'project',      bawaanKanal: ['whatsapp'] },
  { key: 'project.internal_review',   label: 'Request menunggu review Sales Internal', kategori: 'approval', bawaanKanal: ['whatsapp'] },
  { key: 'project.brand_cc',          label: 'CC ke PIC Brand',                   kategori: 'project',     bawaanKanal: ['whatsapp'] },
  { key: 'system.user_registered',    label: 'Akun baru menunggu persetujuan',    kategori: 'system',      bawaanKanal: ['in_app'] },
  { key: 'system.account_created',    label: 'Akun baru dibuat Admin - WA selamat datang', kategori: 'system', bawaanKanal: ['whatsapp'] },
  { key: 'system.password_reset',     label: 'Kode OTP reset password',           kategori: 'system',      bawaanKanal: ['whatsapp'] },
  { key: 'tools.perbandingan',        label: 'Product Comparison: pengajuan & hasil verifikasi', kategori: 'approval', bawaanKanal: ['in_app', 'whatsapp'] },
  { key: 'system.digest',             label: 'Ringkasan harian (digest)',         kategori: 'system',      bawaanKanal: ['whatsapp'] },
  { key: 'system.overdue_escalation', label: 'Eskalasi tiket/jadwal terlambat',   kategori: 'system',      bawaanKanal: ['whatsapp'] },
  { key: 'system.health_alert',       label: 'Peringatan merah Kesehatan Sistem (ke admin)', kategori: 'system', bawaanKanal: ['telegram'] },
];

export function cariEvent(key: string): DefinisiEvent | undefined {
  return KATALOG_EVENT.find(e => e.key === key);
}

