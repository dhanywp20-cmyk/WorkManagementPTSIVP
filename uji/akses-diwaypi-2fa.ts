/**
 * uji/akses-diwaypi-2fa.ts - Integrasi DIWAYPI & 2FA hanya untuk admin dan akun yang ditunjuk lewat
 * toggle Full Access (lib/constants.ts bolehDiwaypiDan2FA). Guest - termasuk Supervisor sales - dan
 * Team biasa ditolak; access_level 'full' pada akun non-team diabaikan.
 *
 * Jalankan: npx tsx uji/akses-diwaypi-2fa.ts
 */
import { bolehDiwaypiDan2FA } from '../lib/constants';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nAkses DIWAYPI & 2FA');
cek('admin boleh', bolehDiwaypiDan2FA({ role: 'admin', access_level: 'guest' }));
cek('superadmin boleh', bolehDiwaypiDan2FA({ role: 'SuperAdmin' }));
cek('team + Full Access (ditunjuk) boleh', bolehDiwaypiDan2FA({ role: 'team', access_level: 'full' }));
cek('team biasa ditolak', !bolehDiwaypiDan2FA({ role: 'team', access_level: 'guest' }));
cek('guest (Supervisor sales) ditolak', !bolehDiwaypiDan2FA({ role: 'guest', access_level: null }));
cek('guest ber-access_level full tetap ditolak', !bolehDiwaypiDan2FA({ role: 'guest', access_level: 'full' }));
cek('tanpa akun ditolak', !bolehDiwaypiDan2FA(null) && !bolehDiwaypiDan2FA(undefined));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
