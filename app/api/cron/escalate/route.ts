import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Threshold: tiket dianggap "stuck" jika tidak ada aktivitas dalam N jam
const ESCALATION_HOURS: Record<string, number> = {
  Critical : 4,
  High     : 12,
  Medium   : 24,
  Low      : 48,
};
const DEFAULT_HOURS = 24;

export async function POST(request: NextRequest) {
  // Proteksi endpoint: hanya boleh dari cron job dengan secret
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Ambil semua tiket yang berpotensi stuck
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, project_name, issue_case, assign_name, status, priority, created_at, escalation_notified_at, activity_logs(created_at)')
      .in('status', ['Pending', 'Call', 'Onsite', 'In Progress', 'Waiting sparepart', 'Waiting PO from Sales', 'Submit RMA'])
      .neq('status', 'Rejected');

    if (!tickets?.length) {
      return NextResponse.json({ escalated: 0 });
    }

    const now = Date.now();
    const escalatedIds: string[] = [];

    for (const ticket of tickets) {
      const threshold = ESCALATION_HOURS[ticket.priority ?? 'Medium'] ?? DEFAULT_HOURS;
      const logs = (ticket.activity_logs ?? []) as { created_at: string }[];
      const lastActivity = logs.length
        ? Math.max(...logs.map(l => new Date(l.created_at).getTime()))
        : new Date(ticket.created_at).getTime();

      const hoursIdle = (now - lastActivity) / 3_600_000;

      // Skip jika belum melewati threshold
      if (hoursIdle < threshold) continue;

      // Skip jika sudah dinaikkan escalasi dalam 24 jam terakhir
      if (ticket.escalation_notified_at) {
        const lastEsc = new Date(ticket.escalation_notified_at).getTime();
        if (now - lastEsc < 24 * 3_600_000) continue;
      }

      // Cari phone handler
      const { data: handlerUser } = await supabase
        .from('users')
        .select('phone_number, full_name')
        .eq('full_name', ticket.assign_name)
        .maybeSingle();

      // Cari semua admin
      const { data: admins } = await supabase
        .from('users')
        .select('phone_number, full_name')
        .in('role', ['admin', 'superadmin'])
        .not('phone_number', 'is', null);

      const hoursStr = hoursIdle < 1 ? `${Math.round(hoursIdle * 60)} menit` : `${Math.floor(hoursIdle)} jam`;
      const waMsg = [
        `⚠️ *[ESKALASI] Tiket Tidak Ada Aktivitas ${hoursStr}*`,
        '━━━━━━━━━━━━━━━━━━',
        `📌 *Project :* ${ticket.project_name}`,
        `⚠️ *Issue   :* ${ticket.issue_case}`,
        `🔴 *Status  :* ${ticket.status}`,
        `👷 *Handler :* ${ticket.assign_name || '-'}`,
        `⏱️ *Idle    :* ${hoursStr}`,
        '━━━━━━━━━━━━━━━━━━',
        'Mohon segera ditindaklanjuti.',
        '🔗 https://team-ticketing.vercel.app/dashboard',
      ].join('\n');

      // Kirim WA ke handler
      const targets: string[] = [];
      if (handlerUser?.phone_number) targets.push(handlerUser.phone_number);
      (admins ?? []).forEach((a: any) => { if (a.phone_number && !targets.includes(a.phone_number)) targets.push(a.phone_number); });

      for (const phone of targets) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_WA_API_URL ?? ''}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: phone, message: waMsg }),
          });
        } catch { /* WA gagal — tetap lanjut */ }
      }

      // Update escalation_notified_at
      await supabase
        .from('tickets')
        .update({ escalation_notified_at: new Date().toISOString() })
        .eq('id', ticket.id);

      escalatedIds.push(ticket.id);
    }

    return NextResponse.json({ escalated: escalatedIds.length, ids: escalatedIds });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Juga support GET untuk testing manual dari browser (admin only, tanpa secret check)
export async function GET() {
  return NextResponse.json({ message: 'Escalation cron endpoint. Use POST with X-Cron-Secret header.' });
}
