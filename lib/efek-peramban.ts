import { sendWA } from '@/lib/wa';
import { createNotification } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import type { EfekSamping } from '@/lib/efek-samping';

export const efekPeramban: EfekSamping = {
  wa: (target, pesan, event) => sendWA(target, pesan, 'reminder_wa', event),
  inApp: p => createNotification(p),
  audit: p => logAudit(p).catch(() => {}),
};
