import { bolehDitugaskanOleh, adalahAdminMurni } from '@/lib/teams';

// Aturan: hanya Admin (role admin/superadmin murni) yang boleh meng-assign
// Manager. Team, Supervisor, dan bawahan lain tidak boleh.

let gagal = 0;
const cek = (s: boolean, l: string) => { console.log(`${s ? 'OK  ' : 'GAGAL'}  ${l}`); if (!s) gagal++; };

// Keadaan nyata di produksi: toggle bisa_ditugaskan Dhany dimatikan.
const dhany = { team_type: 'Team PTS IVP', jabatan: 'Manager', bisa_ditugaskan: false };
const deni = { team_type: 'Team PTS IVP', jabatan: null, bisa_ditugaskan: true };
const nonaktif = { team_type: 'Team PTS IVP', jabatan: null, bisa_ditugaskan: false };
const managerUMP = { team_type: 'Team PTS UMP', jabatan: 'Manager', bisa_ditugaskan: true };

cek(bolehDitugaskanOleh(dhany, true), 'Admin boleh assign Manager walau toggle-nya mati');
cek(!bolehDitugaskanOleh(dhany, false), 'Non-admin tidak boleh assign Manager');
cek(!bolehDitugaskanOleh({ ...dhany, bisa_ditugaskan: true }, false), 'Non-admin tetap tidak boleh walau toggle Manager nyala');
cek(bolehDitugaskanOleh(deni, false) && bolehDitugaskanOleh(deni, true), 'Anggota biasa tetap bisa dipilih siapa pun');
cek(!bolehDitugaskanOleh(nonaktif, true), 'Toggle mati pada anggota biasa tetap berlaku untuk Admin');
cek(!bolehDitugaskanOleh(managerUMP, true), 'Manager dari tim yang tidak ditugaskan (UMP) tidak ditawarkan');

cek(adalahAdminMurni({ role: 'admin' }) && adalahAdminMurni({ role: 'SuperAdmin' }), 'admin/superadmin = Admin murni');
cek(!adalahAdminMurni({ role: 'team' }) && !adalahAdminMurni(null), 'team / tanpa user bukan Admin');

if (gagal) { console.error(`\n${gagal} cek gagal`); process.exit(1); }
console.log('\nSemua cek lolos');
