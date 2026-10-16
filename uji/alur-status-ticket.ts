import {
  ALUR_STATUS_PTS, alasanBelumBisa, bolehCatatanSaja, statusBerikutnya, updateSah, wajibCatatan,
} from '@/app/(portal)/ticketing/_components/alur-status';

// Aturan pindah status di panel "Update Status" Ticketing (Team PTS).

let gagal = 0;
const cek = (s: boolean, l: string) => { console.log(`${s ? 'OK  ' : 'GAGAL'}  ${l}`); if (!s) gagal++; };
const boleh = (sekarang: string) => statusBerikutnya(sekarang).join(',');

// ── Aturan 1: Pending = status awal: mulai ditangani atau langsung Solved ──
cek(boleh('Pending') === 'Call,Onsite,In Progress,Solved', `Pending -> Call/Onsite/In Progress/Solved (${boleh('Pending')})`);
cek(updateSah('Pending', 'Solved'), 'Pending BISA langsung Solved (kasus BCA sentul BLBI: tidak perlu mengarang Onsite dulu)');
cek(wajibCatatan('Pending', 'Solved'), 'Pending -> Solved tetap wajib catatan penyelesaian');
cek(!updateSah('Pending', 'Pending Action'), 'Pending tidak bisa langsung Pending Action (belum ditangani)');
cek(alasanBelumBisa('Pending')?.startsWith('Pending Action') === true, 'Pending: ada keterangan kenapa Pending Action belum bisa');

// ── Aturan 2: setelah ditangani, bebas berpindah ──────────────────────────
cek(boleh('Call') === 'Onsite,In Progress,Pending Action,Solved', `Call -> semua kecuali Pending (${boleh('Call')})`);
cek(boleh('Onsite') === 'Call,In Progress,Pending Action,Solved', `Onsite -> boleh Call lagi (follow-up) (${boleh('Onsite')})`);
cek(boleh('In Progress') === 'Call,Onsite,Pending Action,Solved', `In Progress -> boleh Onsite lagi (kunjungan ulang) (${boleh('In Progress')})`);
cek(boleh('Pending Action') === 'Call,Onsite,In Progress,Solved', `Pending Action -> lanjut ke mana saja setelah kendala beres (${boleh('Pending Action')})`);
cek(['Call', 'Onsite', 'In Progress', 'Pending Action'].every(s => !updateSah(s, 'Pending')), 'Setelah ditangani tidak bisa kembali ke Pending');
cek(['Call', 'Onsite', 'In Progress', 'Pending Action'].every(s => alasanBelumBisa(s) === null), 'Setelah ditangani: tidak ada status yang terkunci');

// ── Aturan 3: Solved dari mana saja, lalu terkunci ────────────────────────
cek(updateSah('Call', 'Solved'), 'Solved langsung dari Call (selesai lewat telepon/remote)');
cek(boleh('Solved') === '', 'Solved: tidak ada pindah status (Buka Ulang lewat tombol khusus)');
cek(!bolehCatatanSaja('Solved'), 'Solved: tidak bisa tambah catatan dari panel ini');
cek(boleh('Waiting Approval') === '', 'Waiting Approval: belum bisa diupdate (menunggu persetujuan)');

// ── Catatan saja (status tetap) ───────────────────────────────────────────
cek(['Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action'].every(s => updateSah(s, s)), 'Tambah catatan saja boleh di semua status selain Solved');
cek(['Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action'].every(s => wajibCatatan(s, s)), 'Catatan saja: notes wajib');

// ── Notes wajib ───────────────────────────────────────────────────────────
cek(wajibCatatan('Call', 'Pending Action') && wajibCatatan('In Progress', 'Solved'), 'Pending Action (alasan) & Solved: notes wajib');
cek(!wajibCatatan('Pending', 'Call') && !wajibCatatan('Pending', 'Onsite') && !wajibCatatan('Call', 'In Progress'), 'Call / Onsite / In Progress: notes opsional');

// ── Status asing tidak bocor ──────────────────────────────────────────────
cek(!updateSah('In Progress', 'Warranty'), 'Status Team Services tidak sah di alur PTS');
cek(ALUR_STATUS_PTS.length === 6, 'Daftar status PTS tetap 6');

if (gagal) { console.error(`\n${gagal} cek gagal`); process.exit(1); }
console.log('\nSemua cek lolos');
