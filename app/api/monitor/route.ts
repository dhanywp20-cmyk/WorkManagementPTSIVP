import { getAdminClient } from '@/lib/supabase-admin';
import { jawabMonitor } from '@/lib/monitor';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return jawabMonitor(request, getAdminClient);
}
