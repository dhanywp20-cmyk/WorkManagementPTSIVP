import { cariKandidatTelat, barisLampiran, supportUntukProyek, type SumberSupport, type IncentiveTranche, type IncentiveProjectRow, type IncentiveSplit, type LateTicketLink } from '@/app/(portal)/incentive-pts/_components/calc';

let lulus = 0, gagal = 0;
const cek = (n: string, ok: boolean, c = '') => {
  if (ok) { lulus++; console.log(`  ok    ${n}`); }
  else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); }
};

const proyek = { id: 'P1', project_name: 'BPKP Aceh', bast_date: '2026-02-09' } as IncentiveProjectRow;
const skema = { tranche: [{ nomor: 1, tahunKe: 1, persen: 50 }, { nomor: 2, tahunKe: 2, persen: 50 }] } as never;
const tahap = (nomor: number, status: IncentiveTranche['status'], processed_at: string | null): IncentiveTranche & { project: IncentiveProjectRow } => ({
  id: `T${nomor}`, project_id: 'P1', tranche_number: nomor, percentage: 50, payment_year: 2026 + nomor,
  status, processed_at, paid_at: null, created_at: '2026-02-09', project: proyek, scheme_snapshot: null,
});
const tiket = (id: string, solved: string, assign_name = 'Ferdinan', created_at: string | null = null): SumberSupport['tickets'][number] => ({
  id, project_name: 'BPKP Aceh', reminder_id: null, date: solved.slice(0, 10), assign_name, created_at,
  activity_logs: [{ handler_username: null, handler_name: null, new_status: 'Solved', created_at: solved }],
});
const sumber = (tickets: SumberSupport['tickets']): SumberSupport => ({
  reminders: [], tickets, petaNama: new Map([['ferdinan', 'ferdi']]),
});

console.log('\n1. Deteksi ticket telat');
{
  const t1 = tahap(1, 'processed', '2027-01-15T03:00:00+00:00');
  const t2 = tahap(2, 'pending', null);
  const s = sumber([
    tiket('telat', '2027-01-20T02:00:00+00:00'),
    tiket('sebelum', '2026-12-01T02:00:00+00:00'),
    tiket('tahun2', '2027-06-01T02:00:00+00:00'),
  ]);
  const hasil = cariKandidatTelat(s, [t1, t2], [], [], skema);
  cek('hanya ticket setelah cutoff tahap 1', hasil.length === 1 && hasil[0].ticket_id === 'telat', JSON.stringify(hasil.map(h => h.ticket_id)));
  cek('dilampirkan ke tahap 2', hasil[0]?.tahap_asal === 1 && hasil[0]?.tahap_tujuan === 2);
  const baris = barisLampiran(hasil[0]);
  cek('baris lampiran tidak sunset', baris.is_sunset === false && baris.attached_tranche_number === 2);
}
{
  const t1 = tahap(1, 'processed', '2027-01-15T03:00:00+00:00');
  const s = sumber([tiket('bakdate', '2026-12-01T02:00:00+00:00', 'Ferdinan', '2027-01-20T05:00:00')]);
  const hasil = cariKandidatTelat(s, [t1], [], [], skema);
  cek('ticket dicatat mundur setelah cutoff ikut terdeteksi', hasil.length === 1);
  cek('tanpa tahap pending jadi sunset', hasil[0]?.tahap_tujuan === null && barisLampiran(hasil[0]).is_sunset === true);
  cek('sunset menempel ke tahap asal', barisLampiran(hasil[0]).attached_tranche_number === 1);
}
{
  const t1 = tahap(1, 'paid', '2027-01-15T03:00:00+00:00');
  const s = sumber([tiket('telat', '2027-01-20T02:00:00+00:00')]);
  const split = [{ tranche_id: 'T1', user_id: 'ferdi', user_name: 'Ferdinan' } as IncentiveSplit];
  cek('petugas yang sudah dibayar di tahap itu dilewati', cariKandidatTelat(s, [t1], split, [], skema).length === 0);
  const link = [{ late_ticket_id: 'telat' } as LateTicketLink];
  cek('ticket yang sudah dilampirkan dilewati', cariKandidatTelat(s, [t1], [], link, skema).length === 0);
  cek('tahap pending tidak menghasilkan kandidat', cariKandidatTelat(s, [tahap(1, 'pending', null)], [], [], skema).length === 0);
}

console.log('\n2. Lampiran ikut dihitung saat tahap diproses');
{
  const s = sumber([tiket('telat', '2027-01-20T02:00:00+00:00')]);
  const rentangTahun2 = { dari: '2027-02-09', sampai: '2028-02-09' };
  cek('tanpa lampiran tidak masuk jendela tahun 2', supportUntukProyek(s, proyek, rentangTahun2).length === 0);
  const ada = supportUntukProyek(s, proyek, rentangTahun2, new Set(['telat']));
  cek('dengan lampiran petugas ikut', ada.length === 1 && ada[0].user_id === 'ferdi', JSON.stringify(ada));
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
