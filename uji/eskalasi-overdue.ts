import { readFileSync } from 'fs';
import { perluDieskalasi, type Ticket, type OverdueSetting } from '@/app/(portal)/ticketing/_components/shared';

let gagal = 0;
const cek = (s: boolean, l: string) => { console.log(`${s ? 'OK  ' : 'GAGAL'}  ${l}`); if (!s) gagal++; };

const jam = 3600_000;
const lalu = (j: number) => new Date(Date.now() - j * jam).toISOString();
const tiket = (status: string, logJamLalu: number[] = []): Ticket => ({
  id: 't1', project_name: 'BPKP', customer_phone: '', sales_name: '', issue_case: '', description: '', assign_name: 'Dhany Wahyu',
  status, date: '', created_at: lalu(24 * 10), current_team: 'Team PTS IVP',
  activity_logs: logJamLalu.map((j, i) => ({ id: `a${i}`, ticket_id: 't1', handler_name: 'Dhany Wahyu', new_status: 'Call', created_at: lalu(j) }) as never),
});
const tenggat = (jamLalu: number): OverdueSetting[] => [{ id: 'o1', ticket_id: 't1', due_date: lalu(jamLalu), due_hours: null } as never];

cek(perluDieskalasi(tiket('Pending Action', [24 * 7]), tenggat(4)), 'lewat tenggat, tidak ada aktivitas sesudahnya -> Overdue');
cek(!perluDieskalasi(tiket('In Progress', [24 * 7, 1]), tenggat(4)), 'handler update SESUDAH tenggat -> status pilihan handler tidak ditimpa');
cek(!perluDieskalasi(tiket('Pending Action', [24 * 7]), [{ id: 'o1', ticket_id: 't1', due_date: new Date(Date.now() + 24 * jam).toISOString(), due_hours: null } as never]), 'tenggat diperpanjang -> tidak Overdue');
for (const s of ['Solved', 'Overdue', 'Waiting Approval', 'Rejected', 'Cancelled'])
  cek(!perluDieskalasi(tiket(s), tenggat(4)), `${s} tidak pernah dieskalasi`);

const efek = readFileSync('app/(portal)/ticketing/_components/useEfekLiveTicketing.ts', 'utf8');
cek(/tickets\.filter\(t => perluDieskalasi\(t, overdueSettings\)\)/.test(efek), 'eskalasi otomatis memakai perluDieskalasi');

const aktivitas = readFileSync('app/(portal)/ticketing/_components/useTambahAktivitas.ts', 'utf8');
cek(/if \(!catatanSaja && !validStatusesPTS\.includes/.test(aktivitas), '"Tambah catatan saja" pada ticket Overdue tidak ditolak "Invalid status!"');

console.log(gagal ? `\nGAGAL: ${gagal}` : '\nLULUS');
if (gagal) process.exit(1);
