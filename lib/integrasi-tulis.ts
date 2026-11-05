import type { Aksi } from '@/lib/integrasi-tulis-bersama';
import { tiketBuat, tiketSetujui } from '@/lib/integrasi-tulis-tiket';
import { desainAssign, desainStatus, desainTolak, desainReviewInternal, desainAjukanUlang, desainPesan } from '@/lib/integrasi-tulis-desain';
import { catatanBuat, catatanReview } from '@/lib/integrasi-tulis-catatan';
import { unitCatat, unitKembali, piketCatat } from '@/lib/integrasi-tulis-unit';

export const AKSI_MENU_TULIS: Record<string, Aksi> = {
  tiket_buat: tiketBuat,
  tiket_setujui: tiketSetujui,
  desain_assign: desainAssign,
  desain_status: desainStatus,
  desain_tolak: desainTolak,
  desain_review_internal: desainReviewInternal,
  desain_ajukan_ulang: desainAjukanUlang,
  desain_pesan: desainPesan,
  catatan_buat: catatanBuat,
  catatan_review: catatanReview,
  unit_catat: unitCatat,
  unit_kembali: unitKembali,
  piket_catat: piketCatat,
};
