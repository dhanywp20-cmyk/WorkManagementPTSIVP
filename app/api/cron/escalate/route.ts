import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWANotif } from '@/lib/wa';
import { appLink } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

const ESCALATION_HOURS: Record<string, number> = {
  Critical : 4,
  High     : 12,
  Medium   : 24,
  Low      : 48,
};
const DEFAULT_HOURS = 24;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron: Authorization: Bearer <secret>
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  // Manual POST: X-Cron-Secret: <secret>
  if (request.headers.get('x-cron-secret') === secret) return true;
  return false;
}

async function runEscalation() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, project_name, issue_case, assign_name, status, priority, created_at, escalation_notified_at, activity_logs(created_at)')
    .in('status', ['Pending', 'Call', 'Onsite', 'In Progress', 'Waiting sparepart', 'Waiting PO from Sales', 'Submit RMA']);

  if (!tickets?.length) return { escalated: 0 };

  const now = Date.now();
  const escalatedIds: string[] = [];

  for (const ticket of tickets) {
    const threshold = ESCALATION_HOURS[ticket.priority ?? 'Medium'] ?? DEFAULT_HOURS;
    const logs = (ticket.activity_logs ?? []) as { created_at: string }[];
    const lastActivity = logs.length
      ? Math.max(...logs.map(l => new Date(l.created_at).getTime()))
      : new Date(ticket.created_at).getTime();

    const hoursIdle = (now - lastActivity) / 3_600_000;
    if (hoursIdle < threshold) continue;

    if (ticket.escalation_notified_at) {
      const lastEsc = new Date(ticket.escalation_notified_at).getTime();
      if (now - lastEsc < 24 * 3_600_000) continue;
    }

    const { data: handlerUser } = await supabase
      .from('users')
      .select('phone_number, full_name')
      .eq('full_name', ticket.assign_name)
      .maybeSingle();

    //  Termasuk pemegang Full Access (Manager PTS IVP), bukan hanya role
    //  admin - lihat lib/penerima-admin.ts. Eskalasi yang tidak sampai ke
    //  pemegang kekuasaan platform adalah eskalasi yang tidak berguna.
    const { data: admins } = await supabase
      .from('users')
      .select('phone_number')
      .or('role.in.(admin,superadmin),access_level.eq.full')
      .not('phone_number', 'is', null);

    const hoursStr = hoursIdle < 1
      ? `${Math.round(hoursIdle * 60)} menit`
      : `${Math.floor(hoursIdle)} jam`;

    const waMsg = [
      `⚠️ *[ESKALASI] Tiket Idle ${hoursStr}*`,
      '━━━━━━━━━━━━━━━━━━',
      `📌 *Project :* ${ticket.project_name}`,
      `⚠️ *Issue   :* ${ticket.issue_case}`,
      `🔴 *Status  :* ${ticket.status}`,
      `👷 *Handler :* ${ticket.assign_name || '-'}`,
      `⏱️ *Idle    :* ${hoursStr}`,
      '━━━━━━━━━━━━━━━━━━',
      'Mohon segera ditindaklanjuti.',
      `🔗 ${appLink()}`,
    ].join('\n');

    const targets: string[] = [];
    if (handlerUser?.phone_number) targets.push(handlerUser.phone_number);
    (admins ?? []).forEach((a: any) => {
      if (a.phone_number && !targets.includes(a.phone_number)) targets.push(a.phone_number);
    });

    await Promise.allSettled(
      targets.map(phone => sendWANotif({ type: 'reminder_wa', event: 'system.overdue_escalation', target: phone, message: waMsg }))
    );

    await supabase
      .from('tickets')
      .update({ escalation_notified_at: new Date().toISOString() })
      .eq('id', ticket.id);

    escalatedIds.push(ticket.id);
  }

  return { escalated: escalatedIds.length, ids: escalatedIds };
}

// GET - dipanggil Vercel Cron (Authorization: Bearer <CRON_SECRET>)
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runEscalation();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - dipanggil manual atau external cron (X-Cron-Secret: <secret>)
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runEscalation();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
