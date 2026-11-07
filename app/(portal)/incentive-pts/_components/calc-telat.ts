import type { SkemaInsentif } from '@/lib/incentive/scheme';
import type { IncentiveProjectRow, IncentiveSplit, IncentiveTranche, LateTicketLink } from './calc-tipe';
import {
  jendelaSupportTahap, didalamRentang, samakanNamaProyek, tglSelesaiTiket, waktuTercatatTiket,
  type SumberSupport,
} from './calc-support';

type Tahap = IncentiveTranche & { project?: IncentiveProjectRow };

export interface KandidatTelat {
  ticket_id: string;
  project_id: string;
  project_name: string;
  petugas: string;
  tgl_selesai: string;
  tahap_asal: number;
  tahap_tujuan: number | null;
}

export function tahunKeTahap(t: Tahap, skema: SkemaInsentif | null): number {
  const sk = (t.scheme_snapshot as SkemaInsentif | null) ?? skema;
  const dariSkema = sk?.tranche.find(x => x.nomor === t.tranche_number)?.tahunKe;
  if (dariSkema) return dariSkema;
  const tahunBast = new Date(t.project?.bast_date || '').getFullYear();
  return Math.max(1, (t.payment_year || 0) - tahunBast);
}

function batasTahap(t: Tahap): number {
  const v = t.processed_at ?? t.paid_at;
  return v ? Date.parse(v) : NaN;
}

export function cariKandidatTelat(
  sumber: SumberSupport,
  tahapan: Tahap[],
  pembagian: IncentiveSplit[],
  lampiran: LateTicketLink[],
  skema: SkemaInsentif | null,
): KandidatTelat[] {
  const sudahDilampirkan = new Set(lampiran.map(l => l.late_ticket_id).filter(Boolean));
  const usernameDariNama = (nama: string | null | undefined) =>
    sumber.petaNama.get(samakanNamaProyek(nama ?? '')) ?? (nama ?? '');

  const perProyek = new Map<string, Tahap[]>();
  for (const t of tahapan) {
    if (!t.project?.bast_date) continue;
    const daftar = perProyek.get(t.project_id) ?? [];
    daftar.push(t);
    perProyek.set(t.project_id, daftar);
  }

  const hasil: KandidatTelat[] = [];
  for (const [projectId, daftar] of perProyek) {
    daftar.sort((a, b) => a.tranche_number - b.tranche_number);
    const proyek = daftar[0].project as IncentiveProjectRow;
    const dicari = samakanNamaProyek(proyek.project_name ?? '');
    if (!dicari) continue;
    const jendela = (t: Tahap) => jendelaSupportTahap(proyek.bast_date, tahunKeTahap(t, skema));
    const tertutup = daftar.filter(t => t.status !== 'pending' && !Number.isNaN(batasTahap(t)));
    const terbuka = daftar.filter(t => t.status === 'pending');
    if (!tertutup.length) continue;

    for (const tiket of sumber.tickets) {
      if (sudahDilampirkan.has(tiket.id)) continue;
      const cocok = tiket.reminder_id === projectId || samakanNamaProyek(tiket.project_name ?? '') === dicari;
      if (!cocok) continue;
      const tgl = tglSelesaiTiket(tiket);
      if (terbuka.some(t => didalamRentang(tgl, jendela(t)))) continue;
      const asal = tertutup.find(t => didalamRentang(tgl, jendela(t)));
      if (!asal) continue;
      if (!(waktuTercatatTiket(tiket) > batasTahap(asal))) continue;

      const petugas = usernameDariNama(tiket.assign_name);
      const kenal = new Set([petugas, tiket.assign_name ?? ''].map(v => samakanNamaProyek(v)).filter(Boolean));
      const sudahDibayar = pembagian.some(s => s.tranche_id === asal.id
        && (kenal.has(samakanNamaProyek(s.user_id ?? '')) || kenal.has(samakanNamaProyek(s.user_name ?? ''))));
      if (sudahDibayar) continue;

      const tujuan = terbuka.find(t => t.tranche_number > asal.tranche_number);
      hasil.push({
        ticket_id: tiket.id,
        project_id: projectId,
        project_name: proyek.project_name,
        petugas: tiket.assign_name || petugas,
        tgl_selesai: tgl,
        tahap_asal: asal.tranche_number,
        tahap_tujuan: tujuan?.tranche_number ?? null,
      });
    }
  }
  return hasil.sort((a, b) => a.project_name.localeCompare(b.project_name) || a.tgl_selesai.localeCompare(b.tgl_selesai));
}

export function barisLampiran(k: KandidatTelat): Omit<LateTicketLink, 'id' | 'attached_at'> {
  const sunset = k.tahap_tujuan === null;
  return {
    late_ticket_id: k.ticket_id,
    parent_project_id: k.project_id,
    attached_tranche_number: k.tahap_tujuan ?? k.tahap_asal,
    note: sunset
      ? `${k.petugas} - selesai ${k.tgl_selesai}, tahap ${k.tahap_asal} sudah diproses dan tidak ada tahap berikutnya`
      : `${k.petugas} - selesai ${k.tgl_selesai}, setelah tahap ${k.tahap_asal} diproses`,
    ticket_value: 0,
    is_sunset: sunset,
  };
}
