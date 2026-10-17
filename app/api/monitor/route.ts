import { getAdminClient } from '@/lib/supabase-admin';
import { jawabMonitor } from '@/lib/monitor';

export const dynamic = 'force-dynamic';

/**
 * /api/monitor - kesehatan dependensi (DB, cron, galat) untuk pemantau eksternal, baca-saja.
 * Wajib `Authorization: Bearer <MONITOR_TOKEN>`; dikecualikan dari gerbang sesi di proxy.ts
 * seperti /api/cron/. Aturan & bentuk jawabannya ada di lib/monitor.ts.
 */
export function GET(request: Request) {
  return jawabMonitor(request, getAdminClient);
}
