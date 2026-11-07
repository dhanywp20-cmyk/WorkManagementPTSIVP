import { readFileSync, existsSync } from 'fs';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. P2-1 deep link ticket di luar jendela muat');
const src = readFileSync('app/(portal)/ticketing/page.tsx', 'utf8');
const awal = src.indexOf('const sudahBukaDariNotif = useRef(false);');
const efek = src.slice(awal, src.indexOf('}, [searchParams, tickets, ticketsLoading, currentUser]', awal));
cek('efek deep link ditemukan', awal > 0 && efek.length > 0);
cek('menunggu daftar selesai dimuat (bukan tickets.length > 0)', /ticketsLoading/.test(efek) && !/tickets\.length === 0/.test(efek));
cek('ticket di daftar dibuka langsung', /tickets\.find\(t => t\.id === openId\)/.test(efek));
cek('di luar daftar -> ambilTiketTertentu (aturan tampil sama)', /ambilTiketTertentu\(currentUser, \[openId\]\)/.test(efek));
cek('guest (bukan pimpinan) tidak lewat jalur tunggal', /currentUser\.role === 'guest' && !isPimpinan\(currentUser\)/.test(efek));
cek('id divalidasi sebelum ke basis data', /\[0-9a-f-\]\{36\}/.test(efek));
cek('tidak ditemukan / galat -> pemberitahuan', (efek.match(/notify\('error'/g) ?? []).length >= 2);
cek('sekali jalan (tidak membuka ulang saat refetch)', /sudahBukaDariNotif\.current = true/.test(efek));

console.log('\n2. P2-3 dokumentasi lineage');
const jalur = 'docs/alur/project-360-lineage.md';
cek('dokumen ada', existsSync(jalur));
const dok = existsSync(jalur) ? readFileSync(jalur, 'utf8') : '';
for (const t of ['reminders', 'tickets', 'project_requests', 'form_reviews', 'progress_projects', 'checklist_proyek', 'movement_logs', 'daily_reports'])
  cek(`menyebut ${t}`, dok.includes(t));
cek('menjelaskan auto / manual / ignored', /auto/.test(dok) && /manual/.test(dok) && /ignored/.test(dok));

console.log(`\n${gagal ? 'GAGAL' : 'LULUS'}: ${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
