/*
  UJI: kolom Support di rekap Excel tidak boleh kosong padahal Troubleshooting-nya
  jelas ada.

  Laporan: "excel di table support kosong padahal ada project yang ada trigger
  troubleshooting team dan masuk ke support".

  Layar Incentive PTS dulu punya SALINAN SENDIRI aturan penilaian Support di
  handleExportSummary - satu kueri ke `reminders` saja, dikelompokkan dengan
  project_name apa adanya sebagai kunci. Dua perbaikan yang sudah lama ada di
  fetchSupportFromTickets tidak ikut tersalin, dan dua-duanya menghasilkan
  kolom kosong tanpa satu pun pesan galat:

    1. Ticket berstatus Solved tidak dibaca. Troubleshooting yang ditutup
       lewat Ticketing - tanpa pernah dijadwalkan ulang sebagai reminder
       Onsite - tidak pernah menghasilkan porsi Support.
    2. Nama proyek dicocokkan persis, jadi "BPKP ICT TIMUR" dan "BPKP ICT
       Timur" adalah dua kunci berbeda dan tidak pernah bertemu.

  Uji ini meniru kedua aturan pencocokan itu dan membuktikan bentuk lama
  memang gagal sementara bentuk sekarang menemukannya.

    node uji/support-rekap.mjs
*/

let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

/** Sama dengan samakanNamaProyek di calc.ts. */
const samakan = (v) => (v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

// ── Data uji: satu proyek, Troubleshooting-nya datang dari dua jalur ──────
const proyek = { id: 'p1', project_name: 'BPKP ICT Timur' };

const reminders = [
  // Nama diketik ulang dengan huruf & spasi berbeda - proyek yang sama bagi manusia.
  { project_name: 'BPKP  ICT TIMUR ', assigned_to: 'ferdinan', assign_name: 'Ferdinan Agustinus', due_date: '2026-05-02' },
];
const tickets = [
  // Ditutup lewat Ticketing, tidak pernah jadi reminder Onsite.
  { id: 't1', project_name: 'BPKP ICT Timur', reminder_id: null, date: '2026-07-01',
    assign_name: 'Pandu Kusuma Adji', activity_logs: [{ new_status: 'Solved', created_at: '2026-07-03T09:00:00Z' }] },
];
const petaNama = new Map([[samakan('Pandu Kusuma Adji'), 'pandu']]);

/** BENTUK LAMA: hanya reminders, kunci nama apa adanya. */
function supportLama(proyek) {
  const peta = new Map();
  for (const r of reminders) {
    if (!r.assigned_to) continue;
    const arr = peta.get(r.project_name) || [];
    arr.push({ user_id: r.assigned_to, user_name: r.assign_name });
    peta.set(r.project_name, arr);
  }
  return peta.get(proyek.project_name) || [];
}

/** BENTUK SEKARANG: dua sumber, nama dinormalkan, username dipetakan. */
function supportSekarang(proyek, rentang) {
  const dicari = samakan(proyek.project_name);
  const hasil = [];
  const sudah = new Set();
  const tambah = (id, nama) => {
    const k = (id ?? '').trim();
    if (!k || sudah.has(k)) return;
    sudah.add(k); hasil.push({ user_id: k, user_name: nama || '' });
  };
  const didalam = (tgl) => {
    if (!rentang?.dari && !rentang?.sampai) return true;
    if (!tgl) return false;
    if (rentang?.dari && !(tgl > rentang.dari)) return false;
    if (rentang?.sampai && !(tgl <= rentang.sampai)) return false;
    return true;
  };

  for (const r of reminders) {
    if (samakan(r.project_name) !== dicari) continue;
    if (!didalam((r.due_date ?? '').slice(0, 10))) continue;
    tambah(r.assigned_to, r.assign_name);
  }
  for (const t of tickets) {
    const cocok = (proyek.id && t.reminder_id === proyek.id) || samakan(t.project_name) === dicari;
    if (!cocok) continue;
    const solved = (t.activity_logs ?? []).filter(a => (a.new_status ?? '').toLowerCase() === 'solved');
    const tgl = solved.length
      ? solved.map(a => (a.created_at ?? '').slice(0, 10)).sort().at(-1)
      : (t.date ?? '').slice(0, 10);
    if (!didalam(tgl)) continue;
    tambah(petaNama.get(samakan(t.assign_name)) ?? t.assign_name, t.assign_name);
  }
  return hasil;
}

console.log('\n1. Bentuk LAMA - membuktikan kolom Support memang bisa kosong');
{
  const hasil = supportLama(proyek);
  ok('Tidak menemukan siapa pun - persis keluhan "Support kosong"', hasil.length === 0,
    JSON.stringify(hasil));
}

console.log('\n2. Bentuk SEKARANG - keduanya ketemu');
{
  const hasil = supportSekarang(proyek);
  const nama = hasil.map(h => h.user_name).sort();
  ok('Dapat 2 orang', hasil.length === 2, JSON.stringify(nama));
  ok('Dari jalur reminder (nama proyek beda huruf/spasi) tetap ketemu',
    nama.includes('Ferdinan Agustinus'));
  ok('Dari jalur ticket Solved ikut terhitung', nama.includes('Pandu Kusuma Adji'));
  ok('Handler ticket dipetakan ke username, bukan nama mentah',
    hasil.find(h => h.user_name === 'Pandu Kusuma Adji').user_id === 'pandu');
}

console.log('\n3. Rekap tanpa batas tahun memuat SELURUH Troubleshooting');
{
  //  Rekap Summary memang lintas tahun - tidak boleh menjatuhkan pekerjaan
  //  hanya karena rentangnya tidak disebutkan.
  ok('Tanpa rentang, dua-duanya masuk', supportSekarang(proyek, undefined).length === 2);
  ok('Tanpa rentang, baris tanpa tanggal pun tidak dibuang',
    supportSekarang({ ...proyek }, {}).length === 2);
}

console.log('\n4. Rentang tahun tetap dihormati saat diminta');
{
  //  Jendela tahun ke-1 (BAST 2026-01-01 .. 2027-01-01) memuat keduanya;
  //  jendela yang lebih sempit hanya memuat yang Mei.
  const sempit = supportSekarang(proyek, { dari: '2026-04-01', sampai: '2026-06-01' });
  ok('Hanya yang di dalam rentang', sempit.length === 1, JSON.stringify(sempit.map(s => s.user_name)));
  ok('Yang masuk adalah jalur reminder Mei', sempit[0].user_name === 'Ferdinan Agustinus');
}

console.log('\n5. Proyek lain tidak ikut terseret');
{
  const lain = supportSekarang({ id: 'p9', project_name: 'Proyek Lain' });
  ok('Kosong untuk proyek yang tidak punya Troubleshooting', lain.length === 0);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
