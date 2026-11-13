import type { Tables } from '@/types/database';

export interface SumberKPI {
  tickets: Pick<Tables<'tickets'>, 'id' | 'assign_name' | 'status' | 'date' | 'created_at'>[];
  actLogs: Pick<Tables<'activity_logs'>, 'id' | 'ticket_id' | 'handler_name' | 'created_at'>[];
  reminders: Pick<Tables<'reminders'>, 'id' | 'assign_name' | 'status' | 'due_date' | 'created_at'>[];
  lcAttempts: Pick<Tables<'lc_quiz_attempts'>, 'id' | 'user_id' | 'score' | 'passed' | 'is_submitted' | 'started_at' | 'grading_status'>[];
  piketRows: Pick<Tables<'piket_schedules'>, 'pic' | 'pic_ivp_name' | 'pic_ump_name' | 'pic_mvi_name' | 'pic_ivp_id' | 'pic_ump_id' | 'pic_mvi_id' | 'day_date'>[];
  formReviews: Pick<Tables<'form_reviews'>, 'id' | 'assign_name' | 'grade_product_knowledge' | 'grade_training_customer' | 'grade_product_knowledge_bast' | 'created_at'>[];
  techNotes: Pick<Tables<'tech_notes'>, 'id' | 'author_id' | 'status' | 'reviewed_at'>[];
}

function ms(nilai: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(nilai) ? `${nilai}T00:00:00Z` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(nilai) ? nilai : `${nilai}Z`);
}

export function saringSumberKPI(sumber: SumberKPI, start: string, end: string): SumberKPI {
  const awal = ms(start), akhir = ms(`${end}T23:59:59`);
  const saring = <T,>(baris: T[], tanggal: (b: T) => string | null | undefined) => baris.filter(b => {
    const v = tanggal(b);
    if (!v) return false;
    const t = ms(v);
    return t >= awal && t <= akhir;
  });
  return {
    tickets: saring(sumber.tickets, b => b.created_at),
    actLogs: saring(sumber.actLogs, b => b.created_at),
    reminders: saring(sumber.reminders, b => b.created_at),
    lcAttempts: saring(sumber.lcAttempts, b => b.started_at),
    piketRows: sumber.piketRows.filter(b => !!b.day_date && b.day_date >= start && b.day_date <= end),
    formReviews: saring(sumber.formReviews, b => b.created_at),
    techNotes: saring(sumber.techNotes, b => b.reviewed_at),
  };
}
