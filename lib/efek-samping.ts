import type { NotifPayload } from '@/lib/notifications';
import type { AuditPayload } from '@/lib/audit';

export interface EfekSamping {
  wa(target: string, pesan: string, event?: string): Promise<{ ok: boolean; reason?: string }>;
  inApp(p: NotifPayload): Promise<void>;
  audit(p: AuditPayload): Promise<void>;
}

export interface Pelaku {
  id: string;
  username: string;
  full_name: string;
}
