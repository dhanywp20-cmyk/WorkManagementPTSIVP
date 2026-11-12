
export const KUNCI_BRIEFING = 'briefing_pagi';

export type PengaturanBriefing = {
  aktif: boolean;
  pengingatDailyReport: boolean;
};

export const BRIEFING_BAWAAN: PengaturanBriefing = { aktif: true, pengingatDailyReport: true };

export function rapikanBriefing(nilai: unknown): PengaturanBriefing {
  let o: unknown = nilai;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const r = (o && typeof o === 'object' && !Array.isArray(o) ? o : {}) as Record<string, unknown>;
  return {
    aktif: typeof r.aktif === 'boolean' ? r.aktif : BRIEFING_BAWAAN.aktif,
    pengingatDailyReport: typeof r.pengingatDailyReport === 'boolean' ? r.pengingatDailyReport : BRIEFING_BAWAAN.pengingatDailyReport,
  };
}
